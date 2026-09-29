/* The stale-round sweep —  node tools/casino-sweep-test.mjs
   No server: settleStale's job is to FIND the rounds nobody settled, so this checks the finding, against Node's own SQLite
   through a D1-shaped shim. Settling itself is settleRound's, and it is already idempotent per bet.

   What used to happen: the state poll settled round n and round n-1 and nothing else, so a round whose players all closed
   their tabs kept its stake and stayed ACTIVE for good — never paid, never marked LOST, invisible to hourlyNet, the ledger
   and the book, all of which filter on WON/LOST. */
import { DatabaseSync } from "node:sqlite";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };

const raw = new DatabaseSync(":memory:");
raw.exec(`CREATE TABLE casino_bets (id TEXT PRIMARY KEY, game TEXT, round_no INTEGER, user_id TEXT, pick TEXT, wager INTEGER, status TEXT, payout INTEGER)`);
raw.exec(`CREATE TABLE coin_bets (id TEXT PRIMARY KEY, round_no INTEGER, user_id TEXT, pick TEXT, wager INTEGER, status TEXT, payout INTEGER)`);

const db = {
  prepare(sql) {
    const st = { sql, args: [] };
    const all = async () => ({ results: raw.prepare(st.sql).all(...st.args) });
    return { bind: (...a) => { st.args = a; return { all, run: async () => ({ meta: { changes: 0 } }), first: async () => raw.prepare(st.sql).get(...st.args) ?? null }; }, all };
  }
};

/* The finder, lifted verbatim from _engine.js/_coin.js so the test exercises the real query shape. */
const findShared = async (game, now, limit = 8) => {
  const openNo = Math.floor(now / game.cycleMs);
  const r = await db.prepare(`SELECT DISTINCT round_no FROM casino_bets WHERE game = ? AND status = 'ACTIVE' AND round_no < ? ORDER BY round_no LIMIT ?`).bind(game.key, openNo, limit).all();
  return (r.results || []).map((x) => Number(x.round_no));
};
const findCoin = async (cycleMs, now, limit = 8) => {
  const openNo = Math.floor(now / cycleMs);
  const r = await db.prepare(`SELECT DISTINCT round_no FROM coin_bets WHERE status = 'ACTIVE' AND round_no < ? ORDER BY round_no LIMIT ?`).bind(openNo, limit).all();
  return (r.results || []).map((x) => Number(x.round_no));
};

const game = { key: "wheel", cycleMs: 60000 };
const now = 100 * 60000 + 5000;             // we are part-way through round 100
const put = (n, status) => raw.prepare(`INSERT INTO casino_bets VALUES (?, 'wheel', ?, 'u1', 'red', 20, ?, 0)`).run(`b${n}${status}`, n, status);

put(100, "ACTIVE");                          // the round in play — must be left alone
put(99, "ACTIVE");                           // the one the old code caught
put(96, "ACTIVE");                           // the ones it did NOT: abandoned, stake stranded
put(90, "ACTIVE");
put(80, "WON");                              // already settled — must not be picked up again

const found = await findShared(game, now);
check("the round still in play is left alone", !found.includes(100), found.join(","));
check("the round before is found", found.includes(99));
check("rounds the old code missed are found too", found.includes(96) && found.includes(90), found.join(","));
check("an already-settled round is not picked up again", !found.includes(80), found.join(","));
check("oldest first, so a backlog drains in order", found[0] === 90, found.join(","));

// Bounded, so one request cannot be made to do unbounded work.
for (let n = 10; n < 60; n++) put(n, "ACTIVE");
const many = await findShared(game, now);
check("the sweep is bounded", many.length === 8, `${many.length}`);
check("and still takes the oldest first", many[0] === 10, many.join(","));

// The coin keeps its own table and its own cycle.
raw.prepare(`INSERT INTO coin_bets VALUES ('c1', ?, 'u1', 'heads', 20, 'ACTIVE', 0)`).run(3);
raw.prepare(`INSERT INTO coin_bets VALUES ('c2', ?, 'u1', 'heads', 20, 'ACTIVE', 0)`).run(9999999);
const coin = await findCoin(30000, 10 * 30000 + 1000);
check("the coin finds its own stranded round", coin.includes(3), coin.join(","));
check("and not one from the future", !coin.includes(9999999), coin.join(","));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
