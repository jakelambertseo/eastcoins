/* ============================================================
   EastCoin Picks — prop bets

   "Will Mahomes throw for 300?" is a market like any other: sport
   'prop', league 'PROP', away_name 'Yes', home_name 'No', the lines
   locked when it opens, one pick per person, the same wallet path.
   The question lives in markets.question (migration 0003). Nothing
   grades a prop on its own — it is in MANUAL_SPORTS, so the
   scheduled run leaves it alone and an admin calls it (Yes / No /
   void) from the admin page, which pays through applyVerdict like
   a fight.

   Everything that names a market goes through matchup() and
   sideLabel() here, so chat, Discord, the ticker and the pages all
   read the question rather than "Yes at No".
   ============================================================ */

import { versus } from "./_fights.js";

export const PROP_SPORT = "prop";
export const PROP_LEAGUE = "PROP";
export const YES = "Yes";
export const NO = "No";
export const MAX_QUESTION = 140;

export function isProp(sport) {
  return String(sport || "").toLowerCase() === PROP_SPORT;
}

/** Adds markets.question when the migration has not been applied. Idempotent. */
export async function ensureQuestionColumn(db) {
  try { await db.prepare(`ALTER TABLE markets ADD COLUMN question TEXT`).run(); } catch { /* already there */ }
}

/** Tidies a typed question: one line, trimmed, ends in a question mark. */
export function cleanQuestion(raw) {
  let q = String(raw || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_QUESTION);
  if (q && !/[?!.]$/.test(q)) q += "?";
  return q;
}

/** "Rangers at Mariners", "Garcia vs Benn", or the question itself. */
export function matchup(m) {
  if (isProp(m?.sport)) return String(m.question || `${m.away_name ?? m.away ?? YES} or ${m.home_name ?? m.home ?? NO}`);
  const away = m?.away_name ?? m?.away ?? "";
  const home = m?.home_name ?? m?.home ?? "";
  return `${away} ${versus(m?.sport)} ${home}`;
}

/** The name of one side: a team, or Yes / No. */
export function sideLabel(m, side) {
  const s = String(side || "").toLowerCase();
  if (isProp(m?.sport)) return s === "home" ? NO : YES;
  return s === "home" ? (m?.home_name ?? m?.home ?? "") : (m?.away_name ?? m?.away ?? "");
}

/** A question short enough for a chat line: "Will Mahomes throw for 300?" -> itself, longer ones cut. */
export function shortQuestion(q, max = 60) {
  const s = String(q || "").trim();
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}
