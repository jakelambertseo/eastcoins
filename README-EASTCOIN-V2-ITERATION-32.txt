EastCoin V2 — Iteration 32 — Quick Bet No-Season Preview
=============================================================

BASE
----
V2 Modular Baseline — Iteration 31

BUG
---
Quick Bet preview still called:

POST /api/picks/markets/ensure

before rendering the ticket.

The endpoint correctly:
1. verified the exact Odds API event
2. checked for an existing Picks market
3. attempted to create one if missing

But creating a market requires an active D1 season.

When no active season existed, the server returned:

NO_ACTIVE_PICKS_SEASON

and the frontend showed:

Quick Bet unavailable
EastCoin Picks does not currently have an active season.

FIX
---
NO_ACTIVE_PICKS_SEASON is now a valid PREVIEW-ONLY state.

After the server has already verified the exact provider event:

- Quick Bet builds a temporary local ticket
- no fake D1 market is created
- no pick is saved
- no wallet balance is invented
- no wager can be submitted

The ticket can still preview:
- away/home team selection
- sportsbook reference ML
- 1–50 ZCoin preview wager
- slider/input/quick amount buttons
- community-pool projection
- estimated return

CTA
---
When there is no active Picks season:

Preview Only — Season Not Active

The button is disabled.

FUTURE
------
As soon as a real active season exists, the exact same Quick Bet code stops
using the local fallback and resumes the persisted D1 market flow automatically.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 32
