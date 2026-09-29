/* EASTSCAPE: GEMS (2026-09-28). The Gem Sorter's window (in the Depths, a World Project) and the Gem Case (anywhere, from the bag).
   The rules are GEMSET and friends in the rules file; the server's half is eastscape-worker/src/gems.js. Loaded the first time either
   window opens. Everything is drawn from the server's `view` ({ cost, tier, gc, bonus, worn }) and the player's own bag. */
export function createGems(E) {
  const { G, $, esc, send, SFX, ico, openWin } = E, S_ = G.GEMSET;
  let v = null, tab = "sort", err = null, pick = null, sorter = null, caseWin = null, lastRoll = null;
  const bag = () => (E.me?.inv || []).map((s, i) => ({ s, i })).filter(({ s }) => G.isGem(s.k));
  const pct = (r) => `${r > 0 ? "+" : ""}${r}%`, rc = (r) => (r >= S_.roll[1] ? "top" : r > 0 ? "good" : r < 0 ? "bad" : "zero");
  const gemChip = (k, roll) => `<span class="gm-chip ${roll == null ? "raw" : rc(roll)}">${ico(k)}<b>${esc(G.ITEMS[k]?.name || k)}</b><em>${roll == null ? "unsorted" : pct(roll)}</em></span>`;
  const slotName = (sl) => ({ weapon: "Weapon", helm: "Helm", body: "Body", legs: "Legs", shield: "Off-hand", gloves: "Gloves", boots: "Boots", amulet: "Amulet", ring: "Ring" })[sl] || sl;

  function mount(id, title, icon) {
    const w = document.createElement("section"); w.className = "win gm-win"; w.id = id; w.hidden = true; w.setAttribute("aria-label", title);
    w.innerHTML = `<div class="win-head"><b><span class="gm-ti">${icon}</span>${title}</b><small class="gm-sub"></small><button type="button" class="win-x" aria-label="Close">×</button></div><div class="win-body gm-body"></div>`;
    ($("jukeWin")?.parentElement || document.querySelector(".game") || document.body).append(w);
    w.querySelector(".win-x").addEventListener("click", () => { SFX.play("ui_close"); w.hidden = true; pick = null; });
    return w;
  }
  const bonusLine = () => { const b = v?.bonus || {}, rolls = G.gemRolls(E.me || {}), ks = Object.keys(b).filter((k) => b[k] || (rolls[k] || []).length > S_.perType); return ks.length ? `<div class="gm-bonus">${ks.map((k) => `<span class="${rc(b[k])}">${ico(k)} ${pct(b[k])} <small>${esc(S_.list.find((g) => g.k === k)?.does || "")}${(rolls[k] || []).length > S_.perType ? ` · only your best ${S_.perType} count` : ""}</small></span>`).join("")}</div><p class="gm-note">Only your best ${S_.perType} of each kind of gem count, sockets and case together.</p>` : `<p class="gm-note">No gems working for you yet.</p>`; };

  /* ---------------- the Sorter */
  function renderSorter() {
    if (!sorter || sorter.hidden) return;
    sorter.querySelector(".gm-sub").textContent = `a roll: ${G.fmtTix(v?.cost ?? S_.cost)}${(v?.tier | 0) >= 3 ? " · double sort" : ""}`;
    const tabs = [["sort", "Sort"], ["sockets", "Sockets"], ["sell", "Sell"]].map(([k, l]) => `<button type="button" role="tab" data-gt="${k}" aria-selected="${tab === k}">${l}</button>`).join("");
    const gems = bag();
    let pane = "";
    if (tab === "sort") {
      pane = `<p class="gm-note">Put a gem in and the sorter rolls it from ${pct(S_.roll[0])} to ${pct(S_.roll[1])}. Roll it again as often as you like; each roll replaces the last. <b>Combat gems</b> go in sockets on level ${S_.minLvl}+ gear; <b>skilling gems</b> go in your Gem Case.</p>`
        + (lastRoll ? `<div class="gm-last ${rc(lastRoll.roll)}">${ico(lastRoll.k)}<b>${esc(G.ITEMS[lastRoll.k].name)}</b><strong class="gm-num">${pct(lastRoll.roll)}</strong>${lastRoll.was != null ? `<small>was ${pct(lastRoll.was)}</small>` : ""}</div>` : "")
        + (gems.length ? `<div class="gm-list">${gems.map(({ s, i }) => { const r = G.rollOf(s); return `<div class="gm-row">${gemChip(s.k, r)}${s.n > 1 ? `<u>×${s.n}</u>` : ""}<small>${G.GEM_OF[s.k].where === "gear" ? "combat · socket" : "skilling · Gem Case"}</small><button type="button" class="k-btn sm gm-go" data-sort="${i}">${r == null ? "Sort" : "Re-roll"} · ${G.fmtTix(v?.cost ?? S_.cost)}</button></div>`; }).join("")}</div>` : `<p class="gm-empty">No gems in your bag. Every skill turns one up now and then at level ${S_.dropLvl}+, and monsters that tough drop the combat ones.</p>`);
    } else if (tab === "sockets") {
      const worn = Object.entries(v?.worn || {});
      const sorted = gems.filter(({ s }) => G.rollOf(s) != null && G.GEM_OF[s.k].where === "gear");
      pane = worn.length ? `<div class="gm-list">${worn.map(([sl, w]) => `<div class="gm-piece"><div class="gm-ph">${ico(w.k)}<b>${esc(G.ITEMS[w.k].name)}</b><small>${slotName(sl)} · ${w.socks.length} of ${w.max} socket${w.max > 1 ? "s" : ""}</small>
          ${w.socks.length < w.max ? `<button type="button" class="k-btn sm gm-punch" data-slot="${sl}">Punch a socket</button>` : ""}</div>
          <div class="gm-socks">${w.socks.map((g, s) => g ? `<div class="gm-sock full">${gemChip(g.k, g.roll)}<button type="button" class="k-btn sm gm-pull" data-slot="${sl}" data-s="${s}">Pull out</button></div>`
            : `<div class="gm-sock"><span class="gm-hole"></span>${pick?.slot === sl && pick.s === s ? `<span class="gm-choose">${sorted.length ? sorted.map(({ s: st, i }) => `<button type="button" class="gm-opt" data-slot="${sl}" data-s="${s}" data-i="${i}">${gemChip(st.k, G.rollOf(st))}</button>`).join("") : "<small>No sorted combat gems in your bag.</small>"}</span>` : `<button type="button" class="k-btn sm gm-fill" data-slot="${sl}" data-s="${s}">Add a gem</button>`}</div>`).join("") || `<small class="gm-note">No socket yet. A Socket Punch (Sal, Tinkering 70) makes one${w.max > 1 ? "; a weapon's second needs a Master Punch" : ""}.</small>`}</div></div>`).join("")}</div>`
        : `<p class="gm-empty">Wear a level ${S_.minLvl}+ piece: sockets go into what you have on. Weapons (and the level ${S_.minLvl}+ axes, pickaxes and rods) take two, everything else one.</p>`;
      pane += `<p class="gm-note">Pulling a gem out gives it back <b>unsorted</b>: it needs a roll to go in again.</p>` + bonusLine();
    } else {
      pane = `<p class="gm-note">Any gem, any roll: ${G.fmtTix(S_.sell)} each. Or put the good ones on the Exchange: a sorted gem trades with its roll.</p>`
        + (gems.length ? `<div class="gm-list">${gems.map(({ s, i }) => `<div class="gm-row">${gemChip(s.k, G.rollOf(s))}${s.n > 1 ? `<u>×${s.n}</u>` : ""}<button type="button" class="k-btn sm gm-sell" data-sell="${i}">Sell · ${G.fmtTix(S_.sell)}</button></div>`).join("")}</div>` : `<p class="gm-empty">No gems to sell.</p>`);
    }
    sorter.querySelector(".gm-body").innerHTML = `<div class="gm"><div class="k-tabs gm-tabs" role="tablist">${tabs}</div><div class="gm-pane k-paper">${pane}</div>${err ? `<p class="gm-err">${esc(err)}</p>` : ""}</div>`;
    const b = sorter.querySelector(".gm-body");
    b.querySelectorAll("[data-gt]").forEach((x) => x.addEventListener("click", () => { tab = x.dataset.gt; err = null; pick = null; SFX.play("ui_click"); renderSorter(); }));
    b.querySelectorAll("[data-sort]").forEach((x) => x.addEventListener("click", () => { x.disabled = true; SFX.play("slots_spin", { vol: 0.4 }); send({ t: "gems", op: "sort", i: +x.dataset.sort }); }));
    b.querySelectorAll("[data-sell]").forEach((x) => x.addEventListener("click", () => { SFX.play("coins", { vol: 0.6 }); send({ t: "gems", op: "sell", i: +x.dataset.sell }); }));
    b.querySelectorAll(".gm-punch").forEach((x) => x.addEventListener("click", () => { SFX.play("chip"); send({ t: "gems", op: "punch", slot: x.dataset.slot }); }));
    b.querySelectorAll(".gm-fill").forEach((x) => x.addEventListener("click", () => { pick = { slot: x.dataset.slot, s: +x.dataset.s }; SFX.play("ui_click"); renderSorter(); }));
    b.querySelectorAll(".gm-opt").forEach((x) => x.addEventListener("click", () => { pick = null; SFX.play("chip"); send({ t: "gems", op: "socket", slot: x.dataset.slot, s: +x.dataset.s, i: +x.dataset.i }); }));
    b.querySelectorAll(".gm-pull").forEach((x) => x.addEventListener("click", () => { if (x.dataset.armed !== "1") { x.dataset.armed = "1"; x.textContent = "Loses its roll: sure?"; x.classList.add("danger"); return; } SFX.play("ui_click"); send({ t: "gems", op: "pull", slot: x.dataset.slot, s: +x.dataset.s }); }));
  }

  /* ---------------- the Gem Case */
  function renderCase() {
    if (!caseWin || caseWin.hidden) return;
    const gc = v?.gc || G.caseOf(E.me), sorted = bag().filter(({ s }) => G.rollOf(s) != null && G.GEM_OF[s.k].where === "case");
    caseWin.querySelector(".gm-sub").textContent = `${gc.g.filter(Boolean).length} of ${gc.n} slots · always working`;
    const cells = gc.g.map((g, s) => g ? `<button type="button" class="gm-cell full ${rc(g.roll)}" data-out="${s}" title="${esc(`${G.gemText(g.k, g.roll)}: ${G.GEM_OF[g.k].does}. Click to take it out (it comes back unsorted).`)}">${ico(g.k)}<em>${pct(g.roll)}</em></button>`
      : `<button type="button" class="gm-cell${pick?.caseS === s ? " on" : ""}" data-in="${s}" title="An empty slot: click, then pick a sorted skilling gem">+</button>`).join("")
      + Array.from({ length: S_.caseMax - gc.n }, () => `<span class="gm-cell locked" title="Sal builds more slots: a Gem Case Hinge (Tinkering 40), Frame (60) and Heart (80)">\u{1F512}</span>`).join("");
    caseWin.querySelector(".gm-body").innerHTML = `<div class="gm gm-case"><p class="gm-note">Skilling gems work from here wherever you are: no swapping. Sort them at the Gem Sorter in the Depths first.</p>
      <div class="gm-grid">${cells}</div>
      ${pick?.caseS != null ? `<div class="gm-choose wide">${sorted.length ? sorted.map(({ s, i }) => `<button type="button" class="gm-opt" data-case="${i}">${gemChip(s.k, G.rollOf(s))}</button>`).join("") : "<small>No sorted skilling gems in your bag.</small>"}</div>` : ""}
      ${bonusLine()}${err ? `<p class="gm-err">${esc(err)}</p>` : ""}</div>`;
    const b = caseWin.querySelector(".gm-body");
    b.querySelectorAll("[data-in]").forEach((x) => x.addEventListener("click", () => { pick = { caseS: +x.dataset.in }; SFX.play("ui_click"); renderCase(); }));
    b.querySelectorAll("[data-case]").forEach((x) => x.addEventListener("click", () => { const s = pick?.caseS; pick = null; SFX.play("chip"); send({ t: "gems", op: "case", s, i: +x.dataset.case }); }));
    b.querySelectorAll("[data-out]").forEach((x) => x.addEventListener("click", () => { if (x.dataset.armed !== "1") { x.dataset.armed = "1"; x.classList.add("armed"); x.title = "Click again: it comes back unsorted"; return; } SFX.play("ui_click"); send({ t: "gems", op: "caseout", s: +x.dataset.out }); }));
  }

  return {
    openSorter() { sorter ||= mount("gemWin", "The Gem Sorter", "\u{1F48E}"); openWin("gemWin"); err = null; renderSorter(); },
    openCase() { caseWin ||= mount("gemCaseWin", "Gem Case", "\u{1F9F0}"); openWin("gemCaseWin"); err = null; send({ t: "gems", op: "view" }); renderCase(); },
    got(e) {
      v = e.view; err = null;
      if (e.open === "sorter") this.openSorter();
      if (e.rolled) { lastRoll = e.rolled; SFX.play(e.rolled.roll >= S_.roll[1] ? "win_big" : e.rolled.roll > 0 ? "win_small" : "lose"); if (e.rolled.roll >= S_.roll[1]) E.winFx?.(`${G.ITEMS[e.rolled.k].name} +${e.rolled.roll}%`, "", "Perfect!"); }
      if (e.punched || e.socketed || e.cased) SFX.play("task_done");
      renderSorter(); renderCase();
    },
    oops(t) { err = t; SFX.play("ui_error"); renderSorter(); renderCase(); },
    bag() { renderSorter(); renderCase(); }
  };
}

export const CSS = `
/* ---------- (2026-09-28) THE GEM SORTER AND THE GEM CASE ---------- */
.gm-win{width:min(640px,calc(100% - 20px))}.gm-win .win-body{padding:0;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.gm-ti{margin-right:6px}.gm{display:flex;flex-direction:column;min-height:0;flex:1;padding:0}
.gm-tabs{margin:0}.gm-pane{flex:1;min-height:0;max-height:min(58vh,540px);overflow:auto;display:grid;gap:8px;align-content:start;padding:10px 12px}
.gm-note{margin:0;font:600 12.5px/1.45 Lora,serif;color:var(--k-ink2)}.gm-empty{margin:6px 0;font:700 13px Lora,serif;color:var(--k-ink2)}
.gm-err{margin:6px 12px;font:800 13px Lora,serif;color:var(--k-bad)}
.gm-list{display:grid;gap:6px}.gm-row{display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:var(--k-r);background:var(--k-card);box-shadow:inset 0 0 0 1.5px var(--k-card-line)}
.gm-row small{flex:1;font:700 11.5px Lora,serif;color:var(--k-ink2)}.gm-row u{text-decoration:none;font:900 12px Lora,serif}
.gm-chip{display:inline-flex;align-items:center;gap:6px;font:800 13px Lora,serif}.gm-chip img{width:26px;height:26px;image-rendering:pixelated}
.gm-chip em{font-style:normal;font:900 12px Lora,serif;padding:1px 7px;border-radius:99px;background:rgba(90,58,24,.12)}
.gm-chip.good em{background:#d6ecd0;color:var(--k-good)}.gm-chip.bad em{background:#f3d6d0;color:var(--k-bad)}.gm-chip.top em{background:#ffd84a;color:#3a2400}.gm-chip.raw em{color:var(--k-ink2)}
.gm-last{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--k-r);background:#2a2016;color:#fff}.gm-last img{width:34px;height:34px;image-rendering:pixelated}
.gm-num{margin-left:auto;font:900 28px var(--k-disp,Cinzel),serif}.gm-last.good .gm-num{color:#7ee08a}.gm-last.bad .gm-num{color:#ff8a7a}.gm-last.top .gm-num{color:#ffd84a;text-shadow:0 0 12px rgba(255,216,74,.6)}.gm-last small{opacity:.7}
.gm-piece{padding:10px;border-radius:var(--k-r);background:var(--k-card);box-shadow:inset 0 0 0 1.5px var(--k-card-line);display:grid;gap:8px}
.gm-ph{display:flex;align-items:center;gap:8px}.gm-ph img{width:30px;height:30px;image-rendering:pixelated}.gm-ph b{font:800 14px var(--k-disp,Cinzel),serif}.gm-ph small{flex:1;font:700 11.5px Lora,serif;color:var(--k-ink2)}
.gm-socks{display:grid;gap:6px}.gm-sock{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.gm-hole{width:22px;height:22px;border-radius:50%;background:#2a2016;box-shadow:inset 0 2px 4px #000}
.gm-choose{display:flex;flex-wrap:wrap;gap:4px}.gm-choose.wide{padding:4px 0}.gm-opt{border:0;background:rgba(90,58,24,.1);border-radius:8px;padding:3px 8px;cursor:pointer}.gm-opt:hover{background:rgba(90,58,24,.22)}
.gm-bonus{display:flex;flex-wrap:wrap;gap:6px}.gm-bonus span{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;background:rgba(90,58,24,.1);font:800 12px Lora,serif}.gm-bonus img{width:18px;height:18px;image-rendering:pixelated}.gm-bonus small{font-weight:600;color:var(--k-ink2)}
.gm-bonus .good{color:var(--k-good)}.gm-bonus .bad{color:var(--k-bad)}
.gm-case{padding:12px;gap:10px}.gm-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.gm-cell{aspect-ratio:1;display:grid;place-items:center;border:0;border-radius:10px;background:#2a2016;box-shadow:inset 0 0 0 2px #5a4020;color:#c8963a;font:900 20px Lora,serif;cursor:pointer;position:relative}
.gm-cell img{width:34px;height:34px;image-rendering:pixelated}.gm-cell em{position:absolute;bottom:3px;right:5px;font:900 11px Lora,serif;font-style:normal;color:#fff;text-shadow:0 1px 0 #000}
.gm-cell.full.good{box-shadow:inset 0 0 0 2px #4ad08a}.gm-cell.full.bad{box-shadow:inset 0 0 0 2px #e04a3a}.gm-cell.full.top{box-shadow:inset 0 0 0 2px #ffd84a,0 0 10px rgba(255,216,74,.5)}
.gm-cell.on{box-shadow:inset 0 0 0 2px #ffd84a}.gm-cell.armed{outline:2px dashed #e04a3a}.gm-cell.locked{opacity:.35;cursor:default;font-size:14px}
@media (max-width:620px){.gm-grid{grid-template-columns:repeat(4,1fr)}}
`;
