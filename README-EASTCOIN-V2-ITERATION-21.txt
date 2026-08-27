EastCoin V2 — Iteration 21 — Verified Bet Visibility
===========================================================

BASE
----
V2 Modular Baseline — Iteration 20

CHANGE
------
Pregame Bet buttons are no longer shown merely because an event has not started.

Bet now requires BOTH:

1. the event is still pregame
2. the card has an exact verified Odds API providerEventId

If a future event appears in the EastCoin schedule but is not currently in the
verified Odds API catalog, the card simply does not show Bet.

This prevents the dead-end:

"This event is not currently available from the verified Odds API catalog."

STARTED EVENTS
--------------
Started / live / final events keep:

Bets Closed
MultiView
Watch/Open

PREGAME VERIFIED EVENT
----------------------
Favorite
MultiView
Bet
Open

PREGAME UNVERIFIED EVENT
------------------------
Favorite
MultiView
Open

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 21
