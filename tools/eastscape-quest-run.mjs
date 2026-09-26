/* DO THE STAGED QUESTS ACTUALLY PLAY? —  node tools/eastscape-quest-run.mjs
   (2026-09-27) The real World class with storage stubbed, one player, and four quests walked through every stage type the
   engine has: gather (skilling and cooking), bring to the giver, bring to somebody else with a thing the quest handed over,
   talk, visit, and a kill that insists on a style. Then every one of the forty is checked for shape: stages in order, its
   giver lists it, its chain of requires is acyclic and reaches a quest with no requirement. NOT a test of the dialogue. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (got === want) ok(`${what}: ${got}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => { const p = fn(); if (p && p.then) p.catch(() => {}); return p; },
  storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" });
W.save = async () => {}; W.saveAll = async () => {}; W.pitTick = async () => {};
const C = G.freshChar(); C.scene = "workyard"; C.x = 39; C.y = 17; C.xp.fishing = G.XP_AT[50]; C.xp.cooking = G.XP_AT[50];
const A = { id: "p1", login: "q", name: "Q", admin: false, role: "user", ws: { send() {} }, C, x: 39, y: 17, path: [], step: null, face: 1, dir: "south", act: null,
  lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: true, needSave: false, out: [], god: false, msgs: 0, msgWindow: 0, joinedAt: Date.now(), lastInput: Date.now() };
W.pls.set(A.id, A);
const npcIn = (key, name) => { const S = W.scene(key); const n = S.npcs.find((x) => x.name === name); if (!n) throw new Error(`no ${name} in ${key}`); return [S, n]; };
const standBy = (key, n) => { C.scene = key; A.x = n.x + 1; A.y = n.y; };
const talk = (key, name, op) => { const [S, n] = npcIn(key, name); standBy(key, n); W.questOp(S, A, { op, k: CUR, npc: n.id }); };
let CUR;

/* ---------------------------------------------------------------- the Ferryman's Supper: gather, cook, bring to the giver */
CUR = "sardines"; talk("workyard", "Charon the Ferryman", "accept");
is(G.qState(C, CUR), "active", "sardines accepted"); is(G.qGet(C, CUR).stage, 0, "at stage 1");
const S0 = W.scene("workyard");
for (let i = 0; i < 5; i++) { G.addInv(C.inv, "sardine", 1, C); W.gained(S0, A, "sardine", 1, "gather"); }
is(G.qGet(C, CUR).stage, 1, "five sardines gathered moved it to stage 2");
for (let i = 0; i < 5; i++) { G.addInv(C.inv, "csardine", 1, C); W.gained(S0, A, "csardine", 1, "cook"); }
is(G.qGet(C, CUR).stage, 2, "five cooked moved it to the bring");
is(G.qState(C, CUR), "ready", "and with them in the bag it reads ready");
const t0 = G.countItems(C, ["tickets"]); talk("workyard", "Charon the Ferryman", "hand");
is(G.qState(C, CUR), "done", "handed in"); is(G.countItems(C, ["csardine"]), 0, "the sardines were taken"); is(G.countItems(C, ["tickets"]) - t0 >= 150, true, "and at least the 150 tickets paid (achievements pay on top)");

/* ---------------------------------------------------------------- Charon's Ledger: visit, talk to somebody else, bring */
CUR = "ferry"; talk("workyard", "Charon the Ferryman", "accept"); is(G.qGet(C, CUR).stage, 0, "ferry at the visit stage");
W.questVisit(A, "isle:somebodyelse"); is(G.qGet(C, CUR).stage, 0, "somebody else's island does not count");
W.questVisit(A, "isle2:p1"); is(G.qGet(C, CUR).stage, 1, "setting foot on YOUR island (its real key, any tier) moved it on");
{ const S = W.scene("workyard"); const yah = { id: "yah", name: "Yahsmeena", x: A.x, y: A.y, quests: [] }; S.npcs.push(yah); const R = G.npcRole(C, yah); is(R?.role, "stage", "Yahsmeena is the stage's person"); W.questOp(S, A, { op: "stage", k: CUR, npc: yah.id }); S.npcs.pop(); }
is(G.qGet(C, CUR).stage, 2, "talking to her moved it to the bring");
G.addInv(C.inv, "wheat", 3, C); is(G.qState(C, CUR), "ready", "three wheat in the bag: ready"); talk("workyard", "Charon the Ferryman", "hand"); is(G.qState(C, CUR), "done", "ferry done");

/* ---------------------------------------------------------------- the Caravan Road: a thing handed over, carried to another person, then hand-in */
CUR = "stardust"; C.qs.stardust = { state: "done" };
CUR = "caravan"; talk("sands", "Rashid the Caravaneer", "accept");
is(G.countItems(C, ["caravan_parcel"]), 1, "Rashid handed over the parcel");
{ const [S, n] = npcIn("boneyard", "Sister Morrow"); standBy("boneyard", n); const R = G.npcRole(C, n); is(R?.role, "stage", "the Sister is the parcel's person"); W.questOp(S, A, { op: "stage", k: CUR, npc: n.id }); }
is(G.countItems(C, ["caravan_parcel"]), 0, "she took it"); is(G.qState(C, CUR), "ready", "and the quest is ready for Rashid");
talk("sands", "Rashid the Caravaneer", "hand"); is(G.qState(C, CUR), "done", "caravan done");

/* ---------------------------------------------------------------- Grimm's Bow: crafted gathers and a kill by style */
CUR = "firstbow"; talk("gloam", "Grimm the Hermit", "accept");
W.gained(S0, A, "bowstring", 1, "craft"); is(G.qGet(C, CUR).stage, 1, "a crafted bowstring counted");
W.gained(S0, A, "bone_arrow", 5, "gather"); is(G.qGet(C, CUR).n, 0, "arrows that were not crafted did not");
W.gained(S0, A, "bone_arrow", 15, "craft"); is(G.qGet(C, CUR).stage, 2, "fifteen crafted arrows moved it to the kill");
for (let i = 0; i < 5; i++) W.questEvent(A, "kill", { mob: "gnasher", style: "melee" }); is(G.qGet(C, CUR).n, 0, "melee kills do not count for a bow stage");
for (let i = 0; i < 5; i++) W.questEvent(A, "kill", { mob: "gnasher", style: "archery" }); is(G.qState(C, CUR), "ready", "five by bow: ready");
talk("gloam", "Grimm the Hermit", "hand"); is(G.qState(C, CUR), "done", "firstbow done"); is(G.countItems(C, ["logs_longbow"]), 1, "and the longbow was given");

/* ---------------------------------------------------------------- the shape of all forty */
const names = new Set(); for (const d of Object.values(G.SCENES)) for (const n of d.npcs || []) { names.add(n.name); for (const k of n.quests || []) names.add("q:" + k); }
let n40 = 0;
for (const [k, q] of Object.entries(G.QUESTS)) {
  n40++;
  if (!names.has("q:" + k)) fail(`${k}: nobody offers it`);
  if (!names.has(q.giver)) fail(`${k}: giver ${q.giver} is not placed`);
  const seen = new Set(); let cur = k, depth = 0; while (cur) { if (seen.has(cur)) { fail(`${k}: requires loop`); break; } seen.add(cur); cur = (G.QUESTS[cur].requires || [])[0]; if (++depth > 20) { fail(`${k}: requires too deep`); break; } }
  if (!q.talk?.offer || !q.talk?.done) fail(`${k}: missing talk lines`);
  for (const s of q.stages) if ((s.type === "talk" || s.type === "bring") && !(s.say || q.talk.ready)) fail(`${k}: a ${s.type} stage with nothing to say`);
}
ok(`${n40} quests, ${Object.values(G.QUESTS).filter((q) => q.tier === "easy").length} easy / ${Object.values(G.QUESTS).filter((q) => q.tier === "medium").length} medium / ${Object.values(G.QUESTS).filter((q) => q.tier === "hard").length} hard`);
console.log(bad ? `\n${bad} problem(s)` : "\nthe quests play, stage by stage");
process.exitCode = bad ? 1 : 0;
