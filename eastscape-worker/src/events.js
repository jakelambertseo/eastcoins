/* ============================================================ WORLD EVENTS (2026-09-30): SHOOTING STARS, WANTED! AND THE JACKPOT THIEF. The server's half.
   The rules are EVDAY, SSTAR, WANTED and JTHIEF at the end of the rules file; read the note there first. The owner: "lets build all of them on the
   dev server", then "can we set wanted as once per day, stars as once per day and jackpot once per day, all spread out?".

   THE DAY'S PLAN (this.ev, storage "evplan"): { day, plan: { star, wanted, thief } (ms; the star's is when it LANDS), done: { … } }. Made at the first
   tick of each Chicago day; an event whose minute has already gone when the plan is made (a deploy in the evening) is simply not run that day.
   THE STAR (this.sstar, "sstar"):   { phase: "warn" | "up", at, scene, hint, wild, id, x, y, tier, hp, maxHp, until, by: { id: frags }, miners: { id: at }, found }
   THE POSTER (this.wanted, "wanted"): { id, t, scene, name, ex, band, bounty, at, until, hp, maxHp, by: { id: damage }, enr, half }; the Board's
     last eight posters and the escaped bonus are this.wantedLog, "wantedLog": { log: [...], up }.
   THE THIEF (this.thief, "thief"):   { id, scene, sack0, sack, fromPot, hits, hop, nextHop, hp, by, spilled, x, y }. A restart ends a chase and
     puts his sack back into the Jackpot (evLoad), so a deploy can never mint or lose it.

   All three are monsters put into a live scene only while somebody is in it (a map nobody stands in is torn down), and put back where they were
   when it is rebuilt: the Ice Wyrm's shape (wyrm.js). Nothing here may break the world's tick or a kill: every entry point is wrapped. */
export function installEvents(World, { G }) {
  const P = World.prototype, SS = G.SSTAR, WA = G.WANTED, TH = G.JTHIEF, DAY = G.EVDAY;
  const minuteCT = (t) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(t);
    const v = (k) => +(p.find((x) => x.type === k)?.value || 0); return (v("hour") % 24) * 60 + v("minute"); };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const whereOf = (k) => G.SCENES[k]?.name || k;
  const clockCT = (t) => new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(t);
  const save = (w, key, v) => { if (v) w.ctx.storage.put(key, v).catch(() => {}); else w.ctx.storage.delete(key).catch(() => {}); };
  const tell = (w, S, text) => { for (const p of w.playersIn(S)) p.out.push({ type: "casinonote", text }); };
  /* (2026-09-30, the owner: "the initial announcement of the jackpot guy being spawned is duplicating") every announcement here is CASINO's chat line
     (houseSay) and nothing else: a second "casinonote" beside it drew the same news twice in chat. */
  const blank = (id, t, x, y, hp, maxHp, now, extra) => ({ id, t, x, y, hx: x, hy: y, hp, maxHp, path: [], step: null, face: 1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: now, ...extra });
  const gridOf = (w, key) => w.scenes.get(key)?.g || G.buildScene(key).g;
  /* a free standing tile in a map: walkable, not an edge, all eight neighbours walkable, away from the border */
  const openTile = (g, near, rMin = 0, rMax = 99) => {
    for (let i = 0; i < 600; i++) {
      const x = near ? near.x + Math.round((Math.random() * 2 - 1) * rMax) : 2 + Math.floor(Math.random() * (g[0].length - 4));
      const y = near ? near.y + Math.round((Math.random() * 2 - 1) * rMax) : 2 + Math.floor(Math.random() * (g.length - 4));
      if (x < 2 || y < 2 || x >= g[0].length - 2 || y >= g.length - 2) continue;
      if (near && Math.max(Math.abs(x - near.x), Math.abs(y - near.y)) < rMin) continue;
      if (!G.walkableIn(g, x, y) || g[y][x] === "e") continue;
      if (G.D8.every(([dx, dy]) => G.walkableIn(g, x + dx, y + dy) && g[y + dy][x + dx] !== "e")) return { x, y };
    }
    return null;
  };
  /* (2026-09-30) how far a tile is from the nearest open-edge of the map, counting walls: the Jackpot Thief keeps EDGE_KEEP tiles off it */
  const EDGE_KEEP = 4, edgeOf = (g, x, y) => Math.min(x, y, g[0].length - 1 - x, g.length - 1 - y);
  const freeNear = (w, S, x, y) => {
    for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && G.walkableIn(S.g, xx, yy) && S.g[yy][xx] !== "e" && !w.occupied(S, xx, yy)) return { x: xx, y: yy };
    }
    return { x, y };
  };

  /* ------------------------------------------------------------------ loading, the plan, the tick */
  P.evLoad = async function () {
    const st = this.ctx.storage;
    this.ev = (await st.get("evplan")) || null;
    this.sstar = (await st.get("sstar")) || null;
    this.wanted = (await st.get("wanted")) || null;
    this.wantedLog = (await st.get("wantedLog")) || { log: [], up: 0 };
    const th = await st.get("thief");
    if (th) { const back = Math.max(0, Math.min(th.sack | 0, th.fromPot ?? th.sack) | 0); this.jack.pot += back; this.jackDirty = true; await st.delete("thief");   /* a restart ends a chase: what the Jackpot lent goes home */
      /* (2026-09-30, the owner: "i didnt see any completion message") and SAYS so: it used to end in silence, so a chase cut off by a deploy (or the
         dev server reloading) just vanished. Said into the kept chat, which everyone gets back as they reconnect. */
      this.houseSay(`\u{1F4B0} The Jackpot Thief slipped away while the lights were out.${back ? ` The Jackpot gets ${G.fmtTix(back)} back.` : ""} He'll be back.`); }
    this.thief = null;
  };
  P.evPlanDay = function (now) {
    const day = G.chicagoDay(now), start = now - minuteCT(now) * 60000 - (now % 60000), len = ((DAY.to - DAY.from) * 60) / 3;
    const order = ["star", "wanted", "thief"].sort(() => Math.random() - 0.5), plan = {};
    order.forEach((k, i) => {
      const lo = DAY.from * 60 + i * len + DAY.margin, hi = DAY.from * 60 + (i + 1) * len - DAY.margin;
      let at = start + (lo + Math.floor(Math.random() * (hi - lo))) * 60000;
      /* never within half an hour of the Ice Wyrm: slide inside the window, the other way if the first way would leave it */
      const wy = this.wyrm?.at; if (wy && Math.abs(at - wy) < 30 * 60000) { const a = wy + (at < wy ? -40 : 40) * 60000, b = wy + (at < wy ? 40 : -40) * 60000; at = [a, b].find((t) => t >= start + lo * 60000 && t <= start + hi * 60000) ?? at; }
      plan[k] = at;
    });
    this.ev = { day, plan, done: { star: plan.star - SS.warnMs <= now, wanted: plan.wanted <= now, thief: plan.thief <= now }, late: plan.thief + 2 * 3600000 };
    save(this, "evplan", this.ev);
  };
  P.evTick = function (now) {
    if (G.HOLD.events) return;   /* (2026-09-30, the owner: "lets hold on the world events until i test them") nothing plans or runs while held */
    /* (2026-09-30, the owner: "just let me run them via admin for now, take them off the schedule until tomorrow") before G.EVDAY.firstDay (Chicago)
       there is no daily plan: an event only starts from the admin panel, and one that is running still runs (the ticks below). */
    if (G.EVDAY.firstDay && G.chicagoDay(now) < G.EVDAY.firstDay) { this.starTick(now); this.wantedTick(now); this.thiefTick(now); if (this.tickN % 600 === 0) { save(this, "sstar", this.sstar); save(this, "wanted", this.wanted); } this.evBroadcast(now); return; }
    if (!this.ev || this.ev.day !== G.chicagoDay(now)) this.evPlanDay(now);
    const E = this.ev;
    if (!E.done.star && now >= E.plan.star - SS.warnMs) { E.done.star = true; save(this, "evplan", E); if (!this.sstar) this.starWarn(now, E.plan.star); }
    if (!E.done.wanted && now >= E.plan.wanted) { E.done.wanted = true; save(this, "evplan", E); if (!this.wanted) this.wantedPost(now); }
    if (!E.done.thief && now >= E.plan.thief) {
      /* nobody on, a raid on or the King up: wait a quarter of an hour at a time, for up to two hours, then let the day go */
      const busy = !this.pls.size || this.raid || this.hw?.kingUp;
      if (busy && now < (E.late || 0)) { E.plan.thief = now + 15 * 60000; save(this, "evplan", E); }
      else { E.done.thief = true; save(this, "evplan", E); if (!busy && !this.thief) this.thiefStart(now); }
    }
    this.starTick(now); this.wantedTick(now); this.thiefTick(now);
    if (this.tickN % 600 === 0) { save(this, "sstar", this.sstar); save(this, "wanted", this.wanted); }   /* every half minute: health mirrored for a restart */
    this.evBroadcast(now);
  };
  /* what the page's tracker and map need: never the plan's times (they are the surprise) */
  P.evView = function (now = Date.now()) {
    const H = this.sstar, W = this.wanted, T = this.thief;
    return { now,
      star: H ? { phase: H.phase, hint: H.hint, wild: !!H.wild, at: H.phase === "warn" ? H.at : H.until, scene: H.phase === "up" ? H.scene : null, where: H.phase === "up" ? whereOf(H.scene) : null,
        tier: H.tier || 0, lvl: (H.tier || 0) * SS.tierLvl, pct: H.maxHp ? H.hp / H.maxHp : 1, miners: H.miners ? Object.values(H.miners).filter((t) => now - t <= SS.activeMs).length : 0 } : null,
      wanted: W ? { name: W.name, t: W.t, scene: W.scene, where: whereOf(W.scene), bounty: W.bounty, until: W.until, pct: W.maxHp ? W.hp / W.maxHp : 1, hunters: Object.keys(W.by).length, lvl: G.MOBS[W.t]?.lvl || 0, ex: W.ex } : null,
      thief: T ? { scene: T.scene, where: whereOf(T.scene), sack: T.sack, sack0: T.sack0, hop: T.hop, hops: TH.hops, next: T.nextHop, spilled: T.spilled } : null };
  };
  P.evBroadcast = function (now, force) {
    const v = this.evView(now), r = (n) => Math.round((n || 0) * 20);
    const sig = JSON.stringify([v.star && [v.star.phase, v.star.scene, v.star.tier, r(v.star.pct), v.star.miners], v.wanted && [v.wanted.name, r(v.wanted.pct), v.wanted.hunters], v.thief && [v.thief.scene, Math.round(v.thief.sack / 50), v.thief.hop]]);
    if (!force && sig === this.evSig) return; this.evSig = sig;
    for (const p of this.pls.values()) p.out.push({ type: "wev", ...v });
  };

  /* ------------------------------------------------------------------ SHOOTING STARS */
  P.starWarn = function (now, at, scene) {
    const open = Object.keys(SS.scenes).filter((k) => G.OPEN.has(k));
    const wild = !scene && G.OPEN.has("wild") && Math.random() < SS.wild.chance;
    const key = scene || (wild ? "wild" : pick(open));
    const hint = wild ? SS.wild.hint : SS.scenes[key] || "somewhere nearby";
    this.sstar = { phase: "warn", at, scene: key, hint, wild: key === "wild" }; save(this, "sstar", this.sstar);
    const mins = Math.max(1, Math.round((at - now) / 60000));
    this.houseSay(`\u{1F320} A star is falling! It'll come down ${hint} in about ${mins} minute${mins === 1 ? "" : "s"}. Bring a pickaxe: everyone who mines it takes a share of its Star Fragments.`);
    this.evBroadcast(now, true);
  };
  P.starLand = function (now) {
    const H = this.sstar, g = gridOf(this, H.scene), at = openTile(g);
    if (!at) { this.sstar = null; save(this, "sstar", null); return; }
    let best = 0; for (const p of this.pls.values()) best = Math.max(best, G.lvlOf(p.C, "mining"));
    const tier = Math.max(1, Math.min(9, Math.floor((best || 10) / SS.tierLvl))), hp = SS.hp.base + SS.hp.per;
    Object.assign(H, { phase: "up", id: `star${now.toString(36)}`, x: at.x, y: at.y, tier, hp, maxHp: hp, until: now + SS.lasts, by: {}, miners: {}, found: [] });
    save(this, "sstar", H);
    const where = whereOf(H.scene);
    this.houseSay(`\u{1F320} IMPACT! The star came down in ${where}${H.wild ? ", in the Wilderness, where every fragment counts double. Mind yourselves out there" : ""}. It's tier ${tier}: Mining ${tier * SS.tierLvl} to start, and it gets easier as it breaks. It cools in an hour.`);
    const S = this.scenes.get(H.scene); if (S && this.playersIn(S).length) { this.starPut(S, now); for (const p of this.playersIn(S)) this.say(p, "Something bright tears across the sky and hits the ground close by. The ground shakes.", "bad"); }
    this.evBroadcast(now, true);
  };
  P.starPut = function (S, now) {
    const H = this.sstar, spot = this.occupied(S, H.x, H.y) ? freeNear(this, S, H.x, H.y) : { x: H.x, y: H.y }; H.x = spot.x; H.y = spot.y;
    S.mobs.push(blank(H.id, "fallenstar", spot.x, spot.y, H.hp, H.maxHp, now, { star: true, perch: true, tier: H.tier, nm: `Shooting star · tier ${H.tier}`, lv: H.tier * SS.tierLvl }));
    S.events.push({ type: "starfall", x: spot.x, y: spot.y, t: now }); S.whoSig = null;
  };
  /** one swing of a pickaxe at the star (doAction hands it over): the rock's timing, one of the tier's health, fragments and Mining xp */
  P.starSwing = function (S, pl, m, a, now) {
    const H = this.sstar, C = pl.C; if (!H || H.id !== m.id || H.phase !== "up") { pl.act = null; return; }
    if (G.cheb(pl, m) > 1) { const p = G.findPath(S.g, pl, m, 1); if (p && p.length) pl.path = p; else if (!p) { pl.act = null; this.say(pl, "You can't get to the star from here.", "bad"); } return; }
    a.x = m.x; a.y = m.y; pl.face = m.x > pl.x ? 1 : m.x < pl.x ? -1 : pl.face;
    const need = H.tier * SS.tierLvl, have = G.lvlOf(C, "mining");
    if (have < need) { pl.act = null; const can = Math.floor(have / SS.tierLvl); return this.say(pl, `You need Mining ${need} to mine the star at tier ${H.tier}. ${can >= 1 ? `You can join in when it's down to tier ${can}.` : "You can join in at tier 1, with Mining 10."}`, "bad"); }
    if (!this.hasTool(pl, "mining", need)) { pl.act = null; return; }
    const tspd = G.toolSpeed(C, "mining") * (1 + G.swingFx(C));
    if (!a.started) { a.started = now; a.next = now + Math.round(1800 / tspd); pl.swingAt = now; return this.say(pl, "You swing your pickaxe at the star. It rings like a bell."); }
    if (now - pl.swingAt > 1100) pl.swingAt = now;
    if (now < a.next) return;
    a.next = now + Math.round(1800 / tspd); pl.swingAt = now;
    m.hp -= 1; m.hurtAt = now; H.hp = m.hp; H.miners[pl.id] = now;
    const mul = H.wild ? SS.wild.mul : 1, cap = SS.cap * mul, took = H.by[pl.id] || 0, got = Math.max(0, Math.min(SS.frags[H.tier] * mul, cap - took));
    if (got) { C.frags = (C.frags | 0) + got; H.by[pl.id] = took + got; S.events.push({ type: "frag", who: pl.id, n: got, t: now }); }
    else if (!H.capTold?.[pl.id]) { (H.capTold ||= {})[pl.id] = 1; this.say(pl, `That's all this star will give you (${cap} Star Fragments). Keep swinging to help it down: the Mining xp still counts.`); }
    this.grant(pl, "mining", SS.xp(H.tier)); this.touch(pl);
    if (Math.random() < SS.starling) {
      const where = this.keepRare(pl, "egg_starling", 1);
      if (where) { H.found.push(pl.name); this.say(pl, `Something small and bright tumbles out of the star: a Starling egg!${where === "bank" ? " (Your bag was full: it's in your bank.)" : ""}`, "loot"); this.houseSay(`\u{1F320} ${pl.name} found a STARLING EGG in the star in ${whereOf(H.scene)}!`); }
    }
    if (m.hp <= 0) this.starCrack(S, m, now);
  };
  P.starCrack = function (S, m, now) {
    const H = this.sstar; H.tier--;
    if (H.tier <= 0) return this.starSpent(S, m, now);
    const active = Math.max(1, Object.values(H.miners).filter((t) => now - t <= SS.activeMs).length);
    H.maxHp = H.hp = SS.hp.base + SS.hp.per * active;
    Object.assign(m, { hp: H.hp, maxHp: H.maxHp, tier: H.tier, nm: `Shooting star · tier ${H.tier}`, lv: H.tier * SS.tierLvl });
    S.events.push({ type: "startier", who: m.id, tier: H.tier, t: now });
    tell(this, S, `\u{1F320} TIER ${H.tier}! The star cracks and shrinks: Mining ${H.tier * SS.tierLvl} can mine it now.`);
    if (H.tier === 5 || (H.tier < 5 && !H.saidLow)) { H.saidLow = true; this.houseSay(`\u{1F320} The star in ${whereOf(H.scene)} is down to tier ${H.tier}. Anyone with Mining ${H.tier * SS.tierLvl} can join in now.`); }
    save(this, "sstar", H); this.evBroadcast(now, true);
  };
  P.starSpent = function (S, m, now) {
    const H = this.sstar; S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null;
    S.events.push({ type: "starspent", x: m.x, y: m.y, t: now });
    this.starReport(H, "spent");
    const rows = Object.values(H.by), total = rows.reduce((a, n) => a + n, 0);
    this.houseSay(`\u{1F320} The star in ${whereOf(H.scene)} is spent. ${rows.length} miner${rows.length === 1 ? "" : "s"} took ${total.toLocaleString()} Star Fragments between them.${H.found.length ? ` ${H.found.join(" and ")} found a Starling egg!` : ""} Spend them at the Star Tent in Cloudreach.`);
    this.sstar = null; save(this, "sstar", null); this.evBroadcast(now, true);
  };
  P.starReport = function (H, how) {
    for (const [id, n] of Object.entries(H.by || {})) { const p = this.pls.get(id); if (p) this.say(p, `${how === "spent" ? "The star is spent" : "The star has gone dark"}. You mined ${n.toLocaleString()} Star Fragment${n === 1 ? "" : "s"} from it (${(p.C.frags | 0).toLocaleString()} in all). The Star Tent is in Cloudreach.`, "loot"); }
  };
  P.starTick = function (now) {
    const H = this.sstar; if (!H) return;
    if (H.phase === "warn") { if (now >= H.at) this.starLand(now); return; }
    const S = this.scenes.get(H.scene), m = S?.mobs.find((x) => x.id === H.id);
    if (now >= H.until) {
      if (S && m) S.mobs = S.mobs.filter((x) => x !== m), S.whoSig = null;
      this.starReport(H, "dark");
      this.houseSay(`\u{1F320} The star in ${whereOf(H.scene)} cools and goes dark${Object.keys(H.by).length ? " before anyone could finish it" : ". Nobody came"}. Another falls tomorrow.`);
      this.sstar = null; save(this, "sstar", null); return this.evBroadcast(now, true);
    }
    if (!m && S && this.playersIn(S).length) this.starPut(S, now);
  };

  /* ------------------------------------------------------------------ WANTED! */
  P.wantedPost = function (now, only) {
    const T = WA.targets, online = [...this.pls.values()].map((p) => G.combatOf(p.C));
    const fits = (k) => G.OPEN.has(k) && T[k] && (!online.length || online.some((c) => c >= (G.BANDS[k]?.[0] ?? 1)));
    const dayN = Math.floor(Date.parse(G.chicagoDay(now)) / 864e5);
    let band = dayN % WA.bands.length, scenes = [];
    if (only && T[only]) { scenes = [only]; band = Math.max(0, WA.bands.findIndex((b) => b.includes(only))); }
    else for (; band >= 0; band--) { scenes = WA.bands[band].filter(fits); if (scenes.length) break; }
    if (!scenes.length) { band = 0; scenes = WA.bands[0].filter((k) => G.OPEN.has(k) && T[k]); }
    const scene = pick(scenes), [t, name, ex] = pick(T[scene]), up = this.wantedLog?.up || 0;
    const bounty = Math.round((WA.bounty[band] * (1 + up)) / 100) * 100, hp = Math.max(WA.minHp[band] || 0, Math.round(G.MOBS[t].hp * WA.hpX));
    this.wanted = { id: `want${now.toString(36)}`, t, scene, name, ex, band, bounty, at: now, until: now + WA.lasts, hp, maxHp: hp, by: {} };
    save(this, "wanted", this.wanted);
    this.houseSay(`\u{1F4DC} WANTED: ${name.toUpperCase()}, in ${whereOf(scene)}. ${G.fmtTix(bounty)} for bringing it down, shared by everyone who hurts it.${up ? ` (${Math.round(up * 100)}% more than usual: the last one got away.)` : ""} The poster's on the Bounty Board in the Yard, and it has an hour.`);
    this.evBroadcast(now, true);
  };
  P.wantedPut = function (S, now) {
    const H = this.wanted, homes = (S.def.mobs || []).filter((e) => e[0] === H.t), h = homes.length ? pick(homes) : [H.t, H.x ?? 10, H.y ?? 10];
    const spot = H.x != null ? freeNear(this, S, H.x, H.y) : freeNear(this, S, h[1], h[2]); H.x = spot.x; H.y = spot.y;
    S.mobs.push(blank(H.id, H.t, spot.x, spot.y, H.hp, H.maxHp, now, { face: -1, aggro: G.MOBS[H.t].aggro, wanted: true, open: true, nm: H.name, enraged: !!H.enr, enrMul: H.enr ? WA.enrage.mul : undefined }));
    S.whoSig = null;
    tell(this, S, `\u{1F4DC} ${H.name} is here, somewhere in ${S.def.name}. Look for the red glow.`);
  };
  /* every point of damage on the Wanted target, from any source (bossAdd is the one call every damage path makes; raid.js wraps it the same way) */
  const bossAdd = P.bossAdd;
  P.bossAdd = function (pl, m, key, n) {
    if (key === "dmg" && m?.wanted && this.wanted && m.id === this.wanted.id && n > 0 && pl) this.wanted.by[pl.id] = (this.wanted.by[pl.id] || 0) + n;
    return bossAdd.call(this, pl, m, key, n);
  };
  P.wantedTick = function (now) {
    const H = this.wanted; if (!H) return;
    const S = this.scenes.get(H.scene), m = S?.mobs.find((x) => x.id === H.id);
    if (now >= H.until) return this.wantedEscape(S, m, now);
    if (!m) { if (S && this.playersIn(S).length) this.wantedPut(S, now); return; }
    if (m.dead) return;
    H.hp = m.hp; H.x = m.x; H.y = m.y;
    if (!H.half && m.hp <= H.maxHp * 0.5) { H.half = true; const n = Object.keys(H.by).length; this.houseSay(`\u{1F4DC} ${H.name} is half dead. ${n} hunter${n === 1 ? "" : "s"} on it in ${whereOf(H.scene)}.`); }
    if (!H.enr && m.hp <= H.maxHp * WA.enrage.at) { H.enr = true; m.enraged = true; m.enrMul = WA.enrage.mul; tell(this, S, `\u{1F4DC} ${H.name} is down to a quarter, and it's FURIOUS: it hits ${Math.round((WA.enrage.mul - 1) * 100)}% harder now.`); }
  };
  P.wantedDown = function (S, m, pl, now) {
    const H = this.wanted; if (!H || H.id !== m.id) return;
    m.respawnAt = Infinity; S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null;
    const rows = Object.entries(H.by).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]), total = rows.reduce((a, [, d]) => a + d, 0) || 1, paid = [];
    for (const [id, d] of rows) {
      const n = Math.max(Math.round(H.bounty * WA.floor), Math.round((H.bounty * d) / total)), p = this.pls.get(id);
      if (p) {
        this.tixTo(p, n, "events"); p.C.takes = (p.C.takes | 0) + 1; this.touch(p);
        this.say(p, `\u{1F4DC} ${H.name} is taken. Your share of the bounty: ${G.fmtTix(n)} (${Math.round((100 * d) / total)}% of the damage). Posters taken: ${p.C.takes}.`, "loot");
        if (p.C.takes >= WA.title) { p.C.store ||= { own: [], name: {} }; p.C.store.own ||= []; if (!p.C.store.own.includes("title_bountyhunter")) { p.C.store.own.push("title_bountyhunter"); this.say(p, `${WA.title} posters taken: you've earned the title « Bounty Hunter ». Wear it from the Store's Name tab.`, "loot"); } }
      }
      paid.push([p?.name || "someone", n]);
    }
    this.wantedLogAdd({ at: now, name: H.name, t: H.t, scene: H.scene, where: whereOf(H.scene), result: "taken", hunters: rows.length, bounty: H.bounty, by: pl.name });
    this.wantedLog.up = 0; save(this, "wantedLog", this.wantedLog);
    const top = paid.slice(0, 3).map(([nm, n]) => `${nm} (${n.toLocaleString()})`).join(", ");
    this.houseSay(`\u{1F4DC} ${pl.name} landed the last blow: ${H.name.toUpperCase()} IS TAKEN. ${rows.length} hunter${rows.length === 1 ? "" : "s"} split ${G.fmtTix(H.bounty)}. Top: ${top}.`);
    this.wanted = null; save(this, "wanted", null); this.evBroadcast(now, true);
  };
  P.wantedEscape = function (S, m, now) {
    const H = this.wanted;
    if (S && m) { this.bossEnd(S, m, "escaped"); S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null; }
    const L = this.wantedLog; L.up = Math.min(WA.upMax - 1, (L.up || 0) + WA.up);
    this.wantedLogAdd({ at: now, name: H.name, t: H.t, scene: H.scene, where: whereOf(H.scene), result: "escaped", hunters: Object.keys(H.by).length, bounty: H.bounty });
    save(this, "wantedLog", L);
    this.houseSay(`\u{1F4DC} ${H.name} got away. The poster on the Bounty Board is stamped ESCAPED, and the next bounty is ${Math.round(L.up * 100)}% bigger.`);
    this.wanted = null; save(this, "wanted", null); this.evBroadcast(now, true);
  };
  P.wantedLogAdd = function (row) { const L = (this.wantedLog ||= { log: [], up: 0 }); L.log.unshift(row); L.log = L.log.slice(0, 8); };

  /* ------------------------------------------------------------------ THE JACKPOT THIEF */
  P.thiefStart = function (now, scene, at) {
    if (this.thief) return false;
    /* (2026-09-30) 30,000-50,000, to the hundred; the Jackpot lends its share, the house the rest (JTHIEF in the rules) */
    const J = this.jack, sack = Math.round((TH.sack.min + Math.random() * (TH.sack.max - TH.sack.min)) / 100) * 100;
    const fromPot = Math.max(0, Math.min(sack, Math.floor((J.pot || 0) * TH.sack.share), Math.floor((J.pot || 0) - G.JACKPOT.seed)));
    J.pot -= fromPot; this.jackDirty = true;
    /* (2026-09-30) NEVER THE YARD, AND NO FIXED START: a map on his list with people on it (the way he hops), else any open one on it */
    const open = TH.scenes.filter((k) => G.OPEN.has(k)), busy = open.filter((k) => { const Sk = this.scenes.get(k); return Sk && this.playersIn(Sk).length; });
    const key = scene && TH.scenes.includes(scene) ? scene : pick(busy.length ? busy : open);
    this.thief = { id: `thief${now.toString(36)}`, scene: key, sack0: sack, sack, fromPot, hits: 0, hop: 0, nextHop: now + TH.hopMs, hp: null, by: {}, spilled: 0, x: at ? at.x : null, y: at ? at.y : null, fresh: !!at };
    save(this, "thief", this.thief);
    /* (2026-09-30, the owner: "make this more vague") who, where and how much; how he works is the wiki's and the tracker's to tell */
    this.houseSay(`\u{1F4B0} There's a thief loose in ${whereOf(key)}! He stole ${G.fmtTix(sack)} from Bom's Jackpot. Knock some loose before he gets away.`);
    for (const p of this.pls.values()) p.out.push({ type: "thiefheist", sack });
    const S = this.scenes.get(key); if (S && this.playersIn(S).length) this.thiefPut(S, now);
    this.evBroadcast(now, true);
    return true;
  };
  P.thiefPut = function (S, now) {
    const H = this.thief, max = TH.hits.base;   /* (2026-09-30) one person's worth; every other person who hits him adds TH.hits.per (thiefHit) */
    let spot;
    if (H.x != null && (H.fresh || H.placed === S.key)) spot = freeNear(this, S, H.x, H.y);
    else { const ps = this.playersIn(S), c = ps.length ? ps[Math.floor(Math.random() * ps.length)] : null; spot = openTile(S.g, c, 6, 10) || openTile(S.g) || { x: H.x ?? 10, y: H.y ?? 10 }; }
    H.fresh = false; H.placed = S.key; H.x = spot.x; H.y = spot.y; if (!(H.hp > 0)) H.hp = max;
    S.mobs.push(blank(H.id, "jackthief", spot.x, spot.y, H.hp, Math.max(H.hp, max), now, { thief: true, stepMs: TH.stepMs, nm: "The Jackpot Thief" }));
    S.whoSig = null;
  };
  /* runs from the nearest person: the neighbouring tile that leaves him furthest from everybody; cornered for a moment and he vaults clear */
  P.thiefMove = function (S, m, now, players) {
    if (m.dizzyUntil > now) { m.path = []; return; }
    if (m.step) { this.stepEntity(S, m, now, false); return; }
    const live = players.filter((p) => !p.dead && p.C.hp > 0), dist = (x, y) => live.reduce((a, p) => Math.min(a, G.cheb(p, { x, y })), 99);
    const here = dist(m.x, m.y);
    if (here > TH.flee) {
      if (now > (m.nextWander || 0)) { m.nextWander = now + 1200 + Math.random() * 1500;
        /* (2026-09-30) near an edge, the wander leans back toward the middle of the map */
        const inward = edgeOf(S.g, m.x, m.y) < EDGE_KEEP ? G.D8.filter(([ex, ey]) => edgeOf(S.g, m.x + ex, m.y + ey) > edgeOf(S.g, m.x, m.y)) : [];
        const [dx, dy] = pick(inward.length ? inward : G.D8), x = m.x + dx, y = m.y + dy;
        if (G.canStepIn(S.g, m.x, m.y, dx, dy) && S.g[y][x] !== "e" && !this.occupied(S, x, y, m)) { m.path = [{ x, y }]; this.stepEntity(S, m, now, false); } }
      return;
    }
    let best = null, bs = -1;
    for (const [dx, dy] of G.D8) {
      const x = m.x + dx, y = m.y + dy;
      if (!G.canStepIn(S.g, m.x, m.y, dx, dy) || S.g[y][x] === "e" || this.occupied(S, x, y, m)) continue;
      const room = G.D8.filter(([ex, ey]) => G.walkableIn(S.g, x + ex, y + ey)).length;   /* prefers open ground to a dead end */
      const edge = edgeOf(S.g, x, y), sc = dist(x, y) * 10 + room + Math.random() * 3 - Math.max(0, EDGE_KEEP - edge) * 8;   /* (2026-09-30, the owner: "keeps getting stuck on the edges of maps") the border counts against a tile */
      if (sc > bs) { bs = sc; best = { x, y, d: dist(x, y) }; }
    }
    if (!best || best.d < here || (edgeOf(S.g, m.x, m.y) <= 1 && here <= 2)) {
      m.cornered ||= now;
      if (now - m.cornered > 900) {   /* THE VAULT: a hop over whoever has him boxed in. (2026-09-30) Picked, not taken at random: of a dozen open tiles
                                          4-9 away, the one furthest from everybody and from the border, so a vault out of a corner lands in the open. */
        let to = null, ts = -1;
        for (let i = 0; i < 12; i++) { const c = openTile(S.g, m, 4, 9); if (!c || this.occupied(S, c.x, c.y, m)) continue; const v = dist(c.x, c.y) * 3 + Math.min(edgeOf(S.g, c.x, c.y), EDGE_KEEP * 2); if (v > ts) { ts = v; to = c; } }
        if (to && dist(to.x, to.y) >= 3) { m.x = to.x; m.y = to.y; m.path = []; m.step = null; S.events.push({ type: "vault", who: m.id, t: now }); }
        m.cornered = 0;
      }
      if (!best) return;
    } else m.cornered = 0;
    m.path = [{ x: best.x, y: best.y }]; this.stepEntity(S, m, now, false);
  };
  /* from the swing: every hit spills tickets onto the ground for anyone (until the sack is down to a fifth, which is kept for the last hit) */
  P.thiefHit = function (S, pl, m, now) {
    const H = this.thief; if (!H || H.id !== m.id) return;
    /* (2026-09-30) A NEW PAIR OF HANDS MAKES HIM TOUGHER: the first person to hit him on this map meets `base`; each one after adds `per` to his health
       (and to the bar), up to `cap`. Kept on the monster, so a hop to a new map starts the count again. */
    m.hitBy ||= {}; if (!m.hitBy[pl.id]) { m.hitBy[pl.id] = 1; if (Object.keys(m.hitBy).length > 1) { const add = Math.max(0, Math.min(TH.hits.per, TH.hits.cap - (m.maxHp || 0))); m.hp += add; m.maxHp = (m.maxHp || 0) + add; } }
    H.hits++; H.by[pl.id] = (H.by[pl.id] || 0) + 1; H.hp = m.hp;
    this.workRoll?.(pl, "getaway", 1 / 60);   /* (2026-10-01) the getaway silks, knocked loose */
    const spill = Math.max(1, Math.round(H.sack0 * TH.spill));
    if (H.sack - spill >= H.sack0 * 0.2) {
      H.sack -= spill; H.spilled += spill;
      const at = freeNear(this, S, m.x, m.y);
      S.ground.push({ id: `g${++this.gseq}`, k: "tickets", n: spill, x: at.x, y: at.y, owner: null, until: 0, gone: now + TH.keepMs });
    }
    if (H.hits % TH.dizzy.every === 0 && m.hp > 0) { m.dizzyUntil = now + TH.dizzy.ms; m.path = []; tell(this, S, "\u{1F4B0} He's seeing stars! GET HIM!"); }
  };
  P.thiefTick = function (now) {
    const H = this.thief; if (!H) return;
    const S = this.scenes.get(H.scene), m = S?.mobs.find((x) => x.id === H.id), here = S ? this.playersIn(S).length : 0;
    if (m) { H.x = m.x; H.y = m.y; H.hp = m.hp; }
    if (now >= H.nextHop || (!here && now - (H.emptyAt ||= now) > 10000)) {
      H.emptyAt = 0;
      if (H.hop >= TH.hops) return this.thiefEscape(S, m, now);
      return this.thiefHop(S, m, now);
    }
    if (here) H.emptyAt = 0;
    if (!m && S && here) this.thiefPut(S, now);
  };
  P.thiefHop = function (S, m, now) {
    const H = this.thief, from = H.scene;
    const where = TH.scenes.filter((k) => G.OPEN.has(k) && k !== from && (() => { const Sk = this.scenes.get(k); return Sk && this.playersIn(Sk).length; })());
    if (S && m) { S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null; S.events.push({ type: "vault", who: m.id, t: now, gone: true }); }
    H.hop++; H.nextHop = now + TH.hopMs; H.hp = null;
    if (!where.length) {
      if (!(S && this.playersIn(S).length)) return this.thiefEscape(null, null, now);
      H.placed = null; this.thiefPut(S, now);   /* nobody anywhere else: he pops up across the same map */
      tell(this, S, `\u{1F4B0} He dives down a hole... and pops up on the other side of ${S.def.name}! ${TH.hops - H.hop} hop${TH.hops - H.hop === 1 ? "" : "s"} left.`);
    } else {
      H.scene = pick(where); H.placed = null;
      const S2 = this.scenes.get(H.scene); this.thiefPut(S2, now);
      if (S) tell(this, S, "\u{1F4B0} He dives down a hole and he's gone. CASINO will say where he comes up.");
      this.houseSay(`\u{1F4B0} The Jackpot Thief dived down a hole... he's in ${whereOf(H.scene).toUpperCase()}! ${G.fmtTix(H.sack)} still in the sack. ${TH.hops - H.hop === 0 ? "This is his last stop." : `${TH.hops - H.hop} hop${TH.hops - H.hop === 1 ? "" : "s"} left before he's gone for good.`}`);
    }
    save(this, "thief", H); this.evBroadcast(now, true);
  };
  P.thiefDown = function (S, m, pl, now) {
    const H = this.thief; m.respawnAt = Infinity; S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null;
    if (!H || H.id !== m.id) return;
    const n = H.sack; this.cashTo(pl, n); this.touch(pl);
    pl.out.push({ type: "jackpotkill", n });
    this.say(pl, `\u{1F4B0} You caught the Jackpot Thief! The sack bursts: ${G.fmtTix(n)} are yours.`, "loot");
    S.events.push({ type: "thiefcaught", x: m.x, y: m.y, t: now });
    this.houseSay(`\u{1F4B0} ${pl.name} CAUGHT THE JACKPOT THIEF in ${whereOf(H.scene)}! ${G.fmtTix(n)} was left in the sack, and ${G.fmtTix(H.spilled)} spilled out along the way for everybody else.`);
    this.thief = null; save(this, "thief", null); this.evBroadcast(now, true);
  };
  P.thiefEscape = function (S, m, now) {
    const H = this.thief;
    if (S && m) { this.bossEnd(S, m, "escaped"); S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null; }
    const back = Math.max(0, Math.min(H.sack, H.fromPot ?? H.sack));   /* (2026-09-30) only what the Jackpot lent goes back; the house's part is simply gone */
    this.jack.pot += back; this.jackDirty = true;
    this.houseSay(`\u{1F4B0} The Jackpot Thief got away with ${G.fmtTix(H.sack)}.${back ? ` The Jackpot gets ${G.fmtTix(back)} of it back.` : ""}${H.spilled ? ` ${G.fmtTix(H.spilled)} was knocked loose along the way.` : ""} He'll be back.`);
    this.thief = null; save(this, "thief", null); this.evBroadcast(now, true);
  };

  /* ------------------------------------------------------------------ the fixtures, the tent, /events, admin */
  P.evOpen = function (pl, kind) {
    const E = this.ev || { plan: {}, done: {} }, C = pl.C;
    if (kind === "startent") return pl.out.push({ type: "evwin", open: "tent", frags: C.frags | 0 });
    pl.out.push({ type: "evwin", open: "board", wanted: this.evView().wanted, log: this.wantedLog?.log || [], takes: C.takes | 0, up: this.wantedLog?.up || 0, later: !E.done?.wanted });
  };
  P.tentOp = function (S, pl, m) {
    const C = pl.C, T = G.STAR_TENT, row = T.stock.find((r) => r.id === String(m.id || "")); if (!row || m.op !== "buy") return;
    const dx = Math.max(T.at.x - pl.x, 0, pl.x - (T.at.x + 2)), dy = Math.max(T.at.y - pl.y, 0, pl.y - (T.at.y + 1));
    if (S.key !== T.scene || Math.max(dx, dy) > 3) return this.say(pl, "You need to be at the Star Tent, in Cloudreach.", "bad");
    const R = G.tentRow(row), price = R.frags;
    if (R.store && C.store?.own?.includes(R.id)) return this.say(pl, "You own that already.", "bad");
    if ((C.frags | 0) < price) return this.say(pl, `That's ${price.toLocaleString()} Star Fragments. You have ${(C.frags | 0).toLocaleString()}: mine a Shooting Star for more.`, "bad");
    if (R.work && !G.workMissing(C, R.work).length) return this.say(pl, "You have the whole set already.", "bad");   /* (2026-10-01) work clothes */
    if (R.give && !this.give(pl, R.give[0], R.give[1]) && !this.bankAdd(pl, R.give[0], R.give[1])) return this.say(pl, "Your bag and bank are both full. Make some room first.", "bad");
    if (R.crate) { const got = G.starCrate(G.lvlOf(C, "mining")); for (const [k, n] of got) if (!this.give(pl, k, n)) this.bankAdd(pl, k, n); this.say(pl, `The crate holds ${got.map(([k, n]) => `${n} ${G.ITEMS[k].name.toLowerCase()}`).join(" and ")}.`, "loot"); }
    if (R.store) { C.store ||= { own: [], name: {} }; C.store.own ||= []; C.store.name ||= {}; C.store.own.push(R.id); if (!C.store.name[R.store.slot]) C.store.name[R.store.slot] = R.id; S.whoSig = null; }
    C.frags = (C.frags | 0) - price; this.touch(pl);
    if (R.work) { this.workFind(pl, R.work); pl.out.push({ type: "evwin", open: "tent", frags: C.frags, bought: R.id }); return; }
    this.say(pl, `${R.name}: ${price.toLocaleString()} Star Fragments.${R.store ? " It's yours to wear from the Store." : ""}`, "good");
    pl.out.push({ type: "evwin", open: "tent", frags: C.frags, bought: R.id });
  };
  P.evTell = function (pl, now) {
    if (G.HOLD.events) return this.say(pl, "World events are coming soon.");
    const v = this.evView(now), E = this.ev || { done: {} }, min = (t) => Math.max(1, Math.round((t - now) / 60000)), L = [];
    if (v.star) L.push(v.star.phase === "warn" ? `\u{1F320} A star is falling ${v.star.hint}. It lands in about ${min(v.star.at)} minutes.` : `\u{1F320} A Shooting Star is in ${v.star.where}: tier ${v.star.tier}, Mining ${v.star.lvl}. It cools in ${min(v.star.at)} minutes.`);
    else L.push(E.done.star ? "\u{1F320} Today's star has fallen. Another falls tomorrow." : "\u{1F320} A star will fall later today, at a time nobody knows.");
    if (v.wanted) L.push(`\u{1F4DC} WANTED: ${v.wanted.name}, in ${v.wanted.where}. ${G.fmtTix(v.wanted.bounty)} shared, ${min(v.wanted.until)} minutes left.`);
    else L.push(E.done.wanted ? "\u{1F4DC} Today's Wanted poster is done. The next goes up tomorrow." : "\u{1F4DC} A Wanted poster goes up on the Bounty Board later today.");
    if (v.thief) L.push(`\u{1F4B0} The Jackpot Thief is loose in ${v.thief.where}, ${G.fmtTix(v.thief.sack)} in his sack.`);
    else L.push(E.done.thief ? "\u{1F4B0} The Jackpot Thief has been and gone today." : "\u{1F4B0} Keep an eye on the Jackpot. Somebody's been watching it.");
    L.push(`Your Star Fragments: ${(pl.C.frags | 0).toLocaleString()} (the Star Tent is in Cloudreach). Wanted posters taken: ${pl.C.takes | 0}.`);
    pl.out.push({ type: "popup", title: "World events", icon: "\u{1F320}", text: L.join("\n\n") });
  };
  /* admin: "star" (falls now, lands in a minute where you stand if a star may land there), "star end"; "wanted" (a poster now: on your map if it has a
     target), "wanted end"; "thief" (now, from where you stand if he may run there), "thief end"; "plan" (today's minutes, to you alone) */
  P.evAdmin = function (S, pl, arg, note) {
    if (G.HOLD.events) return note("World events are held (HOLD.events in the rules): they run on the dev server only.");
    const now = Date.now(), [what, how] = arg.toLowerCase().split(/\s+/), here = String(pl.C.scene || "").split(":")[0];
    if (what === "plan" || !what) { const E = this.ev; if (!E) return note("No plan yet."); return note(`Today (${E.day}): ${["star", "wanted", "thief"].map((k) => `${k} ${clockCT(E.plan[k])}${E.done[k] ? " (done)" : ""}`).join(", ")}.`); }
    if (what === "star") {
      if (how === "end") { const H = this.sstar; if (!H) return note("No star."); const Sx = this.scenes.get(H.scene); if (Sx) Sx.mobs = Sx.mobs.filter((x) => x.id !== H.id), Sx.whoSig = null; this.sstar = null; save(this, "sstar", null); this.evBroadcast(now, true); return note("The star is gone."); }
      if (this.sstar) return note(`A star is already ${this.sstar.phase === "warn" ? "falling" : "down"}.`);
      this.starWarn(now, now + 60000, SS.scenes[here] || here === "wild" ? here : null); return note(`A star lands in a minute: ${this.sstar.scene}.`);
    }
    if (what === "wanted") {
      if (how === "end") { if (!this.wanted) return note("No poster up."); this.wantedEscape(this.scenes.get(this.wanted.scene), this.scenes.get(this.wanted.scene)?.mobs.find((x) => x.id === this.wanted.id), now); return note("The poster is stamped ESCAPED."); }
      if (this.wanted) return note(`${this.wanted.name} is already wanted.`);
      this.wantedPost(now, WA.targets[here] ? here : null); return note(`Posted: ${this.wanted.name} in ${this.wanted.scene}.`);
    }
    if (what === "thief") {
      if (how === "end") { if (!this.thief) return note("No thief."); const Sx = this.scenes.get(this.thief.scene); this.thiefEscape(Sx, Sx?.mobs.find((x) => x.id === this.thief.id), now); return note("He got away."); }
      if (this.thief) return note("He's already loose.");
      const mine = TH.scenes.includes(here); this.thiefStart(now, mine ? here : null, mine ? { x: pl.x + 3, y: pl.y } : null); return note(`The Jackpot Thief is loose in ${this.thief?.scene}.`);
    }
    return note('Try "star", "wanted", "thief" (each with "end"), or "plan".');
  };
  for (const k of ["evTick", "evView", "evOpen", "tentOp", "evTell", "starSwing", "thiefMove", "thiefHit", "thiefDown", "wantedDown"]) {   /* nothing here may break the world's tick, a swing or a kill */
    const f = P[k]; P[k] = function (...a) { try { return f.apply(this, a); } catch (e) { console.error(k, e); return k === "evView" ? { now: Date.now(), star: null, wanted: null, thief: null } : null; } };
  }
}
