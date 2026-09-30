/* ============================================================ WHAT THE WORLD RECORDS (2026-09-30) — the owner: "is there a way that we can add additional
   user data points that would give us better insight when doing these analysis? the amount of data is fine i just dont want to incur lag", then
   "build all nine tracking additions". The plan and its reasons are tools/tracking-mock/.

   NINE THINGS, and where they are kept:
     1. minutes on each map, split by what you were doing   C.stats.t[map][act] (seconds)     day.t[map][act], day.who[map]
     2. tickets in by source, out by sink                   C.stats.tixIn / tixOut           day.tixIn / day.tixOut
     3. deaths with the map and what did it                 C.stats.diedIn / diedTo          day.deaths[map][cause], and "trk:pvp" (the last 200 player kills)
     4. kills and gathering by map                          (the character already counts both) day.kills[map][mob], day.gathered[map][item]
     5. xp by skill, by day and by map                      (C.stats.xpDay keeps the total)  day.xp[skill], day.xpMap[map][skill]
     6. days played and sessions                            C.stats.playDay[day] (seconds)   day.players, day.fresh, day.sessions, day.sessMs
     7. sold to Bom, bought, the Exchange                   C.stats.sold[item]               day.sold / day.bought / day.ex [item] = [n, tickets]
     8. which station made it                               —                                day.craft[station][item]
     9. the economy once a day                              —                                day.econ (tickets held: total, median, top 10's share)
   Plus the casino's net by game (day.casino[g] = [plays, net]), since that is where tickets go that are neither earned nor spent.

   THE ACTIVITY (1) is read once a second from what the server already holds, most specific first: f fighting (a swing either way in the last 4 s),
   g gathering / c crafting (one landed in the last 12 s), p playing a table (a play in the last 30 s), w walking, a away (nothing pressed for five
   minutes: Who's online's idle), s anything else (standing, a window open, talking).

   WHY IT CANNOT LAG. Everything is a number added to in memory. A character's numbers ride that character's ordinary save (nothing here ever
   calls touch(), so nothing here ever causes a write); the day's tally is written at most once a minute, and only if it changed, in three keys
   (trk:<day>:where, :econ, :people) so no one value can approach the 128 KB limit. Nothing is sent to anybody. Every entry point is wrapped:
   a mistake in here can never break a kill, a sale or a save. Kept 120 days; the nightly backup copies it like everything else. */
export function installTrack(World, { G }) {
  const P = World.prototype, KEEP_DAYS = 120, IDLE_MS = 5 * 60000;
  const mapOf = (scene) => String(scene || "?").split(":")[0];
  const add = (o, k, n = 1) => { if (k == null || !(n > 0 || n < 0)) return; o[k] = (o[k] || 0) + n; };
  const sub = (o, k) => (o[k] ||= {});
  const pair = (o, k, n, tix) => { const e = (o[k] ||= [0, 0]); e[0] += n; e[1] += Math.round(tix || 0); };
  const fresh = (day) => ({ day, where: { t: {}, who: {}, kills: {}, gathered: {}, deaths: {}, xpMap: {} }, econ: { tixIn: {}, tixOut: {}, casino: {}, sold: {}, bought: {}, ex: {}, craft: {} }, people: { players: {}, fresh: 0, sessions: 0, sessMs: 0, ended: 0, peak: 0, xp: {} } });
  const stOf = (pl) => pl?.C?.stats || null;

  /* the day in memory, loaded on first use so a restart mid-day carries on counting where the last write left it */
  P.trkDay = function () {
    const day = G.dayKeyCT(), T = this.trk;
    if (T?.cur?.day === day) return T.cur;
    if (T?.cur && T.cur.day !== day) { this.trkWrite(true); this.trkRollover(T.cur.day); }
    const cur = fresh(day); this.trk = { cur, dirty: new Set(), loading: true };
    Promise.all(["where", "econ", "people"].map((k) => this.ctx.storage.get(`trk:${day}:${k}`))).then((got) => {
      /* what was written before a restart is added into what has been counted since, so neither is lost */
      ["where", "econ", "people"].forEach((k, i) => { if (got[i]) cur[k] = merge(got[i], cur[k]); });
      this.trk.loading = false;
    }).catch(() => { this.trk.loading = false; });
    return cur;
  };
  function merge(a, b) {   /* add b into a, key by key: numbers add, [n, tix] pairs add, objects recurse, peak takes the larger */
    for (const [k, v] of Object.entries(b)) {
      if (typeof v === "number") a[k] = k === "peak" ? Math.max(a[k] || 0, v) : (a[k] || 0) + v;
      else if (Array.isArray(v)) { const e = (a[k] ||= [0, 0]); e[0] += v[0]; e[1] += v[1]; }
      else if (v && typeof v === "object") a[k] = merge(a[k] || {}, v);
      else if (!(k in a)) a[k] = v;
    }
    return a;
  }
  P.trkMark = function (part) { this.trkDay(); this.trk.dirty.add(part); };
  /* once a minute (and at the turn of the day): only the parts that changed. Never while the day is still being read back. */
  P.trkWrite = function (force = false) {
    const T = this.trk; if (!T?.cur || (T.loading && !force) || !T.dirty.size) return;
    const put = {}; for (const part of T.dirty) put[`trk:${T.cur.day}:${part}`] = T.cur[part];
    T.dirty.clear(); this.ctx.storage.put(put).catch((e) => console.error("trkWrite", e));
  };
  /* a new day: the old one is finished; the economy is measured for it; days past KEEP_DAYS go */
  P.trkRollover = function (oldDay) {
    const cut = new Date(Date.parse(oldDay) - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
    this.ctx.storage.list({ prefix: "trk:", end: `trk:${cut}` }).then((m) => { const ks = [...m.keys()].filter((k) => /^trk:\d{4}-/.test(k) && k < `trk:${cut}`); if (ks.length) this.ctx.storage.delete(ks.slice(0, 128)); }).catch(() => {});
    this.trkEcon(oldDay).catch(() => {});
  };
  /* 9. THE ECONOMY: tickets held (bag and bank) across every character, once a day, with the same read of every character the hiscores do */
  P.trkEcon = async function (day) {
    const held = [];
    let after; for (;;) { const m = await this.ctx.storage.list({ prefix: "char:", limit: 500, startAfter: after }); if (!m.size) break;
      for (const [k, C] of m) { after = k; const live = this.pls.get(k.slice(5))?.C || C; const n = G.countItems({ inv: live.inv || [], bank: live.bank || [] }, ["tickets"]); if (n > 0) held.push(n); }
      if (m.size < 500) break; }
    held.sort((a, b) => b - a);
    const total = held.reduce((a, n) => a + n, 0), econ = { total, holders: held.length, median: held[held.length >> 1] || 0, top10Share: total ? +(held.slice(0, 10).reduce((a, n) => a + n, 0) / total).toFixed(3) : 0, at: Date.now() };
    await this.ctx.storage.put(`trk:${day}:econ-held`, econ);
    return econ;
  };

  /* 1 and 6. ONCE A SECOND, for everyone online: a second on this map doing this, and a second played today. Called from the loop that already runs. */
  P.trkSecond = function (now) {
    const D = this.trkDay(), W = D.where, day = D.day;
    if (this.pls.size > D.people.peak) { D.people.peak = this.pls.size; this.trk.dirty.add("people"); }
    for (const pl of this.pls.values()) {
      const st = stOf(pl); if (!st || pl.lingerUntil) continue;
      const map = mapOf(pl.C.scene), d = pl.trkDid;
      const act = now - (pl.combatAt || 0) < 4000 ? "f" : d && now - d.at < 12000 ? d.k : now - (pl.trkPlayAt || 0) < 30000 ? "p" : (pl.path?.length || pl.step) ? "w" : now - (pl.lastInput || now) >= IDLE_MS ? "a" : "s";
      add(sub(st.t ||= {}, map), act); add(sub(W.t, map), act);
      sub(W.who, map)[pl.id] = 1;
      const pd = (st.playDay ||= {}); add(pd, day);
      if (pd[day] === 1) { const ks = Object.keys(pd); if (ks.length > G.STAT_DAYS) for (const k of ks.sort().slice(0, ks.length - G.STAT_DAYS)) delete pd[k]; }
    }
    this.trk.dirty.add("where");
    if (this.tickN % 1200 === 0) this.trkWrite();
  };

  /* 4, 5 and the casino: from emit(), which every kill, gather, craft, xp gain and table play already passes through */
  P.trkEvent = function (pl, type, d = {}) {
    const D = this.trkDay(), map = mapOf(pl.C.scene), now = Date.now();
    switch (type) {
      case "kill": add(sub(D.where.kills, map), d.mob); this.trk.dirty.add("where"); break;
      case "gather": add(sub(D.where.gathered, map), d.k, d.n || 1); pl.trkDid = { k: "g", at: now }; this.trk.dirty.add("where"); break;
      case "craft": case "cook": pl.trkDid = { k: "c", at: now }; break;
      case "xp": { const xp = Math.trunc(d.xp || 0); if (xp > 0 && d.skill) { add(D.people.xp, d.skill, xp); add(sub(D.where.xpMap, map), d.skill, xp); this.trk.dirty.add("people"); } break; }
      case "play": pair(D.econ.casino, d.g, 1, d.net); pl.trkPlayAt = now; this.trk.dirty.add("econ"); break;
    }
  };
  /* 8. which station made it (the Nexus altar and the Wild Bench apart from the rest) */
  P.trkCraft = function (pl, station, k, n) { const D = this.trkDay(); add(sub(D.econ.craft, station || "?"), k, n || 1); this.trk.dirty.add("econ"); };

  /* 2. TICKETS: in by source (n > 0), out by sink (n < 0) */
  P.trkTix = function (pl, n, what) {
    n = Math.round(n); if (!n) return; const D = this.trkDay(), st = stOf(pl), key = what || "other";
    if (n > 0) { add(D.econ.tixIn, key, n); if (st) add(st.tixIn ||= {}, key, n); }
    else { add(D.econ.tixOut, key, -n); if (st) add(st.tixOut ||= {}, key, -n); }
    this.trk.dirty.add("econ");
  };
  /* 7. what moved at the counter and the Exchange: [count, tickets] */
  P.trkSold = function (pl, k, n, tix) { const D = this.trkDay(); pair(D.econ.sold, k, n, tix); const st = stOf(pl); if (st) add(st.sold ||= {}, k, n); this.trk.dirty.add("econ"); };
  P.trkBought = function (pl, k, n, tix) { const D = this.trkDay(); pair(D.econ.bought, k, n, tix); this.trk.dirty.add("econ"); };
  P.trkEx = function (k, n, tix) { const D = this.trkDay(); pair(D.econ.ex, k, n, tix); this.trk.dirty.add("econ"); };

  /* 3. A DEATH: where, and what did it. A player kill outside the Cage also goes on the PvP list (the last 200). */
  P.trkDeath = function (pl, S, killer, pk, lost, took) {
    const D = this.trkDay(), map = mapOf(S?.key || pl.C.scene), st = stOf(pl);
    const cause = pk ? "player" : killer?.t || (killer?.mob && (Object.keys(G.MOBS).find((t) => G.MOBS[t].name === killer.mob) || String(killer.mob))) || "other";   /* a type, or what the death was ("the cold", a trap) */
    add(sub(D.where.deaths, map), cause); this.trk.dirty.add("where");
    if (st) { add(st.diedIn ||= {}, map); add(st.diedTo ||= {}, cause); }
    if (pk) {
      const row = { t: Date.now(), k: pk.name, kc: G.combatOf(pk.C), v: pl.name, vc: G.combatOf(pl.C), map, lost: lost || null, took: took || 0 };
      (this.trkPvp ||= this.ctx.storage.get("trk:pvp").then((v) => v || [])).then((list) => { list.unshift(row); list.length = Math.min(list.length, 200); this.trkPvp = Promise.resolve(list); return this.ctx.storage.put("trk:pvp", list); }).catch(() => {});
    }
  };
  /* 6. sessions: a sign-in, a new character, and how long a session lasted */
  P.trkLogin = function (pl, isNew) { const D = this.trkDay(); D.people.players[pl.id] = 1; D.people.sessions++; if (isNew) D.people.fresh++; pl.trkJoined = Date.now(); this.trk.dirty.add("people"); };
  P.trkLeave = function (pl) { if (!pl.trkJoined) return; const D = this.trkDay(); D.people.sessMs += Date.now() - pl.trkJoined; D.people.ended++; pl.trkJoined = 0; this.trk.dirty.add("people"); };

  /* THE WORLD DATA WINDOW (2026-09-30, the owner: "now that we have track.js, can we build a dashboard that i can see what we have so far").
     `n` Chicago days ending today, ADDED UP into one day's shape (today straight from memory, the rest from storage in one read), plus a short line
     per day for the trend and the last 20 player kills. Only an admin asks, only when the window opens or is refreshed, and the answer is cached
     for half a minute, so it costs nothing while nobody is looking. The id lists are sent as counts: the page never sees who was where. */
  P.trkReport = async function (n) {
    n = Math.max(1, Math.min(KEEP_DAYS, n | 0 || 1));
    const hit = (this.trkRep ||= {})[n]; if (hit && Date.now() - hit.at < 30000) return hit.v;
    const today = this.trkDay(), days = [];
    for (let i = 0, t = Date.now(); days.length < n && i < n + 3; i++) { const d = G.chicagoDay(t - i * 864e5); if (!days.includes(d)) days.push(d); }
    const keys = days.slice(1).flatMap((d) => [`trk:${d}:where`, `trk:${d}:econ`, `trk:${d}:people`, `trk:${d}:econ-held`]);
    const got = keys.length ? await this.ctx.storage.get(keys) : new Map();
    const dayOf = (d) => (d === today.day ? today : { day: d, where: got.get(`trk:${d}:where`), econ: got.get(`trk:${d}:econ`), people: got.get(`trk:${d}:people`) });
    const sum = fresh(null), series = [];
    for (const d of days) {
      const D = dayOf(d); if (!D.where && !D.econ && !D.people) { series.push({ day: d, none: true }); continue; }
      for (const part of ["where", "econ", "people"]) if (D[part]) merge(sum[part], D[part]);
      const secs = Object.values(D.where?.t || {}).reduce((a, o) => a + Object.values(o).reduce((b, v) => b + v, 0), 0);
      const tot = (o) => Object.values(o || {}).reduce((a, v) => a + v, 0);
      series.push({ day: d, players: Object.keys(D.people?.players || {}).length, fresh: D.people?.fresh | 0, sessions: D.people?.sessions | 0, peak: D.people?.peak | 0,
        hours: Math.round(secs / 36) / 100, tixIn: tot(D.econ?.tixIn), tixOut: tot(D.econ?.tixOut), deaths: Object.values(D.where?.deaths || {}).reduce((a, o) => a + tot(o), 0),
        held: got.get(`trk:${d}:econ-held`) || null });
    }
    const W = sum.where, Pp = sum.people;
    const v = { n, days, from: days.at(-1), to: days[0], series: series.reverse(),
      where: { t: W.t, who: Object.fromEntries(Object.entries(W.who).map(([k, o]) => [k, Object.keys(o).length])), kills: W.kills, gathered: W.gathered, deaths: W.deaths, xpMap: W.xpMap },
      econ: sum.econ, people: { players: Object.keys(Pp.players).length, fresh: Pp.fresh, sessions: Pp.sessions, sessMs: Pp.sessMs, ended: Pp.ended, peak: Pp.peak, xp: Pp.xp },
      pvp: ((await this.ctx.storage.get("trk:pvp")) || []).slice(0, 20), since: KEEP_DAYS, at: Date.now() };
    /* the maps' names: the page only holds the maps it has loaded */
    v.names = Object.fromEntries([...new Set([...Object.keys(W.t), ...Object.keys(W.kills), ...Object.keys(W.gathered), ...Object.keys(W.deaths), ...v.pvp.map((r) => r.map)])].map((k) => [k, G.SCENES[k]?.name || k]));
    this.trkRep[n] = { at: Date.now(), v };
    return v;
  };

  /* THE GUARD: nothing in here may ever throw into the game */
  for (const k of ["trkSecond", "trkEvent", "trkCraft", "trkTix", "trkSold", "trkBought", "trkEx", "trkDeath", "trkLogin", "trkLeave", "trkWrite"]) {
    const f = P[k]; P[k] = function (...a) { try { return f.apply(this, a); } catch (e) { console.error(k, e); } };
  }
}
