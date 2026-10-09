/* Blockshot's profile: level, XP, skins, lifetime stats, settings (2026-10-08, the owner: "a leveling mechanism for skins, total stat
   tracking (kills, kd, etc)"). Kept in this browser for now (localStorage ecBlockshotProfile); when the game goes on the arcade server
   the SERVER counts every kill and pays the XP, and this file reads the same shape from there, so nothing on the page changes.

   XP: a kill is 10 (a headshot 15), a win 100, finishing a round 40, every streak of three 20. Level n needs 100 × n^1.5 more than
   the last, so level 10 is about 3,400 XP (a few evenings) and level 30 about 24,000. Skins unlock by level and never cost anything. */
const KEY = "ecBlockshotProfile";
export const XP = { kill: 10, headshot: 15, win: 100, round: 40, streak3: 20 };
export const need = (lvl) => Math.round(100 * Math.pow(lvl, 1.5));
export const COLORS = { yellow: 0xffd84a, pink: 0xff6a8a, sky: 0x6ad0ff, lime: 0x8ae07a, violet: 0xc48aff, orange: 0xff9a3a, mint: 0x5ae0c0, red: 0xff5a5a, white: 0xf0f0f0, navy: 0x3a4a8a, black: 0x202028, gold: 0xffc83a };
/** Everything that can be worn: body colour, body pattern, visor colour, gun pattern. `lvl` is when it unlocks. */
export const SKINS = {
  body: [{ k: "yellow", n: "Yellow", lvl: 1 }, { k: "pink", n: "Pink", lvl: 1 }, { k: "sky", n: "Sky", lvl: 1 }, { k: "lime", n: "Lime", lvl: 1 }, { k: "violet", n: "Violet", lvl: 2 }, { k: "orange", n: "Orange", lvl: 3 }, { k: "mint", n: "Mint", lvl: 4 }, { k: "red", n: "Red", lvl: 6 }, { k: "white", n: "White", lvl: 8 }, { k: "navy", n: "Navy", lvl: 10 }, { k: "black", n: "Black", lvl: 14 }, { k: "gold", n: "Gold", lvl: 20 }],
  pattern: [{ k: "plain", n: "Plain", lvl: 1 }, { k: "stripes", n: "Stripes", lvl: 3 }, { k: "camo", n: "Camo", lvl: 5 }, { k: "hex", n: "Hex", lvl: 9 }, { k: "carbon", n: "Carbon", lvl: 13 }, { k: "galaxy", n: "Galaxy", lvl: 18 }, { k: "gold", n: "Solid Gold", lvl: 25 }],
  visor: [{ k: "white", n: "White", lvl: 1 }, { k: "black", n: "Black", lvl: 2 }, { k: "sky", n: "Blue", lvl: 4 }, { k: "red", n: "Red", lvl: 7 }, { k: "gold", n: "Gold", lvl: 12 }],
  gun: [{ k: "plain", n: "Plain", lvl: 1 }, { k: "stripes", n: "Stripes", lvl: 4 }, { k: "camo", n: "Camo", lvl: 7 }, { k: "hex", n: "Hex", lvl: 11 }, { k: "carbon", n: "Carbon", lvl: 15 }, { k: "galaxy", n: "Galaxy", lvl: 22 }, { k: "gold", n: "Gold", lvl: 30 }]
};
export const TITLES = [[1, "Recruit"], [3, "Regular"], [5, "Gunner"], [8, "Marksman"], [12, "Veteran"], [16, "Elite"], [20, "Legend"], [25, "Mythic"], [30, "Immortal"]];
export const titleFor = (lvl) => TITLES.filter(([l]) => lvl >= l).pop()[1];

const blank = () => ({ xp: 0, level: 1, skin: { body: "yellow", pattern: "plain", visor: "white", gun: "plain" },
  stats: { kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, wins: 0, rounds: 0, bestStreak: 0, seconds: 0, byGun: {}, byMap: {} },
  settings: { sens: 1, fov: 80, volume: 0.8, invertY: false, crosshair: "cross" } });
let P = blank();
try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { P = { ...blank(), ...s, skin: { ...blank().skin, ...s.skin }, stats: { ...blank().stats, ...s.stats }, settings: { ...blank().settings, ...s.settings } }; } } catch {}
export const profile = P;
export function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch {} }

/** Pay XP; returns the levels gained (0 or more) and what they unlocked. */
export function award(xp) {
  P.xp += xp; let gained = 0; const unlocked = [];
  while (P.xp >= need(P.level)) { P.xp -= need(P.level); P.level++; gained++; for (const [slot, list] of Object.entries(SKINS)) for (const s of list) if (s.lvl === P.level) unlocked.push({ slot, ...s }); }
  save(); return { gained, unlocked };
}
export const owns = (slot, k) => (SKINS[slot].find((s) => s.k === k)?.lvl || 99) <= P.level;
export function wear(slot, k) { if (owns(slot, k)) { P.skin[slot] = k; save(); return true; } return false; }
export const kd = (s = P.stats) => (s.deaths ? (s.kills / s.deaths).toFixed(2) : String(s.kills));
export const accuracy = (s = P.stats) => (s.shots ? Math.round((s.hits / s.shots) * 100) : 0);
export function recordRound({ map, gun, kills, deaths, headshots, shots, hits, won, streak, seconds, byGun }) {
  const s = P.stats; s.kills += kills; s.deaths += deaths; s.headshots += headshots; s.shots += shots; s.hits += hits; s.rounds++; if (won) s.wins++; s.bestStreak = Math.max(s.bestStreak, streak); s.seconds += Math.round(seconds);
  for (const [g, v] of Object.entries(byGun || {})) { const r = (s.byGun[g] ||= { kills: 0, shots: 0, hits: 0 }); r.kills += v.kills; r.shots += v.shots; r.hits += v.hits; }
  const m = (s.byMap[map] ||= { rounds: 0, wins: 0, kills: 0 }); m.rounds++; if (won) m.wins++; m.kills += kills;
  save();
}
