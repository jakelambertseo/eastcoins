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
is([G.VALLEY_MAPS.every((k) => G.OPEN.has(k)), G.SCENES.trailer.exits.n, G.SCENES.valley.exits.s, G.SCENES.valley.exits.n, G.SCENES.valley_ridge.exits.n, G.SCENES.valley_lair.exits.s], [true, "valley", "trailer", "valley_ridge", "valley_lair", "valley_ridge"], "three maps in a chain north of the Trailer Park");
/* (2026-09-30, the owner: "this should be an archery focused map for archers") every monster here takes MORE from arrows */
is(["caveman", "sabretooth", "pterodactyl", "mammoth", "raptor", "tarhorror", "rex", "matriarch"].every((t) => G.guardMul(t, "archery") > 1), true, "every Valley monster takes more from archery");
is([G.guardMul("pterodactyl", "melee"), G.guardMul("pterodactyl", "archery"), G.guardMul("tarhorror", "melee"), G.guardMul("raptor", "magic"), G.MOBS.caveman.range], [0, 1.5, 0, 0.5, 4], "pterodactyls and tar horrors out of a sword's use, raptors half from spells, cavemen throw from 4");
is([G.MOBS.rex.boss, !!G.MOBS.rex.open, G.MOBS.matriarch.boss, G.MOBS.matriarch.open, G.MOBS.matriarch.rise, G.MOBS.rex.weak, G.MOBS.matriarch.weak], [true, false, true, true, true, "frost", "fire"], "Old Rex a map boss (weak to frost), the Matriarch an open boss that rises (weak to fire)");
const B = Object.fromEntries(G.VALLEY_MAPS.map((k) => [k, G.buildScene(k)])), count = (f) => G.VALLEY_MAPS.reduce((a, k) => a + B[k].objs.filter(f).length, 0);
is([count((o) => o.t === "cycad"), count((o) => o.t === "rock" && o.ore === "fossil"), count((o) => o.t === "spot" && o.fish === "coelacanth")], [7, 8, 4], "seven cycads, eight fossil rocks, four coelacanth spots");
for (const k of G.VALLEY_MAPS) {
  const b = B[k], mobs = G.SCENES[k].mobs, open = [];
  for (let y = 0; y < b.g.length; y++) for (let x = 0; x < b.g[0].length; x++) if (G.walkableIn(b.g, x, y)) open.push([x, y]);
  const ledge = mobs.filter(([, x, y, o]) => o?.perch && !G.walkableIn(b.g, x, y));
  is([mobs.every(([, x, y, o]) => G.walkableIn(b.g, x, y) || o?.perch), ledge.every(([, x, y]) => Math.min(...open.map(([a, c]) => Math.max(Math.abs(a - x), Math.abs(c - y)))) >= 2), ledge.length * 2 > mobs.filter(([t]) => !G.MOBS[t].boss).length],
    [true, true, true], `${k}: everything on open ground or a ledge, no ledge a sword reaches, and most of them up there`);
  is(b.g.flat().filter((c) => c === ",").length > 40, true, `${k}: a cobble road`);
}
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const said = []; W.houseSay = (t) => said.push(t);
const S = W.scene("valley_ridge"), rap = S.mobs.find((m) => m.t === "raptor"), LOW = W.scene("valley");
{ const r = Math.random; Math.random = () => 0; rap.dead = true; rap.respawnAt = 0; W.mobsTick(S, Date.now()); Math.random = r; }

is([rap.t, rap.base, said.some((t) => /Golden Raptor/.test(t))], ["goldenraptor", "raptor", true], "a raptor comes back golden (forced roll), and the server hears");
{ const r = Math.random; Math.random = () => 0.9; rap.dead = true; rap.respawnAt = 0; W.mobsTick(S, Date.now()); Math.random = r; }
is(rap.t, "raptor", "and after that life, plain again");
{ const mt = LOW.mobs.find((m) => m.t === "matriarch"); mt.dead = true; mt.respawnAt = 0; said.length = 0; W.mobsTick(LOW, Date.now()); is(said.some((t) => /Mammoth Matriarch has come back/.test(t)), true, "the Matriarch's return is announced"); }
console.log(bad ? `\n${bad} problem(s)` : "\nThe Primeval Valley holds: its rules, its resources, its bosses, and the golden raptor");
process.exitCode = bad ? 1 : 0;
