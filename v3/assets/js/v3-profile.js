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
      // Rank 1 is whoever is top of the rated list, same rule as the Music ELO tab.
      const ratedAll = (payload.userStats || []).filter((s) => Number(s.rated) > 0).sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
      const isTop = Boolean(stats) && Number(stats.rated) > 0 && ratedAll[0]?.login === stats.login;
      // Last place is always Bronze, same as the Music ELO tab.
      const isLast = Boolean(stats) && Number(stats.rated) > 0 && ratedAll.length > 1 && ratedAll[ratedAll.length - 1]?.login === stats.login;
      const r = stats ? Number(stats.rating) || 1000 : 1000;
      const tier = !stats || !Number(stats.rated) ? null
        : isTop ? { key: "rank1", label: "Rank 1" }
          : isLast ? { key: "bronze", label: "Bronze" }
            : r >= 1015 ? { key: "gold", label: "Gold" } : r >= 1000 ? { key: "silver", label: "Silver" } : { key: "bronze", label: "Bronze" };
      const mine = (payload.history || []).filter((h) => String(h.requestedByLogin || "").toLowerCase() === login);
      const titles = new Map();
      for (const h of mine) titles.set(h.title, (titles.get(h.title) || 0) + 1);
      const top = [...titles.entries()].sort((a, b) => b[1] - a[1])[0] || null;
      if (!stats && !mine.length) return null;
      return {
        tier,
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
    wrap.append(profileNav());

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
      `@${u.login}${u.since ? " · with EastCoin since " + when(u.since, { month: "short", year: "numeric" }) : ""}`);
    copy.append(sub);
    copy.append(teamChip(u));
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
    recent.id = "pf-picks";
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
    ms.id = "pf-music";
    const mh = el("h2", null, "In the Green Room");
    const jamgie = document.createElement("img");
    jamgie.className = "pf-emote";
    jamgie.src = "https://cdn.7tv.app/emote/01GAJBNT780004XAVG6P7AZAK2/4x.webp";
    jamgie.alt = "";
    jamgie.width = 26;
    jamgie.height = 26;
    mh.append(jamgie);
    ms.append(mh);
    if (!music) {
      ms.append(emptyNote("No requests yet", "Songs they queue in the Green Room, and how the room rated them, show here."));
    } else {
      const mstrip = el("div", "summarystrip");
      mstrip.append(
        (() => {
          const value = el("span", "pf-elo");
          if (music.tier) value.append(el("span", `elo-tier ${music.tier.key}`, music.tier.label));
          value.append(document.createTextNode(music.rating != null ? String(music.rating) : "1000"));
          return stat("Music ELO", value, music.rated ? `${music.rated} song${music.rated === 1 ? "" : "s"} rated` : "Unranked until a song is rated", music.rating >= 1000 ? "wallet" : "");
        })(),
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

    // Coin Flip — built but not shown until the casino gets the go-ahead.
    // Flip SHOW_FLIP to bring the section (and the footer link) back.
    const SHOW_FLIP = false;
    const fs = el("section", "pf-section");
    const fh = el("h2", null, "Coin Flip");
    const flipEmote = document.createElement("img");
    flipEmote.className = "pf-emote";
    flipEmote.src = "https://cdn.betterttv.net/emote/6928e7173a375a69ca4d0d47/2x.webp";
    flipEmote.alt = "";
    flipEmote.width = 26;
    flipEmote.height = 26;
    fh.append(flipEmote);
    fs.append(fh);
    const f = data.flip;
    if (!f) {
      const note = emptyNote("No flips yet", "Heads or tails at the coin flip — wins, losses and streaks show here.");
      const go = link("/?view=flip", "gp-back", "Go flip a coin →");
      go.dataset.route = "flip";
      note.append(go);
      fs.append(note);
    } else {
      const fstrip = el("div", "summarystrip");
      fstrip.append(
        stat("Record", `${f.wins}–${f.losses}`, `${f.total} flip${f.total === 1 ? "" : "s"} · ${Math.round(100 * f.heads / f.total)}% called heads`),
        stat("Net", zc(f.net, { sign: true }), `${f.staked.toLocaleString()} staked`, f.net > 0 ? "wallet" : ""),
        stat("Biggest win", zc(f.biggestWin, { sign: true }), "single flip"),
        stat("Streak", f.streak > 0 ? `W${f.streak}` : `L${Math.abs(f.streak)}`, f.streak > 0 ? "wins in a row" : "losses in a row")
      );
      fs.append(fstrip);
      const rows = el("div", "gp-rows");
      for (const r of f.recent) {
        const row = el("div", `gp-row ${r.status === "WON" ? "won" : "lost"}`);
        const who = el("div", "gp-who");
        who.append(el("b", null, `${r.side[0].toUpperCase() + r.side.slice(1)} · it landed ${r.result}`),
          el("span", null, `Round #${r.round}${r.settledAt ? " · " + when(r.settledAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}`));
        const stake = el("div", "gp-stake");
        stake.append(el("b", "nums", String(r.wager)), document.createTextNode("staked"));
        const payout = el("div", `gp-payout nums ${r.status === "WON" ? "up" : "down"}`);
        payout.append(el("span", `cf-tag ${r.status === "WON" ? "win" : "loss"}`, r.status === "WON" ? "WIN" : "LOSS"), document.createTextNode(r.status === "WON" ? `+${r.profit}` : `−${r.wager}`));
        row.append(who, stake, payout);
        rows.append(row);
      }
      fs.append(el("h3", "pf-sub", "Latest flips"), rows);
    }
    if (SHOW_FLIP) wrap.append(fs);

    const foot = el("div", "gp-links");
    foot.append(link("/?view=picks&tab=leaderboard", "gp-back", "Leaderboard"), link("/?view=picks&tab=ledger", "gp-back", "Community Ledger"));
    if (SHOW_FLIP) foot.append(link("/?view=flip", "gp-back", "Coin Flip"));
    wrap.append(foot);
    return wrap;
  }

  /* ---------------------------------------------------------- sub nav

     One row under the name: jumps to the sections on this page on
     the left, the way back to the rest of the site on the right.
     Every link stays inside the shell, so the chat never reloads. */

  function profileNav() {
    const nav = el("nav", "pf-nav");
    nav.setAttribute("aria-label", "Profile links");
    nav.append(
      link("/?view=users", "pf-nav-link", "All Users"),
      link("/?view=picks", "pf-nav-link", "← Back to Picks")
    );
    return nav;
  }

  /* ---------------------------------------------------------- favourite team

     Their club, chosen on their own page. Everyone sees the logo and
     the name; the owner also gets a way to pick or change it. The
     list comes from the server so the page and the save endpoint
     can never disagree about what counts as a team. */

  function isMine(u) {
    const me = String(shell?.state?.session?.user?.login || "").toLowerCase();
    return Boolean(me) && me === String(u?.login || "").toLowerCase();
  }

  function teamCrest(team, className) {
    const box = el("span", className, team ? team.name.split(" ").pop().slice(0, 3).toUpperCase() : "?");
    if (!team?.logo) return box;
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.addEventListener("load", () => box.classList.add("has-logo"));
    img.addEventListener("error", () => img.remove());
    img.src = team.logo;
    box.append(img);
    return box;
  }

  function teamChip(u) {
    const wrap = el("div", "pf-teamwrap");
    const mine = isMine(u);
    const fav = u.favourite;
    if (!fav && !mine) return wrap;

    const row = el("div", "pf-team");
    if (fav) {
      row.append(teamCrest(fav, "pf-team-crest"));
      const copy = el("div");
      copy.append(el("b", null, fav.name), el("small", null, `${fav.leagueLabel} · favourite team`));
      row.append(copy);
    } else {
      row.append(el("small", "pf-team-none", "No favourite team yet."));
    }
    if (mine) {
      const btn = el("button", "btn pf-team-btn", fav ? "Change" : "Pick your team");
      btn.type = "button";
      btn.addEventListener("click", () => openTeamPicker(wrap, u));
      row.append(btn);
    }
    wrap.append(row);
    return wrap;
  }

  async function openTeamPicker(wrap, u) {
    if (wrap.querySelector(".pf-teampick")) return;
    const panel = el("form", "pf-teampick");
    panel.append(el("small", "pf-teampick-note", "Loading teams…"));
    wrap.append(panel);

    let payload = null;
    try {
      payload = await fetch("/api/picks/favourite", { credentials: "include" }).then((r) => r.json());
    } catch { payload = null; }
    if (!payload?.ok) {
      panel.replaceChildren(el("small", "pf-teampick-note", "Couldn't load the team list. Try again in a moment."));
      return;
    }

    const current = payload.mine || u.favourite || null;
    const leagueSel = document.createElement("select");
    leagueSel.className = "sc-select";
    leagueSel.setAttribute("aria-label", "League");
    for (const l of payload.catalog) {
      const o = document.createElement("option");
      o.value = l.key;
      o.textContent = l.label;
      leagueSel.append(o);
    }
    const teamSel = document.createElement("select");
    teamSel.className = "sc-select";
    teamSel.setAttribute("aria-label", "Team");
    const fillTeams = () => {
      teamSel.replaceChildren();
      const l = payload.catalog.find((x) => x.key === leagueSel.value);
      for (const t of l?.teams || []) {
        const o = document.createElement("option");
        o.value = t.abbr;
        o.textContent = t.name;
        teamSel.append(o);
      }
    };
    leagueSel.value = current?.league || payload.catalog[0]?.key || "nfl";
    fillTeams();
    if (current?.abbr) teamSel.value = current.abbr;
    leagueSel.addEventListener("change", fillTeams);

    const save = el("button", "btn primary", "Save");
    save.type = "submit";
    const cancel = el("button", "btn", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => panel.remove());
    const note = el("small", "pf-teampick-note");

    panel.replaceChildren(leagueSel, teamSel, save);
    if (current) {
      const clear = el("button", "btn pf-team-clear", "Remove");
      clear.type = "button";
      clear.addEventListener("click", () => submit({ clear: true }));
      panel.append(clear);
    }
    panel.append(cancel, note);

    const submit = async (body) => {
      note.textContent = "Saving…";
      save.disabled = true;
      try {
        const r = await fetch("/api/picks/favourite", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body)
        }).then((x) => x.json());
        if (!r?.ok) throw new Error(r?.message || "Couldn't save.");
        load();   // the page redraws with the new club
      } catch (error) {
        note.textContent = error.message || "Couldn't save.";
        save.disabled = false;
      }
    };
    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      submit({ league: leagueSel.value, team: teamSel.value });
    });
  }

  /* The profile in outline while it loads: the avatar and name, four
     stat cards, then recent picks — the same shapes the page takes. */
  function skeletonPage() {
    const sk = (w, h, cls) => {
      const b = el("span", `sk${cls ? " " + cls : ""}`);
      b.style.width = typeof w === "number" ? `${w}px` : w;
      b.style.height = `${h}px`;
      return b;
    };
    const wrap = el("section", "profile");
    wrap.setAttribute("aria-busy", "true");
    const head = el("div", "pf-head");
    const copy = el("div", "pf-copy sk-lines");
    copy.append(sk(220, 24), sk(260, 10));
    head.append(sk(72, 72, "circle"), copy);
    wrap.append(head);

    const strip = el("div", "summarystrip");
    for (let i = 0; i < 4; i += 1) {
      const card = el("article", "summarycard is-sk sk-lines");
      card.append(sk(84, 8), sk(70, 22), sk(120, 8));
      strip.append(card);
    }
    wrap.append(strip);

    const section = el("section", "pf-section");
    section.append(sk(130, 16));
    const rows = el("div", "gp-rows");
    rows.style.marginTop = "12px";
    for (let i = 0; i < 4; i += 1) {
      const row = el("div", "gp-row is-sk");
      const who = el("div", "gp-who sk-lines");
      who.append(sk(150 + (i % 3) * 30, 11), sk(100, 8));
      const stake = el("div", "gp-stake sk-right");
      stake.append(sk(48, 11), sk(60, 8));
      row.append(sk(34, 34, "tile"), who, stake);
      rows.append(row);
    }
    section.append(rows);
    wrap.append(section);
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
    root.replaceChildren(skeletonPage());
    if (!login) { root.replaceChildren(notice("No profile here", "Profiles live at eastcoin.vip/u/<twitch name>.")); return; }

    // The session is read in parallel with everything else on a cold
    // load; wait for it so "is this my page" is answered before drawing.
    const [payload, music] = await Promise.all([
      fetch(`/api/picks/profile?login=${encodeURIComponent(login)}`).then((r) => r.json()).catch(() => null),
      musicFor(login),
      Promise.resolve(window.ECV3?.sessionReady).catch(() => null)
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
    } else if (href.startsWith("/?view=flip")) {
      event.preventDefault();
      history.pushState({ view: "flip" }, "", href);
      shell.go("flip", { push: false });
    } else if (href.startsWith("/?view=music")) {
      event.preventDefault();
      history.pushState({ view: "music" }, "", href);
      shell.go("music", { push: false });
    } else if (href.startsWith("/?view=users")) {
      event.preventDefault();
      history.pushState({ view: "users" }, "", href);
      shell.go("users", { push: false });
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
