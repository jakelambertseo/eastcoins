/* AREA DIARIES —  node tools/eastscape-diary-test.mjs
   (2026-10-01, v1.1) The rules, the data and the real World (storage stubbed):
     - the data: 21 maps, 252 tasks, 84 perks, every id unique, every perk a kind the game reads, the art drawn, the cape bound;
     - THE LAUNCH (the owner: "make sure that when diaries launch live, users arent spammed"): an old character's first login ticks off
       everything they had done, finishes the tiers they had finished, gives those perks — and says ONE line, with no toast and nothing to
       the room. A second login says nothing at all;
     - live: a task done is a toast and no chat line; a tier is one line; an Elite is the room's;
     - only the counters a task reads are kept;
     - the lamp: flat XP, a skill at the map's level, once a tier;
     - the teleport: once a day, never from the Wilds;
     - perks reach the game: gathering, the gem sorter's price, Bom's counter, a monster's hit, the Wilderness's bill;
     - the cape: every Elite gives it once; it is bound, can't be traded, and never drops on a death in the Wilds;
     - normChar keeps the diary across a save. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { DIARIES } = await import("../v3/assets/js/eastscape-diary-rules.js");
const { World } = await import("../eastscape-worker/src/index.js");
import fs from "fs";
let bad = 0;
const ok = (c, what, extra = "") => { console.log(`  ${c ? "ok" : "!!"}  ${what}${c || extra === "" ? "" : "  — " + extra}`); if (!c) bad++; };

console.log("The data");
const tasks = DIARIES.flatMap((d) => d.t.flat());
ok(DIARIES.length === 21 && tasks.length === 252, "21 maps, 252 tasks", `${DIARIES.length} / ${tasks.length}`);
ok(new Set(tasks.map((x) => x.id)).size === 252, "every task id unique");
ok(DIARIES.every((d) => d.perks.length === 4 && d.perks.every((p) => p.text)), "four worded perks a map");
const KINDS = new Set(["speed", "price", "sell", "pay", "xp", "tele", "chest", "hitin", "aggro", "drop", "see", "death", "keep", "extra", "double", "nofail", "plus"]);
ok(DIARIES.every((d) => d.perks.every((p) => KINDS.has(p.t))), "every perk is a kind the game reads", DIARIES.flatMap((d) => d.perks).filter((p) => !KINDS.has(p.t)).map((p) => p.t).join(","));
ok(DIARIES.every((d) => G.SCENES[d.k]), "every diary is a real map");
ok(JSON.stringify(G.DIARY.keys) === JSON.stringify(DIARIES.map((d) => d.k)), "G.DIARY.keys matches the data (the map card's links)");
ok(tasks.filter((x) => x.v11).length >= 70, `${tasks.filter((x) => x.v11).length} tasks use v1.1`);
ok(G.ITEMS.cape_tour?.slot === "cape" && G.ITEMS.cape_tour.bound && G.noTrade("cape_tour") && G.SLOTS.includes("cape"), "the cape: a cape-slot item, bound, untradeable");
ok(!G.ITEMS.cape_tour.acc && !G.ITEMS.cape_tour.str && !G.ITEMS.cape_tour.def, "the cape carries no stats");
for (const f of ["diary", "cape_tour", ...new Set(DIARIES.map((d) => d.em))]) ok(fs.existsSync(`v3/assets/img/glad/flat/diary/${f}.png`), `art: diary/${f}.png`);

const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 30)); W.save = async () => {};
const house = []; W.houseSay = (t) => house.push(t);
let n = 0;
const player = (C = G.normChar({})) => { C.scene ||= "workyard"; C.hp = G.maxHpOf(C); const id = `d${++n}`, pl = { id, login: id, name: `D${n}`, role: "user", ws: { send() {} }, C, x: 20, y: 12, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 }; W.pls.set(id, pl); return pl; };
const says = (pl) => pl.out.filter((o) => o.type === "say").map((o) => o.text);
const toasts = (pl) => pl.out.filter((o) => o.type === "diary");

console.log("The launch: an old character's first login");
{ const C = G.normChar({});
  C.qs = { copperbell: { state: "done" }, wheatrun: { state: "done" }, emeraldedge: { state: "done" }, ferry: { state: "done" }, sardines: { state: "done" } };
  C.stats.kills = { chicken: 3, cow: 2, boar: 1, toadstool: 1, goat: 1 }; C.stats.gathered = { copper: 5, tin: 5, sardine: 2, trout: 1 };
  C.seen = ["workyard", "gloam", "thrill", "valley"]; C.laps = { rookie: 3 };
  delete C.dia;
  const pl = player(C); house.length = 0;
  W.diarySweep(pl);
  const lines = says(pl);
  ok(lines.length === 1 && /Area diaries are here/.test(lines[0]), "exactly one line", JSON.stringify(lines));
  ok(toasts(pl).length === 0, "no toast");
  ok(house.length === 0, "nothing to the room");
  ok(pl.C.dia.d.includes("workyard.0.0") && pl.C.dia.d.includes("workyard.1.2") && pl.C.dia.d.includes("thrill.0.0") && pl.C.dia.d.includes("valley.0.0"), "old kills, quests, visits and laps all counted");
  ok((pl.C.dia.lv.workyard | 0) === 2, "the Yard's Easy and Medium finished (old quests, and Thrill Hill in C.seen), the Hard not", JSON.stringify(pl.C.dia.lv));
  ok(pl.C.dia.p.some((p) => p.map === "workyard" && p.tier === 0 && p.t === "sell"), "and its perk is on the character");
  pl.out.length = 0; W.diarySweep(pl);
  ok(says(pl).length === 0 && toasts(pl).length === 0, "the second login says nothing");
  /* a character with nothing done: no line at all */
  const fresh = player(); delete fresh.C.dia; fresh.C.seen = []; fresh.C.scene = "isle"; W.diarySweep(fresh);
  ok(says(fresh).length === 0, "a brand-new character: no line", JSON.stringify(says(fresh)));
}

console.log("Live");
{ const pl = player(); pl.C.dia = { d: [], c: {}, cl: {}, p: [], tp: {}, ch: {}, lv: {}, at: 0 }; pl.C.scene = "gloam"; house.length = 0;
  pl.C.stats.kills.toadstool = 1; pl.C.stats.kills.goat = 1; W.emit(pl, "kill", { mob: "goat" });
  ok(toasts(pl).length === 1 && toasts(pl)[0].done.includes("gloam.0.0"), "a task done is a toast");
  ok(!says(pl).some((t) => /diary/i.test(t)), "and no chat line");
  pl.out.length = 0; pl.C.stats.gathered.trout = 1; pl.C.qs.firstbow = { state: "done" }; W.emit(pl, "quest", { k: "firstbow" });
  ok(says(pl).filter((t) => /Easy diary done/.test(t)).length === 1, "a tier finished is one line", JSON.stringify(says(pl)));
  ok(house.length === 0, "an Easy tier is not the room's");
  /* counters: only those a task reads */
  W.diaryNote(pl, "pk:chicken"); W.diaryNote(pl, "pk:highwayman");
  ok(!("pk:chicken" in pl.C.dia.c) && pl.C.dia.c["pk:highwayman"] === 1, "only counters a task reads are kept");
  ok(pl.C.dia.d.includes("gloam.1.2"), "a Highwayman's pocket ticks the Gloam's task");
}

console.log("The lamp");
{ const pl = player(); pl.C.dia = { d: DIARIES.find((d) => d.k === "workyard").t[0].map((x) => x.id), c: {}, cl: {}, p: [], tp: {}, ch: {}, lv: {}, at: 0 };
  W.diaryTiers(pl, true);
  const x0 = pl.C.xp.fishing | 0; W.diaryOp(pl.C.scene ? W.scene(pl.C.scene) : null, pl, { op: "claim", k: "workyard", i: 0, skill: "fishing" });
  ok((pl.C.xp.fishing | 0) - x0 === 1000, "exactly 1,000 XP", `${(pl.C.xp.fishing | 0) - x0}`);
  const x1 = pl.C.xp.fishing; W.diaryOp(W.scene("workyard"), pl, { op: "claim", k: "workyard", i: 0, skill: "fishing" });
  ok(pl.C.xp.fishing === x1, "not twice");
  W.diaryOp(W.scene("workyard"), pl, { op: "claim", k: "workyard", i: 1, skill: "fishing" });
  ok(pl.C.xp.fishing === x1, "not a tier that isn't done");
  const v = player(); v.C.dia = { d: DIARIES.find((d) => d.k === "valley").t[0].map((x) => x.id), c: {}, cl: {}, p: [], tp: {}, ch: {}, lv: {}, at: 0 }; W.diaryTiers(v, true);
  const y0 = v.C.xp.cooking | 0; W.diaryOp(W.scene("workyard"), v, { op: "claim", k: "valley", i: 0, skill: "cooking" });
  ok((v.C.xp.cooking | 0) === y0, "the Valley's lamp refuses a skill under 90");
}

console.log("The teleport");
{ const pl = player(); pl.C.dia = { d: [], c: {}, cl: {}, p: [{ t: "tele", scene: "carnival", map: "carnival", tier: 3 }], tp: {}, ch: {}, lv: {}, at: 0 };
  pl.C.scene = "workyard"; W.diaryOp(W.scene("workyard"), pl, { op: "tele", k: "carnival" });
  ok(pl.C.scene === "carnival", "to the Carnival", pl.C.scene);
  pl.C.scene = "workyard"; W.diaryOp(W.scene("workyard"), pl, { op: "tele", k: "carnival" });
  ok(pl.C.scene === "workyard", "but once a day");
  const w = player(); w.C.dia = { d: [], c: {}, cl: {}, p: [{ t: "tele", scene: "carnival", map: "carnival", tier: 3 }], tp: {}, ch: {}, lv: {}, at: 0 }; w.C.scene = "wild";
  W.diaryOp(W.scene("wild"), w, { op: "tele", k: "carnival" }); ok(w.C.scene === "wild", "never out of the Wilds");
}

console.log("Perks reach the game");
{ const C = { ...G.normChar({}), dia: { d: [], c: {}, cl: {}, p: [], tp: {}, ch: {}, lv: {} } };
  const add = (k, i) => { const { text, ...fx } = DIARIES.find((d) => d.k === k).perks[i]; C.dia.p.push({ ...fx, map: k, tier: i }); };
  add("gloam", 0); add("mire", 0); add("wild", 1); add("deep", 3); add("thrill", 3); add("workyard", 0); add("trailer", 0);
  ok(G.diarySpeed(C, "trout", "gloam") === 0.1 && G.diarySpeed(C, "trout", "mire") === 0, "trout bite faster in the Gloam only");
  ok(G.diaryHitIn(C, "shark", "mire") === 0.1 && G.diaryHitIn(C, "shark", "gloam") === 0, "Loan Sharks hit softer on the Mire only");
  ok(G.diaryDeath(C, "wild") === 0.2 && G.diaryDeath(C, "deep") === 0, "a Wilderness death costs a fifth less");
  ok(G.diaryKeep(C, "deep") === 0.5, "Deep Wild gear half as likely to drop");
  ok(G.diaryHas(C, "nofail", "cannon"), "the cannon never misfires");
  ok(G.diarySell(C, "bom", "catalytic") === 0.1 && G.diarySell(C, "bom", "trout") === 0.05, "Bom: 10% on converters, 5% on the rest");
  const H = { ...G.normChar({}) }; ok(G.diarySpeed(H, "trout", "gloam") === 0, "no diary, no perk");
}

console.log("The cape");
{ const pl = player(); house.length = 0;
  pl.C.dia = { d: tasks.map((x) => x.id), c: {}, cl: {}, p: [], tp: {}, ch: {}, lv: {}, at: 0 };
  W.diaryTiers(pl, false);
  ok(G.countItems(pl.C, ["cape_tour"]) === 1, "every Elite: the cape");
  ok(house.some((t) => /Grand Tour/.test(t)), "and the room hears it");
  W.diaryTiers(pl, false); ok(G.countItems(pl.C, ["cape_tour"]) === 1, "once");
  ok(pl.C.dia.p.length === 84, "all 84 perks", `${pl.C.dia.p.length}`);
  /* never dropped in the Wilds */
  G.takeInv(pl.C.inv, "cape_tour", 1); pl.C.eq.cape = "cape_tour";
  const worn = G.SLOTS.filter((s) => pl.C.eq[s] && !G.ITEMS[pl.C.eq[s]]?.bound); ok(!worn.includes("cape"), "the cape is not in the Wilds' drop list");
  const src = fs.readFileSync("eastscape-worker/src/index.js", "utf8"); ok(/G\.SLOTS\.filter\(\(s\) => C\.eq\[s\] && !G\.ITEMS\[C\.eq\[s\]\]\?\.bound\)/.test(src), "the death code skips bound pieces");
}

console.log("Saving");
{ const C = G.normChar({}); C.dia = { d: ["gloam.0.0"], c: { "pk:highwayman": 2 }, cl: { gloam: 1 }, p: [{ t: "tele", scene: "gloam", map: "gloam", tier: 3 }], tp: {}, ch: {}, lv: { gloam: 1 }, at: 1 };
  const back = G.normChar(JSON.parse(JSON.stringify(C)));
  ok(back.dia?.d?.[0] === "gloam.0.0" && back.dia.c["pk:highwayman"] === 2 && back.dia.lv.gloam === 1 && back.dia.p.length === 1, "normChar keeps the diary");
  const none = G.normChar({}); ok(!none.dia, "and makes none for a character without one (the first login does, quietly)");
}

console.log(bad ? `\n${bad} FAILED` : "\nall good");
process.exit(bad ? 1 : 0);
