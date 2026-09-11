/* ============================================================
   EastCoin Picks — fights (boxing, MMA)

   No scores feed grades a fight: there is no final score to compare,
   only a winner, a method and sometimes a draw. So fight markets
   never enter the automatic settlement loop in settle.js. They lock
   at the first bell like any other market, and an admin enters the
   result on the admin page (admin/settle-market.js), which pays out
   through the same code the scheduled run uses.

   A draw refunds every pick, the same as a tied game.
   ============================================================ */

export const MANUAL_SPORTS = new Set(["boxing", "mma"]);

export function isFight(sport) {
  return MANUAL_SPORTS.has(String(sport || "").toLowerCase());
}

/** "Garcia vs Benn" for a fight, "Reds at Dodgers" for a game. */
export function versus(sport) {
  return isFight(sport) ? "vs" : "at";
}
