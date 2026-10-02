/* STYLE DPS —  node tools/eastscape-style-dps.mjs   (2026-10-02) three styles at the same level, the best kit each can wear, damage per second from the rules' own formulas (the server: dmg = 1..maxHit+ammoStr, x element, x guard) */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const ok = (c, k) => G.ITEMS[k] && !G.missingReq(c, G.ITEMS[k]);
const keys = (re) => Object.keys(G.ITEMS).filter((k) => re.test(k));
const score = (c) => (G.maxHitOf(c) + G.ammoStrOf(c)) * G.attackRollOf(c) / G.swingMsOf(c);
function tryBest(c, slot, ks, extra = () => {}) { let bk = null, bv = -Infinity; for (const k of ks) { if (!ok(c, k)) continue; c.eq[slot] = k; extra(); const v = score(c); if (v > bv) { bv = v; bk = k; } } c.eq[slot] = bk; }
function char(style, L) {
  const c = G.freshChar(); c.inv = [];
  for (const s of ["hp", "defence", style, "wizardry"]) c.xp[s] = G.XP_AT[L];
  if (style === "melee") {
    const T = [...G.TIERS].reverse().find((t) => t.gate <= L);
    if (T) for (const s of ["helm", "body", "legs", "shield", "boots", "gloves"]) if (ok(c, `${T.key}_${s}`)) c.eq[s] = `${T.key}_${s}`;
    tryBest(c, "weapon", keys(/_(sword|mace|maul|axe|spear|dagger|gladius|scimitar|hammer|blade)$/));
  } else {
    const isA = style === "archery";
    tryBest(c, "weapon", keys(isA ? /bow$/ : /_wand$/));
    tryBest(c, "shield", keys(isA ? /quiver$/ : /^bag_/));
    let bk = null, bv = -1; for (const k of keys(isA ? /_arrow$/ : /^page_/)) { if (!ok(c, k)) continue; c.quiver = { k, n: 500 }; const v = G.ammoStrOf(c); if (v > bv) { bv = v; bk = k; } } c.quiver = { k: bk, n: 500 };
  }
  return c;
}
const pct = (x) => `${Math.round(x * 100)}%`;
console.log("level | style   | kit                                           | maxHit+ammo | attRoll | swing | reach | dps vs def=lvl/2 | per-shot ammo value");
const out = {};
for (const L of [20, 40, 60, 80, 99]) {
  for (const st of ["melee", "archery", "magic"]) {
    const c = char(st, L), mh = G.maxHitOf(c) + G.ammoStrOf(c), roll = G.attackRollOf(c), sw = G.swingMsOf(c), def = L / 2;
    const p = G.hitChance(roll, def), dps = (p * (mh + 1) / 2) / (sw / 1000);
    const ammo = c.quiver?.k, val = ammo ? G.valueOf?.(ammo) ?? 0 : 0;
    (out[L] ||= {})[st] = { dps, mh, roll, sw, reach: G.reachOfHeld(c), kit: [c.eq.weapon, c.eq.shield, ammo].filter(Boolean).join(" + "), val };
    console.log(`${String(L).padEnd(5)} | ${st.padEnd(7)} | ${out[L][st].kit.padEnd(45)} | ${String(mh).padEnd(11)} | ${String(Math.round(roll)).padEnd(7)} | ${sw}  | ${G.reachOfHeld(c)}     | ${dps.toFixed(2).padEnd(16)} | ${val}`);
  }
}
/* how the monster book treats each style */
const mobs = Object.entries(G.MOBS).filter(([, m]) => !m.event && !m.bag && !m.head && m.hp > 1);
const weak = mobs.filter(([, m]) => m.weak).length, resist = mobs.filter(([, m]) => m.resist).length;
const guard = (st) => mobs.filter(([, m]) => (m.guard?.[st] ?? 1) < 1).length, guardUp = (st) => mobs.filter(([, m]) => (m.guard?.[st] ?? 1) > 1).length;
const big = mobs.filter(([, m]) => m.size === "l" || m.size === "xl").length, sky = mobs.filter(([, m]) => m.sky).length;
console.log(`\n${mobs.length} monsters: ${weak} have an element weakness (magic only, x${G.MAGIC.weakMul}), ${resist} resist one. Large/XL (archery +${G.ARCHERY.bigBonus * 100}%): ${big}. Sky (only ranged reach): ${sky}.`);
for (const st of ["melee", "archery", "magic"]) console.log(`  guarded against ${st}: ${guard(st)}   extra-weak to ${st}: ${guardUp(st)}`);
console.log("\nCHARMS (utility pages, magic only):", Object.keys(G.CHARMS).length, "+ homeward + waystones", Object.keys(G.WAYSTONES).length);
console.log("ARCH_FLOOR:", JSON.stringify(G.ARCH_FLOOR), "MAGE_FLOOR:", JSON.stringify(G.MAGE_FLOOR));

/* the mock's calculator data: every 5 levels, each style's base DPS against a monster of defence lvl/2, and archery as it would be if a
   ranger armour set counted (its acc/str a ranger-set fraction of the same tier's melee armour) */
import fs from "node:fs";
const data = { lv: [], melee: [], archery: [], magic: [], archArmour: [], wk: G.MAGIC.weakMul, rs: G.MAGIC.resistMul, big: G.ARCHERY.bigBonus,
  mobs: { total: mobs.length, weak, resist, big, sky, guard: { melee: guard("melee"), archery: guard("archery"), magic: guard("magic") } } };
for (let L = 10; L <= 99; L += L >= 95 ? 4 : 5) {
  data.lv.push(L);
  for (const st of ["melee", "archery", "magic"]) { const c = char(st, L), mh = G.maxHitOf(c) + G.ammoStrOf(c), p = G.hitChance(G.attackRollOf(c), L / 2); data[st].push(+((p * (mh + 1) / 2) / (G.swingMsOf(c) / 1000)).toFixed(2)); }
  const c = char("archery", L), T = [...G.TIERS].reverse().find((t) => t.gate <= L); let acc = 0, str = 0;
  if (T) for (const s of ["helm", "body", "legs", "boots", "gloves"]) { const it = G.ITEMS[`${T.key}_${s}`]; if (it) { acc += it.acc || 0; str += it.str || 0; } }
  const RANGER = 0.6, mh = Math.floor(1 + Math.floor(L / 6) + Math.floor((G.styleBonusOf(c).str + str * RANGER) / 2)) + G.ammoStrOf(c), roll = L + 1 + G.styleBonusOf(c).acc + acc * RANGER, p = G.hitChance(roll, L / 2);
  data.archArmour.push(+((p * (mh + 1) / 2) / (G.swingMsOf(c) / 1000)).toFixed(2));
}
fs.writeFileSync(new URL("./archery-mock/data.json", import.meta.url), JSON.stringify(data));
console.log("data.json written", data.lv.length, "levels; archery with ranger armour at 99:", data.archArmour.at(-1));
