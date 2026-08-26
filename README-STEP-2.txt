EastCoin Picks — Step 2: Cloudflare Pages Functions
===================================================

PURPOSE
-------
This step only proves that EastCoin's /api/picks/* routes can execute
server-side code through Cloudflare Pages Functions.

It does NOT:
- create a D1 database
- use Twitch OAuth
- use Twitch secrets
- read or change StreamElements ZCoins
- place real wagers
- settle real markets

WHAT TO COPY
------------
Copy the entire "functions" folder into the ROOT of the EastCoin repository.

Correct:

eastcoins/
  index.html
  picks.html
  assets/
  functions/
    api/
      picks/
        health.js
        bootstrap.js
        wagers.js
        auth/
        admin/

Wrong:

eastcoins/
  some-folder/
    functions/

Cloudflare Pages expects the Functions folder at the project root.

TEST ROUTE
----------
After Cloudflare finishes deploying the Git commit, open:

https://eastcoin.vip/api/picks/health

Expected result:

{
  "ok": true,
  "service": "eastcoin-picks",
  "layer": "cloudflare-pages-functions",
  "status": "ready",
  "message": "EastCoin Picks server-side API is reachable.",
  ...
}

OTHER ROUTES
------------
The rest of the routes are intentionally safe stubs right now:

GET  /api/picks/bootstrap
POST /api/picks/wagers
GET  /api/picks/auth/twitch/start
GET  /api/picks/auth/twitch/callback
POST /api/picks/auth/logout
GET  /api/picks/admin/markets
POST /api/picks/admin/markets/:marketId/settle

Most return HTTP 503 with an explicit "not ready" code. That is intentional.

The production /picks.html frontend already treats a failed bootstrap request as
"backend not connected yet" and falls back to its Frontend Preview, so adding
these Functions should NOT suddenly enable real wagering.

SUCCESS CRITERIA FOR STEP 2
---------------------------
1. Git push succeeds.
2. Cloudflare Pages deployment succeeds.
3. https://eastcoin.vip/api/picks/health returns JSON with:
   "ok": true
4. /picks.html still loads normally.
5. /picks-admin.html remains non-functional for real settlement.

Once those are true, Step 2 is complete and Step 3 is creating/binding D1.
