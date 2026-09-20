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

const TICK_MS = 50;
const CLAIM_MS = 10000;       // a claimed monster is freed 10s after its claimer's last swing          // the world steps twenty times a second, so actions start the moment you arrive
const SNAP_EVERY = 2;        // the world's state goes out ten times a second; your own news (xp, messages, dialogue) every tick
const SAVE_MS = 4000;        // a changed character is written at most this long after the change
const STEP = 240;            // one tile of walking
const SCENE_IDLE_MS = 120000;
// a planned restart: when each warning is given, and how long the client is told to wait
const RESTART_WARN_S = [600, 300, 120, 60, 30, 10];
const RESTART_HOLD_MS = 25000;   // how long the client waits before trying again, so it reconnects AFTER the deploy
const METRIC_TICKS = 1200;       // a minute of tick times, kept in memory only   // how long the page waits before trying again, so it reconnects AFTER the deploy
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const CASINO_LINES = ["one more spin", "im due", "LETS GOOO", "two cherries again lol", "who took my machine", "this one's hot i can feel it", "down bad. back to the workyard", "heads never fails", "brb selling logs", "jackpot's getting big", "gg house", "roll under 5 u cowards", "never lucky", "ok last one for real"];
const PIT_LINES = ["HIT HIM", "my rent is on the chicken", "fixed. it's all fixed", "that cow has HANDS", "who let the goose in", "never bet against the olive", "ref??? REF???", "i've seen this one before. he folds", "put it all on the little guy", "one more fight then i'm going home", "that's a dive if i ever saw one"];
const BOT_LINES = ["anyone know where the good fishing is?", "gz", "cows are free xp lol", "selling feathers", "this farm is peaceful", "wheat run anyone?", "brb", "that yew is taunting me", "who keeps feeding the olives"];
const G_FAME_MIN = 500;   // a single win of this much goes on the Winners' Wall
const EXAMINE_KINDS = new Set(["hive", "notice", "sign", "statue", "fountain", "fire", "bush", "boulder", "hay", "counter", "pool", "column", "range", "table", "barrel", "bed", "plant", "bench", "goatstatue", "chest", "rug", "chair", "sack", "cat", "bucket", "bigtomato", "press", "crate", "scarecrow", "milestone", "toll", "barricade", "chariot", "mule"]);

// constant-time compare, so a wrong key cannot be guessed a character at a time
function keyOk(request, env) {
  const want = String(env.ESCAPE_KEY || "").trim(), got = String(request.headers.get("X-Escape-Key") || "").trim();
  if (!want || !got || want.length !== got.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return new Response("ok", { headers: { "Cache-Control": "no-store" } });
    // which Cloudflare data centre the world runs in, and how long the hop from this edge to it takes
    if (url.pathname === "/where") {
      const t0 = Date.now(), r = await env.WORLD.get(env.WORLD.idFromName("world")).fetch("https://world/where"), j = await r.json();
      return Response.json({ edge: request.cf?.colo, world: j.colo, hopMs: Date.now() - t0, players: j.players }, { headers: { "Cache-Control": "no-store" } });
    }
    // Announce a restart before deploying:
    //   curl -X POST -H "X-Escape-Key: $KEY" "https://<worker>/restart?in=120"
    //   curl -X POST -H "X-Escape-Key: $KEY" "https://<worker>/restart?cancel=1"
    // A deploy drops every connection whatever happens; this is what gives
    // people warning first and gets every character written before it does.
    if (url.pathname === "/restart") {
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      if (!keyOk(request, env)) return new Response("Forbidden", { status: 403 });
      const body = url.searchParams.get("cancel") ? { cancel: true } : { in: Math.max(0, Math.min(3600, Number(url.searchParams.get("in")) || 120)) };
      return env.WORLD.get(env.WORLD.idFromName("world")).fetch("https://world/restart", { method: "POST", body: JSON.stringify(body) });
    }
    // The nightly backup pulls from here; the site's /api/eastscape/backup is
    // what gzips it and puts it in R2, so there is ONE bucket, one prune rule
    // and one dashboard card for the whole of EastCoin.
    // How the world is doing. No key: it carries no player data, and the site's
    // dashboard is not the only thing that should be able to ask.
    // Hiscores. Public, no key — it is the same levels everybody can already see
    // over each other's heads, and bragging rights only work in public.
    if (url.pathname === "/hiscores") {
      const r = await env.WORLD.get(env.WORLD.idFromName("world")).fetch("https://world/hiscores");
      return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", "Cache-Control": "public, max-age=30" } });
    }
    if (url.pathname === "/stats") {
      const r = await env.WORLD.get(env.WORLD.idFromName("world")).fetch("https://world/stats");
      return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/export") {
      if (!keyOk(request, env)) return new Response("Forbidden", { status: 403 });
      return env.WORLD.get(env.WORLD.idFromName("world")).fetch("https://world/export", { method: "POST" });
    }
    // Kick one player off now (the site's ban endpoint calls this, so a ban lands mid-session too).
    //   curl -X POST -H "X-Escape-Key: $KEY" "https://<worker>/kick?id=<twitch id>"
    if (url.pathname === "/kick") {
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      if (!keyOk(request, env)) return new Response("Forbidden", { status: 403 });
      const id = String(url.searchParams.get("id") || ""); if (!id) return new Response("No id", { status: 400 });
      return env.WORLD.get(env.WORLD.idFromName("world")).fetch(`https://world/kick?id=${encodeURIComponent(id)}`, { method: "POST" });
    }
    // Restore. Dry by default; see the DO handler for why it refuses while anyone is on.
    if (url.pathname === "/restore") {
      if (request.method !== "POST") return new Response("POST only", { status: 405 });
      if (!keyOk(request, env)) return new Response("Forbidden", { status: 403 });
      return env.WORLD.get(env.WORLD.idFromName("world")).fetch(new Request(`https://world/restore${url.search}`, { method: "POST", body: request.body, headers: { "content-type": "application/json" } }));
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
    // what the last minute looked like: enough to answer "is it the server or is it me"
    this.startedAt = Date.now();
    this.tickMs = [];           // rolling tick durations
    this.msgsIn = 0; this.bytesOut = 0; this.sentOut = 0; this.peak = 0;
    // the Exchange: every offer from every player, online or not. Loaded before anything else runs.
    ctx.blockConcurrencyWhile(async () => {
      this.ex = (await ctx.storage.get("exchange")) || { next: 1, orders: [], last: {}, tax: 0 };
      this.jack = (await ctx.storage.get("jackpot")) || { pot: G.JACKPOT.seed, wins: [] };
      this.fame = (await ctx.storage.get("fame")) || null;   // the Winners' Wall
    });
  }

  /* ------------------------------------------------------------ connections */
  async fetch(request) {
    if (new URL(request.url).pathname === "/where") {
      let colo = null; try { colo = (await (await fetch("https://www.cloudflare.com/cdn-cgi/trace")).text()).match(/colo=(\w+)/)?.[1]; } catch (e) { /* unknown */ }
      return Response.json({ colo, players: this.pls.size });
    }
    const path = new URL(request.url).pathname;
    if (path === "/stats") return Response.json({ ok: true, ...this.statsOf() });
    if (path === "/hiscores") return Response.json(await this.hiscores());
    if (path === "/export") {
      await this.saveAll();                       // back up what is true now, not what was true four seconds ago
      const data = await this.dumpAll();
      return Response.json({ ok: true, takenAt: new Date().toISOString(), rulesVersion: G.VERSION, saveVersion: G.SAVE_V, online: this.pls.size, count: Object.keys(data).length, data });
    }
    if (path === "/restore") return this.restore(request);
    if (path === "/kick") {
      const pl = this.pls.get(new URL(request.url).searchParams.get("id")); if (!pl) return Response.json({ ok: true, online: false });
      this.send(pl, { type: "kicked", message: "You've been removed from EastScape." });
      await this.leave(pl, true); try { pl.ws.close(4003, "removed"); } catch (e) { /* already gone */ }
      return Response.json({ ok: true, online: true });
    }
    if (path === "/restart") {
      const body = await request.json().catch(() => ({}));
      if (body.cancel) { const was = !!this.restartAt; this.restartAt = 0; this.warned = null; if (was) this.tellAll("The restart is called off. Carry on.", "good"); return Response.json({ ok: true, cancelled: was }); }
      return Response.json(await this.planRestart(Number(body.in) || 0));
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
      lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: true, needSave: !stored, out: [], god: false, msgs: 0, msgWindow: 0, joinedAt: Date.now(), lastInput: Date.now() };
    pl.playFrom = Date.now();
    pl.cashSeen = this.cashOf(C);
    if (C.stats) { C.stats.sessions++; C.stats.firstSeen ||= Number(C.created) || Date.now(); C.stats.lastSeen = Date.now(); }
    this.pls.set(user.id, pl);
    this.ctx.storage.put(`who:${String(user.login).toLowerCase()}`, { id: user.id, name: pl.name }).catch(() => {});
    const S = this.scene(C.scene);
    this.placeSafely(S, pl);
    ws.addEventListener("message", (e) => { try { this.onMessage(pl, JSON.parse(e.data)); } catch (err) { /* ignore bad frames */ } });
    ws.addEventListener("close", () => this.leave(pl));
    ws.addEventListener("error", () => this.leave(pl));
    this.dailyState(pl);   // today's jobs exist from the moment you arrive: the side panel shows them
    this.send(pl, { type: "hello", version: G.VERSION, t: Date.now(), you: { id: pl.id, login: pl.login, name: pl.name, admin: pl.admin }, me: this.meOf(pl) });
    this.send(pl, { type: "who", scene: S.key, who: this.whoOf(S) });
    this.send(pl, JSON.parse(this.snapOf(S, Date.now(), false)));
    S.whoSig = null;   // the next broadcast tells everyone else this player has arrived
    if (!stored) this.say(pl, "Welcome to EastScape. Wander the floor and play what you like. Broke? Out the arch to the Yard, and click a monster (or fish the pond): everything out there has its price written over it, and the Cashier by each arch turns it into tickets. Say hello to Dex behind the bar.");
    else this.say(pl, `Welcome back, ${pl.name}.`);
    if (this.exDeliver(pl)) this.exCommit(pl);   // market sales and purchases made while you were away
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
    pl.needSave = true;              // an idle session still has time played to bank
    await this.persist(pl);
    if (!this.pls.size) this.stop();
  }

  start() { if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS); }
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }

  send(pl, msg) { const s = typeof msg === "string" ? msg : JSON.stringify(msg); this.sentOut++; this.bytesOut += s.length; try { pl.ws.send(s); } catch (e) { /* closing */ } }
  say(pl, text, cls = "sys", tag) { pl.out.push({ type: "say", text, cls, tag }); }

  async persist(pl) {
    if (!pl.needSave) return;
    this.accrue(pl);
    pl.C.x = pl.x; pl.C.y = pl.y; pl.C.saved = Date.now();
    pl.needSave = false;
    try { await this.ctx.storage.put(`char:${pl.id}`, pl.C); pl.out.push({ type: "saved", t: pl.C.saved }); }
    catch (e) { pl.needSave = true; }
  }
  touch(pl) { pl.dirty = true; pl.needSave = true; pl.changedAt ??= Date.now(); }

  meOf(pl) { const C = pl.C; return { isle: { tier: C.isle.tier, themes: C.isle.themes }, speedTest: pl.speedTest || 0, hp: C.hp, inv: C.inv, bank: C.bank, eq: C.eq, xp: C.xp, qs: C.qs, tour: C.tour || null, hunger: G.needOf(C, "hunger"), thirst: G.needOf(C, "thirst"), found: C.found || {}, wagered: Number(C.wagered) || 0, earned: Number(C.earned) || 0, spinDay: C.spin?.day || null, streak: C.spin?.streak | 0, roller: C.roller | 0, free: C.free | 0, meal: C.meal || null, drink: C.drink || null, luck: C.luck | 0, daily: C.daily?.day === G.chicagoDay() ? C.daily.tasks : null, jack: Math.floor(this.jack?.pot || 0), settings: C.settings, stance: G.stanceOf(C), scene: C.scene, god: pl.god, saved: C.saved || 0, stats: C.stats }; }

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
    for (let y = 1; y < G.ROWS - 1; y++) for (let x = 1; x < G.COLS - 1; x++) if (G.walkableIn(S.g, x, y) && S.g[y][x] !== "e") { const d = Math.hypot(x - G.COLS / 2, y - G.ROWS / 2); if (!best || d < best.d) best = { x, y, d }; }
    if (S.key === G.START.scene && G.walkableIn(S.g, G.START.x, G.START.y)) best = G.START;
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
    this.msgsIn++;
    if (now - pl.msgWindow > 1000) { pl.msgWindow = now; pl.msgs = 0; }
    if (++pl.msgs > 40) return;                       // more than 40 a second is not a person
    const S = this.scene(pl.C.scene), C = pl.C;
    if (m.t !== "ping") pl.lastInput = now;               // anything but the page's own heartbeat means someone is there
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
      case "sort": { const out = G.sortInv(C.inv); if (G.countItems({ inv: out }, Object.keys(G.ITEMS)) !== G.countItems(C, Object.keys(G.ITEMS))) return; C.inv = out; this.touch(pl); return; }
      case "shop": return this.shopOp(S, pl, m);
      case "cashout": return this.cashOut(S, pl, m);
      case "dex": return this.dexOp(S, pl, m, now);
      case "counter": return this.counterOp(S, pl, m);
      case "unequip": return this.unequip(pl, String(m.slot));
      case "drop": {
        const i = m.i | 0, st = C.inv[i]; if (!st) return;
        if (st.k === "tickets") return this.say(pl, "You'd rather not drop your tickets.");
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
      case "stance": return;   // stances were removed (2026-09-19)
      case "settings": {
        for (const [k, v] of Object.entries(m.patch || {})) if (k in G.DEFAULT_SETTINGS && typeof v === "boolean") C.settings[k] = v;
        this.touch(pl); return;
      }
      case "bank": return this.bankOp(S, pl, m);
      case "ex": return this.exOp(S, pl, m);
      case "bet": return this.bet(S, pl, m, now);
      case "run": return this.run(S, pl, m, now);
      case "fight": return S.def.realRound ? undefined : this.fightOp(S, pl, m, now);
      case "daily": return this.dailyOp(S, pl, m);
      case "roul": return S.def.realRound ? undefined : this.roulOp(S, pl, m, now);
      case "tour": return this.tourOp(S, pl, m);
      case "use": return this.useItem(pl, m.i | 0);
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
    else if (m.kind === "mob") {
      const mob = S.mobs.find((x) => x.id === m.id && !x.dead); if (!mob) return;
      if (!this.mayFight(S, mob, pl, now)) return this.say(pl, `${this.claimOf(S, mob, now).name} is already fighting that.`, "bad");
      { const gate = mob.target === pl.id || pl.god ? null : G.bandBlock(C, S.key, "fight");   /* LEVEL BANDS: a soft gate. Something already attacking you can always be fought back */
        if (gate) return this.say(pl, `${S.def.name} is for Combat ${gate.need} and up. You're ${gate.have}. ${gate.need <= 10 ? "The Yard will get you there." : "Work the scene before this one a while longer."}`, "bad"); }
      act = { kind: "mob", id: mob.id, x: mob.x, y: mob.y, name: G.MOBS[mob.t].name };
    }
    else if (m.kind === "npc") { const n = S.npcs.find((x) => x.id === m.id); if (n) act = { kind: "npc", id: n.id, x: n.x, y: n.y, name: n.name, reach: n.reach || 1 }; }
    else {
      const ob = S.objs[m.ob | 0]; if (!ob || ob.edge) return;   // (the border's trees and rocks are scenery)
      const kind = { wheat: "wheat", spot: "spot", rock: "rock", vein: "vein", tree: "tree", oak: "tree", yew: "tree", cypress: "tree", deadtree: "tree", willow: "tree", skyash: "tree", range: "cook", fire: "cook", furnace: "smelt", anvil: "smith", olive: "olive", vine: "olive", hole: "hole", well: "well", house: "door", shrine: "shrine", booth: "bank", stall: "exchange", fightring: "fight", fightboard: "fight", coinstatue: "cashier", cooler: "cooler", buffet: "buffet", prizewheel: "prize", fameboard: "fame", cashier: "cashier", slots: "game", wheel: "game", hilo: "game", mines: "game", plinko: "game", scratch: "game", cointable: "game", dicetable: "game", notice: "board", howto: "howto", roulette: "roulette", rrtable: "rr", roomdoor: "door", walldoor: "door", rope: "rope", ferry: "ferry", cart: "ferry", boatback: "boatback", plot: "plot", pedestal: "pedestal", islesign: "islesign" }[ob.t] || (EXAMINE_KINDS.has(ob.t) || G.EXAMINE[ob.t] ? ob.t : null);
      if (!kind) return;
      const at = kind === "door" && ob.door ? ob.door : G.nearestCell(ob, f);
      act = { kind, ob, x: at.x, y: at.y, name: ob.name };
      // the anvil is told which recipe; the page sends its id with the click
      if (kind === "smith" && m.pick && G.RECIPES[String(m.pick)]) act.pick = String(m.pick);
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
    // A skill that no longer exists (a stale quest reward, an old admin macro)
    // used to throw in here, and this runs inside the tick — one bad key would
    // stop the world for everybody. Ignore it instead.
    if (!G.SKILLS[k]) { console.warn(`grant: no such skill "${k}"`); return; }
    const C = pl.C, before = G.lvlOf(C, k);
    C.xp[k] = Math.max(0, (C.xp[k] || 0) + xp); const after = G.lvlOf(C, k);
    if (xp > 0) pl.out.push({ type: "xp", k, xp, track });
    if (after > before) { this.say(pl, `Congratulations, you just advanced a ${G.SKILLS[k].name} level! You are now level ${after}.`, "good"); pl.out.push({ type: "levelup", k, lvl: after }); if (k === "hp") C.hp = Math.min(G.maxHpOf(C), C.hp + (after - before)); }
    if (C.hp > G.maxHpOf(C)) C.hp = G.maxHpOf(C);
    this.touch(pl);
    if (xp > 0) this.emit(pl, "xp", { skill: k, xp });
  }

  /* ------------------------------------------------------------ the event hook

     Everything that happens to a player goes through emit(). Anything that
     wants to know subscribes HERE — the stat counters and quests today,
     achievements, daily tasks and hiscores later — instead of every skill
     being wired to every system by hand.

       kill    { mob }            a monster died to this player
       gather  { k, n }           skilling produced an item
       loot    { k, n }           a monster dropped one
       cook    { k, n }  burn {}  the range or a fire
       craft   { k, n }           for Smithing / Crafting when they land
       xp      { skill, xp }      any xp at all
       death   { pvp }            this player died
       pvpkill { victim }         this player killed another
       quest   { k }              a quest handed in

     tickets is NOT emitted: it moves through shops, the Exchange, trades, quest
     rewards and island upgrades, and a hook at each of those is a hook someone
     will forget to add. It is measured by difference in persist() instead.
     ------------------------------------------------------------ */
  emit(pl, type, d = {}) {
    this.countEvent(pl, type, d);
    this.questEvent(pl, type, d);
    this.dailyEvent(pl, type, d);
    this.tourEvent(pl, type, d);
    if (type === "gather") { this.luckDrop(pl, "clover", G.LUCK.gather); this.luckDrop(pl, "horseshoe", G.LUCK.shoe); }   // luck is skilling's alone
    else if (type === "kill") this.killFinds(pl, d);                                                                          // windfalls are fighting's
  }

  countEvent(pl, type, d) {
    const st = pl.C.stats;
    if (!st) return;                         // a save that predates the counters
    const bump = (map, k, n) => { if (k && n > 0) st[map][k] = (st[map][k] || 0) + n; };
    switch (type) {
      case "kill":    bump("kills", d.mob, 1); break;
      case "gather":  bump("gathered", d.k, d.n || 1); break;
      case "loot":    bump("looted", d.k, d.n || 1); break;
      case "cook":    bump("cooked", d.k, d.n || 1); break;
      case "craft":   bump("crafted", d.k, d.n || 1); break;
      case "burn":    st.burnt++; break;
      case "quest":   st.questsDone++; break;
      case "pvpkill": st.pvpKills++; break;
      case "death":   st.deaths++; if (d.pvp) st.pvpDeaths++; break;
      case "xp": {
        const xp = Math.trunc(d.xp || 0);
        if (xp <= 0) break;
        st.xpTotal += xp;
        const day = G.dayKeyCT();
        st.xpDay[day] = (st.xpDay[day] || 0) + xp;
        // only ever trims on the first xp of a new day, once the log is full
        const days = Object.keys(st.xpDay);
        if (days.length > G.STAT_DAYS) for (const k of days.sort().slice(0, days.length - G.STAT_DAYS)) delete st.xpDay[k];
        break;
      }
      default: return;
    }
    this.touch(pl);
  }

  /* ------------------------------------------------------------ planned restarts

     A worker deploy tears the Durable Object down and every socket with it.
     Characters are written within SAVE_MS of any change, so almost nothing is
     ever at risk - but "almost" is not what you want during launch month, and
     being dropped with no warning reads as the game breaking.

     So: announce, count down, write EVERY character, then tell the pages it is
     a restart rather than a fault. They wait RESTART_HOLD_MS and come back,
     instead of racing the deploy with a one-second backoff.
     ------------------------------------------------------------ */
  tellAll(text, cls = "sys") { for (const p of this.pls.values()) this.say(p, text, cls); }

  async planRestart(seconds) {
    const s = Math.max(0, Math.min(3600, Math.trunc(seconds)));
    this.restartAt = Date.now() + s * 1000;
    this.warned = new Set();
    this.start();                                   // count down even with nobody on, so the save still happens
    this.tellAll(s >= 60 ? `EastScape is restarting in ${Math.round(s / 60)} minute${s >= 120 ? "s" : ""}. Your character is saved automatically - you will be back in a moment.` : `EastScape is restarting in ${s} seconds. Hold tight.`, "admin");
    if (s === 0) await this.doRestart();
    return { ok: true, at: this.restartAt, players: this.pls.size };
  }

  restartTick(now) {
    if (!this.restartAt) return;
    const left = Math.ceil((this.restartAt - now) / 1000);
    if (left > 0) {
      for (const mark of RESTART_WARN_S) {
        if (left <= mark && !this.warned.has(mark)) {
          this.warned.add(mark);
          if (this.pls.size) this.tellAll(mark >= 60 ? `Restarting in ${mark / 60} minute${mark > 60 ? "s" : ""}.` : `Restarting in ${mark} seconds.`, "admin");
          break;                                    // one warning a tick, never a burst
        }
      }
      return;
    }
    this.restartAt = 0;
    this.doRestart();
  }

  // write everyone, tell every page this was planned, then let the deploy land
  async doRestart() {
    this.roulRefundAll("The table closes for a restart: your roulette bets are back in your bag.");
    this.fightRefundAll("The pit closes for a restart: your bets are back in your bag.");
    const saved = await this.saveAll();
    for (const pl of [...this.pls.values()]) {
      this.send(pl, { type: "restarting", holdMs: RESTART_HOLD_MS });
      try { pl.ws.close(4001, "restarting"); } catch (e) { /* already gone */ }
    }
    return saved;
  }

  // every connected character, written now. Used by the restart and the backup.
  async saveAll() {
    let n = 0;
    for (const pl of this.pls.values()) {
      pl.needSave = true;
      try { await this.persist(pl); n++; } catch (e) { /* one bad write must not stop the rest */ }
    }
    try { await this.ctx.storage.put("exchange", this.ex); } catch (e) { /* same */ }
    try { await this.ctx.storage.put("jackpot", this.jack); this.jackDirty = false; } catch (e) { /* same */ }
    return { saved: n };
  }

  /* What the last minute looked like. Public and cheap: no character data, no
     names, nothing a player could not see by counting heads. It answers the
     only question worth asking during a launch — is the world keeping up, or
     is it one person's connection.

     Tick time is the number that matters: the world steps every TICK_MS, so a
     p95 anywhere near that budget means everybody is playing a slow game. */
  statsOf() {
    const ms = [...this.tickMs].sort((a, b) => a - b);
    const at = (p) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] : 0);
    const upS = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
    const scenes = {};
    for (const [key, S] of this.scenes) { const n = this.playersIn(S).length; if (n) scenes[key] = n; }
    return {
      online: this.pls.size, peak: this.peak, scenes: this.scenes.size, busiest: scenes,
      tick: { budgetMs: TICK_MS, samples: ms.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: ms.at(-1) || 0 },
      rate: { inPerS: +(this.msgsIn / upS).toFixed(1), outPerS: +(this.sentOut / upS).toFixed(1), outBytesPerS: Math.round(this.bytesOut / upS) },
      trades: this.trades.size, offers: this.ex?.orders?.length || 0,
      restartAt: this.restartAt || 0, upS
    };
  }

  /* ------------------------------------------------------------ hiscores

     Every character, ranked. Built by reading all of them out of storage,
     which is exactly the kind of thing that should NOT happen on every page
     view — so it is cached for CACHE_MS and computed at most once in that
     window no matter how many people are looking.

     The long-term home for this is D1, written on save, so the world does no
     work for it at all. At this size one read a minute is cheaper than that
     pipeline, and the shape of the answer is the same either way, so moving it
     later is a change of source and not of feature. */
  async hiscores() {
    const CACHE_MS = 60000, now = Date.now();
    if (this.hsAt && now - this.hsAt < CACHE_MS) return this.hs;

    const rows = [];
    let after;
    for (;;) {
      const page = await this.ctx.storage.list(after === undefined ? { prefix: "char:", limit: 500 } : { prefix: "char:", startAfter: after, limit: 500 });
      if (!page || !page.size) break;
      for (const [key, raw] of page) {
        after = key;
        const C = G.normChar(raw);
        const skills = {};
        for (const k of Object.keys(G.SKILLS)) skills[k] = G.lvlOf(C, k);
        rows.push({
          id: key.slice(5),
          name: raw?.name || null,
          total: G.totalOf(C),
          xp: Math.round(Object.values(C.xp).reduce((n, v) => n + (Number(v) || 0), 0)),
          combat: G.combatOf(C),
          skills,
          // a couple of things worth bragging about that are not levels
          kills: Object.values(C.stats?.kills || {}).reduce((n, v) => n + v, 0),
          playMs: C.stats?.playMs || 0
        });
      }
      if (page.size < 500) break;
    }
    // names are not on the character; they live in the who: index
    const names = new Map();
    for (const pl of this.pls.values()) names.set(pl.id, pl.name);
    let wafter;
    for (;;) {
      const page = await this.ctx.storage.list(wafter === undefined ? { prefix: "who:", limit: 500 } : { prefix: "who:", startAfter: wafter, limit: 500 });
      if (!page || !page.size) break;
      for (const [key, v] of page) { wafter = key; if (v?.id && v?.name && !names.has(v.id)) names.set(v.id, v.name); }
      if (page.size < 500) break;
    }
    for (const r of rows) r.name = names.get(r.id) || r.name || "Someone";

    const board = (key) => [...rows].sort((a, b) => (key === "total" ? b.total - a.total || b.xp - a.xp
      : key === "combat" ? b.combat - a.combat || b.total - a.total
      : b.skills[key] - a.skills[key] || b.xp - a.xp)).slice(0, 50)
      .map((r, i) => ({ rank: i + 1, name: r.name, level: key === "total" ? r.total : key === "combat" ? r.combat : r.skills[key], xp: r.xp, kills: r.kills }));

    const boards = { total: board("total"), combat: board("combat") };
    for (const k of Object.keys(G.SKILLS)) boards[k] = board(k);
    this.hs = { ok: true, at: new Date(now).toISOString(), players: rows.length, boards };
    this.hsAt = now;
    return this.hs;
  }

  // every key this world owns, paged so a big world cannot be half-dumped
  async dumpAll() {
    const out = {};
    let after;
    for (;;) {
      const page = await this.ctx.storage.list(after === undefined ? { limit: 1000 } : { startAfter: after, limit: 1000 });
      if (!page || !page.size) break;
      for (const [k, v] of page) { out[k] = v; after = k; }
      if (page.size < 1000) break;
    }
    return out;
  }

  /* Restore, with two locks on it.

     It is a DRY RUN unless ?apply=yes, and it refuses outright while anybody is
     connected: a live player holds their character in memory and writes it back
     within seconds, so restoring underneath them would be undone immediately and
     look like the restore silently failed. Announce a restart, let everyone drop,
     then restore.

     ?only=char:  restores just characters and leaves the Exchange alone. */
  async restore(request) {
    const u = new URL(request.url);
    const body = await request.json().catch(() => null);
    const data = body && typeof body.data === "object" && body.data ? body.data : null;
    if (!data) return Response.json({ ok: false, code: "NO_DATA", message: "Send { data: { key: value, ... } } from a backup." }, { status: 400 });

    const only = u.searchParams.get("only") || "";
    const keys = Object.keys(data).filter((k) => !only || k.startsWith(only));
    if (!keys.length) return Response.json({ ok: false, code: "NOTHING_MATCHED", message: `No keys in that backup start with "${only}".` }, { status: 400 });

    if (u.searchParams.get("apply") !== "yes") {
      return Response.json({ ok: true, dryRun: true, would: keys.length, online: this.pls.size,
        blocked: this.pls.size ? `${this.pls.size} player(s) connected — an apply would be refused` : null,
        sample: keys.slice(0, 12) });
    }
    if (this.pls.size) return Response.json({ ok: false, code: "PLAYERS_ONLINE", online: this.pls.size,
      message: `${this.pls.size} player(s) are connected. Announce a restart and let them drop first, or a live character will overwrite what you restore.` }, { status: 409 });

    let written = 0;
    for (let i = 0; i < keys.length; i += 100) {
      const put = {};
      for (const k of keys.slice(i, i + 100)) put[k] = data[k];
      await this.ctx.storage.put(put);
      written += Object.keys(put).length;
    }
    // whatever is in memory is now stale: drop it so the next read comes off storage
    this.scenes.clear();
    this.ex = (await this.ctx.storage.get("exchange")) || this.ex;
    this.jack = (await this.ctx.storage.get("jackpot")) || this.jack;
    this.fame = (await this.ctx.storage.get("fame")) || this.fame || null;
    return Response.json({ ok: true, restored: written, from: body.takenAt || null });
  }

  // every coin a character holds, bag and bank
  cashOf(C) {
    let n = 0;
    for (const s of C.inv) if (s.k === "tickets") n += s.n;
    for (const s of C.bank) if (s.k === "tickets") n += s.n;
    return n;
  }

  /* Time played and cash, both measured rather than hooked.

     tickets: the difference since the last save. Every path that moves money is
     covered by construction, and nothing new has to remember to report. The
     cost is that earning and spending the same 100 between two saves nets to
     nothing — saves land within SAVE_MS of any change, so that is a four-second
     window, which is the right trade for a lifetime total that can never drift
     because somebody added a shop.

     Time: accrued here and on leave, so an idle player's time is not lost. */
  accrue(pl) {
    const st = pl.C.stats, now = Date.now();
    if (!st) return 0;
    if (pl.playFrom) { st.playMs += Math.max(0, now - pl.playFrom); pl.playFrom = now; }
    const cash = this.cashOf(pl.C), was = Number.isFinite(pl.cashSeen) ? pl.cashSeen : cash;
    if (cash > was) st.cashIn += cash - was;
    else if (cash < was) st.cashOut += was - cash;
    pl.cashSeen = cash;
    st.lastSeen = now;
    return now;
  }

  /* Damage into xp, split by the stance. Every stance pays the same total, so
     this is only ever deciding WHERE it goes — see STANCES in the rules file.
     Hitpoints xp is granted untracked (false) so the skill ring keeps showing
     the combat skill the player is actually training. */
  award(pl, dmg) {
    if (!(dmg > 0)) return;
    for (const [skill, xp] of G.xpForDamage(pl.C, dmg)) this.grant(pl, skill, xp, skill !== "hp");
  }

  hasTool(pl, skill) {
    const C = pl.C, w = C.eq.weapon; if (w && G.ITEMS[w].tool === skill) return true;
    // (2026-09-20) a tool in the bag is a tool in the hand: nobody should have to learn to wield a pickaxe to go and earn ten dollars
    const k = G.TOOL_OF[skill], nm = G.ITEMS[k].name.toLowerCase();
    if (C.inv.some((x) => G.ITEMS[x.k]?.tool === skill)) return true;
    this.say(pl, `You need a ${nm} to do that. Brutus sells them in the workshop, out the casino's front door.`, "bad");
    return false;
  }
  equip(pl, i) {
    const C = pl.C, st = C.inv[i]; if (!st) return; const it = G.ITEMS[st.k]; if (!it?.slot) return;
    const miss = G.missingReq(C, it);
    if (miss) return this.say(pl, `You need a ${G.SKILLS[miss.skill].name} level of ${miss.lvl} to use the ${it.name.toLowerCase()}.`, "bad");
    const old = C.eq[it.slot];
    if (st.n > 1) st.n--; else C.inv.splice(i, 1);
    if (old) this.give(pl, old);
    C.eq[it.slot] = st.k;
    this.say(pl, `You ${it.slot === "weapon" ? "wield" : "put on"} the ${it.name.toLowerCase()}.`);
    this.touch(pl);
  }
  // eating: a moment's pause, and your next swing waits a little
  // lucky charms: click one and your next N bets are lucky (see G.LUCK)
  useItem(pl, i) {
    const C = pl.C, st = C.inv[i], it = st && G.ITEMS[st.k]; if (!it) return;
    if (it.drink || it.use) return this.useSpecial(pl, i, st, it);
    if (!it.luck) return;
    if ((C.luck | 0) >= G.LUCK.max) return this.say(pl, `You're as lucky as it gets (${G.LUCK.max} saved up). Go and use some out the arch.`, "bad");
    st.n--; if (!st.n) C.inv.splice(i, 1);
    C.luck = Math.min(G.LUCK.max, (C.luck | 0) + it.luck); this.touch(pl);
    this.say(pl, `You feel lucky. For your next ${C.luck} kills or catches, a real ZCoin is ${G.LUCK.zdrop * 100}% more likely to drop.`, "good");
  }
  /* A RARE THING IS NEVER LOST TO A FULL BAG (the owner, 2026-09-19): a real ZCoin or a rare find that won't fit goes
     straight to the bank instead, and says so. Only a full bag AND a full bank can lose one. -> "bag" | "bank" | null */
  keepRare(pl, k, n) {
    const C = pl.C;
    if (G.roomFor(C.inv, k) >= n) { G.addInv(C.inv, k, n); return "bag"; }
    return this.bankAdd(pl, k, n) ? "bank" : null;
  }
  zcoinDrop(pl, from) {
    const C = pl.C, n = Math.random() < G.ZDROP.big ? G.ZDROP.bigN : 1, where = this.keepRare(pl, "zcoin", n);
    if (!where) return this.say(pl, "A REAL ZCoin dropped, and your bag AND your bank were too full to take it. That one hurts.", "bad");
    this.touch(pl); this.emit(pl, "loot", { k: "zcoin", n });
    if (where === "bank") this.say(pl, "Your bag was full, so it went straight to your BANK. Take it out at a bank (there's a chest in the Yard) before you cash it in.", "good");
    C.found = C.found && typeof C.found === "object" ? C.found : {}; C.found.zcoin = (C.found.zcoin | 0) + n;
    this.say(pl, `💎 ${n > 1 ? `${n} REAL ZCoins` : "A REAL ZCoin"}! Bank ${n > 1 ? "them" : "it"} at the Prize Counter and ${n > 1 ? "they go" : "it goes"} onto your eastcoin.vip balance.`, "loot");
    for (const p of this.pls.values()) if (p !== pl && (n > 1 || p.C.scene === C.scene)) p.out.push({ type: "casinonote", text: `💎 ${pl.name} found ${n > 1 ? `${n} real ZCoins` : "a real ZCoin"} on ${from}!` });
  }
  /* FIGHTING's rewards (G.FINDS): house chips and the things you click, more often from bigger monsters; and one kill
     in eight makes you a High Roller. The room hears about a black chip, everyone hears about a gold one. */
  killFinds(pl, d) {
    const C = pl.C, mob = d?.mob; if (!G.BOUNTY[mob]) return;
    const k = G.rollRare(mob, Math.random(), G.fxOf(C));   // ONE roll: the monster's own rares, then the casino finds (G.raresOf); buffs move the chances (G.fxOf)
    if ((C.luck | 0) > 0) { C.luck--; this.touch(pl); }   /* a lucky kill is one spent, whatever dropped */
    if (k) {
      const it = G.ITEMS[k], worth = it.slot ? 0 : G.valueOf(k), name = it.name.toLowerCase();
      if (k === "zcoin") this.zcoinDrop(pl, `a ${G.MOBS[mob].name.toLowerCase()}`);
      else { const where = this.keepRare(pl, k, 1);
      if (!where) this.say(pl, `It dropped a ${name}, and your bag AND your bank were too full to take it. Ouch.`, "bad");
      else {
      this.touch(pl); this.emit(pl, "loot", { k, n: 1 });
      if (where === "bank") this.say(pl, `Your bag was full, so the ${name} went straight to your BANK.`, "good");
      C.found = C.found && typeof C.found === "object" ? C.found : {}; C.found[k] = (C.found[k] | 0) + 1;   // the collection log
      this.say(pl, it.slot ? `RARE DROP: ${it.name}! ${it.fx ? "Wear it and the tables treat you differently." : "You can't make that one: it only drops."}` : worth ? `It was carrying a ${name}! That's ${G.fmtCash(worth)} at the Ruby.` : `RARE DROP: a ${name}! Click it in your bag to see what it does.`, "loot");
      if (it.slot) for (const p of this.pls.values()) if (p !== pl && p.C.scene === C.scene) p.out.push({ type: "casinonote", text: `✨ ${pl.name} got a rare drop: ${it.name}, from a ${G.MOBS[mob].name.toLowerCase()}.` });
      if (worth >= 1000) for (const p of this.pls.values()) if (worth >= 5000 || p.C.scene === C.scene) p.out.push({ type: "casinonote", text: `💰 ${pl.name} found a ${name} (${G.fmtCash(worth)}) on a ${G.MOBS[mob].name.toLowerCase()}!` });
      } }
    }
    if (G.ROLLER.kill > 0 && Math.random() < G.ROLLER.kill && (C.roller | 0) < G.ROLLER.max) {
      C.roller = Math.min(G.ROLLER.max, (C.roller | 0) + G.ROLLER.bets); this.touch(pl);
      this.say(pl, `The fight's gone to your head. HIGH ROLLER: every table will take double from you, for your next ${C.roller} big bets.`, "loot");
    }
  }
  /* drinks, scrolls, boxes, dice, watches and free-play chips: everything in the bag that's clicked and isn't food or luck */
  useSpecial(pl, i, st, it) {
    const C = pl.C, now = Date.now(), take = () => { st.n--; if (!st.n) C.inv.splice(C.inv.indexOf(st), 1); this.touch(pl); };
    if (it.drink) {
      const k = st.k; take(); C.drink = { k, left: it.drink.mins * 60000 };
      return this.say(pl, `You drink the ${it.name.toLowerCase()}. For ${it.drink.mins} minutes out the arch: ${G.fxText(it.drink.fx)}.`, "good");
    }
    if (it.use === "tp") {
      const S = this.scenes.get(C.scene);
      if (C.scene === G.START.scene) return this.say(pl, "You're already in the casino.");
      if (S?.def?.pvp || now - (pl.hurtAt || 0) < 8000) return this.say(pl, S?.def?.pvp ? "The scroll won't work in the Wilderness." : "Not while something's hitting you. Get clear first.", "bad");
      take(); pl.act = null; pl.path = []; this.moveToScene(pl, G.START.scene, null, G.START);
      return this.say(pl, "The scroll burns up in your hand, and you're standing on the casino floor.", "good");
    }
    if (it.use === "bundle") { take(); this.tixTo(pl, it.worth | 0); return this.say(pl, `You cash the old chip: ${G.fmtTix(it.worth | 0)}.`, "good"); }
    if (it.use === "box") {
      const total = G.BOX.reduce((a, [, w]) => a + w, 0); let r = Math.random() * total, got = G.BOX[0][0];
      for (const [k, w] of G.BOX) { r -= w; if (r < 0) { got = k; break; } }
      take(); this.give(pl, got, 1);
      return this.say(pl, `You open the mystery box: a ${G.ITEMS[got].name.toLowerCase()}!`, "loot");
    }
    if (it.use === "devil") {   /* (v65) no table to have won at: the Devil plays for the tickets in your bag */
      const amt = Math.min(G.DEVIL.max, G.tixIn(C)); if (amt < 1) return this.say(pl, "The Devil doesn't play for nothing. Come back with tickets.", "bad");
      take(); G.takeInv(C.inv, "tickets", amt);
      if (Math.random() < G.DEVIL.odds) {
        this.give(pl, "tickets", amt * G.DEVIL.pays); this.touch(pl); this.say(pl, `The Devil's dice come up sixes. Your ${G.fmtTix(amt)} are now ${G.fmtTix(amt * G.DEVIL.pays)}!`, "loot");
        const S = this.scenes.get(C.scene); if (S && amt >= 200) for (const q of this.playersIn(S)) if (q !== pl) q.out.push({ type: "casinonote", text: `😈 ${pl.name} rolled the Devil's dice and tripled ${G.fmtTix(amt)}!` });
      } else this.say(pl, `Snake eyes. The Devil keeps your ${G.fmtTix(amt)}.`, "bad");
      return;
    }
    if (it.use === "heal") {
      if (C.hp >= G.maxHpOf(C)) return this.say(pl, "You're at full health. Save it for when you're not.");
      take(); C.hp = G.maxHpOf(C); this.touch(pl);
      return this.say(pl, "The hands spin backwards, and so do your bruises. Full health.", "loot");
    }
  }
  // working turns up charms: called for every gather
  luckDrop(pl, k, chance) {
    if (Math.random() >= chance || G.roomFor(pl.C.inv, k) < 1) return;
    G.addInv(pl.C.inv, k, 1); this.touch(pl);
    this.say(pl, `You find a ${G.ITEMS[k].name.toLowerCase()}! Click it in your bag before a long session out here.`, "loot");
  }
  eat(pl, i, now) {
    const C = pl.C, st = C.inv[i], it = st && G.ITEMS[st.k]; if (!it?.heal) return;
    if (now - (pl.lastEat || 0) < G.EAT_MS) return;
    pl.lastEat = now; pl.lastSwing = Math.max(pl.lastSwing, now - 1200);
    st.n--; if (!st.n) C.inv.splice(i, 1);
    const before = C.hp; C.hp = Math.min(G.maxHpOf(C), C.hp + Math.round(it.heal * (1 + (it.meal ? 0 : G.fxOf(C).heal))));
    if (it.meal) { C.meal = { k: st.k, left: it.meal.mins * 60000 }; this.say(pl, `A proper dinner. For ${it.meal.mins} minutes out the arch: ${G.fxText(it.meal.fx)}.`, "loot"); }
    this.touch(pl);
    this.say(pl, C.hp > before ? `You eat the ${it.name.toLowerCase()}. It heals ${C.hp - before}.` : `You eat the ${it.name.toLowerCase()}. You were already full.`, "good");
  }
  // the Forge: buy from Brutus, sell him what you gathered. You have to be standing with him.
  shopOp(S, pl, m) {
    const C = pl.C, bar = m.shop === "bar", n = bar ? S.npcs.find((x) => x.name === "Dex the Dealer") : S.npcs.find((x) => x.opens === "shop");
    if (!n || G.cheb(pl, n) > (bar ? 5 : 3)) return this.say(pl, bar ? "You need to be at the bar, with Dex." : "You need to be at the Forge, with Brutus.", "bad");
    const cash = () => C.inv.find((x) => x.k === "tickets");
    if (bar && m.op === "round") {   // a round for the room: everyone on the floor who isn't already drinking
      const rd = G.BAR.round, c = cash(); if (!c || c.n < rd.price) return this.say(pl, `A round is ${G.fmtCash(rd.price)}.`, "bad");
      const who = this.playersIn(S).filter((p) => !p.lingerUntil && !((p.C.drink?.left | 0) > 0));
      if (!who.length) return this.say(pl, "Everybody's already got a drink in their hand.");
      c.n -= rd.price; if (!c.n) C.inv.splice(C.inv.indexOf(c), 1); this.touch(pl);
      for (const p of who) { p.C.drink = { k: rd.k, left: (G.ITEMS[rd.k].drink?.mins || 10) * 60000 }; this.touch(p); if (p !== pl) this.say(p, `${pl.name} bought the room a round! ${G.ITEMS[rd.k].name} for the next ${G.ITEMS[rd.k].drink?.mins || 10} minutes out the arch: ${G.fxText(G.ITEMS[rd.k].drink.fx)}.`, "loot"); }
      for (const p of this.playersIn(S)) p.out.push({ type: "casinonote", text: `🍻 ${pl.name} bought the room a round!` });
      return this.say(pl, `A round for the room: ${who.length} ${who.length === 1 ? "drink" : "drinks"} poured, yours included.`, "good");
    }
    if (bar && m.op !== "buy") return;
    if (m.op === "buy") {
      const row = (bar ? G.BAR : G.SHOP).sells.find(([k]) => k === m.k); if (!row) return;
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
      this.give(pl, "tickets", qty * price); this.touch(pl);
      return this.say(pl, `You sell ${qty > 1 ? `${qty} × ` : "the "}${G.ITEMS[k].name.toLowerCase()} for ${G.fmtCash(qty * price)}.`, "good");
    }
  }
  /* the Cashier: everything you brought back, for what it said over it. "all" sells loot and things you made and
     leaves tools, charms and anything wearable alone; one item at a time sells whatever you point at. */
  atCounter(S, pl) { return this.near(S, pl, "coinstatue", 3) || this.near(S, pl, "cashier", 3); }
  /* every ticket EARNED (kills, trade-ins, daily jobs) counts toward VIP; buying and betting never do */
  earned(pl, n) { if (!(n > 0)) return; const C = pl.C, was = G.vipOf(C).i; C.earned = (Number(C.earned) || 0) + n; const now = G.vipOf(C);
    if (now.i > was) { this.say(pl, `You've made ${now.name} VIP: ${Math.round(now.off * 100)}% off everything at the Prize Counter, and everyone can see it by your name.`, "loot"); for (const q of this.pls.values()) if (q !== pl) q.out.push({ type: "casinonote", text: `👑 ${pl.name} made ${now.name} VIP.` }); } }
  tixTo(pl, n) { this.earned(pl, n); if (n > 0 && !this.give(pl, "tickets", n) && !this.bankAdd(pl, "tickets", n)) this.say(pl, "Your bag and bank are both full: those tickets are lost. Make some room!", "bad"); }
  /* THE PRIZE COUNTER: tickets in, prizes out (G.prizesOf). Chips are tickets, 1 for 1; everything else is an item. */
  counterOp(S, pl, m) {
    if (!this.atCounter(S, pl)) return this.say(pl, "You need to be at the Prize Counter: the House Ruby or a Cashier's window, on the casino floor.", "bad");
    const C = pl.C, tix = G.tixIn(C);
    if (m.op !== "buy") return;
    const p = G.prizesOf().find((x) => x.id === String(m.id)); if (!p) return;
    const n = Math.max(1, Math.min(99, m.n | 0 || 1)), cost = G.counterPrice(C, p.price) * n, it = p.give && G.ITEMS[p.give[0]];
    if (tix < cost) return this.say(pl, `That's ${G.fmtTix(cost)}. You have ${G.fmtTix(tix)}.`, "bad");
    if (it && G.roomFor(C.inv, p.give[0]) < p.give[1] * n) return this.say(pl, "Your bag's too full for that.", "bad");
    G.takeInv(C.inv, "tickets", cost);
    this.give(pl, p.give[0], p.give[1] * n);
    this.touch(pl);
    this.say(pl, `${n > 1 ? `${n} × ` : ""}${it.name} for ${G.fmtTix(cost)}.`, "good");
  }
  cashOut(S, pl, m) {
    const C = pl.C; if (!this.atCounter(S, pl)) return this.say(pl, "You need to be at the Prize Counter: the House Ruby or a Cashier's window, on the casino floor.", "bad");
    const keys = m.op === "all" ? [...new Set(C.inv.map((s) => s.k))].filter(G.isLoot) : [String(m.k)].filter((k) => G.isLoot(k) && C.inv.some((s) => s.k === k));
    if (m.op !== "all" && !keys.length && G.ITEMS[String(m.k)]?.slot) return this.say(pl, "The Cashier doesn't buy anything you could wear or hold. Brutus, at the Forge out front, buys what's been smithed.", "bad");
    let total = 0, count = 0;
    for (const k of keys) { const n = G.takeInv(C.inv, k, G.countItems({ inv: C.inv, bank: [] }, [k])); total += n * G.valueOf(k); count += n; }
    if (!count) return this.say(pl, "The counter looks in your bag. \"Nothing in there I can give you tickets for. The arch is that way.\"");
    this.tixTo(pl, total); this.touch(pl);
    pl.out.push({ type: "cashed", total, count });
    this.say(pl, `The counter hands over ${G.fmtTix(total)} for ${count} thing${count === 1 ? "" : "s"}. Spend them right here.`, "good");
  }
  /* ------------------------------------------------------------ THE HOUSE RUBY: tickets into real ZCoins (2026-09-20)
     The SITE decides everything about ZCoins (functions/api/eastscape/exchange.js: the hourly allowance, the ticket's
     roll, the one-and-only payment per id). This side's whole job is the CASH, and the order things happen in:
       1. the tickets comes off the character, and a record of the ask goes into storage under dex:<player>:<id>
       2. BOTH are saved before the site is asked anything
       3. the site answers: paid -> the record goes; a DEFINITE no -> the tickets comes back and the record goes;
          anything else (a timeout, an error page, "unsettled") -> the record stays, marked stuck, the tickets stays held,
          and the SAME id is asked again the next time the player opens the Ruby. Asking twice is safe: the site pays
          an id once. A crash between 2 and 3 leaves a record that is retried the same way.
     The tickets is never given back on an unknown, and ZCoins are never asked for before the tickets is safely gone. */
  async dexAsk(body) {
    if (this.env.DEV === "1" && !this.env.ESCAPE_KEY) return this.dexDev(body);
    try {
      const r = await fetch(`${this.env.SITE}/api/eastscape/exchange`, { method: "POST", headers: { "content-type": "application/json", "X-Escape-Key": String(this.env.ESCAPE_KEY || "") }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => null);
      return j && typeof j.ok === "boolean" ? j : { ok: false, definite: false, code: "BAD_ANSWER" };
    } catch (e) { return { ok: false, definite: false, code: "NO_ANSWER" }; }
  }
  // `wrangler dev` has no key and must never reach the real site: a pretend Ruby with the same answers, so the window can be worked on
  dexDev(body) {
    const D = (this.devDex ||= { used: 0, seen: new Map() }), left = Math.max(0, G.DEX.capHour - D.used);
    if (body.op === "status") return { ok: true, left, capHour: G.DEX.capHour, maxStake: G.DEX.maxStake, open: [], enabled: true, dev: true };
    if (D.seen.has(body.id)) return { ...D.seen.get(body.id), duplicate: true };
    const cost = body.zc | 0; if (cost > left) return { ok: false, code: "CAP", definite: true, left, message: "That's your EastScape ZCoins for this hour (pretend)." };
    D.used += cost; const ans = body.op === "stake" ? { ok: true, voucher: body.id, zc: cost, left: left - cost } : { ok: true, zc: cost, balance: 1000 + cost, left: left - cost };
    D.seen.set(body.id, ans); return ans;
  }
  dexKey(pl, id) { return `dex:${pl.id}:${id}`; }
  /* Two asks, one machinery (v57):
       "bank"   ZCoins you found on a kill or a catch go onto your eastcoin.vip balance. At the Prize Counter.
       "stake"  A TICKET STAKE: G.DEX.rate tickets for each ZCoin of a bet at a real table. The tickets are taken and saved
                HERE, then the site writes a voucher, and the page sends that voucher with an ordinary bet. At any real table.
     Both count against the one hourly allowance, which the site owns. */
  async dexOp(S, pl, m, now) {
    const op = String(m.op), C = pl.C, stake = op === "stake";
    if (stake ? !(S.def.real || S.def.realRound) : !this.atCounter(S, pl)) return stake ? pl.out.push({ type: "stake", g: m.g, error: "There's no ZCoin table in this room." }) : this.say(pl, "You need to be at the Prize Counter: the House Ruby or a Cashier's window, on the casino floor.", "bad");
    const fail = (error, status) => pl.out.push(stake ? { type: "stake", g: m.g, error, status } : { type: "dex", error, status });
    if (pl.dexBusy || now - (pl.lastDex || 0) < (stake ? 400 : 1500)) { if (stake) fail("One at a time. Try that again."); return; } pl.lastDex = now;
    pl.dexBusy = true;
    try {
      // anything left over from before (a timeout, a restart mid-ask) is asked again FIRST, with its own id
      const old = await this.ctx.storage.list({ prefix: `dex:${pl.id}:`, limit: 5 });
      for (const [key, rec] of old) await this.dexSettle(pl, key, rec, true);
      if (op === "status") { const st = await this.dexAsk({ op: "status", userId: pl.id }); return pl.out.push({ type: "dex", status: st, held: (await this.ctx.storage.list({ prefix: `dex:${pl.id}:`, limit: 5 })).size }); }
      if (op !== "bank" && !stake) return;
      if ((await this.ctx.storage.list({ prefix: `dex:${pl.id}:`, limit: 1 })).size) return fail("The house is still working on your last one. Give it a minute and try again.");
      const have = G.countItems({ inv: C.inv, bank: [] }, ["zcoin"]), want = Math.floor(Number(m.zc));
      if (!stake && !have) return fail("You've no ZCoins in your bag to bank. They turn up, rarely, on a kill or a catch.");
      if (stake && !(want >= 1 && want <= G.DEX.maxStake)) return fail(`A ticket bet is 1 to ${G.DEX.maxStake} ZCoins' worth.`);
      if (stake && G.tixIn(C) < want * G.DEX.rate) return fail(`That's ${G.fmtTix(want * G.DEX.rate)} (${G.DEX.rate.toLocaleString()} a ZCoin). You have ${G.fmtTix(G.tixIn(C))}. Out the arch: everything out there pays tickets.`);
      // ask what's left BEFORE taking anything, so the usual refusal (the hour's allowance) costs nothing and risks nothing
      const st = await this.dexAsk({ op: "status", userId: pl.id });
      if (!st.ok || !st.enabled) return fail(st.message || "ZCoins aren't moving right now. Nothing was taken.", st);
      if (stake) { const spare = (st.open || []).find((v) => v.zc === want); if (spare) return pl.out.push({ type: "stake", g: m.g, voucher: spare.id, zc: want, spare: true, status: st }); }   // paid for earlier and never bet: it's still yours
      const zc = stake ? want : Math.min(have, st.left, G.DEX.capHour);
      if (zc < 1 || zc > st.left) return fail(stake ? (st.left ? `You've ${st.left} ZCoin${st.left === 1 ? "" : "s"}' worth of ticket bets left this hour. ZCoin bets still work.` : "That's your ticket bets for this hour. It refills as the hour rolls on. ZCoin bets still work.") : (st.left ? `There's room for ${st.left} more ZCoin${st.left === 1 ? "" : "s"} this hour.` : "That's your ZCoins for this hour. It refills as the hour rolls on; what you found will keep."), st);
      const back = stake ? { k: "tickets", n: zc * G.DEX.rate } : { k: "zcoin", n: zc };
      if (pl.left || G.countItems({ inv: C.inv, bank: [] }, [back.k]) < back.n) return;
      const id = `${stake ? "s" : "x"}${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, key = this.dexKey(pl, id), rec = { id, op: stake ? "stake" : "pay", zc, back, g: stake ? String(m.g || "") : undefined, at: Date.now(), name: pl.name };
      G.takeInv(C.inv, back.k, back.n); this.touch(pl);
      await this.ctx.storage.put(key, rec); await this.persist(pl);
      if (pl.needSave) { /* the character did not save: put everything back and stop */ this.give(pl, back.k, back.n); await this.ctx.storage.delete(key); return fail("Couldn't save just now. Nothing was taken. Try again in a moment."); }
      await this.dexSettle(pl, key, rec, false);
    } finally { pl.dexBusy = false; }
  }
  // what an ask took goes back the way it came: tickets for a stake, the ZCoins themselves for a banking
  async dexRefund(pl, rec) {
    const back = rec.back && G.ITEMS[rec.back.k] ? rec.back : null; if (!back) return;   // (a record from before v57 that took tickets: tickets no longer exists)
    if (!pl.left) { if (!this.give(pl, back.k, back.n)) this.bankAdd(pl, back.k, back.n); this.touch(pl); return this.persist(pl); }
    try { const ck = `char:${pl.id}`, c = await this.ctx.storage.get(ck); if (!c) return; c.bank ||= []; const b = c.bank.find((x) => x.k === back.k); if (b) b.n += back.n; else c.bank.push({ k: back.k, n: back.n }); await this.ctx.storage.put(ck, c); } catch (e) { /* lost only if storage itself fails */ }
  }
  // ask the site about one record and act on the answer. `again`: this is a retry of something left over
  async dexSettle(pl, key, rec, again) {
    if (rec.op !== "pay" && rec.op !== "stake") { await this.ctx.storage.delete(key); return this.dexRefund(pl, rec); }   // a Ruby scratch ticket left over from before v57: the site no longer rolls them, so it is simply given back
    const stake = rec.op === "stake", ans = await this.dexAsk({ op: rec.op, userId: pl.id, id: rec.id, zc: rec.zc });
    const status = (left) => ({ ok: true, left, capHour: G.DEX.capHour, maxStake: G.DEX.maxStake, enabled: true });
    if (ans.ok) {
      await this.ctx.storage.delete(key);
      if (stake) { if (!pl.left && !ans.used) pl.out.push({ type: "stake", g: rec.g, voucher: ans.voucher || rec.id, zc: rec.zc, status: status(ans.left), again }); return; }   // (left, or a retry: the voucher stays OPEN on the site and is handed back the next time they bet that amount)
      const got = ans.zc | 0;
      if (!pl.left) pl.out.push({ type: "dex", done: { op: "bank", zc: got, balance: ans.balance, again }, status: status(ans.left) });
      if (got >= 10) for (const q of this.pls.values()) q.out.push({ type: "casinonote", text: `💎 ${rec.name} banked ${got} ZCoins at the Prize Counter.` });
      return;
    }
    if (ans.definite) {   // nothing was or will be given: what it cost comes back
      await this.ctx.storage.delete(key); await this.dexRefund(pl, rec);
      const error = `${ans.message || "The house said no."} What it took is back in your bag.`;
      if (!pl.left) pl.out.push(stake ? { type: "stake", g: rec.g, error, status: ans.left != null ? status(ans.left) : null } : { type: "dex", error, status: ans.left != null ? status(ans.left) : null });
      return;
    }
    if (!rec.stuck) { rec.stuck = true; await this.ctx.storage.put(key, rec); }
    if (!pl.left && !again) { const error = "The house jammed and couldn't say whether that went through. What it took is held, not lost: try again in a minute and it will finish the job or give it back."; pl.out.push(stake ? { type: "stake", g: rec.g, error } : { type: "dex", error }); }
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
  // a subscriber of emit(): quests whose goal is "kill N of X" count here
  questEvent(pl, type, d) {
    const C = pl.C, what = d.mob;
    if (what == null) return;
    for (const k in G.QUESTS) {
      const q = G.QUESTS[k], o = C.qs[k];
      if (o && o.state === "active" && q.goal.type === type && q.goal.mob === what) { o.n++; this.touch(pl); if (o.n === q.goal.n) this.say(pl, `${q.name}: that's ${q.goal.n}. Go back to ${q.giver}.`, "good"); }
    }
  }
  finishQuest(pl, k) {
    const C = pl.C, q = G.QUESTS[k];
    if (q.goal.type === "bring") { let left = q.goal.n; for (const key of q.goal.items) { left -= G.takeInv(C.inv, key, left); if (!left) break; } }
    C.qs[k] = { ...(C.qs[k] || {}), state: "done" };
    if (q.reward.coins) this.give(pl, "tickets", q.reward.coins);
    for (const [sk, xp] of Object.entries(q.reward.xp || {})) this.grant(pl, sk, xp);
    for (const [it, n] of q.reward.items || []) this.give(pl, it, n);
    pl.out.push({ type: "questdone", k });
    this.touch(pl);
    this.emit(pl, "quest", { k });
  }

  /* ------------------------------------------------------------ the tick */
  tick() {
    const t0 = Date.now();
    this.tickTimed(t0);
    const took = Date.now() - t0;
    this.tickMs.push(took);
    if (this.tickMs.length > METRIC_TICKS) this.tickMs.shift();
    if (this.pls.size > this.peak) this.peak = this.pls.size;
  }

  tickTimed(now) {
    this.tickN++;
    if (this.tickN % 20 === 0) for (const pl of this.pls.values()) {   /* once a second */
      const C = pl.C, dt = Math.min(5000, now - (pl.fxAt || now)); pl.fxAt = now; if (!(C.meal || C.drink) || !(G.SCENES[String(C.scene).split(":")[0]]?.mobs?.length)) continue;
      for (const k of ["meal", "drink"]) if (C[k]) { C[k].left = (C[k].left | 0) - dt; if (C[k].left <= 0) { this.say(pl, `Your ${G.ITEMS[C[k].k]?.name.toLowerCase() || k} has worn off.`); C[k] = null; } this.touch(pl); }
    }
    if (this.jackDirty && this.tickN % 100 === 0) { this.jackDirty = false; this.ctx.storage.put("jackpot", this.jack).catch(() => { this.jackDirty = true; }); }
    this.restartTick(now);
    const live = new Set([...this.pls.values()].map((p) => p.C.scene));
    for (const [key, S] of this.scenes) {
      if (key === "roulette" && !S.def.realRound) this.rouletteTick(S, now);   /* (a realRound room's game is the site's: no rounds are run here) */
      if (key === "fightpit" && !S.def.realRound) this.fightTick(S, now);
      if (!live.has(key)) { S.idleSince ||= now; if (now - S.idleSince > SCENE_IDLE_MS && !(S.def.pvp && S.mobs.some((m) => m.dead && now < m.respawnAt)) && !S.roulette?.bets.length && !S.fight?.bets.length) this.scenes.delete(key); continue; }
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
      for (const key of live) { const S = this.scenes.get(key); if (S?.bots.length && Math.random() < 0.035) S.events.push({ type: "bubble", id: pick(S.bots).id, text: pick(S.key === "fightpit" ? PIT_LINES : S.def.floor === "casino" ? CASINO_LINES : BOT_LINES), t: now }); }
    }
    for (const T of this.trades.values()) { const a = this.pls.get(T.a), b = this.pls.get(T.b); if (!a || !b || G.cheb(a, b) > G.TRADE_RANGE + 2) this.tradeEnd(T, "Trade cancelled: you walked too far apart."); }
    if (this.tickN % SNAP_EVERY === 0) this.broadcast(now); else this.sendPrivate();
    for (const S of this.scenes.values()) if (S.ground.length) S.ground = S.ground.filter((x) => now < x.gone);
    for (const pl of this.pls.values()) if (pl.lingerUntil && now > pl.lingerUntil) { this.pls.delete(pl.id); pl.needSave = true; this.persist(pl); }
    if (!this.pls.size && !this.restartAt) this.stop();
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
  gained(S, pl, k, n = 1, how = "gather") {
    S.events.push({ type: "gain", who: pl.id, k, n, t: Date.now() });
    this.emit(pl, how, { k, n });
    if (S.def.geode && Math.random() < S.def.geode && this.give(pl, "geode")) { S.events.push({ type: "gain", who: pl.id, k: "geode", n: 1, t: Date.now() }); this.emit(pl, "gather", { k: "geode", n: 1 }); this.say(pl, "Something glints in the dirt: a glimmering geode!", "loot"); }
  }
  groupNote(S, pl, a) {
    const n = this.workersOn(S, a.ob, pl); if (n === a.groupSeen) return; a.groupSeen = n;
    if (n) this.say(pl, `Group bonus: ${n} other${n > 1 ? "s" : ""} working this ${a.ob.name.toLowerCase()} with you. +${n}% to your chance and xp.`, "good", "group");
  }

  doAction(S, pl, now) {
    const a = pl.act, C = pl.C; if (!a || pl.path.length) return;
    // AFK: a repeating skill stops once nobody has touched the game for a while (see G.AFK_MS)
    if (G.AFK_KINDS[a.kind] && now - pl.lastInput > G.AFK_MS) {
      pl.act = null;
      return this.say(pl, `You stop ${G.AFK_KINDS[a.kind]}: you've been idle for ${Math.round(G.AFK_MS / 60000)} minutes. Click to carry on.`);
    }
    const faceIt = () => { pl.dir = G.DIRS[`${Math.sign(a.x - pl.x)},${Math.sign(a.y - pl.y)}`] || pl.dir; pl.face = a.x > pl.x ? 1 : a.x < pl.x ? -1 : pl.face; };
    if (a.kind === "mob") {
      const m = S.mobs.find((x) => x.id === a.id); if (!m || m.dead) { pl.act = null; return; }
      if (!this.mayFight(S, m, pl, now)) { pl.act = null; return this.say(pl, `${this.claimOf(S, m, now).name} is already fighting that.`, "bad"); }
      if (G.cheb(pl, m) !== 1) { const p = G.findPath(S.g, pl, m, 1); if (p && p.length) pl.path = p; else if (!p) pl.act = null; return; }
      a.x = m.x; a.y = m.y; faceIt();
      // the weapon sets the pace now: a gladius swings every 1.8s, a maul every 3s
      const swingMs = G.swingMsOf(C);
      if (!a.started) { a.started = now; pl.lastSwing = now - Math.max(0, swingMs - 600); m.lastSwing = now; }
      if (now - pl.lastSwing >= swingMs) {
        pl.lastSwing = now; pl.swingAt = now; pl.fightAt = now;
        if (!S.def.pvp) m.claim = { id: pl.id, until: now + CLAIM_MS };
        const def = G.MOBS[m.t], hit = Math.random() < G.hitChance(G.attackRollOf(C), def.def), dmg = hit ? rint(1, G.maxHitOf(C)) : 0;
        m.hp -= dmg; m.hurtAt = now; S.events.push({ type: "splat", who: m.id, n: dmg, kind: dmg ? "hit" : "miss", t: now });
        this.award(pl, dmg);
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
      const inside = G.SCENES[a.ob.enter];
      if (!G.OPEN.has(String(a.ob.enter)) && !pl.god) { pl.act = null; return this.say(pl, "Vince doesn't move. \"Room's shut. Refit. Don't ask me when.\"", "bad"); }
      if (inside.door?.cash && !pl.god && G.cashIn(C) < inside.door.cash && !((C.roller | 0) > 0)) { pl.act = null; return this.say(pl, `Vince looks at your shoes. "List says ${G.fmtCash(inside.door.cash)} on you, or fresh from a fight and looking it (High Roller). You've got ${G.fmtCash(G.cashIn(C))}."`, "bad"); } this.moveToScene(pl, a.ob.enter, null, inside.entry); pl.dir = "north";
      return this.say(pl, `You go into ${inside.name.replace(/^The /, "the ")}.`);
    }
    if (a.kind === "bank") return pl.out.push({ type: "bank" });
    if (a.kind === "cashier") { pl.act = null; return pl.out.push({ type: "cashier", ruby: a.ob?.t === "coinstatue" }); }
    if (a.kind === "fight" && S.def.realRound) { pl.act = null; return pl.out.push({ type: "roundopen", key: S.def.realRound }); }
    if (a.kind === "fight") { pl.act = null; return pl.out.push({ ...this.fightView(S, pl, now), open: true }); }
    if (a.kind === "prize") { pl.act = null; return this.prizeSpin(pl); }
    if (a.kind === "rr") { pl.act = null; return pl.out.push({ type: "rr" }); }   /* Russian Roulette is the site's table: the page opens its window and talks to the site */
    if (a.kind === "fame") { pl.act = null; const F = this.fameToday(); return pl.out.push({ type: "popup", title: "Winners' Wall", icon: "🏆", text: F.rows.length ? `TODAY'S BIGGEST WINS\n\n${F.rows.map((r, i) => `${i + 1}. ${r.name}: +${G.fmtCash(r.profit)} on ${r.game}`).join("\n")}\n\nWin ${G.fmtCash(G_FAME_MIN)} or more on one bet to get your name up here. The wall is wiped at midnight, Central.` : `Nobody's won ${G.fmtCash(G_FAME_MIN)} on one bet yet today. The wall is empty, and it could be your name at the top of it.` }); }
    if (a.kind === "cooler" || a.kind === "buffet") { pl.act = null; return this.say(pl, a.kind === "cooler" ? "You fill a paper cup and drain it. Refreshing. It does nothing else." : "You load up a plate. It's free, and it tastes like it."); }   /* (hunger and thirst are off: BACKLOG) */
    if (a.kind === "game" && S.def.real?.[a.ob.t]) { pl.act = null; return pl.out.push({ type: "real", g: a.ob.t }); }   // eastcoin.vip's own game, for real ZCoins: the page opens the window and talks to the site itself
    if (a.kind === "game" && !G.GAMES[a.ob.t]) { pl.act = null; return; }
    if (a.kind === "game") { pl.act = null; return pl.out.push({ type: "game", g: a.ob.t, pot: Math.floor(this.jack.pot), lastJack: this.jack.wins?.[0] || null }); }
    if (a.kind === "howto") { pl.act = null; return pl.out.push({ type: "popup", title: "How EastScape works", text: G.HOWTO, icon: "🎰" }); }
    if (a.kind === "board") { pl.act = null; this.tourStep(pl, "board"); return this.dailySend(pl); }
    if (a.kind === "roulette" && S.def.realRound) { pl.act = null; return pl.out.push({ type: "roundopen", key: S.def.realRound }); }
    if (a.kind === "roulette") { pl.act = null; pl.out.push({ type: "roulopen" }); return this.roulSendTo(S, pl); }
    if (a.kind === "exchange") { pl.out.push({ type: "exchange" }); return this.exSend(pl); }
    if (a.kind === "hole") {
      if (G.lvlOf(C, G.WILD_REQ.skill) < G.WILD_REQ.lvl) return pl.out.push({ type: "popup", title: "The Wilderness", icon: "☠️", text: `You need level ${G.WILD_REQ.lvl} in ${G.SKILLS[G.WILD_REQ.skill].name} to enter the Wilderness.` });
      return pl.out.push({ type: "wildask" });
    }
    if (a.kind === "rope") { this.moveToScene(pl, "farm", null, { x: 10, y: 9 }); return this.say(pl, "You climb back up to the farm. Nobody can attack you up here."); }
    if (a.kind === "ferry") return pl.out.push({ type: "ferry" });
    if (a.kind === "boatback") { this.moveToScene(pl, G.ISLE_FERRY.scene, null, G.ISLE_FERRY); return this.say(pl, "Charon takes you back to the square without a word."); }
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
    /* Every station — campfire, range, furnace, anvil — runs the same loop off
       the RECIPES table. Cooking behaves exactly as it did; smelting and
       smithing are rows, not code. A station is `auto` when it should just get
       on with the best thing you can make (cooking, smelting); the anvil is
       not, because "which of the forty things" is a question only you can
       answer, so it waits for a.pick. */
    if (a.kind === "cook" || a.kind === "smelt" || a.kind === "smith") {
      const st = G.STATIONS[ob.t];
      if (!st) { pl.act = null; return; }
      const lv = G.lvlOf(C, st.skill), all = G.recipesAt(ob.t);
      // the anvil is told what to make; everything else takes the best it can
      const wanted = a.pick ? all.find((r) => r.id === a.pick) : null;
      const r = st.auto ? all.find((x) => G.canMake(C, x)) : (wanted && G.canMake(C, wanted) ? wanted : null);
      if (!r) {
        if (!st.auto && wanted) this.say(pl, G.lvlOf(C, wanted.skill) < wanted.lvl
          ? `You need a ${G.SKILLS[wanted.skill].name} level of ${wanted.lvl} to ${st.verb} that.`
          : `You don't have what that takes: ${wanted.in.map(([k, n]) => `${n} × ${G.ITEMS[k].name.toLowerCase()}`).join(", ")}.`, "bad");
        else {
          // nothing doable: say whether it is a level or a missing ingredient
          const tooHard = all.find((x) => x.in.every(([k, n]) => G.countItems(C, [k]) >= n) && lv < x.lvl);
          this.say(pl, tooHard
            ? `You need a ${G.SKILLS[tooHard.skill].name} level of ${tooHard.lvl} to ${st.verb} that.`
            : `You have nothing to ${st.verb} at the ${st.name}.`, tooHard ? "bad" : "sys");
        }
        pl.act = null; return;
      }
      const outName = G.ITEMS[r.out[0]].name.toLowerCase();
      if (!a.started) { a.started = now; a.next = now + r.ms; pl.swingAt = now; this.say(pl, `You start ${st.verb === "cook" ? "cooking" : st.verb === "smelt" ? "smelting" : "hammering out"} the ${st.verb === "cook" ? G.ITEMS[r.in[0][0]].name.toLowerCase().replace(/^raw /, "") : outName}.`); return; }
      if (now - pl.swingAt > 900) pl.swingAt = now;
      if (now < a.next) return;
      a.next = now + r.ms;
      // room for what comes out, and for the ruined version if it can fail
      if (G.roomFor(C.inv, r.out[0]) < r.out[1] || (r.burnStop != null && G.roomFor(C.inv, "burnt") < 1)) { this.say(pl, "Your inventory is full.", "bad"); pl.act = null; return; }
      for (const [k, n] of r.in) G.takeInv(C.inv, k, n);
      if (r.burnStop != null && Math.random() < G.burnChance(r, lv, ob.t === "range")) { this.give(pl, "burnt"); this.emit(pl, "burn", {}); this.say(pl, "You burn it.", "bad"); }
      else {
        this.give(pl, r.out[0], r.out[1]);
        this.gained(S, pl, r.out[0], r.out[1], r.skill === "cooking" ? "cook" : "craft");
        this.grant(pl, r.skill, r.xp);
        if (r.skill !== "cooking") this.say(pl, `You make ${r.out[1] > 1 ? `${r.out[1]} × ` : "a "}${outName}.`, "good");
      }
      this.touch(pl);
      this.questCheck(pl);
      const again = st.auto ? all.some((x) => G.canMake(C, x)) : G.canMake(C, r);
      if (!again) { this.say(pl, `That's everything you can ${st.verb} for now.`); pl.act = null; }
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
      { const gate = pl.god ? null : G.bandBlock(C, S.key, "fish"); if (gate) { pl.act = null; return this.say(pl, `This water is for Fishing ${gate.need} and up. You're ${gate.have}.`, "bad"); } }   /* LEVEL BANDS */
      if (!a.started) { a.started = now; a.next = now + G.FISHING.ms; this.say(pl, "You cast out your line…"); return; }
      if (now < a.next) return;
      const fx = G.fxOf(C); a.next = now + Math.round(G.FISHING.ms / (1 + fx.speed));
      const lvl = G.lvlOf(C, "fishing"), fish = G.fishAt(ob, lvl, Math.random()), trout = fish === ob.fish2;   /* v68: every spot names its fish, and a second one from fish2lvl (`trout` now just means "the second fish") */
      this.groupNote(S, pl, a);
      if (Math.random() < Math.min(0.97, G.FISHING.chance(lvl) + bonus + fx.bite)) {
        if (!this.give(pl, fish)) { pl.act = null; return; }
        this.gained(S, pl, fish);
        if (fx.tix > 0 && Math.random() < fx.tix && this.give(pl, fish)) this.say(pl, "Two on one line!", "good");   /* the ticket buffs, for a fisher: that chance of a second fish */
        if (Math.random() < (G.ZDROP.fish[fish] || 0) * (1 + fx.zdrop)) this.zcoinDrop(pl, "the end of a fishing line");
        if ((C.luck | 0) > 0) { C.luck--; this.touch(pl); }
        this.grant(pl, "fishing", gx(trout ? ob.xp2 || ob.xp || 50 : ob.xp || 20)); this.say(pl, `You catch a ${G.ITEMS[fish].name.replace(/^Raw /, "").toLowerCase()}.`, "good"); this.questCheck(pl);
      }
    }
  }

  killMob(S, pl, m, now) {
    const def = G.MOBS[m.t];
    // the more people fighting here, the sooner it comes back (see G.respawnMs): same monsters on screen, less waiting
    const fighters = this.playersIn(S).filter((p) => now - (p.fightAt || 0) < 60000).length;
    m.dead = true; m.claim = null; m.respawnAt = now + G.respawnMs(S.def, m.t, fighters); pl.act = null;
    const got = [];
    for (const [k, n, chance] of def.drops) {
      if (chance != null && Math.random() >= chance) continue;
      let qty = Array.isArray(n) ? rint(n[0], n[1]) : n;
      if (k === "tickets") { qty = Math.round(qty * (1 + G.fxOf(pl.C).tix)); this.earned(pl, qty); }   /* the ticket buffs (G.fxOf), and the VIP count */
      if (this.give(pl, k, qty)) { got.push([k, qty]); this.emit(pl, "loot", { k, n: qty }); }
    }
    this.say(pl, `You defeat the ${def.name.toLowerCase()}.${got.length ? ` It drops ${got.map(([k, n]) => `${n > 1 ? n + " " : ""}${G.ITEMS[k].name.toLowerCase()}`).join(", ")}.` : ""}`, "loot");
    this.emit(pl, "kill", { mob: m.t });
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
    this.emit(pl, "death", { pvp: !!S?.def.pvp });
    if (pk) this.emit(pk, "pvpkill", { victim: pl.id });
    let lost = null;
    if (S?.def.pvp) {
      const worn = G.SLOTS.filter((s) => C.eq[s]);
      if (worn.length && Math.random() < G.PVP.drop) { const s = pick(worn); lost = C.eq[s]; C.eq[s] = null; this.dropGround(S, lost, 1, pl.x, pl.y, pk ? pk.id : null, now); }
      const nm = lost ? G.ITEMS[lost].name.toLowerCase() : null;
      if (pk) this.say(pk, `You have defeated ${pl.name}.${nm ? ` They dropped their ${nm}. It's yours for the next minute.` : ""}`, "loot");
      this.say(pl, `${pk ? `${pk.name} killed you` : `A ${killer?.mob?.toLowerCase() || "monster"} killed you`} in the Wilderness.${nm ? ` You dropped your ${nm}.` : " You kept everything this time."}`, "bad");
      for (const p of this.pls.values()) if (p !== pl && p !== pk && G.sceneDef(p.C.scene)?.pvp) this.say(p, `☠️ ${pl.name} was killed by ${pk ? pk.name : `a ${killer?.mob?.toLowerCase() || "monster"}`}.`);
    }
    { const bill = pl.god || S?.def.pvp ? 0 : G.deathBill(C, S?.key); if (bill > 0) { G.takeInv(C.inv, "tickets", bill); this.touch(pl); this.say(pl, `THE HOSPITAL BILL: ${G.fmtTix(bill)}. They patched you up and went through your pockets.`, "bad"); } }   /* v68: the only thing a death costs */
    this.say(pl, "Oh dear, you are dead! You wake up on the casino floor. Nobody looks surprised.", "bad");
    C.hp = G.maxHpOf(C);
    this.moveToScene(pl, G.START.scene, null, { x: G.START.x, y: G.START.y });
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
    const TC = T.C, hit = Math.random() < G.hitChance(G.attackRollOf(C), G.defenceRollOf(TC)), dmg = hit ? rint(1, G.maxHitOf(C)) : 0;
    if (!T.god) { TC.hp -= dmg; this.touch(T); }
    if (dmg) T.hurtAt = now;
    S.events.push({ type: "splat", who: `p:${T.id}`, n: dmg, kind: dmg ? "hit" : "miss", t: now });
    // real fights train you; the Cage doesn't
    if (!cage) this.award(pl, dmg);
    // hit back, if they weren't doing anything
    if (!T.act && !T.path.length && !T.step && !T.lingerUntil) T.act = { kind: "pvp", id: pl.id, x: pl.x, y: pl.y, name: pl.name, started: 0 };
    if (TC.hp <= 0) this.die(T, S, pl);
  }

  /* ------------------------------------------------------------ islands */
  atFerry(S, pl) { return this.near(S, pl, "ferry", 3) || this.near(S, pl, "cart", 3); }
  async isleOp(S, pl, m) {
    const C = pl.C, I = C.isle, mine = S.owner === pl.id;
    if (m.op === "list") {
      const list = [...this.pls.values()].filter((p) => p !== pl && !p.lingerUntil && p.C.isle.open).map((p) => ({ id: p.id, name: p.name }));
      return pl.out.push({ type: "isles", list });
    }
    if (m.op === "go") {
      if (!this.atFerry(S, pl)) return this.say(pl, "You need to be at Charon's cart, in the square outside the casino.", "bad");
      let id = pl.id, name = pl.name;
      if (m.id != null) { const o = this.pls.get(String(m.id)); if (!o) return this.say(pl, "They aren't around right now. Try their name."); id = o.id; name = o.name; }
      else if (m.name) {
        const who = await this.ctx.storage.get(`who:${String(m.name).replace(/^@/, "").trim().toLowerCase()}`);
        if (!who) return this.say(pl, `Charon has never heard of anyone called ${String(m.name).slice(0, 25)}.`);
        id = who.id; name = who.name;
      }
      if (pl.left || pl.C.scene !== S.key) return;
      const owner = this.pls.get(id);
      let copy = null;
      if (id !== pl.id && !owner) copy = G.normChar(await this.ctx.storage.get(`char:${id}`)).isle;
      if (pl.left || pl.C.scene !== S.key) return;
      const isle = owner ? owner.C.isle : copy || I, key = G.isleKey(isle, id);
      if (id !== pl.id && !isle.open) return this.say(pl, `${name}'s island is closed to visitors.`);
      const S2 = this.scene(key); S2.ownerName = name; if (copy) S2.isleCopy = copy;
      this.moveToScene(pl, key, null, G.SCENES.isle.entry); pl.dir = "north";
      return this.say(pl, id === pl.id ? "Charon takes you out to your island." : `Charon takes you out to ${name}'s island.`, "good");
    }
    if (m.op === "upgrade") {
      const next = G.ISLE_TIERS[I.tier + 1];
      if (!this.atFerry(S, pl) || !next) return;
      const cash = C.inv.find((x) => x.k === "tickets");
      if (!cash || cash.n < next.price) return this.say(pl, `${next.name} costs ${G.fmtCash(next.price)}.`, "bad");
      cash.n -= next.price; if (!cash.n) C.inv.splice(C.inv.indexOf(cash), 1);
      const oldKey = G.isleKey(I, pl.id); I.tier++; this.touch(pl);
      const newKey = G.isleKey(I, pl.id);
      for (const p of this.pls.values()) if (p.C.scene === oldKey) { this.moveToScene(p, newKey, null, G.SCENES.isle.entry); this.say(p, "The island grows around you. Somebody paid for an upgrade."); }
      return this.say(pl, `Your island is now: ${next.name}. ${next.ex}`, "good");
    }
    if (m.op === "buy") {
      const th = G.THEMES[m.theme];
      if (!this.atFerry(S, pl) || !th || th.price == null || I.themes.includes(m.theme)) return;
      const cash = C.inv.find((x) => x.k === "tickets");
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
      if (!I.open) for (const p of [...this.pls.values()]) if (p !== pl && G.ownerOf(p.C.scene) === pl.id) { this.moveToScene(p, G.ISLE_FERRY.scene, null, G.ISLE_FERRY); this.say(p, `${pl.name} closed their island. Charon takes you back.`); }
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
      if (!st || st.k === "tickets" || I.shelf[i] !== null || !within("pedestal", i)) return;
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

  // First hit claims a monster (outside the Wilderness, where anything goes): the claim is renewed by every swing and
  // lapses after CLAIM_MS without one, or when the claimer leaves the area. Nobody else can attack it meanwhile.
  claimOf(S, m, now) {
    const c = m.claim; if (!c || S.def.pvp || now > c.until) return null;
    const p = this.pls.get(c.id); return p && p.C.scene === S.key && !p.dead ? p : null;
  }
  mayFight(S, m, pl, now) { const c = this.claimOf(S, m, now); return !c || c === pl; }
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
        Object.assign(m, { dead: false, hp: G.MOBS[m.t].hp, x: spot.x, y: spot.y, path: [], step: null, claim: null, target: null });
        continue;
      }
      const def = G.MOBS[m.t];
      let foe = players.find((p) => p.act?.kind === "mob" && p.act.id === m.id && G.cheb(p, m) === 1 && !p.step);
      if (!foe && def.aggro) {
        const ok = (p) => p.C.scene === S.key && !G.inCage(S.def, p.x, p.y) && G.cheb(p, { x: m.hx, y: m.hy }) <= def.aggro + 5;
        const owner = this.claimOf(S, m, now);
        let tgt = owner || (m.target ? players.find((p) => p.id === m.target) : null);
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
          const C = foe.C, hit = Math.random() < G.hitChance(G.MOBS[m.t].att, G.defenceRollOf(C)), dmg = hit ? Math.max(1, Math.round(rint(1, G.MOBS[m.t].max) * (1 - G.fxOf(C).tough))) : 0;   /* (tough: the visor, the Safety Net; whiskey makes it worse) */
          if (!foe.god) { C.hp -= dmg; this.touch(foe); }
          if (dmg) foe.hurtAt = now;
          foe.combatAt = now;
          if (!S.def.pvp && this.mayFight(S, m, foe, now)) m.claim = { id: foe.id, until: now + CLAIM_MS };
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
          const jobs = S.objs.filter((o) => ["tree", "oak", "cypress", "rock", "vein", "spot", "olive", "vine", "slots", "cointable", "dicetable", "wheel", "hilo", "mines", "plinko", "scratch"].includes(o.t) && !o.special && !(o.stumpUntil > now) && !(o.emptyUntil > now));
          const ob = jobs.length && pick(jobs), at = ob && G.nearestCell(ob, n), p = ob && G.findPath(S.g, n, at, ob.t === "spot" ? 2 : 1);
          if (p) { n.path = p; n.goal = { ob, x: at.x, y: at.y }; }
        } else if (n.level) { const tx = rint(2, G.COLS - 3), ty = rint(2, G.ROWS - 3); if (G.walkableIn(S.g, tx, ty)) { const p = G.findPath(S.g, n, { x: tx, y: ty }, 0); if (p) n.path = p.slice(0, 8); } }
        else { const [dx, dy] = pick(G.D8); if (Math.abs(n.x + dx - n.hx) <= 1 && Math.abs(n.y + dy - n.hy) <= 1 && G.canStepIn(S.g, n.x, n.y, dx, dy)) n.path = [{ x: n.x + dx, y: n.y + dy }]; }
      }
    }
  }

  /* ------------------------------------------------------------ telling everyone */
  /* ------------------------------------------------------------ what goes out

     A snapshot used to carry everyone's name, total level, weapon, body and
     max hp — none of which change from one tick to the next — to everybody in
     the scene, ten times a second. The scene's snapshot is built once, so the
     cost is not CPU: it is that N players each receive N records, which makes
     egress grow with the SQUARE of how many people are in a room. Measured
     before this change: 10 in a room cost 31 KB/s each, 40 cost 102, 80 cost
     197. Launch day is one room with everybody in it.

     So the parts that rarely change go out separately, as a "who" roster, and
     only when they actually change. The snapshot keeps position and combat
     state and nothing else, and drops every field that is falsy rather than
     spending bytes on "act":null,"ob":null,"mob":null,"started":false.

     The client merges the two: it keeps the last roster it saw and fills the
     rest in from each snapshot. A record for somebody it has no roster entry
     for still draws — as a placeholder — so a missed message is never a hole.
     ------------------------------------------------------------ */

  // the parts of a player or bot that do not change every tick
  whoOf(S) {
    const out = [];
    for (const p of this.playersIn(S)) out.push({ id: p.id, name: p.name, vip: G.vipOf(p.C).i || undefined, lvl: G.totalOf(p.C), weapon: p.C.eq.weapon, body: p.C.eq.body, maxHp: G.maxHpOf(p.C) });
    for (const b of S.bots) out.push({ id: b.id, name: b.name, level: b.level, art: b.art, hue: b.hue });
    return out;
  }
  // cheap enough to build every broadcast; it only ever SENDS when it differs
  whoSigOf(who) { let sig = ""; for (const w of who) sig += `${w.id}|${w.name}|${w.vip || 0}|${w.lvl ?? w.level}|${w.weapon || ""}|${w.body || ""}|${w.maxHp || ""}|${w.art || ""}|${w.hue || ""};`; return sig; }

  snapOf(S, now, withEvents = true) {
    const st = (e) => (e.step ? [e.step.fx, e.step.fy, e.step.tx, e.step.ty, e.step.t0, e.step.ms] : 0);
    // every field here is sent N×N times a second, so a falsy one is left out
    // x, y and hp of 0 are real values, so they are never trimmed; everything
    // else falsy means "nothing happening" and the client reads absence the same way
    const KEEP = new Set(["id", "x", "y", "hp", "t"]);
    const trim = (o) => { for (const k in o) if (!KEEP.has(k) && (o[k] === null || o[k] === false || o[k] === 0)) delete o[k]; return o; };
    const out = {
      type: "snap", t: now, scene: S.key, online: this.pls.size,
      players: this.playersIn(S).map((p) => trim({ id: p.id, x: p.x, y: p.y, s: st(p), dir: p.dir, face: p.face, hurtAt: p.hurtAt, swingAt: p.swingAt, act: p.act?.kind || null, started: !!p.act?.started, ob: p.act?.ob ? p.act.ob.id : null, mob: p.act?.kind === "mob" ? p.act.id : null, hp: p.C.hp, moving: !!(p.step || p.path.length) })),
      mobs: S.mobs.map((m) => trim({ id: m.id, t: m.t, x: m.x, y: m.y, s: st(m), face: m.face, hp: m.hp, dead: m.dead, hurtAt: m.hurtAt, swingAt: m.swingAt, c: this.claimOf(S, m, now)?.id })),
      npcs: S.npcs.map((n) => trim({ id: n.id, x: n.x, y: n.y, s: st(n), face: n.face, held: n.holdUntil > now })),
      bots: S.bots.map((b) => trim({ id: b.id, x: b.x, y: b.y, s: st(b), dir: b.dir, face: b.face, work: b.working ? b.working.ob.id : null, workT: b.working ? b.working.ob.t : null })),
      ground: S.ground.map((x) => ({ id: x.id, k: x.k, n: x.n, x: x.x, y: x.y, owner: x.owner, until: x.until })),
      isle: S.owner ? (() => { const I = this.isleOf(S); return I && { owner: S.owner, name: S.ownerName || this.pls.get(S.owner)?.name || "Someone", plots: I.plots, shelf: I.shelf, theme: I.theme, open: I.open }; })() : null,
      dyn: S.objs.filter((o) => o.stumpUntil > now || o.emptyUntil > now || o.bareUntil > now || o.grownAt > now).map((o) => [o.id, o.stumpUntil || 0, o.emptyUntil || 0, o.bareUntil || 0, o.grownAt || 0]),
      ev: withEvents ? S.events : []
    };
    return JSON.stringify(out);
  }
  broadcast(now) {
    const snaps = new Map(), rosters = new Map();
    for (const [key, S] of this.scenes) {
      const players = this.playersIn(S); if (!players.length) { S.events = []; continue; }
      const who = this.whoOf(S), sig = this.whoSigOf(who);
      // the roster goes out BEFORE the snapshot in the same broadcast, so a
      // player who just walked in is never referenced before they are known
      if (sig !== S.whoSig) { S.whoSig = sig; rosters.set(key, JSON.stringify({ type: "who", scene: key, who })); }
      snaps.set(key, this.snapOf(S, now));
      S.events = [];
    }
    for (const pl of this.pls.values()) {
      const r = rosters.get(pl.C.scene); if (r) this.send(pl, r);
      const s = snaps.get(pl.C.scene); if (s) this.send(pl, s);
    }
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
    /* TICKETS STAY ON YOU (the owner, 2026-09-19: "cant drop or get rid of their tickets... or bank them or anything like that").
       They are the one currency and they turn into ZCoins at the tables, so they only ever leave your bag by being SPENT:
       no drop (see "drop"), no bank, no gift in a trade. normChar moves any that were banked before this back to the bag. */
    if (m.op === "dep" && C.inv[m.i | 0]?.k === "tickets") return this.say(pl, "Tickets stay on you. The bank won't take them.");
    if (m.op === "dep") { const st = C.inv[m.i | 0]; if (!st) return; const k = st.k, q = qty(m.n, G.countItems(C, [k])); if (!this.bankAdd(pl, k, q)) return; G.takeInv(C.inv, k, q); }
    else if (m.op === "depinv") { for (const st of [...C.inv]) { if (st.k === "tickets") continue; if (!this.bankAdd(pl, st.k, st.n)) break; C.inv.splice(C.inv.indexOf(st), 1); } }
    else if (m.op === "depeq") { for (const sl of G.SLOTS) { const k = C.eq[sl]; if (k && this.bankAdd(pl, k, 1)) C.eq[sl] = null; } }
    else if (m.op === "wd") { const st = C.bank[m.i | 0]; if (!st) return; const q = this.giveUpTo(pl, st.k, qty(m.n, st.n)); if (!q) return; st.n -= q; if (!st.n) C.bank.splice(C.bank.indexOf(st), 1); }
    else return;
    this.touch(pl);
  }

  /* ------------------------------------------------------------ the Exchange: the stall in the Forum
     Offers keep working while their owner is away; what they earn waits in the offer's box until collected.
     Anything that moves items or tickets between a character and the Exchange saves both in one write. */
  async exCommit(...pls) {
    const put = { exchange: this.ex };
    for (const p of pls) { p.C.x = p.x; p.C.y = p.y; put[`char:${p.id}`] = p.C; p.needSave = false; p.changedAt = null; }
    await this.ctx.storage.put(put);
  }
  /* The market (rebuilt 2026-09-18): two sides, no collecting. Whatever an offer earns (items or tickets) goes straight to
     the owner's bank — at once if they're on, the moment they next log in if they're not (it waits in the offer's box
     until then). Every fill is told to the owner in chat; fills that happened while they were away are summed up at login.
     Matching is unchanged: best price first, then whoever was first, at the waiting offer's price, 1% to the house. */
  exMine(pl) { return this.ex.orders.filter((o) => o.owner === pl.id); }
  exOpen(pl) { return this.ex.orders.filter((o) => o.owner === pl.id && o.open); }
  exSend(pl) {
    const open = this.ex.orders.filter((o) => o.open && o.done < o.qty);
    const view = (o) => ({ id: o.id, k: o.k, left: o.qty - o.done, price: o.price, name: o.name, at: o.at, mine: o.owner === pl.id });
    const listings = open.filter((o) => o.side === "sell").sort((x, y) => y.at - x.at).slice(0, 80).map(view);
    const wanted = open.filter((o) => o.side === "buy").sort((x, y) => y.at - x.at).slice(0, 80).map(view);
    const mine = this.exMine(pl).sort((x, y) => y.at - x.at).map((o) => ({ id: o.id, side: o.side, k: o.k, qty: o.qty, done: o.done, price: o.price, open: o.open, at: o.at, closedAt: o.closedAt || 0 }));
    this.send(pl, { type: "exch", listings, wanted, mine, book: G.exSummary(this.ex.orders), last: this.ex.last });
  }
  exNote(ownerId, text) {
    const p = this.pls.get(ownerId);
    if (p) { p.out.push({ type: "exnote", text }); return; }
    const q = (this.ex.news ||= {})[ownerId] ||= []; q.push(text); if (q.length > 20) q.splice(0, q.length - 20);
  }
  // move whatever an owner's offers have earned into their bank (only while they're connected: that's the character we hold)
  exDeliver(pl) {
    let moved = false;
    for (const o of this.exMine(pl)) {
      if (o.box.items && this.bankAdd(pl, o.k, o.box.items)) { o.box.items = 0; moved = true; }
      if (o.box.cash && this.bankAdd(pl, "tickets", o.box.cash)) { o.box.cash = 0; moved = true; }
      if (!o.open && !o.closedAt) o.closedAt = Date.now();
    }
    // closed offers stay on the owner's list for three days (so "recent" means something), then go
    const now = Date.now();
    this.ex.orders = this.ex.orders.filter((o) => o.open || o.box.items || o.box.cash || (o.qty > 0 && now - (o.closedAt || now) < 3 * 86400000));
    const news = this.ex.news?.[pl.id];
    if (news?.length) { pl.out.push({ type: "exnote", text: `While you were away: ${news.join(" · ")}. It's in your bank.` }); delete this.ex.news[pl.id]; moved = true; }
    if (moved) this.touch(pl);
    return moved;
  }
  exOp(S, pl, m) {
    const C = pl.C, now = Date.now();
    if (m.op === "open") return this.exSend(pl);
    if (!this.near(S, pl, "stall")) return this.say(pl, "You need to be at the market stall in the Forum.", "bad");
    // tickets for an offer comes from your bag first, then your bank
    const payCash = (n) => { const bag = Math.min(n, G.cashIn(C)); if (bag) G.takeInv(C.inv, "tickets", bag); let left = n - bag; if (left) { const b = C.bank.find((x) => x.k === "tickets"); b.n -= left; if (!b.n) C.bank.splice(C.bank.indexOf(b), 1); } };
    const cashAll = () => G.cashIn(C) + (C.bank.find((x) => x.k === "tickets")?.n || 0);
    // items for a sell offer come from your bag first, then your bank
    const haveAll = (k) => G.countItems(C, [k]) + (C.bank.find((x) => x.k === k)?.n || 0);
    const takeItems = (k, n) => { const bag = G.takeInv(C.inv, k, n); let left = n - bag; if (left) { const b = C.bank.find((x) => x.k === k); b.n -= left; if (!b.n) C.bank.splice(C.bank.indexOf(b), 1); } };
    const place = (side, k, qty, price, now_) => {
      const o = { id: this.ex.next++, owner: pl.id, name: pl.name, side, k, qty, done: 0, price, at: now, open: true, box: { items: 0, cash: 0 } };
      this.ex.orders.push(o);
      const touched = this.exMatch(o);
      // "buy now": whatever the listings couldn't fill isn't left behind as an offer
      if (now_ && o.done < o.qty) { o.box.cash += (o.qty - o.done) * o.price; o.qty = o.done; o.open = false; }
      for (const p of new Set([pl, ...touched])) { this.exDeliver(p); this.exSend(p); }
      this.touch(pl); this.exCommit(pl, ...touched.filter((p) => p !== pl));
      return o;
    };
    if (m.op === "place" || m.op === "buynow") {
      const side = m.op === "buynow" ? "buy" : m.side === "buy" ? "buy" : "sell", k = String(m.k), qty = Math.floor(Number(m.qty)), price = Math.floor(Number(m.price));
      if (!G.ITEMS[k] || k === "tickets") return this.say(pl, "You can't trade that on the market.", "bad");
      if (!(qty >= 1 && qty <= 1e9 && price >= 1 && price <= 1e9)) return this.say(pl, "Pick a quantity and a price of at least 1.", "bad");
      if (m.op === "place" && this.exOpen(pl).length >= G.EX_SLOTS) return this.say(pl, `You can have ${G.EX_SLOTS} offers up at once. Cancel one first.`, "bad");
      if (side === "sell") {
        const have = haveAll(k); if (have < qty) return this.say(pl, `You only have ${have.toLocaleString()} ${G.ITEMS[k].name.toLowerCase()} (bag and bank).`, "bad");
        takeItems(k, qty);
      } else {
        const cost = qty * price; if (cashAll() < cost) return this.say(pl, `That needs ${G.fmtCash(cost)}. You have ${G.fmtCash(cashAll())} (bag and bank).`, "bad");
        payCash(cost);
      }
      const o = place(side, k, qty, price, m.op === "buynow");
      if (m.op === "buynow") return this.say(pl, o.done ? `You buy ${o.done.toLocaleString()} × ${G.ITEMS[k].name}. It's in your bank.` : "Somebody got there first: nothing left at that price.", o.done ? "good" : "bad");
      return this.say(pl, `Offer up: ${side === "sell" ? "selling" : "buying"} ${qty.toLocaleString()} × ${G.ITEMS[k].name} at ${G.fmtCash(price)} each.`, "good");
    }
    const o = this.ex.orders.find((x) => x.id === (m.id | 0) && x.owner === pl.id); if (!o) return;
    if (m.op === "cancel" && o.open) {
      o.open = false; o.closedAt = now;
      const left = o.qty - o.done;
      if (o.side === "sell") o.box.items += left; else o.box.cash += left * o.price;
      this.exDeliver(pl);
      this.say(pl, "Offer taken down. What was left is back in your bank.");
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
      const nm = G.ITEMS[o.k].name;
      for (const side of [sell, buy]) {
        if (side.done >= side.qty) { side.open = false; side.closedAt = Date.now(); }
        const p = this.pls.get(side.owner); if (p) touched.add(p);
        // the one who was waiting hears about it; the one who just clicked already knows
        if (side !== o) this.exNote(side.owner, side.side === "sell"
          ? `sold ${q.toLocaleString()} × ${nm} for ${G.fmtCash(gross - tax)}`
          : `bought ${q.toLocaleString()} × ${nm} at ${G.fmtCash(price)} each`);
      }
      if (o.done >= o.qty) break;
    }
    return [...touched];
  }

  /* ------------------------------------------------------------ the Casino: games of chance for tickets (never ZCoins)
     The server rolls, pays and announces; the page only animates what it's told. Bets come out of your bag. */
  /* hunger and thirst: the tables turn away anyone under the floor (and say why, once, not on every click) */
  tooEmpty(pl) {
    const why = G.tooEmpty(pl.C); if (!why) return false;
    pl.out.push({ type: "need", k: why, blocked: true }); this.say(pl, G.NEED_TEXT[why], "bad"); return true;
  }
  /* THE DAILY PRIZE WHEEL: one spin a Chicago day. The prize is decided and given here; the page only spins to it. */
  prizeSpin(pl) {
    const C = pl.C, day = G.chicagoDay(), last = C.spin;
    if (last?.day === day) return pl.out.push({ type: "prize", done: true, streak: last.streak | 0, i: last.i ?? null, text: last.text || null });   // what today's spin was, so the window can show it
    const streak = last?.day === G.dayBefore(day) ? (last.streak | 0) + 1 : 1, P = G.PRIZE, total = P.slices.reduce((a, s) => a + s.w, 0);
    let r = Math.random() * total, i = 0; for (; i < P.slices.length - 1; i++) { r -= P.slices[i].w; if (r < 0) break; }
    const p = P.slices[i];
    if (p.k && G.roomFor(C.inv, p.k) < p.n) return this.say(pl, "Your bag's too full for a prize. Make some room and spin again: it's still free.", "bad");
    C.spin = { day, streak, i, text: G.prizeText(p, streak) }; const cash = p.cash ? Math.round(p.cash * (1 + P.streakStep * Math.min(P.streakMax, streak - 1))) : 0;
    if (cash) this.cashTo(pl, cash); else this.give(pl, p.k, p.n);
    this.touch(pl); pl.out.push({ type: "prize", i, streak, text: G.prizeText(p, streak) });
    if ((p.cash || 0) >= 1000 || p.k === "chip_black") for (const q of this.pls.values()) q.out.push({ type: "casinonote", text: `🎡 ${pl.name} hit ${G.prizeText(p, streak)} on the Daily Prize Wheel!` });
  }
  /* THE WINNERS' WALL: today's five biggest single wins, kept across restarts. */
  fameToday() { const day = G.chicagoDay(); if (this.fame?.day !== day) this.fame = { day, rows: [] }; return this.fame; }
  fameWin(pl, game, profit) {
    if (!(profit >= G_FAME_MIN)) return; const F = this.fameToday();
    if (F.rows.length >= 5 && profit <= F.rows[F.rows.length - 1].profit) return;
    F.rows = [...F.rows, { name: pl.name, game, profit }].sort((a, b) => b.profit - a.profit).slice(0, 5);
    this.ctx.storage.put("fame", F).catch(() => {});
  }
  /* One bet's worth of everything: the player's effects are read FIRST (so the last bet of a dinner still counts), then
     the dinner and the drink each lose a bet, and hunger and thirst go down unless Well Fed. Returns the effects, which
     the bet keeps until it's settled. */
  fxTake(pl) {
    const C = pl.C, e = G.edgeOf(C);
    /* (v65: dinners and drinks run on minutes spent outside now: tickTimed counts them down, a bet does not) */
    if (!e.fed) for (const [k, n] of Object.entries(G.NEEDS.perBet)) C[k] = Math.max(0, G.needOf(C, k) - n * e.thrift);
    return e;
  }
  // a stake that goes over the normal limit uses up one of a High Roller's big bets
  bigBet(pl, before, after, def) {
    const C = pl.C, was = G.vipOf(C).i; C.wagered = (Number(C.wagered) || 0) + Math.max(0, after - before);
    const now = G.vipOf(C); if (now.i > was) { this.say(pl, `You've made ${now.name} VIP. Every table will take ${G.fmtCash(now.limit)} more from you, and everyone can see it by your name.`, "loot"); for (const p of this.pls.values()) if (p !== pl) p.out.push({ type: "casinonote", text: `⭐ ${pl.name} just made ${now.name} VIP.` }); }
    const base = G.baseBetOf(C, def); if (before <= base && after > base && (C.roller | 0) > 0) C.roller--; }
  // a lost stake: the angel's chance of all of it, else the insured share
  lossBack(pl, lost, e) {
    const back = G.backWith(lost, e, Math.random()); if (!back) return 0;
    this.say(pl, back >= lost ? `An angel's on your shoulder: your ${G.fmtCash(lost)} comes back.` : `Insurance: ${G.fmtCash(back)} of that comes back.`, "good"); return back;
  }
  cashTo(pl, n) { if (n > 0 && !this.give(pl, "tickets", n) && !this.bankAdd(pl, "tickets", n)) this.say(pl, "Your bag and bank are both full: those tickets are lost. Make some room!", "bad"); }
  bet(S, pl, m, now) {
    const g = String(m.g), game = G.GAMES[g]; if (!game || game.run) return;
    if (S.def.real?.[g]) return this.say(pl, `${S.def.real[g].name} on this floor plays for real ZCoins now. Click the table.`, "bad");
    if (!this.near(S, pl, g, 2)) return this.say(pl, `You need to be at the ${game.name.toLowerCase()} in the Casino.`, "bad");
    if (now - (pl.lastBet || 0) < G.CASINO.betMs) return;
    const amt = Math.floor(Number(m.amt)), have = G.cashIn(pl.C);
    if (!(amt >= G.minBetOf(S.def) && amt <= G.maxBetOf(pl.C, S.def))) return this.say(pl, `Bets here are ${G.fmtCash(G.minBetOf(S.def))} to ${G.fmtCash(G.maxBetOf(pl.C, S.def))}.`, "bad");
    const onHouse = Math.min(amt, pl.C.free | 0);   // a free-play chip covers this much of the stake
    if (have < amt - onHouse) return this.say(pl, `You only have ${G.fmtCash(have)} in your bag.`, "bad");
    if (this.tooEmpty(pl)) return;
    let mult = 0, res = {};
    if (g === "cointable") {
      const pick = m.pick === "tails" ? "tails" : "heads", side = Math.random() < 0.5 ? "heads" : "tails";
      res = { pick, side }; if (side === pick) mult = G.FLIP_PAYS;
    } else if (g === "dicetable") {
      const target = Math.max(G.DICE.min, Math.min(G.DICE.max, Math.floor(Number(m.pick)) || 50)), roll = 1 + Math.floor(Math.random() * 100);
      res = { target, roll }; if (roll < target) mult = G.diceMult(target);
    } else if (g === "wheel") {
      const pick = ["red", "black", "gold"].includes(m.pick) ? m.pick : "red", angle = Math.floor(Math.random() * 3600) / 10, color = G.wheelColor(angle);
      res = { pick, angle, color }; if (color === pick) mult = G.WHEEL.pays[pick];
    } else if (g === "plinko") {
      const path = Array.from({ length: G.PLINKO.rows }, () => (Math.random() < 0.5 ? 0 : 1)), bucket = path.reduce((a, b) => a + b, 0);
      res = { path, bucket }; mult = G.PLINKO.pays[bucket];
    } else if (g === "scratch") {
      // the card is decided first, then laid out to match it: exactly three of the winner, and never three of anything else
      let x = Math.random() * 1000, prize = null; for (const s of G.SCRATCH) { if ((x -= s.w) < 0) { prize = s; break; } }
      const pool = []; for (const s of G.SCRATCH) if (s !== prize) pool.push(s.k, s.k);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const grid = prize ? [prize.k, prize.k, prize.k, ...pool.slice(0, 6)] : pool.slice(0, 9);
      for (let i = grid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [grid[i], grid[j]] = [grid[j], grid[i]]; }
      res = { grid, prize: prize ? prize.k : null }; if (prize) mult = prize.x;
    } else {
      const W = G.REELS.reduce((a, r) => a + r.w, 0), spin = () => { let x = Math.random() * W; for (const r of G.REELS) { if ((x -= r.w) < 0) return r.k; } return G.REELS[0].k; };
      const reels = [spin(), spin(), spin()]; res = { reels }; mult = G.slotsPay(reels);
    }
    let jackpot = 0;
    if (g === "slots") {
      const J = this.jack; if (J.pot < G.JACKPOT.cap) J.pot = Math.min(G.JACKPOT.cap, J.pot + amt * G.JACKPOT.slice);
      if (res.reels.every((r) => r === "seven")) {
        jackpot = Math.floor(J.pot * G.jackpotShare(amt)); J.pot -= jackpot;
        if (J.pot < G.JACKPOT.seed) J.pot = G.JACKPOT.seed;   // the house tops it back up
        J.wins = [{ name: pl.name, amt: jackpot, at: now }, ...(J.wins || [])].slice(0, 10);
      }
      this.jackDirty = true; res.pot = Math.floor(J.pot);
    }
    pl.lastBet = now; this.tourStep(pl, "play"); this.bigBet(pl, 0, amt, S.def); const e = this.fxTake(pl);
    G.takeInv(pl.C.inv, "tickets", amt - onHouse); if (onHouse) { pl.C.free = 0; res.free = onHouse; }
    const lucky = (pl.C.luck | 0) > 0; if (lucky) pl.C.luck--;
    const plain = Math.floor(amt * mult), boosted = G.payWith(plain, amt, e, lucky), own = amt - onHouse;
    const ret = Math.max(0, boosted - onHouse), saved = ret < own ? this.lossBack(pl, own - ret, e) : 0, payout = ret + saved + jackpot;   /* the house's chip goes back to the house; what it won is yours */
    res.lucky = boosted > plain ? boosted - plain : null; res.saved = saved || null; res.luck = pl.C.luck | 0;
    this.fameWin(pl, game.name, payout - own);
    if (payout > own) pl.lastWin = { amt: payout - own, at: now }; else if (payout < own) pl.lastLoss = { amt: own - payout, at: now };
    this.cashTo(pl, payout);
    this.touch(pl);
    pl.out.push({ type: "gameResult", g, bet: amt, mult, payout, jackpot, ...res });
    if (jackpot) {
      // a jackpot is written at once, with the winner, so a crash can't pay it twice or lose it
      this.persist(pl).catch(() => {}); this.ctx.storage.put("jackpot", this.jack).then(() => { this.jackDirty = false; }).catch(() => {});
      for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: `🎰💰 JACKPOT! ${pl.name} hit three sevens and won ${G.fmtCash(jackpot)} from the jackpot!` });
    }
    // the room hears about a good win; everyone hears about a great one
    if (mult >= G.CASINO.roomWin && payout - amt > 0) {
      const text = `${pl.name} won ${G.fmtCash(payout)} on ${game.name} (${mult}×)!`;
      const world = mult >= G.CASINO.worldWin;
      for (const p of this.pls.values()) if (world || p.C.scene === S.key) p.out.push({ type: "casinonote", text: world ? `🎰 ${text}` : text });
    }
  }

  /* ------------------------------------------------------------ the Fight Pit: one fight for the whole room
     The same shape as roulette. Bets are open for FIGHTS.betMs; then the winner is decided by ONE random number against
     the posted chance, a script of blows is written to fit it, and the room watches for fightMs; then everyone is paid
     and the next pair comes out. Bets are paid when the fight ENDS (so your tickets doesn't give the result away), which
     is why this ticks even when the room is empty and why a restart mid-fight pays out on the spot. */
  fightPair() {
    const pool = G.FIGHTS.pool, a = pick(pool); let b = pick(pool), n = 0; while ((b === a) && n++ < 9) b = pick(pool);
    const tt = [...G.FIGHTS.titles].sort(() => Math.random() - 0.5);
    return [{ t: a, title: tt[0] }, { t: b, title: tt[1] }];
  }
  fightState(S, now = Date.now()) { return S.fight ||= { round: 1, phase: "bet", endsAt: now + G.FIGHTS.betMs, f: this.fightPair(), bets: [], hist: [], last: null }; }
  fightView(S, p, now = Date.now()) {
    const F = this.fightState(S, now), odds = G.fightOdds(F.f[0].t, F.f[1].t);
    return { type: "fight", round: F.round, phase: F.phase, left: Math.max(0, F.endsAt - now), f: F.f, pays: odds.pays, p: odds.p, hist: F.hist, last: F.last,
      script: F.phase === "fight" ? F.script : null, startedAt: F.startedAt || 0, winner: F.phase === "result" ? F.winner : null,
      bets: F.bets.map((b) => ({ name: b.name, side: b.side, amt: b.amt, me: b.id === p.id })), luck: p.C.luck | 0 };
  }
  fightSend(S) { for (const p of this.playersIn(S)) p.out.push(this.fightView(S, p)); }
  fightOp(S, pl, m, now) {
    if (S.key !== "fightpit") return; const F = this.fightState(S, now);
    if (m.op === "open") return pl.out.push(this.fightView(S, pl, now));
    if (m.op === "clear") {
      if (F.phase !== "bet") return; const back = F.bets.filter((b) => b.id === pl.id).reduce((a, b) => a + b.amt, 0); if (!back) return;
      F.bets = F.bets.filter((b) => b.id !== pl.id); this.cashTo(pl, back); this.touch(pl); this.say(pl, `Bets taken back: ${G.fmtCash(back)}.`); return this.fightSend(S);
    }
    if (m.op !== "bet") return;
    if (F.phase !== "bet") return this.say(pl, "No more bets: they're already at it.", "bad");
    const side = m.side === 1 ? 1 : 0, amt = Math.floor(Number(m.amt)), mine = F.bets.filter((b) => b.id === pl.id), staked = mine.reduce((a, b) => a + b.amt, 0);
    if (!(amt >= 1)) return;
    if (mine.some((b) => b.side !== side)) return this.say(pl, "You've already backed the other one. Take your bet back first if you've changed your mind.", "bad");
    const top = G.FIGHTS.maxStake - G.CASINO.maxBet + G.maxBetOf(pl.C);
    if (staked + amt > top) return this.say(pl, `Up to ${G.fmtCash(top)} a fight. You've got ${G.fmtCash(staked)} down.`, "bad");
    if (G.cashIn(pl.C) < amt) return this.say(pl, `You only have ${G.fmtCash(G.cashIn(pl.C))} in your bag.`, "bad");
    if (this.tooEmpty(pl)) return;
    if (!staked) (F.fx ||= {})[pl.id] = this.fxTake(pl);
    this.bigBet(pl, staked, staked + amt);
    G.takeInv(pl.C.inv, "tickets", amt); this.touch(pl); this.tourStep(pl, "play");
    if (mine[0]) mine[0].amt += amt; else F.bets.push({ id: pl.id, name: pl.name, side, amt });
    this.fightSend(S);
  }
  fightTick(S, now) {
    const F = this.fightState(S, now); if (now < F.endsAt) return;
    if (F.phase === "bet") {
      const odds = G.fightOdds(F.f[0].t, F.f[1].t), winner = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 < odds.p[0] ? 0 : 1, loser = 1 - winner;
      // the blows, written to fit: the loser's hundred points all go, the winner keeps some. A blow every second and a
      // half or so, a quarter of them misses, and the lead is allowed to change hands: it's a long fight (FIGHTS.fightMs)
      const n = 22 + Math.floor(Math.random() * 6), hp = [100, 100], keep = 6 + Math.floor(Math.random() * 50), script = [];
      let lossLeft = 100, winLeft = 100 - keep;
      for (let i = 0; i < n; i++) {
        const last = i === n - 1, early = i < n * 0.6, by = last ? winner : (Math.random() < (early ? 0.45 : 0.6) ? winner : loser), on = 1 - by, miss = !last && Math.random() < 0.25;
        let dmg = miss ? 0 : on === loser ? (last ? lossLeft : Math.min(lossLeft - 1, Math.round(lossLeft / (n - i) * (0.5 + Math.random() * 1.4)))) : Math.min(winLeft, Math.round(winLeft / Math.max(1, n - i - 1) * (0.5 + Math.random() * 1.6)));
        dmg = Math.max(0, dmg); if (on === loser) lossLeft -= dmg; else winLeft -= dmg; hp[on] -= dmg;
        script.push({ at: 900 + Math.round(i * (G.FIGHTS.fightMs - 3200) / (n - 1)), by, dmg, hp: [...hp] });
      }
      const luckyIds = new Set(); for (const id of new Set(F.bets.map((b) => b.id))) { const p = this.pls.get(id); if (p && (p.C.luck | 0) > 0) { p.C.luck--; luckyIds.add(id); this.touch(p); } }
      Object.assign(F, { phase: "fight", winner, script, startedAt: now, pays: odds.pays, lucky: [...luckyIds], endsAt: now + G.FIGHTS.fightMs });
      return this.fightSend(S);
    }
    if (F.phase === "fight") { this.fightPay(S, F); Object.assign(F, { phase: "result", endsAt: now + G.FIGHTS.showMs }); return this.fightSend(S); }
    Object.assign(F, { round: F.round + 1, phase: "bet", f: this.fightPair(), bets: [], script: null, winner: null, startedAt: 0, endsAt: now + G.FIGHTS.betMs });
    this.fightSend(S);
  }
  fightPay(S, F) {
    const w = F.winner, name = (f) => `${G.MOBS[f.t].name} ${f.title}`, wins = [];
    for (const b of F.bets) {
      if (b.side !== w) continue;
      const mult = F.pays[w], payout = G.payWith(Math.floor(b.amt * mult), b.amt, F.fx?.[b.id], F.lucky?.includes(b.id)); wins.push({ name: b.name, payout, mult });
      const p = this.pls.get(b.id); if (p) { this.cashTo(p, payout); p.lastWin = { amt: payout - b.amt, at: Date.now() }; this.fameWin(p, "the Fight Pit", payout - b.amt); this.touch(p); } else this.creditOffline(b.id, payout);
    }
    for (const b of F.bets) {   // the losers: insurance, and the odd angel
      if (b.side === w) continue; const p = this.pls.get(b.id), e = F.fx?.[b.id]; if (!e) continue;
      const back = p ? this.lossBack(p, b.amt, e) : G.backWith(b.amt, e, Math.random());
      if (p) { this.cashTo(p, back); p.lastLoss = { amt: b.amt - back, at: Date.now() }; this.touch(p); } else if (back) this.creditOffline(b.id, back);
    }
    F.fx = {};
    const text = `${name(F.f[w])} beats ${name(F.f[1 - w])}. ${wins.length ? `Paid: ${wins.map((x) => `${x.name} +${x.payout.toLocaleString()}`).join(", ")}.` : F.bets.length ? "Nobody had the winner." : "Nobody had money on it."}`;
    for (const p of this.playersIn(S)) p.out.push({ type: "casinonote", text: `Fight Pit: ${text}` });
    for (const x of wins) if (x.mult >= G.FIGHTS.bigWin && x.payout >= 200) for (const p of this.pls.values()) if (p.C.scene !== S.key) p.out.push({ type: "casinonote", text: `🥊 ${x.name} backed ${name(F.f[w])} at ${x.mult}× in the Fight Pit and won ${G.fmtCash(x.payout)}!` });
    F.last = { winner: w, f: F.f, wins: wins.map((x) => ({ name: x.name, payout: x.payout })) }; F.hist = [{ t: F.f[w].t, mult: F.pays[w] }, ...F.hist].slice(0, 10); F.bets = [];
  }
  // a restart: open bets go back; a fight already decided is paid on the spot
  fightRefundAll(why) {
    const S = this.scenes.get("fightpit"), F = S?.fight; if (!F || !F.bets.length) return;
    if (F.phase === "fight") return this.fightPay(S, F);
    if (F.phase !== "bet") return;
    for (const b of F.bets) { const p = this.pls.get(b.id); if (p) { this.cashTo(p, b.amt); this.touch(p); this.say(p, why); } else this.creditOffline(b.id, b.amt); }
    F.bets = [];
  }

  /* Higher or Lower and Mines are RUNS: the stake is taken at the start, every step is decided here, and the run
     lives on the character (C.runs), so closing the window, walking off or a restart never loses it. What the page
     is told never includes what it could cheat with: not the next card, not where the bombs are (until it's over). */
  runView(pl, g) {
    const r = pl.C.runs?.[g]; if (!r) return { type: "run", g, run: null, luck: pl.C.luck | 0 };
    const run = g === "hilo" ? { stake: r.stake, card: r.card, suit: r.suit, mult: r.mult, cards: r.cards, rights: r.rights, lucky: r.lucky, cash: this.runCash(g, r) }
      : { stake: r.stake, mines: r.mines, open: r.open, mult: G.minesMult(r.mines, r.open.length), next: G.minesMult(r.mines, r.open.length + 1), top: G.minesTop(r.mines), lucky: r.lucky, cash: this.runCash(g, r) };
    return { type: "run", g, run, luck: pl.C.luck | 0 };
  }
  runCash(g, r) {
    const plain = g === "hilo" ? (r.rights ? G.hiloPays(r.stake, r.mult) : 0) : (r.open.length ? Math.floor(r.stake * G.minesMult(r.mines, r.open.length)) : 0);
    return G.payWith(plain, r.stake, r.fx, r.lucky);
  }
  runEnd(S, pl, g, how, extra = {}) {
    const r = pl.C.runs[g], saved = how === "bust" ? this.lossBack(pl, r.stake, r.fx) : 0, payout = how === "cash" ? this.runCash(g, r) : how === "refund" ? r.stake : saved;
    this.fameWin(pl, G.GAMES[g].name, payout - r.stake);
    if (payout > r.stake) pl.lastWin = { amt: payout - r.stake, at: Date.now() }; else if (payout < r.stake) pl.lastLoss = { amt: r.stake - payout, at: Date.now() };
    const mult = g === "hilo" ? Math.min(G.HILO.maxMult, r.mult) : G.minesMult(r.mines, r.open.length);
    delete pl.C.runs[g]; this.cashTo(pl, payout); this.touch(pl);
    pl.out.push({ type: "run", g, run: null, luck: pl.C.luck | 0, over: { how, payout, stake: r.stake, mult: Math.round(mult * 100) / 100, ...(g === "mines" ? { bombs: r.bombs, open: r.open, mines: r.mines } : { card: r.card, suit: r.suit }), ...extra } });
    if (how === "cash" && mult >= G.CASINO.roomWin && payout > r.stake) {
      const text = `${pl.name} won ${G.fmtCash(payout)} on ${G.GAMES[g].name} (${Math.round(mult * 100) / 100}×)!`, world = mult >= G.CASINO.worldWin;
      for (const p of this.pls.values()) if (world || p.C.scene === S.key) p.out.push({ type: "casinonote", text: world ? `🎰 ${text}` : text });
    }
  }
  run(S, pl, m, now) {
    const g = String(m.g), game = G.GAMES[g]; if (!game?.run) return;
    const C = pl.C; C.runs = C.runs && typeof C.runs === "object" ? C.runs : {};
    const r = C.runs[g], op = String(m.op);
    if (op === "state") return pl.out.push(this.runView(pl, g));
    if (now - (pl.lastBet || 0) < 250) return; pl.lastBet = now;
    if (op === "start") {
      if (r) return pl.out.push(this.runView(pl, g));
      if (S.def.real?.[g]) return this.say(pl, `${S.def.real[g].name} on this floor plays for real ZCoins now. Click the table.`, "bad");
      if (!this.near(S, pl, g, 2)) return this.say(pl, `You need to be at the ${game.name} table in the Casino.`, "bad");
      const amt = Math.floor(Number(m.amt)), have = G.cashIn(C);
      if (!(amt >= G.minBetOf(S.def) && amt <= G.maxBetOf(C, S.def))) return this.say(pl, `Bets here are ${G.fmtCash(G.minBetOf(S.def))} to ${G.fmtCash(G.maxBetOf(C, S.def))}.`, "bad");
      if (have < amt) return this.say(pl, `You only have ${G.fmtCash(have)} in your bag.`, "bad");
      if (this.tooEmpty(pl)) return;
      G.takeInv(C.inv, "tickets", amt); this.tourStep(pl, "play"); this.bigBet(pl, 0, amt, S.def); const fx = this.fxTake(pl);
      const lucky = (C.luck | 0) > 0; if (lucky) C.luck--;
      if (g === "hilo") C.runs[g] = { stake: amt, lucky, fx, card: 1 + Math.floor(Math.random() * 13), suit: Math.floor(Math.random() * 4), mult: 1, cards: 1, rights: 0 };
      else {
        const mines = Math.max(G.MINES.min, Math.min(G.MINES.max, Math.floor(Number(m.mines)) || 3)), all = Array.from({ length: G.MINES.tiles }, (_, i) => i);
        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
        C.runs[g] = { stake: amt, lucky, fx, mines, bombs: all.slice(0, mines).sort((a, b) => a - b), open: [] };
      }
      this.touch(pl); return pl.out.push(this.runView(pl, g));
    }
    if (!r) return pl.out.push(this.runView(pl, g));
    if (op === "cash") { if (!this.runCash(g, r)) return; return this.runEnd(S, pl, g, "cash"); }
    if (g === "hilo" && op === "call") {
      const call = m.call === "lower" ? "lower" : "higher", f = G.hiloFactor(r.card, call); if (!f) return;
      const next = 1 + Math.floor(Math.random() * 13), suit = Math.floor(Math.random() * 4), from = r.card;
      const won = call === "higher" ? next > from : next < from, tie = next === from;
      r.card = next; r.suit = suit; r.cards++;
      if (!won && !tie) return this.runEnd(S, pl, g, "bust", { from, call });
      if (won && f > 1) { r.mult *= f; r.rights++; }
      this.touch(pl);
      if (r.mult >= G.HILO.maxMult || r.cards >= G.HILO.maxCards) return this.runEnd(S, pl, g, r.rights ? "cash" : "refund", { from, call, auto: true });
      return pl.out.push({ ...this.runView(pl, g), step: { from, call, tie } });
    }
    if (g === "mines" && op === "pick") {
      const i = Math.floor(Number(m.i)); if (!(i >= 0 && i < G.MINES.tiles) || r.open.includes(i)) return;
      if (r.bombs.includes(i)) return this.runEnd(S, pl, g, "bust", { hit: i });
      r.open.push(i); this.touch(pl);
      if (r.open.length >= G.minesTop(r.mines)) return this.runEnd(S, pl, g, "cash", { auto: true });
      return pl.out.push({ ...this.runView(pl, g), step: { i } });
    }
  }

  /* ------------------------------------------------------------ roulette: one table, one spin for everyone
     Bets are open for ROULETTE.betMs; then the ball rolls (spinMs) and every bet is settled AT ONCE, the moment the
     number is drawn, so nobody can leave with a bet unpaid. The room is told the number and the winners when the
     ball stops. Bets come out of the bag; winnings go to the bag (or bank). */
  roulState(S, now = Date.now()) { return S.roulette ||= { round: 1, phase: "bet", endsAt: now + G.ROULETTE.betMs, bets: [], hist: [], last: null }; }
  roulView(S, p, now = Date.now()) {
    const R = this.roulState(S, now);
    return { type: "roul", round: R.round, phase: R.phase, left: Math.max(0, R.endsAt - now), hist: R.hist, last: R.last,
      result: R.phase === "spin" ? R.result : null,
      bets: R.bets.map((b) => ({ name: b.name, kind: b.kind, pick: b.pick, amt: b.amt, me: b.id === p.id })) };
  }
  roulSendTo(S, p) { p.out.push(this.roulView(S, p)); }
  roulSend(S) { for (const p of this.playersIn(S)) this.roulSendTo(S, p); }
  roulOp(S, pl, m, now) {
    if (S.key !== "roulette") return;
    const R = this.roulState(S, now);
    if (m.op === "open") return this.roulSendTo(S, pl);
    if (m.op === "clear") {
      if (R.phase !== "bet") return;
      const mine = R.bets.filter((b) => b.id === pl.id), back = mine.reduce((a, b) => a + b.amt, 0); if (!back) return;
      R.bets = R.bets.filter((b) => b.id !== pl.id); this.cashTo(pl, back); this.touch(pl);
      this.say(pl, `Bets taken back: ${G.fmtCash(back)}.`); return this.roulSend(S);
    }
    if (m.op !== "bet") return;
    if (R.phase !== "bet") return this.say(pl, "No more bets: the ball's rolling.", "bad");
    const kind = String(m.kind), def = G.ROULETTE_BETS[kind]; if (!def) return;
    const pick = kind === "num" ? Math.floor(Number(m.pick)) : null; if (kind === "num" && !(pick >= 0 && pick <= 36)) return;
    const amt = Math.floor(Number(m.amt)), staked = R.bets.filter((b) => b.id === pl.id).reduce((a, b) => a + b.amt, 0);
    if (!(amt >= 1)) return;
    const top = G.ROULETTE.maxStake - G.CASINO.maxBet + G.maxBetOf(pl.C);
    if (staked + amt > top) return this.say(pl, `Up to ${G.fmtCash(top)} a spin. You've got ${G.fmtCash(staked)} down.`, "bad");
    if (G.cashIn(pl.C) < amt) return this.say(pl, `You only have ${G.fmtCash(G.cashIn(pl.C))} in your bag.`, "bad");
    if (this.tooEmpty(pl)) return;
    if (!staked) (R.fx ||= {})[pl.id] = this.fxTake(pl);   // one spin, however many chips
    this.bigBet(pl, staked, staked + amt);
    G.takeInv(pl.C.inv, "tickets", amt); this.touch(pl); this.tourStep(pl, "play");
    const same = R.bets.find((b) => b.id === pl.id && b.kind === kind && b.pick === pick);
    if (same) same.amt += amt; else R.bets.push({ id: pl.id, name: pl.name, kind, pick, amt });
    this.roulSend(S);
  }
  rouletteTick(S, now) {
    const R = this.roulState(S, now);
    if (now < R.endsAt) return;
    if (R.phase === "bet") {
      if (!R.bets.length) { R.endsAt = now + G.ROULETTE.betMs; return this.roulSend(S); }   // nobody's in: a fresh window
      // draw the number and settle every bet now, while everyone's still here
      const n = crypto.getRandomValues(new Uint32Array(1))[0] % 37, wins = [];
      // a spin uses up one lucky bet for everyone at the table who has any; their wins pay the bonus
      const luckyIds = new Set(); for (const id of new Set(R.bets.map((b) => b.id))) { const p = this.pls.get(id); if (p && (p.C.luck | 0) > 0) { p.C.luck--; luckyIds.add(id); this.touch(p); } }
      for (const b of R.bets) {
        const def = G.ROULETTE_BETS[b.kind];
        if (!def.wins(n, b.pick)) {   // a losing chip: insurance, and the odd angel
          const q = this.pls.get(b.id), e = R.fx?.[b.id]; if (!e) continue;
          const back = q ? this.lossBack(q, b.amt, e) : G.backWith(b.amt, e, Math.random());
          if (q) { this.cashTo(q, back); this.touch(q); } else if (back) this.creditOffline(b.id, back);
          continue;
        }
        const payout = G.payWith(b.amt * def.pays, b.amt, R.fx?.[b.id], luckyIds.has(b.id)); wins.push({ name: b.name, id: b.id, payout, label: G.rouletteLabel(b.kind, b.pick), mult: def.pays });
        const p = this.pls.get(b.id);
        if (p) { this.cashTo(p, payout); this.fameWin(p, "Roulette", payout - b.amt); this.touch(p); } else this.creditOffline(b.id, payout);
      }
      R.fx = {};
      Object.assign(R, { phase: "spin", result: n, wins, endsAt: now + G.ROULETTE.spinMs });
      return this.roulSend(S);
    }
    // the ball has stopped: tell the room, then open the next round
    const n = R.result, col = G.rouletteColor(n), wins = R.wins || [];
    const total = new Map(); for (const w of wins) total.set(w.name, (total.get(w.name) || 0) + w.payout);
    const text = `${n} ${col}. ${total.size ? `Winners: ${[...total].map(([nm, v]) => `${nm} +${v.toLocaleString()}`).join(", ")}.` : "No winners this spin."}`;
    for (const p of this.playersIn(S)) p.out.push({ type: "casinonote", text: `Roulette: ${text}` });
    for (const w of wins) if (w.mult >= G.ROULETTE.bigWin) for (const p of this.pls.values()) if (p.C.scene !== S.key) p.out.push({ type: "casinonote", text: `🎡 ${w.name} hit ${w.label} on roulette for ${G.fmtCash(w.payout)}!` });
    R.last = { n, col, wins: wins.map((w) => ({ name: w.name, payout: w.payout, label: w.label })) };
    R.hist = [n, ...R.hist].slice(0, 14);
    Object.assign(R, { round: R.round + 1, phase: "bet", bets: [], result: null, wins: null, endsAt: now + G.ROULETTE.betMs });
    this.roulSend(S);
  }
  // hand every open bet back (a restart during betting); settled spins are already paid
  roulRefundAll(why) {
    const S = this.scenes.get("roulette"), R = S?.roulette; if (!R || R.phase !== "bet" || !R.bets.length) return;
    for (const b of R.bets) { const p = this.pls.get(b.id); if (p) { this.cashTo(p, b.amt); this.touch(p); this.say(p, why); } else this.creditOffline(b.id, b.amt); }
    R.bets = [];
  }
  // someone who left before a spin still gets paid: straight into their stored bank
  async creditOffline(id, n) {
    try {
      const key = `char:${id}`, c = await this.ctx.storage.get(key); if (!c) return;
      c.bank ||= []; const b = c.bank.find((x) => x.k === "tickets"); if (b) b.n += n; else c.bank.push({ k: "tickets", n });
      await this.ctx.storage.put(key, c);
    } catch (e) { /* the bet is lost only if storage itself fails */ }
  }

  /* ------------------------------------------------------------ the House Tour (see G.TOUR) */
  tourStep(pl, id) {   // move on if `id` is the step they're on
    const t = pl.C.tour; if (!t || G.tourOf(pl.C)?.id !== id) return false;
    t.step++; this.touch(pl);
    const next = G.tourOf(pl.C); if (next) this.say(pl, `House Tour: ${next.text}.`, "good");
    return true;
  }
  tourEvent(pl, type, d) {
    const t = pl.C.tour; if (G.tourOf(pl.C)?.id !== "job") return;
    if (type === "gather" && G.ITEMS[d.k]?.heal) t.fish = Math.min(G.TOUR_JOB.fish, (t.fish || 0) + (d.n || 1));
    else if (type === "kill" && d.mob === "chicken") t.chickens = Math.min(G.TOUR_JOB.chickens, (t.chickens || 0) + 1);
    else return;
    this.touch(pl);
    if (t.fish >= G.TOUR_JOB.fish || t.chickens >= G.TOUR_JOB.chickens) this.tourStep(pl, "job");
  }
  tourOp(S, pl, m) {
    const C = pl.C, dex = S.npcs.find((n) => n.name === "Dex the Dealer");
    if (!dex || G.cheb(pl, dex) > 4) return this.say(pl, "Dex is behind the bar in the casino.", "bad");
    if (m.op === "start" && (!C.tour || C.tour.step >= G.TOUR.length)) { C.tour = { step: 0, logs: 0, chickens: 0, again: !!C.tour }; this.touch(pl); }
    const step = G.tourOf(C)?.id;
    if (step === "meet") { if (!C.tour.again) this.cashTo(pl, G.TOUR_CHIP); this.tourStep(pl, "meet"); }
    else if (step === "paid") { if (!C.tour.again) { this.cashTo(pl, G.TOUR_PAY); if (G.roomFor(C.inv, G.TOUR_GIFT) > 0) G.addInv(C.inv, G.TOUR_GIFT, 1); } this.tourStep(pl, "paid"); this.say(pl, C.tour.again ? "That's the tour. You know the way." : `Dex pays you ${G.fmtCash(G.TOUR_PAY)} and a lucky clover. Click the clover in your bag: your next bets pay more. There's more luck out both arches.`, "good"); }
  }

  /* ------------------------------------------------------------ daily tasks (the board in the Casino) */
  dailyState(pl) {
    const C = pl.C, day = G.chicagoDay();
    if (!C.daily || C.daily.day !== day) { C.daily = { day, tasks: G.dailyFor(C, pl.id, day).map((id) => ({ id, got: 0, claimed: false })) }; this.touch(pl); }
    // a job that can no longer be done (its rocks or trees left the world mid-day) is swapped for one that can; a claimed one is left alone
    if (C.daily.tasks.some((t) => !t.claimed && !G.OPEN_DAILY.has(t.id))) {
      const have = new Set(C.daily.tasks.filter((t) => t.claimed || G.OPEN_DAILY.has(t.id)).map((t) => t.id));
      const spare = G.DAILY.filter((d) => G.OPEN_DAILY.has(d.id) && !have.has(d.id) && (!d.req || G.lvlOf(C, d.req.skill) >= d.req.lvl)).map((d) => d.id);
      C.daily.tasks = C.daily.tasks.map((t) => (t.claimed || G.OPEN_DAILY.has(t.id) ? t : spare.length ? { id: spare.shift(), got: 0, claimed: false } : null)).filter(Boolean); this.touch(pl);
    }
    return C.daily;
  }
  dailySend(pl) { const D = this.dailyState(pl); pl.out.push({ type: "daily", day: D.day, tasks: D.tasks }); }
  dailyEvent(pl, type, d) {
    const what = type === "cook" || type === "craft" ? "make" : type;
    if (what !== "gather" && what !== "kill" && what !== "make") return;
    const D = this.dailyState(pl);
    for (const t of D.tasks) {
      const def = G.dailyDef(t.id); if (!def || t.claimed || t.got >= def.n) continue;
      if (def.what !== what || (what === "kill" ? d.mob : d.k) !== def.k) continue;
      t.got = Math.min(def.n, t.got + (d.n || 1)); this.touch(pl);
      if (t.got >= def.n) this.say(pl, `Daily task done! Claim your ${G.fmtCash(def.cash)} at the task board in the Casino.`, "good");
    }
  }
  dailyOp(S, pl, m) {
    if (m.op === "open") return this.dailySend(pl);
    if (m.op !== "claim" || !this.near(S, pl, "notice", 2)) return;
    const D = this.dailyState(pl), t = D.tasks.find((x) => x.id === m.id), def = t && G.dailyDef(t.id);
    if (!def || t.claimed || t.got < def.n) return;
    t.claimed = true; this.tixTo(pl, def.cash); this.touch(pl);
    this.say(pl, `You're paid ${G.fmtTix(def.cash)} for the day's work. The Prize Counter's in the middle of the floor.`, "good");
    this.dailySend(pl);
  }

  /* ------------------------------------------------------------ trading face to face
     Both players put up items and tickets, both accept, then both confirm on a second screen. Nothing moves until the
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
      if (m.op === "add") { const k = String(m.k); if (!G.ITEMS[k] || k === "tickets") return; const have = G.countItems(C, [k]) - (mine.items[k] || 0); const n = Math.max(0, Math.min(have, m.n === "all" ? have : Math.floor(Number(m.n)) || 1)); if (n) mine.items[k] = (mine.items[k] || 0) + n; }
      if (m.op === "remove") delete mine.items[String(m.k)];
      if (m.op === "cash") { mine.cash = 0; this.say(pl, "Tickets can't change hands. Trade items instead."); }   /* (tickets stay on you: see bankOp) */
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
      if (give.cash) G.takeInv(inv, "tickets", give.cash);
      let over = 0;
      for (const [k, n] of Object.entries(get.items)) over += G.addInv(inv, k, n);
      if (get.cash) over += G.addInv(inv, "tickets", get.cash);
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
      case "respin": C.spin = null; this.touch(pl); return note("Your Daily Prize Wheel spin is free again (your streak starts over).");
      // the House Ruby's held exchanges: list them, and let one go (after looking at the site's Wallet tab to see whether it paid)
      case "dexlist": return this.ctx.storage.list({ prefix: "dex:", limit: 50 }).then((all) => note(all.size ? [...all].map(([k, r]) => `${k} · ${r.name} · ${r.op} ${r.zc} ZC · ${r.back ? `${r.back.n} ${r.back.k}` : G.fmtCash(r.cash || 0)} held · ${new Date(r.at).toISOString().slice(0, 16)}${r.stuck ? " · STUCK" : ""}`).join(" | ") : "No held exchanges."));
      case "dexrelease": { const key = String(m.key || ""); if (!key.startsWith("dex:")) return; return this.ctx.storage.get(key).then(async (r) => { if (!r) return note("No such record."); await this.ctx.storage.delete(key); const who = key.split(":").slice(1, -1).join(":"), p = this.pls.get(who); if (m.refund) await this.dexRefund(p || { id: who, left: true }, r); note(`Released ${key}${m.refund ? ", what it took given back" : " (it paid: nothing given back)"}.`); }); }
      case "heal": C.hp = G.maxHpOf(C); this.touch(pl); return note("Healed.");
      case "god": pl.god = !pl.god; this.touch(pl); return note(pl.god ? "God mode on: nothing can hurt you." : "God mode off.");
      case "tp": { const key = String(m.scene); if (!G.SCENES[key]) return; this.moveToScene(pl, key, null, Number.isInteger(m.x) && Number.isInteger(m.y) ? { x: m.x, y: m.y } : null); return note(`Teleported to ${G.SCENES[key].name}.`); }
      case "quest": { const k = String(m.k), state = String(m.state); if (!G.QUESTS[k] || !["new", "active", "done"].includes(state)) return; if (state === "new") delete C.qs[k]; else C.qs[k] = { state, n: 0 }; this.touch(pl); return note(`${G.QUESTS[k].name} set to ${state}.`); }
      case "resetquests": C.qs = {}; this.touch(pl); return note("All quests reset.");
      case "resetscene": { this.scenes.delete(S.key); const S2 = this.scene(S.key); this.placeSafely(S2, pl); return note(`${S.def.name} reset: monsters, trees, rocks and bots are back.`); }
      case "reset": { const settings = C.settings; pl.C = G.freshChar(); pl.C.settings = settings; pl.x = pl.C.x; pl.y = pl.C.y; this.moveToScene(pl, pl.C.scene, null, { x: pl.x, y: pl.y }); this.touch(pl); return note("Character reset to a brand-new one."); }
      case "save": pl.needSave = true; this.persist(pl); return note("Saved.");
      case "saveall": return void this.saveAll().then((r) => note(`Saved ${r.saved} character${r.saved === 1 ? "" : "s"} and the Exchange.`));
      case "restart": {
        if (String(m.n) === "cancel") { const was = !!this.restartAt; this.restartAt = 0; this.warned = null; if (was) this.tellAll("The restart is called off. Carry on.", "good"); return note(was ? "Restart cancelled." : "No restart was planned."); }
        const secs = Math.max(0, Math.min(3600, Math.trunc(Number(m.n)) || 120));
        this.planRestart(secs);
        return note(`Restart announced: ${secs}s. Deploy once everyone is saved.`);
      }
      case "stats": {
        this.accrue(pl);
        const st = pl.C.stats; if (!st) return note("No stats on this character.");
        const top = (m, n = 5) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
        note(`save v${pl.C.v} | played ${Math.round(st.playMs / 60000)}m over ${st.sessions} session${st.sessions === 1 ? "" : "s"}`);
        note(`xp ${st.xpTotal.toLocaleString()} total, ${(st.xpDay[G.dayKeyCT()] || 0).toLocaleString()} today | cash in ${st.cashIn.toLocaleString()}, out ${st.cashOut.toLocaleString()}`);
        note(`kills: ${top(st.kills)} | deaths ${st.deaths} (pvp ${st.pvpDeaths}) | pvp kills ${st.pvpKills} | quests ${st.questsDone}`);
        return note(`gathered: ${top(st.gathered)} | looted: ${top(st.looted)} | cooked: ${top(st.cooked)} (burnt ${st.burnt})`);
      }
      // try a speed bonus without any gear (this session only; it isn't saved)
      case "speed": { pl.speedTest = Math.max(0, Math.min(200, Math.trunc(Number(m.n)) || 0)); this.touch(pl); return note(`Speed test: +${pl.speedTest}% raw, which gives +${G.speedBonus(C, pl.speedTest)}% (${G.stepMsOf(C, pl.speedTest)}ms a tile).`); }
    }
  }
}
