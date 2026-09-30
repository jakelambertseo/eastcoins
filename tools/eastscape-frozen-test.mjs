/* THE FROZEN REACH —  node tools/eastscape-frozen-test.mjs
   (2026-09-30) The real World, storage stubbed, held content opened, everything through the real swing (doAction):
     - two maps north of Cloudreach; every creature takes more from spells; a wand and Magic 40 opens it, a sword needs Combat;
     - the gathering; every shelf and floe creature out of a sword's reach and inside a wand's, and a real cast lands on each;
     - the sure cast: Magic 40 lands about half its spells here;
     - the Ice Wyrm: planned inside 2 PM - midnight Chicago, the admin's "rise now", it surfaces when somebody is there, three mages share the kill
       (paid, the report, CASINO's line), tomorrow is planned, and one left alone sinks back when its half hour is out;
     - the Frost Jarl: open, spells only, a shared kill with the report. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const said = []; W.houseSay = (t) => said.push(t);
let n = 0, t = Date.now() + 1000;
function mage(S, x, y, lvl = 99, wand = "frostpine_wand", bag = "bag_glacier", page = "page_fire_surge") {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; C.xp.hp = G.XP_AT[99]; C.hp = G.maxHpOf(C); C.xp.magic = G.XP_AT[lvl];
  C.eq.weapon = wand; C.eq.shield = bag; C.quiver = { k: page, n: 99999 };
  const id = `f${++n}`, pl = { id, login: id, name: `Mage${n}`, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); return pl;
}
const cast = (S, pl, m) => { pl.act = { kind: "mob", id: m.id, x: m.x, y: m.y, started: 1 }; pl.lastInput = (t += 3000); pl.lastSwing = 0; pl.path = []; W.doAction(S, pl, t); };
const openCells = (S) => { const o = []; for (let y = 0; y < S.g.length; y++) for (let x = 0; x < S.g[0].length; x++) if (G.walkableIn(S.g, x, y)) o.push({ x, y }); return o; };
const nearest = (S, m) => openCells(S).reduce((b, c) => { const d = G.cheb(c, m); return d < b.d ? { d, c } : b; }, { d: 99, c: null });

/* 1. the rules */
is([G.FROZEN_MAPS.every((k) => G.OPEN.has(k)), G.SCENES.cloud.exits.n, G.SCENES.frozen.exits.s, G.SCENES.frozen.exits.n, G.SCENES.frostspire.exits.s], [true, "frozen", "cloud", "frostspire", "frozen"], "two maps north of Cloudreach");
is(["frostwolf", "yeti", "snowowl", "frostwraith", "iceelemental", "frostgiant", "frostjarl", "icewyrm"].every((k) => G.guardMul(k, "magic") > 1 && G.MOBS[k].weak === "fire"), true, "every creature takes more from spells and is weak to fire");
{ const c = G.freshChar(); c.xp.magic = G.XP_AT[40]; c.eq.weapon = "logs_wand"; const w = G.bandBlock(c, "frostspire", "fight"); c.eq.weapon = "bronze_sword"; const s = G.bandBlock(c, "frozen", "fight");
  is([w, /Magic 40 with a wand/.test(s?.text || ""), JSON.stringify([G.BANDS.frozen, G.BANDS.frostspire])], [null, true, "[[100,108],[106,115]]"], "a wand at Magic 40 opens it, a sword does not; bands 100-115"); }
const B = Object.fromEntries(G.FROZEN_MAPS.map((k) => [k, G.buildScene(k)])), count = (f) => G.FROZEN_MAPS.reduce((a, k) => a + B[k].objs.filter(f).length, 0);
is([count((o) => o.t === "frostpine"), count((o) => o.t === "rock" && o.ore === "glacite"), count((o) => o.t === "spot" && o.fish === "icefin")], [7, 7, 7], "seven frostpines, seven glacite rocks, seven holes in the ice");
/* 2. every shelf and floe creature: out of a sword's reach, inside a wand's, and a real cast lands */
for (const key of G.FROZEN_MAPS) {
  const S = W.scene(key);
  for (const m of S.mobs.filter((q) => q.perch && !G.walkableIn(S.g, q.x, q.y))) {
    const nr = nearest(S, m), pl = mage(S, nr.c.x, nr.c.y), hp0 = m.hp;
    for (let i = 0; i < 30 && m.hp === hp0; i++) cast(S, pl, m);
    if (nr.d < 2 || nr.d > 5 || m.hp === hp0) { bad++; console.log(`  !! ${key}: ${m.t} at ${m.x},${m.y}: ${nr.d} from open ground, a cast ${m.hp < hp0 ? "landed" : "did NOT land"}`); }
    m.hp = G.MOBS[m.t].hp; m.by = {}; W.pls.delete(pl.id);
  }
  console.log(`  ${key}: every shelf and floe creature checked`);
}
/* 3. the sure cast */
{ const S = W.scene("frozen"), m = S.mobs.find((q) => q.t === "frostwolf"), c = openCells(S).find((o) => G.cheb(o, m) <= 4 && G.cheb(o, m) >= 2), pl = mage(S, c.x, c.y, 40, "logs_wand", "bag_hedge", "page_fire_bolt");
  let hits = 0; const N = 500; for (let i = 0; i < N; i++) { m.hp = 99999; cast(S, pl, m); if (m.hp < 99999) hits++; }
  const bare = G.hitChance(G.attackRollOf(pl.C), G.MOBS.frostwolf.def);
  console.log(`  the sure cast: Magic 40 lands ${Math.round((hits / N) * 100)}% of ${N} spells on a Frost Wolf (the ordinary roll would be ${Math.round(bare * 100)}%)`);
  if (hits / N < 0.42 || hits / N > 0.62) { bad++; console.log("  !! the sure cast is not landing about half"); }
  m.hp = G.MOBS.frostwolf.hp; W.pls.delete(pl.id); }
/* 4. the Ice Wyrm's day */
{ const ct = (ms) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(ms); return (+p.find((x) => x.type === "hour").value % 24) * 60 + +p.find((x) => x.type === "minute").value; };
  let inWindow = true; for (let i = 0; i < 200; i++) { W.wyrmPlan(Date.now() + i * 3600000 * 7); const m = ct(W.wyrm.at); if (m < 14 * 60 || m >= 24 * 60) inWindow = false; }
  is(inWindow, true, "200 plans, every one between 2 PM and midnight Chicago");
  const S = W.scene("frozen"), notes = []; const admin = mage(S, 21, 20); admin.role = "admin";
  W.wyrmAdmin(S, admin, "", (x) => notes.push(x));
  const wy = S.mobs.find((q) => q.t === "icewyrm");
  is([!!wy, wy && [wy.x, wy.y].join(","), said.some((x) => /ICE WYRM IS RISING/.test(x))], [true, G.WYRM.at.join(","), true], "the admin's rise: CASINO calls it and it surfaces on its floe (someone is there)");
  const [wx, wy2] = G.WYRM.at, spots = openCells(S).filter((o) => G.cheb(o, { x: wx, y: wy2 }) <= 5).slice(0, 3), mages = spots.map((o) => mage(S, o.x, o.y));
  for (let i = 0; i < 40; i++) for (const p of mages) cast(S, p, wy);
  is(mages.map((p) => (wy.by?.[p.id] || 0) > 0), [true, true, true], "three mages hurt it at once");
  for (const p of mages) wy.by[p.id] = Math.max(wy.by[p.id] || 0, Math.ceil(G.MOBS.icewyrm.hp * G.OPEN_SHARE) + 1);
  const before = mages.map((p) => G.tixIn(p.C)); for (const p of mages) p.out = []; said.length = 0;
  wy.hp = 1; for (let i = 0; i < 50 && !wy.dead; i++) cast(S, mages[0], wy);
  is([wy.dead, mages.map((p, i) => G.tixIn(p.C) > before[i]), mages.map((p) => p.out.some((e) => e.type === "runreport" && e.r.kind === "boss"))], [true, [true, true, true], [true, true, true]], "the kill is shared: all three paid, all three get the report");
  is([said.some((x) => /brought the Ice Wyrm down/.test(x)), !S.mobs.some((q) => q.t === "icewyrm"), !!W.wyrm.at && !W.wyrm.up && W.wyrm.at > Date.now()], [true, true, true], "CASINO says so, the corpse goes, and tomorrow's is planned");
  said.length = 0; W.wyrmAdmin(S, admin, "", () => {}); const w2 = S.mobs.find((q) => q.t === "icewyrm");
  W.wyrm.up.until = Date.now() - 1; W.wyrmTick(Date.now());
  is([!S.mobs.some((q) => q.t === "icewyrm"), said.some((x) => /sinks back under the ice/.test(x)), !!w2], [true, true, true], "left alone past its half hour, it sinks back and says so");
  is(W.wyrmState().nextS > 0, true, "and /stats shows when the next one rises");
  for (const p of [...mages, admin]) W.pls.delete(p.id); }
/* 5. the Frost Jarl */
{ const S = W.scene("frostspire"), m = S.mobs.find((q) => q.t === "frostjarl"), spots = openCells(S).filter((o) => G.cheb(o, m) <= 5).slice(0, 2), ms = spots.map((o) => mage(S, o.x, o.y));
  for (let i = 0; i < 30; i++) for (const p of ms) cast(S, p, m);
  for (const p of ms) m.by[p.id] = Math.max(m.by[p.id] || 0, Math.ceil(G.MOBS.frostjarl.hp * G.OPEN_SHARE) + 1);
  for (const p of ms) p.out = []; said.length = 0; m.hp = 1; for (let i = 0; i < 50 && !m.dead; i++) cast(S, ms[0], m);
  is([m.dead, ms.every((p) => p.out.some((e) => e.type === "runreport")), said.some((x) => /put The Frost Jarl down/.test(x))], [true, true, true], "the Frost Jarl: a shared kill, the report, CASINO's line"); }
console.log(bad ? `\n${bad} problem(s)` : "\nThe Frozen Reach holds: the mages' map, its shelves and floes, the sure cast, the Ice Wyrm's day and the Frost Jarl");
process.exitCode = bad ? 1 : 0;
