(() => {
  "use strict";

  const STYLE_ID = "eastcoinWin95EmbeddedTheme";
  const STYLE_HREF = "assets/eastcoins-win95-embedded.css?v=win951";

  function applyTheme(frame) {
    if (!frame) return;

    try {
      const doc = frame.contentDocument;
      if (!doc || !doc.documentElement) return;

      doc.documentElement.classList.add("ec-win95-embedded");

      if (!doc.getElementById(STYLE_ID)) {
        const link = doc.createElement("link");
        link.id = STYLE_ID;
        link.rel = "stylesheet";
        link.href = STYLE_HREF;
        (doc.head || doc.documentElement).appendChild(link);
      }
    } catch {
      /* Cross-origin content is intentionally left untouched. */
    }
  }

  const playerFrame = document.getElementById("eastcoinViewFrame");
  const browseFrame = document.getElementById("eastcoinBrowseFrame");

  [playerFrame, browseFrame].forEach((frame) => {
    if (!frame) return;
    frame.addEventListener("load", () => applyTheme(frame));
    applyTheme(frame);
  });
})();
