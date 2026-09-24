/* An equipped pet has to survive a reload.

   Reported by a tester: "pets reset on refresh and they have to be re-equipped". Every slot in SLOTS holds an
   item KEY except one — eq.pet holds an ID into c.pets ("p1") — and normChar's loop that drops gear whose item
   no longer exists tested that ID against ITEMS, found nothing, and nulled it. On every single load, for ever.
   The pet slot was already validated correctly a few lines earlier, against the list it actually points into;
   the generic loop then undid that.

   These four cases are the whole contract: a real pet stays on and keeps buffing, and the two ways a pet can
   stop being real still take it off.

   Run: node tools/eastscape-pet-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const kind = Object.keys(G.PETS)[0];

{
  const c = G.normChar({ name: "a", pets: [{ id: "p1", k: kind, name: "Rex" }], eq: { pet: "p1" } });
  if (c.eq.pet !== "p1") fail("an equipped pet came off during the load");
  if (!G.activePet(c)) fail("activePet cannot find the equipped pet after a load");
  const fx = G.petFx(c);
  if (!Object.values(fx).some((v) => v > 0)) fail("the pet is worn but gives nothing");
  // and again, because the bug was that EVERY load did it
  const twice = G.normChar(c);
  if (twice.eq.pet !== "p1") fail("it came off on the second load");
  console.log("  an equipped pet survives a load, and another, and still buffs");
}
{
  const c = G.normChar({ name: "b", pets: [], eq: { pet: "p1" } });
  if (c.eq.pet !== null) fail("a pet they no longer own stayed equipped");
  const d = G.normChar({ name: "c", pets: [{ id: "p1", k: "not_a_pet", name: "X" }], eq: { pet: "p1" } });
  if (d.eq.pet !== null) fail("a pet whose kind no longer exists stayed equipped");
  console.log("  a pet that is no longer real still comes off");
}
{
  // the loop must still do its job for every OTHER slot
  const c = G.normChar({ name: "d", eq: { weapon: "not_an_item", helm: "bronze_helm" } });
  if (c.eq.weapon !== null) fail("gear whose item no longer exists stayed equipped");
  if (c.eq.helm !== "bronze_helm") fail("real gear was dropped");
  console.log("  every other slot is still checked against ITEMS");
}

console.log(bad ? `\n${bad} problem(s)` : "\npets stay on");
process.exitCode = bad ? 1 : 0;
