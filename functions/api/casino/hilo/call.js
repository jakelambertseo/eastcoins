/* POST /api/casino/hilo/call  { id, call: "higher"|"lower" }

   Reveals the next card of a live run. A correct call multiplies
   the stake by the price of that call, a tie pushes (same multiplier,
   the run carries on from the tied card), and a wrong call busts it.
   Hitting ×50 or the twelfth card cashes out on the spot. The card was
   fixed by the seed before the run began. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensureHilo, cardAt, oddsFrom, publicGame, cashOut, MAX_MULTIPLIER, MAX_STEPS, RANKS, SUITS } from "./_hilo.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensureHilo(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const id = String(body.id || "").trim();
  const call = String(body.call || "").toLowerCase();
  if (call !== "higher" && call !== "lower") return fail("BAD_CALL", "Call higher or lower.");

  const g = await db.prepare(`SELECT * FROM hilo_games WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (!g) return fail("NO_GAME", "No such run.", 404);
  if (g.status !== "LIVE") return fail("NOT_LIVE", "That run is over.", 409);

  const cards = JSON.parse(g.cards);
  const calls = JSON.parse(g.calls || "[]");
  const current = cards[cards.length - 1];
  const odds = oddsFrom(current.rank);
  const price = odds[call];
  if (!price) return fail("IMPOSSIBLE_CALL", call === "higher" ? "Nothing beats a king." : "Nothing sits under an ace.");

  const drawn = await cardAt(g.seed, cards.length);
  // Stored like the first card (the suit as its index); the reply carries
  // the label and symbol the page draws.
  const next = { rank: drawn.rank, label: RANKS[drawn.rank - 1], suit: SUITS[drawn.suit] };
  const stored = { rank: drawn.rank, suit: drawn.suit };
  const push = next.rank === current.rank;
  const won = !push && (call === "higher" ? next.rank > current.rank : next.rank < current.rank);
  const newCards = [...cards, stored];
  const newCalls = [...calls, push ? { call, price, won: false, push: true } : { call, price, won }];

  if (push) {
    // A tie: nothing is won or lost. The card is dealt, the multiplier
    // stays, and it still counts toward the twelve-card limit.
    const r = await db
      .prepare(`UPDATE hilo_games SET cards = ?, calls = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE' AND cards = ?`)
      .bind(JSON.stringify(newCards), JSON.stringify(newCalls), id, g.cards)
      .run();
    if (!r.meta?.changes) return fail("RACE", "That call was already made — refresh.", 409);
    if (newCalls.length >= MAX_STEPS) {
      const fresh = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
      const paid = await cashOut(context.env, db, fresh, user.login);
      const done = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
      return json({ ok: true, outcome: "push", card: next, autoCashed: paid.ok, payout: paid.payout || 0, balance: paid.balance ?? null, game: publicGame(done) });
    }
    const live = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
    return json({ ok: true, outcome: "push", card: next, game: publicGame(live) });
  }

  if (!won) {
    // The lock: only a LIVE row can be busted, once.
    const r = await db
      .prepare(`UPDATE hilo_games SET cards = ?, calls = ?, status = 'BUST', payout = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE'`)
      .bind(JSON.stringify(newCards), JSON.stringify(newCalls), id)
      .run();
    if (!r.meta?.changes) return fail("NOT_LIVE", "That run is over.", 409);
    const done = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
    return json({ ok: true, outcome: "bust", card: next, game: publicGame(done) });
  }

  const multiplier = Math.round(Number(g.multiplier) * price * 100) / 100;
  const r = await db
    .prepare(`UPDATE hilo_games SET cards = ?, calls = ?, multiplier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE' AND cards = ?`)
    .bind(JSON.stringify(newCards), JSON.stringify(newCalls), multiplier, id, g.cards)
    .run();
  if (!r.meta?.changes) return fail("RACE", "That call was already made — refresh.", 409);

  // Out of road: the cap or the last card pays out on the spot.
  if (multiplier >= MAX_MULTIPLIER || newCalls.length >= MAX_STEPS) {
    const fresh = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
    const paid = await cashOut(context.env, db, fresh, user.login);
    const done = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
    return json({ ok: true, outcome: "win", card: next, autoCashed: paid.ok, payout: paid.payout || 0, balance: paid.balance ?? null, game: publicGame(done) });
  }

  const live = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
  return json({ ok: true, outcome: "win", card: next, game: publicGame(live) });
}
