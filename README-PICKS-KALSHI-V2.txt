EastCoin Kalshi Test — V2 Connectivity Fix
=============================================

PROBLEM
-------
/api/picks-kalshi/health returned HTTP 502 even though Kalshi's documented
public production endpoint is currently reachable outside the EastCoin
Cloudflare Function.

FIX
---
EastCoin now tries two Kalshi public API hostnames in order:

1. https://external-api.kalshi.com/trade-api/v2
   - current hostname shown in Kalshi's official API docs

2. https://api.elections.kalshi.com/trade-api/v2
   - still-live compatible hostname used as a fallback

The fallback is used for:
- health
- catalog
- fresh quote lookup

No API key is required.

NEW DIAGNOSTIC
--------------
https://eastcoin.vip/api/picks-kalshi/provider-check

It returns HTTP 200 even if Kalshi fails, so you can inspect the JSON.

TEST ORDER
----------
1.
https://eastcoin.vip/api/picks-kalshi/health

Expected if either hostname works:

{
  "ok": true,
  "providerReachable": true,
  "providerHost": "..."
}

2.
https://eastcoin.vip/api/picks-kalshi/provider-check

This checks:
- /events?limit=1
- /exchange/status

and shows which hostname worked plus any prior fallback failure.

3.
https://eastcoin.vip/api/picks-kalshi/catalog

Expected:
ok = true
selection.returned = 10 (normally)

4.
https://eastcoin.vip/picks-kalshi-test.html

FILES
-----
functions/api/picks-kalshi/_kalshi.js
functions/api/picks-kalshi/health.js
functions/api/picks-kalshi/provider-check.js
functions/api/picks-kalshi/catalog.js
functions/api/picks-kalshi/quote.js
tools/apply-picks-kalshi-v2-changelog.cjs
README-PICKS-KALSHI-V2.txt
