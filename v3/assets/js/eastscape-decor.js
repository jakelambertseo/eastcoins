/* ============================================================
   EastScape: Yahsmeena's decor shop, and decorate mode

   Loaded the first time it is needed (you ask Yahsmeena what she's got, or press Decorate on your own island), never at login:
   the page's first load is on a budget and most sessions never come here.

   THE RULES ARE NOT IN THIS FILE. The catalogue (DECOR), what you may own, and "may this piece go on this tile"
   (R.decorFits) are in the shared rules file, and the GAME SERVER decides every purchase and every placement with them. This
   file draws the shop window, the tray and the ghost under your mouse, and sends one of four things: buy, sell, place, take.

     shop()            the shop window: two shelves (outside, cottage), what you own, buy and sell back
     toggle()          decorate mode on and off (only on your own island or in your own cottage)
     click(tx, ty)     the page hands a canvas click over while decorating: true if it was used
     ghost(tx, ty)     what to draw under the mouse: { x, y, w, h, ok } or null
   ============================================================ */
export function createDecor(env) {
  const { G, SFX, send, esc, $ } = env, R = env.rules, D = R.DECOR, IMGP = "/v3/assets/img/glad/flat/";
  let tab = "isle", on = false, pick = null, tool = "place", win = null, bar = null;
  const isle = () => env.me()?.isle || { owned: {}, decor: [], tier: 1 }, tix = () => G.tixIn(env.me() || { inv: [] });
  const placeHere = () => R.decorPlace(env.key()), mineHere = () => !!placeHere() && env.owner() === env.you()?.id;
  const img = (k, px = 40) => `<img src="${IMGP}${R.decorArt(k)}.png?v=1" alt="" style="max-width:${px}px;max-height:${px}px;image-rendering:pixelated" loading="lazy">`;
  const TIX = `<img src="${IMGP}items/tickets.png?v=1" alt="tickets" style="width:15px;height:15px;image-rendering:pixelated;vertical-align:-3px">`;

  function css() {
    if (document.getElementById("esDecorCss")) return; const st = document.createElement("style"); st.id = "esDecorCss";
    st.textContent = `.dc-tabs{display:flex;gap:6px;margin-bottom:8px}.dc-tabs button{flex:1}
.dc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;max-height:min(56vh,430px);overflow:auto;padding:2px}
.dc-card{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px;border-radius:7px;background:rgba(0,0,0,.06);text-align:center}
/* (2026-09-27) the Collection podium: the newest piece, and free. A gold card that breathes, a ribbon, and it sits first so nobody misses it */
.dc-card.dc-new{position:relative;overflow:hidden;background:linear-gradient(160deg,#fff4c8,#f3d77e);box-shadow:0 0 0 2px #d4a017,0 0 14px rgba(255,196,40,.75);animation:dcNew 2.4s ease-in-out infinite}
.dc-card.dc-new .dc-blurb{color:#6a4a10;font-weight:800;line-height:1.2}
.dc-ribbon{position:absolute;top:8px;right:-30px;transform:rotate(35deg);padding:2px 32px;background:#c2185b;color:#fff;font:900 10.5px Lora,sans-serif;letter-spacing:.06em;box-shadow:0 2px 4px rgba(0,0,0,.3)}
@keyframes dcNew{0%,100%{box-shadow:0 0 0 2px #d4a017,0 0 10px rgba(255,196,40,.55)}50%{box-shadow:0 0 0 3px #ffd54a,0 0 22px rgba(255,196,40,.95)}}
@media (prefers-reduced-motion:reduce){.dc-card.dc-new{animation:none}}
.dc-card .dc-pic{height:56px;display:grid;place-items:center}.dc-card b{font-size:13.5px;line-height:1.15}.dc-card small{color:#6a5a40;font-weight:700}
.dc-card .dc-row{display:flex;gap:4px;flex-wrap:wrap;justify-content:center}.dc-card .lk-btn{padding:3px 9px;font-size:12.5px}
.dc-top{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:800}
.dcbar{position:absolute;left:50%;transform:translateX(-50%);bottom:58px;z-index:6;display:flex;gap:6px;align-items:center;max-width:calc(100% - 24px);padding:6px 8px;border-radius:10px;background:rgba(12,10,9,.88);box-shadow:0 0 0 2px #3a2e22,0 8px 24px rgba(0,0,0,.6);color:#f4ede5;font-weight:800;font-size:13px}
.dcbar[hidden]{display:none}.dcbar .dc-tray{display:flex;gap:4px;overflow-x:auto;max-width:56vw}
.dcbar button{display:grid;place-items:center;min-width:46px;height:46px;padding:2px 6px;border:2px solid #3a2e22;border-radius:7px;background:#1e1812;color:#f4ede5;font:inherit;cursor:pointer;position:relative;flex:none}
.dcbar button[aria-pressed="true"]{border-color:#f2c94c;background:#3a2c10}.dcbar button i{position:absolute;right:2px;bottom:0;font-style:normal;font-size:11px;color:#ffe27a}
.dcbar .dc-say{padding:0 6px;color:#aca298;font-weight:700;white-space:nowrap}`;
    document.head.append(st);
  }

  /* ---------------------------------------------------------------- the shop */
  function ensureWin() {
    if (win) return win; css();
    win = document.createElement("section"); win.className = "win"; win.id = "decorWin"; win.hidden = true; win.setAttribute("aria-label", "Yahsmeena's decor shop"); win.style.width = "min(680px,calc(100% - 28px))";
    win.innerHTML = `<div class="win-head"><b><img src="/v3/assets/img/glad/flat/ui/g_home.png?v=1" alt="" class="topi">Yahsmeena's Decor</b><small>All for show. Yours to keep.</small><button type="button" class="win-x" aria-label="Close">×</button></div><div class="win-body" id="decorBody"></div>`;
    $("jukeWin").parentElement.append(win); win.querySelector(".win-x").addEventListener("click", () => { SFX.play("ui_close"); win.hidden = true; });
    return win;
  }
  function renderShop() {
    if (!win || win.hidden) return; const I = isle(), have = tix();
    const used = (p) => R.decorCount(I, p), cap = (p) => R.decorCap(I, p);
    $("decorBody").innerHTML = `<div class="dc-top"><span>${TIX} ${have.toLocaleString()} tickets</span><span>Outside ${Math.ceil(used("isle"))}/${cap("isle")} · Cottage ${Math.ceil(used("home"))}/${cap("home")} placed</span></div>
      <div class="dc-tabs">${[["isle", "🏝️ Outside"], ["home", "🏠 Cottage"]].map(([k, l]) => `<button type="button" class="lk-btn" data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</div>
      <div class="dc-grid">${Object.entries(D).filter(([k, P]) => P.in === tab).sort(([, a], [, b]) => (b.farm ? 2 : b.store ? 1 : 0) - (a.farm ? 2 : a.store ? 1 : 0))   /* (2026-09-30, the owner: "move chicken coop, cow pen and fishing cage to the top") */.map(([k, P]) => {   /* (2026-09-30, the owner: "are the new store decor items in Yahsmeenas NPC menu as well?") the Store's pieces are listed here too, first, with a button to the Store */ const own = I.owned?.[k] | 0, spare = R.decorSpare(I, k), maxed = P.max && own >= P.max;
        return `<div class="dc-card${P.isNew || P.store || P.farm ? " dc-new" : ""}">${P.isNew ? `<span class="dc-ribbon">NEW · FREE</span>` : P.farm ? `<span class="dc-ribbon">NEW · FILLS UP</span>` : P.store ? `<span class="dc-ribbon">STORE</span>` : ""}<div class="dc-pic">${img(k, 56)}</div><b>${esc(P.name)}</b>${P.blurb ? `<small class="dc-blurb">${esc(P.blurb)}</small>` : ""}<small>${P.w}×${P.h}${P.flat ? " · lies flat" : ""}${P.wall ? " · back wall" : ""}${own ? ` · you own ${own}` : ""}</small>
          <div class="dc-row">${P.store ? `<button type="button" class="lk-btn" data-store="1">In the Store · ${P.price.toLocaleString()}</button>` : `<button type="button" class="lk-btn" data-buy="${k}"${have < P.price || maxed ? " disabled" : ""}>${maxed ? "Got it" : P.price ? `Buy · ${P.price.toLocaleString()}` : "Take one · free"}</button>`}${spare > 0 && P.price ? `<button type="button" class="lk-btn" data-sell="${k}" title="She buys it back for a quarter">Sell · ${Math.floor(P.price * R.DECOR_SELLBACK).toLocaleString()}</button>` : ""}</div></div>`; }).join("")}</div>
      <div class="jk-msg">Bought something? Close this and press <b>Decorate</b> (bottom right)${tab === "home" ? ", inside your cottage" : ""}. Pick a piece, click a tile.</div>`;
    const B = $("decorBody");
    B.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.t; SFX.play("ui_click"); renderShop(); }));
    B.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => { SFX.play("coins"); send({ t: "decor", op: "buy", k: b.dataset.buy }); }));
    B.querySelectorAll("[data-sell]").forEach((b) => b.addEventListener("click", () => send({ t: "decor", op: "sell", k: b.dataset.sell })));
    B.querySelectorAll("[data-store]").forEach((b) => b.addEventListener("click", () => { SFX.play("ui_click"); win.hidden = true; env.openStore?.("decor"); }));
  }
  function shop() { ensureWin(); tab = placeHere() === "home" ? "home" : "isle"; win.hidden = false; SFX.play("ui_open"); renderShop(); }

  /* ---------------------------------------------------------------- decorate mode */
  function ensureBar() {
    if (bar) return bar; css(); bar = document.createElement("div"); bar.className = "dcbar"; bar.hidden = true; env.host().append(bar); return bar;
  }
  function renderBar() {
    if (!bar) return; bar.hidden = !on; if (!on) return;
    const I = isle(), place = placeHere(), mine = Object.keys(I.owned || {}).filter((k) => D[k] && D[k].in === place && R.decorSpare(I, k) > 0);
    if (pick && !mine.includes(pick)) pick = null; if (!pick && tool === "place") pick = mine[0] || null;
    bar.innerHTML = `<button type="button" data-tool="take" aria-pressed="${tool === "take"}" title="Pick a piece back up">✋</button><div class="dc-tray">${mine.map((k) => `<button type="button" data-k="${k}" aria-pressed="${tool === "place" && pick === k}" title="${esc(D[k].name)}">${img(k, 34)}<i>${R.decorSpare(I, k)}</i></button>`).join("")}</div>
      <span class="dc-say">${tool === "take" ? "Click a piece to pick it up" : pick ? `${esc(D[pick].name)}: click a tile` : place === "home" ? "Nothing spare for the cottage" : "Nothing spare for outside"}</span><button type="button" data-done title="Finish decorating (Esc)">Done</button>`;
    bar.querySelectorAll("[data-k]").forEach((b) => b.addEventListener("click", () => { tool = "place"; pick = b.dataset.k; SFX.play("ui_click"); renderBar(); }));
    bar.querySelector("[data-tool]").addEventListener("click", () => { tool = tool === "take" ? "place" : "take"; SFX.play("ui_click"); renderBar(); });
    bar.querySelector("[data-done]").addEventListener("click", () => toggle(false));
  }
  function toggle(to = !on) { on = !!to && mineHere(); tool = "place"; ensureBar(); renderBar(); if (on) SFX.play("ui_open"); env.onMode?.(on); return on; }
  const anchor = (tx, ty) => (pick ? { x: tx, y: ty - (D[pick].h - 1) } : null);   // the tile you click is the piece's bottom-left
  function ghost(tx, ty) {
    if (!on || tool !== "place" || !pick) return null; const a = anchor(tx, ty), P = D[pick];
    return { x: a.x, y: a.y, w: P.w, h: P.h, ok: !R.decorFits(env.key(), isle(), pick, a.x, a.y) };
  }
  function click(tx, ty) {
    if (!on) return false;
    if (tool === "take") { send({ t: "decor", op: "take", x: tx, y: ty }); SFX.play("drop"); return true; }
    if (!pick) return true; const a = anchor(tx, ty), why = R.decorFits(env.key(), isle(), pick, a.x, a.y);
    if (why) { env.say(why, "bad"); SFX.play("ui_error"); return true; }
    send({ t: "decor", op: "place", k: pick, x: a.x, y: a.y }); SFX.play("equip"); return true;
  }
  /** the page calls this when `me` changes (a purchase landed, a piece went down) and when the scene changes */
  function refresh() { if (on && !mineHere()) on = false; renderShop(); renderBar(); }
  return { shop, toggle, click, ghost, refresh, get on() { return on; } };
}
