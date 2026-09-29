/* The event hook and the stat counters, driven against the REAL World class
   with storage and the socket stubbed. Run: node scratchpad/eastscape-statstest.mjs */
import { World } from "../eastscape-worker/src/index.js";
import * as G from "../v3/assets/js/eastscape-shared.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => { if (cond) { pass++; console.log("  ok  " + name); } else { fail++; console.log("FAIL  " + name + (extra ? "  -> " + extra : "")); } };

function makeCtx(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    _map: map,
    storage: {
      async get(k) { return map.get(k); },
      async put(a, b) { if (a && typeof a === "object") { for (const k in a) map.set(k, a[k]); } else map.set(a, b); },
      async delete(k) { return map.delete(k); },
      async list({ prefix = "" } = {}) { const out = new Map(); for (const [k, v] of map) if (k.startsWith(prefix)) out.set(k, v); return out; }
    },
    blockConcurrencyWhile: (fn) => fn()
  };
}
const FAKE_WS = () => ({ sent: [], send(m) { this.sent.push(m); }, addEventListener() {}, close() {} });
const ENV = { ALLOWED_ORIGINS: "", SITE: "", DEV: "1" };

async function world(seed) {
  const ctx = makeCtx(seed);
  const w = new World(ctx, ENV);
  await new Promise((r) => setTimeout(r, 0));          // let blockConcurrencyWhile settle
  const ws = FAKE_WS();
  await w.join({ id: "u1", login: "tester", name: "Tester", admin: true }, ws);
  w.stop();                                            // no ticking during a test
  const pl = w.pls.get("u1");
  return { w, pl, ctx, S: w.scene(pl.C.scene) };
}

console.log("\n-- a session starts --");
{
  const { pl } = await world();
  ok("the session is counted", pl.C.stats.sessions === 1, String(pl.C.stats.sessions));
  ok("firstSeen is set", pl.C.stats.firstSeen > 0);
  ok("the clock is running", pl.playFrom > 0);
  ok("cash is remembered at join", pl.cashSeen === 25, String(pl.cashSeen));
}

console.log("\n-- kills --");
{
  const { w, pl } = await world();
  w.emit(pl, "kill", { mob: "cow" });
  w.emit(pl, "kill", { mob: "cow" });
  w.emit(pl, "kill", { mob: "boar" });
  ok("counts per mob type", pl.C.stats.kills.cow === 2 && pl.C.stats.kills.boar === 1, JSON.stringify(pl.C.stats.kills));
  ok("marks the character for saving", pl.needSave === true);
}

console.log("\n-- gathering, looting and cooking are separate --");
{
  const { w, pl, S } = await world();
  w.gained(S, pl, "logs", 3);
  w.emit(pl, "loot", { k: "hide", n: 1 });
  w.gained(S, pl, "cbeef", 1, "cook");
  w.emit(pl, "burn", {});
  const st = pl.C.stats;
  ok("skilling goes to gathered", st.gathered.logs === 3, JSON.stringify(st.gathered));
  ok("a drop goes to looted, not gathered", st.looted.hide === 1 && !st.gathered.hide);
  ok("cooking goes to cooked, not gathered", st.cooked.cbeef === 1 && !st.gathered.cbeef);
  ok("a burn is counted", st.burnt === 1);
}

console.log("\n-- xp --");
{
  const { w, pl } = await world();
  w.grant(pl, "mining", 40);
  w.grant(pl, "mining", 60);
  w.grant(pl, "fishing", 10);
  const st = pl.C.stats, today = G.dayKeyCT();
  ok("total xp adds up", st.xpTotal === 110, String(st.xpTotal));
  ok("today's xp adds up", st.xpDay[today] === 110, JSON.stringify(st.xpDay));
  ok("only today has a row", Object.keys(st.xpDay).length === 1);
}

console.log("\n-- the xp-per-day log trims itself --");
{
  const { w, pl } = await world();
  const st = pl.C.stats;
  for (let i = 0; i < G.STAT_DAYS + 5; i++) st.xpDay[`2020-01-${String((i % 28) + 1).padStart(2, "0")}-${i}`] = i;  // junk keys, just to fill it
  const before = Object.keys(st.xpDay).length;
  w.grant(pl, "mining", 5);
  ok("was over the cap before", before > G.STAT_DAYS);
  ok("is at the cap after", Object.keys(st.xpDay).length <= G.STAT_DAYS, String(Object.keys(st.xpDay).length));
  ok("today survived the trim", st.xpDay[G.dayKeyCT()] === 5);
}

console.log("\n-- deaths --");
{
  const { w, pl, S } = await world();
  w.emit(pl, "death", { pvp: false });
  w.emit(pl, "death", { pvp: true });
  ok("deaths count", pl.C.stats.deaths === 2);
  ok("pvp deaths count separately", pl.C.stats.pvpDeaths === 1);
  w.emit(pl, "pvpkill", { victim: "u2" });
  ok("pvp kills count", pl.C.stats.pvpKills === 1);
}

console.log("\n-- quests --");
{
  const { w, pl } = await world();
  w.emit(pl, "quest", { k: "whatever" });
  ok("quests handed in count", pl.C.stats.questsDone === 1);
}

console.log("\n-- cash is measured, not hooked --");
{
  const { w, pl } = await world();
  w.give(pl, "coins", 500);          // any path that adds money
  w.accrue(pl);
  ok("earning is counted", pl.C.stats.cashIn === 500, String(pl.C.stats.cashIn));
  ok("nothing spent yet", pl.C.stats.cashOut === 0);
  G.takeInv(pl.C.inv, "coins", 200); // any path that removes it
  w.accrue(pl);
  ok("spending is counted", pl.C.stats.cashOut === 200, String(pl.C.stats.cashOut));
  ok("earning is not double-counted", pl.C.stats.cashIn === 500);
  w.bankAdd(pl, "coins", 0);
  const inBank = 50;
  G.takeInv(pl.C.inv, "coins", inBank); w.bankAdd(pl, "coins", inBank);
  w.accrue(pl);
  ok("moving cash to the bank is neither", pl.C.stats.cashIn === 500 && pl.C.stats.cashOut === 200, `${pl.C.stats.cashIn}/${pl.C.stats.cashOut}`);
}

console.log("\n-- time played --");
{
  const { w, pl } = await world();
  pl.playFrom = Date.now() - 5000;
  w.accrue(pl);
  ok("time is banked", pl.C.stats.playMs >= 5000, String(pl.C.stats.playMs));
  ok("the clock restarts, not double-counts", (w.accrue(pl), pl.C.stats.playMs < 6000), String(pl.C.stats.playMs));
  ok("lastSeen moves", pl.C.stats.lastSeen > 0);
}

console.log("\n-- leaving banks an idle session --");
{
  const { w, pl, ctx } = await world();
  pl.playFrom = Date.now() - 8000;
  pl.needSave = false;                     // changed nothing at all
  await w.leave(pl);
  const saved = ctx._map.get("char:u1");
  ok("the character was written anyway", !!saved);
  ok("its time was kept", saved.stats.playMs >= 8000, String(saved?.stats?.playMs));
}

console.log("\n-- a save from before the counters --");
{
  const legacy = { v: 1, created: 1700000000000, scene: "farm", x: 4, y: 5, hp: 10, inv: [{ k: "coins", n: 7 }], xp: {}, qs: {} };
  const { w, pl } = await world({ "char:u1": legacy });
  ok("is migrated on the way in", pl.C.v === G.SAVE_V);
  ok("gets a stats block", !!pl.C.stats);
  w.emit(pl, "kill", { mob: "cow" });
  ok("and starts counting", pl.C.stats.kills.cow === 1);
}

console.log("\n-- the hook is safe on a character with no stats --");
{
  const { w, pl } = await world();
  delete pl.C.stats;
  let threw = false;
  try { w.emit(pl, "kill", { mob: "cow" }); w.accrue(pl); } catch (e) { threw = true; }
  ok("emit does not throw", !threw);
}

console.log("\n-- quests still hear the hook --");
{
  const { w, pl } = await world();
  const qk = Object.keys(G.QUESTS).find((k) => G.QUESTS[k].goal.type === "kill");
  if (!qk) { console.log("  (no kill quest in the rules; skipped)"); }
  else {
    const q = G.QUESTS[qk];
    pl.C.qs[qk] = { state: "active", n: 0 };
    w.emit(pl, "kill", { mob: q.goal.mob });
    ok(`the quest counted the kill (${qk})`, pl.C.qs[qk].n === 1, String(pl.C.qs[qk].n));
    ok("and so did the counters", pl.C.stats.kills[q.goal.mob] === 1);
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
