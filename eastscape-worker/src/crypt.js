/* ============================================================
   THE CRYPT and PARTIES: the game server's side (the rules, the map and the numbers are v3/assets/js/eastscape-crypt-rules.js; the
   design is EASTSCAPE-DRAFTS.md section 6). installCrypt() adds these methods to the World; index.js calls them from a
   handful of one-line hooks (a swing, a kill, a death, the monsters' tick, a click on the door or the lever, a player leaving).

   PARTIES. 2 to 4 players. `this.parties` id -> { id, leader, members: [player id] }; a player carries pl.party (the id). Invite is
   like a trade request: the other player gets a line with Accept, good for 60 s. Members are told the party (names, health,
   where they are) when it changes and once a second while anybody in it is in a crypt. Leaving the game leaves the party.

   A RUN. The leader clicks the stairway in the Forum and picks a difficulty. Everybody must be standing by the stairs, be the
   level, and have the ante; nothing is taken from anybody unless it can be taken from everybody. Each run is a PRIVATE COPY of
   the scene, "crypt:<run id>", with the tier's monsters swapped in and the boss's health set by the party's size. S.run holds
   the run: tier, members, who paid, the boss's damage table, deaths, gates. The copy is deleted when it is empty.

   MONEY. The ante is taken on the way in. A clear pays each member who is still in the party and in the crypt: the tier's pay,
   halved for anyone who did under a tenth of the boss's damage, quartered after the day's three paid clears. It is paid with
   tixTo() like any ticket income, exactly once (S.run.paid). A wipe pays nothing and the ante is gone.
   ============================================================ */
export function installCrypt(World, { G, R, rint }) {
  const C_ = R.CRYPT, P = World.prototype, nameOf = (w, id) => w.pls.get(id)?.name || "someone";
  const inCrypt = (pl) => String(pl.C.scene).startsWith("crypt:");

  /* ------------------------------------------------------------ parties */
  P.partyOf = function (pl) { return pl.party ? this.parties?.get(pl.party) || null : null; };
  P.partyView = function (pt) { return { id: pt.id, leader: pt.leader, members: pt.members.map((id) => { const p = this.pls.get(id); return p ? { id, name: p.name, hp: p.C.hp, max: G.maxHpOf(p.C), scene: String(p.C.scene).startsWith("crypt:") ? "crypt" : (G.sceneDef(p.C.scene)?.name || String(p.C.scene).split(":")[0]).replace(/^The /, "") } : { id, name: pt.away?.[id]?.name || "…", hp: 0, max: 1, scene: "", away: true }; }) }; };
  P.partyTell = function (pt) { const msg = { type: "party", party: pt.members.length ? this.partyView(pt) : null }; for (const id of pt.members) this.pls.get(id)?.out.push(msg); };
  P.partyLeave = function (pl, quiet) {
    const pt = this.partyOf(pl); pl.party = null; if (!pt) return;
    pt.members = pt.members.filter((id) => id !== pl.id); pl.out.push({ type: "party", party: null });
    if (inCrypt(pl) && !pl.left) { this.moveToScene(pl, C_.door.scene, null, C_.door); this.say(pl, "You leave the party, and the crypt with it."); }
    if (pt.members.length < 2) { for (const id of pt.members) { const p = this.pls.get(id); if (p) { p.party = null; p.out.push({ type: "party", party: null }); if (!inCrypt(p)) this.say(p, "The party's over: everybody else left."); } } if (!pt.members.some((id) => { const p = this.pls.get(id); return p && inCrypt(p); })) this.parties.delete(pt.id); else { pt.members.forEach((id) => { const p = this.pls.get(id); if (p) p.party = pt.id; }); this.partyTell(pt); } return; }
    if (pt.leader === pl.id) pt.leader = pt.members[0];
    if (!quiet) for (const id of pt.members) this.say(this.pls.get(id), `${pl.name} left the party.`);
    this.partyTell(pt);
  };
  /* (v104) A DROPPED CONNECTION IS NOT LEAVING. The owner: "if the game lags a user out, or kicks them out, or if they refresh, they
     are kicked out of the dungeon. this could be very bad". A player whose socket closes keeps their place in the party, and in
     the run, for C_.rejoinMs; logging back in puts them where they were standing (cryptRejoin). Only Leave party, a kick, or the
     time running out takes them off the list. A run with everybody away is kept that long too. */
  P.partyAway = function (pl) {
    const pt = this.partyOf(pl); if (!pt) return; (pt.away ||= {})[pl.id] = { at: Date.now(), name: pl.name };
    for (const id of pt.members) if (id !== pl.id) this.say(this.pls.get(id), `${pl.name} lost connection. Their place is held for ${Math.round(C_.rejoinMs / 60000)} minutes.`);
    this.partyTell(pt);
  };
  P.partyBack = function (pl) {   // on login: are they still on a party's list?
    for (const pt of this.parties?.values() || []) if (pt.members.includes(pl.id)) { pl.party = pt.id; if (pt.away) delete pt.away[pl.id]; for (const id of pt.members) if (id !== pl.id) this.say(this.pls.get(id), `${pl.name} is back.`, "good"); this.partyTell(pt); return pt; }
    return null;
  };
  P.partyDropId = function (pt, id) {   // the held place ran out
    const name = pt.away?.[id]?.name || "Somebody"; pt.members = pt.members.filter((x) => x !== id); if (pt.away) delete pt.away[id];
    if (pt.leader === id && pt.members.length) pt.leader = pt.members[0];
    if (pt.members.length < 2 && !pt.members.some((x) => { const p = this.pls.get(x); return p && inCrypt(p); })) { for (const x of pt.members) { const p = this.pls.get(x); if (p) { p.party = null; p.out.push({ type: "party", party: null }); this.say(p, `${name} didn't come back. The party's over.`); } } this.parties.delete(pt.id); return; }
    for (const x of pt.members) this.say(this.pls.get(x), `${name} didn't come back, and is out of the party.`); this.partyTell(pt);
  };
  /** login, BEFORE the player is placed: a saved position inside a run is only good if that run is still there and they are on its list */
  P.cryptRejoin = function (pl) {
    const key = String(pl.C.scene); if (!key.startsWith("crypt:")) return; const S = this.scenes.get(key), mine = pl.C.crypt?.run === key ? pl.C.crypt : null;
    if (S?.run && S.run.members.includes(pl.id)) { pl.afterJoin = ["You're back in the crypt, where you were.", "good"]; return; }
    pl.C.scene = C_.door.scene; pl.C.x = pl.x = C_.door.x; pl.C.y = pl.y = C_.door.y; pl.needSave = true;
    /* the run is gone. If the GAME lost it (a restart: nothing in memory remembers it ending), the ante comes back. If it ended or timed out, it doesn't. */
    if (mine && mine.ante && !this.cryptGone?.has(key)) { G.addInv(pl.C.inv, "tickets", mine.ante, pl.C);   /* (2026-09-24) a refund into a full-looking bag could be dropped */ pl.afterJoin = [`The crypt run you were in was lost when the game restarted. Your ${G.fmtTix(mine.ante)} ante is back in your bag.`, "good"]; }
    else pl.afterJoin = ["The crypt run you were in is over. You're back at the stairs.", ""];
    if (mine) { delete pl.C.crypt.run; delete pl.C.crypt.ante; }
  };
  /** login, AFTER hello: the party box, the gates, and a clear's pay if the boss died while they were away */
  P.cryptHello = function (pl, S) {
    this.parties ||= new Map(); this.partyBack(pl); if (S.run) { pl.out.push(this.cryptGates(S)); if (S.run.cleared && !S.run.paidTo[pl.id]) this.cryptPayOne(S, pl); }
    if (pl.afterJoin) { this.say(pl, pl.afterJoin[0], pl.afterJoin[1] || undefined); pl.afterJoin = null; }
  };
  P.partyOp = function (S, pl, m) {
    this.parties ||= new Map(); const now = Date.now(), op = String(m.op);
    if (op === "invite") {
      const o = this.pls.get(String(m.to)); if (!o || o === pl || o.C.scene !== pl.C.scene) return this.say(pl, "They're not here.", "bad");
      if (inCrypt(pl)) return this.say(pl, "Not in the middle of a run.", "bad");
      if (o.party) return this.say(pl, `${o.name} is already in a party.`, "bad");
      const pt = this.partyOf(pl); if (pt && pt.leader !== pl.id) return this.say(pl, "Only the party's leader invites.", "bad");
      if (pt && pt.members.length >= C_.party[1]) return this.say(pl, `A party is ${C_.party[1]} at most.`, "bad");
      o.partyAsk = { from: pl.id, at: now }; o.out.push({ type: "partyask", from: pl.id, name: pl.name });
      return this.say(pl, `You ask ${o.name} to join your party…`);
    }
    if (op === "accept") {
      const ask = pl.partyAsk, o = ask && this.pls.get(ask.from); pl.partyAsk = null;
      if (!o || now - ask.at > 60000 || String(m.from) !== ask.from) return this.say(pl, "That invitation has gone stale.", "bad");
      if (pl.party) return this.say(pl, "You're already in a party. Leave it first.", "bad");
      let pt = this.partyOf(o); if (pt && (pt.leader !== o.id || pt.members.length >= C_.party[1] || inCrypt(o))) return this.say(pl, "That party can't take you right now.", "bad");
      if (!pt) { pt = { id: `p${now.toString(36)}${rint(100, 999)}`, leader: o.id, members: [o.id] }; this.parties.set(pt.id, pt); o.party = pt.id; }
      pt.members.push(pl.id); pl.party = pt.id;
      for (const id of pt.members) this.say(this.pls.get(id), `${pl.name} joined the party. (${pt.members.length} of ${C_.party[1]})`, "good");
      return this.partyTell(pt);
    }
    if (op === "leave") return this.partyLeave(pl);
    if (op === "kick") { const pt = this.partyOf(pl), o = this.pls.get(String(m.id)); if (!pt || pt.leader !== pl.id || !o || o === pl || !pt.members.includes(o.id) || inCrypt(o)) return; this.say(o, `${pl.name} removed you from the party.`); return this.partyLeave(o, true); }
  };

  /* ------------------------------------------------------------ the door: what a run would cost you, and going in */
  const dayOf = () => G.chicagoDay();
  P.cryptRunsToday = function (pl) { const c = pl.C.crypt; return c && c.day === dayOf() ? c.n | 0 : 0; };
  P.cryptDoor = function (S, pl) {   // the stairway was clicked: tell the page what it needs to draw the window
    const pt = this.partyOf(pl); pl.out.push({ type: "crypt", runsToday: this.cryptRunsToday(pl), party: pt ? this.partyView(pt) : null, solo: !!pl.admin, open: [...this.scenes.keys()].filter((k) => k.startsWith("crypt:")).length });
  };
  P.cryptEnter = function (S, pl, m) {
    const tier = m.tier | 0, T = C_.tiers[tier]; if (!T) return; const bad = (t) => this.say(pl, t, "bad");
    if (String(S.key) !== C_.door.scene || G.cheb(pl, C_.door) > 6) return bad("The stairs down are in the Yard, by the jukebox.");
    let pt = this.partyOf(pl); const solo = !pt && pl.admin;   /* (an admin may go down alone, to test it: the owner asked how to try it by himself) */
    if (!pt && !solo) return bad(`The crypt takes a party of ${C_.party[0]} to ${C_.party[1]}. Click a player and invite them.`);
    if (pt && pt.leader !== pl.id) return bad("Your party's leader opens the way.");
    const ids = pt ? pt.members : [pl.id], mem = ids.map((id) => this.pls.get(id));
    if (pt && (ids.length < C_.party[0] || ids.length > C_.party[1])) return bad(`The crypt takes a party of ${C_.party[0]} to ${C_.party[1]}.`);
    for (const p of mem) {
      if (!p || p.C.scene !== S.key || G.cheb(p, C_.door) > 6) return bad(`${p ? p.name : "Somebody"} isn't at the stairs yet. Everybody goes down together.`);
      if (G.lvlOf(p.C, "melee") < T.lvl && !p.admin) return bad(`${T.name} wants Combat ${T.lvl}. ${p.name} isn't there yet.`);
      if (G.tixIn(p.C) < T.ante) return bad(`The ante is ${G.fmtTix(T.ante)} each. ${p === pl ? "You have" : `${p.name} has`} ${G.fmtTix(G.tixIn(p.C))}.`);
    }
    if ([...this.scenes.keys()].filter((k) => k.startsWith("crypt:")).length >= C_.maxRuns) return bad("The crypt is full of other parties. Give it a minute.");
    const key = `crypt:${Date.now().toString(36)}${rint(10, 99)}`;
    for (const p of mem) { G.takeInv(p.C.inv, "tickets", T.ante); p.C.crypt = { ...(p.C.crypt && p.C.crypt.day === dayOf() ? p.C.crypt : { day: dayOf(), n: 0 }), run: key, ante: T.ante }; this.touch(p); }   // everybody could pay: now everybody pays (and the character remembers which run, for cryptRejoin)
    const run = this.scene(key);
    run.tier = tier; run.run = { tier, members: [...ids], started: Date.now(), bossAt: 0, dmg: {}, died: {}, gates: [false, false, false], paid: false, paidTo: {}, cleared: null, added: false, party: pt ? pt.id : null };
    for (const mob of run.mobs) { mob.t = mob.t + T.sfx; const d = G.MOBS[mob.t]; mob.hp = d.boss ? C_.bossHp(d.hp, ids.length) : d.hp; mob.maxHp = mob.hp; mob.respawnAt = Infinity; }
    for (const p of mem) { this.moveToScene(p, key, null, run.def.entry); this.say(p, `${T.name}. ${G.fmtTix(T.ante)} on the door. Clear each chamber and its gate opens. Don't stand in the red.`, "good"); }
  };

  /* ------------------------------------------------------------ inside */
  P.cryptGates = function (S) { return { type: "cryptgates", cleared: !!S.run.cleared, open: S.run.gates, hp: S.mobs.filter((m) => G.MOBS[m.t].boss).map((m) => ({ id: m.id, hp: Math.max(0, m.hp), max: m.maxHp, rage: !!m.enraged }))[0] || null }; };
  P.cryptOpenGate = function (S, i) { if (S.run.gates[i]) return; S.run.gates[i] = true; const q = C_.gates[i]; S.g[q.y][q.x] = "i"; const msg = this.cryptGates(S); for (const p of this.playersIn(S)) { p.out.push(msg); this.say(p, i === 2 ? "The Sanctum gate grinds open. He's in there." : "A gate grinds open.", "good"); } };
  P.cryptHit = function (S, pl, m, dmg) { if (!dmg || !S.run) return; if (G.MOBS[m.t].boss) { S.run.dmg[pl.id] = (S.run.dmg[pl.id] || 0) + dmg; S.run.bossAt ||= Date.now(); (m.threat ||= []).push([Date.now(), pl.id, dmg]); } };
  P.cryptThreat = function (S, m, players, now) {   // whoever has hurt him most in the last ten seconds, if they're still standing in here
    m.threat = (m.threat || []).filter(([t]) => now - t < C_.threatMs); const sum = {}; for (const [, id, d] of m.threat) sum[id] = (sum[id] || 0) + d;
    const top = Object.entries(sum).sort((a, b) => b[1] - a[1]).map(([id]) => players.find((p) => p.id === id)).find((p) => p && !p.dead); return top || null;
  };
  P.cryptBossTick = function (S, m, now, players) {
    const run = S.run; if (!run || m.dead || !run.bossAt) return;
    if (!m.enraged && now - run.bossAt > C_.enrageMs) { m.enraged = true; for (const p of players) { this.say(p, "THE HOODIE IS DONE WAITING. He hits twice as hard now.", "bad"); p.out.push(this.cryptGates(S)); } }
    if (!run.added && m.hp <= m.maxHp * C_.addsAt) {   // the whistle: one Skeleton Guard for each of you
      run.added = true; const t = "cryptguard" + C_.tiers[run.tier].sfx, d = G.MOBS[t]; let n = 0;
      for (const p of players) { let spot = null; for (let r = 1; r <= 4 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) { const x = m.x + dx, y = m.y + dy; if (G.walkableIn(S.g, x, y) && R.roomOf(x) === 3 && !this.occupied(S, x, y, null)) spot = { x, y }; } if (!spot) continue;
        S.mobs.push({ id: `${S.key}a${n++}`, t, x: spot.x, y: spot.y, hx: spot.x, hy: spot.y, hp: d.hp, maxHp: d.hp, path: [], step: null, face: 1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: now, target: p.id }); }
      for (const p of players) this.say(p, "He blows the whistle. Bones answer.", "bad"); S.whoSig = null;
    }
    if (!m.slamAt && now - (m.lastSlam || run.bossAt) > C_.slam.everyMs) { m.slamAt = now + C_.slam.warnMs; S.events.push({ type: "slam", x: m.x, y: m.y, r: C_.slam.reach, ms: C_.slam.warnMs, t: now }); }
    if (m.slamAt && now >= m.slamAt) { m.slamAt = 0; m.lastSlam = now;
      for (const p of players) if (!p.dead && Math.max(Math.abs(p.x - m.x), Math.abs(p.y - m.y)) <= C_.slam.reach) { const hurt = Math.ceil(G.maxHpOf(p.C) * C_.slam.hurt); if (!p.god) { p.C.hp -= hurt; this.touch(p); } this.meterAdd?.(p, "taken", hurt, m); p.hurtAt = now; S.events.push({ type: "splat", who: `p:${p.id}`, n: hurt, kind: "hit", t: now }); if (p.C.hp <= 0) this.die(p, S, { mob: "The Hoodie" }); }
      S.events.push({ type: "slammed", x: m.x, y: m.y, r: C_.slam.reach, t: now }); }
  };
  P.cryptKill = function (S, pl, m, now) {   // no drops in here: the run pays at the end. A cleared chamber opens its gate.
    m.dead = true; m.claim = null; m.respawnAt = Infinity; pl.act = null; this.emit(pl, "kill", { mob: m.t });
    const def = G.MOBS[m.t]; if (def.boss) return this.cryptClear(S, now);
    for (const i of [0, 1]) if (!S.run.gates[i] && !S.mobs.some((x) => !x.dead && R.roomOf(x.hx) === i)) this.cryptOpenGate(S, i);
  };
  P.cryptLever = function (S, pl) {
    const run = S.run; if (!run) return; if (run.gates[2]) return this.say(pl, "It's already open.");
    if (!run.gates[1]) return this.say(pl, "It won't move. Something in the Haunted Hall is still up.", "bad");
    const out = this.playersIn(S).filter((p) => !p.dead && R.roomOf(p.x) !== 2); if (out.length) return this.say(pl, `Everybody alive has to be in here first. Waiting on ${out.map((p) => p.name).join(", ")}.`, "bad");
    this.cryptOpenGate(S, 2);
  };
  P.cryptExit = function (S, pl) {   // (v104) the stairs at the far end: up to the Forum, once he's dead
    if (!S.run) return; if (!S.run.cleared) return this.say(pl, "The Hoodie is between you and those stairs. Kill him first.", "bad");
    this.moveToScene(pl, C_.door.scene, null, C_.door); this.say(pl, "You climb out into daylight.", "good");
  };
  P.cryptDeath = function (pl, S) {   // no hospital bill: the ante is the stake. Back to the entrance; everybody down at once is a wipe.
    const run = S.run, now = Date.now(); pl.act = null; pl.path = []; pl.C.hp = G.maxHpOf(pl.C); this.emit(pl, "death", { pvp: false });
    if (run) run.died[pl.id] = now; pl.x = S.def.entry.x; pl.y = S.def.entry.y; pl.step = null; this.placeSafely(S, pl); this.touch(pl);
    this.say(pl, "You wake up at the bottom of the stairs. Get back in there.", "bad");
    const here = this.playersIn(S); if (run && here.length && here.every((p) => now - (run.died[p.id] || 0) < C_.wipeMs)) this.cryptEnd(S, "wipe");
  };
  P.cryptClear = function (S, now) {
    const run = S.run; if (!run || run.paid) return; run.paid = true; const T = C_.tiers[run.tier], secs = Math.round((now - run.started) / 1000), total = Object.values(run.dmg).reduce((a, b) => a + b, 0) || 1, here = this.playersIn(S), names = here.map((p) => p.name);
    run.cleared = { secs, total }; for (const p of here) this.cryptPayOne(S, p);
    for (const p of here) this.emit(p, "crypt", { tier: run.tier });   /* (2026-09-23) a cleared crypt is an event: the achievements that count them were only ever swept up at the next login */
    this.reportEnd(S, "crypt", "clear", { title: T.name, secs, best: this.cryptTop?.[run.tier]?.[0]?.secs ?? null });   /* (2026-09-28) the run report; the best is the one to beat, read before this clear joins it */
    this.cryptBest(run.tier, secs, names);
    for (const p of this.pls.values()) if (!here.includes(p)) p.out.push({ type: "casinonote", text: `🗝️ ${names.join(", ")} cleared ${T.name} in ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}.` });
    for (const p of here) this.say(p, "The way out is back where you came in. Take your time.", "good");
  };
  P.cryptPayOne = function (S, p) {   // exactly once each (run.paidTo), at the kill or, for somebody whose connection had dropped, when they are back
    const run = S.run, T = C_.tiers[run.tier]; if (!run.cleared || run.paidTo[p.id] || !run.members.includes(p.id)) return; run.paidTo[p.id] = true;
    const share = (run.dmg[p.id] || 0) / run.cleared.total, runs = this.cryptRunsToday(p);
    /* (2026-09-24) THE ARITHMETIC AND THE WRITE MOVED TO World.dungeonOwe, so the Pyramid pays by the same rules
       rather than by a second copy of them. What is left here is the Crypt's own flavour. */
    const { pay, low, late } = this.dungeonOwe(p, { key: "crypt", tier: run.tier, pay: T.pay, share, cfg: C_, runs });
    /* (v109) THE CLEAR'S TICKETS GO IN THE CHEST, not into the bag at the kill. What this player is owed is written ON THEIR CHARACTER
       (C.crypt.loot) so it cannot be lost to a crash, a lag-out or walking past it: the chest opens it, and anything still owed to
       somebody who is no longer in a crypt is sent after them (cryptLootSweep). */
    this.say(p, `THE HOODIE IS DOWN. His hoard is in front of the throne: a chest each. Open yours.${low ? " (Yours is lighter: you did under a tenth of the damage.)" : ""}${late ? " (And lighter again: that was past today's three paid runs.)" : ""}`, "loot");
    p.out.push({ type: "cryptwon", pay: 0, chest: true, secs: run.cleared.secs, tier: run.tier }); p.out.push(this.cryptGates(S));
  };
  /** the chest. `sent`: it was never opened and is being delivered */
  P.cryptLootOpen = function (S, pl) {
    if (pl.C.crypt?.loot) return this.cryptLootGive(pl, false);
    this.say(pl, S.run && !S.run.cleared ? "It won't open while he's alive." : "You've had yours. One each.", S.run && !S.run.cleared ? "bad" : undefined);
  };
  P.cryptLootGive = function (pl, sent) {
    const C = pl.C, L = C.crypt?.loot; if (!L) return; delete C.crypt.loot; this.touch(pl);   // gone from the character BEFORE anything is handed over: it can be opened once
    const { items } = R.rollLoot(L), got = [];
    for (const it of items) { if (it.k === "tickets") { this.tixTo(pl, it.n); got.push(it); continue; } if (!G.ITEMS[it.k]) continue; const where = this.keepRare(pl, it.k, it.n); if (where) got.push({ ...it, bank: where === "bank" || undefined }); }
    const T = C_.tiers[L.tier], names = got.filter((x) => x.k !== "tickets").map((x) => `${x.n > 1 ? x.n + " x " : ""}${G.ITEMS[x.k].name}`);
    this.say(pl, `${sent ? "The chest you left in the Crypt was sent up after you" : "You open the hoard"}: ${G.fmtTix(got[0]?.k === "tickets" ? got[0].n : 0)}${names.length ? `, ${names.join(", ")}` : ""}.${got.some((x) => x.bank) ? " (No room in your bag for some of it: it's in your bank.)" : ""}`, "loot");
    pl.out.push({ type: "cryptloot", tier: L.tier, items: got, sent: !!sent });
    if (Math.random() < Math.min(0.5, G.ZDROP.kill(G.MOBS["hoodie" + T.sfx].lvl) * C_.zdropMul)) this.zcoinDrop(pl, "the Hoodie's hoard");
    const gear = got.find((x) => G.ITEMS[x.k]?.slot); if (gear) for (const q of this.pls.values()) if (q !== pl) q.out.push({ type: "casinonote", text: `🗝️ ${pl.name} pulled ${G.ITEMS[gear.k].name} out of the Hoodie's hoard.` });
  };
  /** once a second: a chest owed to somebody who is online and NOT in a crypt any more goes to them (they walked out, were moved out, or logged back in after the run had gone) */
  P.cryptLootSweep = function () { for (const p of this.pls.values()) if (p.C.crypt?.loot && !inCrypt(p)) this.cryptLootGive(p, true); };
  P.cryptEnd = function (S, why) { const T = C_.tiers[S.run.tier]; if (why === "wipe") this.reportEnd(S, "crypt", "wipe", { title: T.name }); for (const p of this.playersIn(S)) { this.moveToScene(p, C_.door.scene, null, C_.door); this.say(p, why === "wipe" ? `A WIPE. Everybody down at once: the crypt keeps your ${G.fmtTix(T.ante)}.` : "The run is over.", "bad"); } (this.cryptGone ||= new Set()).add(S.key); this.scenes.delete(S.key); };
  P.cryptBest = function (tier, secs, names) { this.weekCount?.("clear", tier);   /* (2026-09-30) the weekly issue counts every clear (the kept list is capped) */ this.cryptTop ||= {}; const list = (this.cryptTop[tier] ||= []); list.push({ secs, names, at: Date.now() }); list.sort((a, b) => a.secs - b.secs); const kept = {}; this.cryptTop[tier] = list.filter((r) => { const n = r.names?.length || 0; kept[n] = (kept[n] || 0) + 1; return kept[n] <= 20; });   /* (2026-09-27) twenty PER PARTY SIZE, not twenty in all: the hiscores filter by 2-, 3- and 4-man, and a top twenty kept as one list would let a run of four-man clears push every pair off it */ this.ctx.storage.put("cryptTop", this.cryptTop).catch(() => {}); this.hsAt = 0; };
  /* once a second: parties hear each other's health while a run is on; an empty copy is thrown away */
  P.cryptTick = function (now) {
    for (const [key, S] of this.scenes) if (key.startsWith("crypt:")) {   // an empty copy is thrown away: at once if everybody walked out, after the held time if somebody's connection dropped
      if (this.playersIn(S).length) { if (S.run) S.run.emptyAt = 0; continue; } if (!S.run) { this.scenes.delete(key); continue; }
      S.run.emptyAt ||= now; const held = S.run.members.some((id) => !this.pls.has(id)) ? C_.rejoinMs : 5000;
      if (now - S.run.emptyAt > held && now - S.run.started > 5000) { (this.cryptGone ||= new Set()).add(key); this.scenes.delete(key); }
    }
    this.cryptLootSweep();
    for (const pt of [...(this.parties?.values() || [])]) for (const [id, a] of Object.entries(pt.away || {})) if (now - a.at > C_.rejoinMs && !this.pls.has(id)) this.partyDropId(pt, id);
    for (const pt of this.parties?.values() || []) { const sig = pt.members.map((id) => { const p = this.pls.get(id); return p ? `${p.C.scene}|${p.C.hp}|${G.maxHpOf(p.C)}` : "-"; }).join(";"); if (sig !== pt.sig) { pt.sig = sig; this.partyTell(pt); } }
  };
}
