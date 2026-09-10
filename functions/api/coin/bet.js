/* POST /api/coin/bet  { side: "heads"|"tails", wager: 1..20 }

   One bet per person per round, taken while bets are open. The stake
   leaves the wallet now; a win comes back as 2× when the round flips. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../picks/_lib.js";
import { ensureSchema, roundAt, ensureRound, betsLastHour, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_coin.js";
import { ensureSchema as ensureCasino, capCheck } from "../casino/_engine.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const side = String(body.side || "").toLowerCase();
  const wager = Math.floor(Number(body.wager));
  if (side !== "heads" && side !== "tails") return fail("BAD_SIDE", "Pick heads or tails.");
  if (!Number.isFinite(wager) || wager < MIN_BET) return fail("BAD_WAGER", `Minimum is ${MIN_BET} ZCoin.`);
  if (wager > MAX_BET) return fail("BAD_WAGER", `Maximum is ${MAX_BET} ZCoins a round.`);

  const now = Date.now();
  const round = roundAt(now);
  // A little grace at the edge so a click as the clock hits zero is not
  // refused by a slow network; the flip itself is decided by the seed,
  // so a late bet cannot see the result first.
  if (round.phase !== "bets" && now - round.flipsAt > 1500) return fail("BETS_CLOSED", "Bets are closed — next round in a moment.", 409);
  await ensureRound(db, round.no);

  const already = await db.prepare(`SELECT id FROM coin_bets WHERE round_no = ? AND user_id = ?`).bind(round.no, user.id).first();
  if (already) return fail("ALREADY_IN", "You're already in this round.", 409);

  // Ten a rolling hour. Enough to play along, not enough to grind.
  const recent = await betsLastHour(db, user.id);
  if (recent >= MAX_BETS_PER_HOUR) return fail("RATE_LIMIT", `That's ${MAX_BETS_PER_HOUR} bets this hour — the limit. Back in a bit.`, 429);
  await ensureCasino(db);
  const cap = await capCheck(db, user.id);
  if (cap.blocked) return fail("WIN_CAP", `You're up ${cap.net.toLocaleString()} ZC this hour — that's the cap. The tables reopen for you as the hour rolls on.`, 429);

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  if (wager > balance) return fail("INSUFFICIENT_FUNDS", `That's more than your ${balance.toLocaleString()} ZCoins.`, 409);

  const betId = newId("cb");
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `COIN:BET:${round.no}:${user.id}`, userId: user.id,
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
      .prepare(`INSERT INTO coin_bets (id, round_no, user_id, side, wager) VALUES (?, ?, ?, ?, ?)`)
      .bind(betId, round.no, user.id, side, wager)
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
        .bind(newId("op"), `REFUND:COIN:BET:${round.no}:${user.id}:${Date.now()}`, user.id, wager, refund.balance)
        .run();
      return fail("BET_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }
    return fail("NEEDS_RECONCILIATION", "Something went wrong and your stake couldn't be returned automatically. A moderator has been notified.", 500);
  }

  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
  return json({ ok: true, round: round.no, side, wager, balance: debit.balance });
}
