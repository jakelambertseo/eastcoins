/* ============================================================
   EastCoin V3 — Picks admin

   A operating surface for the three admin logins. Everything here
   already existed as an endpoint; the point is that opening a
   market that real ZCoins get bet against should not require
   hand-typing JSON into a browser console, where a mistyped line
   becomes a real mispriced market.

   Two habits it enforces:
     · the payout is previewed from the entered odds before the
       market can be created
     · destructive-ish actions state what they will do first
   ============================================================ */
(() => {
  "use strict";

  const local = { health: null, markets: [], busy: false, message: null, announce: null };
  let root = null;
  let shell = null;

  /* ---------------------------------------------------------- money
     Mirrors the server's rule exactly so the preview cannot promise
     a number settlement wouldn't pay. */

  function totalReturn(stake, american) {
    const amount = Math.max(0, Math.floor(Number(stake) || 0));
    const line = Number(american);
    if (!amount || !Number.isFinite(line) || line === 0) return 0;
    const decimal = line < 0 ? 1 + 100 / Math.abs(line) : 1 + line / 100;
    return Math.max(amount, Math.ceil(amount * decimal));
  }

  function formatLine(value) {
    const line = Number(value);
    if (!Number.isFinite(line) || line === 0) return "—";
    return line > 0 ? `+${line}` : String(line);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // "+102", "102", "-122" and a typographic "−122" all mean what they say.
  // The line boxes are plain text on purpose: a number box silently empties
  // "+102" in some browsers (Firefox), which sent a blank line and got the
  // open refused with no visible reason.
  function parseLine(raw) {
    const s = String(raw || "").trim().replace(/[\u2212\u2013\u2014]/g, "-").replace(/\s+/g, "");
    if (!/^[+-]?\d{3,5}$/.test(s)) return NaN;
    const n = parseInt(s, 10);
    return Math.abs(n) >= 100 ? n : NaN;
  }

  /** "12 min ago", for when a market was last announced. */
  function ago(iso) {
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 60000) return "just now";
    const m = Math.round(ms / 60000);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} day${Math.round(h / 24) === 1 ? "" : "s"} ago`;
  }

  // Fights have no scores feed: the result is entered here by hand.
  const isFightSport = (sport) => sport === "boxing" || sport === "mma";
  const vsOf = (m) => (isFightSport(m.sport) ? "vs" : "at");

  /* ---------------------------------------------------------- data */

  async function load() {
    const [health, markets, announce] = await Promise.all([
      fetch("/api/picks/wallet-health").then((r) => r.json()).catch(() => null),
      fetch("/api/picks/admin/markets").then((r) => r.json()).catch(() => null),
      fetch("/api/picks/admin/announce").then((r) => r.json()).catch(() => null)
    ]);
    local.announce = announce?.ok ? announce : null;
    local.health = health;
    local.markets = markets?.ok ? markets.markets : [];
    local.forbidden = markets && !markets.ok && markets.code === "NOT_ADMIN";
  }

  async function post_(url, body) {
    local.busy = true;
    paint();
    let payload = null;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : {},
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include"
      });

      // Read as text first. An HTML body here means the request never
      // reached the function — a redeploy in flight, an auth redirect,
      // or a 500 page — and reporting "unexpected token <" tells the
      // operator nothing about which. The status code does.
      const raw = await response.text();
      try {
        payload = JSON.parse(raw);
      } catch {
        const kind = raw.trimStart().startsWith("<") ? "an HTML page" : "a non-JSON body";
        payload = {
          ok: false,
          message:
            `Server returned ${response.status} with ${kind}. ` +
            (response.status === 200
              ? "The site is probably mid-deploy — wait a moment and try again."
              : response.status === 500
                ? "The endpoint threw. Check the Pages function logs."
                : "Try again; if it persists the route may not be deployed.")
        };
      }
    } catch (error) {
      payload = { ok: false, message: String(error?.message || "Request failed") };
    }
    local.busy = false;
    return payload;
  }

  /* ---------------------------------------------------------- health */

  function healthCard() {
    const card = el("div", "adm-card");
    const h = local.health;

    const state = !h ? "unknown" : h.status;
    const ok = Boolean(h?.ok);

    const row = el("div", "adm-health");
    row.append(el("span", `adm-dot ${ok ? "good" : "bad"}`));

    const copy = el("div");
    copy.append(el("strong", null, ok ? "ZCoin transfers ready" : "ZCoin transfers unavailable"));
    copy.append(el("small", null, h?.message || "Couldn't reach the wallet health check."));
    row.append(copy);

    const tag = el("span", "adm-tag", state);
    row.append(tag);
    card.append(row);

    if (h?.channel) {
      const detail = el("p", "adm-note");
      detail.textContent = h.channel.matches
        ? `Token belongs to ${h.channel.name || h.channel.tokenBelongsTo} — the channel being written to.`
        : `Token belongs to ${h.channel.tokenBelongsTo}, but ${h.channel.configured} is configured. Nothing will be written.`;
      card.append(detail);
    }
    return card;
  }

  /* ---------------------------------------------------------- open form */

  function openForm() {
    const card = el("div", "adm-card");
    card.append(el("h2", "adm-h", "Open a market"));
    card.append(el("p", "adm-note",
      "Use full team names as the scores feed spells them — “Los Angeles Dodgers”, not “LAD”. " +
      "Settlement matches on these names, and a market it can't match will never grade."));

    const grid = el("div", "adm-grid");
    const fields = {};

    function field(key, label, attrs = {}) {
      const wrap = el("label", "adm-field");
      wrap.append(el("span", null, label));
      const input = document.createElement(attrs.tag === "select" ? "select" : "input");
      if (attrs.tag === "select") {
        for (const [value, text] of attrs.options) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = text;
          input.append(option);
        }
      } else {
        input.type = attrs.type || "text";
        if (attrs.placeholder) input.placeholder = attrs.placeholder;
        if (attrs.value) input.value = attrs.value;
        if (attrs.step) input.step = attrs.step;
      }
      wrap.append(input);
      fields[key] = input;
      grid.append(wrap);
      return input;
    }

    field("sport", "Sport", {
      tag: "select",
      options: [
        ["baseball", "Baseball (MLB)"],
        ["american-football", "Football (NFL / CFB)"],
        ["basketball", "Basketball (NBA)"],
        ["hockey", "Hockey (NHL)"],
        ["boxing", "Boxing (settled by hand)"],
        ["mma", "MMA / UFC (settled by hand)"]
      ]
    });
    field("league", "League label", { placeholder: "MLB", value: "MLB" });
    field("away", "Away team", { placeholder: "Cincinnati Reds" });
    field("home", "Home team", { placeholder: "Los Angeles Dodgers" });
    field("awayOdds", "Away line", { placeholder: "+150" });
    field("homeOdds", "Home line", { placeholder: "-175" });
    field("startsAt", "Starts at (local)", { type: "datetime-local" });

    // Picking a sport fills in its usual league label, unless one was typed.
    const LEAGUE_FOR = { baseball: "MLB", "american-football": "NFL", basketball: "NBA", hockey: "NHL", boxing: "Boxing", mma: "UFC" };
    fields.sport.addEventListener("change", () => {
      const now = fields.league.value.trim();
      if (!now || Object.values(LEAGUE_FOR).includes(now) || now === "CFB") fields.league.value = LEAGUE_FOR[fields.sport.value] || "";
      const fight = isFightSport(fields.sport.value);
      fields.away.placeholder = fight ? "Ryan Garcia" : "Cincinnati Reds";
      fields.home.placeholder = fight ? "Conor Benn" : "Los Angeles Dodgers";
    });

    // Every action on this page redraws the whole page, which used to wipe
    // the form, so a refused open looked like nothing happened. What was
    // typed is kept until a market actually opens.
    const DRAFT_KEYS = ["sport", "league", "away", "home", "awayOdds", "homeOdds", "startsAt"];
    if (local.draft) {
      for (const k of DRAFT_KEYS) if (local.draft[k] !== undefined) fields[k].value = local.draft[k];
      const fightNow = isFightSport(fields.sport.value);
      fields.away.placeholder = fightNow ? "Ryan Garcia" : "Cincinnati Reds";
      fields.home.placeholder = fightNow ? "Conor Benn" : "Los Angeles Dodgers";
    }
    const saveDraft = () => { local.draft = Object.fromEntries(DRAFT_KEYS.map((k) => [k, fields[k].value])); };
    for (const k of DRAFT_KEYS) {
      fields[k].addEventListener("input", saveDraft);
      fields[k].addEventListener("change", saveDraft);
    }

    card.append(grid);

    // Preview — the whole reason this form exists rather than a console.
    const preview = el("div", "adm-preview");
    function refresh() {
      const away = parseLine(fields.awayOdds.value);
      const home = parseLine(fields.homeOdds.value);
      preview.replaceChildren();

      if (!Number.isFinite(away) || !Number.isFinite(home) || !away || !home) {
        preview.append(el("span", "adm-note", "Enter both lines to preview payouts."));
        return;
      }
      const rows = [
        [fields.away.value || "Away", away],
        [fields.home.value || "Home", home]
      ];
      for (const [name, line] of rows) {
        const row = el("div", "adm-preview-row");
        row.append(el("strong", null, name));
        row.append(el("span", "adm-line", formatLine(line)));
        row.append(el("span", "adm-pays", `10 pays ${totalReturn(10, line)} · 100 pays ${totalReturn(100, line)}`));
        preview.append(row);
      }
      if ((away > 0 && home > 0) || (away < 0 && home < 0)) {
        preview.append(el("p", "adm-warn",
          "Both sides are priced the same way. Usually one favourite is negative and the underdog positive — worth a second look."));
      }
    }
    ["awayOdds", "homeOdds", "away", "home"].forEach((k) =>
      fields[k].addEventListener("input", refresh));
    refresh();
    card.append(preview);

    const actions = el("div", "adm-actions");
    const submit = el("button", "btn primary", "Open market");
    submit.type = "button";
    submit.style.cssText = "flex:0 0 auto;padding:0 20px;height:38px";
    submit.disabled = local.busy;

    submit.addEventListener("click", async () => {
      const startsAt = fields.startsAt.value
        ? new Date(fields.startsAt.value).toISOString()
        : "";
      const body = {
        sport: fields.sport.value,
        league: fields.league.value.trim(),
        away: fields.away.value.trim(),
        home: fields.home.value.trim(),
        awayOdds: parseLine(fields.awayOdds.value),
        homeOdds: parseLine(fields.homeOdds.value),
        startsAt
      };
      saveDraft();

      // Say what is wrong here, rather than sending it and losing the answer.
      const problems = [];
      if (!body.away || !body.home) problems.push("Enter both names.");
      if (!Number.isFinite(body.awayOdds) || !Number.isFinite(body.homeOdds)) {
        problems.push("Lines must be American odds, like +102 or -122.");
      }
      if (!startsAt) problems.push("Pick a start time.");
      else if (new Date(startsAt).getTime() <= Date.now()) problems.push("That start time has already passed.");
      if (problems.length) {
        local.formMsg = { tone: "bad", text: problems.join(" ") };
        paint();
        return;
      }

      const result = await post_("/api/picks/admin/open-market", body);
      const joiner = isFightSport(body.sport) ? "vs" : "at";
      if (result.ok) {
        local.formMsg = { tone: "good", text: `Market open: ${body.away} ${formatLine(body.awayOdds)} ${joiner} ${body.home} ${formatLine(body.homeOdds)}. Betting is live now.` };
        local.draft = null;
      } else {
        local.formMsg = { tone: "bad", text: result.message || "Couldn't open that market." };
      }
      await load();
      paint();
    });

    actions.append(submit);
    card.append(actions);
    // The answer to the last press, where the eye already is.
    if (local.formMsg) {
      const note = el("div", `adm-message ${local.formMsg.tone}`, local.formMsg.text);
      note.style.marginTop = "10px";
      card.append(note);
    }
    return card;
  }

  /* ---------------------------------------------------------- announce

     Posting to chat is the only thing here that reaches people who
     aren't looking at this page, so it shows the exact message first
     and never sends without a press. */

  function announceCard() {
    const card = el("div", "adm-card");
    card.append(el("h2", "adm-h", "Announce in chat"));

    const a = local.announce;
    if (!a) {
      card.append(el("p", "adm-note", "Couldn't work out what would be posted."));
      return card;
    }

    if (!a.canPost) {
      card.append(el("p", "adm-note",
        "Nothing is open, so there's nothing to announce. Open a market first."));
      return card;
    }

    card.append(el("p", "adm-note",
      "One message however many markets are open — named while that stays short, " +
      "counted once it doesn't. This posts to real chat."));

    const quote = el("pre", "adm-say");
    quote.textContent = a.message;
    card.append(quote);

    const foot = el("div", "adm-actions");
    foot.append(el("span", "adm-note", `${a.length} characters · ${a.open} market(s)`));

    const post = el("button", "btn primary", "Post to chat");
    post.type = "button";
    post.style.cssText = "flex:0 0 auto;padding:0 20px;height:38px";
    post.disabled = local.busy;
    post.addEventListener("click", async () => {
      const result = await post_("/api/picks/admin/announce");
      local.message = result.ok
        ? { tone: "good", text: `Posted to chat: ${result.posted}` }
        : { tone: "bad", text: result.message || "Couldn't post that." };
      await load();
      paint();
    });
    foot.append(post);
    card.append(foot);
    return card;
  }

  /* ---------------------------------------------------------- markets */

  function marketsCard() {
    const card = el("div", "adm-card");
    card.id = "admMarkets";

    const head = el("div", "adm-cardhead");
    head.append(el("h2", "adm-h", "Markets"));

    const settle = el("button", "btn", "Run settlement");
    settle.type = "button";
    settle.style.cssText = "flex:0 0 auto;padding:0 16px;height:34px";
    settle.disabled = local.busy;
    settle.addEventListener("click", async () => {
      const result = await post_("/api/picks/settle");
      if (!result.ok) {
        local.message = { tone: "bad", text: result.message || "Settlement failed." };
      } else {
        const acted = (result.results || []).filter((r) => r.action !== "skipped");
        local.message = acted.length
          ? {
              tone: "good",
              text: acted
                .map((r) => `${r.outcome === "VOID" ? "Voided" : `Won by ${r.outcome}`} — ${r.won || 0} won, ${r.lost || 0} lost, ${r.refunded || 0} refunded, ${r.paid || 0} ZCoins paid${r.failed ? `, ${r.failed} FAILED` : ""}`)
                .join(" · ")
            }
          : { tone: "note", text:
              `Examined ${result.examined} market(s); none had a clear final yet.` +
              (result.locked ? ` Closed betting on ${result.locked}.` : "") };
      }
      if (local.message) local.message.at = "markets";
      await load();
      paint();
    });
    head.append(settle);
    if (local.message?.at === "markets") {
      card.append(head);
      card.append(el("div", `adm-message ${local.message.tone}`, local.message.text));
      head.dataset.placed = "1";
    }
    if (!head.dataset.placed) card.append(head);

    if (!local.markets.length) {
      card.append(el("p", "adm-note", "No markets yet. Open one above."));
      return card;
    }

    // Ten a page, like every other list on the site.
    const PER = 10;
    const pages = Math.max(1, Math.ceil(local.markets.length / PER));
    local.marketPage = Math.min(pages, Math.max(1, local.marketPage || 1));
    const shown = local.markets.slice((local.marketPage - 1) * PER, local.marketPage * PER);

    for (const market of shown) {
      const row = el("div", `adm-market ${market.state.toLowerCase()}`);

      const top = el("div", "adm-market-top");
      top.append(el("strong", null, `${market.away} ${vsOf(market)} ${market.home}`));
      top.append(el("span", "adm-tag", market.state));
      if (market.needsAttention) {
        top.append(el("span", "adm-tag bad", `${market.needsAttention} stuck`));
      }

      // Closing refunds, so the confirm says what it will cost rather
      // than asking "are you sure" about an unnamed amount.
      if (market.state !== "SETTLED" && market.state !== "VOID") {
        const close = el("button", "iconbtn", "Close");
        close.type = "button";
        close.title = "Void this market and refund every pick";
        close.disabled = local.busy;
        close.addEventListener("click", async () => {
          const staked = market.totals.away.staked + market.totals.home.staked;
          const cost = market.totals.picks
            ? `${market.totals.picks} pick(s) will be refunded ${staked} ZCoins.`
            : "It has no picks on it.";
          if (!window.confirm(`Close ${market.away} at ${market.home}?

${cost}`)) return;

          const result = await post_("/api/picks/admin/void-market", { marketId: market.id });
          local.message = result.ok
            ? { tone: "good", text: `Closed ${market.away} at ${market.home}` +
                (result.refunded ? ` — ${result.refunded} pick(s) refunded.` : ".") }
            : { tone: "bad", text: result.message || "Couldn't close that market." };
          local.message.id = market.id;
          await load();
          paint();
        });
        top.append(close);
      }

      // Announce one market in chat and on Discord: for the one-off
      // events (CFB, fights) the site opens by hand and never announces.
      if (market.state === "OPEN" && new Date(market.startsAt).getTime() > Date.now()) {
        const say = el("button", "iconbtn", "Announce");
        say.type = "button";
        say.title = "Post this market in Twitch chat and on Discord";
        say.disabled = local.busy;
        say.addEventListener("click", async () => {
          let preview = null;
          try {
            preview = await fetch(`/api/picks/admin/announce?marketId=${encodeURIComponent(market.id)}`, { credentials: "include" })
              .then((r) => r.json());
          } catch { preview = null; }
          if (!preview?.ok) {
            local.message = { tone: "bad", text: preview?.message || "Couldn't prepare the announcement.", id: market.id };
            paint();
            return;
          }
          const where = preview.discord ? "Twitch chat and on Discord" : "Twitch chat";
          const again = market.lastAnnounced ? `\n\nThis market was already announced ${ago(market.lastAnnounced)}.` : "";
          if (!window.confirm(`Post this in ${where}?\n\n${preview.message}${again}`)) return;
          const result = await post_("/api/picks/admin/announce", { marketId: market.id });
          local.message = result.ok
            ? { tone: result.partial ? "note" : "good", text: result.summary || "Announced." }
            : { tone: "bad", text: result.message || "Couldn't announce that market." };
          local.message.id = market.id;
          await load();
          paint();
        });
        const firstButton = top.querySelector("button");
        if (firstButton) top.insertBefore(say, firstButton);
        else top.append(say);
      }

      row.append(top);
      if (local.message?.id === market.id) {
        row.append(el("div", `adm-message ${local.message.tone}`, local.message.text));
      }

      // Fights: once the first bell has gone, the result is entered
      // here. Payouts use the same code as automatic settlement.
      const started = new Date(market.startsAt).getTime() <= Date.now();
      if (isFightSport(market.sport) && started && market.state !== "SETTLED" && market.state !== "VOID") {
        const bar = el("div", "adm-settle");
        bar.append(el("span", "adm-note", "Result:"));
        const choice = (label, winner, primary) => {
          const b = el("button", `btn${primary ? " primary" : ""}`, label);
          b.type = "button";
          b.disabled = local.busy;
          b.addEventListener("click", async () => {
            const staked = market.totals.away.staked + market.totals.home.staked;
            const side = winner === "draw" ? null : market.totals[winner];
            const name = winner === "away" ? market.away : market.home;
            const cost = winner === "draw"
              ? `Every pick is refunded: ${staked} ZCoins back across ${market.totals.picks} pick(s).`
              : `${side.picks} pick(s) on ${name} are paid ${side.exposure} ZCoins. ${market.totals.picks - side.picks} pick(s) lose.`;
            const note = window.prompt(
              `Settle ${market.away} vs ${market.home}: ${label}?\n\n${cost}\n\n` +
              `Optional note for the result, e.g. "KO, round 6". Cancel to go back.`, "");
            if (note === null) return;
            const result = await post_("/api/picks/admin/settle-market", { marketId: market.id, winner, note });
            local.message = result.ok
              ? { tone: "good", text: `Settled ${market.away} vs ${market.home}: ${label}` +
                  (result.won ? `. ${result.won} winner(s), ${result.paid} ZC paid.` : result.refunded ? `. ${result.refunded} pick(s) refunded.` : ".") }
              : { tone: "bad", text: result.message || "Couldn't settle that fight." };
            local.message.id = market.id;
            await load();
            paint();
          });
          return b;
        };
        bar.append(
          choice(`${market.away} won`, "away", true),
          choice(`${market.home} won`, "home", true),
          choice("Draw, refund all", "draw", false)
        );
        row.append(bar);
      }

      const meta = el("p", "adm-note");
      const when = new Date(market.startsAt);
      meta.textContent =
        `${formatLine(market.awayOdds)} / ${formatLine(market.homeOdds)} · ` +
        `${Number.isNaN(when.getTime()) ? market.startsAt : when.toLocaleString()} · ` +
        `${market.totals.picks} pick${market.totals.picks === 1 ? "" : "s"}` +
        (market.finalScore ? ` · final ${market.finalScore}` : "") +
        (market.winner ? ` · ${market.winner} won` : "") +
        (market.lastAnnounced ? ` · announced ${ago(market.lastAnnounced)}` : "");
      row.append(meta);

      if (market.totals.picks) {
        const exposure = el("p", "adm-note");
        exposure.textContent =
          `Away: ${market.totals.away.picks} picks, ${market.totals.away.staked} staked, ` +
          `${market.totals.away.exposure} owed if they win · ` +
          `Home: ${market.totals.home.picks} picks, ${market.totals.home.staked} staked, ` +
          `${market.totals.home.exposure} owed if they win`;
        row.append(exposure);

        const list = el("div", "adm-bettors");
        for (const b of market.bettors) {
          const chip = el("span", `adm-bettor ${b.status.toLowerCase()}`);
          chip.textContent =
            `${b.login} ${b.wager} on ${b.selection === "away" ? market.away : market.home} ` +
            `${formatLine(b.odds)} → ${b.returnsIfWon}`;
          list.append(chip);
        }
        row.append(list);
      }

      card.append(row);
    }

    if (pages > 1) {
      const pager = el("div", "mpager pf-pager");
      pager.style.marginTop = "12px";
      const prev = el("button", "mpager-btn", "‹");
      const next = el("button", "mpager-btn", "›");
      prev.type = next.type = "button";
      prev.disabled = local.marketPage <= 1;
      next.disabled = local.marketPage >= pages;
      const go = (n) => {
        local.marketPage = n;
        paint();
        document.getElementById("admMarkets")?.scrollIntoView({ block: "start" });
      };
      prev.addEventListener("click", () => go(local.marketPage - 1));
      next.addEventListener("click", () => go(local.marketPage + 1));
      pager.append(prev, el("span", "mpager-at", `Page ${local.marketPage} of ${pages} · ${local.markets.length} markets`), next);
      card.append(pager);
    }
    return card;
  }

  /* ---------------------------------------------------------- view */

  function paint() {
    root.replaceChildren();

    const head = el("div", "viewhead");
    const wrap = el("div");
    wrap.append(el("h1", null, "Picks admin"));
    head.append(wrap);
    root.append(head);

    if (local.forbidden) {
      const empty = el("div", "empty");
      empty.append(
        el("strong", null, "Admins only"),
        el("p", null, "This page is limited to the Picks admin accounts.")
      );
      root.append(empty);
      return;
    }

    if (local.message && !local.message.id && !local.message.at) {
      const strip = el("div", `adm-message ${local.message.tone}`);
      strip.textContent = local.message.text;
      root.append(strip);
    }

    root.append(healthCard(), openForm(), announceCard(), marketsCard());
  }

  const view = {
    async mount(container, api) {
      root = container;
      shell = api;
      local.message = null;
      local.formMsg = null;
      paint();
      await load();
      if (container.isConnected) paint();
    }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("admin", view);
  }
  boot();
})();
