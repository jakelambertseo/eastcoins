/* EastCoin Music shared-room configuration.
   Leave websocketUrl blank for local/single-browser mode.
   After deploying the included Cloudflare Worker, set this to the Worker URL.
   Example: https://eastcoin-music-room.<your-subdomain>.workers.dev
*/
window.EASTCOIN_MUSIC_CONFIG = Object.assign(
  {
    websocketUrl: "",
    room: "main"
  },
  window.EASTCOIN_MUSIC_CONFIG || {}
);

/*
  Shared-link music modifier.

  Examples:
    ?event=example-event&music=on
    ?event=example-event&music=true
    ?event=example-event&music=1
    ?event=example-event&music=open

  The existing Music Player reads eastcoinMusicDockOpen while it initializes.
  For a music-enabled shared link, temporarily force that value to "true",
  then restore the visitor's previous saved preference after the page finishes
  loading. This opens the Music Player for this visit without permanently
  changing the recipient's normal Music Player preference.
*/
(() => {
  "use strict";

  const OPEN_KEY = "eastcoinMusicDockOpen";
  const ENABLED_VALUES = new Set(["on", "true", "1", "open"]);

  let shouldOpen = false;

  try {
    const value = String(
      new URLSearchParams(window.location.search).get("music") || ""
    )
      .trim()
      .toLowerCase();

    shouldOpen = ENABLED_VALUES.has(value);
  } catch {}

  if (!shouldOpen) return;

  let hadPreviousValue = false;
  let previousValue = null;
  let changedStorage = false;

  try {
    previousValue = localStorage.getItem(OPEN_KEY);
    hadPreviousValue = previousValue !== null;
    localStorage.setItem(OPEN_KEY, "true");
    changedStorage = true;
  } catch {}

  if (!changedStorage) return;

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      try {
        if (hadPreviousValue) {
          localStorage.setItem(OPEN_KEY, previousValue);
        } else {
          localStorage.removeItem(OPEN_KEY);
        }
      } catch {}
    },
    { once: true }
  );
})();
