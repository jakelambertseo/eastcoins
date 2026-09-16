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
    const raw = String(user?.avatar || user?.profileImageUrl || "");
    // The card's photo is drawn at ~176px and keeps the full picture.
    const src = className === "tc-photo" || !window.ECAvatar ? raw : window.ECAvatar.small(raw);
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
    if (String(market?.sport || "").toLowerCase() === "prop") {
      const yes = String(name).toLowerCase() !== "no";
      return el("span", `${className} propmark ${yes ? "yes" : "no"}`, yes ? "✓" : "✗");
    }
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
          ...(Number(b.storeNet || 0) ? [st("Store", sign(Number(b.storeNet)), tone(Number(b.storeNet)))] : []),
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
      el("span", null, String(p.market.sport || "").toLowerCase() === "prop"
        ? `${p.market.question || "Prop bet"} · ${when(p.market.startsAt, { month: "short", day: "numeric" })}`
        : `vs ${p.opponent}${p.market.league ? " · " + p.market.league : ""} · ${when(p.market.startsAt, { month: "short", day: "numeric" })}`)
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

  const TABS = [["overview", "Overview"], ["picks", "Picks"], ["casino", "Casino"], ["music", "Music"], ["movies", "Movies"]];

  /* A tomato score as the row of tomatoes it is; zero is the splat. */
  const tomatoes = (n) => (n > 0 ? "🍅".repeat(n) : "🤢");

  function movieCard(r) {
    const a = link(`/?view=screen&t=${r.type}&id=${r.id}`, `sc-card pf-movie ${r.score >= 3 ? "fresh" : "rotten"}`);
    a.title = `${r.title}: ${r.score} / 5`;
    if (r.poster) { const img = el("img", "sc-poster"); img.src = r.poster; img.alt = ""; img.loading = "lazy"; a.append(img); }
    else a.append(el("div", "sc-ph", (r.title || "?").split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase()));
    a.append(el("span", "sc-kind", r.type === "tv" ? "SHOW" : "MOVIE"), el("span", "pf-tomato nums", `${r.score >= 3 ? "🍅" : "🤢"} ${r.score}`));
    const cap = el("div", "sc-cap");
    cap.append(el("b", null, r.title), el("small", null, `${tomatoes(r.score)}${r.year ? " · " + r.year : ""}`));
    a.append(cap);
    return a;
  }
  const LEAGUE_NAME = { NFL: "NFL", MLB: "MLB", CFB: "CFB", UFC: "UFC", BOXING: "Boxing", PROP: "Prop", NBA: "NBA", NHL: "NHL" };
  const GAME_NAME = { flip: "Coin Flip", wheel: "Wheel", race: "Horse Race", hilo: "Higher or Lower", mines: "Mines", plinko: "Plinko", scratch: "Scratch-Off", roulette: "Russian Roulette", standing: "Last One Standing" };
  const GAME_ICON = { flip: "🪙", wheel: "🎡", race: "🐎", hilo: "🃏", mines: "💣", plinko: "🎯", scratch: "🎟️", roulette: "🔫", standing: "🏁" };

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

  /* ------------------------------------------------------------ the card

     The profile header as a physical trading card: the photo on a
     coloured panel, the name across the bottom of it, and the league
     table on the back. Every figure already comes back from
     /api/picks/profile — nothing new is tracked for it.

     The FINISH is the point. It comes off the season ladder, so the
     card changes when someone climbs rather than being a picture of a
     page. Deliberately no team crest and no fallback mark behind the
     photo: half the site has not picked a team, and a placeholder
     badge on those cards read as a missing image rather than a design.

     It is not live. The page fetches once on mount and never polls, so
     a card showing #1 keeps showing #1 until the profile is opened
     again. See the note in CLAUDE.md before changing that — a poll
     here is not free. */
  function tierOf(k) {
    if (k.rank === 1) return "gold";
    if ((k.rank && k.rank <= 5) || (k.accuracy !== null && k.accuracy >= 80)) return "silver";
    return "base";
  }

  /** The one line under the name: their loudest badge, else the record. */
  function billing(data) {
    const first = (data.badges || [])[0];
    if (first) return String(first.label).split("\u2014")[0].trim();
    const k = data.picks;
    if (!k.total) return "No picks settled";
    return k.accuracy !== null ? `${k.accuracy}% right` : "Picks";
  }

  function tradingCard(data) {
    const u = data.user;
    const k = data.picks;
    const tier = tierOf(k);

    // Store cosmetics. An EARNED gold or silver finish always shows over a
    // bought one, so a store look can never pass for a ladder finish.
    const cos = data.cosmetics || {};
    const skin = tier === "base" && cos.finish ? ` tc-skin-${cos.finish.replace(/^finish-/, "")}` : "";
    const card = el("button", `tc tc-${tier}${skin}`);
    card.type = "button";
    card.setAttribute("aria-pressed", "false");
    card.title = "Turn the card over";
    const flip = el("div", "tc-flip");

    // ---- front
    const front = el("div", "tc-face tc-front");
    const fi = el("div", "tc-inner");
    const series = el("div", "tc-series");
    series.append(el("span", null, `EastCoin \u00b7 ${data.season?.name || "Season"}`), el("span", "tc-tier", tier));
    fi.append(series);

    if (k.rank) {
      const rank = el("div", "tc-rank");
      rank.append(el("b", null, String(k.rank)), el("small", null, `of ${k.players}`));
      fi.append(rank);
    }

    const shot = el("div", "tc-shot");
    shot.append(avatar(u, "tc-photo"));
    fi.append(shot);

    const plate = el("div", "tc-plate");
    plate.append(el("b", `tc-name${cos.name ? " nm-" + cos.name.replace(/^name-/, "") : ""}`, u.displayName));
    const pos = el("span", "tc-pos");
    // A gifted title can wear its club's crest where the pip goes.
    let mark = el("i", "tc-pip");
    if (cos.titleCrest) {
      mark = teamCrest(cos.titleCrest, "tc-crest");
      // Decoration on this line: the crest box holds the abbreviation as
      // its fallback, and a reader would otherwise say "DOD" mid-title.
      mark.setAttribute("aria-hidden", "true");
      mark.title = cos.titleCrest.name;
    }
    pos.append(mark, document.createTextNode(cos.title || billing(data)));
    plate.append(pos);
    const line = el("div", "tc-line");
    const cell = (label, value, tone) => {
      const d = el("div");
      d.append(el("span", null, label), el("b", tone ? tone : null, value));
      return d;
    };
    line.append(
      cell("Record", `${k.wins}\u2013${k.losses}`),
      cell("Profit", `${k.profit > 0 ? "+" : k.profit < 0 ? "\u2212" : ""}${Math.abs(k.profit).toLocaleString()}`, k.profit > 0 ? "up" : k.profit < 0 ? "down" : ""),
      cell("Staked", k.staked.toLocaleString())
    );
    plate.append(line);
    fi.append(plate);
    front.append(fi);

    // ---- back: the league table, the way a real card back reads
    const back = el("div", "tc-face tc-back");
    const bi = el("div", "tc-binner");
    const bh = el("div", "tc-bhead");
    bh.append(avatar(u, "tc-bav"));
    const who = el("div");
    who.append(el("b", null, u.displayName), el("small", null, `@${u.login}${u.since ? " \u00b7 since " + when(u.since, { month: "short", year: "numeric" }) : ""}`));
    bh.append(who);
    if (k.rank) bh.append(el("span", "tc-no", `#${String(k.rank).padStart(2, "0")}`));
    bi.append(bh);

    const rows = Object.entries(k.records || {})
      .map(([lg, r]) => ({ lg, ...r }))
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))
      .slice(0, 6);
    if (rows.length) {
      bi.append(el("div", "tc-btitle", `By league \u00b7 ${data.season?.name || ""}`.trim()));
      const table = el("table");
      const thead = el("thead");
      const hr = el("tr");
      for (const [h, cls] of [["Lg", ""], ["W", ""], ["L", ""], ["Profit", ""]]) hr.append(el("th", cls, h));
      thead.append(hr);
      table.append(thead);
      const tbody = el("tbody");
      for (const r of rows) {
        const tr = el("tr");
        tr.append(el("td", null, LEAGUE_NAME[r.lg] || r.lg), el("td", null, String(r.wins)), el("td", null, String(r.losses)),
          el("td", r.profit > 0 ? "up" : r.profit < 0 ? "down" : null, `${r.profit > 0 ? "+" : r.profit < 0 ? "\u2212" : ""}${Math.abs(r.profit).toLocaleString()}`));
        tbody.append(tr);
      }
      const tot = el("tr", "tot");
      tot.append(el("td", null, "Total"), el("td", null, String(k.wins)), el("td", null, String(k.losses)),
        el("td", k.profit > 0 ? "up" : k.profit < 0 ? "down" : null, `${k.profit > 0 ? "+" : k.profit < 0 ? "\u2212" : ""}${Math.abs(k.profit).toLocaleString()}`));
      tbody.append(tot);
      table.append(tbody);
      bi.append(table);
    } else {
      bi.append(el("p", "tc-empty", "No settled picks yet. The table fills in as they land."));
    }

    if ((data.badges || []).length) {
      bi.append(el("div", "tc-btitle", "Honours"));
      const chips = el("div", "tc-chips");
      for (const b of data.badges.slice(0, 5)) chips.append(el("span", "tc-chip", `${b.emoji} ${String(b.label).split("\u2014")[0].trim()}`));
      bi.append(chips);
    }

    const fine = [];
    if (data.casino?.total) fine.push(`Casino ${data.casino.wins}\u2013${data.casino.losses}, net ${data.casino.net > 0 ? "+" : ""}${data.casino.net.toLocaleString()}.`);
    if (k.streak?.bestWin) fine.push(`Best run ${k.streak.bestWin}.`);
    fine.push("EastCoin Picks.");
    bi.append(el("p", "tc-fine", fine.join(" ")));
    back.append(bi);

    flip.append(front, back);
    card.append(flip);
    card.addEventListener("click", () => {
      const on = card.classList.toggle("turned");
      card.setAttribute("aria-pressed", String(on));
    });
    return card;
  }

  /* ---------------------------------------------------------- stat lines

     The Overview reads like a player page on a sports site: a season
     stat bar, then splits by league and by casino game with a TOTAL
     row. Every figure is already in /api/picks/profile — the only
     thing added for it was staked per league. */

  const pct3 = (made, all) => (all ? (made / all).toFixed(3).replace(/^0\./, ".") : "—");
  const plusMinus = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Math.round(Number(n) || 0)).toLocaleString()}`;
  const roiOf = (profit, staked) => (staked ? `${profit > 0 ? "+" : profit < 0 ? "−" : ""}${Math.abs((100 * profit) / staked).toFixed(1)}%` : "—");
  const tone = (n) => (n > 0 ? "up" : n < 0 ? "down" : "");

  /**
   * The header's stat band: the season at a glance, value over label,
   * across the foot of the header card. Six figures and no more —
   * it is the summary, and the splits below are the detail. Every
   * number here is the headline of something the page shows in full
   * further down, which is why the cells are not links.
   */
  function statBand(data) {
    const k = data.picks;
    const c = data.casino;
    const band = el("div", "pf-band");
    band.append(el("h2", null, `${data.season?.name || "Season"} at a glance`));
    const row = el("div", "pf-band-row");
    const cell = (value, label, { suffix, cls, note } = {}) => {
      const box = el("div", "pf-bandcell");
      const b = el("b", cls ? `nums ${cls}` : "nums", value);
      if (suffix) b.append(el("i", null, suffix));
      box.append(b, el("span", null, label));
      if (note) box.title = note;
      row.append(box);
    };
    const settledAll = k.wins + k.losses;
    cell(k.rank ? `#${k.rank}` : "—", "Rank", { suffix: k.rank ? `/${k.players}` : "", cls: k.rank === 1 ? "gold" : "" });
    cell(`${k.wins}–${k.losses}`, "Record", { note: k.open ? `${k.open} still open` : `${k.total} picks this season` });
    cell(pct3(k.wins, settledAll), "Win %", { note: `${settledAll} settled` });
    cell(plusMinus(k.profit), "Picks", { cls: tone(k.profit), note: `${k.staked.toLocaleString()} staked` });
    if (c?.total) cell(plusMinus(c.net), "Casino", { cls: tone(c.net), note: `${c.total} plays` });
    cell(k.streak.current > 0 ? `W${k.streak.current}` : k.streak.current < 0 ? `L${Math.abs(k.streak.current)}` : "—", "Streak",
      { cls: tone(k.streak.current), note: k.streak.bestWin ? `best run W${k.streak.bestWin}` : "" });
    band.append(row);
    return band;
  }

  /**
   * The season's net as a sparkline, under the identity: the shape of
   * it, which no single figure carries. The Overview keeps the full
   * chart with its axes, tooltip and balance toggle — this is the
   * trend line a player page runs under the name, and it is what
   * fills the column beside a card three times the height of a name.
   */
  function trendBlock(b) {
    const pts = (b?.points || [])
      .map((p) => ({ t: new Date(p.t).getTime(), v: Number(p.net) }))
      .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
    if (pts.length < 3) return null;
    const last = pts[pts.length - 1].v;
    const cls = tone(last);
    const box = el("div", "pf-trend");
    const head = el("div", "pf-trend-head");
    // The figure wears the coin, like every other money number here.
    const figure = el("b", cls);
    figure.append(zc(last, { sign: true }));
    head.append(el("span", null, `Net since ${when(b.first, { month: "short", day: "numeric" })}`), figure);
    box.append(head);

    const W = 600, H = 78, PAD = 5;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "pf-spark", role: "img", "aria-label": `Net ZCoins over the season, ending ${plusMinus(last)}` });
    const t0 = pts[0].t;
    const t1 = pts[pts.length - 1].t || t0 + 1;
    const vs = pts.map((p) => p.v);
    const lo = Math.min(0, ...vs);
    const hi = Math.max(0, ...vs);
    const x = (t) => ((t - t0) / Math.max(1, t1 - t0)) * W;
    const y = (v) => H - PAD - ((v - lo) / Math.max(1, hi - lo)) * (H - PAD * 2);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
    // The area closes on the zero line, so a losing season fills downward.
    const zero = y(0);
    svg.append(
      svgEl("path", { class: `fill ${cls}`, d: `${line} L${W} ${zero.toFixed(1)} L0 ${zero.toFixed(1)} Z` }),
      svgEl("line", { class: "zero", x1: 0, x2: W, y1: zero.toFixed(1), y2: zero.toFixed(1) }),
      svgEl("path", { class: `line ${cls}`, d: line })
    );
    box.append(svg);
    return box;
  }

  /**
   * The last ten picks as a form guide, newest first — W, L, or a dot
   * for one still open. Nothing else on the page says how the season
   * has been going lately rather than overall.
   */
  function formStrip(recent) {
    const picks = (recent || []).filter((p) => p.status !== "REFUNDED").slice(0, 10);
    if (!picks.length) return null;
    const box = el("div", "pf-form");
    box.append(el("span", "pf-form-k", "Form"));
    const row = el("div", "pf-form-row");
    for (const p of picks) {
      const key = p.status === "WON" ? "w" : p.status === "LOST" ? "l" : "o";
      const pip = el("span", `pf-pip ${key}`, key === "w" ? "W" : key === "l" ? "L" : "·");
      pip.title = `${p.team} vs ${p.opponent} · ${p.status === "ACTIVE" ? "open" : plusMinus(p.profit)}`;
      row.append(pip);
    }
    box.append(row, el("small", null, "newest first"));
    return box;
  }

  /** cols: header strings. rows/total: arrays of [value, className]. */
  function statTable(cols, rows, total) {
    const wrap = el("div", "pfs-tablewrap");
    const table = el("table", "pfs-table");
    const head = el("tr");
    cols.forEach((c, i) => head.append(el("th", i ? "n" : null, c)));
    const thead = el("thead");
    thead.append(head);
    table.append(thead);
    const body = el("tbody");
    const line = (cells, cls) => {
      const tr = el("tr", cls);
      cells.forEach(([value, extra], i) => tr.append(el("td", i ? `n${extra ? " " + extra : ""}` : null, value)));
      return tr;
    };
    for (const r of rows) body.append(line(r));
    if (total) body.append(line(total, "tot"));
    table.append(body);
    wrap.append(table);
    return wrap;
  }

  function seasonStats(data) {
    const k = data.picks;
    const c = data.casino;
    const box = el("section", "pf-section pfs");
    const head = el("div", "pfs-head");
    head.append(el("h2", null, `${data.season?.name || "Season"} splits`));
    if (k.open) head.append(el("span", "pfs-open", `${k.open} open`));
    box.append(head);
    /* No stat bar here any more: it was the header band's ten figures
       over again, one screen apart. The tables' TOTAL rows carry the
       season line, so the summary is said once at the top and the
       detail once here. */

    const settled = k.wins + k.losses;

    const leagues = Object.entries(k.records || {})
      .map(([lg, r]) => ({ lg, staked: 0, ...r }))
      .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));
    if (leagues.length) {
      box.append(el("h3", "pfs-sub", "Splits by league"));
      box.append(statTable(
        ["LG", "GP", "W", "L", "PCT", "STAKED", "PROFIT", "ROI"],
        leagues.map((r) => [
          [LEAGUE_NAME[r.lg] || r.lg],
          [String(r.wins + r.losses)],
          [String(r.wins)],
          [String(r.losses)],
          [pct3(r.wins, r.wins + r.losses)],
          [r.staked.toLocaleString()],
          [plusMinus(r.profit), tone(r.profit)],
          [roiOf(r.profit, r.staked), tone(r.profit)]
        ]),
        [
          ["Total"], [String(settled)], [String(k.wins)], [String(k.losses)], [pct3(k.wins, settled)],
          [k.staked.toLocaleString()], [plusMinus(k.profit), tone(k.profit)], [roiOf(k.profit, k.staked), tone(k.profit)]
        ]
      ));
    }

    if (c?.total) {
      box.append(el("h3", "pfs-sub", "Casino by game"));
      const games = Object.entries(c.games || {})
        .map(([game, g]) => ({ game, ...g }))
        .sort((a, b) => b.plays - a.plays);
      box.append(statTable(
        ["GAME", "GP", "W", "L", "PCT", "STAKED", "NET", "ROI"],
        games.map((g) => [
          [`${GAME_ICON[g.game] || "🎰"} ${GAME_NAME[g.game] || g.game}`],
          [String(g.plays)],
          [String(g.wins)],
          [String(g.losses)],
          [pct3(g.wins, g.plays)],
          [Number(g.staked || 0).toLocaleString()],
          [plusMinus(g.net), tone(g.net)],
          [roiOf(g.net, g.staked || 0), tone(g.net)]
        ]),
        [
          ["Total"], [String(c.total)], [String(c.wins)], [String(c.losses)], [pct3(c.wins, c.total)],
          [c.staked.toLocaleString()], [plusMinus(c.net), tone(c.net)], [roiOf(c.net, c.staked), tone(c.net)]
        ]
      ));
    }
    return box;
  }

  function page(data, music) {
    const u = data.user;
    const k = data.picks;
    const c = data.casino;
    // Store cosmetics they have switched on (null for most people).
    const look = data.cosmetics || {};
    const wrap = el("section", `profile${look.background ? ` pbg pbg-${look.background.replace(/^background-/, "")}` : ""}`);
    wrap.append(profileNav(data));

    // ---- the header card
    const head = el("div", `pf-card pf-head has-tcard${look.banner ? ` pf-banner pf-banner-${look.banner.replace(/^banner-/, "")}` : ""}`);
    // The card sits in a case, like a graded card, with its own label.
    const cardCase = el("div", "tc-case");
    const label = el("div", `tc-case-label${look.label ? " foil" : ""}`);
    label.append(el("i", null, "◆"), el("span", null, "EastCoin Trading Card"), el("i", null, "◆"));
    const card = tradingCard(data);
    cardCase.append(label, card);
    head.append(cardCase);
    const copy = el("div", "pf-copy");
    const name = el("h1");
    // The name is its own span so a bought name colour never tints the badges beside it.
    name.append(nameSpan(u.displayName, look));
    const badges = el("span", "pf-badges");
    for (const b of data.badges || []) {
      const pill = el("span", `pf-badge ${b.key}`, `${b.emoji} ${String(b.label).split("—")[0].trim()}`);
      pill.title = b.label;
      badges.append(pill);
    }
    name.append(badges);
    copy.append(name);
    copy.append(el("p", null, `@${u.login}${u.since ? " · with EastCoin since " + when(u.since, { month: "short", year: "numeric" }) : ""}`));
    if (look.message) copy.append(el("p", "pf-msg", look.message));
    copy.append(teamChip(u, look));
    if (look.player) copy.append(playerChip(look.player));
    // The form guide is the one thing here that is nowhere else on the
    // page, and it is what fills the column beside a tall card.
    const form = formStrip(k.recent);
    if (form) copy.append(form);
    const trend = trendBlock(data.bankroll);
    if (trend) copy.append(trend);
    head.append(copy);

    head.append(statBand(data));
    wrap.append(head);

    // ---- the tabs
    const bar = el("nav", "pf-tabs");
    bar.setAttribute("aria-label", "Profile sections");
    const panels = {};
    const counts = { picks: k.total, casino: c?.total || 0, music: music?.requests || 0, movies: data.movies?.total || 0 };
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
    if (k.total || c?.total) ov.append(seasonStats(data));
    if (data.bankroll?.points?.length > 1) ov.append(bankrollSection(data.bankroll));
    if (k.biggestWin || k.worstBeat) {
      const hls = el("div", "gp-hls");
      if (k.biggestWin) hls.append(highlight("good", "Biggest win", k.biggestWin, `+${k.biggestWin.profit}`, `${k.biggestWin.team} ${formatLine(k.biggestWin.line)} · ${k.biggestWin.wager} staked`));
      if (k.worstBeat) hls.append(highlight("bad", "Worst beat", k.worstBeat, `−${k.worstBeat.wager}`, `${k.worstBeat.team} ${formatLine(k.worstBeat.line)} vs ${k.worstBeat.opponent}`));
      ov.append(hls);
    }
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
      stat("Best run", k.streak.bestWin ? `${k.streak.bestWin} straight` : "—", k.streak.worstLoss ? `worst: ${k.streak.worstLoss} in a row` : ""),
      stat("Right now", k.streak.current > 0 ? `W${k.streak.current}` : k.streak.current < 0 ? `L${Math.abs(k.streak.current)}` : "—",
        k.streak.current > 0 ? "on a run" : k.streak.current < 0 ? "on a slide" : "nothing settled yet", k.streak.current > 0 ? "up" : k.streak.current < 0 ? "down" : "")
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

    // ---- Movies: their tomato scores from Movies & TV
    const mv = panels.movies;
    const m = data.movies;
    mv.append(sectionHead("Movies & TV", m ? `${m.total} rated` : ""));
    if (!m) {
      const note = emptyNote("No scores yet", "Movies and shows they rate out of five tomatoes in Movies & TV show here.");
      if (isMine(u)) note.append(link("/?view=screen", "gp-back", "Rate something →"));
      mv.append(note);
    } else {
      const freshPct = Math.round(100 * m.fresh / m.total);
      const mstrip = el("div", "summarystrip four");
      mstrip.append(
        stat("Rated", String(m.total), `movie${m.total === 1 ? "" : "s"} and shows`),
        stat("Average", `${m.avg} / 5`, tomatoes(Math.round(m.avg))),
        stat("Fresh", `${freshPct}%`, `${m.fresh} fresh · ${m.rotten} rotten`),
        stat("Latest", m.recent[0].title, `${m.recent[0].score} / 5`)
      );
      mv.append(mstrip);
      const grid = el("div", "sc-grid pf-movies");
      for (const r of m.recent) grid.append(movieCard(r));
      mv.append(el("h3", "pf-sub", m.total > m.recent.length ? `Latest ${m.recent.length} of ${m.total}` : "Every score, newest first"), grid);
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

  function profileNav(data = null) {
    const nav = el("nav", "pf-nav");
    nav.setAttribute("aria-label", "Profile links");
    nav.append(
      link("/?view=users", "pf-nav-link", "All Users"),
      link("/?view=picks", "pf-nav-link", "← Back to Picks")
    );
    // Once EastCoin Wrapped has dropped, every profile links to its season.
    if (data?.wrappedOpen && data.user?.login) nav.append(link(`/wrapped/${encodeURIComponent(data.user.login)}`, "pf-nav-link", "🎁 Wrapped"));
    // Only on your own page: the way into the store's looks. It sits
    // with the other page links rather than in the identity block —
    // it is navigation, not something the profile says about them.
    if (data?.user && isMine(data.user)) {
      const custom = link("/?view=store", "pf-nav-link pf-customize");
      custom.append(document.createTextNode("🎨 Customize my profile"), el("span", "nav-tag", "NEW"));
      nav.append(custom);
    }
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

  /* ---------------------------------------------------------- store looks */

  /** The profile name, wearing a bought colour and effect. data-text feeds the effects' overlays. */
  function nameSpan(text, look = {}) {
    const cls = ["pf-name"];
    if (look.name) cls.push("nm-" + look.name.replace(/^name-/, ""));
    if (look.namefx) cls.push("nf-" + look.namefx.replace(/^namefx-/, ""));
    const span = el("span", cls.join(" "), text);
    span.dataset.text = text;
    return span;
  }

  /** A favourite player from the store: ESPN headshot, name, position and team. */
  function playerChip(p) {
    const chip = el("div", "pf-player");
    const shot = el("span", "pf-player-shot", String(p.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2));
    if (p.headshot) {
      const img = document.createElement("img");
      img.alt = ""; img.decoding = "async"; img.loading = "lazy";
      img.addEventListener("load", () => shot.classList.add("has-logo"));
      img.addEventListener("error", () => img.remove());
      img.src = p.headshot;
      shot.append(img);
    }
    const copy = el("div");
    copy.append(el("b", null, p.name), el("small", null, [p.position, p.team].filter(Boolean).join(" · ") + " · favourite player"));
    chip.append(shot, copy);
    return chip;
  }

  function teamChip(u, look = {}) {
    const wrap = el("div", "pf-teamwrap");
    const mine = isMine(u);
    const fav = u.favourite;
    if (!fav && !mine) return wrap;

    const row = el("div", `pf-team${fav && look.team ? " tfx-" + look.team.replace(/^team-/, "") : ""}`);
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
    } else if (href.startsWith("/?view=store")) {
      event.preventDefault();
      history.pushState({ view: "store" }, "", href);
      shell.go("store", { push: false });
    } else if (href.startsWith("/wrapped/")) {
      event.preventDefault();
      history.pushState({ view: "wrapped" }, "", href);
      shell.go("wrapped", { push: false });
    } else if (href.startsWith("/?view=screen")) {
      event.preventDefault();
      history.pushState({ view: "screen" }, "", href);
      shell.go("screen", { push: false });
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

  // The store draws its preview with this same card, so what someone
  // tries on there is exactly what their profile will show.
  window.ECProfileCard = { tradingCard, tierOf, nameSpan, playerChip };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("profile", view);
  }
  boot();
})();
