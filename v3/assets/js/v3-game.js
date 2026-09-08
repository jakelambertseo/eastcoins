/* ============================================================
   EastCoin V3 — the game page

     /g/mustangs-seminoles-20260907   one game: every pick, paid out
     /g/20260907                      that day's games

   The link the bot posts. Lives inside the shell like any other
   view, so it has the nav and the chat, but it is not in the nav:
   you get here from chat, from a settled pick, or from the day
   list. Everything shown comes from /api/picks/game, which reads
   the same rows settlement wrote.
   ============================================================ */
(() => {
  "use strict";

  let root = null;
  let shell = null;
  let previousTitle = "";
  let token = 0;

  /* ---------------------------------------------------------- helpers */

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatLine(american) {
    const line = Number(american);
    if (!Number.isFinite(line) || line === 0) return "—";
    return line > 0 ? `+${line}` : `−${Math.abs(line)}`;
  }

  function nick(name) {
    return String(name || "").trim().split(/\s+/).pop() || "";
  }

  function initials(name) {
    return nick(name).replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "?";
  }

  function when(iso, opts) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], opts);
  }

  function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }

  function pathKey() {
    const m = /^\/g\/([^/?#]+)/i.exec(location.pathname);
    return m ? decodeURIComponent(m[1]).toLowerCase() : "";
  }

  function link(href, className, text) {
    const a = el("a", className, text);
    a.href = href;
    return a;
  }

  function logo() {
    const img = el("img", "gp-logo");
    img.src = "/assets/eastcoins-logo.webp";
    img.alt = "";
    img.width = 44;
    img.height = 44;
    return img;
  }

  /* ---------------------------------------------------------- one game */

  function gamePage(data) {
    const m = data.market;
    const picks = data.picks || [];
    const settled = m.state === "SETTLED";
    const voided = m.state === "VOID";
    const winner = m.winner;
    const winName = winner === "home" ? m.home.name : winner === "away" ? m.away.name : "";
    const sideOf = (p) => (p.selection === "home" ? m.home : m.away);

    const staked = (side) => picks.filter((p) => p.selection === side).reduce((n, p) => n + p.wager, 0);
    const count = (side) => picks.filter((p) => p.selection === side).length;
    const aw = staked("away");
    const hm = staked("home");
    const totalStaked = aw + hm;
    const paidOut = picks.reduce((n, p) => n + (p.status === "WON" || p.status === "REFUNDED" ? p.payout : 0), 0);
    const won = picks.filter((p) => p.status === "WON");
    const lost = picks.filter((p) => p.status === "LOST");
    const best = won.slice().sort((a, b) => b.profit - a.profit)[0];
    const worst = lost.slice().sort((a, b) => a.profit - b.profit)[0];
    const decided = won.length + lost.length;

    const page = el("section", "gamepage");

    // Head: league, kick-off, state pill
    const head = el("div", "viewhead");
    const headCopy = el("div");
    headCopy.append(el("h1", null, `${m.away.name} at ${m.home.name}`));
    headCopy.append(el("p", "gp-sub",
      `${m.league || m.sport} · ${when(m.startsAt, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`));
    head.append(headCopy);
    const pill = el("span", `gp-pill ${settled ? "settled" : voided ? "void" : m.state === "LOCKED" ? "locked" : "open"}`,
      settled ? "Settled" : voided ? "Voided" : m.state === "LOCKED" ? "Betting closed" : "Betting open");
    head.append(pill);
    page.append(head);

    // Board
    const board = el("div", "gp-board");
    const teams = el("div", "gp-teams");
    const teamCell = (side, key) => {
      const cell = el("div", `gp-team${winner === key ? " won" : ""}`);
      cell.append(el("div", "gp-crest", initials(side.name)), el("div", "gp-name", side.name), el("div", "gp-line", formatLine(side.line)));
      return cell;
    };
    const score = el("div", "gp-score");
    const hasScore = (settled || voided) && Number.isInteger(m.away.score) && Number.isInteger(m.home.score);
    score.append(
      el("b", `nums${winner === "away" ? " win" : ""}`, hasScore ? String(m.away.score) : "–"),
      el("i", null, hasScore ? "–" : "at"),
      el("b", `nums${winner === "home" ? " win" : ""}`, hasScore ? String(m.home.score) : "–")
    );
    teams.append(teamCell(m.away, "away"), score, teamCell(m.home, "home"));
    board.append(teams);
    if (settled && winName) {
      const detail = m.settlementDetail && m.settlementDetail !== "Final" ? ` · ${m.settlementDetail}` : "";
      board.append(el("div", "gp-tag", `${winName} win${detail}`));
    } else if (voided) {
      board.append(el("div", "gp-tag void", `Voided · every stake refunded${m.settlementDetail ? " · " + m.settlementDetail : ""}`));
    }
    page.append(board);

    // Highlights
    if (settled && picks.length) {
      const hls = el("div", "gp-hls");
      const hl = (cls, label, big, small) => {
        const box = el("div", `gp-hl ${cls}`);
        box.append(el("span", null, label), el("b", null, big), el("em", null, small));
        return box;
      };
      if (best) hls.append(hl("good", "Biggest win", `${best.user.displayName} +${best.profit}`, `${sideOf(best).name} at ${formatLine(best.line)}`));
      if (worst) hls.append(hl("bad", "Worst beat", `${worst.user.displayName} −${Math.abs(worst.profit)}`, `Backed ${sideOf(worst).name}`));
      if (decided) hls.append(hl("", "Chat was", `${Math.round(100 * won.length / decided)}% right`, `${won.length} of ${decided} took ${winName}`));
      page.append(hls);
    }

    // Split
    if (picks.length) {
      const split = el("div", "gp-split");
      const top = el("div", "gp-split-top");
      top.append(
        el("span", `l${winner === "home" ? " dim" : ""}`, `${m.away.name} · ${plural(count("away"), "pick")} · ${aw} ZC`),
        el("span", `r${winner === "away" ? " dim" : ""}`, `${hm} ZC · ${plural(count("home"), "pick")} · ${m.home.name}`)
      );
      const bar = el("div", "gp-bar");
      const a = el("i", "a");
      const b = el("i", "b");
      const pct = totalStaked ? Math.round(100 * aw / totalStaked) : 50;
      a.style.width = `${pct}%`;
      b.style.width = `${100 - pct}%`;
      bar.append(a, b);
      split.append(top, bar, el("div", "gp-split-note", `${totalStaked} ZCoins staked across ${plural(picks.length, "pick")}`));
      page.append(split);
    }

    // Rows
    page.append(el("h2", "gp-h2", "Every pick"));
    const openNote = m.state === "OPEN" ? " Betting is still open." : m.state === "LOCKED" ? " Betting is closed for kick-off." : "";
    page.append(el("p", "gp-sub",
      `Everyone gets the same line — it was locked at ${formatLine(m.away.line)} / ${formatLine(m.home.line)} when the market opened, and never moved after that.${openNote}`));

    const rows = el("div", "gp-rows");
    if (!picks.length) {
      rows.append(el("p", "gp-sub", "No picks were placed on this game."));
    }
    for (const p of picks) {
      const cls = p.status === "WON" ? "won" : p.status === "LOST" ? "lost" : p.status === "REFUNDED" ? "refund" : "open";
      const row = el("div", `gp-row ${cls}`);

      let av;
      if (p.user.avatar) {
        av = el("img", "gp-av");
        av.src = p.user.avatar;
        av.alt = "";
        av.loading = "lazy";
      } else {
        av = el("div", "gp-av", p.user.displayName[0].toUpperCase());
      }

      const who = el("div", "gp-who");
      who.append(el("b", null, p.user.displayName), el("span", null, `${sideOf(p).name} @ ${formatLine(p.line)}`));

      const stake = el("div", "gp-stake");
      stake.append(el("b", "nums", String(p.wager)), document.createTextNode("staked"));

      const payout = el("div", "gp-payout nums");
      if (p.status === "WON") {
        payout.classList.add("up");
        payout.append(`+${p.profit}`, el("small", null, `returned ${p.payout}`));
      } else if (p.status === "LOST") {
        payout.classList.add("down");
        payout.append(`−${p.wager}`, el("small", null, "returned 0"));
      } else if (p.status === "REFUNDED") {
        payout.append("0", el("small", null, `refunded ${p.payout}`));
      } else {
        payout.classList.add("muted");
        payout.append(String(p.potential), el("small", null, "if it wins"));
      }

      row.append(av, who, stake, payout);
      rows.append(row);
    }
    page.append(rows);

    // Settlement
    if (settled || voided) {
      const box = el("div", "gp-settle");
      box.append(el("h3", null, "Settlement"));
      const dl = el("dl");
      const item = (k, v) => {
        const d = el("div");
        d.append(el("dt", null, k), el("dd", null, v));
        dl.append(d);
      };
      item("Graded from", m.settlementSource === "admin" ? "Closed by an admin" : "The Odds API · final score");
      if (m.settledAt) item("Settled at", when(m.settledAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
      item("Total staked", `${totalStaked} ZCoins`);
      item("Paid out", `${paidOut} ZCoins`);
      item("Rounding", "Up, in the bettor's favour");
      const ops = data.ops || { total: 0, confirmed: 0 };
      item("Ledger", `${plural(ops.total, "operation")}, ${ops.confirmed === ops.total ? "all confirmed" : `${ops.confirmed} confirmed`}`);
      box.append(dl);
      page.append(box);
    }

    page.append(el("p", "gp-foot", "Every pick, payout and balance change on this page is recorded in the Community Ledger."));
    page.append(footerLinks(m.day));
    return page;
  }

  /* ---------------------------------------------------------- one day */

  function dayPage(data) {
    const page = el("section", "gamepage");
    const day = data.day;
    const pretty = new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8), 17))
      .toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

    const head = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, pretty), el("p", "gp-sub", "Every market EastCoin ran that day. Open one for the picks and payouts."));
    head.append(copy);
    page.append(head);

    const rows = el("div", "gp-rows");
    if (!data.markets.length) rows.append(el("p", "gp-sub", "No games on this day."));
    for (const m of data.markets) {
      const cls = m.state === "SETTLED" ? "won" : m.state === "VOID" ? "refund" : "open";
      const row = link(`/g/${m.slug}`, `gp-row ${cls} link`);
      const who = el("div", "gp-who");
      who.append(
        el("b", null, `${m.away.name} at ${m.home.name}`),
        el("span", null, `${when(m.startsAt, { hour: "numeric", minute: "2-digit" })} · ${plural(m.picks || 0, "pick")}`)
      );
      const result = m.state === "SETTLED" && Number.isInteger(m.away.score)
        ? `${m.away.score}–${m.home.score}`
        : m.state === "VOID" ? "voided" : m.state === "LOCKED" ? "in play" : "open";
      row.append(who, el("div", "gp-payout nums", result));
      rows.append(row);
    }
    page.append(rows);
    page.append(footerLinks(null));
    return page;
  }

  function footerLinks(day) {
    const foot = el("div", "gp-links");
    if (day) foot.append(link(`/g/${day}`, "gp-back", "All games that day"));
    const back = link("/?view=picks", "gp-back", "← Back to Picks");
    back.dataset.picks = "1";
    foot.append(back);
    return foot;
  }

  function notice(title, body) {
    const page = el("section", "gamepage");
    const box = el("div", "gp-notice");
    box.append(logo(), el("strong", null, title), el("p", null, body));
    box.append(footerLinks(null));
    page.append(box);
    return page;
  }

  /* ---------------------------------------------------------- load */

  async function load() {
    const key = pathKey();
    const mine = ++token;
    root.replaceChildren(notice("Loading…", "Reading the ledger."));

    if (!key) {
      root.replaceChildren(notice("No game here", "The link in chat is the reliable way in."));
      return;
    }

    let payload = null;
    try {
      const response = await fetch(`/api/picks/game?g=${encodeURIComponent(key)}`, { credentials: "include" });
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (mine !== token || !root.isConnected) return;

    if (!payload?.ok) {
      document.title = "No game here — EastCoin";
      root.replaceChildren(notice("No game here", payload?.message || "Nothing is filed under that name. The link in chat is the reliable way in."));
      return;
    }

    if (payload.kind === "day") {
      const d = payload.day;
      const pretty = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), 17))
        .toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
      document.title = `Picks — ${pretty} — EastCoin`;
      root.replaceChildren(dayPage(payload));
    } else {
      const m = payload.market;
      const score = m.state === "SETTLED" && Number.isInteger(m.away.score) ? ` ${m.away.score}–${m.home.score}` : "";
      document.title = `${m.away.name} at ${m.home.name}${score} — EastCoin Picks`;
      root.replaceChildren(gamePage(payload));
    }
  }

  // Links within the page stay within the shell: a day list to a game,
  // a game back to its day, and the way back to Picks.
  function onClick(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const a = event.target.closest("a");
    if (!a || !root.contains(a)) return;
    if (a.dataset.picks) {
      event.preventDefault();
      shell.go("picks");
      return;
    }
    const href = a.getAttribute("href") || "";
    if (href.startsWith("/g/")) {
      event.preventDefault();
      history.pushState({ view: "game" }, "", href);
      load();
    }
  }

  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      previousTitle = document.title;
      root.addEventListener("click", onClick);
      load();
    },
    unmount() {
      token++;
      root?.removeEventListener("click", onClick);
      document.title = previousTitle || "EastCoin";
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("game", view);
  }
  boot();
})();
