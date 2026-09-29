/* ============================================================ GEMS (2026-09-28), the server's half. The rules are GEMSET, GEM_OF, socketsOf,
   withSockets, caseOf and friends in the rules file; the design is EASTSCAPE-DRAFTS.md §12.

   AT THE GEM SORTER (the Depths' World Project, tier 1 or more):
     op "sort"   { i }         roll one gem from the bag (unsorted, or re-roll a sorted one) for sortCost() tickets
     op "sell"   { i }         one gem back to the house for GEMSET.sell tickets, whatever its roll
     op "punch"  { slot }      a Socket Punch (first socket) or a Master Punch (a weapon's second) into a WORN level-80+ piece
     op "socket" { slot, s, i } a sorted COMBAT gem from the bag into an empty socket of a worn piece
     op "pull"   { slot, s }   the gem out of a socket: it comes back UNSORTED (the roll is lost; the owner's call)
   ANYWHERE:
     op "case"    { s, i }     a sorted SKILLING gem from the bag into an empty Gem Case slot
     op "caseout" { s }        out of the case, back UNSORTED
     op "view"                 the case, the worn sockets and today's price
   Everything a gem does is read from what is worn and what is in the case (gemBonus), so there is nothing to recompute here. */
export function installGems(World, { G }) {
  const P = World.prototype, S_ = G.GEMSET;
  const atSorter = (S, pl) => S.key === G.PROJECTS.sorter.scene && S.objs.some((o) => o.t === "gemsorter" && G.cheb(pl, G.nearestCell(o, pl)) <= 3);
  const gemView = (pl) => {
    const C = pl.C;
    return { cost: G.sortCost(), tier: G.projTier("sorter"), gc: G.caseOf(C), bonus: G.gemBonus(C),
      worn: Object.fromEntries(G.SLOTS.filter((sl) => C.eq[sl] && G.sockMax(C.eq[sl])).map((sl) => [sl, { k: C.eq[sl], max: G.sockMax(C.eq[sl]), socks: G.socketsOf(G.eqCode(C, sl)) }])) };
  };
  P.gemPush = function (pl, extra = {}) { pl.out.push({ type: "gems", view: gemView(pl), ...extra }); };

  P.gemOp = function (S, pl, m) {
    if (G.HOLD.tinker && !pl.admin) return;
    const C = pl.C, op = String(m.op || "view"), bad = (t) => { this.say(pl, t, "bad"); pl.out.push({ type: "gemserr", text: t }); };
    C.gemcase = G.caseOf(C);
    if (op === "view") return this.gemPush(pl, m.open ? { open: m.open } : {});
    /* ---- the case: anywhere */
    if (op === "case" || op === "caseout") {
      const s = m.s | 0; if (s < 0 || s >= C.gemcase.n) return;
      if (op === "caseout") {
        const g = C.gemcase.g[s]; if (!g) return;
        if (!this.give(pl, g.k)) return bad("Your bag's full.");
        C.gemcase.g[s] = null; this.touch(pl); this.say(pl, `You take the ${G.ITEMS[g.k].name.toLowerCase()} out of your Gem Case. It needs sorting again to go back in.`);
        return this.gemPush(pl);
      }
      if (C.gemcase.g[s]) return bad("That slot has a gem in it. Take it out first.");
      const st = C.inv[m.i | 0], roll = G.rollOf(st); if (!st || !G.isGem(st.k)) return bad("Pick a gem from your bag.");
      if (roll == null) return bad("That gem hasn't been sorted. The Gem Sorter in the Depths rolls it first.");
      if (G.GEM_OF[st.k].where !== "case") return bad(`A ${G.ITEMS[st.k].name.toLowerCase()} is a combat gem: it goes in a socket on your gear, at the Gem Sorter.`);
      G.takeAt(C.inv, m.i | 0); C.gemcase.g[s] = { k: st.k, roll }; this.touch(pl);
      this.say(pl, `${G.gemText(st.k, roll)} goes into your Gem Case: ${G.GEM_OF[st.k].does}, wherever you are.`, "good");
      return this.gemPush(pl, { cased: { k: st.k, roll } });
    }
    /* ---- the Sorter */
    if (!G.projTier("sorter")) return bad("The Gem Sorter isn't built yet. It's a World Project in the Depths.");
    if (!atSorter(S, pl)) return bad("That's done at the Gem Sorter, in the Depths.");
    if (op === "sort") {
      const i = m.i | 0, st = C.inv[i]; if (!st || !G.isGem(st.k)) return bad("Pick a gem from your bag.");
      const cost = G.sortCost(); if (G.tixIn(C) < cost) return bad(`A roll costs ${G.fmtTix(cost)}. You have ${G.fmtTix(G.tixIn(C))}.`);
      const was = G.rollOf(st), roll = G.gemRoll();
      G.takeInv(C.inv, "tickets", cost);
      const at = C.inv.indexOf(st);   /* (the tickets may have emptied a slot before it) */
      if (was == null) { if (st.n > 1) st.n -= 1; else C.inv.splice(at, 1); if (G.addInv(C.inv, st.k, 1, C, G.gemCode(roll)) > 0) this.bankAdd(pl, st.k, 1, G.gemCode(roll)); }
      else st.f = G.gemCode(roll);
      this.touch(pl);
      if (roll >= S_.roll[1]) this.houseSay(`\u{1F48E} ${pl.name} sorted a PERFECT ${G.ITEMS[st.k].name.toLowerCase()}: +${roll}%.`, "SAL");
      return this.gemPush(pl, { rolled: { k: st.k, roll, was } });
    }
    if (op === "sell") {
      const i = m.i | 0, st = C.inv[i]; if (!st || !G.isGem(st.k)) return;
      const name = G.forgeNameAt(st.k, G.fCode(st)); G.takeAt(C.inv, i); this.cashTo(pl, S_.sell); this.touch(pl);
      this.say(pl, `The sorter takes your ${name.toLowerCase()} for ${G.fmtTix(S_.sell)}.`, "good");
      return this.gemPush(pl, { sold: S_.sell });
    }
    const slot = String(m.slot), k = C.eq[slot]; if (!G.SLOTS.includes(slot) || !k) return bad("Wear the piece first: the sorter works on what you have on.");
    const max = G.sockMax(k), code = G.eqCode(C, slot), socks = G.socketsOf(code);
    if (!max) return bad(`Only level ${S_.minLvl}+ gear takes gems.`);
    if (op === "punch") {
      if (socks.length >= max) return bad(max > 1 ? "Both sockets are punched." : "It already has its socket.");
      const tool = socks.length === 0 ? "tk_punch" : "tk_masterpunch";
      if (!C.inv.some((s) => s.k === tool)) return bad(socks.length === 0 ? "You need a Socket Punch. Sal builds them (Tinkering 70)." : "A weapon's second socket needs a Master Punch. Sal builds them (Tinkering 85, and a Voidheart drill bit).");
      G.takeInv(C.inv, tool, 1); C.eqf ||= {}; C.eqf[slot] = G.withSockets(code, [...socks, null]); this.touch(pl);
      this.say(pl, `CHUNK. Your ${G.ITEMS[k].name.toLowerCase()} has ${socks.length + 1 === 1 ? "a gem socket" : "a second socket"}.`, "good");
      return this.gemPush(pl, { punched: slot });
    }
    const s = m.s | 0; if (s < 0 || s >= socks.length) return;
    if (op === "socket") {
      if (socks[s]) return bad("That socket has a gem in it. Pull it first.");
      const st = C.inv[m.i | 0], roll = G.rollOf(st); if (!st || !G.isGem(st.k)) return bad("Pick a gem from your bag.");
      if (roll == null) return bad("Sort it first: an unsorted gem doesn't fit.");
      if (G.GEM_OF[st.k].where !== "gear") return bad(`A ${G.ITEMS[st.k].name.toLowerCase()} is a skilling gem: it goes in your Gem Case, not a socket.`);
      G.takeAt(C.inv, m.i | 0); const ns = [...socks]; ns[s] = { k: st.k, roll }; C.eqf ||= {}; C.eqf[slot] = G.withSockets(code, ns); this.touch(pl);
      this.say(pl, `${G.gemText(st.k, roll)} sits in your ${G.ITEMS[k].name.toLowerCase()}.`, "good");
      return this.gemPush(pl, { socketed: { slot, s } });
    }
    if (op === "pull") {
      const g = socks[s]; if (!g) return;
      if (!this.give(pl, g.k)) return bad("Your bag's full.");
      const ns = [...socks]; ns[s] = null; C.eqf[slot] = G.withSockets(code, ns); this.touch(pl);
      this.say(pl, `You pry out the ${G.ITEMS[g.k].name.toLowerCase()}. It'll need sorting again.`);
      return this.gemPush(pl);
    }
  };

  /* A GEM FOUND: every skilling action at GEMSET.dropLvl+ has a GEMSET.drop chance of that skill's gem (grant calls this), and a
     monster of that level or more a chance of a combat gem (killMob). Bosses: a combat gem more often, and the Voidheart bit. */
  P.gemFind = function (pl, k) {
    if (G.HOLD.tinker || !G.projTier) return;
    if (this.keepRare(pl, k, 1)) this.say(pl, `\u{1F48E} Something glints: a ${G.ITEMS[k].name.toLowerCase()}. The Gem Sorter in the Depths can make something of it.`, "loot");
  };
  P.gemOnXp = function (pl, skill, xp) {
    const g = G.GEM_SKILL[skill]; if (!g || G.HOLD.tinker || !(xp > 0)) return;
    if (G.lvlOf(pl.C, skill) >= S_.dropLvl && Math.random() < S_.drop) this.gemFind(pl, g.k);
  };
  P.gemOnKill = function (pl, m) {
    if (G.HOLD.tinker) return; const d = G.MOBS[m.t]; if (!d) return;
    const boss = d.boss && d.open, combat = G.GEMSET.list.filter((g) => g.where === "gear");
    if ((d.lvl || 0) >= S_.dropLvl && Math.random() < (boss ? 0.2 : S_.drop * 10)) this.gemFind(pl, combat[Math.floor(Math.random() * combat.length)].k);
    if (boss && Math.random() < 1 / 60 && this.keepRare(pl, "voidheart_bit", 1)) this.say(pl, "\u{1F529} A Voidheart drill bit comes loose from the boss. Sal will want to see this.", "loot");
  };

  /* the Gem Case's slots, from the bag: a Hinge takes it to 6, a Frame to 9, a Heart to 12, each only from the step below */
  P.caseSlotUse = function (pl, g, take) {
    const C = pl.C; C.gemcase = G.caseOf(C);
    if (C.gemcase.n >= g.upto) return this.say(pl, `Your Gem Case already has ${C.gemcase.n} slots: a ${g.name} only takes it to ${g.upto}.`, "bad");
    if (C.gemcase.n < g.upto - 3) return this.say(pl, `A ${g.name} fits a case with ${g.upto - 3} slots or more. Yours has ${C.gemcase.n}.`, "bad");
    take(); C.gemcase.n += 1; C.gemcase.g.push(null); this.touch(pl);
    this.say(pl, `Your Gem Case opens up a slot: ${C.gemcase.n} now.`, "good"); this.gemPush(pl);
  };
}
