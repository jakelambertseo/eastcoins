/* ============================================================ SPROCKET SAL'S SCRAP BENCH (2026-09-28), the page's half of Tinkering. Lazy:
   loaded the first time somebody talks to Sal or clicks the bench. The rules are TINK / salvageOf / salvageLot in the rules file and
   the server's half is eastscape-worker/src/tinker.js; the look is the sketch in mockups-archive/eastscape-tinkering.html.

   STEP ONE: the pouch and the Salvage tab. Every salvageable stack in your BAG (by level: a +3 helm is its own row), what it breaks into
   (worked out here with the same salvageOf the server uses, so the numbers cannot disagree), and a Salvage button; gear, bars and anything
   worth a Relic shard ask "Sure?" first. The foot is "Salvage the lot": plain drops only, never gear, bars, food, magic or a favourite. */
export function createTinker(E) {
  const { G, $, esc, send, SFX, ico, openWin } = E, T = G.TINK, UI = "/v3/assets/img/glad/flat/ui/";
  let win = null, v = null, tab = "salvage", err = null, bagSig = "", focus = null;
  const PIC = (p) => `<img class="tk-pic" src="/v3/assets/img/glad/flat/items/part_${p}.png?v=1" alt="" onerror="this.replaceWith(Object.assign(document.createElement('i'),{}))">`;   /* (2026-09-28) the parts' own icons; the colour square if one is missing */
  const partChip = (p, n) => `<span class="tk-part" style="--c:${T.parts[p].col}">${PIC(p)}${Number(n).toLocaleString()} ${esc(T.parts[p].name)}</span>`;
  const partsOf = (g) => Object.keys(T.parts).filter((p) => g[p] > 0).map((p) => partChip(p, g[p])).join("");
  const SAYS = ["Everything's worth something. Mostly bits.", "Bring me your junk. I'll turn it into parts.", "Parts don't sell. Parts BUILD.", "Your favourites are safe with me, love."];

  function mount() {
    if (win) return win;
    win = document.createElement("section"); win.className = "win tk-win"; win.id = "tkWin"; win.hidden = true; win.setAttribute("aria-label", "The Scrap Bench");
    win.innerHTML = `<div class="win-head"><b><img src="${UI}g_tools.png?v=1" alt="" class="topi">The Scrap Bench</b><small id="tkSub">Tinkering</small><button type="button" class="win-x" aria-label="Close">×</button></div><div class="win-body" id="tkBody"></div>`;
    ($("jukeWin")?.parentElement || document.querySelector(".game") || document.body).append(win);
    win.querySelector(".win-x").addEventListener("click", () => { SFX.play("ui_close"); win.hidden = true; });
    return win;
  }
  /* the bag's salvageable stacks, one row per item AND level */
  function rows() {
    const by = new Map();
    for (const s of E.me?.inv || []) { if (!G.canSalvage(s.k)) continue; const f = G.fOf(s) | 0, id = `${s.k}|${f}`, r = by.get(id) || { k: s.k, f, n: 0 }; r.n += s.n; by.set(id, r); }
    return [...by.values()].map((r) => ({ ...r, g: G.salvageOf(r.k, r.n, r.f), kind: G.salvageKind(r.k, r.f), fav: G.isFav(E.me, r.k), lot: r.f === 0 && G.salvageLot(r.k) && !G.isFav(E.me, r.k) })).filter((r) => r.g.pv > 0)
      .sort((a, b) => Number(b.lot) - Number(a.lot) || b.g.pv - a.g.pv);
  }
  function render() {
    if (!win || win.hidden) return;
    const pouch = v?.parts || E.me?.parts || {}, lvl = v?.lvl ?? G.lvlOf(E.me || { xp: {} }, "tinkering");
    $("tkSub").textContent = `Tinkering · level ${lvl}`;
    const R = rows(), lot = { scrap: 0, gears: 0, sparks: 0, relic: 0, pv: 0 }; for (const r of R) if (r.lot) for (const p of Object.keys(lot)) lot[p] += r.g[p];
    const tabBtn = (k, l, ic) => `<button type="button" role="tab" data-tt="${k}" aria-selected="${tab === k}"><img src="${UI}${ic}.png?v=1" alt="">${l}</button>`;
    let pane = "", foot = "";
    if (tab === "salvage") {
      pane = R.length ? `<div class="k-sect"><span class="k-label">In your bag, and what it breaks into</span></div>` + R.map((r) => {
        const careful = r.f > 0 || r.kind === "relic" || r.kind === "metal";
        return `<div class="k-row tk-row${r.lot ? " lot" : ""}"><span class="k-slot" data-item="${r.k}">${ico(r.k)}${r.n > 1 ? `<u>×${r.n.toLocaleString()}</u>` : ""}${r.f ? `<em class="fgn">+${r.f}</em>` : ""}</span>
          <span><b>${esc(G.forgeNameAt ? G.forgeNameAt(r.k, r.f) : G.ITEMS[r.k].name)}</b><small>${r.fav ? "favourited: unfavourite it to salvage" : r.lot ? (r.kind === "magic" ? "magical: mostly Sparks, goes in the lot" : "junk: goes in the lot") : { metal: "metal: mostly Gears", magic: "magic: Sparks", relic: "rare: a Relic shard", junk: "one at a time" }[r.kind]}</small></span>
          <span class="k-end"><span class="tk-gets">${partsOf(r.g)}</span><button type="button" class="k-btn sm tk-go${careful ? " arm" : ""}" data-k="${r.k}" data-f="${r.f}"${r.fav ? " disabled" : ""}>Salvage</button></span></div>`;
      }).join("") : `<div class="tk-empty"><b>Nothing to salvage</b><p>Bones, husks, pits, spare gear, pages: bring me what you'd sell to Bom for pennies.</p></div>`;
      foot = `<span class="k-note">Parts can't be sold to Bom: that's the deal. Favourites and what you're wearing are never touched.</span>${lot.pv ? `<span class="tk-gets">${partsOf(lot)}</span>` : ""}<button type="button" class="k-btn tk-lot" id="tkLot"${lot.pv ? "" : " disabled"}>Salvage the lot</button>`;
    } else if (tab === "build") {
      /* STEP TWO: every gadget, lowest level first; what it costs (parts and the ticket fee), what it does, and a Build button that is
         only lit when you have the level, the parts and the fee. Running gadgets are on the buffs bar, not here. */
      const tix = G.tixIn(E.me || { inv: [] }), list = Object.entries(G.GADGETS).filter(([, g]) => g.item !== false && g.lvl).sort((a, b) => a[1].lvl - b[1].lvl);
      pane = `<div class="k-sect"><span class="k-label">Gadgets · every one gets used up · ${Math.round(T.masterwork * 100)}% of builds come out a Masterwork (twice as many)</span></div><div class="tk-gad">` + list.map(([id, g]) => {
        const lock = lvl < g.lvl, short = Object.entries(g.parts || {}).some(([p, n]) => (pouch[p] || 0) < n), broke = tix < g.fee, can = !lock && !short && !broke;
        const last = g.mins ? `${g.mins} min` : g.n > 1 ? `${g.n} uses` : "one use";
        return `<div class="tk-card${lock ? " lock" : ""}"><span class="tk-ctop"><span class="tk-cico">${ico(`tk_${id}`)}</span><span><b>${esc(g.name)}</b><span class="tk-lv${lock ? " no" : ""}">Tinkering ${g.lvl}</span>${g.skill ? `<span class="tk-sk">${esc(G.SKILLS[g.skill]?.name || g.skill)}</span>` : ""}</span></span>
          <small>${esc(g.does)} · ${last}</small>
          <span class="tk-gets tk-cost">${Object.entries(g.parts || {}).map(([p, n]) => `<span class="tk-part${(pouch[p] || 0) < n ? " short" : ""}" style="--c:${T.parts[p].col}">${PIC(p)}${n} ${esc(T.parts[p].name)}</span>`).join("")}<span class="tk-part fee${broke ? " short" : ""}" style="--c:#e8bf35"><i></i>${g.fee.toLocaleString()} tickets</span></span>
          <button type="button" class="k-btn sm tk-build" data-id="${id}"${can ? "" : " disabled"}>${lock ? `Tinkering ${g.lvl}` : short ? "Need parts" : broke ? "Need tickets" : "Build"}</button></div>`;
      }).join("") + `</div>`;
      foot = `<span class="k-note">Built gadgets go in your bag: click one there to use it. Timed ones run while you're outside, one of each at a time, and show on your buffs bar.</span>`;
    } else {
      /* STEP FOUR: WORLD PROJECTS. One card each: the tier ladder, what this tier does, a bar per part with Give buttons, who has
         given most, and Finish once it is full (the server checks you are on site and have the level). */
      const PV = v?.proj || {}, tix = G.tixIn(E.me || { inv: [] });
      pane = `<div class="k-sect"><span class="k-label">World Projects · the whole server builds them · give here or at the site · the last step of each tier is done on site</span></div>` + Object.entries(G.PROJECTS).map(([id, P]) => {
        const st = PV[id] || { tier: G.projTier(id), got: {}, top: [] }, t = P.tiers[st.tier], pips = P.tiers.map((x, i) => `<i class="${i < st.tier ? "on" : i === st.tier ? "now" : ""}" title="${esc(x.name)}"></i>`).join("");
        if (!t) return `<div class="tk-proj done${focus === id ? " focus" : ""}" data-proj="${id}"><div class="tk-ph"><b>${esc(P.name)}</b><span class="tk-pips">${pips}</span></div><p class="tk-pd">Finished. ${esc(P.tiers.map((x) => x.name).join(", "))}.</p></div>`;
        const bars = Object.entries(t.need).map(([part, n]) => {
          const got = st.got?.[part] | 0, full = got >= n, isT = part === "tickets", have = isT ? tix : pouch[part] | 0, col = isT ? "#e8bf35" : T.parts[part].col, name = isT ? "Tickets" : T.parts[part].name;
          const steps = isT ? [1000, 10000] : [10, 100], btn = (k, lbl) => `<button type="button" class="k-btn sm tk-give" data-id="${id}" data-part="${part}" data-n="${k}"${full || !have ? " disabled" : ""}>${lbl}</button>`;
          return `<div class="tk-bar${full ? " full" : ""}" style="--c:${col}"><span class="tk-bl">${isT ? "<i></i>" : PIC(part)}${esc(name)}<small>${got.toLocaleString()} / ${n.toLocaleString()}</small></span><span class="tk-bt"><u style="width:${Math.min(100, (got / n) * 100)}%"></u></span>
            <span class="tk-bg">${full ? `<em>Full</em>` : `${btn(steps[0], `+${steps[0].toLocaleString()}`)}${btn(steps[1], `+${steps[1].toLocaleString()}`)}${btn(1e12, "All")}`}</span></div>`;
        }).join("");
        const top = (st.top || []).map((w) => `<li><b>${esc(w.name)}</b><small>${w.pv.toLocaleString()} parts${w.tix ? ` · ${G.fmtTix(w.tix)}` : ""}</small></li>`).join("");
        return `<div class="tk-proj${st.ready ? " ready" : ""}${focus === id ? " focus" : ""}" data-proj="${id}">
          <div class="tk-ph"><b>${esc(P.name)}</b><span class="tk-where">${esc(P.where)}</span>${st.grand > Date.now() ? `<span class="tk-grand">\u{1F389} Grand Opening · ${Math.ceil((st.grand - Date.now()) / 60000)} min</span>` : ""}<span class="tk-pips" aria-label="tier ${st.tier + 1} of 3">${pips}</span></div>
          <p class="tk-pd"><b>Tier ${st.tier + 1}: ${esc(t.name)}.</b> ${esc(t.does[0].toUpperCase() + t.does.slice(1))}.</p>
          <p class="tk-pin">${ico(`pin_${id}`)}${st.pin ? "You have this build's pin." : "Give anything to this stage and you get the Builder's Pin when it's finished."}</p>
          <div class="tk-bars">${bars}</div>
          <div class="tk-pf">${top ? `<ol class="tk-top5">${top}</ol>` : `<span class="k-note">Nobody's given yet. Be first.</span>`}
            <button type="button" class="k-btn tk-finish" data-id="${id}"${st.ready ? "" : " disabled"}>${st.ready ? `Finish it · Tinkering ${t.finish}` : `Finishing needs Tinkering ${t.finish}`}</button></div></div>`;
      }).join("");
      foot = `<span class="k-note">Giving pays Tinkering xp. What's given stays given: it's in the build now.</span>`;
    }
    $("tkBody").innerHTML = `<div class="tk">
      <div class="tk-top"><span class="tk-face"><img src="${UI}sal_face.png?v=1" alt="Sprocket Sal" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'\\u{1F527}'}))"></span>
        <span class="tk-who"><p class="tk-say"><b>SAL</b>${esc(SAYS[Math.floor(Date.now() / 60000) % SAYS.length])}</p><span class="tk-pouch">${Object.keys(T.parts).map((p) => partChip(p, pouch[p] || 0)).join("")}</span></span></div>
      <div class="k-tabs tk-tabs" role="tablist">${tabBtn("salvage", "Salvage", "w_sack")}${tabBtn("build", "Build", "g_tools")}${tabBtn("projects", "Projects", "g_home")}</div>
      <div class="tk-pane k-paper">${pane}</div>
      ${err ? `<p class="tk-err">${esc(err)}</p>` : ""}
      ${foot ? `<div class="k-foot tk-foot">${foot}</div>` : ""}</div>`;
    const body = $("tkBody");
    body.querySelectorAll("[data-tt]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tt; err = null; SFX.play("ui_click"); render(); }));
    body.querySelectorAll(".tk-go").forEach((b) => b.addEventListener("click", () => {
      if (b.classList.contains("arm") && b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Sure?"; b.classList.add("danger"); SFX.play("ui_click"); return; }
      SFX.play("chip", { vol: 0.5 }); send({ t: "tinker", op: "salvage", k: b.dataset.k, f: Number(b.dataset.f) | 0 });
    }));
    body.querySelector("#tkLot")?.addEventListener("click", () => { SFX.play("coins"); send({ t: "tinker", op: "salvage", lot: true }); });
    body.querySelectorAll(".tk-give").forEach((b) => b.addEventListener("click", () => { SFX.play("coins", { vol: 0.6 }); send({ t: "tinker", op: "give", id: b.dataset.id, part: b.dataset.part, n: Number(b.dataset.n) }); }));
    body.querySelectorAll(".tk-finish").forEach((b) => b.addEventListener("click", () => { SFX.play("ui_click"); b.disabled = true; send({ t: "tinker", op: "finish", id: b.dataset.id }); }));
    if (focus && tab === "projects") { body.querySelector(`[data-proj="${focus}"]`)?.scrollIntoView({ block: "nearest" }); }
    body.querySelectorAll(".tk-build").forEach((b) => b.addEventListener("click", () => { SFX.play("chip", { vol: 0.6 }); b.disabled = true; send({ t: "tinker", op: "build", id: b.dataset.id }); }));
  }
  function floatGot(got) {
    if (!got?.pv || E.calm?.()) return; const top = $("tkBody")?.querySelector(".tk-top"); if (!top) return;
    const f = document.createElement("b"); f.className = "tk-float"; f.textContent = `+${Object.keys(T.parts).filter((p) => got[p]).map((p) => `${got[p]} ${T.parts[p].name}`).join(", ")}`; top.append(f); setTimeout(() => f.remove(), 1500);
  }
  return {
    open(on) { mount(); if (on) { tab = "projects"; focus = on; } openWin("tkWin"); err = null; if (!on) send({ t: "tinker", op: "view" }); render(); },
    tiers() { if (win && !win.hidden) send({ t: "tinker", op: "view" }); },   /* a tier went up somewhere: ask for the fresh bars */
    got(view, got, built) { v = view; err = null; if (win && !win.hidden) { render(); if (got) { SFX.play("coins"); floatGot(got); } if (built) { SFX.play(built.master ? "win_big" : "task_done"); if (built.master) E.winFx?.(`${built.n}\u00d7 ${G.GADGETS[built.id]?.name || ""}`, "", "Masterwork!"); } } },
    done(f) { SFX.play("win_big"); E.winFx?.(G.PROJECTS[f.id]?.tiers[f.tier - 1]?.name || "Built", "", "Project built!"); },
    oops(text) { err = text; SFX.play("ui_error"); render(); },
    /* the page calls this on every update of you; redraw only when the bag's salvageable part has changed */
    bag() { if (!win || win.hidden) return; const sig = (E.me?.inv || []).filter((s) => G.canSalvage(s.k)).map((s) => `${s.k}:${s.n}:${G.fOf(s)}`).join(","); if (sig !== bagSig) { bagSig = sig; render(); } }
  };
}

export const CSS = `
/* ---------- (2026-09-28) SPROCKET SAL'S SCRAP BENCH ---------- */
.tk-win{width:min(760px,calc(100% - 20px))}
.tk-win .win-body{padding:0;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.tk{display:flex;flex-direction:column;min-height:0;flex:1}
.tk-top{position:relative;display:flex;align-items:center;gap:14px;padding:12px 16px;background:linear-gradient(135deg,#4a4a4e,#2e2e32 60%,#222226);box-shadow:inset 0 -2px 0 #e8bf35;color:#eee}
.tk-face{flex:none;width:58px;height:58px;border-radius:10px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle,#6a6a70,#333);box-shadow:0 0 0 2px #e8bf35;font-size:30px}.tk-face img{width:58px;height:58px;image-rendering:pixelated}
.tk-who{flex:1;min-width:0;display:grid;gap:6px}
.tk-say{margin:0;font:italic 600 13.5px Lora,serif}.tk-say b{font:800 12px var(--k-disp,Cinzel),serif;font-style:normal;letter-spacing:.06em;color:#ffd84a;margin-right:6px}
.tk-pouch,.tk-gets{display:flex;gap:5px;flex-wrap:wrap}.tk-gets{justify-content:flex-end}
.tk-part{display:inline-flex;align-items:center;gap:5px;padding:3px 9px 3px 5px;border-radius:99px;background:#1a1a1c;box-shadow:inset 0 0 0 1.5px var(--c);font:800 12.5px Lora,serif;color:#fff;white-space:nowrap}.tk-part i{width:12px;height:12px;border-radius:3px;background:var(--c)}.tk-pic{width:18px;height:18px;image-rendering:pixelated;flex:none;margin:-2px 0}
.tk-gets .tk-part{background:#2a2a2c;font-size:11.5px;padding:2px 8px 2px 4px}
.tk-tabs{margin:0}
.tk-pane{flex:1;min-height:0;max-height:min(58vh,560px);overflow:auto;display:grid;gap:6px;align-content:start;padding:10px 12px}
.tk-row{grid-template-columns:auto minmax(0,1fr) auto;cursor:default}.tk-row.lot{box-shadow:inset 0 0 0 1.5px #8a8a86}
.tk-row b{font:800 15px var(--k-disp,Cinzel),serif}.tk-row small{display:block;font:700 12px Lora,serif;color:var(--k-ink2)}
.tk-row .k-end{display:flex;align-items:center;gap:8px}
.tk-row .k-slot .fgn{position:absolute;left:-4px;top:-6px;font:900 10px/1 Lora,serif;font-style:normal;color:#fff;background:var(--k-gold-ink);padding:1px 3px;border-radius:3px}
#tkWin .k-btn.tk-go{border:6px solid transparent;border-image:url(/v3/assets/img/glad/flat/ui/btn_zc.png?v=1) 10 fill / 6px stretch;background:none;color:#e4ffe9;text-shadow:0 1px 0 #000;font-weight:900}
#tkWin .k-btn.tk-go.danger{border:2px solid #2a140c;border-image:none;border-radius:var(--k-r);background:linear-gradient(#cf4638,#a52e22)}
#tkWin .k-btn.tk-lot{flex:none;border:7px solid transparent;border-image:url(/v3/assets/img/glad/flat/ui/btn_gold.png?v=1) 10 fill / 7px stretch;background:none;color:#2a1600;text-shadow:none;font:900 14px var(--k-disp,Cinzel),serif}
.tk-foot{margin:0;gap:10px}.tk-foot .k-note{flex:1 1 auto;min-width:0}
/* the Projects tab */
.tk-grand{padding:2px 9px;border-radius:99px;background:#ffd84a;color:#3a2400;font:900 11px Lora,serif;letter-spacing:.04em;animation:tkGrand 1.6s ease-in-out infinite}@keyframes tkGrand{50%{box-shadow:0 0 0 4px rgba(255,216,74,.35)}}@media (prefers-reduced-motion:reduce){.tk-grand{animation:none}}
.tk-pin{margin:0;display:flex;align-items:center;gap:6px;font:700 12px Lora,serif;color:var(--k-ink2)}.tk-pin img{width:22px;height:22px;image-rendering:pixelated}
.tk-proj{display:grid;gap:8px;padding:12px;border-radius:var(--k-r);background:var(--k-card);box-shadow:inset 0 0 0 1.5px var(--k-card-line)}
.tk-proj.focus{box-shadow:inset 0 0 0 2.5px #e8bf35}.tk-proj.ready{box-shadow:inset 0 0 0 2.5px var(--k-good)}.tk-proj.done{opacity:.8}
.tk-ph{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}.tk-ph b{font:800 17px var(--k-disp,Cinzel),serif}.tk-where{font:700 12px Lora,serif;color:var(--k-ink2)}
.tk-pips{margin-left:auto;display:flex;gap:4px}.tk-pips i{width:22px;height:8px;border-radius:99px;background:rgba(90,58,24,.18)}.tk-pips i.on{background:var(--k-good)}.tk-pips i.now{background:#e8bf35}
.tk-pd{margin:0;font:600 13px/1.4 Lora,serif}.tk-pd b{font-weight:800}
.tk-bars{display:grid;gap:6px}
.tk-bar{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:10px;align-items:center}
.tk-bl{display:flex;align-items:center;gap:6px;font:800 13px Lora,serif}.tk-bl i{width:12px;height:12px;border-radius:3px;background:var(--c);flex:none}.tk-bl small{margin-left:auto;font:700 11.5px Lora,serif;color:var(--k-ink2)}
.tk-bt{height:12px;border-radius:99px;background:rgba(90,58,24,.15);overflow:hidden}.tk-bt u{display:block;height:100%;background:var(--c);text-decoration:none}
.tk-bg{display:flex;gap:4px}.tk-bg em{font:900 11px Lora,serif;font-style:normal;color:var(--k-good);text-transform:uppercase;letter-spacing:.06em}
#tkWin .k-btn.tk-give{padding:3px 8px;font-size:12px}
.tk-pf{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.tk-top5{flex:1;min-width:0;margin:0;padding-left:18px;display:flex;gap:14px;flex-wrap:wrap;font:700 12px Lora,serif}.tk-top5 small{display:block;color:var(--k-ink2);font-weight:600}
#tkWin .k-btn.tk-finish{margin-left:auto;border:7px solid transparent;border-image:url(/v3/assets/img/glad/flat/ui/btn_gold.png?v=1) 10 fill / 7px stretch;background:none;color:#2a1600;font:900 13.5px var(--k-disp,Cinzel),serif}#tkWin .k-btn.tk-finish:disabled{filter:grayscale(.8);opacity:.7}
@media (max-width:620px){.tk-bar{grid-template-columns:1fr auto}.tk-bt{grid-column:1/-1;order:3}}
/* the Build tab's cards */
.tk-gad{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px}
.tk-card{display:grid;gap:6px;align-content:start;padding:10px;border-radius:var(--k-r);background:var(--k-card);box-shadow:inset 0 0 0 1.5px var(--k-card-line)}.tk-card.lock{opacity:.6}
.tk-ctop{display:flex;gap:8px;align-items:center}.tk-cico{width:38px;height:38px;flex:none;display:grid;place-items:center;border-radius:8px;background:#2a2016;font-size:22px}.tk-cico img{width:28px;height:28px;image-rendering:pixelated}
.tk-card b{display:block;font:800 14.5px var(--k-disp,Cinzel),serif}.tk-card small{font:700 12px/1.35 Lora,serif;color:var(--k-ink2)}
.tk-lv,.tk-sk{display:inline-block;margin-right:4px;font:900 9.5px Lora,serif;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:99px;background:#d6ecd0;color:var(--k-good)}.tk-lv.no{background:#f3d6d0;color:var(--k-bad)}.tk-sk{background:rgba(90,58,24,.12);color:var(--k-ink2)}
.tk-cost{justify-content:flex-start}.tk-cost .tk-part.short{opacity:.55;box-shadow:inset 0 0 0 1.5px #b8302a}.tk-cost .fee{background:#3a2400}
#tkWin .k-btn.tk-build{border:6px solid transparent;border-image:url(/v3/assets/img/glad/flat/ui/btn_zc.png?v=1) 10 fill / 6px stretch;background:none;color:#e4ffe9;text-shadow:0 1px 0 #000;font-weight:900}#tkWin .k-btn.tk-build:disabled{border-image-source:url(/v3/assets/img/glad/flat/ui/btn_zc_off.png?v=1);color:#c9cdca;opacity:1;filter:none}
.tk-empty{display:grid;justify-items:center;gap:4px;padding:30px 10px;text-align:center;color:var(--k-ink2)}.tk-empty b{font:800 17px var(--k-disp,Cinzel),serif;color:var(--k-ink)}.tk-empty p{margin:0;max-width:380px;font:600 13.5px Lora,serif}
.tk-err{margin:0;padding:8px 14px;background:#f6d6d0;color:var(--k-bad);font:700 13px/1.35 Lora,serif;border-top:2px solid #e0a09a}
.tk-float{position:absolute;right:16px;top:8px;font:900 18px var(--k-disp,Cinzel),serif;color:#9dffab;-webkit-text-stroke:4px #0c3014;paint-order:stroke fill;animation:tkUp 1.4s ease-out forwards;pointer-events:none;white-space:nowrap}
@keyframes tkUp{from{transform:translateY(10px);opacity:0}20%{opacity:1}to{transform:translateY(-30px);opacity:0}}
@media (max-width:620px){.tk-row{grid-template-columns:auto minmax(0,1fr)}.tk-row .k-end{grid-column:1/-1;justify-content:flex-end}.tk-foot{flex-wrap:wrap}.tk-foot .k-note{display:none}}
@media (prefers-reduced-motion:reduce){.tk-float{display:none}}
`;
