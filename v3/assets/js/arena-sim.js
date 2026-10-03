/* ============================================================ EAST ARENA: THE SIMULATION (2026-10-03). The fight, as one set of functions that the page and
   the server both run (the owner: "yes" to the server deciding the fight). Handed the rules (createSim(R)) rather than importing them, so the
   browser never loads arena-rules.js under two URLs: the page imports it at its ?v=, the Worker by path, and both pass it in here.

   WHO DECIDES WHAT (the design, EAST-ARENA.md):
     the server (arena-worker's Run object)  monsters (where they are, what they do), every hit you deal, kills, XP, drops, your health and mana
     your browser                            where YOU are (checked for speed and walls), and when an enemy shot or a monster's swing hits you
   The second half is on purpose: this is a dodging game, and a dodge decided on the server would be judged ~50 ms in the past, so a dodge
   you saw would sometimes count as a hit. The server owns the health those hits take, checks each one against what the room could hurt
   you for, and caps how often they can come.

   Everything that must come out the SAME on both sides (the room layout) uses only the seeded generator and whole numbers, which every
   JavaScript engine computes identically. Anything with trig in it (where a pack stands, where a bullet goes) is decided once, on the
   server, and sent. Nothing here touches the DOM, the network or a clock: time comes in as dt. */
export function createSim(R) {
  const T = 16, COLS = R.GRID.cols, ROWS = R.GRID.rows, W = COLS * T, H = ROWS * T, SK = R.SKILLS;
  const SLOT_KEYS = ["lmb", "q", "1", "2", "3"];
  const AREAS = R.CAMPAIGN.flatMap((a) => a.areas.map((x) => ({ ...x, act: a.act, actName: a.name })));
  const areaOf = (n) => R.areaOf(n);   /* a campaign area or a map tier (101-110) */
  /** a seeded generator (Park-Miller): the same seed gives the same numbers in every browser and on the server */
  const rng = (seed) => { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const walk = (g, x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && g[y][x] === ".";
  const passable = (g, x, y) => walk(g, x, y) || g[y]?.[x] === "e";

  /* ------------------------------------------------------------ rooms: EastScape's grid (44 x 26 at 16 px), the Crypt's stone */
  const blankGrid = () => Array.from({ length: ROWS }, (_, y) => Array.from({ length: COLS }, (_, x) => (x === 0 || x === COLS - 1 || y <= 1 || y === ROWS - 1 ? "v" : ".")));
  /** the Lounge (the brief's layout, compact): the stash, the campaign door east, and the four NPCs: Dex the Merchant, Brutus the Blacksmith at his
      anvil, Hexa the Enchanter, Charon the Rift Keeper by the sarcophagus (his portal, for now) */
  function makeLounge() {
    const g = blankGrid(), objs = [];
    for (let x = 6; x < COLS - 6; x += 9) objs.push({ k: "torch", x, y: 1 });
    objs.push({ k: "chest", x: 4, y: 6, name: "Your stash" }, { k: "sarc", x: 22, y: 5 }, { k: "npc", art: "dex", x: 9, y: 7, name: "Dex, the Merchant", talk: "shop" },
      { k: "anvil", x: 16, y: 7 }, { k: "npc", art: "brutus", x: 15, y: 7, name: "Brutus, the Blacksmith", talk: "salvage" },
      { k: "npc", art: "hexa", x: 9, y: 17, name: "Hexa, the Enchanter", talk: "enchant" },
      { k: "npc", art: "charon", x: 24, y: 7, name: "Charon, the Rift Keeper", talk: "rifts" });
    g[13][COLS - 1] = "e"; objs.push({ k: "door", x: COLS - 1, y: 13, to: "campaign", name: "The campaign" });
    return { g, objs, packs: [], kind: "lounge" };
  }
  /** room i of a run: walls with gaps, pillars, bones, packs. Pure function of (seed, area, i). */
  function makeRoom(seed, n, i, mods = []) {
    const AR = areaOf(n), rnd = rng(seed + i * 977), g = blankGrid(), objs = [], packs = [];
    const nWalls = 2 + (i % 2), xs = [];
    for (let k = 0; k < nWalls; k++) { const x = 8 + Math.floor(((k + 0.5) / nWalls) * (COLS - 16)) + Math.floor(rnd() * 4) - 2; xs.push(x); const gap = 5 + Math.floor(rnd() * (ROWS - 12)), gh = 4 + Math.floor(rnd() * 3); for (let y = 2; y < ROWS - 1; y++) if (y < gap || y >= gap + gh) g[y][x] = "v"; }
    for (let k = 0; k < 4; k++) { const x = 4 + Math.floor(rnd() * (COLS - 9)), y = 4 + Math.floor(rnd() * (ROWS - 9)); if (xs.some((wx) => Math.abs(wx - x) < 3) || Math.abs(y - 13) < 2) continue; g[y][x] = g[y][x + 1] = g[y + 1][x] = g[y + 1][x + 1] = "v"; }
    for (let k = 0; k < 6; k++) { const x = 3 + Math.floor(rnd() * (COLS - 6)), y = 3 + Math.floor(rnd() * (ROWS - 5)); if (g[y][x] === "." && Math.abs(y - 13) > 1) { g[y][x] = "#"; objs.push({ k: rnd() < 0.3 ? "sarc" : "bones", x, y }); } }
    for (let x = 5; x < COLS - 5; x += 7 + Math.floor(rnd() * 3)) objs.push({ k: "torch", x, y: 1 });
    for (let y = 11; y <= 15; y++) { g[y][1] = "."; g[y][COLS - 2] = "."; }
    g[13][0] = "e"; objs.push({ k: "door", x: 0, y: 13, to: "back", name: i === 0 ? "The stairs up to the Lounge" : "Back a room" });
    const last = i === AR.rooms - 1;
    if (!last) { g[13][COLS - 1] = "e"; objs.push({ k: "door", x: COLS - 1, y: 13, to: "next", name: "Deeper" }); }
    const np = (last && AR.boss ? 2 : 3) + R.extraPacks(mods);   /* a map's Crowded modifier adds a pack */
    for (let k = 0; k < np; k++) { let x, y, tries = 0; do { x = 10 + Math.floor(rnd() * (COLS - 14)); y = 3 + Math.floor(rnd() * (ROWS - 6)); tries++; } while (tries < 50 && !(walk(g, x, y) && walk(g, x + 1, y) && walk(g, x, y + 1) && walk(g, x - 1, y)));
      const kinds = i === 0 ? AR.pool.filter((q) => q !== "golem") : AR.pool, size = 3 + Math.floor(rnd() * 3), mobs = []; for (let j = 0; j < size; j++) mobs.push(kinds[Math.floor(rnd() * kinds.length)]);
      packs.push({ x, y, mobs }); }
    if (last && AR.boss) packs.push({ x: COLS - 8, y: 13, mobs: [AR.boss], boss: true });
    return { g, objs, packs, kind: "dungeon", last, n, i };
  }
  /** the exit a cleared last room opens (the same tile on both sides) */
  const openExit = (room) => { if (room.objs.some((o) => o.to === "out")) return; room.g[13][COLS - 1] = "e"; room.objs.push({ k: "door", x: COLS - 1, y: 13, to: "out", name: "The way out" }); };
  /** move a circle through the grid, axis by axis, stopping at walls */
  function moveCircle(g, e, r, dt) {
    const ok = (x, y) => { for (const [ox, oy] of [[-r, -r * 0.6], [r, -r * 0.6], [-r, r * 0.6], [r, r * 0.6]]) if (!passable(g, Math.floor((x + ox) / T), Math.floor((y + oy) / T))) return false; return true; };
    const nx = e.x + e.vx * dt; if (ok(nx, e.y)) e.x = nx; else e.vx = 0;
    const ny = e.y + e.vy * dt; if (ok(e.x, ny)) e.y = ny; else e.vy = 0;
  }
  const standable = (g, x, y, r = 5) => { for (const [ox, oy] of [[-r, -r * 0.6], [r, -r * 0.6], [-r, r * 0.6], [r, r * 0.6]]) if (!passable(g, Math.floor((x + ox) / T), Math.floor((y + oy) / T))) return false; return true; };

  /* ------------------------------------------------------------ a character's numbers: level, class, tree, gear, perks. C = { style, level, tree, worn, perks } */
  function statsFor(C) {
    const level = C.level || 1, B = R.LEVEL.base(level), St = R.STYLES[C.style] || R.STYLES.magic, TG = R.treeGrants(C.style || "magic", C.tree || []);
    const g = { level, dmg: B.dmg, pdmg: TG.dmg, speed: TG.speed, spd: 1 + TG.move + (St.mods.move || 0), def: St.mods.def + TG.def, leech: TG.leech, find: 0, crownsPct: 0, pierce: TG.pierce, bolts: 1 + TG.bolts,
      dodgeCd: 1.2, maxHp: B.hp * St.mods.hp * (1 + TG.hp), maxMp: B.mp * St.mods.mp * (1 + TG.mp), mpRegen: 7 * (1 + TG.mpRegen), rules: new Set(TG.rules), ring: 16, ringCd: 0, crit: 0.06, critX: 1.5,
      hpPct: 0, mpPct: 0, toughPlus: 0, double: 0, lifeKill: 0, lifeKillPct: 0, manaKill: 0, manaKillPct: 0, dodgePct: 0, mpRegenPct: 0,   /* the grants (R.applyGrant): legendary powers and set bonuses */
      src: { dmg: B.dmg, hp: Math.round(B.hp * St.mods.hp), mp: Math.round(B.mp * St.mods.mp), gearDmg: 0, gearHp: 0, gearDef: 0, tree: TG } };
    for (const it of Object.values(C.worn || {})) {
      for (const [k, v] of Object.entries(it.implicit || {})) { if (k === "dmg") { g.dmg += v; g.src.gearDmg += v; } if (k === "def") { g.def += v; g.src.gearDef += v; } if (k === "hp") { g.maxHp += v; g.src.gearHp += v; } if (k === "mp") g.maxMp += v; }
      for (const l of it.lines || []) { const v = l.v; if (l.id === "dmg") { g.dmg += v; g.src.gearDmg += v; } if (l.id === "pdmg") g.pdmg += v / 100; if (l.id === "speed") g.speed += v / 100; if (l.id === "hp") { g.maxHp += v; g.src.gearHp += v; } if (l.id === "mp") g.maxMp += v;
        if (l.id === "mpRegen") g.mpRegen *= 1 + v / 100; if (l.id === "def") { g.def += v; g.src.gearDef += v; } if (l.id === "move") g.spd += v / 100; if (l.id === "leech") g.leech += v / 100; if (l.id === "find") g.find += v / 100; if (l.id === "crowns") g.crownsPct += v / 100;
        if (l.id === "crit") g.crit += v / 100; if (l.id === "critX") g.critX += v / 100; if (l.id === "lifeKill") g.lifeKill += v; if (l.id === "manaKill") g.manaKill += v; if (l.id === "dodge") g.dodgePct += v / 100; }
    }
    for (const p of C.perks || []) { if (p === "bolt") g.bolts++; if (p === "dmg") g.pdmg += 0.15; if (p === "speed") g.spd += 0.1; if (p === "dodge") g.dodgeCd *= 0.75; if (p === "hp") g.maxHp += 25; if (p === "leech") g.leech += 0.03; if (p === "blast") { g.ring = 24; g.ringCd = 1; } if (p === "rare") g.find += 0.2; }
    /* legendaries' powers and set bonuses (R.gearPowers) */
    g.powers = R.gearPowers(C.worn).list; for (const pw of g.powers) R.applyGrant(g, pw.g);
    g.maxHp *= 1 + g.hpPct; g.maxMp *= 1 + g.mpPct; g.mpRegen *= 1 + g.mpRegenPct; g.dodgeCd *= Math.max(0.4, 1 - g.dodgePct); g.crit = Math.min(0.75, g.crit);
    if (g.rules.has("iron_will")) g.maxHp *= 1.3; if (g.rules.has("blood_magic")) g.maxHp *= 1.4;
    g.payHp = g.rules.has("iron_will") || g.rules.has("blood_magic");
    g.maxHp = Math.round(g.maxHp); g.maxMp = Math.round(g.maxMp); g.tough = Math.max(-0.5, Math.min(0.75, Math.min(0.6, g.def / (g.def + 60)) + g.toughPlus)); g.flatDmg = g.dmg; g.dmg = Math.round(g.dmg * (1 + g.pdmg));
    const own = TG.skills.filter((k) => SK[k]), start = St.start; g.slots = [start, ...own.filter((k) => k !== start)].slice(0, SLOT_KEYS.length);
    return g;
  }
  const cdOf = (k, g) => Math.max(0.08, SK[k].cd * (1 - Math.min(0.5, g.speed)) - (k === "nova" ? g.ringCd : 0));
  /** the fastest a character can legitimately move, px/s (dodge and dash are short bursts on top of this) */
  const topSpeed = (g) => 92 * g.spd;

  /* ------------------------------------------------------------ monsters for a room. Party size makes them tougher (each extra player +75% health),
     never more numerous: the room looks the same however many come. Positions use trig, so the server decides them and sends them. */
  const PARTY_HP = 0.75;
  function spawnMobs(room, alvl, partySize, seq0 = 1, mods = [], tier = 0) {
    const rnd = rng((room.n || 1) * 7919 + room.i * 104729 + 17), mobs = []; let id = seq0;
    room.packs.forEach((pk, pi) => pk.mobs.forEach((k, j) => {
      const d = R.mobDef(k, alvl, mods, tier); d.melee = d.type === "melee";   /* a Rift's tier and modifiers baked in */
      const hp = Math.round(d.hp * (1 + PARTY_HP * Math.max(0, partySize - 1)));
      const a = (j / pk.mobs.length) * Math.PI * 2, rr = d.boss ? 0 : 10 + j * 3;
      mobs.push({ id: id++, k, d, hp, maxHp: hp, x: (pk.x + 0.5) * T + Math.cos(a) * rr, y: (pk.y + 0.5) * T + Math.sin(a) * rr, vx: 0, vy: 0, t: rnd() * 3, pat: 1 + rnd(), awake: false, pack: pi, slow: 0, root: 0, stun: 0, taunt: 0, tauntBy: null });
    }));
    return mobs;
  }
  const wake = (st, m) => { if (m.awake) return; for (const o of st.mobs) if (o.pack === m.pack) o.awake = true; };

  /* ------------------------------------------------------------ PATHS (2026-10-03, the owner's list: "monsters that route around walls"). For each
     living player, a flow field: every floor tile's walking distance to that player's tile, by a breadth-first fill over the room's 44 x 26
     (1,144 tiles, so a few microseconds), redone only when that player steps onto another tile. A monster that can SEE its target walks
     straight at it, as before; one that can't steps towards the neighbouring tile that is nearest the target, so it goes round the wall
     through the gap. Monsters also choose whom to chase by walking distance, not as the crow flies, so a player behind a wall doesn't pull
     the room into that wall. Ranged monsters only shoot what they can see. */
  const tileIdx = (x, y) => y * COLS + x;
  function flowField(g, tx, ty) {
    const n = COLS * ROWS, d = new Int16Array(n).fill(-1), q = new Int32Array(n); let h = 0, t = 0;
    if (!passable(g, tx, ty)) return d;
    d[tileIdx(tx, ty)] = 0; q[t++] = tileIdx(tx, ty);
    while (h < t) { const i = q[h++], x = i % COLS, y = (i / COLS) | 0, nd = d[i] + 1;
      if (x > 0 && d[i - 1] < 0 && passable(g, x - 1, y)) { d[i - 1] = nd; q[t++] = i - 1; }
      if (x < COLS - 1 && d[i + 1] < 0 && passable(g, x + 1, y)) { d[i + 1] = nd; q[t++] = i + 1; }
      if (y > 0 && d[i - COLS] < 0 && passable(g, x, y - 1)) { d[i - COLS] = nd; q[t++] = i - COLS; }
      if (y < ROWS - 1 && d[i + COLS] < 0 && passable(g, x, y + 1)) { d[i + COLS] = nd; q[t++] = i + COLS; } }
    return d;
  }
  /** the field for a player, reused while they stay on the same tile (cached on st.flows, which the caller keeps between ticks) */
  function fieldFor(st, p) {
    const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T), key = tileIdx(tx, ty), c = st.flows?.get(p.id);
    if (c && c.key === key && c.g === st.room.g) return c.d;
    const d = flowField(st.room.g, tx, ty); st.flows?.set(p.id, { key, g: st.room.g, d }); return d;
  }
  /** can a straight line from a to b cross the room without touching a wall? (checked every 6 px, with a little width) */
  function clearLine(g, ax, ay, bx, by) {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / 6));
    for (let i = 1; i < n; i++) { const k = i / n, x = ax + (bx - ax) * k, y = ay + (by - ay) * k;
      for (const [ox, oy] of [[0, 0], [-4, 0], [4, 0]]) if (!walk(g, Math.floor((x + ox) / T), Math.floor((y + oy) / T))) return false; }
    return true;
  }
  /** where a monster should head for its target: the target itself if it can see it, else the centre of the next tile along the path */
  function nextStep(st, m, p) {
    if (clearLine(st.room.g, m.x, m.y, p.x, p.y)) return { x: p.x, y: p.y, seen: true };
    const d = fieldFor(st, p), mx = Math.floor(m.x / T), my = Math.floor(m.y / T), here = d[tileIdx(mx, my)];
    if (here < 0) return { x: p.x, y: p.y, seen: false };   /* off the map of reachable tiles (shoved into a wall corner): just push towards them */
    let best = null, bd = here;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = mx + ox, ny = my + oy; if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (ox && oy && (d[tileIdx(mx + ox, my)] < 0 || d[tileIdx(mx, my + oy)] < 0)) continue;   /* never cut a corner of a wall */
      const v = d[tileIdx(nx, ny)]; if (v >= 0 && v < bd) { bd = v; best = [nx, ny]; }
    }
    return best ? { x: (best[0] + 0.5) * T, y: (best[1] + 0.5) * T, seen: false } : { x: p.x, y: p.y, seen: false };
  }
  /** walking distance (tiles) from a monster to a player, for choosing whom to chase */
  const walkDist = (st, m, p) => { const v = fieldFor(st, p)[tileIdx(Math.floor(m.x / T), Math.floor(m.y / T))]; return v < 0 ? 1e6 + Math.hypot(p.x - m.x, p.y - m.y) : v; };

  /** monsters think and move (the server). st = { room, mobs, players: [{ id, x, y, alive }], pend, t, flows }. Shots go into ev as { t: "shot", ... } */
  function mobStep(st, dt, ev) {
    const alive = st.players.filter((p) => p.alive);
    for (const m of st.mobs) {
      if (m.hp <= 0) continue;
      const d = m.d; m.slow -= dt; m.root -= dt; m.stun -= dt; m.taunt -= dt;
      let tgt = null, dist = 1e9;
      if (m.taunt > 0 && m.tauntBy) tgt = alive.find((p) => p.id === m.tauntBy) || null;
      if (tgt) dist = Math.hypot(tgt.x - m.x, tgt.y - m.y) || 1;
      else if (!m.awake) { for (const p of alive) { const dd = Math.hypot(p.x - m.x, p.y - m.y); if (dd < dist) { dist = dd; tgt = p; } } }   /* waking is by distance (they hear you through a wall) */
      else { let best = 1e9; for (const p of alive) { const wd = walkDist(st, m, p); if (wd < best) { best = wd; tgt = p; } } if (tgt) dist = Math.hypot(tgt.x - m.x, tgt.y - m.y) || 1; }
      if (!m.awake) { if (tgt && (dist < T * 7 || (d.boss && dist < T * 12))) { wake(st, m); ev.push({ t: "wake", m: m.id }); } else { m.t += dt; continue; } }
      if (!tgt) { m.vx *= 0.8; m.vy *= 0.8; continue; }
      if (m.stun > 0) { m.vx = m.vy = 0; m.t += dt; continue; }
      const dx = tgt.x - m.x, dy = tgt.y - m.y; dist = dist || 1;
      const go = nextStep(st, m, tgt), gx = go.x - m.x, gy = go.y - m.y, gl = Math.hypot(gx, gy) || 1; m.sees = go.seen;
      let ax = (gx / gl) * d.acc, ay = (gy / gl) * d.acc;
      if (d.keep && dist < d.keep && go.seen && !(m.taunt > 0)) { ax = -(dx / dist) * d.acc; ay = -(dy / dist) * d.acc; }
      if (d.boss && dist < 80 && go.seen) { ax *= -0.4; ay *= -0.4; }
      for (const o of st.mobs) if (o !== m && o.awake && o.hp > 0) { const ox = m.x - o.x, oy = m.y - o.y, od = Math.hypot(ox, oy); if (od < m.d.r + o.d.r + 4 && od > 0) { ax += (ox / od) * 500; ay += (oy / od) * 500; } }
      m.vx += ax * dt; m.vy += ay * dt; m.vx *= Math.pow(0.88, dt * 60); m.vy *= Math.pow(0.88, dt * 60);
      const top = d.spd * (m.slow > 0 ? 0.5 : 1), ms = Math.hypot(m.vx, m.vy); if (ms > top) { m.vx *= top / ms; m.vy *= top / ms; }
      if (m.root > 0) { m.vx = m.vy = 0; } else moveCircle(st.room.g, m, Math.min(7, d.r), dt);
      m.t += dt;
      if (d.pat) { m.pat -= dt; if (m.pat <= 0 && dist < T * 14 && m.sees) { m.pat = d.every; const a = Math.atan2(dy, dx); if (d.pat === "aim") shoot(st, m, a, 110, 1, 0, 0, ev); else { ev.push({ t: "tele", m: m.id, a }); shoot(st, m, a, 95, 5, 0.22, 0, ev); } } }
      if (d.boss) { const be = d.bossEvery || 2.1; m.pat -= dt; if (m.pat <= 0) { m.pat = be; const which = Math.floor(m.t / be) % 3, a0 = Math.atan2(dy, dx);
        if (which === 0) { ev.push({ t: "tele", m: m.id, ring: true }); for (let i = 0; i < 24; i++) shoot(st, m, (i / 24) * Math.PI * 2, 85, 1, 0, 0.3, ev); }
        else if (which === 1) { ev.push({ t: "tele", m: m.id, a: a0 }); for (let k = 0; k < 3; k++) st.pend.push({ at: st.t + k * 0.22, m: m.id }); }
        else for (let i = 0; i < 30; i++) shoot(st, m, m.t * 2 + i * 0.4, 70 + i * 1.5, 1, 0, i * 0.05, ev); } }
    }
    /* the boss's aimed bursts, fired when due at whoever is nearest then */
    st.pend = st.pend.filter((q) => { if (q.at > st.t) return true; const m = st.mobs.find((x) => x.id === q.m && x.hp > 0); if (!m) return false;
      let tgt = null, dist = 1e9; for (const p of alive) { const dd = Math.hypot(p.x - m.x, p.y - m.y); if (dd < dist) { dist = dd; tgt = p; } }
      if (tgt) shoot(st, m, Math.atan2(tgt.y - m.y, tgt.x - m.x), 125, 7, 0.16, 0, ev); return false; });
  }
  /** a monster fires: n bullets in a spread. The server sends these; each browser flies them and decides whether one hits its own player. */
  function shoot(st, m, a, v, n, spread, delay, ev) {
    for (let i = 0; i < n; i++) { const aa = a + (i - (n - 1) / 2) * spread; ev.push({ t: "shot", x: r1(m.x), y: r1(m.y - 6), vx: r1(Math.cos(aa) * v), vy: r1(Math.sin(aa) * v), r: m.d.boss ? 3.5 : 3, dmg: Math.round(m.d.max * 0.6), delay: r2(delay), boss: !!m.d.boss, m: m.id }); }
  }
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  /** the most one hit in this room can do to a player (before armour): the server's check on what a browser reports */
  const maxHitIn = (mobs) => mobs.reduce((a, m) => (m.hp > 0 ? Math.max(a, Math.round(m.d.max * 0.6)) : a), 0);

  /* ------------------------------------------------------------ your skills. castOn makes what a skill makes (projectiles, zones, a swing, a dash).
     VISUAL mode (the browser drawing its own or a party member's cast) makes the same shapes but never hurts anything: hits come from the server. */
  function castOn(st, p, k, ang, ax, ay, ev, visual) {
    const g = p.g, s = SK[k]; if (!s) return;
    const dmg = g.dmg * s.mult, ox = p.x, oy = p.y - 7, shot = (a, o) => st.pb.push({ x: ox, y: oy, vx: Math.cos(a) * o.speed, vy: Math.sin(a) * o.speed, t: o.life || 1.4, f: 0, dmg, ox, oy, hits: new Set(), by: p.id, vis: !!visual, ...o });
    const n = g.bolts, fx = st.fx;
    if (s.kind === "bolt") for (let i = 0; i < n; i++) shot(ang + (i - (n - 1) / 2) * 0.14, { speed: s.speed, art: s.fx, pierce: g.pierce, el: "arcane" });
    else if (s.kind === "ring") { for (let i = 0; i < g.ring; i++) shot((i / g.ring) * Math.PI * 2, { speed: s.speed, art: s.fx, big: true, life: 1.1, pierce: g.pierce, el: "fire" }); fx?.push({ kind: "boom", x: p.x, y: p.y - 5, t: 0.5, big: true }); }
    else if (s.kind === "lance") for (let i = 0; i < n; i++) shot(ang + (i - (n - 1) / 2) * 0.14, { speed: s.speed, art: s.fx, pierce: s.pierce + g.pierce, slow: s.slow, lance: true, el: "frost" });
    else if (s.kind === "chain") shot(ang, { speed: s.speed, art: s.fx, jumps: s.jumps, range: s.range * T, chain: true, el: "storm" });
    else if (s.kind === "arrow") for (let i = 0; i < n; i++) shot(ang + (i - (n - 1) / 2) * 0.1, { speed: s.speed, arrow: true, pierce: g.pierce, life: 1.1 });
    else if (s.kind === "fan") { const c = s.count + n - 1; for (let i = 0; i < c; i++) shot(ang + (i - (c - 1) / 2) * s.spread, { speed: s.speed, arrow: true, pierce: g.pierce, life: 0.9 }); }
    else if (s.kind === "rain" || s.kind === "trap") { const dx = ax - p.x, dy = ay - p.y, d = Math.hypot(dx, dy) || 1, r = Math.min(d, s.range * T);
      st.zones.push({ kind: s.kind, x: p.x + (dx / d) * r, y: p.y + (dy / d) * r, r: s.radius * T, t: 0, dmg, next: 0.35, ticks: s.ticks || 0, every: s.every || 0, life: s.life || 2, root: s.root || 0, art: s.fx, by: p.id, vis: !!visual }); }
    else if (s.kind === "arc" || s.kind === "slam") { const reach = s.reach * T, half = s.width / 2;
      if (!visual) for (const m of st.mobs) { if (m.hp <= 0) continue; const dx = m.x - p.x, dy = m.y - 6 - p.y, d = Math.hypot(dx, dy); if (d > reach + m.d.r) continue; let da = Math.atan2(dy, dx) - ang; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) <= half || d < m.d.r + 4) hit(st, m, dmg, { stun: s.stun }, p.id, ev); }
      fx?.push({ kind: "slash", x: p.x, y: p.y - 6, a: ang, half, r: reach, t: 0.16, max: 0.16, big: s.kind === "slam" }); if (s.kind === "slam") fx?.push({ kind: "boom", x: p.x + Math.cos(ang) * reach * 0.6, y: p.y - 6 + Math.sin(ang) * reach * 0.6, t: 0.45, big: true }); }
    else if (s.kind === "dash") {
      if (visual) { const t = 0.18, sp = (s.dist * T) / t; p.dash = { t }; p.vx = Math.cos(ang) * sp; p.vy = Math.sin(ang) * sp; p.inv = Math.max(p.inv || 0, t + 0.05); }
      else { /* the server sweeps the line the dash will travel (stopping at a wall) and hits everything along it, once */
        const end = { x: p.x, y: p.y, vx: Math.cos(ang) * s.dist * T, vy: Math.sin(ang) * s.dist * T }; for (let i = 0; i < 10; i++) moveCircle(st.room.g, end, 5, 0.1);
        for (const m of st.mobs) { if (m.hp <= 0) continue; if (segDist(m.x, m.y - 6, p.x, p.y, end.x, end.y) < m.d.r + 8) hit(st, m, dmg, {}, p.id, ev); }
        p.dashTo = { x: end.x, y: end.y }; }
    }
    else if (s.kind === "cry") { p.cry = s.dur; if (!visual) for (const m of st.mobs) if (m.hp > 0 && Math.hypot(m.x - p.x, m.y - p.y) < s.range * T) { if (!m.awake) { wake(st, m); ev.push({ t: "wake", m: m.id }); } m.taunt = s.dur; m.tauntBy = p.id; }
      fx?.push({ kind: "cry", x: p.x, y: p.y - 8, t: 0.6, r: s.range * T }); }
  }
  const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); };
  /** a hit on a monster (the server only): crit, damage, statuses, the kill. st.hooks.dealt / killed let the run pay leech, XP and drops. */
  function hit(st, m, base, opt, by, ev) {
    if (m.hp <= 0) return 0;
    if (!m.awake) { wake(st, m); ev.push({ t: "wake", m: m.id }); }
    const p = st.byId?.(by), g = p?.g || { crit: 0.06, critX: 1.5 }, rnd = st.rand || Math.random, crit = rnd() < g.crit, twice = g.double > 0 && rnd() < g.double;
    const n = Math.max(1, Math.round(base * (crit ? g.critX : 1) * (twice ? 2 : 1)));   /* "lands twice" (a unique's power) is one hit for double */
    m.hp -= n; ev.push({ t: "hit", m: m.id, n, c: crit ? 1 : 0, ...(twice ? { d: 1 } : {}), el: opt.el || null, by });
    if (opt.slow) m.slow = Math.max(m.slow, opt.slow); if (opt.stun) m.stun = Math.max(m.stun, opt.stun); if (opt.root) m.root = Math.max(m.root, opt.root);
    st.hooks?.dealt?.(by, n);
    if (m.hp <= 0) { m.hp = 0; ev.push({ t: "kill", m: m.id, by }); st.hooks?.killed?.(m, by); }
    return n;
  }
  /** projectiles fly: pierce, chain, slow, Point Blank. A visual one stops on the first monster it meets and hurts nothing. */
  function projStep(st, dt, ev) {
    for (const b of st.pb) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.t -= dt; b.f += dt * 24;
      if (!walk(st.room.g, Math.floor(b.x / T), Math.floor(b.y / T))) { b.t = 0; continue; }
      for (const m of st.mobs) if (m.hp > 0 && !b.hits.has(m.id) && Math.hypot(m.x - b.x, m.y - 6 - b.y) < m.d.r + (b.big ? 6 : 4)) {
        b.hits.add(m.id);
        if (!b.vis) { let dm = b.dmg; const p = st.byId?.(b.by); if (b.arrow && p?.g.rules.has("point_blank")) { const fl = Math.hypot(b.x - b.ox, b.y - b.oy); dm *= fl < 3 * T ? 1.5 : fl > 7 * T ? 0.7 : 1; } hit(st, m, dm, { slow: b.slow, el: b.el }, b.by, ev); }
        if (b.chain && b.jumps > 0) { let best = null, bd = b.range; for (const o of st.mobs) if (o.hp > 0 && !b.hits.has(o.id)) { const dd = Math.hypot(o.x - m.x, o.y - m.y); if (dd < bd) { bd = dd; best = o; } }
          if (best) { b.jumps--; const a = Math.atan2(best.y - m.y, best.x - m.x), sp = Math.hypot(b.vx, b.vy); st.fx?.push({ kind: "zap", x: m.x, y: m.y - 6, x2: best.x, y2: best.y - 6, t: 0.15 }); b.x = m.x; b.y = m.y - 6; b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.t = 0.6; break; } }
        if ((b.pierce || 0) > 0) { b.pierce--; continue; } b.t = 0; break;
      }
    }
    st.pb = st.pb.filter((b) => b.t > 0);
  }
  /** the ground: rain ticks, traps wait for something to step in */
  function zoneStep(st, dt, ev) {
    for (const z of st.zones) { z.t += dt;
      if (z.kind === "rain") { if (z.t >= z.next && z.ticks > 0) { z.ticks--; z.next += z.every; if (!z.vis) for (const m of st.mobs) if (m.hp > 0 && Math.hypot(m.x - z.x, m.y - z.y) < z.r + m.d.r * 0.5) hit(st, m, z.dmg, {}, z.by, ev); } if (z.ticks <= 0 && z.t > z.next) z.done = true; }
      else if (z.kind === "trap" && z.t > 0.4) { if (st.mobs.some((m) => m.hp > 0 && Math.hypot(m.x - z.x, m.y - z.y) < z.r + m.d.r * 0.5)) { if (!z.vis) for (const m of st.mobs) if (m.hp > 0 && Math.hypot(m.x - z.x, m.y - z.y) < z.r * 1.6) hit(st, m, z.dmg, { root: z.root }, z.by, ev); st.fx?.push({ kind: "boom", x: z.x, y: z.y, t: 0.45 }); z.done = true; } else if (z.t > z.life) z.done = true; } }
    st.zones = st.zones.filter((z) => !z.done);
  }
  /** a room is done when its monsters are (or, in a boss room, the boss is) */
  const roomClear = (room, mobs) => (room.packs.some((p) => p.boss) ? !mobs.some((m) => m.d.boss && m.hp > 0) : !mobs.some((m) => m.hp > 0));

  return { T, COLS, ROWS, W, H, SLOT_KEYS, AREAS, areaOf, rng, walk, passable, makeLounge, makeRoom, openExit, moveCircle, standable, statsFor, cdOf, topSpeed,
    spawnMobs, PARTY_HP, mobStep, flowField, clearLine, maxHitIn, castOn, hit, projStep, zoneStep, roomClear, segDist };
}
