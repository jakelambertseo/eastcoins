/* ============================================================ THE GRIN (2026-10-02): the server's half of the third Yard raid. Read GRIN in the rules file first.
   raid.js keeps everything the raids share (the warning, the save, the share of the damage, the pool, the sack) and hands a grin raid's
   minute-by-minute here, the way it hands the Flood to floodTick. What is his alone:
     grinTick    he arrives, he throws his head, the head comes back, he rages
     grinHead    a head is hit down (killMob -> raidKill): the real one stuns him, a fake bursts into crows
     grinDark    the darkness the page draws (and grinSync tells every player when it changes)
   this.raid for a grin raid: { kind: "grin", phase, at, until, bossId, bossHp, bossMax, by, said, nextHead, head: { until } | null, rage } */
export function installGrin(World, { G }) {
  const P = World.prototype, R = G.RAID, Q = G.GRIN;
  const scene = (w) => w.scenes.get(Q.scene);
  const boss = (S, Rd) => { const m = S?.mobs.find((x) => x.id === Rd.bossId); return m && !m.dead ? m : null; };
  const heads = (S) => (S ? S.mobs.filter((m) => m.raid === "head" && !m.dead) : []);
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  /** what the page should draw over the Yard: "warn" | "dark" | "out" (his head is off) | "rage" | "lost" (a lost raid's 20 minutes) | null */
  P.grinDark = function (now = Date.now()) {
    const Rd = this.raid;
    if (Rd?.kind === "grin") return Rd.phase === "warn" ? "warn" : Rd.head ? "out" : Rd.rage ? "rage" : "dark";
    if (this.raidSack?.kind === "grin" && now < this.raidSack.until) return "lost";
    return null;
  };
  /* every player hears each change once (a few a raid), wherever they are: the page keeps it and draws it only in the Yard. A new login has
     seen nothing, so it hears the current state at once. */
  P.grinSync = function (now = Date.now()) {
    const d = this.grinDark(now);
    for (const p of this.pls.values()) if ((p.grinSeen ?? null) !== d) { p.grinSeen = d; p.out.push({ type: "grin", dark: d, scene: Q.scene }); }
  };

  P.grinTick = function (S, Rd, now) {
    if (Rd.resumed && this.pls.size) {
      Rd.resumed = false;
      const left = Math.max(1, Math.round(((Rd.phase === "warn" ? Rd.at : Rd.until) - now) / 60000));
      this.houseSay(Rd.phase === "warn" ? `\u{1F383} The world blinked, and the Yard's lamps are still flickering. The Grin is about ${left} minute${left === 1 ? "" : "s"} out.` : `\u{1F383} The world blinked, but he didn't: THE GRIN IS STILL IN THE YARD, ${left} minute${left === 1 ? "" : "s"} left. Everything you've done to him still counts.`);
    }
    if (Rd.phase === "warn") {
      for (const mk of Q.warnAt) if (!Rd.said[mk] && Rd.at - now <= mk * 1000 && Rd.at - now > 0) {
        Rd.said[mk] = true;
        this.houseSay(mk >= 60 ? `\u{1F383} The Yard's lamps are going out one at a time, from the north gate down. Something is laughing out past the river. ${mk / 60} minute${mk === 60 ? "" : "s"}.` : `\u{1F383} ${mk} SECONDS. Every pumpkin in the Yard has turned to face the north gate.`);
      }
      if (now < Rd.at || !S) return;
      Rd.phase = "on"; Rd.until = now + Q.lasts; Rd.nextHead = now + Q.head.first; this.raidGrid(S);
      Rd.bossId = this.raidPut(S, Q.boss.t, Q.boss.at[0], Q.boss.at[1], Q.hp, "boss", now); Rd.bossHp = Q.hp; Rd.bossMax = Q.hp; this.raidSave(now, true);
      this.houseSay(`\u{1F383} THE GRIN IS IN THE YARD. The last lamp went out and he was standing under it, smiling. ${Math.round(Q.lasts / 60000)} minutes. He keeps to the west bank. When he throws his head, nothing you do to him counts: FIND THE REAL ONE. It looks at you. The others don't.`);
      for (const p of this.playersIn(S)) this.say(p, "Something tall steps through the north gate. Its head swings from a chain at its side, and the head is laughing.", "bad");
      return;
    }
    if (!S) return;
    let bm = S.mobs.find((m) => m.id === Rd.bossId);
    if (bm && !bm.dead) Rd.bossHp = bm.hp;
    else if (!bm && now < Rd.until) {   /* the Yard was rebuilt under him (or the world restarted): put him back as he was, head on */
      Rd.bossId = this.raidPut(S, Q.boss.t, Q.boss.at[0], Q.boss.at[1], Math.max(1, Rd.bossHp || Q.hp), "boss", now); S.mobs.at(-1).maxHp = Rd.bossMax || Q.hp;
      Rd.head = null; Rd.nextHead = now + Q.head.first; bm = S.mobs.at(-1);
    }
    if (!S.raidG) this.raidGrid(S);
    if (now >= Rd.until) return this.raidLost(S, now);
    bm = boss(S, Rd); if (!bm) return;
    /* RAGE: once, at Q.rage of his health; his head comes off more often after it */
    if (!Rd.rage && bm.hp <= (bm.maxHp || Q.hp) * Q.rage) {
      Rd.rage = true;
      this.houseSay("\u{1FA78} THE GRIN IS HURT, and he has stopped smiling. The dark in the Yard has gone red. He throws his head more often now. Keep looking.");
    }
    /* THE HEAD, OFF: the real one watches whoever is nearest; nobody finds it in time and it rolls home */
    if (Rd.head) {
      const real = heads(S).find((m) => m.real);
      if (!real || now >= Rd.head.until) return this.grinHeadBack(S, Rd, bm, now, !real);
      const near = this.playersIn(S).filter((p) => p.x <= R.zoneX && !p.dead).sort((a, b) => G.cheb(a, real) - G.cheb(b, real))[0];
      if (near && near.x !== real.x) real.face = near.x > real.x ? 1 : -1;
      return;
    }
    if (now >= Rd.nextHead) this.grinThrow(S, Rd, bm, now);
  };

  /** HEADS WILL ROLL: the head comes off and lands among the fakes. He cannot be hurt till it's found or it comes back. */
  P.grinThrow = function (S, Rd, bm, now) {
    const H = Q.head, n = this.playersIn(S).length, fakes = Math.min(H.fakes[1], H.fakes[0] + Math.floor(n / H.perPlayers));
    const spots = [];
    for (let y = 0; y < G.ROWS; y++) for (let x = 0; x <= R.zoneX; x++) {
      const d = G.cheb({ x, y }, bm);
      if (d >= H.near[0] && d <= H.near[1] && G.walkableIn(S.raidG || S.g, x, y) && !this.occupied(S, x, y)) spots.push([x, y]);
    }
    if (spots.length < 2) { Rd.nextHead = now + 5000; return; }   /* boxed in: try again shortly */
    for (let i = spots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    const take = Math.min(spots.length, fakes + 1), realAt = Math.floor(Math.random() * take);
    for (let i = 0; i < take; i++) {
      const [x, y] = spots[i]; this.raidPut(S, "grinhead", x, y, 1, "head", now);
      const h = S.mobs.at(-1); Object.assign(h, { aggro: 0, perch: true, face: Math.random() < 0.5 ? 1 : -1 }); if (i === realAt) h.real = true;
    }
    Rd.head = { until: now + H.lasts }; bm.immune = true; bm.immTold = new Set(); bm.nm = "The Grin (headless)";
    Rd.nextHead = now + (Rd.rage ? H.rage : H.every);
    this.raidSave(now, true);
    this.houseSay(`\u{1F383} The Grin TEARS HIS HEAD OFF AND THROWS IT. It lands among ${take - 1} others in the grass. He can't be hurt until somebody finds the real one: it's the one that looks at you.`);
  };
  /** nobody found it (or the Yard lost it): it rolls back, he heals a little, and the fakes go */
  P.grinHeadBack = function (S, Rd, bm, now, lost) {
    for (const h of heads(S)) h.dead = true;
    S.mobs = S.mobs.filter((m) => m.raid !== "head"); S.whoSig = null;
    Rd.head = null; bm.immune = false; bm.nm = undefined;
    if (!lost) { const heal = Math.round((bm.maxHp || Q.hp) * Q.head.heal); bm.hp = Math.min(bm.maxHp || Q.hp, bm.hp + heal); Rd.bossHp = bm.hp;
      S.events.push({ type: "splat", who: bm.id, n: heal, kind: "heal", t: now });
      this.houseSay("\u{1F383} Nobody found it. The head rolls back across the grass on its own and climbs its chain, laughing, and The Grin looks better for it."); }
    this.raidSave(now, true);
  };
  /** from raidKill: a head was hit down */
  P.grinHead = function (S, m, pl, now) {
    const Rd = this.raid; if (!Rd || Rd.kind !== "grin") return;
    const bm = boss(S, Rd);
    if (m.real) {
      for (const h of heads(S)) h.dead = true;
      S.mobs = S.mobs.filter((x) => x.raid !== "head"); S.whoSig = null; Rd.head = null;
      if (bm) { bm.immune = false; bm.nm = undefined; bm.stunUntil = now + Q.head.stunMs; bm.dizzyUntil = now + Q.head.stunMs; bm.path = []; bm.target = null; }
      this.raidSave(now, true);
      this.houseSay(`\u{1F383} ${pl.name} FOUND THE REAL HEAD. It screams, the fakes burst into crows, and The Grin drops to his knees for ${Math.round(Q.head.stunMs / 1000)} seconds. HIT HIM NOW.`);
      return;
    }
    /* a fake: crows, all over whoever hit it */
    const dmg = Math.max(1, Math.round(G.maxHpOf(pl.C) * Q.head.crow));
    if (!pl.god) { pl.C.hp -= dmg; this.touch(pl); }
    S.events.push({ type: "splat", who: `p:${pl.id}`, n: dmg, kind: "hit", t: now });
    this.say(pl, "The head bursts into a shrieking cloud of crows, and they go for your face. Not that one.", "bad");
    if (pl.C.hp <= 0) this.die(pl, S, { mob: "a cloud of crows" });
  };
  /* nothing here may break the world's tick or a kill */
  for (const k of ["grinTick", "grinThrow", "grinHeadBack", "grinHead", "grinSync"]) {
    const f = P[k];
    P[k] = function (...a) { try { return f.apply(this, a); } catch (e) { console.error(k, e); } };
  }
}
