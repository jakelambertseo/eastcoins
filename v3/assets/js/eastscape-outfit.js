/* EASTSCAPE: THE OUTFITTERS (2026-09-29), the page's half; the server's is eastscape-worker/src/outfit.js, the rules OUTFIT at the end of the
   rules file. Wren the Ranger (Cloudreach) and Morwenna the Mage (the Thunderhead), each with a plain kit window: three tabs, Armour (their
   style's five-piece sets, by level), Weapons (the bows and quivers, or the wands and Magic Bags, expensive on purpose) and Sell (what in your
   bag they will buy back, at Bom's rate). Every number on it is read from the rules, so the window and the server cannot disagree. */
export function createOutfit(E) {
  const { G, $, esc, send, SFX, ico, openWin } = E;
  const UIA = "/v3/assets/img/glad/flat/ui/", FACE = { ranger: "wren_face", mage: "morwenna_face" };
  let win = null, shop = "ranger", tab = "armour", note = "";
  const pct = (x) => `${Math.round(x * 1000) / 10}%`;
  const skillName = (s) => G.SKILLS[s]?.name || s;
  function frame() {
    const w = document.createElement("section"); w.className = "win k-win of-win"; w.id = "outfitWin"; w.hidden = true; w.setAttribute("aria-label", "Outfitter");
    w.innerHTML = `<div class="k-head"><img class="of-face" alt=""><b class="of-name"></b><span class="k-sub of-sub"></span><button type="button" class="k-x" aria-label="Close">×</button></div>
      <div class="k-tabs of-tabs" role="tablist"></div><div class="k-body k-paper of-body"></div><div class="k-foot of-foot"></div>`;
    ($("jukeWin")?.parentElement || document.querySelector(".game") || document.body).append(w);
    w.querySelector(".k-x").addEventListener("click", () => { SFX.play("ui_close"); w.hidden = true; });
    w.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tab]"); if (t) { tab = t.dataset.tab; note = ""; SFX.play("ui_click"); return render(); }
      const b = e.target.closest("button[data-op]"); if (!b || b.disabled) return; SFX.play("ui_click");
      send(b.dataset.op === "buy" ? { t: "outfit", shop, op: "buy", k: b.dataset.k } : { t: "outfit", shop, op: "sell", i: +b.dataset.i });
    });
    return w;
  }
  const statsOf = (k) => {
    const it = G.ITEMS[k] || {}, out = [];
    if (it.def) out.push(`Def ${it.def}`);
    for (const [s, v] of Object.entries(it.sdmg || {})) out.push(`+${pct(v)} ${skillName(s)} dmg`);
    if (it.spd) out.push(`+${it.spd}% speed`);
    if (it.acc) out.push(`Acc ${it.acc}`); if (it.str) out.push(`Str ${it.str}`);
    if (it.launcher?.range) out.push(`reach ${it.launcher.range}`);
    if (it.pouch) out.push(`holds ${it.pouch.cap.toLocaleString()}`);
    return out.join(" · ");
  };
  function render() {
    if (!win || win.hidden) return;
    const me = E.me || { inv: [], xp: {} }, tix = G.tixIn(me), style = G.OUTFIT.style[shop], who = G.OUTFIT.npc[shop];
    win.querySelector(".of-face").src = `${UIA}${FACE[shop]}.png?v=1`;
    win.querySelector(".of-name").textContent = who;
    win.querySelector(".of-sub").textContent = `You have ${G.fmtTix(tix)}`;
    const tabs = [["armour", style === "archery" ? "Leathers" : "Robes"], ["weapon", style === "archery" ? "Bows & quivers" : "Wands & bags"], ["sell", "Sell"]];
    win.querySelector(".of-tabs").innerHTML = tabs.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" class="k-tab${tab === k ? " on" : ""}" aria-selected="${tab === k}">${l}</button>`).join("");
    let rows;
    if (tab === "sell") {
      const mine = (me.inv || []).map((s, i) => ({ s, i })).filter(({ s }) => G.outfitBuys(shop, s.k));
      rows = mine.length ? mine.map(({ s, i }) => { const f = G.fCode(s), pay = G.gearSell(s.k, f);
        return `<div class="k-row of-row"><span class="k-slot">${ico(s.k)}</span><span><b>${esc(G.forgeNameAt(s.k, f))}</b><small>${esc(statsOf(s.k))}</small></span><span class="of-price">${G.fmtTix(pay)}</span><span class="k-end"><button type="button" class="k-btn sec sm" data-op="sell" data-i="${i}">Sell</button></span></div>`; }).join("")
        : `<p class="of-none">Nothing in your bag ${who.split(" ")[0]} buys. ${style === "archery" ? "Leathers, bows and quivers" : "Robes, wands and Magic Bags"} only.</p>`;
    } else {
      rows = G.outfitShelf(shop).filter((r) => r.kind === tab).map((r) => {
        const it = G.ITEMS[r.k], need = it.req, lvl = need ? G.lvlOf(me, need.skill) : 99, low = need && lvl < need.lvl;
        return `<div class="k-row of-row${low ? " low" : ""}"><span class="k-slot" data-item="${r.k}">${ico(r.k)}</span><span><b>${esc(it.name)}</b><small>${esc(statsOf(r.k))}${need ? ` · <em class="${low ? "no" : "ok"}">${skillName(need.skill)} ${need.lvl}</em>` : ""}</small></span><span class="of-price">${G.fmtTix(r.price)}</span><span class="k-end"><button type="button" class="k-btn sm" data-op="buy" data-k="${r.k}"${tix < r.price ? " disabled" : ""}>Buy</button></span></div>`;
      }).join("");
    }
    win.querySelector(".of-body").innerHTML = rows + (note ? `<p class="of-note">${esc(note)}</p>` : "");
    win.querySelector(".of-foot").innerHTML = `<span class="k-note">${tab === "armour" ? `A full set: +10% ${skillName(style)} damage${style === "archery" ? " and 6% faster on your feet" : ""}, at half the defence of plate. The bonus only counts while you fight with ${style === "archery" ? "a bow" : "a wand"}.` : tab === "weapon" ? `Made ones are far cheaper: ${style === "archery" ? "Fletching, at the table in the north court" : "Wizardry, at the Arcane altar"}.` : `${who.split(" ")[0]} pays what Bom would: an eighth of the shelf price, ${G.fmtTix(G.GEAR_SELL_MAX)} at most.`}</span>`;
  }
  return {
    open(s) { shop = s === "mage" ? "mage" : "ranger"; tab = "armour"; note = ""; win ||= frame(); openWin("outfitWin"); render(); },
    got(e) { note = e.err || ""; if (e.bought || e.sold) SFX.play("coins"); if (e.err) SFX.play("ui_error"); render(); },
    render,
  };
}

export const CSS = `
/* ---------- (2026-09-29) THE OUTFITTERS: Wren and Morwenna's windows, in the kit ---------- */
.of-win{width:min(600px,calc(100% - 20px))}.of-body{max-height:min(58vh,520px);overflow:auto}
.of-face{width:40px;height:40px;image-rendering:pixelated;border-radius:6px}
.of-tabs{display:flex;gap:6px;padding:6px 12px 0}
.of-row{grid-template-columns:auto 1fr auto auto}.of-row small em{font-style:normal;font-weight:800}.of-row small em.no{color:#b3261a}.of-row small em.ok{color:#46703f}
.of-row.low{opacity:.8}.of-price{font:900 14px Cinzel,serif;color:#7a5410;white-space:nowrap}
.of-none,.of-note{margin:8px 0;font-size:13px}.of-note{color:#b3261a}
`;
