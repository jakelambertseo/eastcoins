EastCoin V2 — Iteration 24 — Correct Matchup Background Order
================================================================

BASE
----
V2 Modular Baseline — Iteration 23

PROBLEM
-------
Normal two-team cards previously had two independent visual data sources:

Foreground:
match.teams.away -> left
match.teams.home -> right

Background:
provider-generated matchup poster

Some provider posters visually placed home/away in the opposite order, so a card
could show:

Foreground:
Steelers | Bills

Background:
Bills | Steelers

FIX
---
Normal two-team cards no longer use the provider's composite matchup poster as
their background.

EastCoin now creates the background from the SAME team objects used by the
foreground card:

away badge -> LEFT
home badge -> RIGHT

Because both layers now use one semantic source, they cannot disagree on team
order.

VISUALS
-------
The new background uses:

- oversized low-opacity away logo on the left
- oversized low-opacity home logo on the right
- subtle VS divider
- EastCoin dark shading on top

The visible foreground logos remain unchanged.

FALLBACKS
---------
If an individual team badge is missing, EastCoin uses team initials for that
background side.

If both individual badges are missing, a neutral VS background is used rather
than falling back to a potentially reversed composite provider poster.

UNCHANGED
---------
Provider posters remain enabled for:

- single/non-matchup events
- NFL RedZone featured broadcast card

Those cards do not have an away/home ordering conflict.

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 24
