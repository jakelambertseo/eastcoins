/* DOES THE BOARDWALK WORK? —  node tools/eastscape-boardwalk-test.mjs
   (2026-09-27, rebuilt as islands) The real World with storage stubbed. The Boardwalk is six island scenes: the Market (off the Carnival's
   west fence) and five more, joined by rowboats. This checks that every island is walkable end to end from where you arrive, that every
   rowboat sits in the water beside land and lands you on ground, that the chain runs Market -> Cabin Coast -> Lighthouse -> Shipwreck
   Isle -> Pirate's Pier -> Skull Isle and back, that palms, rocks, fishing spots and monsters stand where they can be reached, that
   Captain Claw is on the last island, and that a player can actually row the whole way out and back. */
import "./eastscape-open-all.mjs";   /* the Boardwalk ships held (HOLD); this test opens it */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { World } from "../eastscape-worker/src/index.js";
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) ok(`${what}: ${JSON.stringify(got)}`); else fail(`${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); W.save = async () => {}; W.houseSay = () => {};
const CHAIN = ["boardwalk", "bw_cabin", "bw_light", "bw_wreck", "bw_pier", "bw_skull"];
is(G.SCENES.carnival.exits.w, "boardwalk", "west of the Carnival is the Boardwalk"); is(G.SCENES.boardwalk.exits.e, "carnival", "and the Market's east edge is the Carnival");
is(CHAIN.every((k) => G.OPEN.has(k)), true, "all six islands open (with the hold lifted)");
const reach = (S, sx, sy) => { const walk = (x, y) => G.walkableIn(S.g, x, y), seen = new Set([sy * G.COLS + sx]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of G.D8) { const nx = x + dx, ny = y + dy, k = ny * G.COLS + nx; if (!seen.has(k) && nx >= 0 && ny >= 0 && nx < G.COLS && ny < G.ROWS && walk(nx, ny) && (!dx || !dy || (walk(x, ny) && walk(nx, y)))) { seen.add(k); q.push([nx, ny]); } } } return seen; };
/* (2026-10-01, v1.1) a map's fenced nook is reached over its shortcut, not on foot: its one tile is not "cut off" */
const nookTiles = (k) => Object.entries(G.WORLD_SC || {}).filter(([id, s]) => (s.scene || id) === k && s.walls && !G.HOLD.thief2).length;
const nearWalk = (S, o, r) => { for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (G.walkableIn(S.g, x, y) && G.cheb({ x, y }, o) <= r) return true; return false; };
/* where each island is entered: the Market from the Carnival's door, the rest where the rowboat from the previous island lands */
const arrive = { boardwalk: { x: 43, y: 6 } };
for (let i = 0; i < CHAIN.length - 1; i++) { const S = W.scene(CHAIN[i]), b = S.objs.find((o) => o.t === "rowboat" && o.row.to === CHAIN[i + 1]); if (!b) { fail(`${CHAIN[i]} has no rowboat on to ${CHAIN[i + 1]}`); continue; } arrive[CHAIN[i + 1]] = { x: b.row.x, y: b.row.y }; }
for (const [i, k] of CHAIN.entries()) {
  const S = W.scene(k), def = G.SCENES[k], a = arrive[k]; if (!a) continue;
  let open = 0; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (G.walkableIn(S.g, x, y)) open++;
  const seen = reach(S, a.x, a.y);
  if (!G.walkableIn(S.g, a.x, a.y)) fail(`${k}: you arrive at ${a.x},${a.y}, which is not ground`);
  if (seen.size !== open - nookTiles(k)) fail(`${k}: ${open - nookTiles(k) - seen.size} of ${open} open tiles cannot be reached from where you arrive`);
  const boats = S.objs.filter((o) => o.t === "rowboat");
  for (const b of boats) {
    if (S.g[b.y][b.x] !== "~") fail(`${k}: the rowboat at ${b.x},${b.y} is not on water`);
    if (![...seen].some((t) => G.cheb({ x: t % G.COLS, y: Math.floor(t / G.COLS) }, b) <= 1)) fail(`${k}: the rowboat at ${b.x},${b.y} cannot be reached`);
    const T = W.scene(b.row.to); if (!G.walkableIn(T.g, b.row.x, b.row.y)) fail(`${k}: the rowboat to ${b.row.to} lands at ${b.row.x},${b.row.y}, which is not ground`);
  }
  const fwd = boats.find((b) => b.row.to === CHAIN[i + 1]), back = boats.find((b) => b.row.to === CHAIN[i - 1]);
  if (i < CHAIN.length - 1 && !fwd) fail(`${k}: no boat on`); if (i > 0 && !back) fail(`${k}: no boat back`);
  if (back) { const P = W.scene(CHAIN[i - 1]), theirs = P.objs.find((o) => o.t === "rowboat" && o.row.to === k); if (theirs && G.cheb({ x: back.row.x, y: back.row.y }, theirs) > 2) fail(`${k}: the boat back lands you ${G.cheb({ x: back.row.x, y: back.row.y }, theirs)} tiles from ${CHAIN[i - 1]}'s boat out, not beside it`); }
  for (const o of S.objs.filter((o) => (o.t === "yew" || o.t === "rock" || o.t === "range") && !o.edge)) { if (S.g[o.y][o.x] !== "#") fail(`${k}: ${o.name} at ${o.x},${o.y} is not on a blocked tile`); if (!nearWalk(S, o, 1)) fail(`${k}: ${o.name} at ${o.x},${o.y} cannot be reached`); }
  for (const sp of S.objs.filter((o) => o.t === "spot")) { if (S.g[sp.y][sp.x] !== "~") fail(`${k}: fishing spot ${sp.x},${sp.y} is not on water`); if (!nearWalk(S, sp, 1)) fail(`${k}: fishing spot ${sp.x},${sp.y} cannot be fished from land`); }
  for (const m of S.mobs) { if (m.perch) { if (S.g[m.hy][m.hx] !== "~") fail(`${k}: ${m.t} at ${m.hx},${m.hy} is not over water`); if (!nearWalk(S, { x: m.hx, y: m.hy }, G.MOBS[m.t].range || 1)) fail(`${k}: ${m.t} at ${m.hx},${m.hy} is out of reach even at its own range`); } else if (!G.walkableIn(S.g, m.hx, m.hy)) fail(`${k}: ${m.t} at ${m.hx},${m.hy} stands on nothing`); }
  for (const t of new Set(S.mobs.map((m) => m.t))) for (const [d] of [...G.MOBS[t].drops, ...(G.MOBS[t].rare || [])]) if (!G.ITEMS[d]) fail(`${t} drops ${d}, which is not an item`);
  ok(`${def.name.padEnd(16)} ${String(open).padStart(3)} tiles, ${boats.length} boat(s), ${S.objs.filter((o) => o.t === "yew").length} palm(s), ${S.objs.filter((o) => o.t === "rock").length} rock(s), ${S.objs.filter((o) => o.t === "spot").length} spot(s), ${S.mobs.length} monsters`);
}
is(CHAIN.filter((k) => W.scene(k).mobs.some((m) => m.t === "captainclaw")), ["bw_skull"], "Captain Claw is on Skull Isle, the last island, and nowhere else");
is(CHAIN.every((k) => W.scene(k).mobs.length >= 3), true, "every island has monsters");
is(W.scene("boardwalk").npcs.some((n) => n.name === "Salty Meg"), true, "Salty Meg is at the Market"); is(W.scene("boardwalk").objs.some((o) => o.t === "range"), true, "and the Chip Shop");
for (const q of ["bwmackerel", "bwdeckhands", "bwcaptain"]) if (!G.QUESTS[q]?.stages?.length) fail(`quest ${q}`);
for (const f of ["mackerel", "bluefin", "swordfish"]) { if (!G.RECIPES[`cook_${f}`] || !G.RECIPES[`smoke_${f}`]) fail(`${f}: no cook or smoke`); if (!CHAIN.some((k) => W.scene(k).objs.some((o) => o.t === "spot" && (o.fish === f || o.fish2 === f)))) fail(`${f} is caught nowhere`); }
is(new Set(CHAIN.flatMap((k) => W.scene(k).objs.filter((o) => o.t === "rock").map((o) => o.ore))).size, 3, "three ores along the way (starfall, eclipse, nova)");
/* row the whole chain, out and back, the way a player does */
{ const C = G.freshChar(); C.scene = "boardwalk"; const pl = { id: "rower", name: "rower", C, x: 18, y: 19, out: [], path: [], god: false }; W.pls.set(pl.id, pl);
  const row = (to) => { const S = W.scene(pl.C.scene), b = S.objs.find((o) => o.t === "rowboat" && o.row.to === to); if (!b) return false; const at = G.D8.map(([dx, dy]) => ({ x: b.x + dx, y: b.y + dy })).find((c) => G.walkableIn(S.g, c.x, c.y)); pl.x = at.x; pl.y = at.y; pl.act = { kind: "rowboat", ob: b, x: b.x, y: b.y, started: 0 };   /* walk up to the boat first, as a player does */ W.doAction(S, pl, Date.now()); return pl.C.scene === to; };
  const out = CHAIN.slice(1).every((k) => row(k)); is(out && pl.C.scene, "bw_skull", "a player rows from the Market out to Skull Isle");
  const home = CHAIN.slice(0, -1).reverse().every((k) => row(k)); is(home && pl.C.scene, "boardwalk", "and all the way back"); }
/* (2026-09-27) Captain Claw: 45 minutes to come back, his gloves, and the chest that opens once for each person who put him down */
{ const S = W.scene("bw_skull"), claw = S.mobs.find((m) => m.t === "captainclaw"), mk = (id) => { const C = G.freshChar(); C.scene = "bw_skull"; const p = { id, name: id, C, x: claw.x + 1, y: claw.y, out: [], path: [], god: false }; W.pls.set(id, p); return p; };
  const a = mk("killer"), b = mk("helper"), c = mk("bystander"), hp = claw.maxHp || G.MOBS.captainclaw.hp;
  claw.by = { killer: hp, helper: hp * 0.2 };
  const t0 = Date.now(); W.killMob(S, a, claw, t0);
  is(Math.round((claw.respawnAt - t0) / 60000), 45, "Captain Claw comes back in 45 minutes");
  is(!!S.treasure && S.treasure.who.has("killer") && S.treasure.who.has("helper") && !S.treasure.who.has("bystander"), true, "the chest is for the killer and the helper, not the one who watched");
  const chest = S.objs.find((o) => o.t === "clawchest"), tix = (p) => G.countItems({ inv: [...p.C.inv, ...(p.C.bank || [])], bank: [] }, ["tickets"]);
  const open = (p) => { const before = tix(p); p.x = chest.x + 1; p.y = chest.y; p.act = { kind: "clawchest", ob: chest, x: chest.x, y: chest.y, started: 0 }; W.doAction(S, p, Date.now()); return tix(p) - before; };
  const got = open(a); console.log("   (" + a.out.filter((e) => e.type === "say").slice(-1).map((e) => e.text)[0] + ")"); is(got >= G.CLAW_CHEST.tickets[0], true, `the killer opens it: ${got} tickets, and ${a.C.inv.filter((x) => x.k !== "tickets").map((x) => `${x.n} ${x.k}`).join(", ")}`);
  is(open(a), 0, "and cannot open it twice"); is(open(b) >= G.CLAW_CHEST.tickets[0], true, "the helper opens their own"); is(open(c), 0, "the bystander gets nothing");
  is(G.MOBS.captainclaw.drops.some(([k, , p]) => k === "clawgrip" && p === 0.04) && G.ITEMS.clawgrip.slot === "gloves" && !Object.entries(G.MOBS).some(([t, m]) => t !== "captainclaw" && [...m.drops, ...(m.rare || [])].some(([k]) => k === "clawgrip")), true, "Captain Claw's grip: gloves, one kill in 25 from his drop table, and only he drops them"); }
/* respawns scaled to level on every island: three minutes at the least */
{ const low = []; for (const k of CHAIN) for (const m of W.scene(k).mobs) if (m.t !== "captainclaw" && (!Array.isArray(m.respawn) || m.respawn[0] < 180000)) low.push(`${k}:${m.t}`); is(low, [], "every island monster takes at least three minutes to come back"); }
console.log(bad ? `\n${bad} problem(s)` : "\nthe Boardwalk works: six islands, the rowboats between them, the Market, and Captain Claw at the end");
process.exitCode = bad ? 1 : 0;
