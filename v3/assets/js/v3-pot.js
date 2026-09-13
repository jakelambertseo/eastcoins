/* ============================================================
   The Daily Pot, on the page.

   ECPot.mount(container, { compact })  — draws the pot and keeps it
   current: the amount, a bar of the day's play toward the ceiling
   (the line itself is hidden until it pays), the viewer's share, the
   last winner. Polls /api/casino/pot every 15 seconds while visible.
   The moment a poll sees today's pot go from open to paid, the hit
   banner drops in with confetti on every page showing it.

   Returns a stop function; the game pages rebuild their columns.
   ============================================================ */
(() => {
  "use strict";

  const POLL_MS = 15000;
  const RECENT_MS = 90 * 1000;   // a pot paid this recently gets the banner
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };
  const K = () => window.ECCasino;
  const nums = (n) => Number(n || 0).toLocaleString();

  const seen = new Map();   // day -> status last drawn, per page load

  function draw(box, pot, compact) {
    box.replaceChildren();
    if (!pot) { box.append(el("p", "cf-empty", "The pot is out of reach for a moment.")); return; }
    const paid = pot.status === "PAID";
    const pct = Math.max(0, Math.min(100, Math.round((pot.play / pot.ceiling) * 100)));

    const head = el("div", "pot-k");
    head.append(el("span", `pot-dot${paid ? " off" : ""}`), el("span", null, paid ? "Today's pot went" : "Today's pot"));
    if (!paid) head.append(el("span", "pot-sub", `· must hit by ${nums(pot.ceiling)} of play`));
    box.append(head);

    if (paid && pot.winner) {
      const w = el("div", "pot-paid");
      const who = K()?.nameLink ? K().nameLink({ login: pot.winner.login, displayName: pot.last?.login === pot.winner.login ? pot.last.displayName : pot.winner.login }) : el("b", null, pot.winner.login);
      w.append(who, document.createTextNode(" took "), K()?.zc ? K().zc(pot.amount) : el("b", null, `${nums(pot.amount)} ZC`), document.createTextNode(` at ${new Date(pot.paidAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`));
      box.append(w);
      box.append(el("p", "pot-note", "Tomorrow's opens at midnight Central."));
      return;
    }

    const amt = el("div", "pot-amt");
    amt.append(el("b", "nums", nums(pot.amount)), el("span", null, compact ? "ZC" : `ZC · ${nums(pot.play)} of play so far`));
    box.append(amt);

    const meter = el("div", "pot-meter");
    const fill = el("i"); fill.style.width = `${pct}%`;
    meter.append(fill);
    if (!compact) for (const q of [25, 50, 75]) { const m = el("em"); m.style.left = `${q}%`; meter.append(m); }
    box.append(meter);

    const you = el("div", "pot-you");
    if (pot.yours > 0) {
      you.append(el("span", null, "Your share "), el("b", null, `${pot.share}%`), el("small", null, ` · ${nums(pot.yours)} of ${nums(pot.play)} staked`));
    } else if (pot.play > 0) {
      you.append(el("span", null, compact ? "Play once today and you're in the draw." : `${pot.players} in the draw so far · play once today and you're in.`));
    } else {
      you.append(el("span", null, "Nobody's played yet today — the first bet opens the draw."));
    }
    box.append(you);

    if (!compact) {
      const foot = el("div", "pot-foot");
      foot.append(el("span", null, `Hidden line somewhere in ${nums(pot.floor)}–${nums(pot.ceiling)} · after 11 PM CT the next bet pays it`));
      if (pot.last) {
        const last = el("span");
        last.append(document.createTextNode("Last: "), el("b", null, pot.last.displayName), document.createTextNode(` took ${nums(pot.last.amount)} on ${pot.last.day.slice(5).replace("-", "/")}`));
        foot.append(last);
      }
      const how = el("a", "pot-how", "How it's drawn →");
      how.href = "/?view=verify&game=pot";
      how.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); history.pushState({ view: "verify" }, "", how.getAttribute("href")); window.ECV3?.go("verify", { push: false }); });
      foot.append(how);
      box.append(foot);
    }
  }

  function hit(pot) {
    const banner = el("div", "pot-hit");
    banner.append(el("div", "pot-hit-k", "The pot hit"));
    const h = el("div", "pot-hit-h");
    h.append(el("b", null, pot.winner?.login || "someone"), document.createTextNode(" takes "), el("b", "nums", `${nums(pot.amount)} ZC`));
    banner.append(h);
    banner.append(el("p", null, `Drawn from ${nums(pot.players)} players by stake. Tomorrow's pot opens at midnight Central.`));
    const x = el("button", "pot-hit-x", "✕"); x.type = "button"; x.addEventListener("click", () => banner.remove());
    banner.append(x);
    document.body.append(banner);
    K()?.burst?.();
    window.setTimeout(() => banner.classList.add("show"), 20);
    window.setTimeout(() => banner.remove(), 14000);
  }

  function mount(container, { compact = false } = {}) {
    const box = el("section", `cf-card pot${compact ? " compact" : ""}`);
    container.append(box);
    let timer = 0;
    const tick = async () => {
      if (!box.isConnected) { window.clearInterval(timer); return; }
      if (document.hidden) return;
      let data = null;
      try { data = await fetch("/api/casino/pot", { credentials: "include" }).then((r) => r.json()); } catch { data = null; }
      const pot = data?.ok ? data.pot : null;
      if (pot) {
        const before = seen.get(pot.day);
        seen.set(pot.day, pot.status);
        // Only a change seen by this page gets the banner, and only if
        // it just happened — not a pot that paid hours before it opened.
        if (before && before !== "PAID" && pot.status === "PAID" && pot.paidAt && Date.now() - new Date(pot.paidAt).getTime() < RECENT_MS && !document.querySelector(".pot-hit")) hit(pot);
      }
      draw(box, pot, compact);
    };
    tick();
    timer = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(timer);
  }

  window.ECPot = Object.freeze({ mount });
})();
