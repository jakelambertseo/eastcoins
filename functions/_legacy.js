/* ============================================================
   Old standalone pages → the pages that replaced them

   /picks, /music, /multiview, /events and /login were the V2 site's
   own pages. Cloudflare serves /picks from picks.html, so a typed or
   pasted /picks used to land on the retired page. Each now sends the
   visitor to the current page, carrying the query string along (a
   MultiView share's ?m= still restores its layout).

   Two things are deliberately left alone:
     · Requests with ?ecV2Embedded=1 fall through to the old file. That
       is how the V2 rollback shell (v2-shell.html) loads these pages in
       its workspace frame, so rolling back keeps working.
     · /games and /favorites are not redirected: the current site has
       no Games or Other Streams page and sends people to those files.

   302, not 301: a permanent redirect is remembered by browsers, and
   this should stay undoable by deleting a file.
   ============================================================ */

export function legacyTo(target) {
  return async function onRequest(context) {
    const url = new URL(context.request.url);
    if (url.searchParams.has("ecV2Embedded")) return context.next();

    const dest = new URL(target, url.origin);
    for (const [key, value] of url.searchParams) {
      if (!dest.searchParams.has(key)) dest.searchParams.append(key, value);
    }
    return new Response(null, {
      status: 302,
      headers: { Location: dest.pathname + dest.search, "Cache-Control": "no-store" }
    });
  };
}
