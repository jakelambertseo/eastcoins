/* ============================================================ BRONNY'S ORDER, THE SERVER'S DAILY (2026-09-28), the server's half.
   What it is and why is in the rules file (ORDER, orderPick, orderPct). One order lives in the World, saved under the storage key "order":

     { id, at, until, lines: [{ kind, k, n, got }], by: { <player id>: { name, n } }, said: [25, 50, ...], doneAt, claimedBy }

   Its life: posted (a countdown of ORDER.ms) -> handed in to by anyone at Bronny -> FILLED (doneAt: the countdown stops, and a 2X waits)
   -> CLAIMED by somebody who helped (the server's 2X starts in their name) -> the next order goes up straight away. An order that
   runs out unfilled is replaced and keeps nothing. Nothing here pays tickets; the only reward is the 2X, and handing in destroys the
   items, which is the whole balance.

   Who hears what: the house's chat line (as BRONNY THE FOREMAN) for a new order, 25/50/75%, filled, claimed and ran out; the window's
   numbers go to anyone who has looked at the order in the last quarter of an hour (pl.orderSeen), because a turn-in is rare enough
   that pushing the view is cheaper than anyone polling for it. */
export function installOrder(World, { G }) {
  const P = World.prototype, O = G.ORDER, WATCH_MS = 15 * 60000, NAME = "BRONNY THE FOREMAN";
  const bag = (pl, k) => G.countItems({ inv: pl.C.inv, bank: [] }, [k]);
  const plain = (pl, k) => pl.C.inv.reduce((a, s) => a + (s.k === k && !G.fCode(s) ? s.n : 0), 0);   /* (2026-09-30) the keystone takes plain copies only: never a reforge */
  const avail = (pl, l) => (l.kind === "keystone" ? plain(pl, l.k) : bag(pl, l.k));
  const nameOf = (k) => G.ITEMS[k]?.name || k;
  const listText = (o) => o.lines.map((l) => `${l.n.toLocaleString()} ${nameOf(l.k).toLowerCase()}`).join(", ");

  P.orderLoad = async function () { this.order = (await this.ctx.storage.get("order")) || null; };
  P.orderSave = function () { this.ctx.storage.put("order", this.order).catch(() => {}); };

  P.orderNew = function (now, quiet) {
    this.order = { id: `${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: now, until: now + O.ms, lines: G.orderPick(), by: {}, said: [], doneAt: 0, claimedBy: null };
    this.orderSave();
    if (!quiet) this.houseSay(`\u{1F6A7} BRONNY IS REBUILDING THE YARD and needs: ${listText(this.order)}. Fill his order together and the whole server gets a 2X.`, NAME);
    this.orderPush();
  };
  /* once a second from the world's tick: the first order ever, and an unfilled order running out. A FILLED one never runs out. */
  P.orderTick = function (now) {
    const o = this.order;
    if (!o) return this.orderNew(now);
    if (!o.doneAt && now >= o.until) {
      const pct = Math.round(G.orderPct(o) * 100);
      this.houseSay(`⌛ Bronny's order ran out at ${pct}%. He's put a fresh one up.`, NAME);
      this.orderNew(now, true);
      this.houseSay(`\u{1F6A7} BRONNY IS REBUILDING THE YARD and needs: ${listText(this.order)}. Fill his order together and the whole server gets a 2X.`, NAME);
    }
  };

  P.orderView = function (pl) {
    const o = this.order; if (!o) return null;
    const mine = o.by[pl.id]?.n || 0, helpers = Object.values(o.by).sort((a, b) => b.n - a.n);
    return {
      id: o.id, at: o.at, until: o.until, now: Date.now(), doneAt: o.doneAt, pct: G.orderPct(o),
      lines: o.lines.map((l) => ({ ...l, have: avail(pl, l) })),
      helpers: helpers.slice(0, 12).map((h) => ({ name: h.name, n: h.n })), helpersN: helpers.length,
      mine, canClaim: !!(o.doneAt && mine), dbl: this.doubleView()
    };
  };
  /* the numbers, to everybody who has had the window open lately (the page ignores it if the window is shut) */
  P.orderPush = function () {
    const now = Date.now();
    for (const p of this.pls.values()) if (p.orderSeen && now - p.orderSeen < WATCH_MS) p.out.push({ type: "order", view: this.orderView(p) });
  };

  P.orderOp = function (S, pl, m) {
    /* a refusal goes to the chat AND to the window, where the person who clicked is actually looking */
    const now = Date.now(), op = String(m.op || "view"), bad = (t) => { this.say(pl, t, "bad"); pl.out.push({ type: "ordererr", text: t }); };
    this.orderTick(now);
    const o = this.order;
    if (op === "view") { pl.orderSeen = now; return pl.out.push({ type: "order", view: this.orderView(pl) }); }
    const foreman = S.npcs?.find((x) => x.name === O.npc);
    if (!foreman || G.cheb(pl, foreman) > 3) return bad("Bronny takes deliveries at the west gate of the Yard, by the road to the Carnival.");
    pl.orderSeen = now;

    if (op === "give") {
      if (o.doneAt) return bad("That order's filled. Claim the 2X, and Bronny puts up the next one.");
      const only = m.k ? String(m.k) : null, cap = m.n ? Math.max(1, m.n | 0) : Infinity, parts = [], faved = [];
      let total = 0;
      for (const l of o.lines) {
        if (only && l.k !== only) continue;
        if (!only && l.kind === "keystone") continue;   /* (2026-09-30) "Hand in everything" leaves the keystone in the bag: it's handed in on its own */
        const left = l.n - l.got; if (left <= 0) continue;
        if (G.isFav?.(pl.C, l.k)) { if (bag(pl, l.k)) faved.push(nameOf(l.k).toLowerCase()); continue; }   /* a favourited stack is never handed over by accident */
        const n = Math.min(left, avail(pl, l), cap); if (n <= 0) continue;
        const took = G.takeInv(pl.C.inv, l.k, n); if (!took) continue;
        l.got += took; total += took; parts.push(`${took.toLocaleString()} ${nameOf(l.k).toLowerCase()}`);
      }
      if (!total) return bad(faved.length ? `Your ${faved.join(" and ")} ${faved.length > 1 ? "are" : "is"} favourited, so Bronny won't take ${faved.length > 1 ? "them" : "it"}. Unfavourite first.` : only ? `You've no ${nameOf(only).toLowerCase()} in your bag.` : "You've nothing on the order in your bag.");
      const h = (o.by[pl.id] ||= { name: pl.name, n: 0 }); h.n += total; h.name = pl.name;
      this.touch(pl);
      this.say(pl, `Bronny ticks off ${parts.join(", ")}. "That's going straight into the Yard."`, "good");
      pl.out.push({ type: "ordergave", n: total });
      const pct = G.orderPct(o);
      if (o.lines.every((l) => l.got >= l.n)) {
        o.doneAt = now;
        for (const id of Object.keys(o.by)) { const q = this.pls.get(id); if (q) this.workRoll?.(q, "bronny", 1 / 6); }   /* (2026-10-01) Bronny's leathers, for anyone who helped fill it */
        const top = Object.values(o.by).sort((a, b) => b.n - a.n).slice(0, 3).map((x) => x.name).join(", ");
        this.houseSay(`✅ BRONNY'S ORDER IS FILLED! ${Object.keys(o.by).length} helped (top: ${top}). A 2X Potion is waiting at Bronny: anyone who helped can claim it for the whole server.`, NAME);
/* (2026-09-30, the owner: "the casino message are duplicating again") CASINO's chat line above already says this to everyone: no second note */
      } else for (const q of [25, 50, 75]) if (pct * 100 >= q && !o.said.includes(q)) { o.said.push(q); this.houseSay(`\u{1F4E6} Bronny's order is ${q}% there. ${pl.name} just brought in ${parts.join(", ")}.`, NAME); }
      this.orderSave(); this.orderPush();
      return;
    }

    if (op === "claim") {
      if (!o.doneAt) return bad("Fill the order first. Then there's a 2X to claim.");
      if (!o.by[pl.id]) return bad("Only somebody who helped fill it can claim it. Bring Bronny something on the next one.");
      if (this.doubleOn()) { const left = Math.ceil((this.dbl.until - now) / 60000); return bad(`A 2X is already running: ${left} minute${left === 1 ? "" : "s"} left. Claim this one after it.`); }
      o.claimedBy = pl.name; this.orderSave();
      this.doubleStart(pl.name, G.DOUBLE.ms);
      this.houseSay(`\u{1F389} ${pl.name} claimed the 2X from Bronny's order! Thanks to everyone who pitched in.`, NAME);
      pl.out.push({ type: "orderclaimed" });
      this.orderNew(now);
      return;
    }
  };
}
