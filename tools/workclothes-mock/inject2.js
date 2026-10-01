/* Work clothes, two more places to put them (2026-10-01, the owner: "theres a lot of information ... in the users inventory tab right now.
   what are some other options?"). Runs AFTER inject.js (it reuses its Locker and its pretend locker) and removes inject.js's row.
     A. __wk2.doll(): an Armour | Work switch over the paper doll. Work turns the doll's own hat, coat, gloves and boots squares into the
        outfit, dims the rest, and swaps the combat strip for the outfit's numbers. Adds one switch's height to the tab.
     B. __wk2.chip(): one line under the Character button that opens the Locker, plus four pips on each skill's tile in the Skills tab.
   Mockup only: nothing is sent to the server. */
(() => {
  const $ = (id) => document.getElementById(id);
  const W = window.__wk, IART = "/v3/assets/img/glad/flat/items/";
  const art = (src) => `<img class="ico" src="${src}" alt="">`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  window.__wkObs?.disconnect(); window.__wkObs = null;
  const SLOT = ["helm", "body", "gloves", "boots"];
  let mode = "armour", shape = "doll";
  const set = () => W.SETS[0];   /* the Prospector's kit, 3 of 4 */
  const nOf = (s) => s.own.reduce((a, b) => a + b, 0);

  if (!$("wk2Css")) { const st = document.createElement("style"); st.id = "wk2Css"; st.textContent = `
.wk-sw{display:grid;grid-template-columns:1fr 1fr;gap:0;margin:6px 8px 0;border-radius:8px;overflow:hidden;box-shadow:inset 0 0 0 1.5px #8a7a5a}
.wk-sw button{border:0;padding:6px 4px;font:800 12.5px Lora,serif;color:#5a4a30;background:#e6dcc4;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
.wk-sw button .ico{width:16px;height:16px;image-rendering:pixelated}
.wk-sw button[aria-pressed=true]{background:#5a3220;color:#ffe27a}
.doll.wk-on .eq:not(.wk-pc2){opacity:.28;filter:grayscale(.6)}
.doll .eq.wk-pc2{box-shadow:0 0 0 2px #c8963a}.doll .eq.wk-pc2.empty .ico{opacity:.3}
.doll.wk-on .doll-fig{background:radial-gradient(ellipse at 50% 88%,rgba(90,60,20,.28),transparent 60%),linear-gradient(#efe1b8,#dcc58e)}
.wk-figtag{position:absolute;top:6px;left:0;right:0;text-align:center;font:800 11px Cinzel,serif;color:#5a3220;line-height:1.2;padding:0 4px}
.bstrip.wk-strip span{cursor:help}.bstrip.wk-strip span.off b{color:#9a8a70}
.wk-chip{display:flex;align-items:center;gap:8px;margin:0 8px 8px;padding:5px 8px;border-radius:10px;background:rgba(255,250,240,.7);box-shadow:0 1px 4px rgba(60,40,10,.12);cursor:pointer;border:0;width:calc(100% - 16px);text-align:left;font:inherit}
.wk-chip .pcs{display:flex;gap:2px}.wk-chip .pcs .ico{width:22px;height:22px;image-rendering:pixelated}.wk-chip .pcs .no{opacity:.22}
.wk-chip b{font:800 12.5px Cinzel,serif;color:#4a2a12;flex:1;min-width:0}.wk-chip b small{display:block;font:700 11px Lora,serif;color:#6a5a40}
.wk-chip .go{font:800 16px Lora,serif;color:#8a6a3a}
.skt{position:relative}.skt .wkpips{position:absolute;left:4px;top:4px;display:flex;gap:1.5px}.skt .wkpips i{width:5px;height:5px;border-radius:1px;background:rgba(90,70,40,.22);box-shadow:inset 0 0 0 1px rgba(90,70,40,.35)}
.skt .wkpips i.on{background:#e0a52c;box-shadow:inset 0 0 0 1px #8a5a10}.skt .wkpips.full i{background:#ffd34a;box-shadow:0 0 3px #ffd34a}
`; document.head.append(st); }

  /* ---- A: the switch over the doll ---- */
  const workStrip = (s) => { const c = nOf(s), full = c === 4;
    const cell = (ic, v, lab, tip, off) => `<span class="${off ? "off" : ""}" title="${esc(tip)}"><i>${ic}</i><b>${v}</b><small>${lab}</small></span>`;
    return `<div class="bstrip wk-strip">${cell(art(`${IART}skill_${s.sk}.png`), `${c}/4`, "set", `${s.name}: ${c} of 4 pieces`)}${cell(art(`${IART}emerald_pickaxe.png`), `+${3 * c}%`, "speed", "Mining speed, +3% a piece")}${cell(art(`${IART}sapphire.png`), full ? "+25%" : "—", "gems", "Gems 25% more often: all four", !full)}${cell(art(`${IART}emerald_ore.png`), full ? "1 in 8" : "—", "2nd ore", "A second ore one swing in eight: all four", !full)}${cell(art(`${IART}eq_body.png`), W.SETS.filter(nOf).length, "sets", "Sets started in your locker")}</div>`; };
  const paintDoll = () => { const p = $("panel"); if (!p || p.dataset.tab !== "equip") return;
    p.querySelectorAll("[data-wk],[data-wk2]").forEach((e) => e.remove());
    const ph = p.querySelector(".ph"); const doll = p.querySelector(".doll"); if (!ph || !doll) return;
    ph.insertAdjacentHTML("afterend", `<div class="wk-sw" data-wk2><button type="button" data-m="armour" aria-pressed="${mode === "armour"}">${art(`${IART}eq_shield.png`)}Armour</button><button type="button" data-m="work" aria-pressed="${mode === "work"}">${art(`${IART}eq_body.png`)}Work clothes</button></div>`);
    p.querySelectorAll(".wk-sw button").forEach((b) => b.onclick = () => { mode = b.dataset.m; window.__es.renderPanel(); setTimeout(paint, 30); });
    if (mode !== "work") return;
    const s = set(); doll.classList.add("wk-on");
    SLOT.forEach((sl, i) => { const eq = doll.querySelector(`.eq[data-slot="${sl}"]`) || [...doll.children].find((e) => e.style.gridArea.startsWith(sl)); if (!eq) return;
      eq.classList.add("wk-pc2"); eq.classList.toggle("empty", !s.own[i]); eq.disabled = false;
      eq.innerHTML = `${art(s.own[i] ? s.p[i][1] : `${IART}eq_${sl}.png`)}<small>${s.own[i] ? esc(s.p[i][0].split(" ").pop()) : ""}</small>`;
      eq.title = s.own[i] ? `${s.p[i][0]}: ${s.per}` : `${["Hat", "Coat", "Gloves", "Boots"][i]}: none yet. ${s.from}`; });
    doll.querySelector(".doll-fig")?.insertAdjacentHTML("afterbegin", `<span class="wk-figtag" data-wk2>${esc(s.name)}<br><small style="font:700 10px Lora,serif">Mining</small></span>`);
    p.querySelector(".bstrip")?.replaceWith(Object.assign(document.createElement("div"), { innerHTML: workStrip(s) }).firstElementChild);
    const bw = p.querySelector(".bwield"); if (bw) bw.style.display = "block", bw.innerHTML = `${art(`${IART}skill_${s.sk}.png`)} <b>All four:</b>&nbsp;${esc(s.full)}`;
    const ce = p.querySelector(".ch-entry"); if (ce) ce.innerHTML = `<button type="button" class="k-btn sm" data-wkopen2><img src="${IART}eq_body.png" alt="">Locker</button><span class="k-note">${W.SETS.filter(nOf).length} sets started · change outfit</span>`;
    p.querySelector("[data-wkopen2]").onclick = () => W.open();
  };

  /* ---- B: one line, and pips on the skill tiles ---- */
  const paintChip = () => { const p = $("panel"); if (!p) return;
    if (p.dataset.tab === "equip") { p.querySelectorAll("[data-wk],[data-wk2]").forEach((e) => e.remove());
      const s = set(), a = p.querySelector(".ch-entry"); if (!a) return;
      a.insertAdjacentHTML("afterend", `<button type="button" class="wk-chip" data-wk2 title="Work clothes: open your locker"><span class="pcs">${s.p.map(([, src], i) => `<span class="${s.own[i] ? "" : "no"}">${art(s.own[i] ? src : `${IART}eq_${SLOT[i]}.png`)}</span>`).join("")}</span><b>${esc(s.name)} · ${nOf(s)}/4<small>Work clothes · +${3 * nOf(s)}% mining speed</small></b><span class="go">›</span></button>`);
      p.querySelector(".wk-chip").onclick = () => W.open(); }
    if (p.dataset.tab === "skills") p.querySelectorAll(".skt[data-skwiki]").forEach((t) => { if (t.querySelector(".wkpips")) return;
      const s = W.SETS.find((x) => x.sk === t.dataset.skwiki); if (!s) return; const c = nOf(s);
      t.insertAdjacentHTML("afterbegin", `<span class="wkpips${c === 4 ? " full" : ""}" title="${esc(s.name)}: ${c} of 4">${[0, 1, 2, 3].map((i) => `<i class="${s.own[i] ? "on" : ""}"></i>`).join("")}</span>`); });
  };
  const paint = () => (shape === "doll" ? paintDoll : paintChip)();
  window.__wk2 = { doll(m = "work") { shape = "doll"; mode = m; window.__es.renderPanel(); setTimeout(paint, 30); }, chip() { shape = "chip"; window.__es.renderPanel(); setTimeout(paint, 30); }, paint };
  if (!window.__wk2Obs) { window.__wk2Obs = new MutationObserver(() => { const p = $("panel"); if (p && !p.querySelector("[data-wk2]") && !p.querySelector(".wkpips")) paint(); }); window.__wk2Obs.observe($("panel"), { childList: true }); }
})();
