const STATE_COOKIE = "__Host-ec_oauth_state";
const RETURN_COOKIE = "__Host-ec_oauth_return";
const OAUTH_MAX_AGE = 10 * 60;

function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);

  let binary = "";
  for (const value of values) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function sanitizeReturnTo(value) {
  const raw = String(value || "/picks.html").trim();

  if (
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.length > 500
  ) {
    return "/picks.html";
  }

  return raw;
}

function cookie(name, value, maxAge) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

function missingConfig(env) {
  const missing = [];

  if (!env.TWITCH_CLIENT_ID) missing.push("TWITCH_CLIENT_ID");
  if (!env.TWITCH_CLIENT_SECRET) missing.push("TWITCH_CLIENT_SECRET");
  if (!env.TWITCH_REDIRECT_URI) missing.push("TWITCH_REDIRECT_URI");

  return missing;
}

export async function onRequestGet(context) {
  const missing = missingConfig(context.env);

  if (missing.length) {
    return Response.json(
      {
        ok: false,
        code: "TWITCH_CONFIG_INCOMPLETE",
        missing,
        message: "Twitch authentication is not configured."
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const requestUrl = new URL(context.request.url);
  const returnTo = sanitizeReturnTo(
    requestUrl.searchParams.get("returnTo")
  );

  const state = randomToken(32);

  const twitchUrl = new URL(
    "https://id.twitch.tv/oauth2/authorize"
  );

  twitchUrl.searchParams.set(
    "response_type",
    "code"
  );

  twitchUrl.searchParams.set(
    "client_id",
    context.env.TWITCH_CLIENT_ID
  );

  twitchUrl.searchParams.set(
    "redirect_uri",
    context.env.TWITCH_REDIRECT_URI
  );

  // OIDC gives EastCoin an identity-purpose authorization without
  // requesting email, chat, moderation, or broadcaster permissions.
  twitchUrl.searchParams.set(
    "scope",
    "openid"
  );

  twitchUrl.searchParams.set(
    "state",
    state
  );

  const headers = new Headers({
    Location: twitchUrl.toString(),
    "Cache-Control": "no-store"
  });

  headers.append(
    "Set-Cookie",
    cookie(
      STATE_COOKIE,
      state,
      OAUTH_MAX_AGE
    )
  );

  headers.append(
    "Set-Cookie",
    cookie(
      RETURN_COOKIE,
      returnTo,
      OAUTH_MAX_AGE
    )
  );

  return new Response(null, {
    status: 302,
    headers
  });
}
