/* STARTING EVENTS FROM THE STAFF CHAT VIEW —  node tools/eastscape-chatact-test.mjs
   (2026-10-01) The real World, storage stubbed: the Flood and the raid start NOW through the same admin functions (and say so in chat as
   CASINO, never naming anyone); a second start while one runs is refused; skip and end work; a later start waits, survives a restart, fires
   from the tick and is gone after; a waiting one can be called off; a star starts and ends; nonsense is refused; the feed carries the plan. */
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const ok = (c, what, extra = "") => { console.log(`  ${c ? "ok" : "!!"}  ${what}${c || !extra ? "" : "  — " + extra}`); if (!c) bad++; };
const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => new Map() } };
const mk = async () => { const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 30)); W.save = async () => {}; return W; };
let W = await mk(); W.scene("workyard");   /* a live server always has the Yard up */
const lastHouse = () => (W.chatLog || []).filter((m) => m.id === "house").map((m) => m.text).pop() || "";

let r = await W.chatAct({ what: "flood", when: "now" });
ok(r.ok && W.raid?.kind === "flood", "the Flood starts now", JSON.stringify(r));
ok(/FLOOD/.test(lastHouse()) && !/chat view/i.test(lastHouse()), "CASINO announces it, naming nobody", lastHouse());
r = await W.chatAct({ what: "raid", when: "now" });
ok(/already/.test(r.said) && W.raid?.kind === "flood", "a raid can't start on top of it", r.said);
r = await W.chatAct({ what: "raidend" });
ok(!W.raid, "ending it works", r.said);
r = await W.chatAct({ what: "raid", when: "now" });
ok(W.raid?.phase === "warn" && W.raid.kind !== "flood", "the Ice Man's raid starts with its warning", r.said);
r = await W.chatAct({ what: "skip" });
ok(W.raid && W.raid.phase !== "warn", "skipping the warning brings him in", JSON.stringify(W.raid?.phase));
await W.chatAct({ what: "raidend" });

r = await W.chatAct({ what: "flood", when: "r60" });
ok(r.ok && W.chatPlan?.what === "flood" && W.chatPlan.at > Date.now() + 4 * 60000 && W.chatPlan.at <= Date.now() + 60 * 60000 && !W.raid, "a random time in the next hour waits (5-60 minutes)", JSON.stringify(W.chatPlan));
ok(store.get("chatPlan")?.what === "flood", "and is kept in storage");
const at = W.chatPlan.at;
W = await mk(); W.scene("workyard");
ok(W.chatPlan?.at === at, "a restart keeps it");
W.chatPlanTick(at - 1000); ok(!W.raid, "nothing before its time");
W.chatPlanTick(at + 1); ok(W.raid?.kind === "flood" && !W.chatPlan && !store.get("chatPlan"), "at its time the Flood starts, and the plan is gone");
await W.chatAct({ what: "raidend" });
await W.chatAct({ what: "raid", when: "m10" });
r = await W.chatAct({ cancel: true });
ok(!W.chatPlan && /Called off/.test(r.said), "a waiting start can be called off", r.said);

r = await W.chatAct({ what: "star", when: "now" });
ok(W.sstar, "a shooting star starts", r.said);
r = await W.chatAct({ what: "starend" });
ok(!W.sstar, "and ends", r.said);
r = await W.chatAct({ what: "nonsense" });
ok(!r.ok, "nonsense is refused");
const v = W.chatActView();
ok(v.acts.length >= 4 && v.list.flood, "the feed lists what was done since the restart", JSON.stringify(v.acts[0]));

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
