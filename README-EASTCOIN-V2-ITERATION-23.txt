EastCoin V2 — Iteration 23 — NFL RedZone Featured Card
===========================================================

BASE
----
V2 Modular Baseline — Iteration 22

FEATURE
-------
NFL RedZone is now treated as a special featured broadcast surface.

DETECTION
---------
EastCoin looks for RedZone variations across:

- title
- name
- category
- sport
- league
- network
- channel
- broadcast/broadcaster
- station / TV metadata
- PPV provider network/channel metadata

Examples recognized:

NFL RedZone
NFL Red Zone
RedZone
Red Zone
NFL RedZone Sunday
NFL Network Red Zone

PLACEMENT
---------
Any matching RedZone event is classified as Football even if the upstream
provider gives it generic/other metadata.

Inside Football, RedZone is always rendered before normal games regardless of:

- Recommended sort
- Time sort

This also guarantees it remains inside the first 16 cards when the Football
category is collapsed.

VISUAL TREATMENT
----------------
On desktop, the RedZone card:

- spans two event-card columns
- uses a deep-red broadcast background
- has a glowing/pulsing red border
- has a subtle animated sweep
- shows an NFL REDZONE ribbon
- uses a prominent RZ mark
- has a dedicated Watch RedZone action

On small mobile screens it returns to one column.

Accessibility:
prefers-reduced-motion disables all RedZone animations.

ACTIONS
-------
RedZone is a broadcast hub, not one team-vs-team market.

It therefore intentionally shows:

- Favorite
- MultiView
- Watch RedZone / Open RedZone

It intentionally does NOT show:

- Bet
- Bets Closed

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 23
