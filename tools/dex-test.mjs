// Runs the REAL House Ruby endpoint (functions/api/eastscape/exchange.js) against in-memory SQLite shaped like D1, with
// StreamElements stubbed at fetch() and the clock left alone. Nothing here touches production and no ZCoin moves.
//   node tools/dex-test.mjs
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
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
const db = { prepare: (sql) => new Stmt(raw, sql), batch: async (list) => { for (const s of list) await s.run(); } };
raw.exec(fs.readFileSync(path.join(REPO, "migrations/0001_picks_core.sql"), "utf8"));
const balances = { alice: 10, bob: 0, carol: 0 }; let seDown = false, seCalls = 0;
for (const [i, login] of Object.keys(balances).entries()) raw.exec(`INSERT INTO users (twitch_id, twitch_login, display_name) VALUES ('u${i + 1}', '${login}', '${login}')`);
globalThis.fetch = async (url, opts = {}) => {
  const m = String(url).match(/\/points\/[^/]+\/([^/]+)(?:\/(-?\d+))?$/);
  if (!m) return new Response("{}", { status: 404 });
  seCalls++; if (seDown) return new Response("upstream sad", { status: 500 });
  const login = decodeURIComponent(m[1]);
  if (opts.method === "PUT") { balances[login] = (balances[login] || 0) + Number(m[2]); return Response.json({ newAmount: balances[login] }); }
  return Response.json({ points: balances[login] ?? 0 });
};
const env = { PICKS_DB: db, STREAMELEMENTS_JWT: "jwt", STREAMELEMENTS_CHANNEL_ID: "ch", ESCAPE_KEY: "k".repeat(40) };
const M = await import(ROOT + "eastscape/exchange.js"), G = await import(pathToFileURL(path.join(REPO, "v3/assets/js/eastscape-shared.js")).href);
const ask = async (body, key = env.ESCAPE_KEY) => { const r = await M.onRequestPost({ env, waitUntil() {}, request: new Request("https://eastcoin.vip/api/eastscape/exchange", { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "X-Escape-Key": key } : {}) }, body: JSON.stringify(body) }) }); return { status: r.status, body: await r.json() }; };
const ops = (like) => raw.prepare(`SELECT idempotency_key k, amount, status FROM wallet_operations WHERE idempotency_key LIKE ? ORDER BY rowid`).all(like);

check("the game's copy of the numbers is the site's", G.DEX.rate === M.RATE && G.DEX.capHour === M.CAP_HOUR && G.DEX.ticket.face === M.TICKET.face && JSON.stringify(G.DEX.ticket.table) === JSON.stringify(M.TICKET.table));
check("the ticket table adds to 100 chances and returns under its face", M.TICKET.table.reduce((a, [, w]) => a + w, 0) === 100 && M.TICKET.table.reduce((a, [z, w]) => a + z * w, 0) / 100 < M.TICKET.face);
check("no ticket pays more than an hour's allowance", Math.max(...M.TICKET.table.map(([z]) => z)) <= M.CAP_HOUR);

let r = await ask({ op: "status", userId: "u1" }, "wrong-key");
check("wrong key: 403, definite", r.status === 403 && r.body.definite === true);
r = await ask({ op: "status", userId: "u1" }, null); check("no key: 403", r.status === 403);
r = await ask({ op: "status", userId: "nobody" }); check("unknown player: definite no", r.status === 404 && r.body.definite === true);
r = await ask({ op: "status", userId: "u1" }); check("status: a full allowance, the rate and the ticket", r.body.ok && r.body.left === 25 && r.body.rate === 100 && r.body.ticket.face === 5 && r.body.enabled === true);

r = await ask({ op: "pay", userId: "u1", id: "exch0001", zc: 10 });
check("pay 10: credited once", r.body.ok && r.body.zc === 10 && balances.alice === 20 && r.body.left === 15 && r.body.balance === 20);
r = await ask({ op: "pay", userId: "u1", id: "exch0001", zc: 10 });
check("the same id again: says it paid, pays nothing new", r.body.ok && r.body.duplicate && balances.alice === 20 && ops("GAMBA:DEX:%").length === 1);
r = await ask({ op: "pay", userId: "u1", id: "exch0002", zc: 16 });
check("over the allowance: definite no, nothing moves", r.status === 429 && r.body.code === "CAP" && r.body.definite === true && balances.alice === 20 && r.body.left === 15);
for (const bad of [{ zc: 0 }, { zc: -5 }, { zc: 26 }, { zc: "x" }, { id: "short" }, { id: "has spaces in it" }]) { r = await ask({ op: "pay", userId: "u1", id: "exch0003", zc: 5, ...bad }); check(`bad ask ${JSON.stringify(bad)}: definite no`, r.status === 400 && r.body.definite === true && balances.alice === 20); }
r = await ask({ op: "pay", userId: "u1", id: "exch0004", zc: 15 });
check("the rest of the hour: paid, allowance now 0", r.body.ok && balances.alice === 35 && r.body.left === 0);
r = await ask({ op: "pay", userId: "u1", id: "exch0005", zc: 1 }); check("one more: CAP", r.body.code === "CAP" && balances.alice === 35);
r = await ask({ op: "ticket", userId: "u1", id: "tick0001" }); check("a ticket with nothing left: CAP, nothing rolled", r.body.code === "CAP" && raw.prepare(`SELECT COUNT(*) n FROM gamba_tickets`).get().n === 0);

// an hour on: the ledger's own clock decides, so age the rows
raw.exec(`UPDATE wallet_operations SET created_at = datetime('now', '-61 minutes')`);
r = await ask({ op: "status", userId: "u1" }); check("an hour later the allowance is back", r.body.left === 25);

// StreamElements down: NOT a definite no, the hour still counts it, and the same id never pays twice
seDown = true; r = await ask({ op: "pay", userId: "u2", id: "exch0100", zc: 5 });
check("wallet down: unknown outcome (definite:false), held for reconciliation", r.status === 502 && r.body.definite === false && ops("GAMBA:DEX:exch0100")[0].status === "NEEDS_RECONCILIATION" && balances.bob === 0);
seDown = false; r = await ask({ op: "pay", userId: "u2", id: "exch0100", zc: 5 });
check("asking again with that id: still unknown, still nothing paid twice", r.body.ok === false && r.body.definite === false && balances.bob === 0 && ops("GAMBA:DEX:exch0100").length === 1);
r = await ask({ op: "status", userId: "u2" }); check("the unknown 5 still counts against the hour", r.body.left === 20);

// tickets: rolled once, paid once, 5 of the hour each whatever they pay
const seen = {}; let paidOut = 0, n = 0;
for (let i = 0; i < 300; i++) {
  raw.exec(`DELETE FROM gamba_tickets WHERE user_id = 'u3'`); raw.exec(`UPDATE wallet_operations SET created_at = datetime('now', '-2 hours') WHERE user_id = 'u3'`);   // a fresh hour each time
  const id = `tick${String(1000 + i)}`, before = balances.carol; r = await ask({ op: "ticket", userId: "u3", id });
  if (!r.body.ok) { check("a ticket is answered", false, JSON.stringify(r.body)); break; }
  seen[r.body.prize] = (seen[r.body.prize] || 0) + 1; paidOut += r.body.prize; n++;
  if (balances.carol - before !== r.body.prize) { check("a ticket pays exactly what it shows", false, `${balances.carol - before} vs ${r.body.prize}`); break; }
  if (i === 0) {
    const again = await ask({ op: "ticket", userId: "u3", id });
    check("the same ticket id again: the same prize, nothing new paid or rolled", again.body.ok && again.body.duplicate && again.body.prize === r.body.prize && balances.carol - before === r.body.prize && raw.prepare(`SELECT COUNT(*) n FROM gamba_tickets WHERE id = ?`).get(id).n === 1);
    check("a ticket uses 5 of the hour whatever it paid", again.body.left === 20 || r.body.left === 20);
  }
}
check("300 tickets: every prize is on the table", Object.keys(seen).every((z) => M.TICKET.table.some(([t]) => t === Number(z))), JSON.stringify(seen));
check("300 tickets: paid back 55-120% of face (86% expected)", paidOut / (n * 5) > 0.55 && paidOut / (n * 5) < 1.2, `${Math.round(paidOut / (n * 5) * 100)}%`);

// five tickets fill an hour
r = await ask({ op: "pay", userId: "u1", id: "exch0150", zc: 1 }); check("300 tickets' worth in a day trips the fuse (it is a fuse, not a limit)", r.body.code === "BREAKER" || paidOut + 60 < M.DAY_BREAKER, r.body.code || "under the fuse this run");
raw.exec(`DELETE FROM gamba_tickets`); raw.exec(`UPDATE wallet_operations SET created_at = datetime('now', '-2 days')`);
for (let i = 0; i < 5; i++) r = await ask({ op: "ticket", userId: "u1", id: `fill000${i}` });
check("five tickets is the hour", r.body.ok && r.body.left === 0);
r = await ask({ op: "ticket", userId: "u1", id: "fill0009" }); check("a sixth: CAP", r.body.code === "CAP");
r = await ask({ op: "pay", userId: "u1", id: "exch0200", zc: 1 }); check("and no straight ZCoins either: one allowance", r.body.code === "CAP");

// a banned player
await (await import(ROOT + "picks/_bans.js")).ensureBans(db);
raw.exec(`DELETE FROM gamba_tickets`); raw.exec(`UPDATE wallet_operations SET created_at = datetime('now', '-2 days')`);
try { raw.prepare(`INSERT INTO user_bans (user_id, login, reason, by_login) VALUES ('u1', 'alice', 'test', 'admin')`).run(); } catch (e) { console.log("(ban insert shape differs: " + e.message + ")"); }
r = await ask({ op: "pay", userId: "u1", id: "exch0300", zc: 1 });
check("banned: definite no", r.body.ok === false && r.body.code === "BANNED" && r.body.definite === true, r.body.code);

// the fuse
raw.exec(`INSERT INTO wallet_operations (id, idempotency_key, user_id, type, amount, status) VALUES ('opx', 'GAMBA:DEX:fusefuse', 'u2', 'PAYOUT_CREDIT', ${M.DAY_BREAKER}, 'CONFIRMED')`);
raw.exec(`UPDATE wallet_operations SET created_at = datetime('now', '-2 hours') WHERE id = 'opx'`);
r = await ask({ op: "pay", userId: "u3", id: "exch0400", zc: 1 }); check("day fuse blown: definite no for everyone", r.body.code === "BREAKER" && r.body.definite === true);

// wallet switched off
const off = { ...env, STREAMELEMENTS_JWT: "" }; const r2 = await M.onRequestPost({ env: off, waitUntil() {}, request: new Request("https://x/api", { method: "POST", headers: { "X-Escape-Key": env.ESCAPE_KEY }, body: JSON.stringify({ op: "pay", userId: "u3", id: "exch0500", zc: 1 }) }) });
const b2 = await r2.json(); check("wallet not configured: definite no", b2.ok === false && b2.definite === true, b2.code);

console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
