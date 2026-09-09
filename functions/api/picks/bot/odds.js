/* ============================================================
   !odds [team]

   With a team, one line for that game. Without one, a COUNT and a
   link — never a list. This is the command most likely to be typed
   during a 10-game slate, and enumerating ten games would either
   blow the 400-byte cap or fill chat by itself.
   ============================================================ */

import {
  say, botGate, openMarkets, matchTeam, formatLine, shortTeam
} from "./_bot.js";

export async function onRequestGet(context) {
  const gate = botGate(context);
  if (!gate.ok) return gate.response;

  const db = context.env.PICKS_DB;
  if (!db) return say("Picks is offline right now.");

  const markets = await openMarkets(db);
  if (!markets.length) return say("No games are open for picks right now.");

  // StreamElements goes quiet when a nested $(queryescape $(1:)) has
  // nothing inside it, so the command passes a fallback word instead —
  // $(1:|all) — and "all" means the same as no team at all.
  const team = /^(all|open|list|games|-)$/i.test(gate.args) ? "" : gate.args;
  if (!team) {
    // A count per league. NFL is the headline: with fewer than four
    // games open its lines are said outright (times when there are
    // two or fewer); anything bigger, and every other league, is a
    // number and a pointer.
    const nfl = markets.filter((m) => String(m.league || "").toUpperCase() === "NFL");
    const parts = [];
    if (nfl.length && nfl.length < 4) {
      const withTime = nfl.length <= 2;
      parts.push(`NFL: ` + nfl.map((m) =>
        `${shortTeam(m.away_name)} ${formatLine(m.away_odds_locked)} at ` +
        `${shortTeam(m.home_name)} ${formatLine(m.home_odds_locked)}${withTime ? timeOf(m.starts_at) : ""}`
      ).join(" · "));
    } else if (nfl.length) {
      parts.push(`NFL: ${nfl.length} open`);
    }
    const counts = new Map();
    for (const m of markets) {
      const league = String(m.league || m.sport || "Other").toUpperCase();
      if (league === "NFL") continue;
      counts.set(league, (counts.get(league) || 0) + 1);
    }
    for (const [league, n] of counts) parts.push(`${league}: ${n} open`);
    return say(`${parts.join(" · ")} · !odds <team> for a line · !pick <amount> <team>`);
  }

  const found = matchTeam(markets, team);
  if (!found) {
    return say(`No open game for "${team}". ${markets.length} open — try !odds`);
  }
  if (found.ambiguous) {
    return say(`"${team}" matches ${found.ambiguous.join(" and ")}. Be more specific.`);
  }

  const m = found.market;
  return say(
    `${shortTeam(m.away_name)} ${formatLine(m.away_odds_locked)} at ` +
    `${shortTeam(m.home_name)} ${formatLine(m.home_odds_locked)}${timeOf(m.starts_at)} · !pick <amount> <team>`
  );
}

/** " · 5:35 PM CT", or nothing when the time is unreadable. */
function timeOf(startsAt) {
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) return "";
  return ` · ${when.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
  })} CT`;
}
