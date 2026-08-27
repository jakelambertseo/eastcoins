EastCoin — Remove DLStreams/DaddyLive from Production

This package removes DLStreams only from the production EastCoin Events/site integration.

It DOES NOT delete:
- dlstreams-test.html
- dlstreams-worker/
- the deployed prototype Worker

Those stay isolated for future testing, but the main EastCoin site no longer calls the Worker or adds DLStreams events/Live TV.

Preserved:
- Streamed + PPV
- provider-loading timeout repairs
- Basketball as a primary category
- Soccer + Tennis inside the More Sports dropdown
- direct/MultiView compatibility for the normal providers

Overwrite:
  assets\eastcoins-event-visibility.js

Then from the repo root run:
  node scripts\update-dlstreams-rollback-changelog.js
  del scripts\update-dlstreams-rollback-changelog.js
