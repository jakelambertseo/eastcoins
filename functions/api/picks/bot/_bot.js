/* ============================================================
   EastCoin Picks — StreamElements chat command helpers

   These endpoints back $(customapi ...) custom commands. That
   shapes everything about them:

     · GET only — $(customapi) cannot POST
     · plain text out, never JSON — the body IS the chat message
     · 400 bytes max — StreamElements silently truncates past that
     · status 200 for EVERYTHING, including refusals. Observed
       behaviour, contradicting the docs: StreamElements renders its
       own "unable to make request" for a non-2xx and discards the
       body. A misconfigured command then looks identical to a
       network fault, which cost real debugging time. Answering 200
       with the reason puts it in chat where it can be read.

   Trust model, stated plainly: there is no way to verify a request
   actually came from StreamElements. $(customapi) sends no custom
   headers, and StreamElements publishes no stable source IPs. The
   shared key in the query string is the ONLY gate. It is therefore
   worth exactly as much as a session cookie, and should be rotated
   the same way if it ever leaks.

   The login comes from $(sender.login), which StreamElements fills
   from the actual chat message. It must never be read out of the
   message body — "!pick 50 Bills as zwades" cannot be allowed to
   mean anything.
   ============================================================ */

import { safeEqual } from "../_lib.js";

/** Plain-text chat reply. Truncated to StreamElements' own limit. */
/* The ZCoin emote, by its chat code. 7TV renders the word; everyone
   else sees the word, which still reads fine. Every line the bot posts
   starts with it so Picks traffic stands out from the rest of chat. */
export const BADGE = "Zcoin";

export function say(message, status = 200) {
  const text = String(message || "").replace(/\s+/g, " ").trim();
  const body = text ? `${BADGE} ${text}` : "";
  const bytes = new TextEncoder().encode(body);

  // Trim to 400 BYTES, not characters — an emoji is four of them, and
  // StreamElements cuts mid-sequence without warning.
  let out = body;
  if (bytes.length > 400) {
    out = new TextDecoder().decode(bytes.slice(0, 400)).replace(/\uFFFD+$/, "");
  }

  return new Response(out, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // $(customapi) doesn't cache, but proxies in between might, and a
      // cached !pick reply would be actively misleading.
      "X-Content-Type-Options": "nosniff"
    }
  });
}

/**
 * Validates the shared key and pulls the caller's login.
 * Returns { ok: true, login } or { ok: false, response }.
 */
export function botGate(context) {
  const url = new URL(context.request.url);
  const expected = String(context.env.PICKS_BOT_KEY || "").trim();
  const given = String(url.searchParams.get("k") || "").trim();

  // Fail closed. An unset key must not mean "no key required".
  if (!expected) {
    return { ok: false, response: say("Picks chat commands aren't configured yet.") };
  }
  if (!given || !safeEqual(given, expected)) {
    return { ok: false, response: say("Picks bot key rejected — check the key in this command.") };
  }

  const login = String(url.searchParams.get("user") || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{2,25}$/.test(login)) {
    // Nearly always the command using the wrong sender variable, so the
    // message names the fix rather than describing the symptom.
    return {
      ok: false,
      response: say("Couldn't tell who sent that — this command needs user=$(sender.name)")
    };
  }

  const twitchId = String(url.searchParams.get("id") || "").trim();
  const displayName = String(url.searchParams.get("name") || "").trim().slice(0, 64);

  return {
    ok: true,
    login,
    // Only ever a numeric Twitch id; anything else is treated as absent.
    twitchId: /^\d{1,20}$/.test(twitchId) ? twitchId : "",
    displayName,
    // !odds sends $(1|all) so a bare command still reaches us; a lone
    // "all" means "no argument". Only the bare word — "all rockies" is a
    // real request (bet everything on the Rockies) and passes through.
    args: String(url.searchParams.get("args") || "").trim().replace(/^all$/i, "")
  };
}

/**
 * The account for a Twitch login, created on the spot if the command
 * carried a Twitch id and none exists yet.
 *
 * A site login is not actually required to bet: the ZCoins live in
 * StreamElements keyed by login, and the only thing the site needed was
 * a users row to hang the pick on. When the command sends
 * $(sender.twitchid) that row can be made right here — typing !pick IS
 * the consent, and the id comes from StreamElements, not from the
 * message text.
 *
 * Without an id it falls back to the old behaviour and returns null, so
 * an older command definition still gets a clear "log in once" reply
 * rather than a broken one.
 */
export async function findOrCreateUser(db, { login, twitchId, displayName }, env = null) {
  const existing = await findUser(db, login);
  if (existing || !twitchId) return env ? backfillAvatar(env, db, existing) : existing;

  // ON CONFLICT covers the race where two commands arrive together, and
  // also the case where the id exists under an old login (a rename):
  // the row is refreshed rather than duplicated.
  await db
    .prepare(
      `INSERT INTO users (twitch_id, twitch_login, display_name, created_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(twitch_id) DO UPDATE SET
         twitch_login = excluded.twitch_login,
         display_name = excluded.display_name,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(twitchId, login, displayName || login)
    .run();

  const created = await findUser(db, login);
  return env ? backfillAvatar(env, db, created) : created;
}

/** The EastCoin account for a Twitch login, or null if they've never logged in. */
export async function findUser(db, login) {
  const row = await db
    .prepare(
      `SELECT twitch_id, twitch_login, display_name, avatar_url
         FROM users
        WHERE twitch_login = ? COLLATE NOCASE
        LIMIT 1`
    )
    .bind(login)
    .first();

  if (!row) return null;
  return {
    id: String(row.twitch_id),
    login: String(row.twitch_login).toLowerCase(),
    displayName: String(row.display_name || row.twitch_login),
    avatarUrl: String(row.avatar_url || "")
  };
}

/* ---------------------------------------------------------- avatars

   Someone who only ever uses chat never goes through the Twitch login,
   so the site would show them as initials forever. Their profile picture
   is public, so it is fetched once with an app token — one Helix call
   per new person, none afterwards. Any failure just leaves the initials. */

async function twitchAppToken(env) {
  const id = String(env.TWITCH_CLIENT_ID || "").trim();
  const secret = String(env.TWITCH_CLIENT_SECRET || "").trim();
  if (!id || !secret) return "";
  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, grant_type: "client_credentials" })
  });
  const payload = await response.json().catch(() => null);
  return response.ok ? String(payload?.access_token || "") : "";
}

export async function fetchTwitchAvatar(env, twitchId) {
  try {
    const token = await twitchAppToken(env);
    if (!token) return "";
    const response = await fetch(`https://api.twitch.tv/helix/users?id=${encodeURIComponent(twitchId)}`, {
      headers: { Authorization: `Bearer ${token}`, "Client-Id": String(env.TWITCH_CLIENT_ID || "").trim() }
    });
    const payload = await response.json().catch(() => null);
    return response.ok ? String(payload?.data?.[0]?.profile_image_url || "") : "";
  } catch {
    return "";
  }
}

async function backfillAvatar(env, db, user) {
  if (!user || user.avatarUrl || !/^\d{1,20}$/.test(user.id)) return user;
  const avatar = await fetchTwitchAvatar(env, user.id);
  if (!avatar) return user;
  await db
    .prepare(`UPDATE users SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE twitch_id = ? AND (avatar_url IS NULL OR avatar_url = '')`)
    .bind(avatar, user.id)
    .run()
    .catch(() => {});
  return { ...user, avatarUrl: avatar };
}

export async function openMarkets(db) {
  const result = await db
    .prepare(
      `SELECT id, sport, league, away_name, home_name, starts_at, state,
              away_odds_locked, home_odds_locked
         FROM markets
        WHERE state = 'OPEN'
          AND datetime(starts_at) > datetime('now')
        ORDER BY datetime(starts_at) ASC
        LIMIT 50`
    )
    .all();
  return result.results || [];
}

/* ------------------------------------------------------------ matching */

const TWO_WORD = /^(red sox|white sox|blue jays|maple leafs|golden knights|trail blazers)$/;

function words(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** Same rule settlement uses, so a name that picks also grades. */
export function nickname(value) {
  const parts = words(value);
  if (!parts.length) return "";
  const tail2 = parts.slice(-2).join(" ");
  return TWO_WORD.test(tail2) ? tail2 : parts[parts.length - 1];
}

/**
 * Resolves what someone typed to one side of one market.
 *
 * Scored in tiers so a precise match always beats a loose one:
 * "jets" shouldn't become ambiguous just because "New York Giants"
 * also contains a word starting with "j"... it doesn't, but "new
 * york" genuinely is ambiguous, and that must be said rather than
 * guessed. A wrong guess here bets someone's ZCoins on the wrong team.
 *
 * Returns { market, side } | { ambiguous: [...] } | null.
 */
export function matchTeam(markets, query) {
  const want = words(query).join(" ");
  if (!want) return null;

  const hits = [];
  for (const market of markets) {
    for (const side of ["away", "home"]) {
      const name = side === "away" ? market.away_name : market.home_name;
      const full = words(name).join(" ");
      const nick = nickname(name);

      // Prefix tiers need three characters. Without that floor, "a"
      // silently resolves to the Athletics and bets someone's ZCoins on
      // a team they never named. Exact and nickname matches are exempt.
      const loose = want.length >= 3;

      let score = 0;
      if (full === want) score = 4;
      else if (nick === want) score = 3;
      else if (loose && (full.startsWith(want) || nick.startsWith(want))) score = 2;
      else if (loose && words(name).some((w) => w.startsWith(want))) score = 1;

      if (score) hits.push({ market, side, score, name });
    }
  }

  if (!hits.length) return null;

  const best = Math.max(...hits.map((h) => h.score));
  const top = hits.filter((h) => h.score === best);

  // Same team, same market, matched twice is impossible; two different
  // games is not — say so instead of picking one.
  if (top.length > 1) return { ambiguous: top.map((h) => h.name) };
  return { market: top[0].market, side: top[0].side };
}

export function formatLine(value) {
  const line = Number(value);
  if (!Number.isFinite(line) || line === 0) return "";
  return line > 0 ? `+${line}` : String(line);
}

export function shortTeam(name) {
  const nick = nickname(name);
  return nick ? nick.replace(/\b\w/g, (c) => c.toUpperCase()) : String(name || "");
}
