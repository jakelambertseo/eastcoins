/* CHAT COMMANDS —  node tools/eastscape-commands-test.mjs
   (2026-09-30, the owner: "/find [x] ie find rotten tomatoes, /find ruby, /find the yard … tell them WHERE things are", then "come up with some helpful
   ones, build those"). The real World, the real chat handler: every command answers the one who typed it and is never broadcast, a /typo is
   answered rather than said to everyone, and /find says where, from where you stand. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {}; W.houseSay = () => {};
let n = 0;
function player(name, scene, x, y) {
  const C = G.freshChar(); C.inv = []; G.addInv(C.inv, "tickets", 500, C);
  const id = `c${++n}`, pl = { id, login: id, name, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  W.pls.set(id, pl); W.moveToScene(pl, scene, null, { x, y }); return pl;
}
const heard = [], orig = W.broadcastChat; let chatOut = 0;
const me = player("Asker", "workyard", 20, 13), you = player("Bystander", "workyard", 22, 13);
const say = (text) => { me.out = []; you.out = []; me.lastChat = 0; me.msgs = 0; W.onMessage(me, { t: "chat", text }); return me.out; };
const pop = (out) => out.find((e) => e.type === "popup");
const line = (out) => out.map((e) => e.text || "").join(" | ");
const heardBy = (p) => p.out.some((e) => e.type === "chat" && e.id === me.id);

/* /find */
{ const p = pop(say("/find ruby")); is([p?.title, /Found now and then while mining copper ore .* in the Yard/.test(p?.text)], ["Where to find: Ruby", true], "/find ruby: where, not what"); }
{ const p = pop(say("/find rotten tomatoes")); is([/^Where to find: Rotten Tomato/.test(p?.title || ""), /the Yard|The Yard/.test(p?.text || "")], [true, true], "/find rotten tomatoes: plural and all"); }
{ const p = pop(say("/find the yard")); is([p?.title, /You're standing in it/.test(p?.text || "")], ["Where to find: The Yard", true], "/find the yard, from the Yard"); }
{ W.moveToScene(me, "mire", null, { x: 20, y: 12 }); const p = pop(say("/find the yard")); is(/From here: east to the Gloam, east to the Yard/.test(p?.text || ""), true, "/find the yard, from the Lantern Mire: the way back"); W.moveToScene(me, "workyard", null, { x: 20, y: 13 }); }
{ const p = pop(say("/find mining")); is([p?.title, /Level 1: Copper ore/.test(p?.text || "")], ["Where to train: Mining", true], "/find mining: where to train it"); }
{ const o = say("/find zzzqqq"); is([!pop(o), /Nothing called "zzzqqq"/.test(line(o))], [true, true], "/find nonsense: told, kindly"); }
is(heardBy(you), false, "nobody else heard any of it");
/* the rest */
{ const p = pop(say("/help")); is(G.COMMANDS.filter((c) => !c.season).every((c) => p?.text.includes(c.c)), true, "/help lists every command"); }
{ const p = pop(say("/price ruby")); is([p?.title, /Prize Counter/.test(p?.text || ""), /Exchange/.test(p?.text || "")], ["Price: Ruby", true, true], "/price ruby: the counter and the Exchange"); }
{ G.addInv(me.C.inv, "feather", 30, me.C); me.C.bank.push({ k: "feather", n: 12 }); is(/Feather: 42 \(30 in your bag, 12 in your bank\)/.test(line(say("/count feathers"))), true, "/count feathers: bag and bank"); }
{ me.C.xp.fishing = G.XP_AT[12] + 10; is(/Fishing: level 12, .* xp to level 13/.test(line(say("/xp fishing"))), true, "/xp fishing"); is(/Total level \d+ across \d+ skills, Combat \d+/.test(line(say("/xp"))), true, "/xp on its own: the total"); }
{ const p = pop(say("/timers")); is(p?.title, "Your timers", "/timers"); }
{ const p = pop(say("/bosses")); is([p?.title, /Old Rex/.test(p?.text || "")], ["World bosses", true], "/bosses names the open bosses"); }
{ is(say("/wiki breeding").find((e) => e.type === "ui"), { type: "ui", open: "wiki", q: "breeding" }, "/wiki opens the wiki"); is(say("/map").some((e) => e.type === "ui" && e.open === "map"), true, "/map opens the map"); }
{ const o = say("/online"); is([/2 online, 2 active/.test(line(o)), o.some((e) => e.open === "who")], [true, true], "/online: a count, and the list opens"); }
{ say("/roll 6"); const r = you.out.find((e) => /Asker rolls [1-6] \(1 to 6\)/.test(e.text || "")); is(!!r, true, "/roll 6: the people around you see it"); }
{ is(/not stuck/.test(line(say("/stuck"))), true, "/stuck on open ground: nothing moves"); me.x = 0; me.y = 0; say("/stuck"); is(G.walkableIn(W.scene("workyard").g, me.x, me.y), true, "/stuck in a wall: onto open ground"); }
{ const o = say("/fnd ruby"); is([/There's no \/fnd command\. \/help lists them all/.test(line(o)), heardBy(you)], [true, false], "a /typo is answered, and nobody else hears it"); }
{ say("hello everyone"); is(heardBy(you), true, "ordinary chat still goes out"); }
console.log(bad ? `\n${bad} problem(s)` : "\nThe commands hold: /find says where, from where you stand; every answer is yours alone; a typo is never public");
process.exitCode = bad ? 1 : 0;
