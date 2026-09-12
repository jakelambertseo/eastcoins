/* ============================================================
   !record — settled results, net ZCoins and season rank.

   Voids are counted separately rather than folded into the record.
   A postponed game refunds the stake, and showing that as a loss
   would be wrong in a way people notice.

   The rank is the same standings the Picks leaderboard shows, so
   "Ranked #3/25" in chat and "#3 of 25" on the site always agree.
   ============================================================ */

import { say, botGate, findUser } from "./_bot.js";
import { streakOf } from "../_badges.js";

export async function onRequestGet(context) {
  const gate = botGate(context);
  if (!gate.ok) return gate.response;

  const db = context.env.PICKS_DB;
  if (!db) return say("Picks is offline right now.");

  const who = `@${gate.login}`;
  const user = await findUser(db, gate.login);
  if (!user) return say(`${who} no picks on record yet. !odds to see what's open.`);

  const row = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'WON'      THEN 1 ELSE 0 END) AS won,
         SUM(CASE WHEN status = 'LOST'     THEN 1 ELSE 0 END) AS lost,
         SUM(CASE WHEN status = 'REFUNDED' THEN 1 ELSE 0 END) AS voided,
         SUM(CASE WHEN status = 'ACTIVE'   THEN 1 ELSE 0 END) AS active,
         COALESCE(SUM(CASE WHEN status IN ('WON','LOST') THEN profit ELSE 0 END), 0) AS net
       FROM picks
      WHERE user_id = ?`
    )
    .bind(user.id)
    .first();

  const won = Number(row?.won || 0);
  const lost = Number(row?.lost || 0);
  const voided = Number(row?.voided || 0);
  const active = Number(row?.active || 0);
  const net = Number(row?.net || 0);

  if (!won && !lost && !active) {
    return say(`${who} no picks yet. !odds <team> to see what's open.`);
  }
  if (!won && !lost) {
    return say(`${who} nothing settled yet · ${active} pick${active === 1 ? "" : "s"} riding.`);
  }

  // The streak, in the order things were decided. Titles stay off this
  // line on purpose — the profile page wears them; chat stays clean.
  const order = await db
    .prepare(`SELECT status FROM picks WHERE user_id = ? AND status IN ('WON','LOST') ORDER BY datetime(settled_at) ASC`)
    .bind(user.id)
    .all();
  const { current } = streakOf((order.results || []).map((r) => r.status));
  const streak = current >= 3 ? ` · 🔥 W${current}` : current <= -3 ? ` · 🧊 L${Math.abs(current)}` : current ? ` · ${current > 0 ? "W" : "L"}${Math.abs(current)}` : "";

  // A failed rank read drops the rank, never the whole reply.
  const ranked = await seasonRank(db, user.id).catch(() => null);
  const rank = ranked ? ` · Ranked #${ranked.rank}/${ranked.players}` : "";

  const sign = net > 0 ? "+" : net < 0 ? "−" : "";
  return say(
    `${who} ${won}-${lost}${voided ? ` (${voided} void)` : ""} · ` +
    `${sign}${Math.abs(net).toLocaleString()} ZC${rank}${streak}` +
    `${active ? ` · ${active} riding` : ""}`
  );
}

/* Where they sit in bootstrap.js getLeaderboard(): this season's settled
   picks, by profit, then wins, then login. Null when there is no active
   season or nothing of theirs has settled in it. */
async function seasonRank(db, userId) {
  const season = await db.prepare(`SELECT id FROM seasons WHERE active = 1 LIMIT 1`).first();
  if (!season) return null;
  const rows = await db
    .prepare(
      `SELECT p.user_id
         FROM picks p
         JOIN users u   ON u.twitch_id = p.user_id
         JOIN markets m ON m.id = p.market_id
        WHERE m.season_id = ? AND p.status IN ('WON','LOST')
        GROUP BY p.user_id
        ORDER BY SUM(p.profit) DESC,
                 SUM(CASE WHEN p.status = 'WON' THEN 1 ELSE 0 END) DESC,
                 u.twitch_login ASC`
    )
    .bind(season.id)
    .all();
  const list = rows.results || [];
  const at = list.findIndex((r) => String(r.user_id) === String(userId));
  return at === -1 ? null : { rank: at + 1, players: list.length };
}
