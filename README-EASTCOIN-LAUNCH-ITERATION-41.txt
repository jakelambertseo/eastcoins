EastCoin — Root Launch / Iteration 41
=====================================

IMPORTANT
---------
This ZIP SUPERSEDES Iteration 40.

GitHub main is still at the partial Picks commit, so APPLY-ITERATION-41.cmd runs:
1. the corrected launch-hardening Iteration 40 prerequisite
2. the new root-domain / Picks / Gameday / MultiView / search fixes

You do NOT need to apply the previous ZIP first.

ROOT-DOMAIN LAUNCH
------------------
- The production EastCoin application now lives at:
    https://eastcoin.vip/
- The old /v2/ page becomes a compatibility redirect to / while preserving
  query strings and hashes.
- Event watch links are generated from / instead of /v2/.
- Router workspace URLs use root-absolute pages:
    /multiview.html
    /picks.html
    /games.html
    /favorites.html
- Old root ?event= and ?watch= links continue to open directly in the new player.
- Existing internal assets remain under /v2/assets/ to avoid a risky pre-launch
  file migration. Users do not navigate to /v2/.
- Twitch OAuth return-to-page logic from Iteration 40 automatically works with
  the root URL because it captures the current pathname/query/hash.

PICKS — HOW PICKS WORK POPUP
----------------------------
The explainer now accurately separates two different things:

1. REAL SPORTSBOOK REFERENCE ODDS
   - supported games are matched to The Odds API
   - EastCoin shows current consensus/reference moneyline information
   - those prices can move before game time

2. EASTCOIN ZCOIN PAYOUT
   - the sportsbook ML does NOT directly determine the ZCoin return
   - Picks uses the community pool / pari-mutuel multiplier
   - projected multiplier = total ZCoins in game / ZCoins on selected side
   - example included in the popup
   - the community multiplier locks at game start
   - one-sided markets are No Action / refunded
   - 1 ZCoin minimum and lower of 15% wallet or 50 ZCoin maximum
   - one confirmed side per game
   - Community Ledger / My Picks / History transparency is documented

MLB GAMEDAY
-----------
- Restores a "⚾ Gameday" button to the NEW EastCoin event-player controls.
- Button only appears after an MLB matchup is verified against MLB Stats API.
- Reuses the existing /mlb-gameday.html EastCoin Game Center.
- MLB matching uses both teams plus the event date and requires a strong match,
  which protects non-MLB baseball cards from receiving the button.
- Gameday opens over the video area and leaves persistent Twitch chat intact.
- Esc or the close button returns to the stream without reloading it.

MULTIVIEW CLEANUP
-----------------
- MultiView panels still use player.html internally to resolve event streams.
- ?multiview=1 now marks those child players explicitly.
- The old V1 player toolbar, utility dock, server panel, copy tooltip and legacy
  MLB Gameday UI are hidden inside MultiView panels.
- The actual parent MultiView source/layout controls remain unchanged.
- The old Gameday resolver is disabled inside MultiView to avoid unnecessary
  MLB API work for hidden legacy controls.

SEARCH FIX
----------
- While an event is open, typing a normal game/team search and pressing Enter:
    1. closes the event player
    2. returns to Events
    3. switches to the 7-day search scope
    4. applies the entered search immediately
- Pasting a valid http/https URL and pressing Enter still opens it as a custom
  stream instead of treating it as text search.

INCLUDED ITERATION 40 FIXES
---------------------------
- Twitch login returns to the exact page/route/watch URL where it started.
- Active-player + MultiView stores the exact currently playing server/video.
- MultiView add confirmation offers Stay Here / Open MultiView.
- Completes the real D1 Community Ledger/history/current-pool Picks backend work.
- Removes public wallet balances from the Picks leaderboard.
- Corrects Picks ACTIVE statuses and ISO timestamps.
- Prevents production from silently becoming fake preview data.
- Delays persistent Twitch chat / non-critical enrichment off first paint.
- Deduplicates Picks identity bootstrap calls.
- Adds launch preconnect/lazy rendering improvements.
- Removes visible EastCoin V2 product naming.

INSTALLER SAFETY
----------------
APPLY-ITERATION-41.cmd uses an atomic wrapper around both installer stages.
It snapshots every file touched by Iterations 40 and 41 before starting. Each
stage still performs its own preflight; if either stage fails, the wrapper
restores the complete pre-install filesystem state and removes newly-created
launch files. This prevents a partial Iteration 40/41 application.

MAIN FILES TO EXPECT IN git status
----------------------------------
index.html
v2/index.html
picks.html
player.html
changelog.html
assets/eastcoins-embedded-view.css
assets/eastcoins-mlb-gameday.js
assets/eastcoins-multiview.js
assets/eastcoins-picks.css
assets/eastcoins-picks.js
functions/api/picks/bootstrap.js
functions/api/picks/auth/twitch/start.js
functions/api/picks/auth/twitch/callback.js
v2/assets/css/launch.css
v2/assets/css/workspace.css
v2/assets/js/app.js
v2/assets/js/core.js
v2/assets/js/events.js
v2/assets/js/integrations.js
v2/assets/js/mlb-gameday.js
v2/assets/js/multiview-handoff.js
v2/assets/js/player.js
v2/assets/js/quick-bet.js
v2/assets/js/router.js

RECOMMENDED LAUNCH SMOKE TEST
-----------------------------
- eastcoin.vip/ loads Events directly with no /v2/ in the address bar
- old /v2/?event=... link forwards to /?event=...
- open a game, Copy Link, confirm copied URL starts at /
- type a team while watching and press Enter
- MLB game shows Gameday; non-MLB baseball does not
- Gameday opens/closes without replacing the stream
- + MultiView from an active non-default server -> Open MultiView -> exact stream
- MultiView panels do not show the old nested toolbar
- Picks -> How Picks Work wording matches the live reference odds + pool payout
- login from Events, Picks and an active watch URL returns to the same place

CORRECTION
----------
This corrected bundle fixes the Iteration 41 Windows checkout matcher for player.html and the legacy MLB Gameday guard. The previous bundle could fail on CRLF line endings and correctly rolled back without changing tracked files.
