/* The casino's committed seeds, under concurrency —  node tools/casino-commit-test.mjs
   No server and no network: the two claimCommit functions are pure database work, so this runs them against Node's own SQLite
   through a shim with D1's shape.

   THE POINT IS THE INTERLEAVING. node:sqlite is synchronous, so if the shim resolved immediately nothing would ever race and
   the test would pass against the very bug it is meant to catch. Every statement therefore yields to the macrotask queue
   first, the way a real D1 round trip does, which lets N in-flight claims genuinely overlap between their SELECT and their
   UPDATE — exactly the window where two Plinko drops used to walk away with the same seed. */
import { DatabaseSync } from "node:sqlite";
import { claimCommit as claimPlinko } from "../functions/api/casino/plinko/_plinko.js";
import { claimCommit as claimScratch } from "../functions/api/casino/scratch/_scratch.js";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };
const tick = () => new Promise((r) => setTimeout(r, 0));

/** D1's surface over node:sqlite, with a yield before every statement so concurrent callers really do interleave. */
function d1(db) {
  return {
    prepare(sql) {
      const stmt = { sql, args: [] };
      const run = async () => { await tick(); const r = db.prepare(stmt.sql).run(...stmt.args); return { meta: { changes: Number(r.changes) } }; };
      const first = async () => { await tick(); return db.prepare(stmt.sql).get(...stmt.args) ?? null; };
      const all = async () => { await tick(); return { results: db.prepare(stmt.sql).all(...stmt.args) }; };
      return { bind: (...a) => { stmt.args = a; return { run, first, all }; }, run, first, all };
    }
  };
}

function fresh() {
  const raw = new DatabaseSync(":memory:");
  for (const t of ["plinko_commits", "scratch_commits"]) {
    raw.exec(`CREATE TABLE ${t} (user_id TEXT PRIMARY KEY, seed TEXT NOT NULL, hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`);
  }
  return d1(raw);
}

for (const [game, claim] of [["Plinko", claimPlinko], ["Scratch-Off", claimScratch]]) {
  const db = fresh(), user = "u1";

  // One claim on a player with no row yet: it should mint a commitment and hand it straight back.
  const one = await claim(db, user);
  check(`${game}: a first claim works`, !!one?.used?.seed && !!one?.next?.seed, JSON.stringify(one));
  check(`${game}: the seed played is not the seed promised for next time`, one.used.seed !== one.next.seed);

  // Twenty at once. Exactly one may come away with a seed; the rest must get nothing to play.
  const burst = await Promise.all(Array.from({ length: 20 }, () => claim(db, user)));
  const won = burst.filter(Boolean);
  check(`${game}: 20 simultaneous claims, exactly one wins`, won.length === 1, `${won.length} won`);

  // The one that won must not have been handed the seed the previous play already spent.
  check(`${game}: the winner did not get the spent seed`, won[0].used.seed !== one.used.seed, `${won[0]?.used?.seed}`);

  // And no two winners across the whole run ever shared a seed — the actual exploit.
  const seen = new Set([one.used.seed, ...won.map((w) => w.used.seed)]);
  check(`${game}: no seed was ever played twice`, seen.size === 1 + won.length, `${seen.size} distinct`);

  // Drain it properly: claims one after another must each get a different seed.
  const serial = [];
  for (let i = 0; i < 5; i++) serial.push((await claim(db, user)).used.seed);
  check(`${game}: five claims in a row are five different seeds`, new Set(serial).size === 5, serial.join(",").slice(0, 60));
}

/* THE CONTROL. A test for a race is worthless if it cannot fail, and a synchronous database is very good at hiding races. So
   this reproduces what the code USED to do — read the row, play, rotate afterwards — and asserts that it DOES collide. If this
   ever starts passing, the harness has stopped interleaving and the checks above mean nothing. */
{
  const db = fresh(), user = "control";
  await db.prepare(`INSERT INTO plinko_commits (user_id, seed, hash) VALUES (?, ?, ?)`).bind(user, "seed-0", "hash-0").run();
  const oldWay = async () => {
    const row = await db.prepare(`SELECT * FROM plinko_commits WHERE user_id = ?`).bind(user).first();   // read
    await tick();                                                                                        // ... play the drop
    await db.prepare(`UPDATE plinko_commits SET seed = ? WHERE user_id = ?`).bind(`s${Math.random()}`, user).run();
    return row.seed;
  };
  const seeds = await Promise.all(Array.from({ length: 20 }, oldWay));
  const distinct = new Set(seeds).size;
  check("control: the OLD read-then-rotate really does hand out one seed to many drops", distinct < 20, `${distinct} distinct of 20 — if this is 20 the harness is not interleaving`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
