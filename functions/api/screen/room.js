/* ============================================================
   EastCoin — Watch rooms for Movies & TV

   One person hosts; everyone else follows their clock. The player
   (vidy.st) only REPORTS its position — nothing can press play on
   someone else's embed — so a guest is kept in step by reloading the
   embed at the host's position when they drift, and by loading it
   paused at the host's position when the host pauses. Close enough
   for a movie; not frame-locked.

     GET  /api/screen/room?list=1          live rooms, for the shelf
     GET  /api/screen/room?room=ID         the room's clock and who is in it
     POST /api/screen/room  { action: "create", item }         host opens one
     POST /api/screen/room  { action: "beat", room, position, playing, item? }
                                                                host's clock, every ~5 s
     POST /api/screen/room  { action: "end", room }            host closes it

   Who is in a room comes from site_presence: every tab in it beats
   with ref "room:<id>", the same way a watch tab carries an event.
   A room whose host has not beaten in two minutes is stale, and one
   nobody has touched in six hours is gone.

   Cost: the host writes every 5 s (720 rows an hour); each guest
   reads every 5 s — ten guests are ~7,000 reads an hour. Fine on
   Workers Paid; keep an eye on it if rooms get big.
   ============================================================ */

import { getSessionUser, json, fail } from "../picks/_lib.js";
import { requireLogin } from "./_gate.js";

const STALE_MS = 2 * 60 * 1000;
const DEAD_MS = 6 * 60 * 60 * 1000;
const MEMBER_MS = 90 * 1000;

let ready = false;
async function ensureRooms(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS watch_rooms (
      id TEXT PRIMARY KEY,
      host_id TEXT NOT NULL,
      type TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      title TEXT,
      poster TEXT,
      year TEXT,
      season INTEGER,
      episode INTEGER,
      position REAL NOT NULL DEFAULT 0,
      playing INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      ended_at INTEGER
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_watch_rooms_live ON watch_rooms (ended_at, updated_at)`)
  ]);
  ready = true;
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function roomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

const cleanItem = (raw) => {
  const type = String(raw?.type || "").toLowerCase() === "tv" ? "tv" : "movie";
  const id = Number(raw?.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return {
    type, id,
    title: String(raw?.title || "").replace(/[<>]/g, "").slice(0, 160),
    poster: String(raw?.poster || "").slice(0, 300),
    year: String(raw?.year || "").slice(0, 8),
    season: type === "tv" ? Math.max(1, Number(raw?.season) || 1) : null,
    episode: type === "tv" ? Math.max(1, Number(raw?.episode) || 1) : null
  };
};

async function members(db, id) {
  const since = Date.now() - MEMBER_MS;
  const rows = await db
    .prepare(
      `SELECT p.user_id, p.seen_at, u.twitch_login, u.display_name, u.avatar_url
         FROM site_presence p LEFT JOIN users u ON u.twitch_id = p.user_id
        WHERE p.ref = ? AND p.seen_at >= ?`
    )
    .bind(`room:${id}`, since)
    .all()
    .catch(() => ({ results: [] }));
  const people = new Map();
  let guests = 0;
  for (const r of rows.results || []) {
    if (r.user_id && r.twitch_login) {
      if (!people.has(r.user_id)) people.set(r.user_id, { id: String(r.user_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") });
    } else guests += 1;
  }
  return { people: [...people.values()], guests, total: people.size + guests };
}

async function hostOf(db, hostId) {
  const u = await db.prepare(`SELECT twitch_login, display_name, avatar_url FROM users WHERE twitch_id = ?`).bind(hostId).first().catch(() => null);
  return u ? { id: String(hostId), login: String(u.twitch_login).toLowerCase(), displayName: String(u.display_name || u.twitch_login), avatar: String(u.avatar_url || "") } : { id: String(hostId), login: "", displayName: "the host", avatar: "" };
}

function publicRoom(r, now) {
  const stale = now - Number(r.updated_at) > STALE_MS;
  return {
    id: r.id,
    item: { type: r.type, id: Number(r.tmdb_id), title: r.title || "", poster: r.poster || "", year: r.year || "", season: r.season == null ? null : Number(r.season), episode: r.episode == null ? null : Number(r.episode) },
    position: Number(r.position || 0),
    playing: Boolean(r.playing) && !stale,
    updatedAt: Number(r.updated_at),
    createdAt: Number(r.created_at),
    ended: Boolean(r.ended_at),
    stale
  };
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Rooms are offline.", 503);
  const gate = await requireLogin(context);
  if (gate.denied) return gate.denied;
  await ensureRooms(db);
  const now = Date.now();
  const url = new URL(context.request.url);

  if (url.searchParams.get("list") === "1") {
    const rows = await db
      .prepare(`SELECT * FROM watch_rooms WHERE ended_at IS NULL AND updated_at >= ? ORDER BY updated_at DESC LIMIT 12`)
      .bind(now - STALE_MS)
      .all()
      .catch(() => ({ results: [] }));
    const rooms = [];
    for (const r of rows.results || []) {
      const [host, who] = await Promise.all([hostOf(db, r.host_id), members(db, r.id)]);
      rooms.push({ ...publicRoom(r, now), host, watching: who.total, people: who.people.slice(0, 6) });
    }
    return json({ ok: true, now, rooms });
  }

  const id = String(url.searchParams.get("room") || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  if (!id) return fail("BAD_ROOM", "Which room?");
  const r = await db.prepare(`SELECT * FROM watch_rooms WHERE id = ?`).bind(id).first();
  if (!r) return fail("NO_ROOM", "That room doesn't exist any more.", 404);
  const user = await getSessionUser(db, context.request);
  const [host, who] = await Promise.all([hostOf(db, r.host_id), members(db, id)]);
  return json({
    ok: true, now,
    room: { ...publicRoom(r, now), host, isHost: Boolean(user && String(user.id) === String(r.host_id)), watching: who.total, people: who.people, guests: who.guests }
  });
}

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Rooms are offline.", 503);
  await ensureRooms(db);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to host a room.", 401);
  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const action = String(body.action || "");
  const now = Date.now();

  if (action === "create") {
    const item = cleanItem(body.item);
    if (!item) return fail("BAD_ITEM", "Nothing is playing to share.");
    // One live room per host: opening another closes the old one.
    await db.prepare(`UPDATE watch_rooms SET ended_at = ? WHERE host_id = ? AND ended_at IS NULL`).bind(now, user.id).run().catch(() => {});
    // Sweep rooms nobody has touched in hours.
    await db.prepare(`DELETE FROM watch_rooms WHERE updated_at < ?`).bind(now - DEAD_MS).run().catch(() => {});
    const id = roomId();
    const position = Math.max(0, Number(body.position) || 0);
    await db
      .prepare(`INSERT INTO watch_rooms (id, host_id, type, tmdb_id, title, poster, year, season, episode, position, playing, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(id, user.id, item.type, item.id, item.title, item.poster, item.year, item.season, item.episode, position, now, now)
      .run();
    const r = await db.prepare(`SELECT * FROM watch_rooms WHERE id = ?`).bind(id).first();
    return json({ ok: true, now, room: { ...publicRoom(r, now), host: await hostOf(db, user.id), isHost: true, watching: 1, people: [], guests: 0 } });
  }

  const id = String(body.room || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  if (!id) return fail("BAD_ROOM", "Which room?");
  const r = await db.prepare(`SELECT * FROM watch_rooms WHERE id = ?`).bind(id).first();
  if (!r) return fail("NO_ROOM", "That room doesn't exist any more.", 404);
  if (String(r.host_id) !== String(user.id)) return fail("NOT_HOST", "Only the host runs the room.", 403);
  if (r.ended_at) return fail("ENDED", "That room has ended.", 409);

  if (action === "beat") {
    const position = Math.max(0, Number(body.position) || 0);
    const playing = body.playing ? 1 : 0;
    const item = body.item ? cleanItem(body.item) : null;
    if (item) {
      await db
        .prepare(`UPDATE watch_rooms SET position = ?, playing = ?, type = ?, tmdb_id = ?, title = ?, poster = ?, year = ?, season = ?, episode = ?, updated_at = ? WHERE id = ?`)
        .bind(position, playing, item.type, item.id, item.title, item.poster, item.year, item.season, item.episode, now, id)
        .run();
    } else {
      await db.prepare(`UPDATE watch_rooms SET position = ?, playing = ?, updated_at = ? WHERE id = ?`).bind(position, playing, now, id).run();
    }
    return json({ ok: true, now });
  }

  if (action === "end") {
    await db.prepare(`UPDATE watch_rooms SET ended_at = ?, playing = 0 WHERE id = ?`).bind(now, id).run();
    return json({ ok: true, now });
  }

  return fail("BAD_ACTION", "action must be create, beat or end.");
}
