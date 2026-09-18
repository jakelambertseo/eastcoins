EastCoin V2 — Iteration 39 — Picks Refresh + Community Ledger
================================================================

BASE
----
Designed against the current EastCoin main branch after:
- Iteration 37: V2 watch controls polish
- Iteration 38: V2 MultiView workspace repair

REQUESTED
---------
- Stop Picks from pulling/flashing the old left-side navigation in V2.
- Remove:
  "Pick winners with ZCoins. Community action sets the payout.
   Final odds lock when the game starts."
- Add Community Ledger beside History.
- Refresh older Picks code to match the recent Quick Bet / Odds API work.

ADDITIONAL FIXES INCLUDED
-------------------------
1. Native V2 Picks embedding
   - Pre-paint embedded class prevents the legacy sidebar flash.
   - Removes the old Picks sidebar from V2 layout math.
   - Does not load the duplicate Picks Twitch chat inside V2.
   - Removes the redundant V2 workspace title bar for Picks.
   - Standalone /picks.html still keeps its own sidebar/chat.

2. Real Community Ledger
   - Uses D1 Picks records from the production bootstrap.
   - Shows public Twitch identity, selected team, matchup, wager, status,
     result/net and timestamp.
   - Includes active bets, wins, losses and refunds.
   - Does NOT expose wallet balances, wallet-operation metadata,
     session data or payment-provider details.
   - Latest 200 records.

3. Personal History now works from backend Picks records
   - Wager entries
   - Winning returns
   - Refunds

4. Current pool totals fixed
   - OPEN markets now aggregate confirmed ACTIVE Picks from D1.
   - LOCKED markets use their authoritative locked pool values.
   - Ticket counts are populated instead of always showing zero.

5. Real D1 timestamps fixed
   - SQL ISO timestamps are now parsed correctly.
   - Prevents valid future markets from appearing immediately locked.

6. Backend ticket states fixed
   - ACTIVE and PENDING_PAYMENT normalize to pending in the UI.
   - WON / LOST / REFUNDED map correctly.

7. Production preview safety
   - Production no longer silently replaces a failed backend with mock users,
     fake markets or a fake wallet.
   - Preview mode remains explicit via ?preview=1 and available on localhost.

8. Wallet privacy / clarity
   - The community leaderboard no longer includes a Wallet column.
   - A user's own wallet remains visible only in their own Picks summary.
   - A disconnected StreamElements wallet shows as pending instead of a fake 0.

9. Language cleanup
   - "Today's Markets" -> "Open Markets".
   - Football/baseball/MMA labels now fit the expanded supported catalog.
   - Community pool wording now uses "multiplier" rather than implying the
     displayed pool projection is sportsbook odds.

10. OAuth return behavior
   - Logging in from embedded V2 Picks returns to /v2/?view=picks instead of
     dropping the user onto the standalone Picks page.

FILES UPDATED
-------------
picks.html
assets/eastcoins-picks.css
assets/eastcoins-picks.js
functions/api/picks/bootstrap.js
v2/assets/js/router.js
v2/assets/css/workspace.css
v2/index.html
changelog.html

VALIDATION
----------
The installer and replacement bootstrap are syntax checked in the bundle.
After applying, run the included git diff --check command before committing.
