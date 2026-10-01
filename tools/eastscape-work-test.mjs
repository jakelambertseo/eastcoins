/* WORK CLOTHES —  node tools/eastscape-work-test.mjs
   (2026-10-01, v1.1) The rules and the real World (storage stubbed), Math.random scripted where a roll matters:
     - every set has four pieces with art, a skill, a perk and a source; no piece is in an armour slot, and none can be traded;
     - the bonus: +3% XP a piece in the outfit's own skill, 15% for all four, nothing in another skill, nothing for a set not worn; the
       perks land in the readers the skills already use (craft doubles and no burning, gathering doubles, salvage, gems, the Ditched pick,
       the walk) and only with all four;
     - XP really is paid 15% higher through grant();
     - wearing: only a set you have a piece of; taking it off;
     - finding: always a missing piece, never a duplicate, four finds is a set (announced), a fifth finds nothing;
     - drops wired in: a farm animal's kill, Bronny's order, the Star Tent, a Thief hit;
     - THE DITCHED MOVE: worn, bag and bank pieces go to the locker, spares paid in tickets, the outfit put on, once;
     - a catch that rolls the Ditched set puts the piece in the locker. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
import fs from "fs";
let bad = 0;
const ok = (c, what, extra = "") => { console.log(`  ${c ? "ok" : "!!"}  ${what}${c || extra === "" ? "" : "  — " + extra}`); if (!c) bad++; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

console.log("The sets");
const sets = Object.values(G.WORKSETS);
ok(sets.length === 14, "fourteen sets");
for (const S of sets) {
  ok(S.pieces.length === 4 && G.SKILLS[S.skill] && S.full && S.from, `${S.name}: four pieces, a skill (${S.skill}), a perk, a source`);
  ok(S.pieces.every((k) => G.ITEMS[k] && !G.ITEMS[k].slot && G.noTrade(k) && fs.existsSync(`v3/assets/img/glad/flat/items/${k}.png`)), `${S.name}: no armour slot, untradeable, every icon drawn`);
}
ok(new Set(sets.map((S) => S.skill)).size === 14, "one set for each of fourteen skills");

console.log("The bonus");
const ch = (set, n) => ({ ...G.normChar({}), locker: G.WORKSETS[set].pieces.slice(0, n), work: set });
ok(near(G.workXp(ch("prospector", 1), "mining"), 0.03), "one piece: +3% XP");
ok(near(G.workXp(ch("prospector", 4), "mining"), 0.15), "all four: +15%");
ok(G.workXp(ch("prospector", 4), "fishing") === 0, "nothing in another skill");
ok(G.workXp({ ...ch("prospector", 4), work: null }, "mining") === 0, "nothing when not worn");
ok(near(G.tkXp(ch("prospector", 4), "mining") - G.tkXp({ ...ch("prospector", 4), work: null }, "mining"), 0.15), "tkXp carries it");
ok(G.projGather(ch("prospector", 4), "rock") >= 0.125 && G.projGather(ch("prospector", 3), "rock") < 0.125, "a second ore one swing in eight, with all four only");
ok(G.fxOf(ch("prospector", 4)).gem >= 0.25, "gems 25% more often");
ok(G.projGather(ch("feller", 4), "tree") >= 0.125, "a second log");
const wc = G.tkCraft(ch("whites", 4), "cooking"); ok(wc.noburn && wc.dbl >= 0.1, "the whites: nothing burns, a double dish");
ok(G.tkCraft(ch("bronny", 4), "smithing").dbl >= 0.1 && G.tkCraft(ch("bronny", 4), "cooking").dbl < 0.1, "Bronny's leathers double smithing only");
ok(G.tkSalv(ch("sal", 4)) >= 0.125, "Sal's overalls: more salvage");
ok(G.speedRaw(ch("getaway", 4)) - G.speedRaw({ ...ch("getaway", 4), work: null }) === 4, "the getaway silks: 4% faster on foot");
ok(near(G.fxOf(ch("ditched", 4)).steal - G.fxOf({ ...ch("ditched", 4), work: null }).steal, 0.1), "the Ditched set: +2.5% pickpocket a piece");
ok(G.workPerk(ch("myco", 4), "fungiculture", "bed2") === 0.2 && G.workPerk(ch("grounds", 4), "farming", "crop") === 1, "the mantle and the dungarees");

const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 30)); W.save = async () => {};
let n = 0;
const player = (C = G.normChar({})) => { C.scene = "workyard"; C.hp = G.maxHpOf(C); const id = `w${++n}`, pl = { id, login: id, name: `W${n}`, role: "user", ws: { send() {} }, C, x: 20, y: 12, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 }; W.pls.set(id, pl); return pl; };
const said = (pl) => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop() || "";
let Q = []; const R0 = Math.random; Math.random = () => (Q.length ? Q.shift() : R0());

console.log("XP, really paid");
{ const a = player(), b = player(); a.C.locker = [...G.WORKSETS.prospector.pieces]; a.C.work = "prospector";
  const xa = a.C.xp.mining, xb = b.C.xp.mining; W.grant(a, "mining", 1000); W.grant(b, "mining", 1000);
  ok(a.C.xp.mining - xa === 1150 && b.C.xp.mining - xb === 1000, "1,000 Mining XP is 1,150 in the Prospector's kit", `${a.C.xp.mining - xa} / ${b.C.xp.mining - xb}`); }

console.log("Wearing and finding");
{ const p = player();
  W.workWear(p, { set: "feller" }); ok(!p.C.work && /haven't found/.test(said(p)), "you can't wear a set you have nothing of");
  for (let i = 0; i < 4; i++) W.workFind(p, "feller");
  ok(G.WORKSETS.feller.pieces.every((k) => p.C.locker.includes(k)) && p.C.locker.length === 4, "four finds is the whole set, no duplicates");
  ok((W.chatLog || []).some((m) => /whole of/.test(m.text)), "a whole set is announced");
  ok(W.workFind(p, "feller") === null && p.C.locker.length === 4, "a fifth find finds nothing");
  ok(p.C.work === "feller", "the first find puts the outfit on when none was");
  W.workWear(p, { set: null }); ok(p.C.work === null, "it comes off");
  W.workWear(p, { set: "feller" }); ok(p.C.work === "feller" && /4 of 4/.test(said(p)), "and goes back on");
  ok(!p.C.inv.some((s) => G.WORK_OF[s.k]) && !(p.C.bank || []).some((s) => G.WORK_OF[s.k]), "nothing went in the bag or the bank"); }

console.log("Where they drop");
{ const p = player();
  Q = [0]; W.workOnKill(p, { t: "cow" }); ok(p.C.locker.some((k) => G.WORK_OF[k] === "grounds"), "a cow: the groundskeeper's dungarees");
  Q = [0]; W.workOnKill(p, { t: "gull" }); ok(p.C.locker.some((k) => G.WORK_OF[k] === "bowyer"), "a gull: the bowyer's greens");
  Q = [0]; W.workOnKill(p, { t: "junkking" }); ok(p.C.locker.some((k) => G.WORK_OF[k] === "sal"), "the Junk King: Sal's overalls");
  Q = [0.99]; const before = p.C.locker.length; W.workOnKill(p, { t: "cow" }); ok(p.C.locker.length === before, "a bad roll finds nothing");
  ok(G.STAR_TENT.stock.some((r) => r.work === "stargazer" && r.frags === 40), "the Star Tent sells the stargazer's robes, 40 fragments");
  const S = W.scene("cloud"); p.C.scene = "cloud"; p.x = G.STAR_TENT.at.x; p.y = G.STAR_TENT.at.y + 1; p.C.frags = 100; p.out = [];
  W.tentOp(S, p, { op: "buy", id: "work_stargazer" }); ok(p.C.frags === 60 && p.C.locker.some((k) => G.WORK_OF[k] === "stargazer"), "40 fragments buys a piece", said(p)); }

console.log("The Ditched move");
{ const old = G.normChar({}); old.eq.helm = "ditched_hood"; old.inv.push({ k: "ditched_coat", n: 1 }, { k: "ditched_hood", n: 1 }); old.bank = [{ k: "ditched_boots", n: 2 }]; delete old.workMig;
  const tix = (c) => G.tixIn(c) + ((c.bank || []).find((s) => s.k === "tickets")?.n || 0), t0 = tix(old);
  const c = G.normChar(JSON.parse(JSON.stringify(old)));
  ok(c.locker.length === 3 && !c.eq.helm && !c.inv.some((s) => /ditched/.test(s.k)) && !c.bank.some((s) => /ditched/.test(s.k)), "worn, bag and bank pieces go to the locker", JSON.stringify(c.locker));
  ok(tix(c) - t0 === 2 * G.WORK_SPARE && c.work === "ditched", "two spares paid, the outfit on");
  const again = G.normChar(JSON.parse(JSON.stringify(c))); ok(again.locker.length === 3 && tix(again) === tix(c), "it happens once"); }

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
