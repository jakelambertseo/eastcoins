/* Work clothes, as a player would see them (2026-10-01). A MOCKUP run inside the real page on the dev server, like the Character window's:
   it adds a Work clothes row to the Equipment tab under the Character button and a Locker window, built only from the game's own classes
   and art (.ph, .eq, .lk-btn, .k-btn, .win, .win-head, .petrow, .jk-msg). Nothing is sent to the server: the owned pieces are pretend
   (Prospector's kit 3 of 4, the Ditched set 2 of 4). Load it with:
     (0,eval)(await (await fetch('/tools/workclothes-mock/inject.js?'+Date.now())).text()); */
(() => {
  const $ = (id) => document.getElementById(id);
  const IART = "/v3/assets/img/glad/flat/items/", MOCK = "/tools/skillsets-mock/";
  const art = (src) => `<img class="ico" src="${src}" alt="">`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const SLOT = ["helm", "body", "gloves", "boots"], SLOTNAME = { helm: "Hat", body: "Coat", gloves: "Gloves", boots: "Boots" };
  /* the fourteen, named; [piece name, art or null]. Owned = the pretend locker. */
  const SETS = [
    { sk: "mining", name: "The Prospector's kit", p: [["Lamp hat", MOCK + "pr_hat.png"], ["Work vest", MOCK + "pr_vest.png"], ["Wrist guards", MOCK + "pr_gloves.png"], ["Steel-toe boots", MOCK + "pr_boots.png"]], own: [1, 1, 1, 0], per: "+3% mining speed", full: "a second ore one swing in eight, gems 25% more often", from: "Agility: lost on the climb, 1 in 150 course finishes" },
    { sk: "thieving", name: "The Ditched set", p: [["Ditched hood", IART + "ditched_hood.png"], ["Ditched coat", IART + "ditched_coat.png"], ["Ditched gloves", IART + "ditched_gloves.png"], ["Ditched boots", IART + "ditched_boots.png"]], own: [1, 0, 1, 0], per: "+2.5% pickpocket, +3% speed", full: "one pocket in ten is picked twice", from: "Fishing: fished out of the river, 1 in 2,500 catches" },
    { sk: "woodcutting", name: "The Feller's flannels", p: [["Knit cap"], ["Flannel shirt"], ["Splitting gloves"], ["Caulk boots"]], per: "+3% chopping speed", full: "a second log one chop in eight, nests twice as often", from: "Thieving: in a mark's pocket, 1 in 400" },
    { sk: "fishing", name: "The Boardwalk oilskins", p: [["Sou'wester"], ["Oilskin coat"], ["Fingerless mitts"], ["Waders"]], per: "+2% bites, +2% speed", full: "a rare catch never gets away, +10% rare fish", from: "Farming: the scarecrow's coat, 1 in 300 harvests" },
    { sk: "cooking", name: "The short-order whites", p: [["Paper hat"], ["Diner whites"], ["Oven mitts"], ["Kitchen clogs"]], per: "+3% speed, 5% fewer burns", full: "nothing burns, one dish in ten comes out double", from: "Breeding: a pet's present, 1 in 25" },
    { sk: "breeding", name: "The kennel keeper's coat", p: [["Whistle cap"], ["Kibble coat"], ["Handling gloves"], ["Yard boots"]], per: "+3% breeding XP", full: "pairings a third quicker, one egg in ten a Greater", from: "Cooking: in a pet food batch, 1 in 200" },
    { sk: "smithing", name: "Bronny's leathers", p: [["Forge cap"], ["Leather apron"], ["Tong gloves"], ["Ember boots"]], per: "+3% smithing speed", full: "one bar in ten saved, reforges 10% likelier", from: "Bronny's orders: 1 in 6 finished" },
    { sk: "farming", name: "The groundskeeper's dungarees", p: [["Straw hat"], ["Dungarees"], ["Garden gloves"], ["Wellies"]], per: "+3% harvest", full: "+1 crop a harvest, crops never wither", from: "The Orchard Wall: the Gardener, 1 in 8" },
    { sk: "fungiculture", name: "The mycologist's mantle", p: [["Spore hood"], ["Mossy mantle"], ["Picking gloves"], ["Damp boots"]], per: "+3% mushroom yield", full: "one bed in five fruits twice", from: "Woodcutting: grown through deadwood, 1 in 800 chops" },
    { sk: "alchemy", name: "The apothecary's smock", p: [["Brass goggles"], ["Stained smock"], ["Rubber gloves"], ["Lab boots"]], per: "+3% brewing speed", full: "one brew in eight an extra potion, potions last 15% longer", from: "Fungiculture: under a wild cluster, 1 in 250 picks" },
    { sk: "fletching", name: "The bowyer's greens", p: [["Feathered cap"], ["Green jerkin"], ["Finger tabs"], ["Soft boots"]], per: "+3% fletching speed", full: "+2 arrows a set, one bow in ten at a better reforge", from: "Archery: anything with feathers, 1 in 500" },
    { sk: "wizardry", name: "The stargazer's robes", p: [["Star hat"], ["Night robe"], ["Inky gloves"], ["Velvet slippers"]], per: "+3% printing speed", full: "one batch in eight prints double", from: "Shooting Stars: the Star Tent, 40 fragments a piece" },
    { sk: "agility", name: "The getaway silks", p: [["Sweatband"], ["Track jacket"], ["Grip tape"], ["Racing flats"]], per: "+2% walking speed", full: "+20% agility XP, timed gates open a beat longer", from: "The Jackpot Thief: knocked loose, 1 in 60 hits" },
    { sk: "tinkering", name: "Sal's spare overalls", p: [["Welding mask"], ["Overalls"], ["Grease gloves"], ["Work boots"]], per: "+3% parts from salvage", full: "one salvage in eight doubles, gadgets last 20% longer", from: "The Trailer Park: the Junk King, 1 in 10" }];
  for (const s of SETS) s.own = s.own || [0, 0, 0, 0];
  let worn = 0;   /* the outfit on: an index into SETS */
  const SKN = (k) => k.charAt(0).toUpperCase() + k.slice(1);
  const sico = (k) => art(`${IART}skill_${k}.png`);
  const n = (s) => s.own.reduce((a, b) => a + b, 0);
  const bonusLine = (s) => { const c = n(s); return c === 4 ? `All four: ${s.full}` : `${c} piece${c === 1 ? "" : "s"} on: ${s.per.replace(/\+(\d+(?:\.\d+)?)%/g, (_, v) => `+${+(v * c).toFixed(1)}%`)}`; };

  if (!$("wkCss")) { const st = document.createElement("style"); st.id = "wkCss"; st.textContent = `
.wk{display:grid;grid-template-columns:repeat(4,58px);justify-content:center;gap:6px;align-items:center;margin:4px 6px 8px}
.wk .eq{width:58px;height:58px}.wk .eq .ico{width:70%;height:70%}.wk .eq.empty .ico{opacity:.35}
.wk-info{grid-column:1/-1;display:grid;gap:2px;padding:4px 2px 0;min-width:0;text-align:center;justify-items:center}.wk-info b{font:800 13.5px Cinzel,serif;color:#4a2a12}.wk-info small{font:700 12px/1.35 Lora,serif;color:#6a5a40}
.wk-info .lk-btn{margin-top:4px}
.phsep .wk-sk{display:inline-flex;align-items:center;gap:4px}.phsep .wk-sk .ico{width:16px;height:16px;image-rendering:pixelated}
#wkWin{width:min(900px,calc(100% - 28px))}
#wkWin .win-body{overflow:auto;padding:10px 12px 12px}
.wk-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 8px}.wk-top .k-note{flex:1 1 260px}
.wk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(390px,100%),1fr));gap:8px}
.wk-card{display:grid;grid-template-columns:auto 1fr auto;gap:4px 10px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(255,250,240,.7);box-shadow:0 1px 4px rgba(60,40,10,.12)}
.wk-card.on{background:#eaf2ff;box-shadow:inset 0 0 0 2px #2f6fd0}.wk-card.none{opacity:.72}
.wk-card>.sk{width:30px;height:30px}.wk-card>.sk .ico{width:30px;height:30px;image-rendering:pixelated}
.wk-card>b{font:800 14px Cinzel,serif;color:#4a2a12}.wk-card>b small{display:block;font:800 10.5px Lora,serif;color:#8a7050;letter-spacing:.05em;text-transform:uppercase}
.wk-card .cnt{font:800 12px Lora,serif;color:#4a2a12;padding:2px 8px;border-radius:999px;background:#f1e2c0}.wk-card.full .cnt{background:#ffe08a}
.wk-pcs{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr) auto;gap:5px;align-items:center}
.wk-pc{display:grid;grid-template-columns:34px 1fr;gap:5px;align-items:center;font:700 11.5px/1.2 Lora,serif;color:#4a3a20}
.wk-pc .eq{width:34px;height:34px;cursor:default}.wk-pc .eq .ico{width:72%;height:72%}.wk-pc.no{color:#9a8a70}.wk-pc.no .eq .ico{opacity:.25}
.wk-txt{grid-column:1/-1;font:600 12px/1.45 Lora,serif;color:#5a4a30}.wk-txt b{color:#3a2210}
.wk-foot{margin:10px 0 0;font:600 12px/1.5 Lora,serif;color:#6a5a40}
`; document.head.append(st); }

  /* ---- the Equipment tab: the row under the Character button ---- */
  const rowHtml = () => { const s = SETS[worn];
    return `<div class="ph phsep" data-wk>Work clothes <small class="wk-sk">${sico(s.sk)} ${SKN(s.sk)}</small></div>
      <div class="wk" data-wk>${SLOT.map((sl, i) => s.own[i]
        ? `<button type="button" class="eq" title="${esc(s.p[i][0])} — ${esc(s.name)}. ${esc(s.per)}. Click to put it back in your locker.">${art(s.p[i][1])}<small>${esc(s.p[i][0].split(" ").pop())}</small></button>`
        : `<button type="button" class="eq empty" disabled title="${SLOTNAME[sl]}: none yet. ${esc(s.from)}">${art(`${IART}eq_${sl}.png`)}<small></small></button>`).join("")}
        <div class="wk-info"><b>${esc(s.name)} · ${n(s)}/4</b><small>${esc(bonusLine(s))}${n(s) < 4 ? `. All four: ${esc(s.full)}.` : "."}</small><button type="button" class="lk-btn" data-wkopen>Locker · ${SETS.filter(n).length} sets</button></div></div>`; };
  const place = () => { const p = $("panel"); if (!p || p.dataset.tab !== "equip") return; p.querySelectorAll("[data-wk]").forEach((e) => e.remove());
    const a = p.querySelector(".ch-entry") || p.querySelector(".bwield"); if (!a) return;
    a.insertAdjacentHTML("afterend", rowHtml()); p.querySelector("[data-wkopen]").onclick = () => open(); };

  /* ---- the Locker ---- */
  let win = $("wkWin");
  if (!win) { win = document.createElement("section"); win.className = "win k-win"; win.id = "wkWin"; win.hidden = true; win.setAttribute("aria-label", "Work clothes"); ($("msWin") || document.body.lastElementChild).after(win); }
  const card = (s, i) => { const c = n(s);
    return `<div class="wk-card${i === worn ? " on" : ""}${c ? "" : " none"}${c === 4 ? " full" : ""}"><span class="sk">${sico(s.sk)}</span><b><small>${SKN(s.sk)}</small>${esc(s.name)}</b><span class="cnt">${c}/4</span>
      <div class="wk-pcs">${s.p.map(([nm, src], j) => `<span class="wk-pc${s.own[j] ? "" : " no"}"><span class="eq">${art(s.own[j] ? src : `${IART}eq_${SLOT[j]}.png`)}</span>${s.own[j] ? esc(nm) : "?"}</span>`).join("")}
        ${i === worn ? `<button type="button" class="lk-btn" disabled>Wearing</button>` : c ? `<button type="button" class="lk-btn" data-wkwear="${i}">Wear</button>` : `<span></span>`}</div>
      <div class="wk-txt"><b>Each piece</b> ${esc(s.per)} · <b>All four</b> ${esc(s.full)}<br><b>Found</b> ${esc(s.from)}</div></div>`; };
  const paint = () => {
    const have = SETS.map((s, i) => [s, i]).sort((a, b) => n(b[0]) - n(a[0]));
    win.innerHTML = `<div class="win-head"><b><img src="${IART}eq_body.png" alt="" class="topi">Work clothes</b><small>your locker: every piece you've found</small><button type="button" class="win-x" aria-label="Close">×</button></div>
      <div class="win-body"><div class="wk-top"><span class="k-note">Work clothes sit beside your armour, never instead of it: they change nothing in a fight. One outfit on at a time, changed anywhere in one click. Found pieces come straight here, never into your bag.</span></div>
      <div class="wk-grid">${have.map(([s, i]) => card(s, i)).join("")}</div>
      <p class="wk-foot">A piece only helps its own skill, so the Prospector's kit does nothing at a fishing spot. Mixing sets is allowed, and each piece still gives its own bonus, but the all-four bonus needs one whole set. You never find a piece you already have.</p></div>`;
    win.querySelector(".win-x").onclick = () => { win.hidden = true; };
    win.querySelectorAll("[data-wkwear]").forEach((b) => b.onclick = () => { worn = +b.dataset.wkwear; paint(); place(); });
  };
  const open = () => { paint(); win.hidden = false; };
  window.__wk = { open, place, SETS, set worn(i) { worn = i; place(); } };
  place(); if (!window.__wkObs) { window.__wkObs = new MutationObserver(() => { if (!$("panel").querySelector("[data-wk]")) place(); }); window.__wkObs.observe($("panel"), { childList: true }); }
})();
