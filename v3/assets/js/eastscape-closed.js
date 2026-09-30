/* ============================================================
   EastScape: the CLOSED areas' maps (farm, river, grove, tomato, appia, paddock, rough, highroller, farmhouse, wild, deep)

   They were 22 KB of the rules file that every player downloaded just to log in, for places nobody can walk to (2026-09-21: the
   first load stood at 139.9 of its 140 KB budget). The GAME SERVER registers them at start, so an admin can still teleport
   in, and reopening an area is adding it to OPEN (and moving its map back into the rules file if it should be in everyone's first
   load). The PAGE fetches this file only if it is ever told about a scene it does not know.

   It is HANDED the shared rules and the map-building helpers, createClosedScenes(G, G._MAP); it never imports the big file.
   ============================================================ */

/* (2026-09-26) THE HAND-DRAWN MAPS (the Wilderness and the Deep Wild). fromRows() reads 26 rows of 44 characters into a
   grid; `walls` is the set of rock cells not yet covered by a piece. piece() places a named picture with its footprint on
   rock; deco() a picture with a footprint on open ground (blocking it); rockWall() fills whatever rock is left from a set
   of [picture, w, h], biggest first where it fits, picked by a hash of the spot so the same map always builds the same
   walls on the server and on every page. A piece may hang over the map's right or bottom edge (the picture is clipped),
   never its top or left, so no object ever has a negative tile. */
const hr = (x, y, s) => { const v = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return v - Math.floor(v); };
function fromRows(rows, G) {
  if (rows.length !== G.ROWS || rows.some((r) => r.length !== G.COLS)) throw new Error("a map is 26 rows of 44");
  const g = rows.map((r) => r.split("")), walls = new Set();
  for (let y = 0; y < G.ROWS; y++) for (let x = 0; x < G.COLS; x++) if (g[y][x] === "#") walls.add(`${x},${y}`);
  return { g, objs: [], walls };
}
function piece(g, objs, walls, art, x, y, w, h, name) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = `${x + i},${y + j}`; if (!walls.has(k)) throw new Error(`${art} at ${x},${y} is not on rock at ${k}`); walls.delete(k); }
  objs.push({ t: "cliff", art, x, y, w, h, edge: true, name });
}
function deco(g, objs, art, x, y, w, h, name) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { if (g[y + j][x + i] !== "." && g[y + j][x + i] !== ",") throw new Error(`${art} at ${x},${y} is not on open ground`); g[y + j][x + i] = "#"; }
  objs.push({ t: "cliff", art, x, y, w, h, edge: true, name });
}
/* an animated piece on rock (a waterfall, a lava pool): the footprint stays blocked, its cells leave the wall set */
function animPiece(g, objs, walls, spec) {
  for (let j = 0; j < spec.h; j++) for (let i = 0; i < spec.w; i++) { const k = `${spec.x + i},${spec.y + j}`; if (!walls.has(k)) throw new Error(`${spec.anim} at ${spec.x},${spec.y} is not on rock at ${k}`); walls.delete(k); }
  objs.push({ edge: true, ...spec });
}
function rockWall(g, objs, walls, pieces, seed) {
  const COLS = g[0].length, ROWS = g.length, free = (x, y) => x >= COLS || y >= ROWS || walls.has(`${x},${y}`);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!walls.has(`${x},${y}`)) continue;
    const fits = pieces.filter(([, w, h]) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!free(x + i, y + j)) return false; return true; });
    const r = hr(x, y, seed), [art, w, h] = fits[Math.min(fits.length - 1, Math.floor(r * r * fits.length))];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) walls.delete(`${x + i},${y + j}`);
    objs.push({ t: "cliff", art, x, y, w, h, edge: true, name: w * h >= 6 ? "Cliff" : "Rock" });
  }
}
const WILD_ROCKS = [["x_rock1", 3, 3], ["x_rock2", 3, 2], ["x_rock3", 3, 2], ["x_pillar", 3, 5], ["x_rock4", 2, 2], ["x_rock5", 2, 1], ["x_rock6", 2, 1], ["x_rocks", 3, 1], ["x_boulder1", 2, 1], ["x_boulder2", 1, 1], ["x_boulder3", 1, 1]];
const DEEP_ROCKS = [["d_rock5", 4, 4], ["d_rock6", 3, 4], ["d_pillar", 3, 5], ["d_rock1", 3, 3], ["d_rock4", 3, 3], ["d_rock8", 3, 2], ["d_slab", 3, 2], ["d_rock7", 2, 3], ["d_rock2", 2, 2], ["d_rock3", 2, 2], ["d_boulder1", 1, 1], ["d_boulder2", 1, 1], ["d_boulder3", 1, 1]];

export function createClosedScenes(G, H) {
  const { block, grid, keepOf, room, wild } = H, { COLS, ROWS } = G;
  return {
  farm: {
    name: "Ludus Farm", exits: { e: "river", n: "forum" },
    build() {
      const g = grid(), objs = [];
      for (let x = 13; x < COLS; x++) g[6][x] = ",";
      for (let y = 0; y < 6; y++) g[y][17] = ",";
      for (let y = 5; y < 10; y++) g[y][8] = ",";
      for (let x = 8; x < 14; x++) g[9][x] = ",";
      const house = { t: "house", img: "farmhouse", x: 2, y: 2, w: 5, h: 3, door: { x: 4, y: 4 }, name: "Farmhouse", enter: "farmhouse" }; objs.push(house);
      block(g, house.x, house.y, house.w, house.h);
      objs.push({ t: "well", x: 9, y: 2, name: "Well" }); g[3][9] = "#"; g[3][10] = "#";
      // the pond sits a row down from the top so its bank never runs under the treeline
      objs.push({ t: "pond", x: 12, y: 2, w: 3, h: 2 }); for (let y = 2; y < 4; y++) for (let x = 12; x < 15; x++) g[y][x] = "~";
      objs.push({ t: "hay", x: 7, y: 4, name: "Hay bale" }); g[4][7] = "#";
      // the way down to the Wilderness (PvP): the pit art is two tiles square, so its footprint is too (11,8 to 12,9)
      objs.push({ t: "hole", x: 11, y: 8, w: 2, h: 2, name: "Wilderness pit" }); block(g, 11, 8, 2, 2);
      for (let y = 6; y < 9; y++) for (const x of [2, 3]) { objs.push({ t: "wheat", x, y, name: "Wheat" }); g[y][x] = "#"; }
      for (const [x, y] of [[20, 2], [19, 11], [14, 11]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      objs.push({ t: "oak", x: 17, y: 8, name: "Oak tree" }); g[8][17] = "#";
      // the teaser: a tree you'll walk past for weeks before you can touch it, in its own clearing
      objs.push({ t: "yew", x: 8, y: 2, name: "Ancient Yew", special: true, req: { skill: "woodcutting", lvl: 60 }, log: "yewlogs", xp: 175, tease: "Its golden needles hum as you get close." }); g[2][8] = "#";
      const clearing = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) clearing.push([8 + dx, 2 + dy]);
      wild(g, objs, this.exits, { n: "forest", w: "forest", s: "water", e: "forest" }, [...keepOf(this), ...clearing], 1);
      return { g, objs, blobs: [] };
    },
    mobs: [["cow", 12, 5], ["cow", 19, 4], ["cow", 18, 10]],
    npcs: [{ name: "Bom Trady", art: "tom", quests: ["firewood", "cattle"], outOfWork: "I'm all out of work for you, rookie. You've earned your cleats.", x: 10, y: 5, still: true, hair: "#c86a2a", shirt: "#3a6ac8", pants: "#2a2a4a", lines: ["Mind the cows, gladiator. They blitz.", "Your pickaxe, axe and rod are in your bag. Hold the right one for the job.", "Town's north, through the gate. The river's east.", "Sundays I play. The rest of the week, I farm. Don't ask."] },
           { name: "Waldy", art: "waldy", x: 6, y: 9, hair: "#3a2a1a", shirt: "#8a3a2a", pants: "#4a3a2a", lines: ["Every champion started on cows.", "Hit them until they stop mooing. That's the whole trick.", "The bucket? Keeps the thoughts in.", "Don't go west of town. The olives have opinions."] }],
    bots: [{ name: "Crixus", level: 91, art: "legend" }]
  },
  river: {
    name: "River Bend", exits: { w: "farm" },
    build() {
      const g = grid(), objs = [];
      for (let y = 0; y < ROWS; y++) { if (y && y < ROWS - 1) g[y][16] = "s"; for (let x = 17; x < COLS; x++) g[y][x] = "~"; }
      objs.push({ t: "spot", x: 17, y: 4, name: "Fishing spot" }, { t: "spot", x: 17, y: 8, name: "Fishing spot" });
      objs.push({ t: "spot", x: 17, y: 6, name: "Moonlit Eddy", special: true, glow: "#d8c8ff", req: { skill: "fishing", lvl: 40 }, fish: "mooncarp", xp: 120, tease: "Something silver circles down there. It knows you're watching." });
      for (let x = 0; x < 16; x++) g[6][x] = ",";
      const house = { t: "house", img: "hut", x: 9, y: 1, w: 5, h: 3, door: { x: 11, y: 3 }, name: "Fisher's hut" }; objs.push(house);
      block(g, house.x, house.y, house.w, house.h);
      for (let x = 2; x <= 7; x++) { if (x !== 4) { g[8][x] = "#"; objs.push({ t: "fenceH", x, y: 8 }); } g[11][x] = "#"; }
      for (let y = 9; y <= 10; y++) { g[y][2] = "#"; g[y][7] = "#"; objs.push({ t: "fenceV", x: 2, y }, { t: "fenceV", x: 7, y }); }
      for (const [x, y] of [[3, 2], [14, 9], [6, 3]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      for (const [x, y] of [[9, 9], [10, 10], [11, 9]]) { objs.push({ t: "rock", ore: "copper", x, y, name: "Copper rock" }); g[y][x] = "#"; }
      objs.push({ t: "vein", ore: "copper", x: 12, y: 10, w: 2, h: 2, name: "Copper vein" }); block(g, 12, 10, 2, 2);
      objs.push({ t: "ferry", x: 17, y: 10, w: 2, h: 1, name: "Ferry" });
      // a clearing round the copper, so the rocks aren't buried in the treeline
      const clearing = []; for (let y = 8; y <= 12; y++) for (let x = 8; x <= 14; x++) clearing.push([x, y]);
      // the ferry landing: open shore south of the copper
      for (let y = 9; y <= 12; y++) clearing.push([15, y]);
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "open" }, [...keepOf(this), ...clearing], 2);
      return { g, objs, blobs: [] };
    },
    mobs: [["chicken", 4, 9], ["chicken", 5, 10], ["chicken", 6, 9], ["chicken", 3, 10]],
    npcs: [{ name: "Charon the Ferryman", x: 15, y: 11, still: true, opens: "ferry", hair: "#e8e8e8", shirt: "#3a3a5a", pants: "#2a2a3a", lines: ["Everyone gets an island. Hop on.", "Plant something. It grows while you're gone."] },
      { name: "Old Tullius", art: "tullius", quests: ["catch"], x: 15, y: 6, hair: "#d8d8d8", shirt: "#5a7a3a", pants: "#3a3a2a", lines: ["The fish bite best where the water bubbles.", "Can't fish with a sword, lad. Hold your rod.", "Don't let the chickens fool you. One took my eye.", "That big copper vein never runs dry. Slow, mind."] }],
    bots: [{ name: "Spartacus", level: 77 }]
  },
  grove: {
    name: "Olive Grove", exits: { e: "forum", w: "gloam" },
    build() {
      const g = grid(), objs = [];
      for (let x = 13; x < COLS; x++) g[6][x] = ",";
      for (const [x, y] of [[2, 2], [5, 2], [8, 2], [2, 5], [5, 5], [8, 5], [3, 8], [6, 8]]) { objs.push({ t: "olive", x, y, name: "Olive tree" }); g[y][x] = "#"; }
      for (const [x, y] of [[18, 2], [20, 9], [13, 11]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      objs.push({ t: "olive", x: 18, y: 4, name: "Sun Olive tree", picks: 3, special: true, req: { skill: "farming", lvl: 35 }, crop: "sunolive", xp: 60, tease: "The olives glow like little suns. The Angry Olives won't go near it." }); g[4][18] = "#";
      objs.push({ t: "hive", x: 15, y: 2, name: "Beehive" }, { t: "hive", x: 16, y: 2, name: "Beehive" }); g[2][15] = "#"; g[2][16] = "#";
      objs.push({ t: "shrine", x: 2, y: 10, w: 2, h: 1, name: "Shrine" }); block(g, 2, 10, 2, 1);
      objs.push({ t: "fire", x: 12, y: 8, name: "Campfire" }); g[8][12] = "#";
      for (const [x, y] of [[8, 10], [9, 11], [10, 10]]) { objs.push({ t: "rock", ore: "tin", x, y, name: "Tin rock" }); g[y][x] = "#"; }
      wild(g, objs, this.exits, { w: "water", n: "rocky", s: "forest", e: "forest" }, keepOf(this), 3);
      return { g, objs, blobs: [] };
    },
    mobs: [["olive", 11, 3], ["olive", 13, 4], ["olive", 11, 6], ["boar", 15, 9], ["boar", 17, 4], ["goat", 17, 10]],
    npcs: [],
    bots: [{ name: "Agron", level: 23 }]
  },
  tomato: {
    name: "Tomatoe Hill", exits: { s: "forum", n: "cloud" },
    build() {
      const g = grid(), objs = [];
      for (let y = 6; y < ROWS; y++) g[y][17] = ",";
      for (let x = 3; x <= 17; x++) g[6][x] = ",";
      // two rows of vines, with walking room between them
      for (const y of [8, 10]) for (let x = 3; x <= 8; x++) { objs.push({ t: "vine", x, y, name: "Tomatoe vine", crop: "tomatoe", xp: 10, picks: 3 }); g[y][x] = "#"; }
      objs.push({ t: "bigtomato", x: 10, y: 2, w: 3, h: 3, name: "The Big Tomatoe" }); block(g, 10, 2, 3, 3);
      objs.push({ t: "press", x: 14, y: 3, w: 2, h: 1, name: "Tomatoe press" }); block(g, 14, 3, 2, 1);
      for (const x of [14, 15]) { objs.push({ t: "crate", x, y: 5, name: "Crate of tomatoes" }); g[5][x] = "#"; }
      objs.push({ t: "scarecrow", x: 6, y: 4, name: "Scarecrow" }); g[4][6] = "#";
      // the teaser
      objs.push({ t: "vine", x: 19, y: 3, name: "Golden Tomatoe vine", special: true, glow: "#ffd84a", req: { skill: "farming", lvl: 50 }, crop: "goldtomatoe", xp: 70, picks: 2, tease: "The tomatoes on this one are gold. Actual gold. Nonna guards it with her eyes." }); g[3][19] = "#";
      wild(g, objs, this.exits, { n: "forest", w: "forest", e: "forest", s: "forest" }, keepOf(this), 5);
      return { g, objs, blobs: [] };
    },
    mobs: [["rotten", 12, 8], ["rotten", 14, 10], ["rotten", 11, 11], ["hornworm", 19, 6], ["hornworm", 15, 8]],
    npcs: [{ name: "Nonna Tomatoe", x: 13, y: 7, still: true, hair: "#e8e8e8", shirt: "#c43a3a", pants: "#3a2a2a", lines: ["Tomatoe. With an e. Say it back to me.", "The big one? That's the Big Tomatoe. It was here before the town. Probably before the hill.", "The rotten ones walk at night. And in the day. Mostly they just walk.", "The golden vine is not for you. Not yet. Maybe not ever."] }],
    bots: [{ name: "Oenomaus", level: 38 }]
  },
  appia: {
    name: "Via Appia", exits: { w: "forum" },
    build() {
      const g = grid(), objs = [];
      for (let x = 0; x < 19; x++) for (let y = 5; y <= 7; y++) g[y][x] = "p";
      for (const x of [2, 6, 10, 14]) for (const y of [3, 9]) { objs.push({ t: "cypress", x, y, name: "Cypress" }); g[y][x] = "#"; }
      for (const x of [4, 12]) { objs.push({ t: "milestone", x, y: 4, name: "Milestone" }); g[4][x] = "#"; }
      objs.push({ t: "toll", x: 16, y: 3, w: 2, h: 1, name: "Toll post" }); block(g, 16, 3, 2, 1);
      // the road washed out here; the Bandit Camp is beyond, for later
      for (let y = 4; y <= 8; y++) { objs.push({ t: "barricade", x: 19, y, name: "Barricade" }); g[y][19] = "#"; }
      objs.push({ t: "chariot", x: 8, y: 9, w: 2, h: 1, name: "Abandoned chariot" }); block(g, 8, 9, 2, 1);
      objs.push({ t: "mule", x: 11, y: 10, name: "Mule" }); g[10][11] = "#";
      objs.push({ t: "rock", ore: "marble", x: 3, y: 10, name: "Marble outcrop", special: true, glow: "#ffffff", req: { skill: "mining", lvl: 30 }, xp: 65, tease: "Pure white marble. The Bank was built from this hill. Your pickaxe just bounces." }); g[10][3] = "#";
      wild(g, objs, this.exits, { n: "forest", s: "rocky", w: "forest", e: "forest" }, keepOf(this), 6);
      return { g, objs, blobs: [] };
    },
    mobs: [["highwayman", 5, 2], ["highwayman", 12, 11], ["highwayman", 17, 10]],
    npcs: [{ name: "Centurion Vibius", x: 16, y: 4, still: true, hair: "#3a2a1a", shirt: "#9a2a2a", pants: "#6a5a4a", lines: ["Halt. Toll's waived. The road's closed past the barricade anyway.", "Highwaymen on my road. When you can swing a sword properly, come and see me.", "The Bandit Camp's past the washout. When the road's fixed, we go in.", "That mule has not moved in eleven years. I respect it."] }],
    bots: []
  },
  paddock: {
    name: "The Paddock", wikiHide: true, exits: { w: "casino", e: "rough" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 6; y <= 13; y++) g[y][11] = ","; for (let y = 13; y <= 20; y++) g[y][24] = ",";
      for (const [x, y] of [[15, 9], [16, 9], [28, 17]]) { objs.push({ t: "hay", x, y, name: "Hay bale" }); g[y][x] = "#"; }
      objs.push({ t: "fire", x: 14, y: 16, name: "Campfire" }); g[16][14] = "#";
      for (const [x, y] of [[3, 3], [40, 22], [4, 21], [39, 3], [20, 2]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      objs.push({ t: "sign", x: 40, y: 11, name: "East: the Rough. Bigger things, bigger money. Combat 8 or so." }); g[11][40] = "#";
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "rocky" }, [...keepOf(this), ...keep], 13);
      return { g, objs, blobs: [] };
    },
    // chickens by the gate, cows in the middle, rotten tomatoes at the far end
    mobs: [["chicken", 6, 5], ["chicken", 9, 8], ["chicken", 5, 10], ["chicken", 8, 18], ["chicken", 12, 20], ["chicken", 6, 21],
      ["cow", 19, 6], ["cow", 23, 9], ["cow", 27, 5], ["cow", 21, 19], ["cow", 27, 21],
      ["rotten", 34, 7], ["rotten", 38, 10], ["rotten", 36, 18], ["rotten", 39, 21]],
    npcs: [], bots: []
  },
  rough: {
    name: "The Rough", wikiHide: true, exits: { w: "paddock", e: "boneyard" },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 0; x < COLS; x++) g[13][x] = ",";
      for (let y = 5; y <= 13; y++) g[y][14] = ","; for (let y = 13; y <= 21; y++) g[y][27] = ",";
      objs.push({ t: "fire", x: 6, y: 10, name: "Campfire" }); g[10][6] = "#";
      for (const [x, y] of [[4, 4], [39, 4], [5, 22], [40, 21], [21, 3], [22, 23], [33, 9]]) { objs.push({ t: "tree", x, y, name: "Tree" }); g[y][x] = "#"; }
      for (const [x, y] of [[18, 8], [31, 18], [36, 6]]) { objs.push({ t: "boulder", x, y, name: "Boulder" }); g[y][x] = "#"; }
      for (let x = 0; x < COLS; x++) keep.push([x, 12], [x, 14]);
      objs.push({ t: "sign", x: 41, y: 11, name: "East: the Boneyard. Things that were buried for a reason. Combat 20 at the very least." }); g[11][41] = "#";
      wild(g, objs, this.exits, { n: "rocky", s: "forest", w: "forest", e: "rocky" }, [...keepOf(this), ...keep], 21);
      return { g, objs, blobs: [] };
    },
    // hornworms and boars by the gate, highwaymen (who carry actual tickets) in the middle, two gnashers at the far end
    mobs: [["hornworm", 7, 6], ["hornworm", 10, 18], ["hornworm", 5, 19], ["boar", 12, 8], ["boar", 17, 17], ["boar", 19, 6], ["boar", 15, 21],
      ["highwayman", 25, 7], ["highwayman", 29, 10], ["highwayman", 24, 19], ["highwayman", 31, 20], ["highwayman", 34, 15],
      ["gnasher", 37, 6], ["gnasher", 38, 20]],
    npcs: [], bots: []
  },
  highroller: {
    name: "The High Roller Room", interior: true, floor: "casino", wallH: 34, room: [11, 6, 32, 19], exitTo: { scene: "fightpit", x: 22, y: 5 }, entry: { x: 21, y: 19 },
    limits: { min: 100, mult: 10 }, door: { cash: 2500 },
    wall: [{ t: "lamp", x: 12.5 }, { t: "painting2", x: 15.5, dy: 5 }, { t: "lamp", x: 18.5 }, { t: "neon", x: 21.5, dy: 16 }, { t: "lamp", x: 24.5 }, { t: "painting1", x: 27.5, dy: 7, frame: true }, { t: "lamp", x: 30.5 }],
    build() {
      const g = room(11, 6, 32, 19, 21), objs = [];
      const put = (t, x, y, name, w = 1, extra = {}) => { objs.push({ t, x, y, ...(w > 1 ? { w, h: 1 } : {}), name, ...extra }); block(g, x, y, w, 1); };
      const seat = (x, y) => { if (g[y][x] === "i") objs.push({ t: "stool", x, y, name: "Stool", soft: true }); };
      put("cointable", 13, 9, "High-limit Coin Flip", 2); put("cointable", 13, 13, "High-limit Coin Flip", 2);
      put("dicetable", 17, 11, "High-limit Dice", 2); put("wheel", 17, 15, "High-limit Wheel", 2, { art: "o_prizewheel" });
      put("hilo", 25, 9, "High-limit Higher or Lower", 2); put("hilo", 25, 13, "High-limit Higher or Lower", 2);
      put("mines", 29, 9, "High-limit Mines", 2); put("plinko", 29, 13, "High-limit Plinko", 2); put("scratch", 29, 16, "High-limit Scratch-Off", 2);
      for (const [x, y] of [[13, 10], [14, 10], [13, 14], [14, 14], [17, 12], [18, 12], [25, 10], [26, 10], [25, 14], [26, 14], [17, 16], [18, 16]]) seat(x, y);
      // the lounge in the middle: somewhere to sit and be seen, and the good buffet
      put("cocktail", 21, 10, "Cocktail table"); put("cocktail", 22, 13, "Cocktail table");
      for (const [x, y] of [[20, 10], [22, 10], [21, 13], [23, 13]]) if (g[y][x] === "i") objs.push({ t: "armchair", x, y, name: "Armchair", soft: true });
      put("buffet", 19, 6, "The good buffet", 2); put("cooler", 21, 6, "Sparkling water"); put("atm", 31, 6, "tickets machine (it only takes)"); put("piano", 23, 6, "Piano", 2);
      put("planter", 11, 6, "Planter", 2); put("planter", 11, 19, "Planter", 2); put("planter", 31, 19, "Planter", 2); put("coatrack", 32, 12, "Coat rack"); put("suitcase", 12, 17, "Somebody's suitcase. It's heavy.");
      for (const [x, y] of [[16, 8], [24, 17], [28, 11]]) if (g[y][x] === "i") objs.push({ t: "l_chips", x, y, name: "Dropped chips", soft: true, flat: true });
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [{ name: "MaxBetMarv", level: 58 }, { name: "WhaleWatcher", level: 41 }],
    npcs: [{ name: "Sterling the Host", art: "sterling", x: 21, y: 17, still: true, hair: "#d8d8e0", shirt: "#f4f0e8", pants: "#1a1a1a", lines: ["Welcome to the room. Same games, ten times the limits, and nobody out there can hear you scream.", "A hundred dollars is the smallest bet at any table in here. If that stings, the door's behind you, and no hard feelings.", "A word on luck and dinners: they cover the first $1,500 of a bet. Past that you're on your own, like the rest of us.", "The buffet is better in here. That isn't a secret, it's the whole point.", "Biggest pot I've seen walk out of here was on Mines. Biggest I've seen walk IN, too."] }]
  },
  farmhouse: {
    name: "The Farmhouse", interior: true, floor: "wood", room: [6, 4, 15, 10], exitTo: { scene: "farm", x: 4, y: 5 }, entry: { x: 10, y: 10 },
    wall: [{ t: "herbs", x: 9.5 }, { t: "shelf", x: 11.5 }, { t: "window", x: 13.5 }],
    build() {
      const g = room(6, 4, 15, 10, 10), objs = [];
      objs.push({ t: "rug", x: 9, y: 5, w: 5, h: 4, color: "#6a7a3a", name: "Rug" });
      objs.push({ t: "range", x: 7, y: 4, w: 2, h: 1, name: "Range" }); block(g, 7, 4, 2, 1);
      objs.push({ t: "table", x: 10, y: 6, w: 3, h: 2, name: "Table" }); block(g, 10, 6, 3, 2);
      objs.push({ t: "barrel", x: 15, y: 4, name: "Barrel" }); g[4][15] = "#";
      objs.push({ t: "barrel", x: 14, y: 4, name: "Barrel" }); g[4][14] = "#";
      objs.push({ t: "bed", x: 6, y: 8, w: 1, h: 2, name: "Bed" }); block(g, 6, 8, 1, 2);
      for (const x of [9, 13]) { objs.push({ t: "chair", x, y: 7, name: "Stool" }); g[7][x] = "#"; }
      objs.push({ t: "sack", x: 6, y: 5, name: "Flour sack" }); g[5][6] = "#";
      objs.push({ t: "cat", x: 7, y: 9, name: "Cat" }); g[9][7] = "#";
      objs.push({ t: "bucket", x: 15, y: 9, name: "Bucket" }); g[9][15] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [{ name: "Cassia", x: 12, y: 9, still: true, hair: "#8a3a1a", shirt: "#e8e0c8", pants: "#6a5a4a", lines: ["Mind the range, it's hot. Cooking lessons start soon.", "Bom eats like three gladiators.", "If you catch fish, I can teach you to cook them. Soon."] }]
  },
  /* (2026-09-26) THE WILDERNESS AND THE DEEP WILD, REBUILT (the owner: "attractive yet dangerous... spread out ores/logs/
     altars and any skilling nodes far apart... inhabited with more enemies, and dangerous ones at the very best places...
     the roads need to be not straight lines... some strategy to pathing instead of just clicking the furthest tile away...
     way too open"). Both are DRAWN below, one character a tile, rather than scattered by wild(): a wall is where the
     strategy is, so the walls are placed on purpose. The art is Szadi art's RPG Fantasy Worlds SET1 (the Wilderness) and
     SET3 (the Deep Wild), cut by tools/eastscape-wild-art.mjs; the ground themes are GROUNDS.wild / .deep in the page.
       .  ground    ,  a trodden path (decoration: the walker does not care)    ~  water    s  the Cage's floor    #  rock
     A few named pieces (a plateau, a column, a cave mouth) are placed by hand with their footprints; every other # is
     filled by rockWall() from the area's rock set, biggest piece that fits, chosen by a hash of the spot, so a wall reads
     as stacked rock rather than one tile repeated. A rock is `edge: true` (scenery: nothing to click) and carries its
     footprint as w/h, which is what the page anchors the picture by. tools/eastscape-wild-check.mjs walks both maps:
     every open tile reachable from the exits, every monster and node on open ground, every piece on rock. */
  wild: {
    name: "The Wilderness", pvp: true, exits: { n: "deep" }, entry: { x: 3, y: 10 }, tint: "rgba(60,20,70,.2)", ground: "wild",
    cage: [6, 3, 12, 6], cageOut: { x: 9, y: 9 },
    rows: [
      "############################################",
      "####################.,...###################",
      "###............#####.,...########.........##",
      "###...sssssss..#####.,...########.........##",
      "###...sssssss..#####.,...########.........##",
      "###...sssssss..#####.,...######,,,,.......##",
      "###...sssssss..##,,,,,......###...........##",
      "###............##,....,,,,,,,,..############",
      "###...,,,........,...........,..############",
      "#................,.######....,..############",
      "#..,,,,,,,,..,,,,,.######....,..############",
      "#.........,,,,.....######....,..############",
      "#..................######....,..############",
      "#####...........,.#######....,..############",
      "###############.,.#######....,....##########",
      "###############.,.#######....,,,,.##########",
      "###############.,.#######...###.,..#########",
      "#####....###....,..........###..,..........#",
      "#####....###....###.......######...........#",
      "#####...~~~~~...###.......######...........#",
      "#####...~~~~~...###.......######...........#",
      "#####...~~~~~..####.......######...........#",
      "#####..........####.......######...........#",
      "#####..........####.......######...........#",
      "############################################",
      "############################################"
    ],
    build() {
      const { g, objs, walls } = fromRows(this.rows, G);
      for (let x = 21; x <= 23; x++) g[0][x] = "e";
      /* the landmarks: the plateau the whole middle bends round, a rock column in the south, a cave mouth in the north wall */
      piece(g, objs, walls, "x_plateau", 19, 9, 6, 8, "Plateau"); piece(g, objs, walls, "x_column", 26, 18, 5, 6, "Rock column"); piece(g, objs, walls, "x_cave", 26, 1, 5, 4, "Cave mouth");
      /* the waterfall: three wide off the north wall of the pool pocket, its splash a tile into the water (pad: 1) */
      animPiece(g, objs, walls, { t: "waterfall", anim: "a_wfall_w", frames: 8, cols: 4, fw: 160, fh: 128, fps: 9, pad: 1, x: 9, y: 17, w: 3, h: 2, name: "Waterfall" });
      objs.push({ t: "rope", x: 2, y: 10, name: "Rope" }); g[10][2] = "#";
      // the Cage: iron bars round a ring, one gap at the bottom
      for (let x = 5; x <= 13; x++) { objs.push({ t: "cageH", x, y: 2 }); g[2][x] = "#"; if (x !== 9) { objs.push({ t: "cageH", x, y: 7 }); g[7][x] = "#"; } }
      for (let y = 3; y <= 6; y++) for (const x of [5, 13]) { objs.push({ t: "cageV", x, y }); g[y][x] = "#"; }
      objs.push({ t: "cagesign", x: 8, y: 8, name: "The Cage" }); g[8][8] = "#";
      /* what is worth the walk, each in its own pocket: the grove (north-east), the grimstone (south-east), the pool (south-west) */
      /* (2026-09-26, later) THE POCKETS PAY FOR THE WALK. Every node here was level-20 material while the pockets are held by
         level 45-58 monsters, so the far corners now carry what the Boneyard and Cloudreach carry: an Ancient yew in the grove,
         dragonstone in the south-east, mooncarp under the gloomfin. One grimstone and one deadwood stay for the level-20s. */
      for (const [x, y] of [[35, 3], [39, 2]]) { objs.push({ t: "deadtree", x, y, name: "Deadwood tree", log: "ashlogs", req: { skill: "woodcutting", lvl: 20 }, xp: 70, tease: "Grey, hard as bone. Your axe just bounces." }); g[y][x] = "#"; }
      objs.push({ t: "yew", x: 37, y: 5, log: "yewlogs", name: "Ancient yew", req: { skill: "woodcutting", lvl: 35 }, xp: 170 }); g[5][37] = "#";
      objs.push({ t: "rock", ore: "grimstone", x: 36, y: 19, name: "Grimstone rock", req: { skill: "mining", lvl: 20 }, xp: 60, tease: "Cold purple stone. Your pickaxe skids right off." }); g[19][36] = "#";
      for (const [x, y] of [[40, 20], [38, 22]]) { objs.push({ t: "rock", ore: "dragonstone_ore", x, y, name: "Dragonstone rock", req: { skill: "mining", lvl: 40 }, xp: 95 }); g[y][x] = "#"; }
      for (const x of [9, 11]) objs.push({ t: "spot", x, y: 20, name: "Dead pool", req: { skill: "fishing", lvl: 20 }, fish: "gloomfin", fish2: "mooncarp", fish2lvl: 40, xp: 80, xp2: 150, glow: "#b080ff", tease: "The water is black and very still. Something down there is even stiller." });
      /* rocks in the open, so no road is a straight line; then the dead trees, the bones and the tufts */
      for (const [art, x, y, w, h] of [["x_rock2", 6, 11, 3, 2], ["x_rock4", 11, 9, 2, 2], ["x_boulder2", 14, 12, 1, 1], ["x_boulder3", 1, 12, 1, 1], ["x_boulder3", 16, 8, 1, 1], ["x_rock5", 24, 8, 2, 1], ["x_rock5", 26, 12, 2, 1], ["x_boulder2", 30, 10, 1, 1],
        ["x_rock4", 21, 20, 2, 2], ["x_boulder1", 23, 18, 2, 1], ["x_rocks", 33, 22, 3, 1], ["x_rock5", 38, 20, 2, 1], ["x_boulder1", 41, 19, 2, 1], ["x_boulder3", 20, 6, 1, 1], ["x_boulder2", 5, 20, 1, 1]]) deco(g, objs, art, x, y, w, h, "Rock");
      for (const [art, x, y] of [["x_dead1", 3, 3], ["x_dead2", 41, 3], ["x_pine1", 33, 6], ["x_pine2", 15, 8], ["x_dead3", 24, 17], ["x_pine3", 19, 18], ["x_dead4", 41, 17], ["x_dead5", 35, 23], ["x_dead2", 5, 23], ["x_shrub2", 5, 18], ["x_shrub1", 25, 11], ["x_shrub2", 30, 9], ["x_stump", 13, 13], ["x_dead4", 27, 6], ["x_pine3", 10, 8]]) deco(g, objs, art, x, y, 1, 1, "Dead tree");
      for (const [x, y] of [[24, 7], [17, 6], [23, 22], [34, 18]]) { objs.push({ t: "gravestone", x, y, name: "Gravestone" }); g[y][x] = "#"; }
      for (const [x, y] of [[26, 8], [20, 18]]) { objs.push({ t: "skeleton", x, y, name: "Skeleton" }); g[y][x] = "#"; }
      for (const [art, x, y] of [["x_tuft1", 7, 9], ["x_tuft2", 23, 19], ["x_tuft3", 36, 21], ["x_tuft1", 3, 11], ["x_tuft2", 29, 13], ["x_tuft3", 21, 4], ["x_tuft1", 39, 4], ["x_tuft2", 14, 19]]) objs.push({ t: "tuft", art, x, y, w: 1, h: 1, edge: true, flat: true, name: "Grass" });
      rockWall(g, objs, walls, WILD_ROCKS, 7);
      G.markBanks(g);
      return { g, objs, blobs: [] };
    },
    /* the entry pocket is gnashers; ghouls and wraiths hold the halls; the pockets are held by what they are worth */
    /* (2026-09-27, the owner: "33% of wilderness mobs need to be aggressive, especially those near nodes... slower respawn times (varying
       between 45 seconds - 2 minutes)") Every placement carries its own respawn range, and about a third carry an aggro radius: the
       ones holding the yew, the dragonstone, the pool and the exit. 9 of 25 here. */
    mobs: [["gnasher", 5, 10, { respawn: [45000, 75000] }], ["gnasher", 13, 11, { respawn: [50000, 90000] }], ["gnasher", 10, 12, { respawn: [60000, 100000] }],
      ["ghoul", 19, 7, { respawn: [45000, 80000] }], ["ghoul", 25, 7, { respawn: [70000, 120000] }], ["ghoul", 21, 19, { respawn: [55000, 95000] }], ["ghoul", 24, 22, { respawn: [45000, 90000] }], ["ghoul", 6, 19, { aggro: 3, respawn: [60000, 110000] }], ["ghoul", 14, 22, { respawn: [50000, 100000] }],
      ["taxwraith", 28, 10, { respawn: [45000, 85000] }], ["taxwraith", 30, 12, { respawn: [65000, 120000] }], ["taxwraith", 34, 5, { aggro: 3, respawn: [55000, 100000] }], ["taxwraith", 16, 15, { respawn: [45000, 75000] }],
      ["usher", 22, 3, { aggro: 3, respawn: [60000, 120000] }], ["usher", 38, 4, { respawn: [50000, 90000] }], ["usher", 36, 2, { respawn: [70000, 110000] }],
      ["revenant", 40, 6, { aggro: 4, respawn: [75000, 120000] }], ["revenant", 37, 21, { aggro: 4, respawn: [60000, 105000] }], ["revenant", 41, 22, { respawn: [80000, 120000] }], ["revenant", 20, 21, { respawn: [50000, 95000] }],
      ["wolf", 39, 18, { aggro: 5, respawn: [90000, 120000] }],
      ["weaver", 41, 5, { aggro: 4, respawn: [80000, 120000] }], ["weaver", 14, 20, { aggro: 4, respawn: [70000, 115000] }],
      ["marrowhound", 34, 19, { aggro: 5, respawn: [75000, 120000] }], ["marrowhound", 40, 22, { respawn: [60000, 100000] }]],

    npcs: [], bots: []
  },
  /* (2026-09-27) THE DEPTHS OF THE MOUNTAIN, the massive update's first new map (EASTSCAPE-MAPS.md's Scrap Line, re-themed by the
     owner on Rafael Matos's "Depths of the Mountain" pack). Between the Thunderhead (south) and the Trailer Park (east), combat 73-84.
     THE THIRD BUILD, the owner: "design it like the reference image i gave you" and "theres no boss like in the screenshot at the end
     of the map, add him". The ground is THE PACK'S OWN PICTURE (`bgArt`, the two halves lt-wild/depths-compose.mjs cuts from the
     pack's mockups): the throne room the boss rises in at the far end, the gold-statue bridge, the owner's reference plaza and wings,
     the landing and the sand bridge east. `rows` is only where you can walk on it (lt-wild/depths-walk2.py, drawn over the picture);
     the pictures do all the showing. The way on to the Trailer Park is the sand bridge, off the EAST edge. */
  /* ---------------------------------------------------------------- THE BOARDWALK (2026-09-27, the massive update, 5 of 8)
     A drowned seaside market west of the Carnival, on Rafael Matos's "ERW - Sea Adventures": the ground is the pack's own picture
     (bw_bg1 / bw_bg2, composed by lt-wild/compose-rects.mjs from its market-and-pier mockups), so it draws no banks, no tufts and no
     tiles of its own. The beach and its palms on the left, the pier off it to the market's bank, the stalls on the stone plaza, the pier
     network out over the water with the boats, and the grass at the east edge back to the Carnival. Fishing 60-84, combat 66-80. */
  /* (2026-09-27) THE BOARDWALK, REBUILT AS ISLANDS (the owner: "it will be multiples of scenes that are mostly smaller land areas
     surrounded by water ... all of these need entries and exits"): the Market: the ship, the stalls and the piers, where the rowboats start. Composed from the Sea pack's mockup (lt-wild/isle-boardwalk.json);
     where you can walk is lt-wild/isle-blocks.json. The rowboats carry you along the chain; the pack's own animations move the sea,
     the palms and the boats. A boat is drawn with its near end against the land it is tied to (ox/oy), so it lies out over the water. */
  boardwalk: {
    name: "The Boardwalk", exits: { e: "carnival" }, arrive: { e: { x: 41, y: 6 } }, bgArt: ["boardwalk_bg1", "boardwalk_bg2"], noBanks: true, ground: "sea", miniWater: "#2a7fc0", tint: "rgba(10,40,70,.10)", boatIsle: true,
    rows: [
          "...##...........####..####..................",
          ".####.........######..#####.................",
          "..............#######.#####.................",
          "..............##............................",
          ".......##..................................e",
          ".......##.####..####.####..................e",
          ".......#############.#####.................e",
          ".......###################.................e",
          ".......###################.................e",
          "###############.............................",
          "###############.............................",
          "###############.............................",
          "###############.............................",
          "###############....~~~~~~~~~~~~~~~~~~~~~~~~~",
          "###############....~~~~~~~~~~~~~~~~~~~~~~~~~",
          "###############....~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~...~~~~~~~....~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~..............~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~..............~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~..............~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~...~~~~~~~....~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~..........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~..........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~........~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~...~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~...~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "spot", x: 8, y: 24, name: "The Inlet", req: { skill: "fishing", lvl: 60 }, fish: "mackerel", fish2: "bluefin", fish2lvl: 72, xp: 230, xp2: 290, glow: "#6ad8ff" });
      objs.push({ t: "spot", x: 12, y: 22, name: "The Inlet", req: { skill: "fishing", lvl: 60 }, fish: "mackerel", fish2: "bluefin", fish2lvl: 72, xp: 230, xp2: 290, glow: "#6ad8ff" });
      objs.push({ t: "spot", x: 19, y: 16, name: "The Inlet", req: { skill: "fishing", lvl: 60 }, fish: "mackerel", fish2: "bluefin", fish2lvl: 72, xp: 230, xp2: 290, glow: "#6ad8ff" });
      objs.push({ t: "yew", art: "bw_palm1", anim: "bw_palm1a", frames: 10, cols: 10, fw: 107, fh: 169, fps: 7, h: 1, ox: -31.5, oy: -57.0, phase: 0, x: 33, y: 3, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[3][33] = "#";
      objs.push({ t: "yew", art: "bw_palm2", anim: "bw_palm2a", frames: 10, cols: 10, fw: 70, fh: 127, fps: 7, h: 1, ox: -16.0, oy: -37.0, phase: 9, x: 39, y: 2, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[2][39] = "#";
      objs.push({ t: "yew", art: "bw_palm3", anim: "bw_palm3a", frames: 10, cols: 10, fw: 77, fh: 143, fps: 7, h: 1, ox: -7.5, oy: -44.5, phase: 5, x: 36, y: 11, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[11][36] = "#";
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: 0, oy: -10.75, phase: 11, x: 19, y: 20, name: "Rowboat to Cabin Coast", row: { to: "bw_cabin", x: 25, y: 10 } });
      objs.push({ t: "range", x: 26, y: 4, name: "The Chip Shop" }); g[4][26] = "#";
      /* (2026-09-27) the clutter, the flags and the banners: the Sea pack's own props. A flat one lies on the ground and can be walked over. */
      objs.push({ t: "cliff", edge: true, art: "bw_d_fishcrate", x: 26, y: 9, name: "fishcrate" }); g[9][26] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_barrel", x: 27, y: 2, name: "barrel" }); g[2][27] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_fishbarrel", x: 29, y: 9, name: "fishbarrel" }); g[9][29] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_basket", x: 31, y: 9, name: "basket" }); g[9][31] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_crate", x: 15, y: 20, name: "crate" }); g[20][15] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_bigcrate", x: 2, y: 22, name: "bigcrate" }); g[22][2] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_rope", x: 16, y: 14, name: "rope", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_fish", x: 6, y: 18, name: "fish", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_coconut", x: 34, y: 5, name: "coconut", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_shells1", x: 40, y: 11, name: "shells1", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_banner", frames: 12, cols: 12, fw: 85, fh: 107, fps: 8, h: 1, ox: -24.0, oy: -35.5, phase: 4, x: 33, y: 7, name: "banner" }); g[7][33] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_flag", frames: 8, cols: 8, fw: 70, fh: 76, fps: 8, h: 1, ox: 6.5, oy: -21.5, phase: 1, x: 3, y: 10, name: "flag" }); g[10][3] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["gull", 24, 14, { perch: true, respawn: G.levelRespawn("gull") }], ["gull", 32, 15, { perch: true, respawn: G.levelRespawn("gull") }], ["gull", 38, 14, { perch: true, respawn: G.levelRespawn("gull") }], ["gull", 10, 16, { perch: true, respawn: G.levelRespawn("gull") }], ["deckhand", 30, 4, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 36, 8, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 12, 2, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 22, 10, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 40, 3, { respawn: G.levelRespawn("deckhand") }]],
    npcs: [{ name: "Salty Meg", art: "saltymeg", x: 27, y: 6, still: true, quests: ["bwmackerel", "bwdeckhands", "bwcaptain"], hair: "#6a3a1e", shirt: "#3a5a8a", pants: "#3a3a3a",
      lines: ["Fish, chips, and a knife in the counter most mornings. Welcome to the Boardwalk.", "The rowboat off the end of the long pier goes to Cabin Coast, and every island's boat goes on to the next: the Lighthouse, the wreck, the pirates' pier, and Skull Isle last.", "The gulls hang over the water where you can't reach them. Bring a bow.", "The captain keeps to Skull Isle. He sends the deckhands so he needn't get sand on the coat."] }],
    bots: []
  },
  /* (2026-09-27) THE BOARDWALK, REBUILT AS ISLANDS (the owner: "it will be multiples of scenes that are mostly smaller land areas
     surrounded by water ... all of these need entries and exits"): a cabin on the coast, its wagon and its palms. Composed from the Sea pack's mockup (lt-wild/isle-bw_cabin.json);
     where you can walk is lt-wild/isle-blocks.json. The rowboats carry you along the chain; the pack's own animations move the sea,
     the palms and the boats. A boat is drawn with its near end against the land it is tied to (ox/oy), so it lies out over the water. */
  bw_cabin: {
    name: "Cabin Coast", bgArt: ["bw_cabin_bg1", "bw_cabin_bg2"], noBanks: true, ground: "sea", miniWater: "#2a7fc0", tint: "rgba(10,40,70,.10)", boatIsle: true,
    rows: [
          "###############...###.......................",
          "################..###.......................",
          "################............................",
          "################...#........................",
          "################.#.#........................",
          "...####...#####....#...~....................",
          "##.##.................~~....~...............",
          "##............#####~~~~~....~~~~~~~~~~~~~~~~",
          "##..####...#######.~~~~~....~~~~~~~~~~~~~~~~",
          "#########..........~~~~~....~~~~~~~~~~~~~~~~",
          "....####..........~~~~~~....~~~~~~~~~~~~~~~~",
          "###.####......###.~~~~~~~~~~~~~~~~~~~~~~~~~~",
          ".........#....###.~~~~~~~~~~~~~~~~~~~~~~~~~~",
          ".........#.........~~~~~~~~~~~~~~~~~~~~~~~~~",
          "...#................~~~~~~~~~~~~~~~~~~~~~~~~",
          "...#..#..............~~~~~~~~~~~~~~~~~~~~~~~",
          "......#..............~~~~~~~~~~~~~~~~~~~~~~~",
          "....................~~~~~~~~~~~~~~~~~~~~~~~~",
          "...............~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          ".....~~.......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~..~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "spot", x: 19, y: 13, name: "The Inlet", req: { skill: "fishing", lvl: 60 }, fish: "mackerel", fish2: "bluefin", fish2lvl: 72, xp: 230, xp2: 290, glow: "#6ad8ff" });
      objs.push({ t: "spot", x: 14, y: 19, name: "The Inlet", req: { skill: "fishing", lvl: 60 }, fish: "mackerel", fish2: "bluefin", fish2lvl: 72, xp: 230, xp2: 290, glow: "#6ad8ff" });
      objs.push({ t: "yew", art: "bw_palm1", anim: "bw_palm1a", frames: 10, cols: 10, fw: 107, fh: 169, fps: 7, h: 1, ox: -31.5, oy: -57.0, phase: 9, x: 11, y: 14, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[14][11] = "#";
      objs.push({ t: "yew", art: "bw_palm2", anim: "bw_palm2a", frames: 10, cols: 10, fw: 70, fh: 127, fps: 7, h: 1, ox: -16.0, oy: -37.0, phase: 7, x: 8, y: 17, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[17][8] = "#";
      objs.push({ t: "yew", art: "bw_palm3", anim: "bw_palm3a", frames: 10, cols: 10, fw: 77, fh: 143, fps: 7, h: 1, ox: -7.5, oy: -44.5, phase: 9, x: 13, y: 16, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[16][13] = "#";
      objs.push({ t: "rock", ore: "starfall_ore", art: "bw_rock_starfall", x: 24, y: 2, name: "Starfall rock", req: { skill: "mining", lvl: 60 }, xp: 150 }); g[2][24] = "#";
      objs.push({ t: "rock", ore: "starfall_ore", art: "bw_rock_starfall", x: 30, y: 3, name: "Starfall rock", req: { skill: "mining", lvl: 60 }, xp: 150 }); g[3][30] = "#";
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: -30.75, oy: 0, phase: 8, x: 25, y: 11, name: "Rowboat to the Market", row: { to: "boardwalk", x: 18, y: 19 } });
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: 0, oy: -10.75, phase: 9, x: 21, y: 16, name: "Rowboat to the Lighthouse", row: { to: "bw_light", x: 13, y: 15 } });
      
      /* (2026-09-27) the clutter, the flags and the banners: the Sea pack's own props. A flat one lies on the ground and can be walked over. */
      objs.push({ t: "cliff", edge: true, art: "bw_d_barrel", x: 16, y: 2, name: "barrel" }); g[2][16] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_sandcrate", x: 17, y: 13, name: "sandcrate" }); g[13][17] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_sandbarrel", x: 12, y: 18, name: "sandbarrel" }); g[18][12] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_basket", x: 21, y: 4, name: "basket" }); g[4][21] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_shells1", x: 10, y: 18, name: "shells1", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_rope", x: 18, y: 16, name: "rope", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_coconut", x: 7, y: 13, name: "coconut", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_stranded", x: 8, y: 19, name: "stranded", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_banner", frames: 12, cols: 12, fw: 85, fh: 107, fps: 8, h: 1, ox: -24.0, oy: -35.5, phase: 1, x: 24, y: 1, name: "banner" }); g[1][24] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["deckhand", 10, 15, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 22, 3, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 35, 3, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 5, 12, { respawn: G.levelRespawn("deckhand") }], ["gull", 22, 15, { perch: true, respawn: G.levelRespawn("gull") }], ["gull", 30, 9, { perch: true, respawn: G.levelRespawn("gull") }], ["gull", 12, 20, { perch: true, respawn: G.levelRespawn("gull") }]],
    npcs: [],
    bots: []
  },
  /* (2026-09-27) THE BOARDWALK, REBUILT AS ISLANDS (the owner: "it will be multiples of scenes that are mostly smaller land areas
     surrounded by water ... all of these need entries and exits"): a lighthouse and its keeper's cottage. Composed from the Sea pack's mockup (lt-wild/isle-bw_light.json);
     where you can walk is lt-wild/isle-blocks.json. The rowboats carry you along the chain; the pack's own animations move the sea,
     the palms and the boats. A boat is drawn with its near end against the land it is tied to (ox/oy), so it lies out over the water. */
  bw_light: {
    name: "The Lighthouse", bgArt: ["bw_light_bg1", "bw_light_bg2"], noBanks: true, ground: "sea", miniWater: "#2a7fc0", tint: "rgba(10,40,70,.10)", boatIsle: true,
    rows: [
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~######~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~######~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~######~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~######~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~######~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~##~~~######~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~.##########...~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~..##########....~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~..############...~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~...##########...~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~....##########..~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~....##########..~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~...###########..~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~.................~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~................~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~.###..........~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~...........~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "spot", x: 18, y: 19, name: "Pier End", req: { skill: "fishing", lvl: 72 }, fish: "bluefin", fish2: "swordfish", fish2lvl: 84, xp: 290, xp2: 340, glow: "#6ad8ff" });
      objs.push({ t: "spot", x: 30, y: 11, name: "Pier End", req: { skill: "fishing", lvl: 72 }, fish: "bluefin", fish2: "swordfish", fish2lvl: 84, xp: 290, xp2: 340, glow: "#6ad8ff" });
      objs.push({ t: "rock", ore: "starfall_ore", art: "bw_rock_starfall", x: 15, y: 10, name: "Starfall rock", req: { skill: "mining", lvl: 60 }, xp: 150 }); g[10][15] = "#";
      objs.push({ t: "rock", ore: "eclipse_ore", art: "bw_rock_eclipse", x: 26, y: 17, name: "Eclipse rock", req: { skill: "mining", lvl: 70 }, xp: 210 }); g[17][26] = "#";
      objs.push({ t: "yew", art: "bw_palm2", anim: "bw_palm2a", frames: 10, cols: 10, fw: 70, fh: 127, fps: 7, h: 1, ox: -16.0, oy: -37.0, phase: 4, x: 14, y: 12, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[12][14] = "#";
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: -61.5, oy: -10.75, phase: 13, x: 12, y: 15, name: "Rowboat to Cabin Coast", row: { to: "bw_cabin", x: 20, y: 16 } });
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: 0, oy: -10.75, phase: 4, x: 30, y: 16, name: "Rowboat to Shipwreck Isle", row: { to: "bw_wreck", x: 12, y: 11 } });
      
      /* (2026-09-27) the clutter, the flags and the banners: the Sea pack's own props. A flat one lies on the ground and can be walked over. */
      objs.push({ t: "cliff", edge: true, art: "bw_d_barrel", x: 17, y: 15, name: "barrel" }); g[15][17] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_fishbarrel", x: 21, y: 15, name: "fishbarrel" }); g[15][21] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_crate", x: 25, y: 16, name: "crate" }); g[16][25] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_shells2", x: 14, y: 17, name: "shells2", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_rope", x: 22, y: 18, name: "rope", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_bones", x: 19, y: 18, name: "bones", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_flag", frames: 8, cols: 8, fw: 70, fh: 76, fps: 8, h: 1, ox: 6.5, oy: -21.5, phase: 2, x: 28, y: 14, name: "flag" }); g[14][28] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["clawhand", 20, 16, { respawn: G.levelRespawn("clawhand") }], ["clawhand", 15, 13, { respawn: G.levelRespawn("clawhand") }], ["clawhand", 27, 12, { respawn: G.levelRespawn("clawhand") }], ["gull", 11, 13, { perch: true, respawn: G.levelRespawn("gull") }], ["gull", 32, 9, { perch: true, respawn: G.levelRespawn("gull") }]],
    npcs: [],
    bots: []
  },
  /* (2026-09-27) THE BOARDWALK, REBUILT AS ISLANDS (the owner: "it will be multiples of scenes that are mostly smaller land areas
     surrounded by water ... all of these need entries and exits"): a ship broken in two on a sandbar. Composed from the Sea pack's mockup (lt-wild/isle-bw_wreck.json);
     where you can walk is lt-wild/isle-blocks.json. The rowboats carry you along the chain; the pack's own animations move the sea,
     the palms and the boats. A boat is drawn with its near end against the land it is tied to (ox/oy), so it lies out over the water. */
  bw_wreck: {
    name: "Shipwreck Isle", bgArt: ["bw_wreck_bg1", "bw_wreck_bg2"], noBanks: true, ground: "sea", miniWater: "#2a7fc0", tint: "rgba(10,40,70,.10)", boatIsle: true,
    rows: [
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~#~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~#~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~########~###~~#~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~########.######~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~########.######.~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~########.######..~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~.########.######.~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~..########.######.~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~....#####..######.~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~...............~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~...............~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~.........##...~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~..........##.~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~..........##.~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~..........~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~.......~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "spot", x: 18, y: 17, name: "Pier End", req: { skill: "fishing", lvl: 72 }, fish: "bluefin", fish2: "swordfish", fish2lvl: 84, xp: 290, xp2: 340, glow: "#6ad8ff" });
      objs.push({ t: "spot", x: 31, y: 14, name: "The Deep Water", req: { skill: "fishing", lvl: 84 }, fish: "swordfish", fish2: "bluefin", fish2lvl: 72, xp: 340, xp2: 290, glow: "#4ab0ff" });
      objs.push({ t: "rock", ore: "eclipse_ore", art: "bw_rock_eclipse", x: 19, y: 14, name: "Eclipse rock", req: { skill: "mining", lvl: 70 }, xp: 210 }); g[14][19] = "#";
      objs.push({ t: "rock", ore: "eclipse_ore", art: "bw_rock_eclipse", x: 24, y: 16, name: "Eclipse rock", req: { skill: "mining", lvl: 70 }, xp: 210 }); g[16][24] = "#";
      objs.push({ t: "yew", art: "bw_palm1", anim: "bw_palm1a", frames: 10, cols: 10, fw: 107, fh: 169, fps: 7, h: 1, ox: -31.5, oy: -57.0, phase: 7, x: 21, y: 17, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[17][21] = "#";
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: -61.5, oy: -10.75, phase: 8, x: 11, y: 11, name: "Rowboat to the Lighthouse", row: { to: "bw_light", x: 29, y: 16 } });
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: 0, oy: -10.75, phase: 0, x: 30, y: 12, name: "Rowboat to Pirate's Pier", row: { to: "bw_pier", x: 8, y: 18 } });
      
      /* (2026-09-27) the clutter, the flags and the banners: the Sea pack's own props. A flat one lies on the ground and can be walked over. */
      objs.push({ t: "cliff", edge: true, art: "bw_d_sandcrate", x: 26, y: 13, name: "sandcrate" }); g[13][26] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_sandbarrel", x: 15, y: 16, name: "sandbarrel" }); g[16][15] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_chest", x: 21, y: 15, name: "chest" }); g[15][21] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_skeleton", x: 20, y: 12, name: "skeleton", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_bones", x: 25, y: 17, name: "bones", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_shells1", x: 28, y: 12, name: "shells1", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_rope", x: 17, y: 13, name: "rope", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_flag", frames: 8, cols: 8, fw: 70, fh: 76, fps: 8, h: 1, ox: 6.5, oy: -21.5, phase: 4, x: 26, y: 18, name: "flag" }); g[18][26] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["clawhand", 22, 13, { respawn: G.levelRespawn("clawhand") }], ["clawhand", 17, 15, { respawn: G.levelRespawn("clawhand") }], ["krakenarm", 14, 13, { perch: true, respawn: G.levelRespawn("krakenarm") }], ["krakenarm", 31, 10, { perch: true, respawn: G.levelRespawn("krakenarm") }], ["krakenarm", 24, 19, { perch: true, respawn: G.levelRespawn("krakenarm") }]],
    npcs: [],
    bots: []
  },
  /* (2026-09-27) THE BOARDWALK, REBUILT AS ISLANDS (the owner: "it will be multiples of scenes that are mostly smaller land areas
     surrounded by water ... all of these need entries and exits"): the pirates' own house, and a boathouse out on the pier. Composed from the Sea pack's mockup (lt-wild/isle-bw_pier.json);
     where you can walk is lt-wild/isle-blocks.json. The rowboats carry you along the chain; the pack's own animations move the sea,
     the palms and the boats. A boat is drawn with its near end against the land it is tied to (ox/oy), so it lies out over the water. */
  bw_pier: {
    name: "Pirate's Pier", bgArt: ["bw_pier_bg1", "bw_pier_bg2"], noBanks: true, ground: "sea", miniWater: "#2a7fc0", tint: "rgba(10,40,70,.10)", boatIsle: true,
    rows: [
          "#.....####...............###################",
          ".......###########......####################",
          "....##.###########..#.......................",
          "...###.###########..#.#.....................",
          "...#...###########....#.....................",
          ".......###########..........................",
          "..##...###########..........................",
          "............................................",
          "............................................",
          "...............######.......................",
          "~.....~~~~~~~~~######~~~~~~~~~~~~~~~~~~~~~~~",
          "~...~~~~~~~~~~~######~~~~~~~~~~~~~~~~~~~~~~~",
          "~...~~~~~~~~~..######.~~~~~~~~~~~~~~~~~~~~~~",
          "~...~~~~~~~~~..######.~~~~~~~~~~~~~~~~~~~~~~",
          "...............######.~~~~~~~~~~~~~~~~~~~~~~",
          "...............######.~~~~~~~~~~~~~~~~~~~~~~",
          "...............######.~~~~~~~~~~~~~~~~~~~~~~",
          "~...~~....~~~......##.~~~~~~~~~~~~~~~~~~~~~~",
          "~...~~~...~~~......##.~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~.........~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "spot", x: 4, y: 12, name: "Pier End", req: { skill: "fishing", lvl: 72 }, fish: "bluefin", fish2: "swordfish", fish2lvl: 84, xp: 290, xp2: 340, glow: "#6ad8ff" });
      objs.push({ t: "spot", x: 12, y: 19, name: "Pier End", req: { skill: "fishing", lvl: 72 }, fish: "bluefin", fish2: "swordfish", fish2lvl: 84, xp: 290, xp2: 340, glow: "#6ad8ff" });
      objs.push({ t: "spot", x: 22, y: 19, name: "The Deep Water", req: { skill: "fishing", lvl: 84 }, fish: "swordfish", fish2: "bluefin", fish2lvl: 72, xp: 340, xp2: 290, glow: "#4ab0ff" });
      objs.push({ t: "rock", ore: "nova_ore", art: "bw_rock_nova", x: 30, y: 5, name: "Nova rock", req: { skill: "mining", lvl: 80 }, xp: 240 }); g[5][30] = "#";
      objs.push({ t: "rock", ore: "nova_ore", art: "bw_rock_nova", x: 38, y: 7, name: "Nova rock", req: { skill: "mining", lvl: 80 }, xp: 240 }); g[7][38] = "#";
      objs.push({ t: "yew", art: "bw_palm1", anim: "bw_palm1a", frames: 10, cols: 10, fw: 107, fh: 169, fps: 7, h: 1, ox: -31.5, oy: -57.0, phase: 8, x: 27, y: 3, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[3][27] = "#";
      objs.push({ t: "yew", art: "bw_palm2", anim: "bw_palm2a", frames: 10, cols: 10, fw: 70, fh: 127, fps: 7, h: 1, ox: -16.0, oy: -37.0, phase: 7, x: 35, y: 4, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[4][35] = "#";
      objs.push({ t: "yew", art: "bw_palm3", anim: "bw_palm3a", frames: 10, cols: 10, fw: 77, fh: 143, fps: 7, h: 1, ox: -7.5, oy: -44.5, phase: 6, x: 41, y: 3, log: "palmlogs", name: "Island palm", req: { skill: "woodcutting", lvl: 60 }, xp: 240 }); g[3][41] = "#";
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: -30.75, oy: 0, phase: 13, x: 8, y: 19, name: "Rowboat to Shipwreck Isle", row: { to: "bw_wreck", x: 29, y: 12 } });
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: 0, oy: -10.75, phase: 9, x: 22, y: 15, name: "Rowboat to Skull Isle", row: { to: "bw_skull", x: 11, y: 12 } });
      
      /* (2026-09-27) the clutter, the flags and the banners: the Sea pack's own props. A flat one lies on the ground and can be walked over. */
      objs.push({ t: "cliff", edge: true, art: "bw_d_barrel2", x: 18, y: 5, name: "barrel2" }); g[5][18] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_skelbarrel", x: 5, y: 8, name: "skelbarrel" }); g[8][5] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_fishcrate", x: 14, y: 17, name: "fishcrate" }); g[17][14] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_bigcrate", x: 33, y: 6, name: "bigcrate" }); g[6][33] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_barrel", x: 40, y: 7, name: "barrel" }); g[7][40] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_rope", x: 8, y: 15, name: "rope", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_fish", x: 2, y: 14, name: "fish", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_coconut", x: 29, y: 8, name: "coconut", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_shells2", x: 36, y: 9, name: "shells2", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_banner2", frames: 12, cols: 12, fw: 85, fh: 107, fps: 8, h: 1, ox: -24.0, oy: -35.5, phase: 4, x: 21, y: 7, name: "banner" }); g[7][21] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_flag", frames: 8, cols: 8, fw: 70, fh: 76, fps: 8, h: 1, ox: 6.5, oy: -21.5, phase: 5, x: 4, y: 9, name: "flag" }); g[9][4] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["deckhand", 12, 8, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 30, 3, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 38, 5, { respawn: G.levelRespawn("deckhand") }], ["deckhand", 18, 8, { respawn: G.levelRespawn("deckhand") }], ["krakenarm", 22, 12, { perch: true, respawn: G.levelRespawn("krakenarm") }], ["krakenarm", 5, 11, { perch: true, respawn: G.levelRespawn("krakenarm") }], ["krakenarm", 30, 10, { perch: true, respawn: G.levelRespawn("krakenarm") }]],
    npcs: [],
    bots: []
  },
  /* (2026-09-27) THE BOARDWALK, REBUILT AS ISLANDS (the owner: "it will be multiples of scenes that are mostly smaller land areas
     surrounded by water ... all of these need entries and exits"): the skull in the rock, and Captain Claw in front of it. Composed from the Sea pack's mockup (lt-wild/isle-bw_skull.json);
     where you can walk is lt-wild/isle-blocks.json. The rowboats carry you along the chain; the pack's own animations move the sea,
     the palms and the boats. A boat is drawn with its near end against the land it is tied to (ox/oy), so it lies out over the water. */
  bw_skull: {
    name: "Skull Isle", bgArt: ["bw_skull_bg1", "bw_skull_bg2"], noBanks: true, ground: "sea", miniWater: "#2a7fc0", tint: "rgba(10,40,70,.10)", boatIsle: true,
    rows: [
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~.......~..~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~..............~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~.....#######......~~~~~~~~~~~~~",
          "~~~~~~~~~~~~..################..~~~~~~~~~~~~",
          "~~~~~~~~~~~..#################..~~~~~~~~~~~~",
          "~~~~~~~~~~~..#################...~~~~~~~~~~~",
          "~~~~~~~~~~~..###...####.#######.~~~~~~~~~~~~",
          "~~~~~~~~~~~..###........#######.~~~~~~~~~~~~",
          "~~~~~~~~~~~~.###..........#####.~~~~~~~~~~~~",
          "~~~~~~~~~~~~....................~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~....~~~~~~~~.......~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~..~~~~~~~~~~.....~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
          "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "spot", x: 18, y: 16, name: "The Deep Water", req: { skill: "fishing", lvl: 84 }, fish: "swordfish", fish2: "bluefin", fish2lvl: 72, xp: 340, xp2: 290, glow: "#4ab0ff" });
      objs.push({ t: "rock", ore: "nova_ore", art: "bw_rock_nova", x: 16, y: 7, name: "Nova rock", req: { skill: "mining", lvl: 80 }, xp: 240 }); g[7][16] = "#";
      objs.push({ t: "rock", ore: "nova_ore", art: "bw_rock_nova", x: 31, y: 15, name: "Nova rock", req: { skill: "mining", lvl: 80 }, xp: 240 }); g[15][31] = "#";
      objs.push({ t: "rowboat", art: "bw_rowboat", anim: "bw_boata", frames: 14, cols: 14, fw: 155, fh: 75, fps: 6, h: 1, ox: -61.5, oy: -10.75, phase: 8, x: 10, y: 12, name: "Rowboat to Pirate's Pier", row: { to: "bw_pier", x: 21, y: 15 } });
      
      /* (2026-09-27) the clutter, the flags and the banners: the Sea pack's own props. A flat one lies on the ground and can be walked over. */
      objs.push({ t: "cliff", edge: true, art: "bw_d_barricade", x: 17, y: 16, name: "barricade" }); g[16][17] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_skelbarrel", x: 29, y: 16, name: "skelbarrel" }); g[16][29] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_d_skeleton", x: 18, y: 14, name: "skeleton", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_bones", x: 24, y: 15, name: "bones", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_bones", x: 14, y: 16, name: "bones", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_shells2", x: 31, y: 9, name: "shells2", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_d_coconut", x: 26, y: 7, name: "coconut", flat: true });
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_flag", frames: 8, cols: 8, fw: 70, fh: 76, fps: 8, h: 1, ox: 6.5, oy: -21.5, phase: 6, x: 16, y: 14, name: "flag" }); g[14][16] = "#";
      objs.push({ t: "cliff", edge: true, art: "bw_none", anim: "bw_flag", frames: 8, cols: 8, fw: 70, fh: 76, fps: 8, h: 1, ox: 6.5, oy: -21.5, phase: 1, x: 14, y: 7, name: "flag" }); g[7][14] = "#";
      /* (2026-09-27, the owner: "if i were to beat captain claw does the treasure chest gif appear? it should") THE CAPTAIN'S CHEST: the pack's
         buried chest, where the mockup has it half out of the sand. Hidden while he lives; the page raises it when he falls and plays it open
         for each person who fought him, who can loot it once (the server's `clawchest`). */
      objs.push({ t: "clawchest", art: "bw_none", anim: "bw_chesta", frames: 10, fw: 54, fh: 77, h: 1, ox: -6.0, oy: -17.5, x: 20, y: 13, name: "Captain Claw's chest" });
      return { g, objs, blobs: [] };
    },
    mobs: [["captainclaw", 21, 14, { aggro: 3, respawn: [2700000, 2700000] }], ["clawhand", 15, 16, { respawn: G.levelRespawn("clawhand") }], ["clawhand", 31, 11, { respawn: G.levelRespawn("clawhand") }], ["clawhand", 20, 6, { respawn: G.levelRespawn("clawhand") }]],
    npcs: [],
    bots: []
  },
  /* (2026-09-30) THE PRIMEVAL VALLEY, north of the Trailer Park (HELD by HOLD.valley in the rules). The owner, on the first build: "the mob density
     is a little too high, the map is too dull/the same. try and draw it/lay it out like [the reference world map], lets add some random
     thematically okay art from our tile packs". So it is a COMPOSED picture now (lt-wild/valley.json, compose-rects.mjs), not tiles: the
     cavemen's forest and campfire (north-west), the dragon fossil and its throne where Old Rex sits (north), the cave, the hut and the
     waterfall with a stone bridge (south-west), the tusk camp (south), and a volcano with tar holes and steaming vents (south-east). The
     grid is lt-wild/valley-walk.py. Eighteen monsters, down from twenty-five. */
  valley: {
    name: "The Primeval Valley", exits: { s: "trailer" }, arrive: { s: { x: 21, y: 24 } }, bgArt: ["valley_bg1", "valley_bg2"], noBanks: true, miniWater: "#3f8fd8", tint: "rgba(60,40,10,.08)",
    rows: [
          "##################..########################",
          "###.........######.#########################",
          "###...........####.#########################",
          "###.....##....####.#########################",
          "###.....##..######..########################",
          "............######..########################",
          "............######..########################",
          "....##############..########################",
          "....##############..########################",
          "....##############........##.#########......",
          "..################.#......##.#########...#..",
          "..################.#.........######...##....",
          "......############.#.##.#.............##..#.",
          ".####................##.....................",
          ".####.....######.........#...############.##",
          ".....##~~~######.........#.#.############...",
          "#######~~~#####..........#...############...",
          "#######~~~#####.#######..#...############...",
          "#######~~~#####.#######..##..############...",
          "#######~~~#####.#######..################..#",
          "#######~~~~~~~#.#######..################..#",
          "#########~~~~~#.#######..################...",
          "#######...~~~...#######....####..........#..",
          "######........##.##.......................#.",
          "######....~~~.##.##.......#..#.......#....#.",
          "..........~~~.##....eeee..##.#.##......##..."
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      const put = (o) => { objs.push(o); g[o.y][o.x] = "#"; };
      /* WOODCUTTING: cycads at 92, in the forest clearing, on its west track, by the camp and down the east side */
      for (const [x, y] of [[4, 2], [11, 5], [1, 6], [42, 16], [42, 21], [24, 23]]) put({ t: "cycad", x, y, log: "cycadlogs", name: "Cycad", req: { skill: "woodcutting", lvl: 92 }, xp: 330 });
      /* MINING: fossil rocks at 92, round the fossil and the volcano */
      for (const [x, y] of [[24, 10], [28, 12], [36, 12], [41, 17], [33, 23]]) put({ t: "rock", x, y, ore: "fossil", name: "Fossil rock", req: { skill: "mining", lvl: 92 }, xp: 330 });
      /* FISHING: coelacanth at 92, in the stream below the waterfall, either side of the bridge */
      for (const [x, y] of [[13, 20], [11, 21], [11, 24], [12, 25]]) objs.push({ t: "spot", x, y, name: "Primordial stream", req: { skill: "fishing", lvl: 92 }, fish: "coelacanth", xp: 420, glow: "#9ad8a0", tease: "Something with legs for fins turns over under the waterfall." });
      objs.push({ t: "sign", x: 24, y: 24, name: "THE PRIMEVAL VALLEY: Combat 85 and up. Most things here shrug off one way of fighting and fear another: read them (right-click) before you swing. Old Rex sits on the fossil's throne. The Matriarch walks the plain." }); g[24][24] = "#";
      return { g, objs, blobs: [] };
    },
    /* Cavemen in the forest and the camp; sabretooths by the cave and the hut; pterodactyls over the stream (a bow or a wand); mammoths on
       the plain; raptors down the east side; tar horrors at the volcano's tar holes; Old Rex at his throne; the Matriarch on the plain */
    mobs: [["caveman", 6, 3], ["caveman", 10, 2], ["caveman", 23, 16], ["caveman", 20, 23],
      ["sabretooth", 1, 9], ["sabretooth", 7, 24],
      ["pterodactyl", 8, 17, { perch: true }], ["pterodactyl", 11, 20, { perch: true }], ["pterodactyl", 27, 13],
      ["mammoth", 21, 14], ["mammoth", 33, 13],
      ["raptor", 42, 18], ["raptor", 40, 23], ["raptor", 35, 23],
      ["tarhorror", 30, 23], ["tarhorror", 38, 22],
      ["rex", 31, 12], ["matriarch", 12, 13]],
    npcs: [],
    bots: []
  },
  orchard: {
    name: "The Orchard Wall", exits: { n: "boneyard" }, arrive: { n: { x: 12, y: 1 } }, bgArt: ["orchard_bg1", "orchard_bg2"], noBanks: true, miniWater: "#3f8fd8", tint: "rgba(20,60,20,.10)",   /* (the door is on the grass between the canopies, not under SPAN) */
    rows: [
          "##########.eee###########~~~################",
          "##########....###########~~~################",
          "##########....###########~~~################",
          "##########....###########~~~##.............#",
          "......###....############~~~######.######..#",
          "......###..#.############~~~######.#########",
          "......###..#.############~~~######.#########",
          "......###....############~~~######.#########",
          ".............############~~~######.#########",
          ".............############~~~##...........###",
          ".............############~~~..######..######",
          "####.....################~~~..######..######",
          "####.....##############.......######..######",
          "####................###.......######..######",
          "~####....................~~~.......#..#.....",
          "~####~~~~~~~~..~~~~~~~~~~~~~................",
          "~####~~~~~~~~..~~~~~~~~~~~~~########........",
          "~~~~~~~~~~~~~..~~~~~~~~~~~~~########..#####.",
          "~~~~~~~~~~~~~..~~~~~~~~~~~~~########..#####.",
          "~~~~~~~~~~~~~...~~#~~~~~~~~~#########..##...",
          "######............#.~~~~~~~~######.....##...",
          "########............~~~~~~~~#####......#####",
          "......##............~~~~~~~~#####......#####",
          "....................~~~~~~~~###..........###",
          "..........####......~~~~~~~~###...###....###",
          "..........####......~~~~~~~~###...###....###"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      /* the trees: pines on the village side (Woodcutting 52), walnuts on the camp's (66) */
      for (const [x, y] of [[3, 6], [2, 9], [9, 8], [14, 14], [5, 23], [9, 22], [16, 22]]) { objs.push({ t: "yew", art: "or_pine", log: "pinelogs", x, y, name: "Orchard pine", req: { skill: "woodcutting", lvl: 52 }, xp: 190 }); g[y][x] = "#"; }
      for (const [x, y] of [[33, 15], [38, 21], [42, 16], [30, 14], [14, 21]]) { objs.push({ t: "yew", art: "or_walnut", log: "walnutlogs", x, y, name: "Old walnut", req: { skill: "woodcutting", lvl: 66 }, xp: 230 }); g[y][x] = "#"; }
      /* the hives by the wagon, and Pomona's stove: a range on the barrels' side of the stall */
      for (const [x, y] of [[10, 9], [12, 10]]) { objs.push({ t: "hive", x, y, name: "Beehive" }); g[y][x] = "#"; }
      objs.push({ t: "range", x: 12, y: 11, name: "Pomona's stove" });
      return { g, objs, blobs: [] };
    },
    /* Wasps over the pond and the brook and round the hives (58, a bow or a wand); Orchard Orcs inside the camp (62); Keepers at the gate
       and along the fence (66); Hedge Things in the wood below (70); the Gardener at the bottom of the wood (72, open to everyone) */
    mobs: [["wasp", 6, 15, { perch: true, respawn: G.levelRespawn("wasp") }], ["wasp", 9, 16, { perch: true, respawn: G.levelRespawn("wasp") }], ["wasp", 22, 15, { perch: true, respawn: G.levelRespawn("wasp") }], ["wasp", 21, 20, { perch: true, respawn: G.levelRespawn("wasp") }], ["wasp", 17, 16, { perch: true, respawn: G.levelRespawn("wasp") }], ["wasp", 4, 9, { respawn: G.levelRespawn("wasp") }], ["wasp", 17, 22, { respawn: G.levelRespawn("wasp") }],
      ["orchardorc", 34, 5, { respawn: G.levelRespawn("orchardorc") }], ["orchardorc", 41, 3, { respawn: G.levelRespawn("orchardorc") }], ["orchardorc", 31, 3, { respawn: G.levelRespawn("orchardorc") }], ["orchardorc", 36, 9, { respawn: G.levelRespawn("orchardorc") }], ["orchardorc", 40, 9, { respawn: G.levelRespawn("orchardorc") }],
      ["orchardkeeper", 37, 17, { respawn: G.levelRespawn("orchardkeeper") }], ["orchardkeeper", 31, 15, { respawn: G.levelRespawn("orchardkeeper") }], ["orchardkeeper", 40, 15, { respawn: G.levelRespawn("orchardkeeper") }], ["orchardkeeper", 29, 12, { respawn: G.levelRespawn("orchardkeeper") }],
      ["hedgething", 33, 23, { respawn: G.levelRespawn("hedgething") }], ["hedgething", 36, 21, { respawn: G.levelRespawn("hedgething") }], ["hedgething", 32, 24, { respawn: G.levelRespawn("hedgething") }],
      ["gardener", 38, 23, { aggro: 3, respawn: [2400000, 3000000] }]],
    npcs: [{ name: "Pomona", art: "pomona", x: 11, y: 9, still: true, quests: ["orwasps", "orbands", "orgardener"], hair: "#8a4a1e", shirt: "#3a6a9a", pants: "#5a4a3a",
      lines: ["Apples, walnuts, honey, and a stove if you've something to cook. Welcome to the Wall.", "The pines are anyone's. The walnuts are across the brook, and so are the orcs.", "The bridge is the only way over. They know that too.", "Mind the wasps over the pond. They'll have the eye out of you for an apple."] }],
    bots: []
  },
  /* (2026-09-27) THE FOUNDRY, REBUILT (the owner: "i want the foundry to GUARANTEED use these parts of the tileset as the level design. the big
     boss at the end (animated), the traps placed once each around the map, this needs to be a massive map as it is very late game, it needs to
     feel more open"; then "7 areas, walked", "Warn, then hit hard", "He becomes Old Bessemer"). SEVEN AREAS, each a picture cut from the Volcano
     pack's own level design: five from its two Tiled maps (tools/eastscape-tmx-render.mjs), two from its mockups (lt-wild/fd/*.json), where you
     can walk read off the picture by lt-wild/fd-walk.mjs. The road: the Thunderhead -> THE WORKS -> THE LAVA MAZE -> THE CHAINED ROCK -> THE BOSS
     GATE -> (the burning door) -> THE GIANT'S HALL. Off it: THE BLOOD GROVE, west of the Works, and THE FLOATING ISLE, through the maze's portal.
     One of each of the pack's six traps: bone spikes (the Works), burning ground (the Grove), the spitfire (the Maze), the crusher (the Isle), a
     geyser (the Chained Rock) and the tiny volcano's lava balls (the Gate). Mining as before: four eclipse, three nova, two singularity. */
  foundry: {
    name: "The Works", exits: { n: "thunderhead", w: "fd_grove", s: "fd_maze" }, arrive: { n: { x: 22, y: 1 }, w: { x: 1, y: 6 }, s: { x: 22, y: 24 } },
    bgArt: ["foundry_bg1", "foundry_bg2"], noBanks: true, ground: "lava", miniWater: "#e0601c", tint: "rgba(70,20,0,.10)",
    rows: [
      ".....................eee....................",
      "............................................",
      ".................................####.......",
      "..............#######.....############......",
      "..........###########.....########..........",
      "e.........####............#.................",
      "e.........##........#######..........##.....",
      "e.................#############......##.....",
      "............................................",
      "..........##......~~~~~~~~~~~~.#......##....",
      "...........#......~~~######~~~~.......######",
      "....##.##..........~~######~~~~........#####",
      "....#########......~~######~~~~.............",
      "#.#.##..#####......~~######~~~~......#######",
      "#.####............~~~######~~~~.............",
      "#####..............~~~~~~~~~~~~.......~~~~~~",
      "###..............#.~~~~~~~~~~~~...........~~",
      "...................~~~~~...................~",
      "............#..##.~~~~......................",
      ".............##...~~~.......................",
      "............~...~~~~........................",
      "............~~~....~............~~~.......~~",
      "............~~~....~.........~~~~~~~..~~~~~~",
      "..............~~..~~........~~.~..~~~~~~~~~#",
      "............................~........~~~~~~#",
      "#######..............eee..............~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      for (const [x, y] of [[3, 9], [8, 17]]) { objs.push({ t: "rock", ore: "eclipse_ore", art: "fd_vein_eclipse", x, y, name: "Eclipse vein", req: { skill: "mining", lvl: 70 }, xp: 210 }); g[y][x] = "#"; }
      objs.push({ t: "blast", x: 6, y: 20, name: "The blast furnace" }); g[20][6] = "#";
      objs.push({ t: "trap", trap: "spikes", art: "fd_t_spikes", frames: 18, cols: 18, fw: 98, fh: 71, ax: 49, ay: 63, seq: {"idle": [0], "warn": [1, 2, 3], "strike": [4, 5, 6, 7, 8, 9], "end": [10, 11, 12, 13, 14, 15, 16, 17]}, x: 33, y: 18 });
      return { g, objs, blobs: [] };
    },
    mobs: [["slaggolem", 8, 1, { respawn: G.levelRespawn("slaggolem") }], ["slaggolem", 38, 20, { respawn: G.levelRespawn("slaggolem") }]],
    npcs: [{ name: "Basalt", art: "basalt", x: 24, y: 2, still: true, quests: ["fdslag", "fdimps", "fdbessemer"], buys: { tally: 150 },   /* (2026-09-27) he pays for the imps' tallies */ hair: "#444", shirt: "#553", pants: "#332",
      lines: ["Foreman. Mind the vents, mind the lava, and don't stand on anything that's glowing.", "The blast furnace is down on the left. Every bar the little furnaces make, and more xp for it.", "The imps take from the floor. The golems ARE the floor. The elementals just don't like you.", "Every imp wears one of my tallies. Bring them back and I pay a hundred and fifty a tag.", "Slag in a double batch at the blast furnace makes a third bar. Four for eclipse, six for nova.", "Old Bessemer's in the Hall, past the maze, the chained rock and the burning door. He was the first foreman. He got big.", "The spikes over there go off on their own. Watch the ground: it tells you first."] }],
    bots: []
  },
  fd_grove: {
    name: "The Blood Grove", exits: { e: "foundry" }, arrive: { e: { x: 42, y: 6 } },
    bgArt: ["fd_grove_bg1", "fd_grove_bg2"], noBanks: true, ground: "lava", miniWater: "#e0601c", tint: "rgba(80,10,10,.10)",
    rows: [
      "............................................",
      "............................................",
      "...#######.#.########.......................",
      "#####################.......................",
      "#######.............##......................",
      "....................###....................e",
      "~~~~~~................#....................e",
      "~~~~~~....#....#####...#...............#...e",
      "~~~~...#.....##.......##..............####..",
      "~~~~...#....#...~~~...................###...",
      "~~~~..........~.~~~....##.............###...",
      "~~~~........~~~~~~~....##...................",
      "~~~~........~~~~~...........................",
      "~~~~.........~~~...............########.####",
      "~~~~...................#####..#########.####",
      "..............##.......########......#..##..",
      "..............##...........####.............",
      "..............##............#...............",
      "...............#...........##.....#........#",
      "...........................#................",
      "............................................",
      "###.....##.............#....................",
      "#######.....................................",
      "~~~.....~.#.................................",
      "~~~~##~~~~##.................########.......",
      "~~~~##~~~~~##............###################"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      for (const [x, y] of [[26, 8], [36, 20]]) { objs.push({ t: "rock", ore: "eclipse_ore", art: "fd_vein_eclipse", x, y, name: "Eclipse vein", req: { skill: "mining", lvl: 70 }, xp: 210 }); g[y][x] = "#"; }
      for (const [x, y] of [[30, 20], [18, 21], [40, 17], [6, 10]]) objs.push({ t: "tuft", art: "fd_tumor", anim: "fd_tumor", frames: 14, cols: 10, fw: 198, fh: 113, fps: 9, x: x, y: y, w: 1, h: 1, ox: -41.5, oy: -20.2, edge: true, flat: true, name: "A pulsing pool", phase: x * 3 + y });
      objs.push({ t: "trap", trap: "burn", art: "fd_t_burn", frames: 24, cols: 22, fw: 90, fh: 64, ax: 45, ay: 32, seq: {"idle": [0], "warn": [1, 2, 3, 4, 5, 6, 7, 8], "strike": [9, 10, 11, 12, 13, 14, 15, 16], "end": [17, 18, 19, 20, 21, 22, 23]}, x: 8, y: 17 });
      return { g, objs, blobs: [] };
    },
    mobs: [["slaggolem", 10, 20, { respawn: G.levelRespawn("slaggolem") }], ["slaggolem", 33, 4, { respawn: G.levelRespawn("slaggolem") }], ["furnaceimp", 24, 12, { respawn: G.levelRespawn("furnaceimp") }]],
    npcs: [], bots: []
  },
  fd_maze: {
    name: "The Lava Maze", exits: { n: "foundry", s: "fd_chain" }, arrive: { n: { x: 22, y: 1 }, s: { x: 24, y: 24 } },
    bgArt: ["fd_maze_bg1", "fd_maze_bg2"], noBanks: true, ground: "lava", miniWater: "#e0601c", tint: "rgba(70,20,0,.10)",
    rows: [
      "###################..eee.........~~~########",
      "##################................~~########",
      ".################.................~~########",
      "....#############................~~~~#######",
      ".....###########........###......~~~########",
      ".......######.....................~~########",
      "........####......................~~########",
      ".........................########.~~#######~",
      "~....#..~~~~.#####...############~~~~###~~~~",
      "~~..#..~~~~~~#####...#####~~~~~~~~~~~~~~~~~~",
      "......~~~~~~~~~~##...###~~~~~~~~~~~~~~~~~~~~",
      ".....~~~~~~~~~~~.....#..~~~..~~~~~~~~~~~~~~~",
      ".....~~~~~~~~~..........~~~..~~~~~~~~~~~~~~~",
      "...#.~~~~~~~~~...............~~~.~~~~~~~~~~~",
      "..#..~~~~~~~~~~~..............~~.~~~~~~~~~~~",
      "#...~~~~~~~~~~~...~~...#..#...~~.~~~~~~~~~~~",
      "...~~~~...........~~...~~........~~~~~~~~~~~",
      "~~~~~~~..........~~~...~~~~~~....~~~~~~~~~~~",
      "~...~~~~~..~~~~..~~~~~~~~##~~~~..~~~~~~~~~~~",
      ".....~~~~..~~~~~.~~~~....##..~~..~~~~~~~~~~~",
      ".....~~~~..~~~~~~~.......###..~..~~~~~~~~~~~",
      ".....~~~~..~~~~~~........###.....~~~~~~~~~..",
      ".....~~~~..~~~~~.........###................",
      ".....~~~~................###................",
      ".........................###...#............",
      ".......................eee................#."
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      for (const [x, y] of [[3, 20], [38, 23]]) { objs.push({ t: "rock", ore: "nova_ore", art: "fd_vein_nova", x, y, name: "Nova vein", req: { skill: "mining", lvl: 80 }, xp: 240 }); g[y][x] = "#"; }
      objs.push({ t: "vortex", anim: "fd_vortex", frames: 16, cols: 15, fw: 136, fh: 128, fps: 12, ox: -26.0, oy: -28.0, x: 25, y: 2, name: "The portal", row: { to: "fd_isle", x: 16, y: 15 } }); g[2][25] = "#";
      objs.push({ t: "trap", trap: "spit", art: "fd_t_spit", frames: 29, cols: 6, fw: 341, fh: 171, ax: 170, ay: 85, seq: {"idle": [0], "warn": [1, 2, 3, 4, 5, 6, 7, 8], "strike": [15, 16, 17, 18, 19, 20, 21, 22], "sstart": [9, 10, 11, 12, 13, 14], "end": [23, 24, 25, 26, 27, 28]}, x: 28, y: 6 }); g[6][28] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["furnaceimp", 2, 12, { respawn: G.levelRespawn("furnaceimp") }], ["furnaceimp", 22, 13, { respawn: G.levelRespawn("furnaceimp") }], ["slaggolem", 20, 22, { respawn: G.levelRespawn("slaggolem") }]],
    npcs: [], bots: []
  },
  fd_isle: {
    name: "The Floating Isle", exits: {}, arrive: {},
    bgArt: ["fd_isle_bg1", "fd_isle_bg2"], noBanks: true, ground: "lava", miniWater: "#e0601c", tint: "rgba(70,20,0,.10)",
    rows: [
      "########~~~~~~~~~~~~~~~~~~~~~##~~~##########",
      "#####~##~~~~~~~~~~~~~~~~~~~~~##~~~##########",
      "####~~##~~~~~~~~~~~~~~~~~~~~~##~~~#########~",
      "###~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~#########~~",
      "###~~~~~~~~..........~~~~~~~~~~~~#######~~~~",
      "####~~~~~~............~~~~~~~~~~~########~~~",
      "####~~~~~~.........#........~~~~~########~~#",
      "####~~~~~~..#.............#~~~~~~########~~#",
      "####~~~~~................#.~~~~~~########~~#",
      "####~~~~~..................~~~~~~########~~#",
      "###~~~~~..................#~~~~~~~#####~~~~#",
      "###~~~~~..................#......~~####~~~~#",
      "#~~~~~~~..........................~~###~~###",
      "~~~~~~~~.....##...........#......~~~~~~~~###",
      "~~~~~~~~........................#~~~~~~~####",
      "~~~~~~~~.######...................~~~~~~####",
      "~~~~~~~~~######............######.~~~~~~####",
      "~~~~~~~~~######...........#######~~~~~~~~###",
      "~~~~~~~~~~~................######~~~~~~~~~~#",
      "~~~~~~~~~~~~~~..................~~~~~~~~~~~#",
      "~~~~~~~~~~~~~~........#...#~~~~~~~~~~~~~~~~#",
      "~~~~~~~~~~~~~~.##.#..#..#...~~~~~~~~~~~~~###",
      "~~~~~~~~~~~~~~~############.~~~~~~~~~~~~~###",
      "~~~~~~~~~~~~~~~############.~~~~~~~~~~~~~###",
      "~~~~~~~~~~~~~~~~###########~~~~~~~~~~~~~~~##",
      "~~~~~~~~~~~~~~~~~#########~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "rock", ore: "singularity_ore", art: "fd_vein_singularity", x: 10, y: 9, name: "Singularity vein", req: { skill: "mining", lvl: 90 }, xp: 300 }); g[9][10] = "#";
      objs.push({ t: "rock", ore: "nova_ore", art: "fd_vein_nova", x: 30, y: 12, name: "Nova vein", req: { skill: "mining", lvl: 80 }, xp: 240 }); g[12][30] = "#";
      objs.push({ t: "vortex", anim: "fd_vortex", frames: 16, cols: 15, fw: 136, fh: 128, fps: 12, ox: -26.0, oy: -28.0, x: 12, y: 14, name: "The portal", row: { to: "fd_maze", x: 22, y: 4 } }); g[14][12] = "#";
      objs.push({ t: "trap", trap: "crush", art: "fd_t_crush", frames: 30, cols: 12, fw: 163, fh: 392, ax: 76, ay: 316, seq: {"idle": [0], "warn": [1, 2, 3, 4], "strike": [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], "end": [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29]}, x: 21, y: 13 }); g[13][21] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["cinderelemental", 15, 5, { respawn: G.levelRespawn("cinderelemental") }], ["cinderelemental", 28, 15, { respawn: G.levelRespawn("cinderelemental") }], ["furnaceimp", 20, 19, { respawn: G.levelRespawn("furnaceimp") }]],
    npcs: [], bots: []
  },
  fd_chain: {
    name: "The Chained Rock", exits: { n: "fd_maze", s: "fd_gate" }, arrive: { n: { x: 11, y: 1 }, s: { x: 26, y: 24 } },
    bgArt: ["fd_chain_bg1", "fd_chain_bg2"], noBanks: true, ground: "lava", miniWater: "#e0601c", tint: "rgba(70,20,0,.10)",
    rows: [
      "~~~~~~~~~#eee~~~~~~~~~~~~~~###~~##~~~~~~~~~~",
      "~~~~~~~~~....~~~~~~~~~~~~~~###~~##~~~~~~~~~~",
      "~~~~~~~~~..#.~~~~~~~~~~~~~~###~~##~~~~~~~~~~",
      "~~~~~~~~~....~~~~~~~~~~~~~~##~~~##~~~~~~~~~~",
      "~~~~~~~~~......~~~~~~~~~~#####~~~#~~~~~~~~~~",
      "~~~~~~~~~.####..~~~~~~~~######~~##~~~~~~~~~~",
      "~~~~~~~~~.....#.~~~~~~~~######~~##~~~~~~~~~~",
      "~~~~~~~~~....#..~~~~~~~~#####~~~~#~~~~~~~~~~",
      "~~~~~~~~~.......~~~~~~~~#~~#~~~~~#~~~~~~~~~~",
      "~~~~~~~~~.......~~~~~~###~~#~~~~~#~~~~~~~~~~",
      "~~~~~~~~~....#..~~###########~~~~#~~~~~~~~~~",
      "~~~~~~~~~.....#.~~####~#######~~##~~~~~~~~~~",
      "~~~~~~~~~.####..~~.##.~~######~~##~~~~~~~~~~",
      "~~~~~~~~~......~~~.....~~#####~~~#~~~~~~~~~~",
      "~~~~~~~~~....~~~~......~~~~##~~~##~~~~~~~~~~",
      "~~~~~~~~~..#.~~~~.##...~~~~###~~##~~~~~~~~~~",
      "~~~~~~~~~....~~~..##...~~~~###~~##~~~~~~~~~~",
      "~~~~~~~~~##..~.....#..~~~~~###~~##~~~~~~~~~~",
      "~~~~~~~~~.......~~~...~~~~~~#~~~~#~~~~~~~~~~",
      "~~~~~~~~~~~...~~~~~~..~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~....~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~..##..~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~...................~~~~~~~~~~~~~",
      "~~~~~~~~~~~..#..................~~~~~~~~~~~~",
      "~~~~~~~~~~..#....######..........~~~~~~~~~~~",
      "~~~~~~~~~~...........eee.........~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "rock", ore: "singularity_ore", art: "fd_vein_singularity", x: 19, y: 13, name: "Singularity vein", req: { skill: "mining", lvl: 90 }, xp: 300 }); g[13][19] = "#";
      objs.push({ t: "trap", trap: "geyser", art: "fd_t_geyser", frames: 39, cols: 26, fw: 76, fh: 150, ax: 32, ay: 137, seq: {"idle": [0], "warn": [1, 2, 3, 4, 5], "strike": [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26], "end": [27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38]}, x: 16, y: 23 }); g[23][16] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["cinderelemental", 12, 6, { respawn: G.levelRespawn("cinderelemental") }], ["cinderelemental", 28, 24, { respawn: G.levelRespawn("cinderelemental") }]],
    npcs: [], bots: []
  },
  fd_gate: {
    name: "The Boss Gate", exits: { s: "fd_chain" }, arrive: { s: { x: 21, y: 24 }, n: { x: 21, y: 12 } },
    bgArt: ["fd_gate_bg1", "fd_gate_bg2"], noBanks: true, ground: "lava", miniWater: "#e0601c", tint: "rgba(70,20,0,.10)",
    rows: [
      "############################################",
      "############################################",
      "############################################",
      "############################################",
      "############################################",
      "############################################",
      "##################################..##..##..",
      "################################............",
      "#####################~########..............",
      "~~~~~~~~############~~~#######......~~~~~~~~",
      "~~~~~~~~~###########~~~#..........~~~~~~~~~~",
      "~~~~~~~~~~~########.............~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~####~.....~....~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~eeeee~~~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      objs.push({ t: "burndoor", anim: "fd_gatefx", frames: 16, cols: 16, fw: 76, fh: 112, fps: 10, ox: -11.0, oy: -40.0, x: 21, y: 10, name: "The burning door", row: { to: "fd_hall", x: 22, y: 24 } }); g[10][21] = "#";
      objs.push({ t: "trap", trap: "volc", art: "fd_t_volc", frames: 25, cols: 25, fw: 68, fh: 96, ax: 39, ay: 92, seq: {"idle": [0, 1, 2, 3, 4, 5, 6, 7], "warn": [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]}, x: 35, y: 8, targets: [13, 14, 15, 16, 17, 18, 19, 20, 21, 22].flatMap((y) => [[19, y], [20, y], [21, y], [22, y], [23, y]]) });   /* its balls land on the causeway */ g[8][35] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [["furnaceimp", 21, 17, { respawn: G.levelRespawn("furnaceimp") }], ["cinderelemental", 38, 7, { respawn: G.levelRespawn("cinderelemental") }]],
    npcs: [], bots: []
  },
  fd_hall: {
    name: "The Giant's Hall", exits: { s: "fd_gate" }, arrive: { s: { x: 22, y: 24 } },
    bgArt: ["fd_hall_bg1", "fd_hall_bg2"], noBanks: true, ground: "lava", miniWater: "#c8d020", tint: "rgba(70,20,0,.06)",
    rows: [
      "###~~~~.....################################",
      "~~~~~~......################################",
      "~......##..#################################",
      "............################################",
      "............################################",
      "..........#.################################",
      "............################################",
      "............################################",
      "............################################",
      "#...........################################",
      "............################################",
      ".....#.#....################################",
      ".#.#........################################",
      ".....................#############..........",
      ".....................#############..........",
      ".....................#############..........",
      ".....................#############..........",
      "............................................",
      "............................................",
      "...........................................#",
      "............................................",
      "............................................",
      "............................................",
      "............................................",
      "............................................",
      ".....................eee...................#"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      /* the eyes on top of the two towers, watching the floor */
      for (const x of [17, 35]) objs.push({ t: "tuft", art: "fd_eye", anim: "fd_eye", frames: 16, cols: 16, fw: 110, fh: 72, fps: 10, x: x, y: 2, w: 1, h: 1, ox: -11.5, oy: -18.0, edge: true, flat: true, name: "A burning eye", phase: x });
      g[17][27] = "#";   /* where Old Bessemer stands: his hands on the floor, his body in front of the wall */
      return { g, objs, blobs: [] };
    },
    mobs: [["bessemer", 27, 17, { perch: true, aggro: 4, respawn: [2400000, 3000000] }]],
    npcs: [], bots: []
  },
  depths: {
    name: "The Depths of the Mountain", exits: { s: "thunderhead", e: "trailer" }, bgArt: ["dp_bg1", "dp_bg2"], noBanks: true,
    rows: [
      "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.~~~.~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~................~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~..................~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~..................~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~..................~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~................~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~.....~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~...~~~~~~~.....~~~~~~~...~~~~~~~~~~",
      "~~~~~~......~~~~~.........~~~~~......~~~~~~~",
      "~~~~~.......~~~~~.........~~~~~.......~~~~~~",
      "~~~~~~...............................~~~~~~~",
      "~~~~~~...............................~~~~~~~",
      "~~~~~.................................~~~~~~",
      "~~~~~~...............................~~~~~~~",
      "~~~~~~......~~~~~.........~~~~~......~~~~~~~",
      "~~~~~~~~~~~~~~~~~.........~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~.........~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~...~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~...~~~~~~~.............e",
      "~~~~~~~~~~~~~~.............................e",
      "~~~~~~~~~~~~~~.............................e",
      "~~~~~~~~~~~~~~~~~~~~eee~~~~~~~~~~~~~~~~~~~~~"
    ],
    build() {
      const { g, objs } = fromRows(this.rows, G);
      /* the veins: abyss crystal on the east wing; eclipse and nova in the throne room, behind the Iron Ogres */
      for (const [x, y] of [[32, 12], [36, 12], [33, 16], [35, 16], [34, 18]]) { objs.push({ t: "rock", ore: "abyss_crystal", x, y, name: "Abyss crystal vein", req: { skill: "mining", lvl: 75 }, xp: 230, tease: "Pink light through the rock. Your pickaxe skids off it." }); g[y][x] = "#"; }
      for (const [x, y] of [[14, 3], [29, 4], [15, 6]]) { objs.push({ t: "rock", ore: "eclipse_ore", art: "dp_vein_eclipse", x, y, name: "Eclipse crystal", req: { skill: "mining", lvl: 70 }, xp: 210 }); g[y][x] = "#"; }
      objs.push({ t: "rock", ore: "nova_ore", art: "dp_vein_nova", x: 28, y: 2, name: "Nova crystal", req: { skill: "mining", lvl: 80 }, xp: 240 }); g[2][28] = "#";
      /* (2026-09-27, the owner: "keep it mining only, no fish") The Drop's four fishing spots are gone */
      /* the throne room's gate, lowered across its doorway, and a few crystals by the veins */
      objs.push({ t: "tuft", art: "dp_gatebar", x: 19, y: 6, w: 5, h: 1, edge: true, flat: true, name: "The gate, lowered" });
      for (const [art, x, y] of [["dp_crys_r", 35, 14], ["dp_crys_b", 31, 16], ["dp_crys_t", 37, 17]]) objs.push({ t: "tuft", art, x, y, w: 1, h: 1, edge: true, flat: true, name: "Crystals" });
      return { g, objs, blobs: [] };
    },
    /* the landing and the sand bridge: Pot Boys (73); the west wing goblins (75); wisps hang over the drop (76, bow only); the east wing
       Crystal Ogres (78, no arrows); the throne room Iron Ogres (80, Void only) and the Deepwarden in front of his throne (84).
       (2026-09-27, the owner: "respawn timers need to be longer since the mobs are stronger, it gives users more time to get better
       ores/fish/trees etc, but balance it around mob grinders too") roughly twice what they were, longest for the hardest; a grinder
       working one wing still has a monster up most of the time, because each wing holds five or six. */
    /* (2026-09-27, the owner: "there needs to be 2-3 crystal ogres, 2-3 goblin cutters, the mob density is a little too high currently. and
       just like the newly created boardwalk, mob respawn needs to be tied to monster HP/level") three of each where there were six Cutters
       and five Ogres, and every monster on G.levelRespawn (three minutes at least, longer the higher its level); the Deepwarden unchanged. */
    mobs: [["potboy", 15, 23, { respawn: G.levelRespawn("potboy") }], ["potboy", 17, 24, { respawn: G.levelRespawn("potboy") }], ["potboy", 33, 23, { respawn: G.levelRespawn("potboy") }], ["potboy", 37, 24, { respawn: G.levelRespawn("potboy") }],
      ["dgoblin", 7, 13, { respawn: G.levelRespawn("dgoblin") }], ["dgoblin", 9, 15, { respawn: G.levelRespawn("dgoblin") }], ["dgoblin", 11, 17, { respawn: G.levelRespawn("dgoblin") }],
      ["dwisp", 14, 9, { perch: true, respawn: G.levelRespawn("dwisp") }], ["dwisp", 28, 9, { perch: true, respawn: G.levelRespawn("dwisp") }], ["dwisp", 13, 20, { perch: true, respawn: G.levelRespawn("dwisp") }], ["dwisp", 29, 20, { perch: true, respawn: G.levelRespawn("dwisp") }],
      ["dogre", 34, 13, { respawn: G.levelRespawn("dogre") }], ["dogre", 32, 15, { respawn: G.levelRespawn("dogre") }], ["dogre", 35, 17, { respawn: G.levelRespawn("dogre") }],
      ["diron", 16, 4, { respawn: G.levelRespawn("diron") }], ["diron", 26, 4, { respawn: G.levelRespawn("diron") }], ["diron", 27, 2, { respawn: G.levelRespawn("diron") }],
      ["deepwarden", 21, 3, { aggro: 3, respawn: [2400000, 3000000] }]],
    npcs: [{ name: "Old Pickett", art: "pickett", x: 24, y: 24, still: true, quests: ["deepcrystal", "deepgoblins", "deepkeeper"], hair: "#c8c8c0", shirt: "#3a5a3a", pants: "#4a3a2a",
      lines: ["Forty years I cut with the others. Then I put the blade down and picked up a pick. Better company.", "Mind the edges. Nobody's ever found the bottom, and a few of my cousins have looked very hard.", "Wisps won't come to you. Bring a bow, or don't bother.", "The iron ones only feel the Void. Swords just ring off them."] }],   /* (2026-09-27) the pack's own goblin, old and retired */
    bots: []
  },
  deep: {
    name: "The Deep Wild", pvp: true, exits: { s: "wild" }, tint: "rgba(50,10,45,.3)", ground: "deep", xpMul: 1.5, luck: 0.1, geode: 0.01,
    rows: [
      "############################################",
      "#.........##..................##############",
      "#.........##,,,,,,,,,,,,,,,,,,##############",
      "#.........##...................,....##,....#",
      "#.............##################....##,....#",
      "#........,,,..##################...~~~~....#",
      "#........,###......#############...~~~~....#",
      "########.,,##......#############........,..#",
      "########.,.##......#####################,.##",
      "########.,.##......#####################,.##",
      "########.,.##......################...,.,..#",
      "########.,.##......################...,....#",
      "########.,....................#####...,....#",
      "########,,,,,,,,,,,,,,,,,,,,,,,,,,,...,....#",
      "########..............................,....#",
      "###############...............#####...,....#",
      "#####################.,.###########...,....#",
      "#####################.,.###########...,....#",
      "##.......############.,.####################",
      "##.......############.,.####################",
      "##.......############.,.########..........##",
      "##....................,...................##",
      "##.......,,,,,,,,,,,,,,,,,,,,,,,,,........##",
      "##.......########.....,.....####..........##",
      "###################...,...##################",
      "############################################"
    ],
    build() {
      const { g, objs, walls } = fromRows(this.rows, G);
      for (let x = 21; x <= 23; x++) g[25][x] = "e";
      piece(g, objs, walls, "d_plateau", 19, 4, 6, 8, "Plateau"); piece(g, objs, walls, "d_cave", 26, 4, 3, 4, "Cave mouth"); piece(g, objs, walls, "d_column", 30, 15, 5, 5, "Rock column"); piece(g, objs, walls, "d_cave", 3, 13, 3, 4, "Cave mouth");
      /* THE NEXUS: the best altar in the game, in the most dangerous place: the far north-west pocket, two ways in, drakes and
         golems on the door. It prints what every altar prints, twice over, for half as much Wizardry xp again (G.NEXUS). */
      objs.push({ t: "altar_nexus", art: "o_altar_nexus", x: 4, y: 2, w: 2, h: 2, name: "The Nexus: prints every page, twice over" }); block(g, 4, 2, 2, 2);
      /* (2026-09-29, the owner: "move the wild bench to the deep wilder") THE WILD BENCH, fletching's Nexus, beside the Nexus altar: both of
         the half-again stations in the one place, and that place is the Deep Wild. It stood in the Wilderness grove for a day. */
      objs.push({ t: "wildbench", art: "o_wildbench", x: 7, y: 3, w: 1, h: 1, name: "The Wild Bench: fletches everything, half as much again" }); g[3][7] = "#";
      // the Black Pool, fished from two tiles back (north-east); the grimstone (south-west); the deadwood (east)
      animPiece(g, objs, walls, { t: "waterfall", anim: "a_wfall_d", frames: 8, cols: 4, fw: 128, fh: 128, fps: 9, pad: 1, x: 36, y: 3, w: 2, h: 2, name: "Waterfall" });
      /* LAVA (Set3's animated sheets): two pools sunk into the rock, each tile on its own frame, a bubbling tile or two on top; steam
         rises off open ground beside them and by the cave in the middle. Lava is rock as far as walking goes: nothing stands in it. */
      for (const [x, y, w, h] of [[35, 18, 5, 2], [2, 7, 3, 2]]) animPiece(g, objs, walls, { t: "lava", anim: "a_lava", frames: 16, cols: 4, fps: 5, tile: true, flat: true, x, y, w, h, name: "Lava" });
      for (const [x, y] of [[36, 18], [39, 19], [3, 8]]) objs.push({ t: "lava", anim: "a_lavab", frames: 16, cols: 4, fps: 7, tile: true, flat: true, edge: true, x, y, w: 1, h: 1, name: "Lava" });
      for (const [x, y, k] of [[35, 17, 0], [39, 20, 7], [3, 6, 13], [27, 12, 19]]) objs.push({ t: "steam", anim: "a_steam", frames: 30, cols: 8, fw: 64, fh: 64, fps: 10, ox: -8, oy: -20, alpha: 0.75, phase: k, flat: true, edge: true, x, y, w: 1, h: 1, name: "Steam" });
      /* (2026-09-26, later) the Deep's pockets are held by level 52-62 monsters and pay like it: onyx and a starfall rock in the
         south-west, two skyash in the east, stormmarlin under the gloomfin. One grimstone and one deadwood stay. */
      /* (2026-09-27) the Black Pool is the top of the fishing ladder: voidfin at 92, grimscale at 97. The Wilderness pool keeps the gloomfin. */
      for (const x of [35, 38]) objs.push({ t: "spot", x, y: 6, name: "Black pool", req: { skill: "fishing", lvl: 92 }, fish: "voidfin", fish2: "grimscale", fish2lvl: 97, xp: 400, xp2: 480, glow: "#b080ff", tease: "The water is black and very still. Something down there is even stiller. Fishing 92." });
      objs.push({ t: "yew", art: "o_gallowsoak", x: 8, y: 18, w: 1, h: 1, log: "gallowslogs", name: "Gallows oak", req: { skill: "woodcutting", lvl: 90 }, xp: 300 }); g[18][8] = "#";   /* (2026-09-29, a player's bug report: "a gallows level 90 tree is blocking the onyx ore and making it unmineable") moved from 7,21: its picture is three tiles wide and four tall and sat right over the onyx at 6,20; in the pocket's top corner it only overlaps rock */   /* (2026-09-27) the top of the woodcutting ladder */
      objs.push({ t: "rock", ore: "grimstone", x: 3, y: 19, name: "Grimstone rock", req: { skill: "mining", lvl: 20 }, xp: 60, tease: "Cold purple stone. Your pickaxe skids right off." }); g[19][3] = "#";
      objs.push({ t: "rock", ore: "onyx_ore", x: 6, y: 20, name: "Onyx rock", req: { skill: "mining", lvl: 50 }, xp: 115 }); g[20][6] = "#";
      objs.push({ t: "rock", ore: "starfall_ore", x: 4, y: 22, name: "Starfall rock", req: { skill: "mining", lvl: 60 }, xp: 150 }); g[22][4] = "#";
      objs.push({ t: "deadtree", x: 37, y: 11, name: "Deadwood tree", log: "ashlogs", req: { skill: "woodcutting", lvl: 20 }, xp: 70, tease: "Grey, hard as bone. Your axe just bounces." }); g[11][37] = "#";
      for (const [x, y] of [[40, 13], [36, 16]]) { objs.push({ t: "skyash", x, y, log: "skyashlogs", name: "Skyash", req: { skill: "woodcutting", lvl: 50 }, xp: 200 }); g[y][x] = "#"; }
      for (const [art, x, y, w, h] of [["d_rock2", 16, 1, 2, 2], ["d_boulder1", 27, 2, 1, 1], ["d_rock2", 12, 12, 2, 2], ["d_rock3", 18, 13, 2, 2], ["d_slab", 24, 14, 3, 2], ["d_boulder2", 20, 12, 1, 1], ["d_boulder1", 31, 13, 1, 1], ["d_rock7", 41, 14, 2, 3],
        ["d_boulder3", 2, 23, 1, 1], ["d_boulder2", 23, 17, 1, 1], ["d_coal1", 6, 5, 2, 1], ["d_coal1", 41, 3, 2, 1], ["d_coal2", 19, 23, 2, 1], ["d_boulder3", 11, 21, 1, 1], ["d_rock3", 25, 21, 2, 2]]) deco(g, objs, art, x, y, w, h, "Rock");
      for (const [art, x, y, w, h] of [["d_log1", 14, 9, 3, 1], ["d_log2", 38, 15, 3, 1], ["d_root1", 32, 23, 2, 1]]) deco(g, objs, art, x, y, w, h, "Fallen tree");
      for (const [art, x, y] of [["d_dead1", 9, 6], ["d_burnt", 2, 4], ["d_dead3", 23, 3], ["d_stump1", 13, 3], ["d_dead2", 17, 7], ["d_stump2", 21, 22], ["d_root3", 24, 23], ["d_dead1", 7, 18], ["d_root2", 41, 10], ["d_dead3", 33, 7], ["d_burnt", 40, 21], ["d_dead2", 15, 12], ["d_root2", 35, 21], ["d_burnt", 21, 15]]) deco(g, objs, art, x, y, 1, 1, "Dead tree");
      for (const [x, y] of [[34, 21], [39, 22], [37, 20], [28, 15]]) { objs.push({ t: "gravestone", x, y, name: "Gravestone" }); g[y][x] = "#"; }
      for (const [x, y] of [[36, 22], [17, 22]]) { objs.push({ t: "skeleton", x, y, name: "Skeleton" }); g[y][x] = "#"; }
      for (const [x, y] of [[8, 2], [26, 12], [33, 3], [4, 18], [22, 20], [39, 12]]) objs.push({ t: "tuft", art: "d_tuft", x, y, w: 1, h: 1, edge: true, flat: true, name: "Grass" });
      rockWall(g, objs, walls, DEEP_ROCKS, 8);
      G.markBanks(g);
      return { g, objs, blobs: [] };
    },
    /* the Nexus door is drakes and golems; the pool is wolves; everything between is a revenant or a wraith */
    /* the Deep: 11 of 32 aggressive - the Nexus door, the pool, the ores, the skyash, and the two Liches */
    mobs: [["drake", 3, 5, { aggro: 5, respawn: [90000, 120000] }], ["drake", 7, 2, { aggro: 5, respawn: [90000, 120000] }], ["golem", 8, 4, { aggro: 4, respawn: [75000, 120000] }], ["golem", 2, 1, { respawn: [70000, 110000] }],
      ["revenant", 9, 9, { respawn: [55000, 95000] }], ["taxwraith", 14, 8, { respawn: [45000, 80000] }], ["chandelier", 14, 2, { respawn: [50000, 90000] }], ["chandelier", 25, 1, { respawn: [60000, 100000] }], ["wolf", 20, 2, { respawn: [65000, 110000] }],
      ["wolf", 33, 4, { aggro: 4, respawn: [70000, 120000] }], ["wolf", 41, 5, { respawn: [60000, 105000] }], ["wolf", 39, 3, { aggro: 4, respawn: [80000, 120000] }],
      ["goose", 38, 12, { aggro: 4, respawn: [70000, 115000] }], ["goose", 39, 17, { respawn: [55000, 100000] }], ["golem", 36, 14, { aggro: 4, respawn: [75000, 120000] }], ["jackal", 40, 9, { respawn: [45000, 75000] }],
      ["revenant", 17, 13, { respawn: [50000, 90000] }], ["revenant", 27, 13, { respawn: [60000, 100000] }], ["taxwraith", 23, 12, { respawn: [45000, 80000] }],
      ["chandelier", 19, 22, { respawn: [50000, 95000] }], ["chandelier", 26, 23, { respawn: [55000, 100000] }], ["golem", 5, 19, { aggro: 4, respawn: [80000, 120000] }], ["golem", 7, 23, { respawn: [70000, 115000] }], ["revenant", 3, 21, { respawn: [60000, 100000] }],
      ["revenant", 35, 22, { respawn: [55000, 95000] }], ["revenant", 38, 23, { respawn: [65000, 110000] }], ["wolf", 33, 20, { respawn: [70000, 120000] }], ["taxwraith", 22, 18, { respawn: [45000, 85000] }],
      ["grimlich", 13, 4, { aggro: 4, respawn: [90000, 120000] }], ["grimlich", 40, 7, { aggro: 4, respawn: [90000, 120000] }],
      ["marrowhound", 2, 20, { aggro: 5, respawn: [75000, 120000] }], ["marrowhound", 8, 22, { respawn: [65000, 110000] }]],

    npcs: [], bots: []
  },
  };
}
