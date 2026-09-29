/* THE PARTY METER —  node tools/eastscape-meter-test.mjs
   (2026-09-28) The real World with storage stubbed and a party of two: hits (through award, the one place every combat hit pays xp),
   food eaten, damage taken and deaths land on the right member, in both the run and the fight; a fight ends after the quiet gap and the
   next hit starts a new one while the run keeps adding up; eating never starts a fight; a member's first hit in a new dungeon run resets
   the numbers; somebody with no party is never counted; the meter reaches both members at most once a second; and reset empties it. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const mk = (id) => { const pl = { id, name: id, C: G.freshChar(), x: 5, y: 5, out: [], path: [] }; pl.C.scene = "workyard"; W.pls.set(id, pl); return pl; };
const a = mk("ann"), b = mk("bob"), solo = mk("sol");
W.parties ||= new Map(); const pt = { id: "p1", leader: "ann", members: ["ann", "bob"] }; W.parties.set("p1", pt); a.party = b.party = "p1";
const row = (seg, id) => W.meterView(pt, Date.now())[seg]?.rows.find((r) => r.id === id);
let clock = 1_000_000; const realNow = Date.now; Date.now = () => clock;

/* 1. the first fight */
W.award(a, 30); W.award(b, 12); W.meterAdd(b, "taken", 9, { t: "boar" });
is([row("run", "ann").dmg, row("run", "bob").dmg, row("fight", "bob").taken], [30, 12, 9], "hits and a monster's hit land on the right member, run and fight");
is(W.meterView(pt, clock).fight.foe, G.MOBS.boar.name, "the fight is named after what it was against");
W.meterAdd(solo, "dmg", 99); is(!!W.meterView(pt, clock).run.rows.find((r) => r.name === "sol"), false, "no party: never counted");

/* 2. eating counts, but never starts a fight */
clock += 20000; W.meterAdd(a, "heal", 14);
is([row("run", "ann").heal, W.meterView(pt, clock).fight.live, row("fight", "ann").heal], [14, false, 0], "food after the fight went quiet: in the run, not the old fight, and no new fight");

/* 3. the next hit is a new fight; the run keeps adding up */
W.award(a, 5);
is([row("fight", "ann").dmg, row("run", "ann").dmg, W.meterView(pt, clock).fight.live], [5, 35, true], "a new fight starts from nothing, the run keeps the total");
W.meterAdd(b, "deaths", 1); W.meterAdd(a, "kills", 1, { t: "boar" });
is([row("fight", "bob").deaths, row("run", "ann").kills], [1, 1], "deaths and kills");

/* 4. into a dungeon: a new run */
a.C.scene = "crypt:abc"; W.award(a, 7);
is([row("run", "ann").dmg, row("run", "bob").dmg, W.meterView(pt, clock).zone], [7, 0, "crypt"], "a member's first hit in a new dungeon run starts the run over");

/* 5. sending: both members, at most once a second */
a.out = []; b.out = []; W.meterTick(clock); W.award(a, 1); W.meterTick(clock + 200);
is([a.out.filter((e) => e.type === "meter").length, b.out.filter((e) => e.type === "meter").length], [1, 1], "one message each, not two, inside the same second");
W.meterTick(clock + 1200); is(a.out.filter((e) => e.type === "meter").length, 2, "and the next second's change goes out");

/* 6. reset */
W.meterOp(null, b, { op: "reset" }); is([row("run", "ann").dmg, W.meterView(pt, clock).fight], [0, null], "reset empties the run and the fight");

/* 7. THE RUN REPORT: a run in the Crypt, then a clear and a wipe */
a.C.scene = b.C.scene = "crypt:rep"; clock += 60000;
const boss = { id: "m1", t: "hoodie", hp: 900, dead: false };
W.meterAdd(a, "swing", 1, boss); W.meterAdd(a, "hit", 1, boss); W.award(a, 40); W.meterAdd(a, "swing", 1, boss);
W.meterAdd(b, "eat", 1, null, "clanternfish"); W.meterAdd(b, "eat", 1, null, "clanternfish"); W.meterAdd(b, "heal", 20);
W.meterAdd(a, "xp", 160, null, "melee"); W.meterAdd(b, "deaths", 1, null, "The Hoodie");
clock += 11000; W.award(b, 25); W.meterAdd(a, "kills", 1, boss);
const S = { key: "crypt:rep", mobs: [{ ...boss, dead: true }], run: { started: clock - 95000 } };
a.out = []; b.out = [];
W.reportEnd(S, "crypt", "clear", { title: "The Crypt", best: 700 });
const R = a.out.find((e) => e.type === "runreport")?.r, ra = R?.rows.find((r) => r.id === "ann"), rb = R?.rows.find((r) => r.id === "bob");
is([!!b.out.find((e) => e.type === "runreport"), R?.result, R?.title, R?.secs, R?.boss, R?.best], [true, "clear", "The Crypt", 95, G.MOBS.hoodie.name, 700], "a clear sends both of them the report: result, name, time, boss, the best to beat");
is([ra.dmg, ra.swing, ra.hit, ra.xp.melee, rb.eat, rb.eats.clanternfish, rb.heal, rb.deaths], [40, 2, 1, 160 + 160, 2, 2, 20, 1], "the rows (the 40 damage also paid its own 160 xp): damage, swings and hits (accuracy), xp by skill, food by kind, healed, deaths");
is([R.kb?.name, R.log[0]?.name, R.log[0]?.cause, R.log[0]?.t, ra.tl[0], rb.tl[1]], ["ann", "bob", "The Hoodie", 0, 40, 25], "the killing blow, the death (who, what, when), damage in 10-second buckets");
a.out = []; W.meterOp(null, a, { op: "report" }); is(!!a.out.find((e) => e.type === "runreport" && e.again), true, "the last report can be asked for again");
S.mobs = [{ ...boss, hp: 126, dead: false }]; a.out = [];
W.reportEnd(S, "crypt", "wipe", { title: "The Crypt" }); const RW = a.out.find((e) => e.type === "runreport")?.r;
is([RW?.result, RW?.bossLeft], ["wipe", Math.round((100 * 126) / G.MOBS.hoodie.hp)], "a wipe says how much of the boss was left");

Date.now = realNow;
console.log(bad ? `\n${bad} problem(s)` : "\nthe party meter works: the right member, the run and the fight, a new run per dungeon, once a second at most");
process.exitCode = bad ? 1 : 0;
