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

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runSettlement(env, "cron"));
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

    const result = await runSettlement(env, "manual");
    return Response.json(result, { status: result.ok ? 200 : 502 });
  }
};
