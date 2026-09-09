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

  // Grouping, labels and the NFL/college/CFL running order live in
  // v3-sports.js so this view and the MultiView picker cannot drift apart.
  const Sports = window.ECV3Sports;
  const SPORT_LABELS = Sports.SPORT_LABELS;

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

  const isLive = Sports.isLive;


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

  const sportKey = Sports.sportKey;

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

    const href = `/?view=watch&event=${encodeURIComponent(match.id)}`;
    const openMatch = (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      history.pushState({ view: "watch" }, "", href);
      shell.go("watch", { push: false });
    };

    // poster — the whole banner is the primary way into the event
    const poster = document.createElement("a");
    poster.className = "ec-poster";
    poster.href = href;
    poster.setAttribute("aria-label", `Watch ${match?.title || "event"}`);
    poster.addEventListener("click", openMatch);

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

    const flag = document.createElement("span");
    flag.className = "ec-flag";
    setFlag(flag, flagStateFor(match));
    poster.append(flag);
    el.append(poster);

    // body --------------------------------------------------
    const body = document.createElement("div");
    body.className = "ec-body";

    const title = document.createElement("h3");
    title.className = "ec-title";

    const home = match?.teams?.home;
    const away = match?.teams?.away;
    if (home?.name && away?.name) {
      // One row per team, each with its own crest, so the matchup reads
      // at a glance instead of as one long run-on string.
      title.append(teamRow(home), teamRow(away));
      title.classList.add("is-matchup");
    } else {
      title.textContent = match?.title || "Untitled event";
    }

    // The sport is already stated by the group heading this card sits
    // under, so repeating it on every card is noise.
    const meta = document.createElement("p");
    meta.className = "ec-meta";
    meta.textContent = timeLabel(match);

    body.append(title, meta);

    const score = document.createElement("div");
    score.className = "ec-score";
    score.hidden = true;
    body.append(score);
    el.append(body);

    attachScore(match, score, title, flag);

    // actions -----------------------------------------------
    const actions = document.createElement("div");
    actions.className = "ec-actions";

    const watch = document.createElement("a");
    watch.className = "btn primary";
    watch.href = href;
    watch.textContent = live ? "Watch live" : "Watch";
    watch.addEventListener("click", openMatch);


    actions.append(watch);
    el.append(actions);

    return el;
  }

  // "Upcoming" is only true of something that hasn't started. Once a
  // start time is in the past the card must not claim otherwise — which
  // is how a game could end up tagged Upcoming and Final at once.
  function flagStateFor(match) {
    if (isLive(match)) return "live";
    const start = Number(match?.date) || 0;
    if (start && start <= Date.now()) return "";   // started already: say nothing
    return startsSoon(match) ? "soon" : "upcoming";
  }

  function setFlag(flag, state) {
    const copy = { live: "Live", soon: "Soon", upcoming: "Upcoming", final: "Final" };
    flag.className = `ec-flag${state ? ` ${state}` : ""}`;
    flag.textContent = copy[state] || "";
    flag.hidden = !state;
  }

  function teamRow(team) {
    const row = document.createElement("span");
    row.className = "teamrow";

    const badge = document.createElement("span");
    badge.className = "teamlogo";
    const API = window.EastcoinStreamedAPI;
    const url = team?.badge && API?.badgeUrl ? API.badgeUrl(team.badge) : "";
    if (url) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("load", () => badge.classList.add("has-badge"));
      img.addEventListener("error", () => img.remove());
      img.src = url;
      badge.append(img);
    }
    const name = document.createElement("span");
    name.className = "teamname";
    name.textContent = team?.name || "TBC";

    row.append(badge, name);
    return row;
  }

  // Scores are additive: the card is complete without them, and a match
  // that ESPN doesn't have simply never shows one.
  async function attachScore(match, mount, titleEl, flag) {
    if (!window.ECV3Scores) return;
    if (window.ECV3Prefs && window.ECV3Prefs.scores === false) return;

    let score = null;
    try {
      score = await window.ECV3Scores.forMatch(match);
    } catch {
      return;
    }
    if (!score || score.state === "pre" || !mount.isConnected) return;

    // ESPN is authoritative about state; the schedule-derived guess isn't.
    if (flag) setFlag(flag, score.state === "post" ? "final" : "live");

    // A finished game drops below everything still going. The schedule
    // still calls it live, so it was painted among the live ones; once
    // the score says Final it moves to the back of its group. Order
    // within the finals is whatever order the scores came back in.
    if (score.state === "post") {
      const cardEl = mount.closest(".eventcard");
      const grid = cardEl?.parentElement;
      if (cardEl && grid) {
        cardEl.classList.add("is-final");
        grid.append(cardEl);
      }
    }

    const rows = titleEl.querySelectorAll(".teamrow");
    const line = document.createElement("span");
    line.className = "ec-score-state";
    line.textContent = score.state === "post" ? "Final" : score.detail || "Live";
    if (score.state === "in") line.classList.add("in");

    // Prefer painting each score against its own team row.
    if (rows.length === 2) {
      appendScore(rows[0], score.home.score);
      appendScore(rows[1], score.away.score);
      mount.append(line);
    } else {
      const compact = document.createElement("span");
      compact.className = "ec-score-compact nums";
      compact.textContent = `${score.home.score ?? "-"}–${score.away.score ?? "-"}`;
      mount.append(compact, line);
    }
    mount.hidden = false;
  }

  function appendScore(row, value) {
    if (value === null || value === undefined) return;
    const el = document.createElement("span");
    el.className = "teamscore nums";
    el.textContent = String(value);
    row.append(el);
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

  function picksBanner() {
    const banner = document.createElement("a");
    banner.className = "picksbanner";
    banner.href = "/?view=picks";
    banner.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      shell.go("picks");
    });

    const coin = document.createElement("img");
    coin.className = "picksbanner-coin";
    coin.src = "/v3/assets/img/zcoin.webp";
    coin.alt = "";
    coin.width = 30;
    coin.height = 30;

    const tag = document.createElement("span");
    tag.className = "picksbanner-tag";
    tag.textContent = "New";

    const copy = document.createElement("span");
    copy.className = "picksbanner-copy";
    const strong = document.createElement("strong");
    strong.textContent = "Picks are now live";
    const rest = document.createElement("span");
    rest.textContent = " — back a team with your ZCoins and see where you land on the leaderboard.";
    copy.append(strong, rest);

    const cta = document.createElement("span");
    cta.className = "picksbanner-cta";
    cta.textContent = "Make your picks →";

    banner.append(coin, tag, copy, cta);
    return banner;
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
    titleWrap.append(h1);
    head.append(titleWrap);
    root.append(head);

    // Two columns up top: the Picks banner, and everyone on the site
    // right now (guests counted) — Who's here.
    const top = document.createElement("div");
    top.className = "homegrid";
    top.append(picksBanner());
    if (window.ECPresence) {
      const strip = document.createElement("section");
      strip.className = "whoshere";
      top.append(strip);
      window.ECPresence.mountStrip(strip);
    }
    root.append(top);

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

    const ordered = Sports.grouped(visible);

    for (const [key, list] of ordered) {
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
    },
    onPrefs() {
      if (root?.isConnected) paint();
    }
  };

  function boot() {
    const ECV3 = window.ECV3;
    if (!ECV3) return window.setTimeout(boot, 30);
    ECV3.register("events", view);
  }

  boot();
})();
