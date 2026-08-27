EastCoin V2 — Iteration 34 — Lock In / Review / Confirmation
================================================================

BASE
----
V2 Modular Baseline — Iteration 33

FLOW
----
The Quick Bet ticket now uses the V1-style staged flow:

1. BUILD TICKET
   - choose away/home
   - choose ZCoin wager
   - view sportsbook ML
   - view projected pool payout
   - view estimated return

2. LOCK IN PICK
   - does NOT charge anything
   - opens a dedicated review screen

3. REVIEW PICK
   - selected team
   - away/home designation
   - opponent
   - sportsbook reference ML
   - ZCoin wager
   - projected community-pool multiplier
   - estimated ZCoin return
   - reminder that projection can move until market lock

4. FINAL CONFIRMATION
   Future live states:
   - logged out -> Log In to Confirm
   - no season -> Season Required to Confirm
   - no StreamElements wallet -> Wallet Required to Confirm
   - wagering disabled -> Wagering Offline
   - fully ready -> Confirm Pick

5. SUCCESS RECEIPT
   Once real wager submission is available and succeeds:
   - PICK LOCKED IN
   - selected team
   - opponent
   - wager
   - projected multiplier
   - estimated return
   - View My Picks

CURRENT PREVIEW STATE
---------------------
The user CAN test:

Build Ticket
-> Lock In Pick
-> Review Pick
-> Edit Pick

The final confirmation remains intentionally blocked because no active Picks
season / StreamElements wallet is connected.

LOCK IN PICK IS NOT THE CHARGE
------------------------------
Lock In Pick only advances to Review.

Only Confirm Pick will eventually execute:
- server market recheck
- start-time recheck
- wager-limit recheck
- duplicate-pick recheck
- StreamElements debit
- Picks database insert
- receipt

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 34
