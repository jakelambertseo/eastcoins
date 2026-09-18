/* ============================================================
   POST /api/eastscape/backup — the game world, to R2

   EastScape's characters do not live in D1. They live in the game
   worker's Durable Object storage, which has no Time Travel and no
   undo: one bad migration or a mistaken admin command is permanent.
   So the world is copied out nightly, to the same R2 bucket the
   Picks database already uses:

     eastscape/world/2026-09-19T0920Z.json.gz   (dated copy)
     eastscape/world/latest.json.gz             (always the newest)

   Why the site does this rather than the game worker: the bucket is
   already bound here, the prune rule already lives here, and the
   dashboard already reads ops_status. One bucket, one rule, one card.

   The worker is asked for the dump over /export, guarded by
   ESCAPE_KEY — the same value must be a secret on the game worker and
   a Pages variable here. The worker saves every connected character
   before it answers, so a backup is never four seconds stale.

     GET /api/eastscape/backup   → what the last one did (owner)

   Restore: tools/eastscape-restore-from-backup.mjs. It is a dry run
   unless told otherwise, and the worker refuses to restore while
   anyone is connected.
   ============================================================ */

import { getSessionUser, json, fail, safeEqual, ADMIN_ALLOWLIST } from "../picks/_lib.js";
import { noteStatus, readStatus } from "../picks/_ops.js";

const OWNERS = ADMIN_ALLOWLIST;
const PREFIX = "eastscape/world/";
const KEEP_DAYS = 30;

async function authorize(context, db) {
  const user = await getSessionUser(db, context.request);
  if (user && OWNERS.has(user.login)) return { ok: true, by: user.login };
  const expected = String(context.env.PICKS_CRON_KEY || "").trim();
  const given = String(context.request.headers.get("X-Picks-Cron-Key") || "").trim();
  if (expected && given && safeEqual(given, expected)) return { ok: true, by: "cron" };
  return { ok: false };
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

  const base = String(env.ESCAPE_WORKER_URL || "").trim().replace(/\/$/, "");
  const key = String(env.ESCAPE_KEY || "").trim();
  // Loud rather than silent: an unset variable otherwise looks exactly like a
  // quiet night, and this is the only copy of everyone's character.
  if (!base || !key) return fail("NOT_CONFIGURED", "ESCAPE_WORKER_URL or ESCAPE_KEY is not set on this Pages project.", 503);

  const started = Date.now();
  let dump;
  try {
    const r = await fetch(`${base}/export`, { method: "POST", headers: { "X-Escape-Key": key } });
    if (!r.ok) return fail("WORKER_REFUSED", `The game server answered ${r.status} — check ESCAPE_KEY matches on both sides.`, 502);
    dump = await r.json();
  } catch (error) {
    console.error("eastscape backup: worker unreachable", error);
    return fail("UNREACHABLE", "Could not reach the game server.", 502);
  }
  if (!dump?.ok || !dump.data) return fail("BAD_DUMP", "The game server did not return a world.", 502);

  const keys = Object.keys(dump.data);
  // A world with no characters at all is far more likely to be a bug than a
  // truth, and overwriting latest.json.gz with it would destroy the good copy.
  const chars = keys.filter((k) => k.startsWith("char:")).length;
  if (!keys.length) return fail("EMPTY", "The game server returned an empty world; refusing to overwrite the last good backup.", 502);

  const takenAt = new Date(dump.takenAt || Date.now());
  const body = JSON.stringify({ world: "eastcoin-eastscape", takenAt: takenAt.toISOString(), by: auth.by, rulesVersion: dump.rulesVersion, saveVersion: dump.saveVersion, online: dump.online, data: dump.data });
  const gz = await gzip(body);
  const objKey = `${PREFIX}${stamp(takenAt)}.json.gz`;
  const meta = { httpMetadata: { contentType: "application/gzip" }, customMetadata: { takenAt: takenAt.toISOString(), keys: String(keys.length), characters: String(chars) } };
  await env.BACKUPS.put(objKey, gz, meta);
  await env.BACKUPS.put(`${PREFIX}latest.json.gz`, gz, meta);

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
    console.error("eastscape backup: prune failed", error);
  }

  const summary = { at: takenAt.toISOString(), by: auth.by, key: objKey, bytes: gz.byteLength, rawBytes: body.length, keys: keys.length, characters: chars, online: dump.online || 0, pruned, ms: Date.now() - started };
  await noteStatus(db, "eastscape:backup:last", summary).catch(() => {});
  return json({ ok: true, ...summary });
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks database is not connected.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user || !OWNERS.has(user.login)) return fail("NOT_ALLOWED", "Not allowed.", 403);
  const status = await readStatus(db, ["eastscape:backup:last"]);
  return json({ ok: true, bound: Boolean(context.env.BACKUPS), configured: Boolean(context.env.ESCAPE_WORKER_URL && context.env.ESCAPE_KEY), last: status["eastscape:backup:last"]?.value || null });
}
