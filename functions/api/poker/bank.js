/* GET  /api/poker/bank — the member's chip bank, what they have put in today, and their ZCoin balance (private: only to its owner)
   POST /api/poker/bank { zc } — exchange whole ZCoins out of the chip bank at the table's ratio. NOT WIRED YET (see _poker.js). */
import { json, fail, readBalance } from "../picks/_lib.js";
import { requireLogin } from "../screen/_gate.js";
import { ensurePoker, bankOf, spentToday, exchange, buyChips, TABLES, MIN_BUY, MAX_BUY, CHIP } from "./_poker.js";
import { chicagoDay } from "../casino/_pot.js";

export async function onRequestGet(context) {
  const gate = await requireLogin(context, "Log in with Twitch to see your chips."); if (gate.denied) return gate.denied;
  const db = context.env.PICKS_DB; if (!db) return fail("NO_DB", "Offline.", 503);
  await ensurePoker(db);
  const bank = await bankOf(db, gate.user.id), spent = await spentToday(db, gate.user.id, chicagoDay(Date.now())), balance = await readBalance(context.env, gate.user.login);
  return json({ ok: true, bank, spentToday: spent, balance, tables: TABLES, table: "nickel", minBuy: MIN_BUY, maxBuy: MAX_BUY, chip: CHIP }, 200, { "Cache-Control": "no-store" });
}

export async function onRequestPost(context) {
  const gate = await requireLogin(context, "Log in with Twitch to exchange chips."); if (gate.denied) return gate.denied;
  const db = context.env.PICKS_DB; if (!db) return fail("NO_DB", "Offline.", 503);
  await ensurePoker(db);
  let body; try { body = await context.request.json(); } catch { return fail("BAD_JSON", "Send JSON.", 400); }
  const r = body?.buyZc != null ? await buyChips(context.env, db, { userId: gate.user.id, zc: body.buyZc }) : await exchange(context.env, db, { userId: gate.user.id, zc: body?.zc });
  return json(r, r.ok ? 200 : 409, { "Cache-Control": "no-store" });
}
