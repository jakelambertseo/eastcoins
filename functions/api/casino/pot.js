/* GET /api/casino/pot[?day=YYYY-MM-DD]

   Today's pot for the floor and the game pages: amount, the committed
   hash, how far the day's play has come (never where the line is),
   the viewer's own stake and share, and the last winner. With ?day=
   a paid pot comes back with its seed, trigger, draw and shares, for
   the check page. Reading only; the paying happens in settlePot(),
   which every bet endpoint calls. */

import { json, fail, getSessionUser } from "../picks/_lib.js";
import { ensurePot, publicPot, rangesFor, winnerOf, viewerStake } from "./_pot.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensurePot(db);

  const day = new URL(context.request.url).searchParams.get("day");
  if (day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail("BAD_DAY", "day looks like 2026-09-13");
    const pot = await db.prepare(`SELECT * FROM casino_pots WHERE day = ?`).bind(day).first();
    if (!pot) return fail("NO_POT", "No pot that day.", 404);
    if (pot.status !== "PAID") return json({ ok: true, day, status: pot.status, amount: Number(pot.amount), hash: pot.hash });
    let shares = {};
    try { shares = JSON.parse(pot.shares || "{}"); } catch { shares = {}; }
    const ids = Object.keys(shares);
    const names = {};
    if (ids.length) {
      const rows = await db.prepare(`SELECT twitch_id, twitch_login, display_name FROM users WHERE twitch_id IN (${ids.map(() => "?").join(",")})`).bind(...ids).all().catch(() => ({ results: [] }));
      for (const r of rows.results || []) names[String(r.twitch_id)] = { login: String(r.twitch_login || "").toLowerCase(), displayName: String(r.display_name || r.twitch_login || "") };
    }
    const ranges = rangesFor(shares).map((r) => ({ ...r, ...(names[r.userId] || { login: "", displayName: "someone" }), pct: Math.round((r.stake / Number(pot.total_stake)) * 1000) / 10 }));
    const winner = winnerOf(ranges, Number(pot.draw));
    return json({
      ok: true, day, status: "PAID", amount: Number(pot.amount), hash: pot.hash, seed: pot.seed,
      trigger: Number(pot.trigger_at), total: Number(pot.total_stake), draw: Number(pot.draw),
      paidAt: String(pot.paid_at).replace(" ", "T") + "Z", winner: winner ? { login: winner.login, displayName: winner.displayName } : null,
      ranges: ranges.map(({ userId, ...r }) => r)
    });
  }

  // Who's asking and what the pot looks like are independent reads;
  // the viewer's own share is filled in from the same stakes map after.
  const t0 = Date.now();
  const [user, base] = await Promise.all([getSessionUser(db, context.request), publicPot(db, Date.now(), null)]);
  let pot = base;
  if (user) {
    // yours/share without a second stakes read: recompute from a cheap
    // per-user sum only if the viewer played today.
    const mine = await viewerStake(db, base.day, user.id);
    pot = { ...base, yours: mine, share: base.play > 0 && mine > 0 ? Math.round((mine / base.play) * 1000) / 10 : 0 };
  }
  return json({ ok: true, now: Date.now(), pot, timing: { totalMs: Date.now() - t0, potMs: base.ms } });
}
