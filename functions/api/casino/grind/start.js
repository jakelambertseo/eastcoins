/* POST /api/casino/grind/start  { job: "clicks" | "sort" }

   Clocks in for a job. Refused signed out, when the wallet is not
   configured, inside the hour after the caller's last shift AT THAT JOB,
   and when they are not under the broke line (read live from
   StreamElements). A shift already being worked at that job is handed
   back rather than doubled. Nothing is charged. */

import { getSessionUser, walletWritesEnabled, readBalance, newId, json, fail } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, randomSeed } from "../_engine.js";
import { ensureGrind, workingShift, nextShiftAt, publicShift, jobOf, BROKE_LINE, SHIFT_COOLDOWN_MS } from "./_grind.js";

const GRIND = { key: "grind" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensureGrind(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to work a shift.", 401);
  if (!walletWritesEnabled(context.env)) return fail("WALLET_NOT_CONFIGURED", "ZCoin transfers aren't configured.", 503);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const job = jobOf(body.job);
  if (!job) return fail("BAD_JOB", "No such job.");

  const existing = await workingShift(db, user.id, job.key);
  if (existing) return json({ ok: true, shift: await publicShift(existing) });

  const now = Date.now();
  const next = await nextShiftAt(db, user.id, job.key, now);
  if (next) {
    const mins = Math.ceil((next - now) / 60000);
    const wait = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} minute${mins === 1 ? "" : "s"}`;
    return fail("COOLDOWN", `One ${job.name} shift every ${Math.round(SHIFT_COOLDOWN_MS / 3600000)} hours — your next one opens in ${wait}.`, 429);
  }

  const balance = await readBalance(context.env, user.login);
  if (balance === null) return fail("BALANCE_UNAVAILABLE", "Couldn't read your ZCoin balance. Try again in a moment.", 503);
  if (balance >= BROKE_LINE) {
    return fail("NOT_BROKE", `The Grind is for anyone under ${BROKE_LINE} ZCoins — you've got ${balance.toLocaleString()}. Go play.`, 403);
  }

  const id = newId("gr");
  try {
    await db.prepare(`INSERT INTO grind_shifts (id, user_id, job, seed, balance_at_start, last_click_ms) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, user.id, job.key, job.key === "sort" ? randomSeed() : null, balance, now).run();
  } catch {
    // Two "clock in" presses at once: the unique index let one through.
    const again = await workingShift(db, user.id, job.key);
    if (again) return json({ ok: true, shift: await publicShift(again) });
    return fail("START_FAILED", "Couldn't clock you in. Try again.", 500);
  }
  await touchPresence(db, GRIND, user.id, now);
  return json({ ok: true, shift: await publicShift(await workingShift(db, user.id, job.key)), balance });
}
