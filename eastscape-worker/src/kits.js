/* ============================================================ FIELD KITS (2026-10-02, v1.2): the server's half. Read FIELD KITS in the rules file first.
     kitUse        a kit or a snare used from the bag (useSpecial hands them here)
     kitTickBuff   the running kit's clock, beside the page buff's (only outside, the same rule)
     kitMarkMul    Hunter's Mark: how much harder a bow hits the marked kind of monster (accuracy and damage)
     kitRetrieve   the Arrow retriever: an arrow that landed may come back
     kitBreakCamo  Hunter's camo ends the moment you start a fight
     kitGrapple*   archery's shortcuts: walk to the post, fire a grapple arrow, cross
     kitSnare*     set a snare where you stand; come back in an hour and check it
     kitBowfish    bowfishing: a catch from range costs a fishing arrow, and sometimes lands two
   Everything does nothing while HOLD.kits is on. */
export function installKits(World, { G }) {
  const P = World.prototype;
  const has = (C, k) => (C.inv || []).reduce((n, s) => n + (s.k === k ? s.n | 0 : 0), 0);
  const takeOne = (C, k) => { const i = C.inv.findIndex((s) => s.k === k && (s.n | 0) > 0); if (i < 0) return false; C.inv[i].n--; if (!C.inv[i].n) C.inv.splice(i, 1); return true; };
  const isOut = (key) => { const d = G.sceneDef(key); return !!(d && !d.interior && !d.island && !d.home && (d.mobs?.length) && !/^(crypt|tower|pyramid|count):/.test(String(key))); };

  P.kitUse = function (pl, st, it, take) {
    if (G.HOLD.kits) return;
    const C = pl.C, now = Date.now(), need = it.useReq;
    if (need && G.lvlOf(C, need.skill) < need.lvl && !pl.god) return this.say(pl, `${it.name}: Archery ${need.lvl} to use, and you're ${G.lvlOf(C, need.skill)}.`, "bad");
    if (it.use === "snare") return this.kitSnareSet(pl, take);
    const k = it.kit, K = G.FIELD_KITS[k]; if (!K) return;
    let t = null;
    if (k === "mark") {   /* the kind of monster you're fighting, or the nearest one in sight */
      const S = this.scenes.get(C.scene), cur = pl.act?.kind === "mob" ? S?.mobs.find((m) => m.id === pl.act.id && !m.dead) : null;
      const near = cur || (S?.mobs || []).filter((m) => !m.dead && !G.MOBS[m.t]?.bag && !G.MOBS[m.t]?.head && G.cheb(pl, m) <= 8).sort((a, b) => G.cheb(pl, a) - G.cheb(pl, b))[0];
      if (!near) return this.say(pl, "Mark what? Use it while you're fighting something, or with one in sight.", "bad");
      t = near.t;
    }
    const was = C.kit && (C.kit.left | 0) > 0 ? G.FIELD_KITS[C.kit.k]?.name : null, tier = G.kitTier(C), mins = K.mins[tier - 1];
    take(); C.kit = { k, left: mins * 60000, tier, ...(t ? { t } : {}) }; this.touch(pl);
    pl.out.push({ type: "kitfx", k });
    return this.say(pl, `${K.name} (tier ${"I".repeat(tier)}): ${K.what(K.vals[tier - 1])}${t ? ` (${G.MOBS[t].name})` : ""}, for ${mins} minutes outside.${was && was !== K.name ? ` It replaces your ${was}.` : ""}`, "good");
  };
  /** the running kit's clock (called from the buff loop, where the page buff's runs) */
  P.kitTickBuff = function (pl, dt) {
    const C = pl.C; if (!C.kit) return;
    if (!G.FIELD_KITS[C.kit.k]) { C.kit = null; return; }
    C.kit.left = (C.kit.left | 0) - dt;
    if (C.kit.left <= 0) { this.say(pl, `Your ${G.FIELD_KITS[C.kit.k].name.replace(/^Hunter's /, "")} has worn off.`); C.kit = null; }
    this.touch(pl);
  };
  P.kitMarkMul = function (C, m) { return C.kit?.k === "mark" && C.kit.t === m.t && G.holdsBow(C) ? 1 + G.kitOf(C, "mark") / 100 : 1; };
  P.kitRetrieve = function (pl, dmg) {
    const C = pl.C, v = G.kitOf(C, "retriever"); if (!v || !(dmg > 0) || !G.holdsBow(C) || !C.quiver) return;
    if (Math.random() < v / 100) C.quiver.n = Math.floor(C.quiver.n) + 1;
  };
  P.kitBreakCamo = function (pl) {
    const C = pl.C; if (C.kit?.k !== "camo" || !(C.kit.left > 0)) return;
    C.kit = null; this.touch(pl); this.say(pl, "You throw off your camo and draw.");
  };

  /* ---------------------------------------------------------------- GRAPPLE POINTS */
  P.kitGrappleStart = function (S, pl, ob) {
    const gp = G.GRAPPLES[ob.gp]; if (!gp) return null;
    const [x, y] = ob.end ? gp.b : gp.a;
    return { kind: "grapple", ob, gp: ob.gp, end: ob.end, x, y, name: gp.name, reach: 0 };
  };
  P.kitAct = function (S, pl, a, now) {
    const C = pl.C;
    if (a.kind === "grapple") {
      const gp = G.GRAPPLES[a.gp]; if (!gp) { pl.act = null; return; }
      if (pl.x !== a.x || pl.y !== a.y) { pl.path = G.findPath(S.g, pl, a, 0) || []; if (!pl.path.length) pl.act = null; return; }
      if (!a.started) {
        const have = G.lvlOf(C, "archery");
        if (have < gp.lvl && !pl.god) { pl.act = null; return this.say(pl, `${gp.name}: Archery ${gp.lvl}, and you're ${have}.`, "bad"); }
        if (!G.holdsBow(C)) { pl.act = null; return this.say(pl, "You'll want a bow in your hands to fire a grapple arrow.", "bad"); }
        if (!has(C, "grapple_arrow")) { pl.act = null; return this.say(pl, "You need a grapple arrow. They're made at the fletching table (Fletching 40).", "bad"); }
        takeOne(C, "grapple_arrow"); this.touch(pl);
        const to = a.end ? gp.a : gp.b, ms = G.grappleMs(gp);
        a.started = now; a.next = now + ms; a.to = { x: to[0], y: to[1] };
        pl.dir = G.DIRS[`${Math.sign(to[0] - pl.x)},${Math.sign(to[1] - pl.y)}`] || pl.dir;
        pl.out.push({ type: "cross", ms, from: { x: pl.x, y: pl.y }, to: a.to });
        return this.say(pl, "You fire the grapple, the hook bites, and you swing across...");
      }
      if (now < a.next) return;
      pl.act = null;
      if (!G.walkableIn(S.g, a.to.x, a.to.y)) return this.say(pl, "Something's in the way on the other side. The rope's still there: try again in a moment.", "bad");
      pl.x = a.to.x; pl.y = a.to.y; pl.step = null; pl.path = []; this.placeSafely(S, pl); this.touch(pl);
      this.grant(pl, "archery", Math.round(gp.lvl * 1.5));
      return this.say(pl, "You make it across.", "good");
    }
    if (a.kind === "snare") return this.kitSnareCheck(S, pl, a, now);
  };

  /* ---------------------------------------------------------------- SNARES */
  const snaresOf = (C) => (Array.isArray(C.snares) ? C.snares.filter((s) => s && typeof s.s === "string" && Number.isInteger(s.x) && Number.isInteger(s.y) && Number.isFinite(s.at)) : []);
  P.kitSnareSet = function (pl, take) {
    const C = pl.C, key = C.scene, S = this.scenes.get(key), list = snaresOf(C);
    if (!isOut(key)) return this.say(pl, "Snares go out where things live: a map with monsters on it.", "bad");
    if (!S || !G.walkableIn(S.g, pl.x, pl.y)) return this.say(pl, "Not here.", "bad");
    if (list.filter((s) => s.s === key).length >= G.SNARE.perMap) return this.say(pl, `You've got ${G.SNARE.perMap} snares out on this map already.`, "bad");
    if (list.length >= G.SNARE.max) return this.say(pl, `You've got ${G.SNARE.max} snares out across the world. Check some first.`, "bad");
    if (list.some((s) => s.s === key && s.x === pl.x && s.y === pl.y)) return this.say(pl, "There's already one of yours right here.", "bad");
    take(); list.push({ s: key, x: pl.x, y: pl.y, at: Date.now() }); C.snares = list; this.touch(pl);
    return this.say(pl, "You set the snare and cover it with leaves. Come back in an hour.", "good");
  };
  P.kitSnareStart = function (S, pl, m) {
    const x = m.x | 0, y = m.y | 0, s = snaresOf(pl.C).find((q) => q.s === pl.C.scene && q.x === x && q.y === y);
    if (!s) return null;
    return { kind: "snare", x, y, name: "Your snare", reach: 1 };
  };
  P.kitSnareCheck = function (S, pl, a, now) {
    const C = pl.C, list = snaresOf(C), i = list.findIndex((q) => q.s === C.scene && q.x === a.x && q.y === a.y);
    pl.act = null;
    if (i < 0) return;
    const s = list[i], ms = this.env?.DEV === "1" ? 60000 : G.SNARE.ms;   /* a dev server checks after a minute, so it can be tried */
    if (now - s.at < ms) return this.say(pl, `Nothing in it yet. Give it ${Math.ceil((ms - (now - s.at)) / 60000)} more minute${Math.ceil((ms - (now - s.at)) / 60000) === 1 ? "" : "s"}.`);
    const L = G.snareLoot(C.scene), got = [];
    for (const [k, n] of L.items) if (this.give(pl, k, n)) got.push(`${n > 1 ? n + " " : ""}${G.ITEMS[k].name.toLowerCase()}`);
    list.splice(i, 1); C.snares = list; this.touch(pl);
    this.grant(pl, "archery", L.xp);
    return this.say(pl, `You check the snare: ${got.join(", ") || "it was empty, and somebody's had the bait"}. You take it up.`, "loot");
  };

  /* ---------------------------------------------------------------- BOWFISHING */
  P.kitBowfishOk = function (C) { return !G.HOLD.kits && G.holdsBow(C) && G.lvlOf(C, "archery") >= G.BOWFISH.use && has(C, "fishing_arrow") > 0; };
  P.kitBowfish = function (pl, fish, xp) {
    const C = pl.C;
    takeOne(C, "fishing_arrow");
    if (Math.random() < G.BOWFISH.double && this.give(pl, fish)) this.say(pl, "The arrow goes through two of them.", "good");
    this.grant(pl, "archery", Math.max(1, Math.round(xp * G.BOWFISH.xpShare)));
    if (!has(C, "fishing_arrow")) { pl.act = null; this.say(pl, "That was your last fishing arrow.", "bad"); }
    this.touch(pl);
  };
  for (const k of ["kitUse", "kitTickBuff", "kitRetrieve", "kitBreakCamo", "kitGrappleStart", "kitAct", "kitSnareSet", "kitSnareStart", "kitSnareCheck", "kitBowfish"]) {
    const f = P[k]; P[k] = function (...a) { try { return f.apply(this, a); } catch (e) { console.error(k, e); return null; } };
  }
}
