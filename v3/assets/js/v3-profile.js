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

  /** "NFL 1–0" over "MLB 3–1" — a dash for a league with nothing settled. */
  function recordSplit(records) {
    const box = el("span", "recsplit");
    for (const league of ["NFL", "MLB"]) {
      const r = records?.[league];
      const row = el("span", `recsplit-row${r ? "" : " dim"}`);
      row.append(el("small", null, league), document.createTextNode(r ? `${r.wins}–${r.losses}` : "—"));
      if (r) row.title = `${league}: ${r.profit > 0 ? "+" : ""}${r.profit} ZC`;
      box.append(row);
    }
    return box;
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

  /**
   * A paged list: the first page comes with the profile, later pages
   * are fetched on demand from ?list=<kind>&page=N and kept.
   */
  function pagedRows(rows, { login, kind, first, total, pageSize, rowFor, emptyNode }) {
    const pages = Math.max(1, Math.ceil((total || 0) / (pageSize || 10)));
    const cache = { 1: first };
    let at = 1;
    let loading = false;
    const pager = el("div", "mpager pf-pager");
    const prev = el("button", "mpager-btn", "‹");
    const next = el("button", "mpager-btn", "›");
    prev.type = next.type = "button";
    const label = el("span", "mpager-at", "");
    pager.append(prev, label, next);
    pager.hidden = pages <= 1;

    function paint(items) {
      rows.replaceChildren();
      if (!items.length) rows.append(emptyNode());
      for (const it of items) rows.append(rowFor(it));
      label.textContent = `Page ${at} of ${pages} · ${total} total`;
      prev.disabled = at <= 1 || loading;
      next.disabled = at >= pages || loading;
      rows.append(pager);
    }
    async function goTo(n) {
      if (n < 1 || n > pages || loading) return;
      at = n;
      if (cache[n]) { paint(cache[n]); return; }
      loading = true;
      prev.disabled = next.disabled = true;
      label.textContent = "Loading…";
      try {
        const payload = await fetch(`/api/picks/profile?login=${encodeURIComponent(login)}&list=${kind}&page=${n}`).then((r) => r.json()).catch(() => null);
        cache[n] = payload?.ok ? payload.items || [] : [];
      } finally { loading = false; }
      paint(cache[n]);
      rows.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    prev.addEventListener("click", () => goTo(at - 1));
    next.addEventListener("click", () => goTo(at + 1));
    paint(first);
    return rows;
  }

  /* ---------------------------------------------------------- bankroll */

  const SVG = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs = {}) {
    const n = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    return n;
  }

  /**
   * A line of the running net (or, for the owner, the balance) from
   * every wallet operation. Plain SVG, no library: a path, an area, a
   * zero line, and a tooltip that follows the pointer.
   */
  function bankrollSection(b) {
    const section = el("section", "pf-section");
    section.id = "pf-bankroll";
    const h = el("h2", null, "Bankroll");
    h.append(el("small", null, `${b.ops} wallet moves since ${when(b.first, { month: "short", day: "numeric" })} · picks and casino · an open pick counts as out until it settles`));
    section.append(h);

    let mode = "net";
    const card = el("div", "bk-card");
    const top = el("div", "bk-top");
    const stats = el("div", "bk-stats");
    top.append(stats);
    if (b.owner && b.points.some((p) => Number.isFinite(p.bal))) {
      const seg = el("div", "mseg bk-seg");
      const mk = (key, label) => {
        const btn = el("button", `mseg-btn${mode === key ? " on" : ""}`, label);
        btn.type = "button";
        btn.addEventListener("click", () => { mode = key; for (const x of seg.children) x.classList.toggle("on", x === btn); draw(); });
        return btn;
      };
      seg.append(mk("net", "Net"), mk("bal", "Balance"));
      top.append(seg);
    }
    card.append(top);
    const wrapSvg = el("div", "bk-chart");
    const W = 640, H = 200, PAD = { l: 44, r: 14, t: 14, b: 26 };
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "bk-svg", role: "img", "aria-label": "Bankroll over time" });
    wrapSvg.append(svg);
    const tip = el("div", "bk-tip");
    tip.hidden = true;
    wrapSvg.append(tip);
    card.append(wrapSvg);
    section.append(card);

    function series() {
      return b.points.map((p) => ({ t: new Date(p.t).getTime(), v: mode === "bal" ? p.bal : p.net, k: p.k }))
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
    }

    function draw() {
      svg.replaceChildren();
      const pts = series();
      if (pts.length < 2) return;
      const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
      const vs = pts.map((p) => p.v);
      let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
      if (mode === "bal") { lo = Math.min(...vs); hi = Math.max(...vs); }
      if (hi === lo) { hi += 1; lo -= 1; }
      const padV = (hi - lo) * 0.08;
      lo -= padV; hi += padV;
      const x = (t) => PAD.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD.l - PAD.r);
      const y = (v) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
      const last = pts[pts.length - 1].v;
      const tone = mode === "bal" ? "gold" : last > 0 ? "good" : last < 0 ? "bad" : "flat";
      svg.setAttribute("data-tone", tone);

      // Grid: four horizontal lines with labels.
      for (let i = 0; i <= 3; i += 1) {
        const v = lo + ((hi - lo) * i) / 3;
        const yy = y(v);
        svg.append(svgEl("line", { x1: PAD.l, x2: W - PAD.r, y1: yy, y2: yy, class: "bk-grid" }));
        const label = svgEl("text", { x: PAD.l - 6, y: yy + 4, class: "bk-lbl", "text-anchor": "end" });
        label.textContent = Math.round(v).toLocaleString();
        svg.append(label);
      }
      // The zero line, when it is in view.
      if (lo < 0 && hi > 0) svg.append(svgEl("line", { x1: PAD.l, x2: W - PAD.r, y1: y(0), y2: y(0), class: "bk-zero" }));

      // Stepped line: a balance holds until the next operation moves it.
      let d = `M${x(pts[0].t).toFixed(1)},${y(pts[0].v).toFixed(1)}`;
      for (let i = 1; i < pts.length; i += 1) d += ` H${x(pts[i].t).toFixed(1)} V${y(pts[i].v).toFixed(1)}`;
      const base = y(mode === "bal" ? lo : Math.max(lo, Math.min(hi, 0)));
      svg.append(svgEl("path", { d: `${d} V${base.toFixed(1)} H${x(pts[0].t).toFixed(1)} Z`, class: "bk-area" }));
      svg.append(svgEl("path", { d, class: "bk-line" }));
      // The last point, marked.
      svg.append(svgEl("circle", { cx: x(pts[pts.length - 1].t), cy: y(last), r: 4, class: "bk-dot" }));

      // Dates along the bottom: first, middle, last.
      const fmtD = (t) => new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
      for (const [t, anchor] of [[t0, "start"], [(t0 + t1) / 2, "middle"], [t1, "end"]]) {
        const label = svgEl("text", { x: x(t), y: H - 8, class: "bk-lbl", "text-anchor": anchor });
        label.textContent = fmtD(t);
        svg.append(label);
      }

      // Stats under the toggle.
      stats.replaceChildren();
      const st = (label, value, cls) => {
        const box = el("div", `bk-stat${cls ? " " + cls : ""}`);
        box.append(el("span", null, label), el("b", "nums", value));
        return box;
      };
      if (mode === "bal") {
        stats.append(st("Balance now", last.toLocaleString()), st("High", Math.max(...vs).toLocaleString()), st("Low", Math.min(...vs).toLocaleString()));
      } else {
        const sign = (n) => (n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString());
        const tone = (n) => (n > 0 ? "up" : n < 0 ? "down" : "");
        stats.append(
          st("Net", sign(last), tone(last)),
          st("Picks", sign(Number(b.picksNet || 0)), tone(Number(b.picksNet || 0))),
          st("Casino", sign(Number(b.casinoNet || 0)), tone(Number(b.casinoNet || 0))),
          st("Peak", sign(b.peak), tone(b.peak)),
          st("Low", sign(b.trough), tone(b.trough))
        );
      }

      // Tooltip follows the pointer to the nearest point.
      const hover = svgEl("line", { x1: 0, x2: 0, y1: PAD.t, y2: H - PAD.b, class: "bk-hover" });
      hover.setAttribute("visibility", "hidden");
      svg.append(hover);
      svg.onmousemove = (event) => {
        const rect = svg.getBoundingClientRect();
        const px = ((event.clientX - rect.left) / rect.width) * W;
        let best = pts[0], bd = Infinity;
        for (const p of pts) { const dd = Math.abs(x(p.t) - px); if (dd < bd) { bd = dd; best = p; } }
        hover.setAttribute("x1", x(best.t)); hover.setAttribute("x2", x(best.t));
        hover.setAttribute("visibility", "visible");
        const kind = { WAGER_DEBIT: "bet placed", PAYOUT_CREDIT: "paid out", REFUND_CREDIT: "refunded" }[best.k] || best.k;
        tip.textContent = `${when(new Date(best.t).toISOString(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${kind} · ${mode === "bal" ? "" : best.v > 0 ? "+" : ""}${best.v.toLocaleString()}`;
        tip.hidden = false;
        const left = ((x(best.t) / W) * rect.width);
        tip.style.left = `${Math.min(rect.width - 8, Math.max(8, left))}px`;
      };
      svg.onmouseleave = () => { hover.setAttribute("visibility", "hidden"); tip.hidden = true; };
    }
    draw();
    return section;
  }

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
    if (p.status === "WON") { payout.classList.add("up"); payout.append(el("span", "cf-tag win", "WIN"), `+${p.profit}`, el("small", null, `returned ${p.payout}`)); }
    else if (p.status === "LOST") { payout.classList.add("down"); payout.append(el("span", "cf-tag loss", "LOSS"), `−${p.wager}`, el("small", null, "returned 0")); }
    else if (p.status === "REFUNDED") payout.append(el("span", "cf-tag", "VOID"), "0", el("small", null, "refunded"));
    else { payout.classList.add("muted"); payout.append("open", el("small", null, p.market.state === "LOCKED" ? "in play" : "not started")); }
    row.append(who, stake, payout);
    return row;
  }

  function highlight(cls, label, p, big, small) {
    const box = link(`/g/${p.market.slug}`, `gp-hl ${cls} link`);
    box.append(el("span", null, label), el("b", null, big), el("em", null, small));
    return box;
  }

  /* ---------------------------------------------------------- page

     One header card — who they are and the four numbers that matter —
     then tabs: Overview (bankroll and highlights), Picks, Casino,
     Music. The tab is in the hash, so /u/name#casino opens there. */

  const TABS = [["overview", "Overview"], ["picks", "Picks"], ["casino", "Casino"], ["music", "Music"]];
  const GAME_NAME = { flip: "Coin Flip", wheel: "Wheel", race: "Horse Race", hilo: "Higher or Lower" };
  const GAME_ICON = { flip: "🪙", wheel: "🎡", race: "🐎", hilo: "🃏" };

  function quickStat(label, value, note, tone) {
    const box = el("div", `pf-q${tone ? " " + tone : ""}`);
    box.append(el("span", null, label));
    const big = el("b", "nums");
    if (value instanceof Node) big.append(value); else big.textContent = value;
    box.append(big);
    if (note) box.append(el("small", null, note));
    return box;
  }

  function recordNote(records) {
    const parts = [];
    for (const [league, r] of Object.entries(records || {})) if (r && (r.wins || r.losses)) parts.push(`${league} ${r.wins}–${r.losses}`);
    return parts.join(" · ");
  }

  function emoteImg(src) {
    const img = document.createElement("img");
    img.className = "pf-emote";
    img.src = src;
    img.alt = "";
    img.width = 26;
    img.height = 26;
    return img;
  }

  function sectionHead(title, small, emote) {
    const h = el("h2", null, title);
    if (small) h.append(el("small", null, small));
    if (emote) h.append(emoteImg(emote));
    return h;
  }

  function page(data, music) {
    const u = data.user;
    const k = data.picks;
    const c = data.casino;
    const wrap = el("section", "profile");
    wrap.append(profileNav());

    // ---- the header card
    const head = el("div", "pf-card pf-head");
    head.append(avatar(u, "pf-avatar"));
    const copy = el("div", "pf-copy");
    const name = el("h1", null, u.displayName);
    const badges = el("span", "pf-badges");
    for (const b of data.badges || []) badges.append(el("span", `pf-badge ${b.key}`, `${b.emoji} ${b.label}`));
    name.append(badges);
    copy.append(name);
    copy.append(el("p", null, `@${u.login}${u.since ? " · with EastCoin since " + when(u.since, { month: "short", year: "numeric" }) : ""}`));
    copy.append(teamChip(u));
    head.append(copy);

    const seasonName = data.season?.name || "Season";
    const quick = el("div", "pf-quick");
    quick.append(
      quickStat("Record", `${k.wins}–${k.losses}`, recordNote(k.records) || (k.accuracy !== null ? `${k.accuracy}% of settled picks` : "Nothing settled yet")),
      quickStat(`${seasonName} profit`, zc(k.profit, { sign: true }), `${k.staked.toLocaleString()} staked · ${k.total} pick${k.total === 1 ? "" : "s"}`, k.profit > 0 ? "up" : k.profit < 0 ? "down" : ""),
      quickStat("Picks rank", k.rank ? `#${k.rank} of ${k.players}` : "—", k.rank ? "by Picks profit" : "settle a pick to rank"),
      quickStat("Streak", k.streak.current > 0 ? `W${k.streak.current}` : k.streak.current < 0 ? `L${Math.abs(k.streak.current)}` : "—",
        k.streak.bestWin ? `best run ${k.streak.bestWin}` : "no settled picks", k.streak.current > 0 ? "up" : k.streak.current < 0 ? "down" : "")
    );
    head.append(quick);
    wrap.append(head);

    // ---- the tabs
    const bar = el("nav", "pf-tabs");
    bar.setAttribute("aria-label", "Profile sections");
    const panels = {};
    const counts = { picks: k.total, casino: c?.total || 0, music: music?.requests || 0 };
    const buttons = {};
    for (const [key, label] of TABS) {
      const btn = el("button", "pf-tab", label);
      btn.type = "button";
      if (counts[key]) btn.append(el("i", null, String(counts[key])));
      btn.addEventListener("click", () => select(key, true));
      bar.append(btn);
      buttons[key] = btn;
      const panel = el("div", "pf-panel");
      panel.id = `pf-${key}`;
      panel.hidden = true;
      panels[key] = panel;
    }
    wrap.append(bar);

    // ---- Overview: the bankroll, the highlights, and a glance at each tab
    const ov = panels.overview;
    if (data.bankroll?.points?.length > 1) ov.append(bankrollSection(data.bankroll));
    if (k.biggestWin || k.worstBeat) {
      const hls = el("div", "gp-hls");
      if (k.biggestWin) hls.append(highlight("good", "Biggest win", k.biggestWin, `+${k.biggestWin.profit}`, `${k.biggestWin.team} ${formatLine(k.biggestWin.line)} · ${k.biggestWin.wager} staked`));
      if (k.worstBeat) hls.append(highlight("bad", "Worst beat", k.worstBeat, `−${k.worstBeat.wager}`, `${k.worstBeat.team} ${formatLine(k.worstBeat.line)} vs ${k.worstBeat.opponent}`));
      ov.append(hls);
    }
    const glance = el("div", "pf-glance");
    const glanceCard = (key, icon, title, big, small) => {
      const card = el("button", "pf-glance-card");
      card.type = "button";
      card.append(el("span", "pf-glance-k", `${icon} ${title}`), el("b", "nums", big), el("small", null, small), el("em", null, "Open →"));
      card.addEventListener("click", () => select(key, true));
      return card;
    };
    glance.append(
      glanceCard("picks", "🪙", "Picks", `${k.wins}–${k.losses}`, k.open ? `${k.open} open right now` : `${k.total} pick${k.total === 1 ? "" : "s"} all season`),
      glanceCard("casino", "🎰", "Casino", c ? `${c.net > 0 ? "+" : ""}${c.net.toLocaleString()}` : "—", c ? `${c.wins}–${c.losses} across ${c.total} play${c.total === 1 ? "" : "s"}` : "no results yet"),
      glanceCard("music", "🎵", "Green Room", music ? String(music.rating ?? 1000) : "—", music ? `ELO · ${music.requests} request${music.requests === 1 ? "" : "s"}` : "no requests yet")
    );
    ov.append(glance);
    const foot = el("div", "gp-links");
    foot.append(link("/?view=picks&tab=leaderboard", "gp-back", "Leaderboard"), link("/?view=picks&tab=ledger", "gp-back", "Community Ledger"), link("/?view=casino", "gp-back", "Casino floor"));
    ov.append(foot);

    // ---- Picks
    const pk = panels.picks;
    pk.append(sectionHead("Picks", k.open ? `${k.open} open` : ""));
    const pstrip = el("div", "summarystrip");
    pstrip.append(
      stat("Record", recordSplit(k.records), k.accuracy !== null ? `${k.accuracy}% of settled picks` : "Nothing settled yet"),
      stat("Staked", k.staked.toLocaleString(), `across ${k.total} pick${k.total === 1 ? "" : "s"}`),
      stat("Best run", k.streak.bestWin ? `${k.streak.bestWin} straight` : "—", k.streak.worstLoss ? `worst: ${k.streak.worstLoss} in a row` : "")
    );
    pk.append(pstrip);
    const prow = el("div", "gp-rows");
    pagedRows(prow, {
      login: u.login, kind: "picks", first: k.recent, total: k.total, pageSize: k.pageSize || 10, rowFor: pickRow,
      emptyNode: () => emptyNote("No picks yet", "Anything they lock in — from the site or with !pick in chat — shows here.")
    });
    pk.append(el("h3", "pf-sub", "Every pick, newest first"), prow);

    // ---- Casino
    const cs = panels.casino;
    cs.append(sectionHead("Casino", "", "https://cdn.betterttv.net/emote/68e8507220472aa979f64123/2x.webp"));
    if (!c) {
      const note = emptyNote("No casino results yet", "Coin Flip, the Wheel and Higher or Lower — wins and losses show here.");
      note.append(link("/?view=casino", "gp-back", "Go to the casino →"));
      cs.append(note);
    } else {
      const cstrip = el("div", "summarystrip");
      cstrip.append(
        stat("Record", `${c.wins}–${c.losses}`, `${c.total} play${c.total === 1 ? "" : "s"} · ${c.staked.toLocaleString()} staked`),
        stat("Net", zc(c.net, { sign: true }), c.net > 0 ? "up on the house" : c.net < 0 ? "down to the house" : "dead even", c.net > 0 ? "wallet" : ""),
        stat("Biggest win", zc(c.biggestWin, { sign: true }), "single bet"),
        stat("Favourite", c.favourite ? `${GAME_ICON[c.favourite.game] || ""} ${GAME_NAME[c.favourite.game] || c.favourite.game}` : "—", c.favourite ? `${c.favourite.plays} play${c.favourite.plays === 1 ? "" : "s"}` : "")
      );
      cs.append(cstrip);
      const casinoRow = (r) => {
        const won = r.status === "WON";
        const row = el("div", `gp-row ${won ? "won" : "lost"}`);
        const who = el("div", "gp-who");
        who.append(el("b", null, `${GAME_ICON[r.game] || "🎰"} ${GAME_NAME[r.game] || r.game} · ${r.pick}`),
          el("span", null, r.at ? when(r.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""));
        const stake = el("div", "gp-stake");
        stake.append(el("b", "nums", String(r.wager)), document.createTextNode("staked"));
        const payout = el("div", `gp-payout nums ${won ? "up" : "down"}`);
        payout.append(el("span", `cf-tag ${won ? "win" : "loss"}`, won ? "WIN" : "LOSS"), document.createTextNode(won ? `+${r.profit}` : `−${r.wager}`));
        row.append(who, stake, payout);
        return row;
      };
      const crow = el("div", "gp-rows");
      pagedRows(crow, {
        login: u.login, kind: "casino", first: c.recent, total: c.total, pageSize: c.pageSize || 10, rowFor: casinoRow,
        emptyNode: () => emptyNote("No results yet", "")
      });
      cs.append(el("h3", "pf-sub", "Latest results"), crow);
    }

    // ---- Music
    const ms = panels.music;
    ms.append(sectionHead("In the Green Room", "", "https://cdn.7tv.app/emote/01GAJBNT780004XAVG6P7AZAK2/4x.webp"));
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
        ms.append(el("h3", "pf-sub", "Latest requests"), list);
      }
    }

    for (const key of Object.keys(panels)) wrap.append(panels[key]);

    // ---- selection, remembered in the hash
    function select(key, push) {
      if (!panels[key]) key = "overview";
      for (const [k2, panel] of Object.entries(panels)) {
        panel.hidden = k2 !== key;
        buttons[k2].classList.toggle("on", k2 === key);
        buttons[k2].setAttribute("aria-selected", String(k2 === key));
      }
      if (push) {
        const url = new URL(location.href);
        url.hash = key === "overview" ? "" : key;
        history.replaceState(history.state, "", url.pathname + url.search + url.hash);
      }
    }
    const wanted = String(location.hash || "").replace(/^#(pf-)?/, "");
    select(panels[wanted] ? wanted : "overview", false);
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
