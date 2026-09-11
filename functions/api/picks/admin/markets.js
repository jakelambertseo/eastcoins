/* ============================================================
   EastCoin Picks — admin market list

   Everything an operator needs to see before touching anything:
   the locked prices, how much is actually riding on each side, and
   whether any payout failed. Money figures are recomputed here from
   the stored line and stake rather than read from a client.
   ============================================================ */

import {
  ADMIN_ALLOWLIST,
  getSessionUser,
  totalReturn,
  json,
  fail
} from "../_lib.js";
import { readStatus } from "../_ops.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) {
    return fail("NOT_ADMIN", "Only Picks admins can view this.", 403);
  }

  const markets = await db
    .prepare(
      `SELECT id, sport, league, away_name, home_name, starts_at, state,
              away_odds_locked, home_odds_locked, winner,
              settlement_detail, final_away_score, final_home_score
         FROM markets
        ORDER BY starts_at DESC
        LIMIT 200`
    )
    .all();

  const picks = await db
    .prepare(
      `SELECT p.market_id, p.selection, p.wager, p.odds_locked, p.status,
              u.twitch_login
         FROM picks p
         JOIN users u ON u.twitch_id = p.user_id`
    )
    .all();

  // Any operation still owing someone money. Surfaced per market so a
  // stuck payout is visible rather than buried in the ledger.
  const stuck = await db
    .prepare(
      `SELECT market_id, COUNT(*) AS n
         FROM wallet_operations
        WHERE status IN ('PENDING', 'NEEDS_RECONCILIATION')
        GROUP BY market_id`
    )
    .all();

  const stuckBy = new Map((stuck.results || []).map((r) => [r.market_id, Number(r.n)]));

  // When each market was last announced from the admin page.
  const ids = (markets.results || []).map((m) => m.id);
  let announced = {};
  if (ids.length) {
    try { announced = await readStatus(db, ids.map((id) => `announce:${id}`)); } catch { announced = {}; }
  }
  const picksBy = new Map();
  for (const pick of picks.results || []) {
    if (!picksBy.has(pick.market_id)) picksBy.set(pick.market_id, []);
    picksBy.get(pick.market_id).push(pick);
  }

  const rows = (markets.results || []).map((market) => {
    const list = picksBy.get(market.id) || [];
    const side = (which) => {
      const chosen = list.filter((p) => p.selection === which);
      const staked = chosen.reduce((sum, p) => sum + Number(p.wager || 0), 0);
      return {
        picks: chosen.length,
        staked,
        // What the house owes if this side wins, at each pick's own line.
        exposure: chosen.reduce(
          (sum, p) => sum + totalReturn(p.wager, p.odds_locked), 0
        )
      };
    };

    return {
      id: market.id,
      sport: market.sport,
      league: market.league,
      away: market.away_name,
      home: market.home_name,
      startsAt: market.starts_at,
      state: market.state,
      awayOdds: market.away_odds_locked,
      homeOdds: market.home_odds_locked,
      winner: market.winner,
      settlementDetail: market.settlement_detail,
      finalScore:
        market.final_away_score === null || market.final_away_score === undefined
          ? null
          : `${market.final_away_score}–${market.final_home_score}`,
      totals: { away: side("away"), home: side("home"), picks: list.length },
      needsAttention: stuckBy.get(market.id) || 0,
      lastAnnounced: announced[`announce:${market.id}`]?.value?.at || null,
      bettors: list.map((p) => ({
        login: p.twitch_login,
        selection: p.selection,
        wager: p.wager,
        odds: p.odds_locked,
        status: p.status,
        returnsIfWon: totalReturn(p.wager, p.odds_locked)
      }))
    };
  });

  return json({ ok: true, admin: user.login, markets: rows });
}
