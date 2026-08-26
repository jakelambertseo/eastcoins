export async function onRequestGet(context) {
  return Response.json(
    {
      ok: true,
      service: "eastcoin-picks",
      layer: "cloudflare-pages-functions",
      status: "ready",
      message: "EastCoin Picks server-side API is reachable.",
      timestamp: new Date().toISOString(),
      request: {
        method: context.request.method,
        url: new URL(context.request.url).pathname
      }
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
