EastCoin V2 — Iteration 38 — MultiView Workspace Repair
==========================================================

WHAT THIS FIXES
---------------
The V2 MultiView route was still mounting the standalone legacy MultiView page.
V2's router hid the old sidebar visually, but the standalone MultiView CSS and
JavaScript still reserved/managed its old sidebar and chat layout. That could
crush the actual grid into a tiny strip inside the V2 workspace.

THIS UPDATE
-----------
- Makes ecV2Embedded=1 a real MultiView document mode before first paint.
- Completely removes the legacy/standalone left-nav column from V2 layout math.
- Keeps the old left navigation intact only for standalone multiview.html.
- Prevents MultiView from mounting or reserving its second Twitch chat inside V2.
- Uses the existing persistent V2 Twitch chat only.
- Expands the MultiView grid to the full V2 workspace width and height.
- Removes the redundant V2 "EASTCOIN V2 / MultiView" workspace bar.
- Keeps 2 / 3 / 4 panel layout controls, panel resizing, drag/drop, source picker,
  focus mode, clear-all, and hidden-controls behavior.
- V2 Solo now opens the selected MultiView source in the native V2 player overlay
  instead of navigating the child iframe into an old EastCoin page.
- Standalone MultiView continues to retain its original navigation/chat shell.
- Adds the update to changelog.html.

FILES CHANGED
-------------
multiview.html
assets/eastcoins-multiview.css
assets/eastcoins-multiview.js
v2/assets/js/router.js
v2/assets/css/workspace.css
v2/index.html
changelog.html
