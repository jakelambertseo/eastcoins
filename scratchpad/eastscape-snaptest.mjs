/* The roster/snapshot split. The risk in this change is not that it is slow —
   it is that a name goes missing, or the roster stops being re-sent when
   something does change. Both are tested here.
   Run: node scratchpad/eastscape-snaptest.mjs */
import { World } from "../eastscape-worker/src/index.js";
import * as G from "../v3/assets/js/eastscape-shared.js";

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log("  ok  " + n); } else { fail++; console.log("FAIL  " + n + (x ? "  -> " + x : "")); } };

function makeCtx() {
  const map = new Map();
  return { _map: map, blockConcurrencyWhile: (f) => f(), storage: {
    async get(k) { return map.get(k); },
    async put(a, b) { if (a && typeof a === "object") { for (const k in a) map.set(k, a[k]); } else map.set(a, b); },
    async delete(k) { return map.delete(k); }, async list() { return new Map(); } } };
}
const WS = () => ({ sent: [], send(m) { this.sent.push(typeof m === "string" ? JSON.parse(m) : m); }, addEventListener() {}, close() {} });
const of = (ws, type) => ws.sent.filter((m) => m.type === type);
const last = (ws, type) => of(ws, type).at(-1);

// the page's own merge, copied so the test proves the two halves fit together
const NOBODY = { name: "…", lvl: 1, level: 1, weapon: null, body: null, maxHp: 10 };
const merge = (roster, e) => ({ ...NOBODY, ...(roster.get(e.id) || null), ...e });

async function world(n = 3) {
  const ctx = makeCtx(); const w = new World(ctx, { DEV: "1" });
  await new Promise((r) => setTimeout(r, 0));
  const socks = [];
  for (let i = 0; i < n; i++) { const ws = WS(); socks.push(ws); await w.join({ id: `u${i}`, login: `p${i}`, name: `Player${i}`, admin: false }, ws); }
  w.stop();
  return { w, ctx, socks };
}

console.log("\n-- joining --");
{
  const { socks } = await world(1);
  const types = socks[0].sent.map((m) => m.type);
  ok("a roster arrives", types.includes("who"));
  ok("before the first snapshot", types.indexOf("who") < types.indexOf("snap"), types.join(","));
  const who = last(socks[0], "who").who.find((x) => x.id === "u0");
  ok("carrying the name", who.name === "Player0", JSON.stringify(who));
  ok("the level, gear and max hp", who.lvl > 0 && "weapon" in who && who.maxHp > 0, JSON.stringify(who));
}

console.log("\n-- the snapshot is slim --");
{
  const { socks } = await world(1);
  const p = last(socks[0], "snap").players[0];
  for (const k of ["name", "lvl", "weapon", "body", "maxHp"]) ok(`no "${k}" in the snapshot`, !(k in p), JSON.stringify(p));
  ok("but position is", "x" in p && "y" in p);
  ok("and hp is", "hp" in p);
  ok("falsy fields are dropped", !("act" in p) && !("mob" in p) && !("started" in p), JSON.stringify(p));
}

console.log("\n-- a position or hp of zero survives the trim --");
{
  const { w, socks } = await world(1);
  const pl = w.pls.get("u0");
  pl.x = 0; pl.y = 0; pl.C.hp = 0;
  socks[0].sent.length = 0;
  w.broadcast(Date.now());
  const p = last(socks[0], "snap").players[0];
  ok("x: 0 is sent", p.x === 0, JSON.stringify(p));
  ok("y: 0 is sent", p.y === 0);
  ok("hp: 0 is sent", p.hp === 0);
}

console.log("\n-- the two halves reconstruct the old record --");
{
  const { w, socks } = await world(2);
  w.broadcast(Date.now());
  const roster = new Map(last(socks[0], "who").who.map((x) => [x.id, x]));
  const merged = last(socks[0], "snap").players.map((p) => merge(roster, p));
  const me = merged.find((p) => p.id === "u1");
  ok("name is back", me.name === "Player1", JSON.stringify(me));
  ok("level is back", me.lvl > 0);
  ok("weapon is back", me.weapon === "rudis", String(me.weapon));
  ok("body is back", me.body === "tunic");
  ok("max hp is back", me.maxHp === G.maxHpOf(w.pls.get("u1").C));
  ok("hp came from the snapshot", me.hp === w.pls.get("u1").C.hp);
}

console.log("\n-- the roster is only re-sent when it changes --");
{
  const { w, socks } = await world(2);
  w.broadcast(Date.now());
  socks[0].sent.length = 0;
  for (let i = 0; i < 20; i++) w.broadcast(Date.now());
  ok("20 quiet broadcasts send no roster", of(socks[0], "who").length === 0, String(of(socks[0], "who").length));
  ok("but still send snapshots", of(socks[0], "snap").length === 20);
}

console.log("\n-- and IS re-sent when something static changes --");
{
  const cases = [
    ["someone equips something", (w) => { const pl = w.pls.get("u1"); pl.C.eq.weapon = "bronzesword"; } ],
    ["someone levels up", (w) => w.grant(w.pls.get("u1"), "melee", 5000)],
    ["max hp changes", (w) => w.grant(w.pls.get("u1"), "hp", 5000)]
  ];
  for (const [name, change] of cases) {
    const { w, socks } = await world(2);
    w.broadcast(Date.now());
    socks[0].sent.length = 0;
    w.broadcast(Date.now());
    ok(`quiet first (${name})`, of(socks[0], "who").length === 0);
    change(w);
    w.broadcast(Date.now());
    ok(name, of(socks[0], "who").length === 1, `${of(socks[0], "who").length} rosters`);
  }
}

console.log("\n-- somebody walking in or out --");
{
  const { w, socks } = await world(2);
  w.broadcast(Date.now());
  socks[0].sent.length = 0;
  const ws = WS(); await w.join({ id: "u9", login: "p9", name: "Newcomer" }, ws); w.stop();
  w.broadcast(Date.now());
  const r = last(socks[0], "who");
  ok("the people already there get a new roster", !!r, "none sent");
  ok("with the newcomer in it", r.who.some((x) => x.id === "u9" && x.name === "Newcomer"), JSON.stringify(r?.who?.map((x) => x.name)));
  const ids = last(socks[0], "snap").players.map((p) => p.id);
  ok("and the snapshot knows them too", ids.includes("u9"), ids.join(","));

  socks[0].sent.length = 0;
  await w.leave(w.pls.get("u9"));
  w.broadcast(Date.now());
  ok("leaving sends a roster as well", of(socks[0], "who").length === 1);
  ok("without them in it", !last(socks[0], "who").who.some((x) => x.id === "u9"));
}

console.log("\n-- bots keep the field names the page reads --");
{
  const { w, socks } = await world(1);
  w.broadcast(Date.now());
  const roster = new Map(last(socks[0], "who").who.map((x) => [x.id, x]));
  const snapBots = last(socks[0], "snap").bots;
  if (!snapBots.length) console.log("  (no bots in the starting scene; skipped)");
  else {
    const b = merge(roster, snapBots[0]);
    ok("a bot has a name", typeof b.name === "string" && b.name !== "…", JSON.stringify(b));
    ok("a bot has `level`, not `lvl`", typeof b.level === "number" && b.level > 1, JSON.stringify(b));
    ok("a bot keeps its art", "art" in b);
    for (const k of ["name", "level", "art", "hue"]) ok(`"${k}" is not in the bot snapshot`, !(k in snapBots[0]), JSON.stringify(snapBots[0]));
  }
}

console.log("\n-- an unknown id still draws --");
{
  const roster = new Map();
  const drawn = merge(roster, { id: "ghost", x: 3, y: 4, hp: 7 });
  ok("it gets a placeholder name", drawn.name === "…", JSON.stringify(drawn));
  ok("and does not blow up on level", drawn.lvl === 1);
  ok("its position is intact", drawn.x === 3 && drawn.y === 4);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
