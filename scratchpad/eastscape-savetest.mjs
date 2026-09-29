/* Save-format tests: item renames and version migrations.
   Run: node scratchpad/eastscape-savetest.mjs
   These are the two things that can silently destroy a character, so they get
   a test even though nothing else in EastScape has one yet. */
import * as G from "../v3/assets/js/eastscape-shared.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  ok  " + name); } else { fail++; console.log("FAIL  " + name + (extra ? "  -> " + extra : "")); } };
const invOf = (c, k) => c.inv.filter((s) => s.k === k).reduce((n, s) => n + s.n, 0);
const bankOf = (c, k) => c.bank.filter((s) => s.k === k).reduce((n, s) => n + s.n, 0);

console.log("\n-- a brand-new character --");
{
  const c = G.normChar(null);
  ok("is at the current save version", c.v === G.SAVE_V, `v=${c.v} SAVE_V=${G.SAVE_V}`);
  ok("has a stats block", !!c.stats && typeof c.stats.kills === "object");
  ok("starts with no kills", Object.keys(c.stats.kills).length === 0);
}

console.log("\n-- a v1 character migrates --");
{
  const old = { v: 1, created: 1700000000000, scene: "farm", x: 4, y: 5, hp: 10,
    inv: [{ k: "coins", n: 25 }, { k: "logs", n: 40 }], xp: { melee: 500 }, qs: {} };
  const c = G.normChar(old);
  ok("lands on the current version", c.v === G.SAVE_V);
  ok("gains a stats block", !!c.stats);
  ok("firstSeen falls back to created", c.stats.firstSeen === 1700000000000, String(c.stats.firstSeen));
  ok("keeps its items", invOf(c, "logs") === 40, String(invOf(c, "logs")));
  ok("its melee xp became the three combat skills", c.xp.attack === 500 && c.xp.strength === 500 && c.xp.defence === 500, JSON.stringify(c.xp));
  ok("migrating twice is a no-op", G.normChar(c).stats.firstSeen === 1700000000000);
}

console.log("\n-- a character with no version at all (pre-v field) --");
{
  const c = G.normChar({ inv: [{ k: "coins", n: 5 }], xp: {}, qs: {} });
  ok("is treated as v1 and migrated", c.v === G.SAVE_V && !!c.stats);
}

console.log("\n-- item renames --");
{
  // pretend "rudis" was renamed to "bronzesword" and "parma" to "bronzeshield"
  // NOT a real alias target: bronzesword is itself aliased now, and the point
  // of this test is one hop, not the chain (which has its own test below).
  G.ITEM_ALIASES.rudis = "grudge";
  G.ITEM_ALIASES.parma = "lantern";
  const old = { v: 2, inv: [{ k: "rudis", n: 1 }, { k: "logs", n: 3 }], bank: [{ k: "parma", n: 2 }],
    eq: { weapon: "rudis", shield: "parma" }, isle: { shelf: ["rudis"] }, xp: {}, qs: {},
    stats: { gathered: { rudis: 4, grudge: 1 }, kills: { cow: 7 } } };
  const c = G.normChar(old);
  ok("a renamed bag item survives", invOf(c, "grudge") === 1, JSON.stringify(c.inv));
  ok("the old key is gone from the bag", invOf(c, "rudis") === 0);
  ok("a renamed bank item survives", bankOf(c, "lantern") === 2, JSON.stringify(c.bank));
  ok("renamed equipment follows", c.eq.weapon === "grudge" && c.eq.shield === "lantern", JSON.stringify(c.eq));
  ok("a renamed island shelf item follows", c.isle.shelf[0] === "grudge", String(c.isle.shelf[0]));
  ok("stat counts merge under the new key", c.stats.gathered.grudge === 5, String(c.stats.gathered.grudge));
  ok("kills are NOT item-aliased", c.stats.kills.cow === 7);
  delete G.ITEM_ALIASES.rudis; delete G.ITEM_ALIASES.parma;
}

console.log("\n-- the real aliases in the table --");
{
  const c = G.normChar({ v: 2, inv: [{ k: "bronzesword", n: 1 }, { k: "bronzehelm", n: 1 }], xp: {}, qs: {} });
  ok("bronzesword -> bronze_sword", invOf(c, "bronze_sword") === 1, JSON.stringify(c.inv));
  ok("bronzehelm -> bronze_helm", invOf(c, "bronze_helm") === 1);
  for (const [from, to] of Object.entries(G.ITEM_ALIASES)) ok(`${from} -> ${to} is a real item`, !!G.ITEMS[to]);
}

console.log("\n-- a chain of renames --");
{
  G.ITEM_ALIASES.aaa = "bbb"; G.ITEM_ALIASES.bbb = "logs";
  const c = G.normChar({ v: 2, inv: [{ k: "aaa", n: 9 }], xp: {}, qs: {} });
  ok("a -> b -> c resolves to the end", invOf(c, "logs") === 9, JSON.stringify(c.inv));
  delete G.ITEM_ALIASES.aaa; delete G.ITEM_ALIASES.bbb;
}

console.log("\n-- a rename that loops back on itself --");
{
  G.ITEM_ALIASES.logs = "yewlogs"; G.ITEM_ALIASES.yewlogs = "logs";
  const t0 = Date.now();
  const c = G.normChar({ v: 2, inv: [{ k: "logs", n: 1 }], xp: {}, qs: {} });
  ok("does not hang", Date.now() - t0 < 1000);
  ok("still produces a real item", c.inv.length === 0 || !!G.ITEMS[c.inv[0].k]);
  delete G.ITEM_ALIASES.logs; delete G.ITEM_ALIASES.yewlogs;
}

console.log("\n-- an item deleted from the game with no alias --");
{
  const c = G.normChar({ v: 2, inv: [{ k: "notathing", n: 3 }, { k: "logs", n: 1 }], xp: {}, qs: {} });
  ok("the unknown key is dropped", invOf(c, "notathing") === 0);
  ok("the real one is kept", invOf(c, "logs") === 1);
}

console.log("\n-- the xp-per-day log is bounded --");
{
  const xpDay = {};
  for (let i = 0; i < G.STAT_DAYS + 40; i++) {
    const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
    xpDay[d] = i;
  }
  const c = G.normChar({ v: 2, xp: {}, qs: {}, stats: { xpDay } });
  const days = Object.keys(c.stats.xpDay);
  ok(`kept at most ${G.STAT_DAYS} days`, days.length === G.STAT_DAYS, String(days.length));
  ok("kept the NEWEST days", days.sort().at(-1) === Object.keys(xpDay).sort().at(-1));
  ok("dropped the oldest", !days.includes(Object.keys(xpDay).sort()[0]));
}

console.log("\n-- rubbish in the stats block --");
{
  const c = G.normChar({ v: 2, xp: {}, qs: {}, stats: { kills: "nope", deaths: "12", gathered: { logs: -5, tin: 3 }, xpDay: { "not-a-day": 5 } } });
  ok("a non-object map becomes empty", Object.keys(c.stats.kills).length === 0);
  ok("a numeric string is coerced", c.stats.deaths === 12, String(c.stats.deaths));
  ok("a negative count is dropped", c.stats.gathered.logs === undefined);
  ok("a good count is kept", c.stats.gathered.tin === 3);
  ok("a bad day key is dropped", Object.keys(c.stats.xpDay).length === 0);
}

console.log("\n-- a save from a FUTURE version (a rollback) --");
{
  const c = G.normChar({ v: 99, inv: [{ k: "logs", n: 2 }], xp: {}, qs: {} });
  ok("is not run through migrations", invOf(c, "logs") === 2);
  ok("is stamped at the version this build understands", c.v === G.SAVE_V);
}

console.log("\n-- a migration that throws must not lose the character --");
{
  G.MIGRATIONS.push(() => { throw new Error("boom"); });
  const c = G.normChar({ v: 1, inv: [{ k: "logs", n: 6 }], xp: { attack: 99 }, qs: {} });
  ok("the character survives", invOf(c, "logs") === 6 && c.xp.attack === 99, JSON.stringify(c.xp));
  G.MIGRATIONS.pop();
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
