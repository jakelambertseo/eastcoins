/* ============================================================
   GET /api/eastscape/online — how many people are in EastScape now

   (2026-09-27, the owner: "in the casino section for the EastScape
   card, add a '{X} people online now' area below the card")

   The casino floor's EastScape card reads this once a minute while
   its tab is visible. One number, public, and nothing else: the
   game server's /stats also carries the King's timer and tick
   times, which the card has no use for.

   It is a site endpoint rather than a new route on the game server
   so the card needs no cross-origin call, and so the count can be
   added without redeploying the world (which drops everyone's
   connection). The answer is kept in the edge cache for 30 seconds:
   however many casino tabs are open, the world is asked about twice
   a minute per data centre. No database is touched.
   ============================================================ */

/* the same address health.js uses; the game server's own domain if the variable is unset */
const statsUrl = (env) => `${(String(env.ESCAPE_WORKER_URL || "").trim() || "https://play.eastcoin.vip").replace(/\/$/, "")}/stats`;

export async function onRequestGet(context) {
  const cache = globalThis.caches?.default;   // (absent outside Cloudflare: the local casino rig runs this under Node)
  const key = new Request(new URL("/api/eastscape/online", context.request.url).toString());
  const hit = cache && await cache.match(key).catch(() => null);
  if (hit) return hit;

  let online = null;
  try {
    const r = await fetch(statsUrl(context.env), { headers: { accept: "application/json" } });
    if (r.ok) online = Math.max(0, Number((await r.json()).online) | 0);
  } catch (e) { /* the world is down or restarting: say so rather than guess */ }

  if (online === null) return Response.json({ ok: false }, { status: 502, headers: { "Cache-Control": "no-store" } });
  const res = Response.json({ ok: true, online }, { headers: { "Cache-Control": "public, max-age=30" } });
  if (cache) context.waitUntil(cache.put(key, res.clone()).catch(() => {}));
  return res;
}
