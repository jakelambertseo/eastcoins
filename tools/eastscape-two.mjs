/* EastScape: two players at once —  node tools/eastscape-two.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   WHY (2026-09-20). Everything that makes this a community game happens BETWEEN two people, and for weeks it had only ever been
   looked at with one. This signs two dev players in over the real socket and checks what each one is told about the other:
   looks, emotes, big-win callouts (and their fences), a trade request, the mirror rule. It never touches the site or a ZCoin. */
const URL_ = (n) => `ws://127.0.0.1:8787/ws?dev=1&plain=1&login=${n}`, wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
function player(name) {
  const ws = new WebSocket(URL_(name), { headers: { Origin: "http://localhost:4321" } }),   /* (the game server only answers the page's own origins) */ p = { name, ws, you: null, me: null, who: [], ev: [], send: (m) => ws.send(JSON.stringify(m)), open: null };
  p.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`can't reach the game server for ${name}: is wrangler dev running on 8787 with DEV:1?`)); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello") { p.you = m.you; p.me = m.me; } else if (m.type === "me") p.me = m.me; else if (m.type === "who") p.who = m.who; else if (m.type === "ev") p.ev.push(...m.list); };
  p.saw = (type, f = () => true) => p.ev.some((x) => x.type === type && f(x)); p.clear = () => { p.ev = []; };
  return p;
}
const tag = Date.now().toString(36).slice(-5), A = player(`two_a_${tag}`), B = player(`two_b_${tag}`);
await Promise.all([A.open, B.open]); await wait(1500);
check("both are signed in and told who they are", !!A.you?.id && !!B.you?.id && A.you.id !== B.you.id);
check("a new character has no look yet (so the page will ask)", A.me?.look === null && B.me?.look === null, JSON.stringify(A.me?.look));
check("each is in the other's roster", A.who.some((w) => w.id === B.you.id) && B.who.some((w) => w.id === A.you.id));

const lookA = [2, 5, 1, 0, 0, 3, 3, 0];   /* (eight numbers since the beard slot: a seven-number look is read as clean-shaven) */ A.send({ t: "look", look: lookA }); await wait(2500);
check("A's first look is taken anywhere and confirmed to A", A.saw("lookset") && JSON.stringify(A.me?.look) === JSON.stringify(lookA));
check("B is told A's look", JSON.stringify(B.who.find((w) => w.id === A.you.id)?.look) === JSON.stringify(lookA), JSON.stringify(B.who.find((w) => w.id === A.you.id)));
A.send({ t: "walk", x: 26, y: 13 }); await wait(6500);   /* (everyone arrives beside the mirror: walk off to the Prize Counter first) */
A.clear(); A.send({ t: "look", look: [0, 0, 0, 0, 0, -1, 0] }); await wait(1500);
check("a second look away from the mirror is refused", !A.saw("lookset") && JSON.stringify(A.me?.look) === JSON.stringify(lookA));
A.clear(); A.send({ t: "look", look: [99, 0, 0, 0, 0, -1, 0] }); await wait(600); check("a look outside the lists is refused", !A.saw("lookset"));

B.clear(); A.send({ t: "emote", k: "cheers" }); await wait(700); check("B sees A's emote", B.saw("emote", (x) => x.id === A.you.id && x.k === "cheers"));
B.clear(); A.send({ t: "emote", k: "gg" }); await wait(500); check("emotes can't be spammed (one per 1.5 s)", !B.saw("emote"));
B.clear(); A.send({ t: "emote", k: "nonsense" }); await wait(1700); check("an unknown emote goes nowhere", !B.saw("emote"));

B.clear(); A.clear(); A.send({ t: "bigwin", game: "Plinko", mult: 25 }); await wait(700);
check("a 25x win is called out to the floor, to both", B.saw("bigwin", (x) => x.name === A.name && x.mult === 25 && x.game === "Plinko") && A.saw("bigwin"));
B.clear(); A.send({ t: "bigwin", game: "Plinko", mult: 40 }); await wait(600); check("a second callout inside ten seconds is dropped", !B.saw("bigwin"));
B.clear(); B.send({ t: "bigwin", game: "Plinko", mult: 9 }); await wait(500); check("under 10x is not a callout", !A.saw("bigwin", (x) => x.name === B.name));
B.send({ t: "bigwin", game: "Plinko", mult: 100000 }); B.send({ t: "bigwin", game: "<script>", mult: 20 }); await wait(600); check("absurd numbers and made-up games are dropped", !A.saw("bigwin", (x) => x.name === B.name));

B.clear(); A.send({ t: "trade", op: "req", to: B.you.id }); await wait(800); check("B gets A's trade request", B.saw("tradereq", (x) => x.from === A.you.id) || B.saw("say"), JSON.stringify(B.ev.slice(-2)));
B.clear(); A.send({ t: "chat", text: "hello from the harness" }); await wait(600); check("chat reaches the other player", B.saw("chat", (x) => x.text === "hello from the harness"));

A.ws.close(); B.ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
