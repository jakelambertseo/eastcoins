EastCoin V2 — Iteration 11 — ESPN Live Scores + MultiView
================================================================

BASE
----
V2 Modular Baseline — Iteration 10

CARD CLEANUP
------------
Removed from event cards:
- Streamed + PPV / provider fallback label
- "Live now · Viewers — · 5 sources"-style footer metadata
- live-score provider source label

Real broadcast/network labels still display when the event itself actually
contains a network/channel field.

MULTIVIEW
---------
Restored + MultiView to each event card.

The button writes into the same existing localStorage key used by V1:
eastcoinMultiviewV1

It preserves the current four-slot state and expands the layout as additional
slots are filled.

LIVE SCORES — METHOD 2
----------------------
The Kalshi score bridge has been replaced.

New source:
ESPN public scoreboard JSON, proxied through:
/api/v2/live-scores

Why:
- direct team score data
- direct home/away teams
- current game status
- period / inning information
- display clock when available
- much easier event matching than market milestones

Matching requires:
1. both EastCoin team names
2. compatible sport/league
3. reasonable event start-time proximity

No score is displayed when the match is not confident.

CURRENT COVERAGE
----------------
MLB
WNBA
NBA
Men's college basketball
NFL
College football
NHL
Selected major soccer competitions

The client polls approximately every 20 seconds while live games exist.
The Cloudflare function caches ESPN scoreboard responses for 15 seconds.

IMPORTANT
---------
The ESPN endpoint is public and unauthenticated but unofficial/undocumented.
The entire integration is therefore fail-soft: if ESPN changes or fails,
EastCoin event browsing/player functionality continues normally.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 11
