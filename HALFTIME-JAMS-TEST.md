# EastCoin Halftime Jams — Test Guide

This test validates the user interface and synchronization behavior before a
real multi-user backend is added.

## Test URL

After deploying the patch:

- Admin:
  `https://eastcoin.vip/halftime-jams-test.html?role=admin&room=eastcoin-halftime-test`
- Viewer:
  `https://eastcoin.vip/halftime-jams-test.html?role=viewer&room=eastcoin-halftime-test`

The admin page has an **Open viewer window** button that creates the matching
viewer URL automatically.

## Recommended test

1. Open the admin test page.
2. Click **Open viewer window**.
3. In the viewer tab, click **Enable synced audio** once.
4. Return to the admin tab.
5. Paste an embeddable YouTube song URL or leave the official API demo video.
6. Press **Start in 3 seconds**.
7. Confirm the viewer popup appears automatically and begins at the countdown.
8. Test **Pause**, **Resume**, **Resync everyone**, and **End jam**.
9. Open another viewer after playback has started. It should join at the
   current room position rather than starting from zero.

## What this test proves

- Admin-triggered popup behavior
- Scheduled synchronized starts
- Late joining
- Pause and resume
- Manual and automatic resynchronization
- Browser autoplay handling
- Viewer-side volume
- Ending and hiding the popup

## Test limitation

This version uses `BroadcastChannel` and `localStorage`, so it synchronizes tabs
in the same browser profile and origin. It does not yet synchronize unrelated
devices or real EastCoin visitors.

The production version will replace the test transport with an authenticated
Cloudflare Worker/Durable Object WebSocket room while keeping most of the
YouTube-player and overlay logic.


## Floating viewer layout

The viewer test now includes a mock Twitch chat column. Halftime Jams opens as
a compact mini-player beside that chat rather than covering the center of the
sports video.

The blue-tinted Halftime Jams header is draggable. Dragging is local to the
viewer and does not affect synchronization or other viewers.

## Twitch command simulator

The admin tab now includes a local Twitch command simulator:

- `!starthalftime`
- `!pausehalftime`
- `!resumehalftime`
- `!resynchaltime`
- `!endhalftime`

`!starthalftime VIDEO_URL_OR_ID` can also replace the current YouTube selection
before starting.

This simulator does not read the embedded Twitch chat. It calls the same test
admin functions that a production Twitch bot would call.

## Production Twitch command flow

The embedded Twitch chat iframe cannot safely expose its message contents to
EastCoin. A production command trigger needs a Twitch chatbot/backend:

1. Subscribe to Twitch `channel.chat.message` events.
2. Ignore commands from ordinary viewers.
3. Allow only the broadcaster account and an explicit admin allowlist.
4. Parse `!starthalftime`, `!pausehalftime`, and the other approved commands.
5. Send the verified action to the EastCoin room coordinator.
6. The room coordinator broadcasts the updated jam state to connected viewers.

The bot credentials and Twitch access tokens must stay server-side. Never place
them in EastCoin's public HTML or browser JavaScript.
