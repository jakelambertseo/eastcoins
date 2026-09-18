const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function filePath(rel) {
  return path.join(
    ROOT,
    ...rel.split("/")
  );
}

function mustRead(rel) {
  const p = filePath(rel);

  if (!fs.existsSync(p)) {
    throw new Error(
      `Missing required file: ${rel}`
    );
  }

  return fs.readFileSync(
    p,
    "utf8"
  );
}

function replaceOne(
  content,
  before,
  after,
  label
) {
  const count =
    content.split(before).length -
    1;

  if (count !== 1) {
    throw new Error(
      `${label}: expected 1 match, found ${count}.`
    );
  }

  return content.replace(
    before,
    after
  );
}

function replaceSection(
  content,
  startMarker,
  endMarker,
  replacement,
  label
) {
  const start =
    content.indexOf(
      startMarker
    );

  if (start < 0) {
    throw new Error(
      `${label}: start marker not found.`
    );
  }

  const end =
    content.indexOf(
      endMarker,
      start +
        startMarker.length
    );

  if (end < 0) {
    throw new Error(
      `${label}: end marker not found.`
    );
  }

  return (
    content.slice(0, start) +
    replacement +
    content.slice(end)
  );
}

function insertBefore(
  content,
  marker,
  addition,
  label
) {
  const index =
    content.indexOf(marker);

  if (index < 0) {
    throw new Error(
      `${label}: marker not found.`
    );
  }

  return (
    content.slice(0, index) +
    addition +
    content.slice(index)
  );
}

function requireIncludes(
  content,
  marker,
  label
) {
  if (!content.includes(marker)) {
    throw new Error(
      `${label}: required marker not found.`
    );
  }
}

/*
  IMPORTANT:
  Every existing file is loaded and transformed in memory first.
  Nothing is written until all preflight transforms succeed.
*/
const files = new Map();

for (const rel of [
  "v2/index.html",
  "v2/assets/js/core.js",
  "v2/assets/js/player.js",
  "v2/assets/js/events.js",
  "v2/assets/js/integrations.js",
  "v2/assets/js/quick-bet.js",
  "v2/assets/js/app.js",
  "v2/assets/js/router.js",
  "v2/assets/css/workspace.css",
  "assets/eastcoins-multiview.js",
  "assets/eastcoins-picks.js",
  "picks.html",
  "functions/api/picks/auth/twitch/start.js",
  "functions/api/picks/auth/twitch/callback.js",
  "changelog.html"
]) {
  files.set(
    rel,
    mustRead(rel)
  );
}

const NEW_INTEGRATIONS =
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "replacement",
      "v2",
      "assets",
      "js",
      "integrations.js"
    ),
    "utf8"
  );

const NEW_MULTIVIEW_HANDOFF =
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "replacement",
      "v2",
      "assets",
      "js",
      "multiview-handoff.js"
    ),
    "utf8"
  );

const NEW_PICKS_BOOTSTRAP =
  fs.readFileSync(
    path.join(
      __dirname,
      "..",
      "replacement",
      "functions",
      "api",
      "picks",
      "bootstrap.js"
    ),
    "utf8"
  );

const LAUNCH_CSS =
`/* EastCoin launch hardening: MultiView handoff + rendering performance */

.multiview-handoff-panel{
  width:min(440px,calc(100vw - 28px));
  overflow:hidden;
  border:1px solid rgba(229,185,43,.18);
  border-radius:13px;
  background:
    radial-gradient(circle at 100% 0%,rgba(122,28,35,.17),transparent 36%),
    #090909;
  box-shadow:0 26px 85px rgba(0,0,0,.7);
}

.multiview-handoff-panel header{
  display:flex;
  align-items:center;
  gap:10px;
  min-height:58px;
  padding:11px 13px;
  border-bottom:1px solid rgba(255,255,255,.065);
}

.multiview-handoff-icon{
  width:36px;
  height:36px;
  flex:0 0 36px;
  display:grid;
  place-items:center;
  border:1px solid rgba(229,185,43,.18);
  border-radius:9px;
  color:#edd067;
  background:rgba(229,185,43,.045);
  font-size:1rem;
}

.multiview-handoff-panel header small{
  display:block;
  color:#887861;
  font-size:.68rem;
  font-weight:1000;
  letter-spacing:.09em;
}

.multiview-handoff-panel header strong{
  display:block;
  margin-top:2px;
  color:#eee6dd;
  font-size:.9rem;
}

.multiview-handoff-body{
  padding:14px;
}

.multiview-handoff-body p{
  margin:0;
  color:#8c837b;
  font-size:.78rem;
  line-height:1.5;
}

.multiview-handoff-actions{
  display:flex;
  justify-content:flex-end;
  gap:7px;
  margin-top:14px;
}

.multiview-handoff-actions button{
  min-height:38px;
  padding:0 12px;
  border:1px solid rgba(255,255,255,.08);
  border-radius:8px;
  color:#9d948c;
  background:#0d0d0d;
  font-size:.76rem;
  font-weight:900;
}

.multiview-handoff-actions .primary{
  border-color:rgba(229,185,43,.26);
  color:#1b1200;
  background:linear-gradient(180deg,#f1ce4b,#d7aa13);
}

.multiview-handoff-actions .primary:hover{
  background:linear-gradient(180deg,#f6da67,#dfb521);
}

/*
  Large sports sections below the viewport do not need full layout/paint work
  during first contentful render. Browsers without content-visibility support
  simply ignore these declarations.
*/
.v1-category-section{
  content-visibility:auto;
  contain-intrinsic-size:auto 680px;
}

.lower{
  content-visibility:auto;
  contain-intrinsic-size:auto 360px;
}
`;

/* ================================================================
   v2/index.html
   ================================================================ */
{
  let html =
    files.get(
      "v2/index.html"
    );

  html = html.replace(
    "<title>EastCoin V2 | Events</title>",
    "<title>EastCoin | Events</title>"
  );

  if (
    !html.includes(
      'rel="preconnect" href="https://streamed.st"'
    )
  ) {
    html = replaceOne(
      html,
      "<title>EastCoin | Events</title>\n",
      `<title>EastCoin | Events</title>
<link rel="preconnect" href="https://streamed.st" crossorigin>
<link rel="preconnect" href="https://api.ppv.st" crossorigin>
<link rel="preconnect" href="https://www.twitch.tv" crossorigin>
<link rel="preconnect" href="https://cdn.7tv.app" crossorigin>
`,
      "launch preconnects"
    );
  }

  if (
    !html.includes(
      'assets/css/launch.css'
    )
  ) {
    html = replaceOne(
      html,
      '<link href="assets/css/quick-bet.css?v=35" rel="stylesheet">',
      `<link href="assets/css/quick-bet.css?v=35" rel="stylesheet">
<link href="assets/css/launch.css?v=40" rel="stylesheet">`,
      "launch CSS include"
    );
  }

  html = html.replaceAll(
    "EASTCOIN V2",
    "EASTCOIN"
  );

  html = html.replaceAll(
    "EastCoin V2",
    "EastCoin"
  );

  html = html.replace(
    "EastCoin Functional Baseline",
    "EastCoin"
  );

  if (
    !html.includes(
      'id="multiviewPrompt"'
    )
  ) {
    const modal = `<div class="modal" id="multiviewPrompt" aria-hidden="true">
  <section class="multiview-handoff-panel" role="dialog" aria-modal="true" aria-labelledby="multiviewPromptTitle">
    <header>
      <span class="multiview-handoff-icon">▥</span>
      <div>
        <small>MULTIVIEW</small>
        <strong id="multiviewPromptTitle">Stream added</strong>
      </div>
    </header>
    <div class="multiview-handoff-body">
      <p id="multiviewPromptMeta">Ready to open MultiView?</p>
      <div class="multiview-handoff-actions">
        <button id="multiviewPromptStay" type="button">Stay Here</button>
        <button class="primary" id="multiviewPromptOpen" type="button">Open MultiView</button>
      </div>
    </div>
  </section>
</div>
`;

    html = insertBefore(
      html,
      '<div class="modal" id="custom">',
      modal,
      "MultiView prompt modal"
    );
  }

  /*
    Delay the very heavy Twitch iframe until the first idle window.
    It remains the same iframe for the rest of the session.
  */
  html = html.replace(
    /<iframe id="persistentTwitchChat" src="([^"]+)" title="zwades Twitch chat"><\/iframe>/,
    '<iframe id="persistentTwitchChat" src="about:blank" data-src="$1" title="zwades Twitch chat"></iframe>'
  );

  if (
    !html.includes(
      'assets/js/multiview-handoff.js'
    )
  ) {
    html = replaceOne(
      html,
      '<script src="assets/js/core.js?v=4"></script>',
      `<script src="assets/js/core.js?v=40"></script>
<script src="assets/js/multiview-handoff.js?v=40"></script>`,
      "MultiView handoff script"
    );
  } else {
    html = html.replace(
      'assets/js/core.js?v=4',
      'assets/js/core.js?v=40'
    );
  }

  for (
    const [oldValue, newValue]
    of [
      [
        'assets/js/player.js?v=37',
        'assets/js/player.js?v=40'
      ],
      [
        'assets/js/events.js?v=30',
        'assets/js/events.js?v=40'
      ],
      [
        'assets/js/integrations.js?v=4',
        'assets/js/integrations.js?v=40'
      ],
      [
        'assets/js/router.js?v=14',
        'assets/js/router.js?v=40'
      ],
      [
        'assets/js/quick-bet.js?v=35',
        'assets/js/quick-bet.js?v=40'
      ],
      [
        'assets/js/app.js?v=19',
        'assets/js/app.js?v=40'
      ],
      [
        'assets/css/workspace.css?v=5',
        'assets/css/workspace.css?v=40'
      ]
    ]
  ) {
    html =
      html.replace(
        oldValue,
        newValue
      );
  }

  /*
    Classic defer scripts preserve source order while letting the browser
    download them in parallel during document parsing.
  */
  html = html.replace(
    /<script(?![^>]*\bdefer\b) src="([^"]+)"><\/script>/g,
    '<script defer src="$1"></script>'
  );

  files.set(
    "v2/index.html",
    html
  );
}

/* ================================================================
   core.js: return-to-login helper, idle scheduler, lazy image decode
   ================================================================ */
{
  let js =
    files.get(
      "v2/assets/js/core.js"
    );

  if (
    !js.includes(
      "function currentReturnTo()"
    )
  ) {
    const helpers = `  function currentReturnTo() {
    const url =
      new URL(
        window.location.href
      );

    url.searchParams.delete(
      "auth"
    );

    return (
      \`\${url.pathname}\${url.search}\${url.hash}\`
    );
  }

  function authUrl(
    returnTo =
      currentReturnTo()
  ) {
    return (
      "/api/picks/auth/twitch/start?returnTo=" +
      encodeURIComponent(
        returnTo
      )
    );
  }

  function idle(
    task,
    timeout = 900
  ) {
    if (
      "requestIdleCallback" in
      window
    ) {
      return window.requestIdleCallback(
        task,
        {
          timeout
        }
      );
    }

    return window.setTimeout(
      task,
      Math.min(
        250,
        timeout
      )
    );
  }

`;

    js = insertBefore(
      js,
      "  Object.assign(V2, {",
      helpers,
      "core launch helpers"
    );
  }

  js = js.replace(
    '? `<img src="${esc(url)}" alt="">`',
    '? `<img src="${esc(url)}" alt="" loading="lazy" decoding="async">`'
  );

  if (
    !js.includes(
      "currentReturnTo,\n    authUrl,\n    idle,"
    )
  ) {
    js = replaceOne(
      js,
      "    write,\n    toast,",
      "    write,\n    currentReturnTo,\n    authUrl,\n    idle,\n    toast,",
      "core helper exports"
    );
  }

  files.set(
    "v2/assets/js/core.js",
    js
  );
}

/* ================================================================
   integrations.js: use full replacement
   ================================================================ */
files.set(
  "v2/assets/js/integrations.js",
  NEW_INTEGRATIONS
);

/* ================================================================
   player.js: exact active stream -> MultiView + deferred chat load
   ================================================================ */
{
  let js =
    files.get(
      "v2/assets/js/player.js"
    );

  if (
    !js.includes(
      "function ensureChatLoaded()"
    )
  ) {
    const loader = `  function ensureChatLoaded() {
    const frame =
      document.querySelector(
        "#persistentTwitchChat"
      );

    if (
      !frame ||
      !frame.dataset.src
    ) {
      return;
    }

    const current =
      frame.getAttribute("src");

    if (
      !current ||
      current === "about:blank"
    ) {
      frame.src =
        frame.dataset.src;
    }
  }

`;

    js = insertBefore(
      js,
      "  function openChat() {",
      loader,
      "persistent chat loader"
    );
  }

  js = replaceOne(
    js,
    `  function openChat() {
    if (V2.settings) {`,
    `  function openChat() {
    ensureChatLoaded();

    if (V2.settings) {`,
    "load Twitch chat on first open"
  );

  const addMv = `  function addToMultiview() {
    const stream =
      activeStream();

    if (
      !S.active ||
      !stream?.embedUrl
    ) {
      V2.toast(
        "No active stream is available to add."
      );
      return;
    }

    V2.multiview?.addStream?.({
      match: S.active,
      stream,
      index:
        Number(
          S.activeStreamIndex ||
          0
        )
    });
  }

`;

  js = replaceSection(
    js,
    "  function defaultMultiviewState() {",
    "  function openPendingFromUrl(",
    addMv,
    "player MultiView handoff"
  );

  files.set(
    "v2/assets/js/player.js",
    js
  );
}

/* ================================================================
   events.js: central MultiView helper + idle enrichment + no visible V2 label
   ================================================================ */
{
  let js =
    files.get(
      "v2/assets/js/events.js"
    );

  const addMv = `  function addToMultiview(match) {
    if (!match) return;

    V2.multiview?.addEvent?.(
      match
    );
  }

`;

  js = replaceSection(
    js,
    "  function defaultMultiviewState() {",
    "  function cardOdds(match) {",
    addMv,
    "event MultiView handoff"
  );

  js = js.replace(
    "Your recently opened V2 events will appear here.",
    "Your recently opened events will appear here."
  );

  js = replaceOne(
    js,
    `      // Score enrichment is optional and never blocks the event catalog.
      V2.cardOdds?.refresh?.(S.events);`,
    `      // Enrichment is useful but is not required for the first event paint.
      V2.idle(
        () =>
          V2.cardOdds?.refresh?.(
            S.events
          ),
        800
      );`,
    "idle odds enrichment"
  );

  js = js.replace(
    /<img src="\$\{V2\.esc\(awayBadge\)\}" alt="">/g,
    '<img src="${V2.esc(awayBadge)}" alt="" loading="lazy" decoding="async" fetchpriority="low">'
  );

  js = js.replace(
    /<img src="\$\{V2\.esc\(homeBadge\)\}" alt="">/g,
    '<img src="${V2.esc(homeBadge)}" alt="" loading="lazy" decoding="async" fetchpriority="low">'
  );

  files.set(
    "v2/assets/js/events.js",
    js
  );
}

/* ================================================================
   quick-bet.js: current-page login + shared Picks bootstrap
   ================================================================ */
{
  let js =
    files.get(
      "v2/assets/js/quick-bet.js"
    );

  const oldFetchStart =
    "  async function fetchBootstrap() {";

  const newFetch =
`  async function fetchBootstrap() {
    if (
      V2.integrations
        ?.picksBootstrap
    ) {
      return (
        V2.integrations
          .picksBootstrap()
      );
    }

    const response = await fetch(
      "/api/picks/bootstrap",
      {
        credentials: "same-origin",
        cache: "no-store"
      }
    );

    const payload =
      await response
        .json()
        .catch(() => null);

    if (
      !response.ok ||
      !payload?.ok
    ) {
      throw new Error(
        payload?.message ||
        "EastCoin Picks could not load your current session."
      );
    }

    return payload;
  }

`;

  js = replaceSection(
    js,
    oldFetchStart,
    "  function previewMarket(match) {",
    newFetch,
    "Quick Bet shared bootstrap"
  );

  js = replaceOne(
    js,
    `    if (!wallet.authenticated) {
      const returnTo =
        encodeURIComponent(
          "/v2/"
        );

      location.href =
        \`/api/picks/auth/twitch/start?returnTo=\${returnTo}\`;
      return;
    }`,
    `    if (!wallet.authenticated) {
      location.href =
        V2.authUrl();
      return;
    }`,
    "Quick Bet current-page login"
  );

  js = js.replace(
    "      V2.integrations?.identity?.();",
    "      V2.integrations?.identity?.({ force: true });"
  );

  files.set(
    "v2/assets/js/quick-bet.js",
    js
  );
}

/* ================================================================
   app.js: auth status + idle chat + idle non-critical feature
   ================================================================ */
{
  let js =
    files.get(
      "v2/assets/js/app.js"
    );

  js = replaceOne(
    js,
    `    // Chat defaults visible, but hide/show never recreates its iframe.
    if (V2.state.settings.chatVisible) V2.player.openChat();

    Promise.all([
      V2.events.load(false),
      V2.integrations.identity(),
      V2.integrations.sicko()
    ]);`,
    `    V2.integrations.handleAuthStatus?.();

    /*
      The visible shell and event catalog get first network/CPU priority.
      Twitch chat stays persistent once mounted, but its heavy iframe waits
      for the first idle window. Sicko is also non-critical launch content.
    */
    if (
      V2.state.settings.chatVisible
    ) {
      V2.idle(
        () =>
          V2.player.openChat(),
        450
      );
    }

    Promise.all([
      V2.events.load(false),
      V2.integrations.identity()
    ]);

    V2.idle(
      () =>
        V2.integrations.sicko(),
      1400
    );`,
    "launch startup scheduling"
  );

  files.set(
    "v2/assets/js/app.js",
    js
  );
}

/* ================================================================
   router.js: complete the Picks native workspace changes that did not
   make it through the previous partial installer.
   ================================================================ */
{
  let js =
    files.get(
      "v2/assets/js/router.js"
    );

  if (
    !js.includes(
      'doc.documentElement.classList.add(\n          "ec-v2-picks-embedded"'
    )
  ) {
    js = replaceOne(
      js,
      `      if (current === "multiview") {
        doc.documentElement.classList.add("ec-v2-embedded");
      }`,
      `      if (current === "multiview") {
        doc.documentElement.classList.add("ec-v2-embedded");
      }

      if (current === "picks") {
        doc.documentElement.classList.add(
          "ec-v2-picks-embedded"
        );
      }`,
      "Picks embedded document class"
    );
  }

  if (
    !js.includes(
      '"workspace-picks"'
    )
  ) {
    js = replaceOne(
      js,
      `    document.body.classList.toggle(
      "workspace-multiview",
      routeName === "multiview"
    );`,
      `    document.body.classList.toggle(
      "workspace-multiview",
      routeName === "multiview"
    );

    document.body.classList.toggle(
      "workspace-picks",
      routeName === "picks"
    );`,
      "Picks workspace route class"
    );
  }

  files.set(
    "v2/assets/js/router.js",
    js
  );
}

/* ================================================================
   workspace.css: native Picks workspace
   ================================================================ */
{
  let css =
    files.get(
      "v2/assets/css/workspace.css"
    );

  if (
    !css.includes(
      "body.workspace-picks .workspacebar"
    )
  ) {
    css += `

/* Picks uses the complete workspace below the persistent EastCoin shell. */
body.workspace-picks .workspace{
  min-height:0;
  overflow:hidden;
}

body.workspace-picks .workspacebar{
  display:none!important;
}

body.workspace-picks .workspace iframe{
  width:100%!important;
  height:100%!important;
  min-width:0;
  min-height:0;
}
`;
  }

  files.set(
    "v2/assets/css/workspace.css",
    css
  );
}

/* ================================================================
   MultiView child: preserve exact-stream metadata
   ================================================================ */
{
  let js =
    files.get(
      "assets/eastcoins-multiview.js"
    );

  js = replaceOne(
    js,
    `              return {
                type: "url",
                url: normalizedUrl,
                title: String(source.title || hostLabel(normalizedUrl)),
                meta: "Manual URL"
              };`,
    `              return {
                type: "url",
                url: normalizedUrl,
                eventId: String(
                  source.eventId || ""
                ),
                title: String(
                  source.title ||
                  hostLabel(
                    normalizedUrl
                  )
                ),
                meta: String(
                  source.meta ||
                  "Manual URL"
                )
              };`,
    "MultiView URL metadata"
  );

  files.set(
    "assets/eastcoins-multiview.js",
    js
  );
}

/* ================================================================
   Picks JS: complete the previously missed launch changes
   ================================================================ */
{
  let js =
    files.get(
      "assets/eastcoins-picks.js"
    );

  if (
    !js.includes(
      "const V2_EMBEDDED"
    )
  ) {
    js = replaceOne(
      js,
      `  const Preview = window.EastcoinPicksPreview;

  if (!Preview) {`,
      `  const Preview = window.EastcoinPicksPreview;

  const QUERY =
    new URLSearchParams(
      window.location.search
    );

  const V2_EMBEDDED =
    QUERY.get(
      "ecV2Embedded"
    ) === "1";

  const PREVIEW_REQUESTED =
    QUERY.get(
      "preview"
    ) === "1";

  const LOCAL_PREVIEW_ALLOWED =
    [
      "localhost",
      "127.0.0.1",
      "::1"
    ].includes(
      window.location.hostname
    );

  if (!Preview) {`,
      "Picks launch runtime flags"
    );
  }

  if (
    !js.includes(
      "communityLedger:[]"
    )
  ) {
    js = replaceOne(
      js,
      "    history:[],\n    session:{",
      "    history:[],\n    communityLedger:[],\n    session:{",
      "Picks ledger state"
    );
  }

  if (
    !js.includes(
      "walletConnected:false"
    )
  ) {
    js = replaceOne(
      js,
      `      authenticated:false,
      user:null,
      walletBalance:0`,
      `      authenticated:false,
      user:null,
      walletBalance:0,
      walletConnected:false`,
      "Picks wallet state"
    );
  }

  if (
    !js.includes(
      'communityLedger:$("communityLedger")'
    )
  ) {
    js = replaceOne(
      js,
      `    historyList:$("historyList"),
    catalogStatus:$("catalogStatus"),`,
      `    historyList:$("historyList"),
    communityLedger:$("communityLedger"),
    ledgerCount:$("ledgerCount"),
    catalogStatus:$("catalogStatus"),`,
      "Picks ledger elements"
    );
  }

  if (
    !js.includes(
      "function toTimestamp("
    )
  ) {
    const helpers = `  function toTimestamp(
    value,
    fallback = 0
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    const numeric =
      Number(value);

    if (
      Number.isFinite(numeric) &&
      numeric > 0
    ) {
      return numeric < 1e12
        ? numeric * 1000
        : numeric;
    }

    const parsed =
      Date.parse(
        String(value)
      );

    return Number.isFinite(
      parsed
    )
      ? parsed
      : fallback;
  }

  function normalizePickStatus(
    value
  ) {
    const status =
      String(value || "")
        .toUpperCase();

    if (
      [
        "ACTIVE",
        "PENDING_PAYMENT",
        "PENDING"
      ].includes(status)
    ) {
      return "pending";
    }

    if (status === "WON") {
      return "won";
    }

    if (status === "LOST") {
      return "lost";
    }

    if (status === "REFUNDED") {
      return "refunded";
    }

    if (status === "CANCELLED") {
      return "cancelled";
    }

    return status
      ? status.toLowerCase()
      : "pending";
  }

  function sportFamilyFromKey(
    value
  ) {
    const key =
      String(value || "")
        .toLowerCase();

    if (
      key.startsWith(
        "americanfootball_"
      )
    ) {
      return "american-football";
    }

    if (
      key.startsWith(
        "baseball_"
      )
    ) {
      return "baseball";
    }

    if (
      key ===
        "mma_mixed_martial_arts" ||
      key.includes("mma") ||
      key.includes("ufc")
    ) {
      return "combat";
    }

    if (
      key.startsWith(
        "basketball_"
      )
    ) {
      return "basketball";
    }

    if (
      key.startsWith(
        "icehockey_"
      )
    ) {
      return "hockey";
    }

    if (
      key.startsWith(
        "soccer_"
      )
    ) {
      return "soccer";
    }

    return "other";
  }

`;

    js = insertBefore(
      js,
      "  function initials(value) {",
      helpers,
      "Picks data helpers"
    );
  }

  const normalizeMarket =
`  function normalizeBackendMarket(raw) {
    const awayRaw =
      raw?.away ||
      raw?.teams?.away ||
      {};

    const homeRaw =
      raw?.home ||
      raw?.teams?.home ||
      {};

    const startsAt =
      toTimestamp(
        raw?.startsAt ||
        raw?.starts_at ||
        raw?.date,
        Date.now()
      );

    const awayZ =
      Number(
        raw?.pool?.awayZcoins ??
        raw?.pool?.away ??
        raw?.awayZcoins ??
        0
      );

    const homeZ =
      Number(
        raw?.pool?.homeZcoins ??
        raw?.pool?.home ??
        raw?.homeZcoins ??
        0
      );

    const awayTickets =
      Number(
        raw?.pool?.awayTickets ??
        raw?.awayTickets ??
        0
      );

    const homeTickets =
      Number(
        raw?.pool?.homeTickets ??
        raw?.homeTickets ??
        0
      );

    return {
      id:String(
        raw?.id ||
        raw?.marketId ||
        raw?.eventId ||
        ""
      ),
      eventId:String(
        raw?.eventId ||
        raw?.event_id ||
        ""
      ),
      sport:String(
        raw?.sport ||
        raw?.category ||
        "other"
      ),
      family:String(
        raw?.family ||
        raw?.sportFamily ||
        sportFamilyFromKey(
          raw?.sport
        )
      ),
      away:String(
        awayRaw?.name ||
        awayRaw?.displayName ||
        "Away"
      ),
      home:String(
        homeRaw?.name ||
        homeRaw?.displayName ||
        "Home"
      ),
      awayLogo:String(
        awayRaw?.badge ||
        awayRaw?.logo ||
        awayRaw?.image ||
        ""
      ),
      homeLogo:String(
        homeRaw?.badge ||
        homeRaw?.logo ||
        homeRaw?.image ||
        ""
      ),
      startTs:startsAt,
      live:Boolean(raw?.live),
      popular:Boolean(
        raw?.popular
      ),
      state:String(
        raw?.state ||
        "OPEN"
      ).toUpperCase(),
      pool:{
        away:awayZ,
        home:homeZ,
        total:Number(
          raw?.pool?.totalZcoins ??
          raw?.pool?.total ??
          awayZ + homeZ
        ),
        awayCount:
          awayTickets,
        homeCount:
          homeTickets
      },
      userPick:
        raw?.userPick ||
        null
    };
  }

`;

  js = replaceSection(
    js,
    "  function normalizeBackendMarket(raw) {",
    "  function normalizeBackendPick(raw) {",
    normalizeMarket,
    "Picks backend market normalization"
  );

  const normalizePick =
`  function normalizeBackendPick(raw) {
    const market =
      raw?.market || {};

    const game =
      normalizeBackendMarket({
        ...market,
        id:
          raw?.marketId ||
          market?.id,
        away:
          market?.away ||
          raw?.away,
        home:
          market?.home ||
          raw?.home
      });

    return {
      id:String(
        raw?.id ||
        ""
      ),
      gameId:String(
        raw?.marketId ||
        raw?.gameId ||
        game.id
      ),
      side:String(
        raw?.selection ||
        raw?.side ||
        ""
      ),
      wager:Number(
        raw?.wager ||
        0
      ),
      status:
        normalizePickStatus(
          raw?.status
        ),
      createdAt:
        toTimestamp(
          raw?.createdAt ||
          raw?.created_at,
          Date.now()
        ),
      settledAt:
        toTimestamp(
          raw?.settledAt ||
          raw?.settled_at,
          0
        ) || null,
      lockedPreview:Number(
        raw?.finalMultiplier ||
        raw?.projectedMultiplier ||
        raw?.lockedPreview ||
        2
      ),
      payout:Number(
        raw?.payout ||
        0
      ),
      profit:Number(
        raw?.profit ||
        0
      ),
      game
    };
  }

  function normalizeCommunityLedgerRow(
    raw
  ) {
    const market =
      raw?.market || {};

    const game =
      normalizeBackendMarket({
        ...market,
        id:
          raw?.marketId ||
          market?.id
      });

    return {
      id:String(
        raw?.id ||
        ""
      ),
      user:
        normalizeUser(
          raw?.user ||
          {}
        ),
      side:String(
        raw?.selection ||
        raw?.side ||
        ""
      ),
      wager:Number(
        raw?.wager ||
        0
      ),
      status:
        normalizePickStatus(
          raw?.status
        ),
      payout:Number(
        raw?.payout ||
        0
      ),
      profit:Number(
        raw?.profit ||
        0
      ),
      finalMultiplier:
        raw?.finalMultiplier ==
        null
          ? null
          : Number(
              raw.finalMultiplier
            ),
      createdAt:
        toTimestamp(
          raw?.createdAt ||
          raw?.created_at,
          Date.now()
        ),
      settledAt:
        toTimestamp(
          raw?.settledAt ||
          raw?.settled_at,
          0
        ) || null,
      game
    };
  }

`;

  js = replaceSection(
    js,
    "  function normalizeBackendPick(raw) {",
    "  function backendMarketSnapshot(",
    normalizePick,
    "Picks backend pick normalization"
  );

  js = js.replace(
    '"american-football":"NFL"',
    '"american-football":"FOOTBALL"'
  );

  js = js.replace(
    'baseball:"MLB"',
    'baseball:"BASEBALL"'
  );

  js = js.replace(
    'combat:"UFC"',
    'combat:"UFC / MMA"'
  );

  const renderLeaderboard =
`  function renderLeaderboard() {
    const rows =
      state.leaderboard
        .map(
          normalizeLeaderboardRow
        );

    if (!rows.length) {
      els.leaderboard.innerHTML =
        '<div class="empty">The Picks leaderboard begins once real Picks are settled.</div>';
      return;
    }

    els.leaderboard.innerHTML = \`
      <div class="leader-head">
        <span>Rank</span>
        <span>User</span>
        <span style="text-align:right">Picks Profit</span>
        <span style="text-align:right">Record</span>
      </div>

      \${rows
        .map(
          (row) => \`
          <div class="leader-row \${
            row.user.login ===
            state.session.user?.login
              ? "me"
              : ""
          }">
            <span class="leader-rank">#\${row.rank}</span>
            <div class="leader-user">
              <span
                class="leader-avatar"
                data-twitch-avatar="\${row.user.login}"
                data-avatar-url="\${row.user.profileImageUrl || ""}">
                <span>\${initials(row.user.displayName || row.user.login)}</span>
              </span>
              <span>
                <strong>\${row.user.displayName || row.user.login}\${row.rank === 1 ? " 👑" : ""}</strong>
                <small>\${row.title || "EastCoin Picks"}</small>
              </span>
            </div>
            <span class="leader-profit">
              \${row.profit >= 0 ? "+" : "−"}\${money(Math.abs(row.profit))} ZC
            </span>
            <span class="leader-record">\${row.wins}–\${row.losses}</span>
          </div>
        \`
        )
        .join("")}
    \`;

    hydrateTwitchAvatars(
      els.leaderboard
    );
  }

`;

  js = replaceSection(
    js,
    "  function renderLeaderboard() {",
    "  function historyTime(timestamp) {",
    renderLeaderboard,
    "Picks leaderboard privacy"
  );

  if (
    !js.includes(
      "function renderCommunityLedger()"
    )
  ) {
    const ledgerRenderer =
`  function ledgerStatusLabel(
    status
  ) {
    return ({
      pending: "Bet Open",
      won: "Won",
      lost: "Lost",
      refunded: "Refund"
    })[status] ||
      status ||
      "Pick";
  }

  function renderCommunityLedger() {
    if (
      !els.communityLedger
    ) {
      return;
    }

    const rows =
      [
        ...state.communityLedger
      ].sort(
        (left, right) =>
          Number(
            right.settledAt ||
            right.createdAt ||
            0
          ) -
          Number(
            left.settledAt ||
            left.createdAt ||
            0
          )
      );

    if (!rows.length) {
      els.communityLedger.innerHTML =
        state.mode === "preview"
          ? '<div class="empty">Community Ledger uses live Picks database records and is not populated with preview users.</div>'
          : '<div class="empty">No community Picks activity has been recorded yet.</div>';
      return;
    }

    els.communityLedger.innerHTML =
      rows.map((row) => {
        const game =
          row.game || {};

        const picked =
          row.side === "away"
            ? game.away
            : game.home;

        const opponent =
          row.side === "away"
            ? game.home
            : game.away;

        const status =
          row.status ||
          "pending";

        const returned =
          status === "won"
            ? Number(
                row.payout || 0
              )
            : status ===
                "refunded"
              ? Number(
                  row.wager || 0
                )
              : status === "lost"
                ? 0
                : null;

        const net =
          status === "won"
            ? Number(
                row.profit ||
                returned -
                  Number(
                    row.wager || 0
                  )
              )
            : status === "lost"
              ? -Math.abs(
                  Number(
                    row.wager || 0
                  )
                )
              : status ===
                  "refunded"
                ? 0
                : null;

        const user =
          row.user || {};

        const mine =
          Boolean(
            state.session.user?.id &&
            user.id &&
            String(
              state.session.user.id
            ) ===
              String(user.id)
          );

        return \`
          <article class="community-ledger-row \${status} \${mine ? "me" : ""}">
            <div class="ledger-user">
              <span
                class="ledger-avatar"
                data-twitch-avatar="\${user.login || ""}"
                data-avatar-url="\${user.profileImageUrl || ""}">
                <span>\${initials(user.displayName || user.login || "EC")}</span>
              </span>
              <span class="ledger-user-copy">
                <strong>\${user.displayName || user.login || "EastCoin User"}</strong>
                <small>\${user.login ? "@" + user.login : "Community member"}</small>
              </span>
            </div>

            <div class="ledger-pick">
              <strong>\${picked || "Pick"}</strong>
              <small>
                vs \${opponent || "Opponent"} ·
                \${familyLabel(game.family, game.sport)}
              </small>
            </div>

            <div class="ledger-stat">
              <span>Wager</span>
              <strong>\${money(row.wager)} ZC</strong>
            </div>

            <div class="ledger-stat net \${net == null ? "" : net >= 0 ? "positive" : "negative"}">
              <span>\${returned == null ? "Pool" : "Net"}</span>
              <strong>
                \${net == null
                  ? "Open"
                  : (net > 0 ? "+" : net < 0 ? "−" : "") +
                    money(
                      Math.abs(net)
                    ) +
                    " ZC"}
              </strong>
            </div>

            <div class="ledger-result">
              <span class="ledger-status">\${ledgerStatusLabel(status)}</span>
              <small>\${historyTime(row.settledAt || row.createdAt)}</small>
            </div>
          </article>
        \`;
      }).join("");

    hydrateTwitchAvatars(
      els.communityLedger
    );
  }

`;

    js = insertBefore(
      js,
      "  function render() {",
      ledgerRenderer,
      "Picks Community Ledger renderer"
    );
  }

  if (
    !js.includes(
      "renderCommunityLedger();"
    )
  ) {
    js = replaceOne(
      js,
      `    renderLeaderboard();
    renderHistory();`,
      `    renderLeaderboard();
    renderHistory();
    renderCommunityLedger();`,
      "Picks ledger render call"
    );
  }

  if (
    !js.includes(
      "state.communityLedger = [];"
    )
  ) {
    js = replaceOne(
      js,
      `    state.history =
      Preview.historyEntries();

    const previewSeason =`,
      `    state.history =
      Preview.historyEntries();

    state.communityLedger = [];

    state.session.walletConnected = true;

    const previewSeason =`,
      "Picks preview ledger state"
    );
  }

  if (
    !js.includes(
      "walletConnected:Boolean("
    )
  ) {
    js = replaceOne(
      js,
      `      walletBalance:Number(
        session?.wallet?.balance ??
        session?.walletBalance ??
        0
      )
    };`,
      `      walletBalance:Number(
        session?.wallet?.balance ??
        session?.walletBalance ??
        0
      ),
      walletConnected:Boolean(
        session?.wallet?.connected
      )
    };`,
      "Picks backend wallet state"
    );
  }

  js = js.replace(
    `          createdAt:Number(
            row?.createdAt ||
            row?.created_at ||
            Date.now()
          )`,
    `          createdAt:toTimestamp(
            row?.createdAt ||
            row?.created_at,
            Date.now()
          )`
  );

  if (
    !js.includes(
      "payload?.communityLedger"
    )
  ) {
    js = replaceOne(
      js,
      `      : [];

    const season = payload?.season || {};`,
      `      : [];

    state.communityLedger =
      Array.isArray(
        payload?.communityLedger
      )
        ? payload.communityLedger
            .map(
              normalizeCommunityLedgerRow
            )
        : [];

    const season = payload?.season || {};`,
      "Picks backend ledger state"
    );
  }

  if (
    !js.includes(
      "els.ledgerCount.textContent"
    )
  ) {
    js = replaceOne(
      js,
      `    els.pendingCount.textContent = String(
      state.tickets.filter(
        (ticket) => ticket.status === "pending"
      ).length
    );`,
      `    els.pendingCount.textContent = String(
      state.tickets.filter(
        (ticket) => ticket.status === "pending"
      ).length
    );

    if (els.ledgerCount) {
      els.ledgerCount.textContent =
        String(
          state.communityLedger.length
        );
    }`,
      "Picks ledger count"
    );
  }

  /*
    Production must not silently turn into a fake betting environment.
    Localhost and explicit ?preview=1 retain the preview.
  */
  if (
    !js.includes(
      "function setUnavailable(error)"
    )
  ) {
    const safeBootstrap =
`  function setUnavailable(
    error
  ) {
    state.mode =
      "unavailable";

    state.backend = null;
    state.games = [];
    state.leaderboard = [];
    state.tickets = [];
    state.history = [];
    state.communityLedger = [];

    state.session = {
      authenticated:false,
      user:null,
      walletBalance:0,
      walletConnected:false
    };

    state.season = {
      wins:0,
      losses:0,
      profit:0,
      accuracy:null,
      rank:null,
      rankTitle:""
    };

    els.catalogStatus.textContent =
      error?.message ||
      "Picks is temporarily unavailable.";

    render();
  }

  async function bootstrap({
    forcePreview = false
  } = {}) {
    els.catalogStatus.textContent =
      "Loading current EastCoin markets…";

    if (
      forcePreview ||
      PREVIEW_REQUESTED
    ) {
      await loadPreview(false);
      return;
    }

    if (API?.getBootstrap) {
      try {
        const payload =
          await API.getBootstrap();

        if (
          payload &&
          Array.isArray(
            payload.markets
          )
        ) {
          applyBackendBootstrap(
            payload
          );
          return;
        }

        throw new Error(
          "Picks returned an invalid response."
        );
      } catch (error) {
        if (
          LOCAL_PREVIEW_ALLOWED
        ) {
          await loadPreview(
            false
          );
          return;
        }

        console.error(
          "Live Picks bootstrap failed.",
          error
        );

        setUnavailable(
          error
        );
        return;
      }
    }

    if (
      LOCAL_PREVIEW_ALLOWED
    ) {
      await loadPreview(false);
      return;
    }

    setUnavailable(
      new Error(
        "The Picks API did not load."
      )
    );
  }

`;

    js = replaceSection(
      js,
      "  async function bootstrap({forcePreview = false} = {}) {",
      "  async function refresh() {",
      safeBootstrap,
      "Picks production bootstrap"
    );
  }

  js = js.replace(
    `  async function refresh() {
    if (state.mode === "backend") {
      await bootstrap();
      return;
    }

    await loadPreview(true);
  }`,
    `  async function refresh() {
    if (
      state.mode === "preview"
    ) {
      await loadPreview(true);
      return;
    }

    await bootstrap();
  }`
  );

  if (
    !js.includes(
      "function authReturnTo()"
    )
  ) {
    const authHelper =
`  function authReturnTo() {
    if (
      V2_EMBEDDED &&
      window.parent !== window
    ) {
      try {
        return (
          window.parent.location.pathname +
          window.parent.location.search +
          window.parent.location.hash
        );
      } catch {}
    }

    return (
      window.location.pathname +
      window.location.search +
      window.location.hash
    );
  }

`;

    js = insertBefore(
      js,
      "  async function completeLogin() {",
      authHelper,
      "Picks auth return helper"
    );
  }

  js = replaceOne(
    js,
    `    if (state.mode === "backend") {
      window.location.href =
        API.authUrl("/picks.html");
      return;
    }`,
    `    if (state.mode !== "preview") {
      window.location.href =
        API.authUrl(
          authReturnTo()
        );
      return;
    }`,
    "Picks current-page login"
  );

  js = js.replace(
    `      if (state.mode === "backend") {
        await API.logout();
        await bootstrap();
        return;
      }`,
    `      if (state.mode !== "preview") {
        await API.logout();
        await bootstrap();
        return;
      }`
  );

  if (
    !js.includes(
      "function initializeStandalonePicksChat()"
    )
  ) {
    js = replaceOne(
      js,
      `  bootstrap();
})();`,
      `  function initializeStandalonePicksChat() {
    if (V2_EMBEDDED) {
      return;
    }

    const frame =
      document.querySelector(
        ".chat iframe[data-src]"
      );

    if (
      frame &&
      frame.getAttribute(
        "src"
      ) === "about:blank"
    ) {
      frame.src =
        frame.dataset.src;
    }
  }

  initializeStandalonePicksChat();
  bootstrap();
})();`,
      "standalone Picks chat loader"
    );
  }

  js = js.replaceAll(
    "Final odds lock when the game starts.",
    "Final pool multiplier locks when the game starts."
  );

  js = js.replaceAll(
    "Final odds remain live until game start.",
    "Projected pool multiplier remains live until game start."
  );

  files.set(
    "assets/eastcoins-picks.js",
    js
  );
}

/* ================================================================
   Picks HTML: cache bust, standalone preconnects, defer scripts
   ================================================================ */
{
  let html =
    files.get(
      "picks.html"
    );

  if (
    !html.includes(
      'rel="preconnect" href="https://www.twitch.tv"'
    )
  ) {
    html = replaceOne(
      html,
      "<title>EastCoin | Picks</title>\n",
      `<title>EastCoin | Picks</title>
<link rel="preconnect" href="https://www.twitch.tv" crossorigin>
`,
      "Picks Twitch preconnect"
    );
  }

  html = html.replace(
    'assets/eastcoins-picks.js?v=2',
    'assets/eastcoins-picks.js?v=40'
  );

  html = html.replace(
    /<script(?![^>]*\bdefer\b) src="([^"]+)"><\/script>/g,
    '<script defer src="$1"></script>'
  );

  files.set(
    "picks.html",
    html
  );
}

/* ================================================================
   Picks backend: full current launch-safe bootstrap replacement
   ================================================================ */
files.set(
  "functions/api/picks/bootstrap.js",
  NEW_PICKS_BOOTSTRAP
);

/* ================================================================
   OAuth return length: exact watch links can be longer than 500 chars
   ================================================================ */
for (
  const rel of [
    "functions/api/picks/auth/twitch/start.js",
    "functions/api/picks/auth/twitch/callback.js"
  ]
) {
  let js =
    files.get(rel);

  js = replaceOne(
    js,
    "    raw.length > 500",
    "    raw.length > 1800",
    `${rel} returnTo limit`
  );

  files.set(
    rel,
    js
  );
}

/* ================================================================
   Changelog: launch naming cleanup + new release entry
   ================================================================ */
{
  let html =
    files.get(
      "changelog.html"
    );

  /*
    EastCoin is graduating from its development label. Historical entries
    remain readable, but the visible product is no longer called "V2".
  */
  html = html
    .replaceAll(
      "EASTCOIN V2",
      "EASTCOIN"
    )
    .replaceAll(
      "EastCoin V2",
      "EastCoin"
    )
    .replace(/\bV2's\b/g, "EastCoin's")
    .replace(/\bV2\b/g, "EastCoin");

  const title =
    "Launch hardening adds return-to-page login, exact MultiView handoff, and faster startup";

  if (
    !html.includes(
      `<h2>${title}</h2>`
    )
  ) {
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

    const entry =
`
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-27">August 27, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Completed a pre-launch reliability and performance pass. Twitch login now
    returns members to the exact EastCoin page, route, or active watch link they
    started from. The player’s + MultiView action now saves the exact currently
    playing server/video instead of re-resolving the event later, and all
    MultiView add actions show a Stay Here / Open MultiView confirmation. The
    previously partial Picks Community Ledger update was completed end-to-end:
    real D1 ledger/history records, current community pools, backend ticket-state
    normalization, accurate market timestamps, private-wallet leaderboard cleanup,
    production-safe preview behavior, and native Picks workspace routing are now
    connected. Startup work was reduced by sharing the Picks identity request,
    deferring the persistent Twitch iframe and non-critical enrichment until the
    first idle window, preconnecting required third-party origins, parallelizing
    launch script downloads with defer, lazily decoding team imagery, and deferring
    offscreen section paint. Visible development-version wording was removed from
    the launch-facing EastCoin experience and changelog.
</p>
</article>
`;

    const timelineEnd =
      html.lastIndexOf(
        "</section>"
      );

    if (timelineEnd < 0) {
      throw new Error(
        "Could not locate changelog timeline."
      );
    }

    html =
      html.slice(
        0,
        timelineEnd
      ) +
      entry +
      html.slice(
        timelineEnd
      );
  }

  files.set(
    "changelog.html",
    html
  );
}

/* ================================================================
   PRE-WRITE VALIDATION
   ================================================================ */

const requiredFinal = [
  [
    "v2/index.html",
    "Open MultiView",
    "MultiView prompt"
  ],
  [
    "v2/index.html",
    "assets/js/multiview-handoff.js?v=40",
    "MultiView module include"
  ],
  [
    "v2/index.html",
    "<title>EastCoin | Events</title>",
    "launch title"
  ],
  [
    "v2/assets/js/core.js",
    "function authUrl(",
    "auth helper"
  ],
  [
    "v2/assets/js/player.js",
    "V2.multiview?.addStream?.",
    "exact stream handoff"
  ],
  [
    "v2/assets/js/events.js",
    "V2.multiview?.addEvent?.",
    "event handoff"
  ],
  [
    "assets/eastcoins-picks.js",
    "function renderCommunityLedger()",
    "Community Ledger renderer"
  ],
  [
    "assets/eastcoins-picks.js",
    "function authReturnTo()",
    "Picks return-to-page auth"
  ],
  [
    "functions/api/picks/bootstrap.js",
    "communityLedger",
    "Community Ledger backend"
  ],
  [
    "v2/assets/js/router.js",
    "workspace-picks",
    "native Picks workspace"
  ]
];

for (
  const [
    rel,
    marker,
    label
  ] of requiredFinal
) {
  requireIncludes(
    files.get(rel),
    marker,
    label
  );
}

/*
  Visible launch-facing shell must not contain the old product label.
  Internal JS object names and /v2/ URL paths intentionally remain unchanged.
*/
for (
  const rel of [
    "v2/index.html",
    "changelog.html"
  ]
) {
  const content =
    files.get(rel);

  if (
    /EastCoin V2|EASTCOIN V2/.test(
      content
    )
  ) {
    throw new Error(
      `${rel}: visible EastCoin V2 wording remains.`
    );
  }
}

/* ================================================================
   ALL PREFLIGHTS PASSED — WRITE ATOMIC SET
   ================================================================ */

for (
  const [rel, content]
  of files
) {
  const p =
    filePath(rel);

  fs.mkdirSync(
    path.dirname(p),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    p,
    content,
    "utf8"
  );

  console.log(
    `Updated: ${rel}`
  );
}

/* New launch files */
for (
  const [
    rel,
    content
  ] of [
    [
      "v2/assets/js/multiview-handoff.js",
      NEW_MULTIVIEW_HANDOFF
    ],
    [
      "v2/assets/css/launch.css",
      LAUNCH_CSS
    ]
  ]
) {
  const p =
    filePath(rel);

  fs.mkdirSync(
    path.dirname(p),
    {
      recursive: true
    }
  );

  fs.writeFileSync(
    p,
    content,
    "utf8"
  );

  console.log(
    `Created: ${rel}`
  );
}

console.log("");
console.log("EastCoin launch hardening Iteration 40 complete.");
console.log("Preflight passed before any files were written.");
