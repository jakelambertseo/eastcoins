/* The Arcade's rules (2026-10-07), shared by the room server (arcade-worker/src/index.js imports this file) and the pages (tools/arcade-kit/arcade.js).
   Import-free on purpose: the worker bundles it, the browser loads it as a module. */

export const VERSION = 1;

// rooms: where somebody is. ONE CHAT for the lounge and every game behind it (the owner, 2026-10-07: "eastscape chat is seperate, but lounge
// and all its games are together"); a line carries the room it was said in. `jukebox`: the lounge's station plays there unless a setting
// turns it off.
export const ROOMS = {
  lounge: { name: "The Lounge", jukebox: true },
  climb: { name: "The Climb", jukebox: true }
};

// what a look may be. Free hats for everyone; the others are unlocked by a game's server (`unlocks:<id>` in storage) when it checks a run
export const CHARS = ["char-male-a", "char-female-b", "char-male-c", "char-female-d", "char-male-e", "char-female-f"];
export const CHAR_NAMES = ["Ace", "Bea", "Cal", "Dot", "Eli", "Fay"];
export const HATS = [
  { key: "none", name: "No hat", free: true },
  { key: "cap", name: "Team cap", free: true },
  { key: "beanie", name: "Beanie", free: true },
  { key: "halo", name: "Halo", note: "Reach floor 50 of The Climb" },
  { key: "crown", name: "Summit crown", note: "Ring the bell at the top of The Climb" }
];
export const DEFAULT_LOOK = { model: CHARS[0], hat: "none" };
export function cleanLook(l, unlocks = []) {
  const model = CHARS.includes(l?.model) ? l.model : DEFAULT_LOOK.model;
  const h = HATS.find((x) => x.key === l?.hat);
  const hat = h && (h.free || unlocks.includes(h.key)) ? h.key : "none";
  return { model, hat };
}

export const CHAT = { max: 200, keep: 40, gapMs: 700, burst: 8, burstMs: 10000 };
export function cleanChat(s) { return String(s || "").replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim().slice(0, CHAT.max); }

/* THE JUKEBOX (the owner asked for Radio Garden; same answer as EastScape's: its API is private and answers anything but its own site with a
   Cloudflare bot challenge, so this is Radio Browser, the open directory made for apps). The page searches the directory itself and sends
   ONLY a station UUID; the server looks it up and takes the name and https stream from the directory, never from the player. Free here
   (the lounge has no currency): you must be in the lounge and at the jukebox, the room changes station once per `everyMs`, and a pick is
   its picker's for `holdMs` (nobody else can change or stop it; an admin can). */
export const RADIO = {
  everyMs: 20000, holdMs: 3 * 60 * 1000, reach: 3.2,
  at: { x: -14.1, z: -2.5 },   // where the lounge's jukebox stands (lounge.js draws it there)
  hosts: ["de1.api.radio-browser.info", "de2.api.radio-browser.info", "fi1.api.radio-browser.info"],
  genres: [["Classic rock", "classic rock"], ["Hip-hop", "hip hop"], ["80s", "80s"], ["90s", "90s"], ["Country", "country"], ["Lo-fi", "lofi"], ["Dance", "dance"], ["Sports talk", "sports"]]
};
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// positions: the page sends at most this often; the server sends each room one batch per tick
export const NET = { sendMs: 100, tickMs: 100, where: 40 };

/* AIR HOCKEY (2026-10-07, the owner: "yes build air hockey"). The lounge's table, for two, run by the room server so both players and everyone
   watching see one puck. Walk up, E to sit at an end; the next person to sit takes the other. Steer your mallet with the mouse (or a finger);
   first to `winTo`. No stakes: wins go on the lounge's board. Coordinates are the table's own: x along its length (side 0 defends -x,
   side 1 defends +x), z across, metres, 0,0 the centre spot. `at` is where the table stands in the lounge. */
export const HOCKEY = {
  at: { x: 1, z: 4 }, halfL: 1.2, halfW: 0.6, goalHalf: 0.24, puckR: 0.05, malletR: 0.08,
  malletSpeed: 6, puckMax: 5.5, wallBounce: 0.9, hitBounce: 1.0, drag: 0.9985,
  hz: 30, sub: 4, winTo: 7, goalPauseMs: 1500, overPauseMs: 4000, waitMs: 90000, reach: 3, serveX: 0.45
};
export const hkSeat = (side) => ({ x: HOCKEY.at.x + (side ? 1 : -1) * (HOCKEY.halfL + 0.55), z: HOCKEY.at.z });   // where a player stands
// a mallet may go anywhere in its own half
export function hkClampMallet(side, x, z) {
  const H = HOCKEY, r = H.malletR;
  const lo = side ? r : -H.halfL + r, hi = side ? H.halfL - r : -r;
  return [Math.max(lo, Math.min(hi, Number(x) || 0)), Math.max(-H.halfW + r, Math.min(H.halfW - r, Number(z) || 0))];
}
export function hkNew() { return { puck: { x: 0, z: 0, vx: 0, vz: 0 }, m: [{ x: -0.9, z: 0, vx: 0, vz: 0, tx: -0.9, tz: 0 }, { x: 0.9, z: 0, vx: 0, vz: 0, tx: 0.9, tz: 0 }] }; }
export function hkServe(h, toward) {   // the puck waits on the side that just conceded
  h.puck = { x: toward ? HOCKEY.serveX : -HOCKEY.serveX, z: 0, vx: 0, vz: 0 };
}
/* One tick of the table. Returns "goal0" (side 0 scored, into +x), "goal1", "hit" or "". Mallets chase their targets at malletSpeed;
   a mallet is immovable to the puck (infinite mass), so a moving one hits harder. */
export function hkStep(h, dt) {
  const H = HOCKEY, n = H.sub, d = dt / n, R = H.puckR + H.malletR;
  let ev = "";
  for (let s = 0; s < n; s++) {
    for (const m of h.m) {
      const dx = m.tx - m.x, dz = m.tz - m.z, dist = Math.hypot(dx, dz), step = Math.min(dist, H.malletSpeed * d);
      const ox = m.x, oz = m.z;
      if (dist > 1e-6) { m.x += (dx / dist) * step; m.z += (dz / dist) * step; }
      m.vx = (m.x - ox) / d; m.vz = (m.z - oz) / d;
    }
    const p = h.puck;
    p.x += p.vx * d; p.z += p.vz * d; p.vx *= H.drag; p.vz *= H.drag;
    for (const m of h.m) {
      const ex = p.x - m.x, ez = p.z - m.z, dist = Math.hypot(ex, ez);
      if (dist < R && dist > 1e-6) {
        const nx = ex / dist, nz = ez / dist;
        p.x = m.x + nx * R; p.z = m.z + nz * R;
        const vn = (p.vx - m.vx) * nx + (p.vz - m.vz) * nz;
        if (vn < 0) { p.vx -= (1 + H.hitBounce) * vn * nx; p.vz -= (1 + H.hitBounce) * vn * nz; ev = ev || "hit"; }
      }
    }
    const sp = Math.hypot(p.vx, p.vz); if (sp > H.puckMax) { p.vx *= H.puckMax / sp; p.vz *= H.puckMax / sp; }
    const zMax = H.halfW - H.puckR;
    if (p.z > zMax) { p.z = zMax; p.vz = -Math.abs(p.vz) * H.wallBounce; } else if (p.z < -zMax) { p.z = -zMax; p.vz = Math.abs(p.vz) * H.wallBounce; }
    const xMax = H.halfL - H.puckR;
    if (Math.abs(p.x) > xMax) {
      if (Math.abs(p.z) < H.goalHalf - H.puckR * 0.5) { if (Math.abs(p.x) > H.halfL + H.puckR) return p.x > 0 ? "goal0" : "goal1"; }
      else { p.x = Math.sign(p.x) * xMax; p.vx = -Math.sign(p.x) * Math.abs(p.vx) * H.wallBounce; }
    }
  }
  return ev;
}

/* THE DASH (2026-10-07, the owner: "a back and forth speed course connected to the patio ... a leaderboard", then "daily ticket prize for
   highest of the day (Ends at 10pm CST) with a visible leaderboard at the start"). A track out of the patio's north gate: down one lane,
   ring the bell, back up the other. Best time of the day wins `prize` tickets; a day runs 10 PM to 10 PM Central and is named by the
   date it ends on. The page times the run; the server keeps the board and refuses times no person could run (`minMs`, the bell split).
   The prize is RECORDED, not paid, until the shared ticket wallet moves to the database. */
export const DASH = { prize: 5000, endHour: 22, minMs: 8000, maxMs: 180000, bellMin: 0.3, bellMax: 0.7, top: 10, gapMs: 4000 };
// the Chicago calendar date for a moment, as YYYY-MM-DD
const chicagoDate = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
// which Dash day a moment belongs to: from 10 PM Central on, it's already tomorrow's
export function dashDay(ms) { return chicagoDate(ms + (24 - DASH.endHour) * 3600e3); }
// when the Dash day holding `ms` ends (the next 10 PM Central), found by stepping, so daylight saving can't fool it
export function dashEnds(ms) {
  const day = dashDay(ms); let lo = ms, hi = ms + 25 * 3600e3;
  while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2); if (dashDay(mid) === day) lo = mid; else hi = mid; }
  return hi;
}
