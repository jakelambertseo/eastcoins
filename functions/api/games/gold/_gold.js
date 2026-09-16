/* ============================================================
   The Gold Button — once a day, for two minutes, somewhere in the day

   A gold button appears on every page at a moment nobody knows, and
   the first person to press it takes the day. The moment comes from
   the day's seed, which is made on the first request and kept, so it
   cannot be worked out from the date and is the same for everyone.

   Nothing polls for this. The bell already asks the server how you
   are doing every 45 seconds, so the window rides along in that
   answer and costs no extra requests; the window is two minutes so
   that poll always catches it.

   Winning is atomic: one row per day with the day as its key, so the
   second person to press it finds the door shut however close behind
   they were.
   ============================================================ */

import { dayBounds } from "../../casino/_pot.js";
import { fraction } from "../_games.js";

export const WINDOW_MS = 2 * 60 * 1000;
// Somewhere between mid-morning and last orders, Central.
const FROM_HOUR = 10;
const TO_HOUR = 22.5;

/** When the button shows up on a given day, as a UTC instant. */
export async function triggerFor(day, seed) {
  const { start } = dayBounds(day);
  const minutes = FROM_HOUR * 60 + (await fraction(seed, "gold")) * (TO_HOUR - FROM_HOUR) * 60;
  return start + Math.round(minutes) * 60000;
}

let ready = false;
export async function ensureGold(db) {
  if (ready) return;
  // The day is the key, so the first press is the only press.
  await db
    .prepare(`CREATE TABLE IF NOT EXISTS gold_claims (
      day TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      took_ms INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    .run();
  ready = true;
}

export async function winnerFor(db, day) {
  const row = await db
    .prepare(
      `SELECT c.took_ms, c.created_at, u.twitch_login, u.display_name, u.avatar_url
         FROM gold_claims c JOIN users u ON u.twitch_id = c.user_id WHERE c.day = ?`
    )
    .bind(day)
    .first()
    .catch(() => null);
  if (!row) return null;
  return {
    tookMs: Number(row.took_ms),
    at: String(row.created_at).replace(" ", "T") + "Z",
    user: { login: String(row.twitch_login).toLowerCase(), displayName: String(row.display_name || row.twitch_login), avatar: String(row.avatar_url || "") }
  };
}

/**
 * What the bell should carry: the window while it is open and unclaimed,
 * and nothing at all the rest of the day. Never says when the button is
 * DUE — that would turn a surprise into an alarm clock.
 */
export async function goldState(db, day, seed, now = Date.now()) {
  const at = await triggerFor(day, seed);
  const open = now >= at && now < at + WINDOW_MS;
  if (!open) return null;
  if (await winnerFor(db, day)) return null;
  return { open: true, endsAt: at + WINDOW_MS, day };
}

/** How fast counts as: two minutes to the second is worth nothing, instant is worth 120. */
export const scoreFor = (tookMs) => Math.max(1, Math.round((WINDOW_MS - Math.min(WINDOW_MS, tookMs)) / 1000));
