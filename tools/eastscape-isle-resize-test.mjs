/* THE BIGGER ISLANDS KEEP EVERYBODY'S DECOR —  node tools/eastscape-isle-resize-test.mjs
   (2026-09-30, the owner: "make the island sizes bigger (and make sure to retain everyones custom placed decor)").
     - every tile a piece could stand on before (the old oval's land, less what stood on it) is still land, walkable, and not a dock or an exit;
     - every thing on the old island (cottage, plots, pedestals, pen, sign, palms) is exactly where it was;
     - the new scenery (palms, rocks, bushes) stands only on tiles that were sea;
     - the whole island can be walked from the entry, and the dock reaches the land;
     - 300 pieces laid at random on the OLD islands all survive the safety net (decorSweep), and a piece in the sea is sent back to the tray;
     - the bigger caps. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createDecorRules } = await import("../v3/assets/js/eastscape-decor-rules.js");
const DR = createDecorRules(G);
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
/* what stood on the old islands (unchanged by the resize: the builder keeps these lists) */
const OLD_OBJS = (tier) => { const big = tier >= 2, out = [{ t: "house", x: 8, y: 1, w: 5, h: 3 }, { t: "islesign", x: 8, y: 9 }];
  for (const [x, y] of big ? [[3, 5], [4, 5], [5, 5], [6, 5], [3, 7], [4, 7], [5, 7], [6, 7], [7, 5], [8, 5], [7, 7], [8, 7]] : [[4, 5], [5, 5], [6, 5], [7, 5], [4, 7], [5, 7], [6, 7], [7, 7]]) out.push({ t: "plot", x, y });
  for (const [x, y] of big ? [[13, 5], [15, 5], [17, 5], [13, 7], [15, 7], [17, 7], [13, 9], [15, 9], [17, 9]] : [[13, 5], [15, 5], [17, 5], [13, 7], [15, 7], [17, 7]]) out.push({ t: "pedestal", x, y });
  out.push(big ? { t: "pen", x: 4, y: 9, w: 3, h: 1 } : { t: "pen", x: 13, y: 9, w: 3, h: 1 });
  for (const [x, y] of big ? [[3, 3], [18, 3], [2, 8], [19, 9]] : [[4, 3], [16, 3], [3, 8]]) out.push({ t: "palm", x, y });
  return out; };
const OLD_DOCK = (tier) => { const d0 = tier >= 2 ? 11 : 10, s = new Set(); for (let y = d0; y < G.ROWS; y++) for (const x of [10, 11]) s.add(`${x},${y}`); if (tier >= 3) for (let y = 5; y <= 7; y++) for (let x = 19; x < G.COLS; x++) s.add(`${x},${y}`); return s; };
let rng = 7; const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (const tier of [1, 2, 3]) {
  const key = G.isleKey({ tier }, "t"), built = G.buildScene(key), g = built.g, old = G.isleOldLand(tier), objs = OLD_OBJS(tier), dock = OLD_DOCK(tier);
  const blocked = new Set(); for (const o of objs) for (let j = 0; j < (o.h || 1); j++) for (let i = 0; i < (o.w || 1); i++) blocked.add(`${o.x + i},${o.y + j}`);
  /* 1. every tile a piece could stand on before still takes one */
  /* the OLD island's coast was bank (markBanks: land touching the sea, not walkable), so only land clear of the sea took a piece */
  const coast = (x, y) => G.D8.some(([dx, dy]) => (old[y + dy]?.[x + dx] ?? "~") === "~" && !dock.has(`${x + dx},${y + dy}`));
  const before = []; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (old[y][x] !== "~" && !coast(x, y) && !blocked.has(`${x},${y}`) && !dock.has(`${x},${y}`)) before.push([x, y]);
  const lost = before.filter(([x, y]) => !G.walkableIn(g, x, y) || "ep".includes(g[y][x]));
  is([before.length > 50, lost.length], [true, 0], `tier ${tier}: all ${before.length} tiles decor could use before are still usable`);
  /* 2. the old island's things are where they were */
  const moved = objs.filter((o) => !built.objs.some((b) => b.t === o.t && b.x === o.x && b.y === o.y)); is(moved.map((o) => `${o.t}@${o.x},${o.y}`), [], `tier ${tier}: cottage, plots, pedestals, pen, sign and palms unmoved`);
  /* 3. the new scenery stands only where the sea was */
  const newThings = built.objs.filter((b) => ["palm", "boulder", "bush"].includes(b.t) && !objs.some((o) => o.t === b.t && o.x === b.x && o.y === b.y));
  is([newThings.length > 0, newThings.filter((b) => old[b.y][b.x] !== "~").length], [true, 0], `tier ${tier}: ${newThings.length} new trees and rocks, all on what was sea`);
  /* 4. bigger, and all of it walkable from the entry; the dock reaches the land */
  const land = (gg) => gg.flat().filter((c) => c !== "~").length, e = G.SCENES.isle.entry;
  const seen = new Set([`${e.x},${e.y}`]), q = [[e.x, e.y]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of G.D8) { const X = x + dx, Y = y + dy; if (!seen.has(`${X},${Y}`) && G.canStepIn(g, x, y, dx, dy)) { seen.add(`${X},${Y}`); q.push([X, Y]); } } }
  const island = []; for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (G.walkableIn(g, x, y)) island.push(`${x},${y}`);
  const stranded = island.filter((k) => !seen.has(k)), exitReached = [...seen].some((k) => { const [x, y] = k.split(",").map(Number); return g[y][x] === "e"; });
  is([land(g) > land(old) * 1.5, stranded.length, exitReached], [true, 0, true], `tier ${tier}: land ${land(old)} -> ${land(g)} tiles, every tile reachable, the dock's end reached`);
  /* 5. three hundred pieces laid on the OLD island survive the safety net */
  const one = Object.entries(DR.DECOR).filter(([, P]) => P.in === "isle" && !P.wall), decor = [];
  for (let n = 0; decor.length < 300 && n < 20000; n++) { const [k, P] = one[Math.floor(rand() * one.length)], [x, y] = before[Math.floor(rand() * before.length)];
    let ok = true; for (let j = 0; j < P.h; j++) for (let i = 0; i < P.w; i++) if (!before.some(([a, b]) => a === x + i && b === y + j)) ok = false; if (ok) decor.push({ k, x, y, at: "isle" }); }
  const isle = { tier, decor: decor.map((d) => ({ ...d })), owned: {} }, back = DR.decorSweep(isle);
  is([decor.length, back.length], [300, 0], `tier ${tier}: 300 pieces laid on the old island, none sent back`);
}
/* the cottage: bigger inside, and every tile of the old room a piece could use is still floor (the old ferns' corners included) */
{ const g = G.buildScene("home:t").g, OLD_FIXED = new Set(["5,3", "6,3", "16,3", "16,4", "15,3"]), lost = [];
  for (let y = 3; y <= 10; y++) for (let x = 5; x <= 16; x++) if (!OLD_FIXED.has(`${x},${y}`) && (!G.walkableIn(g, x, y) || "ep".includes(g[y][x]))) lost.push(`${x},${y}`);
  is([G.SCENES.home.room, lost], [[3, 3, 18, 12], []], "the cottage is bigger ([3,3,18,12]) and every old floor tile is still floor");
  const isle = { tier: 1, owned: { tv: 1, sofa: 1 }, decor: [{ k: "tv", x: 8, y: 3, at: "home" }, { k: "sofa", x: 12, y: 9, at: "home" }] };
  is(DR.decorSweep(isle).length, 0, "a TV on the back wall and a sofa by the old door both stay"); }
/* the net itself: a piece in the sea, or a wall piece off the wall, goes to the tray and stays owned */
{ const isle = { tier: 1, owned: { bench: 1, tv: 1 }, decor: [{ k: "bench", x: 40, y: 24, at: "isle" }, { k: "tv", x: 8, y: 7, at: "home" }, { k: "bench", x: 20, y: 9, at: "isle" }] };
  const back = DR.decorSweep(isle); is([back.map((d) => d.k), isle.decor.length, isle.owned.bench, isle.owned.tv], [["bench", "tv"], 1, 1, 1], "a bench in the sea and a TV off the wall go back to the tray, still owned; the good bench stays"); }
is(DR.DECOR_CAP.isle, [0, 20, 32, 48], "the bigger caps outside");
console.log(bad ? `\n${bad} problem(s)` : "\nThe bigger islands keep every piece: same tiles, same things, new land only where the sea was");
process.exitCode = bad ? 1 : 0;
