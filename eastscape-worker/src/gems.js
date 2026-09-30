/* ============================================================ GEMS (2026-09-28, rebuilt 2026-09-29), the server's half. The rules are GEMSET,
   GEM_OF, bagOf, bagPrice and gemBonus in the rules file; the page's half is v3/assets/js/eastscape-gems.js.

   THE GEM BAG, anywhere:
     op "view"                   the bag, what it is doing for you, and what the next slots cost
     op "put"  { side, slot, i } a SORTED gem from your bag into an empty open slot on its own side ("c" combat, "s" skilling)
     op "take" { side, slot }    a gem out of the bag, KEEPING ITS ROLL (2026-09-30, a player's ask and the owner: "if i take out a 4% topaz, it
                                 should go in my inventory as a 4% topaz"; it used to come back unsorted, so changing your mind cost a roll)
     op "open" { side }          the next slot on that side, for bagPrice() tickets
   AT THE GEM SORTER (the bench in the Yard's north court):
     op "sort" { i }             roll one gem (unsorted, or re-roll a sorted one) for sortCost() tickets
     op "sell" { i }             one gem back to the house for GEMSET.sell tickets, whatever its roll
   Everything a gem does is read from the bag (gemBonus), so there is nothing to recompute here. */
export function installGems(World, { G }) {
  const P = World.prototype, S_ = G.GEMSET;
  const atSorter = (S, pl) => S.objs?.some((o) => o.t === "gemsorter" && G.cheb(pl, G.nearestCell(o, pl)) <= 3);
  const gemView = (pl) => { const C = pl.C; return { cost: G.sortCost(), sell: S_.sell, bag: G.bagOf(C), bonus: G.gemBonus(C), next: { c: G.bagPrice(C, "c"), s: G.bagPrice(C, "s") } }; };
  P.gemPush = function (pl, extra = {}) { pl.out.push({ type: "gems", view: gemView(pl), ...extra }); };

  P.gemOp = function (S, pl, m) {
    if (G.HOLD.gems && !pl.admin) return;
    const C = pl.C, op = String(m.op || "view"), bad = (t) => { this.say(pl, t, "bad"); pl.out.push({ type: "gemserr", text: t }); };
    C.gembag = G.bagOf(C);
    const B = C.gembag, side = m.side === "c" ? "c" : m.side === "s" ? "s" : null, list = side ? B[side] : null, word = side === "c" ? "Combat" : "Skilling";
    if (op === "view") return this.gemPush(pl, m.open ? { open: m.open } : {});
    /* ---- the bag: anywhere */
    if (op === "open") {
      if (!side) return; const price = G.bagPrice(C, side); if (price == null) return bad(`Your ${word} side is fully open.`);
      if (G.tixIn(C) < price) return bad(`The next ${word.toLowerCase()} slot is ${G.fmtTix(price)}. You have ${G.fmtTix(G.tixIn(C))}.`);
      G.takeInv(C.inv, "tickets", price); this.trkTix(pl, -price, "gems"); B[side === "c" ? "cn" : "sn"] += 1; list.push(null); this.touch(pl);
      this.say(pl, `A new ${word.toLowerCase()} slot in your gem bag, for ${G.fmtTix(price)}.`, "good");
      return this.gemPush(pl, { opened: side });
    }
    if (op === "put" || op === "take") {
      if (!side) return; const s = m.slot | 0; if (s < 0 || s >= list.length) return;
      if (op === "take") {
        const g = list[s]; if (!g) return;
        if (G.addInv(C.inv, g.k, 1, C, G.gemCode(g.roll)) > 0) return bad("Your bag's full.");   /* one sorted gem, its own slot, the same roll */
        list[s] = null; this.touch(pl);
        this.say(pl, `You take the ${G.gemText(g.k, g.roll).toLowerCase()} out of your gem bag.`);
        return this.gemPush(pl);
      }
      if (list[s]) return bad("That slot has a gem in it. Take it out first.");
      const st = C.inv[m.i | 0], roll = G.rollOf(st); if (!st || !G.isGem(st.k)) return bad("Pick a gem from your bag.");
      if (roll == null) return bad("That gem hasn't been sorted. The Gem Sorter in the Yard rolls it first.");
      if (G.gemSide(st.k) !== side) return bad(`A ${G.ITEMS[st.k].name.toLowerCase()} is a ${G.gemSide(st.k) === "c" ? "combat" : "skilling"} gem: it goes on the other side.`);
      G.takeAt(C.inv, m.i | 0); list[s] = { k: st.k, roll }; this.touch(pl);
      this.say(pl, `${G.gemText(st.k, roll)} goes into your gem bag: ${G.GEM_OF[st.k].does}, wherever you are.`, "good");
      return this.gemPush(pl, { put: { side, slot: s } });
    }
    /* ---- the Sorter (on a DEV server an admin can work it from anywhere: /sorter, for testing) */
    if (!atSorter(S, pl) && !(this.env?.DEV === "1" && pl.admin)) return bad("That's done at the Gem Sorter, in the Yard's north court.");
    if (op === "sort") {
      const i = m.i | 0, st = C.inv[i]; if (!st || !G.isGem(st.k)) return bad("Pick a gem from your bag.");
      const cost = G.sortCost(); if (G.tixIn(C) < cost) return bad(`A roll costs ${G.fmtTix(cost)}. You have ${G.fmtTix(G.tixIn(C))}.`);
      const lk = G.loupeOf(C, "loupe2") ? "loupe2" : G.loupeOf(C, "loupe") ? "loupe" : null, was = G.rollOf(st), roll = lk ? G.gemRollLoupe(lk) : G.gemRoll();   /* (2026-09-30) the Store's loupes */
      G.takeInv(C.inv, "tickets", cost); this.trkTix(pl, -cost, "gems"); if (lk) C.store[lk] = G.loupeOf(C, lk) - 1;
      const at = C.inv.indexOf(st);   /* (the tickets may have emptied a slot before it) */
      if (was == null) { if (st.n > 1) st.n -= 1; else C.inv.splice(at, 1); if (G.addInv(C.inv, st.k, 1, C, G.gemCode(roll)) > 0) this.bankAdd(pl, st.k, 1, G.gemCode(roll)); }
      else if (st.n > 1) { st.n -= 1; if (G.addInv(C.inv, st.k, 1, C, G.gemCode(roll)) > 0) this.bankAdd(pl, st.k, 1, G.gemCode(roll)); }   /* (2026-09-29) a re-roll is ONE gem, never the stack it sat in */
      else st.f = G.gemCode(roll);
      this.touch(pl);
      if (roll >= S_.roll[1]) this.houseSay(`\u{1F48E} ${pl.name} sorted a PERFECT ${G.ITEMS[st.k].name.toLowerCase()}: +${roll}%.`, "SORTER");
      if (lk) this.say(pl, `${G.STORE[lk].name}: ${G.loupeOf(C, lk)} lifted roll${G.loupeOf(C, lk) === 1 ? "" : "s"} left.`);
      return this.gemPush(pl, { rolled: { k: st.k, roll, was, loupe: lk || undefined } });
    }
    if (op === "sell") {
      const i = m.i | 0, st = C.inv[i]; if (!st || !G.isGem(st.k)) return;
      const name = G.forgeNameAt(st.k, G.fCode(st)); G.takeAt(C.inv, i); this.cashTo(pl, S_.sell); this.touch(pl);
      this.say(pl, `The sorter takes your ${name.toLowerCase()} for ${G.fmtTix(S_.sell)}.`, "good");
      return this.gemPush(pl, { sold: S_.sell });
    }
  };

  /* A GEM FOUND: every skilling action at GEMSET.dropLvl+ has a GEMSET.drop chance of that skill's gem (grant calls this), and a
     monster of that level or more a chance of a combat gem (killMob); an open boss drops one more often. */
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
  };

  /* /gemkit, DEV SERVER ONLY: everything the gem bag needs, on whoever types it. Skill levels for the drops, five million tickets for
     rolls and slots, four sorted gems in the bag to put straight in, and in the bank three of every gem unsorted plus a perfect one of
     each. The bag itself is left at its starting slots, so opening one can be tried. /sorter opens the Sorter from anywhere. */
  P.gemKit = function (pl) {
    if (this.env?.DEV !== "1") return this.say(pl, "That's for the dev server only.", "bad");
    const C = pl.C;
    for (const [k, lv] of Object.entries({ melee: 99, hp: 99, archery: 99, magic: 99, mining: 90, woodcutting: 90, fishing: 90, cooking: 80, smithing: 80, alchemy: 80, fletching: 80, wizardry: 80, farming: 80, agility: 80, thieving: 80, breeding: 80, fungiculture: 80, tinkering: 80 })) C.xp[k] = Math.max(C.xp[k] || 0, G.XP_AT[lv]);
    C.hp = G.maxHpOf(C);
    if (G.addInv(C.inv, "tickets", 5000000, C) > 0) this.bankAdd(pl, "tickets", 5000000);
    for (const g of G.GEMSET.list) { this.bankAdd(pl, g.k, 3); this.bankAdd(pl, g.k, 1, G.gemCode(G.GEMSET.roll[1])); }
    for (const [k, r] of [["ruby", 10], ["carnelian", 7], ["topaz", 10], ["opal", -3]]) if (G.addInv(C.inv, k, 1, C, G.gemCode(r)) > 0) this.bankAdd(pl, k, 1, G.gemCode(r));
    this.touch(pl); this.persist?.(pl).catch?.(() => {});
    this.say(pl, "\u{1F48E} Gem kit loaded: 5M tickets, four sorted gems in your bag (a ruby, a carnelian, a topaz and an opal), and in the bank three of every gem unsorted and a perfect one of each. Open the gem bag from the Gems button; /sorter opens the Sorter from here.", "loot");
    this.gemPush(pl);
  };
}
