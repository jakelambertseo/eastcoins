/* POST /api/eastscape/exchange — called by the EastScape game server, never by a page.

   The two ways EastScape puts ZCoins into the world, on ONE hourly
   allowance per player (CAP_HOUR, the owner's backstop, 2026-09-19):

     STAKE    A TICKET STAKE: the player bets tickets at a real table,
              1,000 tickets standing in for 1 ZCoin (the rate lives in the
              game's rules file; the game server has ALREADY taken the
              tickets). This endpoint writes a voucher for N ZCoins
              (gamba_stakes, see _stake.js) that one ordinary bet may
              claim in place of a wallet debit. The games return about
              100%, so a ZCoin of vouchers is about a ZCoin minted: that
              is why vouchers are counted against the allowance when they
              are WRITTEN, by face.
     PAY      Banking ZCoins that dropped from a kill or a catch: a
              straight credit.

   (The Ruby scratch tickets and the Cash-for-ZCoins exchange that lived
   here until 2026-09-19 are gone: betting tickets is the conversion now.
   gamba_tickets is left in place, unread.)

   This is one of the few places on the site that makes ZCoins out of
   nothing, so the rules are the ones The Grind lives by:

     - The game server is the only caller, and proves it with ESCAPE_KEY
       (compared in constant time). It has ALREADY taken what the ask
       costs off the character before it asks.
     - THIS endpoint is the authority on the allowance. Credits are
       counted from wallet_operations (the ledger itself, so a stuck or
       pending payment still counts) and vouchers from gamba_stakes.
     - Every ask carries an id from the game server. A credit is paid
       under GAMBA:DEX:<id>; a voucher's id is its primary key. A retry
       after a timeout can never pay or write twice: a second ask for an
       id says what happened the first time.
     - A refusal says whether it is DEFINITE (nothing was or will be
       given: the game hands back what it took) or not (the outcome is
       unknown: the game keeps it aside and asks again later with the
       same id). The game never refunds on an unknown.
     - DAY_BREAKER is not a design limit, it is a fuse: if the whole site
       has somehow been given this much in a day, stop and let a person look.

   { op: "status", userId }              -> { ok, left, capHour, maxStake, open:[{id,zc}], enabled }
   { op: "pay", userId, id, zc }         -> { ok, zc, balance, left }     | { ok:false, code, definite, left? }
   { op: "stake", userId, id, zc }       -> { ok, voucher, zc, left }     | { ok:false, code, definite, left? }

   CAP_HOUR and MAX_STAKE mirror DEX in v3/assets/js/eastscape-shared.js.
   Change one, change the other; tools/dex-test.mjs fails if they drift. */

import { moveBalance, beginOperation, finishOperation, walletWritesEnabled, newId } from "../picks/_lib.js";
import { ensureBans, isBanned } from "../picks/_bans.js";
import { ensureStakes } from "./_stake.js";

export const CAP_HOUR = 50, MAX_STAKE = 20, DAY_BREAKER = 2000;   // MAX_STAKE: the casino's own 20 ZC a bet
const noStore = { "Cache-Control": "no-store" };
const say = (body, status = 200) => Response.json(body, { status, headers: noStore });

function keyOk(request, env) {
  const want = String(env.ESCAPE_KEY || "").trim(), got = String(request.headers.get("X-Escape-Key") || "").trim();
  if (!want || !got || want.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i += 1) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

/** ZCoins of this player's hourly allowance already spoken for: credits paid (or possibly paid), and ticket stakes written, by face. */
async function usedThisHour(db, userId) {
  const paid = await db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) AS n FROM wallet_operations
        WHERE user_id = ? AND idempotency_key >= 'GAMBA:DEX:' AND idempotency_key < 'GAMBA:DEX;'
          AND status IN ('CONFIRMED', 'PENDING', 'NEEDS_RECONCILIATION')
          AND created_at >= datetime('now', '-1 hour')`
    )
    .bind(userId)
    .first();
  const staked = await db.prepare(`SELECT COALESCE(SUM(zc), 0) AS n FROM gamba_stakes WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(paid?.n || 0) + Number(staked?.n || 0);
}

/** Credit `zc` under `key`, once. Returns { ok, balance } | { ok:false, definite }. */
async function credit(env, db, user, key, zc) {
  const prior = await db.prepare(`SELECT status, amount, balance_after FROM wallet_operations WHERE idempotency_key = ?`).bind(key).first();
  if (prior) {
    if (prior.status === "CONFIRMED") return { ok: true, duplicate: true, balance: prior.balance_after };
    if (prior.status === "FAILED") return { ok: false, code: "FAILED_BEFORE", definite: true };
    return { ok: false, code: "UNSETTLED", definite: false };
  }
  const opId = newId("op");
  const begun = await beginOperation(db, { id: opId, idempotencyKey: key, userId: user.twitch_id, marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: zc });
  if (!begun.ok) return { ok: false, code: "UNSETTLED", definite: false };   // two asks for one id in the same instant: the other one owns it
  const moved = await moveBalance(env, user.twitch_login, zc);
  if (!moved.ok) {
    // StreamElements did not confirm. It may or may not have landed, so this is NOT a definite no.
    await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: moved.error });
    return { ok: false, code: "WALLET_UNCONFIRMED", definite: false };
  }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: moved.balance });
  return { ok: true, balance: moved.balance };
}

export async function onRequestPost(context) {
  const { env, request } = context, db = env.PICKS_DB;
  if (!keyOk(request, env)) return say({ ok: false, code: "FORBIDDEN", definite: true }, 403);
  if (!db) return say({ ok: false, code: "NO_DB", definite: true }, 503);

  let body = {};
  try { body = await request.json(); } catch { body = {}; }
  const userId = String(body.userId || "");
  const user = userId ? await db.prepare(`SELECT twitch_id, twitch_login FROM users WHERE twitch_id = ?`).bind(userId).first() : null;
  if (!user) return say({ ok: false, code: "NO_USER", definite: true, message: "The Ruby doesn't know you. Log in to eastcoin.vip once and come back." }, 404);

  await ensureStakes(db);
  const used = await usedThisHour(db, userId), left = Math.max(0, CAP_HOUR - used);
  if (body.op === "status") {
    // vouchers written and never bet: the game hands one of these back rather than taking tickets again
    const open = await db.prepare(`SELECT id, zc FROM gamba_stakes WHERE user_id = ? AND status = 'OPEN' ORDER BY created_at LIMIT 20`).bind(userId).all();
    return say({ ok: true, left, capHour: CAP_HOUR, maxStake: MAX_STAKE, open: (open.results || []).map((r) => ({ id: r.id, zc: Number(r.zc) })), enabled: walletWritesEnabled(env) });
  }
  if (body.op !== "pay" && body.op !== "stake") return say({ ok: false, code: "BAD_OP", definite: true }, 400);

  const id = String(body.id || ""), isStake = body.op === "stake", zc = Math.floor(Number(body.zc));
  if (!/^[a-z0-9_-]{8,64}$/i.test(id) || !(zc >= 1 && zc <= (isStake ? MAX_STAKE : CAP_HOUR))) return say({ ok: false, code: "BAD_REQUEST", definite: true, left }, 400);

  // asked before? then say what happened the first time: nothing new is written, nothing new is paid
  if (isStake) {
    const row = await db.prepare(`SELECT zc, status FROM gamba_stakes WHERE id = ? AND user_id = ?`).bind(id, userId).first();
    if (row) return say({ ok: true, duplicate: true, voucher: id, zc: Number(row.zc), used: row.status === "USED", left });
  } else {
    const prior = await db.prepare(`SELECT status, amount, balance_after FROM wallet_operations WHERE idempotency_key = ?`).bind(`GAMBA:DEX:${id}`).first();
    if (prior) {
      if (prior.status === "CONFIRMED") return say({ ok: true, duplicate: true, zc: Number(prior.amount), balance: prior.balance_after, left });
      if (prior.status === "FAILED") return say({ ok: false, code: "FAILED_BEFORE", definite: true, left });
      return say({ ok: false, code: "UNSETTLED", definite: false, left });
    }
  }

  if (!walletWritesEnabled(env)) return say({ ok: false, code: "WALLET_NOT_CONFIGURED", definite: true, left, message: "ZCoin transfers aren't switched on right now." }, 503);
  await ensureBans(db);
  if (await isBanned(db, userId)) return say({ ok: false, code: "BANNED", definite: true, left }, 403);
  if (zc > left) return say({ ok: false, code: "CAP", definite: true, left, message: left ? `EastScape has ${left} ZCoin${left === 1 ? "" : "s"} of play left for you this hour.` : "That's your EastScape ZCoins for this hour. It refills as the hour rolls on." }, 429);
  const day = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM wallet_operations WHERE idempotency_key >= 'GAMBA:' AND idempotency_key < 'GAMBA;' AND status = 'CONFIRMED' AND created_at >= datetime('now', '-1 day')`).first();
  const dayStakes = await db.prepare(`SELECT COALESCE(SUM(zc), 0) AS n FROM gamba_stakes WHERE created_at >= datetime('now', '-1 day')`).first();
  if (Number(day?.n || 0) + Number(dayStakes?.n || 0) + zc > DAY_BREAKER) return say({ ok: false, code: "BREAKER", definite: true, left, message: "EastScape is out of ZCoins for today. A mod has been told." }, 429);

  if (isStake) {
    // the id is the primary key, so a second ask finds this row instead of writing another
    const put = await db.prepare(`INSERT OR IGNORE INTO gamba_stakes (id, user_id, zc) VALUES (?, ?, ?)`).bind(id, userId, zc).run();
    if (!put.meta?.changes) return say({ ok: false, code: "UNSETTLED", definite: false, left });
    return say({ ok: true, voucher: id, zc, left: left - zc });
  }

  const paid = await credit(env, db, user, `GAMBA:DEX:${id}`, zc);
  if (!paid.ok) return say({ ok: false, code: paid.code, definite: paid.definite, left }, paid.definite ? 409 : 502);
  return say({ ok: true, zc, balance: paid.balance, left: left - zc });
}
