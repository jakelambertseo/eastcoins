/* ============================================================
   Who's here — sitewide presence

   Every open tab sends a heartbeat every 30 seconds with where it
   is (events, picks, music, …). Logged-in people are named with
   their picture; everyone else is a guest and counted. A tab that
   stops beating drops off after a minute.

     POST /api/presence   { client, where }
     GET  /api/presence   → { people, guests, total, where: {…} }
   ============================================================ */

import { getSessionUser } from "./picks/_lib.js";

const WINDOW_MS = 75 * 1000;
let ready = false;

async function ensure(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS site_presence (
      client_id TEXT PRIMARY KEY,
      user_id TEXT,
      place TEXT NOT NULL DEFAULT '',
      seen_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_site_presence_seen ON site_presence (seen_at)`)
  ]);
  ready = true;
}

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false }, 503);
  await ensure(db);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const client = String(body.client || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  const place = String(body.where || "").replace(/[^a-z-]/g, "").slice(0, 24);
  if (!client) return json({ ok: false, code: "NO_CLIENT" }, 400);

  const user = await getSessionUser(db, context.request);
  const now = Date.now();
  await db
    .prepare(`INSERT INTO site_presence (client_id, user_id, place, seen_at) VALUES (?, ?, ?, ?)
              ON CONFLICT(client_id) DO UPDATE SET user_id = excluded.user_id, place = excluded.place, seen_at = excluded.seen_at`)
    .bind(client, user ? user.id : null, place, now)
    .run();

  // Housekeeping on the way: anything an hour stale is gone.
  if (Math.random() < 0.05) {
    await db.prepare(`DELETE FROM site_presence WHERE seen_at < ?`).bind(now - 3600 * 1000).run().catch(() => {});
  }
  return json({ ok: true });
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false }, 503);
  await ensure(db);

  const since = Date.now() - WINDOW_MS;
  const rows = await db
    .prepare(
      `SELECT p.client_id, p.user_id, p.place, p.seen_at, u.twitch_login, u.display_name, u.avatar_url
         FROM site_presence p LEFT JOIN users u ON u.twitch_id = p.user_id
        WHERE p.seen_at >= ?
        ORDER BY p.seen_at DESC`
    )
    .bind(since)
    .all();

  // One person may have several tabs open; they count once, at the
  // place they were most recently seen.
  const people = new Map();
  let guests = 0;
  const where = {};
  for (const r of rows.results || []) {
    const place = String(r.place || "");
    if (r.user_id && r.twitch_login) {
      if (!people.has(r.user_id)) {
        people.set(r.user_id, {
          login: String(r.twitch_login).toLowerCase(),
          displayName: String(r.display_name || r.twitch_login),
          avatar: String(r.avatar_url || ""),
          where: place
        });
        where[place] = (where[place] || 0) + 1;
      }
    } else {
      guests += 1;
      where[place] = (where[place] || 0) + 1;
    }
  }

  return json({ ok: true, people: [...people.values()], guests, total: people.size + guests, where });
}
