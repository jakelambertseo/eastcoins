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

  const team = gate.args;
  if (!team) {
    const n = markets.length;
    return say(
      `${n} game${n === 1 ? "" : "s"} open for picks — !odds <team> for a line, ` +
      `!pick <amount> <team> to bet. eastcoin.vip/picks`
    );
  }

  const found = matchTeam(markets, team);
  if (!found) {
    return say(`No open game for "${team}". ${markets.length} open — eastcoin.vip/picks`);
  }
  if (found.ambiguous) {
    return say(`"${team}" matches ${found.ambiguous.join(" and ")}. Be more specific.`);
  }

  const m = found.market;
  const when = new Date(m.starts_at);
  const at = Number.isNaN(when.getTime())
    ? ""
    : ` · ${when.toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
      })} CT`;

  return say(
    `${shortTeam(m.away_name)} ${formatLine(m.away_odds_locked)} at ` +
    `${shortTeam(m.home_name)} ${formatLine(m.home_odds_locked)}${at} · !pick <amount> <team>`
  );
}
