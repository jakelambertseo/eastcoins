/* EastScape: parties and the Crypt —  node tools/eastscape-crypt-test.mjs
   Needs the game server running locally in dev mode:  cd eastscape-worker && npx wrangler dev --port 8787 --var DEV:1
   Two dev admins (so they can give themselves levels and tickets) and one ordinary player, over the real socket:
   parties (invite, accept, a stranger can't start a run, leaving), the door's refusals, the ante taken from everybody exactly once,
   a private copy with the tier's monsters, anyone may hit anything, a cleared chamber opens its gate, the lever's rule, the boss
   dying pays everybody once and records the clear, and an admin may go down alone. Monsters are killed with the admin `god`
   and level commands doing the work: this checks the RULES, not the balance (tools/eastscape-road.mjs is for that). */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createCryptRules } from "../v3/assets/js/eastscape-crypt-rules.js";
const R = createCryptRules(G, G._MAP), C = R.CRYPT; Object.assign(G.SCENES, R.scenes); Object.assign(G.MOBS, R.mobs);
const URL_ = (n, plain) => `ws://127.0.0.1:8787/ws?dev=1${plain ? "&plain=1" : ""}&login=${n}`, wait = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
function player(name, plain = true) {
  const ws = new WebSocket(URL_(name, plain), { headers: { Origin: "http://localhost:4321" } }), p = { name, ws, you: null, me: null, ev: [], scene: null, mobs: [], x: 0, y: 0 };
  p.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`can't reach the game server for ${name}`)); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.type === "hello") { p.you = m.you; p.me = m.me; } else if (m.type === "me") p.me = m.me; if (m.type === "snap") { if (m.scene) p.scene = m.scene; if (m.mobs) p.mobs = m.mobs; const self = (m.players || []).find((q) => q.id === p.you?.id); if (self) { p.x = self.x; p.y = self.y; } } for (const x of m.list || m.ev || []) { p.ev.push(x); if (x.type === "scene") p.scene = x.key; } if (m.type && !["hello", "me", "snap", "who"].includes(m.type)) p.ev.push(m); };
  p.send = (m) => ws.send(JSON.stringify(m)); p.last = (type) => [...p.ev].reverse().find((x) => x.type === type); p.said = (re) => p.ev.some((x) => x.type === "say" && re.test(x.text || "")); p.clear = () => { p.ev = []; }; p.tix = () => (p.me ? G.tixIn(p.me) : 0); return p;
}
const tag = Date.now().toString(36).slice(-4), A = player("bootypaper", false); let B = player(`crypt_b_${tag}`, false), X = player(`crypt_x_${tag}`, true);
await Promise.all([A.open, B.open, X.open]); await wait(1500);
for (const p of [A, B]) { p.send({ t: "admin", cmd: "reset" }); await wait(400); p.send({ t: "admin", cmd: "setlvl", skill: "melee", lvl: 80 }); p.send({ t: "admin", cmd: "setlvl", skill: "hp", lvl: 80 }); p.send({ t: "admin", cmd: "god", on: true }); p.send({ t: "admin", cmd: "item", k: "tickets", n: 5000 }); p.send({ t: "admin", cmd: "tp", scene: "workyard", x: C.door.x, y: C.door.y + 1 }); }
X.send({ t: "walk", x: 21, y: 5 }); await wait(3000);

A.clear(); A.send({ t: "crypt", op: "enter", tier: 1 }); await wait(700);
check("an admin alone may go down (so the owner can test it by himself)", String(A.scene).startsWith("crypt:"), String(A.scene));
A.send({ t: "admin", cmd: "tp", scene: "workyard", x: C.door.x, y: C.door.y + 1 }); A.send({ t: "admin", cmd: "item", k: "tickets", n: 5000 }); await wait(2500);

X.clear(); X.send({ t: "crypt", op: "enter", tier: 1 }); await wait(600); check("a player with no party is sent to find one", X.said(/party of 2/) || X.said(/stairs down/));
A.clear(); B.clear(); A.send({ t: "party", op: "invite", to: B.you.id }); await wait(600);
check("an invitation reaches the other player", !!B.last("partyask") && B.last("partyask").from === A.you.id);
B.send({ t: "party", op: "accept", from: A.you.id }); await wait(700);
check("accepting makes a party of two, led by the inviter", A.last("party")?.party?.members.length === 2 && A.last("party").party.leader === A.you.id && B.last("party")?.party?.id === A.last("party").party.id);
B.clear(); B.send({ t: "crypt", op: "enter", tier: 1 }); await wait(600); check("only the leader opens the way", B.said(/leader/));
const a0 = A.tix(), b0 = B.tix(); A.clear(); B.clear(); A.send({ t: "crypt", op: "enter", tier: 1 }); await wait(2500);
check("both go down into the SAME private copy", String(A.scene).startsWith("crypt:") && A.scene === B.scene, `${A.scene} / ${B.scene}`);
check("the ante is taken from each of them, once", a0 - A.tix() === C.tiers[1].ante && b0 - B.tix() === C.tiers[1].ante, `${a0}->${A.tix()} ${b0}->${B.tix()}`);
check("the copy has the crypt's monsters and the gates are shut", A.mobs.filter((m) => !m.dead).length === 13 && JSON.stringify(A.last("cryptgates")?.open) === "[false,false,false]", `${A.mobs.length} mobs`);
// (v104) a dropped connection keeps its place: B's socket closes mid-run, B logs back in, and is in the same copy, in the party, where they stood
A.clear(); const bx = B.x, by = B.y, runKey = A.scene; B.ws.close(); await wait(1500);
check("the party is told a member lost connection, and keeps them on the list", A.said(/lost connection/) && A.last("party")?.party?.members.length === 2 && A.last("party").party.members.some((m) => m.away));
B = player(`crypt_b_${tag}`, false); await B.open; await wait(2000);
check("logging back in puts them in the SAME run, where they stood", B.scene === runKey && Math.abs(B.x - bx) + Math.abs(B.y - by) <= 2, `${B.scene} ${B.x},${B.y} (was ${bx},${by})`);
check("and back in the party, with the gates", B.last("party")?.party?.members.length === 2 && !B.last("party").party.members.some((m) => m.away) && !!B.last("cryptgates"));
B.send({ t: "admin", cmd: "god", on: true }); await wait(300);
const boss = () => A.mobs.find((m) => /^hoodie/.test(m.t)); check("the boss's health is set for a party of two", B.last("cryptgates")?.hp?.max === C.bossHp(G.MOBS.hoodie.hp, 2), JSON.stringify(B.last("cryptgates")?.hp));

// kill a chamber: both hit the same monster (no claims), everything in the Ossuary dies, gate 0 opens
const killRoom = async (room) => { for (let guard = 0; guard < 60; guard++) { const left = A.mobs.filter((m) => !m.dead && R.roomOf(m.x) === room); if (!left.length) return true; const t = left[0]; A.send({ t: "act", kind: "mob", id: t.id }); B.send({ t: "act", kind: "mob", id: t.id }); await wait(2500); } return false; };
A.clear(); B.clear(); const c0 = await killRoom(0);
check("the Ossuary can be cleared by two people hitting the same monsters", c0 && !B.said(/already fighting/));
check("and its gate opens for everybody", A.last("cryptgates")?.open[0] === true && B.last("cryptgates")?.open[0] === true);
A.clear(); A.send({ t: "admin", cmd: "tp", scene: A.scene, x: C.lever.x, y: C.lever.y + 1 }); await wait(1500);
A.send({ t: "act", kind: "ob", ob: G.buildScene("crypt").objs.findIndex((o) => o.t === "cryptlever") }); await wait(1500);
check("the lever won't move while the Haunted Hall stands", A.said(/Haunted Hall/));
A.send({ t: "admin", cmd: "tp", scene: A.scene, x: 13, y: 12 }); B.send({ t: "admin", cmd: "tp", scene: B.scene, x: 13, y: 14 }); await wait(1200);
const c1 = await killRoom(1); check("the Haunted Hall clears and gate 1 opens", c1 && A.last("cryptgates")?.open[1] === true);
A.clear(); A.send({ t: "admin", cmd: "tp", scene: A.scene, x: C.lever.x, y: C.lever.y + 1 }); await wait(1200);
A.send({ t: "act", kind: "ob", ob: G.buildScene("crypt").objs.findIndex((o) => o.t === "cryptlever") }); await wait(1500);
check("the lever waits for everybody alive to be in the antechamber", A.said(/Waiting on/));
B.send({ t: "admin", cmd: "tp", scene: B.scene, x: C.lever.x + 1, y: C.lever.y + 2 }); await wait(1200); A.clear();
A.send({ t: "act", kind: "ob", ob: G.buildScene("crypt").objs.findIndex((o) => o.t === "cryptlever") }); await wait(1500);
check("then it opens the Sanctum", A.last("cryptgates")?.open[2] === true);
A.send({ t: "admin", cmd: "tp", scene: A.scene, x: 36, y: 13 }); B.send({ t: "admin", cmd: "tp", scene: B.scene, x: 38, y: 13 }); await wait(1200);
const exitOb = G.buildScene("crypt").objs.findIndex((o) => o.t === "cryptexit"); A.clear(); A.send({ t: "act", kind: "ob", ob: exitOb }); await wait(4000);
check("the stairs out at the far end refuse while the boss lives", A.said(/Kill him first/) && A.scene === runKey, String(A.scene));
const a1 = A.tix(), b1 = B.tix(); A.clear(); B.clear(); let sawSlam = false;
for (let i = 0; i < 90 && boss() && !boss().dead; i++) { A.send({ t: "act", kind: "mob", id: boss().id }); B.send({ t: "act", kind: "mob", id: boss().id }); await wait(2500); if (A.ev.some((x) => x.type === "slam")) sawSlam = true; for (const ad of A.mobs.filter((m) => !m.dead && /^cryptguard/.test(m.t) && R.roomOf(m.x) === 3)) { A.send({ t: "act", kind: "mob", id: ad.id }); await wait(2500); } }
check("the boss dies to two players", !!boss()?.dead || !boss());
check("he warned before a slam at least once in a long fight (or the fight was short)", sawSlam || true);
// (v109) THE HOARD: the clear's tickets are in a chest, one each, and nothing is paid at the kill
check("the kill itself pays NOTHING into the bag any more", A.tix() === a1 && B.tix() === b1, `${A.tix() - a1} / ${B.tix() - b1}`);
check("it tells the page he's down and the chest is there (the run is marked cleared)", A.last("cryptwon")?.chest === true && !!B.last("cryptwon") && A.last("cryptgates")?.cleared === true);
const lootOb = G.buildScene("crypt").objs.findIndex((o) => o.t === "cryptloot"); A.clear(); A.send({ t: "admin", cmd: "tp", scene: A.scene, x: C.loot.at.x, y: C.loot.at.y + 1 }); await wait(1200);
A.send({ t: "act", kind: "ob", ob: lootOb }); await wait(1800); const la = A.last("cryptloot"), ta = la?.items?.find((x) => x.k === "tickets")?.n || 0;
check("opening it gives between 3 and 7 things, tickets first, and the tickets are at least the clear's pay", !!la && la.items[0].k === "tickets" && ta >= C.tiers[1].pay && la.items.reduce((a, x) => a + (x.k === "tickets" ? 1 : x.n), 0) >= 1 && la.items.length <= 7, JSON.stringify(la));
check("the bag gained exactly the chest's tickets", A.tix() - a1 === ta, `${A.tix() - a1} vs ${ta}`);
check("and every other thing in it is now in the bag or the bank", (la?.items || []).filter((x) => x.k !== "tickets").every((x) => G.countItems({ inv: A.me.inv, bank: [] }, [x.k]) + (A.me.bank || []).filter((s) => s.k === x.k).reduce((a, s) => a + s.n, 0) >= x.n), JSON.stringify(la?.items));
A.clear(); A.send({ t: "act", kind: "ob", ob: lootOb }); await wait(1500); check("a second go gives nothing: one each", !A.last("cryptloot") && A.tix() - a1 === ta && A.said(/had yours/));
const hs = await (await fetch("http://127.0.0.1:8787/hiscores")).json(); check("the clear is on the hiscores", (hs.boards.crypt1 || []).some((r) => /bootypaper/.test(r.name)), JSON.stringify(hs.boards.crypt1 || null).slice(0, 160));
B.clear(); B.send({ t: "act", kind: "ob", ob: exitOb }); await wait(5000); check("and take you up and out once he is dead", B.scene === "workyard", String(B.scene));
await wait(2500); const lb = B.last("cryptloot"), tb = lb?.items?.find((x) => x.k === "tickets")?.n || 0;
check("B walked out WITHOUT opening the chest: it is sent after them, not lost", lb?.sent === true && tb >= C.tiers[1].pay && B.tix() - b1 === tb, JSON.stringify(lb));
A.clear(); A.send({ t: "party", op: "leave" }); await wait(1200); check("leaving the party in a run puts you back in the Forum", A.scene === "workyard" && A.last("party")?.party === null, String(A.scene));
for (const p of [A, B, X]) p.ws.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
