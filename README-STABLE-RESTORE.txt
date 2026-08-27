EastCoin — Stable Pre-DLStreams Restore

This is an emergency restore to the exact production code at:

  f9ac1afa01d06607b3b5465776c7dd647eda7537
  "Bump music link cache version"

That commit is the last known-good production state immediately before the
DLStreams/DaddyLive prototype and production-integration commits.

The restore intentionally overwrites only these production files:
- _headers
- assets/eastcoins-event-visibility.js
- assets/eastcoins-events-home.js
- assets/eastcoins-persistent-shell.js
- assets/eastcoins-ppv-api.js
- assets/eastcoins-streamed-api.js
- changelog.html
- events.html
- index.html

It intentionally DOES NOT delete the isolated prototype:
- dlstreams-test.html
- dlstreams-worker/
- DLSTREAMS-PROTOTYPE.md
- assets/eastcoins-dlstreams-test.*

Those files can remain for future testing but will not be wired into production
after the restore.

Important:
This exact restore also removes the recent "More Sports" dropdown work and
returns the old event visibility behavior. The goal is to get EastCoin back to
a known-working baseline first. More Sports can then be re-added cleanly as a
separate change after production is confirmed healthy.

Run restore-pre-dlstreams.cmd from the EastCoin repository root.
