/* EASTSCAPE: GEMS (2026-09-28). Two windows, both loaded the first time either opens; the server's half is eastscape-worker/src/gems.js.

   THE GEM SORTER (the machine in the middle of the Yard's Market Square). The owner: "the overall UI interface isn't as simple and casino-y
   for users, which in truth this is a gamble getting the 10%". So it is built like the machines people already know how to use
   (a slot cabinet, a gacha pull, MapleStory's cube, Diablo's enchanting table), one gem at a time and one big button:
     - pick a gem from YOUR GEMS and it drops into the globe;
     - PULL (or the space bar) spins the number reel and lands it, the colour and the word saying how good it was
       (Cracked, Rough, Fine, Brilliant, Perfect), the sound getting louder with it, a Perfect lit up and announced;
     - AUTO rolls it for you until it reaches the number you picked, or your budget runs out, in one click (the server rolls, the page
       plays the rolls back fast);
     - the odds are printed on the machine, and the last rolls light up along the bottom like a roulette board.
   THE GEM SATCHEL (the bag's Gems button). The owner: "a styled, leather, gem holding bag where users can move them around/add them. not a
   modern UI". Stitched pockets for skilling gems, brass settings on each worn level-80+ piece for combat gems, and the loose gems from
   your bag along the bottom. Drag a gem where it goes (or click it, then click where); drag one out to the loose row to take it out,
   which asks first, because it comes back unsorted. */
export function createGems(E) {
  const { G, $, esc, send, SFX, ico, openWin } = E, S_ = G.GEMSET, calm = () => !!E.calm?.();
  const UIA = "/v3/assets/img/glad/flat/ui/";
  let v = null, err = null;
  /* ---- the Sorter's state */
  let sorter = null, loaded = -1, spinning = false, reel = null, lastRoll = null, target = 9, budget = 100000;
  const session = { rolls: 0, spent: 0, best: null, strip: [] };
  /* ---- the Satchel's state */
  let satchel = null, held = null, ask = null, note = "";

  const bagGems = () => (E.me?.inv || []).map((s, i) => ({ s, i })).filter(({ s }) => G.isGem(s.k));
  const pct = (r) => `${r > 0 ? "+" : ""}${r}%`;
  const band = (r) => (r == null ? "Unsorted" : G.gemBand(r));
  const bandCls = (r) => (r == null ? "raw" : band(r).toLowerCase());
  const gemName = (k) => G.ITEMS[k]?.name || k;
  const kindOf = (k) => G.GEM_OF[k]?.where === "gear" ? "combat" : "skilling";

  function frame(id, cls, title) {
    const w = document.createElement("section"); w.className = `win ${cls}`; w.id = id; w.hidden = true; w.setAttribute("aria-label", title);
    w.innerHTML = `<div class="win-head"><b>${title}</b><small class="gx-sub"></small><button type="button" class="win-x" aria-label="Close">×</button></div><div class="win-body"></div>`;
    ($("jukeWin")?.parentElement || document.querySelector(".game") || document.body).append(w);
    w.querySelector(".win-x").addEventListener("click", () => { SFX.play("ui_close"); w.hidden = true; held = null; ask = null; });
    return w;
  }

  /* ================================================================ THE GEM SORTER */
  const odds = () => G.GEM_BANDS.map(([n, lo, hi]) => ({ n, lo, hi, p: ((hi - lo + 1) / (S_.roll[1] - S_.roll[0] + 1)) * 100 }));
  function loadedGem() { const s = E.me?.inv?.[loaded]; return s && G.isGem(s.k) ? s : null; }
  function renderSorter() {
    if (!sorter || sorter.hidden) return;
    const cost = v?.cost ?? S_.cost, gem = loadedGem(), cur = gem ? G.rollOf(gem) : null, gems = bagGems();
    if (!gem) loaded = -1;
    sorter.querySelector(".gx-sub").textContent = `${G.fmtTix(cost)} a pull`;
    const shown = reel != null ? reel : lastRoll != null && gem && loaded === lastRoll.i ? lastRoll.roll : cur;
    const perfectAlready = cur != null && cur >= S_.roll[1];
    sorter.querySelector(".win-body").innerHTML = `<div class="sx">
      <div class="sx-marquee"><span class="sx-bulbs"></span><b>GEM&nbsp;SORTER</b><span class="sx-bulbs"></span></div>
      <div class="sx-main">
        <div class="sx-tray"><h4>Your gems</h4>${gems.length ? gems.map(({ s, i }) => { const r = G.rollOf(s); return `<button type="button" class="sx-gem ${bandCls(r)}${i === loaded ? " on" : ""}" data-load="${i}" title="${esc(`${gemName(s.k)}: ${kindOf(s.k)} gem, ${r == null ? "unsorted" : pct(r)}`)}">${ico(s.k)}<em>${r == null ? "?" : pct(r)}</em>${s.n > 1 ? `<u>×${s.n}</u>` : ""}</button>`; }).join("") : `<p class="sx-none">No gems. Every skill turns one up now and then at level ${S_.dropLvl}+.</p>`}</div>
        <div class="sx-cab">
          <div class="sx-globe${spinning ? " spin" : ""}">${gem ? `<span class="sx-in">${ico(gem.k)}</span>` : `<span class="sx-empty">pick a gem</span>`}</div>
          <div class="sx-name">${gem ? `${esc(gemName(gem.k))} <small>${kindOf(gem.k)}</small>` : "&nbsp;"}</div>
          <div class="sx-reel ${shown == null ? "raw" : bandCls(shown)}${spinning ? " spin" : ""}"><strong>${shown == null ? "--" : pct(shown)}</strong><span>${spinning ? "rolling…" : shown == null ? (gem ? "unsorted" : "") : band(shown)}</span></div>
          <button type="button" class="sx-pull" id="sxPull"${!gem || spinning || perfectAlready ? " disabled" : ""}><b>${perfectAlready ? "ALREADY PERFECT" : "PULL"}</b><small>${G.fmtTix(cost)}${gem ? " · space" : ""}</small></button>
          <div class="sx-auto"><label>Roll until <select id="sxT">${Array.from({ length: S_.roll[1] - 2 }, (_, k) => S_.roll[1] - k).map((t) => `<option value="${t}"${t === target ? " selected" : ""}>${pct(t)}</option>`).join("")}</select></label>
            <label>spending up to <select id="sxB">${[50000, 100000, 250000, 500000, 1000000].map((b) => `<option value="${b}"${b === budget ? " selected" : ""}>${G.fmtTix(b)}</option>`).join("")}</select></label>
            <button type="button" class="sx-go" id="sxAuto"${!gem || spinning ? " disabled" : ""}>AUTO</button></div>
          ${gem && cur != null ? `<button type="button" class="sx-sell" id="sxSell">Sell this gem for ${G.fmtTix(S_.sell)}</button>` : gem ? `<button type="button" class="sx-sell" id="sxSell">Sell it unsorted for ${G.fmtTix(S_.sell)}</button>` : ""}
        </div>
        <div class="sx-side"><h4>The odds, every pull</h4>${odds().map((o) => `<div class="sx-odd ${o.n.toLowerCase()}"><b>${o.n}</b><span>${o.lo === o.hi ? pct(o.lo) : `${pct(o.lo)} to ${pct(o.hi)}`}</span><em>${o.p.toFixed(o.p < 10 ? 2 : 1)}%</em></div>`).join("")}
          <p class="sx-fine">A perfect +${S_.roll[1]}% is 1 pull in ${S_.roll[1] - S_.roll[0] + 1}: about ${G.fmtTix(cost * (S_.roll[1] - S_.roll[0] + 1))} on average. Each pull replaces the last.</p>
          <h4>This sitting</h4><div class="sx-stats"><span><b>${session.rolls}</b> pulls</span><span><b>${G.fmtTix(session.spent)}</b> spent</span><span><b>${session.best == null ? "--" : pct(session.best)}</b> best</span></div></div>
      </div>
      <div class="sx-strip">${session.strip.map((r) => `<i class="${bandCls(r)}">${pct(r)}</i>`).join("") || `<small>Your last pulls light up here.</small>`}</div>
      ${err ? `<p class="sx-err">${esc(err)}</p>` : ""}</div>`;
    const b = sorter.querySelector(".win-body");
    b.querySelectorAll("[data-load]").forEach((x) => x.addEventListener("click", () => { if (spinning) return; loaded = +x.dataset.load; lastRoll = null; err = null; SFX.play("chip", { vol: 0.5 }); renderSorter(); }));
    $("sxPull")?.addEventListener("click", pull);
    $("sxAuto")?.addEventListener("click", auto);
    $("sxT")?.addEventListener("change", (e) => { target = +e.target.value; });
    $("sxB")?.addEventListener("change", (e) => { budget = +e.target.value; });
    $("sxSell")?.addEventListener("click", (e) => { const x = e.currentTarget; if (x.dataset.armed !== "1") { x.dataset.armed = "1"; x.textContent = "Sure? Click again to sell"; return; } SFX.play("coins", { vol: 0.6 }); send({ t: "gems", op: "sell", i: loaded }); loaded = -1; });
  }
  let spinTimer = null, spinStart = 0;
  function startSpin() {
    spinning = true; spinStart = performance.now(); err = null; SFX.play("slots_spin", { vol: 0.35 });
    clearInterval(spinTimer); if (!calm()) spinTimer = setInterval(() => { reel = S_.roll[0] + Math.floor(Math.random() * (S_.roll[1] - S_.roll[0] + 1)); const r = sorter?.querySelector(".sx-reel strong"); if (r) r.textContent = pct(reel); }, 70);
    renderSorter();
  }
  function stopSpin() { clearInterval(spinTimer); spinTimer = null; reel = null; spinning = false; }
  function pull() {
    const gem = loadedGem(); if (!gem || spinning) return;
    if (G.rollOf(gem) != null && G.rollOf(gem) >= S_.roll[1]) { err = "That one's already perfect. Pick another gem."; SFX.play("ui_error"); return renderSorter(); }
    startSpin(); send({ t: "gems", op: "sort", i: loaded });
  }
  function auto() {
    const gem = loadedGem(); if (!gem || spinning) return;
    if (G.rollOf(gem) != null && G.rollOf(gem) >= target) { err = `It's already at ${pct(G.rollOf(gem))}. Pick a higher number.`; SFX.play("ui_error"); return renderSorter(); }
    startSpin(); send({ t: "gems", op: "auto", i: loaded, target, budget });
  }
  const land = (roll, k) => {
    session.rolls++; session.best = session.best == null ? roll : Math.max(session.best, roll); session.strip = [roll, ...session.strip].slice(0, 16);
    SFX.play(roll >= S_.roll[1] ? "win_big" : roll >= 7 ? "win_small" : roll >= 0 ? "chip" : "lose", { vol: roll >= 7 ? 0.9 : 0.6 });
    if (roll >= S_.roll[1]) E.winFx?.(`${gemName(k)} +${roll}%`, "", "PERFECT!");
    else if (roll === S_.roll[1] - 1) E.toast?.("So close!");
  };
  async function played(e) {
    const wait = (ms) => new Promise((r) => setTimeout(r, calm() ? 0 : ms));
    if (e.rolled) {
      await wait(Math.max(0, 750 - (performance.now() - spinStart)));
      stopSpin(); session.spent += v?.cost ?? S_.cost; loaded = e.rolled.i >= 0 ? e.rolled.i : loaded; lastRoll = { ...e.rolled };
      land(e.rolled.roll, e.rolled.k); renderSorter(); renderSatchel(); return;
    }
    if (e.auto) {
      const a = e.auto;
      for (let n = 0; n < a.rolls.length - 1 && !calm(); n++) { reel = a.rolls[n]; session.strip = [a.rolls[n], ...session.strip].slice(0, 16); renderSorter(); SFX.play("chip", { vol: 0.25 }); await wait(a.rolls.length > 20 ? 60 : 140); }
      if (calm()) session.strip = [...a.rolls.slice(0, -1).reverse(), ...session.strip].slice(0, 16);
      stopSpin(); session.rolls += a.rolls.length - 1; session.spent += a.spent; loaded = a.i >= 0 ? a.i : loaded; lastRoll = { k: a.k, roll: a.rolls.at(-1), i: a.i };
      session.best = Math.max(session.best ?? -99, ...a.rolls);
      land(a.rolls.at(-1), a.k); if (!a.hit) err = `Stopped at ${pct(a.rolls.at(-1))} after ${a.rolls.length} pulls (${G.fmtTix(a.spent)}): the budget or your tickets ran out.`;
      renderSorter(); renderSatchel();
    }
  }
  document.addEventListener("keydown", (e) => { if (e.code !== "Space" || !sorter || sorter.hidden || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return; e.preventDefault(); pull(); });

  /* ================================================================ THE GEM SATCHEL */
  const slotName = (sl) => ({ weapon: "Weapon", helm: "Helm", body: "Body", legs: "Legs", shield: "Off-hand", gloves: "Gloves", boots: "Boots", amulet: "Amulet", ring: "Ring" })[sl] || sl;
  function renderSatchel() {
    if (!satchel || satchel.hidden) return;
    const gc = v?.gc || G.caseOf(E.me || {}), worn = Object.entries(v?.worn || {}), gems = bagGems(), bonus = v?.bonus || {}, rolls = G.gemRolls(E.me || {});
    satchel.querySelector(".gx-sub").textContent = `${gc.g.filter(Boolean).length} of ${gc.n} pockets`;
    const gemEl = (k, r, drag, extra = "") => `<span class="gs-gem ${bandCls(r)}${held === drag ? " held" : ""}" draggable="true" data-drag="${drag}" title="${esc(`${gemName(k)} ${r == null ? "(unsorted)" : pct(r)}: ${G.GEM_OF[k]?.does || ""}`)}">${ico(k)}${r == null ? "" : `<em>${pct(r)}</em>`}${extra}</span>`;
    const pockets = gc.g.map((g, s) => `<div class="gs-pocket${g ? " full" : ""}" data-drop="case:${s}">${g ? gemEl(g.k, g.roll, `case:${s}`) : ""}</div>`).join("")
      + (gc.n < S_.caseMax ? `<div class="gs-pocket sewn" title="Sewn shut. Sal opens more pockets: a Gem Case Hinge (to 6), Frame (to 9) or Heart (to 12). Use it from your bag."><span>+</span></div>` : "");
    const settings = worn.length ? worn.map(([sl, w]) => `<div class="gs-piece"><span class="gs-pic" title="${esc(gemName(w.k))}">${ico(w.k)}</span><span class="gs-pn"><b>${slotName(sl)}</b></span>
        <span class="gs-sets">${w.socks.map((g, s) => `<span class="gs-set${g ? " full" : ""}" data-drop="sock:${sl}:${s}">${g ? gemEl(g.k, g.roll, `sock:${sl}:${s}`) : ""}</span>`).join("")}${Array.from({ length: w.max - w.socks.length }, () => `<span class="gs-set blank" title="No setting punched here yet"></span>`).join("")}</span>
        ${w.socks.length < w.max ? `<button type="button" class="gs-punch" data-punch="${sl}" title="Punch ${w.socks.length ? "a second" : "a"} setting: uses a ${w.socks.length ? "Master Punch" : "Socket Punch"} from your bag">+</button>` : ""}</div>`).join("")
      : `<p class="gs-quiet">Nothing you're wearing takes gems. Settings go on level ${S_.minLvl}+ gear: one each, two on a weapon.</p>`;
    const loose = gems.length ? gems.map(({ s, i }) => gemEl(s.k, G.rollOf(s), `bag:${i}`, s.n > 1 ? `<u>×${s.n}</u>` : "")).join("") : `<p class="gs-quiet">No loose gems. Found ones land here; the Gem Sorter in the Yard rolls them.</p>`;
    const working = Object.keys(bonus).filter((k) => bonus[k] || (rolls[k] || []).length);
    satchel.querySelector(".win-body").innerHTML = `<div class="gs">
      <div class="gs-flap"><span class="gs-buckle"></span></div>
      <div class="gs-cols"><div>
        <div class="gs-sec"><h4>Pockets <small>skilling gems, always working</small></h4><div class="gs-pockets">${pockets}</div></div>
        <div class="gs-sec gs-loose" data-drop="tray"><h4>Loose gems <small>drag into a pocket or a setting</small></h4><div class="gs-row">${loose}</div></div>
      </div><div>
        <div class="gs-sec"><h4>Settings <small>combat gems, on what you wear</small></h4><div class="gs-pieces">${settings}</div></div>
      </div></div>
      ${working.length ? `<div class="gs-work">${working.map((k) => `<span class="${bandCls(bonus[k])}">${ico(k)}<b>${pct(bonus[k])}</b> ${esc(G.GEM_OF[k]?.does || "")}${(rolls[k] || []).length > S_.perType ? ` <i>(your best ${S_.perType})</i>` : ""}</span>`).join("")}</div>` : ""}
      <p class="gs-note">${esc(note || err || (held ? "Now click where it goes." : `Only your best ${S_.perType} of each kind count.`))}</p>
      ${ask ? `<div class="gs-ask"><div class="gs-card"><p>${esc(ask.text)}</p><button type="button" class="gs-yes" id="gsYes">Take it out</button><button type="button" class="gs-no" id="gsNo">Leave it</button></div></div>` : ""}</div>`;
    const b = satchel.querySelector(".win-body");
    b.querySelectorAll("[data-drag]").forEach((x) => {
      x.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/plain", x.dataset.drag); e.dataTransfer.effectAllowed = "move"; held = x.dataset.drag; SFX.play("chip", { vol: 0.35 }); });
      x.addEventListener("dragend", () => { if (held === x.dataset.drag) held = null; });
      x.addEventListener("click", (e) => { e.stopPropagation(); if (held && held !== x.dataset.drag && x.closest("[data-drop]")) return drop(held, x.closest("[data-drop]").dataset.drop); held = held === x.dataset.drag ? null : x.dataset.drag; note = ""; SFX.play("ui_click"); renderSatchel(); });
    });
    b.querySelectorAll("[data-drop]").forEach((t) => {
      t.addEventListener("dragover", (e) => { e.preventDefault(); t.classList.add("over"); });
      t.addEventListener("dragleave", () => t.classList.remove("over"));
      t.addEventListener("drop", (e) => { e.preventDefault(); t.classList.remove("over"); drop(e.dataTransfer.getData("text/plain") || held, t.dataset.drop); });
      t.addEventListener("click", () => { if (held) drop(held, t.dataset.drop); });
    });
    b.querySelectorAll("[data-punch]").forEach((x) => x.addEventListener("click", () => { SFX.play("chip"); send({ t: "gems", op: "punch", slot: x.dataset.punch }); }));
    $("gsYes")?.addEventListener("click", () => { const a = ask; ask = null; SFX.play("ui_click"); a?.yes(); renderSatchel(); });
    $("gsNo")?.addEventListener("click", () => { ask = null; renderSatchel(); });
  }
  /* a gem moved: from "bag:i" / "case:s" / "sock:slot:s" to "case:s" / "sock:slot:s" / "tray" */
  function drop(from, to) {
    held = null; note = ""; err = null; if (!from || !to || from === to) return renderSatchel();
    const [fk, a, b2] = from.split(":"), [tk, c, d] = to.split(":");
    if (fk === "bag") {
      const st = E.me?.inv?.[+a]; if (!st || !G.isGem(st.k)) return renderSatchel();
      const r = G.rollOf(st), kind = G.GEM_OF[st.k].where;
      if (tk === "tray") return renderSatchel();
      if (r == null) { note = `That ${gemName(st.k).toLowerCase()} is unsorted. The Gem Sorter in the Yard's Market Square rolls it first.`; SFX.play("ui_error"); return renderSatchel(); }
      if (tk === "case") { if (kind !== "case") { note = `A ${gemName(st.k).toLowerCase()} is a combat gem: it goes in a setting, not a pocket.`; SFX.play("ui_error"); return renderSatchel(); } SFX.play("chip", { vol: 0.6 }); return send({ t: "gems", op: "case", s: +c, i: +a }); }
      if (tk === "sock") { if (kind !== "gear") { note = `A ${gemName(st.k).toLowerCase()} is a skilling gem: it goes in a pocket.`; SFX.play("ui_error"); return renderSatchel(); } SFX.play("chip", { vol: 0.6 }); return send({ t: "gems", op: "socket", slot: c, s: +d, i: +a }); }
    }
    if ((fk === "case" || fk === "sock") && tk === "tray") {
      const g = fk === "case" ? (v?.gc || G.caseOf(E.me)).g[+a] : v?.worn?.[a]?.socks?.[+b2]; if (!g) return renderSatchel();
      ask = { text: `Take the ${gemName(g.k).toLowerCase()} ${pct(g.roll)} out? It comes back unsorted: it'll need a roll at the Sorter to go back in.`, yes: () => send(fk === "case" ? { t: "gems", op: "caseout", s: +a } : { t: "gems", op: "pull", slot: a, s: +b2 }) };
      return renderSatchel();
    }
    note = "Take it out first (drag it to the loose gems), then put it where you want it."; renderSatchel();
  }

  return {
    openSorter() { sorter ||= frame("gemWin", "sx-win", "The Gem Sorter"); openWin("gemWin"); err = null; renderSorter(); },
    openCase() { satchel ||= frame("gemCaseWin", "gs-win", "Gem Satchel"); openWin("gemCaseWin"); err = null; note = ""; send({ t: "gems", op: "view" }); renderSatchel(); },
    got(e) {
      v = e.view; if (!e.rolled && !e.auto) err = null;
      if (e.open === "sorter") this.openSorter();
      if (e.rolled || e.auto) played(e); else { if (spinning && !e.rolled) stopSpin(); renderSorter(); renderSatchel(); }
      if (e.punched || e.socketed || e.cased) SFX.play("task_done");
    },
    oops(t) { err = t; stopSpin(); SFX.play("ui_error"); renderSorter(); renderSatchel(); },
    bag() { if (!spinning) renderSorter(); renderSatchel(); }
  };
}

export const CSS = `
/* ---------- (2026-09-28) THE GEM SORTER: a casino cabinet ---------- */
.sx-win{width:min(900px,calc(100% - 20px))}.sx-win .win-body{padding:0;overflow:auto;max-height:calc(100vh - 120px)}
.sx{background:radial-gradient(ellipse at 50% 0%,#5a1a6a 0%,#2a0c3a 45%,#12061c 100%);color:#fbe9ff;padding:0 0 12px;font-family:Lora,serif}
.sx-marquee{display:flex;align-items:center;justify-content:center;gap:14px;padding:10px 12px;background:linear-gradient(#3a0c28,#1c0616);border-bottom:3px solid #e8bf35;box-shadow:0 0 18px rgba(255,80,200,.35) inset}
.sx-marquee b{font:900 28px Cinzel,serif;letter-spacing:.14em;color:#ffe27a;text-shadow:0 0 6px #ff5ad0,0 0 14px #ff5ad0,0 2px 0 #000}
.sx-bulbs{flex:1;max-width:220px;height:10px;background:radial-gradient(circle,#fff6b0 0 2.5px,#e8a020 3px,transparent 4px) 0 50%/14px 10px repeat-x;animation:sxBulbs 1.2s steps(2) infinite}@keyframes sxBulbs{50%{filter:brightness(.45)}}
.sx-main{display:grid;grid-template-columns:170px 1fr 220px;gap:12px;padding:12px}
.sx h4{margin:0 0 8px;font:800 12px Cinzel,serif;letter-spacing:.1em;text-transform:uppercase;color:#ffcf6a}
.sx-tray{display:flex;flex-wrap:wrap;gap:6px;align-content:start;max-height:430px;overflow:auto;padding:8px;border-radius:10px;background:rgba(0,0,0,.3);box-shadow:inset 0 0 0 1px rgba(232,191,53,.35)}.sx-tray h4{width:100%}
.sx-gem{position:relative;width:46px;height:46px;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#5a3a70,#200a2c);box-shadow:inset 0 0 0 2px #6a4a80}.sx-gem img{width:28px;height:28px;image-rendering:pixelated}
.sx-gem em{position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);font:900 9.5px Lora,serif;font-style:normal;padding:0 4px;border-radius:6px;background:#1a0a22;white-space:nowrap}.sx-gem u{position:absolute;top:-4px;right:-4px;text-decoration:none;font:900 9px Lora,serif;background:#e8bf35;color:#2a1600;border-radius:6px;padding:0 3px}
.sx-gem.on{box-shadow:inset 0 0 0 3px #ffe27a,0 0 12px #ffcf3a}.sx-none{font-size:12px;opacity:.8}
.sx-cab{display:grid;justify-items:center;gap:8px;padding:12px;border-radius:18px;background:linear-gradient(#6a1440,#3a0a26);box-shadow:inset 0 0 0 3px #e8bf35,inset 0 0 0 7px #3a0a26,inset 0 0 0 9px #c8963a,0 10px 24px rgba(0,0,0,.6)}
.sx-globe{width:150px;height:150px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.55),rgba(160,220,255,.12) 40%,rgba(40,20,80,.5) 75%);box-shadow:inset 0 -12px 24px rgba(0,0,0,.45),0 0 0 6px #c8963a,0 0 0 9px #5a2a10,0 0 24px rgba(120,200,255,.35)}
.sx-in img{width:72px;height:72px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(255,255,255,.6))}.sx-globe.spin .sx-in{animation:sxShake .18s linear infinite}@keyframes sxShake{25%{transform:translate(2px,-2px) rotate(8deg)}75%{transform:translate(-2px,2px) rotate(-8deg)}}
.sx-empty{font:700 13px Lora,serif;opacity:.7}.sx-name{font:800 15px Cinzel,serif}.sx-name small{font:700 11px Lora,serif;opacity:.7;text-transform:uppercase;letter-spacing:.06em}
.sx-reel{width:210px;padding:6px 10px;border-radius:10px;text-align:center;background:#07020a;box-shadow:inset 0 0 0 3px #3a2a10,inset 0 6px 12px rgba(0,0,0,.8)}.sx-reel strong{display:block;font:900 44px/1 Cinzel,serif;font-variant-numeric:tabular-nums}.sx-reel span{display:block;font:900 12px Lora,serif;letter-spacing:.14em;text-transform:uppercase}
.sx-reel.spin strong{color:#fff;filter:blur(.4px)}
.perfect{--c:#ffd84a}.brilliant{--c:#c678ff}.fine{--c:#5ab4ff}.rough{--c:#9ec59a}.cracked{--c:#ff6a5a}.raw{--c:#bba8c8}
.sx-reel strong,.sx-reel span{color:var(--c)}.sx-reel.perfect{box-shadow:inset 0 0 0 3px #ffd84a,0 0 22px #ffcf3a;animation:sxWin .5s ease-in-out 3}@keyframes sxWin{50%{transform:scale(1.06)}}
.sx-gem em{color:var(--c)}
.sx-pull{width:210px;padding:10px;border:0;border-radius:14px;cursor:pointer;background:radial-gradient(circle at 50% 30%,#ff5a5a,#b01818 70%);box-shadow:0 6px 0 #5a0808,inset 0 0 0 3px #ffb0b0;color:#fff;text-shadow:0 2px 0 #5a0808}.sx-pull b{display:block;font:900 26px Cinzel,serif;letter-spacing:.1em}.sx-pull small{font:800 12px Lora,serif}
.sx-pull:active:not(:disabled){transform:translateY(4px);box-shadow:0 2px 0 #5a0808,inset 0 0 0 3px #ffb0b0}.sx-pull:disabled{filter:grayscale(.7) brightness(.7);cursor:default}
.sx-auto{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px;font:700 12px Lora,serif}.sx-auto select{font:800 12px Lora,serif;padding:2px 4px;border-radius:6px;background:#1a0a22;color:#ffe27a;border:1px solid #c8963a}
.sx-go{padding:5px 14px;border:0;border-radius:8px;cursor:pointer;background:linear-gradient(#ffe27a,#c8963a);color:#2a1600;font:900 13px Cinzel,serif;box-shadow:0 3px 0 #5a3a08}.sx-go:disabled{filter:grayscale(.8);cursor:default}
.sx-sell{border:0;background:none;color:#e8c8ff;font:700 12px Lora,serif;text-decoration:underline;cursor:pointer;opacity:.85}
.sx-side{padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.3);box-shadow:inset 0 0 0 1px rgba(232,191,53,.35)}
.sx-odd{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:4px 6px;border-radius:6px;margin-bottom:3px;background:rgba(255,255,255,.04);font:700 12.5px Lora,serif}.sx-odd b{color:var(--c)}.sx-odd em{font-style:normal;font-weight:900;color:#ffe27a}
.sx-fine{margin:6px 0 12px;font:600 11.5px/1.4 Lora,serif;opacity:.8}.sx-stats{display:grid;gap:4px;font:600 12px Lora,serif}.sx-stats b{color:#ffe27a;font-weight:900}
.sx-strip{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;padding:4px 12px}.sx-strip i{font-style:normal;font:900 12px Lora,serif;padding:3px 8px;border-radius:99px;background:#1a0a22;color:var(--c);box-shadow:inset 0 0 0 1.5px var(--c)}.sx-strip small{opacity:.7}
.sx-err{margin:6px 12px 0;text-align:center;font:800 13px Lora,serif;color:#ff9a8a}
@media (max-width:760px){.sx-main{grid-template-columns:1fr}.sx-tray{max-height:none}}
@media (prefers-reduced-motion:reduce){.sx-bulbs,.sx-globe.spin .sx-in,.sx-reel.perfect{animation:none}}

/* ---------- (2026-09-28) THE GEM SATCHEL: leather, stitching and brass ---------- */
.gs-win{width:min(820px,calc(100% - 20px))}
.gs-win .win-head{background:linear-gradient(#6a3a1c,#4a2410);border-bottom:2px dashed #d8a860;box-shadow:inset 0 -6px 0 #3a1a08}
.gs-win .win-head b{font:900 18px Cinzel,serif;color:#f5d9a0;text-shadow:0 2px 0 #2a1004}.gs-win .win-head b::before{content:"";display:inline-block;width:26px;height:26px;margin-right:8px;vertical-align:-6px;background:url(${"/v3/assets/img/glad/flat/ui/gem_pouch.png?v=1"}) center/contain no-repeat;image-rendering:pixelated}
.gs-win .win-body{padding:0;overflow:auto;max-height:calc(100vh - 130px)}
.gs{position:relative;padding:16px 18px 12px;background:linear-gradient(rgba(92,46,18,.82),rgba(64,30,10,.9)),url(${"/v3/assets/img/glad/flat/ui/leather.png?v=1"}) 0 0/256px 256px,#6a3a1c;image-rendering:pixelated;color:#fbe8c8;font-family:Lora,serif;box-shadow:inset 0 0 0 6px rgba(40,16,4,.35)}
.gs::before{content:"";position:absolute;inset:6px;border:2px dashed rgba(245,210,150,.55);border-radius:14px;pointer-events:none}
.gs-flap{height:0}.gs-buckle{position:absolute;top:-4px;left:50%;width:44px;height:16px;transform:translateX(-50%);border-radius:0 0 8px 8px;background:linear-gradient(#ffe27a,#b8862a);box-shadow:0 2px 0 #5a3a08,inset 0 0 0 2px #7a5210}
.gs-sec{position:relative;margin-bottom:12px}.gs h4{margin:0 0 7px;font:900 13px Cinzel,serif;letter-spacing:.08em;color:#ffe0a0;text-shadow:0 1px 0 #2a1004}.gs h4 small{font:600 11px Lora,serif;letter-spacing:0;color:#e8c898;margin-left:6px}
.gs-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.gs-pockets{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.gs-pocket{aspect-ratio:1;border-radius:12px 12px 18px 18px;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 30%,rgba(0,0,0,.15),rgba(0,0,0,.45));box-shadow:inset 0 4px 8px rgba(0,0,0,.55),0 1px 0 rgba(255,220,160,.25);outline:2px dashed rgba(245,210,150,.45);outline-offset:-5px}
.gs-pocket.sewn{opacity:.5;background:rgba(0,0,0,.12);outline-style:dotted;outline-color:rgba(245,210,150,.35);color:rgba(245,210,150,.6);font:900 22px Cinzel,serif;cursor:help}
.gs-pocket.over,.gs-set.over,.gs-loose.over{box-shadow:inset 0 0 0 3px #ffe27a,0 0 12px rgba(255,220,100,.6)}
.gs-pieces{display:grid;gap:5px}.gs-piece{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:10px;background:rgba(30,12,2,.35);box-shadow:inset 0 0 0 1px rgba(245,210,150,.25)}
.gs-pic img{width:30px;height:30px;image-rendering:pixelated}.gs-pn{display:grid;min-width:62px}.gs-pn b{font:800 12px Cinzel,serif}.gs-pn small{font:600 11px Lora,serif;color:#e8c898}
.gs-sets{display:flex;gap:6px}.gs-set{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle,#1a0c04 55%,#b8862a 57%,#ffe27a 64%,#7a5210 72%);box-shadow:0 2px 3px rgba(0,0,0,.6)}.gs-set.blank{background:none;box-shadow:inset 0 0 0 2px rgba(245,210,150,.25);outline:2px dotted rgba(245,210,150,.3);outline-offset:-7px}
.gs-punch{margin-left:auto;width:28px;height:28px;border:0;border-radius:50%;cursor:pointer;background:linear-gradient(#ffe27a,#b8862a);color:#2a1600;font:900 17px/1 Lora,serif;box-shadow:0 2px 0 #5a3a08}
.gs-loose{padding:8px;border-radius:12px;background:rgba(20,8,2,.35);box-shadow:inset 0 3px 8px rgba(0,0,0,.5)}.gs-row{display:flex;flex-wrap:wrap;gap:8px;min-height:48px}
.gs-gem{position:relative;width:40px;height:40px;display:grid;place-items:center;cursor:grab;border-radius:50%;transition:transform .12s}.gs-gem img{width:32px;height:32px;image-rendering:pixelated;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6))}.gs-gem:hover{transform:scale(1.12)}
.gs-gem.held{transform:scale(1.18);filter:drop-shadow(0 0 8px #ffe27a)}.gs-gem em{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);font-style:normal;font:900 10px Lora,serif;padding:0 4px;border-radius:6px;background:#2a1004;color:var(--c);white-space:nowrap}.gs-gem u{position:absolute;top:-5px;right:-5px;text-decoration:none;font:900 9px Lora,serif;background:#ffe27a;color:#2a1600;border-radius:6px;padding:0 3px}
.gs-quiet{margin:4px 0;font:600 12px Lora,serif;color:#e8c898}
.gs-work{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.gs-work span{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:99px;background:rgba(20,8,2,.45);font:600 11.5px Lora,serif}.gs-work img{width:18px;height:18px;image-rendering:pixelated}.gs-work b{color:var(--c)}.gs-work i{opacity:.75}
.gs-note{margin:0;text-align:center;font:italic 700 12px Lora,serif;color:#ffe0a0}
.gs-ask{position:absolute;inset:0;display:grid;place-items:center;background:rgba(20,8,2,.6)}.gs-card{max-width:320px;padding:16px;border-radius:12px;text-align:center;background:url(${"/v3/assets/img/glad/flat/ui/leather.png?v=1"}) 0 0/128px 128px,#7a4424;box-shadow:inset 0 0 0 2px #d8a860,0 8px 24px rgba(0,0,0,.6)}.gs-card p{margin:0 0 12px;font:700 13px/1.45 Lora,serif}
.gs-yes,.gs-no{margin:0 4px;border:0;border-radius:8px;padding:6px 14px;cursor:pointer;font:800 12.5px Lora,serif}.gs-yes{background:linear-gradient(#ff7a6a,#b82a1a);color:#fff}.gs-no{background:linear-gradient(#ffe27a,#b8862a);color:#2a1600}
@media (max-width:720px){.gs-cols{grid-template-columns:1fr}}
`;
