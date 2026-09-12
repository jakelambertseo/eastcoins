import { versus } from "./_fights.js";
/* ============================================================
   EastCoin Picks — one game, read back from the ledger

   Shared by the JSON endpoint the site renders from and by the
   /g/ route that only needs a title. Everything here is a read;
   the numbers come from the same rows settlement wrote, so the
   page can never disagree with what was paid.
   ============================================================ */

import { slugFor, parseSlug, dayBounds, etDate } from "./_slug.js";
import { totalReturn } from "./_lib.js";

export async function loadMarket(db, path) {
  if (/^mkt_/.test(path)) {
    return db.prepare(`SELECT * FROM markets WHERE id = ? LIMIT 1`).bind(path).first();
  }
  const parsed = parseSlug(path);
  const bounds = parsed && dayBounds(parsed.day);
  if (!bounds) return null;

  const rows = await db
    .prepare(
      `SELECT m.*, (SELECT COUNT(*) FROM picks p WHERE p.market_id = m.id) AS pick_count
         FROM markets m
        WHERE datetime(m.starts_at) BETWEEN datetime(?) AND datetime(?)
        ORDER BY m.starts_at`
    )
    .bind(bounds.from, bounds.to)
    .all();

  const hits = (rows.results || []).filter((m) => slugFor(m) === path);
  if (!hits.length) return null;
  return preferred(hits);
}

export async function loadPicks(db, marketId) {
  const rows = await db
    .prepare(
      `SELECT p.id, p.selection, p.wager, p.odds_locked, p.status, p.payout, p.profit,
              p.created_at, p.settled_at,
              u.twitch_login, u.display_name, u.avatar_url
         FROM picks p JOIN users u ON u.twitch_id = p.user_id
        WHERE p.market_id = ?
        ORDER BY p.profit DESC, p.wager DESC, p.created_at ASC`
    )
    .bind(marketId)
    .all();
  return rows.results || [];
}

export async function loadOps(db, marketId) {
  const rows = await db
    .prepare(`SELECT status, COUNT(*) AS n FROM wallet_operations WHERE market_id = ? GROUP BY status`)
    .bind(marketId)
    .all();
  const out = { total: 0, confirmed: 0 };
  for (const r of rows.results || []) {
    out.total += Number(r.n);
    if (r.status === "CONFIRMED") out.confirmed += Number(r.n);
  }
  return out;
}

// Two markets for one fixture (a reopened one, or a test that was voided
// and run again): the one that settled with picks on it is the game.
// Settled first, then anything live, then whatever was voided — a
// test market someone closed by hand must never stand in for the real
// game that opens later under the same name.
const RANK = { SETTLED: 3, SETTLING: 2, LOCKED: 2, OPEN: 2, VOID: 0, CANCELLED: 0 };
function preferred(markets) {
  return markets.slice().sort((a, b) =>
    ((RANK[b.state] ?? 1) - (RANK[a.state] ?? 1)) ||
    (Number(b.pick_count || 0) - Number(a.pick_count || 0)) ||
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  )[0];
}

export async function loadDay(db, day) {
  const bounds = dayBounds(day);
  if (!bounds) return [];
  const rows = await db
    .prepare(
      `SELECT m.*, (SELECT COUNT(*) FROM picks p WHERE p.market_id = m.id) AS pick_count
         FROM markets m
        WHERE datetime(m.starts_at) BETWEEN datetime(?) AND datetime(?)
        ORDER BY m.starts_at`
    )
    .bind(bounds.from, bounds.to)
    .all();

  // One row per game, however many markets the night produced for it.
  const bySlug = new Map();
  for (const m of rows.results || []) {
    const slug = slugFor(m);
    bySlug.set(slug, preferred([...(bySlug.get(slug) ? [bySlug.get(slug)] : []), m]));
  }
  return [...bySlug.values()].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));
}

// D1 writes CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC with no zone
// marker; without the Z a browser would read it as local time.
export const utc = (v) => (v && !/[TZ]/.test(v) ? v.replace(" ", "T") + "Z" : v || null);

const intOrNull = (v) => (Number.isInteger(v) ? v : null);

export function marketPayload(m) {
  return {
    id: String(m.id),
    slug: slugFor(m),
    day: etDate(m.starts_at),
    sport: String(m.sport || ""),
    league: String(m.league || ""),
    state: String(m.state || ""),
    startsAt: m.starts_at,
    settledAt: utc(m.settled_at),
    settlementSource: m.settlement_source || null,
    settlementDetail: m.settlement_detail || null,
    winner: m.winner || null,
    away: { name: String(m.away_name), line: intOrNull(m.away_odds_locked), score: intOrNull(m.final_away_score) },
    home: { name: String(m.home_name), line: intOrNull(m.home_odds_locked), score: intOrNull(m.final_home_score) },
    picks: m.pick_count == null ? undefined : Number(m.pick_count),
    live: m.state === "LOCKED" && Number.isInteger(intOrNull(m.live_away_score)) && Number.isInteger(intOrNull(m.live_home_score))
      ? { away: intOrNull(m.live_away_score), home: intOrNull(m.live_home_score), at: utc(m.live_updated_at) }
      : null
  };
}

export function pickPayload(p) {
  return {
    id: String(p.id),
    user: {
      login: String(p.twitch_login),
      displayName: String(p.display_name || p.twitch_login),
      avatar: String(p.avatar_url || "")
    },
    selection: String(p.selection),
    wager: Number(p.wager),
    line: intOrNull(p.odds_locked),
    status: String(p.status),
    payout: Number(p.payout || 0),
    profit: Number(p.profit || 0),
    // What an open pick returns if it lands — same rounding as settlement.
    potential: totalReturn(p.wager, p.odds_locked),
    createdAt: utc(p.created_at),
    settledAt: utc(p.settled_at)
  };
}

/** Title for a game, used by the /g/ route so a pasted link previews well. */
export function titleFor(m) {
  const score = m.state === "SETTLED" && Number.isInteger(m.final_away_score)
    ? ` ${m.final_away_score}–${m.final_home_score}` : "";
  return `${m.away_name} ${versus(m.sport)} ${m.home_name}${score} — EastCoin Picks`;
}
