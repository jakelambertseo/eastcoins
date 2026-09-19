// Runs the REAL Red Light, Green Light endpoints (join, move, state, settlement) against in-memory SQLite shaped
// like D1, with StreamElements stubbed at fetch() and the clock under the test's control. Nothing here touches
// production and no ZCoin moves.   node tools/redlight-test.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = pathToFileURL(path.join(REPO, "functions/api/")).href;
let pass = 0, failN = 0;
const check = (label, ok, extra = "") => { if (ok) pass++; else failN++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`); };

// the browser's copy of the rules must be the server's, byte for byte
const a = fs.readFileSync(path.join(REPO, "functions/api/casino/pvp/_redlight.js")), b = fs.existsSync(path.join(REPO, "v3/assets/js/redlight-rules.js")) ? fs.readFileSync(path.join(REPO, "v3/assets/js/redlight-rules.js")) : null;
check("v3/assets/js/redlight-rules.js is a byte-identical copy of the server's rules", b && a.equals(b));

class Stmt {
  constructor(raw, sql) { this.raw = raw; this.sql = sql; this.args = []; }
  bind(...x) { this.args = x.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v)); return this; }
  async first() { return this.raw.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.args) }; }
  async run() { const i = this.raw.prepare(this.sql).run(...this.args); return { meta: { changes: Number(i.changes) } }; }
}
const raw = new DatabaseSync(":memory:");
const db = { prepare: (sql) => new Stmt(raw, sql), batch: async (list) => { for (const s of list) await s.run(); } };
raw.exec(fs.readFileSync(path.join(REPO, "migrations/0001_picks_core.sql"), "utf8"));
const balances = {}, tokens = {};
for (let i = 1; i <= 8; i++) {
  const login = `runner${i}`, token = `tok_${i}`; tokens[login] = token; balances[login] = 100;
  raw.exec(`INSERT INTO users (twitch_id, twitch_login, display_name) VALUES ('u${i}', '${login}', 'Runner ${i}')`);
  raw.prepare(`INSERT INTO sessions (session_hash, user_id, expires_at) VALUES (?, 'u${i}', datetime('now', '+1 day'))`).run(crypto.createHash("sha256").update(token).digest("hex"));
}
globalThis.fetch = async (url, opts = {}) => {
  const m = String(url).match(/\/points\/[^/]+\/([^/]+)(?:\/(-?\d+))?$/);
  if (!m) return new Response("{}", { status: 404 });
  const login = decodeURIComponent(m[1]);
  if (opts.method === "PUT") { balances[login] = (balances[login] || 0) + Number(m[2]); return Response.json({ newAmount: balances[login] }); }
  return Response.json({ points: balances[login] ?? 0 });
};
// the test owns the clock
let clock = Date.now(); const realNow = Date.now; Date.now = () => clock;
const env = { PICKS_DB: db, STREAMELEMENTS_JWT: "jwt", STREAMELEMENTS_CHANNEL_ID: "ch" };
const ctx = (p, body, who) => ({ env, waitUntil() {}, request: new Request(`https://eastcoin.vip/api/${p}`, { method: body ? "POST" : "GET", headers: { ...(who ? { cookie: `__Host-ec_session=${tokens[who]}` } : {}), "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }) });
const pvp = await import(ROOT + "casino/pvp/_pvp.js"), rules = await import(ROOT + "casino/pvp/_redlight.js");
const joinM = await import(ROOT + "casino/pvp/join.js"), moveM = await import(ROOT + "casino/pvp/move.js"), stateM = await import(ROOT + "casino/pvp/state.js"), verifyM = await import(ROOT + "casino/verify.js");
const { RL } = rules;
const join = async (who) => { const r = await joinM.onRequestPost(ctx("casino/pvp/join", { game: "redlight" }, who)); return { status: r.status, body: await r.json() }; };
const move = async (who, run) => { const r = await moveM.onRequestPost(ctx("casino/pvp/move", { game: "redlight", run }, who)); return { status: r.status, body: await r.json() }; };
const state = async (who) => { const r = await stateM.onRequestGet(ctx("casino/pvp/state?game=redlight", null, who)); return { status: r.status, body: await r.json(), text: "" }; };
const sum = () => Object.values(balances).reduce((x, y) => x + y, 0);

/* ---- paused means nothing moves ---- */
let r = await join("runner1");
check("paused: join refused with PAUSED and nothing charged", r.status === 409 && r.body.code === "PAUSED" && balances.runner1 === 100, r.body.message);
pvp.GAMES.redlight.paused = false;   // (this process only)

/* ---- race 1: three runners, one goes out on light 1, one never moves, one creeps: furthest wins after every light ---- */
r = await join("runner1"); check("first join opens the lobby and takes 20", r.status === 200 && balances.runner1 === 80 && r.body.lobby?.players.length === 1);
r = await join("runner1"); check("sitting down twice is refused, charged once", r.status === 409 && r.body.code === "ALREADY_IN" && balances.runner1 === 80);
await join("runner2"); await join("runner3");
r = await move("runner1", 1000); check("no sprint before the race starts", r.status === 409 && r.body.code === "NOT_RUNNING");
let s = await state("runner1"); const startsAt = s.body.lobby.startsAt;
check("lobby: three in, pot 60, no race yet, seed hidden", s.body.lobby.players.length === 3 && s.body.lobby.pot === 60 && s.body.race === null && s.body.lobby.seed === null);

clock = startsAt + 500; s = await state("runner1");
check("clock out: the same round is now the race, in its intro", s.body.race && s.body.race.light === -1 && s.body.race.lights.length === 0 && s.body.race.mySeat === 0);
r = await join("runner7"); check("nobody sits down at a race that has started, and nothing is charged", r.status === 409 && r.body.code === "RUNNING" && balances.runner7 === 100, r.body.message);
r = await move("runner1", 700); check("no sprint during the intro", r.status === 409 && r.body.code === "NO_LIGHT");

clock = rules.lightOpensAt(startsAt, 0) + 1000;
r = await move("runner1", 700); check("light 1: a 0.7s dash is taken", r.status === 200 && r.body.light === 0 && r.body.run === 700);
r = await move("runner1", 3900); check("the first sprint sent stands", r.status === 200 && r.body.already && r.body.run === 700);
r = await move("runner2", 999999); check("a sprint is clamped to the longest allowed", r.body.run === RL.maxRunMs);
r = await move("runner8", 700); check("someone not in the race can't move", r.status === 403);
s = await state("runner3"); const leak = JSON.stringify(s.body);
check("while a light is open the page sees who locked in, and nothing else", JSON.stringify(s.body.race.locked) === "[true,true,false]" && s.body.race.lights.length === 0 && !leak.includes("turnMs") && !leak.includes(raw.prepare(`SELECT seed FROM pvp_rounds`).get().seed));
clock = rules.lightOpensAt(startsAt, 0) + RL.chooseMs + RL.graceMs - 50;
r = await move("runner3", 0); check("inside the grace a late sprint still counts", r.status === 200);
s = await state("runner3"); check("...and the turn is still secret inside the grace", s.body.race.lights.length === 0);
clock = rules.lightClosesAt(startsAt, 0) + 10;
r = await move("runner3", 500); check("after the grace that light takes nothing", r.status === 409);
s = await state("runner1"); const L0 = s.body.race.lights[0];
const seed1 = raw.prepare(`SELECT seed FROM pvp_rounds`).get().seed, t0 = await rules.turnFor(seed1, 0);
check("light 1 closed: its turn is told, and it is the seed's", L0 && L0.turnMs === t0 && t0 >= RL.minTurnMs && t0 <= RL.maxRunMs, `turn ${t0}ms`);
check("the 4.0s sprinter is out where the whistle caught them; the dasher moved 6.3 yards", (t0 === RL.maxRunMs || (L0.out.includes(1) && s.body.race.alive[1] === false)) && Math.abs(s.body.race.pos[0] - 6.3) < 0.01, JSON.stringify(s.body.race.pos));
if (t0 < RL.maxRunMs) { clock = rules.lightOpensAt(startsAt, 1) + 500; r = await move("runner2", 700); check("out is out: no more sprints from them", r.status === 409 && r.body.code === "OUT"); }
for (let k = 1; k < RL.maxLights; k++) { clock = rules.lightOpensAt(startsAt, k) + 800; await move("runner1", 700); s = await state("runner2"); if (k < RL.maxLights - 1) check(`light ${k + 1} open: still unsettled`, s.body.race && s.body.race.winner === null && raw.prepare(`SELECT status FROM pvp_rounds`).get().status === "LOBBY"); }
const before = sum();
clock = rules.lightClosesAt(startsAt, RL.maxLights - 1) + 20; s = await state("runner2");
const row1 = raw.prepare(`SELECT * FROM pvp_rounds`).get(), res1 = JSON.parse(row1.result);
check("every light done: settled, the creeper is furthest and takes 60", row1.status === "SETTLED" && res1.winner === 0 && res1.how === "furthest" && balances.runner1 === 80 + 60 && balances.runner2 === 80 && balances.runner3 === 80, JSON.stringify({ how: res1.how, pos: res1.pos, balances: [balances.runner1, balances.runner2, balances.runner3] }));
check("money is conserved: the pot in is the pot out", sum() === before + 60 && sum() === 800);
check("the finished race comes back with its seed", s.body.last?.seed === seed1 && s.body.last.result.winner === 0 && s.body.race === null);
await state("runner1"); await pvp.settleDue(env, db, pvp.GAMES.redlight, clock + 999999);
check("settling again pays nobody twice", balances.runner1 === 140 && raw.prepare(`SELECT COUNT(*) AS n FROM wallet_operations WHERE type = 'PAYOUT_CREDIT'`).get().n === 1);
check("entries are WON / LOST", JSON.stringify(raw.prepare(`SELECT status, payout FROM pvp_entries ORDER BY seat`).all().map((e) => `${e.status}:${e.payout}`)) === '["WON:60","LOST:0","LOST:0"]');
const v = await (await verifyM.onRequestGet({ request: new Request(`https://eastcoin.vip/api/casino/verify?game=redlight&seed=${seed1}&hash=${row1.hash}`) })).json();
check("the check page replays the turns from the seed", v.ok && v.turns[0].turnsAfterMs === t0 && v.match !== false);

/* ---- race 2: a known seed. Everyone sprints exactly to the whistle; first across the line wins; then a lone lobby refunds ---- */
clock += 60000; await join("runner4"); await join("runner5");
const SEED = "test-seed-known"; raw.prepare(`UPDATE pvp_rounds SET seed = ? WHERE status = 'LOBBY'`).run(SEED);
s = await state("runner4"); const st2 = s.body.lobby.startsAt, turns = []; for (let k = 0; k < RL.maxLights; k++) turns.push(await rules.turnFor(SEED, k));
let settledAt = -1;
for (let k = 0; k < RL.maxLights && settledAt < 0; k++) {
  clock = rules.lightOpensAt(st2, k) + 300; await move("runner4", turns[k]); await move("runner5", Math.max(0, turns[k] - 1000));
  clock = rules.lightClosesAt(st2, k) + 5; s = await state("runner5"); if (!s.body.race) settledAt = k;
}
const res2 = s.body.last.result, want = await rules.replay(SEED, 2, res2.lights.map((l) => l.runs), RL.maxLights);
check("sprinting exactly to the whistle is safe, and the bolder runner reaches the line first", res2.how === "line" && res2.winner === 0 && want.winner === 0 && balances.runner4 === 120 && balances.runner5 === 80, `won on light ${settledAt + 1}, turns ${turns.slice(0, settledAt + 1).join(",")}`);

clock += 60000; await join("runner6"); s = await state("runner6"); clock = s.body.lobby.startsAt + 100; await state("runner6");
check("a lobby of one is refunded and voided", balances.runner6 === 100 && raw.prepare(`SELECT status FROM pvp_rounds ORDER BY opens_at DESC LIMIT 1`).get().status === "VOID");

/* ---- race 3: last runner in wins on the spot ---- */
clock += 60000; await join("runner6"); await join("runner7"); raw.prepare(`UPDATE pvp_rounds SET seed = 'seed-three' WHERE status = 'LOBBY'`).run();
s = await state("runner6"); const st3 = s.body.lobby.startsAt, t3 = await rules.turnFor("seed-three", 0);
clock = rules.lightOpensAt(st3, 0) + 300; await move("runner6", Math.min(RL.maxRunMs, t3 + 10)); await move("runner7", 0);
clock = rules.lightClosesAt(st3, 0) + 5; s = await state("runner7");
check("one runner caught, the other wins at once without moving", t3 + 10 > RL.maxRunMs || (s.body.last.result.how === "last" && s.body.last.result.winner === 1 && balances.runner7 === 120 && balances.runner6 === 80));
check("the books balance at the end of it all", sum() === 800, `total ${sum()}`);

/* ---- the rules, on their own ---- */
const dead = await rules.replay("x", 3, [[4000, 4000, 4000]], 1), tx = await rules.turnFor("x", 0);
check("everyone out on the same light: the pot still goes to exactly one runner", dead.winner !== null && (tx === 4000 || dead.how === "furthest-out"));
let lo = Infinity, hi = 0, mean = 0; for (let i = 0; i < 4000; i++) { const t = await rules.turnFor(`s${i}`, 3); lo = Math.min(lo, t); hi = Math.max(hi, t); mean += t / 4000; }
check("turns are spread evenly from 0.8s to 4.0s", lo >= 800 && hi <= 4000 && lo < 850 && hi > 3950 && Math.abs(mean - 2400) < 40, `min ${lo} max ${hi} mean ${Math.round(mean)}`);

Date.now = realNow;
console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
