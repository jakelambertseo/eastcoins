export async function onRequestGet() {
  return Response.json(
    {
      ok: false,
      code: "ADMIN_BACKEND_NOT_READY",
      message: "The Picks admin API is online, but server-side admin authentication and D1 markets are not connected yet."
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
