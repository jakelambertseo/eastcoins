const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function filePath(rel) {
  return path.join(ROOT, ...rel.split("/"));
}

function mustRead(rel) {
  const p = filePath(rel);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing required file: ${rel}`);
  }
  return fs.readFileSync(p, "utf8");
}

function replaceOne(content, before, after, label) {
  const count = content.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected 1 match, found ${count}.`);
  }
  return content.replace(before, after);
}

function replaceRegexOne(content, pattern, after, label) {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;

  const matches = [
    ...content.matchAll(
      new RegExp(pattern.source, flags)
    )
  ];

  if (matches.length !== 1) {
    throw new Error(
      `${label}: expected 1 match, found ${matches.length}.`
    );
  }

  const replaceFlags = pattern.flags.replace(/g/g, "");
  return content.replace(
    new RegExp(pattern.source, replaceFlags),
    after
  );
}

function replaceSection(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found.`);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker not found.`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function requireIncludes(content, marker, label) {
  if (!content.includes(marker)) {
    throw new Error(`${label}: required marker not found.`);
  }
}

const files = new Map();
for (const rel of [
  "index.html",
  "v2/index.html",
  "v2/assets/js/player.js",
  "v2/assets/js/router.js",
  "v2/assets/js/app.js",
  "v2/assets/css/launch.css",
  "picks.html",
  "player.html",
  "assets/eastcoins-embedded-view.css",
  "assets/eastcoins-mlb-gameday.js",
  "changelog.html"
]) {
  files.set(rel, mustRead(rel));
}

const MLB_GAMEDAY = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "replacement",
    "v2",
    "assets",
    "js",
    "mlb-gameday.js"
  ),
  "utf8"
);

/* ================================================================
   Picks explainer: distinguish real sportsbook reference odds from
   the ZCoin pari-mutuel/community-pool payout.
   ================================================================ */
{
  let html = files.get("picks.html");

  html = html.replaceAll("How Picks Works", "How Picks Work");
  html = html.replaceAll("How EastCoin Picks Works", "How EastCoin Picks Work");

  const oldRules = `      <div class="rules-list">
        <div class="rule"><strong>1 ZCoin minimum</strong><p>Small wallets can still participate without risking most of their balance.</p></div>
        <div class="rule"><strong>Your max = lower of 15% of wallet or 50 ZCoins</strong><p>This limits whale influence while still rewarding members who have accumulated ZCoins.</p></div>
        <div class="rule"><strong>Community action sets the payout</strong><p>The current multiplier is total ZCoins in the game divided by ZCoins on that side.</p></div>
        <div class="rule"><strong>Final pool multiplier locks at game start</strong><p>Your projected community-pool return may move before lock as more ZCoins enter the market.</p></div>
        <div class="rule"><strong>One-sided markets are No Action</strong><p>If only one team has action when the market locks, every ticket is refunded.</p></div>
        <div class="rule"><strong>One pick per game</strong><p>Once you lock a side, you cannot also pick the other team in that same game.</p></div>
      </div>`;

  const newRules = `      <div class="rules-list">
        <div class="rule"><strong>Live sportsbook moneylines are real reference odds</strong><p>For supported games, EastCoin matches the event to The Odds API and shows the current sportsbook consensus/reference moneyline. Those market prices can move before game time and are shown for real-world context.</p></div>
        <div class="rule"><strong>Sportsbook odds do not directly set your ZCoin payout</strong><p>EastCoin Picks uses a community pool. Your projected multiplier is total ZCoins wagered on the game divided by the ZCoins currently on your selected side.</p></div>
        <div class="rule"><strong>Your projected return moves with the community pool</strong><p>Example: if 100 ZCoins are in the game and 40 are on your side, the current projection is 2.50x. More Picks on either side can change that projection before lock.</p></div>
        <div class="rule"><strong>The community multiplier locks when the game starts</strong><p>At the scheduled start, EastCoin freezes the pool used for payout calculations. The sportsbook moneyline remains reference information; the locked EastCoin pool determines the ZCoin return.</p></div>
        <div class="rule"><strong>One-sided markets are No Action</strong><p>If only one side has community action when the game locks, the market is No Action and affected ZCoin wagers are refunded instead of creating a one-sided payout.</p></div>
        <div class="rule"><strong>Wager limits protect the pool</strong><p>The minimum is 1 ZCoin. Your maximum wager is the lower of 15% of your available wallet or 50 ZCoins.</p></div>
        <div class="rule"><strong>One pick per game</strong><p>After you confirm a side, you cannot also pick the other side of that same game. Your open and settled activity remains visible in My Picks, History, and the Community Ledger.</p></div>
      </div>`;

  html = replaceOne(html, oldRules, newRules, "Picks rules explainer");
  files.set("picks.html", html);
}

/* ================================================================
   V2/player controller becomes the root launch controller.
   - watch/share URLs are root URLs
   - MLB Gameday syncs with active baseball events
   ================================================================ */
{
  let js = files.get("v2/assets/js/player.js");

  js = replaceOne(
    js,
    `      new URL(
        "/v2/",
        window.location.origin
      );`,
    `      new URL(
        "/",
        window.location.origin
      );`,
    "root watch URL"
  );

  js = replaceOne(
    js,
    `    showWatchView();

    updateWatchBet();

    // Card odds can finish enriching just after a deep-linked player opens.`,
    `    showWatchView();

    updateWatchBet();
    V2.mlbGameday?.sync?.(match);

    // Card odds can finish enriching just after a deep-linked player opens.`,
    "MLB Gameday active-event sync"
  );

  js = replaceOne(
    js,
    `    showWatchView();
    updateWatchBet();
    renderStreams();`,
    `    showWatchView();
    updateWatchBet();
    V2.mlbGameday?.reset?.();
    renderStreams();`,
    "MLB Gameday custom-stream reset"
  );

  js = replaceOne(
    js,
    `    S.active = null;
    S.streams = [];`,
    `    V2.mlbGameday?.reset?.();

    S.active = null;
    S.streams = [];`,
    "MLB Gameday close reset"
  );

  files.set("v2/assets/js/player.js", js);
}

/* ================================================================
   Search Enter behavior: while watching, Enter returns to Events and
   executes the entered text search. URL entries still open as streams.
   ================================================================ */
{
  let js = files.get("v2/assets/js/app.js");

  const replacement = `    E.search.onkeydown = (event) => {
      if (event.key !== "Enter") return;

      const raw = E.search.value.trim();
      if (!raw) return;

      try {
        const url = new URL(raw);
        if (["http:", "https:"].includes(url.protocol)) {
          event.preventDefault();
          E.search.value = "";
          S.search = "";
          V2.player.openCustom(url.href);
          return;
        }
      } catch {
        // Continue below as a normal EastCoin event search.
      }

      event.preventDefault();

      if (
        document.body.classList.contains(
          "ec-watching"
        )
      ) {
        V2.player.closePlayer({
          clearUrl: true
        });
      }

      if (
        V2.router?.current() !==
        "events"
      ) {
        V2.router.go("events");
      }

      S.search =
        raw.toLowerCase();
      S.date = "week";

      V2.events.renderDates();
      V2.events.renderGrid();

      E.search.blur();
    };

`;

  js = replaceSection(
    js,
    "    E.search.onkeydown = (event) => {",
    "    $(\"#clear\").onclick = clearFilters;",
    replacement,
    "watch-view Enter search"
  );

  files.set("v2/assets/js/app.js", js);
}

/* ================================================================
   Root-domain router. Legacy /v2/ remains only a compatibility redirect;
   all user-visible routes and workspace child URLs are absolute from /.
   ================================================================ */
{
  let js = files.get("v2/assets/js/router.js");

  js = js
    .replaceAll('src: "../multiview.html?ecV2Embedded=1"', 'src: "/multiview.html?ecV2Embedded=1"')
    .replaceAll('src: "../picks.html?ecV2Embedded=1"', 'src: "/picks.html?ecV2Embedded=1"')
    .replaceAll('src: "../games.html?ecV2Embedded=1"', 'src: "/games.html?ecV2Embedded=1"')
    .replaceAll('src: "../favorites.html?ecV2Embedded=1"', 'src: "/favorites.html?ecV2Embedded=1"')
    .replaceAll('src: "../picks-kalshi-test.html?ecV2Embedded=1#prop-of-week"', 'src: "/picks-kalshi-test.html?ecV2Embedded=1#prop-of-week"');

  js = replaceOne(
    js,
    `  function urlFor(name) {
    return name === "events" ? "./" : \`?view=\${encodeURIComponent(name)}\`;
  }`,
    `  function urlFor(name) {
    return name === "events"
      ? "/"
      : \`/?view=\${encodeURIComponent(name)}\`;
  }`,
    "root router URL builder"
  );

  files.set("v2/assets/js/router.js", js);
}

/* ================================================================
   MultiView legacy-player cleanup. The MultiView panel itself already owns
   source/layout controls, so nested player.html V1 chrome is hidden.
   ================================================================ */
{
  let html = files.get("player.html");

  const playerBootstrapPattern = /  <script>\r?\n\s*\(\(\) => \{\r?\n\s*if \(new URLSearchParams\(location\.search\)\.get\("shell"\) === "1"\) \{\r?\n\s*document\.documentElement\.classList\.add\("ec-embedded-view"\);\r?\n\s*\}\r?\n\s*\}\)\(\);\r?\n\s*<\/script>/;

  const newBootstrap = `  <script>
    (() => {
      const params = new URLSearchParams(location.search);

      if (params.get("shell") === "1") {
        document.documentElement.classList.add("ec-embedded-view");
      }

      if (params.get("multiview") === "1") {
        document.documentElement.classList.add("ec-multiview-player");
      }
    })();
  </script>`;

  html = replaceRegexOne(
    html,
    playerBootstrapPattern,
    newBootstrap,
    "MultiView player document class"
  );
  files.set("player.html", html);

  let css = files.get("assets/eastcoins-embedded-view.css");
  if (!css.includes("EASTCOIN MULTIVIEW PLAYER CLEANUP")) {
    css += `

/* ================================================================
   EASTCOIN MULTIVIEW PLAYER CLEANUP
   The parent MultiView owns controls. Nested legacy player chrome is removed.
   ================================================================ */
html.ec-multiview-player .player-toolbar,
html.ec-multiview-player .ec-utility-dock,
html.ec-multiview-player .streamed-server-panel,
html.ec-multiview-player .copy-link-tooltip,
html.ec-multiview-player #eastcoinMlbGamedayButton,
html.ec-multiview-player #eastcoinMlbGamedayOverlay{
  display:none!important;
}

html.ec-multiview-player .embed-frame{
  width:100%!important;
  height:100%!important;
}
`;
  }
  files.set("assets/eastcoins-embedded-view.css", css);

  let mlbLegacy = files.get("assets/eastcoins-mlb-gameday.js");
  if (
    !mlbLegacy.includes(
      '.get("multiview") === "1"'
    )
  ) {
    mlbLegacy = replaceRegexOne(
      mlbLegacy,
      /  "use strict";\r?\n\r?\n\s*const BUTTON_ID/,
      `  "use strict";

  if (
    new URLSearchParams(
      window.location.search
    ).get("multiview") === "1"
  ) {
    return;
  }

  const BUTTON_ID`,
      "disable legacy Gameday inside MultiView"
    );
  }
  files.set("assets/eastcoins-mlb-gameday.js", mlbLegacy);
}

/* ================================================================
   Gameday UI styling in the new root player.
   ================================================================ */
{
  let css = files.get("v2/assets/css/launch.css");

  if (!css.includes("EASTCOIN ROOT MLB GAMEDAY")) {
    css += `

/* ================================================================
   EASTCOIN ROOT MLB GAMEDAY
   ================================================================ */
.watch-actions #watchGameday{
  border-color:rgba(229,185,43,.24);
  color:#ffe5a0;
  background:linear-gradient(180deg,rgba(129,22,39,.94),rgba(78,10,23,.97));
}

.watch-actions #watchGameday:hover,
.watch-actions #watchGameday.active{
  border-color:rgba(240,210,121,.52);
  color:#fff4d0;
  background:linear-gradient(180deg,rgba(166,31,55,.98),rgba(102,14,30,.98));
}

.ec-v2-mlb-gameday{
  position:absolute;
  inset:0;
  z-index:80;
  overflow:hidden;
  background:
    radial-gradient(circle at 50% 10%,rgba(123,20,37,.17),transparent 34%),
    #050404;
}

.ec-v2-mlb-gameday[hidden]{
  display:none!important;
}

.ec-v2-mlb-gameday-frame{
  position:absolute;
  inset:0;
  z-index:2;
  width:100%;
  height:100%;
  border:0;
  opacity:0;
  background:#050404;
  transition:opacity .14s ease;
}

.ec-v2-mlb-gameday.is-ready .ec-v2-mlb-gameday-frame{
  opacity:1;
}

.ec-v2-mlb-gameday-loading{
  position:absolute;
  inset:0;
  z-index:1;
  display:grid;
  place-content:center;
  justify-items:center;
  gap:8px;
  padding:30px;
  color:#f5ead8;
  text-align:center;
  background:
    radial-gradient(circle at 50% 42%,rgba(123,20,37,.18),transparent 30%),
    #050404;
}

.ec-v2-mlb-gameday-loading strong{
  color:#fff0c8;
  font-size:.95rem;
}

.ec-v2-mlb-gameday-loading small{
  color:#978a7c;
  font-size:.72rem;
}

.ec-v2-mlb-gameday.is-ready .ec-v2-mlb-gameday-loading{
  opacity:0;
  visibility:hidden;
  pointer-events:none;
}

.ec-v2-mlb-gameday-spinner{
  width:34px;
  height:34px;
  border:3px solid rgba(209,173,85,.16);
  border-top-color:#d1ad55;
  border-radius:50%;
  animation:ec-root-mlb-spin .8s linear infinite;
}

@keyframes ec-root-mlb-spin{
  to{transform:rotate(360deg)}
}

.ec-v2-mlb-gameday-close{
  position:absolute;
  z-index:5;
  top:10px;
  right:10px;
  width:36px;
  height:36px;
  display:grid;
  place-items:center;
  border:1px solid rgba(209,173,85,.28);
  border-radius:9px;
  color:#f6ead6;
  background:rgba(16,9,10,.94);
  box-shadow:0 8px 24px rgba(0,0,0,.42);
  font-size:1.15rem;
}

.ec-v2-mlb-gameday-close:hover,
.ec-v2-mlb-gameday-close:focus-visible{
  border-color:rgba(235,204,122,.62);
  color:#fff6d8;
  background:#57101f;
  outline:0;
}
`;
  }

  files.set("v2/assets/css/launch.css", css);
}

/* ================================================================
   Build the production root index from the hardened EastCoin shell.
   The /v2/ document becomes a compatibility redirect that preserves query/hash.
   Internal asset files may remain under /v2/assets; navigation does not.
   ================================================================ */
{
  let shell = files.get("v2/index.html");

  shell = shell
    .replaceAll('href="../assets/', 'href="/assets/')
    .replaceAll('src="../assets/', 'src="/assets/')
    .replaceAll('href="assets/css/', 'href="/v2/assets/css/')
    .replaceAll('src="assets/js/', 'src="/v2/assets/js/')
    .replaceAll('href="./"', 'href="/"')
    .replaceAll('EastCoin V2', 'EastCoin')
    .replaceAll('EASTCOIN V2', 'EASTCOIN')
    .replaceAll('V2 opens the URL directly in its player iframe.', 'EastCoin opens the URL directly in its player.');

  shell = shell.replace(
    '/api/picks/auth/twitch/start?returnTo=%2Fv2%2F',
    '/api/picks/auth/twitch/start?returnTo=%2F'
  );

  shell = shell.replace(
    /<footer>EastCoin[\s\S]*?<\/footer>/,
    '<footer>EastCoin · <a href="/changelog.html">Changelog</a></footer>'
  );

  shell = replaceOne(
    shell,
    '<button id="watchMultiView" type="button">＋ MultiView</button>',
    `<button id="watchMultiView" type="button">＋ MultiView</button>
          <button class="watch-gameday" id="watchGameday" type="button" hidden aria-expanded="false">⚾ Gameday</button>`,
    "root Gameday control"
  );

  shell = replaceOne(
    shell,
    '<script defer src="/v2/assets/js/multiview-handoff.js?v=40"></script>',
    `<script defer src="/v2/assets/js/multiview-handoff.js?v=40"></script>
<script defer src="/v2/assets/js/mlb-gameday.js?v=41"></script>`,
    "root Gameday script"
  );

  shell = shell
    .replaceAll('/v2/assets/js/player.js?v=40', '/v2/assets/js/player.js?v=41')
    .replaceAll('/v2/assets/js/router.js?v=40', '/v2/assets/js/router.js?v=41')
    .replaceAll('/v2/assets/js/app.js?v=40', '/v2/assets/js/app.js?v=41')
    .replaceAll('/v2/assets/css/launch.css?v=40', '/v2/assets/css/launch.css?v=41')
    .replaceAll('aria-label="EastCoin V2 page workspace"', 'aria-label="EastCoin page workspace"')
    .replaceAll('title="EastCoin V2 page"', 'title="EastCoin page"');

  if (/href="\.\.\//.test(shell) || /src="\.\.\//.test(shell)) {
    throw new Error("Root index still contains parent-relative asset/navigation paths.");
  }

  if (/EastCoin V2|EASTCOIN V2/.test(shell)) {
    throw new Error("Root index still contains visible EastCoin V2 wording.");
  }

  files.set("index.html", shell);

  const redirect = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EastCoin</title>
<script>
(() => {
  const target = "/" + window.location.search + window.location.hash;
  window.location.replace(target);
})();
</script>
<noscript><meta http-equiv="refresh" content="0;url=/"></noscript>
</head>
<body></body>
</html>`;

  files.set("v2/index.html", redirect);
}

/* ================================================================
   Changelog
   ================================================================ */
{
  let html = files.get("changelog.html");
  const title = "EastCoin moves to the root domain with MLB Gameday and launch fixes";

  if (!html.includes(`<h2>${title}</h2>`)) {
    html = html.replace(
      /<div class="release-count">(\d+) major update groups<\/div>/,
      (_, count) => `<div class="release-count">${Number(count) + 1} major update groups</div>`
    );

    html = html.replace(
      '<article class="timeline-entry latest">',
      '<article class="timeline-entry">'
    );
    html = html.replace(/\s*<span class="latest-badge">Latest<\/span>/, "");

    const entry = `
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-27">August 27, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Promoted the hardened EastCoin application to the root domain so Events,
    shared event/watch links, Picks, MultiView, games and Twitch login all work
    from eastcoin.vip without a /v2/ page path; old /v2/ page links now forward
    to the equivalent root URL. Updated the Picks rules popup to explain the
    real sportsbook consensus moneylines used as live reference odds and the
    separate community-pool multiplier that determines ZCoin returns. Restored
    MLB Gameday as a main-player control for verified MLB matchups using the
    existing MLB Game Center. MultiView panels now suppress the remaining legacy
    player toolbar and utility controls, while the parent MultiView controls stay
    intact. Pressing Enter in the global search while watching an event now exits
    the player, returns to Events and applies the requested team/game search.
</p>
</article>
`;

    const end = html.lastIndexOf("</section>");
    if (end < 0) throw new Error("Could not locate changelog timeline.");
    html = html.slice(0, end) + entry + html.slice(end);
  }

  files.set("changelog.html", html);
}

/* ================================================================
   PRE-WRITE VALIDATION — no file is written unless every check passes.
   ================================================================ */
const checks = [
  ["index.html", '<title>EastCoin | Events</title>', "root EastCoin shell"],
  ["index.html", 'id="watchGameday"', "root Gameday control"],
  ["index.html", '/v2/assets/js/mlb-gameday.js?v=41', "root Gameday module"],
  ["v2/index.html", 'window.location.replace(target)', "/v2/ compatibility redirect"],
  ["v2/assets/js/player.js", 'new URL(\n        "/",', "root watch links"],
  ["v2/assets/js/player.js", 'V2.mlbGameday?.sync?.(match)', "Gameday player sync"],
  ["v2/assets/js/router.js", 'src: "/multiview.html?ecV2Embedded=1"', "root workspace routes"],
  ["v2/assets/js/app.js", 'Continue below as a normal EastCoin event search.', "watch search Enter fix"],
  ["picks.html", 'Live sportsbook moneylines are real reference odds', "Picks real odds explainer"],
  ["player.html", 'ec-multiview-player', "MultiView player mode"],
  ["assets/eastcoins-embedded-view.css", 'EASTCOIN MULTIVIEW PLAYER CLEANUP', "MultiView legacy control cleanup"],
  ["v2/assets/css/launch.css", 'EASTCOIN ROOT MLB GAMEDAY', "Gameday styles"]
];

for (const [rel, marker, label] of checks) {
  requireIncludes(files.get(rel), marker, label);
}

if (/\/v2\/(?:\?|$)/.test(files.get("v2/assets/js/player.js"))) {
  throw new Error("Player still generates user-facing /v2/ watch URLs.");
}

if (/EastCoin V2|EASTCOIN V2/.test(files.get("index.html"))) {
  throw new Error("Root launch page still contains EastCoin V2 wording.");
}

/* ================================================================
   ALL PREFLIGHTS PASSED — WRITE
   ================================================================ */
for (const [rel, content] of files) {
  const p = filePath(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log(`Updated: ${rel}`);
}

const gamedayPath = filePath("v2/assets/js/mlb-gameday.js");
fs.mkdirSync(path.dirname(gamedayPath), { recursive: true });
fs.writeFileSync(gamedayPath, MLB_GAMEDAY, "utf8");
console.log("Created: v2/assets/js/mlb-gameday.js");

console.log("");
console.log("EastCoin Launch Iteration 41 complete.");
console.log("Root domain is now the production application entry point.");
