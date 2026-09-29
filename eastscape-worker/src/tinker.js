/* ============================================================ TINKERING (2026-09-28), the server's half. The rules are TINK, salvageOf,
   salvageLot and friends in the rules file; the design is EASTSCAPE-DRAFTS.md §11. STEP ONE: salvage at Sprocket Sal's Scrap Bench.

   op "view"     the pouch, your level (the window works out what your bag would salvage into with the same salvageOf)
   op "salvage"  { k, f } one stack (a reforged piece by its level), or { lot: true } for every plain drop in the bag at once
   Everything is taken from the BAG only, never the bank; a favourite is never taken; an equipped piece is not in the bag. The parts go
   into C.parts (not items: no bag space, and Bom cannot buy them), and the part value salvaged is the Tinkering xp. */
export function installTinker(World, { G }) {
  const P = World.prototype, T = G.TINK;
  const atBench = (S, pl) => S.objs?.some((o) => o.t === "scrapbench" && G.cheb(pl, o) <= T.reach) || S.npcs?.some((n) => n.name === T.npc && G.cheb(pl, n) <= T.reach);
  const view = (pl, w) => ({ parts: { ...pl.C.parts }, lvl: G.lvlOf(pl.C, "tinkering"), ...(w ? { proj: w.projView(pl), tiers: w.projTiers() } : {}) });

  P.tinkerOp = function (S, pl, m) {
    if (G.HOLD.tinker && !pl.admin) return;
    const C = pl.C, op = String(m.op || "view"), bad = (t) => { this.say(pl, t, "bad"); pl.out.push({ type: "tinkererr", text: t }); };
    C.parts ||= { scrap: 0, gears: 0, sparks: 0, relic: 0 };
    if (op === "view") return this.projPush(pl, m.focus ? { open: true, focus: String(m.focus) } : {});
    if (op === "give") return this.projGive(S, pl, m, bad);
    if (op === "finish") return this.projFinish(S, pl, m, bad);
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
        { const bonus = G.tkSalv(C); if (bonus > 0) for (const p of Object.keys(T.parts)) g[p] = Math.floor(g[p] * (1 + bonus)); }   /* the Magnifier, and the Bone Crusher's rollers */
        { const rs = G.projFx(C)?.relicSalv; if (rs) { const r = g.pv / rs; g.relic += Math.floor(r) + (Math.random() < r % 1 ? 1 : 0); } }   /* (2026-09-28) the Bone Crusher's sieve */
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
      pl.out.push({ type: "tinker", view: view(pl, this), got });
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
      pl.out.push({ type: "tinker", view: view(pl, this), built: { id, n, master } });
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

  /* ============================================================ WORLD PROJECTS (step four). The rules are PROJECTS in the rules file.
     this.proj = { <id>: { tier, got: { scrap, gears, sparks, relic, tickets }, by: { <login>: { name, pv, tix } }, done: [{ tier, by, at }] } }
     saved as "proj" and read back in the constructor (and restore()), then handed to the rules with setProjects so both halves build
     the same map. Parts and tickets are GIVEN, never handed back; every tier's last step needs one person with the Tinkering to
     finish it, standing at the site. */
  const PJ = G.PROJECTS, PARTS = [...Object.keys(T.parts), "tickets"];
  P.projLoad = async function () { this.proj = (await this.ctx.storage.get("proj")) || {}; this.bpot = (await this.ctx.storage.get("bpot")) || null; G.setProjects(this.projTiers()); };
  P.projSave = function () { this.ctx.storage.put("proj", this.proj).catch(() => {}); };
  P.projTiers = function () { return Object.fromEntries(Object.keys(PJ).map((id) => [id, Math.min(3, this.proj?.[id]?.tier | 0)])); };
  P.projOf = function (id) { const st = ((this.proj ||= {})[id] ||= { tier: 0, got: {}, by: {}, done: [] }); st.got ||= {}; st.by ||= {}; st.done ||= []; return st; };
  const needOf = (id, st) => PJ[id].tiers[st.tier]?.need || null;
  const readyOf = (id, st) => { const need = needOf(id, st); return !!need && Object.entries(need).every(([p, n]) => (st.got[p] | 0) >= n); };
  const atSite = (S, pl, id) => S.key === PJ[id].scene && S.objs.some((o) => o.proj === id && G.cheb(pl, G.nearestCell(o, pl)) <= 4);
  P.projView = function (pl) {
    return Object.fromEntries(Object.keys(PJ).map((id) => {
      const st = this.projOf(id), score = (v) => v.pv + (v.tix | 0) / 100;
      const top = Object.values(st.by).sort((a, b) => score(b) - score(a)).slice(0, 5).map((v) => ({ name: v.name, pv: v.pv, tix: v.tix | 0 }));
      return [id, { tier: st.tier, got: { ...st.got }, ready: readyOf(id, st), top, mine: st.by[pl.login || pl.name] || null, done: st.done.slice(-3) }];
    }));
  };
  P.projPush = function (pl, extra = {}) { pl.out.push({ type: "tinker", view: view(pl, this), ...extra }); };

  /* op "give" { id, part, n }: from the pouch (tickets from the bag), capped at what the tier still needs. At the site or Sal's bench. */
  P.projGive = function (S, pl, m, bad) {
    const id = String(m.id), Pd = PJ[id]; if (!Pd) return;
    if (!atSite(S, pl, id) && !atBench(S, pl)) return bad(`Give at Sal's bench, or at ${Pd.name} in ${Pd.where}.`);
    const st = this.projOf(id), need = needOf(id, st), part = String(m.part); if (!need) return bad(`${Pd.name} is finished.`);
    if (!PARTS.includes(part) || !need[part]) return bad("It doesn't need any of that.");
    const C = pl.C, have = part === "tickets" ? G.tixIn(C) : C.parts[part] | 0, left = need[part] - (st.got[part] | 0);
    if (left <= 0) return bad(`It has all the ${part === "tickets" ? "tickets" : T.parts[part].name.toLowerCase()} it needs.`);
    const n = Math.min(Math.floor(Number(m.n)) || 0, have, left);
    if (n <= 0) return bad(part === "tickets" ? "You've no tickets in your bag." : `You've no ${T.parts[part].name.toLowerCase()} in your pouch.`);
    const was = readyOf(id, st);
    if (part === "tickets") G.takeInv(C.inv, "tickets", n); else C.parts[part] -= n;
    st.got[part] = (st.got[part] | 0) + n;
    const who = (st.by[pl.login || pl.name] ||= { name: pl.name, pv: 0, tix: 0 }); who.name = pl.name;
    if (part === "tickets") who.tix = (who.tix | 0) + n; else who.pv += n * T.parts[part].pv;
    this.grant(pl, "tinkering", Math.max(1, Math.round(part === "tickets" ? n * T.feeXp : n * T.parts[part].pv * T.donateXp)));
    this.touch(pl); this.projSave();
    this.say(pl, `You give ${part === "tickets" ? G.fmtTix(n) : `${n.toLocaleString()} ${T.parts[part].name.toLowerCase()}`} to ${Pd.name}.`, "good");
    if (!was && readyOf(id, st)) { const t = Pd.tiers[st.tier]; this.houseSay(`\u{1F527} ${Pd.name} has everything it needs for ${t.name.toLowerCase()}. Somebody with Tinkering ${t.finish} has to finish it, in ${Pd.where}.`, "BRONNY"); }
    this.projPush(pl, { gave: { id, part, n } });
  };
  /* op "finish" { id }: the tier's last step. At the site, with the level; the tier goes up for everybody at once. */
  P.projFinish = function (S, pl, m, bad) {
    const id = String(m.id), Pd = PJ[id]; if (!Pd) return;
    const st = this.projOf(id), tier = Pd.tiers[st.tier]; if (!tier) return bad(`${Pd.name} is finished.`);
    if (!readyOf(id, st)) return bad("It still wants parts. Everybody chips in first.");
    if (!atSite(S, pl, id)) return bad(`The last step is done on site: ${Pd.where}.`);
    const lvl = G.lvlOf(pl.C, "tinkering"); if (lvl < tier.finish) return bad(`That's a Tinkering ${tier.finish} job. You're ${lvl}.`);
    st.tier++; st.got = {}; st.done.push({ tier: st.tier, by: pl.name, at: Date.now() }); this.projSave();
    this.grant(pl, "tinkering", Math.round(G.projPv(tier.need) * 0.2));
    G.setProjects(this.projTiers()); this.projRebuild(Pd.scene);
    this.houseSay(`\u{1F3D7}\u{FE0F} ${pl.name} finished ${tier.name.toLowerCase()} on ${Pd.name}: ${tier.does}. Thanks to everybody who chipped in.`, "BRONNY");
    for (const p of this.pls.values()) { p.out.push({ type: "projects", tiers: this.projTiers(), id, tier: st.tier }); p.out.push({ type: "casinonote", text: `\u{1F3D7}\u{FE0F} ${Pd.name}: ${tier.name} is built!` }); }
    this.projPush(pl, { finished: { id, tier: st.tier } });
  };
  /* A tier went up: swap the project's own objects in a live scene. Everything before them keeps its index and its state (a half-mined
     rock stays half-mined), because projObjs only ever appends; the project's tiles are copied from the new build. */
  P.projRebuild = function (key) {
    const S = this.scenes.get(key); if (!S) return;
    const b = G.buildScene(key), cut = S.objs.findIndex((o) => o.proj), head = cut < 0 ? S.objs : S.objs.slice(0, cut);
    const tail = b.objs.slice(b.projFrom).map((o, i) => ({ ...o, id: head.length + i }));
    S.objs = [...head, ...tail];
    for (const [x, y] of b.projTiles || []) S.g[y][x] = b.g[y][x];
    for (const p of this.playersIn(S)) if (p.act?.ob != null && p.act.ob >= head.length) p.act = null;
    S.whoSig = null;
  };

  /* THE FERRIS WHEEL (the Carnival project): a ride a day (two at tier 3) with a handful of parts at the top, doubled at tier 2, when a
     Relic shard can be in it too. House money in parts, not tickets: parts cannot be sold, so this cannot be farmed into the economy. */
  P.ferrisRide = function (pl) {
    const C = pl.C, fx = G.projFx(C) || {}, rides = fx.rides | 0, day = G.chicagoDay(); if (!rides) return;
    const f = (C.ferris?.day === day ? C.ferris : (C.ferris = { day, n: 0 }));
    if (f.n >= rides) return this.say(pl, rides > 1 ? "Two rides a day. The wheel's resting." : "One ride a day. Come back tomorrow.", "bad");
    f.n++; C.parts ||= { scrap: 0, gears: 0, sparks: 0, relic: 0 };
    const m = fx.prize || 1, rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1)), got = { scrap: rnd(30, 90) * m, gears: rnd(4, 14) * m, sparks: rnd(3, 10) * m, relic: m >= 2 && Math.random() < 0.15 ? 1 : 0 };
    for (const [k, n] of Object.entries(got)) C.parts[k] = (C.parts[k] | 0) + n;
    this.touch(pl);
    this.say(pl, `\u{1F3A1} Round and up you go. At the top, stuck in the seat: ${Object.entries(got).filter(([, n]) => n).map(([k, n]) => `${n} ${T.parts[k].name.toLowerCase()}`).join(", ")}.`, got.relic ? "loot" : "good");
    pl.out.push({ type: "ferris", got });
  };
  /* once a minute (the world's slow tick): the Lightning Rod's charged air, a Spark for everyone standing on the Thunderhead */
  P.projTick = function (now) {
    if ((this.projTickAt || 0) > now) return; this.projTickAt = now + 60000;
    for (const p of this.pls.values()) { const n = G.projFx(p.C)?.sparkTick | 0; if (!n) continue; p.C.parts ||= { scrap: 0, gears: 0, sparks: 0, relic: 0 }; p.C.parts.sparks += n; this.touch(p); p.out.push({ type: "spark", n }); }
  };

  /* THE KING'S CANNON (the Mire project): Sparks from the pouch, a volley at a boss, one shot a minute for the whole server.
     Tier 2 fires twice; tier 3's shell stuns. The damage is the firer's, through the same books as a burn: combat xp, the party
     meter, the boss's report and an open boss's shared kill.
     (2026-09-28, the owner: "make the cannon work on other bosses after the long night") THE LONG SHOT. The Pumpkin King is the
     Mire's only boss, so once he is gone for the year the cannon lobs its shell at whichever OPEN-WORLD boss is up anywhere
     (Captain Claw, the Deep Warden, ...). A boss in its own range always comes first. A long shot is support, not a way to farm a
     boss from safety: it pays the xp and shows on the boss's report, but it never takes a share of the loot and never lands the
     killing blow (it stops at 1 health); the people standing there finish it. */
  P.cannonFire = function (S, pl, now = Date.now()) {
    const tier = G.projTier("cannon"), K = G.CANNON, C = pl.C, bad = (t) => this.say(pl, t, "bad");
    if (!tier) return bad("It's a wreck. Bronny's collecting parts to fix it: see the plan board.");
    C.parts ||= { scrap: 0, gears: 0, sparks: 0, relic: 0 };
    if ((this.cannonAt || 0) > now) return bad(`It's still cooling: ${Math.ceil((this.cannonAt - now) / 1000)} seconds.`);
    const gun = S.objs.find((o) => o.t === "cannon"); if (!gun) return;
    let TS = S, m = S.mobs.filter((x) => !x.dead && G.MOBS[x.t]?.boss && G.cheb(x, gun) <= K.range).sort((a, b) => G.cheb(a, gun) - G.cheb(b, gun))[0];
    if (!m) for (const Q of this.scenes.values()) {   /* the long shot: an open-world boss up anywhere, never a dungeon's, an island's or a held map's */
      if (Q === S || Q.run || Q.owner || G.HOLD[Q.key] || !this.playersIn(Q).length) continue;
      const b = Q.mobs.find((x) => !x.dead && x.hp > 1 && G.MOBS[x.t]?.boss && G.MOBS[x.t]?.open); if (b) { TS = Q; m = b; break; }
    }
    if (!m) return bad("No boss is up anywhere. It's for bosses.");
    const far = TS !== S, bossName = G.MOBS[m.t].name, where = TS.def?.name || TS.key;
    if ((C.parts.sparks | 0) < K.sparks) return bad(`A shot takes ${K.sparks} Sparks. You've ${C.parts.sparks | 0}.`);
    C.parts.sparks -= K.sparks; this.cannonAt = now + K.cdMs; this.touch(pl);
    const volleys = tier >= 2 ? 2 : 1; let total = 0;
    for (let v = 0; v < volleys && m.hp > (far ? 1 : 0); v++) {
      const d = Math.min(far ? m.hp - 1 : m.hp, K.dmg); m.hp -= d; m.hurtAt = now; total += d;
      TS.events.push({ type: "splat", who: m.id, n: d, kind: "hit", t: now + v * 350, crit: true });
      this.award(pl, d); this.bossAdd(pl, m, "dmg", d); if (!far && G.MOBS[m.t]?.open) (m.by ||= {})[pl.id] = (m.by[pl.id] || 0) + d;
    }
    if (tier >= 3) m.stunUntil = now + K.stunMs;
    const stun = tier >= 3 ? ", and it's stunned" : "";
    for (const p of this.playersIn(S)) { p.out.push({ type: "cannon", x: gun.x, y: gun.y, n: volleys }); this.say(p, `\u{1F4A5} ${p === pl ? "You fire" : `${pl.name} fires`} the King's Cannon${far ? ` at ${bossName} in ${where}` : ""}: ${total} damage${stun}!`, "loot"); }
    if (far) for (const p of this.playersIn(TS)) { p.out.push({ type: "cannon", far: true, n: volleys }); this.say(p, `\u{1F4A5} A shell whistles in from the Mire: ${pl.name} fired the King's Cannon at ${bossName}. ${total} damage${stun}!`, "loot"); }
    if (m.hp <= 0) this.killMob(S, pl, m, now);
  };
}
