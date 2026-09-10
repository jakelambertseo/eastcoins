/* ============================================================
   EastCoin Picks — settlement

   Settlement is automatic from The Odds API's scores feed, but
   deliberately timid. It only acts when the feed is unambiguous:

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

import { composeOpen, composeClosed, composeSettled, composeClosingSoon } from "./_announce.js";
import { dueReminders, markSent } from "./_reminders.js";
import { autoOpenMarkets, quietInChat } from "./_autoopen.js";
import { slugFor, etDate } from "./_slug.js";
import { noteStatus } from "./_ops.js";
import { discordEnabled, postDiscord, openedEmbed, settledEmbed } from "./_discord.js";
import { lastOddsQuota } from "./_autoopen.js";
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

const ODDS_API = "https://api.the-odds-api.com/v4/sports";

/* Why not ESPN.

   ESPN's site API answers every request from Cloudflare's address range
   with HTTP 403 — verified per league, User-Agent or not. It works from a
   laptop and from a browser, which is exactly how a grader can pass every
   local test and never once succeed in production. The Odds API is built
   to be called from servers, and the site already holds a key for it. */

// Which Odds API sports a market can live under. Football is two: a market
// names its teams but not its league, so the NFL feed is tried first and
// college only if nothing there matched.
const ODDS_SPORTS = {
  baseball: ["baseball_mlb"],
  "american-football": ["americanfootball_nfl", "americanfootball_ncaaf"],
  basketball: ["basketball_nba"],
  hockey: ["icehockey_nhl"]
};

// Nothing is looked up until this long after kick-off. No game is final
// sooner, and every look-up spends quota.
const MIN_AGE_MS = 2 * 60 * 60 * 1000;

// And nothing is looked up past this. The feed only reaches back three
// days, so an older market can never be graded from it — polling would
// just spend quota forever on a game that was postponed or never matched.
// It stays visible on the admin page, where Close refunds it.
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

// The same two teams play on consecutive nights. A game only counts as
// this market's fixture if it started within this much of the market's
// own start time.
const SAME_FIXTURE_MS = 12 * 60 * 60 * 1000;

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
 * One sport's recent results. Never throws; a failure comes back as an
 * empty list WITH the status that produced it, so a run that graded
 * nothing can say whether the API refused, the key is missing, or there
 * simply was no matching game — three very different problems.
 */
// The Odds API reports quota on every response; the dashboard reads the
// latest one from the status notes settlement leaves behind.
let lastScoresQuota = null;

async function fetchScores(env, sportKey, daysFrom) {
  const apiKey = String(env.ODDS_API_KEY || "").trim();
  if (!apiKey) return { games: [], status: 0, note: "no ODDS_API_KEY" };

  const query = new URLSearchParams({ apiKey, daysFrom: String(daysFrom) });
  try {
    const response = await fetch(`${ODDS_API}/${encodeURIComponent(sportKey)}/scores/?${query}`);
    if (!response.ok) {
      console.error(`Odds API scores ${sportKey}: HTTP ${response.status}`);
      return { games: [], status: response.status };
    }
    const payload = await response.json();
    lastScoresQuota = {
      used: Number(response.headers.get("x-requests-used")),
      remaining: Number(response.headers.get("x-requests-remaining")),
      last: `scores ${sportKey}`
    };
    return {
      games: Array.isArray(payload) ? payload : [],
      status: 200,
      remaining: response.headers.get("x-requests-remaining")
    };
  } catch (error) {
    console.error(`Odds API scores ${sportKey} threw`, error);
    return { games: [], status: 0 };
  }
}

// One request per sport per RUN, however many markets share it.
async function scoresFor(cache, env, sportKey, daysFrom) {
  const key = `${sportKey}:${daysFrom}`;
  if (!cache.has(key)) cache.set(key, await fetchScores(env, sportKey, daysFrom));
  return cache.get(key);
}

/**
 * Returns a verdict for a market, or { skip, detail } when the feed does
 * not clearly say. A skip always means "leave it alone and look again" —
 * except "stale", which means stop looking.
 */
async function findResult(env, market, boards) {
  const keys = ODDS_SPORTS[String(market.sport || "").toLowerCase()] || [];
  if (!keys.length) return { skip: "no-sport", detail: String(market.sport) };

  const wantAway = nickname(market.away_name);
  const wantHome = nickname(market.home_name);
  if (!wantAway || !wantHome) return { skip: "no-names" };

  const started = new Date(market.starts_at).getTime();
  if (!Number.isFinite(started)) return { skip: "no-date", detail: String(market.starts_at) };

  const age = Date.now() - started;
  if (age < MIN_AGE_MS) return { skip: "too-early", detail: `${Math.round(age / 60000)}m since start` };
  if (age > MAX_AGE_MS) return { skip: "stale", detail: "older than the feed reaches; close it from the admin page" };

  // Reach back only as far as this market needs. 1 day is one credit,
  // more is two, and most games are graded the same night they finish.
  const daysFrom = Math.min(3, Math.max(1, Math.ceil(age / 86400000) + 1));

  let seen = 0;
  const statuses = [];

  for (const sportKey of keys) {
    const board = await scoresFor(boards, env, sportKey, daysFrom);
    statuses.push(`${sportKey}=${board.status}${board.note ? ` (${board.note})` : ""}`);
    seen += board.games.length;

    for (const game of board.games) {
      const gotAway = nickname(game.away_team);
      const gotHome = nickname(game.home_team);

      // Both sides must match, in either orientation.
      const straight = gotAway === wantAway && gotHome === wantHome;
      const flipped = gotAway === wantHome && gotHome === wantAway;
      if (!straight && !flipped) continue;

      // Right teams, wrong night: keep looking.
      const when = new Date(game.commence_time).getTime();
      if (Number.isFinite(when) && Math.abs(when - started) > SAME_FIXTURE_MS) continue;

      if (!game.completed) {
        return { skip: "not-final", detail: `in progress, commenced ${game.commence_time}` };
      }

      const scores = Array.isArray(game.scores) ? game.scores : [];
      const scoreOf = (teamName) => {
        const want = nickname(teamName);
        const row = scores.find((entry) => nickname(entry?.name) === want);
        return Number(row?.score);
      };
      const awayScore = scoreOf(game.away_team);
      const homeScore = scoreOf(game.home_team);
      if (!Number.isInteger(awayScore) || !Number.isInteger(homeScore)) {
        return { skip: "no-score", detail: JSON.stringify(scores).slice(0, 140) };
      }

      // Our market's "home" is whichever side matched our home name.
      const ourHome = straight ? homeScore : awayScore;
      const ourAway = straight ? awayScore : homeScore;

      if (ourHome === ourAway) {
        return { verdict: "VOID", detail: `Tied ${ourAway}\u2013${ourHome}`, ourAway, ourHome };
      }
      return { verdict: ourHome > ourAway ? "home" : "away", detail: "Final", ourAway, ourHome };
    }
  }

  if (!seen) return { skip: "no-board", detail: statuses.join(", ") };
  return { skip: "no-match", detail: `wanted ${wantAway} @ ${wantHome}; ${seen} game(s), daysFrom=${daysFrom}` };
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
  const result = await findResult(env, market, boards);
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
          SET state = 'SETTLING', settlement_source = 'odds-api',
              settlement_detail = ?, final_away_score = ?, final_home_score = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`
    )
    .bind(result.detail || null, result.ourAway ?? null, result.ourHome ?? null, market.id)
    .run();

  const picks = await db
    .prepare(
      `SELECT p.id, p.user_id, p.selection, p.wager, p.odds_locked, u.twitch_login, u.display_name
         FROM picks p
         JOIN users u ON u.twitch_id = p.user_id
        WHERE p.market_id = ? AND p.status = 'ACTIVE'`
    )
    .bind(market.id)
    .all();

  const summary = { won: 0, lost: 0, refunded: 0, failed: 0, paid: 0, lines: [] };
  for (const pick of picks.results || []) {
    const out = await payPick(env, db, pick, market, outcome);
    if (out.status === "WON") { summary.won += 1; summary.paid += out.paid; }
    else if (out.status === "LOST") summary.lost += 1;
    else if (out.status === "REFUNDED") { summary.refunded += 1; summary.paid += out.paid; }
    else if (out.status === "FAILED") summary.failed += 1;
    // One line per pick for the Discord card — the public ledger, no balances.
    summary.lines.push({
      name: String(pick.display_name || pick.twitch_login || ""),
      login: String(pick.twitch_login || "").toLowerCase(),
      team: pick.selection === "home" ? market.home_name : market.away_name,
      odds: Number(pick.odds_locked),
      wager: Number(pick.wager),
      status: out.status,
      profit: out.status === "WON" ? Number(out.paid) - Number(pick.wager) : out.status === "LOST" ? -Number(pick.wager) : 0
    });
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
    // For the link in chat: one game gets its page, a slate gets the day.
    slug: slugFor(market),
    day: etDate(market.starts_at),
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

  // Before locking or settling anything: open whatever is due. Same tick,
  // same schedule, nothing extra to deploy. Idempotent, so an admin
  // pressing Run settlement by hand cannot double-open a game.
  let opened = [];
  try {
    opened = await autoOpenMarkets(context.env, db);
  } catch (error) {
    // Never let the opener take settlement down with it: a payout that
    // is due matters more than a market that is not open yet.
    console.error("auto-open threw", error);
  }
  // Chat hears only the loud sports (NFL). Discord hears everything.
  const loudOpened = opened.filter((m) => !quietInChat(m.sport));
  if (loudOpened.length) {
    const said = await sayInChat(context.env, composeOpen(loudOpened));
    if (!said.ok) console.error(`Picks: couldn't announce ${loudOpened.length} auto-opened market(s): ${said.error}`);
  }
  if (opened.length && discordEnabled(context.env)) await postDiscord(context.env, openedEmbed(opened)).catch(() => {});

  // The countdown: 30, 10 and 5 minutes before kick-off, once each.
  // A market opened this very tick is skipped for this tick so "open"
  // and "closing in 58 minutes" do not land back to back.
  const reminded = [];
  try {
    const justOpened = new Set(opened.map((m) => m.id));
    for (const group of await dueReminders(db)) {
      const markets = group.markets.filter((m) => !justOpened.has(m.id) && !quietInChat(m.sport));
      if (!markets.length) { await markSent(db, group); continue; }
      const said = await sayInChat(context.env, composeClosingSoon(markets, group.minutes));
      if (!said.ok) { console.error(`Picks: couldn't post the ${group.threshold}-minute reminder: ${said.error}`); continue; }
      await markSent(db, group);
      reminded.push(`${group.threshold}m: ${markets.length}`);
    }
  } catch (error) {
    console.error("reminders threw", error);
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

  // Only the loud sports get a closing line; the totals are theirs too.
  const closingRows = (closing.results || []).filter((m) => !quietInChat(m.sport));
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
  const settledMessage = composeSettled(results.filter((r) => !quietInChat(r.sport)));
  if (settledMessage) {
    const said = await sayInChat(context.env, settledMessage);
    if (!said.ok) {
      console.error(`Picks: couldn't announce settlement: ${said.error}`);
    }
  }
  // The quiet sports (MLB) still get their finals in chat — one line per
  // game with the score, winners and payout, and nothing else all day.
  for (const r of results) {
    if (!quietInChat(r.sport) || r.action === "skipped") continue;
    const line = composeSettled([r]);
    if (!line) continue;
    const said = await sayInChat(context.env, line);
    if (!said.ok) console.error(`Picks: couldn't announce ${r.away} at ${r.home} final: ${said.error}`);
  }
  // Discord gets one card per game that settled, in the same tick.
  if (discordEnabled(context.env)) {
    const cards = results.map(settledEmbed).filter(Boolean);
    if (cards.length) await postDiscord(context.env, cards).catch(() => {});
  }

  // Leave a note for the dashboard: when this ran, what it did, and the
  // latest Odds API quota seen on the way.
  const settledCount = results.filter((r) => r.action === "settled").length;
  const failedPayouts = results.reduce((n, r) => n + Number(r.failed || 0), 0);
  await noteStatus(db, "settle:last", {
    by: auth.by,
    summary: `${opened.length} opened · ${reminded.length ? reminded.join(", ") + " reminded · " : ""}${Number(locked?.meta?.changes || 0)} locked · ${closingRows.length} closed · ${settledCount} settled` +
      `${failedPayouts ? ` · ${failedPayouts} payout(s) FAILED` : ""}`
  });
  const quota = lastScoresQuota || lastOddsQuota();
  if (quota && (Number.isFinite(quota.used) || Number.isFinite(quota.remaining))) await noteStatus(db, "odds:quota", quota);

  return json({
    ok: true,
    by: auth.by,
    announced: settledMessage || null,
    opened: opened.map((m) => `${m.away_name} at ${m.home_name}`),
    reminded,
    locked: Number(locked?.meta?.changes || 0),
    closed: closingRows.map((m) => `${m.away_name} at ${m.home_name}`),
    examined: results.length,
    results
  });
}

export async function onRequestGet() {
  return fail("METHOD_NOT_ALLOWED", "Use POST to run settlement.", 405);
}
