/* ============================================================
   Profile views (2026-09-16)

   How many people have opened someone's profile. Two rules make the
   number worth showing at all:

     one per viewer per Chicago day — refreshing your own page, or
     somebody sitting on yours, cannot run it up; and

     never your own — you are not an audience.

   The count lives on users.profile_views, so the profile's existing
   SELECT carries it and reading costs nothing. The dedupe rows live in
   profile_view_hits, which is kept to a few days: it exists to answer
   "has this person already been counted today", never "who looked".
   A signed-out viewer is a hash of their address and the day, which
   cannot be turned back into an address and changes every day.
   ============================================================ */

const KEEP_DAYS = 3;

let ready = false;
export async function ensureViews(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS profile_view_hits (
      login TEXT NOT NULL,
      viewer TEXT NOT NULL,
      day TEXT NOT NULL,
      PRIMARY KEY (login, viewer, day)
    )`).run();
  await db.prepare(`ALTER TABLE users ADD COLUMN profile_views INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  ready = true;
}

/** The Chicago day, so it turns over when the community's day does. */
function chicagoDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now);
}

async function viewerKey(request, viewer, day) {
  if (viewer?.twitch_id) return `u:${viewer.twitch_id}`;
  const ip = request.headers.get("CF-Connecting-IP") || "";
  if (!ip) return "";
  const bytes = new TextEncoder().encode(`${ip}:${day}:profile-view`);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `a:${[...new Uint8Array(hash)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Counts one view of `login` and returns the new total (or the old one
 * when this viewer has already been counted today). Never throws: a
 * profile that cannot count its views still has to load.
 */
export async function countView(db, request, login, viewer) {
  try {
    await ensureViews(db);
    const day = chicagoDay();
    const who = String(login).toLowerCase();
    if (viewer && String(viewer.twitch_login || "").toLowerCase() === who) return null;
    const key = await viewerKey(request, viewer, day);
    if (!key) return null;
    const hit = await db
      .prepare(`INSERT OR IGNORE INTO profile_view_hits (login, viewer, day) VALUES (?, ?, ?)`)
      .bind(who, key, day).run();
    if (!hit?.meta?.changes) return null;
    await db.prepare(`UPDATE users SET profile_views = COALESCE(profile_views, 0) + 1 WHERE twitch_login = ? COLLATE NOCASE`)
      .bind(who).run();
    // The dedupe rows are only useful while their day is current. One
    // sweep every hundred or so new viewers keeps the table small
    // without a cron entry of its own.
    if (Math.random() < 0.01) {
      await db.prepare(`DELETE FROM profile_view_hits WHERE day < ?`)
        .bind(chicagoDay(new Date(Date.now() - KEEP_DAYS * 86400000))).run().catch(() => {});
    }
    return true;
  } catch {
    return null;
  }
}
