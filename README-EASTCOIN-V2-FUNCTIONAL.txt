EastCoin V2 — Functional Baseline
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
