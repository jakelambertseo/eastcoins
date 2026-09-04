import { DurableObject } from "cloudflare:workers";

const MAX_QUEUE = 25;
const REQUEST_LIMIT = 4;
const REQUEST_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://eastcoin.vip",
  "https://www.eastcoin.vip",
  "https://eastcoins.pages.dev",
  "http://localhost:4321",
  "http://localhost:8788",
  "http://127.0.0.1:4321",
  "http://127.0.0.1:8788"
]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
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

    return json({
      ok: true,
      endpoints: {
        health: "/health",
        websocket: "/room/<room-name>"
      }
    });
  }
};

export class MusicRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sessions = new Map();
    this.state = this.emptyState();
    // In-memory only (not persisted to storage) — a DO restart resets everyone's
    // hourly count, which is an acceptable tradeoff for a small friend-group room.
    this.requestLog = new Map();

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

  publicState() {
    const listeners = Math.max(1, this.sessions.size);
    return {
      current: this.state.current,
      queue: this.state.queue,
      startedAt: this.state.startedAt,
      revision: this.state.revision,
      listeners,
      skipVotes: this.state.skipVoters.length,
      skipThreshold: Math.max(1, Math.ceil(listeners / 2))
    };
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const url = new URL(request.url);

    const clientId = String(url.searchParams.get("client") || crypto.randomUUID()).slice(0, 80);
    const name = this.safeName(url.searchParams.get("name"));
    const avatar = this.safeAvatarUrl(url.searchParams.get("avatar"));
    const attachment = { clientId, name, avatar };

    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(attachment);
    this.sessions.set(server, attachment);

    this.sendState(server);
    this.broadcastState();

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

      if (
        this.state.current?.videoId === videoId ||
        this.state.queue.some((item) => item.videoId === videoId)
      ) {
        return this.sendError(ws, "That video is already in the queue.");
      }

      if (this.state.queue.length >= MAX_QUEUE && this.state.current) {
        return this.sendError(ws, `Queue is limited to ${MAX_QUEUE} songs.`);
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
        requestedBy: this.safeName(message.requestedBy || session.name),
        requestedByAvatar: this.safeAvatarUrl(message.requestedByAvatar || session.avatar),
        addedAt: Date.now(),
        reactions: 0
      };

      if (!this.state.current) {
        this.state.current = item;
        this.state.startedAt = Date.now();
        this.state.skipVoters = [];
      } else {
        this.state.queue.push(item);
      }

      this.state.revision += 1;
      await this.persistAndBroadcast();
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

      const threshold = Math.max(1, Math.ceil(Math.max(1, this.sessions.size) / 2));
      if (this.state.skipVoters.length >= threshold) {
        this.advance();
      } else {
        this.state.revision += 1;
      }

      await this.persistAndBroadcast();
      return;
    }

    if (message.type === "ended") {
      if (!this.state.current || String(message.currentId || "") !== this.state.current.id) return;
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
  }

  webSocketError(ws) {
    this.sessions.delete(ws);
    this.broadcastState();
  }
}
