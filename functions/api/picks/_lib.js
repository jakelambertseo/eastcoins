/* ============================================================
   EastCoin Picks — shared server helpers

   Everything that touches ZCoins lives here so the wager path and
   the settlement path cannot disagree about a number. The frontend
   has its own copy of the same rules for display; this one is the
   authority, and settlement must never trust a figure sent by a
   client.
   ============================================================ */

export const SESSION_COOKIE = "__Host-ec_session";

/* Only these logins may place real wagers during the test. Everyone
   else gets a clear "not open yet" rather than a silent failure. */
export const WAGER_ALLOWLIST = new Set([
  "bootypaper",
  "zwades",
  "andyreidisapawg"
]);

/* Logins allowed to open, void and settle markets. */
export const ADMIN_ALLOWLIST = new Set([
  "zwades",
  "bootypaper",
  "andyreidisapawg"
]);

export const MIN_WAGER = 1;

const SE_API = "https://api.streamelements.com/kappa/v2";
const SE_TIMEOUT_MS = 6000;

/* ------------------------------------------------------------ money */

/** American moneyline -> decimal multiplier on the stake. */
export function decimalFromAmerican(american) {
  const line = Number(american);
  if (!Number.isFinite(line) || line === 0) return 1;
  return line < 0 ? 1 + 100 / Math.abs(line) : 1 + line / 100;
}

/**
 * Total return on a winning pick, rounded UP — always in the
 * bettor's favour, and never less than the stake. This is the one
 * definition; the ticket, the bot and settlement all derive from it.
 */
export function totalReturn(stake, american) {
  const amount = Math.max(0, Math.floor(Number(stake) || 0));
  if (!amount) return 0;
  return Math.max(amount, Math.ceil(amount * decimalFromAmerican(american)));
}

export function profitFrom(stake, american) {
  return totalReturn(stake, american) - Math.floor(Number(stake) || 0);
}

/* ------------------------------------------------------------ http */

export function json(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders }
  });
}

export function fail(code, message, status = 400, extra = {}) {
  return json({ ok: false, code, message, ...extra }, status);
}

/* ------------------------------------------------------------ session */

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    out[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return out;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function getSessionUser(db, request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;

  const row = await db
    .prepare(
      `SELECT u.twitch_id, u.twitch_login, u.display_name
         FROM sessions s
         JOIN users u ON u.twitch_id = s.user_id
        WHERE s.session_hash = ?
          AND datetime(s.expires_at) > datetime('now')
        LIMIT 1`
    )
    .bind(await sha256(token))
    .first();

  if (!row) return null;
  return {
    id: String(row.twitch_id),
    login: String(row.twitch_login).toLowerCase(),
    displayName: String(row.display_name || row.twitch_login)
  };
}

/* ------------------------------------------------------------ StreamElements

   Reads are public. Writes need the channel token and are the only
   place ZCoins actually move, so every write is paired with a
   wallet_operations row before it is attempted. */

// The StreamElements channel id is not a secret — it is a public,
// opaque identifier, and bootstrap.js already falls back to this same
// constant for balance READS. Writes fell back to nothing, so reads
// worked while transfers reported "no channel". Same source for both.
const SE_CHANNEL_ID_FALLBACK = "65107c296068cc894e4ac7b9";

function seChannel(env) {
  return String(env.STREAMELEMENTS_CHANNEL_ID || SE_CHANNEL_ID_FALLBACK).trim();
}

export function walletWritesEnabled(env) {
  return Boolean(String(env.STREAMELEMENTS_JWT || "").trim() && seChannel(env));
}

async function seFetch(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Current ZCoin balance, or null when it can't be determined. */
export async function readBalance(env, login) {
  const channel = seChannel(env);
  if (!channel || !login) return null;
  try {
    const response = await seFetch(
      `${SE_API}/points/${encodeURIComponent(channel)}/${encodeURIComponent(login)}`
    );
    if (response.status === 404) return 0;   // known user, no points yet
    if (!response.ok) return null;
    const payload = await response.json();
    const points = Number(payload?.points);
    return Number.isFinite(points) ? points : null;
  } catch {
    return null;
  }
}

/**
 * Moves ZCoins. `delta` is signed: negative debits, positive credits.
 * Returns { ok, balance, error }. Never throws — callers must be able
 * to branch on failure and unwind.
 */
export async function moveBalance(env, login, delta) {
  const channel = seChannel(env);
  const jwt = String(env.STREAMELEMENTS_JWT || "").trim();
  const amount = Math.trunc(Number(delta) || 0);

  if (!jwt || !channel) return { ok: false, error: "WALLET_NOT_CONFIGURED" };
  if (!amount) return { ok: true, balance: null };

  try {
    const response = await seFetch(
      `${SE_API}/points/${encodeURIComponent(channel)}/${encodeURIComponent(login)}/${amount}`,
      { method: "PUT", headers: { Authorization: `Bearer ${jwt}` } }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      // Loud on purpose: a rotated token otherwise fails silently and
      // payouts just stop happening.
      console.error(`StreamElements points write failed ${response.status}: ${text.slice(0, 200)}`);
      return { ok: false, error: `SE_${response.status}` };
    }

    const payload = await response.json().catch(() => null);
    const balance = Number(payload?.newAmount ?? payload?.points);
    return { ok: true, balance: Number.isFinite(balance) ? balance : null };
  } catch (error) {
    console.error("StreamElements points write threw", error);
    return { ok: false, error: "SE_NETWORK" };
  }
}

/* ------------------------------------------------------------ ledger

   wallet_operations is written BEFORE the money moves and confirmed
   after, so a crash mid-flight leaves a PENDING row rather than an
   invisible loss. idempotency_key is UNIQUE, which is what stops a
   retry paying twice. */

export async function beginOperation(db, {
  id, idempotencyKey, userId, marketId, pickId, type, amount
}) {
  try {
    await db
      .prepare(
        `INSERT INTO wallet_operations
           (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, attempt_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', 1)`
      )
      .bind(id, idempotencyKey, userId, marketId, pickId, type, amount)
      .run();
    return { ok: true };
  } catch (error) {
    // A duplicate key means this exact operation already ran.
    if (String(error?.message || "").includes("UNIQUE")) {
      return { ok: false, duplicate: true };
    }
    throw error;
  }
}

export async function finishOperation(db, id, status, { balanceAfter = null, error = null } = {}) {
  await db
    .prepare(
      `UPDATE wallet_operations
          SET status = ?,
              balance_after = ?,
              last_error = ?,
              updated_at = CURRENT_TIMESTAMP,
              confirmed_at = CASE WHEN ? = 'CONFIRMED' THEN CURRENT_TIMESTAMP ELSE confirmed_at END
        WHERE id = ?`
    )
    .bind(status, balanceAfter, error, status, id)
    .run();
}

/**
 * Constant-time string compare, for anything that gates on a secret.
 * A plain === leaks the length of the matching prefix through timing;
 * it is a thin channel, but a free one to close.
 */
export function safeEqual(a, b) {
  const x = String(a || "");
  const y = String(b || "");
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
