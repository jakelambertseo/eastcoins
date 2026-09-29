EastCoin — Launch Hardening Iteration 40
=========================================

This bundle is intentionally larger than a normal UI patch because the audit
found that the prior Picks iteration only partially applied. GitHub shows the
previous commit changed picks.html and eastcoins-picks.css only; the JavaScript,
backend bootstrap and router portions did not land.

THIS PASS COMPLETES AND HARDENS:

LOGIN RETURN
------------
- Twitch login now returns to the exact page/route/watch URL where login began.
- Applies to the top profile login, Quick Bet confirmation and embedded Picks.
- OAuth returnTo allowance increased from 500 to 1800 characters so legitimate
  event/custom-stream URLs are not discarded.
- auth=success/failed state is surfaced once, then cleaned from the URL.

MULTIVIEW
---------
- + MultiView in the active player stores the EXACT current embed URL/server.
- If an event was previously queued from an Events card, adding it from the
  player upgrades that same slot to the exact server instead of duplicating it.
- Events-card + MultiView continues to queue the event.
- Every successful add presents a branded:
    Stay Here
    Open MultiView
  confirmation.
- MultiView persists eventId/meta for exact URL sources.

PICKS COMPLETION
----------------
- Completes the Community Ledger JS/backend work that did not land previously.
- Real D1 community activity: active bets, wins, losses and refunds.
- Real personal wager/payout/refund history.
- Current OPEN-market pool totals and ticket counts from ACTIVE D1 picks.
- Correct SQL/ISO timestamp parsing.
- Correct ACTIVE -> pending frontend normalization.
- Signed-in member rank from the leaderboard.
- Removes the public wallet column from the Picks leaderboard.
- Production no longer silently becomes fake preview mode if Picks is down.
- Standalone Picks Twitch chat is restored; embedded Picks uses only parent chat.
- Picks gets the full native EastCoin workspace in the persistent shell.

PERFORMANCE / LOADING
---------------------
This is a conservative code-path performance pass, not a risky launch rewrite.

- Persistent Twitch chat iframe is deferred until the first idle window.
  Once loaded, it remains the same persistent iframe.
- If a user has chat disabled, Twitch is not loaded until they actually open it.
- The Picks bootstrap request is cached/in-flight deduped for 15 seconds so the
  shell and Quick Bet don't immediately request identical identity data twice.
- Odds enrichment begins after the event catalog's first paint instead of
  competing with initial content.
- Sicko/featured integration is moved off the critical startup path.
- V2 launch scripts use defer so downloads can proceed in parallel while
  preserving execution order.
- Preconnects added for Streamed, PPV, Twitch and 7TV.
- Team images use lazy loading / async decoding where appropriate.
- Offscreen category/lower sections use content-visibility:auto where supported.

NAMING
------
- Launch-facing "EastCoin V2" / "EASTCOIN V2" wording removed.
- The /v2/ technical URL and internal ECV2/localStorage identifiers are retained
  intentionally to avoid a risky URL/storage migration immediately before launch.
- Historical changelog wording is normalized to EastCoin.

INSTALLER SAFETY
----------------
The installer now:
1. Reads and transforms EVERY existing target file in memory.
2. Validates the expected final markers.
3. Verifies visible launch pages no longer contain "EastCoin V2".
4. ONLY THEN writes any files.

This specifically prevents the partial-application behavior caught in the
previous Picks installer.

FILES UPDATED / CREATED
-----------------------
v2/index.html
v2/assets/js/core.js
v2/assets/js/player.js
v2/assets/js/events.js
v2/assets/js/integrations.js
v2/assets/js/quick-bet.js
v2/assets/js/app.js
v2/assets/js/router.js
v2/assets/js/multiview-handoff.js          NEW
v2/assets/css/workspace.css
v2/assets/css/launch.css                   NEW
assets/eastcoins-multiview.js
assets/eastcoins-picks.js
picks.html
functions/api/picks/bootstrap.js
functions/api/picks/auth/twitch/start.js
functions/api/picks/auth/twitch/callback.js
changelog.html
