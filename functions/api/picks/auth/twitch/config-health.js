const EXPECTED_REDIRECT_URI =
  "https://eastcoin.vip/api/picks/auth/twitch/callback";

function configured(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export async function onRequestGet(context) {
  const clientIdConfigured = configured(context.env.TWITCH_CLIENT_ID);
  const clientSecretConfigured = configured(context.env.TWITCH_CLIENT_SECRET);
  const redirectUriConfigured = configured(context.env.TWITCH_REDIRECT_URI);

  const redirectUriMatches =
    redirectUriConfigured &&
    context.env.TWITCH_REDIRECT_URI.trim() === EXPECTED_REDIRECT_URI;

  const ready =
    clientIdConfigured &&
    clientSecretConfigured &&
    redirectUriConfigured &&
    redirectUriMatches;

  return Response.json(
    {
      ok: ready,
      service: "eastcoin-picks",
      integration: "twitch",
      flow: "authorization_code",
      configuration: {
        clientIdConfigured,
        clientSecretConfigured,
        redirectUriConfigured,
        redirectUriMatches,
        expectedRedirectUri: EXPECTED_REDIRECT_URI
      },
      status: ready ? "configured" : "incomplete",
      message: ready
        ? "EastCoin Picks Twitch application credentials are configured server-side."
        : "EastCoin Picks Twitch application configuration is incomplete."
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
