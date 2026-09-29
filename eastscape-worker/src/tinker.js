/* ============================================================ TINKERING (2026-09-28), the server's half. The rules are TINK, salvageOf,
   salvageLot and friends in the rules file; the design is EASTSCAPE-DRAFTS.md §11. STEP ONE: salvage at Sprocket Sal's Scrap Bench.

   op "view"     the pouch, your level (the window works out what your bag would salvage into with the same salvageOf)
   op "salvage"  { k, f } one stack (a reforged piece by its level), or { lot: true } for every plain drop in the bag at once
   Everything is taken from the BAG only, never the bank; a favourite is never taken; an equipped piece is not in the bag. The parts go
   into C.parts (not items: no bag space, and Bom cannot buy them), and the part value salvaged is the Tinkering xp. */
export function installTinker(World, { G }) {
  const P = World.prototype, T = G.TINK;
  const atBench = (S, pl) => S.objs?.some((o) => o.t === "scrapbench" && G.cheb(pl, o) <= T.reach) || S.npcs?.some((n) => n.name === T.npc && G.cheb(pl, n) <= T.reach);
  const view = (pl) => ({ parts: { ...pl.C.parts }, lvl: G.lvlOf(pl.C, "tinkering") });

  P.tinkerOp = function (S, pl, m) {
    if (G.HOLD.tinker && !pl.admin) return;
    const C = pl.C, op = String(m.op || "view"), bad = (t) => { this.say(pl, t, "bad"); pl.out.push({ type: "tinkererr", text: t }); };
    C.parts ||= { scrap: 0, gears: 0, sparks: 0, relic: 0 };
    if (op === "view") return pl.out.push({ type: "tinker", view: view(pl) });
    if (!atBench(S, pl)) return bad("The Scrap Bench is at Bronny's worksite, by the Yard's west gate.");
    if (op === "salvage") {
      const f = m.f | 0, keys = m.lot ? [...new Set(C.inv.map((s) => s.k))].filter((k) => G.salvageLot(k) && !G.isFav(C, k)) : [String(m.k)];
      const got = { scrap: 0, gears: 0, sparks: 0, relic: 0, pv: 0 }, what = [];
      for (const k of keys) {
        if (!G.canSalvage(k)) { if (!m.lot) return bad("Sal shakes her head. \"Not that. That's worth more whole.\""); continue; }
        if (G.isFav(C, k)) return bad("That's favourited. Unfavourite it first.");
        /* one level of one item at a time: plain copies, or the reforge asked for; never both mixed up */
        const stacks = C.inv.filter((s) => s.k === k && (G.fOf(s) | 0) === (m.lot ? 0 : f)), n = stacks.reduce((a, s) => a + s.n, 0); if (!n) continue;
        const g = G.salvageOf(k, n, m.lot ? 0 : f);
        if (!g.pv) continue;
        { const bonus = G.tkSalv(C); if (bonus > 0) for (const p of Object.keys(T.parts)) g[p] = Math.floor(g[p] * (1 + bonus)); }   /* the Magnifier */
        /* take exactly those stacks (by level), then pay out */
        for (const s of stacks) s.n = 0; C.inv = C.inv.filter((s) => s.n > 0);
        for (const p of Object.keys(T.parts)) { got[p] += g[p]; C.parts[p] = (C.parts[p] || 0) + g[p]; }
        got.pv += g.pv; what.push(`${n.toLocaleString()} ${(G.ITEMS[k]?.name || k).toLowerCase()}`);
      }
      if (!got.pv) return bad(m.lot ? "Nothing in your bag for the lot. Gear, bars, food and rares go one at a time." : "You've none of that in your bag.");
      this.grant(pl, "tinkering", Math.max(1, Math.round(got.pv * T.xpPerPv)));
      this.touch(pl);
      const parts = Object.entries(T.parts).filter(([p]) => got[p]).map(([p, d]) => `${got[p].toLocaleString()} ${d.name.toLowerCase()}`).join(", ");
      this.say(pl, `Sal breaks down ${what.length > 3 ? `${what.length} kinds of junk` : what.join(", ")}: ${parts}.`, "good");
      pl.out.push({ type: "tinker", view: view(pl), got });
      return;
    }

    /* BUILD a gadget: the level, the parts from the pouch and the ticket fee from the bag, all checked before anything is taken. A build
       has TINK.masterwork of making twice as many. The xp is the build's part value times TINK.buildXp, plus a little for the fee. */
    if (op === "build") {
      const id = String(m.id), g = G.GADGETS[id]; if (!g || g.item === false || !g.lvl) return;
      const lvl = G.lvlOf(C, "tinkering"); if (lvl < g.lvl) return bad(`That's a Tinkering ${g.lvl} build. You're ${lvl}.`);
      const short = Object.entries(g.parts || {}).filter(([p, n]) => (C.parts[p] || 0) < n);
      if (short.length) return bad(`Not enough parts: ${short.map(([p, n]) => `${n - (C.parts[p] || 0)} more ${T.parts[p].name.toLowerCase()}`).join(", ")}.`);
      if (G.tixIn(C) < g.fee) return bad(`The bench fee for that is ${G.fmtTix(g.fee)}. You have ${G.fmtTix(G.tixIn(C))}.`);
      const master = Math.random() < T.masterwork, n = g.n * (master ? 2 : 1), k = `tk_${id}`;
      if (G.roomFor(C.inv, k, C) < n) return bad("Your bag's too full to take it.");
      for (const [p, q] of Object.entries(g.parts || {})) C.parts[p] -= q;
      G.takeInv(C.inv, "tickets", g.fee); G.addInv(C.inv, k, n, C);
      this.grant(pl, "tinkering", Math.max(1, Math.round(G.tkPv(g) * T.buildXp + g.fee * T.feeXp)));
      this.touch(pl);
      this.say(pl, master ? `MASTERWORK! Sal whistles: ${n} ${g.name.toLowerCase()}${n > 1 ? "s" : ""} for the price of ${g.n}.` : `Sal hands over ${n > 1 ? `${n} ${g.name.toLowerCase()}s` : `a ${g.name.toLowerCase()}`}.`, master ? "loot" : "good");
      pl.out.push({ type: "tinker", view: view(pl), built: { id, n, master } });
      return;
    }
  };

  /* THE AUTOMATION TOOLS. Slower while nobody is at the keyboard (TINK.autoRate); full speed the moment you are. */
  P.tkSlow = function (pl, now, kind) { return G.tkAuto(pl.C, kind) && now - pl.lastInput > G.AFK_MS ? 1 / T.autoRate : 1; };
  /* A rock ran dry or a tree fell: with the tool running, walk to the nearest one of the SAME ore or wood you can work, and carry on. */
  P.tkNext = function (S, pl, ob, kind) {
    if (!G.tkAuto(pl.C, kind)) return;
    const now = Date.now(), same = (o) => o.t === ob.t && (o.ore || null) === (ob.ore || null) && (o.log || null) === (ob.log || null) && o !== ob && !o.edge && !(o.emptyUntil > now) && !(o.stumpUntil > now) && (!o.req || G.lvlOf(pl.C, o.req.skill) >= o.req.lvl);
    let best = -1, bd = 1e9;
    S.objs.forEach((o, i) => { if (!same(o)) return; const d = G.cheb(pl, o); if (d < bd && d <= 15) { bd = d; best = i; } });
    if (best < 0) return this.say(pl, `Your ${kind === "rock" ? "Auger" : "Chainsaw"} can't find another nearby. It'll wait.`);
    this.startAct(S, pl, { ob: best });
  };

  /* USING one, from the bag (useSpecial hands it here): a timed gadget starts its clock, one of each at a time; the rest happen at once */
  P.tinkerUse = function (pl, st, it, take) {
    const C = pl.C, id = it.gadget, g = G.GADGETS[id], bad = (t) => this.say(pl, t, "bad"); if (!g) return;
    if (G.HOLD.tinker && !pl.admin) return;
    C.tk ||= {};
    if (g.mins) {
      const cur = C.tk[id]; if (cur && cur.left > 0) return bad(`Your ${g.name} is already going: ${Math.ceil(cur.left / 60000)} minutes left.`);
      take(); C.tk[id] = { left: g.mins * 60000 };
      return this.say(pl, `You set up the ${g.name.toLowerCase()}. For ${g.mins} minute${g.mins === 1 ? "" : "s"} outside: ${g.does}.`, "good");
    }
    const S = this.scenes.get(C.scene), here = S ? this.playersIn(S) : [pl];
    if (g.kind === "confetti") {
      take();
      for (const p of here) { p.out.push({ type: "confetti", id: pl.id, name: pl.name }); if (p !== pl) this.say(p, `\u{1F389} ${pl.name} fires a confetti cannon!`); }
      return this.say(pl, "\u{1F389} Pop! Confetti everywhere.", "good");
    }
    if (g.kind === "xpchunk") { take(); this.grant(pl, g.xpChunk.skill, g.xpChunk.n); return this.say(pl, `You wind up the ${g.name.toLowerCase()}. ${g.does}.`, "good"); }
    if (g.kind === "banner") {
      take();
      const pt = this.partyOf?.(pl), who = here.filter((p) => p === pl || (pt && pt.members.includes(p.id) && G.cheb(p, pl) <= 8));
      for (const p of who) { (p.C.tk ||= {}).banner_buff = { left: G.GADGETS.banner_buff.mins * 60000 }; this.touch(p); this.say(p, `\u{1F6A9} ${p === pl ? "You plant" : `${pl.name} plants`} a Party Banner. For ten minutes: ${G.GADGETS.banner_buff.does}.`, "good"); }
      return;
    }
    if (g.kind === "bomb") {
      if (C.tkBomb > 0) return bad("You've already got a Boss Bomb armed. Hit a boss.");
      take(); C.tkBomb = g.bomb; this.touch(pl);
      return this.say(pl, `\u{1F4A3} Boss Bomb armed. Your next hit on a boss does ${g.bomb} more damage.`, "good");
    }
  };
}
