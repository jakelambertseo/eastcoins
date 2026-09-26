/* DOES THE LONG NIGHT WORK? —  node tools/eastscape-hw-test.mjs
   (2026-09-27) The real World class with storage stubbed and the clock inside the event window: the King is called, spawned
   and killed (drops, the hour reset, the Black Cat roll forced), a ghost lantern pays once a day, trick or treat is once a day,
   the Night Market charges corn and refuses without it, a fit is bought with corn and worn, the Witch's brew waives one death,
   a gather drops corn at its rate, and Nightfall doubles it. Not a test of the drawing. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
import fs from "node:fs";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (got === want) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
G.HW.live = true;   /* the harness runs the event whatever the switch says */
if (!G.hwOn()) { console.log("  (the event is not on today: the clock says " + G.chicagoDay() + "; nothing to test)"); process.exit(0); }

const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => { const p = fn(); if (p && p.then) p.catch(() => {}); return p; },
  storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" });
W.save = async () => {}; W.saveAll = async () => {}; W.pitTick = async () => {};
W.hw = { kingAt: 0, kingDue: false, kingUp: null, night: false };
const said = []; W.houseSay = (t) => said.push(String(t));
const mk = (id, scene, x, y) => { const C = G.freshChar(); C.scene = scene; C.x = x; C.y = y; for (const sk of ["attack", "strength", "defence", "hp"]) C.xp[sk] = G.XP_AT[70];
  const A = { id, login: id, name: id, admin: false, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, face: 1, dir: "south", act: null, lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: true, needSave: false, out: [], god: false, msgs: 0, msgWindow: 0, joinedAt: Date.now(), lastInput: Date.now(), fightAt: Date.now() };
  W.pls.set(id, A); return A; };
const corn = (A) => G.countItems(A.C, ["candycorn"]);
const now = Date.now();

/* ---------------------------------------------------------------- the King */
const A = mk("p1", "mire", 22, 16);
const M = W.scene("mire");
W.hwTick(now); is(W.hw.kingAt > now, true, "a fresh event books the first King ahead");
W.hw.kingAt = now - 1; W.hwTick(now);
is(W.hw.kingDue, false, "with somebody in the Mire he is placed at once, not left due");
const king = M.mobs.find((m) => m.t === "pumpkinking"); is(!!king, true, "the King stands in the Mire");
is(king && king.hp, G.MOBS.pumpkinking.hp, "at full hitpoints"); is(!!W.hw.kingUp, true, "and the clock knows he is up");
is(said.some((t) => /RISES/.test(t)), true, "chat was told");
/* kill him: the pet roll forced so the Black Cat path runs */
const rnd = Math.random; Math.random = () => 0.0001;
king.hp = 0; W.killMob(M, A, king, now);
Math.random = rnd;
is(corn(A) >= G.MOBS.pumpkinking.drops[1][1][0], true, "he dropped candy corn"); is(G.countItems(A.C, ["ectoplasm"]) >= 2, true, "and ectoplasm");
is(A.C.pets.some((p) => p.k === "blackcat"), true, "the Black Cat came out of his shadow (roll forced)");
is(W.hw.kingUp, null, "the clock cleared him"); is(W.hw.kingAt > now + G.HW.king.every - 5000, true, "and booked the next hour");
is(said.some((t) => /put the Pumpkin King down/.test(t)), true, "chat was told who did it");
/* a second cat never comes */
W.hw.kingAt = now - 1; W.hw.kingDue = false; W.hwTick(now); const k2 = M.mobs.find((m) => m.t === "pumpkinking" && !m.dead);
Math.random = () => 0.0001; k2.hp = 0; W.killMob(M, A, k2, now); Math.random = rnd;
is(A.C.pets.filter((p) => p.k === "blackcat").length, 1, "the same person never gets a second cat");
/* he leaves on his own when nobody kills him */
W.hw.kingAt = now - 1; W.hw.kingDue = false; W.hwTick(now); const k3 = M.mobs.find((m) => m.t === "pumpkinking" && !m.dead);
W.hwTick(now + G.HW.king.stays + 1000); is(M.mobs.includes(k3), false, "unkilled, he sinks back after his twenty minutes");

/* ---------------------------------------------------------------- lanterns, trick or treat */
const L = M.objs.find((o) => o.t === "ghostlantern"); is(!!L, true, "the Mire has a ghost lantern today");
const c0 = corn(A); W.hwLantern(M, A, L); is(corn(A) - c0, G.HW.lanternCorn, "a lantern pays its corn");
W.hwLantern(M, A, L); is(corn(A) - c0, G.HW.lanternCorn, "and not twice in a day");
const mudge = M.npcs.find((n) => /Mudge/.test(n.name)); A.x = mudge.x + 1; A.y = mudge.y;
const c1 = corn(A), t1 = G.countItems(A.C, ["tickets"]);
Math.random = () => 0.99; W.hwOp(M, A, { op: "trick", npc: mudge.id }); Math.random = rnd;   /* 0.99 > trickAt: a treat, and past pie and seeds: corn */
is(corn(A) > c1, true, "trick or treat paid corn on a treat roll");
const c2 = corn(A); W.hwOp(M, A, { op: "trick", npc: mudge.id }); is(corn(A), c2, "and refuses a second ask the same day");
is(G.countItems(A.C, ["tickets"]), t1, "tickets were never touched");

/* ---------------------------------------------------------------- (2026-09-27) the month's prices, the cat, the name cosmetics, the board, the days */
{
  const B = mk("p9", "workyard", 19, 12); const Y0 = W.scene("workyard"); const hexa = Y0.npcs.find((n) => n.opens === "market");
  is(!!hexa && hexa.x < 22, true, "Hexa stands west of the Yard's north road");
  is(Y0.objs.some((o) => o.t === "nightmarket" && o.x + o.w <= 22), true, "and the tent is off it too");
  is(G.HW.market.every(([, , c]) => c >= 25), true, "nothing on the shelf is cheap any more");
  is(Object.values(G.VANITY).filter((v) => v.corn).every((v) => v.corn >= 2000), true, "a fit is a fortnight's corn");
  const helm = G.HW.market.findIndex(([k]) => k === "hallowed_helm");
  W.hwOp(Y0, B, { op: "buy", i: helm, n: 1 }); is(G.countItems(B.C, ["hallowed_helm"]), 0, "the Hallowed helm is refused without the corn");
  G.addInv(B.C.inv, "candycorn", 20000, B.C);
  W.hwOp(Y0, B, { op: "buy", i: helm, n: 1 }); is(G.countItems(B.C, ["hallowed_helm"]), 1, "and sold with it"); is(corn(B), 20000 - G.HW.market[helm][2], "at its price");
  W.hwOp(Y0, B, { op: "pet" }); is(B.C.pets.some((p) => p.k === "blackcat"), true, "the Black Cat comes off the shelf"); is(B.C.eq.pet, B.C.pets[0].id, "and is worn");
  const c9 = corn(B); W.hwOp(Y0, B, { op: "pet" }); is(corn(B), c9, "a second cat is refused");
  W.hwOp(Y0, B, { op: "cos", id: "col_pumpkin" }); is(B.C.store?.own?.includes("col_pumpkin"), true, "the Pumpkin name is bought with corn"); is(B.C.store?.name?.col, "col_pumpkin", "and worn");
  is(G.nameFxOf(B.C)?.col, "pumpkin", "the roster would carry it"); is(!!G.NAME_COLS.pumpkin, true, "and the page has its colour");
  const t9 = G.tixIn(B.C), o9 = B.C.store.own.length; W.storeOp(Y0, B, { op: "buy", id: "frame_ember" }); is(G.tixIn(B.C) === t9 && B.C.store.own.length === o9 && !B.C.store.own.includes("frame_ember"), true, "the Store refuses a corn item for tickets");
  const c10 = corn(B); W.hwOp(Y0, B, { op: "cos", id: "col_pumpkin" }); is(corn(B), c10, "and not twice");
  is(B.C.stats.corn | 0, 0, "bought corn is not earned corn");
  const c11 = corn(B); const L2 = W.scene("mire").objs.find((o) => o.t === "ghostlantern"); if (L2) { W.hwLantern(W.scene("mire"), B, L2); }
  if (L2) is(B.C.stats.corn, corn(B) - c11, "a lantern's corn is counted for the board");
  is(/HISCORES\.push\(\["corn"/.test(fs.readFileSync(new URL("../v3/assets/js/eastscape-shared.js", import.meta.url), "utf8")), true, "the Candy corn board is pushed when HW.live is true (decided at load, so it is checked in the source)");
  is(G.hwDaysLeft() >= 1 && G.hwDaysLeft() <= 40, true, `days left reads ${G.hwDaysLeft()}`);
  is(G.hwDaysLeft(Date.parse(G.HW.until + "T18:00:00Z")), 1, "the last day reads 1");
  is(G.hwDaysLeft(Date.parse(G.HW.gone + "T18:00:00Z")), 0, "and the morning after reads 0");
}

/* ---------------------------------------------------------------- (2026-09-27) the pieces: nine wearables, their effects, their sources; the Golden tomatoe */
{
  const nine = ["gallows_bow", "lantern_quiver", "skull_wand", "bag_shroud", "drowned_boots", "coffin_ring", "reaper_scythe", "king_crown", "ferry_coin"];
  is(nine.every((k) => G.ITEMS[k]?.slot && G.ITEMS[k].event && G.ITEMS[k].tier === "hallowed"), true, "nine wearable event pieces, all hallowed-tier (the glow and the tag)");
  is(nine.slice(0, 6).every((k) => G.ITEMS[k].req.lvl === 50) && nine.slice(6).every((k) => G.ITEMS[k].req.lvl === 90), true, "six at level 50, three at level 90");
  is(nine.every((k) => G.forgeCost(k)?.[0] === "candycorn"), true, "every piece reforges with candy corn");
  is(nine.every((k) => G.gearSell(k) === 0), true, "Bom buys none of them");
  is(["reaper_scythe", "king_crown", "ferry_coin"].every((k) => G.HW.legend.items.includes(k)) && G.HW.legend.lvl === 80, true, "the legendaries fall off level 80+ monsters");
  is(G.MOBS.pumpkinking.drops.filter(([k]) => nine.includes(k)).length, 6, "the King drops the quiver, the wand, the satchel and the three legendaries");
  is(G.HW.market.filter(([k]) => nine.includes(k)).map(([, , c]) => c).every((c) => c === 9000) && G.HW.market.filter(([k]) => nine.includes(k)).length === 3, true, "and Hexa sells those three at 9,000");
  is(G.HW.market.some(([k]) => ["gallows_bow", "coffin_ring", "drowned_boots"].includes(k)), false, "the skilling drops are not on the shelf");
  is(/spend no arrow/.test(G.fxText(G.ITEMS.lantern_quiver.fx)) && /comes back as health/.test(G.fxText(G.ITEMS.skull_wand.fx)) && /comes up double/.test(G.fxText(G.ITEMS.coffin_ring.fx)) && /dies to your next hit/.test(G.fxText(G.ITEMS.reaper_scythe.fx)) && /attacks you first/.test(G.fxText(G.ITEMS.king_crown.fx)) && /never bills/.test(G.fxText(G.ITEMS.ferry_coin.fx)), true, "every effect has words for the buffs bar");
  /* the ammo save */
  const Q = mk("p20", "gloam", 10, 10); Q.C.eq.shield = "lantern_quiver"; Q.C.eq.weapon = "yewlogs_longbow"; Q.C.quiver = { k: "bone_arrow", n: 10 };
  Math.random = () => 0.01; W.spendAmmo(Q); is(Q.C.quiver.n, 10, "a quarter of shots spend no arrow"); Math.random = () => 0.99; W.spendAmmo(Q); is(Q.C.quiver.n, 9, "the rest do"); Math.random = rnd;
  /* the ring: double, and the skilling drops */
  const R = mk("p21", "gloam", 10, 10); R.C.eq.ring = "coffin_ring"; const Gs = W.scene("gloam");
  G.addInv(R.C.inv, "copper", 1, R.C); Math.random = () => 0.05; W.gained(Gs, R, "copper", 1, "gather", "mining"); Math.random = rnd; is(G.countItems(R.C, ["copper"]), 2, "one swing in ten comes up double with the Coffin Ring");
  const T = mk("p22", "gloam", 10, 10);
  Math.random = () => 0.00005; W.gained(Gs, T, "logs", 1, "gather", "woodcutting"); W.gained(Gs, T, "copper", 1, "gather", "mining"); W.gained(Gs, T, "sardine", 1, "gather", "fishing"); Math.random = rnd;
  is(G.countItems(T.C, ["gallows_bow"]) === 1 && G.countItems(T.C, ["coffin_ring"]) === 1 && G.countItems(T.C, ["drowned_boots"]) === 1, true, "one in ten thousand: a chop, a swing and a cast each hand over their piece");
  const T2 = mk("p23", "gloam", 10, 10); Math.random = () => 0.5; W.gained(Gs, T2, "logs", 1, "gather", "woodcutting"); Math.random = rnd; is(G.countItems(T2.C, ["gallows_bow"]), 0, "and not otherwise");
  is(G.HW.skillDropChance, 0.0001, "the rate is 0.01%");
  /* the coin: no bill */
  const F = mk("p24", "gloam", 10, 10); F.C.eq.amulet = "ferry_coin"; G.addInv(F.C.inv, "tickets", 5000, F.C); const tf = G.countItems(F.C, ["tickets"]);
  W.die(F, Gs, { mob: "a test" }); is(G.countItems(F.C, ["tickets"]) >= tf, true, "the Ferryman's Coin: no hospital bill");
  /* (2026-09-27) Bom pays one ticket for any event item, never sweeps one, and the satchel holds twice a level-50 bag */
  is(Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].event && k !== "candycorn").every((k) => G.quickSell(k) === 1 && !G.isLoot(k)), true, "every event item sells to Bom for 1 ticket and is never swept by trade-in-the-lot");
  is(G.quickSell("candycorn"), 0, "candy corn itself is not sold for tickets");
  is(G.ITEMS.bag_shroud.pouch.cap, 1000, "the Shroud Satchel holds 1,000 pages");
  { const S2 = mk("p25", "casino", 20, 12); const Cz = W.scene("casino"); W.atCounter = () => true; G.addInv(S2.C.inv, "reaper_scythe", 1, S2.C); G.addInv(S2.C.inv, "pumpkinpie", 3, S2.C); const t0 = G.tixIn(S2.C);
    W.cashOut(Cz, S2, { op: "all" }); is(G.countItems(S2.C, ["reaper_scythe"]) + G.countItems(S2.C, ["pumpkinpie"]), 4, "trade-in-the-lot leaves event items alone");
    W.cashOut(Cz, S2, { op: "one", k: "reaper_scythe" }); is(G.tixIn(S2.C) - t0, 1, "the Reaper's Scythe sells to Bom for exactly 1 ticket"); }
  /* the Golden tomatoe */
  is(G.MOBS.rotten.drops.some(([k, , p]) => k === "goldtomatoe" && p === 0.002), true, "a Rotten Tomato drops the Golden tomatoe one in 500");
  is(G.GOLD_TOMATO_HARVEST, 0.001, "and any harvest one in 1,000");
  is(!!G.CROPS.goldtomatoe && G.CROPS.goldtomatoe.lvl === 50, true, "it plants at Harvesting 50 and grows more of itself");
}

/* ---------------------------------------------------------------- (2026-09-27) the King is an open boss: anyone can hit him, everyone who hurt him is paid */
{
  const Mk = W.scene("mire"); W.hw = { kingAt: 0, kingDue: false, kingUp: null, night: false, opened: true };
  const a1 = mk("o1", "mire", 22, 15), a2 = mk("o2", "mire", 23, 15), a3 = mk("o3", "mire", 21, 15);
  W.hwSpawnKing(Mk, Date.now()); const K = Mk.mobs.find((m) => m.t === "pumpkinking");
  K.claim = { id: a1.id, until: Date.now() + 60000 };
  is(W.mayFight(Mk, K, a2, Date.now()), true, "a second player may hit the King while the first is on him");
  K.by = { o1: 300, o2: 200, o3: 5 };
  a1.C.qs.hw_king = { state: "active", stage: 0, n: 0 }; a2.C.qs.hw_king = { state: "active", stage: 0, n: 0 };
  const c2 = corn(a2), c3 = corn(a3); K.hp = 0; W.killMob(Mk, a1, K, Date.now());
  is(corn(a2) > c2, true, "a helper who did real damage gets his own drops");
  is(corn(a3), c3, "a player who only tagged him (under 5%) gets nothing");
  is(["ready", "done"].includes(a2.C.qs.hw_king?.state), true, "and the helper's King quest is credited");
  is(Mk.mobs.some((m) => m.t === "pumpkinking"), false, "and he is gone until the hour");
}

/* ---------------------------------------------------------------- the market and a fit */
const B = mk("p2", "workyard", 19, 12);   /* (2026-09-27) Hexa moved west of the road */
const Y = W.scene("workyard"); is(Y.npcs.some((n) => n.opens === "market"), true, "Hexa stands in the Yard while the event is on");
W.hwOp(Y, B, { op: "buy", i: 0, n: 1 }); is(G.countItems(B.C, ["seed_pumpkin"]), 0, "the market refuses with no corn");
G.addInv(B.C.inv, "candycorn", 5000, B.C);   /* (2026-09-27) was 300: a fit is 2,400 now */
W.hwOp(Y, B, { op: "buy", i: 0, n: 1 }); is(G.countItems(B.C, ["seed_pumpkin"]), G.HW.market[0][1], "and sells with it"); is(corn(B), 5000 - G.HW.market[0][2], "for the listed corn");
W.hwOp(Y, B, { op: "fit", k: "skeleton_head" }); is(B.C.van.on.head, "skeleton_head", "a fit is bought with corn and worn"); is(corn(B), 5000 - G.HW.market[0][2] - G.VANITY.skeleton_head.corn, "for its price");
W.hwOp(Y, B, { op: "fit", k: "skeleton_head" }); is(corn(B), 5000 - G.HW.market[0][2] - G.VANITY.skeleton_head.corn, "and never twice");

/* ---------------------------------------------------------------- the brew */
G.addInv(B.C.inv, "pot_witch", 1, B.C); const i = B.C.inv.findIndex((s) => s.k === "pot_witch");
W.useSpecial(B, i, B.C.inv[i], G.ITEMS.pot_witch); is(!!B.C.ward, true, "the brew wards");
G.addInv(B.C.inv, "tickets", 5000, B.C); B.C.scene = "mire"; B.x = 10; B.y = 10; const tb = G.countItems(B.C, ["tickets"]);
W.die(B, M, { mob: "a test" }); is(G.countItems(B.C, ["tickets"]) >= tb, true, "a warded death costs no bill (an achievement may pay on top)"); is(!!B.C.ward, false, "and the ward is spent");

/* ---------------------------------------------------------------- corn on a gather, doubled at Nightfall */
const D = mk("p3", "gloam", 10, 10); const Gm = W.scene("gloam");
Math.random = () => 0.01; W.gained(Gm, D, "logs", 1, "gather"); Math.random = rnd;
is(corn(D) >= G.HW.corn.n[0] && corn(D) <= G.HW.corn.n[1], true, "a gather drops corn at the rate");
const nightT = (() => { const t = new Date(); for (let h = 0; h < 48; h++) { const tt = t.getTime() + h * 3600000; if (G.nightfallOn(tt)) return tt; } return null; })();
is(!!nightT, true, "there is a Nightfall in the next two days");
if (nightT) { const wasNow = Date.now; Date.now = () => nightT; W.hwTick(nightT); is(W.hw.night, true, "the tick calls Nightfall"); is(said.some((t) => /NIGHTFALL/.test(t)), true, "in chat"); Math.random = () => 0.01; const c3 = corn(D); W.gained(Gm, D, "logs", 1, "gather"); Math.random = rnd; is((corn(D) - c3) % 2, 0, "and corn comes doubled"); Date.now = wasNow; }

console.log(bad ? `\n${bad} problem(s)` : "\nthe Long Night runs: the King rises and falls, the lanterns, the market, the fits, the brew, the corn");
process.exitCode = bad ? 1 : 0;
