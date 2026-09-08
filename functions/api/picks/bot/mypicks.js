/* ============================================================
   !mypicks — what you currently have riding.

   Summarised, not listed in full: someone with eight active picks
   would otherwise blow the 400-byte cap and get cut mid-word. The
   first few are named and the rest are counted.
   ============================================================ */

import { say, botGate, findUser, formatLine, shortTeam } from "./_bot.js";

export async function onRequestGet(context) {
  const gate = botGate(context);
  if (!gate.ok) return gate.response;

  const db = context.env.PICKS_DB;
  if (!db) return say("Picks is offline right now.");

  const who = `@${gate.login}`;
  const user = await findUser(db, gate.login);
  if (!user) return say(`${who} you don't have any picks yet. !odds to see what's open.`);

  const rows = await db
    .prepare(
      `SELECT p.selection, p.wager, p.odds_locked,
              m.away_name, m.home_name
         FROM picks p
         JOIN markets m ON m.id = p.market_id
        WHERE p.user_id = ? AND p.status = 'ACTIVE'
        ORDER BY datetime(m.starts_at) ASC`
    )
    .bind(user.id)
    .all();

  const picks = rows.results || [];
  if (!picks.length) return say(`${who} no active picks. !odds <team> to see what's open.`);

  const staked = picks.reduce((sum, p) => sum + Number(p.wager || 0), 0);
  const named = picks.slice(0, 4).map((p) => {
    const team = p.selection === "away" ? p.away_name : p.home_name;
    return `${Number(p.wager).toLocaleString()} ${shortTeam(team)} ${formatLine(p.odds_locked)}`;
  });
  const rest = picks.length - named.length;

  return say(
    `${who} ${picks.length} active: ${named.join(", ")}` +
    `${rest > 0 ? ` +${rest} more` : ""} · ${staked.toLocaleString()} ZC riding.`
  );
}
