/* ============================================================
   EastCoin Picks — place a wager

   Order of operations matters here, and it is deliberate:

     1. validate everything against the DATABASE, never the client
     2. write a PENDING wallet_operations row (unique idempotency key)
     3. debit StreamElements
     4. insert the pick
     5. confirm the operation

   If step 4 fails after step 3 succeeded, the debit is immediately
   reversed with a COMPENSATING_REFUND and the request is rejected.
   Someone occasionally seeing "that didn't go through, try again"
   is far better than quietly losing their ZCoins.
   ============================================================ */

import {
  WAGER_ALLOWLIST,
  MIN_WAGER,
  getSessionUser,
  readBalance,
  moveBalance,
  walletWritesEnabled,
  beginOperation,
  finishOperation,
  totalReturn,
  newId,
  json,
  fail
} from "./_lib.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user) {
    return fail("NOT_AUTHENTICATED", "Log in with Twitch to make a pick.", 401);
  }

  // The test is limited to named logins. Everyone else is told plainly
  // rather than hitting a confusing failure further down.
  if (!WAGER_ALLOWLIST.has(user.login)) {
    return fail(
      "NOT_IN_TEST",
      "Picks is in limited testing and isn't open to everyone yet.",
      403
    );
  }

  if (!walletWritesEnabled(context.env)) {
    return fail(
      "WALLET_NOT_CONFIGURED",
      "ZCoin transfers aren't configured on the server yet.",
      503
    );
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return fail("BAD_REQUEST", "Expected a JSON body.");
  }

  const marketId = String(body?.marketId || "").trim();
  const selection = String(body?.selection || "").trim().toLowerCase();
  const wager = Math.floor(Number(body?.wager));

  if (!marketId) return fail("BAD_REQUEST", "Missing marketId.");
  if (selection !== "away" && selection !== "home") {
    return fail("BAD_REQUEST", "Selection must be 'away' or 'home'.");
  }
  if (!Number.isFinite(wager) || wager < MIN_WAGER) {
    return fail("BAD_WAGER", `Minimum stake is ${MIN_WAGER} ZCoin.`);
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
    .bind(marketId)
    .first();

  if (!market) return fail("NO_MARKET", "That market doesn't exist.", 404);
  if (market.state !== "OPEN") {
    return fail("MARKET_CLOSED", "Betting on this game is closed.", 409);
  }
  if (market.starts_at && new Date(market.starts_at).getTime() <= Date.now()) {
    return fail("MARKET_CLOSED", "This game has already started.", 409);
  }

  const odds = selection === "away" ? market.away_odds_locked : market.home_odds_locked;
  if (!Number.isFinite(Number(odds)) || Number(odds) === 0) {
    return fail("NO_PRICE", "This market has no locked price yet.", 409);
  }

  // One pick per game per person, enforced by the schema too.
  const existing = await db
    .prepare(`SELECT id FROM picks WHERE market_id = ? AND user_id = ? LIMIT 1`)
    .bind(marketId, user.id)
    .first();
  if (existing) {
    return fail("ALREADY_PICKED", "You've already made a pick on this game.", 409);
  }

  /* -------------------------------------------------- balance */

  const balance = await readBalance(context.env, user.login);
  if (balance === null) {
    return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  }
  if (wager > balance) {
    return fail(
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
  // cannot debit twice, because the second insert collides.
  const idempotencyKey = `WAGER:${marketId}:${user.id}`;

  const begun = await beginOperation(db, {
    id: opId,
    idempotencyKey,
    userId: user.id,
    marketId,
    pickId: null,
    type: "WAGER_DEBIT",
    amount: -wager
  });

  if (!begun.ok) {
    return fail("DUPLICATE", "That pick is already being processed.", 409);
  }

  const debit = await moveBalance(context.env, user.login, -wager);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return fail("DEBIT_FAILED", "Couldn't take the stake from your balance. Nothing was charged.", 502);
  }

  /* -------------------------------------------------- record the pick */

  try {
    await db
      .prepare(
        `INSERT INTO picks
           (id, market_id, user_id, selection, wager, status, odds_locked)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`
      )
      .bind(pickId, marketId, user.id, selection, wager, Number(odds))
      .run();
  } catch (error) {
    // Charged but not recorded — unwind immediately.
    console.error("Pick insert failed after debit; refunding", error);
    const refund = await moveBalance(context.env, user.login, wager);

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
              user.id, marketId, wager, refund.balance)
        .run();

      return fail("PICK_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }

    return fail(
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

  return json({
    ok: true,
    pick: {
      id: pickId,
      marketId,
      selection,
      team: selection === "away" ? market.away_name : market.home_name,
      wager,
      odds: Number(odds),
      returnsIfWon: totalReturn(wager, odds)
    },
    balance: debit.balance
  });
}

export async function onRequestGet() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to create a Picks wager.", 405);
}
