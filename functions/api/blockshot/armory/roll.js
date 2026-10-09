/* POST /api/blockshot/armory/roll { case, zc? } — open a case (2026-10-10). In Brass, the price comes off the Blockshot wallet inside
   _armory.roll (refused when short). With `zc: true`, only the Knife Case, and the ZCoins go through the store's money path: a
   WAGER_DEBIT keyed ARMORY:ROLL:<user>:<n> so a double click cannot charge twice, refunded on the spot if the roll cannot be recorded. */
import { getSessionUser, walletWritesEnabled, moveBalance, beginOperation, finishOperation, retryKey, newId, json, fail } from "../../picks/_lib.js";
import { ensureArmory, roll, CASES } from "../_armory.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "No database.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_AUTHENTICATED", "Sign in to open a case.", 401);
  let body = {}; try { body = await context.request.json(); } catch { body = {}; }
  const caseKey = String(body.case || ""), c = CASES[caseKey];
  if (!c) return fail("CASE", "No such case.");
  await ensureArmory(db);
  if (!body.zc) { const r = await roll(db, user.id, caseKey); return r.ok ? json(r) : fail(r.code, r.code === "BRASS" ? "Not enough Brass." : "Could not roll.", 400, { brass: r.brass }); }
  if (!c.zc) return fail("ZC", "That case is Brass only.");
  if (!walletWritesEnabled(context.env)) return fail("WALLET_OFF", "ZCoin purchases are off right now.", 503);
  const opKey = await retryKey(db, `ARMORY:ROLL:${user.id}:${caseKey}`), opId = newId("op");
  await beginOperation(db, { id: opId, idempotencyKey: opKey, userId: user.id, marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -c.zc });
  const debit = await moveBalance(context.env, user.login, -c.zc);
  if (!debit.ok) { await finishOperation(db, opId, "FAILED", { error: debit.error }); return fail("BALANCE", debit.error === "INSUFFICIENT_FUNDS" ? "Not enough ZCoins." : "The wallet did not answer.", 402); }
  let r;
  try { r = await roll(db, user.id, caseKey, { zc: c.zc, opKey }); if (!r.ok) throw new Error(r.code); }
  catch (e) {
    const refund = await moveBalance(context.env, user.login, c.zc);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", { balanceAfter: refund.ok ? refund.balance : null, error: String(e?.message || e) });
    return fail("ROLL", "The roll could not be recorded; your ZCoins were returned.", 500);
  }
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
  return json({ ...r, balance: debit.balance });
}
