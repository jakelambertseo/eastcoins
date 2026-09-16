/* ============================================================
   EastCoin Picks — site-wide notices (admin)

   One line that lands in everyone's bell: a new feature, a heads-up,
   "the casino is paused for an hour". Stored as an ops_status row
   keyed notice:<slug>, read by /api/picks/notifications, which shows
   it unread to anyone who has not opened the bell since it was
   posted and toasts it on every open tab within a poll.

     GET  /api/picks/admin/notice           the last few, newest first
     POST { title, text, href, icon }       post one
     POST { key, action: "remove" }         pull one

   Nothing is sent to chat or Discord: a notice is on-site only, so
   posting one can never be a surprise in someone's stream.
   ============================================================ */

import { ADMIN_ALLOWLIST, getSessionUser, json, fail } from "../_lib.js";
import { ensureOps, noteStatus, readStatus } from "../_ops.js";

const MAX_TITLE = 80;
const MAX_TEXT = 200;
const clean = (v, max) => String(v ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

/** "Watch rooms are here" -> "watch-rooms-are-here", trimmed. */
const slugify = (title) => String(title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

async function gate(context) {
  const db = context.env.PICKS_DB;
  if (!db) return { error: fail("DB_UNAVAILABLE", "Picks database is not connected.", 503) };
  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) return { error: fail("NOT_ADMIN", "Only Picks admins can post notices.", 403) };
  return { db, user };
}

async function list(db) {
  await ensureOps(db);
  const rows = await db
    .prepare(`SELECT key, value, updated_at FROM ops_status WHERE key LIKE 'notice:%' ORDER BY updated_at DESC LIMIT 10`)
    .all()
    .catch(() => ({ results: [] }));
  return (rows.results || []).map((r) => {
    let v = {}; try { v = JSON.parse(r.value) || {}; } catch { v = {}; }
    const at = String(r.updated_at).replace(" ", "T") + "Z";
    return {
      key: r.key,
      title: String(v.title || ""),
      text: String(v.text || ""),
      href: String(v.href || "/"),
      icon: String(v.icon || "📣"),
      by: String(v.by || ""),
      at,
      // The bell only carries notices from the last fortnight; older
      // ones are still here but nobody is seeing them.
      live: Date.now() - new Date(at).getTime() < 14 * 24 * 3600 * 1000
    };
  });
}

export async function onRequestGet(context) {
  const { db, error } = await gate(context);
  if (error) return error;
  return json({ ok: true, notices: await list(db) });
}

export async function onRequestPost(context) {
  const { db, user, error } = await gate(context);
  if (error) return error;

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }

  if (String(body.action || "") === "remove") {
    const key = String(body.key || "");
    if (!/^notice:[a-z0-9-]{1,48}$/.test(key)) return fail("BAD_KEY", "That isn't a notice.");
    await ensureOps(db);
    await db.prepare(`DELETE FROM ops_status WHERE key = ?`).bind(key).run();
    console.log(`Picks: ${user.login} pulled ${key}`);
    return json({ ok: true, removed: key, notices: await list(db) });
  }

  const title = clean(body.title, MAX_TITLE);
  const text = clean(body.text, MAX_TEXT);
  const icon = clean(body.icon, 4) || "📣";
  // Same-origin links only: a notice is a pointer into the site, and an
  // outside link in everyone's bell is a different kind of thing.
  let href = String(body.href || "/").trim();
  if (!href.startsWith("/")) href = "/";
  href = href.replace(/[<>"']/g, "").slice(0, 200);

  if (title.length < 4) return fail("BAD_TITLE", "Give the notice a title — that's the bold line people read.");
  if (text.length < 4) return fail("BAD_TEXT", "Add a line saying what it is.");

  const slug = slugify(body.slug || title);
  if (!slug) return fail("BAD_TITLE", "That title has nothing to make a name from.");
  const key = `notice:${slug}`;

  // Reposting the same title updates that notice and moves it to now,
  // which makes it unread again for everyone. Deliberate: that is how
  // a corrected notice gets seen.
  await noteStatus(db, key, { title, text, href, icon, by: user.login });
  const back = await readStatus(db, [key]).catch(() => ({}));
  console.log(`Picks: ${user.login} posted ${key}`);
  return json({ ok: true, key, at: back[key]?.at || new Date().toISOString(), notices: await list(db) });
}
