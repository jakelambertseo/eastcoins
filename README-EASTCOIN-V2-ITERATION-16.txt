EastCoin V2 — Iteration 16 — Odds API Live Scores
=========================================================

BASE
----
V2 Modular Baseline — Iteration 15

EXACT MATCHING
--------------
The Odds API documentation states that the game ID in the scores endpoint is
the same game ID used by the odds endpoint.

Iteration 15 already retains that exact providerEventId.

Score flow:

EastCoin event
  -> card odds exact providerEventId
  -> Odds API scores endpoint
  -> exact same providerEventId
  -> live score

No ESPN fuzzy matching.
No Kalshi milestone matching.

CARD DISPLAY
------------
When real score data exists:

AWAY        4 - 3        HOME
            LIVE SCORE
            Updated 2m ago

Existing ML reference odds remain below the team names.

If score data is unavailable, the card keeps the existing VS layout.

INNING / QUARTER / CLOCK
------------------------
The documented Odds API V4 scores response contains:

- id
- sport_key
- sport_title
- commence_time
- completed
- home_team
- away_team
- scores
- last_update

It does not document inning, quarter, period or game-clock fields.

Iteration 16 does not invent them.

QUOTA PROTECTION
----------------
The historical-completion option is intentionally not sent.

The Odds API documents:
- live/upcoming score request: 1 credit
- request including completed games from prior days: 2 credits

The server caches one snapshot per sport, shared across all events and users.

Default provider cache: 10 minutes

Adaptive cache:
<=250 credits remaining: 20 minutes
<=150: 30 minutes
<=75: 60 minutes

The browser checks EastCoin once per minute while visible, but shared cache hits
do not trigger another provider request.

Only live cards that already have an exact Odds API event ID are score queried.

The current Odds API coverage page marks scores/results for major leagues
including NFL, NCAAF, MLB, NBA, WNBA, NCAAB, NHL and many soccer leagues.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 16
