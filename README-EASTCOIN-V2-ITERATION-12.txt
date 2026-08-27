EastCoin V2 — Iteration 12 — Card Odds + Category Headers
================================================================

BASE
----
V2 Modular Baseline — Iteration 11

CHANGES
-------
1. Removed the ESPN live-score card experiment.

2. Added Odds API consensus moneyline odds to matching cards.

3. Added V1-style category sections:
   - sport icon/name
   - live-now subtitle
   - LIVE count
   - total event count
   - four event cards wide inside each category on desktop

4. Entire event card is clickable to open the event.

5. Save, + MultiView and Watch/Open buttons remain independently clickable.

ODDS ARCHITECTURE
-----------------
Client:
v2/assets/js/card-odds.js

Server:
functions/api/v2/card-odds.js

The server makes ONE shared Odds API request against:
sport = upcoming
region = us
market = h2h
oddsFormat = american

That provider response is matched back to EastCoin events by both team names
and start-time proximity.

Card odds are median no-vig consensus moneylines across returned bookmakers.

CREDIT PROTECTION
-----------------
Card odds are browse decoration, not wager-lock quotes.

Default shared edge cache:
30 minutes

When Odds API remaining credits get lower, new snapshots automatically use:
<=250 remaining: 2 hours
<=150 remaining: 4 hours
<=75 remaining: 8 hours

The client also only asks the EastCoin route about every 30 minutes while open.

The locked-wager Picks quote system should remain separate from these browse
odds.

CLEANUP
-------
Run:
node tools\apply-eastcoin-v2-iteration-12.cjs

That script also deletes the retired files:
v2/assets/js/live-data.js
functions/api/v2/live-scores.js

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 12
