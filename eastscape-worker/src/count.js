/* ============================================================
   THE COUNT ROOM: the game server's side. The rules, the map and the numbers are
   v3/assets/js/eastscape-count-rules.js; the Crypt (crypt.js) is the same shape and this file deliberately
   mirrors it, because index.js already knows how to run a party and a private scene copy.

   The owner, 2026-09-25: "Kill x amount of mobs to beat it ... what if there were 4 treasure chests users had
   to unlock with keys they found around the map?"

   WHAT IS DIFFERENT FROM THE CRYPT, in one line each, because the differences are the whole point:

     THERE IS NO BOSS AND NOTHING TO CLEAR. A quota. The house keeps coming out of four service doors for as
     long as you are in the room, one at a time, faster as the quota fills. The way out unlocks at the number.
     THE PARTY SYSTEM IS BORROWED WHOLE. partyOf / partyTell / partyLeave / partyBack all live on World.prototype
     already (crypt.js installs them); a second copy of any of that would be a second thing to keep in step.
     THE LOOT IS FOUR SMALL CHESTS INSTEAD OF ONE BIG ONE, and it is paid ON THE SPOT rather than written to
     the character for an end-of-run chest. There is no end-of-run moment here to hang one on.
     AND THE KEYS ARE RUN STATE, NOT ITEMS. A key that were an item could be banked, traded, or carried into the
     next run, and then the hunt would be something you do once. They live and die with the run.

   THE MONEY PATH IS THE CRYPT'S, through World.dungeonOwe, so the day counter, the carry penalty and the
   three-paid-runs rule cannot drift from the other two dungeons.
   ============================================================ */
export function installCount(World, { G, R, rint }) {
  const C_ = R.COUNT, P = World.prototype;
  const inCount = (pl) => String(pl.C.scene).startsWith("count:");
  const dayOf = () => G.chicagoDay();
  const pickW = (list, r) => { const tot = list.reduce((a, [, w]) => a + w, 0); let x = r() * tot; for (const [k, w] of list) if ((x -= w) < 0) return k; return list[list.length - 1][0]; };

  /* ------------------------------------------------------------ the door */
  P.countRunsToday = function (pl) { const c = pl.C.count; return c && c.day === dayOf() ? c.n | 0 : 0; };
  P.countDoor = function (S, pl) {
    const pt = this.partyOf(pl);
    pl.out.push({ type: "count", runsToday: this.countRunsToday(pl), party: pt ? this.partyView(pt) : null,
      solo: !!pl.admin, lvl: C_.lvl, rec: C_.rec, ante: C_.ante, pay: C_.pay, keys: C_.keys,
      open: [...this.scenes.keys()].filter((k) => k.startsWith("count:")).length });
  };
  P.countEnter = function (S, pl) {
    const bad = (t) => this.say(pl, t, "bad");
    if (String(S.key) !== C_.door.scene || G.cheb(pl, C_.door) > 6) return bad("The service door is off the casino floor.");
    let pt = this.partyOf(pl); const solo = !pt && pl.admin;   /* an admin may go in alone to test it, exactly as the Crypt allows */
    if (!pt && !solo) return bad(`The count room takes a party of ${C_.party[0]} to ${C_.party[1]}. Click a player and invite them.`);
    if (pt && pt.leader !== pl.id) return bad("Your party's leader opens the door.");
    const ids = pt ? pt.members : [pl.id], mem = ids.map((id) => this.pls.get(id));
    if (pt && (ids.length < C_.party[0] || ids.length > C_.party[1])) return bad(`The count room takes a party of ${C_.party[0]} to ${C_.party[1]}.`);
    /* NOBODY PAYS UNLESS EVERYBODY CAN. Checked in full before a single ticket moves, the way the Crypt does it:
       a half-charged party is the one bug in this whole path that would actually cost somebody money. */
    for (const p of mem) {
      if (!p || p.C.scene !== S.key || G.cheb(p, C_.door) > 6) return bad(`${p ? p.name : "Somebody"} isn't at the door yet. Everybody goes in together.`);
      if (G.lvlOf(p.C, "melee") < C_.lvl && !p.admin) return bad(`The count room wants Combat ${C_.lvl}. ${p.name} isn't there yet.`);
      if (G.tixIn(p.C) < C_.ante) return bad(`The ante is ${G.fmtTix(C_.ante)} each. ${p === pl ? "You have" : `${p.name} has`} ${G.fmtTix(G.tixIn(p.C))}.`);
    }
    if ([...this.scenes.keys()].filter((k) => k.startsWith("count:")).length >= C_.maxRuns) return bad("Every count room is busy. Give it a minute.");

    const key = `count:${Date.now().toString(36)}${rint(10, 99)}`;
    const seed = `${key}:${rint(100000, 999999)}`;
    for (const p of mem) {
      G.takeInv(p.C.inv, "tickets", C_.ante);
      p.C.count = { ...(p.C.count && p.C.count.day === dayOf() ? p.C.count : { day: dayOf(), n: 0 }), run: key, ante: C_.ante };
      this.touch(p);
    }
    const S2 = this.scene(key);
    const quota = C_.quota(ids.length);
    S2.run = { members: [...ids], started: Date.now(), seed, quota, done: 0, kills: {}, died: {}, keys: 0, found: 0,
      spots: R.keySpots(seed).reduce((m, s) => (m[s.i] = true, m), {}), searched: {}, boxes: [false, false, false, false],
      open: false, paid: {}, nextSpawn: Date.now() + 1500, doorAt: 0, party: pt ? pt.id : null, seq: 0 };
    for (const p of mem) {
      this.moveToScene(p, key, null, S2.def.entry);
      this.say(p, `The count room. ${G.fmtTix(C_.ante)} on the door. Put down ${quota} of the house and the way out unlocks. ${C_.keys} keys are in the lockers — find them and the deposit boxes are yours.`, "good");
    }
    this.countTell(S2);
  };

  /* ------------------------------------------------------------ inside */
  /** the HUD: how far along the quota is, how many keys are in hand, which boxes are done */
  P.countView = function (S) {
    const r = S.run;
    return { type: "countstate", done: r.done, quota: r.quota, keys: r.keys, found: r.found, total: C_.keys,
      boxes: r.boxes, open: r.open, met: !!r.met, alive: S.mobs.filter((m) => !m.dead).length, searched: Object.keys(r.searched).length, spots: C_.spots.length };
  };
  P.countTell = function (S) { const msg = this.countView(S); for (const p of this.playersIn(S)) p.out.push(msg); };

  /** once a tick: the four doors take turns, one monster per gap, and the gap tightens as the quota fills */
  P.countSpawn = function (S, now) {
    const r = S.run; if (!r || r.met) return;                        // the doors stop the moment the quota is FILLED, not when the way out opens: the last stretch is clearing what is already on the floor, and a door still feeding it would make that stretch endless
    if (now < r.nextSpawn) return;
    const alive = S.mobs.filter((m) => !m.dead).length;
    /* THE CEILING IS NOT A DELAY. If the floor is already full the timer is pushed on rather than banked, or a
       party that fell behind would be hit by every spawn it missed the moment they caught up. */
    r.nextSpawn = now + R.spawnGap(r.done, r.quota);
    if (alive >= C_.alive) return;
    const d = C_.doors[r.doorAt % C_.doors.length]; r.doorAt++;
    const t = pickW(R.WAVE, Math.random), def = G.MOBS[t]; if (!def) return;
    const spot = this.countFreeNear(S, d.x, d.y); if (!spot) return;
    S.mobs.push({ id: `${S.key}s${r.seq++}`, t, x: spot.x, y: spot.y, hx: spot.x, hy: spot.y,
      hp: def.hp, maxHp: def.hp, path: [], step: null, face: 1, nextWander: 0, dead: false,
      respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: now });
    S.whoSig = null;   /* the roster changed; the page is told who is in the room off this */
  };
  /** the first free square at or beside a door — a monster must never be born inside a wall or on somebody */
  P.countFreeNear = function (S, x, y) {
    for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (G.walkableIn(S.g, nx, ny) && !this.occupied(S, nx, ny, null)) return { x: nx, y: ny };
    }
    return null;
  };

  P.countKill = function (S, pl, m, now) {
    const r = S.run; m.dead = true; m.claim = null; m.respawnAt = Infinity; pl.act = null;
    this.emit(pl, "kill", { mob: m.t });
    if (!r || r.open) return;
    r.done++; r.kills[pl.id] = (r.kills[pl.id] || 0) + 1;
    if (r.done >= r.quota && !r.met) {
      r.met = true;   /* the doors stop here; the way out waits for the floor (countFloor, on the tick) */
      for (const p of this.playersIn(S)) this.say(p, `That's ${r.quota}. The doors have stopped — now finish what is still standing.`, "good");
    }
    if (r.met && !r.open && !S.mobs.some((m) => !m.dead)) this.countFloorClear(S);
    if (!r.met && r.done % 25 === 0) {
      for (const p of this.playersIn(S)) this.say(p, `${r.done} of ${r.quota}.`);
    }
    this.countTell(S);
  };

  /** the quota is filled AND nothing is left standing: NOW the way out opens */
  P.countFloorClear = function (S) {
    const r = S.run; if (!r || r.open) return;
    r.open = true;
    this.reportEnd(S, "count", "clear", { title: "The Count Room" });   /* (2026-09-28) the run report: the job is done when the floor is */
    for (const p of this.playersIn(S)) this.say(p, "The floor is clear. The way out is open — but the boxes are still down here.", "good");
    const left = C_.keys - r.boxes.filter(Boolean).length;
    if (left > 0) for (const p of this.playersIn(S)) this.say(p, `${left} deposit box${left === 1 ? "" : "es"} still shut. Nobody is making you leave.`);
    this.countTell(S);
  };

  /** a locker: four of the sixteen hold a key, and which four came from the run's seed before anybody touched one */
  P.countSearch = function (S, pl, ob) {
    const r = S.run; if (!r) return;
    const i = ob.spot | 0;
    if (r.searched[i]) return this.say(pl, "You have already been through that one.");
    r.searched[i] = true;
    if (r.spots[i]) {
      r.keys++; r.found++;
      for (const p of this.playersIn(S)) this.say(p, `${pl.name} finds a key. ${r.keys} in hand, ${C_.keys - r.found} still hidden.`, "loot");
    } else {
      this.say(pl, "Paperwork, a mug, somebody's coat. No key.");
    }
    this.countTell(S);
  };

  /** a deposit box: one key, and then a roll each for everybody standing in the room */
  P.countBox = function (S, pl, ob) {
    const r = S.run; if (!r) return;
    const i = ob.box | 0;
    if (r.boxes[i]) return this.say(pl, "That one is already open.");
    if (r.keys < 1) return this.say(pl, `Locked, and you have no key. ${C_.keys - r.found} are still in the lockers.`, "bad");
    r.keys--; r.boxes[i] = true;
    const here = this.playersIn(S), late = this.countRunsToday(pl) >= C_.runsPaid;
    /* EARLIER IS WORTH MORE. One multiplier for the whole box, worked out once from how long the run has been
       going, so everybody in the room gets the same number and nobody can argue the toss. */
    const mult = R.boxMult(Date.now() - r.started);
    for (const p of here) this.countGive(p, { pay: C_.pay, late, mult }, i);
    for (const p of here) this.say(p, `${pl.name} opens deposit box ${i + 1}. ${r.boxes.filter(Boolean).length} of ${C_.keys}.`, "loot");
    this.countTell(S);
  };
  /** one box's roll for one player, paid on the spot: there is no end-of-run chest here to hold it */
  P.countGive = function (pl, loot, boxNo) {
    const { items } = R.rollBox(loot);
    const fast = (loot.mult || 1) >= 1.25;
    const got = [];
    for (const it of items) {
      if (it.k === "tickets") { this.tixTo(pl, it.n); got.push(it); continue; }
      if (!G.ITEMS[it.k]) continue;
      const where = this.keepRare(pl, it.k, it.n);
      if (where) got.push({ ...it, bank: where === "bank" || undefined });
    }
    const names = got.filter((x) => x.k !== "tickets").map((x) => `${x.n > 1 ? x.n + " x " : ""}${G.ITEMS[x.k].name}`);
    const tix = got.find((x) => x.k === "tickets");
    this.say(pl, `Box ${boxNo + 1}: ${tix ? G.fmtTix(tix.n) : ""}${tix && names.length ? ", " : ""}${names.join(", ")}.${got.some((x) => x.bank) ? " (No room in your bag: it's in your bank.)" : ""}`, "loot");
    if (fast) this.say(pl, `Quick work: that box paid ${Math.round(((loot.mult || 1) - 1) * 100)}% over the odds.`, "good");
    pl.out.push({ type: "countloot", box: boxNo, items: got, mult: loot.mult || 1 });
  };

  /** the way out. It pays, once each, and only once the quota is filled. */
  P.countExit = function (S, pl, ob) {
    const r = S.run; if (!r) return;
    /* THE BACK STAIRS ARE ALWAYS OPEN AND PAY NOTHING (the owner: "add a staircase near the back incase someone
       gets locked in there"). A room you can be shut inside because a rule did not fire the way anybody expected
       is far worse than a room with an unglamorous way out of it, and paying nothing is what stops it becoming
       the way everybody leaves. */
    if (ob && ob.bolt) {
      this.moveToScene(pl, C_.door.scene, null, C_.door);
      return this.say(pl, r.open ? "You take the back stairs. Nothing for the job — the way out was right there." : "You slip out the back with nothing. The job is somebody else's problem now.", "bad");
    }
    if (!r.open) return this.say(pl, r.met ? `Locked until the floor is clear. ${S.mobs.filter((m) => !m.dead).length} still standing.` : `Locked from the other side. ${r.quota - r.done} to go.`, "bad");
    this.countPayOne(S, pl);
    this.moveToScene(pl, C_.door.scene, null, C_.door);
    this.say(pl, "You step out onto the floor like you belong there.", "good");
  };
  P.countPayOne = function (S, pl) {
    const r = S.run; if (!r || !r.open || r.paid[pl.id] || !r.members.includes(pl.id)) return;
    r.paid[pl.id] = true;
    const total = Object.values(r.kills).reduce((a, b) => a + b, 0) || 1;
    const share = (r.kills[pl.id] || 0) / total, runs = this.countRunsToday(pl);
    /* THE ARITHMETIC IS THE CRYPT'S, through dungeonOwe, so the day counter, the carry penalty and the
       three-paid-runs rule are one implementation for all three dungeons. It writes what is owed onto the
       character as `loot` for an end-of-run chest; this dungeon has no such chest, so the payment is taken
       straight back out and handed over here. Reusing the arithmetic and not the delivery. */
    const { pay, low, late } = this.dungeonOwe(pl, { key: "count", tier: 0, pay: C_.pay, share, cfg: C_, runs });
    if (pl.C.count) delete pl.C.count.loot;
    this.tixTo(pl, pay);
    this.touch(pl);
    const boxes = r.boxes.filter(Boolean).length;
    this.say(pl, `${G.fmtTix(pay)} for the job, and ${boxes} of ${C_.keys} boxes.${low ? " (Lighter: you took under a tenth of them.)" : ""}${late ? " (And lighter again: past today's three paid runs.)" : ""}`, "loot");
    pl.out.push({ type: "countwon", pay, boxes, secs: Math.round((Date.now() - r.started) / 1000) });
    this.emit(pl, "count", { boxes });
  };

  P.countDeath = function (pl, S) {
    const r = S.run, now = Date.now(); pl.act = null; pl.path = []; pl.C.hp = G.maxHpOf(pl.C);
    this.emit(pl, "death", { pvp: false });
    if (r) r.died[pl.id] = now;
    pl.x = S.def.entry.x; pl.y = S.def.entry.y; pl.step = null; this.placeSafely(S, pl); this.touch(pl);
    this.say(pl, "You come round by the door with a headache. Nothing taken.", "bad");
    const here = this.playersIn(S);
    /* A WIPE IS EVERYBODY DOWN AT ONCE, the Crypt's rule. Note the quota is NOT reset on a single death: the
       point of this room is that it grinds you down, and losing eight minutes of counting to one bad pull would
       make the whole thing a coin flip. */
    if (r && here.length && here.every((p) => now - (r.died[p.id] || 0) < C_.wipeMs)) this.countEnd(S, "wipe");
  };
  P.countEnd = function (S, why) {
    if (why === "wipe") this.reportEnd(S, "count", "wipe", { title: "The Count Room" });   /* (2026-09-28) the run report */
    for (const p of this.playersIn(S)) {
      this.moveToScene(p, C_.door.scene, null, C_.door);
      this.say(p, why === "wipe" ? `A WIPE. Everybody down at once: the house keeps your ${G.fmtTix(C_.ante)}.` : "The job is over.", "bad");
    }
    (this.countGone ||= new Set()).add(S.key);
    this.scenes.delete(S.key);
  };

  /** login, BEFORE the player is placed: a saved spot inside a run is only good if that run is still there */
  P.countRejoin = function (pl) {
    const key = String(pl.C.scene); if (!key.startsWith("count:")) return;
    const S = this.scenes.get(key), mine = pl.C.count?.run === key ? pl.C.count : null;
    if (S?.run && S.run.members.includes(pl.id)) { pl.afterJoin = ["You're back in the count room, where you were.", "good"]; return; }
    pl.C.scene = C_.door.scene; pl.C.x = pl.x = C_.door.x; pl.C.y = pl.y = C_.door.y; pl.needSave = true;
    /* the run is gone. If the GAME lost it — a restart, with nothing in memory remembering it ended — the ante
       comes back; if it ended or timed out, it does not. The Crypt's rule, and for its reason: a restart is the
       house's fault and a wipe is not. */
    if (mine && mine.ante && !this.countGone?.has(key)) {
      G.addInv(pl.C.inv, "tickets", mine.ante, pl.C);
      pl.afterJoin = [`The count room you were in was lost when the game restarted. Your ${G.fmtTix(mine.ante)} ante is back in your bag.`, "good"];
    } else pl.afterJoin = ["That job is over. You're back on the casino floor.", ""];
    if (mine) { delete pl.C.count.run; delete pl.C.count.ante; }
  };
  /** login, AFTER hello: the HUD, and the pay if the quota filled while they were away */
  P.countHello = function (pl, S) {
    this.parties ||= new Map(); this.partyBack(pl);
    if (S.run) { pl.out.push(this.countView(S)); if (S.run.open && !S.run.paid[pl.id]) this.countPayOne(S, pl); }
    if (pl.afterJoin) { this.say(pl, pl.afterJoin[0], pl.afterJoin[1] || undefined); pl.afterJoin = null; }
  };

  /** once a tick */
  P.countTick = function (now) {
    for (const [key, S] of this.scenes) {
      if (!key.startsWith("count:")) continue;
      if (!S.run) { this.scenes.delete(key); continue; }
      if (this.playersIn(S).length) {
        S.run.emptyAt = 0; this.countSpawn(S, now);
        /* the last one standing can die to something that is not countKill; without this the room could sit met-but-shut */
        if (S.run.met && !S.run.open && !S.mobs.some((m) => !m.dead)) this.countFloorClear(S);
        continue;
      }
      /* an empty copy is thrown away at once if everybody walked out, and after the held time if somebody's
         connection dropped — the Crypt's rule, so a lag-out is not the same as leaving */
      S.run.emptyAt ||= now;
      const held = S.run.members.some((id) => !this.pls.has(id)) ? C_.rejoinMs : 5000;
      if (now - S.run.emptyAt > held && now - S.run.started > 5000) { (this.countGone ||= new Set()).add(key); this.scenes.delete(key); }
    }
  };
}
