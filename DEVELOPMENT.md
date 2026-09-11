# Running EastCoin locally

EastCoin is a static site on Cloudflare Pages with Cloudflare Functions under
`functions/` for the API, a D1 database, and two separate Workers. This is
everything needed to get it running on your own machine.

Nothing here touches production. Local runs use a local copy of the database
and your own API keys.

---

## The short version

If you already have the keys and just want the commands:

```bash
# once
npx wrangler d1 migrations apply eastcoin-picks --local -c wrangler.picks-migrations.jsonc

# every time
npx wrangler pages dev . --d1 PICKS_DB=93a6155a-7e1e-4d92-a713-70f2550a40c0
```

Then open <http://localhost:8788>. The rest of this file explains the two
arguments, and what to put in `.env` so the pages that need a backend work.

**Use port 8788.** It is wrangler's default for Pages and it is on the music
Worker's origin allow-list. On another port the Green Room's WebSocket is
refused with `403 Origin not allowed`.

---

## 1. Prerequisites

- Node 18+ and `npx`. There is no `package.json` at the repo root; wrangler is
  pulled in on demand by `npx`.
- A Cloudflare account, only if you want to run against remote resources or
  deploy. Local development needs no Cloudflare login.

---

## 2. Environment variables

Create a `.env` file in the repository root. Wrangler 4 reads it automatically
and prints `Using secrets defined in .env` on startup — that line is the quickest
confirmation it found the file.

`.env*` is in `.gitignore`. Keep it that way; several of these are real credentials.

```ini
# --- Twitch login (section 3) ---
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_REDIRECT_URI=http://localhost:8788/api/picks/auth/twitch/callback

# --- Odds and scores (section 4) ---
ODDS_API_KEY=

# --- ZCoins wallet (section 5) ---
STREAMELEMENTS_JWT=
STREAMELEMENTS_CHANNEL_ID=

# --- Green Room (section 6) ---
MUSIC_AUTH_SECRET=any-string-as-long-as-both-sides-match
MUSIC_ROOM_URL=http://localhost:8787

# --- Optional (section 7) ---
TWITCH_CHAT_CHANNEL=zwades
```

> **`STREAMELEMENTS_JWT`, with the S.** The code reads `STREAMELEMENTS_JWT`
> (`functions/api/picks/_lib.js`). `STREAMELEMENT_JWT` or
> `STREAMELEMENT_JWT_TOKEN` are silently ignored, and every bet then fails with
> `WALLET_NOT_CONFIGURED`. This is an easy one to lose an hour to.

---

## 3. A Twitch application

Twitch is how the site knows who you are. Picks, the casino, the Green Room and
the Movies & TV shelves all sit behind it.

1. Go to <https://dev.twitch.tv/console/apps> and **Register Your Application**.
2. **Name**: anything unique to you — `eastcoin-local`, say. Twitch rejects
   names already taken by someone else.
3. **OAuth Redirect URLs**: add
   ```
   http://localhost:8788/api/picks/auth/twitch/callback
   ```
   Twitch allows plain `http://localhost` here specifically for local
   development. Add the production URL too if you plan to deploy:
   `https://eastcoin.vip/api/picks/auth/twitch/callback`.
4. **Category**: Website Integration.
5. **Client Type**: Confidential.
6. Create, then copy the **Client ID**, and **New Secret** for the secret.

Put both in `.env`, and set `TWITCH_REDIRECT_URI` to the exact same string you
registered — Twitch compares it character for character, and a trailing slash
or `127.0.0.1` instead of `localhost` is enough to fail the exchange.

The site asks for the `openid` scope and nothing else: no email, no chat, no
moderation, no broadcaster permissions.

Check it with <http://localhost:8788/api/picks/auth/twitch/config-health>.

Locally this endpoint always returns **503** with `status: "incomplete"`, even
when everything is right: it compares `TWITCH_REDIRECT_URI` against production's
`https://eastcoin.vip/...` and yours points at localhost. Ignore `ok` and read
the three `…Configured` booleans instead — all `true` means the variables are
set. `redirectUriMatches: false` is expected on a local run.

---

## 4. The Odds API key

Markets, prices and final scores all come from The Odds API. Without a key the
Picks catalog is empty and nothing settles.

1. Sign up at <https://the-odds-api.com/>. The free tier is enough to develop
   against; check their current quota when you sign up.
2. Copy the key into `ODDS_API_KEY`.

Be aware that requests cost credits. The schedule is cached for 30 minutes and a
price is only fetched when a game is due, so ordinary browsing is cheap, but
repeatedly hitting `/api/picks/settle` or the admin quote endpoint is not.
Production runs on a 20,000-credit-a-month plan; a free key has far less.

---

## 5. StreamElements — the ZCoins wallet

ZCoins are StreamElements loyalty points. The same JWT reads balances, moves
points when a bet locks or settles, and posts the bot's chat lines.

**The JWT**

1. Sign in at <https://streamelements.com/> with the account that owns the
   channel.
2. Open <https://streamelements.com/dashboard/account/channels>.
3. **Show secrets**, then copy the **JWT Token** (a long `eyJ…` string).

Treat it like a password: it can spend points and speak in chat.

**The channel ID**

This is an opaque StreamElements id, not the Twitch name. Look it up with a
public endpoint — no auth needed:

```bash
curl -s https://api.streamelements.com/kappa/v2/channels/zwades | python3 -m json.tool
```

The `_id` field is the value for `STREAMELEMENTS_CHANNEL_ID`. For zwades it is
`65107c296068cc894e4ac7b9`, which is also the built-in fallback, so you can
leave the variable unset if that is the channel you want.

**A warning worth reading twice.** There is no sandbox. A JWT for a real channel
moves real points in that channel's real economy, from a local dev server, with
no confirmation step. Either use a channel you own, or leave
`STREAMELEMENTS_JWT` unset — everything except placing and settling bets works
without it, and bets fail cleanly with `WALLET_NOT_CONFIGURED` rather than doing
something surprising.

Even with a valid JWT, wagering is restricted to an allow-list in
`functions/api/picks/_lib.js`. Set `PICKS_OPEN_WAGERING=1` to open it to any
logged-in account.

Check it with <http://localhost:8788/api/picks/wallet-health>. It answers `403
NOT_ADMIN` unless you are logged in as the owner, which is itself a useful
signal that sessions are working.

---

## 6. The database

The API is D1. Almost every endpoint starts with `if (!db) return 503`, so
without the binding the whole API returns **503 Service Unavailable** and the
site looks broken in a way that gives no hint why.

There is no `wrangler.toml` for the Pages project — `wrangler.picks-migrations.jsonc`
is a non-default filename and `pages dev` does not load it — so the binding is
passed on the command line.

**Create the local schema, once:**

```bash
npx wrangler d1 migrations apply eastcoin-picks --local -c wrangler.picks-migrations.jsonc
```

**Then always start the site with the binding:**

```bash
npx wrangler pages dev . --d1 PICKS_DB=93a6155a-7e1e-4d92-a713-70f2550a40c0
```

> **Pass the UUID, not the name.** `--d1 PICKS_DB=eastcoin-picks` is accepted and
> looks fine, but miniflare names the local SQLite file after whatever string you
> give it, while `d1 migrations apply` uses the UUID from
> `wrangler.picks-migrations.jsonc`. You end up with two local databases, and the
> 503s turn into `500 no such table: users`. Both files are visible under
> `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` if you ever need to confirm
> which one you are talking to.

The local database starts empty. Casino tables are created on first use;
markets, users and picks appear as you use the site.

Check it with <http://localhost:8788/api/picks/db-health>.

To reset: delete `.wrangler/state/v3/d1/` and re-run the migration.

---

## 7. The Green Room Worker

The music room is a separate Worker with a Durable Object in `worker/`. The
browser talks to it directly over a WebSocket; it is not proxied through Pages.

```bash
cd worker
npx wrangler dev          # http://localhost:8787
```

Point the site at it with `MUSIC_ROOM_URL=http://localhost:8787` in the root
`.env`. That is all — the browser reads it from `/api/config`, so no source file
needs editing. Unset, the site uses the production Worker.

Set **`MUSIC_AUTH_SECRET` to the same value in both `.env` and `worker/.env`.**
Pages signs a short-lived token with it and the Worker verifies the signature;
if they disagree, or either is missing, you can listen but every song request is
refused as logged-out.

`worker/.env` also takes:

| Variable | What it does |
|---|---|
| `MUSIC_AUTH_SECRET` | must equal the root `.env` value |
| `YOUTUBE_API_KEY` | song search and titles; unset gives `SEARCH_NOT_CONFIGURED` |

A YouTube Data API v3 key comes from
<https://console.cloud.google.com/apis/credentials> — enable "YouTube Data API v3"
on the project first.

> **Your local room listens to real chat.** `worker/wrangler.jsonc` sets
> `STREAMELEMENTS_CHANNEL_ID` and `TWITCH_CHAT_CHANNEL` as plain vars, so a local
> room pulls in live `!sr` requests from zwades' queue and obeys `!skip` typed in
> the real chat. Blank both in `worker/wrangler.jsonc` if you would rather it sat
> quiet.

Check it with <http://localhost:8787/health>.

---

## 8. Optional variables

None of these are needed to develop; each disables one feature when unset.

| Variable | Without it |
|---|---|
| `TWITCH_CHAT_CHANNEL` | chat rail embeds `zwades` |
| `MUSIC_ROOM_URL` | the Green Room uses the production Worker |
| `MUSIC_ROOM_NAME` | room `main` |
| `TMDB_API_KEY` | Movies & TV shelves return 503 (v4 `eyJ…` token or a v3 key; `TMDB_READ_TOKEN` also works) |
| `DISCORD_LEDGER_WEBHOOK` | no Discord mirror of the ledger — a no-op, not an error |
| `PICKS_OPEN_WAGERING` | betting stays limited to the allow-list; `1` opens it |
| `PICKS_CRON_KEY` | `/api/picks/settle`, `/api/admin/backup` and `/api/admin/recap` reject the cron caller |
| `PICKS_BOT_KEY` | the chat-command endpoints under `functions/api/picks/bot/` reject callers |
| `BACKUPS` | nightly backup returns `NO_BUCKET`; needs an R2 binding, not a variable |

`TWITCH_CHAT_CHANNEL` and `MUSIC_ROOM_URL` are served to the browser by
`/api/config` (`functions/api/_config.js`), which is where their defaults live.
Everything else is server-side only.

---

## 9. Checking your setup

With the site running, these say what is wired and what is not:

| URL | Answers | Healthy locally |
|---|---|---|
| `/api/config` | which chat channel and Green Room the browser will use | 200 |
| `/api/picks/db-health` | is D1 bound and queryable | 200 |
| `/api/picks/schema-health` | are the migrations applied | 200, `tables.missing: []` |
| `/api/picks/auth/twitch/config-health` | are the Twitch variables set | 503 — see section 3 |
| `/api/picks/auth/session-health` | is your login session valid | 200 |
| `/api/picks/wallet-health` | is StreamElements reachable | 403 unless owner |
| `http://localhost:8787/health` | is the music Worker up | 200 |

A quick sweep (bash/zsh — in fish, `end` replaces `done`):

```bash
for p in api/config api/picks/db-health api/picks/schema-health \
         api/picks/auth/twitch/config-health api/casino/home api/presence; do
  printf '%-40s %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:8788/$p")"
done
```

---

## 10. When something is wrong

**Every API request returns 503.** The D1 binding is missing — you started
`pages dev` without `--d1`. See section 6.

**`500 no such table: users`.** The binding is there but points at a different
local database than the migration did. You passed the name instead of the UUID.

**Bets fail with `WALLET_NOT_CONFIGURED`.** `STREAMELEMENTS_JWT` is unset or
misspelled (the S), or `STREAMELEMENTS_CHANNEL_ID` is missing.

**Twitch login bounces or errors.** `TWITCH_REDIRECT_URI` does not exactly match
a URL registered on the Twitch app. Compare them character for character.

**The Green Room says "Room not configured".** `/api/config` did not answer, or
`MUSIC_ROOM_URL` is malformed and fell back. Load `/api/config` directly.

**`403 Origin not allowed` from the music Worker.** The site is on a port that is
not on the allow-list. Use 8788, or add your origin to `ALLOWED_ORIGINS` in
`worker/wrangler.jsonc`.

**Song requests are refused as logged-out although you are logged in.**
`MUSIC_AUTH_SECRET` differs between `.env` and `worker/.env`, or is missing from
one of them.

---

## 11. Deploying

The site deploys from `main` to Cloudflare Pages. Production variables are set
on the Pages project, not in `.env`:

```bash
npx wrangler pages secret put ODDS_API_KEY
```

The two Workers deploy separately, each from its own directory:

```bash
cd worker            && npx wrangler deploy   # Green Room
cd worker-picks-cron && npx wrangler deploy   # settlement, backup, recap
```

The cron Worker calls back into the site and needs `PICKS_CRON_KEY` set as a
secret on the Worker *and* as a variable on the Pages project, with the same
value:

```bash
cd worker-picks-cron && npx wrangler secret put PICKS_CRON_KEY
```

Read `CLAUDE.md` before changing anything — it records which invariants are
load-bearing and why.
