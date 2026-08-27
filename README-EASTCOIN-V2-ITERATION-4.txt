EastCoin V2 — Iteration 4
==========================

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 4

SCOPE
-----
V2 Homepage / Chat / Top Nav Bar

CHANGES
-------
TOP NAV
- Removed the logo tagline entirely.
- Removed Games from the top navigation.
- Removed the old top-nav More dropdown and every link under it.
- Added a money-bag emoji to Picks.
- Kept the existing HOT badge markup/behavior on Picks.
- Top navigation is now:
  Events | MultiView | 💰 Picks

SEARCH
- Placeholder is now:
  Games, teams or paste a URL
- Normal text still searches the event catalog.
- Pressing Enter on a valid http/https URL opens it in the existing V2 custom player.

SPORT CATEGORY BAR
Visible:
- All
- Live
- Football
- Baseball
- UFC
- Soccer
- Basketball
- More

More dropdown:
- Hockey
- Tennis
- Others

"Others" groups the secondary families that are not individually exposed right now,
including wrestling, motorsport, golf and otherwise uncategorized events.

PERSISTENT CHAT — LOCKED V2 BEHAVIOR
------------------------------------
Twitch chat is now a permanent part of the V2 shell.

- It is open automatically.
- There is no close button.
- Escape does not close it.
- The header chat icon only calls attention to the already-open chat.
- Desktop/tablet: fixed dock on the right.
- Small screens: fixed dock across the bottom.

MOST IMPORTANTLY:
The same #persistentTwitchChat iframe remains mounted when switching between V2
pages through the V2 router. It is not recreated and its src is not reassigned.

This behavior is now LOCKED for future V2 work.

PERSISTENT PAGE NAVIGATION
--------------------------
Iteration 4 adds:

v2/assets/js/router.js
v2/assets/css/workspace.css

The V2 outer shell remains loaded while page content changes in the workspace.
Current bridge routes:

Events       -> native V2 homepage
MultiView    -> existing multiview.html inside V2 workspace
Picks        -> existing picks.html inside V2 workspace
Games        -> existing games.html when launched from Quick Launch
Other Streams-> existing favorites.html when launched from Quick Launch
Sicko Prop   -> existing Kalshi test page from the weekly callout

This is a transitional bridge while those products are rebuilt as native V2 views.
It avoids reloading the outer V2 shell and therefore prevents Twitch chat from
refreshing during normal V2 page navigation.

The router also attempts to hide duplicate legacy sidebar/chat chrome inside
same-origin embedded pages. This is intentionally isolated to the workspace and
does not modify those production pages.

FILES IN THIS UPDATE
--------------------
v2/index.html
v2/assets/css/shell.css
v2/assets/css/overlays.css
v2/assets/css/responsive.css
v2/assets/css/workspace.css          NEW
v2/assets/js/core.js
v2/assets/js/player.js
v2/assets/js/events.js
v2/assets/js/integrations.js
v2/assets/js/router.js               NEW
v2/assets/js/app.js
tools/apply-eastcoin-v2-iteration-4-changelog.cjs
README-EASTCOIN-V2-ITERATION-4.txt

UNCHANGED V2 MODULES
--------------------
v2/assets/css/tokens.css
v2/assets/css/home.css

INSTALL
-------
Extract this update ZIP into the EastCoin repo root and overwrite the included files.

Then run:
node tools\\apply-eastcoin-v2-iteration-4-changelog.cjs

TEST
----
1. Open /v2/
2. Confirm chat is already visible with no close button.
3. Send/scroll chat if desired.
4. Click MultiView, then Picks, then Events.
5. Confirm the Twitch chat iframe does not visibly reload between those switches.
6. Confirm top nav is Events | MultiView | 💰 Picks and HOT remains on Picks.
7. Confirm no logo tagline.
8. Confirm search placeholder text.
9. Confirm sports bar only exposes the requested sports plus More.
10. Open More and verify Hockey / Tennis / Others.
