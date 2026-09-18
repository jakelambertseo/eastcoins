/* ============================================================
   EastScape — the rules both sides share

   The browser draws with this and the server (eastscape-worker)
   decides with it, so the two can never disagree about a map, an
   item, a level or a quest. Nothing in here touches the DOM, the
   network or Math.random: scenes are built from hashRand, so the
   same scene comes out tile-for-tile the same everywhere.

   Served from /v3/assets/js/, which is cached for a year: bump the
   ?v= in eastscape.html whenever this file changes, and redeploy the
   worker (cd eastscape-worker && npx wrangler deploy).
   ============================================================ */

// bump with every change to this file: the server says which version it runs, and a page on another version reloads
export const VERSION = 12;
export const COLS = 22, ROWS = 13;
export function hashRand(x, y, s = 1) { let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

/* ------------------------------------------------------------ OSRS curve */
export const XP_AT = [0, 0];
{ let p = 0; for (let l = 1; l < 99; l++) { p += Math.floor(l + 300 * Math.pow(2, l / 7)); XP_AT[l + 1] = Math.floor(p / 4); } }
export const levelOf = (xp) => { let l = 1; while (l < 99 && xp >= XP_AT[l + 1]) l++; return l; };

/* ------------------------------------------------------------ things you can carry */
export const ITEMS = {
  coins: { name: "Cash", icon: "💵", ex: "The money of EastScape. Earned from quests and the Exchange." }, wheat: { name: "Wheat", icon: "🌾" }, bones: { name: "Bones", icon: "🦴" },
  beef: { name: "Raw beef", icon: "🥩" }, hide: { name: "Cowhide", icon: "🟫" }, chicken: { name: "Raw chicken", icon: "🍗" },
  feather: { name: "Feather", icon: "🪶" }, sardine: { name: "Raw sardine", icon: "🐟" }, trout: { name: "Raw trout", icon: "🐠" },
  copper: { name: "Copper ore", icon: "🟠" }, tin: { name: "Tin ore", icon: "⚪" }, logs: { name: "Logs", icon: "🪵" }, olives: { name: "Olives", icon: "🫒" },
  pork: { name: "Raw boar", icon: "🥓" }, tusk: { name: "Boar tusk", icon: "🦷" },
  tomatoe: { name: "Tomatoe", icon: "🍅", ex: "Nonna insists on the e. Nobody has ever won that argument." },
  goldtomatoe: { name: "Golden tomatoe", icon: "🍅", ex: "Heavy as a coin and warm as a hug. It hums when it's ripe." },
  husk: { name: "Hornworm husk", icon: "🐛", ex: "Still a little squishy. Still a little angry." },
  marble: { name: "Marble chunk", icon: "🪨", ex: "The same stone the Bank is made of. Someone will want this." },
  mask: { name: "Highwayman's mask", short: "Mask", icon: "🎭", slot: "helm", def: 1, acc: 1, ex: "Smells of the road. Makes you look shifty." },
  yewlogs: { name: "Ancient yew logs", icon: "🪵", ex: "Heavy, dark and faintly warm. The grain moves if you stare." },
  mooncarp: { name: "Raw moon carp", icon: "🐡", ex: "It's looking at you. It's always looking at you." },
  stardust: { name: "Stardust", icon: "✨", ex: "Warm, and humming a note you almost recognise." },
  sunolive: { name: "Sun olive", icon: "🫒", ex: "Glows in the dark. Tastes like a summer you never had." },
  grimstone: { name: "Grimstone ore", icon: "🟣", ex: "Heavy, cold, and it hums when nobody's holding it. Only found in the Deep Wild." },
  ashlogs: { name: "Deadwood logs", icon: "🪵", ex: "Grey all the way through. They burn with no smoke and a faint sigh." },
  gloomfin: { name: "Raw gloomfin", icon: "🐟", ex: "It has too many fins and not enough patience." },
  geode: { name: "Glimmering geode", icon: "💎", ex: "Found now and then by anyone gathering in the Deep Wild. Worth a lot to the right person. Everyone is the right person." },
  receipt: { name: "Tax receipt", icon: "🧾", ex: "Proof you paid. Paid what, and to whom? It won't say." },
  cobweb: { name: "Enormous cobweb", icon: "🕸️", ex: "Still sticky. Still somebody's home." },
  grudge: { name: "Grudge knife", short: "Grudge", icon: "🔪", slot: "weapon", acc: 9, str: 7, ex: "It remembers everyone it has ever cut, and it holds the grudges so you don't have to." },
  wraithhood: { name: "Tax Wraith hood", short: "Hood", icon: "🥷", slot: "helm", def: 4, acc: 2, ex: "Smells of paperwork. Faintly see-through." },
  bogplate: { name: "Bog-hound hide", short: "Hide", icon: "🦺", slot: "body", def: 7, ex: "Still damp. It will always be damp." },
  lantern: { name: "Lantern shield", short: "Lantern", icon: "🏮", slot: "shield", def: 6, acc: 1, ex: "A very small man lives inside the lantern. He keeps it lit. Don't knock." },
  menace: { name: "Ring of Mild Menace", short: "Menace", icon: "💍", slot: "ring", str: 3, acc: 2, ex: "Makes you about eleven percent more threatening. People notice, but can't say why." },
  spiderboots: { name: "Eight-league boots", short: "Boots", icon: "🥾", slot: "boots", def: 2, spd: 6, ex: "Four boots, sewn into two. Nobody asks what happened to the spider. You walk a little faster." },
  pit: { name: "Olive pit", icon: "🌰", ex: "It's still warm. And still angry." },
  monocle: { name: "Tiny monocle", icon: "🧐", ex: "The olive was wearing it. You feel slightly more distinguished just holding it." },
  manifesto: { name: "Goat's manifesto", icon: "📜", ex: "Mostly bleats. Page three is surprisingly moving." },
  // things you wear: a slot, and what they add. Tools go in the weapon hand and must be held to use.
  rudis: { name: "Wooden rudis", short: "Rudis", icon: "🗡️", slot: "weapon", acc: 4, str: 2 },
  pickaxe: { name: "Bronze pickaxe", short: "Pickaxe", icon: "⛏️", slot: "weapon", tool: "mining", acc: 1, str: 1 },
  axe: { name: "Bronze axe", short: "Axe", icon: "🪓", slot: "weapon", tool: "woodcutting", acc: 2, str: 2 },
  rod: { name: "Fishing rod", short: "Rod", icon: "🎣", slot: "weapon", tool: "fishing" },
  cap: { name: "Leather cap", short: "Cap", icon: "⛑️", slot: "helm", def: 1 },
  tunic: { name: "Tunic", icon: "🥋", slot: "body", def: 2 },
  toga: { name: "Goat-sized toga", short: "Toga", icon: "🥻", slot: "body", def: 3, acc: 1, ex: "Smells of goat. Fits you perfectly, which is worrying." },
  parma: { name: "Parma", icon: "🛡️", slot: "shield", def: 3 },
  sandals: { name: "Sandals", icon: "🩴", slot: "boots", def: 1 }
};
export const SLOTS = ["helm", "weapon", "body", "shield", "legs", "gloves", "boots", "ring"];
export const SKILLS = { melee: { name: "Melee", icon: "⚔️" }, hp: { name: "Hitpoints", icon: "❤️" }, fishing: { name: "Fishing", icon: "🎣" }, farming: { name: "Harvesting", icon: "🌾" }, mining: { name: "Mining", icon: "⛏️" }, woodcutting: { name: "Woodcutting", icon: "🪓" } };
export const TOOL_OF = { mining: "pickaxe", woodcutting: "axe", fishing: "rod" };
export const INV_MAX = 30;
export const BANK_MAX = 200;       // different items the bank holds (stacks are unlimited)
export const EX_SLOTS = 8;         // Exchange offers a player can have open at once
export const EX_TAX = 0.01;        // the Exchange keeps 1% of every sale (rounded down); direct trades are free
export const TRADE_RANGE = 5;      // how close two players must stay to trade face to face
export const cashIn = (c) => c.inv.find((x) => x.k === "coins")?.n || 0;
export const fmtCash = (n) => `${Math.round(n).toLocaleString()} Cash`;

/* ------------------------------------------------------------ directions and reach */
export const DIRS = { "1,0": "east", "-1,0": "west", "0,1": "south", "0,-1": "north", "1,1": "south-east", "-1,1": "south-west", "1,-1": "north-east", "-1,-1": "north-west" };
export const D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
export const SPAN = { n: [16, 18], s: [16, 18], e: [5, 7], w: [5, 7] }, OPP = { n: "s", s: "n", e: "w", w: "e" };
/* movement speed. Walking one tile takes STEP_MS; a speed bonus (boots, pets, potions later: an item's "spd", in %)
   shortens that. The first 20% counts in full, anything past it counts half, and the total can't pass +50%
   (about 6 tiles a second), so every upgrade is worth having but nothing stacks into chaos. The server times your
   steps with this and the page predicts with the same rule, so they always agree. */
export const STEP_MS = 240, SPEED_FULL = 20, SPEED_CAP = 50;
export function speedRaw(c, extra = 0) { let raw = extra; for (const k of Object.values(c.eq || {})) if (k && ITEMS[k]?.spd) raw += ITEMS[k].spd; return raw; }
export function speedBonus(c, extra = 0) { const raw = speedRaw(c, extra); return Math.max(0, Math.min(SPEED_CAP, Math.min(SPEED_FULL, raw) + Math.max(0, raw - SPEED_FULL) * 0.5)); }
export const stepMsOf = (c, extra = 0) => Math.round(STEP_MS / (1 + speedBonus(c, extra) / 100));
export const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
// fishing reaches two tiles (the river's edge is a bank you can't stand on); everything else is next to you
export const reachOf = (kind) => (kind === "spot" || kind === "ferry" ? 2 : 1);
export const inReach = (a, b, r) => { const d = cheb(a, b); return d >= 1 && d <= r; };

/* ------------------------------------------------------------ building scenes
   grid: . grass  , path  ~ water  s sand  p paving  P paved but blocked  b bank (water reaches it; nobody stands there)
         f soil: a picked wheat tile, walkable until the wheat grows back
         i indoor floor   v the dark outside a room (never walkable)
         # blocked by something  e exit (blue) */
const grid = (fill = ".") => Array.from({ length: ROWS }, () => Array(COLS).fill(fill));
const block = (g, x, y, w = 1, h = 1) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) g[j][i] = "#"; };
const keepOf = (sc) => [...sc.mobs.map(([, x, y]) => [x, y]), ...sc.npcs.map((n) => [n.x, n.y])];
export function markBanks(g) {
  const wetAt = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy]?.[x + dx] === "~") return true; return false; };
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (".,s".includes(g[y][x]) && wetAt(x, y)) g[y][x] = "b";
    else if (g[y][x] === "b" && !wetAt(x, y)) g[y][x] = ".";
  }
}
// natural edges instead of a fence: forest, brush, rocks or water, deeper in some places than others, with the
// exits cut through. Runs after a scene's own things are placed, so it only fills open grass; then opens up (or
// fills in) anything cut off from the exits.
function wild(g, objs, exits, edges, keep = [], seed = 1) {
  const kept = new Set(keep.map(([x, y]) => `${x},${y}`)), rim = [];
  const wet = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy]?.[x + dx] === "~") return true; return false; };
  const put = (t, x, y) => { if (wet(x, y)) return; const ob = { t, x, y, name: { tree: "Tree", bush: "Bush", boulder: "Boulder" }[t] }; objs.push(ob); g[y][x] = "#"; rim.push(ob); };
  for (const d of ["n", "s", "w", "e"]) {
    const kind = edges[d] || "forest", len = d === "n" || d === "s" ? COLS : ROWS, dc = d.charCodeAt(0);
    if (kind !== "open") for (let i = 0; i < len; i++) {
      const nearExit = exits[d] && i >= SPAN[d][0] - 1 && i <= SPAN[d][1] + 1;
      const depth = nearExit ? 0 : Math.max(1, Math.min(3, Math.round(1.3 + Math.sin(i * 0.8 + seed * 3.1 + dc) * 0.9 + hashRand(i, seed, dc) * 0.9)));
      for (let k = 0; k < depth; k++) {
        const x = d === "w" ? k : d === "e" ? COLS - 1 - k : i, y = d === "n" ? k : d === "s" ? ROWS - 1 - k : i;
        if (g[y][x] !== "." || kept.has(`${x},${y}`)) continue;
        if (kind === "water") {
          let clear = true;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const t = g[y + dy]?.[x + dx]; if ((t && !".~".includes(t)) || kept.has(`${x + dx},${y + dy}`)) clear = false; }
          if (clear) { g[y][x] = "~"; rim.push({ x, y }); }
          continue;
        }
        const r = hashRand(x, y, seed + 11);
        const t = kind === "rocky" ? (r < 0.45 ? "boulder" : r < 0.8 ? "tree" : "bush") : (r < 0.62 ? "tree" : r < 0.88 ? "bush" : "boulder");
        if (t === "tree" && k > 0 && hashRand(x, y, seed + 13) < 0.45) continue;   // woods, not a wall of forest
        put(t, x, y);
      }
    }
    if (exits[d]) for (let i = SPAN[d][0]; i <= SPAN[d][1]; i++) { const x = d === "w" ? 0 : d === "e" ? COLS - 1 : i, y = d === "n" ? 0 : d === "s" ? ROWS - 1 : i; g[y][x] = "e"; }
  }
  for (let y = 2; y < ROWS - 2; y++) for (let x = 2; x < COLS - 2; x++) {
    if (g[y][x] !== "." || kept.has(`${x},${y}`)) continue;
    let open = true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy][x + dx] !== ".") open = false;
    if (open && hashRand(x, y, seed + 21) < 0.04) put(hashRand(x, y, seed + 22) < 0.6 ? "bush" : "boulder", x, y);
  }
  for (const ob of objs) if (["tree", "bush", "boulder", "oak"].includes(ob.t) && wet(ob.x, ob.y)) { ob.gone = true; g[ob.y][ob.x] = "."; }
  for (let pass = 0; pass < 12; pass++) {
    markBanks(g);
    const q = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === "e") q.push([x, y]);
    const seen = new Set(q.map(([x, y]) => y * COLS + x));
    while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = ny * COLS + nx; if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !seen.has(k) && ".,sep".includes(g[ny][nx])) { seen.add(k); q.push([nx, ny]); } } }
    const stuck = []; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (".,sp".includes(g[y][x]) && !seen.has(y * COLS + x)) stuck.push([x, y]);
    if (!stuck.length) break;
    for (const [x, y] of stuck) {
      if (g[y][x] === "." && !kept.has(`${x},${y}`)) put(hashRand(x, y, seed + 41) < 0.3 ? "tree" : "bush", x, y);
      else for (const ob of rim) if (!ob.gone && Math.abs(ob.x - x) <= 1 && Math.abs(ob.y - y) <= 1) { ob.gone = true; g[ob.y][ob.x] = "."; }
    }
  }
  for (let i = objs.length - 1; i >= 0; i--) if (objs[i].gone) objs.splice(i, 1);
  markBanks(g);
}

export const SCENES = {
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
      objs.push({ t: "yew", x: 8, y: 1, name: "Ancient Yew", special: true, req: { skill: "woodcutting", lvl: 60 }, log: "yewlogs", xp: 175, tease: "Its golden needles hum as you get close." }); g[1][8] = "#";
      const clearing = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) clearing.push([8 + dx, 1 + dy]);
      wild(g, objs, this.exits, { n: "forest", w: "forest", s: "water", e: "forest" }, [...keepOf(this), ...clearing], 1);
      return { g, objs, blobs: [] };
    },
    mobs: [["cow", 12, 5], ["cow", 15, 8], ["cow", 19, 4], ["cow", 14, 9], ["cow", 18, 10]],
    npcs: [{ name: "Bom Trady", art: "tom", quests: ["firewood", "cattle"], outOfWork: "I'm all out of work for you, rookie. You've earned your cleats.", x: 10, y: 5, still: true, hair: "#c86a2a", shirt: "#3a6ac8", pants: "#2a2a4a", lines: ["Mind the cows, gladiator. They blitz.", "Your pickaxe, axe and rod are in your bag. Hold the right one for the job.", "Town's north, through the gate. The river's east.", "Sundays I play. The rest of the week, I farm. Don't ask."] },
           { name: "Waldy", art: "waldy", x: 6, y: 9, hair: "#3a2a1a", shirt: "#8a3a2a", pants: "#4a3a2a", lines: ["Every champion started on cows.", "Hit them until they stop mooing. That's the whole trick.", "The bucket? Keeps the thoughts in.", "Don't go west of town. The olives have opinions."] }],
    bots: [{ name: "Crixus", level: 42 }]
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
    npcs: [{ name: "Charon the Ferryman", x: 15, y: 11, still: true, opens: "ferry", hair: "#e8e8e8", shirt: "#3a3a5a", pants: "#2a2a3a", lines: ["Islands. Everyone gets one. Nobody knows who's paying for them.", "I row, you ride. No refunds, no questions, no singing.", "Your island grows while you're away. Mine doesn't. I don't have one. It's fine."] },
      { name: "Old Tullius", art: "tullius", quests: ["catch"], x: 15, y: 6, hair: "#d8d8d8", shirt: "#5a7a3a", pants: "#3a3a2a", lines: ["The fish bite best where the water bubbles.", "Can't fish with a sword, lad. Hold your rod.", "Don't let the chickens fool you. One took my eye.", "That big copper vein never runs dry. Slow, mind."] }],
    bots: [{ name: "Spartacus", level: 77 }]
  },
  forum: {
    name: "The Forum", exits: { s: "farm", w: "grove", n: "tomato", e: "appia" },
    build() {
      const g = grid(), objs = [];
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const dx = (x - 10.5) / 9.6, dy = (y - 5.6) / 5.4, wob = (hashRand(x, y, 51) - 0.5) * 0.22;
        if (dx * dx + dy * dy < 1 + wob) g[y][x] = "p";
      }
      // roads out of town on all four sides
      for (let y = 7; y < ROWS; y++) for (let x = 16; x <= 18; x++) g[y][x] = "p";
      for (let x = 0; x < 4; x++) for (let y = 5; y <= 7; y++) g[y][x] = "p";
      for (let y = 0; y < 5; y++) for (let x = 16; x <= 18; x++) g[y][x] = "p";
      for (let x = 18; x < COLS; x++) for (let y = 5; y <= 7; y++) g[y][x] = "p";
      const paved = g.map((r) => r.slice());
      const bath = { t: "house", x: 2, y: 1, w: 6, h: 3, door: { x: 4, y: 3 }, name: "Bank", roof: "#8a9aa8", wall: "#efe6d4", sign: "BANK", enter: "bathhouse" };
      const forge = { t: "house", x: 10, y: 1, w: 6, h: 3, door: { x: 13, y: 3 }, name: "Forge", roof: "#7a4a3a", wall: "#c8b89a", sign: "STORE" };
      objs.push(bath, forge); block(g, 2, 1, 6, 3); block(g, 10, 1, 6, 3);
      objs.push({ t: "fountain", x: 10, y: 6, w: 2, h: 2, name: "Fountain" }); block(g, 10, 6, 2, 2);
      objs.push({ t: "rock", ore: "stardust", x: 5, y: 6, name: "Fallen Star", special: true, glow: "#e0b0ff", req: { skill: "mining", lvl: 50 }, xp: 150, tease: "It landed during the games last spring. Nobody's managed to chip it since." }); g[6][5] = "#";
      objs.push({ t: "notice", x: 8, y: 2, name: "Notice board" }); g[2][8] = "#";
      // the Exchange: a market stall where offers are placed and collected
      objs.push({ t: "stall", x: 14, y: 5, w: 2, h: 1, name: "Exchange stall" }); block(g, 14, 5, 2, 1);
      objs.push({ t: "statue", x: 15, y: 9, name: "Statue" }); g[9][15] = "#";
      objs.push({ t: "sign", x: 19, y: 3, name: "Signpost" }); g[3][19] = "#";
      for (const [x, y] of [[6, 9], [13, 9]]) { objs.push({ t: "bush", x, y, name: "Planter" }); g[y][x] = "#"; }
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === "#" && paved[y][x] === "p") g[y][x] = "P";
      wild(g, objs, this.exits, { n: "forest", s: "forest", w: "forest", e: "forest" }, keepOf(this), 4);
      return { g, objs, blobs: [] };
    },
    mobs: [],
    npcs: [{ name: "Livia the Broker", x: 15, y: 4, still: true, opens: "exchange", reach: 2, hair: "#2a1a10", shirt: "#c89a2a", pants: "#3a2a1a", lines: ["Selling? Buying? Use the stall. I just take my 1%.", "Offers keep working while you sleep. Come back and collect.", "The best price wins, and whoever was there first."] },
           { name: "Gaius", x: 7, y: 7, hair: "#5a3a2a", shirt: "#9a3a5a", pants: "#3a2a3a", pigeon: true, lines: ["PIGEON: Coo. The Forge buys ore. Coo.", "PIGEON: He doesn't talk. I do the talking. Coo.", "PIGEON: The Bank keeps your things safe. Aurelia counts everything twice. Coo.", "PIGEON: West is the Olive Grove. Bring a sword. Seriously. Coo.", "PIGEON: North is Tomatoe Hill. Don't correct her spelling. Coo.", "PIGEON: East is the Via Appia. Highwaymen. Hold on to your Cash. Coo."] }],
    bots: [{ name: "Gannicus", level: 55 }, { name: "Naevia", level: 31 }]
  },
  grove: {
    name: "Olive Grove", exits: { e: "forum" },
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
  }
};
// where a brand-new character appears: just outside the farmhouse door
Object.assign(SCENES, {
  // north of the Forum: a hill of tomato vines, a giant tomato, and a Nonna who insists on the spelling
  tomato: {
    name: "Tomatoe Hill", exits: { s: "forum" },
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
  // east of the Forum: the great road, a toll post, highwaymen, and a barricade where the road washed out
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
  }
});
export const START = { scene: "farm", x: 4, y: 5 };

/* interiors: a room in the middle of the dark. "e" tiles on the room's bottom edge lead back out to exitTo.
   Rooms are drawn by the page from their floor kind and objects; nothing grows or spawns indoors. */
function room(x0, y0, x1, y1, doorX) {
  const g = grid("v");
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = "i";
  g[y1 + 1][doorX] = "e"; g[y1 + 1][doorX + 1] = "e";
  return g;
}
Object.assign(SCENES, {
  // the scene key stays "bathhouse" so saved characters standing in it still load; everything a player sees says Bank
  bathhouse: {
    name: "The Bank", interior: true, floor: "marble", room: [4, 3, 17, 10], exitTo: { scene: "forum", x: 4, y: 4 }, entry: { x: 10, y: 10 },
    // on the back wall, left to right: a banner, a lamp, the vault door, a lamp, a banner
    wall: [{ t: "banner", x: 6 }, { t: "lamp", x: 8.5 }, { t: "vault", x: 10.5 }, { t: "lamp", x: 12.5 }, { t: "banner", x: 15 }],
    build() {
      const g = room(4, 3, 17, 10, 10), objs = [];
      // the bank counter runs wall to wall; the tellers work behind it
      for (const x of [6, 10, 14]) objs.push({ t: "booth", x, y: 4, name: "Bank booth" });
      objs.push({ t: "counter", x: 4, y: 4, w: 14, h: 1, name: "Counter" }); block(g, 4, 4, 14, 1);
      // a red runner from the door to the counter (you walk on it)
      objs.push({ t: "rug", x: 10, y: 5, w: 2, h: 6, color: "#9a2a2a", name: "Runner" });
      for (const [x, y] of [[4, 6], [17, 6], [4, 9], [17, 9]]) { objs.push({ t: "column", x, y, name: "Column" }); g[y][x] = "#"; }
      for (const [x, y] of [[5, 5], [16, 5], [6, 10], [15, 10]]) { objs.push({ t: "plant", x, y, name: "Potted palm" }); g[y][x] = "#"; }
      objs.push({ t: "bench", x: 6, y: 7, w: 3, h: 1, name: "Bench" }); block(g, 6, 7, 3, 1);
      objs.push({ t: "bench", x: 13, y: 7, w: 3, h: 1, name: "Bench" }); block(g, 13, 7, 3, 1);
      objs.push({ t: "goatstatue", x: 7, y: 9, name: "Statue" }); g[9][7] = "#";
      objs.push({ t: "chest", x: 14, y: 9, name: "Strongbox" }); g[9][14] = "#";
      return { g, objs, blobs: [] };
    },
    mobs: [], bots: [],
    npcs: [{ name: "Aurelia", x: 10, y: 3, still: true, opens: "bank", reach: 2, hair: "#1a1a2a", shirt: "#3a6a8a", pants: "#2a2a3a", lines: ["Welcome to the Bank. Your things are safe with us. Mostly.", "Use any booth. I'm the one counting.", "Two hundred different things we'll hold for you. Stack them as high as you like."] }]
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
  }
});
/* the Wilderness: down the pit on the farm. pvp: anyone can attack anyone. The Cage is a fenced ring where
   fights cost nothing; beyond it, and in the Deep Wild, monsters come for you and dying can cost you. */
Object.assign(SCENES, {
  wild: {
    name: "The Wilderness", pvp: true, exits: { n: "deep" }, entry: { x: 3, y: 10 }, tint: "rgba(60,20,70,.26)",
    cage: [6, 3, 12, 6], cageOut: { x: 9, y: 9 },
    build() {
      const g = grid(), objs = [], keep = [];
      for (let x = 3; x <= 17; x++) g[10][x] = ",";
      for (let y = 0; y < 10; y++) g[y][17] = ",";
      for (let y = 8; y < 10; y++) g[y][9] = ",";
      objs.push({ t: "rope", x: 2, y: 10, name: "Rope" }); g[10][2] = "#";
      // the Cage: iron bars round a ring, one gap at the bottom
      for (let x = 5; x <= 13; x++) { objs.push({ t: "cageH", x, y: 2 }); g[2][x] = "#"; if (x !== 9) { objs.push({ t: "cageH", x, y: 7 }); g[7][x] = "#"; } }
      for (let y = 3; y <= 6; y++) for (const x of [5, 13]) { objs.push({ t: "cageV", x, y }); g[y][x] = "#"; }
      for (let y = 3; y <= 6; y++) for (let x = 6; x <= 12; x++) { g[y][x] = "s"; keep.push([x, y]); }
      objs.push({ t: "cagesign", x: 8, y: 8, name: "The Cage" }); g[8][8] = "#";
      for (const [x, y] of [[15, 3], [20, 7]]) { objs.push({ t: "gravestone", x, y, name: "Gravestone" }); g[y][x] = "#"; }
      objs.push({ t: "skeleton", x: 12, y: 11, name: "Skeleton" }); g[11][12] = "#";
      for (const [x, y] of [[15, 8], [20, 2], [3, 5]]) { objs.push({ t: "snag", x, y, name: "Dead tree" }); g[y][x] = "#"; }
      for (let x = 3; x <= 17; x++) keep.push([x, 10], [x, 9]);
      wild(g, objs, this.exits, { n: "rocky", s: "rocky", w: "rocky", e: "rocky" }, [...keepOf(this), ...keep], 7);
      return { g, objs, blobs: [] };
    },
    mobs: [["gnasher", 16, 6], ["gnasher", 20, 10], ["gnasher", 4, 3]],
    npcs: [], bots: []
  },
  deep: {
    name: "The Deep Wild", pvp: true, exits: { s: "wild" }, tint: "rgba(50,10,45,.38)", xpMul: 1.5, luck: 0.1, geode: 0.01,
    build() {
      const g = grid(), objs = [], keep = [];
      for (let y = 7; y < ROWS; y++) g[y][17] = ",";
      for (let x = 4; x <= 17; x++) g[7][x] = ",";
      // the Black Pool, fished from two tiles back
      for (let y = 2; y <= 4; y++) for (let x = 2; x <= 6; x++) g[y][x] = "~";
      for (const x of [3, 5]) objs.push({ t: "spot", x, y: 4, name: "Black pool", req: { skill: "fishing", lvl: 20 }, fish: "gloomfin", xp: 80, glow: "#b080ff", tease: "The water is black and very still. Something down there is even stiller." });
      for (let y = 5; y <= 6; y++) for (let x = 2; x <= 7; x++) keep.push([x, y]);
      for (const [x, y] of [[10, 3], [12, 2], [13, 4]]) { objs.push({ t: "rock", ore: "grimstone", x, y, name: "Grimstone rock", req: { skill: "mining", lvl: 20 }, xp: 60, tease: "Cold purple stone. Your pickaxe skids right off." }); g[y][x] = "#"; }
      for (const [x, y] of [[8, 10], [10, 11], [13, 10]]) { objs.push({ t: "deadtree", x, y, name: "Deadwood tree", log: "ashlogs", req: { skill: "woodcutting", lvl: 20 }, xp: 70, tease: "Grey, hard as bone. Your axe just bounces." }); g[y][x] = "#"; }
      for (const [x, y] of [[20, 3], [7, 12], [19, 11]]) { objs.push({ t: "gravestone", x, y, name: "Gravestone" }); g[y][x] = "#"; }
      objs.push({ t: "skeleton", x: 15, y: 9, name: "Skeleton" }); g[9][15] = "#";
      for (const [x, y] of [[9, 5], [16, 2]]) { objs.push({ t: "snag", x, y, name: "Dead tree" }); g[y][x] = "#"; }
      for (let x = 4; x <= 17; x++) keep.push([x, 7], [x, 8], [x, 6]);
      for (let y = 7; y < ROWS; y++) keep.push([16, y], [18, y]);
      wild(g, objs, this.exits, { n: "rocky", s: "rocky", w: "rocky", e: "rocky" }, [...keepOf(this), ...keep], 8);
      return { g, objs, blobs: [] };
    },
    mobs: [["taxwraith", 15, 4], ["taxwraith", 19, 6], ["chandelier", 5, 10], ["chandelier", 20, 9], ["revenant", 11, 9]],
    npcs: [], bots: []
  },
  /* a player's island: the same layout for everyone, reached by the ferry at River Bend. What's planted, shown and
     painted lives on the owner's character (c.isle); the server sends it with each snapshot. */
  isle: {
    name: "Island", island: true, exitTo: { scene: "river", x: 15, y: 10 }, entry: { x: 10, y: 10 },
    build() {
      const g = grid("~"), objs = [];
      for (let y = 1; y <= 10; y++) for (let x = 1; x < COLS - 1; x++) if (((x - 10.5) / 8.6) ** 2 + ((y - 5.5) / 4.9) ** 2 <= 1) g[y][x] = ".";
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (g[y][x] === ".") { let wet = false; for (const [dx, dy] of D8) if (g[y + dy]?.[x + dx] === "~") wet = true; if (wet) g[y][x] = "s"; }
      // the dock: planks out to the ferry; the far end takes you back to River Bend
      for (let y = 10; y < ROWS; y++) for (const x of [10, 11]) g[y][x] = y === ROWS - 1 ? "e" : "p";
      objs.push({ t: "dock", x: 10, y: 10, w: 2, h: 3 });
      objs.push({ t: "boatback", x: 12, y: 11, w: 2, h: 1, name: "Ferry" });
      const house = { t: "house", img: "hut", x: 8, y: 1, w: 5, h: 3, door: { x: 10, y: 3 }, name: "Cottage" }; objs.push(house); block(g, 8, 1, 5, 3);
      [[4, 5], [5, 5], [6, 5], [7, 5], [4, 7], [5, 7], [6, 7], [7, 7]].forEach(([x, y], i) => { objs.push({ t: "plot", i, x, y, name: "Plot" }); g[y][x] = "#"; });
      [[13, 5], [15, 5], [17, 5], [13, 7], [15, 7], [17, 7]].forEach(([x, y], i) => { objs.push({ t: "pedestal", i, x, y, name: "Pedestal" }); g[y][x] = "#"; });
      objs.push({ t: "pen", x: 13, y: 9, w: 3, h: 1, name: "Pet pen" }); block(g, 13, 9, 3, 1);
      objs.push({ t: "islesign", x: 8, y: 9, name: "Island sign" }); g[9][8] = "#";
      for (const [x, y] of [[4, 3], [16, 3], [3, 8]]) { objs.push({ t: "palm", x, y, name: "Tree" }); g[y][x] = "#"; }
      return { g, objs, blobs: [] };
    },
    mobs: [], npcs: [], bots: []
  }
});

// scene keys: most are a SCENES key; a player's island is "isle:<owner id>", every island built from SCENES.isle
export const sceneDef = (key) => SCENES[String(key).split(":")[0]];
export const isIsle = (key) => String(key).startsWith("isle:");
// the same scene, built the same way everywhere; every object gets its index as its id
export function buildScene(key) {
  const sc = sceneDef(key), b = sc.build.call(sc);
  markBanks(b.g);
  b.objs.forEach((o, i) => { o.id = i; o.w ??= 1; o.h ??= 1; });
  return b;
}
export const walkableIn = (g, x, y, swim = false) => x >= 0 && y >= 0 && x < COLS && y < ROWS && (swim ? ".,sepfib~" : ".,sepfi").includes(g[y][x]);
export const canStepIn = (g, x, y, dx, dy, swim = false) => walkableIn(g, x + dx, y + dy, swim) && (!dx || !dy || (walkableIn(g, x + dx, y, swim) && walkableIn(g, x, y + dy, swim)));
// 8-way BFS with no corner cutting. reach 0: stand on it; n: stand within n tiles of it
export function findPath(g, from, to, reach = 0) {
  const key = (x, y) => y * COLS + x, prev = new Map([[key(from.x, from.y), null]]), q = [{ x: from.x, y: from.y }];
  const done = (c) => { const d = cheb(c, to); return reach ? d >= 1 && d <= reach : d === 0; };
  if (done(from)) return [];
  while (q.length) {
    const c = q.shift();
    if (done(c)) { const p = []; let k = key(c.x, c.y); while (k != null) { p.unshift({ x: k % COLS, y: Math.floor(k / COLS) }); k = prev.get(k); } p.shift(); return p; }
    for (const [dx, dy] of D8) { const nx = c.x + dx, ny = c.y + dy, k = key(nx, ny); if (!prev.has(k) && canStepIn(g, c.x, c.y, dx, dy)) { prev.set(k, key(c.x, c.y)); q.push({ x: nx, y: ny }); } }
  }
  return null;
}
// the tile an object is worked from: the footprint cell nearest to you
export function nearestCell(ob, from) {
  const x = Math.max(ob.x, Math.min(from.x, ob.x + (ob.w || 1) - 1)), y = Math.max(ob.y, Math.min(from.y, ob.y + (ob.h || 1) - 1));
  return { x, y };
}

/* ------------------------------------------------------------ monsters */
// drops: [item, n] always; [item, [lo, hi]] a range; [item, n, chance] sometimes
export const MOBS = {
  cow: { name: "Cow", lvl: 2, hp: 8, att: 1, def: 1, max: 1, speed: 3000, oy: 11, box: [11, 20], drops: [["beef", 1], ["hide", 1], ["bones", 1]] },
  chicken: { name: "Chicken", lvl: 1, hp: 3, att: 1, def: 1, max: 1, speed: 2400, oy: 11, box: [7, 14], drops: [["chicken", 1], ["feather", [5, 15]], ["bones", 1]] },
  olive: { name: "Angry Olive", lvl: 6, hp: 12, att: 5, def: 4, max: 2, speed: 2600, box: [7, 16], drops: [["olives", [2, 5]], ["pit", 1], ["monocle", 1, 0.1]] },
  boar: { name: "Wild boar", lvl: 8, hp: 16, att: 6, def: 6, max: 2, speed: 2800, box: [11, 16], drops: [["pork", 1], ["tusk", 1], ["bones", 1]] },
  rotten: { name: "Rotten Tomatoe", lvl: 4, hp: 10, att: 3, def: 2, max: 1, speed: 2600, box: [8, 14], drops: [["tomatoe", [1, 3]], ["husk", 1, 0.05]] },
  hornworm: { name: "Tomatoe Hornworm", lvl: 7, hp: 15, att: 6, def: 5, max: 2, speed: 2800, box: [12, 12], drops: [["husk", 1], ["tomatoe", 1, 0.5]] },
  highwayman: { name: "Highwayman", lvl: 12, hp: 22, att: 10, def: 9, max: 3, speed: 2400, box: [7, 26], drops: [["coins", [5, 20]], ["bones", 1], ["mask", 1, 0.15]] },
  gnasher: { name: "Bog Gnasher", lvl: 18, hp: 30, att: 14, def: 12, max: 4, speed: 2600, aggro: 3, oy: 12, box: [11, 16], drops: [["bones", 1], ["coins", [5, 25]], ["bogplate", 1, 0.03]] },
  taxwraith: { name: "Tax Wraith", lvl: 28, hp: 42, att: 20, def: 18, max: 5, speed: 2400, aggro: 4, box: [8, 26], drops: [["coins", [20, 80]], ["receipt", 1], ["wraithhood", 1, 0.03], ["menace", 1, 0.02], ["spiderboots", 1, 0.004]] },
  chandelier: { name: "Chandelier Spider", lvl: 34, hp: 50, att: 24, def: 20, max: 6, speed: 2600, aggro: 4, oy: 12, box: [13, 22], drops: [["cobweb", 1], ["bones", 1], ["lantern", 1, 0.03], ["spiderboots", 1, 0.01]] },
  revenant: { name: "Sulking Revenant", lvl: 45, hp: 80, att: 32, def: 28, max: 8, speed: 2800, aggro: 5, box: [9, 30], drops: [["bones", 2], ["coins", [50, 150]], ["grudge", 1, 0.04], ["menace", 1, 0.03]] },
  goat: { name: "Goat in a Toga", lvl: 12, hp: 24, att: 9, def: 8, max: 3, speed: 2400, box: [8, 26], drops: [["manifesto", 1], ["bones", 1], ["toga", 1, 0.25]] }
};

/* ------------------------------------------------------------ words */
// what it takes to climb down into the Wilderness (PvP). Change it here.
export const WILD_REQ = { skill: "melee", lvl: 10 };
// dying outside the Cage: a quarter of the time one worn item falls where you died. The killer alone can take it
// for lootMs, then anyone, until it's gone. Leaving mid-fight leaves your character standing there for lingerMs.
export const PVP = { drop: 0.25, lootMs: 60000, groundMs: 180000, lingerMs: 10000 };
// how long a monster stays dead: 15s everywhere, but in the Wilderness it scales with level, from 1 minute
// (level 15 and under) to 3 minutes (level 45 and up), so a kill there is worth something
export const respawnMs = (sc, t) => (sc?.pvp ? 60000 + Math.round(Math.max(0, Math.min(1, (MOBS[t].lvl - 15) / 30)) * 120000) : 15000);
export const fmtWait = (ms) => { const s = Math.round(ms / 1000), m = Math.floor(s / 60); return m ? `${m}m${s % 60 ? ` ${s % 60}s` : ""}` : `${s}s`; };
export const inCage = (def, x, y) => !!def?.cage && x >= def.cage[0] && x <= def.cage[2] && y >= def.cage[1] && y <= def.cage[3];

// islands: everyone has one. Plots grow in real time (online or not); pedestals show off one item each.
export const ISLE = { plots: 8, shelf: 6 };
export const ISLE_FERRY = { scene: "river", x: 15, y: 10 };
export const CROPS = {
  wheat: { lvl: 1, ms: 10 * 60000, yield: [3, 5], xp: 30 },
  tomatoe: { lvl: 5, ms: 20 * 60000, yield: [3, 6], xp: 70 },
  goldtomatoe: { lvl: 50, ms: 4 * 3600000, yield: [1, 3], xp: 600 }
};
// a theme repaints your island; price null means you can't buy it (events, quests)
export const THEMES = {
  meadow: { name: "Meadow", icon: "🌿", ex: "Green grass, round trees, a nice breeze.", price: 0 },
  dunes: { name: "Sunny Dunes", icon: "🏝️", ex: "Warm sand, palm trees and one crab that watches you.", price: 2500 },
  gloom: { name: "Gloom", icon: "🕸️", ex: "Grey grass, bare trees, a little fog. Not for sale.", price: null }
};
export const EXAMINE = {
  notice: ["NOTICE: Lost, one (1) sense of smell. If found, return to Waldy.", "NOTICE: The Forge buys ore. The Forge always buys ore.", "NOTICE: Do NOT feed the olives.", "NOTICE: Wanted: goat, wears a toga, answers to 'Senator'. Do not debate him."],
  sign: ["Via Appia → Closed: bandits. (Coming soon.)"],
  hive: ["The bees are humming the same four notes. Over and over.", "One bee is wearing a tiny helmet. It salutes you."],
  statue: ["'GALLUS THE BRAVE. He did not flinch.' It's a chicken."],
  fountain: ["The water tastes faintly of coins. People keep throwing Cash in it."],
  fire: ["A campfire. Cooking comes soon; for now it's just warm."],
  bush: ["A bush. Something inside it is breathing.", "Just a bush. Probably.", "A bush. It rustles when you aren't looking."],
  boulder: ["A big rock. Too big for your pickaxe. For now.", "Someone has scratched 'CRIXUS WAS HERE' into it."],
  hay: ["A hay bale. Waldy sleeps on it, sometimes."],
  counter: ["Polished marble. Aurelia polishes it when she's nervous, which is always."],
  pool: ["Warm, and suspiciously green. Nobody bathes here any more; they just store things."],
  column: ["A marble column. Someone has carved 'Z WAS HERE' into the base."],
  range: ["A wood-burning range. Cooking comes soon."],
  table: ["A heavy farmhouse table. It's seen a lot of stew."],
  barrel: ["Full of something that smells like olives. Or feet."],
  bed: ["Waldy's bed, apparently. There's a bucket-shaped dent in the pillow."],
  plant: ["A potted palm. Someone has been watering it with wine.", "A potted palm. It's doing better than most of the customers."],
  bench: ["A marble bench, for waiting. Nobody waits. Aurelia is very fast."],
  goatstatue: ["'THE FIRST DEPOSITOR.' A bronze goat, clutching a coin purse. It looks smug."],
  chest: ["The vault's overflow. Locked. Aurelia has the key and won't say where."],
  rug: ["A good rug. Mind your sandals."],
  chair: ["A three-legged stool. Bom has broken four of these."],
  sack: ["A sack of flour. Baking comes later."],
  cat: ["A cat wearing a tiny gladiator helmet. It judges you.", "The cat's helmet has a little crest. It has clearly won fights."],
  bucket: ["Waldy's spare bucket. Freshly polished. It has googly eyes too."],
  bigtomato: ["The Big Tomatoe. It's warm. It's slightly soft. There's a door-shaped outline you choose not to think about."],
  press: ["A tomatoe press. It smells like every summer at once."],
  crate: ["A crate of tomatoes, each one labelled TOMATOE in careful handwriting."],
  scarecrow: ["A scarecrow with a tomato for a head. The crows seem fine with it. The crows seem to love it."],
  cypress: ["A tall, thin cypress. The road is lined with them, all leaning very slightly east."],
  milestone: ["'ROMA · MILES: ' and then nothing. Someone scratched the number off. Twice.", "'YOU ARE HERE.' Helpful."],
  toll: ["A toll post. The price board has been painted over with 'NO'."],
  barricade: ["Timber and rope. Past it, the road just stops: washed out. The Bandit Camp is somewhere beyond."],
  chariot: ["A chariot with one wheel. Whoever left it left in a hurry, or a very bad mood."],
  rope: ["A rope back up to the farm. Somebody has tied a very bad knot, but it holds."],
  cagesign: ["THE CAGE. Fight anyone in here as much as you like: nobody loses anything, and nobody learns anything."],
  gravestone: ["'HERE LIES KEVIN. He went in for one more ore.'", "'HERE LIES A PERSON WHO SAID IT WAS SAFE.'", "The name's worn off. Someone has left a single, very small shoe."],
  skeleton: ["A skeleton, still holding a fishing rod. It's got a bite.", "A skeleton in a comfortable pose. It looks like it's waiting for someone."],
  snag: ["A dead tree. It creaks when nothing is moving."],
  pen: ["A pet pen, empty for now. Something will live here one day."],
  mule: ["A mule. It refuses to move. It has refused for eleven years.", "The mule looks at you. You feel judged by a professional."]
};
export const VERB = { pvp: "Attack", ground: "Take", rope: "Climb-up", ferry: "Board", boatback: "Sail-home", plot: "Tend", pedestal: "Use", islesign: "Read", bank: "Bank at", exchange: "Trade at", player: "Trade with", enter: "Enter", hole: "Climb-down", mob: "Attack", npc: "Talk-to", wheat: "Pick", spot: "Fish", door: "Open", well: "Search", rock: "Mine", vein: "Mine", tree: "Chop down", olive: "Pick", shrine: "Pray-at", notice: "Read", sign: "Read" };

/* ------------------------------------------------------------ quests are data
   goal.type "bring": have goal.n of goal.items in your bag when you talk to the giver (they're taken)
   goal.type "kill":  defeat goal.n of goal.mob after you've accepted
   requires: quests that must be done first. {have} in a line is replaced with your progress. */
export const QUESTS = {
  firewood: {
    name: "Firewood", giver: "Bom Trady", where: "Ludus Farm", icon: "🪵",
    goal: { type: "bring", items: ["logs"], n: 5, what: "logs" },
    brief: "Bring Bom Trady 5 logs for the ludus kitchen.",
    talk: {
      offer: ["Hey, rookie. Kitchen's out of firewood, and I've got a game Sunday.", "Bring me 5 logs. The oak down by the path is a good one. Hold your axe, not your sword, then click a tree."],
      accept: "I'll get your logs.", decline: "Not right now.",
      accepted: "Attaboy. The oak's just southeast of here. Don't chop Waldy.",
      progress: "How's that firewood coming? I need 5 logs. You've got {have}.",
      ready: "Now those are logs. Hand 'em over.", hand: "Here you go.",
      done: "Kitchen's warm. You did good, rookie. Come back when you want real work."
    },
    reward: { coins: 40, xp: { woodcutting: 150 }, text: "40 Cash, 150 Woodcutting xp" }
  },
  cattle: {
    name: "Cattle Drive", giver: "Bom Trady", where: "Ludus Farm", icon: "🐄", requires: ["firewood"],
    goal: { type: "kill", mob: "cow", n: 5, what: "cows" },
    brief: "Bom Trady wants 5 cows seen to.",
    talk: {
      offer: ["Real work, as promised. The cows have been running routes on my field.", "Put 5 of them down. Hold your sword for this one."],
      accept: "Consider it done.", decline: "Maybe later.",
      accepted: "Hit them until they stop mooing. Waldy says that's the whole trick.",
      progress: "That's {have} cows so far. I said 5.",
      ready: "Field's quiet. You're a natural.", hand: "What do I get?",
      done: "Cash, and my respect. Mostly the Cash."
    },
    reward: { coins: 60, xp: { melee: 200 }, text: "60 Cash, 200 Melee xp" }
  },
  catch: {
    name: "Catch of the Day", giver: "Old Tullius", where: "River Bend", icon: "🐟",
    hint: "Old Tullius needs a hand down at River Bend. Head east from the farm, through the blue, and look for the old man by the water.",
    goal: { type: "bring", items: ["sardine", "trout"], n: 3, what: "raw fish" },
    brief: "Bring Old Tullius 3 raw fish.",
    talk: {
      offer: ["My back's gone, lad, and the fish won't catch themselves.", "Bring me 3 raw fish. Hold your rod and click where the water bubbles."],
      accept: "I'll catch you some.", decline: "Not today.",
      accepted: "Good lad. Mind the chickens.",
      progress: "{have} fish so far. I said 3.",
      ready: "Oh, lovely fish. Give them here.", hand: "Here they are.",
      done: "Supper sorted. Here, take something for your trouble."
    },
    reward: { coins: 40, xp: { fishing: 150 }, text: "40 Cash, 150 Fishing xp" }
  }
};

/* ------------------------------------------------------------ a character */
export const DEFAULT_SETTINGS = { xpDrops: true, gainPops: true, skillRing: true, names: true, hoverTile: true, groupNotes: true, debug: false, reducedMotion: false, confirmDrop: true };
export const SETTING_INFO = {
  xpDrops: ["XP drops", "Show +xp over your head when you earn it."],
  gainPops: ["Item pops", "Show what you (and others) gather popping up over their heads."],
  skillRing: ["Skill ring", "Show the progress ring for the skill you're training."],
  names: ["Names", "Show names and levels under players, NPCs and monsters."],
  hoverTile: ["Tile outline", "Outline the tile under your mouse."],
  groupNotes: ["Group bonus messages", "Say so when others working the same thing give you a bonus."],
  confirmDrop: ["Confirm drops", "Ask before shift-click drops an item."],
  reducedMotion: ["Reduce motion", "No bobbing, flashing or drifting sparkles."],
  debug: ["Debug info", "Show your tile, the mouse tile and your action in the corner."]
};
export function freshChar() {
  return {
    v: 1, scene: START.scene, x: START.x, y: START.y, hp: 10,
    inv: [{ k: "coins", n: 25 }, { k: "pickaxe", n: 1 }, { k: "axe", n: 1 }, { k: "rod", n: 1 }],
    eq: { helm: "cap", weapon: "rudis", body: "tunic", shield: "parma", legs: null, gloves: null, boots: "sandals", ring: null },
    xp: { melee: 0, hp: XP_AT[10], fishing: 0, farming: 0, mining: 0, woodcutting: 0 },
    qs: {}, bank: [], settings: { ...DEFAULT_SETTINGS }, created: Date.now(),
    isle: { plots: Array(ISLE.plots).fill(null), shelf: Array(ISLE.shelf).fill(null), theme: "meadow", themes: ["meadow"], open: true }
  };
}
// fill in anything a stored character is missing, and drop what isn't real any more
export function normChar(c) {
  const f = freshChar();
  if (!c || typeof c !== "object") return f;
  const out = { ...f, ...c, xp: { ...f.xp, ...(c.xp || {}) }, eq: { ...f.eq, ...(c.eq || {}) }, settings: { ...f.settings, ...(c.settings || {}) }, qs: { ...(c.qs || {}) } };
  out.inv = (Array.isArray(c.inv) ? c.inv : f.inv).filter((s) => s && ITEMS[s.k] && s.n > 0).slice(0, INV_MAX);
  out.bank = (Array.isArray(c.bank) ? c.bank : []).filter((s) => s && ITEMS[s.k] && s.n > 0).slice(0, BANK_MAX);
  for (const s of SLOTS) if (out.eq[s] && !ITEMS[out.eq[s]]) out.eq[s] = null;
  if (!SCENES[out.scene]) Object.assign(out, isIsle(out.scene) ? ISLE_FERRY : START);   // back from an island: the ferry at River Bend
  const fi = f.isle, ci = c.isle && typeof c.isle === "object" ? c.isle : {};
  out.isle = {
    plots: Array.from({ length: ISLE.plots }, (_, i) => { const p = ci.plots?.[i]; return p && CROPS[p.k] && Number.isFinite(p.at) ? { k: p.k, at: p.at } : null; }),
    shelf: Array.from({ length: ISLE.shelf }, (_, i) => (ITEMS[ci.shelf?.[i]] ? ci.shelf[i] : null)),
    themes: [...new Set(["meadow", ...(Array.isArray(ci.themes) ? ci.themes : [])])].filter((t) => THEMES[t]),
    theme: fi.theme, open: ci.open !== false
  };
  if (out.isle.themes.includes(ci.theme)) out.isle.theme = ci.theme;
  return out;
}
export const lvlOf = (c, k) => levelOf(c.xp[k] || 0);
export const maxHpOf = (c) => lvlOf(c, "hp");
export const combatOf = (c) => Math.floor((lvlOf(c, "melee") * 1.3 + lvlOf(c, "hp")) / 2.3) + 2;
export const totalOf = (c) => Object.keys(SKILLS).reduce((n, k) => n + lvlOf(c, k), 0);
export const bonusOf = (c) => { const b = { acc: 0, str: 0, def: 0 }; for (const k of Object.values(c.eq)) if (k && ITEMS[k]) for (const q in b) b[q] += ITEMS[k][q] || 0; return b; };
export const maxHitOf = (c) => 1 + Math.floor(lvlOf(c, "melee") / 6) + Math.floor(bonusOf(c).str / 2);
export const hitChance = (att, def) => Math.max(0.1, Math.min(0.95, 0.5 + (att - def) * 0.04));

/* ------------------------------------------------------------ the Exchange
   an offer: { id, owner, name, side: "sell"|"buy", k, qty, done, price (each), at, open,
               box: { items: n waiting to collect, cash: n waiting to collect } }
   A new offer fills against the other side at the RESTING offer's price, best price first then oldest. */
export const exTax = (cash) => Math.floor(cash * EX_TAX);
export function exSummary(orders) {
  const out = {};
  for (const o of orders) {
    if (!o.open || o.done >= o.qty) continue;
    const b = (out[o.k] ||= { sell: null, sellQty: 0, buy: null, buyQty: 0 });
    const left = o.qty - o.done;
    if (o.side === "sell") { b.sellQty += left; if (b.sell == null || o.price < b.sell) b.sell = o.price; }
    else { b.buyQty += left; if (b.buy == null || o.price > b.buy) b.buy = o.price; }
  }
  return out;
}

/* ------------------------------------------------------------ quest state, read from a character */
export const qGet = (c, k) => c.qs[k] || { state: "new", n: 0 };
export const countItems = (c, keys) => c.inv.filter((x) => keys.includes(x.k)).reduce((n, x) => n + x.n, 0);
export const qHave = (c, k) => { const q = QUESTS[k]; return q.goal.type === "bring" ? countItems(c, q.goal.items) : qGet(c, k).n; };
export const qOpen = (c, q) => (q.requires || []).every((r) => qGet(c, r).state === "done");
// where a quest is now: new, locked, active, ready (can hand in), done
export function qState(c, k) {
  const q = QUESTS[k], st = qGet(c, k).state;
  if (st === "done") return "done";
  if (st === "active") return qHave(c, k) >= q.goal.n ? "ready" : "active";
  return qOpen(c, q) ? "new" : "locked";
}
// the quest an NPC is dealing with right now: the first of theirs that isn't done or locked
export const npcQuest = (c, n) => (n.quests || []).find((k) => ["new", "active", "ready"].includes(qState(c, k)));
// what an NPC with no work left says to send you on
export function nextHint(c, n) {
  const next = Object.keys(QUESTS).find((q) => !(n.quests || []).includes(q) && ["new", "active", "ready"].includes(qState(c, q)));
  return next ? (QUESTS[next].hint || `${QUESTS[next].giver} at ${QUESTS[next].where} could use a hand.`) : "That's all the work there is for now. Check back soon.";
}
