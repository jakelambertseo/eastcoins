/* TINKERING —  node tools/eastscape-tinker-test.mjs
   (2026-09-28) The real World with storage stubbed, Tinkering opened as on the dev server, standing at Sprocket Sal's Scrap Bench: a stack
   salvages into exactly the parts salvageOf says, out of the bag and into the pouch, and pays its part value as Tinkering xp; the lot takes
   plain drops and never gear, bars, food or a favourite; a reforged piece is salvaged by its level; away from the bench nothing happens;
   and the pouch survives a save. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const store = new Map(), ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => (store.has(k) ? structuredClone(store.get(k)) : undefined), put: async (k, v) => { if (k === "proj") store.set(k, structuredClone(v)); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
const S = W.scene("workyard"), bench = S.objs.find((o) => o.t === "scrapbench");
is([!!bench, !!S.npcs.find((n) => n.name === G.TINK.npc)], [true, true], "Sal and her bench are in the Yard (Tinkering open)");
const pl = { id: "t1", name: "t1", C: G.freshChar(), x: bench.x + 1, y: bench.y, out: [], path: [] }; pl.C.scene = "workyard"; W.pls.set("t1", pl);
const C = pl.C, cnt = (k, f) => C.inv.filter((s) => s.k === k && (f == null || (G.fOf(s) | 0) === f)).reduce((a, s) => a + s.n, 0), last = (t) => [...pl.out].reverse().find((e) => e.type === t);

/* 1. one stack */
G.addInv(C.inv, "bones", 46, C); const want = G.salvageOf("bones", 46), xp0 = C.xp.tinkering || 0;
W.tinkerOp(S, pl, { op: "salvage", k: "bones" });
is([cnt("bones"), C.parts.scrap, (C.xp.tinkering || 0) - xp0], [0, want.scrap, want.pv], "46 bones: gone from the bag, their scrap in the pouch, their part value as xp");

/* 2. the lot: plain drops only */
G.addInv(C.inv, "pit", 30, C); G.addInv(C.inv, "husk", 10, C); G.addInv(C.inv, "cchicken", 5, C); G.addInv(C.inv, "bronze_bar", 3, C); G.addInv(C.inv, "feather", 20, C);
C.inv.push({ k: "bronze_helm", n: 1 }); C.fav = ["feather"];
W.tinkerOp(S, pl, { op: "salvage", lot: true });
is([cnt("pit"), cnt("husk"), cnt("cchicken"), cnt("bronze_bar"), cnt("bronze_helm"), cnt("feather")], [0, 0, 5, 3, 1, 20], "the lot takes pits and husks; never food, bars, gear or a favourite");
C.fav = [];

/* 3. gear, and a reforged piece by its level */
C.inv.push({ k: "bronze_helm", n: 1, f: 3 }); const g3 = G.salvageOf("bronze_helm", 1, 3), gears0 = C.parts.gears;
W.tinkerOp(S, pl, { op: "salvage", k: "bronze_helm", f: 3 });
is([cnt("bronze_helm", 3), cnt("bronze_helm", 0), C.parts.gears - gears0], [0, 1, g3.gears], "the +3 helm goes, at its level; the plain one stays");

/* 4. never money or an egg; away from the bench nothing */
G.addInv(C.inv, "tickets", 500, C); W.tinkerOp(S, pl, { op: "salvage", k: "tickets" }); is(G.tixIn(C) >= 500, true, "tickets can't be salvaged");
pl.x = 30; pl.y = 5; const s0 = C.parts.scrap; G.addInv(C.inv, "pit", 10, C); W.tinkerOp(S, pl, { op: "salvage", k: "pit" });
is([cnt("pit"), C.parts.scrap], [10, s0], "away from the bench: nothing taken, nothing given");

/* 5. the pouch survives a save */
const round = G.normChar(JSON.parse(JSON.stringify(C)));
is(round.parts, C.parts, "the pouch survives a save");
is(!!last("tinker")?.view?.parts, true, "the window is told the pouch");

/* 6. GADGETS: building */
pl.x = bench.x + 1; pl.y = bench.y; W.hwTick = () => {}; W.pitTick = async () => {}; W.songTick = () => {};
C.parts = { scrap: 1000, gears: 100, sparks: 100, relic: 10 }; G.addInv(C.inv, "tickets", 5000, C); C.xp.tinkering = 0;
W.tinkerOp(S, pl, { op: "build", id: "whetstone" }); is(cnt("tk_whetstone"), 0, "a Tinkering 12 build at level 1 is refused");
C.xp.tinkering = G.XP_AT[30]; W.grant(pl, "tinkering", 1);   /* (the level-30 achievements pay tickets: settle them before measuring the fee) */
const t0 = G.tixIn(C), s1 = C.parts.scrap, xpb = C.xp.tinkering;
W.tinkerOp(S, pl, { op: "build", id: "whetstone" }); const g = G.GADGETS.whetstone;
is([cnt("tk_whetstone") >= 1, t0 - G.tixIn(C), s1 - C.parts.scrap, C.xp.tinkering > xpb], [true, g.fee, g.parts.scrap, true], "a Whetstone: parts and the fee gone, the gadget in the bag, xp paid");
const before = { ...C.parts }; C.parts.gears = 0; W.tinkerOp(S, pl, { op: "build", id: "bellows" }); is(cnt("tk_bellows"), 0, "short of parts: refused, nothing taken"); C.parts = before;

/* 7. using one: a timed gadget runs, can't be doubled, counts down and breaks into a little scrap */
const useK = (k) => W.useItem(pl, C.inv.findIndex((s) => s.k === k));
pl.x = 30; pl.y = 5;   /* out in the Yard, where buff clocks run */
useK("tk_whetstone"); is([!!C.tk?.whetstone, G.tkDmg(C, "melee")], [true, g.dmg.melee], "the Whetstone is running: melee damage up");
C.inv = C.inv.filter((s) => s.k !== "tk_whetstone"); G.addInv(C.inv, "tk_whetstone", 1, C); useK("tk_whetstone");   /* (a Masterwork build leaves a second one: start from exactly one) */ is(cnt("tk_whetstone"), 1, "a second one while it runs is refused and kept");
const sc = C.parts.scrap; C.tk.whetstone.left = 900; let t = Date.now(); pl.fxAt = t; for (let i = 0; i < 40; i++) { t += 50; W.tickTimed(t); }
is([!!C.tk.whetstone, C.parts.scrap - sc], [false, Math.floor(g.parts.scrap * 0.1)], "it runs out and hands back a tenth of its scrap");

/* 8. the Medkit heals; the Humidifier adds xp; the bomb arms; the banner reaches the party */
G.addInv(C.inv, "tk_medkit", 1, C); C.xp.hp = G.XP_AT[40]; C.hp = 5; useK("tk_medkit"); pl.fxAt = t; for (let i = 0; i < 120; i++) { t += 50; W.tickTimed(t); }
is(C.hp > 5, true, `the Medkit heals over time (5 -> ${C.hp})`);
G.addInv(C.inv, "tk_humidifier", 1, C); useK("tk_humidifier"); const f0 = C.xp.fungiculture || 0; W.grant(pl, "fungiculture", 100); is((C.xp.fungiculture || 0) - f0, 125, "the Humidifier: 100 xp becomes 125");
G.addInv(C.inv, "tk_bomb", 1, C); useK("tk_bomb"); is(C.tkBomb, G.GADGETS.bomb.bomb, "the Boss Bomb is armed");
const mate = { id: "t2", name: "t2", C: G.freshChar(), x: pl.x + 2, y: pl.y, out: [], path: [] }; mate.C.scene = "workyard"; W.pls.set("t2", mate);
W.parties ||= new Map(); W.parties.set("pp", { id: "pp", leader: "t1", members: ["t1", "t2"] }); pl.party = mate.party = "pp";
G.addInv(C.inv, "tk_banner", 1, C); useK("tk_banner"); is([!!C.tk.banner_buff, !!mate.C.tk?.banner_buff, G.fxOf(mate.C).tough >= 0.05], [true, true, true], "the Party Banner buffs you and your party");
G.addInv(C.inv, "tk_confetti", 3, C); mate.out = []; useK("tk_confetti"); is([cnt("tk_confetti"), !!mate.out.find((e) => e.type === "confetti")], [2, true], "confetti: one shot used, everyone around sees it");

/* 9. THE AUTOMATION TOOLS: slower only while nobody is there, and on to the next rock of the same ore */
const miner = { id: "m1", name: "m1", C: G.freshChar(), x: 5, y: 8, out: [], path: [], lastInput: Date.now() }; miner.C.scene = "workyard"; W.pls.set("m1", miner);
const now9 = Date.now(); miner.C.tk = { auger: { left: 600000 } };
is([W.tkSlow(miner, now9, "rock"), (miner.lastInput = now9 - 10 * 60000, Math.round(W.tkSlow(miner, now9, "rock") * 100) / 100), W.tkSlow(miner, now9, "tree")], [1, 1.33, 1], "the Auger: full speed while you're there, 75% while you're away, nothing for trees");
const rocks = S.objs.map((o, i) => [o, i]).filter(([o]) => o.t === "rock" && o.ore === "copper"), [r0] = rocks[0];
miner.x = r0.x + 1; miner.y = r0.y; miner.act = null; W.tkNext(S, miner, r0, "rock");
const went = S.objs[miner.act?.ob ?? -1] || (miner.act && S.objs.find((o) => o.x === miner.act.x && o.y === miner.act.y));
is([!!miner.act, went && went !== r0 && went.ore === "copper"], [true, true], "a rock runs dry: the Auger walks you to the next copper rock");
miner.act = null; miner.C.tk = {}; W.tkNext(S, miner, r0, "rock"); is(miner.act, null, "without an Auger: you stop, as ever");

/* 10. WORLD PROJECTS: the dock. Given at the bench, capped at the need; finished on site with the level; the map changes; a restart keeps it */
is([G.projTier("dock"), !!S.objs.find((o) => o.t === "dockruin"), !!S.objs.find((o) => o.t === "dock")], [0, true, false], "the Yard pond has a rotten jetty, and no dock");
const D = G.PROJECTS.dock.tiers[0], bldr = pl; bldr.x = bench.x + 1; bldr.y = bench.y; bldr.login = "t1";
bldr.C.parts = { scrap: 99999, gears: 9999, sparks: 9999, relic: 99 }; G.addInv(bldr.C.inv, "tickets", 400000, bldr.C);
const xpd = bldr.C.xp.tinkering, sc0 = bldr.C.parts.scrap;
W.tinkerOp(S, bldr, { op: "give", id: "dock", part: "scrap", n: 999999 });
is([sc0 - bldr.C.parts.scrap, W.projOf("dock").got.scrap, bldr.C.xp.tinkering - xpd], [D.need.scrap, D.need.scrap, Math.round(D.need.scrap * G.TINK.donateXp)], "scrap given at the bench: only what the tier needs, and xp for it");
W.tinkerOp(S, bldr, { op: "give", id: "dock", part: "relic", n: 5 }); is(bldr.C.parts.relic, 99, "tier 1 wants no relic shards: none taken");
const tx0 = G.tixIn(bldr.C); for (const part of ["gears", "sparks", "tickets"]) W.tinkerOp(S, bldr, { op: "give", id: "dock", part, n: 9e9 });
is([tx0 - G.tixIn(bldr.C), W.projView(bldr).dock.ready], [D.need.tickets, true], "the tickets go from the bag; the tier is ready");
W.tinkerOp(S, bldr, { op: "finish", id: "dock" }); is(G.projTier("dock"), 0, "finishing at the bench is refused: it's done on site");
bldr.x = 18; bldr.y = 16; bldr.C.xp.tinkering = G.XP_AT[19];
W.tinkerOp(S, bldr, { op: "finish", id: "dock" }); is(G.projTier("dock"), 0, "Tinkering 19 can't finish a Tinkering 20 job");
bldr.C.xp.tinkering = G.XP_AT[20]; const rock0 = S.objs.find((o) => o.t === "rock"); rock0.left = 1;
W.tinkerOp(S, bldr, { op: "finish", id: "dock" });
is([G.projTier("dock"), !!S.objs.find((o) => o.t === "dock"), S.objs.filter((o) => o.proj === "dock" && o.t === "spot").length, G.walkableIn(S.g, 16, 19), S.objs.find((o) => o.t === "rock").left, !!S.objs.find((o) => o.t === "dockruin")], [1, true, 2, true, 1, false], "finished: the dock is in the pond with two spots, you can walk it, and nothing else in the Yard moved");
is(S.objs.every((o, i) => o.id === i), true, "every object's id is still its place in the list");
is(!!pl.out.find((e) => e.type === "projects" && e.tiers.dock === 1), true, "everybody is told the new tier");
const W2 = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20));
is([W2.projTiers().dock, !!W2.scene("workyard").objs.find((o) => o.t === "dock")], [1, true], "after a restart the dock is still built");

/* 11. THE KING'S CANNON: a wreck until built; Sparks a shot, a minute's cooldown, two volleys at tier 2, only at a boss */
const M = W.scene("mire"), gunner = { id: "g1", name: "g1", login: "g1", C: G.freshChar(), x: 18, y: 13, out: [], path: [] }; gunner.C.scene = "mire"; W.pls.set("g1", gunner);
gunner.C.parts = { scrap: 0, gears: 0, sparks: 100, relic: 0 };
is(!!M.objs.find((o) => o.t === "cannonruin"), true, "the Mire has a rusted cannon");
W.projOf("cannon").tier = 2; G.setProjects(W.projTiers()); W.projRebuild("mire");
const dK = G.MOBS.pumpkinking, king = { id: "kk", t: "pumpkinking", x: 22, y: 14, hx: 22, hy: 14, hp: dK.hp, maxHp: dK.hp, path: [], step: null, face: 1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: 0 };
M.mobs = M.mobs.filter((m) => !G.MOBS[m.t]?.boss);
W.cannonFire(M, gunner); is(gunner.C.parts.sparks, 100, "no boss in range: no shot, no Sparks spent");
M.mobs.push(king); const tNow = Date.now(); W.cannonAt = 0; W.cannonFire(M, gunner, tNow);
is([dK.hp - king.hp, gunner.C.parts.sparks], [G.CANNON.dmg * 2, 100 - G.CANNON.sparks], "tier 2: two volleys at the King, 25 Sparks spent");
W.cannonFire(M, gunner, tNow + 1000); is(gunner.C.parts.sparks, 100 - G.CANNON.sparks, "cooling: the second shot is refused");
W.projOf("cannon").tier = 3; G.setProjects(W.projTiers()); W.projRebuild("mire"); W.cannonFire(M, gunner, tNow + G.CANNON.cdMs + 1);
is(king.stunUntil > tNow + G.CANNON.cdMs, true, "tier 3: the shell stuns him");

/* 11b. THE LONG SHOT: no boss in the Mire, so the cannon hits an open-world boss up elsewhere; support only (no loot share, never the kill) */
M.mobs = M.mobs.filter((m) => m !== king);
const BW = W.scene("boardwalk"), watcher = { id: "w1", name: "w1", login: "w1", C: G.freshChar(), x: 5, y: 5, out: [], path: [] }; watcher.C.scene = "boardwalk"; W.pls.set("w1", watcher);
const dC = G.MOBS.captainclaw, claw = { id: "cc", t: "captainclaw", x: 8, y: 8, hx: 8, hy: 8, hp: 300, maxHp: dC.hp, path: [], step: null, face: 1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: 0 };
BW.mobs.push(claw); W.cannonAt = 0; gunner.C.parts.sparks = 100; W.projOf("cannon").tier = 2; G.setProjects(W.projTiers());
W.cannonFire(M, gunner, tNow + 5 * G.CANNON.cdMs);
is([claw.hp, claw.dead, !!claw.by?.g1, gunner.C.parts.sparks, !!watcher.out.find((e) => e.type === "cannon")], [1, false, false, 75, true], "no boss in the Mire: the shell lands on Captain Claw, stops at 1 health, takes no loot share, and the Boardwalk hears it");
W.cannonAt = 0; W.cannonFire(M, gunner, tNow + 7 * G.CANNON.cdMs); is(gunner.C.parts.sparks, 75, "a boss on 1 health isn't a target: no shot, no Sparks");
BW.mobs = BW.mobs.filter((m) => m !== claw);

/* 11c. /project in chat: anyone can ask; only an admin can set one */
const plain = { id: "u1", name: "u1", login: "u1", C: G.freshChar(), x: 10, y: 10, out: [], path: [], lastInput: 0, msgWindow: 0, msgs: 0 }; plain.C.scene = "workyard"; W.pls.set("u1", plain);
W.onMessage(plain, { t: "chat", text: "/project" }); is(/Fishing Dock \(dock\): tier 1 of 3/.test(JSON.stringify(plain.out)), true, "/project tells anyone where each project stands");
plain.lastChat = 0; W.onMessage(plain, { t: "chat", text: "/project dock 3" }); is(G.projTier("dock"), 1, "a player can't set one");
const boss = { ...plain, id: "a1", name: "a1", login: "a1", admin: true, out: [], lastChat: 0 }; W.pls.set("a1", boss);
W.onMessage(boss, { t: "chat", text: "/project dock 2 fill" }); is([G.projTier("dock"), W.projView(boss).dock.ready], [2, true], "an admin's /project dock 2 fill sets tier 2 with its parts in");

/* 12. THE BOILER: no table until it's built; then a fair game in the band */
const Cz = W.scene("casino"), gam = { id: "b1", name: "b1", login: "b1", C: G.freshChar(), x: 35, y: 18, out: [], path: [] }; gam.C.scene = "casino"; W.pls.set("b1", gam);
G.addInv(gam.C.inv, "tickets", 50000, gam.C);
W.bet(Cz, gam, { g: "boiler", amt: 100, pick: 2 }, Date.now()); is(!!gam.out.find((e) => e.type === "gameResult"), false, "the Boiler isn't built: no bet");
W.projOf("table").tier = 1; G.setProjects(W.projTiers()); W.projRebuild("casino");
W.bet(Cz, gam, { g: "boiler", amt: 100, pick: 2.5 }, Date.now()); const br = gam.out.find((e) => e.type === "gameResult");
is([!!br, br?.target, br ? (br.blow >= 2.5) === (br.payout > 0) : null], [true, 2.5, true], `a Boiler bet: target 2.5x, blew at ${br?.blow}x, paid ${br?.payout}`);
{ let won = 0; const n = 200000; for (let i = 0; i < n; i++) if (G.boilerBlow(Math.random()) >= 4) won++; is(Math.abs(won / n - 0.25) < 0.005, true, `it holds past 4x ${(won / n * 100).toFixed(2)}% of the time (fair: 25%)`); }

/* 13. THE OTHER NINE: one per main map, each built by tier from `site`, each with its own effect */
{ const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); if (!G.SCENES.wild) Object.assign(G.SCENES, createClosedScenes(G, G._MAP)); }
is(Object.keys(G.PROJECTS).length, 12, "twelve World Projects, one on every main map");
is(new Set(Object.values(G.PROJECTS).map((p) => p.scene)).size, 12, "no two on the same map");
const setT = (id, t) => { W.projOf(id).tier = t; G.setProjects(W.projTiers()); W.projRebuild(G.PROJECTS[id].scene); };
for (const [id, P] of Object.entries(G.PROJECTS)) if (P.site) {
  const Sx = W.scene(P.scene); setT(id, 0);
  const r0 = Sx.objs.find((o) => o.proj === id && o.t === "pjruin"); setT(id, 1); const s1 = Sx.objs.find((o) => o.proj === id && o.t === P.t);
  is([!!r0, !!s1, s1?.art], [true, true, `o_pj_${id}1`], `${P.name}: a ruin at tier 0, a working ${P.t} at tier 1`);
}
/* the Sawmill: fletching doubles in the Gloam and nowhere else; logs in pairs at tier 3 */
setT("sawmill", 2); is([G.tkCraft({ scene: "gloam" }, "fletching").dbl, G.tkCraft({ scene: "workyard" }, "fletching").dbl], [0.2, 0], "the Sawmill's bandsaw: 20% double fletching, only in the Gloam");
setT("sawmill", 3); is(G.projGather({ scene: "gloam" }, "tree"), 0.25, "seasoned timber: logs in pairs a quarter of the time");
/* the Bone Crusher: a bench in the Boneyard, more parts, and Relic shards out of the sieve */
setT("crusher", 3); const BY = W.scene("boneyard"), bench2 = BY.objs.find((o) => o.t === "scrapbench");
const dig = { id: "d1", name: "d1", login: "d1", C: G.freshChar(), x: bench2.x, y: bench2.y + 1, out: [], path: [] }; dig.C.scene = "boneyard"; W.pls.set("d1", dig);
G.addInv(dig.C.inv, "bones", 300, dig.C); const plainSalv = G.salvageOf("bones", 300);
W.tinkerOp(BY, dig, { op: "salvage", k: "bones" });
is([dig.C.parts.scrap >= Math.floor(plainSalv.scrap * 1.25) - 1, dig.C.parts.relic >= 1], [true, true], `the Boneyard's bench: 25% more scrap and a Relic shard from 300 bones (${dig.C.parts.scrap} scrap, ${dig.C.parts.relic} relic)`);
/* the Lightning Rod: a Spark a minute on the Thunderhead at tier 3 */
setT("rod", 3); const TH = W.scene("thunderhead"), zap = { id: "z1", name: "z1", login: "z1", C: G.freshChar(), x: 20, y: 12, out: [], path: [] }; zap.C.scene = "thunderhead"; W.pls.set("z1", zap);
W.projTickAt = 0; W.projTick(Date.now()); W.projTick(Date.now() + 1000); is(zap.C.parts?.sparks, 1, "the charged air: one Spark a minute, and not twice in the same minute");
is(!!TH.objs.find((o) => o.proj === "rod" && o.t === "anvil"), true, "the storm forge has its anvil");
/* the Magnet Crane: a full bag's ore goes to the bank at tier 3 */
setT("crane", 3); const TP = W.scene("trailer"), mnr = { id: "m2", name: "m2", login: "m2", C: G.freshChar(), x: 10, y: 10, out: [], path: [] }; mnr.C.scene = "trailer"; W.pls.set("m2", mnr);
const bank0 = (mnr.C.bank.find((b) => b.k === "copper")?.n | 0); is([W.oreConveyor(mnr, "copper"), (mnr.C.bank.find((b) => b.k === "copper")?.n | 0) - bank0], [true, 1], "the conveyor: ore to the bank");
mnr.C.scene = "workyard"; is(W.oreConveyor(mnr, "copper"), false, "and only in the Trailer Park");
/* the Ferris Wheel: one ride a day at tier 1, two at tier 3 */
setT("wheel", 1); const rider = { id: "r1", name: "r1", login: "r1", C: G.freshChar(), x: 5, y: 5, out: [], path: [] }; rider.C.scene = "carnival"; W.pls.set("r1", rider);
W.ferrisRide(rider); const afterOne = { ...rider.C.parts }; W.ferrisRide(rider);
is([afterOne.scrap > 0, rider.C.parts.scrap === afterOne.scrap], [true, true], "the Ferris Wheel: a prize of parts, once a day");
setT("wheel", 3); W.ferrisRide(rider); is(rider.C.parts.scrap > afterOne.scrap, true, "tier 3: the second ride of the day");
/* the Smokehouse and the Forward Camp */
setT("smoke", 3); is(G.tkCraft({ scene: "boardwalk" }, "cooking"), { dbl: 0.2, noburn: true }, "the Smokehouse: no burning, 20% doubles on the Boardwalk");
setT("camp", 3); is([G.tkXp({ scene: "wild" }, "melee"), G.projFx({ scene: "deep" })?.pvpDrop, G.projFx({ scene: "workyard" })], [0.1, 0.5, null], "the Forward Camp: combat xp and the field hospital, in the Wild and the Deep Wild only");

console.log(bad ? `\n${bad} problem(s)` : "\nTinkering works: salvage by the rules and safe, gadgets built, used and broken, and the automation tools carry on while you're away");
process.exitCode = bad ? 1 : 0;
