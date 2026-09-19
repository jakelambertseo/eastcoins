/* POST /api/eastscape/exchange — called by the GambaScape game server, never by a page.

   The House Ruby: a player turns the Cash they earned in the game into
   real ZCoins. Two ways, both on ONE hourly allowance (the owner's
   number, 2026-09-20: "roughly 25 max"):

     ZCOINS   $100 of Cash for 1 ZCoin, straight.
     TICKET   $500 for a Ruby ticket with a FACE of 5 ZCoins: a scratch
              reveal that pays 25, 10, 5, 2 or nothing (TICKET.table,
              86% of face back on average, so a ticket is never a
              better deal than the straight rate — it is the same money
              with a story). A ticket uses 5 of the hour's 25 whatever
              it pays, so the allowance bounds what the machine gives
              out ON AVERAGE at 25 an hour a head, and no single ticket
              can pay more than one hour's allowance.

   This is one of the few places on the site that makes ZCoins out of
   nothing, so the rules are the ones The Grind lives by:

     - The game server is the only caller, and proves it with ESCAPE_KEY
       (the shared key the ban kick and the backup use, compared in
       constant time). It has ALREADY taken the Cash off the character
       before it asks.
     - THIS endpoint is the authority on the allowance. Straight
       exchanges are counted from wallet_operations — the ledger itself,
       so a stuck or pending payment still counts — and tickets from
       gamba_tickets by face value.
     - Every ask carries an id from the game server. A straight exchange
       is paid under GAMBA:DEX:<id>; a ticket is ROLLED ONCE into
       gamba_tickets (the id is its primary key) and paid under
       GAMBA:TICKET:<id>. A retry after a timeout can never pay twice or
       roll again: a second ask for an id says what happened the first time.
     - A refusal says whether it is DEFINITE (nothing was or will be
       paid: the game gives the Cash back) or not (the outcome is
       unknown: the game keeps the Cash aside and asks again later with
       the same id). The game never refunds on an unknown.
     - DAY_BREAKER is not a design limit, it is a fuse: if the whole site
       has somehow been paid this much in a day, stop and let a person look.

   { op: "status", userId }              -> { ok, left, capHour, rate, ticket, enabled }
   { op: "pay", userId, id, zc }         -> { ok, zc, balance, left }            | { ok:false, code, definite, left? }
   { op: "ticket", userId, id }          -> { ok, prize, face, balance, left }   | { ok:false, code, definite, left? }

   RATE, CAP_HOUR and TICKET mirror DEX in v3/assets/js/eastscape-shared.js
   (the page and the game server read that one). Change one, change the
   other; tools/dex-test.mjs fails if they drift. */

import { moveBalance, beginOperation, finishOperation, walletWritesEnabled, newId } from "../picks/_lib.js";
import { ensureBans, isBanned } from "../picks/_bans.js";

export const RATE = 100, CAP_HOUR = 25, DAY_BREAKER = 2000;
// [ZCoins paid, chances in 100]. 25*4 + 10*12 + 5*30 + 2*30 = 430 over 100 tickets of face 5: 86%.
export const TICKET = { face: 5, table: [[25, 4], [10, 12], [5, 30], [2, 30], [0, 24]] };
const noStore = { "Cache-Control": "no-store" };
const say = (body, status = 200) => Response.json(body, { status, headers: noStore });

function keyOk(request, env) {
  const want = String(env.ESCAPE_KEY || "").trim(), got = String(request.headers.get("X-Escape-Key") || "").trim();
  if (!want || !got || want.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i += 1) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

let ticketsReady = false;
async function ensureTickets(db) {
  if (ticketsReady) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS gamba_tickets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, face INTEGER NOT NULL, prize INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_gamba_tickets_user ON gamba_tickets (user_id, created_at)`).run();
  ticketsReady = true;
}

/** ZCoins of this player's hourly allowance already spoken for: straight exchanges paid (or possibly paid), and tickets by face. */
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
  const faces = await db.prepare(`SELECT COALESCE(SUM(face), 0) AS n FROM gamba_tickets WHERE user_id = ? AND created_at >= datetime('now', '-1 hour')`).bind(userId).first();
  return Number(paid?.n || 0) + Number(faces?.n || 0);
}

/** One roll of the ticket table, from the platform's own randomness. */
function rollTicket() {
  const total = TICKET.table.reduce((a, [, w]) => a + w, 0);
  let r = crypto.getRandomValues(new Uint32Array(1))[0] % total;   // total is 100: 2^32 mod 100 is 96, a bias of one part in forty million
  for (const [zc, w] of TICKET.table) { if (r < w) return zc; r -= w; }
  return 0;
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

  await ensureTickets(db);
  const used = await usedThisHour(db, userId), left = Math.max(0, CAP_HOUR - used);
  if (body.op === "status") return say({ ok: true, left, capHour: CAP_HOUR, rate: RATE, ticket: TICKET, enabled: walletWritesEnabled(env) });
  if (body.op !== "pay" && body.op !== "ticket") return say({ ok: false, code: "BAD_OP", definite: true }, 400);

  const id = String(body.id || ""), isTicket = body.op === "ticket", zc = isTicket ? TICKET.face : Math.floor(Number(body.zc));
  if (!/^[a-z0-9_-]{8,64}$/i.test(id) || !(zc >= 1 && zc <= CAP_HOUR)) return say({ ok: false, code: "BAD_REQUEST", definite: true, left }, 400);

  // asked before? then say what happened the first time: nothing new is rolled, nothing new is paid
  if (isTicket) {
    const row = await db.prepare(`SELECT prize, face FROM gamba_tickets WHERE id = ? AND user_id = ?`).bind(id, userId).first();
    if (row) {
      if (!Number(row.prize)) return say({ ok: true, duplicate: true, prize: 0, face: Number(row.face), left });
      const paid = await credit(env, db, user, `GAMBA:TICKET:${id}`, Number(row.prize));
      return paid.ok ? say({ ok: true, duplicate: true, prize: Number(row.prize), face: Number(row.face), balance: paid.balance, left }) : say({ ok: false, code: paid.code, definite: false, left }, 502);   // it WAS rolled: never a definite no
    }
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
  if (zc > left) return say({ ok: false, code: "CAP", definite: true, left, message: left ? `The Ruby has ${left} ZCoin${left === 1 ? "" : "s"} left for you this hour.` : "That's your ZCoins for this hour. It refills as the hour rolls on." }, 429);
  const day = await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS n FROM wallet_operations WHERE idempotency_key >= 'GAMBA:' AND idempotency_key < 'GAMBA;' AND status = 'CONFIRMED' AND created_at >= datetime('now', '-1 day')`).first();
  if (Number(day?.n || 0) + (isTicket ? TICKET.table[0][0] : zc) > DAY_BREAKER) return say({ ok: false, code: "BREAKER", definite: true, left, message: "The Ruby is out of ZCoins for today. A mod has been told." }, 429);

  if (isTicket) {
    // rolled ONCE, and written down before a coin moves: the id is the primary key, so a second ask finds this row
    const prize = rollTicket();
    const put = await db.prepare(`INSERT OR IGNORE INTO gamba_tickets (id, user_id, face, prize) VALUES (?, ?, ?, ?)`).bind(id, userId, TICKET.face, prize).run();
    if (!put.meta?.changes) return say({ ok: false, code: "UNSETTLED", definite: false, left });
    if (!prize) return say({ ok: true, prize: 0, face: TICKET.face, left: left - TICKET.face });
    const paid = await credit(env, db, user, `GAMBA:TICKET:${id}`, prize);
    if (!paid.ok) return say({ ok: false, code: paid.code, definite: false, left: left - TICKET.face }, 502);
    return say({ ok: true, prize, face: TICKET.face, balance: paid.balance, left: left - TICKET.face });
  }

  const paid = await credit(env, db, user, `GAMBA:DEX:${id}`, zc);
  if (!paid.ok) return say({ ok: false, code: paid.code, definite: paid.definite, left }, paid.definite ? 409 : 502);
  return say({ ok: true, zc, balance: paid.balance, left: left - zc });
}
