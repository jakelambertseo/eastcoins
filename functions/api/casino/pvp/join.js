/* POST /api/casino/pvp/join  { game }

   Sits the caller down at the open lobby, opening one if there isn't
   one, and takes the 20 ZC buy-in there and then. The stake is fixed:
   there is no amount in the body and none is read. */

import { getSessionUser, walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, capCheck, MAX_BETS_PER_HOUR } from "../_engine.js";
import { ensurePvp, gameFor, settleDue, lobbyFor, openLobby, entriesFor, publicRound, joinsLastHour, STAKE, MAX_PLAYERS } from "./_pvp.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensurePvp(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const game = gameFor(body.game);
  if (!game) return fail("BAD_GAME", "Which table?");

  const now = Date.now();
  await touchPresence(db, game, user.id, now);
  // A lobby whose clock ran out while nobody was polling settles here,
  // so the caller never sits down at a table that has already played.
  await settleDue(context.env, db, game, now);

  if ((await joinsLastHour(db, game, user.id)) >= MAX_BETS_PER_HOUR) {
    return fail("RATE_LIMIT", `That's ${MAX_BETS_PER_HOUR} tables this hour — the limit. Back in a bit.`, 429);
  }
  const cap = await capCheck(db, user.id);
  if (cap.blocked) {
    return fail("WIN_CAP", `You're up ${cap.net.toLocaleString()} ZC this hour — that's the cap. The tables reopen for you as the hour rolls on.`, 429);
  }

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance.", 503);
  if (STAKE > balance) return fail("INSUFFICIENT_FUNDS", `The buy-in is ${STAKE} and you have ${balance.toLocaleString()}.`, 409);

  let lobby = await lobbyFor(db, game);
  if (!lobby) lobby = await openLobby(db, game, now);
  if (!lobby) return fail("NO_LOBBY", "Couldn't open a table. Try again.", 500);

  const seated = await entriesFor(db, lobby.id);
  if (seated.some((e) => e.user_id === String(user.id))) return fail("ALREADY_IN", "You're already at this table.", 409);
  if (seated.length >= MAX_PLAYERS) return fail("FULL", `The table is full at ${MAX_PLAYERS}. The next one opens when this plays.`, 409);

  const entryId = newId("pv");
  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId, idempotencyKey: `CASINO:PVP:JOIN:${entryId}`, userId: user.id,
    marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -STAKE
  });
  if (!begun.ok) return fail("DUPLICATE", "That seat is already being taken.", 409);

  const debit = await moveBalance(context.env, user.login, -STAKE);
  if (!debit.ok) {
    await finishOperation(db, opId, "FAILED", { error: debit.error });
    return fail("DEBIT_FAILED", "Couldn't take the buy-in from your balance. Nothing was charged.", 502);
  }

  try {
    await db
      .prepare(`INSERT INTO pvp_entries (id, round_id, game, user_id, stake, seat) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(entryId, lobby.id, game.key, user.id, STAKE, seated.length)
      .run();
  } catch (error) {
    // The seat was not written — the unique index says they are already
    // in, or the lobby closed under us. Give the buy-in straight back.
    const refund = await moveBalance(context.env, user.login, STAKE);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", {
      balanceAfter: refund.ok ? refund.balance : null,
      error: `pvp_insert_failed:${String(error?.message || "").slice(0, 120)}`
    });
    if (refund.ok) {
      await db
        .prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`)
        .bind(newId("op"), `REFUND:CASINO:PVP:JOIN:${entryId}`, user.id, STAKE, refund.balance)
        .run();
      return fail("JOIN_FAILED", "That didn't go through — your ZCoins were returned. Try again.", 500);
    }
    return fail("NEEDS_RECONCILIATION", "Something went wrong and your buy-in couldn't be returned automatically. A moderator has been notified.", 500);
  }

  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });

  const fresh = await lobbyFor(db, game);
  return json({
    ok: true,
    balance: debit.balance,
    lobby: fresh ? publicRound(fresh, await entriesFor(db, fresh.id), { viewerId: user.id }) : null
  });
}
