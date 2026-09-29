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
  };
}
