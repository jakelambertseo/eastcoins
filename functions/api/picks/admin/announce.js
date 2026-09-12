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

   With a marketId (?marketId= on GET, { marketId } on POST) it
   announces that one market instead, in chat and on Discord: for the
   one-off events the site opens by hand (CFB, fights), which nothing
   else announces. Each single announce is noted as announce:<id> in
   ops_status so the admin page can say when it last went out.
   ============================================================ */

import { composeOpen as compose } from "../_announce.js";
import { discordEnabled, postDiscord, openedEmbed } from "../_discord.js";
import { noteStatus } from "../_ops.js";
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

async function oneMarket(db, id) {
  return db
    .prepare(
      `SELECT id, sport, league, away_name, home_name, starts_at, state,
              away_odds_locked, home_odds_locked
         FROM markets WHERE id = ? LIMIT 1`
    )
    .bind(id)
    .first();
}

/** Why this market can't be announced, or null when it can. */
function problemWith(market) {
  if (!market) return "That market doesn't exist.";
  if (market.state !== "OPEN") return `That market is ${String(market.state).toLowerCase()}, so there's nothing to announce.`;
  if (new Date(market.starts_at).getTime() <= Date.now()) return "That game has already started, so betting is closed.";
  return null;
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

  const marketId = String(new URL(context.request.url).searchParams.get("marketId") || "").trim();
  if (marketId) {
    const market = await oneMarket(db, marketId);
    const problem = problemWith(market);
    if (problem) return fail("NOT_ANNOUNCEABLE", problem, 409);
    const message = compose([market]);
    return json({
      ok: true,
      open: 1,
      message,
      length: message.length,
      canPost: true,
      discord: discordEnabled(context.env)
    });
  }

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

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const marketId = String(body?.marketId || "").trim();
  if (marketId) return announceOne(context, db, user, marketId);

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

/** One market, in chat and on Discord. */
async function announceOne(context, db, user, marketId) {
  const market = await oneMarket(db, marketId);
  const problem = problemWith(market);
  if (problem) return fail("NOT_ANNOUNCEABLE", problem, 409);

  const message = compose([market]);
  const chat = await sayInChat(context.env, message);

  const discordOn = discordEnabled(context.env);
  let discord = { ok: false, error: "NOT_CONFIGURED" };
  if (discordOn) {
    discord = await postDiscord(context.env, openedEmbed([market])).catch((e) => ({ ok: false, error: String(e?.message || e) }));
  }
  const chatOk = Boolean(chat?.ok);
  const discordOk = Boolean(discord?.ok);

  if (!chatOk && !discordOk) {
    const why = chat?.error === "NOT_CONFIGURED"
      ? "The StreamElements token isn't configured"
      : `StreamElements refused it (${chat?.error || "unknown"})`;
    return fail("SAY_FAILED", `${why}${discordOn ? `, and Discord failed too (${discord?.error || "unknown"})` : ""}. Nothing was posted.`, 502);
  }

  await noteStatus(db, `announce:${market.id}`, {
    at: new Date().toISOString(), by: user.login, chat: chatOk, discord: discordOk
  }).catch(() => {});

  const summary = chatOk && discordOk
    ? "Announced in Twitch chat and on Discord."
    : chatOk
      ? (discordOn ? `Announced in Twitch chat. Discord failed (${discord?.error || "unknown"}).` : "Announced in Twitch chat. Discord isn't set up.")
      : `Posted on Discord only. StreamElements refused the chat line (${chat?.error || "unknown"}).`;

  console.log(`Picks: ${user.login} announced ${market.id} (chat ${chatOk}, discord ${discordOk})`);
  return json({
    ok: true,
    posted: message,
    chat: { ok: chatOk, error: chat?.error || null },
    discord: { enabled: discordOn, ok: discordOk, error: discordOk ? null : discord?.error || null },
    partial: !(chatOk && (discordOk || !discordOn)),
    summary
  });
}
