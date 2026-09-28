/* ============================================================
   EastScape: the bag's menu and arranging (favourite, use, move to another slot; drag a tile to a slot), moved out of eastscape.html on
   2026-09-27 so the first load stays inside its budget. The page hands in what it has (createBagUi(env)); the handlers below are the
   page's own, delegated on document, unchanged but for `me`, which is read through the page every time because each snapshot replaces it.
   ============================================================ */
export function createBagUi(E) {
  const { G, $, esc, ico, send, say, SFX, ITEMS, useBagItem, renderPanel } = E;
  const st = document.createElement("style"); st.textContent = CSS; document.head.append(st);
  /* (2026-09-27) THE BAG'S OWN MENU: right-click, or hold on a touch screen, an item in your inventory for Favourite, Use and its wiki page.
     Everywhere else a right-click on an item still opens the wiki. */
  let bagMenuEl = null;
  const closeBagMenu = () => { if (bagMenuEl) { bagMenuEl.remove(); bagMenuEl = null; } };
  function bagMenu(x, y, i) {
    closeBagMenu(); const s = E.me?.inv?.[i]; if (!s || !ITEMS[s.k]) return; const it = ITEMS[s.k], fav = E.me.fav?.includes(s.k);
    const use = it.raw ? "" : it.heal ? "Eat" : it.drink ? "Drink" : it.slot ? "Wear" : it.ammo ? "Load" : it.use || it.luck ? "Use" : "";
    bagMenuEl = document.createElement("div"); bagMenuEl.className = "bagmenu"; bagMenuEl.setAttribute("role", "menu");
    /* (2026-09-27, the owner: "right clicking anything in the bag could show Used in X, Y") what it goes into, from the rules (G.usesOf), the
       first few by name and a count for the rest; and, for anything the Prize Counter buys, what Bom pays. The wiki has the full story. */
    const uses = G.usesOf ? G.usesOf(s.k) : [], MAXU = 4, loot = G.isLoot?.(s.k) ? G.valueOf(s.k) : 0;
    const usedIn = s.k === "tickets" ? "" : `<div class="bagmenu-u">${uses.length ? `<b>Used in</b>${uses.slice(0, MAXU).map((u) => `<span>${esc(u.what)}<small>${esc(u.how)}</small></span>`).join("")}${uses.length > MAXU ? `<em>+${uses.length - MAXU} more on its wiki page</em>` : ""}` : `<b>Used in</b><em>${it.slot ? "Nothing: it's worn." : it.heal ? "Nothing: it's food." : "Nothing yet."}</em>`}${loot ? `<em class="bagmenu-bom">Bom pays ${loot.toLocaleString()} tickets</em>` : ""}</div>`;
    bagMenuEl.innerHTML = `<div class="bagmenu-h">${ico(s.k)}<b>${esc(G.forgeNameAt(s.k, G.fOf(s)))}</b></div>${usedIn}${s.k === "tickets" ? "" : `<button type="button" data-fav="1">${fav ? "\u2606 Unfavourite" : "\u2605 Favourite"}</button>`}${use ? `<button type="button" data-use="1">${use}</button>` : ""}<button type="button" data-move="1">Move to another slot\u2026</button><button type="button" data-wiki="1">Wiki page</button>`;
    document.body.append(bagMenuEl);
    const W = bagMenuEl.offsetWidth, H = bagMenuEl.offsetHeight; bagMenuEl.style.left = `${Math.max(4, Math.min(x, innerWidth - W - 8))}px`; bagMenuEl.style.top = `${Math.max(4, Math.min(y, innerHeight - H - 8))}px`;
    bagMenuEl.addEventListener("click", (ev) => { const b = ev.target.closest("button"); if (!b) return; ev.stopPropagation(); closeBagMenu();
      if (b.dataset.fav) send({ t: "fav", k: s.k }); else if (b.dataset.use) useBagItem(i); else if (b.dataset.move) startInvMove(i); else { E.wikiGo(`items/${s.k}`); } });
  }
  /* (2026-09-27, the owner: "allow users to move around items in their own inventory ... drag an item in my first slot to my last slot")
     ARRANGING THE BAG. With a mouse, drag a tile onto another: the two swap; onto an empty slot: it goes to the end. On a phone a drag would
     fight the page's scrolling, so the hold menu has "Move to another slot": the tile lifts, and the next tap on any slot is where it goes.
     The server does the move (the "inv" message), so the order is saved with the character and survives a reload. */
  let invDrag = -1, invMoveFrom = -1;
  const invMove = (from, to) => { if (from < 0 || to < 0) return; send({ t: "inv", op: "move", from, to }); SFX.play("ui_click");
    /* the same move applied here at once, so the bag answers the drop before the server's copy arrives */
    if (E.me?.inv?.[from]) { G.settleSlots(E.me); const lay = G.invLayout(E.me), cur = lay.indexOf(from), j = lay[to]; if (j !== from) { E.me.inv[from].p = to; if (j >= 0) E.me.inv[j].p = cur; renderPanel(); } } };
  function startInvMove(i) { invMoveFrom = i; document.querySelector(".inv")?.classList.add("moving"); document.querySelector(`.inv [data-i="${i}"]`)?.classList.add("lifted"); say("Tap the slot to move it to. Tap anywhere else to leave it.", "sys"); }
  function endInvMove() { invMoveFrom = -1; document.querySelector(".inv")?.classList.remove("moving"); document.querySelectorAll(".inv .lifted, .inv .over").forEach((el) => el.classList.remove("lifted", "over")); }
  document.addEventListener("dragstart", (e) => { const el = e.target.closest?.(".inv [data-i]"); if (!el) return; invDrag = +el.dataset.i; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", el.dataset.i); el.classList.add("dragging"); el.closest(".inv")?.classList.add("dragon"); });
  document.addEventListener("dragover", (e) => { if (invDrag < 0) return; const el = e.target.closest?.(".inv [data-to]"); if (!el) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (!el.classList.contains("over")) { document.querySelectorAll(".inv .over").forEach((x) => x.classList.remove("over")); el.classList.add("over"); } });
  document.addEventListener("drop", (e) => { if (invDrag < 0) return; const el = e.target.closest?.(".inv [data-to]"); if (!el) return;
    e.preventDefault(); invMove(invDrag, +el.dataset.to); invDrag = -1; document.querySelectorAll(".inv .over, .inv .dragging").forEach((x) => x.classList.remove("over", "dragging")); document.querySelector(".inv")?.classList.remove("dragon"); });
  document.addEventListener("dragend", () => { invDrag = -1; document.querySelectorAll(".inv .over, .inv .dragging").forEach((x) => x.classList.remove("over", "dragging")); document.querySelector(".inv")?.classList.remove("dragon"); });
  document.addEventListener("click", (e) => { if (invMoveFrom < 0) return; const el = e.target.closest?.(".inv [data-to]"); if (el) { e.stopImmediatePropagation(); e.preventDefault(); invMove(invMoveFrom, +el.dataset.to); } endInvMove(); }, true);
  document.addEventListener("click", closeBagMenu, true); document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeBagMenu(); });
  { let hold = 0, held = false, sx = 0, sy = 0;   /* a hold on a touch screen is the right-click */
    document.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") return; const el = e.target.closest?.(".inv [data-i]"); if (!el) return; sx = e.clientX; sy = e.clientY; held = false; clearTimeout(hold); hold = setTimeout(() => { held = true; bagMenu(sx, sy, +el.dataset.i); }, 450); });
    document.addEventListener("pointermove", (e) => { if (hold && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) clearTimeout(hold); });
    document.addEventListener("pointerup", () => clearTimeout(hold)); document.addEventListener("pointercancel", () => clearTimeout(hold));
    document.addEventListener("click", (e) => { if (held && e.target.closest?.(".inv [data-i]")) { held = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true); }
  return { menu: bagMenu, move: invMove, startMove: startInvMove };
}
const CSS = `.inv .slot.dragging{opacity:.4}.inv .slot.over{outline:3px dashed #c8963a;outline-offset:-4px}.inv.moving .slot.empty{outline:2px dashed rgba(200,150,58,.6);outline-offset:-4px}.inv .slot.lifted{outline:3px solid #ffd45a;outline-offset:-4px;transform:scale(1.06)}.inv.moving .slot:not(.lifted){cursor:copy;box-shadow:inset 0 0 0 2px rgba(200,150,58,.45)}
.bagmenu{position:fixed;z-index:1000;min-width:180px;padding:4px;border-radius:10px;background:#fffaf0;color:#2a2016;box-shadow:0 8px 24px rgba(0,0,0,.35),0 0 0 1px #c8b48a}
.bagmenu-u{padding:2px 9px 6px;margin-bottom:3px;border-bottom:1px solid rgba(0,0,0,.1);font-size:12px;max-width:260px}.bagmenu-u b{display:block;font:900 11px Lora,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#8a6a3a;margin-bottom:2px}
.bagmenu-u span{display:flex;justify-content:space-between;gap:8px;font-weight:800;line-height:1.35}.bagmenu-u span small{font-weight:700;color:#8a7a5a;white-space:nowrap}.bagmenu-u em{display:block;font-style:normal;color:#8a7a5a;font-weight:700}.bagmenu-u .bagmenu-bom{color:#2e7d43;margin-top:2px}
.bagmenu-h{display:flex;align-items:center;gap:6px;padding:6px 8px 4px;font-size:12.5px;border-bottom:1px solid rgba(0,0,0,.1);margin-bottom:3px}.bagmenu-h .ico{width:20px;height:20px}
.bagmenu button{display:block;width:100%;padding:7px 10px;border:0;border-radius:6px;background:none;text-align:left;font:800 13px Lora,sans-serif;color:#2a2016;cursor:pointer}.bagmenu button:hover{background:rgba(200,150,58,.22)}
@media (max-width:820px){.bagmenu button{padding:10px 12px;font-size:14px}}`;
