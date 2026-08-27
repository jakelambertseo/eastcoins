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
      `${label}: expected exactly one matching block, found ${count}. ` +
      "Make sure your local repo is synced to the current EastCoin main branch."
    );
  }
  return content.replace(before, after);
}

function replaceSection(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  if (start < 0) {
    throw new Error(`${label}: start marker was not found.`);
  }

  const end = content.indexOf(endMarker, start + startMarker.length);
  if (end < 0) {
    throw new Error(`${label}: end marker was not found.`);
  }

  return content.slice(0, start) + replacement + content.slice(end);
}

/* ================================================================
   v2/index.html
   ================================================================ */
{
  const rel = "v2/index.html";
  let html = read(rel);

  html = replaceOnce(
    html,
    '<link href="assets/css/watch-view.css?v=36" rel="stylesheet">',
    '<link href="assets/css/watch-view.css?v=37" rel="stylesheet">',
    "watch-view cache version"
  );

  html = replaceOnce(
    html,
    '          <button id="playerChat" type="button">💬 Chat</button>',
    [
      '          <button class="v1-bet" id="watchBet" type="button" hidden>Bet</button>',
      '          <button class="watch-collapse" id="watchCollapse" type="button" aria-expanded="true">▾ Collapse</button>'
    ].join("\n"),
    "watch action buttons"
  );

  html = replaceOnce(
    html,
    '<script src="assets/js/player.js?v=36"></script>',
    '<script src="assets/js/player.js?v=37"></script>',
    "player cache version"
  );

  write(rel, html);
}

/* ================================================================
   v2/assets/js/app.js
   ================================================================ */
{
  const rel = "v2/assets/js/app.js";
  let js = read(rel);

  js = replaceOnce(
    js,
    '    $("#playerChat").onclick = V2.player.openChat;\n',
    "",
    "removed watch Chat listener"
  );

  write(rel, js);
}

/* ================================================================
   v2/assets/js/player.js
   ================================================================ */
{
  const rel = "v2/assets/js/player.js";
  let js = read(rel);

  js = replaceOnce(
    js,
`  const watchMultiView =
    document.querySelector("#watchMultiView");

  let pendingPreference = null;`,
`  const watchMultiView =
    document.querySelector("#watchMultiView");

  const watchBet =
    document.querySelector("#watchBet");

  const watchCollapse =
    document.querySelector("#watchCollapse");

  const WATCH_CONTROLS_KEY =
    "eastcoinV2WatchControlsCollapsed";

  let pendingPreference = null;`,
    "watch control element bindings"
  );

  const watchHelpers = [
    '  function savedControlsCollapsed() {',
    '    try {',
    '      return (',
    '        localStorage.getItem(',
    '          WATCH_CONTROLS_KEY',
    '        ) === "true"',
    '      );',
    '    } catch {',
    '      return false;',
    '    }',
    '  }',
    '',
    '  function setControlsCollapsed(',
    '    collapsed,',
    '    {',
    '      save = true',
    '    } = {}',
    '  ) {',
    '    const next =',
    '      Boolean(collapsed);',
    '',
    '    E.player?.classList.toggle(',
    '      "controls-collapsed",',
    '      next',
    '    );',
    '',
    '    if (watchCollapse) {',
    '      watchCollapse.textContent =',
    '        next',
    '          ? "☷ Show Controls"',
    '          : "▾ Collapse";',
    '',
    '      watchCollapse.setAttribute(',
    '        "aria-expanded",',
    '        String(!next)',
    '      );',
    '',
    '      watchCollapse.setAttribute(',
    '        "aria-label",',
    '        next',
    '          ? "Show player controls"',
    '          : "Collapse player controls"',
    '      );',
    '    }',
    '',
    '    if (save) {',
    '      try {',
    '        localStorage.setItem(',
    '          WATCH_CONTROLS_KEY,',
    '          String(next)',
    '        );',
    '      } catch {}',
    '    }',
    '  }',
    '',
    '  function toggleControls() {',
    '    setControlsCollapsed(',
    '      !E.player?.classList.contains(',
    '        "controls-collapsed"',
    '      )',
    '    );',
    '  }',
    '',
    '  function supportedMoneylineKey(value) {',
    '    const key =',
    '      String(value || "")',
    '        .toLowerCase();',
    '',
    '    return (',
    '      key.startsWith(',
    '        "americanfootball_"',
    '      ) ||',
    '      key.startsWith(',
    '        "baseball_"',
    '      ) ||',
    '      key ===',
    '        "mma_mixed_martial_arts"',
    '    );',
    '  }',
    '',
    '  function hasAmericanPrice(value) {',
    '    const number =',
    '      Number(value);',
    '',
    '    return (',
    '      Number.isFinite(number) &&',
    '      number !== 0',
    '    );',
    '  }',
    '',
    '  function canShowWatchBet(match) {',
    '    if (',
    '      !match ||',
    '      String(',
    '        match.id || ""',
    '      ).startsWith("custom:")',
    '    ) {',
    '      return false;',
    '    }',
    '',
    '    const start =',
    '      V2.ts(match?.date);',
    '',
    '    if (',
    '      V2.live(match) ||',
    '      !Number.isFinite(start) ||',
    '      start <= Date.now()',
    '    ) {',
    '      return false;',
    '    }',
    '',
    '    const odds =',
    '      V2.cardOdds?.forMatch?.(',
    '        match',
    '      ) || null;',
    '',
    '    return Boolean(',
    '      odds?.providerEventId &&',
    '      odds?.provider === "odds_api" &&',
    '      supportedMoneylineKey(',
    '        odds?.sportKey',
    '      ) &&',
    '      hasAmericanPrice(',
    '        odds?.away?.american',
    '      ) &&',
    '      hasAmericanPrice(',
    '        odds?.home?.american',
    '      )',
    '    );',
    '  }',
    '',
    '  function updateWatchBet() {',
    '    if (!watchBet) return;',
    '',
    '    watchBet.hidden =',
    '      !canShowWatchBet(',
    '        S.active',
    '      );',
    '  }',
    '',
    '  function openBet() {',
    '    if (!S.active) return;',
    '',
    '    if (!canShowWatchBet(S.active)) {',
    '      V2.toast(',
    '        V2.live(S.active) ||',
    '        V2.ts(S.active?.date) <=',
    '          Date.now()',
    '          ? "Betting is closed for this event."',
    '          : "Betting is not available for this event."',
    '      );',
    '      updateWatchBet();',
    '      return;',
    '    }',
    '',
    '    V2.quickBet?.open?.(',
    '      S.active',
    '    );',
    '  }',
    '',
  ].join("\n");

  js = replaceOnce(
    js,
    "  function activeStream() {",
    watchHelpers + "  function activeStream() {",
    "watch collapse and Bet helpers"
  );

  const genericServerName = [
    '  function serverName(stream, index) {',
    '    return `Server ${index + 1}`;',
    '  }',
    '',
  ].join("\n");

  js = replaceSection(
    js,
    "  function serverName(stream, index) {",
    "  function watchUrl() {",
    genericServerName,
    "standard server naming"
  );

  js = replaceOnce(
    js,
`    E.player.hidden = false;
    E.player.setAttribute(
      "aria-hidden",
      "false"
    );`,
`    E.player.hidden = false;
    E.player.setAttribute(
      "aria-hidden",
      "false"
    );

    setControlsCollapsed(
      savedControlsCollapsed(),
      {
        save: false
      }
    );

    updateWatchBet();`,
    "watch view preference application"
  );

  js = replaceOnce(
    js,
`    showWatchView();

    if (V2.events?.addRecent) {`,
`    showWatchView();

    updateWatchBet();

    // Card odds can finish enriching just after a deep-linked player opens.
    // Recheck briefly so an eligible event gets the same Bet shortcut as its
    // Events card without changing the stream or Twitch chat.
    [500, 1500, 3000].forEach(
      (delay) => {
        window.setTimeout(
          updateWatchBet,
          delay
        );
      }
    );

    if (V2.events?.addRecent) {`,
    "watch Bet availability refresh"
  );

  const renderStreams = [
    '  function renderStreams() {',
    '    if (!E.streams) return;',
    '',
    '    if (watchServerCount) {',
    '      watchServerCount.textContent =',
    '        `${S.streams.length} ${',
    '          S.streams.length === 1',
    '            ? "server"',
    '            : "servers"',
    '        } available`;',
    '    }',
    '',
    '    E.streams.innerHTML =',
    '      S.streams',
    '        .map(',
    '          (stream, index) => `',
    '            <button',
    '              class="stream ${',
    '                index ===',
    '                S.activeStreamIndex',
    '                  ? "active"',
    '                  : ""',
    '              }"',
    '              data-stream="${index}"',
    '              type="button"',
    '              title="Switch to ${V2.esc(',
    '                serverName(',
    '                  stream,',
    '                  index',
    '                )',
    '              )}"',
    '              aria-label="Switch to ${V2.esc(',
    '                serverName(',
    '                  stream,',
    '                  index',
    '                )',
    '              )}"',
    '            >',
    '              <span>${V2.esc(',
    '                serverName(',
    '                  stream,',
    '                  index',
    '                )',
    '              )}</span>',
    '            </button>',
    '          `',
    '        )',
    '        .join("");',
    '',
    '    $$(',
    '      "[data-stream]",',
    '      E.streams',
    '    ).forEach((button) => {',
    '      button.onclick = () =>',
    '        selectStream(',
    '          Number(',
    '            button.dataset.stream',
    '          )',
    '        );',
    '    });',
    '  }',
    '',
  ].join("\n");

  js = replaceSection(
    js,
    "  function renderStreams() {",
    "  function selectStream(index) {",
    renderStreams,
    "server button display"
  );

  js = replaceOnce(
    js,
`    showWatchView();
    renderStreams();
    selectStream(0);`,
`    showWatchView();
    updateWatchBet();
    renderStreams();
    selectStream(0);`,
    "custom stream watch controls"
  );

  js = replaceOnce(
    js,
`  watchMultiView?.addEventListener(
    "click",
    addToMultiview
  );

  // Start deep-link restoration`,
`  watchMultiView?.addEventListener(
    "click",
    addToMultiview
  );

  watchBet?.addEventListener(
    "click",
    openBet
  );

  watchCollapse?.addEventListener(
    "click",
    toggleControls
  );

  // Start deep-link restoration`,
    "watch Bet and Collapse listeners"
  );

  js = replaceOnce(
    js,
`    openExternal,
    addToMultiview,
    openPendingFromUrl`,
`    openExternal,
    addToMultiview,
    openBet,
    updateWatchBet,
    setControlsCollapsed,
    toggleControls,
    openPendingFromUrl`,
    "player exports"
  );

  write(rel, js);
}

/* ================================================================
   v2/assets/css/watch-view.css
   ================================================================ */
{
  const rel = "v2/assets/css/watch-view.css";
  let css = read(rel);

  css = replaceOnce(
    css,
`/* EastCoin V2 — Iteration 36
   Full event watch experience */`,
`/* EastCoin V2 — Iteration 37
   Cleaner watch controls, Quick Bet shortcut, generic servers and collapse */`,
    "watch-view iteration header"
  );

  css = replaceOnce(
    css,
`.watch-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:6px;
  flex-wrap:wrap;
}

.watch-controlbar{`,
`.watch-actions{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  gap:6px;
  flex-wrap:wrap;
}

/* Match the gold Bet action used on the V2 Events cards. */
.watch-actions .v1-bet{
  min-width:48px;
  padding:0 10px;
  border:1px solid rgba(229,185,43,.34);
  color:#181100;
  background:linear-gradient(180deg,#f0ce4d,#d6aa13);
  box-shadow:0 6px 20px rgba(0,0,0,.25);
}

.watch-actions .v1-bet:hover{
  border-color:rgba(255,225,118,.55);
  color:#181100;
  background:linear-gradient(180deg,#f6da68,#dfb521);
}

.watch-actions .v1-bet[hidden]{
  display:none!important;
}

.watch-collapse{
  white-space:nowrap;
}

/*
  Collapse hides the title/action overlays and the entire server bar while
  preserving one small recovery button. The stream iframe itself is untouched.
*/
.watchview.controls-collapsed .watch-topbar{
  min-height:0;
  justify-content:flex-end;
  padding:10px;
  background:none;
}

.watchview.controls-collapsed .watch-title,
.watchview.controls-collapsed .watch-actions>button:not(#watchCollapse),
.watchview.controls-collapsed .watch-controlbar{
  opacity:0;
  visibility:hidden;
  pointer-events:none;
}

.watchview.controls-collapsed .watch-actions{
  margin-left:auto;
}

.watchview.controls-collapsed #watchCollapse{
  position:relative;
  z-index:8;
  opacity:1;
  visibility:visible;
  pointer-events:auto;
  border-color:rgba(229,185,43,.22);
  color:#e3d5b2;
  background:rgba(8,8,8,.82);
}

.watchview.controls-collapsed #watchCollapse:hover{
  border-color:rgba(229,185,43,.38);
  color:#f1d969;
}

.watch-controlbar{`,
    "watch Bet and collapse styles"
  );

  css = replaceOnce(
    css,
`.watch-servers .stream small{
  color:#655f58;
  font-size:.54rem;
}

`,
"",
    "obsolete server language style"
  );

  write(rel, css);
}

/* ================================================================
   changelog.html
   ================================================================ */
{
  const rel = "changelog.html";
  let html = read(rel);

  const title =
    "EastCoin V2 watch controls add Quick Bet, clean servers, and collapse mode";

  if (!html.includes("<h2>" + title + "</h2>")) {
    html = replaceOnce(
      html,
      '<div class="release-count">109 major update groups</div>',
      '<div class="release-count">110 major update groups</div>',
      "changelog release count"
    );

    const previousLatest = [
      '<article class="timeline-entry latest">',
      '<div class="timeline-date">',
      '<time datetime="2026-08-27">August 27, 2026</time>',
      '<span class="latest-badge">Latest</span>',
      '</div>',
      '<h2>EastCoin V2 event playback now uses a full watch workspace</h2>'
    ].join("\n");

    const previousNormal = [
      '<article class="timeline-entry">',
      '<div class="timeline-date">',
      '<time datetime="2026-08-27">August 27, 2026</time>',
      '</div>',
      '<h2>EastCoin V2 event playback now uses a full watch workspace</h2>'
    ].join("\n");

    html = replaceOnce(
      html,
      previousLatest,
      previousNormal,
      "previous latest changelog entry"
    );

    const entry = [
      '',
      '<article class="timeline-entry latest">',
      '<div class="timeline-date">',
      '<time datetime="2026-08-27">August 27, 2026</time>',
      '<span class="latest-badge">Latest</span>',
      '</div>',
      '<h2>' + title + '</h2>',
      '<p>',
      '    Simplified the V2 watch workspace controls. Removed the redundant Chat',
      '    button while keeping the persistent Twitch chat and Settings-based chat',
      '    controls intact. Stream choices now display only Server 1, Server 2,',
      '    Server 3, and so on, with provider/source and language labels hidden from',
      '    the interface while exact source IDs remain preserved internally for',
      '    playback and share-link restoration. Added the same gold Bet action used',
      '    on eligible Events cards, opening the existing V2 Quick Bet ticket for the',
      '    active pregame event. Added a remembered Collapse control that hides the',
      '    title/actions and server bar while leaving a small Show Controls button',
      '    available over the video.',
      '</p>',
      '</article>',
      ''
    ].join("\n");

    const timelineEnd = html.lastIndexOf("</section>");
    if (timelineEnd < 0) {
      throw new Error("Could not find changelog timeline closing section.");
    }

    html =
      html.slice(0, timelineEnd) +
      entry +
      html.slice(timelineEnd);
  }

  write(rel, html);
}

console.log("");
console.log("EastCoin V2 Iteration 37 patch complete.");
console.log("Changed:");
console.log("  v2/index.html");
console.log("  v2/assets/js/player.js");
console.log("  v2/assets/js/app.js");
console.log("  v2/assets/css/watch-view.css");
console.log("  changelog.html");
