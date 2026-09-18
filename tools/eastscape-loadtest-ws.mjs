#!/usr/bin/env node
/* ============================================================
   EastScape load test, over real sockets.

   The in-process one (scratchpad/eastscape-loadtest.mjs) measures
   the world's tick. This one measures everything that sits between
   a player and it: the socket, the edge, the Durable Object's real
   scheduling. Run the first one to know the logic is fine, this one
   to know the deployment is.

   Against a local dev server (no tickets needed, DEV=1):

     cd eastscape-worker && npx wrangler dev --var DEV:1
     node tools/eastscape-loadtest-ws.mjs --url ws://127.0.0.1:8787 --n 50 --secs 60

   Against production — real ZCoin-less characters, but REAL ones, so
   use throwaway logins and do it outside player hours:

     node tools/eastscape-loadtest-ws.mjs --url wss://<worker>.workers.dev --n 25 --secs 60 --ticket-url https://eastcoin.vip/api/eastscape/ticket --cookie "<your session cookie>"

   Needs Node 22+ (it uses the built-in WebSocket).
   ============================================================ */

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i === -1 ? d : argv[i + 1]; };
const URL_ = String(opt("url", "ws://127.0.0.1:8787")).replace(/\/$/, "");
const N = Number(opt("n", 25));
const SECS = Number(opt("secs", 60));
const RAMP = Number(opt("ramp", 10));           // seconds to bring everyone on, so it is not a thundering herd
const PREFIX = String(opt("prefix", "load"));
const TICKET_URL = opt("ticket-url", null);
const COOKIE = opt("cookie", null);

if (typeof WebSocket === "undefined") { console.error("Needs Node 22+ for the built-in WebSocket."); process.exit(1); }

const COLS = 22, ROWS = 13;
const rnd = (n) => Math.floor(Math.random() * n);
const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const stats = { opened: 0, failed: 0, closed: 0, msgs: 0, bytes: 0, snaps: 0, pings: 0, rtt: [], errors: new Map() };
const note = (e) => stats.errors.set(String(e), (stats.errors.get(String(e)) || 0) + 1);

async function urlFor(i) {
  if (!TICKET_URL) return `${URL_}/ws?dev=1&login=${PREFIX}${i}`;
  const r = await fetch(TICKET_URL, { method: "POST", headers: { "content-type": "application/json", ...(COOKIE ? { cookie: COOKIE } : {}) }, body: "{}" });
  if (!r.ok) throw new Error(`ticket ${r.status}`);
  const j = await r.json();
  if (!j.ok) throw new Error(j.message || "no ticket");
  return `${j.ws}?ticket=${j.ticket}`;
}

function drive(ws) {
  const timers = [];
  // a person acts every second or two, and the page pings every four
  timers.push(setInterval(() => {
    if (ws.readyState !== 1) return;
    const r = Math.random();
    if (r < 0.75) ws.send(JSON.stringify({ t: "walk", x: 1 + rnd(COLS - 2), y: 1 + rnd(ROWS - 2) }));
    else if (r < 0.97) ws.send(JSON.stringify({ t: "step", dx: rnd(3) - 1, dy: rnd(3) - 1 }));
    else ws.send(JSON.stringify({ t: "chat", text: "load test" }));
  }, 1200 + rnd(900)));
  timers.push(setInterval(() => {
    if (ws.readyState !== 1) return;
    stats.pings++;
    ws.send(JSON.stringify({ t: "ping", c: Date.now() }));
  }, 4000));
  return () => timers.forEach(clearInterval);
}

console.log(`\nEastScape socket load test\n  ${URL_}\n  ${N} players, ${SECS}s, ramped over ${RAMP}s${TICKET_URL ? " (real tickets)" : " (dev logins)"}\n`);

const conns = [];
for (let i = 0; i < N; i++) {
  (async () => {
    await sleep((i / Math.max(1, N)) * RAMP * 1000);
    let url;
    try { url = await urlFor(i); } catch (e) { stats.failed++; note(`ticket: ${e.message}`); return; }
    let ws;
    try { ws = new WebSocket(url); } catch (e) { stats.failed++; note(`open: ${e.message}`); return; }
    let stop = () => {};
    ws.addEventListener("open", () => { stats.opened++; stop = drive(ws); });
    ws.addEventListener("message", (e) => {
      const raw = typeof e.data === "string" ? e.data : "";
      stats.msgs++; stats.bytes += raw.length;
      if (raw.includes('"type":"snap"')) stats.snaps++;
      else if (raw.includes('"type":"pong"')) { try { const m = JSON.parse(raw); if (m.c) stats.rtt.push(Date.now() - m.c); } catch (err) { /* ignore */ } }
    });
    ws.addEventListener("error", () => { note("socket error"); });
    ws.addEventListener("close", (e) => { stats.closed++; stop(); if (e.code && e.code !== 1000 && e.code !== 1005) note(`close ${e.code}`); });
    conns.push(ws);
  })();
}

const started = Date.now();
const iv = setInterval(() => {
  const s = (Date.now() - started) / 1000;
  process.stdout.write(`\r  ${fmt(s)}s  open ${stats.opened - stats.closed}/${N}  msgs ${fmt(stats.msgs)}  ${fmt(stats.bytes / 1024 / Math.max(1, s))} KB/s in   `);
}, 1000);

await sleep(SECS * 1000);
clearInterval(iv);
for (const ws of conns) { try { ws.close(1000, "done"); } catch (e) { /* gone */ } }
await sleep(500);

const secs = (Date.now() - started) / 1000;
const live = Math.max(1, stats.opened - stats.failed);
stats.rtt.sort((a, b) => a - b);
const at = (p) => stats.rtt.length ? stats.rtt[Math.floor(stats.rtt.length * p)] : 0;

console.log(`\n\nconnections`);
console.log(`  opened ${stats.opened}, failed ${stats.failed}, closed ${stats.closed}`);
console.log(`\ntraffic (what the SERVER sent, as the clients saw it)`);
console.log(`  ${fmt(stats.msgs / secs)} msgs/s, ${fmt(stats.bytes / 1024 / secs)} KB/s across everyone`);
console.log(`  per player: ${fmt(stats.msgs / secs / live)} msgs/s, ${fmt(stats.bytes / 1024 / secs / live)} KB/s`);
console.log(`  snapshots: ${fmt(stats.snaps / secs / live)}/s each (the world aims for 10)`);
console.log(`\nround trip (ping to pong, ${stats.rtt.length} samples)`);
console.log(`  p50 ${at(0.5)}ms   p95 ${at(0.95)}ms   p99 ${at(0.99)}ms   max ${stats.rtt.at(-1) || 0}ms`);
if (stats.errors.size) { console.log(`\nproblems`); for (const [k, v] of stats.errors) console.log(`  ${v.toString().padStart(5)} × ${k}`); }
console.log("");
process.exit(stats.failed || at(0.95) > 400 ? 1 : 0);
