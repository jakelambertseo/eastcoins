/* ============================================================
   EastScape — the game server

   One Durable Object, "the world", holds every scene and every
   connected player. Pages only draw: they send what the player
   wants (walk here, attack that, wield this) and the world decides
   what happens, then sends each scene's state out several times a
   second.

   Saving is continuous and invisible: a character lives in memory
   while its player is connected and is written to storage within a
   few seconds of any change, and again the moment the connection
   drops (tab closed, browser quit, network gone). There is nothing
   to "save" and nothing to lose.

   The rules (maps, items, levels, quests) are imported from the same
   file the page uses: v3/assets/js/eastscape-shared.js.
   ============================================================ */

import * as G from "../../v3/assets/js/eastscape-shared.js";

const TICK_MS = 50;          // the world steps twenty times a second, so actions start the moment you arrive
const SNAP_EVERY = 2;        // the world's state goes out ten times a second; your own news (xp, messages, dialogue) every tick
const SAVE_MS = 4000;        // a changed character is written at most this long after the change
const STEP = 240;            // one tile of walking
const SCENE_IDLE_MS = 120000;
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const BOT_LINES = ["anyone know where the good fishing is?", "gz", "cows are free xp lol", "selling feathers", "this farm is peaceful", "wheat run anyone?", "brb", "that yew is taunting me", "who keeps feeding the olives"];
const EXAMINE_KINDS = new Set(["hive", "notice", "sign", "statue", "fountain", "fire", "bush", "boulder", "hay", "counter", "pool", "column", "range", "table", "barrel", "bed", "plant", "bench", "goatstatue", "chest", "rug", "chair", "sack", "cat", "bucket", "bigtomato", "press", "crate", "scarecrow", "milestone", "toll", "barricade", "chariot", "mule"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok", { headers: { "Cache-Control": "no-store" } });
    // which Cloudflare data centre the world runs in, and how long the hop from this edge to it takes
    if (url.pathname === "/where") {
      const t0 = Date.now(), r = await env.WORLD.get(env.WORLD.idFromName("world")).fetch("https://world/where"), j = await r.json();
      return Response.json({ edge: request.cf?.colo, world: j.colo, hopMs: Date.now() - t0, players: j.players }, { headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname !== "/ws") return new Response("EastScape game server", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a websocket", { status: 426 });
    const origin = request.headers.get("Origin") || "";
    if (!(env.ALLOWED_ORIGINS || "").split(",").includes(origin)) return new Response("Forbidden", { status: 403 });

    // who is this? a site ticket, or (only under wrangler dev) a dev login
    let user = null;
    const ticket = url.searchParams.get("ticket");
    if (ticket) {
      try {
        const r = await fetch(`${env.SITE}/api/eastscape/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket }) });
        if (r.ok) { const j = await r.json(); if (j.ok) user = j.user; }
      } catch (e) { /* site unreachable: treated as not signed in */ }
    } else if (env.DEV === "1" && url.searchParams.get("dev")) {
      const login = (url.searchParams.get("login") || "devtester").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 25) || "devtester";
      user = { id: `dev:${login}`, login, name: login, admin: true };
    }
    if (!user) return new Response("Not signed in", { status: 401 });

    const stub = env.WORLD.get(env.WORLD.idFromName("world"));
    const headers = new Headers(request.headers); headers.set("x-es-user", JSON.stringify(user));
    return stub.fetch(new Request(request, { headers }));
  }
};

export class World {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env;
    this.pls = new Map();       // player id -> session
    this.scenes = new Map();    // scene key -> live scene
    this.timer = null; this.tickN = 0; this.nextChatter = 0;
    this.trades = new Map();    // trade id -> a trade between two players in progress
    this.gseq = 0;              // ids for things lying on the ground
    // the Exchange: every offer from every player, online or not. Loaded before anything else runs.
    ctx.blockConcurrencyWhile(async () => { this.ex = (await ctx.storage.get("exchange")) || { next: 1, orders: [], last: {}, tax: 0 }; });
  }

  /* ------------------------------------------------------------ connections */
  async fetch(request) {
    if (new URL(request.url).pathname === "/where") {
      let colo = null; try { colo = (await (await fetch("https://www.cloudflare.com/cdn-cgi/trace")).text()).match(/colo=(\w+)/)?.[1]; } catch (e) { /* unknown */ }
      return Response.json({ colo, players: this.pls.size });
    }
    let user; try { user = JSON.parse(request.headers.get("x-es-user")); } catch (e) { /* none */ }
    if (!user?.id) return new Response("No user", { status: 400 });
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    server.accept();
    await this.join(user, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async join(user, ws) {
    // one connection per character: a second tab takes over from the first
    const old = this.pls.get(user.id);
    if (old) { this.send(old, { type: "kicked", message: "You logged in from another tab." }); await this.leave(old, true); try { old.ws.close(4000, "replaced"); } catch (e) { /* gone */ } }

    const stored = await this.ctx.storage.get(`char:${user.id}`);
    const C = G.normChar(stored);
    const pl = { id: user.id, login: user.login, name: user.name || user.login, admin: !!user.admin, ws, C,
      x: C.x, y: C.y, path: [], step: null, face: 1, dir: "south", act: null,
      lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: true, needSave: !stored, out: [], god: false, msgs: 0, msgWindow: 0, joinedAt: Date.now() };
    this.pls.set(user.id, pl);
    this.ctx.storage.put(`who:${String(user.login).toLowerCase()}`, { id: user.id, name: pl.name }).catch(() => {});
    const S = this.scene(C.scene);
    this.placeSafely(S, pl);
    ws.addEventListener("message", (e) => { try { this.onMessage(pl, JSON.parse(e.data)); } catch (err) { /* ignore bad frames */ } });
    ws.addEventListener("close", () => this.leave(pl));
    ws.addEventListener("error", () => this.leave(pl));
    this.send(pl, { type: "hello", version: G.VERSION, t: Date.now(), you: { id: pl.id, login: pl.login, name: pl.name, admin: pl.admin }, me: this.meOf(pl) });
    this.send(pl, JSON.parse(this.snapOf(S, Date.now(), false)));
    if (!stored) this.say(pl, "Welcome to EastScape. Your pickaxe, axe and fishing rod are in your bag: click one to wield it before you mine, chop or fish.");
    else this.say(pl, `Welcome back, ${pl.name}.`);
    this.start();
  }

  async leave(pl, replaced = false) {
    if (pl.left) return; pl.left = true;
    if (pl.trade) this.tradeEnd(pl.trade, `${pl.name} left.`);
    for (const S of this.scenes.values()) if (S.owner === pl.id) S.isleCopy = pl.C.isle;   // visitors keep seeing it as it was left
    const S = this.scenes.get(pl.C.scene), now = Date.now();
    if (!replaced && S?.def.pvp && now - (pl.combatAt || 0) < G.PVP.lingerMs && this.pls.get(pl.id) === pl) {
      pl.lingerUntil = now + G.PVP.lingerMs; pl.path = []; pl.act = null; pl.needSave = true;
      await this.persist(pl); return;
    }
    if (this.pls.get(pl.id) === pl) this.pls.delete(pl.id);
    pl.act = null; pl.path = [];
    await this.persist(pl);
    if (!this.pls.size) this.stop();
  }

  start() { if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS); }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  send(pl, msg) { try { pl.ws.send(typeof msg === "string" ? msg : JSON.stringify(msg)); } catch (e) { /* closing */ } }
  say(pl, text, cls = "sys", tag) { pl.out.push({ type: "say", text, cls, tag }); }

  async persist(pl) {
    if (!pl.needSave) return;
    pl.C.x = pl.x; pl.C.y = pl.y; pl.C.saved = Date.now();
    pl.needSave = false;
    try { await this.ctx.storage.put(`char:${pl.id}`, pl.C); pl.out.push({ type: "saved", t: pl.C.saved }); }
    catch (e) { pl.needSave = true; }
  }
  touch(pl) { pl.dirty = true; pl.needSave = true; pl.changedAt ??= Date.now(); }

  meOf(pl) { const C = pl.C; return { isle: { tier: C.isle.tier, themes: C.isle.themes }, speedTest: pl.speedTest || 0, hp: C.hp, inv: C.inv, bank: C.bank, eq: C.eq, xp: C.xp, qs: C.qs, settings: C.settings, scene: C.scene, god: pl.god, saved: C.saved || 0 }; }

  /* ------------------------------------------------------------ scenes */
  scene(key) {
    let S = this.scenes.get(key);
    if (S) return S;
    const def = G.sceneDef(key), b = G.buildScene(key);
    S = { key, def, g: b.g, objs: b.objs, events: [], idleSince: 0, ground: [] };
    S.owner = G.ownerOf(key);
    // the owner's other scenes (island, far shore, cottage) share what we know about an offline owner's island
    if (S.owner) for (const o of this.scenes.values()) if (o !== S && o.owner === S.owner) { S.isleCopy ||= o.isleCopy; S.ownerName ||= o.ownerName; }
    for (const o of S.objs) if (o.t === "olive" || o.t === "vine") o.left = o.picks || 4;
    S.mobs = def.mobs.map(([t, x, y], i) => ({ id: `${key}m${i}`, t, x, y, hx: x, hy: y, hp: G.MOBS[t].hp, path: [], step: null, face: Math.random() < 0.5 ? 1 : -1, nextWander: 0, dead: false, respawnAt: 0, hurtAt: 0, swingAt: 0, lastSwing: 0 }));
    S.npcs = def.npcs.map((n, i) => ({ ...n, id: `${key}n${i}`, hx: n.x, hy: n.y, path: [], step: null, face: -1, nextWander: 0, holdUntil: 0 }));
    S.bots = def.bots.map((bt, i) => {
      let x, y, tries = 0;
      do { x = rint(3, G.COLS - 4); y = rint(3, G.ROWS - 4); } while ((!G.walkableIn(S.g, x, y) || S.mobs.some((m) => m.x === x && m.y === y) || S.npcs.some((n) => n.x === x && n.y === y)) && ++tries < 300);
      return { ...bt, id: `${key}b${i}`, x, y, path: [], step: null, face: 1, dir: "south", nextWander: 0, hue: bt.level > 50 ? 150 : 0, working: null, goal: null };
    });
    this.scenes.set(key, S);
    return S;
  }
  isleOf(S) { return this.pls.get(S.owner)?.C.isle || S.isleCopy; }
  dropGround(S, k, n, x, y, owner, now) { S.ground.push({ id: `g${++this.gseq}`, k, n, x, y, owner, until: now + G.PVP.lootMs, gone: now + G.PVP.groundMs }); }
  playersIn(S) { const out = []; for (const p of this.pls.values()) if (p.C.scene === S.key) out.push(p); return out; }
  occupied(S, x, y, self) {
    const hit = (o) => o !== self && ((o.x === x && o.y === y) || (o.step && o.step.tx === x && o.step.ty === y));
    return S.mobs.some((m) => !m.dead && hit(m)) || S.npcs.some(hit) || S.bots.some(hit) || this.playersIn(S).some(hit);
  }
  placeSafely(S, pl) {
    if (G.walkableIn(S.g, pl.x, pl.y) && S.g[pl.y][pl.x] !== "e") return;
    // nearest open tile to the middle
    let best = null;
    for (let y = 1; y < G.ROWS - 1; y++) for (let x = 1; x < G.COLS - 1; x++) if (G.walkableIn(S.g, x, y) && S.g[y][x] !== "e") { const d = Math.hypot(x - 11, y - 7); if (!best || d < best.d) best = { x, y, d }; }
    if (S.key === "farm" && G.walkableIn(S.g, G.START.x, G.START.y)) best = G.START;
    pl.x = best.x; pl.y = best.y; this.touch(pl);
  }
  moveToScene(pl, key, side, at) {
    const S = this.scene(key);
    if (pl.trade) this.tradeEnd(pl.trade, "Trade cancelled: someone left the area.");
    pl.C.scene = key; pl.path = []; pl.step = null; pl.act = null;
    if (at) { pl.x = at.x; pl.y = at.y; }
    else if (side) {
      const mid = (G.SPAN[side][0] + G.SPAN[side][1]) / 2;
      pl.x = side === "w" ? 1 : side === "e" ? G.COLS - 2 : mid; pl.y = side === "n" ? 1 : side === "s" ? G.ROWS - 2 : mid;
    }
    this.placeSafely(S, pl);
    this.touch(pl);
    pl.out.push({ type: "scene", key });
    this.send(pl, JSON.parse(this.snapOf(S, Date.now(), false)));
  }

  /* ------------------------------------------------------------ what players ask for */
  onMessage(pl, m) {
    const now = Date.now();
    if (now - pl.msgWindow > 1000) { pl.msgWindow = now; pl.msgs = 0; }
    if (++pl.msgs > 40) return;                       // more than 40 a second is not a person
    const S = this.scene(pl.C.scene), C = pl.C;
    switch (m.t) {
      case "ping": return this.send(pl, { type: "pong", t: now, c: m.c });
      case "walk": {
        if (!Number.isInteger(m.x) || !Number.isInteger(m.y)) return;
        // path from where you'll be when the current step lands, so a new click never stops you dead
        pl.act = null; const p = G.findPath(S.g, this.from(pl), { x: m.x, y: m.y }, 0); if (p) { pl.path = p; this.kick(S, pl, now); } return;
      }
      case "step": {
        const dx = Math.sign(m.dx | 0), dy = Math.sign(m.dy | 0), f = this.from(pl);
        // held keys: queue the next step behind the one in progress rather than dropping it
        if ((dx || dy) && G.canStepIn(S.g, f.x, f.y, dx, dy)) { pl.act = null; pl.path = [{ x: f.x + dx, y: f.y + dy }]; this.kick(S, pl, now); }
        return;
      }
      case "act": return this.startAct(S, pl, m);
      case "wild": {
        if (S.key !== "farm" || !this.near(S, pl, "hole", 2) || G.lvlOf(C, G.WILD_REQ.skill) < G.WILD_REQ.lvl) return;
        this.moveToScene(pl, "wild", null, G.SCENES.wild.entry);
        return this.say(pl, "You climb down into the Wilderness. You're flagged for PvP: anyone here can attack you.", "bad");
      }
      case "isle": return this.isleOp(S, pl, m);
      case "equip": return this.equip(pl, m.i | 0);
      case "eat": return this.eat(pl, m.i | 0, now);
      case "shop": return this.shopOp(S, pl, m);
      case "unequip": return this.unequip(pl, String(m.slot));
      case "drop": {
        const i = m.i | 0, st = C.inv[i]; if (!st) return;
        if (st.k === "coins") return this.say(pl, "You'd rather not drop your Cash.");
        C.inv.splice(i, 1); this.say(pl, `You drop the ${G.ITEMS[st.k].name.toLowerCase()}.`); this.touch(pl); return;
      }
      case "chat": {
        // public chat is game-wide: everyone online sees it; it floats over the speaker's head for those in the same area
        const text = String(m.text || "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);
        if (!text || now - (pl.lastChat || 0) < 700) return;
        pl.lastChat = now;
        for (const p of this.pls.values()) p.out.push({ type: "chat", id: pl.id, name: pl.name, text, scene: pl.C.scene, t: now });
        return;
      }
      case "quest": return this.questOp(S, pl, m);
      case "talked": { const n = S.npcs.find((x) => x.id === m.npc); if (n) n.holdUntil = 0; return; }
      case "settings": {
        for (const [k, v] of Object.entries(m.patch || {})) if (k in G.DEFAULT_SETTINGS && typeof v === "boolean") C.settings[k] = v;
        this.touch(pl); return;
      }
      case "bank": return this.bankOp(S, pl, m);
      case "ex": return this.exOp(S, pl, m);
      case "trade": return this.tradeOp(S, pl, m);
      case "admin": return pl.admin ? this.admin(S, pl, m) : undefined;
    }
  }

  // where a player will stand once the step in progress lands
  from(pl) { return pl.step ? { x: pl.step.tx, y: pl.step.ty } : { x: pl.x, y: pl.y }; }
  // start walking straight away rather than on the next tick
  kick(S, pl, now) { if (!pl.step) this.stepEntity(S, pl, now, true); }

  startAct(S, pl, m) {
    const C = pl.C, f = this.from(pl), now = Date.now();
    let act = null;
    if (m.kind === "pvp") { if (!S.def.pvp) return; const T = this.pls.get(String(m.id)); if (!T || T === pl || T.C.scene !== S.key) return; act = { kind: "pvp", id: T.id, x: T.x, y: T.y, name: T.name }; }
    else if (m.kind === "ground") { const it = S.ground.find((x) => x.id === m.id); if (it) act = { kind: "ground", id: it.id, x: it.x, y: it.y, name: G.ITEMS[it.k].name }; }
    else if (m.kind === "mob") { const mob = S.mobs.find((x) => x.id === m.id && !x.dead); if (mob) act = { kind: "mob", id: mob.id, x: mob.x, y: mob.y, name: G.MOBS[mob.t].name }; }
    else if (m.kind === "npc") { const n = S.npcs.find((x) => x.id === m.id); if (n) act = { kind: "npc", id: n.id, x: n.x, y: n.y, name: n.name, reach: n.reach || 1 }; }
    else {
      const ob = S.objs[m.ob | 0]; if (!ob) return;
      const kind = { wheat: "wheat", spot: "spot", rock: "rock", vein: "vein", tree: "tree", oak: "tree", yew: "tree", cypress: "tree", deadtree: "tree", range: "cook", fire: "cook", olive: "olive", vine: "olive", hole: "hole", well: "well", house: "door", shrine: "shrine", booth: "bank", stall: "exchange", rope: "rope", ferry: "ferry", boatback: "boatback", plot: "plot", pedestal: "pedestal", islesign: "islesign" }[ob.t] || (EXAMINE_KINDS.has(ob.t) || G.EXAMINE[ob.t] ? ob.t : null);
      if (!kind) return;
      const at = kind === "door" ? ob.door : G.nearestCell(ob, f);
      act = { kind, ob, x: at.x, y: at.y, name: ob.name };
    }
    if (!act) return;
    act.started = 0;
    const p = G.findPath(S.g, f, act, act.kind === "ground" ? 0 : act.reach || G.reachOf(act.kind) || 1);
    if (p === null) { this.say(pl, "You can't reach that.", "bad"); pl.act = null; return; }
    pl.act = act; pl.path = p; this.kick(S, pl, now);
  }

  /* ------------------------------------------------------------ inventory and gear */
  // all or nothing: n of k go in (topping up stacks of 99, then new slots) or none do
  give(pl, k, n = 1) {
    const C = pl.C;
    if (G.roomFor(C.inv, k) < n) { this.say(pl, "Your inventory is full.", "bad"); return false; }
    G.addInv(C.inv, k, n); this.touch(pl); return true;
  }
  // as many of n as there's room for; returns how many went in
  giveUpTo(pl, k, n) {
    const q = Math.min(n, G.roomFor(pl.C.inv, k));
    if (q < 1) { this.say(pl, "Your inventory is full.", "bad"); return 0; }
    G.addInv(pl.C.inv, k, q); this.touch(pl); return q;
  }
  grant(pl, k, xp, track = true) {
    const C = pl.C, before = G.lvlOf(C, k);
    C.xp[k] = Math.max(0, (C.xp[k] || 0) + xp); const after = G.lvlOf(C, k);
    if (xp > 0) pl.out.push({ type: "xp", k, xp, track });
    if (after > before) { this.say(pl, `Congratulations, you just advanced a ${G.SKILLS[k].name} level! You are now level ${after}.`, "good"); pl.out.push({ type: "levelup", k, lvl: after }); if (k === "hp") C.hp = Math.min(G.maxHpOf(C), C.hp + (after - before)); }
    if (C.hp > G.maxHpOf(C)) C.hp = G.maxHpOf(C);
    this.touch(pl);
  }
  hasTool(pl, skill) {
    const C = pl.C, w = C.eq.weapon; if (w && G.ITEMS[w].tool === skill) return true;
    const k = G.TOOL_OF[skill], nm = G.ITEMS[k].name.toLowerCase();
    if (!C.inv.some((x) => x.k === k)) { this.say(pl, `You need a ${nm} to do that.`, "bad"); return false; }
    this.say(pl, `You need to hold your ${nm} first. Click it in your inventory to wield it.`, "bad");
    pl.out.push({ type: "hint", k });
    return false;
  }
  equip(pl, i) {
    const C = pl.C, st = C.inv[i]; if (!st) return; const it = G.ITEMS[st.k]; if (!it?.slot) return;
    if (it.req && G.lvlOf(C, it.req.skill) < it.req.lvl) return this.say(pl, `You need a ${G.SKILLS[it.req.skill].name} level of ${it.req.lvl} to use the ${it.name.toLowerCase()}.`, "bad");
    const old = C.eq[it.slot];
    if (st.n > 1) st.n--; else C.inv.splice(i, 1);
    if (old) this.give(pl, old);
    C.eq[it.slot] = st.k;
    this.say(pl, `You ${it.slot === "weapon" ? "wield" : "put on"} the ${it.name.toLowerCase()}.`);
    this.touch(pl);
  }
  // eating: a moment's pause, and your next swing waits a little
  eat(pl, i, now) {
    const C = pl.C, st = C.inv[i], it = st && G.ITEMS[st.k]; if (!it?.heal) return;
    if (now - (pl.lastEat || 0) < G.EAT_MS) return;
    pl.lastEat = now; pl.lastSwing = Math.max(pl.lastSwing, now - 1200);
    st.n--; if (!st.n) C.inv.splice(i, 1);
    const before = C.hp; C.hp = Math.min(G.maxHpOf(C), C.hp + it.heal); this.touch(pl);
    this.say(pl, C.hp > before ? `You eat the ${it.name.toLowerCase()}. It heals ${C.hp - before}.` : `You eat the ${it.name.toLowerCase()}. You were already full.`, "good");
  }
  // the Forge: buy from Brutus, sell him what you gathered. You have to be standing with him.
  shopOp(S, pl, m) {
    const C = pl.C, n = S.npcs.find((x) => x.opens === "shop");
    if (!n || G.cheb(pl, n) > 3) return this.say(pl, "You need to be at the Forge, with Brutus.", "bad");
    const cash = () => C.inv.find((x) => x.k === "coins");
    if (m.op === "buy") {
      const row = G.SHOP.sells.find(([k]) => k === m.k); if (!row) return;
      const [k, price] = row, want = Math.max(1, Math.min(1000, m.n === "all" ? 1000 : m.n | 0)), have = cash()?.n || 0, room = G.roomFor(C.inv, k), qty = Math.min(want, Math.floor(have / price), room);
      if (room < 1) return this.say(pl, "Your inventory is full.", "bad");
      if (qty < 1) return this.say(pl, `That's ${G.fmtCash(price)}. You have ${G.fmtCash(have)}.`, "bad");
      const c = cash(); c.n -= qty * price; if (!c.n) C.inv.splice(C.inv.indexOf(c), 1);
      this.give(pl, k, qty); this.touch(pl);
      return this.say(pl, `You buy ${qty > 1 ? `${qty} × ` : "a "}${G.ITEMS[k].name.toLowerCase()} for ${G.fmtCash(qty * price)}.`, "good");
    }
    if (m.op === "sell") {
      const st = C.inv[m.i | 0]; if (!st) return; const price = G.SHOP.buys[st.k];
      if (!price) return this.say(pl, `Brutus squints at the ${G.ITEMS[st.k].name.toLowerCase()}. "Not buying that."`);
      const k = st.k, all = G.countItems(C, [k]), qty = G.takeInv(C.inv, k, Math.max(1, Math.min(all, m.n === "all" ? all : m.n | 0)));
      this.give(pl, "coins", qty * price); this.touch(pl);
      return this.say(pl, `You sell ${qty > 1 ? `${qty} × ` : "the "}${G.ITEMS[k].name.toLowerCase()} for ${G.fmtCash(qty * price)}.`, "good");
    }
  }
  unequip(pl, slot) {
    const C = pl.C, k = C.eq[slot]; if (!k) return;
    if (!this.give(pl, k)) return;
    C.eq[slot] = null; this.say(pl, `You take off the ${G.ITEMS[k].name.toLowerCase()}.`); this.touch(pl);
  }

  /* ------------------------------------------------------------ quests */
  questOp(S, pl, m) {
    const C = pl.C, n = S.npcs.find((x) => x.id === m.npc), k = String(m.k || "");
    if (!n || !G.QUESTS[k] || G.cheb(pl, n) > 2 || G.npcQuest(C, n) !== k) return;
    const q = G.QUESTS[k], st = G.qState(C, k);
    if (m.op === "accept" && st === "new") { C.qs[k] = { state: "active", n: 0 }; this.say(pl, `Quest started: ${q.name}. ${q.brief}`, "good"); this.touch(pl); this.questCheck(pl); }
    if (m.op === "hand" && st === "ready") this.finishQuest(pl, k);
  }
  questCheck(pl) {
    const C = pl.C;
    for (const k in G.QUESTS) {
      const q = G.QUESTS[k], o = C.qs[k];
      if (o && o.state === "active" && q.goal.type === "bring" && !o.told && G.qHave(C, k) >= q.goal.n) { o.told = true; this.say(pl, `${q.name}: you have all ${q.goal.n} ${q.goal.what}. Take them to ${q.giver}.`, "good"); this.touch(pl); }
    }
  }
  questEvent(pl, type, what) {
    const C = pl.C;
    for (const k in G.QUESTS) {
      const q = G.QUESTS[k], o = C.qs[k];
      if (o && o.state === "active" && q.goal.type === type && q.goal.mob === what) { o.n++; this.touch(pl); if (o.n === q.goal.n) this.say(pl, `${q.name}: that's ${q.goal.n}. Go back to ${q.giver}.`, "good"); }
    }
  }
  finishQuest(pl, k) {
    const C = pl.C, q = G.QUESTS[k];
    if (q.goal.type === "bring") { let left = q.goal.n; for (const key of q.goal.items) { left -= G.takeInv(C.inv, key, left); if (!left) break; } }
    C.qs[k] = { ...(C.qs[k] || {}), state: "done" };
    if (q.reward.coins) this.give(pl, "coins", q.reward.coins);
    for (const [sk, xp] of Object.entries(q.reward.xp || {})) this.grant(pl, sk, xp);
    for (const [it, n] of q.reward.items || []) this.give(pl, it, n);
    pl.out.push({ type: "questdone", k });
    this.touch(pl);
  }

  /* ------------------------------------------------------------ the tick */
  tick() {
    const now = Date.now();
    this.tickN++;
    const live = new Set([...this.pls.values()].map((p) => p.C.scene));
    for (const [key, S] of this.scenes) {
      if (!live.has(key)) { S.idleSince ||= now; if (now - S.idleSince > SCENE_IDLE_MS && !(S.def.pvp && S.mobs.some((m) => m.dead && now < m.respawnAt))) this.scenes.delete(key); continue; }
      S.idleSince = 0;
      for (const pl of this.playersIn(S)) this.playerTick(S, pl, now);
      for (const o of S.objs) if (o.t === "wheat" && S.g[o.y][o.x] === "f" && !(o.grownAt > now)) {
        if (this.occupied(S, o.x, o.y, null)) o.grownAt = now + 2000;   // someone's standing in it: grow back a moment later
        else S.g[o.y][o.x] = "#";
      }
      this.mobsTick(S, now);
    }
    // the simulated players chat now and then
    if (now > this.nextChatter) {
      this.nextChatter = now + 9000;
      for (const key of live) { const S = this.scenes.get(key); if (S?.bots.length && Math.random() < 0.035) S.events.push({ type: "bubble", id: pick(S.bots).id, text: pick(BOT_LINES), t: now }); }
    }
    for (const T of this.trades.values()) { const a = this.pls.get(T.a), b = this.pls.get(T.b); if (!a || !b || G.cheb(a, b) > G.TRADE_RANGE + 2) this.tradeEnd(T, "Trade cancelled: you walked too far apart."); }
    if (this.tickN % SNAP_EVERY === 0) this.broadcast(now); else this.sendPrivate();
    for (const S of this.scenes.values()) if (S.ground.length) S.ground = S.ground.filter((x) => now < x.gone);
    for (const pl of this.pls.values()) if (pl.lingerUntil && now > pl.lingerUntil) { this.pls.delete(pl.id); pl.needSave = true; this.persist(pl); }
    if (!this.pls.size) this.stop();
    // saving: anything changed more than SAVE_MS ago is written now
    for (const pl of this.pls.values()) if (pl.needSave && pl.changedAt && now - pl.changedAt >= SAVE_MS) { pl.changedAt = null; this.persist(pl); }
  }

  stepEntity(S, e, now, isPlayer) {
    if (e.step) {
      if (now < e.step.t0 + e.step.ms) return true;
      e.x = e.step.tx; e.y = e.step.ty; e.step = null;
      if (isPlayer) this.touch(e);
    }
    const n = e.path.shift();
    if (!n) return false;
    const dx = n.x - e.x, dy = n.y - e.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== 1 || !G.canStepIn(S.g, e.x, e.y, dx, dy)) { e.path = []; return false; }
    // everyone but players waits rather than stepping onto someone
    if (!isPlayer && this.occupied(S, n.x, n.y, e)) { e.path = []; return false; }
    const base = isPlayer ? G.stepMsOf(e.C, e.speedTest || 0) : STEP;
    e.step = { fx: e.x, fy: e.y, tx: n.x, ty: n.y, t0: now, ms: Math.round(dx && dy ? base * 1.4 : base) };
    if (dx) e.face = dx > 0 ? 1 : -1;
    e.dir = G.DIRS[`${dx},${dy}`];
    return true;
  }

  playerTick(S, pl, now) {
    const C = pl.C;
    const moving = this.stepEntity(S, pl, now, true);
    // stepping onto the blue takes you through
    const edge = !moving && S.g[pl.y][pl.x] === "e", side = pl.x === G.COLS - 1 ? "e" : pl.x === 0 ? "w" : pl.y === 0 ? "n" : "s";
    if (edge && S.def.exitTo && !S.def.exits?.[side]) {
      const o = S.def.home ? { scene: G.isleKey(this.isleOf(S), S.owner), x: 10, y: 4 } : S.def.exitTo; this.moveToScene(pl, o.scene, null, o); pl.dir = "south";
      this.say(pl, `You step back out into ${G.sceneDef(o.scene).name.replace(/^The /, "the ")}.`); return;
    }
    if (!moving && S.g[pl.y][pl.x] === "e") {
      const d = side; let to = S.def.exits?.[d];
      if (to && S.owner) to = `${to}:${S.owner}`;   // an island's far shore is that owner's far shore
      if (to) { this.moveToScene(pl, to, G.OPP[d]); this.say(pl, `You travel to ${G.sceneDef(to).name}.`); return; }
    }
    if (!moving) this.doAction(S, pl, now);
    // a hitpoint back every 20 seconds out of a fight
    if (pl.act?.kind !== "mob") { if (now - pl.regen > 20000) { pl.regen = now; if (C.hp < G.maxHpOf(C)) { C.hp++; this.touch(pl); } } } else pl.regen = now;
  }

  workersOn(S, ob, except) {
    if (!ob) return 0;
    return S.bots.filter((b) => b.working?.ob === ob).length + this.playersIn(S).filter((p) => p !== except && p.act?.ob === ob && p.act.started).length;
  }
  // a gather landed: the item pops up over the gatherer for everyone in the area
  gained(S, pl, k, n = 1) {
    S.events.push({ type: "gain", who: pl.id, k, n, t: Date.now() });
    if (S.def.geode && Math.random() < S.def.geode && this.give(pl, "geode")) { S.events.push({ type: "gain", who: pl.id, k: "geode", n: 1, t: Date.now() }); this.say(pl, "Something glints in the dirt: a glimmering geode!", "loot"); }
  }
  groupNote(S, pl, a) {
    const n = this.workersOn(S, a.ob, pl); if (n === a.groupSeen) return; a.groupSeen = n;
    if (n) this.say(pl, `Group bonus: ${n} other${n > 1 ? "s" : ""} working this ${a.ob.name.toLowerCase()} with you. +${n}% to your chance and xp.`, "good", "group");
  }

  doAction(S, pl, now) {
    const a = pl.act, C = pl.C; if (!a || pl.path.length) return;
    const faceIt = () => { pl.dir = G.DIRS[`${Math.sign(a.x - pl.x)},${Math.sign(a.y - pl.y)}`] || pl.dir; pl.face = a.x > pl.x ? 1 : a.x < pl.x ? -1 : pl.face; };
    if (a.kind === "mob") {
      const m = S.mobs.find((x) => x.id === a.id); if (!m || m.dead) { pl.act = null; return; }
      if (G.cheb(pl, m) !== 1) { const p = G.findPath(S.g, pl, m, 1); if (p && p.length) pl.path = p; else if (!p) pl.act = null; return; }
      a.x = m.x; a.y = m.y; faceIt();
      if (!a.started) { a.started = now; pl.lastSwing = now - 1800; m.lastSwing = now; }
      if (now - pl.lastSwing >= 2400) {
        pl.lastSwing = now; pl.swingAt = now;
        const def = G.MOBS[m.t], hit = Math.random() < G.hitChance(G.lvlOf(C, "melee") + 1 + G.bonusOf(C).acc, def.def), dmg = hit ? rint(1, G.maxHitOf(C)) : 0;
        m.hp -= dmg; m.hurtAt = now; S.events.push({ type: "splat", who: m.id, n: dmg, kind: dmg ? "hit" : "miss", t: now });
        if (dmg) { this.grant(pl, "melee", dmg * 4); this.grant(pl, "hp", Math.round(dmg * 1.33), false); }
        if (m.hp <= 0) this.killMob(S, pl, m, now);
      }
      return;
    }
    if (a.kind === "pvp") return this.pvpSwing(S, pl, a, now, faceIt);
    if (a.kind === "ground") {
      pl.act = null;
      const it = S.ground.find((x) => x.id === a.id); if (!it) return this.say(pl, "Too late: it's gone.");
      if (G.cheb(pl, it) > 1) return;
      if (it.owner && it.owner !== pl.id && now < it.until) return this.say(pl, "That isn't yours to take. Not yet, anyway.", "bad");
      if (!this.give(pl, it.k, it.n)) return;
      S.ground.splice(S.ground.indexOf(it), 1);
      return this.say(pl, `You pick up the ${G.ITEMS[it.k].name.toLowerCase()}.`, "loot");
    }
    if (!G.inReach(pl, a, a.reach || G.reachOf(a.kind))) { pl.act = null; return; }
    if (a.kind === "npc") {
      const n = S.npcs.find((x) => x.id === a.id); pl.act = null; if (!n) return;
      faceIt(); n.face = pl.x > n.x ? 1 : -1; n.holdUntil = now + 60000; n.path = [];
      pl.out.push({ type: "talk", npc: n.id }); return;
    }
    pl.act = null;   // most things are one go; the gathering ones below put it back
    faceIt();
    if (a.kind === "door" && a.ob?.enter === "home" && S.owner) {
      this.moveToScene(pl, `home:${S.owner}`, null, G.SCENES.home.entry); pl.dir = "north";
      return this.say(pl, S.owner === pl.id ? "You go into your cottage." : `You go into ${S.ownerName || "their"}'s cottage.`);
    }
    if (a.kind === "door") {
      if (!a.ob?.enter || !G.SCENES[a.ob.enter]) return this.say(pl, `The ${a.name.toLowerCase()} is shut. It'll open soon.`);
      const inside = G.SCENES[a.ob.enter]; this.moveToScene(pl, a.ob.enter, null, inside.entry); pl.dir = "north";
      return this.say(pl, `You go into ${inside.name.replace(/^The /, "the ")}.`);
    }
    if (a.kind === "bank") return pl.out.push({ type: "bank" });
    if (a.kind === "exchange") { pl.out.push({ type: "exchange" }); return this.exSend(pl); }
    if (a.kind === "hole") {
      if (G.lvlOf(C, G.WILD_REQ.skill) < G.WILD_REQ.lvl) return pl.out.push({ type: "popup", title: "The Wilderness", icon: "☠️", text: `You need level ${G.WILD_REQ.lvl} in ${G.SKILLS[G.WILD_REQ.skill].name} to enter the Wilderness.` });
      return pl.out.push({ type: "wildask" });
    }
    if (a.kind === "rope") { this.moveToScene(pl, "farm", null, { x: 10, y: 9 }); return this.say(pl, "You climb back up to the farm. Nobody can attack you up here."); }
    if (a.kind === "ferry") return pl.out.push({ type: "ferry" });
    if (a.kind === "boatback") { this.moveToScene(pl, "river", null, G.ISLE_FERRY); return this.say(pl, "Charon rows you back to River Bend without a word."); }
    if (a.kind === "plot" || a.kind === "pedestal" || a.kind === "islesign") return this.isleUse(S, pl, a, now);
    if (a.kind === "well") return this.say(pl, "You look down the well. Something glints at the bottom, but it's too far down.");
    if (a.ob?.req && G.lvlOf(C, a.ob.req.skill) < a.ob.req.lvl) return this.say(pl, `You need a ${G.SKILLS[a.ob.req.skill].name} level of ${a.ob.req.lvl} to ${(G.VERB[a.kind] || "use").toLowerCase()} the ${a.ob.name}. ${a.ob.tease || ""}`, "bad");
    if (G.EXAMINE[a.kind]) return this.say(pl, pick(G.EXAMINE[a.kind]));
    if (a.kind === "shrine") {
      if (C.hp < G.maxHpOf(C)) { C.hp = G.maxHpOf(C); this.touch(pl); return this.say(pl, "You pray at the shrine. The sandal seems pleased. Your hitpoints are restored.", "good"); }
      return this.say(pl, "You pray at the shrine. The sandal regards you coolly.");
    }
    pl.act = a;   // the rest keep going until done
    const ob = a.ob, group = this.workersOn(S, ob, pl) * 0.01, bonus = group + (S.def.luck || 0), gx = (xp) => Math.round(xp * (1 + group) * (S.def.xpMul || 1));
    if (a.kind === "rock" || a.kind === "vein") {
      const vein = a.kind === "vein";
      if (!this.hasTool(pl, "mining")) { pl.act = null; return; }
      if (ob.emptyUntil > now) { this.say(pl, "There's no ore left in this rock. It'll be back soon."); pl.act = null; return; }
      if (!a.started) { a.started = now; a.next = now + (vein ? 5000 : 1800); pl.swingAt = now; this.say(pl, vein ? "You settle in at the vein. It's slow, but it never runs dry." : "You swing your pickaxe at the rock."); return; }
      if (now - pl.swingAt > 1100) pl.swingAt = now;
      if (now < a.next) return;
      this.groupNote(S, pl, a);
      if (vein) {
        a.next = now + 6000;
        if (Math.random() < 0.55 + bonus) { if (!this.give(pl, ob.ore)) { pl.act = null; return; } this.gained(S, pl, ob.ore); this.grant(pl, "mining", gx(9)); this.questCheck(pl); }
      } else {
        a.next = now + 1800;
        if (Math.random() < Math.min(0.9, 0.4 + G.lvlOf(C, "mining") * 0.02) + bonus) {
          if (!this.give(pl, ob.ore)) { pl.act = null; return; }
          this.gained(S, pl, ob.ore);
          this.grant(pl, "mining", gx(ob.xp || (ob.ore === "tin" ? 18 : 17))); this.say(pl, `You mine some ${G.ITEMS[ob.ore].name.toLowerCase()}.`, "good");
          ob.emptyUntil = now + (ob.special ? 30000 : 8000); this.questCheck(pl); pl.act = null;
        }
      }
      return;
    }
    if (a.kind === "cook") {
      const lv = G.lvlOf(C, "cooking"), raw = C.inv.find((x) => G.COOK[x.k] && lv >= G.COOK[x.k].lvl);
      if (!raw) {
        const tooHard = C.inv.find((x) => G.COOK[x.k]);
        this.say(pl, tooHard ? `You need a Cooking level of ${G.COOK[tooHard.k].lvl} to cook ${G.ITEMS[tooHard.k].name.toLowerCase()}.` : "You have nothing raw to cook.", tooHard ? "bad" : "sys");
        pl.act = null; return;
      }
      if (!a.started) { a.started = now; a.next = now + 1800; pl.swingAt = now; this.say(pl, `You start cooking the ${G.ITEMS[raw.k].name.toLowerCase().replace(/^raw /, "")}.`); return; }
      if (now - pl.swingAt > 900) pl.swingAt = now;
      if (now < a.next) return;
      a.next = now + 1800;
      const r = G.COOK[raw.k];
      if (raw.n > 1 && (G.roomFor(C.inv, r.to) < 1 || G.roomFor(C.inv, "burnt") < 1)) { this.say(pl, "Your inventory is full.", "bad"); pl.act = null; return; }
      raw.n--; if (!raw.n) C.inv.splice(C.inv.indexOf(raw), 1);
      if (Math.random() < G.burnChance(r, lv, ob.t === "range")) { this.give(pl, "burnt"); this.say(pl, "You burn it.", "bad"); }
      else { this.give(pl, r.to); this.gained(S, pl, r.to); this.grant(pl, "cooking", r.xp); }
      this.touch(pl);
      if (!C.inv.some((x) => G.COOK[x.k] && lv >= G.COOK[x.k].lvl)) { this.say(pl, "That's everything cooked."); pl.act = null; }
      return;
    }
    if (a.kind === "tree") {
      if (ob.stumpUntil > now) { this.say(pl, "That tree's been cut down. It'll grow back."); pl.act = null; return; }
      if (!this.hasTool(pl, "woodcutting")) { pl.act = null; return; }
      if (!a.started) { a.started = now; a.next = now + 2000; pl.swingAt = now; this.say(pl, "You swing your axe at the tree."); return; }
      if (now - pl.swingAt > 1000) pl.swingAt = now;
      if (now < a.next) return;
      a.next = now + 2000;
      const oak = ob.t === "oak";
      this.groupNote(S, pl, a);
      if (Math.random() < Math.min(0.9, (oak ? 0.5 : 0.35) + G.lvlOf(C, "woodcutting") * 0.02) + bonus) {
        const log = ob.log || "logs";
        if (!this.give(pl, log)) { pl.act = null; return; }
        this.gained(S, pl, log);
        this.grant(pl, "woodcutting", gx(ob.xp || 25)); this.say(pl, oak ? "You get some logs from the oak." : `You get some ${G.ITEMS[log].name.toLowerCase()}.`, "good"); this.questCheck(pl);
        if (Math.random() < (oak || ob.special ? 0.08 : 0.2)) { ob.stumpUntil = now + 15000; this.say(pl, `The ${oak ? "oak" : "tree"} falls.`); pl.act = null; }
      }
      return;
    }
    if (a.kind === "olive") {
      if (ob.bareUntil > now) { this.say(pl, "You've picked this tree clean. Give it a moment."); pl.act = null; return; }
      if (!a.started) { a.started = now; a.next = now + 1500; this.say(pl, ob.t === "vine" ? "You start picking tomatoes…" : "You start picking olives…"); return; }
      if (now < a.next) return;
      a.next = now + 1500;
      if (!this.give(pl, ob.crop || "olives")) { pl.act = null; return; }
      this.gained(S, pl, ob.crop || "olives");
      this.groupNote(S, pl, a); this.grant(pl, "farming", gx(ob.xp || 6));
      if (--ob.left <= 0) { ob.left = ob.picks || 4; ob.bareUntil = now + 20000; this.say(pl, "That's the last of the olives on this tree."); pl.act = null; }
      return;
    }
    if (a.kind === "wheat") {
      if (ob.grownAt > now) { this.say(pl, "That's already been picked. It'll grow back soon."); pl.act = null; return; }
      if (!a.started) { a.started = now; this.say(pl, "You start picking the wheat…"); return; }
      if (now - a.started >= 1400) { if (this.give(pl, "wheat")) { this.gained(S, pl, "wheat"); this.grant(pl, "farming", 8); this.say(pl, "You pick some wheat.", "good"); ob.grownAt = now + 20000; S.g[ob.y][ob.x] = "f"; this.questCheck(pl); } pl.act = null; }
      return;
    }
    if (a.kind === "spot") {
      if (!this.hasTool(pl, "fishing")) { pl.act = null; return; }
      if (!a.started) { a.started = now; a.next = now + 2600; this.say(pl, "You cast out your line…"); return; }
      if (now < a.next) return;
      a.next = now + 2600;
      const trout = G.lvlOf(C, "fishing") >= 10 && Math.random() < 0.35, fish = ob.fish || (trout ? "trout" : "sardine");
      this.groupNote(S, pl, a);
      if (Math.random() < (ob.fish ? 0.3 : 0.45) + bonus) {
        if (!this.give(pl, fish)) { pl.act = null; return; }
        this.gained(S, pl, fish);
        this.grant(pl, "fishing", gx(ob.xp || (trout ? 50 : 20))); this.say(pl, `You catch a ${G.ITEMS[fish].name.replace(/^Raw /, "").toLowerCase()}.`, "good"); this.questCheck(pl);
      }
    }
  }

  killMob(S, pl, m, now) {
    const def = G.MOBS[m.t];
    m.dead = true; m.respawnAt = now + G.respawnMs(S.def, m.t); pl.act = null;
    const got = [];
    for (const [k, n, chance] of def.drops) {
      if (chance != null && Math.random() >= chance) continue;
      const qty = Array.isArray(n) ? rint(n[0], n[1]) : n;
      if (this.give(pl, k, qty)) got.push([k, qty]);
    }
    this.say(pl, `You defeat the ${def.name.toLowerCase()}.${got.length ? ` It drops ${got.map(([k, n]) => `${n > 1 ? n + " " : ""}${G.ITEMS[k].name.toLowerCase()}`).join(", ")}.` : ""}`, "loot");
    this.questEvent(pl, "kill", m.t);
  }
  // killer: the player who landed the last hit, or { mob: name }
  die(pl, S, killer) {
    const now = Date.now(), C = pl.C, pk = killer?.C ? killer : null;
    pl.act = null; pl.path = [];
    if (pk && pk.act?.id === pl.id) pk.act = null;
    if (S?.def.pvp && G.inCage(S.def, pl.x, pl.y)) {
      C.hp = G.maxHpOf(C); pl.x = S.def.cageOut.x; pl.y = S.def.cageOut.y; pl.step = null; this.placeSafely(S, pl); this.touch(pl);
      if (pk) this.say(pk, `You beat ${pl.name} in the Cage.`, "good");
      return this.say(pl, `${pk ? pk.name : "Someone"} beat you in the Cage. Nothing lost: you're back outside the bars, patched up.`, "bad");
    }
    let lost = null;
    if (S?.def.pvp) {
      const worn = G.SLOTS.filter((s) => C.eq[s]);
      if (worn.length && Math.random() < G.PVP.drop) { const s = pick(worn); lost = C.eq[s]; C.eq[s] = null; this.dropGround(S, lost, 1, pl.x, pl.y, pk ? pk.id : null, now); }
      const nm = lost ? G.ITEMS[lost].name.toLowerCase() : null;
      if (pk) this.say(pk, `You have defeated ${pl.name}.${nm ? ` They dropped their ${nm}. It's yours for the next minute.` : ""}`, "loot");
      this.say(pl, `${pk ? `${pk.name} killed you` : `A ${killer?.mob?.toLowerCase() || "monster"} killed you`} in the Wilderness.${nm ? ` You dropped your ${nm}.` : " You kept everything this time."}`, "bad");
      for (const p of this.pls.values()) if (p !== pl && p !== pk && G.sceneDef(p.C.scene)?.pvp) this.say(p, `☠️ ${pl.name} was killed by ${pk ? pk.name : `a ${killer?.mob?.toLowerCase() || "monster"}`}.`);
    }
    this.say(pl, "Oh dear, you are dead! You wake up at the farmhouse.", "bad");
    C.hp = G.maxHpOf(C);
    this.moveToScene(pl, "farm", null, { x: 4, y: 6 });
  }

  // one swing at another player, in the Wilderness
  pvpSwing(S, pl, a, now, faceIt) {
    const T = this.pls.get(a.id), C = pl.C;
    if (!T || T.C.scene !== S.key || !S.def.pvp) { pl.act = null; return; }
    if (G.cheb(pl, T) !== 1) { const p = G.findPath(S.g, pl, T, 1); if (p && p.length) pl.path = p; else if (!p) pl.act = null; return; }
    const cage = G.inCage(S.def, pl.x, pl.y);
    if (cage !== G.inCage(S.def, T.x, T.y)) { this.say(pl, "The cage bars are in the way."); pl.act = null; return; }
    a.x = T.x; a.y = T.y; faceIt();
    if (!a.started) { a.started = now; pl.lastSwing = now - 1800; }
    if (now - pl.lastSwing < 2400) return;
    pl.lastSwing = now; pl.swingAt = now; pl.combatAt = now; T.combatAt = now;
    const TC = T.C, hit = Math.random() < G.hitChance(G.lvlOf(C, "melee") + 1 + G.bonusOf(C).acc, (G.lvlOf(TC, "melee") + G.bonusOf(TC).def) / 2), dmg = hit ? rint(1, G.maxHitOf(C)) : 0;
    if (!T.god) { TC.hp -= dmg; this.touch(T); }
    if (dmg) T.hurtAt = now;
    S.events.push({ type: "splat", who: `p:${T.id}`, n: dmg, kind: dmg ? "hit" : "miss", t: now });
    // real fights train you; the Cage doesn't
    if (dmg && !cage) { this.grant(pl, "melee", dmg * 4); this.grant(pl, "hp", Math.round(dmg * 1.33), false); }
    // hit back, if they weren't doing anything
    if (!T.act && !T.path.length && !T.step && !T.lingerUntil) T.act = { kind: "pvp", id: pl.id, x: pl.x, y: pl.y, name: pl.name, started: 0 };
    if (TC.hp <= 0) this.die(T, S, pl);
  }

  /* ------------------------------------------------------------ islands */
  async isleOp(S, pl, m) {
    const C = pl.C, I = C.isle, mine = S.owner === pl.id;
    if (m.op === "list") {
      const list = [...this.pls.values()].filter((p) => p !== pl && !p.lingerUntil && p.C.isle.open).map((p) => ({ id: p.id, name: p.name }));
      return pl.out.push({ type: "isles", list });
    }
    if (m.op === "go") {
      if (S.key !== "river" || !this.near(S, pl, "ferry", 3)) return this.say(pl, "You need to be at Charon's ferry, at River Bend.", "bad");
      let id = pl.id, name = pl.name;
      if (m.id != null) { const o = this.pls.get(String(m.id)); if (!o) return this.say(pl, "They aren't around right now. Try their name."); id = o.id; name = o.name; }
      else if (m.name) {
        const who = await this.ctx.storage.get(`who:${String(m.name).replace(/^@/, "").trim().toLowerCase()}`);
        if (!who) return this.say(pl, `Charon has never heard of anyone called ${String(m.name).slice(0, 25)}.`);
        id = who.id; name = who.name;
      }
      if (pl.left || pl.C.scene !== "river") return;
      const owner = this.pls.get(id);
      let copy = null;
      if (id !== pl.id && !owner) copy = G.normChar(await this.ctx.storage.get(`char:${id}`)).isle;
      if (pl.left || pl.C.scene !== "river") return;
      const isle = owner ? owner.C.isle : copy || I, key = G.isleKey(isle, id);
      if (id !== pl.id && !isle.open) return this.say(pl, `${name}'s island is closed to visitors.`);
      const S2 = this.scene(key); S2.ownerName = name; if (copy) S2.isleCopy = copy;
      this.moveToScene(pl, key, null, G.SCENES.isle.entry); pl.dir = "north";
      return this.say(pl, id === pl.id ? "Charon rows you out to your island." : `Charon rows you out to ${name}'s island.`, "good");
    }
    if (m.op === "upgrade") {
      const next = G.ISLE_TIERS[I.tier + 1];
      if (S.key !== "river" || !this.near(S, pl, "ferry", 3) || !next) return;
      const cash = C.inv.find((x) => x.k === "coins");
      if (!cash || cash.n < next.price) return this.say(pl, `${next.name} costs ${G.fmtCash(next.price)}.`, "bad");
      cash.n -= next.price; if (!cash.n) C.inv.splice(C.inv.indexOf(cash), 1);
      const oldKey = G.isleKey(I, pl.id); I.tier++; this.touch(pl);
      const newKey = G.isleKey(I, pl.id);
      for (const p of this.pls.values()) if (p.C.scene === oldKey) { this.moveToScene(p, newKey, null, G.SCENES.isle.entry); this.say(p, "The island grows around you. Somebody paid for an upgrade."); }
      return this.say(pl, `Your island is now: ${next.name}. ${next.ex}`, "good");
    }
    if (m.op === "buy") {
      const th = G.THEMES[m.theme];
      if (S.key !== "river" || !this.near(S, pl, "ferry", 3) || !th || th.price == null || I.themes.includes(m.theme)) return;
      const cash = C.inv.find((x) => x.k === "coins");
      if (!cash || cash.n < th.price) return this.say(pl, `The ${th.name} theme costs ${G.fmtCash(th.price)}.`, "bad");
      cash.n -= th.price; if (!cash.n) C.inv.splice(C.inv.indexOf(cash), 1);
      I.themes.push(m.theme); this.touch(pl);
      return this.say(pl, `You bought the ${th.name} island theme. Change it at the sign on your island.`, "good");
    }
    if (!mine) return;
    const within = (t, i) => S.objs.some((o) => o.t === t && o.i === i && G.cheb(pl, o) <= 1);
    if (m.op === "theme") { if (!I.themes.includes(m.theme)) return; I.theme = m.theme; this.touch(pl); return this.say(pl, `Your island is now ${G.THEMES[m.theme].name}.`, "good"); }
    if (m.op === "open") {
      I.open = !!m.v; this.touch(pl);
      if (!I.open) for (const p of [...this.pls.values()]) if (p !== pl && G.ownerOf(p.C.scene) === pl.id) { this.moveToScene(p, "river", null, G.ISLE_FERRY); this.say(p, `${pl.name} closed their island. Charon rows you back.`); }
      return this.say(pl, I.open ? "Your island is open: anyone can visit." : "Your island is closed to visitors.", "good");
    }
    if (m.op === "plant") {
      const i = m.i | 0, k = String(m.k), crop = G.CROPS[k];
      if (!crop || I.plots[i] !== null || !within("plot", i)) return;
      if (G.lvlOf(C, "farming") < crop.lvl) return this.say(pl, `You need a Harvesting level of ${crop.lvl} to grow ${G.ITEMS[k].name.toLowerCase()}.`, "bad");
      const st = C.inv.find((x) => x.k === k); if (!st) return;
      st.n--; if (!st.n) C.inv.splice(C.inv.indexOf(st), 1);
      I.plots[i] = { k, at: Date.now() }; this.touch(pl);
      return this.say(pl, `You plant some ${G.ITEMS[k].name.toLowerCase()}. It'll be ready in ${Math.round(crop.ms / 60000)} minutes, whether you're here or not.`, "good");
    }
    if (m.op === "show") {
      const i = m.i | 0, st = C.inv[m.s | 0];
      if (!st || st.k === "coins" || I.shelf[i] !== null || !within("pedestal", i)) return;
      st.n--; if (!st.n) C.inv.splice(C.inv.indexOf(st), 1);
      I.shelf[i] = st.k; this.touch(pl);
      return this.say(pl, `You put your ${G.ITEMS[st.k].name.toLowerCase()} on display.`, "good");
    }
  }
  isleUse(S, pl, a, now) {
    const I = this.isleOf(S); if (!I) return;
    const mine = S.owner === pl.id, whose = mine ? "Your" : `${S.ownerName || "Their"}'s`, ob = a.ob;
    if (a.kind === "islesign") return mine ? pl.out.push({ type: "islesign", themes: I.themes, theme: I.theme, open: I.open }) : this.say(pl, `"${S.ownerName || "Someone"}'s island. Visitors welcome. Please don't lick the pedestals."`);
    if (a.kind === "pedestal") {
      const k = I.shelf[ob.i];
      if (!mine) return this.say(pl, k ? `On display: ${G.ITEMS[k].name}. ${G.ITEMS[k].ex || ""}` : "An empty pedestal.");
      if (!k) return pl.out.push({ type: "display", i: ob.i });
      if (!this.give(pl, k)) return;
      I.shelf[ob.i] = null; this.touch(pl);
      return this.say(pl, `You take your ${G.ITEMS[k].name.toLowerCase()} off display.`);
    }
    const p = I.plots[ob.i];
    if (!p) return mine ? pl.out.push({ type: "plant", i: ob.i }) : this.say(pl, "An empty plot.");
    const crop = G.CROPS[p.k], left = p.at + crop.ms - now, nm = G.ITEMS[p.k].name.toLowerCase();
    if (!mine) return this.say(pl, `${whose} ${nm} ${left > 0 ? "is growing" : "looks ready to pick"}.`);
    if (left > 0) return this.say(pl, `Your ${nm} will be ready in ${left > 90000 ? `about ${Math.round(left / 60000)} minutes` : `${Math.ceil(left / 1000)} seconds`}.`);
    const n = rint(crop.yield[0], crop.yield[1]);
    if (!this.give(pl, p.k, n)) return;
    I.plots[ob.i] = null; this.touch(pl);
    this.gained(S, pl, p.k, n); this.grant(pl, "farming", crop.xp);
    this.say(pl, `You harvest ${n} ${nm}.`, "good");
  }

  mobsTick(S, now) {
    const players = this.playersIn(S);
    for (const m of S.mobs) {
      if (m.dead) {
        if (now < m.respawnAt) continue;
        // back at home, or the nearest free tile to it: never on top of someone
        let spot = null;
        for (let r = 0; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
          const x = m.hx + dx, y = m.hy + dy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && G.walkableIn(S.g, x, y) && S.g[y][x] !== "e" && !this.occupied(S, x, y, m)) spot = { x, y };
        }
        if (!spot) { m.respawnAt = now + 1000; continue; }
        Object.assign(m, { dead: false, hp: G.MOBS[m.t].hp, x: spot.x, y: spot.y, path: [], step: null });
        continue;
      }
      const def = G.MOBS[m.t];
      let foe = players.find((p) => p.act?.kind === "mob" && p.act.id === m.id && G.cheb(p, m) === 1 && !p.step);
      if (!foe && def.aggro) {
        const ok = (p) => p.C.scene === S.key && !G.inCage(S.def, p.x, p.y) && G.cheb(p, { x: m.hx, y: m.hy }) <= def.aggro + 5;
        let tgt = m.target ? players.find((p) => p.id === m.target) : null;
        if (!tgt || !ok(tgt)) { tgt = players.filter((p) => ok(p) && G.cheb(p, m) <= def.aggro).sort((a, b) => G.cheb(a, m) - G.cheb(b, m))[0] || null; m.target = tgt ? tgt.id : null; }
        if (tgt) {
          if (G.cheb(tgt, m) === 1 && !tgt.step) foe = tgt;
          else { if (!m.step && now > (m.nextChase || 0)) { m.nextChase = now + 500; m.path = G.findPath(S.g, m, tgt, 1) || []; } this.stepEntity(S, m, now, false); continue; }
        } else if (G.cheb(m, { x: m.hx, y: m.hy }) > 4 && !m.step && !m.path.length) m.path = G.findPath(S.g, m, { x: m.hx, y: m.hy }, 0)?.slice(0, 6) || [];
      }
      if (foe) {
        m.face = foe.x > m.x ? 1 : -1;
        if (now - m.lastSwing >= G.MOBS[m.t].speed) {
          m.lastSwing = now; m.swingAt = now;
          const C = foe.C, hit = Math.random() < G.hitChance(G.MOBS[m.t].att, (G.lvlOf(C, "melee") + G.bonusOf(C).def) / 2), dmg = hit ? rint(1, G.MOBS[m.t].max) : 0;
          if (!foe.god) { C.hp -= dmg; this.touch(foe); }
          if (dmg) foe.hurtAt = now;
          foe.combatAt = now;
          S.events.push({ type: "splat", who: `p:${foe.id}`, n: dmg, kind: dmg ? "hit" : "miss", t: now });
          if (!foe.act && !foe.path.length && !foe.lingerUntil) foe.act = { kind: "mob", id: m.id, x: m.x, y: m.y, name: def.name, started: 0 };
          if (C.hp <= 0) this.die(foe, S, { mob: def.name });
        }
        continue;
      }
      if (!this.stepEntity(S, m, now, false) && now > m.nextWander) {
        m.nextWander = now + 2000 + Math.random() * 4000;
        const [dx, dy] = pick(G.D8), x = m.x + dx, y = m.y + dy;
        if (Math.abs(x - m.hx) <= 3 && Math.abs(y - m.hy) <= 2 && G.canStepIn(S.g, m.x, m.y, dx, dy) && S.g[y][x] !== "e" && !this.occupied(S, x, y, m)) m.path = [{ x, y }];
      }
    }
    // the simulated players: go and work something for a while, or wander
    for (const b of S.bots) {
      if (b.goal && !b.step && !b.path.length) {
        const gl = b.goal, r = G.cheb(b, gl);
        if (r >= 1 && r <= (gl.ob.t === "spot" ? 2 : 1)) { b.working = { ob: gl.ob, until: now + 15000 + Math.random() * 25000 }; b.face = gl.x > b.x ? 1 : -1; b.dir = G.DIRS[`${Math.sign(gl.x - b.x)},${Math.sign(gl.y - b.y)}`] || b.dir; }
        b.goal = null;
      }
      if (b.working && (now > b.working.until || b.path.length)) b.working = null;
    }
    for (const n of [...S.npcs, ...S.bots]) {
      if (n.working || n.holdUntil > now || n.still) continue;   // "still" NPCs keep to their spot
      if (!this.stepEntity(S, n, now, false) && now > n.nextWander) {
        n.nextWander = now + (n.level ? 1500 : 4000) + Math.random() * 5000;
        if (n.level && Math.random() < 0.45) {
          const jobs = S.objs.filter((o) => ["tree", "oak", "cypress", "rock", "vein", "spot", "olive", "vine"].includes(o.t) && !o.special && !(o.stumpUntil > now) && !(o.emptyUntil > now));
          const ob = jobs.length && pick(jobs), at = ob && G.nearestCell(ob, n), p = ob && G.findPath(S.g, n, at, ob.t === "spot" ? 2 : 1);
          if (p) { n.path = p; n.goal = { ob, x: at.x, y: at.y }; }
        } else if (n.level) { const tx = rint(2, G.COLS - 3), ty = rint(2, G.ROWS - 3); if (G.walkableIn(S.g, tx, ty)) { const p = G.findPath(S.g, n, { x: tx, y: ty }, 0); if (p) n.path = p.slice(0, 8); } }
        else { const [dx, dy] = pick(G.D8); if (Math.abs(n.x + dx - n.hx) <= 1 && Math.abs(n.y + dy - n.hy) <= 1 && G.canStepIn(S.g, n.x, n.y, dx, dy)) n.path = [{ x: n.x + dx, y: n.y + dy }]; }
      }
    }
  }

  /* ------------------------------------------------------------ telling everyone */
  snapOf(S, now, withEvents = true) {
    const st = (e) => (e.step ? [e.step.fx, e.step.fy, e.step.tx, e.step.ty, e.step.t0, e.step.ms] : 0);
    const out = {
      type: "snap", t: now, scene: S.key, online: this.pls.size,
      players: this.playersIn(S).map((p) => ({ id: p.id, name: p.name, lvl: G.totalOf(p.C), x: p.x, y: p.y, s: st(p), dir: p.dir, face: p.face, hurtAt: p.hurtAt, swingAt: p.swingAt, act: p.act?.kind || null, started: !!p.act?.started, ob: p.act?.ob ? p.act.ob.id : null, mob: p.act?.kind === "mob" ? p.act.id : null, weapon: p.C.eq.weapon, body: p.C.eq.body, hp: p.C.hp, maxHp: G.maxHpOf(p.C), moving: !!(p.step || p.path.length) })),
      mobs: S.mobs.map((m) => ({ id: m.id, t: m.t, x: m.x, y: m.y, s: st(m), face: m.face, hp: m.hp, dead: m.dead, hurtAt: m.hurtAt, swingAt: m.swingAt })),
      npcs: S.npcs.map((n) => ({ id: n.id, x: n.x, y: n.y, s: st(n), face: n.face, held: n.holdUntil > now })),
      bots: S.bots.map((b) => ({ id: b.id, name: b.name, level: b.level, art: b.art, x: b.x, y: b.y, s: st(b), dir: b.dir, face: b.face, hue: b.hue, work: b.working ? b.working.ob.id : null, workT: b.working ? b.working.ob.t : null })),
      ground: S.ground.map((x) => ({ id: x.id, k: x.k, n: x.n, x: x.x, y: x.y, owner: x.owner, until: x.until })),
      isle: S.owner ? (() => { const I = this.isleOf(S); return I && { owner: S.owner, name: S.ownerName || this.pls.get(S.owner)?.name || "Someone", plots: I.plots, shelf: I.shelf, theme: I.theme, open: I.open }; })() : null,
      dyn: S.objs.filter((o) => o.stumpUntil > now || o.emptyUntil > now || o.bareUntil > now || o.grownAt > now).map((o) => [o.id, o.stumpUntil || 0, o.emptyUntil || 0, o.bareUntil || 0, o.grownAt || 0]),
      ev: withEvents ? S.events : []
    };
    return JSON.stringify(out);
  }
  broadcast(now) {
    const snaps = new Map();
    for (const [key, S] of this.scenes) {
      const players = this.playersIn(S); if (!players.length) { S.events = []; continue; }
      snaps.set(key, this.snapOf(S, now));
      S.events = [];
    }
    for (const pl of this.pls.values()) { const s = snaps.get(pl.C.scene); if (s) this.send(pl, s); }
    this.sendPrivate();
  }
  sendPrivate() {
    for (const pl of this.pls.values()) {
      if (pl.dirty) { pl.dirty = false; this.send(pl, { type: "me", me: this.meOf(pl) }); }
      if (pl.out.length) { this.send(pl, { type: "ev", list: pl.out }); pl.out = []; }
    }
  }

  /* ------------------------------------------------------------ the bank: any booth inside the Bank */
  near(S, pl, type, r = 2) { return S.objs.some((o) => o.t === type && G.cheb(pl, G.nearestCell(o, pl)) <= r); }
  bankAdd(pl, k, n) {
    const C = pl.C, s = C.bank.find((x) => x.k === k);
    if (s) { s.n += n; return true; }
    if (C.bank.length >= G.BANK_MAX) { this.say(pl, `Your bank is full (${G.BANK_MAX} different items).`, "bad"); return false; }
    C.bank.push({ k, n }); return true;
  }
  bankOp(S, pl, m) {
    if (!this.near(S, pl, "booth")) return this.say(pl, "You need to be at a bank booth.", "bad");
    const C = pl.C, qty = (want, have) => Math.max(1, Math.min(have, want === "all" ? have : Math.floor(Number(want)) || 1));
    if (m.op === "dep") { const st = C.inv[m.i | 0]; if (!st) return; const k = st.k, q = qty(m.n, G.countItems(C, [k])); if (!this.bankAdd(pl, k, q)) return; G.takeInv(C.inv, k, q); }
    else if (m.op === "depinv") { for (const st of [...C.inv]) { if (!this.bankAdd(pl, st.k, st.n)) break; C.inv.splice(C.inv.indexOf(st), 1); } }
    else if (m.op === "depeq") { for (const sl of G.SLOTS) { const k = C.eq[sl]; if (k && this.bankAdd(pl, k, 1)) C.eq[sl] = null; } }
    else if (m.op === "wd") { const st = C.bank[m.i | 0]; if (!st) return; const q = this.giveUpTo(pl, st.k, qty(m.n, st.n)); if (!q) return; st.n -= q; if (!st.n) C.bank.splice(C.bank.indexOf(st), 1); }
    else return;
    this.touch(pl);
  }

  /* ------------------------------------------------------------ the Exchange: the stall in the Forum
     Offers keep working while their owner is away; what they earn waits in the offer's box until collected.
     Anything that moves items or Cash between a character and the Exchange saves both in one write. */
  async exCommit(...pls) {
    const put = { exchange: this.ex };
    for (const p of pls) { p.C.x = p.x; p.C.y = p.y; put[`char:${p.id}`] = p.C; p.needSave = false; p.changedAt = null; }
    await this.ctx.storage.put(put);
  }
  exMine(pl) { return this.ex.orders.filter((o) => o.owner === pl.id); }
  exSend(pl) { this.send(pl, { type: "exch", mine: this.exMine(pl), book: G.exSummary(this.ex.orders), last: this.ex.last }); }
  exOp(S, pl, m) {
    const C = pl.C, now = Date.now();
    if (!this.near(S, pl, "stall")) return this.say(pl, "You need to be at the Exchange stall in the Forum.", "bad");
    if (m.op === "open") return this.exSend(pl);
    if (m.op === "place") {
      const side = m.side === "buy" ? "buy" : "sell", k = String(m.k), qty = Math.floor(Number(m.qty)), price = Math.floor(Number(m.price));
      if (!G.ITEMS[k] || k === "coins") return this.say(pl, "You can't trade that on the Exchange.", "bad");
      if (!(qty >= 1 && qty <= 1e9 && price >= 1 && price <= 1e9)) return this.say(pl, "Pick a quantity and a price of at least 1.", "bad");
      if (this.exMine(pl).length >= G.EX_SLOTS) return this.say(pl, `You can have ${G.EX_SLOTS} offers at once. Collect or cancel one first.`, "bad");
      if (side === "sell") {
        const have = G.countItems(C, [k]); if (have < qty) return this.say(pl, `You only have ${have} ${G.ITEMS[k].name.toLowerCase()}.`, "bad");
        let left = qty; for (const st of C.inv.filter((x) => x.k === k)) { const t = Math.min(left, st.n); st.n -= t; left -= t; if (!st.n) C.inv.splice(C.inv.indexOf(st), 1); if (!left) break; }
      } else {
        const cost = qty * price; if (G.cashIn(C) < cost) return this.say(pl, `That needs ${G.fmtCash(cost)}. You have ${G.fmtCash(G.cashIn(C))}.`, "bad");
        const st = C.inv.find((x) => x.k === "coins"); st.n -= cost; if (!st.n) C.inv.splice(C.inv.indexOf(st), 1);
      }
      const o = { id: this.ex.next++, owner: pl.id, name: pl.name, side, k, qty, done: 0, price, at: now, open: true, box: { items: 0, cash: 0 } };
      this.ex.orders.push(o);
      this.say(pl, `Offer placed: ${side === "sell" ? "selling" : "buying"} ${qty.toLocaleString()} × ${G.ITEMS[k].name} at ${G.fmtCash(price)} each.`, "good");
      const touched = this.exMatch(o);
      this.touch(pl); this.exCommit(pl, ...touched.filter((p) => p !== pl));
      this.exSend(pl); for (const p of touched) if (p !== pl) this.exSend(p);
      return;
    }
    const o = this.ex.orders.find((x) => x.id === (m.id | 0) && x.owner === pl.id); if (!o) return;
    if (m.op === "cancel" && o.open) {
      o.open = false;
      const left = o.qty - o.done;
      if (o.side === "sell") o.box.items += left; else o.box.cash += left * o.price;
      this.say(pl, "Offer cancelled. What's left is waiting to be collected.");
    }
    if (m.op === "collect" || m.op === "cancel") {
      if (o.box.items) o.box.items -= this.giveUpTo(pl, o.k, o.box.items);
      if (o.box.cash && this.give(pl, "coins", o.box.cash)) o.box.cash = 0;
      // a finished offer with nothing left in its box is done with
      if (!o.open && !o.box.items && !o.box.cash) this.ex.orders.splice(this.ex.orders.indexOf(o), 1);
      this.touch(pl); this.exCommit(pl); this.exSend(pl);
    }
  }
  // fill a new offer against the other side: best price first, then whoever was there first, at the waiting offer's price
  exMatch(o) {
    const touched = new Set();
    const other = this.ex.orders.filter((x) => x.open && x !== o && x.k === o.k && x.side !== o.side && x.done < x.qty && x.owner !== o.owner && (o.side === "buy" ? x.price <= o.price : x.price >= o.price))
      .sort((a, b) => (o.side === "buy" ? a.price - b.price : b.price - a.price) || a.at - b.at);
    for (const x of other) {
      const q = Math.min(o.qty - o.done, x.qty - x.done); if (q <= 0) break;
      const price = x.price, sell = o.side === "sell" ? o : x, buy = o.side === "buy" ? o : x, gross = q * price, tax = G.exTax(gross);
      sell.done += q; buy.done += q;
      buy.box.items += q;
      sell.box.cash += gross - tax;
      if (buy.price > price) buy.box.cash += (buy.price - price) * q;   // bid more than it cost: the difference comes back
      this.ex.last[o.k] = { price, at: Date.now() }; this.ex.tax += tax;
      for (const side of [sell, buy]) {
        if (side.done >= side.qty) side.open = false;
        const p = this.pls.get(side.owner);
        if (p) { touched.add(p); this.say(p, `Exchange: ${side.side === "sell" ? "sold" : "bought"} ${q.toLocaleString()} × ${G.ITEMS[o.k].name} at ${G.fmtCash(price)} each. Collect it at the stall.`, "loot"); }
      }
      if (o.done >= o.qty) break;
    }
    return [...touched];
  }

  /* ------------------------------------------------------------ trading face to face
     Both players put up items and Cash, both accept, then both confirm on a second screen. Nothing moves until the
     final confirm, and then it all moves at once and both characters are saved together. */
  tradeView(T, forId) {
    const other = forId === T.a ? T.b : T.a;
    return { type: "trade", id: T.id, stage: T.stage, you: T.off[forId], them: T.off[other], themName: this.pls.get(other)?.name || "?", ok: { you: !!T.ok[forId], them: !!T.ok[other] } };
  }
  tradeSync(T) { for (const id of [T.a, T.b]) { const p = this.pls.get(id); if (p) this.send(p, this.tradeView(T, id)); } }
  tradeEnd(T, why) {
    this.trades.delete(T.id);
    for (const id of [T.a, T.b]) { const p = this.pls.get(id); if (p) { p.trade = null; this.send(p, { type: "trade", closed: true }); if (why) this.say(p, why); } }
  }
  tradeOp(S, pl, m) {
    const now = Date.now();
    if (m.op === "req") {
      const o = this.pls.get(String(m.to));
      if (!o || o === pl || o.C.scene !== pl.C.scene) return this.say(pl, "They're not here.", "bad");
      if (G.cheb(pl, o) > G.TRADE_RANGE) return this.say(pl, `Get a bit closer to ${o.name} to trade.`, "bad");
      if (pl.trade || o.trade) return this.say(pl, pl.trade ? "You're already trading." : `${o.name} is busy trading.`, "bad");
      // they asked us first: that's a yes
      if (o.tradeReq?.to === pl.id && now - o.tradeReq.at < 30000) {
        o.tradeReq = null; pl.tradeReq = null;
        const T = { id: `t${now}${Math.random().toString(36).slice(2, 6)}`, a: o.id, b: pl.id, stage: "offer", ok: {}, off: { [o.id]: { items: {}, cash: 0 }, [pl.id]: { items: {}, cash: 0 } } };
        this.trades.set(T.id, T); o.trade = T; pl.trade = T; this.tradeSync(T); return;
      }
      pl.tradeReq = { to: o.id, at: now };
      o.out.push({ type: "tradereq", from: pl.id, name: pl.name });
      return this.say(pl, `You ask ${o.name} to trade…`);
    }
    const T = pl.trade; if (!T) return;
    const mine = T.off[pl.id], C = pl.C;
    if (m.op === "decline") return this.tradeEnd(T, `${pl.name} declined the trade.`);
    if (T.stage === "offer" && (m.op === "add" || m.op === "remove" || m.op === "cash")) {
      if (m.op === "add") { const k = String(m.k); if (!G.ITEMS[k] || k === "coins") return; const have = G.countItems(C, [k]) - (mine.items[k] || 0); const n = Math.max(0, Math.min(have, m.n === "all" ? have : Math.floor(Number(m.n)) || 1)); if (n) mine.items[k] = (mine.items[k] || 0) + n; }
      if (m.op === "remove") delete mine.items[String(m.k)];
      if (m.op === "cash") mine.cash = Math.max(0, Math.min(G.cashIn(C), Math.floor(Number(m.n)) || 0));
      T.ok = {}; return this.tradeSync(T);   // any change means both have to accept again
    }
    if (m.op === "accept") {
      T.ok[pl.id] = true;
      if (!(T.ok[T.a] && T.ok[T.b])) return this.tradeSync(T);
      if (T.stage === "offer") { T.stage = "confirm"; T.ok = {}; return this.tradeSync(T); }
      return this.tradeFinish(T);
    }
  }
  tradeFinish(T) {
    const A = this.pls.get(T.a), B = this.pls.get(T.b); if (!A || !B) return this.tradeEnd(T, "Trade cancelled.");
    // everything offered must still be there, and both bags must have room for what's coming
    const still = (p) => Object.entries(T.off[p.id].items).every(([k, n]) => G.countItems(p.C, [k]) >= n) && G.cashIn(p.C) >= T.off[p.id].cash;
    if (!still(A) || !still(B)) return this.tradeEnd(T, "Trade cancelled: something offered wasn't there any more.");
    const after = (p, give, get) => {
      const inv = p.C.inv.map((s) => ({ k: s.k, n: s.n }));
      for (const [k, n] of Object.entries(give.items)) G.takeInv(inv, k, n);
      if (give.cash) G.takeInv(inv, "coins", give.cash);
      let over = 0;
      for (const [k, n] of Object.entries(get.items)) over += G.addInv(inv, k, n);
      if (get.cash) over += G.addInv(inv, "coins", get.cash);
      return over ? null : inv;
    };
    const newA = after(A, T.off[A.id], T.off[B.id]), newB = after(B, T.off[B.id], T.off[A.id]);
    if (!newA || !newB) return this.tradeEnd(T, "Trade cancelled: not enough room in someone's bag.");
    const apply = (p, inv) => { p.C.inv = inv; this.touch(p); };
    apply(A, newA); apply(B, newB);
    this.exCommit(A, B);
    this.tradeEnd(T, null);
    this.say(A, `Trade with ${B.name} complete.`, "good"); this.say(B, `Trade with ${A.name} complete.`, "good");
  }

  /* ------------------------------------------------------------ admin: only for the logins the site says are admins */
  admin(S, pl, m) {
    const C = pl.C, note = (t) => this.say(pl, `[admin] ${t}`, "admin");
    const skill = G.SKILLS[m.skill] ? m.skill : null;
    switch (m.cmd) {
      case "xp": { const n = Math.trunc(Number(m.n) || 0); if (!skill || !n) return; this.grant(pl, skill, n); return note(`${n > 0 ? "+" : ""}${n.toLocaleString()} ${G.SKILLS[skill].name} xp.`); }
      case "setlvl": { const l = Math.max(1, Math.min(99, m.lvl | 0)); if (!skill) return; C.xp[skill] = G.XP_AT[l]; if (skill === "hp") C.hp = G.maxHpOf(C); C.hp = Math.min(C.hp, G.maxHpOf(C)); this.touch(pl); return note(`${G.SKILLS[skill].name} set to ${l}.`); }
      case "clearxp": {
        const f = G.freshChar().xp;
        if (m.skill === "all") { C.xp = { ...f }; C.hp = Math.min(C.hp, G.maxHpOf(C)); this.touch(pl); return note("All xp cleared."); }
        if (!skill) return; C.xp[skill] = f[skill]; C.hp = Math.min(C.hp, G.maxHpOf(C)); this.touch(pl); return note(`${G.SKILLS[skill].name} xp cleared.`);
      }
      case "item": { const k = String(m.k), n = Math.max(1, Math.min(1000000, m.n | 0)); if (!G.ITEMS[k]) return; const got = this.giveUpTo(pl, k, n); if (got) note(`Gave ${got.toLocaleString()} × ${G.ITEMS[k].name}.`); return; }
      case "clearinv": C.inv = []; this.touch(pl); return note("Inventory cleared.");
      case "heal": C.hp = G.maxHpOf(C); this.touch(pl); return note("Healed.");
      case "god": pl.god = !pl.god; this.touch(pl); return note(pl.god ? "God mode on: nothing can hurt you." : "God mode off.");
      case "tp": { const key = String(m.scene); if (!G.SCENES[key]) return; this.moveToScene(pl, key, null, Number.isInteger(m.x) && Number.isInteger(m.y) ? { x: m.x, y: m.y } : null); return note(`Teleported to ${G.SCENES[key].name}.`); }
      case "quest": { const k = String(m.k), state = String(m.state); if (!G.QUESTS[k] || !["new", "active", "done"].includes(state)) return; if (state === "new") delete C.qs[k]; else C.qs[k] = { state, n: 0 }; this.touch(pl); return note(`${G.QUESTS[k].name} set to ${state}.`); }
      case "resetquests": C.qs = {}; this.touch(pl); return note("All quests reset.");
      case "resetscene": { this.scenes.delete(S.key); const S2 = this.scene(S.key); this.placeSafely(S2, pl); return note(`${S.def.name} reset: monsters, trees, rocks and bots are back.`); }
      case "reset": { const settings = C.settings; pl.C = G.freshChar(); pl.C.settings = settings; pl.x = pl.C.x; pl.y = pl.C.y; this.moveToScene(pl, pl.C.scene, null, { x: pl.x, y: pl.y }); this.touch(pl); return note("Character reset to a brand-new one."); }
      case "save": pl.needSave = true; this.persist(pl); return note("Saved.");
      // try a speed bonus without any gear (this session only; it isn't saved)
      case "speed": { pl.speedTest = Math.max(0, Math.min(200, Math.trunc(Number(m.n)) || 0)); this.touch(pl); return note(`Speed test: +${pl.speedTest}% raw, which gives +${G.speedBonus(C, pl.speedTest)}% (${G.stepMsOf(C, pl.speedTest)}ms a tile).`); }
    }
  }
}
