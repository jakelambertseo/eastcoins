/* ============================================================
   EastScape: THE BANK (rebuilt 2026-09-27; the owner: "completely redo the bank UI ... very primitive from our first versions ... make it
   significantly more user friendly"). Fetched the first time the bank opens, like the pen: the first load has no room for it.

   WHAT IT DOES that the old two-grid window did not:
   - TABS down the left, worked out from what the bank holds (gear, ranged & magic, tools, food, materials, seeds & spawn,
     breeding, potions & scrolls, misc), each with a count. Nothing is stored: a tab is a rule over the item's own fields, so a
     new item lands in the right place without anyone remembering to file it.
   - ONE SEARCH over the bank and the bag: the bank filters, the bag dims what does not match.
   - AN AMOUNT OF YOUR OWN (X) beside 1 / 5 / 10 / All, remembered; RIGHT-CLICK on any tile for a menu (1, 5, 10, all, X, wiki)
     instead of the wiki page opening on every right-click here.
   - A METER of slots used and what the lot is worth.
   The rules that must survive any rewrite: every bank tile carries the item's TRUE bank index (data-b), whatever the sort or
   the filter, because the server moves by index; the grids are rebuilt only when their HTML changes, since this runs on every
   "me" update while the window is open; tickets never go in. The server (bankOp) is untouched.
   ============================================================ */
export function createBankUi(E) {
  const { G, $, esc, ico, qty, fgTag, slotHtml, send, SFX, say, ITEMS } = E;
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  const ls = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  let tab = ls("es_bank_tab", "all"), sort = ls("es_bank_sort", "recent"), mode = ls("es_bank_n", "1"), x = Math.max(1, +ls("es_bank_x", "50") || 50), q = "";
  /* (2026-09-27) PAGES, as in OSRS: BANK_PAGES of them, "all" shows every page in order with a heading each. A deposit lands on the page you
     are looking at (or the first, from "all"); a stack the bank already holds grows where it already is. An item moves page by being dragged
     onto a page tab, or from its hold / right-click menu. The page is on the row itself (bank[i].p), so it follows the character. */
  let page = ls("es_bank_page", "all"); const NP = G.BANK_PAGES || 5, pageOf = (s) => Math.min(NP - 1, s.p | 0), curPage = () => (page === "all" ? 0 : +page);
  const last = { tabs: null, pages: null, grid: null, bag: null, meter: null, up: null };
  let built = false, menu = null;

  /* ---- the tabs: a rule over the item's own fields, in the order they are shown */
  const INS = new Set(); for (const r of Object.values(G.RECIPES || {})) for (const [k] of r.in || []) INS.add(k);
  const TABS = [["all", "All", "\u{1F3DB}️"], ["gear", "Gear", "\u{1F6E1}️"], ["ranged", "Ranged", "\u{1F3F9}", "Bows, wands, quivers, Magic Bags, arrows and pages"], ["tools", "Tools", "⛏️"], ["food", "Food", "\u{1F357}", "Food and drink, raw and cooked"],
    ["materials", "Materials", "\u{1FAA8}", "Ore, bars, logs, hides and everything else a recipe takes"], ["seeds", "Seeds", "\u{1F331}", "Seeds, crops and mushroom spawn"], ["pets", "Breeding", "\u{1F95A}", "Eggs and pet food"], ["potions", "Potions", "\u{1F9EA}", "Potions, scrolls and charms"], ["misc", "Misc", "\u{1F4E6}"]];
  const catOf = (k) => { const it = ITEMS[k]; if (!it) return "misc";
    if (it.ammo || it.pouch || it.launcher) return "ranged";
    if (it.tool) return "tools";
    if (it.slot) return "gear";
    if (it.heal || it.raw || it.drink || it.meal) return "food";
    if (/^petfood_/.test(k) || G.EGGS?.[k]) return "pets";
    if (G.CROPS?.[k] || G.FUNGI?.[k] || /^spawn_|^seed_/.test(k)) return "seeds";
    if (it.use || it.luck || it.charm || /^pot_|^scroll_|^tp_/.test(k)) return "potions";
    if (INS.has(k) || /_ore$|_bar$|logs$|^charcoal|^cut_|^polished_|_bead$|^ink_/.test(k)) return "materials";
    return "misc"; };
  const SORTS = { recent: null, az: (a, b) => ITEMS[a[0].k].name.localeCompare(ITEMS[b[0].k].name), value: (a, b) => G.valueOf(b[0].k) * b[0].n - G.valueOf(a[0].k) * a[0].n, amount: (a, b) => b[0].n - a[0].n };
  const amount = () => (mode === "all" ? "all" : mode === "x" ? x : +mode);

  function build() {
    const root = $("bankRoot"); if (!root) return; built = true; root.classList.remove("view-loading");
    root.innerHTML = `<div class="bk">
      <nav class="bk-side"><div class="bk-pages" id="bkPages" aria-label="Bank pages"></div><p class="bk-pnote">Drag an item onto a page to file it there. Deposits go to the page you are on.</p></nav>
      <section class="bk-main">
        <div class="bk-tabs" id="bkTabs" aria-label="Kinds"></div>
        <div class="bk-top"><input class="search bk-search" id="bkSearch" placeholder="Search bank and bag…" aria-label="Search bank and bag" autocomplete="off">
          <div class="qty bk-sort" id="bkSort" role="group" aria-label="Sort">${[["recent", "Recent"], ["az", "A–Z"], ["value", "Value"], ["amount", "Amount"]].map(([k, n]) => `<button type="button" data-s="${k}">${n}</button>`).join("")}</div></div>
        <div class="bk-meter" id="bkMeter"></div>
        <div class="bk-grid" id="bkGrid"></div>
      </section>
      <aside class="bk-bag">
        <div class="bk-bagh"><img class="bk-bagi" src="/v3/assets/img/glad/flat/ui/bag.png?v=1" alt=""><b>Your bag</b><small id="bkBagN"></small></div>
        <div class="bk-grid sm" id="bkBag"></div>
        <div class="bk-actions"><button type="button" class="btn plain" id="bkDepInv" title="Everything in your bag goes in (tickets stay with you)">Deposit bag</button><button type="button" class="btn plain" id="bkDepEq" title="Everything you are wearing goes in">Deposit worn</button><button type="button" class="btn plain" id="bkStack" title="Every stack your bank already holds goes in, all of it">Stack all</button></div>
        <div class="bk-move"><span>Move</span><div class="qty" id="bkQty">${[["1", "1"], ["5", "5"], ["10", "10"], ["x", "X"], ["all", "All"]].map(([k, n]) => `<button type="button" data-n="${k}">${n}</button>`).join("")}</div><input type="number" id="bkX" min="1" step="1" value="${x}" aria-label="Your own amount" title="Your own amount: pick X, then click an item"></div>
        <p class="bk-hint">Click moves that many. <b>Shift-click</b>: a full stack out, the whole lot in. <b>Right-click</b> an item for more.</p>
        <div id="bkUp"></div>
      </aside></div>`;
    $("bkSearch").addEventListener("input", () => { q = $("bkSearch").value.trim().toLowerCase(); render(); });
    $("bkSort").addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (!b) return; sort = b.dataset.s; lsSet("es_bank_sort", sort); SFX.play("ui_click"); render(); });
    $("bkQty").addEventListener("click", (e) => { const b = e.target.closest("[data-n]"); if (!b) return; mode = b.dataset.n; lsSet("es_bank_n", mode); if (mode === "x") $("bkX").focus(); paintQty(); });
    $("bkX").addEventListener("input", () => { x = Math.max(1, Math.floor(+$("bkX").value) || 1); lsSet("es_bank_x", String(x)); if (mode !== "x") { mode = "x"; lsSet("es_bank_n", mode); paintQty(); } });
    $("bkTabs").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (!b) return; tab = b.dataset.tab; lsSet("es_bank_tab", tab); SFX.play("ui_click"); render(); });
    $("bkPages").addEventListener("click", (e) => { const b = e.target.closest("[data-page]"); if (!b) return; page = b.dataset.page; lsSet("es_bank_page", page); SFX.play("ui_click"); render(); });
    /* drag a tile onto a page: a bank row is refiled, a bag stack is deposited there. HTML5 drag is mouse-only; touch has the hold menu. */
    const dragAt = { bank: -1, bag: -1 };
    for (const [id, ev] of [["bkGrid", "b"], ["bkBag", "i"]]) {
      $(id).addEventListener("dragstart", (e) => { const el = e.target.closest(`[data-${ev}]`); if (!el) return; dragAt.bank = ev === "b" ? +el.dataset.b : -1; dragAt.bag = ev === "i" ? +el.dataset.i : -1; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", el.dataset[ev]); el.classList.add("dragging"); });
      $(id).addEventListener("dragend", (e) => { e.target.closest?.(".slot")?.classList.remove("dragging"); $("bkPages").querySelectorAll(".over").forEach((b) => b.classList.remove("over")); });
    }
    $("bkPages").addEventListener("dragover", (e) => { const b = e.target.closest("[data-page]"); if (!b || b.dataset.page === "all") return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; b.classList.add("over"); });
    $("bkPages").addEventListener("dragleave", (e) => { e.target.closest?.("[data-page]")?.classList.remove("over"); });
    $("bkPages").addEventListener("drop", (e) => { const b = e.target.closest("[data-page]"); if (!b || b.dataset.page === "all") return; e.preventDefault(); const p = +b.dataset.page; b.classList.remove("over");
      if (dragAt.bank >= 0) send({ t: "bank", op: "page", i: dragAt.bank, p }); else if (dragAt.bag >= 0) dep(dragAt.bag, amount(), p); dragAt.bank = dragAt.bag = -1; SFX.play("ui_click"); });
    $("bkGrid").addEventListener("click", (e) => { const el = e.target.closest("[data-b]"); if (!el) return; const s = E.me?.bank?.[+el.dataset.b]; if (!s) return; wd(+el.dataset.b, e.shiftKey ? G.capOf(s.k) : amount()); });
    $("bkBag").addEventListener("click", (e) => { const el = e.target.closest("[data-i]"); if (!el) return; dep(+el.dataset.i, e.shiftKey ? "all" : amount()); });
    for (const [id, ev] of [["bkGrid", "b"], ["bkBag", "i"]]) {
      const atOf = (el) => (ev === "b" ? { bank: +el.dataset.b } : { bag: +el.dataset.i });
      $(id).addEventListener("contextmenu", (e) => { const el = e.target.closest(`[data-${ev}]`); if (!el) return; e.preventDefault(); e.stopPropagation(); openMenu(e, atOf(el)); });
      /* (2026-09-27) A HOLD ON A TOUCH SCREEN is the right-click: 450 ms without moving opens the same menu, and the click that follows the
         lift is swallowed so the hold does not also withdraw one. */
      let hold = 0, held = false, sx = 0, sy = 0;
      $(id).addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") return; const el = e.target.closest(`[data-${ev}]`); if (!el) return; sx = e.clientX; sy = e.clientY; held = false; clearTimeout(hold);
        hold = setTimeout(() => { held = true; openMenu({ clientX: sx, clientY: sy }, atOf(el)); }, 450); });
      const stop = () => clearTimeout(hold);
      $(id).addEventListener("pointermove", (e) => { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) stop(); });
      $(id).addEventListener("pointerup", stop); $(id).addEventListener("pointercancel", stop);
      $(id).addEventListener("click", (e) => { if (held) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    }
    $("bkDepInv").addEventListener("click", () => { SFX.play("ui_click"); send({ t: "bank", op: "depinv", p: curPage() }); });
    $("bkDepEq").addEventListener("click", () => { SFX.play("ui_click"); send({ t: "bank", op: "depeq", p: curPage() }); });
    $("bkStack").addEventListener("click", () => { SFX.play("ui_click"); send({ t: "bank", op: "stackall", p: curPage() }); });
    document.addEventListener("click", closeMenu, true); document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
    paintQty();
  }
  const wd = (i, n) => send({ t: "bank", op: "wd", i, n });
  const dep = (i, n, p = curPage()) => { const s = E.me?.inv?.[i]; if (s?.k === "tickets") return say("Tickets stay on you. The bank won't take them.", "bad"); send({ t: "bank", op: "dep", i, n, p }); };
  function paintQty() { $("bkQty")?.querySelectorAll("[data-n]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.n === mode))); $("bkX")?.classList.toggle("on", mode === "x"); }

  /* ---- the right-click menu: the same moves, said out loud */
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(e, at) {
    closeMenu();
    const me = E.me, s = at.bank != null ? me?.bank?.[at.bank] : me?.inv?.[at.bag]; if (!s) return;
    const out = at.bank != null, verb = out ? "Withdraw" : "Deposit", it = ITEMS[s.k], name = G.forgeNameAt(s.k, G.fOf(s));
    const rows = [[1, `${verb} 1`], [5, `${verb} 5`], [10, `${verb} 10`], ["x", `${verb} ${x.toLocaleString()} (X)`], ["all", out ? `Withdraw all ${s.n.toLocaleString()}` : `Deposit all ${s.n.toLocaleString()}`]].filter(([n]) => n === "all" || n === "x" || n < s.n);
    menu = document.createElement("div"); menu.className = "bk-menu"; menu.setAttribute("role", "menu");
    menu.innerHTML = `<div class="bk-menu-h">${ico(s.k)}<b>${esc(name)}</b>${s.n > 1 ? `<small>×${s.n.toLocaleString()}</small>` : ""}</div>${rows.map(([n, t]) => `<button type="button" role="menuitem" data-n="${n}">${t}</button>`).join("")}${out ? (() => { const pg = Array.from({ length: NP }, (_, p) => p).filter((p) => p !== pageOf(s)).map((p) => `<button type="button" role="menuitem" data-page="${p}">Move to page ${p + 1}</button>`).join(""); return `<div class="bk-menu-s"></div>${pg}`; })() : ""}<button type="button" role="menuitem" data-wiki="1">Wiki page</button>`;
    document.body.append(menu);
    const W = menu.offsetWidth, H = menu.offsetHeight, px = Math.min(e.clientX, innerWidth - W - 8), py = Math.min(e.clientY, innerHeight - H - 8);
    menu.style.left = `${Math.max(4, px)}px`; menu.style.top = `${Math.max(4, py)}px`;
    menu.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (!b) return; ev.stopPropagation();
      if (b.dataset.wiki) { closeMenu(); return E.wikiGo?.(`items/${s.k}`); }
      if (b.dataset.page != null) { closeMenu(); return send({ t: "bank", op: "page", i: at.bank, p: +b.dataset.page }); }
      const n = b.dataset.n === "all" ? "all" : b.dataset.n === "x" ? x : +b.dataset.n; closeMenu(); out ? wd(at.bank, n) : dep(at.bag, n); });
    if (!it) closeMenu();
  }

  /* ---- the draw: on open and on every "me" while open, cheap when nothing changed */
  function render() {
    const me = E.me; if (!me || !$("bankRoot")) return; if (!built) build();
    const bank = me.bank || [], rows = bank.map((s, i) => [s, i]);
    /* the pages: each tab wears the first item filed on it, the way an OSRS tab does, and its count */
    const onPage = Array.from({ length: NP }, () => []); for (const r of rows) onPage[pageOf(r[0])].push(r);
    const pagesHtml = [`<button type="button" data-page="all" aria-pressed="${String(page === "all")}" title="Every page"><i>\u{1F3DB}\uFE0F</i><span>All</span><em>${rows.length}</em></button>`,
      ...onPage.map((list, p) => `<button type="button" data-page="${p}" aria-pressed="${String(page === String(p))}" title="Page ${p + 1}: drop an item here to file it"><i>${list.length ? ico(list[0][0].k) : `<b>${p + 1}</b>`}</i><span>Page ${p + 1}</span><em>${list.length}</em></button>`)].join("");
    if (pagesHtml !== last.pages) { $("bkPages").innerHTML = pagesHtml; last.pages = pagesHtml; }
    const inPage = page === "all" ? rows : onPage[curPage()] || [];
    const counts = { all: inPage.length }; for (const [s] of inPage) { const c = catOf(s.k); counts[c] = (counts[c] || 0) + 1; }
    if (tab !== "all" && !counts[tab]) tab = "all";
    const tabsHtml = TABS.filter(([k]) => k === "all" || counts[k]).map(([k, n, i, t]) => `<button type="button" data-tab="${k}" aria-pressed="${String(k === tab)}" title="${t || n}"><i>${i}</i><span>${n}</span><em>${counts[k] || 0}</em></button>`).join("");
    if (tabsHtml !== last.tabs) { $("bkTabs").innerHTML = tabsHtml; last.tabs = tabsHtml; }
    $("bkSort").querySelectorAll("[data-s]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.s === sort)));
    const worth = bank.reduce((a, s) => a + G.valueOf(s.k) * s.n, 0), pct = Math.min(100, Math.round(bank.length / G.BANK_MAX * 100));
    const meter = `<span class="bk-slots"><b>${bank.length}</b> of ${G.BANK_MAX} slots</span><span class="bk-bar" aria-hidden="true"><i style="width:${pct}%" class="${pct >= 95 ? "full" : pct >= 80 ? "warn" : ""}"></i></span><span class="bk-worth">worth ${G.fmtCash(worth)}</span>`;
    if (meter !== last.meter) { $("bkMeter").innerHTML = meter; last.meter = meter; }
    const keep = ([s]) => (tab === "all" || catOf(s.k) === tab) && (!q || ITEMS[s.k].name.toLowerCase().includes(q)), cmp = SORTS[sort];
    const tile = ([s, i]) => slotHtml(s, i, "data-b").replace('class="slot"', 'class="slot" draggable="true"');
    let shown, gridHtml;
    if (page === "all" && onPage.filter((l) => l.length).length > 1) {   /* every page, each under its heading, each sorted on its own */
      shown = rows.filter(keep);
      gridHtml = onPage.map((list, p) => { const l = list.filter(keep); if (cmp) l.sort(cmp); return l.length ? `<div class="bk-ph">Page ${p + 1}</div>${l.map(tile).join("")}` : ""; }).join("");
    } else { shown = inPage.filter(keep); if (cmp) shown.sort(cmp); gridHtml = shown.map(tile).join(""); }
    gridHtml = shown.length ? gridHtml
      : `<p class="bk-empty">${!bank.length ? "Your bank is empty. Click things in your bag to put them in, or <b>Deposit bag</b> for the lot." : q ? `Nothing in the bank matches “${esc(q)}”.` : "Nothing on this tab."}</p>`;
    if (gridHtml !== last.grid) { $("bkGrid").innerHTML = gridHtml; last.grid = gridHtml; }
    const bagHtml = me.inv.map((s, i) => slotHtml(s, i).replace('class="slot"', `class="slot${q && !ITEMS[s.k].name.toLowerCase().includes(q) ? " dim" : ""}${s.k === "tickets" ? " stay" : ""}"`)).join("") || `<p class="bk-empty">Your bag is empty.</p>`;
    if (bagHtml !== last.bag) { $("bkBag").innerHTML = bagHtml; last.bag = bagHtml; }
    $("bkBagN").textContent = `${me.inv.length} / ${G.bagMax(me)}`;
    const upCost = G.bagUpCost(me), up = upCost == null ? `<p class="bk-hint">Your bag is as big as Bom will make it.</p>`
      : `<div class="bk-up"><span>Bom will sew on another pocket for <b>${G.fmtTix(upCost)}</b> (${G.BAG_UPGRADES.length - (me.bagUp | 0)} left).</span><button type="button" class="btn" id="bkUpGo"${G.tixIn(me) >= upCost ? "" : " disabled"}>Buy a slot · ${G.bagMax(me) + 1}</button></div>`;
    if (up !== last.up) { $("bkUp").innerHTML = up; last.up = up; $("bkUpGo")?.addEventListener("click", () => { SFX.play("chip", { vol: 0.5 }); send({ t: "counter", op: "bagup" }); }); }
  }
  return { render, catOf };
}
const CSS = `
.win.wide{width:min(1040px,calc(100% - 28px))}
.bk{display:grid;grid-template-columns:132px minmax(0,1fr) 240px;gap:12px;min-height:0}
.bk-side{display:flex;flex-direction:column;gap:6px;min-width:0}
.bk-pages{display:flex;flex-direction:column;gap:3px}
.bk-pages button{display:grid;grid-template-columns:26px 1fr auto;align-items:center;gap:6px;padding:6px 7px;border:2px dashed transparent;border-radius:8px;background:none;font:800 13px Nunito,sans-serif;color:#3a2c1c;text-align:left;cursor:pointer}
.bk-pages button:hover{background:rgba(0,0,0,.06)}.bk-pages button[aria-pressed=true]{background:#fffaf0;border-style:solid;border-color:#c8963a;box-shadow:0 1px 3px rgba(60,40,10,.18)}
.bk-pages button.over{border-color:#4aa84a;background:rgba(74,168,74,.16)}
.bk-pages button i{font-style:normal;font-size:15px;text-align:center;display:grid;place-items:center}.bk-pages button i .ico{width:22px;height:22px}.bk-pages button i b{width:22px;height:22px;border-radius:6px;background:rgba(0,0,0,.1);display:grid;place-items:center;font-size:12px}
.bk-pages button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bk-pages button em{font-style:normal;font-size:11px;padding:1px 6px;border-radius:999px;background:rgba(0,0,0,.1)}
.bk-pnote{margin:2px 0 0;font-size:11px;line-height:1.35;opacity:.65}
.bk-tabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}
.bk-tabs button{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border:1px solid rgba(0,0,0,.14);border-radius:999px;background:rgba(0,0,0,.04);font:800 12px Nunito,sans-serif;color:#3a2c1c;cursor:pointer}
.bk-tabs button:hover{background:rgba(0,0,0,.08)}.bk-tabs button[aria-pressed=true]{background:#fffaf0;border-color:#c8963a;box-shadow:0 1px 3px rgba(60,40,10,.18)}
.bk-tabs button i{font-style:normal;font-size:13px}.bk-tabs button em{font-style:normal;font-size:10.5px;padding:0 5px;border-radius:999px;background:rgba(0,0,0,.1)}
.bk-ph{grid-column:1/-1;margin:6px 2px 0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.6}
.bk-grid .slot.dragging{opacity:.4}.bk-menu-s{height:1px;margin:3px 6px;background:rgba(0,0,0,.12)}
.bk-top{display:flex;gap:8px;align-items:center;margin-bottom:6px}.bk-search{flex:1;margin:0}.bk-sort button{padding:4px 9px;font-size:12px}
.bk-meter{display:flex;align-items:center;gap:10px;margin:0 0 8px;font-size:12px;color:#5a4a30}.bk-meter b{color:#2a2016}
.bk-bar{flex:1;height:8px;border-radius:999px;background:rgba(0,0,0,.12);overflow:hidden}.bk-bar i{display:block;height:100%;background:#4aa84a;border-radius:999px}.bk-bar i.warn{background:#d8963a}.bk-bar i.full{background:#c8283a}
.bk-worth{white-space:nowrap}
.bk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:4px;align-content:start;max-height:min(58vh,520px);overflow:auto;padding:2px}
.bk-grid .slot{font-size:24px}.bk-grid.sm{grid-template-columns:repeat(auto-fill,minmax(44px,1fr));max-height:min(34vh,300px)}.bk-grid.sm .slot{font-size:20px}
.bk-grid .slot.dim{opacity:.32}.bk-grid .slot.stay{cursor:not-allowed}
.bk-empty{grid-column:1/-1;margin:8px 4px;font-size:13px;opacity:.75}
.bk-bag{position:relative;display:flex;flex-direction:column;gap:8px;min-width:0;padding:12px 10px 10px;border-radius:14px;color:#f6e9cf;background:radial-gradient(ellipse at 28% 18%,#8a5f38,#5a3a1f 62%,#462c17);box-shadow:inset 0 0 0 3px #2a1608,inset 0 0 0 5px #c69a5c,0 6px 14px rgba(0,0,0,.28)}
.bk-bag::before{content:"";position:absolute;inset:9px;border:2px dashed rgba(246,222,170,.55);border-radius:9px;pointer-events:none}
.bk-bag>*{position:relative}
.bk-bagh{display:flex;align-items:center;gap:8px}.bk-bagh b{font-size:15px;letter-spacing:.02em}.bk-bagh small{color:#ecd9b0}.bk-bagi{width:26px;height:26px;image-rendering:pixelated;filter:drop-shadow(0 1px 0 rgba(0,0,0,.5))}
.bk-bag .bk-hint{color:#ecd9b0;opacity:.95}.bk-bag .bk-empty{color:#ecd9b0}.bk-move{color:#f6e9cf}
.bk-bag .bk-up{background:rgba(0,0,0,.28);color:#f6e9cf}.bk-bag .bk-grid.sm{background:rgba(0,0,0,.18);border-radius:8px;padding:4px}
.bk-actions{display:flex;flex-wrap:wrap;gap:5px}.bk-actions .btn{min-width:0;flex:1 1 auto;padding:2px 8px;font-size:12px}
.bk-move{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:800}.bk-move .qty button{padding:3px 8px;font-size:12px}
#bkX{width:64px;padding:3px 6px;border:1px solid #8a7a5a;border-radius:4px;background:#fffaf0;font:800 12px Nunito,sans-serif}#bkX.on{border-color:#c8963a;box-shadow:0 0 0 2px rgba(200,150,58,.35)}
.bk-hint{margin:0;font-size:11.5px;opacity:.75;line-height:1.4}
.bk-up{display:flex;flex-direction:column;gap:6px;padding:8px;border-radius:8px;background:rgba(0,0,0,.05);font-size:12px}.bk-up .btn{align-self:flex-start;min-width:0;font-size:12px}
.bk-menu{position:fixed;z-index:1000;min-width:190px;padding:4px;border-radius:10px;background:#fffaf0;color:#2a2016;box-shadow:0 8px 24px rgba(0,0,0,.35),0 0 0 1px #c8b48a}
.bk-menu-h{display:flex;align-items:center;gap:6px;padding:6px 8px 4px;font-size:12.5px;border-bottom:1px solid rgba(0,0,0,.1);margin-bottom:3px}.bk-menu-h small{opacity:.7}.bk-menu-h .ico{width:20px;height:20px}
.bk-menu button{display:block;width:100%;padding:6px 10px;border:0;border-radius:6px;background:none;text-align:left;font:800 13px Nunito,sans-serif;color:#2a2016;cursor:pointer}.bk-menu button:hover{background:rgba(200,150,58,.22)}
@media (max-width:820px){.bk-menu button{padding:10px 12px;font-size:14px}.bk{grid-template-columns:minmax(0,1fr)}.bk-pages{flex-direction:row;overflow-x:auto;padding-bottom:4px}.bk-pages button{flex:none;grid-template-columns:auto auto}.bk-pages button span{display:none}.bk-pnote{display:none}.bk-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:3px}.bk-tabs button{flex:none}.bk-tabs button span{display:none}.bk-grid{max-height:40vh}.bk-grid.sm{max-height:26vh}}`;
