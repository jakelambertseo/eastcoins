EastCoin V2 — Iteration 37 — Watch Controls Polish
=====================================================

BASE
----
GitHub main inspected before the update:
66f98cb0e76066ec6d001432700fd85f170f69d2
Build full V2 event watch experience

CHANGES
-------
- Removes the Chat button from the V2 watch controls.
  Persistent Twitch chat is unchanged and remains controlled through Settings.

- Standardizes visible stream choices:
  Server 1, Server 2, Server 3, etc.

- Removes visible provider/source and language labels from server buttons.
  Internal source/stream IDs are retained for playback and shared-link restore.

- Adds a gold Bet button to the watch controls.
  It uses the same visual treatment and existing Quick Bet ticket as Events.

- Adds Collapse to the watch controls.
  It hides the watch overlays/server bar, leaves a Show Controls recovery
  button visible, and remembers the preference on the device.

- Updates changelog.html.
- Bumps watch-view.css and player.js cache versions to 37.

UNCHANGED
---------
- Stream provider resolution
- Share-link source IDs
- Persistent Twitch chat iframe
- Picks / ZCoin rules and payout math
- Quick Bet implementation
- MultiView behavior
- Event provider adapters
