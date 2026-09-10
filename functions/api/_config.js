/* ============================================================
   Site configuration — the one place an environment variable
   becomes a value the rest of the site uses.

   Two things are configurable per deployment:

     TWITCH_CHAT_CHANNEL  whose chat the rail embeds  (default zwades)
     MUSIC_ROOM_URL       the Green Room Worker       (default production)

   Both already existed as env vars — TWITCH_CHAT_CHANNEL on the music
   Worker, MUSIC_ROOM_URL read by three Functions — each with its own
   copy of the default written next to the call. Defaults that disagree
   between call sites are the kind of bug that only shows up in one of
   them, so they live here now and nowhere else.

   The browser gets the same answers from /api/config, which is what
   makes a local Worker or a different channel a matter of setting a
   variable rather than editing a hardcoded URL in three files.
   ============================================================ */

export const DEFAULT_TWITCH_CHANNEL = "zwades";
export const DEFAULT_MUSIC_ROOM_URL = "https://eastcoin-music-room.jake-7f5.workers.dev";
export const DEFAULT_MUSIC_ROOM = "main";

/* A Twitch login is the only thing that can legally sit in the embed
   path. Anything else is a misconfiguration, and interpolating it into
   a URL would either break the iframe or smuggle something into it —
   so an unusable value falls back to the default rather than being
   passed along. Same reasoning for the Worker URL below. */
const TWITCH_LOGIN = /^[a-zA-Z0-9_]{3,25}$/;

export function twitchChannel(env) {
  const value = String(env?.TWITCH_CHAT_CHANNEL || "").trim().toLowerCase();
  return TWITCH_LOGIN.test(value) ? value : DEFAULT_TWITCH_CHANNEL;
}

export function musicRoomUrl(env) {
  const value = String(env?.MUSIC_ROOM_URL || "").trim();
  if (!value) return DEFAULT_MUSIC_ROOM_URL;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_MUSIC_ROOM_URL;
  } catch {
    return DEFAULT_MUSIC_ROOM_URL;
  }
  // Every caller appends a path, so the trailing slash goes exactly once,
  // here, instead of at each of them.
  return value.replace(/\/+$/, "");
}

export function musicRoomName(env) {
  const value = String(env?.MUSIC_ROOM_NAME || "").trim();
  return /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : DEFAULT_MUSIC_ROOM;
}

/* Twitch refuses to render the embed unless the host serving the page is
   named in parent=. The production hosts are fixed, but the host actually
   being served is not — a preview deployment, or localhost while wrangler
   is running — so the request's own hostname is added to the list. That
   is what lets the chat rail work in local dev without anyone maintaining
   a list of hostnames by hand. */
const EMBED_PARENTS = [
  "eastcoin.vip",
  "www.eastcoin.vip",
  "eastcoins.pages.dev",
  "localhost",
  "127.0.0.1"
];

export function chatEmbedUrl(env, request) {
  const parents = new Set(EMBED_PARENTS);
  try {
    const hostname = new URL(request.url).hostname;
    if (hostname) parents.add(hostname);
  } catch {}

  const query = [...parents].map((parent) => `parent=${encodeURIComponent(parent)}`).join("&");
  return `https://www.twitch.tv/embed/${encodeURIComponent(twitchChannel(env))}/chat?${query}&darkpopout`;
}

/** Everything the browser needs, in the shape /api/config returns. */
export function siteConfig(env, request) {
  return {
    twitchChannel: twitchChannel(env),
    chatEmbedUrl: chatEmbedUrl(env, request),
    musicRoomUrl: musicRoomUrl(env),
    musicRoom: musicRoomName(env)
  };
}
