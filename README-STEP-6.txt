EastCoin Picks — Step 6: Real Twitch Login
==============================================

GOAL
----
Make Twitch identity real.

This step implements:

Continue with Twitch
        ↓
/api/picks/auth/twitch/start
        ↓
Twitch authorization for EastCoinBot
        ↓
/api/picks/auth/twitch/callback
        ↓
server-side authorization-code exchange
        ↓
Twitch Helix Get Users
        ↓
D1 users upsert
        ↓
secure EastCoin session
        ↓
/picks.html logged in

NO STREAM ELEMENTS YET
----------------------
Step 6 does not:
- read StreamElements balances
- debit ZCoins
- credit ZCoins
- enable wagering
- enable winner settlement

The bootstrap response explicitly returns:
wallet.connected = false
wageringEnabled = false
maxWager = 0

TWITCH PERMISSIONS
------------------
EastCoin requests only:

openid

It does not request:
- email
- chat permissions
- moderator permissions
- broadcaster permissions

The Twitch access/refresh tokens returned during login are not stored in D1
in this phase. The access token is used only to retrieve the Twitch user
identity and is then discarded.

SECURITY
--------
OAuth state:
A cryptographically random value is stored in a temporary Secure + HttpOnly +
SameSite=Lax __Host- cookie and must exactly match Twitch's callback state.

Return URL:
Only same-site root-relative paths are accepted. URLs beginning with // are
rejected, preventing an open redirect.

EastCoin session:
A random 256-bit session token is written to:

__Host-ec_session

with:
- Secure
- HttpOnly
- SameSite=Lax
- Path=/
- 7 day expiry

The raw session token is never stored in D1. Only its SHA-256 hash is stored.

D1 identity:
users.twitch_id remains the stable identity key. Twitch username changes do not
create a new EastCoin account because subsequent logins update the existing row
identified by the numeric Twitch ID.

FILES REPLACED
--------------
functions/api/picks/auth/twitch/start.js
functions/api/picks/auth/twitch/callback.js
functions/api/picks/auth/logout.js
functions/api/picks/bootstrap.js

FILE ADDED
----------
functions/api/picks/auth/session-health.js

TOOL ADDED
----------
tools/apply-picks-step-6-changelog.cjs

NO DATABASE MIGRATION
---------------------
Step 4 already created everything Step 6 needs:

users
sessions

No schema change is required.

BEHAVIOR CHANGE ON /picks.html
------------------------------
Before Step 6, /api/picks/bootstrap intentionally returned HTTP 503, causing
/picks.html to use Frontend Preview mode.

After Step 6, bootstrap returns a real backend response even when logged out.

That means:
- Continue with Twitch uses the real EastCoinBot OAuth flow
- preview/mock login is no longer used
- wallet is shown as not connected
- no fake ZCoin balance is authoritative
- D1 markets are shown (currently likely zero until market ingestion is built)

This is intentional. Step 6 moves Picks from prototype identity into real
production identity.

DEPLOY
------
Copy this package into the repo root and overwrite the four existing Function
files.

Then run:

node tools\apply-picks-step-6-changelog.cjs

Commit and push the Step 6 files.

TEST 1 — LOGGED OUT
-------------------
Open:

https://eastcoin.vip/api/picks/auth/session-health

Expected:

{
  "ok": true,
  "authenticated": false,
  "user": null
}

TEST 2 — TWITCH LOGIN
---------------------
Open:

https://eastcoin.vip/picks.html

Click Continue with Twitch.

Expected:
1. Browser leaves EastCoin for Twitch.
2. Twitch identifies the application as EastCoinBot.
3. Approve the authorization.
4. Twitch returns to:
   /api/picks/auth/twitch/callback
5. EastCoin redirects to:
   /picks.html?auth=success
6. Picks now shows your real Twitch display name.

TEST 3 — SESSION
----------------
Open:

https://eastcoin.vip/api/picks/auth/session-health

Expected:

{
  "ok": true,
  "authenticated": true,
  "user": {
    "id": "...",
    "login": "...",
    "displayName": "...",
    "profileImageUrl": "..."
  },
  "session": {
    "expiresAt": "..."
  }
}

The endpoint never returns the raw session token or its database hash.

TEST 4 — D1 USER
----------------
From the VS Code terminal:

npx wrangler@latest d1 execute eastcoin-picks --remote --config wrangler.picks-migrations.jsonc --command "SELECT twitch_id,twitch_login,display_name,avatar_url,last_login_at FROM users ORDER BY last_login_at DESC LIMIT 10;"

You should see the Twitch account that just logged in.

TEST 5 — BOOTSTRAP
------------------
Open:

https://eastcoin.vip/api/picks/bootstrap

Expected:
session.authenticated = true
session.user = your Twitch account
session.wallet.connected = false
config.wageringEnabled = false

TEST 6 — LOGOUT
---------------
Use the Logout button on /picks.html.

Then reload:

https://eastcoin.vip/api/picks/auth/session-health

Expected:
authenticated = false

STEP 6 IS COMPLETE WHEN
-----------------------
1. Twitch authorization opens from /picks.html.
2. Twitch returns to EastCoin successfully.
3. D1 contains the Twitch user.
4. session-health reports authenticated=true.
5. /bootstrap recognizes the same user.
6. Logout ends the session.
7. No ZCoins are read or moved.

Then stop.

The next phase should validate/admin-gate the settlement console and/or begin
the StreamElements wallet proof-of-concept, depending on the agreed roadmap.
