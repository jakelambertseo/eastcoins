export async function onRequestPost() {
  return Response.json(
    {
      ok: false,
      code: "WAGERING_NOT_READY",
      message: "Real ZCoin wagering is disabled until the Picks database, Twitch authentication, and wallet integration are connected."
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}

export async function onRequestGet() {
  return Response.json(
    {
      ok: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Use POST to create a Picks wager."
    },
    {
      status: 405,
      headers: {
        "Allow": "POST",
        "Cache-Control": "no-store"
      }
    }
  );
}
