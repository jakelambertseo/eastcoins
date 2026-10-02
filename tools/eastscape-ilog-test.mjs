/* THE ITEM LOG —  node tools/eastscape-ilog-test.mjs
   (2026-10-02) The real World with storage stubbed: each way a thing leaves your bag writes one line, in the words the page and the admin card show. */
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
W.houseSay = () => {};
let n = 0;
function player(scene = "workyard") {
  const C = G.freshChar(); C.inv = []; C.scene = scene; G.addInv(C.inv, "tickets", 50000, C);
  const id = `l${++n}`, pl = { id, login: id, name: `Logger${n}`, role: "user", ws: { send() {} }, C, x: 20, y: 10, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); return pl;
}
const last = (pl) => pl.C.ilog?.at(-1);
const words = (pl) => G.ilogText(last(pl));

/* dropped */
const p = player(); G.addInv(p.C.inv, "pickaxe", 1, p.C);
W.onMessage(p, { t: "drop", i: p.C.inv.findIndex((s) => s.k === "pickaxe") });
is([last(p)?.[1], last(p)?.[2], words(p)], ["drop", "pickaxe", "Dropped Bronze pickaxe on the ground."], "a drop");
is(p.out.some((e) => e.type === "ilog1"), true, "an online player is sent the line at once");

/* banked: gear and tools, not logs */
G.addInv(p.C.inv, "axe", 1, p.C); G.addInv(p.C.inv, "logs", 20, p.C);
const before = p.C.ilog.length;
W.bankAdd(p, "logs", 20); is(p.C.ilog.length, before, "a stack of logs into the bank is not logged");
W.bankAdd(p, "axe", 1); is([last(p)?.[1], words(p)], ["banked", "Put Bronze axe in the bank."], "a tool into the bank is");

/* sold, through the shared sale hook */
W.trkSold(p, "logs", 5, 40); is([last(p)?.[1], words(p)], ["sold", "Sold 5 × Logs for 40 tickets."], "a sale");

/* a death: the dropped piece and the ticket loss */
W.trkDeath(p, W.scene("wild"), { mob: "Wolf" }, null, "bronze_sword", 1200);
const two = p.C.ilog.slice(-2).map((e) => G.ilogText(e));
is([two[0].startsWith("Died in"), two[1].startsWith("Hospital bill")], [true, true], `a Wilderness death ("${two[0]}" / "${two[1]}")`);

/* a trade, both sides */
{ const a = player(), b = player(); G.addInv(a.C.inv, "logs", 3, a.C); G.addInv(b.C.inv, "ore", 2, b.C);
  W.ilog(a, "traded", "logs", 3, b.name); W.ilog(b, "received", "logs", 3, a.name);
  is([G.ilogText(last(a)), G.ilogText(last(b))], [`Traded 3 × Logs to ${b.name}.`, `Got 3 × Logs from ${a.name} in a trade.`], "a trade reads from both sides"); }

/* every kind has words, and the log keeps the last 80 */
for (const k of ["drop", "lost", "bill", "robbed", "sold", "sorter", "outfit", "traded", "received", "listed", "broke", "banked", "withdrew"]) if (!G.ilogText([0, k, "logs", 2, "x"]) || /undefined/.test(G.ilogText([0, k, "logs", 2, "x"]))) { bad++; console.log(`  !! no words for ${k}`); }
console.log("  every kind has its words");
for (let i = 0; i < 100; i++) W.ilog(p, "sold", "logs", 1);
is(p.C.ilog.length, G.ILOG.max, "the log keeps the last 80");

/* the page asks */
p.out = []; W.onMessage(p, { t: "ilog" }); is(p.out.find((e) => e.type === "ilog")?.list?.length, G.ILOG.max, "the Log tab gets the whole log");

console.log(bad ? `\n${bad} FAILED` : "\nThe item log holds: drops, the bank's gear, sales, deaths, trades, its words for every kind, the cap, and the Log tab's read");
process.exit(bad ? 1 : 0);
