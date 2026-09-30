/* THE PRIMEVAL VALLEY —  node tools/eastscape-valley-test.mjs
   (2026-09-30) The real World with storage stubbed, held content opened: the Valley is north of the Trailer Park and reachable; every monster's
   style rule is what its description says (the pterodactyl nothing from melee and 25% MORE from archery; the tar horror only fire magic);
   the resources work; Old Rex and the Matriarch are bosses, and she is open; a respawned raptor can come back golden, and goes back plain;
   and the valley is shut when held. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
is([G.OPEN.has("valley"), G.SCENES.trailer.exits.n, G.SCENES.valley.exits.s, JSON.stringify(G.BANDS.valley)], [true, "valley", "trailer", "[85,99]"], "north of the Trailer Park, Combat 85");
is([G.guardMul("pterodactyl", "melee"), G.guardMul("pterodactyl", "archery"), G.guardMul("caveman", "magic"), G.guardMul("raptor", "melee"), G.guardMul("raptor", "magic")], [0, 1.25, 1.25, 1.25, 0.4], "style rules: pterodactyl, caveman, raptor");
is([G.guardMul("tarhorror", "melee"), G.guardMul("tarhorror", "archery"), G.guardMul("tarhorror", "magic", "fire"), G.guardMul("tarhorror", "magic", "frost")], [0, 0, 1, 0.1], "the tar horror: only fire magic");
is([G.MOBS.rex.boss, !!G.MOBS.rex.open, G.MOBS.matriarch.boss, G.MOBS.matriarch.open, G.MOBS.matriarch.rise, G.MOBS.rex.weak, G.MOBS.matriarch.weak], [true, false, true, true, true, "frost", "fire"], "Old Rex a map boss (weak to frost), the Matriarch an open boss that rises (weak to fire)");
const b = G.buildScene("valley");
is([b.objs.filter((o) => o.t === "cycad").length, b.objs.filter((o) => o.t === "rock" && o.ore === "fossil").length, b.objs.filter((o) => o.t === "spot" && o.fish === "coelacanth").length], [6, 5, 4], "six cycads, five fossil rocks, four coelacanth spots");
is(G.SCENES.valley.mobs.every(([t, x, y]) => G.walkableIn(b.g, x, y) || G.SCENES.valley.mobs.find((m) => m[1] === x && m[2] === y)?.[3]?.perch), true, "every monster stands on open ground (or perches)");
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const said = []; W.houseSay = (t) => said.push(t);
const S = W.scene("valley"), rap = S.mobs.find((m) => m.t === "raptor");
{ const r = Math.random; Math.random = () => 0; rap.dead = true; rap.respawnAt = 0; W.mobsTick(S, Date.now()); Math.random = r; }

is([rap.t, rap.base, said.some((t) => /Golden Raptor/.test(t))], ["goldenraptor", "raptor", true], "a raptor comes back golden (forced roll), and the server hears");
{ const r = Math.random; Math.random = () => 0.9; rap.dead = true; rap.respawnAt = 0; W.mobsTick(S, Date.now()); Math.random = r; }
is(rap.t, "raptor", "and after that life, plain again");
{ const mt = S.mobs.find((m) => m.t === "matriarch"); mt.dead = true; mt.respawnAt = 0; said.length = 0; W.mobsTick(S, Date.now()); is(said.some((t) => /Mammoth Matriarch has come back/.test(t)), true, "the Matriarch's return is announced"); }
console.log(bad ? `\n${bad} problem(s)` : "\nThe Primeval Valley holds: its rules, its resources, its bosses, and the golden raptor");
process.exitCode = bad ? 1 : 0;
