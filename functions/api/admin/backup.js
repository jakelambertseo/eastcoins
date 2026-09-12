/* ============================================================
   POST /api/admin/backup — the whole database, to R2

   Every table in the Picks database, dumped as one gzipped JSON
   file into the R2 bucket bound as BACKUPS:

     d1/eastcoin-picks/2026-09-10T0900Z.json.gz   (dated copy)
     d1/eastcoin-picks/latest.json.gz             (always the newest)

   Called nightly by the picks cron Worker with the cron key, or by
   the owner from the dashboard. Copies older than KEEP_DAYS are
   pruned on the way. Read-only against D1; nothing here writes to
   the database except the note the dashboard reads.

     GET /api/admin/backup   → what the last backup was (owner)

   Restore: tools/d1-restore-from-backup.mjs turns the JSON back
   into SQL for `wrangler d1 execute`. D1's own Time Travel (30
   days, built in) is the first thing to reach for; this is the
   copy that lives outside Cloudflare's database entirely.
   ============================================================ */

import { getSessionUser, json, fail, safeEqual, ADMIN_ALLOWLIST } from "../picks/_lib.js";
import { noteStatus, readStatus } from "../picks/_ops.js";

const OWNERS = ADMIN_ALLOWLIST;
const PREFIX = "d1/eastcoin-picks/";
const KEEP_DAYS = 30;
const PAGE = 2000;

async function authorize(context, db) {
  const user = await getSessionUser(db, context.request);
  if (user && OWNERS.has(user.login)) return { ok: true, by: user.login };
  const expected = String(context.env.PICKS_CRON_KEY || "").trim();
  const given = String(context.request.headers.get("X-Picks-Cron-Key") || "").trim();
  if (expected && given && safeEqual(given, expected)) return { ok: true, by: "cron" };
  return { ok: false };
}

/** Every user table, in a stable order. */
async function tableNames(db) {
  const rows = await db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name`)
    .all();
  return (rows.results || []).map((r) => String(r.name));
}

/** All rows of one table, paged so a big table never blows a single query. */
async function dumpTable(db, name) {
  const out = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await db.prepare(`SELECT * FROM "${name.replace(/"/g, '""')}" LIMIT ? OFFSET ?`).bind(PAGE, offset).all();
    const rows = page.results || [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function gzip(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

function stamp(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace(/^(\d{4})(\d{2})(\d{2})T(\d{4})\d{2}Z$/, "$1-$2-$3T$4Z");
}

export async function onRequestPost(context) {
  const { env } = context;
  const db = env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks database is not connected.", 503);
  const auth = await authorize(context, db);
  if (!auth.ok) return fail("NOT_ALLOWED", "Not allowed.", 403);
  if (!env.BACKUPS) return fail("NO_BUCKET", "No R2 bucket is bound as BACKUPS on this Pages project.", 503);

  const started = Date.now();
  const names = await tableNames(db);
  const tables = {};
  let rows = 0;
  for (const name of names) {
    tables[name] = await dumpTable(db, name);
    rows += tables[name].length;
  }

  const takenAt = new Date();
  const body = JSON.stringify({ database: "eastcoin-picks", takenAt: takenAt.toISOString(), by: auth.by, tables });
  const gz = await gzip(body);
  const key = `${PREFIX}${stamp(takenAt)}.json.gz`;
  const meta = { httpMetadata: { contentType: "application/gzip" }, customMetadata: { takenAt: takenAt.toISOString(), tables: String(names.length), rows: String(rows) } };
  await env.BACKUPS.put(key, gz, meta);
  await env.BACKUPS.put(`${PREFIX}latest.json.gz`, gz, meta);

  // Prune: anything dated older than KEEP_DAYS goes.
  let pruned = 0;
  try {
    const cutoff = Date.now() - KEEP_DAYS * 86400 * 1000;
    let cursor;
    do {
      const list = await env.BACKUPS.list({ prefix: PREFIX, cursor });
      for (const obj of list.objects) {
        if (obj.key.endsWith("latest.json.gz")) continue;
        if (new Date(obj.uploaded).getTime() < cutoff) { await env.BACKUPS.delete(obj.key); pruned += 1; }
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
  } catch (error) {
    console.error("backup: prune failed", error);
  }

  const summary = { at: takenAt.toISOString(), by: auth.by, key, bytes: gz.byteLength, rawBytes: body.length, tables: names.length, rows, pruned, ms: Date.now() - started };
  await noteStatus(db, "backup:last", summary).catch(() => {});
  return json({ ok: true, ...summary });
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks database is not connected.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user || !OWNERS.has(user.login)) return fail("NOT_ALLOWED", "Not allowed.", 403);
  const status = await readStatus(db, ["backup:last"]);
  return json({ ok: true, bound: Boolean(context.env.BACKUPS), last: status["backup:last"]?.value || null });
}
