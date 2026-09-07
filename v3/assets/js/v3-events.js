/* ============================================================
   EastCoin V3 — Events (home)

   Reuses window.EastcoinStreamedAPI rather than re-implementing
   the provider layer: it already handles the streamed.st /
   streamed.pk fallback, caching and PPV merging.

   Two deliberate carry-overs from V2, both worth keeping:
     · first paint asks only for Live + Today
     · the wider catalogue is fetched lazily, on demand
   And two improvements:
     · skeletons occupy the real card height, so nothing jumps
     · a failed fetch says so and offers a retry, instead of
       leaving an empty grid that looks like "no games today"
   ============================================================ */
(() => {
  "use strict";

  const SPORT_LABELS = {
    football: "⚽ Football",
    "american-football": "🏈 NFL",
    basketball: "🏀 Basketball",
    baseball: "⚾ Baseball",
    hockey: "🏒 Hockey",
    fight: "🥊 Fighting",
    "motor-sports": "🏎 Motorsport",
    tennis: "🎾 Tennis",
    golf: "⛳ Golf",
    cricket: "🏏 Cricket",
    rugby: "🏉 Rugby",
    other: "📺 Other"
  };

  const local = {
    filter: "all",
    matches: [],
    loaded: false,
    failed: false,
    search: ""
  };

  let shell = null;
  let root = null;

  /* ---------------------------------------------------------- data */

  async function load(force = false) {
    const API = window.EastcoinStreamedAPI;
    if (!API) {
      local.failed = true;
      return;
    }
    try {
      // getLive/getToday resolve a cache envelope, not a bare array:
      // { data, savedAt, fromCache, stale }. Unwrap before use.
      const unwrap = (result) => (Array.isArray(result) ? result : result?.data) || [];

      const [liveRaw, todayRaw] = await Promise.all([
        API.getLive(force).catch(() => null),
        API.getToday(force).catch(() => null)
      ]);
      const live = unwrap(liveRaw);
      const today = unwrap(todayRaw);

      // Live wins on collision: a match that is on right now should
      // never be rendered with its scheduled-kickoff styling.
      const seen = new Map();
      for (const match of [...(live || []), ...(today || [])]) {
        if (!match?.id || seen.has(match.id)) continue;
        seen.set(match.id, match);
      }

      local.matches = [...seen.values()];
      local.loaded = true;
      // Only a genuine provider failure counts as failed. An empty but
      // successful response is "nothing on today", which is a normal state.
      local.failed = !liveRaw && !todayRaw;
    } catch {
      local.failed = true;
    }
  }

  /* ---------------------------------------------------------- helpers */

  function isLive(match) {
    const start = Number(match?.date) || 0;
    if (!start) return Boolean(match?.popular && match?.sources?.length);
    const now = Date.now();
    return now >= start && now - start < 4 * 60 * 60 * 1000;
  }

  function startsSoon(match) {
    const start = Number(match?.date) || 0;
    if (!start) return false;
    const delta = start - Date.now();
    return delta > 0 && delta < 60 * 60 * 1000;
  }

  function timeLabel(match) {
    const start = Number(match?.date) || 0;
    if (!start) return "Time TBC";
    if (isLive(match)) return "Live now";

    const date = new Date(start);
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    if (sameDay) {
      const mins = Math.round((start - Date.now()) / 60000);
      if (mins > 0 && mins < 60) return `Starts in ${mins}m`;
      return time;
    }
    return `${date.toLocaleDateString([], { weekday: "short" })} ${time}`;
  }

  function sportKey(match) {
    const raw = String(match?.category || "other").toLowerCase();
    return SPORT_LABELS[raw] ? raw : "other";
  }

  function matches(match) {
    if (local.filter === "live" && !isLive(match)) return false;
    if (local.filter === "soon" && !startsSoon(match)) return false;

    const term = local.search.toLowerCase();
    if (!term) return true;
    const hay = [
      match?.title,
      match?.category,
      match?.teams?.home?.name,
      match?.teams?.away?.name
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(term);
  }

  /* ---------------------------------------------------------- render */

  function crest(team) {
    const API = window.EastcoinStreamedAPI;
    const el = document.createElement("span");
    el.className = "crest";
    // Same reasoning as the poster: initials are written immediately and
    // the badge fades in over them. Waiting for the image to fail before
    // showing anything leaves an empty box for as long as it is pending.
    const label = document.createElement("span");
    label.textContent = initials(team?.name);
    el.append(label);

    const url = team?.badge && API?.badgeUrl ? API.badgeUrl(team.badge) : "";
    if (url) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("load", () => el.classList.add("has-badge"));
      img.addEventListener("error", () => img.remove());
      img.src = url;
      el.append(img);
    }
    return el;
  }

  function initials(name) {
    return String(name || "?")
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 3)
      .join("")
      .toUpperCase();
  }

  function card(match) {
    const API = window.EastcoinStreamedAPI;
    const live = isLive(match);

    const el = document.createElement("article");
    el.className = "eventcard";

    // poster ------------------------------------------------
    const poster = document.createElement("div");
    poster.className = "ec-poster";

    // posterUrl() takes the poster STRING; matchupPosterUrl() takes the
    // match and composes one from the two team badges. Passing the match
    // to posterUrl yields "[object Object]", which streamed.st happily
    // answers with generic placeholder art — broken, but not an error.
    const posterUrl =
      (match?.poster && API?.posterUrl ? API.posterUrl(match.poster) : "") ||
      (API?.matchupPosterUrl ? API.matchupPosterUrl(match) : "");
    // The crest art is painted first and always. Streamed generates these
    // posters on demand and they routinely take a second or more, so an
    // image-only poster leaves a black rectangle on every card until it
    // arrives. The photo fades in over the top when (and if) it loads.
    poster.append(fallbackArt(match));

    if (posterUrl) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.addEventListener("load", () => img.classList.add("in"));
      img.addEventListener("error", () => img.remove());
      img.src = posterUrl;
      poster.append(img);
    }

    if (live) {
      const flag = document.createElement("span");
      flag.className = "ec-flag live";
      flag.textContent = "Live";
      poster.append(flag);
    } else if (startsSoon(match)) {
      const flag = document.createElement("span");
      flag.className = "ec-flag soon";
      flag.textContent = "Soon";
      poster.append(flag);
    }
    el.append(poster);

    // body --------------------------------------------------
    const body = document.createElement("div");
    body.className = "ec-body";

    const title = document.createElement("h3");
    title.className = "ec-title";
    title.textContent = match?.title || "Untitled event";

    const meta = document.createElement("p");
    meta.className = "ec-meta";
    const label = SPORT_LABELS[sportKey(match)] || SPORT_LABELS.other;
    meta.append(
      document.createTextNode(label.replace(/^\S+\s/, "")),
      Object.assign(document.createElement("span"), { className: "sep", textContent: "·" }),
      document.createTextNode(timeLabel(match))
    );

    body.append(title, meta);
    el.append(body);

    // actions -----------------------------------------------
    const actions = document.createElement("div");
    actions.className = "ec-actions";

    const watch = document.createElement("a");
    watch.className = "btn primary";
    watch.href = `/v3/?view=watch&event=${encodeURIComponent(match.id)}`;
    watch.textContent = live ? "Watch live" : "Watch";
    watch.addEventListener("click", (event) => {
      event.preventDefault();
      // The player lands in phase 2; until then say so honestly
      // rather than routing into a view that does not exist.
      watch.textContent = "Player: phase 2";
      window.setTimeout(() => {
        watch.textContent = live ? "Watch live" : "Watch";
      }, 1400);
    });

    const multi = document.createElement("button");
    multi.className = "btn ghost";
    multi.type = "button";
    multi.title = "Add to MultiView";
    multi.textContent = "＋";

    actions.append(watch, multi);
    el.append(actions);

    return el;
  }

  function fallbackArt(match) {
    const wrap = document.createElement("div");
    wrap.className = "fallback";
    const home = match?.teams?.home;
    const away = match?.teams?.away;
    if (home || away) {
      wrap.append(crest(home));
      const vs = document.createElement("span");
      vs.className = "vs";
      vs.textContent = "VS";
      wrap.append(vs, crest(away));
    } else {
      const vs = document.createElement("span");
      vs.className = "vs";
      vs.textContent = (SPORT_LABELS[sportKey(match)] || "📺").split(" ")[0];
      wrap.append(vs);
    }
    return wrap;
  }

  function skeletonGrid(count = 8) {
    const grid = document.createElement("div");
    grid.className = "eventgrid";
    for (let i = 0; i < count; i += 1) {
      const s = document.createElement("div");
      s.className = "skel";
      s.innerHTML =
        '<div class="poster shimmer"></div>' +
        '<div class="lines">' +
        '<span class="bar w80"></span><span class="bar w50"></span><span class="bar w100"></span>' +
        "</div>";
      grid.append(s);
    }
    return grid;
  }

  function filterBar() {
    const bar = document.createElement("div");
    bar.className = "filters";

    const liveCount = local.matches.filter(isLive).length;
    const options = [
      ["all", `All (${local.matches.length})`],
      ["live", `Live (${liveCount})`, liveCount > 0],
      ["soon", "Starting soon"]
    ];

    for (const [key, label, showDot] of options) {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(local.filter === key));
      if (showDot) {
        const dot = document.createElement("span");
        dot.className = "dot";
        chip.append(dot);
      }
      chip.append(document.createTextNode(label));
      chip.addEventListener("click", () => {
        local.filter = key;
        paint();
      });
      bar.append(chip);
    }

    const spacer = document.createElement("div");
    spacer.className = "filters-spacer";

    const note = document.createElement("span");
    note.className = "filters-note";
    note.textContent = local.search ? `Filtered by “${local.search}”` : "Live and today";

    bar.append(spacer, note);
    return bar;
  }

  function paint() {
    root.replaceChildren();

    const head = document.createElement("div");
    head.className = "viewhead";
    const titleWrap = document.createElement("div");
    const h1 = document.createElement("h1");
    h1.textContent = "Events";
    const sub = document.createElement("p");
    sub.textContent = "Everything on right now, and what's coming today.";
    titleWrap.append(h1, sub);
    head.append(titleWrap);
    root.append(head);

    if (!local.loaded && !local.failed) {
      root.append(skeletonGrid());
      return;
    }

    if (local.failed) {
      const strip = document.createElement("div");
      strip.className = "notice-strip";
      strip.append(
        document.createTextNode(
          "Couldn't reach the events provider. This is usually temporary."
        )
      );
      const retry = document.createElement("button");
      retry.className = "btn";
      retry.type = "button";
      retry.style.flex = "0 0 auto";
      retry.style.padding = "0 16px";
      retry.textContent = "Try again";
      retry.addEventListener("click", async () => {
        local.failed = false;
        local.loaded = false;
        paint();
        await load(true);
        paint();
      });
      strip.append(retry);
      root.append(strip);
      return;
    }

    root.append(filterBar());

    const visible = local.matches.filter(matches);
    if (!visible.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      const strong = document.createElement("strong");
      strong.textContent = local.search ? "Nothing matches that" : "Nothing on right now";
      const p = document.createElement("p");
      p.textContent = local.search
        ? "Try a team name, or clear the search."
        : "Check back closer to kickoff — today's schedule fills up through the day.";
      empty.append(strong, p);
      root.append(empty);
      return;
    }

    // Group by sport, live-first within each group.
    const groups = new Map();
    for (const match of visible) {
      const key = sportKey(match);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(match);
    }

    const ordered = [...groups.entries()].sort((a, b) => {
      const aLive = a[1].filter(isLive).length;
      const bLive = b[1].filter(isLive).length;
      if (aLive !== bLive) return bLive - aLive;
      return b[1].length - a[1].length;
    });

    for (const [key, list] of ordered) {
      list.sort((a, b) => {
        const liveDelta = Number(isLive(b)) - Number(isLive(a));
        if (liveDelta) return liveDelta;
        return (Number(a.date) || 0) - (Number(b.date) || 0);
      });

      const group = document.createElement("section");
      group.className = "sportgroup";

      const gh = document.createElement("div");
      gh.className = "sportgroup-head";
      const h2 = document.createElement("h2");
      h2.textContent = SPORT_LABELS[key] || SPORT_LABELS.other;
      const count = document.createElement("span");
      count.className = "count";
      const liveHere = list.filter(isLive).length;
      count.textContent = liveHere ? `${liveHere} live · ${list.length} total` : `${list.length}`;
      const rule = document.createElement("span");
      rule.className = "rule";
      gh.append(h2, count, rule);

      const grid = document.createElement("div");
      grid.className = "eventgrid";
      for (const match of list) grid.append(card(match));

      group.append(gh, grid);
      root.append(group);
    }
  }

  /* ---------------------------------------------------------- view */

  const view = {
    async mount(container, api) {
      shell = api;
      root = container;
      local.search = api.state.search || "";
      paint();
      if (!local.loaded) {
        await load();
        if (root.isConnected) paint();
      }
    },
    onSearch(term) {
      local.search = term;
      if (root?.isConnected) paint();
    }
  };

  function boot() {
    const ECV3 = window.ECV3;
    if (!ECV3) return window.setTimeout(boot, 30);
    ECV3.register("events", view);

    ECV3.register("multiview", {
      mount(container, api) {
        container.append(
          api.stub("MultiView", "Arriving in phase 2 of the V3 rebuild.", [
            "2, 3 and 4 panel layouts with draggable splits",
            "Per-panel server switching without refetching the catalogue",
            "Shareable layouts on root-domain links",
            "No nested player.html — panels mount the V3 player directly"
          ])
        );
      }
    });

    ECV3.register("picks", {
      mount(container, api) {
        container.append(
          api.stub("Picks", "Arriving in phase 2, with the changes we already agreed.", [
            "No maximum bet — 1 ZCoin minimum, stake up to your balance",
            "Odds locked when the market opens; everyone gets the same line",
            "Moneylines shown as −150, never as a 1.67x multiplier",
            "Payouts round up, matching the bot and the results page",
            "My Picks, Leaderboard, History and Community Ledger as mocked up"
          ])
        );
      }
    });

    ECV3.register("music", {
      mount(container, api) {
        container.append(
          api.stub("Music Room", "Arriving after the core views.", [
            "Shared queue synced from StreamElements",
            "Skip reasons shown in the room, as they now are on the live site"
          ])
        );
      }
    });
  }

  boot();
})();
