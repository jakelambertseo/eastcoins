/* ============================================================
   EastCoin V3 — the one "make a pick" box

   Every place a pick can be placed — the Picks page's cards, a game
   page, the Tonight strip on the Sports page — opens THIS and nothing
   else, so the stake field, the three-line summary, the wording and
   the receipt are the same everywhere. It posts to /api/picks/wagers,
   the single authority the site and the chat bot share.

     ECPickBox.open({ market, side, onPlaced })

   market is the bootstrap/game-page shape: { id, sport, league, away:
   {name}|string, home, awayOdds|away.line, homeOdds|home.line,
   question }. side is "away" | "home". onPlaced(result) runs after a
   successful lock (the receipt is already showing).
   ============================================================ */
(() => {
  "use strict";

  const MIN_STAKE = 1;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };
  const nameOf = (v) => (v && typeof v === "object" ? String(v.name || "") : String(v || ""));
  const lineOf = (m, side) => {
    const v = side === "away" ? (m.awayOdds ?? m.away?.line) : (m.homeOdds ?? m.home?.line);
    return Number(v);
  };
  const isProp = (m) => String(m?.sport || "").toLowerCase() === "prop";
  const formatLine = (n) => { const v = Number(n); return !Number.isFinite(v) || v === 0 ? "—" : v > 0 ? `+${v}` : `−${Math.abs(v)}`; };
  const decimalFrom = (n) => { const v = Number(n); if (!Number.isFinite(v) || v === 0) return 1; return v < 0 ? 1 + 100 / Math.abs(v) : 1 + v / 100; };
  const totalReturn = (stake, line) => { const a = Math.max(0, Math.floor(Number(stake) || 0)); return a ? Math.max(a, Math.ceil(a * decimalFrom(line))) : 0; };

  function zc(value, { sign = false } = {}) {
    const wrap = el("span", "zc-amount nums");
    const img = document.createElement("img"); img.className = "zcoin-mark"; img.src = "/v3/assets/img/zcoin.webp"; img.alt = ""; img.width = 15; img.height = 15;
    const n = Number(value) || 0;
    wrap.append(img, document.createTextNode(`${sign && n > 0 ? "+" : sign && n < 0 ? "−" : ""}${Math.abs(n).toLocaleString()}`));
    return wrap;
  }

  function crest(market, name) {
    if (isProp(market)) { const yes = String(name).toLowerCase() !== "no"; return el("span", `ticket-crest propmark ${yes ? "yes" : "no"}`, yes ? "✓" : "✗"); }
    if (window.ECLogos) return window.ECLogos.crest(market?.sport, market?.league, name, "ticket-crest");
    return el("span", "ticket-crest", String(name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase());
  }

  async function place(market, side, stake) {
    try {
      const response = await fetch("/api/picks/wagers", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, selection: side, wager: stake })
      });
      const payload = await response.json().catch(() => null);
      if (payload?.ok) return payload;
      return { ok: false, message: payload?.message || `Couldn't place that pick (${response.status}).` };
    } catch {
      return { ok: false, message: "Couldn't reach the server — nothing was charged." };
    }
  }

  let current = null;

  function close() {
    document.getElementById("v3Ticket")?.remove();
    document.removeEventListener("keydown", onKey);
    current = null;
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function open({ market, side, onPlaced, stake: startStake = 10 }) {
    close();
    const prop = isProp(market);
    const team = prop ? (side === "home" ? "No" : "Yes") : nameOf(side === "home" ? market.home : market.away);
    const line = lineOf(market, side);
    const balance = Number(window.ECV3?.state?.session?.wallet?.balance) || 0;
    current = { market, side };

    const backdrop = el("div", "ticket-backdrop");
    backdrop.id = "v3Ticket";
    const panel = el("section", "ticket");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", `Lock pick on ${team}`);

    const head = el("header", "ticket-head");
    const heading = el("strong", null, "Lock your pick");
    const x = el("button", "iconbtn", "✕"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.addEventListener("click", close);
    head.append(heading, x);

    const show = (body) => {
      panel.replaceChildren(head, ...body);
      if (!backdrop.isConnected) {
        backdrop.append(panel);
        backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
        document.body.append(backdrop);
        document.addEventListener("keydown", onKey);
      }
    };

    const pick = el("div", "ticket-pick");
    const t = el("span", "ticket-team");
    t.append(crest(market, team), document.createTextNode(prop ? team.toUpperCase() : team));
    pick.append(t, el("span", "ticket-line nums", formatLine(line)));
    const question = prop ? el("p", "ticket-q", market.question || "Prop bet") : null;

    const field = el("div", "ticket-field");
    const label = el("label", "ticket-label", "Stake"); label.htmlFor = "v3Stake";
    const input = document.createElement("input");
    input.id = "v3Stake"; input.type = "number"; input.min = String(MIN_STAKE); input.step = "1"; input.value = String(startStake); input.inputMode = "numeric";
    field.append(label, input);
    const chips = el("div", "ticket-chips");
    for (const v of [10, 25, 50]) { const c = el("button", "ticket-chip", String(v)); c.type = "button"; c.addEventListener("click", () => { input.value = String(v); refresh(); }); chips.append(c); }
    if (balance >= MIN_STAKE) { const all = el("button", "ticket-chip", "All in"); all.type = "button"; all.addEventListener("click", () => { input.value = String(Math.floor(balance)); refresh(); }); chips.append(all); }
    field.append(chips);

    const summary = el("div", "ticket-summary");
    const hint = el("p", "ticket-hint");
    const confirm = el("button", "btn primary", "Lock it in"); confirm.type = "button"; confirm.style.height = "38px";

    function refresh() {
      const stake = Math.max(0, Math.floor(Number(input.value) || 0));
      const ret = totalReturn(stake, line);
      summary.replaceChildren();
      for (const [k, v, note] of [
        ["If it wins", zc(ret), `+${(ret - stake).toLocaleString()} profit`],
        ["If it loses", zc(0), `you lose your ${stake.toLocaleString()} stake`],
        ["Void / no action", zc(stake), "stake returned in full"]
      ]) {
        const row = el("div", "ticket-row");
        const val = el("span", "ticket-row-v"); val.append(v);
        row.append(el("span", "ticket-row-k", k), val, el("span", "ticket-row-note", note));
        summary.append(row);
      }
      const problem = stake < MIN_STAKE ? `Minimum stake is ${MIN_STAKE} ZCoin.` : balance && stake > balance ? `That's more than your ${balance.toLocaleString()} ZCoins.` : "";
      confirm.disabled = Boolean(problem);
      hint.textContent = problem || (balance ? `${balance.toLocaleString()} ZCoins available · no maximum stake` : "1 ZCoin minimum · stake up to your full balance");
      hint.classList.toggle("is-error", Boolean(problem));
      chips.querySelectorAll(".ticket-chip").forEach((c) => c.classList.toggle("on", Number(c.textContent) === stake));
    }
    input.addEventListener("input", refresh);

    confirm.addEventListener("click", async () => {
      const stake = Math.max(0, Math.floor(Number(input.value) || 0));
      confirm.disabled = true; input.disabled = true;
      confirm.textContent = "Placing…";
      hint.classList.remove("is-error");
      hint.textContent = "Taking your stake and locking the price…";
      const result = await place(market, side, stake);
      if (!result.ok) {
        confirm.disabled = false; input.disabled = false;
        confirm.textContent = "Lock it in";
        hint.textContent = result.message;
        hint.classList.add("is-error");
        return;
      }
      if (Number.isFinite(Number(result.balance))) window.ECV3?.setWallet?.(Number(result.balance));
      window.ECNotify?.refresh?.();
      receipt(result);
      try { onPlaced?.(result); } catch { /* the caller's problem */ }
    });

    function receipt(result) {
      const r = result.pick || {};
      heading.textContent = "Pick locked";
      const done = el("div", "ticket-done");
      for (const [k, v] of [
        ["Pick", `${Number(r.wager).toLocaleString()} on ${prop ? String(r.team || team).toUpperCase() : r.team || team}`],
        ["Locked price", formatLine(r.odds ?? line)],
        ["Returns if it wins", Number(r.returnsIfWon ?? totalReturn(r.wager, line)).toLocaleString()],
        ["ZCoins left", result.balance == null ? "—" : Number(result.balance).toLocaleString()]
      ]) {
        const row = el("div", "ticket-row");
        row.append(el("span", "ticket-row-k", k), el("span", "ticket-row-v", v));
        done.append(row);
      }
      done.append(el("p", "ticket-hint", prop
        ? "Your price is locked at what you saw. It pays when the call is made."
        : "Your price is locked at what you saw. It settles on its own once the game is final."));
      const ok = el("button", "btn primary", "Done"); ok.type = "button"; ok.style.height = "38px"; ok.addEventListener("click", close);
      show([done, ok]);
      ok.focus();
    }

    show([pick, ...(question ? [question] : []), field, summary, hint, confirm]);
    refresh();
    input.focus(); input.select();
  }

  window.ECPickBox = Object.freeze({ open, close, isOpen: () => Boolean(current) });
})();
