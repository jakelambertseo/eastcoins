/* Blockshot's profile: level, XP, skins, lifetime stats, settings (2026-10-08, the owner: "a leveling mechanism for skins, total stat
   tracking (kills, kd, etc)").

   TWO HOMES (2026-10-09). Signed in on eastcoin.vip, the profile is the SERVER'S: the match server reports every online round to the
   site (/api/blockshot/round), the site keeps the stats in D1 and pays the XP, and the page reads them from /api/blockshot/me and adopts
   them here (`adopt`). Then nothing on this page can grant XP: practice rounds against bots are practice. A guest, or anyone playing the
   page outside the site, keeps this browser's copy (localStorage) and earns local XP from practice, the way it was. The skin worn is
   saved to the server when there is one. Settings are always the browser's. The XP table and level curve are the shared rules'. */
import { XP, need } from "/v3/assets/js/blockshot-rules.js?v=10";
export { XP, need };
const KEY = "ecBlockshotProfile";
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

const blank = () => ({ xp: 0, level: 1, server: false, name: "", skin: { body: "yellow", pattern: "plain", visor: "white", gun: "plain" },
  stats: { kills: 0, deaths: 0, headshots: 0, shots: 0, hits: 0, wins: 0, rounds: 0, bestStreak: 0, seconds: 0, byGun: {}, byMap: {} },
  settings: { sens: 1, fov: 80, volume: 0.8, invertY: false, crosshair: "cross" } });
/** Whether the page is on the site at all (the site answered /api/blockshot/me): then a guest can be offered the Twitch sign-in. */
export const site = { on: false };
let P = blank();
try { const s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { P = { ...blank(), ...s, server: false, skin: { ...blank().skin, ...s.skin }, stats: { ...blank().stats, ...s.stats }, settings: { ...blank().settings, ...s.settings } }; } } catch {}
export const profile = P;
export function save() { try { localStorage.setItem(KEY, JSON.stringify({ ...P, server: false })); } catch {} }

/** The server's profile (from /api/blockshot/me) becomes this one. Local by-gun and by-map counts are kept as the browser's own colour. */
export function adopt(me) {
  if (!me) return;
  P.server = true; P.name = me.name || ""; P.login = me.login || ""; P.xp = me.xp; P.level = me.level;
  Object.assign(P.stats, { kills: me.kills, deaths: me.deaths, headshots: me.headshots, shots: me.shots, hits: me.hits, wins: me.wins, rounds: me.rounds, bestStreak: me.bestStreak, seconds: me.seconds });
  if (me.skin) for (const k of Object.keys(P.skin)) if (me.skin[k] && owns(k, me.skin[k])) P.skin[k] = me.skin[k];
  save();
}
/** Pay XP locally; returns the levels gained and what they unlocked. Does nothing when the server keeps the profile. */
export function award(xp) {
  if (P.server) return { gained: 0, unlocked: [], skipped: true };
  P.xp += xp; let gained = 0; const unlocked = [];
  while (P.xp >= need(P.level)) { P.xp -= need(P.level); P.level++; gained++; for (const [slot, list] of Object.entries(SKINS)) for (const s of list) if (s.lvl === P.level) unlocked.push({ slot, ...s }); }
  save(); return { gained, unlocked };
}
/** What a jump from one level to another unlocked (the server paid; the page says what came with it). */
export function unlockedBetween(from, to) { const out = []; for (const [slot, list] of Object.entries(SKINS)) for (const s of list) if (s.lvl > from && s.lvl <= to) out.push({ slot, ...s }); return out; }
export const owns = (slot, k) => (SKINS[slot].find((s) => s.k === k)?.lvl || 99) <= P.level;
export function wear(slot, k) { if (owns(slot, k)) { P.skin[slot] = k; save(); if (P.server) fetch("/api/blockshot/me", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ skin: P.skin }) }).catch(() => {}); return true; } return false; }
export const kd = (s = P.stats) => (s.deaths ? (s.kills / s.deaths).toFixed(2) : String(s.kills));
export const accuracy = (s = P.stats) => (s.shots ? Math.round((s.hits / s.shots) * 100) : 0);
/** A finished round. Local stats only when the browser keeps the profile; the by-gun and by-map detail is the browser's either way. */
export function recordRound({ map, gun, kills, deaths, headshots, shots, hits, won, streak, seconds, byGun }) {
  const s = P.stats;
  if (!P.server) { s.kills += kills; s.deaths += deaths; s.headshots += headshots; s.shots += shots; s.hits += hits; s.rounds++; if (won) s.wins++; s.bestStreak = Math.max(s.bestStreak, streak); s.seconds += Math.round(seconds); }
  for (const [g, v] of Object.entries(byGun || {})) { const r = (s.byGun[g] ||= { kills: 0, shots: 0, hits: 0 }); r.kills += v.kills; r.shots += v.shots; r.hits += v.hits; }
  const m = (s.byMap[map] ||= { rounds: 0, wins: 0, kills: 0 }); m.rounds++; if (won) m.wins++; m.kills += kills;
  save();
}
/** Read the server's profile, if the site has one for us. */
export async function syncFromServer() {
  try { const r = await fetch("/api/blockshot/me", { credentials: "same-origin", cache: "no-store" }); const j = await r.json(); if (j.ok) site.on = true; if (j.ok && j.me) { adopt(j.me); return j.me; } } catch {}
  return null;
}
