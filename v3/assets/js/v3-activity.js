/* ============================================================
   EastCoin V3 — Activity

   What just happened, newest first: picks locked and settled,
   markets opening and finals, new faces, songs played. One list,
   refreshed every 30 seconds. Every name goes to a profile, every
   game to its page. Not in the nav yet; /?view=activity.
   ============================================================ */
(() => {
  "use strict";

  let root = null;
  let shell = null;
  let token = 0;
  let timer = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function sk(w, h, cls) {
    const b = el("span", `sk${cls ? " " + cls : ""}`);
    b.style.width = typeof w === "number" ? `${w}px` : w;
    b.style.height = `${h}px`;
    return b;
  }

  const line = (v) => { const n = Number(v); return !Number.isFinite(n) || n === 0 ? "—" : n > 0 ? `+${n}` : `−${Math.abs(n)}`; };
  const nick = (name) => (window.ECLogos ? window.ECLogos.nickname(name) : String(name || "").split(" ").pop().toLowerCase())
    .replace(/\b\w/g, (c) => c.toUpperCase());

  function coin(n, sign) {
    const wrap = el("span", `zc-amount nums${n > 0 ? " up" : n < 0 ? " down" : ""}`);
    const img = document.createElement("img");
    img.className = "zcoin-mark";
    img.src = "/v3/assets/img/zcoin.webp";
    img.alt = "";
    img.width = 14;
    img.height = 14;
    wrap.append(img, document.createTextNode(`${sign && n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(Number(n) || 0).toLocaleString()}`));
    return wrap;
  }

  function ago(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return "just now";
    const m = Math.floor(ms / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? "yesterday" : `${d}d ago`;
  }

  function avatar(u) {
    const box = el("span", "av-av", String(u?.displayName || u?.login || "?").slice(0, 1).toUpperCase());
    if (u?.avatar) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("load", () => box.classList.add("has-logo"));
      img.addEventListener("error", () => img.remove());
      img.src = u.avatar;
      box.append(img);
    }
    return box;
  }

  function name(u) {
    const wrap = el("span", "namewrap");
    const a = el("a", "ulink", u?.displayName || u?.login || "someone");
    a.href = `/u/${encodeURIComponent(String(u?.login || "").toLowerCase())}`;
    wrap.append(a);
    window.ECBadges?.decorate(wrap, u?.login);
    return wrap;
  }

  function gameLink(market, text) {
    const a = el("a", "glink", text != null ? text : `${nick(market.away)} at ${nick(market.home)}`);
    a.href = `/g/${market.slug}`;
    return a;
  }

  function crest(market, teamName) {
    return window.ECLogos
      ? window.ECLogos.crest(market.sport, market.league, teamName, "av-crest")
      : el("span", "av-crest", String(teamName || "?").slice(0, 3).toUpperCase());
  }

  const ICON = { pick: "🪙", won: "✅", lost: "❌", refunded: "↩️", open: "🏟️", final: "🏁", void: "🚫", joined: "👋", song: "🎵", casino: "🎰", score: "📊" };
  /** "Rangers up 3–1 on the Mariners", "Rangers and Mariners level at 2". */
  function scoreLine(item) {
    const m = item.market;
    const a = Number(item.awayScore), h = Number(item.homeScore);
    if (a === h) return `${nick(m.away)} and ${nick(m.home)} level at ${a}`;
    return a > h ? `${nick(m.away)} up ${a}–${h} on the ${nick(m.home)}` : `${nick(m.home)} up ${h}–${a} on the ${nick(m.away)}`;
  }
  const CASINO_ICON = { flip: "🪙", wheel: "🎡", race: "🐎", hilo: "🃏", mines: "💣", plinko: "🎯" };
  function casinoLink(item) {
    const a = el("a", "glink", item.gameName);
    a.href = `/?view=${item.game}`;
    return a;
  }

  function row(item) {
    const r = el("article", `av-row ${item.type}`);
    const lead = el("span", "av-lead");
    if (item.type === "casino") lead.append(el("span", `av-av ghost ${item.status === "WON" ? "good" : "bad"}`, CASINO_ICON[item.game] || "🎰"));
    else if (item.who && item.type !== "song") lead.append(avatar(item.who));
    else if (item.market && (item.type === "open" || item.type === "final" || item.type === "void")) lead.append(crest(item.market, item.winner || item.market.home));
    else lead.append(el("span", "av-av ghost", ICON[item.type] || "·"));
    r.append(lead);

    const body = el("div", "av-body");
    const text = el("p", "av-text");
    const meta = el("small", "av-meta");
    const m = item.market;

    switch (item.type) {
      case "pick":
        text.append(name(item.who), document.createTextNode(" backed "), el("b", null, `${nick(item.team)} ${line(item.line)}`),
          document.createTextNode(" for "), coin(item.wager), document.createTextNode(" · "), gameLink(m));
        meta.append(document.createTextNode(`${m.league || ""} · `), gameLink(m, `${nick(item.team)} vs ${nick(item.opponent)}`));
        break;
      case "won":
        text.append(name(item.who), document.createTextNode(" cashed "), el("b", null, `${nick(item.team)} ${line(item.line)}`),
          document.createTextNode(" · "), coin(item.wager), document.createTextNode(" → "), coin(item.profit, true));
        meta.append(gameLink(m));
        break;
      case "lost":
        text.append(name(item.who), document.createTextNode(" lost "), coin(item.wager), document.createTextNode(" on "),
          el("b", null, `${nick(item.team)} ${line(item.line)}`));
        meta.append(gameLink(m));
        break;
      case "refunded":
        text.append(name(item.who), document.createTextNode(" got "), coin(item.wager), document.createTextNode(" back — "), gameLink(m), document.createTextNode(" was voided"));
        break;
      case "open":
        text.append(el("b", null, "Picks open"), document.createTextNode(" · "),
          gameLink(m, `${nick(m.away)} ${line(m.awayLine)} at ${nick(m.home)} ${line(m.homeLine)}`));
        meta.textContent = `${m.league || ""} · first pitch ${new Date(m.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
        break;
      case "final": {
        const score = Number.isFinite(Number(item.awayScore)) && Number.isFinite(Number(item.homeScore)) && item.awayScore !== null
          ? ` ${item.awayScore}–${item.homeScore}` : "";
        text.append(el("b", null, "Final"), document.createTextNode(" · "), gameLink(m, `${nick(m.away)} at ${nick(m.home)}${score}`),
          document.createTextNode(item.winner ? ` · ${nick(item.winner)} win` : ""));
        meta.textContent = `${m.league || ""} · settled, picks paid`;
        break;
      }
      case "void":
        text.append(el("b", null, "Voided"), document.createTextNode(" · "), gameLink(m), document.createTextNode(" · every stake refunded"));
        break;
      case "joined":
        text.append(name(item.who), document.createTextNode(" joined EastCoin"));
        meta.textContent = "New face — say hi in chat";
        break;
      case "song":
        text.append(name(item.who), document.createTextNode(" played "), el("b", null, item.title));
        meta.textContent = "Green Room";
        break;
      case "casino":
        text.append(name(item.who), document.createTextNode(item.status === "WON" ? " won " : " lost "), coin(Math.abs(item.profit)),
          document.createTextNode(" on the "), casinoLink(item));
        meta.textContent = `${CASINO_ICON[item.game] || "🎰"} ${item.pick} · ${item.wager} ZC staked`;
        break;
      case "score": {
        const m = item.market;
        text.append(el("b", null, item.live ? "Live" : "Score"), document.createTextNode(" · "), gameLink(m, scoreLine(item)));
        meta.textContent = `${m.league || ""} · ${nick(m.away)} at ${nick(m.home)}`;
        break;
      }
      default:
        text.textContent = item.type;
    }
    body.append(text);
    if (meta.childNodes.length) body.append(meta);
    r.append(body);

    const when = el("time", "av-when", ago(item.at));
    when.dateTime = item.at;
    when.title = new Date(item.at).toLocaleString();
    r.append(when);
    return r;
  }

  function head(count) {
    const wrap = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "Activity"));
    copy.append(el("p", null, count == null ? "What just happened across EastCoin." : `Picks, finals, new faces and songs — refreshes on its own.`));
    wrap.append(copy);
    return wrap;
  }

  function skeleton(n) {
    const list = el("div", "av-list");
    list.setAttribute("aria-busy", "true");
    for (let i = 0; i < n; i += 1) {
      const r = el("article", "av-row is-sk");
      const body = el("div", "av-body sk-lines");
      body.append(sk(200 + (i % 3) * 60, 11), sk(120, 8));
      r.append(sk(34, 34, "circle"), body, sk(44, 9));
      list.append(r);
    }
    return list;
  }

  async function load(first) {
    const mine = ++token;
    if (first) root.replaceChildren(head(null), skeleton(8));
    let payload = null;
    try { payload = await fetch("/api/picks/activity", { credentials: "include" }).then((r) => r.json()); } catch { payload = null; }
    if (mine !== token || !root.isConnected) return;
    if (!payload?.ok) {
      if (first) {
        const note = el("div", "empty");
        note.append(el("strong", null, "Couldn't load the feed"), el("p", null, "Try again in a moment."));
        root.replaceChildren(head(null), note);
      }
      return;
    }
    const list = el("div", "av-list");
    for (const item of payload.items) list.append(row(item));
    if (!payload.items.length) {
      const note = el("div", "empty");
      note.append(el("strong", null, "Quiet for now"), el("p", null, "The first pick, final or song lands here."));
      list.append(note);
    }
    root.replaceChildren(head(payload.items.length), list);
  }

  /* ---------------------------------------------------------- ticker

     The same feed as one scrolling line for the home page: short
     phrases, newest first, looping. Pauses under the pointer, and
     reads as a plain scrolling row for anyone who prefers reduced
     motion. Refreshes every 60 seconds while the row is on screen. */

  function shortItem(item) {
    const m = item.market;
    const span = el("span", `tk-item ${item.type}`);
    span.append(el("span", "tk-ico", ICON[item.type] || "·"));
    const who = () => { const a = el("a", "ulink", item.who?.displayName || item.who?.login || "someone"); a.href = `/u/${encodeURIComponent(String(item.who?.login || "").toLowerCase())}`; return a; };
    const game = (text) => { const a = el("a", "glink", text); a.href = `/g/${m.slug}`; return a; };
    switch (item.type) {
      case "pick": span.append(who(), document.createTextNode(" backed "), game(`${nick(item.team)} ${line(item.line)}`), document.createTextNode(` for ${item.wager} ZC`)); break;
      case "won": span.append(who(), document.createTextNode(" cashed "), game(`${nick(item.team)} ${line(item.line)}`), document.createTextNode(` +${item.profit} ZC`)); break;
      case "lost": span.append(who(), document.createTextNode(` lost ${item.wager} ZC on `), game(nick(item.team))); break;
      case "refunded": span.append(who(), document.createTextNode(" refunded on "), game(nick(item.team))); break;
      case "open": span.append(document.createTextNode("Picks open · "), game(`${nick(m.away)} ${line(m.awayLine)} at ${nick(m.home)} ${line(m.homeLine)}`)); break;
      case "final": {
        const score = item.awayScore !== null && item.homeScore !== null && Number.isFinite(Number(item.awayScore)) ? ` ${item.awayScore}–${item.homeScore}` : "";
        span.append(document.createTextNode("Final · "), game(`${nick(m.away)} at ${nick(m.home)}${score}`));
        break;
      }
      case "void": span.append(document.createTextNode("Voided · "), game(`${nick(m.away)} at ${nick(m.home)}`)); break;
      case "joined": span.append(who(), document.createTextNode(" joined")); break;
      case "song": span.append(who(), document.createTextNode(" played "), el("b", null, item.title.length > 40 ? item.title.slice(0, 38) + "…" : item.title)); break;
      case "casino": span.append(who(), document.createTextNode(item.status === "WON" ? ` won ${Math.abs(item.profit)} ZC on the ` : ` lost ${Math.abs(item.profit)} ZC on the `), casinoLink(item)); break;
      case "score": return null;   // scores stay in the feed and on game pages; off the ticker for now
      default: return null;
    }
    span.append(el("span", "tk-ago", ago(item.at)));
    return span;
  }

  let tickerTimer = 0;
  async function mountTicker(container, { limit = 30 } = {}) {
    window.clearInterval(tickerTimer);
    container.classList.add("ticker");
    container.setAttribute("aria-label", "Latest activity");
    const label = el("a", "tk-label", "LIVE");
    label.href = "/?view=activity";
    label.title = "See all activity";
    const viewport = el("div", "tk-viewport");
    const track = el("div", "tk-track");
    viewport.append(track);
    container.replaceChildren(label, viewport);

    const fill = async () => {
      if (!container.isConnected) { window.clearInterval(tickerTimer); return; }
      let payload = null;
      try { payload = await fetch("/api/picks/activity", { credentials: "include" }).then((r) => r.json()); } catch { payload = null; }
      if (!container.isConnected) return;
      const items = (payload?.items || []).slice(0, limit).map(shortItem).filter(Boolean);
      track.replaceChildren();
      if (!items.length) { track.append(el("span", "tk-item", "Quiet for now — the first pick lands here.")); container.classList.add("still"); return; }
      // Two copies of the row make the loop seamless: when the first
      // scrolls off, the second is exactly where the first began.
      const rowA = el("div", "tk-row");
      for (const it of items) rowA.append(it);
      const rowB = rowA.cloneNode(true);
      rowB.setAttribute("aria-hidden", "true");
      track.append(rowA, rowB);
      // Speed is constant in pixels per second, so a longer row simply
      // takes longer to pass rather than racing by.
      const width = rowA.scrollWidth;
      container.classList.toggle("still", width <= viewport.clientWidth);
      track.style.setProperty("--tk-duration", `${Math.max(20, Math.round(width / 55))}s`);
    };
    await fill();
    tickerTimer = window.setInterval(() => { if (!document.hidden) fill(); }, 60 * 1000);
  }

  window.ECActivity = Object.freeze({ mountTicker });

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      document.title = "Activity — EastCoin";
      window.ECPresence?.beat("activity");
      load(true);
      window.clearInterval(timer);
      timer = window.setInterval(() => { if (root?.isConnected && !document.hidden) load(false); }, 30 * 1000);
    },
    unmount() {
      token++;
      window.clearInterval(timer);
      document.title = "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("activity", view);
  }
  boot();
})();
