EastCoin V2 — Iteration 30 — Expanded Moneyline Sports
============================================================

BASE
----
V2 Modular Baseline — Iteration 29 + Iteration 28 frontend

NEW ODDS STRATEGY
-----------------
The old low-quota architecture is retired.

REMOVED:
- tiny cross-sport `upcoming` feed as the primary catalog
- low-credit adaptive 2h / 4h / 8h / 12h caching
- betting eligibility for unrelated sports

EastCoin now uses:

1. GET /v4/sports
   - quota-free
   - discovers active sport keys

2. GET /v4/sports/{sport}/events
   - quota-free
   - verifies exact event IDs
   - matches EastCoin cards to exact provider leagues

3. GET /v4/sports/{sport}/odds
   - full sport-specific feed
   - regions=us
   - markets=h2h
   - oddsFormat=american
   - only requested for exact sport keys represented by current EastCoin cards

ALLOWED BETTING
---------------
Moneyline betting is enabled only for:

AMERICAN FOOTBALL
- NFL
- NFL preseason
- NCAAF
- CFL
- UFL
- other active non-outright americanfootball_* provider leagues

BASEBALL
- MLB
- MLB preseason
- NCAA Baseball
- MiLB
- NPB
- KBO
- other active non-outright baseball_* provider leagues

UFC / MMA
- mma_mixed_martial_arts

NOT ALLOWED
-----------
- basketball
- soccer
- hockey
- tennis
- boxing
- wrestling
- golf
- motorsport
- other sports
- futures/outrights

MONEYLINE ONLY
--------------
The only requested market is:

h2h

No:
- spreads
- totals
- props
- futures

BET BUTTON
----------
Bet now requires all of:

- game has not started
- exact Odds API provider event ID
- allowed sport key
- current away moneyline
- current home moneyline

A provider event with no currently listed h2h price does not show Bet.

SERVER ENFORCEMENT
------------------
/api/picks/markets/ensure independently rejects:

MONEYLINE_SPORT_NOT_ALLOWED
MONEYLINE_NOT_AVAILABLE

The browser cannot bypass the sport/market restriction.

CACHE
-----
Sports catalog:
6 hours

Quota-free event catalog:
30 minutes

Paid full moneyline feed:
15 minutes fixed

No adaptive low-quota stretching.

The browser checks every:
5 minutes while visible
30 minutes while hidden

Cloudflare edge cache owns provider request frequency.


LIVE SCORE CACHE
----------------
The old low-credit adaptive score cache is also retired.

Score snapshots now use a fixed:

5 minutes

There is no longer a quota-based 20 / 30 / 60 minute cache extension.

The existing browser score refresher can continue checking more frequently;
Cloudflare's shared cache owns the actual provider request frequency.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 30
