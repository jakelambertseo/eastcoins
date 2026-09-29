/* A reforge belongs to the ITEM (2026-09-23). This is the file that has to be right.

   The change moved every reforge level off the character (forge[itemKey]) and onto the piece itself — an `f` on
   an inventory or bank entry, and eqf[slot] for what is worn. Everything here is a property of the rules, so it
   can be checked without a server, and every one of these was a way to destroy somebody's best item:

     - a forged piece must never merge into a stack, or two levels become one lie
     - spending, selling or eating must take the PLAIN ones first, or a bulk sell eats your +3
     - sorting the bag must not melt a +3 and a plain one into a stack of two
     - normChar rebuilds the bag on EVERY load, so `f` has to survive the re-pack (it did not, at first)
     - the one-time migration has to run once and not again, or a later load re-stamps a level onto a piece that
       has since been traded away
     - stats must read what is WORN, never a spare in the bag

   Run: node tools/eastscape-forge-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/* ---------------------------------------------------------------- stacking */
{
  const inv = [];
  G.addInv(inv, "diamond_axe", 3);
  G.addInv(inv, "diamond_axe", 1, null, 3);
  G.addInv(inv, "diamond_axe", 1, null, 1);
  if (inv.length !== 3) fail(`a forged piece merged into a stack: ${JSON.stringify(inv)}`);
  if (inv.filter((x) => G.fOf(x)).some((x) => x.n !== 1)) fail("a forged entry holds more than one item");
  ok("a forged piece never joins a stack");

  const took = G.takeInv(inv, "diamond_axe", 3);
  if (took !== 3) fail(`takeInv took ${took} of 3`);
  const left = inv.filter((x) => x.k === "diamond_axe");
  if (left.length !== 2 || left.some((x) => !G.fOf(x))) fail(`the plain ones were not spent first: ${JSON.stringify(left)}`);
  ok("spending takes the plain ones first, so a bulk sell cannot eat a reforge");

  const sorted = G.sortInv(inv);
  const levels = sorted.filter((x) => x.k === "diamond_axe").map((x) => G.fOf(x)).sort();
  if (levels.join(",") !== "1,3") fail(`sorting lost a level: ${JSON.stringify(sorted)}`);
  ok("sorting the bag keeps every level apart");
}

/* ---------------------------------------------------------------- it survives a load */
{
  const c = G.normChar({ name: "x", inv: [{ k: "diamond_axe", n: 1, f: 3 }, { k: "diamond_axe", n: 2 }], bank: [{ k: "onyx_helm", n: 1, f: 2 }], eq: {}, eqf: {} });
  const axes = c.inv.filter((x) => x.k === "diamond_axe");
  if (!axes.some((x) => G.fOf(x) === 3)) fail("the +3 did not survive normChar's re-pack");
  if (axes.find((x) => G.fOf(x) === 3)?.n !== 1) fail("the +3 came back as a stack");
  if (G.fOf(c.bank.find((x) => x.k === "onyx_helm")) !== 2) fail("the bank lost its level");
  ok("a level survives the load that rebuilds the bag and the bank");
}

/* ---------------------------------------------------------------- the one-time migration */
{
  const old = { name: "y", eq: { weapon: "diamond_axe" }, inv: [{ k: "emerald_body", n: 2 }], bank: [{ k: "onyx_helm", n: 1 }],
    forge: { diamond_axe: 3, emerald_body: 2, onyx_helm: 1, starfall_ring: 2 } };
  const c = G.normChar(old);
  if (G.fLevelOf(c, "weapon") !== 3) fail("the worn piece did not take its level");
  if (!c.inv.some((x) => x.k === "emerald_body" && G.fOf(x) === 2)) fail("the bagged piece did not take its level");
  if (!c.inv.some((x) => x.k === "emerald_body" && !G.fOf(x))) fail("the rest of the stack was not left plain");
  if (G.fOf(c.bank.find((x) => x.k === "onyx_helm")) !== 1) fail("the banked piece did not take its level");
  if (G.forgeLevel(c, "starfall_ring") !== 0) fail("a level for an item they no longer hold came back — that is the bug being removed");
  ok("every saved level found its piece; one for an item they no longer hold was dropped");

  // a second load must not re-stamp: by then the piece may have been sold
  const two = G.normChar(c);
  if (two.inv.filter((x) => x.k === "emerald_body" && G.fOf(x)).length !== 1) fail("the migration ran twice");
  const three = G.normChar({ ...two, inv: two.inv.filter((x) => x.k !== "emerald_body") });
  if (three.inv.some((x) => x.k === "emerald_body")) fail("a sold piece came back on the next load");
  ok("it runs once: a later load cannot re-stamp a level onto something since traded away");
}

/* ---------------------------------------------------------------- stats read what is WORN */
{
  const c = G.normChar({ name: "z", eq: { weapon: "diamond_axe" }, eqf: { weapon: 2 }, inv: [{ k: "diamond_axe", n: 1, f: 3 }] });
  if (G.forgeLevel(c, "diamond_axe") !== 2) fail(`stats read ${G.forgeLevel(c, "diamond_axe")}; the WORN axe is +2 and the +3 is in the bag`);
  const bare = G.normChar({ name: "w", eq: {}, inv: [{ k: "diamond_axe", n: 1, f: 3 }] });
  if (G.forgeLevel(bare, "diamond_axe") !== 0) fail("a piece in the bag is buffing a character who is not wearing it");
  ok("stats come from the worn piece, never a spare in the bag");
}

/* ---------------------------------------------------------------- a hand-edited save cannot invent one */
{
  const c = G.normChar({ name: "v", inv: [{ k: "diamond_axe", n: 40, f: 99 }, { k: "logs", n: 10, f: 3 }], eq: {}, eqf: { weapon: 3 } });
  const axe = c.inv.find((x) => x.k === "diamond_axe" && G.fOf(x));
  if (axe && (axe.f > G.FORGE.cap || axe.n !== 1)) fail(`a +99 stack of 40 survived: ${JSON.stringify(axe)}`);
  if (G.fOf(c.inv.find((x) => x.k === "logs")) !== 0) fail("a level stuck to a stack of logs");
  if (G.fLevelOf(c, "weapon") !== 0) fail("a level survived on an empty equipment slot");
  ok("a hand-edited save cannot invent a +99, forge a log, or arm an empty slot");
}

/* ---------------------------------------------------------------- the maths follows the piece, not the character */
{
  const gains3 = G.forgeGainsAt("diamond_axe", 3), gains0 = G.forgeGainsAt("diamond_axe", 0);
  if (!gains3.length || gains0.length) fail("forgeGainsAt does not answer by level");
  if (G.forgeNameAt("diamond_axe", 3) !== `${G.ITEMS.diamond_axe.name} +3`) fail("forgeNameAt does not name the piece");
  if (G.forgeAddAt("emerald_body", 2, "def") <= 0) fail("forgeAddAt gives a worn piece nothing");
  ok("name, gains and stats all answer about a LEVEL rather than a character");
}

/* ---------------------------------------------------------------- the shapes that leave the server
   A level can be stored, matched and paid perfectly and STILL never reach the player, because everything the
   page sees goes through a hand-written projection. That is exactly what happened: the order carried f, the
   market matched on f, the buyer received the reforge — and exSend's view() listed it as a plain axe, so the
   market drew "Diamond axe" with no band and the hover card showed nothing. It is the sixth time a field has
   been added to a record and forgotten in the shape that carries it out of the server. Read them and insist. */
{
  const src = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/index.js", "utf8");
  const line = (needle) => { const i = src.indexOf(needle); return i < 0 ? "" : src.slice(i, src.indexOf("\n", i)); };
  if (!/f: o\.f/.test(line("const view = (o) => ({"))) fail("exSend's view() does not carry f — every listing reaches the page as a plain one");
  if (!/f: o\.f/.test(line("const mine = this.exMine(pl)"))) fail("your own market offers do not carry f");
  if (!/eqf: C\.eqf/.test(src)) fail("meOf does not send eqf, so the page cannot draw what you are wearing");
  ok("every shape that leaves the server carries the level");
}

/* ---------------------------------------------------------------- the badge is a LEVEL
   Reported live: every worn item carried a gold "+diamond_helm" band. fgTag(f) had been handed the item KEY
   instead of the level, and a non-empty string is truthy, so the badge fired on gear that had never been near an
   anvil. Same shape as the tixImg bug — no error, no syntax problem, just a wrong-typed argument that renders.
   The fix is that fgTag coerces, so nothing but a real level can get through; this insists on that. */
{
  const src = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
  const def = src.match(/const fgTag = [^\n]*/)?.[0] || "";
  if (!/Number\(f\)/.test(def)) fail("fgTag does not coerce its argument — an item key would render as a reforge band again");
  let clean = true;
  for (const m of src.matchAll(/fgTag\(([^)]*)\)/g)) {
    const arg = m[1].trim().replace(/,\s*s\.k$/, "");   /* (2026-09-29) fgTag(f, s.k): the key only lets a gem show its roll */
    if (arg === "f" || arg === "ef" || /^\d+$/.test(arg)) continue;
    fail(`fgTag is called with \`${arg}\`, which does not look like a level`); clean = false;
  }
  if (clean) ok("the reforge badge can only ever be given a level");
}

/* ---------------------------------------------------------------- a +4 has to SURVIVE BEING LOADED
   The Master's seal (Thieves' Guild, 2026-09-23) buys one attempt at +4, and FORGE.max stayed 3 because that is
   still where you stop unaided. The danger is entirely in the CLAMPS: normChar re-clamps every level on every
   load, and there are three of them plus fOf, fLevelOf, forgeAddAt, forgeSpeedAt and forgeNameAt. Leave any one
   of those on `max` and a +4 is silently demoted to +3 the next time its owner signs in — no error, no message,
   the exact failure-by-silence this file exists for. So the test is the round trip, not the constant. */
{
  const c = G.normChar({ name: "seal", eq: { weapon: "diamond_axe" }, eqf: { weapon: 4 }, inv: [{ k: "onyx_helm", n: 1, f: 4 }], bank: [{ k: "emerald_body", n: 1, f: 4 }] });
  if (G.fLevelOf(c, "weapon") !== 4) fail(`a worn +4 came back as +${G.fLevelOf(c, "weapon")}`);
  if (G.fOf(c.inv.find((x) => x.k === "onyx_helm")) !== 4) fail("a bagged +4 was demoted by the load");
  if (G.fOf(c.bank.find((x) => x.k === "emerald_body")) !== 4) fail("a banked +4 was demoted by the load");
  const twice = G.normChar(G.normChar(c));
  if (G.fLevelOf(twice, "weapon") !== 4) fail("a +4 survived one load and not two");
  if (!G.forgeNameAt("diamond_axe", 4).endsWith("+4")) fail(`forgeNameAt still caps the name: ${G.forgeNameAt("diamond_axe", 4)}`);
  if (!(G.forgeSpeedAt("diamond_axe", 4) > G.forgeSpeedAt("diamond_axe", 3))) fail("a +4 tool is no faster than a +3 — forgeSpeedAt is still clamping to max");
  if (G.forgeOdds(3) !== 0) fail("a +3 can be reforged WITHOUT a seal, which is the whole thing the seal is for");
  if (!(G.forgeOdds(3, true) > 0)) fail("a sealed attempt at +4 has no odds");
  /* forgeGainsAt says what a piece HAS; forgeNextAt says what is left. Aiming this at the first one is how the
     real bug below was nearly missed: forgeNextAt clamped to `max` and compared to `cap`, so its stop condition
     could never fire and a +4 was offered the +4 rung for ever. */
  if (G.forgeNextAt("diamond_axe", 3).length) fail("+3 is offered a further rung with no seal");
  if (!G.forgeNextAt("diamond_axe", 3, true).length) fail("a sealed +3 is offered nothing");
  if (G.forgeNextAt("diamond_axe", 4, true).length) fail("+4 is not the end of the ladder even with a seal");
  if (!G.forgeGainsAt("diamond_axe", 4).length) fail("a +4 piece reports no bonus at all");
  ok("a +4 survives every load, names itself, is worth more than a +3, and needs a seal to exist");
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe reforge belongs to the item");
process.exitCode = bad ? 1 : 0;
