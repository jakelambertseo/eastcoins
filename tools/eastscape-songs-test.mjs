/* EastScape: the jukebox's song queue —  node tools/eastscape-songs-test.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   The dev admin (bootypaper) and one ordinary player stand at the casino's jukebox and the v96 rules are checked over the real
   socket: a song costs RADIO.song.cost and only once YouTube has vouched for it, junk ids and over-long videos cost nothing,
   the room is told { id, at, dur }, somebody else can't skip your song and you can. It asks the site's live music worker about
   two real videos (one quota unit each, cached a day) and never touches a ZCoin. */
import * as G from "../v3/assets/js/eastscape-shared.js";
const URL_ = (n, plain) => `ws://127.0.0.1:8787/ws?dev=1${plain ? "&plain=1" : ""}&login=${n}`, wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
function player(name, plain = true) {
  const ws = new WebSocket(URL_(name, plain), { headers: { Origin: "http://localhost:4321" } }), p = { name, ws, you: null, me: null, ev: [] };
  p.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`can't reach the game server for ${name}: is wrangler dev running on 8787 with DEV:1?`)); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello") { p.you = m.you; p.me = m.me; } else if (m.type === "me") p.me = m.me; for (const x of m.list || m.ev || []) p.ev.push(x); if (m.type && !["hello", "me", "snap", "who"].includes(m.type)) p.ev.push(m); };
  p.send = (m) => ws.send(JSON.stringify(m)); p.saw = (type, f = () => true) => p.ev.some((x) => x.type === type && f(x)); p.last = (type) => [...p.ev].reverse().find((x) => x.type === type); p.clear = () => { p.ev = []; };
  p.tix = () => (p.me ? G.tixIn(p.me) : 0); return p;
}
const SONG = "dQw4w9WgXcQ" /* 3:34 */, LONG = "jfKfPfyJRdk" /* a live stream: lofi girl */;
const tag = Date.now().toString(36).slice(-5), A = player("bootypaper", false), B = player(`song_b_${tag}`);
await Promise.all([A.open, B.open]); await wait(1500);
const juke = G.buildScene("casino").objs.find((o) => o.t === "jukebox");
A.send({ t: "admin", cmd: "tp", scene: "casino", x: juke.x, y: juke.y + 1 }); B.send({ t: "walk", x: juke.x + 1, y: juke.y + 1 }); await wait(9000);
// start clean: take off anything a previous run left on
for (let i = 0; i < 12; i++) { const s = A.last("song"); if (s?.song) A.send({ t: "radio", op: "skip", id: s.song.id }); else if (s?.queue?.length) A.send({ t: "radio", op: "skip", id: s.queue[0].id, n: 0 }); else if (s) break; else A.send({ t: "act", kind: "ob", ob: juke.id }); await wait(500); }
A.send({ t: "admin", cmd: "item", k: "tickets", n: 1000 }); await wait(1000);

B.clear(); const b0 = B.tix(); B.send({ t: "radio", op: "song", id: SONG }); await wait(2500);
check(`short of ${G.RADIO.song.cost} tickets: refused and nothing charged`, B.tix() === b0 && b0 < G.RADIO.song.cost && !B.saw("song", (x) => x.song), `B has ${b0}`);
A.clear(); let a0 = A.tix(); A.send({ t: "radio", op: "song", id: "AAAAAAAAAAA" }); await wait(4000);
check("an id YouTube doesn't know costs nothing", A.tix() === a0 && !A.saw("song", (x) => x.song));
A.clear(); a0 = A.tix(); A.send({ t: "radio", op: "song", id: LONG }); await wait(4000);
check("a live stream costs nothing", A.tix() === a0 && !A.saw("song", (x) => x.song), JSON.stringify(A.ev.filter((x) => x.type === "say").slice(-1)));
A.clear(); B.clear(); a0 = A.tix(); A.send({ t: "radio", op: "song", id: SONG }); await wait(5000);
const told = B.last("song");
check("a real song charges exactly the price", a0 - A.tix() === G.RADIO.song.cost, `${a0} -> ${A.tix()}`);
check("the room is told the video, who paid, when it started and how long it is", told?.song?.id === SONG && told.song.by === "bootypaper" && Math.abs(Date.now() - told.song.at) < 15000 && told.song.dur > 200 && /Rick Astley/.test(told.song.title), JSON.stringify(told));
A.clear(); a0 = A.tix(); A.send({ t: "radio", op: "song", id: SONG }); await wait(2000);
check("the same song can't be queued twice, and isn't charged", A.tix() === a0);
B.clear(); B.send({ t: "radio", op: "skip", id: SONG }); await wait(1200);
check("somebody else can't skip your song", B.last("song") === undefined || B.last("song")?.song?.id === SONG);
A.clear(); B.clear(); A.send({ t: "radio", op: "skip", id: SONG }); await wait(1500);
check("you can skip your own", B.last("song")?.song === null);
A.ws.close(); B.ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
