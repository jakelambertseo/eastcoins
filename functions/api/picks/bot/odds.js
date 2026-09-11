/* ============================================================
   !odds [team]

   With a team, one line for that game. Without one, a COUNT and a
   link — never a list. This is the command most likely to be typed
   during a 10-game slate, and enumerating ten games would either
   blow the 400-byte cap or fill chat by itself.

   Every reply ends with the Picks link. say() cuts replies at 400
   bytes, so withLink() trims the text in front instead, never the link.
   ============================================================ */

import {
  say, botGate, openMarkets, matchTeam, formatLine, shortTeam, BADGE
} from "./_bot.js";
import { whenCT } from "../_when.js";
import { versus } from "../_fights.js";

const LINK_TAIL = "https://eastcoin.vip/?view=picks to view all open games. GAMBA";

/** The reply with the link on the end, trimmed so the link always fits. */
export function withLink(text) {
  const enc = new TextEncoder();
  const room = 400 - enc.encode(`${BADGE} `).length - enc.encode(` ${LINK_TAIL}`).length;
  let main = String(text || "").replace(/\s+/g, " ").trim();
  if (enc.encode(main).length > room) {
    main = new TextDecoder().decode(enc.encode(main).slice(0, room - 3)).replace(/\uFFFD+$/, "").trimEnd() + "…";
  }
  return `${main} ${LINK_TAIL}`;
}

export async function onRequestGet(context) {
  const gate = botGate(context);
  if (!gate.ok) return gate.response;

  const db = context.env.PICKS_DB;
  if (!db) return say("Picks is offline right now.");

  const markets = await openMarkets(db);
  if (!markets.length) return say(withLink("No games are open for picks right now."));

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
        `${shortTeam(m.away_name)} ${formatLine(m.away_odds_locked)} ${versus(m.sport)} ` +
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
    return say(withLink(`${parts.join(" · ")} · !odds <team> for a line · !pick <amount> <team>`));
  }

  const found = matchTeam(markets, team);
  if (!found) {
    return say(withLink(`No open game for "${team}". ${markets.length} open — try !odds`));
  }
  if (found.ambiguous) {
    return say(withLink(`"${team}" matches ${found.ambiguous.join(" and ")}. Be more specific.`));
  }

  const m = found.market;
  return say(withLink(
    `${shortTeam(m.away_name)} ${formatLine(m.away_odds_locked)} ${versus(m.sport)} ` +
    `${shortTeam(m.home_name)} ${formatLine(m.home_odds_locked)}${timeOf(m.starts_at)} · !pick <amount> <team>`
  ));
}

/** " · 5:35 PM CT", " · tomorrow at 6:30 PM CT", or nothing when unreadable. */
function timeOf(startsAt) {
  const when = whenCT(startsAt);
  return when ? ` · ${when}` : "";
}
