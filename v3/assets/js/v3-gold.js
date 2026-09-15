/* ============================================================
   EastCoin V3 — The Gold Button

   Once a day, at a moment nobody knows, it appears on every page for
   two minutes. First press takes the day.

   Nothing here polls. The bell already asks the server how you are
   doing every 45 seconds, and the window comes down with that answer
   as an "ec-gold" event; this module only listens and draws. That is
   why the window is two minutes rather than thirty seconds: one poll
   has to be certain to catch it.

   It sits bottom LEFT like the bell's toasts, because the Twitch
   rail is on the right and flags itself obscured by anything that
   ever covers it.
   ============================================================ */
(() => {
  "use strict";

  let open = null;                  // { open, endsAt, day }
  let node = null;
  let ticker = 0;
  let pressing = false;

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };

  function draw() {
    if (!open) return;
    if (node) return;
    node = el("div", "goldbtn");
    const press = el("button", "goldbtn-hit", "PRESS IT");
    press.type = "button";
    press.addEventListener("click", claim);
    const copy = el("div", "goldbtn-copy");
    copy.append(el("b", null, "The Gold Button"));
    const left = el("small", "goldbtn-left", "");
    copy.append(left);
    node.append(press, copy);
    document.body.append(node);
    window.setTimeout(() => node?.classList.add("show"), 20);
    press.focus({ preventScroll: true });

    window.clearInterval(ticker);
    const countdown = () => {
      if (!node || !open) return;
      const secs = Math.max(0, Math.round((open.endsAt - Date.now()) / 1000));
      left.textContent = secs ? `${secs}s — first press takes the day` : "gone";
      if (!secs) hide();
    };
    countdown();
    ticker = window.setInterval(countdown, 1000);
  }

  function hide() {
    window.clearInterval(ticker);
    ticker = 0;
    open = null;
    const going = node;
    node = null;
    if (!going) return;
    going.classList.remove("show");
    window.setTimeout(() => going.remove(), 300);
  }

  async function claim() {
    if (pressing) return;
    pressing = true;
    const hit = node?.querySelector(".goldbtn-hit");
    if (hit) { hit.disabled = true; hit.textContent = "…"; }
    let payload = null;
    try { payload = await fetch("/api/games/gold/claim", { method: "POST", credentials: "include" }).then((r) => r.json()); } catch { payload = null; }
    pressing = false;

    if (payload?.ok && payload.won) {
      result("You took it", `${(payload.tookMs / 1000).toFixed(1)}s after it appeared. The day is yours.`, true);
    } else if (payload?.ok) {
      const who = payload.winner?.user?.displayName || "someone";
      result("Too slow", `${who} got there first.`, false);
    } else {
      result("Missed it", payload?.message || "It's gone.", false);
    }
    window.setTimeout(hide, 4200);
  }

  function result(title, text, won) {
    if (!node) return;
    node.classList.toggle("won", won);
    node.classList.add("done");
    node.replaceChildren();
    const copy = el("div", "goldbtn-copy");
    copy.append(el("b", null, title), el("small", null, text));
    node.append(el("span", "goldbtn-mark", won ? "🏆" : "·"), copy);
  }

  document.addEventListener("ec-gold", (event) => {
    const state = event.detail;
    if (!state?.open) { if (node && !node.classList.contains("done")) hide(); return; }
    // Already showing this one; leave it alone so the countdown keeps running.
    if (open && open.day === state.day) { open.endsAt = state.endsAt; return; }
    if (node) return;               // a result is still on screen
    open = state;
    draw();
  });

  window.ECGold = Object.freeze({ showing: () => Boolean(node) });
})();
