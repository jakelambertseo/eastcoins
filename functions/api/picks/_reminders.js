/* ============================================================
   EastCoin Picks — "closing in X minutes"

   A market opens an hour before kick-off and chat is told once.
   Then, as the clock runs down, it is told again at 30, 10 and 5
   minutes — one message per threshold per tick, however many
   games share it, so a Sunday slate is three reminders, not
   thirty.

   Each (market, threshold) pair is recorded when posted, so a
   tick can never repeat one, and a market that opens late (a
   manual one, ten minutes out) only gets the smallest threshold
   that still applies rather than all three at once.
   ============================================================ */

export const THRESHOLDS = [30, 10, 5];   // minutes before kick-off, largest first

let ready = false;

async function ensure(db) {
  if (ready) return;
  await db
    .prepare(`CREATE TABLE IF NOT EXISTS picks_reminders (market_id TEXT NOT NULL, threshold INTEGER NOT NULL, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (market_id, threshold))`)
    .run();
  ready = true;
}

/**
 * Which open markets are due a reminder right now, grouped by the
 * threshold they have just crossed. Returns [{ threshold, minutes, markets }].
 */
export async function dueReminders(db, now = Date.now()) {
  await ensure(db);
  const rows = await db
    .prepare(`SELECT id, sport, league, away_name, home_name, away_odds_locked, home_odds_locked, starts_at FROM markets WHERE state = 'OPEN' AND datetime(starts_at) > datetime('now')`)
    .all();
  const open = rows.results || [];
  if (!open.length) return [];

  const marks = open.map(() => "?").join(",");
  const sent = await db
    .prepare(`SELECT market_id, threshold FROM picks_reminders WHERE market_id IN (${marks})`)
    .bind(...open.map((m) => m.id))
    .all();
  const done = new Set((sent.results || []).map((r) => `${r.market_id}:${r.threshold}`));

  const groups = new Map();
  for (const m of open) {
    const minutesLeft = (new Date(m.starts_at).getTime() - now) / 60000;
    if (!(minutesLeft > 0)) continue;
    // The smallest threshold this market is inside of and has not had.
    const crossed = THRESHOLDS.filter((t) => minutesLeft <= t);
    if (!crossed.length) continue;
    const smallest = crossed[crossed.length - 1];
    if (done.has(`${m.id}:${smallest}`)) continue;
    const g = groups.get(smallest) || { threshold: smallest, minutes: Math.max(1, Math.round(minutesLeft)), markets: [], marks: [] };
    g.markets.push(m);
    // Everything at or above the one posted counts as done too.
    for (const t of crossed) g.marks.push([m.id, t]);
    g.minutes = Math.min(g.minutes, Math.max(1, Math.round(minutesLeft)));
    groups.set(smallest, g);
  }
  return [...groups.values()].sort((a, b) => a.threshold - b.threshold);
}

/** Records that a group's reminder went out, so it never goes out twice. */
export async function markSent(db, group) {
  await ensure(db);
  const stmts = group.marks.map(([id, t]) =>
    db.prepare(`INSERT OR IGNORE INTO picks_reminders (market_id, threshold) VALUES (?, ?)`).bind(id, t)
  );
  if (stmts.length) await db.batch(stmts);
}
