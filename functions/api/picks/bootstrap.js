export async function onRequestGet() {
  return Response.json(
    {
      ok: false,
      code: "PICKS_BACKEND_NOT_READY",
      message: "EastCoin Picks API is online, but D1 and authentication are not connected yet."
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
