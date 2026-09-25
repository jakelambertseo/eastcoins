/* CAN A PLAYER ACTUALLY GET THE TOP TIERS? —  node tools/eastscape-gear-check.mjs
   (2026-09-25, the owner: "lets also ideate on adding 80s and 90s gear ... these will be chase items, so
   progression and obtaining them needs to feel good")

   Nova and Singularity are generated from two rows in TIERS, which is the good news and also the risk: almost
   nothing about them is typed out, so almost nothing can be checked by reading. What can go wrong is the shape of
   the CHAIN, and three of the four ways it can break did break while this was being built:

     A CIRCULAR GATE. Nova ore is a Mining 80 rock, toolNeed(80) asked for the nova rung, and a nova pickaxe is
     smithed from nova bars - which need nova ore. The only door was a 250,000-ticket purchase.
     A NEW RUNG RAISING THE BAR ON OLD ROCKS. Adding a tier at gate 80 moved the Trailer Park's Slag banks (85)
     from an eclipse pickaxe to a nova one, silently, for everybody already mining them.
     AND A PRICE THAT IS NaN, because TIER_COST is a hand-keyed map and the shop multiplies by it.

   The fourth is the chase item itself: a core must have a way round the 1-in-2,000, or the weapon does not exist
   for anyone who is unlucky. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js";
import { createCryptRules } from "../v3/assets/js/eastscape-crypt-rules.js";
import { createPyramidRules } from "../v3/assets/js/eastscape-pyramid-rules.js";
import fs from "node:fs";
Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
/* (2026-09-25) THE DUNGEON BOSSES ARE IN THEIR OWN FILES, which is exactly why they were missed when the cores
   were first wired: the LOOT edit in shared.js could not reach them and nothing failed. Merged here so the drop
   checks below see all five of CORE_BOSSES. */
Object.assign(G.MOBS, createCryptRules(G, G._MAP).mobs, createPyramidRules(G, G._MAP).mobs);
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

const NEW = ["nova", "singularity"];

/* ---------------------------------------------------------------- the ladder still only ever climbs */
for (const slot of ["helm", "body", "legs", "shield", "boots", "gloves"]) {
  const d = G.TIERS.map((t) => G.ITEMS[`${t.key}_${slot}`]?.def);
  if (d.some((v) => v == null)) { fail(`a tier has no ${slot}`); continue; }
  for (let i = 1; i < d.length; i++) if (d[i] <= d[i - 1]) fail(`${G.TIERS[i].key} ${slot} (${d[i]}) does not beat ${G.TIERS[i - 1].key} (${d[i - 1]})`);
}
for (const kind of ["gladius", "sword", "maul"]) {
  const a = G.TIERS.map((t) => G.ITEMS[`${t.key}_${kind}`]?.acc);
  for (let i = 1; i < a.length; i++) if (a[i] <= a[i - 1]) fail(`${G.TIERS[i].key} ${kind} accuracy does not beat the tier below`);
}
if (!bad) ok(`${G.TIERS.length} tiers, and every slot and weapon beats the rung below it`);

/* ---------------------------------------------------------------- nothing is priced NaN */
{
  const bad0 = G.SHOP.sells.filter(([, p]) => !Number.isFinite(p) || p <= 0);
  if (bad0.length) fail(`the shop prices ${bad0.length} thing(s) at NaN or nothing: ${bad0.slice(0, 4).map(([k]) => k).join(", ")}`);
  else ok(`all ${G.SHOP.sells.length} things on Bom's counter have a real price`);
}

/* ---------------------------------------------------------------- A NEW RUNG MUST NOT MOVE AN OLD ROCK */
{
  const nodes = [];
  for (const d of Object.values(G.SCENES)) { let b; try { b = d.build?.(); } catch { continue; }
    for (const o of (b?.objs || [])) if (o.req?.skill === "mining") nodes.push({ name: o.name, lvl: o.req.lvl, ore: o.ore }); }
  const newOres = new Set(NEW.map((t) => `${t}_ore`));
  const old = nodes.filter((n) => !newOres.has(n.ore));
  const moved = old.filter((n) => NEW.includes(G.toolNeed(n.lvl).key));
  if (moved.length) fail(`${[...new Set(moved.map((m) => m.name))].join(", ")} now want a ${G.toolNeed(moved[0].lvl).key} pickaxe; they predate these tiers`);
  else ok(`${old.length} pre-existing mining nodes still ask for the tool they always did`);

  /* ---- and the new ore must be mineable with a tool you can already hold */
  for (const t of NEW) {
    const n = nodes.find((x) => x.ore === `${t}_ore`);
    if (!n) { fail(`no rock anywhere yields ${t}_ore, so the tier cannot be entered at all`); continue; }
    const need = G.toolNeed(n.lvl).key;
    if (need === t) fail(`${t}_ore needs a ${t} pickaxe, which is smithed from ${t} bars, which need ${t}_ore — the only door is Bom`);
    else ok(`${n.name} (Mining ${n.lvl}) takes a ${need} pickaxe, so ${t} can be entered without buying the way in`);
  }
}

/* ---------------------------------------------------------------- the chase, and the way round it */
{
  /* every file that names a core drop, because they cannot share the constant: each is evaluated before
     shared.js finishes, so all three write 0.0005 by hand and all three must agree with CORE_DROP. */
  const lit = ["v3/assets/js/eastscape-shared.js", "v3/assets/js/eastscape-crypt-rules.js", "v3/assets/js/eastscape-pyramid-rules.js"]
    .map((f) => fs.readFileSync(f, "utf8")).join(String.fromCharCode(10));
  /* the drop rate is written as a bare number in LOOT because CORE_DROP does not exist yet at that point */
  const rows = [...lit.matchAll(/\["(?:nova|singularity)_core", 1, ([\d.]+)\]/g)].map((m) => Number(m[1]));
  if (!rows.length) fail("no monster drops a core");
  else if (rows.some((r) => r !== G.CORE_DROP)) fail(`a core drop is written as ${[...new Set(rows)].join("/")} but CORE_DROP is ${G.CORE_DROP}`);
  else ok(`${rows.length} core drops, all at CORE_DROP (${G.CORE_DROP}, about 1 in ${Math.round(1 / G.CORE_DROP)})`);

  for (const t of NEW) {
    const core = `${t}_core`;
    const byCraft = Object.values(G.RECIPES).find((r) => r.out[0] === core);
    if (!byCraft) fail(`${core} has no craft — at 1 in ${Math.round(1 / G.CORE_DROP)} that makes the ${t} weapons a lottery with no losing ticket`);
    const droppers = Object.entries(G.MOBS).filter(([, m]) => (m.drops || []).some(([k]) => k === core)).map(([k]) => k);
    if (!droppers.length) fail(`nothing drops ${core}`);
    /* the owner named five; a boss that quietly stops dropping is invisible at 1 in 2,000 */
    for (const b of G.CORE_BOSSES) if (!droppers.includes(b)) fail(`${b} is in CORE_BOSSES but does not drop ${core}`);
    /* every weapon of the tier wants one; no armour or tool does */
    for (const kind of ["gladius", "sword", "maul"]) {
      const r = Object.values(G.RECIPES).find((x) => x.out[0] === `${t}_${kind}`);
      if (!r) { fail(`${t}_${kind} has no recipe`); continue; }
      if (!r.in.some(([k]) => k === core)) fail(`${t}_${kind} does not want a core, so the chase item gates nothing`);
    }
    for (const slot of ["body", "helm", "pickaxe"]) {
      const r = Object.values(G.RECIPES).find((x) => x.out[0] === `${t}_${slot}`);
      if (r?.in.some(([k]) => k === core)) fail(`${t}_${slot} wants a core; the owner chose the WEAPON as the chase, so armour and tools stay reliable`);
    }
    if (!bad) ok(`${t}: core drops from ${droppers.length} boss(es), is craftable, and gates all three weapons and nothing else`);
  }
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe top tiers can be reached, made and worn");
process.exitCode = bad ? 1 : 0;
