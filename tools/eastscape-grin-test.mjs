/* THE GRIN —  node tools/eastscape-grin-test.mjs
   (2026-10-02) The real World, storage kept in a Map, the real raid tick and the real swing:
     - only an admin starts him (raid grin); the War Horn's call is the Ice Man, never him; held, he can't be started at all;
     - after the warning he stands where the Ice Man does with 7,800 health (1.5x the Pumpkin King), and NOTHING ELSE ever comes: no waves;
     - the page's darkness goes warn -> dark -> out (his head off) -> dark, told to each player once a change, wherever they are;
     - HEADS WILL ROLL: one real head among the fakes, all on the west bank; while it's off a real swing does nothing to him;
       a fake bursts into crows on whoever hits it; the real one stuns him (no walking, no swinging), clears the fakes, and he can be hurt again;
       nobody finds it in time and it rolls back and heals him;
     - rage at 30%; a restart mid-raid puts him back at his health with his head on;
     - a win: everybody who fought is paid from the pool, and everyone who did their share gets 2-3 gems; the pet table is his;
     - a loss: the Yard stays dark twenty minutes, the stalls stay OPEN, then the lamps come back. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const mem = new Map(), ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => mem.get(k), put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) mem.set(a, structuredClone(b)); else mem.set(k, structuredClone(v)); }, delete: async (k) => { mem.delete(k); }, list: async () => new Map() } };
const make = async () => { const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; clearInterval(W.timer); const said = []; W.houseSay = (t) => said.push(t); return { W, said }; };
let { W, said } = await make();
const S = W.scene("workyard"), Q = G.GRIN, R = G.RAID;
let n = 0;
const player = (W, x, y, lvl = 99) => { const C = G.freshChar(); C.inv = []; C.scene = "workyard"; for (const k of ["hp", "melee", "defence"]) C.xp[k] = G.XP_AT[lvl]; C.hp = G.maxHpOf(C); C.eq.weapon = "singularity_sword";
  const id = `g${++n}`, pl = { id, login: id, name: `Seeker${n}`, role: "admin", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0 }; W.pls.set(id, pl); return pl; };
const darkSeen = (p) => p.out.filter((o) => o.type === "grin").map((o) => o.dark);
const swing = (S, p, m, now) => { p.act = { kind: "mob", id: m.id, x: m.x, y: m.y, started: 1 }; p.lastSwing = 0; p.path = []; p.lastInput = now; p.x = m.x - 1; p.y = m.y; W.doAction(S, p, now); };

/* 0. the rules */
is([Q.hp, Q.hp / 5200, G.MOBS.grin?.boss, G.MOBS.grin?.open, G.MOBS.grin?.pet?.[0], G.BOSSES.has("grin"), !!G.PETS.grinling?.raid, G.PET_DROP_KEYS.includes("grinling")], [7800, 1.5, true, true, "grinling", true, true, false], "7,800 health (1.5x the Pumpkin King), an open boss, his pet his alone");
/* 1. only an admin, never the horn */
const a = player(W, 18, 6), b = player(W, 30, 20);
W.raidCall("Somebody", Date.now());
is(W.raid?.kind ?? "ice", "ice", "the War Horn's call is the Ice Man, never The Grin");
W.raid = null; W.raidSave(Date.now(), true);
G.HOLD.grin = true; let msg = ""; W.raidAdmin(S, a, "grin", (t) => (msg = t)); G.HOLD.grin = false;
is([W.raid, /isn't open/.test(msg)], [null, true], "held, nobody can start him");
W.raidAdmin(S, a, "grin", (t) => (msg = t));
is([W.raid?.kind, W.raid?.phase, said.some((x) => /lamps in the Yard just flickered/.test(x))], ["grin", "warn", true], "an admin starts him: two minutes' warning in CASINO's voice");
W.raidTick(Date.now());
is([darkSeen(a), darkSeen(b)], [["warn"], ["warn"]], "every player is told the Yard is darkening, wherever they stand");
/* 2. he arrives, alone */
let t = W.raid.at; W.raidTick(t);
const boss = S.mobs.find((m) => m.t === "grin");
is([W.raid.phase, !!boss, boss && [boss.x, boss.y].join(","), boss?.hp, boss?.maxHp, darkSeen(a).at(-1)], ["on", true, Q.boss.at.join(","), 7800, 7800, "dark"], "he's in: where the Ice Man stands, 7,800 health, and the Yard goes dark");
for (let i = 0; i < 15; i++) { t += 1000; W.raidTick(t); }
is([S.mobs.filter((m) => m.raid && m.raid !== "boss").length, darkSeen(a).length], [0, 2], "fifteen seconds in, nothing else has come: no waves (and the page heard each change once)");
/* 3. a swing lands while his head is on */
const hp0 = boss.hp; for (let i = 0; i < 6; i++) swing(S, a, boss, t + i * 3000);
is(boss.hp < hp0, true, "his head on, a swing hurts him");
/* 4. HEADS WILL ROLL */
t = W.raid.nextHead; W.raidTick(t);
const heads = S.mobs.filter((m) => m.raid === "head"), fakes = heads.filter((m) => !m.real);
is([heads.length >= Q.head.fakes[0] + 1, heads.filter((m) => m.real).length, heads.every((m) => m.x <= R.zoneX && G.walkableIn(S.g, m.x, m.y)), boss.immune, darkSeen(a).at(-1), said.some((x) => /TEARS HIS HEAD OFF/.test(x))], [true, 1, true, true, "out", true], `he throws it: ${heads.length} heads, exactly one real, all on the west bank; he can't be hurt; the Yard goes deeper dark`);
const hp1 = boss.hp; for (let i = 0; i < 6; i++) swing(S, a, boss, t + i * 3000);
is([boss.hp, a.out.some((o) => /find the real one/.test(o.text || ""))], [hp1, true], "headless, six real swings do nothing, and he says why");
/* the real one watches whoever is nearest; a fake never turns */
const real = heads.find((m) => m.real), f0 = fakes[0], faces = fakes.map((m) => m.face);
b.x = real.x + 1; b.y = real.y; a.x = 0; a.y = 0; W.raidTick(t + 1000);
const r1 = real.face; b.x = real.x - 1; W.raidTick(t + 2000);
is([r1, real.face, fakes.map((m) => m.face).join() === faces.join()], [1, -1, true], "the real one turns to look at whoever's nearest; the fakes never move");
/* a fake: crows */
const c = player(W, f0.x - 1, f0.y), hpC = c.C.hp; W.killMob(S, c, f0, t + 3000);
is([c.C.hp < hpC, S.mobs.includes(f0), S.mobs.filter((m) => m.raid === "head").length, boss.immune], [true, false, heads.length - 1, true], "a fake bursts into crows on whoever hit it; the rest are still there and he's still headless");
/* the real one: he drops */
W.killMob(S, c, real, t + 4000);
is([S.mobs.filter((m) => m.raid === "head").length, boss.immune, boss.dizzyUntil > t + 4000, W.raid.head, said.some((x) => /FOUND THE REAL HEAD/.test(x)), W.grinDark(t + 4000)], [0, false, true, null, true, "dark"], "the real one: the fakes go, he's on his knees and can be hurt again");
const at0 = [boss.x, boss.y], sw0 = boss.lastSwing; boss.target = c.id; c.x = boss.x - 1; c.y = boss.y;
W.mobsTick?.(S, t + 6000);
is([[boss.x, boss.y].join(), boss.lastSwing], [at0.join(), sw0], "stunned: he neither walks nor swings");
/* nobody finds it: it rolls back and heals him */
boss.dizzyUntil = 0; boss.stunUntil = 0; boss.hp = 5000; t = W.raid.nextHead; W.raidTick(t);
is(!!W.raid.head, true, "the next throw comes");
t = W.raid.head.until; W.raidTick(t);
is([S.mobs.filter((m) => m.raid === "head").length, boss.immune, boss.hp, said.some((x) => /Nobody found it/.test(x))], [0, false, 5000 + Math.round(7800 * Q.head.heal), true], "nobody found it in time: it rolls back, and he heals 4%");
/* 5. rage */
boss.hp = Math.floor(7800 * Q.rage); W.raidTick(t + 1000);
is([W.raid.rage, W.grinDark(t + 1000), said.some((x) => /stopped smiling/.test(x))], [true, "rage", true], "at 30% he rages, and the dark goes red");
/* 6. a restart mid-raid */
W.raidSave(Date.now(), true); const hpSaved = boss.hp;
({ W, said } = await make());
const S2 = W.scene("workyard"); W.pls.set(a.id, a); W.pls.set(b.id, b); W.raidTick(Date.now());
const boss2 = S2.mobs.find((m) => m.t === "grin");
is([W.raid?.kind, boss2?.hp, boss2?.maxHp, W.raid.head, S2.mobs.filter((m) => m.raid === "head").length, said.some((x) => /STILL IN THE YARD/.test(x))], ["grin", hpSaved, 7800, null, 0, true], "a restart: he's back at his health with his head on, and CASINO says so");
/* 7. a win */
const tix0 = { a: G.tixIn(a.C), b: G.tixIn(b.C) }, gems0 = JSON.stringify(a.C.inv) + JSON.stringify(a.C.gems || null);
W.raid.by[a.id] = 6000; W.raid.by[b.id] = 10;   /* b barely touched him: paid, but no gems */
const gemSay = (p) => p.out.filter((o) => /Something glints/.test(o.text || "")).length;
boss2.hp = 1; boss2.immune = false; for (let i = 0; i < 40 && S2.mobs.includes(boss2); i++) swing(S2, a, boss2, Date.now() + i * 3000);
is([W.raid, S2.mobs.some((m) => m.raid), G.tixIn(a.C) > tix0.a, G.tixIn(b.C) > tix0.b, gemSay(a) >= 2 && gemSay(a) <= 3, gemSay(b), said.some((x) => /THE GRIN IS DOWN/.test(x))], [null, false, true, true, true, 0, true], "a win: everybody who fought is paid, 2-3 gems for whoever did their share, none for a token hit");
W.raidTick(Date.now());
is(darkSeen(a).at(-1), null, "and the lamps come back on");
/* 8. a loss */
({ W, said } = await make());
const S3 = W.scene("workyard"), z = player(W, 18, 6); W.raidAdmin(S3, z, "grin", () => {}); let t3 = W.raid.at; W.raidTick(t3);
t3 = W.raid.until; W.raidTick(t3);
is([W.raid, W.raidSack?.kind, Math.round((W.raidSack.until - t3) / 60000), W.grinDark(t3), S3.mobs.some((m) => m.raid), said.some((x) => /took the light with him/.test(x))], [null, "grin", 20, "lost", false, true], "a loss: he walks off with the light, and the Yard stays dark twenty minutes");
is(["counter", "cashout", "eggtrade", "ex", "hw", "order"].map((op) => W.raidClosed(op)), [false, false, false, false, false, false], "and every stall stays open");
W.raidSack.until = Date.now() - 1; W.raidTick(Date.now());
is([W.raidSack, W.grinDark(), darkSeen(z).at(-1), said.some((x) => /lamps in the Yard come back on/.test(x))], [null, null, null, true], "twenty minutes on, the lamps come back");
/* 9. end, from the admin window */
W.raidAdmin(S3, z, "grin", () => {}); W.raidAdmin(S3, z, "end", () => {});
is([W.raid, said.some((x) => /steps back into the dark/.test(x))], [null, true], "an admin can end him early");
console.log(bad ? `\n${bad} problem(s)` : "\nThe Grin holds: only an admin calls him, he comes alone, his head hides among the fakes, finding it drops him, a win pays and gives gems, a loss leaves the Yard dark");
process.exitCode = bad ? 1 : 0;
