/* EASTSCAPE: GEMS (2026-09-28, rebuilt 2026-09-29), the page's half; the server's is eastscape-worker/src/gems.js.

   THE GEM BAG. The owner: "small bag that pops open beside inventory - contains 4 combat gems, 4 skilling gems", with a screenshot of
   where: the top of the game view, just right of the inventory. A little leather pouch, not a window: two rows of four settings, Combat
   and Skilling. An open empty setting, clicked, shows the sorted gems in your bag that fit it; a filled one offers to take the gem out
   (it keeps its roll, since 2026-09-30; it still asks); the next locked one offers itself for its price. What the bag is doing for you is written
   underneath. Opened from the inventory's Gems button.

   THE GEM SORTER. The owner, on the first build's casino cabinet: "its over done". So this is a plain kit window at the bench in the
   Yard: every gem in your bag, one row each, its roll and band, and two buttons, Sort and Sell. The roll lands with a short flicker
   of numbers, and a Perfect gets the room's fanfare; nothing else moves. */
export function createGems(E) {
  const { G, $, esc, send, SFX, ico, openWin } = E, S_ = G.GEMSET, calm = () => !!E.calm?.();
  const UIA = "/v3/assets/img/glad/flat/ui/";
  let v = null, bagEl = null, pick = null, ask = null, note = "", sorter = null, flick = null;
  const pct = (r) => `${r > 0 ? "+" : ""}${r}%`;
  const bandCls = (r) => (r == null ? "raw" : G.gemBand(r).toLowerCase());
  const nm = (k) => G.ITEMS[k]?.name || k;
  const bagGems = () => (E.me?.inv || []).map((s, i) => ({ s, i })).filter(({ s }) => G.isGem(s.k));
  const short = (n) => (n >= 1000000 ? `${n / 1000000}M` : n >= 1000 ? `${n / 1000}k` : String(n));

  /* ================================================================ THE GEM BAG */
  function place() {
    if (!bagEl) return;
    const inv = document.querySelector(".inv") || document.querySelector(".side"), side = document.querySelector(".side");
    const r = (side || inv)?.getBoundingClientRect(), top = (inv || side)?.getBoundingClientRect().top ?? 60;
    if (!r || innerWidth <= 820 || r.width < 40) { bagEl.style.left = "50%"; bagEl.style.top = "64px"; bagEl.style.transform = "translateX(-50%)"; return; }
    bagEl.style.transform = ""; bagEl.style.left = `${Math.round(r.right + 8)}px`; bagEl.style.top = `${Math.round(Math.max(48, top - 6))}px`;
  }
  function renderBag() {
    if (!bagEl || bagEl.hidden) return;
    const b = v?.bag || G.bagOf(E.me), B = S_.bag, next = v?.next || { c: G.bagPrice(E.me, "c"), s: G.bagPrice(E.me, "s") };
    const row = (side, title) => {
      const list = b[side], open = list.length;
      const cells = Array.from({ length: B.max }, (_, i) => {
        if (i >= open) { const first = i === open, price = first ? next[side] : null;
          return `<button type="button" class="gb-set lock${first ? " next" : ""}" data-lock="${side}"${first ? "" : " disabled"} title="${first ? `Open this slot: ${G.fmtTix(price)}` : "Open the one before it first"}"><i class="gb-padlock"></i>${first ? `<em>${short(price)}</em>` : ""}</button>`; }
        const g = list[i], on = pick && pick.side === side && pick.slot === i, asking = ask && ask.side === side && ask.slot === i;
        return g ? `<button type="button" class="gb-set full ${bandCls(g.roll)}${asking ? " on" : ""}" data-take="${side}:${i}" title="${esc(`${G.gemText(g.k, g.roll)}: ${G.GEM_OF[g.k].does}. Click to take it out.`)}">${ico(g.k)}<b>${pct(g.roll)}</b></button>`
          : `<button type="button" class="gb-set empty${on ? " on" : ""}" data-put="${side}:${i}" title="An empty ${title.toLowerCase()} setting: click to choose a gem"></button>`;
      }).join("");
      return `<div class="gb-row"><div class="gb-rowh"><b>${title}</b><small>${list.filter(Boolean).length}/${open} set</small></div><div class="gb-sets">${cells}</div></div>`;
    };
    let under = "";
    if (pick) {
      const fits = bagGems().filter(({ s }) => G.gemSide(s.k) === pick.side && G.rollOf(s) != null);
      under = `<div class="gb-pick"><small>${fits.length ? "Choose a gem for that setting" : `No sorted ${pick.side === "c" ? "combat" : "skilling"} gems in your bag. The Gem Sorter in the Yard rolls them.`}</small>
        <div class="gb-pickl">${fits.map(({ s, i }) => { const r = G.rollOf(s); return `<button type="button" class="gb-gem ${bandCls(r)}" data-gem="${i}" title="${esc(`${G.gemText(s.k, r)}: ${G.GEM_OF[s.k].does}`)}">${ico(s.k)}<b>${pct(r)}</b></button>`; }).join("")}</div>
        <button type="button" class="gb-link" data-cancel="1">Cancel</button></div>`;
    } else if (ask) {
      const g = ask.lock ? null : b[ask.side][ask.slot];
      under = ask.lock
        ? `<div class="gb-ask"><span>Open a new ${ask.side === "c" ? "combat" : "skilling"} setting for <b>${G.fmtTix(next[ask.side])}</b>?</span><div><button type="button" class="gb-btn" data-yes="1">Open it</button><button type="button" class="gb-link" data-cancel="1">Not now</button></div></div>`
        : `<div class="gb-ask"><span>Take out the <b>${esc(G.gemText(g.k, g.roll))}</b>? It keeps its roll.</span><div><button type="button" class="gb-btn" data-yes="1">Take it out</button><button type="button" class="gb-link" data-cancel="1">Keep it</button></div></div>`;
    }
    const bonus = Object.entries(v?.bonus || G.gemBonus(E.me)).filter(([, r]) => r);
    const working = bonus.length ? bonus.map(([k, r]) => `<span class="${r < 0 ? "neg" : ""}">${ico(k)} ${pct(r)} ${esc(G.GEM_OF[k].does)}</span>`).join("") : `<span class="gb-none">Nothing yet. Sort a gem at the bench in the Yard, then set it here.</span>`;
    bagEl.querySelector(".gb-body").innerHTML = `${row("c", "Combat")}${row("s", "Skilling")}${under}${note ? `<p class="gb-note">${esc(note)}</p>` : ""}
      <div class="gb-work"><small>Working for you now · the best ${S_.perType} of each gem count</small>${working}</div>`;
    place();
  }
  function bagFrame() {
    const w = document.createElement("section"); w.className = "gb"; w.id = "gemBag"; w.hidden = true; w.setAttribute("aria-label", "Gem bag");
    w.innerHTML = `<div class="gb-head"><img src="${UIA}gem_pouch.png?v=1" alt=""><b>Gem Bag</b><button type="button" class="gb-x" aria-label="Close">×</button></div><div class="gb-body"></div>`;
    document.body.append(w);
    w.querySelector(".gb-x").addEventListener("click", () => { SFX.play("ui_close"); w.hidden = true; pick = ask = null; note = ""; });
    w.addEventListener("click", (e) => {
      const t = e.target.closest("button"); if (!t || t.disabled) return;
      if (t.dataset.put) { const [side, slot] = t.dataset.put.split(":"); pick = pick && pick.side === side && pick.slot === +slot ? null : { side, slot: +slot }; ask = null; note = ""; SFX.play("ui_click"); return renderBag(); }
      if (t.dataset.take) { const [side, slot] = t.dataset.take.split(":"); ask = { side, slot: +slot }; pick = null; note = ""; SFX.play("ui_click"); return renderBag(); }
      if (t.dataset.lock) { ask = { side: t.dataset.lock, lock: true }; pick = null; note = ""; SFX.play("ui_click"); return renderBag(); }
      if (t.dataset.gem != null && pick) { send({ t: "gems", op: "put", side: pick.side, slot: pick.slot, i: +t.dataset.gem }); pick = null; return; }
      if (t.dataset.yes && ask) { send(ask.lock ? { t: "gems", op: "open", side: ask.side } : { t: "gems", op: "take", side: ask.side, slot: ask.slot }); ask = null; return; }
      if (t.dataset.cancel) { pick = ask = null; SFX.play("ui_click"); return renderBag(); }
    });
    addEventListener("resize", place);
    return w;
  }

  /* ================================================================ THE GEM SORTER */
  function sortFrame() {
    const w = document.createElement("section"); w.className = "win k-win gx-win"; w.id = "gemWin"; w.hidden = true; w.setAttribute("aria-label", "The Gem Sorter");
    w.innerHTML = `<div class="k-head"><img src="${UIA}g_gems.png?v=1" alt=""><b>The Gem Sorter</b><span class="k-sub gx-sub"></span><button type="button" class="k-x" aria-label="Close">×</button></div><div class="k-body k-paper gx-body"></div><div class="k-foot gx-foot"></div>`;
    ($("jukeWin")?.parentElement || document.querySelector(".game") || document.body).append(w);
    w.querySelector(".k-x").addEventListener("click", () => { SFX.play("ui_close"); w.hidden = true; });
    w.addEventListener("click", (e) => { const t = e.target.closest("button[data-op]"); if (!t || t.disabled) return; SFX.play("ui_click"); send({ t: "gems", op: t.dataset.op, i: +t.dataset.i }); });
    return w;
  }
  function renderSorter() {
    if (!sorter || sorter.hidden) return;
    const cost = v?.cost ?? S_.cost, sell = v?.sell ?? S_.sell, tix = G.tixIn(E.me), gems = bagGems();
    /* (2026-09-30) the Store's loupes: how many lifted rolls you hold, and the odds they give, in the header and the foot */
    const lk = G.loupeOf?.(E.me, "loupe2") ? "loupe2" : G.loupeOf?.(E.me, "loupe") ? "loupe" : null;
    sorter.querySelector(".gx-sub").textContent = `Sort ${G.fmtTix(cost)} · Sell ${G.fmtTix(sell)}${lk ? ` · ${G.STORE[lk].name}: ${G.loupeOf(E.me, lk)} rolls` : ""}`;
    sorter.querySelector(".gx-body").innerHTML = gems.length ? gems.map(({ s, i }) => {
      const r = G.rollOf(s), side = G.gemSide(s.k), f = flick && flick.k === s.k && flick.i === i ? flick : null, shown = f ? f.show : r;
      return `<div class="k-row gx-row ${bandCls(shown)}${f ? " rolling" : ""}"><span class="k-slot">${ico(s.k)}${s.n > 1 ? `<u>×${s.n}</u>` : ""}</span>
        <span><b>${esc(nm(s.k))}</b><small>${side === "c" ? "Combat" : "Skilling"} · ${esc(G.GEM_OF[s.k].does)}</small></span>
        <span class="gx-roll"><strong>${shown == null ? "Unsorted" : pct(shown)}</strong><small>${shown == null ? "" : G.gemBand(shown)}</small></span>
        <span class="k-end"><button type="button" class="k-btn sm" data-op="sort" data-i="${i}"${tix < cost || f ? " disabled" : ""}>${r == null ? "Sort" : "Re-roll"}</button><button type="button" class="k-btn sec sm" data-op="sell" data-i="${i}"${f ? " disabled" : ""}>Sell</button></span></div>`;
    }).join("") : `<p class="gx-none">No gems in your bag. Every skill turns one up now and then from level ${S_.dropLvl}, and so do monsters of that level.</p>`;
    const odds = (lo, hi) => { let p = 0; for (let r = lo; r <= hi; r++) p += lk ? G.gemOddsLoupe(lk, r) : G.gemOdds(r); p *= 100; return p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`; };
    sorter.querySelector(".gx-foot").innerHTML = `<span class="k-note">${G.GEM_BANDS.map(([n, lo, hi]) => `<b class="${n.toLowerCase()}">${n}</b> ${lo === hi ? pct(lo) : `${pct(lo)} to ${pct(hi)}`} (${odds(lo, hi)})`).join(" · ")}. The higher the roll, the rarer it is.</span>`;
  }
  /* the roll lands with a short flicker of numbers (skipped under reduced motion) */
  function landRoll(k, roll) {
    const i = bagGems().find(({ s }) => s.k === k && G.rollOf(s) === roll)?.i ?? -1;
    if (calm() || i < 0) return renderSorter();
    const [lo, hi] = S_.roll, t0 = performance.now();
    const tick = () => { const age = performance.now() - t0; if (age > 650) { flick = null; renderSorter(); if (roll >= hi) E.winFx?.(`${nm(k)} ${pct(roll)}`, "", "PERFECT!"); return; }
      flick = { k, i, show: lo + Math.floor(Math.random() * (hi - lo + 1)) }; renderSorter(); setTimeout(tick, 60); };
    tick();
  }

  return {
    openBag() { bagEl ||= bagFrame(); bagEl.hidden = false; pick = ask = null; note = ""; send({ t: "gems", op: "view" }); renderBag(); SFX.play("ui_open"); },
    toggleBag() { if (bagEl && !bagEl.hidden) { bagEl.hidden = true; SFX.play("ui_close"); } else this.openBag(); },
    openSorter() { sorter ||= sortFrame(); openWin("gemWin"); send({ t: "gems", op: "view" }); renderSorter(); },
    got(e) {
      v = e.view || v;
      if (e.open === "sorter") this.openSorter();
      if (e.rolled) { SFX.play(e.rolled.roll >= S_.roll[1] ? "task_done" : "ui_click"); landRoll(e.rolled.k, e.rolled.roll); } else renderSorter();
      if (e.put || e.opened) { note = ""; SFX.play("task_done"); }
      renderBag();
    },
    oops(t) { note = t; SFX.play("ui_error"); renderBag(); },
    bag() { if (!flick) renderSorter(); renderBag(); },
  };
}

export const CSS = `
/* ---------- (2026-09-29) THE GEM BAG: a leather pouch beside the inventory ---------- */
.gb{position:fixed;z-index:60;width:246px;padding:0 0 10px;border-radius:14px;background:#5a3620 url(/v3/assets/img/glad/flat/ui/leather.png) 0 0/64px;box-shadow:inset 0 0 0 2px #2a170c,inset 0 0 0 5px rgba(0,0,0,.18),0 10px 24px rgba(0,0,0,.55);color:#f4e6c8;font-family:Lora,serif}
.gb::before{content:"";position:absolute;inset:6px;border:2px dashed rgba(240,210,150,.45);border-radius:10px;pointer-events:none}
.gb-head{position:relative;display:flex;align-items:center;gap:8px;padding:10px 12px 4px}.gb-head img{width:28px;height:28px;image-rendering:pixelated}.gb-head b{flex:1;font:800 16px Cinzel,serif;color:#ffe6a8;text-shadow:0 2px 0 #1a0c04}
.gb-x{border:0;background:none;color:#f4e6c8;font-size:20px;line-height:1;cursor:pointer;padding:0 4px}
.gb-body{position:relative;padding:0 14px}
.gb-row{margin-top:6px}.gb-rowh{display:flex;justify-content:space-between;align-items:baseline}.gb-rowh b{font:800 12px Cinzel,serif;letter-spacing:.08em;text-transform:uppercase;color:#f0c878}.gb-rowh small{font-size:11px;opacity:.75}
.gb-sets{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:4px}
.gb-set{position:relative;aspect-ratio:1;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;padding:0;background:radial-gradient(circle at 50% 45%,#3a0c18,#1c0610 70%);box-shadow:inset 0 0 0 3px #c8963a,inset 0 0 0 5px #6a4a18,inset 0 4px 8px rgba(0,0,0,.6),0 2px 0 rgba(0,0,0,.4)}
.gb-set img{width:26px;height:26px;image-rendering:pixelated;filter:drop-shadow(0 0 4px rgba(255,255,255,.35))}
.gb-set b{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);font:900 10px Lora,serif;padding:0 4px;border-radius:6px;background:#1a0c06;white-space:nowrap}
.gb-set.empty:hover,.gb-set.on{box-shadow:inset 0 0 0 3px #ffe27a,inset 0 0 0 5px #6a4a18,inset 0 4px 8px rgba(0,0,0,.6),0 0 10px rgba(255,210,80,.5)}
.gb-set.lock{background:#2a1a10;box-shadow:inset 0 0 0 3px #6a5a44,inset 0 4px 8px rgba(0,0,0,.6);cursor:default}.gb-set.lock.next{cursor:pointer;box-shadow:inset 0 0 0 3px #a8884a,inset 0 4px 8px rgba(0,0,0,.6)}.gb-set.lock.next:hover{box-shadow:inset 0 0 0 3px #ffe27a,0 0 10px rgba(255,210,80,.4)}
.gb-padlock{width:14px;height:12px;margin-top:6px;border-radius:2px;background:#8a7a5a;position:relative}.gb-padlock::before{content:"";position:absolute;left:3px;top:-7px;width:8px;height:8px;border:2px solid #8a7a5a;border-bottom:0;border-radius:5px 5px 0 0}
.gb-set.lock em{position:absolute;bottom:-7px;left:50%;transform:translateX(-50%);font:900 10px Lora,serif;font-style:normal;padding:0 4px;border-radius:6px;background:#e8bf35;color:#2a1600}
.gb-pick,.gb-ask{margin-top:14px;padding:8px;border-radius:8px;background:rgba(20,10,4,.45);box-shadow:inset 0 0 0 1px rgba(240,210,150,.3);font-size:12px}
.gb-pickl{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.gb-gem{position:relative;width:38px;height:38px;border:0;border-radius:8px;cursor:pointer;display:grid;place-items:center;background:#2a1a10;box-shadow:inset 0 0 0 2px #8a6a3a}.gb-gem:hover{box-shadow:inset 0 0 0 2px #ffe27a}.gb-gem img{width:24px;height:24px;image-rendering:pixelated}.gb-gem b{position:absolute;bottom:-6px;font:900 9.5px Lora,serif;padding:0 3px;border-radius:5px;background:#1a0c06}
.gb-ask{display:grid;gap:6px}.gb-ask div{display:flex;gap:8px;align-items:center}
.gb-btn{padding:4px 10px;border:0;border-radius:6px;cursor:pointer;background:linear-gradient(#ffe27a,#c8963a);color:#2a1600;font:900 12px Cinzel,serif;box-shadow:0 2px 0 #5a3a08}
.gb-link{border:0;background:none;color:#f0c878;text-decoration:underline;cursor:pointer;font:700 12px Lora,serif}
.gb-note{margin:8px 0 0;color:#ff9a8a;font-size:12px}
.gb-work{margin-top:14px;display:grid;gap:3px;font-size:12px}.gb-work small{opacity:.75;font-size:10.5px}.gb-work span{display:flex;align-items:center;gap:5px}.gb-work img{width:16px;height:16px;image-rendering:pixelated}.gb-work .neg{color:#ff9a8a}.gb-none{opacity:.8}
.perfect{--c:#ffd84a}.brilliant{--c:#c678ff}.fine{--c:#5ab4ff}.rough{--c:#9ec59a}.cracked{--c:#ff6a5a}.raw{--c:#bba8c8}
.gx-win .perfect{--c:#9a6400}.gx-win .brilliant{--c:#7b35b8}.gx-win .fine{--c:#1f64ad}.gx-win .rough{--c:#46703f}.gx-win .cracked{--c:#b3261a}.gx-win .raw{--c:#7d6a88}
.gb-set b,.gb-gem b{color:var(--c)}
/* ---------- the Gem Sorter: a plain kit window ---------- */
.gx-win{width:min(560px,calc(100% - 20px))}.gx-body{max-height:min(60vh,520px);overflow:auto}
.gx-row{grid-template-columns:auto 1fr auto auto}.gx-row .k-slot{position:relative}.gx-row .k-slot u{position:absolute;right:-4px;top:-4px;text-decoration:none;font:900 9px Lora,serif;background:#c8963a;color:#2a1600;border-radius:5px;padding:0 3px}
.gx-roll{display:grid;justify-items:end;min-width:74px}.gx-roll strong{font:900 16px Cinzel,serif;color:var(--c)}.gx-roll small{font:800 10px Lora,serif;letter-spacing:.08em;text-transform:uppercase;color:var(--c)}
.gx-row.rolling .gx-roll strong{filter:blur(.3px)}.gx-row.perfect:not(.rolling){box-shadow:inset 0 0 0 2px #ffd84a}
.gx-foot .k-note b{color:var(--c)}.gx-none{margin:8px 0;font-size:13px}
@media (max-width:820px){.gb{width:min(300px,calc(100% - 24px))}}
`;
