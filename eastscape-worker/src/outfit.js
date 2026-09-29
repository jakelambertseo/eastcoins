/* ============================================================ THE OUTFITTERS (2026-09-29), the server's half. The rules are OUTFIT, outfitShelf and
   outfitBuys at the end of the rules file; the page's half is v3/assets/js/eastscape-outfit.js.

   Two NPCs out in the world (OUTFIT.at): Wren the Ranger (shop "ranger") in Cloudreach and Morwenna the Mage (shop "mage") on the Thunderhead. Both ops need you within reach of
   the one you are dealing with:
     op "buy"  { shop, k }  one piece off that shelf, for outfitShelf's price in tickets
     op "sell" { shop, i }  one piece from your bag, if that outfitter buys it, for gearSell (Bom's rate: an eighth of the shelf, capped)
   A sale is paid with cashTo, never tixTo: the 2X doubles what you EARN, and selling gear back is not earning. Nothing here can make tickets:
   the dearest buy-back is GEAR_SELL_MAX against a shelf price many times that. */
export function installOutfit(World, { G }) {
  const P = World.prototype;
  const npcOf = (S, shop) => (S.npcs || S.def?.npcs || []).find((n) => n.shop === shop);
  P.outfitOp = function (S, pl, m) {
    const shop = m.shop === "ranger" || m.shop === "mage" ? m.shop : null; if (!shop) return;
    const C = pl.C, who = G.OUTFIT.npc[shop], bad = (t) => { this.say(pl, t, "bad"); pl.out.push({ type: "outfit", err: t }); };
    const n = npcOf(S, shop); if (!n || G.cheb(pl, n) > 3) return bad(`You need to be at ${who}'s stall, in ${G.OUTFIT.where[shop]}.`);
    if (m.op === "buy") {
      const k = String(m.k), row = G.outfitShelf(shop).find((r) => r.k === k); if (!row) return;
      if (G.tixIn(C) < row.price) return bad(`${G.ITEMS[k].name} is ${G.fmtTix(row.price)}. You have ${G.fmtTix(G.tixIn(C))}.`);
      if (G.roomFor(C.inv, k, C) < 1) return bad("Your bag's full.");
      G.takeInv(C.inv, "tickets", row.price); G.addInv(C.inv, k, 1, C); this.touch(pl);
      this.say(pl, `${who} wraps up a ${G.ITEMS[k].name.toLowerCase()} for ${G.fmtTix(row.price)}.`, "good");
      return pl.out.push({ type: "outfit", bought: k });
    }
    if (m.op === "sell") {
      const i = m.i | 0, st = C.inv[i]; if (!st) return;
      if (!G.outfitBuys(shop, st.k)) return bad(`${who} doesn't buy that.`);
      const f = G.fCode(st), pay = G.gearSell(st.k, f); if (!(pay > 0)) return bad(`${who} doesn't buy that.`);
      const name = G.forgeNameAt(st.k, f); G.takeAt(C.inv, i); this.cashTo(pl, pay); this.touch(pl);
      this.say(pl, `${who} takes your ${name.toLowerCase()} for ${G.fmtTix(pay)}.`, "good");
      return pl.out.push({ type: "outfit", sold: pay });
    }
  };
}
