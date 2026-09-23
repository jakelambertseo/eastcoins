/* POST /api/eastscape/ach — called by the GAME SERVER, never by a page.

   EastScape runs on its own Worker with its own storage; the site's bell reads D1. So when the game awards an
   achievement it posts it here, this writes one row, and /api/picks/notifications picks it up like any other
   source. That is the whole of the bridge, and it is deliberately one-way and fire-and-forget: the game must
   never wait on the site, and a site that is down must never stop somebody earning something.

   Guarded by X-Escape-Key, the same secret the worker's own /export and /restart use. Nothing here trusts the
   body beyond its shape: the login decides whose bell it lands in, and the worker is the only thing that knows it.

   RETROACTIVE AWARDS ARE NOT SENT. A player logging in for the first time after achievements shipped earns
   thirty at once, and thirty bell rows is a wall — the game sends only what was earned live, and says so with
   `quiet`.  */

const noStore = { "Cache-Control": "no-store" };

export async function ensureAch(db) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS escape_ach (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       login TEXT NOT NULL,
       ach_id TEXT NOT NULL,
       name TEXT NOT NULL,
       tier TEXT NOT NULL,
       pts INTEGER NOT NULL DEFAULT 0,
       tix INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  ).run().catch(() => {});
  /* the bell asks "this login, since this time", which is the only query there is */
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_escape_ach_who ON escape_ach (login, created_at)`).run().catch(() => {});
  /* earned once: a replay of the same POST must not make a second row */
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_escape_ach_once ON escape_ach (login, ach_id)`).run().catch(() => {});
}

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false }, { status: 503, headers: noStore });

  const want = String(context.env.ESCAPE_KEY || "").trim();
  const got = String(context.request.headers.get("X-Escape-Key") || "").trim();
  if (!want || got !== want) return Response.json({ ok: false }, { status: 401, headers: noStore });

  let body = {};
  try { body = await context.request.json(); } catch (e) { /* bad body */ }
  const login = String(body.login || "").trim().toLowerCase().slice(0, 40);
  const list = Array.isArray(body.list) ? body.list.slice(0, 20) : [];
  if (!login || !list.length) return Response.json({ ok: false }, { status: 400, headers: noStore });

  await ensureAch(db);
  let wrote = 0;
  for (const a of list) {
    const id = String(a && a.id || "").slice(0, 40), name = String(a && a.name || "").slice(0, 60);
    const tier = String(a && a.tier || "").slice(0, 16);
    if (!id || !name) continue;
    /* OR IGNORE, not a check-then-insert: two events in the same instant cannot both write */
    const r = await db.prepare(
      `INSERT OR IGNORE INTO escape_ach (login, ach_id, name, tier, pts, tix) VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(login, id, name, tier, Math.max(0, Math.min(99, a.pts | 0)), Math.max(0, Math.min(1e7, a.tix | 0))).run().catch(() => null);
    if (r) wrote++;
  }
  return Response.json({ ok: true, wrote }, { headers: noStore });
}
