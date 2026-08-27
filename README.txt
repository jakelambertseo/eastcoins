EastCoin Picks Rebuild V4
==========================

Changes
-------

1. Fixed Season Profit Leaders overlap
- Top Picks is now a dedicated horizontal viewport.
- User cards use fixed widths and no longer flex-shrink into each other.
- Usernames, records, ranks and profit no longer overlap.

2. Automatic horizontal scrolling
- Top Picks now moves automatically from right to left.
- The five leaders are duplicated into a seamless looping rail.
- The loop resets invisibly after one complete set.
- Scroll speed is deliberately slow/readable (~30px/sec).
- Hover pauses the rail on desktop so a user can read/click comfortably.
- Touch/manual horizontal scrolling remains possible on mobile.
- "View all" remains fixed on the right and does not scroll away.

3. Real Twitch profile pictures in the prototype
- Top Picks retrieves the current Twitch avatar for each username using:
  https://decapi.me/twitch/avatar/<username>
- The full Leaderboard tab uses those avatars too.
- Avatar URLs are cached locally for 6 hours to avoid repeated calls.
- Initials remain as a fallback if an avatar cannot be loaded.
- This is a pre-backend prototype solution.

Production note
---------------
When EastCoin Twitch OAuth / Worker backend is implemented, replace the
DecAPI avatar lookup with Twitch Helix Get Users and store/use Twitch's
profile_image_url. Do not put Twitch app credentials in frontend JS.

No Picks market math, wager limits, tickets, history, ZCoins rules, or
Streamed integration were changed.
