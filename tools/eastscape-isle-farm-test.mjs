/* THE ISLAND'S LIVESTOCK —  node tools/eastscape-isle-farm-test.mjs
   (2026-09-30, the owner: "add fishing cages, chicken coops, and cow pens that return fish, raw chicken and feathres, and leather/beef when
   away for awhile"). The real World with storage stubbed, the clock moved by hand:
     - Yahsmeena sells them; placing the first starts its clock, so nothing is paid for time before you had it;
     - five hours away: a coop gives 5 raw chicken and 15 feathers, and two coops fill twice as fast;
     - it stops at a day's worth (the cap), and the part-round carries over when it is emptied early;
     - a cow pen gives beef and cowhide, a fishing cage fish; a visitor cannot empty yours;
     - a full bag sends the rest to the bank. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { World } = await import("../eastscape-worker/src/index.js");
const { createDecorRules } = await import("../v3/assets/js/eastscape-decor-rules.js"); const DR = createDecorRules(G);
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
let n = 0;
function player(name) {
  const C = G.freshChar(); C.inv = []; G.addInv(C.inv, "tickets", 1000000, C);
  const id = `f${++n}`, pl = { id, login: id, name, role: "user", ws: { send() {} }, C, x: 13, y: 4, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); const key = G.isleKey(C.isle, id); W.moveToScene(pl, key, null, { x: 13, y: 4 }); return pl;
}
const count = (pl, k) => G.countItems(pl.C, [k]);
const said = (pl) => pl.out.map((e) => e.text || "").join(" | ");
const HR = 3600000;
/* 1. bought from Yahsmeena and placed: the clock starts at placing */
const a = player("Farmer"), S = W.scene(a.C.scene), I = a.C.isle;
W.onMessage(a, { t: "decor", op: "buy", k: "coop" });
/* a spot the rules accept, found first, then ONE place message (a loop of them would trip the message limit) */
const fit = (k) => { const P = DR.DECOR[k], onMe = (x, y) => [...W.pls.values()].some((p) => p.C.scene === S.key && p.x >= x && p.x < x + P.w && p.y >= y && p.y < y + P.h); for (let y = 4; y < 22; y++) for (let x = 12; x < 34; x++) if (!DR.decorFits(S.key, I, k, x, y) && !onMe(x, y)) return [x, y]; return null; };   /* (never on anybody's head: the server refuses that) */
const place = (k) => { const at = fit(k); if (at) { a.msgs = 0; a.out = []; W.onMessage(a, { t: "decor", op: "place", k, x: at[0], y: at[1] }); } return at; };
const placed = place("coop");
is([I.owned.coop, !!placed, Number.isFinite(I.farm?.coop)], [1, true, true], `a coop bought from Yahsmeena and placed at ${placed}: its clock has started`);
const ob = () => S.objs.find((o) => o.t === "farm" && o.farm === "coop");
a.out = []; W.farmCollect(S, a, ob()); is([count(a, "chicken"), /Nothing in the chicken coop yet/.test(said(a))], [0, true], "straight away: nothing yet, and how long");
/* 2. five hours: 5 chicken, 15 feathers */
I.farm.coop = Date.now() - 5 * HR - 60000; W.farmCollect(S, a, ob());
is([count(a, "chicken"), count(a, "feather")], [5, 15], "five hours away: 5 raw chicken and 15 feathers");
is(Date.now() - I.farm.coop < HR && Date.now() - I.farm.coop >= 60000, true, "the minute past the fifth hour carries over to the next round");
/* 3. a day and more: the cap */
const c0 = count(a, "chicken"); I.farm.coop = Date.now() - 60 * HR; W.farmCollect(S, a, ob()); is(count(a, "chicken") - c0, 24, "sixty hours away: a day's worth (24), no more");
/* 4. two coops fill twice as fast */
I.owned.coop = 2; place("coop"); const two = I.decor.filter((d) => d.k === "coop").length === 2;
const c1 = count(a, "chicken"); I.farm.coop = Date.now() - 3 * HR - 1000; W.farmCollect(S, a, ob()); is([two, count(a, "chicken") - c1], [true, 6], "two coops, three hours: 6 raw chicken");
/* 5. the cow pen and the fishing cage */
for (const k of ["cowpen", "cage"]) { I.owned[k] = 1; place(k); if (!I.decor.some((d) => d.k === k)) { console.log(`  !! could not place a ${k}: ${said(a).slice(-160)}`); bad++; } }
I.farm.cowpen = Date.now() - 3 * HR - 1000; W.farmCollect(S, a, S.objs.find((o) => o.farm === "cowpen")); is([count(a, "beef"), count(a, "hide")], [2, 2], "a cow pen, three hours: 2 raw beef and 2 cowhides");
const fish0 = ["sardine", "trout", "catfish"].reduce((s, k) => s + count(a, k), 0); I.farm.cage = Date.now() - 3 * HR - 1000; W.farmCollect(S, a, S.objs.find((o) => o.farm === "cage"));
is(["sardine", "trout", "catfish"].reduce((s, k) => s + count(a, k), 0) - fish0, 4, "a fishing cage, three hours: 4 fish");
/* 6. a visitor cannot empty it */
const v = player("Visitor"); W.moveToScene(v, a.C.scene, null, { x: 13, y: 4 }); I.farm.coop = Date.now() - 4 * HR; v.out = []; W.farmCollect(S, v, ob());
is([count(v, "chicken"), /Farmer's chicken coop: \d+ rounds? waiting/.test(said(v))], [0, true], "a visitor is told whose it is and how full, and takes nothing");
/* 7. a full bag: the rest goes to the bank */
a.C.inv = []; G.addInv(a.C.inv, "tickets", 1, a.C); for (let i = 0; a.C.inv.length < G.bagMax(a.C) && i < 200; i++) a.C.inv.push({ k: "logs", n: 1 });
const bank0 = (a.C.bank.find((b) => b.k === "chicken")?.n || 0); I.farm.coop = Date.now() - 4 * HR; W.farmCollect(S, a, ob());
is((a.C.bank.find((b) => b.k === "chicken")?.n || 0) - bank0 > 0, true, "a full bag: the chicken goes to the bank");
console.log(bad ? `\n${bad} problem(s)` : "\nThe livestock holds: bought, placed, filling while you're away, capped, doubled, and never emptied by a visitor");
process.exitCode = bad ? 1 : 0;
