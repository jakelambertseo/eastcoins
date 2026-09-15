/* POST /api/store/buy  { item }

   Takes the price in ZCoins and records the item as owned. Owned once
   per item; a double click or a retry cannot charge twice (see the key
   rule in _store.js). Cosmetic slots switch the new item on straight
   away; a custom title waits until its text is set. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../picks/_lib.js";
import { ensureStore, itemById, mineFor, NEEDS_INPUT } from "./_store.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The store is offline right now.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to buy.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);
  await ensureStore(db);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const item = itemById(String(body.item || ""));
  if (!item) return fail("BAD_ITEM", "That item isn't in the store.");

  const owned = await db.prepare(`SELECT 1 FROM store_purchases WHERE user_id = ? AND item = ? AND status = 'OWNED'`).bind(user.id, item.id).first();
  if (owned) return fail("ALREADY_OWNED", `You already own ${item.name}.`, 409);

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  if (item.price > balance) return fail("INSUFFICIENT_FUNDS", `${item.name} is ${item.price.toLocaleString()} ZC and you have ${balance.toLocaleString()}.`, 409);

  const before = await db.prepare(`SELECT COUNT(*) AS n FROM store_purchases WHERE user_id = ? AND item = ?`).bind(user.id, item.id).first();
  const opKey = `STORE:BUY:${user.id}:${item.id}:${Number(before?.n || 0)}`;
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: opKey, userId: user.id,
    marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -item.price
  });
  if (!begun.ok) return fail("DUPLICATE", "That purchase is already going through.", 409);

  const debit = await moveBalance(context.env, user.login, -item.price);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return fail("DEBIT_FAILED", "Couldn't take the ZCoins from your balance. Nothing was charged.", 502);
  }

  try {
    await db
      .prepare(`INSERT INTO store_purchases (id, user_id, item, price, status, op_key) VALUES (?, ?, ?, ?, 'OWNED', ?)`)
      .bind(newId("sp"), user.id, item.id, item.price, opKey)
      .run();
  } catch (error) {
    const refund = await moveBalance(context.env, user.login, item.price);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", {
      balanceAfter: refund.ok ? refund.balance : null,
      error: `store_insert_failed:${String(error?.message || "").slice(0, 120)}`
    });
    if (refund.ok) {
      await db
        .prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`)
        .bind(newId("op"), `REFUND:${opKey}`, user.id, item.price, refund.balance)
        .run();
      return fail("BUY_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }
    return fail("NEEDS_RECONCILIATION", "Something went wrong and your ZCoins couldn't be returned automatically. An admin can see it and fix it.", 500);
  }

  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });

  // Switch it on, unless it needs something typed or chosen first. The
  // slot name comes from the catalogue, never the request.
  if (!NEEDS_INPUT.has(item.id)) {
    await db
      .prepare(`INSERT INTO user_cosmetics (user_id, ${item.slot}, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id) DO UPDATE SET ${item.slot} = excluded.${item.slot}, updated_at = CURRENT_TIMESTAMP`)
      .bind(user.id, item.id)
      .run()
      .catch(() => {});
  }

  console.log(`Store: ${user.login} bought ${item.id} for ${item.price}`);
  return json({ ok: true, item: item.id, balance: debit.balance, mine: await mineFor(db, user.id) });
}
