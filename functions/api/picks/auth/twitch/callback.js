export async function onRequestGet() {
  return Response.json(
    {
      ok: false,
      code: "TWITCH_AUTH_NOT_READY",
      message: "Twitch OAuth callback handling has not been connected yet."
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
