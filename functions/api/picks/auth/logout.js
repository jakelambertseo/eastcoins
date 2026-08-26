const SESSION_COOKIE = "__Host-ec_session";

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

function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

export async function onRequestPost(context) {
  const cookies = parseCookies(
    context.request
  );

  const rawToken =
    cookies[SESSION_COOKIE];

  if (
    rawToken &&
    context.env.PICKS_DB
  ) {
    try {
      const sessionHash =
        await sha256(rawToken);

      await context.env.PICKS_DB
        .prepare(
          `DELETE FROM sessions
            WHERE session_hash = ?`
        )
        .bind(sessionHash)
        .run();
    } catch (error) {
      console.error(
        "EastCoin logout cleanup failed",
        error
      );
    }
  }

  return Response.json(
    {
      ok: true,
      authenticated: false,
      message: "EastCoin Picks session ended."
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": clearSessionCookie()
      }
    }
  );
}
