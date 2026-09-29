/* EASTSCAPE: MARKED CARDS (2026-09-29), the page's half; the server's is eastscape-worker/src/cards.js and the rules are in the shared file.
   One window, a blackjack table: your cards on the felt, the total, the tip you are working, and when it's your call, HIT or STAND with
   what standing pays right now. The tools you own (Peeking Glass, the Shoe, the Ace Up the Sleeve) sit under the table when they can be
   used. Kept plain on purpose (the owner, on the Gem Sorter: "its over done"): it looks like a card table, and nothing flashes.
   A small tracker sits at the top of the game while a hand is in play, so the tip is never more than a glance away. */
export function createCards(E) {
  const { G, $, esc, send, SFX, openWin } = E;
  let win = null, chip = null, hand = null, tools = {}, done = null, note = "";
  const T = (k) => G.CARDS.tiers[k];
  const red = (c) => c.s === 1 || c.s === 2;
  const face = (c, cls = "") => `<span class="mc-card ${red(c) ? "red" : ""} ${cls}"><b>${G.CARD_RANKS[c.r - 1]}</b><i>${G.CARD_SUITS[c.s]}</i><em>${G.CARD_SUITS[c.s]}</em></span>`;
  const back = (tier) => `<span class="mc-card back ${tier}"></span>`;
  const fmt = (n) => G.fmtTix(n);

  function frame() {
    const w = document.createElement("section"); w.className = "win mc-win"; w.id = "cardsWin"; w.hidden = true; w.setAttribute("aria-label", "Marked Card");
    w.innerHTML = `<div class="win-head"><b>Marked Card</b><small class="mc-sub"></small><button type="button" class="win-x" aria-label="Close">×</button></div><div class="win-body"></div>`;
    ($("jukeWin")?.parentElement || document.querySelector(".game") || document.body).append(w);
    w.querySelector(".win-x").addEventListener("click", () => { SFX.play("ui_close"); w.hidden = true; if (done) { done = null; } });
    w.addEventListener("click", (ev) => { const b = ev.target.closest("[data-op]"); if (!b || b.disabled) return; SFX.play("ui_click"); if (b.dataset.op === "close") { w.hidden = true; done = null; return; } send({ t: "cards", op: b.dataset.op }); });
    return w;
  }
  function paytable(tier) {
    const rows = [["low", "Under 17"], ["17", "17"], ["18", "18"], ["19", "19"], ["20", "20"], ["21", "21"], ["natural", "Blackjack (21 on two)"], ["charlie", "Five cards, no bust"], ["charlie21", "Five cards on 21"]];
    return `<details class="mc-pay"><summary>What a hand pays (${esc(T(tier).name)})</summary><table>${rows.map(([k, n]) => `<tr><td>${n}</td><td>${fmt(G.handPay(tier, k))}</td></tr>`).join("")}<tr><td>Each tip you finish</td><td>${fmt(T(tier).leg)}</td></tr><tr><td>Bust</td><td>just the tips</td></tr></table><p>Standing on 17 or better also brings a bundle of supplies, and any hand you don't bust can turn up one of the ${esc(T(tier).name)} uniques: the better the hand, the better the odds.</p></details>`;
  }
  function render() {
    if (!win || win.hidden) return;
    const body = win.querySelector(".win-body"), sub = win.querySelector(".mc-sub");
    if (done) {
      const d = done, won = d.result !== "bust" && d.result !== "fold";
      sub.textContent = `${T(d.tier).name} · ${T(d.tier).stakes}`;
      body.innerHTML = `<div class="mc-felt ${d.tier}"><div class="mc-row">${d.cards.map((c) => face(c)).join("")}</div>
        <div class="mc-total ${won ? "good" : "sad"}"><strong>${d.result === "fold" ? "Folded" : esc(G.RESULT_NAME[d.result])}</strong><span>${d.total}</span></div></div>
        <div class="mc-out"><p>${d.result === "fold" ? "You folded." : won ? `The hand pays <b>${fmt(d.pay)}</b>.` : "Over 21. The hand pays nothing."} The tips you ran paid <b>${fmt(d.won - (d.pay || 0))}</b>.</p>
        ${d.got?.length ? `<ul>${d.got.map(([k, n]) => `<li>${E.ico?.(k) || ""} ${n > 1 ? `${n} × ` : ""}${esc(G.ITEMS[k]?.name || k)}</li>`).join("")}</ul>` : ""}
        <button type="button" class="mc-btn" data-op="close">Close</button></div>`;
      return;
    }
    if (!hand) { sub.textContent = ""; body.innerHTML = `<div class="mc-out"><p>No hand in play. Flip a Marked Card from your bag to deal one.</p></div>`; return; }
    const h = hand, tip = h.tip, standPay = G.handPay(h.tier, h.result);
    sub.textContent = `${T(h.tier).name} · ${T(h.tier).stakes}`;
    const pending = h.state === "tip" ? back(h.tier) : "";
    const peek = h.peek ? `<div class="mc-peek">Through the glass: ${face(h.peek, "small")}</div>` : "";
    let act = "";
    if (h.state === "tip" && tip) {
      const flip = tip.kind === "npc" || tip.kind === "spot";
      act = `<div class="mc-tip"><h4>The tip</h4><p class="mc-say">“${esc(tip.text)}”</p><p class="mc-hint">${esc(tip.hint)}</p>
        ${flip ? `<button type="button" class="mc-btn go" data-op="flip">Flip the card here</button><small>Or use a Marked Card from your bag when you're there.</small>` : `<small>The card deals itself the moment it's done.</small>`}</div>`;
    } else if (h.state === "decide") {
      act = `<div class="mc-call"><h4>Your call</h4>
        <div class="mc-btns"><button type="button" class="mc-btn hit" data-op="hit"><b>Hit</b><small>take another tip</small></button><button type="button" class="mc-btn stand" data-op="stand"><b>Stand</b><small>${h.result === "low" ? "under 17" : esc(G.RESULT_NAME[h.result])}: ${fmt(standPay)}</small></button></div>
        <div class="mc-tools">${tools.peek && !h.used.peek ? `<button type="button" class="mc-tool" data-op="peek">\u{1F50D} Peek at the next card</button>` : ""}${tools.burn && !h.used.burn ? `<button type="button" class="mc-tool" data-op="burn">\u{1F5C3}️ Burn the next card</button>` : ""}</div></div>`;
    } else if (h.state === "bust") {
      act = `<div class="mc-call"><h4>Bust on ${h.total}</h4><p>…unless that last card was an ace all along.</p>
        <div class="mc-btns"><button type="button" class="mc-btn hit" data-op="ace"><b>Ace up the sleeve</b><small>it counts as an ace</small></button><button type="button" class="mc-btn stand" data-op="takebust"><b>Take the bust</b><small>keep it for another hand</small></button></div></div>`;
    }
    body.innerHTML = `<div class="mc-felt ${h.tier}"><div class="mc-row">${h.cards.map((c) => face(c)).join("")}${pending}</div>
        <div class="mc-total"><strong>${h.soft ? "soft " : ""}${h.total}</strong><span>${h.cards.length} card${h.cards.length === 1 ? "" : "s"} · tips paid ${fmt(h.won)}</span></div>${peek}</div>
      ${note ? `<p class="mc-note">${esc(note)}</p>` : ""}${act}
      <div class="mc-foot">${paytable(h.tier)}<button type="button" class="mc-fold" data-op="fold">Fold the hand</button></div>`;
  }
  function renderChip() {
    const h = hand;
    if (!h) { if (chip) chip.hidden = true; return; }
    if (!chip) { chip = document.createElement("button"); chip.type = "button"; chip.className = "mc-chip"; chip.addEventListener("click", () => api.open());
      (document.querySelector(".game") || document.body).append(chip); }
    chip.hidden = false;
    const what = h.state === "tip" ? h.tip?.hint || "" : h.state === "decide" ? "Your call: hit or stand" : "Bust... or is it?";
    chip.innerHTML = `<span class="mc-chip-c ${h.tier}">\u{1F0CF}</span><b>${h.total}</b><span>${esc(what)}</span>`;
    chip.title = "Your Marked Card hand. Click for the table.";
  }
  const api = {
    open() { win ||= frame(); openWin("cardsWin"); send({ t: "cards", op: "view" }); render(); },
    got(e) {
      hand = e.hand || null; tools = e.tools || {}; note = "";
      if (e.done) { done = e.done; SFX.play(e.done.result === "bust" || e.done.result === "fold" ? "ui_error" : "task_done"); }
      if (e.burned) note = `The Shoe binned the ${G.cardName(e.burned)}.`;
      if (e.open) { win ||= frame(); if (win.hidden) openWin("cardsWin"); }
      render(); renderChip();
    },
    /* the character changed (a load, a move): the tracker follows me.hand */
    sync() { hand = E.me?.hand || null; renderChip(); render(); },
  };
  return api;
}

export const CSS = `
/* ---------- (2026-09-29) MARKED CARDS: a card table ---------- */
.mc-win{width:min(520px,calc(100% - 20px))}.mc-win .win-body{padding:0;max-height:calc(100vh - 120px);overflow:auto;font-family:Lora,serif}
.mc-felt{padding:16px 14px 12px;background:radial-gradient(ellipse at 50% 30%,#2f7a4a,#1d5433 60%,#123a22);box-shadow:inset 0 0 0 3px #6b4423,inset 0 0 0 5px #3a2412;color:#f4ecd8}
.mc-felt.blue{background:radial-gradient(ellipse at 50% 30%,#2e5f8a,#1c3f60 60%,#10263c)}.mc-felt.black{background:radial-gradient(ellipse at 50% 30%,#3a3a44,#24242c 60%,#141418)}
.mc-row{display:flex;justify-content:center;gap:8px;min-height:92px;flex-wrap:wrap}
.mc-card{position:relative;width:62px;height:88px;border-radius:7px;background:#fbf7ec;color:#1a1a1a;box-shadow:0 3px 0 rgba(0,0,0,.35),inset 0 0 0 1px #c8bfa8;display:block}
.mc-card.red{color:#b3121a}.mc-card b{position:absolute;top:4px;left:6px;font:800 17px/1 Cinzel,serif}.mc-card i{position:absolute;top:22px;left:7px;font-style:normal;font-size:13px}
.mc-card em{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:32px}
.mc-card.small{width:40px;height:56px;display:inline-block;vertical-align:middle}.mc-card.small b{font-size:12px}.mc-card.small i{display:none}.mc-card.small em{font-size:20px}
.mc-card.back{background:repeating-linear-gradient(45deg,#8a1a1a 0 5px,#a82424 5px 10px);box-shadow:0 3px 0 rgba(0,0,0,.35),inset 0 0 0 3px #fbf7ec}
.mc-card.back.blue{background:repeating-linear-gradient(45deg,#1a3a8a 0 5px,#2448a8 5px 10px)}.mc-card.back.black{background:repeating-linear-gradient(45deg,#111 0 5px,#2a2a2a 5px 10px)}
.mc-total{margin-top:10px;text-align:center}.mc-total strong{display:block;font:800 30px/1 Cinzel,serif;color:#ffe9a8}.mc-total span{font:700 12px Lora,serif;opacity:.85}
.mc-total.good strong{color:#ffe27a}.mc-total.sad strong{color:#ff9a8a}   /* (not .win: that is every window's own class) */
.mc-peek{margin-top:8px;text-align:center;font:700 12px Lora,serif}
.mc-tip,.mc-call,.mc-out{padding:12px 14px}.mc-tip h4,.mc-call h4{margin:0 0 6px;font:800 12px Cinzel,serif;letter-spacing:.1em;text-transform:uppercase;color:#c8963a}
.mc-say{margin:0 0 4px;font-style:italic}.mc-hint{margin:0 0 8px;font-weight:800}.mc-tip small{display:block;margin-top:6px;opacity:.75;font-size:12px}
.mc-btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.mc-btn{padding:8px 10px;border:0;border-radius:8px;cursor:pointer;font:800 14px Cinzel,serif;background:#e8dcc0;color:#2a1a0a;box-shadow:0 3px 0 #8a7a5a}
.mc-btn b{display:block;font-size:17px}.mc-btn small{font:700 11.5px Lora,serif}
.mc-btn.hit{background:#f0c86a;box-shadow:0 3px 0 #8a6a1a}.mc-btn.stand{background:#9fd4a8;box-shadow:0 3px 0 #3a7a4a}.mc-btn.go{width:100%;background:#f0c86a;box-shadow:0 3px 0 #8a6a1a}
.mc-btn:active{transform:translateY(2px);box-shadow:none}
.mc-tools{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.mc-tool{padding:4px 8px;border:1px solid #c8963a;border-radius:6px;background:transparent;color:inherit;font:700 12px Lora,serif;cursor:pointer}
.mc-note{margin:8px 14px 0;font:700 12px Lora,serif;color:#c8963a}
.mc-foot{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;padding:0 14px 12px}
.mc-pay{font-size:12px;flex:1}.mc-pay summary{cursor:pointer;font-weight:800}.mc-pay table{margin-top:6px;border-collapse:collapse;width:100%}.mc-pay td{padding:2px 4px;border-bottom:1px solid rgba(200,150,58,.25)}.mc-pay td:last-child{text-align:right;font-weight:800}.mc-pay p{margin:6px 0 0;opacity:.8}
.mc-fold{border:0;background:none;color:inherit;opacity:.65;text-decoration:underline;cursor:pointer;font:700 12px Lora,serif;white-space:nowrap}
.mc-out ul{margin:6px 0 10px;padding-left:18px}.mc-out li img{width:18px;height:18px;vertical-align:middle;image-rendering:pixelated}
.mc-chip{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:30;display:flex;align-items:center;gap:6px;max-width:min(460px,70%);padding:4px 10px 4px 6px;border:1px solid #c8963a;border-radius:14px;background:rgba(20,12,6,.88);color:#f4ecd8;font:700 12px Lora,serif;cursor:pointer}
.mc-chip[hidden]{display:none}.mc-chip b{font:800 15px Cinzel,serif;color:#ffe9a8}.mc-chip span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mc-chip-c{display:grid;place-items:center;width:20px;height:26px;border-radius:3px;background:#a82424;box-shadow:inset 0 0 0 2px #fbf7ec;font-size:12px}.mc-chip-c.blue{background:#2448a8}.mc-chip-c.black{background:#2a2a2a}
@media (max-width:620px){.mc-card{width:48px;height:68px}.mc-card em{font-size:24px}.mc-chip{top:4px;max-width:90%}}
`;
