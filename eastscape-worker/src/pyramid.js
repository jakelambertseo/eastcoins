/* ============================================================
   THE GREAT PYRAMID: the game server's side. The rules, the map and the numbers are
   v3/assets/js/eastscape-pyramid-rules.js. installPyramid() adds these methods to the World and index.js calls
   them from the same handful of one-line hooks the Crypt uses.

   IT IS THE CRYPT'S LIFECYCLE AND NOT ITS FIGHT. The owner asked to "mirror it and then factor out the payout
   yourself so its different", and that is exactly the split: a run, a party, gates that open as chambers clear,
   a chest each at the end - all the Crypt's shape, because it works and players already know it - and a boss
   that does nothing the Hoodie does.

   THREE THINGS ARE GENUINELY DIFFERENT, and each is here rather than in the rules because each is behaviour:

   1. THE CHAMBERS ARE ROWS, NOT COLUMNS. The Crypt's roomOf() takes an X alone, because its four rooms are side
      by side. The pyramid's are stacked, so its roomOf takes BOTH - and every call here passes (hx, hy). Getting
      that wrong is silent: gates would open on the wrong chamber being cleared.

   2. THE JITTER. Chambers 1 to 3 are shifted up to PYRAMID.jitter either way by the run's own seed, so no two
      runs are the same fight. The burial chamber is never touched.

   3. COIL AND BURROW, in pyramidBossTick. No slam, no adds, no enrage - see the rules file for why.

   THE PAYOUT IS NOT HERE. It is World.dungeonOwe, shared with the Crypt, so the two can never drift on what a
   passenger earns or what a fourth run of the day pays.
   ============================================================ */
export function installPyramid(World, { G, R, rint }) {
  const P_ = R.PYRAMID, P = World.prototype;
  const dayOf = () => G.chicagoDay();
  const keyed = (k) => String(k).startsWith("pyramid:");
  /* (2026-09-24, reported by the owner: "i cant get in or teleport") ANYWHERE CALLED PYRAMID, INCLUDING THE BARE
     TEMPLATE. `pyramid` with no colon is the scene every private run is stamped from - nobody should ever be
     standing in it, but an admin teleport puts you there, and once there you were STUCK: the stairs out returned
     silently because there is no run to have cleared, and pyramidRejoin ignored you because your scene key had
     no colon in it. Both of those now use this instead. */
  const anyPyramid = (k) => String(k) === "pyramid" || keyed(k);
  /* the chamber a thing is standing in. BOTH coordinates: see the header. */
  const roomAt = (o) => R.roomOf(o.hx ?? o.x, o.hy ?? o.y);

  P.pyramidRunsToday = function (pl) { const c = pl.C.pyramid; return c && c.day === dayOf() ? c.n | 0 : 0; };

  /* ------------------------------------------------------------ the door, on the Golden Sands */
  P.pyramidDoor = function (S, pl) {
    const T = P_.tiers[1], pt = this.partyOf(pl);
    /* `type: "pyramid"` and not "pyramiddoor", to match the Crypt: the page routes on this string and its
       dungeon door is "crypt". The window reads partyN / lead / solo / runs / live off this and keeps no copy
       of the party itself - eastscape-crypt.js owns the party box. */
    pl.out.push({ type: "pyramid", tier: 1, name: T.name, lvl: T.lvl, rec: T.rec, ante: T.ante, pay: T.pay,
      partyN: pt ? pt.members.length : 1, lead: !pt || pt.leader === pl.id, solo: !pt && !!pl.admin,
      runs: this.pyramidRunsToday(pl), runsPaid: P_.runsPaid, live: !!P_.live || !!pl.admin,
      lvlNow: G.lvlOf(pl.C, "melee") });
  };

  /* ------------------------------------------------------------ in */
  P.pyramidEnter = function (S, pl) {
    const T = P_.tiers[1], bad = (t) => this.say(pl, t, "bad");
    if (String(S.key) !== P_.door.scene || G.cheb(pl, P_.door) > 6) return bad("The pyramid's door is on the Golden Sands, on the eastern skyline.");
    let pt = this.partyOf(pl); const solo = !pt && pl.admin;   // an admin may go in alone to test it, as with the Crypt
    if (!pt && !solo) return bad(`The tomb takes a party of ${P_.party[0]} to ${P_.party[1]}. Click a player and invite them.`);
    if (pt && pt.leader !== pl.id) return bad("Your party's leader opens the door.");
    const ids = pt ? pt.members : [pl.id], mem = ids.map((id) => this.pls.get(id));
    if (pt && (ids.length < P_.party[0] || ids.length > P_.party[1])) return bad(`The tomb takes a party of ${P_.party[0]} to ${P_.party[1]}.`);
    /* NOTHING IS TAKEN FROM ANYBODY UNLESS IT CAN BE TAKEN FROM EVERYBODY - the Crypt's rule, and the reason the
       whole party is checked before a single ticket moves. */
    for (const p of mem) {
      if (!p || p.C.scene !== S.key || G.cheb(p, P_.door) > 6) return bad(`${p ? p.name : "Somebody"} isn't at the door yet. Everybody goes in together.`);
      if (G.lvlOf(p.C, "melee") < T.lvl && !p.admin) return bad(`${T.name} wants Combat ${T.lvl}. ${p.name} isn't there yet.`);
      if (G.tixIn(p.C) < T.ante) return bad(`The ante is ${G.fmtTix(T.ante)} each. ${p === pl ? "You have" : `${p.name} has`} ${G.fmtTix(G.tixIn(p.C))}.`);
    }
    /* THE SWITCH, checked BEFORE a single ticket moves. Its lifecycle mirrors the Crypt's faithfully but it has
       never been run by four real people, and the ante is real money - so until PYRAMID.live is true only an
       admin can open it. */
    if (!P_.live && !pl.admin) return bad("The tomb door will not budge yet. Whatever is behind it is not ready for visitors.");
    if ([...this.scenes.keys()].filter(keyed).length >= P_.maxRuns) return bad("Every way in is taken by another party. Give it a minute.");

    const key = `pyramid:${Date.now().toString(36)}${rint(10, 99)}`;
    for (const p of mem) {
      G.takeInv(p.C.inv, "tickets", T.ante);
      p.C.pyramid = { ...(p.C.pyramid && p.C.pyramid.day === dayOf() ? p.C.pyramid : { day: dayOf(), n: 0 }), run: key, ante: T.ante };
      this.touch(p);
    }
    const run = this.scene(key);
    run.tier = 1;
    run.run = { tier: 1, members: [...ids], started: Date.now(), bossAt: 0, dmg: {}, died: {}, gates: [false, false, false],
      paid: false, paidTo: {}, cleared: null, party: pt ? pt.id : null,
      /* the serpent's own state. `seed` is what makes the lower chambers differ run to run. */
      seed: Math.floor(Math.random() * 1e9), coil: null, nextCoilAt: Date.now() + P_.coil.everyMs, warnAt: 0, burrows: 0, downUntil: 0 };

    /* health, and the jitter. The boss scales with the party; the lower chambers wobble; the burial chamber does not. */
    for (const mob of run.mobs) {
      const d = G.MOBS[mob.t];
      if (d.boss) { mob.hp = P_.bossHp(d.hp, ids.length); }
      else {
        const room = roomAt(mob);
        const j = room >= 3 ? 1 : 1 + (((run.run.seed >> (room * 5)) % 101) / 100 * 2 - 1) * P_.jitter;
        mob.hp = Math.max(4, Math.round(d.hp * j));
        mob.jit = j;   /* read by pyramidHit for accuracy and defence, so a chamber is uniformly softer or harder */
      }
      mob.maxHp = mob.hp; mob.respawnAt = Infinity;
    }
    for (const p of mem) {
      this.moveToScene(p, key, null, run.def.entry);
      this.say(p, `${T.name}. ${G.fmtTix(T.ante)} on the door. Clear each chamber and its door grinds open. Something very old is at the top.`, "good");
    }
  };

  /* ------------------------------------------------------------ inside */
  P.pyramidGates = function (S) {
    return { type: "pyramidgates", cleared: !!S.run.cleared, open: S.run.gates,
      coil: S.run.coil ? { on: S.run.coil.id, until: S.run.coil.until } : null,
      down: S.run.downUntil > Date.now() ? S.run.downUntil : 0,
      hp: S.mobs.filter((m) => G.MOBS[m.t].boss).map((m) => ({ id: m.id, hp: Math.max(0, m.hp), max: m.maxHp })) };
  };
  P.pyramidTell = function (S) { const v = this.pyramidGates(S); for (const p of this.playersIn(S)) p.out.push(v); };

  P.pyramidOpenGate = function (S, i) {
    if (S.run.gates[i]) return;
    S.run.gates[i] = true;
    const q = P_.gates[i]; S.g[q.y][q.x] = "i";
    const msg = this.pyramidGates(S);
    for (const p of this.playersIn(S)) { p.out.push(msg); this.say(p, i === 2 ? "The burial chamber grinds open. Do not go in alone." : "Stone on stone: the way up is open.", "good"); }
  };

  P.pyramidHit = function (S, pl, m, dmg) {
    if (!dmg || !S.run) return;
    if (G.MOBS[m.t].boss) {
      S.run.dmg[pl.id] = (S.run.dmg[pl.id] || 0) + dmg;
      S.run.bossAt ||= Date.now();
      (m.threat ||= []).push([Date.now(), pl.id, dmg]);
      /* THE GRIP BREAKS ON DAMAGE, and only from somebody who is not the one being held: the whole point is that
         the party has to come and get you. */
      const c = S.run.coil;
      if (c && pl.id !== c.id) {
        c.done = (c.done || 0) + dmg;
        if (c.done >= m.maxHp * P_.coil.breakFrac) this.pyramidFreeCoil(S, "broke");
      }
    }
  };

  P.pyramidThreat = function (S, m, players, now) {
    const t = (m.threat ||= []).filter(([at]) => now - at < P_.threatMs); m.threat = t;
    const by = {}; for (const [, id, d] of t) by[id] = (by[id] || 0) + d;
    let best = null, bestD = 0;
    for (const p of players) if ((by[p.id] || 0) > bestD) { bestD = by[p.id]; best = p; }
    return best;
  };

  /* ------------------------------------------------------------ COIL AND BURROW
     Called every monster tick for the boss. Everything it does is timing plus two pieces of run state, so there
     is no new combat machinery: a held player has their path cleared and takes a share of their maximum, and a
     burrowing serpent is moved and told not to swing. */
  P.pyramidBossTick = function (S, m, now, players) {
    const run = S.run; if (!run || run.cleared) return;
    /* (2026-09-24, reported by the owner: "there was a ghost mob that was making me get held on the first room")
       THAT WAS THE SERPENT, FOUR CHAMBERS AWAY. This ran from the first tick of the run and picked its target
       out of everybody in the scene, so it coiled people standing in the entrance hall - through three shut
       stone doors, with nothing visible anywhere near them. It does nothing until the burial chamber is open,
       and it can only take hold of somebody standing in the chamber WITH it. */
    if (!run.gates[2]) return;
    /* (2026-09-24) AND WITHIN REACH OF IT. The burial chamber is two and a half times the room it was and the
       serpent sits at the apex of it, with the pharaohs at the mouth - so "in the same chamber" is no longer the
       same thing as "close enough to be grabbed". Without the distance the first coil would land on somebody
       eight tiles away who has not seen the snake yet, which is the bug the room check was written to fix,
       one chamber smaller. */
    const near = players.filter((p) => !p.dead && R.roomOf(p.x, p.y) === R.roomOf(m.x, m.y)
      && G.cheb(p, m) <= (P_.coil.reach ?? 99));

    /* BURROW: at each threshold, once. It does no damage - it resets where everybody is standing. */
    const frac = m.hp / Math.max(1, m.maxHp);
    if (run.downUntil > now) { m.lastSwing = now; return; }   // under the sand: it cannot be fought and does not fight
    if (run.burrows < P_.burrow.at.length && frac <= P_.burrow.at[run.burrows]) {
      run.burrows++;
      run.downUntil = now + P_.burrow.downMs;
      if (run.coil) this.pyramidFreeCoil(S, "burrow");
      /* WHERE IT COMES UP. The burial chamber is a taper, not a rectangle, so a point drawn from rooms[3]'s
         bounding box lands in solid stone about a quarter of the time - and the walkable check then meant the
         serpent quietly did not move at all, which is the whole mechanic failing silently. R.spanAt gives the
         row's real span, and it tries a few rows before giving up. It also keeps its distance from the mouth of
         the chamber, so a burrow can never drop it on top of the party. */
      const r = P_.rooms[3];
      for (let t = 0; t < 24; t++) {
        const ny = rint(r.y0, r.y1 - 2), s = R.spanAt(ny);
        if (!s) continue;
        const nx = rint(s[0] + 1, s[1] - 1);
        if (!G.walkableIn(S.g, nx, ny) || this.occupied(S, nx, ny, m)) continue;
        m.x = nx; m.y = ny; m.step = null; m.path = []; break;
      }
      m.threat = [];
      for (const p of this.playersIn(S)) this.say(p, "The floor drops. It has gone under the sand — it will come up somewhere else.", "bad");
      this.pyramidTell(S);
      return;
    }

    /* COIL: warn, then take hold of whoever has hurt it most. */
    if (!run.coil) {
      if (!run.warnAt && now >= run.nextCoilAt) {
        if (!near.length) { run.nextCoilAt = now + P_.coil.everyMs; return; }   // do not telegraph at an empty chamber
        run.warnAt = now;
        for (const p of this.playersIn(S)) this.say(p, "It rears up and starts to gather itself.", "bad");
        this.pyramidTell(S);
      }
      if (run.warnAt && now - run.warnAt >= P_.coil.warnMs) {
        if (!near.length) { run.warnAt = 0; run.nextCoilAt = now + P_.coil.everyMs; return; }   // nobody in the room to take hold of
        const target = this.pyramidThreat(S, m, near, now) || near[Math.floor(Math.random() * near.length)];
        run.warnAt = 0;
        run.nextCoilAt = now + P_.coil.everyMs;
        if (target) {
          run.coil = { id: target.id, until: now + P_.coil.maxMs, done: 0, hurtAt: now };
          for (const p of this.playersIn(S)) this.say(p, p.id === target.id ? "IT HAS YOU. You cannot get loose on your own." : `It has ${target.name}. Hit it — hard — or they are gone.`, "bad");
          this.pyramidTell(S);
        }
      }
      return;
    }

    /* held: they cannot walk off, and they bleed */
    const c = run.coil, held = this.pls.get(c.id);
    if (!held || held.dead || held.C.scene !== S.key) return this.pyramidFreeCoil(S, "gone");
    /* the path is still cleared, but only as a belt to the braces: the walk handler refuses a held player's
       click outright now, so this no longer has to fight one that already happened. */
    held.path = []; held.step = null;
    if (now - c.hurtAt >= 1000) {
      c.hurtAt = now;
      const max = G.maxHpOf(held.C), hurt = Math.max(1, Math.round(max * P_.coil.hurt));
      held.C.hp = Math.max(0, held.C.hp - hurt); this.touch(held);
      held.out.push({ type: "hurt", n: hurt });
      if (held.C.hp <= 0) { this.pyramidFreeCoil(S, "killed"); return this.pyramidDeath(held, S); }
    }
    if (now >= c.until) this.pyramidFreeCoil(S, "time");
  };

  P.pyramidFreeCoil = function (S, why) {
    const run = S.run, c = run && run.coil; if (!c) return;
    run.coil = null;
    const held = this.pls.get(c.id);
    for (const p of this.playersIn(S)) {
      if (why === "broke") this.say(p, held ? `It lets go of ${held.name}.` : "It lets go.", "good");
      else if (why === "time") this.say(p, "It uncoils on its own, bored.", "sys");
    }
    this.pyramidTell(S);
  };

  /* ------------------------------------------------------------ a chamber cleared, and the end */
  P.pyramidKill = function (S, pl, m, now) {
    m.dead = true; m.claim = null; m.respawnAt = Infinity; pl.act = null; this.emit(pl, "kill", { mob: m.t });
    if (S.run && S.run.coil && S.run.coil.id === pl.id) this.pyramidFreeCoil(S, "broke");
    const def = G.MOBS[m.t]; if (def.boss) return this.pyramidClear(S, now);
    if (!S.run) return;   /* the bare template has no gates to open, and reading them would throw */
    /* the first two doors open on their own when their chamber is empty; the third is the lever's job */
    for (const i of [0, 1]) if (!S.run.gates[i] && !S.mobs.some((x) => !x.dead && roomAt(x) === i)) this.pyramidOpenGate(S, i);
  };

  P.pyramidLever = function (S, pl) {
    const run = S.run; if (!run) return;
    if (run.gates[2]) return this.say(pl, "It is already open.");
    if (!run.gates[1]) return this.say(pl, "It will not shift. Something below is still standing.", "bad");
    const out = this.playersIn(S).filter((p) => !p.dead && roomAt(p) !== 2);
    if (out.length) return this.say(pl, `Everybody alive has to be in this chamber first. Waiting on ${out.map((p) => p.name).join(", ")}.`, "bad");
    this.pyramidOpenGate(S, 2);
  };

  P.pyramidExit = function (S, pl) {
    /* NO RUN AT ALL means this is the bare template and somebody was put here by hand: let them walk out. It
       used to `return` on its own, which is how you got stuck in a room with a working door. */
    if (!S.run) { this.moveToScene(pl, P_.door.scene, null, P_.door); return this.say(pl, "There is nothing going on in here. You step back out into the sun.", "sys"); }
    if (!S.run.cleared) return this.say(pl, "The Squeeze is between you and those stairs.", "bad");
    this.moveToScene(pl, P_.door.scene, null, P_.door);
    this.say(pl, "You come out into the sun. It is very bright.", "good");
  };

  P.pyramidDeath = function (pl, S) {
    const run = S.run, now = Date.now();
    pl.act = null; pl.path = []; pl.C.hp = G.maxHpOf(pl.C); this.emit(pl, "death", { pvp: false });
    if (run) { run.died[pl.id] = now; if (run.coil && run.coil.id === pl.id) this.pyramidFreeCoil(S, "killed"); }
    pl.x = S.def.entry.x; pl.y = S.def.entry.y; pl.step = null; this.placeSafely(S, pl); this.touch(pl);
    this.say(pl, "You wake up at the door with all your things. The ante is the stake, not your bag.", "bad");
    const here = this.playersIn(S);
    if (run && here.length && here.every((p) => now - (run.died[p.id] || 0) < P_.wipeMs)) this.pyramidEnd(S, "wipe");
  };

  P.pyramidClear = function (S, now) {
    const run = S.run; if (!run || run.paid) return; run.paid = true;
    if (run.coil) this.pyramidFreeCoil(S, "dead");
    const T = P_.tiers[run.tier], secs = Math.round((now - run.started) / 1000);
    const total = Object.values(run.dmg).reduce((a, b) => a + b, 0) || 1;
    const here = this.playersIn(S), names = here.map((p) => p.name);
    run.cleared = { secs, total };
    for (const p of here) this.pyramidPayOne(S, p);
    for (const p of here) this.emit(p, "pyramid", { tier: run.tier });
    for (const p of this.pls.values()) if (!here.includes(p)) p.out.push({ type: "casinonote", text: `🐍 ${names.join(", ")} put THE SQUEEZE down in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}.` });
    for (const p of here) this.say(p, "It stops moving. The hoard is at the head of the chamber: a chest each.", "good");
    this.pyramidTell(S);
  };

  P.pyramidPayOne = function (S, p) {
    const run = S.run, T = P_.tiers[run.tier];
    if (!run.cleared || run.paidTo[p.id] || !run.members.includes(p.id)) return;
    run.paidTo[p.id] = true;
    const share = (run.dmg[p.id] || 0) / run.cleared.total;
    /* SHARED WITH THE CRYPT (World.dungeonOwe): the share rules, the day's run count, and writing what is owed
       onto the character before a thing is handed over. */
    const { pay, low, late } = this.dungeonOwe(p, { key: "pyramid", tier: run.tier, pay: T.pay, share, cfg: P_, runs: this.pyramidRunsToday(p) });
    this.say(p, `THE SQUEEZE IS DEAD. Its hoard is at the head of the chamber: one chest each.${low ? " (Yours is lighter: you did under a tenth of the damage.)" : ""}${late ? " (And lighter again: past today's paid runs.)" : ""}`, "loot");
    p.out.push({ type: "pyramidwon", chest: true, secs: run.cleared.secs, pay });
  };

  /* ------------------------------------------------------------ the chest */
  P.pyramidLootOpen = function (S, pl) {
    if (pl.C.pyramid?.loot) return this.pyramidLootGive(pl, false);
    this.say(pl, S.run && !S.run.cleared ? "It will not open while it is alive." : "You have had yours. One each.", S.run && !S.run.cleared ? "bad" : undefined);
  };

  P.pyramidLootGive = function (pl, sent) {
    const C = pl.C, L = C.pyramid?.loot; if (!L) return;
    delete C.pyramid.loot; this.touch(pl);   // off the character BEFORE anything is handed over: it opens once
    const { items } = R.rollLoot(L), got = [];
    for (const it of items) {
      if (it.k === "tickets") { this.tixTo(pl, it.n); got.push(it); continue; }
      /* THE PET IS AN INSTANCE, not a stack - the same shape killMob uses when one drops in the world. */
      if (it.k === "pet:coilling") {
        const pet = { id: `pt${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, k: "coilling", name: "" };
        (C.pets ||= []).push(pet);
        if (!C.eq.pet) C.eq.pet = pet.id;
        got.push({ k: "pet", n: 1 });
        this.say(pl, "Something small was in there with him, and it is still alive. A Coilling. It is yours.", "loot");
        continue;
      }
      if (!G.ITEMS[it.k]) continue;
      const where = this.keepRare(pl, it.k, it.n);
      if (where) got.push({ ...it, bank: where === "bank" || undefined });
    }
    const names = got.filter((x) => x.k !== "tickets" && x.k !== "pet").map((x) => `${x.n > 1 ? x.n + " x " : ""}${G.ITEMS[x.k]?.name || x.k}`);
    this.say(pl, `${sent ? "The chest you left in the tomb was sent after you" : "You open the hoard"}: ${G.fmtTix(got[0]?.k === "tickets" ? got[0].n : 0)}${names.length ? `, ${names.join(", ")}` : ""}.${got.some((x) => x.bank) ? " (No room in your bag for some of it: it's in your bank.)" : ""}`, "loot");
    pl.out.push({ type: "pyramidloot", items: got, sent: !!sent });
    if (Math.random() < Math.min(0.5, G.ZDROP.kill(G.MOBS.squeeze.lvl) * P_.zdropMul)) this.zcoinDrop(pl, "the Squeeze's hoard");
  };

  /** anything still owed to somebody who is no longer in a tomb is sent after them */
  P.pyramidLootSweep = function (pl) {
    if (pl.C.pyramid?.loot && !anyPyramid(pl.C.scene)) this.pyramidLootGive(pl, true);
  };

  /* ------------------------------------------------------------ housekeeping */
  P.pyramidEnd = function (S, why) {
    const run = S.run; if (!run) return;
    for (const p of this.playersIn(S)) {
      this.say(p, why === "wipe" ? "Everybody is down. The tomb closes." : "The tomb closes.", "bad");
      this.moveToScene(p, P_.door.scene, null, P_.door);
    }
    S.run = null;
    this.scenes.delete(S.key);
  };

  P.pyramidRejoin = function (pl) {
    const C = pl.C, key = String(C.scene || "");
    if (!anyPyramid(key)) return;
    /* the bare template: not a run, and not somewhere to wake up. Out to the door. */
    if (!keyed(key)) { C.scene = P_.door.scene; C.x = P_.door.x; C.y = P_.door.y; return; }
    const live = this.scenes.get(key);
    /* the run is gone, or it was never this player's: out to the door, with anything still owed sent after them */
    if (!live || !live.run || !live.run.members.includes(pl.id)) {
      C.scene = P_.door.scene; C.x = P_.door.x; C.y = P_.door.y;
      this.pyramidLootSweep(pl);
      return;
    }
    if (live.run.cleared) this.pyramidPayOne(live, pl);
  };

  P.pyramidHello = function (pl, S) {
    if (S && S.run && keyed(S.key)) { pl.out.push(this.pyramidGates(S)); if (S.run.cleared) this.pyramidPayOne(S, pl); }
    else this.pyramidLootSweep(pl);
  };

  /* every twentieth tick, with the Crypt's: throw away a run nobody is in */
  P.pyramidTick = function (now) {
    for (const [key, S] of [...this.scenes.entries()]) {
      if (!keyed(key) || !S.run) continue;
      if (this.playersIn(S).length) continue;
      if (!S.emptyAt) { S.emptyAt = now; continue; }
      if (now - S.emptyAt > P_.rejoinMs) { S.run = null; this.scenes.delete(key); }
    }
  };
}
