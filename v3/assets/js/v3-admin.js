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
        body: body ? JSON.stringify(body) : undefined
      });
      payload = await response.json();
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
        ["hockey", "Hockey (NHL)"]
      ]
    });
    field("league", "League label", { placeholder: "MLB", value: "MLB" });
    field("away", "Away team", { placeholder: "Cincinnati Reds" });
    field("home", "Home team", { placeholder: "Los Angeles Dodgers" });
    field("awayOdds", "Away line", { type: "number", placeholder: "150", step: "1" });
    field("homeOdds", "Home line", { type: "number", placeholder: "-175", step: "1" });
    field("startsAt", "Starts at (local)", { type: "datetime-local" });

    card.append(grid);

    // Preview — the whole reason this form exists rather than a console.
    const preview = el("div", "adm-preview");
    function refresh() {
      const away = Number(fields.awayOdds.value);
      const home = Number(fields.homeOdds.value);
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
        awayOdds: Number(fields.awayOdds.value),
        homeOdds: Number(fields.homeOdds.value),
        startsAt
      };

      const result = await post_("/api/picks/admin/open-market", body);
      local.message = result.ok
        ? { tone: "good", text: `Market open: ${body.away} ${formatLine(body.awayOdds)} at ${body.home} ${formatLine(body.homeOdds)}.` }
        : { tone: "bad", text: result.message || "Couldn't open that market." };
      await load();
      paint();
    });

    actions.append(submit);
    card.append(actions);
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
      await load();
      paint();
    });
    head.append(settle);
    card.append(head);

    if (!local.markets.length) {
      card.append(el("p", "adm-note", "No markets yet. Open one above."));
      return card;
    }

    for (const market of local.markets) {
      const row = el("div", `adm-market ${market.state.toLowerCase()}`);

      const top = el("div", "adm-market-top");
      top.append(el("strong", null, `${market.away} at ${market.home}`));
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
          await load();
          paint();
        });
        top.append(close);
      }

      row.append(top);

      const meta = el("p", "adm-note");
      const when = new Date(market.startsAt);
      meta.textContent =
        `${formatLine(market.awayOdds)} / ${formatLine(market.homeOdds)} · ` +
        `${Number.isNaN(when.getTime()) ? market.startsAt : when.toLocaleString()} · ` +
        `${market.totals.picks} pick${market.totals.picks === 1 ? "" : "s"}` +
        (market.finalScore ? ` · final ${market.finalScore}` : "") +
        (market.winner ? ` · ${market.winner} won` : "");
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

    if (local.message) {
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
