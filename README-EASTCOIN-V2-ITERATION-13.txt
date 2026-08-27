EastCoin V2 — Iteration 13 — Bet Button + Picks Handoff
================================================================

BASE
----
V2 Modular Baseline — Iteration 12

BET BUTTON
----------
Pregame cards now show a Bet action beside + MultiView.

Bet is omitted when:
- the event is marked live
- the event scheduled start time is now/past
- the event has no usable future start time

PICKS HANDOFF
-------------
Bet keeps the outer V2 shell and persistent Twitch chat mounted.

It opens the existing Picks workspace and:
- filters Picks using Away + Home
- falls back to either team if provider naming differs
- highlights the matching Picks market
- scrolls that market into view

It does NOT guess which team the user wants.
The user still selects the side normally inside Picks.

If no corresponding open Picks market exists, V2 shows a message instead of
fabricating one.

CARD FOOTER
-----------
Removed the redundant sport/category label from the left side of the footer.
The category section header already supplies that information.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 13
