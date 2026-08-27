EastCoin V2 — Iteration 20 — Bets Closed on Started Games
================================================================

BASE
----
V2 Modular Baseline — Iteration 19

CARD ACTION RULES
-----------------
Pregame:
- Favorite
- MultiView
- Bet
- Watch/Open

Started / Live / Final:
- Bets Closed
- MultiView
- Watch/Open

The Favorite action is removed from started games.

STARTED DEFINITION
------------------
An event is treated as started if ANY of these are true:

- the provider marks it live
- The Odds API has verified it final
- its scheduled start time is now or in the past

This means a stale provider that has not flipped to Live yet still cannot show
pregame betting/favorite actions after the scheduled start.

BETTING
-------
The existing Bet eligibility continues to be pregame-only.

Bets Closed is intentionally disabled. It is informational and does not open
the Quick Bet ticket.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 20
