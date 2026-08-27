EastCoin V2 — Iteration 36 — Full Watch Experience
=======================================================

BASE
----
V2 Modular Baseline — Iteration 35

CORE CHANGE
-----------
The event player is no longer a centered popup/modal.

Opening an event now creates a dedicated V2 watch workspace that fills:

- all available width to the left of persistent Twitch chat
- all available height underneath the EastCoin top navigation + sport strip

The persistent Twitch chat iframe is never recreated.

PLAYER LAYOUT
-------------
The stream iframe occupies the entire watch surface.

Controls float over the video:

TOP
- Back to Events
- LIVE / EastCoin Player state
- event title
- event date/time
- Favorite
- Add to MultiView
- Copy Link
- Open Source
- Chat

BOTTOM
- available server count
- horizontal server selector

SERVER SELECTOR
---------------
Uses the existing provider stream list.

Each playable stream appears as a compact server button:
- provider/source
- stream number
- language when available

Changing server:
- changes only the video iframe
- keeps Twitch chat mounted
- updates the current V2 watch URL

SHAREABLE LINKS
---------------
Copy Link produces a V2 event URL such as:

/v2/?event=EVENT_ID&source=SOURCE&stream=STREAM_NUMBER

Refreshing/opening that URL:
- waits for the V2 event catalog
- finds the exact event
- reopens the watch workspace
- attempts to restore the same source/server

Custom URLs use the existing `watch` parameter.

MULTIVIEW
---------
The watch toolbar can add the currently viewed event directly to the existing
EastCoin MultiView local-state slots without leaving the player.

RESPONSIVE
----------
Desktop:
- video left
- Twitch chat right

Mobile:
- video above
- persistent Twitch chat below

If Chat is hidden through Settings, the watch workspace automatically expands
to the newly available space.

If Navigation is hidden through Settings, the watch workspace expands upward to
the top of the viewport.

UNCHANGED
---------
- event catalog
- event cards
- server provider adapters
- Odds API
- Picks
- Quick Bet
- MultiView storage format
- persistent Twitch chat iframe

CURRENT VERSION
---------------
V2 Modular Baseline — Iteration 36
