import { DurableObject } from "cloudflare:workers";

const MAX_QUEUE = 25;
const REQUEST_LIMIT = 25;
const REQUEST_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_VIDEO_SECONDS = 600;
const MAX_HISTORY = 300;
const MAX_USER_STATS = 500;
const SE_POLL_INTERVAL_MS = 20 * 1000;
const MAX_SE_SEEN_IDS = 500;
const TWITCH_IRC_SKIP_COOLDOWN_MS = 5000;
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
async function fetchVideoDurationSeconds(videoId, apiKey) {
  if (!apiKey) return null;

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=contentDetails&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const iso = data?.items?.[0]?.contentDetails?.duration;
    return iso ? parseIso8601Duration(iso) : null;
  } catch {
    return null;
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
function skipThresholdFor(listeners) {
  const count = Math.max(1, Number(listeners) || 1);
  if (count <= 2) return count;
  return Math.floor(count / 2) + 1;
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
    this.lastChatSkipAt = 0;

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
      reactions: Math.max(0, Number(item.reactions) || 0)
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
        ? input.skipVoters.map(String).slice(0, 100)
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
      count: Math.max(0, Number(entry.count) || 0)
    };
  }

  // Shared by a normal "add" request and the StreamElements chat-request
  // sync below — both just need the current/queue placement and history/stat
  // bookkeeping, they only differ in where the item and its verified
  // requester came from.
  enqueueItem(item, login) {
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
  async pollStreamElements() {
    const channelId = String(this.env.STREAMELEMENTS_CHANNEL_ID || "").trim();
    if (!channelId) return;

    const queue = await fetchStreamElementsQueue(channelId);
    if (!queue.length) return;

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

      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId) || !login || alreadyQueued || queueFull || tooLong) {
        continue;
      }

      const item = {
        id: crypto.randomUUID(),
        videoId,
        title: this.safeTitle(entry.title),
        requestedBy: this.safeName(login),
        requestedByAvatar: "",
        addedAt: Date.now(),
        reactions: 0
      };

      this.enqueueItem(item, login);
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
    if (this.twitchIrcSocket && this.twitchIrcSocket.readyState === WebSocket.OPEN) return;

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
      if (!/^!skip\b/i.test(text)) continue;

      const login = String(parsed.prefix.split("!")[0] || "").trim().toLowerCase();
      if (!login) continue;
      console.log(`Twitch IRC: !skip from ${login}`);
      this.ctx.waitUntil(this.handleChatSkip(login));
    }
  }

  async handleChatSkip(login) {
    if (!this.state.current) return;

    // A simple cooldown, not a vote count — chat's "!skip" is meant as a
    // direct, immediate control (mirroring the trust already placed in the
    // stream's own chat), just guarded against a burst of near-simultaneous
    // messages triggering more than one skip.
    const now = Date.now();
    if (now - this.lastChatSkipAt < TWITCH_IRC_SKIP_COOLDOWN_MS) return;
    this.lastChatSkipAt = now;

    console.log(`Twitch IRC: skipping "${this.state.current.title}" (requested by ${login})`);
    this.advance();
    await this.persistAndBroadcast();
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

  publicState() {
    const listeners = Math.max(1, this.sessions.size);
    return {
      current: this.state.current,
      queue: this.state.queue,
      startedAt: this.state.startedAt,
      revision: this.state.revision,
      listeners,
      listenerNames: this.listenerNames(),
      skipVotes: this.state.skipVoters.length,
      skipThreshold: skipThresholdFor(listeners)
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

      const durationSeconds = await fetchVideoDurationSeconds(videoId, this.env.YOUTUBE_API_KEY);
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
        title: this.safeTitle(message.title),
        requestedBy: this.safeName(auth.displayName || auth.login),
        requestedByAvatar: this.safeAvatarUrl(auth.avatar),
        addedAt: Date.now(),
        reactions: 0
      };

      this.enqueueItem(item, auth.login);
      await Promise.all([this.persistAndBroadcast(), this.persistHistoryAndStats()]);
      return;
    }

    if (message.type === "react") {
      if (!this.state.current || String(message.currentId || "") !== this.state.current.id) return;
      this.state.current.reactions = (Number(this.state.current.reactions) || 0) + 1;
      this.state.revision += 1;
      await this.persistAndBroadcast();
      return;
    }

    if (message.type === "skip-vote") {
      if (!this.state.current || String(message.currentId || "") !== this.state.current.id) return;

      if (!this.state.skipVoters.includes(session.clientId)) {
        this.state.skipVoters.push(session.clientId);
      }

      const threshold = skipThresholdFor(this.sessions.size);
      if (this.state.skipVoters.length >= threshold) {
        console.log(
          `Skip vote: threshold reached (${this.state.skipVoters.length}/${threshold} of ${this.sessions.size} listeners) — skipping "${this.state.current.title}"`
        );
        this.advance();
      } else {
        this.state.revision += 1;
      }

      await this.persistAndBroadcast();
      return;
    }

    if (message.type === "ended") {
      if (!this.state.current || String(message.currentId || "") !== this.state.current.id) return;
      const reason = String(message.reason || "state-change").slice(0, 40);
      console.log(
        `Client-reported ended (${reason}): advancing past "${this.state.current.title}" (clientId ${session.clientId})`
      );
      this.advance();
      await this.persistAndBroadcast();
    }
  }

  advance() {
    this.state.current = this.state.queue.shift() || null;
    this.state.startedAt = this.state.current ? Date.now() : null;
    this.state.skipVoters = [];
    this.state.revision += 1;
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
