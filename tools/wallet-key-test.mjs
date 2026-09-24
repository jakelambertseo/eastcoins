/* Operation keys after a failure —  node tools/wallet-key-test.mjs
   No server: opDone and retryKey are pure database work, run here against Node's own SQLite through a D1-shaped shim.

   The bug they exist for: beginOperation refuses a key that already exists, and every caller read that as "this already ran"
   when it can equally mean "this already FAILED". The store keyed a purchase off a COUNT of purchases, which a failed attempt
   never creates — so the retry rebuilt the same key, was refused as a duplicate, and that item answered "already going
   through" for that account forever. The crate's key was not even per-item, so it locked out buying crates entirely. */
import { DatabaseSync } from "node:sqlite";
import { opDone, retryKey } from "../functions/api/picks/_lib.js";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || !extra ? "" : "  — " + extra}`); };

const raw = new DatabaseSync(":memory:");
raw.exec(`CREATE TABLE wallet_operations (id TEXT PRIMARY KEY, idempotency_key TEXT UNIQUE, status TEXT)`);
const db = {
  prepare(sql) {
    const st = { sql, args: [] };
    const first = async () => raw.prepare(st.sql).get(...st.args) ?? null;
    return { bind: (...a) => { st.args = a; return { first, run: async () => ({ meta: { changes: 0 } }) }; }, first };
  }
};
let n = 0;
const attempt = (key, status) => raw.prepare(`INSERT INTO wallet_operations VALUES (?, ?, ?)`).run(`op${++n}`, key, status);

const BASE = "STORE:BUY:u1:gold-name";

// First try: nothing recorded, so the plain key.
const k1 = await retryKey(db, BASE);
check("the first attempt uses the plain key", k1 === BASE, k1);
attempt(k1, "FAILED");                                  // StreamElements refused the debit

// The retry. This is the exact moment the old code bricked the item.
const k2 = await retryKey(db, BASE);
check("a retry after a failure gets a NEW key", k2 !== k1, `${k1} then ${k2}`);
check("and the new key is not already taken", !raw.prepare(`SELECT 1 FROM wallet_operations WHERE idempotency_key = ?`).get(k2));
attempt(k2, "CONFIRMED");                               // this one worked

// Once something confirmed, the caller must be able to tell.
check("opDone sees the confirmed attempt", await opDone(db, k2));
check("opDone does NOT count the failed one", !(await opDone(db, k1)));
check("opDone is false for a key never tried", !(await opDone(db, `${BASE}:nope`)));

// A third try numbers on again rather than colliding.
const k3 = await retryKey(db, BASE);
check("keys keep advancing", k3 !== k1 && k3 !== k2, k3);

// A pending attempt is not a paid one — the case that made the Daily Pot lie.
attempt("CASINO:POT:PAY:2026-09-21", "NEEDS_RECONCILIATION");
check("needing reconciliation is not 'done'", !(await opDone(db, "CASINO:POT:PAY:2026-09-21")));

// And a different item keeps its own numbering.
const other = await retryKey(db, "STORE:BUY:u1:ice-name");
check("another item is unaffected by this one's failures", other === "STORE:BUY:u1:ice-name", other);

/* ---- the three call sites that were still broken until 2026-09-21, as the shapes they now use ---- */

/* PvP: credit() reported a duplicate key as ok:true, so once a credit had failed every later attempt said "already done",
   the entry was marked WON and nobody was paid — on a round that then marked itself SETTLED and was never looked at again. */
{
  const key = "CASINO:PVP:PAY:e1";
  attempt(key, "NEEDS_RECONCILIATION");                 // the credit failed
  check("PvP: a failed credit is NOT reported as already paid", !(await opDone(db, key)));
  const next = await retryKey(db, key);
  check("PvP: the retry gets a fresh key", next !== key, next);
  attempt(next, "CONFIRMED");
  check("PvP: once one attempt confirms, the seat counts as paid", await opDone(db, next));
}

/* Hi-Lo and Mines: a failed payout left the run LIVE and spent the one key, so the player could never cash out and never
   start another. The guard is "has any attempt for this game confirmed?", which must survive the numbered retries. */
for (const g of ["CASINO:HILO:PAY:g9", "CASINO:MINES:PAY:b4"]) {
  attempt(g, "FAILED");
  const k2 = await retryKey(db, g);
  check(`${g.split(":")[1]}: a retry after a failed payout is possible`, k2 !== g, k2);
  check(`${g.split(":")[1]}: not treated as paid while only a failure exists`, !(await opDone(db, g)) && !(await opDone(db, k2)));
  attempt(k2, "CONFIRMED");
  check(`${g.split(":")[1]}: the confirmed retry is what marks it paid`, await opDone(db, k2));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
