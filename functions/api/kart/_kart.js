/* EastKart's times — one row per person per track, the best lap and the best race.

   Titles only: nothing here moves a ZCoin. The lap carries its sector
   splits (eleven cumulative times, so a page can show "+0.42 vs WR" at
   every sector) and the trail of the lap (a position every 50 ms, so
   the record holder's ghost can run beside anyone in a time trial).
   `kart_records` is a log of record laps for the activity feed. */

export const TRACKS = { lot: "The Lot Loop", docks: "Docks Circuit", roofs: "Rooftop Run" };
export const SECTORS = 12;
const MIN_LAP_MS = 7000, MAX_LAP_MS = 600000, MAX_TRAIL = 1500;

let ready = false;
export async function ensureKart(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS kart_times (
      user_id TEXT NOT NULL,
      track TEXT NOT NULL,
      lap_ms INTEGER NOT NULL,
      total_ms INTEGER,
      splits TEXT,
      trail TEXT,
      lap_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      total_at TEXT,
      PRIMARY KEY (user_id, track)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_kart_times_lap ON kart_times (track, lap_ms)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS kart_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      track TEXT NOT NULL,
      lap_ms INTEGER NOT NULL,
      set_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  ]);
  ready = true;
}

const person = (r) => ({ login: String(r.twitch_login || "").toLowerCase(), name: String(r.display_name || r.twitch_login || ""), avatar: String(r.avatar_url || "") });

/** The board for one track: the record (with its splits, and its trail when asked), the top ten laps, the viewer's row. */
export async function boardFor(db, track, viewerId, withTrail = false) {
  const top = await db.prepare(
    `SELECT t.user_id, t.lap_ms, t.total_ms, t.splits, ${withTrail ? "t.trail," : ""} t.lap_at, u.twitch_login, u.display_name, u.avatar_url
       FROM kart_times t JOIN users u ON u.twitch_id = t.user_id
      WHERE t.track = ? ORDER BY t.lap_ms ASC, t.lap_at ASC LIMIT 10`
  ).bind(track).all().then((r) => r.results || []);
  const rows = top.map((r) => ({ ...person(r), lapMs: Number(r.lap_ms), totalMs: r.total_ms == null ? null : Number(r.total_ms), at: r.lap_at }));
  let wr = null;
  if (top[0]) {
    const r = top[0];
    wr = { ...rows[0], splits: safeJson(r.splits) || null };
    if (withTrail) wr.trail = safeJson(r.trail) || null;
  }
  let me = null;
  if (viewerId) {
    const mine = await db.prepare(`SELECT lap_ms, total_ms FROM kart_times WHERE user_id = ? AND track = ?`).bind(viewerId, track).first();
    if (mine) {
      const ahead = await db.prepare(`SELECT COUNT(*) AS n FROM kart_times WHERE track = ? AND lap_ms < ?`).bind(track, mine.lap_ms).first();
      me = { lapMs: Number(mine.lap_ms), totalMs: mine.total_ms == null ? null : Number(mine.total_ms), rank: Number(ahead?.n || 0) + 1 };
    }
  }
  return { wr, top: rows, me };
}

/** A lap (and maybe a race) handed in. Returns what changed. */
export async function recordLap(db, user, { track, lapMs, totalMs, splits, trail }) {
  if (!TRACKS[track]) return { ok: false, code: "BAD_TRACK" };
  lapMs = Math.round(Number(lapMs));
  if (!Number.isFinite(lapMs) || lapMs < MIN_LAP_MS || lapMs > MAX_LAP_MS) return { ok: false, code: "BAD_LAP" };
  totalMs = totalMs == null ? null : Math.round(Number(totalMs));
  if (totalMs != null && (!Number.isFinite(totalMs) || totalMs < lapMs * 2 || totalMs > MAX_LAP_MS * 3)) totalMs = null;
  // the splits: eleven cumulative sector times, rising, all inside the lap
  let splitsJson = null;
  if (Array.isArray(splits) && splits.length === SECTORS - 1) {
    const s = splits.map((x) => Math.round(Number(x)));
    if (s.every((x, i) => Number.isFinite(x) && x > 0 && x < lapMs && (i === 0 || x > s[i - 1]))) splitsJson = JSON.stringify(s);
  }
  // the trail: [x, z, yaw] every 50 ms — the count has to agree with the lap, give or take
  let trailJson = null;
  if (Array.isArray(trail) && trail.length >= 20 && trail.length <= MAX_TRAIL) {
    const want = lapMs / 50;
    if (trail.length > want * 0.6 && trail.length < want * 1.4 && trail.every((p) => Array.isArray(p) && p.length === 3 && p.every((n) => Number.isFinite(Number(n))))) {
      trailJson = JSON.stringify(trail.map((p) => [+Number(p[0]).toFixed(2), +Number(p[1]).toFixed(2), +Number(p[2]).toFixed(3)]));
    }
  }
  const before = await db.prepare(`SELECT lap_ms, total_ms FROM kart_times WHERE user_id = ? AND track = ?`).bind(user.id, track).first();
  const prevWr = await db.prepare(`SELECT user_id, lap_ms FROM kart_times WHERE track = ? ORDER BY lap_ms ASC, lap_at ASC LIMIT 1`).bind(track).first();
  const lapBetter = !before || lapMs < Number(before.lap_ms);
  const totalBetter = totalMs != null && (!before || before.total_ms == null || totalMs < Number(before.total_ms));
  if (!before) {
    await db.prepare(`INSERT INTO kart_times (user_id, track, lap_ms, total_ms, splits, trail, total_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(user.id, track, lapMs, totalMs, splitsJson, trailJson, totalMs != null ? new Date().toISOString().replace("T", " ").slice(0, 19) : null).run();
  } else {
    if (lapBetter) await db.prepare(`UPDATE kart_times SET lap_ms = ?, splits = COALESCE(?, splits), trail = COALESCE(?, trail), lap_at = CURRENT_TIMESTAMP WHERE user_id = ? AND track = ?`).bind(lapMs, splitsJson, trailJson, user.id, track).run();
    if (totalBetter) await db.prepare(`UPDATE kart_times SET total_ms = ?, total_at = CURRENT_TIMESTAMP WHERE user_id = ? AND track = ?`).bind(totalMs, user.id, track).run();
  }
  const isWr = lapBetter && (!prevWr || lapMs < Number(prevWr.lap_ms));
  if (isWr) await db.prepare(`INSERT INTO kart_records (user_id, track, lap_ms) VALUES (?, ?, ?)`).bind(user.id, track, lapMs).run();
  return { ok: true, lapBetter, totalBetter, wr: isWr, tookFrom: isWr && prevWr && prevWr.user_id !== user.id ? prevWr.user_id : null };
}

/** The last few record laps, for the activity feed. */
export async function recentRecords(db, limit = 8) {
  const rows = await db.prepare(
    `SELECT r.track, r.lap_ms, r.set_at, u.twitch_login, u.display_name, u.avatar_url
       FROM kart_records r JOIN users u ON u.twitch_id = r.user_id
      ORDER BY r.id DESC LIMIT ?`
  ).bind(limit).all().then((r) => r.results || []);
  return rows.map((r) => ({ type: "kart", at: String(r.set_at).replace(" ", "T") + "Z", who: person(r), track: r.track, trackName: TRACKS[r.track] || r.track, lapMs: Number(r.lap_ms) }));
}

function safeJson(s) { if (!s) return null; try { return JSON.parse(s); } catch { return null; } }
