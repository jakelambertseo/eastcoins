# EastCoin DLStreams no-key prototype

This is an isolated provider lab. It does NOT alter production Events, Live Player,
Streamed, PPV, MultiView, or the persistent shell.

## Files

- `dlstreams-test.html`
- `assets/eastcoins-dlstreams-test.css`
- `assets/eastcoins-dlstreams-test.js`
- `dlstreams-worker/`
  - `package.json`
  - `wrangler.jsonc`
  - `src/index.js`

## What it does

1. The Worker fetches `https://dlstreams.st/`.
2. It finds public schedule rows and `watch.php?id=<channel>` links.
3. It normalizes them into EastCoin-style events with channel IDs.
4. The test page lets you filter those events and load the documented
   `/stream/stream-<id>.php` iframe player.
5. "Try next player" rotates through the other folders DLStreams documents:
   stream, cast, watch, plus, casting, player.

## Local Worker test

From the repo:

cd dlstreams-worker
npm install
npm run dev

Then serve the EastCoin repo locally and open `dlstreams-test.html`.
The page defaults to `http://127.0.0.1:8787`.

## Cloudflare Worker deploy

cd dlstreams-worker
npm install
npx wrangler login
npx wrangler deploy

Wrangler prints a URL such as:

https://eastcoin-dlstreams-prototype.<your-subdomain>.workers.dev

Paste that URL into the prototype page and click Connect.

## Production decision

Do not merge this provider into `assets/eastcoins-streamed-api.js` until the
prototype proves:
- schedule fetch is reliable from Cloudflare,
- enough events parse correctly,
- channel IDs map correctly,
- DLStreams iframe pages work when embedded from EastCoin.

If an official API key arrives, replace the Worker scraper with the protected
schedule endpoint and keep the normalized frontend model.
