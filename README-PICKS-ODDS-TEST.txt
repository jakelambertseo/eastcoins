EastCoin — NFL Odds API Picks Test
===================================

ROUTE
-----
https://eastcoin.vip/picks-odds-test.html

This is intentionally separate from:
https://eastcoin.vip/picks.html

PURPOSE
-------
Test sportsbook-style fixed payouts using real upcoming NFL head-to-head
moneylines without touching the existing community/parimutuel Picks prototype.

PROVIDER
--------
The Odds API V4

Sport:
americanfootball_nfl

Region:
us

Market:
h2h

Odds format:
american

Upcoming only:
yes

SERVER ROUTES
-------------
GET /api/picks-odds/health
GET /api/picks-odds/nfl

API KEY
-------
The API key is NEVER included in browser JavaScript or HTML.

Create this Cloudflare Pages Production secret:

ODDS_API_KEY

Paste your active The Odds API key directly into Cloudflare and mark it
encrypted/Secret.

Because the original key was previously shared outside Cloudflare, rotating it
before broader testing is recommended.

60-SECOND CACHE
---------------
The Cloudflare Function uses caches.default with a 60-second TTL.

The browser itself receives Cache-Control: no-store, so pressing Refresh Odds
always checks the EastCoin Function. If a current server edge snapshot exists,
the Function returns it rather than consuming another provider request.

The UI shows:
- odds snapshot age
- cache HIT/MISS
- API credits remaining
- API credits used
- cost of the last upstream request

CONSENSUS ALGORITHM
-------------------
EastCoin does NOT average raw American moneylines directly.

For each bookmaker:

1. Convert the away and home American prices to implied probabilities.

For positive American odds +A:

p = 100 / (A + 100)

For negative American odds -A:

p = A / (A + 100)

where A is the absolute value.

2. Remove that book's vig.

fair_home = raw_home / (raw_home + raw_away)

fair_away = raw_away / (raw_home + raw_away)

3. Take the median fair_home across all eligible US books.

4. Take the median fair_away across all eligible US books.

5. Re-normalize those two medians to total 1.0.

6. Convert the final fair probabilities back into American odds.

This produces the fixed EastCoin consensus line.

FIXED PAYOUT
------------
Positive odds +A:

decimal multiplier = 1 + A / 100

total return = floor(wager × decimal multiplier)

profit = total return - wager


Negative odds -A:

decimal multiplier = 1 + 100 / A

where A is the absolute value.

total return = floor(wager × decimal multiplier)

profit = total return - wager

Example:

+150
10 ZCoin wager
decimal = 2.50
return = 25
profit = 15

-200
10 ZCoin wager
decimal = 1.50
return = 15
profit = 5

TEST WALLET
-----------
This test DOES NOT connect to StreamElements.

After Twitch login, each browser/Twitch ID combination starts with:

1,000 Test ZCoins

Wager rules match the current EastCoin economy prototype:

minimum = 1
personal max = floor(test wallet × 15%)
hard max = 50

final max = min(wallet, personal max, 50)

Test wallet and Picks are stored in localStorage and can be reset from the left
navigation.

ODDS LOCK
---------
When Lock Test Pick is clicked:

1. EastCoin requests the latest server odds snapshot again.
2. The 60-second server cache prevents excessive provider requests.
3. EastCoin checks that kickoff has not arrived.
4. EastCoin checks that the user has not already picked that game.
5. The current consensus American moneyline is stored with the local Pick.
6. The projected payout is frozen from that line.

This is a frontend/local test. A real-money or real-ZCoin implementation would
perform the authoritative quote lock and wager write server-side in one
controlled backend workflow.

KICKOFF RULE
------------
The upstream API request uses commenceTimeFrom=current time.

The Function also filters returned games to commence_time > current time.

The browser independently disables Picks once commence_time <= current time.

This test therefore shows upcoming games only and never accepts an in-play Pick.

TWITCH
------
The page uses the existing EastCoin Twitch session:

GET /api/picks/auth/session-health

Login:

GET /api/picks/auth/twitch/start?returnTo=/picks-odds-test.html

Logout:

POST /api/picks/auth/logout

The Odds API test does not require any additional Twitch permissions.

FILES
-----
picks-odds-test.html
assets/eastcoins-picks-odds-test.css
assets/eastcoins-picks-odds-test.js
functions/api/picks-odds/nfl.js
functions/api/picks-odds/health.js
tools/apply-picks-odds-test-changelog.cjs
README-PICKS-ODDS-TEST.txt

NO DATABASE MIGRATION
---------------------
No D1 schema change is required.

No test wagers are written to D1.

SETUP ORDER
-----------
1. Extract this package into the EastCoin repo root.

2. In Cloudflare Pages Production, create encrypted secret:
   ODDS_API_KEY

3. Run:
   node tools\apply-picks-odds-test-changelog.cjs

4. Commit and push the files.

5. Wait for Cloudflare deployment.

6. Test:
   https://eastcoin.vip/api/picks-odds/health

Expected:
   ok = true
   keyConfigured = true

7. Test:
   https://eastcoin.vip/api/picks-odds/nfl

Expected:
   ok = true
   sport.key = americanfootball_nfl
   market = h2h
   games = [...]

8. Open:
   https://eastcoin.vip/picks-odds-test.html

9. Sign in with Twitch and lock local test Picks.

IMPORTANT
---------
Do not place ODDS_API_KEY in:
- picks-odds-test.html
- any assets/*.js file
- GitHub
- README files
- Discord
- screenshots
