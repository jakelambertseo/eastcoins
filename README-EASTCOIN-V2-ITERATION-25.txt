EastCoin V2 — Iteration 25 — NFL Bet Verification + ZCoins Icon
==================================================================

BASE
----
V2 Modular Baseline — Iteration 24

DIAGNOSIS
---------
The event card odds backend used:

/v4/sports/upcoming/odds

The Odds API documents `upcoming` as live games plus only the next 8 upcoming
games ACROSS ALL SPORTS.

That is why NFL games visible in EastCoin can receive no providerEventId from
the card odds response.

Iteration 21 intentionally hides Bet without an exact providerEventId, so those
cards correctly showed no Bet button.

FIX
---
EastCoin keeps the existing cached paid cross-sport odds request for card ML
reference values.

For American-football candidates it now ALSO calls:

/v4/sports/americanfootball_nfl/events

The Odds API documents the sport-specific events endpoint as quota-free.

That catalog supplies exact provider:

- event ID
- away team
- home team
- commence time
- sport key/title

The same conservative team/time matcher is used.

RESULT
------
If the paid upcoming odds snapshot contains a game:
- exact provider ID
- consensus ML when available
- Bet button

If paid upcoming does not contain it but the free NFL event catalog verifies it:
- exact provider ID
- Bet button
- Quick Bet can server-side reverify the exact event
- sportsbook ML reference can be absent
- no additional paid odds credit is used for verification

Quick Bet already treats sportsbook ML as optional reference data.

QUOTA
-----
This adds zero additional paid NFL odds polls.

The NFL events catalog is quota-free and receives a shared 15-minute edge cache.

DIAGNOSTICS
-----------
/api/v2/card-odds now reports:

matched
priced
verifiedOnly
providerGameCount
nflEventCatalogCount
nflEventsCacheStatus

ZCOINS ICON
-----------
The top-nav wallet shortcut now uses the supplied 7TV image:

https://cdn.7tv.app/emote/01KY8QC028T1NJD49NTEH898BC/2x.webp

instead of the generic yellow dot.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 25
