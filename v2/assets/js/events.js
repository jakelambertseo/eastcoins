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
      score += Math.max(0, 900 - ((eventTime - now) / 3600000) * 20);
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
        family === S.sport;

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

    renderFeature();
    renderGrid();

    if (S.active && V2.id(S.active) === key) {
      E.saveActive.textContent = S.favorites.has(key) ? "★" : "☆";
    }
  }

  function renderFeature() {
    const match = sorted(S.events)[0];

    if (!match) {
      S.featured = null;
      E.featureOpen.disabled = true;
      E.featured.innerHTML = '<div class="loading">No featured event available.</div>';
      return;
    }

    S.featured = V2.id(match);
    E.featureOpen.disabled = false;

    const [icon, label] = V2.sportMeta(V2.family(match));
    const poster = V2.poster(match);
    const home = match?.teams?.home;
    const away = match?.teams?.away;
    const key = V2.id(match);

    E.featured.innerHTML = `
      ${poster ? `<div class="featureart" style="background-image:url('${V2.esc(poster)}')"></div>` : ""}
      <div class="featureoverlay"></div>
      <div class="featureinner">
        <div class="featuretop">
          <span class="pill ${V2.live(match) ? "live" : ""}">
            ${V2.live(match) ? "● LIVE" : V2.esc(V2.time(match))}
          </span>
          <span class="category">${icon} ${V2.esc(label)}</span>
          <span class="network-label">📺 ${V2.esc(V2.network(match))}</span>
          <button class="save ${S.favorites.has(key) ? "saved" : ""}" data-fsave>
            ${S.favorites.has(key) ? "★" : "☆"}
          </button>
        </div>

        <div class="featuremain">
          <h2>${V2.esc(match.title || "EastCoin event")}</h2>
          <p>
            ${V2.esc(V2.datetime(match))} ·
            <span class="viewer-label">👥 ${V2.esc(V2.viewerText(match))}</span> ·
            ${V2.sources(match)} source${V2.sources(match) === 1 ? "" : "s"}
          </p>
          ${home || away
            ? `<div class="teams">${V2.logo(away)}<span>VS</span>${V2.logo(home)}</div>`
            : ""}
        </div>

        <div class="featurefoot">
          <div>
            <small>${V2.live(match) ? "Happening now" : "Upcoming"} · ${V2.esc(V2.provider(match))}</small>
          </div>
          <div>
            <button data-fchat>Open Chat</button>
            <button class="watch" data-fopen>Watch Now →</button>
          </div>
        </div>
      </div>
    `;

    $("[data-fopen]", E.featured).onclick = () => V2.player.openMatch(match);
    $("[data-fchat]", E.featured).onclick = V2.player.openChat;
    $("[data-fsave]", E.featured).onclick = () => toggleFavorite(key);
  }

  function renderUpNext() {
    const upcoming = S.events
      .filter((match) => !V2.live(match) && V2.ts(match?.date) > Date.now())
      .sort((left, right) => V2.ts(left?.date) - V2.ts(right?.date))
      .slice(0, 4);

    E.upnext.innerHTML = upcoming.length
      ? upcoming.map((match) => {
          const [icon, label] = V2.sportMeta(V2.family(match));

          return `
            <button class="uprow" data-up="${V2.esc(V2.id(match))}">
              <span>${V2.esc(V2.time(match))}</span>
              <span>
                <strong>${V2.esc(match.title || "Event")}</strong>
                <small>${icon} ${V2.esc(label)} · 📺 ${V2.esc(V2.network(match))} · ${V2.esc(V2.datetime(match))}</small>
              </span>
              <em>Open</em>
            </button>
          `;
        }).join("")
      : "<small>No upcoming events found.</small>";

    $$("[data-up]", E.upnext).forEach((button) => {
      button.onclick = () => {
        const match = find(button.dataset.up);
        if (match) V2.player.openMatch(match);
      };
    });
  }

  function card(match) {
    const key = V2.id(match);
    const [icon, label] = V2.sportMeta(V2.family(match));
    const poster = V2.poster(match);
    const home = match?.teams?.home;
    const away = match?.teams?.away;

    return `
      <article class="card">
        <div class="cardart">
          ${poster ? `<div class="cardbg" style="background-image:url('${V2.esc(poster)}')"></div>` : ""}
          <div class="cardcover"></div>
          <div class="cardtop">
            <span class="pill ${V2.live(match) ? "live" : ""}">
              ${V2.live(match) ? "● LIVE" : V2.esc(V2.time(match))}
            </span>
            <span class="category">${icon} ${V2.esc(label)}</span>
          </div>
        </div>

        <div class="cardbody">
          <strong>${V2.esc(match.title || "EastCoin Event")}</strong>
          <small>${V2.esc(V2.datetime(match))}</small>

          ${home || away
            ? `<div class="miniTeams">${V2.logo(away, true)}<span>VS</span>${V2.logo(home, true)}</div>`
            : ""}

          <div class="meta">
            <span class="network-label">📺 ${V2.esc(V2.network(match))}</span>
            <span class="viewer-label">👥 ${V2.esc(V2.viewerText(match))}</span>
            <span>${V2.sources(match)} source${V2.sources(match) === 1 ? "" : "s"}</span>
            ${match?.popular ? "<span>🔥 Popular</span>" : ""}
          </div>
        </div>

        <div class="cardfooter">
          <button data-watch="${V2.esc(key)}">
            ${V2.live(match) ? "Watch Live →" : "Open Event →"}
          </button>
          <button class="save ${S.favorites.has(key) ? "saved" : ""}" data-save="${V2.esc(key)}">
            ${S.favorites.has(key) ? "★" : "☆"}
          </button>
        </div>
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
    const warnings = discovery?.warnings || [];

    const savedAt = Math.max(
      Number(discovery?.today?.savedAt || 0),
      Number(allResult?.savedAt || 0)
    );

    const stale = Boolean(
      discovery?.today?.stale ||
      discovery?.live?.stale ||
      allResult?.stale
    );

    E.status.className = `status ${stale || warnings.length ? "warn" : "ok"}`;

    E.statusTitle.textContent = stale
      ? "Using cached EastCoin events"
      : warnings.length
        ? "Events loaded with provider warnings"
        : "EastCoin event providers connected";

    E.statusMeta.textContent = stale
      ? "Latest usable snapshot retained."
      : `${S.events.length} events available in the V2 seven-day catalog.`;

    if (savedAt) {
      const age = Math.max(0, Math.round((Date.now() - savedAt) / 60000));
      E.cacheMeta.textContent = age ? `snapshot ${age}m old` : "updated now";
    }
  }

  async function load(force = false) {
    if (!V2.API()) {
      fatal("EastCoin provider adapter did not load.");
      return;
    }

    E.statusTitle.textContent = force
      ? "Refreshing EastCoin events…"
      : "Loading EastCoin events…";

    try {
      const [discovery, allResult] = await Promise.all([
        V2.API().getDiscovery({ forceMatches: force }),
        V2.API().getAll(force)
      ]);

      S.events = merge(discovery, allResult);
      E.liveCount.textContent = S.events.filter(V2.live).length;

      providerStatus(discovery, allResult);
      renderFeature();
      renderUpNext();
      renderGrid();
      renderRecent();
    } catch (error) {
      fatal(error?.message || "EastCoin providers unavailable.");
    }
  }

  function fatal(message) {
    S.events = [];
    E.status.className = "status error";
    E.statusTitle.textContent = "Event catalog unavailable";
    E.statusMeta.textContent = message;
    E.featured.innerHTML = `<div class="loading">${V2.esc(message)}</div>`;
    E.featureOpen.disabled = true;
    E.grid.innerHTML = "";
    E.eventCount.textContent = "0 events";
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
