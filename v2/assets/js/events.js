(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;
  const E = V2.els;
  const $ = V2.$;
  const $$ = V2.$$;

  const CATEGORY_INITIAL_LIMIT = 15;
  const expandedCategories = new Set();
  let categoryRenderSignature = "";

  function categoryFilterSignature() {
    return [
      S.sport,
      S.date,
      S.status,
      S.search,
      S.sort
    ].join("|");
  }

  function syncCategoryExpansionState() {
    const signature = categoryFilterSignature();

    if (signature === categoryRenderSignature) {
      return;
    }

    categoryRenderSignature = signature;
    expandedCategories.clear();
  }

  function redZoneText(match) {
    return [
      match?.title,
      match?.name,
      match?.category,
      match?.sport,
      match?.league,
      match?.network,
      match?.channel,
      match?.broadcast,
      match?.broadcaster,
      match?.station,
      match?.tv,
      match?.network_name,
      match?.channel_name,
      match?._eastcoinProviders?.ppv?.network,
      match?._eastcoinProviders?.ppv?.channel
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isRedZone(match) {
    const text = redZoneText(match);

    return (
      text.includes("redzone") ||
      text.includes("red zone")
    );
  }

  function eventFamily(match) {
    return isRedZone(match)
      ? "american-football"
      : V2.family(match);
  }

  function merge(discovery, allResult) {
    const map = new Map();

    S.live = new Set((discovery?.live?.data || []).map(V2.id));

    for (const match of [
      ...(allResult?.data || []),
      ...(discovery?.today?.data || []),
      ...(discovery?.live?.data || [])
    ]) {
      const key = V2.id(match);
      const current = map.get(key);

      const richness = (item) =>
        (item?._eastcoinLive ? 100 : 0) +
        V2.sources(item) * 10 +
        (item?._eastcoinProviders?.ppv ? 3 : 0);

      if (!current || richness(match) > richness(current)) {
        map.set(key, {
          ...match,
          id: key,
          _eastcoinLive: S.live.has(key) || Boolean(match?._eastcoinLive)
        });
      }
    }

    const now = Date.now();

    return [...map.values()].filter((match) =>
      V2.live(match) ||
      !V2.ts(match?.date) ||
      (
        V2.ts(match.date) > now - 21600000 &&
        V2.ts(match.date) < now + 7 * 86400000
      )
    );
  }

  const FINAL_CARD_GRACE_MS = 10 * 60 * 1000;

  function finalScore(match) {
    const score = cardScore(match);

    return Boolean(
      score?.completed &&
      Number.isFinite(Number(score.awayScore)) &&
      Number.isFinite(Number(score.homeScore))
    );
  }

  function effectiveLive(match) {
    return V2.live(match) && !finalScore(match);
  }

  function finalCardExpired(match) {
    if (!finalScore(match)) return false;

    const score = cardScore(match);
    const updated = Date.parse(String(score?.lastUpdate || ""));

    // If the provider omitted last_update, remove the completed event from the
    // normal timeline immediately rather than leaving a stale LIVE stream card.
    if (!Number.isFinite(updated)) return true;

    return Date.now() - updated > FINAL_CARD_GRACE_MS;
  }

  function recommendationScore(match) {
    let score = 0;
    const eventTime = V2.ts(match?.date);
    const now = Date.now();

    if (isRedZone(match)) score += 100000;
    if (effectiveLive(match)) score += 10000;
    if (match?.popular) score += 1200;

    score += Math.min(V2.sources(match), 10) * 40;

    if (eventTime > now) {
      const hoursUntilStart = (eventTime - now) / 3600000;
      score += Math.max(0, 900 - hoursUntilStart * 20);
      if (S.settings?.startingSoonFirst) score += Math.max(0, 3600 - hoursUntilStart * 240);
    }

    if (["american-football", "basketball", "baseball", "combat"].includes(eventFamily(match))) {
      score += 100;
    }

    return score;
  }

  function sorted(events) {
    return [...events].sort((left, right) =>
      S.sort === "time"
        ? (V2.ts(left?.date) || 9e15) - (V2.ts(right?.date) || 9e15)
        : recommendationScore(right) - recommendationScore(left)
    );
  }

  function filtered() {
    return sorted(S.events.filter((match) => {
      const family = eventFamily(match);
      const isLive = effectiveLive(match);
      const isFinal = finalScore(match);

      // A verified final score overrides a provider/stream that is still
      // technically marked live. Keep the FINAL card briefly for context,
      // then remove it from the normal Events timeline.
      if (isFinal && finalCardExpired(match)) {
        return false;
      }

      const sportMatch =
        S.sport === "all" ||
        (S.sport === "live" && isLive) ||
        (S.sport === "other"
          ? ["other", "wrestling", "motorsport", "golf"].includes(family)
          : family === S.sport);

      const statusMatch =
        S.status === "all" ||
        (S.status === "live" && isLive) ||
        (
          S.status === "upcoming" &&
          !V2.live(match) &&
          !isFinal &&
          V2.ts(match?.date) > Date.now()
        ) ||
        (
          S.status === "saved" &&
          S.favorites.has(V2.id(match))
        );

      const dateKey = V2.dayKey(match);

      const dateMatch =
        isLive ||
        isFinal ||
        (
          S.date === "week"
            ? ["today", "day1", "day2", "day3", "day4", "week"].includes(dateKey)
            : dateKey === S.date
        );

      const haystack = [
        match?.title,
        match?.category,
        match?.sport,
        match?.league,
        match?.teams?.home?.name,
        match?.teams?.away?.name
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        sportMatch &&
        statusMatch &&
        dateMatch &&
        (!S.search || haystack.includes(S.search))
      );
    }));
  }

  function renderDates() {
    const now = new Date();
    let markup = "";

    for (let index = 0; index < 5; index += 1) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + index
      );

      const key = index ? `day${index}` : "today";

      const label =
        index === 0
          ? "Today"
          : index === 1
            ? "Tomorrow"
            : date.toLocaleDateString(undefined, { weekday: "short" });

      markup += `
        <button class="date ${S.date === key ? "active" : ""}" data-date="${key}">
          <small>${date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</small>
          <strong>${date.getDate()}</strong>
          <span>${label}</span>
        </button>
      `;
    }

    markup += `
      <button class="date ${S.date === "week" ? "active" : ""}" data-date="week">
        <small>7D</small>
        <strong>＋</strong>
        <span>This Week</span>
      </button>
    `;

    E.dates.innerHTML = markup;

    $$("[data-date]", E.dates).forEach((button) => {
      button.onclick = () => {
        S.date = button.dataset.date;
        renderDates();
        renderGrid();
      };
    });
  }

  function toggleFavorite(key) {
    if (S.favorites.has(key)) {
      S.favorites.delete(key);
    } else {
      S.favorites.add(key);
    }

    V2.write("eastcoinV2Favorites", [...S.favorites]);

    renderGrid();

    if (S.active && V2.id(S.active) === key) {
      E.saveActive.textContent = S.favorites.has(key) ? "★" : "☆";
    }
  }

  function renderFeature() {
    // Featured landing surface was removed in Iteration 9.
  }

  function renderUpNext() {
    // Up Next rail was removed in Iteration 9.
  }

  function broadcastLabel(match) {
    for (const value of [
      match?.network,
      match?.channel,
      match?.broadcast,
      match?.broadcaster,
      match?.station,
      match?.tv,
      match?.network_name,
      match?.channel_name,
      match?._eastcoinProviders?.ppv?.network,
      match?._eastcoinProviders?.ppv?.channel
    ]) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }

    return "";
  }

  function defaultMultiviewState() {
    return {
      layout: 4,
      slots: [null, null, null, null],
      splits: {
        2: { col: 50, row: 50 },
        3: { col: 50, row: 50 },
        4: { col: 50, row: 50 }
      }
    };
  }

  function readMultiviewState() {
    const raw = V2.read("eastcoinMultiviewV1", null);

    if (!raw || !Array.isArray(raw.slots)) {
      return defaultMultiviewState();
    }

    return {
      layout: [2, 3, 4].includes(Number(raw.layout))
        ? Number(raw.layout)
        : 4,
      slots: [...raw.slots.slice(0, 4), null, null, null, null].slice(0, 4),
      splits:
        raw.splits && typeof raw.splits === "object"
          ? raw.splits
          : defaultMultiviewState().splits
    };
  }

  function multiviewSource(match) {
    const [, label] = V2.sportMeta(V2.family(match));

    return {
      type: "event",
      id: V2.id(match),
      title: String(match?.title || "EastCoin event"),
      meta: label
    };
  }

  function addToMultiview(match) {
    if (!match) return;

    const mv = readMultiviewState();
    const key = V2.id(match);

    const existing = mv.slots.findIndex(
      (slot) =>
        slot?.type === "event" &&
        String(slot.id) === key
    );

    if (existing !== -1) {
      V2.toast(`${match.title || "Event"} is already in MultiView slot ${existing + 1}.`);
      return;
    }

    const slot = mv.slots.findIndex((item) => !item);

    if (slot === -1) {
      V2.toast("MultiView is full. Open MultiView to manage your four slots.");
      return;
    }

    mv.slots[slot] = multiviewSource(match);

    if (slot >= 3) mv.layout = 4;
    else if (slot === 2 && Number(mv.layout) < 3) mv.layout = 3;
    else if (slot === 1 && Number(mv.layout) < 2) mv.layout = 2;

    V2.write("eastcoinMultiviewV1", mv);

    V2.toast(
      `${match.title || "Event"} added to MultiView slot ${slot + 1}.`
    );
  }

  function cardOdds(match) {
    return V2.cardOdds?.forMatch?.(match) || null;
  }

  function cardScore(match) {
    return V2.cardScores?.forMatch?.(match) || null;
  }

  function scoreNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? String(number)
      : "—";
  }

  function americanPrice(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number === 0) return "";

    return number > 0
      ? `+${Math.round(number)}`
      : String(Math.round(number));
  }

  function oddsBadge(side, odds) {
    const price = americanPrice(odds?.[side]?.american);

    if (!price) return "";

    return `
      <span class="v1-team-odds" title="Consensus moneyline">
        <small>ML</small>
        <strong>${V2.esc(price)}</strong>
      </span>
    `;
  }

  function matchupBackground(away, home) {
    const awayBadge = V2.badge(away);
    const homeBadge = V2.badge(home);

    if (!awayBadge && !homeBadge) {
      return `
        <div class="v1-matchup-bg v1-matchup-bg-empty" aria-hidden="true">
          <span>VS</span>
        </div>
      `;
    }

    return `
      <div class="v1-matchup-bg" aria-hidden="true">
        <div class="v1-matchup-bg-side away">
          ${awayBadge
            ? `<img src="${V2.esc(awayBadge)}" alt="">`
            : `<span>${V2.esc(V2.initials(away?.name || "Away"))}</span>`
          }
        </div>

        <div class="v1-matchup-bg-center">
          <i></i>
          <span>VS</span>
          <i></i>
        </div>

        <div class="v1-matchup-bg-side home">
          ${homeBadge
            ? `<img src="${V2.esc(homeBadge)}" alt="">`
            : `<span>${V2.esc(V2.initials(home?.name || "Home"))}</span>`
          }
        </div>
      </div>
    `;
  }

  function categoryOrder(family) {
    const order = [
      "american-football",
      "baseball",
      "combat",
      "soccer",
      "basketball",
      "hockey",
      "tennis",
      "other"
    ];

    const index = order.indexOf(family);
    return index === -1 ? order.length : index;
  }

  function categorySection(family, matches) {
    const [icon, label] = V2.sportMeta(family);

    // RedZone is a featured NFL broadcast surface. Keep it at the front of
    // Football regardless of Recommended vs Time sorting.
    const orderedMatches =
      family === "american-football"
        ? [
            ...matches.filter(isRedZone),
            ...matches.filter((match) => !isRedZone(match))
          ]
        : matches;

    const liveCount = orderedMatches.filter(effectiveLive).length;
    const finalCount = orderedMatches.filter(finalScore).length;
    const upcomingCount = Math.max(
      0,
      orderedMatches.length - liveCount - finalCount
    );

    const subtitle =
      liveCount
        ? `${liveCount} live now`
        : finalCount && !upcomingCount
          ? `${finalCount} final`
          : `${upcomingCount} upcoming`;

    // Live and Saved are intentional narrow views, so do not hide results
    // behind a category expander there.
    const canCollapse =
      orderedMatches.length > CATEGORY_INITIAL_LIMIT &&
      S.status !== "live" &&
      S.sport !== "live" &&
      S.status !== "saved";

    const expanded =
      canCollapse &&
      expandedCategories.has(family);

    const visibleMatches =
      canCollapse && !expanded
        ? orderedMatches.slice(0, CATEGORY_INITIAL_LIMIT)
        : orderedMatches;

    const hiddenCount =
      Math.max(
        0,
        orderedMatches.length - visibleMatches.length
      );

    const expander =
      canCollapse
        ? `
          <div class="v1-category-expander">
            <button
              type="button"
              data-category-expand="${V2.esc(family)}"
              aria-expanded="${expanded ? "true" : "false"}"
            >
              <span class="v1-category-expander-icon">${expanded ? "−" : "＋"}</span>
              <strong>
                ${expanded
                  ? "Show Fewer Games"
                  : `Show ${hiddenCount} More Game${hiddenCount === 1 ? "" : "s"}`}
              </strong>
              <small>
                ${expanded
                  ? `${orderedMatches.length} games currently shown`
                  : `${visibleMatches.length} of ${orderedMatches.length} shown`}
              </small>
            </button>
          </div>
        `
        : "";

    return `
      <section class="v1-category-section" data-category="${V2.esc(family)}">
        <header class="v1-category-header">
          <div class="v1-category-title">
            <span class="v1-category-icon">${icon}</span>
            <span>
              <strong>${V2.esc(label)}</strong>
              <small>${subtitle}</small>
            </span>
          </div>

          <div class="v1-category-counts">
            ${liveCount
              ? `<span class="live">${liveCount} LIVE</span>`
              : ""}
            ${finalCount
              ? `<span class="final">${finalCount} FINAL</span>`
              : ""}
            <span>${orderedMatches.length} total</span>
          </div>
        </header>

        <div class="v1-category-grid">
          ${visibleMatches.map(card).join("")}
        </div>

        ${expander}
      </section>
    `;
  }

  function hasStarted(match) {
    if (V2.live(match) || finalScore(match)) {
      return true;
    }

    const start = V2.ts(match?.date);

    return Number.isFinite(start) &&
      start <= Date.now();
  }

  function canBet(match) {
    if (hasStarted(match)) return false;

    const start = V2.ts(match?.date);

    return Number.isFinite(start) &&
      start > Date.now();
  }

  function canShowBet(match) {
    if (!canBet(match)) return false;

    const odds = cardOdds(match);

    return Boolean(
      odds?.providerEventId &&
      odds?.provider === "odds_api"
    );
  }

  function redZoneCard(match) {
    const key = V2.id(match);
    const poster = V2.poster(match);
    const saved = S.favorites.has(key);
    const isLive = effectiveLive(match);
    const stateLabel =
      finalScore(match)
        ? "FINAL"
        : isLive
          ? "LIVE NOW"
          : V2.time(match);

    return `
      <article
        class="card v1-event-card v1-redzone-card ${isLive ? "is-live" : ""}"
        data-card-open="${V2.esc(key)}"
        role="button"
        tabindex="0"
        aria-label="Open ${V2.esc(match.title || "NFL RedZone")}"
      >
        <div class="v1-redzone-glow" aria-hidden="true"></div>

        <div class="v1-event-visual">
          ${poster
            ? `<div class="v1-event-bg v1-redzone-bg" style="background-image:url('${V2.esc(poster)}')"></div>`
            : ""}
          <div class="v1-event-shade v1-redzone-shade"></div>

          <div class="v1-event-topbar v1-redzone-topbar">
            <span class="v1-redzone-ribbon">
              <i></i>
              NFL REDZONE
            </span>
            <span class="v1-redzone-state ${isLive ? "live" : ""}">
              ${V2.esc(stateLabel)}
            </span>
          </div>

          <div class="v1-redzone-content">
            <div class="v1-redzone-mark" aria-hidden="true">RZ</div>
            <div class="v1-redzone-copy">
              <small>SUNDAY FOOTBALL COMMAND CENTER</small>
              <strong>${V2.esc(match.title || "NFL RedZone")}</strong>
              <span>
                ${isLive
                  ? "Every scoring drive, pinned first on EastCoin."
                  : `Opens ${V2.esc(V2.datetime(match))}`
                }
              </span>
            </div>
          </div>
        </div>

        <footer class="v1-event-footer v1-redzone-footer">
          <div class="v1-redzone-footer-copy">
            <strong>${isLive ? "RedZone is live" : "RedZone broadcast"}</strong>
            <small>Featured NFL hub</small>
          </div>

          <div class="v1-event-actions">
            <button
              class="v1-save ${saved ? "saved" : ""}"
              data-save="${V2.esc(key)}"
              aria-label="Save NFL RedZone"
            >${saved ? "★" : "☆"}</button>

            <button class="v1-multiview" data-multiview="${V2.esc(key)}">
              ＋ MultiView
            </button>

            <button class="v1-watch v1-redzone-watch" data-watch="${V2.esc(key)}">
              ${isLive ? "Watch RedZone" : "Open RedZone"}
            </button>
          </div>
        </footer>
      </article>
    `;
  }

  function card(match) {
    if (isRedZone(match)) {
      return redZoneCard(match);
    }

    const key = V2.id(match);
    const [icon, label] = V2.sportMeta(eventFamily(match));
    const poster = V2.poster(match);
    const home = match?.teams?.home;
    const away = match?.teams?.away;
    const saved = S.favorites.has(key);
    const odds = cardOdds(match);
    const score = cardScore(match);
    const hasOdds = Boolean(
      americanPrice(odds?.away?.american) &&
      americanPrice(odds?.home?.american)
    );
    const hasScore = Boolean(
      score &&
      Number.isFinite(Number(score.awayScore)) &&
      Number.isFinite(Number(score.homeScore))
    );
    const isFinal = finalScore(match);
    const isLive = effectiveLive(match);

    if (!home && !away) {
      return `
        <article
          class="card v1-event-card v1-event-card-single ${isLive ? "is-live" : ""} ${isFinal ? "is-final" : ""}"
          data-card-open="${V2.esc(key)}"
          role="button"
          tabindex="0"
          aria-label="Open ${V2.esc(match.title || "event")}"
        >
          <div class="v1-event-visual">
            ${poster ? `<div class="v1-event-bg" style="background-image:url('${V2.esc(poster)}')"></div>` : ""}
            <div class="v1-event-shade"></div>

            <div class="v1-event-topbar">
              <span class="v1-event-state ${isLive ? "live" : ""} ${isFinal ? "final" : ""}">
                ${isFinal ? "FINAL" : isLive ? "LIVE" : V2.esc(V2.time(match))}
              </span>
              ${broadcastLabel(match)
                ? `<span class="v1-event-network">📺 ${V2.esc(broadcastLabel(match))}</span>`
                : ""}
            </div>

            <div class="v1-single-event">
              <span>${icon}</span>
              <strong>${V2.esc(match.title || "EastCoin Event")}</strong>
              <small>${V2.esc(label)}</small>
            </div>
          </div>

          <footer class="v1-event-footer">

            <div class="v1-event-actions">
              ${hasStarted(match)
              ? `<button class="v1-bets-closed" type="button" disabled aria-disabled="true">Bets Closed</button>`
              : `<button class="v1-save ${saved ? "saved" : ""}" data-save="${V2.esc(key)}" aria-label="Save event">${saved ? "★" : "☆"}</button>`
            }
              <button class="v1-multiview" data-multiview="${V2.esc(key)}">＋ MultiView</button>

              ${canShowBet(match) ? `<button class="v1-bet" data-bet="${V2.esc(key)}">Bet</button>` : ""}
              <button class="v1-watch" data-watch="${V2.esc(key)}">${isLive ? "Watch" : "Open"}</button>
            </div>
          </footer>
        </article>
      `;
    }

    return `
      <article
        class="card v1-event-card ${isLive ? "is-live" : ""} ${isFinal ? "is-final" : ""}"
        data-card-open="${V2.esc(key)}"
        role="button"
        tabindex="0"
        aria-label="Open ${V2.esc(match.title || "event")}"
      >
        <div class="v1-event-visual">
          ${matchupBackground(away, home)}
          <div class="v1-event-shade v1-matchup-shade"></div>

          <div class="v1-event-topbar">
            <span class="v1-event-state ${V2.live(match) ? "live" : ""}">
              ${V2.live(match) ? "LIVE" : V2.esc(V2.time(match))}
            </span>
            ${broadcastLabel(match)
              ? `<span class="v1-event-network">📺 ${V2.esc(broadcastLabel(match))}</span>`
              : ""}
          </div>

          <div class="v1-matchup ${hasOdds ? "has-odds" : ""}">
            <div class="v1-matchup-team away">
              ${V2.logo(away)}
              <strong>${V2.esc(away?.name || "Away")}</strong>
              ${oddsBadge("away", odds)}
            </div>

            <div class="v1-matchup-center ${hasScore ? "has-live-score" : ""}">
              ${hasScore
                ? `
                  <div class="v1-card-score">
                    <strong>${scoreNumber(score.awayScore)}</strong>
                    <span>–</span>
                    <strong>${scoreNumber(score.homeScore)}</strong>
                  </div>
                  <small class="v1-score-state">${score.completed ? "FINAL" : "LIVE SCORE"}</small>
                `
                : `
                  <span class="v1-vs">VS</span>
                  ${hasOdds
                    ? ""
                    : `<small>${V2.live(match) ? "Live now" : V2.esc(V2.time(match))}</small>`
                  }
                `
              }
            </div>

            <div class="v1-matchup-team home">
              ${V2.logo(home)}
              <strong>${V2.esc(home?.name || "Home")}</strong>
              ${oddsBadge("home", odds)}
            </div>
          </div>
        </div>

        <footer class="v1-event-footer">

          <div class="v1-event-actions">
            ${hasStarted(match)
              ? `<button class="v1-bets-closed" type="button" disabled aria-disabled="true">Bets Closed</button>`
              : `<button class="v1-save ${saved ? "saved" : ""}" data-save="${V2.esc(key)}" aria-label="Save event">${saved ? "★" : "☆"}</button>`
            }
            <button class="v1-multiview" data-multiview="${V2.esc(key)}">＋ MultiView</button>

            ${canShowBet(match) ? `<button class="v1-bet" data-bet="${V2.esc(key)}">Bet</button>` : ""}
            <button class="v1-watch" data-watch="${V2.esc(key)}">${isLive ? "Watch" : "Open"}</button>
          </div>
        </footer>
      </article>
    `;
  }

  function renderGrid() {
    syncCategoryExpansionState();

    const events = filtered();

    E.eventCount.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;

    const groups = new Map();

    events.forEach((match) => {
      const family = eventFamily(match);

      if (!groups.has(family)) {
        groups.set(family, []);
      }

      groups.get(family).push(match);
    });

    const orderedGroups = [...groups.entries()]
      .sort(
        ([left], [right]) =>
          categoryOrder(left) - categoryOrder(right)
      );

    E.grid.innerHTML = orderedGroups
      .map(([family, matches]) => categorySection(family, matches))
      .join("");

    E.grid.hidden = !events.length;
    E.empty.hidden = Boolean(events.length);

    $$("[data-category-expand]", E.grid).forEach((button) => {
      button.onclick = () => {
        const family = String(
          button.dataset.categoryExpand || ""
        );

        if (!family) return;

        const expanding =
          !expandedCategories.has(family);

        if (expanding) {
          expandedCategories.add(family);
        } else {
          expandedCategories.delete(family);
        }

        renderGrid();

        // When collapsing a very long category, return the user to its header
        // instead of leaving the viewport stranded far below the shortened DOM.
        if (!expanding) {
          requestAnimationFrame(() => {
            const section = [...E.grid.querySelectorAll("[data-category]")]
              .find((node) => node.dataset.category === family);

            section?.scrollIntoView?.({
              behavior: "smooth",
              block: "start"
            });
          });
        }
      };
    });

    $$("[data-watch]", E.grid).forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        const match = find(button.dataset.watch);
        if (match) V2.player.openMatch(match);
      };
    });

    $$("[data-multiview]", E.grid).forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        const match = find(button.dataset.multiview);
        if (match) addToMultiview(match);
      };
    });

    $$("[data-bet]", E.grid).forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();

        const match = find(button.dataset.bet);

        if (!match || !canBet(match)) {
          V2.toast("Betting is closed for this event.");
          return;
        }

        if (!canShowBet(match)) {
          V2.toast("Betting is not available for this event.");
          return;
        }

        V2.quickBet?.open?.(match);
      };
    });

    $$("[data-save]", E.grid).forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        toggleFavorite(button.dataset.save);
      };
    });

    $$("[data-card-open]", E.grid).forEach((cardNode) => {
      const open = () => {
        const match = find(cardNode.dataset.cardOpen);
        if (match) V2.player.openMatch(match);
      };

      cardNode.onclick = (event) => {
        if (event.target.closest("button,a,input,label")) return;
        open();
      };

      cardNode.onkeydown = (event) => {
        if (
          event.target !== cardNode ||
          !["Enter", " "].includes(event.key)
        ) {
          return;
        }

        event.preventDefault();
        open();
      };
    });
  }

  function find(key) {
    return S.events.find((match) => V2.id(match) === String(key)) || null;
  }

  function addRecent(match) {
    const item = {
      id: V2.id(match),
      title: match?.title || "EastCoin Event",
      openedAt: Date.now()
    };

    S.recent = [
      item,
      ...S.recent.filter((existing) => existing.id !== item.id)
    ].slice(0, 5);

    V2.write("eastcoinV2Recent", S.recent);
    renderRecent();
  }

  function renderRecent() {
    if (!S.recent.length) {
      E.recent.innerHTML = "<small>Your recently opened V2 events will appear here.</small>";
      return;
    }

    E.recent.innerHTML = S.recent.slice(0, 3).map((item) => {
      const match = find(item.id);

      return `
        <button data-recent="${V2.esc(item.id)}">
          <span>
            <strong>${V2.esc(item.title)}</strong>
            <small>${match ? V2.esc(V2.datetime(match)) : "Previously opened"}</small>
          </span>
          <small>${match ? "Open →" : "Unavailable"}</small>
        </button>
      `;
    }).join("");

    $$("[data-recent]", E.recent).forEach((button) => {
      button.onclick = () => {
        const match = find(button.dataset.recent);

        if (match) {
          V2.player.openMatch(match);
        } else {
          V2.toast("That event is no longer in the seven-day catalog.");
        }
      };
    });
  }

  function providerStatus(discovery, allResult) {
    const savedAt = Math.max(
      Number(discovery?.today?.savedAt || 0),
      Number(allResult?.savedAt || 0)
    );

    if (!E.cacheMeta) return;

    if (!savedAt) {
      E.cacheMeta.textContent = "";
      return;
    }

    const age = Math.max(0, Math.round((Date.now() - savedAt) / 60000));
    E.cacheMeta.textContent = age ? `snapshot ${age}m old` : "updated now";
  }

  async function load(force = false) {
    if (!V2.API()) {
      fatal("EastCoin provider adapter did not load.");
      return;
    }

    try {
      const [discovery, allResult] = await Promise.all([
        V2.API().getDiscovery({ forceMatches: force }),
        V2.API().getAll(force)
      ]);

      S.events = merge(discovery, allResult);
      E.liveCount.textContent = S.events.filter(V2.live).length;

      providerStatus(discovery, allResult);
      renderGrid();
      renderRecent();

      // Score enrichment is optional and never blocks the event catalog.
      V2.cardOdds?.refresh?.(S.events);
    } catch (error) {
      fatal(error?.message || "EastCoin providers unavailable.");
    }
  }

  function fatal(message) {
    S.events = [];
    E.grid.innerHTML = "";
    E.grid.hidden = true;
    E.eventCount.textContent = "0 events";

    if (E.empty) {
      E.empty.hidden = false;
      const title = E.empty.querySelector("strong");
      const copy = E.empty.querySelector("small");
      if (title) title.textContent = "Events unavailable";
      if (copy) copy.textContent = message || "EastCoin providers are temporarily unavailable.";
    }
  }

  V2.events = {
    merge,
    sorted,
    filtered,
    renderDates,
    toggleFavorite,
    renderFeature,
    renderUpNext,
    renderGrid,
    find,
    addRecent,
    renderRecent,
    load,
    fatal
  };
})();
