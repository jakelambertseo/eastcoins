/* GET /api/casino/verify?game=<key>&seed=<seed>[&hash=<hex>][&mines=3][&players=4]

   Replays a result from its seed with the same functions the games use,
   so anyone holding a revealed seed can see what it produced: the deck
   Higher or Lower dealt, where Mines put the bombs, Plinko's path, the
   Wheel's angle, the coin, or a PvP table's rounds. Pure maths on the
   query string — no session, no database — and the seed's hash comes
   back too, so it can be held against the one shown before play.

   Games: hilo, mines, plinko, scratch, wheel, race, flip, roulette, standing. */

import { json, fail } from "../picks/_lib.js";
import { sha256, edgeFor, EDGE_MIN, EDGE_MAX, GAMES as SHARED } from "./_engine.js";
import { cardAt, oddsFrom, RANKS, SUITS, MAX_STEPS } from "./hilo/_hilo.js";
import { bombsFor, ladderFor, MIN_MINES, MAX_MINES, DEFAULT_MINES, TILES } from "./mines/_mines.js";
import { pathFor, bucketOf, multiplierFor, ROWS, TABLE_RETURN as PLINKO_RETURN } from "./plinko/_plinko.js";
import { resultOf } from "../coin/_coin.js";
import { GAMES as PVP, outcomeFor, chambersFor, MIN_PLAYERS, MAX_PLAYERS } from "./pvp/_pvp.js";
import { triggerFor, drawFor, TRIGGER_MIN, TRIGGER_MAX } from "./_pot.js";
import { outcomeFor as scratchOutcome, gridFor as scratchGrid, PRIZES as SCRATCH_PRIZES, RETURN as SCRATCH_RETURN } from "./scratch/_scratch.js";

const clampInt = (v, lo, hi, dflt) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

export async function onRequestGet({ request }) {
  const q = new URL(request.url).searchParams;
  const game = String(q.get("game") || "").toLowerCase().trim();
  const seed = String(q.get("seed") || "").trim();
  const claimed = String(q.get("hash") || "").trim().toLowerCase();

  if (!seed) return fail("NO_SEED", "Paste the seed that was revealed after the round.");
  if (seed.length > 200) return fail("BAD_SEED", "That doesn't look like a seed.");

  const hash = await sha256(seed);
  const base = {
    ok: true, game, seed, hash,
    claimed: claimed || null,
    matches: claimed ? claimed === hash : null,
    // Every play draws its own return from its own seed. This is that
    // draw, replayed here so the price is as checkable as the result.
    edge: await edgeFor(seed),
    edgeRule: `edge = ${EDGE_MIN} + (sha256(seed:edge)[0..8] / 2^32) * ${(EDGE_MAX - EDGE_MIN).toFixed(2)}`
  };

  if (game === "hilo") {
    // The deck as it would have been dealt: the first card, then one for
    // each call up to the cap.
    const cards = [];
    for (let i = 0; i <= MAX_STEPS; i += 1) {
      const c = await cardAt(seed, i);
      cards.push({ i, rank: c.rank, label: RANKS[c.rank - 1], suit: SUITS[c.suit], odds: oddsFrom(c.rank) });
    }
    return json({ ...base, name: "Higher or Lower", rule: "card i = 1 + (sha256(seed:i) mod 13), suit = sha256(seed:i)[8..10] mod 4", cards });
  }

  if (game === "mines") {
    const mines = clampInt(q.get("mines"), MIN_MINES, MAX_MINES, DEFAULT_MINES);
    const bombs = await bombsFor(seed, mines);
    return json({ ...base, name: "Mines", mines, tiles: TILES, bombs, ladder: ladderFor(mines, await edgeFor(seed)), rule: `bombs = first ${mines} of 0..24 after a Fisher–Yates shuffle where swap i is sha256(seed:shuffle:i) mod (i+1)` });
  }

  if (game === "plinko") {
    const path = await pathFor(seed);
    const bucket = bucketOf(path);
    return json({ ...base, name: "Plinko", rows: ROWS, path, bucket, multiplier: Math.round((multiplierFor(bucket) * (await edgeFor(seed)) / PLINKO_RETURN) * 10000) / 10000, nominal: multiplierFor(bucket), rule: "row i goes right when sha256(seed:i) is odd; the bucket is the number of rights" });
  }

  if (game === "wheel" || game === "race") {
    const g = SHARED[game];
    const result = await g.outcome(seed);
    return json({ ...base, name: g.name, result, describe: g.describe(result), rule: `from sha256(seed:${game})` });
  }

  if (game === "flip") {
    return json({ ...base, name: "Coin Flip", result: await resultOf(seed), rule: "the low bit of sha256(seed:flip): even is heads, odd is tails" });
  }

  if (game === "roulette" || game === "standing") {
    const g = PVP[game];
    const players = clampInt(q.get("players"), MIN_PLAYERS, MAX_PLAYERS, MIN_PLAYERS);
    const seats = Array.from({ length: players }, (_, i) => String(i));
    const result = await outcomeFor(g, seed, seats);
    return json({
      ...base, name: g.name, players, result,
      chambers: game === "roulette" ? chambersFor(players) : undefined,
      rule: game === "roulette"
        ? "round k: live chamber = sha256(seed:roulette:k) mod chambers; chamber c is pulled by the c-th seat still in, wrapping; the seat that gets it is out; last one left wins"
        : "elimination order = Fisher–Yates over the seats where swap i is sha256(seed:shuffle:i) mod (i+1); the last left wins"
    });
  }

  if (game === "scratch") {
    const prize = await scratchOutcome(seed);
    const grid = await scratchGrid(seed, prize);
    return json({
      ...base, name: "Scratch-Off", grid, prize: prize ? { key: prize.key, name: prize.name, multiplier: Math.round((prize.x * (await edgeFor(seed)) / SCRATCH_RETURN) * 10000) / 10000, nominal: prize.x } : null,
      table: SCRATCH_PRIZES.map((p) => ({ key: p.key, name: p.name, multiplier: p.x, chance: p.p })),
      rule: "u = sha256(seed:scratch) as a fraction; walked down the prize table rarest first, the prize whose slice u falls in wins (none past 43.4%); the nine cells then come from sha256(seed:cell:i)"
    });
  }

  if (game === "pot") {
    // The hidden line and, given the day's total stakes, the draw.
    const total = clampInt(q.get("total"), 0, 100000000, 0);
    return json({
      ...base, name: "The Daily Jackpot",
      trigger: await triggerFor(seed), floor: TRIGGER_MIN, ceiling: TRIGGER_MAX,
      total: total || null, draw: total ? await drawFor(seed, total) : null,
      rule: `trigger = ${TRIGGER_MIN} + (sha256(seed:trigger) mod ${TRIGGER_MAX - TRIGGER_MIN + 1}); draw = sha256(seed:draw) mod total stake; the draw lands in one player's range, ranges laid out by stake in user-id order`
    });
  }

  return fail("BAD_GAME", "game must be one of: hilo, mines, plinko, scratch, wheel, race, flip, roulette, standing, pot");
}
