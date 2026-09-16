/* ============================================================
   The Daily Jackpot, on the page.

   ECPot.mount(container, { compact | pill })  — draws the pot and keeps it
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

  // The last payload this browser saw, so a page paints the pot before
  // its own fetch comes back; a cold Worker can take a second or two.
  const CACHE_KEY = "ec_pot_last";
  const cached = () => { try { const v = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"); return v && Date.now() - v.at < 10 * 60000 ? v.pot : null; } catch { return null; } };
  const remember = (pot) => { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), pot })); } catch { /* fine */ } };

  // The frame, drawn at once, so the card is never an empty bar.
  function skeleton(box, compact) {
    box.replaceChildren();
    const head = el("div", "pot-k");
    head.append(el("span", "pot-dot"), el("span", null, "Today's Jackpot"));
    box.append(head);
    const amt = el("div", "pot-amt");
    amt.append(el("b", "nums", "100"), el("span", null, compact ? "ZC" : "ZC · counting the day's play…"));
    box.append(amt);
    const meter = el("div", "pot-meter");
    meter.append(el("i"));
    box.append(meter);
    box.append(el("div", "pot-you", compact ? "Loading…" : "Loading the day's play…"));
  }

  function draw(box, pot, compact) {
    box.replaceChildren();
    if (!pot) { box.append(el("p", "cf-empty", "The Jackpot is out of reach for a moment.")); return; }
    const paid = pot.status === "PAID";
    const pct = Math.max(0, Math.min(100, Math.round((pot.play / pot.ceiling) * 100)));

    const head = el("div", "pot-k");
    head.append(el("span", `pot-dot${paid ? " off" : ""}`), el("span", null, paid ? "Today's Jackpot went" : "Today's Jackpot"));
    if (!paid) head.append(el("span", "pot-sub", `· must hit by ${nums(pot.ceiling)} of play`));
    box.append(head);

    if (paid && pot.winner) {
      const w = el("div", "pot-paid");
      const person = { login: pot.winner.login, displayName: pot.winner.displayName || (pot.last?.login === pot.winner.login ? pot.last.displayName : pot.winner.login), avatar: pot.winner.avatar || (pot.last?.login === pot.winner.login ? pot.last.avatar : "") };
      const who = K()?.nameLink ? K().nameLink(person) : el("b", null, person.displayName);
      if (K()?.avatar) w.append(K().avatar(person, "cf-av pot-av"));
      w.append(who, document.createTextNode(" took "), K()?.zc ? K().zc(pot.amount) : el("b", null, `${nums(pot.amount)} ZC`), document.createTextNode(` at ${new Date(pot.paidAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`));
      box.append(w);
      box.append(el("p", "pot-note", "Tomorrow's Jackpot opens at midnight Central."));
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
    banner.append(el("div", "pot-hit-k", "JACKPOT"));
    const h = el("div", "pot-hit-h");
    if (K()?.avatar) banner.append(K().avatar({ login: pot.winner?.login, displayName: pot.winner?.displayName, avatar: pot.winner?.avatar }, "cf-av pot-hit-av"));
    h.append(el("b", null, pot.winner?.displayName || pot.winner?.login || "someone"), document.createTextNode(" takes "), el("b", "nums", `${nums(pot.amount)} ZC`));
    banner.append(h);
    banner.append(el("p", null, `Drawn from ${nums(pot.players)} players by stake. Tomorrow's Jackpot opens at midnight Central.`));
    const x = el("button", "pot-hit-x", "✕"); x.type = "button"; x.addEventListener("click", () => banner.remove());
    banner.append(x);
    document.body.append(banner);
    K()?.burst?.();
    window.setTimeout(() => banner.classList.add("show"), 20);
    window.setTimeout(() => banner.remove(), 14000);
  }

  /* The casino floor's header bar: one cell with the amount on it, the
     detail on hover. Same poll, same cache and the SAME hit banner —
     only the drawing is different, so the Jackpot can sit in the pill
     without a second source of truth or a second request. */
  function drawPill(box, pot) {
    box.replaceChildren();
    const paid = pot?.status === "PAID";
    box.classList.toggle("paid", Boolean(paid));
    box.append(el("small", null, paid ? "Jackpot went" : "Jackpot"));
    const b = el("b", "nums", pot ? nums(pot.amount) : "100");
    b.append(el("i", null, " ZC"));
    box.append(b);
    box.title = !pot ? "Today's Jackpot"
      : paid ? `${pot.winner?.displayName || "Someone"} took it today. Tomorrow's opens at midnight Central.`
        : pot.yours > 0 ? `Your share ${pot.share}% · ${nums(pot.play)} ZC staked today by ${nums(pot.players)} players.`
          : `${nums(pot.play)} ZC of play today. Play once and you're in the draw.`;
  }

  function mount(container, { compact = false, pill = false } = {}) {
    const box = el(pill ? "span" : "section", pill ? "cas-jack" : `cf-card pot${compact ? " compact" : ""}`);
    container.append(box);
    const last = cached();
    if (pill) drawPill(box, last);
    else if (last) draw(box, last, compact); else skeleton(box, compact);
    let timer = 0;
    let misses = 0;
    const tick = async () => {
      if (!box.isConnected) { window.clearInterval(timer); return; }
      if (document.hidden) return;
      let data = null;
      try {
        // A hard cap on the wait: a stuck request must not hold the card.
        const ctl = new AbortController();
        const cap = window.setTimeout(() => ctl.abort(), 6000);
        data = await fetch("/api/casino/pot", { credentials: "include", signal: ctl.signal }).then((r) => r.json());
        window.clearTimeout(cap);
      } catch { data = null; }
      const pot = data?.ok ? data.pot : null;
      // A miss on the way in gets a quick second and third try rather
      // than the next poll fifteen seconds out.
      if (!pot && misses < 3) { misses += 1; window.setTimeout(tick, 1500 * misses); }
      if (pot) misses = 0;
      if (pot) {
        remember(pot);
        const before = seen.get(pot.day);
        seen.set(pot.day, pot.status);
        // Only a change seen by this page gets the banner, and only if
        // it just happened — not a pot that paid hours before it opened.
        if (before && before !== "PAID" && pot.status === "PAID" && pot.paidAt && Date.now() - new Date(pot.paidAt).getTime() < RECENT_MS && !document.querySelector(".pot-hit")) hit(pot);
      }
      if (pill) drawPill(box, pot);
      else if (pot || box.querySelector(".pot-you")?.textContent !== "Loading the day's play…") draw(box, pot, compact);
    };
    tick();
    timer = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(timer);
  }

  window.ECPot = Object.freeze({ mount });
})();
