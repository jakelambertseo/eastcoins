/* ============================================================
   !record — settled results and net ZCoins.

   Voids are counted separately rather than folded into the record.
   A postponed game refunds the stake, and showing that as a loss
   would be wrong in a way people notice.
   ============================================================ */

import { say, botGate, findUser } from "./_bot.js";
import { badgesFor, streakOf } from "../_badges.js";

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

  // The streak, in the order things were decided, and any badges.
  const order = await db
    .prepare(`SELECT status FROM picks WHERE user_id = ? AND status IN ('WON','LOST') ORDER BY datetime(settled_at) ASC`)
    .bind(user.id)
    .all();
  const { current } = streakOf((order.results || []).map((r) => r.status));
  const streak = current >= 3 ? ` · 🔥 W${current}` : current <= -3 ? ` · 🧊 L${Math.abs(current)}` : current ? ` · ${current > 0 ? "W" : "L"}${Math.abs(current)}` : "";

  let marks = "";
  try {
    const { byLogin } = await badgesFor(context.env, db);
    marks = (byLogin[user.login] || []).filter((b) => b.key !== "hot" && b.key !== "cold" && b.key !== "fire").map((b) => b.emoji).join("");
  } catch { /* badges are decoration; the record still goes out */ }

  const sign = net > 0 ? "+" : net < 0 ? "\u2212" : "";
  return say(
    `${who}${marks ? " " + marks : ""} ${won}-${lost}${voided ? ` (${voided} void)` : ""} · ` +
    `${sign}${Math.abs(net).toLocaleString()} ZC${streak}` +
    `${active ? ` · ${active} riding` : ""}`
  );
}
