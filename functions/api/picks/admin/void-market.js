/* ============================================================
   EastCoin Picks — close a market (admin)

   For a market that should never settle: a mistimed open, a typo'd
   team name, a game that won't be played, or test data cluttering a
   live board.

   Voiding refunds every active pick in full. That is the whole point
   — a market that simply vanished would leave people's ZCoins gone
   with no result to explain it. Refunds go through wallet_operations
   with a unique key per pick, so pressing this twice cannot pay
   twice.
   ============================================================ */

import {
  ADMIN_ALLOWLIST,
  getSessionUser,
  moveBalance,
  walletWritesEnabled,
  beginOperation,
  finishOperation,
  newId,
  json,
  fail
} from "../_lib.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) {
    return fail("NOT_ADMIN", "Only Picks admins can close markets.", 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return fail("BAD_REQUEST", "Expected a JSON body.");
  }

  const marketId = String(body?.marketId || "").trim();
  if (!marketId) return fail("BAD_REQUEST", "Missing marketId.");

  const market = await db
    .prepare(`SELECT id, state, away_name, home_name FROM markets WHERE id = ? LIMIT 1`)
    .bind(marketId)
    .first();

  if (!market) return fail("NO_MARKET", "That market doesn't exist.", 404);

  // A settled market has already paid out. Reversing that is not a
  // button, it is a conversation.
  if (market.state === "SETTLED" || market.state === "VOID") {
    return fail("ALREADY_FINISHED", `That market is already ${market.state}.`, 409);
  }

  const picks = await db
    .prepare(
      `SELECT p.id, p.user_id, p.wager, u.twitch_login
         FROM picks p
         JOIN users u ON u.twitch_id = p.user_id
        WHERE p.market_id = ? AND p.status = 'ACTIVE'`
    )
    .bind(marketId)
    .all();

  const active = picks.results || [];

  if (active.length && !walletWritesEnabled(context.env)) {
    return fail(
      "WALLET_NOT_CONFIGURED",
      "There are picks to refund but ZCoin transfers aren't configured. Nothing was changed.",
      503
    );
  }

  let refunded = 0;
  let failed = 0;

  for (const pick of active) {
    const opId = newId("op");
    const begun = await beginOperation(db, {
      id: opId,
      idempotencyKey: `VOID:${pick.id}`,   // one refund per pick, ever
      userId: pick.user_id,
      marketId,
      pickId: pick.id,
      type: "REFUND_CREDIT",
      amount: pick.wager
    });

    if (!begun.ok) continue;   // already refunded on an earlier press

    const credit = await moveBalance(context.env, String(pick.twitch_login).toLowerCase(), pick.wager);
    if (!credit.ok) {
      await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
      failed += 1;
      continue;
    }

    await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });
    await db
      .prepare(
        `UPDATE picks
            SET status = 'REFUNDED', payout = ?, profit = 0,
                settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
      )
      .bind(pick.wager, pick.id)
      .run();
    refunded += 1;
  }

  // A market with an unpaid refund must not read as finished, or the
  // person still owed money disappears from view.
  if (failed) {
    return fail(
      "REFUND_FAILED",
      `${refunded} refunded, ${failed} failed. The market was left open so it can be retried.`,
      502,
      { refunded, failed }
    );
  }

  await db
    .prepare(
      `UPDATE markets
          SET state = 'VOID', settlement_source = 'admin',
              settlement_detail = ?, settled_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
    .bind(`Closed by ${user.login}`, marketId)
    .run();

  console.log(`Picks: ${user.login} voided ${marketId} (${refunded} refunded)`);

  return json({
    ok: true,
    market: { id: marketId, away: market.away_name, home: market.home_name },
    refunded
  });
}

export async function onRequestGet() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to close a market.", 405);
}
