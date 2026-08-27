EastCoin V2 — Iteration 18 — Final-Score-Aware Events
==============================================================

BASE
----
V2 Modular Baseline — Iteration 17

BEHAVIOR
--------
The Odds API score response is now authoritative for game completion.

If:
completed = true

EastCoin no longer trusts a lingering Streamed/PPV "live" flag for the Events UI.

Lifecycle:

Stream says LIVE
        +
Odds API says completed=false
        ->
LIVE card

Then Odds API says completed=true
        ->
FINAL card + final score
        ->
removed from Live counts/filter immediately
        ->
kept in All briefly for 10 minutes
        ->
automatically removed from normal Events timeline

WHY KEEP IT FOR 10 MINUTES?
---------------------------
It confirms the final result to users who were just watching without leaving
stale completed games sitting in the live-event catalog.

The grace window uses Odds API last_update.

If completed=true is returned without a usable last_update, the final event is
removed immediately rather than risking a permanently stale card.

PLAYER BEHAVIOR
---------------
If a user is already watching a stream when the game becomes final, EastCoin
does NOT forcibly close the player.

Only the event catalog/card status changes.

LIVE FILTER
-----------
A completed event:
- no longer counts toward category LIVE totals
- disappears from the Live sport filter
- disappears from the Live status filter
- is never treated as Upcoming
- cannot show Bet

CARD
----
During the short final grace period:

FINAL

Away       5 - 3       Home
             FINAL

After the grace period the event disappears from the normal Events timeline.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 18
