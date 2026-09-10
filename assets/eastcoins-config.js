/* ============================================================
   EastCoin configuration service — browser half.

   Reads /api/config once per page load and applies the answers:

     • the chat rail's Twitch channel
     • the Green Room's Worker URL and room name

   Both used to be written into the HTML and into
   eastcoins-music-config.js by hand, which meant pointing the site at a
   local Worker or a different channel was a source edit. Now it is an
   environment variable on the Pages project; see functions/api/_config.js.

   Load this BEFORE v3-shell.js and eastcoins-music-config.js. It exposes:

     window.ECConfig.ready   a promise that always resolves, never rejects
     window.ECConfig.get()   the resolved config, or null if not in yet

   `ready` never rejecting is what lets every consumer be a plain await
   with no error branch. When the fetch fails there is simply nothing to
   apply: the chat iframe keeps the data-src already in the HTML, and the
   Green Room reports itself unconfigured — which is the truth, and is a
   state it already knows how to draw.
   ============================================================ */
(() => {
  "use strict";

  /* Every frame the config might own. The v3 shell has one; the legacy
     shell and the standalone music page have their own ids and are still
     served, so they are named here rather than left to drift. */
  const CHAT_FRAMES = "#twitchChat, #persistentTwitchChat, #pageTwitchChat";

  let resolved = null;

  function applyChat(config) {
    if (!config.chatEmbedUrl) return;

    document.querySelectorAll(CHAT_FRAMES).forEach((frame) => {
      const previous = frame.dataset.src || "";
      frame.dataset.src = config.chatEmbedUrl;
      frame.title = `${config.twitchChannel} Twitch chat`;

      // The persistent-chat invariant: the iframe is never reloaded by
      // anything but a real change. On a normal load it is still
      // about:blank and nothing here touches it — the shell mounts it
      // when it is ready. The one case worth a reload is a frame already
      // showing a DIFFERENT channel, which only happens on a page that
      // mounted chat before this landed. Leaving that one alone would
      // mean silently watching the wrong chat.
      const live = frame.getAttribute("src") || "";
      if (live && live !== "about:blank" && live !== config.chatEmbedUrl && live === previous) {
        frame.src = config.chatEmbedUrl;
      }
    });
  }

  function applyMusic(config) {
    // Filled in rather than overwritten: a page that set a value inline
    // before this ran meant it, and that was the old file's contract too.
    const existing = window.EASTCOIN_MUSIC_CONFIG || {};
    window.EASTCOIN_MUSIC_CONFIG = Object.assign({}, existing);

    if (!existing.websocketUrl && config.musicRoomUrl) {
      window.EASTCOIN_MUSIC_CONFIG.websocketUrl = config.musicRoomUrl;
    }
    if (!existing.room && config.musicRoom) {
      window.EASTCOIN_MUSIC_CONFIG.room = config.musicRoom;
    }
  }

  function apply(config) {
    if (!config) return;
    try { applyChat(config); } catch {}
    try { applyMusic(config); } catch {}
  }

  const ready = fetch("/api/config", {
    headers: { Accept: "application/json" },
    credentials: "same-origin"
  })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((payload) => {
      resolved = payload && payload.ok === true ? payload : null;
      apply(resolved);
      // Consumers that already ran and found nothing configured can look
      // again without polling for it.
      try {
        document.dispatchEvent(new CustomEvent("ec-config", { detail: resolved }));
      } catch {}
      return resolved;
    });

  window.ECConfig = Object.freeze({
    ready,
    get: () => resolved
  });
})();
