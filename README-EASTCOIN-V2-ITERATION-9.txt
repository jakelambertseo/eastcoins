EastCoin V2 — Iteration 9 — Real Home Removal + Chat Fix
============================================================

BASE
----
V2 Modular Baseline — Iteration 8

CORRECTION
----------
This fixes two issues from Iterations 6/7:

1. The old landing shell is now ACTUALLY removed from v2/index.html:
   - What are we watching? intro
   - Custom Stream / Open Featured buttons in that intro
   - provider-connected/status banner
   - featured event
   - Up Next rail

2. The EastCoin wrapper header above Twitch chat is now ACTUALLY removed:
   - LIVE CHAT
   - zwades
   - PERSISTENT badge

The Twitch iframe now directly fills the persistent chat panel.

EVENTS
------
The sports timeline remains. Event provider loading now renders directly into
that timeline and no longer tries to update removed featured/status elements.

PERSISTENT CHAT
---------------
The locked persistence rule remains unchanged. The Twitch iframe stays mounted
while moving between V2 routes; only the extra EastCoin wrapper header is gone.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 9
