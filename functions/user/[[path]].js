// Serves the root app shell at /user/<twitchLogin>/ so credited share links
// (built by submit.html) render EastCoin normally — the path segment is
// cosmetic attribution, not a route. The real ?watch=/?event= handling in
// v2/assets/js/player.js only ever reads location.search, so no client
// changes are needed here.
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  url.pathname = "/";

  const assetRequest = new Request(url.toString(), context.request);
  return context.env.ASSETS.fetch(assetRequest);
}
