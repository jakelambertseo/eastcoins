# EastCoin Music Player v0.59.1

Built from GitHub `main` at commit:

`64a8495ed182bb1bdd4ca13c35ebf1f5a71c4c6d` — **Fix player loading regression**

## What this package adds

- `Music Player` in the existing right-side **View Controls** drawer.
- A 360px desktop music dock placed **between the live video and Twitch chat**.
- Real YouTube playback using the YouTube IFrame Player API.
- Pasted `youtube.com`, `music.youtube.com`, `youtu.be`, Shorts, Live and Embed links.
- Automatic next-song playback.
- Local persistent queue that works immediately with **no API key and no backend**.
- Browser autoplay-block handling with a visible **Join music** button.
- Nicknames / `Requested by` labels.
- Optional synchronized shared queue using the included Cloudflare Worker + Durable Object + WebSockets.
- Shared listener count and community skip voting when the Worker is enabled.
- `changelog.html` update to document the release.
- EastCoin version bump to **v0.59.1** on the main shell and MultiView footer.

## Important architecture choice

The existing `assets/eastcoins-persistent-shell.js` and `assets/eastcoins-persistent-shell.css` are **not replaced**. The music feature is isolated in its own files so the current Events/player loader, Twitch chat persistence, compact nav, browse drawer and View Controls logic stay intact.

## Install into your local EastCoin repo

From PowerShell, after extracting this ZIP:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-music-player.ps1 -RepoPath "C:\path\to\eastcoins"
```

At this point the Music Player already works in **Local** mode. You can test and deploy the static site before setting up the shared backend.

## Shared queue setup — no YouTube API key required

The optional Worker lives at:

`worker/eastcoin-music-room`

After the installer copies it into your EastCoin repo:

```powershell
cd C:\path\to\eastcoins\worker\eastcoin-music-room
npm install
npx wrangler login
npx wrangler deploy
```

Wrangler will print a URL similar to:

`https://eastcoin-music-room.<your-workers-subdomain>.workers.dev`

Configure EastCoin with that URL:

```powershell
powershell -ExecutionPolicy Bypass -File C:\path\to\EastCoin-Music-Player-v0.59.1\scripts\configure-music-worker.ps1 -RepoPath "C:\path\to\eastcoins" -WorkerUrl "https://eastcoin-music-room.<your-workers-subdomain>.workers.dev"
```

The browser automatically converts the URL to WebSocket form and connects to `/room/main`.

## Test the Worker

Open:

`https://eastcoin-music-room.<your-workers-subdomain>.workers.dev/health`

Expected JSON:

```json
{"ok":true,"service":"eastcoin-music-room"}
```

Then open EastCoin in two different browser windows/devices, open **View Controls → Music Player**, and request a YouTube link. Both clients should receive the same queue/current song state.

## Git commands

From the EastCoin repo root:

```powershell
git add index.html changelog.html multiview.html assets/eastcoins-music-player.css assets/eastcoins-music-player.js assets/eastcoins-music-config.js worker/eastcoin-music-room

git commit -m "Add shared Music Player and song requests"

git -c gc.auto=0 push
```

### Commit note

Adds the v0.59.1 shell-owned YouTube Music Player, pasted-link song requests, local queue fallback, optional Cloudflare Durable Object shared queue, listener/skip-vote synchronization, View Controls entry, and changelog/version updates without modifying the existing persistent-shell loader logic.


## v0.59.1 hotfix
- Music Player is now a floating overlay over the lower-right of the video area, immediately left of Twitch chat. It no longer consumes a full shell grid column.
- Local Up Next requests no longer restart the current YouTube video when added.
- Local automatic queue advancement is hardened against duplicate/stale YouTube ended/error callbacks.
- `index.html` uses `music2` asset versions to force browsers/CDNs to pick up the hotfix.
