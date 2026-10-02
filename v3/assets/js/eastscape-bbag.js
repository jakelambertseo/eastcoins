/* ============================================================
   EastScape: THE BUFF BAG's window (2026-10-02, v1.2). The owner: "keep it in their inventory and either click on it to consume all (right click to
   change out buffs), or press B hotkey to consume all". Mockup: tools/buffbag-mock. The rules are THE BUFF BAG in the rules file, the server's half
   is eastscape-worker/src/bbag.js; this only draws C.bbag and sends { t: "bbag", op } messages, and the server re-checks everything.
   Opened by right-clicking the bag. Fetched the first time it is opened, never at login.
   createBbagWin({ G, $, esc, send, SFX, ico, getMe }) -> { open(), refresh() }
   ============================================================ */
export function createBbagWin(E) {
  const { G, $, esc, send, SFX, ico } = E;
  let win = null, pick = null;
  const ITEMS = G.ITEMS, B = G.BBAG;
  const what = (k) => { const it = ITEMS[k]; if (!it) return "";
    if (it.meal) return `${it.meal.mins} min · ${G.fxText(it.meal.fx)}`; if (it.drink) return `${it.drink.mins} min · ${G.fxText(it.drink.fx) || it.ex || ""}`;
    if (it.use === "charm") { const C = G.CHARMS[k.replace(/^scroll_/, "")]; return C ? `${C.mins} min · ${C.what(C.vals[0])} (tier I) and up` : ""; }
    if (it.use === "gadget") { const g = G.GADGETS[it.gadget]; return g ? `${g.mins} min · ${g.does}` : ""; }
    if (it.use === "kit") { const K = G.FIELD_KITS[k.replace(/^kit_/, "")]; return K ? `${K.mins[0]} min · ${K.what(K.vals[0])} (tier I) and up` : ""; }
    return ""; };
  function css() {
    if ($("bbagCss")) return; const st = document.createElement("style"); st.id = "bbagCss"; st.textContent = `
#bbagWin{width:min(600px,calc(100% - 28px));max-height:min(640px,calc(100% - 28px));z-index:90}
#bbagWin .k-body{display:grid;gap:6px;overflow:auto}
#bbagWin .bb-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center}
#bbagWin .bb-ty{display:inline-block;margin-right:6px;font:800 10.5px Lora,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--k-gold-ink)}
#bbagWin .bb-n small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bbagWin .bb-bar{height:5px;margin-top:4px;border-radius:3px;background:rgba(90,58,24,.15);overflow:hidden}#bbagWin .bb-bar i{display:block;height:100%;background:linear-gradient(90deg,#c8963a,#ffd84a)}
#bbagWin .k-end{display:flex;gap:6px;align-items:center;flex-wrap:nowrap}#bbagWin .k-end .k-btn{margin:0}
#bbagWin .bb-pick{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:6px;padding:8px;border-radius:6px;background:rgba(255,255,255,.35);box-shadow:inset 0 0 0 1.5px var(--k-card-line)}
#bbagWin .bb-pick button{display:flex;align-items:center;gap:6px;padding:4px 9px 4px 4px;border:0;border-radius:6px;background:var(--k-card);box-shadow:inset 0 0 0 1.5px var(--k-card-line);font:800 12.5px Lora,sans-serif;color:var(--k-ink);cursor:pointer}
#bbagWin .bb-pick button:hover{background:var(--k-paper-hi);box-shadow:inset 0 0 0 2px var(--k-gold)}
#bbagWin .bb-pick .ico img,#bbagWin .bb-pick img{width:22px;height:22px}
#bbagWin .bb-pick em{font-style:normal;color:var(--k-ink2);font:700 11.5px Lora,sans-serif}
#bbagWin .k-slot.bb-none img{opacity:0}`;
    document.head.append(st); }
  function render() {
    const me = E.getMe(); if (!me || !win || win.hidden) return;
    const bag = me.bbag || {}, inv = me.inv || [];
    const rows = B.slots.map((slot) => {
      const s = bag[slot], it = s && ITEMS[s.k], held = slot === "kit" && G.HOLD.kits, left = s ? G.bbagLeft(me, slot, s.k) : 0;
      const chips = [s ? `<span class="k-chip ${s.n ? "gold" : "bad"}">${s.n ? `×${s.n} of ${B.max}` : "empty, refill?"}</span>` : "", left > 0 ? `<span class="k-chip good">running · ${Math.ceil(left / 60000)} min</span>` : ""].join("");
      const btns = held ? `<span class="k-chip lock">soon</span>` : `<button type="button" class="k-btn sec sm" data-ch="${slot}">${s ? "Change" : "Load"}</button>${s ? `<button type="button" class="k-btn danger sm" data-out="${slot}">Take out</button>` : ""}`;
      let html = `<div class="k-row bb-row${held ? " lock" : ""}"><span class="k-slot${it ? "" : " bb-none"}">${it ? ico(s.k) : "<img alt=''>"}</span>
        <span class="bb-n"><b><span class="bb-ty">${B.names[slot]}</span>${it ? esc(it.name) : `<span style="color:var(--k-ink3)">${held ? "Field kits arrive soon" : "Empty"}</span>`}</b><small>${it ? esc(what(s.k)) : esc(B.subs[slot])}</small>${it ? `<div class="bb-bar"><i style="width:${(s.n / B.max) * 100}%"></i></div>` : ""}</span>
        <span class="k-end">${chips}${btns}</span></div>`;
      if (pick === slot) {
        const got = new Map(); inv.forEach((x, i) => { if (G.bbagSlotOf(x.k) === slot && !G.fCode(x)) { const g = got.get(x.k) || { i, n: 0 }; g.n += x.n | 0; got.set(x.k, g); } });
        html += `<div class="bb-pick">${got.size ? [...got].map(([k, g]) => `<button type="button" data-ld="${slot}" data-i="${g.i}">${ico(k)}${esc(ITEMS[k].name)} <em>×${g.n}${s?.k === k ? ", tops it up" : ""}</em></button>`).join("") : `<span class="k-note">No ${B.names[slot].toLowerCase()} in your bag. Get some, then load it here.</span>`}</div>`;
      }
      return html;
    }).join("");
    win.querySelector(".k-body").innerHTML = rows;
  }
  function open() {
    css();
    if (!win) {
      win = document.createElement("section"); win.className = "win k-win"; win.id = "bbagWin"; win.setAttribute("aria-label", "Buff Bag");
      win.innerHTML = `<div class="k-head"><img src="/v3/assets/img/glad/flat/items/buffbag.png?v=1" alt=""><b>Buff Bag</b><span class="k-sub">use all: click it or <b>B</b></span><button type="button" class="k-x" aria-label="Close">×</button></div>
        <div class="k-body k-paper"></div>
        <div class="k-foot"><span class="k-note">Anything already running is skipped, so nothing is wasted.</span><button type="button" class="k-btn" data-use="1"><img src="/v3/assets/img/glad/flat/items/buffbag.png?v=1" alt="">Use all</button></div>`;
      ($("msWin") || document.body).after(win);
      win.addEventListener("click", (e) => {
        if (e.target.closest(".k-x")) { win.hidden = true; pick = null; SFX?.play?.("ui_close"); return; }
        if (e.target.closest("[data-use]")) { send({ t: "bbag", op: "use" }); return; }
        const c = e.target.closest("[data-ch]"); if (c) { pick = pick === c.dataset.ch ? null : c.dataset.ch; SFX?.play?.("ui_click"); return render(); }
        const o = e.target.closest("[data-out]"); if (o) { send({ t: "bbag", op: "take", slot: o.dataset.out }); SFX?.play?.("ui_click"); return; }
        const l = e.target.closest("[data-ld]"); if (l) { send({ t: "bbag", op: "load", slot: l.dataset.ld, i: +l.dataset.i }); pick = null; SFX?.play?.("coins", { vol: 0.4 }); }
      });
    }
    win.hidden = false; render(); SFX?.play?.("ui_open");
  }
  /* redraw while open, so a load or a use shows at once (the page calls this when you change) */
  const refresh = () => { if (win && !win.hidden) render(); };
  return { open, refresh };
}
