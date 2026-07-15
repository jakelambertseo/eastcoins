const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE_NAME = "eastcoins_session";
export const SESSION_TTL_SECONDS = 48 * 60 * 60;

function bytesToBase64Url(bytes) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const base64 = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeText(value) {
  return bytesToBase64Url(encoder.encode(value));
}

function decodeText(value) {
  return decoder.decode(base64UrlToBytes(value));
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    usages
  );
}

async function createSignature(value, secret) {
  const key = await importHmacKey(secret, ["sign"]);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value)
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifySignature(value, signature, secret) {
  let providedSignature;

  try {
    providedSignature = base64UrlToBytes(signature);
  } catch {
    return false;
  }

  const key = await importHmacKey(secret, ["verify"]);

  return crypto.subtle.verify(
    "HMAC",
    key,
    providedSignature,
    encoder.encode(value)
  );
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...cookieValueParts] = cookie.trim().split("=");

    if (cookieName === name) {
      return cookieValueParts.join("=");
    }
  }

  return "";
}

export function getApprovedUsers(env) {
  return String(env.APPROVED_USERS || "")
    .split(",")
    .map((username) => username.trim())
    .filter(Boolean);
}

export function getCanonicalApprovedUser(username, env) {
  const normalizedUsername = String(username || "").trim().toLowerCase();

  return (
    getApprovedUsers(env).find(
      (approvedUsername) =>
        approvedUsername.toLowerCase() === normalizedUsername
    ) || ""
  );
}

export async function constantTimeTextEqual(left, right) {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right)))
  ]);

  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);

  let difference = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }

  return difference === 0;
}

export async function createSession(username, secret) {
  const now = Math.floor(Date.now() / 1000);

  const payload = encodeText(
    JSON.stringify({
      username,
      issuedAt: now,
      expiresAt: now + SESSION_TTL_SECONDS
    })
  );

  const signature = await createSignature(payload, secret);

  return `${payload}.${signature}`;
}

export async function verifySession(token, secret) {
  if (!token || !secret) return null;

  const [payload, signature, extra] = token.split(".");

  if (!payload || !signature || extra) return null;

  const validSignature = await verifySignature(
    payload,
    signature,
    secret
  );

  if (!validSignature) return null;

  try {
    const session = JSON.parse(decodeText(payload));
    const now = Math.floor(Date.now() / 1000);

    if (
      typeof session.username !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= now
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function buildSessionCookie(request, token) {
  const requestUrl = new URL(request.url);
  const secure = requestUrl.protocol === "https:" ? "; Secure" : "";

  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`
  ].join("; ") + secure;
}
