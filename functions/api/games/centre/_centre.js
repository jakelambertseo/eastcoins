/* ============================================================
   Dead Centre — stop the bar in the middle, five times

   A bar sweeps back and forth and you stop it as close to the middle
   as you can. Five goes; each is worth up to 200 points, falling
   away by how far off you were, so a perfect set is 1,000.

   The SPEED of each sweep comes from the run's seed, which the
   server keeps: a run handed in is scored against the speeds it was
   actually played at, so a good set of numbers copied from a
   previous run does not score the same twice. Beyond that this is a
   browser game and is trusted like one, which is why the Game Room
   pays in titles.
   ============================================================ */

import { sha256, randomSeed } from "../../casino/_engine.js";

export const SHOTS = 5;
export const MAX_POINTS = 200;
/** Points for one stop: dead centre is 200, a tenth out is nothing. */
export const pointsFor = (stop, speed) => {
  const s = Number(stop);
  if (!Number.isFinite(s)) return 0;
  const error = Math.abs(Math.min(1, Math.max(0, s)) - 0.5);
  // A faster sweep is worth more, because it is harder to stop.
  const bonus = 0.85 + speed * 0.3;
  return Math.max(0, Math.round((MAX_POINTS - error * 2000) * bonus));
};

/** How fast each sweep runs, 0 (slow) to 1 (unkind), from the seed. */
export async function speedsFor(seed) {
  const out = [];
  for (let i = 0; i < SHOTS; i += 1) {
    const h = await sha256(`${seed}:speed:${i}`);
    out.push(Math.round((parseInt(h.slice(0, 12), 16) / 2 ** 48) * 100) / 100);
  }
  return out;
}

/** Replays a handed-in set of stops against the speeds it was played at. */
export async function replay(seed, stops) {
  const speeds = await speedsFor(seed);
  const shots = [];
  let total = 0;
  for (let i = 0; i < SHOTS; i += 1) {
    const stop = stops?.[i];
    const points = stop === undefined || stop === null ? 0 : pointsFor(stop, speeds[i]);
    const error = Number.isFinite(Number(stop)) ? Math.abs(Math.min(1, Math.max(0, Number(stop))) - 0.5) : 0.5;
    shots.push({ speed: speeds[i], points, error: Math.round(error * 1000) / 1000 });
    total += points;
  }
  return { total, shots, bestShot: Math.max(0, ...shots.map((s) => s.points)) };
}

let ready = false;
export async function ensureCentre(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS centre_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      seed TEXT NOT NULL,
      total INTEGER,
      finished_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_centre_runs_user ON centre_runs (user_id, created_at)`)
  ]);
  ready = true;
}

export { randomSeed };
