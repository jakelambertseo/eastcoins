EastCoin V2 — Iteration 22 — Category Game Expanders
==========================================================

BASE
----
V2 Modular Baseline — Iteration 21

WHY
---
High-volume sports such as college football can return dozens of games for one
date. Rendering every card makes that sport dominate the entire Events page.

NEW BEHAVIOR
------------
Each sport category initially shows:

16 games

On the current four-column desktop layout, that is four full rows.

If the category contains more than 16 games, a full-width control appears:

Show 29 More Games
16 of 45 shown

After expansion:

Show Fewer Games
45 games currently shown

CATEGORY COUNTS
---------------
Header totals always represent the complete filtered category.

Example:

FOOTBALL
45 upcoming
45 TOTAL

The 45 total does not change just because only 16 cards are initially visible.

ORDERING
--------
The first 16 are the same cards EastCoin would normally render first using the
current Recommended/Time sorting logic.

FILTER BEHAVIOR
---------------
Changing sport, date, status, search, or sort resets categories to their normal
collapsed state.

Odds/score refreshes and ordinary rerenders preserve an expanded category as
long as the active filters have not changed.

LIVE / SAVED
------------
Explicit Live and Saved views do not collapse categories. Those views are
intentional narrow result sets and should expose all matching cards.

PERFORMANCE
-----------
Collapsed categories only render the visible card markup, reducing homepage DOM
size for days with very large college-football or multi-league event catalogs.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 22
