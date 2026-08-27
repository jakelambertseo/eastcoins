EastCoin Event Loader Hotfix

Purpose:
- Adds a 3.5s timeout to DLStreams schedule requests.
- Adds a 2.5s timeout to DLStreams Live TV channel requests.
- Because the existing provider bridge uses Promise.allSettled(), Streamed/PPV events can continue loading if DLStreams is slow.
- Adds a changelog entry.

Run from the EastCoin repository root:
  node scripts\apply-event-loader-hotfix.js

Then delete the installer before committing:
  del scripts\apply-event-loader-hotfix.js
