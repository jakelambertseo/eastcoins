/* Combat: the melee split, stances, weapon speed and gear requirements.
   The one that matters most is neutrality — a character who logs in after the
   split must be exactly as accurate, as hard-hitting and as hard to hit as they
   were before it. Run: node scratchpad/eastscape-combattest.mjs */
import * as G from "../v3/assets/js/eastscape-shared.js";

let pass = 0, fail = 0;
const ok = (n, c, x = "") => { if (c) { pass++; console.log("  ok  " + n); } else { fail++; console.log("FAIL  " + n + (x ? "  -> " + x : "")); } };
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

console.log("\n-- the split is neutral, which is the whole argument for copying --");
for (const lvl of [3, 10, 25, 40, 60, 99]) {
  const gear = { helm: "bronze_helm", body: "bronze_body", shield: "bronze_shield", weapon: "bronze_sword", legs: null, gloves: null, boots: "sandals", ring: null };
  const before = { xp: { melee: G.XP_AT[lvl], hp: G.XP_AT[20] }, eq: gear };
  const c = G.normChar({ v: 2, xp: before.xp, eq: gear, qs: {}, inv: [] });
  const b = G.bonusOf(c);
  // what the old code computed, written out longhand
  const oldAcc = lvl + 1 + b.acc, oldMax = 1 + Math.floor(lvl / 6) + Math.floor(b.str / 2), oldDef = (lvl + b.def) / 2;
  const oldCombat = Math.floor((lvl * 1.3 + G.lvlOf(c, "hp")) / 2.3) + 2;
  ok(`level ${lvl}: accuracy unchanged`, G.attackRollOf(c) === oldAcc, `${G.attackRollOf(c)} vs ${oldAcc}`);
  ok(`level ${lvl}: max hit unchanged`, G.maxHitOf(c) === oldMax, `${G.maxHitOf(c)} vs ${oldMax}`);
  ok(`level ${lvl}: defence unchanged`, G.defenceRollOf(c) === oldDef, `${G.defenceRollOf(c)} vs ${oldDef}`);
  ok(`level ${lvl}: combat level unchanged`, G.combatOf(c) === oldCombat, `${G.combatOf(c)} vs ${oldCombat}`);
}

console.log("\n-- every stance pays the same --");
{
  for (const dmg of [1, 2, 3, 7, 20]) {
    const totals = Object.keys(G.STANCES).map((k) => G.xpForDamage({ stance: k }, dmg).reduce((n, [, x]) => n + x, 0));
    ok(`${dmg} damage: identical in all four`, totals.every((t) => near(t, totals[0])), totals.join(" / "));
    ok(`${dmg} damage: totals ${(G.COMBAT_XP + G.HP_XP) * dmg}`, near(totals[0], (G.COMBAT_XP + G.HP_XP) * dmg), String(totals[0]));
  }
  // the rounding trap: at one damage, thirds rounded to 1 would pay Controlled 3 of 4
  const ctl = G.xpForDamage({ stance: "controlled" }, 1).filter(([s]) => s !== "hp").reduce((n, [, x]) => n + x, 0);
  ok("Controlled at 1 damage still pays a full 4 to combat", near(ctl, 4), String(ctl));
}

console.log("\n-- stances send xp where they say --");
{
  const at = (k, skill) => G.xpForDamage({ stance: k }, 10).find(([s]) => s === skill)?.[1] || 0;
  ok("Accurate trains only Attack", at("accurate", "attack") === 40 && !at("accurate", "strength") && !at("accurate", "defence"));
  ok("Aggressive trains only Strength", at("aggressive", "strength") === 40 && !at("aggressive", "attack"));
  ok("Defensive trains only Defence", at("defensive", "defence") === 40 && !at("defensive", "strength"));
  ok("Controlled trains all three evenly", near(at("controlled", "attack"), at("controlled", "strength")) && near(at("controlled", "defence"), 40 / 3));
  ok("Hitpoints is paid in every stance", Object.keys(G.STANCES).every((k) => near(at(k, "hp"), 10 * G.HP_XP)));
  ok("an unknown stance falls back rather than paying nothing", G.xpForDamage({ stance: "nonsense" }, 5).length > 0);
}

console.log("\n-- weapon speed --");
{
  ok("no weapon swings at the old default", G.swingMsOf({ eq: {} }) === G.SWING_MS);
  ok("a gladius is fast", G.ITEMS.onyx_gladius.speed === 1800);
  ok("a longsword is the middle", G.ITEMS.onyx_sword.speed === 2400);
  ok("a maul is slow", G.ITEMS.onyx_maul.speed === 3000);
  ok("swingMsOf reads the equipped weapon", G.swingMsOf({ eq: { weapon: "onyx_maul" } }) === 3000);
  // roughly equal damage per second across the three, or one class is pointless
  const dps = (k) => { const i = G.ITEMS[k]; const c = { xp: { strength: G.XP_AT[50] }, eq: { weapon: k } }; return ((1 + G.maxHitOf(c)) / 2) / (i.speed / 1000); };
  const all = ["onyx_gladius", "onyx_sword", "onyx_maul"].map(dps);
  const spread = (Math.max(...all) - Math.min(...all)) / Math.min(...all);
  ok(`the three classes land within 25% on damage/sec (${all.map((n) => n.toFixed(2)).join(", ")})`, spread < 0.25, (spread * 100).toFixed(0) + "%");
}

console.log("\n-- what gates what --");
{
  const at = (skills) => ({ xp: Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, G.XP_AT[v]])), eq: {} });
  ok("a weapon wants Attack", G.missingReq(at({ attack: 9 }), G.ITEMS.bronze_sword)?.skill === "attack");
  ok("and is allowed at the gate", !G.missingReq(at({ attack: 10 }), G.ITEMS.bronze_sword));
  ok("armour wants Defence", G.missingReq(at({ attack: 99, defence: 19 }), G.ITEMS.emerald_body)?.skill === "defence");
  ok("jewelry wants Hitpoints", G.missingReq(at({ hp: 29 }), G.ITEMS.diamond_ring)?.skill === "hp");
  ok("a maul wants Attack AND Strength", G.reqsOf(G.ITEMS.onyx_maul).length === 2);
  ok("  ...refused on Attack alone", G.missingReq(at({ attack: 50, strength: 40 }), G.ITEMS.onyx_maul)?.skill === "strength");
  ok("  ...allowed with both", !G.missingReq(at({ attack: 50, strength: 50 }), G.ITEMS.onyx_maul));
  ok("a gladius wants Attack only", G.reqsOf(G.ITEMS.onyx_gladius).length === 1);
}

console.log("\n-- the ladder itself --");
{
  const gates = G.TIERS.map((t) => t.gate);
  ok("five tiers, ten levels apart", gates.join(",") === "10,20,30,40,50", gates.join(","));
  let lastDef = 0, lastAcc = 0;
  for (const t of G.TIERS) {
    const set = ["body", "shield", "legs", "helm", "boots", "gloves"].reduce((n, s) => n + G.ITEMS[`${t.key}_${s}`].def, 0);
    ok(`${t.name}: the suit beats the one below it`, set > lastDef, `${set} vs ${lastDef}`); lastDef = set;
    ok(`${t.name}: the sword beats the one below it`, G.ITEMS[`${t.key}_sword`].acc > lastAcc); lastAcc = G.ITEMS[`${t.key}_sword`].acc;
    ok(`${t.name}: the ring gives the same in all three`, G.ITEMS[`${t.key}_ring`].acc === G.ITEMS[`${t.key}_ring`].str && G.ITEMS[`${t.key}_ring`].str === G.ITEMS[`${t.key}_ring`].def);
  }
}

console.log("\n-- the old bronze keys still resolve --");
{
  const c = G.normChar({ v: 2, xp: { melee: G.XP_AT[30] }, qs: {},
    inv: [{ k: "bronzesword", n: 1 }], bank: [{ k: "bronzecuirass", n: 1 }],
    eq: { helm: "bronzehelm", shield: "bronzeshield" } });
  ok("a bagged bronze sword becomes bronze_sword", c.inv.some((s) => s.k === "bronze_sword"), JSON.stringify(c.inv));
  ok("a banked cuirass becomes bronze_body", c.bank.some((s) => s.k === "bronze_body"), JSON.stringify(c.bank));
  ok("worn pieces follow too", c.eq.helm === "bronze_helm" && c.eq.shield === "bronze_shield", JSON.stringify(c.eq));
  ok("and they are all real items", [...c.inv, ...c.bank].every((s) => G.ITEMS[s.k]));
}

console.log("\n-- a Defensive character really is harder to hit --");
{
  const mk = (a, s2, d) => G.normChar({ v: 3, xp: { attack: G.XP_AT[a], strength: G.XP_AT[s2], defence: G.XP_AT[d], hp: G.XP_AT[40] }, eq: { body: "diamond_body", shield: "diamond_shield" }, qs: {}, inv: [] });
  const tank = mk(20, 20, 50), glass = mk(50, 50, 10);
  const revenant = G.MOBS.revenant.att;
  const hitTank = G.hitChance(revenant, G.defenceRollOf(tank)), hitGlass = G.hitChance(revenant, G.defenceRollOf(glass));
  ok("the revenant lands fewer on the Defensive build", hitTank < hitGlass, `${(hitTank * 100).toFixed(0)}% vs ${(hitGlass * 100).toFixed(0)}%`);
  ok("but it can still hit them at all", hitTank > 0.1, (hitTank * 100).toFixed(0) + "%");
  ok("and the glass cannon hits harder", G.maxHitOf(glass) > G.maxHitOf(tank), `${G.maxHitOf(glass)} vs ${G.maxHitOf(tank)}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
