(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;
  const E = V2.els;
  const $ = V2.$;
  const $$ = V2.$$;

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

  function recommendationScore(match) {
    let score = 0;
    const eventTime = V2.ts(match?.date);
    const now = Date.now();

    if (V2.live(match)) score += 10000;
    if (match?.popular) score += 1200;

    score += Math.min(V2.sources(match), 10) * 40;

    if (eventTime > now) {
      const hoursUntilStart = (eventTime - now) / 3600000;
      score += Math.max(0, 900 - hoursUntilStart * 20);
      if (S.settings?.startingSoonFirst) score += Math.max(0, 3600 - hoursUntilStart * 240);
    }

    if (["american-football", "basketball", "baseball", "combat"].includes(V2.family(match))) {
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
      const family = V2.family(match);

      const sportMatch =
        S.sport === "all" ||
        (S.sport === "live" && V2.live(match)) ||
        (S.sport === "other"
          ? ["other", "wrestling", "motorsport", "golf"].includes(family)
          : family === S.sport);

      const statusMatch =
        S.status === "all" ||
        (S.status === "live" && V2.live(match)) ||
        (
          S.status === "upcoming" &&
          !V2.live(match) &&
          V2.ts(match?.date) > Date.now()
        ) ||
        (
          S.status === "saved" &&
          S.favorites.has(V2.id(match))
        );

      const dateKey = V2.dayKey(match);

      const dateMatch =
        V2.live(match) ||
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

  function liveCardData(match) {
    return V2.liveData?.forMatch?.(match) || null;
  }

  function scoreValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(number) : "—";
  }

  function liveStateLabel(data, match) {
    if (!data) return V2.live(match) ? "LIVE" : V2.time(match);

    const pieces = [
      data.period,
      data.clock
    ].filter(Boolean);

    return pieces.length
      ? pieces.join(" · ")
      : String(data.status || (V2.live(match) ? "LIVE" : V2.time(match)));
  }

  function card(match) {
    const key = V2.id(match);
    const [icon, label] = V2.sportMeta(V2.family(match));
    const poster = V2.poster(match);
    const home = match?.teams?.home;
    const away = match?.teams?.away;
    const saved = S.favorites.has(key);
    const liveData = liveCardData(match);
    const hasScore =
      liveData &&
      Number.isFinite(Number(liveData.awayScore)) &&
      Number.isFinite(Number(liveData.homeScore));

    if (!home && !away) {
      return `
        <article class="card v1-event-card v1-event-card-single ${V2.live(match) ? "is-live" : ""}">
          <div class="v1-event-visual">
            ${poster ? `<div class="v1-event-bg" style="background-image:url('${V2.esc(poster)}')"></div>` : ""}
            <div class="v1-event-shade"></div>
            <div class="v1-event-topbar">
              <span class="v1-event-state ${V2.live(match) ? "live" : ""}">
                ${V2.live(match) ? "LIVE" : V2.esc(V2.time(match))}
              </span>
              ${broadcastLabel(match) ? `<span class="v1-event-network">📺 ${V2.esc(broadcastLabel(match))}</span>` : ""}
            </div>
            <div class="v1-single-event">
              <span>${icon}</span>
              <strong>${V2.esc(match.title || "EastCoin Event")}</strong>
              <small>${V2.esc(label)}</small>
            </div>
          </div>
          <footer class="v1-event-footer">
            <div class="v1-event-footer-copy">
              <strong>${V2.esc(label)}</strong>
            </div>
            <div class="v1-event-actions">
              <button class="v1-save ${saved ? "saved" : ""}" data-save="${V2.esc(key)}" aria-label="Save event">${saved ? "★" : "☆"}</button>
              <button class="v1-multiview" data-multiview="${V2.esc(key)}">＋ MultiView</button>
              <button class="v1-watch" data-watch="${V2.esc(key)}">${V2.live(match) ? "Watch" : "Open"}</button>
            </div>
          </footer>
        </article>
      `;
    }

    return `
      <article class="card v1-event-card ${V2.live(match) ? "is-live" : ""}" data-event-id="${V2.esc(key)}">
        <div class="v1-event-visual">
          ${poster ? `<div class="v1-event-bg" style="background-image:url('${V2.esc(poster)}')"></div>` : ""}
          <div class="v1-event-shade"></div>

          <div class="v1-event-topbar">
            <span class="v1-event-state ${V2.live(match) ? "live" : ""}">
              ${V2.live(match) ? "LIVE" : V2.esc(V2.time(match))}
            </span>
            ${broadcastLabel(match) ? `<span class="v1-event-network">📺 ${V2.esc(broadcastLabel(match))}</span>` : ""}
          </div>

          <div class="v1-matchup">
            <div class="v1-matchup-team away">
              ${V2.logo(away)}
              <strong>${V2.esc(away?.name || "Away")}</strong>
            </div>

            <div class="v1-matchup-center ${hasScore ? "has-score" : ""}">
              ${hasScore
                ? `
                  <div class="v1-scoreline">
                    <strong>${scoreValue(liveData.awayScore)}</strong>
                    <span>–</span>
                    <strong>${scoreValue(liveData.homeScore)}</strong>
                  </div>
                  <span class="v1-live-game-state">${V2.esc(liveStateLabel(liveData, match))}</span>
                `
                : `
                  <span class="v1-vs">VS</span>
                  <small>${V2.live(match) ? "Live now" : V2.esc(V2.time(match))}</small>
                `
              }
            </div>

            <div class="v1-matchup-team home">
              ${V2.logo(home)}
              <strong>${V2.esc(home?.name || "Home")}</strong>
            </div>
          </div>
        </div>

        <footer class="v1-event-footer">
          <div class="v1-event-footer-copy">
            <strong>${icon} ${V2.esc(label)}</strong>
          </div>

          <div class="v1-event-actions">
            <button class="v1-save ${saved ? "saved" : ""}" data-save="${V2.esc(key)}" aria-label="Save event">${saved ? "★" : "☆"}</button>
            <button class="v1-multiview" data-multiview="${V2.esc(key)}">＋ MultiView</button>
            <button class="v1-watch" data-watch="${V2.esc(key)}">${V2.live(match) ? "Watch" : "Open"}</button>
          </div>
        </footer>
      </article>
    `;
  }

  function renderGrid() {
    const events = filtered();

    E.eventCount.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
    E.grid.innerHTML = events.map(card).join("");
    E.grid.hidden = !events.length;
    E.empty.hidden = Boolean(events.length);

    $$("[data-watch]", E.grid).forEach((button) => {
      button.onclick = () => {
        const match = find(button.dataset.watch);
        if (match) V2.player.openMatch(match);
      };
    });

    $$("[data-multiview]", E.grid).forEach((button) => {
      button.onclick = () => {
        const match = find(button.dataset.multiview);
        if (match) addToMultiview(match);
      };
    });

    $$("[data-save]", E.grid).forEach((button) => {
      button.onclick = () => toggleFavorite(button.dataset.save);
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
      V2.liveData?.refresh?.(S.events);
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
