/* ============================================================ THRILL HILL: the server's half (2026-10-01, v1.1). The rules are the THRILL HILL section
   at the end of the rules file (THRILL, BOOKIE, stuntLvl) and the maps are lt-wild/thrill-gen.py's: read those first. Off while HOLD.thrill
   is on (the maps are not in OPEN, so nobody is on them; these entry points refuse as well).

     stStart    from startAct: a click on a stunt becomes an act. A course stunt is walked to from whichever side you can reach (the near
                side is `a`, the far side `b`); a cannon or a zip line is walked to and fires you at another map.
     stAct      from doAction: one tick of it. The shortcut code's shape: your level, the crossing (a "cross" so the page can animate it), a
                slip under level+10 that only costs the time (never on the Rookie Run), the XP, and the LAP: a course's stunts crossed
                forwards in order, from the first, pay the lap bonus at the last and roll for a runner's mark.
     bookieBuy  the "bookie" message: Fast Eddie's goods for runner's marks.

   The lap is on the player, not the save (pl.lap): a lap is a minute's work and a restart mid-lap costs at most that. What IS saved is the
   count and the best time per course (C.laps, C.bestLap), for the wiki and a board later. */
export function installThrill(World, { G }) {
  const P = World.prototype;

  P.stStart = function (S, pl, ob, f) {
    if (G.HOLD.thrill && !pl.god) return null;
    if (ob.to) return { kind: "stunt", ob, x: ob.a[0], y: ob.a[1], fwd: true, name: ob.name, reach: 0 };
    const A = { x: ob.a[0], y: ob.a[1] }, B = { x: ob.b[0], y: ob.b[1] };
    const pa = f.x === A.x && f.y === A.y ? [] : G.findPath(S.g, f, A, 0), pb = f.x === B.x && f.y === B.y ? [] : G.findPath(S.g, f, B, 0);
    if (!pa && !pb) { this.say(pl, "You can't get to that from here.", "bad"); return null; }
    const useA = pa && (!pb || pa.length <= pb.length), at = useA ? A : B;
    return { kind: "stunt", ob, x: at.x, y: at.y, far: useA ? B : A, fwd: !!useA, name: ob.name, reach: 0 };
  };

  P.stAct = function (S, pl, a, now) {
    const C = pl.C, ob = a.ob;
    if (G.HOLD.thrill && !pl.god) { pl.act = null; return; }
    if (pl.x !== a.x || pl.y !== a.y) { pl.path = G.findPath(S.g, pl, a, 0) || []; if (!pl.path.length) pl.act = null; return; }
    const lvl = G.stuntLvl(ob), have = G.lvlOf(C, "agility");
    if (have < lvl && !pl.god) { pl.act = null; return this.say(pl, `${ob.name}: Agility ${lvl}, and you're ${have}.`, "bad"); }
    if (!a.started) {
      a.started = now; a.next = now + G.THRILL.ms;
      if (a.far) { pl.dir = G.DIRS[`${Math.sign(a.far.x - pl.x)},${Math.sign(a.far.y - pl.y)}`] || pl.dir; pl.out.push({ type: "cross", ms: G.THRILL.ms, from: { x: pl.x, y: pl.y }, to: a.far }); }
      return this.say(pl, ob.to ? `You ${G.THRILL_VERB[ob.how]}...` : `You ${G.THRILL_VERB[ob.how] || "go over the"} ${ob.name.toLowerCase()}...`);
    }
    if (now < a.next) return;
    pl.act = null;
    if (ob.crs !== "rookie" && Math.random() < G.slipChance(C, lvl)) { if (pl.lap) pl.lap.at = now; return this.say(pl, ob.to ? "You lose your nerve at the last second. Try again." : "You come off and land in the foam. Back where you started.", "bad"); }

    /* ---------- a cannon or a zip line: to the other map */
    if (ob.to) {
      this.grant(pl, "agility", lvl * G.THRILL.gateXp);
      this.moveToScene(pl, ob.to.scene, null, { x: ob.to.x, y: ob.to.y }); pl.dir = "south";
      return this.say(pl, ob.how === "cannon" ? `BOOM. You land in the net on ${G.sceneDef(ob.to.scene).name}.` : `You fly down the wire and drop off at ${G.sceneDef(ob.to.scene).name}.`, "good");
    }

    /* ---------- across */
    if (!G.walkableIn(S.g, a.far.x, a.far.y)) return this.say(pl, "Somebody's on the landing. Try again in a moment.", "bad");
    pl.x = a.far.x; pl.y = a.far.y; pl.step = null; pl.path = [];
    this.placeSafely(S, pl); this.touch(pl);
    if (!a.fwd) { if (ob.crs) pl.lap = null; return this.say(pl, "You go back the way you came."); }
    if (!ob.crs) { this.grant(pl, "agility", lvl * G.THRILL.gateXp); return this.say(pl, "You make it over.", "good"); }
    const R = G.THRILL.courses[ob.crs];
    this.grant(pl, "agility", Math.round(R.xp * (S.def.xpMul || 1)));
    /* the lap: the first stunt starts one; each next one in order carries it; anything else ends it */
    const L = pl.lap;
    if (ob.i === 0) pl.lap = { crs: ob.crs, next: 1, t0: now, at: now };
    else if (L && L.crs === ob.crs && L.next === ob.i && now - L.at < G.THRILL.lapGapMs) { L.next++; L.at = now; }
    else pl.lap = null;
    if (pl.lap && pl.lap.next === ob.n) {
      const ms = now - pl.lap.t0; pl.lap = null;
      this.grant(pl, "agility", Math.round(R.lap * (S.def.xpMul || 1)));
      (C.laps ||= {})[ob.crs] = (C.laps[ob.crs] | 0) + 1;
      const best = (C.bestLap ||= {})[ob.crs], pb = !best || ms < best; if (pb) C.bestLap[ob.crs] = ms;
      let mark = false; if (Math.random() < R.mark) { if (this.give(pl, "agilmark")) { this.gained(S, pl, "agilmark", 1, "agility"); mark = true; } }
      this.touch(pl); this.questCheck(pl);
      pl.out.push({ type: "lap", crs: ob.crs, ms, pb, n: C.laps[ob.crs] });
      return this.say(pl, `Lap ${C.laps[ob.crs].toLocaleString()} of ${R.name}: ${(ms / 1000).toFixed(1)} s${pb ? " (your best)" : ""}.${mark ? " A runner's mark!" : ""}`, "good");
    }
    return this.say(pl, pl.lap ? "Clean." : ob.i === 0 ? "Clean." : "Clean. (That one's out of order: a lap starts at the first stunt.)", "good");
  };

  /* ---------------------------------------------------------------- Fast Eddie */
  P.bookieBuy = function (S, pl, m) {
    if (G.HOLD.thrill && !pl.god) return;
    const C = pl.C, E = S.npcs.find((x) => x.opens === "bookie");
    if (!E || G.cheb(pl, E) > (E.reach || 3)) return this.say(pl, "You need to be standing with Fast Eddie.", "bad");
    const row = G.BOOKIE.find(([k]) => k === m.k); if (!row) return;
    const [k, price] = row, have = G.countItems({ inv: C.inv, bank: [] }, ["agilmark"]);
    if (have < price) return this.say(pl, `"${price} marks for that, kid. You've got ${have}."`, "bad");
    if (G.roomFor(C.inv, k, C) < 1) return this.say(pl, "Your bag is full.", "bad");
    G.takeInv(C.inv, "agilmark", price);
    this.give(pl, k, 1); this.touch(pl);
    return this.say(pl, `Fast Eddie counts the marks twice and hands over the ${G.ITEMS[k].name.toLowerCase()}. "Pleasure."`, "loot");
  };
}
