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
    const n = markets.length;
    // A short slate fits in one line, so say the lines outright. Times
    // ride along when there is room for them; a longer slate is a count.
    if (n <= 4) {
      const withTime = n <= 2;
      const each = markets.map((m) =>
        `${shortTeam(m.away_name)} ${formatLine(m.away_odds_locked)} at ` +
        `${shortTeam(m.home_name)} ${formatLine(m.home_odds_locked)}${withTime ? timeOf(m.starts_at) : ""}`
      );
      return say(`${n === 1 ? "Open" : `${n} open`} — ${each.join(" · ")} · !pick <amount> <team>`);
    }
    return say(
      `${n} games open for picks — !odds <team> for a line, ` +
      `!pick <amount> <team> to bet.`
    );
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
