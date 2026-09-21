/* POST /api/casino/scratch/buy  { stake }

   Takes the stake, decides the card from the seed this player had
   committed, pays whatever it matched, and commits a fresh seed for
   their next card. Ten cards an hour; 1 to 20 ZC. The page then
   lets them scratch a card that is already settled. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../../picks/_lib.js";
import { stakeFor, reopenStake, BAD_VOUCHER } from "../../eastscape/_stake.js";
import { settlePot } from "../_pot.js";
import { ensureSchema, touchPresence, capCheck } from "../_engine.js";
import { ensureScratch, claimCommit, outcomeFor, gridFor, publicCard, cardsLastHour, edgeFor, RETURN, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_scratch.js";

const SCRATCH = { key: "scratch" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensureScratch(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const stake = Math.floor(Number(body.stake));
  if (!Number.isFinite(stake) || stake < MIN_BET) return fail("BAD_WAGER", `Minimum is ${MIN_BET} ZCoin.`);
  if (stake > MAX_BET) return fail("BAD_WAGER", `Maximum is ${MAX_BET} ZCoins a card.`);

  if ((await cardsLastHour(db, user.id)) >= MAX_BETS_PER_HOUR) return fail("RATE_LIMIT", `That's ${MAX_BETS_PER_HOUR} cards this hour — the limit. Back in a bit.`, 429);
  const cap = await capCheck(db, user.id);
  if (cap.blocked) return fail("WIN_CAP", `You're up ${cap.net.toLocaleString()} ZC this hour — that's the cap. The tables reopen for you as the hour rolls on.`, 429);

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  if (!body.voucher && stake > balance) return fail("INSUFFICIENT_FUNDS", `That's more than your ${balance.toLocaleString()} ZCoins.`, 409);

  /* The seed whose hash this player was already shown — TAKEN here, not merely read, so two cards bought together cannot
     share it and a burst cannot walk past the hourly limit or the win cap. See claimCommit in _scratch.js. */
  const claim = await claimCommit(db, user.id);
  if (!claim) return fail("CARD_BUSY", "One card at a time — that one is still going. Try again in a moment.", 409);
  const commit = claim.used;

  const id = newId("sc");
  /* A GambaScape TICKET STAKE (eastscape/_stake.js): the house put this one up, so no ZCoin leaves the wallet and no
     debit is written. Claimed here, after every limit above, so a refused bet never spends one. Everything after
     this point (the seed, the edge, the payout, the rows) is the same bet. */
  const voucher = await stakeFor(db, user.id, body, stake, `scratch:${id}`);
  if (voucher && !voucher.ok) return fail("BAD_VOUCHER", BAD_VOUCHER, 409);

  const opId = newId("op");
  const begun = voucher ? { ok: true } : await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:SCRATCH:BET:${id}`, userId: user.id,
    marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -stake
  });
  if (!begun.ok) return fail("DUPLICATE", "That card is already being bought.", 409);

  const debit = voucher ? { ok: true, balance } : await moveBalance(context.env, user.login, -stake);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return fail("DEBIT_FAILED", "Couldn't take the stake from your balance. Nothing was charged.", 502);
  }

  const prize = await outcomeFor(commit.seed);
  const grid = await gridFor(commit.seed, prize);
  // The prize table keeps its shape; the prices are divided through by
  // what it returns on its own so the card pays exactly its drawn edge.
  const edge = await edgeFor(commit.seed);
  const multiplier = prize ? Math.round((prize.x * edge / RETURN) * 10000) / 10000 : 0;
  const payout = prize ? Math.round(stake * multiplier) : 0;

  try {
    await db
      .prepare(`INSERT INTO scratch_cards (id, user_id, seed, hash, stake, prize, multiplier, grid, payout, edge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, user.id, commit.seed, commit.hash, stake, prize ? prize.key : null, multiplier, JSON.stringify(grid), payout, edge)
      .run();
  } catch (error) {
    if (voucher) { await reopenStake(db, voucher.id); return fail("BET_FAILED", "That didn't go through. Your ticket stake is still good: try again.", 500); }
    const refund = await moveBalance(context.env, user.login, stake);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", {
      balanceAfter: refund.ok ? refund.balance : null,
      error: `scratch_insert_failed:${String(error?.message || "").slice(0, 120)}`
    });
    if (refund.ok) {
      await db
        .prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`)
        .bind(newId("op"), `REFUND:CASINO:SCRATCH:BET:${id}`, user.id, stake, refund.balance)
        .run();
      return fail("CARD_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }
    return fail("NEEDS_RECONCILIATION", "Something went wrong and your stake couldn't be returned automatically. A moderator has been notified.", 500);
  }

  if (!voucher) await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
  // The Daily Jackpot pays on a bet: this may be the one that crosses
  // its line. Never lets the buy fail; the next bet tries again.
  await settlePot(context.env, db).catch(() => {});

  const next = claim.next;   // taken together with the seed, above

  let balanceAfter = debit.balance;
  if (payout > 0) {
    const payId = newId("op");
    const begunPay = await beginOperation(db, {
      id: payId, idempotencyKey: `CASINO:SCRATCH:PAY:${id}`, userId: user.id,
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

  await touchPresence(db, SCRATCH, user.id);
  const row = await db.prepare(`SELECT * FROM scratch_cards WHERE id = ?`).bind(id).first();
  return json({ ok: true, card: publicCard(row), balance: balanceAfter, nextHash: next.hash });
}
