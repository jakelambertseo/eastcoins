/* ============================================================
   Simon — four pads, a sequence that grows by one each round

   The sequence lives here and is handed out ONE ROUND AT A TIME: the
   page is only ever told the pads it is about to be shown, so there
   is nothing in the browser to read ahead. Repeat the round back and
   the next pad is added; get one wrong and the run is over at
   however many rounds you cleared.

   That makes this the most honest game in the room. A script would
   have to watch the pads light up and play along, which is real
   work, rather than reading an answer out of a variable.
   ============================================================ */

import { sha256, randomSeed } from "../../casino/_engine.js";

export const PADS = 4;
export const MAX_ROUNDS = 40;      // nobody is getting near this

/** The whole sequence a seed makes, as far as anyone could ever need. */
export async function sequenceFor(seed, rounds) {
  const out = [];
  for (let i = 0; i < Math.min(rounds, MAX_ROUNDS); i += 1) {
    const h = await sha256(`${seed}:pad:${i}`);
    out.push(parseInt(h.slice(0, 8), 16) % PADS);
  }
  return out;
}

let ready = false;
export async function ensureSimon(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS simon_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      round INTEGER NOT NULL DEFAULT 0,
      over INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_simon_runs_user ON simon_runs (user_id, created_at)`)
  ]);
  ready = true;
}

export { randomSeed };
