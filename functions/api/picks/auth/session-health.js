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

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;

  if (!db) {
    return Response.json(
      {
        ok: false,
        code: "PICKS_DB_BINDING_MISSING"
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const cookies = parseCookies(
    context.request
  );

  const rawToken =
    cookies[SESSION_COOKIE];

  if (!rawToken) {
    return Response.json(
      {
        ok: true,
        authenticated: false,
        user: null
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const sessionHash =
    await sha256(rawToken);

  const row = await db
    .prepare(
      `SELECT
         u.twitch_id,
         u.twitch_login,
         u.display_name,
         u.avatar_url,
         s.expires_at
       FROM sessions s
       JOIN users u
         ON u.twitch_id = s.user_id
       WHERE s.session_hash = ?
         AND datetime(s.expires_at) > datetime('now')
       LIMIT 1`
    )
    .bind(sessionHash)
    .first();

  if (!row) {
    return Response.json(
      {
        ok: true,
        authenticated: false,
        user: null
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  return Response.json(
    {
      ok: true,
      authenticated: true,
      user: {
        id: String(row.twitch_id),
        login: String(row.twitch_login),
        displayName: String(row.display_name),
        profileImageUrl: String(
          row.avatar_url || ""
        )
      },
      session: {
        expiresAt: row.expires_at
      }
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
