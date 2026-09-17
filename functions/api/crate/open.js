/* POST /api/crate/open  { buy?: true }

   Opens a crate. Without `buy` it is the free one, refused (FREE_USED)
   if this person had one in the last 24 hours; with `buy` it costs
   PRICE ZC first. The seed is committed on the row, then the prize is
   granted from it: coins as a PAYOUT_CREDIT, an item as an owned store
   row. The reveal is sent back with the seed, so it can be checked. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../picks/_lib.js";
import { ensureStore, ownedItems } from "../store/_store.js";
import { sha256, randomSeed } from "../casino/_engine.js";
import { ensureCrate, PRICE, FREE_EVERY_MS, lastFreeAt, nextFreeAt, drawFor, publicOpen } from "./_crate.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The crate is offline right now.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to open a crate.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);
  await ensureStore(db);
  await ensureCrate(db);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const buy = body.buy === true;
  const now = Date.now();

  let debitOp = null, balanceAfterDebit = null;
  if (!buy) {
    const last = await lastFreeAt(db, user.id);
    if (last && now - last < FREE_EVERY_MS) return fail("FREE_USED", "You've had today's free crate.", 409, { nextFreeAt: new Date(nextFreeAt(last)).toISOString() });
  } else {
    const balance = await readBalance(context.env, user.login);
    if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
    if (balance < PRICE) return fail("INSUFFICIENT_FUNDS", `A crate is ${PRICE} ZC and you have ${balance.toLocaleString()}.`, 409);
    const bought = await db.prepare(`SELECT COUNT(*) AS n FROM crate_opens WHERE user_id = ? AND kind = 'buy'`).bind(user.id).first();
    const opKey = `CRATE:BUY:${user.id}:${Number(bought?.n || 0)}`;
    debitOp = newId("op");
    const begun = await beginOperation(db, { id: debitOp, idempotencyKey: opKey, userId: user.id, marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -PRICE });
    if (!begun.ok) return fail("DUPLICATE", "That crate is already opening.", 409);
    const debit = await moveBalance(context.env, user.login, -PRICE);
    if (!debit.ok) {
      await finishOperation(db, debitOp, "FAILED", { error: debit.error });
      return fail("DEBIT_FAILED", "Couldn't take the ZCoins from your balance. Nothing was charged.", 502);
    }
    balanceAfterDebit = debit.balance;
  }

  // Decide the pull from a committed seed, then record it before granting.
  const seed = randomSeed(), hash = await sha256(seed);
  const owned = await ownedItems(db, user.id);
  const pull = await drawFor(seed, owned);
  const id = newId("crate");
  const prize = pull.item ? pull.item.id : `zc:${pull.coins}`;
  let landed;
  if (!buy) {
    // The free crate's 24-hour rule is enforced in the insert itself, so
    // two clicks in the same instant cannot both be free.
    landed = await db.prepare(
      `INSERT INTO crate_opens (id, user_id, kind, seed, hash, rarity, prize, coins)
       SELECT ?, ?, 'free', ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM crate_opens WHERE user_id = ? AND kind = 'free' AND created_at >= datetime('now', '-24 hours'))`
    ).bind(id, user.id, seed, hash, pull.rarity, prize, pull.coins, user.id).run();
    if (!landed?.meta?.changes) return fail("FREE_USED", "You've had today's free crate.", 409);
  } else {
    try {
      await db.prepare(`INSERT INTO crate_opens (id, user_id, kind, seed, hash, rarity, prize, coins) VALUES (?, ?, 'buy', ?, ?, ?, ?, ?)`)
        .bind(id, user.id, seed, hash, pull.rarity, prize, pull.coins).run();
    } catch (error) {
      const refund = await moveBalance(context.env, user.login, PRICE);
      await finishOperation(db, debitOp, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", { balanceAfter: refund.ok ? refund.balance : null, error: `crate_insert_failed:${String(error?.message || "").slice(0, 120)}` });
      return fail("OPEN_FAILED", refund.ok ? "That didn't go through — your ZCoins were returned." : "Something went wrong and your ZCoins couldn't be returned automatically. An admin can see it.", 500);
    }
    await finishOperation(db, debitOp, "CONFIRMED", { balanceAfter: balanceAfterDebit });
  }

  // Grant it.
  let balance = balanceAfterDebit, payFailed = false;
  if (pull.item) {
    await db.prepare(`INSERT INTO store_purchases (id, user_id, item, price, status, op_key) VALUES (?, ?, ?, 0, 'OWNED', ?)`)
      .bind(newId("sp"), user.id, pull.item.id, `CRATE:ITEM:${id}`).run().catch(() => {});
    // Switch it on only if that slot is empty — a crate must not undo a look someone chose.
    await db.prepare(`INSERT INTO user_cosmetics (user_id, ${pull.item.slot}, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                      ON CONFLICT (user_id) DO UPDATE SET ${pull.item.slot} = COALESCE(user_cosmetics.${pull.item.slot}, excluded.${pull.item.slot}), updated_at = CURRENT_TIMESTAMP`)
      .bind(user.id, pull.item.id).run().catch(() => {});
  } else {
    const opId = newId("op");
    const begun = await beginOperation(db, { id: opId, idempotencyKey: `CRATE:PAY:${id}`, userId: user.id, marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: pull.coins });
    if (begun.ok) {
      const credit = await moveBalance(context.env, user.login, pull.coins);
      if (credit.ok) { await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance }); balance = credit.balance; }
      else { await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error }); payFailed = true; }
    }
  }

  console.log(`Crate: ${user.login} opened a ${buy ? "bought" : "free"} crate → ${pull.rarity} ${prize}${pull.fallback ? " (tier owned out)" : ""}`);
  const row = { id, kind: buy ? "buy" : "free", seed, hash, rarity: pull.rarity, coins: pull.coins, created_at: new Date(now).toISOString().replace("T", " ").slice(0, 19) };
  return json({
    ok: true,
    open: publicOpen(row, pull.item),
    balance,
    payFailed,
    nextFreeAt: new Date(buy ? nextFreeAt(await lastFreeAt(db, user.id)) : now + FREE_EVERY_MS).toISOString()
  });
}
