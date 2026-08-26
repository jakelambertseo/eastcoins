const STATE_COOKIE = "__Host-ec_oauth_state";
const RETURN_COOKIE = "__Host-ec_oauth_return";
const SESSION_COOKIE = "__Host-ec_session";

const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const result = {};

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index < 0) continue;

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (!name) continue;

    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }

  return result;
}

function clearCookie(name) {
  return [
    `${name}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

function sessionCookie(value) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

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

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded
  );

  return [...new Uint8Array(digest)]
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

function safeEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");

  if (
    left.length === 0 ||
    right.length === 0 ||
    left.length !== right.length
  ) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
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

function redirectWithStatus(
  destination,
  status,
  extraHeaders = []
) {
  const url = new URL(
    sanitizeReturnTo(destination),
    "https://eastcoin.vip"
  );

  url.searchParams.set(
    "auth",
    status
  );

  const headers = new Headers({
    Location: `${url.pathname}${url.search}${url.hash}`,
    "Cache-Control": "no-store"
  });

  for (const [name, value] of extraHeaders) {
    headers.append(name, value);
  }

  return new Response(null, {
    status: 302,
    headers
  });
}

async function exchangeAuthorizationCode(
  env,
  code
) {
  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: env.TWITCH_REDIRECT_URI
  });

  const response = await fetch(
    "https://id.twitch.tv/oauth2/token",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded"
      },
      body
    }
  );

  const payload = await response.json().catch(
    () => null
  );

  if (
    !response.ok ||
    !payload?.access_token
  ) {
    console.error(
      "Twitch token exchange failed",
      response.status,
      payload?.message || payload?.error || "unknown"
    );

    throw new Error(
      "TWITCH_TOKEN_EXCHANGE_FAILED"
    );
  }

  return payload;
}

async function fetchTwitchUser(
  env,
  accessToken
) {
  const response = await fetch(
    "https://api.twitch.tv/helix/users",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": env.TWITCH_CLIENT_ID
      }
    }
  );

  const payload = await response.json().catch(
    () => null
  );

  const user = payload?.data?.[0];

  if (
    !response.ok ||
    !user?.id ||
    !user?.login
  ) {
    console.error(
      "Twitch user lookup failed",
      response.status
    );

    throw new Error(
      "TWITCH_USER_LOOKUP_FAILED"
    );
  }

  return user;
}

async function upsertUser(db, twitchUser) {
  await db
    .prepare(
      `INSERT INTO users (
         twitch_id,
         twitch_login,
         display_name,
         avatar_url,
         created_at,
         updated_at,
         last_login_at
       )
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(twitch_id)
       DO UPDATE SET
         twitch_login = excluded.twitch_login,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url,
         updated_at = CURRENT_TIMESTAMP,
         last_login_at = CURRENT_TIMESTAMP`
    )
    .bind(
      String(twitchUser.id),
      String(twitchUser.login).toLowerCase(),
      String(
        twitchUser.display_name ||
        twitchUser.login
      ),
      String(
        twitchUser.profile_image_url ||
        ""
      )
    )
    .run();
}

async function createSession(
  db,
  twitchUserId
) {
  const rawToken = randomToken(32);
  const sessionHash = await sha256(rawToken);

  const expiresAt = new Date(
    Date.now() +
    SESSION_MAX_AGE * 1000
  ).toISOString();

  // Opportunistic cleanup so expired rows do not accumulate forever.
  await db
    .prepare(
      `DELETE FROM sessions
        WHERE datetime(expires_at) <= datetime('now')`
    )
    .run();

  await db
    .prepare(
      `INSERT INTO sessions (
         session_hash,
         user_id,
         expires_at,
         created_at,
         last_seen_at
       )
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    )
    .bind(
      sessionHash,
      String(twitchUserId),
      expiresAt
    )
    .run();

  return rawToken;
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;

  if (!db) {
    return Response.json(
      {
        ok: false,
        code: "PICKS_DB_BINDING_MISSING",
        message: "The Picks database is unavailable."
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const requestUrl = new URL(
    context.request.url
  );

  const cookies = parseCookies(
    context.request
  );

  const returnTo = sanitizeReturnTo(
    cookies[RETURN_COOKIE]
  );

  const cleanupHeaders = [
    [
      "Set-Cookie",
      clearCookie(STATE_COOKIE)
    ],
    [
      "Set-Cookie",
      clearCookie(RETURN_COOKIE)
    ]
  ];

  const twitchError =
    requestUrl.searchParams.get("error");

  if (twitchError) {
    return redirectWithStatus(
      returnTo,
      "denied",
      cleanupHeaders
    );
  }

  const code =
    requestUrl.searchParams.get("code");

  const returnedState =
    requestUrl.searchParams.get("state");

  const expectedState =
    cookies[STATE_COOKIE];

  if (
    !code ||
    !safeEqual(
      returnedState,
      expectedState
    )
  ) {
    return redirectWithStatus(
      returnTo,
      "invalid_state",
      cleanupHeaders
    );
  }

  try {
    const tokenPayload =
      await exchangeAuthorizationCode(
        context.env,
        code
      );

    const twitchUser =
      await fetchTwitchUser(
        context.env,
        tokenPayload.access_token
      );

    await upsertUser(
      db,
      twitchUser
    );

    const sessionToken =
      await createSession(
        db,
        twitchUser.id
      );

    return redirectWithStatus(
      returnTo,
      "success",
      [
        ...cleanupHeaders,
        [
          "Set-Cookie",
          sessionCookie(sessionToken)
        ]
      ]
    );
  } catch (error) {
    console.error(
      "EastCoin Twitch callback failed",
      error?.message || error
    );

    return redirectWithStatus(
      returnTo,
      "failed",
      cleanupHeaders
    );
  }
}
