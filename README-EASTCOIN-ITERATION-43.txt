EastCoin Iteration 43 — Picks Live Catalog
============================================

ROOT CAUSE
----------
The production Picks page was rendering only /api/picks/bootstrap -> markets.

That array comes from D1. A D1 market is created only after the market/ensure
flow has already prepared that event. Therefore a healthy live Odds API feed
could exist while Picks still rendered:

    No current markets match that search.

That was a data-source problem, not a search problem.

FIX
---
Picks now has a dedicated browse catalog:

    GET /api/picks/catalog

It loads verified upcoming US h2h moneyline markets from The Odds API for:
- NFL
- MLB
- UFC / MMA
- NCAAF

The endpoint uses a shared 15-minute edge cache and a 14-day horizon.

The browser merges that live catalog with D1 by provider event ID:
- provider catalog supplies the actual current game list + sportsbook reference
- D1 supplies persisted EastCoin community pool/ticket state
- existing D1 markets retain their real market IDs
- catalog-only games are created in D1 only when a signed-in user selects one
- if no Picks season is active, the game remains browseable and the user gets a
  clear "season is not active yet" message instead of a fake search error

FILES
-----
functions/api/picks/catalog.js   NEW
assets/eastcoins-picks-api.js
assets/eastcoins-picks.js
picks.html
changelog.html

RUN
---
node tools\apply-eastcoin-iteration-43.cjs
