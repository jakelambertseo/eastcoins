/* ============================================================
   EastCoin Picks — placing a wager

   Lifted out of the HTTP handler so the website and the chat
   command run the same code. Two implementations of "take someone's
   ZCoins and record a pick" would eventually disagree about a
   number, and the one that disagrees quietly is the expensive one.

   Callers differ only in how they authenticated the user and how
   they render the result. Everything below this line is identical
   for both.
   ============================================================ */

import {
  WAGER_ALLOWLIST,
  wageringOpenToAll,
  MIN_WAGER,
  readBalance,
  moveBalance,
  walletWritesEnabled,
  beginOperation,
  finishOperation,
  totalReturn,
  newId
} from "./_lib.js";

/**
 * Order of operations is deliberate:
 *
 *   1. validate everything against the DATABASE, never the caller
 *   2. write a PENDING wallet_operations row (unique idempotency key)
 *   3. debit StreamElements
 *   4. insert the pick
 *   5. confirm the operation
 *
 * If step 4 fails after step 3 succeeded, the debit is reversed with a
 * COMPENSATING_REFUND and the request is rejected. Someone occasionally
 * seeing "that didn't go through" is far better than quietly losing
 * their ZCoins.
 *
 * Returns { ok: true, pick, balance } or { ok: false, code, message,
 * status } — never throws for an expected refusal, so both callers can
 * branch instead of catching.
 */
export async function placeWager(env, db, user, { marketId, selection, wager }) {
  const deny = (code, message, status = 400, extra = {}) => ({
    ok: false, code, message, status, ...extra
  });

  // Open to the channel, or limited to named logins. Whoever is shut
  // out is told plainly rather than hitting a confusing failure further
  // down.
  if (!wageringOpenToAll(env) && !WAGER_ALLOWLIST.has(user.login)) {
    return deny("NOT_IN_TEST", "Picks is in limited testing and isn't open to everyone yet.", 403);
  }
  if (!walletWritesEnabled(env)) {
    return deny("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured on the server yet.", 503);
  }

  const id = String(marketId || "").trim();
  const side = String(selection || "").trim().toLowerCase();
  // "all" is the whole balance — resolved once the balance is known.
  const allIn = String(wager).trim().toLowerCase() === "all";
  let amount = allIn ? 0 : Math.floor(Number(wager));

  if (!id) return deny("BAD_REQUEST", "Missing marketId.");
  if (side !== "away" && side !== "home") {
    return deny("BAD_REQUEST", "Selection must be 'away' or 'home'.");
  }
  if (!allIn && (!Number.isFinite(amount) || amount < MIN_WAGER)) {
    return deny("BAD_WAGER", `Minimum stake is ${MIN_WAGER} ZCoin.`);
  }

  /* -------------------------------------------------- market checks */

  const market = await db
    .prepare(
      `SELECT id, state, starts_at, away_name, home_name,
              away_odds_locked, home_odds_locked
         FROM markets
        WHERE id = ?
        LIMIT 1`
    )
    .bind(id)
    .first();

  if (!market) return deny("NO_MARKET", "That market doesn't exist.", 404);
  if (market.state !== "OPEN") {
    return deny("MARKET_CLOSED", "Betting on this game is closed.", 409);
  }
  if (market.starts_at && new Date(market.starts_at).getTime() <= Date.now()) {
    return deny("MARKET_CLOSED", "This game has already started.", 409);
  }

  const odds = side === "away" ? market.away_odds_locked : market.home_odds_locked;
  if (!Number.isFinite(Number(odds)) || Number(odds) === 0) {
    return deny("NO_PRICE", "This market has no locked price yet.", 409);
  }

  // One pick per game per person, enforced by the schema too.
  const existing = await db
    .prepare(`SELECT id FROM picks WHERE market_id = ? AND user_id = ? LIMIT 1`)
    .bind(id, user.id)
    .first();
  if (existing) {
    return deny("ALREADY_PICKED", "You've already made a pick on this game.", 409, {
      market: { away: market.away_name, home: market.home_name }
    });
  }

  /* -------------------------------------------------- balance */

  const balance = await readBalance(env, user.login);
  if (balance === null) {
    return deny("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  }
  if (allIn) {
    amount = Math.floor(balance);
    if (amount < MIN_WAGER) {
      return deny("INSUFFICIENT_FUNDS", "You don't have any ZCoins to bet.", 409, { balance });
    }
  }
  if (amount > balance) {
    return deny(
      "INSUFFICIENT_FUNDS",
      `That's more than your ${balance.toLocaleString()} ZCoins.`,
      409,
      { balance }
    );
  }

  /* -------------------------------------------------- debit */

  const pickId = newId("pick");
  const opId = newId("op");
  // Keyed on the pick, not the request: a retry of the same intent
  // cannot debit twice, because the second insert collides. This is
  // what makes the chat path's GET safe to replay.
  const idempotencyKey = `WAGER:${id}:${user.id}`;

  const begun = await beginOperation(db, {
    id: opId,
    idempotencyKey,
    userId: user.id,
    marketId: id,
    pickId: null,
    type: "WAGER_DEBIT",
    amount: -amount
  });

  if (!begun.ok) {
    return deny("DUPLICATE", "That pick is already being processed.", 409);
  }

  const debit = await moveBalance(env, user.login, -amount);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return deny("DEBIT_FAILED", "Couldn't take the stake from your balance. Nothing was charged.", 502);
  }

  /* -------------------------------------------------- record the pick */

  try {
    await db
      .prepare(
        `INSERT INTO picks
           (id, market_id, user_id, selection, wager, status, odds_locked)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`
      )
      .bind(pickId, id, user.id, side, amount, Number(odds))
      .run();
  } catch (error) {
    // Charged but not recorded — unwind immediately.
    console.error("Pick insert failed after debit; refunding", error);
    const refund = await moveBalance(env, user.login, amount);

    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", {
      balanceAfter: refund.ok ? refund.balance : null,
      error: `pick_insert_failed:${String(error?.message || "").slice(0, 120)}`
    });

    if (refund.ok) {
      await db
        .prepare(
          `INSERT INTO wallet_operations
             (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after)
           VALUES (?, ?, ?, ?, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`
        )
        .bind(newId("op"), `REFUND:${idempotencyKey}:${Date.now()}`,
              user.id, id, amount, refund.balance)
        .run();

      return deny("PICK_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }

    return deny(
      "NEEDS_RECONCILIATION",
      "Something went wrong and your stake couldn't be returned automatically. This has been logged for a moderator.",
      500
    );
  }

  await db
    .prepare(`UPDATE wallet_operations SET pick_id = ? WHERE id = ?`)
    .bind(pickId, opId)
    .run();

  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });

  return {
    ok: true,
    pick: {
      id: pickId,
      marketId: id,
      selection: side,
      team: side === "away" ? market.away_name : market.home_name,
      opponent: side === "away" ? market.home_name : market.away_name,
      wager: amount,
      odds: Number(odds),
      returnsIfWon: totalReturn(amount, odds)
    },
    balance: debit.balance
  };
}
