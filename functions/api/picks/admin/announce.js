/* ============================================================
   EastCoin Picks — announce open markets in chat (admin)

   The push half of the chat integration. The pull commands
   (!pick, !odds, ...) are self-limiting: they cost one message per
   person who asks. Push is what floods, because its volume scales
   with the size of the slate rather than with interest.

   So this never announces per game. One press composes one message
   however many markets are open — naming them while that is still
   short, and falling back to a count and a pointer once it isn't.
   Ten simultaneous kickoffs produce one line, not ten.

   GET previews the exact text without sending. POST sends it. The
   preview exists because this is the only thing that speaks to real
   viewers, and it should never be a surprise what it said.
   ============================================================ */

import { composeOpen as compose } from "../_announce.js";
import {
  ADMIN_ALLOWLIST,
  getSessionUser,
  sayInChat,
  json,
  fail
} from "../_lib.js";

async function openMarkets(db) {
  const result = await db
    .prepare(
      `SELECT id, sport, league, away_name, home_name, starts_at,
              away_odds_locked, home_odds_locked
         FROM markets
        WHERE state = 'OPEN'
          AND datetime(starts_at) > datetime('now')
        ORDER BY datetime(starts_at) ASC
        LIMIT 50`
    )
    .all();
  return result.results || [];
}

async function gate(context) {
  const db = context.env.PICKS_DB;
  if (!db) return { error: fail("DB_UNAVAILABLE", "Picks database is not connected.", 503) };

  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) {
    return { error: fail("NOT_ADMIN", "Only Picks admins can post to chat.", 403) };
  }
  return { db, user };
}

/** Preview only — composes the message, sends nothing. */
export async function onRequestGet(context) {
  const { db, error } = await gate(context);
  if (error) return error;

  const markets = await openMarkets(db);
  const message = compose(markets);

  return json({
    ok: true,
    open: markets.length,
    message,
    // Twitch's own limit is 500; anything near it gets truncated badly.
    length: message.length,
    canPost: markets.length > 0
  });
}

export async function onRequestPost(context) {
  const { db, user, error } = await gate(context);
  if (error) return error;

  const markets = await openMarkets(db);
  if (!markets.length) {
    return fail("NOTHING_OPEN", "No markets are open, so there's nothing to announce.", 409);
  }

  const message = compose(markets);
  const sent = await sayInChat(context.env, message);

  if (!sent.ok) {
    return fail(
      "SAY_FAILED",
      sent.error === "NOT_CONFIGURED"
        ? "The StreamElements token isn't configured, so nothing was posted."
        : `StreamElements refused the message (${sent.error}).`,
      502
    );
  }

  console.log(`Picks: ${user.login} announced ${markets.length} market(s) in chat`);
  return json({ ok: true, posted: message, open: markets.length });
}
