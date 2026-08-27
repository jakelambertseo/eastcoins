EastCoin V2 — Iteration 26 — Lighter Cards + Full Team Names
================================================================

BASE
----
V2 Modular Baseline — Iteration 25

BACKGROUND VISIBILITY
---------------------
Iteration 24's deterministic away/home background logos were intentionally
subtle:

logo opacity ~10%
+
heavy dark overlay

On real cards this made the artwork difficult to see.

Iteration 26:

- raises background team-logo opacity to ~20%
- slightly increases logo size
- increases brightness/saturation
- reduces edge darkness
- reduces center overlay darkness
- reduces bottom fade darkness

Foreground logos and readable card text remain the strongest visual elements.

TEAM NAMES
----------
The old CSS explicitly used:

overflow: hidden
text-overflow: ellipsis
white-space: nowrap

That caused names such as:

Pittsburgh Steelers
Buffalo Bills
New England Patriots
Los Angeles Chargers

and many college programs to be shortened.

Iteration 26 removes single-line truncation.

Team names now use:

white-space: normal
overflow-wrap: anywhere
text-overflow: clip

There is no artificial line-count limit.

CARD HEIGHT
-----------
Normal matchup cards now receive:

- taller visual minimum
- taller matchup minimum
- larger base card minimum

If a very long college team name needs additional lines, CSS can grow the card
beyond that minimum naturally.

UNCHANGED
---------
- away-left / home-right deterministic background ordering
- NFL RedZone featured card
- single-event cards
- card odds
- Bet visibility
- scores
- MultiView
- Watch/Open
- category expanders

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 26
