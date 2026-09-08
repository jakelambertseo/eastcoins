/* ============================================================
   EastCoin Picks — StreamElements chat command helpers

   These endpoints back $(customapi ...) custom commands. That
   shapes everything about them:

     · GET only — $(customapi) cannot POST
     · plain text out, never JSON — the body IS the chat message
     · 400 bytes max — StreamElements silently truncates past that
     · status < 400 always for anything a viewer caused, because a
       4xx/5xx body gets rendered into chat raw

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

/** Plain-text chat reply. Truncated to StreamElements' own limit. */
export function say(message, status = 200) {
  const body = String(message || "").replace(/\s+/g, " ").trim();
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

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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
    return { ok: false, response: say("Picks chat commands aren't configured yet.", 403) };
  }
  if (!given || !safeEqual(given, expected)) {
    return { ok: false, response: say("Picks bot key rejected.", 403) };
  }

  const login = String(url.searchParams.get("user") || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{2,25}$/.test(login)) {
    return { ok: false, response: say("Couldn't tell who sent that.", 403) };
  }

  return { ok: true, login, args: String(url.searchParams.get("args") || "").trim() };
}

/** The EastCoin account for a Twitch login, or null if they've never logged in. */
export async function findUser(db, login) {
  const row = await db
    .prepare(
      `SELECT twitch_id, twitch_login, display_name
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
    displayName: String(row.display_name || row.twitch_login)
  };
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
