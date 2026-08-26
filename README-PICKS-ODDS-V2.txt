EastCoin NFL Odds API Test — V2 Diagnostics Fix
================================================

WHY THIS PATCH EXISTS
---------------------
The first deployed test returned HTTP 502 from:

/api/picks-odds/nfl

and the frontend then incorrectly displayed the normal empty-state message:

"No upcoming NFL games with US h2h consensus odds are currently available."

The 502 means the upstream request failed. It is not a legitimate zero-game
response.

FIXES
-----
1. Removed commenceTimeFrom from the upstream /odds request.

   The provider already returns live + upcoming games. EastCoin already filters
   every response locally to:

   commence_time > current time

   so the provider-side timestamp parameter is unnecessary.

2. Bumped the internal edge cache version from v1 to v2.

3. Added safe upstream diagnostics.

   /api/picks-odds/nfl now returns:
   providerStatus
   providerCode
   providerMessage

   when The Odds API rejects a request.

   It never returns ODDS_API_KEY.

4. Added:

   /api/picks-odds/provider-check

   This calls The Odds API /v4/sports endpoint, which does not consume quota,
   and verifies:
   - configured API key is accepted
   - provider is reachable
   - americanfootball_nfl is currently listed
   - NFL active status

5. Fixed the frontend error-state race.

   A failed odds request remains visibly an ERROR and can no longer be
   overwritten by the normal "no upcoming games" empty state.

TEST ORDER
----------
After deploying, open these in order:

1.
https://eastcoin.vip/api/picks-odds/provider-check

If successful:
ok = true
keyConfigured = true
providerReachable = true
nfl.active = true

If the key is invalid, the endpoint will safely show a providerCode such as:
INVALID_KEY
DEACTIVATED_KEY
etc.

2.
https://eastcoin.vip/api/picks-odds/nfl

If successful:
ok = true
diagnostics.upstreamGameCount > 0
diagnostics.consensusGameCount > 0
games = [...]

If it still fails, copy the JSON response. The providerCode/providerMessage
should now identify the exact upstream problem.

3.
https://eastcoin.vip/picks-odds-test.html

The UI will either show real NFL markets or an explicit provider error.

FILES
-----
picks-odds-test.html
assets/eastcoins-picks-odds-test.js
functions/api/picks-odds/nfl.js
functions/api/picks-odds/provider-check.js
tools/apply-picks-odds-v2-changelog.cjs
README-PICKS-ODDS-V2.txt
