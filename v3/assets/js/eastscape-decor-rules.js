/* ============================================================
   EastScape: the decor shop's RULES: the catalogue, and "may this piece go on this tile"

   One file for the game server (which decides) and the page (which previews and lays furniture out for visitors). It is NOT part
   of the first load: the page fetches it the first time you stand on an island that has furniture, or open the shop. It does not
   import the shared rules; it is HANDED them (createDecorRules(G)), so the browser never fetches that big file twice under two
   addresses.
   ============================================================ */
export function createDecorRules(G) {
/* YAHSMEENA'S DECOR SHOP (v101, the owner: "go, build the decor shop, draw them all in pixellab"; the draft he said go to is section 5 of
   EASTSCAPE-DRAFTS.md). Furniture for your island and your cottage. ALMOST ALL OF IT IS FOR SHOW: nothing here touches odds, pay, fighting or
   growing, which is what makes it safe to price freely. The ONE exception is the bank chest (2026-09-23, the
   owner), and it is a deliberate one: it stores, it does not earn. A chest on your island opens the same bank as
   the chest in the Yard, under the same rules, so it can move nothing into the world that was not already there
   — it only saves the boat trip while you are farming. Anything else added here that DOES something needs the
   same test: does it create value, or only save a walk?
   A PIECE is { name, w, h (tiles), in: "isle" | "home", price (tickets), art, and maybe: flat (lies on the ground, walked over,
   never blocks), wall (cottage only: stands on the back row), max (how many one player may own), sit }.
   WHAT A PLAYER HAS is on their island record: isle.owned { piece: how many bought } and isle.decor [{ k, x, y, at }], at =
   "isle" | "shore" | "home" (which of the owner's scenes). Buying and selling happen at Yahsmeena; placing happens anywhere
   on your own island, in decorate mode. She buys back at DECOR_SELLBACK of the price.
   THE RULES OF PLACING are decorFits(), used by the game server (which decides) and by the page (which previews): the piece
   must be yours and spare, belong in this kind of scene, sit on open ground, overlap nothing, and WALL NOTHING OFF: after it
   goes down every tile that could be walked to before can still be walked to. That one rule covers the door, the dock, the
   plots, the pedestals, the pen and Yahsmeena without naming any of them. */
const DECOR_SELLBACK = 0.25, DECOR_CAP = { isle: [0, 12, 20, 32], home: 12 };   // isle: by island tier (the Far Shore shares the island's count); flat pieces count a quarter
const DECOR = {
  /* (2026-09-23, the owner: "a purchase chest/real bank that users can purchase at Yahsmeena's Decor on their
     island ... allow them to put in crops/seeds etc while theyre farming"). It wears o_chest, the same picture as
     the Yard's bank, so it reads as a bank on sight rather than needing a label. `bank: true` is what decorInto
     turns into a booth; max 1 because a second one does nothing a first does not. Priced between the fountain
     and the hot tub: the most useful thing in the shop and a first real goal, not a trinket. */
  bankchest: { name: "Bank chest", w: 1, h: 1, in: "isle", price: 10000, max: 1, art: "o_chest", bank: true },
  bench:     { name: "Wooden bench", w: 2, h: 1, in: "isle", price: 1500 },
  picnic:    { name: "Picnic table", w: 2, h: 1, in: "isle", price: 2500 },
  flowers_r: { name: "Flower bed (red)", w: 1, h: 1, in: "isle", price: 800, art: "d_flowers_r" },
  flowers_y: { name: "Flower bed (yellow)", w: 1, h: 1, in: "isle", price: 800, art: "d_flowers_y" },
  flowers_b: { name: "Flower bed (blue)", w: 1, h: 1, in: "isle", price: 800, art: "d_flowers_b" },
  flamingo:  { name: "Lawn flamingo", w: 1, h: 1, in: "isle", price: 2000 },
  tiki:      { name: "Tiki torch", w: 1, h: 1, in: "isle", price: 1800 },
  campfire:  { name: "Campfire ring", w: 1, h: 1, in: "isle", price: 3000 },
  path:      { name: "Stone path", w: 1, h: 1, in: "isle", price: 150, flat: true },
  gnome:     { name: "Garden gnome", w: 1, h: 1, in: "isle", price: 2500 },
  grill:     { name: "Barbecue grill", w: 1, h: 1, in: "isle", price: 3500 },
  speaker:   { name: "Party speaker", w: 1, h: 1, in: "isle", price: 8000 },
  flag_r:    { name: "Pennant (red)", w: 1, h: 1, in: "isle", price: 5000, art: "d_flag_r" },
  flag_b:    { name: "Pennant (blue)", w: 1, h: 1, in: "isle", price: 5000, art: "d_flag_b" },
  flag_g:    { name: "Pennant (green)", w: 1, h: 1, in: "isle", price: 5000, art: "d_flag_g" },
  beerpong:  { name: "Beer pong table", w: 2, h: 1, in: "isle", price: 6000 },
  hammock:   { name: "Hammock", w: 3, h: 1, in: "isle", price: 6000 },
  fountain:  { name: "Garden fountain", w: 2, h: 2, in: "isle", price: 12000 },
  hottub:    { name: "Hot tub", w: 2, h: 2, in: "isle", price: 25000, max: 1 },
  armchair:  { name: "Armchair", w: 1, h: 1, in: "home", price: 1200, art: "o_armchair" },
  sofa:      { name: "Sofa", w: 2, h: 1, in: "home", price: 3000, art: "o_sofa" },
  fern:      { name: "Potted palm", w: 1, h: 1, in: "home", price: 900, art: "o_plant" },
  lamp:      { name: "Floor lamp", w: 1, h: 1, in: "home", price: 1500 },
  bookshelf: { name: "Bookshelf", w: 1, h: 1, in: "home", price: 2000, wall: true },
  table:     { name: "Dining table", w: 2, h: 1, in: "home", price: 3500 },
  aquarium:  { name: "Aquarium", w: 2, h: 1, in: "home", price: 9000, wall: true },
  tv:        { name: "Big TV", w: 2, h: 1, in: "home", price: 7500, wall: true },
  rug_red:   { name: "Rug (red)", w: 3, h: 2, in: "home", price: 1500, flat: true, art: "d_rug_red" },
  rug_green: { name: "Rug (green)", w: 3, h: 2, in: "home", price: 1500, flat: true, art: "d_rug_green" },
  rug_gold:  { name: "Rug (gold)", w: 3, h: 2, in: "home", price: 1500, flat: true, art: "d_rug_gold" },
  trophies:  { name: "Trophy case", w: 2, h: 1, in: "home", price: 10000, wall: true },
  neon:      { name: "Neon bar sign", w: 1, h: 1, in: "home", price: 6000, wall: true },
  pooltable: { name: "Pool table", w: 3, h: 2, in: "home", price: 18000, max: 1 },
  toilet:    { name: "Gold toilet", w: 1, h: 1, in: "home", price: 50000, max: 1 }
};
const decorArt = (k) => DECOR[k]?.art || `d_${k}`;
/** Which kind of scene this is for decorating: "isle" (an island or its far shore), "home" (the cottage), or null. "at" is what a placed piece records. */
const decorPlace = (key) => { const b = String(key).split(":")[0]; return b === "home" ? "home" : /^isle\d?$/.test(b) || b === "shore" ? "isle" : null; };
const decorAt = (key) => { const b = String(key).split(":")[0]; return b === "home" ? "home" : b === "shore" ? "shore" : "isle"; };
const decorCount = (isle, place) => (isle?.decor || []).filter((d) => DECOR[d.k] && DECOR[d.k].in === place).reduce((n, d) => n + (DECOR[d.k].flat ? 0.25 : 1), 0);
const decorCap = (isle, place) => (place === "home" ? DECOR_CAP.home : DECOR_CAP.isle[isle?.tier || 1]);
const decorSpare = (isle, k) => ((isle?.owned?.[k] | 0) - (isle?.decor || []).filter((d) => d.k === k).length);
/** Lay one owner's pieces for THIS scene over a freshly built one: adds the objects, blocks their tiles. Returns the scene. */
function decorInto(key, built, isle) {
  const at = decorAt(key);
  for (const d of isle?.decor || []) { const P = DECOR[d.k]; if (!P || d.at !== at) continue;
    /* (2026-09-23) THE ID IS THE INDEX, like every other object. buildScene stamps o.id = i over the whole array,
       and decor is pushed AFTER that ran, so these used to carry a hand-set 5000 + n instead. A click sends
       ob.id and the server reads S.objs[m.ob], so a decor piece resolved to S.objs[5000] — undefined — and the
       action was dropped without a word. That was invisible while nothing here could be clicked; the bank chest
       is the first piece meant to DO something, and it did nothing. Anything interactive added to this shop
       later needs the id to keep meaning the index. */
    built.objs.push({ t: P.bank ? "booth" : "decor", decor: true, k: d.k, art: decorArt(d.k), x: d.x, y: d.y, w: P.w, h: P.h, name: P.name, id: built.objs.length, ...(P.flat ? { flat: true, soft: true } : {}) });
    if (!P.flat) for (let y = d.y; y < d.y + P.h; y++) for (let x = d.x; x < d.x + P.w; x++) if (built.g[y]?.[x] !== undefined) built.g[y][x] = "#"; }
  return built;
}
const reachFrom = (g, sx, sy) => { const seen = new Set([sy * G.COLS + sx]), q = [[sx, sy]]; while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of G.D8) { const X = x + dx, Y = y + dy, id = Y * G.COLS + X; if (!seen.has(id) && G.canStepIn(g, x, y, dx, dy)) { seen.add(id); q.push([X, Y]); } } } return seen; };
/** May this piece go here? -> null if it may, or the reason it may not (a sentence for the player). KEY is the scene, ISLE the OWNER's island record. */
function decorFits(key, isle, k, x, y) {
  const P = DECOR[k], place = decorPlace(key), def = G.sceneDef(key); if (!P || !place || !def) return "That can't go here.";
  if (P.in !== place) return P.in === "home" ? "That one is for inside the cottage." : "That one is for outside.";
  if (decorSpare(isle, k) < 1) return "You don't have a spare one of those. Yahsmeena sells them.";
  if (decorCount(isle, place) + (P.flat ? 0.25 : 1) > decorCap(isle, place)) return place === "home" ? "The cottage is full. Pick something up first." : "The island is full. Pick something up first, or buy a bigger island from Charon.";
  if (!Number.isInteger(x) || !Number.isInteger(y)) return "Pick a tile.";
  const now = decorInto(key, G.buildScene(key), isle), at = decorAt(key), e = def.entry || { x: 10, y: 10 };
  if (P.wall && y !== (def.room ? def.room[1] : -1)) return "That one stands against the back wall.";
  for (let Y = y; Y < y + P.h; Y++) for (let X = x; X < x + P.w; X++) {
    if (!G.walkableIn(now.g, X, Y) || "ep".includes(now.g[Y][X])) return "There's no room for it there.";
    if ((X === e.x && Y === e.y) || (def.npcs || []).some((n) => n.x === X && n.y === Y)) return "Not there: somebody needs to stand on that.";
    if (now.objs.some((o) => o.decor && o.flat && !(X < o.x || X >= o.x + o.w || Y < o.y || Y >= o.y + o.h))) return "There's already something lying there.";
  }
  if (P.flat) return null;
  const before = reachFrom(now.g, e.x, e.y), after = decorInto(key, G.buildScene(key), { ...isle, decor: [...(isle.decor || []), { k, x, y, at }] }), then = reachFrom(after.g, e.x, e.y);
  let lost = 0; for (const id of before) if (!then.has(id) && after.g[(id / G.COLS) | 0][id % G.COLS] !== "#") lost++;
  return lost ? "That would wall part of the place off. Leave a way through." : null;
}
  return { DECOR, DECOR_SELLBACK, DECOR_CAP, decorArt, decorPlace, decorAt, decorCount, decorCap, decorSpare, decorInto, decorFits };
}
