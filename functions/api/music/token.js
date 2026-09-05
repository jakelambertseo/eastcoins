// Bridges the site's existing Twitch session (a same-origin __Host- cookie the
// Worker at eastcoin-music-room.*.workers.dev can never see, since it's a
// different origin) into a short-lived signed token the Worker can verify
// on its own, without sharing a database or trusting whatever a client
// claims its name/avatar is. MUSIC_AUTH_SECRET must be set to the same value
// on both this Pages project and the music Worker (wrangler secret put).

const SESSION_COOKIE = "__Host-ec_session";
const TOKEN_TTL_MS = 15 * 60 * 1000;

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
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getSessionUser(db, request) {
  const cookies = parseCookies(request);
  const rawToken = cookies[SESSION_COOKIE];
  if (!rawToken) return null;

  const sessionHash = await sha256(rawToken);

  const row = await db
    .prepare(
      `SELECT s.session_hash, u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
       FROM sessions s
       JOIN users u ON u.twitch_id = s.user_id
       WHERE s.session_hash = ? AND datetime(s.expires_at) > datetime('now')
       LIMIT 1`
    )
    .bind(sessionHash)
    .first();

  if (!row) return null;

  return {
    login: String(row.twitch_login),
    displayName: String(row.display_name || row.twitch_login),
    profileImageUrl: String(row.avatar_url || "")
  };
}

function base64urlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signMusicToken(payload, secret) {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
  return `${base64urlEncode(payloadBytes)}.${base64urlEncode(signatureBytes)}`;
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  const secret = context.env.MUSIC_AUTH_SECRET;

  if (!db || !secret) {
    return Response.json(
      { ok: false, code: "MUSIC_AUTH_NOT_CONFIGURED", message: "Music room login is not configured yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const user = await getSessionUser(db, context.request);

    if (!user) {
      return Response.json(
        { ok: true, authenticated: false, token: null },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const now = Date.now();
    const payload = {
      login: user.login,
      displayName: user.displayName,
      avatar: user.profileImageUrl,
      iat: now,
      exp: now + TOKEN_TTL_MS
    };

    const token = await signMusicToken(payload, secret);

    return Response.json(
      { ok: true, authenticated: true, token, expiresAt: payload.exp },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Music token issuance failed", error);
    return Response.json(
      { ok: false, code: "MUSIC_TOKEN_FAILED", message: "Could not verify your Twitch session." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
