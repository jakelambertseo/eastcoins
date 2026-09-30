/* THE WEEKLY ISSUE —  node tools/eastscape-weekly-test.mjs
   (2026-09-30, the owner: "updates: week 1 (post launch) … stats of the week, total tickets wagered, interesting stats, dungeon clears"). The real World,
   its storage a Map, the clock handed in:
     - before launch, Week 1 shows everything so far and says so;
     - the first tick of a week takes its snapshot, once; the week's numbers are what changed since (xp by skill, kills, tickets, quests);
     - the tally counts what no character keeps: world bosses, raids, clears, Jackpots, the most online at once;
     - a week that has not started has no numbers. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, structuredClone(v)); }, delete: async (k) => store.delete(k),
  list: async (o = {}) => new Map([...store].filter(([k]) => k.startsWith(o.prefix || "") && (!o.startAfter || k > o.startAfter)).slice(0, o.limit || 1e9)) } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
const put = (id, name, patch) => { const C = G.freshChar(); Object.assign(C, patch); C.name = name; store.set(`char:${id}`, C); store.set(`who:${name.toLowerCase()}`, { id, name }); };
put("a", "Alpha", { earned: 1000, wagered: 500, xp: { ...G.freshChar().xp, mining: 5000 } });
put("b", "Beta", { earned: 200, xp: { ...G.freshChar().xp, fishing: 800 } });
const fresh = () => { W.hsAt = 0; W.hs = null; W.wkCache = {}; };
const day = (s) => Date.parse(`${s}T17:00:00Z`);   /* noon, Chicago */

/* 1. before launch */
{ const real = Date.now; Date.now = () => day("2026-09-30"); fresh();
  const S = await W.weekStats(1); is([S.have, S.sofar, S.totals.earned, S.skills.mining > 0], [true, true, 1200, true], "before launch: Week 1 shows everything so far, marked as such");
  Date.now = real; }
/* 2. the week starts: one snapshot, then what changed */
{ const real = Date.now, t0 = day("2026-10-01"); Date.now = () => t0; fresh(); W.tickN = 1;
  await W.weekTick(t0); await W.weekTick(t0 + 60000);
  is([!!store.get("wk:1"), W.weekOf(t0), W.weekOf(day("2026-10-07")), W.weekOf(day("2026-10-08"))], [true, 1, 1, 2], "Thursday 1 October is Week 1; the next Thursday is Week 2; one snapshot");
  const A = store.get("char:a"); A.earned += 2500; A.wagered += 700; A.xp.mining += 3000; A.stats = { kills: { boar: 12 } };
  put("c", "Gamma", { earned: 50, xp: { ...G.freshChar().xp, cooking: 400 } });
  W.weekCount("boss", "rex"); W.weekCount("raid", "won"); W.weekCount("clear", "1"); W.weekCount("clear", "p1"); W.weekCount("jackpot");
  Date.now = () => t0 + 3 * 864e5; fresh();
  const S = await W.weekStats(1);
  is([S.have, S.live, S.totals.earned, S.totals.wagered, S.skills.mining, S.totals.kills, S.fresh], [true, true, 2550, 700, 3000, 12, 1], "three days in: 2,550 earned, 700 wagered, 3,000 mining xp, 12 kills, one new player");
  is([S.acc.bosses.rex, S.acc.raids.won, S.clears["1"], S.clears.p1, S.jackpots], [1, 1, 1, 1, 1], "the tally: a boss, a raid beaten, a Crypt and a Pyramid clear, a Jackpot");
  is(S.top.earned[0], { name: "Alpha", v: 2500 }, "top of the week: Alpha earned most");
  Date.now = real; }
/* 3. a week that has not started */
{ const real = Date.now; Date.now = () => day("2026-10-02"); fresh(); const S = await W.weekStats(3); is(S.have, false, "Week 3 has no numbers yet"); Date.now = real; }
console.log(bad ? `\n${bad} problem(s)` : "\nThe weekly issue holds: a snapshot a week, the week's numbers, the tally, and everything so far before launch");
process.exitCode = bad ? 1 : 0;
