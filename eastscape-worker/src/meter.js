/* ============================================================ THE PARTY METER (2026-09-28), the server's half. The owner: "lets build the
   party damage meters on dev server", from the sketch in mockups-archive/eastscape-dungeon-report.html (World of Warcraft's Details!/Recount:
   everybody in the party ranked by what they did, bars coloured by fighting style).

   A PARTY'S NUMBERS, anywhere it fights: the open world, the dungeons, the King. Per member: damage dealt (every hit that pays combat xp,
   so storm arcs and burns count), damage taken (monsters, traps, the Hoodie's slam, the Squeeze's coil, other players), HP healed by food,
   deaths and kills. Nothing here changes a fight; it only counts.

   TWO WINDOWS OF TIME, which is what Details! calls segments:
     run    since the party formed, the last reset, or the moment it began a new dungeon run (a member's first hit in a crypt:/pyramid:/count:
            copy the run has not seen resets it, so a dungeon's numbers are the dungeon's own)
     fight  one burst of combat: it starts on the first hit after FIGHT_GAP of quiet, and when it goes quiet the page keeps showing it as
            "last fight" until the next one starts. Eating counts toward the fight you are in, but never starts one.
   Kept on the party object (pt.meter), so it goes when the party goes; nothing is saved.

   WHAT IT COSTS: a few additions on paths that already run on every hit, and at most ONE small message a second to each member of a party
   whose numbers changed (meterTick, from the world's once-a-second tick). No new poll. */
export function installMeter(World, { G }) {
  const P = World.prototype, FIGHT_GAP = 12000, KEYS = ["dmg", "taken", "heal", "deaths", "kills"];
  const seg = (now) => ({ at: now, last: 0, by: {}, foe: null, foeLvl: -1, log: [], kb: null, bossAt: 0 });
  /* keys that are counted but never START a fight: eating, and xp (which also comes from skilling) */
  const QUIET = new Set(["heal", "eat", "xp"]), TL_MS = 10000;   /* ten-second buckets: a one-minute wipe still draws a line worth reading */
  /* a member's row: the meter's five numbers, and what the end-of-run report adds: food by kind, swings and hits (accuracy), xp by skill,
     and damage in 30-second buckets for the report's chart */
  const blank = () => ({ dmg: 0, taken: 0, heal: 0, deaths: 0, kills: 0, eat: 0, swing: 0, hit: 0, eats: {}, xp: {}, tl: [] });
  const zoneOf = (pl) => { const k = String(pl.C.scene || ""); return /^(crypt|pyramid|count):/.test(k) ? k : null; };

  /* the party to count for: yours, or (inside a dungeon, with no party: an admin testing alone) one of your own that nobody else sees */
  P.meterParty = function (pl) { const pt = this.partyOf?.(pl); if (pt) return pt; if (!zoneOf(pl)) return null; return (pl.soloPt ||= { id: `solo:${pl.id}`, leader: pl.id, members: [pl.id], solo: true }); };
  P.meterAdd = function (pl, key, n, foe, extra) {
    if (!pl || !(n > 0)) return;
    const pt = this.meterParty(pl); if (!pt) return;
    const now = Date.now(), zone = zoneOf(pl);
    let M = pt.meter;
    if (!M || (zone && M.zone !== zone)) { M = pt.meter = { run: seg(now), fight: null, zone, sent: 0 }; }   /* a fresh party, or a new dungeon run */
    const combat = !QUIET.has(key);
    if (combat && (!M.fight || now - M.fight.last > FIGHT_GAP)) M.fight = seg(now);
    const live = M.fight && now - M.fight.last <= FIGHT_GAP ? M.fight : null;
    for (const s of [M.run, combat ? M.fight : live]) {
      if (!s) continue;
      const r = (s.by[pl.id] ||= blank());
      r.name = pl.name; r.style = G.styleOf(pl.C);
      if (key === "eat") { r.eat += n; if (extra) r.eats[extra] = (r.eats[extra] || 0) + n; }
      else if (key === "xp") { if (extra) r.xp[extra] = (r.xp[extra] || 0) + n; }
      else r[key] = (r[key] || 0) + n;
      if (key === "dmg") { const b = Math.floor((now - s.at) / TL_MS); r.tl[b] = (r.tl[b] || 0) + n; }
      if (key === "deaths") s.log.push({ t: Math.round((now - s.at) / 1000), id: pl.id, name: pl.name, cause: extra || null, food: G.countItems({ inv: pl.C.inv, bank: [] }, Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].heal)) });
      if (combat) s.last = now;
      const mob = foe && G.MOBS[foe.t];
      if (mob && (mob.lvl || 0) > s.foeLvl) { s.foeLvl = mob.lvl || 0; s.foe = mob.name || foe.t; }
      if (mob?.boss && !s.bossAt) s.bossAt = now;
      if (key === "kills" && mob?.boss) s.kb = { id: pl.id, name: pl.name, boss: mob.name };
    }
    M.dirty = true;
  };
  P.meterReset = function (pl) {
    const pt = this.partyOf?.(pl); if (!pt) return;
    pt.meter = { run: seg(Date.now()), fight: null, zone: zoneOf(pl), sent: 0, dirty: true };
    for (const id of pt.members) { const p = this.pls.get(id); if (p && p !== pl) this.say(p, `${pl.name} reset the party meter.`); }
  };
  P.meterView = function (pt, now) {
    const M = pt.meter; if (!M) return null;
    const rows = (s) => pt.members.map((id) => { const r = s?.by[id], p = this.pls.get(id); return { id, name: r?.name || p?.name || "?", style: r?.style || (p ? G.styleOf(p.C) : "melee"), ...Object.fromEntries(KEYS.map((k) => [k, r?.[k] || 0])) }; });
    const f = M.fight;
    return {
      run: { secs: Math.max(1, Math.round((now - M.run.at) / 1000)), foe: M.run.foe, rows: rows(M.run) },
      fight: f ? { secs: Math.max(1, Math.round(((f.last || now) - f.at) / 1000)), foe: f.foe, live: now - f.last <= FIGHT_GAP, rows: rows(f) } : null,
      zone: M.zone ? M.zone.split(":")[0] : null
    };
  };
  /* once a second: every party whose numbers changed tells its members, and a fight that has just gone quiet is sent once more so the
     page can mark it "last fight" */
  P.meterTick = function (now) {
    for (const pt of this.parties?.values() || []) {
      const M = pt.meter; if (!M || pt.solo) continue;
      const quiet = M.fight && !M.quietSent && now - M.fight.last > FIGHT_GAP;
      if (!M.dirty && !quiet) continue;
      if (now - (M.sent || 0) < 1000) continue;
      M.dirty = false; M.sent = now; if (quiet) M.quietSent = true; else if (M.fight && now - M.fight.last <= FIGHT_GAP) M.quietSent = false;
      const view = this.meterView(pt, now);
      for (const id of pt.members) this.pls.get(id)?.out.push({ type: "meter", m: view });
    }
  };
  /* ------------------------------------------------------------ THE RUN REPORT (2026-09-28, the owner: "build the after dungeon reports")
     Built from the run segment the moment a dungeon run ends (a clear, a wipe, the Count Room's floor cleared), and sent to everybody in
     the run and everybody in the party. `info` is what the dungeon knows: its name, the result, the time, the boss and, on a wipe, how much
     of the boss was left. The page (eastscape-runreport.js) draws it; nothing here pays or changes anything. The last one is kept on each
     player (not saved) so the meter can open it again. */
  P.reportRun = function (S, info) {
    const here = this.playersIn(S); if (!here.length) return;
    const pt = this.meterParty(here[0]), M = pt?.meter, run = M && (M.zone === S.key || !M.zone) ? M.run : null, now = Date.now();
    const ids = [...new Set([...(pt?.members || []), ...here.map((p) => p.id)])];
    const rows = ids.map((id) => { const r = run?.by[id], p = this.pls.get(id); return { id, name: r?.name || p?.name || "?", style: r?.style || (p ? G.styleOf(p.C) : "melee"), ...blank(), ...(r || {}) }; });
    const secs = info.secs ?? (run ? Math.max(1, Math.round((now - run.at) / 1000)) : 0);
    const R = { at: now, kind: info.kind, title: info.title, result: info.result, secs, boss: info.boss || null, bossArt: info.bossArt || null, bossLeft: info.bossLeft ?? null,
      best: info.best ?? null, pay: info.pay ?? null, rows, log: run?.log || [], kb: run?.kb || null, bossAt: run?.bossAt ? Math.round((run.bossAt - run.at) / 1000) : null, tlMs: TL_MS };
    for (const id of ids) { const p = this.pls.get(id); if (p) { p.lastReport = R; p.out.push({ type: "runreport", r: R }); } }
    return R;
  };
  /* the dungeons' one call: what they know at the end of a run, from the scene itself (its boss, its clock) */
  P.reportEnd = function (S, kind, result, extra = {}) {
    const run = S.run || {}, bossM = S.mobs?.find((m) => G.MOBS[m.t]?.boss), B = bossM && G.MOBS[bossM.t];
    return this.reportRun(S, { kind, result, secs: run.started ? Math.round((Date.now() - run.started) / 1000) : undefined, boss: B?.name || null, bossArt: B ? B.art || bossM.t : null,
      bossLeft: result === "wipe" && bossM && !bossM.dead ? Math.max(1, Math.round((100 * bossM.hp) / (bossM.maxHp || B.hp))) : null, ...extra });
  };
  P.meterOp = function (S, pl, m) {
    if (m.op === "report") { if (pl.lastReport) pl.out.push({ type: "runreport", r: pl.lastReport, again: true }); else this.say(pl, "No run report yet. Finish a dungeon run first."); return; }
    if (m.op === "reset") { this.meterReset(pl); return this.meterTick(Date.now() + 1000); }
    const pt = this.partyOf?.(pl); if (pt) pl.out.push({ type: "meter", m: this.meterView(pt, Date.now()) });
  };
}
