/* ============================================================
   GET /api/config — the configuration service.

   The browser's half of functions/api/_config.js. Everything here is
   public by design: a channel name, a Worker URL and a room name, all
   of which end up in a URL the browser requests anyway. Nothing that
   reads an environment variable holding a secret belongs in this file.

   Read once per page load by /assets/eastcoins-config.js, which applies
   it to the chat iframe and the Green Room. no-store because it is
   cheap, same-origin, and flipping an environment variable should take
   effect on the next reload rather than whenever a cache decides.
   ============================================================ */

import { siteConfig } from "./_config.js";

export function onRequestGet(context) {
  return Response.json(
    { ok: true, ...siteConfig(context.env, context.request) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
