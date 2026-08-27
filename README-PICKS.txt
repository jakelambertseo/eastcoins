EastCoin Picks — Production Foundation
=====================================

Production routes
-----------------
/picks.html
/picks-admin.html

What is production-ready now
----------------------------
- Clean Picks frontend split into dedicated HTML/CSS/JS files.
- Current Streamed event catalog is reused for preview markets.
- Full team names, larger team branding, community pool UI and wager slip.
- 1 ZCoin minimum.
- Personal max = 15% of current wallet.
- Hard max = 50 ZCoins.
- My Picks, Picks History and Picks-profit leaderboard.
- Auto-scrolling Top Picks rail.
- Twitch profile pictures in the preview leaderboard.
- Twitch chat remains mounted beside Picks.
- Dedicated API client already defines the Worker contract.
- Separate settlement console for winner / No Action / Void workflow.

Backend-ready API contract
--------------------------
GET  /api/picks/bootstrap
POST /api/picks/wagers
GET  /api/picks/auth/twitch/start?returnTo=/picks.html
POST /api/picks/auth/logout

GET  /api/picks/admin/markets
POST /api/picks/admin/markets/:marketId/settle

Important admin security rule
-----------------------------
picks-admin.html contains NO frontend password and NO browser-side admin bypass.
The Worker must verify the authenticated Twitch user ID against the EastCoin
admin allowlist before returning markets or accepting settlement commands.

Until the backend is connected:
- /picks.html automatically falls back to a clearly labeled Frontend Preview.
- /picks-admin.html stays locked.
- /picks-admin.html?demo=1 enables local-only settlement testing.
- Demo settlements write only to localStorage and never touch StreamElements.

Production navigation / changelog
---------------------------------
tools/apply-picks-production.cjs safely patches the user's current local:
- index.html (adds Picks under Watch)
- changelog.html (adds the August 25 Picks foundation entry)

The patcher is idempotent and does not overwrite either file wholesale.

Next backend milestone
----------------------
1. Cloudflare Worker + D1 schema.
2. Twitch OAuth using stable Twitch user IDs.
3. StreamElements read/debit/credit proof of concept.
4. Wallet operation journal + idempotency/reconciliation.
5. Real market lock snapshots.
6. Authenticated admin settlement and largest-remainder payouts.
