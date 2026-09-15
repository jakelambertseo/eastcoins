/* ============================================================
   EastCoin Store — /?view=store (2026-09-15, members only, not in the nav)

   Cosmetics for the trading card and profile, bought with ZCoins
   (/api/store, /api/store/buy, /api/store/equip). The preview on the
   left is drawn with the profile's OWN pieces — v3-profile.js hands
   out tradingCard(), nameSpan() and playerChip() — wearing whatever
   you have on, with an item swapped in while you hover it, so what you
   see here is what your profile shows.

   The favourite player is chosen from ESPN's player search, fetched
   by the browser (ESPN refuses Cloudflare's servers); the server only
   accepts an id, league and name and builds the photo URL itself.
   ============================================================ */
(() => {
  const CSS = "/v3/assets/css/v3-store.css?v=6";
  const ESPN_SEARCH = "https://site.web.api.espn.com/apis/common/v3/search";
  const PLAYER_LEAGUES = new Set(["nfl", "mlb", "nba"]);

  let root = null;
  let token = 0;
  let searchTimer = 0;
  let searchSeq = 0;
  const S = {
    cat: null, profile: null, hover: null, hoverPlayer: null, confirm: null, busy: false, msg: null,
    titleDraft: null, messageDraft: null, playerQ: "", playerResults: [], playerNote: ""
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function btn(label, className, onClick) {
    const b = el("button", className, label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }
  function needCss() {
    if (document.getElementById("css-store")) return;
    const link = document.createElement("link");
    link.id = "css-store"; link.rel = "stylesheet"; link.href = CSS;
    document.head.append(link);
  }
  function coins(n) {
    const wrap = el("span", "st-coins nums");
    const img = document.createElement("img");
    img.src = "/v3/assets/img/zcoin.webp"; img.alt = ""; img.width = 15; img.height = 15; img.className = "zcoin-mark";
    wrap.append(img, document.createTextNode(Number(n || 0).toLocaleString()));
    return wrap;
  }
  const mine = () => S.cat?.mine || { owned: [], equipped: {}, titleText: "", messageText: "", player: null };
  const owns = (id) => mine().owned.includes(id);
  const itemOf = (id) => S.cat.items.find((i) => i.id === id);
  const suffix = (id, slot) => String(id || "").slice(slot.length + 1);

  /* ---------------------------------------------------------- preview */

  function titleFor(id, custom) {
    const it = itemOf(id);
    if (!it) return null;
    return it.id === "title-custom" ? (custom || null) : (it.text || it.name);
  }

  /** What the preview wears: what's on, with the hovered item swapped in. */
  function cosmetics() {
    const m = mine();
    const e = m.equipped;
    const c = {
      finish: e.finish, name: e.name, namefx: e.namefx, banner: e.banner, background: e.background, team: e.team, label: e.label,
      title: e.title ? titleFor(e.title, m.titleText) : null,
      message: e.message ? m.messageText || null : null,
      player: e.player ? m.player : null
    };
    const it = S.hover ? itemOf(S.hover) : null;
    if (it) {
      if (it.slot === "title") c.title = it.id === "title-custom" ? (S.titleDraft || m.titleText || "Your title here") : titleFor(it.id);
      else if (it.slot === "message") c.message = S.messageDraft || m.messageText || "Your message shows here on your profile.";
      else if (it.slot === "player") c.player = S.hoverPlayer || m.player || { name: "Your favourite player", position: "", team: "", headshot: "" };
      else c[it.slot] = it.id;
    }
    return c;
  }

  function preview() {
    const c = cosmetics();
    const p = S.profile;
    const card = window.ECProfileCard;
    const box = el("aside", `st-preview${c.background ? ` pbg pbg-${suffix(c.background, "background")}` : ""}`);

    const stage = el("div", `st-stage${c.banner ? ` pf-banner pf-banner-${suffix(c.banner, "banner")}` : ""}`);
    if (p && card?.tradingCard) {
      const cardCase = el("div", "tc-case");
      const label = el("div", `tc-case-label${c.label ? " foil" : ""}`);
      label.append(el("i", null, "◆"), el("span", null, "EastCoin Trading Card"), el("i", null, "◆"));
      cardCase.append(label, card.tradingCard({ ...p, cosmetics: c }));
      stage.append(cardCase);
    } else {
      stage.append(el("p", "st-note", "Your card preview couldn't load."));
    }
    box.append(stage);

    // A slice of the profile header: name, message, team, player.
    const mini = el("div", "st-mini");
    const displayName = p?.user?.displayName || S.cat?.login || "You";
    const h = el("p", "st-name");
    h.append(card?.nameSpan ? card.nameSpan(displayName, c) : el("span", "pf-name", displayName));
    mini.append(h);
    if (c.message) mini.append(el("p", "pf-msg", c.message));
    const fav = p?.user?.favourite;
    const team = el("div", `pf-team st-team${c.team ? " tfx-" + suffix(c.team, "team") : ""}`);
    const tcopy = el("div");
    tcopy.append(el("b", null, fav?.name || "Your favourite team"), el("small", null, fav ? `${fav.leagueLabel} · favourite team` : "pick one on your profile"));
    team.append(tcopy);
    mini.append(team);
    if (c.player && card?.playerChip) mini.append(card.playerChip(c.player));
    box.append(mini);

    const tier = p && card?.tierOf ? card.tierOf(p.picks) : "base";
    box.append(el("p", "st-note", tier !== "base"
      ? `You've earned the ${tier} finish on the Picks ladder. It shows over any bought finish.`
      : S.hover ? "Previewing. Move away to see what you have on." : "This is how everyone sees you. Hover an item to try it on."));
    return box;
  }

  function repaintPreview() {
    const old = root?.querySelector(".st-preview");
    if (old) old.replaceWith(preview());
  }

  /* ---------------------------------------------------------- actions */

  async function post(url, body) {
    S.busy = true; paint();
    let r = null;
    try {
      r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
    } catch { r = null; }
    S.busy = false;
    return r;
  }

  async function buy(item) {
    const r = await post("/api/store/buy", { item: item.id });
    S.confirm = null;
    if (r?.ok) {
      S.cat.mine = r.mine;
      if (Number.isFinite(Number(r.balance))) { S.cat.balance = Number(r.balance); window.ECV3?.setWallet?.(r.balance); }
      const setup = ["title-custom", "message-custom", "player-pick"].includes(item.id);
      const got = r.free ? "Claimed" : "Bought";
      S.msg = setup
        ? { tone: "good", text: `${got} ${item.name}. Set it up below to put it on your profile.` }
        : { tone: "good", text: `${got} ${item.name}. Effect applied!`, profileLink: true };
    } else {
      S.msg = { tone: "bad", text: r?.message || "That didn't go through. Nothing was charged." };
    }
    paint();
  }

  async function equip(item, on, extra = {}) {
    const r = await post("/api/store/equip", { slot: item.slot, item: on ? item.id : null, ...extra });
    if (r?.ok) {
      S.cat.mine = r.mine;
      S.msg = on
        ? { tone: "good", text: `${item.name} is on. Effect applied!`, profileLink: true }
        : { tone: "good", text: `${item.name} is off.` };
      if (item.slot === "title") S.titleDraft = null;
      if (item.slot === "message") S.messageDraft = null;
      if (item.slot === "player") { S.hoverPlayer = null; S.playerResults = []; S.playerQ = ""; }
    } else {
      S.msg = { tone: "bad", text: r?.message || "Couldn't change that." };
    }
    paint();
  }

  /* ---------------------------------------------------------- player search */

  function searchPlayers(q) {
    clearTimeout(searchTimer);
    S.playerQ = q;
    if (q.trim().length < 3) { S.playerResults = []; S.playerNote = q.trim() ? "Keep typing…" : ""; renderPlayerResults(); return; }
    searchTimer = setTimeout(async () => {
      const seq = ++searchSeq;
      S.playerNote = "Searching ESPN…"; renderPlayerResults();
      let items = [];
      try {
        const j = await fetch(`${ESPN_SEARCH}?query=${encodeURIComponent(q.trim())}&limit=15&type=player`).then((r) => r.json());
        items = (j.items || [])
          .filter((i) => PLAYER_LEAGUES.has(String(i.league)) && i.headshot?.href && /^\d+$/.test(String(i.id)))
          .slice(0, 8)
          .map((i) => ({
            id: String(i.id), league: String(i.league), name: String(i.displayName || "").trim(),
            team: String(i.teamRelationships?.[0]?.displayName || ""), position: String(i.position?.abbreviation || ""),
            headshot: `https://a.espncdn.com/i/headshots/${i.league}/players/full/${i.id}.png`
          }));
      } catch { items = null; }
      if (seq !== searchSeq) return;
      S.playerResults = items || [];
      S.playerNote = items === null ? "ESPN's search didn't answer. Try again." : items.length ? "" : "No NFL, MLB or NBA players with a photo match that.";
      renderPlayerResults();
    }, 350);
  }

  function renderPlayerResults() {
    const list = root?.querySelector(".st-player-results");
    if (!list) return;
    list.replaceChildren();
    if (S.playerNote) list.append(el("p", "st-note left", S.playerNote));
    const item = itemOf("player-pick");
    for (const pl of S.playerResults) {
      const b = el("button", "st-player-row");
      b.type = "button";
      const img = document.createElement("img");
      img.src = pl.headshot; img.alt = ""; img.loading = "lazy";
      img.addEventListener("error", () => img.remove());
      const copy = el("span");
      copy.append(el("b", null, pl.name), el("small", null, [pl.position, pl.team, pl.league.toUpperCase()].filter(Boolean).join(" · ")));
      b.append(img, copy);
      b.addEventListener("mouseenter", () => { S.hover = "player-pick"; S.hoverPlayer = pl; repaintPreview(); });
      b.addEventListener("click", () => equip(item, true, { player: pl }));
      list.append(b);
    }
  }

  /* ---------------------------------------------------------- shelves */

  function swatch(item, owned, on) {
    const sw = el("div", `st-swatch sw-${item.id}${item.slot === "background" ? ` pbg pbg-${suffix(item.id, "background")}` : ""}`);
    if (item.slot === "name") sw.append(el("b", `pf-name nm-${suffix(item.id, "name")}`, "Aa"));
    if (item.slot === "namefx") { const s = el("b", `pf-name nf-${suffix(item.id, "namefx")}`, "Aa"); s.dataset.text = "Aa"; sw.append(s); }
    if (item.slot === "title") sw.append(el("b", "st-sw-title", item.id === "title-custom" ? "“ ”" : item.text || item.name));
    if (item.slot === "message") sw.append(el("b", "st-sw-title", "“Hi, chat.”"));
    if (item.slot === "team") { const t = el("div", `pf-team tfx-${suffix(item.id, "team")}`); const c = el("div"); c.append(el("b", null, "Your Team")); t.append(c); sw.append(t); }
    if (item.slot === "player") sw.append(el("b", "st-sw-title", "👤"));
    if (item.slot === "label") sw.append(el("span", "tc-case-label foil", "◆ EastCoin ◆"));
    if (on) sw.append(el("span", "st-badge", "ON"));
    else if (owned) sw.append(el("span", "st-badge dim", "OWNED"));
    return sw;
  }

  function tile(item) {
    const m = mine();
    const owned = owns(item.id);
    const on = m.equipped[item.slot] === item.id;
    const wide = owned && ["title-custom", "message-custom", "player-pick"].includes(item.id);
    const t = el("article", `st-item${owned ? " owned" : ""}${on ? " on" : ""}${wide ? " wide" : ""}${item.chase ? " chase" : ""}`);
    if (item.chase) t.append(el("span", "st-ribbon", "Legendary"));
    else if (item.promo) t.append(el("span", "st-ribbon promo", item.promo));
    t.addEventListener("mouseenter", () => { S.hover = item.id; repaintPreview(); });
    t.addEventListener("mouseleave", () => { if (S.hover === item.id) { S.hover = null; S.hoverPlayer = null; repaintPreview(); } });
    t.addEventListener("focusin", () => { S.hover = item.id; repaintPreview(); });

    t.append(swatch(item, owned, on));
    const body = el("div", "st-body");
    body.append(el("h3", null, item.name), el("p", null, item.blurb));
    t.append(body);

    const foot = el("div", "st-foot");
    const balance = Number(S.cat.balance);
    if (!owned && item.price === 0) {
      // Promo: nothing to confirm, no ZCoins move.
      foot.append(el("span", "st-free", "Free"));
      const claim = btn("Claim free", "st-btn gold", () => { S.msg = null; buy(item); });
      claim.disabled = S.busy;
      foot.append(claim);
    } else if (!owned) {
      foot.append(coins(item.price));
      if (S.confirm === item.id) {
        const ask = el("div", "st-confirm");
        ask.append(el("span", null, `Buy for ${item.price.toLocaleString()}?`),
          btn("Confirm", "st-btn gold", () => buy(item)), btn("Cancel", "st-btn", () => { S.confirm = null; paint(); }));
        foot.append(ask);
      } else {
        const short = Number.isFinite(balance) && balance < item.price;
        const b = btn(short ? `Need ${(item.price - balance).toLocaleString()} more` : "Buy", `st-btn${short ? "" : " gold"}`, () => { S.confirm = item.id; S.msg = null; paint(); });
        b.disabled = S.busy || short;
        foot.append(b);
      }
    } else if (item.id === "title-custom" || item.id === "message-custom") {
      const isTitle = item.id === "title-custom";
      const form = el("div", "st-title");
      const input = el("input");
      input.type = "text"; input.id = isTitle ? "st-title-input" : "st-message-input";
      input.maxLength = isTitle ? 24 : 100;
      input.placeholder = isTitle ? "Up to 24 characters" : "Up to 100 characters — no links";
      input.value = (isTitle ? S.titleDraft ?? m.titleText : S.messageDraft ?? m.messageText) || "";
      input.addEventListener("input", () => {
        if (isTitle) S.titleDraft = input.value; else S.messageDraft = input.value;
        S.hover = item.id; repaintPreview();
      });
      const save = btn(on ? "Update" : "Put on profile", "st-btn gold", () => equip(item, true, { text: input.value }));
      save.disabled = S.busy;
      form.append(input, save);
      if (on) form.append(btn("Remove", "st-btn", () => equip(item, false)));
      foot.append(form);
    } else if (item.id === "player-pick") {
      const box = el("div", "st-player");
      if (m.player && on && window.ECProfileCard?.playerChip) {
        const cur = el("div", "st-player-current");
        cur.append(window.ECProfileCard.playerChip(m.player), btn("Remove", "st-btn", () => equip(item, false)));
        box.append(cur);
      }
      const input = el("input");
      input.type = "search"; input.id = "st-player-input"; input.autocomplete = "off";
      input.placeholder = on ? "Search to change player" : "Search NFL, MLB or NBA players";
      input.value = S.playerQ;
      input.addEventListener("input", () => searchPlayers(input.value));
      box.append(input, el("div", "st-player-results"));
      foot.append(box);
    } else {
      foot.append(el("span", "st-owned", on ? "On your profile" : "Owned"));
      const b = btn(on ? "Switch off" : "Switch on", `st-btn${on ? "" : " gold"}`, () => equip(item, !on));
      b.disabled = S.busy;
      foot.append(b);
    }
    t.append(foot);
    return t;
  }

  function paint() {
    if (!root || !S.cat) return;
    const page = el("section", "st");
    const head = el("div", "viewhead st-head");
    const copy = el("div");
    copy.append(el("h1", null, "EastCoin Store"), el("p", null, "Spend ZCoins on your trading card and profile. Everything here is cosmetic and yours to keep."));
    const wallet = el("div", "st-wallet");
    wallet.append(el("span", null, "My wallet"), coins(S.cat.balance ?? 0));
    // Plenty of people don't know where their profile lives; the store is
    // where they'll want to see what they bought.
    const side = el("div", "st-headside");
    const me = el("a", "st-profile-link ulink", "View my profile →");
    me.href = `/u/${encodeURIComponent(S.cat.login)}`;
    side.append(me, wallet);
    head.append(copy, side);
    page.append(head);

    const layout = el("div", "st-layout");
    layout.append(preview());
    const shelves = el("div", "st-shelves");
    if (S.msg) {
      const note = el("p", `st-msg ${S.msg.tone}`, S.msg.text);
      // After something goes on, send them to see it where it lives.
      if (S.msg.profileLink && S.cat.login) {
        const go = el("a", "st-msg-link ulink", "View your profile now →");
        go.href = `/u/${encodeURIComponent(S.cat.login)}`;
        note.append(" ", go);
      }
      shelves.append(note);
    }
    for (const [slot, label] of Object.entries(S.cat.slots)) {
      const items = S.cat.items.filter((i) => i.slot === slot);
      if (!items.length) continue;
      const sec = el("section", "st-shelf");
      const h = el("h2", null, label);
      if (slot === "finish") h.append(el("small", null, "earned gold and silver always show first"));
      if (slot === "title") h.append(el("small", null, "one at a time, under your name on the card"));
      sec.append(h);
      const grid = el("div", "st-grid");
      for (const it of items) grid.append(tile(it));
      sec.append(grid);
      shelves.append(sec);
    }
    layout.append(shelves);
    page.append(layout);

    const focusId = document.activeElement?.id;
    const caret = document.activeElement?.selectionStart;
    root.replaceChildren(page);
    if (focusId) {
      const f = document.getElementById(focusId);
      if (f) { f.focus(); try { if (caret != null) f.setSelectionRange(caret, caret); } catch { /* search inputs */ } }
    }
    renderPlayerResults();
  }

  async function load() {
    const mineTok = ++token;
    root.replaceChildren(el("div", "view-loading"));
    const cat = await fetch("/api/store", { credentials: "include" }).then((r) => r.json()).catch(() => null);
    if (mineTok !== token || !root) return;
    if (!cat?.ok) {
      const box = el("section", "st");
      box.append(el("p", "st-msg bad", cat?.message || "The store didn't load. Try again in a moment."));
      root.replaceChildren(box);
      return;
    }
    S.cat = cat;
    S.profile = await fetch(`/api/picks/profile?login=${encodeURIComponent(cat.login)}`).then((r) => r.json()).then((p) => (p?.ok ? p : null)).catch(() => null);
    if (mineTok !== token || !root) return;
    paint();
  }

  const view = {
    mount(container) {
      root = container;
      needCss();
      Object.assign(S, { hover: null, hoverPlayer: null, confirm: null, busy: false, msg: null, titleDraft: null, messageDraft: null, playerQ: "", playerResults: [], playerNote: "" });
      load();
    },
    unmount() { token += 1; clearTimeout(searchTimer); root = null; }
  };

  function boot() {
    if (window.ECV3?.register) window.ECV3.register("store", view);
    else setTimeout(boot, 30);
  }
  boot();
})();
