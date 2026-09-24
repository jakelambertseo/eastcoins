/* ============================================================
   EastScape: THE GEAR TOOLTIP — hover a piece of gear and see what it is and what swapping to it would do

   The owner, 2026-09-21: "build the compare gear tooltip that shows when you mouse over a piece of gear". The numbers were
   already worked out by the rules file (G.compareOf: what changes if this goes on instead of what is in that slot), but
   the only place they showed was the browser's own `title` text: grey, a second late, one line. This draws them properly:

       [icon] Bronze sword                     weapon
       Needs Combat 10                         (red when you aren't)
       +9 accuracy   +7 strength   swing 2.4s
       ── instead of your Wooden rudis ──
       Accuracy   +5      Strength   +5      Max hit  2 → 4      Swing  2.4s → 2.4s (left out when it doesn't change)
       click to wield, shift-click to drop…    (the hint the title carried)

   Green is better, red is worse, and a thing that does not change is not listed. Buffs (rings, amulets, the rare drops) are
   said in words, with what you would LOSE from the piece coming off.

   Loaded on the first hover over a piece of gear, never at login. It works on anything tagged with an item key
   (data-item / data-k / data-rm): the bag, the bank, what you're wearing, shops, trades, the wiki, the Prize Counter.
   A touch screen never sees it (there is no hover; a tap there wears the thing).

   createTip({ G, esc, ico, me }) -> { show(el, itemKey), hide() }
   ============================================================ */
export function createTip(env) {
  const { G, esc } = env, I = G.ITEMS;
  let box = null, over = null, stash = null;

  function make() {
    if (box) return box;
    const st = document.createElement("style");
    st.textContent = `#gearTip{position:fixed;z-index:90;width:236px;padding:9px 11px;pointer-events:none;background:var(--panel,#ead9b5);color:var(--panel-ink,#2a2016);border:3px solid var(--frame,#5a3a1e);border-radius:7px;box-shadow:0 10px 26px rgba(0,0,0,.55);font-size:12.5px;line-height:1.35}
#gearTip[hidden]{display:none}
#gearTip h5{margin:0;font-size:15px;color:#7a2a1a;display:flex;align-items:center;gap:6px}#gearTip h5 .ico,#gearTip h5 img{width:24px;height:24px;image-rendering:pixelated}
#gearTip h5 small{margin-left:auto;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6a5a40}
#gearTip .rq{font-weight:800;color:#6a5a40}#gearTip .rq.no{color:#b3261e}
#gearTip .own{margin:4px 0 0;font-weight:800}#gearTip .fx{margin:3px 0 0;color:#4a3a20}
#gearTip .vs{margin:7px 0 3px;padding-top:6px;border-top:1px solid rgba(90,58,30,.3);font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#6a5a40}
#gearTip dl{display:grid;grid-template-columns:1fr auto;gap:1px 10px;margin:0;font-weight:800}#gearTip dt{font-weight:700}
#gearTip .up{color:#1f7a34}#gearTip .down{color:#b3261e}#gearTip .same{color:#6a5a40}
#gearTip .hint{margin:6px 0 0;font-size:11px;color:#6a5a40}
#gearTip h5 span{display:flex;align-items:baseline;gap:4px;min-width:0}
#gearTip h5 .fg{font-style:normal;font-size:13px;font-weight:900;color:#8a5a08}
/* the reforge band: a filled strip rather than coloured text, the rule this panel's parchment already taught us */
#gearTip .forged{display:flex;flex-wrap:wrap;align-items:baseline;gap:3px 7px;margin:5px 0 0;padding:4px 7px;border-radius:5px;background:linear-gradient(#f2c94c,#dcae44);color:#2a2016;box-shadow:inset 0 0 0 1px rgba(90,58,30,.35)}
#gearTip .forged b{font-size:11px;font-weight:900;letter-spacing:.05em;text-transform:uppercase}
#gearTip .forged span{font-weight:800}`;
    document.head.append(st);
    box = document.createElement("div"); box.id = "gearTip"; box.hidden = true; box.setAttribute("role", "tooltip"); document.body.append(box);
    // it goes away the moment you stop pointing at the thing, click it, scroll or press a key
    document.addEventListener("pointerout", (e) => { if (over && !over.contains(e.relatedTarget)) hide(); });
    for (const ev of ["pointerdown", "keydown", "wheel"]) document.addEventListener(ev, hide, { capture: true, passive: true });
    addEventListener("blur", hide);
    return box;
  }
  const sign = (n) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`), secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
  const row = (label, text, dir) => `<dt>${label}</dt><dd class="${dir > 0 ? "up" : dir < 0 ? "down" : "same"}">${text}</dd>`;

  function html(k, hint, lvl = 0) {
    const me = env.me(), it = I[k], d = G.compareOf(me, k), worn = d.replacing ? I[d.replacing] : null, isWorn = d.replacing === k && Object.values(me.eq || {}).includes(k);
    const reqs = G.reqsOf(it).map((r) => `<span class="rq${G.lvlOf(me, r.skill) < r.lvl ? " no" : ""}">Needs ${esc(G.SKILLS[r.skill].name)} ${r.lvl}${G.lvlOf(me, r.skill) < r.lvl ? ` (you're ${G.lvlOf(me, r.skill)})` : ""}</span>`).join(" · ");
    const own = [it.acc && `${sign(it.acc)} accuracy`, it.str && `${sign(it.str)} strength`, it.def && `${sign(it.def)} defence`, it.slot === "weapon" && `swing ${secs(it.speed || G.SWING_MS)}`, it.spd && `${sign(it.spd)}% walking speed`].filter(Boolean).join(" · ");
    let vs = "";
    if (isWorn) vs = `<div class="vs">You're wearing this</div>`;
    else {
      const rows = [];
      for (const [q, label] of [["acc", "Accuracy"], ["str", "Strength"], ["def", "Defence"]]) if (d[q]) rows.push(row(label, sign(d[q]), d[q]));
      if (d.maxHit[0] !== d.maxHit[1]) rows.push(row("Max hit", `${d.maxHit[0]} → ${d.maxHit[1]}`, d.maxHit[1] - d.maxHit[0]));
      if (d.swingMs && d.swingMs[0] !== d.swingMs[1]) rows.push(row("Swing", `${secs(d.swingMs[0])} → ${secs(d.swingMs[1])}`, d.swingMs[0] - d.swingMs[1]));   // a shorter swing is the better one
      const spd = (it.spd || 0) - (worn?.spd || 0); if (spd) rows.push(row("Walking speed", `${sign(spd)}%`, spd));
      const gain = it.fx ? G.fxText(it.fx) : "", lose = worn?.fx ? G.fxText(worn.fx) : "";
      vs = `<div class="vs">${worn ? `Instead of your ${esc(worn.name)}` : "That slot is empty"}</div>${rows.length ? `<dl>${rows.join("")}</dl>` : `<div class="same">${worn ? "No change to your numbers." : ""}</div>`}`
        + (lose && lose !== gain ? `<div class="fx down">You'd lose: ${esc(lose)}.</div>` : "");
    }
    /* (2026-09-23, the owner) THE REFORGE IS ON THE CARD. The level rides the NAME, because that is what the piece
       is called now and what the bag badge says; and what it bought gets a band of its own, because on a tool the
       reforge buys speed while the stat line above is about swinging it — two different numbers that were
       impossible to tell apart when neither was labelled. */
    /* (2026-09-23) THE LEVEL COMES IN, it is not looked up. A reforge belongs to the piece now, so the card has to
       describe the one under the pointer — the +2 in your bag, the plain one on the market, the +3 on your back —
       and forgeLevel would have answered about whatever of that kind you are wearing for all three. */
    const fl = Math.max(0, Math.min(G.FORGE.max, lvl | 0)), gains = fl ? G.forgeGainTextAt(k, fl) : "";
    return `<h5>${env.ico(k)}<span>${esc(it.name)}${fl ? `<i class="fg">+${fl}</i>` : ""}</span><small>${esc(it.slot)}</small></h5>`
      + `${reqs ? `<div>${reqs}</div>` : ""}${own ? `<div class="own">${own}</div>` : ""}`
      + `${fl ? `<div class="forged"><b>Reforged +${fl}</b>${gains ? `<span>${esc(gains)}</span>` : ""}</div>` : ""}`
      + `${it.fx ? `<div class="fx up">Worn: ${esc(G.fxText(it.fx))}.</div>` : ""}${vs}${hint ? `<div class="hint">${esc(hint)}</div>` : ""}`;
  }
  /** beside the thing, on whichever side has room, never off the screen */
  function place(el) {
    const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight, gap = 10;
    let x = r.right + gap; if (x + w > innerWidth - 6) x = r.left - gap - w; if (x < 6) x = Math.max(6, Math.min(innerWidth - w - 6, r.left));
    let y = r.top; if (y + h > innerHeight - 6) y = innerHeight - h - 6; if (y < 6) y = 6;
    if (x < r.right && x + w > r.left && y < r.bottom && y + h > r.top) y = r.bottom + gap + h > innerHeight ? Math.max(6, r.top - gap - h) : r.bottom + gap;   // (no room on either side: go under or over it)
    box.style.left = `${Math.round(x)}px`; box.style.top = `${Math.round(y)}px`;
  }
  function show(el, k, lvl = 0) {
    if (!I[k]?.slot || !env.me() || !el.isConnected || !el.matches(":hover")) return;
    if (over === el) return; hide(); make(); over = el;
    /* the browser's own tooltip would come up over ours a second later: its text is put aside while ours is showing, and its last
       line (what a click does) becomes our footer */
    const t = el.getAttribute("title"); stash = t; if (t != null) el.removeAttribute("title");
    const lines = (t || "").split("\n"), hint = lines.length > 1 ? lines[lines.length - 1] : "";
    box.innerHTML = html(k, hint, lvl); box.hidden = false; place(el);
  }
  function hide() {
    if (!over) return; if (stash != null && over.isConnected) over.setAttribute("title", stash);
    over = null; stash = null; if (box) box.hidden = true;
  }
  return { show, hide };
}
