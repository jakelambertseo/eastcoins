export async function onRequestGet(context) {
  const configured = Boolean(
    String(
      context.env.ODDS_API_KEY || ""
    ).trim()
  );

  return Response.json(
    {
      ok: configured,
      test: true,
      integration: "the-odds-api",
      sport: "americanfootball_nfl",
      market: "h2h",
      region: "us",
      cacheTtlSeconds: 60,
      keyConfigured: configured,
      message: configured
        ? "EastCoin NFL Odds API test is configured."
        : "ODDS_API_KEY is not configured."
    },
    {
      status: configured ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
