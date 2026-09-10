/* ============================================================
   EastCoin Picks — settlement scheduler

   Cloudflare Pages has no scheduled handler, so the settlement
   endpoint had no way to run unless a person pressed a button.
   That is a bad property for the thing that pays people: a market
   would sit unsettled with real ZCoins debited until someone
   remembered.

   This Worker exists only to call it on a timer. It contains no
   money logic of its own on purpose — the grading rules, the
   payout maths and the idempotency all stay in one place, behind
   /api/picks/settle. If this Worker is down, settlement is late.
   It can never be wrong.

   Deliberately separate from the music Worker. Coupling them would
   mean a music deploy could break payouts, and that shipping a
   settlement fix also ships whatever music work happens to be in
   flight.
   ============================================================ */

async function runSettlement(env, trigger) {
  const url = String(env.SETTLE_URL || "").trim();
  const key = String(env.PICKS_CRON_KEY || "").trim();

  if (!url || !key) {
    console.error("picks-cron: SETTLE_URL or PICKS_CRON_KEY missing — not running");
    return { ok: false, error: "not_configured" };
  }

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Picks-Cron-Key": key,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ trigger })
    });
  } catch (error) {
    console.error("picks-cron: settle request threw", error);
    return { ok: false, error: "unreachable" };
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    // Loud: a rotated key or a broken deploy otherwise looks exactly
    // like a quiet night with nothing to settle.
    console.error(
      `picks-cron: settle refused (${response.status})`,
      payload?.code || "",
      payload?.message || ""
    );
    return { ok: false, status: response.status, payload };
  }

  // Only say something when something happened, so the log reads as a
  // record of payouts rather than a heartbeat.
  const acted = (payload.results || []).filter((r) => r.action !== "skipped");
  if (acted.length || payload.locked) {
    console.log(
      `picks-cron: locked ${payload.locked || 0}, examined ${payload.examined}, ` +
      `settled ${acted.length} — ` +
      acted.map((r) => `${r.id}:${r.outcome} ${r.paid || 0}ZC${r.failed ? ` ${r.failed}FAILED` : ""}`).join(" ")
    );
  }

  return { ok: true, payload };
}

/**
 * The nightly backup: one POST, the Pages function does the work and
 * writes to R2. Same key as settlement; nothing else to configure here.
 */
async function runBackup(env) {
  const url = String(env.BACKUP_URL || "").trim();
  const key = String(env.PICKS_CRON_KEY || "").trim();
  if (!url || !key) {
    console.error("picks-cron: BACKUP_URL or PICKS_CRON_KEY missing — not backing up");
    return { ok: false, error: "not_configured" };
  }
  let response;
  try {
    response = await fetch(url, { method: "POST", headers: { "X-Picks-Cron-Key": key } });
  } catch (error) {
    console.error("picks-cron: backup request threw", error);
    return { ok: false, error: "unreachable" };
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    // Loud, for the same reason settlement is: a missing bucket binding
    // otherwise looks like a night that simply had nothing to back up.
    console.error(`picks-cron: backup refused (${response.status})`, payload?.code || "", payload?.message || "");
    return { ok: false, status: response.status, payload };
  }
  console.log(`picks-cron: backup ${payload.key} — ${payload.tables} tables, ${payload.rows} rows, ${payload.bytes} bytes, pruned ${payload.pruned}`);
  return { ok: true, payload };
}

/** The daily Discord recap; the endpoint decides whether it is 8 AM Central. */
async function runRecap(env) {
  const url = String(env.RECAP_URL || "").trim();
  const key = String(env.PICKS_CRON_KEY || "").trim();
  if (!url || !key) {
    console.error("picks-cron: RECAP_URL or PICKS_CRON_KEY missing — no recap");
    return { ok: false, error: "not_configured" };
  }
  let response;
  try {
    response = await fetch(url, { method: "POST", headers: { "X-Picks-Cron-Key": key } });
  } catch (error) {
    console.error("picks-cron: recap request threw", error);
    return { ok: false, error: "unreachable" };
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    console.error(`picks-cron: recap refused (${response.status})`, payload?.code || "", payload?.message || "");
    return { ok: false, status: response.status, payload };
  }
  if (payload.skipped) console.log(`picks-cron: recap skipped — ${payload.skipped}`);
  else console.log(`picks-cron: recap posted for ${payload.day} — ${payload.people} players, ${payload.settled} picks`);
  return { ok: true, payload };
}

export default {
  async scheduled(event, env, ctx) {
    // Which schedule fired decides the job; the settlement one is the
    // default so a new trigger can never silently skip payouts.
    if (event.cron === "0 9 * * *") ctx.waitUntil(runBackup(env));
    else if (event.cron === "50 13,14 * * *") ctx.waitUntil(runRecap(env));
    else ctx.waitUntil(runSettlement(env, "cron"));
  },

  // A manual kick, so the Worker-to-Pages link can be proven without
  // waiting for the next tick. Same key as the cron path; there is no
  // unauthenticated surface here at all.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "eastcoin-picks-cron" });
    }

    const key = String(env.PICKS_CRON_KEY || "").trim();
    const given = String(request.headers.get("X-Picks-Cron-Key") || "").trim();
    if (!key || given !== key) {
      return new Response("Not authorized", { status: 403 });
    }

    // ?job=backup or ?job=recap runs those by hand, with the same key.
    const job = url.searchParams.get("job");
    const result = job === "backup" ? await runBackup(env) : job === "recap" ? await runRecap(env) : await runSettlement(env, "manual");
    return Response.json(result, { status: result.ok ? 200 : 502 });
  }
};
