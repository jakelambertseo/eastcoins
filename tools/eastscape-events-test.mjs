/* WORLD EVENTS —  node tools/eastscape-events-test.mjs
   (2026-09-30, the owner: "lets build all of them on the dev server", then "can we set wanted as once per day, stars as once per day and jackpot once
   per day, all spread out?"). The real World with storage stubbed and the clock handed in:
     - the day's plan: one of each, inside 12:00-24:00 Chicago time, never closer than an hour;
     - a SHOOTING STAR warns, lands, is mined tier by tier (Mining gates each tier, fragments per swing, a cap), and is spent;
     - a WANTED poster: a named copy of a map's monster at six times the health, open to everyone, the bounty shared by damage (with a floor),
       the takes counted, and an escape that makes the next one bigger;
     - the JACKPOT THIEF: his sack comes out of the Jackpot, every hit spills tickets anyone can pick up, every tenth leaves him dizzy, he runs
       from people, hops maps, the last hit takes the sack, and an escape puts it all back;
     - the STAR TENT sells for fragments only, once each, at the tent; the ticket Store refuses its rows;
     - Who's online says who is idle. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20));
W.save = async () => {}; const said = []; W.houseSay = (t) => said.push(t); W.hasTool = () => true;
let n = 0;
function player(name, scene, x, y, lv = {}) {
  const C = G.freshChar(); C.inv = []; G.addInv(C.inv, "tickets", 1000, C); for (const [k, l] of Object.entries(lv)) C.xp[k] = G.XP_AT[l];
  const id = `e${++n}`, pl = { id, login: id, name, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); W.moveToScene(pl, scene, null, { x, y }); return pl;
}
const tix = (pl) => G.tixIn(pl.C), lines = (pl) => pl.out.map((e) => e.text || "").join(" | ");
const HR = 3600000, MIN = 60000;

/* 1. the day's plan */
{ const t0 = Date.now(); W.ev = null; W.evPlanDay(t0); const P = W.ev.plan, ts = Object.values(P).sort((a, b) => a - b);
  const mins = (t) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(t); return (+p.find((x) => x.type === "hour").value % 24) * 60 + +p.find((x) => x.type === "minute").value; };
  is(Object.keys(P).sort(), ["star", "thief", "wanted"], "one of each on the day's plan");
  is(ts.every((t) => mins(t) >= 12 * 60 && mins(t) < 24 * 60), true, "all three between noon and midnight, Chicago time");
  is(ts[1] - ts[0] >= HR && ts[2] - ts[1] >= HR, true, `never within an hour of each other (gaps ${Math.round((ts[1] - ts[0]) / MIN)} and ${Math.round((ts[2] - ts[1]) / MIN)} minutes)`); }

/* 2. SHOOTING STARS */
const mA = player("Miner", "gloam", 20, 8, { mining: 64 }), mB = player("Newbie", "gloam", 22, 8, { mining: 12 });
const Y = W.scene("workyard"), GL = W.scene("gloam"); let t = Date.now();
is(Object.keys(G.SSTAR.scenes).includes("workyard"), false, "a star never lands in the Yard");
W.sstar = null; W.starWarn(t, t + 10 * MIN, "gloam");
is([W.sstar.phase, /A star is falling! It'll come down in the woods north of the Yard in about 10 minutes/.test(said.at(-1))], ["warn", true], "ten minutes out: CASINO gives a direction, not the spot");
t += 10 * MIN; W.starTick(t);
const star = () => GL.mobs.find((m) => m.star);
is([W.sstar.phase, W.sstar.tier, !!star(), star()?.nm], ["up", 6, true, "Shooting star · tier 6"], "it lands in the Gloam at tier 6 (the best Mining online, 64, rounded down)");
{ const m = star(); mA.x = m.x - 1; mA.y = m.y; mB.x = m.x + 1; mB.y = m.y;
  const aA = { kind: "mob", id: m.id, started: 0 }, aB = { kind: "mob", id: m.id, started: 0 };
  mB.act = aB; mB.out = []; W.starSwing(GL, mB, m, aB, t); is([mB.act, /You need Mining 60 to mine the star at tier 6\. You can join in when it's down to tier 1/.test(lines(mB))], [null, true], "Mining 12 at tier 6: refused, and told when they can join");
  mA.act = aA; W.starSwing(GL, mA, m, aA, t); const hp0 = m.hp;
  for (let i = 1; i <= 5; i++) W.starSwing(GL, mA, m, aA, t + i * 3000);
  is([hp0 - m.hp, mA.C.frags], [5, 15], "five swings at tier 6: five of its health, 3 fragments each");
  /* mine it down to the bottom: tier by tier */
  let k = 6; for (let tt = t + 20000; W.sstar && k < 4000; tt += 3000, k++) { const mm = star(); if (!mm) break; aA.x = mm.x; W.starSwing(GL, mA, mm, aA, tt); }
  is([W.sstar, !star(), mA.C.frags, said.some((s) => /is spent\. 1 miner took 400 Star Fragments/.test(s))], [null, true, 400, true], "mined to nothing: spent, and the cap (400) held however long they swung"); }
{ t = Date.now(); W.starWarn(t, t, "gloam"); W.starTick(t + 1); W.starTick(t + G.SSTAR.lasts + 2);
  is([W.sstar, !star(), said.some((s) => /cools and goes dark\. Nobody came/.test(s))], [null, true, true], "left alone for an hour: it goes dark"); }

/* 3. WANTED! */
const h1 = player("Hunter", "workyard", 12, 14, { melee: 40 }), h2 = player("Helper", "workyard", 14, 14, { melee: 20 });
t = Date.now(); W.wanted = null; W.wantedLog = { log: [], up: 0 }; W.wantedPost(t, "workyard"); W.wantedTick(t);
const wm = () => Y.mobs.find((m) => m.wanted);
{ const m = wm(), d = G.MOBS[W.wanted.t];
  is([!!m, m?.open, m?.nm === W.wanted.name, m?.maxHp, W.wanted.bounty], [true, true, true, Math.max(150, Math.round(d.hp * 6)), 5000], `the poster: ${W.wanted.name} (${d.name}) in the Yard, six times the health (150 at least), open to all, 5,000`);
  is(W.mayFight(Y, m, h2, t), true, "open to everyone: nobody can claim it");
  W.bossAdd(h1, m, "dmg", Math.round(m.maxHp * 0.9)); W.bossAdd(h2, m, "dmg", m.maxHp - Math.round(m.maxHp * 0.9)); m.hp = 0;
  const a1 = tix(h1), a2 = tix(h2); W.killMob(Y, h1, m, t);
  const d2 = m.maxHp - Math.round(m.maxHp * 0.9);
  is([tix(h1) - a1 >= 4400, tix(h2) - a2, h1.C.takes, h2.C.takes, !wm(), W.wanted, W.wantedLog.log[0]?.result], [true, Math.max(150, Math.round((5000 * d2) / m.maxHp)), 1, 1, true, null, "taken"], "taken: shared by damage (never under the 3% floor), both counted, gone for good"); }
{ t = Date.now(); W.wantedPost(t, "workyard"); W.wantedTick(t); const up0 = W.wantedLog.up; W.wantedTick(t + G.WANTED.lasts + 1);
  is([W.wanted, !wm(), W.wantedLog.up - up0, W.wantedLog.log[0]?.result], [null, true, 0.25, "escaped"], "an hour and nobody took it: ESCAPED, and the next bounty is 25% bigger");
  W.wantedPost(t, "workyard"); is(W.wanted.bounty, 6300, "the next poster: 5,000 × 1.25, to the hundred"); W.wanted = null; W.wantedLog.up = 0; for (const m of [...Y.mobs]) if (m.wanted) Y.mobs.splice(Y.mobs.indexOf(m), 1); }
{ h1.C.takes = 9; t = Date.now(); W.wantedPost(t, "workyard"); W.wantedTick(t); const m = wm(); W.bossAdd(h1, m, "dmg", m.maxHp); m.hp = 0; W.killMob(Y, h1, m, t);
  is(h1.C.store.own.includes("title_bountyhunter"), true, "the tenth poster taken: « Bounty Hunter » is theirs"); }

/* 4. THE JACKPOT THIEF */
const c1 = player("Chaser", "workyard", 20, 13, { melee: 30 }), c2 = player("Scooper", "workyard", 24, 16);
t = Date.now(); W.jack.pot = 100000; W.thief = null; W.thiefStart(t);
const th = () => Y.mobs.find((m) => m.thief);
is([W.thief.sack, W.jack.pot, !!th(), th()?.hp], [5000, 95000, true, Math.min(80, 30 + 3 * W.playersIn(Y).length)], "he grabs 5% of a 100,000 Jackpot and runs into the Yard, 30 hits plus 3 a person");
{ const m = th(), g0 = Y.ground.length;
  for (let i = 0; i < 10; i++) { m.hp -= 1; W.thiefHit(Y, c1, m, t + i); }
  const piles = Y.ground.slice(g0);
  is([piles.length, piles[0]?.k, piles[0]?.n, piles[0]?.owner, W.thief.sack, m.dizzyUntil > t], [10, "tickets", 75, null, 4250, true], "ten hits: ten piles of 75 tickets for anyone, the sack down to 4,250, and he's dizzy");
  const pile = piles[0]; c2.x = pile.x; c2.y = pile.y; c2.path = []; const b0 = tix(c2); c2.act = { kind: "ground", id: pile.id, x: pile.x, y: pile.y }; W.doAction(Y, c2, t);
  is(tix(c2) - b0, 75, "someone who never hit him picks one up");
  /* he runs */
  for (const q of W.playersIn(Y)) if (q !== c1) { q.x = 3; q.y = 3; }   /* the bystanders step well back: one beside him on each side would box him in (and should) */
  m.dizzyUntil = 0; m.step = null; m.path = []; c1.x = m.x + 1; c1.y = m.y; const s0 = { x: m.x, y: m.y }; let tt = t + 1000;
  for (let i = 0; i < 20; i++, tt += 200) W.thiefMove(Y, m, tt, W.playersIn(Y));
  is(G.cheb(s0, m) >= 3 && m.x < s0.x, true, `he runs, away from the chaser at his side (${G.cheb(s0, m)} tiles in four seconds)`); }
{ const m = th(), a0 = tix(c1), left = W.thief.sack; m.hp = 0; W.killMob(Y, c1, m, t);
  is([tix(c1) - a0, W.thief, !th(), c1.out.some((e) => e.type === "jackpotkill")], [left, null, true, true], "the last hit takes what's left in the sack"); }
{ const far = player("Faraway", "gloam", 20, 10); t = Date.now(); W.thiefStart(t); const G0 = W.scene("gloam");
  W.thief.nextHop = t - 1; W.thiefTick(t);
  is([W.thief.scene, !!G0.mobs.find((m) => m.thief), !th(), said.some((s) => /he's in THE GLOAM/.test(s))], ["gloam", true, true, true], "a minute on: he dives down a hole and comes up where people are, and CASINO says where");
  const pot0 = W.jack.pot, sack = W.thief.sack; W.thief.hop = G.JTHIEF.hops; W.thief.nextHop = t - 1; W.thiefTick(t);
  is([W.thief, W.jack.pot - pot0, !G0.mobs.find((m) => m.thief)], [null, sack, true], "five hops and he's gone: the whole sack goes back into the Jackpot");
  W.pls.delete(far.id); }

/* 5. THE STAR TENT */
{ const b = player("Buyer", "cloud", 18, 17, { mining: 64 }), CL = W.scene("cloud"); b.C.frags = 5000;
  W.tentOp(CL, b, { op: "buy", id: "title_stargazer" }); is([b.C.frags, b.C.store.own.includes("title_stargazer"), b.C.store.name.title], [3800, true, "title_stargazer"], "« Stargazer » for 1,200 fragments, worn at once");
  b.out = []; W.tentOp(CL, b, { op: "buy", id: "title_stargazer" }); is([b.C.frags, /own that already/.test(lines(b))], [3800, true], "not twice");
  W.tentOp(CL, b, { op: "buy", id: "star_crate" }); is([b.C.frags, G.countItems(b.C, ["starfall_ore"]), G.countItems(b.C, ["glacite"])], [3650, 20, 6], "a Star crate at Mining 64: 20 starfall ore and 6 glacite");
  b.out = []; W.tentOp(CL, b, { op: "buy", id: "egg_starling" }); is([b.C.frags, /6,000 Star Fragments/.test(lines(b))], [3650, true], "the egg is 6,000: refused, and told what they have");
  b.x = 36; b.y = 13; b.out = []; b.C.frags = 9000; W.tentOp(CL, b, { op: "buy", id: "egg_starling" }); is([b.C.frags, /at the Star Tent, in Cloudreach/.test(lines(b))], [9000, true], "across Cloudreach: refused");
  b.x = 18; b.y = 17; W.tentOp(CL, b, { op: "buy", id: "egg_starling" }); is([b.C.frags, G.countItems(b.C, ["egg_starling"])], [3000, 1], "at the tent: the Starling egg");
  b.out = []; W.storeOp(CL, b, { op: "buy", id: "trail_starfall" }); is(/Star Tent sells that/.test(lines(b)), true, "the ticket Store refuses a Star Tent row"); }

/* 6. what the page is told, and Who's online */
{ const v = W.evView(); is(["now", "star", "wanted", "thief"].every((k) => k in v), true, "the tracker's view has the three events and the server's clock");
  const q = player("Watcher", "workyard", 5, 5); q.lastInput = Date.now() - 12 * MIN; const sent = []; W.send = (p, m) => { if (p === mA) sent.push(m); };
  mA.whoAllAsk = 0; W.onMessage(mA, { t: "whoall" }); const row = (sent.at(-1)?.people || []).find((p) => p.name === "Watcher");
  is([row?.idle >= 11, (sent.at(-1)?.people || []).find((p) => p.name === "Miner")?.idle], [true, 0], "Who's online: minutes idle for each person"); }

console.log(bad ? `\n${bad} problem(s)` : "\nThe world events hold: one each a day, the star mined tier by tier, the poster shared, the thief chased, the tent honest");
process.exitCode = bad ? 1 : 0;
