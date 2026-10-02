/* FIELD KITS (v1.2) —  node tools/eastscape-kits-test.mjs
   (2026-10-02) The real World: every kit used from the bag, its effect read where the game reads it, the grapple crossings walked, a snare
   set and checked, a catch made with a bow. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const mem = new Map(), ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => mem.get(k), put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) mem.set(a, structuredClone(b)); else mem.set(k, structuredClone(v)); }, delete: async (k) => { mem.delete(k); }, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; clearInterval(W.timer); W.houseSay = () => {};
let n = 0;
const player = (scene, x, y, lv = {}) => { const C = G.freshChar(); C.inv = []; C.scene = scene; for (const [k, v] of Object.entries({ hp: 60, archery: 60, fletching: 60, fishing: 60, ...lv })) C.xp[k] = G.XP_AT[v]; C.hp = G.maxHpOf(C);
  C.eq.weapon = "yewlogs_longbow"; C.eq.shield = "yewlogs_quiver"; C.quiver = { k: "onyx_arrow", n: 500 };
  const id = `k${++n}`, pl = { id, login: id, name: `Ranger${n}`, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 }; W.pls.set(id, pl); return pl; };
const said = (pl, re) => pl.out.some((o) => re.test(o.text || ""));
const give = (pl, k, q) => G.addInv(pl.C.inv, k, q, pl.C);
const useK = (pl, k) => { const i = pl.C.inv.findIndex((s) => s.k === k); W.useItem(pl, i); };

/* 0. the rules */
is([Object.keys(G.FIELD_KITS).length, Object.keys(G.FIELD_KITS).every((k) => G.ITEMS[`kit_${k}`] && G.RECIPES[`fletch_kit_${k}`]?.station === "fletcher"), !!G.ITEMS.grapple_arrow && !!G.ITEMS.snare && !!G.ITEMS.fishing_arrow, Object.keys(G.GRAPPLES).length],
  [7, true, true, 12], "seven timed kits made at the fletching table, grapple arrows, snares and fishing arrows, twelve grapple crossings");
is(Object.values(G.RECIPES).filter((r) => /^fletch_(kit_|grapple|snare|fishing)/.test(r.id)).every((r) => r.in.every(([k]) => G.ITEMS[k])), true, "every kit's ingredients are real items");
/* 1. using a kit: Archery to use, the tier is your Fletching, one at a time */
const a = player("workyard", 20, 10, { archery: 30 });
give(a, "kit_quickdraw", 1); useK(a, "kit_quickdraw");
is([a.C.kit, said(a, /Archery 55 to use/)], [null, true], "below its Archery level, a kit won't go on");
const b = player("workyard", 20, 11, { fletching: 75 });
give(b, "kit_quickdraw", 1); give(b, "kit_fleet", 1);
const swing0 = G.swingMsOf(b.C), step0 = G.stepMsOf(b.C);
useK(b, "kit_quickdraw");
is([b.C.kit?.k, b.C.kit?.tier, Math.round(b.C.kit?.left / 60000), G.swingMsOf(b.C) < swing0, G.buffsOf(b.C).some((x) => x.id === "kit")], ["quickdraw", 2, 15, true, true], "Quickdraw at Fletching 75: tier II, 15 minutes, the bow fires faster, shown with the buffs");
b.C.eq.weapon = "yewlogs_wand"; is(G.swingMsOf(b.C), Math.round((G.ITEMS.yewlogs_wand.speed || G.SWING_MS) / (1 + G.swingFx(b.C))), "but not with a wand in hand"); b.C.eq.weapon = "yewlogs_longbow";
useK(b, "kit_fleet");
is([b.C.kit?.k, G.stepMsOf(b.C) < step0, said(b, /replaces your Quickdraw/)], ["fleet", true, true], "Fleetfoot salve replaces it (one kit at a time) and you walk faster");
const r0 = G.reachOfHeld(b.C); b.C.kit = { k: "eagle", left: 60000, tier: 1 }; is(G.reachOfHeld(b.C), r0 + 1, "Eagle-eye: a tile more reach with a bow");
/* the clock */
b.C.kit = { k: "eagle", left: 3000, tier: 1 }; W.kitTickBuff(b, 1000); is(b.C.kit?.left, 2000, "the kit's clock runs");
W.kitTickBuff(b, 5000); is([b.C.kit, said(b, /has worn off/)], [null, true], "and it wears off");
/* 2. Hunter's Mark */
const S = W.scene("workyard"), mob = S.mobs.find((m) => !m.dead && G.MOBS[m.t]?.hp > 1 && !G.MOBS[m.t]?.boss);
const c = player("workyard", mob.x - 2, mob.y); give(c, "kit_mark", 1);
c.act = { kind: "mob", id: mob.id }; useK(c, "kit_mark");
is([c.C.kit?.k, c.C.kit?.t, W.kitMarkMul(c.C, mob) > 1, W.kitMarkMul(c.C, { t: "__other" }), said(c, new RegExp(G.MOBS[mob.t].name))], ["mark", mob.t, true, 1, true], "Hunter's Mark marks the monster you're fighting: more against that kind, nothing against others");
/* 3. the retriever */
const d = player("workyard", 5, 5); d.C.kit = { k: "retriever", left: 60000, tier: 3 }; d.C.quiver.n = 100;
for (let i = 0; i < 2000; i++) W.kitRetrieve(d, 5);
const back = d.C.quiver.n - 100; is(back > 850 && back < 1150, true, `the Arrow retriever III gives back about half of 2,000 arrows that landed (${back})`);
W.kitRetrieve(d, 0); const n0 = d.C.quiver.n; for (let i = 0; i < 200; i++) W.kitRetrieve(d, 0); is(d.C.quiver.n, n0, "and nothing for a miss");
/* 4. camo */
const Sb = W.scene("boneyard"), ag = Sb.mobs.find((m) => !m.dead && (m.aggro ?? G.MOBS[m.t]?.aggro));
if (!ag) { bad++; console.log("  !! no aggressive monster in the Boneyard to test camo"); }
else {
  const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [0, 2]].map(([dx, dy]) => [ag.x + dx, ag.y + dy]).find(([x, y]) => G.walkableIn(Sb.g, x, y));
  const e = player("boneyard", near[0], near[1], { hp: 99 }); e.C.kit = { k: "camo", left: 600000, tier: 1 }; ag.target = null;
  W.mobsTick(Sb, Date.now()); is(ag.target === e.id, false, "camo: an aggressive monster right next to you doesn't notice");
  e.C.kit = null; ag.target = null; W.mobsTick(Sb, Date.now() + 1000); is(ag.target === e.id, true, "without it, it does");
  e.C.kit = { k: "camo", left: 600000, tier: 1 }; W.startAct(Sb, e, { kind: "mob", id: ag.id }); is([e.C.kit, said(e, /throw off your camo/)], [null, true], "and attacking something takes the camo off");
}
/* 5. a grapple crossing */
const gp = G.GRAPPLES.gloam, Sg = W.scene("gloam"), post = Sg.objs.findIndex((o) => o.gp === "gloam" && o.end === 0);
const f = player("gloam", gp.a[0], gp.a[1]);
W.startAct(Sg, f, { kind: "ob", ob: post }); let t = Date.now() + 10;
for (let i = 0; i < 5 && f.act; i++) W.doAction(Sg, f, (t += 50));
is([f.x, f.y, said(f, /need a grapple arrow/)], [gp.a[0], gp.a[1], true], "no grapple arrow, no crossing");
give(f, "grapple_arrow", 2); W.startAct(Sg, f, { kind: "ob", ob: post });
for (let i = 0; i < 200 && f.act; i++) W.doAction(Sg, f, (t += 100));
is([f.x, f.y, G.countItems({ inv: f.C.inv, bank: [] }, ["grapple_arrow"]), f.out.some((o) => o.type === "cross")], [gp.b[0], gp.b[1], 1, true], "with one: you swing across to the other post, one arrow used");
const lo = player("sands", G.GRAPPLES.sands.a[0], G.GRAPPLES.sands.a[1], { archery: 20 }); give(lo, "grapple_arrow", 1); const Ss = W.scene("sands");
W.startAct(Ss, lo, { kind: "ob", ob: Ss.objs.findIndex((o) => o.gp === "sands" && o.end === 0) }); for (let i = 0; i < 5 && lo.act; i++) W.doAction(Ss, lo, (t += 50));
is([lo.x, said(lo, /Archery 35/)], [G.GRAPPLES.sands.a[0], true], "and a crossing above your Archery won't take you");
/* 6. snares */
const g = player("boneyard", 3, 3); give(g, "snare", 6);
const spots = []; for (let y = 2; y < G.ROWS - 2 && spots.length < 6; y++) for (let x = 2; x < G.COLS - 2 && spots.length < 6; x++) if (G.walkableIn(Sb.g, x, y) && Sb.g[y][x] !== "e") spots.push([x, y]);
for (const [x, y] of spots.slice(0, 5)) { g.x = x; g.y = y; useK(g, "snare"); }
is([g.C.snares.length, said(g, /4 snares out on this map/), W.meOf(g).snares.length], [4, true, 4], "four snares on a map at most, and the page is told where");
const ws = player("casino", G.START.x, G.START.y); give(ws, "snare", 1); useK(ws, "snare"); is([ws.C.snares?.length || 0, said(ws, /where things live/)], [0, true], "no snares on the casino floor (nothing lives there)");
const s0 = g.C.snares[0]; g.x = s0.x + 1; g.y = s0.y;
W.startAct(Sb, g, { kind: "snare", x: s0.x, y: s0.y }); for (let i = 0; i < 20 && g.act; i++) W.doAction(Sb, g, (t += 100));
is([g.C.snares.length, said(g, /Nothing in it yet/)], [4, true], "checked too soon: nothing yet");
g.C.snares[0].at -= G.SNARE.ms + 1000; const feathers0 = G.countItems({ inv: g.C.inv, bank: [] }, ["feather"]), ax0 = g.C.xp.archery;
W.startAct(Sb, g, { kind: "snare", x: s0.x, y: s0.y }); for (let i = 0; i < 20 && g.act; i++) W.doAction(Sb, g, (t += 100));
is([g.C.snares.length, G.countItems({ inv: g.C.inv, bank: [] }, ["feather"]) > feathers0, g.C.xp.archery > ax0], [3, true, true], "an hour on: feathers (and more), Archery xp, and the snare comes up");
/* 7. bowfishing */
const Sf = W.scene("workyard"), si = Sf.objs.findIndex((o) => o.t === "spot" && !o.special && (o.req?.lvl || 1) <= 60), spot = Sf.objs[si];
let stand = null; for (let r = 4; r >= 3 && !stand; r--) for (let dy = -r; dy <= r && !stand; dy++) for (let dx = -r; dx <= r; dx++) { const x = spot.x + dx, y = spot.y + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) === r && G.walkableIn(Sf.g, x, y)) { stand = [x, y]; break; } }
const h = player("workyard", stand[0], stand[1]); give(h, "fishing_arrow", 30);
W.startAct(Sf, h, { kind: "ob", ob: si });
is([h.act?.bow, h.act?.reach >= 4], [true, true], `with a bow and fishing arrows, a spot is fished from the bow's reach (${G.cheb(h, spot)} tiles), no rod in the bag`);
const fishN = () => h.C.inv.filter((s) => s.k !== "fishing_arrow").reduce((a2, s) => a2 + s.n, 0), fish0 = fishN(), arch0 = h.C.xp.archery;
for (let i = 0; i < 400 && h.act; i++) { W.doAction(Sf, h, (t += 400)); if (h.x !== stand[0] || h.y !== stand[1]) break; }
const fish1 = fishN();
is([fish1 > fish0, G.countItems({ inv: h.C.inv, bank: [] }, ["fishing_arrow"]) < 30, h.C.xp.archery > arch0, h.x === stand[0] && h.y === stand[1]], [true, true, true, true], "fish come in from where you stand, a fishing arrow a catch, and some Archery xp");
/* 8. the hold */
is(G.HOLD.kits, false, "open on this server (HOLD.kits is on for live until v1.2)");
console.log(bad ? `\n${bad} problem(s)` : "\nThe field kits hold: every kit, its tier and its effect, the grapple crossings, snares and bowfishing");
process.exitCode = bad ? 1 : 0;
