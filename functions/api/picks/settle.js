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

import { composeClosed, composeSettled } from "./_announce.js";
import {
  ADMIN_ALLOWLIST,
  getSessionUser,
  sayInChat,
  safeEqual,
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

// A Cloudflare fetch sends no User-Agent by default, and ESPN's site API
// is known to answer UA-less datacenter requests with an error page or an
// empty body. Every developer machine sends one, which is exactly how a
// grader can pass locally and refuse in production.
const ESPN_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; EastCoinPicks/1.0; +https://eastcoin.vip)",
  "Accept": "application/json"
};
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

/**
 * ESPN's scoreboard day, for a market's start time.
 *
 * This is load-bearing. Without a date, /scoreboard returns whatever
 * ESPN calls "today", and team names alone do not identify a game: the
 * same two teams play a series on consecutive nights. A market left
 * ungraded overnight would then match the NEXT night's meeting and
 * settle on the wrong score — paying real ZCoins to whoever that other
 * game happened to favour.
 *
 * ESPN buckets a game by its US Eastern calendar date, so a 10pm ET
 * start belongs to that day rather than the following UTC one.
 */
function espnDate(startsAt) {
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) return "";
  // en-CA formats as YYYY-MM-DD, which is one substitution from ESPN's
  // YYYYMMDD and avoids assembling the parts by hand.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(when).replace(/-/g, "");
}

async function boardFor(cache, path, date) {
  const key = `${path}:${date}`;
  if (!cache.has(key)) cache.set(key, await fetchScoreboard(path, date));
  return cache.get(key);
}

/**
 * One league's board for one day. Never throws; a failure comes back as
 * an empty board WITH the status that produced it, so a run that graded
 * nothing can say whether ESPN refused, timed out, or simply had no
 * matching game — three very different problems that used to share one
 * message.
 */
async function fetchScoreboard(path, date) {
  const query = date ? `?dates=${encodeURIComponent(date)}` : "";
  try {
    const response = await fetch(`${ESPN_BASE}/${path}/scoreboard${query}`, { headers: ESPN_HEADERS });
    if (!response.ok) {
      console.error(`ESPN ${path} ${date}: HTTP ${response.status}`);
      return { events: [], status: response.status };
    }
    const payload = await response.json();
    return { events: Array.isArray(payload?.events) ? payload.events : [], status: 200 };
  } catch (error) {
    console.error(`ESPN ${path} ${date} threw`, error);
    return { events: [], status: 0 };
  }
}

/**
 * Returns a verdict for a market, or null when the feed doesn't
 * clearly say. Null always means "leave it alone and look again".
 */
async function findResult(market, boards) {
  const paths = LEAGUE_PATHS[String(market.sport || "").toLowerCase()] || [];
  if (!paths.length) return null;

  const wantAway = nickname(market.away_name);
  const wantHome = nickname(market.home_name);
  if (!wantAway || !wantHome) return null;

  // No date means no safe lookup — refuse rather than fall back to
  // today's board, which is exactly the wrong-game case.
  const date = espnDate(market.starts_at);
  if (!date) return { skip: "no-date", detail: String(market.starts_at) };

  let seen = 0;
  const statuses = [];

  for (const path of paths) {
    const board = await boardFor(boards, path, date);
    statuses.push(`${path}=${board.status}`);
    seen += board.events.length;

    for (const event of board.events) {
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
      if (!status.completed || status.state !== "post") {
        return { skip: "not-final", detail: `${status.state || "?"} — ${status.detail || status.name || ""}` };
      }

      // A postponed or cancelled game can carry state "post".
      const name = String(status.name || "").toUpperCase();
      if (name.includes("POSTPONED") || name.includes("CANCELED") ||
          name.includes("CANCELLED") || name.includes("SUSPENDED")) {
        return { verdict: "VOID", detail: status.detail || name };
      }

      const homeScore = Number(espnHome.score);
      const awayScore = Number(espnAway.score);
      if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
        return { skip: "no-score", detail: `${espnAway.score}-${espnHome.score}` };
      }

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

  // Say which of the two very different "nothing to grade" cases this is.
  if (!seen) return { skip: "no-board", detail: statuses.join(", ") };
  return { skip: "no-match", detail: `wanted ${wantAway} @ ${wantHome}; ${seen} event(s) on ${date}` };
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

async function settleMarket(env, db, market, boards) {
  const result = await findResult(market, boards);
  if (!result || result.skip) {
    return {
      id: market.id,
      action: "skipped",
      reason: result?.skip || "no clear final",
      detail: result?.detail || ""
    };
  }

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

  return {
    id: market.id,
    action: finalState.toLowerCase(),
    outcome,
    sport: market.sport,
    away: market.away_name,
    home: market.home_name,
    winnerName: outcome === "VOID"
      ? null
      : outcome === "home" ? market.home_name : market.away_name,
    awayScore: result.ourAway ?? null,
    homeScore: result.ourHome ?? null,
    ...summary
  };
}

/* ------------------------------------------------------------ entry */

/**
 * Two ways in, because settlement has two legitimate callers: an admin
 * pressing the button, and the scheduled Worker that runs it when
 * nobody is watching. The Worker has no cookie, so it presents a shared
 * key in a header instead.
 *
 * Fails closed: an unset PICKS_CRON_KEY means no key is accepted, not
 * that any key will do.
 */
async function authorize(context, db) {
  const user = await getSessionUser(db, context.request);
  if (user && ADMIN_ALLOWLIST.has(user.login)) return { ok: true, by: user.login };

  const expected = String(context.env.PICKS_CRON_KEY || "").trim();
  const given = String(context.request.headers.get("X-Picks-Cron-Key") || "").trim();
  if (expected && given && safeEqual(given, expected)) return { ok: true, by: "cron" };

  return { ok: false };
}

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const auth = await authorize(context, db);
  if (!auth.ok) {
    return fail("NOT_ADMIN", "Only Picks admins can run settlement.", 403);
  }
  if (!walletWritesEnabled(context.env)) {
    return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);
  }

  // A market past its start time is no longer open. wagers.js already
  // refuses late picks, but leaving the state stale makes both the admin
  // page and the site claim betting is live when it is not. Doing it here
  // means the same schedule that settles also closes.
  //
  // Read the set BEFORE the update so chat can be told which games shut,
  // and so the count is what actually changed rather than what happens to
  // match a second later.
  const closing = await db
    .prepare(
      `SELECT id, sport, away_name, home_name
         FROM markets
        WHERE state = 'OPEN'
          AND datetime(starts_at) <= datetime('now')`
    )
    .all();

  const closingRows = closing.results || [];
  let riding = { picks: 0, staked: 0 };

  if (closingRows.length) {
    const marks = closingRows.map(() => "?").join(",");
    const totals = await db
      .prepare(
        `SELECT COUNT(*) AS picks, COALESCE(SUM(wager), 0) AS staked
           FROM picks
          WHERE status = 'ACTIVE' AND market_id IN (${marks})`
      )
      .bind(...closingRows.map((m) => m.id))
      .first();
    riding = { picks: Number(totals?.picks || 0), staked: Number(totals?.staked || 0) };
  }

  const locked = await db
    .prepare(
      `UPDATE markets
          SET state = 'LOCKED', updated_at = CURRENT_TIMESTAMP
        WHERE state = 'OPEN'
          AND datetime(starts_at) <= datetime('now')`
    )
    .run();

  // Safe to run every tick: a market crosses OPEN -> LOCKED exactly once,
  // so the next run finds nothing to announce. One message regardless of
  // how many closed at the same moment.
  if (closingRows.length) {
    const message = composeClosed(closingRows, riding);
    const said = await sayInChat(context.env, message);
    if (!said.ok) {
      console.error(`Picks: couldn't announce ${closingRows.length} closing market(s): ${said.error}`);
    }
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

  // Shared across every market in this run, so a ten-game slate costs
  // one scoreboard request per league rather than ten.
  const boards = new Map();

  const results = [];
  for (const market of markets.results || []) {
    results.push(await settleMarket(context.env, db, market, boards));
  }

  // Same guarantee as the closing message: a market settles once, then
  // drops out of the candidate set, so this cannot repeat on the next
  // tick.
  const settledMessage = composeSettled(results);
  if (settledMessage) {
    const said = await sayInChat(context.env, settledMessage);
    if (!said.ok) {
      console.error(`Picks: couldn't announce settlement: ${said.error}`);
    }
  }

  return json({
    ok: true,
    by: auth.by,
    announced: settledMessage || null,
    locked: Number(locked?.meta?.changes || 0),
    closed: closingRows.map((m) => `${m.away_name} at ${m.home_name}`),
    examined: results.length,
    results
  });
}

export async function onRequestGet() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to run settlement.", 405);
}
