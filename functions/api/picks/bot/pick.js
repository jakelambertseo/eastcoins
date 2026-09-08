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
  say, botGate, findUser, openMarkets, matchTeam, formatLine, shortTeam
} from "./_bot.js";

/** "50 bills" or "bills 50" — the integer is the stake, the rest the team. */
export function parseArgs(args) {
  const parts = String(args || "").trim().split(/\s+/).filter(Boolean);
  const at = parts.findIndex((p) => /^\d+$/.test(p));
  if (at === -1) return { amount: null, team: parts.join(" ") };
  return {
    amount: Number(parts[at]),
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
    return say(`${who} usage: !pick <amount> <team> — e.g. !pick 50 Bills`);
  }

  const user = await findUser(db, gate.login);
  if (!user) {
    return say(`${who} log in once at eastcoin.vip to link your ZCoins, then !pick works.`);
  }

  const markets = await openMarkets(db);
  if (!markets.length) {
    return say(`${who} nothing is open for picks right now.`);
  }

  const found = matchTeam(markets, team);
  if (!found) {
    return say(`${who} no open game for "${team}". ${markets.length} open — eastcoin.vip/picks`);
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
  return say(
    `${who} locked ${p.wager.toLocaleString()} on ${shortTeam(p.team)} ${formatLine(p.odds)} ` +
    `→ ${p.returnsIfWon.toLocaleString()} back if they win.${balance}`
  );
}
