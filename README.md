# EastCoin Music Player

A shell-owned YouTube jukebox that floats beside the persistent Twitch chat, on the V2 shell (`index.html`). Opened from the ♫ button in the top nav, next to Settings — reachable from Events, the watch view, and MultiView/Picks alike, and stays mounted (and playing) across all of them the same way the persistent Twitch chat does.

## What it does

- Real YouTube playback via the YouTube IFrame Player API.
- Accepts pasted `youtube.com/watch`, `music.youtube.com`, `youtu.be`, Shorts, Live and `/embed` links — parsed with the same shared `assets/eastcoins-youtube.js` module the search bar, Custom Stream modal, and `/submit` use.
- Automatic next-song playback, with hardening against duplicate/stale YouTube `ended`/`error` callbacks.
- **Local mode** (default): a per-browser queue in `localStorage` — works immediately, no backend or API key.
- **Shared mode** (optional): a synced queue across everyone via the Cloudflare Worker + Durable Object in `worker/`, with live listener count and majority-vote skip.
- Browser autoplay-block handling with a visible **Join music** button.
- Nicknames / "Requested by" labels, persisted per-browser.

## Files

```
assets/eastcoins-music-player.js    — dock UI, local queue, YouTube IFrame API, WebSocket client
assets/eastcoins-music-player.css   — styled against v2/assets/css/tokens.css (V2 dark/burgundy/gold)
assets/eastcoins-music-config.js    — websocketUrl / room config, plus the ?music=on share-link opener
worker/                             — optional Cloudflare Worker + Durable Object for shared mode
```

`index.html` links all three assets and includes the `#musicBtn` toggle button — no install step, no separate package. It's part of the normal site now.

## Local mode (default, already live)

Nothing to do — `assets/eastcoins-music-config.js` ships with `websocketUrl: ""`, which keeps every browser's queue independent. Good enough to use immediately.

## Shared mode (optional — requires deploying the Worker yourself)

The Worker needs your own Cloudflare login, so this part can't be done for you — here's the exact process:

```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```

Wrangler will print a URL like:

```
https://eastcoin-music-room.<your-workers-subdomain>.workers.dev
```

Then edit `assets/eastcoins-music-config.js` and set:

```js
websocketUrl: "https://eastcoin-music-room.<your-workers-subdomain>.workers.dev",
```

The client converts that to `wss://` automatically and connects to `/room/main`. Commit and push the change like any other edit — no script needed.

### Verify the Worker

```
https://eastcoin-music-room.<your-workers-subdomain>.workers.dev/health
```

should return `{"ok":true,"service":"eastcoin-music-room"}`. Then open EastCoin in two different browsers/devices, open the ♫ Music Player, and request a link — both should show the same queue, and the header should read "Shared" instead of "Local".

### If you deploy from a non-default origin

The Worker only accepts WebSocket connections from an allow-listed `Origin`. `worker/wrangler.jsonc`'s `ALLOWED_ORIGINS` already covers `eastcoin.vip`, `www.eastcoin.vip`, `eastcoins.pages.dev`, and the common local-dev ports (`localhost`/`127.0.0.1` on `4321` and `8788`). Add any other origin you actually serve EastCoin from to that comma-separated list before deploying.
