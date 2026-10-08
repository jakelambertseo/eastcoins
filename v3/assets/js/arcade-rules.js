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
