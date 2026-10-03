/* ============================================================
   POST /api/arena/backup — East Arena's characters, to R2 (2026-10-03)

   East Arena keeps everything (characters, item ownership, the season
   board, parties, chat) in its own game server's Durable Object storage
   (the eastcoin-arena Worker's Lounge), which has no Time Travel and no
   undo. So it is copied out nightly, to the same R2 bucket the Picks
   database and EastScape already use:

     arena/lounge/2026-10-03T0940Z.json.gz   (dated copy)
     arena/lounge/latest.json.gz             (always the newest)

   The same shape as /api/eastscape/backup, on purpose: one bucket, one
   prune rule (30 days), one way of doing it. The arena server answers
   /export behind ARENA_KEY, the secret the site's ban kick already uses
   (a Pages secret here, a Worker secret there).

     GET /api/arena/backup   → what the last one did (admins)

   The nightly run is the eastcoin-picks-cron Worker at 09:40 UTC (its own
   minute: a firing delivers one event). Restore:
   tools/arena-restore-from-backup.mjs, a dry run unless told otherwise,
   which the arena server refuses while anyone is connected.
   ============================================================ */

import { getSessionUser, json, fail, safeEqual, ADMIN_ALLOWLIST } from "../picks/_lib.js";
import { noteStatus, readStatus } from "../picks/_ops.js";

const PREFIX = "arena/lounge/";
const KEEP_DAYS = 30;

async function authorize(context, db) {
  const user = await getSessionUser(db, context.request);
  if (user && ADMIN_ALLOWLIST.has(user.login)) return { ok: true, by: user.login };
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

  const base = String(env.ARENA_WORKER_URL || "https://arena.eastcoin.vip").trim().replace(/\/$/, "");
  const key = String(env.ARENA_KEY || "").trim();
  // Loud rather than silent: an unset key otherwise looks exactly like a quiet night.
  if (!key) return fail("NOT_CONFIGURED", "ARENA_KEY is not set on this Pages project.", 503);

  const started = Date.now();
  let dump;
  try {
    const r = await fetch(`${base}/export`, { method: "POST", headers: { "X-Arena-Key": key } });
    if (!r.ok) return fail("WORKER_REFUSED", `The arena server answered ${r.status}: check ARENA_KEY matches on both sides.`, 502);
    dump = await r.json();
  } catch (error) {
    console.error("arena backup: server unreachable", error);
    return fail("UNREACHABLE", "Could not reach the arena server.", 502);
  }
  if (!dump?.ok || !dump.data) return fail("BAD_DUMP", "The arena server did not return its data.", 502);

  const keys = Object.keys(dump.data);
  // An arena with nothing in it is far more likely a bug than the truth, and
  // overwriting latest.json.gz with it would destroy the good copy.
  if (!keys.length) return fail("EMPTY", "The arena server returned nothing; refusing to overwrite the last good backup.", 502);
  const chars = keys.filter((k) => k.startsWith("arena:")).length;

  const takenAt = new Date(dump.takenAt || Date.now());
  const body = JSON.stringify({ server: "eastcoin-arena", takenAt: takenAt.toISOString(), by: auth.by, rules: dump.rules, save: dump.save, season: dump.season, online: dump.online, data: dump.data });
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
    console.error("arena backup: prune failed", error);
  }

  const summary = { at: takenAt.toISOString(), by: auth.by, key: objKey, bytes: gz.byteLength, rawBytes: body.length, keys: keys.length, characters: chars, online: dump.online || 0, pruned, ms: Date.now() - started };
  await noteStatus(db, "arena:backup:last", summary).catch(() => {});
  return json({ ok: true, ...summary });
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks database is not connected.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) return fail("NOT_ALLOWED", "Not allowed.", 403);
  const status = await readStatus(db, ["arena:backup:last"]);
  return json({ ok: true, bound: Boolean(context.env.BACKUPS), configured: Boolean(context.env.ARENA_KEY), last: status["arena:backup:last"]?.value || null });
}
