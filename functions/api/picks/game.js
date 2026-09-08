/* ============================================================
   GET /api/picks/game?g=<slug | YYYYMMDD | mkt_…>

   What the game page inside the site renders from. Public: this
   is the Community Ledger's own data, and the whole point of the
   page is that anyone in chat can open it.
   ============================================================ */

import { loadMarket, loadPicks, loadOps, loadDay, marketPayload, pickPayload } from "./_game.js";

const json = (body, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store" }
});

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  const g = String(new URL(context.request.url).searchParams.get("g") || "").trim().toLowerCase();
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  if (!g) return json({ ok: false, code: "MISSING_GAME" }, 400);

  if (/^\d{8}$/.test(g)) {
    const markets = await loadDay(db, g);
    return json({ ok: true, kind: "day", day: g, markets: markets.map(marketPayload) });
  }

  const market = await loadMarket(db, g);
  if (!market) return json({ ok: false, code: "NOT_FOUND", message: "No game is filed under that name." }, 404);

  const [picks, ops] = await Promise.all([loadPicks(db, market.id), loadOps(db, market.id)]);
  return json({
    ok: true,
    kind: "game",
    market: marketPayload(market),
    picks: picks.map(pickPayload),
    ops
  });
}
