/* GET /api/casino/dice/state — the rules, the hash of the seed the caller's next roll will use, and whether they can
   bet. GambaScape-only: there is no page for it here, so no room list or public ledger is built. */

import { getSessionUser, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence } from "../_engine.js";
import { ensureDice, commitFor, publicRoll, rollsLastHour, MIN_TARGET, MAX_TARGET, MAX_MULTIPLIER, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_dice.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensureDice(db);
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, { key: "dice" }, user.id, Date.now());
  const commit = user ? await commitFor(db, user.id) : null;
  let last = null;
  if (user) { const row = await db.prepare(`SELECT * FROM dice_rolls WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).bind(user.id).first(); if (row) last = publicRoll(row); }
  return json({
    ok: true, now: Date.now(),
    config: { minTarget: MIN_TARGET, maxTarget: MAX_TARGET, maxMultiplier: MAX_MULTIPLIER, minBet: MIN_BET, maxBet: MAX_BET, maxPerHour: MAX_BETS_PER_HOUR, canBet: Boolean(user) && walletWritesEnabled(context.env) },
    me: user ? { id: user.id, login: user.login, played: await rollsLastHour(db, user.id) } : null,
    nextHash: commit?.hash || null, last
  });
}
