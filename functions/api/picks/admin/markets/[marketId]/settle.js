export async function onRequestPost(context) {
  const marketId = context.params?.marketId || null;

  return Response.json(
    {
      ok: false,
      code: "SETTLEMENT_NOT_READY",
      marketId,
      message: "Market settlement is disabled until D1, Twitch admin authentication, and the ZCoins wallet layer are connected."
    },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
