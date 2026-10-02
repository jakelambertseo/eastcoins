/* ============================================================ THE BUFF BAG (2026-10-02, v1.2): the server's half. Read THE BUFF BAG in the rules file first.
     bbagUse    click the bag or press B: one of everything loaded, through the same code a click on each item runs; a buff still running is skipped
     bbagOp     the window: load a slot from the bag (top it up, or swap what's in it) and take a slot out
   The contents are C.bbag = { meal: { k, n }, ... }, on the character. Everything does nothing while HOLD.bbag is on. */
export function installBbag(World, { G }) {
  const P = World.prototype;
  const has = (C) => (C.inv || []).some((s) => s.k === "buffbag");
  const name = (k) => G.ITEMS[k]?.name || k;

  /** use everything loaded: the messages each item would send are gathered into one line */
  P.bbagUse = function (pl) {
    if (G.HOLD.bbag) return;
    const C = pl.C, B = (C.bbag ||= {}), now = Date.now(), done = [], skipped = [], refused = [];
    if (!has(C)) return this.say(pl, G.hasBbag(C) ? "Your Buff Bag is in the bank. Take it out to use it." : "You don't have a Buff Bag. The Store sells them.", "bad");
    if (now - (pl.bbagAt || 0) < 800) return; pl.bbagAt = now;
    const said = [], say = this.say;
    this.say = function (p, t, kind) { if (p === pl) { said.push({ t, kind }); return; } return say.call(this, p, t, kind); };   /* the handlers' own lines, collected */
    try {
      for (const slot of G.BBAG.slots) {
        const s = B[slot]; if (!s || !(s.n > 0)) continue;
        const it = G.ITEMS[s.k]; if (!it || G.bbagSlotOf(s.k) !== slot) { delete B[slot]; continue; }
        if (slot === "kit" && G.HOLD.kits) continue;
        const left = G.bbagLeft(C, slot, s.k);
        if (left > G.BBAG.skipMs) { skipped.push(`${it.short || it.name} (${Math.ceil(left / 60000)} min left)`); continue; }
        const before = s.n, n0 = said.length, take = () => { s.n--; this.touch(pl); };
        if (slot === "meal") this.bbagEat(pl, s.k, take);
        else this.useSpecial(pl, -1, { k: s.k, n: s.n }, it, take);
        if (s.n < before) done.push(it.short || it.name); else { const why = said.slice(n0).find((x) => x.kind === "bad"); if (why) refused.push(why.t); }
        if (!s.n) B[slot] = { k: s.k, n: 0 };   /* an empty slot remembers what it held, so the window can offer a refill */
      }
    } finally { delete this.say; }   /* back to the prototype's own */
    this.touch(pl);
    if (done.length) this.say(pl, `Buff Bag: ${done.join(", ")}.${skipped.length ? ` Still running: ${skipped.join(", ")}.` : ""}`, "good");
    else if (skipped.length) this.say(pl, `Everything in your Buff Bag is still running: ${skipped.join(", ")}.`);
    else if (!refused.length) this.say(pl, "Your Buff Bag is empty. Right-click it to fill it.", "bad");
    for (const t of refused) this.say(pl, t, "bad");
  };
  /** a meal from the bag: what eating it does (its heal and its buff), without the bag slot it would come from */
  P.bbagEat = function (pl, k, take) {
    const C = pl.C, it = G.ITEMS[k]; if (!it?.meal) return;
    take();
    const before = C.hp; C.hp = Math.min(G.maxHpOf(C), C.hp + Math.round(it.heal || 0));
    C.meal = { k, left: it.meal.mins * 60000 };
    this.say(pl, `A proper dinner. For ${it.meal.mins} minutes outside: ${G.fxText(it.meal.fx)}.${C.hp > before ? ` It heals ${C.hp - before}.` : ""}`, "loot");
  };
  /** the window: { op: "load", slot, i } or { op: "take", slot } */
  P.bbagOp = function (pl, m) {
    if (G.HOLD.bbag) return;
    const C = pl.C, B = (C.bbag ||= {}), slot = String(m.slot); if (!G.BBAG.slots.includes(slot)) return;
    if (!has(C)) return this.say(pl, "Take your Buff Bag out of the bank first.", "bad");
    const back = (s) => { if (!s || !(s.n > 0)) return true; if (G.roomFor(C.inv, s.k, C) < s.n) return false; G.addInv(C.inv, s.k, s.n, C); return true; };
    if (m.op === "take") {
      const s = B[slot]; if (!s) return;
      if (!back(s)) return this.say(pl, "No room in your bag for that.", "bad");
      delete B[slot]; this.touch(pl);
      return this.say(pl, s.n > 0 ? `${s.n} × ${name(s.k)} back in your bag.` : `The ${G.BBAG.names[slot].toLowerCase()} pocket is empty now.`);
    }
    if (m.op !== "load") return;
    const st = C.inv[m.i | 0]; if (!st) return;
    if (G.bbagSlotOf(st.k) !== slot) return this.say(pl, `That doesn't go in the ${G.BBAG.names[slot].toLowerCase()} pocket.`, "bad");
    if (G.fCode(st)) return this.say(pl, "Not that one.", "bad");
    let cur = B[slot];
    if (cur && cur.k !== st.k) { if (!back(cur)) return this.say(pl, `No room in your bag for the ${name(cur.k).toLowerCase()} that's in there now. Make room first.`, "bad"); cur = null; }
    const base = cur ? cur.n : 0, add = Math.min(G.BBAG.max - base, G.countItems({ inv: C.inv }, [st.k]));
    if (add <= 0) return this.say(pl, `That pocket's full: ${G.BBAG.max} ${name(st.k).toLowerCase()}.`, "bad");
    const took = G.takeInv(C.inv, st.k, add);
    B[slot] = { k: st.k, n: base + took }; this.touch(pl);
    return this.say(pl, `Buff Bag: ${B[slot].n} × ${name(st.k)} in the ${G.BBAG.names[slot].toLowerCase()} pocket.`, "good");
  };
  for (const k of ["bbagUse", "bbagOp"]) { const f = P[k]; P[k] = function (...a) { try { return f.apply(this, a); } catch (e) { console.error(k, e); } }; }
}
