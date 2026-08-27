EastCoin V2 — Iteration 10 — V1-Style Event Cards + Live Scores
================================================================

BASE
----
V2 Modular Baseline — Iteration 9

PARTIAL UPDATE
--------------
Only changed/new files are included.

EVENT CARD REDESIGN
-------------------
The event cards now borrow the strongest parts of the previous EastCoin/V1
events card design:

- matchup-first visual
- large centered team logos
- team names directly below logos
- LIVE/time badge in the upper-left
- network/channel indicator in the upper-right
- compact bottom metadata/action footer
- burgundy Watch/Open button
- save star retained

V2's existing desktop density is preserved:
4 cards wide on large desktop
3 cards wide below 1260px
2 cards wide below 900px
1 card wide on mobile

LIVE GAME DATA TEST
-------------------
This iteration adds:

v2/assets/js/live-data.js
functions/api/v2/live-scores.js

Data strategy:

1. First inspect the current EastCoin event payload for a real score pair.
2. For live matchup events without embedded scores, POST a small batch of
   event/team identifiers to /api/v2/live-scores.
3. The Cloudflare function fetches current public Kalshi Sports milestones.
4. It matches milestones to EastCoin events using both teams plus start-time
   proximity.
5. Matching milestone IDs are sent to Kalshi's batch live-data endpoint.
6. EastCoin parses a real away/home score pair and optional period/clock/status.
7. The card rerenders with the score in the center.

NO SCORE FABRICATION
--------------------
If a safe real score cannot be identified, the card stays in the normal:

TEAM    VS    TEAM

layout.

It never guesses a score or inserts fake live-game data.

LIVE SCORE DISPLAY
------------------
When available:

AWAY TEAM       3 – 2       HOME TEAM
                B7
             LIVE DATA

For football/basketball/hockey it can similarly show period/quarter and clock
when those fields are present in the provider's live-data payload.

POLLING
-------
Live events refresh score enrichment about every 30 seconds while the page is
visible. The Cloudflare bridge caches milestone discovery for 60 seconds and
batch live data for 20 seconds.

ODDS API
--------
This test does NOT use The Odds API and therefore does not spend the limited
Odds API monthly credits.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 10
