/* WHAT THE WORLD RECORDS, AND THE WILDERNESS CHECK —  node tools/eastscape-track-test.mjs
   (2026-09-30, the owner: "build all nine tracking additions and the wild changes"; the plans are tools/tracking-mock/ and tools/wild-mock/).
   The real World, its storage a Map:
     - a second online is a second on that map doing that thing (fighting, gathering, walking, away …), on the character and the day, and it
       never asks for a save;
     - kills, gathering and xp by map; the casino's net; which station made it;
     - tickets in by source and out by sink; what was sold and bought;
     - deaths by map and cause, and a player kill on the PvP list;
     - the day's tally is written once a minute, survives a restart, and at the turn of the day the economy is measured and old days go;
     - the Wild: a kill there pays 1.25x (the Deep 1.5x) in combat xp and tickets, a death there costs 10% of what you carry (a player
       who kills you takes it), and the monsters are the late maps'. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const store = new Map(), puts = [];
const storage = { get: async (k) => (Array.isArray(k) ? new Map(k.filter((x) => store.has(x)).map((x) => [x, structuredClone(store.get(x))])) : store.get(k)),   /* (like the real thing: several keys at once come back as a Map) */ put: async (k, v) => { if (typeof k === "object") { for (const [a, b] of Object.entries(k)) { store.set(a, structuredClone(b)); puts.push(a); } } else { store.set(k, structuredClone(v)); puts.push(k); } }, delete: async (k) => { for (const x of [].concat(k)) store.delete(x); },
  list: async (o = {}) => new Map([...store].filter(([k]) => k.startsWith(o.prefix || "") && (!o.startAfter || k > o.startAfter) && (!o.end || k < o.end)).sort(([a], [b]) => (a < b ? -1 : 1)).slice(0, o.limit || 1e9)) };
const mk = async () => { const W = new World({ blockConcurrencyWhile: (fn) => fn(), storage }, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {}; return W; };
let W = await mk(), n = 0;
function player(name, scene, x, y, lv = {}, tix = 1000) {
  const C = G.freshChar(); C.inv = []; G.addInv(C.inv, "tickets", tix, C); for (const [k, l] of Object.entries(lv)) C.xp[k] = G.XP_AT[l]; C.hp = G.maxHpOf(C);
  const id = `t${++n}`, pl = { id, login: id, name, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); W.moveToScene(pl, scene, null, { x, y }); store.set(`char:${id}`, C); return pl;
}
const flush = () => new Promise((r) => setTimeout(r, 5));
const day = () => W.trkDay();

/* 1. A SECOND ONLINE */
const now = Date.now();
const fighter = player("Fighter", "gloam", 10, 10), gatherer = player("Gatherer", "deep", 20, 20), walker = player("Walker", "workyard", 5, 5), away = player("Away", "workyard", 6, 6);
fighter.combatAt = now; gatherer.trkDid = { k: "g", at: now }; walker.path = [{ x: 6, y: 5 }]; away.lastInput = now - 6 * 60000;
for (const p of W.pls.values()) { p.needSave = false; p.changedAt = null; }
for (let i = 0; i < 5; i++) W.trkSecond(now);
is([fighter.C.stats.t.gloam, gatherer.C.stats.t.deep, walker.C.stats.t.workyard, away.C.stats.t.workyard], [{ f: 5 }, { g: 5 }, { w: 5 }, { a: 5 }], "five seconds each: fighting, gathering, walking, away");
is([day().where.t.workyard, Object.keys(day().where.who.workyard).length, fighter.C.stats.playDay[G.dayKeyCT()]], [{ w: 5, a: 5 }, 2, 5], "the day's tally by map, two different people in the Yard, five seconds played today");
is([...W.pls.values()].some((p) => p.needSave || p.changedAt), false, "counting a second never asks for a save");

/* 2. EVENTS BY MAP */
W.emit(fighter, "kill", { mob: "gnasher" }); W.emit(gatherer, "gather", { k: "onyx_ore", n: 2 }); W.emit(gatherer, "xp", { skill: "mining", xp: 115 });
W.recordPlay(walker, "slots", -50); W.recordPlay(walker, "slots", 120); W.trkCraft(gatherer, "altar_nexus", "page_arcane", 45);
is([day().where.kills.gloam, day().where.gathered.deep, day().people.xp.mining, day().where.xpMap.deep, day().econ.casino.slots, day().econ.craft.altar_nexus], [{ gnasher: 1 }, { onyx_ore: 2 }, 115, { mining: 115 }, [2, 70], { page_arcane: 45 }], "a kill, a gather and xp by map; the slots' plays and net; a Nexus craft");
W.trkSecond(now); is(walker.C.stats.t.workyard.p, 1, "a table played in the last half minute counts as playing");

/* 3. TICKETS */
W.tixTo(walker, 300, "dailies"); W.earned(walker, 80, "sell"); W.trkSold(walker, "stardust", 4, 80); W.trkTix(walker, -150, "store"); W.trkBought(walker, "store:trail_x", 1, 150); W.trkEx("ruby", 3, 900);
const pickK = (o, ks) => Object.fromEntries(ks.filter((k) => o?.[k] != null).map((k) => [k, o[k]]));   /* (an achievement may pay along the way: that is its own source) */
is([pickK(walker.C.stats.tixIn, ["dailies", "sell"]), walker.C.stats.tixOut, walker.C.stats.sold, pickK(day().econ.tixIn, ["dailies", "sell"]), day().econ.tixOut, day().econ.sold.stardust, day().econ.ex.ruby], [{ dailies: 300, sell: 80 }, { store: 150 }, { stardust: 4 }, { dailies: 300, sell: 80 }, { store: 150 }, [4, 80], [3, 900]], "in by source, out by sink, sold and traded, on the character and the day");

/* 4. THE DANGER PREMIUM: the same kill in the Gloam, the Wilderness and the Deep */
{ const real = Math.random; Math.random = () => 0.5;
  const pay = (scene) => { const p = player(`P${scene}`, scene, 12, 12); const t0 = G.tixIn(p.C); W.killLoot(W.scene(scene), p, { t: "potboy" }, G.MOBS.potboy, Date.now()); return G.tixIn(p.C) - t0; };
  const [g, w, d] = ["gloam", "wild", "deep"].map(pay);
  is([+(w / g).toFixed(2), +(d / g).toFixed(2)], [1.25, 1.5], `a Pot Boy's tickets: ${g} in the Gloam, ${w} in the Wilderness, ${d} in the Deep`);
  const xp = (scene) => { const p = player(`X${scene}`, scene, 12, 12, { melee: 80, hp: 80 }); const x0 = G.totalXpOf ? G.totalXpOf(p.C) : Object.values(p.C.xp).reduce((a, v) => a + v, 0); W.award(p, 20); return Object.values(p.C.xp).reduce((a, v) => a + v, 0) - x0; };
  const [xg, xw, xd] = ["gloam", "wild", "deep"].map(xp);
  is([+(xw / xg).toFixed(2), +(xd / xg).toFixed(2)], [1.25, 1.5], `20 damage's combat xp: ${xg}, ${xw}, ${xd}`);
  Math.random = real; }

/* 5. DYING IN THE WILD */
{ const real = Math.random; Math.random = () => 0.99;   /* no worn piece drops */
  const vic = player("Victim", "deep", 10, 10, {}, 40000), kil = player("Killer", "deep", 11, 10, { melee: 90 }, 0);
  const v0 = G.tixIn(vic.C), k0 = G.tixIn(kil.C), cut = Math.floor(v0 * 0.1); W.die(vic, W.scene("deep"), kil); await flush();
  const took = vic.C.stats.tixOut.robbed;   /* (a first death pays an achievement before the bill, so "10%" is of what they carried at that moment) */
  is([took >= cut && took <= cut + 20, G.tixIn(kil.C) - k0 >= took, kil.C.stats.tixIn.pvp, vic.C.stats.diedIn, vic.C.stats.diedTo], [true, true, took, { deep: 1 }, { player: 1 }], `killed by a player in the Deep: ${took} (10% of what they carried) goes to the killer`);
  is(/Killer killed you in the Deep Wild\. They took [\d,]+ tickets from your pockets/.test(vic.out.map((e) => e.text || "").join(" ")), true, "and the victim is told who took what");
  const rich = player("Rich", "wild", 10, 10, {}, 250000), r0 = G.tixIn(rich.C); W.die(rich, W.scene("wild"), { mob: "Crystal Ogre", t: "dogre" });
  is([rich.C.stats.tixOut.bill, day().where.deaths.wild, rich.C.stats.tixIn?.pvp], [10000, { dogre: 1 }, undefined], "killed by a monster in the Wilderness: the bill, capped at 10,000, and the cause is the monster");
  const pv = store.get("trk:pvp"); is([pv?.length, pv?.[0]?.k, pv?.[0]?.v, pv?.[0]?.map, pv?.[0]?.took], [1, "Killer", "Victim", "deep", took], "the player kill is on the PvP list");
  const safe = player("Safe", "gloam", 10, 10, {}, 5000), s0 = G.tixIn(safe.C); W.die(safe, W.scene("gloam"), { mob: "Bog Gnasher", t: "gnasher" });
  const sb = safe.C.stats.tixOut.bill; is(sb >= Math.floor(s0 * 0.1) && sb <= Math.floor(s0 * 0.1) + 20, true, "a death on a safe map is unchanged (the Gloam: 10%)");
  Math.random = real; }

/* 6. THE MONSTERS */
{ const lv = (k) => G.SCENES[k].mobs.map((m) => G.MOBS[m[0]].lvl), ag = (k) => G.SCENES[k].mobs.filter((m) => m[3]?.aggro ?? G.MOBS[m[0]].aggro).length;
  is([Math.min(...lv("wild")), Math.max(...lv("wild")), Math.min(...lv("deep")), Math.max(...lv("deep"))], [18, 78, 50, 93], "the Wilderness 18-78, the Deep 50-93");
  is([ag("wild"), G.SCENES.wild.mobs.length, ag("deep"), G.SCENES.deep.mobs.length], [9, 25, 11, 32], "about a third of each map attacks on sight, as before");
  is(G.SCENES.deep.mobs.some((m) => m[0] === "diron"), false, "no Iron Ogre (only the Void touches one)"); }

/* 7. WRITES: once a minute, and a restart carries on */
{ puts.length = 0; W.tickN = 1199; W.trkSecond(Date.now()); await flush(); const before = puts.length;
  W.tickN = 1200; W.trkSecond(Date.now()); await flush();
  const wrote = puts.slice(before).filter((k) => k.startsWith("trk:2")).sort();
  is([before, wrote], [0, [`trk:${G.dayKeyCT()}:econ`, `trk:${G.dayKeyCT()}:people`, `trk:${G.dayKeyCT()}:where`]], "nothing written between minutes; on the minute, the three parts that changed");
  const kills0 = store.get(`trk:${G.dayKeyCT()}:where`).kills.gloam.gnasher;
  const W2 = await mk(); W = W2; W.trkDay(); await flush(); W.trkEvent(fighter, "kill", { mob: "gnasher" });
  is(W.trkDay().where.kills.gloam.gnasher, kills0 + 1, "after a restart the day picks up where the last write left it"); }

/* 7b. THE WORLD DATA WINDOW's report: the days added up, ids sent only as counts, the maps named */
{ W.trkLogin(fighter, true); W.trkRep = {}; const R = await W.trkReport(1);
  is([R.n, R.days.length, typeof R.where.who.workyard, R.names.gloam, R.people.players > 0, Array.isArray(R.series) && R.series.length === 1, JSON.stringify(R).includes('"t1"')], [1, 1, "number", G.SCENES.gloam.name, true, true, false], "today's report: counts, not ids; map names; one day in the series");
  const R7 = await W.trkReport(7); is([R7.days.length, R7.series.length, R7.people.sessions >= R.people.sessions], [7, 7, true], "seven days: seven in the series, the totals at least today's"); }

/* 7c. MY STATS: the asker's own numbers, nobody else's */
{ const M = W.myStats(fighter); is([M.type, M.name, M.t.gloam?.f > 0, M.kills.gnasher, "who" in M, M.names.gloam], ["mystats", "Fighter", true, 1, false, G.SCENES.gloam.name], "My stats: your own time by map, kills and map names, and no list of other people"); }

/* 8. THE TURN OF THE DAY */
{ store.set("trk:2020-01-01:where", { old: true });
  W.trk.cur.day = "2026-01-01"; W.trkDay(); await flush(); await flush();
  const e = store.get("trk:2026-01-01:econ-held");
  is([!!e, e?.total > 0, e?.holders > 0, store.has("trk:2020-01-01:where")], [true, true, true, false], "the old day is written, the economy measured for it, and days past 120 go"); }

console.log(bad ? `\n${bad} problem(s)` : "\nThe world records it all without a save of its own; the Wild pays and costs what it should");
process.exitCode = bad ? 1 : 0;
