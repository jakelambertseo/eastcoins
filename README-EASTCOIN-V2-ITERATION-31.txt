EastCoin V2 — Iteration 31 — Quick Bet Ticket Preview
==========================================================

BASE
----
V2 Modular Baseline — Iteration 30

GOAL
----
Finish the Quick Bet user experience before the StreamElements ZCoin wallet is
connected, without fabricating balances or pretending real wagers are active.

WHAT WORKS NOW
--------------
Click Bet on a verified event:

1. exact Odds API event is verified
2. Picks market is created/found
3. Quick Bet opens
4. user can select away/home
5. sportsbook consensus ML is shown
6. user can change a PREVIEW wager
7. projected community-pool multiplier updates
8. estimated ZCoin return updates
9. Full Picks remains available

PREVIEW WAGER CONTROLS
----------------------
While the wallet is disconnected:

- numeric amount field
- slider
- 5 / 10 / 25 / 50 quick amount buttons
- preview range: 1–50 ZCoins
- default preview: 10 ZCoins

These are explicitly labeled PREVIEW WAGER.
They are NOT presented as the user's actual wallet limit.

WALLET STATE
------------
The ticket displays:

Pending StreamElements

It does NOT display 0 ZCoins as though that were a real wallet balance.

FINAL CTA
---------
Authenticated + wallet disconnected:

Connect ZCoin Wallet to Bet

The button is disabled.
No call to /api/picks/wagers is made.

When StreamElements is connected later, the same ticket automatically switches
from preview limits to the wallet/backend's actual min/max wager limits.

AUTH
----
Logged-out users can still preview the ticket.
The CTA remains Log in with Twitch and uses the existing Twitch auth flow.

PROJECTED PAYOUT
----------------
The displayed multiplier remains EastCoin's community-pool projection.
Sportsbook ML is reference information only.
No sportsbook moneyline is used as the EastCoin payout multiplier.

UNCHANGED
---------
- real wagering remains disabled until wallet integration
- no fake success state
- no fake balance
- exact provider event verification
- football/baseball/UFC-MMA restriction
- moneyline-only market support

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 31
