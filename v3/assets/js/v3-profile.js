/* ============================================================
   EastCoin V3 — profiles

     /u/bootypaper

   A person: their Picks record, rank and streak, biggest win and
   worst beat, favourite team, recent picks, and what they are like
   in the Green Room. Picks come from /api/picks/profile; music
   comes from the room's own history feed, read here so the Pages
   side never has to reach the worker.
   ============================================================ */
(() => {
  "use strict";

  let root = null;
  let shell = null;
  let token = 0;
  let previousTitle = "";

  /* ---------------------------------------------------------- helpers */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function link(href, className, text) {
    const a = el("a", className, text);
    a.href = href;
    return a;
  }

  function formatLine(american) {
    const line = Number(american);
    if (!Number.isFinite(line) || line === 0) return "—";
    return line > 0 ? `+${line}` : `−${Math.abs(line)}`;
  }

  function zc(value, { sign = false } = {}) {
    const wrap = el("span", "zc-amount nums");
    const img = document.createElement("img");
    img.className = "zcoin-mark";
    img.src = "/v3/assets/img/zcoin.webp";
    img.alt = "";
    img.width = 15;
    img.height = 15;
    const n = Number(value) || 0;
    const prefix = sign && n > 0 ? "+" : sign && n < 0 ? "−" : "";
    wrap.append(img, document.createTextNode(`${prefix}${Math.abs(n).toLocaleString()}`));
    return wrap;
  }

  function when(iso, opts) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], opts);
  }

  function loginFromPath() {
    const m = /^\/u\/([a-z0-9_]{2,25})/i.exec(location.pathname);
    return m ? m[1].toLowerCase() : "";
  }

  function avatar(user, className) {
    const name = user?.displayName || user?.login || "?";
    const box = el("span", className, name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?");
    const src = String(user?.avatar || user?.profileImageUrl || "");
    if (!src) return box;
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.addEventListener("load", () => box.classList.add("has-logo"));
    img.addEventListener("error", () => img.remove());
    img.src = src;
    box.append(img);
    return box;
  }

  function crest(market, name, className) {
    if (window.ECLogos) return window.ECLogos.crest(market?.sport, market?.league, name, className);
    return el("span", className, String(name || "?").slice(0, 3).toUpperCase());
  }

  function stat(label, value, note, className) {
    const card = el("article", `summarycard${className ? " " + className : ""}`);
    card.append(el("span", null, label));
    const strong = el("strong", "nums");
    if (value instanceof Node) strong.append(value); else strong.textContent = value;
    card.append(strong);
    if (note) card.append(el("small", null, note));
    return card;
  }

  function emptyNote(strong, text) {
    const box = el("div", "empty");
    box.append(el("strong", null, strong), el("p", null, text));
    return box;
  }

  /* ---------------------------------------------------------- music */

  async function musicFor(login) {
    const config = window.EASTCOIN_MUSIC_CONFIG || {};
    const base = String(config.websocketUrl || "").trim();
    if (!base) return null;
    try {
      const response = await fetch(`${base}/history/${encodeURIComponent(config.room || "main")}`);
      if (!response.ok) return null;
      const payload = await response.json();
      const stats = (payload.userStats || []).find((s) => String(s.login || "").toLowerCase() === login) || null;
      const mine = (payload.history || []).filter((h) => String(h.requestedByLogin || "").toLowerCase() === login);
      const titles = new Map();
      for (const h of mine) titles.set(h.title, (titles.get(h.title) || 0) + 1);
      const top = [...titles.entries()].sort((a, b) => b[1] - a[1])[0] || null;
      if (!stats && !mine.length) return null;
      return {
        rating: stats ? Math.round(Number(stats.rating) || 1000) : null,
        rated: stats ? Number(stats.rated || 0) : 0,
        good: stats ? Number(stats.up || 0) + Number(stats.fire || 0) : 0,
        bad: stats ? Number(stats.trash || 0) + Number(stats.del || 0) : 0,
        requests: stats ? Number(stats.count || mine.length) : mine.length,
        top: top ? { title: top[0], times: top[1] } : null,
        latest: mine.slice(-3).reverse().map((h) => h.title)
      };
    } catch {
      return null;
    }
  }

  /* ---------------------------------------------------------- page */

  function pickRow(p) {
    const status = { ACTIVE: "open", WON: "won", LOST: "lost", REFUNDED: "refund" }[p.status] || "open";
    const row = link(`/g/${p.market.slug}`, `gp-row ${status} link`);
    row.append(crest(p.market, p.team, "tpick-crest"));
    const who = el("div", "gp-who");
    who.append(
      el("b", null, `${p.team} ${formatLine(p.line)}`),
      el("span", null, `vs ${p.opponent}${p.market.league ? " · " + p.market.league : ""} · ${when(p.market.startsAt, { month: "short", day: "numeric" })}`)
    );
    const stake = el("div", "gp-stake");
    stake.append(el("b", "nums", String(p.wager)), document.createTextNode("staked"));
    const payout = el("div", "gp-payout nums");
    if (p.status === "WON") { payout.classList.add("up"); payout.append(`+${p.profit}`, el("small", null, `returned ${p.payout}`)); }
    else if (p.status === "LOST") { payout.classList.add("down"); payout.append(`−${p.wager}`, el("small", null, "returned 0")); }
    else if (p.status === "REFUNDED") payout.append("0", el("small", null, "refunded"));
    else { payout.classList.add("muted"); payout.append("open", el("small", null, p.market.state === "LOCKED" ? "in play" : "not started")); }
    row.append(who, stake, payout);
    return row;
  }

  function highlight(cls, label, p, big, small) {
    const box = link(`/g/${p.market.slug}`, `gp-hl ${cls} link`);
    box.append(el("span", null, label), el("b", null, big), el("em", null, small));
    return box;
  }

  function page(data, music) {
    const u = data.user;
    const k = data.picks;
    const wrap = el("section", "profile");

    // Head
    const head = el("div", "pf-head");
    head.append(avatar(u, "pf-avatar"));
    const copy = el("div", "pf-copy");
    const name = el("h1", null, u.displayName);
    // Badges come from the same server answer every other name uses,
    // so the profile can never disagree with the leaderboard.
    const badges = el("span", "pf-badges");
    for (const b of data.badges || []) badges.append(el("span", `pf-badge ${b.key}`, `${b.emoji} ${b.label}`));
    name.append(badges);
    copy.append(name);
    const sub = el("p", null,
      `@${u.login}${u.since ? " · with EastCoin since " + when(u.since, { month: "short", year: "numeric" }) : ""}` +
      (k.favourite ? ` · rides with the ${window.ECLogos ? window.ECLogos.nickname(k.favourite.team).replace(/\b\w/g, (c) => c.toUpperCase()) : k.favourite.team}` : ""));
    copy.append(sub);
    head.append(copy);
    wrap.append(head);

    // Stats
    const strip = el("div", "summarystrip");
    const seasonName = data.season?.name || "Season";
    strip.append(
      stat("Record", `${k.wins}–${k.losses}`, k.accuracy !== null ? `${k.accuracy}% of settled picks` : "Nothing settled yet"),
      stat(`${seasonName} profit`, zc(k.profit, { sign: true }), `${k.staked.toLocaleString()} staked across ${k.total} pick${k.total === 1 ? "" : "s"}`, k.profit > 0 ? "wallet" : ""),
      stat("Picks rank", k.rank ? `#${k.rank} of ${k.players}` : "—", k.rank ? "Ranked by Picks profit" : "Settle a pick to be ranked"),
      stat("Streak", k.streak.current > 0 ? `W${k.streak.current}` : k.streak.current < 0 ? `L${Math.abs(k.streak.current)}` : "—",
        k.streak.bestWin ? `Best run: ${k.streak.bestWin} straight` : "No settled picks yet")
    );
    wrap.append(strip);

    // Best and worst
    if (k.biggestWin || k.worstBeat) {
      const hls = el("div", "gp-hls");
      if (k.biggestWin) hls.append(highlight("good", "Biggest win", k.biggestWin, `+${k.biggestWin.profit}`, `${k.biggestWin.team} ${formatLine(k.biggestWin.line)} · ${k.biggestWin.wager} staked`));
      if (k.worstBeat) hls.append(highlight("bad", "Worst beat", k.worstBeat, `−${k.worstBeat.wager}`, `${k.worstBeat.team} ${formatLine(k.worstBeat.line)} vs ${k.worstBeat.opponent}`));
      wrap.append(hls);
    }

    // Recent picks
    const recent = el("section", "pf-section");
    const rh = el("h2", null, "Recent picks");
    rh.append(el("small", null, k.open ? `${k.open} open` : ""));
    recent.append(rh);
    const rows = el("div", "gp-rows");
    if (!k.recent.length) rows.append(emptyNote("No picks yet", "Anything they lock in — from the site or with !pick in chat — shows here."));
    for (const p of k.recent) rows.append(pickRow(p));
    recent.append(rows);
    wrap.append(recent);

    // Music
    const ms = el("section", "pf-section");
    const mh = el("h2", null, "In the Green Room");
    ms.append(mh);
    if (!music) {
      ms.append(emptyNote("No requests yet", "Songs they queue in the Green Room, and how the room rated them, show here."));
    } else {
      const mstrip = el("div", "summarystrip");
      mstrip.append(
        stat("Music ELO", music.rating != null ? String(music.rating) : "1000", music.rated ? `${music.rated} song${music.rated === 1 ? "" : "s"} rated` : "Nothing rated yet", music.rating >= 1000 ? "wallet" : ""),
        stat("Reactions", `${music.good} good`, `${music.bad} bad`),
        stat("Requests", String(music.requests), music.top ? `Most played: ${music.top.title}${music.top.times > 1 ? " ×" + music.top.times : ""}` : "")
      );
      ms.append(mstrip);
      if (music.latest.length) {
        const list = el("ul", "pf-songs");
        for (const t of music.latest) list.append(el("li", null, t));
        const lh = el("h3", "pf-sub", "Latest requests");
        ms.append(lh, list);
      }
    }
    wrap.append(ms);

    const foot = el("div", "gp-links");
    foot.append(link("/?view=picks&tab=leaderboard", "gp-back", "Leaderboard"), link("/?view=picks&tab=ledger", "gp-back", "Community Ledger"));
    wrap.append(foot);
    return wrap;
  }

  function notice(strong, text) {
    const wrap = el("section", "profile");
    const box = el("div", "gp-notice");
    const img = el("img", "gp-logo");
    img.src = "/assets/eastcoins-logo.webp";
    img.alt = "";
    box.append(img, el("strong", null, strong), el("p", null, text));
    wrap.append(box);
    return wrap;
  }

  async function load() {
    const login = loginFromPath();
    const mine = ++token;
    root.replaceChildren(notice("Loading…", "Reading the ledger."));
    if (!login) { root.replaceChildren(notice("No profile here", "Profiles live at eastcoin.vip/u/<twitch name>.")); return; }

    const [payload, music] = await Promise.all([
      fetch(`/api/picks/profile?login=${encodeURIComponent(login)}`).then((r) => r.json()).catch(() => null),
      musicFor(login)
    ]);
    if (mine !== token || !root.isConnected) return;

    if (!payload?.ok) {
      document.title = `${login} — EastCoin`;
      root.replaceChildren(notice("No profile yet", payload?.message || "Nobody by that name has made a pick yet."));
      return;
    }
    document.title = `${payload.user.displayName} — EastCoin`;
    root.replaceChildren(page(payload, music));
  }

  // Links inside the page stay inside the shell.
  function onClick(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const a = event.target.closest("a");
    if (!a || !root.contains(a)) return;
    const href = a.getAttribute("href") || "";
    if (href.startsWith("/g/")) {
      event.preventDefault();
      history.pushState({ view: "game" }, "", href);
      shell.go("game", { push: false });
    } else if (href.startsWith("/?view=picks")) {
      event.preventDefault();
      history.pushState({ view: "picks" }, "", href);
      shell.go("picks", { push: false });
    }
  }

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      previousTitle = document.title;
      root.addEventListener("click", onClick);
      load();
    },
    unmount() {
      token++;
      root?.removeEventListener("click", onClick);
      document.title = previousTitle || "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("profile", view);
  }
  boot();
})();
