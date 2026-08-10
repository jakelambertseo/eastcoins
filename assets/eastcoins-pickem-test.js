(() => {
  "use strict";

  const games = {
    early: [
      { id:"gb-chi", away:"GB", awayName:"Packers", home:"CHI", homeName:"Bears", time:"12:00 PM", community:{GB:68,CHI:32}, picked:"GB", locked:false },
      { id:"buf-ne", away:"BUF", awayName:"Bills", home:"NE", homeName:"Patriots", time:"12:00 PM", community:{BUF:73,NE:27}, picked:"BUF", locked:false },
      { id:"bal-cin", away:"BAL", awayName:"Ravens", home:"CIN", homeName:"Bengals", time:"12:00 PM", community:{BAL:57,CIN:43}, picked:"BAL", locked:true, live:true },
      { id:"pit-cle", away:"PIT", awayName:"Steelers", home:"CLE", homeName:"Browns", time:"12:00 PM", community:{PIT:51,CLE:49}, picked:null, locked:false },
      { id:"mia-ind", away:"MIA", awayName:"Dolphins", home:"IND", homeName:"Colts", time:"12:00 PM", community:{MIA:62,IND:38}, picked:null, locked:false }
    ],
    late: [
      { id:"kc-lac", away:"KC", awayName:"Chiefs", home:"LAC", homeName:"Chargers", time:"3:25 PM", community:{KC:71,LAC:29}, picked:"KC", locked:false },
      { id:"sf-sea", away:"SF", awayName:"49ers", home:"SEA", homeName:"Seahawks", time:"3:25 PM", community:{SF:54,SEA:46}, picked:null, locked:false },
      { id:"lv-den", away:"LV", awayName:"Raiders", home:"DEN", homeName:"Broncos", time:"3:05 PM", community:{LV:36,DEN:64}, picked:null, locked:false }
    ],
    prime: [
      { id:"det-lar", away:"DET", awayName:"Lions", home:"LAR", homeName:"Rams", time:"Sun · 7:20 PM", community:{DET:59,LAR:41}, picked:"DET", locked:false },
      { id:"min-nyj", away:"MIN", awayName:"Vikings", home:"NYJ", homeName:"Jets", time:"Mon · 7:15 PM", community:{MIN:61,NYJ:39}, picked:null, locked:false }
    ]
  };

  const leaderboard = [
    { rank:1, name:"Zwades", initials:"ZW", week:"8–1", season:"8–1", pct:"89%", streak:"🔥 5" },
    { rank:2, name:"Jake", initials:"JL", week:"7–2", season:"7–2", pct:"78%", streak:"🔥 4", you:true },
    { rank:3, name:"Booty", initials:"BT", week:"7–2", season:"7–2", pct:"78%", streak:"🔥 2" },
    { rank:4, name:"Waldo", initials:"WA", week:"6–3", season:"6–3", pct:"67%", streak:"1" },
    { rank:5, name:"ChildishA", initials:"CA", week:"5–4", season:"5–4", pct:"56%", streak:"2" },
    { rank:6, name:"Police", initials:"PO", week:"4–5", season:"4–5", pct:"44%", streak:"0" }
  ];

  const made = document.getElementById("pickemMade");
  const progressCopy = document.getElementById("pickemProgressCopy");
  const submitTitle = document.getElementById("pickemSubmitTitle");
  const submitButton = document.getElementById("pickemSubmit");
  const miniBoard = document.getElementById("pickemMiniLeaderboard");
  const fullBoard = document.getElementById("pickemLeaderboardTable");

  const picksView = document.getElementById("pickemPicksView");
  const sidebar = document.getElementById("pickemSidebar");
  const leaderboardView = document.getElementById("pickemLeaderboardView");
  const resultsView = document.getElementById("pickemResultsView");

  let boardMode = "season";
  let activeWeek = 1;

  function allGames() {
    return [...games.early, ...games.late, ...games.prime];
  }

  function remainingCount() {
    return allGames().filter((game) => !game.locked && !game.picked).length;
  }

  function pickedCount() {
    const demoComplete = 1;
    return demoComplete + allGames().filter((game) => game.picked).length;
  }

  function updateProgress() {
    const remaining = remainingCount();
    const total = 16;
    const picked = total - remaining;

    made.textContent = `${picked}/${total}`;
    progressCopy.textContent = remaining
      ? `${remaining} pick${remaining === 1 ? "" : "s"} remaining`
      : "All picks complete";

    submitTitle.textContent = remaining
      ? `${remaining} pick${remaining === 1 ? "" : "s"} remaining`
      : "All Week 1 picks selected";
  }

  function gameMarkup(game) {
    const footerLeft = game.live
      ? '<span class="pickem-result is-live">● Live · pick locked</span>'
      : game.locked
        ? '<span class="pickem-lock-note">🔒 Locked at kickoff</span>'
        : game.picked
          ? '<span class="pickem-lock-note">Pick selected</span>'
          : '<span class="pickem-lock-note">Choose a winner</span>';

    const status = game.live ? "LIVE" : "PICK WINNER";

    return `
      <article class="pickem-game${game.picked ? " has-pick" : ""}${game.locked ? " is-locked" : ""}${game.live ? " is-live" : ""}" data-game-id="${game.id}">
        <div class="pickem-game-meta">
          <span>${status}</span>
          <small>${game.time}</small>
        </div>

        <div class="pickem-matchup">
          <button class="pickem-team${game.picked === game.away ? " is-picked" : ""}" type="button" data-pick-team="${game.away}" ${game.locked ? "disabled" : ""}>
            <span class="pickem-team-mark">${game.away}</span>
            <span><strong>${game.awayName}</strong><small>Away</small></span>
          </button>

          <span class="pickem-versus">AT</span>

          <button class="pickem-team${game.picked === game.home ? " is-picked" : ""}" type="button" data-pick-team="${game.home}" ${game.locked ? "disabled" : ""}>
            <span class="pickem-team-mark">${game.home}</span>
            <span><strong>${game.homeName}</strong><small>Home</small></span>
          </button>
        </div>

        <div class="pickem-game-footer">
          ${footerLeft}
          <span class="pickem-community">Community: ${game.away} ${game.community[game.away]}% · ${game.home} ${game.community[game.home]}%</span>
        </div>
      </article>
    `;
  }

  function renderGames() {
    document.getElementById("pickemEarlyGames").innerHTML =
      games.early.map(gameMarkup).join("");

    document.getElementById("pickemLateGames").innerHTML =
      games.late.map(gameMarkup).join("");

    document.getElementById("pickemPrimeGames").innerHTML =
      games.prime.map(gameMarkup).join("");

    updateProgress();
  }

  function findGame(id) {
    return allGames().find((game) => game.id === id) || null;
  }

  function pick(gameId, team) {
    const game = findGame(gameId);

    if (!game || game.locked) {
      return;
    }

    game.picked = team;
    renderGames();

    window.showToast?.(
      `${team} selected for ${game.away} @ ${game.home}`
    );
  }

  function renderMiniLeaderboard() {
    miniBoard.innerHTML = leaderboard.slice(0, 5).map((row) => `
      <div class="pickem-mini-row${row.you ? " is-you" : ""}">
        <span>${row.rank}</span>
        <strong>${row.name}${row.you ? " · You" : ""}</strong>
        <b>${row.week}</b>
      </div>
    `).join("");
  }

  function renderFullLeaderboard() {
    const recordKey = boardMode === "season" ? "season" : "week";

    fullBoard.innerHTML = `
      <div class="pickem-board-row is-header">
        <span>Rank</span>
        <span>Player</span>
        <span>Record</span>
        <span>Accuracy</span>
        <span>Streak</span>
        <span>GB</span>
      </div>
      ${leaderboard.map((row) => `
        <div class="pickem-board-row${row.you ? " is-you" : ""}">
          <span class="pickem-board-rank">#${row.rank}</span>
          <span class="pickem-board-name">
            <span class="pickem-avatar">${row.initials}</span>
            <strong>${row.name}${row.you ? " · You" : ""}</strong>
          </span>
          <span>${row[recordKey]}</span>
          <span>${row.pct}</span>
          <span>${row.streak}</span>
          <b>${row.rank === 1 ? "—" : `+${row.rank - 1}`}</b>
        </div>
      `).join("")}
    `;
  }

  function setView(view) {
    const isPicks = view === "picks";
    const isBoard = view === "leaderboard";
    const isResults = view === "results";

    picksView.hidden = !isPicks;
    sidebar.hidden = !isPicks;
    leaderboardView.hidden = !isBoard;
    resultsView.hidden = !isResults;

    document.querySelectorAll("[data-pickem-view]").forEach((button) => {
      button.classList.toggle(
        "is-active",
        button.dataset.pickemView === view
      );
    });
  }

  function updateWeek(direction) {
    activeWeek = Math.min(18, Math.max(1, activeWeek + direction));
    document.getElementById("pickemWeekLabel").textContent = `Week ${activeWeek}`;

    if (activeWeek !== 1) {
      window.showToast?.(
        `Week ${activeWeek} shown as a prototype — Week 1 contains the interactive demo.`
      );
    }
  }

  document.addEventListener("click", (event) => {
    const teamButton = event.target.closest("[data-pick-team]");

    if (teamButton) {
      const card = teamButton.closest("[data-game-id]");
      pick(card?.dataset.gameId, teamButton.dataset.pickTeam);
      return;
    }

    const viewButton = event.target.closest("[data-pickem-view]");

    if (viewButton) {
      setView(viewButton.dataset.pickemView);
      return;
    }

    const boardButton = event.target.closest("[data-board-mode]");

    if (boardButton) {
      boardMode = boardButton.dataset.boardMode;

      document.querySelectorAll("[data-board-mode]").forEach((button) => {
        button.classList.toggle(
          "is-active",
          button.dataset.boardMode === boardMode
        );
      });

      renderFullLeaderboard();
    }
  });

  submitButton.addEventListener("click", () => {
    const remaining = remainingCount();

    window.showToast?.(
      remaining
        ? `Picks saved — ${remaining} still open.`
        : "All Week 1 picks saved."
    );
  });

  document.getElementById("pickemPrevWeek").addEventListener(
    "click",
    () => updateWeek(-1)
  );

  document.getElementById("pickemNextWeek").addEventListener(
    "click",
    () => updateWeek(1)
  );

  renderGames();
  renderMiniLeaderboard();
  renderFullLeaderboard();
  setView("picks");
})();
