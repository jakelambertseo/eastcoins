/* ============================================================
   Field Goal — power, then aim, into the wind

   Every kick is five yards further than the last and one miss ends
   the run, so a score is simply how many went through.

   The player's BROWSER draws the meters, but it does not decide
   anything: the server picks the wind for every kick from a seed it
   keeps, and when the run is handed in it replays the two numbers
   per kick — where the power meter was stopped, where the aim meter
   was stopped — through the maths below. A score always matches the
   run that produced it.

   That is as far as a browser game can be taken. Someone who wants to
   feed it perfect numbers can, which is exactly why nothing here pays
   ZCoins: the Game Room is for titles.

   THE MATHS BELOW IS MIRRORED IN v3-fg.js so the page can show a
   kick's result the moment it happens. Change one, change the other;
   the scratch test runs both over the same runs.
   ============================================================ */

import { sha256, randomSeed } from "../../casino/_engine.js";

export const FIRST_YARDS = 20;
export const STEP_YARDS = 5;
export const MAX_KICKS = 18;            // 105 yards; nobody is getting there

/** How far the kick k of a run is. */
export const yardsFor = (k) => FIRST_YARDS + k * STEP_YARDS;

/** The power the meter has to reach for the ball to get there at all. */
export const powerNeeded = (yards) => (yards - 15) / 55;

/** How wide the posts are from here: the further out, the finer the aim. */
export const toleranceFor = (yards) => Math.max(0.03, 0.34 - yards * 0.0032);

/** How hard the wind pushes at this distance. */
export const windEffectFor = (yards) => yards * 0.0035;

/**
 * One kick. power and aim are where the two meters were stopped, each
 * a number from 0 to 1; aim is dead centre at 0.5.
 */
export function judge({ yards, wind, power, aim }) {
  const p = clamp01(power);
  const a = clamp01(aim);
  if (p < powerNeeded(yards)) return { made: false, why: "short", drift: 0 };
  const drift = (a - 0.5) * 2 + wind * windEffectFor(yards);
  const made = Math.abs(drift) <= toleranceFor(yards);
  return { made, why: made ? "good" : drift < 0 ? "wide left" : "wide right", drift: Math.round(drift * 1000) / 1000 };
}

const clamp01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0; };

/** The wind for every kick of a run, from its seed alone: -1 to 1. */
export async function windsFor(seed) {
  const out = [];
  for (let k = 0; k < MAX_KICKS; k += 1) {
    const h = await sha256(`${seed}:wind:${k}`);
    const v = parseInt(h.slice(0, 12), 16) / 2 ** 48;         // 0..1
    out.push(Math.round((v * 2 - 1) * 100) / 100);
  }
  return out;
}

/** Replays a handed-in run and says how many went through. */
export async function replay(seed, kicks) {
  const winds = await windsFor(seed);
  const shots = [];
  let made = 0;
  for (let k = 0; k < Math.min(kicks.length, MAX_KICKS); k += 1) {
    const yards = yardsFor(k);
    const shot = judge({ yards, wind: winds[k], power: kicks[k]?.power, aim: kicks[k]?.aim });
    shots.push({ yards, wind: winds[k], ...shot });
    if (!shot.made) break;                    // a miss ends it, whatever came after
    made += 1;
  }
  return { made, longest: made ? yardsFor(made - 1) : 0, shots };
}

let ready = false;
export async function ensureFg(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS fg_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      made INTEGER,
      finished_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_fg_runs_user ON fg_runs (user_id, created_at)`)
  ]);
  ready = true;
}

export { randomSeed };
