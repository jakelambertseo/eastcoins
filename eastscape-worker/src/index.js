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
import { createDecorRules } from "../../v3/assets/js/eastscape-decor-rules.js";
import { createClosedScenes } from "../../v3/assets/js/eastscape-closed.js";
Object.assign(G.SCENES, createClosedScenes(G, G._MAP));   // (2026-09-21) the closed areas' maps live in their own file so the page's first load doesn't carry them; the server knows every scene
import { createCryptRules } from "../../v3/assets/js/eastscape-crypt-rules.js";
import { createPyramidRules } from "../../v3/assets/js/eastscape-pyramid-rules.js";
import { createCountRules } from "../../v3/assets/js/eastscape-count-rules.js";
import { createTowerRules } from "../../v3/assets/js/eastscape-tower-rules.js";
import { installCrypt } from "./crypt.js";
import { installPyramid } from "./pyramid.js";
import { installCount } from "./count.js";
import { installCarnival, installTurnstile } from "./carnival.js";
import { installPit } from "./pit.js";
import { installTower } from "./tower.js";   // (v109) ticket bets on the Fight Pit, settled against the site's round
const CR = createCryptRules(G, G._MAP); Object.assign(G.SCENES, CR.scenes); Object.assign(G.MOBS, CR.mobs);
/* (2026-09-24) THE GREAT PYRAMID, the second party dungeon: same shape, its own map, monsters and boss. */
const NR = createCountRules(G, G._MAP); Object.assign(G.SCENES, NR.scenes); Object.assign(G.MOBS, NR.mobs);   /* (2026-09-25) THE COUNT ROOM, the quota dungeon: its rules are their own file, its server side is ./count.js */
const PR = createPyramidRules(G, G._MAP); Object.assign(G.SCENES, PR.scenes); Object.assign(G.MOBS, PR.mobs);   // (v103) THE CRYPT, the party dungeon: its rules are their own file, its server side is ./crypt.js
/* (2026-09-22) THE TOWER. Merged the same way and for the same reason as the Crypt: AFTER shared.js has run its
   pass that halves every monster's health, so the tower's generated rows keep the health the rules file computed.
   Its thirty monsters are reskins of ones that already exist, so this adds no art and no new sprite key. */
const TW = createTowerRules(G, G._MAP); Object.assign(G.SCENES, TW.scenes); Object.assign(G.MOBS, TW.mobs);   // its server side is ./tower.js
const DR = createDecorRules(G);   // (v101) the decor shop's catalogue and placing rules: their own file, see there

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
const RR_ASK_MS = 2500;   // the Roulette Room asks the site for the table's state at most this often, whoever is asking
/* (v88) where the jukebox is heard. With RADIO.everywhere it is the whole world, and this stays a `has`-shaped
   object so all nine call sites below are untouched by the change. */
const HEARD = G.RADIO.everywhere ? { has: () => true } : new Set(G.RADIO.heard);
/* (v88, the owner: "show how much / when bots are losin above thier heads") A BOT AT A TABLE PLAYS IT. Nothing is staked and
   nobody is paid: a bot has no tickets. Every few seconds a bot working a casino game rolls a pretend result and the room is
   told the number, which the page floats over their head, red for a loss and green for a win. They lose more than they win,
   like everybody. Cost: one ~45-byte event per bot per ~6 s, only to people in that room. */
const BOT_GAMES = new Set(["slots", "cointable", "dicetable", "wheel", "hilo", "mines", "plinko", "scratch"]);
const BOT_STAKES = [5, 10, 10, 20, 20, 25, 50, 100], BOT_WINS = [1, 1, 1, 1, 2, 2, 3, 5, 10];
const FLOORS = new Set(["casino", "roulette", "fightpit"]);   // where the table's bell is heard
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
    /* (2026-09-22) WHAT THE RUNNING WORKER ACTUALLY HAS. The page and the worker share one rules file, and when a
       deploy of one lands without the other the symptoms are confusing: a version mismatch puts clients in a reload
       loop, and a worker one build behind refuses things the page is happily offering — which is what "Ronde
       doesn't stock that" was, for four vanity sets the page could already draw.

       Twice now the only way to answer "is the worker stale?" was to compare file timestamps against a deployment
       list and infer. This answers it: the VERSION the worker is running and a count of the things most likely to
       have just been added. No player data, so no key, same as /hiscores. */
    if (url.pathname === "/health") {
      return Response.json({
        ok: true, version: G.VERSION, at: new Date().toISOString(),
        hw: { on: G.hwOn(), day: G.chicagoDay(), night: G.nightfallOn(), hour: G.hourCT() },
        counts: { vanitySets: Object.keys(G.VANITY_SETS).length, vanity: Object.keys(G.VANITY).length, scenes: Object.keys(G.SCENES).length, mobs: Object.keys(G.MOBS).length, items: Object.keys(G.ITEMS).length, quests: Object.keys(G.QUESTS).length, dailies: G.DAILY.length },
        has: { trailer: !!G.SCENES.trailer, junkking: !!G.MOBS.junkking, tixLimiter: typeof G.tixBlock === "function", gladiator: !!G.VANITY.gladiator_head }
      }, { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } });
    }

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
      return new Response(r.body, { status: r.status, headers: { "content-type": "application/json", "Cache-Control": "public, max-age=30", "Access-Control-Allow-Origin": "*" } });   /* (v96) the page is on eastcoin.vip and this is play.eastcoin.vip: without the header the browser threw every answer away, and the window said "unreachable" to everybody. Public numbers, so any origin. */
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
      { const r = url.searchParams.get("role");   /* &role=mod / &role=user, so the three tiers can be tested in dev */
        const admin = r ? r === "admin" : !url.searchParams.get("plain");
        user = { id: `dev:${login}`, login, name: login, admin, role: r || (admin ? "admin" : "user") }; }   /* (&plain=1: an ordinary player, for tools/eastscape-two.mjs. Dev mode only.) */
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
      /* (v109) THESE WERE NEVER READ BACK AT START. The Crypt's fastest clears, the jukebox's station and the song queue were each
         written to storage and loaded only in restore() further down, which runs when a backup is put back, not when the server
         starts. So every deploy began with an empty Crypt board (the owner: "i dont see me and kellzifer first dungeon run on the
         crypt hiscore anymore"), and the first clear after a restart would have WRITTEN that empty list over the saved one. */
      this.cryptTop = (await ctx.storage.get("cryptTop")) || {};
      this.hw = (await ctx.storage.get("hw")) || { kingAt: 0, kingDue: false, kingUp: null, night: false };
      if (env.DEV === "1" && env.HW_LIVE !== "0") G.HW.live = true;   /* (2026-09-27) a dev server runs the Long Night whatever the switch says, so it can be previewed before it opens (--var HW_LIVE:0 to see it dormant) */   /* (2026-09-27) the Long Night's clocks: the King's hour, and whether Nightfall has been called */
      this.radio = (await ctx.storage.get("radio")) || null;
      { const sg = (await ctx.storage.get("songs")) || null; this.song = sg?.song || null; this.songQ = Array.isArray(sg?.q) ? sg.q : []; }
      if (!(this.jack.pot >= G.JACKPOT.seed)) { this.jack.pot = G.JACKPOT.seed; this.jackDirty = true; }   // (the v107 seed top-up was in restore() too)
      await this.pitLoad();   // (v109) ticket bets on a fight that hasn't been settled yet
      await this.runsLoad();   // (2026-09-27) the dungeon runs that were on when the world went down: see RUNS SURVIVE A RESTART
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
    /* (v81) what they switched on in eastcoin.vip's store: a name colour id and a title, as the site's verify sent them. Checked again here because it is drawn on other people's screens. */
    const cos = user.cos && typeof user.cos === "object" ? { name: /^name-[a-z]{2,12}$/.test(String(user.cos.name || "")) ? String(user.cos.name) : null, title: user.cos.title ? String(user.cos.title).replace(/[\u0000-\u001f<>]/g, "").slice(0, 24) : null } : null;
    const pl = { cos: cos && (cos.name || cos.title) ? cos : null, id: user.id, login: user.login, name: user.name || user.login, admin: !!user.admin, role: user.role || (user.admin ? "admin" : "user"), ws, C,
      x: C.x, y: C.y, path: [], step: null, face: 1, dir: "south", act: null,
      lastSwing: 0, swingAt: 0, hurtAt: 0, regen: Date.now(), dirty: true, needSave: !stored, out: [], god: false, msgs: 0, msgWindow: 0, joinedAt: Date.now(), lastInput: Date.now() };
    pl.playFrom = Date.now();
    pl.cashSeen = this.cashOf(C);
    /* (2026-09-22) "X just logged on", so the room knows who is about and who to talk to.
       THE GUARD IS THE WHOLE FEATURE. A reconnect is not an arrival: a worker deploy drops and restores everyone at
       once, a phone backgrounding drops people constantly, and a tab refresh is a fresh socket — announcing all of
       those turns the feed into a wall of the same five names. It only fires when the character has really been away,
       so a deploy announces nobody. */
    const away = Date.now() - (C.stats?.lastSeen || 0);
    const sayHello = away > 10 * 60 * 1000;   // ten minutes: a deploy, a refresh or a dropped phone all stay quiet
    if (C.stats) { C.stats.sessions++; C.stats.firstSeen ||= Number(C.created) || Date.now(); C.stats.lastSeen = Date.now(); }
    if (sayHello) setTimeout(() => { for (const q of this.pls.values()) if (q.id !== user.id) q.out.push({ type: "casinonote", text: `\u{1F44B} ${pl.name} just logged on.` }); }, 400);
    this.cryptRejoin(pl); this.countRejoin(pl);   /* (2026-09-25) and the Count Room, same rule: a saved spot inside a run is only good if that run is still there */   /* (v104) saved inside a crypt run: back into it if it is still going, else to the stairs */
    this.pyramidRejoin(pl);
    this.towerRejoin(pl);   /* (2026-09-22) saved inside the Tower: rebuild that floor, or the room comes back empty and unwinnable */
    this.pls.set(user.id, pl);
    this.ctx.storage.put(`who:${String(user.login).toLowerCase()}`, { id: user.id, name: pl.name }).catch(() => {});
    const S = this.scene(C.scene);
    this.placeSafely(S, pl); this.markSeen(pl, C.scene);
    ws.addEventListener("message", (e) => { try { this.onMessage(pl, JSON.parse(e.data)); } catch (err) { /* ignore bad frames */ } });
    ws.addEventListener("close", () => this.leave(pl));
    ws.addEventListener("error", () => this.leave(pl));
    this.dailyState(pl);   // today's jobs exist from the moment you arrive: the side panel shows them
    /* (2026-09-27) A LOAD WITH NOTHING TO HOLD IT: the pocket outlived its quiver somehow (an old save, a lost piece). It can no longer
       fire (G.ammoOf wants the pouch), so it is handed back to the bag here rather than left invisible. */
    if (C.quiver && !(G.pouchOf(C) && G.pouchOf(C).pouch.ammo === G.ammoKind(C.quiver.k))) this.pocketOut(pl);
    this.send(pl, { type: "hello", version: G.VERSION, t: Date.now(), you: { id: pl.id, login: pl.login, name: pl.name, admin: pl.admin, role: pl.role }, me: this.meOf(pl) });
    this.send(pl, { type: "who", scene: S.key, who: this.whoOf(S), npcs: this.npcsOf(S) });
    if (HEARD.has(String(S.key).split(":")[0])) { this.songTick(Date.now()); if (this.song || this.songQ?.length) this.send(pl, { type: "ev", list: [this.songMsg()] }); }
    if (this.radio && HEARD.has(String(S.key).split(":")[0])) this.send(pl, { type: "ev", list: [{ type: "radio", radio: this.radio }] });   /* (v86) the jukebox is already playing when you log in on the floor */
    this.send(pl, JSON.parse(this.snapOf(S, Date.now(), false)));
    this.cryptHello(pl, S); if (S.def.count) this.countHello(pl, S);
    if (this.doubleOn()) pl.out.push({ type: "double", on: this.doubleView() });   /* (2026-09-25) walk in mid-event and the timer is already there */
    this.pyramidHello(pl, S);
    this.achSweep(pl);   /* (2026-09-23) everything they already qualify for, paid once and quietly */
    S.whoSig = null;   // the next broadcast tells everyone else this player has arrived
    if (!stored) this.say(pl, "Welcome to EastScape. Play the tables. Broke? Go outside: hit something, or fish. Bom Trady, in the middle of the floor, turns what you find into tickets.");
    else this.say(pl, `Welcome back, ${pl.name}.`);
    if (this.exDeliver(pl)) this.exCommit(pl);   // market sales and purchases made while you were away
    this.start();
  }

  async leave(pl, replaced = false) {
    if (pl.left) return; pl.left = true;
    if (pl.trade) this.tradeEnd(pl.trade, `${pl.name} left.`);
    if (pl.party) this.partyAway(pl);   /* (v104) a dropped connection keeps its place in the party and the crypt for a few minutes: see crypt.js */
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
  say(pl, text, cls = "sys", tag) { if (!pl) return; pl.out.push({ type: "say", text, cls, tag }); }   /* (2026-09-27) a line for somebody who is not connected is dropped, not thrown: partyBack tells the OTHER members "X is back", and after a restart the other members are not here yet - it threw inside the first member's hello and their reconnect died with it */

  async persist(pl) {
    if (!pl.needSave) return;
    this.accrue(pl);
    pl.C.x = pl.x; pl.C.y = pl.y; pl.C.saved = Date.now();
    pl.needSave = false;
    try { await this.ctx.storage.put(`char:${pl.id}`, pl.C); pl.out.push({ type: "saved", t: pl.C.saved }); }
    catch (e) { pl.needSave = true; }
  }
  touch(pl) { pl.dirty = true; pl.needSave = true; pl.changedAt ??= Date.now(); }

  /* THE RUN PAYOUT, SHARED BY EVERY PARTY DUNGEON (2026-09-24, the owner: "mirror it and then factor out the
     payout yourself so its different"). The Crypt had this inline; the Pyramid needs the same rules, and this is
     the one part of a dungeon that must never drift between the two.

     Three rules live here and nowhere else. A player who did under `fullShare` of the boss gets `lowShare` of the
     pay, because nobody is carried for nothing. A clear past the day's `runsPaid` gets `lateShare`. And the
     result is written ON THE CHARACTER before anything is handed over, so a crash, a dropped connection or
     simply walking past the chest cannot lose what somebody is owed - the chest reads it back later, and
     whatever is still owed to somebody who has left gets sent after them.

     It returns the figure rather than announcing it: what the Hoodie's death says and what the Pyramid's says are
     flavour, and flavour belongs to the dungeon. */
  dungeonOwe(pl, { key, tier, pay, share, cfg, runs }) {
    const low = share < cfg.fullShare, late = runs >= cfg.runsPaid;
    /* both multipliers, THEN one round - the order the Crypt has always used. Rounding between them would pay a
       fraction of a ticket differently depending on which penalty applied first. */
    const owed = Math.round(pay * (low ? cfg.lowShare : 1) * (late ? cfg.lateShare : 1));
    pl.C[key] = { day: G.chicagoDay(), n: runs + 1, loot: { tier, pay: owed, low, late, at: Date.now() } };
    (pl.C.stats ||= G.freshStats())[key] = (pl.C.stats[key] | 0) + 1;
    this.touch(pl);
    return { pay: owed, low, late };
  }

  meOf(pl) { const C = pl.C; return { hatch: C.hatch || null,   /* (2026-09-27) the egg in the hatchery */ fung: C.fung || null,   /* (2026-09-27) which clusters you've picked today */ pen: C.pen || null,   /* (2026-09-27) Breeding */ store: C.store || null,   /* (2026-09-27) what the Store has sold you and what your name wears */ seen: C.seen || [],   /* (2026-09-27) the world map's fog */ hw: C.hw || null, ward: !!C.ward,   /* (2026-09-27) the Long Night: today's trick, the lanterns taken; the brew's ward */ charm: C.charm || null,   /* (2026-09-26) the running page buff */ quick: C.quick || null,   /* (2026-09-25) the four quick slots: item KEYS, so they survive the bag being sorted */ look: C.look || null, van: C.van,
    /* (2026-09-22) PETS MUST BE HERE. meOf is a hand-picked subset, and eq.pet holds an ID into c.pets — so without
       the list the page resolves the worn pet to null, computes no speed bonus, and predicts 200ms a tile while the
       server moves you at 185. That gap is rubberbanding, and it also left the Equipment tab's pet list empty. */
    pets: C.pets, isle: { tier: C.isle.tier, themes: C.isle.themes, owned: C.isle.owned || {}, decor: C.isle.decor || [] }, speedTest: pl.speedTest || 0, hp: C.hp, inv: C.inv, bank: C.bank, fav: C.fav || [], eq: C.eq, xp: C.xp, qs: C.qs, tour: C.tour || null, hunger: G.needOf(C, "hunger"), thirst: G.needOf(C, "thirst"), found: C.found || {}, wagered: Number(C.wagered) || 0, earned: Number(C.earned) || 0, spinDay: C.spin?.day || null, streak: C.spin?.streak | 0, roller: C.roller | 0, free: C.free | 0, meal: C.meal || null, drink: C.drink || null, luck: C.luck | 0, daily: C.daily?.day === G.chicagoDay() ? C.daily.tasks : null, jack: Math.floor(this.jack?.pot || 0), settings: C.settings, stance: G.stanceOf(C), scene: C.scene, god: pl.god, saved: C.saved || 0, stats: C.stats, bagUp: C.bagUp | 0, tower: C.tower || null, eqf: C.eqf || {}, quiver: C.quiver || null,   /* (2026-09-25) what the offhand pouch holds; without it the page cannot draw the count and the bag shows arrows that fire from nowhere */ guild: C.guild || 0   /* (2026-09-23) meOf IS A HAND-PICKED SUBSET - a field left out of it does not exist as far as the page is concerned, which has now caught seven features. The guild door draws itself locked or open from this. */, ach: C.ach || [] }; }   /* (2026-09-23) ach MUST be here, for the FIFTH time in the same trap as pets, bagUp, tower and forge: meOf is a hand-picked subset, and the whole Achievements panel is drawn from me.ach — without it every achievement reads as unearned */   /* (2026-09-22) forge MUST be here, for the fourth time in the same trap as pets, bagUp and tower: meOf is hand-picked, and the page prints every gear stat through bonusOf, which now reads it */   /* (2026-09-22) tower MUST be here for the same reason pets and bagUp are: meOf is a hand-picked subset, and the page draws the climb HUD and the door's window from it */   /* (2026-09-22) bagUp MUST be here: meOf is a hand-picked subset, and G.bagMax(me) on the page reads it — without it a bought slot is invisible to the counter that sold it and to the bag itself, exactly as pets were */

  /* ------------------------------------------------------------ reforging (2026-09-22)
     Spend bars to push a piece you own further. The odds and what a level is worth live in G.FORGE; this only
     checks you are standing at an anvil with the bars, rolls once, and writes the result.

     THE BARS GO WHETHER IT WORKS OR NOT — that is the whole shape of the thing — and they are taken BEFORE the roll
     so a disconnect in the middle cannot leave someone a free attempt. A failure drops one level and never destroys
     the piece; regression is the tension, and losing a ground-for set in one click is how people stop touching a
     system altogether. */
  forgeDo(S, pl, m) {
    const C = pl.C, key = String(m.k || ""), bad = (t) => this.say(pl, t, "bad");
    if (!G.canForge(key)) return bad("That can't be reforged.");
    const fletched = !!G.ITEMS[key].forgeWith;   /* (2026-09-25) bows and quivers: the fletching table works as well as the anvil */
    const anvil = S.objs.find((o) => (o.t === "anvil" || (fletched && o.t === "fletcher")) && G.cheb(pl, o) <= 2);
    if (!anvil && !pl.god) return bad(fletched ? "You need to be at the fletching table or an anvil." : "You need to be at an anvil.");
    /* (2026-09-23) WHICH ONE. A level belongs to a piece now, so "reforge my diamond axe" has to name one when
       you own three at different levels. The rule is the one a player would guess: the one you are WEARING, and
       otherwise the best one in your bag — so taking a +2 from the bag to +3 keeps working on that same piece,
       and a plain spare is only ever touched when it is all you have. The message says which it took. */
    const wornSlot = Object.keys(C.eq).find((sl) => C.eq[sl] === key) || null;
    let bagI = -1;
    if (!wornSlot) C.inv.forEach((st, i) => { if (st.k === key && (bagI < 0 || G.fOf(st) > G.fOf(C.inv[bagI]))) bagI = i; });
    if (!wornSlot && bagI < 0) return bad(`You don't have ${G.ITEMS[key].name.toLowerCase()}.`);
    const it = G.ITEMS[key], tier = G.TIERS.find((t) => t.key === it.tier);
    if (tier && G.lvlOf(C, "smithing") < tier.gate && !pl.god) return bad(`Reforging ${it.name.toLowerCase()} takes Smithing ${tier.gate}. You're ${G.lvlOf(C, "smithing")}.`);
    if (it.forgeReq && G.lvlOf(C, it.forgeReq.skill) < it.forgeReq.lvl && !pl.god) return bad(`Reforging ${it.name.toLowerCase()} takes ${G.SKILLS[it.forgeReq.skill].name} ${it.forgeReq.lvl}. You're ${G.lvlOf(C, it.forgeReq.skill)}.`);
    const lvl = wornSlot ? G.fLevelOf(C, wornSlot) : G.fOf(C.inv[bagI]);
    /* (2026-09-23) THE THREE THINGS THE THIEVES' GUILD SELLS INTO THIS. All are spent on the attempt whatever it
       does - that is their whole cost - and all are checked BEFORE the bars are taken, so a refusal never charges.
         Temper        +FORGE.temper to the odds
         Flux          a failure cannot DESTROY the piece; it downgrades instead
         Master's seal the one thing that gets a piece past FORGE.max, to FORGE.cap
       Flux is the one to watch: the 15% break at +2 is a real sink on gear, and making it optional makes gear
       commoner. It is priced by being three stolen materials and a flux deep, not by being rare on a table. */
    const AIDS = ["temper", "flux", "masters_seal"];
    const using = Array.isArray(m.use) ? AIDS.filter((k) => m.use.includes(k)) : [];
    for (const k of using) if (G.countItems(C, [k]) < 1) return bad(`You don't have ${G.ITEMS[k].name.toLowerCase()}.`);
    const sealed = using.includes("masters_seal");
    if (lvl >= (sealed ? G.FORGE.cap : G.FORGE.max)) return bad(lvl >= G.FORGE.cap
      ? `${G.forgeNameAt(key, lvl)} is as far as anything goes.`
      : `${G.forgeNameAt(key, lvl)} is already at +${G.FORGE.max}. A master's seal buys one more step.`);
    const [barKey, n] = G.forgeCost(key);
    if (G.countItems(C, [barKey]) < n) return bad(`That takes ${n} × ${G.ITEMS[barKey].name.toLowerCase()}. You have ${G.countItems(C, [barKey])}.`);
    G.takeInv(C.inv, barKey, n);
    for (const k of using) G.takeInv(C.inv, k, 1);
    const odds = Math.min(0.99, G.forgeOdds(lvl, sealed) + (using.includes("temper") ? G.FORGE.temper : 0));
    const win = Math.random() < odds;
    C.eqf ||= {};
    /* (2026-09-22) A FAILURE CAN NOW DESTROY THE PIECE. Only a failure can - +1 is a certainty, so the risk starts
       exactly where there is something to lose. Breaking it also CLEARS ITS LEVEL: the level is kept on the
       character keyed by item, so leaving it behind would mean rebuying the same piece and finding it still +2,
       which would make losing it cost nothing at all. */
    let broke = false, nowLvl = lvl;
    if (win) nowLvl = lvl + 1;
    else if (!using.includes("flux") && Math.random() < G.forgeBreak(lvl)) broke = true;   /* flux is the only thing that stands between a failure and losing the piece */
    else nowLvl = Math.max(0, lvl - 1);

    /* (2026-09-23) Written back to THE PIECE that was worked on, which is why the target was resolved up front:
       a break must destroy that exact one, not whichever copy comes first in the bag. */
    if (broke) {
      (C.stats ||= G.freshStats()).forgeBroke = (C.stats.forgeBroke | 0) + 1;   /* (2026-09-23) what the "Easy Come" achievement counts; nothing else recorded a break */
      if (wornSlot) { C.eq[wornSlot] = null; delete C.eqf[wornSlot]; }
      else G.takeAt(C.inv, bagI);
    } else if (wornSlot) { if (nowLvl > 0) C.eqf[wornSlot] = nowLvl; else delete C.eqf[wornSlot]; }
    else { const st = C.inv[bagI]; if (nowLvl > 0) { if (st.n > 1) { st.n -= 1; G.addInv(C.inv, key, 1, C, nowLvl); } else st.f = nowLvl; } else delete st.f; }

    this.grant(pl, "smithing", Math.round(20 * (tier ? G.TIERS.indexOf(tier) + 1 : 1) * (win ? 1 : 0.4)));
    this.touch(pl);
    pl.out.push({ type: "forge", k: key, was: lvl, now: nowLvl, win, broke, odds, used: using });
    this.emit(pl, "forge", { k: key, now: nowLvl, broke });
    this.say(pl, broke
      ? `The ${it.name.toLowerCase()} cracks clean through and falls apart in the fire. It's gone.`
      : win
        ? `The ${it.name.toLowerCase()} comes out of the fire at +${nowLvl}.`
        : lvl === nowLvl
          ? `It cracks and settles back. Still +${nowLvl}.`
          : `It cracks. Back to +${nowLvl}.`, win ? "good" : "bad");
  }

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
    for (const o of S.objs) if (o.t === "rock") o.left = rint(G.ORE_IN_ROCK[0], G.ORE_IN_ROCK[1]);   /* (2026-09-22) a rock holds a few ore, like an olive tree holds a few olives. Veins are excluded: they never run dry by design. */
    /* (2026-09-24) A PLACEMENT MAY OVERRIDE ITS TYPE. `aggro` lives on the MOB TYPE, so the only way to make one
       creature hostile used to be making every one of them hostile everywhere - the Gloam wanted a single Bog
       Gnasher that attacks on sight and there are three more in the Wilderness that nobody asked to change. A
       fourth element on a placement line now carries per-mob overrides; `aggro` is the only one read so far. */
    S.mobs = def.mobs.map(([t, x, y, over], i) => ({ id: `${key}m${i}`, aggro: over?.aggro, respawn: over?.respawn, perch: over?.perch || undefined,   /* (2026-09-25) perched: never wanders, may sit on water */   /* (2026-09-25) a PLACEMENT may own its respawn as well as its reach: the Vault's node guards come back on two-to-three minutes while the same types stand around the room on the ordinary timer */ t, x, y, hx: x, hy: y, hp: G.MOBS[t].hp, path: [], step: null, face: Math.random() < 0.5 ? 1 : -1, nextWander: 0, dead: false, respawnAt: 0, hurtAt: 0, swingAt: 0, lastSwing: 0 }));
    S.npcs = def.npcs.filter((n) => !n.event || G.hwOn()).map((n, i) => ({ ...n, id: `${key}n${i}`, hx: n.x, hy: n.y, path: [], step: null, face: -1, nextWander: 0, holdUntil: 0 }));
    S.bots = def.bots.map((bt, i) => {
      let x, y, tries = 0;
      do { x = rint(3, G.COLS - 4); y = rint(3, G.ROWS - 4); } while ((!G.walkableIn(S.g, x, y) || S.mobs.some((m) => m.x === x && m.y === y) || S.npcs.some((n) => n.x === x && n.y === y)) && ++tries < 300);
      return { ...bt, id: `${key}b${i}`, x, y, path: [], step: null, face: 1, dir: "south", nextWander: 0, hue: bt.level > 50 ? 150 : 0, working: null, goal: null };
    });
    this.scenes.set(key, S);
    if (S.owner) this.decorLay(S);   /* (v101) the owner's furniture, if we already know their island */
    return S;
  }
  isleOf(S) { return this.pls.get(S.owner)?.C.isle || S.isleCopy; }
  /* (2026-09-22) THE RUN'S MARKS. Scattered fresh at the start of every run and owned by the runner, so two people
     on the course are not racing for the same pickup and nobody can farm someone else's.

     They go on the OUTER rows of the lane (11 and 13), never the middle one you would run down anyway, and never on
     a gate's own column — a mark inside a shutter would be free, and the whole point is that fetching one costs a
     beat. The old ones are cleared first, or a player standing at the start re-entering would pile them up. */
  scatterMarks(S, pl) {
    const now = Date.now();
    S.ground = S.ground.filter((x) => !(x.k === "agilmark" && x.owner === pl.id));
    const gateX = new Set(S.def.gates.map((g) => g.x)), lane = G.AGIL_LANE;
    const outer = [lane[0], lane[lane.length - 1]], spots = [];
    for (let x = 7; x <= 34; x++) { if (gateX.has(x) || gateX.has(x - 1) || gateX.has(x + 1)) continue; for (const y of outer) spots.push({ x, y }); }
    for (let i = 0; i < G.AGIL_MARKS && spots.length; i++) {
      const at = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      S.ground.push({ id: `g${++this.gseq}`, k: "agilmark", n: 1, x: at.x, y: at.y, owner: pl.id, until: now + 900000, gone: now + 900000 });
    }
  }
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
  /* (2026-09-27) THE MAPS YOU HAVE SET FOOT ON, for the world map's fog: a base scene key once, capped, never an island */
  markSeen(pl, key) {
    const b = String(key).split(":")[0]; if (!G.SCENES[b] || G.isIsle(key)) return;
    const C = pl.C; if (!Array.isArray(C.seen)) C.seen = [];
    if (C.seen.includes(b)) return;
    C.seen.push(b); if (C.seen.length > 80) C.seen.shift(); this.touch(pl);
  }
  moveToScene(pl, key, side, at) {
    const S = this.scene(key);
    this.markSeen(pl, key);
    /* (2026-09-22) the tour's "go and see your own island" step. Keyed on the OWNER, not just on being on an island,
       so walking onto somebody else's does not tick it off — the point of the step is that you have one. */
    /* `island`, not `home` — `home` is The Cottage, the building INSIDE the island, so the step only completed if you
       happened to walk indoors once you got there. Charon puts you on the island itself, which is what the step asks. */
    if (S.def?.island && S.owner === pl.id) this.tourStep(pl, "isle");
    /* (2026-09-22) THE RUN's clock. Arriving at the course starts it, so a time is the whole trip rather than
       whenever somebody remembered to press something. Leaving and coming back is simply a new run. */
    if (S.def?.gates) { pl.runAt = Date.now(); pl.runPast = 0; pl.runPerfect = 0; this.scatterMarks(S, pl); }   // a new run: the clock, the gates paid for, the perfects, and fresh marks
    if (pl.trade) this.tradeEnd(pl.trade, "Trade cancelled: someone left the area.");
    pl.C.scene = key; pl.path = []; pl.step = null; pl.act = null;
    this.questVisit(pl, key);   /* (2026-09-27) a quest's "go to" stage */
    if (at) { pl.x = at.x; pl.y = at.y; }
    else if (side) {
      const mid = (G.SPAN[side][0] + G.SPAN[side][1]) / 2;
      pl.x = side === "w" ? 1 : side === "e" ? G.COLS - 2 : mid; pl.y = side === "n" ? 1 : side === "s" ? G.ROWS - 2 : mid;
    }
    this.placeSafely(S, pl);
    this.touch(pl);
    pl.out.push({ type: "scene", key });
    this.send(pl, JSON.parse(this.snapOf(S, Date.now(), false)));
    if (S.run) pl.out.push(S.def.pyramid ? this.pyramidGates(S) : this.cryptGates(S));   /* (v103) a run: which gates are open, and the boss's health */
    if (S.tower) pl.out.push({ type: "tower", ...this.towerView(S) });   /* which floor, and whether the stairs are open */
    if (S.owner) { if (!S.decorLaid) this.decorLay(S); pl.out.push({ type: "decor", decor: this.isleOf(S)?.decor || [] }); }   /* (v101) what stands on this island: sent on the way in and on every change, never in the ten-a-second snapshot */
    if (HEARD.has(String(key).split(":")[0]) && (this.song || this.songQ?.length)) pl.out.push(this.songMsg());
    if (HEARD.has(String(key).split(":")[0]) && this.radio) pl.out.push({ type: "radio", radio: this.radio });   /* what's on the jukebox, as you walk in */
    if (key === "roulette") { if (this.rrT?.seats.length) pl.out.push(this.rrSeatsMsg(S)); this.rrLook(Date.now()); }   /* who is at the table, and one look in case the website opened it */
  }

  /* ------------------------------------------------------------ THE ROULETTE ROOM (v74): the bell, the seats, the bar cart
     Russian Roulette is eastcoin.vip's table and the window talks to the site itself. This is only the ROOM round it, and it
     never touches a ZCoin: the game server asks the site's PUBLIC state (GET /api/casino/pvp/state, no session, no key) and
     shows people what it says.
       WHEN IT ASKS: when someone clicks the table or a seat, when a window says the table changed (t:"rr"), when someone walks
       into the room, and once when the lobby's clock runs out (which is also what settles the round on the site). Never on a
       timer otherwise, and never more than once in RR_ASK_MS however many people ask: a busy table costs the site a handful
       of requests a game.
       WHAT IT DOES WITH THE ANSWER: a NEW lobby rings the bell on the casino floor (once per lobby); seated players who are
       in the room are walked to their stool (once per lobby: walk away and you are not dragged back); when the round is
       settled the room is sent the stages so everyone sees who slumps, and the floor is told who took the pot. */
  rrSeatsMsg(S) {
    const T = this.rrT, here = S ? this.playersIn(S) : [], key = (x) => String(x || "").toLowerCase().replace(/^dev:/, "");
    return { type: "rrseats", id: T?.id || null, left: T?.startsAt ? Math.max(0, T.startsAt - Date.now()) : 0, seats: (T?.seats || []).map((x, i) => ({ i, name: x.name, pid: here.find((p) => key(p.login) === key(x.login))?.id ?? null })) };
  }
  async rrLook(now = Date.now()) {
    if (this.rrBusy) return; if (now - (this.rrAskedAt || 0) < RR_ASK_MS) { this.rrDueAt = Math.min(this.rrDueAt || Infinity, this.rrAskedAt + RR_ASK_MS + 50); return; }
    this.rrBusy = true; this.rrAskedAt = now; if (this.rrDueAt && this.rrDueAt <= now + RR_ASK_MS) this.rrDueAt = 0;
    try { const r = await fetch(`${this.env.SITE}/api/casino/pvp/state?game=roulette`), st = await r.json(); if (st?.ok) this.rrTake(st); }
    catch (e) { /* the site didn't answer: the room just shows nothing new */ }
    finally { this.rrBusy = false; }
  }
  rrTake(st) {
    const now = Date.now(), T = (this.rrT ||= { id: null, seats: [], belled: null, walked: new Set(), tries: 0, startsAt: 0 }), S = this.scenes.get("roulette"), L = st.lobby, last = st.last;
    const key = (x) => String(x || "").toLowerCase().replace(/^dev:/, "");
    if (L && L.status === "LOBBY") {
      if (T.id !== L.id) { T.id = L.id; T.walked = new Set(); } T.tries = 0;
      T.startsAt = now + Math.max(0, Number(L.startsAt) - Number(st.now)); this.rrDueAt = T.startsAt + 1200;
      T.seats = (L.players || []).slice(0, G.RR_SEATS.length).map((x) => ({ login: x.login, name: x.displayName || x.login }));
      if (T.belled !== L.id && T.seats.length) { T.belled = L.id;   /* THE BELL: everyone on the casino's floors, once per lobby */
        const msg = { type: "rrbell", name: T.seats[0].name, left: Math.max(0, T.startsAt - now), n: T.seats.length };
        for (const p of this.pls.values()) if (FLOORS.has(String(p.C.scene).split(":")[0]) && key(p.login) !== key(T.seats[0].login)) p.out.push(msg); }
      if (S) { T.seats.forEach((x, i) => { const pl = this.playersIn(S).find((q) => key(q.login) === key(x.login)), [sx, sy] = G.RR_SEATS[i];
          /* TWO PEOPLE, ONE STOOL: it can't happen between players who SAT, because nobody picks a stool: the site hands out seat
             numbers (one per person, a unique index behind it) and the n-th seat is the n-th stool. What can happen is somebody
             merely STANDING on a stool (they're soft tiles) when its owner arrives, so that bystander is stepped off it. */
          for (const q of this.playersIn(S)) if (q !== pl && q.x === sx && q.y === sy && !q.path?.length) { const free = [[0, 2], [0, -2], [2, 0], [-2, 0], [1, 2], [-1, 2], [2, 1], [-2, 1]].map(([dx, dy]) => ({ x: sx + dx, y: sy + dy })).find((c) => G.walkableIn(S.g, c.x, c.y) && !G.RR_SEATS.some(([ax, ay]) => ax === c.x && ay === c.y)); const pq = free && G.findPath(S.g, this.from(q), free, 0); if (pq) { q.act = null; q.path = pq; this.kick(S, q, now); } }
          if (!pl || T.walked.has(pl.id)) return; T.walked.add(pl.id); if (pl.x === sx && pl.y === sy) return;
          const path = G.findPath(S.g, this.from(pl), { x: sx, y: sy }, 0); if (path) { pl.act = null; pl.path = path; this.kick(S, pl, now); } });
        const m = this.rrSeatsMsg(S); for (const p of this.playersIn(S)) p.out.push(m); }
      return;
    }
    if (!T.id) return;
    if (last && last.id === T.id) {
      const names = (last.players || []).map((x) => x.displayName || x.login), res = last.result;
      if (last.status === "SETTLED" && res?.stages && S) { const seats = this.rrSeatsMsg(S).seats;
        for (const p of this.playersIn(S)) p.out.push({ type: "rrshow", id: last.id, seats, stages: res.stages.map((g) => ({ chambers: g.chambers, live: g.live, shot: g.shot, players: g.players })), winner: res.winner, pot: last.pot }); }
      if (last.status === "SETTLED" && res) { const text = `🔫 ${names[res.winner] ?? "Somebody"} took ${last.pot} ZC at Russian Roulette.`, wait = G.rrShowMs(res.stages || []);
        setTimeout(() => { for (const p of this.pls.values()) if (FLOORS.has(String(p.C.scene).split(":")[0])) p.out.push({ type: "casinonote", text }); }, Math.min(wait, 60000)); }   /* after the room has watched it: no spoilers */
      T.id = null; T.seats = []; T.startsAt = 0; this.rrDueAt = 0;
      if (S && !(last.status === "SETTLED" && res?.stages)) { const m = this.rrSeatsMsg(S); for (const p of this.playersIn(S)) p.out.push(m); }
      return;
    }
    if (++T.tries < 8) this.rrDueAt = now + 2000;   /* the clock is out but the site hasn't finished paying: look again shortly */
    else { T.id = null; T.seats = []; this.rrDueAt = 0; if (S) { const m = this.rrSeatsMsg(S); for (const p of this.playersIn(S)) p.out.push(m); } }
  }
  /* YOUR LOOK (v80): seven small numbers, checked against the lists in the rules file (G.normLook) so nothing odd can be stored
     or sent to other people. The FIRST pick is taken wherever you are (it is the "Who are you?" screen on arrival); after
     that it is the mirror's job, so you have to be standing at one. Free, as often as you like, but not faster than one
     a second: every change is re-sent to the room. */
  lookOp(S, pl, m) {
    const look = G.normLook(m.look), now = Date.now(); if (!look) return this.say(pl, "That look didn't take. Try again.", "bad");
    if (pl.C.look && !this.near(S, pl, "mirror", 3) && !pl.admin) return this.say(pl, "Change your look at the mirror by the casino's front door.");
    if (now - (pl.lookAt || 0) < 1000) return; pl.lookAt = now;
    const first = !pl.C.look; pl.C.look = look; this.touch(pl); pl.out.push({ type: "lookset", look });
    if (first) this.say(pl, "Looking good. The mirror by the front door changes it any time.", "good");
  }
  /* THE JUKEBOX (v86; the why is beside RADIO in the rules file). The player sends a station UUID and nothing else. The name and the
     stream address come from Radio Browser's own record of that UUID, fetched here, so nobody can point the room's speakers at
     an address of their choosing. https only. One change per RADIO.everyMs for the whole room; you must be at the jukebox. */
  /* SONGS (v96; the rules are beside RADIO.song in the rules file). The queue runs off TIMESTAMPS, not ticks: a song is over when its
     length has passed since its `at`, and the next one starts where it ended, so a world that went to sleep with nobody in it wakes
     up in the right place in the queue. */
  songMsg() { return { type: "song", song: this.song || null, queue: (this.songQ || []).map((q) => ({ id: q.id, title: q.title, by: q.by, byId: q.byId, dur: q.dur })) }; }
  songTell() { const msg = this.songMsg(); for (const p of this.pls.values()) if (HEARD.has(String(p.C.scene).split(":")[0])) p.out.push(msg); this.ctx.storage.put("songs", { song: this.song || null, q: this.songQ || [] }).catch(() => {}); }
  songTick(now) {
    let changed = false; this.songQ ||= [];
    while (this.song && now >= this.song.at + this.song.dur * 1000 + G.RADIO.song.gapMs) { const end = this.song.at + this.song.dur * 1000 + G.RADIO.song.gapMs, nx = this.songQ.shift() || null; this.song = nx ? { ...nx, at: end } : null; changed = true; }
    if (!this.song && this.songQ.length) { this.song = { ...this.songQ.shift(), at: now }; changed = true; }
    if (changed) { this.songTell(); if (this.song) for (const p of this.pls.values()) if (HEARD.has(String(p.C.scene).split(":")[0])) p.out.push({ type: "casinonote", text: `🎵 Now playing: ${this.song.title} (${this.song.by}'s pick).` }); }
  }
  async songOp(S, pl, m, now) {
    const R = G.RADIO.song; this.songQ ||= []; this.songTick(now);
    if (m.op === "skip") {   /* your own song, or an admin: the one playing (no n) or one still waiting (n = its place in the queue, id to be sure it is the same one) */
      const n = Number.isInteger(m.n) ? m.n : -1, it = n >= 0 ? this.songQ[n] : this.song; if (!it || it.id !== m.id) return;
      if (it.byId !== pl.id && !pl.admin) return this.say(pl, `${it.by} paid for that one.`, "bad");
      if (n >= 0) this.songQ.splice(n, 1); else this.song = null;
      this.songTick(now); this.songTell(); return;
    }
    const id = String(m.id || ""); if (m.op !== "song" || !/^[A-Za-z0-9_-]{11}$/.test(id)) return;
    if (this.songQ.length >= R.queue) return this.say(pl, "The jukebox is full. Let a few play.", "bad");
    if ([this.song, ...this.songQ].filter((q) => q && q.byId === pl.id).length >= R.each && !pl.admin) return this.say(pl, `You have ${R.each} in already. Let somebody else have a go.`, "bad");
    if ([this.song, ...this.songQ].some((q) => q && q.id === id)) return this.say(pl, "That one is already in the queue.", "bad");
    if (G.tixIn(pl.C) < R.cost) return this.say(pl, `A song is ${G.fmtTix(R.cost)}. You have ${G.fmtTix(G.tixIn(pl.C))}.`, "bad");
    if (pl.songBusy) return; pl.songBusy = true;
    try {
      let v = null; try { const r = await fetch(R.facts + id, { headers: { "User-Agent": "EastScape/1.0 (eastcoin.vip)" } }); if (r.ok) v = (await r.json())?.video || null; } catch (e) { /* said below */ }
      if (!v) return this.say(pl, "YouTube isn't answering. Nothing was charged; try again in a moment.", "bad");
      if (!v.found || !v.embeddable || v.live) return this.say(pl, v.live ? "That's a live stream. Pick a song." : "That one can't be played here. Nothing was charged.", "bad");
      if (v.seconds < R.minSec || v.seconds > R.maxSec) return this.say(pl, `Songs only: ${R.minSec} seconds to ${Math.round(R.maxSec / 60)} minutes. That one is ${Math.floor(v.seconds / 60)}:${String(v.seconds % 60).padStart(2, "0")}.`, "bad");
      if (this.songQ.length >= R.queue || G.tixIn(pl.C) < R.cost) return this.say(pl, "Somebody beat you to the last slot. Nothing was charged.", "bad");   // checked again: the lookup took a moment
      G.takeInv(pl.C.inv, "tickets", R.cost); this.touch(pl);
      const clean = (t) => String(t || "").replace(/[\u0000-\u001f<>]/g, "").trim();
      this.songQ.push({ id, title: clean(v.title).slice(0, 90) || "A song", ch: clean(v.channelTitle).slice(0, 50), dur: v.seconds, by: pl.name, byId: pl.id });
      const ahead = this.songQ.length - 1 + (this.song ? 1 : 0); this.songTick(Date.now()); this.songTell();
      this.say(pl, ahead ? `In the queue: ${ahead} ahead of you. ${G.fmtTix(R.cost)} well spent.` : `On it goes. ${G.fmtTix(R.cost)} well spent.`, "good");
    } finally { pl.songBusy = false; }
  }
  async radioOp(S, pl, m, now) {
    if (!this.near(S, pl, "jukebox", 3)) return this.say(pl, "You need to be at a jukebox: there is one in the middle of the casino and one by the Yard's gate.");
    if (m.op === "song" || m.op === "skip") return this.songOp(S, pl, m, now);
    const tell = () => { const msg = { type: "radio", radio: this.radio || null }; for (const p of this.pls.values()) if (HEARD.has(String(p.C.scene).split(":")[0])) p.out.push(msg); this.ctx.storage.put("radio", this.radio || null).catch(() => {}); };
    const held = this.radio && this.radio.hold > now && this.radio.byId !== pl.id && !pl.admin, mins = held ? Math.max(1, Math.ceil((this.radio.hold - now) / 60000)) : 0;   // (v89) a paid pick is protected
    if (m.op === "stop") { if (!this.radio) return; if (held) return this.say(pl, `${this.radio.by} paid for that. It's theirs for another ${mins} min.`, "bad"); this.radio = null; tell(); for (const p of this.playersIn(S)) p.out.push({ type: "casinonote", text: `🎵 ${pl.name} turned the jukebox off.` }); return; }
    if (m.op !== "set" || !/^[0-9a-f-]{36}$/.test(String(m.uuid || ""))) return;
    if (held) return this.say(pl, `${this.radio.by} paid for that. You can put yours on in ${mins} min.`, "bad");
    if (G.tixIn(pl.C) < G.RADIO.cost) return this.say(pl, `The jukebox takes ${G.fmtTix(G.RADIO.cost)}. You have ${G.fmtTix(G.tixIn(pl.C))}.`, "bad");
    if (now - (this.radioAt || 0) < G.RADIO.everyMs) return this.say(pl, "Let that one play a moment. Try again in a few seconds.");
    if (this.radioBusy) return; this.radioBusy = true;
    try {
      let st = null; for (const h of G.RADIO.hosts) { try { const r = await fetch(`https://${h}/json/stations/byuuid/${m.uuid}`, { headers: { "User-Agent": "EastScape/1.0 (eastcoin.vip)" } }); if (r.ok) { st = (await r.json())?.[0] || null; if (st) break; } } catch (e) { /* next mirror */ } }
      const url = String(st?.url_resolved || st?.url || ""); if (!st || !/^https:\/\/[^\s"'<>]{4,300}$/.test(url)) return this.say(pl, "That station won't play here. Try another.", "bad");
      if (G.tixIn(pl.C) < G.RADIO.cost) return this.say(pl, `The jukebox takes ${G.fmtTix(G.RADIO.cost)}.`, "bad");   // checked again: the lookup above took a moment
      G.takeInv(pl.C.inv, "tickets", G.RADIO.cost); this.touch(pl);
      this.radioAt = Date.now(); this.radio = { byId: pl.id, hold: Date.now() + G.RADIO.holdMs, uuid: String(m.uuid), name: String(st.name || "A station").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60) || "A station", url, cc: String(st.countrycode || "").slice(0, 2), by: pl.name, at: this.radioAt };
      tell(); for (const p of this.pls.values()) if (HEARD.has(String(p.C.scene).split(":")[0])) p.out.push({ type: "casinonote", text: `🎵 ${pl.name} paid ${G.fmtTix(G.RADIO.cost)} and put on ${this.radio.name}.` });
    } finally { this.radioBusy = false; }
  }
  /* BINO'S BAR CART: a shot of whiskey for a ticket. It does nothing at all except tell the room. */
  rrShot(S, pl, now) {
    if (now - (pl.shotAt || 0) < G.RR_SHOT.everyMs) return this.say(pl, "Bino: Easy. Let that one land first.");
    const c = pl.C.inv.find((x) => x.k === "tickets"); if (!c || c.n < G.RR_SHOT.price) return this.say(pl, `Bino: A shot's ${G.fmtCash(G.RR_SHOT.price)}.`, "bad");
    pl.shotAt = now; c.n -= G.RR_SHOT.price; if (!c.n) pl.C.inv.splice(pl.C.inv.indexOf(c), 1); this.touch(pl);
    for (const p of this.playersIn(S)) p.out.push({ type: "casinonote", text: `🥃 ${pl.name} takes a shot.` });
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
        /* (2026-09-24, reported by the owner: "while getting held ... i can still move slightly and then it
           pulls me back close to it, is that intended") IT WAS NOT. The coil was enforced only from the boss's
           tick, which cleared the path of whoever it had hold of - so a click still walked you a step or two and
           the next tick yanked you back, which looks like the snake pulling you in and is really the server
           arguing with the client. A hold is refused HERE, where the walk is accepted, so you simply do not
           move and are told why. */
        if (S.run && S.def.pyramid && S.run.coil && S.run.coil.id === pl.id) return this.say(pl, "It has you. You are not going anywhere until somebody breaks its grip.", "bad");
        // path from where you'll be when the current step lands, so a new click never stops you dead
        pl.act = null; const p = G.pathTowards(S.g, this.from(pl), { x: m.x, y: m.y }, 0); if (p) { pl.path = p; this.kick(S, pl, now); } return;
      }
      case "step": {
        const dx = Math.sign(m.dx | 0), dy = Math.sign(m.dy | 0), f = this.from(pl);
        // held keys: queue the next step behind the one in progress rather than dropping it
        if ((dx || dy) && G.canStepIn(S.g, f.x, f.y, dx, dy)) { pl.act = null; pl.path = [{ x: f.x + dx, y: f.y + dy }]; this.kick(S, pl, now); }
        return;
      }
      case "act": return this.startAct(S, pl, m);
      case "carnival": return this.carnivalOp(S, pl, m);   /* (2026-09-24) the midway games: start a round, hand in a score */
      case "wild": {
        /* (2026-09-22) TWO WAYS IN NOW. This was pinned to the farm's hole, and the farm is a closed area — so when the
           farm shut, the Wilderness had no entrance at all. Either mouth will do, and we remember which one you used. */
        const mouth = (S.key === "farm" && this.near(S, pl, "hole", 2)) || (S.key === "gloam" && this.near(S, pl, "wildladder", 2));
        if (!mouth || G.lvlOf(C, G.WILD_REQ.skill) < G.WILD_REQ.lvl) return;
        pl.wildFrom = { scene: S.key, x: pl.x, y: pl.y };
        this.moveToScene(pl, "wild", null, G.SCENES.wild.entry);
        return this.say(pl, "You climb down into the Wilderness. You're flagged for PvP: anyone here can attack you.", "bad");
      }
      case "isle": return this.isleOp(S, pl, m);
      /* PETS (2026-09-22). Separate from `equip` on purpose: that one moves an ITEM between the bag and a slot, and
         a pet is neither — eq.pet holds an id into C.pets, and the pet never occupies a bag square at all. */
      case "pet": {
        const C = pl.C, op = String(m.op || ""), id = m.id ? String(m.id) : null;
        if (op === "wear") {
          if (id && !G.petById(C, id)) return this.say(pl, "You don't have that one.", "bad");
          C.eq.pet = id; this.touch(pl);
          return this.say(pl, id ? `${G.petLabel(G.petById(C, id))} is at your heel.` : "Your pet stays behind.");
        }
        if (op === "name") {
          const pet = G.petById(C, id); if (!pet) return;
          pet.name = G.cleanPetName(m.name); this.touch(pl);
          return this.say(pl, `Named ${G.petLabel(pet)}.`, "good");
        }
        /* (2026-09-27) BOM BUYS PETS, by rank (G.petBomPrice), at the Prize Counter like everything else he buys. Paid with cashTo,
           not tixTo: it is a sale, so the 2X event does not double it and it does not count as tickets earned. */
        if (op === "sell") {
          const pet = G.petById(C, id); if (!pet) return;
          if (!this.atCounter(S, pl)) return this.say(pl, "Bom buys pets at the Prize Counter, in the middle of the casino floor.", "bad");
          const n = G.petBomPrice(pet); if (!n) return;
          C.pets = C.pets.filter((x) => x.id !== id); if (C.eq.pet === id) C.eq.pet = null;
          this.cashTo(pl, n); this.touch(pl);
          return this.say(pl, `Bom takes ${G.petLabel(pet)} for ${G.fmtCash(n)}.`, "good");
        }
        if (op === "free") {
          const pet = G.petById(C, id); if (!pet) return;
          C.pets = C.pets.filter((x) => x.id !== id); if (C.eq.pet === id) C.eq.pet = null; this.touch(pl);
          return this.say(pl, `${G.petLabel(pet)} wanders off.`, "bad");
        }
        return;
      }
      case "equip": { const r = this.equip(pl, m.i | 0); this.tourStep(pl, "gear");   /* (2026-09-22) the tour's "put something on" step */
        return r; }
      case "eat": return this.eat(pl, m.i | 0, now);
      case "sort": { const out = G.sortInv(C.inv, C); if (G.countItems({ inv: out }, Object.keys(G.ITEMS)) !== G.countItems(C, Object.keys(G.ITEMS))) return; C.inv = out; G.settleSlots(C); this.touch(pl); return; }
      case "shop": return this.shopOp(S, pl, m);
      case "cashout": { const r = this.cashOut(S, pl, m); this.tourStep(pl, "trade");   /* (2026-09-22) Bom Trady's step */
        return r; }
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
        /* MUTED: the speaker is told, at most once every five seconds, and nobody else hears a word. It is kept on the
           CHARACTER, which is saved and loaded back, so it survives a refresh and a restart — on the connection it was
           dodged by pressing F5, which is not a moderation tool. It lapses on its own clock, so nothing sweeps it.
           `mutedTold` stays on the connection on purpose: it only rate-limits the notice and is worth nothing to save. */
        if (pl.C.mutedUntil > now) {
          if (now - (pl.mutedTold || 0) > 5000) {
            pl.mutedTold = now;
            this.say(pl, `You are muted for another ${Math.max(1, Math.ceil((pl.C.mutedUntil - now) / 60000))} min.`, "bad");
          }
          return;
        }
        pl.lastChat = now;
        /* (2026-09-27, the owner: "add a chat command for users to time the pumpkin king. something like /pumpkin and it shows time
           remaining") THE FIRST CHAT COMMAND. It answers the asker alone and is never broadcast, so nobody else's chat fills with it. */
        if (/^[\/!](pumpkin|king)\b/i.test(text)) return this.say(pl, this.hwKingLine(now), "good");
        for (const p of this.pls.values()) p.out.push({ type: "chat", id: pl.id, name: pl.name, nfx: G.nameFxOf(pl.C) || undefined, role: pl.role !== "user" ? pl.role : undefined, text, scene: pl.C.scene, t: now });
        return;
      }
      case "quest": return this.questOp(S, pl, m);
      case "hw": return this.hwOp(S, pl, m);
      case "pen": return this.penOp(S, pl, m);
      case "hatch": return this.hatchOp(S, pl, m);   /* (2026-09-27) Breeding: eggs */
      case "fung": return this.fungOp(S, pl, m);   /* (2026-09-27) Fungiculture: planting a bed */   /* (2026-09-27) Breeding */   /* (2026-09-27) the Long Night: trick or treat, the Night Market, the corn-priced fits */
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
      case "look": return this.lookOp(S, pl, m);
      case "radio": return this.radioOp(S, pl, m, now);
      case "decor": return this.decorOp(S, pl, m);
      /* (2026-09-23) BUYING A PERMIT FROM VANCE. Its own message rather than the shop's, because there is no
         shop NPC left in the game to open - the permit sat in SHOP.sells where nothing could reach it. He is
         `still`, so the proximity check is the same one the Forge used: be standing with him. */
      case "permit": {
        const V = S.npcs.find((x) => x.opens === "permit");
        if (!V || G.cheb(pl, V) > (V.reach || 3)) return this.say(pl, "You need to be standing with Vance.", "bad");
        if (C.guild) return this.say(pl, "\"You're already in. I don't sell the same door twice.\"");
        const price = G.THIEF.permit, have = G.tixIn(C);
        if (have < price) return this.say(pl, `"${G.fmtTix(price)}. You've got ${G.fmtTix(have)}." He goes back to watching the door.`, "bad");
        if (!G.roomFor(C.inv, "thieves_permit", 1, C)) return this.say(pl, "Your bag is full.", "bad");
        G.takeInv(C.inv, "tickets", price);
        this.give(pl, "thieves_permit");
        this.touch(pl);
        return this.say(pl, `Vance folds the chit into your hand. "Door's behind me. Don't come back."`, "loot");
      }
      case "who": { if (now - (pl.whoAsk || 0) < 3000) return; pl.whoAsk = now; return this.send(pl, { type: "who", scene: S.key, who: this.whoOf(S), npcs: this.npcsOf(S) }); }
      case "store": return this.storeOp(S, pl, m);   /* (2026-09-27) the Store: tickets for boosts and name cosmetics */
      case "map": {   /* (2026-09-27) the world map: how many people stand on each map, nothing else about them */
        if (now - (pl.mapAsk || 0) < 5000) return; pl.mapAsk = now;
        const counts = {}; for (const p of this.pls.values()) { const b = String(p.C.scene || "").split(":")[0]; if (G.SCENES[b] && !G.isIsle(p.C.scene)) counts[b] = (counts[b] || 0) + 1; }
        return this.send(pl, { type: "map", counts });
      }
      /* (2026-09-23, the owner: "allow users to click the {X} online in the top right and it opens a popup of
         whose online and where theyre at"). This is the admin dashboard's own gathering WITH THE PRIVATE COLUMN
         TAKEN OUT: those rows carry each person's ticket count and are sorted by it, which is nobody else's
         business. Name, combat level and place only. Rate-limited exactly like `who` above, and the page polls
         it only while the window is actually open — a roster is cheap to build but it is one message per viewer
         per tick if you let it run in the background. */
      case "whoall": {
        if (now - (pl.whoAllAsk || 0) < 3000) return; pl.whoAllAsk = now;
        const people = [...this.pls.values()].map((p) => ({
          name: p.name, scene: String(p.C.scene || "?").split(":")[0], combat: G.combatOf(p.C), admin: !!p.admin
        })).sort((a, b) => a.name.localeCompare(b.name));
        return this.send(pl, { type: "whoall", people });
      }   /* (v111) the page asks when it is drawing somebody it cannot name */
      case "party": return this.partyOp(S, pl, m);
      case "pit": return void this.pitOp(S, pl, m, now).catch(() => {});
      case "tixgame": { const g = String(m.g); if (!G.GAMES[g] || !S.def.real?.[g]) return; return pl.out.push({ type: "game", g, tix: true, pot: Math.floor(this.jack.pot), lastJack: this.jack.wins?.[0] || null }); }   /* (v107) the window's Tickets toggle: open this table for TICKETS (the same message a ticket table has always opened with) */
      case "profile": return void this.profileOp(pl, m).catch(() => {});   /* (it reads storage, so it answers a moment later, through pl.out) */
      case "crypt": return m.op === "enter" ? this.cryptEnter(S, pl, m) : undefined;
      case "count": return m.op === "enter" ? this.countEnter(S, pl) : undefined;
      /* (2026-09-25) QUICK SLOTS. Four item keys on the character, so the bar follows you to another device. Only the key is
         stored: using one goes through the ordinary eat / use / equip messages the bag already sends, so a quick slot can
         never do anything a click on the same item in the bag could not. */
      /* (2026-09-27) ARRANGING THE BAG, by slot: `from` is a stack (its index in the list), `to` is a SLOT (a position in the laid-out bag).
         An empty slot takes the stack; an occupied one swaps the two. The list itself never moves, only the slots on the stacks. */
      case "inv": {
        if (m.op !== "move") return; G.settleSlots(C); const lay = G.invLayout(C), a = m.from | 0, to = m.to | 0; if (a < 0 || a >= C.inv.length || to < 0 || to >= lay.length) return;
        const cur = lay.indexOf(a), j = lay[to]; if (j === a) return;
        C.inv[a].p = to; if (j >= 0) C.inv[j].p = cur;
        this.touch(pl); return;
      }
      /* (2026-09-27) favourites: a star on the item, first when sorted, and kept out of Deposit bag / Stack all / Sell all */
      case "fav": {
        const k = String(m.k || ""); if (!G.ITEMS[k] || k === "tickets") return;
        C.fav = Array.isArray(C.fav) ? C.fav : []; const on = m.on == null ? !C.fav.includes(k) : !!m.on && !C.fav.includes(k);
        if (on) { if (C.fav.length >= G.FAV_MAX) return this.say(pl, `That's ${G.FAV_MAX} favourites, the most. Unstar one first.`, "bad"); C.fav.push(k); }
        else C.fav = C.fav.filter((x) => x !== k);
        this.touch(pl);
        return this.say(pl, on ? `${G.ITEMS[k].name}: a favourite. Sort puts it first, and Deposit bag, Stack all and Sell all leave it with you.` : `${G.ITEMS[k].name} is no longer a favourite.`, "good");
      }
      case "quick": { const i = m.i | 0; if (i < 0 || i > 3) return; const k = m.k == null ? null : String(m.k);
        if (k && !G.ITEMS[k]) return; (pl.C.quick ||= [null, null, null, null])[i] = k; return this.touch(pl); }
      case "quiver": return this.quiverOp(pl, m);   /* (2026-09-25) load / unload the offhand pouch */   /* (2026-09-25) the Count Room. One tier, so there is nothing to pick and nothing to read off the message. */
      case "pyramid": return m.op === "enter" ? this.pyramidEnter(S, pl) : undefined;
      case "tower": return m.op === "enter" ? this.towerEnter(S, pl, m) : undefined;   /* m carries an optional lower floor: the door’s "start again at floor 1" */
      case "forge": return this.forgeDo(S, pl, m);
      case "emote": { if (!G.EMOTES[m.k] || now - (pl.emoteAt || 0) < 1500) return; pl.emoteAt = now; for (const p of this.playersIn(S)) p.out.push({ type: "emote", id: pl.id, k: String(m.k) }); return; }
      case "bigwin": {   /* decoration only: see CALLOUT in the rules file for why this is taken on the window's word, and how it is fenced */
        const mult = Math.round(Number(m.mult) * 100) / 100, game = String(m.game || ""); if (!(mult >= G.CALLOUT.min && mult <= G.CALLOUT.max) || !G.CALLOUT.games.includes(game) || !FLOORS.has(String(S.key).split(":")[0]) || now - (pl.calloutAt || 0) < G.CALLOUT.everyMs) return;
        pl.calloutAt = now; const msg = { type: "bigwin", id: pl.id, name: pl.name, game, mult, jackpot: !!m.jackpot }; for (const p of this.pls.values()) if (FLOORS.has(String(p.C.scene).split(":")[0])) p.out.push(msg); return; }
      case "rr": return S.key === "roulette" ? this.rrLook(now) : undefined;   /* "the table changed": the page's window saw a lobby or sat down */
      /* RONDE BARBER (2026-09-21). Buying and wearing are separate: `buy` is the only one that costs anything, and
         `wear` only ever moves things you already own. Both are checked here and nowhere else — the window draws
         what it likes, but the character is changed by this. */
      case "vanity": {
        const C = pl.C, v = C.van, op = String(m.op || "");
        if (op === "buy") {
          const k = String(m.k || ""), it = G.VANITY[k];
          if (!it) return this.say(pl, "Ronde doesn't stock that.", "bad");
          if (v.own.includes(k)) return this.say(pl, "You own that already.", "bad");
          if (it.corn) return this.hwFit(pl, k);   /* (2026-09-27) the Long Night's fits are priced in candy corn, at Ronde's or at the tent */
          const price = it.price, have = G.tixIn(C);
          if (have < price) return this.say(pl, `${it.name} is ${G.fmtTix(price)}. You have ${G.fmtTix(have)}.`, "bad");
          G.takeInv(C.inv, "tickets", price);
          v.own.push(k); v.on[it.slot] = k;   /* bought is worn: nobody buys a hat to leave it in a drawer */
          this.touch(pl);   /* the roster carries van in its signature, so the tick broadcasts the change by itself */
          return this.say(pl, `${it.name} — ${G.fmtTix(price)}. Wearing it now.`, "loot");
        }
        if (op === "wear") {
          const s = String(m.slot || ""); if (!G.VANITY_SLOTS.includes(s)) return;
          const k = m.k ? String(m.k) : null;
          if (k && (!G.VANITY[k] || G.VANITY[k].slot !== s || !v.own.includes(k))) return this.say(pl, "You don't own that.", "bad");
          v.on[s] = k; this.touch(pl);   /* the roster carries van in its signature, so the tick broadcasts the change by itself */
          return;   /* the character push that touch() triggers is what redraws the window */
        }
        if (op === "colour") {
          const s = String(m.slot || ""); if (!G.VANITY_SLOTS.includes(s)) return;
          const c = Math.trunc(Number(m.c)); if (!Number.isInteger(c) || c < 0 || c >= G.VANITY_COLS.length) return;
          v.col[s] = c; this.touch(pl);   /* the roster carries van in its signature, so the tick broadcasts the change by itself */
          return;   /* the character push that touch() triggers is what redraws the window */
        }
        return;
      }
      case "use": return this.useItem(pl, m.i | 0);
      case "trade": return this.tradeOp(S, pl, m);
      /* A MOD GETS THE PANEL TOO, but only the tools MOD_TOOLS lists — the check is per COMMAND, not per panel, so a
         mod who guesses a command name still cannot run it. The list and the reasoning live in _tickets.js. */
      case "admin": return this.canRun(pl, m.cmd) ? this.admin(S, pl, m) : void this.say(pl, "That one is admins only.", "bad");
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
      act = { kind: "mob", id: mob.id, x: mob.x, y: mob.y, name: G.MOBS[mob.t].name, reach: G.reachOfHeld(C) };   /* (2026-09-25) SHOOT FROM WHERE YOU STAND: the walk below stops at the bow's reach, not next to the thing (the owner: "it runs up to them, which feels very much like melee") */
    }
    else if (m.kind === "npc") { const n = S.npcs.find((x) => x.id === m.id); if (n) act = { kind: "npc", id: n.id, x: n.x, y: n.y, name: n.name, reach: n.reach || 1 }; }
    else {
      const ob = S.objs[m.ob | 0]; if (!ob || ob.edge) return;   // (the border's trees and rocks are scenery)
      let kind = { jbench: "jewel",   /* (2026-09-27) Jewelcrafting: a picker station like the anvil */ hatchery: "hatchery",   /* (2026-09-27) Breeding's hatchery */ shroom: "shroom", fbed: "fbed", cellar: "cellar", compost: "rot",   /* (2026-09-27) Fungiculture: a wild cluster, a cellar bed, the ladder down, the compost bin (a picker station) */ pen: "pen",   /* (2026-09-27) the island's pet pen: opens the Breeding window on arrival; with a picked recipe it is a station */ ghostlantern: "ghostlantern",   /* (2026-09-27) the Long Night's Ghost Hunt */ fletcher: "fletch",   /* (2026-09-25) the fletching table: a picker station like the anvil */ countdoor: "countdoor", countsearch: "countsearch", countbox: "countbox", countexit: "countexit",   /* (2026-09-25) the Count Room. THIS map is the one that decides whether a click does anything; the page's KIND_OF only labels it, so a new clickable object has to be in BOTH. */ mark: "mark", guildgate: "guildgate", wheat: "wheat", spot: "spot", rock: "rock", vein: "vein", tree: "tree", oak: "tree", yew: "tree", cypress: "tree", deadtree: "tree", willow: "tree", skyash: "tree", rustpine: "tree", bogwood: "tree", wreck: "rock", range: "cook", fire: "cook", furnace: "smelt", anvil: "smith", cauldron: "brew", sandpit: "rock", datepalm: "tree", pyramid: "pyramid", balloonpop: "carnival", shootgallery: "carnival", whackamole: "carnival", turnstile: "turnstile",   /* (2026-09-24) the Carnival’s stalls. As ever this map and the page’s KIND_OF both need the entry: this one decides if the click DOES anything, that one only labels it. */   /* (2026-09-24) the Great Pyramid on the Sands: clicking it opens the party window */   /* (2026-09-24) Alchemy. THIS map is what decides whether a click does anything - the page's KIND_OF only labels it - so a new clickable object has to be added in BOTH. A sand pit is mined like a rock and a date palm is chopped like a tree. */ olive: "olive", vine: "olive", hole: "hole", wildladder: "hole", agilend: "agilend",   /* (2026-09-22) the Gloam's rope ladder is a second mouth of the same pit. THIS map is the one that decides whether a click does anything; the page's KIND_OF only labels it, so adding a clickable object means adding it in BOTH. */ well: "well", house: "door", shrine: "shrine", booth: "bank", stall: "exchange", fightring: "fight", fightboard: "fight", coinstatue: "cashier", cooler: "cooler", buffet: "buffet", prizewheel: "prize", fameboard: "fame", hsboard: "hiscores", cryptdoor: "crypt", towerdoor: "tower", towerup: "towerup", cryptlever: "cryptlever", cryptexit: "cryptexit", cryptloot: "cryptloot", cashier: "cashier", slots: "game", wheel: "game", hilo: "game", mines: "game", plinko: "game", scratch: "game", cointable: "game", dicetable: "game", notice: "board", howto: "howto", jukebox: "jukebox", oddsboard: "picks", cinescreen: "cinescreen", popcorn: "popcorn", projector: "projector", cineseat: "cineseat", prizecase: "cashier", mirror: "mirror", roulette: "roulette", rrtable: "rr", rrseat: "rr", rrboard: "rrboard", barcart: "shot", roomdoor: "door", walldoor: "door", rope: "rope", ferry: "ferry", cart: "ferry", boatback: "boatback", plot: "plot", pedestal: "pedestal", islesign: "islesign" }[ob.t] || (EXAMINE_KINDS.has(ob.t) || G.EXAMINE[ob.t] ? ob.t : null);
      /* MAGIC AND WIZARDRY, THE SERVER (2026-09-26): every altar is a print station, a picker station like the anvil */
      if (!kind && G.STATIONS[ob.t]?.kind === "print") kind = "print";
      if (!kind) return;
      const at = kind === "door" && ob.door ? ob.door : G.nearestCell(ob, f);
      act = { kind, ob, x: at.x, y: at.y, name: ob.name };
      /* WHICH RECIPE (2026-09-25, the owner: "if there are multiple fish or alchemy ingredients in a users
         inventory, then it just selects the last one and they cant be accurate"). The anvil has always been told
         what to make. The fire, the range, the furnace and the cauldron were not: they take the HARDEST thing you
         can make (recipesAt is sorted hardest first), so a bag holding sardines and a bowfin only ever cooks the
         bowfin, and sand at a cauldron only ever becomes the large vial. Nothing was broken - there was simply no
         way to say. The same `pick` now works everywhere, and it is checked against the recipes of THIS station
         so a pick cannot smelt a bar at a campfire. */
      if (["smith", "cook", "smelt", "brew", "fletch", "print", "breed", "rot", "jewel"].includes(kind) && m.pick) {
        const id = String(m.pick);
        if (G.recipesAt(ob.t).some((r) => r.id === id)) act.pick = id;
      }
    }
    if (!act) return;
    act.started = 0;
    /* (2026-09-24, the owner, a SECOND time: "when it said it grabbed me i could still moove arounnd")
       AND THIS IS THE HOLE THE WALK GUARD LEFT. Refusing `walk` covers clicking the FLOOR. It does not cover
       clicking a monster — which, in a boss fight, is most of what anybody clicks — because an act paths you to
       its target right here, server-side, with nothing to do with the walk handler. So a held player clicked the
       serpent and walked to it.
       The act still lands: you can keep swinging at whatever is already beside you, which is the whole point of
       being held next to something. Only the walking to it is refused. */
    const held = S.run && S.def.pyramid && S.run.coil && S.run.coil.id === pl.id;
    const p = held ? [] : G.findPath(S.g, f, act, act.kind === "ground" ? 0 : act.reach || G.reachOf(act.kind) || 1);
    if (p === null) { this.say(pl, act.kind === "mob" && !G.launcherOf(C) ? "You can't get to that from here. It wants a bow." : "You can't reach that.", "bad"); pl.act = null; return; }
    if (held && G.cheb(pl, act) > (act.reach || G.reachOf(act.kind) || 1)) { this.say(pl, "It has you. You can only reach what is already beside you.", "bad"); pl.act = null; return; }
    /* SAME TARGET, SAME ACTION (2026-09-25, the re-click exploit). startAct builds a fresh act on every click and
       used to assign it unconditionally, so clicking the monster you were ALREADY fighting made `!a.started` true
       again and re-ran the opener below: your swing timer reset to 600ms and the monster's was pushed a full cycle
       away. Measured with a maul, re-clicking every 650ms: 45 hits in 30 seconds instead of 10, and it landed
       none at all. PvP had the identical shape. Carrying `started` across is what makes a re-click a no-op. */
    if (pl.act && (act.kind === "mob" || act.kind === "pvp") && pl.act.kind === act.kind
        && String(pl.act.id) === String(act.id) && pl.act.started) { act.started = pl.act.started; pl.urge = true; }
    /* ...and THAT is active clicking: the re-click is still a no-op for the opener, but it banks one urge, which
       shaves SWING_URGE off the next swing and is cleared the moment that swing lands. Clicking again before it
       does only sets a flag that is already set, so there is nothing to gain by clicking faster. */
    pl.act = act; pl.path = p; this.kick(S, pl, now);
  }

  /* ------------------------------------------------------------ inventory and gear */
  // all or nothing: n of k go in (topping up stacks of 99, then new slots) or none do
  give(pl, k, n = 1, f = 0) {
    const C = pl.C;
    if (G.roomFor(C.inv, k, C, f) < n) { this.say(pl, "Your inventory is full.", "bad"); return false; }
    G.addInv(C.inv, k, n, C, f); this.touch(pl); return true;
  }
  // as many of n as there's room for; returns how many went in
  giveUpTo(pl, k, n) {
    const q = Math.min(n, G.roomFor(pl.C.inv, k, pl.C));
    if (q < 1) { this.say(pl, "Your inventory is full.", "bad"); return 0; }
    G.addInv(pl.C.inv, k, q, pl.C); this.touch(pl); return q;
  }
  grant(pl, k, xp, track = true) {
    // A skill that no longer exists (a stale quest reward, an old admin macro)
    // used to throw in here, and this runs inside the tick — one bad key would
    // stop the world for everybody. Ignore it instead.
    if (!G.SKILLS[k]) { console.warn(`grant: no such skill "${k}"`); return; }
    const C = pl.C, before = G.lvlOf(C, k);
    C.xp[k] = Math.max(0, (C.xp[k] || 0) + xp); const after = G.lvlOf(C, k);
    if (xp > 0) pl.out.push({ type: "xp", k, xp, track });
    if (after > before) { this.say(pl, `Congratulations, you just advanced a ${G.SKILLS[k].name} level! You are now level ${after}.`, "good"); pl.out.push({ type: "levelup", k, lvl: after }); if (k === "hp") C.hp = Math.min(G.maxHpOf(C), C.hp + (after - before));
      /* EVERY level crossed is checked, not just `after`: one grant can span more than one level (a quest reward,
         an admin grant, a first kill at a high level), and skipping straight over 50 to land on 51 must not lose
         the announcement. In the ordinary case this loop runs once. */
      for (let l = before + 1; l <= after; l++) if (G.MILESTONES.has(l)) this.milestone(pl, k, l); }
    if (C.hp > G.maxHpOf(C)) C.hp = G.maxHpOf(C);
    this.touch(pl);
    if (xp > 0) this.emit(pl, "xp", { skill: k, xp });
  }

  /* A LEVEL THE WHOLE SERVER HEARS (2026-09-23, the owner: so people can congratulate them). G.MILESTONES is the
     list. It goes to everyone online INCLUDING the player, because the point is that they see the room being told.
     The name is sent apart from the text so the page can make it open their profile, the way it does for an
     ordinary chat line. Nothing is stored and nothing is paid: it is a chat line and that is all. */
  milestone(pl, k, lvl) {
    const text = `just reached ${G.SKILLS[k].name} level ${lvl}!`;
    for (const p of this.pls.values()) p.out.push({ type: "milestone", name: pl.name, skill: k, lvl, text });
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
    this.achEvent(pl, type);
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

  /* ------------------------------------------------------------ RUNS SURVIVE A RESTART (2026-09-27)

     The owner, with four people in the Count Room when a deploy landed: "make it so that when we push these that people
     dont get kicked out of the room if the server refreshes/updates". A deploy tears the Durable Object down; characters
     are written within SAVE_MS so THEY survive, but a run - the private crypt:/pyramid:/count: copy with its monsters,
     its gates, its quota and who paid - lived only in memory. Everyone in one came back to the door with their ante
     refunded and the clear, if they had one, gone. (The Tower never had this problem: a climb is on the character and
     towerRejoin rebuilds the floor.)

     So the runs are written to storage: every two seconds while any is on, and once more on a planned restart. The
     snapshot is the run's state, its monsters (plain objects; the only trap is respawnAt: Infinity, which JSON turns to
     null and which would bring dead monsters BACK in the Count Room - restored to Infinity below), what is on the ground,
     and the parties, with every member marked away from the moment of the restart so the ordinary held-place clock runs.
     The "gone" sets go too, or a run that ended while somebody was disconnected would refund them after a restart.

     Loading is the same shape as the other boot reads. A snapshot older than ten minutes is left alone: nobody is coming
     back to that, and a stale run holding a copy of a room is a leak. Nothing in a restored run moves until somebody is
     standing in it - mobsTick and countSpawn only run for scenes with players - so a run waits, it does not run on empty.
     A snapshot two seconds stale means the monsters are up to two seconds behind where they were; the run is otherwise
     exactly as it was, ante paid, quota counted, gates open.
     ------------------------------------------------------------ */
  runsSnapshot() {
    const runs = [];
    for (const [key, S] of this.scenes) if (S.run && /^(crypt|pyramid|count):/.test(key)) runs.push({ key, tier: S.tier ?? null, run: S.run, mobs: S.mobs, ground: S.ground || [] });
    const parties = [...(this.parties?.values() || [])].map((pt) => ({ id: pt.id, leader: pt.leader, members: [...pt.members], names: Object.fromEntries(pt.members.map((id) => [id, this.pls.get(id)?.name || pt.away?.[id]?.name || "…"])) }));
    return { runs, parties, cryptGone: [...(this.cryptGone || [])].slice(-100), countGone: [...(this.countGone || [])].slice(-100) };
  }
  runsSave(force) {
    const body = this.runsSnapshot(), sig = JSON.stringify(body);
    if (!force && sig === this.runsSig) return Promise.resolve();
    this.runsSig = sig;
    return this.ctx.storage.put("runs", { at: Date.now(), ...body }).catch(() => {});
  }
  async runsLoad() {
    const snap = await this.ctx.storage.get("runs"); if (!snap) return;
    const now = Date.now(); if (now - (snap.at || 0) > 10 * 60 * 1000) return;
    this.parties ||= new Map();
    for (const pt of snap.parties || []) if (Array.isArray(pt.members) && pt.members.length) this.parties.set(pt.id, { id: pt.id, leader: pt.leader, members: [...pt.members], away: Object.fromEntries(pt.members.map((id) => [id, { at: now, name: pt.names?.[id] || "…" }])) });
    for (const rec of snap.runs || []) {
      if (!rec?.key || !rec.run) continue;
      let S; try { S = this.scene(rec.key); } catch (e) { continue; }
      S.tier = rec.tier ?? undefined; S.run = rec.run; S.mobs = Array.isArray(rec.mobs) ? rec.mobs : S.mobs; S.ground = Array.isArray(rec.ground) ? rec.ground : []; S.whoSig = null;
      for (const m of S.mobs) if (m.respawnAt == null) m.respawnAt = Infinity;
      if (S.run.emptyAt) S.run.emptyAt = now; S.emptyAt = now;   // the held-place clocks start again from the restart, not from before it
      const gates = S.def.crypt ? CR.CRYPT.gates : S.def.pyramid ? PR.PYRAMID.gates : null;   // a gate that was open is open: the grid is rebuilt shut by scene()
      if (gates && Array.isArray(S.run.gates)) S.run.gates.forEach((open, i) => { const q = gates[i]; if (open && q) S.g[q.y][q.x] = "i"; });
    }
    this.cryptGone = new Set(snap.cryptGone || []); this.countGone = new Set(snap.countGone || []);
    this.runsSig = JSON.stringify(this.runsSnapshot());
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
    try { await this.runsSave(true); } catch (e) { /* same */ }   /* (2026-09-27) the runs, written last so they are as fresh as the characters */
    return { saved: n };
  }

  /* What the last minute looked like. Public and cheap: no character data, no
     names, nothing a player could not see by counting heads. It answers the
     only question worth asking during a launch — is the world keeping up, or
     is it one person's connection.

     Tick time is the number that matters: the world steps every TICK_MS, so a
     p95 anywhere near that budget means everybody is playing a slow game. */
  /** (2026-09-27) the King's state for /stats, so it can be checked from outside: up (with time and health), due, or next */
  hwKingState(now = Date.now()) {
    if (!G.hwOn(now)) return null; const H = this.hw || {};
    if (H.kingUp) { const m = this.scenes.get(G.HW.king.scene)?.mobs.find((x) => x.id === H.kingUp.id); return { up: true, leftS: Math.max(0, Math.round((H.kingUp.until - now) / 1000)), hp: m && !m.dead ? m.hp : H.kingUp.hp ?? null, inMire: !!m }; }
    return H.kingDue ? { due: true } : { nextS: H.kingAt ? Math.max(0, Math.round((H.kingAt - now) / 1000)) : null };
  }
  statsOf() {
    const ms = [...this.tickMs].sort((a, b) => a - b);
    const at = (p) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] : 0);
    const upS = Math.max(1, Math.round((Date.now() - this.startedAt) / 1000));
    const scenes = {};
    for (const [key, S] of this.scenes) { const n = this.playersIn(S).length; if (n) scenes[key] = n; }
    return { king: this.hwKingState(),   /* (2026-09-27) */
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
        for (const k of Object.keys(G.SKILLS)) if (!G.SKILLS[k].held) skills[k] = G.lvlOf(C, k);   /* (2026-09-27) a held skill (HOLD) stays off profiles */
        rows.push({
          id: key.slice(5),
          name: raw?.name || null,
          total: G.totalOf(C),
          xp: Math.round(Object.values(C.xp).reduce((n, v) => n + (Number(v) || 0), 0)),
          combat: G.combatOf(C),
          skills, skillXp: { ...C.xp },   /* (2026-09-22) EVERY skill's xp, not just the two with boards: it is the tie-break and the line under each row, so a new board with no xp here would rank everyone equal and print "0 xp" */
          // a couple of things worth bragging about that are not levels
          kills: Object.values(C.stats?.kills || {}).reduce((n, v) => n + v, 0),
          quests: G.questsDone(C), jobs: C.stats?.jobs | 0, tourDone: !!(C.tour && C.tour.step >= G.TOUR.length), earned: Math.round(Number(C.earned) || 0), wagered: Math.round(Number(C.wagered) || 0), zcoins: (C.found && typeof C.found === "object" ? C.found.zcoin : 0) | 0,
          runBest: C.stats?.runBest || 0,   // (2026-09-22) The Run's board; 0 means never finished a lap, and board() drops those
          tower: C.tower?.best | 0,   // (2026-09-27) the highest floor cleared, for the Tower board; 0 (never climbed) is dropped the same way
          corn: C.stats?.corn | 0,   // (2026-09-27) candy corn earned this Long Night, for the season's board
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

    /* (v96) G.HISCORES names the boards. A level board breaks ties on xp; a number board lists only people who have one (nobody is
       ranked 40th for finding no ZCoins). A row is { rank, name, v, sub }: the number, and one small thing beside it. */
    /* (2026-09-22) RESOLVED, not listed. This named its two skill boards by hand, so adding one silently fell through to
       `r[key]` — undefined for a skill — and the board came out empty. Any key that IS a skill now reads that skill's level;
       "combat" is the one board whose name differs from its skill (melee); "total" is not a skill at all. */
    const boardSkill = (key) => (G.SKILLS[key] ? key : null);   /* (2026-09-27) "combat" is no longer Melee under another name: it is the combat level, below */
    const COMBAT_KEYS = ["melee", "archery", "magic", "hp"].filter((k) => G.SKILLS[k]);
    const valOf = (r, key) => { if (key === "total") return r.total || 0; if (key === "combat") return r.combat || 0; const sk = boardSkill(key); return sk ? (r.skills?.[sk] || 0) : (r[key] || 0); };
    /* (2026-09-22) "lap" is the one board where SMALL WINS, so it sorts the other way; a 0 (never finished a run)
       is already dropped by the filter rather than ranked first. Everything else is unchanged. */
    const board = (key, kind) => [...rows].filter((r) => kind === "lvl" || valOf(r, key) > 0).sort((a, b) => (kind === "lap" ? valOf(a, key) - valOf(b, key) : valOf(b, key) - valOf(a, key)) || b.xp - a.xp).slice(0, 100)
      .map((r, i) => ({ rank: i + 1, name: r.name, v: valOf(r, key), sub: kind === "lvl" ? `${Math.round(Number(key === "total" ? r.xp : key === "combat" ? COMBAT_KEYS.reduce((n, k) => n + (Number(r.skillXp?.[k]) || 0), 0) : r.skillXp?.[boardSkill(key)]) || 0).toLocaleString()} xp` : key === "kills" ? `Combat ${r.combat ?? r.skills.melee}` : key === "quests" ? [r.tourDone ? "the tour" : "", r.jobs ? `${r.jobs} job${r.jobs === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") : key === "tower" ? `Combat ${r.combat ?? r.skills.melee}` : "" }));
    /* (2026-09-27) a clear-time board carries EVERY kept clear with the party's size on the row (`n`), fastest first, rather than
       the top twenty: the page filters to 2-, 3- or 4-man and ranks what is left, and cryptBest keeps twenty of each size. "pyr1"
       reads the Pyramid's list, kept under "p1" beside the Crypt's tiers. */
    const timeRows = (key) => { const tier = key.startsWith("crypt") ? key.slice(5) : key === "pyr1" ? "p1" : key; return (this.cryptTop?.[tier] || []).slice().sort((a, b) => a.secs - b.secs).map((r, i) => ({ rank: i + 1, name: r.names.join(" + "), n: r.names.length, v: r.secs, sub: new Date(r.at).toISOString().slice(0, 10) })); };
    const boards = {}; for (const [key, , , kind] of G.HISCORES) boards[key] = kind === "time" ? timeRows(key) : board(key, kind);
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
    if (!(this.jack.pot >= G.JACKPOT.seed)) { this.jack.pot = G.JACKPOT.seed; this.jackDirty = true; }   /* (v107: the seed grew with the ticket tables' limits; a pot saved under the old one starts from the new) */
    { const sg = (await this.ctx.storage.get("songs")) || null; this.song = sg?.song || null; this.songQ = Array.isArray(sg?.q) ? sg.q : []; }   /* (v96) the song queue outlives a restart too */
    this.cryptTop = (await this.ctx.storage.get("cryptTop")) || {};   /* (v103) the crypt's fastest clears */
    this.radio = (await this.ctx.storage.get("radio")) || null;
    this.dbl = (await this.ctx.storage.get("dbl")) || null;   /* (2026-09-25) a 2X event outlives a restart: it is the server's clock, not a player's */   /* (v86) the jukebox's station outlives a restart */
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

  /* (2026-09-22) THE RUNG AS WELL AS THE TOOL, AND IT HAS TO BE IN YOUR HANDS. `lvl` is the node's own requirement
     and nothing else: G.toolNeed turns it into the rung, so no rock, tree or fishing spot carries a tool
     requirement of its own to fall out of step with its level. Which skills want the tool HELD is G.TOOL_HELD,
     which is now all three — see the note on it in the rules file. */
  hasTool(pl, skill, lvl) {
    const gate = G.toolBlock(pl.C, skill, lvl);
    if (!gate) return true;
    const base = G.ITEMS[G.TOOL_OF[skill]], noun = base.name.replace(/^Bronze /, "").toLowerCase();
    /* Three different problems, three different lines, and the VERB comes from the skill. Telling someone holding
       a bronze rod at deep water that they "need a fishing rod" sends them to buy the one already in their hand,
       and this line said "to fish" whatever you were standing in front of until mining and woodcutting joined it. */
    const doing = G.toolUse(base).replace(/^you have to be holding one /, "").replace(/^you need one /, "");
    if (gate.held) this.say(pl, `Your ${noun} is in your bag. Equip it — you have to be holding it ${doing}.`, "bad");
    else if (!gate.have) this.say(pl, `You need a ${noun} ${doing}. Bom Trady sells them at the Prize Counter.`, "bad");
    else this.say(pl, `Your ${G.ITEMS[gate.have].name.toLowerCase()} won't touch this. You need a ${gate.need.name.toLowerCase()} ${noun} or better.`, "bad");
    return false;
  }
  /* (2026-09-27, a player: "odd I can't wear my quiver — just says 'empty what you are wearing first, your bag has no room'")
     THE POCKET IS EMPTIED WHATEVER IS WORN. C.quiver is one pocket that outlives the piece holding it, and the swap and the
     take-off both emptied it through quiverOp's unload, which first insists on a WORN pouch. A load left in the pocket while a
     shield or nothing was worn - possible from before the 2026-09-25 take-off fix, and from a bag lost any other way - could
     therefore never be handed back, and every quiver was refused for ever with a message about bag room that was not true.
     This hands the load to the bag directly, whatever the offhand holds, and says exactly what did not fit if anything. */
  pocketOut(pl) {
    const C = pl.C, q = C.quiver; if (!q) return true;
    if (!G.ITEMS[q.k] || !(q.n > 0)) { C.quiver = null; this.touch(pl); return true; }
    const n = Math.min(q.n, G.roomFor(C.inv, q.k, C));
    if (n > 0) { G.addInv(C.inv, q.k, n, C); q.n -= n; this.touch(pl); }
    const name = G.ITEMS[q.k].name.toLowerCase();
    if (q.n <= 0) { C.quiver = null; this.touch(pl); this.say(pl, `You take ${n} ${name}${n === 1 ? "" : "s"} out and put them in your bag.`); return true; }
    this.say(pl, `${q.n} ${name}${q.n === 1 ? " is" : "s are"} still loaded and your bag has no room for ${q.n === 1 ? "it" : "them"}. Free a slot and try again.`, "bad");
    return false;
  }
  equip(pl, i) {
    const C = pl.C, st = C.inv[i]; if (!st) return; const it = G.ITEMS[st.k]; if (!it?.slot) return;
    const miss = G.missingReq(C, it);
    if (miss) return this.say(pl, `You need a ${G.SKILLS[miss.skill].name} level of ${miss.lvl} to use the ${it.name.toLowerCase()}.`, "bad");
    /* (2026-09-23) THE LEVEL GOES ON AND COMES OFF WITH THE PIECE. eq holds a bare key, so a worn piece keeps its
       level in eqf[slot]; taking it off puts that level back on the entry that goes into the bag. Swapping a worn
       +2 for a bagged +3 has to move BOTH, which is why the old one is handed back with its own level. */
    const old = C.eq[it.slot], oldF = G.fLevelOf(C, it.slot);
    /* (2026-09-27, the owner: "if you switch between the magic bag and quiver, it used the spell in the quiver and the arrows in the
       magic bag") A SWAP HANDS THE LOAD BACK FIRST. C.quiver is one pocket whatever is worn, so swapping a quiver straight for a bag
       carried the arrows into the bag. Anything loaded that the new piece cannot hold goes back to the bag now, and if the bag has no
       room the swap is refused rather than the load silently changing kind. */
    if (it.slot === "shield" && C.quiver && (!it.pouch || it.pouch.ammo !== G.ammoKind(C.quiver.k))) { if (!this.pocketOut(pl)) return; }
    const takeF = G.fOf(st);
    /* (2026-09-27) A SMALLER POUCH OF THE SAME KIND. The load stayed as it was, so a 1,000 carried into a 100 quiver and it held ten
       times its size. What it cannot hold goes back to the bag first; with no room, the swap is refused rather than overfilled. */
    if (it.pouch && C.quiver && it.pouch.ammo === G.ammoKind(C.quiver.k)) {
      const cap = Math.round(it.pouch.cap * (1 + G.FORGE.pcap * (takeF | 0))), extra = Math.floor(C.quiver.n) - cap;
      if (extra > 0) {
        if (G.roomFor(C.inv, C.quiver.k, C) < extra) return this.say(pl, `The ${it.name.toLowerCase()} holds ${cap}, and ${extra} ${G.ITEMS[C.quiver.k].name.toLowerCase()}s would not fit back in your bag. Make room first.`, "bad");
        G.addInv(C.inv, C.quiver.k, extra, C); C.quiver.n = cap;
      }
    }
    if (st.n > 1) st.n--; else C.inv.splice(i, 1);
    if (old) this.give(pl, old, 1, oldF);
    C.eq[it.slot] = st.k;
    C.eqf ||= {}; if (takeF) C.eqf[it.slot] = takeF; else delete C.eqf[it.slot];
    /* (2026-09-25) A QUIVER PUT ON LOADS ITSELF from the biggest stack of arrows in the bag. Clicking the arrows was the
       only way in, and a tester with a bag full of them was looking at "Empty". */
    if (it.pouch && !C.quiver) { let bi = -1; C.inv.forEach((s, j) => { if (G.ammoKind(s.k) === it.pouch.ammo && (bi < 0 || s.n > C.inv[bi].n)) bi = j; }); if (bi >= 0) this.quiverOp(pl, { op: "load", i: bi }); }
    this.say(pl, `You ${it.slot === "weapon" ? "wield" : "put on"} the ${it.name.toLowerCase()}.`);
    this.touch(pl);
    this.emit(pl, "equip", {});
  }
  // eating: a moment's pause, and your next swing waits a little
  // lucky charms: click one and your next N bets are lucky (see G.LUCK)
  useItem(pl, i) {
    const C = pl.C, st = C.inv[i], it = st && G.ITEMS[st.k]; if (!it) return;
    if (it.drink || it.use) return this.useSpecial(pl, i, st, it);
    if (!it.luck) return;
    if ((C.luck | 0) >= G.LUCK.max) return this.say(pl, `You're as lucky as it gets (${G.LUCK.max} saved up). Go and use some outside.`, "bad");
    st.n--; if (!st.n) C.inv.splice(i, 1);
    C.luck = Math.min(G.LUCK.max, (C.luck | 0) + it.luck); this.touch(pl);
    this.say(pl, `You feel lucky. For your next ${C.luck} kills or catches, a real ZCoin is ${G.LUCK.zdrop * 100}% more likely to drop.`, "good");
  }
  /* A RARE THING IS NEVER LOST TO A FULL BAG (the owner, 2026-09-19): a real ZCoin or a rare find that won't fit goes
     straight to the bank instead, and says so. Only a full bag AND a full bank can lose one. -> "bag" | "bank" | null */
  keepRare(pl, k, n) {
    const C = pl.C;
    if (G.roomFor(C.inv, k, C) >= n) { G.addInv(C.inv, k, n, C); return "bag"; }
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
    if (Math.random() < 1 / G.JACKPOT_KILL.odds) {   /* (v92) JACKPOT KILL: the rules file says why */
      const n = G.BOUNTY[mob] * G.JACKPOT_KILL.mult, name = G.MOBS[mob].name; this.tixTo(pl, n); this.touch(pl);
      pl.out.push({ type: "jackpotkill", n, mob: name }); this.say(pl, `JACKPOT KILL! That ${name.toLowerCase()} was carrying the house's money: +${G.fmtTix(n)}.`, "loot");
      for (const p of this.pls.values()) if (p !== pl && p.C.scene === C.scene) p.out.push({ type: "casinonote", text: `🎰 ${pl.name} hit a JACKPOT KILL on a ${name.toLowerCase()}: +${G.fmtTix(n)}!` });
    }
    if (G.ROLLER.kill > 0 && Math.random() < G.ROLLER.kill && (C.roller | 0) < G.ROLLER.max) {
      C.roller = Math.min(G.ROLLER.max, (C.roller | 0) + G.ROLLER.bets); this.touch(pl);
      this.say(pl, `The fight's gone to your head. HIGH ROLLER: every table will take double from you, for your next ${C.roller} big bets.`, "loot");
    }
  }
  /* drinks, scrolls, boxes, dice, watches and free-play chips: everything in the bag that's clicked and isn't food or luck */
  /* ------------------------------------------------------------ the 2X event (2026-09-25)
     One clock for the whole world. doubleOn() is the single question every paying path asks, so there is exactly
     one place to get the answer wrong. */
  /* THE HOUSE'S OWN CHAT VOICE. A line in everybody's chat, from nobody in particular. `scene: null` matters:
     the client pops a speech bubble over the speaker when the scene matches, and there is no speaker here. */
  houseSay(text) { const t = Date.now(); for (const p of this.pls.values()) p.out.push({ type: "chat", id: "house", name: "CASINO", role: "admin", text: String(text), scene: null, t }); }
  doubleOn() { return !!(this.dbl && Date.now() < this.dbl.until); }
  doubleView() { return this.dbl && Date.now() < this.dbl.until ? { until: this.dbl.until, by: this.dbl.by, mult: G.DOUBLE.mult } : null; }
  doubleStart(by, ms) {
    this.dbl = { until: Date.now() + ms, by: String(by || "somebody"), told: false };
    this.ctx.storage.put("dbl", this.dbl).catch(() => {});
    const mins = Math.round(ms / 60000), view = this.doubleView();
    for (const p of this.pls.values()) {
      p.out.push({ type: "double", on: view });
      p.out.push({ type: "casinonote", text: `✨ ${this.dbl.by} popped a 2X POTION! Double tickets and double crafting xp for EVERYONE for ${mins} minutes.` });
      this.say(p, `✨ 2X EVENT: ${this.dbl.by} cracked a 2X Potion. Everything you earn is doubled for the next ${mins} minutes - tickets and crafting xp, everywhere, for everyone on the server.`, "loot");
    }
    this.houseSay(`✨ 2X EVENT — ${this.dbl.by} popped a 2X Potion. Double tickets and crafting xp for ${mins} minutes.`);
  }


  /* ------------------------------------------------------------ FUNGICULTURE (2026-09-27): the cellar, its beds, the wild clusters
     The beds are plots in all but name (G.FUNGI instead of G.CROPS, compost to plant, isle.beds instead of isle.plots), and a
     wild cluster is a ghost lantern that never goes away: once a Chicago day per player per cluster, remembered in C.fung. */
  fungDay(C) { const day = G.chicagoDay(); if (!C.fung || C.fung.day !== day) C.fung = { day, got: [] }; return C.fung; }
  /** where the cellar's steps come out on the island: beside the owner's ladder, or the island's arrival spot */
  cellarUp(S) {
    const I = this.isleOf(S), d = (I?.decor || []).find((x) => x.k === G.FUNG.ladder && x.at === "isle");
    return { scene: G.isleKey(I, S.owner), x: d ? d.x : G.SCENES.isle.entry.x, y: d ? d.y + 1 : G.SCENES.isle.entry.y };
  }
  /* (2026-09-27, the owner: "let other people visit others dungeons. when i try to visit it says its padlocked") A VISITOR MAY CLIMB DOWN.
     The cellar is part of the island, so it follows the island's own door: open to visitors, open down here too. Looking is all a visitor
     does - the beds already answer "Somebody else's mushrooms" to anyone but the owner, and planting checks the owner. An owner who is
     away is read from the copy Charon brought up for the island (S.isleCopy), handed down so the cellar shows their beds as left. */
  fungDown(S, pl) {
    if (!S.owner) return;
    const mine = S.owner === pl.id, I = this.isleOf(S);
    if (!mine && !I?.open) return this.say(pl, "The hatch is shut: this island is closed to visitors.", "bad");
    const S2 = this.scene(`cellar:${S.owner}`);
    if (!mine) { S2.ownerName = S.ownerName; if (S.isleCopy && !this.pls.get(S.owner)) S2.isleCopy = S.isleCopy; }
    this.moveToScene(pl, `cellar:${S.owner}`, null, G.SCENES.cellar.entry); pl.dir = "north";
    return this.say(pl, mine ? "You climb down into the cellar. It smells like a forest floor after rain." : `You climb down into ${S.ownerName || "their"}'s cellar. The beds are theirs: look, don't pick.`);
  }
  fungPick(S, pl, ob) {
    const C = pl.C, k = ob.k, sk = `spawn_${k}`, F = G.FUNGI[sk]; if (!F) return;
    const lv = G.lvlOf(C, "fungiculture");
    if (lv < F.lvl) return this.say(pl, `You need a Fungiculture level of ${F.lvl} to pick ${G.ITEMS[k].name.toLowerCase()}.`, "bad");
    const h = this.fungDay(C), lid = ob.lid || `${S.key}:${ob.x},${ob.y}`;
    if (h.got.includes(lid)) return this.say(pl, "You've had what this one had today. It'll fruit again tomorrow.", "bad");
    const n = rint(G.FUNG.wildN[0], G.FUNG.wildN[1]);
    if (!this.give(pl, k, n)) return;
    h.got.push(lid); if (h.got.length > 60) h.got.splice(0, h.got.length - 60); this.touch(pl);
    this.gained(S, pl, k, n); this.grant(pl, "fungiculture", Math.max(10, Math.round(F.xp * G.FUNG.wildXp)));
    const spawn = Math.random() < G.FUNG.wildSpawn && this.giveUpTo(pl, sk, 1);
    const nose = G.truffleNose(C), truf = nose && Math.random() < G.FUNG.truffle.pick && this.giveUpTo(pl, "truffle", 1), trufSp = nose && Math.random() < G.FUNG.truffle.spawn && this.giveUpTo(pl, "spawn_truffle", 1);
    this.say(pl, `You pick ${n} ${G.ITEMS[k].name.toLowerCase()}${spawn ? ", and scrape up some spawn with it" : ""}.${truf ? " Your pig roots out a black truffle beside it!" : ""}${trufSp ? " The pig turns up truffle spawn, too." : ""}`, truf || trufSp ? "loot" : "good");
    this.emit(pl, "gather", { k, n });
  }
  /** a click on a bed: plant (the page asks what), wait, or harvest */
  fungBed(S, pl, ob, now) {
    const I = this.isleOf(S); if (!I || !S.def?.cellar) return;
    I.beds ||= Array(G.FUNG.bedMax).fill(null);
    if (S.owner !== pl.id) return this.say(pl, "Somebody else's mushrooms.");
    if (ob.i >= G.bedsOf(I)) return this.say(pl, "This bed is boarded over. A bigger island opens it: Charon does the upgrades.", "bad");
    const p = I.beds[ob.i];
    if (!p) return pl.out.push({ type: "fplant", i: ob.i });
    const F = G.FUNGI[p.k], yk = G.fungYield(p.k), left = p.at + (p.ms || F.ms) - now, nm = G.ITEMS[yk].name.toLowerCase();
    if (left > 0) return this.say(pl, `Your ${nm} will be ready in ${left > 90000 ? `about ${Math.round(left / 60000)} minutes` : `${Math.ceil(left / 1000)} seconds`}.`);
    const n = Math.max(1, Math.round(rint(F.yield[0], F.yield[1]) * (1 + G.petFx(pl.C).grow / 100)));   /* the Truffle Pig's heavier harvests reach the cellar too */
    if (!this.give(pl, yk, n)) return;
    const want = G.SEED_BACK + (Math.random() < G.SEED_EXTRA ? 1 : 0), back = this.giveUpTo(pl, p.k, want);
    const trufSp = G.truffleNose(pl.C) && p.k !== "spawn_truffle" && Math.random() < G.FUNG.truffle.bed && this.giveUpTo(pl, "spawn_truffle", 1);
    I.beds[ob.i] = null; this.touch(pl);
    this.gained(S, pl, yk, n); this.grant(pl, "fungiculture", F.xp);
    this.say(pl, `You harvest ${n} ${nm}${back ? `, and ${back === 1 ? "a handful" : back === 2 ? "two handfuls" : `${back} handfuls`} of spawn with them` : ""}.${trufSp ? " Your pig has been rooting in the next bed: truffle spawn!" : ""}`, trufSp ? "loot" : "good");
  }
  fungOp(S, pl, m) {
    if (m.op !== "plant" || !S.def?.cellar || S.owner !== pl.id) return;
    const C = pl.C, I = C.isle, i = m.i | 0, k = String(m.k || ""), F = G.FUNGI[k];
    I.beds ||= Array(G.FUNG.bedMax).fill(null);
    if (!F || i < 0 || i >= G.bedsOf(I) || I.beds[i] || !S.objs.some((o) => o.t === "fbed" && o.i === i && G.cheb(pl, o) <= 1)) return;
    if (G.lvlOf(C, "fungiculture") < F.lvl) return this.say(pl, `You need a Fungiculture level of ${F.lvl} to grow ${G.ITEMS[F.yields].name.toLowerCase()}.`, "bad");
    if (G.countItems(C, [k]) < 1) return;
    if (G.countItems(C, ["compost"]) < F.compost) return this.say(pl, `That bed wants ${F.compost} compost first, and you have ${G.countItems(C, ["compost"])}. The bin in the corner makes it.`, "bad");
    G.takeInv(C.inv, k, 1); G.takeInv(C.inv, "compost", F.compost);
    const rain = G.charmOf(C, "rainmaker"), dev = this.env?.DEV === "1", ms = Math.round(F.ms * (1 - rain / 100) / (dev ? 60 : 1));   /* Rainmaker waters a cellar too; on a DEV server a bed grows sixty times faster, so it can be watched */
    I.beds[i] = { k, at: Date.now(), ...(rain || dev ? { ms } : {}) }; this.touch(pl);
    return this.say(pl, `You work the spawn into the compost. ${G.ITEMS[F.yields].name} in ${ms >= 5400000 ? `${Math.round(ms / 3600000 * 10) / 10} hours` : `${Math.round(ms / 60000)} minutes`}, whether you're here or not.`, "good");
  }
  /* ------------------------------------------------------------ BREEDING (2026-09-27): the island's pen
     One pairing at a time, per island (eggs are the hatchery's, below). The food is taken ALL AT ONCE at the start - the
     owner: "every hour feels like micromanaging" - and the clock then runs untouched, offline included, because it is only a
     start time and a length on the character. Pets in the pen are off `pets` so they cannot be worn, traded or bred twice;
     they go back on at collect, or at release. The child is decided when the pairing STARTS, so collecting cannot be
     re-rolled by anyone who reads the code. */
  penOf(S) { return S?.objs?.find((o) => o.t === "pen") || null; }
  /** (2026-09-27) the LOCAL dev server breeds 720 times faster (72 hours in 6 minutes) so a pairing can be tested end to end; production never */
  penMs(ms) { return this.env?.DEV === "1" ? Math.max(20000, Math.round(ms / 720)) : ms; }
  penView(S, pl) { const P = pl.C.pen; pl.out.push({ type: "pen", pen: P ? { kind: P.kind, a: P.a || null, b: P.b || null, egg: P.egg || null, child: P.child, at: P.at, ms: P.ms } : null, now: Date.now() }); }
  penOp(S, pl, m) {
    const C = pl.C, op = String(m.op || ""), now = Date.now(), bad = (t) => this.say(pl, t, "bad");
    const pen = this.penOf(S);
    if (!pen || !S.def?.island) return;
    if (S.owner !== pl.id) return bad("That's somebody else's pen.");
    if (G.cheb(pl, pen) > G.BREED.reach + 1) return bad("Walk over to the pen first.");
    const lv = G.lvlOf(C, "breeding"), P = C.pen;
    if (op === "view") return this.penView(S, pl);
    const needAll = (list) => { const short = list.filter(([k, n]) => G.countItems(C, [k]) < n); return short.length ? `You need ${short.map(([k, n]) => `${n} ${G.ITEMS[k].name.toLowerCase()} (you have ${G.countItems(C, [k])})`).join(", ")}.` : null; };
    if (op === "pair" && P) return bad("The pen is busy. Collect it, or let it go, first.");
    if (op === "pair") {
      const a = G.petById(C, String(m.a || "")), b = G.petById(C, String(m.b || "")), pr = G.pairOf(a, b);
      if (pr.no) return bad(pr.no);
      if (lv < pr.lvl) return bad(`That takes Breeding ${pr.lvl}. You're ${lv}.`);
      const short = needAll(pr.food); if (short) return bad(short);
      /* (2026-09-27) THE PICKS: one stat from each parent (m.sa, m.sb) and, for a Greater, whose look (m.look). An old page that
         sends none gets each parent's strongest, and a random look, which is what breeding did before. */
      const SA = G.petStats(a), SB = G.petStats(b), sa = String(m.sa || ""), sb = String(m.sb || "");
      const pA = sa && sa in SA ? [sa, SA[sa]] : G.bestStat(a, sb), pB = sb && sb in SB ? [sb, SB[sb]] : G.bestStat(b, pA[0]);
      if (pA[0] && pA[0] === pB[0]) return bad("Pick two different stats, one from each parent.");
      /* checked everything: now take the food and the pets */
      for (const [k, n] of pr.food) G.takeInv(C.inv, k, n);
      C.pets = C.pets.filter((p) => p.id !== a.id && p.id !== b.id);
      if (C.eq.pet === a.id || C.eq.pet === b.id) C.eq.pet = null;
      let child;
      if (pr.kind === "legend") child = { k: pr.child, fx: G.legendFx(pr.child, pA, pB) };
      else { const kind = pr.kinds.includes(String(m.look)) ? String(m.look) : pr.kinds[Math.random() < 0.5 ? 0 : 1]; child = { k: kind, tier: 1, fx: G.mixFx("greater", pA, pB) }; }
      C.pen = { kind: pr.kind, a, b, child, at: now, ms: this.penMs(pr.ms) };
      this.grant(pl, "breeding", G.BREED[pr.kind].xpStart); this.touch(pl);
      this.say(pl, `${G.petLabel(a)} and ${G.petLabel(b)} settle into the pen with the food. Come back in ${Math.round(pr.ms / 3600000)} hours.`, "good");
      return this.penView(S, pl);
    }
    if (op === "collect") {
      if (!P) return;
      if (now < P.at + P.ms) { const left = P.at + P.ms - now, h = Math.floor(left / 3600000), mi = Math.ceil((left % 3600000) / 60000); return bad(`Not yet: ${h ? `${h} h ` : ""}${mi} min to go.`); }
      /* (2026-09-27, the owner: "if someone succesfully breeds a greater or legendary baby it shouldnt come back right?") the two parents
         BECOME the baby: nothing comes back at collect. Stopping early (release) still hands them back. */
      const back = [];
      if (G.petsOf(C).length + 1 > 50) return bad("You have too many pets to take another. Let one go first.");
      const pet = { id: `pt${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, k: P.child.k, name: "", ...(P.child.tier ? { tier: 1 } : {}), ...(P.child.fx ? { fx: P.child.fx } : {}) };   /* a Legendary keeps its picked stats too */
      C.pets.push(...back, pet);
      const xp = P.kind === "egg" ? G.EGGS[P.egg].xp : G.BREED[P.kind].xpEnd;
      C.pen = null; this.grant(pl, "breeding", xp); this.touch(pl);
      this.say(pl, `${P.kind === "egg" ? "The egg hatches" : "A new pet"}: ${G.petLabel(pet)}${pet.fx ? ` (${G.petFxText(pet.fx)})` : ""}. It's in your Equipment tab.`, "loot");
      if (P.kind !== "greater") for (const q of this.pls.values()) q.out.push({ type: "casinonote", text: `${P.kind === "legend" ? "\u{1F451}" : "\u{1F95A}"} ${pl.name} ${P.kind === "legend" ? "bred a Legendary" : "hatched"}: ${G.PETS[pet.k].name}!` });
      return this.penView(S, pl);
    }
    if (op === "release") {
      if (!P) return;
      const back = [P.a, P.b].filter(Boolean); C.pets.push(...back); C.pen = null; this.touch(pl);
      this.say(pl, back.length ? "You open the pen. Both pets come back to you; the food is gone." : "You take the nest apart. The egg is lost.", "bad");
      return this.penView(S, pl);
    }
  }

  /* THE HATCHERY (2026-09-27, the owner: "you simply place it down and then place an egg in it and let it hatch"). A decor piece
     from Yahsmeena, one per island. One egg at a time: the egg and BREED.hatch.food Ordinary pet food go in, the clock runs, the
     pet comes out. No level, no gem, no nest. C.hatch is the one slot. */
  hatchOf(S) { return S?.objs?.find((o) => o.t === "hatchery") || null; }
  hatchView(S, pl) { const H = pl.C.hatch; pl.out.push({ type: "hatch", hatch: H ? { egg: H.egg, child: H.child, at: H.at, ms: H.ms } : null, now: Date.now() }); }
  hatchOp(S, pl, m) {
    const C = pl.C, op = String(m.op || ""), now = Date.now(), bad = (t) => this.say(pl, t, "bad"), hb = this.hatchOf(S), H = C.hatch;
    if (!hb) return;
    if (S.owner !== pl.id) return bad("That's somebody else's hatchery.");
    if (G.cheb(pl, hb) > G.BREED.reach + 1) return bad("Walk over to the hatchery first.");
    if (op === "view") return this.hatchView(S, pl);
    if (op === "egg") {
      if (H) return bad("There's already an egg in it.");
      const k = String(m.k || ""), E = G.EGGS[k]; if (!E) return;
      const food = G.RANKS.ordinary.food, n = G.BREED.hatch.food;
      if (G.countItems(C, [k]) < 1) return;
      if (G.countItems(C, [food]) < n) return bad(`An egg needs ${n} Ordinary pet food to hatch on, and you have ${G.countItems(C, [food])}. Cook it at a campfire (Cooking 20).`);
      G.takeInv(C.inv, k, 1); G.takeInv(C.inv, food, n);
      C.hatch = { egg: k, child: { k: E.pet }, at: now, ms: this.penMs(E.ms) };
      this.grant(pl, "breeding", Math.round(E.xp * 0.1)); this.touch(pl);
      this.say(pl, `The ${G.ITEMS[k].name.toLowerCase()} settles into the straw under the lamp. ${Math.round(E.ms / 3600000)} hours.`, "good");
      return this.hatchView(S, pl);
    }
    if (op === "collect") {
      if (!H) return;
      if (now < H.at + H.ms) { const left = H.at + H.ms - now, h = Math.floor(left / 3600000), mi = Math.ceil((left % 3600000) / 60000); return bad(`Not yet: ${h ? `${h} h ` : ""}${mi} min to go.`); }
      if (G.petsOf(C).length + 1 > 50) return bad("You have too many pets to take another. Let one go first.");
      const pet = { id: `pt${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, k: H.child.k, name: "" };
      C.pets.push(pet); C.hatch = null; this.grant(pl, "breeding", G.EGGS[H.egg]?.xp || 0); this.touch(pl);
      this.say(pl, `The egg hatches: a ${G.PETS[pet.k].name}! It's in your Equipment tab.`, "loot");
      for (const q of this.pls.values()) q.out.push({ type: "casinonote", text: `\u{1F95A} ${pl.name} hatched a ${G.PETS[pet.k].name}!` });
      return this.hatchView(S, pl);
    }
  }
  /** once a minute-ish: the Mimic's present, once a Chicago day, to whoever is wearing one */
  petDaily() {
    const day = G.chicagoDay();
    for (const p of this.pls.values()) {
      if (!(G.petFx(p.C).gift > 0) || p.C.giftDay === day) continue;
      const pool = G.PET_GIFTS.filter(([, , w]) => w > 0), tot = pool.reduce((a, [, , w]) => a + w, 0); let r = Math.random() * tot, pick = pool[0];
      for (const g of pool) { if ((r -= g[2]) < 0) { pick = g; break; } }
      const [k, [lo, hi]] = pick, n = rint(lo, hi);
      if (!this.give(p, k, n)) continue;
      p.C.giftDay = day; this.touch(p);
      this.say(p, `${G.petLabel(G.activePet(p.C))} coughs something up: ${n > 1 ? `${n.toLocaleString()} ` : "a "}${G.ITEMS[k].name.toLowerCase()}.`, "loot");
    }
  }
  /* ------------------------------------------------------------ THE STORE (2026-09-27)
     Tickets only, prices from the rules, never from the message. A cosmetic is owned once and worn at once; a boost is given or
     started. The 2X potion here is the same room-wide event the dropped potion starts, in the buyer's name, and it refuses (charging
     nothing) while one runs. `set` wears or removes an owned cosmetic in a slot. Every write goes through touch(), and the roster
     signature carries the name's look, so the change reaches everyone on the next tick. */
  storeOp(S, pl, m) {
    const C = pl.C, op = String(m.op || ""), id = String(m.id || ""), it = G.STORE[id];
    C.store ||= { own: [], name: {} }; C.store.own ||= []; C.store.name ||= {};
    if (op === "set") {
      const slot = String(m.slot || ""); if (!G.STORE_SLOTS.includes(slot)) return;
      if (!m.id) { C.store.name[slot] = null; this.touch(pl); return; }
      if (!it || it.slot !== slot || !C.store.own.includes(id)) return this.say(pl, "You don't own that.", "bad");
      C.store.name[slot] = id; this.touch(pl); return;
    }
    if (op !== "buy" || !it) return;
    if (it.corn) return this.say(pl, `Hexa sells that, at the Night Market, for candy corn.`, "bad");   /* (2026-09-27) a Long Night cosmetic has no ticket price */
    const have = G.tixIn(C);
    if (it.kind === "double" && this.dbl && Date.now() < this.dbl.until) { const left = Math.ceil((this.dbl.until - Date.now()) / 60000); return this.say(pl, `A 2X event is already running - ${left} minute${left === 1 ? "" : "s"} left. It's yours to buy when it ends.`, "bad"); }
    if (it.kind !== "double" && it.kind !== "give" && C.store.own.includes(id)) return this.say(pl, "You own that already.", "bad");
    if (have < it.price) return this.say(pl, `${it.name} is ${G.fmtTix(it.price)}. You have ${G.fmtTix(have)}.`, "bad");
    if (it.kind === "give") { if (!G.roomFor(C.inv, it.give[0], C)) return this.say(pl, "Your bag is full.", "bad"); }
    G.takeInv(C.inv, "tickets", it.price);
    if (it.kind === "double") { this.touch(pl); this.doubleStart(pl.name, G.DOUBLE.ms); this.say(pl, `${it.name} - ${G.fmtTix(it.price)}. The room is yours for half an hour.`, "loot"); return; }
    if (it.kind === "give") { if (!this.give(pl, it.give[0], it.give[1])) { G.addInv(C.inv, "tickets", it.price, C); this.touch(pl); return; } this.touch(pl); return this.say(pl, `${it.name} - ${G.fmtTix(it.price)}.`, "loot"); }
    C.store.own.push(id); C.store.name[it.slot] = id; this.touch(pl);
    return this.say(pl, `${it.name} - ${G.fmtTix(it.price)}. Wearing it now.`, "loot");
  }
  /* ------------------------------------------------------------ THE LONG NIGHT (2026-09-27)
     Two clocks the server owns, persisted like the 2X event's: the Pumpkin King's hour and Nightfall. THE KING IS NOT A PLACEMENT.
     An empty scene is torn down after two minutes and rebuilt from the rules when somebody walks in, so a monster with an hour's
     respawn would simply vanish; instead the hour is a world clock, "due" is remembered, and the King is pushed into the Mire the
     moment it is due AND somebody is standing there to see him (or within the same hour, whenever the first person arrives). He
     stands HW.king.stays and then leaves, and the next hour starts from when he fell. */
  hwSave() { this.ctx.storage.put("hw", this.hw).catch(() => {}); }
  hwTick(now) {
    if (!G.hwOn()) return;
    const H = this.hw;
    /* (2026-09-27) THE OPENING LINE, once for the whole event: a minute after the first boot with the event on, so the room has
       reconnected from the launch restart and actually hears it. Kept in the saved state, so a later restart does not repeat it. */
    if (!H.opened && now - this.startedAt > 60000) {
      H.opened = true; this.hwSave();
      this.houseSay(`\u{1F383} THE LONG NIGHT HAS BEGUN. Candy corn falls off everything you kill and gather. Hexa's Night Market is open in the Yard, the Pumpkin King rises every hour in the Lantern Mire, and it all ends on November 2nd. The wiki has the full guide.`);
      for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: "\u{1F383} The Long Night has begun. Hexa's Night Market is open in the Yard." });
    }
    if (!H.kingAt) { H.kingAt = now + 5 * 60000; this.hwSave(); }   /* a fresh event: the first King five minutes after the first boot */
    if (!H.kingDue && !H.kingUp && now >= H.kingAt) {
      H.kingDue = true; this.hwSave();
      this.houseSay("🎃 THE PUMPKIN KING RISES in the Lantern Mire. He stands twenty minutes. Bring fire, and bring friends.");
      for (const p of this.pls.values()) { p.out.push({ type: "casinonote", text: "🎃 The Pumpkin King rises in the Lantern Mire." }); p.out.push({ type: "hw", king: true }); }
    }
    if (H.kingDue) { const S = this.scenes.get(G.HW.king.scene); if (S && this.playersIn(S).length) this.hwSpawnKing(S, now); }
    if (H.kingUp) {
      const S = this.scenes.get(G.HW.king.scene), m = S?.mobs.find((x) => x.id === H.kingUp.id);
      /* (2026-09-27, the owner: "no one is fighting the pumpkin right now, can you verify if its spawned") HE OUTLIVES AN EMPTY MIRE
         AND A RESTART. A map nobody stands in is torn down after two minutes, and a restart rebuilds every map empty; both took the
         King with them, and this read his absence as "gone" and cancelled him until the next hour - so the last person to walk
         out of the Mire quietly ended the fight for everybody. Now a missing King who is still inside his twenty minutes is put
         back, at the health he was left on, the moment somebody is in the Mire. Only the clock running out, or a kill, ends him. */
      if (m && !m.dead && now < H.kingUp.until) { if (H.kingUp.hp !== m.hp) { H.kingUp.hp = m.hp; if (this.tickN % 100 === 0) this.hwSave(); } }
      else if (now >= H.kingUp.until) { if (S && m) { S.mobs = S.mobs.filter((x) => x.id !== m.id); S.whoSig = null; } H.kingUp = null; H.kingAt = now + G.HW.king.every; this.hwSave(); this.houseSay("🎃 The Pumpkin King sinks back into the Mire. Next hour."); }
      else if (!m && S && this.playersIn(S).length) {
        const d = G.MOBS.pumpkinking, [x, y] = G.HW.king.at, hp = Math.max(1, Math.min(d.hp, H.kingUp.hp || d.hp));
        S.mobs.push({ id: H.kingUp.id, t: "pumpkinking", x, y, hx: x, hy: y, hp, maxHp: d.hp, path: [], step: null, face: 1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: now, aggro: d.aggro });
        S.whoSig = null;
        for (const p of this.playersIn(S)) this.say(p, "The Pumpkin King is still here. He was only waiting.", "bad");
      }
    }
    const night = G.nightfallOn(now);
    if (night !== !!H.night) { H.night = night; this.hwSave(); this.houseSay(night ? `🌙 NIGHTFALL. For the next hour every candy corn drop is doubled. Mind the lanterns.${G.hwDaysLeft(now) <= 7 ? ` ${G.hwDaysLeft(now)} night${G.hwDaysLeft(now) === 1 ? "" : "s"} of the Long Night left: spend your corn.` : ""}` : "The night lifts. Candy corn is back to its usual rate."); for (const p of this.pls.values()) p.out.push({ type: "hw", night }); }
  }
  hwSpawnKing(S, now) {
    const H = this.hw, d = G.MOBS.pumpkinking, [x, y] = G.HW.king.at, id = `${S.key}king${now.toString(36)}`;
    S.mobs.push({ id, t: "pumpkinking", x, y, hx: x, hy: y, hp: d.hp, maxHp: d.hp, path: [], step: null, face: 1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: now, aggro: d.aggro });
    S.whoSig = null; H.kingDue = false; H.kingUp = { id, until: now + G.HW.king.stays, slain: false, hp: d.hp }; this.hwSave();
    for (const p of this.playersIn(S)) this.say(p, "The ground in the clearing splits and the Pumpkin King climbs out of it.", "bad");
  }
  hwKingDown(pl, now, helpers = []) {
    const H = this.hw; if (H.kingUp) H.kingUp.slain = true;
    H.kingUp = null; H.kingAt = now + G.HW.king.every; this.hwSave();
    const who = helpers.length ? `${pl.name} and ${helpers.length} other${helpers.length === 1 ? "" : "s"}` : pl.name;   /* (2026-09-27) an open boss is a crowd's kill */
    this.houseSay(`🎃 ${who} put the Pumpkin King down. He'll be back on the hour.`);
    for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: `🎃 ${who} killed the Pumpkin King!` });
  }
  /** (2026-09-27) /pumpkin: where the King is in his hour, in one line */
  hwKingLine(now = Date.now()) {
    if (!G.hwOn(now)) return "The Pumpkin King only walks during the Long Night.";
    const H = this.hw || {}, mm = (ms) => { const t = Math.max(0, Math.round(ms / 1000)), m = Math.floor(t / 60), sec = t % 60; return m ? `${m} min ${String(sec).padStart(2, "0")} s` : `${sec} s`; };
    if (H.kingUp) {
      const S = this.scenes.get(G.HW.king.scene), m = S?.mobs.find((x) => x.id === H.kingUp.id);
      const hp = m && !m.dead ? ` He has ${Math.max(0, m.hp).toLocaleString()} of ${m.maxHp.toLocaleString()} health left.` : "";
      return `\u{1F383} The Pumpkin King is UP in the Lantern Mire, for another ${mm(H.kingUp.until - now)}.${hp}`;
    }
    if (H.kingDue) return "\u{1F383} The Pumpkin King is due NOW: he climbs out the moment somebody walks into the Lantern Mire.";
    if (H.kingAt) return `\u{1F383} The Pumpkin King rises in the Lantern Mire in ${mm(H.kingAt - now)}.`;
    return "\u{1F383} The Pumpkin King rises in the Lantern Mire within the hour.";
  }
  hwDay(C) { const day = G.chicagoDay(); if (!C.hw || C.hw.day !== day) C.hw = { day, trick: false, lanterns: [] }; return C.hw; }
  /** (2026-09-27) every candy corn the world hands out comes through here, so c.stats.corn is the season's board */
  hwGive(pl, n) { if (!this.give(pl, "candycorn", n)) return false; (pl.C.stats ||= G.freshStats()).corn = (pl.C.stats.corn | 0) + n; return true; }
  hwLantern(S, pl, ob) {
    const C = pl.C; if (!G.hwOn()) return;
    const h = this.hwDay(C), lid = ob.lid || `${S.key}:${ob.x},${ob.y}`;
    if (h.lanterns.includes(lid)) return this.say(pl, "This one's already given you what it had today.", "bad");
    if (h.lanterns.length >= G.HW.lanterns) return this.say(pl, "You've found every lantern there is today. Ten. The rest are just lanterns.", "bad");
    const n = G.HW.lanternCorn * (G.nightfallOn() ? 2 : 1);
    if (!this.hwGive(pl, n)) return;
    h.lanterns.push(lid); this.touch(pl);
    this.say(pl, `The lantern gutters out in your hand and leaves ${n} candy corn behind. ${h.lanterns.length} of ${G.HW.lanterns} today.`, "loot");
    this.emit(pl, "gather", { k: "candycorn", n });
  }
  hwFit(pl, k) {
    const C = pl.C, v = C.van, it = G.VANITY[k]; if (!it?.corn) return;
    if (v.own.includes(k)) return this.say(pl, "You own that already.", "bad");
    const have = G.countItems(C, ["candycorn"]);
    if (have < it.corn) return this.say(pl, `${it.name} is ${it.corn} candy corn. You have ${have}.`, "bad");
    G.takeInv(C.inv, "candycorn", it.corn); v.own.push(k); v.on[it.slot] = k; this.touch(pl);
    return this.say(pl, `${it.name} — ${it.corn} candy corn. Wearing it now. Ronde does the colours.`, "loot");
  }
  hwOp(S, pl, m) {
    const C = pl.C, op = String(m.op || ""); if (!G.hwOn()) return this.say(pl, "The Long Night is over.", "bad");
    if (op === "fit") return this.hwFit(pl, String(m.k || ""));
    if (op === "trick") {
      const n = S.npcs.find((x) => x.id === m.npc); if (!n || G.cheb(pl, n) > (n.reach || 3)) return this.say(pl, "Say it to somebody's face.", "bad");
      const h = this.hwDay(C); if (h.trick) return this.say(pl, "Once a day. Tomorrow.", "bad");
      h.trick = true; this.touch(pl);
      const T = G.HW.trick, r = Math.random();
      if (r < T.trickAt) {   /* a trick */
        const which = Math.random();
        if (which < 0.4 && G.countItems(C, ["candycorn"]) >= 5) { G.takeInv(C.inv, "candycorn", 5); this.touch(pl); return this.say(pl, `"Trick." ${n.name} takes five candy corn off you and looks very pleased about it.`, "bad"); }
        if (which < 0.7 && !S.def.interior) { const S2 = this.scene("boneyard"); pl.act = null; pl.path = []; this.moveToScene(pl, "boneyard", null, { x: 22, y: 12 }); return this.say(pl, `"Trick." Everything goes black for a second and you're standing in the Boneyard. ${n.name} is nowhere.`, "bad"); }
        if (this.give(pl, "cobweb", 1)) return this.say(pl, `"Trick." ${n.name} drops a spider down your collar. It leaves an enormous cobweb in your bag and no explanation.`, "bad");
        return this.say(pl, `"Trick." ${n.name} laughs and gives you nothing at all.`, "bad");
      }
      const p = Math.random();
      if (p < T.pie && this.give(pl, "pumpkinpie", 1)) return this.say(pl, `"Treat." ${n.name} hands you a pumpkin pie, still warm.`, "loot");
      if (p < T.pie + T.seed && this.give(pl, "seed_pumpkin", 2)) return this.say(pl, `"Treat." ${n.name} gives you two pumpkin seeds. "Plant them tonight."`, "loot");
      const c = rint(T.corn[0], T.corn[1]) * (G.nightfallOn() ? 2 : 1); if (this.hwGive(pl, c)) return this.say(pl, `"Treat." ${n.name} pours ${c} candy corn into your hands.`, "loot");
      return;
    }
    if (op === "pet") {   /* (2026-09-27) the Black Cat off the shelf */
      const n = S.npcs.find((x) => x.opens === "market"); if (!n || G.cheb(pl, n) > (n.reach || 3)) return this.say(pl, "You need to be at the Night Market, with Hexa.", "bad");
      const [k, corn] = G.HW.pet, have = G.countItems(C, ["candycorn"]);
      if (C.pets.some((p) => p.k === k)) return this.say(pl, `You already have a ${G.PETS[k].name}. One is plenty.`, "bad");
      if (have < corn) return this.say(pl, `The ${G.PETS[k].name} is ${corn.toLocaleString()} candy corn. You have ${have.toLocaleString()}.`, "bad");
      G.takeInv(C.inv, "candycorn", corn);
      const pet = { id: `pt${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, k, name: "" };
      C.pets.push(pet); if (!C.eq.pet) C.eq.pet = pet.id; this.touch(pl);
      this.say(pl, `${G.PETS[k].name} - ${corn.toLocaleString()} candy corn. It looks at you like it was always going to come. Name it in your Equipment tab.`, "loot");
      for (const q of this.pls.values()) if (q !== pl) q.out.push({ type: "casinonote", text: `\u{1F408}‍⬛ ${pl.name} bought the Black Cat off Hexa's shelf.` });
      return;
    }
    if (op === "cos") {   /* (2026-09-27) the Night Market's name cosmetics: corn, and then the Store owns them like any other */
      const n = S.npcs.find((x) => x.opens === "market"); if (!n || G.cheb(pl, n) > (n.reach || 3)) return this.say(pl, "You need to be at the Night Market, with Hexa.", "bad");
      const it = G.STORE[String(m.id || "")]; if (!it || !it.corn || !it.event) return;
      C.store ||= { own: [], name: {} }; C.store.own ||= []; C.store.name ||= {};
      if (C.store.own.includes(it.id)) return this.say(pl, "You own that already.", "bad");
      const have = G.countItems(C, ["candycorn"]); if (have < it.corn) return this.say(pl, `${it.name} is ${it.corn.toLocaleString()} candy corn. You have ${have.toLocaleString()}.`, "bad");
      G.takeInv(C.inv, "candycorn", it.corn); C.store.own.push(it.id); C.store.name[it.slot] = it.id; this.touch(pl);
      return this.say(pl, `${it.name} - ${it.corn.toLocaleString()} candy corn. Wearing it now, and it's yours after the Long Night too.`, "loot");
    }
    if (op === "buy") {
      const n = S.npcs.find((x) => x.opens === "market"); if (!n || G.cheb(pl, n) > (n.reach || 3)) return this.say(pl, "You need to be at the Night Market, with Hexa.", "bad");
      const row = G.HW.market[m.i | 0]; if (!row) return;
      const [k, qty, corn] = row, times = Math.max(1, Math.min(10, m.n | 0 || 1)), cost = corn * times, have = G.countItems(C, ["candycorn"]);
      if (have < cost) return this.say(pl, `${qty > 1 ? `${qty} ` : ""}${G.ITEMS[k].name} is ${corn} candy corn${times > 1 ? ` each, ${cost} for ${times}` : ""}. You have ${have}.`, "bad");
      G.takeInv(C.inv, "candycorn", cost);
      if (!this.give(pl, k, qty * times)) { this.give(pl, "candycorn", cost); return; }
      this.touch(pl);
      return this.say(pl, `${qty * times} ${G.ITEMS[k].name.toLowerCase()} for ${cost} candy corn.`, "loot");
    }
  }
  doubleTick() {
    if (!this.dbl || this.dbl.told) return;
    if (Date.now() < this.dbl.until) return;
    this.dbl.told = true;
    this.ctx.storage.put("dbl", this.dbl).catch(() => {});
    for (const p of this.pls.values()) { p.out.push({ type: "double", on: null }); this.say(p, "The 2X event is over. Back to normal rates."); }
    this.houseSay("The 2X event has ended. Back to normal rates.");
  }

  /* ------------------------------------------------------------ ranged: ammo and the pouch (2026-09-25)
     Written as launcher + ammo + pouch rather than bow + arrow + quiver on purpose: a staff, a rune and a rune
     pouch are the same three rows with different pictures, and none of this changes to add them. */
  /** one round gone, from the offhand pouch (the only place a launcher fires from, see G.ammoOf). Nothing happens for a melee weapon. */
  /** (2026-09-26) what an element does after a spell lands: Fire may burn, Frost slows, Storm arcs, Sun heals the caster */
  elementAfter(S, pl, m, el, dmg, now) {
    const M = G.MAGIC;
    if (el === "fire" && Math.random() < M.burn.chance) m.dot = { at: now + M.burn.ms, dmg: Math.max(1, Math.round(dmg * M.burn.share)), by: pl.id };
    else if (el === "frost") m.slowUntil = now + M.slow.ms;
    else if (el === "sun") { pl.C.hp = Math.min(G.maxHpOf(pl.C), pl.C.hp + Math.max(1, Math.round(dmg * M.sunHeal))); this.touch(pl); }
    else if (el === "storm") {
      const o = S.mobs.find((x) => x !== m && !x.dead && G.cheb(x, m) <= 1 && this.mayFight(S, x, pl, now)); if (!o) return;
      const d2 = Math.max(1, Math.round(dmg * M.arc.share * G.elementMul(o.t, "storm")));
      o.hp -= d2; o.hurtAt = now; S.events.push({ type: "splat", who: o.id, n: d2, kind: "hit", t: now, arc: true }); this.award(pl, d2);
      if (o.hp <= 0) { const keep = pl.act; this.killMob(S, pl, o, now); if (m.hp > 0) pl.act = keep; }
    }
  }
  spendAmmo(pl) {
    const C = pl.C, a = G.ammoOf(C); if (!a) return;
    if (Math.random() < G.fxOf(C).ammo) return;   /* (2026-09-27) the Lantern Quiver / Shroud Satchel: this shot or cast spends nothing */
    const w = G.ammoWords(G.ammoKind(a.k));
    C.quiver.n = Math.floor(C.quiver.n) - 1; if (C.quiver.n <= 0) { C.quiver = null; this.say(pl, `Your ${w.pouch} is empty. Load it with ${w.many} from your bag.`, "bad"); }
    this.touch(pl);
  }
  /** load a stack from the bag into the pouch, or empty the pouch back into the bag */
  quiverOp(pl, m) {
    const C = pl.C, P = G.pouchOf(C);
    if (!P && m.op === "unload" && C.quiver) return this.pocketOut(pl);   /* (2026-09-27) a load left behind with no pouch worn still comes back */
    if (!P) return this.say(pl, "You need a quiver or a Magic Bag in your offhand first.", "bad");
    const w = G.ammoWords(P.pouch.ammo);
    if (m.op === "unload") {
      if (!C.quiver) return this.say(pl, `The ${w.pouch} is empty.`);
      const q = C.quiver; const room = G.roomFor(C.inv, q.k, C); const n = Math.min(q.n, room);
      if (n <= 0) return this.say(pl, "No room in your bag.", "bad");
      G.addInv(C.inv, q.k, n, C); q.n -= n; if (!q.n) C.quiver = null; this.touch(pl);
      return this.say(pl, `You take ${n} ${G.ITEMS[q.k].name.toLowerCase()}s out of the ${w.pouch}.`);
    }
    const st = C.inv[m.i | 0], it = st && G.ITEMS[st.k];
    if (G.ammoKind(st?.k) !== P.pouch.ammo) return this.say(pl, `Only ${w.many} go in your ${w.pouch}.`, "bad");   /* (2026-09-26) a pouch holds its own kind */
    /* (2026-09-27) SWITCHING ARROWS OR PAGES is one click: the old load goes back to the bag first (pocketOut), and only if all of
       it fits; then the new stack goes in. The stack is found again by its key, because handing the old load back can move it. */
    if (C.quiver && C.quiver.k !== st.k) { const k = st.k; if (!this.pocketOut(pl)) return; const j = C.inv.findIndex((x) => x.k === k); if (j < 0) return; return this.quiverOp(pl, { op: "load", i: j }); }
    const cap = G.pouchCapOf(C), have = C.quiver ? C.quiver.n : 0, n = Math.min(st.n, cap - have);
    if (n <= 0) return this.say(pl, `Your ${w.pouch} is full.`, "bad");
    G.takeInv(C.inv, st.k, n); C.quiver = { k: st.k, n: have + n }; this.touch(pl);
    this.say(pl, `You load ${n} ${it.name.toLowerCase()}s. ${C.quiver.n} of ${cap} in your ${w.pouch}.`, "good");
  }

  useSpecial(pl, i, st, it) {
    const C = pl.C, now = Date.now(), take = () => { st.n--; if (!st.n) C.inv.splice(C.inv.indexOf(st), 1); this.touch(pl); };
    if (it.drink) {
      const k = st.k; take(); C.drink = { k, left: it.drink.mins * 60000 };
      return this.say(pl, `You drink the ${it.name.toLowerCase()}. For ${it.drink.mins} minutes outside: ${G.fxText(it.drink.fx)}.`, "good");
    }
    /* THE 2X POTION (2026-09-25). The only thing in the game one player uses ON EVERYBODY, so three rules:
       ONE AT A TIME, and a second is REFUSED rather than swallowed - the potion stays in the bag. Stacking two
       would double nothing extra and quietly destroy something very rare, which is the sort of thing a player
       never forgives.
       IT IS A WORLD CLOCK, not a character buff: this.dbl lives on the World and is written to storage, so a
       restart in the middle of an event does not eat it.
       AND EVERYBODY IS TOLD, in the room and in chat, because an event nobody notices is a wasted drop. */
    if (it.use === "double") {
      const now2 = Date.now();
      if (this.dbl && now2 < this.dbl.until) {
        const left = Math.ceil((this.dbl.until - now2) / 60000);
        return this.say(pl, `A 2X event is already running - ${left} minute${left === 1 ? "" : "s"} left. Keep it for after.`, "bad");
      }
      take();
      this.doubleStart(pl.name, G.DOUBLE.ms);
      return;
    }
    /* (2026-09-26) UTILITY PAGES. A buff replaces whatever buff was running; its tier is the reader's Wizardry, NOW. Travel is
       refused in the Wilderness, inside a run, and within 10 s of being hit - a page is not an escape button. */
    const noTravel = () => { const S0 = this.scenes.get(C.scene); return S0?.def?.pvp ? "Not in the Wilderness." : /^(crypt|tower|pyramid|count):/.test(String(C.scene)) ? "Not in the middle of a run." : now - (pl.hurtAt || 0) < 10000 ? "Not while something's hitting you. Get clear first." : null; };
    if (it.use === "charm") {
      const k = it.charm, def = G.CHARMS[k]; if (!def) return;
      if (G.lvlOf(C, "wizardry") < 1) return;
      const was = C.charm && (C.charm.left | 0) > 0 ? G.CHARMS[C.charm.k]?.name : null, tier = G.charmTier(C);
      take(); C.charm = { k, left: def.mins * 60000, tier };
      return this.say(pl, `You read the ${def.name} scroll (tier ${"I".repeat(tier)}): ${def.what(def.vals[tier - 1])}, for ${def.mins} minutes outside.${was && was !== def.name ? ` It replaces your ${was}.` : ""}`, "good");
    }
    if (it.use === "ward") {   /* (2026-09-27) the Witch's brew: the next death is free */
      if (C.ward) return this.say(pl, "You're already warded. Drink the next one after you've died.", "bad");
      take(); C.ward = true; this.touch(pl);
      return this.say(pl, "It tastes of pumpkin and pennies. Your next death will cost you nothing.", "good");
    }
    if (it.use === "homeward") {
      const why = noTravel(); if (why) return this.say(pl, why, "bad");
      take(); pl.act = null; pl.path = [];
      const key = G.isleKey(C.isle, pl.id), S2 = this.scene(key); S2.ownerName = pl.name;
      this.moveToScene(pl, key, null, G.SCENES.isle.entry); pl.dir = "north";
      return this.say(pl, "The page folds itself into a paper bird, and you're standing on your island.", "good");
    }
    if (it.use === "waystone") {
      const Wy = G.WAYSTONES[st.k]; if (!Wy) return;
      const why = noTravel(); if (why) return this.say(pl, why, "bad");
      if (String(C.scene).split(":")[0] === Wy.scene) return this.say(pl, `You're already in ${Wy.name}.`);
      take(); pl.act = null; pl.path = []; this.moveToScene(pl, Wy.scene, Wy.side, null);
      return this.say(pl, `The page crackles, and you're at the edge of ${Wy.name}.`, "good");
    }
    if (it.use === "tp") {
      const S = this.scenes.get(C.scene);
      if (C.scene === G.START.scene) return this.say(pl, "You're already in the casino.");
      if (S?.def?.pvp || now - (pl.hurtAt || 0) < 8000) return this.say(pl, S?.def?.pvp ? "The scroll won't work in the Wilderness." : "Not while something's hitting you. Get clear first.", "bad");
      take(); pl.act = null; pl.path = []; this.moveToScene(pl, G.START.scene, null, G.START);
      return this.say(pl, "The scroll burns up in your hand, and you're standing on the casino floor.", "good");
    }
    if (it.use === "bundle") { take(); this.tixTo(pl, it.worth | 0); return this.say(pl, `You cash the chip: ${G.fmtTix(it.worth | 0)}, in your bag. Tickets bet like ZCoins at any table: ${G.DEX.rate.toLocaleString()} tickets a ZCoin.`, "good"); }
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
    if (Math.random() >= chance || G.roomFor(pl.C.inv, k, pl.C) < 1) return;
    G.addInv(pl.C.inv, k, 1, pl.C); this.touch(pl);
    this.say(pl, `You find a ${G.ITEMS[k].name.toLowerCase()}! Click it in your bag before a long session out here.`, "loot");
  }
  eat(pl, i, now) {
    const C = pl.C, st = C.inv[i], it = st && G.ITEMS[st.k]; if (!it?.heal) return;
    /* (2026-09-22) RAW IS NOT FOOD. The server refuses it as well as the page, because the page only ever asks —
       the bag is here, and a hand-sent eat would otherwise still work. Cook it at a fire or a range first. */
    if (it.raw) return this.say(pl, `You can't eat raw ${it.name.toLowerCase()}. Cook it first — any campfire or range will do.`, "bad");
    if (now - (pl.lastEat || 0) < G.EAT_MS) return;
    pl.lastEat = now; pl.lastSwing = Math.max(pl.lastSwing, now - 1200);
    st.n--; if (!st.n) C.inv.splice(i, 1);
    const before = C.hp; C.hp = Math.min(G.maxHpOf(C), C.hp + Math.round(it.heal * (1 + (it.meal ? 0 : G.fxOf(C).heal))));
    if (it.meal) { C.meal = { k: st.k, left: it.meal.mins * 60000 }; this.say(pl, `A proper dinner. For ${it.meal.mins} minutes outside: ${G.fxText(it.meal.fx)}.`, "loot"); }
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
      for (const p of who) { p.C.drink = { k: rd.k, left: (G.ITEMS[rd.k].drink?.mins || 10) * 60000 }; this.touch(p); if (p !== pl) this.say(p, `${pl.name} bought the room a round! ${G.ITEMS[rd.k].name} for the next ${G.ITEMS[rd.k].drink?.mins || 10} minutes outside: ${G.fxText(G.ITEMS[rd.k].drink.fx)}.`, "loot"); }
      for (const p of this.playersIn(S)) p.out.push({ type: "casinonote", text: `🍻 ${pl.name} bought the room a round!` });
      return this.say(pl, `A round for the room: ${who.length} ${who.length === 1 ? "drink" : "drinks"} poured, yours included.`, "good");
    }
    if (bar && m.op !== "buy") return;
    if (m.op === "buy") {
      const row = (bar ? G.BAR : G.SHOP).sells.find(([k]) => k === m.k); if (!row) return;
      const [k, price] = row, want = Math.max(1, Math.min(1000, m.n === "all" ? 1000 : m.n | 0)), have = cash()?.n || 0, room = G.roomFor(C.inv, k, C), qty = Math.min(want, Math.floor(have / price), room);
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
  atCounter(S, pl) { return this.near(S, pl, "coinstatue", 3) || this.near(S, pl, "prizecase", 3) || this.near(S, pl, "cashier", 3); }   /* (v82: Bom Trady and the prize cases round him are one counter) */
  /* every ticket EARNED (kills, trade-ins, daily jobs) counts toward VIP; buying and betting never do */
  earned(pl, n) { if (!(n > 0)) return; const C = pl.C, was = G.vipOf(C).i; C.earned = (Number(C.earned) || 0) + n; const now = G.vipOf(C);
    if (now.i > was) { this.say(pl, `You've made ${now.name} VIP: ${Math.round(now.off * 100)}% off everything at the Prize Counter, and everyone can see it by your name.`, "loot"); for (const q of this.pls.values()) if (q !== pl) q.out.push({ type: "casinonote", text: `👑 ${pl.name} made ${now.name} VIP.` }); } }
  /* (2026-09-25) EVERY TICKET IN THE GAME COMES THROUGH HERE, which is why the 2X event is applied at this one
     line rather than at the dozen places that pay. A doubled ticket is still a ticket: the caps, the books and
     the day counters all see the doubled number, which is what the owner asked for. */
  tixTo(pl, n) { if (n > 0 && this.doubleOn()) n = Math.round(n * G.DOUBLE.mult); this.earned(pl, n); if (n > 0 && !this.give(pl, "tickets", n) && !this.bankAdd(pl, "tickets", n)) this.say(pl, "Your bag and bank are both full: those tickets are lost. Make some room!", "bad"); }
  /* THE PRIZE COUNTER: tickets in, prizes out (G.prizesOf). Chips are tickets, 1 for 1; everything else is an item. */
  counterOp(S, pl, m) {
    if (!this.atCounter(S, pl)) return this.say(pl, "You need to be at the Prize Counter: Bom Trady, in the middle of the casino floor.", "bad");
    const C = pl.C, tix = G.tixIn(C);
    /* (2026-09-22) A BIGGER BAG. Not a prizesOf row, because that shape hands you an ITEM and a slot is not one.
       Five at rising prices; bagUpCost returns null once they are all bought. */
    if (m.op === "bagup") {
      const cost = G.bagUpCost(C);
      if (cost == null) return this.say(pl, "That's every pocket he'll sew on. Your bag is as big as it gets.", "bad");
      if (tix < cost) return this.say(pl, `Another pocket is ${G.fmtTix(cost)}. You have ${G.fmtTix(tix)}.`, "bad");
      G.takeInv(C.inv, "tickets", cost);
      C.bagUp = (C.bagUp | 0) + 1;
      this.touch(pl);
      return this.say(pl, `Bom stitches another pocket on. Your bag holds ${G.bagMax(C)} now.`, "loot");
    }
    if (m.op !== "buy") return;
    const p = G.prizesOf().find((x) => x.id === String(m.id)); if (!p) return;
    const n = Math.max(1, Math.min(99, m.n | 0 || 1)), cost = G.counterPrice(C, p.price) * n, it = p.give && G.ITEMS[p.give[0]];
    if (tix < cost) return this.say(pl, `That's ${G.fmtTix(cost)}. You have ${G.fmtTix(tix)}.`, "bad");
    /* roomFor's owner argument was being left out here, so the counter measured the BASE bag: a Pack Rat owner was
       told a 24-slot bag was full at 20, and a bought slot would have been invisible to the very shop that sold it. */
    if (it && G.roomFor(C.inv, p.give[0], C) < p.give[1] * n) return this.say(pl, "Your bag's too full for that.", "bad");
    G.takeInv(C.inv, "tickets", cost);
    this.give(pl, p.give[0], p.give[1] * n);
    this.touch(pl);
    this.say(pl, `${p.give[1] * n > 1 ? `${(p.give[1] * n).toLocaleString()} × ` : ""}${it.name} for ${G.fmtTix(cost)}.`, "good");
  }
  cashOut(S, pl, m) {
    const C = pl.C; if (!this.atCounter(S, pl)) return this.say(pl, "You need to be at the Prize Counter: Bom Trady, in the middle of the casino floor.", "bad");
    /* (2026-09-23) "all" STILL FILTERS ON isLoot ALONE. Quick-sellable rares are deliberately not swept: one
       click of Sell All must never be able to take the ring you are wearing or the drop you spent a week on.
       A single named item may be a rare, and then it pays G.quickSell rather than the full value. */
    const keys = m.op === "all" ? [...new Set(C.inv.map((s) => s.k))].filter((k) => G.isLoot(k) && !G.isFav(C, k)) : [String(m.k)].filter((k) => G.canSell(k) && C.inv.some((s) => s.k === k));
    /* (2026-09-23) THREE PRICES, in the order they apply. Loot is worth what the Cashier pays for it; the rares
       in the QUICK list have their own; and a smithed piece sells back at a quarter of the counter's own shelf
       price (gearSell). Gear is last because it is the only one keyed on having a `slot`, and it is deliberately
       NOT isLoot, so "sell all" still cannot sweep the armour you are carrying. */
    const priceOf = (k, f = 0) => (G.isLoot(k) ? G.valueOf(k) : G.quickSell(k) || G.gearSell(k, f));
    if (m.op !== "all" && !keys.length && G.ITEMS[String(m.k)]?.slot) return this.say(pl, "The Cashier doesn't buy anything you could wear or hold. Brutus, at the Forge out front, buys what's been smithed.", "bad");
    /* (2026-09-24) A REFORGED PIECE, SOLD ON PURPOSE AND ON ITS OWN. Its own branch above the loop below rather
       than a condition threaded through it, because everything down there is keyed on the ITEM and a reforged
       piece is priced on the LEVEL - two +1 helms and a +3 are three different prices for one key. The level has
       to be NAMED by the client, so no sweep and no plain-gear click can ever reach one of these, which is the
       rule the plainOnly count was protecting in the first place. Only what is CARRIED: worn gear is in C.eq. */
    const wantF = G.fOf({ f: m.f });
    if (m.op !== "all" && wantF > 0) {
      const gk = String(m.k);
      if (!G.gearSell(gk) && !G.ITEMS[gk]?.event) return this.say(pl, "The counter only takes gear it stocks itself.", "bad");   /* (2026-09-27) or an event piece, at one ticket */
      let got = 0;
      for (let i = C.inv.length - 1; i >= 0; i--) { const st = C.inv[i]; if (st.k !== gk || G.fOf(st) !== wantF) continue; got += st.n; C.inv.splice(i, 1); }
      if (!got) return this.say(pl, `That is not in your bag: ${G.forgeNameAt(gk, wantF)}.`, "bad");
      const paid = got * priceOf(gk, wantF);
      this.tixTo(pl, paid); this.touch(pl);
      pl.out.push({ type: "cashed", total: paid, count: got });
      return this.say(pl, `"${G.forgeNameAt(gk, wantF)} — somebody put work into that." The counter hands over ${G.fmtTix(paid)}.`, "good");
    }
    let total = 0, count = 0;
    /* (2026-09-23) A REFORGED PIECE IS NEVER SOLD HERE. This takes every copy of the key, and gear is priced at
       the PLAIN shelf rate - so somebody holding a spare Emerald cuirass and a +3 one would have sold both, and
       the +3 for a quarter of a plain piece. Gear is counted plainOnly, so a reforged one has to be dealt with
       deliberately; everything else is unchanged. */
    for (const k of keys) {
      const gear = !!G.ITEMS[k]?.slot;
      const n = G.takeInv(C.inv, k, G.countItems({ inv: C.inv, bank: [] }, [k], gear ? { plainOnly: true } : undefined));
      total += n * priceOf(k); count += n;
    }
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
    const D = (this.devDex ||= { used: 0, seen: new Map() }), left = Math.max(0, G.DEX.capHour - D.used), leftOut = Math.max(0, G.DEX.capDay - D.used);
    if (body.op === "status") return { ok: true, left, leftOut, capHour: G.DEX.capHour, capDay: G.DEX.capDay, maxStake: G.DEX.maxStake, open: [], enabled: true, dev: true };
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
    /* (v107) op "cash": TICKETS INTO ZCOINS AT THE COUNTER, G.DEX.rate of them a ZCoin (the owner, 2026-09-21: "ship the prize counter trading in
       tickets for zcoins"). It is the banking of found ZCoins with a different thing taken: the same record, the same ask of the site
       (op "pay", which holds the hourly allowance and the day's breaker and pays exactly once per id), the same refund if the site says no. */
    const op = String(m.op), C = pl.C, stake = op === "stake", cashing = op === "cash";
    if (stake ? !(S.def.real || S.def.realRound) : !this.atCounter(S, pl)) return stake ? pl.out.push({ type: "stake", g: m.g, error: "There's no ZCoin table in this room." }) : this.say(pl, "You need to be at the Prize Counter: Bom Trady, in the middle of the casino floor.", "bad");
    const fail = (error, status) => pl.out.push(stake ? { type: "stake", g: m.g, error, status } : { type: "dex", error, status });
    /* (2026-09-23) EVERY PATH OUT OF HERE HAS TO ANSWER, and a read does not start the clock.

       Reported by a tester: clicking "Bank ZCoins" at Bom hung on "The Ruby hums…" with no confirmation and no
       error, over and over. The cause was these two lines together. Walking up to the Prize Counter makes the
       page ask op:"status", which came through this gate and set lastDex — and then a click on Bank within the
       next 1.5 seconds hit the cooldown and returned SILENTLY, because the message was only sent for `stake`.
       The page sets its waiting text before it sends and clears it on any `dex` reply, so no reply meant the
       Ruby hummed for ever. Perfectly reproducible if you click reasonably quickly, which everybody does.

       Two changes, and the first is the general rule: this handler is the only thing that can end the page's
       wait, so it must never return without saying something. The second is that `status` ASKS and TAKES
       NOTHING, so it no longer starts a cooldown meant to stop double-spends — a read blocking the action the
       player actually came to do is how the window opened in the first place. */
    if (pl.dexBusy || now - (pl.lastDex || 0) < (stake ? 400 : 1500)) return fail("One at a time. Give it a second and try again.");
    if (op !== "status") pl.lastDex = now;
    pl.dexBusy = true;
    try {
      // anything left over from before (a timeout, a restart mid-ask) is asked again FIRST, with its own id
      const old = await this.ctx.storage.list({ prefix: `dex:${pl.id}:`, limit: 5 });
      for (const [key, rec] of old) await this.dexSettle(pl, key, rec, true);
      if (op === "status") { const st = await this.dexAsk({ op: "status", userId: pl.id }); return pl.out.push({ type: "dex", status: st, held: (await this.ctx.storage.list({ prefix: `dex:${pl.id}:`, limit: 5 })).size }); }
      if (op !== "bank" && !stake && !cashing) return fail("The Ruby didn't understand that. Nothing was taken.");   /* (2026-09-23) an op nothing sends today, but a silent return here is the same trap as the cooldown was: the page would wait for ever */
      if ((await this.ctx.storage.list({ prefix: `dex:${pl.id}:`, limit: 1 })).size) return fail("The house is still working on your last one. Give it a minute and try again.");
      const have = G.countItems({ inv: C.inv, bank: [] }, ["zcoin"]), want = Math.floor(Number(m.zc));
      if (cashing && !(want >= 1 && want <= G.DEX.capDay)) return fail(`Trade in 1 to ${G.DEX.capDay} ZCoins' worth at a time.`);
      if (cashing && G.tixIn(C) < want * G.DEX.rate) return fail(`${want} ZCoin${want === 1 ? "" : "s"} is ${G.fmtTix(want * G.DEX.rate)} (${G.DEX.rate.toLocaleString()} a ZCoin). You have ${G.fmtTix(G.tixIn(C))}.`);
      if (!stake && !cashing && !have) return fail("You've no ZCoins in your bag to bank. They turn up, rarely, on a kill or a catch.");
      if (stake && !(want >= 1 && want <= G.DEX.maxStake)) return fail(`A ticket bet is 1 to ${G.DEX.maxStake} ZCoins' worth.`);
      if (stake && G.tixIn(C) < want * G.DEX.rate) return fail(`That's ${G.fmtTix(want * G.DEX.rate)} (${G.DEX.rate.toLocaleString()} a ZCoin). You have ${G.fmtTix(G.tixIn(C))}. Go outside: everything out there pays tickets.`);
      // ask what's left BEFORE taking anything, so the usual refusal (the hour's allowance) costs nothing and risks nothing
      const st = await this.dexAsk({ op: "status", userId: pl.id });
      if (!st.ok || !st.enabled) return fail(st.message || "ZCoins aren't moving right now. Nothing was taken.", st);
      if (stake) { const spare = (st.open || []).find((v) => v.zc === want); if (spare) return pl.out.push({ type: "stake", g: m.g, voucher: spare.id, zc: want, spare: true, status: st }); }   // paid for earlier and never bet: it's still yours
      /* (2026-09-27) two allowances: a ticket STAKE draws on the hour's (st.left); anything that LEAVES to a wallet - a trade, a banked find - on the day's (st.leftOut, 100 in 24 hours) */
      const leftOut = st.leftOut ?? st.left;
      const zc = stake || cashing ? want : Math.min(have, leftOut, G.DEX.capDay);
      if (zc < 1 || (stake ? zc > st.left : zc > leftOut)) return fail(stake ? (st.left ? `You've ${st.left} ZCoin${st.left === 1 ? "" : "s"}' worth of ticket bets left this hour. ZCoin bets still work.` : "That's your ticket bets for this hour. It refills as the hour rolls on. ZCoin bets still work.") : (st.left ? `There's room for ${st.left} more ZCoin${st.left === 1 ? "" : "s"} this hour.` : "That's your ZCoins for this hour. It refills as the hour rolls on; what you found will keep."), st);
      const back = stake || cashing ? { k: "tickets", n: zc * G.DEX.rate } : { k: "zcoin", n: zc };
      if (pl.left) return;   // they have gone; nobody is waiting for an answer
      if (G.countItems({ inv: C.inv, bank: [] }, [back.k]) < back.n) return fail("That moved while the Ruby was looking. Nothing was taken — try again.");
      const id = `${stake ? "s" : "x"}${Date.now().toString(36)}${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`, key = this.dexKey(pl, id), rec = { id, op: stake ? "stake" : "pay", cash: cashing || undefined, zc, back, g: stake ? String(m.g || "") : undefined, at: Date.now(), name: pl.name };
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
    const status = (left, leftOut) => ({ ok: true, left, leftOut: leftOut ?? left, capHour: G.DEX.capHour, capDay: G.DEX.capDay, maxStake: G.DEX.maxStake, enabled: true });
    if (ans.ok) {
      await this.ctx.storage.delete(key);
      if (stake) { if (!pl.left && !ans.used) pl.out.push({ type: "stake", g: rec.g, voucher: ans.voucher || rec.id, zc: rec.zc, status: status(ans.left, ans.leftOut), again }); return; }   // (left, or a retry: the voucher stays OPEN on the site and is handed back the next time they bet that amount)
      const got = ans.zc | 0;
      if (!pl.left) pl.out.push({ type: "dex", done: { op: rec.cash ? "cash" : "bank", zc: got, tix: rec.cash ? rec.back.n : undefined, balance: ans.balance, again }, status: status(ans.left, ans.leftOut) });
      if (rec.cash) { const p = this.pls.get(pl.id); if (p?.C.stats) { p.C.stats.cashedZc = (p.C.stats.cashedZc | 0) + got; this.touch(p); } }
      if (got >= 10) for (const q of this.pls.values()) q.out.push({ type: "casinonote", text: rec.cash ? `💎 ${rec.name} traded tickets for ${got} ZCoins at the Prize Counter.` : `💎 ${rec.name} banked ${got} ZCoins at the Prize Counter.` });
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
    /* (2026-09-25) a LOADED quiver hands its arrows back first; if the bag cannot take them all it stays on. Otherwise the
       arrows would ride along in C.quiver with nothing to hold them, and reappear on the next quiver worn. */
    if (C.quiver && G.ITEMS[k]?.pouch) { if (!this.pocketOut(pl)) return; }
    const f = G.fLevelOf(C, slot);
    if (!this.give(pl, k, 1, f)) return;
    C.eq[slot] = null; if (C.eqf) delete C.eqf[slot];
    this.say(pl, `You take off the ${G.forgeNameAt(k, f).toLowerCase()}.`); this.touch(pl);
  }

  /* ------------------------------------------------------------ quests */
  /* (2026-09-27) STAGED. The rules (G.npcRole, G.qStage) say what this person has to do with the quest; the ops are accept (a
     giver's new quest), stage (a talk or a bring at the current stage's person) and hand (the finished quest, at the hand-in). */
  questOp(S, pl, m) {
    const C = pl.C, n = S.npcs.find((x) => x.id === m.npc), k = String(m.k || "");
    /* (2026-09-27, a player: "witch talks about quest, but it says not started in my list") THE SAME DISTANCE THE TALK USES. An NPC
       with a `reach` (Hexa behind her tent, Vance behind his crates) is spoken to from three tiles, but accepting, handing in or
       answering a stage was held to two - so her conversation offered the Pumpkin King quest and the Accept was dropped without a
       word, and the quest stayed "not started". */
    if (!n || !G.QUESTS[k] || G.cheb(pl, n) > Math.max(2, n.reach || 0)) return;
    const R = G.npcRole(C, n); if (!R || R.k !== k) return;
    const q = G.QUESTS[k], st = G.qState(C, k);
    if (m.op === "accept" && R.role === "offer" && st === "new") { C.qs[k] = { state: "active", stage: 0, n: 0 }; this.say(pl, `Quest started: ${q.name}. ${q.brief}`, "good"); this.stageGive(pl, k); this.touch(pl); this.questCheck(pl); }
    if (m.op === "hand" && R.role === "hand" && st === "ready") this.finishQuest(pl, k);
    if (m.op === "stage" && R.role === "stage" && st === "active") {
      const s = R.stage;
      if (s.type === "bring") { if (G.countItems(C, s.items) < s.n) return; this.takeAny(C, s.items, s.n); }
      this.advanceQuest(pl, k);
    }
  }
  takeAny(C, items, n) { let left = n; for (const key of items) { left -= G.takeInv(C.inv, key, left); if (!left) break; } }
  /* what a stage hands you on arrival (a letter to carry, a sample to test) */
  stageGive(pl, k) { const s = G.qStage(pl.C, k); for (const [it, n] of s.give || []) this.give(pl, it, n); }
  advanceQuest(pl, k) {
    const C = pl.C, q = G.QUESTS[k], o = C.qs[k]; if (!o || o.state !== "active") return;
    o.stage = (o.stage | 0) + 1; o.n = 0; o.told = false;
    if (o.stage >= q.stages.length) { o.state = "ready"; this.say(pl, `${q.name}: that's everything. Go back to ${G.qHandTo(k)}.`, "good"); }
    else { this.say(pl, `${q.name}: ${G.stageText(k, q.stages[o.stage])}.`, "good"); this.stageGive(pl, k); }
    this.touch(pl); this.questCheck(pl);
    /* a visit stage reached while already standing there completes at once */
    if (o.state === "active" && q.stages[o.stage].type === "visit" && q.stages[o.stage].scene === C.scene) this.advanceQuest(pl, k);
  }
  questCheck(pl) {
    const C = pl.C;
    for (const k in G.QUESTS) {
      const q = G.QUESTS[k], o = C.qs[k]; if (!o || o.state !== "active") continue;
      const s = G.qStage(C, k);
      if (s.type === "bring" && !o.told && G.countItems(C, s.items) >= s.n) { o.told = true; this.say(pl, `${q.name}: you have all ${s.n} ${s.what}. Take them to ${G.qBringTo(k, s)}.`, "good"); this.touch(pl); }
      /* (2026-09-27, players: "some of the quests ... dont recognize if you already have the things they're asking for") A GATHER
         STAGE COUNTS WHAT IS IN THE BAG. It counted only what was gained after the stage began, so ten wheat already carried
         had to be cut again. What you hold now is what the quest asked for; this runs at accept and after every advance. */
      if (s.type === "gather" && G.countItems(C, s.items) >= s.n) { o.n = Math.max(o.n | 0, s.n); this.advanceQuest(pl, k); return; }
    }
  }
  // a subscriber of emit(): kill stages count kills, gather stages count what is gained
  questEvent(pl, type, d) {
    const C = pl.C;
    for (const k in G.QUESTS) {
      const q = G.QUESTS[k], o = C.qs[k]; if (!o || o.state !== "active") continue;
      const s = G.qStage(C, k);
      if (s.type === "kill" && type === "kill" && s.mob === d.mob && (!s.style || s.style === d.style)) { o.n++; this.touch(pl); if (o.n >= s.n) this.advanceQuest(pl, k); }
      else if (s.type === "gather" && ["gather", "craft", "cook"].includes(type) && s.items.includes(d.k) && (!s.how || s.how === type)) { o.n += d.n || 1; this.touch(pl); if (o.n >= s.n) this.advanceQuest(pl, k); }
    }
  }
  questVisit(pl, key) {
    const C = pl.C;
    /* (2026-09-27, the owner: "go to your island step in charon's ledger quest doesnt register") A SCENE KEY IS NOT A SCENE NAME.
       Your island is "isle:<your id>" (or isle2/isle3 by tier), and the stage said "isle", so the two never matched. The base
       name is compared; an island counts only when it is YOUR island - the quest says "your island", and Charon rows you to
       other people's too. */
    const base = String(key).split(":")[0], isle = G.isIsle(key), mine = !isle || G.ownerOf(key) === pl.id;
    const hit = (want) => (want === "isle" ? /^isle\d?$/.test(base) && mine : base === want);
    for (const k in G.QUESTS) { const o = C.qs[k]; if (!o || o.state !== "active") continue; const s = G.qStage(C, k); if (s.type === "visit" && hit(s.scene)) this.advanceQuest(pl, k); }
  }
  finishQuest(pl, k) {
    const C = pl.C, q = G.QUESTS[k], last = q.stages[q.stages.length - 1];
    if (G.qGet(C, k).state !== "ready" && last.type === "bring") { if (G.countItems(C, last.items) < last.n) return; this.takeAny(C, last.items, last.n); }
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
    /* THE AGILITY GATES (2026-09-22). Every tick, each gate's two tiles are made walkable or not from the SAME pure
       function the page draws them with, so what you can step through is exactly what you can see. Nothing is sent
       for it: the cycle is a function of the clock, and every snapshot already carries `t`. */
    for (const S of this.scenes.values()) {
      const gates = S.def?.gates; if (!gates) continue;
      for (const gt of gates) { const open = G.gateOpenAt(now, gt) ? "i" : "#"; for (const [gx, gy] of G.gateTiles(gt)) S.g[gy][gx] = open; }
    }
    if (this.tickN % 20 === 0) { this.songTick(now); this.cryptTick(now); this.pyramidTick(now); this.countTick(now); this.doubleTick(); this.hwTick(now); if (this.tickN % 1200 === 0) this.petDaily(); this.pitTick(now).catch(() => {}); }
    if (this.tickN % 40 === 0) this.runsSave();   /* (2026-09-27) the dungeon runs, so a deploy does not end them */
    if (this.tickN % 20 === 0) for (const pl of this.pls.values()) {   /* once a second */
      const C = pl.C, dt = Math.min(5000, now - (pl.fxAt || now)); pl.fxAt = now; if (!(C.meal || C.drink || C.charm) || !(G.SCENES[String(C.scene).split(":")[0]]?.mobs?.length)) continue;
      if (C.charm) { C.charm.left = (C.charm.left | 0) - dt; if (C.charm.left <= 0) { this.say(pl, `Your ${G.CHARMS[C.charm.k]?.name || "page"} has worn off.`); C.charm = null; } this.touch(pl); }   /* (2026-09-26) the page buff */
      for (const k of ["meal", "drink"]) if (C[k]) { C[k].left = (C[k].left | 0) - dt; if (C[k].left <= 0) { this.say(pl, `Your ${G.ITEMS[C[k].k]?.name.toLowerCase() || k} has worn off.`); C[k] = null; } this.touch(pl); }
    }
    if (this.jackDirty && this.tickN % 100 === 0) { this.jackDirty = false; this.ctx.storage.put("jackpot", this.jack).catch(() => { this.jackDirty = true; }); }
    this.restartTick(now);
    if (this.rrDueAt && now >= this.rrDueAt) { this.rrDueAt = 0; this.rrLook(now); }   /* the Russian Roulette lobby's clock ran out (or a look was put off): ask the site once */
    const live = new Set([...this.pls.values()].map((p) => p.C.scene));
    for (const [key, S] of this.scenes) {
      if (key === "roulette" && !S.def.realRound && S.objs.some((o) => o.t === "roulette")) this.rouletteTick(S, now);   /* (v73: no wheel in the room, no rounds) */   /* (a realRound room's game is the site's: no rounds are run here) */
      if (key === "fightpit" && !S.def.realRound) this.fightTick(S, now);
      if (!live.has(key)) { S.idleSince ||= now; if (!S.run && !(key === G.HW.king.scene && this.hw?.kingUp) && now - S.idleSince > SCENE_IDLE_MS && !(S.def.pvp && S.mobs.some((m) => m.dead && now < m.respawnAt)) && !S.roulette?.bets.length && !S.fight?.bets.length) this.scenes.delete(key); continue; }   /* (2026-09-27) `!S.run`: a dungeon run keeps its own clock (cryptTick / pyramidTick / countTick) and its held time is LONGER than this sweep */
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
    /* (2026-09-22) A GATE PAYS WHEN YOU ARE PAST IT. AGIL_XP.gate existed from the day The Run was built and was
       never granted, so a whole course paid only at the far end and nothing told you a gate had been cleared.

       `runPast` is a HIGH-WATER MARK, not a count of where you are: it only ever goes up within a run. Paying on
       the count itself would mean walking back through a gate and forward again pays twice, which is a treadmill
       worth more than the course. It is reset with `runAt` by moveToScene, so a fresh run pays afresh. */
    if (S.def?.gates && !moving) {
      const past = S.def.gates.reduce((n, gt) => n + (gt.x < pl.x ? 1 : 0), 0);
      if (past > (pl.runPast | 0)) {
        const n = past - (pl.runPast | 0);
        this.grant(pl, "agility", G.AGIL_XP.gate * n);
        /* PERFECT: the gate you have just cleared, judged on how long it had been open when you came through.
           The phase is read from the same clock and the same expression the gate opens on, so "perfect" means
           exactly what the shutter you walked through was doing — there is no second definition of the timing. */
        const gt = S.def.gates[past - 1];
        if (n === 1 && gt) {
          const phase = (now + gt.at) % gt.ms;
          if (phase < gt.open && phase < G.AGIL_PERFECT_MS) {
            pl.runPerfect = (pl.runPerfect | 0) + 1;
            this.grant(pl, "agility", G.AGIL_XP.perfect);
            this.say(pl, pl.runPerfect >= 3 ? `Perfect ×${pl.runPerfect}!` : "Perfect!", "good");
          } else pl.runPerfect = 0;   // a streak is a streak: one slow gate ends it
        }
        pl.runPast = past;
      }
    }
    // stepping onto the blue takes you through
    const edge = !moving && S.g[pl.y][pl.x] === "e", side = pl.x === G.COLS - 1 ? "e" : pl.x === 0 ? "w" : pl.y === 0 ? "n" : "s";
    if (edge && S.def.exitTo && !S.def.exits?.[side]) {
      const o = S.def.cellar ? this.cellarUp(S) : S.def.home ? { scene: G.isleKey(this.isleOf(S), S.owner), x: 10, y: 4 } : S.def.exitTo;   /* (2026-09-27) the cellar's steps come up by the ladder */ this.moveToScene(pl, o.scene, null, o); pl.dir = "south";
      this.say(pl, `You step back out into ${G.sceneDef(o.scene).name.replace(/^The /, "the ")}.`); return;
    }
    if (!moving && S.g[pl.y][pl.x] === "e") {
      const d = side; let to = S.def.exits?.[d];
      if (to && S.owner) to = `${to}:${S.owner}`;   // an island's far shore is that owner's far shore
      /* (v84) you arrive at whichever edge of the next scene LEADS BACK here, not blindly the opposite one: the Yard's way on is north, but the Gloam's way back is still its east edge */
      if (to) { const back = Object.entries(G.sceneDef(to).exits || {}).find(([, v]) => v === String(S.key).split(":")[0])?.[0]; this.moveToScene(pl, to, back || G.OPP[d]); this.say(pl, `You travel to ${G.sceneDef(to).name}.`); return; }
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
  gained(S, pl, k, n = 1, how = "gather", skill = null) {   /* (2026-09-27) `skill`: which gathering skill this came off (mining / woodcutting / fishing), for the Coffin Ring and the Long Night's skilling drops */
    S.events.push({ type: "gain", who: pl.id, k, n, t: Date.now() });
    this.emit(pl, how, { k, n });
    if (how === "gather" && skill) {
      const fxG = G.fxOf(pl.C);
      if (fxG.double > 0 && Math.random() < fxG.double && this.give(pl, k, n)) { S.events.push({ type: "gain", who: pl.id, k, n, t: Date.now() }); this.emit(pl, how, { k, n }); this.say(pl, "…and again. The Coffin Ring is warm.", "loot"); }
      const drop = G.hwOn() ? G.HW.skillDrops[skill] : null;
      if (drop && Math.random() < G.HW.skillDropChance) {
        const where = this.keepRare(pl, drop, 1);
        if (where) { this.say(pl, `${G.ITEMS[drop].name}. ${where === "bank" ? "No room in your bag: it went to your bank." : "It is yours."}`, "loot"); this.houseSay(`\u{1F383} ${pl.name} ${skill === "fishing" ? "reeled in" : skill === "mining" ? "dug up" : "cut down"} ${G.ITEMS[drop].name}. One in ten thousand.`); for (const q of this.pls.values()) if (q !== pl) q.out.push({ type: "casinonote", text: `\u{1F383} ${pl.name} found ${G.ITEMS[drop].name}!` }); }
      }
    }
    if (how === "gather" && G.hwOn() && Math.random() < G.HW.corn.gather) { const c = rint(G.HW.corn.n[0], G.HW.corn.n[1]) * (G.nightfallOn() ? 2 : 1); if (this.hwGive(pl, c)) this.say(pl, `…and ${c} candy corn, stuck to it.`, "loot"); }   /* (2026-09-27) the Long Night */
    if (S.def.geode && Math.random() < S.def.geode && this.give(pl, "geode")) { S.events.push({ type: "gain", who: pl.id, k: "geode", n: 1, t: Date.now() }); this.emit(pl, "gather", { k: "geode", n: 1 }); this.say(pl, "Something glints in the dirt: a glimmering geode!", "loot"); }
  }
  groupNote(S, pl, a, what = "your chance and xp") {
    const n = this.workersOn(S, a.ob, pl); if (n === a.groupSeen) return; a.groupSeen = n;
    /* `what` because a station and a rock are not the same bonus: a rock's group bonus lifts your success roll AND
       your xp, while a fire has no success roll to lift, so saying "chance" there would be a promise we do not
       keep. (2026-09-23) */
    if (n) this.say(pl, `Group bonus: ${n} other${n > 1 ? "s" : ""} working this ${a.ob.name.toLowerCase()} with you. +${n}% to ${what}.`, "good", "group");
  }

  doAction(S, pl, now) {
    const a = pl.act, C = pl.C; if (!a || pl.path.length) return;
    // AFK: a repeating skill stops once nobody has touched the game for a while (see G.AFK_MS)
    const afkMs = (a.kind === "spot" || a.kind === "tree") && G.charmOf(C, "stillness") ? G.AFK_MS + G.charmOf(C, "stillness") * 60000 : S.def.tower ? G.AFK_TOWER_MS : a.kind === "mob" && G.ammoOf(C) ? G.ARCHERY.afkMs : G.AFK_MS;   /* (2026-09-25) an archer with a loaded quiver gets the long timer: AFK-friendly is the point of the quiver */   /* (2026-09-25) a tower floor is a 4-5 minute fight by design; see AFK_TOWER_MS */
    if (G.AFK_KINDS[a.kind] && now - pl.lastInput > afkMs) {
      pl.act = null;
      return this.say(pl, `You stop ${G.AFK_KINDS[a.kind]}: you've been idle for ${Math.round(afkMs / 60000)} minutes. Click to carry on.`);
    }
    const faceIt = () => { pl.dir = G.DIRS[`${Math.sign(a.x - pl.x)},${Math.sign(a.y - pl.y)}`] || pl.dir; pl.face = a.x > pl.x ? 1 : a.x < pl.x ? -1 : pl.face; };
    if (a.kind === "mob") {
      const m = S.mobs.find((x) => x.id === a.id); if (!m || m.dead) { pl.act = null; return; }
      if (!this.mayFight(S, m, pl, now)) { pl.act = null; return this.say(pl, `${this.claimOf(S, m, now).name} is already fighting that.`, "bad"); }
      /* (2026-09-25) A BOW WITH NOTHING TO FIRE IS NOT A WEAPON. Checked before the walk, so you are told at the
         click rather than after crossing the room. */
      { const why = G.noAmmoWhy(C); if (why) { pl.act = null; return this.say(pl, why, "bad"); } }   /* (2026-09-27) only a loaded pouch of the launcher's kind fires (G.ammoOf) */
      { const am = G.launcherOf(C) && G.ammoOf(C), need = am && G.missingReq(C, G.ITEMS[am.k]); if (need) { pl.act = null; return this.say(pl, `You need Archery ${need.lvl} to fire ${G.ITEMS[am.k].name.toLowerCase()}s.`, "bad"); } }
      /* (2026-09-25) RANGE. A launcher fights from its own reach; everything else from next door. The path target
         is the same reach, so an archer stops at four tiles rather than walking up to the thing. */
      { const reach = G.reachOfHeld(C); if (G.cheb(pl, m) > reach || (reach === 1 && G.cheb(pl, m) !== 1)) { const p = G.findPath(S.g, pl, m, reach); if (p && p.length) pl.path = p; else if (!p) { pl.act = null; if (G.MOBS[m.t]?.sky || m.perch) this.say(pl, "It's out over the drop. Nothing short of an arrow will reach it.", "bad"); } return; } }   /* (2026-09-27) the Depths' wisps */
      a.x = m.x; a.y = m.y; faceIt();
      // the weapon sets the pace now: a gladius swings every 1.8s, a maul every 3s
      const swingMs = G.swingMsOf(C);
      /* THE OPENER, AND WHY IT IS A max() (2026-09-25). Engaging is meant to give you the first hit fast - 600ms
         whatever you are holding - which is most of why combat feels responsive. Written as a plain assignment it
         also pulled the timer FORWARD, so switching between two monsters swung at 600ms each time even after the
         same-target re-click was closed. Taking the later of the two keeps the head start for someone who really
         is starting a fight and gives nothing to someone already mid-swing.
         `graceFor` is the third hole: the monster's clock is pushed away so it cannot hit you the instant you walk
         up, and alternating between two of them re-armed that forever. One grace per player per life. */
      if (!a.started) {
        a.started = now;
        pl.urgeStep = 0;   /* a NEW fight starts at the bottom of the ladder; a re-click carries `started` over and never reaches here */
        pl.lastSwing = Math.max(pl.lastSwing, now - Math.max(0, swingMs - 600));
        if (m.graceFor !== pl.id) { m.lastSwing = now; m.graceFor = pl.id; }
      }
      const urged = pl.urge ? Math.round(swingMs * G.swingShave(pl.urgeStep)) : 0;
      if (now - pl.lastSwing >= swingMs - urged) {
        /* ONE STEP PER SWING, and a swing with no click behind it drops you to the bottom again. */
        pl.urgeStep = pl.urge ? Math.min((pl.urgeStep | 0) + 1, G.SWING_STACK.length - 1) : 0;
        pl.urge = false;
        pl.lastSwing = now; pl.swingAt = now; pl.fightAt = now;
        if (!S.def.pvp && !S.def.shared && !G.MOBS[m.t]?.open) m.claim = { id: pl.id, until: now + CLAIM_MS };
        /* (2026-09-26) THE ELEMENT. The loaded page's element meets the monster's weakness or resistance, Void pierces part of its
           defence, and after the hit Fire may burn, Frost slows, Storm arcs to a neighbour and Sun heals you (below). */
        const el = G.launcherOf(C) ? G.ammoElOf(C) : null;
        const def = G.MOBS[m.t], hit = Math.random() < G.hitChance(G.attackRollOf(C), def.def * (el === "void" ? 1 - G.MAGIC.pierce : 1)); let dmg = hit ? rint(1, G.maxHitOf(C) + G.ammoStrOf(C)) : 0;
        if (dmg && el) dmg = Math.max(1, Math.round(dmg * G.elementMul(m.t, el)));
        /* (2026-09-27) THE GUARD (the Depths of the Mountain): some monsters take a tenth, or nothing, from a style, and one only
           feels one element. Said once per monster per fight, with the numbers, so a player knows to switch rather than wonder. */
        { const gm = G.guardMul(m.t, G.styleOf(C), el); if (gm !== 1) { if (dmg) dmg = gm <= 0 ? 0 : Math.max(1, Math.round(dmg * gm)); if (m.guardTold !== pl.id) { m.guardTold = pl.id; this.say(pl, `${def.name}: ${G.guardText(m.t)}`, "bad"); } } }
        if (dmg && G.launcherOf(C) && (def.size === "l" || def.size === "xl")) dmg = Math.round(dmg * (1 + G.ARCHERY.bigBonus));   /* (2026-09-25) a big target is hard to miss */
        const shotK = G.launcherOf(C) ? G.ammoOf(C)?.k : null;   /* (2026-09-25) which arrow: the page flies its own icon */
        this.spendAmmo(pl);   /* (2026-09-25) one arrow a shot, hit or miss; nothing happens for a sword */
        /* (v81) `crit` and `kill` are for the page's effects ONLY: a crit is a roll at the very top of what you can hit, and it does
           exactly the damage it rolled. Nothing about the fight changes. (v110, the owner: "it feels like users are criting too much".
           It was `>= ceil(max x 0.85)`, which with whole numbers is a fifth of every landed hit, and FIFTY PERCENT for a new player
           whose max hit is 2: every hit that was not a 1 flashed CRIT. Now it is the top TENTH, and never under 4 damage, so it is
           about one landed hit in nine and nobody sees one until their max hit reaches 5, around Combat 10.) */
        m.hp -= dmg; m.hurtAt = now; S.events.push({ type: "splat", who: m.id, n: dmg, kind: dmg ? "hit" : "miss", t: now, by: pl.id, ranged: G.launcherOf(C) ? true : undefined, ak: shotK || undefined,   /* (2026-09-25) the page flies an arrow from `by` to `who` before it shows the number; marked HERE so the page needs nothing about equipment, and a staff marks it the same way */ crit: (dmg >= 4 && dmg > G.maxHitOf(C) * 0.9) || undefined, kill: m.hp <= 0 || undefined });
        this.award(pl, dmg); if (S.def.crypt) this.cryptHit(S, pl, m, dmg); else if (S.def.pyramid) this.pyramidHit(S, pl, m, dmg);
        if (dmg > 0 && G.MOBS[m.t]?.open) (m.by ||= {})[pl.id] = (m.by[pl.id] || 0) + dmg;   /* (2026-09-27) an open boss remembers who hurt him, for the shared kill */
        { const fxH = G.fxOf(C);   /* (2026-09-27) the Long Night's pieces: the Skull Wand drinks, the Reaper's Scythe finishes */
          if (dmg > 0 && fxH.leech > 0 && C.hp < G.maxHpOf(C)) { C.hp = Math.min(G.maxHpOf(C), C.hp + Math.max(1, Math.round(dmg * fxH.leech))); this.touch(pl); }
          if (dmg > 0 && m.hp > 0 && fxH.execute > 0 && !G.MOBS[m.t].boss && m.hp <= m.maxHp * fxH.execute) { const rest = m.hp; m.hp = 0; S.events.push({ type: "splat", who: m.id, n: rest, kind: "hit", t: now, by: pl.id }); } }
        /* (2026-09-22) ENRAGE. `m.enraged` was read by the mob's swing and set by NOTHING — the crypt declared an
           enrage and never wired it up, so the flag had been dead since the day it was written. It flips once, on
           the hit that takes a mob under its threshold, and everyone in the scene is told. */
        const en = G.MOBS[m.t].enrage;
        if (en && !m.enraged && m.hp > 0 && m.hp <= G.MOBS[m.t].hp * en.at) {
          m.enraged = true;
          for (const p of this.playersIn(S)) p.out.push({ type: "casinonote", text: en.say });
        }
        if (dmg && el) this.elementAfter(S, pl, m, el, dmg, now);
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
      /* (2026-09-22) some things pay a skill for being picked up (the Run's marks). It is a property of the ITEM,
         so this handler never learns what agility is — the same shape as `heal` or `luck`. */
      const pick = G.ITEMS[it.k]?.pickXp;
      if (pick) this.grant(pl, pick.skill, pick.xp * (it.n || 1));
      return this.say(pl, `You pick up the ${G.ITEMS[it.k].name.toLowerCase()}.${pick ? ` +${pick.xp * (it.n || 1)} ${G.SKILLS[pick.skill].name} xp.` : ""}`, "loot");
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
      /* (2026-09-23) THE FIRST HARD ENTRY GATE IN THE GAME. Every other gate here is soft - bandBlock stops you
         fighting and fishing in a scene, not walking into it - so this is the only place a door refuses a person
         outright. The permit is an ITEM and is SPENT here: that is what makes it un-resellable once used, and it
         is why `guild` on the character is the thing checked ever after rather than the item. */
      if (a.ob?.permit && !C.guild && !pl.god) {
        if (G.countItems(C, ["thieves_permit"]) < 1) { pl.act = null; return this.say(pl, `The door doesn't open. A voice behind it: "Permit, or nothing." One is ${G.fmtTix(G.THIEF.permit)} at the shop, and they turn up in the Crypt.`, "bad"); }
        G.takeInv(C.inv, "thieves_permit", 1); C.guild = Date.now(); this.touch(pl);
        this.say(pl, "You hold the permit up. It goes quiet, then the bolt slides back. You won't need to show it again.", "loot");
      }
      if (inside.door?.cash && !pl.god && G.cashIn(C) < inside.door.cash && !((C.roller | 0) > 0)) { pl.act = null; return this.say(pl, `Vince looks at your shoes. "List says ${G.fmtCash(inside.door.cash)} on you, or fresh from a fight and looking it (High Roller). You've got ${G.fmtCash(G.cashIn(C))}."`, "bad"); } this.moveToScene(pl, a.ob.enter, null, inside.entry); pl.dir = "north";
      return this.say(pl, `You go into ${inside.name.replace(/^The /, "the ")}.`);
    }
    if (a.kind === "bank") return pl.out.push({ type: "bank" });
    /* (2026-09-23, reported by Calvinthesneak: "the house tour just says see Bom Tady, but doesn't go away when I
       click on him") WALKING UP TO HIM IS THE STEP. The tour's `trade` step was hooked only to `cashout`, so it
       finished when you completed a ticket trade and not when you did what it asked - and the note beside that
       step in the rules already said the trigger was "the Prize Counter". Opening the counter is also the
       forgiving version: a player with no tickets can still finish the tour, which is the whole reason these
       three steps were given server-side triggers in the first place. The cashout call stays; tourStep only
       moves the step you are actually on, so both firing is harmless. */
    if (a.kind === "cashier") { pl.act = null; this.tourStep(pl, "trade"); return pl.out.push({ type: "cashier", ruby: a.ob?.t === "coinstatue" || a.ob?.t === "prizecase" }); }
    if (a.kind === "fight" && S.def.realRound) { pl.act = null; return pl.out.push({ type: "roundopen", key: S.def.realRound }); }
    if (a.kind === "fight") { pl.act = null; return pl.out.push({ ...this.fightView(S, pl, now), open: true }); }
    if (a.kind === "prize") { pl.act = null; return this.prizeSpin(pl); }
    if (a.kind === "ghostlantern") { pl.act = null; return this.hwLantern(S, pl, a.ob); }
    /* (2026-09-24) the Carnival’s three stalls. One kind for all of them: carnivalOpen reads which it is off
       the object, because they are one game with three boards. */
    if (a.kind === "carnival") { pl.act = null; return this.carnivalOpen(S, pl, a.ob); }
    /* (2026-09-24) the menagerie turnstile: it does not open, it steps ONE person through and eats their ticket */
    if (a.kind === "turnstile") { pl.act = null; return this.carnivalTurnstile(S, pl, a.ob); }
    if (a.kind === "jukebox") { pl.act = null; pl.out.push(this.songMsg()); return pl.out.push({ type: "jukebox", radio: this.radio || null }); }
    /* (v117) THE SPORTSBOOK. The game server has nothing to do with Picks: no market, no stake, no settlement. It says the
       board was walked up to, and the page talks to eastcoin.vip from there, the way the Russian Roulette table already does. */
    if (a.kind === "picks") { pl.act = null; return pl.out.push({ type: "picks" }); }
    /* (v119) THE PICTURE HOUSE. Same arrangement as the Sportsbook: the game server says the screen was walked up to,
       and the page talks to eastcoin.vip's Movies & TV from there. No film, no room and no clock passes through here. */
    if (a.kind === "cinescreen") { pl.act = null; return pl.out.push({ type: "cinescreen" }); }
    if (a.kind === "mirror") { pl.act = null; return pl.out.push({ type: "mirror" }); }   /* the page opens the look screen; the pick comes back as t:"look" */
    if (a.kind === "rrboard") { pl.act = null; return pl.out.push({ type: "rrboard" }); }
    if (a.kind === "shot") { pl.act = null; return this.rrShot(S, pl, now); }
    if (a.kind === "rr") { pl.act = null; this.rrLook(now); return pl.out.push({ type: "rr" }); }   /* Russian Roulette is the site's table: the page opens its window and talks to the site */
    if (a.kind === "fame") { pl.act = null; const F = this.fameToday(); return pl.out.push({ type: "popup", title: "Winners' Wall", icon: "🏆", text: F.rows.length ? `TODAY'S BIGGEST WINS\n\n${F.rows.map((r, i) => `${i + 1}. ${r.name}: +${G.fmtCash(r.profit)} on ${r.game}`).join("\n")}\n\nWin ${G.fmtCash(G_FAME_MIN)} or more on one bet to get your name up here. The wall is wiped at midnight, Central.` : `Nobody's won ${G.fmtCash(G_FAME_MIN)} on one bet yet today. The wall is empty, and it could be your name at the top of it.` }); }
    if (a.kind === "cooler" || a.kind === "buffet") { pl.act = null; return this.say(pl, a.kind === "cooler" ? "You fill a paper cup and drain it. Refreshing. It does nothing else." : "You load up a plate. It's free, and it tastes like it."); }   /* (hunger and thirst are off: BACKLOG) */
    if (a.kind === "game" && S.def.real?.[a.ob.t]) { pl.act = null; return pl.out.push({ type: "real", g: a.ob.t }); }   // eastcoin.vip's own game, for real ZCoins: the page opens the window and talks to the site itself
    if (a.kind === "game" && !G.GAMES[a.ob.t]) { pl.act = null; return; }
    if (a.kind === "game") { pl.act = null; return pl.out.push({ type: "game", g: a.ob.t, pot: Math.floor(this.jack.pot), lastJack: this.jack.wins?.[0] || null }); }
    if (a.kind === "crypt") { pl.act = null; return this.cryptDoor(S, pl); }
    /* (2026-09-25) THE COUNT ROOM. countdoor is the way in, off the casino floor; the other three only exist
       inside a run. Each is a kind in this file's own map AND in the page's KIND_OF — this one decides whether
       a click does anything, that one only labels it. */
    if (a.kind === "countdoor") { pl.act = null; return this.countDoor(S, pl); }
    if (a.kind === "countsearch") { pl.act = null; return S.def.count ? this.countSearch(S, pl, a.ob) : undefined; }
    if (a.kind === "countbox") { pl.act = null; return S.def.count ? this.countBox(S, pl, a.ob) : undefined; }
    if (a.kind === "countexit") { pl.act = null; return S.def.count ? this.countExit(S, pl, a.ob) : undefined; }   /* the object matters: the back stairs are a countexit with bolt:true and always open */
    if (a.kind === "pyramid") { pl.act = null; return this.pyramidDoor(S, pl); }
    /* (2026-09-24) THE PYRAMID BORROWS THE CRYPT'S FIXTURE ART, so these three kinds arrive from both
       dungeons and each has to go to the right one. Branching on the scene is what keeps the tomb's lever from
       calling the Crypt's. */
    if (a.kind === "cryptlever") { pl.act = null; return S.def.pyramid ? this.pyramidLever(S, pl) : this.cryptLever(S, pl); }
    if (a.kind === "cryptexit") { pl.act = null; return S.def.pyramid ? this.pyramidExit(S, pl) : this.cryptExit(S, pl); }
    if (a.kind === "tower") { pl.act = null; return this.towerDoor(S, pl); }        /* the door in the Yard: opens the page's window */
    if (a.kind === "towerup") { pl.act = null; return this.towerUp(S, pl); }        /* the stairs: refuses until the floor is clear */
    if (a.kind === "cryptloot") { pl.act = null; return S.def.pyramid ? this.pyramidLootOpen(S, pl) : this.cryptLootOpen(S, pl); }
    if (a.kind === "pen") { pl.act = null; return this.penView(S, pl); }
    if (a.kind === "hatchery") { pl.act = null; return this.hatchView(S, pl); }   /* (2026-09-27) the hatchery's window */
    if (a.kind === "shroom") { pl.act = null; return this.fungPick(S, pl, a.ob); }   /* (2026-09-27) Fungiculture */
    if (a.kind === "fbed") { pl.act = null; return this.fungBed(S, pl, a.ob, now); }
    if (a.kind === "cellar") { pl.act = null; return this.fungDown(S, pl); }   /* (2026-09-27) Breeding: the page opens the pen window */
    if (a.kind === "hiscores") { pl.act = null; return pl.out.push({ type: "hiscores" }); }   /* (v96) the board on the wall opens the page's own Hiscores window */
    if (a.kind === "howto") { pl.act = null; return pl.out.push({ type: "popup", title: "How EastScape works", text: G.HOWTO, icon: "🎰" }); }
    if (a.kind === "board") { pl.act = null; this.tourStep(pl, "play"); this.tourStep(pl, "board"); return this.dailySend(pl); }   /* (v96: the board also clears "play a game", so a player with no ZCoins is sent to work, not left stuck) */
    if (a.kind === "roulette" && S.def.realRound) { pl.act = null; return pl.out.push({ type: "roundopen", key: S.def.realRound }); }
    if (a.kind === "roulette") { pl.act = null; pl.out.push({ type: "roulopen" }); return this.roulSendTo(S, pl); }
    if (a.kind === "exchange") { pl.out.push({ type: "exchange" }); return this.exSend(pl); }
    if (a.kind === "hole") {
      if (G.lvlOf(C, G.WILD_REQ.skill) < G.WILD_REQ.lvl) return pl.out.push({ type: "popup", title: "The Wilderness", icon: "☠️", text: `You need level ${G.WILD_REQ.lvl} in ${G.SKILLS[G.WILD_REQ.skill].name} to enter the Wilderness.` });
      return pl.out.push({ type: "wildask" });
    }
    if (a.kind === "agilend") {
      const ms = pl.runAt ? Date.now() - pl.runAt : 0;
      if (!ms) return this.say(pl, "Start at the other end.", "bad");
      pl.runAt = Date.now();                                    // straight into another run
      /* WHAT A CLEAN LAP IS WORTH. The finish pays its own xp plus the same again in proportion to how many gates
         were taken perfectly, so eight out of eight DOUBLES it. A share rather than an all-or-nothing bonus: one
         fumbled gate on the last shutter should cost you something, not everything. */
      const perfect = Math.min(pl.runPerfect | 0, S.def.gates.length), share = perfect / S.def.gates.length;
      this.grant(pl, "agility", Math.round(G.AGIL_XP.finish * (1 + share)));
      const secs = (ms / 1000).toFixed(1), tail = perfect ? ` ${perfect}/${S.def.gates.length} perfect.` : "";
      const best = pl.C.stats.runBest || 0;
      if (!best || ms < best) { pl.C.stats.runBest = ms; this.touch(pl); this.say(pl, `The Run: ${secs}s. A new best.${tail}`, "loot"); }
      else this.say(pl, `The Run: ${secs}s. Your best is ${(best / 1000).toFixed(1)}s.${tail}`, "good");
      pl.runPerfect = 0;
      this.moveToScene(pl, "agility", null, G.SCENES.agility.entry);
      return;
    }
    if (a.kind === "rope") {
      /* Back the way you came. It used to be hardcoded to the farm, which is CLOSED: climbing out would have stranded
         you somewhere with no exits. A relog loses wildFrom, so the Gloam's ladder is the fallback. */
      const back = pl.wildFrom && G.OPEN.has(pl.wildFrom.scene) ? pl.wildFrom : { scene: "gloam", x: 7, y: 20 };
      pl.wildFrom = null;
      this.moveToScene(pl, back.scene, null, { x: back.x, y: back.y });
      return this.say(pl, `You climb back up to ${G.SCENES[back.scene]?.name || "safety"}. Nobody can attack you up here.`);
    }
    if (a.kind === "ferry") return pl.out.push({ type: "ferry" });
    if (a.kind === "boatback") { this.moveToScene(pl, G.ISLE_FERRY.scene, null, G.ISLE_FERRY); return this.say(pl, "Charon takes you back to the square without a word."); }
    /* (2026-09-23) PLOTS ARE BACK; the PEN is not. Planting was switched off on 2026-09-21 because crops ran 1, 5,
       then 50 and there was nothing to plant in the middle; four crops at 10/20/30/40 now fill it. The pen stays
       shut until after launch - it has no feeding code at all, and it is the sink farming still wants. */
    if (a.kind === "pen") { pl.act = null; return this.say(pl, "Not ready yet, coming soon."); }
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
      if (!this.hasTool(pl, "mining", ob.req?.lvl)) { pl.act = null; return; }
      /* (2026-09-24) MINING NEVER APPLIED THE SPEED LEVER. The comment on the thieving branch says "every other
         skill divides its action by (1 + fx.speed)" and that was simply not true here or on a tree: a speed
         potion, the Card sharp's gloves and a Bonepup all did nothing for a miner, while a fisherman got the
         lot. It was found asking why the Coilling's +10% skilling rate would not reach a pickaxe. Same lever,
         same 20% ceiling, applied the way fishing already applies it — alongside the tool's own multiplier. */
      const tspd = G.toolSpeed(C, "mining") * (1 + G.swingFx(C));   // (2026-09-22) what the rung buys: 8% a tier off every swing
      if (ob.emptyUntil > now) { this.say(pl, "There's no ore left in this rock. It'll be back soon."); pl.act = null; return; }
      if (!a.started) { a.started = now; a.next = now + Math.round((vein ? 5000 : 1800) / tspd); pl.swingAt = now; this.say(pl, vein ? "You settle in at the vein. It's slow, but it never runs dry." : "You swing your pickaxe at the rock."); return; }
      if (now - pl.swingAt > 1100) pl.swingAt = now;
      if (now < a.next) return;
      this.groupNote(S, pl, a);
      if (vein) {
        a.next = now + Math.round(6000 / tspd);
        if (Math.random() < (0.55 + bonus) * G.gatherMul(S.def)) { if (!this.give(pl, ob.ore)) { pl.act = null; return; } this.gained(S, pl, ob.ore, 1, "gather", "mining"); this.grant(pl, "mining", gx(9)); this.questCheck(pl);
        /* (2026-09-25) A STONE, sometimes. GEM_DROP is keyed by ore, so the rock you are mining decides which gem,
           and the same rock decides which arrows that gem tips. keepRare, because a gem that vanished into a full
           bag would be the rarest thing this skill loses. */
        for (const [gk, gp] of (G.GEM_DROP[ob.ore] || [])) if (Math.random() < gp * (1 + G.charmOf(C, "stonesense") / 100 + G.petFx(C).gem / 100)) { const where = this.keepRare(pl, gk, 1); if (where) { this.emit(pl, "loot", { k: gk, n: 1 }); this.say(pl, `Something glints in the ore: a ${G.ITEMS[gk].name.toLowerCase()}!${where === "bank" ? " Your bag was full, so it went to your bank." : ""}`, "loot"); } }
        }
      } else {
        a.next = now + Math.round(1800 / tspd);
        if (Math.random() < (Math.min(0.9, 0.4 + G.lvlOf(C, "mining") * 0.02) + bonus) * G.gatherMul(S.def)) {   /* half out in the Wilderness: see WILD_GATHER */
          if (!this.give(pl, ob.ore)) { pl.act = null; return; }
          this.gained(S, pl, ob.ore, 1, "gather", "mining");
        /* (2026-09-25) A STONE, sometimes. GEM_DROP is keyed by ore, so the rock you are mining decides which gem,
           and the same rock decides which arrows that gem tips. keepRare, because a gem that vanished into a full
           bag would be the rarest thing this skill loses. */
        for (const [gk, gp] of (G.GEM_DROP[ob.ore] || [])) if (Math.random() < gp * (1 + G.charmOf(C, "stonesense") / 100 + G.petFx(C).gem / 100)) { const where = this.keepRare(pl, gk, 1); if (where) { this.emit(pl, "loot", { k: gk, n: 1 }); this.say(pl, `Something glints in the ore: a ${G.ITEMS[gk].name.toLowerCase()}!${where === "bank" ? " Your bag was full, so it went to your bank." : ""}`, "loot"); } }
          this.grant(pl, "mining", gx(ob.xp || (ob.ore === "tin" ? 18 : 17))); this.say(pl, `You mine some ${G.ITEMS[ob.ore].name.toLowerCase()}.`, "good");
          /* (2026-09-22) IT ONLY GOES EMPTY WHEN THE ROCK IS ACTUALLY OUT. This used to set emptyUntil and clear
             pl.act on EVERY success, so one ore cost a click and an eight-second wait. Same shape as the olive
             tree below: take one, and stop only when there is nothing left. `left` is re-rolled here rather than
             at the refill, so a rock that nobody comes back to still has a number waiting on it. */
          this.questCheck(pl);
          /* A rock that predates this (a scene built by an older worker, or any object that missed the init above)
             has no `left`, and `--undefined` is NaN, which is never <= 0 - an infinitely mineable rock. Seed it
             before decrementing rather than trusting the scene factory to have reached every one. */
          if (!(ob.left > 0)) ob.left = rint(G.ORE_IN_ROCK[0], G.ORE_IN_ROCK[1]);
          if (--ob.left <= 0) {
            ob.left = rint(G.ORE_IN_ROCK[0], G.ORE_IN_ROCK[1]);
            ob.emptyUntil = now + (ob.special ? 30000 : 8000);
            this.say(pl, "That's the last of the ore in this rock.");
            pl.act = null;
          }
        }
      }
      return;
    }
    /* PICKPOCKETING (2026-09-23). A MARK IS A NODE, not a monster: this is the rock loop above with a different
       roll, which is exactly why Thieving needed no combat code and cannot be fought back against.

       Three things here are the design rather than the implementation. The chance CLIMBS with your level over the
       mark's (pickChance), because Agility pays a flat 222 xp a lap and takes 557 hours to 99 and that is not
       being repeated. A failure COSTS something that is not death - you are shaken off for a few seconds and one
       stolen thing falls out of your bag - because the hospital bill belongs to DEATH and is keyed to areas.
       And what a mark carries is always a GOOD, never tickets: thieving pays instantly with no input cost, so a
       ticket drop would make it the best faucet in the game. */
    /* (2026-09-23) THE DOOR BETWEEN CHAMBERS. The wall either side of it is solid, so this is the only way
       deeper into the guild and the only thing enforcing the ladder - the marks' own `req` stops you PICKING
       above your level, it never stopped you walking past them. Refusing here is what makes each room a room. */
    if (a.kind === "guildgate") {
      pl.act = null;
      const have = G.lvlOf(C, "thieving");
      if (have < (ob.lvl | 0) && !pl.god) return this.say(pl, `The door won't budge. ${ob.name.split(" — ")[0].replace("Door to the ", "")} don't let just anyone through: Thieving ${ob.lvl}, and you're ${have}.`, "bad");
      /* step through to whichever side you are NOT on */
      const to = pl.x < ob.x ? ob.x + 1 : ob.x - 1;
      if (!G.walkableIn(S.g, to, ob.y)) return this.say(pl, "Something's behind that door. Try again in a moment.", "bad");
      pl.x = to; pl.y = ob.y; pl.step = null; pl.path = []; pl.dir = pl.x < ob.x ? "west" : "east";
      this.placeSafely(S, pl); this.touch(pl);
      return this.say(pl, "You slip through.", "good");
    }
    if (a.kind === "mark") {
      const M = G.MARKS[ob.mark]; if (!M) { pl.act = null; return; }
      if (pl.stunUntil > now) { pl.act = null; return this.say(pl, "You're still shaking that off. Give it a second."); }
      if (ob.emptyUntil > now) { pl.act = null; return this.say(pl, `${M.name} has their hand on their pocket. Try someone else.`); }
      /* (2026-09-24) SPEED APPLIES HERE TOO. Every other skill divides its action by (1 + fx.speed) and this
         one never did, so Bonepup, the Card sharp's gloves and a smoked sky eel did nothing at all for a thief.
         Half of what makes the Ditched set worth wearing is simply that this line now exists. */
      const fxT = G.fxOf(C), pickMs = Math.round(G.THIEF.ms / (1 + G.swingFx(C)));   /* fxT is still wanted below for .steal */
      if (!a.started) { a.started = now; a.next = now + pickMs; this.say(pl, `You fall into step behind ${M.name.toLowerCase()}.`); return; }
      if (now < a.next) return;
      a.next = now + pickMs;
      this.groupNote(S, pl, a);
      if (Math.random() < G.pickChance(C, M.lvl, fxT.steal)) {
        const k = G.markDrop(ob.mark);
        if (!this.give(pl, k)) { pl.act = null; return; }
        this.gained(S, pl, k);
        /* THE CLEAN RUN: every fifth lift in a row pays a second time. A catch resets it below, so the streak is
           the thing the stun now costs you - see THIEF.streakEvery for why the loop wanted this at all. */
        pl.pickRun = (pl.pickRun | 0) + 1;
        const every = G.THIEF.streakEvery, hot = pl.pickRun % every === 0;
        let extra = null;
        if (hot) { extra = G.markDrop(ob.mark); if (!this.give(pl, extra)) extra = null; else this.gained(S, pl, extra); }
        this.grant(pl, "thieving", gx(M.xp)); this.questCheck(pl);
        this.say(pl, hot
          ? `${pl.pickRun} clean in a row. You lift ${G.ITEMS[k].name.toLowerCase()}${extra ? ` AND ${G.ITEMS[extra].name.toLowerCase()}` : ""} off ${M.name.toLowerCase()}.`
          : `You lift ${G.ITEMS[k].name.toLowerCase()} off ${M.name.toLowerCase()}.${pl.pickRun % every === every - 1 ? " One more clean and the next one counts double." : ""}`, "good");
        ob.emptyUntil = now + 6000;   /* they close up for a moment, so a room is worked rather than one pocket */
        pl.act = null;
        return;
      }
      /* caught. Drop one of the things you came here for - never tickets, never gear, never a permit: it has to
         sting without being a way to lose something that did not come out of this room. */
      pl.stunUntil = now + rint(G.THIEF.stun[0], G.THIEF.stun[1]);
      pl.pickRun = 0;   /* the run is what a catch really costs now */
      pl.act = null;
      const canLose = [...new Set(Object.values(G.MARKS).flatMap((x) => x.drop.map(([k]) => k)))].filter((k) => G.countItems({ inv: C.inv, bank: [] }, [k]) > 0);
      const lost = canLose.length ? canLose[Math.floor(Math.random() * canLose.length)] : null;
      if (lost) { G.takeInv(C.inv, lost, 1); this.touch(pl); }
      this.say(pl, `${M.name} catches your wrist. ${lost ? `You get away, but ${G.ITEMS[lost].name.toLowerCase()} goes with them.` : "You get away with nothing but a look."}`, "bad");
      pl.out.push({ type: "caught", until: pl.stunUntil });
      return;
    }
    /* Every station — campfire, range, furnace, anvil — runs the same loop off
       the RECIPES table. Cooking behaves exactly as it did; smelting and
       smithing are rows, not code. A station is `auto` when it should just get
       on with the best thing you can make (cooking, smelting); the anvil is
       not, because "which of the forty things" is a question only you can
       answer, so it waits for a.pick. */
    if (a.kind === "cook" || a.kind === "smelt" || a.kind === "smith" || a.kind === "brew" || a.kind === "fletch" || a.kind === "print" || a.kind === "breed" || a.kind === "rot" || a.kind === "jewel") {
      const nx = G.STATIONS[ob.t]?.nexus ? G.NEXUS : null;   /* (2026-09-26) the Nexus: twice the output, half as much xp again */
      const st = G.STATIONS[ob.t];
      if (!st) { pl.act = null; return; }
      const lv = G.lvlOf(C, st.skill), all = G.recipesAt(ob.t);
      /* Told what to make? Make THAT and nothing else. Otherwise take the best you can, which is what every
         station except the anvil has always done and is still what one click gets you.
         THE POINT OF A PICK IS THAT IT DOES NOT DRIFT: if the chosen thing runs out, the loop stops and says so
         rather than falling through to the next best, because falling through is the bug being fixed - it is how
         a bag of sardines became a cooked bowfin. */
      /* (2026-09-27) A CLICK WITH NO CHOICE IS A WAIT, not a failure: the window is open on the page and nothing is made until a row
         is chosen. Saying "you have nothing to cook" here, with a bag full of fish, was the old auto path's message showing through. */
      if (!a.pick && !st.auto) { pl.act = null; return; }
      const wanted = a.pick ? all.find((r) => r.id === a.pick) : null;
      const r = wanted ? (G.canMake(C, wanted) ? wanted : null) : (st.auto ? all.find((x) => G.canMake(C, x)) : null);
      if (!r) {
        if (wanted) this.say(pl, G.lvlOf(C, wanted.skill) < wanted.lvl
          ? `You need a ${G.SKILLS[wanted.skill].name} level of ${wanted.lvl} to ${st.verb} that.`
          : `You need ${wanted.in.filter(([k, n]) => G.countItems(C, [k]) < n).map(([k, n]) => `${n} × ${G.ITEMS[k].name.toLowerCase()} (you have ${G.countItems(C, [k])})`).join(" and ")}.`, "bad");
        else {
          // nothing doable: say whether it is a level or a missing ingredient
          const tooHard = all.find((x) => x.in.every(([k, n]) => G.countItems(C, [k]) >= n) && lv < x.lvl);
          /* (2026-09-22, the owner) SAY IT IS THE CHARCOAL. Since every smelt started needing fuel, standing at the
             furnace with a bag full of ore and no charcoal answered "You have nothing to smelt at the furnace",
             which is true and useless - the ore is right there. Look for a recipe that your level allows and that
             you have everything for EXCEPT the charcoal, and name the actual missing thing. It also says what to do
             about it, because the answer is not obvious: you do not buy charcoal, you bring logs and this same
             furnace burns them. */
          const coalWant = all.find((x) => lv >= x.lvl && x.in.some(([k]) => k === "charcoal")
            && x.in.every(([k, n]) => k === "charcoal" || G.countItems(C, [k]) >= n)
            && G.countItems(C, ["charcoal"]) < (x.in.find(([k]) => k === "charcoal")?.[1] || 0));
          const haveLogs = Object.keys(G.ITEMS).some((k) => /logs$/.test(k) && G.countItems(C, [k]) > 0);
          this.say(pl, coalWant
            ? `You need ${coalWant.in.find(([k]) => k === "charcoal")[1]} charcoal to ${st.verb} that, and you have ${G.countItems(C, ["charcoal"])}. ${haveLogs ? "Your logs will burn into it here — stay at the furnace." : "Bring logs: the furnace burns them into charcoal."}`
            : tooHard
              ? `You need a ${G.SKILLS[tooHard.skill].name} level of ${tooHard.lvl} to ${st.verb} that.`
              : `You have nothing to ${st.verb} at the ${st.name}.`, coalWant || tooHard ? "bad" : "sys");
        }
        pl.act = null; return;
      }
      const outName = G.ITEMS[r.out[0]].name.toLowerCase();
      if (!a.started && r.burnStop != null && G.burnChance(r, lv, ob.t === "range") >= G.COAL_STEADY_MIN && G.countItems(C, ["charcoal"]) > 0) this.say(pl, "You bank the fire with charcoal. Nothing will burn while it lasts.", "good");   /* said once at the start, so the fuel is never spent silently */
      if (!a.started) { a.started = now; a.next = now + r.ms; pl.swingAt = now; this.say(pl, `You start ${st.verb === "cook" ? "cooking" : st.verb === "smelt" ? "smelting" : st.verb === "brew" ? "brewing" : st.verb === "print" ? "printing" : st.verb === "mix" ? "mixing" : st.verb === "cut" ? "cutting" : st.verb === "prepare" ? "preparing" : "hammering out"} the ${st.verb === "cook" ? G.ITEMS[r.in[0][0]].name.toLowerCase().replace(/^raw /, "") : outName}.`); return; }
      if (now - pl.swingAt > 900) pl.swingAt = now;
      if (now < a.next) return;
      a.next = now + r.ms;
      // room for what comes out, and for the ruined version if it can fail
      /* (2026-09-24, reported by the owner: smelting logs refused with "your inventory is full" on a bag with two
         free slots) THE CHARACTER HAS TO BE PASSED. roomFor's third argument is the character and it DEFAULTS TO
         NULL, and bagMax(null) is a flat INV_MAX - so this line sized every station in the game at 20 slots and
         silently ignored the pockets bought with tickets and earned from achievements. The `burnt` check beside
         it always passed C, which is exactly why it read as correct at a glance. */
      if (G.roomFor(C.inv, r.out[0], C) < r.out[1] * (nx ? nx.mult : 1) || (r.burnStop != null && G.roomFor(C.inv, "burnt", C) < 1)) { this.say(pl, "Your inventory is full.", "bad"); pl.act = null; return; }
      const freeSmelt = st.kind === "smelt" && Math.random() < G.petFx(C).freesmelt / 100;   /* (2026-09-27) the Cinder Salamander: now and then a smelt costs nothing */
      if (freeSmelt) this.say(pl, "The salamander breathes on the ore. That one cost you nothing.", "good");
      else for (const [k, n] of r.in) G.takeInv(C.inv, k, n);
      /* (2026-09-22) CHARCOAL STEADIES THE FIRE: spend one instead of taking the burn roll. Only when the risk is
         worth it (G.COAL_STEADY_MIN) - at a 3% burn a charcoal costs more than the fish it saves, and silently
         burning fuel to avoid nothing is the kind of waste a player only notices as "where did my charcoal go".
         Smoking is unaffected: a smoke has no burnStop, and it is tried first anyway. */
      /* THE BURN IS ITS OWN FLAG, not the head of an if/else. This was `if (burnStop != null && rolled) { burn }
         else { produce }`, and wrapping the condition in an outer `if (r.burnStop != null)` silently re-bound that
         trailing `else` to the NEW if - so anything WITH a burnStop, which is every cooking recipe there is, ate the
         raw fish and produced nothing. It parsed perfectly and smelting was untouched (no burnStop), so it looked
         fine until players reported losing fish. Keep the outcome in a variable and decide separately. */
      let burnt = false;
      if (r.burnStop != null) {
        const risk = G.burnChance(r, lv, ob.t === "range") * (1 - G.charmOf(C, "steadyhands") / 100) * (1 - G.petFx(C).noburn / 100);   /* (2026-09-27) the Cinder Salamander */   /* (2026-09-26) Steady Hands */
        if (risk >= G.COAL_STEADY_MIN && G.countItems(C, ["charcoal"]) > 0) G.takeInv(C.inv, "charcoal", 1);
        else if (Math.random() < risk) { burnt = true; this.give(pl, "burnt"); this.emit(pl, "burn", {}); this.say(pl, "You burn it.", "bad"); }
      }
      /* (2026-09-22) A RECIPE MAY SIMPLY FAIL. `fail` is a flat chance the inputs are spent and nothing comes back,
         which is how burning charcoal loses the odd log. It rides the SAME `burnt` flag rather than introducing a
         second one, because a second flag beside an if/else is exactly what ate every cooked fish earlier today. */
      /* (2026-09-24) `fail` IS NOW A CURVE WHERE A RECIPE ASKS FOR ONE. spoilChance returns the flat r.fail when
         there is no failStop, so charcoal is untouched; alchemy sets failStop and gets cooking's own falling
         curve with a floor under it, so glasswork is never completely safe. Same `burnt` flag, so a spoiled
         batch leaves nothing behind rather than a "Burnt food" in the bag. */
      const spoil = G.spoilChance(r, lv);
      if (!burnt && spoil > 0 && Math.random() < spoil) {
        burnt = true;
        this.say(pl, st.verb === "brew"
          ? (r.out[0].startsWith("pot_") ? "The mixture turns black and stops moving. Nothing usable." : "The glass cracks as it cools. Nothing usable.")
          : `The ${G.ITEMS[r.in[0][0]].name.toLowerCase()} crumbles to ash. Nothing usable.`, "bad");
      }
      if (!burnt) {
        const outN = r.out[1] * (nx ? nx.mult : 1);
        /* (2026-09-27, a player: "it's using my charcoal and koi and I'm getting the xp but the smoked product doesn't deposit")
           THE PRODUCT IS CHECKED BEFORE THE XP IS PAID. give() refuses when the bag cannot take it and its answer was being thrown
           away, so a refusal here would have spent the inputs, paid the xp and handed over nothing. The room check above makes that
           unreachable today (a simulated 297 smokes put 269 in the bag, the flat 10% fail and nothing else), but if it is ever
           reached the inputs go back and the station stops, rather than eating a stack a fish at a time. */
        if (!this.give(pl, r.out[0], outN)) { for (const [k, n] of r.in) this.give(pl, k, n); this.touch(pl); pl.act = null; return; }
        this.gained(S, pl, r.out[0], outN, r.skill === "cooking" ? "cook" : "craft");
        /* (2026-09-23, the owner: "lets make sure we have the group bonus (+1% etc) to the campfire when users are
           cooking"). Standing at a fire with other people now pays what standing at a rock with them does: +1% xp
           each. It was only ever wired into the GATHERING branch, so a busy campfire was worth exactly as much as
           an empty one — which is the opposite of what a group bonus is for, since a fire is the one station
           people naturally crowd round. It rides workersOn like everything else, so it counts whoever is actually
           working THIS fire rather than whoever happens to be in the room.
           XP ONLY, deliberately: the gathering bonus also lifts a success roll, and a fire's equivalent would be
           the burn, but quietly making food harder to ruin is a balance change rather than a bonus and wants
           asking for on its own. */
        const group = this.workersOn(S, ob, pl) * 0.01;
        this.groupNote(S, pl, a, "your xp");
        /* (2026-09-25) "2X tickets and crafting experience". CRAFTING is this loop - the fire, the range, the
           furnace, the anvil and the cauldron - and nothing else. Doubling inside grant() would have caught
           combat, gathering and quest rewards too, which is not what was asked and would be a far bigger lever. */
        this.grant(pl, r.skill, Math.round(r.xp * (1 + group) * (this.doubleOn() ? G.DOUBLE.mult : 1) * (nx ? nx.xp : 1)));
        /* (2026-09-27) the way into Breeding: a batch of pet food trains it a little while you have no pet and no egg (G.BREED.foodXp, foodXpWhile) */
        if (G.BREED.foodXp?.[r.out[0]] && G.foodXpWhile(pl.C)) this.grant(pl, "breeding", G.BREED.foodXp[r.out[0]]);
        if (r.skill !== "cooking") this.say(pl, `You ${st.verb === "print" ? "print" : "make"} ${outN > 1 ? `${outN} × ` : "a "}${outName}.${nx ? " The Nexus doubles it." : ""}`, "good");
      }
      this.touch(pl);
      this.questCheck(pl);
      const again = a.pick ? G.canMake(C, r) : (st.auto ? all.some((x) => G.canMake(C, x)) : G.canMake(C, r));
      if (!again) { this.say(pl, a.pick ? `That's the last ${outName.toLowerCase()} you can ${st.verb}.` : `That's everything you can ${st.verb} for now.`); pl.act = null; }
      return;
    }
    if (a.kind === "tree") {
      if (ob.stumpUntil > now) { this.say(pl, "That tree's been cut down. It'll grow back."); pl.act = null; return; }
      if (!this.hasTool(pl, "woodcutting", ob.req?.lvl)) { pl.act = null; return; }
      const chop = Math.round(2000 / (G.toolSpeed(C, "woodcutting") * (1 + G.swingFx(C))));   /* (2026-09-24) the speed lever reaches a tree now; see the mining branch for why it did not */
      if (!a.started) { a.started = now; a.next = now + chop; pl.swingAt = now; this.say(pl, "You swing your axe at the tree."); return; }
      if (now - pl.swingAt > 1000) pl.swingAt = now;
      if (now < a.next) return;
      a.next = now + chop;
      const oak = ob.t === "oak";
      this.groupNote(S, pl, a);
      if (Math.random() < (Math.min(0.9, (oak ? 0.5 : 0.35) + G.lvlOf(C, "woodcutting") * 0.02) + bonus) * G.gatherMul(S.def)) {   /* half out in the Wilderness: see WILD_GATHER */
        const log = ob.log || "logs";
        if (!this.give(pl, log)) { pl.act = null; return; }
        this.gained(S, pl, log, 1, "gather", "woodcutting");
        this.grant(pl, "woodcutting", gx(ob.xp || 25)); this.say(pl, oak ? "You get some logs from the oak." : `You get some ${G.ITEMS[log].name.toLowerCase()}.`, "good"); this.questCheck(pl);
        /* (2026-09-22, the owner: "the woodcutting trees need to stay up longer before they become out, like a lot
           longer") It was 1-in-5 for an ordinary tree, so one fell after about five logs - ELEVEN SECONDS of
           chopping followed by a fifteen-second stump. You spent more time waiting at a stump than swinging at a
           tree, and every fall also cleared pl.act, so it was a re-click as well as a wait. Now a tree is good for
           about 25 logs (~55s) and an oak for 50 (~110s). The three-minute AFK cutoff is untouched and is still
           what ends a long session; this only stops the tree itself interrupting you every few swings. */
        if (Math.random() < (oak || ob.special ? 0.02 : 0.04)) { ob.stumpUntil = now + 15000; this.say(pl, `The ${oak ? "oak" : "tree"} falls.`); pl.out.push({ type: "fell" }); pl.act = null; }   /* (2026-09-23) a real event for the sound: mob_die, die and idle_stop are still matched off their chat TEXT, which would fail silently the day somebody rewords one */
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
      if (!this.hasTool(pl, "fishing", ob.req?.lvl)) { pl.act = null; return; }
      { const gate = pl.god ? null : G.bandBlock(C, S.key, "fish"); if (gate) { pl.act = null; return this.say(pl, `This water is for Fishing ${gate.need} and up. You're ${gate.have}.`, "bad"); } }   /* LEVEL BANDS */
      if (!a.started) { a.started = now; a.next = now + Math.round(G.FISHING.ms / G.toolSpeed(C, "fishing")); this.say(pl, "You cast out your line…"); return; }
      if (now < a.next) return;
      /* (2026-09-24) fx IS STILL WANTED BELOW — bite, tix, zdrop and rare all read it. Wiring the Coilling's
         swing bonus in here replaced `const fx = G.fxOf(C)` with G.swingFx(C) and took the declaration with it,
         so every cast threw a ReferenceError four lines down: the rod sound played, the tick died before the
         fish was handed over, and it looped. The owner: "fish arent going into my inventory ... the sound is
         just replaying over and over". Exactly the same slip I had already caught one branch up in thieving,
         and did not check for here. */
      const fx = G.fxOf(C);
      a.next = now + Math.round(G.FISHING.ms / ((1 + G.swingFx(C)) * G.toolSpeed(C, "fishing")));
      const lvl = G.lvlOf(C, "fishing"), fish = G.fishAt(ob, lvl, Math.random()), trout = fish === ob.fish2;   /* v68: every spot names its fish, and a second one from fish2lvl (`trout` now just means "the second fish") */
      this.groupNote(S, pl, a);
      if (Math.random() < Math.min(0.97, G.FISHING.chance(lvl) + bonus + fx.bite) * G.gatherMul(S.def)) {   /* half out in the Wilderness: see WILD_GATHER */
        if (!this.give(pl, fish)) { pl.act = null; return; }
        this.gained(S, pl, fish, 1, "gather", "fishing");
        if (fx.tix > 0 && Math.random() < fx.tix && this.give(pl, fish)) this.say(pl, "Two on one line!", "good");   /* the ticket buffs, for a fisher: that chance of a second fish */
        if (Math.random() < (G.ZDROP.fish[fish] || 0) * (1 + fx.zdrop)) this.zcoinDrop(pl, "the end of a fishing line");
        /* (2026-09-24) THE DITCHED SET COMES OUT OF THE WATER, and this is the first rare a fishing spot has ever
           dropped - until now a cast could only ever give a fish. `rare` gear helps, the same as it does on a
           kill, so a fisher who has kitted themselves for finds is better at finding these too. It is the one
           piece of thief's kit nobody in the guild sells, which is the point: Fishing feeds Thieving. */
        if (Math.random() < G.DITCHED_ODDS * (1 + fx.rare)) {
          const k = G.DITCHED[Math.floor(Math.random() * G.DITCHED.length)];
          if (this.keepRare(pl, k, 1)) this.say(pl, `Your line goes heavy. You haul up ${G.ITEMS[k].name.toLowerCase()} — somebody went in the water rather than be caught holding them.`, "loot");
        }
        if ((C.luck | 0) > 0) { C.luck--; this.touch(pl); }
        this.grant(pl, "fishing", gx(trout ? ob.xp2 || ob.xp || 50 : ob.xp || 20)); this.say(pl, `You catch a ${G.ITEMS[fish].name.replace(/^Raw /, "").toLowerCase()}.`, "good"); this.questCheck(pl);
      }
    }
  }

  killMob(S, pl, m, now) {
    /* (2026-09-23) THE SOUND IS TOLD WHAT DIED. It used to be the page matching /^You defeat / on the chat line,
       which said nothing about the creature, so a Sulking Toadstool and The House went out with the same scream.
       Sending the type lets the page pitch it by size. This is also the fragile-trigger fix the backlog asks for:
       reword that chat line now and the sound is unaffected. */
    pl.out.push({ type: "mobdie", t: m.t });
    if (S.def.count) return this.countKill(S, pl, m, now);
    if (S.def.crypt) return this.cryptKill(S, pl, m, now);
    if (S.def.pyramid) return this.pyramidKill(S, pl, m, now);
    const def = G.MOBS[m.t];
    // the more people fighting here, the sooner it comes back (see G.respawnMs): same monsters on screen, less waiting
    const fighters = this.playersIn(S).filter((p) => now - (p.fightAt || 0) < 60000).length;
    /* (2026-09-25) A PLACEMENT'S OWN TIMER WINS, and a two-element one is a RANGE rather than a number, so a
       guard cannot be counted down to the second and camped on the tick. */
    const own = m.respawn;
    m.dead = true; m.claim = null;
    m.respawnAt = now + (Array.isArray(own) ? rint(own[0], own[1]) : own || G.respawnMs(S.def, m.t, fighters));
    pl.act = null;
    /* (2026-09-25) STAND AND SHOOT. An archer with a loaded quiver draws on the next monster OF THE SAME KIND inside
       the bow's reach - same kind, so a chicken run never turns into a fight with the guard beside it. lastInput is
       not touched: the AFK timer still ends it. */
    if (G.ARCHERY.retarget && G.ammoOf(pl.C)) {
      const reach = G.reachOfHeld(pl.C);
      const next = S.mobs.filter((x) => !x.dead && x.t === m.t && x.id !== m.id && G.cheb(pl, x) <= reach && this.mayFight(S, x, pl, now)).sort((a, b) => G.cheb(pl, a) - G.cheb(pl, b))[0];
      if (next) pl.act = { kind: "mob", id: next.id, x: next.x, y: next.y, name: def.name, reach, started: now };
    }
    const got = this.killLoot(S, pl, m, def, now);
    /* (2026-09-27) AN OPEN BOSS PAYS EVERYONE WHO FOUGHT HIM: each of them who is still here and took at least OPEN_SHARE of his
       health gets their own roll of the same table, their own kill for quests and finds, and their own line. The killer is
       counted once, above. */
    const shared = def.open ? this.playersIn(S).filter((q) => q !== pl && (m.by?.[q.id] || 0) >= (m.maxHp || def.hp) * G.OPEN_SHARE) : [];
    for (const q of shared) {
      const g2 = this.killLoot(S, q, m, def, now); q.out.push({ type: "mobdie", t: m.t });
      this.say(q, `The ${def.name.toLowerCase()} goes down, and you were in it.${g2.length ? ` You get ${g2.map(([k, n]) => `${n > 1 ? n + " " : ""}${G.ITEMS[k].name.toLowerCase()}`).join(", ")}.` : ""}`, "loot");
      this.emit(q, "kill", { mob: m.t, style: G.styleOf(q.C) });
    }
    if (G.hwOn() && m.t === "pumpkinking") { m.respawnAt = Infinity; S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null; this.hwKingDown(pl, now, shared); }   /* the corpse goes: the ordinary respawn loop must never bring him back, the hour does */
    this.say(pl, `You defeat the ${def.name.toLowerCase()}.${got.length ? ` It drops ${got.map(([k, n]) => `${n > 1 ? n + " " : ""}${G.ITEMS[k].name.toLowerCase()}`).join(", ")}.` : ""}`, "loot");
    this.emit(pl, "kill", { mob: m.t, style: G.styleOf(pl.C) });   /* (2026-09-27) the style, for a quest that asks for a bow or a wand */
    /* (2026-09-22) THE TOWER's floor. Last, so everything a normal kill does has already happened — a tower monster
       is an ordinary monster in every other respect, which is what keeps it out of the combat code entirely. */
    if (S.def.tower) this.towerCleared(S, pl, m);
  }
  /** (2026-09-27) one player's share of a kill: the drop table, a pet, and the Long Night's rolls. Split out of killMob so an open boss
      can pay everyone who fought him the same way it pays the killer. Returns what they got, for the line. */
  killLoot(S, pl, m, def, now) {
    const got = [];
    for (const [k, n, chance] of def.drops) {
      if (chance != null && Math.random() >= chance) continue;
      let qty = Array.isArray(n) ? rint(n[0], n[1]) : n;
      /* (2026-09-25) THE 2X EVENT REACHES A KILL'S TICKETS HERE, and only here. I first put the doubling in
         tixTo and said it was "the one place every ticket in the game passes through" — it is not. A monster's
         tickets are not PAID, they are DROPPED: they are the first line of its drop table (see the BOUNTY loop
         in the rules), handed over by the ordinary item path, so tixTo never sees them and the event missed the
         single biggest source of tickets in the game. The owner asked whether it applied to ticket drops, which
         is how it was found.
         Doubling the QUANTITY at the drop covers all fifty-odd monsters without touching a single drop table,
         and it happens AFTER the ticket buffs so a Coin Toad and a 2X multiply rather than one swallowing the
         other. tools/eastscape-content-check.mjs now fails if either of the two paths loses its doubling. */
      if (k === "tickets") { qty = Math.round(qty * (1 + G.fxOf(pl.C).tix + G.petFx(pl.C).tix / 100)); if (this.doubleOn()) qty = Math.round(qty * G.DOUBLE.mult); this.earned(pl, qty); }   /* fxOf is a fraction; petFx.tix is a percent */   /* the ticket buffs (G.fxOf), and the VIP count */
      if (this.give(pl, k, qty)) { got.push([k, qty]); this.emit(pl, "loot", { k, n: qty }); }
    }
    /* (2026-09-22) A PET. 1 in 1,000 in the Boneyard and beyond, rolled per kill and never more than one at a time.
       It goes straight into the pet list rather than the bag, because a pet is an instance with a name, not a stack. */
    if (G.PET_SCENES.has(String(S.key).split(":")[0]) && Math.random() < G.PET_DROP) {
      /* (2026-09-24) PET_DROP_KEYS, not PET_KEYS: a raid pet is not in the pool. This rolled over every pet
         there is, so the Coilling — the best of them, meant to be the Great Pyramid's reward — was also falling
         off ordinary kills out here at a sixth of every one-in-a-thousand. */
      const k = G.PET_DROP_KEYS[Math.floor(Math.random() * G.PET_DROP_KEYS.length)];
      const pet = { id: `pt${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, k, name: "" };
      pl.C.pets.push(pet);
      /* (2026-09-22) WEAR IT, if nothing else is worn. A drop only went into the pet LIST, so it followed nobody
         until its owner found the Equipment tab and switched it on - and the line below told them it was already
         "at your heel", which is why a pet could be found and then never seen by anyone, including the finder.
         One kill in a thousand should not need a toggle hunted for. An existing pet is never displaced: that is a
         choice its owner made. */
      const wearIt = !pl.C.eq.pet;
      if (wearIt) pl.C.eq.pet = pet.id;
      this.touch(pl);
      this.say(pl, wearIt
        ? `${G.PETS[k].name} follows you out of the dark. A pet, and it's at your heel now — name it in your Equipment tab.`
        : `${G.PETS[k].name} follows you out of the dark. A pet! It's waiting in your Equipment tab: you're already walking ${G.petLabel(G.activePet(pl.C))}.`, "loot");
      /* (2026-09-22) THE FINDER GETS THE LINE TOO. This said `q !== pl`, so the one person it happened to was the
         only one without it in their chat — they got the transient say() above, which is gone in nine seconds.
         A pet is one kill in a thousand; it should still be there to scroll back to. (The jackpot-kill line
         already includes its winner, so this is the house style, not a new one.) */
      for (const q of this.pls.values()) q.out.push({ type: "casinonote", text: `🐾 ${pl.name} found a pet: ${G.PETS[k].name}, off a ${def.name.toLowerCase()}!` });   /* the monster is worth saying: a 1-in-1000 drop is a story, and "off a Yard Gator" is most of it */
    }
    /* (2026-09-27) BREEDING: an egg, one kill in G.BREED.eggDrop, from the eggs whose home this map is */
    if (Math.random() < G.BREED.eggDrop) {
      const ek = G.eggFor(S.key), where = this.keepRare(pl, ek, 1);
      if (where) { got.push([ek, 1]); this.emit(pl, "loot", { k: ek, n: 1 }); for (const q of this.pls.values()) q.out.push({ type: "casinonote", text: `\u{1F95A} ${pl.name} found a ${G.ITEMS[ek].name.toLowerCase()}!` }); }
    }
    /* (2026-09-27) THE LONG NIGHT rides every kill: candy corn at a flat rate (doubled at Nightfall), ectoplasm now and then, and a
       monster that carries its own pet (the King's Black Cat) rolls it here, outside the 1-in-1,000 pool above. */
    if (G.hwOn()) {
      const dbl = G.nightfallOn() ? 2 : 1;
      if (Math.random() < G.HW.corn.kill) { const n = rint(G.HW.corn.n[0], G.HW.corn.n[1]) * dbl; if (this.hwGive(pl, n)) got.push(["candycorn", n]); }
      if (Math.random() < G.HW.ecto && this.give(pl, "ectoplasm", 1)) { got.push(["ectoplasm", 1]); this.emit(pl, "loot", { k: "ectoplasm", n: 1 }); }
      if (def.lvl >= G.HW.legend.lvl && Math.random() < G.HW.legend.chance) {   /* (2026-09-27) a legendary off anything of level 80 or more */
        const k = G.HW.legend.items[Math.floor(Math.random() * G.HW.legend.items.length)], where = this.keepRare(pl, k, 1);
        if (where) { got.push([k, 1]); this.say(pl, `${G.ITEMS[k].name}. ${where === "bank" ? "No room in your bag: it went to your bank." : "It is yours."}`, "loot"); this.houseSay(`\u{1F383} ${pl.name} took ${G.ITEMS[k].name} off ${def.name}. A Long Night legendary.`); for (const q of this.pls.values()) if (q !== pl) q.out.push({ type: "casinonote", text: `\u{1F383} ${pl.name} found ${G.ITEMS[k].name}!` }); }
      }
      if (def.pet && G.PETS[def.pet[0]] && Math.random() < def.pet[1] && !pl.C.pets.some((p) => p.k === def.pet[0])) {
        const k = def.pet[0], pet = { id: `pt${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, k, name: "" };
        pl.C.pets.push(pet); if (!pl.C.eq.pet) pl.C.eq.pet = pet.id; this.touch(pl);
        this.say(pl, `${G.PETS[k].name} steps out of the ${def.name.toLowerCase()}'s shadow and sits at your heel. A pet: name it in your Equipment tab.`, "loot");
        for (const q of this.pls.values()) q.out.push({ type: "casinonote", text: `🐈‍⬛ ${pl.name} found a pet: ${G.PETS[k].name}, off ${def.name}!` });
      }
    }
    return got;
  }
  // killer: the player who landed the last hit, or { mob: name }
  die(pl, S, killer) {
    if (S?.def.count) return this.countDeath(pl, S);
    if (S?.def.crypt) return this.cryptDeath(pl, S);
    if (S?.def.pyramid) return this.pyramidDeath(pl, S);
    if (S?.def.tower) return this.towerDeath(pl, S);   /* (2026-09-22) out of the Tower, back to the Yard: the climb is lost, the checkpoint is not */
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
    /* (2026-09-25, the owner: PvP kills in the Wildy "need to be announced in chat globally"). EVERYBODY hears
       it, wherever they are - that is the point of a Wilderness kill, and a line in chat is the only thing that
       makes the risk out there visible to people who never go. Only a real player kill in a pvp scene: a death
       to a monster, a fall, or a duel in the Cage is not somebody being robbed. */
    if (pk && S?.def?.pvp && !G.inCage(S.def, pl.x, pl.y)) this.houseSay(`⚔️ ${pl.name} was just slain by ${pk.name} in ${S.def.name}.`);
    let lost = null;
    if (S?.def.pvp) {
      const worn = G.SLOTS.filter((s) => C.eq[s]);
      if (worn.length && Math.random() < G.PVP.drop) { const s = pick(worn); lost = C.eq[s]; C.eq[s] = null; this.dropGround(S, lost, 1, pl.x, pl.y, pk ? pk.id : null, now); }
      const nm = lost ? G.ITEMS[lost].name.toLowerCase() : null;
      if (pk) this.say(pk, `You have defeated ${pl.name}.${nm ? ` They dropped their ${nm}. It's yours for the next minute.` : ""}`, "loot");
      this.say(pl, `${pk ? `${pk.name} killed you` : `A ${killer?.mob?.toLowerCase() || "monster"} killed you`} in the Wilderness.${nm ? ` You dropped your ${nm}.` : " You kept everything this time."}`, "bad");
      for (const p of this.pls.values()) if (p !== pl && p !== pk && G.sceneDef(p.C.scene)?.pvp) this.say(p, `☠️ ${pl.name} was killed by ${pk ? pk.name : `a ${killer?.mob?.toLowerCase() || "monster"}`}.`);
    }
    if (C.ward && !S?.def.pvp) { C.ward = false; this.touch(pl); this.say(pl, "The Witch's brew takes the fall for you: no hospital bill this time.", "good"); }   /* (2026-09-27) the ward is spent by the death it saves you from */
    else if (G.fxOf(C).nobill > 0 && !S?.def.pvp) this.say(pl, "The Ferryman's Coin pays the hospital. No bill.", "good");   /* (2026-09-27) the Long Night's amulet */
    else { const bill = pl.god || S?.def.pvp ? 0 : G.deathBill(C, S?.key); if (bill > 0) { G.takeInv(C.inv, "tickets", bill); this.touch(pl); this.say(pl, `THE HOSPITAL BILL: ${G.fmtTix(bill)}. They patched you up and went through your pockets.`, "bad"); } }   /* v68: the only thing a death costs */
    this.say(pl, "Oh dear, you are dead! You wake up on the casino floor. Nobody looks surprised.", "bad");
    C.hp = G.maxHpOf(C);
    this.moveToScene(pl, G.START.scene, null, { x: G.START.x, y: G.START.y });
  }

  // one swing at another player, in the Wilderness
  pvpSwing(S, pl, a, now, faceIt) {
    const T = this.pls.get(a.id), C = pl.C;
    if (!T || T.C.scene !== S.key || !S.def.pvp) { pl.act = null; return; }
    { const why = G.noAmmoWhy(C); if (why) { pl.act = null; return this.say(pl, why, "bad"); } }
    { const reach = G.reachOfHeld(C); if (G.cheb(pl, T) > reach || (reach === 1 && G.cheb(pl, T) !== 1)) { const p = G.findPath(S.g, pl, T, reach); if (p && p.length) pl.path = p; else if (!p) pl.act = null; return; } }
    const cage = G.inCage(S.def, pl.x, pl.y);
    if (cage !== G.inCage(S.def, T.x, T.y)) { this.say(pl, "The cage bars are in the way."); pl.act = null; return; }
    a.x = T.x; a.y = T.y; faceIt();
    if (!a.started) { a.started = now; pl.lastSwing = Math.max(pl.lastSwing, now - 1800); }   /* the same max() as the mob opener above, and for the same reason */
    if (now - pl.lastSwing < 2400 - (pl.urge ? Math.round(2400 * G.swingShave(pl.urgeStep)) : 0)) return;   /* active clicking works here too, and both sides have it */
    pl.urgeStep = pl.urge ? Math.min((pl.urgeStep | 0) + 1, G.SWING_STACK.length - 1) : 0;
    pl.urge = false;
    pl.lastSwing = now; pl.swingAt = now; pl.combatAt = now; T.combatAt = now;
    const pel = G.launcherOf(C) ? G.ammoElOf(C) : null;   /* (2026-09-26) in PvP only Void's pierce and Sun's heal apply: no burns, slows or arcs between players */
    const TC = T.C, hit = Math.random() < G.hitChance(G.attackRollOf(C), G.defenceRollOf(TC) * (pel === "void" ? 1 - G.MAGIC.pierce : 1)), dmg = hit ? rint(1, G.maxHitOf(C) + G.ammoStrOf(C)) : 0;
    if (dmg && pel === "sun") C.hp = Math.min(G.maxHpOf(C), C.hp + Math.max(1, Math.round(dmg * G.MAGIC.sunHeal)));
    const shotK = G.launcherOf(C) ? G.ammoOf(C)?.k : null;
    this.spendAmmo(pl);
    if (!T.god) { TC.hp -= dmg; this.touch(T); }
    if (dmg) T.hurtAt = now;
    S.events.push({ type: "splat", who: `p:${T.id}`, n: dmg, kind: dmg ? "hit" : "miss", t: now, by: pl.id, ranged: G.launcherOf(C) ? true : undefined, ak: shotK || undefined });
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
      /* (v102, the owner: "i dont see yahsmeena online even though she is definitely online") EVERYBODY online is listed, open islands first. A closed island used to drop its owner off the list without a word, which read as "she isn't online". Now it says closed. */
      const list = [...this.pls.values()].filter((p) => p !== pl && !p.lingerUntil).map((p) => ({ id: p.id, name: p.name, open: !!p.C.isle.open })).sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
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
      const S2 = this.scene(key); S2.ownerName = name; if (copy) { S2.isleCopy = copy; this.decorLay(S2); }
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
      /* (v101) a bigger island has plots and pedestals where there was grass: any piece now standing on one goes back in the tray (still owned) */
      { const base = G.buildScene(newKey).g, was = (I.decor || []).length; I.decor = (I.decor || []).filter((d) => { const Q = DR.DECOR[d.k]; if (!Q || d.at !== "isle") return true; for (let y = d.y; y < d.y + Q.h; y++) for (let x = d.x; x < d.x + Q.w; x++) if (!G.walkableIn(base, x, y) || "ep".includes(base[y][x])) return false; return true; }); if (I.decor.length < was) this.say(pl, "Some of your decorations were in the way of the new land. They are back in your tray."); }
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
      const rain = G.charmOf(C, "rainmaker"), ms = Math.round(crop.ms * (1 - rain / 100));   /* (2026-09-26) Rainmaker: this plot grows faster, and remembers it */
      I.plots[i] = { k, at: Date.now(), ...(rain ? { ms } : {}) }; this.touch(pl);
      return this.say(pl, `You plant some ${G.ITEMS[k].name.toLowerCase()}. It'll be ready in ${Math.round(ms / 60000)} minutes, whether you're here or not.${rain ? " The rain is on it." : ""}`, "good");
    }
    if (m.op === "show") {
      const i = m.i | 0, st = C.inv[m.s | 0];
      if (!st || st.k === "tickets" || I.shelf[i] !== null || !within("pedestal", i)) return;
      st.n--; if (!st.n) C.inv.splice(C.inv.indexOf(st), 1);
      I.shelf[i] = st.k; this.touch(pl);
      return this.say(pl, `You put your ${G.ITEMS[st.k].name.toLowerCase()} on display.`, "good");
    }
  }
  /* YAHSMEENA'S DECOR SHOP (v101; the catalogue and the rules of placing are beside DECOR in the rules file, and decorFits() there is the
     whole of "may this go here": this only asks it, and adds the two things only a server knows, who is standing where and what
     you can afford). decorLay() rebuilds an owner scene's ground and objects from a fresh build plus the owner's pieces: an
     island has no other state in its objects (plots and pedestals live on the island record), so a rebuild loses nothing. */
  decorLay(S) {
    const I = this.isleOf(S); if (!S.owner || !DR.decorPlace(S.key) || !I) return;
    const b = DR.decorInto(S.key, G.buildScene(S.key), I); S.g = b.g; S.objs = b.objs; S.decorLaid = true;
  }
  decorTell(ownerId) {   // every loaded scene of this owner is re-laid, and everybody standing in one is told
    for (const S of this.scenes.values()) { if (S.owner !== ownerId) continue; this.decorLay(S); const msg = { type: "decor", decor: this.isleOf(S)?.decor || [] }; for (const p of this.playersIn(S)) p.out.push(msg); }
  }
  decorOp(S, pl, m) {
    const C = pl.C, I = C.isle, k = String(m.k || ""), P = DR.DECOR[k], op = String(m.op); I.owned ||= {}; I.decor ||= [];
    const mine = S.owner === pl.id && DR.decorPlace(S.key);
    if (op === "buy" || op === "sell") {
      if (!P) return; if (!mine || !S.npcs.some((n) => n.name === "Yahsmeena" && G.cheb(pl, n) <= 3)) return this.say(pl, "Yahsmeena does her selling on your own island, by the cottage.", "bad");
      if (op === "buy") {
        if (P.max && (I.owned[k] | 0) >= P.max) return this.say(pl, `One ${P.name.toLowerCase()} is plenty.`, "bad");
        if ((I.owned[k] | 0) >= 99) return;
        if (G.tixIn(C) < P.price) return this.say(pl, `That's ${G.fmtTix(P.price)}. You have ${G.fmtTix(G.tixIn(C))}.`, "bad");
        G.takeInv(C.inv, "tickets", P.price); I.owned[k] = (I.owned[k] | 0) + 1; this.touch(pl);
        return this.say(pl, `Yahsmeena wraps up a ${P.name.toLowerCase()}. Press Decorate to put it down${P.in === "home" ? ", inside your cottage" : ""}.`, "good");
      }
      if (DR.decorSpare(I, k) < 1) return this.say(pl, "Pick it up first: she only takes back what isn't standing somewhere.", "bad");
      const back = Math.floor(P.price * DR.DECOR_SELLBACK); I.owned[k]--; if (!I.owned[k]) delete I.owned[k]; this.tixTo(pl, back); this.touch(pl);
      return this.say(pl, `Yahsmeena takes the ${P.name.toLowerCase()} back: ${G.fmtTix(back)}.`, "good");
    }
    if (!mine) return this.say(pl, "You can only decorate your own island.", "bad");
    if (op === "place") {
      const x = m.x | 0, y = m.y | 0, why = DR.decorFits(S.key, I, k, x, y); if (why) return this.say(pl, why, "bad");
      if (!P.flat) { const hit = (e) => e.x >= x && e.x < x + P.w && e.y >= y && e.y < y + P.h; if (this.playersIn(S).some(hit) || S.npcs.some(hit)) return this.say(pl, "Somebody's standing there.", "bad"); }
      I.decor.push({ k, x, y, at: DR.decorAt(S.key) }); this.touch(pl); this.decorTell(pl.id); return;
    }
    if (op === "take") {
      const x = m.x | 0, y = m.y | 0, at = DR.decorAt(S.key);
      let i = -1; I.decor.forEach((d, n) => { const Q = DR.DECOR[d.k]; if (Q && d.at === at && x >= d.x && x < d.x + Q.w && y >= d.y && y < d.y + Q.h && (i < 0 || !Q.flat)) i = n; });   // what stands on a tile before what lies on it
      if (i < 0) return;
      if (I.decor[i].k === "hatchery" && C.hatch) return this.say(pl, "There's an egg in the hatchery. Let it hatch first.", "bad");   /* (2026-09-27) */
      I.decor.splice(i, 1); this.touch(pl); this.decorTell(pl.id); return;
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
    const crop = G.CROPS[p.k], yk = G.cropYield(p.k), left = p.at + (p.ms || crop.ms) - now, nm = G.ITEMS[yk].name.toLowerCase();   /* (2026-09-26) a seed grows its bloom */
    if (!mine) return this.say(pl, `${whose} ${nm} ${left > 0 ? "is growing" : "looks ready to pick"}.`);
    if (left > 0) return this.say(pl, `Your ${nm} will be ready in ${left > 90000 ? `about ${Math.round(left / 60000)} minutes` : `${Math.ceil(left / 1000)} seconds`}.`);
    const n = Math.max(1, Math.round(rint(crop.yield[0], crop.yield[1]) * (1 + G.petFx(pl.C).grow / 100)));   /* (2026-09-27) the Truffle Pig */
    if (!this.give(pl, yk, n)) return;
    /* (2026-09-27) a seed crop gives its seed back (G.SEED_RETURN, now always) and a second one G.SEED_EXTRA of the time: see the rules */
    /* (2026-09-27) G.SEED_BACK every time (two), one more G.SEED_EXTRA of the time (three) */
    const want = crop.yields ? (Math.random() < G.SEED_RETURN ? G.SEED_BACK : 0) + (Math.random() < G.SEED_EXTRA ? 1 : 0) : 0;
    const back = want ? this.giveUpTo(pl, p.k, want) : 0;
    if (p.k !== "goldtomatoe" && Math.random() < G.GOLD_TOMATO_HARVEST && this.keepRare(pl, "goldtomatoe", 1)) { this.say(pl, "One of them is heavy, and warm, and gold. A Golden tomatoe: plant it.", "loot"); for (const q of this.pls.values()) if (q !== pl) q.out.push({ type: "casinonote", text: `\u{1F345} ${pl.name} pulled a Golden tomatoe out of a plot.` }); }   /* (2026-09-27) see G.GOLD_TOMATO_HARVEST */
    I.plots[ob.i] = null; this.touch(pl);
    this.gained(S, pl, yk, n); this.grant(pl, "farming", crop.xp);
    this.say(pl, `You harvest ${n} ${nm}${back > 1 ? `, and ${back === 2 ? "two" : back === 3 ? "three" : back} seeds come up with them` : back ? ", and a seed comes up with them" : ""}.`, "good");
  }

  // First hit claims a monster (outside the Wilderness, where anything goes): the claim is renewed by every swing and
  // lapses after CLAIM_MS without one, or when the claimer leaves the area. Nobody else can attack it meanwhile.
  claimOf(S, m, now) {
    const c = m.claim; if (!c || S.def.pvp || now > c.until) return null;
    const p = this.pls.get(c.id); return p && p.C.scene === S.key && !p.dead ? p : null;
  }
  mayFight(S, m, pl, now) { if (S.def.shared || G.MOBS[m.t]?.open) return true;   /* (2026-09-27) an open boss (the Pumpkin King) belongs to nobody */ const c = this.claimOf(S, m, now); return !c || c === pl; }   /* (shared: the crypt, where a party hits the same monster) */
  mobsTick(S, now) {
    const players = this.playersIn(S);
    for (const m of S.mobs) {
      /* (2026-09-26) FIRE'S BURN lands here, on its own clock, credited to whoever lit it - if they are still in the scene */
      if (m.dot && !m.dead && now >= m.dot.at) { const d = m.dot, by = this.pls.get(d.by); m.dot = null;
        if (by && by.C.scene === S.key) { m.hp -= d.dmg; m.hurtAt = now; S.events.push({ type: "splat", who: m.id, n: d.dmg, kind: "hit", t: now, burn: true }); this.award(by, d.dmg); if (G.MOBS[m.t]?.open) (m.by ||= {})[by.id] = (m.by[by.id] || 0) + d.dmg; if (m.hp <= 0) { const keep = by.act; this.killMob(S, by, m, now); if (keep && keep.id !== m.id) by.act = keep; } } }
      if (m.dead) {
        if (S.def.crypt || S.def.pyramid || now < m.respawnAt) continue;   /* (nothing comes back in a crypt or pyramid run) */   /* (2026-09-24) the pyramid relied on pyramidKill setting respawnAt to Infinity; saying it here too means a monster killed some other way cannot quietly come back and re-lock a cleared chamber */
        // back at home, or the nearest free tile to it: never on top of someone
        let spot = m.perch && !this.occupied(S, m.hx, m.hy, m) ? { x: m.hx, y: m.hy } : null;   /* (2026-09-27) a perched one comes back on its perch */
        for (let r = 0; r <= 2 && !spot; r++) for (let dy = -r; dy <= r && !spot; dy++) for (let dx = -r; dx <= r && !spot; dx++) {
          const x = m.hx + dx, y = m.hy + dy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && G.walkableIn(S.g, x, y) && S.g[y][x] !== "e" && !this.occupied(S, x, y, m)) spot = { x, y };
        }
        if (!spot) { m.respawnAt = now + 1000; continue; }
        Object.assign(m, { dead: false, hp: G.MOBS[m.t].hp, x: spot.x, y: spot.y, path: [], step: null, claim: null, target: null, graceFor: null });   /* a new life, so the walk-up grace is owed again */
        continue;
      }
      const def = G.MOBS[m.t];
      const R = G.MOBS[m.t]?.range || 1, inRange = (p) => { const d = G.cheb(p, m); return d >= 1 && d <= R; };   /* (2026-09-27) a ranged monster */
      let foe = players.find((p) => p.act?.kind === "mob" && p.act.id === m.id && inRange(p) && !p.step);
      if (def.boss && S.def.crypt) { this.cryptBossTick(S, m, now, players); const tt = this.cryptThreat(S, m, players, now); if (tt) { m.target = tt.id; foe = G.cheb(tt, m) === 1 && !tt.step ? tt : null; } }
      /* (2026-09-24) the Squeeze's own turn: coil and burrow, and it goes for whoever has hurt it most, the
         same as the Hoodie does. While it is under the sand pyramidBossTick suppresses its swing itself. */
      if (def.boss && S.def.pyramid) { this.pyramidBossTick(S, m, now, players); const tt = this.pyramidThreat(S, m, players, now); if (tt) { m.target = tt.id; foe = G.cheb(tt, m) === 1 && !tt.step ? tt : null; } }   /* the boss goes for whoever has hurt him most */
      const aggro = m.aggro ?? def.aggro;   /* the placement wins over the type */
      if (!foe && aggro) {
        /* (2026-09-24, reported by the owner: "when i cleared the first room, the mobs from the 2nd room all
           flooded in. they should stay in their room") A MONSTER IN A PYRAMID CHAMBER NEVER LEAVES IT. The leash
           here is distance from HOME (aggro + 5) with no notion of rooms, and the pyramid's chambers are stacked
           with a door on the centre line - so a Scarab Swarm homed one tile from the gate could see straight
           through it the moment it opened and follow you down. Comparing chambers instead of distance is what
           makes a cleared room stay cleared. */
        const ok = (p) => p.C.scene === S.key && !(G.fxOf(p.C).calm > 0) && !G.inCage(S.def, p.x, p.y)   /* (2026-09-27) the Pumpkin King's Crown: nothing attacks its wearer first */ && G.cheb(p, { x: m.hx, y: m.hy }) <= aggro + 5
          && (!S.def.pyramid || PR.roomOf(p.x, p.y) === PR.roomOf(m.hx, m.hy));
        const owner = this.claimOf(S, m, now);
        let tgt = owner || (m.target ? players.find((p) => p.id === m.target) : null);
        if (!tgt || !ok(tgt)) { tgt = players.filter((p) => ok(p) && G.cheb(p, m) <= aggro).sort((a, b) => G.cheb(a, m) - G.cheb(b, m))[0] || null; m.target = tgt ? tgt.id : null; }
        if (tgt) {
          if (inRange(tgt) && !tgt.step) foe = tgt;
          else if (m.perch) continue;   /* (2026-09-27) it does not leave its perch to chase */
          else { if (!m.step && now > (m.nextChase || 0)) { m.nextChase = now + 500; m.path = G.findPath(S.g, m, tgt, 1) || []; } this.stepEntity(S, m, now, false); continue; }
        } else if (G.cheb(m, { x: m.hx, y: m.hy }) > 4 && !m.step && !m.path.length) m.path = G.findPath(S.g, m, { x: m.hx, y: m.hy }, 0)?.slice(0, 6) || [];
      }
      if (foe) {
        m.face = foe.x > m.x ? 1 : -1;
        if (now - m.lastSwing >= G.MOBS[m.t].speed * (m.slowUntil > now ? G.MAGIC.slow.mult : 1)) {   /* (2026-09-26) Frost slows the swing */
          m.lastSwing = now; m.swingAt = now;
          const C = foe.C, hit = Math.random() < G.hitChance(G.MOBS[m.t].att, G.defenceRollOf(C)), dmg = hit ? Math.max(1, Math.round(rint(1, G.MOBS[m.t].max) * (m.enraged ? (G.MOBS[m.t].enrage?.mul ?? CR.CRYPT.enrageMul) : 1) * (1 - G.fxOf(C).tough))) : 0;   /* (tough: the visor, the Safety Net; whiskey makes it worse) */
          if (!foe.god) { C.hp -= dmg; this.touch(foe); }
          if (dmg) foe.hurtAt = now;
          foe.combatAt = now;
          if (!S.def.pvp && !S.def.shared && !G.MOBS[m.t]?.open && this.mayFight(S, m, foe, now)) m.claim = { id: foe.id, until: now + CLAIM_MS };
          S.events.push({ type: "splat", who: `p:${foe.id}`, n: dmg, kind: dmg ? "hit" : "miss", t: now });
          /* AUTO-RETALIATE, AND NOT FOR SOMEBODY WHO IS NOT THERE (2026-09-24, the owner: "can you make sure
             users arent afking vs aggressive mobs? if theyre high enough i think they can just stand there and
             allow mobs to come to them and kill them without worrying about dying"). He was right and this line
             is why: a mob that hits a player with no action gives them one, so a high-level player standing in
             an aggressive area farmed kills forever with ZERO input — walk up, hit, get handed the fight, win
             it, the act clears on the kill, the next one walks up. The three-minute cutoff in doAction stops a
             fight already running; this stops a new one being started for somebody who has not touched the game
             since. Together they mean an idle player simply gets hit, which is the point of a dangerous place. */
          if (!foe.act && !foe.path.length && !foe.lingerUntil && now - foe.lastInput <= G.AFK_MS) foe.act = { kind: "mob", id: m.id, x: m.x, y: m.y, name: def.name, started: 0 };
          if (C.hp <= 0) this.die(foe, S, { mob: def.name });
        }
        continue;
      }
      if (!this.stepEntity(S, m, now, false) && now > m.nextWander && !m.perch) {
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
      if (b.working && BOT_GAMES.has(b.working.ob.t) && now > (b.nextBet || 0)) {
        const first = !b.nextBet || now - b.nextBet > 20000; b.nextBet = now + 4000 + Math.random() * 5000;
        if (!first) { const stake = pick(BOT_STAKES), won = Math.random() < 0.4; S.events.push({ type: "botbet", id: b.id, n: won ? stake * pick(BOT_WINS) : -stake }); }   // the first beat at a table is sitting down, not a result
      }
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
  /* (v111) WHO THE NPCs ARE, sent with the roster. A snapshot says only an NPC's id, x and y: the page looked the rest up in its
     OWN copy of the scene, by POSITION IN THE LIST. So the moment this server's rules and a player's page disagree about a scene's
     npcs — the minutes between a page going live and this being deployed, an old tab, a lazily-loaded map — every NPC in that
     scene drew with no name and no picture. Now their names come from here, and nothing has to line up. */
  npcsOf(S) { return (S.npcs || []).map((n) => ({ id: n.id, name: n.name, art: n.art, tag: n.tag, look: n.look, reach: n.reach, opens: n.opens, shop: n.shop })); }
  whoOf(S) {
    const out = [];
    for (const p of this.playersIn(S)) out.push({ id: p.id, name: p.name, nfx: G.nameFxOf(p.C) || undefined, role: p.role !== "user" ? p.role : undefined, vip: G.vipOf(p.C).i || undefined, lvl: G.totalOf(p.C), weapon: p.C.eq.weapon, body: p.C.eq.body, maxHp: G.maxHpOf(p.C), look: p.C.look || undefined, van: G.wearsVanity(p.C.van) ? { on: p.C.van.on, col: p.C.van.col } : undefined, pet: G.activePet(p.C)?.k || undefined, pgr: G.activePet(p.C)?.tier ? 1 : undefined,   /* (2026-09-27) a Greater pet glows */ cos: p.cos || undefined });
    for (const b of S.bots) out.push({ id: b.id, name: b.name, level: b.level, art: b.art, hue: b.hue });
    return out;
  }
  /* (v107) ANYBODY'S PROFILE: their name, the person they made, their levels and the few numbers the hiscores already publish.
     Asked for by NAME (a line in chat, a row on a board) or by ID (a click on them in the world), and answered whether they are
     online or not: online, straight off the player; otherwise the saved character, the way the admin lookup does it. Nothing
     private is in here — no tickets held, no bank, no ZCoins, no inventory, no position — because anyone may ask about anyone. */
  /* biggest first, and only as many as a panel can show */
  static profTop(map, n) { return Object.entries(map || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n); }
  async profileOp(pl, m) {
    const top = (map, n) => World.profTop(map, n), sl2 = (k) => !!G.ITEMS[k];
    const want = String(m.name || m.id || "").trim(); if (!want || want.length > 40) return;
    let p = m.id ? this.pls.get(want) : null;
    if (!p) { const low = want.toLowerCase(); p = [...this.pls.values()].find((q) => q.name.toLowerCase() === low || String(q.login).toLowerCase() === low) || null; }
    let C = p?.C, name = p?.name;
    if (!C) {
      const w = await this.ctx.storage.get(`who:${want.toLowerCase()}`);
      if (!w) return pl.out.push({ type: "profile", miss: want });
      name = w.name; C = G.normChar(await this.ctx.storage.get(`char:${w.id}`));
    }
    if (p) this.accrue(p);
    const st = C.stats || {}, skills = {}; for (const k of Object.keys(G.SKILLS)) if (!G.SKILLS[k].held) skills[k] = { lvl: G.lvlOf(C, k), xp: Math.round(Number(C.xp[k]) || 0) };
    pl.out.push({ type: "profile", name, online: !!p, nfx: G.nameFxOf(C) || null, look: C.look || null, van: G.wearsVanity(C.van) ? { on: C.van.on, col: C.van.col } : null, cos: p?.cos || null, vip: G.vipOf(C).i || 0,
      combat: G.combatOf(C), total: G.totalOf(C), skills,
      kills: Object.values(st.kills || {}).reduce((n, v) => n + v, 0), quests: G.questsDone(C), crypt: st.crypt | 0, deaths: st.deaths | 0,
      earned: Math.round(Number(C.earned) || 0), mins: Math.round((st.playMs || 0) / 60000), since: st.firstSeen || Number(C.created) || 0,
      /* (2026-09-25, the owner: "add a stat for 'Current Tickets' to users profile popups") THIS IS A BALANCE,
         and the note below says this message deliberately carried none - a profile could be read but not cased.
         The owner asked for it anyway, so it is here and the reason it was avoided is written down rather than
         deleted: dying drops a SHARE of what you are carrying (G.DEATH), the Wilderness is PvP, and a public
         ticket count tells anyone hunting there exactly who is worth killing. If that turns out to bite, this
         one line is the whole of it. */
      tix: G.cashIn(C),
      /* (2026-09-23, the owner) THREE MORE TABS' WORTH. All of it is already public in some form — a paper doll
         shows what you can see them wearing anyway, and the totals are their own counters. Nothing here exposes a
         balance, a bag or anything they could be robbed over. `top` trims the long maps to what a panel can show,
         because `gathered` alone can run to fifty item keys and this message is sent per profile opened. */
      eq: Object.fromEntries(G.SLOTS.map((sl) => [sl, C.eq[sl] || null]).filter(([, k]) => k && sl2(k))),
      /* only what they are WEARING. The doll reads no other key, and the whole map would quietly tell you what is
         sitting reforged in their bank, which is nobody's business and is not on screen anyway. */
      /* (2026-09-23) built from eqf, the worn levels, now that a reforge belongs to the piece rather than the
         character. Still keyed by item name because that is what the profile's paper doll draws against. */
      forge: Object.fromEntries(G.SLOTS.map((sl) => [sl, C.eq[sl]]).filter(([sl, k]) => k && G.fLevelOf(C, sl) > 0).map(([sl, k]) => [k, G.fLevelOf(C, sl)])),
      bonus: G.bonusOf(C),
      ach: { n: (Array.isArray(C.ach) ? C.ach.length : 0), pts: G.achPts(C) },
      casino: { staked: Math.round(Number(C.wagered) || 0), plays: st.casPlays | 0, net: st.casNet | 0, best: st.casBest | 0, worst: st.casWorst | 0, byGame: top(st.played, 8) },
      totals: { xp: Math.round(st.xpTotal || 0), kills: top(st.kills, 6), gathered: top(st.gathered, 8), cooked: top(st.cooked, 5), crafted: top(st.crafted, 5),
        looted: Object.values(st.looted || {}).reduce((n, v) => n + v, 0), burnt: st.burnt | 0, pvpKills: st.pvpKills | 0, pvpDeaths: st.pvpDeaths | 0, sessions: st.sessions | 0 } });
  }
  // cheap enough to build every broadcast; it only ever SENDS when it differs
  whoSigOf(who) { let sig = ""; for (const w of who) sig += `${w.id}|${w.name}|${w.vip || 0}|${w.lvl ?? w.level}|${w.weapon || ""}|${w.body || ""}|${w.maxHp || ""}|${w.art || ""}|${w.hue || ""}|${w.look ? w.look.join(".") : ""}|${G.vanityKey(w.van)}|${w.pet || ""}|${w.cos ? `${w.cos.name}/${w.cos.title}` : ""}|${G.nameFxSig(w.nfx)};`; return sig; }

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
      mobs: S.mobs.map((m) => trim({ id: m.id, t: m.t, x: m.x, y: m.y, s: st(m), face: m.face, hp: m.hp, mx: m.maxHp && m.maxHp !== G.MOBS[m.t].hp ? m.maxHp : undefined, dead: m.dead, hurtAt: m.hurtAt, swingAt: m.swingAt, c: this.claimOf(S, m, now)?.id })),
      npcs: S.npcs.map((n) => trim({ id: n.id, x: n.x, y: n.y, s: st(n), face: n.face, held: n.holdUntil > now })),
      bots: S.bots.map((b) => trim({ id: b.id, x: b.x, y: b.y, s: st(b), dir: b.dir, face: b.face, work: b.working ? b.working.ob.id : null, workT: b.working ? b.working.ob.t : null })),
      ground: S.ground.map((x) => ({ id: x.id, k: x.k, n: x.n, x: x.x, y: x.y, owner: x.owner, until: x.until })),
      isle: S.owner ? (() => { const I = this.isleOf(S); return I && { owner: S.owner, name: S.ownerName || this.pls.get(S.owner)?.name || "Someone", plots: I.plots, beds: I.beds || null, bedsOpen: G.bedsOf(I), shelf: I.shelf, theme: I.theme, open: I.open, pen: (() => { const P = this.pls.get(S.owner)?.C.pen; return P?.a && P?.b ? { a: P.a.k, b: P.b.k, ag: P.a.tier ? 1 : 0, bg: P.b.tier ? 1 : 0 } : null; })() }   /* (2026-09-27) the two parents, so everyone on the island sees them in the pen */; })() : null,
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
      if (sig !== S.whoSig) { S.whoSig = sig; rosters.set(key, JSON.stringify({ type: "who", scene: key, who, npcs: this.npcsOf(S) })); }
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
  /* (2026-09-23) A REFORGED PIECE BANKS ON ITS OWN LINE, same rule as the bag: +2 and +3 are different objects
     and a single {k, n} could not say which of the four in the pile was which. It therefore costs one of the
     bank's BANK_MAX lines, and a bank full of reforged gear fills up faster than one full of logs. */
  /* (2026-09-27) `p` is the bank page a NEW row is filed on; a plain stack the bank already holds grows where it is, whatever page that is (as in OSRS) */
  bankAdd(pl, k, n, f = 0, p = 0) {
    const C = pl.C, s = !f && C.bank.find((x) => x.k === k && !G.fOf(x)); p = Math.max(0, Math.min(G.BANK_PAGES - 1, p | 0));
    if (s) { s.n += n; return true; }
    if (C.bank.length >= G.BANK_MAX) { this.say(pl, `Your bank is full (${G.BANK_MAX} different items).`, "bad"); return false; }
    if (f) { for (let i = 0; i < n; i++) { if (C.bank.length >= G.BANK_MAX) return i > 0; C.bank.push({ k, n: 1, f, ...(p ? { p } : {}) }); } return true; }
    C.bank.push({ k, n, ...(p ? { p } : {}) }); return true;
  }
  bankOp(S, pl, m) {
    if (!this.near(S, pl, "booth")) return this.say(pl, "You need to be at a bank booth.", "bad");
    const C = pl.C, qty = (want, have) => Math.max(1, Math.min(have, want === "all" ? have : Math.floor(Number(want)) || 1)), page = Math.max(0, Math.min(G.BANK_PAGES - 1, m.p | 0));   /* (2026-09-27) the page the window is showing: new rows go there */
    /* TICKETS STAY ON YOU (the owner, 2026-09-19: "cant drop or get rid of their tickets... or bank them or anything like that").
       They are the one currency and they turn into ZCoins at the tables, so they only ever leave your bag by being SPENT:
       no drop (see "drop"), no bank, no gift in a trade. normChar moves any that were banked before this back to the bag. */
    if (m.op === "dep" && C.inv[m.i | 0]?.k === "tickets") return this.say(pl, "Tickets stay on you. The bank won't take them.");
    if (m.op === "dep") { const st = C.inv[m.i | 0]; if (!st) return;
      /* A reforged piece is banked as ITSELF: by index, one item, keeping its level. "Deposit all" of a plain
         stack still sweeps every plain one, and takeInv leaves the forged ones alone by design. */
      if (G.fOf(st)) { const f = G.fOf(st); if (!this.bankAdd(pl, st.k, 1, f, page)) return; G.takeAt(C.inv, m.i | 0); }
      else { const k = st.k, q = qty(m.n, G.countItems(C, [k], { plainOnly: true })); if (!this.bankAdd(pl, k, q, 0, page)) return; G.takeInv(C.inv, k, q); } }
    else if (m.op === "depinv") { for (const st of [...C.inv]) { if (st.k === "tickets" || G.isFav(C, st.k)) continue; if (!this.bankAdd(pl, st.k, st.n, G.fOf(st), page)) break; C.inv.splice(C.inv.indexOf(st), 1); } }
    /* (2026-09-25) STACK ALL: every plain stack in the bag whose item the bank already holds goes in, all of it. A reforged
       piece is never swept (it is banked as itself, one at a time, by index), and neither are tickets. */
    else if (m.op === "stackall") { const have = new Set(C.bank.filter((b) => !G.fOf(b)).map((b) => b.k));
      for (const k of [...new Set(C.inv.filter((s) => !G.fOf(s) && s.k !== "tickets" && have.has(s.k) && !G.isFav(C, s.k)).map((s) => s.k))]) {
        const q = G.countItems(C, [k], { plainOnly: true }); if (q && this.bankAdd(pl, k, q, 0, page)) G.takeInv(C.inv, k, q); } }
    else if (m.op === "depeq") { for (const sl of G.SLOTS) { const k = C.eq[sl]; if (k && this.bankAdd(pl, k, 1, G.fLevelOf(C, sl), page)) { C.eq[sl] = null; if (C.eqf) delete C.eqf[sl]; } } }
    /* (2026-09-27) REFILE: a row moves to another page, by its true index; nothing else about it changes */
    else if (m.op === "page") { const st = C.bank[m.i | 0]; if (!st) return; if (page) st.p = page; else delete st.p; }
    /* (2026-09-27) REORDER: a row dropped on another takes its place (the two swap) and its page, so a drop across pages is a refile too */
    else if (m.op === "swap") { const i = m.i | 0, j = m.j | 0; if (i === j || !C.bank[i] || !C.bank[j]) return; const pj = C.bank[j].p | 0; const t = C.bank[i]; C.bank[i] = C.bank[j]; C.bank[j] = t; if (pj) t.p = pj; else delete t.p; }
    else if (m.op === "wd") { const st = C.bank[m.i | 0]; if (!st) return;
      if (G.fOf(st)) { if (!this.give(pl, st.k, 1, G.fOf(st))) return; C.bank.splice(m.i | 0, 1); this.touch(pl); return pl.out.push({ type: "bank" }); }
      const q = this.giveUpTo(pl, st.k, qty(m.n, st.n)); if (!q) return; st.n -= q; if (!st.n) C.bank.splice(C.bank.indexOf(st), 1); }
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
    /* (2026-09-23) `f` IS PART OF WHAT IS FOR SALE and has to be in the projection. The order carried it, the
       market matched on it, the buyer received it — and this hand-written subset dropped it, so every listing
       reached the page as a plain one and drew "Diamond axe" with no band. Sixth time a field has been added to
       a record and forgotten in the shape that leaves the server: if you add one to an order, add it HERE. */
    const view = (o) => ({ id: o.id, k: o.k, f: o.f | 0, left: o.qty - o.done, price: o.price, name: o.name, at: o.at, mine: o.owner === pl.id });
    const listings = open.filter((o) => o.side === "sell").sort((x, y) => y.at - x.at).slice(0, 80).map(view);
    const wanted = open.filter((o) => o.side === "buy").sort((x, y) => y.at - x.at).slice(0, 80).map(view);
    const mine = this.exMine(pl).sort((x, y) => y.at - x.at).map((o) => ({ id: o.id, side: o.side, k: o.k, f: o.f | 0, qty: o.qty, done: o.done, price: o.price, open: o.open, at: o.at, closedAt: o.closedAt || 0 }));
    const pets = (this.ex.pets || []).slice().sort((x, y) => y.at - x.at).map((l) => ({ id: l.id, pet: l.pet, price: l.price, name: l.name, at: l.at, mine: l.owner === pl.id }));   /* (2026-09-27) pet listings */
    this.send(pl, { type: "exch", listings, wanted, mine, pets, book: G.exSummary(this.ex.orders), last: this.ex.last });
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
      if (o.box.items && this.bankAdd(pl, o.k, o.box.items, o.f | 0)) { o.box.items = 0; moved = true; }   /* (2026-09-23) the level comes with it: an order is for ONE level, so o.f describes every item in its box */
      if (o.box.cash && this.bankAdd(pl, "tickets", o.box.cash)) { o.box.cash = 0; moved = true; }
      if (!o.open && !o.closedAt) o.closedAt = Date.now();
    }
    // closed offers stay on the owner's list for three days (so "recent" means something), then go
    const now = Date.now();
    this.ex.orders = this.ex.orders.filter((o) => o.open || o.box.items || o.box.cash || (o.qty > 0 && now - (o.closedAt || now) < 3 * 86400000));
    const owed = this.ex.petOwed?.[pl.id];   /* (2026-09-27) a pet that sold while its owner was away */
    if (owed && this.bankAdd(pl, "tickets", owed)) { delete this.ex.petOwed[pl.id]; moved = true; }
    const news = this.ex.news?.[pl.id];
    if (news?.length) { pl.out.push({ type: "exnote", text: `While you were away: ${news.join(" · ")}. It's in your bank.` }); delete this.ex.news[pl.id]; moved = true; }
    if (moved) this.touch(pl);
    return moved;
  }
  exOp(S, pl, m) {
    const C = pl.C, now = Date.now();
    if (m.op === "open") return this.exSend(pl);
    if (!this.near(S, pl, "stall")) return this.say(pl, "You need to be at Livia's Exchange stall, in the Yard by the jukebox.", "bad");
    // tickets for an offer comes from your bag first, then your bank
    const payCash = (n) => { const bag = Math.min(n, G.cashIn(C)); if (bag) G.takeInv(C.inv, "tickets", bag); let left = n - bag; if (left) { const b = C.bank.find((x) => x.k === "tickets"); b.n -= left; if (!b.n) C.bank.splice(C.bank.indexOf(b), 1); } };
    const cashAll = () => G.cashIn(C) + (C.bank.find((x) => x.k === "tickets")?.n || 0);
    // items for a sell offer come from your bag first, then your bank
    /* (2026-09-23) BY LEVEL, bag and bank. A forged piece is listed as itself: counting or taking "diamond axes"
       without saying which level would let somebody list a +3 and hand over a plain one. */
    const matches = (x, k, f) => x.k === k && G.fOf(x) === (f | 0);
    const haveAll = (k, f = 0) => C.inv.filter((x) => matches(x, k, f)).reduce((n, x) => n + x.n, 0) + C.bank.filter((x) => matches(x, k, f)).reduce((n, x) => n + x.n, 0);
    const takeItems = (k, n, f = 0) => {
      let left = n;
      if (!f) { left -= G.takeInv(C.inv, k, n); }
      else for (let i = C.inv.length - 1; i >= 0 && left > 0; i--) if (matches(C.inv[i], k, f)) { G.takeAt(C.inv, i); left -= 1; }
      for (let i = C.bank.length - 1; i >= 0 && left > 0; i--) { const b = C.bank[i]; if (!matches(b, k, f)) continue; const t = Math.min(left, b.n); b.n -= t; left -= t; if (!b.n) C.bank.splice(i, 1); }
    };
    const place = (side, k, qty, price, now_, f = 0) => {
      const o = { id: this.ex.next++, owner: pl.id, name: pl.name, side, k, f: f | 0, qty, done: 0, price, at: now, open: true, box: { items: 0, cash: 0 } };
      this.ex.orders.push(o);
      const touched = this.exMatch(o);
      // "buy now": whatever the listings couldn't fill isn't left behind as an offer
      if (now_ && o.done < o.qty) { o.box.cash += (o.qty - o.done) * o.price; o.qty = o.done; o.open = false; }
      for (const p of new Set([pl, ...touched])) { this.exDeliver(p); this.exSend(p); }
      this.touch(pl); this.exCommit(pl, ...touched.filter((p) => p !== pl));
      return o;
    };
    if (m.op === "place" || m.op === "buynow") {
      const side = m.op === "buynow" ? "buy" : m.side === "buy" ? "buy" : "sell", k = String(m.k), price = Math.floor(Number(m.price));
      /* (2026-09-23) A REFORGED PIECE IS SOLD ONE AT A TIME. Each one is its own object, so a quantity above one
         could not say which levels were in the pile. The level is clamped to something the item could actually
         have, so a hand-made message cannot list a "+9" and take a plain one off the shelf. */
      const f = G.canForge(k) ? Math.max(0, Math.min(G.FORGE.max, Math.floor(Number(m.f)) || 0)) : 0;
      let qty = Math.floor(Number(m.qty)); if (f) qty = 1;
      if (!G.ITEMS[k] || k === "tickets") return this.say(pl, "You can't trade that on the market.", "bad");
      if (!(qty >= 1 && qty <= 1e9 && price >= 1 && price <= 1e9)) return this.say(pl, "Pick a quantity and a price of at least 1.", "bad");
      if (m.op === "place" && this.exOpen(pl).length >= G.EX_SLOTS) return this.say(pl, `You can have ${G.EX_SLOTS} offers up at once. Cancel one first.`, "bad");
      if (side === "sell") {
        const have = haveAll(k, f); if (have < qty) return this.say(pl, `You only have ${have.toLocaleString()} ${G.forgeNameAt(k, f).toLowerCase()} (bag and bank).`, "bad");
        takeItems(k, qty, f);
      } else {
        const cost = qty * price; if (cashAll() < cost) return this.say(pl, `That needs ${G.fmtCash(cost)}. You have ${G.fmtCash(cashAll())} (bag and bank).`, "bad");
        payCash(cost);
      }
      const o = place(side, k, qty, price, m.op === "buynow", f);
      if (m.op === "buynow") return this.say(pl, o.done ? `You buy ${o.done.toLocaleString()} × ${G.ITEMS[k].name}. It's in your bank.` : "Somebody got there first: nothing left at that price.", o.done ? "good" : "bad");
      return this.say(pl, `Offer up: ${side === "sell" ? "selling" : "buying"} ${qty.toLocaleString()} × ${G.ITEMS[k].name} at ${G.fmtCash(price)} each.`, "good");
    }
    if (m.op === "petlist" || m.op === "petbuy" || m.op === "petcancel") return this.exPetOp(pl, m, payCash, cashAll);
    const o = this.ex.orders.find((x) => x.id === (m.id | 0) && x.owner === pl.id); if (!o) return;
    if (m.op === "cancel" && o.open) {
      o.open = false; o.closedAt = now;
      const left = o.qty - o.done;
      /* (v107) WHERE IT WENT, SAID OUT LOUD. A beta tester took an offer down to hand the item to a friend, looked in his bag, and
         thought the Exchange had eaten it: everything the Exchange returns goes to the BANK, and the only word of that was one grey
         line that fades in nine seconds. Taking your own offer down now puts what was left straight back in your BAG when there is
         room (you are standing there asking for it), the bank if there isn't, and the line names the thing and the place. If
         neither has room it stays in the offer's box, as before, and the line says that instead of claiming otherwise. */
      let where = "";
      if (o.side === "sell" && left > 0) { const q = this.giveUpTo(pl, o.k, left); if (q) where = `${q.toLocaleString()} × ${G.ITEMS[o.k].name} back in your BAG`; if (left - q > 0) o.box.items += left - q; }
      else if (o.side === "buy") o.box.cash += left * o.price;
      const owed = o.box.items, owedCash = o.box.cash;
      this.exDeliver(pl);
      const banked = [owed && !o.box.items ? `${owed.toLocaleString()} × ${G.ITEMS[o.k].name}` : "", owedCash && !o.box.cash ? G.fmtCash(owedCash) : ""].filter(Boolean).join(" and "), stuck = o.box.items || o.box.cash;
      this.say(pl, `Offer taken down. ${[where, banked ? `${banked} in your BANK (a bank booth in town, or the chest in the Yard)` : ""].filter(Boolean).join(", and ") || "Nothing was left on it"}.${stuck ? " Your bank is full, so the rest is being HELD by the Exchange: make room and open the Exchange again." : ""}`, stuck ? "bad" : "good");
      this.touch(pl); this.exCommit(pl); this.exSend(pl);
    }
  }
  /* (2026-09-27) PETS ON THE EXCHANGE: one pet a listing, a fixed price, bought outright (see PET_TRADE in the rules). A listed pet is
     held by the Exchange, not by its owner, so it cannot be worn, bred or traded twice while it is up. */
  exPetOp(pl, m, payCash, cashAll) {
    const C = pl.C, now = Date.now(), T = G.PET_TRADE, L = (this.ex.pets ||= []);
    const done = (...pls) => { for (const p of pls) { this.touch(p); this.exSend(p); } this.exCommit(...pls); };
    if (m.op === "petlist") {
      const pet = G.petById(C, String(m.id || "")), price = Math.floor(Number(m.price));
      if (!pet) return this.say(pl, "You don't have that pet.", "bad");
      if (!(price >= 1 && price <= 1e9)) return this.say(pl, "Pick a price of at least 1 ticket.", "bad");
      if (L.filter((l) => l.owner === pl.id).length >= T.exSlots) return this.say(pl, `You can have ${T.exSlots} pets up at once. Take one down first.`, "bad");
      C.pets = C.pets.filter((x) => x.id !== pet.id); if (C.eq.pet === pet.id) C.eq.pet = null;
      L.push({ id: this.ex.next++, owner: pl.id, name: pl.name, pet, price, at: now });
      done(pl);
      return this.say(pl, `${G.petLabel(pet)} is up for ${G.fmtCash(price)}.`, "good");
    }
    const l = L.find((x) => x.id === (m.lid | 0));
    if (!l) { this.exSend(pl); return this.say(pl, "That pet isn't for sale any more.", "bad"); }
    if (G.petsOf(C).length >= T.own) return this.say(pl, `You have ${T.own} pets, the most anyone can keep. Sell or let one go first.`, "bad");
    if (m.op === "petcancel") {
      if (l.owner !== pl.id) return;
      this.ex.pets = L.filter((x) => x !== l); C.pets.push(this.petFresh(C, l.pet));
      done(pl);
      return this.say(pl, `${G.petLabel(l.pet)} is back with you.`, "good");
    }
    if (l.owner === pl.id) return this.say(pl, "That's your own pet. Take it down instead.", "bad");
    if (cashAll() < l.price) return this.say(pl, `That needs ${G.fmtCash(l.price)}. You have ${G.fmtCash(cashAll())} (bag and bank).`, "bad");
    payCash(l.price);
    this.ex.pets = L.filter((x) => x !== l); C.pets.push(this.petFresh(C, l.pet));
    const tax = G.exTax(l.price), net = l.price - tax; this.ex.tax += tax;
    const seller = this.pls.get(l.owner), what = `sold ${G.petLabel(l.pet)} for ${G.fmtCash(net)}`;
    if (seller && this.bankAdd(seller, "tickets", net)) seller.out.push({ type: "exnote", text: `You ${what}. It's in your bank.` });
    else { (this.ex.petOwed ||= {})[l.owner] = ((this.ex.petOwed || {})[l.owner] || 0) + net; this.exNote(l.owner, what); }
    done(pl, ...(seller ? [seller] : []));
    return this.say(pl, `You buy ${G.petLabel(l.pet)} for ${G.fmtCash(l.price)}. It's in your Equipment tab.`, "good");
  }
  // fill a new offer against the other side: best price first, then whoever was there first, at the waiting offer's price
  exMatch(o) {
    const touched = new Set();
    /* (2026-09-23) THE LEVEL IS PART OF WHAT IS BEING TRADED. A plain Diamond axe and a +3 are different goods:
       matching them would sell somebody a reforge they did not buy, or take one they did not mean to sell. */
    const other = this.ex.orders.filter((x) => x.open && x !== o && x.k === o.k && (x.f | 0) === (o.f | 0) && x.side !== o.side && x.done < x.qty && x.owner !== o.owner && (o.side === "buy" ? x.price <= o.price : x.price >= o.price))
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
    if (p.k && G.roomFor(C.inv, p.k, C) < p.n) return this.say(pl, "Your bag's too full for a prize. Make some room and spin again: it's still free.", "bad");
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
  /* (2026-09-22) ONE PLACE THAT WRITES THE HOUR'S LOG, so the tables and the Fight Pit cannot count differently.
     `net` is what the play WON (negative when it lost), because TIX_HOUR caps your position across the hour and
     not your turnover. */
  recordPlay(pl, g, net) {
    const now = Date.now();
    pl.C.plays = G.recentPlays(pl.C.plays, now);
    pl.C.plays.push({ g, t: now, net: Math.round(net) });
    pl.C.plays = G.recentPlays(pl.C.plays, now);
    /* (2026-09-23) AND THE LIFETIME LINE, here rather than in each table, for the same reason the hour's log is
       here: one place, so no game can count differently. C.plays is a rolling window the limiter trims, so it
       could never answer "how have I done at the wheel, ever". */
    const st = (pl.C.stats ||= G.freshStats()), n = Math.round(net);
    st.played = st.played || {}; st.played[g] = (st.played[g] | 0) + 1;
    st.casPlays = (st.casPlays | 0) + 1;
    st.casNet = (st.casNet | 0) + n;
    if (n > (st.casBest | 0)) st.casBest = n;
    if (n < (st.casWorst | 0)) st.casWorst = n;
    this.emit(pl, "play", { g, net: n });   /* (2026-09-23) THE MISSING EVENT. The counters above were being kept and nothing told anybody, so every casino achievement sat unearned until the next login swept it up. */
  }
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
    /* (v107) TICKETS IN, TICKETS OUT. From v57 to v106 a ticket bet on this floor was staked on the SITE and paid real ZCoins, and this
       engine refused to play here. The owner, 2026-09-21: "users who bet zcoin get zcoin, if they use tickets they get tickets. the
       tickets are then cashable" (the Prize Counter, dexOp "cash"). So the floor's tables play for tickets again, from anywhere on the
       floor (the Games button opens them without walking up), and every play is priced in the band: G.EDGE_BAND. */
    if (!this.near(S, pl, g, 2) && !S.def.real?.[g]) return this.say(pl, `You need to be at the ${game.name.toLowerCase()} in the Casino.`, "bad");
    if (now - (pl.lastBet || 0) < G.CASINO.betMs) return;
    /* (2026-09-22) THE HOUR'S LIMITS. This floor plays the site's eight games for tickets and enforced none of the
       site's limits: ten plays an hour at each game, and a cap on how far up you may be across a rolling hour.
       Checked BEFORE the stake is taken, so a refused bet costs nothing. */
    pl.C.plays = G.recentPlays(pl.C.plays, now);
    const gate = G.tixBlock(pl.C.plays, g, now);
    if (gate && !pl.god) return this.say(pl, gate.why === "plays"
      ? `That's ${gate.cap} goes on the ${game.name.toLowerCase()} this hour. Try another table, or come back later.`
      : `You're up ${G.fmtTix(gate.n)} this hour, which is the house limit. Come back in a bit — you keep every ticket of it.`, "bad");
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
    const edge = G.edgeDraw(Math.random()), paid = G.paidMult(g, mult, res, edge); res.edge = Math.round(edge * 1000) / 1000; res.paid = Math.round(paid * 1000) / 1000;
    const plain = Math.round(amt * paid), boosted = G.payWith(plain, amt, e, lucky), own = amt - onHouse;
    const ret = Math.max(0, boosted - onHouse), saved = ret < own ? this.lossBack(pl, own - ret, e) : 0, payout = ret + saved + jackpot;   /* the house's chip goes back to the house; what it won is yours */
    res.lucky = boosted > plain ? boosted - plain : null; res.saved = saved || null; res.luck = pl.C.luck | 0;
    this.fameWin(pl, game.name, payout - own);
    if (payout > own) pl.lastWin = { amt: payout - own, at: now }; else if (payout < own) pl.lastLoss = { amt: own - payout, at: now };
    this.cashTo(pl, payout);
    /* recorded with what it WON, so the cap counts your position across the hour rather than your turnover: ten
       bets that broke even leave you free to keep going, which is the point of capping winnings and not volume. */
    this.recordPlay(pl, g, payout - own);
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
    /* (2026-09-22) THE HOUR'S LIMITS REACH THE PIT. It takes tickets like the tables and had only a per-FIGHT
       ceiling, so the house's hourly cap could be walked round by betting on fights instead of spinning a wheel.

       Checked on the FIRST stake of a fight only: topping up a bet you already have down is the same play, and
       counting each top-up would make "ten a hour" mean "ten button presses". The win cap sums every game, so a
       big night at the tables and a big night in the pit share one ceiling, which is the point of a house cap. */
    if (!staked) {
      pl.C.plays = G.recentPlays(pl.C.plays, now);
      const gate = G.tixBlock(pl.C.plays, "fightpit", now);
      if (gate && !pl.god) return this.say(pl, gate.why === "plays"
        ? `That's ${gate.cap} fights backed this hour. Watch a few, and come back.`
        : `You're up ${G.fmtTix(gate.n)} this hour, which is the house limit. Come back in a bit — you keep every ticket of it.`, "bad");
    }
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
      const p = this.pls.get(b.id); if (p) { this.cashTo(p, payout); this.recordPlay(p, "fightpit", payout - b.amt); p.lastWin = { amt: payout - b.amt, at: Date.now() }; this.fameWin(p, "the Fight Pit", payout - b.amt); this.touch(p); } else this.creditOffline(b.id, payout);
    }
    for (const b of F.bets) {   // the losers: insurance, and the odd angel
      if (b.side === w) continue; const p = this.pls.get(b.id), e = F.fx?.[b.id]; if (!e) continue;
      const back = p ? this.lossBack(p, b.amt, e) : G.backWith(b.amt, e, Math.random());
      if (p) { this.cashTo(p, back); this.recordPlay(p, "fightpit", back - b.amt); p.lastLoss = { amt: b.amt - back, at: Date.now() }; this.touch(p); } else if (back) this.creditOffline(b.id, back);
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
      : { stake: r.stake, mines: r.mines, open: r.open, mult: G.minesMult(r.mines, r.open.length, r.edge), next: G.minesMult(r.mines, r.open.length + 1, r.edge), top: G.minesTop(r.mines), lucky: r.lucky, cash: this.runCash(g, r) };
    return { type: "run", g, run, luck: pl.C.luck | 0 };
  }
  runCash(g, r) {
    const plain = g === "hilo" ? (r.rights ? G.hiloPays(r.stake, r.mult, r.edge) : 0) : (r.open.length ? Math.round(r.stake * G.minesMult(r.mines, r.open.length, r.edge)) : 0);   /* (r.edge: the run's draw; a run begun before v107 has none and keeps the old 0.97) */
    return G.payWith(plain, r.stake, r.fx, r.lucky);
  }
  runEnd(S, pl, g, how, extra = {}) {
    const r = pl.C.runs[g], saved = how === "bust" ? this.lossBack(pl, r.stake, r.fx) : 0, payout = how === "cash" ? this.runCash(g, r) : how === "refund" ? r.stake : saved;
    this.fameWin(pl, G.GAMES[g].name, payout - r.stake);
    if (payout > r.stake) pl.lastWin = { amt: payout - r.stake, at: Date.now() }; else if (payout < r.stake) pl.lastLoss = { amt: r.stake - payout, at: Date.now() };
    const mult = g === "hilo" ? Math.min(G.HILO.maxMult, r.mult) : G.minesMult(r.mines, r.open.length, r.edge);
    delete pl.C.runs[g]; this.cashTo(pl, payout);
    /* (2026-09-23) A RUN IS A PLAY. bet() records one and this did not, so Hi-Lo and Mines were invisible to the
       lifetime counters, to the profile's "where they play", and to every casino achievement — two of the eight
       tables simply did not count. Recorded at the END because that is where the net is known.
       NOTE: this does NOT put them under the hourly limiter. tixBlock is checked when a bet STARTS and the run
       start never checks it, which is a separate and still-open gap. */
    this.recordPlay(pl, g, payout - (r.stake | 0));
    this.touch(pl);
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
      if (!this.near(S, pl, g, 2) && !S.def.real?.[g]) return this.say(pl, `You need to be at the ${game.name} table in the Casino.`, "bad");   /* (v107: see bet()) */
      /* (2026-09-23, the owner) THE HOUR'S LIMITS, WHICH THESE TWO HAD ESCAPED. bet() has checked tixBlock since
         2026-09-22, but a run STARTS here and this never did — so Hi-Lo and Mines were the two uncapped tables on
         a floor whose whole point is that no table is a better bet than another. Checked before the stake is
         taken, so a refused run costs nothing, and worded exactly as bet() words it. */
      C.plays = G.recentPlays(C.plays, now);
      const gate = G.tixBlock(C.plays, g, now);
      if (gate && !pl.god) return this.say(pl, gate.why === "plays"
        ? `That's ${gate.cap} goes on the ${game.name.toLowerCase()} this hour. Try another table, or come back later.`
        : `You're up ${G.fmtTix(gate.n)} this hour, which is the house limit. Come back in a bit — you keep every ticket of it.`, "bad");
      const amt = Math.floor(Number(m.amt)), have = G.cashIn(C);
      if (!(amt >= G.minBetOf(S.def) && amt <= G.maxBetOf(C, S.def))) return this.say(pl, `Bets here are ${G.fmtCash(G.minBetOf(S.def))} to ${G.fmtCash(G.maxBetOf(C, S.def))}.`, "bad");
      if (have < amt) return this.say(pl, `You only have ${G.fmtCash(have)} in your bag.`, "bad");
      if (this.tooEmpty(pl)) return;
      G.takeInv(C.inv, "tickets", amt); this.tourStep(pl, "play"); this.bigBet(pl, 0, amt, S.def); const fx = this.fxTake(pl);
      const lucky = (C.luck | 0) > 0; if (lucky) C.luck--;
      const edge = G.edgeDraw(Math.random());   /* ONE draw for the whole run */
      if (g === "hilo") C.runs[g] = { stake: amt, edge, lucky, fx, card: 1 + Math.floor(Math.random() * 13), suit: Math.floor(Math.random() * 4), mult: 1, cards: 1, rights: 0 };
      else {
        const mines = Math.max(G.MINES.min, Math.min(G.MINES.max, Math.floor(Number(m.mines)) || 3)), all = Array.from({ length: G.MINES.tiles }, (_, i) => i);
        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
        C.runs[g] = { stake: amt, edge, lucky, fx, mines, bombs: all.slice(0, mines).sort((a, b) => a - b), open: [] };
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
    if (m.op === "played") { if (FLOORS.has(String(S.key).split(":")[0])) this.tourStep(pl, "play"); return; }   /* (v96) a play at one of the site's tables, on the window's word: see TOUR in the rules file */
    const C = pl.C, dex = S.npcs.find((n) => n.name === "Dex the Dealer");
    if (!dex || G.cheb(pl, dex) > 4) return this.say(pl, "Dex is behind the bar in the casino.", "bad");
    if (m.op === "start" && (!C.tour || C.tour.step >= G.TOUR.length)) { C.tour = { step: 0, fish: 0, chickens: 0, again: !!C.tour };   /* `logs` until 2026-09-22: freshChar was fixed but this restart path still seeded the dead name */ this.touch(pl); }
    const step = G.tourOf(C)?.id;
    if (step === "meet") { if (!C.tour.again) this.cashTo(pl, G.TOUR_CHIP); this.tourStep(pl, "meet"); }
    else if (step === "paid") { if (!C.tour.again) { this.cashTo(pl, G.TOUR_PAY); if (G.roomFor(C.inv, G.TOUR_GIFT, C) > 0) G.addInv(C.inv, G.TOUR_GIFT, 1, C); } this.tourStep(pl, "paid"); this.say(pl, C.tour.again ? "That's the tour. You know the way." : `Dex pays you ${G.fmtCash(G.TOUR_PAY)} and a lucky clover. Click the clover in your bag: your next bets pay more. There's more luck out both arches.`, "good"); }
  }

  /* ------------------------------------------------------------ daily tasks (the board in the Casino) */
  dailyState(pl) {
    const C = pl.C, day = G.chicagoDay();
    if (!C.daily || C.daily.day !== day) { C.daily = { day, tasks: G.dailyFor(C, pl.id, day).map((id) => ({ id, got: 0, claimed: false, n: G.dailyDef(id)?.n })) }; this.touch(pl); }
    /* (v111) the board got longer: somebody who already has today's list is topped up to the new length rather than waiting for
       tomorrow, keeping what they have done. dailyFor is a pure function of who and which day, so the extra ones are the ones
       they would have had. */
    else if (C.daily.tasks.length < G.DAILY_COUNT) { const have = new Set(C.daily.tasks.map((t) => t.id));
      for (const id of G.dailyFor(C, pl.id, day)) if (!have.has(id) && C.daily.tasks.length < G.DAILY_COUNT) { C.daily.tasks.push({ id, got: 0, claimed: false, n: G.dailyDef(id)?.n }); have.add(id); }
      this.touch(pl); }
    // a job that can no longer be done (its rocks or trees left the world mid-day) is swapped for one that can; a claimed one is left alone
    if (C.daily.tasks.some((t) => !t.claimed && !G.OPEN_DAILY.has(t.id))) {
      const have = new Set(C.daily.tasks.filter((t) => t.claimed || G.OPEN_DAILY.has(t.id)).map((t) => t.id));
      const spare = G.DAILY.filter((d) => G.OPEN_DAILY.has(d.id) && !have.has(d.id) && (!d.req || G.lvlOf(C, d.req.skill) >= d.req.lvl)).map((d) => d.id);
      C.daily.tasks = C.daily.tasks.map((t) => (t.claimed || G.OPEN_DAILY.has(t.id) ? t : spare.length ? (() => { const id = spare.shift(); return { id, got: 0, claimed: false, n: G.dailyDef(id)?.n }; })() : null)).filter(Boolean); this.touch(pl);
    }
    return C.daily;
  }
  dailySend(pl) { const D = this.dailyState(pl); pl.out.push({ type: "daily", day: D.day, tasks: D.tasks }); }
  /* ACHIEVEMENTS (2026-09-23). One place awards them, whether the trigger was an event, a login sweep or an
     admin poke, so the payment and the message can never be done twice or differently.

     `quiet` is the retroactive case: somebody who has been playing for a fortnight qualifies for thirty of these
     at once, and thirty chat lines is not a celebration, it is a wall. They get the tickets, the points and one
     summary line instead. */
  achAward(pl, ids, quiet = false) {
    if (!ids || !ids.length) return 0;
    const C = pl.C;
    if (!Array.isArray(C.ach)) C.ach = [];
    let tix = 0, last = null;
    for (const id of ids) {
      const a = G.ACH[id]; if (!a || C.ach.includes(id)) continue;
      C.ach.push(id); tix += G.ACH_TIERS[a.tier].tix; last = a;
    }
    if (!last) return 0;
    /* the tickets go through tixTo like every other payout, so the wallet, the caps and the books all see it */
    if (tix > 0) this.tixTo(pl, tix);
    this.touch(pl);
    const pts = G.achPts(C);
    if (quiet) this.say(pl, `You have earned ${ids.length} achievement${ids.length === 1 ? "" : "s"} for things you had already done \u2014 ${G.fmtCash(tix)} and ${pts} points. Have a look at the Achievements list.`, "good");
    else for (const id of ids) { const a = G.ACH[id]; if (a) this.say(pl, `Achievement: ${a.name} \u2014 ${a.blurb} (+${G.fmtCash(G.ACH_TIERS[a.tier].tix)}, ${G.ACH_TIERS[a.tier].pts} pt${G.ACH_TIERS[a.tier].pts === 1 ? "" : "s"})`, "loot"); }
    /* a milestone crossed is worth its own line: it is the only part of this that changes how you play */
    for (const [at, , what] of G.ACH_MILES) if (pts >= at && pts - (G.ACH_TIERS[last.tier].pts) < at) this.say(pl, `${at} achievement points: ${what}.`, "good");
    pl.out.push({ type: "ach", ids, pts });
    /* TO THE SITE'S BELL, but only what was earned LIVE. A retroactive sweep is thirty at once and would be a
       wall rather than a celebration, so `quiet` never leaves the game. Fire and forget on purpose: the game
       must never wait on the site, and a site that is down means a missed bell row and nothing worse. */
    if (!quiet) this.bellAch(pl, ids);
    return ids.length;
  }
  bellAch(pl, ids) {
    const login = String(pl.login || "").toLowerCase(); if (!login || !this.env?.SITE || !this.env?.ESCAPE_KEY) return;
    const list = ids.map((id) => { const a = G.ACH[id]; return a && { id, name: a.name, tier: a.tier, pts: G.ACH_TIERS[a.tier].pts, tix: G.ACH_TIERS[a.tier].tix }; }).filter(Boolean);
    if (!list.length) return;
    try {
      this.ctx.waitUntil(fetch(`${this.env.SITE}/api/eastscape/ach`, {
        method: "POST", headers: { "content-type": "application/json", "X-Escape-Key": this.env.ESCAPE_KEY },
        body: JSON.stringify({ login, list })
      }).catch(() => {}));
    } catch (e) { /* no waitUntil, or no network: the bell simply misses this one */ }
  }
  achEvent(pl, type) {
    const due = G.achDue(pl.C, type);
    if (due.length) this.achAward(pl, due, false);
  }
  /* the login sweep: everything they already qualify for, paid quietly and all at once */
  /* QUIET ONLY ON THE GENUINE BACKFILL. This ran on every login and always passed quiet:true, so anything a live
     event missed came back labelled "for things you had already done" — which is how the owner played a hand,
     earned Sat Down on the next reconnect, and saw nothing that looked like earning it. A deploy drops every
     connection, so that path is walked constantly, not once.

     `first` is true only when this character has never had an ach list at all. After that a sweep is catching up,
     not backfilling, and it says so properly. A first sweep finding one or two also announces them normally: the
     summary exists to stop a wall of thirty, and three is not a wall. */
  achSweep(pl) {
    const first = !Array.isArray(pl.C.ach);
    if (first) pl.C.ach = [];
    const due = G.achDue(pl.C);
    if (due.length) this.achAward(pl, due, first && due.length > 3);
  }
  dailyEvent(pl, type, d) {
    const what = type === "cook" || type === "craft" ? "make" : type;
    if (what !== "gather" && what !== "kill" && what !== "make") return;
    const D = this.dailyState(pl);
    for (const t of D.tasks) {
      const def = G.dailyDef(t.id), need = G.dailyNeed(t); if (!def || t.claimed || t.got >= need) continue;
      if (def.what !== what || (what === "kill" ? d.mob : d.k) !== def.k) continue;
      t.got = Math.min(need, t.got + (d.n || 1)); this.touch(pl);
      if (t.got >= need) this.say(pl, `Daily task done! Claim your ${G.fmtCash(def.cash)} at the task board in the Casino.`, "good");
    }
  }
  dailyOp(S, pl, m) {
    if (m.op === "open") return this.dailySend(pl);
    if (m.op !== "claim" || !this.near(S, pl, "notice", 2)) return;
    const D = this.dailyState(pl), t = D.tasks.find((x) => x.id === m.id), def = t && G.dailyDef(t.id);
    if (!def || t.claimed || t.got < G.dailyNeed(t)) return;
    t.claimed = true; pl.C.stats.jobs = (pl.C.stats.jobs | 0) + 1;   /* (v98) a lifetime tally, for the Quests completed board */ this.tixTo(pl, def.cash); this.touch(pl);
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
        const T = { id: `t${now}${Math.random().toString(36).slice(2, 6)}`, a: o.id, b: pl.id, stage: "offer", ok: {}, off: { [o.id]: { items: {}, cash: 0, pets: [] }, [pl.id]: { items: {}, cash: 0, pets: [] } } };
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
      if (m.op === "add") { const k = String(m.k); if (!G.ITEMS[k] || k === "tickets") return;
        /* (2026-09-23) A FACE-TO-FACE TRADE OFFERS PLAIN PIECES ONLY, for now. An offer is items[key] = count,
           with nowhere to put a level, and the transfer below is takeInv/addInv by key — so offering your only
           axe when it happens to be a +3 would hand the other player a plain one and destroy the reforge without
           a word. Counting plain-only makes a forged piece simply not offerable rather than quietly ruined. The
           MARKET carries levels properly (an order has an f and only matches its own), so that is the route for
           now, and giving the trade window the same treatment is the next piece of this. */
        const have = G.countItems(C, [k], { plainOnly: true }) - (mine.items[k] || 0); const n = Math.max(0, Math.min(have, m.n === "all" ? have : Math.floor(Number(m.n)) || 1)); if (n) mine.items[k] = (mine.items[k] || 0) + n; }
      if (m.op === "remove") delete mine.items[String(m.k)];
      /* (v96, the owner: "allow users to trade tickets in between themselfs") TICKETS CAN BE TRADED. They could not since v57, to keep a second
         account from farming for a first. What still stops that: tickets only become ZCoins through the Prize Counter and the
         tables, and both are capped per RECEIVING account by the site (the hourly allowance, the day fuse, 20 a bet, ten plays an
         hour, the hourly win cap), so a feeder account cannot raise anybody's ceiling. Whole tickets, never more than you hold. */
      if (m.op === "cash") mine.cash = Math.max(0, Math.min(G.cashIn(C), Math.floor(Number(m.n)) || 0));
      T.ok = {}; return this.tradeSync(T);   // any change means both have to accept again
    }
    /* (2026-09-27) PETS IN THE TRADE WINDOW. The offer holds a copy for the other side to read (kind, rank, stats, name); the real
       pet is looked up by id at the final confirm, so a pet worn, bred or sold in the meantime cancels the trade instead of duplicating. */
    if (T.stage === "offer" && (m.op === "addpet" || m.op === "rmpet")) {
      const id = String(m.id || ""); mine.pets ||= [];
      if (m.op === "addpet") {
        const pet = G.petById(C, id); if (!pet || mine.pets.some((p) => p.id === id)) return;
        if (mine.pets.length >= G.PET_TRADE.tradeMax) return this.say(pl, `You can offer ${G.PET_TRADE.tradeMax} pets in one trade.`, "bad");
        mine.pets.push({ ...pet });
      } else mine.pets = mine.pets.filter((p) => p.id !== id);
      T.ok = {}; return this.tradeSync(T);
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
    const still = (p) => Object.entries(T.off[p.id].items).every(([k, n]) => G.countItems(p.C, [k]) >= n) && G.cashIn(p.C) >= T.off[p.id].cash && (T.off[p.id].pets || []).every((x) => G.petById(p.C, x.id));
    if (!still(A) || !still(B)) return this.tradeEnd(T, "Trade cancelled: something offered wasn't there any more.");
    const petsAfter = (p, give, get) => G.petsOf(p.C).length - (give.pets || []).length + (get.pets || []).length;
    if (petsAfter(A, T.off[A.id], T.off[B.id]) > G.PET_TRADE.own || petsAfter(B, T.off[B.id], T.off[A.id]) > G.PET_TRADE.own) return this.tradeEnd(T, `Trade cancelled: nobody can keep more than ${G.PET_TRADE.own} pets.`);
    const after = (p, give, get) => {
      const inv = p.C.inv.map((s) => ({ ...s }));   /* (2026-09-27) a whole copy: {k, n} alone dropped a reforge level and, now, a slot from every stack in the bag after any trade */
      for (const [k, n] of Object.entries(give.items)) G.takeInv(inv, k, n);
      if (give.cash) G.takeInv(inv, "tickets", give.cash);
      let over = 0;
      for (const [k, n] of Object.entries(get.items)) over += G.addInv(inv, k, n, p.C);   /* (2026-09-24) the trade preview sized the bag at 20 and refused trades an upgraded one would hold */
      if (get.cash) over += G.addInv(inv, "tickets", get.cash, p.C);
      return over ? null : inv;
    };
    const newA = after(A, T.off[A.id], T.off[B.id]), newB = after(B, T.off[B.id], T.off[A.id]);
    if (!newA || !newB) return this.tradeEnd(T, "Trade cancelled: not enough room in someone's bag.");
    const apply = (p, inv) => { p.C.inv = inv; this.touch(p); };
    apply(A, newA); apply(B, newB);
    this.petsMove(A, B, T.off[A.id].pets); this.petsMove(B, A, T.off[B.id].pets);
    this.exCommit(A, B);
    this.tradeEnd(T, null);
    this.say(A, `Trade with ${B.name} complete.`, "good"); this.say(B, `Trade with ${A.name} complete.`, "good");
  }

  /** (2026-09-27) hand these pets (by id) from one character to another, whole: worn ones come off first, and an id the receiver
      somehow already has gets a fresh one, because every pet in a list must be told apart. */
  petsMove(from, to, list) {
    for (const x of list || []) {
      const pet = G.petById(from.C, x.id); if (!pet) continue;
      from.C.pets = from.C.pets.filter((q) => q.id !== pet.id); if (from.C.eq.pet === pet.id) from.C.eq.pet = null;
      (to.C.pets ||= []).push(this.petFresh(to.C, pet));
    }
    if (list?.length) { this.touch(from); this.touch(to); }
  }
  petFresh(C, pet) { return G.petById(C, pet.id) ? { ...pet, id: `pt${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}` } : pet; }

  /** One online player by name, case-insensitively. */
  byName(name) {
    const want = String(name || "").trim().toLowerCase();
    if (!want) return null;
    for (const p of this.pls.values()) if (String(p.name).toLowerCase() === want || String(p.login).toLowerCase() === want) return p;
    return null;
  }
  /** Whether this connection may run this admin-panel command.
      THIS LIST IS A MIRROR of MOD_TOOLS in functions/api/eastscape/_tickets.js — change one, change the other. It is
      copied rather than imported because the worker is deployed on its own and cannot reach the site's functions; the
      reasoning for where the line sits is in that file. This copy is the one that actually decides, so a tool added
      only to _tickets.js will draw a button a mod cannot use. */
  canRun(pl, cmd) {
    if (pl.role === "admin" || pl.admin) return true;
    if (pl.role !== "mod") return false;
    return new Set(["stats", "saveall", "restart", "tp", "mute", "unmute", "kick"]).has(String(cmd || ""));
  }

  /* ------------------------------------------------------------ admin, and the part of it a mod may reach */
  admin(S, pl, m) {
    const C = pl.C, note = (t) => this.say(pl, `[admin] ${t}`, "admin");
    const skill = G.SKILLS[m.skill] ? m.skill : null;
    switch (m.cmd) {
      case "xp": { const n = Math.trunc(Number(m.n) || 0); if (!skill || !n) return; this.grant(pl, skill, n); return note(`${n > 0 ? "+" : ""}${n.toLocaleString()} ${G.SKILLS[skill].name} xp.`); }
      case "givepet": {   /* (2026-09-27) admin: a pet of any kind, optionally Greater, to test Breeding */
        const k = String(m.k || ""); if (!G.PETS[k]) return note(`No pet called ${k}.`);
        const pet = { id: `pt${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`, k, name: "", ...(m.tier ? { tier: 1, fx: G.greaterFx(k, k) } : {}) };
        C.pets.push(pet); this.touch(pl); return note(`Gave ${G.petLabel(pet)}.`);
      }
      case "setlvl": { const l = Math.max(1, Math.min(99, m.lvl | 0)); if (!skill) return; C.xp[skill] = G.XP_AT[l]; if (skill === "hp") C.hp = G.maxHpOf(C); C.hp = Math.min(C.hp, G.maxHpOf(C)); this.touch(pl); return note(`${G.SKILLS[skill].name} set to ${l}.`); }
      case "clearxp": {
        const f = G.freshChar().xp;
        if (m.skill === "all") { C.xp = { ...f }; C.hp = Math.min(C.hp, G.maxHpOf(C)); this.touch(pl); return note("All xp cleared."); }
        if (!skill) return; C.xp[skill] = f[skill]; C.hp = Math.min(C.hp, G.maxHpOf(C)); this.touch(pl); return note(`${G.SKILLS[skill].name} xp cleared.`);
      }
      case "item": { const k = String(m.k), n = Math.max(1, Math.min(1000000, m.n | 0)); if (!G.ITEMS[k]) return; const got = this.giveUpTo(pl, k, n); if (got) note(`Gave ${got.toLocaleString()} × ${G.ITEMS[k].name}.`); return; }
      /* (2026-09-25, the owner: "allow me to spawn it in admin menu") Two ways, because they are different
         jobs: `item pot_double` puts one in your bag to test the drinking, and this STARTS one outright without
         spending anything. `mins` is optional so a test can run for two minutes instead of thirty. */
      case "double": {
        const mins = Math.max(0, Math.min(180, m.mins == null ? Math.round(G.DOUBLE.ms / 60000) : m.mins | 0));
        if (!mins) { if (this.dbl) { this.dbl.until = 0; this.doubleTick(); } return note("2X event stopped."); }
        this.doubleStart(m.by ? String(m.by).slice(0, 24) : pl.name, mins * 60000);
        return note(`2X event started for ${mins} minutes.`);
      }
      case "clearinv": C.inv = []; this.touch(pl); return note("Inventory cleared.");
      case "respin": C.spin = null; this.touch(pl); return note("Your Daily Prize Wheel spin is free again (your streak starts over).");
      /* (2026-09-23) FOR TESTING ACHIEVEMENTS. `ach clear` forgets them all so the next qualifying event fires
         properly, which is the only way to watch one land once you already have it. The tickets already paid are
         not clawed back: they were earned, and a test should not cost anybody their money. */
      case "ach": {
        const op = String(m.k || m.cmd2 || "").trim().toLowerCase();
        if (op === "clear") { C.ach = []; this.touch(pl); return note("Achievements forgotten. The next thing you do will earn them again (tickets already paid stay paid)."); }
        const have = Array.isArray(C.ach) ? C.ach.length : 0;
        return note(`${have} of ${Object.keys(G.ACH).length} earned, ${G.achPts(C)} points. Use "ach clear" to forget them and watch one land.`);
      }
      // the House Ruby's held exchanges: list them, and let one go (after looking at the site's Wallet tab to see whether it paid)
      case "dexlist": return this.ctx.storage.list({ prefix: "dex:", limit: 50 }).then((all) => note(all.size ? [...all].map(([k, r]) => `${k} · ${r.name} · ${r.op} ${r.zc} ZC · ${r.back ? `${r.back.n} ${r.back.k}` : G.fmtCash(r.cash || 0)} held · ${new Date(r.at).toISOString().slice(0, 16)}${r.stuck ? " · STUCK" : ""}`).join(" | ") : "No held exchanges."));
      case "dexrelease": { const key = String(m.key || ""); if (!key.startsWith("dex:")) return; return this.ctx.storage.get(key).then(async (r) => { if (!r) return note("No such record."); await this.ctx.storage.delete(key); const who = key.split(":").slice(1, -1).join(":"), p = this.pls.get(who); if (m.refund) await this.dexRefund(p || { id: who, left: true }, r); note(`Released ${key}${m.refund ? ", what it took given back" : " (it paid: nothing given back)"}.`); }); }
      case "heal": C.hp = G.maxHpOf(C); this.touch(pl); return note("Healed.");
      case "god": pl.god = !pl.god; this.touch(pl); return note(pl.god ? "God mode on: nothing can hurt you." : "God mode off.");
      case "tp": { const key = String(m.scene); if (!G.SCENES[key] && key !== pl.C.scene) return;   /* (or somewhere else in the private copy you are already standing in: an island, a crypt run) */ this.moveToScene(pl, key, null, Number.isInteger(m.x) && Number.isInteger(m.y) ? { x: m.x, y: m.y } : null); return note(`Teleported to ${G.SCENES[key].name}.`); }
      case "hwking": { this.hw.kingAt = Date.now() - 1; this.hw.kingDue = false; this.hw.kingUp = null; this.hwSave(); return note("The Pumpkin King is due now: he rises the moment somebody is in the Mire."); }   /* (2026-09-27) dev/admin: call the King */
      case "quest": { const k = String(m.k), state = String(m.state); if (!G.QUESTS[k] || !["new", "active", "done"].includes(state)) return; if (state === "new") delete C.qs[k]; else C.qs[k] = { state, stage: 0, n: 0 }; this.touch(pl); return note(`${G.QUESTS[k].name} set to ${state}.`); }
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
      /* (v125) THE DASHBOARD — READ ONLY, BY REQUEST. Everything here is already in memory or already a number this
         object keeps; nothing is written and nothing moves. It is gathered on demand, never pushed, so an open panel
         costs one message per refresh and an admin who is not looking costs nothing at all.
         When this grows teeth, the tools go behind their own cmds — not in here. */
      /* ---- THE CHAT TOOLS. These exist for mods first: keeping the room civil is the whole job.
         Nobody can act on their own tier or above — a mod cannot mute, kick or silence another mod or an admin — so the
         only person who can remove a moderator is the owner, and no mod war is possible. ---- */
      case "mute": {
        const who = this.byName(m.name); if (!who) return note(`Nobody called ${m.name} is online.`);
        if (who.role === "admin" || (who.role === "mod" && pl.role !== "admin")) return note("You cannot mute them.");
        const mins = Math.max(1, Math.min(240, Math.trunc(Number(m.n) || 10)));
        who.C.mutedUntil = Date.now() + mins * 60000; who.mutedTold = 0; this.touch(who);   /* on the character, and saved: a refresh must not clear it */
        this.say(who, `You have been muted for ${mins} min.`, "bad");
        return note(`${who.name} is muted for ${mins} min.`);
      }
      case "unmute": {
        const who = this.byName(m.name); if (!who) return note(`Nobody called ${m.name} is online.`);
        who.C.mutedUntil = 0; this.touch(who);
        this.say(who, "You can talk again.", "good");
        return note(`${who.name} can talk again.`);
      }
      case "kick": {
        const who = this.byName(m.name); if (!who) return note(`Nobody called ${m.name} is online.`);
        if (who.role === "admin" || (who.role === "mod" && pl.role !== "admin")) return note("You cannot kick them.");
        if (who.id === pl.id) return note("Kicking yourself is not a moderation tool.");
        this.say(who, "You have been disconnected by a moderator.", "bad");
        note(`${who.name} kicked.`);
        /* SAVED FIRST. A kick is a moderation tool, not a punishment that costs somebody the loot they were carrying. */
        return void this.persist(who).catch(() => {}).then(() => { try { who.ws.close(4001, "kicked"); } catch { /* already gone */ } });
      }
      case "dash": {
        const now = Date.now();   /* admin() takes (S, pl, m) — there is no `now` in this scope */
        const seen = [...this.pls.values()];
        const where = {};
        for (const p of seen) { const k = String(p.C.scene || "?").split(":")[0]; where[k] = (where[k] || 0) + 1; }
        const people = seen.map((p) => ({
          name: p.name, scene: String(p.C.scene || "?").split(":")[0],
          combat: G.combatOf(p.C), tix: G.tixIn(p.C), admin: !!p.admin,
          idle: Math.round((now - (p.C?.stats?.lastSeen || now)) / 1000)   /* lastSeen lives on the character's stats, not on the connection */
        })).sort((a, b) => b.tix - a.tix);
        return pl.out.push({
          type: "dash", now,
          online: people,
          where,
          tickets: people.reduce((a, x) => a + x.tix, 0),
          jackpot: Math.floor(this.jack?.pot || 0),
          /* cryptTop is an object keyed by tier ({ "1": [...] }), not a list — flatten it, fastest first. */
          cryptTop: Object.entries(this.cryptTop || {}).flatMap(([tier, rows]) => (Array.isArray(rows) ? rows : []).map((r) => ({ ...r, tier }))).sort((a, b) => a.secs - b.secs).slice(0, 5),
          song: this.song ? { title: this.song.title, by: this.song.by } : null,
          radio: this.radio ? { name: this.radio.name, by: this.radio.by } : null,
          exchange: (this.ex?.orders || []).filter((o) => o.open).length,
          fame: (this.fame?.rows || []).length
        });

      }
      case "stats": {
        /* (v104) with a name: ANOTHER player's numbers (the owner asked for a beta tester's playtime and there was no way to see it). Online or not: the who: index gives the id, the saved character the rest. */
        if (m.name) { const login = String(m.name).trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30); return this.ctx.storage.get(`who:${login}`).then(async (w) => {
          if (!w) return note(`Nobody called ${login} has played.`); const on = this.pls.get(w.id); if (on) this.accrue(on); const C2 = on ? on.C : G.normChar(await this.ctx.storage.get(`char:${w.id}`)), st2 = C2.stats || {};
          const top2 = (mm, n = 6) => Object.entries(mm || {}).sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(", ") || "none", mins = Math.round((st2.playMs || 0) / 60000), earned = Math.round(Number(C2.earned) || 0);
          note(`${w.name}${on ? " (online)" : ""}: played ${Math.floor(mins / 60)}h ${mins % 60}m over ${st2.sessions || 0} sessions | first seen ${st2.firstSeen ? new Date(st2.firstSeen).toISOString().slice(0, 10) : "?"}`);
          note(`tickets: earned ${earned.toLocaleString()} all-time (${mins ? Math.round(earned / (mins / 60)).toLocaleString() : 0} an hour played), holding ${G.tixIn(C2).toLocaleString()}, wagered ${Math.round(Number(C2.wagered) || 0).toLocaleString()} | ZCoins found ${(C2.found?.zcoin) | 0}`);
          note(`Combat ${G.lvlOf(C2, "melee")}, Fishing ${G.lvlOf(C2, "fishing")}, Cooking ${G.lvlOf(C2, "cooking")} | xp ${Math.round(st2.xpTotal || 0).toLocaleString()} | deaths ${st2.deaths || 0} | crypt clears ${st2.crypt | 0} | jobs ${st2.jobs | 0}`);
          note(`kills: ${top2(st2.kills)} | gathered: ${top2(st2.gathered)}`);
        }); }
        this.accrue(pl);
        const st = pl.C.stats; if (!st) return note("No stats on this character.");
        const top = (m, n = 5) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
        note(`save v${pl.C.v} | played ${Math.round(st.playMs / 60000)}m over ${st.sessions} session${st.sessions === 1 ? "" : "s"}`);
        note(`xp ${st.xpTotal.toLocaleString()} total, ${(st.xpDay[G.dayKeyCT()] || 0).toLocaleString()} today | cash in ${st.cashIn.toLocaleString()}, out ${st.cashOut.toLocaleString()}`);
        note(`kills: ${top(st.kills)} | deaths ${st.deaths} (pvp ${st.pvpDeaths}) | pvp kills ${st.pvpKills} | quests ${st.questsDone}`);
        return note(`gathered: ${top(st.gathered)} | looted: ${top(st.looted)} | cooked: ${top(st.cooked)} (burnt ${st.burnt})`);
      }
      // try a speed bonus without any gear (this session only; it isn't saved)
      case "speed": { pl.speedTest = Math.max(0, Math.min(200, Math.trunc(Number(m.n)) || 0)); this.touch(pl); return note(`Speed test: +${pl.speedTest}% raw, which gives +${G.speedText(C, pl.speedTest)}% (${G.stepMsOf(C, pl.speedTest)}ms a tile).`); }
    }
  }
}
installCrypt(World, { G, R: CR, rint });
installPyramid(World, { G, R: PR, rint });
installCount(World, { G, R: NR, rint });
installCarnival(World, { G, rint });
installTurnstile(World, { G });
installPit(World, { G });
installTower(World, { G, R: TW, rint });
