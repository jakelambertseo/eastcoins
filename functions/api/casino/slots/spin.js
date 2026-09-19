/* POST /api/casino/slots/spin  { stake }

   Takes the stake, puts JACKPOT.slice of it in the shared pot, spins three
   reels from the seed this player had committed, pays the line times the
   play's edge (three sevens pays the JACKPOT instead), and commits a fresh
   seed for their next spin. Ten spins an hour; 1 to 20 ZC. GambaScape-only
   (see _slots.js). The money steps below are plinko/drop.js's, unchanged. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../../picks/_lib.js";
import { stakeFor, reopenStake, BAD_VOUCHER } from "../../eastscape/_stake.js";
import { settlePot } from "../_pot.js";
import { ensureSchema, touchPresence, capCheck } from "../_engine.js";
import { ensureSlots, commitFor, rotateCommit, reelsFor, lineFor, priceFor, feedPot, takeJackpot, noteJackpot, potNow, publicSpin, spinsLastHour, edgeFor, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_slots.js";

const SLOTS = { key: "slots" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensureSlots(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const stake = Math.floor(Number(body.stake));
  if (!Number.isFinite(stake) || stake < MIN_BET) return fail("BAD_WAGER", `Minimum is ${MIN_BET} ZCoin.`);
  if (stake > MAX_BET) return fail("BAD_WAGER", `Maximum is ${MAX_BET} ZCoins a spin.`);

  if ((await spinsLastHour(db, user.id)) >= MAX_BETS_PER_HOUR) return fail("RATE_LIMIT", `That's ${MAX_BETS_PER_HOUR} spins this hour — the limit. Back in a bit.`, 429);
  const cap = await capCheck(db, user.id);
  if (cap.blocked) return fail("WIN_CAP", `You're up ${cap.net.toLocaleString()} ZC this hour — that's the cap. The tables reopen for you as the hour rolls on.`, 429);

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  if (!body.voucher && stake > balance) return fail("INSUFFICIENT_FUNDS", `That's more than your ${balance.toLocaleString()} ZCoins.`, 409);

  // The seed whose hash this player was already shown.
  const commit = await commitFor(db, user.id);
  if (!commit) return fail("NO_COMMIT", "Couldn't set up the machine. Try again.", 500);

  const id = newId("sl");
  /* A GambaScape TICKET STAKE (eastscape/_stake.js): the house put this one up, so no ZCoin leaves the wallet and no
     debit is written. Claimed here, after every limit above, so a refused bet never spends one. Everything after
     this point (the seed, the edge, the payout, the rows) is the same bet. */
  const voucher = await stakeFor(db, user.id, body, stake, `slots:${id}`);
  if (voucher && !voucher.ok) return fail("BAD_VOUCHER", BAD_VOUCHER, 409);

  const opId = newId("op");
  const begun = voucher ? { ok: true } : await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:SLOTS:BET:${id}`, userId: user.id,
    marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -stake
  });
  if (!begun.ok) return fail("DUPLICATE", "That spin is already going.", 409);

  const debit = voucher ? { ok: true, balance } : await moveBalance(context.env, user.login, -stake);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return fail("DEBIT_FAILED", "Couldn't take the stake from your balance. Nothing was charged.", 502);
  }

  const reels = await reelsFor(commit.seed);
  const line = lineFor(reels);
  const edge = await edgeFor(commit.seed);
  // The pot is fed by every spin, this one included, BEFORE it is looked at: three sevens wins what is there now.
  await feedPot(db, stake);
  let jackpot = 0;
  if (line.jackpot) jackpot = await takeJackpot(db, stake);
  // The quoted prices already have the pot's slice taken out and are divided through by what the table returns, so
  // a spin pays exactly its drawn edge less the slice. The jackpot is paid as it stands: the edge never touches it.
  const multiplier = line.jackpot ? 0 : Math.round(priceFor(line) * edge * 10000) / 10000;
  const payout = line.jackpot ? jackpot : Math.round(stake * multiplier);

  try {
    await db
      .prepare(`INSERT INTO slots_spins (id, user_id, seed, hash, stake, reels, line, multiplier, payout, jackpot, edge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, user.id, commit.seed, commit.hash, stake, reels.join(","), line.key, multiplier, payout, jackpot, edge)
      .run();
  } catch (error) {
    if (voucher) { await reopenStake(db, voucher.id); return fail("BET_FAILED", "That didn't go through. Your ticket stake is still good: try again.", 500); }
    const refund = await moveBalance(context.env, user.login, stake);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", {
      balanceAfter: refund.ok ? refund.balance : null,
      error: `slots_insert_failed:${String(error?.message || "").slice(0, 120)}`
    });
    if (refund.ok) {
      await db
        .prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`)
        .bind(newId("op"), `REFUND:CASINO:SLOTS:BET:${id}`, user.id, stake, refund.balance)
        .run();
      return fail("SPIN_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }
    return fail("NEEDS_RECONCILIATION", "Something went wrong and your stake couldn't be returned automatically. A moderator has been notified.", 500);
  }

  if (!voucher) await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
  // The Daily Pot pays on a bet: this one may be the one that crosses
  // its line. Never lets the bet fail; the next bet tries again.
  await settlePot(context.env, db).catch(() => {});

  // The seed has now been used, so it is spent whatever happens next.
  const next = await rotateCommit(db, user.id);

  let balanceAfter = debit.balance;
  if (payout > 0) {
    const payId = newId("op");
    const begunPay = await beginOperation(db, {
      id: payId, idempotencyKey: `CASINO:SLOTS:PAY:${id}`, userId: user.id,
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

  if (jackpot) await noteJackpot(db, user.login, jackpot).catch(() => {});
  await touchPresence(db, SLOTS, user.id);
  const row = await db.prepare(`SELECT * FROM slots_spins WHERE id = ?`).bind(id).first();
  return json({ ok: true, spin: publicSpin(row), balance: balanceAfter, nextHash: next.hash, pot: await potNow(db) });
}
