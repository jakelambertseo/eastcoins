/* GET /api/casino/slots/state — the pay table as it is really priced, the jackpot, the hash of the seed the caller's
   next spin will use, and whether they can bet. GambaScape-only: no room list or public ledger is built. */

import { getSessionUser, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence } from "../_engine.js";
import { ensureSlots, commitFor, payTable, potNow, publicSpin, spinsLastHour, JACKPOT, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_slots.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensureSlots(db);
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, { key: "slots" }, user.id, Date.now());
  const commit = user ? await commitFor(db, user.id) : null;
  let last = null;
  if (user) { const row = await db.prepare(`SELECT * FROM slots_spins WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).bind(user.id).first(); if (row) last = publicSpin(row); }
  return json({
    ok: true, now: Date.now(),
    config: { pays: payTable(), jackpotSlice: JACKPOT.slice, minBet: MIN_BET, maxBet: MAX_BET, maxPerHour: MAX_BETS_PER_HOUR, canBet: Boolean(user) && walletWritesEnabled(context.env) },
    pot: await potNow(db),
    me: user ? { id: user.id, login: user.login, played: await spinsLastHour(db, user.id) } : null,
    nextHash: commit?.hash || null, last
  });
}
