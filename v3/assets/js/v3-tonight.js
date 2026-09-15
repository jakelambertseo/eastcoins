/* ============================================================
   EastCoin V3 — "Tonight on Picks", the strip under the Sports ticker

   The slot the "Picks are now live" card used to fill. Now it says
   what is actually on the table, from /api/picks/bootstrap:

     · an open PROP takes the slot: the question, Yes and No with
       their lines, and a stake box right here — lock it without
       leaving the page (the same /api/picks/wagers the Picks page
       and the chat bot use)
     · else your open picks, with the live score once the game is on
     · else tonight's slate: how many games, when the first closes,
       how chat is split on it
     · else what opens next

   Refreshes every 60 s while the page is visible; stops when the
   strip leaves the page. ECTonight.mount(container, shell).
   ============================================================ */
(() => {
  "use strict";

  const POLL_MS = 60 * 1000;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined && text !== null) n.textContent = String(text); return n; };
  const line = (v) => { const n = Number(v); return !Number.isFinite(n) || n === 0 ? "" : n > 0 ? `+${n}` : `−${Math.abs(n)}`; };
  const decimalFrom = (american) => { const n = Number(american); if (!Number.isFinite(n) || n === 0) return 1; return n < 0 ? 1 + 100 / Math.abs(n) : 1 + n / 100; };
  const totalReturn = (stake, american) => { const a = Math.max(0, Math.floor(Number(stake) || 0)); return a ? Math.max(a, Math.ceil(a * decimalFrom(american))) : 0; };
  const nick = (name) => String(name || "").trim().split(/\s+/).pop() || "";
  const teamName = (v) => (v && typeof v === "object" ? String(v.name || "") : String(v || ""));
  const isProp = (m) => String(m?.sport || "").toLowerCase() === "prop";
  const when = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  };

  function zc(n) {
    const s = el("span", "zc-amount nums");
    const img = document.createElement("img"); img.className = "zcoin-mark"; img.src = "/v3/assets/img/zcoin.webp"; img.alt = ""; img.width = 14; img.height = 14;
    s.append(img, document.createTextNode(Number(n || 0).toLocaleString()));
    return s;
  }

  function go(shell, view, href) {
    const a = el("a", "picksbanner-cta");
    a.href = href;
    a.addEventListener("click", (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); history.pushState({ view }, "", href); shell?.go?.(view, { push: false }); });
    return a;
  }

  function mount(container, shell) {
    const box = el("div", "tonight picksbanner");
    container.append(box);
    let data = null;
    let upcoming = null;
    let timer = 0;
    let pending = null;       // { market, side } while the stake box is open

    box.append(el("span", "picksbanner-tag tonight-tag", "Picks"), el("span", "picksbanner-copy", "Checking tonight's slate…"));

    async function load() {
      if (!box.isConnected) { window.clearInterval(timer); return; }
      if (document.hidden) return;
      try {
        const payload = await fetch("/api/picks/bootstrap", { credentials: "include" }).then((r) => r.json());
        if (!payload?.ok) throw new Error("bootstrap");
        data = payload;
      } catch { data = data || null; }
      const openNow = (data?.markets || []).filter((m) => m.state === "OPEN" && new Date(m.startsAt).getTime() > Date.now());
      const mine = (data?.myPicks || []).filter((p) => p.status === "ACTIVE");
      if (!openNow.length && !mine.length && upcoming === null) {
        try { const u = await fetch("/api/picks/upcoming").then((r) => r.json()); upcoming = Array.isArray(u?.games) ? u.games : []; } catch { upcoming = []; }
      }
      paint();
    }

    function paint() {
      if (!data) { box.replaceChildren(el("span", "picksbanner-tag tonight-tag", "Picks"), el("span", "picksbanner-copy", "Picks is taking a moment…"), go(shell, "picks", "/?view=picks")); return; }
      const now = Date.now();
      const openNow = (data.markets || []).filter((m) => m.state === "OPEN" && new Date(m.startsAt).getTime() > now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      const props = openNow.filter(isProp);
      const mine = (data.myPicks || []).filter((p) => p.status === "ACTIVE");
      box.classList.remove("prop", "yours");
      if (props.length) return paintProp(props, mine);
      if (mine.length) return paintMine(mine);
      if (openNow.length) return paintSlate(openNow);
      return paintNext();
    }

    /* ---------------------------------------------------- an open prop */
    function paintProp(props, mine) {
      const m = props[0];
      box.classList.add("prop");
      box.replaceChildren();
      const already = mine.find((p) => p.marketId === m.id) || null;
      const head = el("div", "tonight-head");
      head.append(el("span", "picksbanner-tag tonight-tag prop", "Prop bet"), el("span", "tonight-when", `Closes ${when(m.startsAt)}`));
      if (props.length > 1) { const more = go(shell, "picks", "/?view=picks"); more.textContent = `+${props.length - 1} more →`; more.className = "tonight-more"; head.append(more); }
      box.append(head);
      box.append(el("p", "tonight-q", m.question || "Prop bet"));

      if (already) {
        const side = already.selection === "home" ? "NO" : "YES";
        const you = el("div", "tonight-you");
        you.append(el("b", null, `You're on ${side} ${line(already.oddsLocked)}`), document.createTextNode(" · "), zc(already.wager), document.createTextNode(" staked · returns "), zc(totalReturn(already.wager, already.oddsLocked)), document.createTextNode(" if it lands"));
        box.append(you);
        return;
      }

      const sides = el("div", "tonight-sides");
      for (const [key, label, odds] of [["away", "Yes", m.awayOdds], ["home", "No", m.homeOdds]]) {
        const b = el("button", `tonight-side${pending?.side === key ? " on" : ""}`);
        b.type = "button";
        b.append(el("span", "tonight-mark", key === "away" ? "✓" : "✗"), el("b", null, label), el("span", "tonight-line nums", line(odds)));
        b.addEventListener("click", () => { pending = pending?.side === key ? null : { market: m, side: key, odds, stake: pending?.stake || 10 }; paint(); });
        sides.append(b);
      }
      box.append(sides);

      if (!data.session?.authenticated) {
        box.append(el("p", "tonight-note", "Log in with Twitch to pick a side."));
        return;
      }
      if (pending && pending.market.id === m.id) {
        const row = el("form", "tonight-stake");
        const input = el("input", "nums"); input.type = "number"; input.min = "1"; input.step = "1"; input.value = String(pending.stake); input.inputMode = "numeric"; input.setAttribute("aria-label", "Stake");
        const lock = el("button", "btn primary", ""); lock.type = "submit";
        const note = el("span", "tonight-note");
        const refresh = () => {
          const s = Math.max(0, Math.floor(Number(input.value) || 0)); pending.stake = s;
          lock.replaceChildren(document.createTextNode(`Lock ${pending.side === "away" ? "YES" : "NO"} for `), zc(s));
          note.replaceChildren(document.createTextNode("Returns "), zc(totalReturn(s, pending.odds)), document.createTextNode(" if it lands"));
          lock.disabled = s < 1;
        };
        input.addEventListener("input", refresh);
        row.append(input, lock, note);
        row.addEventListener("submit", async (e) => {
          e.preventDefault();
          lock.disabled = true; lock.textContent = "Locking…";
          let r = null;
          try { r = await fetch("/api/picks/wagers", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ marketId: m.id, selection: pending.side, wager: pending.stake }) }).then((x) => x.json()); } catch { r = null; }
          if (r?.ok) {
            if (Number.isFinite(Number(r.balance))) window.ECV3?.setWallet?.(Number(r.balance));
            pending = null;
            await load();
            return;
          }
          note.textContent = r?.message || "That didn't go through.";
          note.classList.add("bad");
          lock.disabled = false; refresh();
        });
        box.append(row);
        refresh();
        window.setTimeout(() => { input.focus(); input.select(); }, 0);
      } else {
        box.append(el("p", "tonight-note", `Yes ${line(m.awayOdds)} · No ${line(m.homeOdds)} · pick a side to stake it here.`));
      }
    }

    /* ---------------------------------------------------- your picks */
    function paintMine(mine) {
      box.classList.add("yours");
      box.replaceChildren();
      const head = el("div", "tonight-head");
      head.append(el("span", "picksbanner-tag tonight-tag", "Your picks"), el("span", "tonight-when", `${mine.length} riding`));
      box.append(head);
      const chips = el("div", "tonight-chips");
      const sorted = mine.slice().sort((a, b) => new Date(a.market?.startsAt || 0) - new Date(b.market?.startsAt || 0));
      for (const p of sorted.slice(0, 3)) {
        const m = p.market || {};
        const side = p.selection === "home" ? teamName(m.home) : teamName(m.away);
        const opp = p.selection === "home" ? teamName(m.away) : teamName(m.home);
        const chip = el("a", "tonight-chip glink");
        chip.href = `/g/${m.slug || m.id || ""}`;
        const label = isProp(m) ? `${p.selection === "home" ? "NO" : "YES"} ${line(p.oddsLocked)}` : `${nick(side)} ${line(p.oddsLocked)}`;
        chip.append(el("b", null, label));
        const sub = el("small", null, isProp(m) ? String(m.question || "").slice(0, 40) : `vs ${nick(opp)} · ${m.state === "OPEN" ? `${when(m.startsAt)}` : "in play"}`);
        chip.append(sub);
        chips.append(chip);
        if (!isProp(m) && window.ECV3Scores && teamName(m.home) && teamName(m.away)) {
          window.ECV3Scores.forMatch({ teams: { home: { name: teamName(m.home) }, away: { name: teamName(m.away) } } }).then((score) => {
            if (!score || score.state === "pre" || !chip.isConnected) return;
            const s = el("span", `tonight-score nums${score.state === "in" ? " in" : ""}`);
            const mineHome = p.selection === "home";
            const my = mineHome ? score.home?.score : score.away?.score;
            const their = mineHome ? score.away?.score : score.home?.score;
            s.textContent = `${my ?? "–"}–${their ?? "–"} ${score.state === "post" ? "final" : score.detail || "live"}`;
            sub.replaceChildren(s);
          }).catch(() => {});
        }
      }
      if (mine.length > 3) chips.append(el("span", "tonight-note", `+${mine.length - 3} more`));
      box.append(chips);
      const cta = go(shell, "picks", "/?view=picks&tab=mypicks"); cta.textContent = "My Picks →";
      box.append(cta);
    }

    /* ---------------------------------------------------- the slate */
    function paintSlate(openNow) {
      box.replaceChildren();
      const first = openNow[0];
      const leagues = [...new Set(openNow.map((m) => String(m.league || m.sport || "").toUpperCase()))];
      const count = leagues.length === 1 ? `${openNow.length} ${leagues[0]} game${openNow.length === 1 ? "" : "s"}` : `${openNow.length} games`;
      // How chat is split on the first game to close, from the public ledger.
      const on = (data.communityLedger || []).filter((r) => r.status === "ACTIVE" && r.market?.id === first.id);
      const a = on.filter((r) => r.selection === "away").length;
      const h = on.filter((r) => r.selection === "home").length;
      const split = on.length ? ` · chat is ${Math.max(a, h)}–${Math.min(a, h)} on the ${nick(a >= h ? teamName(first.away) : teamName(first.home))}` : "";
      box.append(el("span", "picksbanner-tag tonight-tag", "Tonight"));
      const copy = el("span", "picksbanner-copy");
      copy.append(el("strong", null, `${count} open`), document.createTextNode(` · ${nick(teamName(first.away))} at ${nick(teamName(first.home))} closes ${when(first.startsAt)}${split}`));
      box.append(copy);
      const cta = go(shell, "picks", "/?view=picks"); cta.textContent = data.session?.authenticated ? "Make your picks →" : "Log in to pick →";
      box.append(cta);
    }

    /* ---------------------------------------------------- what's next */
    function paintNext() {
      box.replaceChildren();
      const next = (upcoming || []).slice().sort((x, y) => new Date(x.startsAt) - new Date(y.startsAt))[0];
      box.append(el("span", "picksbanner-tag tonight-tag", "Picks"));
      const copy = el("span", "picksbanner-copy");
      if (next) {
        const opens = next.opensAt ? new Date(next.opensAt) : new Date(new Date(next.startsAt).getTime() - 3600000);
        copy.append(el("strong", null, `Next up: ${nick(teamName(next.away))} at ${nick(teamName(next.home))}`), document.createTextNode(` · opens ${when(opens.toISOString())}, kicks off ${when(next.startsAt)}`));
      } else {
        copy.append(el("strong", null, "Nothing open right now"), document.createTextNode(" · NFL opens an hour before kickoff."));
      }
      box.append(copy);
      const cta = go(shell, "picks", "/?view=picks"); cta.textContent = "Open Picks →";
      box.append(cta);
    }

    // The Sports page builds its top block before attaching it, so the
    // first read waits a tick — a load that ran now would find the strip
    // not yet in the document and stop for good.
    window.setTimeout(load, 0);
    timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }

  window.ECTonight = Object.freeze({ mount });
})();
