/* ============================================================ GEMS (2026-09-28), the server's half. The rules are GEMSET, GEM_OF, socketsOf,
   withSockets, caseOf and friends in the rules file; the design is EASTSCAPE-DRAFTS.md §12.

   AT THE GEM SORTER (the machine in the middle of the Yard's Market Square):
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
  const atSorter = (S, pl) => S.objs?.some((o) => o.t === "gemsorter" && G.cheb(pl, G.nearestCell(o, pl)) <= 3);   /* (it stands in the Yard's Market Square) */
  const gemView = (pl) => {
    const C = pl.C;
    return { cost: G.sortCost(), gc: G.caseOf(C), bonus: G.gemBonus(C),
      worn: Object.fromEntries(G.SLOTS.filter((sl) => C.eq[sl] && G.sockMax(C.eq[sl])).map((sl) => [sl, { k: C.eq[sl], max: G.sockMax(C.eq[sl]), socks: G.socketsOf(G.eqCode(C, sl)) }])) };
  };
  P.gemPush = function (pl, extra = {}) { pl.out.push({ type: "gems", view: gemView(pl), ...extra }); };

  P.gemOp = function (S, pl, m) {
    if (G.HOLD.gems && !pl.admin) return;
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
      if (roll == null) return bad("That gem hasn't been sorted. The Gem Sorter in the Yard rolls it first.");
      if (G.GEM_OF[st.k].where !== "case") return bad(`A ${G.ITEMS[st.k].name.toLowerCase()} is a combat gem: it goes in a socket on your gear.`);
      G.takeAt(C.inv, m.i | 0); C.gemcase.g[s] = { k: st.k, roll }; this.touch(pl);
      this.say(pl, `${G.gemText(st.k, roll)} goes into your Gem Case: ${G.GEM_OF[st.k].does}, wherever you are.`, "good");
      return this.gemPush(pl, { cased: { k: st.k, roll } });
    }
    /* ---- sockets: anywhere, from the Gem Satchel (the punch is the tool; the Sorter only rolls) */
    if (op === "punch" || op === "socket" || op === "pull") return this.gemSockOp(pl, op, m, bad);
    /* ---- the Sorter (on a DEV server an admin can work it from anywhere: /sorter, for testing) */
    if (!atSorter(S, pl) && !(this.env?.DEV === "1" && pl.admin)) return bad("That's done at the Gem Sorter, in the middle of the Yard's Market Square.");
    if (op === "auto") return this.gemAuto(pl, m, bad);
    if (op === "sort") {
      const i = m.i | 0, st = C.inv[i]; if (!st || !G.isGem(st.k)) return bad("Pick a gem from your bag.");
      const cost = G.sortCost(); if (G.tixIn(C) < cost) return bad(`A roll costs ${G.fmtTix(cost)}. You have ${G.fmtTix(G.tixIn(C))}.`);
      const was = G.rollOf(st), roll = G.gemRoll();
      G.takeInv(C.inv, "tickets", cost);
      const at = C.inv.indexOf(st);   /* (the tickets may have emptied a slot before it) */
      if (was == null) { if (st.n > 1) st.n -= 1; else C.inv.splice(at, 1); if (G.addInv(C.inv, st.k, 1, C, G.gemCode(roll)) > 0) this.bankAdd(pl, st.k, 1, G.gemCode(roll)); }
      else st.f = G.gemCode(roll);
      this.touch(pl);
      const iNow = was == null ? C.inv.findLastIndex((x) => x.k === st.k && G.rollOf(x) === roll) : C.inv.indexOf(st);   /* where the rolled gem is now, so the machine keeps hold of it */
      if (roll >= S_.roll[1]) this.houseSay(`\u{1F48E} ${pl.name} sorted a PERFECT ${G.ITEMS[st.k].name.toLowerCase()}: +${roll}%.`, "SAL");
      return this.gemPush(pl, { rolled: { k: st.k, roll, was, i: iNow } });
    }
    if (op === "sell") {
      const i = m.i | 0, st = C.inv[i]; if (!st || !G.isGem(st.k)) return;
      const name = G.forgeNameAt(st.k, G.fCode(st)); G.takeAt(C.inv, i); this.cashTo(pl, S_.sell); this.touch(pl);
      this.say(pl, `The sorter takes your ${name.toLowerCase()} for ${G.fmtTix(S_.sell)}.`, "good");
      return this.gemPush(pl, { sold: S_.sell });
    }
  };

  /* SOCKETS: punch, fill and pull, on what you are wearing, from anywhere */
  P.gemSockOp = function (pl, op, m, bad) {
    const C = pl.C;
    const slot = String(m.slot), k = C.eq[slot]; if (!G.SLOTS.includes(slot) || !k) return bad("Wear the piece first: sockets go into what you have on.");
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

  /* AUTO-ROLL (the Sorter's "roll until"): one gem, rolled again and again on the server until it lands at or above `target`, or the
     `budget` or the tickets run out, or 200 rolls. The page gets every roll back and plays them out, so one click is a whole run and
     nobody has to send 30 messages to chase a +10. */
  P.gemAuto = function (pl, m, bad) {
    const C = pl.C, st = C.inv[m.i | 0]; if (!st || !G.isGem(st.k)) return bad("Put a gem in the machine first.");
    const target = Math.max(S_.roll[0] + 1, Math.min(S_.roll[1], m.target | 0)), cost = G.sortCost(), budget = Math.max(cost, Math.min(1e8, Math.floor(Number(m.budget)) || 0));
    let cur = st, i0 = m.i | 0;
    if (G.rollOf(cur) != null && G.rollOf(cur) >= target) return bad(`It's already at ${G.gemText(cur.k, G.rollOf(cur))}.`);
    const rolls = []; let spent = 0;
    while (rolls.length < 200 && spent + cost <= budget && G.tixIn(C) >= cost) {
      const roll = G.gemRoll(); G.takeInv(C.inv, "tickets", cost); spent += cost;
      if (G.rollOf(cur) == null) {   /* the first roll splits one off an unsorted stack */
        const at = C.inv.indexOf(cur); if (cur.n > 1) cur.n -= 1; else C.inv.splice(at, 1);
        if (G.addInv(C.inv, st.k, 1, C, G.gemCode(roll)) > 0) { this.bankAdd(pl, st.k, 1, G.gemCode(roll)); rolls.push(roll); cur = null; break; }
        cur = C.inv[C.inv.length - 1];
      } else cur.f = G.gemCode(roll);
      rolls.push(roll);
      if (roll >= target) break;
    }
    if (!rolls.length) return bad(`A roll costs ${G.fmtTix(cost)}. You have ${G.fmtTix(G.tixIn(C))}.`);
    this.touch(pl);
    const last = rolls[rolls.length - 1];
    if (last >= S_.roll[1]) this.houseSay(`\u{1F48E} ${pl.name} sorted a PERFECT ${G.ITEMS[st.k].name.toLowerCase()}: +${last}%.`, "SAL");
    this.gemPush(pl, { auto: { k: st.k, rolls, spent, hit: last >= target, i: cur ? C.inv.indexOf(cur) : -1 } });
  };

  /* A GEM FOUND: every skilling action at GEMSET.dropLvl+ has a GEMSET.drop chance of that skill's gem (grant calls this), and a
     monster of that level or more a chance of a combat gem (killMob). Bosses: a combat gem more often, and the Voidheart bit. */
  P.gemFind = function (pl, k) {
    if (G.HOLD.gems) return;
    if (this.keepRare(pl, k, 1)) this.say(pl, `\u{1F48E} Something glints: a ${G.ITEMS[k].name.toLowerCase()}. The Gem Sorter in the Yard can make something of it.`, "loot");
  };
  P.gemOnXp = function (pl, skill, xp) {
    const g = G.GEM_SKILL[skill]; if (!g || G.HOLD.gems || !(xp > 0)) return;
    if (G.lvlOf(pl.C, skill) >= S_.dropLvl && Math.random() < S_.drop) this.gemFind(pl, g.k);
  };
  P.gemOnKill = function (pl, m) {
    if (G.HOLD.gems) return; const d = G.MOBS[m.t]; if (!d) return;
    const boss = d.boss && d.open, combat = G.GEMSET.list.filter((g) => g.where === "gear");
    if ((d.lvl || 0) >= S_.dropLvl && Math.random() < (boss ? 0.2 : S_.drop * 10)) this.gemFind(pl, combat[Math.floor(Math.random() * combat.length)].k);
    if (boss && Math.random() < 1 / 60 && this.keepRare(pl, "voidheart_bit", 1)) this.say(pl, "\u{1F529} A Voidheart drill bit comes loose from the boss. Sal will want to see this.", "loot");
  };

  /* (2026-09-28, the owner: "load a dev character so i can test the gems function in totality ... its a lot of work getting all the
     items") /gemkit, DEV SERVER ONLY: everything the gem system needs, on whoever types it. The Sorter built; combat, gathering,
     crafting and Tinkering levels up; the whole Nova set worn with no sockets yet; a Nova axe, pickaxe and rod in the bag to socket;
     punches, Master Punches, Voidheart bits and every Gem Case kit; five million tickets; and in the bank, three of every gem unsorted
     plus a perfect one of each, so a socket or a case slot can be filled before a single roll. /sorter opens the Sorter from anywhere. */
  P.gemKit = function (pl) {
    if (this.env?.DEV !== "1") return this.say(pl, "That's for the dev server only.", "bad");
    const C = pl.C;
    for (const [k, lv] of Object.entries({ melee: 99, hp: 99, archery: 99, magic: 99, tinkering: 90, mining: 90, woodcutting: 90, fishing: 90, cooking: 80, smithing: 80, alchemy: 80, fletching: 80, wizardry: 80, farming: 80, agility: 80, thieving: 80, breeding: 80, fungiculture: 80 })) C.xp[k] = Math.max(C.xp[k] || 0, G.XP_AT[lv]);
    C.hp = G.maxHpOf(C);
    /* the Nova set, worn, sockets empty (the gear already worn goes to the bank rather than the floor) */
    C.eqf ||= {};
    for (const [sl, k] of Object.entries({ weapon: "nova_sword", body: "nova_body", legs: "nova_legs", helm: "nova_helm", boots: "nova_boots", gloves: "nova_gloves", shield: "nova_shield", amulet: "nova_amulet", ring: "nova_ring" })) {
      if (C.eq[sl] && C.eq[sl] !== k) this.bankAdd(pl, C.eq[sl], 1, G.eqCode(C, sl));
      C.eq[sl] = k; delete C.eqf[sl];
    }
    const bag = [["tickets", 5000000], ["nova_axe", 1], ["nova_pickaxe", 1], ["nova_rod", 1], ["tk_punch", 10], ["tk_masterpunch", 4], ["tk_caseslot", 3], ["tk_caseslot2", 3], ["tk_caseslot3", 3], ["voidheart_bit", 3]];
    for (const [k, n] of bag) if (G.addInv(C.inv, k, n, C) > 0) this.bankAdd(pl, k, n);
    for (const g of G.GEMSET.list) { this.bankAdd(pl, g.k, 3); this.bankAdd(pl, g.k, 1, G.gemCode(G.GEMSET.roll[1])); }
    for (const [k, r] of [["ruby", 10], ["carnelian", 7], ["topaz", 10], ["opal", -3]]) if (G.addInv(C.inv, k, 1, C, G.gemCode(r)) > 0) this.bankAdd(pl, k, 1, G.gemCode(r));   /* a few sorted ones in the bag, to socket and case straight away */
    C.parts = { scrap: 20000, gears: 5000, sparks: 3000, relic: 200 };
    this.touch(pl); this.persist?.(pl).catch?.(() => {});
    this.say(pl, "\u{1F48E} Gem kit loaded: you're wearing the Nova set with empty sockets, the bag has punches, case kits and 5M tickets, and the bag has four sorted gems to try, and the bank three of every gem unsorted plus a perfect one of each. /sorter opens the Sorter from here.", "loot");
    this.gemPush(pl);
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
