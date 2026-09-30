/* NOTHING ON AN ISLAND IS RESET BY THE REBUILD —  node tools/eastscape-isle-keep-test.mjs
   (2026-09-30, the owner, after rules 371 went live: "can we make sure peoples pet pens didnt get reset"). A character saved BEFORE the
   islands were rebuilt (a pet mid-breed in the pen, an egg in a hatchery placed on the old island, crops and mushrooms growing, decor
   outside and in the cottage, a tier-2 island) goes through the REAL login (World.join, storage stubbed with that save) and comes out with
   every one of those exactly as it went in: the same clocks, the same pets, the same pieces on the same tiles. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const now = Date.now(), C = G.freshChar();
C.pets = [{ id: "pa", k: "bonepup", name: "Rex" }, { id: "pb", k: "bonepup", name: "Bones", tier: 1 }];
C.pen = { kind: "greater", a: { id: "pa", k: "bonepup" }, b: { id: "pb", k: "bonepup" }, child: { k: "bonepup", tier: 1 }, at: now - 3600000, ms: 6 * 3600000 };
C.hatch = { egg: "egg_raptor", child: { k: "raptorling" }, at: now - 7200000, ms: 60 * 3600000 };
C.isle.tier = 2; C.isle.plots[0] = { k: "wheat", at: now - 60000 }; C.isle.plots[3] = { k: "tomatoe", at: now - 300000, ms: 600000 }; C.isle.beds[1] = { k: "spawn_sporecap", at: now - 1000 };
C.isle.owned = { hatchery: 1, bench: 1, flamingo: 1, cellarladder: 1, sofa: 1, tv: 1 };
/* where these stood on the OLD tier-2 island (inside its oval, clear of the coast and of its things) and in the old cottage */
C.isle.decor = [{ k: "hatchery", x: 11, y: 6, at: "isle" }, { k: "bench", x: 14, y: 3, at: "isle" }, { k: "flamingo", x: 16, y: 10, at: "isle" }, { k: "cellarladder", x: 12, y: 8, at: "isle" },
  { k: "sofa", x: 8, y: 7, at: "home" }, { k: "tv", x: 12, y: 3, at: "home" }];
C.scene = G.isleKey(C.isle, "u1"); C.x = 10; C.y = 10;
const saved = JSON.parse(JSON.stringify(C));
const store = new Map([["char:u1", saved]]);
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => store.set(k, v), delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
/* THE LOAD, as World.join runs it (join itself waits on the site's verify, which a test has no site for): normChar on what storage holds,
   then the decor safety net, then back onto your own island. Each step is the game server's own function. */
const A = G.normChar(await ctx.storage.get("char:u1")), back = (await import("../v3/assets/js/eastscape-decor-rules.js")).createDecorRules(G).decorSweep(A.isle);
const pl = { id: "u1", login: "keeper", name: "Keeper", role: "user", ws: { send() {} }, C: A, x: A.x, y: A.y, path: [], step: null, act: null, out: back.length ? [{ text: "went back in your tray" }] : [], lastInput: now, joinedAt: now, msgWindow: 0, msgs: 0, lastSwing: 0 };
W.isleRejoin(pl, saved); W.pls.set("u1", pl);
is([A.pen?.at, A.pen?.ms, A.pen?.child, A.pen?.a?.id, A.pen?.b?.id], [saved.pen.at, saved.pen.ms, saved.pen.child, "pa", "pb"], "the pet mid-breed is still in the pen, same parents, same clock");
is([A.hatch?.egg, A.hatch?.at, A.hatch?.ms], [saved.hatch.egg, saved.hatch.at, saved.hatch.ms], "the egg in the hatchery, same clock");
is(A.pets.map((p) => `${p.id}:${p.k}:${p.name}:${p.tier || 0}`), ["pa:bonepup:Rex:0", "pb:bonepup:Bones:1"], "both pets, names and ranks");
is([A.isle.plots[0], A.isle.plots[3], A.isle.beds[1]], [saved.isle.plots[0], saved.isle.plots[3], saved.isle.beds[1]], "the crops and the mushroom bed, same clocks");
is(A.isle.decor.map((d) => `${d.k}@${d.x},${d.y}:${d.at}`), saved.isle.decor.map((d) => `${d.k}@${d.x},${d.y}:${d.at}`), "every piece on the same tile, the hatchery and ladder included");
is([A.isle.tier, A.scene, pl.out.some((e) => /went back in your tray/.test(e.text || ""))], [2, saved.scene, false], "the same island, back on it, and nothing sent to the tray");
const S = W.scene(A.scene); is([!!S.objs.find((o) => o.t === "hatchery"), !!S.objs.find((o) => o.t === "pen"), !!S.objs.find((o) => o.t === "cellar")], [true, true, true], "the hatchery, the breeding pen and the cellar ladder all stand on the island");
console.log(bad ? `\n${bad} problem(s)` : "\nNothing reset: the pen, the egg, the pets, the crops, the beds and every piece of decor come through a login exactly as they were");
process.exitCode = bad ? 1 : 0;
