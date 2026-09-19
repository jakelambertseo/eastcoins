/* ============================================================
   Red Light, Green Light — the rules, and nothing but the rules

   Up to six runners on a 100-yard field, 20 ZC each, the winner takes
   the lot. The referee has his back turned (green light); every light
   you pick how long you sprint; then he spins round at a moment nobody
   knew. Still sprinting when he turns and you are out. First across
   the line wins; if only one runner is left, they win on the spot.

   WHY IT IS BUILT AS "PICK YOUR SPRINT, THEN WATCH" rather than as a
   reaction game: real ZCoins ride on it. A game you win by stopping
   the instant the light turns is a game a script wins every time, and
   one where a slow connection loses you 20. Here the only input is a
   number — how long you dare run — sent BEFORE the turn is known to
   anyone but the server. There is nothing to react to, so there is
   nothing for a bot or a fast connection to be better at. The nerve
   is in holding the button while the meter climbs.

   Everything here is a pure function of the seed (committed by hash
   while the lobby is open, revealed when the race is over) and the
   sprints the runners sent, so any race can be replayed and checked.

   This file has NO imports on purpose: a byte-identical copy is served
   to the browser as /v3/assets/js/redlight-rules.js for the practice
   page's engine. tools/redlight-test.mjs fails if the two ever differ.
   ============================================================ */

export const RL = {
  maxPlayers: 6,
  field: 100,          // yards
  speed: 9,            // yards a second at a sprint
  maxRunMs: 4000,      // the longest sprint you can pick
  minTurnMs: 800,      // he never turns sooner than this, so a short dash is always safe
  maxLights: 10,       // after this many, the runner furthest up the field wins
  introMs: 4000,       // lobby closes -> first light
  chooseMs: 5000,      // picking your sprint
  graceMs: 1000,       // late sprints still count (slow connections); the turn stays secret until this is over
  showMs: 5500         // the light plays out on everybody's screen
};
export const lightMs = () => RL.chooseMs + RL.graceMs + RL.showMs;
/** When light k opens, and when its sprints stop being accepted (the moment its turn may be told). */
export const lightOpensAt = (startsAt, k) => startsAt + RL.introMs + k * lightMs();
export const lightClosesAt = (startsAt, k) => lightOpensAt(startsAt, k) + RL.chooseMs + RL.graceMs;
/** How many lights have closed by `now` — the only ones whose turn may be revealed or replayed. */
export function lightsClosed(startsAt, now) {
  let n = 0;
  while (n < RL.maxLights && lightClosesAt(startsAt, n) <= now) n += 1;
  return n;
}
/** The light whose sprint is being picked right now, or -1. */
export function lightOpen(startsAt, now) {
  for (let k = 0; k < RL.maxLights; k += 1) {
    if (now >= lightOpensAt(startsAt, k) && now < lightClosesAt(startsAt, k)) return k;
  }
  return -1;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const fraction = (hex) => parseInt(hex.slice(0, 8), 16) / 0x100000000;

/** When the referee turns on light k, in ms after the light goes green. Uniform between the floor and the longest sprint. */
export async function turnFor(seed, k) {
  const f = fraction(await sha256Hex(`${seed}:light:${k}`));
  return Math.round((RL.minTurnMs + f * (RL.maxRunMs - RL.minTurnMs)) / 10) * 10;
}
/** Picks one of several level runners, from the seed, so a dead heat is still winner-takes-all and still checkable. */
async function tieBreak(seed, k, seats) {
  const sorted = [...seats].sort((a, b) => a - b);
  return sorted[parseInt((await sha256Hex(`${seed}:tie:${k}`)).slice(0, 8), 16) % sorted.length];
}
export const cleanRun = (ms) => Math.max(0, Math.min(RL.maxRunMs, Math.round(Number(ms) || 0)));

/**
 * The race so far. `runs[k][seat]` is that seat's sprint on light k in ms (missing = stood still).
 * Replays `lights` lights and stops early at a winner.
 *
 * Returns { lights: [{ k, turnMs, runs, out: [seat], finished: [seat], pos: [yards after] }],
 *           pos, alive, outAt: [{ k, pos } | null], winner: seat | null, how }
 */
export async function replay(seed, n, runs, lights) {
  const pos = new Array(n).fill(0), alive = new Array(n).fill(true), outAt = new Array(n).fill(null);
  const log = [];
  let winner = null, how = null;
  const total = Math.min(lights, RL.maxLights);
  for (let k = 0; k < total && winner === null; k += 1) {
    const turnMs = await turnFor(seed, k);
    const row = [], out = [], finished = [];
    let best = Infinity;
    for (let s = 0; s < n; s += 1) {
      const run = alive[s] ? cleanRun(runs?.[k]?.[s]) : 0;
      row.push(alive[s] ? run : null);
      if (!alive[s] || run === 0) continue;
      const toLine = ((RL.field - pos[s]) / RL.speed) * 1000;          // ms of sprinting left to the line
      if (toLine <= Math.min(run, turnMs)) {                            // across before he turned: home
        finished.push({ s, at: toLine }); best = Math.min(best, toLine); pos[s] = RL.field;
      } else if (run > turnMs) {                                        // still moving when he turned
        pos[s] = Math.min(RL.field, pos[s] + (turnMs / 1000) * RL.speed);
        alive[s] = false; outAt[s] = { k, pos: pos[s] }; out.push(s);
      } else {
        pos[s] += (run / 1000) * RL.speed;
      }
    }
    if (finished.length) {
      const first = finished.filter((f) => f.at === best).map((f) => f.s);
      winner = first.length === 1 ? first[0] : await tieBreak(seed, k, first); how = "line";
    } else {
      const left = alive.map((a, s) => (a ? s : -1)).filter((s) => s >= 0);
      if (left.length === 1) { winner = left[0]; how = "last"; }
      else if (left.length === 0) {
        // everybody still in went out on the same light: whoever got furthest before the whistle takes it
        const far = Math.max(...out.map((s) => pos[s]));
        const lead = out.filter((s) => pos[s] === far);
        winner = lead.length === 1 ? lead[0] : await tieBreak(seed, k, lead); how = "furthest-out";
      }
    }
    log.push({ k, turnMs, runs: row, out, finished: finished.map((f) => f.s), pos: pos.map((p) => Math.round(p * 100) / 100) });
  }
  if (winner === null && total >= RL.maxLights) {
    const left = alive.map((a, s) => (a ? s : -1)).filter((s) => s >= 0);
    const far = Math.max(...left.map((s) => pos[s]));
    const lead = left.filter((s) => pos[s] === far);
    winner = lead.length === 1 ? lead[0] : await tieBreak(seed, RL.maxLights, lead); how = "furthest";
  }
  return { lights: log, pos: pos.map((p) => Math.round(p * 100) / 100), alive, outAt, winner, how };
}
