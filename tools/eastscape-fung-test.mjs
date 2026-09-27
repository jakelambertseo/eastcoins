/* DOES FUNGICULTURE WORK? —  node tools/eastscape-fung-test.mjs
   (2026-09-27) The real World with storage stubbed: compost is made at the cellar's bin (the station loop), the ladder goes on the
   island and down to the owner's cellar (and nobody else's), a bed refuses what it should (level, compost, a boarded bed) and
   grows, harvests and gives spawn back, the steps come back up by the ladder, every outdoor map has its three wild clusters and a
   cluster gives once a day, the Truffle Pig finds truffles, and the beds survive a save. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
import { createDecorRules } from "../v3/assets/js/eastscape-decor-rules.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (got === want) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};

const C = G.freshChar(); C.inv = C.inv.filter((s) => s.k === "tickets");
const said = () => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop();
const pl = { id: "u1", login: "u1", name: "Grower", role: "user", ws: { send() {} }, C, x: 0, y: 0, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now() };
W.pls.set("u1", pl);
const standBy = (S, ob) => { for (const [dx, dy] of G.D8) { const x = ob.x + dx, y = ob.y + dy; if (G.walkableIn(S.g, x, y)) { pl.x = x; pl.y = y; C.scene = S.key; return; } } throw new Error(`nowhere to stand by ${ob.t}`); };
const arrive = (S, ob, kind) => { standBy(S, ob); pl.act = { kind, ob, x: ob.x, y: ob.y }; W.doAction(S, pl, Date.now()); };

/* 1. the ladder goes on the island and down */
const isle = W.scene(G.isleKey(C.isle, "u1"));
C.isle.owned = { cellarladder: 1 };
standBy(isle, { x: G.SCENES.isle.entry.x, y: G.SCENES.isle.entry.y - 1 });
let placed = false;
for (let y = 3; y < G.ROWS - 3 && !placed; y++) for (let x = 3; x < G.COLS - 3 && !placed; x++) { const n = C.isle.decor.length; W.decorOp(isle, pl, { op: "place", k: "cellarladder", x, y }); placed = C.isle.decor.length > n; }
is(placed, true, "the cellar ladder can be put down on the island");
const ladder = isle.objs.find((o) => o.t === "cellar"); is(!!ladder, true, "and it stands there as a ladder (t: cellar)");
const vis = { ...pl, id: "u2", C: G.freshChar(), out: [] }; W.pls.set("u2", vis); vis.x = ladder.x; vis.y = ladder.y + 1; vis.C.scene = isle.key; vis.act = { kind: "cellar", ob: ladder, x: ladder.x, y: ladder.y }; W.doAction(isle, vis, Date.now());
is(vis.C.scene, isle.key, "a visitor cannot go down somebody else's cellar"); W.pls.delete("u2");
arrive(isle, ladder, "cellar");
is(C.scene, "cellar:u1", "the owner climbs down to their cellar");
const cel = W.scene("cellar:u1"), beds = cel.objs.filter((o) => o.t === "fbed"), bin = cel.objs.find((o) => o.t === "compost");
is(createDecorRules(G).decorInto(cel.key, G.buildScene(cel.key), C.isle).objs.some((o) => o.decor), false, "the page lays none of the island's furniture in the cellar");
is(beds.length, 10, "the cellar has ten beds"); is(!!bin, true, "and a compost bin");

/* 2. compost at the bin, through the station loop */
G.addInv(C.inv, "tomatoe", 9, C); G.addInv(C.inv, "bones", 3, C);
standBy(cel, bin); pl.act = { kind: "rot", ob: bin, x: bin.x, y: bin.y, pick: "rot_tomatoe", started: 0 };
let now = Date.now(); for (let i = 0; i < 12 && pl.act; i++) { now += 3000; pl.lastInput = now; W.doAction(cel, pl, now); }
is(G.countItems(C, ["compost"]), 6, "three turns of the bin make six compost");
is(C.xp.fungiculture > 0, true, "and it trains Fungiculture");

/* 3. a bed */
G.addInv(C.inv, "spawn_sporecap", 1, C); G.addInv(C.inv, "spawn_oyster", 1, C);
standBy(cel, beds[0]);
W.fungOp(cel, pl, { op: "plant", i: 0, k: "spawn_oyster" }); is(C.isle.beds[0], null, "oyster spawn is refused below its level"); is(/Fungiculture level of 12/.test(said() || ""), true, "and says the level");
const keep = G.countItems(C, ["compost"]); G.takeInv(C.inv, "compost", keep);
W.fungOp(cel, pl, { op: "plant", i: 0, k: "spawn_sporecap" }); is(C.isle.beds[0], null, "a bed without compost is refused"); is(/compost/.test(said() || ""), true, "and says so");
G.addInv(C.inv, "compost", keep, C);
standBy(cel, beds[7]); W.fungOp(cel, pl, { op: "plant", i: 7, k: "spawn_sporecap" }); is(C.isle.beds[7], null, "bed 8 is boarded on a first island");
standBy(cel, beds[0]); W.fungOp(cel, pl, { op: "plant", i: 0, k: "spawn_sporecap" });
is(C.isle.beds[0]?.k, "spawn_sporecap", "sporecap spawn goes into bed 1"); is(G.countItems(C, ["compost"]), keep - 1, "and takes one compost");
pl.out = []; arrive(cel, beds[0], "fbed"); is(/ready in/.test(said() || ""), true, "a growing bed says when");
C.isle.beds[0].at -= G.FUNGI.spawn_sporecap.ms;
const before = G.countItems(C, ["sporecap"]), xp0 = C.xp.fungiculture; arrive(cel, beds[0], "fbed");
is(G.countItems(C, ["sporecap"]) - before >= 3, true, `a ripe bed harvests (${G.countItems(C, ["sporecap"]) - before} sporecaps)`);
is(G.countItems(C, ["spawn_sporecap"]) >= G.SEED_BACK, true, `and gives spawn back (${G.countItems(C, ["spawn_sporecap"])})`);
is(C.xp.fungiculture - xp0, G.FUNGI.spawn_sporecap.xp, "and pays its xp"); is(C.isle.beds[0], null, "and is empty again");
pl.out = []; arrive(cel, beds[1], "fbed"); is(pl.out.some((o) => o.type === "fplant" && o.i === 1), true, "an empty bed asks the page what to plant");

/* 4. the steps come back up by the ladder */
const up = W.cellarUp(cel); is(up.scene === isle.key && up.x === ladder.x && up.y === ladder.y + 1, true, `the way up comes out beside the ladder (${up.x},${up.y})`);

/* 5. the wild clusters */
for (const k of Object.keys(G.FUNG_WILD)) { const S = W.scene(k), n = S.objs.filter((o) => o.t === "shroom").length; if (n !== 3) fail(`${k} has ${n} wild clusters, wanted 3`); }
ok(`every outdoor map has three wild clusters (${Object.keys(G.FUNG_WILD).length} maps)`);
const yard = W.scene("workyard"), cl = yard.objs.find((o) => o.t === "shroom" && o.k === "sporecap");
const pb = G.buildScene("workyard").objs.find((o) => o.t === "shroom" && o.k === "sporecap"); is(pb && pb.x === cl.x && pb.y === cl.y && pb.id === cl.id, true, "the page builds the same cluster in the same place with the same id");
const sc0 = G.countItems(C, ["sporecap"]); arrive(yard, cl, "shroom"); is(G.countItems(C, ["sporecap"]) > sc0, true, "a wild sporecap cluster gives sporecaps");
const sc1 = G.countItems(C, ["sporecap"]); arrive(yard, cl, "shroom"); is(G.countItems(C, ["sporecap"]), sc1, "and nothing more the same day"); is(/tomorrow/.test(said() || ""), true, "and says tomorrow");
const star = W.scene("trailer").objs.find((o) => o.t === "shroom"); arrive(W.scene("trailer"), star, "shroom"); is(/Fungiculture level of 90/.test(said() || ""), true, "a starcap cluster needs Fungiculture 90");

/* 6. the Truffle Pig */
C.pets = [{ id: "tp", k: "trufflepig", name: "" }]; C.eq.pet = "tp"; C.fung = null;
const R = Math.random; Math.random = () => 0.01; arrive(yard, cl, "shroom"); Math.random = R;
is(G.countItems(C, ["truffle"]) >= 1 && G.countItems(C, ["spawn_truffle"]) >= 1, true, "a Truffle Pig finds a truffle and truffle spawn in a wild cluster");

/* 7. the rules hang together */
is(Object.values(G.RECIPES).filter((r) => r.station === "compost" || /fung|mould|glow|truffle|morel|button|inkcap|oyster|sleep|bleed|pipe|mane|star/.test(r.id)).every((r) => r.in.every(([k]) => G.ITEMS[k]) && G.ITEMS[r.out[0]]), true, "every Fungiculture recipe's ingredients and output exist");
is(Object.entries(G.FUNGI).every(([k, F]) => G.ITEMS[k] && G.ITEMS[F.yields] && F.compost >= 1), true, "every spawn is an item and grows a real shroom");
is(!!G.SKILLS.fungiculture && G.HISCORES.some(([k]) => k === "fungiculture"), true, "Fungiculture is a skill with a hiscore board");
is(G.MOBS.toadstool.drops.some(([k]) => k === "spawn_sporecap"), true, "the Toadstool drops sporecap spawn now and then");
C.isle.beds[2] = { k: "spawn_inkcap", at: 123, ms: 456 };
const back = G.normChar(JSON.parse(JSON.stringify(C))); is(JSON.stringify(back.isle.beds[2]), JSON.stringify({ k: "spawn_inkcap", at: 123, ms: 456 }), "a planted bed survives a save");

console.log(bad ? `\n${bad} problem(s)` : "\nfungiculture works: the ladder, the cellar, compost, beds, spawn back, wild clusters, the truffle, saves");
process.exitCode = bad ? 1 : 0;
