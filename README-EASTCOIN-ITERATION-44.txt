EastCoin Iteration 44 — Moneyline Payouts (Corrected Installer)
===============================================================

CORRECTED INSTALLER
-------------------
This build removes a redundant Quick Bet cleanup matcher from the first
Iteration 44 installer. The first build aborted before writing production files
when that already-replaced block was searched for a second time.


PRODUCT CHANGE
--------------
The community-pool payout algorithm is retired.

EastCoin Picks now treats the displayed consensus American moneyline as the
payout price.

Examples:
+150 with a 10 ZCoin wager:
  15 ZCoins profit
  25 ZCoins total return

-200 with a 10 ZCoin wager:
  5 ZCoins profit
  15 ZCoins total return

ZCoins are whole-number currency, so total returns are rounded to the nearest
whole ZCoin.

LOCK RULE
---------
The product rule is now:
- odds can move while a ticket is being built
- the moneyline displayed/verified at confirmation locks for that Pick
- game-start community volume does NOT change the payout

WHAT CHANGED
------------
- One shared moneyline calculator for root Quick Bet + full Picks
- Quick Bet team prices now show American ML rather than pool multipliers
- Quick Bet payout and review calculations use ML
- Full Picks market cards show ML and identify The Odds API as payout source
- Full Picks bet slip uses ML for projected profit + total return
- My Picks uses locked/current ML instead of pool multipliers
- How Picks Work rewritten for moneyline payouts
- One-sided community action is no longer No Action
- Void/cancelled/No Action events are refund cases
- Community Ledger remains an activity/transparency feature only
- Local preview engine no longer simulates community pools
- Changelog updated

REAL WAGER SAFETY
-----------------
This does NOT enable the currently-disabled real ZCoin wager endpoint.
functions/api/picks/wagers.js remains protected by WAGERING_NOT_READY.

When real wagering is enabled later, the server must re-verify and persist the
moneyline at confirmation rather than trusting a client-supplied price.

FILES
-----
assets/eastcoins-moneyline.js       NEW
index.html
picks.html
v2/assets/js/quick-bet.js
assets/eastcoins-picks.js
assets/eastcoins-picks-preview.js
v2/assets/js/card-odds.js
changelog.html

RUN
---
node tools\apply-eastcoin-iteration-44.cjs