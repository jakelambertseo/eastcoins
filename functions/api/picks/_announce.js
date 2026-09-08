/* ============================================================
   EastCoin Picks — what the bot says in chat

   Both messages live here because they share the rule that matters:
   never one message per game. Volume has to stay flat as a slate
   grows, so each composer names markets while that is still short
   and falls back to a count once it isn't. Ten simultaneous
   kickoffs produce one line, not ten.
   ============================================================ */

import { BADGE } from "./bot/_bot.js";

const SPORT_EMOJI = {
  "american-football": "\u{1F3C8}",
  baseball: "\u{26BE}",
  basketball: "\u{1F3C0}",
  hockey: "\u{1F3D2}"
};

/** Badge only when every market agrees; a mixed slate gets none. */
function badgeFor(markets) {
  const sports = new Set(markets.map((m) => m.sport));
  const badge = sports.size === 1 ? SPORT_EMOJI[[...sports][0]] || "" : "";
  return badge ? `${badge} ` : "";
}

function formatLine(value) {
  const line = Number(value);
  if (!Number.isFinite(line) || line === 0) return "";
  return line > 0 ? `+${line}` : String(line);
}

function timeOf(startsAt) {
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago"
  }) + " CT";
}

/** "Betting is open" — posted by an admin pressing the button. */
export function composeOpen(markets) {
  if (!markets.length) return "";
  const lead = badgeFor(markets);

  if (markets.length <= 2) {
    const each = markets.map((m) =>
      `${m.away_name} ${formatLine(m.away_odds_locked)} at ` +
      `${m.home_name} ${formatLine(m.home_odds_locked)}`
    );
    const closes = markets.length === 1 ? ` \u00b7 closes ${timeOf(markets[0].starts_at)}` : "";
    return `${BADGE} ${lead}Betting open \u2014 ${each.join(" \u00b7 ")}${closes} \u00b7 !pick <amount> <team>`;
  }

  return (
    `${BADGE} ${lead}${markets.length} games open for picks \u2014 !odds <team> for a line, ` +
    `!pick <amount> <team> to bet`
  );
}

/**
 * "Betting is closed" — posted automatically when the scheduled run
 * locks markets at their start time. Safe to fire on every run
 * because a market only crosses OPEN -> LOCKED once, so there is
 * nothing to announce on the next tick.
 */
export function composeClosed(markets, totals = {}) {
  if (!markets.length) return "";
  const lead = badgeFor(markets);

  const picks = Number(totals.picks || 0);
  const staked = Number(totals.staked || 0);
  const riding = picks
    ? ` \u00b7 ${picks} pick${picks === 1 ? "" : "s"}, ${staked.toLocaleString()} ZC riding`
    : "";

  if (markets.length <= 2) {
    const each = markets.map((m) => `${m.away_name} at ${m.home_name}`);
    return `${BADGE} ${lead}Betting closed \u2014 ${each.join(" \u00b7 ")}${riding}. Good luck.`;
  }

  return `${BADGE} ${lead}Betting closed on ${markets.length} games${riding}. !mypicks for yours.`;
}

/**
 * "Here is what happened" — posted automatically after the scheduled
 * run settles something. Safe on every tick for the same reason as the
 * closing message: a market settles once and then leaves the candidate
 * set, so the next run has nothing to say.
 *
 * Takes what actually moved, not what was expected to: these numbers
 * come back from the payout loop, so a failed transfer is never
 * reported as money paid.
 */
export function composeSettled(entries) {
  const done = (entries || []).filter((e) => e && e.action !== "skipped");
  if (!done.length) return "";

  const lead = badgeFor(done);
  const won = done.reduce((n, e) => n + Number(e.won || 0), 0);
  const paid = done.reduce((n, e) => n + Number(e.paid || 0), 0);
  const failed = done.reduce((n, e) => n + Number(e.failed || 0), 0);

  // A failed payout is said out loud. Someone is owed money and the
  // worst outcome is that only a log knows.
  const trouble = failed ? ` ⚠ ${failed} payout${failed === 1 ? "" : "s"} failed` : "";

  if (done.length === 1) {
    const e = done[0];
    if (e.outcome === "VOID") {
      const vlink = e.slug ? ` · eastcoin.vip/g/${e.slug}` : "";
      return `${BADGE} ${lead}${e.away} at ${e.home} voided — ` +
        `${e.refunded || 0} stake${e.refunded === 1 ? "" : "s"} refunded${vlink}.${trouble}`;
    }
    const score = Number.isFinite(e.awayScore) && Number.isFinite(e.homeScore)
      ? ` ${Math.max(e.awayScore, e.homeScore)}-${Math.min(e.awayScore, e.homeScore)}` : "";
    const payout = won
      ? `${won} winner${won === 1 ? "" : "s"}, ${paid.toLocaleString()} ZC paid`
      : "no winners";
    const link = e.slug ? ` · eastcoin.vip/g/${e.slug}` : "";
    return `${BADGE} ${lead}${e.winnerName} win${score} — ${payout}${link}.${trouble} !record for yours.`;
  }

  const day = done.find((e) => e.day)?.day || "";
  const link = day ? ` · eastcoin.vip/g/${day}` : "";
  return (
    `${BADGE} ${lead}${done.length} games settled · ${won} winner${won === 1 ? "" : "s"}, ` +
    `${paid.toLocaleString()} ZC paid${link}.${trouble} !record for yours.`
  );
}
