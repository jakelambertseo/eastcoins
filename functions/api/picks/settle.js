/* ============================================================
   EastCoin Picks — settlement

   Settlement is automatic from the scores feed, but deliberately
   timid. It only acts when the feed is unambiguous:

     · the event is explicitly completed
     · both scores are present integers
     · the scores are not level (a tie is a refund, not a win)
     · both team names matched our market

   Anything else is left alone for the next run. A market that
   settles late is a nuisance; a market that settles wrong moves
   real ZCoins to the wrong people and is very hard to unwind.

   Every payout is written through wallet_operations with a unique
   idempotency key derived from the pick, so running settlement
   twice cannot pay twice.
   ============================================================ */

import {
  ADMIN_ALLOWLIST,
  getSessionUser,
  moveBalance,
  walletWritesEnabled,
  beginOperation,
  finishOperation,
  totalReturn,
  newId,
  json,
  fail
} from "./_lib.js";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const LEAGUE_PATHS = {
  baseball: ["baseball/mlb"],
  "american-football": ["football/nfl", "football/college-football"],
  basketball: ["basketball/nba"],
  hockey: ["hockey/nhl"]
};

/* ------------------------------------------------------------ matching */

function nickname(value) {
  const parts = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!parts.length) return "";
  const tail2 = parts.slice(-2).join(" ");
  if (/^(red sox|white sox|blue jays|maple leafs|golden knights|trail blazers)$/.test(tail2)) {
    return tail2;
  }
  return parts[parts.length - 1];
}

async function fetchScoreboard(path) {
  try {
    const response = await fetch(`${ESPN_BASE}/${path}/scoreboard`);
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.events) ? payload.events : [];
  } catch {
    return [];
  }
}

/**
 * Returns a verdict for a market, or null when the feed doesn't
 * clearly say. Null always means "leave it alone and look again".
 */
async function findResult(market) {
  const paths = LEAGUE_PATHS[String(market.sport || "").toLowerCase()] || [];
  if (!paths.length) return null;

  const wantAway = nickname(market.away_name);
  const wantHome = nickname(market.home_name);
  if (!wantAway || !wantHome) return null;

  for (const path of paths) {
    for (const event of await fetchScoreboard(path)) {
      const competition = event?.competitions?.[0];
      const competitors = competition?.competitors || [];
      if (competitors.length !== 2) continue;

      const espnHome = competitors.find((c) => c.homeAway === "home");
      const espnAway = competitors.find((c) => c.homeAway === "away");
      if (!espnHome?.team || !espnAway?.team) continue;

      const gotHome = nickname(espnHome.team.displayName);
      const gotAway = nickname(espnAway.team.displayName);

      // Both sides must match, in either orientation.
      const straight = gotAway === wantAway && gotHome === wantHome;
      const flipped = gotAway === wantHome && gotHome === wantAway;
      if (!straight && !flipped) continue;

      const status = event?.status?.type || {};
      if (!status.completed || status.state !== "post") return null;

      // A postponed or cancelled game can carry state "post".
      const name = String(status.name || "").toUpperCase();
      if (name.includes("POSTPONED") || name.includes("CANCELED") ||
          name.includes("CANCELLED") || name.includes("SUSPENDED")) {
        return { verdict: "VOID", detail: status.detail || name };
      }

      const homeScore = Number(espnHome.score);
      const awayScore = Number(espnAway.score);
      if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) return null;

      // Our market's "home" is whichever side matched our home name.
      const ourHome = straight ? homeScore : awayScore;
      const ourAway = straight ? awayScore : homeScore;

      if (ourHome === ourAway) {
        return { verdict: "VOID", detail: `Tied ${ourAway}–${ourHome}`, ourAway, ourHome };
      }

      return {
        verdict: ourHome > ourAway ? "home" : "away",
        detail: status.detail || "Final",
        ourAway,
        ourHome
      };
    }
  }
  return null;
}

/* ------------------------------------------------------------ payouts */

async function payPick(env, db, pick, market, outcome) {
  const login = String(pick.twitch_login || "").toLowerCase();
  const odds = Number(pick.odds_locked);

  let amount = 0;
  let type = null;
  let status = "LOST";

  if (outcome === "VOID") {
    amount = pick.wager;
    type = "REFUND_CREDIT";
    status = "REFUNDED";
  } else if (outcome === pick.selection) {
    amount = totalReturn(pick.wager, odds);
    type = "PAYOUT_CREDIT";
    status = "WON";
  }

  // A loss moves no money; only the pick row changes.
  if (!type) {
    await db
      .prepare(
        `UPDATE picks
            SET status = 'LOST', payout = 0, profit = ?,
                settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?`
      )
      .bind(-pick.wager, pick.id)
      .run();
    return { paid: 0, status: "LOST" };
  }

  const opId = newId("op");
  const begun = await beginOperation(db, {
    id: opId,
    idempotencyKey: `SETTLE:${pick.id}`,   // one payout per pick, ever
    userId: pick.user_id,
    marketId: market.id,
    pickId: pick.id,
    type,
    amount
  });

  if (!begun.ok) {
    // Already settled on a previous run.
    return { paid: 0, status: "ALREADY" };
  }

  const credit = await moveBalance(env, login, amount);
  if (!credit.ok) {
    await finishOperation(db, opId, "NEEDS_RECONCILIATION", { error: credit.error });
    return { paid: 0, status: "FAILED" };
  }

  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: credit.balance });

  await db
    .prepare(
      `UPDATE picks
          SET status = ?, payout = ?, profit = ?, final_multiplier = NULL,
              settled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
    .bind(status, amount, amount - pick.wager, pick.id)
    .run();

  return { paid: amount, status };
}

async function settleMarket(env, db, market) {
  const result = await findResult(market);
  if (!result) return { id: market.id, action: "skipped", reason: "no clear final" };

  const outcome = result.verdict;   // 'away' | 'home' | 'VOID'

  await db
    .prepare(
      `UPDATE markets
          SET state = 'SETTLING', settlement_source = 'espn',
              settlement_detail = ?, final_away_score = ?, final_home_score = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
    .bind(result.detail || null, result.ourAway ?? null, result.ourHome ?? null, market.id)
    .run();

  const picks = await db
    .prepare(
      `SELECT p.id, p.user_id, p.selection, p.wager, p.odds_locked, u.twitch_login
         FROM picks p
         JOIN users u ON u.twitch_id = p.user_id
        WHERE p.market_id = ? AND p.status = 'ACTIVE'`
    )
    .bind(market.id)
    .all();

  const summary = { won: 0, lost: 0, refunded: 0, failed: 0, paid: 0 };
  for (const pick of picks.results || []) {
    const out = await payPick(env, db, pick, market, outcome);
    if (out.status === "WON") { summary.won += 1; summary.paid += out.paid; }
    else if (out.status === "LOST") summary.lost += 1;
    else if (out.status === "REFUNDED") { summary.refunded += 1; summary.paid += out.paid; }
    else if (out.status === "FAILED") summary.failed += 1;
  }

  // A market with a failed payout stays in SETTLING so it is retried
  // rather than being marked done with someone unpaid.
  const finalState = summary.failed ? "SETTLING" : outcome === "VOID" ? "VOID" : "SETTLED";
  await db
    .prepare(
      `UPDATE markets
          SET state = ?, winner = ?, settled_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
    .bind(finalState, outcome === "VOID" ? null : outcome, market.id)
    .run();

  return { id: market.id, action: finalState.toLowerCase(), outcome, ...summary };
}

/* ------------------------------------------------------------ entry */

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) {
    return fail("NOT_ADMIN", "Only Picks admins can run settlement.", 403);
  }
  if (!walletWritesEnabled(context.env)) {
    return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);
  }

  // Anything past its start time and not yet finished is a candidate.
  const markets = await db
    .prepare(
      `SELECT id, sport, away_name, home_name, starts_at, state
         FROM markets
        WHERE state IN ('OPEN', 'LOCKED', 'SETTLING')
          AND datetime(starts_at) < datetime('now')
        ORDER BY starts_at ASC
        LIMIT 20`
    )
    .all();

  const results = [];
  for (const market of markets.results || []) {
    results.push(await settleMarket(context.env, db, market));
  }

  return json({ ok: true, examined: results.length, results });
}

export async function onRequestGet() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to run settlement.", 405);
}
