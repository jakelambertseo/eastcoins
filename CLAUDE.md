# CLAUDE.md — EastCoin Current Production Handoff

> **Purpose:** This file is the authoritative coding-agent handoff for the current EastCoin production site. Read it before making changes.
>
> **Repository:** `jakelambertseo/eastcoins`
>
> **Production domain:** `https://eastcoin.vip`
>
> **Production branch:** `main`
>
> **Baseline commit inspected for this document:** `55b2dbe8c7e394fe61d8e398c415638447dbe516`
>
> **Baseline commit message:** `Hide legacy player while MultiView loads`
>
> **Baseline commit date:** 2026-09-03
>
> **Important:** Current source code on `main` outranks old README iteration files, old patch/install scripts, old `/v2/` copies, mockups, and historical V1 pages.

---

## 1. What EastCoin Is Right Now

EastCoin is a static HTML/CSS/JavaScript sports-community site deployed on Cloudflare Pages with Cloudflare Functions for server-side APIs.

The production experience is now launched at the **root domain**:

```text
https://eastcoin.vip/
```

Do **not** treat `/v2/` as the public production route. The `/v2/` directory still contains many of the current shell assets, but the public shell is `index.html` at the repository root.

The core current experiences covered by this handoff are:

1. **Homepage / Events shell** — `/`
2. **Live Player** — rendered inside the root shell via event/watch deep links
3. **MultiView** — `/?view=multiview`
4. **Persistent embedded Twitch chat** — owned by the root shell
5. **Picks** — `/?view=picks`

Other pages and prototypes exist in the repository, but do not assume they are part of the current production baseline unless the user explicitly asks about them.

---

# 2. Non-Negotiable Product / UX Invariants

These are the most important rules to preserve.

## 2.1 Root-domain production only

Public links must use the root site:

```text
/
?view=multiview
?view=picks
?event=...
?watch=...
```

Do not generate new public links under:

```text
/v2/
```

Internal asset paths may still live under `/v2/assets/...`.

---

## 2.2 Do not resurrect V1 chrome inside the V2 shell

A recurring historical bug has been old sidebars/nav/chat/toolbars briefly appearing inside embedded child pages.

The current shell intentionally embeds pages such as:

```text
/multiview.html?ecV2Embedded=1
/picks.html?ecV2Embedded=1
```

The outer shell owns the main navigation and persistent Twitch chat.

When a child page is embedded:

- child sidebars should be hidden;
- child duplicate chat should be hidden;
- child duplicate global navigation should be hidden;
- only the child page's main working surface should remain.

Do not add old left-side navigation back into the embedded MultiView or Picks experience.

---

## 2.3 Persistent Twitch chat must remain persistent

This is a critical V2 invariant.

The root page contains:

```html
<iframe id="persistentTwitchChat" ...>
```

The router intentionally **never replaces, reloads, removes, or reassigns** that iframe when navigating between Events, MultiView, Picks, Games, etc.

Once Twitch chat has mounted, changing EastCoin routes must not destroy it.

Hiding chat should be a CSS/layout visibility operation, not an iframe reload.

---

## 2.4 Current design is authoritative

The current production visual system is:

- extremely dark / near-black;
- deep burgundy / red;
- gold accents;
- compact utilitarian sports UI;
- current root header/nav;
- current event-card language;
- current player controls;
- current right-side Twitch chat.

Recent "ultra minimal" homepage mockups were exploratory concepts only and are **not** the production design baseline.

Do not redesign production into the experimental minimal layout unless explicitly requested.

---

## 2.5 Server names are intentionally generic

Visible stream choices should be:

```text
Server 1
Server 2
Server 3
...
```

Do not expose old provider/source/language labels such as:

```text
Alpha
Delta
English
English - MLB TV
```

unless explicitly requested for debugging/admin use.

---

## 2.6 New meaningful features must update the changelog

For every new feature or meaningful site update:

```text
changelog.html
```

must be updated as part of the same change.

---

## 2.7 User's preferred delivery workflow

For code-update requests:

- make the code changes directly;
- provide complete replacement files;
- preferably package changed files in a downloadable ZIP;
- do not give patch-only workflows unless explicitly requested;
- do not require `.cmd` installers;
- do not make Node installer scripts the default;
- give the full `git add / commit / push` commands;
- include a short commit note.

The user prefers replacing raw files and pushing with Git.

---

# 3. High-Level Architecture

Current production architecture:

```text
index.html
│
├── Root EastCoin navigation
├── Events homepage
├── Current V2 Live Player
├── Quick Bet modal
├── Settings
├── Persistent Twitch chat
│
└── Workspace iframe
    ├── /multiview.html?ecV2Embedded=1
    ├── /picks.html?ecV2Embedded=1
    ├── /games.html?ecV2Embedded=1
    ├── /favorites.html?ecV2Embedded=1
    └── other routed child experiences
```

Key router:

```text
v2/assets/js/router.js
```

The outer `index.html` stays mounted while routed workspace pages load inside:

```html
<iframe id="workspaceFrame">
```

This is how the site preserves global shell state, especially Twitch chat.

---

# 4. Homepage / Events — Current State

## 4.1 Public route

```text
/
```

Main file:

```text
index.html
```

Primary supporting assets include:

```text
v2/assets/css/tokens.css
v2/assets/css/shell.css
v2/assets/css/home.css
v2/assets/css/overlays.css
v2/assets/css/workspace.css
v2/assets/css/responsive.css
v2/assets/css/watch-view.css
v2/assets/css/settings.css
v2/assets/css/chat-cleanup.css
v2/assets/css/event-cards-v1.css
v2/assets/css/card-scores.css
v2/assets/css/quick-bet.css
v2/assets/css/launch.css

v2/assets/js/core.js
v2/assets/js/events.js
v2/assets/js/player.js
v2/assets/js/card-odds.js
v2/assets/js/card-scores.js
v2/assets/js/integrations.js
v2/assets/js/router.js
v2/assets/js/quick-bet.js
v2/assets/js/app.js
v2/assets/js/mlb-gameday.js
v2/assets/js/multiview-handoff.js
```

Do not assume old standalone `events.html` owns production Events. The root `index.html` is the current shell/homepage.

---

## 4.2 Current top navigation

The static root HTML contains:

```text
EastCoin
Events
MultiView
Picks
Search
ZCoins
Settings
Login/Profile
```

At runtime, `v2/assets/js/app.js` converts the old sports sub-navigation into a top-level:

```text
Categories ▾
```

dropdown and removes the legacy sport bar from the live layout.

Current category choices include:

```text
All Events
Live Events
Football
Baseball
UFC / Fighting
Soccer
Basketball
Hockey
Tennis
Other
```

Therefore:

- do not rebuild a permanent sports sub-nav under the main header;
- categories currently live in the main navigation as a dropdown.

---

## 4.3 Homepage Events timeline

The main Events section currently contains:

```text
EVENTS
Your sports timeline
```

with status filtering for:

```text
All
Live
Upcoming
Saved
```

and:

```text
Sort: Recommended
```

The Events grid is the primary homepage content.

The root search accepts:

```text
games
teams
URLs
```

The site also supports current sport/category filtering through the Categories dropdown.

---

## 4.4 Homepage lower modules

Below the Events grid, the current root still includes:

### Recent

```text
Continue watching
```

### Picks

```text
EastCoin Picks
```

### Quick Launch

Current quick-launch concepts include:

```text
MultiView
Mini Games
Open Chat
Other Streams
```

Do not remove these unless explicitly asked. Recent experimental "nav + picker + chat only" concepts are not production.

---

## 4.5 Initial Events loading / performance behavior

Current `v2/assets/js/app.js` deliberately limits the first Events load.

Initial paint only needs:

```text
Live + Today
```

The larger extended/seven-day catalog is deferred until functionality such as:

```text
Search
Upcoming
Saved
```

actually needs it.

Preserve this behavior. Do not make the homepage fetch the full extended event catalog on every initial load unless there is a strong reason.

The empty Events grid reserves loading space to reduce layout shift.

---

## 4.6 Homepage settings

Current Settings include:

### Layout

```text
Close Navigation
Close/Open Twitch Chat
```

Closing Twitch chat must not unload its iframe after it is mounted.

### Events

```text
Show Event Artwork
Compact Event Cards
Starting Soon First
```

Settings are stored locally on the device.

---

# 5. Root V2 Routing / Workspace

File:

```text
v2/assets/js/router.js
```

Current routes include:

```js
events:     /
multiview:  /multiview.html?ecV2Embedded=1
picks:      /picks.html?ecV2Embedded=1
games:      /games.html?ecV2Embedded=1
streams:    /favorites.html?ecV2Embedded=1
sicko:      /picks-kalshi-test.html?ecV2Embedded=1#prop-of-week
```

Public shell URLs are normalized to:

```text
/
?view=multiview
?view=picks
?view=games
?view=streams
```

The child `src` URLs are implementation details.

---

## 5.1 Embedded cleanup

After a workspace child loads, the router injects embedded cleanup.

It hides child elements such as:

```text
.sidebar
.chat
.ec-events-v2-nav
.ec-events-v2-chat
.ec-events-v2-chat-resizer
.ec-events-v2-mobile-menu
.ec-events-v2-nav-cycle
```

and collapses the child layout to one main content column.

For Picks it also applies:

```text
ec-v2-picks-embedded
```

For MultiView it applies:

```text
ec-v2-embedded
```

Do not remove this mechanism casually. It prevents duplicate V1/standalone chrome from appearing inside the current shell.

---

## 5.2 Critical router invariant

The router explicitly does not touch:

```text
#persistentTwitchChat
```

Route changes only change:

```text
main homepage visibility
workspace visibility
workspace iframe src
browser history
active nav
```

The outer page remains mounted.

---

# 6. Current Live Player

There are **two different player concepts in the repository**. Do not confuse them.

## 6.1 Production V2 player

The main production player is part of:

```text
index.html
```

and is controlled by:

```text
v2/assets/js/player.js
v2/assets/css/watch-view.css
v2/assets/js/mlb-gameday.js
```

This is what a user sees when they open an event from the current Events shell.

---

## 6.2 `player.html` is not the main current shell player

The repository also contains:

```text
player.html
```

This is an older/standalone player architecture that remains important for compatibility and MultiView.

MultiView panels intentionally create same-origin child player URLs such as:

```text
/player.html?shell=1&multiview=1&event=...
```

or:

```text
/player.html?shell=1&multiview=1&watch=...
```

Do not rewrite the root V2 player by editing `player.html` alone.

If the user reports a bug in the normal root event player, first inspect:

```text
index.html
v2/assets/js/player.js
v2/assets/css/watch-view.css
```

If the bug occurs inside a MultiView tile, inspect:

```text
player.html
assets/eastcoins-multiview.js
assets/eastcoins-multiview-loading.js
assets/eastcoins-multiview-servers.js
```

---

## 6.3 V2 player deep links

Current event links use the root shell.

For an EastCoin event:

```text
/?event=<event-id>
```

Optional stream preference can be included:

```text
/?event=<event-id>&source=<source>&stream=<stream-number>
```

For a custom embed/player URL:

```text
/?watch=<encoded-url>
```

When watching, the browser URL is synchronized without leaving the root shell.

---

## 6.4 Current player stream behavior

When a user opens an event:

1. `v2/assets/js/player.js` sets the active match.
2. Player UI is shown immediately.
3. EastCoin requests playable streams from the event API.
4. Only streams with an `embedUrl` are retained.
5. Stream buttons are rendered.
6. The preferred source/stream from the deep link is selected when possible.
7. The iframe loads the chosen provider embed.

Visible server names are standardized:

```text
Server 1
Server 2
Server 3
...
```

The player shows the number of available servers.

---

## 6.5 Current V2 player controls

Current player controls include:

```text
Favorite
+ MultiView
Gameday        (MLB only / when eligible)
Copy Link
Open Source
Bet            (only when eligible)
Collapse
```

There is also server switching.

### Collapse

Control collapse state is saved to:

```text
eastcoinV2WatchControlsCollapsed
```

Do not remove persisted collapse behavior.

### Copy Link

Copies the root EastCoin event/watch deep link.

### Open Source

Opens the active embed source externally in a new tab.

### + MultiView

Sends the active match + selected stream into the V2 MultiView handoff.

### Gameday

MLB games can expose:

```text
⚾ Gameday
```

via:

```text
v2/assets/js/mlb-gameday.js
```

### Bet

Bet is hidden unless all eligibility checks pass.

Current Quick Bet eligibility requires:

- a real EastCoin event, not `custom:...`;
- event has not started;
- event is not live;
- supported sportsbook sport key;
- Odds API-backed market;
- valid away and home American moneylines.

Current supported Quick Bet sport-key families include football, baseball and MMA, with American-football odds further restricted to NFL by current app logic.

---

# 7. MultiView — Current State

## 7.1 Public route

```text
/?view=multiview
```

The shell loads:

```text
/multiview.html?ecV2Embedded=1
```

into the root workspace.

Main files:

```text
multiview.html
assets/eastcoins-multiview.css
assets/eastcoins-multiview.js
assets/eastcoins-multiview-share.js
assets/eastcoins-multiview-loading.js
assets/eastcoins-multiview-servers.js
assets/eastcoins-multiview-servers.css
v2/assets/js/multiview-handoff.js
```

Provider/event data helpers include:

```text
assets/eastcoins-ppv-api.js
assets/eastcoins-streamed-api.js
assets/eastcoins-event-visibility.js
```

---

## 7.2 Embedded versus standalone MultiView

`multiview.html` still contains its own standalone navigation and Twitch chat drawer.

That is intentional for standalone compatibility.

When loaded with:

```text
?ecV2Embedded=1
```

current CSS hides:

```text
.ec-events-v2-nav
.mv-nav-toggle
.mv-mobile-overlay
#mvChatButton
.mv-chat-drawer
```

The outer V2 navigation + outer persistent Twitch chat should be the only global chrome visible.

If a user reports "old left nav is showing in MultiView", treat that as a regression.

---

## 7.3 Layouts

Current valid MultiView layouts:

```text
2 panels
3 panels
4 panels
```

Default:

```text
4 panels
```

Default split percentages:

```text
2: 50 / 50
3: 65 / 35-ish main column behavior
4: 50 / 50
```

Split state is normalized and persisted.

MultiView state storage key:

```text
eastcoinMultiviewV1
```

The storage-key name is historical; do not interpret the `V1` suffix as meaning the current page is V1.

---

## 7.4 Panel controls

Each panel currently supports:

```text
Solo
Focus
Servers
Replace
Remove
```

The server selector is dynamically added when a child event player has real server buttons available.

The global MultiView toolbar supports:

```text
2 / 3 / 4 layout selector
Clear all
Hide controls / Show controls
Share
```

The standalone page also contains a Chat control, but that control/drawer is hidden in the embedded V2 workspace.

Controls hidden state is saved to:

```text
eastcoinMultiviewControlsHidden
```

---

## 7.5 Adding a stream

An empty panel offers:

```text
Choose Event
Paste URL
```

Event picker modes:

```text
Live
Today
```

There is event search.

Manual URL handling accepts HTTP/HTTPS, but production EastCoin requires HTTPS unless running locally.

Manual URLs are treated similarly to URLs the Live Player would accept.

Sites that refuse iframe embedding can still fail; EastCoin cannot override a provider's frame policy.

---

## 7.6 How a MultiView tile works

For each populated panel, `assets/eastcoins-multiview.js` creates a same-origin `player.html` child.

Event:

```text
player.html?shell=1&multiview=1&event=<id>
```

Manual URL:

```text
player.html?shell=1&multiview=1&watch=<url>
```

This is an important architecture detail.

The outer V2 shell contains MultiView.
MultiView contains `player.html`.
`player.html` then contains the real provider iframe.

---

## 7.7 Legacy player flash is intentionally masked

A known problem was that the old `player.html` "Embed a video URL" UI briefly appeared while a MultiView stream was loading.

Current fix:

```text
assets/eastcoins-multiview-loading.js
```

It overlays the tile with:

```text
Opening stream…
Connecting to EastCoin player
```

until the nested child player exposes:

```text
#activeFrame
```

If loading takes longer:

```text
Still loading stream…
This provider is taking longer than usual.
```

Do not remove this mask unless `player.html` is fully replaced and the old first-paint problem no longer exists.

---

## 7.8 Per-panel server switching

Current implementation:

```text
assets/eastcoins-multiview-servers.js
```

Important behavior:

- parent MultiView does **not** refetch the event catalog to switch servers;
- `player.html` and MultiView are same-origin;
- MultiView reads the existing hidden child server buttons;
- choosing `Server N` activates the corresponding real child server button;
- selection is saved by panel slot + event.

Storage key:

```text
eastcoinMultiviewServerSelectionsV48
```

Do not create a second independent stream-fetch implementation for the parent MultiView unless deliberately redesigning the architecture.

---

## 7.9 MultiView audio limitation

Current UI explicitly tells users that audio is controlled inside each embedded provider player.

Because the real provider frames are cross-origin, EastCoin cannot reliably force-mute arbitrary provider players from the parent page.

Do not claim site JavaScript can universally mute cross-origin embeds.

---

## 7.10 MultiView sharing

Current share module:

```text
assets/eastcoins-multiview-share.js?v=share2
```

Current compact share parameter:

```text
m
```

Legacy parameter still recognized:

```text
mv
```

Canonical V2 share URL should resolve through the root shell:

```text
https://eastcoin.vip/?view=multiview&m=<token>
```

Do not generate new canonical shares as:

```text
/multiview.html?m=...
```

Old standalone shared links are retained for backward compatibility and redirect into the V2 shell.

The share token encodes:

- layout count;
- panel split values;
- event IDs or manual URLs.

A shared layout is treated as transient and should not permanently overwrite the viewer's own saved MultiView layout.

---

## 7.11 Solo behavior

When a MultiView panel is opened Solo from embedded V2 MultiView, a same-origin message bridges back to the root shell.

The router handles:

```text
ec-v2-multiview-solo
```

and opens either:

- the matching EastCoin event in the root V2 player; or
- the custom URL in the root V2 player.

Do not navigate the entire browser to an old standalone player for V2 Solo.

---

# 8. Persistent Embedded Twitch Chat

## 8.1 Owner

The root shell owns the production Twitch chat:

```text
index.html
#chat
#persistentTwitchChat
```

Current Twitch channel:

```text
zwades
```

Current embed parents include:

```text
eastcoins.pages.dev
eastcoin.vip
www.eastcoin.vip
localhost
127.0.0.1
```

The child workspace should not own the persistent global chat.

---

## 8.2 Initial deferred loading

For performance, the iframe begins as:

```text
about:blank
```

and the real Twitch embed URL is stored in:

```text
data-src
```

Current startup behavior in:

```text
v2/assets/js/app.js
```

defers mounting Twitch until the user first interacts through events such as:

```text
pointerdown
keydown
touchstart
wheel
```

This avoids paying Twitch's full script/request/DOM cost before the user interacts with EastCoin.

---

## 8.3 Direct watch exception

If the user enters EastCoin through a direct watch route such as:

```text
?event=...
?watch=...
```

and chat is configured visible, chat can be mounted immediately/idle-immediately.

---

## 8.4 Persistence after mounting

Once mounted:

- route changes must not reload it;
- hiding it must not unload it;
- opening it again should reuse the same iframe;
- MultiView/Picks embedded child chat should stay hidden.

This behavior is intentionally preserved by:

```text
v2/assets/js/router.js
v2/assets/js/app.js
v2/assets/js/player.js
```

---

## 8.5 Settings integration

The root Settings modal controls chat visibility.

The wording explicitly treats the operation as:

```text
Close Twitch Chat
```

and describes hiding chat without unloading/refreshing the iframe.

Preserve this expectation.

---

# 9. Picks — Current State

## 9.1 Public route

```text
/?view=picks
```

The root workspace loads:

```text
/picks.html?ecV2Embedded=1
```

Core files:

```text
picks.html
assets/eastcoins-picks.css
assets/eastcoins-picks-api.js
assets/eastcoins-picks-preview.js
assets/eastcoins-moneyline.js
assets/eastcoins-moneyline-runtime.js
assets/eastcoins-picks-football-v50.js
assets/eastcoins-picks.js
```

Cloudflare Functions live under:

```text
functions/api/picks/
```

Important endpoints/files include:

```text
bootstrap.js
catalog.js
wagers.js
auth/
admin/
markets/
health.js
db-health.js
schema-health.js
```

---

## 9.2 Embedded Picks must not show its old standalone sidebar

`picks.html` still contains a standalone sidebar and standalone chat for direct-page compatibility.

When loaded with:

```text
ecV2Embedded=1
```

the document applies:

```text
ec-v2-picks-embedded
```

from the head before first paint.

`assets/eastcoins-picks.css` hides standalone chrome immediately so the user does not see the old left nav flash before router cleanup.

The root shell navigation and root persistent Twitch chat remain visible outside the workspace.

If the old Picks sidebar appears briefly in embedded mode, treat that as a bug.

---

## 9.3 Main Picks UI

Current Picks page includes:

### Top leaders

```text
Top Picks
Season profit leaders
```

### Summary strip

```text
ZCoins Wallet
2026 Picks Profit
Record
Picks Rank
```

### Views

```text
Markets
My Picks
Leaderboard
History
Community Ledger
```

The Community Ledger is intended for public Picks activity/transparency, not private wallet balances.

---

## 9.4 Current market sports

Current server catalog sports:

```text
NFL
MLB
UFC / MMA
```

Keys:

```text
americanfootball_nfl
baseball_mlb
mma_mixed_martial_arts
```

College football is intentionally excluded from Picks.

NCAAF may still be watchable elsewhere on EastCoin, but it is not eligible for Picks/Quick Bet.

---

## 9.5 Current market volume limits

`functions/api/picks/catalog.js` currently sets:

```text
MAX_MARKETS_PER_SPORT_PER_DAY = 3
```

Current market day timezone:

```text
America/Chicago
```

This limit exists to control Odds API usage.

Do not silently increase it without explicit approval.

---

## 9.6 Market windows

Current frontend wrapper behavior:

### Football

NFL only.

Upcoming NFL markets can remain visible within the server catalog's current maximum horizon:

```text
14 days
```

### MLB / UFC / MMA

Current wrapper restricts these to:

```text
today + tomorrow
```

The UI's market-window note changes according to the selected sport.

---

## 9.7 Moneyline model

EastCoin no longer uses the retired community-pool payout algorithm.

Payouts are based on sportsbook-style American moneylines.

Current catalog logic uses The Odds API `h2h` markets and constructs a consensus from bookmaker prices.

The payout shown on the ticket is the displayed consensus moneyline.

Examples reflected by current rules:

### +150

10 ZCoin wager:

```text
win:  25 returned total = +15 profit
lose: 0 returned = -10
void: 10 refunded
```

### -200

10 ZCoin wager:

```text
win:  15 returned total = +5 profit
lose: 0 returned = -10
void: 10 refunded
```

A losing pick must never display a positive payout.

The Quick Bet UI explicitly shows:

```text
If Pick Wins
If Pick Loses
Void / No Action
```

Do not reintroduce:

```text
poolSnapshot()
sideMultiplier()
community-pool multiplier
community action sets payout
```

into current Picks or Quick Bet calculations.

---

## 9.8 Wager limits

Current Picks rules display:

```text
Minimum: 1 ZCoin
Maximum: lower of 15% of available wallet or 50 ZCoins
```

One locked side per game.

The user cannot intentionally pick both sides of the same game.

---

## 9.9 Current real-wager safety state

This is important.

The current Cloudflare endpoint:

```text
functions/api/picks/wagers.js
```

still refuses real wager creation.

POST currently responds with:

```text
WAGERING_NOT_READY
```

and a 503 message indicating real ZCoin wagering is disabled until the required backend integrations are ready.

Therefore:

- do not assume a successful-looking frontend preview means real ZCoins are being debited;
- do not remove the backend safety lock without explicit instruction;
- do not claim real wagering is active just because Twitch auth or wallet UI is present.

---

## 9.10 Current temporary Betting Paused banner

`picks.html` currently contains a deliberately conspicuous red animated warning on:

1. the main Picks page;
2. the Lock Pick / ticket modal.

Current copy:

```text
Your streamer Zwades is disallowing us from placing bets at the moment.
Ask him kindly to allow us to have fun in chat.
```

It uses a red pulse/glow and respects `prefers-reduced-motion`.

This is current production source at the baseline commit.

Do not remove it unless explicitly requested.

---

# 10. Picks Twitch Authentication

## 10.1 Identity model

Twitch is the current Picks identity mechanism.

The Picks auth UI explains:

- Twitch identity is used for Picks;
- StreamElements ZCoins wallet is intended to connect to that identity;
- EastCoin never receives the user's Twitch password.

---

## 10.2 Firefox-specific embedded OAuth solution

Do not iframe Twitch OAuth inside the embedded Picks workspace.

Firefox/Twitch can reject authentication pages inside iframes.

Current embedded Picks flow opens Twitch authentication in a popup.

Important identifiers:

```text
popup name: eastcoinTwitchAuth
auth completion page: /auth-complete.html?source=picks
BroadcastChannel: eastcoin-picks-auth
```

Current fallback session polling:

```text
/api/picks/bootstrap
```

Polling interval:

```text
1250 ms
```

The code verifies:

```text
payload.ok
payload.session.authenticated
```

before considering login complete.

---

## 10.3 Why BroadcastChannel exists

During cross-origin OAuth through Twitch, Firefox may sever or invalidate assumptions around `window.opener`.

Current flow therefore uses:

```text
BroadcastChannel
```

as the primary same-origin completion signal, while retaining `postMessage` as an optional secondary path.

It also polls the same-origin Picks bootstrap endpoint so successful auth can still be detected even if opener messaging fails.

When authentication succeeds, the outer EastCoin shell reloads so:

```text
top-right profile
Picks session
wallet identity
```

update together.

Do not regress embedded Picks auth back to direct iframe navigation to Twitch.

---

# 11. Quick Bet

Quick Bet is part of the root shell, not a separate page.

Main files:

```text
index.html
v2/assets/js/quick-bet.js
v2/assets/css/quick-bet.css
assets/eastcoins-moneyline.js
assets/eastcoins-moneyline-runtime.js
```

Quick Bet can be opened from eligible event cards/player controls.

Current intended meaning:

```text
moneyline displayed = payout price if that side wins
```

It does **not** mean both outcomes pay.

The ticket calculates:

```text
wager
moneyline
profit
total return
loss if pick loses
refund if void/no action
```

This is a sportsbook-style moneyline preview, not the old community pool.

---

# 12. Event / Picks Odds API Constraints

Current Picks catalog API uses:

```text
The Odds API
```

Current server catalog settings include:

```text
CACHE_TTL_SECONDS = 30 * 60
MAX_HORIZON_MS = 14 days
MAX_GAMES = 140
MAX_MARKETS_PER_SPORT_PER_DAY = 3
MARKET_DAY_TIME_ZONE = America/Chicago
```

Current sports:

```text
NFL
MLB
UFC/MMA
```

These limits are intentional because API usage became high during development.

Do not expand market coverage or polling frequency casually.

---

# 13. Current Data / Provider Concepts

The root page preconnects to current stream/provider infrastructure including:

```text
streamed.st
api.ppv.st
Twitch
7TV CDN
```

MultiView explicitly loads:

```text
eastcoins-ppv-api.js
eastcoins-streamed-api.js
eastcoins-event-visibility.js
```

The player asks the current EastCoin API abstraction for playable streams instead of hardcoding one provider.

Preserve provider abstraction where possible.

---

# 14. Current Search Behavior

The root search is intended to accept:

```text
games
teams
URLs
```

Opening a custom URL sends it through the V2 player.

When a player/event is currently open, top-level navigation/sport changes should close the player rather than leaving a hidden stream iframe playing behind another view.

The player code explicitly watches for navigation/sport clicks and closes the active watch view.

---

# 15. MLB Gameday

MLB Gameday is currently part of the root V2 player.

Relevant:

```text
#watchGameday
v2/assets/js/mlb-gameday.js
assets/eastcoins-mlb-gameday.js
assets/eastcoins-mlb-gameday.css
```

The Gameday button is hidden unless the active event is eligible.

Do not make Gameday universally visible for non-MLB events.

---

# 16. Current Noindex / Private-Site State

Current core pages contain restrictive robots metadata such as:

```text
noindex
nofollow
noarchive
nosnippet
noimageindex
```

This includes root and major child experiences.

Do not assume EastCoin is currently configured as an SEO-indexable public product.

Recent discussions about redesigning EastCoin for a general internet audience were conceptual mockups, not current production implementation.

---

# 17. Concepts Discussed but NOT Current Production

As of the baseline commit in this document, the following have been discussed/mocked up but should **not** be treated as existing production features unless current source later proves otherwise:

```text
Dedicated /redzone experience
Sitewide live-score ticker
Daily multi-sport Guess the Player game
Trusted-contributor stream submissions
Community watch-room creation backend
Public-audience homepage redesign
Ultra-minimal homepage redesign
Public profiles / achievements
Public Kanban roadmap
```

Do not tell the user these exist merely because mockup HTML files were created in chat.

If implementing one later, integrate it into the current EastCoin design and architecture unless the user explicitly requests a redesign.

---

# 18. Regression Checklist Before Shipping

For any change touching the five core areas in this file, verify all of the following.

## Homepage

- `/` loads Events.
- Categories is in the main nav.
- old sport sub-nav is not visible.
- search still works.
- Events still load.
- initial page does not force unnecessary seven-day catalog fetch.
- Quick Bet still opens for eligible events.
- settings still work.

## Player

- event opens inside the current root shell.
- Twitch chat stays in place.
- server buttons say `Server 1`, `Server 2`, etc.
- server switching changes the actual iframe.
- Copy Link generates root-domain watch link.
- + MultiView actually hands off the selected stream.
- MLB Gameday still works.
- Bet is only visible when eligible.
- Collapse persists.
- leaving the player does not leave a hidden playing iframe.

## MultiView

- opens through `/?view=multiview`.
- old left nav does not appear inside V2 workspace.
- duplicate MultiView chat button/drawer is hidden in embedded mode.
- 2/3/4 layouts work.
- event picker works.
- Paste URL works.
- Solo returns to current root player.
- per-panel Servers menu works.
- loading mask prevents old `player.html` URL-entry screen from flashing.
- Share generates V2 root link.
- old shared standalone links still restore through V2.
- shared layout does not permanently replace personal layout.

## Persistent Chat

- iframe begins deferred when appropriate.
- first interaction mounts Twitch.
- direct watch can load chat immediately.
- Events → MultiView → Picks navigation does not recreate chat.
- hide/show does not unload chat.
- child pages do not display duplicate Twitch chat inside V2 shell.

## Picks

- embedded Picks does not flash old sidebar.
- Markets load without hanging.
- Twitch popup auth works in Firefox.
- successful auth refreshes outer shell identity.
- NFL is the only football Picks league.
- MLB/UFC/MMA date window remains intentional.
- 3 markets per sport/day backend limit remains unless explicitly changed.
- community-pool payout code does not return.
- losing pick = wager lost.
- void = wager refunded.
- Community Ledger still exists.
- real wager endpoint remains locked unless explicitly enabled.
- temporary betting-paused banner remains until requested otherwise.

---

# 19. Files to Inspect First by Problem Type

## "Homepage is broken"

Start with:

```text
index.html
v2/assets/js/app.js
v2/assets/js/events.js
v2/assets/js/core.js
v2/assets/css/home.css
v2/assets/css/event-cards-v1.css
```

## "Player is broken"

Start with:

```text
index.html
v2/assets/js/player.js
v2/assets/css/watch-view.css
v2/assets/js/mlb-gameday.js
```

If only broken inside MultiView:

```text
player.html
assets/eastcoins-multiview.js
assets/eastcoins-multiview-loading.js
assets/eastcoins-multiview-servers.js
```

## "Chat resets / disappears"

Start with:

```text
index.html
v2/assets/js/router.js
v2/assets/js/app.js
v2/assets/js/player.js
v2/assets/css/chat-cleanup.css
```

## "MultiView old UI is showing"

Start with:

```text
multiview.html
assets/eastcoins-multiview.css
v2/assets/js/router.js
```

Check:

```text
ecV2Embedded=1
ec-v2-embedded
```

## "MultiView share link opens old page"

Start with:

```text
assets/eastcoins-multiview-share.js
multiview.html
v2/assets/js/router.js
```

Canonical target should be:

```text
/?view=multiview&m=...
```

## "MultiView server buttons do nothing"

Start with:

```text
assets/eastcoins-multiview-servers.js
player.html
```

Remember the parent menu delegates to same-origin child player server buttons.

## "Picks markets missing / timing out"

Start with:

```text
picks.html
assets/eastcoins-picks-api.js
assets/eastcoins-picks-football-v50.js
assets/eastcoins-picks.js
functions/api/picks/catalog.js
```

## "Payout is wrong"

Start with:

```text
assets/eastcoins-moneyline.js
assets/eastcoins-moneyline-runtime.js
v2/assets/js/quick-bet.js
assets/eastcoins-picks.js
functions/api/picks/catalog.js
```

Do not use community-pool logic.

## "Firefox Twitch login fails"

Start with:

```text
picks.html
auth-complete.html
functions/api/picks/auth/twitch/start.js
functions/api/picks/auth/twitch/callback.js
functions/api/picks/bootstrap.js
```

Preserve popup + BroadcastChannel + bootstrap polling.

---

# 20. Coding Style / Change Strategy

EastCoin has accumulated many iterative feature patches.

When making a change:

1. Read the **current file on `main`**, not an old iteration installer.
2. Identify whether the problem belongs to the outer shell or an embedded child.
3. Make the smallest coherent change that fixes the current architecture.
4. Avoid adding another compatibility layer if an existing layer can be corrected.
5. Cache-bust changed CSS/JS assets when browsers may retain old behavior.
6. Preserve root-domain URLs.
7. Preserve persistent Twitch chat.
8. Preserve embedded cleanup.
9. Update `changelog.html`.
10. Validate syntax before shipping.

Do not use old iteration scripts as authoritative implementation references unless comparing historical intent.

---

# 21. Git Delivery Pattern

The user's normal local repository path is:

```text
C:\Users\jake\code\eastcoins
```

For a normal replacement-file update, provide commands in this style:

```bash
git --no-pager diff --check
git --no-pager diff --stat -- <changed files>

git add <changed files>

git status

git commit -m "Short descriptive commit message"

git push origin main
```

The user prefers this over Node installer scripts or patch installers.

---

# 22. Production Baseline Summary

The current production philosophy is:

```text
ROOT EASTCOIN SHELL
    owns nav
    owns Events
    owns Live Player
    owns Quick Bet
    owns Settings
    owns persistent Twitch chat

WORKSPACE
    embeds MultiView / Picks / other pages
    strips their duplicate global chrome

MULTIVIEW
    2–4 panels
    uses player.html as same-origin child tile player
    per-panel server switching
    shareable V2 layouts
    loading mask hides old player first-paint

PICKS
    Twitch identity
    sportsbook-style American moneyline payouts
    NFL + MLB + UFC/MMA
    API volume limits
    Community Ledger
    real wager backend still safety-locked

CHAT
    channel: zwades
    deferred initial load
    persistent after mounting
    never re-created by router
```

When in doubt, preserve this architecture first.

---

# 23. One-Sentence Rule for Future Claude Sessions

**EastCoin is a root-domain V2 shell with a native Events/Player experience, embedded MultiView/Picks workspaces, and one persistent outer Twitch chat; do not reintroduce standalone/V1 chrome, do not replace sportsbook moneylines with community-pool logic, and do not break root-domain deep links or chat persistence.**
