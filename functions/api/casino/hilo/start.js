/* POST /api/casino/hilo/start  { stake }

   Takes the stake, commits a deck, deals the first card. One live
   game per person; ten starts an hour; 1 to 20 ZC. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../../picks/_lib.js";
import { stakeFor, reopenStake, BAD_VOUCHER } from "../../eastscape/_stake.js";
import { settlePot } from "../_pot.js";
import { ensureSchema, touchPresence, capCheck } from "../_engine.js";
import { ensureHilo, cardAt, liveGameFor, gamesLastHour, publicGame, randomSeed, sha256, edgeFor, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_hilo.js";

const HILO = { key: "hilo" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensureHilo(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const stake = Math.floor(Number(body.stake));
  if (!Number.isFinite(stake) || stake < MIN_BET) return fail("BAD_WAGER", `Minimum is ${MIN_BET} ZCoin.`);
  if (stake > MAX_BET) return fail("BAD_WAGER", `Maximum is ${MAX_BET} ZCoins a game.`);

  if (await liveGameFor(db, user.id)) return fail("GAME_LIVE", "You already have a run going — cash out or bust first.", 409);
  if ((await gamesLastHour(db, user.id)) >= MAX_BETS_PER_HOUR) return fail("RATE_LIMIT", `That's ${MAX_BETS_PER_HOUR} games this hour — the limit. Back in a bit.`, 429);
  const cap = await capCheck(db, user.id);
  if (cap.blocked) return fail("WIN_CAP", `You're up ${cap.net.toLocaleString()} ZC this hour — that's the cap. The tables reopen for you as the hour rolls on.`, 429);

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  if (!body.voucher && stake > balance) return fail("INSUFFICIENT_FUNDS", `That's more than your ${balance.toLocaleString()} ZCoins.`, 409);

  const id = newId("hl");
  const seed = randomSeed();
  const hash = await sha256(seed);
  const first = await cardAt(seed, 0);

  /* A GambaScape TICKET STAKE (eastscape/_stake.js): the house put this one up, so no ZCoin leaves the wallet and no
     debit is written. Claimed here, after every limit above, so a refused bet never spends one. Everything after
     this point (the seed, the edge, the payout, the rows) is the same bet. */
  const voucher = await stakeFor(db, user.id, body, stake, `hilo:${id}`);
  if (voucher && !voucher.ok) return fail("BAD_VOUCHER", BAD_VOUCHER, 409);

  const opId = newId("op");
  const begun = voucher ? { ok: true } : await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:HILO:START:${id}`, userId: user.id,
    marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -stake
  });
  if (!begun.ok) return fail("DUPLICATE", "That game is already being started.", 409);

  const debit = voucher ? { ok: true, balance } : await moveBalance(context.env, user.login, -stake);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return fail("DEBIT_FAILED", "Couldn't take the stake from your balance. Nothing was charged.", 502);
  }

  try {
    await db
      .prepare(`INSERT INTO hilo_games (id, user_id, seed, hash, stake, cards, edge) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, user.id, seed, hash, stake, JSON.stringify([first]), await edgeFor(seed))
      .run();
  } catch (error) {
    if (voucher) { await reopenStake(db, voucher.id); return fail("BET_FAILED", "That didn't go through. Your ticket stake is still good: try again.", 500); }
    const refund = await moveBalance(context.env, user.login, stake);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", {
      balanceAfter: refund.ok ? refund.balance : null,
      error: `hilo_insert_failed:${String(error?.message || "").slice(0, 120)}`
    });
    if (refund.ok) {
      await db
        .prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`)
        .bind(newId("op"), `REFUND:CASINO:HILO:START:${id}`, user.id, stake, refund.balance)
        .run();
      return fail("START_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }
    return fail("NEEDS_RECONCILIATION", "Something went wrong and your stake couldn't be returned automatically. A moderator has been notified.", 500);
  }

  if (!voucher) await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
  // The Daily Pot pays on a bet: this one may be the one that crosses
  // its line. Never lets the bet fail; the next bet tries again.
  await settlePot(context.env, db).catch(() => {});
  await touchPresence(db, HILO, user.id);
  const game = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
  return json({ ok: true, game: publicGame(game), balance: debit.balance });
}
