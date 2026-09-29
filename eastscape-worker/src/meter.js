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
  const seg = (now) => ({ at: now, last: 0, by: {}, foe: null, foeLvl: -1 });
  const zoneOf = (pl) => { const k = String(pl.C.scene || ""); return /^(crypt|pyramid|count):/.test(k) ? k : null; };

  P.meterAdd = function (pl, key, n, foe) {
    if (!pl || !(n > 0)) return;
    const pt = this.partyOf?.(pl); if (!pt) return;
    const now = Date.now(), zone = zoneOf(pl);
    let M = pt.meter;
    if (!M || (zone && M.zone !== zone)) { M = pt.meter = { run: seg(now), fight: null, zone, sent: 0 }; }   /* a fresh party, or a new dungeon run */
    const combat = key !== "heal";
    if (combat && (!M.fight || now - M.fight.last > FIGHT_GAP)) M.fight = seg(now);
    const live = M.fight && now - M.fight.last <= FIGHT_GAP ? M.fight : null;
    for (const s of [M.run, combat ? M.fight : live]) {
      if (!s) continue;
      const r = (s.by[pl.id] ||= { dmg: 0, taken: 0, heal: 0, deaths: 0, kills: 0 });
      r[key] += n; r.name = pl.name; r.style = G.styleOf(pl.C);
      if (combat) s.last = now;
      const mob = foe && G.MOBS[foe.t]; if (mob && (mob.lvl || 0) > s.foeLvl) { s.foeLvl = mob.lvl || 0; s.foe = mob.name || foe.t; }
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
      const M = pt.meter; if (!M) continue;
      const quiet = M.fight && !M.quietSent && now - M.fight.last > FIGHT_GAP;
      if (!M.dirty && !quiet) continue;
      if (now - (M.sent || 0) < 1000) continue;
      M.dirty = false; M.sent = now; if (quiet) M.quietSent = true; else if (M.fight && now - M.fight.last <= FIGHT_GAP) M.quietSent = false;
      const view = this.meterView(pt, now);
      for (const id of pt.members) this.pls.get(id)?.out.push({ type: "meter", m: view });
    }
  };
  P.meterOp = function (S, pl, m) {
    if (m.op === "reset") { this.meterReset(pl); return this.meterTick(Date.now() + 1000); }
    const pt = this.partyOf?.(pl); if (pt) pl.out.push({ type: "meter", m: this.meterView(pt, Date.now()) });
  };
}
