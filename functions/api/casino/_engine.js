/* ============================================================
   EastCoin Casino — the shared-round engine

   One machine for every game the whole room plays together: the
   Wheel, the Horse Race, and whatever comes next. It is the Coin
   Flip's design, made general:

     · rounds run on the wall clock — round n of a game opens at
       n × cycle, closes bets at n × cycle + betWindow, and ends
       at (n + 1) × cycle — so every viewer and every request
       agrees on the round without a timer having to stay awake
     · each round's outcome is fixed by a random seed created
       with the round row; sha256(seed) is shown while bets are
       open and the seed is revealed after, so nothing decided
       after the bets are in can move the result
     · the stake leaves the wallet at bet time through the same
       operations Picks uses, with an idempotency key per person
       per round, so a double click cannot charge twice and a
       retried settlement cannot pay twice
     · fixed house edge in the payout table; no strategy beats it

   Limits shared by every game: 20 ZC a bet, 10 bets an hour per
   game, one bet per person per round.
   ============================================================ */

import { moveBalance, beginOperation, finishOperation, newId } from "../picks/_lib.js";

export const MAX_BET = 20;
export const MIN_BET = 1;
export const MAX_BETS_PER_HOUR = 10;
export const ROOM_WINDOW_MS = 60 * 1000;

/* ---------------------------------------------------------- games */

// The wheel: 24 slices alternating red and black share 354 degrees, and
// one slim gold sliver takes the last 6. Red and black pay 2.05×; gold 60×.
// Red/black return just over the stake (2026-09-14, the players' side);
// gold is the 1-in-60 long shot and returns exactly the stake over time.
const GOLD_DEG = 6;
const WHEEL = (() => {
  const segments = [];
  const each = (360 - GOLD_DEG) / 24;
  let at = 0;
  for (let i = 0; i < 24; i += 1) { segments.push({ color: i % 2 === 0 ? "red" : "black", from: at, to: at + each }); at += each; }
  segments.push({ color: "gold", from: at, to: 360 });
  return segments;
})();

// Four runners with whole-number payouts. Their odds are the fair odds
// for those payouts scaled to sum to one, which leaves about a 4.5%
// edge on every horse: p = (1/pays) / 1.0476.
const RUNNERS = [
  { key: "gold", name: "Gold Rush", pays: 2, color: "#e8bf35" },
  { key: "burgundy", name: "Burgundy", pays: 3, color: "#8e1231" },
  { key: "midnight", name: "Midnight", pays: 7, color: "#8fc3d7" },
  { key: "longshot", name: "Longshot", pays: 14, color: "#4ddb8b" }
].map((r, _, all) => ({ ...r, p: (1 / r.pays) / all.reduce((n, x) => n + 1 / x.pays, 0) }));

// Nobody takes more than this out of the casino in any rolling hour.
// Past it, new bets and deals are refused until the hour rolls on.
// 400 since 2026-09-16 (750 before, 300 before that). It blocks NEW bets
// once someone is up this much in a rolling hour; it never trims a payout
// already won, so a single big win can still land above it.
export const HOUR_WIN_CAP = 400;

/* ------------------------------------------------------------- the edge

   Every play draws its own return between 96% and 104%, uniformly, from
   that play's seed. Nothing here is a fixed house edge and no game is a
   better bet than any other: the expected return everywhere is the mean
   of the band, 100%, and where a given play lands is decided by the same
   committed seed that decides the cards, the bombs and the angle.

   That is the point. A fixed rate per game — Coin Flip at 96%, Mines at
   104% — is an edge a player can find and farm, and one of them did:
   191 of the Mines boards ever played were one person's. A per-play draw
   cannot be shopped for, because the seed is sealed behind its hash
   before the stake is taken and only revealed once the play is over.

   Games that keep a `multiplier` column bake the drawn edge into it, so
   the number shown, the number recorded and the number paid are the same
   number. The rest apply it where the payout is computed. */
export const EDGE_MIN = 0.96;
export const EDGE_MAX = 1.04;

export async function edgeFor(seed) {
  const h = await sha256(`${seed}:edge`);
  const r = parseInt(h.slice(0, 8), 16) / 0x100000000;
  return Math.round((EDGE_MIN + r * (EDGE_MAX - EDGE_MIN)) * 10000) / 10000;
}

/** Adds a column that older rows predate. Safe to call on every request. */
export async function ensureColumn(db, table, column, decl) {
  await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`).run().catch(() => {});
}

/* EASTSCAPE'S TWO SHARED ROOMS (2026-09-19): classic roulette and the Fight Pit. They run on this engine like the Wheel
   (one round for the whole room, one bet a player a round, fair prices quoted and the play's own edge multiplied in at
   settle) and are `hidden`: they have no page or floor card on eastcoin.vip, only a window in EastScape.

   ROULETTE (key "roul": "roulette" is the PvP Russian Roulette table everywhere else in this codebase). A single-zero
   wheel, 37 pockets. ONE spot a spin (the owner's call): an even-money spot, a dozen, or one number. The FAIR prices:
   18 pockets in 37 is 37/18, a dozen 37/12, a number 37. n = floor(sha256(seed:roul) as a fraction x 37).

   THE FIGHT PIT (key "pit"). Two fighters from PIT_POOL. WHO IS FIGHTING is a pure function of the ROUND NUMBER, which
   is public, so the card and its prices can be shown before the bets close without touching the seed; WHO WINS is
   sha256(seed:pit) as a fraction against side a's chance, and the seed stays secret until the round closes. The chance
   comes from the fighters' levels (square roots, clamped 25-75%); each side's FAIR price is 1 / its chance. PIT_POOL and
   PIT_TITLES mirror FIGHTS.pool / MOBS levels / FIGHTS.titles in v3/assets/js/eastscape-shared.js so the game can draw the
   same two monsters: tools/dex-test.mjs fails if they drift. */
const ROUL_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROUL_SPOTS = {
  red: (n) => ROUL_RED.has(n), black: (n) => n > 0 && !ROUL_RED.has(n), odd: (n) => n > 0 && n % 2 === 1, even: (n) => n > 0 && n % 2 === 0,
  low: (n) => n >= 1 && n <= 18, high: (n) => n >= 19, d1: (n) => n >= 1 && n <= 12, d2: (n) => n >= 13 && n <= 24, d3: (n) => n >= 25
};
const ROUL_PICKS = [...Object.keys(ROUL_SPOTS), ...Array.from({ length: 37 }, (_, n) => `n${n}`)];
export const PIT_POOL = [["chicken", 1], ["cow", 2], ["rotten", 4], ["olive", 6], ["hornworm", 7], ["boar", 8], ["goat", 12], ["highwayman", 12], ["gnasher", 18], ["moth", 22], ["taxwraith", 28], ["ghoul", 30], ["chandelier", 34], ["understudy", 38], ["ram", 42], ["revenant", 45], ["angel", 48], ["goose", 55]];
export const PIT_TITLES = 12, PIT_MIN_P = 0.25, PIT_MAX_P = 0.75;
/** The card for a round: two different fighters, a title each, side a's chance, and both fair prices. From the round number alone. */
export async function pitCard(no) {
  const h = await sha256(`pit:card:${no}`), at = (i, mod) => parseInt(h.slice(i * 6, i * 6 + 6), 16) % mod;
  const a = at(0, PIT_POOL.length); let b = at(1, PIT_POOL.length - 1); if (b >= a) b += 1;
  const ta = at(2, PIT_TITLES); let tb = at(3, PIT_TITLES - 1); if (tb >= ta) tb += 1;
  const sa = Math.sqrt(PIT_POOL[a][1]), sb = Math.sqrt(PIT_POOL[b][1]), p = Math.max(PIT_MIN_P, Math.min(PIT_MAX_P, sa / (sa + sb)));
  return { no, f: [{ t: PIT_POOL[a][0], title: ta }, { t: PIT_POOL[b][0], title: tb }], p: [p, 1 - p], price: { a: 1 / p, b: 1 / (1 - p) } };
}

export const GAMES = {
  roul: {
    key: "roul", name: "Roulette", hidden: true,
    cycleMs: 60 * 1000, betMs: 40 * 1000,
    picks: ROUL_PICKS,
    payout: Object.fromEntries(ROUL_PICKS.map((k) => [k, ROUL_SPOTS[k] ? (k[0] === "d" ? 37 / 12 : 37 / 18) : 37])),
    async outcome(seed) {
      const h = await sha256(`${seed}:roul`);
      const n = Math.floor((parseInt(h.slice(0, 8), 16) / 0x100000000) * 37);
      return { n, color: n === 0 ? "green" : ROUL_RED.has(n) ? "red" : "black" };
    },
    wins: (pick, result) => (ROUL_SPOTS[pick] ? ROUL_SPOTS[pick](result.n) : pick === `n${result.n}`),
    describe: (result) => `${result.n} ${result.color}`
  },
  pit: {
    key: "pit", name: "The Fight Pit", hidden: true,
    cycleMs: 90 * 1000, betMs: 40 * 1000,
    picks: ["a", "b"],
    payout: { a: 2, b: 2 },   // (never used: priceFor below prices each round's card)
    cardFor: (no) => pitCard(no),
    async priceFor(pick, no) { return (await pitCard(no)).price[pick]; },
    async outcome(seed, no) {
      const h = await sha256(`${seed}:pit`), u = parseInt(h.slice(0, 8), 16) / 0x100000000, card = await pitCard(no);
      return { winner: u < card.p[0] ? "a" : "b", draw: u, t: card.f[u < card.p[0] ? 0 : 1].t };
    },
    wins: (pick, result) => pick === result.winner,
    describe: (result) => result.t
  },
  wheel: {
    key: "wheel",
    name: "Wheel",
    cycleMs: 60 * 1000,
    betMs: 40 * 1000,
    picks: ["red", "black", "gold"],
    // These are the FAIR prices: a colour is 12 of 24 slices across 354
    // degrees, so 360/177; gold is the 6-degree sliver, 1 in 60. The
    // play's own edge is multiplied in when it settles, so what a spin
    // actually pays lands between 96% and 104% of these.
    payout: { red: 360 / 177, black: 360 / 177, gold: 60 },
    segments: WHEEL,
    /** Where the pointer lands, in degrees from the top, from the seed alone. */
    async outcome(seed) {
      const h = await sha256(`${seed}:wheel`);
      const angle = (parseInt(h.slice(0, 8), 16) / 0x100000000) * 360;
      const idx = WHEEL.findIndex((s) => angle >= s.from && angle < s.to);
      const slice = idx === -1 ? WHEEL.length - 1 : idx;
      return { slice, color: WHEEL[slice].color, angle: Math.round(angle * 100) / 100 };
    },
    wins: (pick, result) => pick === result.color,
    describe: (result) => result.color
  },
  race: {
    key: "race",
    // In the stable while the animation and pacing get another look.
    paused: true,
    name: "Horse Race",
    cycleMs: 60 * 1000,
    betMs: 40 * 1000,
    picks: RUNNERS.map((r) => r.key),
    payout: Object.fromEntries(RUNNERS.map((r) => [r.key, r.pays])),
    runners: RUNNERS,
    /** The winner, from the seed: a uniform draw against the runners' odds. */
    async outcome(seed) {
      const h = await sha256(`${seed}:race`);
      const u = parseInt(h.slice(0, 8), 16) / 0x100000000;
      let acc = 0;
      for (const r of RUNNERS) { acc += r.p; if (u < acc) return { winner: r.key, draw: u }; }
      return { winner: RUNNERS[RUNNERS.length - 1].key, draw: u };
    },
    wins: (pick, result) => pick === result.winner,
    describe: (result) => RUNNERS.find((r) => r.key === result.winner)?.name || result.winner
  }
};

export function gameFor(key) {
  return GAMES[String(key || "").toLowerCase()] || null;
}

/* ---------------------------------------------------------- schema */

let schemaReady = false;
export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS casino_rounds (
      game TEXT NOT NULL,
      no INTEGER NOT NULL,
      seed TEXT NOT NULL,
      hash TEXT NOT NULL,
      result TEXT,
      settled_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (game, no)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS casino_bets (
      id TEXT PRIMARY KEY,
      game TEXT NOT NULL,
      round_no INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      pick TEXT NOT NULL,
      wager INTEGER NOT NULL CHECK (wager >= 1),
      status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','WON','LOST','FAILED')),
      payout INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (game, round_no, user_id)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_bets_round ON casino_bets (game, round_no)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_bets_user ON casino_bets (user_id, created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_casino_bets_created ON casino_bets (created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS casino_presence (
      game TEXT NOT NULL,
      user_id TEXT NOT NULL,
      seen_at INTEGER NOT NULL,
      PRIMARY KEY (game, user_id)
    )`)
  ]);
  schemaReady = true;
}

/* ---------------------------------------------------------- clock */

export function roundAt(game, now = Date.now()) {
  const no = Math.floor(now / game.cycleMs);
  const opensAt = no * game.cycleMs;
  const closesAt = opensAt + game.betMs;
  const endsAt = opensAt + game.cycleMs;
  return { no, opensAt, closesAt, endsAt, phase: now < closesAt ? "bets" : "result" };
}

/* ---------------------------------------------------------- fairness */

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomSeed() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function ensureRound(db, game, no) {
  const existing = await db.prepare(`SELECT * FROM casino_rounds WHERE game = ? AND no = ?`).bind(game.key, no).first();
  if (existing) return existing;
  const seed = randomSeed();
  const hash = await sha256(seed);
  await db.prepare(`INSERT OR IGNORE INTO casino_rounds (game, no, seed, hash) VALUES (?, ?, ?, ?)`).bind(game.key, no, seed, hash).run();
  return db.prepare(`SELECT * FROM casino_rounds WHERE game = ? AND no = ?`).bind(game.key, no).first();
}

const parseResult = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };

/* ---------------------------------------------------------- settlement */

/**
 * Settles one round once its bet window has closed. The UPDATE that
 * writes the result is the lock: only the caller that flips it from
 * NULL runs first, and payouts are idempotent per bet regardless, so
 * a crash mid-way is finished by the next caller rather than doubled.
 */
export async function settleRound(env, db, game, no, now = Date.now()) {
  const closesAt = no * game.cycleMs + game.betMs;
  if (now < closesAt) return null;

  const round = await ensureRound(db, game, no);
  let result = parseResult(round.result);
  if (!result) {
    result = await game.outcome(round.seed, no);   // (the round number: the Fight Pit's card is a function of it)
    const claimed = await db
      .prepare(`UPDATE casino_rounds SET result = ?, settled_at = CURRENT_TIMESTAMP WHERE game = ? AND no = ? AND result IS NULL`)
      .bind(JSON.stringify(result), game.key, no)
      .run();
    if (!claimed.meta?.changes) {
      const again = await db.prepare(`SELECT result FROM casino_rounds WHERE game = ? AND no = ?`).bind(game.key, no).first();
      result = parseResult(again?.result) || result;
    }
  }

  const bets = await db
    .prepare(
      `SELECT b.id, b.user_id, b.pick, b.wager, u.twitch_login AS login
         FROM casino_bets b JOIN users u ON u.twitch_id = b.user_id
        WHERE b.game = ? AND b.round_no = ? AND b.status = 'ACTIVE'`
    )
    .bind(game.key, no)
    .all();

  for (const b of bets.results || []) {
    if (!game.wins(b.pick, result)) {
      await db.prepare(`UPDATE casino_bets SET status = 'LOST', payout = 0 WHERE id = ? AND status = 'ACTIVE'`).bind(b.id).run();
      continue;
    }
    const edge = await edgeFor(round.seed);
    const price = game.priceFor ? await game.priceFor(b.pick, no) : game.payout[b.pick];
    const payout = Math.round(Number(b.wager) * Number(price || 0) * edge);
    const opId = newId("op");
    const begun = await beginOperation(db, {
      id: opId,
      idempotencyKey: `CASINO:PAY:${game.key}:${no}:${b.user_id}`,
      userId: b.user_id, marketId: null, pickId: null,
      type: "PAYOUT_CREDIT", amount: payout
    });
    if (!begun.ok) continue;
    const credit = await moveBalance(env, b.login, payout);
    if (!credit.ok) {
      await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
      console.error(`casino ${game.key}: payout failed for ${b.login} round ${no}: ${credit.error}`);
      continue;
    }
    await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
    await db.prepare(`UPDATE casino_bets SET status = 'WON', payout = ? WHERE id = ?`).bind(payout, b.id).run();
  }
  return result;
}

/* ---------------------------------------------------------- reads */

export async function betsFor(db, game, no) {
  const rows = await db
    .prepare(
      `SELECT b.pick, b.wager, b.status, b.payout, b.created_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM casino_bets b JOIN users u ON u.twitch_id = b.user_id
        WHERE b.game = ? AND b.round_no = ?
        ORDER BY b.created_at ASC`
    )
    .bind(game.key, no)
    .all();
  return (rows.results || []).map((r) => ({
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    pick: r.pick,
    wager: Number(r.wager),
    status: r.status,
    payout: Number(r.payout || 0),
    profit: r.status === "WON" ? Number(r.payout) - Number(r.wager) : r.status === "LOST" ? -Number(r.wager) : 0
  }));
}

export async function roomFor(db, game, now = Date.now()) {
  const rows = await db
    .prepare(
      `SELECT u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM casino_presence p JOIN users u ON u.twitch_id = p.user_id
        WHERE p.game = ? AND p.seen_at >= ?
        ORDER BY p.seen_at DESC LIMIT 60`
    )
    .bind(game.key, now - ROOM_WINDOW_MS)
    .all();
  return (rows.results || []).map((r) => ({
    id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(),
    displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "")
  }));
}

export async function betsLastHour(db, game, userId) {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM casino_bets WHERE game = ? AND user_id = ? AND created_at >= datetime('now', '-1 hour')`)
    .bind(game.key, userId)
    .first();
  return Number(row?.n || 0);
}

export async function touchPresence(db, game, userId, now = Date.now()) {
  await db
    .prepare(`INSERT INTO casino_presence (game, user_id, seen_at) VALUES (?, ?, ?) ON CONFLICT(game, user_id) DO UPDATE SET seen_at = excluded.seen_at`)
    .bind(game.key, userId, now)
    .run();
}

/** Public shape of a game's config, for the page. */
export function publicConfig(game, canBet) {
  return {
    key: game.key, name: game.name,
    maxBet: MAX_BET, minBet: MIN_BET, maxPerHour: MAX_BETS_PER_HOUR,
    betSeconds: game.betMs / 1000, cycleSeconds: game.cycleMs / 1000,
    picks: game.picks, payout: game.payout,
    segments: game.segments || undefined,
    runners: game.runners ? game.runners.map((r) => ({ key: r.key, name: r.name, pays: r.pays, p: Math.round(r.p * 1000) / 1000, color: r.color })) : undefined,
    hourCap: HOUR_WIN_CAP,
    paused: Boolean(game.paused), hidden: Boolean(game.hidden),
    canBet: canBet && !game.paused
  };
}

/* ---------------------------------------------------------- the hourly cap */

/** Net won or lost across every casino game in the last hour. */
export async function hourlyNet(db, userId) {
  const q = async (sql) => {
    try { const r = await db.prepare(sql).bind(userId).first(); return Number(r?.net || 0); } catch { return 0; }
  };
  const coin = await q(`SELECT COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net FROM coin_bets WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`);
  const shared = await q(`SELECT COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - wager WHEN status = 'LOST' THEN -wager ELSE 0 END), 0) AS net FROM casino_bets WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`);
  const hilo = await q(`SELECT COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake WHEN status = 'BUST' THEN -stake ELSE 0 END), 0) AS net FROM hilo_games WHERE user_id = ? AND updated_at >= datetime('now', '-1 hour')`);
  const mines = await q(`SELECT COALESCE(SUM(CASE WHEN status = 'CASHED' THEN payout - stake WHEN status = 'BUST' THEN -stake ELSE 0 END), 0) AS net FROM mines_games WHERE user_id = ? AND updated_at >= datetime('now', '-1 hour')`);
  const plinko = await q(`SELECT COALESCE(SUM(payout - stake), 0) AS net FROM plinko_drops WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`);
  // The PvP tables. A refund is neither a win nor a loss.
  const pvp = await q(`SELECT COALESCE(SUM(CASE WHEN status = 'WON' THEN payout - stake WHEN status = 'LOST' THEN -stake ELSE 0 END), 0) AS net FROM pvp_entries WHERE user_id = ? AND updated_at >= datetime('now', '-1 hour')`);
  const scratch = await q(`SELECT COALESCE(SUM(payout - stake), 0) AS net FROM scratch_cards WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`);
  // EastScape's own tables (2026-09-19): dice and slots. A slots jackpot is in `payout`, so it counts.
  const dice = await q(`SELECT COALESCE(SUM(payout - stake), 0) AS net FROM dice_rolls WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`);
  const slots = await q(`SELECT COALESCE(SUM(payout - stake), 0) AS net FROM slots_spins WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`);
  return coin + shared + hilo + mines + plinko + pvp + scratch + dice + slots;
}

/** Whether this person may place another bet, and where they stand. */
export async function capCheck(db, userId) {
  const net = await hourlyNet(db, userId);
  return { net, cap: HOUR_WIN_CAP, blocked: net >= HOUR_WIN_CAP };
}
