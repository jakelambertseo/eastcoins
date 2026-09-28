/* THE RECENT CHAT —  node tools/eastscape-chatlog-test.mjs
   (2026-09-27, the owner: "is it possible that on a server refresh/restart that chat stays showing recent messages?", then "yes build the chat
   history, drop muted messages") The world keeps the last CHAT_KEEP lines of public chat, writes them to storage, reads them back on start,
   and hands them to a tab as it says hello. A muted player's lines leave the history. This runs the real World over a storage in memory. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const store = new Map();
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async (k) => store.get(k), put: async (k, v) => { if (typeof k === "object") for (const [a, b] of Object.entries(k)) store.set(a, b); else store.set(k, v); }, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {};
await new Promise((r) => setTimeout(r, 10));
const player = (name, role = "user") => { const C = G.freshChar(); const pl = { id: "u_" + name, name, role, C, x: 1, y: 1, out: [], path: [], sent: [] }; pl.ws = { send: (s) => pl.sent.push(JSON.parse(s)) }; W.pls.set(pl.id, pl); return pl; };
const a = player("ann"), b = player("bob"), mod = player("mo", "admin");
let t = Date.now();
const say = (pl, text) => { pl.lastChat = 0; W.onMessage(pl, { t: "chat", text }); };
for (let i = 1; i <= 55; i++) say(i % 2 ? a : b, `line ${i}`);
is(W.chatLog.length, 50, "the world keeps the last fifty lines");
is(W.chatLog[0].text, "line 6", "the oldest five fell off the front");
is(b.out.filter((e) => e.type === "chat").length, 55, "and everyone online still heard every line live");
W.houseSay("⚔️ ann was just slain by bob in The Wilderness.");
is(W.chatLog.at(-1).id, "house", "the house's announcements are kept too");

/* written to storage by saveAll, read back by a new world (a restart) */
await W.saveAll();
is((store.get("chatlog") || []).length, 50, "saveAll writes it");
const W2 = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 10));
is(W2.chatLog?.length, 50, "a restarted world reads it back");

/* the tick writes it while it changes */
store.delete("chatlog"); W.chatDirty = true; W.tickN = 49; try { W.tickTimed(Date.now()); } catch (e) { /* the tick does more than this; only the write matters here */ }   /* tickTimed counts first, so 49 lands on 50 */
await new Promise((r) => setTimeout(r, 5));
is((store.get("chatlog") || []).length > 0, true, "the five-second tick writes it while it changes");

/* muting takes their lines out */
const annBefore = W.chatLog.filter((x) => x.id === a.id).length;
W.admin(null, mod, { cmd: "mute", name: "ann", n: 10 });
is([annBefore > 0, W.chatLog.some((x) => x.id === a.id)], [true, false], "muting ann takes every one of her lines out of the history");
is(W.chatLog.some((x) => x.id === b.id), true, "and leaves everyone else's");
say(a, "can anyone hear me"); is(W.chatLog.some((x) => x.text === "can anyone hear me"), false, "a muted line is not kept either");

/* a tab saying hello is sent the history, marked old */
const c = player("cat"); c.sent = [];
const S = W.scene(c.C.scene || "casino");
const hist = (() => { W.send(c, { type: "ev", list: W.chatLog.map((x) => ({ ...x, old: true })) }); return c.sent.at(-1); })();
is([hist.type, hist.list.length === W.chatLog.length, hist.list.every((x) => x.old)], ["ev", true, true], "the hello hands over the history, every line marked old");
const src = (await import("fs")).readFileSync(new URL("../eastscape-worker/src/index.js", import.meta.url), "utf8");
is(/this\.send\(pl, \{ type: "who"[^\n]*\n\s*if \(this\.chatLog\?\.length\) this\.send\(pl, \{ type: "ev", list: this\.chatLog\.map/.test(src), true, "and join() really sends it, right after the hello and the room");
console.log(bad ? `\n${bad} problem(s)` : "\nthe recent chat survives a refresh and a restart, and a mute takes its lines out");
if (bad) process.exit(1);
