/* ============================================================
   EastCoin V3 — Casino: Wheel

     /?view=wheel

   Twenty-five slices: twelve red, twelve black, one gold. Forty
   seconds of bets, a four-second spin, the rest of the minute to
   look at where it landed. Red and black pay 2×, gold pays 24×.
   The server owns the clock and the slice; this page spins to it.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const SLICE_DEG = 360 / 25;
  const COLORS = { red: "#d31d4d", black: "#2a2420", gold: "#e8bf35" };
  const LABEL = { red: "Red", black: "Black", gold: "Gold" };

  function buildStage(refs) {
    const wrap = K.el("div", "wheel-wrap");
    const pointer = K.el("span", "wheel-pointer");
    const wheel = K.el("div", "wheel");
    const inner = K.el("div", "wheel-inner spin");
    const hub = K.el("div", "wheel-hub");
    const hubImg = document.createElement("img");
    hubImg.src = "/v3/assets/img/zcoin.webp";
    hubImg.alt = "";
    hub.append(hubImg);
    wheel.append(inner, hub);
    wrap.append(pointer, wheel);
    refs.wheelInner = inner;
    refs.wheelRound = -1;
    return wrap;
  }

  /** Paint the slices once the config says what they are. */
  function paintSlices(refs, config) {
    if (refs.wheelPainted || !config?.slices) return;
    refs.wheelPainted = true;
    const stops = config.slices.map((c, i) => `${COLORS[c]} ${i * SLICE_DEG}deg ${(i + 1) * SLICE_DEG}deg`);
    refs.wheelInner.style.background = `conic-gradient(${stops.join(",")})`;
  }

  function renderStage(refs, { round, config, inBets, freshResult, now }) {
    paintSlices(refs, config);
    const inner = refs.wheelInner;
    if (inBets) {
      if (refs.wheelRound !== round.no) {
        refs.wheelRound = round.no;
        inner.style.transition = "none";
        inner.style.transform = "";
        inner.classList.add("spin");
      }
      return;
    }
    if (freshResult && round.result) {
      // Carry on from wherever the idle spin was, then decelerate onto the slice.
      const current = getComputedStyle(inner).transform;
      inner.classList.remove("spin");
      inner.style.transition = "none";
      inner.style.transform = current === "none" ? "rotate(0deg)" : current;
      void inner.offsetWidth;
      const center = (round.result.slice + 0.5) * SLICE_DEG;
      const target = 5 * 360 + (360 - center);
      // Late to the round: land on the slice at once instead of a full spin.
      const elapsed = Math.max(0, now - round.closesAt);
      const remaining = Math.max(0, 4000 - elapsed);
      inner.style.transition = remaining ? `transform ${remaining}ms cubic-bezier(.12,.8,.2,1)` : "none";
      inner.style.transform = `rotate(${target}deg)`;
    }
  }

  const view = K.sharedGame({
    key: "wheel",
    title: "Wheel",
    intro: "Twenty-five slices, one spin a minute. Red or black pays 2×, the single gold slice pays 24×. Forty seconds to get in.",
    running: "Spinning…",
    revealMs: 4200,
    buildStage,
    renderStage,
    pickButton: (pick, config) => ({ label: LABEL[pick] || pick, className: pick, pays: config.payout[pick] }),
    pickLabel: (pick) => LABEL[pick] || pick,
    describe: (result) => `${LABEL[result.color] || result.color}!`,
    resultClass: (result) => result?.color || ""
  });

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("wheel", view);
  }
  boot();
})();
