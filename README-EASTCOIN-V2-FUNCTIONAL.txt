EastCoin V2 — Functional Baseline — Iteration 2
=================================

STAGING ROUTE
-------------
https://eastcoin.vip/v2/

This is the first functional clean-room V2 baseline. It does not replace the current EastCoin shell.

FUNCTIONAL NOW
--------------
- real Streamed + PPV catalog through the existing shared adapters
- real getDiscovery / getAll event loading
- real getStreams(match) player resolution
- horizontal top navigation
- sports filters
- Today / next four days / This Week timeline
- Live / Upcoming / Saved filtering
- search and Recommended / Time sort
- real Twitch chat drawer
- custom stream URL player
- saved + recently watched local V2 UI state
- current Picks Twitch identity and season stats when available
- optional Kalshi Sicko Prop strip when /api/picks-kalshi/featured is available

NOT REBUILT YET
---------------
MultiView, Picks and Games still navigate to their current production routes. This is deliberate. We will rebuild V2 page-by-page instead of recreating a nested persistent iframe shell.

DEPLOY
------
Extract this ZIP over the EastCoin repository root. Then run:

node tools/apply-eastcoin-v2-changelog.cjs

Commit and push.

SMOKE TEST
----------
1. https://eastcoin.vip/v2/
2. Confirm real events appear.
3. Test sport/date/status/search filters.
4. Open an event and confirm stream buttons resolve.
5. Open Twitch chat.
6. Test Custom Stream.
7. Confirm /index.html is still unchanged.

ITERATION NAME
--------------
V2 Functional Baseline — Iteration 1


ITERATION 2 — TYPOGRAPHY PASS
-----------------------------
Scope:
V2 Homepage

Changes:
- Increased the entire V2 typography scale.
- Former ~6–8px utility text now targets roughly 12–13px.
- Former ~9–10px interface text now targets roughly 14px.
- Important labels/headings scale toward 15–18px.
- Existing display headings were enlarged while preserving hierarchy.
- Increased component height/padding only where needed to prevent the larger
  type from feeling cramped.
- Added a compact network/channel pill to event presentation.
- Added viewer-count presentation.

VIEWER COUNT DATA NOTE
----------------------
V2 does not fabricate viewer numbers.

It checks common real event fields such as:
viewers
viewerCount
viewer_count
watching
watchers
audience

and compatible provider fields when present.

If the current EastCoin provider payload does not supply a viewer number, the
UI explicitly shows:

Viewers —

The network/channel label similarly prefers real network/channel/broadcast
fields and falls back to the existing EastCoin provider label when no broadcast
field exists.

No provider, backend, navigation, filtering, player, chat, Picks, or route
behavior was otherwise redesigned in this iteration.

CURRENT VERSION:
V2 Functional Baseline — Iteration 2


ITERATION 3 — MODULAR FRONTEND ARCHITECTURE
-------------------------------------------
This iteration intentionally makes NO visual redesign.

The previous:
v2/assets/eastcoin-v2.css
v2/assets/eastcoin-v2.js

have been removed.

CSS is now:
v2/assets/css/
  tokens.css
  shell.css
  home.css
  overlays.css
  responsive.css

JavaScript is now:
v2/assets/js/
  core.js
  player.js
  events.js
  integrations.js
  app.js

FILE OWNERSHIP
--------------
tokens.css
  Design tokens, global reset, body defaults.

shell.css
  Horizontal header, navigation, search, ZCoin/Twitch controls, sport strip.

home.css
  Homepage content only: hero, Up Next, Sicko Prop, timeline, cards, lower panels.

overlays.css
  Twitch chat, event player, custom stream modal, toast.

responsive.css
  Media-query behavior only.

core.js
  Shared state, DOM references and common data/formatting helpers.

player.js
  Chat drawer, player modal, stream source switching, custom stream handling.

events.js
  Event provider loading, event normalization, sorting/filtering, cards, timeline,
  favorites and recent events.

integrations.js
  Picks/Twitch identity and optional Kalshi Sicko Prop integration.

app.js
  Page-level event listeners and startup only.

GOING FORWARD
-------------
Do NOT regenerate every V2 file for normal iterations.

Examples:

Typography / card styling:
  usually home.css only

Header / horizontal nav:
  shell.css

Mobile nav:
  responsive.css (+ shell.css only if needed)

Player:
  player.js + overlays.css

Event filtering / schedule:
  events.js

Twitch/Picks/Kalshi integration:
  integrations.js

Global palette/design token:
  tokens.css

A future ZIP should normally contain ONLY the files changed by that iteration,
plus the changelog patcher when the update is meaningful.

A complete V2 package should only be regenerated for:
- major architecture changes
- large cross-cutting redesigns
- milestone backups / clean baselines

CURRENT VERSION:
V2 Modular Baseline — Iteration 3
