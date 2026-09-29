/* SLOTS (2026-09-19) — an EastScape-only table: endpoints here so it plays
   for real ZCoins under the casino's rules; no page or floor card on
   eastcoin.vip.

   Three reels, each drawn on its own from REELS' weights (of 80) by
   sha256(seed:reel:i). Three of a kind pays that symbol's price; exactly
   two cherries pays a little; THREE SEVENS PAYS THE JACKPOT.

   THE SHAPE, then the return. `pay` below is the SHAPE of the table (how
   the prizes compare), not what is paid. Like Plinko's board and the
   Scratch-Off's prizes, the row is divided through by what it returns on
   its own (TABLE_RETURN) so the quoted prices return exactly
   1 - JACKPOT.slice, and the play's own edge (edgeFor, 96-104%, mean 1)
   multiplies in when it pays. The slice is what feeds the pot, and the pot
   is paid out in full sooner or later, so slots return 100% overall like
   everything else on the floor. The shape favours frequent wins: about one
   spin in three pays, and the biggest regular prize is x61 (1 in 8,000).

   THE JACKPOT (the owner, 2026-09-19: "keep jackpot with ceiling"). Every
   spin puts JACKPOT.slice of its stake in one pot everybody shares. Three
   sevens (1 in 64,000) wins it: a 20 ZC spin wins all of it, a smaller
   spin a share in proportion, and the rest stays. The pot never shows more
   than JACKPOT.ceiling: what is fed in above that waits in `reserve` and
   starts the next pot, so nothing fed in is ever lost. After a win the pot
   restarts at JACKPOT.seed plus the reserve; the seed is the only house
   money in it (50 ZC per hit, about once in 64,000 spins). Amounts are kept
   in hundredths of a ZCoin so a 1 ZC spin's 0.02 is not rounded away.

   Fairness is Plinko's commit-per-play: the hash of the seed for your NEXT
   spin is shown before you bet. The pot's size is not in the seed, and
   cannot be: it is whatever the room has fed it. */

import { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256, edgeFor } from "../_engine.js";

export const REELS = [
  { k: "cherry", w: 30, pay: 4 }, { k: "lemon", w: 22, pay: 6 }, { k: "bell", w: 14, pay: 12 },
  { k: "star", w: 8, pay: 25 }, { k: "diamond", w: 4, pay: 50 }, { k: "seven", w: 2, pay: 0 }   // three sevens: the jackpot, not a price
];
export const TWO_CHERRIES = 1.4;
export const JACKPOT = { slice: 0.02, seed: 50, ceiling: 500 };
const TOTAL = REELS.reduce((n, r) => n + r.w, 0);
const p = (k) => REELS.find((r) => r.k === k).w / TOTAL;

/** What the shape returns on its own, per 1 staked: the divisor. */
export const TABLE_RETURN = REELS.reduce((n, r) => n + p(r.k) ** 3 * r.pay, 0) + 3 * p("cherry") ** 2 * (1 - p("cherry")) * TWO_CHERRIES;
const SCALE = (1 - JACKPOT.slice) / TABLE_RETURN;

/** The quoted price of a line (per 1 staked), before the play's edge. */
export const priceFor = (line) => (line.jackpot ? 0 : line.key === "two-cherries" ? TWO_CHERRIES * SCALE : line.key === "none" ? 0 : REELS.find((r) => r.k === line.key).pay * SCALE);

/** The pay table as the page should print it: prices and chances, straight from the numbers above. */
export function payTable() {
  const round = (x) => Math.round(x * 100) / 100;
  return [
    ...REELS.filter((r) => r.pay).map((r) => ({ key: r.k, three: true, multiplier: round(r.pay * SCALE), chance: p(r.k) ** 3 })).reverse(),
    { key: "two-cherries", three: false, multiplier: round(TWO_CHERRIES * SCALE), chance: 3 * p("cherry") ** 2 * (1 - p("cherry")) },
    { key: "seven", three: true, jackpot: true, multiplier: null, chance: p("seven") ** 3 }
  ];
}

let ready = false;
export async function ensureSlots(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS slots_spins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      stake INTEGER NOT NULL CHECK (stake >= 1),
      reels TEXT NOT NULL,
      line TEXT NOT NULL,
      multiplier REAL NOT NULL,
      payout INTEGER NOT NULL DEFAULT 0,
      jackpot INTEGER NOT NULL DEFAULT 0,
      edge REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_slots_user ON slots_spins (user_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_slots_recent ON slots_spins (created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS slots_commits (
      user_id TEXT PRIMARY KEY,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    // one row: the pot and what is waiting behind it, in hundredths of a ZCoin
    db.prepare(`CREATE TABLE IF NOT EXISTS slots_pot (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      centi INTEGER NOT NULL,
      reserve INTEGER NOT NULL DEFAULT 0,
      last_login TEXT, last_amount INTEGER, last_at TEXT
    )`),
    db.prepare(`INSERT OR IGNORE INTO slots_pot (id, centi, reserve) VALUES (1, ${JACKPOT.seed * 100}, 0)`)
  ]);
  ready = true;
}

export async function commitFor(db, userId) {
  const existing = await db.prepare(`SELECT * FROM slots_commits WHERE user_id = ?`).bind(userId).first();
  if (existing) return existing;
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db.prepare(`INSERT INTO slots_commits (user_id, seed, hash) VALUES (?, ?, ?) ON CONFLICT(user_id) DO NOTHING`).bind(userId, seed, hash).run();
  return db.prepare(`SELECT * FROM slots_commits WHERE user_id = ?`).bind(userId).first();
}

export async function rotateCommit(db, userId) {
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db
    .prepare(`INSERT INTO slots_commits (user_id, seed, hash, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(user_id) DO UPDATE SET seed = excluded.seed, hash = excluded.hash, created_at = CURRENT_TIMESTAMP`)
    .bind(userId, seed, hash)
    .run();
  return { seed, hash };
}

/** The three symbols, from the seed alone. */
export async function reelsFor(seed) {
  const out = [];
  for (let i = 0; i < 3; i += 1) {
    const h = await sha256(`${seed}:reel:${i}`);
    let r = Math.floor((parseInt(h.slice(0, 8), 16) / 0x100000000) * TOTAL);
    let sym = REELS[REELS.length - 1].k;
    for (const reel of REELS) { if (r < reel.w) { sym = reel.k; break; } r -= reel.w; }
    out.push(sym);
  }
  return out;
}

/** What a set of reels is: { key, jackpot }. */
export function lineFor(reels) {
  if (reels[0] === reels[1] && reels[1] === reels[2]) return reels[0] === "seven" ? { key: "seven", jackpot: true } : { key: reels[0], jackpot: false };
  return reels.filter((r) => r === "cherry").length === 2 ? { key: "two-cherries", jackpot: false } : { key: "none", jackpot: false };
}

/** Every spin feeds the pot; above the ceiling it feeds the reserve instead. One statement, so two spins at once both count. */
export async function feedPot(db, stake) {
  const add = Math.round(stake * 100 * JACKPOT.slice), cap = JACKPOT.ceiling * 100;
  await db
    .prepare(`UPDATE slots_pot SET reserve = reserve + MAX(0, centi + ? - ?), centi = MIN(?, centi + ?) WHERE id = 1`)
    .bind(add, cap, cap, add)
    .run();
}

/**
 * Three sevens: take this spin's share of the pot, in whole ZCoins. The UPDATE only lands if the pot still holds what
 * was read, so two jackpots in the same instant cannot both take the same coins: the second reads again.
 */
export async function takeJackpot(db, stake) {
  for (let i = 0; i < 4; i += 1) {
    const pot = await db.prepare(`SELECT centi, reserve FROM slots_pot WHERE id = 1`).first();
    const have = Number(pot?.centi || 0), win = Math.floor((have / 100) * Math.min(1, stake / MAX_BET));
    if (win < 1) return 0;
    const left = have - win * 100, restart = left < JACKPOT.seed * 100;   // all but emptied: a new pot starts from the seed and whatever was waiting
    const put = await db
      .prepare(`UPDATE slots_pot SET centi = ?, reserve = ? WHERE id = 1 AND centi = ?`)
      .bind(restart ? JACKPOT.seed * 100 + Number(pot.reserve || 0) : left, restart ? 0 : Number(pot.reserve || 0), have)
      .run();
    if (put.meta?.changes === 1) return win;
  }
  return 0;
}

export async function noteJackpot(db, login, amount) {
  await db.prepare(`UPDATE slots_pot SET last_login = ?, last_amount = ?, last_at = CURRENT_TIMESTAMP WHERE id = 1`).bind(String(login), amount).run();
}

/** The pot as the page shows it, in whole ZCoins. */
export async function potNow(db) {
  const pot = await db.prepare(`SELECT centi, last_login, last_amount, last_at FROM slots_pot WHERE id = 1`).first();
  return { amount: Math.floor(Number(pot?.centi || 0) / 100), ceiling: JACKPOT.ceiling, last: pot?.last_login ? { login: pot.last_login, amount: Number(pot.last_amount || 0), at: String(pot.last_at).replace(" ", "T") + "Z" } : null };
}

export function publicSpin(d) {
  return {
    id: d.id, stake: Number(d.stake), reels: String(d.reels).split(","), line: d.line, jackpot: Number(d.jackpot || 0),
    multiplier: Number(d.multiplier), payout: Number(d.payout || 0), profit: Number(d.payout || 0) - Number(d.stake),
    hash: d.hash, seed: d.seed, at: String(d.created_at).replace(" ", "T") + "Z"
  };
}

export async function spinsLastHour(db, userId) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM slots_spins WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(row?.n || 0);
}

export { MAX_BET, MIN_BET, MAX_BETS_PER_HOUR, randomSeed, sha256, edgeFor };
