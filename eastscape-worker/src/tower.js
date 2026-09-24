/* ============================================================
   THE TOWER — server side. The numbers live in v3/assets/js/eastscape-tower-rules.js; this is only the machinery.

   ONE ROOM, REBUILT. A climber gets a private scene `tower:<their id>` and the floor is a counter on it. Going up
   does not build a new map: it puts the next floor's monster in the same room and shuts the stairs again. That is
   what makes thirty floors (or a hundred later) cost one scene instead of a hundred, and it is the whole reason
   "60 to 100 rooms" was never a content problem.

   WHAT IS SAVED. `C.tower = { floor, best }` — where you are, and the highest floor you have ever cleared. You
   re-enter at the CHECKPOINT for your best, not at your best, so a climb survives going to bed without letting
   anyone skip the nine floors under a boss.
   ============================================================ */
export function installTower(World, { G, R, rint }) {
  const T_ = R.TOWER, P = World.prototype;
  const keyOf = (pl) => `tower:${pl.id}`;
  const stateOf = (C) => { const t = C.tower || {}; return { floor: Math.max(1, t.floor | 0 || 1), best: Math.max(0, t.best | 0) }; };
  /* WHERE A CLIMB RESUMES, in ONE place (2026-09-24) — the door's window and towerEnter both read it, because
     when they each worked it out for themselves the window could promise floor 21 and the stairs deliver 30.

     You come back WHERE YOU WERE, not at the checkpoint. The checkpoint is the price of DYING and nothing else:
     towerDeath now writes the demotion into c.tower itself, so this can trust the floor it is given. It used to
     read checkpointAt(best+1) for everyone, which meant every interruption - a deploy, a dropped connection,
     going to bed - cost up to nine floors, and the scene-key bug above made that happen constantly.

     `best + 1` is the ceiling, so a floor number that somehow ran ahead of what has actually been cleared can
     never let anyone skip a fight. */
  const resumeAt = (C) => {
    const st = stateOf(C);
    const ceiling = Math.max(1, Math.min(T_.floors, st.best + 1));
    return Math.min(Math.max(R.checkpointAt(ceiling), st.floor), ceiling);
  };

  /** What the page needs to draw the HUD: which floor, whether it is clear, and what is standing in front of you. */
  P.towerView = function (S) {
    const t = S.tower; if (!t) return null;
    return { floor: t.floor, floors: T_.floors, cleared: !!t.cleared, boss: !!t.spec.boss, top: !!t.spec.top,
      name: G.MOBS[`tw${t.floor}`]?.name || "", checkpoint: R.checkpointAt(t.floor) };
  };
  P.towerTell = function (S) { const v = this.towerView(S); if (v) for (const p of this.playersIn(S)) p.out.push({ type: "tower", ...v }); };

  /** Put floor N in the room: its monster in the middle, the stairs shut behind it. */
  P.towerFloor = function (S, floor) {
    const spec = R.floorSpec(floor), t = `tw${spec.floor}`, def = G.MOBS[t];
    S.tower = { floor: spec.floor, cleared: false, spec };
    S.mobs = def ? [{ id: `${S.key}f${spec.floor}`, t, x: R.spawn.x, y: R.spawn.y, hx: R.spawn.x, hy: R.spawn.y,
      hp: def.hp, path: [], step: null, face: -1, nextWander: 0, dead: false, respawnAt: 0, hurtAt: 0, swingAt: 0, lastSwing: 0 }] : [];
    const up = S.objs.find((o) => o.t === "towerup");
    if (up) up.open = true;   /* `open: true` is "not usable yet" for a gate-like object, the same as the Crypt's hoard: the page draws it shut. */
    return spec;
  };

  /* ------------------------------------------------------------ coming back to a floor
     THE ROOM ONLY EXISTS IN MEMORY. `S.tower` — which floor it is and what is standing in it — is built by
     towerFloor and never written to storage, while `C.scene` ("tower:<you>") IS saved. So any gap between the two
     leaves a climber logged back in to a room with no monster in it, no floor bar, and a stairway that is hidden
     because nothing cleared it: stuck, with no way up and no way to know why. Three ordinary things cause that gap
     — a worker deploy, the idle sweep collecting the room while you are logged out, and simply closing the tab
     overnight.

     So the floor is rebuilt from `C.tower.floor`, which IS saved. The monster comes back whole, which is the
     forgiving reading of an interruption and the only one that cannot be farmed: nobody can chip a boss down, drop
     their connection and come back to a nearly-dead one.

     `if (!S.tower)` matters. A quick reconnect often finds the room still in memory with a fight in progress, and
     rebuilding then WOULD be the exploit above, in reverse — it would heal the monster every time you blinked. */
  P.towerRejoin = function (pl) {
    const C = pl.C, key = String(C.scene || "");
    if (!key.startsWith("tower")) return;
    /* Not your room. A key from another account (a copied save, an old id) must not drop you into someone else's
       climb, and there is nothing sensible to rebuild, so the door is where you go. */
    if (key !== keyOf(pl)) { C.scene = T_.door.scene; C.x = T_.door.x; C.y = T_.door.y; return; }
    const S = this.scene(key);
    if (S.tower) return;                       // still live: leave the fight exactly as it is
    this.towerFloor(S, Math.max(1, (C.tower?.floor | 0) || 1));
    C.x = G.SCENES.tower.entry.x; C.y = G.SCENES.tower.entry.y;
  };

  /* ------------------------------------------------------------ the door in the Yard */
  P.towerDoor = function (S, pl) {
    const st = stateOf(pl.C);
    /* `god` goes with it because towerEnter SKIPS the level check for an admin, and without telling the page that,
       the window refuses at the door and an admin can never reach the button that would have worked. (Found by the
       owner testing on a Combat 1 character.) The page must not infer this - it is the server's rule. */
    pl.out.push({ type: "towerdoor", entry: T_.entry, floors: T_.floors, best: st.best,
      resume: resumeAt(pl.C), lvl: G.lvlOf(pl.C, "melee"), god: !!pl.god });
  };

  P.towerEnter = function (S, pl) {
    const bad = (t) => this.say(pl, t, "bad");
    if (String(S.key) !== T_.door.scene || G.cheb(pl, T_.door) > 6) return bad("The Tower's door is in the Yard, off the north court.");
    if (G.lvlOf(pl.C, "melee") < T_.entry && !pl.god) return bad(`The Tower wants Combat ${T_.entry}. You're ${G.lvlOf(pl.C, "melee")}.`);
    const st = stateOf(pl.C);
    const floor = resumeAt(pl.C);
    const key = keyOf(pl), S2 = this.scene(key);
    this.towerFloor(S2, floor);
    pl.C.tower = { floor, best: st.best };
    this.touch(pl);
    this.moveToScene(pl, key, null, G.SCENES.tower.entry);
    pl.dir = "north";
    this.say(pl, floor === 1 ? "The door shuts behind you. Something is already in the room." : `You climb to floor ${floor} and the door shuts behind you.`, "sys");
    this.towerTell(S2);
  };

  /* ------------------------------------------------------------ the floor is clear */
  /** Called from killMob when the thing in a tower room dies. */
  P.towerCleared = function (S, pl, m) {
    const t = S.tower; if (!t || t.cleared) return;
    t.cleared = true;
    /* IT DOES NOT COME BACK. killMob has just set a respawn time from the generic table; a tower monster is the
       floor itself, so the room has to stay empty until the stairs are used. */
    m.respawnAt = Infinity;
    const up = S.objs.find((o) => o.t === "towerup"); if (up) up.open = false;   // the stairs work now
    const spec = t.spec;
    /* NO PAY HERE ANY MORE (owner, 2026-09-22: a fifth of the usual drop, nothing extra). The tickets are on the
       monster's own `drops` line now, which killMob has already paid out by the time this runs — paying again here
       would quietly double every floor, and the boss floors would have paid a flat bonus on top of that. */
    const st = stateOf(pl.C);
    if (spec.floor > st.best) { pl.C.tower = { floor: spec.floor, best: spec.floor }; this.touch(pl); }
    if (spec.top) {
      this.say(pl, "The House goes quiet. The stairs above you stop at a wall. That's the top.", "good");
      for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: `\u{1F3E2} ${pl.name} reached the TOP of the Tower and put The House down.` });
    } else if (spec.boss) this.say(pl, `${G.MOBS[`tw${spec.floor}`]?.name || "It"} goes down. The stairs open.`, "good");
    else this.say(pl, "Clear. The stairs open.", "good");
    this.towerTell(S);
  };

  /* ------------------------------------------------------------ dying in it
     THE TOWER TAKES YOUR CLIMB, NOT YOUR TICKETS. Everywhere else death costs a share of what you are carrying
     (G.DEATH). Here that would punish twice over, and for a room that pays almost nothing: the real loss is being
     put back to the checkpoint and having to re-clear the floors between it and where you fell, which is already
     up to nine fights. Keeping the money rule out of it is also what lets someone leave this running without
     watching it — the thing the tower exists to be. */
  P.towerDeath = function (pl, S) {
    const t = S.tower, fell = t ? t.floor : 1, back = R.checkpointAt(fell);
    pl.act = null; pl.path = []; pl.step = null;
    pl.C.hp = G.maxHpOf(pl.C);
    /* `best` is untouched - it is the highest floor ever CLEARED, and dying on a floor never cleared it - but the
       DEMOTION IS WRITTEN DOWN NOW (2026-09-24). It used to be implied: nothing was stored, and the way back in
       recomputed the checkpoint for everybody. Now that a climb resumes where it left off, the only thing that
       may move a player down is this, and it has to say so. */
    pl.C.tower = { floor: back, best: stateOf(pl.C).best };
    this.emit(pl, "death", { pvp: false });
    this.moveToScene(pl, T_.door.scene, null, T_.door);
    pl.dir = "south";
    this.touch(pl);
    this.say(pl, fell === back
      ? `Floor ${fell} put you out. You wake up in the Yard with all your things. The door is still there.`
      : `Floor ${fell} put you out. You wake up in the Yard with all your things — but the climb is gone: you start again at floor ${back}.`, "bad");
  };

  /* ------------------------------------------------------------ up */
  P.towerUp = function (S, pl) {
    const t = S.tower; if (!t) return;
    if (!t.cleared) return this.say(pl, "Something is still moving in here.", "bad");
    if (t.spec.top) return this.say(pl, "There is nothing above this. Walk out the way you came, champion.", "sys");
    const next = t.floor + 1, spec = this.towerFloor(S, next);
    pl.C.tower = { floor: next, best: Math.max(stateOf(pl.C).best, t.floor) };
    this.touch(pl);
    /* Back to the doorway of the SAME room. moveToScene to the key you are already on is not a no-op and is exactly
       what is wanted: it re-sends the snapshot, so the page throws away the monster that just died and draws the new
       floor's instead. Doing it by hand would have meant inventing a "warp" message the page does not have. */
    this.moveToScene(pl, S.key, null, G.SCENES.tower.entry);
    pl.dir = "north";
    this.say(pl, spec.boss ? `Floor ${next}. Something much bigger is waiting.` : `Floor ${next}.`, spec.boss ? "good" : "sys");
    this.towerTell(S);
  };
}
