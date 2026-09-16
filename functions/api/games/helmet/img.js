/* GET /api/games/helmet/img — today's crest, as bytes

   Keyed on the DAY, never on the club, so the page can draw a crop of
   the image without its address giving the answer away. The picture
   itself is still a picture: anyone determined enough to open the
   network tab and look at it can, which is why this game pays titles
   rather than ZCoins. It is a puzzle, not a vault.

   Cached at the edge for an hour; the clubs' art never moves. */

import { ensureGames, seedFor, chicagoDay } from "../_games.js";
import { teamFor } from "./_helmet.js";

const CDN = "https://a.espncdn.com/i/teamlogos/nfl/500";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return new Response("offline", { status: 503 });
  await ensureGames(db);

  const day = chicagoDay(Date.now());
  const seed = await seedFor(db, "helmet", day);
  const [abbr] = await teamFor(seed);

  const upstream = await fetch(`${CDN}/${abbr}.png`, { cf: { cacheTtl: 86400, cacheEverything: true } }).catch(() => null);
  if (!upstream || !upstream.ok) return new Response("no crest", { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "image/png",
      // Long enough to be cheap, short enough that midnight Central is
      // never serving yesterday's club.
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
