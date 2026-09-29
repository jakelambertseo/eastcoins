/* EASTSCAPE: MARKED CARDS (2026-09-29), the server's half. The rules (CARDS, handTotal, handResult, handPay, handView, TIP_TEXT) are in
   eastscape-shared.js; the window is v3/assets/js/eastscape-cards.js.

   A HAND lives on the character as C.hand = { tier, deck, at, cards, state, tip, tips, won, used, peek, last }:
     deck    nine cards dealt face down when the card was flipped. Never sent to the page (handView leaves it out), so what comes next
             cannot be read ahead, and a relog cannot redraw it.
     at      the next card in the deck (a burn moves it on without dealing)
     state   "tip"     working a tip; the card comes when it's done
             "decide"  two cards or more: hit or stand
             "bust"    over 21 with the Ace Up the Sleeve in the bag and unused: play it or take the bust
   TIPS are drawn from the world as it is: a monster that lives on an open map, a person standing on one, a named thing you can walk up
   to, a node you can gather from. Filtered by the tier's band and by the player's own levels, so a tip is always something they can do,
   and never somewhere far past them (the Wilderness only on a Black card). Worked out once per map and kept (tipPool), then filtered
   per tip, so a tip costs a few array filters and no scene is built live for it. */
export function installCards(World, { G }) {
  const P = World.prototype, CD = G.CARDS;
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const between = ([lo, hi]) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const SPOT_TYPES = new Set(["jukebox", "fire", "anvil", "furnace", "fletcher", "cauldron", "range", "towerdoor", "cryptdoor", "fountain", "waterfall", "projboard", "booth", "stall", "cart", "gargoyle", "shrine", "statue", "rope", "cagesign", "yew", "roomdoor", "blast", "wildbench", "hatchery", "pen"]);
  const NO_TIPS = new Set(["guild"]);   /* the Thieves' Guild gates on Thieving, not a band: a tip there could be a door you cannot open */
  const the = (n) => { n = String(n).split(":")[0].trim(); return /^the /i.test(n) ? `the ${n.slice(4)}` : `the ${n[0].toLowerCase()}${n.slice(1)}`; };

  /* ---- what each open map offers a tip, worked out once */
  let POOL = null;
  function tipPool() {
    if (POOL) return POOL;
    POOL = [];
    for (const key of G.OPEN) {
      if (NO_TIPS.has(key)) continue;
      const def = G.sceneDef?.(key) || G.SCENES[key]; if (!def || def.interior && !(def.npcs || []).length) continue;
      let b = null; try { b = G.buildScene(key); } catch { continue; }
      const where = def.name || key, lv = (def.mobs || []).map(([t]) => G.MOBS[t]?.lvl || 0).filter((x) => x > 0);
      const band = lv.length ? [Math.min(...lv), Math.max(...lv)] : [0, 0];
      const mobs = [...new Set((def.mobs || []).map(([t]) => t))].filter((t) => G.MOBS[t] && !G.MOBS[t].boss && !G.MOBS[t].held && !G.MOBS[t].event);
      const npcs = (def.npcs || []).filter((n) => !n.event && n.name).map((n) => n.name);
      const spots = b.objs.filter((o) => (SPOT_TYPES.has(o.t) || String(o.t).startsWith("altar_")) && o.name && !o.edge && !o.proj && !o.event).map((o) => ({ x: o.x, y: o.y, w: o.w || 1, h: o.h || 1, name: the(o.name) }));
      const nodes = b.objs.filter((o) => (o.ore || o.log || o.fish) && o.req?.skill && !o.proj).map((o) => ({ k: o.ore || o.log || o.fish, skill: o.req.skill, lvl: o.req.lvl | 0 }));
      POOL.push({ key, where, band, pvp: !!def.pvp, mobs, npcs, spots: [...new Map(spots.map((s) => [s.name, s])).values()], nodes: [...new Map(nodes.map((n) => [n.k, n])).values()] });
    }
    return POOL;
  }
  /** a tip this player can do, for this tier, not the same as the last one */
  function tipFor(C, tier, last) {
    const T = CD.tiers[tier], cb = G.combatOf(C), out = [];
    for (const M of tipPool()) {
      if (M.pvp && tier !== "black") continue;
      const overlaps = M.band[1] === 0 ? tier === "red" : M.band[0] <= T.hi && M.band[1] >= T.lo;
      if (!overlaps && !M.pvp) continue;
      const safe = M.band[1] === 0 || M.band[0] <= cb + 10 || M.pvp;
      for (const t of M.mobs) { const L = G.MOBS[t].lvl; if (L >= T.lo && L <= T.hi && L <= cb + 5) out.push({ kind: "kill", t, x: G.MOBS[t].name, w: M.where, key: `k:${t}` }); }
      if (!safe) continue;
      for (const n of M.npcs) out.push({ kind: "npc", x: n, scene: M.key, w: M.where, key: `n:${n}` });
      for (const s of M.spots) out.push({ kind: "spot", x: s.name, scene: M.key, at: [s.x, s.y, s.w, s.h], w: M.where, key: `s:${M.key}:${s.name}` });
      for (const n of M.nodes) if (G.lvlOf(C, n.skill) >= n.lvl && (n.lvl >= T.lo - 20 || tier === "red") && n.lvl <= T.hi) out.push({ kind: "gather", k: n.k, x: G.ITEMS[n.k]?.name.toLowerCase() || n.k, w: M.where, key: `g:${n.k}` });
    }
    /* weighted by kind (so a map with forty nodes does not make every tip a gather), and never the tip just done */
    const W = { kill: 0.35, npc: 0.2, spot: 0.2, gather: 0.25 }, byKind = {};
    for (const c of out) if (c.key !== last) (byKind[c.kind] ||= []).push(c);
    const kinds = Object.keys(byKind); if (!kinds.length) return null;
    let r = Math.random() * kinds.reduce((a, k) => a + W[k], 0), kind = kinds[0];
    for (const k of kinds) { r -= W[k]; if (r <= 0) { kind = k; break; } }
    const c = rnd(byKind[kind]);
    c.text = rnd(G.TIP_TEXT[kind]).replace("{x}", c.x).replace("{w}", c.w);
    c.hint = kind === "kill" ? `Kill a ${c.x} (${c.w}).` : kind === "gather" ? `Get a ${c.x} yourself (${c.w}).` : `Flip the card beside ${c.x} (${c.w}).`;
    c.where = c.w;
    return c;
  }
  const newDeck = () => Array.from({ length: CD.deck }, () => ({ r: 1 + Math.floor(Math.random() * 13), s: Math.floor(Math.random() * 4) }));
  const owns = (C, k) => G.countItems(C, [k]) > 0;

  P.cardPush = function (pl, extra = {}) { pl.out.push({ type: "cards", hand: G.handView(pl.C), tools: { peek: owns(pl.C, "peekglass"), burn: owns(pl.C, "dealershoe"), ace: owns(pl.C, "acesleeve") }, ...extra }); };

  /* ---- a card drops */
  P.cardFind = function (pl, tier, how) {
    if (G.HOLD.cards) return;
    const k = `card_${tier}`, where = this.keepRare(pl, k, 1);
    if (where) this.say(pl, `\u{1F0CF} ${how} a ${G.ITEMS[k].name}. ${where === "bank" ? "No room in your bag: it went to your bank." : "Flip it when you're ready to play the hand."}`, "loot");
  };
  P.cardOnKill = function (pl, m) {
    if (G.HOLD.cards) return; const d = G.MOBS[m.t]; if (!d) return;
    const tier = G.cardTierAt(d.lvl || 1), boss = d.boss;
    if (Math.random() < (boss ? CD.bossDrop : CD.tiers[tier].drop)) this.cardFind(pl, tier, `The ${d.name.toLowerCase()} was carrying`);
    const h = pl.C.hand; if (h?.state === "tip" && h.tip?.kind === "kill" && h.tip.t === m.t) this.cardDeal(pl);
  };
  P.cardOnGain = function (pl, S, k, skill) {
    if (G.HOLD.cards) return;
    if (skill && Math.random() < CD.gatherDrop) { const lv = (S?.def?.mobs || []).map(([t]) => G.MOBS[t]?.lvl || 0); this.cardFind(pl, G.cardTierAt(lv.length ? Math.max(...lv) : 1), "Tucked in with it,"); }
    const h = pl.C.hand; if (h?.state === "tip" && h.tip?.kind === "gather" && h.tip.k === k) this.cardDeal(pl);
  };

  /* ---- flipping a Marked Card: a new hand, or the one you're playing */
  P.cardUse = function (pl, st, it, take) {
    const C = pl.C; if (G.HOLD.cards && !pl.admin) return;
    if (C.hand) {
      /* using a card while a hand is in play is the flip, when the tip wants one: you are standing there with the card in your hand */
      if (C.hand.state === "tip" && (C.hand.tip?.kind === "npc" || C.hand.tip?.kind === "spot")) return this.cardOp(this.scenes.get(C.scene), pl, { op: "flip" });
      this.cardPush(pl, { open: true }); return this.say(pl, "You're already playing a hand. Finish it, or fold it, before you flip another.", "bad");
    }
    const tier = it.cardTier, tip = tipFor(C, tier, null);
    if (!tip) return this.say(pl, "The card is blank. (No tip fits you yet: try again after a level or two.)", "bad");
    take();
    const deck = newDeck();
    C.hand = { tier, deck, at: 1, cards: [deck[0]], state: "tip", tip, tips: 0, won: 0, used: {}, peek: null, last: tip.key };
    this.touch(pl);
    this.say(pl, `\u{1F0CF} You flip the ${it.name.toLowerCase()}: ${G.cardName(deck[0])}. ${tip.text}`, "good");
    this.cardPush(pl, { open: true });
  };
  /* the next card: tip money, then hit or stand (or the hand settles itself) */
  P.cardDeal = function (pl) {
    const C = pl.C, h = C.hand; if (!h) return; const T = CD.tiers[h.tier];
    const card = h.deck[h.at++] || { r: 1 + Math.floor(Math.random() * 13), s: Math.floor(Math.random() * 4) };
    h.cards.push(card); h.tips++; h.tip = null; h.peek = null;
    this.give(pl, "tickets", T.leg); h.won += T.leg;
    const { t } = G.handTotal(h.cards), res = G.handResult(h.cards);
    this.say(pl, `\u{1F0CF} Tip paid: ${G.fmtTix(T.leg)}. Your card: ${G.cardName(card)}. That's ${t}.`, "good");
    this.touch(pl);
    if (res === "bust") {
      if (owns(C, "acesleeve") && !h.used.ace) { h.state = "bust"; this.cardPush(pl, { open: true }); return this.say(pl, "Bust... unless that was an ace all along. Your sleeve's waiting.", "bad"); }
      return this.cardCash(pl);
    }
    if (h.cards.length >= CD.charlie || t === 21) return this.cardCash(pl);
    h.state = "decide"; this.cardPush(pl, { open: true });
  };
  /* the hand settles: the prize by what it stood on, a supply bundle, and a chance at the tier's unique */
  P.cardCash = function (pl) {
    const C = pl.C, h = C.hand; if (!h) return; const T = CD.tiers[h.tier], res = G.handResult(h.cards), pay = G.handPay(h.tier, res), got = [];
    if (pay > 0) { this.give(pl, "tickets", pay); h.won += pay; }
    if (res !== "bust") { const [k, n] = rnd(T.supplies), q = between(n); if (G.ITEMS[k] && this.giveUpTo(pl, k, q)) got.push([k, q]); }
    let unique = null;
    if (Math.random() < T.uniq * (CD.uniqMul[res] ?? 0)) { unique = rnd(T.uniques); if (this.keepRare(pl, unique, 1)) { got.push([unique, 1]); this.houseSay(`\u{1F0CF} ${pl.name} stood on ${G.RESULT_NAME[res].replace(/!$/, "")} and the house paid out ${G.ITEMS[unique].name}.`); } }
    C.cardsDone ||= {}; C.cardsDone[h.tier] = (C.cardsDone[h.tier] | 0) + 1;
    const summary = { tier: h.tier, cards: h.cards, total: G.handTotal(h.cards).t, result: res, pay, won: h.won, got };
    C.hand = null; this.touch(pl);
    if (res === "bust") this.say(pl, `\u{1F0CF} Bust on ${summary.total}. The tips you ran paid ${G.fmtTix(summary.won)}; the hand pays nothing.`, "bad");
    else this.say(pl, `\u{1F0CF} ${G.RESULT_NAME[res]} You stood on ${summary.total}: ${G.fmtTix(pay)}${got.length ? `, and ${got.map(([k, n]) => `${n > 1 ? `${n} × ` : ""}${G.ITEMS[k].name.toLowerCase()}`).join(", ")}` : ""}. The hand paid ${G.fmtTix(summary.won)} in all.`, "loot");
    if (res === "natural" || res.startsWith("charlie")) this.houseSay(`\u{1F0CF} ${pl.name} played a ${T.name} Marked Card to a ${G.RESULT_NAME[res].replace(/!$/, "")}.`);
    this.cardPush(pl, { open: true, done: summary });
  };

  /* ---- the window's buttons */
  P.cardOp = function (S, pl, m) {
    const C = pl.C, h = C.hand, op = String(m.op || "view"), bad = (t) => this.say(pl, t, "bad");
    if (G.HOLD.cards && !pl.admin) return;
    if (op === "view" || !h) return this.cardPush(pl);
    if (op === "fold") { const won = h.won; C.hand = null; this.touch(pl); this.say(pl, `You fold. The tips you ran paid ${G.fmtTix(won)}; the rest of the hand goes back in the deck.`); return this.cardPush(pl, { open: true, done: { tier: h.tier, cards: h.cards, total: G.handTotal(h.cards).t, result: "fold", pay: 0, won, got: [] } }); }
    if (op === "flip") {
      if (h.state !== "tip" || !h.tip) return;
      const tp = h.tip;
      if (tp.kind === "kill" || tp.kind === "gather") return bad(`Nothing to flip for: ${tp.hint}`);
      let near = false;
      const here = String(C.scene).split(":")[0];   /* an island or a cellar is a private copy ("bw_skull:<owner>"): the map is the part before the colon */
      if (here === tp.scene) {
        if (tp.kind === "npc") { const n = S.npcs?.find((x) => x.name === tp.x); near = !!n && G.cheb(pl, n) <= CD.reach; }
        else { const [x, y, w, hh] = tp.at; near = G.cheb(pl, G.nearestCell({ x, y, w, h: hh }, pl)) <= CD.reach; }
      }
      if (!near) return bad(here === tp.scene ? `Not here. ${tp.hint}` : `Wrong place. ${tp.hint}`);
      this.say(pl, tp.kind === "npc" ? `${tp.x} watches you turn it over, and nods.` : `You turn the card over by ${tp.x}.`);
      return this.cardDeal(pl);
    }
    if (op === "hit") {
      if (h.state !== "decide") return;
      const tip = tipFor(C, h.tier, h.last); if (!tip) return bad("No tip fits you right now. Stand, or fold.");
      h.tip = tip; h.last = tip.key; h.state = "tip"; h.peek = null; this.touch(pl);
      this.say(pl, `\u{1F0CF} Hit. ${tip.text}`, "good"); return this.cardPush(pl, { open: true });
    }
    if (op === "stand") { if (h.state !== "decide") return; return this.cardCash(pl); }
    if (op === "peek") {
      if (h.state !== "decide" || h.used.peek) return; if (!owns(C, "peekglass")) return bad("You need the Peeking Glass in your bag.");
      h.used.peek = true; h.peek = h.deck[h.at]; this.touch(pl);
      this.say(pl, `Through the glass, the next card is the ${G.cardName(h.peek)}.`, "good"); return this.cardPush(pl, { open: true });
    }
    if (op === "burn") {
      if (h.state !== "decide" || h.used.burn) return; if (!owns(C, "dealershoe")) return bad("You need the Shoe in your bag.");
      const gone = h.deck[h.at++]; h.used.burn = true; h.peek = null; this.touch(pl);
      this.say(pl, `The Shoe drops the ${G.cardName(gone)} into the bin. The next card's a new one.`, "good"); return this.cardPush(pl, { open: true, burned: gone });
    }
    if (op === "ace") {
      if (h.state !== "bust" || h.used.ace || !owns(C, "acesleeve")) return;
      h.used.ace = true; const i = h.cards.length - 1; h.cards[i] = { r: 1, s: h.cards[i].s }; this.touch(pl);
      const { t } = G.handTotal(h.cards);
      this.say(pl, `Up the sleeve and back on the table: it was an ace. That's ${t}.`, "good");
      if (h.cards.length >= CD.charlie || t === 21) return this.cardCash(pl);
      h.state = "decide"; return this.cardPush(pl, { open: true });
    }
    if (op === "takebust") { if (h.state !== "bust") return; return this.cardCash(pl); }
  };

  /* a name look out of a hand: owned for good, and worn at once */
  P.cardLook = function (pl, st, it, take) {
    const C = pl.C, row = G.STORE[it.unlock]; if (!row) return;
    C.store ||= { own: [], name: {} }; C.store.own ||= []; C.store.name ||= {};
    if (C.store.own.includes(row.id)) return this.say(pl, `You already have the ${row.name.toLowerCase()}. Keep this one, or sell it.`, "bad");
    take(); C.store.own.push(row.id); C.store.name[row.slot] = row.id; this.touch(pl);
    this.say(pl, `${row.name}: yours for good, and wearing it now. Change it any time in the Store's Name tab.`, "loot");
  };

  /* (dev server, admins) /cards red|blue|black: a card of that back, and the three tools */
  P.cardKit = function (pl, tier) {
    if (this.env?.DEV !== "1") return this.say(pl, "That's for the dev server only.", "bad");
    const t = CD.tiers[tier] ? tier : "red";
    this.give(pl, `card_${t}`, 3);
    for (const k of ["peekglass", "dealershoe", "acesleeve"]) if (!owns(pl.C, k)) this.give(pl, k, 1);
    this.say(pl, `Three ${CD.tiers[t].name} Marked Cards, and the Peeking Glass, the Shoe and the Ace Up the Sleeve.`, "good");
  };
}
