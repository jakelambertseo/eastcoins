EastCoin V2 — Iteration 15 — Quick Bet + Exact Picks Market
===================================================================

BASE
----
V2 Modular Baseline — Iteration 13

This supersedes the temporary Iteration 14 Bet test helper.

PRODUCT DECISION
----------------
Bet is now a FAST action.

Clicking Bet no longer forces the user into the full Picks page.

New flow:

Event card
  -> Bet
  -> verify exact Odds API event
  -> find/create exact D1 Picks market
  -> V2 Quick Bet ticket
  -> choose side
  -> slider
  -> Place Bet

The outer V2 shell and Twitch chat remain mounted the entire time.

EXACT MARKET HANDOFF
--------------------
Card odds now retain:
- providerEventId
- sportKey
- sportTitle
- commenceTime
- provider away/home names

New endpoint:
POST /api/picks/markets/ensure

The endpoint:
1. re-verifies the event server-side against /api/v2/card-odds
2. rejects games that have started
3. looks up provider='odds_api' + provider_event_id in D1
4. returns the existing OPEN market when present
5. otherwise creates one under the active Picks season
6. relies on the existing UNIQUE(provider, provider_event_id) constraint so
   simultaneous clicks cannot create duplicate markets
7. returns the current active Picks pool for the Quick Bet projection

This eliminates fuzzy team-name routing as the primary Bet handoff.

QUICK BET UX
------------
The ticket shows:
- matchup
- optional sportsbook consensus ML reference
- away/home choice
- Picks projected multiplier
- wager slider
- wallet
- personal/server max wager
- potential return
- Full Picks shortcut

IMPORTANT ODDS DISTINCTION
--------------------------
The event-card ML is sportsbook REFERENCE data.

It is NOT the guaranteed Picks payout.

EastCoin Picks remains community/parimutuel. The ticket calculates its
projected multiplier from the Picks market pool.

CURRENT BACKEND LIMITATION
--------------------------
The production backend currently reports:
- StreamElements wallet not connected
- real wagering disabled

The Quick Bet ticket honors those flags.

That means the exact market creation and fast-ticket UX can work now, while
the Place Bet control remains disabled until the existing Picks wallet/wager
backend is enabled.

It does NOT fake a successful ZCoin wager.

LOGIN
-----
If a logged-out user opens Quick Bet, the ticket can send them through the
existing Twitch OAuth flow and return them to /v2/.

BET ELIGIBILITY
---------------
The card Bet button remains pregame-only.

The ensure endpoint independently checks the provider commence time again, so
a stale browser cannot create or bet an already-started event.

FILES
-----
Changed:
v2/index.html
v2/assets/js/events.js
functions/api/v2/card-odds.js

New:
v2/assets/js/quick-bet.js
v2/assets/css/quick-bet.css
functions/api/picks/markets/ensure.js

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 15
