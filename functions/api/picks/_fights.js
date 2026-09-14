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

// Everything settled by hand: fights, and prop bets (see _props.js),
// which have no feed either. The scheduled run skips all of these.
export const MANUAL_SPORTS = new Set(["boxing", "mma", "prop"]);
const FIGHTS = new Set(["boxing", "mma"]);

export function isFight(sport) {
  return FIGHTS.has(String(sport || "").toLowerCase());
}

/** Settled from the admin page rather than a scores feed. */
export function isManual(sport) {
  return MANUAL_SPORTS.has(String(sport || "").toLowerCase());
}

/** "Garcia vs Benn" for a fight, "Reds at Dodgers" for a game. */
export function versus(sport) {
  return isFight(sport) ? "vs" : "at";
}
