/* ============================================================
   EastCoin Store — /?view=store (2026-09-15, members only, not in the nav)

   Cosmetics for the trading card and profile, bought with ZCoins
   (/api/store, /api/store/buy, /api/store/equip). The preview on the
   left is the REAL profile card — v3-profile.js hands out its
   tradingCard() — drawn with whatever you have on, and with an item
   swapped in while you hover it, so what you see is what you get.
   ============================================================ */
(() => {
  const CSS = "/v3/assets/css/v3-store.css?v=1";

  let root = null;
  let token = 0;
  const S = { cat: null, profile: null, hover: null, confirm: null, busy: false, msg: null, titleDraft: null };

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
  const mine = () => S.cat?.mine || { owned: [], equipped: {}, titleText: "" };
  const owns = (id) => mine().owned.includes(id);
  const itemOf = (id) => S.cat.items.find((i) => i.id === id);

  /* ---------------------------------------------------------- preview */

  function cosmetics() {
    const m = mine();
    const c = {
      finish: m.equipped.finish, name: m.equipped.name, banner: m.equipped.banner, label: m.equipped.label,
      title: m.equipped.title && m.titleText ? m.titleText : null
    };
    if (S.hover) {
      const it = itemOf(S.hover);
      if (it) c[it.slot] = it.slot === "title" ? (S.titleDraft || m.titleText || "Your title here") : it.id;
    }
    return c;
  }

  function preview() {
    const box = el("aside", "st-preview");
    const c = cosmetics();
    const stage = el("div", `st-stage${c.banner ? ` pf-banner pf-banner-${c.banner.slice(7)}` : ""}`);
    const p = S.profile;
    if (p && window.ECProfileCard?.tradingCard) {
      const cardCase = el("div", "tc-case");
      const label = el("div", `tc-case-label${c.label ? " foil" : ""}`);
      label.append(el("i", null, "◆"), el("span", null, "EastCoin Trading Card"), el("i", null, "◆"));
      cardCase.append(label, window.ECProfileCard.tradingCard({ ...p, cosmetics: c }));
      stage.append(cardCase);
    } else {
      stage.append(el("p", "st-note", "Your card preview couldn't load."));
    }
    const name = el("p", "st-name");
    name.append(el("span", `pf-name${c.name ? " nm-" + c.name.slice(5) : ""}`, p?.user?.displayName || S.cat?.login || "You"));
    box.append(stage, name);
    const tier = p && window.ECProfileCard?.tierOf ? window.ECProfileCard.tierOf(p.picks) : "base";
    box.append(el("p", "st-note", tier !== "base"
      ? `You've earned the ${tier} finish on the Picks ladder. It shows over any bought finish — the others appear if you drop back.`
      : S.hover ? "Previewing. Move away to see what you have on." : "This is your card as everyone sees it. Hover an item to try it on."));
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
      S.msg = { tone: "good", text: item.slot === "title" ? `Bought ${item.name}. Write your title below to put it on your card.` : `Bought ${item.name}. It's on your profile now.` };
    } else {
      S.msg = { tone: "bad", text: r?.message || "That didn't go through. Nothing was charged." };
    }
    paint();
  }

  async function equip(item, on, text) {
    const r = await post("/api/store/equip", { slot: item.slot, item: on ? item.id : null, text });
    if (r?.ok) {
      S.cat.mine = r.mine;
      S.msg = { tone: "good", text: on ? `${item.name} is on.` : `${item.name} is off.` };
      if (item.slot === "title") S.titleDraft = null;
    } else {
      S.msg = { tone: "bad", text: r?.message || "Couldn't change that." };
    }
    paint();
  }

  /* ---------------------------------------------------------- shelves */

  function tile(item) {
    const m = mine();
    const owned = owns(item.id);
    const on = m.equipped[item.slot] === item.id;
    const t = el("article", `st-item${owned ? " owned" : ""}${on ? " on" : ""}`);
    t.addEventListener("mouseenter", () => { S.hover = item.id; repaintPreview(); });
    t.addEventListener("mouseleave", () => { if (S.hover === item.id) { S.hover = null; repaintPreview(); } });
    t.addEventListener("focusin", () => { S.hover = item.id; repaintPreview(); });

    const sw = el("div", `st-swatch sw-${item.id}`);
    if (item.slot === "name") sw.append(el("b", `nm-${item.id.slice(5)}`, "Aa"));
    if (item.slot === "title") sw.append(el("b", null, "“ ”"));
    if (item.slot === "label") sw.append(el("span", "tc-case-label foil", "◆ EastCoin ◆"));
    if (on) sw.append(el("span", "st-badge", "ON"));
    else if (owned) sw.append(el("span", "st-badge dim", "OWNED"));
    t.append(sw);

    const body = el("div", "st-body");
    body.append(el("h3", null, item.name), el("p", null, item.blurb));
    t.append(body);

    const foot = el("div", "st-foot");
    const balance = Number(S.cat.balance);
    if (!owned) {
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
    } else if (item.slot === "title") {
      const form = el("div", "st-title");
      const input = el("input");
      input.type = "text"; input.maxLength = 24; input.id = "st-title-input";
      input.placeholder = "Up to 24 characters";
      input.value = S.titleDraft ?? m.titleText ?? "";
      input.addEventListener("input", () => { S.titleDraft = input.value; S.hover = item.id; repaintPreview(); });
      const save = btn(on ? "Update" : "Put on card", "st-btn gold", () => equip(item, true, input.value));
      save.disabled = S.busy;
      form.append(input, save);
      if (on) form.append(btn("Remove", "st-btn", () => equip(item, false)));
      foot.append(form);
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
    if (!root) return;
    const page = el("section", "st");
    const head = el("div", "viewhead st-head");
    const copy = el("div");
    copy.append(el("h1", null, "EastCoin Store"), el("p", null, "Spend ZCoins on your trading card and profile. Everything here is cosmetic and yours to keep."));
    const wallet = el("div", "st-wallet");
    wallet.append(el("span", null, "My wallet"), coins(S.cat.balance ?? 0));
    head.append(copy, wallet);
    page.append(head);

    const layout = el("div", "st-layout");
    layout.append(preview());
    const shelves = el("div", "st-shelves");
    if (S.msg) shelves.append(el("p", `st-msg ${S.msg.tone}`, S.msg.text));
    for (const [slot, label] of Object.entries(S.cat.slots)) {
      const items = S.cat.items.filter((i) => i.slot === slot);
      if (!items.length) continue;
      const sec = el("section", "st-shelf");
      const h = el("h2", null, label);
      if (slot === "finish") h.append(el("small", null, "earned gold and silver always show first"));
      sec.append(h);
      const grid = el("div", "st-grid");
      for (const it of items) grid.append(tile(it));
      sec.append(grid);
      shelves.append(sec);
    }
    layout.append(shelves);
    page.append(layout);

    const focusId = document.activeElement?.id;
    root.replaceChildren(page);
    if (focusId) document.getElementById(focusId)?.focus();
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
      Object.assign(S, { hover: null, confirm: null, busy: false, msg: null, titleDraft: null });
      load();
    },
    unmount() { token += 1; root = null; }
  };

  function boot() {
    if (window.ECV3?.register) window.ECV3.register("store", view);
    else setTimeout(boot, 30);
  }
  boot();
})();
