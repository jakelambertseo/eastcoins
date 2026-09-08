/* ============================================================
   !record — settled results and net ZCoins.

   Voids are counted separately rather than folded into the record.
   A postponed game refunds the stake, and showing that as a loss
   would be wrong in a way people notice.
   ============================================================ */

import { say, botGate, findUser } from "./_bot.js";

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

  const sign = net > 0 ? "+" : net < 0 ? "\u2212" : "";
  return say(
    `${who} ${won}-${lost}${voided ? ` (${voided} void)` : ""} · ` +
    `${sign}${Math.abs(net).toLocaleString()} ZC` +
    `${active ? ` · ${active} riding` : ""}`
  );
}
