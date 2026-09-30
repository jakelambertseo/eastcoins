/* EastScape size budget — run before a deploy (the content check runs it too):  node tools/eastscape-budget.mjs

   What a player downloads, measured against limits, so features can be added freely without the game quietly
   getting heavy. The server side (tick time, bandwidth per player) is watched by the load test and the dashboard's
   EastScape card; this covers the page.

   - code: the page, the shared rules, the wiki and the sounds, gzipped (what actually crosses the wire)
   - startup art: every picture loaded at login (ART_FILES minus the per-area lists)
   - each area's art: what walking into it fetches the first time
   Exits 1 if anything is over budget. Raise a budget on purpose, never by accident. */
import fs from "fs"; import zlib from "zlib"; import path from "path"; import { shipped } from "./eastscape-ship.mjs";
import { lists } from "./eastscape-pack.mjs"; import { run as packRun } from "./eastscape-pack.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const FLAT = path.join(ROOT, "v3/assets/img/glad/flat");
const BUDGET = {
  codeGzKB: 350,   /* (2026-09-28, the owner: "the new budget is 350kb") */   /* (2026-09-28) the modernised UI: the top bar, your menu, the wallet strip, the Quests tab and tracker, the paper doll, one HUD */   /* (2026-09-28) Nestor, the collection podium, the truffle pets and the slim bar; the owner: "dont worry about any budgets" */   /* (2026-09-27) the Foundry's traps drawn on the page */   /* (2026-09-27, the owner: "dont worry about any budgets, just push them") was 275 until the three maps of the massive update */        /* (2026-09-27, the massive update) 275: Breeding (the pen window, 14 pets, 8 eggs, the rules) took the page to 262.7. THE REST OF THE UPDATE MUST NOT RIDE THIS: Fungiculture's and Jewelcrafting's windows, and the new maps, go into lazy modules the way the Count Room's did, so they cost nothing until opened. Was 260: */ /* (2026-09-27) 260: the world map and the Store took the page to 250.3, 0.3 KB over the line the         /* (2026-09-27) 260: the world map and the Store took the page to 250.3, 0.3 KB over the line the owner set on 09-25 ("the new page size budget is now 250KB"); raised by ten with that said out loud rather than trimmed in secret. (2026-09-25, the owner: "the new page size budget is now 250KB") It was 200 and a day of
                           features took it to 200.5; rather than shave, the owner raised the ceiling. The
                           pattern that keeps it from mattering is still the one to use: the Count Room's client
                           module and rules are LAZY and cost this budget nothing, so anything not needed on
                           every single page load belongs behind GROUPS rather than in the page. */        // (the owner, 2026-09-21: "we can up the max load to 200kb"; it was 140, and the page had reached 139.6) page + rules + sounds AS SHIPPED (tools/eastscape-ship.mjs strips comments and whitespace), compressed. 175 before 2026-09-20, when the source itself was served; shipped it came to 124.
  startupArtKB: 300,    // pictures at login
  /* (2026-09-24) 160 -> 6. The comment beside this said it would drop to ~30 "once the art is packed", and the
     art HAS been packed since 2026-09-20 - core.png is one request for all 167 pictures. The number stayed at
     160 and the metric it guarded stayed broken, so it was failing builds for adding a 1 KB prop while a real
     regression (a startup picture escaping the packs, one request each) would have sailed through. Six leaves
     room for a handful of loose files and still notices if the packer stops covering the startup set. */
  startupFiles: 6,
  areaArtKB: 130        // any one area's own pictures (2026-09-26: 120 until the Wilderness and the Deep Wild took the animated water, waterfall and lava sheets; raised on purpose for those two, and nothing else is near it)
};

const html = fs.readFileSync(path.join(ROOT, "eastscape.html"), "utf8");
/* The page's art lists are read by tools/eastscape-pack.mjs, which is the one place that knows how to resolve
   them (they reference each other: AREA_ART is built from WILD_ART, CASINO_ART, ISLE_ART and a crop list). This
   used to be a second copy of that logic and drifted the moment the islands changed. */
const { ART_FILES, AREA_ART } = lists();

const kb = (b) => Math.round(b / 102.4) / 10;
const size = (k) => { try { return fs.statSync(path.join(FLAT, `${k}.png`)).size; } catch (e) { return 0; } };
const gz = async (f) => zlib.gzipSync(await shipped(f)).length;   // what crosses the wire is the SHIPPED file, not the commented source

let bad = 0;
const line = (label, val, max, unit) => { const over = val > max; if (over) bad++; console.log(`  ${over ? "OVER " : "ok   "} ${label.padEnd(34)} ${String(val).padStart(7)} ${unit}  (budget ${max})`); };

console.log("EastScape size budget");
const code = (await gz("eastscape.html")) + (await gz("v3/assets/js/eastscape-shared.js")) + (await gz("v3/assets/js/eastscape-sfx.js"));
line("code, gzipped", kb(code), BUDGET.codeGzKB, "KB");   // (the wiki's words load on first open since 2026-09-20, so they are not startup code)
line("game windows (lazy: on the first table click, or 6 s after arriving)", kb(await gz("v3/assets/js/eastscape-casino.js")), 45, "KB");   /* (2026-09-28, the owner) 45 when Bom's counter grew its effects; split Bom out if it keeps growing */
/* (2026-09-23) 40 -> 60. Every guide was rewritten from a paragraph into a real page with tables read out of the
   rules file, and five skills that had no page at all got one, which is what the wiki is FOR. It is lazy: nothing
   downloads it until somebody presses H. If it ever pushes past this, the answer is not more budget but splitting
   it per guide, so opening Fishing does not also fetch the casino. */
line("wiki words (lazy)", kb(await gz("v3/assets/js/eastscape-wiki.js")), 95, "KB");   /* (2026-09-30) 90 -> 95: the Primeval Valley's Updates entry and area notes (lazy: loads when the wiki opens, never at login). */ /* (2026-09-29) 85 -> 90: the Tinkering and gem bag guides. (2026-09-27, the gems) 78 -> 85: the Gems guide and the gem pages; the owner: "dont worry about any budgets". Lazy, never at login */   /* (2026-09-27, later) 74 -> 78: the massive update's three skill guides (Breeding, Fungiculture, Jewelcrafting), read only when the wiki is opened. (2026-09-25) 60 -> 70: Archery and Fletching took it to 60.2. (2026-09-27) 70 -> 74: the Long Night guide rewritten as the full explainer took it to 70.5. It loads on first wiki open, never at login. */

const lazy = new Set(Object.values(AREA_ART).flat());
const startup = [...new Set(ART_FILES)].filter((k) => !lazy.has(k));
/* (2026-09-24) THIS LINE STOPPED MEASURING REQUESTS WHEN THE PACKER SHIPPED. It counted the number of PICTURES
   in the startup set, which was the request count in September when a first visit really did fetch 208 little
   PNGs. They are one sheet now: loadArt resolves a picture to its pack and fetches core.png, so 167 pictures is
   167 pictures and exactly ONE request. Left alone it fails the build for adding a 1 KB prop to core, which is
   the opposite of what it was written to protect - and the honest way to keep a guard is to make it measure the
   thing again rather than to raise its number.

   Startup art now costs: core.png (one request, and its bytes are the real budget), plus one request for every
   startup picture that is in NO pack, because those still load on their own. */
const startupBytes = size("../packs/core") || startup.reduce((a, k) => a + size(k), 0);
line("startup art (core.png)", kb(startupBytes), BUDGET.startupArtKB, "KB");
let packed = new Set();
try { const pj = JSON.parse(fs.readFileSync(path.join(FLAT, "../packs/packs.json"), "utf8"));
  for (const v of Object.values(pj)) for (const k of Object.keys(v.keys || {})) packed.add(k); } catch (e) { /* no packs yet */ }
const loose = startup.filter((k) => !packed.has(k));
line("startup art requests", 1 + loose.length, BUDGET.startupFiles, "files");
if (loose.length) console.log(`         ${loose.length} startup picture(s) in no pack, one request each: ${loose.slice(0, 8).join(", ")}`);
/* the pictures ship as SHEETS (tools/eastscape-pack.mjs): the count above is what a player would fetch WITHOUT them. Stale sheets
   never break the game (an unpacked picture loads on its own) but they quietly bring the requests back, so stale fails here. */
const pk = await packRun({ check: true });
if (!pk.fresh) { bad++; console.log("  OVER  the sprite sheets are STALE: run  node tools/eastscape-pack.mjs"); }
else console.log(`  ok    sprite sheets fresh: ${pk.packs} sheets, ${pk.pictures} pictures; the login sheet is ${kb(pk.core)} KB, packs.json ${kb(pk.manifestBytes)} KB raw`);

/* (2026-09-27) THE DEPTHS IS ONE PICTURE. Its ground is the pack's own mockup, two 256-colour halves (79 KB) fetched loose, in place of the
   Wang sheets every other map loads; with its monsters' walk, attack and rise frames on the area sheet it comes to about 136 KB on
   the wire. Allowed on purpose, for this map only: a new map that wants more should cut its art, not raise this. */
const AREA_BUDGET = { deep: 135,   /* (2026-09-29) the Wild Bench, 2.6 KB (it was the Wilderness's for a day) */ depths: 160, boardwalk: 210, bw_cabin: 210, bw_light: 210, bw_wreck: 210, bw_pier: 210, bw_skull: 210,   /* (2026-09-27) the islands' clutter, flags and chest; the owner: "dont worry about any budgets" */  foundry: 270, orchard: 210,
  /* (2026-09-27) the Foundry rebuilt as seven areas: each its own picture, trap strip and moving scenery; the Hall carries the Giant (five breaths,
     a slam and a rise, each 492x476) */ fd_grove: 200, fd_maze: 240, fd_isle: 300, fd_chain: 180, fd_gate: 140, fd_hall: 400,
  /* (2026-09-30) the Primeval Valley: the Lowlands carry the Matriarch (94 KB over ten frames) and the Lair Old Rex (82 KB); both already paletted, so they get a boss room's budget like the Hall */ valley: 280, valley_lair: 270,
  /* (2026-09-30) the Yard raid: the Ice Man is drawn huge (246 px, ten frames) and the sheet loads only when a raid starts, never at login */ raid: 280,
  /* (2026-09-30) the Frozen Reach: the Ice Wyrm (~140 KB) rises on the first map and the Frost Jarl (~115 KB) stands on the second, like the Hall */ frozen: 360, frostspire: 370 };   /* (the Foundry: its lava picture is 204 KB of the 260 and will not go smaller; the owner: "dont worry about any budgets") */
for (const [area, list] of Object.entries(AREA_ART)) line(`area art: ${area}`, kb([...new Set(list)].reduce((a, k) => a + size(k), 0)), AREA_BUDGET[area] || BUDGET.areaArtKB, "KB");

// a picture named in an area list that the page never asks for is a typo, not a saving
const known = new Set(ART_FILES), stray = [...lazy].filter((k) => !known.has(k));
if (stray.length) { bad++; console.log(`  OVER  area lists name pictures missing from ART_FILES: ${stray.join(", ")}`); }

console.log(bad ? `\n${bad} over budget.` : "\nAll within budget.");
process.exit(bad ? 1 : 0);
