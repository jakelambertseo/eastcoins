/* ============================================================
   EastCoin Picks — place a wager (website)

   The session-authenticated entry point. All of the money logic
   lives in _wager.js, shared with the chat command, so the two
   paths cannot drift apart. This file only turns a cookie into a
   user and a result into JSON.
   ============================================================ */

import { getSessionUser, json, fail } from "./_lib.js";
import { placeWager } from "./_wager.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user) {
    return fail("NOT_AUTHENTICATED", "Log in with Twitch to make a pick.", 401);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return fail("BAD_REQUEST", "Expected a JSON body.");
  }

  const result = await placeWager(context.env, db, user, {
    marketId: body?.marketId,
    selection: body?.selection,
    wager: body?.wager
  });

  if (!result.ok) {
    const { code, message, status, ok, ...extra } = result;
    return fail(code, message, status, extra);
  }

  return json({ ok: true, pick: result.pick, balance: result.balance });
}

export async function onRequestGet() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to create a Picks wager.", 405);
}
