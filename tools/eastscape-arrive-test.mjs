/* WHERE DO YOU LAND? —  node tools/eastscape-arrive-test.mjs
   (2026-09-29, a player's bug report: "character will teleport to right side of map when exiting cellar; and arriving at secondary
   island"). The real World with storage stubbed: crossing the bridge between a third-tier island and its Far Shore lands you on the
   bridge and on the dock, both ways; coming up from the cellar puts you by the ladder even when the tile below it is taken; and a
   landing on a blocked tile anywhere moves to the nearest open tile to it, not to the middle of the map. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const near = (a, b, r) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= r;
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const C = G.freshChar(); C.isle.tier = 3;
const pl = { id: "u1", login: "u1", name: "Islander", role: "user", ws: { send() {} }, C, x: 0, y: 0, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now() };
W.pls.set("u1", pl);
const walkOff = (key, x, y) => { const S = W.scene(key); C.scene = key; pl.x = x; pl.y = y; pl.path = []; pl.step = null; W.playerTick(S, pl, Date.now()); return { scene: C.scene, x: pl.x, y: pl.y }; };

/* 1. the bridge, both ways */
const isleK = G.isleKey(C.isle, "u1"); is(isleK, "isle3:u1", "a third-tier island");
const toShore = walkOff(isleK, G.COLS - 1, 6);
is([toShore.scene, near(toShore, { x: 2, y: 6 }, 1)], ["shore:u1", true], `off the bridge onto the Far Shore's dock (landed ${toShore.x},${toShore.y})`);
const back = walkOff("shore:u1", 0, 6);
is([back.scene, near(back, { x: 41, y: 6 }, 1)], [isleK, true], `and back onto the island's bridge (landed ${back.x},${back.y})`);

/* 2. up from the cellar, with the ladder's south tile taken */
const S = W.scene(isleK);
C.isle.decor = [{ k: "cellarladder", x: 10, y: 6, at: "isle" }, { k: "flowers_r", x: 10, y: 7, at: "isle" }];
S.decorLaid = false; W.decorLay(S);
const up = W.cellarUp(W.scene("cellar:u1"));
is([up.scene, up.x, up.y], [isleK, 10, 7], "the steps come up to the tile below the ladder");
W.moveToScene(pl, up.scene, null, up);
is(near(pl, { x: 10, y: 6 }, 2), true, `a flower bed on it: you land beside the ladder instead (${pl.x},${pl.y}), not across the island`);

/* 3. any blocked landing: the nearest open tile to it */
const Y = W.scene("workyard"); pl.x = 35; pl.y = 16; C.scene = "workyard"; W.placeSafely(Y, pl);   /* the Yard's bank chest */
is(near(pl, { x: 35, y: 16 }, 1), true, `a landing on the Yard's bank chest moves one tile (${pl.x},${pl.y})`);

/* 4. a refresh or a deploy on your own island: back on it; on somebody else's: not */
{ const store = new Map(), c2 = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
  const W2 = new World(c2, { SITE: "https://example.invalid", DEV: "0" }); W2.save = async () => {}; W2.houseSay = () => {}; W2.start = () => {};
  const ws = { send() {}, addEventListener() {}, close() {} };
  const login = async (id, scene, x, y, tier = 3) => { const ch = G.freshChar(); ch.isle.tier = tier; ch.scene = scene; ch.x = x; ch.y = y; store.set(`char:${id}`, ch); await W2.join({ id, login: id, name: id }, ws); const p = W2.pls.get(id); return { scene: p.C.scene, x: p.x, y: p.y }; };
  const own = await login("a1", "isle3:a1", 12, 8);
  is([own.scene, near(own, { x: 12, y: 8 }, 2)], ["isle3:a1", true], `a refresh on your own island keeps you there (${own.x},${own.y})`);
  const shore = await login("a2", "shore:a2", 8, 6);
  is(shore.scene, "shore:a2", "and on your Far Shore");
  const lost = await login("a3", "shore:a3", 8, 6, 2);
  is(lost.scene, "isle2:a3", "a Far Shore you no longer have: onto your island instead");
  const other = await login("a4", "isle3:someoneelse", 12, 8);
  is(other.scene === "isle3:someoneelse", false, `somebody else's island: not put back on it (${other.scene})`);
  const home = await login("a5", "home:a5", 8, 6);
  is(home.scene, "home:a5", "your cottage too"); }

console.log(bad ? `\n${bad} problem(s)` : "\nall good");
process.exit(bad ? 1 : 0);
