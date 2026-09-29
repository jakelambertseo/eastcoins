/* ============================================================
   POST /api/eastscape/health — sample the game world, every 5 minutes

   The world keeps its numbers in memory, which means they vanish
   with the Durable Object. This copies them into ops_status so the
   dashboard can show them and so "was it slow at 8pm?" is a question
   with an answer the morning after.

   Called by the picks cron on its five-minute tick. One row, kept in
   place, plus a short rolling history — deliberately not a table: at
   288 samples a day a metrics table would be the biggest thing in the
   database inside a month, for numbers nobody reads after a week.

     GET → the last sample and the recent history (owner)

   Tick time is the number to watch. The world steps every 50ms; a p95
   anywhere near that means everyone is playing a slow game, and it is
   the signal that the snapshot work can no longer wait.
   ============================================================ */

import { getSessionUser, json, fail, safeEqual, ADMIN_ALLOWLIST } from "../picks/_lib.js";
import { noteStatus, readStatus } from "../picks/_ops.js";

const KEEP = 48;   // the last four hours at five-minute samples

async function authorize(context, db) {
  const user = await getSessionUser(db, context.request);
  if (user && ADMIN_ALLOWLIST.has(user.login)) return { ok: true, by: user.login };
  const expected = String(context.env.PICKS_CRON_KEY || "").trim();
  const given = String(context.request.headers.get("X-Picks-Cron-Key") || "").trim();
  if (expected && given && safeEqual(given, expected)) return { ok: true, by: "cron" };
  return { ok: false };
}

export async function onRequestPost(context) {
  const { env } = context;
  const db = env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks database is not connected.", 503);
  const auth = await authorize(context, db);
  if (!auth.ok) return fail("NOT_ALLOWED", "Not allowed.", 403);

  const base = String(env.ESCAPE_WORKER_URL || "").trim().replace(/\/$/, "");
  if (!base) return fail("NOT_CONFIGURED", "ESCAPE_WORKER_URL is not set on this Pages project.", 503);

  let stats = null, reachable = true, error = null;
  try {
    const r = await fetch(`${base}/stats`, { headers: { "Cache-Control": "no-store" } });
    if (r.ok) stats = await r.json();
    else { reachable = false; error = `HTTP ${r.status}`; }
  } catch (e) {
    reachable = false;
    error = String(e?.message || e).slice(0, 200);
  }

  const at = new Date().toISOString();
  // An unreachable world is itself the thing worth recording — a gap in the
  // history is indistinguishable from the cron not having run.
  const sample = reachable
    ? { at, online: stats.online, peak: stats.peak, scenes: stats.scenes, p50: stats.tick?.p50, p95: stats.tick?.p95, max: stats.tick?.max, outBytesPerS: stats.rate?.outBytesPerS, offers: stats.offers, upS: stats.upS }
    : { at, down: true, error };

  const prev = await readStatus(db, ["eastscape:health"]).catch(() => ({}));
  const history = Array.isArray(prev["eastscape:health"]?.value?.history) ? prev["eastscape:health"].value.history : [];
  await noteStatus(db, "eastscape:health", {
    last: sample,
    budgetMs: stats?.tick?.budgetMs || 50,
    busiest: reachable ? stats.busiest : null,
    history: [...history, sample].slice(-KEEP)
  }).catch(() => {});

  if (!reachable) return fail("WORLD_DOWN", `The game server did not answer: ${error}`, 502);
  return json({ ok: true, ...sample });
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks database is not connected.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) return fail("NOT_ALLOWED", "Not allowed.", 403);
  const status = await readStatus(db, ["eastscape:health"]);
  return json({ ok: true, configured: Boolean(context.env.ESCAPE_WORKER_URL), ...(status["eastscape:health"]?.value || {}) });
}
