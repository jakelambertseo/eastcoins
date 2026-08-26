EastCoin Picks — Step 5: Twitch Application Registration
=========================================================

GOAL
----
Register the production EastCoin Picks application with Twitch and store the
application credentials only in Cloudflare Pages server-side configuration.

This step DOES NOT implement real Twitch login yet.

It prepares the three server-side values that Step 6 will use:
TWITCH_CLIENT_ID
TWITCH_CLIENT_SECRET
TWITCH_REDIRECT_URI

PRODUCTION CALLBACK
-------------------
Use this exact OAuth Redirect URL in the Twitch Developer Console:

https://eastcoin.vip/api/picks/auth/twitch/callback

Do not substitute www.eastcoin.vip and do not add a trailing slash.

TWITCH APP
----------
Recommended application name:
EastCoin Picks

Twitch application names must be unique. If that exact name is unavailable,
use a clear unique variation such as:
EastCoin Picks - EastCoin

Use the website/integration category that most closely matches the app.

After creating the app:
1. Open Manage.
2. Copy the Client ID.
3. Generate a New Secret.
4. Copy the Client Secret immediately and keep it private.

IMPORTANT:
Never put the Client Secret in:
- GitHub
- source code
- README files
- screenshots
- ChatGPT
- Discord
- frontend JavaScript

CLOUDFLARE PAGES
----------------
Go to the EastCoin Pages project:
Settings > Variables and Secrets

Configure the PRODUCTION environment:

TWITCH_CLIENT_ID
Value: the Client ID from Twitch
Can be plain text or encrypted; encrypted is fine.

TWITCH_CLIENT_SECRET
Value: the Client Secret from Twitch
MUST be encrypted / Secret.

TWITCH_REDIRECT_URI
Value:
https://eastcoin.vip/api/picks/auth/twitch/callback
Plain text is fine.

For Step 5, Production is sufficient. We do not need to expose the production
Twitch secret to Preview deployments.

FILES
-----
functions/api/picks/auth/twitch/config-health.js
  Reports only whether required settings exist and whether the redirect URI
  matches. It never returns the Client ID or Client Secret.

tools/apply-picks-step-5.cjs
  Adds Cloudflare-recommended local secret patterns to .gitignore and appends
  the Step 5 changelog entry.

README-STEP-5.txt
  This guide.

REPOSITORY SECRET SAFETY
------------------------
Cloudflare recommends that local .dev.vars and .env files not be committed.

The Step 5 patcher adds:

.dev.vars*
.env*

to the existing .gitignore.

RUN AFTER TWITCH + CLOUDFLARE ARE CONFIGURED
--------------------------------------------
node tools\apply-picks-step-5.cjs

Then commit/push the Step 5 files and the two patched existing files.

TEST AFTER CLOUDFLARE DEPLOYS
-----------------------------
Open:

https://eastcoin.vip/api/picks/auth/twitch/config-health

Expected:

{
  "ok": true,
  "service": "eastcoin-picks",
  "integration": "twitch",
  "flow": "authorization_code",
  "configuration": {
    "clientIdConfigured": true,
    "clientSecretConfigured": true,
    "redirectUriConfigured": true,
    "redirectUriMatches": true,
    "expectedRedirectUri":
      "https://eastcoin.vip/api/picks/auth/twitch/callback"
  },
  "status": "configured"
}

The endpoint deliberately never exposes either credential.

STEP 5 IS COMPLETE WHEN
-----------------------
1. Twitch shows the EastCoin Picks application.
2. The production callback is registered exactly.
3. Cloudflare Production contains all three values.
4. TWITCH_CLIENT_SECRET is encrypted.
5. The Step 5 Git push deploys.
6. /api/picks/auth/twitch/config-health returns:
   "ok": true
   "status": "configured"

Then stop. Step 6 will implement the actual OAuth Authorization Code flow,
Twitch user lookup, D1 user upsert, and secure EastCoin session.
