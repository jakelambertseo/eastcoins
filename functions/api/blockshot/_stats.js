/* Blockshot's stats, in D1 (2026-10-09, the owner: "build D1 stats and the leaderboard"). Two tables, made on first use:
     blockshot_stats   one row per Twitch account: lifetime kills, deaths, headshots, shots, hits, wins, rounds, best streak, seconds,
                       XP (level is derived, never stored), and the skin worn.
     blockshot_rounds  one row per account per round the match server reported, keyed (round_id, user_id) so a report sent twice counts
                       once; the weekly and daily boards come from here.
   The match server is the ONLY writer of results (round.js, proved by ARCADE_KEY); the page only ever reads, and saves its skin.
   Guests (and practice rounds against bots) are not here at all. XP and levels are the shared rules' (blockshot-rules.js). */
// the level maths, mirrored from blockshot-rules.js (need, levelOf): change one, change the other
const need = (lvl) => Math.round(100 * Math.pow(lvl, 1.5));
function levelOf(total) { let lvl = 1, xp = Math.max(0, Math.floor(total)); while (xp >= need(lvl)) { xp -= need(lvl); lvl++; } return { level: lvl, xp, next: need(lvl) }; }
import { chicagoDay } from "../casino/_pot.js";
import { ensureArmory, creditBrass, brassForResult } from "./_armory.js";

let ready = false;
export async function ensureBlockshot(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_stats (
      user_id TEXT PRIMARY KEY, login TEXT NOT NULL, display TEXT NOT NULL,
      kills INTEGER NOT NULL DEFAULT 0, deaths INTEGER NOT NULL DEFAULT 0, headshots INTEGER NOT NULL DEFAULT 0, shots INTEGER NOT NULL DEFAULT 0, hits INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0, rounds INTEGER NOT NULL DEFAULT 0, best_streak INTEGER NOT NULL DEFAULT 0, seconds INTEGER NOT NULL DEFAULT 0, xp INTEGER NOT NULL DEFAULT 0,
      skin TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_rounds (
      round_id TEXT NOT NULL, user_id TEXT NOT NULL, day TEXT NOT NULL, map TEXT NOT NULL,
      kills INTEGER NOT NULL, deaths INTEGER NOT NULL, headshots INTEGER NOT NULL, shots INTEGER NOT NULL, hits INTEGER NOT NULL,
      place INTEGER NOT NULL, won INTEGER NOT NULL, streak INTEGER NOT NULL, seconds INTEGER NOT NULL, xp INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (round_id, user_id))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_blockshot_rounds_day ON blockshot_rounds (day, user_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_blockshot_stats_kills ON blockshot_stats (kills DESC)`)
  ]);
  ready = true;
}

const n = (v, max = 1e6) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
/** One round's results, from the match server. Each player's row is inserted once; only a fresh insert touches the lifetime stats. */
export async function applyRound(db, roundId, map, results, now = Date.now()) {
  const day = chicagoDay(now); let applied = 0; await ensureArmory(db);
  for (const r of results.slice(0, 16)) {
    const id = String(r.id || ""), login = String(r.login || "").toLowerCase().slice(0, 40), display = String(r.name || login).slice(0, 40);
    if (!id || !login || id.startsWith("guest:")) continue;
    const row = { kills: n(r.kills, 500), deaths: n(r.deaths, 500), headshots: n(r.headshots, 500), shots: n(r.shots, 50000), hits: n(r.hits, 50000), place: n(r.place, 16), won: r.won ? 1 : 0, streak: n(r.streak, 500), seconds: n(r.seconds, 600), xp: n(r.xp, 5000) };
    const ins = await db.prepare(`INSERT OR IGNORE INTO blockshot_rounds (round_id, user_id, day, map, kills, deaths, headshots, shots, hits, place, won, streak, seconds, xp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(roundId, id, day, String(map).slice(0, 24), row.kills, row.deaths, row.headshots, row.shots, row.hits, row.place, row.won, row.streak, row.seconds, row.xp).run();
    if (!ins.meta?.changes) continue;
    await db.prepare(`INSERT INTO blockshot_stats (user_id, login, display, kills, deaths, headshots, shots, hits, wins, rounds, best_streak, seconds, xp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET login = excluded.login, display = excluded.display,
        kills = kills + excluded.kills, deaths = deaths + excluded.deaths, headshots = headshots + excluded.headshots, shots = shots + excluded.shots, hits = hits + excluded.hits,
        wins = wins + excluded.wins, rounds = rounds + 1, best_streak = MAX(best_streak, excluded.best_streak), seconds = seconds + excluded.seconds, xp = xp + excluded.xp, updated_at = CURRENT_TIMESTAMP`)
      .bind(id, login, display, row.kills, row.deaths, row.headshots, row.shots, row.hits, row.won, row.streak, row.seconds, row.xp).run();
    // Brass (2026-10-10): paid here, so it is exactly as idempotent as the stats; the first counted round of the day pays extra
    const today = await db.prepare(`SELECT COUNT(*) AS n FROM blockshot_rounds WHERE user_id = ? AND day = ?`).bind(id, day).first();
    await creditBrass(db, id, brassForResult({ kills: row.kills, headshots: row.headshots, won: row.won, mode: r.mode, roundsWon: r.roundsWon }, { first: (today?.n || 0) <= 1 }));
    applied++;
  }
  return applied;
}

export function shape(row) {
  if (!row) return null;
  const lv = levelOf(row.xp);
  return { login: row.login, name: row.display, kills: row.kills, deaths: row.deaths, headshots: row.headshots, shots: row.shots, hits: row.hits, wins: row.wins, rounds: row.rounds, bestStreak: row.best_streak, seconds: row.seconds,
    xp: lv.xp, totalXp: row.xp, level: lv.level, next: lv.next, kd: row.deaths ? Math.round((row.kills / row.deaths) * 100) / 100 : row.kills, accuracy: row.shots ? Math.round((row.hits / row.shots) * 100) : 0, skin: parseSkin(row.skin) };
}
const parseSkin = (s) => { try { const o = JSON.parse(s || "null"); return o && typeof o === "object" ? o : null; } catch { return null; } };
export async function profileFor(db, userId) { return shape(await db.prepare(`SELECT * FROM blockshot_stats WHERE user_id = ?`).bind(userId).first()); }
const SLOTS = ["body", "pattern", "visor", "gun"];
export function cleanSkin(s) { if (!s || typeof s !== "object") return null; const out = {}; for (const k of SLOTS) { const v = String(s[k] || "").replace(/[^a-z]/g, "").slice(0, 12); if (v) out[k] = v; } return out; }
export async function saveSkin(db, user, skin) {
  await db.prepare(`INSERT INTO blockshot_stats (user_id, login, display, skin) VALUES (?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET skin = excluded.skin, updated_at = CURRENT_TIMESTAMP`)
    .bind(user.id, user.login, user.displayName || user.login, JSON.stringify(skin)).run();
}

/** The board: all-time from the lifetime rows; this week / today from the round rows. `by` is one of BY. */
export const BY = { kills: "kills", kd: "kd", wins: "wins", headshots: "headshots", level: "xp", accuracy: "accuracy" };
export async function boardFor(db, by = "kills", range = "all", limit = 25, now = Date.now()) {
  const key = BY[by] || "kills";
  if (range === "all") {
    const rows = (await db.prepare(`SELECT * FROM blockshot_stats WHERE rounds > 0`).all()).results || [];
    const list = rows.map(shape);
    const val = (r) => key === "kd" ? r.kd : key === "xp" ? r.totalXp : key === "accuracy" ? (r.shots >= 50 ? r.accuracy : -1) : r[key];
    return list.sort((a, b) => val(b) - val(a) || b.kills - a.kills).slice(0, limit).map((r) => ({ login: r.login, name: r.name, level: r.level, kills: r.kills, deaths: r.deaths, kd: r.kd, wins: r.wins, headshots: r.headshots, accuracy: r.accuracy, rounds: r.rounds, value: val(r) }));
  }
  const since = chicagoDay(now - (range === "week" ? 6 : 0) * 86400000);
  const rows = (await db.prepare(`SELECT r.user_id, s.login, s.display, s.xp, SUM(r.kills) AS kills, SUM(r.deaths) AS deaths, SUM(r.headshots) AS headshots, SUM(r.shots) AS shots, SUM(r.hits) AS hits, SUM(r.won) AS wins, COUNT(*) AS rounds
    FROM blockshot_rounds r JOIN blockshot_stats s ON s.user_id = r.user_id WHERE r.day >= ? GROUP BY r.user_id`).bind(since).all()).results || [];
  const list = rows.map((r) => ({ login: r.login, name: r.display, level: levelOf(r.xp).level, kills: r.kills, deaths: r.deaths, kd: r.deaths ? Math.round((r.kills / r.deaths) * 100) / 100 : r.kills, wins: r.wins, headshots: r.headshots, accuracy: r.shots ? Math.round((r.hits / r.shots) * 100) : 0, shots: r.shots, rounds: r.rounds }));
  const val = (r) => key === "xp" ? r.level : key === "accuracy" ? (r.shots >= 50 ? r.accuracy : -1) : r[key];
  return list.sort((a, b) => val(b) - val(a) || b.kills - a.kills).slice(0, limit).map((r) => ({ ...r, value: val(r) }));
}
