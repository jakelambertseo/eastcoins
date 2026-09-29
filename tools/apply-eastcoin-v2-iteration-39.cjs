const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function fp(rel) {
  return path.join(ROOT, ...rel.split("/"));
}

function read(rel) {
  const p = fp(rel);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing required file: ${rel}`);
  }
  return fs.readFileSync(p, "utf8");
}

function write(rel, content) {
  fs.writeFileSync(fp(rel), content, "utf8");
  console.log(`Updated: ${rel}`);
}

function replaceOnce(content, before, after, label) {
  const count = content.split(before).length - 1;
  if (count !== 1) {
    throw new Error(
      `${label}: expected exactly one match, found ${count}. ` +
      `Sync to the current EastCoin main branch first.`
    );
  }
  return content.replace(before, after);
}

function replaceSection(content, startMarker, endMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  if (start < 0) throw new Error(`${label}: start marker not found.`);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`${label}: end marker not found.`);
  return content.slice(0, start) + replacement + content.slice(end);
}

function insertBefore(content, marker, addition, label) {
  const index = content.indexOf(marker);
  if (index < 0) throw new Error(`${label}: marker not found.`);
  return content.slice(0, index) + addition + content.slice(index);
}

const NEW_BOOTSTRAP = fs.readFileSync(
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

/* ================================================================
   picks.html
   ================================================================ */
{
  const rel = "picks.html";
  let html = read(rel);

  if (!html.includes("ec-v2-picks-embedded-bootstrap")) {
    html = replaceOnce(
      html,
      "<title>EastCoin | Picks</title>\n",
      `<title>EastCoin | Picks</title>
<script id="ec-v2-picks-embedded-bootstrap">
(() => {
  if (
    new URLSearchParams(location.search)
      .get("ecV2Embedded") === "1"
  ) {
    document.documentElement.classList.add(
      "ec-v2-picks-embedded"
    );
  }
})();
</script>
`,
      "Picks embedded pre-paint bootstrap"
    );
  }

  html = html.replace(
    'assets/eastcoins-picks.css?v=1',
    'assets/eastcoins-picks.css?v=2'
  );

  html = replaceOnce(
    html,
    '        <p>Pick winners with ZCoins. Community action sets the payout. Final odds lock when the game starts.</p>\n',
    "",
    "remove Picks filler copy"
  );

  html = replaceOnce(
    html,
    `      <button class="view-tab" type="button" data-view="leaderboard">Leaderboard</button>
      <button class="view-tab" type="button" data-view="history">History</button>`,
    `      <button class="view-tab" type="button" data-view="leaderboard">Leaderboard</button>
      <button class="view-tab" type="button" data-view="history">History</button>
      <button class="view-tab" type="button" data-view="ledger">Community Ledger <span class="tab-count" id="ledgerCount">0</span></button>`,
    "Community Ledger tab"
  );

  html = html.replace(
    "<div><h2>Today's Markets</h2><p id=\"catalogStatus\">Loading current EastCoin games…</p></div>",
    "<div><h2>Open Markets</h2><p id=\"catalogStatus\">Loading current EastCoin markets…</p></div>"
  );

  html = replaceOnce(
    html,
    `    <section class="view" data-view-panel="history">
      <div class="section-head">
        <div><h2>Picks History</h2><p>Only EastCoin Picks wagers, payouts and refunds appear here.</p></div>
        <div class="right-note">Newest first</div>
      </div>
      <div class="history-list" id="historyList"></div>
    </section>`,
    `    <section class="view" data-view-panel="history">
      <div class="section-head">
        <div><h2>Picks History</h2><p>Your EastCoin Picks wagers, payouts and refunds.</p></div>
        <div class="right-note">Newest first</div>
      </div>
      <div class="history-list" id="historyList"></div>
    </section>

    <section class="view" data-view-panel="ledger">
      <div class="section-head">
        <div><h2>Community Ledger</h2><p>Public Picks activity for community transparency — wagers and results, not private wallet balances.</p></div>
        <div class="right-note">Latest 200 records</div>
      </div>
      <div class="community-ledger" id="communityLedger"></div>
    </section>`,
    "Community Ledger panel"
  );

  html = html.replace(
    "Final odds lock at game start",
    "Final pool multiplier locks at game start"
  );

  html = html.replace(
    "Your projected payout may move before lock as more community ZCoins enter the market.",
    "Your projected community-pool return may move before lock as more ZCoins enter the market."
  );

  html = html.replace(
    `      src="https://www.twitch.tv/embed/zwades/chat?parent=eastcoins.pages.dev&amp;parent=eastcoin.vip&amp;parent=www.eastcoin.vip&amp;parent=localhost&amp;parent=127.0.0.1&amp;darkpopout"
      title="zwades Twitch chat"`,
    `      src="about:blank"
      data-src="https://www.twitch.tv/embed/zwades/chat?parent=eastcoins.pages.dev&amp;parent=eastcoin.vip&amp;parent=www.eastcoin.vip&amp;parent=localhost&amp;parent=127.0.0.1&amp;darkpopout"
      title="zwades Twitch chat"`,
    "defer standalone Picks Twitch chat"
  );

  html = html.replace(
    'assets/eastcoins-picks.js?v=1',
    'assets/eastcoins-picks.js?v=2'
  );

  write(rel, html);
}

/* ================================================================
   assets/eastcoins-picks.css
   ================================================================ */
{
  const rel = "assets/eastcoins-picks.css";
  let css = read(rel);

  if (!css.includes("PICKS V2 EMBEDDED + COMMUNITY LEDGER")) {
    css += `

/* ================================================================
   PICKS V2 EMBEDDED + COMMUNITY LEDGER
   ================================================================ */

/*
  /v2/ already owns EastCoin navigation and one persistent Twitch chat.
  Do this from a head-applied html class so the old Picks sidebar never
  receives a first paint before router cleanup runs.
*/
html.ec-v2-picks-embedded,
html.ec-v2-picks-embedded body{
  width:100%;
  min-width:0;
  min-height:100%;
}

html.ec-v2-picks-embedded .shell{
  display:block!important;
  width:100%!important;
  min-width:0!important;
  min-height:100dvh!important;
  grid-template-columns:minmax(0,1fr)!important;
}

html.ec-v2-picks-embedded .sidebar,
html.ec-v2-picks-embedded .chat{
  display:none!important;
  width:0!important;
  min-width:0!important;
  max-width:0!important;
}

html.ec-v2-picks-embedded .main{
  grid-column:1!important;
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  padding:18px 20px 42px;
}

.page-title h1{
  margin-bottom:0;
}

.view-tabs{
  max-width:100%;
  overflow-x:auto;
  scrollbar-width:none;
}

.view-tabs::-webkit-scrollbar{
  display:none;
}

.view-tab{
  flex:0 0 auto;
  white-space:nowrap;
}

/* Leaderboard is Picks performance only; private wallet balance is not public. */
.leader-head,
.leader-row{
  grid-template-columns:54px minmax(0,1fr) 120px 90px;
}

/* Live-backend failure is explicit rather than silently switching to mock data. */
.backend-note.error{
  color:#e47c87!important;
}

/* ---------------- COMMUNITY LEDGER ---------------- */

.community-ledger{
  overflow:hidden;
  border:1px solid var(--line);
  border-radius:11px;
  background:#070707;
}

.community-ledger > .empty{
  border:0;
  border-radius:0;
}

.community-ledger-row{
  min-height:66px;
  display:grid;
  grid-template-columns:minmax(150px,1.05fr) minmax(190px,1.35fr) 88px 92px 102px;
  align-items:center;
  gap:10px;
  padding:9px 11px;
  border-bottom:1px solid rgba(255,255,255,.05);
}

.community-ledger-row:last-child{
  border-bottom:0;
}

.community-ledger-row.me{
  background:
    linear-gradient(90deg,rgba(242,196,0,.045),transparent 58%),
    #080706;
}

.ledger-user{
  min-width:0;
  display:flex;
  align-items:center;
  gap:8px;
}

.ledger-avatar{
  position:relative;
  width:34px;
  height:34px;
  flex:0 0 34px;
  display:grid;
  place-items:center;
  overflow:hidden;
  border:1px solid rgba(255,255,255,.09);
  border-radius:9px;
  color:#c8beb5;
  background:#0d0d0d;
  font-size:.61rem;
  font-weight:1000;
}

.ledger-avatar img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:cover;
}

.ledger-avatar span{
  position:relative;
  z-index:1;
}

.ledger-avatar.has-image span{
  display:none;
}

.ledger-user-copy,
.ledger-pick{
  min-width:0;
}

.ledger-user-copy strong,
.ledger-pick strong{
  display:block;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.ledger-user-copy strong{
  color:#dfd7cd;
  font-size:.70rem;
}

.ledger-user-copy small{
  display:block;
  margin-top:2px;
  overflow:hidden;
  color:#69635d;
  font-size:.54rem;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.ledger-pick strong{
  color:#e9e1d7;
  font-size:.72rem;
}

.ledger-pick small{
  display:block;
  margin-top:3px;
  overflow:hidden;
  color:#716a63;
  font-size:.56rem;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.ledger-stat{
  text-align:right;
}

.ledger-stat span{
  display:block;
  color:#68615b;
  font-size:.50rem;
  font-weight:900;
  letter-spacing:.05em;
  text-transform:uppercase;
}

.ledger-stat strong{
  display:block;
  margin-top:3px;
  color:#c9c0b6;
  font-size:.66rem;
}

.ledger-stat.net.positive strong{
  color:#83dfa0;
}

.ledger-stat.net.negative strong{
  color:#e77a86;
}

.ledger-result{
  min-width:0;
  text-align:right;
}

.ledger-status{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:58px;
  padding:5px 7px;
  border:1px solid rgba(242,196,0,.14);
  border-radius:999px;
  color:#d0b65c;
  background:rgba(242,196,0,.035);
  font-size:.51rem;
  font-weight:1000;
  text-transform:uppercase;
}

.community-ledger-row.won .ledger-status{
  border-color:rgba(73,210,126,.25);
  color:#9ce8b2;
  background:rgba(73,210,126,.055);
}

.community-ledger-row.lost .ledger-status{
  border-color:rgba(240,107,119,.24);
  color:#ee939d;
  background:rgba(240,107,119,.05);
}

.community-ledger-row.refunded .ledger-status{
  border-color:rgba(129,157,205,.20);
  color:#a8bad9;
  background:rgba(129,157,205,.045);
}

.ledger-result small{
  display:block;
  margin-top:4px;
  color:#605a54;
  font-size:.52rem;
}

@media(max-width:900px){
  html.ec-v2-picks-embedded .main{
    padding:14px 12px 30px;
  }

  .community-ledger-row{
    grid-template-columns:minmax(140px,1fr) minmax(160px,1.2fr) 80px 88px;
  }

  .community-ledger-row .ledger-stat.net{
    display:none;
  }
}

@media(max-width:650px){
  .community-ledger-row{
    grid-template-columns:minmax(0,1fr) auto;
    gap:8px 10px;
  }

  .ledger-user{
    grid-column:1;
  }

  .ledger-result{
    grid-column:2;
    grid-row:1;
  }

  .ledger-pick{
    grid-column:1 / -1;
    padding-top:7px;
    border-top:1px solid rgba(255,255,255,.045);
  }

  .ledger-stat{
    text-align:left;
  }

  .community-ledger-row .ledger-stat.net{
    display:block;
    text-align:right;
  }
}
`;
  }

  write(rel, css);
}

/* ================================================================
   assets/eastcoins-picks.js
   ================================================================ */
{
  const rel = "assets/eastcoins-picks.js";
  let js = read(rel);

  if (!js.includes("const V2_EMBEDDED")) {
    js = replaceOnce(
      js,
      `  const Preview = window.EastcoinPicksPreview;

  if (!Preview) {`,
      `  const Preview = window.EastcoinPicksPreview;

  const QUERY =
    new URLSearchParams(
      window.location.search
    );

  const V2_EMBEDDED =
    QUERY.get("ecV2Embedded") === "1";

  const PREVIEW_REQUESTED =
    QUERY.get("preview") === "1";

  const LOCAL_PREVIEW_ALLOWED =
    ["localhost", "127.0.0.1", "::1"]
      .includes(window.location.hostname);

  if (!Preview) {`,
      "Picks runtime flags"
    );
  }

  js = replaceOnce(
    js,
    `    history:[],
    session:{`,
    `    history:[],
    communityLedger:[],
    session:{`,
    "Picks ledger state"
  );

  js = replaceOnce(
    js,
    `      authenticated:false,
      user:null,
      walletBalance:0`,
    `      authenticated:false,
      user:null,
      walletBalance:0,
      walletConnected:false`,
    "Picks wallet connection state"
  );

  js = replaceOnce(
    js,
    `    historyList:$("historyList"),
    catalogStatus:$("catalogStatus"),`,
    `    historyList:$("historyList"),
    communityLedger:$("communityLedger"),
    ledgerCount:$("ledgerCount"),
    catalogStatus:$("catalogStatus"),`,
    "Picks ledger elements"
  );

  if (!js.includes("function toTimestamp")) {
    js = replaceOnce(
      js,
      `  function initials(value) {
    return Preview.initials(value);
  }
`,
      `  function toTimestamp(
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
      Date.parse(String(value));

    return Number.isFinite(parsed)
      ? parsed
      : fallback;
  }

  function normalizePickStatus(value) {
    const status =
      String(value || "")
        .toUpperCase();

    if (
      status === "ACTIVE" ||
      status === "PENDING_PAYMENT" ||
      status === "PENDING"
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

  function sportFamilyFromKey(value) {
    const key =
      String(value || "")
        .toLowerCase();

    if (key.startsWith("americanfootball_")) {
      return "american-football";
    }

    if (key.startsWith("baseball_")) {
      return "baseball";
    }

    if (
      key === "mma_mixed_martial_arts" ||
      key.includes("mma") ||
      key.includes("ufc")
    ) {
      return "combat";
    }

    if (key.startsWith("basketball_")) {
      return "basketball";
    }

    if (key.startsWith("icehockey_")) {
      return "hockey";
    }

    if (key.startsWith("soccer_")) {
      return "soccer";
    }

    return "other";
  }

  function initials(value) {
    return Preview.initials(value);
  }
`,
      "Picks timestamp/status helpers"
    );
  }

  const oldMarketStart = `    let startsAt = Number(
      raw?.startsAt ||
      raw?.starts_at ||
      raw?.date ||
      0
    );

    if (startsAt && startsAt < 1e12) {
      startsAt *= 1000;
    }`;

  const newMarketStart = `    const startsAt =
      toTimestamp(
        raw?.startsAt ||
        raw?.starts_at ||
        raw?.date,
        Date.now()
      );`;

  js = replaceOnce(
    js,
    oldMarketStart,
    newMarketStart,
    "Picks backend market timestamp"
  );

  js = replaceOnce(
    js,
    `      family:String(raw?.family || raw?.sportFamily || "other"),`,
    `      family:String(
        raw?.family ||
        raw?.sportFamily ||
        sportFamilyFromKey(raw?.sport)
      ),`,
    "Picks sport family normalization"
  );

  js = replaceOnce(
    js,
    `      startTs:startsAt || Date.now(),`,
    `      startTs:startsAt,`,
    "Picks normalized start time"
  );

  const normalizedPickAndLedger = `  function normalizeBackendPick(raw) {
    const market = raw?.market || {};
    const game = normalizeBackendMarket({
      ...market,
      id:raw?.marketId || market?.id,
      away:market?.away || raw?.away,
      home:market?.home || raw?.home
    });

    return {
      id:String(raw?.id || ""),
      gameId:String(raw?.marketId || raw?.gameId || game.id),
      side:String(raw?.selection || raw?.side || ""),
      wager:Number(raw?.wager || 0),
      status:normalizePickStatus(raw?.status),
      createdAt:toTimestamp(
        raw?.createdAt ||
        raw?.created_at,
        Date.now()
      ),
      settledAt:toTimestamp(
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
      payout:Number(raw?.payout || 0),
      profit:Number(raw?.profit || 0),
      game
    };
  }

  function normalizeCommunityLedgerRow(raw) {
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
      id:String(raw?.id || ""),
      user:normalizeUser(
        raw?.user || {}
      ),
      side:String(
        raw?.selection ||
        raw?.side ||
        ""
      ),
      wager:Number(raw?.wager || 0),
      status:normalizePickStatus(
        raw?.status
      ),
      payout:Number(raw?.payout || 0),
      profit:Number(raw?.profit || 0),
      finalMultiplier:
        raw?.finalMultiplier == null
          ? null
          : Number(raw.finalMultiplier),
      createdAt:toTimestamp(
        raw?.createdAt ||
        raw?.created_at,
        Date.now()
      ),
      settledAt:toTimestamp(
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
    normalizedPickAndLedger,
    "Picks backend pick + ledger normalization"
  );

  js = js.replace(
    `"american-football":"NFL",
      baseball:"MLB",`,
    `"american-football":"FOOTBALL",
      baseball:"BASEBALL",`
  );

  js = js.replace(
    `      combat:"UFC",`,
    `      combat:"UFC / MMA",`
  );

  const renderMode = `  function renderMode() {
    const preview =
      state.mode === "preview";

    const unavailable =
      state.mode === "unavailable";

    els.modeBadge.hidden = !preview;

    els.catalogStatus.classList.remove(
      "backend-note",
      "preview",
      "live",
      "error"
    );

    els.catalogStatus.classList.add(
      "backend-note"
    );

    if (preview) {
      els.modeBadge.textContent =
        "Frontend Preview";

      els.catalogStatus.classList.add(
        "preview"
      );

      return;
    }

    if (unavailable) {
      els.catalogStatus.classList.add(
        "error"
      );

      return;
    }

    els.catalogStatus.classList.add(
      "live"
    );
  }

`;

  js = replaceSection(
    js,
    "  function renderMode() {",
    "  function renderAuth() {",
    renderMode,
    "Picks mode rendering"
  );

  js = replaceOnce(
    js,
    `        node.textContent = loggedIn
          ? money(currentWallet())
          : "—";`,
    `        node.textContent =
          loggedIn &&
          state.session.walletConnected
            ? money(currentWallet())
            : "—";`,
    "Picks private wallet display"
  );

  js = replaceOnce(
    js,
    `    const syncLabel =
      state.mode === "backend"
        ? "● Twitch connected · StreamElements wallet"
        : "● Frontend preview · StreamElements wallet mock";`,
    `    const syncLabel =
      state.mode === "backend"
        ? state.session.walletConnected
          ? "● Twitch connected · StreamElements wallet"
          : "● Twitch connected · wallet connection pending"
        : state.mode === "preview"
          ? "● Frontend preview · StreamElements wallet mock"
          : "Picks service unavailable";`,
    "Picks wallet sync status"
  );

  js = replaceOnce(
    js,
    `    els.mainWalletSync.textContent = loggedIn
      ? state.mode === "backend"
        ? "StreamElements ZCoins"
        : "StreamElements ZCoins preview"
      : "Sign in to view balance";`,
    `    els.mainWalletSync.textContent = loggedIn
      ? state.mode === "backend"
        ? state.session.walletConnected
          ? "StreamElements ZCoins"
          : "StreamElements connection pending"
        : state.mode === "preview"
          ? "StreamElements ZCoins preview"
          : "Picks service unavailable"
      : "Sign in to view balance";`,
    "Picks main wallet status"
  );

  js = replaceOnce(
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
        String(state.communityLedger.length);
    }`,
    "Picks ledger tab count"
  );

  js = js.replace(
    `<span style="text-align:right">Record</span>
        <span style="text-align:right">Wallet</span>`,
    `<span style="text-align:right">Record</span>`
  );

  js = js.replace(
    `            <span class="leader-record">${row.wins}–${row.losses}</span>
            <span class="leader-wallet">
              ${row.wallet ? money(row.wallet) + " ZC" : "—"}
            </span>`,
    `            <span class="leader-record">${row.wins}–${row.losses}</span>`
  );

  if (!js.includes("function renderCommunityLedger")) {
    const ledgerRenderer = `  function ledgerStatusLabel(status) {
    if (status === "pending") {
      return "Bet Open";
    }

    if (status === "won") {
      return "Won";
    }

    if (status === "lost") {
      return "Lost";
    }

    if (status === "refunded") {
      return "Refund";
    }

    return status || "Pick";
  }

  function renderCommunityLedger() {
    if (!els.communityLedger) return;

    const rows =
      [...state.communityLedger]
        .sort(
          (a, b) =>
            Number(
              b.settledAt ||
              b.createdAt ||
              0
            ) -
            Number(
              a.settledAt ||
              a.createdAt ||
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
      rows
        .map((row) => {
          const game = row.game || {};
          const pickedName =
            row.side === "away"
              ? game.away
              : game.home;

          const opponent =
            row.side === "away"
              ? game.home
              : game.away;

          const status =
            row.status || "pending";

          const returnAmount =
            status === "won"
              ? Number(row.payout || 0)
              : status === "refunded"
                ? Number(row.wager || 0)
                : status === "lost"
                  ? 0
                  : null;

          const net =
            status === "won"
              ? Number(
                  row.profit ||
                  returnAmount -
                    Number(row.wager || 0)
                )
              : status === "lost"
                ? -Math.abs(
                    Number(row.wager || 0)
                  )
                : status === "refunded"
                  ? 0
                  : null;

          const activityAt =
            row.settledAt ||
            row.createdAt;

          const user =
            row.user || {};

          const mine =
            Boolean(
              state.session.user?.id &&
              user.id &&
              String(
                state.session.user.id
              ) === String(user.id)
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
                <strong>\${pickedName || "Pick"}</strong>
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
                <span>\${returnAmount == null ? "Pool" : "Net"}</span>
                <strong>
                  \${net == null
                    ? "Open"
                    : (net > 0 ? "+" : net < 0 ? "−" : "") +
                      money(Math.abs(net)) +
                      " ZC"}
                </strong>
              </div>

              <div class="ledger-result">
                <span class="ledger-status">\${ledgerStatusLabel(status)}</span>
                <small>\${historyTime(activityAt)}</small>
              </div>
            </article>
          \`;
        })
        .join("");

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

  js = replaceOnce(
    js,
    `    renderLeaderboard();
    renderHistory();`,
    `    renderLeaderboard();
    renderHistory();
    renderCommunityLedger();`,
    "render Picks Community Ledger"
  );

  js = replaceOnce(
    js,
    `    state.history =
      Preview.historyEntries();

    const previewSeason =`,
    `    state.history =
      Preview.historyEntries();

    state.communityLedger = [];

    const previewSeason =`,
    "preview Community Ledger state"
  );

  js = replaceOnce(
    js,
    `    state.session.walletBalance =
      Preview.walletBalance();`,
    `    state.session.walletBalance =
      Preview.walletBalance();

    state.session.walletConnected = true;`,
    "preview wallet connected state"
  );

  js = replaceOnce(
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
    "backend wallet connected state"
  );

  js = replaceOnce(
    js,
    `          createdAt:Number(
            row?.createdAt ||
            row?.created_at ||
            Date.now()
          )`,
    `          createdAt:toTimestamp(
            row?.createdAt ||
            row?.created_at,
            Date.now()
          )`,
    "Picks personal history timestamps"
  );

  if (!js.includes("payload?.communityLedger")) {
    js = replaceOnce(
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
      "Picks backend Community Ledger"
    );
  }

  const bootstrapReplacement = `  function setUnavailable(error) {
    state.mode = "unavailable";
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
      "Picks backend is temporarily unavailable.";

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
          Array.isArray(payload.markets)
        ) {
          applyBackendBootstrap(payload);
          return;
        }

        throw new Error(
          "Picks returned an invalid bootstrap response."
        );
      } catch (error) {
        if (LOCAL_PREVIEW_ALLOWED) {
          console.info(
            "Live Picks unavailable on localhost; using frontend preview.",
            error
          );

          await loadPreview(false);
          return;
        }

        console.error(
          "Live Picks bootstrap failed.",
          error
        );

        setUnavailable(error);
        return;
      }
    }

    if (LOCAL_PREVIEW_ALLOWED) {
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
    bootstrapReplacement,
    "Picks production-safe bootstrap"
  );

  js = replaceOnce(
    js,
    `  async function refresh() {
    if (state.mode === "backend") {
      await bootstrap();
      return;
    }

    await loadPreview(true);
  }`,
    `  async function refresh() {
    if (state.mode === "preview") {
      await loadPreview(true);
      return;
    }

    await bootstrap();
  }`,
    "Picks refresh behavior"
  );

  js = js.replace(
    "Final odds lock when the game starts.",
    "Final pool multiplier locks when the game starts."
  );

  js = js.replace(
    "Final odds remain live until game start.",
    "Projected pool multiplier remains live until game start."
  );

  js = replaceOnce(
    js,
    `    if (state.mode === "backend") {
      window.location.href =
        API.authUrl("/picks.html");
      return;
    }`,
    `    if (state.mode !== "preview") {
      window.location.href =
        API.authUrl(
          V2_EMBEDDED
            ? "/v2/?view=picks"
            : "/picks.html"
        );
      return;
    }`,
    "Picks V2 OAuth return path"
  );

  js = replaceOnce(
    js,
    `      if (state.mode === "backend") {
        await API.logout();
        await bootstrap();
        return;
      }`,
    `      if (state.mode !== "preview") {
        await API.logout();
        await bootstrap();
        return;
      }`,
    "Picks logout mode"
  );

  if (!js.includes("initializeStandalonePicksChat")) {
    js = replaceOnce(
      js,
      `  bootstrap();
})();`,
      `  function initializeStandalonePicksChat() {
    if (V2_EMBEDDED) return;

    const frame =
      document.querySelector(
        ".chat iframe[data-src]"
      );

    if (
      frame &&
      frame.src === "about:blank"
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

  write(rel, js);
}

/* ================================================================
   functions/api/picks/bootstrap.js
   ================================================================ */
write(
  "functions/api/picks/bootstrap.js",
  NEW_BOOTSTRAP
);

/* ================================================================
   v2/assets/js/router.js
   ================================================================ */
{
  const rel = "v2/assets/js/router.js";
  let js = read(rel);

  js = replaceOnce(
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
    "V2 Picks embedded document class"
  );

  js = replaceOnce(
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
    "V2 Picks workspace class"
  );

  write(rel, js);
}

/* ================================================================
   v2/assets/css/workspace.css
   ================================================================ */
{
  const rel = "v2/assets/css/workspace.css";
  let css = read(rel);

  if (!css.includes("V2 PICKS FULL WORKSPACE")) {
    css += `

/* ================================================================
   V2 PICKS FULL WORKSPACE
   Picks is now treated as a native V2 destination: the outer top navigation
   already identifies the route, so the generic iframe title bar is redundant.
   ================================================================ */
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

  write(rel, css);
}

/* ================================================================
   v2/index.html
   ================================================================ */
{
  const rel = "v2/index.html";
  let html = read(rel);

  html = html.replace(
    'assets/css/workspace.css?v=5',
    'assets/css/workspace.css?v=6'
  );

  html = html.replace(
    'assets/js/router.js?v=14',
    'assets/js/router.js?v=15'
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
    "EastCoin Picks gets native V2 embedding, real history, and Community Ledger";

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
    Refreshed the production Picks workspace around the functionality built
    during the V2 Quick Bet work. Picks now enters V2 without flashing or
    reserving its legacy left navigation or duplicate Twitch chat, and the
    redundant V2 iframe title bar is removed. The old intro filler copy was
    removed and market language now distinguishes community-pool multipliers
    from sportsbook reference odds. Added a public Community Ledger showing
    recent member Picks, wagers, wins, losses, refunds and net results without
    exposing private wallet balances. The production bootstrap now supplies
    personal Picks history, real current OPEN-market pool totals and ticket
    counts, community ledger rows and the signed-in member's leaderboard rank.
    Frontend date parsing and backend status normalization were corrected so
    real D1 market times and ACTIVE tickets render accurately. Production no
    longer silently falls back to fake preview data when the Picks backend is
    unavailable; preview mode remains available explicitly or on localhost.
    The leaderboard now focuses only on Picks performance and no longer exposes
    a wallet column.
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
console.log("EastCoin V2 Iteration 39 Picks refresh complete.");
console.log("Changed:");
console.log("  picks.html");
console.log("  assets/eastcoins-picks.css");
console.log("  assets/eastcoins-picks.js");
console.log("  functions/api/picks/bootstrap.js");
console.log("  v2/assets/js/router.js");
console.log("  v2/assets/css/workspace.css");
console.log("  v2/index.html");
console.log("  changelog.html");
