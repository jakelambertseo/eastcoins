/* The backup and restore path, round-tripped against the real World class.
   Run: node scratchpad/eastscape-backuptest.mjs */
import { World } from "../eastscape-worker/src/index.js";

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log("  ok  " + n); } else { fail++; console.log("FAIL  " + n + (x ? "  -> " + x : "")); } };

function makeCtx(seed = {}) {
  const map = new Map(Object.entries(seed));
  return { _map: map, blockConcurrencyWhile: (fn) => fn(), storage: {
    async get(k) { return map.get(k); },
    async put(a, b) { if (a && typeof a === "object") { for (const k in a) map.set(k, a[k]); } else map.set(a, b); },
    async delete(k) { return map.delete(k); },
    async list({ prefix = "", startAfter, limit = 1000 } = {}) {
      const out = new Map();
      for (const k of [...map.keys()].sort()) {
        if (prefix && !k.startsWith(prefix)) continue;
        if (startAfter !== undefined && k <= startAfter) continue;
        if (out.size >= limit) break;
        out.set(k, map.get(k));
      }
      return out;
    } } };
}
const WS = () => ({ sent: [], closed: null, send(m) { this.sent.push(typeof m === "string" ? JSON.parse(m) : m); }, addEventListener() {}, close(c) { this.closed = c; } });
const ENV = { DEV: "1", ALLOWED_ORIGINS: "", SITE: "" };

async function world(n = 2, seed) {
  const ctx = makeCtx(seed); const w = new World(ctx, ENV);
  await new Promise((r) => setTimeout(r, 0));
  const socks = [];
  for (let i = 0; i < n; i++) { const ws = WS(); socks.push(ws); await w.join({ id: `u${i}`, login: `p${i}`, name: `P${i}`, admin: true }, ws); }
  w.stop();
  return { w, ctx, socks };
}
const post = (w, path, body) => w.fetch(new Request(`https://world${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }));

console.log("\n-- export --");
let snapshot = null;
{
  const { w, ctx } = await world(2);
  const pl = w.pls.get("u1");
  w.give(pl, "geode", 5);
  w.grant(pl, "mining", 1234);
  ok("the change is unsaved before the export", !ctx._map.get("char:u1"));

  const dump = await (await post(w, "/export")).json();
  snapshot = dump;
  ok("it reports ok", dump.ok === true);
  ok("it saved everyone first", !!ctx._map.get("char:u1"));
  ok("the unsaved change is in it", dump.data["char:u1"].inv.some((s) => s.k === "geode" && s.n === 5), JSON.stringify(dump.data["char:u1"].inv));
  ok("the xp is in it", dump.data["char:u1"].xp.mining === 1234);
  ok("it carries both characters", !!dump.data["char:u0"] && !!dump.data["char:u1"]);
  ok("and the Exchange", !!dump.data.exchange);
  ok("it stamps the save format", dump.saveVersion >= 2, String(dump.saveVersion));
  ok("it says who was online", dump.online === 2);
}

console.log("\n-- paging: a world bigger than one list() page --");
{
  const seed = {};
  for (let i = 0; i < 2500; i++) seed[`char:bulk${String(i).padStart(5, "0")}`] = { v: 2, xp: {}, inv: [] };
  const { w } = await world(0, seed);
  const dump = await (await post(w, "/export")).json();
  ok("every key comes back", Object.keys(dump.data).length >= 2500, String(Object.keys(dump.data).length));
  ok("including the last one", !!dump.data["char:bulk02499"]);
}

console.log("\n-- restore is a dry run by default --");
{
  const { w, ctx } = await world(0);
  const before = new Map(ctx._map);
  const r = await (await post(w, "/restore", { data: snapshot.data })).json();
  ok("it says so", r.dryRun === true, JSON.stringify(r));
  ok("it counts what it would do", r.would === Object.keys(snapshot.data).length);
  ok("and wrote nothing", ctx._map.size === before.size);
}

console.log("\n-- restore refuses while anyone is connected --");
{
  const { w } = await world(1);
  const res = await post(w, "/restore?apply=yes", { data: snapshot.data });
  const r = await res.json();
  ok("it is refused", r.ok === false && r.code === "PLAYERS_ONLINE", JSON.stringify(r));
  ok("with a 409", res.status === 409);
  ok("and says how many", r.online === 1);
}

console.log("\n-- the round trip --");
{
  const { w, ctx } = await world(0);
  ctx._map.clear();                                  // the disaster
  ok("the world is empty", ctx._map.size === 0);
  const r = await (await post(w, "/restore?apply=yes", { data: snapshot.data, takenAt: snapshot.takenAt })).json();
  ok("it reports what it wrote", r.ok === true && r.restored === Object.keys(snapshot.data).length, JSON.stringify(r));
  const back = ctx._map.get("char:u1");
  ok("the character is back", !!back);
  ok("with its items", back.inv.some((s) => s.k === "geode" && s.n === 5), JSON.stringify(back?.inv));
  ok("and its xp", back.xp.mining === 1234);
  ok("the Exchange is back", !!ctx._map.get("exchange"));

  // and it is still loadable as a character, not just as bytes
  const ws = WS();
  await w.join({ id: "u1", login: "p1", name: "P1" }, ws); w.stop();
  const pl = w.pls.get("u1");
  ok("it loads into the game", pl.C.xp.mining === 1234 && pl.C.inv.some((s) => s.k === "geode" && s.n === 5));
}

console.log("\n-- restoring one person --");
{
  const { w, ctx } = await world(0);
  ctx._map.clear();
  const r = await (await post(w, "/restore?apply=yes&only=char:u1", { data: snapshot.data })).json();
  ok("only the matching keys are written", r.restored === 1, JSON.stringify(r));
  ok("that one is there", !!ctx._map.get("char:u1"));
  ok("the others are not", !ctx._map.get("char:u0") && !ctx._map.get("exchange"));
}

console.log("\n-- bad input --");
{
  const { w } = await world(0);
  const a = await (await post(w, "/restore", {})).json();
  ok("an empty body is refused", a.ok === false && a.code === "NO_DATA", JSON.stringify(a));
  const b = await (await post(w, "/restore?only=nope:", { data: snapshot.data })).json();
  ok("a prefix that matches nothing is refused", b.ok === false && b.code === "NOTHING_MATCHED", JSON.stringify(b));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
