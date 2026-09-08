import { DurableObject } from "cloudflare:workers";

/* One cap for both queues. The StreamElements queue is kept as a mirror
   of this one, so a separate limit there would only mean the two could
   never actually agree. 14 is the number asked for. */
const MAX_QUEUE = 14;

/* The reactions a song can carry. Fixed server-side: a client that could
   invent a kind could grow the stored state without limit. */
const REACTION_KINDS = ["up", "fire", "trash", "del"];

/* Requester rating.

   Elo-style rather than actual Elo: there is no opponent, so each song is
   scored against what the room's ratings say should have been expected of
   the person who queued it. The effect is the one people know from
   ranked play — a good song from someone already rated highly moves them
   very little, and the same song from someone at the bottom moves them a
   lot.

   Weights: a fire is worth two thumbs up, and a delete costs two bins.
   Reacting to your own request is ignored entirely. */
const ELO_START = 1000;
const ELO_WEIGHTS = { up: 1, fire: 2, trash: 1, del: 2 };
const ELO_POSITIVE = new Set(["up", "fire"]);

function eloExpected(rating, average) {
  return 1 / (1 + Math.pow(10, (average - rating) / 400));
}
const REQUEST_LIMIT = 25;
const REQUEST_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_VIDEO_SECONDS = 600;
const MAX_HISTORY = 300;
const MAX_USER_STATS = 500;
const SE_POLL_INTERVAL_MS = 20 * 1000;
const MAX_SE_SEEN_IDS = 500;


const TWITCH_IRC_SKIP_COOLDOWN_MS = 5000;
const RASPUTIN_COOLDOWN_MS = 60 * 1000;
const RASPUTIN_ALLOWED_LOGINS = new Set(["andyreidisapawg", "zwades"]);

// "!srclear" (and its StreamElements alias "!mrclear") is a StreamElements
// command — SE clears its own media request queue when a moderator types it.
// SE has no way to tell us that happened, and our sync is one-way and
// additive: pollStreamElements only ever copies NEW entries in, so without
// this the Music Room would keep playing a backlog SE has already dropped.
// We therefore watch chat for the same command and clear our mirror at the
// same moment. Keep this list in step with who SE will accept the command
// from, or the two queues drift apart.
const QUEUE_CLEAR_ALLOWED_LOGINS = new Set(["zwades", "andyreidisapawg", "bootypaper"]);

/* Who can skip a song outright, without a vote. Everyone else still has
   the vote — this is an addition to it, not a replacement, so a room
   with none of these three present can still move past a bad song. */
const FORCE_SKIP_LOGINS = new Set(["zwades", "andyreidisapawg", "bootypaper"]);
const QUEUE_CLEAR_COOLDOWN_MS = 3000;
// A fixed, hand-picked block — not resolved through search at request time —
// so "!rasputin" always queues exactly this, the same way, every time.
const RASPUTIN_BLOCK = [
  { videoId: "Nl_Eo2QzqU4", title: "Boney M. - Rasputin (Official Audio)" },
  { videoId: "FYGTT7YhywA", title: "Boney M. - Daddy Cool (Sopot Festival 1979)" },
  { videoId: "ZaI2IlHwmgQ", title: "The Black Eyed Peas - Pump It (Official Music Video)" },
  { videoId: "flDt8TC6Fok", title: "Don Diablo - Momentum | Official Music Video" }
];
const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://eastcoin.vip",
  "https://www.eastcoin.vip",
  "https://eastcoins.pages.dev",
  "http://localhost:4321",
  "http://localhost:8788",
  "http://127.0.0.1:4321",
  "http://127.0.0.1:8788"
]);

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}

function configuredOrigins(env) {
  const result = new Set(DEFAULT_ALLOWED_ORIGINS);
  String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => result.add(value));
  return result;
}

function originAllowed(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return configuredOrigins(env).has(origin);
}

// The /history endpoint is fetched with plain fetch() from the site's own
// domain, which is a different origin than this Worker — unlike the
// WebSocket upgrade, a cross-origin GET like this is subject to CORS and
// needs an explicit Access-Control-Allow-Origin header or the browser
// discards the response before JS ever sees it.
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin || !configuredOrigins(env).has(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Vary": "Origin" };
}

function base64urlDecode(value) {
  let normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Verifies the short-lived token minted by the site's own /api/music/token
// Pages Function (same secret on both sides — see worker/README or the
// deploy notes) so a song request can only be attributed to a real,
// currently-authenticated Twitch account, not whatever a client claims.
async function verifyMusicToken(token, secret) {
  if (!token || !secret) return null;

  const parts = String(token).split(".");
  if (parts.length !== 2) return null;

  try {
    const payloadBytes = base64urlDecode(parts[0]);
    const signatureBytes = base64urlDecode(parts[1]);

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, payloadBytes);
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (!payload.login || !Number.isFinite(payload.exp) || Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

function parseIso8601Duration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ""));
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

// Returns null (rather than blocking requests) when YOUTUBE_API_KEY isn't
// configured yet, or when the lookup itself fails — the length limit is
// best-effort, not a hard dependency for the room to function.
/**
 * Duration and title in one lookup.
 *
 * videos.list costs one quota unit whatever parts are asked for, so the
 * title rides along with the duration check that already happens on
 * every add — free, and it means a client that sends no title still gets
 * a real one rather than a blank row in the queue.
 */
async function fetchVideoDetails(videoId, apiKey) {
  if (!apiKey) return { durationSeconds: null, title: "" };

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=contentDetails,snippet&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return { durationSeconds: null, title: "" };

    const data = await response.json();
    const item = data?.items?.[0];
    const iso = item?.contentDetails?.duration;
    return {
      durationSeconds: iso ? parseIso8601Duration(iso) : null,
      title: String(item?.snippet?.title || "")
    };
  } catch {
    return { durationSeconds: null, title: "" };
  }
}

// search.list costs 100 quota units per call (vs. 1 for the duration lookup
// above) against the same 10,000/day default quota, so results are cached at
// the edge for a few minutes — repeat/popular searches across the room don't
// re-spend quota.
async function searchYouTube(query, apiKey) {
  const cache = caches.default;
  const cacheKey = new Request(`https://eastcoin-music-search.internal/search?q=${encodeURIComponent(query)}`);

  const cached = await cache.match(cacheKey);
  if (cached) return cached.json();

  const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=8&q=${encodeURIComponent(query)}&key=${apiKey}`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`YouTube search failed with status ${response.status}`);

  const data = await response.json();
  const results = (data.items || [])
    .map((item) => ({
      videoId: String(item.id?.videoId || ""),
      title: String(item.snippet?.title || "").slice(0, 120),
      channelTitle: String(item.snippet?.channelTitle || "").slice(0, 80),
      thumbnail: String(item.snippet?.thumbnails?.default?.url || "")
    }))
    .filter((item) => /^[A-Za-z0-9_-]{11}$/.test(item.videoId));

  const cacheResponse = new Response(JSON.stringify({ results }), {
    headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" }
  });
  try { await cache.put(cacheKey, cacheResponse); } catch {}

  return { results };
}

// With 2 or fewer listeners, everyone has to agree to skip. Above that, it's
// a simple majority (strictly more than half) rather than a fixed vote
// count, so a packed room doesn't get stuck needing the same 3 votes a
// nearly-empty one does: 3 listeners -> 2 votes, 4 -> 3, 6 -> 4, and so on.
/** Normalises stored reactions, dropping unknown kinds and over-long names. */
function sanitizeReactors(value) {
  const out = {};
  for (const kind of REACTION_KINDS) {
    const entries = value && typeof value === "object" ? value[kind] : null;
    if (!entries || typeof entries !== "object") continue;
    const clean = {};
    let count = 0;
    for (const [clientId, name] of Object.entries(entries)) {
      if (count >= 200) break;
      const id = String(clientId).slice(0, 80);
      if (!id) continue;
      clean[id] = String(name || "").slice(0, 40);
      count += 1;
    }
    if (count) out[kind] = clean;
  }
  return out;
}

/**
 * The public shape: counts and verified names, never client ids.
 *
 * Only names the room verified through Twitch. A guest's name is whatever
 * their client claimed, so attributing a reaction to one would let anyone
 * appear to have left it. The count still includes everybody.
 */
function publicReactions(reactors) {
  const out = {};
  for (const kind of REACTION_KINDS) {
    const entries = reactors?.[kind] || {};
    const names = [];
    let total = 0;
    for (const name of Object.values(entries)) {
      total += 1;
      if (name && names.length < 20) names.push(name);
    }
    out[kind] = { count: total, names };
  }
  return out;
}

/**
 * Votes needed to skip: half the room, rounded up.
 *
 * With two or fewer people it stays unanimous. Half of two is one, and
 * letting one of a pair skip whatever the other put on is not a vote, it
 * is just a skip button.
 */
function skipThresholdFor(listeners) {
  const count = Math.max(1, Number(listeners) || 1);
  if (count <= 2) return count;
  return Math.ceil(count / 2);
}

// StreamElements' own "!sr" media-request queue for a channel, read from its
// public (no-auth, not CORS-enabled — this only ever runs server-side)
// endpoint. Lets chat requests land in the shared EastCoin queue without
// anyone needing to also use the site's search bar.
async function fetchStreamElementsQueue(channelId) {
  try {
    const response = await fetch(
      `https://api.streamelements.com/kappa/v2/songrequest/${encodeURIComponent(channelId)}/queue/public`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Minimal parser for one line of Twitch IRC (RFC1459-style, plus the
// IRCv3 "@tag=value;..." prefix Twitch's tags capability adds). Only pulls
// out what the room actually needs — the sender's login and the message
// text of a PRIVMSG — not a general-purpose IRC client.
function parseTwitchIrcLine(line) {
  let rest = line;
  const tags = {};

  if (rest.startsWith("@")) {
    const spaceIndex = rest.indexOf(" ");
    if (spaceIndex === -1) return null;
    rest.slice(1, spaceIndex).split(";").forEach((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) return;
      tags[pair.slice(0, eq)] = pair.slice(eq + 1);
    });
    rest = rest.slice(spaceIndex + 1);
  }

  let prefix = "";
  if (rest.startsWith(":")) {
    const spaceIndex = rest.indexOf(" ");
    if (spaceIndex === -1) return null;
    prefix = rest.slice(1, spaceIndex);
    rest = rest.slice(spaceIndex + 1);
  }

  const trailingIndex = rest.indexOf(" :");
  let command, params;
  if (trailingIndex === -1) {
    const parts = rest.trim().split(" ").filter(Boolean);
    command = parts[0] || "";
    params = parts.slice(1);
  } else {
    const head = rest.slice(0, trailingIndex).trim().split(" ").filter(Boolean);
    command = head[0] || "";
    params = [...head.slice(1), rest.slice(trailingIndex + 2)];
  }

  return { tags, prefix, command, params };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true, service: "eastcoin-music-room" });
    }

    if (url.pathname.startsWith("/room/")) {
      if (!originAllowed(request, env)) {
        return new Response("Origin not allowed", { status: 403 });
      }

      if (request.method !== "GET") {
        return new Response("Expected GET", { status: 405 });
      }

      const upgrade = request.headers.get("Upgrade");
      if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
      }

      const roomName = decodeURIComponent(url.pathname.slice("/room/".length)) || "main";
      const stub = env.MUSIC_ROOM.getByName(roomName);
      return stub.fetch(request);
    }

    // Plain JSON GET — powers the full /music page's historical request log
    // and per-user totals without bloating every live WebSocket broadcast.
    if (url.pathname.startsWith("/history/")) {
      if (!originAllowed(request, env)) {
        return new Response("Origin not allowed", { status: 403 });
      }

      const roomName = decodeURIComponent(url.pathname.slice("/history/".length)) || "main";
      const stub = env.MUSIC_ROOM.getByName(roomName);
      return stub.fetch(request);
    }

    // Stateless YouTube search used by the /music page's "search to add"
    // bar — lives at the top level (not DO-scoped) since it doesn't touch
    // any one room's state.
    if (url.pathname === "/search") {
      if (!originAllowed(request, env)) {
        return new Response("Origin not allowed", { status: 403 });
      }

      const cors = corsHeaders(request, env);
      const query = String(url.searchParams.get("q") || "").trim().slice(0, 100);

      if (!query) return json({ ok: true, results: [] }, 200, cors);

      if (!env.YOUTUBE_API_KEY) {
        return json(
          { ok: false, code: "SEARCH_NOT_CONFIGURED", message: "YouTube search is not configured." },
          503,
          cors
        );
      }

      try {
        const { results } = await searchYouTube(query, env.YOUTUBE_API_KEY);
        return json({ ok: true, results }, 200, cors);
      } catch (error) {
        console.error("YouTube search failed", error);
        return json({ ok: false, code: "SEARCH_FAILED", message: "YouTube search failed." }, 502, cors);
      }
    }

    return json({
      ok: true,
      endpoints: {
        health: "/health",
        websocket: "/room/<room-name>",
        history: "/history/<room-name>",
        search: "/search?q=<query>"
      }
    });
  }
};

export class MusicRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sessions = new Map();
    this.state = this.emptyState();
    this.history = [];
    this.userStats = new Map();
    // In-memory only (not persisted to storage) — a DO restart resets everyone's
    // hourly count, which is an acceptable tradeoff for a small friend-group room.
    this.requestLog = new Map();
    this.seenStreamElementsIds = new Set();
    this.twitchIrcSocket = null;
    this.connectingIrc = false;
    this.lastChatSkipAt = 0;
    this.lastRasputinAt = 0;
    this.lastQueueClearAt = 0;

    this.ctx.getWebSockets().forEach((ws) => {
      const attachment = ws.deserializeAttachment();
      if (attachment?.clientId) this.sessions.set(ws, attachment);
    });

    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );

    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get("music-state");
      if (stored && typeof stored === "object") {
        this.state = this.sanitizeStoredState(stored);
      }

      const storedHistory = await this.ctx.storage.get("music-history");
      if (Array.isArray(storedHistory)) {
        this.history = storedHistory.map((entry) => this.sanitizeHistoryEntry(entry)).filter(Boolean).slice(-MAX_HISTORY);
      }

      const storedStats = await this.ctx.storage.get("music-user-stats");
      if (storedStats && typeof storedStats === "object") {
        Object.entries(storedStats).forEach(([login, entry]) => {
          const sanitized = this.sanitizeUserStat(login, entry);
          if (sanitized) this.userStats.set(login, sanitized);
        });
      }

      const storedSeenIds = await this.ctx.storage.get("music-se-seen-ids");
      if (Array.isArray(storedSeenIds)) {
        this.seenStreamElementsIds = new Set(storedSeenIds.map(String).slice(-MAX_SE_SEEN_IDS));
      }
    });
  }

  emptyState() {
    return {
      current: null,
      queue: [],
      startedAt: null,
      revision: 0,
      skipVoters: []
    };
  }

  sanitizeItem(item) {
    if (!item || typeof item !== "object") return null;
    const videoId = String(item.videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    return {
      id: String(item.id || crypto.randomUUID()),
      videoId,
      title: this.safeTitle(item.title),
      requestedBy: this.safeName(item.requestedBy),
      requestedByAvatar: this.safeAvatarUrl(item.requestedByAvatar),
      addedAt: Number(item.addedAt) || Date.now(),
      // Needed to credit the rating when the song finishes, and to ignore
      // the requester's own reactions. Both are stripped before broadcast.
      requestedByLogin: String(item.requestedByLogin || "").slice(0, 64),
      requestedByClient: String(item.requestedByClient || "").slice(0, 80),
      // clientId -> display name (empty for anyone not verified). Kept
      // through storage round-trips; a field missing from this allowlist
      // is silently dropped on every restart, which is a very quiet way
      // to lose data.
      reactors: sanitizeReactors(item.reactors),
      // Both only ever set by the server itself (the !rasputin block) — kept
      // through storage round-trips so a DO restart mid-block doesn't quietly
      // turn a "can't skip this" song into a skippable one.
      special: item.special === "rasputin" ? "rasputin" : null,
      unskippable: Boolean(item.unskippable)
    };
  }

  safeAvatarUrl(value) {
    const raw = String(value || "").trim();
    if (!raw || raw.length > 300) return "";

    try {
      const url = new URL(raw);
      return url.protocol === "https:" ? url.href : "";
    } catch {
      return "";
    }
  }

  safeTitle(value) {
    return String(value || "")
      .replace(/[<>\u0000-\u001f]/g, "")
      .trim()
      .slice(0, 120);
  }

  sanitizeStoredState(input) {
    const current = this.sanitizeItem(input.current);
    const queue = Array.isArray(input.queue)
      ? input.queue.map((item) => this.sanitizeItem(item)).filter(Boolean).slice(0, MAX_QUEUE)
      : [];
    return {
      current,
      queue,
      startedAt: current ? (Number(input.startedAt) || Date.now()) : null,
      revision: Number(input.revision) || 0,
      skipVoters: current && Array.isArray(input.skipVoters)
        // Only the prefixed form survives a reload. A bare client id is
        // from the previous scheme and can never be matched or cleared
        // by anyone, so it would sit there inflating the count forever.
        ? input.skipVoters.map(String).filter((v) => /^(user|client):/.test(v)).slice(0, 100)
        : []
    };
  }

  safeName(value) {
    return String(value || "Guest")
      .replace(/[<>\u0000-\u001f]/g, "")
      .trim()
      .slice(0, 24) || "Guest";
  }

  sanitizeHistoryEntry(entry) {
    if (!entry || typeof entry !== "object") return null;
    const videoId = String(entry.videoId || "").trim();
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    return {
      id: String(entry.id || crypto.randomUUID()),
      videoId,
      title: this.safeTitle(entry.title),
      requestedBy: this.safeName(entry.requestedBy),
      requestedByAvatar: this.safeAvatarUrl(entry.requestedByAvatar),
      requestedByLogin: String(entry.requestedByLogin || "").slice(0, 64),
      requestedAt: Number(entry.requestedAt) || Date.now()
    };
  }

  sanitizeUserStat(login, entry) {
    const safeLogin = String(login || "").trim().slice(0, 64);
    if (!safeLogin || !entry || typeof entry !== "object") return null;
    return {
      login: safeLogin,
      displayName: this.safeName(entry.displayName),
      avatar: this.safeAvatarUrl(entry.avatar),
      count: Math.max(0, Number(entry.count) || 0),
      rating: Math.round(Number(entry.rating) || ELO_START),
      rated: Math.max(0, Number(entry.rated) || 0),
      up: Math.max(0, Number(entry.up) || 0),
      fire: Math.max(0, Number(entry.fire) || 0),
      trash: Math.max(0, Number(entry.trash) || 0),
      del: Math.max(0, Number(entry.del) || 0)
    };
  }

  /** The room's mean rating — what a song is scored against. */
  averageRating() {
    const rated = [...this.userStats.values()].filter((entry) => entry.rated > 0);
    if (!rated.length) return ELO_START;
    return rated.reduce((sum, entry) => sum + (Number(entry.rating) || ELO_START), 0) / rated.length;
  }

  /**
   * Scores a song that has just finished and moves its requester's rating.
   *
   * A song nobody reacted to changes nothing. Silence is not a verdict,
   * and treating it as one would drag everybody toward the mean for
   * playing at a quiet hour.
   */
  rateFinishedSong(item) {
    const login = String(item?.requestedByLogin || "");
    if (!login) return;

    const reactors = item.reactors || {};
    const self = String(item.requestedByClient || "");

    let positive = 0;
    let negative = 0;
    const tally = { up: 0, fire: 0, trash: 0, del: 0 };

    for (const kind of REACTION_KINDS) {
      for (const [clientId, name] of Object.entries(reactors[kind] || {})) {
        // Voting up your own request should not be a strategy.
        //
        // The client id catches it for anything queued from the site. A
        // song requested from chat has no client id attached, so the
        // verified display name is checked too — both sides of that
        // comparison only ever come from a Twitch-verified session.
        if (self && clientId === self) continue;
        if (name && item.requestedBy && name === item.requestedBy) continue;
        tally[kind] += 1;
        if (ELO_POSITIVE.has(kind)) positive += ELO_WEIGHTS[kind];
        else negative += ELO_WEIGHTS[kind];
      }
    }

    const total = positive + negative;
    if (!total) return;

    const stats = this.userStats.get(login) || this.sanitizeUserStat(login, {
      displayName: item.requestedBy,
      avatar: item.requestedByAvatar
    });
    if (!stats) return;

    const rating = Number(stats.rating) || ELO_START;
    const expected = eloExpected(rating, this.averageRating());
    const actual = positive / total;

    // More reactions means more confidence, so the move is bigger — but
    // capped, or one busy song would swamp everything before it.
    const k = Math.min(32, 10 + 3 * total);

    stats.rating = Math.round(rating + k * (actual - expected));
    stats.rated += 1;
    for (const kind of REACTION_KINDS) stats[kind] += tally[kind];

    this.userStats.set(login, stats);
    console.log(
      `Rating: ${login} ${rating} -> ${stats.rating} ` +
      `(+${positive}/-${negative} on "${item.title}")`
    );
  }

  // Shared by a normal "add" request and the StreamElements chat-request
  // sync below — both just need the current/queue placement and history/stat
  // bookkeeping, they only differ in where the item and its verified
  // requester came from.
  enqueueItem(item, login, clientId = "") {
    item.requestedByLogin = String(login || "");
    item.requestedByClient = String(clientId || "");

    if (!this.state.current) {
      this.state.current = item;
      this.state.startedAt = Date.now();
      this.state.skipVoters = [];
    } else {
      this.state.queue.push(item);
    }

    this.state.revision += 1;
    this.recordRequest(item, login);
  }

  recordRequest(item, login) {
    this.history.push({
      id: item.id,
      videoId: item.videoId,
      title: item.title,
      requestedBy: item.requestedBy,
      requestedByAvatar: item.requestedByAvatar,
      requestedByLogin: login,
      requestedAt: item.addedAt
    });
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }

    const existing = this.userStats.get(login) || {
      login,
      displayName: item.requestedBy,
      avatar: item.requestedByAvatar,
      count: 0
    };
    existing.displayName = item.requestedBy || existing.displayName;
    existing.avatar = item.requestedByAvatar || existing.avatar;
    existing.count += 1;
    this.userStats.set(login, existing);

    if (this.userStats.size > MAX_USER_STATS) {
      const sorted = [...this.userStats.entries()].sort((a, b) => b[1].count - a[1].count);
      this.userStats = new Map(sorted.slice(0, MAX_USER_STATS));
    }
  }

  userStatsList() {
    return [...this.userStats.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 100);
  }

  async persistHistoryAndStats() {
    await this.ctx.storage.put("music-history", this.history);
    await this.ctx.storage.put("music-user-stats", Object.fromEntries(this.userStats));
  }

  // Pulls new "!sr" requests out of StreamElements' own public queue and
  // drops them into the shared EastCoin queue, so chat doesn't need to also
  // use the site's search bar. Runs on a self-rearming alarm (see alarm()
  // below) rather than trusting any client to trigger it.
  /**
   * Removes an entry from StreamElements' own request queue.
   *
   * StreamElements only clears a request when ITS player finishes it,
   * and its player never runs — the songs play here instead. So every
   * "!sr" ever typed accumulates on their side until something removes
   * it. Used for two things: binning entries this room refused outright,
   * and clearing anything the room's own queue no longer holds.
   *
   * Needs STREAMELEMENTS_JWT as a Worker secret (separate from the Pages
   * one). Without it this is a no-op and the old behaviour stands, so it
   * is safe to ship ahead of the token.
   */
  async deleteStreamElementsEntry(channelId, seId) {
    const jwt = String(this.env.STREAMELEMENTS_JWT || "").trim();
    if (!jwt || !channelId || !seId) return false;

    try {
      const response = await fetch(
        `https://api.streamelements.com/kappa/v2/songrequest/${encodeURIComponent(channelId)}/queue/${encodeURIComponent(seId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } }
      );
      // 404 means it is already gone, which is the state we wanted.
      if (response.ok || response.status === 404) return true;
      console.error(`StreamElements queue delete failed ${response.status} for ${seId}`);
      return false;
    } catch (error) {
      console.error("StreamElements queue delete threw", error);
      return false;
    }
  }

  /**
   * Puts a song into StreamElements' own request queue.
   *
   * The other half of the mirror. Without it the two queues can only ever
   * agree about songs that arrived through chat — anything added from the
   * site would exist here and nowhere else.
   *
   * Returns the created entry's id when StreamElements gives one back, so
   * the import loop can be told to ignore it. Without that id the entry
   * is still safe, just handled a poll later by the reconcile pass.
   */
  async addStreamElementsEntry(channelId, videoId) {
    const jwt = String(this.env.STREAMELEMENTS_JWT || "").trim();
    if (!jwt || !channelId || !videoId) return null;

    try {
      const response = await fetch(
        `https://api.streamelements.com/kappa/v2/songrequest/${encodeURIComponent(channelId)}/queue`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
          body: JSON.stringify({ video: `https://www.youtube.com/watch?v=${videoId}` })
        }
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        // Loud, and with the body: the accepted request shape is not
        // documented anywhere we can check, so if this is wrong the log
        // is the only thing that will say so.
        console.error(
          `StreamElements queue add failed ${response.status} for ${videoId}: ${body.slice(0, 300)}`
        );
        return null;
      }

      const payload = await response.json().catch(() => null);
      return String(payload?._id || payload?.id || "") || null;
    } catch (error) {
      console.error("StreamElements queue add threw", error);
      return null;
    }
  }

  /**
   * Makes StreamElements' queue equal this room's queue.
   *
   * The room is the source of truth: it is where songs are actually
   * played, skipped and voted on. Their queue is a view of it.
   *
   * The currently playing song is deliberately not mirrored. Both systems
   * treat "playing" as separate from "queued", so putting it in their
   * queue would show it twice.
   */
  async syncStreamElementsQueue(channelId) {
    const jwt = String(this.env.STREAMELEMENTS_JWT || "").trim();
    if (!jwt || !channelId) return;

    const remote = await fetchStreamElementsQueue(channelId);
    const wanted = this.state.queue.map((item) => String(item.videoId));
    const wantedSet = new Set(wanted);

    // Group by video, keeping their order, so duplicates are visible.
    const byVideo = new Map();
    for (const entry of remote) {
      const videoId = String(entry?.videoId || "");
      const id = String(entry?._id || "");
      if (!videoId || !id) continue;
      if (!byVideo.has(videoId)) byVideo.set(videoId, []);
      byVideo.get(videoId).push(id);
    }

    let removed = 0;
    for (const [videoId, ids] of byVideo) {
      // Keep one copy of anything the room still wants; delete the rest,
      // and delete everything the room no longer has at all.
      const keep = wantedSet.has(videoId) ? 1 : 0;
      if (keep) this.seenStreamElementsIds.add(ids[0]);
      for (const id of ids.slice(keep)) {
        if (await this.deleteStreamElementsEntry(channelId, id)) removed += 1;
      }
    }

    let added = 0;
    for (const videoId of wanted) {
      if (byVideo.has(videoId)) continue;
      const id = await this.addStreamElementsEntry(channelId, videoId);
      if (id) this.seenStreamElementsIds.add(id);
      if (id !== null) added += 1;
    }

    if (removed || added) {
      console.log(
        `StreamElements queue synced: +${added} -${removed}, now mirroring ${wanted.length}`
      );
    }
  }

  async pollStreamElements() {
    const channelId = String(this.env.STREAMELEMENTS_CHANNEL_ID || "").trim();
    if (!channelId) return;

    const queue = await fetchStreamElementsQueue(channelId);

    // No early return on an empty queue. Empty is exactly when the room
    // most likely has songs their side is missing, and returning here
    // would skip the sync that pushes them.
    let changed = false;

    for (const entry of queue) {
      const seId = String(entry?._id || "");
      if (!seId || this.seenStreamElementsIds.has(seId)) continue;
      this.seenStreamElementsIds.add(seId);

      const videoId = String(entry?.videoId || "").trim();
      const login = String(entry?.user?.username || "").trim().toLowerCase();
      const durationSeconds = Number(entry?.duration);

      const alreadyQueued =
        this.state.current?.videoId === videoId ||
        this.state.queue.some((queued) => queued.videoId === videoId);
      const queueFull = this.state.queue.length >= MAX_QUEUE && this.state.current;
      const tooLong = Number.isFinite(durationSeconds) && durationSeconds > MAX_VIDEO_SECONDS;

      // Checked FIRST, and never deleted here. An entry whose video the
      // room already holds is usually one this room put there itself, to
      // mirror its own queue. Deleting it would undo the mirror on every
      // poll and then re-add it on the next — a delete/add loop against
      // their API. The reconcile pass owns that decision instead.
      if (alreadyQueued) continue;

      // Genuine refusals still go: they can never be played from either
      // queue, so leaving them would just occupy a slot.
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !login || tooLong) {
        this.ctx.waitUntil(this.deleteStreamElementsEntry(channelId, seId));
        continue;
      }
      if (queueFull) {
        // Left in place on purpose, and un-seen so the next poll retries it.
        this.seenStreamElementsIds.delete(seId);
        continue;
      }

      const item = {
        id: crypto.randomUUID(),
        videoId,
        title: this.safeTitle(entry.title),
        requestedBy: this.safeName(login),
        requestedByAvatar: "",
        addedAt: Date.now(),
        reactors: {}
      };

      this.enqueueItem(item, login);
      // Their copy stays: it is what makes the mediarequest page show a
      // backlog. It cannot be imported twice — seenStreamElementsIds has
      // it now — so it is inert, and the cap below is what removes it.
      changed = true;
    }

    if (this.seenStreamElementsIds.size > MAX_SE_SEEN_IDS) {
      // A Set preserves insertion order, so slicing from the front drops
      // the oldest entries first.
      this.seenStreamElementsIds = new Set([...this.seenStreamElementsIds].slice(-MAX_SE_SEEN_IDS));
    }
    await this.ctx.storage.put("music-se-seen-ids", [...this.seenStreamElementsIds]);

    if (changed) {
      await Promise.all([this.persistAndBroadcast(), this.persistHistoryAndStats()]);
    }

    // After importing, not before: a chat request should reach the room
    // first, so the mirror is drawn from a queue that already contains it.
    await this.syncStreamElementsQueue(channelId);
  }

  // Arms the polling alarm (which also double-checks the Twitch IRC
  // connection each cycle) if one isn't already scheduled. Called whenever
  // a listener connects, since the alarm intentionally stops rearming
  // itself once the room is empty (see alarm()) to avoid polling
  // StreamElements or holding a chat connection open for a room nobody is
  // actually in.
  async ensurePolling() {
    if (!this.env.STREAMELEMENTS_CHANNEL_ID && !this.env.TWITCH_CHAT_CHANNEL) return;
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null) {
      await this.ctx.storage.setAlarm(Date.now() + SE_POLL_INTERVAL_MS);
    }
  }

  async alarm() {
    await this.pollStreamElements();
    await this.ensureTwitchIrc();
    if (this.sessions.size > 0) {
      await this.ctx.storage.setAlarm(Date.now() + SE_POLL_INTERVAL_MS);
    }
  }

  // Anonymous, read-only connection to Twitch's own chat (the same IRC-over-
  // WebSocket gateway many chat overlays/bots use) — no OAuth or bot account
  // needed, since we only ever read public chat, never post to it. This is
  // what lets a plain "!skip" typed in chat skip the room's current song
  // without StreamElements needing to expose anything for it (unlike "!sr",
  // there's no public queue endpoint for "someone typed a command" — chat
  // itself is the only place that exists).
  async ensureTwitchIrc() {
    const channel = String(this.env.TWITCH_CHAT_CHANNEL || "").trim().toLowerCase();
    if (!channel) return;

    // A concurrency guard, not just a liveness check — without it, the
    // fetch() below (which awaits a network round-trip) can overlap between
    // an alarm tick and a new listener connecting, spinning up two IRC
    // sockets where only the second ever gets tracked in
    // this.twitchIrcSocket. If the first one's close event later fires, its
    // "if (this.twitchIrcSocket === ws)" check correctly no-ops (it's not
    // the current one) — but that also means a *dead* first connection can
    // silently coexist with a live second one, or vice versa, with nothing
    // in the logs to explain why reconnects stopped happening.
    if (this.connectingIrc) return;

    if (this.twitchIrcSocket) {
      const state = this.twitchIrcSocket.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
      console.log(`Twitch IRC: clearing stale socket (readyState ${state}) before reconnecting`);
      this.twitchIrcSocket = null;
    }

    this.connectingIrc = true;
    try {
      const response = await fetch("https://irc-ws.chat.twitch.tv:443", {
        headers: { Upgrade: "websocket" }
      });
      const ws = response.webSocket;
      if (!ws) {
        console.error("Twitch IRC: server did not upgrade the connection");
        return;
      }

      ws.accept();
      this.twitchIrcSocket = ws;
      console.log(`Twitch IRC: connecting, joining #${channel}`);

      ws.addEventListener("message", (event) => {
        try { this.handleTwitchIrcMessage(event); } catch {}
      });
      ws.addEventListener("close", (event) => {
        console.log(`Twitch IRC: closed (${event.code} ${event.reason || ""})`);
        if (this.twitchIrcSocket === ws) this.twitchIrcSocket = null;
      });
      ws.addEventListener("error", (event) => {
        console.error("Twitch IRC: connection error", event.message || "");
        try { ws.close(); } catch {}
        if (this.twitchIrcSocket === ws) this.twitchIrcSocket = null;
      });

      const anonNick = `justinfan${Math.floor(10000 + Math.random() * 90000)}`;
      ws.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
      ws.send("PASS SCHMOOPIE");
      ws.send(`NICK ${anonNick}`);
      ws.send(`JOIN #${channel}`);
    } catch (error) {
      console.error("Twitch IRC: failed to connect", error);
      this.twitchIrcSocket = null;
    } finally {
      this.connectingIrc = false;
    }
  }

  handleTwitchIrcMessage(event) {
    const raw = typeof event.data === "string" ? event.data : "";
    for (const line of raw.split("\r\n")) {
      if (!line) continue;

      if (line.startsWith("PING")) {
        try { this.twitchIrcSocket?.send("PONG :tmi.twitch.tv"); } catch {}
        continue;
      }

      const parsed = parseTwitchIrcLine(line);
      if (!parsed) continue;

      if (parsed.command === "JOIN") {
        console.log(`Twitch IRC: joined ${parsed.params[0] || ""}`);
        continue;
      }
      if (parsed.command === "NOTICE") {
        console.error("Twitch IRC: notice", parsed.params.join(" "));
        continue;
      }
      if (parsed.command !== "PRIVMSG") continue;

      const text = String(parsed.params[parsed.params.length - 1] || "").trim();
      const login = String(parsed.prefix.split("!")[0] || "").trim().toLowerCase();
      if (!login) continue;

      if (/^!skip\b/i.test(text)) {
        console.log(`Twitch IRC: !skip from ${login}`);
        this.ctx.waitUntil(this.handleChatSkip(login));
      } else if (/^!rasputin\b/i.test(text)) {
        this.ctx.waitUntil(this.handleRasputinCommand(login));
      } else if (/^!(sr|mr)clear\b/i.test(text)) {
        console.log(`Twitch IRC: !srclear from ${login}`);
        this.ctx.waitUntil(this.clearQueue(login));
      }
    }
  }

  async handleChatSkip(login) {
    if (!this.state.current) return;

    // Unskippable blocks everyone except the same two logins who can
    // trigger !rasputin in the first place — they can still bail out of
    // their own block from chat, just nobody else.
    if (this.state.current.unskippable && !RASPUTIN_ALLOWED_LOGINS.has(login)) {
      console.log(`Twitch IRC: !skip from ${login} ignored — "${this.state.current.title}" is unskippable`);
      return;
    }

    // A simple cooldown, not a vote count — chat's "!skip" is meant as a
    // direct, immediate control (mirroring the trust already placed in the
    // stream's own chat), just guarded against a burst of near-simultaneous
    // messages triggering more than one skip.
    const now = Date.now();
    if (now - this.lastChatSkipAt < TWITCH_IRC_SKIP_COOLDOWN_MS) return;
    this.lastChatSkipAt = now;

    console.log(`Twitch IRC: skipping "${this.state.current.title}" (requested by ${login})`);
    this.advance({ kind: "chat-skip", actor: this.safeName(login) });
    await this.persistAndBroadcast();
  }

  // "!rasputin" — a fixed, hand-picked 4-song block only andyreidisapawg and
  // zwades can trigger from chat. Jumps to the front of the queue (right
  // after whatever's currently playing) rather than waiting behind it, and
  // every song in it is flagged unskippable — see the skip-vote and
  // handleChatSkip guards. A real, natural end-of-video (or a genuinely
  // broken video) still advances past it normally; only a deliberate skip
  // attempt is blocked.
  async handleRasputinCommand(login) {
    if (!RASPUTIN_ALLOWED_LOGINS.has(login)) {
      console.log(`!rasputin attempted by ${login} — not authorized, ignoring`);
      return;
    }

    const now = Date.now();
    if (now - this.lastRasputinAt < RASPUTIN_COOLDOWN_MS) return;
    this.lastRasputinAt = now;

    console.log(`🎉 !rasputin triggered by ${login} — queuing the block`);

    const items = RASPUTIN_BLOCK.map((song) => ({
      id: crypto.randomUUID(),
      videoId: song.videoId,
      title: this.safeTitle(song.title),
      requestedBy: this.safeName(login),
      requestedByAvatar: "",
      addedAt: Date.now(),
      reactors: {},
      special: "rasputin",
      unskippable: true
    }));

    let toQueue = items;
    if (!this.state.current) {
      this.state.current = items[0];
      this.state.startedAt = Date.now();
      this.state.skipVoters = [];
      toQueue = items.slice(1);
    }

    this.state.queue = [...toQueue, ...this.state.queue].slice(0, MAX_QUEUE);
    this.state.revision += 1;
    items.forEach((item) => this.recordRequest(item, login));

    await Promise.all([this.persistAndBroadcast(), this.persistHistoryAndStats()]);
  }

  // Mirrors a StreamElements "!srclear" into the Music Room. The song that
  // is playing right now is deliberately left alone: SE drops the pending
  // queue, not the track already handed to the player, and cutting someone
  // off mid-song is not what chat means by "clear the queue".
  //
  // seenStreamElementsIds is deliberately NOT reset. Those ids are what stop
  // pollStreamElements re-importing a request, so keeping them is what makes
  // the clear stick: if SE's own queue did not actually empty (the command
  // was refused there, or SE lagged), the next poll would otherwise refill
  // the room within seconds.
  async clearQueue(login) {
    if (!QUEUE_CLEAR_ALLOWED_LOGINS.has(login)) {
      console.log(`!srclear from ${login} ignored — not authorized`);
      return false;
    }

    const now = Date.now();
    if (now - this.lastQueueClearAt < QUEUE_CLEAR_COOLDOWN_MS) return false;
    this.lastQueueClearAt = now;

    const cleared = this.state.queue.length;
    if (!cleared) {
      console.log(`!srclear from ${login} — Music Room queue was already empty`);
      return false;
    }

    this.state.queue = [];
    this.state.revision += 1;
    console.log(`!srclear from ${login} — cleared ${cleared} queued request(s)`);

    await this.persistAndBroadcast();
    return true;
  }

  /**
   * Who has voted to skip, by name.
   *
   * Verified Twitch logins only, the same rule the listener roster uses.
   * A guest's name is whatever their client claimed, and putting an
   * unverified string next to "voted to skip" would let anyone appear to
   * have done it. skipVotes still counts everyone, so the caller can say
   * how many are unaccounted for.
   */
  skipVoterNames() {
    const names = [];
    for (const session of this.sessions.values()) {
      if (!session.verifiedLogin) continue;
      // The list holds voterKey(session), not a bare client id. Matching
      // the wrong shape found nobody, so every vote read as anonymous.
      if (!this.state.skipVoters.includes(this.voterKey(session))) continue;
      names.push(this.safeName(session.name));
      if (names.length >= 20) break;
    }
    return names;
  }

  /**
   * People in the room, not open sockets.
   *
   * Someone with the room in two tabs is two sessions and one listener.
   * Counting sockets inflated the skip threshold with every extra tab,
   * which made a vote progressively harder to reach the more devices the
   * same handful of people had open.
   */
  distinctListeners() {
    const seen = new Set();
    for (const session of this.sessions.values()) {
      seen.add(this.voterKey(session));
    }
    return Math.max(1, seen.size);
  }

  /**
   * How one person is identified for a vote.
   *
   * A verified Twitch login where there is one, so a second tab, a second
   * browser or cleared storage cannot buy another vote. Guests fall back
   * to the client id they carry, which is the best that can be done
   * without asking them to log in.
   */
  voterKey(session) {
    return session?.verifiedLogin
      ? `user:${session.verifiedLogin}`
      : `client:${session?.clientId || ""}`;
  }

  listenerNames() {
    const seenLogins = new Set();
    const names = [];
    for (const session of this.sessions.values()) {
      if (!session.verifiedLogin || seenLogins.has(session.verifiedLogin)) continue;
      seenLogins.add(session.verifiedLogin);
      names.push(this.safeName(session.name));
      if (names.length >= 40) break;
    }
    return names;
  }

  /**
   * The playing song as clients should see it.
   *
   * reactors is keyed by client id, and the login and client id of whoever
   * queued it are bookkeeping. None of that belongs in a broadcast that
   * every listener receives — the counts and verified names already go
   * out separately as `reactions`.
   */
  publicCurrent() {
    if (!this.state.current) return null;
    const { reactors, requestedByLogin, requestedByClient, ...rest } = this.state.current;
    return rest;
  }

  publicState() {
    const listeners = this.distinctListeners();
    return {
      current: this.publicCurrent(),
      queue: this.state.queue,
      startedAt: this.state.startedAt,
      revision: this.state.revision,
      listeners,
      listenerNames: this.listenerNames(),
      reactions: publicReactions(this.state.current?.reactors),
      skipVotes: this.state.skipVoters.length,
      skipVoterNames: this.skipVoterNames(),
      skipThreshold: skipThresholdFor(listeners),
      notice: this.state.notice || null
    };
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/history/")) {
      return json(
        { history: this.history, userStats: this.userStatsList() },
        200,
        corsHeaders(request, this.env)
      );
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const clientId = String(url.searchParams.get("client") || crypto.randomUUID()).slice(0, 80);
    const name = this.safeName(url.searchParams.get("name"));
    const avatar = this.safeAvatarUrl(url.searchParams.get("avatar"));
    const attachment = { clientId, name, avatar, verifiedLogin: null };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    this.sessions.set(server, attachment);

    this.sendState(server);
    this.broadcastState();
    await this.ensurePolling();
    await this.ensureTwitchIrc();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, rawMessage) {
    let message;
    try {
      message = JSON.parse(typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage));
    } catch {
      return this.sendError(ws, "Invalid message.");
    }

    const session = this.sessions.get(ws) || ws.deserializeAttachment() || {
      clientId: crypto.randomUUID(),
      name: "Guest",
      avatar: ""
    };

    if (message.type === "identity") {
      session.name = this.safeName(message.name);
      session.avatar = this.safeAvatarUrl(message.avatar);

      // The public "who's listening" roster only ever shows a name backed by
      // a verified Twitch session — never whatever a client claims — the same
      // way "add" re-derives the requester from the token instead of trusting
      // the message body. No token (or an expired one) just drops the
      // listener out of the roster; they're still counted in the total.
      const auth = message.token ? await verifyMusicToken(message.token, this.env.MUSIC_AUTH_SECRET) : null;
      if (auth) {
        session.verifiedLogin = auth.login;
        session.name = this.safeName(auth.displayName || auth.login);
        session.avatar = this.safeAvatarUrl(auth.avatar) || session.avatar;
      } else {
        session.verifiedLogin = null;
      }

      this.sessions.set(ws, session);
      ws.serializeAttachment(session);
      this.broadcastState();
      return;
    }

    if (message.type === "add") {
      const videoId = String(message.videoId || "").trim();
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        return this.sendError(ws, "Invalid YouTube video ID.");
      }

      // Song requests require a currently-authenticated Twitch account —
      // guests can still listen, react, and vote to skip, but the identity
      // and avatar on a request always come from the verified token, never
      // from whatever the client claims.
      const auth = await verifyMusicToken(message.token, this.env.MUSIC_AUTH_SECRET);
      if (!auth) {
        return this.sendError(ws, "You need to be logged in with Twitch to request a song.");
      }

      if (
        this.state.current?.videoId === videoId ||
        this.state.queue.some((item) => item.videoId === videoId)
      ) {
        return this.sendError(ws, "That video is already in the queue.");
      }

      if (this.state.queue.length >= MAX_QUEUE && this.state.current) {
        return this.sendError(ws, `Queue is limited to ${MAX_QUEUE} songs.`);
      }

      const details = await fetchVideoDetails(videoId, this.env.YOUTUBE_API_KEY);
      const durationSeconds = details.durationSeconds;
      if (durationSeconds !== null && durationSeconds > MAX_VIDEO_SECONDS) {
        return this.sendError(
          ws,
          `That video is too long. EastCoin's music room is limited to ${Math.round(MAX_VIDEO_SECONDS / 60)}-minute songs.`
        );
      }

      const now = Date.now();
      const recentRequests = (this.requestLog.get(session.clientId) || [])
        .filter((timestamp) => now - timestamp < REQUEST_LIMIT_WINDOW_MS);

      if (recentRequests.length >= REQUEST_LIMIT) {
        this.requestLog.set(session.clientId, recentRequests);
        const retryMinutes = Math.max(1, Math.ceil((REQUEST_LIMIT_WINDOW_MS - (now - recentRequests[0])) / 60000));
        return this.sendError(
          ws,
          `You've hit the ${REQUEST_LIMIT}-song hourly limit. Try again in ${retryMinutes} minute${retryMinutes === 1 ? "" : "s"}.`
        );
      }

      recentRequests.push(now);
      this.requestLog.set(session.clientId, recentRequests);

      const item = {
        id: crypto.randomUUID(),
        videoId,
        // Whatever the client knew, else what YouTube says. Something
        // added without either used to sit in the queue as "Untitled".
        title: this.safeTitle(message.title || details.title),
        requestedBy: this.safeName(auth.displayName || auth.login),
        requestedByAvatar: this.safeAvatarUrl(auth.avatar),
        addedAt: Date.now(),
        reactors: {}
      };

      this.enqueueItem(item, auth.login, session.clientId);
      await Promise.all([this.persistAndBroadcast(), this.persistHistoryAndStats()]);
      return;
    }

    if (message.type === "react") {
      if (!this.state.current || String(message.currentId || "") !== this.state.current.id) return;

      const kind = String(message.kind || "");
      if (!REACTION_KINDS.includes(kind)) return;

      if (!this.state.current.reactors) this.state.current.reactors = {};
      const bucket = this.state.current.reactors[kind] || {};

      // Toggling rather than counting up. One person holding the button
      // could otherwise run the number to whatever they liked, and there
      // would be no way to take a reaction back.
      if (bucket[session.clientId] !== undefined) {
        delete bucket[session.clientId];
      } else {
        bucket[session.clientId] = session.verifiedLogin ? this.safeName(session.name) : "";
      }

      if (Object.keys(bucket).length) this.state.current.reactors[kind] = bucket;
      else delete this.state.current.reactors[kind];

      this.state.revision += 1;
      await this.persistAndBroadcast();
      return;
    }

    if (message.type === "skip-vote") {
      if (!this.state.current || String(message.currentId || "") !== this.state.current.id) return;
      if (this.state.current.unskippable) {
        return this.sendError(ws, "This one can't be skipped 🎉");
      }

      // Keyed on the person, so a second tab cannot vote again. Pressing
      // it a second time takes the vote back rather than doing nothing,
      // which is also what makes a stuck vote recoverable.
      const key = this.voterKey(session);
      const at = this.state.skipVoters.indexOf(key);
      if (at === -1) this.state.skipVoters.push(key);
      else this.state.skipVoters.splice(at, 1);

      const listeners = this.distinctListeners();
      const threshold = skipThresholdFor(listeners);
      if (this.state.skipVoters.length >= threshold) {
        console.log(
          `Skip vote: threshold reached (${this.state.skipVoters.length}/${threshold} of ${listeners} listeners) — skipping "${this.state.current.title}"`
        );
        this.advance({
          kind: "vote-skip",
          votes: this.state.skipVoters.length,
          listeners
        });
      } else {
        this.state.revision += 1;
      }

      await this.persistAndBroadcast();
      return;
    }

    if (message.type === "force-skip") {
      // The login comes from the verified token the room derived on
      // identity, never from anything the client sent in this message.
      const login = String(session.verifiedLogin || "").toLowerCase();
      if (!FORCE_SKIP_LOGINS.has(login)) {
        return this.sendError(ws, "Only room mods can skip without a vote.");
      }
      if (!this.state.current) return;

      console.log(`Force skip by ${login}: "${this.state.current.title}"`);
      this.advance({ kind: "chat-skip", actor: this.safeName(session.name || login) });
      await this.persistAndBroadcast();
      return;
    }

    if (message.type === "ended") {
      if (!this.state.current || String(message.currentId || "") !== this.state.current.id) return;
      const reason = String(message.reason || "state-change").slice(0, 40);
      console.log(
        `Client-reported ended (${reason}): advancing past "${this.state.current.title}" (clientId ${session.clientId})`
      );
      this.advance(
        reason === "player-error"
          ? { kind: "error" }
          : reason === "safety-net"
            ? { kind: "safety-net" }
            : null
      );
      await this.persistAndBroadcast();
    }
  }

  // `notice` explains why the song ended, so listeners aren't left guessing.
  // A natural end passes nothing: only the unusual endings are worth saying
  // out loud. Whatever is set here rides along in publicState() and is shown
  // by every connected client.
  advance(notice = null) {
    const outgoing = this.state.current;
    // Scored on the way out, when its reactions are final.
    this.rateFinishedSong(outgoing);

    this.state.current = this.state.queue.shift() || null;
    this.state.startedAt = this.state.current ? Date.now() : null;
    this.state.skipVoters = [];
    this.state.revision += 1;

    this.state.notice = notice
      ? {
          id: crypto.randomUUID(),
          at: Date.now(),
          title: this.safeTitle(outgoing?.title || ""),
          ...notice
        }
      : null;
  }

  async persistAndBroadcast() {
    await this.ctx.storage.put("music-state", this.state);
    this.broadcastState();
  }

  sendState(ws) {
    try {
      ws.send(JSON.stringify({ type: "state", state: this.publicState() }));
    } catch {}
  }

  broadcastState() {
    const message = JSON.stringify({ type: "state", state: this.publicState() });
    for (const connected of this.ctx.getWebSockets()) {
      try { connected.send(message); } catch {}
    }
  }

  sendError(ws, message) {
    try { ws.send(JSON.stringify({ type: "error", message })); } catch {}
  }

  webSocketClose(ws, code, reason) {
    this.sessions.delete(ws);
    try { ws.close(code, reason); } catch {}
    this.broadcastState();
    this.closeTwitchIrcIfEmpty();
  }

  webSocketError(ws) {
    this.sessions.delete(ws);
    this.broadcastState();
    this.closeTwitchIrcIfEmpty();
  }

  // Mirrors the alarm loop's own "stop once the room is empty" behavior —
  // without this, the outbound Twitch chat connection (and the DO holding
  // it open to receive messages) would never go idle even after everyone
  // leaves. ensureTwitchIrc() reopens it the moment someone reconnects.
  closeTwitchIrcIfEmpty() {
    if (this.sessions.size > 0) return;
    try { this.twitchIrcSocket?.close(); } catch {}
    this.twitchIrcSocket = null;
  }
}
