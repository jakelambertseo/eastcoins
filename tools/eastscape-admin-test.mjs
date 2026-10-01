/* THE ADMIN WINDOW, the server's half —  node tools/eastscape-admin-test.mjs
   (2026-10-01, v1.1) The real World, storage stubbed:
     - admstate: what's running (2X after a start, then off after a stop), who's online, the log, and `can` (null for an admin, the canRun
       list for a moderator);
     - the log: server-wide and about-somebody commands are written (who, what, the minutes), testing commands are not, and it keeps 50;
     - a moderator can read the state and a player card but can't start 2X (refused before it is logged);
     - admplayer: an online player's card (hours, tickets, levels) and the Bom gear a refund could take back; a name nobody has used. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ok  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !!  ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ok = (c, what) => is(!!c, true, what);
const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) store.set(a, b); else store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "1" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const S = W.scene("workyard");
let n = 0;
function player(role, name) {
  const C = G.freshChar(); C.scene = S.key; C.hp = G.maxHpOf(C);
  const id = `p${++n}`, pl = { id, login: name.toLowerCase(), name, role, ws: { send() {}, close() {} }, C, x: 10, y: 10, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now() - 600000, msgWindow: 0, msgs: 0 };
  W.pls.set(id, pl); store.set(`who:${pl.login}`, { id, name }); store.set(`char:${id}`, C); return pl;
}
const last = (pl, type) => [...pl.out].reverse().find((o) => o.type === type);
const said = (pl) => pl.out.filter((o) => o.type === "say").map((o) => o.text).pop() || "";
const admin = player("admin", "Boss"), mod = player("mod", "Helper"), joe = player("user", "Joe");
const go = async (pl, m) => { pl.out = []; pl.msgWindow = 0; pl.msgs = 0; await W.onMessage(pl, { t: "admin", ...m }); };

console.log("state");
await go(admin, { cmd: "admstate" });
let st = last(admin, "admstate");
ok(st && st.admin === true && st.can === null, "an admin's state: admin, every command");
is(st.online.map((p) => p.name).sort(), ["Boss", "Helper", "Joe"], "who's online");
is(st.dbl, null, "2X is off");
await go(admin, { cmd: "double", mins: 30 });
await go(admin, { cmd: "admstate" }); st = last(admin, "admstate");
ok(st.dbl && st.dbl.until > Date.now() + 29 * 60000, "after a start, 2X is running for 30 minutes");
is(st.log[0] && [st.log[0].who, st.log[0].cmd, st.log[0].arg], ["Boss", "double", "30"], "and the log says who and how long");
await go(admin, { cmd: "double", mins: 0 });
await go(admin, { cmd: "heal" });
await go(admin, { cmd: "admstate" }); st = last(admin, "admstate");
is(st.dbl, null, "after a stop, 2X is off");
is(st.log.map((r) => r.cmd), ["double", "double"], "testing commands (heal) aren't logged");
ok(Array.isArray(store.get("admLog")) && store.get("admLog").length === 2, "the log is kept in storage");
for (let i = 0; i < 60; i++) W.admLogAdd(admin, { cmd: "saveall" });
is(W.admLog.length, 50, "the log keeps the last 50");

console.log("a moderator");
await go(mod, { cmd: "admstate" }); const ms = last(mod, "admstate");
ok(ms && ms.admin === false && ms.can.includes("kick") && !ms.can.includes("double"), "a moderator's state lists only what they can run");
const before = W.admLog.length, logBefore = JSON.stringify(W.admLog.slice(-1));
await go(mod, { cmd: "double", mins: 30 });
ok(/admins only/.test(said(mod)) && !W.doubleOn(), "a moderator can't start 2X");
is(JSON.stringify(W.admLog.slice(-1)), logBefore, "and the refused command isn't logged");
await go(mod, { cmd: "mute", name: "Joe", n: 10 });
ok(joe.C.mutedUntil > Date.now() && W.admLog.at(-1).cmd === "mute" && W.admLog.at(-1).name === "Joe", "a moderator's mute works and is logged");

console.log("a player's card");
G.addInv(joe.C.inv, "bronze_helm", 2, joe.C);
await go(admin, { cmd: "admplayer", name: "joe" }); await new Promise((r) => setTimeout(r, 30));
const card = last(admin, "admplayer");
ok(card && card.name === "Joe" && card.online && card.mins >= 0 && card.total > 0, "Joe's card: online, hours, levels");
ok(card.muted > Date.now(), "it shows he's muted");
ok(card.bom.some((r) => r.k === "bronze_helm" && r.n >= 2 && r.price > 0), "and the Bom gear a refund could take back");
await go(admin, { cmd: "admplayer", name: "nobodyever" }); await new Promise((r) => setTimeout(r, 30));
ok(last(admin, "admplayer")?.missing, "a name nobody has used says so");

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
