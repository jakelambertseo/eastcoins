/* ============================================================
   EastCoin V3 — the Daily Crate (2026-09-16)

   The present in the top nav, between search and the bell. Eager and
   small: on a member's page load it asks /api/crate/state once (no
   poll) to know whether today's free crate is ready — the green dot —
   and everything else waits for a click. The panel is a fixed popover
   over whatever page is open, placed under the button like the bell's.

   The server decides the pull before anything moves here: the reel
   only plays back what /api/crate/open returned, with the real prize
   under the marker and the tiles around it as decoration.
   ============================================================ */
(() => {
  "use strict";

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };
  const wrap = document.getElementById("crateWrap");
  const btn = document.getElementById("crateBtn");
  if (!wrap || !btn) return;

  const TIER_COLOR = { common: "#4e7fd6", rare: "#a35ce8", epic: "#e84d9a", legendary: "#e53935" };
  const SLOT_NAME = { finish: "Card finish", name: "Name color", namefx: "Name effect", title: "Title", background: "Profile background", banner: "Profile banner", team: "Team effect", label: "Case label" };
  const ICON_OF = { finish: "🃏", name: "✒️", namefx: "💫", title: "🏷️", background: "🌌", banner: "🏟️", team: "🏈", label: "💳" };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  let state = null, open = false, busy = false, panel = null, backdrop = null, refs = {};
  let sound = true;
  try { sound = localStorage.getItem("ec_crate_sound") !== "0"; } catch {}

  /* ---------------------------------------------------------- state */
  async function load() {
    let payload = null;
    try { payload = await fetch("/api/crate/state", { credentials: "include" }).then((r) => (r.status === 401 ? null : r.json())); } catch { payload = null; }
    if (!payload?.ok) { wrap.hidden = true; return; }
    state = payload;
    wrap.hidden = false;
    paintButton();
    if (open) paintPanel();
  }
  function paintButton() {
    const ready = Boolean(state?.freeReady);
    btn.classList.toggle("ready", ready);
    btn.title = ready ? "Your free Daily Crate is ready" : `Daily Crate · free one back ${leftText()}`;
  }
  function leftText() {
    const at = state?.nextFreeAt ? Date.parse(state.nextFreeAt) - Date.now() : 0;
    if (at <= 0) return "now";
    const mins = Math.ceil(at / 60000), h = Math.floor(mins / 60), m = mins % 60;
    return `in ${h ? `${h}h ${m}m` : `${m}m`}`;
  }

  /* ---------------------------------------------------------- panel */
  function build() {
    backdrop = el("div", "crate-backdrop"); backdrop.hidden = true;
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) setOpen(false); });
    panel = el("div", "crate-panel"); panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Daily Crate");
    backdrop.append(panel);
    document.body.append(backdrop);
  }
  function paintHead() {
    const head = el("div", "crate-head");
    const title = el("div");
    const h = el("b", null, "Daily Crate ");
    if (state?.freeReady) h.append(el("span", "crate-free", "Free today"));
    title.append(h, el("small", null, state?.freeReady ? "One free crate a day. Open it whenever you like." : `Your free crate is back ${leftText()}. Another is ${state?.price ?? 25} ZC.`));
    const x = el("button", "crate-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.addEventListener("click", () => setOpen(false));
    head.append(title, x);
    const old = panel.querySelector(".crate-head");
    if (old) old.replaceWith(head); else panel.prepend(head);
  }
  function paintPanel() {
    panel.replaceChildren();
    paintHead();

    const stage = el("div", "crate-stage");
    refs.stage = stage;
    refs.fx = el("div", "crate-fx"); stage.append(refs.fx);
    refs.confetti = el("div", "crate-confetti"); stage.append(refs.confetti);
    const box = el("div", "crate-boxwrap");
    refs.crate = el("div", "crate-box"); refs.crate.setAttribute("role", "button"); refs.crate.tabIndex = 0; refs.crate.setAttribute("aria-label", "Open the crate");
    refs.crate.append(el("div", "crate-body"), el("div", "crate-lid"), el("div", "crate-bow", "🎀"));
    refs.crate.addEventListener("click", () => openCrate());
    refs.crate.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCrate(); } });
    refs.cta = el("div", "crate-cta");
    box.append(refs.crate, refs.cta);
    refs.boxwrap = box;
    stage.append(box);
    refs.reelwrap = el("div", "crate-reelwrap"); refs.marker = el("div", "crate-marker"); refs.reel = el("div", "crate-reel");
    refs.reelwrap.append(refs.marker, refs.reel); stage.append(refs.reelwrap);
    refs.reveal = el("div", "crate-reveal"); stage.append(refs.reveal);
    panel.append(stage);
    paintCta();

    const foot = el("div", "crate-foot");
    const odds = el("div", "crate-card");
    odds.append(el("h3", null, "What's inside"));
    const table = el("table", "crate-odds");
    for (const t of ["common", "rare", "epic", "legendary"]) {
      const tier = state?.tiers?.[t]; if (!tier) continue;
      const tr = el("tr"); tr.style.setProperty("--c", TIER_COLOR[t]);
      const left = el("td");
      left.append(el("span", "crate-dot"), el("b", null, t[0].toUpperCase() + t.slice(1)));
      const owned = tier.items.filter((i) => i.owned).length;
      const names = tier.items.filter((i) => !i.owned).slice(0, 3).map((i) => i.name);
      left.append(el("small", null, `${names.length ? names.join(", ") + (tier.items.length - owned > 3 ? "…" : "") + ", or " : ""}${tier.coins.join(" or ")} ZC${owned ? ` · ${owned}/${tier.items.length} owned` : ""}`));
      tr.append(left, el("td", "nums", `${tier.odds}%`));
      table.append(tr);
    }
    odds.append(table, el("p", "crate-fine", `Same odds free or bought. Coins can repeat; you never pull a cosmetic you already own. Every crate has a seed you can check.`));
    const recent = el("div", "crate-card");
    recent.append(el("h3", null, "Recent pulls"));
    const ul = el("ul", "crate-pulls");
    for (const r of (state?.recent || []).slice(0, 7)) ul.append(pullRow(r));
    if (!state?.recent?.length) ul.append(el("li", "crate-empty", "Nobody has opened one yet. Be first."));
    recent.append(ul);
    refs.pulls = ul;
    foot.append(odds, recent);
    panel.append(foot);
    const tools = el("div", "crate-tools");
    const snd = el("button", "crate-lnk", sound ? "🔊 Sound on" : "🔇 Sound off"); snd.type = "button";
    snd.addEventListener("click", () => { sound = !sound; try { localStorage.setItem("ec_crate_sound", sound ? "1" : "0"); } catch {} snd.textContent = sound ? "🔊 Sound on" : "🔇 Sound off"; });
    tools.append(snd, el("span", "crate-mine", state?.mine?.opened ? `You've opened ${state.mine.opened} · ${state.mine.coins} ZC won` : ""));
    panel.append(tools);
  }
  function paintCta() {
    if (!refs.cta) return;
    refs.cta.replaceChildren();
    if (state?.freeReady) { refs.cta.append(document.createTextNode("Tap the crate to open it — "), el("b", null, "free")); }
    else { refs.cta.append(document.createTextNode(`Tap the crate to buy one — ${state?.price ?? 25} ZC`)); }
  }
  function pullRow(r) {
    const li = el("li");
    const face = el("span", "crate-face", (r.who?.displayName || "?").slice(0, 1).toUpperCase());
    if (r.who?.avatar) { const img = document.createElement("img"); img.alt = ""; img.loading = "lazy"; img.src = window.ECAvatar ? window.ECAvatar.small(r.who.avatar) : r.who.avatar; img.addEventListener("error", () => img.remove()); face.append(img); }
    const who = el("a", "ulink", r.who?.displayName || r.who?.login || "someone"); who.href = `/u/${encodeURIComponent(String(r.who?.login || "").toLowerCase())}`;
    const text = el("span"); text.append(who, document.createTextNode(" pulled "));
    const em = el("em", null, r.prize); em.style.setProperty("--c", TIER_COLOR[r.rarity] || "#aaa"); text.append(em);
    li.append(face, text, el("small", null, ago(r.at)));
    return li;
  }
  const ago = (iso) => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 60 ? "now" : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`; };

  function place() {
    const r = btn.getBoundingClientRect();
    const chatOpen = document.body.classList.contains("chat-open") && !document.body.classList.contains("chat-hidden") && window.innerWidth >= 981;
    const chatW = chatOpen ? parseFloat(getComputedStyle(document.body).getPropertyValue("--chat-w")) || 340 : 0;
    panel.style.top = `${Math.round(r.bottom + 12)}px`;
    panel.style.maxHeight = `${Math.max(320, window.innerHeight - r.bottom - 24)}px`;
    // Centred in the space left of the chat rail, and never under it.
    const room = window.innerWidth - chatW;
    const w = Math.min(680, room - 16);
    panel.style.width = `${w}px`;
    panel.style.left = `${Math.max(8, Math.round((room - w) / 2))}px`;
    panel.style.right = "";
  }
  function setOpen(v) {
    if (v === open || (!v && busy)) return;
    open = v;
    if (!panel) build();
    backdrop.hidden = !v;
    btn.setAttribute("aria-expanded", String(v));
    btn.classList.toggle("on", v);
    if (v) { paintPanel(); place(); refs.crate.focus({ preventScroll: true }); }
    else btn.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------- opening */
  async function openCrate() {
    if (busy || !state) return;
    const buy = !state.freeReady;
    busy = true;
    refs.cta.textContent = buy ? "Buying…" : "Opening…";
    let res = null;
    try { res = await fetch("/api/crate/open", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ buy }) }).then((r) => r.json()); } catch { res = null; }
    if (!res?.ok) {
      busy = false;
      if (res?.code === "FREE_USED") { state.freeReady = false; state.nextFreeAt = res.nextFreeAt || state.nextFreeAt; paintButton(); paintPanel(); return; }
      refs.cta.textContent = res?.message || "Couldn't open that. Try again.";
      return;
    }
    const o = res.open;
    if (!buy) { state.freeReady = false; state.nextFreeAt = res.nextFreeAt; paintButton(); paintHead(); }
    if (res.balance !== null && res.balance !== undefined && !o.coins) window.ECV3?.setWallet?.(res.balance);

    // The show: shake, lid, fireworks, the reel, the reveal.
    refs.crate.classList.add("shake"); await wait(reduce ? 40 : 900);
    refs.crate.classList.remove("shake"); refs.crate.classList.add("open"); fireworks(o.rarity); await wait(reduce ? 40 : 750);
    refs.boxwrap.style.display = "none";
    await spinReel(o);
    refs.reelwrap.classList.remove("on");
    reveal(o, res);
    busy = false;
  }

  function tileFor(t) {
    const d = el("div", "crate-tile"); d.style.setProperty("--c", TIER_COLOR[t.rarity]);
    d.append(el("i", null, t.icon), Object.assign(el("div"), {}), el("small", null, t.rarity));
    const mid = d.children[1]; mid.append(el("b", null, t.name), el("em", null, t.kind));
    return d;
  }
  function decoration() {
    // Weighted by the real odds, never a Legendary beside the marker.
    let u = Math.random() * 100, tier = "common";
    for (const t of ["common", "rare", "epic", "legendary"]) { u -= state.tiers[t].odds; if (u < 0) { tier = t; break; } }
    if (tier === "legendary") tier = "epic";
    const info = state.tiers[tier];
    if (Math.random() < info.coinShare || !info.items.length) { const c = info.coins[Math.floor(Math.random() * info.coins.length)]; return { rarity: tier, icon: "🪙", name: `${c} ZC`, kind: "ZCoins" }; }
    const it = info.items[Math.floor(Math.random() * info.items.length)];
    return { rarity: tier, icon: ICON_OF[it.slot] || "🎁", name: it.name, kind: SLOT_NAME[it.slot] || it.slot };
  }
  const prizeTile = (o) => (o.coins ? { rarity: o.rarity, icon: "🪙", name: `${o.coins} ZC`, kind: "ZCoins" } : { rarity: o.rarity, icon: ICON_OF[o.item.slot] || "🎁", name: o.item.name, kind: SLOT_NAME[o.item.slot] || o.item.slot });

  async function spinReel(o) {
    const reel = refs.reel; reel.replaceChildren();
    reel.style.transition = "none"; reel.style.transform = "translateX(0)";
    const TILE = 112, WIN_AT = 38;
    for (let i = 0; i < 44; i++) reel.append(tileFor(i === WIN_AT ? prizeTile(o) : decoration()));
    refs.reelwrap.classList.add("on");
    const wrapW = refs.reelwrap.clientWidth;
    const target = WIN_AT * TILE + 52 - wrapW / 2 + (Math.random() - 0.5) * 60;
    void reel.offsetWidth;
    const SPIN_MS = 9000;
    reel.style.transition = reduce ? "none" : `transform ${SPIN_MS}ms cubic-bezier(.12,.78,.16,1)`;
    reel.style.transform = `translateX(${-target}px)`;
    const ticking = { on: true };
    if (!reduce) tick(reel, wrapW, TILE, ticking);
    await wait(reduce ? 80 : SPIN_MS + 250);
    ticking.on = false;
  }
  let audio = null;
  function click() {
    if (!sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
      osc.type = "square"; osc.frequency.value = 1400;
      g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      osc.connect(g).connect(audio.destination); osc.start(t); osc.stop(t + 0.05);
    } catch {}
  }
  function tick(reel, wrapW, TILE, st) {
    let last = -1;
    const step = () => {
      if (!st.on) return;
      let x = 0; try { x = -new DOMMatrixReadOnly(getComputedStyle(reel).transform).m41; } catch {}
      const idx = Math.floor((x + wrapW / 2) / TILE);
      if (idx !== last) { last = idx; click(); refs.marker.classList.remove("flick"); void refs.marker.offsetWidth; refs.marker.classList.add("flick"); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function reveal(o, res) {
    const t = prizeTile(o);
    const box = refs.reveal; box.replaceChildren();
    const prize = el("div", `crate-prize ${o.rarity}`); prize.style.setProperty("--c", TIER_COLOR[o.rarity]);
    prize.append(el("span", "crate-rar", o.rarity), el("span", "crate-ico", t.icon));
    const txt = el("div"); txt.append(el("b", null, t.name), el("small", null, t.kind)); prize.append(txt);
    box.append(prize);
    const after = el("p", "crate-after");
    if (o.coins) {
      if (res.payFailed) after.append(el("b", null, `${o.coins} ZC`), document.createTextNode(" — the wallet didn't answer; an admin can see it and it will be paid."));
      else { after.append(el("b", null, `+${o.coins} ZC`), document.createTextNode(o.rarity === "legendary" ? " straight into your wallet. Legendary — it's on the ticker." : " in your wallet.")); if (res.balance !== null && res.balance !== undefined) window.ECV3?.setWallet?.(res.balance); }
    } else {
      after.append(el("b", null, o.rarity === "legendary" ? "Legendary! " : "New. "), document.createTextNode(`${o.item.name} is yours — switch it on from the Store or your profile.`));
    }
    box.append(after);
    const btns = el("div", "crate-btns");
    const again = el("button", "crate-btn-orange", `Open another · ${state.price} ZC`); again.type = "button";
    again.addEventListener("click", () => { resetStage(); openCrate(); });
    const check = el("a", "crate-lnk", "Check this seed →"); check.href = `/?view=verify&game=crate&seed=${encodeURIComponent(o.seed)}&hash=${o.hash}`;
    const done = el("button", "crate-btn-plain", "Done"); done.type = "button"; done.addEventListener("click", () => setOpen(false));
    btns.append(again, done, check);
    box.append(btns);
    refs.stage.className = `crate-stage ${o.rarity === "common" ? "" : o.rarity}`;
    box.classList.add("on");
    if (o.rarity === "legendary" || o.rarity === "epic") confetti(o.rarity === "legendary");
    if (refs.pulls) { const r = { rarity: o.rarity, prize: t.name, at: new Date().toISOString(), who: window.ECV3?.state?.session?.user || {} }; refs.pulls.prepend(pullRow(r)); refs.pulls.querySelector(".crate-empty")?.remove(); }
    state.mine = { opened: (state.mine?.opened || 0) + 1, coins: (state.mine?.coins || 0) + (o.coins || 0) };
    again.focus({ preventScroll: true });
  }
  function resetStage() {
    refs.stage.className = "crate-stage"; refs.reveal.classList.remove("on"); refs.reelwrap.classList.remove("on");
    refs.crate.className = "crate-box"; refs.boxwrap.style.display = ""; refs.confetti.replaceChildren(); refs.fx.replaceChildren();
    paintCta();
  }
  function fireworks(rar) {
    const box = refs.fx; box.replaceChildren(); if (reduce) return;
    const palettes = { common: ["#ff9a3c", "#ffe08a", "#fff6d6", "#4e7fd6"], rare: ["#a35ce8", "#ffe08a", "#fff", "#ff9a3c"], epic: ["#e84d9a", "#ffe08a", "#fff", "#a35ce8"], legendary: ["#e53935", "#ffe08a", "#fff6d6", "#e8bf35"] };
    const cols = palettes[rar] || palettes.common;
    [[50, 48, 0], [36, 40, 160], [64, 42, 300], [50, 30, 460]].forEach(([x, y, delay], bi) => {
      setTimeout(() => {
        const flash = el("i", "crate-flash"); flash.style.left = x + "%"; flash.style.top = y + "%"; box.append(flash);
        const n = bi === 0 ? 36 : 22;
        for (let i = 0; i < n; i++) {
          const s = el("i", "crate-spark");
          const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, r = 90 + Math.random() * (bi === 0 ? 150 : 90);
          s.style.left = x + "%"; s.style.top = y + "%";
          s.style.setProperty("--dx", Math.cos(a) * r + "px"); s.style.setProperty("--dy", Math.sin(a) * r + 40 + "px");
          s.style.setProperty("--c", cols[i % cols.length]); s.style.setProperty("--d", 0.8 + Math.random() * 0.6 + "s");
          box.append(s);
        }
      }, delay);
    });
    setTimeout(() => box.replaceChildren(), 2400);
  }
  function confetti(gold) {
    const box = refs.confetti; box.replaceChildren(); if (reduce) return;
    for (let i = 0; i < (gold ? 90 : 36); i++) {
      const c = el("i");
      c.style.left = Math.random() * 100 + "%";
      c.style.background = gold ? ["#f0b429", "#ffe08a", "#fff6d6", "#e53935"][i % 4] : ["#e84d9a", "#a35ce8", "#f0b429"][i % 3];
      c.style.animationDuration = 1.6 + Math.random() * 1.6 + "s"; c.style.animationDelay = Math.random() * 0.4 + "s";
      box.append(c);
    }
  }

  /* ---------------------------------------------------------- wiring */
  btn.addEventListener("click", () => setOpen(!open));
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) setOpen(false); });
  window.addEventListener("resize", () => { if (open) place(); });
  Promise.resolve(window.ECV3?.sessionReady).catch(() => null).then(() => {
    if (window.ECV3?.state?.session?.user?.login) load();
    else wrap.hidden = true;
  });
  window.ECCrate = { load, setOpen };
})();
