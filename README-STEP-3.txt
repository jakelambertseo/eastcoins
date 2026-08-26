EastCoin Picks — Step 3: Cloudflare D1
======================================

GOAL
----
Create the production D1 database, expose it to Pages Functions as PICKS_DB,
and prove EastCoin can execute a SQL query against it.

This step intentionally does NOT create any Picks tables yet.
That is Step 4.

FILES IN THIS STEP
------------------
functions/api/picks/db-health.js
tools/setup-picks-d1.cjs
README-STEP-3.txt

1. COPY THE ZIP INTO THE REPO ROOT
----------------------------------
After copying, you should have:

eastcoins/
  functions/
    api/
      picks/
        db-health.js

  tools/
    setup-picks-d1.cjs

  README-STEP-3.txt

2. RUN THE D1 SETUP SCRIPT
--------------------------
From the EastCoin repository root:

node tools\setup-picks-d1.cjs

The script:
- uses the latest Wrangler through npx
- checks Cloudflare authentication
- opens Wrangler's device login flow if necessary
- checks whether "eastcoin-picks" already exists
- creates it only if it does not exist
- prints the D1 database ID
- does NOT create duplicate databases if rerun

3. ADD THE CLOUDFLARE PAGES BINDING
-----------------------------------
This is the one manual dashboard action in Step 3.

Cloudflare:
Workers & Pages
> EastCoin Pages project
> Settings
> Bindings
> Add
> D1 database

Variable name:
PICKS_DB

Database:
eastcoin-picks

If Cloudflare exposes separate Production and Preview bindings, add the same
PICKS_DB binding to both.

Why this is manual:
We are deliberately NOT introducing a root wrangler.jsonc yet. Cloudflare
documents that a Pages Wrangler config becomes the configuration source of
truth. EastCoin already has production configuration in the dashboard, so
switching configuration ownership just to add one binding is unnecessary risk.

4. PUSH THE STEP 3 FILES
------------------------
The push after saving the binding triggers a fresh Pages deployment so the
new binding is available to the Function.

5. TEST
-------
Open:

https://eastcoin.vip/api/picks/db-health

EXPECTED SUCCESS:

{
  "ok": true,
  "service": "eastcoin-picks",
  "database": "eastcoin-picks",
  "binding": "PICKS_DB",
  "status": "connected",
  "query": {
    "connected": 1,
    "database_time": "..."
  },
  "message": "EastCoin Picks can query Cloudflare D1 successfully."
}

If you instead see:

PICKS_DB_BINDING_MISSING

the database exists but the Pages binding has not reached the deployment yet.

If you see:

PICKS_DB_QUERY_FAILED

the binding exists, but D1 rejected the SELECT test.

STEP 3 IS COMPLETE WHEN
-----------------------
/api/picks/db-health returns:

"ok": true
"status": "connected"

Then we stop and move to Step 4: the real versioned D1 schema/migration.


VS CODE NOTE
------------
The VS Code integrated terminal is fully supported.

This V2 setup script uses:

npx wrangler@latest login --device

instead of the older default browser callback login.

The device flow does not depend on localhost:8976. Wrangler prints a short
authorization code and opens Cloudflare so you can approve the login.

If the automated login still fails, run these two commands directly in the
VS Code terminal:

npx wrangler@latest login --device
npx wrangler@latest whoami

Once "whoami" shows your Cloudflare account, rerun:

node tools\setup-picks-d1.cjs


V3 LOGIN FIX
------------
This version does not call `wrangler login` and does not try to detect whether
you are logged in.

You already verified Wrangler authentication manually with:

npx wrangler@latest whoami

So the setup utility trusts the existing Wrangler session and goes directly to:

npx wrangler@latest d1 info eastcoin-picks --json

and, only if necessary:

npx wrangler@latest d1 create eastcoin-picks

This avoids repeated OAuth/device authorization prompts caused by the previous
script's login detection.
