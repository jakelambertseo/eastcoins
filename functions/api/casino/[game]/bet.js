/* POST /api/casino/<game>/bet  { pick, wager }

   One bet per person per round, taken while bets are open. The stake
   leaves the wallet now; a win comes back at the game's payout when
   the round settles. Same money path and limits as the coin flip. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../../picks/_lib.js";
import { gameFor, ensureSchema, roundAt, ensureRound, betsLastHour, capCheck, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "../_engine.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  const game = gameFor(context.params.game);
  if (game?.paused) return fail("PAUSED", `${game.name} is closed for now.`, 409);
  if (!game) return fail("NO_SUCH_GAME", "No such game.", 404);
  await ensureSchema(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const pick = String(body.pick || "").toLowerCase();
  const wager = Math.floor(Number(body.wager));
  if (!game.picks.includes(pick)) return fail("BAD_PICK", "That isn't one of the options.");
  if (!Number.isFinite(wager) || wager < MIN_BET) return fail("BAD_WAGER", `Minimum is ${MIN_BET} ZCoin.`);
  if (wager > MAX_BET) return fail("BAD_WAGER", `Maximum is ${MAX_BET} ZCoins a round.`);

  const now = Date.now();
  const round = roundAt(game, now);
  // A little grace at the edge for a slow network; the seed decides the
  // outcome, so a late bet still cannot see the result first.
  if (round.phase !== "bets" && now - round.closesAt > 1500) return fail("BETS_CLOSED", "Bets are closed — next round in a moment.", 409);
  await ensureRound(db, game, round.no);

  const already = await db.prepare(`SELECT id FROM casino_bets WHERE game = ? AND round_no = ? AND user_id = ?`).bind(game.key, round.no, user.id).first();
  if (already) return fail("ALREADY_IN", "You're already in this round.", 409);

  const recent = await betsLastHour(db, game, user.id);
  if (recent >= MAX_BETS_PER_HOUR) return fail("RATE_LIMIT", `That's ${MAX_BETS_PER_HOUR} bets this hour — the limit. Back in a bit.`, 429);
  const cap = await capCheck(db, user.id);
  if (cap.blocked) return fail("WIN_CAP", `You're up ${cap.net.toLocaleString()} ZC this hour — that's the cap. The tables reopen for you as the hour rolls on.`, 429);

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  if (wager > balance) return fail("INSUFFICIENT_FUNDS", `That's more than your ${balance.toLocaleString()} ZCoins.`, 409);

  const betId = newId("kb");
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:BET:${game.key}:${round.no}:${user.id}`, userId: user.id,
    marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -wager
  });
  if (!begun.ok) return fail("DUPLICATE", "That bet is already being placed.", 409);

  const debit = await moveBalance(context.env, user.login, -wager);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return fail("DEBIT_FAILED", "Couldn't take the stake from your balance. Nothing was charged.", 502);
  }

  try {
    await db
      .prepare(`INSERT INTO casino_bets (id, game, round_no, user_id, pick, wager) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(betId, game.key, round.no, user.id, pick, wager)
      .run();
  } catch (error) {
    const refund = await moveBalance(context.env, user.login, wager);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", {
      balanceAfter: refund.ok ? refund.balance : null,
      error: `bet_insert_failed:${String(error?.message || "").slice(0, 120)}`
    });
    if (refund.ok) {
      await db
        .prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`)
        .bind(newId("op"), `REFUND:CASINO:BET:${game.key}:${round.no}:${user.id}:${Date.now()}`, user.id, wager, refund.balance)
        .run();
      return fail("BET_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }
    return fail("NEEDS_RECONCILIATION", "Something went wrong and your stake couldn't be returned automatically. A moderator has been notified.", 500);
  }

  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
  return json({ ok: true, game: game.key, round: round.no, pick, wager, balance: debit.balance });
}
