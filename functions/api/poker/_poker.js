/* EastCoin Poker's money (designed 2026-10-13 with the owner; see POKER-GDD.md §6a). NOT WIRED TO THE DEALER YET.

   ZCoins stay in StreamElements and move only through the wallet ledger (wallet_operations). The dealer never holds ZCoins; the page
   never touches them. A chip at the table is a claim on ZCoins at the table's ratio. Three moves exist, each one idempotent ledger row:

     buy-in   ZC -> chips at a seat        WAGER_DEBIT   POKER:BUY:<session>          (the dealer asks, with the arcade key)
     add-on   ZC -> more chips at a seat   WAGER_DEBIT   POKER:ADD:<session>:<n>      (between hands, up to the table maximum)
     exchange chip bank -> ZC              PAYOUT_CREDIT POKER:OUT:<user>:<n>         (the member asks, from their chip bank)

   Cash-out (standing up, eviction, a reset) moves the stack into the member's CHIP BANK (poker_banks) — never straight to ZCoins,
   because ZCoins are whole and chips are fives (1,230 chips at 200/ZC is 6.15 ZC). The bank keeps the odd chips; the exchange is in
   whole ZC; a buy-in draws from the bank first, then ZCoins. Zero-sum, no rake, outside HOUR_WIN_CAP (the owner's decisions): what
   protects people is DAY_BUYIN_ZC, four full buy-ins a Chicago day. The books must balance to the chip:
   buy-ins + add-ons = cash-outs + chips on the table + every chip bank. */

import { readBalance, moveBalance, beginOperation, finishOperation, opDone, retryKey, newId, safeEqual } from "../picks/_lib.js";
import { chicagoDay } from "../casino/_pot.js";

export const TABLES = { nickel: { name: "Nickel", chipsPerZc: 200, dayBuyinZc: 20 } };   // Nickel only at launch (the owner, 2026-10-13)
export const CHIP = 5, MIN_BUY = 200, MAX_BUY = 1000;

let ready = false;
export async function ensurePoker(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS poker_banks (user_id TEXT PRIMARY KEY, chips INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS poker_sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, table_key TEXT NOT NULL, ratio INTEGER NOT NULL,
      buyin_chips INTEGER NOT NULL, buyin_zc INTEGER NOT NULL, addon_chips INTEGER NOT NULL DEFAULT 0, addon_zc INTEGER NOT NULL DEFAULT 0,
      cashout_chips INTEGER, status TEXT NOT NULL DEFAULT 'OPEN', day TEXT NOT NULL,
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at TEXT)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_poker_sessions_user_day ON poker_sessions (user_id, day)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS poker_exchanges (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, chips INTEGER NOT NULL, zc INTEGER NOT NULL, op_key TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS poker_buys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, zc INTEGER NOT NULL, chips INTEGER NOT NULL, day TEXT NOT NULL, op_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_poker_buys_user_day ON poker_buys (user_id, day)`)
  ]);
  ready = true;
}

/** The dealer proves itself with the arcade key (the same secret CS67's results use). */
export function fromDealer(context) {
  const want = String(context.env.ARCADE_KEY || "").trim(), got = String(context.request.headers.get("X-Arcade-Key") || "").trim();
  return Boolean(want) && got.length === want.length && safeEqual(got, want);
}

export async function bankOf(db, userId) { const r = await db.prepare(`SELECT chips FROM poker_banks WHERE user_id = ?`).bind(userId).first(); return Number(r?.chips || 0); }
async function setBank(db, userId, chips) { await db.prepare(`INSERT INTO poker_banks (user_id, chips, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET chips = excluded.chips, updated_at = CURRENT_TIMESTAMP`).bind(userId, chips).run(); }
async function userRow(db, userId) { return db.prepare(`SELECT twitch_id, twitch_login, display_name FROM users WHERE twitch_id = ?`).bind(userId).first(); }
export async function spentToday(db, userId, day) { const r = await db.prepare(`SELECT COALESCE(SUM(buyin_zc + addon_zc), 0) AS zc FROM poker_sessions WHERE user_id = ? AND day = ?`).bind(userId, day).first(); const b = await db.prepare(`SELECT COALESCE(SUM(zc), 0) AS zc FROM poker_buys WHERE user_id = ? AND day = ?`).bind(userId, day).first(); return Number(r?.zc || 0) + Number(b?.zc || 0); }

/** ZCoins -> chips in the bank (the Bank panel's "Buy chips"): whole ZC, the day limit, one ledger row. */
export async function buyChips(env, db, { userId, zc, tableKey = "nickel" }) {
  const T = TABLES[tableKey]; zc = Math.floor(Number(zc)); if (!Number.isFinite(zc) || zc <= 0) return { ok: false, code: "BAD_ZC", message: "How many ZCoins?" };
  const user = await userRow(db, userId); if (!user) return { ok: false, code: "NO_USER", message: "Who?" };
  const day = chicagoDay(Date.now()); const spent = await spentToday(db, userId, day); if (spent + zc > T.dayBuyinZc) return { ok: false, code: "DAY_LIMIT", message: `The ${T.name} table takes ${T.dayBuyinZc} ZC a day and you have put in ${spent}.` };
  const balance = await readBalance(env, user.twitch_login); if (balance === null) return { ok: false, code: "BALANCE_UNAVAILABLE", message: "Couldn't read your ZCoin balance." };
  if (zc > balance) return { ok: false, code: "INSUFFICIENT_FUNDS", message: `That is ${zc} ZC and you have ${balance}.` };
  const chips = zc * T.chipsPerZc, opKey = await retryKey(db, `POKER:BANK:${userId}`), opId = newId("op");
  const begun = await beginOperation(db, { id: opId, idempotencyKey: opKey, userId, marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -zc });
  if (!begun.ok) return { ok: false, code: "DUPLICATE", message: "That purchase is already going through." };
  const debit = await moveBalance(env, user.twitch_login, -zc);
  if (!debit.ok) { await finishOperation(db, opId, "FAILED", { error: debit.error }); return { ok: false, code: "DEBIT_FAILED", message: "Couldn't take the ZCoins. Nothing was charged." }; }
  const bank = await bankOf(db, userId);
  try { await db.batch([db.prepare(`INSERT INTO poker_buys (id, user_id, zc, chips, day, op_key) VALUES (?, ?, ?, ?, ?, ?)`).bind(newId("pb"), userId, zc, chips, day, opKey), db.prepare(`INSERT INTO poker_banks (user_id, chips, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET chips = excluded.chips, updated_at = CURRENT_TIMESTAMP`).bind(userId, bank + chips)]); }
  catch (error) { const refund = await moveBalance(env, user.twitch_login, zc); await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", { balanceAfter: refund.ok ? refund.balance : null, error: `poker_buy_failed:${String(error?.message || "").slice(0, 120)}` }); if (refund.ok) await db.prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`).bind(newId("op"), `REFUND:${opKey}`, userId, zc, refund.balance).run().catch(() => {}); return { ok: false, code: refund.ok ? "BUY_FAILED" : "NEEDS_RECONCILIATION", message: refund.ok ? "That didn't go through — your ZCoins were returned." : "Something went wrong; an admin can see it." }; }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
  return { ok: true, zc, chips, bank: bank + chips, balance: debit.balance };
}

/** Chips to a seat: the bank first, then whole ZCoins at the ratio (the surplus chips of the last ZC go to the bank). */
export async function buyIn(env, db, { userId, tableKey, chips, sessionId, addon = false }) {
  const T = TABLES[tableKey]; if (!T) return { ok: false, code: "BAD_TABLE", message: "No such table." };
  chips = Math.floor(Number(chips)); if (!Number.isFinite(chips) || chips <= 0 || chips % CHIP) return { ok: false, code: "BAD_CHIPS", message: `Chips come in ${CHIP}s.` };
  const session = await db.prepare(`SELECT * FROM poker_sessions WHERE id = ?`).bind(sessionId).first();
  if (!addon) { if (chips < MIN_BUY || chips > MAX_BUY) return { ok: false, code: "BAD_BUY", message: `Buy in for ${MIN_BUY} to ${MAX_BUY} chips.` }; if (session) return { ok: session.status === "OPEN", duplicate: true, code: session.status === "OPEN" ? undefined : "SESSION_CLOSED", chips: session.buyin_chips, zc: session.buyin_zc, bank: await bankOf(db, userId) }; }
  else { if (!session || session.status !== "OPEN" || session.user_id !== userId) return { ok: false, code: "NO_SESSION", message: "No open seat to add to." }; if (session.buyin_chips + session.addon_chips + chips > MAX_BUY * 4) return { ok: false, code: "TOO_MUCH", message: "That is more than the table takes." }; }
  const user = await userRow(db, userId); if (!user) return { ok: false, code: "NO_USER", message: "Who?" };
  const day = chicagoDay(Date.now());
  const bank = await bankOf(db, userId); const fromBank = Math.min(bank, chips); const need = chips - fromBank;
  const zc = need > 0 ? Math.ceil(need / T.chipsPerZc) : 0; const bought = zc * T.chipsPerZc; const surplus = bought - need;
  if (zc > 0) {
    const spent = await spentToday(db, userId, day); if (spent + zc > T.dayBuyinZc) return { ok: false, code: "DAY_LIMIT", message: `The ${T.name} table takes ${T.dayBuyinZc} ZC a day and you have put in ${spent}.` };
    const balance = await readBalance(env, user.twitch_login); if (balance === null) return { ok: false, code: "BALANCE_UNAVAILABLE", message: "Couldn't read your ZCoin balance." };
    if (zc > balance) return { ok: false, code: "INSUFFICIENT_FUNDS", message: `That needs ${zc} ZC and you have ${balance}.` };
    const base = addon ? `POKER:ADD:${sessionId}` : `POKER:BUY:${sessionId}`; const opKey = await retryKey(db, base); const opId = newId("op");
    const begun = await beginOperation(db, { id: opId, idempotencyKey: opKey, userId, marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -zc });
    if (!begun.ok) return { ok: false, code: "DUPLICATE", message: "That buy-in is already going through." };
    const debit = await moveBalance(env, user.twitch_login, -zc);
    if (!debit.ok) { await finishOperation(db, opId, "FAILED", { error: debit.error }); return { ok: false, code: "DEBIT_FAILED", message: "Couldn't take the ZCoins. Nothing was charged." }; }
    try {
      await db.batch([
        addon ? db.prepare(`UPDATE poker_sessions SET addon_chips = addon_chips + ?, addon_zc = addon_zc + ? WHERE id = ?`).bind(chips, zc, sessionId)
              : db.prepare(`INSERT INTO poker_sessions (id, user_id, table_key, ratio, buyin_chips, buyin_zc, day) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(sessionId, userId, tableKey, T.chipsPerZc, chips, zc, day),
        db.prepare(`INSERT INTO poker_banks (user_id, chips, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET chips = excluded.chips, updated_at = CURRENT_TIMESTAMP`).bind(userId, bank - fromBank + surplus)
      ]);
    } catch (error) {
      const refund = await moveBalance(env, user.twitch_login, zc);
      await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", { balanceAfter: refund.ok ? refund.balance : null, error: `poker_insert_failed:${String(error?.message || "").slice(0, 120)}` });
      if (refund.ok) await db.prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`).bind(newId("op"), `REFUND:${opKey}`, userId, zc, refund.balance).run().catch(() => {});
      return { ok: false, code: refund.ok ? "BUY_FAILED" : "NEEDS_RECONCILIATION", message: refund.ok ? "That didn't go through — your ZCoins were returned." : "Something went wrong; an admin can see it." };
    }
    await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
    return { ok: true, chips, zc, fromBank, bank: bank - fromBank + surplus, balance: debit.balance };
  }
  // the bank covers it: no ZCoins move
  await db.batch([
    addon ? db.prepare(`UPDATE poker_sessions SET addon_chips = addon_chips + ? WHERE id = ?`).bind(chips, sessionId)
          : db.prepare(`INSERT INTO poker_sessions (id, user_id, table_key, ratio, buyin_chips, buyin_zc, day) VALUES (?, ?, ?, ?, ?, 0, ?)`).bind(sessionId, userId, tableKey, T.chipsPerZc, chips, day),
    db.prepare(`UPDATE poker_banks SET chips = chips - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`).bind(fromBank, userId)
  ]);
  return { ok: true, chips, zc: 0, fromBank, bank: bank - fromBank, balance: null };
}

/** The stack comes off the table into the chip bank. Idempotent per session: a second call is a no-op. */
export async function cashOut(db, { sessionId, chips }) {
  const s = await db.prepare(`SELECT * FROM poker_sessions WHERE id = ?`).bind(sessionId).first();
  if (!s) return { ok: false, code: "NO_SESSION", message: "No such seat." };
  if (s.status === "CLOSED") return { ok: true, duplicate: true, chips: s.cashout_chips, bank: await bankOf(db, s.user_id) };
  chips = Math.floor(Number(chips)); if (!Number.isFinite(chips) || chips < 0) return { ok: false, code: "BAD_CHIPS", message: "How many?" };
  const bank = await bankOf(db, s.user_id);
  await db.batch([
    db.prepare(`UPDATE poker_sessions SET cashout_chips = ?, status = 'CLOSED', closed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'OPEN'`).bind(chips, sessionId),
    db.prepare(`INSERT INTO poker_banks (user_id, chips, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET chips = excluded.chips, updated_at = CURRENT_TIMESTAMP`).bind(s.user_id, bank + chips)
  ]);
  return { ok: true, chips, bank: bank + chips };
}

/** Chip bank -> ZCoins, whole ZC at the ratio. The bank is taken first, so a failed credit can never be spent twice; it waits for an admin. */
export async function exchange(env, db, { userId, zc, tableKey = "nickel" }) {
  const T = TABLES[tableKey]; zc = Math.floor(Number(zc)); if (!Number.isFinite(zc) || zc <= 0) return { ok: false, code: "BAD_ZC", message: "How many ZCoins?" };
  const chips = zc * T.chipsPerZc; const bank = await bankOf(db, userId);
  if (chips > bank) return { ok: false, code: "NOT_ENOUGH_CHIPS", message: `${zc} ZC is ${chips} chips and your bank holds ${bank}.` };
  const user = await userRow(db, userId); if (!user) return { ok: false, code: "NO_USER" };
  const base = `POKER:OUT:${userId}`, opKey = await retryKey(db, base), exId = newId("px");
  await db.batch([
    db.prepare(`UPDATE poker_banks SET chips = chips - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND chips >= ?`).bind(chips, userId, chips),
    db.prepare(`INSERT INTO poker_exchanges (id, user_id, chips, zc, op_key, status) VALUES (?, ?, ?, ?, ?, 'PENDING')`).bind(exId, userId, chips, zc, opKey)
  ]);
  const opId = newId("op");
  const begun = await beginOperation(db, { id: opId, idempotencyKey: opKey, userId, marketId: null, pickId: null, type: "PAYOUT_CREDIT", amount: zc });
  if (!begun.ok) { await db.prepare(`UPDATE poker_exchanges SET status = 'NEEDS_RECONCILIATION' WHERE id = ?`).bind(exId).run(); return { ok: false, code: "DUPLICATE", message: "That exchange is already going through." }; }
  const moved = await moveBalance(env, user.twitch_login, zc);
  if (!moved.ok) { await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: moved.error }); await db.prepare(`UPDATE poker_exchanges SET status = 'NEEDS_RECONCILIATION' WHERE id = ?`).bind(exId).run(); return { ok: false, code: "CREDIT_FAILED", message: "The chips left your bank but the ZCoins did not arrive; an admin can see it and will pay it." }; }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: moved.balance }); await db.prepare(`UPDATE poker_exchanges SET status = 'PAID' WHERE id = ?`).bind(exId).run();
  return { ok: true, zc, chips, bank: bank - chips, balance: moved.balance };
}

/** The books, for the dashboard: must balance to the chip. */
export async function books(db) {
  /* The identity: every ZC spent MINTS ratio chips, every exchange BURNS chips; what exists is on the table (buy-ins less cash-outs,
     zero-sum) or in a bank. minted = onTable + banks + burned (paid or stuck). A mismatch is a bug, never rounding. */
  const s = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(buyin_chips + addon_chips), 0) AS chips_in, COALESCE(SUM(buyin_zc + addon_zc), 0) AS zc_in, COALESCE(SUM((buyin_zc + addon_zc) * ratio), 0) AS minted, COALESCE(SUM(CASE WHEN status = 'CLOSED' THEN cashout_chips ELSE 0 END), 0) AS chips_out, SUM(CASE WHEN status = 'OPEN' THEN 1 ELSE 0 END) AS open FROM poker_sessions`).first();
  const b = await db.prepare(`SELECT COALESCE(SUM(chips), 0) AS chips FROM poker_banks`).first();
  const x = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN status = 'PAID' THEN zc ELSE 0 END), 0) AS zc_out, COALESCE(SUM(CASE WHEN status = 'PAID' THEN chips ELSE 0 END), 0) AS chips_paid, COALESCE(SUM(CASE WHEN status = 'NEEDS_RECONCILIATION' THEN chips ELSE 0 END), 0) AS chips_stuck, SUM(CASE WHEN status = 'NEEDS_RECONCILIATION' THEN 1 ELSE 0 END) AS stuck FROM poker_exchanges`).first();
  const pb = await db.prepare(`SELECT COALESCE(SUM(chips), 0) AS chips, COALESCE(SUM(zc), 0) AS zc FROM poker_buys`).first();
  const onTable = Number(s?.chips_in || 0) - Number(s?.chips_out || 0), banks = Number(b?.chips || 0), burned = Number(x?.chips_paid || 0) + Number(x?.chips_stuck || 0), minted = Number(s?.minted || 0) + Number(pb?.chips || 0);
  return { sessions: Number(s?.n || 0), open: Number(s?.open || 0), zcIn: Number(s?.zc_in || 0) + Number(pb?.zc || 0), zcOut: Number(x?.zc_out || 0), minted, onTable, banks, burned, stuck: Number(x?.stuck || 0), balanced: minted === onTable + banks + burned };
}
