// Runs the REAL GambaScape money paths against in-memory SQLite shaped like D1, with StreamElements stubbed at fetch():
//   functions/api/eastscape/exchange.js  (banking dropped ZCoins, and writing TICKET STAKES)
//   the six casino bet endpoints, each played once from the wallet and once on a ticket stake
// Nothing here touches production and no ZCoin moves.
//   node tools/dex-test.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = pathToFileURL(path.join(REPO, "functions/api/")).href;
let pass = 0, failN = 0;
const check = (label, ok, extra = "") => { if (ok) pass++; else failN++; console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  — " + extra : ""}`); };

class Stmt {
  constructor(raw, sql) { this.raw = raw; this.sql = sql; this.args = []; }
  bind(...x) { this.args = x.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v)); return this; }
  async first() { return this.raw.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.args) }; }
  async run() { const i = this.raw.prepare(this.sql).run(...this.args); return { meta: { changes: Number(i.changes) } }; }
}
const raw = new DatabaseSync(":memory:");
const db = { prepare: (sql) => new Stmt(raw, sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
for (const f of fs.readdirSync(path.join(REPO, "migrations")).filter((x) => x.endsWith(".sql")).sort()) { try { raw.exec(fs.readFileSync(path.join(REPO, "migrations", f), "utf8")); } catch (e) { /* later migrations may not apply to a blank db */ } }
const balances = { alice: 100, bob: 0 }; let seDown = false;
const TOKENS = { u1: "tok_alice", u2: "tok_bob" };
for (const [i, login] of Object.keys(balances).entries()) {
  raw.exec(`INSERT INTO users (twitch_id, twitch_login, display_name) VALUES ('u${i + 1}', '${login}', '${login}')`);
  raw.prepare(`INSERT INTO sessions (session_hash, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 day'))`).run(crypto.createHash("sha256").update(TOKENS[`u${i + 1}`]).digest("hex"), `u${i + 1}`);
}
globalThis.fetch = async (url, opts = {}) => {
  const m = String(url).match(/\/points\/[^/]+\/([^/?]+)(?:\/(-?\d+))?/);
  if (!m) return new Response("{}", { status: 404 });
  if (seDown) return new Response("upstream sad", { status: 500 });
  const login = decodeURIComponent(m[1]);
  if (opts.method === "PUT") { balances[login] = (balances[login] || 0) + Number(m[2]); return Response.json({ newAmount: balances[login] }); }
  return Response.json({ points: balances[login] ?? 0 });
};
const env = { PICKS_DB: db, STREAMELEMENTS_JWT: "jwt", STREAMELEMENTS_CHANNEL_ID: "ch", ESCAPE_KEY: "k".repeat(40) };
const M = await import(ROOT + "eastscape/exchange.js"), G = await import(pathToFileURL(path.join(REPO, "v3/assets/js/eastscape-shared.js")).href);
const ask = async (body, key = env.ESCAPE_KEY) => { const r = await M.onRequestPost({ env, waitUntil() {}, request: new Request("https://eastcoin.vip/api/eastscape/exchange", { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "X-Escape-Key": key } : {}) }, body: JSON.stringify(body) }) }); return { status: r.status, body: await r.json() }; };
const ops = (like) => raw.prepare(`SELECT idempotency_key k, amount, status FROM wallet_operations WHERE idempotency_key LIKE ? ORDER BY rowid`).all(like);
const count = (sql, ...a) => raw.prepare(sql).get(...a).n;

check("the game's copy of the numbers is the site's", G.DEX.capHour === M.CAP_HOUR && G.DEX.maxStake === M.MAX_STAKE, `${JSON.stringify(G.DEX)} vs ${M.CAP_HOUR}/${M.MAX_STAKE}`);
check("the rate is 1,000 tickets a ZCoin", G.DEX.rate === 1000);

let r = await ask({ op: "status", userId: "u1" }, "wrong-key"); check("wrong key: 403, definite", r.status === 403 && r.body.definite === true);
r = await ask({ op: "status", userId: "u1" }, null); check("no key: 403", r.status === 403);
r = await ask({ op: "status", userId: "nobody" }); check("unknown player: definite no", r.status === 404 && r.body.definite === true);
r = await ask({ op: "status", userId: "u1" }); check("status: a full allowance, nothing open", r.body.ok && r.body.left === M.CAP_HOUR && r.body.open.length === 0 && r.body.enabled === true);
r = await ask({ op: "ticket", userId: "u1", id: "tick0001" }); check("the old Ruby ticket op is gone", r.body.code === "BAD_OP" && r.body.definite === true);

// ---- banking dropped ZCoins
r = await ask({ op: "pay", userId: "u1", id: "exch0001", zc: 10 }); check("bank 10: credited once", r.body.ok && balances.alice === 110 && r.body.left === M.CAP_HOUR - 10);
r = await ask({ op: "pay", userId: "u1", id: "exch0001", zc: 10 }); check("the same id again: pays nothing new", r.body.ok && r.body.duplicate && balances.alice === 110 && ops("GAMBA:DEX:%").length === 1);

// ---- writing ticket stakes
r = await ask({ op: "stake", userId: "u1", id: "stake0001", zc: 5 }); check("a 5 ZC ticket stake: written, no ZCoin moves", r.body.ok && r.body.voucher === "stake0001" && balances.alice === 110 && r.body.left === M.CAP_HOUR - 15);
r = await ask({ op: "stake", userId: "u1", id: "stake0001", zc: 5 }); check("the same id again: one row, allowance unchanged", r.body.ok && r.body.duplicate && count(`SELECT COUNT(*) n FROM gamba_stakes`) === 1 && r.body.left === M.CAP_HOUR - 15);
for (const bad of [{ zc: 0 }, { zc: -5 }, { zc: M.MAX_STAKE + 1 }, { zc: "x" }, { id: "short" }, { id: "has spaces in it" }]) { r = await ask({ op: "stake", userId: "u1", id: "stake0bad", zc: 5, ...bad }); check(`bad stake ${JSON.stringify(bad)}: definite no`, !r.body.ok && r.body.definite === true && count(`SELECT COUNT(*) n FROM gamba_stakes`) === 1); }
r = await ask({ op: "status", userId: "u1" }); check("status lists the open stake", r.body.open.length === 1 && r.body.open[0].id === "stake0001" && r.body.open[0].zc === 5);

// ---- the six tables, on a ticket stake
const post = async (file, params, body, who = "u1") => { const mod = await import(ROOT + file); const res = await mod.onRequestPost({ env, params, waitUntil() {}, request: new Request("https://eastcoin.vip/api/x", { method: "POST", headers: { "content-type": "application/json", cookie: `__Host-ec_session=${TOKENS[who]}` }, body: JSON.stringify(body) }) }); return { status: res.status, body: await res.json() }; };
const debits = () => count(`SELECT COUNT(*) n FROM wallet_operations WHERE type = 'WAGER_DEBIT'`);
const newStake = async (id, zc, who = "u1") => { const a = await ask({ op: "stake", userId: who, id, zc }); if (!a.body.ok) throw new Error(`stake ${id}: ${JSON.stringify(a.body)}`); return id; };

let before = balances.alice, d0 = debits();
r = await post("casino/plinko/drop.js", {}, { stake: 5, voucher: "stake0001" });
check("Plinko on a ticket stake: plays, wallet only ever goes UP by the payout, no debit written", r.body.ok && balances.alice === before + r.body.drop.payout && debits() === d0 && r.body.drop.stake === 5, JSON.stringify(r.body).slice(0, 160));
check("the voucher is spent, and says where", raw.prepare(`SELECT status, game FROM gamba_stakes WHERE id = 'stake0001'`).get().status === "USED" && String(raw.prepare(`SELECT game FROM gamba_stakes WHERE id = 'stake0001'`).get().game).startsWith("plinko:"));
before = balances.alice; r = await post("casino/plinko/drop.js", {}, { stake: 5, voucher: "stake0001" });
check("the same voucher again: refused, nothing moves, no drop written", r.body.code === "BAD_VOUCHER" && balances.alice === before && count(`SELECT COUNT(*) n FROM plinko_drops`) === 1);
await newStake("stake0002", 5);
r = await post("casino/plinko/drop.js", {}, { stake: 10, voucher: "stake0002" }); check("a 5 voucher on a 10 bet: refused, voucher still open", r.body.code === "BAD_VOUCHER" && raw.prepare(`SELECT status FROM gamba_stakes WHERE id = 'stake0002'`).get().status === "OPEN");
r = await post("casino/plinko/drop.js", {}, { stake: 5, voucher: "stake0002" }, "u2"); check("someone else's voucher: refused, voucher still open", r.body.code === "BAD_VOUCHER" && raw.prepare(`SELECT status FROM gamba_stakes WHERE id = 'stake0002'`).get().status === "OPEN");
r = await post("casino/plinko/drop.js", {}, { stake: 5, voucher: "no such voucher!" }); check("a made-up voucher: refused", r.body.code === "BAD_VOUCHER");
before = balances.bob; await newStake("stake0bob", 5, "u2"); r = await post("casino/plinko/drop.js", {}, { stake: 5, voucher: "stake0bob" }, "u2");
check("a player with NO ZCoins can play on a ticket stake", r.body.ok && balances.bob === before + r.body.drop.payout);

before = balances.alice; d0 = debits(); r = await post("casino/plinko/drop.js", {}, { stake: 5 });
check("no voucher: the wallet pays, exactly as before", r.body.ok && balances.alice === before - 5 + r.body.drop.payout && debits() === d0 + 1);

before = balances.alice; d0 = debits(); r = await post("casino/scratch/buy.js", {}, { stake: 5, voucher: "stake0002" });
check("Scratch-Off on a ticket stake", r.body.ok && balances.alice === before + r.body.card.payout && debits() === d0, JSON.stringify(r.body).slice(0, 120));

await newStake("stake0003", 5); before = balances.alice; d0 = debits(); r = await post("casino/hilo/start.js", {}, { stake: 5, voucher: "stake0003" });
check("Higher or Lower deals on a ticket stake, nothing debited", r.body.ok && balances.alice === before && debits() === d0 && r.body.game.stake === 5, JSON.stringify(r.body).slice(0, 120));

await newStake("stake0004", 5); before = balances.alice; d0 = debits(); r = await post("casino/mines/start.js", {}, { stake: 5, mines: 3, voucher: "stake0004" });
check("Mines starts on a ticket stake, nothing debited", r.body.ok && balances.alice === before && debits() === d0);
const board = r.body.game; let pick = null; for (let t = 0; t < 25 && !pick; t++) { const p = await post("casino/mines/pick.js", {}, { id: board.id, tile: t }); if (p.body.ok) pick = p.body; }
if (pick && pick.outcome !== "bomb") { before = balances.alice; const c = await post("casino/mines/cashout.js", {}, { id: board.id }); check("…and cashing out pays real ZCoins", c.body.ok && balances.alice === before + c.body.game.payout && c.body.game.payout >= 5); }
else check("…(first tile was a bomb: the run ended with nothing paid)", balances.alice === before);

await newStake("stake0005", 5); before = balances.alice; d0 = debits(); const whenOpen = async (fn) => { let x; for (let i = 0; i < 40; i++) { x = await fn(); if (x.body.code !== "BETS_CLOSED") break; await new Promise((ok) => setTimeout(ok, 1000)); } return x; };   // the shared rounds run on the wall clock: wait for a betting window
r = await whenOpen(() => post("coin/bet.js", {}, { side: "heads", wager: 5, voucher: "stake0005" }));
check("Coin Flip takes a ticket stake into the shared round", r.body.ok && balances.alice === before && debits() === d0 && count(`SELECT COUNT(*) n FROM coin_bets WHERE wager = 5`) === 1, JSON.stringify(r.body).slice(0, 120));
await newStake("stake0006", 5); r = await post("coin/bet.js", {}, { side: "tails", wager: 5, voucher: "stake0006" });
check("a second bet in the same round: refused BEFORE the voucher is touched", !r.body.ok && raw.prepare(`SELECT status FROM gamba_stakes WHERE id = 'stake0006'`).get().status === "OPEN", r.body.code);

before = balances.alice; d0 = debits(); r = await whenOpen(() => post("casino/[game]/bet.js", { game: "wheel" }, { pick: "red", wager: 5, voucher: "stake0006" }));
if (r.body.code === "BETS_CLOSED") check("the Wheel's round was shut at this second of the clock: refused, and the voucher is still good", raw.prepare(`SELECT status FROM gamba_stakes WHERE id = 'stake0006'`).get().status === "OPEN" && balances.alice === before);
else check("the Wheel takes a ticket stake into the shared round", r.body.ok && balances.alice === before && debits() === d0, JSON.stringify(r.body).slice(0, 120));

// ---- the allowance is the backstop
r = await ask({ op: "status", userId: "u1" }); const left = r.body.left;
check("the allowance counted every stake by face, and the banking", left === M.CAP_HOUR - 10 - 5 * 6, `left ${left}`);
let n = 0; for (let i = 0; i < 10; i++) { const a = await ask({ op: "stake", userId: "u1", id: `fill${String(i).padStart(6, "0")}`, zc: 5 }); if (a.body.ok) n++; else { check("over the allowance: CAP, definite, nothing written", a.body.code === "CAP" && a.body.definite === true); break; } }
check("exactly the allowance was handed out", n === Math.floor(left / 5), `${n} more stakes of 5 from ${left}`);
raw.exec(`UPDATE gamba_stakes SET created_at = datetime('now', '-2 hour') WHERE user_id = 'u1'`); raw.exec(`UPDATE wallet_operations SET created_at = datetime('now', '-2 hour')`);
r = await ask({ op: "status", userId: "u1" }); check("an hour on: the allowance is back", r.body.left === M.CAP_HOUR);

// ---- GambaScape's own tables: DICE and SLOTS (built from plinko/drop.js, so the money steps are the same ones)
{
  const E = await import(ROOT + "casino/_engine.js"), D = await import(ROOT + "casino/dice/_dice.js"), S = await import(ROOT + "casino/slots/_slots.js");
  balances.alice = 1000; raw.exec(`DELETE FROM gamba_stakes`);
  let b0 = balances.alice, n0 = await E.hourlyNet(db, "u1");
  r = await post("casino/dice/roll.js", {}, { stake: 5, target: 50 });
  check("Dice from the wallet: 5 out, the payout back, and the roll is the seed's", r.body.ok && balances.alice === b0 - 5 + r.body.roll.payout && r.body.roll.roll === await D.rollFor(r.body.roll.seed) && (r.body.roll.won ? [10, 11].includes(r.body.roll.payout) : r.body.roll.payout === 0), JSON.stringify(r.body).slice(0, 200));
  check("…and the hourly cap sees it", (await E.hourlyNet(db, "u1")) === n0 + r.body.roll.payout - 5);
  check("…and the hash shown beforehand was that seed's", r.body.roll.hash === await E.sha256(r.body.roll.seed));
  for (const bad of [{ target: 4 }, { target: 96 }, { target: "x" }, { stake: 21 }, { stake: 0 }]) { b0 = balances.alice; const x = await post("casino/dice/roll.js", {}, { stake: 5, target: 50, ...bad }); check(`Dice ${JSON.stringify(bad)}: refused, nothing charged`, !x.body.ok && balances.alice === b0); }
  await newStake("dicestake1", 5); b0 = balances.alice; d0 = debits(); r = await post("casino/dice/roll.js", {}, { stake: 5, target: 80, voucher: "dicestake1" });
  check("Dice on a ticket stake: no debit, payout in ZCoins", r.body.ok && balances.alice === b0 + r.body.roll.payout && debits() === d0);

  await S.ensureSlots(db); const pot0 = raw.prepare(`SELECT centi, reserve FROM slots_pot`).get();
  b0 = balances.alice; r = await post("casino/slots/spin.js", {}, { stake: 5 });
  const reels = r.body.ok ? await S.reelsFor(r.body.spin.seed) : [];
  check("Slots from the wallet: 5 out, the payout back, the reels are the seed's", r.body.ok && balances.alice === b0 - 5 + r.body.spin.payout && reels.join() === r.body.spin.reels.join(), JSON.stringify(r.body).slice(0, 200));
  check("…and 2% of the stake went into the pot", raw.prepare(`SELECT centi FROM slots_pot`).get().centi === pot0.centi + 10);
  // a seed that spins three sevens, found by looking (1 in 64,000), then planted as this player's committed seed
  let lucky = null; for (let i = 0; i < 400000 && !lucky; i++) { const s = `jackpot-hunt-${i}`; if ((await S.reelsFor(s)).every((x) => x === "seven")) lucky = s; }
  check("found a three-sevens seed to plant", !!lucky);
  const plant = async () => raw.prepare(`UPDATE slots_commits SET seed = ?, hash = ? WHERE user_id = 'u1'`).run(lucky, await E.sha256(lucky));
  raw.exec(`UPDATE slots_pot SET centi = 30000, reserve = 1234`); await plant(); b0 = balances.alice;
  r = await post("casino/slots/spin.js", {}, { stake: 10 });
  check("three sevens on a HALF stake wins half the pot, the rest stays", r.body.ok && r.body.spin.jackpot === 150 && r.body.spin.payout === 150 && balances.alice === b0 - 10 + 150 && raw.prepare(`SELECT centi FROM slots_pot`).get().centi === 30020 - 15000, JSON.stringify(r.body.spin || r.body).slice(0, 200));
  await plant(); b0 = balances.alice; const before2 = raw.prepare(`SELECT centi, reserve FROM slots_pot`).get();
  r = await post("casino/slots/spin.js", {}, { stake: 20 });
  const after2 = raw.prepare(`SELECT centi, reserve, last_login FROM slots_pot`).get();
  check("three sevens on a FULL stake wins all of it; the pot restarts at the seed plus what was waiting", r.body.ok && r.body.spin.payout === Math.floor((before2.centi + 40) / 100) && balances.alice === b0 - 20 + r.body.spin.payout && after2.centi === S.JACKPOT.seed * 100 + before2.reserve && after2.reserve === 0 && after2.last_login === "alice", JSON.stringify({ spin: r.body.spin?.payout, before2, after2 }));
  raw.exec(`UPDATE slots_pot SET centi = ${S.JACKPOT.ceiling * 100 - 5}, reserve = 0`); await S.feedPot(db, 20);
  const capd = raw.prepare(`SELECT centi, reserve FROM slots_pot`).get(); check("the pot stops at its ceiling and the overflow waits in reserve", capd.centi === S.JACKPOT.ceiling * 100 && capd.reserve === 35);
  // the returns, measured over seeds with the real functions
  let sl = 0, dc = 0; const N = 40000;
  for (let i = 0; i < N; i++) { const s = `measure-${i}`, e = await E.edgeFor(s); const line = S.lineFor(await S.reelsFor(s)); sl += line.jackpot ? 0 : S.priceFor(line) * e; dc += (await D.rollFor(s)) < 50 ? D.fairFor(50) * e : 0; }
  check(`Slots' regular pays return about 98% (the other 2% is the pot): ${(sl / N * 100).toFixed(2)}%`, Math.abs(sl / N - 0.98) < 0.02);
  check(`Dice returns about 100%: ${(dc / N * 100).toFixed(2)}%`, Math.abs(dc / N - 1) < 0.02);
  raw.exec(`DELETE FROM dice_rolls`); let okN = 0, lim = null; for (let i = 0; i < 12; i++) { const x = await post("casino/dice/roll.js", {}, { stake: 1, target: 95 }); if (x.body.ok) okN++; else { lim = x.body.code; break; } }
  check("ten rolls an hour, then RATE_LIMIT (or the win cap first)", (okN === 10 && lim === "RATE_LIMIT") || lim === "WIN_CAP", `${okN} ${lim}`);
}

// ---- THE LATE-BET HOLE (closed 2026-09-19): read the published result, then try to bet on it, on a frozen clock
{
  const get = async (file, params, who = "u1") => { const mod = await import(ROOT + file); const res = await mod.onRequestGet({ env, params, waitUntil() {}, request: new Request("https://eastcoin.vip/api/x", { headers: { cookie: `__Host-ec_session=${TOKENS[who]}` } }) }); return res.json(); };
  const realNow = Date.now; raw.exec(`DELETE FROM coin_bets; DELETE FROM casino_bets; DELETE FROM wallet_operations`); balances.alice = 1000; balances.bob = 1000;
  try {
    // Coin Flip: 30 s rounds, bets close at +15 s. Stand half a second after the close of a round far in the future.
    const coinNo = Math.floor(realNow() / 30000) + 1000, tCoin = coinNo * 30000 + 15000 + 500; Date.now = () => tCoin;
    let x = await post("coin/bet.js", {}, { side: "heads", wager: 5 }, "u2");
    check("an honest click half a second late, before anyone has settled the round: still taken (the grace)", x.body.ok, JSON.stringify(x.body).slice(0, 120));
    const st = await get("coin/state.js", {});
    check("the state endpoint has now published that round's result", st.round?.no === coinNo && !!st.round.result && !!st.round.seed, JSON.stringify(st.round || {}).slice(0, 160));
    const b0 = balances.alice; x = await post("coin/bet.js", {}, { side: String(st.round.result), wager: 20 });
    check("COIN FLIP: a bet on the side that was just published is REFUSED, nothing charged", x.body.code === "BETS_CLOSED" && balances.alice === b0 && count(`SELECT COUNT(*) n FROM coin_bets WHERE user_id = 'u1' AND round_no = ${coinNo}`) === 0, JSON.stringify(x.body).slice(0, 120));
    // The Wheel: 60 s rounds, bets close at +40 s.
    const whNo = Math.floor(realNow() / 60000) + 1000, tWh = whNo * 60000 + 40000 + 500; Date.now = () => tWh;
    const ws = await get("casino/[game]/state.js", { game: "wheel" });
    check("the Wheel's state has published its result", ws.round?.no === whNo && !!ws.round.result?.color);
    const b1 = balances.alice; x = await post("casino/[game]/bet.js", { game: "wheel" }, { pick: ws.round.result.color, wager: 20 });
    check("THE WHEEL: a bet on the colour that was just published is REFUSED, nothing charged", x.body.code === "BETS_CLOSED" && balances.alice === b1, JSON.stringify(x.body).slice(0, 120));
  } finally { Date.now = realNow; }
}

// ---- StreamElements down: a banking is NOT a definite no
seDown = true; r = await ask({ op: "pay", userId: "u1", id: "exchdown1", zc: 3 }); check("wallet down on a banking: not definite, the game holds the coins", !r.body.ok && r.body.definite === false); seDown = false;

// ---- the fuse
raw.exec(`INSERT INTO gamba_stakes (id, user_id, zc) VALUES ('fuse00001', 'u2', ${M.DAY_BREAKER})`);
r = await ask({ op: "stake", userId: "u1", id: "afterfuse1", zc: 5 }); check("the day's fuse stops everything", r.body.code === "BREAKER" && r.body.definite === true);

console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
