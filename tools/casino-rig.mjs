// A local stand-in for eastcoin.vip, for testing anything that plays the REAL casino from a page (GambaScape's real tables).
// It serves the repo's static files AND runs the site's actual Pages functions for /api/*, against an in-memory SQLite
// shaped like D1, with StreamElements stubbed at fetch() and one player (bootypaper, 500 ZC) always signed in.
// Nothing here can reach production and no real ZCoin moves.
//   node tools/casino-rig.mjs [port=4321]        (the game server's dev mode only accepts pages from localhost:4321)
//   GET /__rig  -> the fake wallet and the ledger's row counts, for a test to read
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite"; import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), PORT = Number(process.argv[2]) || 4321;
const FN = path.join(REPO, "functions");
class Stmt {
  constructor(raw, sql) { this.raw = raw; this.sql = sql; this.args = []; }
  bind(...x) { this.args = x.map((v) => (v === undefined ? null : typeof v === "boolean" ? Number(v) : v)); return this; }
  async first() { return this.raw.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.args) }; }
  async run() { const i = this.raw.prepare(this.sql).run(...this.args); return { meta: { changes: Number(i.changes) } }; }
}
const raw = new DatabaseSync(":memory:"), db = { prepare: (sql) => new Stmt(raw, sql), batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
for (const f of fs.readdirSync(path.join(REPO, "migrations")).filter((x) => x.endsWith(".sql")).sort()) { try { raw.exec(fs.readFileSync(path.join(REPO, "migrations", f), "utf8")); } catch (e) { console.log(`(migration ${f}: ${String(e.message).slice(0, 80)})`); } }
const TOKEN = "rig_token", balances = { bootypaper: 500 };
raw.exec(`INSERT INTO users (twitch_id, twitch_login, display_name) VALUES ('u1', 'bootypaper', 'BootyPaper')`);
raw.prepare(`INSERT INTO sessions (session_hash, user_id, expires_at) VALUES (?, 'u1', datetime('now', '+30 day'))`).run(crypto.createHash("sha256").update(TOKEN).digest("hex"));

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const m = String(url).match(/\/points\/[^/]+\/([^/?]+)(?:\/(-?\d+))?/);
  if (!m) return String(url).startsWith("http://127.0.0.1") || String(url).startsWith("http://localhost") ? realFetch(url, opts) : new Response("{}", { status: 404 });   // nothing else leaves this machine
  const login = decodeURIComponent(m[1]);
  if (opts.method === "PUT") { balances[login] = (balances[login] || 0) + Number(m[2]); return Response.json({ newAmount: balances[login] }); }
  return Response.json({ points: balances[login] ?? 0 });
};
const env = { PICKS_DB: db, STREAMELEMENTS_JWT: "jwt", STREAMELEMENTS_CHANNEL_ID: "ch" };

// /api/casino/wheel/bet -> functions/api/casino/[game]/bet.js with params.game = "wheel", the way Pages routes it
function route(p) {
  const parts = p.split("/").filter(Boolean); let dir = FN; const params = {};
  for (let i = 0; i < parts.length; i++) {
    const last = i === parts.length - 1, names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const exact = last ? names.find((n) => n === `${parts[i]}.js`) : names.find((n) => n === parts[i]);
    const dyn = names.find((n) => (last ? /^\[[^\]]+\]\.js$/.test(n) : /^\[[^\]]+\]$/.test(n)));
    const pick = exact || dyn; if (!pick) return null;
    if (pick === dyn && !exact) params[dyn.replace(/^\[|\](\.js)?$/g, "")] = parts[i];
    dir = path.join(dir, pick);
  }
  return { file: dir, params };
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2", ".wav": "audio/wav", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (u.pathname === "/__rig") { const n = (t) => { try { return raw.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n; } catch { return null; } }; res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ balances, wallet_operations: n("wallet_operations"), plinko_drops: n("plinko_drops"), scratch_cards: n("scratch_cards"), hilo_games: n("hilo_games"), mines_games: n("mines_games"), coin_bets: n("coin_bets"), casino_bets: n("casino_bets"), ops: raw.prepare(`SELECT idempotency_key k, amount, status FROM wallet_operations ORDER BY rowid DESC LIMIT 12`).all() })); }
    if (u.pathname.startsWith("/api/")) {
      const r = route(u.pathname); if (!r) { res.writeHead(404, { "content-type": "application/json" }); return res.end(JSON.stringify({ ok: false, code: "NO_ROUTE" })); }
      const mod = await import(pathToFileURL(r.file).href), body = await new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); });
      const request = new Request(u.href, { method: req.method, headers: { "content-type": req.headers["content-type"] || "application/json", cookie: `__Host-ec_session=${TOKEN}` }, body: req.method === "GET" || req.method === "HEAD" ? undefined : body });
      const h = mod[`onRequest${req.method[0]}${req.method.slice(1).toLowerCase()}`] || mod.onRequest; if (!h) { res.writeHead(405); return res.end(); }
      const out = await h({ env, request, params: r.params, waitUntil() {}, next: async () => new Response("", { status: 404 }) });
      res.writeHead(out.status, Object.fromEntries(out.headers)); return res.end(Buffer.from(await out.arrayBuffer()));
    }
    let file = path.join(REPO, decodeURIComponent(u.pathname)); if (u.pathname === "/") file = path.join(REPO, "index.html");
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" }); fs.createReadStream(file).pipe(res);
  } catch (e) { console.log("RIG ERROR", u.pathname, e); res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: false, message: String(e?.message || e) })); }
}).listen(PORT, "127.0.0.1", () => console.log(`casino rig on http://localhost:${PORT}  (bootypaper, ${balances.bootypaper} ZC, in-memory ledger)`));
