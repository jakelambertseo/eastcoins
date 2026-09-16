/* ============================================================
   EastCoin — stuck ZCoin charges (admin)

     GET  /api/picks/admin/reconcile            every unfinished operation
     POST /api/picks/admin/reconcile { opId }   refund one stuck casino stake

   A stake is taken before its game row is written. If the request dies
   in between (a crash, a deploy mid-request) the operation is left
   PENDING with the coins gone and no game. This finds those and gives
   them back — once.

   A refund is only offered when BOTH hold:
     - the operation is a debit, unfinished, and more than two minutes
       old (so nothing still in flight is touched), and
     - the game row that debit would have created does not exist. If
       it does, the play happened and the stake was fairly spent.
   Anything else (a stuck payout, a pick, an unknown key) is listed to
   check by hand, never guessed at.

   Double refunds are impossible by construction: the refund's
   idempotency key is REFUND:<the original key>, and wallet_operations
   holds that key unique. If the credit itself fails, the refund row is
   left NEEDS_RECONCILIATION rather than retried blind, because a
   timeout can hide a credit that actually landed.
   ============================================================ */

import { ADMIN_ALLOWLIST, getSessionUser, walletWritesEnabled, moveBalance, beginOperation, finishOperation, newId, json, fail } from "../_lib.js";

const MIN_AGE_MS = 2 * 60 * 1000;

// Debit key -> the row it creates, so "did the game ever start" is a lookup.
const DEBITS = [
  { re: /^CASINO:SCRATCH:BET:(.+)$/, what: "Scratch-Off card", sql: `SELECT 1 FROM scratch_cards WHERE id = ?`, args: (m) => [m[1]] },
  { re: /^CASINO:MINES:START:(.+)$/, what: "Mines board", sql: `SELECT 1 FROM mines_games WHERE id = ?`, args: (m) => [m[1]] },
  { re: /^CASINO:HILO:START:(.+)$/, what: "Higher or Lower game", sql: `SELECT 1 FROM hilo_games WHERE id = ?`, args: (m) => [m[1]] },
  { re: /^CASINO:PLINKO:BET:(.+)$/, what: "Plinko drop", sql: `SELECT 1 FROM plinko_drops WHERE id = ?`, args: (m) => [m[1]] },
  { re: /^CASINO:PVP:JOIN:(.+)$/, what: "PvP table seat", sql: `SELECT 1 FROM pvp_entries WHERE id = ?`, args: (m) => [m[1]] },
  { re: /^COIN:BET:(\d+):(.+)$/, what: "Coin Flip bet", sql: `SELECT 1 FROM coin_bets WHERE round_no = ? AND user_id = ?`, args: (m) => [Number(m[1]), m[2]] },
  { re: /^CASINO:BET:([a-z]+):(\d+):(.+)$/, what: "Wheel/Race bet", sql: `SELECT 1 FROM casino_bets WHERE game = ? AND round_no = ? AND user_id = ?`, args: (m) => [m[1], Number(m[2]), m[3]] },
  { re: /^(STORE:BUY:.+)$/, what: "Store purchase", sql: `SELECT 1 FROM store_purchases WHERE op_key = ?`, args: (m) => [m[1]] }
];

const utc = (v) => (v ? String(v).replace(" ", "T") + (/Z$/.test(String(v)) ? "" : "Z") : null);

async function assess(db, op) {
  const key = String(op.idempotency_key || "");
  const age = Date.now() - new Date(utc(op.created_at)).getTime();
  const rule = DEBITS.find((d) => d.re.test(key));
  const base = {
    id: String(op.id), userId: String(op.user_id), login: op.twitch_login ? String(op.twitch_login).toLowerCase() : null,
    amount: Number(op.amount), status: String(op.status), type: String(op.type), key, createdAt: utc(op.created_at),
    what: rule ? rule.what : key.split(":").slice(0, 2).join(" ").toLowerCase() || "operation",
    refundable: false, why: ""
  };
  if (!rule) return { ...base, why: "Not a casino stake this tool knows how to check." };
  if (Number(op.amount) >= 0) return { ...base, why: "Not a debit." };
  if (age < MIN_AGE_MS) return { ...base, why: "Still in flight — check again in a couple of minutes." };
  if (!op.twitch_login) return { ...base, why: "No account found for this charge." };
  const existing = await db.prepare(rule.sql).bind(...rule.args(key.match(rule.re))).first().catch(() => undefined);
  if (existing === undefined) return { ...base, why: "Couldn't check whether the game exists." };
  if (existing) return { ...base, why: "The game was created, so the stake was spent. Finish it by hand if the row is wrong." };
  const refunded = await db.prepare(`SELECT status FROM wallet_operations WHERE idempotency_key = ?`).bind(`REFUND:${key}`).first();
  if (refunded) return { ...base, why: `A refund was already attempted (${refunded.status}).` };
  return { ...base, refundable: true, why: `The ${rule.what.toLowerCase()} was never created. Refunding returns ${Math.abs(Number(op.amount))} ZC.` };
}

async function list(db) {
  const rows = await db.prepare(
    `SELECT o.*, u.twitch_login FROM wallet_operations o LEFT JOIN users u ON u.twitch_id = o.user_id
      WHERE o.status IN ('PENDING','NEEDS_RECONCILIATION') ORDER BY o.created_at DESC LIMIT 50`
  ).all();
  return Promise.all((rows.results || []).map((op) => assess(db, op)));
}

async function gate(context) {
  const db = context.env.PICKS_DB;
  if (!db) return { error: fail("DB_UNAVAILABLE", "Picks database is not connected.", 503) };
  const admin = await getSessionUser(db, context.request);
  if (!admin || !ADMIN_ALLOWLIST.has(admin.login)) return { error: fail("NOT_ADMIN", "Only admins can reconcile ZCoin charges.", 403) };
  return { db, admin };
}

export async function onRequestGet(context) {
  const { db, error } = await gate(context);
  if (error) return error;
  return json({ ok: true, operations: await list(db) });
}

export async function onRequestPost(context) {
  const { db, admin, error } = await gate(context);
  if (error) return error;
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const opId = String(body.opId || "");
  const op = await db.prepare(
    `SELECT o.*, u.twitch_login FROM wallet_operations o LEFT JOIN users u ON u.twitch_id = o.user_id WHERE o.id = ?`
  ).bind(opId).first();
  if (!op) return fail("NOT_FOUND", "That charge doesn't exist.", 404);
  if (!["PENDING", "NEEDS_RECONCILIATION"].includes(String(op.status))) return fail("NOT_STUCK", "That charge already finished.", 409);

  const verdict = await assess(db, op);
  if (!verdict.refundable) return fail("NOT_REFUNDABLE", verdict.why, 409);

  const amount = Math.abs(Number(op.amount));
  const refundId = newId("op");
  const begun = await beginOperation(db, {
    id: refundId, idempotencyKey: `REFUND:${op.idempotency_key}`, userId: String(op.user_id),
    marketId: null, pickId: null, type: "COMPENSATING_REFUND", amount
  });
  if (!begun.ok) return fail("ALREADY_REFUNDED", "A refund for this charge already exists.", 409);

  const credit = await moveBalance(context.env, String(op.twitch_login), amount);
  if (!credit.ok) {
    await finishOperation(db, refundId, "NEEDS_RECONCILIATION", { error: `admin_refund_credit_failed:${credit.error}` });
    return fail("CREDIT_FAILED", "StreamElements didn't confirm the credit. Check their balance before trying anything else — it may have landed.", 502);
  }
  await finishOperation(db, refundId, "CONFIRMED", { balanceAfter: credit.balance });
  await finishOperation(db, String(op.id), "FAILED", { error: `refunded_by_admin:${admin.login}:${refundId}` });
  console.log(`Reconcile: ${admin.login} refunded ${amount} ZC to ${op.twitch_login} for ${op.idempotency_key}`);

  return json({
    ok: true,
    message: `Refunded ${amount} ZC to ${op.twitch_login}${Number.isFinite(credit.balance) ? ` (balance now ${credit.balance.toLocaleString()})` : ""}.`,
    operations: await list(db)
  });
}
