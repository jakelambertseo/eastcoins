const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function filePath(rel) {
  return path.join(ROOT, ...rel.split("/"));
}

function read(rel) {
  const p = filePath(rel);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing required file: ${rel}`);
  }
  return fs.readFileSync(p, "utf8");
}

function write(rel, content) {
  fs.writeFileSync(filePath(rel), content, "utf8");
  console.log(`Updated: ${rel}`);
}

function replaceOnce(content, before, after, label) {
  const count = content.split(before).length - 1;
  if (count !== 1) {
    throw new Error(
      `${label}: expected exactly one match, found ${count}. ` +
      `Sync your EastCoin repo to the current main branch and retry.`
    );
  }
  return content.replace(before, after);
}

function insertBefore(content, marker, addition, label) {
  const index = content.indexOf(marker);
  if (index < 0) {
    throw new Error(`${label}: marker was not found.`);
  }
  return content.slice(0, index) + addition + content.slice(index);
}

/* ================================================================
   multiview.html
   Give V2 embedded mode its own pre-paint document state.
   ================================================================ */
{
  const rel = "multiview.html";
  let html = read(rel);

  if (!html.includes("ec-v2-embedded-bootstrap")) {
    html = replaceOnce(
      html,
      "  <title>MultiView | EastCoin</title>\n\n",
      `  <title>MultiView | EastCoin</title>

  <script id="ec-v2-embedded-bootstrap">
    (() => {
      const embedded =
        new URLSearchParams(window.location.search)
          .get("ecV2Embedded") === "1";

      if (embedded) {
        document.documentElement.classList.add(
          "ec-v2-embedded"
        );
      }
    })();
  </script>

`,
      "MultiView embedded bootstrap"
    );
  }

  html = html.replace(
    'assets/eastcoins-multiview.css?v=mv7',
    'assets/eastcoins-multiview.css?v=mv8'
  );

  html = html.replace(
    'assets/eastcoins-multiview.js?v=mv6',
    'assets/eastcoins-multiview.js?v=mv7'
  );

  write(rel, html);
}

/* ================================================================
   assets/eastcoins-multiview.css
   Embedded V2 owns navigation + Twitch chat. MultiView owns only the grid.
   ================================================================ */
{
  const rel = "assets/eastcoins-multiview.css";
  let css = read(rel);

  const marker =
    "EASTCOIN V2 EMBEDDED MULTIVIEW";

  if (!css.includes(marker)) {
    css += `

/* ================================================================
   EASTCOIN V2 EMBEDDED MULTIVIEW
   V2 owns the outer navigation and persistent Twitch chat. When this
   standalone MultiView document is mounted inside /v2/, remove every
   legacy shell reservation and let the MultiView canvas fill its iframe.
   ================================================================ */

html.ec-v2-embedded,
html.ec-v2-embedded body.ec-multiview-page{
  width:100%!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  margin:0!important;
  overflow:hidden!important;
}

html.ec-v2-embedded body.ec-multiview-page{
  --mv-sidebar-expanded:0px;
  --mv-sidebar-rail:0px;
  --mv-chat-width:0px;
  background:#000;
}

/* The old V1 / standalone navigation must not render or reserve a column. */
html.ec-v2-embedded .mv-layout{
  display:block!important;
  grid-template-columns:minmax(0,1fr)!important;
  width:100%!important;
  max-width:none!important;
  height:100dvh!important;
  min-width:0!important;
  min-height:0!important;
  margin:0!important;
  padding:0!important;
}

html.ec-v2-embedded body.mv-chat-open .mv-layout{
  width:100%!important;
}

html.ec-v2-embedded .mv-layout > .sidebar,
html.ec-v2-embedded .ec-events-v2-nav,
html.ec-v2-embedded .mv-nav-toggle,
html.ec-v2-embedded .mv-mobile-overlay,
html.ec-v2-embedded #mvChatButton,
html.ec-v2-embedded .mv-chat-drawer{
  display:none!important;
  width:0!important;
  min-width:0!important;
  max-width:0!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
}

/* The actual MultiView app becomes the entire child viewport. */
html.ec-v2-embedded .mv-main{
  position:relative!important;
  display:grid!important;
  grid-template-rows:auto minmax(0,1fr)!important;
  grid-column:1!important;
  width:100%!important;
  max-width:none!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  margin:0!important;
  overflow:hidden!important;
}

html.ec-v2-embedded body.mv-controls-hidden .mv-main{
  grid-template-rows:minmax(0,1fr)!important;
}

html.ec-v2-embedded .mv-toolbar{
  width:100%!important;
  min-width:0!important;
  min-height:46px!important;
  padding:7px 10px!important;
}

html.ec-v2-embedded .mv-toolbar-actions{
  width:100%!important;
  min-width:0!important;
}

html.ec-v2-embedded .mv-stage{
  display:grid!important;
  grid-template-rows:minmax(0,1fr) auto!important;
  width:100%!important;
  max-width:none!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  margin:0!important;
  padding:8px!important;
  overflow:hidden!important;
}

html.ec-v2-embedded .mv-grid,
html.ec-v2-embedded .mv-grid.layout-2,
html.ec-v2-embedded .mv-grid.layout-3,
html.ec-v2-embedded .mv-grid.layout-4{
  width:100%!important;
  max-width:none!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
}

html.ec-v2-embedded .mv-panel,
html.ec-v2-embedded .mv-panel-body,
html.ec-v2-embedded .mv-player-frame{
  min-width:0!important;
  min-height:0!important;
}

html.ec-v2-embedded .mv-controls-reveal{
  position:absolute!important;
  right:12px!important;
  bottom:14px!important;
}

/*
  On narrow V2 layouts keep the existing stacked-panel behavior, but do not
  re-enable the legacy mobile sidebar or convert the app back to an auto-height
  standalone document.
*/
@media(max-width:900px){
  html.ec-v2-embedded,
  html.ec-v2-embedded body.ec-multiview-page{
    overflow:auto!important;
  }

  html.ec-v2-embedded .mv-layout{
    min-height:100dvh!important;
    height:auto!important;
  }

  html.ec-v2-embedded .mv-main{
    display:block!important;
    width:100%!important;
    min-height:100dvh!important;
    height:auto!important;
    overflow:visible!important;
  }

  html.ec-v2-embedded .mv-stage{
    display:block!important;
    width:100%!important;
    height:auto!important;
    overflow:visible!important;
  }

  html.ec-v2-embedded .mv-grid,
  html.ec-v2-embedded .mv-grid.layout-2,
  html.ec-v2-embedded .mv-grid.layout-3,
  html.ec-v2-embedded .mv-grid.layout-4{
    height:auto!important;
  }
}
`;
  }

  write(rel, css);
}

/* ================================================================
   assets/eastcoins-multiview.js
   Stop standalone nav/chat behavior when embedded in V2.
   ================================================================ */
{
  const rel = "assets/eastcoins-multiview.js";
  let js = read(rel);

  if (!js.includes("const V2_EMBEDDED")) {
    js = replaceOnce(
      js,
      "  const DEFAULT_LAYOUT = 4;\n",
      `  const DEFAULT_LAYOUT = 4;
  const V2_EMBEDDED =
    new URLSearchParams(
      window.location.search
    ).get("ecV2Embedded") === "1";
`,
      "MultiView embedded mode constant"
    );
  }

  const oldChat = `  function setChatOpen(open) {
    const enabled = Boolean(open);
    body.classList.toggle("mv-chat-open", enabled);
    chatDrawer.setAttribute("aria-hidden", String(!enabled));
    chatButton.setAttribute("aria-expanded", String(enabled));

    if (enabled && chatFrame.src === "about:blank") {
      chatFrame.src = chatFrame.dataset.src;
    }
  }`;

  const newChat = `  function setChatOpen(open) {
    /*
      V2 already owns one persistent Twitch chat iframe outside this document.
      Never mount or reserve a second chat drawer when MultiView is embedded.
    */
    if (V2_EMBEDDED) {
      body.classList.remove("mv-chat-open");
      chatDrawer?.setAttribute(
        "aria-hidden",
        "true"
      );
      chatButton?.setAttribute(
        "aria-expanded",
        "false"
      );
      return;
    }

    const enabled = Boolean(open);
    body.classList.toggle("mv-chat-open", enabled);
    chatDrawer.setAttribute("aria-hidden", String(!enabled));
    chatButton.setAttribute("aria-expanded", String(enabled));

    if (enabled && chatFrame.src === "about:blank") {
      chatFrame.src = chatFrame.dataset.src;
    }
  }`;

  if (js.includes(oldChat)) {
    js = replaceOnce(
      js,
      oldChat,
      newChat,
      "embedded MultiView chat guard"
    );
  }

  const oldSolo = `    panel.querySelector("[data-panel-solo]")?.addEventListener("click", () => {
      const source = state.slots[slot];
      if (source) window.location.href = soloUrl(source);
    });`;

  const newSolo = `    panel.querySelector("[data-panel-solo]")?.addEventListener("click", () => {
      const source = state.slots[slot];
      if (!source) return;

      if (
        V2_EMBEDDED &&
        window.parent !== window
      ) {
        window.parent.postMessage(
          {
            type: "ec-v2-multiview-solo",
            source
          },
          window.location.origin
        );
        return;
      }

      window.location.href = soloUrl(source);
    });`;

  if (js.includes(oldSolo)) {
    js = replaceOnce(
      js,
      oldSolo,
      newSolo,
      "embedded MultiView Solo bridge"
    );
  }

  const oldSavedMode = `  if (!isMobile()) {
    setDesktopSidebarMode(savedMode, false);
  } else {
    updateNavigationButton();
  }`;

  const newSavedMode = `  if (V2_EMBEDDED) {
    /*
      The parent V2 shell owns navigation. Keep the standalone sidebar state
      completely out of layout calculations and do not overwrite its saved mode.
    */
    body.classList.add(
      "sidebar-hidden"
    );
    body.classList.remove(
      "sidebar-collapsed",
      "menu-open",
      "mv-chat-open"
    );
    updateNavigationButton();
  } else if (!isMobile()) {
    setDesktopSidebarMode(savedMode, false);
  } else {
    updateNavigationButton();
  }`;

  if (js.includes(oldSavedMode)) {
    js = replaceOnce(
      js,
      oldSavedMode,
      newSavedMode,
      "embedded MultiView nav initialization"
    );
  }

  write(rel, js);
}

/* ================================================================
   v2/assets/js/router.js
   Make MultiView a first-class full workspace and bridge Solo back to V2.
   ================================================================ */
{
  const rel = "v2/assets/js/router.js";
  let js = read(rel);

  if (!js.includes("workspace-multiview")) {
    js = replaceOnce(
      js,
      `    current = routeName;
    setNav(routeName);
`,
      `    current = routeName;
    setNav(routeName);

    document.body.classList.toggle(
      "workspace-multiview",
      routeName === "multiview"
    );
`,
      "V2 MultiView workspace route class"
    );
  }

  if (!js.includes('doc.documentElement.classList.add("ec-v2-embedded")')) {
    js = replaceOnce(
      js,
      `      doc.body.dataset.ecV2Embedded = "true";
`,
      `      doc.body.dataset.ecV2Embedded = "true";

      if (current === "multiview") {
        doc.documentElement.classList.add("ec-v2-embedded");
      }
`,
      "embedded MultiView document class"
    );
  }

  if (!js.includes("ec-v2-multiview-solo")) {
    const bridge = `
  function handleWorkspaceMessage(event) {
    if (
      event.origin !== window.location.origin ||
      event.source !==
        E.workspaceFrame.contentWindow
    ) {
      return;
    }

    const message =
      event.data || {};

    if (
      message.type !==
      "ec-v2-multiview-solo"
    ) {
      return;
    }

    const source =
      message.source || {};

    if (
      source.type === "event" &&
      source.id
    ) {
      const match =
        V2.events?.find?.(
          String(source.id)
        );

      if (!match) {
        V2.toast(
          "That event is no longer available."
        );
        return;
      }

      V2.player?.openMatch?.(
        match
      );
      return;
    }

    if (
      source.type === "url" &&
      source.url
    ) {
      V2.player?.openCustom?.(
        source.url
      );
    }
  }

`;
    js = insertBefore(
      js,
      "  function wire() {",
      bridge,
      "V2 MultiView Solo bridge"
    );

    js = replaceOnce(
      js,
      `    E.workspaceHome.onclick = () => go("events");
    E.workspaceFrame.addEventListener("load", injectEmbeddedCleanup);
`,
      `    E.workspaceHome.onclick = () => go("events");
    E.workspaceFrame.addEventListener("load", injectEmbeddedCleanup);
    window.addEventListener(
      "message",
      handleWorkspaceMessage
    );
`,
      "V2 workspace message listener"
    );
  }

  write(rel, js);
}

/* ================================================================
   v2/assets/css/workspace.css
   MultiView uses every pixel below the V2 sport strip.
   ================================================================ */
{
  const rel = "v2/assets/css/workspace.css";
  let css = read(rel);

  if (!css.includes("V2 MULTIVIEW FULL WORKSPACE")) {
    css += `

/* ================================================================
   V2 MULTIVIEW FULL WORKSPACE
   The outer V2 top nav and sport strip already identify the route, so the
   generic 44px workspace header is redundant for MultiView.
   ================================================================ */
body.workspace-multiview .workspace{
  min-height:0;
  overflow:hidden;
}

body.workspace-multiview .workspacebar{
  display:none!important;
}

body.workspace-multiview .workspace iframe{
  width:100%!important;
  height:100%!important;
  min-width:0;
  min-height:0;
}
`;
  }

  write(rel, css);
}

/* ================================================================
   v2/index.html
   Bust caches for router/workspace fixes.
   ================================================================ */
{
  const rel = "v2/index.html";
  let html = read(rel);

  html = html.replace(
    'assets/css/workspace.css?v=4',
    'assets/css/workspace.css?v=5'
  );

  html = html.replace(
    'assets/js/router.js?v=13',
    'assets/js/router.js?v=14'
  );

  write(rel, html);
}

/* ================================================================
   changelog.html
   ================================================================ */
{
  const rel = "changelog.html";
  let html = read(rel);

  const title =
    "EastCoin V2 MultiView now fills the workspace without legacy navigation";

  if (!html.includes(`<h2>${title}</h2>`)) {
    html = html.replace(
      /<div class="release-count">(\d+) major update groups<\/div>/,
      (_, count) =>
        `<div class="release-count">${Number(count) + 1} major update groups</div>`
    );

    html = html.replace(
      '<article class="timeline-entry latest">',
      '<article class="timeline-entry">'
    );

    html = html.replace(
      /\s*<span class="latest-badge">Latest<\/span>/,
      ""
    );

    const entry = `
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-27">August 27, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Repaired the V2 MultiView workspace after the standalone legacy MultiView
    document was being squeezed inside V2. Embedded MultiView now removes the
    old left-navigation column before first paint, disables its duplicate
    Twitch-chat drawer, and expands the two-, three-, and four-stream grid to
    the full V2 workspace beneath the top navigation and sports strip. The
    redundant V2 workspace title bar is also removed on the MultiView route.
    Standalone MultiView keeps its existing navigation and chat behavior, while
    V2 Solo actions now hand the selected stream back to the native V2 player
    instead of navigating the embedded frame into an old EastCoin page.
</p>
</article>
`;

    const timelineEnd =
      html.lastIndexOf("</section>");

    if (timelineEnd < 0) {
      throw new Error(
        "Could not locate changelog timeline."
      );
    }

    html =
      html.slice(0, timelineEnd) +
      entry +
      html.slice(timelineEnd);
  }

  write(rel, html);
}

console.log("");
console.log("EastCoin V2 Iteration 38 patch complete.");
console.log("Changed:");
console.log("  multiview.html");
console.log("  assets/eastcoins-multiview.css");
console.log("  assets/eastcoins-multiview.js");
console.log("  v2/assets/js/router.js");
console.log("  v2/assets/css/workspace.css");
console.log("  v2/index.html");
console.log("  changelog.html");
