/* ============================================================ THE YARD RAID (2026-09-30): the server's half. The rules are RAID and the four raid
   monsters at the end of the rules file; read the note there first.

   One raid at a time, started by an admin ("raid"), ended early by an admin ("raid end"). this.raid is
     { phase: "warn" | "on", at, until, nextWave, bossId, bossHp, by: { playerId: damage } }   and this.raidSack = { until } after a loss.
   THE WEST BANK: when the raid starts the Yard gets S.raidG, its grid with every cell east of RAID.zoneX walled off. The monster loop (index.js)
   paths raid monsters on that grid, never lets one pick a target over the river, and keeps its wander inside it; so nothing of the raid can
   cross into the court, and nobody in the court is chased or hit.
   The sack is kept in storage (a restart must not reopen the stalls early); the raid itself is not: a restart mid-raid ends it quietly. */
export function installRaid(World, { G }) {
  const P = World.prototype, R = G.RAID;
  const scene = (w) => w.scenes.get(R.scene);
  const put = (S, t, x, y, hp, kind, now) => {
    const d = G.MOBS[t], id = `${S.key}raid${t}${now.toString(36)}${Math.floor(Math.random() * 1e4)}`;
    S.mobs.push({ id, t, x, y, hx: x, hy: y, hp, maxHp: hp, path: [], step: null, face: -1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: now, aggro: d.aggro, raid: kind });
    S.whoSig = null; return id;
  };
  const clear = (S) => { if (!S) return; S.mobs = S.mobs.filter((m) => !m.raid); S.whoSig = null; S.raidG = null; };
  P.raidGrid = function (S) { S.raidG = S.g.map((row, y) => row.map((c, x) => (x > R.zoneX ? "#" : c))); };
  P.raidTick = function (now) {
    if (this.raidSack && now >= this.raidSack.until) { this.raidSack = null; this.ctx.storage.delete("raidSack").catch(() => {}); this.houseSay("❄️ The Yard's stalls are open again. Hrimgar will be back one day."); }
    const Rd = this.raid; if (!Rd) return;
    const S = scene(this);
    if (Rd.phase === "warn") {
      if (now < Rd.at || !S) return;
      Rd.phase = "on"; Rd.until = now + R.lasts; Rd.nextWave = now; this.raidGrid(S);
      const online = Math.max(1, this.pls.size), hp = Math.min(R.hp.cap, R.hp.base + R.hp.per * online);
      Rd.bossId = put(S, R.boss.t, R.boss.at[0], R.boss.at[1], hp, "boss", now); Rd.bossHp = hp;
      this.houseSay(`❄️ HRIMGAR IS IN THE YARD with his war party. ${Math.round(R.lasts / 60000)} minutes to put him down or the Yard's stalls are sacked. They cannot cross the river into the court. Everyone who fights shares the spoils.`);
      for (const p of this.playersIn(S)) this.say(p, "The north gate shakes, and frost giants pour into the Yard.", "bad");
      return;
    }
    if (!S) return;
    const boss = S.mobs.find((m) => m.id === Rd.bossId);
    if (boss && !boss.dead) Rd.bossHp = boss.hp;
    else if (!boss && now < Rd.until) Rd.bossId = put(S, R.boss.t, R.boss.at[0], R.boss.at[1], Math.max(1, Rd.bossHp || R.hp.base), "boss", now), S.mobs.at(-1).maxHp = Math.max(Rd.bossHp || 1, Math.min(R.hp.cap, R.hp.base + R.hp.per * Math.max(1, this.pls.size)));   /* the Yard was rebuilt under him: put him back as he was */
    if (!S.raidG) this.raidGrid(S);
    if (now >= Rd.until) return this.raidLost(S, now);
    if (now >= Rd.nextWave) {
      Rd.nextWave = now + R.waveEvery;
      const alive = S.mobs.filter((m) => m.raid === "wave" && !m.dead).length, want = Math.min(R.wave.cap, R.wave.base + Math.floor(this.pls.size / R.wave.perPlayers)) - alive;
      const bag = R.wave.kinds.flatMap(([t, w]) => Array(w).fill(t));
      for (let i = 0; i < want; i++) { const [x, y] = R.gates[i % R.gates.length], t = bag[Math.floor(Math.random() * bag.length)]; if (!this.occupied(S, x, y)) put(S, t, x, y, G.MOBS[t].hp, "wave", now); }
      if (want > 0) for (const p of this.playersIn(S)) this.say(p, "More of the war party comes through the gates.", "bad");
    }
  };
  /* every point of damage on anything of the raid, from any source (bossAdd is the one call every damage path makes) */
  const bossAdd = P.bossAdd;
  P.bossAdd = function (pl, m, key, n) {
    if (key === "dmg" && m?.raid && this.raid && n > 0 && pl) this.raid.by[pl.id] = (this.raid.by[pl.id] || 0) + n;
    return bossAdd.call(this, pl, m, key, n);
  };
  /* from killMob: a raid monster's corpse never comes back; Hrimgar falling wins it */
  P.raidKill = function (S, m, pl, now) {
    m.respawnAt = Infinity; S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null;
    if (m.raid === "boss" && this.raid) this.raidWon(S, pl, now);
  };
  P.raidWon = function (S, pl, now) {
    const Rd = this.raid; this.raid = null; clear(S);
    const rows = Object.entries(Rd.by).filter(([, d]) => d > 0), total = rows.reduce((a, [, d]) => a + d, 0) || 1, pool = R.pay.pool + R.pay.per * rows.length, paid = [];
    for (const [id, d] of rows.sort((a, b) => b[1] - a[1])) {
      const n = Math.max(R.pay.floor, Math.round((pool * d) / total)), p = this.pls.get(id);
      if (p) { this.tixTo(p, n); this.say(p, `The Yard is saved. Your share of the spoils: ${G.fmtTix(n)} (${Math.round((100 * d) / total)}% of the fighting).`, "loot"); }
      paid.push([p?.name || "someone", n]);
    }
    const top = paid.slice(0, 3).map(([nm, n]) => `${nm} (${n.toLocaleString()})`).join(", ");
    this.houseSay(`❄️ ${pl.name} landed the last blow: HRIMGAR IS DOWN and the Yard is saved! ${rows.length} fought, and the spoils went to all of them. Top: ${top}.`);
    for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: "❄️ The Yard is saved! Hrimgar is down." });
  };
  P.raidLost = function (S, now) {
    const boss = S.mobs.find((m) => m.id === this.raid.bossId);
    if (boss) this.bossEnd(S, boss, "escaped");
    this.raid = null; clear(S);
    this.raidSack = { until: now + R.sackMs }; this.ctx.storage.put("raidSack", this.raidSack).catch(() => {});
    this.houseSay(`❄️ Time's up: HRIMGAR'S WAR PARTY HAS SACKED THE YARD. Bom, Nestor, Livia and Hexa are boarded up for ${Math.round(R.sackMs / 60000)} minutes. Nobody lost anything but their pride.`);
  };
  /* the dispatcher asks: is this op closed because the Yard is sacked? */
  P.raidClosed = function (op) { return !!this.raidSack && Date.now() < this.raidSack.until && R.closes.includes(op); };
  P.raidState = function (now = Date.now()) {
    if (this.raid) return { phase: this.raid.phase, leftS: Math.max(0, Math.round(((this.raid.phase === "warn" ? this.raid.at : this.raid.until) - now) / 1000)), hp: this.raid.bossHp, fighters: Object.keys(this.raid.by).length };
    return this.raidSack ? { sacked: true, leftS: Math.max(0, Math.round((this.raidSack.until - now) / 1000)) } : null;
  };
  P.raidAdmin = function (S, pl, arg, note) {
    const now = Date.now();
    if (arg === "end") { if (!this.raid) return note("There's no raid on."); const Sx = scene(this); this.raid = null; clear(Sx); this.houseSay("❄️ The war party pulls back out of the Yard."); return note("Raid ended."); }
    if (arg === "unsack") { this.raidSack = null; this.ctx.storage.delete("raidSack").catch(() => {}); return note("The Yard's stalls are open again."); }
    if (this.raid) return note(`A raid is already ${this.raid.phase === "warn" ? "on its way" : "on"}.`);
    this.raid = { phase: "warn", at: now + R.warnMs, by: {} };
    this.houseSay(`❄️ RAID! A frost giant war party is marching on the Yard from the north. ${Math.round(R.warnMs / 1000)} seconds. Get to the Yard and hold the west bank: everyone who fights shares the spoils, and if they win, the stalls are sacked.`);
    for (const p of this.pls.values()) { p.out.push({ type: "casinonote", text: "❄️ RAID! Frost giants are marching on the Yard." }); p.out.push({ type: "raid", on: true }); }
    return note(`Raid started: Hrimgar arrives in ${Math.round(R.warnMs / 1000)} seconds.`);
  };
  for (const k of ["raidTick", "raidKill", "raidWon", "raidLost", "raidState"]) {   /* nothing here may break the world's tick or a kill */
    const f = P[k]; P[k] = function (...a) { try { return f.apply(this, a); } catch (e) { console.error(k, e); return null; } };
  }
}
