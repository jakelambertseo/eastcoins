export async function onRequestGet() {
  return Response.json(
    {
      ok: false,
      code: "TWITCH_AUTH_NOT_READY",
      message: "Twitch OAuth has not been connected yet. This endpoint is reserved for the EastCoin Picks Twitch authorization flow."
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
