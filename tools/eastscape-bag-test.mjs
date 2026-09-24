/* THE BAG IS THE SIZE THE PLAYER PAID FOR (2026-09-24).

   Reported by the owner: smelting logs refused with "your inventory is full" on a bag with two free slots. The
   cause was one omitted argument, and the same omission was in four other places.

   `roomFor(inv, k, c)` and `addInv(inv, k, n, c)` both stop at `bagMax(c)`, and `bagMax(null)` is a bare
   INV_MAX — so ANY caller that left the character out silently measured a 20-slot bag and ignored the pockets a
   player had bought with tickets and earned from achievements. It failed in the worst direction every time: a
   refusal, with a message blaming the player's own bag.

   Where it was:
     the station's room check   a hard refusal — the reported bug
     normChar, on EVERY load    re-packed to 20 and pushed the rest to the bank, so the extra slots could never
                                hold anything for longer than one refresh. This is why the bag looked like 20.
     sortInv                    rebuilt into 20; the handler's total-check then refused the sort, so Sort did
                                nothing at all on an upgraded bag and said nothing about why
     the trade preview          refused trades an upgraded bag would have held
     the crypt's ante refund    could drop a refund

   Both functions now REQUIRE the character, which is what stops this coming back.

   Run: node tools/eastscape-bag-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

/** a player who has bought one pocket and earned another: bagMax 22 */
const upgraded = () => {
  const c = G.freshChar();
  c.bagUp = 1;
  c.ach = Object.keys(G.ACH).slice(0, 12);   // enough points for the 10-point pocket
  return c;
};

{
  const c = upgraded();
  if (G.bagMax(c) !== G.INV_MAX + 2) fail(`bagMax says ${G.bagMax(c)}; one purchase and one milestone should be ${G.INV_MAX + 2}`);
  if (G.bagMax(null) !== G.INV_MAX) fail("bagMax(null) is no longer a bare INV_MAX, so the reasoning below is stale");
  ok(`a bought pocket and an earned one give ${G.bagMax(c)} slots`);
}

/* ---------------------------------------------------------------- the reported bug */
{
  const c = upgraded();
  c.inv = Array.from({ length: G.INV_MAX }, () => ({ k: "bones", n: 1 }));   // 20 used, 2 free
  if (G.roomFor(c.inv, "charcoal", c) < 1) fail("a 22-slot bag with 20 used has no room for charcoal — the reported bug");
  ok("with 20 of 22 slots used there is still room to smelt into");
}

/* ---------------------------------------------------------------- it survives a load */
{
  const c = upgraded();
  /* DISTINCT items, because normChar re-packs by totalling each key - twenty-two entries of two kinds correctly
     come back as two stacks, and an earlier version of this test read that consolidation as data loss. */
  const kinds = Object.keys(G.ITEMS).filter((k) => G.capOf(k) > 1 && k !== "tickets").slice(0, G.INV_MAX + 2);
  if (kinds.length < G.INV_MAX + 2) fail("not enough stackable items to fill a bag for the test");
  c.inv = kinds.map((k) => ({ k, n: 1 }));
  const totals = (x) => G.countItems({ inv: x.inv, bank: [] }, Object.keys(G.ITEMS));
  const before = totals(c), bankBefore = (c.bank || []).length;
  const after = G.normChar(c);
  if (after.inv.length < G.INV_MAX + 2) fail(`a full 22-slot bag came back from normChar holding ${after.inv.length} — the rest went to the bank`);
  if (totals(after) !== before) fail("normChar changed how much is in the bag");
  if (after.bank.length > bankBefore) fail("normChar moved something to the bank that fitted in the bag");
  ok("a full 22-slot bag survives a load with nothing pushed into the bank");
}

/* ---------------------------------------------------------------- sorting */
{
  const c = upgraded();
  c.inv = Array.from({ length: G.INV_MAX + 2 }, (_, i) => ({ k: ["bones", "feather", "hide", "logs"][i % 4], n: 1 + i }));
  const out = G.sortInv(c.inv, c);
  const count = (x) => G.countItems({ inv: x, bank: [] }, Object.keys(G.ITEMS));
  if (count(out) !== count(c.inv)) fail(`sorting a 22-slot bag lost items (${count(c.inv)} -> ${count(out)}); the handler would refuse the sort and Sort would do nothing`);
  ok("sorting a full 22-slot bag keeps everything, so the button works on an upgraded bag");
}

/* ---------------------------------------------------------------- nobody may omit it again */
{
  const files = [
    "eastscape-worker/src/index.js", "eastscape-worker/src/crypt.js",
    "v3/assets/js/eastscape-shared.js", "eastscape.html",
  ];
  /* Both take the character as the argument AFTER the item (roomFor) or the count (addInv). A call written with
     fewer arguments than that is the bug this file is about, so the shape is what gets checked. */
  let checked = 0;
  for (const rel of files) {
    const src = fs.readFileSync("C:/Users/jake/code/eastcoins/" + rel, "utf8");
    /* Parentheses are BALANCED by hand rather than matched with a regex: `addInv(out, k, totals.get(k), c)`
       contains a nested call, and a non-greedy `\(...\)` stops at the inner one and reports three arguments. */
    for (const m of src.matchAll(/\b(?:G\.)?(roomFor|addInv)\(/g)) {
      const fn = m[1];
      let i = m.index + m[0].length, depth = 1, args = "";
      while (i < src.length && depth > 0) { const ch = src[i]; if (ch === "(") depth++; else if (ch === ")") { depth--; if (!depth) break; } args += ch; i++; }
      if (/^\s*inv, k/.test(args)) continue;               // the definitions themselves
      let d = 0, parts = [""];
      for (const ch of args) { if (ch === "(" || ch === "[" || ch === "{") d++; else if (ch === ")" || ch === "]" || ch === "}") d--; if (ch === "," && !d) parts.push(""); else parts[parts.length - 1] += ch; }
      parts = parts.map((x) => x.trim()).filter((x) => x !== "");
      const need = fn === "roomFor" ? 3 : 4;
      checked++;
      if (parts.length < need) {
        const line = src.slice(0, m.index).split(String.fromCharCode(10)).length;
        fail(`${rel}:${line} calls ${fn} with ${parts.length} arguments — the character is missing, so it will measure a ${G.INV_MAX}-slot bag`);
      }
    }
  }
  if (!checked) fail("the call scan matched nothing, so it is not actually checking anything");
  else ok(`all ${checked} roomFor/addInv calls pass a character`);
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe bag is the size the player paid for");
process.exitCode = bad ? 1 : 0;
