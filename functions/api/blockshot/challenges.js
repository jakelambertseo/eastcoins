/* GET /api/blockshot/challenges — today's three challenges and the signed-in player's progress (2026-10-11). The three are drawn from
   the day (a hash of the Chicago date), the same for everyone; progress is summed from the day's reported rounds, so nothing is
   written by play. A challenge met is claimed here, once (blockshot_challenge_claims), and pays Brass into the Armory wallet. */
import { getSessionUser } from "../picks/_lib.js";
import { chicagoDay } from "../casino/_pot.js";
import { ensureArmory, creditBrass, brassOf } from "./_armory.js";
import { ensureBlockshot } from "./_stats.js";

const POOL = [
  { k: "kills", text: (n) => `Get ${n} kills`, n: [10, 20, 30], brass: [40, 60, 90], col: "kills" },
  { k: "headshots", text: (n) => `Land ${n} headshots`, n: [3, 6, 10], brass: [40, 60, 90], col: "headshots" },
  { k: "wins", text: (n) => `Win ${n} ${n === 1 ? "round" : "rounds"}`, n: [1, 2], brass: [60, 100], col: "won" },
  { k: "rounds", text: (n) => `Play ${n} rounds to the end`, n: [3, 5], brass: [40, 60], col: "rounds" },
  { k: "bombWon", text: (n) => `Win ${n} bomb rounds`, n: [3, 6], brass: [50, 90], col: "rounds_won" },
  { k: "streak", text: (n) => `Get a streak of ${n}`, n: [3, 5], brass: [40, 70], col: "streak", max: true }
];
const hash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
/** The day's three: the first is always kills, the other two drawn from the rest without repeats, each with a size from its list. */
export function challengesFor(day) {
  const h = hash(day), rest = POOL.slice(1), out = [];
  const pick = (c, r) => { const i = r % c.n.length; return { k: c.k, text: c.text(c.n[i]), target: c.n[i], brass: c.brass[i], col: c.col, max: Boolean(c.max) }; };
  out.push(pick(POOL[0], h & 3));
  const a = (h >>> 2) % rest.length; let b = (h >>> 7) % rest.length; if (b === a) b = (b + 1) % rest.length;
  out.push(pick(rest[a], h >>> 12)); out.push(pick(rest[b], h >>> 17));
  return out;
}
let ready = false;
async function ensure(db) { if (ready) return; await ensureArmory(db); await ensureBlockshot(db); await db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_challenge_claims (user_id TEXT NOT NULL, day TEXT NOT NULL, k TEXT NOT NULL, brass INTEGER NOT NULL, claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, day, k))`).run(); ready = true; }
export async function progressFor(db, userId, day, list) {
  const row = await db.prepare(`SELECT COALESCE(SUM(kills),0) AS kills, COALESCE(SUM(headshots),0) AS headshots, COALESCE(SUM(won),0) AS won, COUNT(*) AS rounds, COALESCE(SUM(rounds_won),0) AS rounds_won, COALESCE(MAX(streak),0) AS streak FROM blockshot_rounds WHERE user_id = ? AND day = ?`).bind(userId, day).first();
  const claims = new Set(((await db.prepare(`SELECT k FROM blockshot_challenge_claims WHERE user_id = ? AND day = ?`).bind(userId, day).all()).results || []).map((r) => r.k));
  let paid = 0;
  const out = [];
  for (const c of list) {
    const have = Math.min(c.target, Number(row?.[c.col] || 0)), done = have >= c.target; let claimed = claims.has(c.k);
    if (done && !claimed) { const ins = await db.prepare(`INSERT OR IGNORE INTO blockshot_challenge_claims (user_id, day, k, brass) VALUES (?, ?, ?, ?)`).bind(userId, day, c.k, c.brass).run(); if (ins.meta?.changes) { await creditBrass(db, userId, c.brass); paid += c.brass; claimed = true; } }
    out.push({ k: c.k, text: c.text, target: c.target, have, done, claimed, brass: c.brass });
  }
  return { list: out, paid };
}
const noStore = { "Cache-Control": "no-store" };
export async function onRequestGet(context) {
  const db = context.env.PICKS_DB; if (!db) return Response.json({ ok: false, code: "NO_DB" }, { status: 503, headers: noStore });
  const day = chicagoDay(Date.now()), list = challengesFor(day);
  const user = await getSessionUser(db, context.request);
  if (!user) return Response.json({ ok: true, day, list: list.map((c) => ({ ...c, have: 0, done: false, claimed: false })), me: null }, { headers: noStore });
  await ensure(db);
  const p = await progressFor(db, user.id, day, list);
  return Response.json({ ok: true, day, list: p.list, paid: p.paid, brass: await brassOf(db, user.id), me: user.login }, { headers: noStore });
}
