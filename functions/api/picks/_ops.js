/* ============================================================
   EastCoin — operational status notes

   Small facts the dashboard wants to know that nothing else
   records: when settlement last ran and what it did, how many
   Odds API credits are left, when the auto-opener last fetched.
   One row per key, overwritten in place. Created on first use.
   ============================================================ */

let ready = false;

export async function ensureOps(db) {
  if (ready) return;
  await db
    .prepare(`CREATE TABLE IF NOT EXISTS ops_status (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
    .run();
  ready = true;
}

/** Never throws: a status note must not take down the thing it describes. */
export async function noteStatus(db, key, value) {
  try {
    await ensureOps(db);
    await db
      .prepare(`INSERT INTO ops_status (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
      .bind(key, JSON.stringify(value))
      .run();
  } catch (error) {
    console.error(`ops: couldn't note ${key}`, error);
  }
}

export async function readStatus(db, keys) {
  await ensureOps(db);
  const marks = keys.map(() => "?").join(",");
  const rows = await db.prepare(`SELECT key, value, updated_at FROM ops_status WHERE key IN (${marks})`).bind(...keys).all();
  const out = {};
  for (const r of rows.results || []) {
    let value = null;
    try { value = JSON.parse(r.value); } catch { value = r.value; }
    out[r.key] = { value, at: String(r.updated_at).replace(" ", "T") + "Z" };
  }
  return out;
}

/** The Odds API reports quota on every response; keep the latest. */
export async function noteOddsQuota(db, response, what) {
  const used = Number(response.headers.get("x-requests-used"));
  const remaining = Number(response.headers.get("x-requests-remaining"));
  if (!Number.isFinite(used) && !Number.isFinite(remaining)) return;
  await noteStatus(db, "odds:quota", { used, remaining, last: what });
}
