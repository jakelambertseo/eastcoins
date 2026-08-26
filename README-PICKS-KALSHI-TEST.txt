EastCoin Picks — Kalshi 10-Market Non-Sports Test
================================================

ROUTE
-----
https://eastcoin.vip/picks-kalshi-test.html

THIS IS AN ISOLATED TEST
------------------------
It does not modify:
- /picks.html
- /picks-odds-test.html
- StreamElements
- the production Picks ledger

No Kalshi API key is required.

PUBLIC KALSHI DATA
------------------
Catalog:
GET https://external-api.kalshi.com/trade-api/v2/events
    ?status=open
    &limit=200
    &with_nested_markets=true

Fresh quote:
GET https://external-api.kalshi.com/trade-api/v2/markets/{ticker}

EastCoin routes:
GET /api/picks-kalshi/health
GET /api/picks-kalshi/catalog
GET /api/picks-kalshi/quote?ticker=...

MARKET SELECTION
----------------
EastCoin:
1. loads open events
2. excludes category Sports
3. requires an open representative market with valid YES and NO asks
4. ranks representative markets by liquidity / volume activity
5. first selects the strongest market from distinct categories
6. fills any remaining slots with the next strongest non-sports markets
7. returns at most 10

The exact 10 markets therefore change as Kalshi changes.

PRICING
-------
EastCoin uses the executable ask for the selected side.

YES:
price = yes_ask_dollars

NO:
price = no_ask_dollars

Example:
YES ask = $0.40

decimal return:
1 / 0.40 = 2.50x

equivalent American odds:
+150

10 Test ZCoins:
floor(10 × 2.50) = 25 returned
15 profit

The ask is a tradable-side price, not a no-vig probability estimate.

BROWSE CACHE
------------
Catalog data:
30-second Cloudflare edge cache.

LOCK QUOTE
----------
When the user clicks Check & Lock Test Pick:

1. EastCoin fetches /api/picks-kalshi/quote?ticker=...
2. The backend fetches that exact market from Kalshi with no EastCoin cache.
3. EastCoin verifies the market remains open.
4. EastCoin gets the current YES or NO ask.
5. If the ask changed by at least half a cent from the displayed quote:
   - the slip updates
   - the Pick is NOT placed
   - the user must click Lock again
6. If unchanged, the test Pick locks at that price.

TEST WALLET
-----------
Twitch-authenticated users get:
1,000 local Test ZCoins.

Limits:
minimum: 1
personal max: floor(wallet × 15%)
hard max: 50
final max: min(wallet, personal max, 50)

Wallet and Picks are kept in localStorage, keyed by Twitch ID.

No real ZCoins are moved.

FILES
-----
picks-kalshi-test.html
assets/eastcoins-picks-kalshi-test.css
assets/eastcoins-picks-kalshi-test.js
functions/api/picks-kalshi/catalog.js
functions/api/picks-kalshi/quote.js
functions/api/picks-kalshi/health.js
tools/apply-picks-kalshi-test-changelog.cjs
README-PICKS-KALSHI-TEST.txt

SETUP
-----
1. Extract the package into the EastCoin repository root.

2. No Cloudflare variable or secret is needed.

3. Run:
   node tools\apply-picks-kalshi-test-changelog.cjs

4. Commit and push.

5. After Cloudflare deploys, test:
   https://eastcoin.vip/api/picks-kalshi/health

6. Then:
   https://eastcoin.vip/api/picks-kalshi/catalog

7. Then:
   https://eastcoin.vip/picks-kalshi-test.html

SUCCESS
-------
Health:
ok = true

Catalog:
ok = true
selection.returned should normally equal 10
markets should contain non-Sports categories only

Page:
10 current Kalshi markets appear
Twitch login works
YES / NO slips work
price moves require review
local test wallet decreases on lock
My Test Picks shows the locked price
