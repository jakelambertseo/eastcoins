EastCoin Picks — Step 4: Core D1 Schema
=========================================

GOAL
----
Install the first versioned production database schema in the existing
Cloudflare D1 database "eastcoin-picks".

This step creates the permanent structure only.

It DOES NOT:
- create a Twitch application
- log users in
- seed user accounts
- seed a Picks season
- import Streamed markets
- connect StreamElements
- debit or credit ZCoins
- enable real wagers
- enable real settlement

FILES ADDED
-----------
migrations/0001_picks_core.sql
functions/api/picks/schema-health.js
tools/apply-picks-schema.cmd
tools/apply-picks-step-4-changelog.cjs
README-STEP-4.txt

TABLES CREATED
--------------
1. users
   Stable Twitch identity. Twitch numeric ID is the primary key.
   Login/display/avatar can change without changing the user's identity.

2. sessions
   Stores hashed EastCoin session tokens and expiry metadata.
   Raw browser session tokens should never be stored here.

3. seasons
   Defines the active Picks competition season.
   The schema enforces at most one active season at a time.

4. markets
   Server-owned winner-only events, including teams, start time, lifecycle
   state, locked pools, final multipliers, and settlement result.

5. picks
   One user selection per market.
   UNIQUE(market_id, user_id) enforces one Pick per game at the database level.

6. wallet_operations
   Idempotent audit journal for StreamElements ZCoin debits, payouts, refunds,
   failures, and reconciliation. This is critical because D1 and an external
   wallet cannot participate in one atomic transaction.

7. admin_actions
   Audits winner settlement, Void, No Action, and settlement retries.

8. user_season_stats
   Denormalized season performance used for Picks Profit rankings and profile
   statistics. Raw Picks remain the authoritative history.

IMPORTANT SCHEMA RULES
----------------------
Market states:
OPEN
LOCKED
SETTLING
SETTLED
VOID
NO_ACTION

Pick states:
PENDING_PAYMENT
ACTIVE
WON
LOST
REFUNDED
CANCELLED

Wallet operation states:
PENDING
CONFIRMED
FAILED
NEEDS_RECONCILIATION

Wallet operation amount convention:
WAGER_DEBIT          negative integer
PAYOUT_CREDIT        positive integer
REFUND_CREDIT        positive integer
COMPENSATING_REFUND  positive integer

The database itself validates these signs.

APPLY THE MIGRATION
-------------------
After copying this package into the EastCoin repo root, run from the VS Code
terminal:

tools\apply-picks-schema.cmd

The runner:
1. checks the remote database for unapplied migrations
2. applies migrations/0001_picks_core.sql to eastcoin-picks
3. verifies the eight expected tables
4. confirms no migration remains unapplied

Cloudflare may prompt before applying the migration. Type y and Enter.

D1 tracks applied migrations in its own d1_migrations table. Re-running the
Step 4 runner will not re-run an already-applied migration.

CHANGELOG
---------
Only after the migration succeeds, run:

node tools\apply-picks-step-4-changelog.cjs

This safely adds the Step 4 production-backend entry to changelog.html and is
idempotent if accidentally run twice.

DEPLOY
------
Commit and push the migration, schema-health endpoint, runner, README, and
updated changelog.

After Cloudflare Pages finishes deploying, open:

https://eastcoin.vip/api/picks/schema-health

EXPECTED SUCCESS
----------------
{
  "ok": true,
  "service": "eastcoin-picks",
  "database": "eastcoin-picks",
  "binding": "PICKS_DB",
  "schemaVersion": 1,
  "latestMigration": "0001_picks_core.sql",
  "tables": {
    "expected": 8,
    "present": 8,
    "missing": []
  },
  "status": "ready",
  "message": "EastCoin Picks core D1 schema is installed."
}

STEP 4 IS COMPLETE WHEN
-----------------------
1. The migration runner finishes successfully.
2. Wrangler shows all eight expected table names.
3. No migration remains unapplied.
4. The Git push deploys successfully.
5. /api/picks/schema-health returns:
   "ok": true
   "status": "ready"

Then stop. The next step is Twitch application registration and real server-side
Twitch OAuth/session authentication.


V2 WRANGLER CONFIG FIX
----------------------
Wrangler 4.126 requires a D1 configuration file for the `d1 migrations list`
and `d1 migrations apply` commands.

This package adds:

wrangler.picks-migrations.jsonc

This is intentionally NOT named wrangler.jsonc. It is a migration-only config,
used only when the Step 4 runner explicitly passes:

--config wrangler.picks-migrations.jsonc

It therefore does not replace the existing Cloudflare Pages dashboard
configuration or become the default production Pages configuration.

The config points to the already-created production D1 database:
eastcoin-picks
93a6155a-7e1e-4d92-a713-70f2550a40c0

The V2 runner also verifies the schema by directly selecting from all eight
required tables. If even one table does not exist, the verification command
fails and the runner stops.
