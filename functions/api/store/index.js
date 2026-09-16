/* GET /api/store — the catalogue, and (signed in) what you own, what is
   switched on and your balance. Members only, like the page. */

import { getSessionUser, readBalance, json, fail } from "../picks/_lib.js";
import { ITEMS, SLOTS, ensureStore, mineFor } from "./_store.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The store is offline right now.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to visit the store.", 401);
  await ensureStore(db);
  const [mine, balance] = await Promise.all([mineFor(db, user.id), readBalance(context.env, user.login)]);
  return json({ ok: true, slots: SLOTS, items: ITEMS, mine, balance, login: user.login });
}
