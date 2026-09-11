/* ============================================================
   EastCoin Picks — settle a fight by hand (admin)

   Boxing and MMA have no scores feed, so nothing grades them on its
   own. Once the fight has started, the admin enters the result here:
   one fighter won, or it was a draw, which refunds every pick the
   same as a tied game.

   Payouts go through applyVerdict in settle.js, the code the
   scheduled run uses, so every pick is paid at most once: each
   payout carries a key derived from the pick, and pressing the button
   twice finds it already paid. A settle that stops part-way (a payout
   failed) can only be retried with the same result.

   Team games are refused. They settle themselves from the scores
   feed, and a hand-picked winner racing the feed is how one market
   ends up paid two different ways. Chat and Discord hear a fight
   result the same way they hear a final.
   ============================================================ */

import { ADMIN_ALLOWLIST, getSessionUser, sayInChat, walletWritesEnabled, json, fail } from "../_lib.js";
import { applyVerdict } from "../settle.js";
import { composeSettled } from "../_announce.js";
import { discordEnabled, postDiscord, settledEmbed } from "../_discord.js";
import { isFight } from "../_fights.js";

export async function onRequestPost(context) {
  try {
    return await handle(context);
  } catch (error) {
    const detail = String(error?.message || error || "unknown");
    console.error("settle-market threw:", detail, error?.stack || "");
    return fail("SERVER_ERROR", "The endpoint threw: " + detail, 500);
  }
}

async function handle(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) {
    return fail("NOT_ADMIN", "Only Picks admins can settle markets.", 403);
  }

  let body;
  try {
    body = await context.request.json();
  } catch {
    return fail("BAD_REQUEST", "Expected a JSON body.");
  }

  const marketId = String(body?.marketId || "").trim();
  const winner = String(body?.winner || "").trim().toLowerCase();
  const note = String(body?.note || "").replace(/[<>]/g, "").trim().slice(0, 80);
  if (!marketId) return fail("BAD_REQUEST", "Missing marketId.");
  if (!["away", "home", "draw"].includes(winner)) {
    return fail("BAD_WINNER", "winner must be away, home or draw.");
  }

  const market = await db
    .prepare(`SELECT id, sport, league, away_name, home_name, starts_at, state, winner FROM markets WHERE id = ? LIMIT 1`)
    .bind(marketId)
    .first();
  if (!market) return fail("NO_MARKET", "That market doesn't exist.", 404);

  if (!isFight(market.sport)) {
    return fail("NOT_A_FIGHT", "Only boxing and MMA markets are settled by hand. Team games settle from the scores feed.", 409);
  }
  if (market.state === "SETTLED" || market.state === "VOID") {
    return fail("ALREADY_FINISHED", `That market is already ${market.state}.`, 409);
  }
  if (new Date(market.starts_at).getTime() > Date.now()) {
    return fail("NOT_STARTED", "The fight hasn't started yet. Betting closes at the first bell; settle it after that.", 409);
  }

  const outcome = winner === "draw" ? "VOID" : winner;

  // Part-way through (a payout failed last time): only the same result
  // may finish it, or the picks already paid and the picks still owed
  // would be graded on two different results.
  if (market.state === "SETTLING") {
    const was = market.winner || "VOID";
    if (was !== outcome) {
      return fail(
        "SETTLING_DIFFERENTLY",
        "This fight is part-way through settling with a different result. Press that result again to retry it.",
        409
      );
    }
  }

  const active = await db
    .prepare(`SELECT COUNT(*) AS n FROM picks WHERE market_id = ? AND status = 'ACTIVE'`)
    .bind(marketId)
    .first();
  if (Number(active?.n || 0) && !walletWritesEnabled(context.env)) {
    return fail("WALLET_NOT_CONFIGURED", "There are picks to pay but ZCoin transfers aren't configured. Nothing was changed.", 503);
  }

  const winnerName = outcome === "home" ? market.home_name : outcome === "away" ? market.away_name : null;
  const detail = outcome === "VOID"
    ? `Draw${note ? " · " + note : ""}`
    : `${winnerName}${note ? " · " + note : ""}`;

  const result = await applyVerdict(
    context.env, db, market,
    { verdict: outcome, detail, ourAway: null, ourHome: null },
    "admin-result"
  );

  // Chat and Discord hear it the way they hear a final.
  const line = composeSettled([result]);
  if (line) {
    const said = await sayInChat(context.env, line);
    if (!said.ok) console.error(`Picks: couldn't announce ${market.away_name} vs ${market.home_name}: ${said.error}`);
  }
  if (discordEnabled(context.env)) {
    const card = settledEmbed(result);
    if (card) await postDiscord(context.env, [card]).catch(() => {});
  }

  console.log(`Picks: ${user.login} settled ${marketId} as ${outcome}${note ? " (" + note + ")" : ""}`);

  const counts = { won: result.won, lost: result.lost, refunded: result.refunded, failed: result.failed, paid: result.paid };
  if (result.failed) {
    return fail(
      "PAYOUT_FAILED",
      `${result.failed} payout(s) failed. The fight was left settling; press the same result again to retry.`,
      502,
      counts
    );
  }
  return json({
    ok: true,
    market: { id: marketId, away: market.away_name, home: market.home_name },
    outcome,
    ...counts
  });
}

export async function onRequestGet() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to settle a market.", 405);
}
