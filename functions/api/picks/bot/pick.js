/* ============================================================
   !pick <amount> <team>

   The only chat command that moves money. It runs the exact same
   placeWager() the website does, so the two can't disagree about a
   price, a limit or an unwind.

   On $(customapi) being GET-only: a GET that debits ZCoins is a
   smell, and the mitigation is already in the schema rather than
   here. The wager's idempotency key is WAGER:<market>:<user>, and
   picks has UNIQUE(market_id, user_id), so a replayed URL collides
   and returns DUPLICATE instead of charging twice.
   ============================================================ */

import { placeWager } from "../_wager.js";
import {
  say, botGate, findOrCreateUser, openMarkets, matchTeam, formatLine, shortTeam
} from "./_bot.js";

/**
 * "50 bills" or "bills 50" — the integer is the stake, the rest the team.
 * "all bills" (or max / everything / allin) stakes the whole balance.
 */
const ALL_IN = /^(all|max|everything|all-?in)$/i;

export function parseArgs(args) {
  const parts = String(args || "").trim().split(/\s+/).filter(Boolean);
  let at = parts.findIndex((p) => /^\d+$/.test(p));
  let amount = at === -1 ? null : Number(parts[at]);
  if (at === -1) {
    at = parts.findIndex((p) => ALL_IN.test(p));
    if (at !== -1) amount = "all";
  }
  if (at === -1) return { amount: null, team: parts.join(" ") };
  return {
    amount,
    team: parts.slice(0, at).concat(parts.slice(at + 1)).join(" ")
  };
}

export async function onRequestGet(context) {
  const gate = botGate(context);
  if (!gate.ok) return gate.response;

  const db = context.env.PICKS_DB;
  if (!db) return say("Picks is offline right now.");

  const who = `@${gate.login}`;
  const { amount, team } = parseArgs(gate.args);

  if (!amount || !team) {
    return say(`${who} usage: !pick <amount> <team> — e.g. !pick 50 Bills, or !pick all Bills`);
  }

  const user = await findOrCreateUser(db, gate, context.env);
  if (!user) {
    // Only reachable when the command was set up without id=$(sender.twitchid).
    return say(`${who} log in once at eastcoin.vip to link your ZCoins, then !pick works.`);
  }

  const markets = await openMarkets(db);
  if (!markets.length) {
    return say(`${who} nothing is open for picks right now.`);
  }

  const found = matchTeam(markets, team);
  if (!found) {
    return say(`${who} no open game for "${team}". ${markets.length} open — try !odds`);
  }
  if (found.ambiguous) {
    return say(`${who} "${team}" matches ${found.ambiguous.join(" and ")}. Be more specific.`);
  }

  const result = await placeWager(context.env, db, user, {
    marketId: found.market.id,
    selection: found.side,
    wager: amount
  });

  if (!result.ok) {
    if (result.code === "ALREADY_PICKED") {
      const m = found.market;
      return say(`${who} you already have a pick on ${shortTeam(m.away_name)} at ${shortTeam(m.home_name)}.`);
    }
    // placeWager's messages are already written for a person to read.
    return say(`${who} ${result.message}`);
  }

  const p = result.pick;
  const balance = result.balance == null ? "" : ` Balance: ${Number(result.balance).toLocaleString()}`;
  const allIn = amount === "all" ? " — ALL IN" : "";
  return say(
    `${who} locked ${p.wager.toLocaleString()} on ${shortTeam(p.team)} ${formatLine(p.odds)}${allIn} ` +
    `→ ${p.returnsIfWon.toLocaleString()} back if they win.${balance}`
  );
}
