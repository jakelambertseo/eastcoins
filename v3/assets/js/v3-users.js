/* ============================================================
   EastCoin V3 — All Users

   One table: everyone who has logged in, sorted by what they have
   made on Picks. Their titles are the same badges every name wears
   around the site, the club is the one they picked on their own
   profile, and Music ELO comes straight from the Green Room worker.
   Every name is a link to the profile.
   ============================================================ */
(() => {
  "use strict";

  let root = null;
  let shell = null;
  let token = 0;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function sk(w, h, cls) {
    const b = el("span", `sk${cls ? " " + cls : ""}`);
    b.style.width = typeof w === "number" ? `${w}px` : w;
    b.style.height = `${h}px`;
    return b;
  }

  function zc(amount, { sign = false } = {}) {
    const n = Number(amount) || 0;
    const wrap = el("span", `zc-amount nums${n > 0 ? " up" : n < 0 ? " down" : ""}`);
    const img = document.createElement("img");
    img.className = "zcoin-mark";
    img.src = "/v3/assets/img/zcoin.webp";
    img.alt = "";
    img.width = 16;
    img.height = 16;
    const text = `${sign && n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toLocaleString()}`;
    wrap.append(img, document.createTextNode(text));
    return wrap;
  }

  function avatar(u, className) {
    const box = el("span", className, String(u.displayName || u.login || "?").slice(0, 1).toUpperCase());
    if (u.avatar) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("load", () => box.classList.add("has-logo"));
      img.addEventListener("error", () => img.remove());
      img.src = u.avatar;
      box.append(img);
    }
    return box;
  }

  function teamCrest(team) {
    const box = el("span", "pf-team-crest us-crest", team.name.split(" ").pop().slice(0, 3).toUpperCase());
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.addEventListener("load", () => box.classList.add("has-logo"));
    img.addEventListener("error", () => img.remove());
    img.src = team.logo;
    box.append(img);
    return box;
  }

  /* ---------------------------------------------------------- music ELO
     Same tiers as the Music ELO tab and the profile: Rank 1 for the top
     rated, last place always Bronze, Gold from 1015, Silver from 1000. */

  async function musicByLogin() {
    const config = window.EASTCOIN_MUSIC_CONFIG || {};
    const base = String(config.websocketUrl || "").trim();
    if (!base) return new Map();
    try {
      const r = await fetch(`${base}/history/${encodeURIComponent(config.room || "main")}`);
      if (!r.ok) return new Map();
      const payload = await r.json();
      const stats = (payload.userStats || []).map((s) => ({ ...s, login: String(s.login || "").toLowerCase() }));
      const rated = stats.filter((s) => Number(s.rated) > 0).sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0));
      const out = new Map();
      for (const s of stats) {
        const r = Number(s.rating) || 1000;
        const isRated = Number(s.rated) > 0;
        const isTop = isRated && rated[0]?.login === s.login;
        const isLast = isRated && rated.length > 1 && rated[rated.length - 1]?.login === s.login;
        const tier = !isRated ? null
          : isTop ? { key: "rank1", label: "Rank 1" }
            : isLast ? { key: "bronze", label: "Bronze" }
              : r >= 1015 ? { key: "gold", label: "Gold" } : r >= 1000 ? { key: "silver", label: "Silver" } : { key: "bronze", label: "Bronze" };
        out.set(s.login, { rating: Math.round(r), rated: Number(s.rated || 0), requests: Number(s.count || 0), tier });
      }
      return out;
    } catch {
      return new Map();
    }
  }

  /* ---------------------------------------------------------- page */

  function head(count) {
    const wrap = el("div", "viewhead");
    const copy = el("div");
    copy.append(el("h1", null, "All Users"));
    copy.append(el("p", null, count == null ? "Everyone on EastCoin, by Picks profit." : `${count} ${count === 1 ? "person" : "people"} · by Picks profit.`));
    wrap.append(copy);
    const back = el("a", "btn us-back", "← Back to Picks");
    back.href = "/?view=picks";
    wrap.append(back);
    return wrap;
  }

  function headerRow() {
    const h = el("div", "urow thead");
    for (const [label, cls] of [["#", ""], ["User", ""], ["Points", "right"], ["NFL", "right"], ["MLB", "right"], ["Titles", ""], ["Favourite team", ""], ["Music ELO", ""]]) {
      h.append(el("span", cls, label));
    }
    return h;
  }

  function skeleton(count) {
    const card = el("div", "tablecard users");
    card.setAttribute("aria-busy", "true");
    card.append(headerRow());
    for (let i = 0; i < count; i += 1) {
      const row = el("div", "urow is-sk");
      const user = el("div", "tuser");
      const lines = el("span", "sk-lines");
      lines.append(sk(120 + (i % 3) * 30, 11), sk(70, 8));
      user.append(sk(36, 36, "tile"), lines);
      const a = sk(60, 12); a.style.justifySelf = "end";
      const b = sk(44, 12); b.style.justifySelf = "end";
      const c = sk(44, 12); c.style.justifySelf = "end";
      row.append(sk(22, 12), user, a, b, c, sk(90, 18, "tile"), sk(140, 12), sk(70, 18, "tile"));
      card.append(row);
    }
    return card;
  }

  function row(u, rank, music, me) {
    const line = el("div", `urow${me ? " me" : ""}${rank === 1 && u.picks.profit > 0 ? " first" : ""}`);
    line.append(el("span", "trank", `#${rank}`));

    const user = el("a", "tuser ulink");
    user.href = `/u/${encodeURIComponent(u.login)}`;
    user.append(avatar(u, "tavatar"));
    const copy = el("span");
    copy.append(el("strong", null, u.displayName), el("small", null, `@${u.login}`));
    user.append(copy);
    line.append(user);

    const points = el("span", "right");
    points.append(zc(u.picks.profit, { sign: true }));
    line.append(points);

    // One record per league; a dash where nothing has settled there.
    for (const league of ["NFL", "MLB"]) {
      const r = u.picks.records?.[league];
      const cell = el("span", `right nums us-record${r ? "" : " us-none"}`, r ? `${r.wins}–${r.losses}` : "—");
      if (r) cell.title = `${league}: ${r.profit > 0 ? "+" : ""}${r.profit} ZC`;
      line.append(cell);
    }

    const titles = el("span", "us-titles");
    if (u.badges.length) {
      for (const b of u.badges) {
        const pill = el("span", `pf-badge ${b.key}`, `${b.emoji} ${b.label.split(" — ")[0]}`);
        pill.title = b.label;
        titles.append(pill);
      }
    } else {
      titles.append(el("span", "us-none", "—"));
    }
    line.append(titles);

    const team = el("span", "us-team");
    if (u.favourite) {
      team.append(teamCrest(u.favourite));
      const t = el("span");
      t.append(el("b", null, u.favourite.name), el("small", null, u.favourite.leagueLabel));
      team.append(t);
    } else {
      team.append(el("span", "us-none", "—"));
    }
    line.append(team);

    const elo = el("span", "us-elo");
    const m = music.get(u.login);
    if (m?.tier) {
      elo.append(el("span", `elo-tier ${m.tier.key}`, m.tier.label), el("b", "nums", String(m.rating)));
    } else if (m?.requests) {
      elo.append(el("span", "us-none", "Unrated"));
    } else {
      elo.append(el("span", "us-none", "—"));
    }
    line.append(elo);
    return line;
  }

  function table(users, music) {
    const card = el("div", "tablecard users");
    card.append(headerRow());
    const me = String(shell?.state?.session?.user?.login || "").toLowerCase();
    users.forEach((u, i) => card.append(row(u, i + 1, music, me && me === u.login)));
    if (!users.length) {
      const empty = el("div", "empty");
      empty.append(el("strong", null, "Nobody yet"), el("p", null, "The first Twitch login lands here."));
      card.append(empty);
    }
    return card;
  }

  async function load() {
    const mine = ++token;
    root.replaceChildren(head(null), skeleton(8));

    const [payload, music] = await Promise.all([
      fetch("/api/picks/users", { credentials: "include" }).then((r) => r.json()).catch(() => null),
      musicByLogin(),
      Promise.resolve(window.ECV3?.sessionReady).catch(() => null)
    ]);
    if (mine !== token || !root.isConnected) return;

    if (!payload?.ok) {
      const note = el("div", "empty");
      note.append(el("strong", null, "Couldn't load the list"), el("p", null, "Try again in a moment."));
      root.replaceChildren(head(null), note);
      return;
    }
    root.replaceChildren(head(payload.users.length), table(payload.users, music));
    // Badges next to names are the same ones the table shows, so no
    // second decoration pass is needed here.
  }

  function onClick(event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const a = event.target.closest("a");
    if (!a || !root.contains(a)) return;
    const href = a.getAttribute("href") || "";
    if (href.startsWith("/?view=picks")) {
      event.preventDefault();
      history.pushState({ view: "picks" }, "", href);
      shell.go("picks", { push: false });
    }
  }

  let previousTitle = "";
  const view = {
    mount(container, api) {
      root = container;
      shell = api;
      previousTitle = document.title;
      document.title = "All Users — EastCoin";
      root.addEventListener("click", onClick);
      window.ECPresence?.beat("users");
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
    window.ECV3.register("users", view);
  }
  boot();
})();
