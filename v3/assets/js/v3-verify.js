/* ============================================================
   EastCoin — Check a seed  (/?view=verify)

   Every casino result comes from a seed whose sha256 is shown before
   play and whose seed is revealed after. This page takes that seed,
   hashes it in the browser (crypto.subtle — nothing to trust here),
   holds it against the hash you were shown, and asks
   /api/casino/verify to replay the result with the same functions the
   games run: the deck Higher or Lower dealt, where Mines put the bombs,
   Plinko's path, the Wheel's angle, the coin, a PvP table's rounds.

   Deep-linkable: ?view=verify&game=hilo&seed=…&hash=… fills the form
   and runs it, which is what "Check this seed" on a game page opens.
   ============================================================ */
(() => {
  "use strict";

  const GAMES = [
    ["hilo", "Higher or Lower"], ["mines", "Mines"], ["plinko", "Plinko"],
    ["wheel", "Wheel"], ["flip", "Coin Flip"], ["roulette", "Russian Roulette"], ["standing", "Last One Standing"], ["race", "Horse Race"]
  ];

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  let root = null;
  const refs = {};

  function build() {
    root.replaceChildren();
    const page = el("div", "vf-page");

    const head = el("div", "vf-head");
    head.append(el("h1", "vf-title", "Check a seed"));
    head.append(el("p", "vf-lede", "Every result comes from a seed. Its hash is shown before you play; the seed is revealed after. Paste the seed here and see exactly what it produced — the hash is worked out in your browser, and the result is replayed with the same code the games run."));
    const back = el("a", "watchbtn vf-back", "← Casino");
    back.href = "/?view=casino";
    head.append(back);
    page.append(head);

    const form = el("form", "cf-card vf-form");
    form.addEventListener("submit", (e) => { e.preventDefault(); run(); });

    const row1 = el("div", "vf-row");
    refs.game = el("select", "vf-select");
    for (const [key, name] of GAMES) { const o = el("option", null, name); o.value = key; refs.game.append(o); }
    refs.game.addEventListener("change", syncExtras);
    row1.append(labelled("Game", refs.game));

    refs.mines = el("input", "vf-input vf-short");
    refs.mines.type = "number"; refs.mines.min = "1"; refs.mines.max = "10"; refs.mines.value = "3";
    refs.minesWrap = labelled("Bombs", refs.mines);
    row1.append(refs.minesWrap);

    refs.players = el("input", "vf-input vf-short");
    refs.players.type = "number"; refs.players.min = "2"; refs.players.max = "12"; refs.players.value = "2";
    refs.playersWrap = labelled("Players", refs.players);
    row1.append(refs.playersWrap);
    form.append(row1);

    refs.seed = el("input", "vf-input");
    refs.seed.placeholder = "the seed revealed after the round";
    refs.seed.autocomplete = "off"; refs.seed.spellcheck = false;
    form.append(labelled("Seed", refs.seed));

    refs.hash = el("input", "vf-input");
    refs.hash.placeholder = "the hash shown before play (optional — leave blank to just replay)";
    refs.hash.autocomplete = "off"; refs.hash.spellcheck = false;
    form.append(labelled("Hash", refs.hash));

    const actions = el("div", "vf-actions");
    refs.go = el("button", "btn primary", "Check");
    refs.go.type = "submit";
    actions.append(refs.go);
    refs.note = el("span", "vf-note", "");
    actions.append(refs.note);
    form.append(actions);
    page.append(form);

    refs.out = el("section", "cf-card vf-out");
    refs.out.hidden = true;
    page.append(refs.out);

    const how = el("section", "cf-card vf-how");
    how.append(el("h2", "vf-h2", "Where to find them"));
    const ul = el("ul");
    for (const t of [
      "On any game page, open “Verify this …” under the result: it shows the hash and, once the round is over, the seed. “Check this seed” there brings you here with both filled in.",
      "The hash is sha256 of the seed, worked out here in your browser. If it matches what you were shown, the seed you were given is the one the result came from.",
      "The replay uses the games’ own functions, so what it shows is what you got. The rule for each game is printed with the result."
    ]) ul.append(el("li", null, t));
    how.append(ul);
    page.append(how);

    root.append(page);
    syncExtras();
  }

  function labelled(text, input) {
    const w = el("label", "vf-field");
    w.append(el("span", "vf-k", text), input);
    return w;
  }

  function syncExtras() {
    const g = refs.game.value;
    refs.minesWrap.hidden = g !== "mines";
    refs.playersWrap.hidden = !(g === "roulette" || g === "standing");
  }

  function fillFromUrl() {
    const q = new URL(location.href).searchParams;
    const game = String(q.get("game") || "").toLowerCase();
    if (GAMES.some(([k]) => k === game)) refs.game.value = game;
    if (q.get("seed")) refs.seed.value = q.get("seed");
    if (q.get("hash")) refs.hash.value = q.get("hash");
    const clamp = (v, lo, hi) => String(Math.min(hi, Math.max(lo, Number.parseInt(v, 10) || lo)));
    if (q.get("mines")) refs.mines.value = clamp(q.get("mines"), 1, 10);
    if (q.get("players")) refs.players.value = clamp(q.get("players"), 2, 12);
    syncExtras();
    return Boolean(q.get("seed"));
  }

  async function run() {
    const game = refs.game.value;
    const seed = refs.seed.value.trim();
    const claimed = refs.hash.value.trim().toLowerCase();
    if (!seed) { refs.note.textContent = "Paste the seed first."; refs.seed.focus(); return; }
    refs.go.disabled = true;
    refs.note.textContent = "Checking…";

    const params = new URLSearchParams({ game, seed });
    if (claimed) params.set("hash", claimed);
    if (game === "mines") params.set("mines", refs.mines.value);
    if (game === "roulette" || game === "standing") params.set("players", refs.players.value);

    const [local, data] = await Promise.all([
      sha256Hex(seed).catch(() => null),
      fetch(`/api/casino/verify?${params}`).then((r) => r.json()).catch(() => null)
    ]);
    refs.go.disabled = false;
    refs.note.textContent = "";
    if (!data?.ok) {
      refs.out.hidden = false;
      refs.out.replaceChildren(el("p", "cf-empty", data?.message || "Couldn't check that. Try again."));
      return;
    }
    render(data, local, claimed);
    // The link now says what was checked, so it can be passed on.
    const url = new URL(location.href);
    url.search = `?view=verify&${params}`;
    history.replaceState(history.state, "", url.pathname + url.search);
  }

  function render(d, local, claimed) {
    const out = refs.out;
    out.hidden = false;
    out.replaceChildren();

    // The hash line: computed here, compared to what they were shown.
    const check = el("div", "vf-check");
    const agree = local && local === d.hash;
    if (claimed) {
      const ok = local ? local === claimed : d.matches;
      check.classList.add(ok ? "good" : "bad");
      check.append(el("strong", null, ok ? "✓ The hash matches." : "✗ The hash does not match."));
      check.append(el("span", null, ok
        ? " sha256 of this seed is exactly the hash you were shown, so this seed is the one the result came from."
        : " sha256 of this seed is not the hash you were shown. Check both were copied whole — a seed and a hash are each 64 or 32 hex characters, nothing more."));
    } else {
      check.classList.add("plain");
      check.append(el("strong", null, "No hash given — replay only."));
      check.append(el("span", null, " Paste the hash shown before play to confirm this seed is the one."));
    }
    out.append(check);

    const pre = el("pre", "cf-verify-body");
    pre.textContent = `seed    ${d.seed}\nsha256  ${d.hash}${local && !agree ? "   (your browser got " + local + ")" : local ? "   (worked out in your browser)" : ""}\nrule    ${d.rule}`;
    out.append(pre);

    const title = el("h2", "vf-h2", d.name);
    out.append(title);

    if (d.game === "hilo") {
      out.append(el("p", "vf-note", "The deck in the order it was dealt: the first card, then one for each call. A run that ended early never turned the rest over — they are what would have come."));
      const deck = el("div", "vf-deck");
      for (const c of d.cards) {
        const slot = el("div", "vf-slot");
        const card = el("div", `hl-card small${c.suit === "♥" || c.suit === "♦" ? " red" : ""}`);
        card.append(el("span", null, `${c.label}${c.suit}`));
        slot.append(card, el("small", null, c.i === 0 ? "dealt" : `call ${c.i}`));
        deck.append(slot);
      }
      out.append(deck);
    } else if (d.game === "mines") {
      out.append(el("p", "vf-note", `${d.mines} bomb${d.mines === 1 ? "" : "s"} on the board: tiles ${d.bombs.join(", ")} (numbered 0–24, left to right, top to bottom).`));
      const grid = el("div", "vf-grid");
      const bombs = new Set(d.bombs);
      for (let i = 0; i < d.tiles; i += 1) {
        const t = el("div", `vf-tile${bombs.has(i) ? " bomb" : ""}`, bombs.has(i) ? "💣" : String(i));
        grid.append(t);
      }
      out.append(grid);
    } else if (d.game === "plinko") {
      out.append(el("p", "vf-note", `Path ${d.path} — ${d.bucket} right${d.bucket === 1 ? "" : "s"} out of ${d.rows} rows, so bucket ${d.bucket} at ×${d.multiplier}.`));
      const path = el("div", "vf-path");
      [...d.path].forEach((c, i) => path.append(el("span", `vf-step ${c === "R" ? "r" : "l"}`, `${i + 1} ${c === "R" ? "→" : "←"}`)));
      out.append(path);
    } else if (d.game === "wheel") {
      out.append(el("p", "vf-note", `The pointer lands at ${d.result.angle}° from the top: slice ${d.result.slice}, ${d.describe}.`));
      const chip = el("div", `vf-big ${d.result.color}`, d.describe.toUpperCase());
      out.append(chip);
    } else if (d.game === "race") {
      out.append(el("p", "vf-note", `Draw ${d.result.draw.toFixed(6)} against the runners' odds: ${d.describe} wins.`));
      out.append(el("div", "vf-big", d.describe));
    } else if (d.game === "flip") {
      out.append(el("div", "vf-big", d.result.toUpperCase()));
    } else if (d.game === "roulette") {
      out.append(el("p", "vf-note", `${d.players} players, ${d.chambers} chambers to start. Seats are numbered in the order people sat down, 0 first.`));
      const list = el("ol", "vf-rounds");
      for (const [k, s] of d.result.stages.entries()) {
        list.append(el("li", null, `Round ${k + 1}: ${s.players} in, ${s.chambers} chambers, live chamber ${s.live} — seat ${s.shot} shot`));
      }
      out.append(list);
      out.append(el("div", "vf-big", `Seat ${d.result.winner} survives`));
    } else if (d.game === "standing") {
      out.append(el("p", "vf-note", `${d.players} players. Seats are numbered in the order people sat down, 0 first. Knocked out in this order:`));
      out.append(el("p", "vf-order", d.result.order.slice(0, -1).map((s) => `seat ${s}`).join(" → ")));
      out.append(el("div", "vf-big", `Seat ${d.result.winner} is the last one standing`));
    }
  }

  const view = {
    async mount(container) {
      root = container;
      build();
      if (fillFromUrl()) run();
    },
    unmount() { root = null; }
  };

  function boot() {
    if (!window.ECV3) return window.setTimeout(boot, 30);
    window.ECV3.register("verify", view);
  }
  boot();
})();
