

EASTCOIN COMPACT SHARED SIDEBAR
- Reduced navigation link font size, gaps, padding, margins, and corner radius.
- Navigation links now use roughly 25–30 percent less vertical space.
- Updated every shared-shell page, including the currently hidden game pages.
- Rebuilt the Zwades callout as a compact, single-line card.
- The card now contains only: zwades is blue
- Removed the Zwades image, eyebrow, and supporting sentence from page markup.


EASTCOIN ARCADE NAVIGATION AND SCORE CARDS
- Restored Aim Trainer to the compact shared navigation.
- Restored Button Masher to the compact shared navigation.
- Added active navigation states on each game's full wrapper page.
- Added Bonk-style score-card sharing to Aim Trainer:
  - branded 960x540 PNG image
  - score, best, accuracy, reaction time, combo, hits, misses, and escapes
  - right-click / Copy image / paste into Discord instructions outside image
- Added Bonk-style score-card sharing to Button Masher:
  - branded 960x540 PNG image
  - score, best, total presses, average PPS, peak PPS, trap presses, opponent
  - right-click / Copy image / paste into Discord instructions outside image
- Generated score cards are stored in localStorage with round metadata.
- Updated wrapper and Games-card cache parameters to v=share2.


EASTCOIN COLLAPSIBLE PLAYER CONTROLS
- Added a Hide controls button to the Live Player toolbar.
- Added the same control to the Games toolbar.
- Collapsing hides Share Room, Open source/Open game, Change URL/All Games,
  and the toolbar title.
- A small Show controls button remains in the upper-right corner.
- The collapsed state is stored in localStorage and shared between the
  Live Player and Games pages.
- Loading another video or game preserves the selected state.


EASTCOIN TOP-LEVEL GAME NAVIGATION FIX
- Added target="_top" to every shared sidebar navigation link.
- Aim Trainer and Button Masher now open as full EastCoin wrapper pages.
- Navigation no longer loads a second copy of EastCoin inside the active
  game or video iframe.
- Added a capture-level JavaScript fallback that redirects the top browser
  window whenever a shared page is already nested in an iframe.
- The full wrappers still embed only:
  aim-trainer-game.html and button-masher-game.html.


EASTCOIN EMBEDDED GAME WRAPPER FIX
- Aim Trainer no longer requests aim-trainer-game.html through the network.
- Button Masher no longer requests button-masher-game.html through the network.
- Each full wrapper contains a UTF-8/base64 copy of its game and loads it with iframe.srcdoc.
- This prevents Cloudflare or another fallback rule from returning index.html inside the game area.
- Standalone game files are still retained for direct testing and the Games library.
- Shared navigation remains top-level and Twitch chat remains on the right.

- Shared nav links use v=embedded1 to force browsers to load the new wrappers.


EASTCOIN CHANGELOG PAGE
- Added changelog.html using the shared EastCoin sidebar and mobile navigation.
- Added a compact Changelog link directly below the zwades is blue card on:
  index, Favorites, Games, Bonk, Aim Trainer, Button Masher, and Changelog.
- Added a simple vertical timeline covering the major July–August 2026
  EastCoin feature additions.
- Changelog uses broad release periods instead of invented exact dates.


EASTCOIN SITEWIDE UX OVERHAUL
1. Theater Mode
   - One-click distraction-free player/game view.
   - Hides navigation, Twitch chat, resize handle, and top toolbar.
   - Escape exits Theater Mode.

2. Collapsible Twitch Chat
   - Hide/show control available on all player and game pages.
   - Preference is remembered.
   - Desktop keeps the existing draggable width.
   - Mobile chat now opens as a slide-over drawer.

3. Embed Loading and Recovery
   - Loading overlay appears for streams and games.
   - Long-loading/error state offers Try Again, Open Directly, and Go Back.
   - Player Help button can open recovery options manually.

4. Continue Activity
   - Live Player offers Continue Watching and Continue Playing.
   - Recently played games are saved locally on the current device.
   - No accounts or server database are required.

5. Games Library Upgrade
   - Games are grouped into Recently Played, EastCoin Games, and Party Games.
   - Cards now include concise tags such as Solo, Multiplayer, duration,
     accuracy, speed, and strategy.

6. Shared Settings
   - Game sounds
   - Twitch chat visibility
   - Reduced motion
   - Default sidebar state
   - Default player-control state
   - Reset interface preferences without deleting game high scores

CHANGELOG
- Added an August 2026 “Sitewide UX overhaul” timeline entry.


THEATER MODE AND ULTRA-DARK STYLE FIX
- Theater Mode now pins the watch area directly to the browser viewport.
- The player no longer depends on the four-column layout while active.
- Only the Exit Theater control remains visible during Theater Mode.
- All new UX elements now match EastCoin's ultra-dark black, burgundy,
  aged-gold, and muted-cream palette.
- Shared UX asset cache versions were updated from ux1 to ux2.
- The August 2026 changelog entry was updated.


STREAMED API SERVER SWITCHER
- Added a Streamed API browser to the Live Player URL screen.
- Users can browse Live Now or Today and search returned events.
- Pasting a streamed.pk/watch/... URL attempts to resolve the event.
- EastCoin requests streams for every source in the match sources array.
- Streams are grouped by source with:
  - source name
  - stream number
  - HD or SD
  - language
  - recommended label
- Recommended selection prefers English HD, then any HD, then English.
- Switching servers replaces only the player iframe.
- Share Room links retain match ID, source, stream number, and embed URL.
- The normal manual URL player still works exactly as before.
- Direct browser fetch is used because the documented API requires no auth.
- If production browsers report a CORS error, a Cloudflare Pages proxy will
  be the next step; no Worker/Function was added in this test implementation.
- Added the feature to changelog.html.


STREAMED SERVER BROWSER TEST PAGE
- index.html has been restored to the stable Live Player.
- index-test.html contains the Streamed API event browser and server switcher.
- Share Room URLs created from the test page remain on index-test.html.
- The active Live Player link on the test page points to
  index-test.html?new=1.
- The changelog identifies index-test.html as the temporary test location.


STREAMED BROWSER CLEANUP
- Removed beta and test-page wording from the visible Streamed interface.
- Live Now events load automatically when index-test.html opens without a
  shared event or normal watch URL.
- Added “View all streams” inside the server selector.
- Returning to all streams restores the event browser and refreshes the
  Live Now view without leaving index-test.html.
- Updated Streamed asset cache versions from server1 to server2.
- Updated the changelog entry.


STREAMED SERVER BROWSER PUBLISHED
- The polished Streamed event browser is now the main index.html homepage.
- Live Now events load automatically on the standard Live Player.
- Existing manual URL loading remains available.
- index-test.html now redirects to index.html while preserving query strings
  and URL hashes so older shared test links continue working.
- The Live Player navigation link now points to index.html?new=1.
- The changelog now records the full homepage launch.
