# EastCoin Twitch Halftime Playlist Test

This page tests a real Twitch EventSub chat listener and a synchronized
three-video YouTube sequence.

## Test URLs

Listener:

`https://eastcoin.vip/halftime-jams-test.html?role=listener&room=eastcoin-halftime-test`

Viewer:

`https://eastcoin.vip/halftime-jams-test.html?role=viewer&room=eastcoin-halftime-test`

The listener page includes an **Open viewer window** button.

## Twitch setup required

The test listener needs:

1. A registered Twitch application Client ID.
2. A Twitch User Access Token containing the `user:read:chat` scope.
3. The Twitch login of the channel to monitor, currently `zwades`.
4. A comma-separated allowlist of usernames permitted to run commands.

The token is kept only in JavaScript memory for the current tab. The page does
not write the token to localStorage, the URL, or source code.

## Three-video playlist

Enter three YouTube URLs or video IDs before connecting the listener.

When an authorized user posts:

`!starthalftime`

the listener snapshots those three entries and broadcasts video 1 with a
three-second synchronized countdown.

A muted controller player in the listener tab monitors YouTube playback. When
a video ends, it broadcasts the next playlist entry. After video 3 ends, the
playlist closes automatically.

## Supported commands

- `!starthalftime`
- `!pausehalftime`
- `!resumehalftime`
- `!skiphalftime`
- `!resynchaltime`
- `!endhalftime`

Commands from usernames outside the allowlist are logged and ignored.

## Recommended test

1. Open the listener page.
2. Enter the Twitch Client ID and user access token.
3. Replace the three demo video IDs with your three songs.
4. Confirm `zwades` is in Authorized command users.
5. Click **Connect Twitch listener**.
6. Open one or more viewer tabs.
7. Click **Enable synced audio** once in each viewer.
8. In real Twitch chat, post `!starthalftime` from an authorized username.
9. Confirm video 1 opens after the countdown.
10. Let it end or use `!skiphalftime`; confirm videos 2 and 3 follow.
11. Test pause, resume, resync, and end commands.

## Current room-delivery limitation

The Twitch EventSub listener is real. However, this prototype still delivers
the resulting playlist state to viewer tabs with BroadcastChannel and
localStorage, so viewers must be tabs in the same browser profile.

The production version will keep the Twitch EventSub logic server-side and
broadcast room state through a Cloudflare Worker/Durable Object WebSocket.
