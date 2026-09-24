/* ============================================================
   EastCoin Wrapped — /wrapped/<login> (2026-09-15)

   A story: one screen per part of the site, from /api/picks/wrapped,
   ending on a card worth sharing. Taps on the right go on, the left
   goes back; arrow keys and space work too. A part with nothing in it
   (never played the casino, never rated a movie) is simply left out.

   Before the drop the API answers locked for everyone but admins, and
   this page shows the countdown instead.
   ============================================================ */
(() => {
  const CSS = "/v3/assets/css/v3-wrapped.css?v=1";
  const CASINO_ART = new Set(["flip", "hilo", "mines", "plinko", "roulette", "scratch", "wheel"]);
  const SLIDE_MS = 6500;
  const TZ = "America/Chicago";

  let root = null;
  let shell = null;
  let token = 0;
  let cleanup = [];

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  const fmt = (n) => Number(n || 0).toLocaleString();
  const signed = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
  const tone = (n) => (n > 0 ? "wr-up" : n < 0 ? "wr-down" : "");
  const line = (n) => (Number.isFinite(n) ? (n > 0 ? `+${n}` : String(n)) : "");
  const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ }) : "");

  function needCss() {
    if (document.getElementById("css-wrapped")) return;
    const link = document.createElement("link");
    link.id = "css-wrapped"; link.rel = "stylesheet"; link.href = CSS;
    document.head.append(link);
  }

  function loginFromPath() {
    const m = location.pathname.match(/^\/wrapped\/([a-z0-9_]{2,25})\/?$/i);
    if (m) return m[1].toLowerCase();
    return String(shell?.state?.session?.user?.login || "").toLowerCase();
  }

  function avatar(user, className = "wr-av") {
    const box = el("span", className, String(user.displayName || user.login || "?").slice(0, 1).toUpperCase());
    if (user.avatar) {
      const img = el("img");
      img.alt = "";
      img.src = window.ECAvatar?.medium ? window.ECAvatar.medium(user.avatar) : user.avatar;
      img.addEventListener("error", () => img.remove());
      box.append(img);
    }
    return box;
  }

  function chip(label, value, cls = "") {
    const c = el("div", "wr-chip");
    c.append(el("span", null, label), el("b", `wr-nums ${cls}`.trim(), value));
    return c;
  }

  function slide(kind) {
    const s = el("section", `wr-slide ${kind}`);
    s.setAttribute("aria-roledescription", "slide");
    return s;
  }

  /* ---------------------------------------------------------- screens */

  function intro(d, mine) {
    const s = slide("wr-intro");
    if (d.preview) s.append(el("span", "wr-preview", "Preview · season so far"));
    s.append(Object.assign(avatar(d.user), { className: "wr-av wr-pop" }));
    const h = el("h2", "wr-h wr-rise wr-d1");
    // The name gets its own line, sized to fit: Twitch logins run to 25
    // characters and a word broken in half reads as a bug.
    const who = String(d.user.displayName);
    const nameEl = el("span", "wr-name", mine ? `${who},` : `${who}'s`);
    nameEl.style.fontSize = who.length > 16 ? "1.55rem" : who.length > 12 ? "2rem" : who.length > 8 ? "2.5rem" : "";
    const year = el("em", null, d.label);
    h.append(nameEl, document.createTextNode(mine ? "your " : ""), year, document.createTextNode(" season."));
    s.append(h, el("p", "wr-lede wr-rise wr-d2", "Every pick, every spin, every song forced on chat. Let's go."),
      el("p", "wr-foot wr-rise wr-d3", "Tap to keep going →"));
    return s;
  }

  function picksScreen(p, Y) {
    const s = slide("wr-picks");
    s.append(el("span", "wr-k", "Picks"));
    const big = el("div", "wr-big wr-nums wr-pop", `${p.wins}–${p.losses}`);
    big.append(el("small", null, `record across ${p.picks} pick${p.picks === 1 ? "" : "s"}`));
    s.append(big);
    const chips = el("div", "wr-chips");
    chips.append(
      Object.assign(chip("Profit", `${signed(p.profit)} ZC`, tone(p.profit)), { className: "wr-chip wr-rise wr-d1" }),
      Object.assign(chip("Season rank", p.rank ? `#${p.rank} of ${p.players}` : "—", "wr-gold"), { className: "wr-chip wr-rise wr-d2" }),
      Object.assign(chip("Accuracy", `${p.accuracy}%`), { className: "wr-chip wr-rise wr-d3" }),
      Object.assign(chip("Best run", p.bestRun ? `W${p.bestRun}` : "—"), { className: "wr-chip wr-rise wr-d4" })
    );
    s.append(chips);
    if (p.rank && p.players > 1) {
      const pct = Math.round((100 * p.beat) / (p.players - 1));
      const bar = el("div", "wr-rankbar wr-rise wr-d4");
      bar.setAttribute("aria-hidden", "true");
      const fill = el("i"); fill.style.width = `${Math.max(3, pct)}%`;
      bar.append(fill);
      // "top 93%" is not a boast; the tag only shows in the top half.
      const topPct = Math.max(1, Math.round((100 * p.rank) / p.players));
      if (topPct <= 50) {
        const tag = el("em", null, `top ${topPct}%`);
        tag.style.left = `${Math.min(92, Math.max(8, pct))}%`;
        bar.append(tag);
      }
      s.append(bar, el("p", "wr-foot", `Better than ${p.beat} of the ${p.players} people who made a pick.`));
    } else {
      s.append(el("p", "wr-foot", `${fmt(p.staked)} ZC staked on the season.`));
    }
    return s;
  }

  function ticket(kind, label, pick) {
    const t = el("div", `wr-ticket ${kind === "win" ? "win" : "loss"} wr-rise ${kind === "win" ? "wr-d1" : "wr-d2"}`);
    t.append(el("span", `wr-tk ${kind === "win" ? "wr-up" : "wr-down"}`, label));
    const what = pick.question
      ? `${pick.team} on “${pick.question}”`
      : kind === "win"
        ? `${pick.team} ${line(pick.line)} over the ${pick.opponent}`
        : `${pick.team} ${line(pick.line)} vs the ${pick.opponent}`;
    t.append(el("div", "wr-tm", what));
    const foot = el("div", "wr-tl");
    foot.append(el("span", null, `${fmt(pick.wager)} staked${pick.allIn ? " · all-in" : ""}${pick.at ? " · " + day(pick.at) : ""}`),
      el("b", `wr-nums ${kind === "win" ? "wr-up" : "wr-down"}`, kind === "win" ? `+${fmt(pick.profit)}` : `−${fmt(pick.wager)}`));
    t.append(foot);
    return t;
  }

  function moments(p, Y) {
    if (!p.biggestWin && !p.worstBeat) return null;
    const s = slide("wr-moments");
    s.append(el("span", "wr-k", "The moments"), el("h2", "wr-h", p.biggestWin && p.worstBeat ? "One to brag about. One to forget." : p.biggestWin ? "The one to brag about." : "The one to forget."));
    if (p.biggestWin) s.append(ticket("win", "Biggest win", p.biggestWin));
    if (p.worstBeat) s.append(ticket("loss", "Worst beat", p.worstBeat));
    const a = p.allIns;
    s.append(el("p", "wr-foot", a.total
      ? `${Y} went all-in ${a.total} time${a.total === 1 ? "" : "s"}. ${a.won === a.total ? "Every one landed." : a.won ? `${a.won} of them worked.` : "None of them worked."}`
      : "Not one all-in all season. Disciplined."));
    return s;
  }

  function teamScreen(t, Y) {
    if (!t) return null;
    const s = slide("wr-team");
    s.append(el("span", "wr-k", "Your team"));
    const crest = window.ECLogos?.crest ? window.ECLogos.crest(t.sport, t.league, t.name, "wr-crest wr-pop") : el("span", "wr-crest wr-pop", t.name.slice(0, 3).toUpperCase());
    s.append(crest);
    s.append(el("h2", "wr-h wr-rise wr-d1", `${Y} rode with the ${t.name.split(" ").slice(-1)[0]}.`));
    s.append(el("p", "wr-lede wr-center wr-rise wr-d2", `${t.picks} picks on ${t.name}${t.mostInChat ? ", more than anyone in chat" : ""}.`));
    const split = el("div", "wr-split wr-rise wr-d3");
    const a = el("div"); a.append(el("b", "wr-nums", `${t.wins}–${t.losses}`), el("span", null, "on them"));
    const b = el("div"); b.append(el("b", `wr-nums ${tone(t.profit)}`, signed(t.profit)), el("span", null, "ZC from them"));
    split.append(a, b);
    s.append(split, el("p", "wr-foot wr-center", t.profit > 0 ? "Loyalty paid." : t.profit < 0 ? "Loyalty cost you. You'd do it again." : "Dead even. Loyal anyway."));
    return s;
  }

  function casinoScreen(c) {
    const s = slide("wr-casino");
    s.append(el("span", "wr-k", "Casino"), el("h2", "wr-h", `${fmt(c.plays)} play${c.plays === 1 ? "" : "s"} at the tables.`));
    if (c.favourite) {
      const fav = el("div", "wr-fav wr-rise wr-d1");
      const art = el("span", "wr-art");
      if (CASINO_ART.has(c.favourite.game)) art.style.backgroundImage = `url("/v3/assets/img/casino/${c.favourite.game}.webp?v=2")`;
      const txt = el("div");
      const extra = c.favourite.game === "mines" && c.mines?.bestX ? ` · best cash-out ×${c.mines.bestX}` : "";
      txt.append(el("b", null, c.favourite.name), el("small", null, `favourite game · ${fmt(c.favourite.plays)} plays${extra}`));
      fav.append(art, txt);
      s.append(fav);
    }
    const chips = el("div", "wr-chips");
    chips.append(
      Object.assign(chip("Casino net", `${signed(c.net)} ZC`, tone(c.net)), { className: "wr-chip wr-rise wr-d2" }),
      Object.assign(chip("Biggest hit", c.biggest ? `+${fmt(c.biggest.profit)}` : "—", c.biggest ? "wr-up" : ""), { className: "wr-chip wr-rise wr-d3" })
    );
    s.append(chips);
    const max = Math.max(1, ...c.byDay.map((d) => d.plays));
    const bars = el("div", "wr-days wr-rise wr-d4");
    const labels = el("div", "wr-daysl");
    bars.setAttribute("aria-hidden", "true"); labels.setAttribute("aria-hidden", "true");
    for (const d of c.byDay) {
      const i = el("i", d.day === c.topDay.day ? "hot" : "");
      i.style.height = `${Math.round((100 * d.plays) / max)}%`;
      bars.append(i);
      labels.append(el("span", null, d.day.slice(0, 1)));
    }
    const DAY_NAMES = { Mon: "Mondays", Tue: "Tuesdays", Wed: "Wednesdays", Thu: "Thursdays", Fri: "Fridays", Sat: "Saturdays", Sun: "Sundays" };
    s.append(bars, labels, el("p", "wr-foot", `${DAY_NAMES[c.topDay.day] || c.topDay.day} were the day: ${c.topDay.share}% of the plays. ${c.wins}–${c.losses} overall.`));
    return s;
  }

  function musicScreen(m) {
    const s = slide("wr-music");
    s.append(el("span", "wr-k", "The Green Room"),
      el("h2", "wr-h", m.requests ? `${fmt(m.requests)} song${m.requests === 1 ? "" : "s"} queued.` : "A regular in the room."));
    const vinyl = el("div", "wr-vinyl wr-spin wr-pop");
    vinyl.setAttribute("aria-hidden", "true");
    const label = el("span");
    if (m.top?.videoId) label.style.backgroundImage = `url("https://i.ytimg.com/vi/${m.top.videoId}/mqdefault.jpg")`;
    vinyl.append(label);
    s.append(vinyl);
    if (m.top) {
      const song = el("div", "wr-song wr-rise wr-d1");
      song.append(el("b", null, m.top.title), el("small", null, `most-played request · ${m.top.times} time${m.top.times === 1 ? "" : "s"}`));
      s.append(song);
    }
    if (m.tier) {
      const w = el("div", "wr-center wr-rise wr-d2");
      w.append(el("span", "wr-elo", `${m.tier} tier${m.rating ? ` · ${fmt(m.rating)} ELO` : ""}`));
      s.append(w);
    }
    const chips = el("div", "wr-chips");
    chips.append(
      Object.assign(chip("🔥 👍 on their songs", fmt(m.good)), { className: "wr-chip wr-rise wr-d3" }),
      Object.assign(chip("🗑️ on their songs", fmt(m.bad)), { className: "wr-chip wr-rise wr-d4" })
    );
    s.append(chips);
    return s;
  }

  function moviesScreen(mv, Y) {
    const s = slide("wr-movies");
    s.append(el("span", "wr-k", "Movies & TV"),
      el("h2", "wr-h", mv.rated ? `${mv.rated} title${mv.rated === 1 ? "" : "s"} rated. Average ${mv.avg} 🍅` : "Movie nights, hosted."));
    if (mv.shelf.length) {
      const row = el("div", "wr-posters");
      mv.shelf.forEach((t, i) => {
        const p = el("div", `wr-poster wr-rise wr-d${i + 1}${t.poster ? " has-art" : ""}`, t.title);
        if (t.poster) p.style.backgroundImage = `url("${t.poster}")`;
        p.title = `${t.title}: ${t.score} / 5`;
        p.append(el("i", null, `${t.score >= 3 ? "🍅" : "🤢"} ${t.score}`));
        row.append(p);
      });
      s.append(row);
    }
    if (mv.hottest) {
      const take = el("div", "wr-take wr-rise wr-d4");
      const p = el("p");
      p.append(document.createTextNode(`${Y} gave `), el("b", null, mv.hottest.title), document.createTextNode(` ${mv.hottest.score} tomato${mv.hottest.score === 1 ? "" : "es"}. Chat had it at `), el("b", null, `${mv.hottest.chatFresh}% fresh`), document.createTextNode("."));
      take.append(el("span", "wr-tk", "Hottest take"), p);
      s.append(take);
    }
    if (mv.rooms) s.append(el("p", "wr-foot", `${mv.rooms} watch room${mv.rooms === 1 ? "" : "s"} hosted · ${mv.roomHours} hours watched together`));
    return s;
  }

  function awardScreen(a) {
    const s = slide("wr-award");
    s.append(el("span", "wr-k wr-center", "The superlative"));
    const medal = el("div", "wr-medal wr-pop", a.emoji);
    medal.setAttribute("aria-hidden", "true");
    s.append(medal, el("h2", "wr-h wr-rise wr-d1", a.title), el("p", "wr-lede wr-center wr-rise wr-d2", a.line));
    return s;
  }

  function shareScreen(d, mine) {
    const s = slide("wr-share");
    s.append(el("span", "wr-k", "The season, on one card"));
    const card = el("div", "wr-card wr-pop");
    const inner = el("div", "wr-card-in");
    const top = el("div", "wr-card-top");
    const who = el("div");
    who.style.minWidth = "0";
    who.append(el("b", null, d.user.displayName), el("small", null, d.award.title));
    top.append(avatar(d.user), who);
    const grid = el("div", "wr-card-grid");
    const cell = (label, value, cls = "") => { const c = el("div"); c.append(el("span", null, label), el("b", `wr-nums ${cls}`.trim(), value)); return c; };
    const p = d.picks, c = d.casino, m = d.music, mv = d.movies;
    grid.append(
      cell("Picks", p ? `${p.wins}–${p.losses}` : "—"),
      cell("Profit", p ? signed(p.profit) : "—", p ? tone(p.profit) : ""),
      cell("Rank", p?.rank ? `#${p.rank}` : "—", "wr-gold"),
      cell("Team", p?.team ? p.team.name.split(" ").slice(-1)[0] : "—"),
      cell("Casino", c ? signed(c.net) : "—", c ? tone(c.net) : ""),
      m?.requests ? cell("Songs", fmt(m.requests)) : cell("Movies", mv?.rated ? `${mv.rated} rated` : "—")
    );
    inner.append(top, grid);
    const foot = el("div", "wr-card-foot");
    foot.append(el("span", null, "EastCoin Wrapped"), el("span", null, d.label));
    card.append(inner, foot);
    s.append(card);

    const link = `https://eastcoin.vip/wrapped/${d.user.login}`;
    const actions = el("div", "wr-actions");
    const copy = el("button", "primary", "Copy link");
    copy.type = "button";
    copy.addEventListener("click", async (e) => {
      e.stopPropagation();
      try { await navigator.clipboard.writeText(link); copy.textContent = "Copied"; } catch { copy.textContent = "Couldn't copy"; }
      setTimeout(() => { copy.textContent = "Copy link"; }, 1600);
    });
    const profile = el("a", "ulink", mine ? "Your profile" : "Their profile");
    profile.href = `/u/${encodeURIComponent(d.user.login)}`;
    actions.append(copy, profile);
    s.append(actions, el("p", "wr-foot", `eastcoin.vip/wrapped/${d.user.login}`));
    return s;
  }

  /* ---------------------------------------------------------- the story */

  function story(d) {
    const mine = String(shell?.state?.session?.user?.login || "").toLowerCase() === d.user.login;
    const Y = mine ? "You" : d.user.displayName;
    const slides = [
      intro(d, mine),
      d.picks && picksScreen(d.picks, Y),
      d.picks && moments(d.picks, Y),
      d.picks && teamScreen(d.picks.team, Y),
      d.casino && casinoScreen(d.casino),
      d.music && musicScreen(d.music),
      d.movies && moviesScreen(d.movies, Y),
      awardScreen(d.award),
      shareScreen(d, mine)
    ].filter(Boolean);

    const wrap = el("section", "wr");
    const box = el("div", "wr-story");
    box.setAttribute("aria-roledescription", "carousel");
    box.setAttribute("aria-label", `${d.user.displayName}'s EastCoin Wrapped`);
    const barsEl = el("div", "wr-bars");
    const bars = slides.map(() => { const i = el("i"); i.append(el("b")); barsEl.append(i); return i; });
    const top = el("div", "wr-top");
    const pause = el("button", null, "❚❚");
    pause.type = "button";
    top.append(el("span", "wr-dot", "E"), el("span", null, `EastCoin Wrapped · ${d.label}`), el("span", "wr-sp"), pause);
    const prev = el("button", "wr-tap prev"); prev.type = "button"; prev.setAttribute("aria-label", "Previous");
    const next = el("button", "wr-tap next"); next.type = "button"; next.setAttribute("aria-label", "Next");
    box.append(barsEl, top, prev, next, ...slides);
    wrap.append(box);

    const under = el("p", "wr-under");
    under.append(document.createTextNode(mine ? "Share yours: " : "Want yours? "));
    const self = String(shell?.state?.session?.user?.login || "").toLowerCase();
    const a = el("a", null, mine ? `eastcoin.vip/wrapped/${d.user.login}` : self ? "Open your Wrapped" : "Log in and open /wrapped");
    a.href = mine ? `/wrapped/${d.user.login}` : self ? `/wrapped/${self}` : "/wrapped";
    a.addEventListener("click", (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      history.pushState({ view: "wrapped" }, "", a.getAttribute("href"));
      load();
    });
    under.append(a);
    wrap.append(under);

    // Playback: the bar fills over SLIDE_MS, then the next screen.
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let at = 0, start = performance.now(), elapsed = 0, paused = Boolean(reduce), raf = 0;
    const setPause = () => { pause.textContent = paused ? "▶" : "❚❚"; pause.setAttribute("aria-label", paused ? "Play" : "Pause"); };
    function show(n) {
      at = Math.max(0, Math.min(slides.length - 1, n));
      slides.forEach((s, i) => {
        const on = i === at;
        if (on) { s.classList.remove("on"); void s.offsetWidth; }
        s.classList.toggle("on", on);
        s.setAttribute("aria-hidden", String(!on));
      });
      bars.forEach((b, i) => { b.firstChild.style.width = i < at ? "100%" : "0"; });
      elapsed = 0; start = performance.now();
    }
    function tick(now) {
      if (!box.isConnected) return;
      if (!paused && !document.hidden) {
        const p = Math.min(1, (elapsed + now - start) / SLIDE_MS);
        bars[at].firstChild.style.width = `${p * 100}%`;
        if (p >= 1) { if (at < slides.length - 1) show(at + 1); else { paused = true; setPause(); } }
      } else if (!paused) { start = now - 0; }
      raf = requestAnimationFrame(tick);
    }
    function toggle() {
      if (paused) { paused = false; start = performance.now(); if (at === slides.length - 1) show(0); }
      else { elapsed += performance.now() - start; paused = true; }
      setPause();
    }
    next.addEventListener("click", () => show(at + 1));
    prev.addEventListener("click", () => show(at - 1));
    pause.addEventListener("click", toggle);
    const onKey = (e) => {
      if (!box.isConnected || e.target.closest?.("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowRight") show(at + 1);
      else if (e.key === "ArrowLeft") show(at - 1);
      else if (e.key === " " && document.activeElement?.closest?.(".wr")) { e.preventDefault(); toggle(); }
    };
    document.addEventListener("keydown", onKey);
    cleanup.push(() => { cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); });
    setPause();
    show(0);
    raf = requestAnimationFrame(tick);
    return wrap;
  }

  /* ---------------------------------------------------------- locked, errors */

  function locked(d) {
    const wrap = el("section", "wr");
    const box = el("div", "wr-locked");
    const when = new Date(d.opensAt);
    const whenText = when.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
    box.append(el("div", "wr-gift", "🎁"), el("h1", null, `EastCoin Wrapped ${d.label}`),
      el("p", null, `${d.user.displayName}'s season, one screen at a time. It drops the morning after the Super Bowl: ${whenText} CT.`));
    const count = el("div", "wr-count");
    const cells = ["days", "hours", "minutes"].map((label) => { const c = el("div"); const b = el("b", null, "0"); c.append(b, el("span", null, label)); count.append(c); return b; });
    const paint = () => {
      const ms = Math.max(0, when.getTime() - Date.now());
      cells[0].textContent = String(Math.floor(ms / 86400000));
      cells[1].textContent = String(Math.floor(ms / 3600000) % 24);
      cells[2].textContent = String(Math.floor(ms / 60000) % 60);
      if (ms <= 0) load();
    };
    paint();
    const id = setInterval(paint, 30000);
    cleanup.push(() => clearInterval(id));
    box.append(count);
    wrap.append(box);
    return wrap;
  }

  function notice(title, text) {
    const wrap = el("section", "wr");
    const box = el("div", "wr-locked");
    box.append(el("div", "wr-gift", "🎁"), el("h1", null, title), el("p", null, text));
    wrap.append(box);
    return wrap;
  }

  async function load() {
    for (const fn of cleanup.splice(0)) fn();
    const mine = ++token;
    await Promise.resolve(window.ECV3?.sessionReady).catch(() => null);
    if (mine !== token || !root?.isConnected) return;
    const login = loginFromPath();
    if (!login) {
      root.replaceChildren(notice("EastCoin Wrapped", "Log in with Twitch to open yours, or visit eastcoin.vip/wrapped/<name> to see someone else's."));
      return;
    }
    if (!/^\/wrapped\/./i.test(location.pathname)) history.replaceState(history.state, "", `/wrapped/${login}`);
    const hold = el("div", "view-loading");
    root.replaceChildren(hold);
    const d = await fetch(`/api/picks/wrapped?login=${encodeURIComponent(login)}`, { credentials: "include" }).then((r) => r.json()).catch(() => null);
    if (mine !== token || !root?.isConnected) return;
    if (!d?.ok) {
      root.replaceChildren(notice("No Wrapped here", d?.message || "That Wrapped didn't load. Try again in a moment."));
      return;
    }
    document.title = `${d.user.displayName}'s EastCoin Wrapped`;
    root.replaceChildren(d.locked ? locked(d) : story(d));
  }

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      needCss();
      load();
    },
    unmount() {
      token += 1;
      for (const fn of cleanup.splice(0)) fn();
      root = null;
    }
  };

  function boot() {
    if (window.ECV3?.register) window.ECV3.register("wrapped", view);
    else setTimeout(boot, 30);
  }
  boot();
})();
