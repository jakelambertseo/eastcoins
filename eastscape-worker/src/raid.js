/* ============================================================ THE YARD RAID (2026-09-30): the server's half. The rules are RAID and the four raid
   monsters at the end of the rules file; read the note there first.

   One raid at a time, started by an admin ("raid"), ended early by an admin ("raid end"). this.raid is
     { phase: "warn" | "on", at, until, nextWave, bossId, bossHp, by: { playerId: damage } }   and this.raidSack = { until } after a loss.
   THE WEST BANK: when the raid starts the Yard gets S.raidG, its grid with every cell east of RAID.zoneX walled off. The monster loop (index.js)
   paths raid monsters on that grid, never lets one pick a target over the river, and keeps its wander inside it; so nothing of the raid can
   cross into the court, and nobody in the court is chased or hit.
   The sack is kept in storage (a restart must not reopen the stalls early).
   (2026-09-30, after Cloudflare restarted the world mid-raid with 8 people in it and the raid simply vanished) SO IS THE RAID. Storage key "raid"
   holds this.raid as it was at most RAID_SAVE_MS ago (and at once when it starts, arrives or ends). On the way back up, raidResume puts it back:
   the clocks are pushed on by however long the world was down (at most RAID_GRACE_MS, so nobody loses fighting time to a blink), the Ice Man
   comes back at the health he had (raidTick already rebuilds him when he is missing: that was written for a rebuilt Yard), the next wave comes
   at once, everybody's share of the damage is still theirs, and CASINO says it carried on. A raid saved more than RAID_STALE_MS ago is dropped
   quietly: after that long down, nobody is standing on the west bank waiting for it. */
const RAID_SAVE_MS = 5000, RAID_GRACE_MS = 2 * 60000, RAID_STALE_MS = 10 * 60000;
export function installRaid(World, { G }) {
  const P = World.prototype, R = G.RAID;
  const scene = (w) => w.scenes.get(R.scene);
  const put = (S, t, x, y, hp, kind, now) => {
    const d = G.MOBS[t], id = `${S.key}raid${t}${now.toString(36)}${Math.floor(Math.random() * 1e4)}`;
    S.mobs.push({ id, t, x, y, hx: x, hy: y, hp, maxHp: hp, path: [], step: null, face: -1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: now, aggro: d.aggro, raid: kind });
    S.whoSig = null; return id;
  };
  const bm0 = (S, Rd) => { const m = S.mobs.find((x) => x.id === Rd.bossId); return m && !m.dead ? m : null; };
  const clear = (S) => { if (!S) return; S.mobs = S.mobs.filter((m) => !m.raid); S.whoSig = null; S.raidG = null; };
  const F = G.FLOOD;
  P.raidSave = function (now = Date.now(), force = false) {
    const Rd = this.raid;
    if (!Rd) { this.ctx.storage.delete("raid").catch(() => {}); return; }
    if (!force && now - (Rd.savedAt || 0) < RAID_SAVE_MS) return;
    { const b = scene(this)?.mobs.find((m) => m.id === Rd.bossId); if (b && !b.dead) Rd.bossHp = b.hp; }   /* his health as it is now, not as of the last tick */
    if (Rd.kind === "flood") { const S = scene(this); if (S?.flood) Rd.water = [...S.flood]; }   /* (2026-09-30) THE FLOOD: the water rides in the save */
    Rd.savedAt = now; this.ctx.storage.put("raid", { ...Rd, resumed: false }).catch(() => {});
  };
  /** the constructor hands over what storage had; what comes back is this.raid (or null) */
  P.raidResume = function (Rd, now = Date.now()) {
    if (!Rd || !Rd.phase) return null;
    const gap = Math.max(0, now - (Rd.savedAt || now));
    if (gap > RAID_STALE_MS) { this.ctx.storage.delete("raid").catch(() => {}); return null; }
    const shift = Math.min(gap, RAID_GRACE_MS);
    if (Rd.phase === "warn") Rd.at += shift;
    else { Rd.until += shift; Rd.nextWave = now; Rd.nextRise = now; if (Rd.nextFreeze) Rd.nextFreeze += shift; Rd.bossId = null; for (const sp of Rd.spots || []) sp.id = null; }   /* no boss on the map yet: raidTick puts him back at bossHp */
    Rd.by ||= {}; Rd.said ||= {}; Rd.resumed = true; Rd.savedAt = now;
    return Rd;
  };
  P.raidGrid = function (S) { S.raidG = S.g.map((row, y) => row.map((c, x) => (x > R.zoneX ? "#" : c))); };
  P.raidTick = function (now) {
    if (this.raidSack && now >= this.raidSack.until) { const wet = this.raidSack.kind === "flood"; this.raidSack = null; this.ctx.storage.delete("raidSack").catch(() => {}); if (wet) this.floodClear(scene(this)); this.houseSay(wet ? "\u{1F30A} The water's gone back down the river. The Yard's stalls are open again, if a bit damp." : "\u2744\uFE0F The frost has melted off the Yard's shutters. The stalls are open again. He will be back."); }
    if (this.raidSack?.kind === "flood" && this.raidSack.water && !this.raid) { const S0 = scene(this); if (S0 && !S0.flood) { S0.flood = new Set(this.raidSack.water); this.floodSend(S0); } }   /* a flooded Yard stays flooded across a restart */
    const Rd = this.raid; if (!Rd) return;
    const S = scene(this);
    this.raidSave(now);
    if (Rd.kind === "flood") { if (Rd.resumed && this.pls.size) { Rd.resumed = false; const left = Math.max(1, Math.round(((Rd.phase === "warn" ? Rd.at : Rd.until) - now) / 60000)); this.houseSay(`\u{1F30A} The world blinked, but the river didn't: THE FLOOD CARRIES ON, ${left} minute${left === 1 ? "" : "s"} left. Every sandbag you've laid still counts.`); } return this.floodTick(S, Rd, now); }
    if (Rd.resumed && this.pls.size) {   /* back from a restart: say so once somebody is here to hear it */
      Rd.resumed = false;
      const left = Math.max(1, Math.round(((Rd.phase === "warn" ? Rd.at : Rd.until) - now) / 60000));
      this.houseSay(Rd.phase === "warn" ? `\u2744\uFE0F The world blinked, but the north didn't: the Ice Man is still coming, about ${left} minute${left === 1 ? "" : "s"} out.` : `\u2744\uFE0F The world blinked, but the Ice Man didn't: THE RAID CARRIES ON, ${left} minute${left === 1 ? "" : "s"} left. Everything you've done to him still counts. Back to the west bank.`);
    }
    if (Rd.phase === "warn") {
      /* THE COUNTDOWN: CASINO calls each mark in R.warnAt (seconds left) once */
      for (const mk of R.warnAt || []) if (!Rd.said?.[mk] && Rd.at - now <= mk * 1000 && Rd.at - now > 0) {
        (Rd.said ||= {})[mk] = true;
        const CALL = { 240: "The frost is creeping south over the Gloam. The Ice Man reaches the Yard in 4 minutes.", 180: "War horns in the hills. The Ice Man reaches the Yard in 3 minutes.",
          120: "The river is freezing at its edges. The Ice Man reaches the Yard in 2 minutes. Get to the west bank.", 60: "You can hear them now. The Ice Man reaches the Yard in 1 minute." };
        this.houseSay(`❄️ RAID: ${CALL[mk] || (mk >= 60 ? `The Ice Man reaches the Yard in ${mk / 60} minutes.` : `${mk} SECONDS. Something is scratching at the north gate.`)}`);
      }
      if (now < Rd.at || !S) return;
      Rd.phase = "on"; Rd.until = now + R.lasts; Rd.nextWave = now; this.raidGrid(S);
      const online = Math.max(1, this.pls.size), hp = Math.min(R.hp.cap, R.hp.base + R.hp.per * online);
      Rd.bossId = put(S, R.boss.t, R.boss.at[0], R.boss.at[1], hp, "boss", now); Rd.bossHp = hp; Rd.bossMax = hp; this.raidSave(now, true);
      this.houseSay(`\u2744\uFE0F THE ICE MAN IS IN THE YARD. The north gate is splinters and his war party is pouring through it. ${Math.round(R.lasts / 60000)} minutes to break him before he breaks the Yard. They will not cross the river: stand on the west bank. Everyone who fights shares the spoils.`);
      for (const p of this.playersIn(S)) this.say(p, "The north gate splinters. Something enormous ducks under the arch, and the frost comes in with it.", "bad");
      return;
    }
    if (!S) return;
    const boss = S.mobs.find((m) => m.id === Rd.bossId);
    if (boss && !boss.dead) Rd.bossHp = boss.hp;
    else if (!boss && now < Rd.until) Rd.bossId = put(S, R.boss.t, R.boss.at[0], R.boss.at[1], Math.max(1, Rd.bossHp || R.hp.base), "boss", now), S.mobs.at(-1).maxHp = Math.max(Rd.bossHp || 1, Rd.bossMax || Math.min(R.hp.cap, R.hp.base + R.hp.per * Math.max(1, this.pls.size)));   /* (2026-09-30) bossMax: a resumed Ice Man's bar is out of what he started with */   /* the Yard was rebuilt under him: put him back as he was */
    if (!S.raidG) this.raidGrid(S);
    if (now >= Rd.until) return this.raidLost(S, now);
    /* DEEP FREEZE */
    if (bm0(S, Rd) && now >= (Rd.nextFreeze ??= now + R.freeze.first)) {
      const bm = bm0(S, Rd), F = R.freeze; Rd.nextFreeze = now + F.every[0] + Math.random() * (F.every[1] - F.every[0]);
      const pool = this.playersIn(S).filter((p) => (Rd.by[p.id] || 0) > 0 && p.C.hp > 0 && G.cheb(p, bm) <= F.range && p.x <= R.zoneX && !(p.frozenUntil > now));
      const k = Math.min(pool.length, F.cap, 1 + Math.floor(pool.length / F.perPlayers)), hit = [];
      for (let i = 0; i < k; i++) { const p = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; hit.push(p);
        p.frozenUntil = now + F.ms; p.path = []; p.act = null;
        const dmg = Math.max(1, Math.round(G.maxHpOf(p.C) * F.hit)); if (!p.god) { p.C.hp -= dmg; this.touch(p); }
        S.events.push({ type: "splat", who: `p:${p.id}`, n: dmg, kind: "hit", t: now }, { type: "frozen", who: p.id, ms: F.ms, t: now });
        this.say(p, `${G.MOBS[bm.t].name} turns his dead white eyes on you and casts DEEP FREEZE. The ice closes over you.`, "bad");
        if (p.C.hp <= 0) this.die(p, S, { mob: G.MOBS[bm.t].name });
      }
      if (hit.length) for (const p of this.playersIn(S)) if (!hit.includes(p)) this.say(p, `${G.MOBS[bm.t].name} casts DEEP FREEZE. ${hit.map((q) => q.name).join(", ")} ${hit.length === 1 ? "vanishes" : "vanish"} under the ice.`);
    }
    /* THE LAST WAVE: once, when he is down to R.last.at of his health */
    const bm = S.mobs.find((m) => m.id === Rd.bossId);
    if (!Rd.last && bm && !bm.dead && bm.hp <= (bm.maxHp || R.hp.base) * R.last.at) {
      Rd.last = true;
      const bag = R.last.kinds.flatMap(([t, w]) => Array(w).fill(t));
      for (let i = 0; i < R.last.count; i++) { const [x, y] = R.gates[i % R.gates.length], t = bag[i % bag.length]; put(S, t, x, y, G.MOBS[t].hp, "wave", now); }
      this.houseSay("\u2744\uFE0F The Ice Man is bleeding, and he knows it. He roars for his huscarls: THE LAST WAVE is coming through the gates. Do not let him walk out of the Yard.");
    }
    if (now >= Rd.nextWave) {
      Rd.nextWave = now + R.waveEvery;
      const alive = S.mobs.filter((m) => m.raid === "wave" && !m.dead).length, want = Math.min(R.wave.cap, R.wave.base + Math.floor(this.pls.size / R.wave.perPlayers)) - alive;
      const bag = R.wave.kinds.flatMap(([t, w]) => Array(w).fill(t));
      for (let i = 0; i < want; i++) { const [x, y] = R.gates[i % R.gates.length], t = bag[Math.floor(Math.random() * bag.length)]; if (!this.occupied(S, x, y)) put(S, t, x, y, G.MOBS[t].hp, "wave", now); }
      if (want > 0) for (const p of this.playersIn(S)) this.say(p, "The gates groan. More of them come through, and they are not afraid of you.", "bad");
    }
  };
  /* every point of damage on anything of the raid, from any source (bossAdd is the one call every damage path makes) */
  const bossAdd = P.bossAdd;
  P.bossAdd = function (pl, m, key, n) {
    if (key === "dmg" && m?.raid && this.raid && n > 0 && pl) this.raid.by[pl.id] = (this.raid.by[pl.id] || 0) + n;
    return bossAdd.call(this, pl, m, key, n);
  };
  /* from killMob: a raid monster's corpse never comes back; the Ice Man falling wins it */
  P.raidKill = function (S, m, pl, now) {
    m.respawnAt = Infinity; S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null;
    if (m.raid === "boss" && this.raid) this.raidWon(S, pl, now);
  };
  P.raidWon = function (S, pl, now) {
    const Rd = this.raid, flood = Rd.kind === "flood", PAY = flood ? F.pay : R.pay; this.raid = null; this.raidSave(now, true); clear(S); if (flood) this.floodClear(S); this.weekCount?.("raid", "won");   /* (2026-09-30) the weekly issue */
    const rows = Object.entries(Rd.by).filter(([, d]) => d > 0), total = rows.reduce((a, [, d]) => a + d, 0) || 1, pool = PAY.pool + PAY.per * rows.length, paid = [];
    for (const [id, d] of rows.sort((a, b) => b[1] - a[1])) {
      const n = Math.max(PAY.floor, Math.round((pool * d) / total)), p = this.pls.get(id);
      if (p) { this.tixTo(p, n, "raid"); this.say(p, flood ? `The Undertow goes back under, and the water goes with it. The Yard is dry. Your share: ${G.fmtTix(n)} (${Math.round((100 * d) / total)}% of the work, sandbags and fighting alike).` : `The ice cracks, and the Ice Man falls. The Yard is saved. Your share of the spoils: ${G.fmtTix(n)} (${Math.round((100 * d) / total)}% of the fighting).`, "loot"); }
      paid.push([p?.name || "someone", n]);
    }
    const top = paid.slice(0, 3).map(([nm, n]) => `${nm} (${n.toLocaleString()})`).join(", ");
    if (flood) { this.houseSay(`\u{1F30A} ${pl.name} landed the last blow: THE UNDERTOW IS BEATEN, and the river goes back where it belongs. ${rows.length} of you held the water back, sandbags and swords alike, and every one shares the spoils. Top: ${top}.`); for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: "\u{1F30A} The flood is beaten. The Yard is dry." }); return; }
    this.houseSay(`\u2744\uFE0F ${pl.name} landed the last blow: THE ICE MAN IS DOWN, and the frost lifts off the Yard. ${rows.length} stood against him and every one of them shares the spoils. Top: ${top}.`);
    for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: "\u2744\uFE0F The Ice Man is down. The Yard stands." });
  };
  P.raidLost = function (S, now) {
    const boss = S.mobs.find((m) => m.id === this.raid.bossId);
    if (boss) this.bossEnd(S, boss, "escaped");
    if (this.raid.kind === "flood") {   /* (2026-09-30) THE FLOOD lost: the water stays while the stalls are shut, then goes */
      this.raid = null; this.raidSave(now, true); clear(S); this.weekCount?.("raid", "lost");
      this.raidSack = { until: now + R.sackMs, kind: "flood", water: [...(S.flood || [])] }; this.ctx.storage.put("raidSack", this.raidSack).catch(() => {});
      this.houseSay(`\u{1F30A} THE YARD IS UNDER WATER. The river came over the bank and nobody held it. Bom, Nestor, Livia and Hexa have put the shutters up for ${Math.round(R.sackMs / 60000)} minutes, and you'll be wading till they open.`);
      return;
    }
    this.raid = null; this.raidSave(now, true); clear(S); this.weekCount?.("raid", "lost");   /* (2026-09-30) the weekly issue */
    this.raidSack = { until: now + R.sackMs }; this.ctx.storage.put("raidSack", this.raidSack).catch(() => {});
    this.houseSay(`\u2744\uFE0F THE ICE MAN'S WAR PARTY HAS SACKED THE YARD. They walked out with the frost behind them and nobody stopped them. Bom, Nestor, Livia and Hexa are boarded up for ${Math.round(R.sackMs / 60000)} minutes. He will remember how easy it was.`);
  };
  /* the dispatcher asks: is this op closed because the Yard is sacked? */
  P.raidClosed = function (op) { return !!this.raidSack && Date.now() < this.raidSack.until && R.closes.includes(op); };
  P.raidState = function (now = Date.now()) {
    if (this.raid?.kind === "flood") { const S = scene(this), land = S?.floodLandN || 1; return { kind: "flood", phase: this.raid.phase, leftS: Math.max(0, Math.round(((this.raid.phase === "warn" ? this.raid.at : this.raid.until) - now) / 1000)), water: Math.round((100 * (S?.flood?.size || 0)) / land), held: (this.raid.spots || []).filter((x) => x.held).length, hp: this.raid.bossHp || null, fighters: Object.keys(this.raid.by).length }; }
    if (this.raid) return { phase: this.raid.phase, leftS: Math.max(0, Math.round(((this.raid.phase === "warn" ? this.raid.at : this.raid.until) - now) / 1000)), hp: this.raid.bossHp, fighters: Object.keys(this.raid.by).length };
    return this.raidSack ? { sacked: true, leftS: Math.max(0, Math.round((this.raidSack.until - now) / 1000)) } : null;
  };
  P.raidAdmin = function (S, pl, arg, note) {
    const now = Date.now();
    if (arg === "end") { if (!this.raid) return note("There's no raid on."); const Sx = scene(this), flood = this.raid.kind === "flood"; this.raid = null; this.raidSave(now, true); clear(Sx); if (flood) this.floodClear(Sx); this.houseSay(flood ? "\u{1F30A} The river drops back below the bank. Nobody knows why." : "\u2744\uFE0F The war party melts back into the north. For now."); return note("Raid ended."); }
    if (arg === "unsack") { const wet = this.raidSack?.kind === "flood"; this.raidSack = null; this.ctx.storage.delete("raidSack").catch(() => {}); if (wet) this.floodClear(scene(this)); return note("The Yard's stalls are open again."); }
    if (arg === "flood") { if (this.raid) return note(`A raid is already ${this.raid.phase === "warn" ? "on its way" : "on"}.`); this.raidCall(null, now, "flood"); return note(`The Flood started: the river comes over in ${Math.round(F.warnMs / 60000)} minutes.`); }   /* (2026-09-30) THE FLOOD */
    if (arg === "now") { if (this.raid?.phase !== "warn") return note("Start a raid first; this skips its warning."); this.raid.at = now; this.raidTick(now); return note("The warning is skipped: the Ice Man is in the Yard."); }   /* for trying it on dev */
    if (this.raid) return note(`A raid is already ${this.raid.phase === "warn" ? "on its way" : "on"}.`);
    this.raidCall(null, now);
    return note(`Raid started: the Ice Man arrives in ${Math.round(R.warnMs / 60000)} minutes.`);
  };
  /* (2026-09-30) THE CALL, from an admin or from the Store's War Horn (`horn` names whoever blew it). Either one starts the three hours
     hornWhy() waits out before the horn can be blown again, kept in storage so a restart does not reset it. */
  P.raidCall = function (horn, now = Date.now(), kind = "ice") {
    if (this.raid) return false;
    if (kind === "flood") {   /* (2026-09-30) THE FLOOD */
      this.raid = { kind: "flood", phase: "warn", at: now + F.warnMs, by: {}, said: {} }; this.raidSave(now, true);
      this.raidLast = now; this.ctx.storage.put("raidLast", now).catch(() => {});
      this.houseSay(`\u{1F30A} FLOOD! It hasn't stopped raining since the King went down, and the Yard's river is right at the top of its bank. ${Math.round(F.warnMs / 60000)} minutes. Bring wood, ore and sand: when it comes over, sandbags are the only thing that will hold it.`);
      for (const p of this.pls.values()) { p.out.push({ type: "casinonote", text: "\u{1F30A} FLOOD! The Yard's river is about to come over the bank." }); p.out.push({ type: "raid", on: true }); }
      return true;
    }
    this.raid = { phase: "warn", at: now + R.warnMs, by: {}, said: {}, horn: horn || null }; this.raidSave(now, true);
    this.raidLast = now; this.ctx.storage.put("raidLast", now).catch(() => {});
    const mins = Math.round(R.warnMs / 60000);
    if (horn) this.houseSay(`\u{1F4EF} ${horn} HAS BLOWN THE WAR HORN. The note rolls north over the hills, and something up there answers it.`);
    this.houseSay(`\u2744\uFE0F RAID! The air over the Yard has turned cold, and the pumpkins are frosting over. Something is coming down from the north: the Ice Man and his war party, ${mins} minutes out. Take up arms on the west bank. Everyone who bleeds for the Yard shares the spoils. If it falls, its stalls are ransacked.`);
    for (const p of this.pls.values()) { p.out.push({ type: "casinonote", text: "\u2744\uFE0F RAID! Frost is creeping over the Yard. Something is coming." }); p.out.push({ type: "raid", on: true }); }
    return true;
  };
  /* ================================================================ THE FLOOD (2026-09-30): see FLOOD in the rules file first */
  const idx = (x, y) => y * G.COLS + x, xy = (i) => [i % G.COLS, Math.floor(i / G.COLS)];
  P.floodSend = function (S) { if (!S) return; const msg = { type: "flood", scene: S.key, tiles: [...(S.flood || [])] }; for (const p of this.playersIn(S)) p.out.push(msg); };
  P.floodClear = function (S) { if (!S) return; S.flood = null; for (const p of this.pls.values()) p.out.push({ type: "flood", scene: R.scene, tiles: [] }); };
  const putBag = (S, Rd, i, now) => {
    const sp = Rd.spots[i], [x, y] = F.spots[i].at, M = G.FLOOD_MATS[sp.mat];
    const id = put(S, "sandbag", x, y, 1, "bag", now), m = S.mobs.at(-1);
    Object.assign(m, { bag: true, spot: i, maxHp: sp.need + 1, hp: sp.got + 1, nm: sp.held ? "Sandbags · held" : `Sandbags · ${M.name} ${sp.got}/${sp.need}`, aggro: 0, perch: true });
    sp.id = id;
  };
  /* the tiles a held spot keeps dry */
  const dryOf = (Rd) => { const out = new Set(); for (const sp of Rd.spots || []) if (sp.held) { const [sx, sy] = F.spots[sp.i].at; for (let y = sy - F.protect; y <= sy + F.protect; y++) for (let x = sx - F.protect; x <= sx + F.protect; x++) out.add(idx(x, y)); } return out; };
  P.floodTick = function (S, Rd, now) {
    if (Rd.phase === "warn") {
      for (const mk of F.warnAt) if (!Rd.said?.[mk] && Rd.at - now <= mk * 1000 && Rd.at - now > 0) {
        (Rd.said ||= {})[mk] = true;
        this.houseSay(`\u{1F30A} FLOOD: ${{ 120: "The river's lapping at the top of the bank. Two minutes. Get your wood, ore and sand out of the bank.", 60: "Water's coming through the reeds. One minute.", 30: "30 SECONDS. The bank's going." }[mk] || `${mk} seconds.`}`);
      }
      if (now < Rd.at || !S) return;
      const online = Math.max(1, this.pls.size), need = Math.min(F.need.cap, F.need.base + F.need.per * online);
      Object.assign(Rd, { phase: "on", until: now + F.lasts, nextRise: now, nextWave: now + 15000, drain: false,
        spots: F.spots.map((sp, i) => ({ i, mat: sp.mat, need: sp.mat === "sand" ? Math.max(20, Math.round(need * F.need.sand)) : need, got: 0, held: false, id: null })) });
      S.flood = new Set(); S.floodLand = G.floodLand(S.g); S.floodLandN = S.floodLand.length; this.raidGrid(S);
      Rd.spots.forEach((_, i) => putBag(S, Rd, i, now));
      this.raidSave(now, true);
      this.houseSay(`\u{1F30A} THE RIVER'S OVER THE BANK. It's coming up out of the pond and the river both, and things are coming up with it. Five sandbag spots on the west bank: wood, ore, sand, whatever they ask for. Fill one and the water behind it goes. ${Math.round(F.lasts / 60000)} minutes.`);
      for (const p of this.playersIn(S)) this.say(p, "The pond heaves, and the water comes over the bank onto the grass.", "bad");
      return;
    }
    if (!S) return;
    /* after a restart: the water, the spots and the Undertow come back as they were */
    if (!S.floodLand) { S.floodLand = G.floodLand(S.g); S.floodLandN = S.floodLand.length; }
    if (!S.flood) { S.flood = new Set(Rd.water || []); this.floodSend(S); }
    if (!S.raidG) this.raidGrid(S);
    for (const sp of Rd.spots || []) if (!sp.id || !S.mobs.some((m) => m.id === sp.id)) putBag(S, Rd, sp.i, now);
    const boss = Rd.drain ? S.mobs.find((m) => m.id === Rd.bossId) : null;
    if (boss && !boss.dead) Rd.bossHp = boss.hp;
    else if (Rd.drain && !boss && now < Rd.until) { const [bx, by] = F.boss.at; Rd.bossId = put(S, F.boss.t, bx, by, Math.max(1, Rd.bossHp || F.hp.base), "boss", now); S.mobs.at(-1).maxHp = Math.max(Rd.bossHp || 1, Rd.bossMax || F.hp.base); }
    if (now >= Rd.until) return this.raidLost(S, now);
    /* THE WATER: up while any spot is open, down once all five are held */
    if (now >= (Rd.nextRise || 0)) {
      Rd.nextRise = now + F.riseMs;
      const dry = dryOf(Rd); let changed = false;
      for (const i of [...S.flood]) if (dry.has(i)) { S.flood.delete(i); changed = true; }
      if (Rd.drain) { const all = [...S.flood]; for (let k = 0; k < F.drain && all.length; k++) { S.flood.delete(all.splice(Math.floor(Math.random() * all.length), 1)[0]); changed = true; } }
      else {
        const wet = (x, y) => G.floodWetAt(S.g, x, y) || S.flood.has(idx(x, y));
        const edge = S.floodLand.filter((i) => { if (S.flood.has(i) || dry.has(i)) return false; const [x, y] = xy(i); return wet(x + 1, y) || wet(x - 1, y) || wet(x, y + 1) || wet(x, y - 1); });
        for (let k = 0; k < F.rise && edge.length; k++) { S.flood.add(edge.splice(Math.floor(Math.random() * edge.length), 1)[0]); changed = true; }
      }
      if (changed) this.floodSend(S);
      if (!Rd.drain && S.flood.size >= F.lose * S.floodLandN) return this.raidLost(S, now);
    }
    /* THE DROWNED climb out of the water, never over the river */
    if (!Rd.drain && now >= Rd.nextWave) {
      Rd.nextWave = now + F.wave.every;
      const alive = S.mobs.filter((m) => m.raid === "wave" && !m.dead).length, want = Math.min(F.wave.cap, F.wave.base + Math.floor(this.pls.size / F.wave.perPlayers)) - alive;
      const from = [...S.flood].filter((i) => { const [x, y] = xy(i); return !this.occupied(S, x, y); }), bag = F.wave.kinds.flatMap(([t, w]) => Array(w).fill(t));
      const pool = from.length ? from : S.floodLand.filter((i) => { const [x, y] = xy(i); return (G.floodWetAt(S.g, x + 1, y) || G.floodWetAt(S.g, x - 1, y) || G.floodWetAt(S.g, x, y + 1) || G.floodWetAt(S.g, x, y - 1)) && !this.occupied(S, x, y); });
      for (let k = 0; k < want && pool.length; k++) { const [x, y] = xy(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]), t = bag[Math.floor(Math.random() * bag.length)]; put(S, t, x, y, G.MOBS[t].hp, "wave", now); }
      if (want > 0) for (const p of this.playersIn(S)) this.say(p, "Something pulls itself up out of the water.", "bad");
    }
  };
  /* a click on a sandbag spot: hand in what it asks for, from your bag (doAction hands it over, like a star) */
  P.floodBag = function (S, pl, m, a, now) {
    const Rd = this.raid; if (!Rd || Rd.kind !== "flood" || Rd.phase !== "on") { pl.act = null; return; }
    if (G.cheb(pl, m) > 1) { const p = G.findPath(S.g, pl, m, 1); if (p && p.length) pl.path = p; else if (!p) { pl.act = null; this.say(pl, "You can't get to those sandbags from here.", "bad"); } return; }
    pl.act = null;
    const sp = Rd.spots?.[m.spot]; if (!sp) return;
    if (sp.held) return this.say(pl, "That spot's full and holding. Help with another.");
    const M = G.FLOOD_MATS[sp.mat], C = pl.C, keys = [...new Set(C.inv.filter((x) => x && x.k && M.test(x.k) && !G.isFav?.(C, x.k)).map((x) => x.k))];
    let left = sp.need - sp.got, took = 0;
    for (const k of keys) { if (left <= 0) break; const t = G.takeInv(C.inv, k, Math.min(left, G.countItems({ inv: C.inv, bank: [] }, [k]))); took += t; left -= t; }
    if (!took) return this.say(pl, `This spot wants ${M.name}: ${M.ex}. You've none in your bag${C.inv.some((x) => x && M.test(x.k)) ? " that isn't favourited" : ""}.`, "bad");
    sp.got += took; Rd.by[pl.id] = (Rd.by[pl.id] || 0) + took * F.handValue; this.touch(pl);
    m.hp = sp.got + 1; m.hurtAt = now; m.nm = `Sandbags · ${M.name} ${sp.got}/${sp.need}`; S.whoSig = null;   /* one over the count, so an empty spot is not a dead one (the page draws hp-1 of maxHp-1) */
    S.events.push({ type: "splat", who: m.id, n: took, kind: "hit", t: now });
    this.say(pl, `You pile ${took.toLocaleString()} ${M.name} on the sandbags (${sp.got.toLocaleString()} of ${sp.need.toLocaleString()}).`, "good");
    if (sp.got >= sp.need) {
      sp.held = true; m.hp = m.maxHp = sp.need + 1; m.nm = "Sandbags · held";
      const held = Rd.spots.filter((x) => x.held).length;
      for (const i of [...(S.flood || [])]) if (dryOf(Rd).has(i)) S.flood.delete(i);
      this.floodSend(S);
      if (held < Rd.spots.length) this.houseSay(`\u{1F30A} ${pl.name} finishes a wall of sandbags: ${held} of ${Rd.spots.length} spots holding, and the water behind it is draining.`);
      else {
        Rd.drain = true;
        const online = Math.max(1, this.pls.size), hp = Math.min(F.hp.cap, F.hp.base + F.hp.per * online), [bx, by] = F.boss.at;
        Rd.bossId = put(S, F.boss.t, bx, by, hp, "boss", now); Rd.bossHp = hp; Rd.bossMax = hp;
        this.houseSay(`\u{1F30A} ALL FIVE ARE HOLDING. The water's going back down... and something big is coming up out of the pond with it. THE UNDERTOW is on the grass north of the pond. Put it back under before the time's up.`);
      }
      this.raidSave(now, true);
    }
  };
  for (const k of ["raidTick", "raidKill", "raidWon", "raidLost", "raidState", "raidCall", "raidSave", "raidResume", "floodTick", "floodBag", "floodSend", "floodClear"]) {   /* nothing here may break the world's tick or a kill */
    const f = P[k]; P[k] = function (...a) { try { return f.apply(this, a); } catch (e) { console.error(k, e); return null; } };
  }
}
