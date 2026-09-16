/* ============================================================
   EastCoin — the Game Room

   Small games played for titles, not ZCoins. Two kinds, and the
   difference decides everything about how each one is built:

   · A DAILY PUZZLE the server holds the answer to (Helmet Zoom).
     Everyone gets the same one, the server grades it, and a score
     means exactly what it says. One go a day, per person.

   · A SKILL RUN in the browser (Field Goal). The server picks the
     conditions and replays the player's inputs, so a score always
     matches the run that produced it — but a browser game can always
     be driven by something other than a person, which is why nothing
     here pays ZCoins. Bragging rights only, and that is the point.

   One table for every game's results, one for the day's seeds. A new
   game is a row in GAMES, an endpoint pair, and a page.
   ============================================================ */

import { sha256, randomSeed } from "../casino/_engine.js";
import { chicagoDay } from "../casino/_pot.js";

export const GAMES = {
  helmet: { key: "helmet", name: "Helmet Zoom", daily: true, route: "helmet", icon: "🪖", blurb: "One NFL crest, zoomed past recognition. Six guesses, and it pulls back with every wrong one." },
  simon: { key: "simon", name: "Simon", daily: false, route: "simon", icon: "🟩", blurb: "Four pads, a sequence that grows by one every round. Repeat it back until you can't." },
  fg: { key: "fg", name: "Field Goal", daily: false, route: "fg", icon: "🏈", blurb: "Power, then aim, into the wind. Every kick is five yards further; one miss ends the run." },
  centre: { key: "centre", name: "Dead Centre", daily: false, route: "centre", icon: "🎯", blurb: "Stop the bar in the middle, five times. Two hundred a go, and a quick sweep is worth more." },
  gold: { key: "gold", name: "The Gold Button", daily: true, route: null, icon: "🟡", blurb: "Once a day, at a moment nobody knows, it appears on every page for two minutes. First press takes the day." }
};

export { chicagoDay };

let ready = false;
export async function ensureGames(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS game_scores (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      user_id TEXT NOT NULL,
      day TEXT NOT NULL,
      score INTEGER NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_game_scores_board ON game_scores (game, day, score)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores (user_id, game, created_at)`),
    // One puzzle a day, its seed made on the first request and kept, so
    // the answer cannot be worked out from the date alone.
    db.prepare(`CREATE TABLE IF NOT EXISTS game_days (
      game TEXT NOT NULL,
      day TEXT NOT NULL,
      seed TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (game, day)
    )`)
  ]);
  // One row per person per game per day: this is what makes a daily
  // puzzle once and once only, and what keeps a skill game's best of
  // the day a single row to update. On its own and forgiving on
  // purpose — a table that somehow already held a duplicate would
  // otherwise take the whole Game Room down with it, and a missing
  // index is a much smaller problem than that.
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_game_scores_once ON game_scores (game, user_id, day)`).run().catch((error) => {
    console.error("games: couldn't add the one-a-day index", error?.message || error);
  });
  ready = true;
}

/** The day's seed for a game, made now if this is the first ask. */
export async function seedFor(db, game, day) {
  const row = await db.prepare(`SELECT seed FROM game_days WHERE game = ? AND day = ?`).bind(game, day).first();
  if (row) return String(row.seed);
  const seed = randomSeed();
  await db.prepare(`INSERT OR IGNORE INTO game_days (game, day, seed) VALUES (?, ?, ?)`).bind(game, day, seed).run();
  const back = await db.prepare(`SELECT seed FROM game_days WHERE game = ? AND day = ?`).bind(game, day).first();
  return String(back?.seed || seed);
}

/** A whole number from a seed and a label, 0..max-1. */
export async function pick(seed, label, max) {
  const h = await sha256(`${seed}:${label}`);
  return parseInt(h.slice(0, 12), 16) % max;
}
/** A fraction in [0, 1) from a seed and a label. */
export async function fraction(seed, label) {
  const h = await sha256(`${seed}:${label}`);
  return parseInt(h.slice(0, 13), 16) / 2 ** 52;
}

/** This person's result for a day, or null. */
export async function myScore(db, game, userId, day) {
  const row = await db.prepare(`SELECT * FROM game_scores WHERE game = ? AND user_id = ? AND day = ? LIMIT 1`).bind(game, userId, day).first();
  return row || null;
}

/**
 * Writes a result. A daily puzzle is once and once only — a second
 * write is refused rather than overwritten, so nobody can improve a
 * score by playing again. A skill run keeps the best of the day.
 */
export async function saveScore(db, { game, userId, day, score, detail, keepBest = false }) {
  const id = `gs_${crypto.randomUUID()}`;
  const body = JSON.stringify(detail || {});
  if (!keepBest) {
    try {
      await db.prepare(`INSERT INTO game_scores (id, game, user_id, day, score, detail) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, game, userId, day, score, body).run();
      return { ok: true, id };
    } catch { return { ok: false, code: "ALREADY_PLAYED" }; }
  }
  const existing = await myScore(db, game, userId, day);
  if (!existing) {
    await db.prepare(`INSERT INTO game_scores (id, game, user_id, day, score, detail) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, game, userId, day, score, body).run().catch(() => {});
    return { ok: true, id, best: true };
  }
  if (score > Number(existing.score)) {
    await db.prepare(`UPDATE game_scores SET score = ?, detail = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(score, body, existing.id).run();
    return { ok: true, id: existing.id, best: true };
  }
  return { ok: true, id: existing.id, best: false };
}

/** The day's board for one game, best first, earliest of a tie on top. */
export async function board(db, game, day, limit = 10) {
  const rows = await db
    .prepare(
      `SELECT s.score, s.detail, s.created_at, u.twitch_login, u.display_name, u.avatar_url
         FROM game_scores s JOIN users u ON u.twitch_id = s.user_id
        WHERE s.game = ? AND s.day = ?
        ORDER BY s.score DESC, datetime(s.created_at) ASC
        LIMIT ?`
    )
    .bind(game, day, limit)
    .all()
    .catch(() => ({ results: [] }));
  return (rows.results || []).map((r, i) => ({
    rank: i + 1,
    score: Number(r.score),
    detail: parse(r.detail),
    at: String(r.created_at).replace(" ", "T") + "Z",
    user: { login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") }
  }));
}

const parse = (t) => { try { return JSON.parse(t || "{}"); } catch { return {}; } };

/** Someone's record in a game: played, best, and their current streak of days. */
export async function recordFor(db, game, userId) {
  const rows = await db
    .prepare(`SELECT day, score FROM game_scores WHERE game = ? AND user_id = ? ORDER BY day DESC LIMIT 60`)
    .bind(game, userId)
    .all()
    .catch(() => ({ results: [] }));
  const list = rows.results || [];
  const best = list.reduce((n, r) => Math.max(n, Number(r.score)), 0);
  // Days in a row ending today or yesterday; a gap ends it.
  const days = new Set(list.map((r) => String(r.day)));
  let streak = 0;
  const today = chicagoDay(Date.now());
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  if (days.has(cursor)) {
    while (days.has(cursor)) { streak += 1; cursor = shiftDay(cursor, -1); }
  }
  return { played: list.length, best, streak };
}

/** A Chicago day string moved by n days. */
export function shiftDay(day, n) {
  const [y, m, d] = String(day).split("-").map(Number);
  const t = Date.UTC(y, m - 1, d, 12) + n * 86400000;
  const x = new Date(t);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

/** Wins in the last 30 days per person, for the Game Room's titles. */
export async function champions(db, day) {
  const from = shiftDay(day, -29);
  const rows = await db
    .prepare(
      `SELECT s.game, s.day, s.score, u.twitch_login, u.display_name, u.avatar_url
         FROM game_scores s JOIN users u ON u.twitch_id = s.user_id
        WHERE s.day >= ? ORDER BY s.game, s.day, s.score DESC, datetime(s.created_at) ASC`
    )
    .bind(from)
    .all()
    .catch(() => ({ results: [] }));
  const takenBy = new Map();      // game:day -> the row that won it
  for (const r of rows.results || []) {
    const key = `${r.game}:${r.day}`;
    if (!takenBy.has(key)) takenBy.set(key, r);
  }
  const wins = new Map();
  for (const r of takenBy.values()) {
    const login = String(r.twitch_login).toLowerCase();
    const e = wins.get(login) || { user: { login, displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") }, wins: 0 };
    e.wins += 1;
    wins.set(login, e);
  }
  return [...wins.values()].sort((a, b) => b.wins - a.wins).slice(0, 5);
}
