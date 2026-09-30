/* DOES THE WIKI STILL DESCRIBE THE GAME? —  node tools/eastscape-wiki-check.mjs
   (2026-09-25, the owner: "with our new content, we need to do an entire wiki pass again, i noticed some
   inconsistencies and errors, some missing icons etc")

   The wiki is two halves and only one of them can go stale. Every item, monster, area, drop and skill page is
   BUILT FROM THE RULES, so those cannot drift. The hand-written half — the guides in eastscape-wiki.js — is prose
   with numbers in it, and prose does not fail when the number under it moves. The smoking guide is the case that
   prompted this: it said "seven fish", listed three wrong heal values and capped at 34, long after the food ladder
   had been fixed and two Carnival fish had been added to it.

   So this checks the three things that break silently:

     A LINK TO A PAGE THAT IS NOT THERE. <a data-wiki="items/foo"> renders happily and does nothing when clicked,
     which is exactly what a beta tester reports as "i cant click on the nova entries".
     A MISSING ICON. ITEM_ART and SKILL_ART are ALLOWLISTS — a key not in them falls back to an emoji however good
     the png is, and a key in them with no png on disk draws a broken image. Both directions are checked.
     AND A NUMBER WRITTEN OUT IN PROSE THAT THE RULES DISAGREE WITH — but only counts of things that GROW. A price
     or a drop rate can only change deliberately; "seven fish" breaks the moment somebody adds an eighth.

   What it deliberately does NOT do is read the guides for sense. It cannot, and pretending otherwise would make a
   green run mean more than it does. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js";
import { createCryptRules } from "../v3/assets/js/eastscape-crypt-rules.js";
import { createPyramidRules } from "../v3/assets/js/eastscape-pyramid-rules.js";
import * as WK from "../v3/assets/js/eastscape-wiki.js";
import fs from "node:fs";
Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
Object.assign(G.MOBS, createCryptRules(G, G._MAP).mobs, createPyramidRules(G, G._MAP).mobs);

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);
const html = fs.readFileSync("eastscape.html", "utf8");
const setIn = (name) => {
  const i = html.indexOf(name + " = new Set([");
  if (i < 0) throw new Error(name + " not found in eastscape.html");
  const body = html.slice(i, html.indexOf("])", i));
  return new Set([...body.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
};
const ITEM_ART = setIn("ITEM_ART"), SKILL_ART = setIn("SKILL_ART");
const IDIR = "v3/assets/img/glad/flat/items/";
const onDisk = new Set(fs.readdirSync(IDIR).map((f) => f.replace(/\.png$/, "")));
const ALIAS = (() => {
  const i = html.indexOf("ART_ALIAS = {");
  if (i < 0) return {};
  const body = html.slice(i, html.indexOf("}", i));
  return Object.fromEntries([...body.matchAll(/"?(\w+)"?\s*:\s*"(\w+)"/g)].map((m) => [m[1], m[2]]));
})();

/* ---------------------------------------------------------------- what pages exist (as wikiPages() builds them) */
const routes = new Set(["home", "updates"]);
for (const g of WK.GUIDES) routes.add("guides/" + g.id);
for (const k of Object.keys(G.PETS)) routes.add("pets/" + k);
for (const k of Object.keys(G.SKILLS)) routes.add("skills/" + k);
for (const k of Object.keys(G.QUESTS)) routes.add("quests/" + k);
for (const k of Object.keys(G.ITEMS)) routes.add("items/" + k);
for (const [k, d] of Object.entries(G.SCENES)) if (!d.wikiHide) routes.add("areas/" + k);
/* a monster page exists only where the monster is PLACED — the same filter wikiPages() uses */
for (const [k, d] of Object.entries(G.SCENES)) {
  if (d.wikiHide) continue;
  for (const [t] of (d.mobs || [])) routes.add("monsters/" + t);
  for (const n of (d.npcs || [])) routes.add("npcs/" + n.name);
}
for (const g of ["Guides", "Skills", "Quests", "Monsters", "Areas", "People", "Items", "Pets", "Weekly"]) routes.add("list/" + g);   /* (2026-09-30) Pets and the Weekly issues are categories now */
routes.add("home"); routes.add("updates"); if (G.ROADMAP) { routes.add("roadmap"); for (const c of G.ROADMAP.cards) routes.add(`roadmap/${c.id}`); }   /* (2026-09-30) the Road Ahead */

/* ---------------------------------------------------------------- 1. every link goes somewhere */
{
  const src = fs.readFileSync("v3/assets/js/eastscape-wiki.js", "utf8");
  const links = [...src.matchAll(/data-wiki=\\?"([^"\\]+)/g)].map((m) => m[1]).filter((r) => !r.includes("${"));   /* (2026-09-30) a link built from data (a weekly card) is checked below, from the data */
  const WM = await import("../v3/assets/js/eastscape-wiki.js");
  for (const I of WM.WEEKLY || []) { routes.add(`weekly/${I.n}`); for (const c of I.big || []) links.push(c.wiki); for (const [r] of I.links || []) links.push(r); }
  const dead = [...new Set(links.filter((r) => !routes.has(r) && !r.startsWith("search/")))];
  if (dead.length) fail(dead.length + " guide link(s) point at a page that does not exist: " + dead.join(", "));
  else ok("all " + links.length + " links in the guides resolve to a real page");
}

/* ---------------------------------------------------------------- 2. icons */
{
  /* an allowlisted key with no file draws a broken image, which is worse than the emoji it replaced */
  const ghosts = [...ITEM_ART].filter((k) => !onDisk.has(k));
  if (ghosts.length) fail(ghosts.length + " key(s) are in ITEM_ART with no png in " + IDIR + ": " + ghosts.slice(0, 8).join(", "));
  else ok("all " + ITEM_ART.size + " allowlisted item icons have a file");

  /* the other way round: art drawn and never switched on. This is the one the owner sees as "missing icons". */
  const dark = [...onDisk].filter((f) => !f.startsWith("skill_") && !ITEM_ART.has(f) && G.ITEMS[f]);
  if (dark.length) fail(dark.length + " item(s) have art on disk that ITEM_ART does not list, so they still draw an emoji: " + dark.slice(0, 8).join(", "));
  else ok("no item art is sitting on disk unused");

  /* an item with neither art nor an emoji draws nothing at all */
  const blank = Object.entries(G.ITEMS).filter(([k, it]) => !ITEM_ART.has(ALIAS[k] || k) && !it.icon).map(([k]) => k);
  if (blank.length) fail(blank.length + " item(s) have no icon and no emoji, so their wiki entry is a blank square: " + blank.slice(0, 10).join(", "));
  else ok("all " + Object.keys(G.ITEMS).length + " items draw something");

  /* sico() is what the profile, the stats panel and the highscores draw, so a skill without art is visible everywhere */
  const noArt = Object.keys(G.SKILLS).filter((k) => !SKILL_ART.has(k));
  if (noArt.length) fail(noArt.join(", ") + " still fall back to an emoji; every other skill has drawn art");
  else ok("all " + Object.keys(G.SKILLS).length + " skills have drawn icons");
  const skGhost = [...SKILL_ART].filter((k) => !onDisk.has("skill_" + k));
  if (skGhost.length) fail("SKILL_ART lists " + skGhost.join(", ") + " with no skill_*.png on disk");
}

/* ---------------------------------------------------------------- 3. counts written out in prose */
{
  const bodyOf = (g) => (typeof g.body === "function" ? g.body(G, { ico: () => "", el: () => "", wl: (r, t) => t, esc: (s) => s }) : (g.body || ""));
  const all = WK.GUIDES.map(bodyOf).join(" ");
  const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  const num = (w) => WORDS[String(w).toLowerCase()] ?? Number(w);

  const smokes = Object.entries(G.ITEMS).filter(([k, it]) => k.startsWith("s") && it.meal && G.ITEMS[k.slice(1)]).length;
  for (const m of all.matchAll(/(\w+) (?:of these can be smoked|fish can be smoked)/gi))
    if (num(m[1]) !== smokes) fail('a guide says "' + m[1] + '" smokeable fish; there are ' + smokes);
  for (const m of all.matchAll(/(?:^|\W)(\w+) <a[^>]*>smoked fish<\/a>/gi))
    if (Number.isFinite(num(m[1])) && num(m[1]) !== smokes) fail('a guide says "' + m[1] + '" smoked fish; there are ' + smokes);

  const pets = Object.keys(G.PETS).length;
  for (const m of all.matchAll(/(\w+) pets\b/gi)) if (Number.isFinite(num(m[1])) && num(m[1]) !== pets) fail('a guide says "' + m[1] + ' pets"; PETS has ' + pets);

  const rungs = (G.TOOL_GATES || []).length;
  for (const m of all.matchAll(/come in (\w+) grades/gi)) if (num(m[1]) !== rungs) fail('a guide says tools come in "' + m[1] + '" grades; there are ' + rungs);
  /* a COUNT IN A TITLE has nowhere to be generated from - the nav, the cards, the crumbs and the search all draw
     a title without the rules to hand - so the rule is that a title must not carry one at all. */
  for (const g of WK.GUIDES) if (typeof g.title === "string" && /(two|three|four|five|six|seven|eight|nine|ten|\d+)/i.test(g.title))
    fail('the guide titled "' + g.title + '" has a count in its title, which nothing can keep in step - word it without one');

  /* the top SMOKED heal, quoted as the reason to bother smoking at all. Compared against the smokes and not
     against every healing thing: a potion out-heals them and is not what the sentence is about. */
  const topSmoke = Math.max(...Object.entries(G.ITEMS).filter(([k, it]) => k.startsWith("s") && it.meal && G.ITEMS[k.slice(1)]).map(([, it]) => it.heal));
  for (const m of all.matchAll(/heal far more[^.]*?up to (\d+)/gi)) if (Number(m[1]) !== topSmoke) fail('a guide says smoked fish heal "up to ' + m[1] + '"; the best is ' + topSmoke);
  if (!bad) ok("the counts written out in the guides agree with the rules");
}

/* ---------------------------------------------------------------- 4. the map of the world lists the world
   "The road out" is the page a new player reads to find out what exists. It had neither the Golden Sands nor the
   Carnival on it, months after both opened: an area can be built, placed, mined and fished without anything at
   all making the one page that lists the areas mention it. */
{
  const road = WK.GUIDES.find((g) => g.id === "road");
  const text = typeof road?.body === "function" ? road.body(G, { ico: () => "", el: () => "", wl: (r, t) => t, esc: (s) => s, TWR: null }) : (road?.body || "");
  const missing = [];
  for (const k of G.OPEN) {
    const d = G.SCENES[k];
    if (!d || d.wikiHide || !(d.mobs || []).length) continue;
    if (["wild", "deep", "fightpit"].includes(k)) continue;   /* off the chain on purpose; the guide says so in words */
    if (!text.includes(d.name)) missing.push(d.name);
  }
  if (missing.length) fail("the road guide does not mention " + missing.join(", ") + ", which a new player reads it to find");
  else ok("every area on the chain is on the map of the world");
}

/* ---------------------------------------------------------------- 5. a link whose words name a different page
   <a data-wiki="guides/smoking">smithed</a> sat in the fighting guide for weeks. The route is real, so nothing
   above catches it; only the WORDS are wrong. This flags a link whose text names some other guide. */
{
  const src = fs.readFileSync("v3/assets/js/eastscape-wiki.js", "utf8");
  const stem = (w) => w.toLowerCase().replace(/(ing|ed|s)$/, "");
  const ids = new Map(WK.GUIDES.map((g) => [stem(g.id), g.id]));
  const wrong = [];
  for (const m of src.matchAll(/data-wiki="guides\/([\w-]+)">([^<]{2,40})</g)) {
    const named = ids.get(stem(m[2].replace(/<[^>]+>/g, "").trim()));
    if (named && named !== m[1]) wrong.push('"' + m[2] + '" links to guides/' + m[1]);
  }
  if (wrong.length) fail("link text naming a different page: " + wrong.join("; "));
  else ok("no link is labelled with the name of a different page");
}

/* ---------------------------------------------------------------- 6. the Carnival's stalls
   Their numbers live in the worker, which this file cannot import, so the guide types them. Typed is fine as
   long as something fails when they move. */
{
  const g = WK.GUIDES.find((x) => x.id === "carnival");
  const text = typeof g?.body === "function" ? g.body(G, { ico: () => "", el: () => "", wl: (r, t) => t, esc: (s) => s, TWR: null }) : (g?.body || "");
  let src = "";
  try { src = fs.readFileSync("eastscape-worker/src/carnival.js", "utf8"); } catch { ok("(no worker checkout here; the Carnival's stall numbers were not checked)"); }
  if (src) {
    const costs = [...src.matchAll(/cost: (\d+)/g)].map((m) => Number(m[1]));
    const tops = [...src.matchAll(/top: (\d+)/g)].map((m) => Number(m[1]));
    const cost = costs[0], ratio = Math.round((Math.max(...tops) / cost) * 2) / 2;
    if (new Set(costs).size !== 1) fail("the stalls no longer all cost the same, but the guide says one price");
    else if (!text.includes("<b>" + cost + " tickets a go</b>")) fail("the Carnival guide does not say " + cost + " tickets a go, which is what carnival.js charges");
    else if (ratio < 4.5 || ratio > 6) fail("a perfect round now pays " + ratio + "x, not the “about five times” the guide says");
    else ok("the Carnival guide's stall price and payout match carnival.js");
  }
}

/* ---------------------------------------------------------------- 7. gathered things that lead nowhere
   NOT a failure, because it is a gap in the GAME rather than in the wiki, and a checker that is red on purpose
   gets ignored. But it belongs here: it is found by the same sweep, and a node whose yield has no use is the
   thing a player spends an afternoon on before asking what it was for. */
{
  const yields = new Map();
  for (const [key, d] of Object.entries(G.SCENES)) {
    if (d.wikiHide) continue;
    let b; try { b = G.buildScene(key); } catch { continue; }
    for (const o of b.objs) { const y = o.req?.skill && (o.ore || o.log || o.crop || o.fish); if (y) yields.set(y, o.req.skill); }
  }
  const orphan = [...yields.keys()].filter((k) => !Object.values(G.RECIPES).some((r) => r.in.some(([i]) => i === k)) && !G.ITEMS[k]?.heal);
  if (orphan.length) ok("note: " + orphan.join(", ") + " can be gathered but nothing consumes " + (orphan.length > 1 ? "them" : "it") + " — a gap in the game, not the wiki");
  const noItem = [...yields.keys()].filter((k) => !G.ITEMS[k]);
  if (noItem.length) fail("nodes yield things that are not items at all: " + noItem.join(", "));
}

/* ---------------------------------------------------------------- 8. a guide per thing worth one */
{
  const have = new Set(WK.GUIDES.map((g) => g.id));
  const missing = Object.keys(G.SKILLS).filter((k) => !["hp", "melee"].includes(k) && !have.has(k) && !WK.SKILL_GUIDE[k]);
  if (missing.length) fail("skills with neither a guide nor a SKILL_GUIDE line: " + missing.join(", "));
  else ok("every skill has at least a one-line description");
}

console.log(bad ? "\n" + bad + " problem(s)" : "\nthe wiki matches the game");
process.exitCode = bad ? 1 : 0;
