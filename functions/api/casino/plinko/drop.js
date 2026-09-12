/* POST /api/casino/plinko/drop  { stake }

   Takes the stake, drops the ball down the seed this player had
   committed, pays the bucket it lands in, and commits a fresh seed
   for their next drop. Ten drops an hour; 1 to 20 ZC. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, capCheck } from "../_engine.js";
import { ensurePlinko, commitFor, rotateCommit, pathFor, bucketOf, multiplierFor, publicDrop, dropsLastHour, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_plinko.js";

const PLINKO = { key: "plinko" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensurePlinko(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const stake = Math.floor(Number(body.stake));
  if (!Number.isFinite(stake) || stake < MIN_BET) return fail("BAD_WAGER", `Minimum is ${MIN_BET} ZCoin.`);
  if (stake > MAX_BET) return fail("BAD_WAGER", `Maximum is ${MAX_BET} ZCoins a drop.`);

  if ((await dropsLastHour(db, user.id)) >= MAX_BETS_PER_HOUR) return fail("RATE_LIMIT", `That's ${MAX_BETS_PER_HOUR} drops this hour — the limit. Back in a bit.`, 429);
  const cap = await capCheck(db, user.id);
  if (cap.blocked) return fail("WIN_CAP", `You're up ${cap.net.toLocaleString()} ZC this hour — that's the cap. The tables reopen for you as the hour rolls on.`, 429);

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  if (stake > balance) return fail("INSUFFICIENT_FUNDS", `That's more than your ${balance.toLocaleString()} ZCoins.`, 409);

  // The seed whose hash this player was already shown.
  const commit = await commitFor(db, user.id);
  if (!commit) return fail("NO_COMMIT", "Couldn't set up the board. Try again.", 500);

  const id = newId("pk");
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:PLINKO:BET:${id}`, userId: user.id,
    marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -stake
  });
  if (!begun.ok) return fail("DUPLICATE", "That drop is already going.", 409);

  const debit = await moveBalance(context.env, user.login, -stake);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return fail("DEBIT_FAILED", "Couldn't take the stake from your balance. Nothing was charged.", 502);
  }

  const path = await pathFor(commit.seed);
  const bucket = bucketOf(path);
  const multiplier = multiplierFor(bucket);
  const payout = Math.floor(stake * multiplier);

  try {
    await db
      .prepare(`INSERT INTO plinko_drops (id, user_id, seed, hash, stake, path, bucket, multiplier, payout) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, user.id, commit.seed, commit.hash, stake, path, bucket, multiplier, payout)
      .run();
  } catch (error) {
    const refund = await moveBalance(context.env, user.login, stake);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", {
      balanceAfter: refund.ok ? refund.balance : null,
      error: `plinko_insert_failed:${String(error?.message || "").slice(0, 120)}`
    });
    if (refund.ok) {
      await db
        .prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`)
        .bind(newId("op"), `REFUND:CASINO:PLINKO:BET:${id}`, user.id, stake, refund.balance)
        .run();
      return fail("DROP_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }
    return fail("NEEDS_RECONCILIATION", "Something went wrong and your stake couldn't be returned automatically. A moderator has been notified.", 500);
  }

  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });

  // The seed has now been used, so it is spent whatever happens next.
  const next = await rotateCommit(db, user.id);

  let balanceAfter = debit.balance;
  if (payout > 0) {
    const payId = newId("op");
    const begunPay = await beginOperation(db, {
      id: payId, idempotencyKey: `CASINO:PLINKO:PAY:${id}`, userId: user.id,
      marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: payout
    });
    if (begunPay.ok) {
      const credit = await moveBalance(context.env, user.login, payout);
      if (credit.ok) {
        await finishOperation(db, payId, "CONFIRMED", { balanceAfter: credit.balance });
        balanceAfter = credit.balance;
      } else {
        await finishOperation(db, payId, "NEEDS_RECONCILIATION", { error: credit.error });
      }
    }
  }

  await touchPresence(db, PLINKO, user.id);
  const row = await db.prepare(`SELECT * FROM plinko_drops WHERE id = ?`).bind(id).first();
  return json({ ok: true, drop: publicDrop(row), balance: balanceAfter, nextHash: next.hash });
}
