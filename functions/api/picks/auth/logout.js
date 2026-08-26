export async function onRequestPost() {
  return Response.json(
    {
      ok: true,
      status: "noop",
      message: "No real EastCoin Picks session exists yet, so there is nothing to log out."
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
