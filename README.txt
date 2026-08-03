

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


STREAMED TEAM ARTWORK
- Live and Today event rows now display home and away team badges when the
  Matches API supplies teams.home/teams.away badge IDs.
- Badge URL format:
  https://streamed.pk/api/images/badge/[id].webp
- Selected-event artwork also appears in the server selector and player
  toolbar.
- Events without team badges use the provided poster image when available.
- Events without either image type use compact team or sport initials.
- Failed image requests automatically fall back without leaving a broken
  image icon.
- Team names are now included in event search matching.
- Streamed asset cache versions were updated from server2 to server3.
- The changelog was updated.


SHARED ROOM SERVER RESTORATION FIX
- Share Room links now include a compact streamedRoom payload.
- The payload contains the event ID, title, category, optional artwork/team
  data, and every Streamed source/source-specific match ID.
- The selected source and stream number are included in the payload.
- Shared Streamed rooms no longer let the generic ?watch= loader run first.
- The Streamed restorer now owns startup and rebuilds every server button.
- Player controls and the server selector are forced open after restoration.
- Older links containing streamedEvent/source/stream parameters remain
  supported through the API listing lookup.
- If an event is stale or the API temporarily fails, the ?watch= embed URL
  remains a video-only fallback.
- Updated Streamed JavaScript cache version from server3 to server4.
- Updated changelog.html.


ZWADES AGREEMENT GATE TEST
- Test URL: /agreement-test.html
- The live index.html and existing production pages remain unchanged.
- Visitors must manually click “I Agree” after seeing “Zwades is Blue.”
- The overlay has no close button and Escape cannot dismiss it.
- Background navigation and controls are inert until agreement.
- Test localStorage key: eastcoinZwadesBlueAgreementTest
- Test cookie name: eastcoinZwadesBlueAgreementTest
- Cookie lifetime: 400 days, refreshed on return visits.
- The test intentionally uses a separate storage key from production.
- After agreement, “Reset agreement test” appears for repeated testing.
- Force a fresh test with /agreement-test.html?resetAgreement=1
- Added the feature to changelog.html.


ZWADES AGREEMENT GATE — SITEWIDE LAUNCH
- Runs on every active EastCoin HTML page.
- Production localStorage key: eastcoinZwadesBlueAgreement
- Production cookie: eastcoinZwadesBlueAgreement
- Agreement version: v1
- Cookie duration: 400 days, refreshed on return.
- Manual “I Agree” click is required.
- Background interaction, scrolling, Escape dismissal, and Tab escape are
  blocked until acceptance.
- No public reset button is shown.
- agreement-test.html redirects to a fresh production preview using
  index.html?resetZwadesAgreement=1
- The prior test-only agreement does not count toward production.
- Updated changelog.html.

- The agreement popup now also displays assets/zwades-blue.webp.


STREAMED DISCOVERY DASHBOARD
- Added events.html and an Events sidebar link.
- Added Popular Live derived from match.popular in the cached Live response.
- Added sport tabs using /api/sports names while filtering matches locally.
- Added Starting Soon countdowns from the cached Today response.
- Added favorite teams in eastcoinFavoriteTeamsV1 localStorage.
- Added event detail URLs at events.html?event=[match-id].
- Added supplied-poster, matchup-poster, badge, and initials fallbacks.
- Added assets/eastcoins-streamed-api.js.
- Provider-friendly request policy:
  - Live cached 90 seconds across pages.
  - Today cached 5 minutes across pages.
  - Sports cached 24 hours across pages.
  - no automatic API polling.
  - manual Refresh forces only Live and Today.
  - no Popular endpoint; the row is derived locally.
  - no per-sport requests; tabs filter locally.
  - All matches only as explicit event/URL fallback.
  - stream endpoints only after an event is selected.
  - source responses cached in sessionStorage for 5 minutes.

- Selected-event source requests are limited to three concurrent calls to avoid request bursts.
- Shared-room, event, and generic watch links skip discovery endpoints until the user opens the event browser.


STREAMED DISCOVERY LAYOUT + POPULATION FIX
- Live, Today, and Sports now settle independently, so a failed Sports request
  does not blank the whole dashboard.
- Supports direct arrays and common wrapped API array responses.
- Event timestamps are normalized from seconds or milliseconds.
- Popular Live fills from the live lineup when no events carry a popular flag.
- Favorite Teams shows useful team suggestions before the first favorite.
- Starting Soon uses normalized event times.
- If nothing is live but Today has events, the initial list opens on Today.
- Event cards use a wide horizontal layout instead of tall skinny cards.
- Popular Live and Starting Soon sit side by side on wide screens.
- Events page width increased to 1280px.
- Public page copy is visitor-focused rather than API-focused.
- Request courtesy remains unchanged: cached Live/Today/Sports, no polling, no
  separate popular endpoint, and no per-sport endpoint fan-out.


STARTING SOON TWO-COLUMN FIX
- Starting Soon now spans the full discovery width on desktop.
- Upcoming event cards render in two columns on wider screens.
- At 1040px and below, Starting Soon returns to one column for readability.
- Updated the Streamed stylesheet cache version from server6 to server7.
- Added the change to changelog.html.


PLAYER AND SIDEBAR UI CONSOLIDATION
- Theater, Hide Chat, and Settings now sit centered along the bottom of the
  player area rather than over the video volume controls.
- Player Help was removed from the floating utility controls.
- Open Source and Change URL were removed from the top player controls.
- The NFL kickoff countdown was reduced in height and visual weight.
- Bonk, Aim Trainer, and Button Masher are nested in a collapsible Games menu.
- The Games menu opens automatically on the Games and individual game pages.
- Shared UX assets were cache-busted from ux2 to ux3.
- Updated changelog.html.


VERTICAL SERVER DRAWER
- The Streamed server selector now opens as a vertical drawer on the right.
- The video iframe shrinks to remain fully visible instead of being covered.
- The player toolbar and centered utility controls align with the visible
  video area while the drawer is open.
- Server sources have their own internal scroll area.
- Streams appear as compact full-width vertical buttons.
- At 1100px and below, the selector becomes a bottom sheet.
- On compact screens, choosing a server automatically closes the sheet.
- Streamed assets were cache-busted to server8.
- Updated changelog.html.


SHORT EVENT-BASED SHARE LINKS
- Share Room now uses a compact URL:
  /?event=MATCH_ID&source=SOURCE&stream=NUMBER
- The full room token and full embed URL are no longer included in new
  Streamed Share Room links.
- Opening the link resolves the current event listing and restores the
  selected source and stream number when they remain available.
- Older streamedRoom, streamedEvent, streamedSource, streamedStream, and
  watch-based links remain supported.
- Manually entered non-Streamed URLs still use the existing ?watch= format.
- Streamed JavaScript was cache-busted from server8 to server9.
- Updated changelog.html.


VIEW ALL STREAMS FIX
- The server drawer's View all streams button now directly resets the player.
- It no longer tries to click the removed Change URL toolbar button.
- Event, source, stream, watch, and legacy shared-room parameters are removed
  from the browser URL when returning to the directory.
- Existing loaded discovery results are reused.
- Discovery data is requested only when it has not already been loaded.
- Streamed JavaScript was cache-busted from server9 to server10.
- Updated changelog.html.


MANUAL SERVER SELECTOR
- Loading an event no longer opens the server drawer automatically.
- Shared and direct event links also begin with the server drawer closed.
- The top player button is now labeled Server Selector.
- The stream count remains available through the button's accessible label.
- The close control now reads Close Server List.
- Close Server List uses a prominent red treatment.
- Streamed CSS and JavaScript were cache-busted to server11.
- Updated changelog.html.


SHARED EVENT NAVIGATION
- Any index.html URL containing ?event= starts with the left navigation hidden.
- The forced shared-room collapse does not overwrite the visitor's normal
  saved sidebar preference.
- The navigation toggle is red on event-room URLs so it remains easy to find.
- Desktop visitors can reopen the sidebar normally from the red toggle.
- Mobile event links continue to start with the slide-out navigation closed.
- Added the update to changelog.html.


WATCH ROOM + DISCOVERY UPGRADE
- Automatic recovery:
  - watches for iframe load errors or a 14-second no-load timeout
  - tries up to two alternate servers already loaded for the event
  - does not request any additional API endpoints during recovery
  - adds a manual Try Next Server control
  - marks skipped servers in the server drawer
- Event-room header:
  - displays event title, live/start status, selected source, stream, quality,
    and language
  - keeps Server Selector and Try Next Server visible in the player controls
- Keyboard shortcuts:
  - S: Server Selector
  - N: Try Next Server
  - T: Theater mode
  - C: Show/hide chat
  - M: Show/hide navigation
  - Escape: close the server drawer first
  - shortcuts are ignored while typing in form fields
- Continue Watching:
  - remembers the latest Streamed event, selected source, and stream
  - keeps the card for 36 hours
  - replaces the older raw iframe-only Continue Watching entry
- Favorite-team personalization:
  - Favorite Teams becomes For You on the homepage after teams are selected
  - favorite-team events are prioritized in the main and Starting Soon lists
- Compact schedule filters:
  - Live, Today, and Tomorrow
  - Tomorrow calls /matches/all only after the visitor explicitly selects it
  - the existing five-minute API cache is reused
- Streamed CSS and JavaScript updated to server12.
- Shared UX JavaScript updated to ux4.
- Updated changelog.html.


EVENT ARTWORK LOADING SCREEN
- Streamed publishes the selected event context before the iframe is created.
- The loading overlay can now show:
  - event poster or generated matchup artwork
  - home and away team badges
  - team-initial fallbacks
  - event title
  - live/sport label
  - selected provider, stream number, quality, and language
- Events without teams use their supplied poster when available.
- Manually entered URLs and games retain the generic loading state.
- Failed artwork hides cleanly without blocking the player.
- Shared UX CSS and JavaScript were cache-busted to ux5.
- Streamed JavaScript was cache-busted to server13.
- Updated changelog.html.


WATCH-NIGHT RELIABILITY + PERSONALIZATION
- Stream feedback:
  - ✓ Works stores a positive browser-local provider signal
  - ✕ Broken stores a negative signal and immediately tries another server
  - feedback never sends extra provider requests
- Player connection status:
  - Connecting
  - Player loaded
  - Switching servers
  - Needs another server
- Recently Watched:
  - keeps six unique Streamed events for seven days
  - remembers the last provider and stream number
  - supports individual removal and Clear history
- Your Night:
  - compact horizontal timeline
  - uses only the already-loaded Live and Today event lists
  - highlights favorite-team events
- Server preferences:
  - preferred provider
  - preferred language
  - HD preference
  - saved locally and used by automatic server selection
  - local Works/Broken feedback also influences ranking
- Game Break:
  - quick drawer with Bonk, Aim Trainer, and Button Masher
  - games open in a new tab so the stream remains ready
  - keyboard shortcut: G
- Public status page:
  - status.html
  - linked directly below Changelog in the left navigation
  - checks Live and Today independently
  - shares the normal EastCoin cache
  - does not poll automatically
  - forced refresh happens only after a visitor clicks Refresh status
- Streamed assets updated to server14.
- Added assets/eastcoins-status.css and assets/eastcoins-status.js.
- Updated changelog.html.


INLINE GAME BREAK OVERLAY
- Added Hide Nav / Show Nav to the centered player utility dock.
- Added Play a Game beside Theater, chat, and Settings.
- Play a Game opens a centered overlay over part of the player.
- Visitors can choose:
  - EastCoin Bonk
  - Aim Trainer
  - Button Smasher
- The selected game loads in an iframe on the same page.
- The underlying stream remains loaded and continues playing.
- Return to event closes and unloads the game immediately.
- Choose another game returns to the game-selection screen.
- Clicking outside the panel or pressing Escape also exits quickly.
- Keyboard shortcut G opens/closes the new inline game overlay.
- The older top-toolbar Game Break button remains retired.
- Shared UX assets updated to ux6.
- Streamed JavaScript updated to server15.
- Updated changelog.html.


INLINE GAME STARTUP FIX
- The hidden .ec-player-game-frame is excluded from the main video observer.
- The generic Loading EastCoin game overlay no longer appears on site startup.
- The game iframe is still available after a visitor clicks Play a Game and
  selects Bonk, Aim Trainer, or Button Smasher.
- The normal event/video iframe continues to receive loading and recovery UI.
- Shared UX JavaScript was cache-busted from ux6 to ux7.
- Updated changelog.html.


COMPACT CONTROLS + INLINE GAME FIT
- The top event-room controls use smaller padding, type, artwork, and gaps.
- The top controls can scroll horizontally instead of covering the player.
- The bottom Theater / Chat / Nav / Game / Settings strip is smaller.
- The inline game overlay now uses nearly the full available player area.
- The overlay header and game-switching bar were reduced in height.
- Inline game URLs now include overlay=1.
- Each inner game has a compact overlay-only layout:
  - shorter title/header area
  - compact stats
  - game board uses the remaining iframe height
  - Bonk keeps all six holes in a 3 × 2 board
  - Aim Trainer arena fills the remaining height
  - Button Smasher scales its press area to the available viewport
- Direct full-page game links retain their original layouts.
- Shared UX CSS and JavaScript were cache-busted to ux8.
- Streamed CSS was cache-busted to server16.
- Updated changelog.html.


SIMPLIFIED EVENT-ROOM CONTROLS
- Removed the ✓ Works and ✕ Broken buttons.
- Removed browser-local Works/Broken feedback storage and scoring.
- Automatic failure recovery and Try Next Server remain unchanged.
- Saved provider, language, and quality preferences still influence selection.
- Try Next Server, Share Room, and Hide Controls now use one neutral style.
- Server Selector remains the only visually emphasized player action.
- Connection status remains visible but uses a more restrained treatment.
- Streamed CSS and JavaScript were cache-busted to server17.
- Updated changelog.html.


COLLAPSED PLAYER CONTROLS FIX
- The collapsed event toolbar now displays only Show controls.
- Connection status and every other toolbar item are force-hidden while
  controls are collapsed.
- Compact event-room sizing can no longer override the collapsed toolbar.
- The visible Show controls button receives its own high stacking layer and
  pointer access above the iframe.
- When the desktop server drawer is open, the button remains beside it.
- Streamed CSS was cache-busted from server17 to server18.
- Updated changelog.html.


HALFTIME JAMS SYNC TEST
- Added halftime-jams-test.html.
- Added assets/eastcoins-halftime-jams-test.css.
- Added assets/eastcoins-halftime-jams-test.js.
- Added HALFTIME-JAMS-TEST.md.
- Admin and viewer roles share a room ID through URL parameters.
- Admin controls:
  - Start in 3, 5, or 10 seconds
  - Pause
  - Resume
  - Resync everyone
  - End jam
  - Open/copy viewer link
- Viewer behavior:
  - automatic halftime popup
  - one-time Enable synced audio interaction
  - late joining at the current room position
  - four-second drift checks and correction
  - viewer volume and manual Resync
  - popup hide without ending the room
- Test transport uses same-browser BroadcastChannel plus localStorage.
- This is intentionally isolated from the normal EastCoin navigation.
- Production cross-device synchronization still requires an authenticated
  Worker/Durable Object WebSocket backend.
- Updated changelog.html.


HALFTIME JAMS FLOATING WINDOW + COMMAND TEST
- The viewer test now has a two-column watch layout with a mock Twitch chat.
- Halftime Jams opens as a compact mini-player beside chat.
- The main sports-video mock remains visible.
- The mini-player can be dragged within the watch area.
- Mobile layouts keep the mini-player compact over the video.
- The admin tab includes a Twitch command simulator:
  - !starthalftime
  - !pausehalftime
  - !resumehalftime
  - !resynchaltime
  - !endhalftime
- !starthalftime may optionally include a YouTube URL or video ID.
- The simulator calls the same local admin functions as the normal buttons.
- It does not yet connect to real Twitch chat.
- Production Twitch commands require a server-side authenticated Twitch bot
  and room-broadcast backend.
- Test CSS and JavaScript were cache-busted to jams2.
- Updated HALFTIME-JAMS-TEST.md and changelog.html.
