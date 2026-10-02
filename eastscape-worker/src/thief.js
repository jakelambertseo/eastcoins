/* ============================================================ THIEVING IN THE WORLD, AND SHORTCUTS: the server's half (2026-10-01, mockup 15).
   The rules are the THIEVING IN THE WORLD section at the end of the rules file (POCKETS, LOCKBOXES, WORLD_SC, WT): read that first.
   Everything here is off while HOLD.thief2 is on (the objects aren't even built, and these entry points refuse).

     wtStart   from startAct: turns a click into an act (a pocket, a lockbox, a shortcut) and says why not when it can't be
     wtAct     from doAction: one tick of that act once you're standing where it happens
     wtBuyPick the "lockpick" message: Vance sells them, 1,000 a pick

   A FAILED PICK ONLY STUNS (the owner: "it should only stun"): the same stun as the Guild, nothing lost, nothing attacks. */
export function installThief(World, { G }) {
  const P = World.prototype;
  const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const base = (S) => String(S.key).split(":")[0];

  /* ---------------------------------------------------------------- starting */
  P.wtStart = function (S, pl, m, f) {
    if (G.HOLD.thief2) return null;
    const C = pl.C;
    if (m.kind === "pick") {
      const mob = S.mobs.find((x) => x.id === m.id && !x.dead); if (!mob) return null;
      const lvl = G.POCKETS[mob.t]; if (!lvl) { this.say(pl, "Nothing in those pockets worth the trouble.", "bad"); return null; }
      return { kind: "pick", id: mob.id, x: mob.x, y: mob.y, name: G.MOBS[mob.t].name, reach: 1 };
    }
    const ob = S.objs[m.ob | 0]; if (!ob) return null;
    if (ob.t === "lockbox") return { kind: "lockbox", ob, x: ob.x, y: ob.y, name: ob.name, reach: 1 };
    if (ob.bw) {   /* a back way: walk to where you stand to use it */
      const bw = G.BACKWAYS[ob.bw], e = bw?.ends[ob.end]; if (!e) return null;
      return { kind: "backway", ob, bw: ob.bw, end: ob.end, x: e.stand[0], y: e.stand[1], name: bw.name, reach: 0 };
    }
    if (ob.sc) {
      const sc = G.WORLD_SC[ob.sc]; if (!sc) return null;
      /* walk to whichever side you can reach, nearest first; the far side is where you come out */
      const A = { x: sc.a[0], y: sc.a[1] }, B = { x: sc.b[0], y: sc.b[1] };
      const pa = f.x === A.x && f.y === A.y ? [] : G.findPath(S.g, f, A, 0), pb = f.x === B.x && f.y === B.y ? [] : G.findPath(S.g, f, B, 0);
      const useA = pa && (!pb || pa.length <= pb.length);
      if (!pa && !pb) { this.say(pl, "You can't get to that from here.", "bad"); return null; }
      const at = useA ? A : B, far = useA ? B : A;
      return { kind: "shortcut", ob, sc: ob.sc, x: at.x, y: at.y, far, name: sc.name, reach: 0 };
    }
    return null;
  };

  /* ---------------------------------------------------------------- one tick */
  P.wtAct = function (S, pl, a, now, faceIt) {
    const C = pl.C;
    if (G.HOLD.thief2) { pl.act = null; return; }
    if (pl.stunUntil > now) { pl.act = null; return this.say(pl, "You're still shaking that off. Give it a second."); }

    /* ---------- a pocket */
    if (a.kind === "pick") {
      const m = S.mobs.find((x) => x.id === a.id); if (!m || m.dead) { pl.act = null; return; }
      if (G.cheb(pl, m) > 1) { a.x = m.x; a.y = m.y; pl.path = G.findPath(S.g, pl, m, 1) || []; if (!pl.path.length) pl.act = null; return; }   /* it wandered: follow */
      const lvl = G.POCKETS[m.t], have = G.lvlOf(C, "thieving"), name = G.MOBS[m.t].name;
      if (have < lvl && !pl.god) { pl.act = null; return this.say(pl, `You'd never get near ${name.replace(/^The /, "the ")}'s pockets: Thieving ${lvl}, and you're ${have}.`, "bad"); }
      /* (2026-10-02, a player: "you can't pickpocket aggro mobs ... the one eyed ushers in boneyard") A THIEF ISN'T NOTICED. An aggressive monster
         that had spotted you counted as "in a fight" with you, so 14 of the 21 pocketed monsters could never be picked. Now only a REAL fight
         stops you: it is after somebody else, or it has swung at you (its claim) or been hit (hurtAt) in the last few seconds. One that had
         merely spotted you is calmed by the pick, and the aggro check leaves you alone while you work it (index.js). Caught, and it comes for you. */
      const fighting = (m.target && m.target !== pl.id) || (m.claim && m.claim.until > now) || now - (m.hurtAt || 0) < 5000;
      if (fighting) { pl.act = null; return this.say(pl, `${name} is in a fight. Not now.`, "bad"); }
      if (m.target === pl.id) { m.target = null; m.path = []; m.step = null; }
      if (m.outUntil > now) { pl.act = null; return this.say(pl, `${name}'s pockets are already turned out. Give it a minute.`); }
      faceIt();
      const ms = Math.round(G.THIEF.ms / (1 + G.swingFx(C)));
      if (!a.started) { a.started = now; a.next = now + ms; return this.say(pl, `You fall into step behind ${name.replace(/^The /, "the ")}.`); }
      if (now < a.next) return;
      pl.act = null;
      if (Math.random() < G.pickChance(C, lvl, G.fxOf(C).steal)) {
        const got = G.pocketDrop(m.t), names = [];
        for (const k of got) { if (!this.give(pl, k)) break; this.gained(S, pl, k, 1, "thieving"); names.push(G.ITEMS[k].name.toLowerCase()); }
        if (Math.random() < G.workPerk(C, "thieving", "pick2")) for (const k of G.pocketDrop(m.t)) { if (!this.give(pl, k)) break; this.gained(S, pl, k, 1, "thieving"); names.push(G.ITEMS[k].name.toLowerCase()); }   /* (2026-10-01) the Ditched set: picked twice */
        this.workRoll(pl, "feller", 1 / 400);   /* (2026-10-01) the Feller's flannels, lifted from a pocket */
        m.outUntil = now + G.WT.outMs;
        this.diaryNote(pl, `pk:${m.t}`); this.diaryNote(pl, `pkm:${base(S)}`);   /* (2026-10-01) the diaries' pocket tasks */
        this.grant(pl, "thieving", Math.round(G.pocketXp(m.t) * (S.def.xpMul || 1))); this.questCheck(pl);
        S.events.push({ type: "picked", id: m.id, until: m.outUntil });
        return this.say(pl, names.length ? `You lift ${names.join(" and ")} off ${name.replace(/^The /, "the ")}.` : `Nothing in there you could carry.`, "good");
      }
      pl.stunUntil = now + rint(G.THIEF.stun[0], G.THIEF.stun[1]);
      pl.out.push({ type: "caught", until: pl.stunUntil });
      if (m.aggro ?? G.MOBS[m.t]?.aggro) m.target = pl.id;   /* (2026-10-02) caught by an aggressive one: now it comes for you */
      return this.say(pl, `${name} feels a hand in a pocket and shoves you off. You're stunned.`, "bad");
    }

    /* ---------- a lockbox */
    if (a.kind === "lockbox") {
      const ob = a.ob, key = base(S), lvl = ob.lvl | 0, have = G.lvlOf(C, "thieving");
      if (have < lvl && !pl.god) { pl.act = null; return this.say(pl, `A lockbox like this wants Thieving ${lvl}. You're ${have}.`, "bad"); }
      const cd = (C.boxes ||= {})[key] || 0;
      if (cd > now) { pl.act = null; return this.say(pl, `You've had this one. It's yours again in ${Math.ceil((cd - now) / 60000)} min.`); }
      if (G.countItems({ inv: C.inv, bank: [] }, ["lockpick"]) < 1) { pl.act = null; return this.say(pl, `You need a lockpick. Vance in the Gloam sells them, ${G.fmtTix(G.WT.lockpick)} each.`, "bad"); }
      faceIt();
      const ms = Math.round(G.WT.box.ms / (1 + G.swingFx(C)));
      if (!a.started) { a.started = now; a.next = now + ms; return this.say(pl, "You set a pick in the lock."); }
      if (now < a.next) return;
      pl.act = null;
      G.takeInv(C.inv, "lockpick", 1); this.touch(pl);   /* one pick a try, open or not */
      if (Math.random() < G.pickChance(C, lvl, G.fxOf(C).steal)) {
        const mark = G.markAtLvl(lvl), names = [];
        for (let i = 0; i < G.WT.box.rolls; i++) { const k = G.markDrop(mark); if (!this.give(pl, k)) break; this.gained(S, pl, k, 1, "thieving"); names.push(G.ITEMS[k].name.toLowerCase()); }
        if (Math.random() < G.WT.box.key && this.give(pl, "skeleton_key")) names.push("a skeleton key");
        C.boxes[key] = now + G.WT.box.cdMs; this.diaryNote(pl, `lb:${key}`);   /* (2026-10-01) the diaries' lockbox tasks */
        this.grant(pl, "thieving", Math.round(G.guildXpAt(lvl) * G.WT.box.xpMul)); this.questCheck(pl);
        return this.say(pl, `The lockbox clicks open: ${names.join(", ") || "nothing you could carry"}. It's yours again in 15 min.`, "loot");
      }
      pl.stunUntil = now + rint(G.THIEF.stun[0], G.THIEF.stun[1]);
      pl.out.push({ type: "caught", until: pl.stunUntil });
      return this.say(pl, "The pick snaps and the lock bites back. You're stunned.", "bad");
    }

    /* ---------- a back way: across the world */
    if (a.kind === "backway") {
      const bw = G.BACKWAYS[a.bw], to = bw?.ends[1 - a.end]; if (!to) { pl.act = null; return; }
      if (pl.x !== a.x || pl.y !== a.y) { pl.path = G.findPath(S.g, pl, a, 0) || []; if (!pl.path.length) pl.act = null; return; }
      const have = G.lvlOf(C, "agility");
      if (have < bw.lvl && !pl.god && !(a.bw === "stormdrain" && G.diaryHas(C, "plus", "drain"))) {   /* (2026-10-01) the Thunderhead's Elite diary: the Storm Drain needs no level */ pl.act = null; return this.say(pl, `${bw.name}: Agility ${bw.lvl}, and you're ${have}.`, "bad"); }
      if (!a.started) { a.started = now; a.next = now + G.WT.backway.ms; return this.say(pl, `You ${G.SC_VERB[bw.how] || "go through"}...`); }
      if (now < a.next) return;
      pl.act = null;
      if (Math.random() < G.slipChance(C, bw.lvl)) return this.say(pl, "You lose your footing and end up back where you started.", "bad");
      this.grant(pl, "agility", bw.lvl * G.WT.backway.xpMul); this.diaryNote(pl, `bw:${a.bw}`);   /* (2026-10-01) diaries */ this.workRoll(pl, "prospector", 1 / 150);   /* (2026-10-01) the Prospector's kit */
      this.moveToScene(pl, to.scene, null, { x: to.stand[0], y: to.stand[1] });
      return this.say(pl, `${bw.name} brings you out in ${G.sceneDef(to.scene).name.replace(/^The /, "the ")}.`, "good");
    }

    /* ---------- a shortcut */
    if (a.kind === "shortcut") {
      const sc = G.WORLD_SC[a.sc]; if (!sc) { pl.act = null; return; }
      if (pl.x !== a.x || pl.y !== a.y) { pl.path = G.findPath(S.g, pl, a, 0) || []; if (!pl.path.length) pl.act = null; return; }
      const have = G.lvlOf(C, "agility");
      if (have < sc.lvl && !pl.god) { pl.act = null; return this.say(pl, `${sc.name}: Agility ${sc.lvl}, and you're ${have}.`, "bad"); }
      const ms = G.WT.cross.ms + Math.max(0, G.scHop(sc) - 2) * G.WT.cross.perTile;
      if (!a.started) {
        a.started = now; a.next = now + ms;
        pl.dir = G.DIRS[`${Math.sign(a.far.x - pl.x)},${Math.sign(a.far.y - pl.y)}`] || pl.dir;
        pl.out.push({ type: "cross", ms, from: { x: pl.x, y: pl.y }, to: a.far });
        return this.say(pl, `You ${G.SC_VERB[sc.how] || "go over"}...`);
      }
      if (now < a.next) return;
      pl.act = null;
      if (Math.random() < G.slipChance(C, sc.lvl)) return this.say(pl, "You slip and scramble back to where you started.", "bad");
      if (!G.walkableIn(S.g, a.far.x, a.far.y)) return this.say(pl, "Something's in the way on the other side. Try again in a moment.", "bad");
      pl.x = a.far.x; pl.y = a.far.y; pl.step = null; pl.path = [];
      this.placeSafely(S, pl); this.touch(pl);
      this.grant(pl, "agility", sc.lvl * G.WT.cross.xpMul); this.diaryNote(pl, `sc:${a.sc}`);   /* (2026-10-01) diaries */ this.workRoll(pl, "prospector", 1 / 150);   /* (2026-10-01) the Prospector's kit */
      return this.say(pl, "You make it across.", "good");
    }
  };

  /* ---------------------------------------------------------------- Vance's lockpicks */
  P.wtBuyPick = function (S, pl, m) {
    if (G.HOLD.thief2) return;
    const C = pl.C, V = S.npcs.find((x) => x.opens === "permit");
    if (!V || G.cheb(pl, V) > (V.reach || 3)) return this.say(pl, "You need to be standing with Vance.", "bad");
    const n = Math.max(1, Math.min(25, m.n | 0 || 1)), price = n * Math.round(G.WT.lockpick * (1 - G.diaryOff(C, "lockpick"))), have = G.tixIn(C);
    if (have < price) return this.say(pl, `"${G.fmtTix(price)} for ${n}. You've got ${G.fmtTix(have)}."`, "bad");
    if (G.roomFor(C.inv, "lockpick", C) < n) return this.say(pl, "Your bag is full.", "bad");
    G.takeInv(C.inv, "tickets", price); this.trkTix(pl, -price, "lockpick");
    this.give(pl, "lockpick", n);
    return this.say(pl, `Vance counts out ${n === 1 ? "a lockpick" : `${n} lockpicks`}. "They snap. That's the business."`, "loot");
  };
}
