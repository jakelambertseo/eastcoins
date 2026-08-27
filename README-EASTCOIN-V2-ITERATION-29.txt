EastCoin V2 — Iteration 29 — Full NFL Moneylines
=====================================================

BASE
----
V2 Modular Baseline — Iteration 28
(with Iteration 25 NFL exact-event verification already deployed)

PROBLEM
-------
Iteration 25 fixed NFL Bet eligibility by supplementing The Odds API's special
cross-sport `upcoming` feed with the quota-free NFL `/events` catalog.

That solved providerEventId verification, but `/events` does not contain odds.

Result:
- Bet button could appear
- exact provider event could be verified
- ML could still be absent

WHY
---
The provider's special:

/v4/sports/upcoming/odds

contains live games plus only the next 8 upcoming games across ALL sports.

It is not a complete NFL pricing catalog.

ITERATION 29
------------
NFL cards now also use:

/v4/sports/americanfootball_nfl/odds

with:

regions=us
markets=h2h
oddsFormat=american

The full NFL feed is used FIRST for NFL card pricing.

NFL matching priority is now:

1. full sport-specific NFL h2h odds
2. small cross-sport upcoming odds
3. quota-free NFL events catalog

If #1 matches:
- exact providerEventId
- home ML
- away ML
- consensus no-vig reference price
- Bet button

If sportsbooks temporarily do not list a line:
- fallback exact-event verification still works
- Bet can remain available
- ML can legitimately remain absent

QUOTA
-----
The Odds API documents one h2h market x one US region as 1 request credit.

To protect EastCoin's monthly quota, the full NFL odds snapshot has ONE shared
Cloudflare edge cache:

Default:
2 hours

Remaining provider credits <= 250:
4 hours

Remaining <= 150:
8 hours

Remaining <= 75:
12 hours

The browser never calls The Odds API directly.

The sportsbook ML displayed on EastCoin is reference context. Picks payout logic
still uses the EastCoin community pool, so minute-by-minute sportsbook repricing
is not required.

UNCHANGED
---------
- quota-free NFL /events identity fallback
- Quick Bet exact provider-event verification
- category expanders
- three-card desktop grid
- RedZone featured card
- scores/finals
- ZCoins nav icon

FILES
-----
functions/api/v2/card-odds.js
tools/apply-eastcoin-v2-iteration-29-changelog.cjs
README-EASTCOIN-V2-ITERATION-29.txt

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 29
