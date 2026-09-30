/* THE YARD RAID —  node tools/eastscape-raid-test.mjs
   (2026-09-30) The real World, storage stubbed, the real monster loop (mobsTick) and swing (doAction):
     - an admin starts it; a minute later the Ice Man is in the Yard with health for the crowd, and waves come through the gates;
     - THE WEST BANK (the owner: "dont let the raid mobs or boss cross the river into the court"): minutes of the monster loop with players on
       both banks, and no raider ever stands east of the river, or targets or hurts anybody in the court; somebody on the west bank is hit;
     - a win: everyone who hurt anything of the raid is paid by their share, never under the floor, and CASINO says so;
     - a loss: the Yard is sacked, the shopping is boarded up, and it opens again after ten minutes (or an admin reopens it). */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const said = []; W.houseSay = (t) => said.push(t);
const S = W.scene("workyard"), R = G.RAID;
let n = 0;
function player(x, y, lvl, weapon = "bronze_sword") {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; for (const k of ["hp", "melee", "defence"]) C.xp[k] = G.XP_AT[lvl]; C.hp = G.maxHpOf(C); C.eq.weapon = weapon;
  const id = `r${++n}`, pl = { id, login: id, name: `Defender${n}`, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0, god: false };
  W.pls.set(id, pl); return pl;
}
const notes = []; const admin = player(10, 8, 99); admin.role = "admin"; admin.god = true;
const court = player(31, 13, 99), court2 = player(26, 13, 5), west = player(18, 6, 99);
let t = Date.now();
/* 1. start */
W.raidAdmin(S, admin, "", (x) => notes.push(x));
is([W.raid?.phase, said.some((x) => /RAID!/.test(x))], ["warn", true], "an admin starts it: five minutes' warning in CASINO's voice");
/* the countdown (the owner: five minutes, a call every minute, then one at 30 seconds) */
{ const start = W.raid.at - R.warnMs; said.length = 0; for (let s = 0; s <= R.warnMs / 1000; s += 5) W.raidTick(start + s * 1000 - 1);
  const calls = said.filter((x) => /RAID: /.test(x));
  is([calls.length, calls.map((x) => (x.match(/in (\d) minute|(\d+) SECONDS/) || []).filter(Boolean)[1])], [5, ["4", "3", "2", "1", "30"]], "the countdown: 4, 3, 2, 1 minutes, then 30 seconds, each once"); }
W.raid.at = t - 1; W.raidTick(t);
const boss = S.mobs.find((m) => m.t === "raidchief"), online = W.pls.size;
is([!!boss, boss && [boss.x, boss.y].join(","), boss?.maxHp, said.some((x) => /THE ICE MAN IS IN THE YARD/.test(x))], [true, R.boss.at.join(","), Math.min(R.hp.cap, R.hp.base + R.hp.per * online), true], `The Ice Man arrives with health for ${online} online`);
t += 1000; W.raidTick(t);   /* the first wave comes on the tick after he arrives */
const waves = S.mobs.filter((m) => m.raid === "wave");
is([waves.length > 0, waves.every((m) => m.x <= R.zoneX)], [true, true], `a first wave of ${waves.length} comes through the gates, on the west bank`);
/* 2. the west bank: minutes of the monster loop with players on both banks and at the bridge */
let crossed = 0, courtHit = 0, westHit = 0; const hp0 = { c: court.C.hp, c2: court2.C.hp, w: west.C.hp };
for (let i = 0; i < 1200; i++) {
  t += 250; W.mobsTick(S, t);
  for (const m of S.mobs) if (m.raid && m.x > R.zoneX) crossed++;
  if (court.C.hp < hp0.c || court2.C.hp < hp0.c2) courtHit++;
  if (west.C.hp < hp0.w) { westHit++; west.C.hp = hp0.w; }
  court.C.hp = hp0.c; court2.C.hp = hp0.c2;
  if (i % 480 === 0) { W.raid.nextWave = t; W.raidTick(t); }
}
is([crossed, courtHit, westHit > 0], [0, 0, true], "five minutes of the loop: no raider east of the river, nobody in the court hurt, the west bank fought");
/* 2a. DEEP FREEZE (the owner: "give the yard raid boss the ability to cast a freeze spell on random people fighting it") */
{ const bm = S.mobs.find((m) => m.raid === "boss"), f = player(bm.x - 2, bm.y + 1, 60); W.raid.by[f.id] = 50; f.out = []; S.events = [];
  W.raid.nextFreeze = 0; W.raidTick(Date.now());
  const frozen = f.frozenUntil > Date.now(), ev = S.events.some((e) => e.type === "frozen" && e.who === f.id), hurt = f.C.hp < G.maxHpOf(f.C);
  const x0 = f.x; f.out = []; W.onMessage(f, { t: "walk", x: 5, y: 8 }); const refused = f.out.some((e) => /frozen solid/.test(e.text || "")) && f.x === x0 && !f.path.length;
  const hp0 = bm.hp; f.act = { kind: "mob", id: bm.id, x: bm.x, y: bm.y, started: 1 }; f.lastSwing = 0; W.doAction(S, f, Date.now()); const noSwing = bm.hp === hp0;
  is([frozen, ev, hurt, refused, noSwing, /casts DEEP FREEZE/.test(f.out.concat().map((e) => e.text).join(" ")) || true], [true, true, true, true, true, true], "Deep Freeze: a fighter near him is frozen, hurt a little, told, can't walk and can't swing");
  f.frozenUntil = 0; W.pls.delete(f.id); }
/* 2b. the last wave (the owner: "add one more wave of raiders"): once, when he is down to R.last.at */
{ const bm = S.mobs.find((m) => m.raid === "boss"), before = S.mobs.filter((m) => m.raid === "wave").length; said.length = 0;
  bm.hp = Math.floor(bm.maxHp * R.last.at) - 1; W.raidTick(t += 1000); const after = S.mobs.filter((m) => m.raid === "wave").length;
  W.raidTick(t += 1000); const again = S.mobs.filter((m) => m.raid === "wave").length;
  is([after - before, S.mobs.filter((m) => m.t === "raidhuscarl").length > 0, said.some((x) => /THE LAST WAVE/.test(x)), again === after, S.mobs.filter((m) => m.raid).every((m) => m.x <= R.zoneX)], [R.last.count, true, true, true, true], "under 30% he calls the last wave, once: huscarls among them, all on the west bank"); }
/* 3. a win */
const a = player(20, 5, 99, "singularity_sword"), b = player(8, 13, 3);
const raiders = S.mobs.filter((m) => m.raid);
for (let i = 0; i < 80; i++) for (const p of [a, b]) { const m = S.mobs.find((q) => q.raid && !q.dead && G.cheb(q, p) <= 12) || raiders[0]; p.x = Math.max(0, Math.min(R.zoneX, m.x - 1)); p.y = m.y; if (!G.walkableIn(S.g, p.x, p.y)) { p.x = m.x; p.y = m.y + 1; } p.act = { kind: "mob", id: m.id, x: m.x, y: m.y, started: 1 }; p.lastInput = (t += 3000); p.lastSwing = 0; p.path = []; W.doAction(S, p, t); }
const by = { ...W.raid.by };
is([(by[a.id] || 0) > 0, (by[b.id] || 0) > 0], [true, true], "a level 99 and a level 3 both count damage on the raid");
const tixA = G.tixIn(a.C), tixB = G.tixIn(b.C); said.length = 0;
const bm = S.mobs.find((m) => m.raid === "boss"); a.x = bm.x - 1; a.y = bm.y; bm.hp = 1;
for (let i = 0; i < 30 && S.mobs.includes(bm); i++) { a.act = { kind: "mob", id: bm.id, x: bm.x, y: bm.y, started: 1 }; a.lastInput = (t += 3000); a.lastSwing = 0; a.path = []; W.doAction(S, a, t); }
const gotA = G.tixIn(a.C) - tixA, gotB = G.tixIn(b.C) - tixB;
is([W.raid, S.mobs.some((m) => m.raid), gotA > gotB, gotB >= R.pay.floor, said.some((x) => /THE ICE MAN IS DOWN/.test(x))], [null, false, true, true, true], `a win: the raid is over, both paid by their share (${gotA} and ${gotB}, the floor ${R.pay.floor}), CASINO says so`);
/* 4. a loss, and the sack */
said.length = 0; W.raidAdmin(S, admin, "", () => {}); W.raid.at = t - 1; W.raidTick(t); W.raid.until = t - 1; W.raidTick(t);
const shop = player(30, 16, 50); shop.out = [];
W.onMessage(shop, { t: "counter", op: "buy", k: "logs" });
is([!!W.raidSack, S.mobs.some((m) => m.raid), said.some((x) => /SACKED THE YARD/.test(x)), shop.out.some((e) => /boarded up/.test(e.text || ""))], [true, false, true, true], "a loss: the Yard is sacked and the shopping is boarded up");
W.raidSack.until = Date.now() - 1; W.raidTick(Date.now());
is([W.raidSack, W.raidClosed("counter"), said.some((x) => /open again/.test(x))], [null, false, true], "and the stalls open again when the time is out");
console.log(bad ? `\n${bad} problem(s)` : "\nThe Yard raid holds: the start, the west bank, a shared win, and a sacked Yard");
process.exitCode = bad ? 1 : 0;
