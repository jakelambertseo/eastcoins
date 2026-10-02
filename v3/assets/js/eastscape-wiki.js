/* ============================================================
   EastScape wiki — the hand-written half

   Most of the wiki is built straight from the game's own rules
   (eastscape-shared.js): every item, monster, drop, skill, quest,
   area and NPC page comes from the same data the server plays by,
   so it can't go stale. This file holds what the rules can't say:
   guides, and the Updates log.

   WHEN YOU CHANGE THE GAME: add an entry to the top of UPDATES
   (newest first), and a guide here if something needs explaining.
   Bump ?v= on this file's import in eastscape.html (cached a year).
   ============================================================ */

// guides: { id, title, icon, body } — body is simple HTML (paragraphs, lists, <b>). Link a page with <a data-wiki="items/logs">.
/* PLAIN WORDS (the owner, 2026-09-19: "gamer dads, hanging out with a beer in hand... reading is at the bottom of their list").
   Every guide is a few short lines. Guides for things that are closed (the Forge, cooking, the Wilderness, tools) are gone. */
/* (2026-09-26) EVERY CROP, from G.CROPS. The Harvesting guide, the island guide and the skill page each carried their own
   hand-written copy of this table, and none of them grew the four Wizardry seeds when those were added. Now all three
   draw this one. Only "seeded by" for the old crops is written by hand: those drop from loot tables the wiki does not
   read. A seed crop's areas are worked out from the monsters that drop it. */
const SEEDED_BY = { wheat: "grows wild in the Yard", tomatoe: "rotten tomatoes, in the Yard", rattlebean: "the Gloam", lanternroot: "the Lantern Mire",
  bonegourd: "the Boneyard", stormcorn: "Cloudreach &amp; the Thunderhead", goldtomatoe: "It's a secret",   /* (2026-09-27) the owner: the Golden tomatoe's source stays a secret on the harvesting guide */ glassgourd: "the Carnival", emberwheat: "the Vault", starfruit: "the Trailer Park" };
const growTime = (ms) => { const m = Math.round(ms / 60000), h = Math.floor(m / 60); return m < 60 ? `${m} min` : `${h} hr${m % 60 ? ` ${m % 60} min` : ""}`; };
export function cropTable(G, H) {
  const nm = (k) => H.esc(G.ITEMS[k]?.name || k);
  const areasOf = (k) => Object.values(G.SCENES).filter((d) => (d.mobs || []).some(([t]) => (G.MOBS[t]?.drops || []).some((x) => x[0] === k))).map((d) => H.esc(d.name || "")).filter(Boolean);
  const rows = Object.entries(G.CROPS).sort((a, b) => a[1].lvl - b[1].lvl).map(([k, c]) => {
    const out = G.cropYield(k), v = G.valueOf(out), where = SEEDED_BY[k] || (areasOf(k).join(", ") || "&mdash;");
    return `<tr><td>${H.ico(k)} ${nm(k)}${out !== k ? ` &rarr; ${H.ico(out)} ${nm(out)}` : ""}</td><td>${c.lvl}</td><td>${growTime(c.ms)}</td><td>${c.yield[0]}&ndash;${c.yield[1]}</td><td>${c.xp.toLocaleString()}</td><td>${v > 0 ? v.toLocaleString() : "&mdash;"}</td><td>${where}</td></tr>`;
  });
  return `<table class="tbl"><tr><th>Crop</th><th>Harvesting</th><th>Grows in</th><th>Pays back</th><th>xp</th><th>Sells</th><th>Seeded by</th></tr>${rows.join("")}</table>`;
}
/* (2026-09-30, the owner's "full wiki rundown") SHARED HELPERS FOR THE GENERATED GUIDES. Every map guide below reads its monsters, its
   rocks, trees and water, and the drops worth knowing straight off the map and the monster, so a moved rock or a new monster is in the
   guide the moment it is in the game. The page hands a guide H (ico, wl, esc, areaLink...); the node checks hand it a thinner one, so
   anything past wl/esc/ico is used only when it is there. */
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n) => WORDS[n] || String(n), Word = (n) => word(n).replace(/^./, (c) => c.toUpperCase());
const an = (w) => `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`, num = (n) => Number(n).toLocaleString("en-GB"), pctOf = (x) => `${Math.round(x * 1000) / 10}%`, oneIn = (p) => `1 in ${num(Math.round(1 / p))}`;
const itemL = (G, H, k) => H.wl(`items/${k}`, `${H.ico ? H.ico(k) : ""} ${H.esc(G.ITEMS[k]?.name || k)}`);
const areaL = (G, H, k) => (H.areaLink ? H.areaLink(k) : H.esc(G.SCENES[k]?.name || k));
/* a monster page exists where a map places it, or for the few that come at a time rather than on a tile (eastscape.html spawnedOf) */
const SPAWNED = new Set(["icewyrm", "raidchief", "raidwolf", "raidyeti", "raidgiant", "raidhuscarl", "goldenraptor"]);
const mobL = (G, H, t) => {
  const n = H.esc(G.MOBS[t]?.name || t), placed = Object.entries(G.SCENES).some(([k, d]) => !d.wikiHide && G.OPEN.has(k) && (d.mobs || []).some(([x]) => x === t));
  return placed || SPAWNED.has(t) ? H.wl(`monsters/${t}`, n) : n;
};
const TOOL_OF = { mining: "pickaxe", woodcutting: "axe", fishing: "rod" };
const skillName = (G, s) => G.SKILLS[s]?.name || s;
/** what can be mined, cut or fished on these maps: one row per kind of node, with the level, the tool grade and what it gives */
function gatherTable(G, H, scenes) {
  const rows = new Map();
  for (const s of scenes) {
    if (!G.SCENES[s]) continue;
    let b; try { b = G.buildScene(s); } catch { continue; }
    for (const o of b.objs) {
      const sk = o.req?.skill; if (!TOOL_OF[sk]) continue;
      const k = o.ore || o.log || o.fish || (sk === "woodcutting" ? "logs" : sk === "fishing" ? "sardine" : null); if (!k || G.ITEMS[k]?.held) continue;
      const key = `${o.name}|${k}|${o.req.lvl}`, r = rows.get(key) || { name: o.name, k, k2: o.fish2 || null, l2: o.fish2lvl, sk, lvl: o.req.lvl, where: new Set() };
      r.where.add(s); rows.set(key, r);
    }
  }
  const list = [...rows.values()].sort((a, b) => a.sk.localeCompare(b.sk) || a.lvl - b.lvl), many = scenes.length > 1;
  if (!list.length) return "";
  return `<table class="tbl"><tr><th>What</th><th>Needs</th><th>Gives</th>${many ? "<th>Where</th>" : ""}</tr>${list.map((r) => `<tr><td>${H.esc(r.name)}</td><td>${skillName(G, r.sk)} ${r.lvl}, ${an(H.esc(G.toolNeed(r.lvl).name.toLowerCase()))} ${TOOL_OF[r.sk]}</td><td>${itemL(G, H, r.k)}${r.k2 && G.ITEMS[r.k2] ? `; ${itemL(G, H, r.k2)} from ${skillName(G, r.sk)} ${r.l2}` : ""}</td>${many ? `<td>${[...r.where].map((s) => areaL(G, H, s)).join(", ")}</td>` : ""}</tr>`).join("")}</table>`;
}
/** every monster the maps place, weakest first: level, health, what it shrugs off, its element weakness */
function mobTable(G, H, scenes, extra = []) {
  const seen = new Map();
  for (const s of scenes) for (const [t] of (G.SCENES[s]?.mobs || [])) { if (!G.MOBS[t] || G.MOBS[t].held) continue; const r = seen.get(t) || { t, where: new Set() }; r.where.add(s); seen.set(t, r); }
  for (const [t, s] of extra) if (G.MOBS[t] && !seen.has(t)) seen.set(t, { t, where: new Set([s]) });
  const list = [...seen.values()].sort((a, b) => G.MOBS[a.t].lvl - G.MOBS[b.t].lvl), many = scenes.length > 1;
  const el = (x) => (x ? (G.elementWords ? G.elementWords(x) : [].concat(x).join(", ")) : "&mdash;");
  return `<table class="tbl"><tr><th>Monster</th><th>Level</th><th>Health</th><th>Takes</th><th>Weak to</th>${many ? "<th>Where</th>" : ""}</tr>${list.map(({ t, where }) => { const m = G.MOBS[t], gt = G.guardText ? G.guardText(t).replace(/^Takes /, "").replace(/\.$/, "") : "";
    return `<tr><td>${m.boss ? "<b>" : ""}${mobL(G, H, t)}${m.boss ? "</b> (boss)" : ""}</td><td>${m.lvl}</td><td>${num(m.hp)}</td><td>${gt ? H.esc(gt) : "every style in full"}</td><td>${el(m.weak)}</td>${many ? `<td>${[...where].map((s) => areaL(G, H, s)).join(", ")}</td>` : ""}</tr>`; }).join("")}</table>`;
}
/** the drops worth walking for: gear, chase pieces, cores, eggs and pets, and who drops them. A monster's `rare` list rolls at the
    game's flat rare rate whatever is written beside it, so those say "rare" rather than a number that would be wrong. */
function chaseDrops(G, H, mobs) {
  const rows = [];
  for (const t of new Set(mobs)) {
    const m = G.MOBS[t]; if (!m) continue;
    const want = (k) => { const it = G.ITEMS[k]; return it && !it.held && (it.slot || it.chase || G.EGGS[k] || /_core$/.test(k)); };
    for (const [k, , p] of m.drops || []) if (want(k)) rows.push([itemL(G, H, k), t, p == null || p >= 1 ? "every kill" : oneIn(p)]);
    for (const [k] of m.rare || []) if (want(k)) rows.push([itemL(G, H, k), t, "rare"]);
    if (m.pet && G.PETS[m.pet[0]]) rows.push([`${H.wl(`pets/${m.pet[0]}`, H.esc(G.PETS[m.pet[0]].name))} (a pet)`, t, oneIn(m.pet[1])]);
  }
  if (!rows.length) return "";
  return `<table class="tbl" data-paged="25"><tr><th>Drop</th><th>From</th><th>Chance</th></tr>${rows.map(([what, t, ch]) => `<tr><td>${what}</td><td>${mobL(G, H, t)}</td><td>${ch}</td></tr>`).join("")}</table>`;
}
/** how you get to fight on a map: its band's bottom, or a bow or a wand where the map lets one in (Combat stops at 99) */
function gateText(G, k) {
  const b = G.BANDS[k]; if (!b) return "";
  if (b[0] <= 1) return "anyone";
  const w = [];
  if (b[0] <= 99) w.push(`Combat ${b[0]}`);
  if (G.ARCH_BAND?.[k] != null) w.push(`Archery ${G.ARCH_BAND[k]} with a bow`);
  if (G.MAGE_BAND?.[k] != null) w.push(`Magic ${G.MAGE_BAND[k]} with a wand`);
  return w.join(", or ");
}
/* THE TWO DUNGEONS' NUMBERS. Their rules live in eastscape-crypt-rules.js and eastscape-pyramid-rules.js, which the page loads only when a
   party needs them, and a guide is handed G and H, not those. So the Crypt and Pyramid guides read H.CRR / H.PYR when the page passes them
   and these mirrors otherwise; the wiki test (and anything that imports _CRYPT_T / _PYR_T) holds each figure to the rule file. */
const CRYPT_T = { party: [2, 4], runsPaid: 3, lateShare: 0.25, fullShare: 0.1, lowShare: 0.5,
  tiers: [null, { name: "The Crypt", lvl: 10, rec: 22, ante: 250, pay: 2500 }, { name: "The Deep Crypt", lvl: 30, rec: 47, ante: 750, pay: 7000 }, { name: "The Black Crypt", lvl: 40, rec: 76, ante: 1250, pay: 11000 }] };
const PYR_T = { party: [2, 4], runsPaid: 3, lateShare: 0.25, fullShare: 0.1, lowShare: 0.5, jitter: 0.25,
  coil: { everyMs: 21000, warnMs: 3000, maxMs: 9000, hurt: 0.09, breakFrac: 0.05, reach: 4 }, burrow: { at: [0.7, 0.4], downMs: 5000 },
  tiers: [null, { name: "The Great Pyramid", lvl: 40, rec: 76, ante: 1250, pay: 6500 }],
  loot: { rolls: [[3, 26], [4, 30], [5, 22], [6, 14], [7, 8]], lateRolls: 3, venom: [1, 2],
    table: [["tix", 26], ["shell", 16], ["fang", 14], ["drink", 12], ["meal", 10], ["clover", 9], ["chip", 6], ["gear", 4], ["pet", 1.6], ["horseshoe", 1.4]] },
  mobs: [["swarm", 53, "Scarab Swarm"], ["grifter", 54, "Grave Grifter"], ["canopic", 56, "Canopic Horror"], ["dustwraith", 57, "Sand Wraith"], ["pharaoh", 60, "Risen Pharaoh"], ["squeeze", 68, "The Squeeze"]] };
export { CRYPT_T as _CRYPT_T, PYR_T as _PYR_T };
/** the chance a Pyramid clear's chest holds the Coilling: every roll after the first is one line of the table, and the roll count is itself drawn */
const coilChance = (P) => { const L = P.loot, W = L.table.reduce((a, [, w]) => a + w, 0), p = (L.table.find(([k]) => k === "pet") || [, 0])[1] / W, RW = L.rolls.reduce((a, [, w]) => a + w, 0);
  return 1 - L.rolls.reduce((a, [n, w]) => a + (w / RW) * Math.pow(1 - p, n - 1), 0); };
const SEEDS_NOTE = (G) => `<p><b>Most crops are their own seed</b>: planting spends one of the thing you are growing, so the first of each kind has to be found. They drop from the monsters of the zone that grows them, at about <b>one kill in eighty</b>. <b>The four Wizardry flowers are the exception.</b> They grow from ${["seed_sun", "seed_ember", "seed_frost", "seed_void"].map((k) => G.ITEMS[k]?.name).filter(Boolean).join(", ").replace(/, ([^,]*)$/, " and $1")}, which drop from monsters all over the map at about <b>one kill in a hundred and twenty-five</b>, and you harvest the flower that ink is brewed from. What you can grow is decided by where you can survive.</p>`;

export const GUIDES = [
  /* (2026-09-22) This file is the hand-written half and imports nothing, so these numbers are TYPED, not read from
     PETS and PET_DROP. Keep them in step: the rate lives in PET_DROP and the roster in PETS, both in the rules file.
     The monster pages work the other way and compute their line, so those cannot drift. */
  /* (2026-09-27, the owner: "add all pet and fungiculture recipes/guides to the wiki ... speak plainly") BUILT FROM THE RULES now, not
     typed: breeding and eggs took the roster from seven pets to thirty, and a typed table had already fallen behind. Every pet, its
     rank, what it does and where it comes from; a pet held shut (PETS[k].held) and the Long Night's cat out of season are left out. */
  { id: "pets", title: "Pets", icon: "\u{1F43E}", cat: "Going further",
    body: (G, H) => {
      const R = G.RANKS, rk = (r) => `<b style="color:${R[r].col}">${R[r].mark ? `${R[r].mark} ` : ""}${R[r].name}</b>`;
      const eggOf = Object.fromEntries(Object.entries(G.EGGS).map(([k, e]) => [e.pet, k]));
      const places = (list) => list.map((s) => G.SCENES[s]?.name || (s === "wild" ? "The Wilderness" : s === "deep" ? "The Deep Wild" : s)).join(", ");
      /* (2026-09-30) EVERY BOSS PET FROM THE BOSS: MOBS[t].pet is [pet, chance]. This listed three by hand and the Valley, the Frozen
         Reach, the Ice Wyrm and the raid had added five more that it did not know about. */
      const bossOf = {};
      for (const [t, m] of Object.entries(G.MOBS)) if (m.pet && G.PETS[m.pet[0]] && !m.held) (bossOf[m.pet[0]] ||= []).push([t, m.pet[1]]);
      const bossWhere = (t) => { const s = Object.entries(G.SCENES).find(([k, d]) => G.OPEN.has(k) && (d.mobs || []).some(([x]) => x === t))?.[0];
        return s ? `, in ${H.esc(G.SCENES[s].name)}` : t === "icewyrm" ? ", which rises out of the Frozen Reach's lake once a day" : /^raid/.test(t) ? ", in a Yard raid" : t === "pumpkinking" ? ", during the Long Night only" : ""; };
      const from = (k, p) => {
        if (bossOf[k] && k !== "coilling") return bossOf[k].map(([t, ch]) => `${H.esc(G.MOBS[t].name)}${bossWhere(t)}, about 1 kill in ${Math.round(1 / ch)}`).join("; or ")
          + (k === "blackcat" && G.HW?.pet ? `; or ${num(G.HW.pet[1])} candy corn at the Night Market` : "");
        if (G.PET_DROP_KEYS.includes(k)) return `Any monster, about 1 kill in ${Math.round(1 / G.PET_DROP).toLocaleString()}, in: ${places([...G.PET_SCENES])}`;
        if (p.legend) return `Breed two Greater ${H.esc(G.PETS[p.base]?.name || p.base)} in your pet pen`;
        if (eggOf[k]) return `Hatch a ${H.esc(G.ITEMS[eggOf[k]]?.name || eggOf[k])} in a hatchery. ${G.EGGS[eggOf[k]].where ? `It comes from ${H.esc(G.EGGS[eggOf[k]].where)}.` : `Eggs drop from monsters in: ${places(G.EGGS[eggOf[k]].from)}`}`;   /* (2026-09-30) the Starling egg drops from no monster */
        if (k === "coilling") return `The chest at the end of ${H.wl("guides/pyramid", "the Great Pyramid")}, about 1 clear in ${Math.round(1 / coilChance(H.PYR?.PYRAMID || PYR_T))}`;
        return "&mdash;";
      };
      const rows = Object.entries(G.PETS).filter(([k, p]) => !p.held && (k !== "blackcat" || G.hwOn()))
        .sort(([, a], [, b]) => (a.legend ? 1 : 0) - (b.legend ? 1 : 0))
        .map(([k, p]) => `<tr><td><b>${H.esc(p.name)}</b></td><td>${rk(p.legend ? "legend" : "ordinary")}</td><td>${H.esc(G.petFxText(p.fx))}</td><td>${from(k, p)}</td></tr>`).join("");
      return `<p><b>A pet follows you around and gives you a bonus while you wear it.</b> You wear one at a time, in the paw square in your <b>Equipment</b> tab. Take it off and the bonus stops.</p>
      <h3>Ranks</h3>
      <p>Every pet is ${rk("ordinary")}, ${rk("greater")} or ${rk("legend")}. The ones you find are Ordinary. Breed two Ordinary pets in a pet pen to get a Greater one: it has the two stats you pick from its parents, 25% stronger, and glows blue. Breed two Greater pets of the same kind to get that pet's Legendary: a different pet with its own powers, glowing orange. The <b>Breeding</b> guide has the details.</p>
      <h3>Every pet</h3>
      <table class="tbl"><tr><th>Pet</th><th>Rank</th><th>Gives</th><th>How to get it</th></tr>${rows}</table>
      <h3>Good to know</h3>
      <p><b>Walk speed and work speed are different.</b> Walk speed is how fast you move. Work speed is how fast you hit a monster, a rock or a tree, and how fast you fish and pick pockets.</p>
      <p><b>Speed has a limit.</b> Pets, food and gear all share the same cap, so stacking a fast pet on a fast meal won't go past it.</p>
      <p><b>Name yours whatever you like.</b> Everyone sees the name. You can also let a pet go, and that can't be undone.</p>
      <h3>Trading and selling pets</h3>
      <p>A pet keeps its rank, its stats and its name when it changes hands. There are three ways:</p>
      <ul><li><b>The trade window.</b> Your pets are listed under your bag. Click one to offer it; click it again to take it back. Up to ${G.PET_TRADE.tradeMax} a trade.</li>
      <li><b>Livia's Exchange, the Pets tab.</b> Pick a pet and a price. It leaves your pets while it is up. Anyone can buy it outright, and the money goes to your bank, less 1%. You can have ${G.PET_TRADE.exSlots} up at once, and take one down any time.</li>
      <li><b>Bom, at the Prize Counter.</b> He buys any pet: ${Object.entries(G.PET_TRADE.bom).map(([r, n]) => `${G.RANKS[r].name} ${n.toLocaleString()}`).join(", ")} tickets. Use the Sell to Bom button in your Equipment tab while you stand at his counter. Another player will usually pay more.</li></ul>
      <p>One person can keep up to ${G.PET_TRADE.own} at once.</p>`;
    } },
  /* (2026-09-22) TYPED, like the pets page above and for the same reason: this file imports nothing. The rungs live
     in TOOL_GATES and the rule that turns a node's level into a rung is toolNeed(), both in eastscape-shared.js. */
  /* (2026-09-27, the owner: "we need a wiki page for this event which explains everything clearly - but only launch it when
     the event starts") The page's guide list skips this entry until hwOn() is true, so it appears with the season and goes with
     it. Every number is read from the rules, so the page cannot drift from the game. */
  { id: "longnight", title: "The Long Night", icon: "\u{1F383}", cat: "Going further",
    body: (G, H) => {
      const on = G.hwOn(), left = G.hwDaysLeft(), corn = (n) => `${Number(n).toLocaleString()} candy corn`;
      const nm = (k) => H.wl(`items/${k}`, H.esc(G.ITEMS[k]?.name || k)), pct = (x) => `${Math.round(x * 100)}%`;
      const K = G.MOBS.pumpkinking, night = `${G.HW.night[0] - 12} to ${G.HW.night[1] - 12} PM Central`;
      const shelf = G.HW.market.map(([k, n, c]) => `<tr><td>${H.ico(k)} ${n > 1 ? `${n} ` : ""}${nm(k)}${G.ITEMS[k].slot ? ' <em class="qtag">Halloween 2026 Event</em>' : ""}</td><td>${corn(c)}</td><td>${G.ITEMS[k].slot ? "keep it" : "used up"}</td></tr>`).join("");
      const cos = Object.values(G.STORE).filter((it) => it.tab === "night" && it.corn).map((it) => `<tr><td>${H.esc(it.name)} (a name cosmetic)</td><td>${corn(it.corn)}</td><td>keep it, worn from the Store's Name tab</td></tr>`).join("");
      const fits = Object.values(G.VANITY_SETS).filter((v) => v.corn).map((v) => { const pieces = Object.values(G.VANITY).filter((p) => p.set === Object.keys(G.VANITY_SETS).find((k) => G.VANITY_SETS[k] === v)); return `<tr><td>The ${H.esc(v.name)} fit, ${pieces.length} pieces</td><td>${corn(pieces[0]?.corn || 0)} a piece</td><td>keep it, coloured at Ronde's</td></tr>`; }).join("");
      const pieces = [["gallows_bow", "one chop in 10,000"], ["coffin_ring", "one swing at a rock in 10,000"], ["drowned_boots", "one cast in 10,000"], ["lantern_quiver", "the King (2%), or Hexa"], ["skull_wand", "the King (2%), or Hexa"], ["bag_shroud", "the King (2%), or Hexa"], ["reaper_scythe", "the King (1%), or 1 in 3,000 off any level 80+ monster"], ["king_crown", "the King (1%), or 1 in 3,000 off any level 80+ monster"], ["ferry_coin", "the King (1%), or 1 in 3,000 off any level 80+ monster"]]
        .map(([k, from]) => { const it = G.ITEMS[k]; return `<tr><td>${H.ico(k)} ${nm(k)}${it.legend ? " <b>legendary</b>" : ""}</td><td>${H.esc(G.SKILLS[it.req.skill].name)} ${it.req.lvl}</td><td>${H.esc(G.fxText(it.fx))}${it.pouch ? `; holds ${it.pouch.cap.toLocaleString()} ${it.pouch.ammo === "page" ? "pages" : "arrows"}` : ""}</td><td>${from}</td></tr>`; }).join("");
      const quests = [["hw_lights", "Lights Out", "Mudge the Lamplighter, the Lantern Mire", "easy"], ["hw_vigil", "The Sister's Vigil", "Sister Morrow, the Boneyard", "medium"], ["hw_king", "The Pumpkin King", "Hexa, the Yard", "hard"]]
        .map(([k, t, who, tier]) => `<tr><td>${H.wl(`quests/${k}`, t)}</td><td>${who}</td><td>${tier}</td><td>${H.esc(G.QUESTS[k].reward.text)}</td></tr>`).join("");
      return `<div class="wnote" style="border-color:#c8641e;background:rgba(200,100,30,.12)"><b>\u{1F383} ${on ? `The Long Night is on: ${left} day${left === 1 ? "" : "s"} left.` : "The Long Night is not on."}</b> It ends on the morning of <b>November 2nd</b>. Everything seasonal goes then: the tent, the King, the lanterns and every candy corn you have not spent. Everything you have <b>bought or found</b> stays yours for good.</div>
      <p class="lede">EastScape's Halloween, ${G.HW.from.slice(5).replace("-", "/")} to ${G.HW.until.slice(5).replace("-", "/")}. A month with its own coin, its own boss, its own shop, nine pieces of gear that exist nowhere else, and a hiscore board. Nothing in it touches tickets: what you earn and spend here is candy corn, and only candy corn.</p>

      <h3>1. What is on</h3>
      <ul>
        <li><b>Candy corn</b> drops from everything you kill and gather. It is the only thing the Night Market takes.</li>
        <li><b>Hexa the Candy Witch</b> keeps the Night Market, a tent in the Yard west of the north road.</li>
        <li><b>The Pumpkin King</b> rises once an hour in the Lantern Mire.</li>
        <li><b>Nightfall</b>, ${night} every evening: the world goes dark and every candy corn drop doubles.</li>
        <li><b>The Ghost Hunt</b>: ${G.HW.lanterns} ghost lanterns a day, hidden on the open maps, ${G.HW.lanternCorn} corn each.</li>
        <li><b>Trick or treat</b>, once a day, said to anyone.</li>
        <li><b>Three quests</b>, one per difficulty, ending in the King himself.</li>
        <li><b>Nine event pieces</b> of gear, all of them very rare drops.</li>
        <li>A <b>Candy corn</b> board on the Hiscores for the month.</li>
      </ul>

      <h3>2. How candy corn is earned</h3>
      <table class="tbl"><tr><th>Source</th><th>Pays</th><th>How often</th></tr>
        <tr><td>Any kill</td><td>${G.HW.corn.n[0]}&ndash;${G.HW.corn.n[1]}</td><td>${pct(G.HW.corn.kill)} of kills</td></tr>
        <tr><td>Any catch, cut or dig</td><td>${G.HW.corn.n[0]}&ndash;${G.HW.corn.n[1]}</td><td>${pct(G.HW.corn.gather)} of gathers</td></tr>
        <tr><td>A ghost lantern</td><td>${G.HW.lanternCorn}</td><td>${G.HW.lanterns} a day, each once, new places every morning</td></tr>
        <tr><td>Trick or treat (a treat)</td><td>${G.HW.trick.corn[0]}&ndash;${G.HW.trick.corn[1]}, or seeds, or a pie</td><td>once a day; ${pct(G.HW.trick.trickAt)} of the time it is a trick instead</td></tr>
        <tr><td>The Pumpkin King</td><td>${K.drops.find(([k]) => k === "candycorn")[1][0]}&ndash;${K.drops.find(([k]) => k === "candycorn")[1][1]}</td><td>every kill, once an hour</td></tr>
        <tr><td>The three quests</td><td>${["hw_lights", "hw_vigil", "hw_king"].map((k) => G.QUESTS[k].reward.items.find(([i]) => i === "candycorn")[1]).join(" + ")}</td><td>once</td></tr>
        <tr><td><b>Nightfall</b></td><td colspan="2">every drop above is <b>doubled</b> from ${night}</td></tr>
      </table>
      <p>An ordinary evening comes to about 150&ndash;250 corn; a hard one about 500. It expires: on November 2nd whatever is in your bag or bank turns to sugar, so spend it.</p>

      <h3>3. What candy corn buys</h3>
      <p>All of it at <b>the Night Market</b>, Hexa's tent in the Yard. The fits can also be bought from Ronde. Nothing here is ever sold for tickets. <b>Every event item can be traded to another player and listed on Livia's Exchange</b>; Bom will take any of them for <b>1 ticket</b>, and nothing more.</p>
      <table class="tbl"><tr><th>Item</th><th>Price</th><th>After the event</th></tr>${shelf}
        <tr><td>\u{1F408}‍⬛ The Black Cat (a pet)</td><td>${corn(G.HW.pet[1])}</td><td>keep it</td></tr>${cos}${fits}
        <tr><td>Reforging any Hallowed or event piece, per level</td><td>${corn(G.forgeCost("hallowed_helm")[1])} (a legendary ${corn(G.forgeCost("reaper_scythe")[1])})</td><td>the level stays; the corn does not</td></tr>
      </table>
      <p><b>Priced against a month.</b> A pie is a few kills. A fit is about a fortnight of play. The Hallowed set is the month if you grind for it, and the Pumpkin King drops every piece of it too, so the shelf is the slow certain road and the Mire the fast lucky one. The Black Cat is every corn a serious player will see before November; the King drops it one time in forty.</p>

      <h3>4. The Pumpkin King</h3>
      <p>Once an hour he climbs out of the clearing in the <b>Lantern Mire</b>; chat says when, and <b>typing /pumpkin in chat</b> tells you (and only you) how long until he rises, or how long he has left and how much health. He stands ${Math.round(G.HW.king.stays / 60000)} minutes and sinks back. Level ${K.lvl}, ${K.hp} hitpoints, hits up to ${K.max}, attacks on sight, <b>weak to fire and sun</b>, and he hits half again as hard once he is under ${pct(K.enrage.at)}. He takes a crowd: three players need about ten minutes, and one player alone will not finish him inside the twenty he stands. Every point of damage pays combat xp, so a long fight is a rich one. Everyone who does at least ${Math.round(G.OPEN_SHARE * 100)}% of his health gets their own drops and quest credit, however many of you there are.</p>
      <p>Every kill drops candy corn and ectoplasm. He also drops the Hallowed helm, cuirass and greaves, the Lantern Quiver, Skull Wand and Shroud Satchel, all three legendaries, and one King in forty has the Black Cat at his heel.</p>

      <h3>5. The nine pieces</h3>
      <p>Every one carries the <b>Halloween 2026 Event</b> tag, glows orange in your bag, is yours to keep, and reforges with candy corn instead of bars. Their numbers sit at their level's tier; the effect is the reason to want one.</p>
      <table class="tbl"><tr><th>Piece</th><th>Needs</th><th>Does</th><th>From</th></tr>${pieces}</table>
      <p>The bow, the ring and the boots never sit on a shelf: one chop, one swing, one cast in ten thousand, during the event only. The three legendaries fall from the King one time in a hundred, and one in three thousand from anything of level 80 or more killed while the event is on.</p>

      <h3>6. The Ghost Hunt, Nightfall, trick or treat</h3>
      <p><b>Lanterns.</b> ${G.HW.lanterns} ghost lanterns stand somewhere on the nine open maps each day, about one a map, moved every morning. Click one for ${G.HW.lanternCorn} corn (${G.HW.lanternCorn * 2} at Nightfall), once each a day. All ten is ${G.HW.lanterns * G.HW.lanternCorn} corn.</p>
      <p><b>Nightfall.</b> ${night}, every evening. The maps go dark (the Yard stays dark all month, for the look; its corn doubles only in the hour like everywhere else), the jack-o'-lanterns light the paths, and every candy corn drop is doubled until the hour is out. The wallet chip counts down to it.</p>
      <p><b>Trick or treat.</b> Once a day, say it to any person in the game. ${pct(1 - G.HW.trick.trickAt)} of the time it is a treat: a handful of corn, two pumpkin seeds, or a warm pie. The rest is a trick, and a trick can cost you five corn, drop a spider in your bag, or put you in the Boneyard.</p>

      <h3>7. Pumpkins, pie and the brew</h3>
      <p>Pumpkin seeds plant on your island at <b>Harvesting ${G.CROPS.seed_pumpkin.lvl}</b>, ripe in ${Math.round(G.CROPS.seed_pumpkin.ms / 60000)} minutes, ${G.CROPS.seed_pumpkin.yield[0]}&ndash;${G.CROPS.seed_pumpkin.yield[1]} pumpkins a plot, two seeds back every time and a third one in ten. A pumpkin bakes into a ${nm("pumpkinpie")} on any fire at Cooking ${G.RECIPES.cook_pumpkin.lvl}: heals ${G.ITEMS.pumpkinpie.heal} and, for ${G.ITEMS.pumpkinpie.meal.mins} minutes outside, rare drops come ${pct(G.ITEMS.pumpkinpie.meal.fx.rare)} easier and kills pay ${pct(G.ITEMS.pumpkinpie.meal.fx.tix)} more. Not xp: nothing in EastScape buys xp.</p>
      <p>${nm("ectoplasm")} falls off one kill in ${Math.round(1 / G.HW.ecto)} during the event. Two of it, a pumpkin and a medium vial brew a ${nm("pot_witch")} at the cauldron (Alchemy ${G.RECIPES.brew_witch.lvl}): drink it and your next death costs no hospital bill.</p>

      <h3>8. The quests</h3>
      <table class="tbl"><tr><th>Quest</th><th>Who</th><th>Tier</th><th>Pays</th></tr>${quests}</table>
      <p>They are a chain, in that order. The last one hands you the Hallowed helm outright.</p>

      <h3>9. What leaves and what stays</h3>
      <table class="tbl"><tr><th>Goes on November 2nd</th><th>Stays for good</th></tr>
        <tr><td>Hexa and the Night Market</td><td>Every piece of gear you found or bought</td></tr>
        <tr><td>The Pumpkin King, the lanterns, Nightfall, trick or treat</td><td>The Black Cat, the fits, the Pumpkin name and the Ember frame</td></tr>
        <tr><td>Every unspent candy corn</td><td>Pumpkins, pies and brews already in your bag</td></tr>
        <tr><td>The Candy corn board</td><td>Your quest rewards and your place on the other boards</td></tr>
      </table>
      <p>The Night Market says how many days are left at the top of its window, so does your candy corn chip, and the last week turns both red. Spend the corn.</p>`;
    } },
  /* (2026-09-30) GENERATED. It said "north off the Thunderhead" after the Depths of the Mountain went in between, its gathering table had
     no Singularity pocket, and "twice the hitpoints of anything else" stopped being true when the Valley's bosses came. */
  { id: "trailer", title: "The Trailer Park", icon: "🚚", cat: "Going further",
    body: (G, H) => {
      const T = G.SCENES.trailer, b = G.BANDS.trailer || [80, 99], K = G.MOBS.junkking;
      const others = Object.entries(G.MOBS).filter(([t, m]) => t !== "junkking" && !m.boss && !m.held && Object.entries(G.SCENES).some(([k, d]) => G.OPEN.has(k) && (d.mobs || []).some(([x]) => x === t)));
      const bigger = others.filter(([, m]) => m.hp * 2 >= K.hp).length;
      const via = T.exits?.s === "depths" && G.OPEN.has("depths") ? `Walk north off the Thunderhead into ${areaL(G, H, "depths")}; the Trailer Park is past it` : "North off the Thunderhead";
      const north = T.exits?.n && G.OPEN.has(T.exits.n) ? `, and ${areaL(G, H, T.exits.n)} is north of it` : "";
      return `<p><b>${via}${north}.</b> The road west ends at the Vault; the two are the top of the old game side by side rather than one after the other.</p>
      <p><b>Combat ${b[0]}</b> to start a fight here, <b>Fishing ${G.FISH_BAND?.trailer ?? b[0]}</b> for the black water. Everything in it bites.</p>
      ${mobTable(G, H, ["trailer"])}
      <p><b>The Junk King</b> stands in the fenced yard at the east end: ${num(K.hp)} hitpoints${bigger ? "" : ", more than twice anything else that is not a boss"}, and the only thing that drops <b>his cap</b> or <b>his wrench</b>. He is meant to be killed many times over.</p>
      <p><b>The richest gathering of the old maps</b>, and all of it wants a top-rung tool:</p>
      ${gatherTable(G, H, ["trailer"])}
      <p>Cook the fish and they are some of the best food this side of the ${H.wl("areas/deep", "Deep Wild")}. Before this zone there was nothing above Vaultwood to cut and nothing above the Vault to mine; the top of the ${H.wl("guides/tools", "tool ladder")} works here.</p>
      <h3>Worth knowing</h3>
      ${chaseDrops(G, H, ["junkdog", "possum", "scrapper", "gator", "junkking"])}`;
    } },
  /* (2026-09-30) GENERATED. The typed ladder had fifteen potions against a cauldron that brews over twenty, and a heading that said "the
     vial is the tier, and the timer": it is the tier, but every potion's time is its own (a small-vial sleeping draught lasts fifteen
     minutes, a large-flask Starcap tonic thirty). Every row is read from RECIPES and the potion itself now. */
  { id: "alchemy", title: "Alchemy: sand into potions", icon: "\u{1F9EA}", cat: "Skills",
    body: (G, H) => {
      const rs = Object.values(G.RECIPES).filter((r) => r.skill === "alchemy" && !G.ITEMS[r.out[0]]?.held).sort((a, b) => a.lvl - b.lvl || a.id.localeCompare(b.id));
      const ing = (r) => r.in.map(([k, n]) => `${n > 1 ? `${n} ` : ""}${itemL(G, H, k)}`).join(", ");
      const vials = rs.filter((r) => /_vial$/.test(r.out[0]));
      const does = (it) => { const fx = it.drink?.fx || {}, w = [G.fxText(fx)]; if (fx.steal) w.push(`you pick pockets ${Math.round(fx.steal * 100)}% more reliably`); return w.filter(Boolean).join("; "); };
      const pots = rs.filter((r) => { const it = G.ITEMS[r.out[0]]; return it && (it.drink || it.heal) && (!it.event || G.hwOn()); });
      const witch = rs.find((r) => r.out[0] === "pot_witch" && G.hwOn());
      const inks = rs.filter((r) => /^ink_/.test(r.out[0])), other = rs.filter((r) => !vials.includes(r) && !pots.includes(r) && !inks.includes(r) && r.out[0] !== "pot_witch");
      return `<p><b>Alchemy runs 1 to 99 and it starts with sand.</b> Dig it out of the pits in ${H.wl("guides/sands", "the Golden Sands")} at <b>Mining 20</b>, melt it to glass at the <b>cauldron</b> under the temple colonnade, then brew the glass with what the world drops.</p>
      <p><b>One cauldron does both jobs.</b> It is the only one in the game: it blows the vials and it brews the potions, so everything to do with Alchemy happens on one tile, and you never need a level of Smithing to train it.</p>
      <h4>It can go wrong</h4>
      <p><b>Nothing here is a certainty.</b> A recipe spoils about <b>half</b> the time at the level that unlocks it and settles down as you climb past it, but it never reaches nothing. Glasswork bottoms out around <b>one batch in fifty</b>, for ever. A spoiled batch leaves nothing behind.</p>
      <h4>The vials</h4>
      <p>The vial is the tier: a better potion wants a bigger bottle. How long a potion lasts is its own, and it is in the table below.</p>
      <table class="tbl"><tr><th>Alchemy</th><th>Vial</th><th>Takes</th><th>xp</th></tr>${vials.map((r) => `<tr><td>${r.lvl}</td><td>${itemL(G, H, r.out[0])}</td><td>${ing(r)}</td><td>${r.xp}</td></tr>`).join("")}</table>
      <h4>Every potion, in order</h4>
      <p>The ladder <b>alternates a skilling buff with a combat one</b> most of the way up, so whichever sort of player you are there is rarely a dead stretch. <b>"Bite" is fishing</b>: it is how readily a fish takes the hook, not how hard you hit.</p>
      <table class="tbl" data-paged="25"><tr><th>Alchemy</th><th>Potion</th><th>Does</th><th>Lasts</th><th>Needs</th></tr>${pots.map((r) => { const it = G.ITEMS[r.out[0]];
        return `<tr><td>${r.lvl}</td><td>${itemL(G, H, r.out[0])}${r.out[1] > 1 ? ` &times;${r.out[1]}` : ""}</td><td>${it.heal ? `heals ${it.heal} at once` : H.esc(does(it))}</td><td>${it.drink ? `${it.drink.mins} min` : "&mdash;"}</td><td>${ing(r)}</td></tr>`; }).join("")}</table>
      ${witch ? `<p><b>During the Long Night</b> the cauldron also brews ${itemL(G, H, "pot_witch")} at Alchemy ${witch.lvl} (${ing(witch)}): drink it and your next death costs no hospital bill.</p>` : ""}
      <p><b>A potion is a drink.</b> It takes the same slot as the Prize Counter's lager, whiskey and champagne, so drinking one replaces whichever drink is running, and the other way round. A salve is not a drink: it heals on the spot, like food, and sits happily alongside everything else.</p>
      <p><b>A potion stacks with your gear.</b> Every number above sits under the ceiling the game caps each effect at, so drinking one adds to what you are wearing instead of replacing it.</p>
      <p><b>They only work outside.</b> Like the bar's food and drink, a buff counts down in places that have monsters in them, not on the casino floor.</p>
      <h4>Ink, and the odd extra</h4>
      <p>The cauldron also brews <b>ink</b> for ${H.wl("guides/wizardry", "Wizardry")}: ${inks.map((r) => `${itemL(G, H, r.out[0])} (Alchemy ${r.lvl}, from ${ing(r)})`).join("; ")}.${other.length ? ` And: ${other.map((r) => `${r.out[1] > 1 ? `${r.out[1]} ` : ""}${itemL(G, H, r.out[0])} at Alchemy ${r.lvl}, from ${ing(r)}`).join("; ")}.` : ""}</p>`;
    } },
  { id: "sands", title: "The Golden Sands", icon: "\u{1F3DC}\uFE0F", cat: "Going further",
    body: `<p><b>Combat 40 to 49, west out of <a data-wiki="guides/road">the Boneyard</a></b> &mdash; and it is a <b>second route, not a rung</b>. At Combat 40 you may go north to Cloudreach or west to here, and each has its own ore, tree and fish. Neither is ahead of the other.</p>
      <p>It is where <a data-wiki="guides/alchemy">Alchemy</a> lives. The <b>sand pits</b> are the front of that whole chain, and the game's only <b>cauldron</b> stands under the temple colonnade in the middle of the map.</p>
      <table class="tbl"><tr><th>What</th><th>Needs</th><th>Gives</th></tr>
        <tr><td><b>Sand pits</b> (five of them)</td><td>Mining 20</td><td>sand &mdash; 45 xp</td></tr>
        <tr><td><b>Stardust seams</b></td><td>Mining 50</td><td>stardust &mdash; 150 xp</td></tr>
        <tr><td><b>Date palms</b></td><td>Woodcutting 45</td><td>palm logs &mdash; 190 xp</td></tr>
        <tr><td><b>The oasis</b></td><td>Fishing 40 / 48</td><td>oasis perch, temple carp</td></tr>
      </table>
      <p><b>Sand is Mining 20 on purpose</b>, far below the map's own band: the barrier is meant to be <i>getting here</i>, not a second grind once you have. And <b>stardust had exactly one rock in the whole game</b> before this map &mdash; there are two more here.</p>
      <h4>What lives there</h4>
      <p><b>Sand Cobras</b> (41) in the dunes and <b>Gilt Scarabs</b> (45) round the pits &mdash; the cobra drops the <b>fang</b> and the scarab the <b>shell</b>, both of which go in the best potions. <b>Bandaged Debtors</b> (43) shuffle about the precinct and <b>Tomb Jackals</b> (47) hold the pyramid. Everything waits to be hit first except <b>one jackal by the pyramid door</b>, which comes at you on sight.</p>
      <h4>The Great Pyramid</h4>
      <p>It stands on the eastern skyline, and <b>the tomb door is open</b>. It is a party dungeon like <a data-wiki="guides/crypt">the Crypt</a>: two to four of you pay an ante each, get a private copy of the tomb, and climb four chambers to something very old at the top. See <a data-wiki="guides/pyramid">The Great Pyramid</a>.</p>` },
  /* (2026-09-25) GENERATED, like the smoking guide and for the same reason. This was titled "the seven rungs"
     with a table that stopped at Eclipse and called it "anything", two tiers after Nova and Singularity shipped;
     the prose above it had been half-corrected to "nine grades", so the page disagreed with itself. The rungs,
     their gates, their speeds and their prices all exist in the rules, so none of it is typed here any more. */
  { id: "tools", title: "Tools: the grade ladder", icon: "⛏️", cat: "Skills",
    body: (G, H) => {
      const rungs = G.TOOL_RUNGS.map((r, i) => ({ ...r, upTo: G.TOOL_RUNGS[i + 1] ? G.TOOL_RUNGS[i + 1].gate - 1 : null,
        spd: G.ITEMS[`${r.key}_pickaxe`]?.tspd, price: (G.SHOP.sells.find(([k]) => k === `${r.key}_pickaxe`) || [])[1] }));
      const names = rungs.map((r) => r.name.toLowerCase());
      const cheap = rungs.filter((r) => r.price && r.price < 10000).length;
      return `<p>A <b>pickaxe</b>, an <b>axe</b> and a <b>fishing rod</b> come in ${names.length} grades, the same ${names.length} as the armour: ${names.join(", ")}.</p>
      <p><b>The rock decides.</b> Whatever you are mining, cutting or fishing asks for a tool of its own grade or better &mdash; emerald ore wants an emerald pickaxe, and a bronze one will not touch it. The grade a thing wants is always the grade named on the thing itself, so if you can work it at all, the right tool is one you can hold.</p>
      <table class="tbl"><tr><th>Tool</th><th>Works up to</th><th>Speed</th><th>At the counter</th></tr>
        ${rungs.map((r) => `<tr><td>${H.ico(`${r.key}_pickaxe`)} <b>${H.esc(r.name)}</b></td><td>${r.upTo ? `level ${r.upTo}` : "anything"}</td><td>${r.spd ? `+${Math.round((r.spd - 1) * 100)}%` : "&mdash;"}</td><td>${r.price ? r.price.toLocaleString() : "&mdash;"}</td></tr>`).join("")}
      </table>
      <p>A better tool is also <b>quicker at everything below it</b>, so it is never wasted on easy work.</p>
      <p><b>Two ways to get one.</b> Buy it at the <a data-wiki="npcs/Bom Trady">Prize Counter</a> &mdash; the first ${cheap} are cheap for their grade on purpose, and the top two are not &mdash; or <b>smith it</b>: two bars for a pickaxe or an axe, one for a rod, at the anvil.</p>
      <p><b>The top rungs gate above their own ore.</b> A ${H.esc(rungs.at(-2).name)} rock is worked with the tool below it, so a new grade never quietly raises the bar on rocks you were already mining, and you are never asked for a pickaxe you can only make from ore that pickaxe is needed for.</p>
      <p><b>You have to be holding it.</b> Pickaxe, axe or rod, it goes in the weapon slot &mdash; one in your bag will not do. That is the whole cost of the ladder: while you are working you are not carrying a sword.</p>`;
    } },
  { id: "start", title: "Start here", icon: "\u{1F9ED}", cat: "Starting out",
    body: (G) => `<p><b>This is a casino with a world attached.</b> The tables are the point; everything outside exists to pay for them.</p>
      <h3>The first five minutes</h3>
      <p><b>Play a table.</b> You start with enough to play. Every game takes tickets or real ZCoins: bet tickets and a win pays tickets, bet ZCoins and it pays ZCoins. The window has a toggle. See <a data-wiki="guides/casino">The casino</a>.</p>
      <p><b>When you run out, go outside.</b> Walk out of the casino into the Yard. Hit something, chop something, or fish. Take what you find to <a data-wiki="npcs/Bom Trady">Bom Trady</a> in the middle of the floor and it becomes tickets.</p>
      <p><b>Cook your fish before you sell it.</b> Raw fish is worth nothing and Bom will not take it &mdash; the campfire is by the casino door, and cooking roughly doubles what a fish is worth.</p>
      <h3>Then what</h3>
      <p><b>Check the task board</b> inside the casino: ${word(G.DAILY_COUNT)} <a data-wiki="guides/jobs">jobs a day</a>, usually things you were going to do anyway. <a data-wiki="guides/order">Bronny's order</a> in the Yard is the whole server's daily, and three <a data-wiki="guides/events">world events</a> turn up every afternoon and evening.</p>
      <p><b>Buy a better tool before better gear.</b> <a data-wiki="guides/tools">Tools</a> decide what you can gather at all, and a grade up is 8% off every swing forever.</p>
      <p><b>Walk north when the Yard gets easy.</b> The world is a chain of areas about ten levels apart &mdash; see <a data-wiki="guides/road">The road out</a>.</p>
      <h3>Worth knowing early</h3>
      <p><b>You can walk anywhere at level one</b>, but every area outside has a level band: below its bottom you cannot start a fight there, or fish its water. A sign at the way in says what it asks. The few monsters that attack on sight do not check your level first.</p>
      <p><b>Dying does not cost you your gear</b>, only some of the tickets in your pocket. The bank will not hold tickets, so spend them before a long trip.</p>
      <p><b>Lost? Type /find</b> and a thing, a place or a person in the chat box, and it tells you where it is and the way there. The <a data-wiki="guides/commands">Chat commands</a> page has the rest.</p>
      <p><b>Press H</b> to open this wiki at any time.</p>` },
  /* (2026-09-25, the owner: "can you add a section in the wiki for keybinds"). Every key the page listens for, read out of its
     keydown handlers. Staff-only keys are left out. When a key is added or moved, this table is the other place it goes. */
  { id: "keys", title: "Keybinds", icon: "\u2328\uFE0F", cat: "Starting out",
    body: (G) => `<p><b>Every key, in one place.</b> None of them fire while you are typing in a box (chat, a search, a name), or while Ctrl, Alt or Cmd is held, so they never get in the way of the browser's own shortcuts.</p>
      <h3>Moving and fighting</h3><table class="tbl"><tr><th>Key</th><th>Does</th></tr>
      <tr><td><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or the arrow keys</td><td>Walk. Holding a key keeps walking. A click on the ground or on anything walks you there and does it.</td></tr>
      <tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd></td><td>Use your quick slots, the four squares beside the Chat button: a potion, food, a buff, arrows, or a piece of gear (press again to take it off). <b>Press and hold</b> a slot, or right-click it, to change what is in it. <a data-wiki="guides/store">The Store</a> sells up to ${word(G.STORE_UP.quick.max)} more, each on its own key: <kbd>5</kbd> to <kbd>${4 + G.STORE_UP.quick.max}</kbd>.</td></tr>
      <tr><td><kbd>E</kbd></td><td>Eat the best <b>cooked</b> food in your bag, whatever heals most. It never touches potions, drinks, buff meals or smoked fish, and does nothing at full health.</td></tr>
      </table>
      <h3>Windows</h3><table class="tbl"><tr><th>Key</th><th>Does</th></tr>
      <tr><td><kbd>I</kbd> <kbd>U</kbd> <kbd>K</kbd> <kbd>J</kbd>${G.HOLD.diary ? "" : " <kbd>L</kbd>"}</td><td>The tabs over your inventory: Inventory, Equipment, Skills, Quests${G.HOLD.diary ? "" : ", and your Diary (it opens on the map you're standing on)"}.</td></tr>
      <tr><td><kbd>C</kbd></td><td>Your Character window: every number about you, and where to get more.</td></tr>
      <tr><td><kbd>Q</kbd></td><td>The quest log.</td></tr>
      <tr><td><kbd>T</kbd></td><td>Open or close the chat.</td></tr>
      <tr><td><kbd>Enter</kbd></td><td>Open the chat with the cursor in the box; Enter again sends.</td></tr>
      <tr><td><kbd>G</kbd></td><td>The games: every table in the casino, in one list.</td></tr>
      <tr><td><kbd>Y</kbd></td><td>Achievements.</td></tr>
      <tr><td><kbd>H</kbd> or <kbd>?</kbd></td><td>This wiki.</td></tr>
      <tr><td><kbd>M</kbd></td><td>Mute or unmute every sound, the jukebox included.</td></tr>
      <tr><td><kbd>N</kbd></td><td>The connection panel: your ping, for when something feels laggy.</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>Close whatever is open: a window, a conversation, the item info box, or the chat box.</td></tr>
      </table>
      <h3>Talking to people</h3><table class="tbl"><tr><th>Key</th><th>Does</th></tr>
      <tr><td><kbd>1</kbd> to <kbd>9</kbd></td><td>Pick that answer. While somebody is talking to you the number keys answer them and <b>do not</b> use your quick slots.</td></tr>
      <tr><td><kbd>Space</kbd></td><td>Carry on, when there is only one answer.</td></tr>
      </table>
      <h3>With the mouse</h3><table class="tbl"><tr><th>Do this</th><th>To</th></tr>
      <tr><td>Shift-click in your bag</td><td>Drop it (it asks first, unless you turned that off in Settings).</td></tr>
      <tr><td>Right-click any item</td><td>Open its page in this wiki.</td></tr>
      <tr><td>Shift-click in the bank</td><td>Take out a full stack, or put in every one you carry.</td></tr>
      <tr><td>Shift-click in a trade</td><td>Offer the whole stack.</td></tr>
      </table>` },
  /* (2026-09-30) GENERATED from GAMES. It said "eight tables" after the Boiler made nine, and that the odds were identical in tickets
     and ZCoins: a ticket bet is played by the game server in its own band (EDGE_BAND), a ZCoin bet by eastcoin.vip in the site's. */
  { id: "casino", title: "The casino", icon: "\u{1F3B0}", cat: "Starting out",
    body: (G, H) => {
      const games = Object.values(G.GAMES), C = G.CASINO, T = G.TIX_HOUR, B = G.EDGE_BAND;
      return `<p><b>${Word(games.length)} tables, and every one of them plays for tickets or for real ZCoins.</b> Bet tickets and a win pays tickets; bet ZCoins and it pays ZCoins. The window has a toggle, and <kbd>G</kbd> opens every table from anywhere on the floor.</p>
      <table class="tbl"><tr><th>Table</th><th>How it goes</th></tr>${games.map((g) => `<tr><td>${g.icon} ${H.esc(g.name)}</td><td>${H.esc(g.ex)}</td></tr>`).join("")}</table>
      <p><b>The odds are not a secret and they are not fixed per game.</b> Every play draws its own house edge inside a narrow band, sealed behind a committed hash before your stake is taken and revealed when the play is over. On tickets a play returns between <b>${Math.round(B[0] * 100)}%</b> and <b>${Math.round(B[1] * 100)}%</b> of what went in; the ZCoin side is eastcoin.vip's own tables and its own band. No table is a better bet than another &mdash; that is deliberate, because a game that pays better than the rest is one people would only play.</p>
      <p><b>The slots carry a Jackpot.</b> ${Math.round(G.JACKPOT.slice * 100)}% of every spin goes into one pot everybody shares, and three sevens wins it (a full-size spin takes all of it). It never starts from nothing: the house puts ${num(G.JACKPOT.seed)} back in after a win.</p>
      <p><b>Limits, on tickets.</b> ${num(C.minBet)} to ${num(C.maxBet)} a bet, a short pause between bets, <b>${T.perGame} plays an hour at each table</b>, and no new bet once you are ${num(T.winCap)} up across the last hour (a win already paid is never trimmed). The ZCoin side carries the site's own limits.</p>
      <p><b>Wins get announced.</b> Anything from ${C.roomWin}&times; tells the room; ${C.worldWin}&times; and up tells everyone in the game.</p>
      <p><b>Through the back wall</b> are three more rooms: the Fight Pit, the Picture House and the Roulette Room. See <a data-wiki="guides/rooms">The casino's back rooms</a>.</p>
      <p>Broke? <b>Go outside.</b> Hit something or fish, and take what you find to <a data-wiki="npcs/Bom Trady">Bom Trady</a>. See <a data-wiki="guides/tickets">Tickets</a>.</p>`;
    } },
  /* (2026-09-30) Rewritten against the rules. It said Bom sells bronze gear only (he sells every grade), that tickets cannot be traded
     (they can, since v96), and that there is no way from tickets to ZCoins (the Prize Counter trades them in, since v107). */
  { id: "tickets", title: "Tickets and the Prize Counter", icon: "\u{1F3AB}", cat: "Starting out",
    body: (G, H) => {
      const D = G.DEX, grades = G.TOOL_RUNGS.map((r) => r.name.toLowerCase());
      return `<p><b>Tickets are the money and Bom Trady is the whole economy.</b> He stands in the middle of the casino floor. Everything you find outside becomes tickets at his counter, and everything you want comes back over it.</p>
      <p><b>He buys loot and things you made</b> &mdash; ore, bars, logs, cooked fish, monster drops. He does <b>not</b> buy raw fish, so cook it first, and he leaves your tools, charms and anything wearable alone so you cannot cash in the set you are standing in by accident.</p>
      <p><b>He sells</b> every tool and every grade of armour and weapon, ${grades[0]} to ${grades.at(-1)}; the first ${itemL(G, H, "logs_shortbow")}, ${itemL(G, H, "logs_quiver")}, ${itemL(G, H, "logs_wand")} and ${itemL(G, H, "bag_scrap")}, with arrows and spell pages to go in them; food, drinks, and your bag upgrades. Your <a data-wiki="guides/vip">VIP rank</a> is a standing discount on all of it.</p>
      <p><b>Tickets stay on you.</b> You cannot drop them and the bank will not take them, but you <b>can</b> hand them to another player in a trade. What a death costs you is a share of the tickets in your pocket, which is the argument for spending them before a long trip out.</p>
      <h3>Tickets into ZCoins</h3>
      <p><b>Real ZCoins are eastcoin.vip's money</b>, and there are two ways to get them here. Find one outside (see <a data-wiki="guides/zcoins">Finding ZCoins</a>) and the counter puts it straight onto your balance on the site. Or <b>trade tickets in</b> at the counter: <b>${num(D.rate)} tickets for 1 ZCoin</b>, up to ${D.capDay} ZCoins in any 24 hours, and a found ZCoin banked counts toward the same ${D.capDay}. It only goes one way: ZCoins never turn back into tickets.</p>
      <p><b>At the tables</b> a ticket bet pays tickets and a ZCoin bet pays ZCoins. See <a data-wiki="guides/casino">The casino</a>.</p>
      <p>Other players are usually the better price for anything rare. See <a data-wiki="guides/trading">Trading and the Market</a>.</p>`;
    } },
  /* (2026-09-25) THE TABLE IS GENERATED, the colour is not. This listed neither the Golden Sands nor the Carnival
     and had the Boneyard ending eight levels early - an area can be built, placed and mined for a fortnight
     without anything making the map of the world mention it. The rows and the level bands now come from where the
     monsters actually stand; NOTE is the editorial half, and an area with no note still gets its row rather than
     quietly not existing. ORDER is the reading order, which is not a thing the rules know: two areas can sit at
     the same levels and be a choice rather than a sequence. */
  { id: "road", title: "The road out", icon: "\u{1F5FA}️", cat: "Starting out",
    body: (G, H) => {
      const ORDER = ["workyard", "thrill", "thrill_top", "gloam", "mire", "boneyard", "orchard", "cloud", "frozen", "frostspire", "sands", "thunderhead", "carnival", "boardwalk", "bw_cabin", "bw_light", "bw_wreck", "bw_pier", "bw_skull", "foundry", "fd_grove", "fd_maze", "fd_isle", "fd_chain", "fd_gate", "fd_hall", "vault", "depths", "trailer", "valley", "valley_ridge", "valley_lair", "wild", "deep"].filter((k) => G.SCENES[k] && !G.SCENES[k].wikiHide);   /* (2026-09-27) the two wild maps, when they are open */
      const NOTE = {
        workyard: "the casino, the bank, the campfire, the furnace and anvil, the Tower, the Crypt stairs, the Bounty Board, Bronny's order, sardines",
        thrill: "Agility's own map, through the gate by the Yard's north wall: the Rookie Run (any level) and the Pro Run (40), stunts in crash-barrier pens run in order for a lap bonus and runner's marks, Fast Eddie (he takes the marks), the Junk Mound (Agility 50: Grease Gremlins, featherwood that drops feathers), and the human cannonball (70)",   /* (2026-10-01) */
        thrill_top: "where the cannon lands: the Champion Run (Agility 70), Hellbikers and the nitro pool (Fishing 75, a walk-speed fish) in the Burnout Pit, and the Peak (Agility 90): chrome (Mining 85, for chrome-toe boots), a lockbox, and Big Daddy Crusher",
        gloam: "emerald and diamond ore, gloomwillow, trout and catfish",
        mire: "lanternfish, mudskipper, the first real gear drops",
        boneyard: "bonefish and ghost carp in the flooded crypt &mdash; and <b>pets start dropping here</b>",
        cloud: "dragonstone and onyx ore, skyash, sky eel and cloud ray",
        frozen: "north of Cloudreach, and a mage's country, with a cold that hurts without a frost ward: yetis and snow owls on shelves and ice floes only a spell or an arrow reaches, frost wolves and wraiths on the snow, glacite (Mining 94), frostpine (Woodcutting 94), icefin through the ice (Fishing 94), and the Ice Wyrm, which comes up through the lake once a day",   /* (2026-09-30) held until the owner opens it */
        frostspire: "north of the Frozen Reach: Frost Giants on the shelves, Ice Elementals on the tarn's floes, Frost Wraiths, and the Frost Jarl on the high ice shelf, an open-world boss only spells reach",
        sands: "sand for <a data-wiki=\"guides/alchemy\">Alchemy</a>, the cauldron, the Great Pyramid",
        thunderhead: "storm marlin, thunder squid, the way to the last two",
        carnival: "the games, the duck pond, goldfish and koi",
        vault: "end-game fighting, and the only <b>nova</b> and <b>singularity</b> ore in the game",
        boardwalk: "a drowned seaside market west of the Carnival: mackerel, bluefin and swordfish off the piers, the Chip Shop, gulls and Kraken Arms that only a bow or a wand reaches, and Captain Claw at the bottom of the strand",   /* (2026-09-27) */
        orchard: "the country south of the Boneyard: a market wagon under the big trees, pines (Woodcutting 52) and walnuts (66), Pomona's stove, wasps over the pond, and across the brook's stone bridge an orc camp behind a fence, its wood below it, and the Gardener at the bottom of it",   /* (2026-09-27) */
        bw_cabin: "the Boardwalk's second island: a cabin, palms, starfall rocks and mackerel",   /* (2026-09-27) */
        bw_light: "a lighthouse on its own island: starfall and eclipse rocks, bluefin, Clawhands on the sand",
        bw_wreck: "a ship broken in two on a sandbar: eclipse rocks, swordfish, and Kraken Arms in the shallows",
        bw_pier: "the pirates' house and a boathouse out on the pier: nova rocks, bluefin and swordfish",
        bw_skull: "the last island: the skull in the rock, nova rocks, Captain Claw, and the chest he sits on, which opens for everyone who put him down",
        foundry: "the Works, the Foundry's way in, south of the Thunderhead: Basalt the foreman (he buys the imps' tallies), the blast furnace (every furnace recipe, half as much xp again, and a slag batch that makes a third bar), Eclipse veins, Slag Golems, and a field of bone spikes that go off on their own",   /* (2026-09-27) the Foundry rebuilt as seven areas */
        fd_grove: "west of the Works: a dead tree, pools that pulse like something breathing, Eclipse veins, golems and an imp, and ground that catches fire",
        fd_maze: "south of the Works: paths over the lava with the tower at the bottom and a lavafall, Nova veins, imps, the spitfire in the middle of the floor, and the portal to the Floating Isle",
        fd_isle: "through the Lava Maze's portal: an island of rock on chains over the lava, the crusher on its pentagram, a Singularity vein and a Nova vein, Cinder Elementals",
        fd_chain: "south of the Lava Maze: a rock hung on chains over the lava, walked across on the chains themselves, a Singularity vein, a geyser, Cinder Elementals",
        fd_gate: "south of the Chained Rock: a causeway over the lava to the burning door in the castle wall, and a tiny volcano that throws lava balls at it",
        fd_hall: "through the burning door: the wall of bodies, two towers with an eye on each, and Old Bessemer, the giant, up to his chest in it",
        depths: "ledges over a bottomless drop: monsters that shrug off a whole fighting style, abyss crystal, eclipse and nova ore, and the Deepwarden",   /* (2026-09-27) */
        trailer: "the best gathering in the game, and the meanest neighbours",
        valley: "north of the Trailer Park, and a bow's country: cavemen and pterodactyls on ledges only an arrow reaches, sabretooths on the road, woolly mammoths on the plateaus, coelacanth in the lake (Fishing 92), cycads (Woodcutting 92), and the Mammoth Matriarch, an open-world boss up on the great plateau",   /* (2026-09-30) held until the owner opens it */
        valley_ridge: "north of the Lowlands: plateau after plateau with Caveman Hunters and Elder Pterodactyls on top, raptors on the ground, fossil rocks (Mining 92)",
        valley_lair: "the end of the valley: the dragon fossil, a volcano, tar horrors in the tar pits, and Old Rex on his throne up on the high plateau, an open-world boss only arrows reach",
        wild: "down the rope ladder on the Thunderhead's south edge: other players can attack you, nodes far apart, most things attack first, and the first of three monsters found nowhere else",
        deep: "the far end of the Wilderness: the Black Pool (Fishing 92 and 97), the Gallows oak (Woodcutting 90), the Grim Liches, the Nexus",
      };
      const rows = ORDER.filter((k) => G.SCENES[k] && G.OPEN.has(k)).map((k) => {   /* (2026-09-27) a held map (the Depths, and for now the Boardwalk, the Foundry and the Orchard Wall) is not listed */
        const ls = [...new Set((G.SCENES[k].mobs || []).map(([t]) => G.MOBS[t]?.lvl))].filter(Boolean).sort((a, b) => a - b);
        return { k, name: G.SCENES[k].name, band: ls.length ? `${ls[0]}&ndash;${ls.at(-1)}` : "&mdash;", gate: gateText(G, k) || "&mdash;", note: NOTE[k] || "" };
      });
      const past = ORDER.filter((k) => G.OPEN.has(k) && (G.BANDS[k]?.[0] || 0) > 99);
      return `<p><b>The world is a chain.</b> Each area is about ten levels past the last, and the way on is an edge of the map &mdash; walk off it and you are in the next one. <b>You can walk anywhere at level one</b>, but an area will not let you start a fight until you reach the bottom of its band, and its water wants the same in Fishing; the sign at the way in says what it asks.</p>
      <table class="tbl"><tr><th>Area</th><th>Monsters</th><th>To start a fight</th><th>What it has</th></tr>
        ${rows.map((r) => `<tr><td>${H.wl(`areas/${r.k}`, H.esc(r.name))}</td><td>${r.band}</td><td>${r.gate}</td><td>${r.note}</td></tr>`).join("")}
      </table>
      ${past.length ? `<p><b>Past 99.</b> Combat stops at 99, so the areas whose band starts above it are opened by the other two styles instead: ${past.map((k) => `${H.esc(G.SCENES[k].name)} (${gateText(G, k)})`).join(", ")}. The Primeval Valley is a bow's country and the Frozen Reach a wand's, and much of what lives in them shrugs off a sword entirely.</p>` : ""}
      <p><b>Cloudreach and the Golden Sands are a fork, not a rung.</b> At Combat 40 either will have you; they hold different ore, different trees and different fish, and neither is ahead of the other.</p>
      <p><b>Go one area past comfortable, not three.</b> Monsters hit harder than their level suggests once you are out of your depth, and dying costs a bigger share of your tickets the deeper you are &mdash; see <a data-wiki="guides/dying">Dying</a>.</p>
      <p><b>Spend first.</b> A death takes a percentage of the tickets you are <i>carrying</i>, and the bank will not hold tickets, so a trip out with an empty pocket is nearly free.</p>
      <p><b>The Wilderness is off this chain</b> and other players can attack you in it.</p>`;
    } },
  /* (2026-09-25) THE TOWER HAD NO PAGE AT ALL, through the climb going from 30 floors to 99, and it is the one
     thing in the game somebody sits in for hours. Everything with a number in it is read from the tower rules,
     because those are exactly the numbers that moved. */
  { id: "tower", title: "The Tower", icon: "\u{1F5FC}", cat: "Going further",
    body: (G, H) => {
      const T = H.TWR && H.TWR.TOWER;
      if (!T) return `<p>The Tower stands in the Yard's north court. Climb it a floor at a time.</p>`;
      const mins = (T.fightMs / 60000).toFixed(1).replace(/\.0$/, ""), bosses = Object.keys(T.bosses).map(Number).sort((a, b) => a - b);
      return `<p><b>One door, ${T.floors} floors, one monster on each.</b> It stands in the Yard's north court beside the furnace. You need <b>Combat ${T.entry}</b> to go in, and floor 1 fights like a level ${H.TWR.levelOn(1)} monster; the top floor fights like a level <b>${T.topLevel}</b> one.</p>
      <p><b>Every fight is about the same length &mdash; ${mins} minutes &mdash; whoever you are.</b> The floor is built around the damage you actually do, so a better set does not make the climb shorter, it makes it survivable. What the Tower sells is a long, quiet fight you can half-watch; what it asks for is <b>food</b>.</p>
      <h3>Bring more fish than you think</h3>
      <p>At ${mins} minutes a floor you are being hit for the whole of it. Fill the bag. A floor you cannot finish is a floor you walk out of, and walking out is free &mdash; the climb is not.</p>
      <h3>Checkpoints every ${T.checkEvery}</h3>
      <p><b>You do not start again at the bottom.</b> The climb remembers the last checkpoint you passed, and they sit every ${T.checkEvery} floors, so the most a bad floor costs you is ${T.checkEvery - 1} of them. When you come back you may start from that checkpoint &mdash; or from <b>floor 1</b>, if you would rather have the run.</p>
      <h3>Bosses</h3>
      <p>Every ${T.bossEvery}th floor is somebody in particular, and the ${T.floors}th is <b>The House</b>. A boss carries <b>${T.bossHp}&times;</b> the health of an ordinary floor and gets meaner below half, so treat ${bosses.slice(0, 3).join(", ")} &hellip; ${bosses.at(-1)} as the floors to arrive at full.</p>
      <p><b>It pays in tickets and it pays well</b>, but it is a wage, not a jackpot: the deeper floors pay more because they take as long and hurt more, not because anything up there drops. Bring food, not bag space.</p>`;
    } },
  /* (2026-09-25) THE CARNIVAL, 62-72, likewise unwritten. The three stalls' numbers live in the WORKER, which
     this file cannot import, so they are typed - and tools/eastscape-wiki-check.mjs reads carnival.js and fails
     if they drift, which is the same guarantee by a different route. */
  { id: "carnival", title: "The Carnival", icon: "\u{1F3AA}", cat: "Going further",
    body: (G, H) => {
      const band = [...new Set((G.SCENES.carnival?.mobs || []).map(([t]) => G.MOBS[t]?.lvl))].filter(Boolean).sort((a, b) => a - b);
      const gr = G.MOBS.grinner, tix = G.BOUNTY?.grinner;
      return `<p><b>Combat ${band[0]} to ${band.at(-1)}, west out of the Yard.</b> The Boardwalk is west of it again. Four freaks on the midway, a duck pond, and a cage in the north-west with something in it.</p>
      <h3>The three stalls</h3>
      <p>Balloon Pop, the Shooting Gallery and Whack-a-Mole. <b>100 tickets a go</b>, a perfect round pays about <b>five times that</b>, and there is a short wait between rounds. They pay on how many you hit and they get faster as you go, so the last few shots are the ones worth having.</p>
      <p>They are a <b>game, not a wage</b>: a good round beats the fee, and no amount of practice beats fighting the midway for the same minutes. Play them because they are there.</p>
      <h3>The duck pond</h3>
      <p>The only water on the map, and the only place to catch ${H.ico("goldfish")} <b>goldfish</b> and ${H.ico("koi")} <b>koi</b>. Both ${H.wl("guides/smoking", "smoke")}, and the koi's smoke is the best <b>bite rate</b> buff in the game &mdash; a fishing buff you have to fish for.</p>
      <h3>The cage</h3>
      <p><b>The Grinning Man</b> is behind a turnstile, and the turnstile takes a ${H.ico("carnivalticket")} <b>Carnival ticket</b>. They drop from the four outside at about <b>one kill in a hundred</b>, so the real price of the door is roughly half an hour of farming the midway.</p>
      <p>Which is why he pays what he pays: <b>${tix ? tix.toLocaleString() : "thousands"} tickets</b>, against a few hundred for anything else on the map. He is slow, he hits like the band above him, and he is only back every <b>five minutes</b> &mdash; so a party splits one of him rather than farming him.</p>
      <p><b>The ticket is a cover charge, paid once.</b> Going out costs nothing, and going back in costs another ticket.</p>`;
    } },
  /* (2026-09-30) Rewritten. It put the stairs in the Boneyard (they have been in the Yard since v108) and called the Crypt "the only
     thing you cannot do alone" after the Great Pyramid opened. The numbers are the crypt rules' own: the page reads H.CRR when it hands
     one over, and otherwise CRYPT_T, which the wiki test holds to eastscape-crypt-rules.js. */
  { id: "crypt", title: "The Crypt (parties)", icon: "\u{1F5DD}\uFE0F", cat: "Going further",
    body: (G, H) => {
      const C = H.CRR?.CRYPT || CRYPT_T, T = C.tiers.slice(1), hp = (n) => Math.round((0.6 + 0.1 * n * n) * 100) / 100;
      return `<p><b>One of two things in the game you cannot do alone</b>; the other is ${H.wl("guides/pyramid", "the Great Pyramid")}. The stairs down are in the Yard's north court, just below the furnace. ${Word(C.party[0])} to ${word(C.party[1])} of you go in, the door shuts, and what is inside is yours &mdash; nobody else can wander through it.</p>
      <h3>Getting a party</h3>
      <p><b>Click someone and invite them.</b> They get a line with an Accept on it, good for a minute. While anyone in the party is inside, everybody sees everybody's health and where they are.</p>
      <p><b>Leaving the game does not leave the party.</b> Your place is held for three minutes, so a dropped connection is not a lost run &mdash; log back in and you are still in it, on the floor you were on.</p>
      <h3>Three depths, one map</h3>
      <table class="tbl"><tr><th>Crypt</th><th>Door opens at</th><th>The fight wants</th><th>Ante each</th><th>A clear pays each</th></tr>${T.map((t) => `<tr><td>${H.esc(t.name)}</td><td>Combat ${t.lvl}</td><td>about Combat ${t.rec}</td><td>${num(t.ante)}</td><td>${num(t.pay)}</td></tr>`).join("")}</table>
      <p><b>The door and the fight are different numbers.</b> At the door's level, in the best gear that level can wear, you land about one swing in ten on the boss; the next column is where you land about half.</p>
      <h3>The run</h3>
      <p><b>Four chambers in a row</b>: the Ossuary (skeleton guards), the Haunted Hall (ghosts and bone golems), the Antechamber (a chest to restock from, and a lever), and the Hoodie's Sanctum. A gate opens when its chamber is clear; the last one opens at the lever, and only once everybody still alive is in the Antechamber, so nobody is left behind.</p>
      <p><b>The Hoodie</b> telegraphs a slam about every twenty seconds: step out of reach when the warning shows, or it takes a big bite of your health. At half health he calls in help, and after five minutes he hits twice as hard. <b>He scales to the party</b>: with ${C.party[0]} of you he has his plain health, with 3 about ${hp(3)}&times;, with 4 about ${hp(4)}&times;, so four people do not make it four times easier &mdash; they make the deeper crypts survivable at all.</p>
      <p><b>Monsters do not come back inside a run</b>, and the party shares them. <b>Nothing drops on the floor in there</b>, and if everybody is dead at once it is a wipe.</p>
      <h3>The Hoodie's hoard</h3>
      <p>When he dies a chest appears in front of the throne, and <b>everybody who earned the clear opens it for their own roll</b>: the clear's tickets, then two to six more things &mdash; drinks, dinners, clovers, scrolls, casino chips, a horseshoe, now and then a piece of buff gear or a Thieves' permit. The deeper the crypt, the better the odds on the good rolls.</p>
      <p><b>${Word(C.runsPaid)} paid clears a Chicago day</b> each. After that a clear pays ${Math.round(C.lateShare * 100)}% and three rolls with no gear. Anybody who did under ${Math.round(C.fullShare * 100)}% of the boss's damage gets half pay and fewer rolls: nobody is carried for nothing.</p>
      <p><b>Fastest clears are recorded.</b> That is the other reason to go back.</p>`;
    } },
  { id: "fighting", title: "Fighting", icon: "⚔️", cat: "Skills",
    body: (G, H) => `<p><b>Click a monster.</b> You walk to it and keep swinging until one of you stops. Whoever hits it first owns it &mdash; nobody else can take your kill, except in the Wilderness where nothing is owned.</p>
      <h3>One skill, not four</h3>
      <p><b>Combat is a single skill and there are no stances to pick.</b> Every point of damage you deal trains it, and it does all three jobs at once: you land more of your swings, you hit harder, and you get hit less. Better weapons and armour ask for it.</p>
      <p><b>Hitpoints trains alongside it, always.</b> Damage pays Melee xp (Archery with a bow, Magic with a wand) and a third as much again into Hitpoints, so your health climbs whatever you are fighting. <b>At range it climbs slower:</b> with a bow or a wand, Hitpoints gets a third of what it gets with a melee weapon, because you are not the one standing in the way of the hits.</p>
      <h3>Three weapons, one speed each</h3>
      <p>Every tier has the same three, and they are within a whisker of each other on damage over time. It is a feel choice, not a power one.</p>
      <table class="tbl"><tr><th>Weapon</th><th>Swings every</th><th>Leans</th></tr>
        <tr><td>Gladius</td><td>1.8s</td><td>fast and accurate, small hits</td></tr>
        <tr><td>Longsword</td><td>2.4s</td><td>the middle of the three</td></tr>
        <tr><td>Maul</td><td>3.0s</td><td>slow and heavy, big hits</td></tr>
      </table>
      <h3>The ${word(G.TOOL_RUNGS.length)} grades</h3>
      <p>Weapons and armour gate on <b>Combat</b>, rings and amulets on <b>Hitpoints</b>. <a data-wiki="npcs/Bom Trady">Bom's Prize Counter</a> sells every grade, bronze to the top, but it is dear: everything is far cheaper <a data-wiki="guides/smithing">smithed</a>, and plenty of it drops.</p>
      ${(() => {
        const set = ["helm", "body", "legs", "shield", "boots", "gloves"], wpn = (g) => Object.keys(G.ITEMS).filter((k) => k.startsWith(`${g}_`) && G.ITEMS[k].slot === "weapon" && G.ITEMS[k].speed && !G.ITEMS[k].tspd && !G.ITEMS[k].launcher).sort((a, b) => G.ITEMS[a].speed - G.ITEMS[b].speed);
        return `<table class="tbl"><tr><th>Grade</th><th>Needs</th><th>Full set defence</th><th>Weapons: quick, balanced, heavy (accuracy / strength)</th></tr>${G.TOOL_RUNGS.filter((r) => G.ITEMS[`${r.key}_body`]).map((r) => `<tr><td>${H.ico(`${r.key}_body`)} ${H.esc(r.name)}</td><td>${G.ITEMS[`${r.key}_body`].req?.lvl}</td><td>${set.reduce((a, s) => a + (G.ITEMS[`${r.key}_${s}`]?.def || 0), 0)}</td><td>${wpn(r.key).map((k) => `${H.wl(`items/${k}`, H.esc(G.ITEMS[k].name))} (+${G.ITEMS[k].acc} / +${G.ITEMS[k].str})`).join(", ")}</td></tr>`).join("")}</table>
        <p>Full set defence is helm, body, legs, shield, gloves and boots together.</p>`;
      })()}
      <p><b>The top two name their weapons differently.</b> Nova and Singularity do not carry a gladius, a longsword and a maul: the three roles are unchanged &mdash; quick, balanced, slow and heavy &mdash; only the names.</p>
      ${(() => {
        const open = (t) => !G.MOBS[t]?.held && Object.entries(G.SCENES).some(([k, d]) => G.OPEN.has(k) && (d.mobs || []).some(([x]) => x === t));
        const by = (core) => Object.entries(G.MOBS).filter(([t, m]) => open(t) && (m.drops || []).some(([k]) => k === core)).map(([t, m]) => [t, m.drops.find(([k]) => k === core)[2]]);
        const nova = by("nova_core"), sing = by("singularity_core"), usual = nova[0]?.[1] || 0.0005, better = sing.filter(([, p]) => p > usual);
        const craft = (core) => Object.values(G.RECIPES).find((r) => r.out[0] === core);
        return `<p><b>And their weapons are a chase.</b> Every Nova or Singularity weapon wants a <b>core</b> as well as bars. Both cores drop from ${nova.map(([t]) => mobL(G, H, t)).join(", ")}, and from the Black Crypt's Hoodie and the Great Pyramid's Squeeze, at about one kill in ${num(Math.round(1 / usual))}${better.length ? `; the singularity core comes far oftener off ${better.map(([t, p]) => `${mobL(G, H, t)} (${oneIn(p)})`).join(" and ")}` : ""}. Or build one at an anvil: ${["nova_core", "singularity_core"].map((c) => craft(c)).filter(Boolean).map((r) => `${itemL(G, H, r.out[0])} at Smithing ${r.lvl} from ${r.in.map(([k, n]) => `${n} ${H.esc((G.ITEMS[k]?.name || k).toLowerCase())}`).join(", ")}`).join("; ")}. The armour and the tools need no core.</p>`;
      })()}
      <p><b>Reforging is the other way up.</b> Bars spent at the anvil push a piece you already own three levels further, which is worth about a tier &mdash; a way to keep going when the next grade is out of reach, not a way past it. It can also destroy the piece. See the anvil.</p>
      <h3>Clicking again makes you swing faster</h3>
      <p><b>Click the monster you are already fighting and your next swing comes sooner.</b> Keep doing it and it comes sooner still, in four steps:</p>
      ${(() => {
        const s = G.SWING_STACK, gl = G.ITEMS.bronze_gladius?.speed || 1800, ml = G.ITEMS.bronze_maul?.speed || 3000;
        const row = (n, cut) => `<tr><td>${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"} swing in a row</td><td>${Math.round(cut * 100)}% sooner</td><td>${(gl * (1 - cut) / 1000).toFixed(2)}s</td><td>${(ml * (1 - cut) / 1000).toFixed(2)}s</td></tr>`;
        return `<table class="tbl"><tr><th>Clicked before the swing?</th><th>Off the wait</th><th>Gladius</th><th>Maul</th></tr>
          <tr><td>No &mdash; left alone</td><td>&mdash;</td><td>${(gl / 1000).toFixed(2)}s</td><td>${(ml / 1000).toFixed(2)}s</td></tr>
          ${s.map((cut, n) => row(n + 1, cut)).join("")}
          ${s.length ? `<tr><td>and onwards</td><td>${Math.round(s[s.length - 1] * 100)}% &mdash; the ceiling</td><td>${(gl * (1 - s[s.length - 1]) / 1000).toFixed(2)}s</td><td>${(ml * (1 - s[s.length - 1]) / 1000).toFixed(2)}s</td></tr>` : ""}
        </table>`;
      })()}
      <h4>How it actually works, so you are not guessing</h4>
      <p><b>It counts SWINGS, not clicks.</b> The game asks one question each time your weapon comes round: did you click since the last swing? Yes and you move one rung up the ladder; no and you drop straight back to the bottom. <b>Clicking five times between two swings is worth exactly the same as clicking once</b> &mdash; there is nothing to be gained from hammering it, and that is deliberate.</p>
      <p><b>So the whole technique is one click per swing.</b> Watch your character, click the monster again each time it lands a blow, and by the fourth you are at the ceiling and staying there.</p>
      <p><b>Miss one and you start again at the bottom.</b> Not one rung down &mdash; all the way. A stretch of clicking is worth far more than the same number of clicks scattered about, which is why this rewards paying attention rather than clicking a lot.</p>
      <p><b>Starting a NEW fight resets you.</b> Walking to the next monster costs you the ladder, so a big slow thing you stand and work is where this pays best; the ladder is also why finishing something already hurt beats wandering off to a fresh one.</p>
      <p><b>It stacks with everything else</b> &mdash; a faster weapon, a tool or pet speed bonus, a whiskey &mdash; because it takes a percentage off whatever your wait already is. The quick weapons gain the least in absolute seconds and the heavy ones the most.</p>
      <p><b>You never have to use it.</b> Leave it alone and your swing is the plain number in the table above; the game is balanced around that, and this is for when you want to lean in. It works on other players in the Wilderness too, and so does theirs.</p>
      <h3>The jackpot kill</h3>
      <p>A kill pays tickets, and about <b>one in every two hundred and fifty</b> pays <b>twelve times</b> what it should. It is not tied to what you killed, where you are or how long you have played &mdash; it is a lump of luck on an ordinary monster.</p>
      <h3>What a kill pays</h3>
      <p><b>Tickets come off a monster as a RANGE, not a fixed number.</b> Every kill is worth a certain amount and what actually drops is a slice of it, so two of the same monster rarely pay the same.</p>
      ${(() => {
        const wide = Object.keys(G.MOBS).filter((k) => G.BOUNTY[k] && G.tixSpread(k)[1] > G.tixSpread("__none__")[1]);
        const def = G.tixSpread("__none__");
        if (!wide.length) return `<p>Every monster uses the same band: <b>${def[0]}x to ${def[1]}x</b> of what it is worth.</p>`;
        const s = G.tixSpread(wide[0]);
        const eg = wide.map((k) => ({ k, b: G.BOUNTY[k] })).sort((x, y) => y.b - x.b)[0];
        return `<p><b>Most monsters swing ${def[0]}x to ${def[1]}x</b> &mdash; a fairly tight wobble around what they are worth.</p>
        <p><b>The Thunderhead's swing ${s[0]}x to ${s[1]}x instead</b>: ${wide.map((k) => H.esc(G.MOBS[k].name)).sort().join(", ")}. The average is exactly the same; any single kill can pay a fifth or nearly double. ${H.esc(G.MOBS[eg.k].name)} is worth ${eg.b}, so out there it pays <b>${Math.round(eg.b * s[0])}</b> to <b>${Math.round(eg.b * s[1])}</b> where anywhere else it would be ${Math.round(eg.b * def[0])} to ${Math.round(eg.b * def[1])}.</p>
        <p><b>Why.</b> The Thunderhead was the richest ground in the game by a distance and its drops were cut. A flat cut only makes a place worse; widening the band gives back the <i>excitement</i> without giving back the <i>average</i>. The same money over a night, a great deal more swing in it.</p>`;
      })()}
      <p><b>Ticket buffs multiply the drop</b>, so a Coin Toad or a tincture is worth the same percentage wherever you fight. And about <b>one kill in ${G.JACKPOT_KILL.odds}</b> pays <b>${G.JACKPOT_KILL.mult} times</b> what it should, which is not tied to what you killed or where you are.</p>
      <p><b>During a <a data-wiki="items/pot_double">2X event</a> every ticket doubles</b>, dropped or paid, for everyone on the server.</p>
      <p><b>Eat before you need to.</b> Cooked fish is the bulk of the healing in the game &mdash; and a salve out of the <a data-wiki="guides/alchemy">cauldron</a> heals more than any of it. See <a data-wiki="guides/cooking">Cooking</a>.</p>` },
  /* (2026-09-25) GENERATED. Five waters were missing from it - the oasis, the Deep Wild's pool, the Moonlit
     Eddy, the Vault's flooded floor and the Carnival's duck pond - and it still said seven fish smoke. A spot
     is two fish, a level for each and a rod, all of which are written on the spot itself, so there is no reason
     for any of it to be typed here. The "Rod" column is derived and the guide used to have it wrong in places:
     it is toolNeed of the spot's own level, not the spot's grade. */
  { id: "fishing", title: "Fishing", icon: "\u{1F3A3}", cat: "Skills",
    body: (G, H) => {
      const spots = new Map();
      for (const [key, d] of Object.entries(G.SCENES)) {
        if (d.wikiHide) continue;
        let b; try { b = G.buildScene(key); } catch { continue; }
        for (const o of b.objs) {
          if (o.t !== "spot") continue;
          const lvl = o.req?.lvl || 1, sig = `${d.name}|${o.name}|${o.fish || "sardine"}`;
          if (!spots.has(sig)) spots.set(sig, { where: d.name, name: o.name, lvl, xp: o.xp,
            fish: o.fish || "sardine", fish2: o.fish2 || (o.fish ? null : "perch"), f2lvl: o.fish2lvl ?? (o.fish ? null : 5), xp2: o.xp2 });
        }
      }
      const rows = [...spots.values()].sort((a, b) => a.lvl - b.lvl);
      const smokes = Object.keys(G.ITEMS).filter((k) => k.startsWith("s") && G.ITEMS[k].meal && G.ITEMS[k.slice(1)]).length;
      const fish = (k, lvl, xp) => k ? `${H.ico(k)} ${H.wl(`items/${k}`, H.esc(G.ITEMS[k]?.name || k))} &mdash; ${lvl}${xp ? `, ${xp} xp` : ""}` : "&mdash;";
      return `<p>Click a fishing spot with a <b>rod in your hand</b> &mdash; in the weapon slot, not the bag. You keep pulling fish out until you walk away or the three-minute idle cutoff stops you, which makes it the most comfortable thing in the game to do while you are half watching something else.</p>
      <p><b>Most spots hold two fish.</b> The second is better, needs a higher level, and turns up about a third of the time once you can catch it. Until then you get the first one only. A few waters hold one fish and nothing else.</p>
      <p><b>The water gates your rod as well as your level</b>, the same way a rock gates a pickaxe.</p>
      <table class="tbl"><tr><th>Water</th><th>Where</th><th>Rod</th><th>First fish</th><th>Second fish</th></tr>
        ${rows.map((r) => `<tr><td>${H.esc(r.name)}</td><td>${H.esc(r.where)}</td><td>${H.esc(G.toolNeed(r.lvl).name)}</td><td>${fish(r.fish, r.lvl, r.xp)}</td><td>${fish(r.fish2, r.f2lvl, r.xp2)}</td></tr>`).join("")}
      </table>
      <p><b>A better rod is faster, not luckier.</b> Each grade up takes 8% off the time between casts. See <a data-wiki="guides/tools">Tools</a>.</p>
      <p><b>A bite is not guaranteed.</b> It starts at about ${Math.round(G.FISHING.chance(1) * 100)}% a cast and climbs with your level to ${Math.round(G.FISHING.chance(99) * 100)}%, so a rod is never quite a conveyor belt.</p>
      <p><b>Raw fish is not food and Bom will not buy it.</b> That is the point rather than an inconvenience: cooking roughly doubles what a fish is worth and is the only thing that makes it heal. See <a data-wiki="guides/cooking">Cooking</a>, and <a data-wiki="guides/smoking">Smoked fish</a> for the ${["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"][smokes] || smokes} that smoke into a 20-minute buff.</p>
      <p><b>Fishing is also the best place to find a real ZCoin</b> &mdash; about one catch in ${num(Math.round(1 / Math.min(...Object.values(G.ZDROP.fish))))} for the plainest fish, creeping up to one in ${num(Math.round(1 / Math.max(...Object.values(G.ZDROP.fish))))} for the best. See <a data-wiki="guides/zcoins">Finding ZCoins</a>.</p>`;
    } },
  /* (2026-09-25) GENERATED, and it was the worst of them: nine dishes missing, six heal values wrong (sky eel
     said 24 against a real 28, mud cat 26 against 30) and every sell price exactly DOUBLE what Bom pays - the
     same stale doubling the woodcutting table had, from whenever prices were halved. A table of twenty-three
     rows and five columns cannot be kept by hand against a game that gets a new fish most weeks. */
  { id: "cooking", title: "Cooking", icon: "\u{1F373}", cat: "Skills",
    body: (G, H) => {
      const rows = Object.entries(G.RECIPES).filter(([id]) => id.startsWith("cook_"))
        .map(([, r]) => ({ to: r.out[0], lvl: r.lvl, stop: r.burnStop, heal: G.ITEMS[r.out[0]]?.heal, sell: G.SHOP.buys[r.out[0]], smoked: !!G.ITEMS[`s${r.in[0][0]}`] }))
        .sort((a, b) => a.lvl - b.lvl || (a.heal || 0) - (b.heal || 0));
      const smokes = rows.filter((r) => r.smoked).length;
      const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
      return `<p>There is a <b>campfire</b> just inside the Yard, by the way in from the casino, and a <b>range</b> in some interiors. Click it with raw food in your bag.</p>
      <p><b>Cooking roughly doubles a fish.</b> Raw fish cannot be eaten and Bom will not buy it, so every fish is worth a stop at the fire on the way home. The fire always cooks the best thing in your bag that you are able to cook, so there is nothing to choose.</p>
      <p><b>You will burn some at first, and then you will stop.</b> Each dish has a level at which it never burns again &mdash; that is the second column, and it is the one worth levelling towards.</p>
      <table class="tbl"><tr><th>Dish</th><th>Cook at</th><th>Stops burning</th><th>Heals</th><th>Bom pays</th></tr>
        ${rows.map((r) => `<tr><td>${H.ico(r.to)} ${H.wl(`items/${r.to}`, H.esc(G.ITEMS[r.to]?.name || r.to))}${r.smoked ? " <small>(smokes)</small>" : ""}</td><td>${r.lvl}</td><td>${r.stop ?? "&mdash;"}</td><td>${r.heal ?? "&mdash;"}</td><td>${r.sell ?? "&mdash;"}</td></tr>`).join("")}
      </table>
      <p><b>${H.esc(String(WORD[smokes] || smokes).replace(/^./, (c) => c.toUpperCase()))} of these can be smoked instead</b>, which heals more, sells for far more and gives a 20-minute buff. It needs charcoal, and the fire does it automatically when you are carrying some. See <a data-wiki="guides/smoking">Smoked fish</a>.</p>
      <p><b>Meat sits under fish on purpose.</b> A chicken is not a worse sardine; it is something you can cook at level 1 without a rod.</p>`;
    } },
  /* (2026-09-30) GENERATED. Its burn table was missing palm, pine and bogwood logs and had skyash at half its charcoal; the bar, piece,
     reforge and aid numbers are read from RECIPES and FORGE now as well, so none of it is typed twice. */
  { id: "smithing", title: "Smithing", icon: "\u{1F528}", cat: "Skills",
    body: (G, H) => {
      const R = Object.values(G.RECIPES), F = G.FORGE, pc = (x) => `${Math.round(x * 100)}%`, nm = (k) => H.esc(G.ITEMS[k]?.name || k);
      const ing = (r) => r.in.map(([k, n]) => `${n} ${nm(k).toLowerCase()}`).join(" + ");
      const burns = R.filter((r) => r.station === "furnace" && r.out[0] === "charcoal" && r.in.length === 1 && !G.ITEMS[r.in[0][0]]?.held);
      const byN = {}; for (const r of burns) (byN[r.out[1]] ||= { xp: r.xp, logs: [] }).logs.push(r.in[0][0]);
      const logXp = burns.find((r) => r.in[0][0] === "logs")?.xp || 5, ten = G.XP_AT[10];
      const bars = R.filter((r) => r.station === "furnace" && /_bar$/.test(r.out[0]) && !G.ITEMS[r.out[0]]?.held).sort((a, b) => a.lvl - b.lvl);
      const pieces = ["body", "legs", "shield", "maul", "amulet", "helm", "sword", "ring", "boots", "gloves", "gladius"].map((s) => R.find((r) => r.out[0] === `bronze_${s}`)).filter(Boolean);
      const byBars = {}; for (const r of pieces) (byBars[r.in[0][1]] ||= { xp: r.xp, names: [] }).names.push(nm(r.out[0]).replace(/^Bronze /, "").toLowerCase());
      const gradeLvl = G.TOOL_RUNGS.map((g) => [g.name, R.find((r) => r.out[0] === `${g.key}_body`)?.lvl]).filter(([, l]) => l);
      const setKeys = ["helm", "body", "legs", "shield", "boots", "gloves", "sword", "ring", "amulet"].map((s) => `eclipse_${s}`);
      const shelf = setKeys.reduce((a, k) => a + ((G.prizesOf().find((p) => p.give?.[0] === k) || {}).price || 0), 0);
      const barsFor = setKeys.reduce((a, k) => a + ((R.find((r) => r.out[0] === k)?.in.find(([x]) => x === "eclipse_bar") || [, 0])[1]), 0);
      const aid = (k) => R.find((r) => r.out[0] === k);
      return `<p><b>The most common question about this skill is how to start it at all</b>, because at Smithing 1 you cannot make a single bar or a single piece of gear. Everything asks for level 10.</p>
      <p><b>You start by burning logs.</b> That is the whole answer. Take logs to the <b>furnace</b> in the Yard's north court and it turns them into <b>charcoal</b> &mdash; a Smithing level 1 job, and the only one there is. Charcoal is then the fuel every smelt needs, so the logs you burn getting to level 10 are not wasted: you need them anyway.</p>
      <table class="tbl"><tr><th>Burn</th><th>Gives</th><th>xp each</th></tr>${Object.entries(byN).sort((a, b) => a[0] - b[0]).map(([n, v]) => `<tr><td>${v.logs.map((k) => `${H.ico(k)} ${nm(k)}`).join(", ")}</td><td>${n} charcoal</td><td>${v.xp}</td></tr>`).join("")}</table>
      <p><b>Level 10 is ${num(ten)} xp</b>, so it is about ${num(Math.round(ten / logXp / 10) * 10)} ordinary logs &mdash; or far fewer if you are already cutting something better. Burning has a small chance to fail and eat the log; that is normal and it does not stop.</p>
      <h3>Then the chain</h3>
      <p><b>Ore + charcoal &rarr; bar, at the furnace. Bars &rarr; gear, at the anvil.</b> Both are in the Yard's north court, just above the Crypt stairs.</p>
      <table class="tbl"><tr><th>Bar</th><th>Smithing</th><th>Takes</th><th>xp</th></tr>${bars.map((r) => `<tr><td>${H.ico(r.out[0])} ${H.wl(`items/${r.out[0]}`, nm(r.out[0]))}</td><td>${r.lvl}</td><td>${ing(r)}</td><td>${r.xp}</td></tr>`).join("")}</table>
      <p><b>The top of the ladder wants more than ore.</b> Onyx needs grimstone, eclipse needs voidglass, and starfall, nova and singularity each want a finished bar of the tier below &mdash; so a Singularity bar is a Nova bar is an Eclipse bar, all the way down &mdash; so the last stretch is a chain, not a grind, and the charcoal bill climbs with it.</p>
      <p><b>You do not choose what to make.</b> The furnace and the anvil always make the best thing you can, out of what is in your bag, which is why a furnace with logs AND ore in front of it burns, smelts, burns and smelts by itself.</p>
      <h3>What a piece costs</h3>
      <table class="tbl"><tr><th>Piece</th><th>Bars</th><th>xp at bronze</th></tr>${Object.entries(byBars).sort((a, b) => b[0] - a[0]).map(([n, v]) => `<tr><td>${v.names.join(", ").replace(/^./, (c) => c.toUpperCase())}</td><td>${n}</td><td>${v.xp}</td></tr>`).join("")}</table>
      <p>Each grade wants the Smithing of its <a data-wiki="guides/fighting">gear tier</a>: ${gradeLvl.map(([n, l]) => `${n.toLowerCase()} ${l}`).join(", ")}.</p>
      <h3>Why bother, when Bom sells gear</h3>
      <p><b>Because he is not cheap.</b> A full eclipse set over his counter (helm, body, legs, shield, boots, gloves, longsword, ring and amulet) is ${num(shelf)} tickets; smithing it takes ${barsFor} eclipse bars. Once you have a furnace and an anvil there is no sensible reason to buy gear again.</p>
      <p><b>Smith to wear it, not to sell it.</b> Bom buys smithed gear back for an eighth of his shelf price and never more than <b>${num(G.GEAR_SELL_MAX)}</b> a piece, reforged or not, so the big pieces from onyx up all hit that ceiling, and from nova up the bars are worth more sold on their own than the finished piece.</p>
      <h3>Reforging</h3>
      <p><b>Bars also push gear you already own further.</b> At the anvil, ${word(F.max)} levels, each worth ${Math.round(F.step * 1000) / 10}% of that piece's own stats or +1, whichever is more &mdash; about a tier in total. A reforge costs the same bars the piece cost to make.</p>
      <p><b>It can destroy the piece.</b> +1 always works. +2 is ${pc(F.odds[1])}, and a miss there breaks the piece ${pc(F.brk[1])} of the time; +3 is ${pc(F.odds[2])}, and a miss breaks it ${pc(F.brk[2])} of the time. The bars go whether it works or not.</p>
      <p>Tools reforge too, and they buy <b>speed</b> rather than combat &mdash; +${Math.round(F.tspd * 1000) / 10}% a level at mining, chopping or fishing.</p>
      <h3>Temper, Flux and the Master's seal</h3>
      <p><b>Carrying one does nothing on its own.</b> At the anvil, open the <b>Reforge</b> tab. Every aid you are carrying shows as a button above the list of your gear. <b>Click the button so it lights up</b>, then reforge. A lit aid is used up on that one attempt, whether it works or not, so light it again before the next swing. You can light more than one at once.</p>
      <table class="tbl"><tr><th>Aid</th><th>What it does</th><th>Make it at the anvil</th></tr>
        <tr><td>${H.wl("items/temper", nm("temper"))}</td><td><b>+${pc(F.temper)} to that attempt's chance.</b> +2 goes from ${pc(F.odds[1])} to ${pc(Math.min(0.99, F.odds[1] + F.temper))}, +3 from ${pc(F.odds[2])} to ${pc(F.odds[2] + F.temper)}, +4 from ${pc(F.odds[3])} to ${pc(F.odds[3] + F.temper)}. It does <b>not</b> stop a failure breaking the piece.</td><td>Smithing ${aid("temper")?.lvl}: ${aid("temper") ? ing(aid("temper")) : "&mdash;"}</td></tr>
        <tr><td>${H.wl("items/flux", nm("flux"))}</td><td><b>A failure cannot destroy the piece:</b> it drops one level instead. It does not raise the chance.</td><td>Smithing ${aid("flux")?.lvl}: ${aid("flux") ? ing(aid("flux")) : "&mdash;"}</td></tr>
        <tr><td>${H.wl("items/masters_seal", nm("masters_seal"))}</td><td>Takes a piece <b>one step past +${F.max}, to +${F.cap}</b> (${pc(F.odds[3])} to succeed).</td><td>Smithing ${aid("masters_seal")?.lvl}: ${aid("masters_seal") ? ing(aid("masters_seal")) : "&mdash;"}</td></tr>
      </table>
      <p><b>Temper and Flux together</b> on a +3 attempt is ${pc(F.odds[2] + F.temper)} to succeed and no chance of losing the piece. Whetgrit, quench salts and seal wax come from pickpocketing in the ${H.wl("guides/thieving", "Thieves' Guild")}.</p>`;
    } },

  /* (2026-09-25) GENERATED. Its table had four facts wrong at once and two rows that were not there at all:
     grimstone was listed as Mining 1 with a bronze pickaxe in the Wilderness (it is 20, emerald, the Deep Wild),
     nova and singularity ore each named their OWN pickaxe in the tool column while the note beside them said the
     opposite and the note was the right one, emerald's price had moved, and stardust and marble were missing.
     None of that is anybody being careless — it is eighteen rows of five columns, hand-kept, against a world
     that is edited every day. So now the rows come from the rocks themselves. */
  { id: "mining", title: "Mining", icon: "⛏️", cat: "Skills",
    body: (G, H) => {
      const at = {};
      for (const [key, d] of Object.entries(G.SCENES)) {
        if (d.wikiHide) continue;
        let b; try { b = G.buildScene(key); } catch { continue; }
        for (const o of b.objs) {
          if (o.req?.skill !== "mining" || !o.ore) continue;
          const r = (at[o.ore] ||= { lvl: o.req.lvl, where: new Set(), vein: false });
          r.lvl = Math.min(r.lvl, o.req.lvl); r.where.add(d.name); r.vein ||= o.t === "vein";
        }
      }
      const useOf = (ore) => {
        const rs = Object.values(G.RECIPES).filter((x) => x.in.some(([k]) => k === ore));
        if (!rs.length) return "&mdash;";
        const main = rs.find((x) => x.in[0][0] === ore);
        if (main && G.ITEMS[main.out[0]]) return H.wl(`items/${main.out[0]}`, H.esc(G.ITEMS[main.out[0]].name)) + (rs.length > 1 ? " and up" : "");
        const other = G.ITEMS[rs[0].out[0]];
        return other ? `needed for ${H.wl(`items/${rs[0].out[0]}`, H.esc(other.name.toLowerCase()) + "s")}` : "&mdash;";
      };
      const rows = Object.entries(at).map(([ore, r]) => ({ ore, ...r, tool: G.toolNeed(r.lvl), pays: G.SHOP.buys[ore], into: useOf(ore) })).sort((a, b) => a.lvl - b.lvl);
      return `<p>Click a rock with a <b>pickaxe in your hand</b> &mdash; in the weapon slot, not the bag. Every rock holds 2 to 12 ore and you keep working it until it is empty, so one rock is several swings rather than one.</p>
      <p><b>Two things gate a rock: your level AND your pickaxe</b>, and they are not the same number. Emerald ore needs Mining 20 and an emerald pickaxe &mdash; having the level with a bronze pickaxe gets you nothing, which is the single most common reason a rock will not budge. <b>The pickaxe a rock wants is not always its own grade</b>: the top rungs gate above their ore on purpose, so nova ore is worked with an eclipse pickaxe. See <a data-wiki="guides/tools">Tools</a>.</p>
      <table class="tbl"><tr><th>Ore</th><th>Mining</th><th>Pickaxe</th><th>Where</th><th>Bom pays</th><th>What it makes</th></tr>
        ${rows.map((r) => `<tr><td>${H.ico(r.ore)} ${H.wl(`items/${r.ore}`, H.esc(G.ITEMS[r.ore]?.name || r.ore))}${r.vein ? " <small>(vein)</small>" : ""}</td><td>${r.lvl}</td><td>${H.esc(r.tool.name)}</td><td>${[...r.where].join(", ")}</td><td>${r.pays ?? "&mdash;"}</td><td>${r.into}</td></tr>`).join("")}
      </table>
      <p><b>Copper and tin are a pair.</b> A bronze bar wants one of each, so mine them together or you will be back.</p>
      <p><b>A vein never runs dry.</b> It is slower per ore than a rock &mdash; about six seconds a swing against under two &mdash; but it does not empty and it does not stop you, so it is what you stand at while you are half watching something else. The three-minute idle cutoff still applies.</p>
      <p><b>Some of these are not ore, they are ingredients.</b> The top bars will not go without them, which is what makes the last stretch of <a data-wiki="guides/smithing">Smithing</a> a chain rather than a grind.</p>
      <p><b>Selling raw ore is the worst thing you can do with it.</b> A bar is worth more than its ore, and gear is worth vastly more than bars.</p>`;
    } },

  /* (2026-09-25) GENERATED, and it needed it as badly as mining did. Every price in it was double what Bom
     actually pays - so badly that the prose UNDER the table quoted the right number for yew and contradicted
     the row above it - vaultwood was listed fifteen levels and a whole axe rung low, palm logs were not there
     at all, and four trees had grown a second home nobody had added. */
  { id: "woodcutting", title: "Woodcutting", icon: "\u{1FA93}", cat: "Skills",
    body: (G, H) => {
      const at = {};
      for (const [key, d] of Object.entries(G.SCENES)) {
        if (d.wikiHide) continue;
        let b; try { b = G.buildScene(key); } catch { continue; }
        for (const o of b.objs) {
          if (o.req?.skill !== "woodcutting") continue;
          const y = o.log || "logs", r = (at[y] ||= { lvl: o.req.lvl, where: new Set() });
          r.lvl = Math.min(r.lvl, o.req.lvl); r.where.add(d.name);
        }
      }
      const burnOf = (log) => { const r = Object.values(G.RECIPES).find((x) => x.in.length === 1 && x.in[0][0] === log && x.out[0] === "charcoal"); return r ? r.out[1] : 0; };
      const rows = Object.entries(at).map(([log, r]) => ({ log, ...r, tool: G.toolNeed(r.lvl), pays: G.SHOP.buys[log], char: burnOf(log) })).sort((a, b) => a.lvl - b.lvl);
      const noBurn = rows.filter((r) => !r.char);
      return `<p>Click a tree with an <b>axe in your hand</b>. A tree is good for about 25 logs before it falls, an oak for about 50, and a felled one is back in fifteen seconds.</p>
      <p><b>Most trees are scenery.</b> The ones you can actually cut have their own art &mdash; in the Yard they are the two gnarled Old oaks, and every zone past it names its tree. If clicking does nothing, it is not a tree.</p>
      <p><b>Level and axe are separate gates</b>, the same as <a data-wiki="guides/mining">mining</a>.</p>
      <table class="tbl"><tr><th>Logs</th><th>Woodcutting</th><th>Axe</th><th>Where</th><th>Bom pays</th><th>Burns into</th></tr>
        ${rows.map((r) => `<tr><td>${H.ico(r.log)} ${H.wl(`items/${r.log}`, H.esc(G.ITEMS[r.log]?.name || r.log))}</td><td>${r.lvl}</td><td>${H.esc(r.tool.name)}</td><td>${[...r.where].join(", ")}</td><td>${r.pays ?? "&mdash;"}</td><td>${r.char ? `${r.char} charcoal` : "<b>nothing</b>"}</td></tr>`).join("")}
      </table>
      <p><b>Logs are fuel, not just stock.</b> Every smelt in the game needs charcoal and charcoal is burnt logs, so woodcutting feeds <a data-wiki="guides/smithing">Smithing</a> exactly the way mining does.</p>
      <p><b>A log further out is not always worth more.</b> Charcoal per log and what Bom pays for it move separately &mdash; read both columns before walking somewhere for a tree.</p>
      ${noBurn.length ? `<p><b>${noBurn.map((r) => H.esc(G.ITEMS[r.log]?.name || r.log)).join(" and ")} will not burn.</b> There is no furnace recipe for ${noBurn.length > 1 ? "them" : "it"} yet, so for now ${noBurn.length > 1 ? "they are" : "it is"} something to sell rather than fuel.</p>` : ""}
      <p><b>Burning is the only Smithing you can do at level 1</b>, so a woodcutter already has a Smithing career started whether they meant to or not.</p>`;
    } },

  { id: "harvesting", title: "Harvesting", icon: "\u{1F33E}", cat: "Skills",
    body: (G, H) => `<p><b>Two halves.</b> Picking things that grow in the world, and growing your own on <a data-wiki="guides/islands">your island</a>.</p>
      <p><b>In the world</b>: <b>three patches of wheat grow wild in the Yard</b> &mdash; one in the north-west above the copper, one beside the path through the middle, and one out in the south-west meadow. Click them and they grow back on their own. <b>It is the only gathering skill that needs nothing in your hand</b> &mdash; no tool, no grade, no gate but your level.</p>
      <p><b>On your island</b> a plot grows in real time whether you are logged in or not, and pays back several of what you planted. That is where the levels are.</p>
      ${SEEDS_NOTE(G)}
      ${cropTable(G, H)}
      <p><b>Plant the longest crop you can before you log off</b> and the short ones while you are around. A plot is doing nothing between ripening and your coming back, which is the only real skill in this skill.</p>
      <p><b>Your island decides how many plots you have</b> &mdash; 8 to start, 12 for 5,000 tickets, 20 for 20,000. It multiplies everything above, so it is the upgrade that matters.</p>
      <p><b>It is background money, not a living.</b> A full set of plots kept going comes to a fraction of what fighting the same zone pays; the appeal is that it happens while you are doing something else.</p>` },

  { id: "thieving", title: "Thieving", icon: "\u{1F90F}", cat: "Skills",
    body: (G, H) => `<p><b>The Thieves&rsquo; Guild is in the far north-east corner of ${H.wl("areas/gloam", "the Gloam")}</b>, a shed in the dark at the end of a bad road, behind a door that wants a permit. Inside are four rooms of guild members, two marks to a room, and you pick their pockets. <b>Nothing in there fights back and nothing can be attacked</b> &mdash; it is the only skill in the game that needs no combat level at all, no weapon and no armour.</p>

      <h3>Getting in</h3>
      <p>You need a <b>Thieves&rsquo; permit</b>, and there are two ways to hold one:</p>
      <ul><li>Buy one from ${H.wl("npcs/Vance the Fence", "Vance the Fence")}, who stands beside the door, for <b>${num((G.SHOP.sells.find(([k]) => k === "thieves_permit") || [, 50000])[1])} tickets</b>.</li>
        <li>Find one in <b>the Hoodie&rsquo;s hoard</b> at the end of a Crypt run &mdash; about one chest in 105, 62 or 39 depending on the difficulty. Not past your three paid runs for the day.</li></ul>
      <p>It is an ordinary item, so it can be <b>bought and sold on the market</b>, which usually means it changes hands for rather less than Vance charges. The door takes it off you the first time and never asks again &mdash; so a permit you have already used cannot be sold on.</p>

      <h3>The four rooms</h3>
      <p><b>A clean run pays twice.</b> Lift five in a row without being caught and the fifth one comes out with two things instead of one. Getting caught puts you back to nothing &mdash; so the stun is not just lost time, it is the run it breaks.</p>
      <p>Each room is behind a door, and <b>the door and the marks are two different ladders</b>. The first door opens at Thieving 10 although the Grifters behind it cannot be picked until 25 &mdash; that is on purpose, so there is somewhere to walk to and look at while you are still learning.</p>
      <table class="tbl"><tr><th>Room</th><th>Door opens</th><th>Pick at</th><th>xp a pick</th><th>Tickets an hour</th></tr>
        <tr><td>The Back Room &mdash; Apprentice Lifters</td><td>&mdash;</td><td>1</td><td>19</td><td>~3,400</td></tr>
        <tr><td>The Back Room &mdash; Cutpurses</td><td>&mdash;</td><td>15</td><td>36</td><td>~4,500</td></tr>
        <tr><td>The Card Room &mdash; Grifters</td><td>10</td><td>25</td><td>56</td><td>~9,000</td></tr>
        <tr><td>The Card Room &mdash; The Shills</td><td>10</td><td>40</td><td>95</td><td>~14,800</td></tr>
        <tr><td>The Store Room &mdash; The Fixers</td><td>50</td><td>50</td><td>138</td><td>~22,000</td></tr>
        <tr><td>The Store Room &mdash; Housebreakers</td><td>50</td><td>62</td><td>182</td><td>~26,300</td></tr>
        <tr><td>The Vault Room &mdash; The Quartermaster</td><td>75</td><td>75</td><td>250</td><td>~33,000</td></tr>
        <tr><td>The Vault Room &mdash; The Ringleader</td><td>75</td><td>90</td><td>337</td><td>~36,300</td></tr>
      </table>

      <h3>How a pick works</h3>
      <p>Click a mark and you keep trying, one attempt every <b>2.4 seconds</b>, until you stop or you land one. Against a mark of <b>your own level you land 55%</b>, and <b>every level above that adds 2%</b>, up to a ceiling of <b>90%</b>. So a room you have just unlocked is the hard one and the room behind you is nearly free.</p>
      <p><b>Get caught</b> and the mark has your wrist: you are held for <b>two to three and a half seconds</b> and <b>one stolen thing falls out of your bag</b>. Only things taken in the guild can be lost that way &mdash; never tickets, never your gear, never your permit.</p>
      <p><b>After a successful lift that mark keeps a hand on their pocket for six seconds.</b> There are three of each in every room, so you work the room rather than one pocket.</p>

      <h3>What they carry</h3>
      ${(() => {
        /* (2026-09-25) GENERATED. The four rooms became EIGHT marks when thieving was buffed and this table was
           left at four; its fence prices were the pre-TIX_RATE ones as well, so every number in it was double.
           A mark's pockets are written in MARKS and its prices in SHOP.buys, so neither needs typing twice. */
        const marks = Object.values(G.MARKS).sort((x, y) => x.lvl - y.lvl);
        return `<table class="tbl"><tr><th>Mark</th><th>Thieving</th><th>What</th><th>How often</th><th>Fence</th></tr>
          ${marks.map((m) => (m.drop || []).map(([k, ch], i) => `<tr>${i ? "" : `<td rowspan="${m.drop.length}">${H.esc(m.name)}</td><td rowspan="${m.drop.length}">${m.lvl}</td>`}<td>${H.ico(k)} ${H.wl(`items/${k}`, H.esc(G.ITEMS[k]?.name || k))}</td><td>${Math.round(ch * 100)}%</td><td>${G.SHOP.buys[k] ? (G.ITEMS[k]?.name.match(/ore|glass/i) ? `${G.SHOP.buys[k]}, but smelt it` : G.SHOP.buys[k]) : "keep it"}</td></tr>`).join("")).join("")}
        </table>`;
      })()}
      <p><b>Buttons, watches, signets and ledgers are just money</b> &mdash; sell them at the Prize Counter. Everything else goes to an anvil, and that is the half worth having.</p>

      <h3>What the materials make</h3>
      <p>Three things, all at the <b>anvil</b>, none of them sold anywhere. Each is spent on <b>one reforge attempt</b> whatever that attempt does; tick them on at the anvil before you swing and the odds shown move with them.</p>
      <table class="tbl"><tr><th>What</th><th>Smithing</th><th>Made from</th><th>What it does</th></tr>
        <tr><td><b>Temper</b></td><td>20</td><td>2 whetgrit, 1 bronze bar</td><td>Adds <b>20 points</b> to the odds of that reforge</td></tr>
        <tr><td><b>Flux</b></td><td>40</td><td>2 quenching salts, 1 whetgrit</td><td>A failed reforge <b>cannot destroy the piece</b>; it only drops a level</td></tr>
        <tr><td><b>Master&rsquo;s seal</b></td><td>60</td><td>1 guild seal wax, 1 flux</td><td>The only way to take a piece <b>past +3, to +4</b></td></tr>
      </table>
      <p>A seal eats a flux, so seals can never be commoner than flux. If you are reforging something you would hate to lose, the honest advice is <b>flux first and temper second</b>: a temper only improves your chances, a flux is what stops the piece cracking in half.</p>

      <h3>Things go wrong at the anvil</h3>
      <p><b>Nothing you smelt or hammer is a certainty.</b> One attempt in ten fails &mdash; a bar, a piece of gear, a temper, all of it &mdash; at every level, and a failure takes the materials with it. The panel at the furnace and the anvil prints the chance on every row, so you are never guessing.</p>
      <p><b>Nova and Singularity are the exception</b> and never fail. Their weapons already cost a core that drops about one kill in two thousand; asking you to gamble that as well would be cruel rather than tense.</p>

      <h3>The other way to the top of smithing</h3>
      <p><b>The Quartermaster&rsquo;s room carries starfall ore, eclipse ore and voidglass.</b> Those three are otherwise only found in the Vault, and voidglass is not dropped by any monster at all &mdash; so a thief can supply their own Starfall and Eclipse gear without ever going down there. That is the real reason people want into the last room.</p>

      <h3>The Ditched set</h3>
      <p>Four pieces of a thief&rsquo;s kit that somebody threw in the water rather than be caught holding, and they come back out on a <b>fishing line</b>. Nobody in the guild sells them and nothing in the guild drops them &mdash; if you want them you fish, or you buy them off somebody who did.</p>
      <table class="tbl"><tr><th>Piece</th><th>Slot</th><th>Each gives</th></tr>
        <tr><td>Ditched hood</td><td>Helm</td><td rowspan="4">+2.5% to pick, +3% speed</td></tr>
        <tr><td>Ditched coat</td><td>Body</td></tr>
        <tr><td>Ditched gloves</td><td>Gloves</td></tr>
        <tr><td>Ditched boots</td><td>Boots</td></tr>
      </table>
      <p><b>A full set is +10% on every pick and +12% speed</b>, which takes the climb to 99 from about 72 hours to 61 &mdash; and to around 58 if you also have a pet that hurries you along. It is worn in ordinary armour slots, so you are giving up your combat gear to wear it. Inside the guild that costs you nothing, because nothing in there fights back; the moment you walk out, it costs you everything.</p>
      <p><b>The 90% ceiling still holds.</b> Gear helps while you are climbing towards it, which is the part that drags, and does nothing once you are already there.</p>
      <p>A piece turns up about <b>once every two hours</b> of steady fishing, from any water, so a set is an evening. Gear that helps you find rare things helps here too.</p>

      <h3>Who to talk to</h3>
      <p>Four guild members wander the rooms and are not marks &mdash; you cannot pick them, and they will not mind you trying. <b>Sticky Pete</b>, in the first room, explains how picking works. <b>Marla Nine-Fingers</b>, in the card room, explains what the materials are for. <b>The Quiet Man</b> and <b>Odile the Clerk</b> keep the two back rooms.</p>

      <h3>What it is worth</h3>
      <p><b>1 to 99 is about 72 hours</b> if you always work the best room you can reach &mdash; about level with Woodcutting, and a good deal quicker than Combat&rsquo;s 149. A full Ditched set takes it to roughly 61. The top room earns about what a middling miner does. That is deliberate: a room where nothing fights back should not also be the best money in the game, and the guild&rsquo;s real payment is the materials.</p>` },

  /* (2026-09-25) FLETCHING. Generated from the rules like the mining and cooking tables: the ladder, the woods,
     the gems and every number on this page are read out of G, so a retune cannot leave the wiki behind. */
  /* (2026-09-25) ARCHERY, the combat skill. Static, because none of it is a table. */
  /* (2026-09-26) MAGIC and WIZARDRY. Generated from the rules like every other skill table: elements, pages, wands, bags, altars,
     buffs, Waystones and crops are all read out of G, so a retune cannot leave the wiki behind. */
  { id: "magic", title: "Magic", icon: "\u{1FA84}", cat: "Skills",
    body: (G, H) => {
      const nm = (k) => H.esc(G.ITEMS[k]?.name || k), E = G.ELEMENTS, els = G.ELEMENT_KEYS;
      const pages = Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].ammo?.kind === "page").sort((a, b) => G.ITEMS[a].req.lvl - G.ITEMS[b].req.lvl);
      const wands = Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].wand).sort((a, b) => G.ITEMS[a].req.lvl - G.ITEMS[b].req.lvl);
      const bags = Object.keys(G.ITEMS).filter((k) => G.ITEMS[k].pouch?.ammo === "page").sort((a, b) => G.ITEMS[a].req.lvl - G.ITEMS[b].req.lvl);
      const byEl = (el, f) => Object.keys(G.MOBS).filter((t) => G.MOBS[t][f] === el).map((t) => H.wl(`monsters/${t}`, H.esc(G.MOBS[t].name)));
      return `<p><b>The third way to fight.</b> Hold a wand and every roll reads your <b>Magic</b> level &mdash; accuracy, max hit and defence &mdash; and every point of damage pays Magic xp, one for one, the way Melee and Archery do. Your combat level takes your best style in full and a little of the others.</p>
      <h3>Getting started</h3>
      <p><a data-wiki="npcs/Bom Trady">Bom's Prize Counter</a> sells a ${itemL(G, H, "logs_wand")}, a ${itemL(G, H, "bag_scrap")} and ${itemL(G, H, "page_arcane")}, all Magic 1 (and Morwenna the Mage sells every wand and Magic Bag, dearly: see ${H.wl("guides/outfitters", "the outfitters")}). Wand in the weapon hand, bag in the offhand, click the pages in your bag to load it. A wand casts from ${G.ITEMS.logs_wand.launcher.range} tiles and spends one page a cast.</p>
      <h3>The five elements</h3>
      <p>A page carries an element. A monster <b>weak</b> to it takes ${Math.round((G.MAGIC.weakMul - 1) * 100)}% more; one that <b>resists</b> it takes ${Math.round((1 - G.MAGIC.resistMul) * 100)}% less. Hover a monster to see which. Each element also does something of its own:</p>
      <table class="tbl"><tr><th>Element</th><th>Does</th><th>Weak to it</th></tr>
        <tr><td>${H.el("fire")} Fire</td><td>Half the time it burns: ${Math.round(G.MAGIC.burn.share * 100)}% of the hit again a moment later</td><td>${byEl("fire", "weak").join(", ")}</td></tr>
        <tr><td>${H.el("frost")} Frost</td><td>Slows the monster's swing for ${G.MAGIC.slow.ms / 1000} seconds</td><td>${byEl("frost", "weak").join(", ")}</td></tr>
        <tr><td>${H.el("storm")} Storm</td><td>Arcs to one monster beside the target for half the damage</td><td>${byEl("storm", "weak").join(", ")}</td></tr>
        <tr><td>${H.el("void")} Void</td><td>Ignores ${Math.round(G.MAGIC.pierce * 100)}% of the target's defence</td><td>${byEl("void", "weak").join(", ")}</td></tr>
        <tr><td>${H.el("sun")} Sun</td><td>Heals you for ${Math.round(G.MAGIC.sunHeal * 100)}% of the damage</td><td>${byEl("sun", "weak").join(", ")}</td></tr>
      </table>
      <p>Arcane pages are practice pages: no element, so nothing is weak to them and nothing resists them.</p>
      <h3>Spell pages</h3>
      <table class="tbl"><tr><th>Magic</th><th>Page</th><th>Adds</th></tr>${pages.map((k) => `<tr><td>${G.ITEMS[k].req.lvl}</td><td>${H.ico(k)} ${H.wl(`items/${k}`, nm(k))}</td><td>+${G.ITEMS[k].ammo.str}</td></tr>`).join("")}</table>
      <h3>Wands</h3>
      <table class="tbl"><tr><th>Magic</th><th>Wand</th></tr>${wands.map((k) => `<tr><td>${G.ITEMS[k].req.lvl}</td><td>${H.ico(k)} ${H.wl(`items/${k}`, nm(k))}</td></tr>`).join("")}</table>
      <h3>Magic Bags</h3>
      <p>Only five, so the steps are big. Each holds one kind of page in the offhand, and each can be reforged for more room. A wand casts only what is loaded in its Magic Bag: pages in your bag do not cast until you load them. Click a different page to swap spells.</p>
      <table class="tbl"><tr><th>Magic</th><th>Bag</th><th>Holds</th></tr>${bags.map((k) => `<tr><td>${G.ITEMS[k].req.lvl}</td><td>${H.ico(k)} ${H.wl(`items/${k}`, nm(k))}</td><td>${G.ITEMS[k].pouch.cap.toLocaleString()}</td></tr>`).join("")}</table>
      <p>Everything a wand casts is printed with <a data-wiki="guides/wizardry">Wizardry</a>.</p>`;
    } },
  /* (2026-09-27) Jewelcrafting, built from the rules so its numbers cannot drift */
  { id: "jewelcrafting", title: "Jewelcrafting", icon: "\u{1F48D}", cat: "Skills",
    body: (G, H) => {
      const nm = (k) => H.wl(`items/${k}`, H.esc(G.ITEMS[k]?.name || k)), rows = Object.values(G.RECIPES).filter((r) => r.station === "jbench").sort((a, b) => a.lvl - b.lvl);
      const row = (r) => `<tr><td>${r.lvl}</td><td>${H.ico(r.out[0])} ${r.out[1] > 1 ? `${r.out[1]} ` : ""}${nm(r.out[0])}</td><td>${r.in.map(([k, n]) => `${n} ${nm(k)}`).join(", ")}</td><td>${r.xp}</td></tr>`;
      const WORD = { tough: "less damage taken", bite: "more bites", speed: "faster at everything", rare: "better drops", tix: "more tickets" };
      return `<p><b>The jeweller's bench stands in the Yard, beside the anvil.</b> It does three things, and each is made out of another skill's work.</p>
      <h3>Polishing</h3><p>This is what trains it. Beads from the Yard's copper and tin, then glass from sand, then every ore from diamond up into a polished stone that Bom pays a little more for than the ore.</p>
      <table class="tbl"><tr><th>Level</th><th>Makes</th><th>From</th><th>xp</th></tr>${rows.filter((r) => !/^jc_(cut|set)/.test(r.id)).map(row).join("")}</table>
      <h3>Cutting</h3><p>The four gems Mining turns up (and the Depths' crystal veins, now and then) cut into stones worth far more.</p>
      <table class="tbl"><tr><th>Level</th><th>Makes</th><th>From</th><th>xp</th></tr>${rows.filter((r) => /^jc_cut/.test(r.id)).map(row).join("")}</table>
      <h3>Setting</h3><p>A cut gem goes into a ring or amulet Smithing made. It keeps every number its metal had and gains the gem's power; an amulet carries it twice.</p>
      <table class="tbl"><tr><th>Level</th><th>Makes</th><th>From</th><th>Adds</th></tr>${rows.filter((r) => /^jc_set/.test(r.id)).map((r) => { const it = G.ITEMS[r.out[0]], B = G.ITEMS[it.gembase]; const add = Object.entries(it.fx || {}).filter(([k, v]) => (B.fx || {})[k] !== v).map(([k, v]) => `${Math.round(v * 100)}% ${WORD[k] || k}`).join(", "); return `<tr><td>${r.lvl}</td><td>${H.ico(r.out[0])} ${nm(r.out[0])}</td><td>${r.in.map(([k, n]) => `${n} ${nm(k)}`).join(", ")}</td><td>${add}</td></tr>`; }).join("")}</table>`;
    } },
  /* (2026-09-27) Fungiculture, built from the rules so its numbers cannot drift */
  { id: "fungiculture", title: "Fungiculture", icon: "\u{1F344}", cat: "Skills",
    body: (G, H) => {
      const nm = (k) => H.wl(`items/${k}`, H.esc(G.ITEMS[k]?.name || k)), mins = (ms) => (ms >= 5400000 ? `${Math.round(ms / 360000) / 10} h` : `${Math.round(ms / 60000)} min`);
      const where = Object.fromEntries(Object.keys(G.FUNGI).map((sk) => [G.FUNGI[sk].yields, Object.entries(G.FUNG_WILD).filter(([, l]) => l.includes(G.FUNGI[sk].yields)).map(([m]) => G.SCENES[m]?.name || (m === "wild" ? "The Wilderness" : m === "deep" ? "The Deep Wild" : m))]));
      const shrooms = new Set(Object.values(G.FUNGI).map((F) => F.yields));
      const made = Object.values(G.RECIPES).filter((r) => r.station !== "compost" && r.in.some(([x]) => shrooms.has(x))).sort((a, b) => a.skill.localeCompare(b.skill) || a.lvl - b.lvl);
      const uses = (k) => Object.values(G.RECIPES).filter((r) => r.in.some(([x]) => x === k) && r.station !== "compost").map((r) => nm(r.out[0])).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "&mdash;";
      return `<p><b>Mushrooms, grown in a cellar under your island and picked wild on every map.</b> Yahsmeena sells a <b>Cellar ladder</b>; put it down with Decorate and click it to climb down. Only you can.</p>
      <h3>The cellar</h3>
      <ol><li>Make <b>compost</b> at the bin in the corner. This is how Fungiculture is trained from level 1.</li>
      <li>Click a <b>fungus bed</b> and plant <b>spawn</b> in it. Each planting takes compost, one to three by the shroom.</li>
      <li>Come back when it is ripe. A bed gives its shrooms, and <b>${G.SEED_BACK} spawn back, ${G.SEED_BACK + 1} one time in ${Math.round(1 / G.SEED_EXTRA)}</b>, so a bed planted once keeps going.</li></ol>
      <p>A first island opens ${G.FUNG.beds[1]} beds, a bigger one ${G.FUNG.beds[2]}, the Far Shore all ${G.FUNG.beds[3]}. Rainmaker waters a bed like a plot, a Truffle Pig makes every harvest a quarter heavier (its Legendary, the Truffle Baron, nearly half), and either one out <b>triples the shrooms and the spawn</b> a bed gives back.</p>
      <h3>Compost</h3>
      <table class="tbl"><tr><th>Level</th><th>Makes</th><th>From</th></tr>${Object.values(G.RECIPES).filter((r) => r.station === "compost").sort((a, b) => a.lvl - b.lvl).map((r) => `<tr><td>${r.lvl}</td><td>${r.out[1]} ${nm("compost")}</td><td>${r.in.map(([k, n]) => `${n} ${nm(k)}`).join(", ")}</td></tr>`).join("")}</table>
      <h3>Wild clusters</h3>
      <p>Every outdoor map has <b>three clusters</b>, always in the same places. Each gives you one pick a day: ${G.FUNG.wildN[0]} to ${G.FUNG.wildN[1]} shrooms, some xp, and about ${Math.round(G.FUNG.wildSpawn * 100)}% of the time its spawn. A cluster you have picked today is drawn faint. The Gloam's toadstools drop sporecap spawn now and then too.</p>
      <p><b>The black truffle grows nowhere wild.</b> Wear a Truffle Pig while you pick: about ${Math.round(G.FUNG.truffle.pick * 100)}% of picks turn one up, and some turn up its spawn. The Truffle Baron finds them about ${Math.round(G.FUNG.truffle.pick * G.TRUFFLE_BARON * 100)}% of the time. Either one also <b>triples</b> the shrooms a wild pick gives, and any spawn it turns up.</p>
      <h3>The shrooms</h3>
      <table class="tbl"><tr><th>Level</th><th>Shroom</th><th>Grows</th><th>Compost</th><th>xp</th><th>Wild in</th><th>Goes into</th></tr>${Object.entries(G.FUNGI).map(([sk, F]) => `<tr><td>${F.lvl}</td><td>${H.ico(F.yields)} ${nm(F.yields)}</td><td>${mins(F.ms)}</td><td>${F.compost}</td><td>${F.xp.toLocaleString()}</td><td>${where[F.yields].length ? H.esc(where[F.yields].join(", ")) : "A Truffle Pig finds it"}</td><td>${uses(F.yields)}</td></tr>`).join("")}</table>
      <h3>What shrooms make</h3>
      <p>Every recipe that uses a shroom. Potions and inks are brewed at a <b>cauldron</b> (Alchemy). Meals and pet food are cooked at a <b>campfire</b> (Cooking).</p>
      <table class="tbl"><tr><th>Level</th><th>Makes</th><th>From</th><th>Where</th></tr>${made.map((r) => `<tr><td>${r.lvl} ${H.esc(G.SKILLS[r.skill]?.name || r.skill)}</td><td>${H.ico(r.out[0])} ${r.out[1] > 1 ? `${r.out[1]} ` : ""}${nm(r.out[0])}</td><td>${r.in.map(([k, n]) => `${n} ${nm(k)}`).join(", ")}</td><td>${r.station === "cauldron" ? "Cauldron" : r.station === "fire" ? "Campfire" : H.esc(G.STATIONS[r.station]?.name || r.station)}</td></tr>`).join("")}</table>`;
    } },
  /* (2026-09-27) Breeding, built from the rules so its numbers cannot drift (rebuilt the same day: the pen breeds, the hatchery hatches, three pet foods) */
  { id: "breeding", title: "Breeding", icon: "\u{1F95A}", cat: "Skills",
    body: (G, H) => {
      const nm = (k) => H.wl(`items/${k}`, H.esc(G.ITEMS[k]?.name || k)), pet = (k) => `${H.esc(G.PETS[k].name)}`, hrs = (ms) => `${Math.round(ms / 3600000)} hours`, R = G.RANKS;
      const rk = (r) => `<b style="color:${R[r].col}">${R[r].mark ? `${R[r].mark} ` : ""}${R[r].name}</b>`;
      const foods = Object.values(G.RECIPES).filter((r) => /^petfood_/.test(r.id)).sort((a, b) => a.lvl - b.lvl || a.id.localeCompare(b.id));
      return `<p><b>Pets come in three ranks:</b> ${rk("ordinary")}, ${rk("greater")} and ${rk("legend")}. Breed two in your island's <b>pet pen</b> to make a better one; hatch eggs in a <b>hatchery</b>.</p>
      <h3>The pet pen</h3>
      <p>Click the pen, put a pair in, and <b>pick one stat from each parent</b>: the baby gets both, so a pair bred for the right stats makes a better one. It shows the baby before you start. Press <b>Breed</b>: the food goes in at once and the clock runs by itself, logged in or not. When you collect, you get the baby <b>and both parents back</b>, so the same pair can go straight back in: the food and the time are the cost. Stopping early gives them back too, but the food is gone.</p>
      <table class="tbl"><tr><th>Put in</th><th>Get</th><th>Food</th><th>Time</th><th>Breeding</th></tr>
        <tr><td>${rk("ordinary")} + ${rk("ordinary")}</td><td>${rk("greater")}: looks like whichever parent you choose, and carries the one stat you pick from each parent, 25% stronger</td><td>${G.BREED.greater.food} ${nm(R.greater.food)}</td><td>${hrs(G.BREED.greater.ms)}</td><td>${G.BREED.greater.lvl}</td></tr>
        <tr><td>${rk("greater")} + ${rk("greater")} of the same kind</td><td>${rk("legend")}: its own pet and powers, plus the one stat you pick from each parent</td><td>${G.BREED.legend.food} ${nm(R.legend.food)}</td><td>${hrs(G.BREED.legend.ms)}</td><td>${G.BREED.legend.lvl}</td></tr></table>
      <table class="tbl"><tr><th>Two Greater&hellip;</th><th>make</th><th>Does</th></tr>${Object.entries(G.LEGEND_OF).map(([base, k]) => `<tr><td>${pet(base)}</td><td>${rk("legend")} ${pet(k)}</td><td>${H.esc(G.petFxText(G.PETS[k].fx))}</td></tr>`).join("")}</table>
      <h3>The hatchery</h3>
      <p>Yahsmeena sells a <b>Hatchery</b>. Put it down on your island, click it, and put an egg in with ${G.BREED.hatch.food} ${nm(R.ordinary.food)}. That is all: it hatches when the clock runs out.</p>
      <p>About one kill in ${Math.round(1 / G.BREED.eggDrop).toLocaleString()} drops an egg, and each map has its own. Eggs trade and list on the Exchange.</p>
      <table class="tbl"><tr><th>Egg</th><th>Hatches in</th><th>Into</th><th>Does</th><th>Found</th></tr>${Object.entries(G.EGGS).map(([k, e]) => `<tr><td>${H.ico(k)} ${nm(k)}</td><td>${hrs(e.ms)}</td><td>${pet(e.pet)}</td><td>${H.esc(G.petFxText(G.PETS[e.pet].fx))}</td><td>${e.where ? H.esc(e.where) : e.from.map((s) => H.esc(G.SCENES[s]?.name || s)).join(", ")}</td></tr>`).join("")}</table>
      <h3>Pet food</h3>
      <p>Three kinds, cooked at any campfire, each from more than one pair of ingredients so whatever you are carrying from that part of the game will do.</p>
      <p><b>No pet yet? Cook pet food.</b> While you own no pet, hold no egg and have nothing in the pen or hatchery, every batch you cook trains Breeding a little: ${G.BREED.foodXp.petfood_ordinary} xp for Ordinary, ${G.BREED.foodXp.petfood_greater} for Greater, ${G.BREED.foodXp.petfood_legend} for Legendary. Once you have a pet or an egg, the xp comes from the pen and the hatchery instead.</p>
      <table class="tbl"><tr><th>Cooking</th><th>Makes</th><th>From</th></tr>${foods.map((r) => `<tr><td>${r.lvl}</td><td>${H.ico(r.out[0])} ${r.out[1]} ${nm(r.out[0])}</td><td>${r.in.map(([k, n]) => `${n} ${nm(k)}`).join(", ")}</td></tr>`).join("")}</table>`;
    } },
  { id: "wizardry", title: "Wizardry", icon: "\u{1F4DC}", cat: "Skills",
    body: (G, H) => {
      const nm = (k) => H.esc(G.ITEMS[k]?.name || k), E = G.ELEMENTS;
      const sites = Object.entries(G.ALTAR_SITES).map(([sc, A]) => `<tr><td>${H.esc(G.STATIONS[A.t].name[0].toUpperCase() + G.STATIONS[A.t].name.slice(1))}</td><td>${H.esc(G.SCENES[sc]?.name || sc)}</td></tr>`).join("");
      const seeds = Object.entries(G.CROPS).filter(([, c]) => c.yields && Object.values(E).some((e) => e.bloom === c.yields));   /* (2026-09-30) only the four ink flowers: the pumpkin seed also `yields` and printed ink_undefined */
      const tier = (C_) => C_.vals.map((v) => C_.what(v)).join(" / ");
      return `<p><b>Wizardry ties the others together.</b> Seeds from monsters grow on your island (Harvesting), the flowers are brewed into ink at the cauldron (Alchemy), paper is pressed from logs (eight sheets a willow log, fourteen from a Gallows log at Wizardry 90), and pages and scrolls are <b>printed at altars</b> around the world. Every print can fail, like any craft.</p>
      <h3>The altars</h3>
      <p>Each altar prints its own element's pages and scrolls, so printing means travelling:</p>
      <table class="tbl"><tr><th>Altar</th><th>Where</th></tr>${sites}<tr><td><b>The Nexus</b></td><td>The Deep Wild</td></tr></table>
      <p><b>The Nexus</b> is the best altar in the game, in the most dangerous place: it prints what every altar prints, <b>${G.NEXUS.mult}× the pages</b> (a wand or a Magic Bag still comes out one at a time), for <b>${Math.round((G.NEXUS.xp - 1) * 100)}% more Wizardry xp</b>. Anyone can find you there.</p>
      <h3>Seeds and ink</h3>
      <table class="tbl"><tr><th>Harvesting</th><th>Plant</th><th>Grows</th><th>Brews</th></tr>${seeds.map(([k, c]) => `<tr><td>${c.lvl}</td><td>${H.ico(k)} ${nm(k)}</td><td>${H.ico(c.yields)} ${nm(c.yields)}</td><td>${H.ico(`ink_${Object.keys(E).find((e) => E[e].bloom === c.yields)}`)} ${nm(`ink_${Object.keys(E).find((e) => E[e].bloom === c.yields)}`)}</td></tr>`).join("")}</table>
      <p>Seeds drop from the monsters of each element's home, and they are rare: about one kill in a hundred and twenty-five (the Grim Lich in the Deep Wild, ten times that). A harvested seed crop gives two seeds back, and one harvest in ten gives three, so every plot doubles itself and a farm grows by one plot a harvest. Storm ink is brewed from the Stormcorn that already grows on your island; Arcane ink from sulky sporecaps.</p>
      <h3>Utility pages</h3>
      <p>Buffs, one at a time: reading a new one replaces the old. The clock runs only outside. <b>Your Wizardry sets the tier</b> when you read it: I below ${G.MAGIC.tierAt[0]}, II from ${G.MAGIC.tierAt[0]}, III from ${G.MAGIC.tierAt[1]}.</p>
      <table class="tbl"><tr><th>Wizardry</th><th>Page</th><th>Altar</th><th>Tier I / II / III</th><th>Lasts</th></tr>${Object.entries(G.CHARMS).sort((a, b) => a[1].lvl - b[1].lvl).map(([k, C_]) => `<tr><td>${C_.lvl}</td><td>${H.ico(`scroll_${k}`)} ${H.esc(C_.name)}</td><td>${H.el(C_.el)} ${E[C_.el].name}</td><td>${H.esc(tier(C_))}</td><td>${C_.mins} min</td></tr>`).join("")}</table>
      <p><b>Homeward</b> (Sun altar, Wizardry 10) puts you on your own island.</p>
      <h3>Waystones</h3>
      <p>Four, spaced across the world, at a fork or the far end of a branch, so you still walk to everything between. Printed at the Storm altar. Not in the Wilderness, not inside a run, not within 10 seconds of being hit.</p>
      <table class="tbl"><tr><th>Wizardry</th><th>Waystone</th></tr>${Object.entries(G.WAYSTONES).map(([k, Wy]) => `<tr><td>${Wy.lvl}</td><td>${H.ico(k)} ${H.esc(Wy.name)}</td></tr>`).join("")}</table>
      <p>Wands and Magic Bags are made at the Arcane altar in the Yard, from logs, ink and the gems that turn up in ore.</p>`;
    } },
  { id: "archery", title: "Archery", icon: "\u{1F3F9}", cat: "Skills",
    body: (G) => `<p><b>A second way to fight.</b> Hold a bow and every roll in the fight reads your Archery level instead of Combat &mdash; accuracy, max hit and defence &mdash; and every point of damage pays Archery the xp Combat would have had. Hitpoints trains alongside it at <b>a third of melee's rate</b>: you are not the one getting hit. Your combat level takes the higher of the two.</p>
      <h3>Getting started</h3>
      <p><a data-wiki="npcs/Bom Trady">Bom's Prize Counter</a> sells a <b>${G.ITEMS.logs_shortbow.name.toLowerCase()}</b>, a <b>${G.ITEMS.logs_quiver.name.toLowerCase()}</b> and <b>${G.ITEMS.bone_arrow.name.toLowerCase()}s</b>, all Archery 1. Bow in the weapon hand, quiver in the offhand (it takes the shield's place), click the arrows in your bag to load it. Arrows stack to 1,000 in the bag.</p>
      <h3>How a bow fights</h3>
      <ul><li><b>You shoot from where you stand.</b> A shortbow reaches ${G.ITEMS.logs_shortbow.launcher.range} tiles, a longbow ${G.ITEMS.logs_longbow.launcher.range}; click something inside that and you never move. Click something further and you walk only to the edge of your reach.</li>
      <li><b>One arrow a shot, hit or miss, and only from the quiver.</b> Arrows in your bag do not fire: load them into the quiver first. When the quiver is empty the bow stops.</li>
      <li><b>The arrow is the damage.</b> Every arrow adds half its strength to what lands, from +${Math.round(G.ITEMS.bone_arrow.ammo.str * G.AMMO_SHARE)} for bone to +${Math.round(G.ITEMS.singularity_arrow.ammo.str * G.AMMO_SHARE)} for singularity; the bow is speed and reach. Each arrow has its own Archery level to draw.</li>
      <li><b>Big targets are hard to miss.</b> Arrows do a fifth more to large monsters and bosses.</li>
      <li><b>Stand and shoot.</b> With a loaded quiver, when your target dies you draw on the next one of the same kind inside your reach without a click, and the fight's idle timer runs eight minutes instead of three. A sword still needs you at the keyboard.</li>
      <li><b>Some things only an arrow reaches.</b> Thunder Geese sit over the tear in the Thunderhead's floor, on water nobody can walk to. A sword is told so; a bow just shoots.</li>
      <li><b>In the wild, first blood goes to the bow.</b> An archer gets free shots while a sword closes four to six tiles &mdash; and shoots back from range once it arrives, at Archery's defence.</li></ul>
      <p>Everything a bow fires is made at the <a data-wiki="guides/fletching">fletching table</a>.</p>` },
  /* (2026-09-27, the owner: "add an all up jewels page that show them all on one page, aswell, and where they drop") EVERY GEM ON ONE
     PAGE: what it is worth, every rock it comes out of and where, the chance, any monster that drops it, and what it is for. Built from
     the same index the gem's own page reads (H.WIKI.gemFrom, H.dropsOf), so the two can never disagree and nothing from a shut map shows. */
  { id: "gems", title: "Gems", icon: "\u{1F48E}", cat: "Skills",
    body: (G, H) => {
      if (!H.WIKI) return "<p>Open this page from the game to see where every gem comes from.</p>";
      const nm = (k) => H.wl(`items/${k}`, `${H.ico(k)} ${H.esc(H.ITEMS[k]?.name || k)}`);
      const shut = (r) => H.ITEMS[r.out[0]]?.held || H.SKILLS[r.skill]?.held;
      const boost = Object.values(G.PETS).filter((p) => p.fx?.gem && !p.held).map((p) => `a <b>${H.esc(p.name)}</b> (+${p.fx.gem}%)`);
      const pct = (p) => `1 in ${Math.round(1 / p)}`;
      const gem = (g) => {
        const rocks = H.WIKI.gemFrom?.[g.key] || [], mobs = H.dropsOf(g.key);
        const uses = Object.values(G.RECIPES).filter((r) => r.in.some(([k]) => k === g.key) && !shut(r)).filter((r, i, a) => a.findIndex((x) => x.out[0] === r.out[0]) === i);
        return `<h3>${H.ico(g.key)} ${H.wl(`items/${g.key}`, H.esc(g.name))}</h3>
          <table class="tbl"><tr><th>Rock</th><th>Where</th><th>Mining</th><th>Chance</th></tr>${rocks.length ? rocks.map((s) => `<tr><td>${H.esc(s.obj)} (${nm(s.ore)})</td><td>${H.areaLink(s.scene)}</td><td>${s.lvl}</td><td>${pct(s.p)} ores</td></tr>`).join("") : `<tr><td colspan="4">No rock you can reach turns one up yet.</td></tr>`}</table>
          ${mobs.length ? `<p><b>Also dropped by</b> ${mobs.map((d) => `${H.wl(`monsters/${d.mob}`, H.esc(H.MOBS[d.mob].name))} (${d.ch == null ? "always" : pct(d.ch)})`).join(", ")}.</p>` : ""}
          <p><b>Tips</b> ${g.tips.map(nm).join(" and ")} for <b>+${g.str}</b> arrow strength (Fletching ${g.lvl}).${uses.length ? ` <b>Used in</b> ${uses.map((r) => nm(r.out[0])).join(", ")}.` : ""}</p>`;
      };
      /* (2026-09-30, the owner: "the wiki gems guide page needs all the new gems. the gems and sorting page has it but not the main gems page") EVERY GEM.
         The list is GEMSET.list (the gem bag's 25); where each comes from is the gem rules themselves: a combat gem off any monster of GEMSET.dropLvl+,
         a skilling gem off its own skill from that level, and the four that are also MINED (G.GEMS) out of the ores named there. */
      const S = G.GEMSET, oreOf = Object.fromEntries(G.GEMS.map((g) => [g.key, g])), num = (n) => Math.round(n).toLocaleString();
      const from = (g) => [
        g.where === "gear" ? `monsters of level ${S.dropLvl}+ (1 kill in ${num(1 / (S.drop * 10))}, open bosses 1 in 5)` : `${H.esc(H.SKILLS?.[g.skill]?.name || g.skill)} from level ${S.dropLvl} (1 action in ${num(1 / S.drop)})`,
        oreOf[g.k] ? `mined out of ${oreOf[g.k].ores.map(nm).join(", ")} (${pct(oreOf[g.k].drop)} ores)` : null].filter(Boolean).join("; also ");
      const table = (w) => `<table class="tbl"><tr><th>Gem</th><th>In the bag it</th><th>Where it comes from</th></tr>${S.list.filter((g) => g.where === w).map((g) => `<tr><td>${nm(g.k)}</td><td>${H.esc(g.does)}</td><td>${from(g)}</td></tr>`).join("")}</table>`;
      const v11 = G.HOLD.gemcut ? "" : `<p class="note"><b>Since v1.1, gems are rarer and stay with whoever finds them</b>: a quarter as many drop from every source, and gems can't be traded or put on the Exchange. A gem you find is yours to sort and set.</p>`;
      return v11 + `<p><b>${S.list.length} gems.</b> Every one is a small permanent bonus once the ${H.wl("guides/gembag", "Gem Sorter")} has rolled it and it sits in your ${H.wl("guides/gembag", "gem bag")}: ${S.list.filter((g) => g.where === "gear").length} <b>combat</b> gems, found on monsters, and ${S.list.filter((g) => g.where === "case").length} <b>skilling</b> gems, each tied to one skill and found while you train it. Four of them (${G.GEMS.map((g) => nm(g.key)).join(", ")}) also come out of ore, at any Mining level, and are fletched into arrow tips.</p>
        <p><b>Finding one:</b> from level <b>${S.dropLvl}</b> in a skill, every action in it has a 1 in ${num(1 / S.drop)} chance of that skill's gem. Any monster of level ${S.dropLvl} or more drops a combat gem (one of the ${S.list.filter((g) => g.where === "gear").length}, at random) about once in ${num(1 / (S.drop * 10))} kills, and an open-world boss one time in five. Only the best ${S.perType} of any one gem count in the bag, so different stones beat copies.</p>
        <h3>Combat gems</h3>${table("gear")}
        <h3>Skilling gems</h3>${table("case")}
        <h2 style="margin-top:22px">The four you can mine</h2>
        <p>Every ore you get has a small chance to come with a gem as well: <b>${pct(G.GEMS[0].drop)}</b>, the same for every gem and at any level. Which gem depends on the ore: the cheap ores give rubies, the top ores give opals.</p>
        <table class="tbl"><tr><th>Gem</th><th>Mined out of</th><th>Chance</th></tr>${G.GEMS.map((g) => `<tr><td>${nm(g.key)}</td><td>${g.ores.map(nm).join(", ")}</td><td>${pct(g.drop)} ores</td></tr>`).join("")}</table>
        <p><b>More gems:</b> the <b>${H.esc(G.CHARMS.stonesense.name)}</b> page (Wizardry ${G.CHARMS.stonesense.lvl}) makes them turn up ${G.CHARMS.stonesense.vals.join("/")}% more often by tier${boost.length ? `, and so does ${boost.join(" or ")} following you` : ""}. A rock gives the same chance on every ore, so a vein that never runs dry is the best place to stand.</p>
        ${G.GEMS.map(gem).join("")}`;
    } },
  /* (2026-09-29, the owner: "wiki needs updates for new gems and gem sorter etc as well") THE GEM BAG AND THE SORTER. Every number is read
     from GEMSET, gemOdds and GEM_BANDS, so a retune of the odds or the prices cannot leave this page behind. The page hides it while
     HOLD.gems is on (wikiPages in eastscape.html), like the other held systems. */
  /* (2026-10-01, v1.1) WORK CLOTHES: every set, read from WORKSETS, so a new set or a new source cannot leave this page behind. Hidden while HOLD.work. */
  { id: "workclothes", title: "Work clothes", icon: "\u{1F9E5}", cat: "Going further",
    body: (G, H) => {
      const sets = Object.values(G.WORKSETS || {});
      return `<p><b>Every skill has a set of work clothes</b>: a hat, a coat, gloves and boots. Each piece you have of the outfit you're wearing gives <b>+3% XP</b> in that set's skill, and all four give <b>+3% more and a perk of their own</b>, so a whole set gets you to 99 about 15% faster.</p>
        <p>They live in your <b>Locker</b> (Equipment, then Work clothes), never in your bag or bank: they take no room, they can't be traded, and a find is <b>always a piece you don't have yet</b>, so four finds is a set. One outfit on at a time; switch it in one click, anywhere. Work clothes never touch your combat numbers.</p>
        <p><b>Every set is found somewhere else</b> than its own skill, so a miner wants a runner and a cook wants a breeder.</p>
        <table class="tbl"><tr><th>Set</th><th>Skill</th><th>All four</th><th>Where it's found</th></tr>${sets.map((S) => `<tr><td>${S.pieces.map((k) => (H.ico ? H.ico(k) : "")).join("")}<br><b>${H.esc(S.name)}</b></td><td>${H.esc(G.SKILLS[S.skill]?.name || S.skill)}</td><td>${H.esc(S.full)}</td><td>${H.esc(S.from)}</td></tr>`).join("")}</table>
        <p>The Ditched set came first: it used to be worn as armour. Every Ditched piece now lives in the Locker, and anyone who had two of a piece was paid for the spare.</p>`;
    } },
  { id: "gembag", title: "The gem bag and the Gem Sorter", icon: "\u{1F48E}", cat: "Going further",
    body: (G, H) => {
      const S = G.GEMSET, nm = (k) => H.wl(`items/${k}`, `${H.ico(k)} ${H.esc(G.ITEMS[k]?.name || k)}`), tix = (n) => `${n.toLocaleString()} tickets`;
      const odds = (lo, hi) => { let p = 0; for (let r = lo; r <= hi; r++) p += G.gemOdds(r); p *= 100; return p < 1 ? `${p.toFixed(1)}%` : `${Math.round(p)}%`; };
      const sgn = (r) => `${r > 0 ? "+" : ""}${r}%`, side = (w) => S.list.filter((g) => g.where === w);
      const row = (g) => `<tr><td>${nm(g.k)}</td><td>${H.esc(g.does)}</td><td>${g.skill ? H.esc(H.SKILLS?.[g.skill]?.name || g.skill) : "monsters of level " + S.dropLvl + "+"}</td></tr>`;
      return `<p><b>Gems are small permanent bonuses you carry with you.</b> Find one, have the Gem Sorter roll it a bonus, and put it in your <b>gem bag</b>, which works wherever you are. Open the bag from the <b>Gems</b> button on your inventory; it pops open beside it.</p>
        <h3>The gem bag</h3>
        <p>Two sides of ${S.bag.max} settings each: <b>Combat</b> gems on one side, <b>Skilling</b> gems on the other, and a gem only fits its own side. ${S.bag.start === 1 ? "One setting on each side is open" : `${S.bag.start} settings on each side are open`} from the start; the rest open for tickets, each side on its own: ${S.bag.price.map(tix).join(", then ")}.</p>
        <p>Only a <b>sorted</b> gem goes in. Taking one out gives it back <b>as it was</b>, roll and all, so you can rearrange the bag${G.noTrade?.("ruby") ? "" : ", trade a sorted gem or sell it on the Market"}. <b>Only the best ${S.perType} of any one gem count</b>: a third ruby adds nothing, so fill the bag with different stones.</p>
        <h3>The Gem Sorter</h3>
        <p>A jeweller's bench in the Yard's north court. Stand by it and it will <b>sort</b> a gem (roll its bonus) for <b>${tix(S.cost)}</b> a roll, <b>re-roll</b> a sorted one for the same, or <b>buy any gem back</b> for ${tix(S.sell)}, whatever its roll. A roll lands between <b>${sgn(S.roll[0])}</b> and <b>${sgn(S.roll[1])}</b>, and the higher it is, the rarer it is. A negative roll is exactly that much worse.</p>
        <table class="tbl"><tr><th>Band</th><th>Roll</th><th>Chance</th></tr>${G.GEM_BANDS.map(([n, lo, hi]) => `<tr><td><b>${n}</b></td><td>${lo === hi ? sgn(lo) : `${sgn(lo)} to ${sgn(hi)}`}</td><td>${odds(lo, hi)}</td></tr>`).join("")}</table>
        <p>A perfect ${sgn(S.roll[1])} is about <b>1 in ${Math.round(1 / G.gemOdds(S.roll[1]))}</b> rolls, and the room hears about it when somebody lands one.</p>
        ${G.LOUPES && G.gemOddsLoupe ? (() => { const L = Object.keys(G.LOUPES).filter((k) => G.STORE?.[k]), top = [S.roll[1] - 2, S.roll[1] - 1, S.roll[1]], odd = (p) => `1 in ${Math.round(1 / p)}`;
          return L.length ? `<h3>The loupes</h3>
        <p><b>The <a data-wiki="guides/store">Store</a> sells two loupes that lift the top of the Sorter's table.</b> A loupe is a number of rolls, not a clock: while you hold any, the Sorter spends one on every roll (the Master's first), and each roll still costs its ${tix(S.cost)}. You can hold up to ${G.LOUPE_MAX || 50} rolls. They buy speed, not money: a Perfect costs about what plain rolls would, it just comes sooner, with the +8s and +9s on the way.</p>
        <table class="tbl"><tr><th>Roll</th><th>Plain</th>${L.map((k) => `<th>${H.esc(G.STORE[k].name)} (${G.LOUPES[k].rolls} rolls, ${tix(G.priceOf(G.STORE[k]))})</th>`).join("")}</tr>${top.map((r) => `<tr><td>${sgn(r)}</td><td>${odd(G.gemOdds(r))}</td>${L.map((k) => `<td>${odd(G.gemOddsLoupe(k, r))}</td>`).join("")}</tr>`).join("")}</table>` : ""; })() : ""}
        <h3>Finding gems</h3>
        <p>From level <b>${S.dropLvl}</b> in a skill, every action has a 1 in ${Math.round(1 / S.drop).toLocaleString()} chance of turning up that skill's gem. Monsters of level ${S.dropLvl} or more drop a combat gem now and then, and a boss more often. Every gem found is unsorted${G.noTrade?.("ruby") ? ", and it is yours: gems can't be traded or sold on the Exchange (the Gem Sorter buys them), and they bank like anything else" : "; they trade and bank like anything else, and a sorted one keeps its roll when it changes hands"}.</p>
        <h3>Combat gems</h3>
        <table class="tbl"><tr><th>Gem</th><th>Does</th><th>From</th></tr>${side("gear").map(row).join("")}</table>
        <h3>Skilling gems</h3>
        <table class="tbl"><tr><th>Gem</th><th>Does</th><th>From</th></tr>${side("case").map(row).join("")}</table>`;
    } },
  /* (2026-09-29, opened with the skill) TINKERING: salvage into parts, gadgets out of parts, and the World Projects everybody builds
     together. Every number is read from TINK, GADGETS and PROJECTS; the page hides it while HOLD.tinker. */
  { id: "tinkering", title: "Tinkering and World Projects", icon: "\u{1F527}", cat: "Skills",
    body: (G, H) => {
      const T = G.TINK, P = T.parts, num = (n) => Number(n).toLocaleString();
      const parts = (o) => Object.entries(o || {}).filter(([p, n]) => n > 0).map(([p, n]) => p === "tickets" ? `${num(n)} tickets` : `${num(n)} ${H.esc(P[p]?.name || p)}`).join(", ");
      const gad = Object.entries(G.GADGETS).filter(([, g]) => g.item !== false).sort((a, b) => a[1].lvl - b[1].lvl);
      const proj = Object.entries(G.PROJECTS);
      return `<p><b>Tinkering turns junk into things.</b> Talk to <b>${H.esc(T.npc)}</b> at her Scrap Bench by Bronny's worksite in the Yard. Salvage what you don't need into <b>parts</b>, build <b>gadgets</b> out of parts and a ticket fee, and give parts to the <b>World Projects</b> the whole server builds together.</p>
        <h3>Parts</h3>
        <p>Four kinds, kept in a pouch of their own: they take no bag space, and Bom won't buy them.</p>
        <table class="tbl"><tr><th>Part</th><th>Worth</th><th>Mostly from</th></tr>
          <tr><td><b>${P.scrap.name}</b></td><td>${P.scrap.pv}</td><td>anything: drops, loot, the leftovers of everything else</td></tr>
          <tr><td><b>${P.gears.name}</b></td><td>${P.gears.pv}</td><td>metal: gear, tools, bars and ore</td></tr>
          <tr><td><b>${P.sparks.name}</b></td><td>${P.sparks.pv}</td><td>magic: spell pages, ink, wands, and magical drops like stardust and voidglass</td></tr>
          <tr><td><b>${P.relic.name}</b></td><td>${P.relic.pv}</td><td>anything Bom would pay ${num(T.relicAt)} or more for</td></tr></table>
        <h3>Salvage</h3>
        <p>An item salvages into parts worth <b>${Math.round(T.rate * 100)}%</b> of what Bom would pay you for it, and something he pays nothing for (a feather, a pit) is still worth a little Scrap. A stack is added up before it's rounded down, so a pile of junk is worth more than one piece of it. <b>Salvage the lot</b> takes only plain drops and loot, never gear, food or anything rare; those go one at a time. Salvaging pays Tinkering xp: half an item's part value, but never more than ${T.salvXpCap} for one item, so a rare is not a shortcut. Building a gadget pays ${T.buildXpLvl} xp for each level it needs. Money, keys, eggs, pets and quest or event items can't be salvaged.</p>
        <h3>Gadgets</h3>
        <p>Built at the Scrap Bench from parts plus a ticket fee. A timed gadget runs only outside (and in the Guild), like a drink, and you can run one of each at once; the others are used on the spot. Every build has a ${Math.round(T.masterwork * 100)}% chance of a <b>Masterwork</b>: twice as many. Gadgets are items, so they trade on the Market.</p>
        <table class="tbl"><tr><th>Level</th><th>Gadget</th><th>Does</th><th>Costs</th></tr>${gad.map(([id, g]) => `<tr><td>${g.lvl}</td><td>${H.wl(`items/tk_${id}`, `${H.ico(`tk_${id}`)} ${H.esc(g.name)}`)}${g.n > 1 ? ` ×${g.n}` : ""}</td><td>${H.esc(g.does)}${g.mins ? ` (${g.mins} min)` : ""}</td><td>${parts(g.parts)}, ${num(g.fee)} tickets</td></tr>`).join("")}</table>
        <p><b>The automation tools</b> (Auger, Chainsaw, Auto-Reel) keep you gathering with no clicks and walk you to the next rock, tree or spot of the same kind. Whenever nobody has touched the game for a few minutes they work at ${Math.round(T.autoRate * 100)}% speed, and nothing gathers while you're logged out.</p>
        <h3>World Projects</h3>
        <p>Broken things around the world that the whole server rebuilds together. Anyone can give parts and tickets to the current stage at its board; when a stage is full, somebody with the Tinkering level it asks for has to stand at it and finish the job. Everybody who gave gets that build's <b>Builder's Pin</b>, and the Builders board on the Hiscores counts what each person gave. Each project has three stages:</p>
        ${proj.map(([pid, p]) => `<h3>${H.ico(`pin_${pid}`)} ${H.esc(p.name)} <small>${H.esc(p.where)}</small></h3><p>${H.esc(p.blurb)}</p><table class="tbl"><tr><th>Stage</th><th>Needs</th><th>Finish at</th><th>Does</th></tr>${p.tiers.map((t) => `<tr><td><b>${H.esc(t.name)}</b></td><td>${parts(t.need)}</td><td>Tinkering ${t.finish}</td><td>${H.esc(t.does)}</td></tr>`).join("")}</table>`).join("")}`;
    } },
  /* (2026-09-29) THE OUTFITTERS: every piece, price and bonus read from OUTFIT and outfitShelf, so the page cannot drift from the shops */
  { id: "outfitters", title: "Archery and magic gear: the outfitters", icon: "\u{1F9E5}", cat: "Going further",
    body: (G, H) => {
      const O = G.OUTFIT, tix = (n) => `${n.toLocaleString()} tickets`, nm = (k) => H.wl(`items/${k}`, `${H.ico(k)} ${H.esc(G.ITEMS[k]?.name || k)}`);
      const setTable = (shop) => { const style = O.style[shop];
        return `<table class="tbl"><tr><th>Level</th><th>Set</th><th>Defence (whole set)</th><th>Whole set costs</th></tr>${O.tiers[style].map(([key, name, lvl]) => {
          const ks = Object.keys(O.slots).map((s) => `${key}_${s}`), def = ks.reduce((a, k) => a + (G.ITEMS[k]?.def || 0), 0), cost = ks.reduce((a, k) => a + (G.outfitShelf(shop).find((r) => r.k === k)?.price || 0), 0);
          return `<tr><td>${lvl}</td><td>${ks.map((k) => H.ico(k)).join("")} <b>${H.esc(name)}</b></td><td>${def}</td><td>${tix(cost)}</td></tr>`; }).join("")}</table>`; };
      const weapons = (shop) => G.outfitShelf(shop).filter((r) => r.kind === "weapon").map((r) => `${nm(r.k)} (${tix(r.price)})`).join(", ");
      return `<p><b>Two outfitters keep stalls out in the world:</b> <b>${H.esc(O.npc.ranger)}</b> dresses archers, in ${areaL(G, H, O.at.ranger.scene)}, and <b>${H.esc(O.npc.mage)}</b> dresses mages, on ${areaL(G, H, O.at.mage.scene)}. Each sells five-piece sets of armour (helm, body, legs, gloves and boots) in five tiers, the weapons of her style, and buys that gear back.</p>
        <h3>What the armour does</h3>
        <p>It has <b>half the defence of plate</b> at the same level, but every piece adds damage for its style, and <b>a whole set is +10%</b>: the body the most, then the legs, the helm and gloves, the boots least. The bonus only counts while you fight in that style: a ranger's set does nothing for a sword or a wand. <b>Archers' pieces also make you faster on your feet</b>, up to <b>6%</b> for a whole set. It needs your Archery or Magic level to wear, and the anvil doesn't reforge it.</p>
        <h3>${H.esc(O.npc.ranger)}: archery</h3>${setTable("ranger")}
        <h3>${H.esc(O.npc.mage)}: magic</h3>${setTable("mage")}
        <h3>Weapons, the expensive way</h3>
        <p>They also sell every bow and quiver, or every wand and Magic Bag, but at a steep price on purpose: making your own with Fletching or Wizardry is far cheaper. Wren: ${weapons("ranger")}.</p><p>Morwenna: ${weapons("mage")}.</p>
        <h3>Reforging</h3>
        <p><b>The armour reforges at an anvil like plate</b>: each piece takes the same bars, and the same Smithing, as the plate piece at its level. See <a data-wiki="guides/smithing">Smithing</a> for the odds. Bows and quivers reforge with their wood, wands with theirs and Magic Bags with spell paper, as they always have.</p>
        <h3>Selling back</h3>
        <p>Each buys her own style's armour and weapons for what Bom would pay: an eighth of the shelf price, and never more than ${tix(G.GEAR_SELL_MAX)} for a piece.</p>`;
    } },
  { id: "fletching", title: "Fletching and archery", icon: "\u{1F3F9}", cat: "Skills",
    body: (G, H) => {
      const rs = Object.values(G.RECIPES).filter((r) => r.skill === "fletching").sort((a, b) => a.lvl - b.lvl);
      const nm = (k) => H.esc(G.ITEMS[k]?.name || k);
      const bows = rs.filter((r) => G.ITEMS[r.out[0]]?.launcher), arrows = rs.filter((r) => G.ITEMS[r.out[0]]?.ammo), quivers = rs.filter((r) => G.ITEMS[r.out[0]]?.pouch);
      const row = (r) => `<tr><td>${r.lvl}</td><td>${H.ico(r.out[0])} ${H.wl(`items/${r.out[0]}`, nm(r.out[0]))}${r.out[1] > 1 ? ` <small>x${r.out[1]}</small>` : ""}</td><td>${r.in.map(([k, n]) => `${n} \u00d7 ${nm(k).toLowerCase()}`).join(" + ")}</td></tr>`;
      return `<p><b>The fletching table stands in the Yard, in the north court beside the furnace and the anvil.</b> Everything here is made at it, except arrowheads, which are <a data-wiki="guides/smithing">smithing</a> at the anvil two tiles away.</p>
      <p><b>The Wild Bench</b> is fletching's Nexus: it stands in the grove in the north-east of the Wilderness, beside the Ancient yew, and fletches everything the table does, <b>${G.NEXUS.mult}&times; as much</b>, for <b>${Math.round((G.NEXUS.xp - 1) * 100)}% more Fletching xp</b>. (That is shafts and arrows: a bow or a quiver still comes out one at a time, and so does the Long Count.) Anyone can find you there.</p>
      <p><b>An arrow is three things from three places.</b> A <b>shaft</b> from any log (a better tree just gives more per log), a <b>head</b> hammered from a bar, and a <b>feather</b> off something with plumage &mdash; one to three, about a third of the time, from a Chicken, Highwayman, Understudy, Angel, Thunder Goose or Fat Lady, so there is a bird for every level. A better tree gives more shafts per log, up to fifty from the Deep Wild's Gallows logs at Fletching 92. Fletching cannot make one on its own, and that is the point.</p>
      <h3>The bow is speed and reach; the arrow is damage</h3>
      <p>Every wood makes a <b>shortbow</b> (quick, reaches ${G.ITEMS.logs_shortbow.launcher.range} tiles) and a <b>longbow</b> (slow, reaches ${G.ITEMS.logs_longbow.launcher.range} and hits harder). The arrow you load adds half its strength to every hit, from +${Math.round(G.ITEMS.bone_arrow.ammo.str * G.AMMO_SHARE)} for bone to +${Math.round(G.ITEMS.singularity_arrow.ammo.str * G.AMMO_SHARE)} for singularity. So the real choice is a good bow with cheap arrows, or a cheap bow and a quiver of the good ones.</p>
      <p><b>A bow with nothing to fire is not a weapon.</b> One arrow is spent per shot, hit or miss.</p>
      <h3>Quivers</h3>
      <p>A quiver wears the <b>offhand</b> &mdash; so a bow is a two-handed choice against a shield &mdash; and holds one kind of arrow in bulk, from ${G.FLETCH.quiverCap[0]} for rough up to ${G.FLETCH.quiverCap.at(-1)} for bogwood. Click arrows in your bag to load it. A bow shoots only what is in the quiver, so when it runs out, load more. Clicking a different kind of arrow swaps them.</p>
      <h3>Gems</h3>
      <p>Four stones turn up in ore, one ore in ${Math.round(1 / G.GEMS[0].drop)} of the kinds below, and each tips the arrows of the metals it comes out of. The <a data-wiki="guides/gems">Gems</a> page lists every rock and where it is.</p>
      <table class="tbl"><tr><th>Gem</th><th>Mined out of</th><th>Tips</th><th>Adds</th></tr>
        ${G.GEMS.map((g) => `<tr><td>${H.ico(g.key)} ${nm(g.key)}</td><td>${g.ores.map((o) => nm(o)).join(", ")}</td><td>${g.tips.map((t) => nm(t)).join(", ")}</td><td>+${g.str}</td></tr>`).join("")}
      </table>
      <h3>The ladder</h3>
      <table class="tbl"><tr><th>Fletching</th><th>Makes</th><th>From</th></tr>${rs.map(row).join("")}</table>
      <p><b>Arrowheads</b> are hammered at the anvil at each metal's own Smithing gate, fifteen to a bar.</p>
      <p><b>Fletching makes it, <a data-wiki="guides/archery">Archery</a> draws it.</b> Every bow, quiver and arrow carries an Archery level to use, which sits at the Fletching level to make it &mdash; except the rough shortbow, the rough quiver and bone arrows, which are Archery 1 and on the Prize Counter's shelf.</p>
      <p><b>The Long Count</b> at 99 wants a singularity core &mdash; the same one-in-two-thousand drop the top melee weapons want &mdash; so the two ladders end on the same chase.</p>`;
    } },
  { id: "agility", title: "Agility", icon: "\u{1F3C3}", cat: "Skills",
    body: (G, H) => !G.HOLD.thrill ? agilityV11(G, H) : `<p><b>The Run is an obstacle course</b>, up a rope ladder in the north of the Yard. You go round it: each obstacle pays, and finishing a full lap pays far more than the parts do.</p>
      <table class="tbl"><tr><th>What</th><th>Gives</th></tr>
        <tr><td>Each obstacle cleared</td><td>12 xp</td></tr>
        <tr><td>Clearing one perfectly</td><td>+10 xp on top</td></tr>
        <tr><td>Finishing a lap</td><td>150 xp, and more when others are running</td></tr>
        <tr><td>Marks picked up on the way</td><td>13 tickets each</td></tr>
      </table>
      <p><b>What it buys is movement speed, everywhere.</b> It climbs steadily with the level &mdash; about <b>+5% at 50</b> and <b>+10% at 99</b> &mdash; and it applies to every step you take for the rest of the game: every walk to a rock, a tree, a fishing spot or the bank.</p>
      <p><b>That is the argument for it.</b> Agility makes nothing and sells nothing, so it looks like the skill you can skip. What it actually does is shorten every other skill you will ever train.</p>
      <p><b>A lap is worth more with company</b>, so it is one of the few things in the game that rewards a crowd rather than tolerating one.</p>
      <p><b>Your best lap is recorded</b>, which is the other reason to keep going round.</p>` },

  /* (2026-09-25) THIS ONE GENERATES ITSELF. Its table quoted seven fish, three wrong heal numbers and a "up to
     34" ceiling, all of which had drifted as the food ladder was fixed and the Carnival's two were smoked. A body
     may be a function of the rules (see the render in eastscape.html), so the numbers now come from SMOKE,
     RECIPES and ITEMS and cannot go stale again. Anything hand-written stays hand-written. */
  { id: "smoking", title: "Smoked fish", icon: "\u{1F41F}", cat: "Skills",
    body: (G, H) => {
      const rows = Object.entries(G.ITEMS)
        .filter(([k, it]) => k.startsWith("s") && it.meal && G.ITEMS[k.slice(1)])
        .map(([k]) => {
          const raw = k.slice(1), sm = Object.values(G.RECIPES).find((r) => r.out[0] === k);
          const cook = Object.values(G.RECIPES).find((r) => r.out[0] === `c${raw}` && r.skill === "cooking");
          const coal = (sm?.in.find(([i]) => i === "charcoal") || [, 1])[1];
          const fx = G.ITEMS[k].meal.fx, says = Object.entries(fx)
            .map(([f, v]) => `+${Math.round(v * 100)}% ${({ rare: "rare drops", tough: "toughness", speed: "speed", tix: "tickets", zdrop: "ZCoin drops", bite: "bite rate" })[f] || f}`)
            .join(" and ");
          return { k, raw, lvl: sm?.lvl ?? 0, cookLvl: cook?.lvl, coal, heal: G.ITEMS[k].heal, says };
        })
        .sort((a, b) => a.lvl - b.lvl);
      const best = Math.max(...rows.map((r) => r.heal));
      return `<p><b>Smoking is cooking with charcoal.</b> ${rows.length} fish can be smoked instead of plainly cooked. A smoked fish heals more, sells for far more, and &mdash; the reason to bother &mdash; gives a twenty-minute buff.</p>
      <p>Do it at <b>any fire or range</b>, with the fish and the charcoal in your bag. You do not switch anything on: the fire always makes the best thing it can, so it smokes while you have charcoal and drops back to plain cooking when you run out.</p>
      <table class="tbl"><tr><th>Smoked</th><th>Smoke at</th><th>Coal</th><th>Heals</th><th>For 20 minutes</th></tr>
        ${rows.map((r) => `<tr><td>${H.ico(r.k)} ${H.wl(`items/${r.k}`, H.esc(G.ITEMS[r.k].name))}</td><td>Cooking ${r.lvl}</td><td>${r.coal}</td><td>${r.heal}</td><td>${H.esc(r.says)}</td></tr>`).join("")}
      </table>
      <p><b>A smoke can spoil.</b> One in ten fails, at every level, and the fish and the charcoal go with it. Cooking the same fish plainly is unaffected. The fire tells you the odds before you start.</p>
      <p><b>Cooking is usually what holds you back, not fishing.</b> A fish comes out of the water long before you can smoke it &mdash; a smoke sits about five levels above its own plain cook.</p>
      <p><b>Nothing here buffs experience</b>, and that is deliberate &mdash; a stacked xp buff would be a multiplier on the one thing the Tower exists to pay. The best smoke heals <b>${best}</b>.</p>`;
    } },
  /* (2026-09-30) GENERATED. The dinners table had four rows when there were seven (the Truffle dinner, the Starcap feast and, in season,
     the pumpkin pie were missing), and it never said an Alchemy potion is a drink. Every meal and drink is read from ITEMS now. */
  { id: "buffs", title: "Food, drinks and luck", icon: "\u{1F37A}", cat: "Going further",
    body: (G, H) => {
      const alch = new Set(Object.values(G.RECIPES).filter((r) => r.skill === "alchemy").map((r) => r.out[0]));
      const smoked = (k) => k.startsWith("s") && !!G.ITEMS[k.slice(1)];
      const from = (k) => { const p = G.prizesOf().find((x) => x.give?.[0] === k), r = Object.values(G.RECIPES).find((x) => x.out[0] === k);
        return p ? `the Prize Counter, ${num(p.price)}` : r ? `${H.esc(G.SKILLS[r.skill]?.name || r.skill)} ${r.lvl}` : "a monster drop"; };
      const meals = Object.entries(G.ITEMS).filter(([k, it]) => it.meal && !smoked(k) && !it.held && (!it.event || G.hwOn())).sort((a, b) => (a[1].heal || 0) - (b[1].heal || 0));
      const drinks = Object.entries(G.ITEMS).filter(([k, it]) => it.drink && !alch.has(k) && !it.held && (!it.event || G.hwOn()));
      const row = ([k, it], w) => `<tr><td>${itemL(G, H, k)}</td>${w ? `<td>${it.heal || "&mdash;"}</td>` : ""}<td>${H.esc(G.fxText((it.meal || it.drink).fx))}</td><td>${(it.meal || it.drink).mins} min</td><td>${from(k)}</td></tr>`;
      const cl = G.ITEMS.clover, sh = G.ITEMS.horseshoe;
      return `<p><b>Eating heals you. Some food also buffs you for a while, and so does a drink.</b> You can have one meal and one drink running at once, so the good combination is a dinner plus a drink, not two dinners: a second meal replaces the first.</p>
      <h3>Meals</h3>
      <table class="tbl"><tr><th>Dish</th><th>Heals</th><th>Gives</th><th>Lasts</th><th>From</th></tr>${meals.map((m) => row(m, true)).join("")}</table>
      <p>The ${H.wl("guides/smoking", "smoked fish")} are meals too, and they heal more than most of these. That page has their buffs.</p>
      <h3>Drinks</h3>
      <table class="tbl"><tr><th>Drink</th><th>Gives</th><th>Lasts</th><th>From</th></tr>${drinks.map((d) => row(d, false)).join("")}</table>
      <p><b>Every ${H.wl("guides/alchemy", "Alchemy")} potion is a drink as well</b>: it takes the drink slot, so a potion replaces a lager and a lager replaces a potion. The salves are the exception: they heal on the spot and take no slot at all.</p>
      <p>Whiskey is the only thing in the game that makes you worse at something. Champagne is the one to drink before a long session outside.</p>
      <h3>Luck</h3>
      <p>A <b>${H.esc(cl.name)}</b> turns up while you fish or gather, and a <b>${H.esc(sh.name)}</b> far more rarely. Click one and your next <b>${cl.luck}</b> (clover) or <b>${sh.luck}</b> (horseshoe) kills or catches are lucky &mdash; a real ZCoin is ${Math.round(G.LUCK.zdrop * 100)}% more likely on each. It counts down by events, not by time, so there is no rush to use it. The Store sells clovers five at a time.</p>
      <p><b>None of this touches the casino.</b> Buffs work outside only; no drink, dinner or clover can move the odds at a table.</p>`;
    } },
  /* (2026-09-30) GENERATED. It said there was no way from tickets to ZCoins; the Prize Counter has traded them in since v107. */
  { id: "zcoins", title: "Finding ZCoins", icon: "\u{1F48E}", cat: "Money",
    body: (G, H) => {
      const F = G.ZDROP.fish, lo = Math.min(...Object.values(F)), hi = Math.max(...Object.values(F)), fishOf = (p) => Object.keys(F).find((k) => F[k] === p), D = G.DEX;
      return `<p><b>Real ZCoins drop in the world.</b> Not tickets &mdash; the actual currency from eastcoin.vip. They are rare on purpose.</p>
      <p><b>Fishing drops them</b> at about <b>one catch in ${num(Math.round(2 / (lo + hi)))}</b>, creeping up slightly with the better fish &mdash; ${an(H.esc((G.ITEMS[fishOf(lo)]?.name || "").replace(/^Raw /, "").toLowerCase()))} is ${oneIn(lo)}, ${an(H.esc((G.ITEMS[fishOf(hi)]?.name || "").replace(/^Raw /, "").toLowerCase()))} ${oneIn(hi)}. It is close enough to flat that you should fish wherever you actually enjoy fishing.</p>
      <p><b>Fighting drops them too</b>, scaled to what you killed, so the deeper maps pay better than the Yard; a Crypt or Pyramid boss's hoard is far likelier than any one kill.</p>
      <p><b>A big one lands about one time in ${Math.round(1 / G.ZDROP.big)}</b>, worth ${G.ZDROP.bigN} of the ordinary find.</p>
      <p>Take a ZCoin to <a data-wiki="npcs/Bom Trady">the Prize Counter</a> and it goes straight onto your real balance on the site.</p>
      <p><b>Or trade tickets in.</b> The same counter turns <b>${num(D.rate)} tickets into 1 ZCoin</b>. Everything that leaves the game for a wallet, found or traded, shares one allowance of ${D.capDay} ZCoins in any 24 hours. It only goes one way: ZCoins never become tickets. See <a data-wiki="guides/tickets">Tickets</a>.</p>
      <p><b>What raises the find rate</b> is the game's own drop buffs &mdash; champagne, a lucky clover or horseshoe &mdash; and nothing else; and no world buff can ever touch the casino's odds. The two are deliberately separate.</p>`;
    } },
  /* (2026-09-30) GENERATED from DEATH. The table stopped at the Trailer Park (the Sands, the Carnival, the Boardwalk and its isles, the
     Valley and the Frozen Reach were missing), and "there is no potion" had been wrong since the cauldron's salves. */
  { id: "dying", title: "Dying", icon: "\u{1F480}", cat: "Starting out",
    body: (G, H) => {
      const rows = Object.entries(G.DEATH).filter(([k]) => G.OPEN.has(k) && G.SCENES[k] && !G.SCENES[k].wikiHide).sort((a, b) => a[1].cap - b[1].cap || a[0].localeCompare(b[0]));
      const free = ["depths", "vault"].filter((k) => G.OPEN.has(k) && !G.DEATH[k] && G.SCENES[k]);
      const salves = Object.values(G.RECIPES).filter((r) => r.skill === "alchemy" && G.ITEMS[r.out[0]]?.heal && !G.ITEMS[r.out[0]].drink).sort((a, b) => a.lvl - b.lvl);
      return `<p><b>You keep everything you are wearing and carrying.</b> Dying costs you tickets, not gear &mdash; there is no gravestone to run back to and nothing to lose permanently. (The Wilderness is the exception; see below.)</p>
      <p><b>What it costs is a share of the tickets on you, capped by where you died.</b> The cap is what matters: the deeper the zone, the more a death stings, but it is never everything. They call it the hospital bill.</p>
      <table class="tbl" data-paged="25"><tr><th>Where</th><th>You lose</th><th>At most</th></tr>${rows.map(([k, d]) => `<tr><td>${areaL(G, H, k)}</td><td>${Math.round(d.share * 100)}%</td><td>${num(d.cap)}</td></tr>`).join("")}</table>
      ${free.length ? `<p><b>${free.map((k) => H.esc(G.SCENES[k].name)).join(" and ")} ${free.length > 1 ? "send" : "sends"} no bill at all.</b></p>` : ""}
      <p><b>The bank will not hold tickets, so spend them before a long trip out</b> and a death costs you almost nothing &mdash; the percentage is of what you are carrying. A ${itemL(G, H, "pot_witch")} (in the Long Night) or the Ferryman's Coin makes a death free.</p>
      <p><b>The Wilderness is different.</b> Other players can attack you there, and nothing waives the bill: a death there takes ${Math.round(G.DEATH.wild.share * 100)}% of the tickets you carry (up to ${G.fmtTix(G.DEATH.wild.cap)}), and if a player killed you, <b>they</b> get it. ${Math.round(G.PVP.drop * 100)}% of the time you also drop one piece of what you are wearing on the ground, and whoever killed you has first claim on it for a minute. In return, a kill there pays more: ${Math.round(G.KILL_MUL.wild * 100 - 100)}% more combat xp and tickets in the Wilderness, ${Math.round(G.KILL_MUL.deep * 100 - 100)}% more in the ${H.wl("areas/deep", "Deep Wild")}.</p>
      <p><b>Eat before you need to.</b> Cooked and smoked fish are most of the healing in the game, and the ${H.wl("guides/alchemy", "cauldron's")} salves heal at once: ${salves.map((r) => `${itemL(G, H, r.out[0])} ${G.ITEMS[r.out[0]].heal}`).join(", ")}. Out of a fight your health creeps back, a point every twenty seconds; in one, nothing comes back on its own, and the fight does not pause while you find something.</p>`;
    } },
  /* (2026-09-30) GENERATED: "three jobs a day, from a pool of seventy" had become six from the fifty-odd that are open. */
  { id: "jobs", title: "Today's jobs", icon: "\u{1F4CB}", cat: "Money",
    body: (G) => {
      const open = G.DAILY.filter((t) => G.OPEN_DAILY.has(t.id)), cash = open.map((t) => t.cash).sort((a, b) => a - b);
      return `<p><b>${Word(G.DAILY_COUNT)} jobs a day, from a pool of ${open.length}</b>, on the task board inside the casino. They reset every day and they are the same ${word(G.DAILY_COUNT)} for you until you claim them.</p>
      <p>They are things you were going to do anyway &mdash; gather fifty logs, catch twenty sardines, kill some number of something &mdash; so the trick is reading them <b>before</b> you go out, not after.</p>
      <p><b>They count themselves.</b> Nothing to start and nothing to hand in: fishing a sardine counts a sardine job wherever you are. You go back to the board only to take the money.</p>
      <p><b>The pool grows with you.</b> Jobs you have no chance at are never handed to you, and the easiest half of what you can do is left out of the draw once you have outgrown it, so what you see is doable today and worth your time.</p>
      <p>Pays in tickets, and scales with what it asked for: from ${num(cash[0])} for the easiest to ${num(cash.at(-1))} for the ones that send you somewhere unpleasant. For the whole server's daily, see <a data-wiki="guides/order">Bronny's order</a>.</p>`;
    } },
  /* (2026-09-30) GENERATED from VIP. It said VIP counted every ticket staked; since v65 it counts tickets EARNED (vipOf reads c.earned). */
  { id: "vip", title: "VIP", icon: "\u{1F451}", cat: "Money",
    body: (G) => `<p><b>VIP is lifetime earnings, not a purchase.</b> It counts every ticket you have ever <b>earned</b> &mdash; kills, trade-ins at the Prize Counter, daily jobs &mdash; so it goes up by playing outside and never goes down. What you bet does not count.</p>
      <p>What it buys is a <b>standing discount at the Prize Counter</b> &mdash; everything Bom sells, permanently cheaper.</p>
      <table class="tbl"><tr><th>Rank</th><th>Tickets earned</th><th>Off at the counter</th></tr>${G.VIP.map((v) => `<tr><td style="color:${v.col}"><b>${v.name}</b></td><td>${v.at ? num(v.at) : "&mdash;"}</td><td>${v.off ? `${Math.round(v.off * 100)}%` : "&mdash;"}</td></tr>`).join("")}</table>
      <p><b>Every ticket counts once</b>, when it comes in, so spending it afterwards costs you nothing here.</p>` },
  /* (2026-09-30) GENERATED. It said tickets could not be given away (they trade), and knew nothing of the Store's bank pages and bag slots. */
  { id: "bank", title: "The bank", icon: "\u{1F3DB}️", cat: "Money",
    body: (G) => {
      const U = G.STORE_UP, B = G.BAG_UPGRADES;
      return `<p><b>A booth holds ${num(G.BANK_MAX)} different items across ${word(G.BANK_PAGES)} pages</b>, and everything in it is safe &mdash; a death never touches your bank. <a data-wiki="guides/store">The Store</a> sells up to ${word(U.bank.max)} more pages, ${U.bank.slots} slots each, so a full bank is ${num(G.BANK_MAX + U.bank.max * U.bank.slots)}.</p>
      <p><b>Click to move one thing; the 1 / 5 / 10 / All selector at the foot decides how many.</b> Or <b>shift-click to move a whole stack</b> in either direction, which is the same gesture the trade window uses.</p>
      <p><b>Sort it</b> by Recent, A&ndash;Z, Value or Amount &mdash; the chips sit under the search box, and your choice is remembered. The header shows what the whole bank is worth, and hovering any stack tells you what that stack is worth.</p>
      <p><b>Deposit bag</b> and <b>Deposit worn</b> empty you out in one click. Neither will take your tickets: the bank never takes tickets from you, and they cannot be dropped either, though you can hand them to another player in a trade. (Tickets the Market pays you do land in the bank, and you can take them out.)</p>
      <p><b>Your bag is the thing worth upgrading.</b> It starts at ${G.INV_MAX} slots. Bom sews on extra pockets &mdash; ${word(B.length)} of them, each dearer than the last, from ${num(B[0])} up to ${num(B.at(-1))} tickets. The button is in the bank as well as at his counter, because "I need more room" is a thought you have with the bank open. The Store adds up to ${word(U.bag.max)} more on top, and a few pets and achievements add their own.</p>
      <p><b>The Market delivers here.</b> Anything you buy, and anything your sell offers earn, lands in your bank whether you are online or not. See <a data-wiki="guides/trading">Trading</a>.</p>`;
    } },
  { id: "trading", title: "Trading and the Market", icon: "\u{1F91D}", cat: "Money",
    body: `<h3>Face to face</h3>
      <p><b>Click another player and offer a trade.</b> Both sides put things up, both sides see exactly what is on the table, and both have to accept. <b>Shift-click offers a whole stack</b> rather than one of a thing.</p>
      <p><b>Tickets can be traded</b>, but nothing else about them changes: they still cannot be banked or dropped.</p>
      <p>The swap is worked out in full on the server before either side is touched, so the old trick of offering something and getting rid of it before the trade completes has nowhere to land.</p>
      <h3>The Market</h3>
      <p><b>The stall in the Yard is an offer book, not a shop.</b> You post what you will sell and at what price; somebody else posts what they will pay. When the two meet it happens &mdash; whether either of you is online.</p>
      <p><b>Everything lands in your bank.</b> What you buy, and what your sales earn, is waiting there next time you log in. Nothing to collect, nothing expires.</p>
      <p><b>The house takes 1% of each sale.</b> That is the only fee, and it is there to stop tickets piling up forever.</p>
      <p><b>It sells out of your bag and your bank together</b>, so you do not have to fetch things before listing them.</p>
      <p><b>Gear cannot be sold to other players yet.</b> A reforged piece belongs to whoever reforged it &mdash; a known limitation and a real project to fix, not an oversight.</p>` },
  { id: "islands", title: "Your island", icon: "\u{1F3DD}️", cat: "Going further",
    body: (G, H) => `<p><b>Charon keeps a cart in the Yard</b>, a few steps out of the casino's front door, and everyone gets an island. It is yours, it keeps growing things while you are logged off, and you decide whether anybody else can visit.</p>
      <p><b>Three sizes, and every one of them is big.</b> You start with the first and buy the others from Charon's cart. A cobbled path runs from the dock up to your cottage, with sand all round the coast. The Far Shore is a second island joined to yours by a bridge off the east side, so it is one walk, not a second trip.</p>
      <table class="tbl"><tr><th>Island</th><th>Costs</th><th>Plots</th><th>Pedestals</th><th>Decor outside</th></tr>
        <tr><td>Island</td><td>&mdash;</td><td>8</td><td>6</td><td>20</td></tr>
        <tr><td>Bigger island</td><td>5,000</td><td>12</td><td>9</td><td>32</td></tr>
        <tr><td>The Far Shore</td><td>20,000</td><td>20</td><td>15</td><td>48</td></tr>
      </table>
      <p>The cottage holds 20 pieces inside. Rugs and paths count as a quarter of a piece.</p>
      <h3>Themes</h3>
      <p><b>A theme changes the whole island: the grass, the beach, the sea and the trees.</b> Buy one at Charon's cart, then choose it at the sign on your island.</p>
      <table class="tbl"><tr><th>Theme</th><th>Costs</th><th>What it looks like</th></tr>
        ${Object.values(G.THEMES).map((t) => `<tr><td>${t.icon} ${t.name}</td><td>${t.price == null ? "not for sale" : t.price ? t.price.toLocaleString() : "free"}</td><td>${t.ex}</td></tr>`).join("")}
      </table>
      <h3>Your cottage</h3>
      <p><b>The Store sells the cottage itself in five other styles</b>: a Stone Manor, a Log Cabin, a Beach Hut, a Witch's House and a Casino Villa. It also sells walls (cream, burgundy, navy, forest green, gold damask) and floors (marble, casino carpet, checkered tiles, flagstone) for inside. Everyone who visits sees them, and you can switch back any time.</p>
      <h3>Yahsmeena's Decor, and the Store's</h3>
      <p><b>Yahsmeena stands outside the cottage and sells furniture for your island and your cottage.</b> Buy a piece from her, then press <b>Decorate</b> and put it where you want it. She buys back at a quarter of what you paid, and a piece can be picked up and moved as often as you like. Her shop also lists the Store's decor, with a button straight to it.</p>
      <p><b>A few pieces do something.</b> The bank chest (10,000) opens your bank on the island. The hatchery hatches eggs, and the cellar ladder takes you down to your mushroom beds.</p>
      <h3>Livestock</h3>
      <p><b>A chicken coop, a cow pen and a fishing cage fill up while you are away</b>, logged in or not. Yahsmeena sells them. Click one on your island to empty it into your bag (anything that doesn't fit goes to the bank). A bubble over it shows how many rounds are waiting, and a gold "!" means it is full.</p>
      <table class="tbl"><tr><th>Piece</th><th>Costs</th><th>Every</th><th>Gives</th><th>Holds</th></tr>
        ${Object.values(G.ISLE_FARM).map((f) => `<tr><td>${f.name}</td><td>${f.price.toLocaleString()}</td><td>${f.ms >= 3600000 ? `${f.ms / 3600000} hour${f.ms === 3600000 ? "" : "s"}` : `${f.ms / 60000} minutes`}</td><td>${f.gives ? f.gives.map(([k, n]) => `${n} ${G.ITEMS[k].name.toLowerCase()}`).join(" + ") : "a fish (sardine, trout or catfish)"}</td><td>${f.cap} rounds</td></tr>`).join("")}
      </table>
      <p>Two of the same kind fill twice as fast, and ${G.FARM_MAX} is the most of each that works. Nothing fills for time before you put it down.</p>
      <h3>Growing things</h3>
      <p><b>Plant a crop and it grows in real time, whether you are online or not.</b> Click an empty plot, pick what to put in it, come back when it is ready. A ripe plot pays several of what you planted, so one crop feeds the next.</p>
      ${SEEDS_NOTE(G)}
      ${cropTable(G, H)}
      <p><b>Farming is background money, not a living.</b> A full set of plots kept going comes to roughly a sixth of what fighting the same zone pays &mdash; it is something that happens while you do something else, which is the whole point of it running while you are logged off.</p>
      <h3>The rest of the island</h3>
      <p><b>Pedestals</b> put an item on display for visitors. The <b>pet pen</b> breeds a pair of pets into a better one.</p>
      <p><b>Open or closed.</b> The island sign decides whether anyone can ferry over. Closing it sends any visitors home.</p>
      <p><b>Type /island in chat</b>, anywhere, to see how long everything on your island has left: crops, mushrooms, the breeding pen, a hatching egg and the livestock.</p>` },
  /* (2026-09-30, the owner's "full wiki rundown") WORLD EVENTS: Shooting Stars, Wanted! and the Jackpot Thief, one each a day. Every number is
     read from EVDAY, SSTAR, STAR_TENT, WANTED and JTHIEF; how they run is eastscape-worker/src/events.js. */
  { id: "events", title: "World events", icon: "\u{1F320}", cat: "Going further",
    body: (G, H) => {
      const E = G.EVDAY, S = G.SSTAR, W = G.WANTED, J = G.JTHIEF, T = G.STAR_TENT, mins = (ms) => Math.round(ms / 60000);
      const hr = (h) => (h % 24 === 0 ? "midnight" : h === 12 ? "noon" : `${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`);
      const names = (list) => list.filter((k) => G.OPEN.has(k) && G.SCENES[k]).map((k) => areaL(G, H, k)).join(", ");
      const tiers = []; for (let t = 9; t >= 1; t--) tiers.push(`<tr><td>${t}</td><td>${t * S.tierLvl}</td><td>${S.frags[t]}${S.wild ? ` (${S.frags[t] * S.wild.mul} in the Wilderness)` : ""}</td><td>${S.xp(t)}</td></tr>`);
      const crates = []; let last = ""; for (let l = 1; l <= 99; l++) { const c = G.starCrate(l), sig = JSON.stringify(c); if (sig !== last) { last = sig; crates.push([l, c]); } }
      const tent = T.stock.map((r) => G.tentRow(r)).map((R) => `<tr><td>${R.give ? itemL(G, H, R.give[0]) : `<b>${H.esc(R.name)}</b>`}</td><td>${num(R.frags)}</td><td>${H.esc(R.ex)}${R.store ? " Worn from the Store once it is yours." : ""}</td></tr>`).join("");
      const bands = ["Low", "Middle", "High"], bandOf = (k) => W.bands.findIndex((b) => b.includes(k));
      const targets = Object.entries(W.targets).filter(([k]) => G.OPEN.has(k) && G.SCENES[k]).flatMap(([k, list]) => list.filter(([t]) => G.MOBS[t]).map(([t, name]) => { const b = bandOf(k);
        return `<tr><td><b>${H.esc(name)}</b></td><td>${mobL(G, H, t)}</td><td>${areaL(G, H, k)}</td><td>${bands[b] || "&mdash;"}</td><td>${num(Math.max(W.minHp[b] || 0, Math.round(G.MOBS[t].hp * W.hpX)))}</td><td>${num(W.bounty[b] || 0)}</td></tr>`; })).join("");
      const hits = (n) => Math.min(J.hits.cap, J.hits.base + J.hits.per * (n - 1));
      return `<p><b>Three things happen in the world every day, once each, at times nobody knows:</b> a Shooting Star falls, a Wanted poster goes up, and the Jackpot Thief robs the slots. CASINO says so in chat when each one starts, a card for it appears under the minimap (click it for the details), and the world map puts a pin on the area it is in. <b>Type /events</b> in chat to hear what is on now and what is still to come today.</p>
      <p><b>When.</b> Between ${hr(E.from)} and ${hr(E.to)}, Chicago time. The ${E.to - E.from} hours are cut into three equal stretches, the three events are dealt into them in a random order, and each takes a minute at least ${E.margin} minutes in from either end of its stretch, so no two ever land within ${Math.round(E.margin * 2 / 60) === 1 ? "an hour" : `${E.margin * 2} minutes`} of each other. All three are open to everyone, and all three pay by what you put in.</p>

      <h3>Shooting Stars</h3>
      <p><b>A warning first.</b> ${mins(S.warnMs)} minutes before it lands, CASINO gives a hint of where: a direction, never the spot (${Object.values(S.scenes).slice(0, 3).map((h) => `"${H.esc(h)}"`).join(", ")}&hellip;). It can come down in ${names(Object.keys(S.scenes))}${S.wild ? `, or one time in ${Math.round(1 / S.wild.chance)} in the Wilderness, "${H.esc(S.wild.hint)}", where every fragment counts double` : ""}. <b>Never in the Yard</b>: it is crowded enough.</p>
      <p><b>Mine it with a pickaxe.</b> A star lands at a tier from 1 to 9, set by the best miner online, and tier N needs <b>Mining ${S.tierLvl}&times;N</b>. Every swing chips a piece off; when a tier's worth is gone it cracks down a tier, and anybody with the lower level can join in. The more people are swinging, the bigger each tier is. It cools and is gone after ${mins(S.lasts)} minutes.</p>
      <table class="tbl"><tr><th>Tier</th><th>Mining</th><th>Star Fragments a swing</th><th>Mining xp a swing</th></tr>${tiers.join("")}</table>
      <p><b>A star gives each person at most ${num(S.cap)} fragments</b>${S.wild ? ` (${num(S.cap * S.wild.mul)} in the Wilderness)` : ""}; keep swinging past that and the Mining xp still counts. About one swing in ${num(Math.round(1 / S.starling))} turns up a ${itemL(G, H, "egg_starling")}, which hatches into a Starling.</p>
      <h4>The Star Tent</h4>
      <p>Star Fragments are spent at the Star Tent on ${areaL(G, H, T.scene)}'s road, and on nothing else.</p>
      <table class="tbl"><tr><th>Buys</th><th>Fragments</th><th>What it is</th></tr>${tent}</table>
      <p><b>What a Star crate holds</b> depends on your Mining level when you open it:</p>
      <table class="tbl"><tr><th>Mining</th><th>Holds</th></tr>${crates.map(([l, c], i) => `<tr><td>${l}${crates[i + 1] ? `&ndash;${crates[i + 1][0] - 1}` : "+"}</td><td>${c.map(([k, n]) => `${n} ${itemL(G, H, k)}`).join(" and ")}</td></tr>`).join("")}</table>

      <h3>Wanted!</h3>
      <p><b>One poster a day on the Bounty Board in the Yard</b>, west of the north road. It names a monster that has been made a menace: a named copy of an ordinary one from that map, with <b>${W.hpX} times the health</b> (never less than a floor for its band), glowing red so it can be found. It has ${mins(W.lasts)} minutes before it gets away.</p>
      <p><b>The band turns over every day</b>: low, middle, high. If nobody online could fight in that day's band when the poster goes up, it drops a band, so a quiet day still gets a poster somebody can take.</p>
      <p><b>Everyone shares it.</b> Anybody can hit it, whoever hit first, and when it falls the bounty is split by damage: your share is your part of the damage, never less than ${Math.round(W.floor * 100)}% of the bounty. At a quarter of its health it turns <b>furious</b> and hits ${Math.round((W.enrage.mul - 1) * 100)}% harder. If it gets away, the poster is stamped ESCAPED and the next bounty is ${Math.round(W.up * 100)}% bigger, up to double.</p>
      <p><b>Take ${W.title} posters</b> (be one of the hunters when it falls) and you earn the title <b>&laquo; Bounty Hunter &raquo;</b>, worn from the Store's Name tab. It is never sold.</p>
      <table class="tbl" data-paged="25"><tr><th>Poster</th><th>Is really</th><th>Where</th><th>Band</th><th>Health</th><th>Bounty</th></tr>${targets}</table>

      <h3>The Jackpot Thief</h3>
      <p><b>A goblin grabs a sack of the slots' Jackpot and runs.</b> The sack holds <b>${num(J.sack.min)} to ${num(J.sack.max)} tickets</b>: ${Math.round(J.sack.share * 100)}% of it is the Jackpot's, and the house puts in the rest. He turns up on a map with people on it, never the Yard.</p>
      <p><b>He runs from people.</b> Get close and he makes for open ground; corner him and he vaults clear. He does not fight back, and he counts <b>hits, not damage</b>: with one of you on him he takes ${J.hits.base} hits, and every other person who joins in adds ${J.hits.per}, up to ${J.hits.cap} (${hits(1)} for one of you, ${hits(5)} for five). Every ${J.dizzy.every} hits he sees stars for ${J.dizzy.ms / 1000} seconds and stands still.</p>
      <p><b>Every hit spills ${Math.round(J.spill * 1000) / 10}% of the sack</b> onto the ground as tickets anybody can pick up, for a minute, until the sack is down to a fifth. <b>That last fifth goes to whoever lands the last hit.</b></p>
      <p><b>He hops.</b> Every minute he dives down a hole and comes up on another map with people on it (${names(J.scenes)}), and CASINO says where. After ${J.hops} hops he is gone for good, and the Jackpot gets back what it lent (as far as the sack still holds it); the house's part is gone with him.</p>`;
    } },
  /* (2026-09-30) CHAT COMMANDS, drawn from G.COMMANDS: /help in the game and this page read the same list, so a command added there is
     documented in both places at once. */
  { id: "commands", title: "Chat commands", icon: "\u{1F4AC}", cat: "Starting out",
    body: (G, H) => {
      const cmds = G.COMMANDS.filter((c) => !c.season || G.hwOn());
      return `<p><b>Type them in the chat box</b> (press <kbd>T</kbd> or <kbd>Enter</kbd> to open it) and press Enter. <b>Only you see the answer</b>, so they are safe to use in a crowded room; the one exception is /roll, which is for the people around you. <b>/help</b> lists them all in the game.</p>
      <table class="tbl"><tr><th>Command</th><th>What it does</th><th>Try</th></tr>${cmds.map((c) => `<tr><td><b>${H.esc(c.c)}</b>${c.args ? ` <i>${H.esc(c.args)}</i>` : ""}${c.also?.length ? `<br><small>or ${c.also.map((a) => H.esc(a)).join(", ")}</small>` : ""}</td><td>${H.esc(c.ex)}</td><td>${(c.eg || [c.c]).map((e) => `<kbd>${H.esc(e)}</kbd>`).join(" ")}</td></tr>`).join("")}</table>
      <h3>/find says where; the wiki says what</h3>
      <p><b>/find</b> is for when you know what you want and not where it is. Give it an item, a monster, a place, a person, a station like a furnace, or a skill you want to train, and it tells you where in the world to go and <b>the way there from where you are standing</b>: which edge of each map to walk off, and every door, ladder, rowboat or cart on the way. Asked about an item, it lists the rocks, trees, water and monsters it comes from (nearest first), where it is made and who sells it; asked about a skill, where to train it, rung by rung. The wiki is the other half: what a thing is, what it drops, what it is worth. <b>/wiki</b> opens the page for whatever you type after it.</p>
      <p>If more than one thing matches, it answers the best match and names the close seconds; if nothing does, it suggests what you might have meant. /where does the same.</p>`;
    } },
  /* (2026-09-30) THE STORE, read from STORE / STORE_TABS / STORE_LOOKS / priceOf. The Star Tent's (`frags`), the Long Night's (`corn`) and the
     earned ones are not for sale here and are left out; the cards are held. */
  { id: "store", title: "The Store", icon: "\u{1F6CD}️", cat: "Money",
    body: (G, H) => {
      const sale = (it) => !it.frags && !it.earned && !it.corn && !it.card && it.price != null && G.STORE_TABS[it.tab];
      const all = Object.values(G.STORE).filter(sale), of = (tab, kind) => all.filter((it) => it.tab === tab && (!kind || it.kind === kind));
      const price = (it) => { const p = G.priceOf(it); return p === it.price ? num(p) : `<s>${num(it.price)}</s> ${num(p)}`; };
      const facts = (it) => (it.facts || []).map((f) => `${H.esc(f[0])}: ${f.length > 2 ? `${H.esc(f[1])} &rarr; <b>${H.esc(f[2])}</b>` : H.esc(f[1])}`).join("; ");
      const rowT = (list, desc = (it) => H.esc(it.lead || it.ex)) => list.length ? `<table class="tbl"${list.length > 25 ? ' data-paged="25"' : ""}><tr><th>Item</th><th>Tickets</th><th>What it is</th></tr>${list.map((it) => `<tr><td><b>${H.esc(it.name)}</b></td><td>${price(it)}</td><td>${desc(it)}</td></tr>`).join("")}</table>` : "";
      const withFacts = (it) => `${H.esc(it.lead || it.ex)}${it.facts ? `<br><small>${facts(it)}</small>` : ""}`;
      const decorIn = (k) => of("decor", "decor").filter((it) => G.STORE_DECOR?.[it.dk]?.in === k);
      const L = G.LOOK_GROUPS || {}, NG = [["title", "Titles"], ["col", "Name colours"], ["fx", "Name effects"], ["icon", "Badges"], ["frame", "Frames"]];
      const R = G.RAID?.horn;
      return `<p><b>The Store sells things with tickets that the Prize Counter does not</b>: boosts for the whole server, looks, decor, pet skins and eggs, and more room. Open it with the <b>Store</b> button at the top of the screen. Everything is bought once and is yours for good (the boosts and eggs are used up), and anything you can wear you switch on and off from the Store's own window, trying it on first.</p>
      <p>Tickets only: nothing here takes ZCoins, and nothing here changes the odds at a table.</p>
      <h3>Boosts</h3>
      <p>The two 2X potions are for the whole server, for ${Math.round(G.DOUBLE.ms / 60000)} minutes, in your name; one of each can run at a time. The loupes change the Gem Sorter's odds (see ${H.wl("guides/gembag", "the gem bag and the Gem Sorter")}).</p>
      ${rowT(of("boost"), withFacts)}
      <h3>World</h3>
      <p>Set off where you are standing, for everyone in that area; one show at a time in any one place. The <b>War Horn</b> calls ${H.wl("guides/raid", "the Yard raid")} in your name${R ? `: it needs ${R.minOnline} people online, and there are ${Math.round(R.gapMs / 3600000)} hours between raids` : ""}.</p>
      ${rowT(of("world"), withFacts)}
      <h3>Effects</h3>
      <p>Worn one of each kind at a time, seen by everyone.</p>
      ${Object.entries(L).map(([k, l]) => { const list = of("looks", k); return list.length ? `<h4>${H.esc(l)}</h4>${rowT(list)}` : ""; }).join("")}
      <h3>Name</h3>
      <p>How your name looks over your head and in chat. <b>Your own title</b> is any ${G.TITLE_MAX || 20} characters you like, checked for anything that should not be there.</p>
      ${NG.map(([k, l]) => { const list = of("name", k); return list.length ? `<h4>${l}</h4>${rowT(list)}` : ""; }).join("")}
      <h3>Decor</h3>
      <p>For ${H.wl("guides/islands", "your island")}: put a piece down with <b>Decorate</b>. The cottage styles, walls and floors change the cottage itself, and everyone who visits sees them.</p>
      ${[["cot", "Cottage styles"], ["wall", "Cottage walls"], ["floor", "Cottage floors"]].map(([k, l]) => { const list = of("decor", k); return list.length ? `<h4>${l}</h4>${rowT(list)}` : ""; }).join("")}
      ${[["isle", "For your island"], ["home", "For your cottage"]].map(([k, l]) => { const list = decorIn(k); return list.length ? `<h4>${l}</h4>${rowT(list)}` : ""; }).join("")}
      <h3>Pets</h3>
      <p><b>A skin is only a look.</b> Your pet out wears it; its bonuses, its name and its rank stay exactly as they were, and a Greater or Legendary pet keeps its blue or orange glow. One skin at a time, switched any time. <b>An egg</b> is the real thing: hatch it in a hatchery on your island (see ${H.wl("guides/breeding", "Breeding")}).</p>
      <h4>Skins</h4>${rowT(of("pets", "pskin"), (it) => H.esc(it.ex))}
      <h4>Eggs</h4>${rowT(of("pets", "give"), withFacts)}
      <h3>Upgrades</h3>
      <p>Room. Each one bought again adds one more, up to its limit: bank pages (${G.STORE_UP.bank.slots} slots each, up to ${G.STORE_UP.bank.max} more), quick slots (up to ${G.STORE_UP.quick.max} more, on keys 5 to ${4 + G.STORE_UP.quick.max}) and bag slots (up to ${G.STORE_UP.bag?.max ?? 5} more, on top of Bom's).</p>
      ${rowT(of("extra"), withFacts)}
      <p><b>Not sold here:</b> the Star Tent's trail, glow and title cost Star Fragments (see ${H.wl("guides/events", "World events")}), and a few titles are earned, never sold.</p>`;
    } },
  /* (2026-09-30) THE YARD RAID, read from RAID and the raid's monsters; how it runs is eastscape-worker/src/raid.js. */
  { id: "raid", title: "The Yard raid", icon: "\u{1F9CA}", cat: "Going further",
    body: (G, H) => {
      const R = G.RAID, M = G.MOBS, boss = M[R.boss.t], mins = (ms) => Math.round(ms / 60000), secs = (ms) => Math.round(ms / 100) / 10;
      const kinds = [...new Set([...R.wave.kinds, ...R.last.kinds].map(([t]) => t))].filter((t) => M[t]).sort((a, b) => M[a].lvl - M[b].lvl);
      const CLOSES = { counter: "Bom's Prize Counter", cashout: "the cashier", eggtrade: "Nestor's egg trade", ex: "Livia's Exchange", hw: "Hexa's Night Market" };
      const F = R.freeze;
      return `<p><b>${H.esc(boss.name)}, the Frost Jarl's war-chief, comes down from the north to sack the Yard</b>, with waves of raiders behind him. Everyone in the game can fight it, and everyone who does shares the spoils. Lose, and the Yard's stalls are boarded up for a while.</p>
      <h3>How it starts</h3>
      <p>An admin can call one, or anybody can blow <b>the War Horn</b> from ${H.wl("guides/store", "the Store")}: it needs at least ${R.horn.minOnline} people online, not while the Pumpkin King is up, another raid is on or the Yard is still sacked, and there are ${Math.round(R.horn.gapMs / 3600000)} hours between raids however they start.</p>
      <p><b>A ${mins(R.warnMs)}-minute warning.</b> CASINO counts it down in chat every minute and again at 30 seconds, so there is time to come back from wherever you are and eat first.</p>
      <h3>The fight</h3>
      <p><b>It all happens on the west bank.</b> Nothing of the raid crosses the river into the Yard's court: no raider walks over it, chases anybody over it or hits anybody on the far side. The court, the casino door and the shops behind it are safe ground to step back to.</p>
      <p><b>${H.esc(boss.name)}</b> comes through the north gate, level ${boss.lvl}, and his health is set when he arrives: ${num(R.hp.base)}, plus ${num(R.hp.per)} for every player online, never more than ${num(R.hp.cap)}. A busy server gets a bigger fight. Anyone who hurts him shares his drops, like any open boss.</p>
      <p><b>Waves</b> come through the north and west gates every ${mins(R.waveEvery)} minutes: up to ${R.wave.base} raiders standing at once, plus one for every ${R.wave.perPlayers} players online, never more than ${R.wave.cap}. They are low enough that a new player has something to fight:</p>
      <table class="tbl"><tr><th>Raider</th><th>Level</th><th>Health</th></tr>${kinds.map((t) => `<tr><td>${mobL(G, H, t)}</td><td>${M[t].lvl}</td><td>${num(M[t].hp)}</td></tr>`).join("")}<tr><td><b>${mobL(G, H, R.boss.t)}</b></td><td>${boss.lvl}</td><td>${num(R.hp.base)} and up</td></tr></table>
      <p><b>The last wave.</b> When ${H.esc(boss.name.replace(/^The /, "the "))} is down to ${Math.round(R.last.at * 100)}% he roars for his huscarls, and ${R.last.count} come through the gates at once, over the ordinary cap. The end of the fight is the hardest part of it.</p>
      <p><b>Deep Freeze.</b> Every ${F.every[0] / 1000} to ${F.every[1] / 1000} seconds he picks among the people who have hurt the raid and stand within ${F.range} tiles of him: one, plus one more for every ${F.perPlayers} of them, at most ${F.cap}. Each is locked in ice for ${secs(F.ms)} seconds (no walking, no acting, no swinging) and loses ${Math.round(F.hit * 100)}% of their health. Spread out, and keep your health up.</p>
      <h3>Win or lose</h3>
      <p><b>Put him down inside ${mins(R.lasts)} minutes and the Yard is saved.</b> Everybody who hurt anything of the raid is paid from a pool of ${num(R.pay.pool)} tickets plus ${num(R.pay.per)} for every one of them, split by share of the damage, never less than ${num(R.pay.floor)} each. On top of that, his own drops:</p>
      ${chaseDrops(G, H, [R.boss.t, ...kinds])}
      <p><b>Run out of time and the Yard is sacked</b> for ${mins(R.sackMs)} minutes: ${R.closes.map((k) => CLOSES[k] || k).join(", ")} are boarded up until it passes. Nobody loses anything they own.</p>`;
    } },
  /* (2026-09-30) THE FROZEN REACH: the mages' country. FROZEN_MAPS, BANDS, MAGE_BAND/MAGE_FLOOR, COLD, the wards, WYRM and the maps' own monsters. */
  { id: "frozen", title: "The Frozen Reach", icon: "❄️", cat: "Going further",
    body: (G, H) => {
      const maps = (G.FROZEN_MAPS || []).filter((k) => G.SCENES[k] && G.OPEN.has(k)), Wy = G.WYRM, C = G.COLD;
      if (!maps.length) return `<p>The Frozen Reach is not open yet.</p>`;
      const mobs = [...new Set(maps.flatMap((k) => (G.SCENES[k].mobs || []).map(([t]) => t)))];
      const wards = Object.entries(G.ITEMS).filter(([, it]) => it.ward === "frost" && !it.held).map(([k, it]) => {
        const r = Object.values(G.RECIPES).find((x) => x.out[0] === k), shop = G.OUTFIT ? ["ranger", "mage"].map((s) => [s, G.outfitShelf(s).find((x) => x.k === k)]).filter(([, x]) => x) : [];
        const how = r ? `${H.esc(G.SKILLS[r.skill]?.name || r.skill)} ${r.lvl} at the anvil: ${r.in.map(([x, n]) => `${n} ${itemL(G, H, x)}`).join(", ")}` : shop.length ? `${shop.map(([s]) => H.esc(G.OUTFIT.npc[s])).join(" or ")}, ${num(shop[0][1].price)} tickets` : "a drop: see below";
        return `<tr><td>${itemL(G, H, k)}</td><td>${H.esc(it.slot)}</td><td>${it.req ? `${H.esc(G.SKILLS[it.req.skill]?.name || it.req.skill)} ${it.req.lvl}` : "anyone"}</td><td>${how}</td></tr>`; }).join("");
      const b = maps.map((k) => G.BANDS[k]).filter(Boolean), jarl = G.MOBS.frostjarl, wyrm = G.MOBS.icewyrm;
      const hr = (h) => (h % 24 === 0 ? "midnight" : h === 12 ? "noon" : `${h > 12 ? h - 12 : h} ${h >= 12 ? "PM" : "AM"}`);
      return `<p><b>North of ${areaL(G, H, "cloud")}: ${maps.map((k) => areaL(G, H, k)).join(" and, north of it, ")}.</b> Ice, snow and the giants' country, levels ${b.length ? `${Math.min(...b.map((x) => x[0]))} to ${Math.max(...b.map((x) => x[1]))}` : "100 and up"}. It is a <b>mage's country</b>: Combat stops at 99, so what opens it is a wand and <b>Magic ${G.MAGE_BAND?.[maps[0]] ?? 60}</b>. Here a spell lands at least ${Math.round((G.MAGE_FLOOR?.[maps[0]] ?? 0.5) * 100)}% of the time whatever the monster's defence, almost everything takes more from spells and less or nothing from swords and arrows, and the ice creatures are weak to fire.</p>
      <h3>The cold</h3>
      <p><b>Without a frost ward the cold takes ${C.dmg} health every ${C.every / 1000 === 1 ? "second" : `${C.every / 1000} seconds`}</b> on every map of the Reach, and it does not stop. Any one piece with the frost on it does the whole job, so the price is the slot it takes.</p>
      <table class="tbl"><tr><th>Ward</th><th>Slot</th><th>Wear at</th><th>How to get it</th></tr>${wards}</table>
      <p>The two made wards want frost shards and yeti pelts, which ${H.wl("guides/raid", "the Yard raid")} drops, so the raid comes first and the north second; the plain charm is for anyone who has not got there yet.</p>
      <h3>What lives there</h3>
      ${mobTable(G, H, maps, G.MOBS.icewyrm ? [["icewyrm", Wy?.scene || maps[0]]] : [])}
      <p><b>The Frost Jarl</b> holds the high ice shelf at the top of the Frostspire: level ${jarl?.lvl}, ${num(jarl?.hp || 0)} health, only a spell reaches him, and anyone who hurts him shares the kill.</p>
      ${wyrm && Wy ? `<p><b>The Ice Wyrm</b> sleeps under the Frozen Reach's lake and comes up <b>once a day</b>, at a minute nobody knows between ${hr(Wy.fromHour)} and ${hr(Wy.toHour)} Chicago time, and stays ${Math.round(Wy.stays / 60000)} minutes. Level ${wyrm.lvl}, ${num(wyrm.hp)} health, spells only, and it breathes ice six tiles. <b>/bosses</b> in chat says whether it is up.</p>` : ""}
      <h3>Gathering</h3>
      ${gatherTable(G, H, maps)}
      <h3>Drops worth knowing</h3>
      ${chaseDrops(G, H, [...mobs, ...(wyrm ? ["icewyrm"] : [])])}`;
    } },
  /* (2026-09-30) THE PRIMEVAL VALLEY: the archers' country, three maps north of the Trailer Park. BANDS, ARCH_BAND/ARCH_FLOOR, MOB_GOLD. */
  { id: "valley", title: "The Primeval Valley", icon: "\u{1F996}", cat: "Going further",
    body: (G, H) => {
      const maps = (G.VALLEY_MAPS || ["valley", "valley_ridge", "valley_lair"]).filter((k) => G.SCENES[k] && G.OPEN.has(k));
      if (!maps.length) return `<p>The Primeval Valley is not open yet.</p>`;
      const mobs = [...new Set(maps.flatMap((k) => (G.SCENES[k].mobs || []).map(([t]) => t)))], gold = Object.entries(G.MOB_GOLD || {});
      const rex = G.MOBS.rex, mat = G.MOBS.matriarch;
      return `<p><b>North of ${areaL(G, H, "trailer")}, three maps climb north: ${maps.map((k) => `${areaL(G, H, k)} (${gateText(G, k)})`).join(", then ")}.</b> Cavemen, sabretooths, mammoths, raptors and pterodactyls, and most of them up on ledges and plateaus that only an arrow reaches.</p>
      <p><b>It is a bow's country.</b> A bow and <b>Archery ${G.ARCH_BAND?.[maps[0]] ?? 40}</b> opens all three whatever your Combat (and the last one starts past Combat's 99, so it is the only way in there). An arrow here lands at least ${Math.round((G.ARCH_FLOOR?.[maps[0]] ?? 0.5) * 100)}% of the time whatever the monster's defence, so an archer in the 40s can do real work; the flyers and the big beasts take far more from arrows and nothing at all from a sword.</p>
      ${mobTable(G, H, maps, gold.map(([, g]) => [g.t, maps.find((k) => (G.SCENES[k].mobs || []).some(([t]) => G.MOB_GOLD[t]?.t === g.t)) || maps[0]]))}
      ${mat ? `<p><b>The Mammoth Matriarch</b> stands on the great plateau of ${areaL(G, H, "valley")}: level ${mat.lvl}, ${num(mat.hp)} health, arrows only, and everyone who hurts her shares the kill.</p>` : ""}
      ${rex ? `<p><b>Old Rex</b> sits on his throne on the high plateau of ${areaL(G, H, "valley_lair")}: level ${rex.lvl}, ${num(rex.hp)} health, and only arrows reach him.</p>` : ""}
      ${gold.map(([b, g]) => `<p><b>The ${H.esc(G.MOBS[g.t]?.name || g.t)}.</b> One ${H.esc(G.MOBS[b]?.name.toLowerCase() || b)} in ${num(g.odds)} comes back gilded instead. Everything it drops is worth ten times the plain one, and it is the likeliest thing in the valley to drop a ${itemL(G, H, "raptor_ring")}.</p>`).join("")}
      <h3>Gathering</h3>
      ${gatherTable(G, H, maps)}
      <p>Cycad is the best wood a fletcher can use, and pterodactyl sinew strings its bows: see ${H.wl("guides/fletching", "Fletching")}.</p>
      <h3>Drops worth knowing</h3>
      ${chaseDrops(G, H, [...mobs, ...gold.map(([, g]) => g.t)])}`;
    } },
  /* (2026-09-30) THE BOARDWALK and its isles, the rowboat chain, Captain Claw and his chest (CLAW_CHEST). */
  { id: "boardwalk", title: "The Boardwalk", icon: "\u{1F980}", cat: "Going further",
    body: (G, H) => {
      const isles = (G.BW_ISLES || []).filter((k) => G.SCENES[k] && G.OPEN.has(k)), maps = ["boardwalk", ...isles].filter((k) => G.SCENES[k] && G.OPEN.has(k));
      if (!maps.length) return `<p>The Boardwalk is not open yet.</p>`;
      const mobs = [...new Set(maps.flatMap((k) => (G.SCENES[k].mobs || []).map(([t]) => t)))], K = G.CLAW_CHEST, claw = G.MOBS.captainclaw;
      const rng = (n) => (Array.isArray(n) ? `${n[0]}&ndash;${n[1]}` : n);
      return `<p><b>A drowned seaside market west of ${areaL(G, H, "carnival")}</b>: a beach with palms, the stalls on a stone plaza, piers out over the water, and a <b>rowboat</b> at the end of each island that goes to the next, or back to the last.</p>
      <table class="tbl"><tr><th>Map</th><th>Monsters</th><th>To start a fight</th><th>To fish</th></tr>${maps.map((k) => { const b = G.BANDS[k]; return `<tr><td>${areaL(G, H, k)}</td><td>${b ? `${b[0]}&ndash;${b[1]}` : "&mdash;"}</td><td>${gateText(G, k) || "&mdash;"}</td><td>${G.FISH_BAND?.[k] != null ? `Fishing ${G.FISH_BAND[k]}` : b ? `Fishing ${b[0]}` : "&mdash;"}</td></tr>`; }).join("")}</table>
      <p><b>Bring a bow or a wand.</b> The gulls take nothing from a sword and the Kraken Arms next to nothing, and they sit where only a shot reaches; the Clawhands and the captain shrug off most of an arrow.</p>
      ${mobTable(G, H, maps)}
      ${claw ? `<h3>Captain Claw</h3>
      <p>He holds <b>Skull Isle</b>, the last island the rowboats reach: level ${claw.lvl}, ${num(claw.hp)} health, weak to storm, and arrows barely scratch the claw. Anyone who hurts him shares the kill. He drops a ${itemL(G, H, "singularity_core")} about ${oneIn((claw.drops.find(([k]) => k === "singularity_core") || [, , 0.02])[2]).replace(/^1/, "one")} kills, and he is the only thing that drops ${itemL(G, H, "clawgrip")}.</p>
      ${K ? `<p><b>The chest he sits on</b> opens for everyone who put him down, once each per kill: ${num(K.tickets[0])} to ${num(K.tickets[1])} tickets, and ${K.items.map(([k, n, p]) => `${rng(n)} ${itemL(G, H, k)}${p != null && p < 1 ? ` (${Math.round(p * 100)}% of the time)` : ""}`).join(", ")}.</p>` : ""}` : ""}
      <h3>Gathering</h3>
      ${gatherTable(G, H, maps)}
      <h3>Drops worth knowing</h3>
      ${chaseDrops(G, H, mobs)}`;
    } },
  /* (2026-09-30) THE DEPTHS OF THE MOUNTAIN: the style guards (guardText), the Deepwarden and his heart. */
  { id: "depths", title: "The Depths of the Mountain", icon: "⛰️", cat: "Going further",
    body: (G, H) => {
      if (!G.SCENES.depths || !G.OPEN.has("depths")) return `<p>The Depths of the Mountain are not open yet.</p>`;
      const mobs = [...new Set((G.SCENES.depths.mobs || []).map(([t]) => t))], D = G.MOBS.deepwarden, gate = gateText(G, "depths"), lv = mobs.map((t) => G.MOBS[t].lvl);
      const ex = G.SCENES.depths.exits || {}, SIDE = { n: "north", s: "south", e: "east", w: "west" };
      return `<p><b>Ledges of mossy rock over a bottomless drop</b>, between ${Object.entries(ex).filter(([, k]) => G.SCENES[k]).map(([s, k]) => `${areaL(G, H, k)} (${SIDE[s] || s})`).join(" and ")}. Monsters ${Math.min(...lv)} to ${Math.max(...lv)}, and ${gate ? `you need ${gate} to start a fight` : "no level gate on starting a fight: nothing stops you, and nothing down there is gentle"}.</p>
      <p><b>Most monsters here shrug off a whole fighting style</b>, and they hit 40 to 60% harder than the Vault's at the same level. Read the "Takes" column before you pick a fight, and come with the right weapon: a sword does nothing to a wisp over the drop, arrows shatter on the crystal ogres, and the iron ogre lets through Void magic and very little else.</p>
      ${mobTable(G, H, ["depths"])}
      ${D ? `<h3>The Deepwarden</h3>
      <p>The mountain's keeper: level ${D.lvl}, ${num(D.hp)} health, and everyone who hurts him shares the kill. Below ${Math.round((D.enrage?.at || 0.35) * 100)}% he plants his greatsword and hits ${Math.round(((D.enrage?.mul || 1.4) - 1) * 100)}% harder. Bring friends.</p>
      <p><b>The chase is ${itemL(G, H, "deepheart")}</b>, one Deepwarden in ${Math.round(1 / ((D.drops || []).find(([k]) => k === "deepheart")?.[2] || 0.01))}: a ring that doubles how often a jewel turns up in the rock. He also has ${itemL(G, H, "deep_sigil")} and, now and then, the ${G.PETS.potboy ? H.wl("pets/potboy", "Pot Boy") : "Pot Boy"} at his heel.</p>` : ""}
      <h3>Mining</h3>
      ${gatherTable(G, H, ["depths"])}
      <p>The abyss crystal goes to the jewellers, and the veins are the richest gem rock in the game.</p>
      <h3>Drops worth knowing</h3>
      ${chaseDrops(G, H, mobs)}`;
    } },
  /* (2026-09-30) THE GREAT PYRAMID, from eastscape-pyramid-rules.js (H.PYR when the page hands it over, PYR_T otherwise; the wiki test holds
     PYR_T to the file). The chest's Coilling chance is worked out from its own table, not typed. */
  { id: "pyramid", title: "The Great Pyramid", icon: "\u{1F40D}", cat: "Going further",
    body: (G, H) => {
      const P = H.PYR?.PYRAMID || PYR_T, T = P.tiers[1], L = P.loot, c = P.coil, bu = P.burrow;
      const mobs = H.PYR?.mobs ? Object.entries(H.PYR.mobs).map(([t, m]) => [t, m.lvl, m.name]) : P.mobs;
      const petClear = coilChance(P);
      const hp = (n) => Math.round((0.6 + 0.1 * n * n) * 100) / 100, venom = G.ITEMS.serpentvenom?.name || "Serpent venom";
      const brew = Object.values(G.RECIPES).find((r) => r.in.some(([k]) => k === "serpentvenom"));
      return `<p><b>The pyramid on the eastern skyline of ${areaL(G, H, "sands")} is a party dungeon</b>, like ${H.wl("guides/crypt", "the Crypt")} and built the other way up: ${word(P.party[0])} to ${word(P.party[1])} of you pay an ante, get a private copy of the tomb, and climb.</p>
      <table class="tbl"><tr><th>Door opens at</th><th>The fight wants</th><th>Ante each</th><th>A clear pays each</th></tr><tr><td>Combat ${T.lvl}</td><td>about Combat ${T.rec}</td><td>${num(T.ante)}</td><td>${num(T.pay)}, in the chest</td></tr></table>
      <p><b>The door and the fight are different numbers</b>, as in the Crypt: at Combat ${T.lvl} you land about one swing in ten on the boss, and around ${T.rec} about half. It pays fewer tickets than the Black Crypt on purpose: the Crypt is where you go for tickets, and this is where you go for things.</p>
      <h3>Up through the chambers</h3>
      <p>You come in at the base and work <b>up</b> through four chambers, each narrower than the last, to the burial chamber at the top. A chamber's stone door grinds open when it is clear. The burial chamber opens at a lever, once everybody still alive is in front of it, and a chest on the way up is your bank, to restock. <b>The first chambers are never quite the same twice</b>: a run's monsters there come out up to ${Math.round(P.jitter * 100)}% softer or harder. The burial chamber is never changed.</p>
      <table class="tbl"><tr><th>Monster</th><th>Level</th></tr>${mobs.map(([t, lvl, name]) => `<tr><td>${t === "squeeze" ? `<b>${H.esc(name)}</b> (the boss)` : H.esc(name)}</td><td>${lvl}</td></tr>`).join("")}</table>
      <h3>The Squeeze</h3>
      <p>A giant serpent at the apex, behind four Risen Pharaohs at the chamber's mouth: you fight the pharaohs first, and it only reaches for you once you are within ${c.reach} tiles. Its health scales with the party: with ${P.party[0]} of you it has its plain ${num(G.MOBS.squeeze?.hp || H.PYR?.mobs?.squeeze?.hp || 4200)}, with 3 about ${hp(3)}&times;, with 4 about ${hp(4)}&times;.</p>
      <p><b>The coil.</b> About every ${Math.round(c.everyMs / 1000)} seconds, after a ${Math.round(c.warnMs / 1000)}-second warning, it takes hold of one of you. That player cannot move and bleeds ${Math.round(c.hurt * 100)}% of their health a second, and cannot free themselves: the grip breaks when <b>the rest of the party</b> does ${Math.round(c.breakFrac * 100)}% of the Squeeze's health to it, or after ${Math.round(c.maxMs / 1000)} seconds. So when somebody is grabbed, everybody else drops what they are doing and hits the snake.</p>
      <p><b>The burrow.</b> At ${bu.at.map((x) => `${Math.round(x * 100)}%`).join(" and ")} of its health it goes under the sand for ${Math.round(bu.downMs / 1000)} seconds and comes up somewhere else in the chamber. Nobody gets to park in a corner.</p>
      <h3>The hoard</h3>
      <p>When the Squeeze dies, everybody who earned the clear opens <b>their own</b> roll: the clear's tickets, <b>${L.venom[0]} to ${L.venom[1]} ${H.esc(venom.toLowerCase())}</b> every time, then ${L.rolls[0][0] - 1} to ${L.rolls.at(-1)[0] - 1} more things: scarab shells, cobra fangs, drinks, dinners, clovers, casino chips, a horseshoe, now and then a piece of buff gear, and rarely the ${G.PETS.coilling ? H.wl("pets/coilling", "Coilling") : "Coilling"}, a pet that comes from nowhere else (about one clear in ${Math.round(1 / petClear)}).</p>
      ${brew ? `<p><b>The venom is the reason to come.</b> It exists nowhere else, and it is what ${itemL(G, H, brew.out[0])} is brewed from, at Alchemy ${brew.lvl}: one of the best potions in the game.</p>` : ""}
      <p><b>${Word(P.runsPaid)} paid clears a Chicago day</b> each. After that a clear pays ${Math.round(P.lateShare * 100)}%, and its chest has ${L.lateRolls} rolls with no gear or pet in them. Anybody who did under ${Math.round(P.fullShare * 100)}% of the boss's damage gets half pay. Leaving the game does not leave the party: your place is held for three minutes.</p>`;
    } },
  /* (2026-09-30) THE CASINO'S BACK ROOMS: the Fight Pit (FIGHTS; the ticket side is eastscape-worker/src/pit.js), the Picture House
     (eastscape-screen.js) and the Roulette Room (eastcoin.vip's own PvP table). */
  { id: "rooms", title: "The casino's back rooms", icon: "\u{1F6AA}", cat: "Starting out",
    body: (G, H) => {
      const F = G.FIGHTS, C = G.CASINO, pool = F.pool.filter((t) => G.MOBS[t]).map((t) => G.MOBS[t]), lv = pool.map((m) => m.lvl);
      return `<p><b>Three doors in the casino's back wall</b> lead to rooms that are not tables on the floor.</p>
      <h3>The Fight Pit</h3>
      <p><b>Through the door marked FIGHTING.</b> Two monsters in a sand pit, and everybody round the rail with money on them. One fight at a time for the whole room, on a clock: there is time to get your bet down, then they go at it, then the next pair comes out. It is <b>eastcoin.vip's own shared round</b>, so the people betting on the site are betting on the same fight.</p>
      <p><b>The card</b> is two of ${pool.length} monsters, from a ${H.esc(pool[lv.indexOf(Math.min(...lv))].name.toLowerCase())} to a ${H.esc(pool[lv.indexOf(Math.max(...lv))].name.toLowerCase())}. Each one's chance comes from the two levels, kept between ${Math.round(F.minP * 100)}% and ${Math.round(F.maxP * 100)}%, so an upset is always possible, and each side is priced from its own chance. <b>Who wins is one random number and nothing else</b>: no stats, no gear, no streaks. The blows you watch are written afterwards to fit the result.</p>
      <p><b>Bet ZCoins and you are paid in ZCoins</b>, by the site. <b>Bet tickets (${num(C.minBet)} to ${num(C.maxBet)}) and a win pays tickets</b>, held by the game and paid at exactly the price a ZCoin bet on the same fighter gets, with that round's own draw from the band.</p>
      <h3>The Picture House</h3>
      <p><b>A cinema.</b> Walk up to the screen and it opens eastcoin.vip's <b>Movies &amp; TV</b>: pick something and put it on, or join a room somebody else is hosting and <b>watch together</b>. The host's player sets the clock and everyone else follows it; drift more than a few seconds and your picture is put back in step. It is close enough for a film, not frame-locked. The jukebox goes quiet while the window is open and comes back when you close it.</p>
      <p>Reel Rhonda runs it, and Andy sits in the back row, which is where Rhonda told everyone not to sit.</p>
      <h3>The Roulette Room</h3>
      <p><b>Russian Roulette, centre stage.</b> It is eastcoin.vip's own PvP table, the very same one: somebody on the website and somebody in EastScape sit in one lobby. <b>ZCoins only</b>, a fixed 20 a seat, up to six seats. The first person to sit starts a short lobby clock, and whoever is in when it runs out plays; the cylinder goes round until one is left, and <b>the winner takes every buy-in</b>. The house takes nothing. Sit alone and your 20 comes back.</p>
      <p>Bino's bar cart is by the table: a shot, 1 ticket.</p>`;
    } },
  /* (2026-09-30) BRONNY'S ORDER, the server's daily, read from ORDER (and orderPick's own rule that nothing Bom sells is ever on it). */
  { id: "order", title: "Bronny's order", icon: "\u{1F4E6}", cat: "Money",
    body: (G, H) => {
      const O = G.ORDER, sold = new Set(G.prizesOf().map((p) => p.give?.[0]).filter(Boolean)), ok = ([k]) => G.ITEMS[k] && !G.ITEMS[k].held && !sold.has(k);
      const n = { early: O.mix.filter((t) => t === "early").length, mid: O.mix.filter((t) => t === "mid").length, late: O.mix.filter((t) => t === "late").length };
      const cell = (list) => (list || []).filter(ok).map(([k, c]) => `${num(c)} ${itemL(G, H, k)}`).join(", ") || "&mdash;";
      return `<p><b>${H.esc(O.npc)}</b> stands by the Yard's west gate, just off the road in from the Carnival, facing east. He is rebuilding the Yard one order at a time, and <b>it is one order for the whole server</b>: everybody hands in to the same bars.</p>
      <h3>How it works</h3>
      <p><b>${Word(O.lines)} lines</b>, each from a different kind of work, so whatever you like doing, you can help: ${word(n.early)} early-game lines, ${word(n.mid)} mid-game and ${word(n.late)} late, dealt out at random. A beginner always has lines they can do, and a veteran always has one worth their time.</p>
      <p><b>Hand in from your bag</b> at Bronny, any time, in any amount. <b>Everything you hand in is gone</b>: an item on Bronny's order is an item nobody sold to Bom, which is the balance. Nothing Bom sells is ever on it, so nobody can buy from him and hand it straight back.</p>
      <p><b>Filled, it is a 2X for the whole server</b>: ${Math.round(G.DOUBLE.ms / 60000)} minutes of 2X tickets (tickets only, no xp), held at Bronny until <b>somebody who helped</b> claims it (not while another 2X is running). It never expires unclaimed, and the next order only goes up once it has been claimed, so it never fires at an hour nobody is on.</p>
      <p><b>An order that runs out</b> (it has ${Math.round(O.ms / 3600000)} hours; the clock is on his board) is replaced by a fresh one, and what was handed in stays handed in.</p>
      <h3>What it can ask for</h3>
      <table class="tbl" data-paged="25"><tr><th>Work</th><th>Early game</th><th>Mid game</th><th>Late game</th></tr>${Object.values(O.kinds).map((K) => `<tr><td><b>${H.esc(K.name)}</b></td><td>${cell(K.early)}</td><td>${cell(K.mid)}</td><td>${cell(K.late)}</td></tr>`).join("")}</table>
      <p>Each line is one item from its kind and tier. The counts aim at about half an hour of one person's work a line, which is why they fall as the tier rises.</p>
      ${O.keystone ? `<h3>The keystone</h3>
      <p>Every order ends with <b>a keystone</b>: a few of something that takes luck rather than hours. It is one of these: ${O.keystone.list.filter(ok).map(([k, c]) => `${num(c)} ${itemL(G, H, k)}`).join(", ")}. Gems turn up while mining their ores; the rest drop, now and then, off ordinary monsters. They all trade, so the Exchange is the other way to one.</p>
      <p>The keystone is <b>handed in on its own</b>: "Hand in everything" leaves it in your bag, and only <b>plain</b> copies count, so a reforged ring is never taken.</p>` : ""}`;
    } },
  { id: "saving", title: "Saving", icon: "\u{1F4BE}", cat: "Starting out",
    body: `<p><b>There is no save button and there is nothing to lose.</b> The server owns your character, not your browser &mdash; every level, item and ticket is written down as it happens.</p>
      <p><b>Closing the tab is safe.</b> So is losing your connection, and so is your battery dying mid-fight. You come back where you were.</p>
      <p><b>The world keeps going without you.</b> Crops on your island grow while you are logged off, and anything your Market offers sell is waiting in your bank when you return.</p>
      <p><b>When the server restarts</b> &mdash; which it does when the game is updated &mdash; you get a countdown in chat first, everyone is saved, and the page waits it out and reconnects you. You do not need to do anything.</p>
      <p><b>The whole world is backed up nightly</b>, every character and every offer.</p>` }
];

/* ============================================================ v1.1 GUIDES (2026-10-01). Each carries `hold`: the HOLD flag it comes out with,
   so the page leaves a guide out while its part of v1.1 is held (see the guide loop in eastscape.html). Built from the rules where they can be,
   so a level or a price changed in the rules changes here too. */
const v11num = (n) => Math.round(n).toLocaleString();
GUIDES.push(
  { id: "thrill", title: "Thrill Hill and Daredevil Peak", icon: "\u{1F3AA}", cat: "Going further", hold: "thrill",
    body: (G, H) => {
      const C = G.THRILL.courses, nm = (k) => H.esc(G.ITEMS[k]?.name || k), mob = (k) => H.esc(G.MOBS[k]?.name || k), ic = (k) => (H.ico ? H.ico(k) : "");
      return `<p><b>Agility's home.</b> Ask <b>Dizzy Dale</b> at the ticket counter in the south of the Yard's court to let you in (it's free), and you're on Thrill Hill: three stunt runs round a junkyard fairground, a snack cart, a bookie who pays in runner's marks, and, up the cannon, <b>Daredevil Peak</b>.</p>
      <h3>The three runs</h3>
      <table class="tbl"><tr><th>Run</th><th>Agility</th><th>xp a stunt</th><th>A full lap</th><th>Runner's mark</th></tr>${Object.values(C).map((c) => `<tr><td><b>${H.esc(c.name)}</b></td><td>${c.lvl}</td><td>${c.xp}</td><td>+${c.lap} xp</td><td>${Math.round(c.mark * 100)}% of laps</td></tr>`).join("")}</table>
      <p><b>A lap is every stunt in order.</b> Start at the first; take one out of order and it still pays, but the lap starts again. Your best time on each run is kept. <b>Only the Rookie Run never slips</b>: on the others you can come off and land back where you started, and a Surefoot potion from Fast Eddie stops most of that.</p>
      <p>The Champion Run is on Daredevil Peak. Get up there by <b>the human cannonball</b> (Agility 70); the <b>zip line</b> brings you back down. The <b>crusher ramp</b> on the Peak wants Agility 90.</p>
      <h3>Fast Eddie and Corndog Carl</h3>
      <table class="tbl"><tr><th>Fast Eddie sells</th><th>Runner's marks</th></tr>${G.BOOKIE.map(([k, p]) => `<tr><td>${ic(k)} ${nm(k)}</td><td>${p}</td></tr>`).join("")}</table>
      <table class="tbl"><tr><th>Corndog Carl sells</th><th>Tickets</th></tr>${G.SNACKS.map(([k, p]) => `<tr><td>${ic(k)} ${nm(k)}</td><td>${v11num(p)}</td></tr>`).join("")}</table>
      <h3>Everything else up there</h3>
      <ul><li><b>${mob("gremlin")}s</b> on the hill and <b>${mob("hellbiker")}s</b> on the Peak, both with pockets worth picking (Thieving ${G.POCKETS.gremlin} and ${G.POCKETS.hellbiker}). <b>${mob("crusher")}</b> is the Peak's boss, and drops Lil' Crusher.</li>
        <li><b>Featherwood</b> (Woodcutting 60) shakes feathers loose with every log. <b>Nitro eels</b> (Fishing 75) cook into the only fish that makes you walk faster. <b>Chrome</b> (Mining 85) smiths into <b>chrome-toe boots</b> (Smithing 85).</li>
        <li>A <b>lockbox</b> on the Peak, Thieving ${G.LOCKBOXES.thrill_top?.[2] ?? 90}.</li></ul>
      <p>The old obstacle course in the Yard, The Run, is closed: Thrill Hill replaces it.</p>`;
    } },
  { id: "worldthief", title: "Thieving in the world", icon: "\u{1F90F}", cat: "Skills", hold: "thief2",
    body: (G, H) => {
      const mob = (k) => H.esc(G.MOBS[k]?.name || k), scn = (k) => H.esc(G.SCENES[k]?.name || k);
      const pockets = Object.entries(G.POCKETS).sort((a, b) => a[1] - b[1]);
      const boxes = Object.entries(G.LOCKBOXES).sort((a, b) => a[1][2] - b[1][2]);
      const scs = Object.entries(G.WORLD_SC).sort((a, b) => a[1].lvl - b[1].lvl);
      return `<p><b>Thieving isn't only the Guild any more.</b> Monsters out in the world have pockets, most maps have a lockbox, and every map has a fenced-off corner your Agility can get you into.</p>
      <h3>Pockets</h3>
      <p>Click a monster and choose <b>Pick pocket</b>. Nobody can be picked while they're in a fight. Get caught and you're stunned for a moment; get away with it and that one's pockets are turned out for a minute.</p>
      <table class="tbl"><tr><th>Monster</th><th>Thieving</th></tr>${pockets.map(([k, l]) => `<tr><td>${mob(k)}</td><td>${l}</td></tr>`).join("")}</table>
      <h3>Lockboxes</h3>
      <p>One on each of ${boxes.length} maps. Every try uses a <b>lockpick</b> (${H.wl("npcs/Vance the Fence", "Vance the Fence")} sells them, ${v11num(G.WT.lockpick)} tickets each). An open box gives ${G.WT.box.rolls} rolls of the guild's loot for its level, and is yours again in ${Math.round(G.WT.box.cdMs / 60000)} minutes. About one box in ${Math.round(1 / G.WT.box.key)} holds a <b>skeleton key</b>: open a Crypt or Pyramid hoard with one in your bag and it rolls twice.</p>
      <table class="tbl"><tr><th>Map</th><th>Thieving</th></tr>${boxes.map(([k, b]) => `<tr><td>${scn(k)}</td><td>${b[2]}</td></tr>`).join("")}</table>
      <h3>Shortcuts and nooks (Agility)</h3>
      <p>A log, some stones, a rope, a gap in a fence: each gets you over a barrier, usually to a tree or a rock a tier above the map's own. You can slip and end up where you started; that gets rarer as your Agility climbs past the shortcut's level.</p>
      <table class="tbl"><tr><th>Shortcut</th><th>Map</th><th>Agility</th><th>Behind it</th></tr>${scs.map(([id, s]) => `<tr><td>${H.esc(s.name)}</td><td>${scn(s.scene || id)}</td><td>${s.lvl}</td><td>${H.esc(s.ledge?.obj?.name || "a quicker way round")}</td></tr>`).join("")}</table>
      <h3>Back ways</h3>
      <p>Three long ways between two maps, drawn on the world map once your Agility can use them.</p>
      <table class="tbl"><tr><th>Back way</th><th>Between</th><th>Agility</th></tr>${Object.values(G.BACKWAYS).map((b) => `<tr><td>${H.esc(b.name)}</td><td>${b.ends.map((e) => scn(e.scene)).join(" and ")}</td><td>${b.lvl}</td></tr>`).join("")}</table>`;
    } },
  { id: "diaries", title: "Area diaries and the cape", icon: "\u{1F4D6}", cat: "Going further", hold: "diary",
    body: (G, H) => `<p><b>Every map has a diary</b>: ${G.DIARY.keys.length} of them, from the Yard to the Deep Wild, each with four tiers (${G.DIARY.tiers.join(", ")}) of three tasks. Open yours with <b>L</b>, or the book at the end of the row of icons above your inventory: it opens on <b>the map you're standing on</b>, so the next thing to do is always one key away. "Whole diary" shows all of them.</p>
      <p><b>A tier is finished when every task in it is done, and every tier under it.</b> Finishing one gives you three things:</p>
      <ul><li><b>A perk on that map</b>: faster gathering, a price cut, a monster that hits softer, a free teleport there once a day, a boss's table rolling twice on your first kill of the day. Each diary lists its four.</li>
        <li><b>An XP lamp</b>: ${G.DIARY.lamps.map((n) => v11num(n)).join(", ")} XP for ${G.DIARY.tiers.join(", ").toLowerCase()}. Rub it on any skill at or above the map's own starting level.</li>
        <li><b>A medal</b> (${G.DIARY.medals.join(", ")}): the frame round that map's emblem in your diary.</li></ul>
      <p><b>What you'd already done counts.</b> When diaries opened, everything your character had already done was ticked off quietly: quests, kills, catches, laps, the maps you've walked onto.</p>
      <p><b>An event task</b> is done by whichever world event ends on that map while you're there. <b>The Wilderness and the Deep Wild</b> have PvP tasks from Medium up; their Easy tiers never need another player.</p>
      <h3>The cape slot and the Grand Tour</h3>
      <p>Your paper doll has an <b>eleventh square, under your feet</b>, for a cape. A cape carries no stats: it's for what you've done, and everyone can see it on you. The first is the <b>Grand Tour cape</b>, for <b>every Elite diary</b>, the Wilds included. Wearing it: a free teleport to any map once a day from the Diary, and the title <b>${H.esc(G.DIARY.title)}</b>. It can't be traded, sold or dropped.</p>` },
  { id: "character", title: "The Character window", icon: "\u{1F9CD}", cat: "Going further",
    body: `<p><b>Every number the game uses about you, in one place.</b> Open it from the <b>Character</b> button under your paper doll (Equipment, U).</p>
      <p>It shows your accuracy, strength and defence for the style you're using, your max hit and swing speed, your walking speed, your bonuses from gear, gems, pets, work clothes and food, and for each one <b>where to get more</b>. Nothing in it is sent anywhere: it's worked out on your screen from what you're wearing.</p>` },
);
/* the v1.1 Agility guide: Thrill Hill instead of The Run, and the shortcuts */
function agilityV11(G, H) {
  const C = Object.values(G.THRILL.courses);
  return `<p><b>Agility is trained on ${H.wl("guides/thrill", "Thrill Hill")}</b>: in at Dizzy Dale's counter, south of the Yard's court. Three stunt runs, ${C.map((c) => `<b>${H.esc(c.name)}</b> (Agility ${c.lvl})`).join(", ")}; each stunt pays, a full lap pays far more, and laps drop the runner's marks Fast Eddie takes.</p>
      <p><b>What it buys is movement speed, everywhere</b>: about <b>+5% at 50</b> and <b>+10% at 99</b>, on every step you take for the rest of the game.</p>
      <p><b>And it opens the world up.</b> Every map has a shortcut or a fenced-off nook with something a tier above the map behind it, and three back ways run between maps. ${H.wl("guides/worldthief", "Thieving in the world")} lists them all.</p>`;
}

export const UPDATES = [
  {
    date: "2026-10-08", title: "Update 1.1", hold: "diary",
    items: [
      "AREA DIARIES. Every map has a diary: 21 of them, four tiers of three tasks. A tier gives a perk on that map, an XP lamp (1,000 to 75,000) and a medal. Press L, or the book at the end of the icons over your inventory: it opens on the map you're on. Everything you'd already done is ticked off.",
      "THE CAPE SLOT. An eleventh square on your paper doll, under your feet. The Grand Tour cape, for every Elite diary, is the first: a free teleport anywhere once a day and the title the Well-Travelled.",
      "THRILL HILL. Agility's new home, through Dizzy Dale's counter in the south of the Yard's court: the Rookie, Pro and Champion Runs, Daredevil Peak up the human cannonball, Fast Eddie's runner's-mark shop, Corndog Carl's snacks, Grease Gremlins, Hellbikers and Big Daddy Crusher. The Run in the Yard is closed.",
      "THIEVING IN THE WORLD. Monsters out in the world have pockets (Pick pocket on the monster), most maps have a lockbox (Vance sells lockpicks, 1,000 tickets), and a skeleton key from a lockbox makes a Crypt or Pyramid hoard roll twice.",
      "SHORTCUTS AND BACK WAYS. Every map has a fenced nook or a shortcut your Agility gets you over, with something a tier above the map behind it; three back ways run between maps and show on the world map.",
      "WORK CLOTHES. A set for every skill, +3% XP a piece and a perk for all four, kept in the Locker (Equipment, Work clothes).",
      "THE CHARACTER WINDOW. Every number about you and where to get more, from the Character button under your paper doll.",
      "GEMS are a quarter as common and can no longer be traded or put on the Exchange. Gems still on the Exchange were taken down and sent back to their sellers' collection boxes; if a sorted gem lost its sort on the way, staff can put it right.",
      "SETTINGS: a Jukebox volume slider, separate from the game's sound.",
    ],
  },
  {
    date: "2026-09-30", title: "The Flood",
    items: [
      "A SECOND YARD RAID: THE FLOOD. The river comes over the bank and the water spreads across the west bank tile by tile. Wading through it is slow, and the Drowned and the Bank Sharks climb out of it.",
      "SANDBAGS HOLD IT. Five spots along the water ask for Logs, Ores or Sand: click one to hand in what you're carrying. A full spot drains the water around it and keeps it dry, and everything you hand in counts towards your share of the spoils, just like damage. Skillers win this one as much as fighters.",
      "HOLD ALL FIVE and the water goes down, and THE UNDERTOW climbs out of the pond. It hits hard, slams everyone close to it, and drags more of the Drowned out of the water as it weakens. Beat it before the time's up and everybody who helped is paid.",
      "LOSE, and the Yard and half the court stay under water for 20 minutes, and Bom, Nestor, Livia, Hexa and Bronny put their shutters up until it goes.",
      "Big moments (the King, the Ice Wyrm, Bronny's order, the raids) no longer show up twice in chat.",
    ],
  },
  {
    date: "2026-09-30", title: "Bronny wants more",
    items: [
      "BRONNY'S ORDERS ARE BIGGER. Six lines instead of five (two early, two mid and two late-game), and every count is a quarter up. The order already on his board keeps its five; the next one is the new shape.",
      "EVERY ORDER ENDS WITH A KEYSTONE: a few of something that takes luck, not hours. Rubies, sapphires or topaz from mining, or one of the rare drops off ordinary monsters (masks, Gambler's rings, Bookie's amulets and the like). They all trade, so the Exchange is the other way to one.",
      "The keystone goes in on its own: Hand in everything leaves it in your bag, and only plain copies count, so a reforged ring is never taken.",
      "EGGS ARE RARER: one kill in 1,000 (was one in 400).",
    ],
  },
  {
    date: "2026-09-30", title: "Your screen, your way",
    items: [
      "SETTINGS HAS FIVE TABS NOW (the gear, top right). Layout, Players, Monsters, Features and Look.",
      "MOVE ANYTHING. Layout, then Move things: drag the minimap, chat, buffs, the quick slots, the messages, the world events and the rest wherever you want them, hide the ones you don't, and put any of it back with one click. Every window drags by its title bar; double-click the title to put it back. You can also float the side panel (your bag, gear and skills) as its own window and give the world the whole screen.",
      "FIVE LOOKS. OG is the game exactly as it was, nothing moves. Tavern is the same wood and parchment with your layout. Midnight is dark glass, Neon is the casino's magenta and gold, and Minimal takes every frame away.",
      "NAMEPLATES. Show everyone's names, just your party's, or only yours; levels, titles, pet tags and health bars each on or off; bigger or smaller names. Monsters get their own tab: names always, on hover, only while you fight, or never, and health plates when hurt, always, or only on your target.",
      "SWITCH OFF THE BUSY BITS. Damage numbers, chat bubbles, other players' trails and glows, screen shake, the ambience, the big banners, CASINO's lines and other people's milestones, each on its own switch. And Ask before big buys puts a second click on anything at Bom over the amount you choose.",
      "It's all saved to your character, so it follows you to any computer. Phones keep the usual layout.",
    ],
  },
  {
    date: "2026-09-30", title: "The Wilderness, rearmed",
    items: [
      "THE WILDERNESS AND THE DEEP WILD HAVE NEW MONSTERS. The entrance and the halls of the Wilderness still hold the level 20s; its three pockets now hold Pot Boys, Goblin Cutters, Vault Wardens and Crystal Ogres (73-78). The Deep Wild is the top of the game: Sabretooths and a Caveman on the Nexus door, a Yard Gator at the Black pool, Scrappers, Possums and Junkyard Dogs between (73-93). Weavers, Marrow Hounds and Grim Liches stay where they were.",
      "A KILL THERE PAYS MORE: 25% more combat xp and tickets in the Wilderness, 50% more in the Deep Wild.",
      "AND A DEATH THERE COSTS WHAT IT COSTS ANYWHERE: 10% of the tickets you carry, up to 10,000. If another player killed you, they take it. Nothing waives it out there, not the Witch's brew and not the Ferryman's Coin."
    ]
  },
  {
    date: "2026-09-30", title: "/find, the wiki rebuilt, and a balance pass",
    items: [
      "CHAT COMMANDS: /find anything (an item, a monster, a place, a person, a furnace, a skill) and it tells you WHERE, with the way there from where you stand. Also /help, /price, /count, /xp, /timers, /bosses, /wiki, /map, /online, /roll and /stuck. Only you see the answers (except /roll), and a mistyped /command is never said to everyone.",
      "WHO'S ONLINE is rebuilt, with an Active or Idle beside everyone and a filter for each.",
      "THE WIKI, REBUILT: every list is a table you can sort by clicking a heading (items grouped by kind, monsters by level, areas by band, people by what they do). Area pages show every way in and out, a monster table, a skilling table with levels and what you can use there. Item pages say what a thing does, what it grows or hatches into and who sells it. Ten new guides: Chat commands, the Store, the Yard raid, the Frozen Reach, the Primeval Valley, the Boardwalk, the Depths, the Great Pyramid, the casino's back rooms and Bronny's order. Stale numbers everywhere were corrected or now come straight from the game.",
      "A BALANCE PASS, from the live hiscores and every skill's numbers side by side. Smithed gear now sells to Bom for its bars and a quarter again, not an eighth of the shelf (a one-bar dragonstone gladius was 825, now 136). Stardust and abyss crystal sell like their tier's ore (20 and 45). Monsters from level 30 up pay by how much health they have: a Cloudreach angel pays less, and everything past level 70 pays far more (a mammoth 1,746 a kill).",
      "SALES TO BOM ARE NO LONGER DOUBLED by 2X Tickets (kills still are), so a hoard saved for the window isn't doubled on demand.",
      "THE TOWER pays for the health on each floor now, half of what the same fighting earns outside: hundreds to thousands a floor, where it was a handful.",
      "WIZARDRY AND MAGIC: a print makes 30 pages (was 10), an ink brew makes two and a half times the ink, and gems turn up in ore twice as often.",
      "HARVESTING AND FUNGICULTURE: the higher crops and mushrooms give far more xp (starfruit 8,000, starcap 6,000), so every new one is worth planting.",
      "THIEVING: the Guild permit is 15,000 (was 50,000), the signet and the ledger sell for more, and a ninth mark, the Grand Larcenist (Thieving 97), works the top room. AGILITY: a lap drops four marks worth 50 each. BREEDING: pet eggs drop one kill in 400 (was 1,500).",
      "ARCHERY: shortbows hit harder from the yew up, and eclipse, nova and singularity arrowheads come 30, 45 and 45 a bar. LOGS: palm, skyash and rustpine logs sell for 38, 40 and 42, so they climb with the level.",
      "A GRIMSTONE ROCK in Cloudreach, so onyx and starfall bars don't need the Wilderness. ALCHEMY: Bom sells small vials, cobras can drop serpent venom and revenants ectoplasm, so every potion can be brewed. The Frozen Reach, the Frostspire and Old Rex's Lair are Combat 95, 99 and 97 (they asked for levels past 99).",
      "Pet eggs in the Store cost twice what they did. The two Alchemy 100 potions (Pharaoh's draught and the Coilbreaker draught) are Alchemy 99: levels stop at 99, so nobody could ever brew them."
    ]
  },
  {
    date: "2026-09-30", title: "The islands, rebuilt",
    items: [
      "EVERY ISLAND IS MUCH BIGGER, for everyone and for free: the first is about 28 by 15 tiles now (it was 17 by 10), the Bigger island 34 by 18 and the Far Shore 41 by 22. Everything you put down is exactly where you left it; the new land grows round it. Decor goes from 12/20/32 outside to 20/32/48.",
      "THEY LOOK BETTER: a sand beach all round, a cobbled path from the dock up to your door, and new trees and rocks on the new land.",
      "THEMES ARE THE WHOLE ISLAND NOW, grass, beach, sea and trees. Five new ones at Charon's cart: Tropical and Autumn (5,000), Frozen (7,500), The Void and High Roller (10,000). Choose yours at the island sign.",
      "YOUR COTTAGE: bigger inside for everyone (20 pieces of decor, from 12). The Store sells it in five other styles (Stone Manor, Log Cabin, Beach Hut, Witch's House, Casino Villa), and new walls and floors for inside. Visitors see all of it.",
      "LIVESTOCK, 5,000 each at Yahsmeena's: a chicken coop (raw chicken and feathers), a cow pen (raw beef and cowhide) and a fishing cage (fish). They fill up while you're away, up to a day's worth; click one to empty it. A bubble shows what's waiting. Two of a kind fill twice as fast.",
      "NEW PLOTS AND PEN: the garden plots are wooden raised beds now, and the breeding pen has a picket fence, straw and a little kennel.",
      "TYPE /island IN CHAT to see every clock on your island at once: how long your crops, mushrooms, breeding pen, hatching egg and livestock have left.",
      "Yahsmeena's shop lists the livestock first, and every piece the Store sells with a button straight to it.",
    ],
  },
  {
    date: "2026-09-30", title: "The Store: pets, eggs and bag slots",
    items: [
      "A PETS TAB in the Store. TEN PET SKINS: the Baby Dragon, Phoenix Chick, Ghost Cat, Neon Fox, Lucky Cat, Tiny Kraken, Mecha Pup, Void Wisp, Unicorn Foal and the Slot Bot. A skin changes how your pet LOOKS and nothing else: it keeps its bonuses, its name and its rank, and a Greater keeps its blue glow, a Legendary its orange. Some of them spark or glow. Press Try to see one at your heel first.",
      "EGGS FOR TICKETS: every egg in the game, from the Speckled egg to the Gilded, the Raptor and the Yeti. Hatch them in a hatchery on your island as usual.",
      "EXTRA BAG SLOTS: up to five more, on top of the five sold in the game.",
      "EVERYTHING IN THE STORE HAS ITS OWN PICTURE NOW, and the boosts, shows and upgrades read as a short line and a table of what they do.",
      "THE WIKI: long tables are paged. A skill's 'What you can make' shows every recipe, 25 to a page, with a box that jumps to a level (a player found Smithing stopped at 60).",
    ],
  },
  {
    date: "2026-09-30", title: "The Store, rebuilt",
    items: [
      "THE STORE IS REBUILT, with six tabs: Boosts, Effects, Name, Decor, World and Upgrades. New things wear a NEW ribbon and come first, and a few are ON SALE.",
      "EFFECTS: walking trails (embers, frost, gold dust, sakura petals, hearts, bubbles, shadow steps, coins and the Rainbow Road), glows (gilded, frost, ember, void, a halo, toxic haze), weapon hits (thunderstrike, flame burst, frost shatter, shadow slash, jackpot coins, starburst, petals) and hit splats (blood, gold coin, ice, venom, void, heart, skull). Everyone sees them. Press Try in the Store to walk about in one before you buy it.",
      "TITLES are the game's own now: fourteen to pick from, or write your own (2 to 20 letters, change it whenever you like). Titles from eastcoin.vip no longer show in the game.",
      "PET NAME TAGS: your pet's name over its head, in leather, gold or glowing.",
      "THE 2X POTIONS SAY WHAT THEY DO: the old 2X Potion is now 2X TICKETS & CRAFTING XP, and there is a new 2X SKILLING XP potion (every non-combat skill, for everyone, 30 minutes). Running together, crafting xp stays 2X, never 4X.",
      "THE LOUPES, for the Gem Sorter: the Jeweller's Loupe (a Perfect gem 1 in 56 instead of 1 in 213) and the Master Jeweller's Loupe (1 in 20), 10 rolls each. The Sorter shows the odds you're rolling at.",
      "DECOR: 29 pieces you can only get here, for your island and your cottage: a Jackpot Monument, a Void Portal, a Backyard Volcano, a Dragon Skull, a Pirate Wreck, a Grand Piano, a Fireplace, a Canopy Bed, a Frog Chair, a Cherry Blossom Tree, an Ornate Pool and more. Some of them glow, smoke or play music. Put them down with Decorate.",
      "WORLD: Fireworks, a Confetti Cannon, Sky Lanterns and a Snow Globe, set off wherever you are for everyone there; and the WAR HORN, which calls the Ice Man down on the Yard in your name (5 online, 3 hours between raids).",
      "UPGRADES: extra bank pages (40 slots each, up to five more) and extra quick slots (up to 8, keys 5 to 8).",
      "FIX: anything that said it made you faster (food, drinks, the Ditched set, Yeti-fur boots, the achievement) only ever sped up your swings. It makes you walk faster too now.",
    ],
  },
  {
    date: "2026-09-30", title: "The Frozen Reach",
    items: [
      "TWO NEW MAPS NORTH OF CLOUDREACH: the Frozen Reach and the Frostspire, monsters from level 100 to 115. A MAGE'S COUNTRY: a wand and Magic 60 let you in whatever your Combat, every creature takes 40% more from spells (the owls 70%), spells land at least half the time up there, and most of them stand on snowy shelves and ice floes where no sword reaches.",
      "THE COLD KILLS: without a Frost ward it takes 25 health a second. Wren (Cloudreach) and Morwenna (the Thunderhead) sell a plain Frost charm, and the anvil makes a Frost ward ring and amulet from the Yard raid's frost shards and yeti pelts.",
      "THE FROST JARL waits on the Frostspire's high shelf, and ONCE A DAY, at an hour nobody knows between 2 PM and midnight, THE ICE WYRM comes up through the Reach's lake for half an hour. Both are spells only and shared: everyone who hurts them gets the drop (14,000-22,000 and 20,000-32,000 tickets each), the report, and CASINO calls it.",
      "NEW LOOT: Rimeheart (a legendary ice wand), the Crown of the Frost Jarl (a helm that keeps out the cold), Winter's Heart and the Frostbite ring (spells hit harder), the Frostmind draught, the Glacier Satchel (10,000 pages), the Frostpine wand, glacite (Mining 94), frostpine (Woodcutting 94) and icefin through the ice (Fishing 94).",
      "THE RAID'S SPOILS MAKE THINGS NOW: Frost wards, Yeti-fur boots (the best boots in the game), Rimefang arrows (the strongest arrow) and Frostmind draughts; and the Ice Man carries a legendary axe, Rimecleaver.",
      "BOSS PETS: every late boss can drop its own pet, stronger than anything that hatches: the Rexling (Old Rex), the Matriarch's Calf, the Jarl's Hound, the Wyrmling (the Ice Wyrm) and the Ice Imp (the Ice Man). The Valley's and the Reach's hatchlings and Legendaries are stronger too: the Snow Owlet, the Yeti Cub, the Blizzard Owl and the Abominable.",
      "THE ROAD BEHIND YOU: the Valley's and the Reach's monsters now also drop a few plain materials from the maps before them, now and then.",
      "FIX: a boss's own pet (the Deepwarden's Pot Boy) could only drop during the Long Night. It drops all year now.",
    ],
  },
  {
    date: "2026-09-30", title: "The Yard Raid: the Ice Man",
    items: [
      "THE YARD CAN BE RAIDED. When the frost starts creeping over the Yard, CASINO counts it down: five minutes, then every minute, then thirty seconds. Then THE ICE MAN comes through the north gate with his war party of frost wolves, yetis and frost giants.",
      "STAND ON THE WEST BANK: the war party will not cross the river into the court. Everyone of every level can fight: the raiders come in waves, from wolves a new player can put down to giants that need a crowd, and they carry logs, ores, bars, fish, feathers, bowstrings, spell paper, ink and now and then a gem.",
      "THE ICE MAN is enormous, his health grows with how many are online, and every 10 to 15 seconds he casts DEEP FREEZE on a few of the people fighting him: locked in ice, a few seconds, no moving, no swinging. When he is badly hurt he calls THE LAST WAVE, his huscarls.",
      "WIN and everyone who fought shares the spoils, split by how much of the fighting they did, with a floor for anyone who joined in, plus 15,000 to 25,000 tickets each from the Ice Man himself for everyone who hurt him enough. You get the after report too.",
      "LOSE (he is still standing after twenty minutes) and the Yard is sacked: Bom, Nestor, Livia and Hexa are boarded up for ten minutes. Nobody loses anything they own.",
    ],
  },
  {
    date: "2026-09-30", title: "The Primeval Valley",
    items: [
      "THREE NEW MAPS NORTH OF THE TRAILER PARK: the Primeval Valley's Lowlands, the Ridge and Old Rex's Lair, with monsters from level 90 to 110.",
      "A BOW'S COUNTRY: ARCHERY 40 AND A BOW LET YOU IN, whatever your Combat (everyone else needs Combat 90, 95 and 100). Most of what lives here stands up on the ledges where no sword reaches, every monster takes 40% MORE from arrows (pterodactyls 70%), and in the Valley your arrows land at least half the time, whatever the monster's defence.",
      "TWO WORLD BOSSES, UP ON THE PLATEAUS, ARROWS ONLY: Old Rex on his throne in the Lair and the Mammoth Matriarch on the Lowlands' great plateau. Swords and spells do nothing to them. Everyone who lands arrows shares the kill (12,000 to 20,000 tickets EACH from Rex, 8,000 to 14,000 from the Matriarch), everybody gets the after report, and CASINO tells the server when they fall and when they are back. Their health never resets, so go back for more arrows if you need to.",
      "ARCHERY LOOT: the Skyripper (a pterodactyl-wing longbow), the Raptor-claw ring and the Hunter's Fang (your arrows hit harder), the Hunter's draught (15 minutes of harder arrows), pterodactyl sinew, silkstring and arrowheads. The Golden Raptor turns up one time in 500.",
      "THE CYCAD TIER: cycad shortbows, longbows, quivers and wands, the best a fletcher or a wizard can make, strung with pterodactyl sinew and weighted with fossils.",
      "NEW GATHERING: fossil rocks (Mining 92), cycads (Woodcutting 92) and coelacanth in the lake (Fishing 92).",
      "NEW PETS: the Raptor Hatchling and the Pterodactyl Chick hatch from the Valley's eggs, and each has a Legendary: the Little Tyrant and the Sky King. Nestor takes both eggs.",
      "ARCHER AND MAGE ARMOUR CAN BE REFORGED: Wren's and Morwenna's armour now reforges at an anvil like plate, with the same bars and the same Smithing as the plate piece at its level.",
      "FIX: the Nexus and the Wild Bench no longer double gear. A wand, a Magic Bag, a bow or a quiver comes out one at a time (pages, arrows and shafts still get the extra), and so does a Tinkering gadget's double make.",
    ],
  },
  {
    date: "2026-09-30", title: "Roads on every map",
    items: ["COBBLED ROADS EVERYWHERE: every map's paths are laid in the Yard's cobbles now, each shaded to its ground (dark and damp in the Gloam and the Mire, pale in Cloudreach, stormy on the Thunderhead, sandy in the Golden Sands) with the edges broken into the ground around them, so every road feels like part of one world.", "A GEM TAKEN OUT OF YOUR GEM BAG KEEPS ITS ROLL: take out a +4% topaz and you get a +4% topaz, to put back, swap round, trade or sell. It used to come back unsorted."],
  },
  {
    date: "2026-09-29", title: "Fights hit harder",
    items: [
      "EVERY BLOW LANDS: whatever you hit flinches back and flashes white before the red, and so do you when something hits you.",
      "YOUR ATTACKS ARE DRAWN: a sword leaves an arc in its metal's colour, a bow's string snaps back with a streak down the line of the shot, and a wand throws a ring in its page's element.",
      "NEW SOUNDS: you hear a monster wind up before it swings at you, a crit has its own heavy impact, and a hit that is WEAK, RESISTED or GUARDED rings, thuds or clanks. When your health drops below a quarter in a fight, you hear your heartbeat. Monsters falling, and other people's fights nearby, can be heard across the map.",
      "DYING SAYS SO: the screen greys over with what got you, wherever it happened, dungeons included.",
      "Wren and Morwenna's prices now match Bom's melee gear, tier for tier; their weapons cost ten times that.",
      "THE JUKEBOX IS THE RADIO NOW: the Green Room's songs no longer play in the game or follow you around. Pick a station at the jukebox, as before; the Green Room itself is still on eastcoin.vip.",
    ],
  },
  {
    date: "2026-09-29", title: "Archers and mages get their own gear",
    items: [
      "TWO OUTFITTERS keep stalls out in the world: Wren the Ranger in Cloudreach and Morwenna the Mage on the Thunderhead. Each sells five-piece sets in five tiers (Archery or Magic 10, 30, 50, 70 and 90): half the defence of plate, but a whole set adds +10% damage for its style, and an archer's set makes you 6% faster on your feet. They also sell bows, quivers, wands and Magic Bags, expensively (make your own, it's far cheaper), and buy it all back at Bom's rate.",
      "LONGBOWS ARE TWICE AS STRONG. With a shortbow, archery already kept up with a sword; the longbow was the weak one for its extra reach. Now it hits nearly as hard as a shortbow.",
      "Bom (and the outfitters) now buy every wand and Magic Bag. Ones made with a gem had no price and were turned away.",
      "BRONNY'S NEW SKILLS ask for early and mid-game things only: Harvesting, Fletching, Wizardry and Tinkering lines are never late-game.",
    ],
  },
  {
    date: "2026-09-29", title: "Bronny needs more trades",
    items: [
      "BRONNY'S ORDERS NOW DRAW ON NINE SKILLS, not five: Harvesting (crops from your island), Fletching (shafts, arrows and bows), Wizardry (spell paper and pages) and Tinkering (gadgets, a few at a time) join Fishing, Woodcutting, Mining, monster drops and Cooking. Each order still has five lines, picked from the nine.",
      "THE 2X BANNER keeps time by the server's clock, so a computer whose clock runs fast no longer loses it early.",
    ],
  },
  {
    date: "2026-09-29", title: "The Wilderness moves out to the Thunderhead, and Bronny wants more",
    items: [
      "THE WILDERNESS LADDER HAS MOVED from the Gloam to the Thunderhead, on the storm-plain's south edge. It was far too close to the Yard for somewhere that dangerous and that rewarding. A sign in the Gloam points the way. Climbing back out brings you up where you went down.",
      "THE WILD BENCH has moved to the Deep Wild, beside the Nexus altar: both half-again stations in one place, and that place is the Deep Wild.",
      "BRONNY'S ORDERS ASK FOR HALF AS MUCH AGAIN, so the Yard's 2X takes more to earn. An order already out keeps the counts it was given.",
      "SORTED GEMS ARE SINGLE ITEMS NOW: each shows its roll on its corner (+10%, -3%) in its band's colour, and clicking one in your bag sets it straight into your gem bag.",
    ],
  },
  {
    date: "2026-09-29", title: "Tinkering rebalanced, and every map's missing art back",
    items: [
      "TINKERING XP IS PACED LIKE THE OTHER SKILLS NOW. Salvaging pays half an item's part value, and never more than 40 xp for one item, so a rare or a piece of top gear isn't a shortcut any more. Building a gadget pays 15 xp for each level it needs. Giving parts and tickets to a World Project pays less xp than it did (finishing a stage still pays well). Levels already earned stay earned.",
      "GADGETS MOVED UP AND COST TEN TIMES AS MUCH: the Confetti Cannon is Tinkering 31, the Whetstone, Scope and Arc Coil 40, the Lantern 58, the Auger 78 and the Boss Bomb 90. Every part and ticket fee is ten times what it was. The early levels are salvaging and World Projects. The Tinkering guide has the full table.",
      "TINKERING HAS ITS OWN ICON everywhere (skills, profiles, the Hiscores and the wiki), five achievements (Scrapper, Gadgeteer, Automation, Builder and Town Planner), and a Builder's Pins page in the collection log.",
      "MISSING ART FIXED: the Boneyard's dragonstone rocks, Cloudreach's onyx rocks, and the barrels on the Gloam, the Golden Sands, the Fight Pit and the Thieves' Guild all show again.",
    ],
  },
  {
    date: "2026-09-29", title: "Tinkering, World Projects, and gems are open",
    items: [
      "TINKERING, A NEW SKILL: take your junk to Sprocket Sal's Scrap Bench by Bronny's worksite in the Yard and salvage it into parts (Scrap, Gears, Sparks and Relic shards, kept in their own pouch). Build gadgets out of them: a Whetstone, a Scope, a Pressure Cooker, a Lantern for rare drops, the Auger, Chainsaw and Auto-Reel that keep you gathering, a Boss Bomb, and more. See the Tinkering guide.",
      "WORLD PROJECTS: broken things around the world, starting with the jetty in the Yard pond, that the whole server rebuilds together. Give parts and tickets at a project's board; when a stage is full somebody with the Tinkering level it asks for finishes the job, and everybody who helped gets a Builder's Pin. There's a Builders board on the Hiscores.",
      "GEMS: from level 60 in a skill you'll turn up that skill's gem now and then, and monsters of level 60 or more drop combat gems. Take one to the Gem Sorter, a jeweller's bench in the Yard's north court, to roll it a bonus from -5% to +10% (the high rolls are rare), then put it in your gem bag: the Gems button on your inventory. One combat and one skilling setting to start, more for tickets. See the gem bag guide.",
      "THE YARD'S NORTH PASTURE is less crowded: nine fewer monsters around Hexa's stall, every kind still there.",
    ],
  },
  {
    date: "2026-09-29", title: "A river through the Yard, quivers and Magic Bags three times the size, and a round of fixes from the bug board",
    items: [
      "THE YARD, REDONE: a river runs down its middle. East of it are the two courts with every workbench, Livia, Charon and the road to the casino; west of it, every monster, Bronny and Sal. The road crosses on a plank bridge and is cobbled all the way west to the Carnival and north to the Gloam, with lamp posts along it that light up after dark. The courts are fuller too: barrels, crates, sacks, a quench bucket by the anvil, and two chickens loose in the south court.",
      "QUIVERS AND MAGIC BAGS HOLD THREE TIMES AS MUCH: a rough quiver is 300 arrows and a Bogwood one 3,000; Magic Bags run from 300 to 7,500 pages, and the Shroud Satchel holds 3,000. Loading takes every stack of that arrow or page in your bag in one click.",
      "THE WILD BENCH: fletching's own Nexus, in the Wilderness grove against the west rock. It fletches everything, and half as much again.",
      "THE NEXUS, TONED DOWN: it prints one and a half times the pages (was twice) for a quarter more xp (was half as much again).",
      "HOW MANY TO MAKE: every crafting window and the anvil ask how many first (1, 5, 10, 25 or All), and stop when that many are done.",
      "BOM BUYS BOWS, QUIVERS, WANDS AND MAGIC BAGS now, which he used to turn away.",
      "THE BANK takes 1, 5, 10, 25 or 99 at a time, and your stacks stay where they are while you work instead of shuffling.",
      "OTHER PEOPLE'S GEAR: on someone's profile, hover a piece they are wearing to see it, and right-click it for its wiki page.",
      "FIXES: you arrive where you meant to (the nearest open tile, never inside a wall), both ways across the Far Shore bridge; a refresh on your own island keeps you on it; a Master's seal +4 stays +4 through a save; Finished offers stays open; the Gallows oak no longer stands on the onyx rock; the 2X banner sits below the skill ring; and planting a mushroom bed pays Fungiculture xp like a seed pays Farming. Thanks to everyone who used the bug button.",
    ],
  },
  {
    date: "2026-09-28", title: "Party meter, run reports, and a report for the Pumpkin King",
    items: [
      "THE PARTY METER: in a party, a meter sits under the minimap: damage (and damage a second), damage taken, HP healed by food, and deaths, for this fight or the whole run. Fold it, drag it, reset it.",
      "RUN REPORTS: when a Crypt or Pyramid run clears or wipes, or the Count Room's floor is cleared, everybody in it gets a report: the time against your best, awards (MVP, Killing Blow, Snack King, Deadeye and more), the party's numbers, damage over the run, your xp, and who went down to what. Post it to chat, or open it again from the meter.",
      "THE PUMPKIN KING GETS ONE TOO: everybody who fought him gets the report when he falls, or when he gets away, party or not.",
      "FIXED: Bronny's order and a running 2X now survive the server restarting. Before, a restart posted a fresh order and lost what had been handed in. The countdown shows seconds now too.",
      "Eggs drop one kill in 1,500 (it was one in 500 for a few hours today).",
      "THE NEXUS, TONED DOWN: it prints half as much again as another altar (it was twice as much), for a quarter more Wizardry xp (it was half as much again). A print that makes one page makes one or two, one and a half on average.",
    ],
  },
  {
    date: "2026-09-28", title: "Bronny's order: the server's daily 2X",
    items: [
      "BRONNY THE FOREMAN is rebuilding the Yard. Find him at his worksite by the Yard's west gate. He posts ONE ORDER for the whole server: five lines, one each from fishing, woodcutting, mining, monster drops and cooking, always two early-game, two mid-game and one late-game, so there's something for everybody to bring.",
      "Hand in from your bag, any amount, any time: it all goes on the same bars, and his window shows the clock, the bars, what you've got and who's helping. What you hand in is gone for good (he's building with it), and he only takes what the order still needs.",
      "FILL IT AND THE WHOLE SERVER GETS A 2X POTION. It waits at Bronny until somebody who helped claims it, then it's 30 minutes of double tickets and double crafting xp for everyone online, and Bronny puts up the next order. An order that runs out unfilled is replaced by a fresh one.",
    ],
  },
  {
    date: "2026-09-28", title: "A new look, and monsters that land their hits",
    items: [
      "MONSTERS LAND THEIR HITS: out in the world, a monster now aims at the gear its level asks for, all of it, amulet and ring included. Fight something at your level in your tier's kit and it lands about 4 swings in 10 (it was nearer 2). More defence still helps all the way up, reforges included, but it never switches a monster off. Its hits are a little smaller to match, so a fight costs about half again what it did: pack food. The Yard's starters, the Tower and the dungeons are unchanged.",
      "A NEW LOOK FOR EVERY WINDOW: one style across the game, with titles in a new face and a new text face for everything you read. The Market is a Grand Exchange (your eight offers always in view, browse by item, sell from what you own), the quest log is a journal (what you're on, what's near, the step you're on), and the Hiscores have a podium and your own rank pinned at the top.",
      "THE SCREEN: a slim health bar, a slimmer top bar with your menu under your name and settings behind the gear, one wallet strip under the bag, a quest tracker on screen, a paper-doll equipment tab, and I / U / K / J for the bag, gear, skills and quests.",
      "FIXED: right-clicking a tree, rock or fishing spot that needs a tool shows its card again.",
      "THE BUG BUTTON: the ladybird beside your hotbar (or Bugs & ideas under your name). Report a bug or suggest a feature, and see what happens to it: your own reports show their status, and the board shows what's been fixed, what's been added, what's in progress and what's on the backlog. When yours moves, you're told in chat, and the button wears a red count until you look, even if it happened while you were away.",
      "XP/H ON THE TOP BAR: the skill you've trained most recently and its xp an hour this session. Point at it for every skill you've trained, how far through the level you are, and how long until the next one.",
      "CASHING OUT: the Prize Counter now says how many of your 100 ZCoins a day are free right now and when the next lot comes back. It's a rolling 24 hours: each ZCoin comes back a day after it left.",
      "BREEDING: two Greater pets that only have the same one stat can breed now (they could never pick two different stats).",
      "Big numbers fit the wallet strip (313K, 3.1M), and its candy corn counts your bank too. Planting a crop pays a little Harvesting xp. Devil's dice turn up half as often.",
      "BOM'S PRIZE COUNTER, REBUILT: tabs for Sell, Buy, Buy back and ZCoins, Bom himself at the top (with plenty to say), and a lot more cha-ching: your tickets fly into your pile and count up as you sell, fly out onto what you buy, and a big trade-in gets the win banner.",
      "BUY BACK: sold something by mistake? Bom keeps the last 8 things you sold him for an hour, and sells each one back for exactly what he paid you. Reforged gear comes back at its level.",
    ],
  },
  {
    date: "2026-09-27", title: "The Depths of the Mountain, and chat that remembers",
    items: [
      "THE DEPTHS OF THE MOUNTAIN is open: north of the Thunderhead and south of the Trailer Park. Ledges of mossy rock over a drop nobody has found the bottom of, combat 73 to 84. Old Pickett at the landing has three quests.",
      "A MINING MAP. Abyss crystal on the east wing (Mining 75), eclipse (70) and nova (80) in the throne room behind the Iron Ogres. Abyss crystal is the richest jewel vein in the game: any of ruby, sapphire, topaz or opal can turn up in it.",
      "EVERY MONSTER HERE SHRUGS SOMETHING OFF. Pot Boys take 75% less from Magic; Abyss Wisps hang over the drop where no sword reaches (bring a bow); Crystal Ogres shatter arrows (90% less); Iron Ogres take 90% less from everything except Void magic. Goblin Cutters and the Deepwarden take it all, and hit very hard.",
      "THE DEEPWARDEN guards the throne at the far end. Share the kill. He always drops nova ore and abyss crystal, sometimes an opal, 3% of the time the Deepwarden's sigil (an amulet: more tickets, a little tougher), one in sixty a Pot Boy pet, and ONE KILL IN A HUNDRED the chase: THE MOUNTAIN'S HEART, a ring with a singularity ring's stats at Hitpoints 84 that makes every jewel in the rock turn up twice as often.",
      "Pot Boys carry the odd ruby, sapphire or topaz, about one kill in twenty-seven.",
      "EVERY MONSTER'S CARD AND WIKI PAGE NOW SAYS WHAT IT RESISTS: Melee, Archery and Magic as a percentage, 0% included. Right-click one to see it.",
      "CHAT REMEMBERS. A refresh, a restart or logging in now opens on the last fifty lines of chat instead of an empty box."
    ]
  },
  {
    date: "2026-09-27", title: "The Boardwalk: six islands west of the Carnival",
    items: [
      "THE BOARDWALK is open, out the Carnival's west fence. It is six islands: the Market, Cabin Coast, the Lighthouse, Shipwreck Isle, Pirate's Pier and Skull Isle. Each island's rowboat takes you to the next (and back). The monsters get tougher the further out you row: gulls and deckhands (66-69), Clawhands (74), Kraken Arms (78).",
      "FISHING 60 TO 84: mackerel (60), bluefin (72) and swordfish (84), cooked at the Market's Chip Shop or smoked for a twenty-minute buff. Fishing on the Market and Cabin Coast starts at Fishing 60.",
      "ORE AND WOOD ON THE WAY: starfall, eclipse and nova rocks (Mining 60, 70, 80), and island palms (Woodcutting 60) on most islands. Rubies and friends turn up in the ore like anywhere else; the Gems guide lists every rock.",
      "CAPTAIN CLAW holds Skull Isle, the last island. Everyone who hurts him shares the kill, and when he falls his treasure chest rises out of the sand: each of you opens it once for tickets, opals, sapphires, claw pins and cooked swordfish. He is back 45 minutes later.",
      "CAPTAIN CLAW'S GRIP: new gloves only he drops (1 in 25, and a small chance in the chest). Defence 8, accuracy and strength +4, a little quicker, a little harder to hurt. Melee 75.",
      "Salty Meg at the Market has three quests: mackerel, the deckhands, and the captain.",
      "Monsters out in the Boardwalk, the Foundry and the Orchard Wall take a few minutes to come back (longer the higher their level), not seconds like the Yard."
    ]
  },
  {
    date: "2026-09-27", title: "Where gems come from, on the wiki",
    items: [
      "GEMS, on one page: the new Gems guide lists all four, every rock that turns each one up, where it is, the Mining level, the chance (1 in 71 ores) and what each gem is for. Every Ruby, Sapphire, Topaz and Opal page says the same, and each ore's page says which gem it can come with.",
      "The wiki no longer points at monsters or recipes you cannot reach yet."
    ]
  },
  {
    date: "2026-09-27", title: "Ranged fighting trains Hitpoints slower",
    items: [
      "HITPOINTS AT RANGE: with a bow or a wand, the Hitpoints xp from each hit is a third of what a melee weapon gives. Archery and Magic xp are unchanged, and melee is unchanged. Your Hitpoints level is your maximum health, so a ranger still grows sturdier, just more slowly."
    ]
  },
  {
    date: "2026-09-27", title: "Breeding, Fungiculture, and pets change hands",
    items: [
      "BREEDING: put two pets in the pet pen on your island. Two Ordinary pets make a Greater one with the two stats you pick from its parents, 25% stronger, glowing blue. Two Greater pets of the same kind make that pet's Legendary, glowing orange. Both parents come back when you collect the baby, so a pair can be bred again and again to train the skill. Eggs drop from monsters and hatch in a hatchery, which Yahsmeena sells.",
      "PET FOOD: Ordinary, Greater and Legendary, cooked at a campfire from monster drops and mushrooms (Cooking 20, 50 and 80). Every recipe is on the food's wiki page and in the Breeding guide.",
      "FUNGICULTURE: buy a Cellar ladder from Yahsmeena, climb down, make compost at the bin and grow mushrooms in the beds. Every outdoor map also has three wild clusters you can pick once a day. The Fungiculture guide lists every shroom and every recipe it goes into.",
      "PETS CAN BE TRADED AND SOLD. Offer them in the trade window next to items and tickets. List one on Livia's Exchange under the new Pets tab: anyone can buy it outright and the money goes to your bank, less 1%. Or sell one to Bom at the Prize Counter (Ordinary 1,000, Greater 5,000, Legendary 25,000 tickets). A traded pet keeps its rank, its stats and its name.",
      "THE BUFFS BAR shows each buff as its icon and colour only. Hover one for its name, what it does and the time left.",
      "THE BANK, REBUILT: five PAGES to file things on (drag an item onto a page, or hold / right-click it and pick one), tabs by kind (gear, ranged, tools, food, materials, seeds, breeding, potions), one search over bank and bag, your own amount beside 1 / 5 / 10 / All, and a meter of slots used and what it is all worth. Your bag is the leather panel on the right.",
      "A BOW OR WAND FIRES ONLY WHAT IS LOADED in its quiver or Magic Bag. Arrows and pages in your bag no longer fire on their own: load them. Clicking a different kind swaps it in.",
      "NO PET YET? Cooking pet food trains Breeding a little until you have a pet or an egg.",
      "YOUR BAG HAS SLOTS, like OSRS: drag an item to any slot (an empty one takes it, an occupied one swaps), a used-up stack leaves a gap, a new item takes the first gap, Sort packs it. In the bank, drag a bank item onto your bag to withdraw, a bag item onto the bank to deposit, or onto another bank item to reorder.",
      "FAVOURITES: right-click (or hold, on a phone) an item in your bag and star it. Favourites wear a star, come first when you Sort, and Deposit bag, Stack all and Sell all leave them with you.",
      "ON A PHONE: the map is closer (a tile is thumb-sized), the top bar is one line with a More button, the stats are one row so your bag is in reach, and the tab bar sticks while you scroll. Sideways, the panel is narrower so the game has room.",
    ],
  },
  {
    date: "2026-09-27", title: "The Store, the world map, and Bom pays less for gear",
    items: [
      "THE STORE, in the top nav: tickets only. A 2X Potion for the whole room (100,000), clovers and homeward scrolls, and name cosmetics that everyone sees over your head and in chat: colours, effects, badges and frames. Nothing there changes a fight or a roll.",
      "A WORLD MAP replaces the how-to-play tab: every open map as its real shape, roads between them, the combat band coloured against your level, quest arrows, who is where, and a fog over maps you have not set foot on. Click the minimap or the tab to open it.",
      "BOM PAYS AN EIGHTH of the shelf price for smithed gear, down from a quarter (and a reforged piece's bonus halves with it), AND NEVER MORE THAN 2,500 FOR ONE PIECE, reforged or not. Bronze through dragonstone are under that and unchanged by it; onyx and everything above it buys back for 2,500. Smithing high gear to sell it was printing tickets the ore never earned: five nova bars sell for about 4,900, and the cuirass they made sold for 75,000.",
      "BARS FROM ONYX UP COST TWICE AS MUCH TO SMELT: twice the ore, twice the grimstone or voidglass and twice the charcoal. A starfall, nova or singularity bar still takes ONE bar of the tier below, which has already doubled, so every top bar costs exactly twice what it did. They sell for the same, so smelting to sell pays about half what it did.",
      "THE SKILLS TAB is a grid of tiles; click one for its wiki page. Quest givers now say which step comes first when it is with somebody else.",
      "TYPE /pumpkin IN CHAT to time the Pumpkin King: how long until he rises, or how long he has left and how much health. Only you see the answer.",
      "TEMPER AND FLUX, EXPLAINED on the Smithing page: carrying one does nothing until you click its button at the anvil's Reforge tab so it lights up.",
      "THE PUMPKIN KING IS A CROWD'S BOSS. He has ten times the health he launched with (5,200), anyone can hit him, and everyone who does at least 5% of his health gets their own drops, corn and quest credit. Three players take about ten minutes; alone, you will not finish him before he sinks. His combat xp is ten times what it was, because xp is paid per point of damage.",
      "COMBAT MEANS ONE NUMBER. The Combat hiscore and the skills tab now show your combat level, the same number as the stats panel; Melee has a board of its own.",
      "THE HISCORES, SORTED. The rail is grouped into Combat, Skills, Records and Dungeons & runs, in the skills panel's order. Alchemy has a board at last. THE TOWER ranks the highest floor anyone has cleared, THE PYRAMID has a fastest-clear board, and every dungeon board filters to 2-man, 3-man and 4-man clears, each kept as its own top twenty, so a pair's record is never pushed off by a party of four.",
      "ZCOINS OUT OF THE GAME ARE 100 IN ANY 24 HOURS, per person: tickets traded at the counter and found ZCoins banked count together. Ticket bets keep their own allowance of 50 ZCoins' worth an hour.",
    ]
  },
  {
    date: "2026-09-27", title: "The Wilderness, rebuilt",
    items: [
      "THE WILDERNESS AND THE DEEP WILD are new maps: rock walls, winding roads, a plateau, cave mouths, waterfalls, lava in the Deep. The skilling nodes moved into far pockets held by stronger monsters, and the far corners now carry yew, dragonstone, onyx, starfall, skyash, mooncarp and stormmarlin.",
      "THREE MONSTERS LIVE ONLY THERE: the Wild Weaver (wild silk, four silkstrings a coil), the Marrow Hound (marrow, for the wild-only marrow arrow) and the Grim Lich in the Deep (grimcore, which brews Void ink with grimstone, and seeds ten times as often as anything else).",
      "A THIRD OF THE WILD ATTACKS FIRST, most of it around the nodes, and everything there takes 45 seconds to 2 minutes to come back.",
      "UTILITY PAGES print from Wizardry 50 to 99 now; Waystones are printed on a grimstone. Seeds are rare, but a harvested seed crop gives two seeds back every time, and one harvest in ten gives three.",
      "NOTHING BUT TICKETS ALWAYS DROPS: every monster's own drop is a 25-45% chance now, and an arrow or a page adds half its strength to a hit rather than all of it.",
      "FORTY QUESTS, in stages: go and see someone, hear them out, fetch or make or defeat a thing, carry it somewhere. Easy ones in the Yard, the Gloam and the Mire; medium in the Boneyard, Cloudreach and the Sands; hard from the Thunderhead out to the Deep Wild. Seven new people give them: Mudge in the Mire, Sister Morrow in the Boneyard, Zephyr in Cloudreach, Rashid in the Sands, Volta in the Thunderhead, the Auditor in the Vault, and Grimm the Hermit by the rope down to the Wilderness. A blue marker over someone's head means a quest has sent you to them.",
      "YOUR BAG HOLDS 25 now, before any pockets Bom sews on.",
      "THE TOP OF THREE LADDERS: voidfin and grimscale in the Deep Wild's Black Pool (Fishing 92 and 97, Cooking to 90, smoking to 95), the glass gourd, ember wheat and starfruit on your island (Harvesting 62, 78 and 92, seeded by the Carnival, the Vault and the Trailer Park), and a Gallows oak in the Deep (Woodcutting 90, fifty shafts a log).",
    ],
  },
  {
    date: "2026-09-25", title: "Fletching and archery",
    items: [
      "ARCHERY FIX: a bow fights with the bow's and the quiver's own accuracy and strength (plus the arrow's), not your melee armour's. Heavy melee gear was making a first bow hit like a high-level one, which raced people through the early arrow tiers. Your armour still counts in full for defence.",
      "DAILY JOBS: every kill job now asks for ten times the kills, for the same tickets. Jobs already on your board today keep the count they were given.",
      "A KEYBINDS page in the wiki (Starting out): every key in one place. Number keys in a conversation now only answer it; they no longer use your quick slots as well.",
      "MAGIC AND WIZARDRY. A third way to fight: hold a wand, load a Magic Bag with spell pages, and every hit pays Magic xp. Five elements (Fire, Frost, Storm, Void, Sun), and every monster may be weak to one and resist another: hover it to see. Wizardry prints the pages at altars around the world, from paper and ink brewed out of flowers you grow on your island. The Nexus, deep in the Wilderness, prints anything, twice. Utility pages give buffs (Haste, Focus, Ward, Rainmaker and more) and four Waystones carry you across the world. The Magic 1 kit is on Brutus's shelf.",
      "E EATS your best cooked food: whatever heals most. It never touches potions, drinks, buff meals or smoked fish, and does nothing at full health.",
      "QUICK SLOTS: four slots beside the chat button, on keys 1 to 4. Click an empty one to put a potion, food, a buff, arrows or a piece of gear in it; click or press its number to use it; right-click to empty it. They follow you to any device. The emote buttons that used to sit there are gone.",
      "STACK ALL in the bank puts every stack in your bag that the bank already holds straight in, in one click. Bows twang less: a shot is now one of four recorded swishes.",
      "THE TOWER MOVED up behind the north court's railing, into the trees, and the fletching table took its old spot, so the court has room to breathe. Bows and quivers can be reforged now, in their own wood, at the fletching table or the anvil (Fletching, not Smithing): a bow gains accuracy and strength, a quiver a tenth more room a level. Crafting lists say when a recipe makes more than one: \"Feather ×15\".",
      "BOWS SOUND AND LOOK LIKE BOWS. A shot twangs, the arrow you loaded flies across (a diamond arrow looks like one), and it lands with a thud and a puff of splinters and feathers; a crit lands heavier and gold.",
      "COMBAT IS NOW MELEE. The skill you train with a weapon is called Melee, and your combat level is Melee, Archery and Hitpoints together: your stronger style counts in full, the other adds on top. Nobody's combat level went down.",
      "ARCHERY IS A COMBAT SKILL of its own. Hold a bow and every hit pays Archery instead of Combat, damage for damage, and every roll in the fight reads it. It is on the skills panel, the hiscores and profiles. Fletching makes the kit; Archery draws it, and the rough shortbow, the rough quiver and bone arrows are Archery 1 on Brutus's shelf.",
      "A BOW SHOOTS FROM WHERE YOU STAND. Click something inside its reach and you never move; further away and you walk only to the edge of it. Big monsters take a fifth more from an arrow. With a loaded quiver you draw on the next one of the same kind when your target dies, and the idle timer runs eight minutes.",
      "Three Thunder Geese sit over the tear in the Thunderhead's floor. Only an arrow reaches them.",
      "Arrows stack to 1,000. Feathers are 1-3 a kill now, and the cauldron brews fifteen from a small vial, three feathers and a sulky sporecap at Alchemy 5.",
      "A NEW SKILL. Cut logs into shafts and bows at the fletching table in the Yard, fletch arrows from a shaft, a smithed arrowhead and a feather, and go and shoot something. A bow in your hand sets how fast you draw and how far you reach; the arrow you load sets how hard it lands. Every wood makes a shortbow and a longbow, every metal makes an arrow, and the ladder runs 1 to 99.",
      "QUIVERS wear the offhand and hold one kind of arrow in bulk \u2014 click arrows in your bag to load one. A shot draws from the quiver first.",
      "GEMS come out of ore now: rubies, sapphires, topaz and opals, about one rock in seventy, and each tips the arrows of the metals it was mined with for extra damage.",
      "FEATHERS are back on chickens. They are worth nothing at the counter now \u2014 they are a component, not loot \u2014 which is what let them back onto the bird without touching its wage.",
      "Logs have a second use. Every tree in the game now makes bows and shafts as well as charcoal, and a better tree gives more shafts per log.",
    ],
  },
  {
    date: "2026-09-25", title: "Pick what you are making, and nothing is a sure thing",
    items: [
      "THE CAMPFIRE, THE RANGE, THE FURNACE AND THE CAULDRON NOW ASK WHAT YOU WANT TO MAKE, the way the anvil always has. They used to take the hardest thing they could, so a bag with sardines and one bowfin in it only ever cooked the bowfin, and sand at a cauldron was always the large flask. One click still starts straight away on your last choice there; the panel beside it is only there if you want to change your mind.",
      "NOTHING YOU SMELT, HAMMER OR SMOKE IS A CERTAINTY ANY MORE — one attempt in ten fails, at every level, and it takes the materials with it. A scan found 114 recipes that could never fail at all: 95 pieces of gear, seven bars, nine smoked fish and the three anvil consumables. All of them now can.",
      "The panel prints the chance on every row, so you always know what you are risking before you start.",
      "NOVA AND SINGULARITY NEVER FAIL, deliberately. Their weapons already want a core that drops about one kill in two thousand, and gambling that as well would be cruel rather than tense.",
      "COOKING IS UNCHANGED, and so is plainly cooking a fish you could have smoked. Each fish still has a level at which it never burns again.",
      "COOKING IS UNCHANGED. Each fish still has a level at which it never burns again — that promise stays.",
    ],
  },
  {
    date: "2026-09-25", title: "A wiki pass: the tables now write themselves",
    items: [
      "THE MINING, WOODCUTTING, FISHING, COOKING, SMOKING, TOOLS, THIEVING AND “road out” TABLES ARE NOW BUILT FROM THE GAME'S OWN RULES. Between them they had thirty-odd wrong numbers: every sell price in three of them was double what Bom pays, six cooked fish healed a different amount on the page than in your hand, vaultwood was listed fifteen levels and a whole axe grade low, and grimstone was in the wrong zone with the wrong pickaxe.",
      "AND A GREAT DEAL WAS SIMPLY MISSING: the Golden Sands and the Carnival were not on the map of the world, five waters were not in the fishing table, nine dishes were not in the cooking one, and four of the eight thieving marks had no entry at all. Sand, willow, palm, skyash, rustpine, bogwood and the carnival wreck now say where they come from on their own item pages, which none of them did.",
      "THE TOWER AND THE CARNIVAL HAVE GUIDES, which they never have. The Tower's is written for the 99-floor climb: what a floor costs you, how much food to bring, and where the checkpoints are.",
      "FIGHTING NOW EXPLAINS CLICKING AGAIN TO SWING FASTER, and the jackpot kill. Neither was written down anywhere.",
      "Four guide links went nowhere when clicked, and one was labelled with the name of a different page. A checker now fails on all of that, so the next new fish cannot quietly leave the wiki behind.",
    ],
  },
  {
    date: "2026-09-23", title: "Rocks hold a lot more ore",
    items: [
      "EVERY ROCK IN THE WORLD NOW HOLDS 2 TO 12 ORE instead of 1 to 5. What you actually feel is the interruption going away: running a rock dry stops you and makes you pick another one, and that now happens less than half as often. Measured, that is about 4% more ore an hour at low levels and nearly 7% by level 40 &mdash; and a great deal less clicking, which is the part you will actually notice.",
      "It counts ore TAKEN, not swings, so a failed swing costs you time but not depth &mdash; same as before.",
      "Rocks already standing in a loaded area keep the number they were given until they next run out, so this arrives over a minute or two rather than all at once.",
    ],
  },
  {
    date: "2026-09-23", title: "A reforge belongs to the item now",
    items: [
      "YOU CAN SELL A REFORGED PIECE, AND THE BUYER GETS THE REFORGE. Until today a +3 belonged to YOU rather than to the axe: sell it and the buyer got a plain one, while you kept the +3 and would find it waiting on the next axe you picked up. The level lives on the piece now, so it goes where the piece goes.",
      "WHICH MEANS YOU CAN OWN TWO OF A KIND AT DIFFERENT LEVELS. A plain Diamond axe and a +3 Diamond axe are different things and sit in different bag slots &mdash; so a reforged piece costs you a slot, which is the honest price of it.",
      "NOTHING WILL EAT YOUR BEST PIECE. Selling, eating, banking or handing over several of something always spends the PLAIN ones first; the reforged one is only ever touched when you pick it out yourself.",
      "AT THE MARKET you choose which one you are listing, the listing says &quot;+3&quot; in its name, and hovering it shows exactly what that reforge is worth. A buy offer for a plain one will never be filled with a reforged one, or the other way about.",
      "AT THE ANVIL, if you are WEARING one it works on that; otherwise it takes the best one in your bag. So carrying a +2 up to +3 keeps working on the same piece, and a plain spare is only touched when it is all you have.",
      "FACE-TO-FACE TRADES STILL PASS PLAIN PIECES ONLY, for the moment. A trade offer has nowhere to record a level yet, and rather than hand somebody a plain axe while destroying your +3 we have left reforged pieces out of it. The market handles them properly; the trade window is next.",
      "AND YOUR EXISTING REFORGES HAVE MOVED ONTO YOUR ACTUAL GEAR &mdash; what you are wearing first, then your bag, then your bank. If you had a level recorded for something you no longer own, it is gone, which is the whole point of the change.",
    ],
  },
  {
    date: "2026-09-23", title: "Every rare drops at 1 in 100",
    items: [
      "ONE RATE FOR EVERY RARE. A monster's named rare drops — the rings, the hoods, the King's set, the seed crops — all land at exactly 1%, instead of the hand-set numbers between 0.4% and 25% they used to have. It is one rule you can hold in your head, and it applies to anything we add from here on without us having to pick a number for it.",
      "SOME THINGS GOT RARER AND SOME GOT COMMONER. The goat's toga was one in four and is now one in a hundred; the Junk King's cap and wrench come down a long way too. Going the other way, the Loss adjuster's visor, the Bookie's amulet and a few others were under 1% and are now easier.",
      "TWO THINGS ARE DELIBERATELY NOT ON THE FLAT RATE. Real ZCoins still climb with the monster's level, and the casino chips, boxes and dice still scale with what the monster pays — so a bigger monster still turns up more of them. Flattening those would have made farming chickens the best earning in the game.",
      "And a correction: this guide still quoted the old ZCoin fishing rates after yesterday's halving. A sardine is about 1 in 800 and a thunder squid about 1 in 556.",
    ],
  },
  {
    date: "2026-09-23", title: "Bom will take your spare rares now",
    items: [
      "EVERY RARE HAS A BUYER. Twenty drops &mdash; the casino set, the Junk King's two, the Tax Wraith's hood, the mystery boxes &mdash; had nobody who would take them, so a second one was worth nothing at all unless another player happened to want it. Bom takes them now.",
      "HE LOWBALLS YOU AND WE ARE NOT HIDING IT. He pays a quarter of what the piece is reckoned to be worth, which is the same deal he gives on gear: he buys an Eclipse gladius back for 539 and sells one for 92,400. Selling to another player will basically always be the better idea. This is a floor under a duplicate, not a price.",
      "IT IS ONE CLICK PER ITEM, AND &quot;TRADE IN THE LOT&quot; STILL CANNOT TOUCH IT. Your rares are a separate list with their own buttons, deliberately, so no amount of clicking the big button can sell the ring you are wearing.",
      "A Green house chip is not on the list on purpose: using one already pays 100 tickets, so a quick sell would only ever be the worse button.",
    ],
  },
  {
    date: "2026-09-23", title: "A bank on your island, and the island looks like one",
    items: [
      "YAHSMEENA SELLS A BANK CHEST, 10,000. Put it down anywhere on your island and it opens your bank &mdash; the same bank, the same rules &mdash; so a full bag of crops no longer means a trip back. It is the only thing in her shop that does anything; the rest is for show, and that is deliberate.",
      "THE PLOTS ARE DRAWN NOW. Every crop has four growing stages, hand-drawn, and the last one means ripe: if it looks finished, it is. They had been three coloured rectangles because the pictures were made a week ago and never wired up.",
      "SO IS THE DOCK. Real planking, running the length of the pier instead of a flat brown rectangle with lines ruled across it.",
      "IF YOU OWN THE FAR SHORE, YOUR ISLAND WAS DRAWING ITSELF WRONG. The largest island was the one tier nobody had listed in the art, so its plots, palms, pedestals, pen, ferry and lighthouse were all falling back to rough shapes. Fixed.",
      "And the guide for islands said Charon runs a ferry at River Bend. He has worked from a cart in the Yard since the Forum closed.",
    ],
  },
  {
    date: "2026-09-23", title: "Wheat in the Yard, and the medals are real",
    items: [
      "WHEAT GROWS IN THE YARD NOW &mdash; three patches, well apart: one in the north-west above the copper, one beside the path through the middle, and one out in the south-west meadow. They grow back on their own, they need nothing in your hand, and each one is 8 Harvesting xp.",
      "WHICH MEANS HARVESTING CAN BE STARTED. It could not before, and that was our mistake rather than anything you were doing wrong: the only wheat in the game was in a part of the map that is shut, this guide has been pointing at the Yard the whole time, and every other crop needs a level you could only get by growing something. Wheat is the level 1 crop and it is now where the wiki always said it was.",
      "THE ACHIEVEMENTS WINDOW HAS BEEN REDRAWN. Every tier wears its own medal &mdash; bronze, silver, gold, a cup and a crown &mdash; instead of its name in a colour that was close to unreadable on parchment. Ticket amounts show the real ticket rather than an emoji, tier headings say what the tier pays on a line of their own, and the button in the bar carries the same badge the window does.",
      "SMALL, BUT WORTH SAYING: every 'Sells' column in these guides was still quoting yesterday's prices after the halving. Twenty-nine of them were wrong and they are right now, and the wiki checker reads those columns from the rules from here on so they cannot drift again.",
    ],
  },
  {
    date: "2026-09-23", title: "Half the tickets, and the tables take a cut",
    items: [
      "EVERYTHING YOU SELL NOW PAYS HALF. The Cashier, Brutus and the tickets a kill carries have all been halved together &mdash; fishing, mining, woodcutting, farming and fighting alike &mdash; so nothing has become a better or worse way to earn than it was yesterday. What things COST has not changed at all, so gear, bag pockets and island plots each take about twice as long to save for.",
      "WHY. Tickets were being made a great deal faster than there was anything to spend them on: every price in the game put together came to about forty hours of play at the top band, and after that tickets had one use left. At 1,000 tickets to the ZCoin that was quietly minting more ZCoins than the whole of the rest of eastcoin.vip added together.",
      "THE TABLES NOW TAKE A CUT. A ticket play pays between 93% and 99% of the fair price, drawn fresh every play, so the house keeps about 4% &mdash; a little under a roulette wheel. No play is ever better than fair any more, which means there is still no table worth shopping for. It was 96% to 104%, which averaged exactly 100% and so drained nothing at all. The ZCoin tables on eastcoin.vip are untouched and still pay 96% to 104%.",
      "REAL ZCOIN DROPS ARE HALVED TOO, from kills and from fishing alike. They were never the big half of it &mdash; an hour of fighting dropped about four and converted about forty-five &mdash; but they are part of the same flow.",
      "THE CRYPT CAME WITH IT. Antes and clears are both halved, so a clear is still worth about half again what the same minutes pay on your own. The slots ticket jackpot starts at 10,000 now for the same reason.",
      "WHAT DID NOT CHANGE: the daily jobs, the prize wheel, achievement rewards, free-play chips, and every price in the game.",
    ],
  },
  {
    date: "2026-09-23", title: "Tools reforge into tools, and your +2 shows",
    items: [
      "A REFORGED PICKAXE, AXE OR ROD NOW BUYS SPEED, not accuracy and strength. Offering combat stats on a skilling tool never made sense — tools are deliberately poor weapons — so a level is +2.5% at what the tool actually does: mining, chopping or fishing. Three levels is +7.5%, just under a full tier, so reforging still gets you closer to the next rung without jumping it.",
      "FISHING RODS CAN BE REFORGED AT LAST. A rod has no combat stats at all, which is the only reason it was refused; now that tools reforge on speed there is nothing to refuse. The three starter bronze tools can be reforged too.",
      "RINGS AND AMULETS CAN BE REFORGED. They give a little of everything, so a level moves all three stats — which makes jewelry the best value on the anvil. A ring costs 2 bars an attempt, an amulet 3.",
      "YOUR REFORGE LEVEL IS VISIBLE NOW. A +2 shows in gold on the item in your bag and on your character, not just at the anvil. If you gambled bars for it you should be able to see it.",
      "A FIX: reforging was quietly paying about a quarter of what the anvil advertised. The bonus is a percentage of the piece's own stat OR +1 a level, whichever is more — but the +1 floor was only being applied to the number on screen, not to the stats you actually fought with. A full set at +3 was giving +5 defence where the anvil said +18, and a +3 weapon swung exactly like a plain one. Everyone's existing gear now does what it always said it did.",
      "The anvil also stops saying \"next level adds nothing to this piece\" — that was the same bug, and it was wrong on over half the list."
    ]
  },
  {
    date: "2026-09-22", title: "Rocks hold more than one ore",
    items: [
      "EVERY ROCK, EVERYWHERE, NOW HOLDS 1 TO 5 ORE. It used to give exactly one and then sit empty for eight seconds — and it stopped you mining, so every single ore cost a click and a wait. You stand and work a rock now, the way you work a tree or a fishing spot, and it only runs out when it is actually out.",
      "That is roughly twice the ore an hour, and the number of rocks in a zone no longer caps how fast you can mine. The big veins are unchanged: they never run dry and never did.",
      "THE RUN is entered by a rope ladder now, north of the market at the top of the Yard, instead of a door.",
      "The Yard's two choppable trees are a gnarled Old oak, so you can tell them from the 126 that are only scenery — and they leave a proper stump."
    ]
  },
  {
    date: "2026-09-22", title: "A forge in the Yard, reforging, and smoked fish",
    items: [
      "THERE IS A FURNACE AND AN ANVIL, in the Yard's north court beside the Crypt stairs and the Tower. Smelting and smithing have had recipes all along and nowhere to do them — every bar and every piece of gear is now actually makeable. The court grew two rows north to fit them.",
      "REFORGING, at the anvil. Spend bars to push a piece you already own further: a level adds 5.5% of that piece's own stats or +1, whichever is more, up to +3, which is worth about one gear tier. A fully reforged set slightly beats a fresh set of the tier above — so it is a way to keep going when the next tier is out of reach, not a way past it.",
      "THE ODDS ARE ON THE BUTTON, and so is the risk. +1 always works. +2 is 80%, +3 is 55%. A miss normally knocks the piece down a level — but at +2 there is an 8% chance, and at +3 a 15% chance, that it CRACKS APART AND IS GONE. About one piece in seven is lost on the way to +3. The bars go whether it works or not, and a broken piece takes its level with it.",
      "SMOKED FISH give you twenty minutes of something: tougher, better drops, more tickets, or quicker on your feet. Smoke instead of cooking by having charcoal on you — the fire does it automatically when it can, and drops back to plain cooking when the charcoal runs out. Seven kinds, from ghostcarp up to bowfin.",
      "CHARCOAL ALSO STEADIES A FIRE. Carrying it means your cooking will not burn — it spends one instead of taking the roll, and only when the risk is worth it, so it is never quietly wasted on a fish you were never going to ruin.",
      "YOUR OWN PET IS VISIBLE TO YOU NOW. Everyone else could always see it at your heel; you could not see your own. Sorry about that."
    ]
  },
  {
    date: "2026-09-22", title: "The furnace burns wood now, and the top maps bite",
    items: [
      "EVERY SMELT TAKES CHARCOAL. Bronze wants one, Eclipse wants four. If your smelting has stopped working, that is why: put logs in your bag and stand at the furnace anyway. It burns a log, smelts, burns another — you do not have to do anything differently.",
      "CHARCOAL IS BURNT LOGS, made at the furnace. BETTER WOOD GIVES MORE: plain logs and willow give one, ash and pine two, yew three, void and bogwood four. One bogwood log fuels an Eclipse bar where it would take four ordinary ones and most of a bag. It sells for less than a log does — burn it to smelt, not to sell.",
      "Woodcutting was the only gathering skill that fed nothing. Now it feeds the same furnace mining does.",
      "SOME MONSTERS ATTACK ON SIGHT AGAIN, from the Boneyard upward — and only there. The Yard, the Gloam and the Lantern Mire stay exactly as calm as they were. Nothing reaches further than three tiles, so it is a thing you walked up to, not a thing that crossed the map at you.",
      "It is where the good wood, ore and fish are: the Boneyard, Cloudreach, the Thunderhead, the Trailer Park and the Vault. Turning up at a level-80 tree with no way to defend yourself is now a decision rather than a free lunch.",
      "A HISCORE BOARD FOR EVERY SKILL, plus Total level. It was Combat and Fishing only."
    ]
  },
  {
    date: "2026-09-22", title: "Luck cut back, and the Market shows what Bom charges",
    items: [
      "LUCKY CLOVERS AND HORSESHOES ARE RARER, and worth less. A clover turned up every TWELVE gathers and was good for fifteen lucky actions, so anyone skilling was lucky more than full time — which is not a buff, it is the baseline with extra words.",
      "The bonus is now 5% more likely to find a real ZCoin, down from 25%. Clovers drop about 1 in 100 gathers (was 1 in 12) and horseshoes about 1 in 600 (was 1 in 150). Luck is on roughly a fifth of the time now instead of always.",
      "THE MARKET SHOWS WHAT BOM CHARGES. Picking something to sell, each row in the list carries his price beside your count, and it sits on the reference line with cheapest-listed, best-offer and last-sold while you set yours. Half the goods have no figure because he does not sell ore, fish, logs or drops — those say nothing rather than inventing one."
    ]
  },
  {
    date: "2026-09-22", title: "The Trailer Park",
    items: [
      "A NEW ZONE, north off the Thunderhead. Combat 80 to fight in it, Fishing 80 for the water. The road west still ends at the Vault — this is a turning before it, so the top of the game is a fork rather than a queue.",
      "THE JUNK KING, level 98, in the fenced yard at the east end. Twice the hitpoints of anything else alive, and the only thing that drops his cap or his wrench.",
      "Junkyard Dogs, Rabid Possums, Scrappers and Yard Gators, 80 to 92.",
      "TRUCKS UP ON BLOCKS give up their catalytic converters to a pickaxe — the most valuable thing you can carry out of a scene. Slagstone from the bank behind the yard, rustpine and bogwood to cut, and mud cat and bowfin in the black water, which cook into the best food in the game.",
      "All of it wants a top-rung tool. Until now there was nothing above Vaultwood to chop and nothing above the Vault to mine, so the last three rungs of the tool ladder had nothing to do."
    ]
  },
  {
    date: "2026-09-22", title: "The Run has something to do in it",
    items: [
      "AGILITY NOW PAYS. Every level made you very slightly quicker — except it didn't: the bonus was written the day the skill was built and never connected to anything. It is connected. At 99 you move 9% faster, everywhere, forever.",
      "PERFECT GATES. Cross a gate within a quarter-second of it opening and it counts as perfect, and the count carries through the lap. Eight out of eight DOUBLES what the finish pays.",
      "MARKS ON THE COURSE. Three are scattered down the lane at the start of every run, always off the middle row — so fetching one costs you a beat, and maybe the gate you were lined up for. They pay tickets and Agility xp. Yours alone: nobody can take the ones dropped for you.",
      "BEST LAPS ARE ON THE BOARD, at the start of the course and in the Hiscores window. Your own best also sits on the Agility row in the Skills tab.",
      "And the course has its sign back, and a way out. The passage down to the door had been walled off, so anyone who went in could not walk out again."
    ]
  },
  {
    date: "2026-09-22", title: "Tools come in seven grades, and the Yard has a market",
    items: [
      "PICKAXES, AXES AND RODS NOW HAVE TIERS — bronze, emerald, diamond, dragonstone, onyx, starfall, eclipse, the same seven as the armour, each with its own art.",
      "A rock, a tree or a fishing spot asks for a tool of its own grade. The grade it wants is always the grade named on it, so anything you are high enough to work, you are high enough to hold the tool for.",
      "Every grade up is 8% quicker at everything below it as well, so a better tool is never wasted on easy work.",
      "Buy them at the Prize Counter — cheap for their grade on purpose — or smith them: two bars for a pickaxe or an axe, one for a rod.",
      "AND YOU HAVE TO BE HOLDING IT. Pickaxe, axe or rod: it goes in the weapon slot, and one in your bag will not do. A tool in the bag used to count, which with seven grades of each meant the weapon slot was free — you could fight with a sword and mine with whatever was at the bottom of your bag.",
      "ORE YOU CAN ACTUALLY REACH. Every grade of ore below starfall used to sit in a closed map, so there was nothing to train Mining on between 1 and 60. Copper and tin are in the Yard now, emerald in the Gloam, diamond in the Mire, dragonstone in the Boneyard and onyx in Cloudreach.",
      "THE YARD HAS A MARKET. Livia, the bank chest, Charon's cart, the campfire, the jukebox and the stairs down to the Crypt were all standing about on grass. They are on two paved, railed courts either side of the road in from the casino now, with lamp posts, crates and barrels about the place. Each court is fenced on three sides and open to the road.",
      "RAW FISH IS NOT FOOD. Cook it first — and the Cashier only buys it cooked."
    ]
  },
  {
    date: "2026-09-21", title: "The Green Room, a Sportsbook, and animals that walk",
    items: [
      "THE JUKEBOX IS THE GREEN ROOM. It used to run its own little queue. It is now the SAME room as eastcoin.vip/?view=music: the same songs, the same history and rankings, the same reactions and skip votes. Put one on in the Yard and the whole site hears it with you, with your name on it.",
      "Songs are FREE now. They cost 50 tickets before. What limits you is the queue, the same as it limits everyone on the site.",
      "If you have the music page open in another tab, the game keeps quiet rather than playing over the top of it, and says so.",
      "THE SPORTSBOOK: a new board beside Bom Trady, in the casino. It is EastCoin Picks — tonight's real games, their real prices, your record and the season leaderboard — and a pick made here is the same pick as one made on the site. ZCoins only; tickets do not touch it.",
      "The chickens, cows, boars, hornworms and both olives WALK now instead of sliding, and they breathe when they stand still.",
    ],
  },
  {
    date: "2026-09-21", title: "Six jobs a day, and five times the pay",
    items: [
      "THE TASK BOARD PAYS FIVE TIMES WHAT IT DID, and gives you SIX jobs a day instead of three. If you already had today's three, the other three are waiting on the board now.",
      "Each job shows the MONSTER'S OWN PICTURE and WHERE to find it, so you know which way to walk before you start.",
      "The casino's south door is shut for now. Vince is standing in front of it. The arch on the west side is the way out to the Yard, where everything is.",
      "Crits are rarer: the top tenth of what you can hit, and never under 4 damage. A brand-new player was seeing CRIT on half their hits.",
      "A monster's health bar now sits above its head whatever size it is. It used to lie across the big ones' faces.",
    ],
  },
  {
    date: "2026-09-21", title: "The Hoodie's hoard",
    items: [
      "A CHEST EACH. When the Hoodie dies, his hoard appears in front of the throne. Everybody who earned the clear opens it for their OWN loot: nothing is shared and nobody can take yours.",
      "3 TO 7 THINGS. The first is always the clear's tickets (they used to land in your bag at the kill; now they're in the chest). The rest: bonus tickets, drinks, dinners, lucky clovers, Casino scrolls, house chips, and rarely a horseshoe or one of the six rare buff pieces.",
      "Your roll at a real ZCoin happens when you open it.",
      "FORGOT IT? Walked out, lagged out, party left? It's sent after you, the moment you're anywhere else. It can't be lost and it can't be opened twice.",
      "Past your three paid runs for the day the chest is lighter: 3 things, no rare gear.",
    ],
  },
  {
    date: "2026-09-21", title: "The Fight Pit takes tickets too",
    items: [
      "THE FIGHT PIT: BET TICKETS, WIN TICKETS. The Pit has the same ZCoins / Tickets switch as the floor. A ticket bet is 10 to 20,000 tickets on one fighter, and you can add to it until bets close. It's paid in tickets when the fight ends, at exactly the price a ZCoin bet on that fighter gets.",
      "That's every table now: ZCoins in, ZCoins out. Tickets in, tickets out. Trade tickets for ZCoins at the Prize Counter.",
      "FIXED: the Crypt's fastest-clear boards went blank every time the game restarted. They're read back properly now. So are the jukebox's station and the song queue.",
    ],
  },
  {
    date: "2026-09-21", title: "Everything's by the jukebox now",
    items: [
      "THE TOWN IS CLOSED, and nothing you used there is gone: it all moved to the Yard, right outside the casino, around the jukebox.",
      "LIVIA and her EXCHANGE STALL, CHARON and his cart to your island, and the STAIRS DOWN TO THE CRYPT are all there, next to the bank chest and the campfire that already were.",
      "Both of the casino's doors lead outside to the Yard now. Coming back from your island sets you down by Charon's cart.",
      "If you logged out in the town or the bank, you'll wake up in the casino. Your bank is the same bank: the chest in the Yard opens it.",
    ],
  },
  {
    date: "2026-09-21", title: "Tickets in, tickets out",
    items: [
      "BET ZCOINS, WIN ZCOINS. BET TICKETS, WIN TICKETS. Every table on the floor has a ZCoins / Tickets switch. On Tickets you play for tickets and you're paid in tickets: stack them for gear, or trade them for real ZCoins at the Prize Counter (1,000 a ZCoin). It remembers which one you used last.",
      "Ticket bets are 10 to 20,000 tickets (chips: 100, 1K, 5K, 20K), and they no longer use up your hourly ZCoin allowance, so bet tickets as much as you like.",
      "SAME ODDS AS THE ZCOIN TABLES. Every ticket play pays between 96% and 104% of the fair price, drawn fresh each time, 100% on average. No table is the better bet. The prices you see are the fair ones (the coin says 2x); each play lands a little over or under.",
      "The slots have a TICKET JACKPOT of their own, starting at 20,000 tickets. Three sevens on a 20,000-ticket spin takes all of it.",
      "The Fight Pit and Roulette haven't changed yet: tickets there are still a stake that pays ZCoins.",
    ],
  },
  {
    date: "2026-09-21", title: "Trade tickets for ZCoins",
    items: [
      "TICKETS FOR ZCOINS, AT THE PRIZE COUNTER. Bom Trady now trades your tickets straight into real ZCoins: 1,000 tickets for 1 ZCoin, onto your eastcoin.vip balance. Pick how many, press the button. Up to 50 ZCoins an hour (ticket bets and ZCoins you found share that).",
      "Taking an Exchange offer down now puts what was left back in your BAG (your bank if the bag's full), and tells you exactly what went where. It used to go quietly to your bank.",
      "The Prize Counter lists armour and arms above the drinks and dinners. Profiles show a green dot for online, red for offline.",
    ],
  },
  {
    date: "2026-09-21", title: "Look anybody up",
    items: [
      "PROFILES. Right-click somebody in the world, or click their name in the chat log or on a Hiscores board, and you get their profile: the character they made, every skill level, their combat level, kills, quests, crypt clears, tickets earned and time played.",
      "It works for people who are offline too. If they're standing next to you, the profile has Trade and Invite to party on it.",
      "Fishing, cooking, the bag and the rest of the skilling sounds are quieter and always the same now: this is a game you leave running, so the noise it makes had to be one you can sit beside.",
    ],
  },
  {
    date: "2026-09-21", title: "Fishing spots, scattered",
    items: [
      "FISHING SPOTS aren't in a neat row any more. Every pond, lake and sea has its five spots scattered over the first two rows of water, and they come in five looks: ripples, bubbles over a school, lily pads, a whirlpool with a fin, and reeds.",
      "The item that pops up over your head when you catch or gather something is bigger, and the xp number beside it lost its little skill icon.",
      "The PARTY box now keeps up with where everybody is and how hurt they are all the time, not only inside the Crypt, and it sits higher so it doesn't cover the game's messages.",
    ],
  },
  {
    date: "2026-09-21", title: "The Crypt, dressed. And you can't be lagged out of it",
    items: [
      "DROPPED OUT OF A RUN? LOG BACK IN. If the game lags you out, or you refresh, or your internet blinks, your place in the party and in the crypt is held for 3 minutes. Log back in and you're standing where you were. If the boss died while you were gone, you're paid when you're back.",
      "THE CRYPT LOOKS LIKE ONE NOW. Drawn flagstones, brick walls with skulls and shackles in them, broken pillars, cages, open coffins, an altar, ghost-fire braziers, gargoyles, and a throne of bones behind the Hoodie.",
      "A WAY OUT AT THE FAR END. Stairs up to town, in the back wall of the Hoodie's room. They only work once he's dead.",
      "HIT NUMBERS have drawn badges: a red splat for a hit, a gold burst for a crit, a blue shield for a miss. The red-tile slam now shows its number over your head too.",
      "The Hoodie's health bar no longer looks half-empty before anybody has touched him.",
      "DROPS / XP: the chat box has a second tab that lists what you've found and the xp you've earned this session.",
      "The casino's three boards aren't squashed together any more. The TASK BOARD has its own bit of wall, right of the roulette door. Winners' Wall is left of the door, Hiscores further right.",
      "The way out of a room can't hide under the Chat button any more, and every room's doorway is drawn: a doormat, a carpet runner, marble or stone steps.",
      "COOKING IS BACK. There's a campfire just inside the Yard, by the way in from the casino. Click it with raw fish in your bag. Every fish can be cooked now. A cooked fish sells for TWICE the raw one and heals a lot more. You'll burn a few at first.",
      "Higher or Lower and Mines say CASH OUT, with the ZCoin beside the amount. Games, Wiki and Hiscores got proper buttons.",
    ],
  },
  {
    date: "2026-09-21", title: "THE CRYPT: bring a party",
    items: [
      "A DUNGEON YOU CAN'T DO ALONE. Stairs down to the Crypt are in town, beside the bank. It takes a PARTY of 2 to 4: click another player and choose Invite to party. Your party's health shows on the left.",
      "HOW A RUN GOES. Everybody stands by the stairs and the leader picks a difficulty: the Crypt, the Deep Crypt or the Black Crypt. THE DOOR'S NUMBER IS NOT THE FIGHT'S. The doors open at Combat 10, 30 and 40, but a crypt boss has far more defence than its own gate level can swing at: below Combat 22, 47 and 76 you hit it about one time in ten WHATEVER you are wearing, and the fight takes over an hour. Take the Black Crypt at 76 and up, or bring somebody who is. Each of you puts up an ante. Clear the Ossuary and its gate opens; clear the Haunted Hall and the next one does; then everybody alive gathers at the lever to open the Sanctum.",
      "THE HOODIE. Too much health to solo, and more of it the bigger your party. He goes for whoever has hurt him most, so let your toughest player start. When the floor around him turns RED, get out of it: the slam takes two fifths of your health. At half health he whistles up a skeleton for each of you. After five minutes he hits twice as hard.",
      "WHAT IT PAYS. About one and a half times what the same minutes pay solo: roughly 5,000, 14,000 or 22,000 tickets EACH on a clear, and everybody gets their own roll at a real ZCoin. Do under a tenth of the boss's damage and you're paid half. Three paid runs a day; after that a clear pays a quarter.",
      "DYING costs nothing in there: you wake at the bottom of the stairs and run back. But if the WHOLE party is down at once it's a wipe, and the crypt keeps the ante.",
      "Clicking a player now opens a small menu (Trade, Invite to party) instead of sending a trade request straight away. Fastest clears are on the Hiscores.",
    ],
  },
  {
    date: "2026-09-21", title: "A better first minute",
    items: [
      "NEW PLAYERS ARE TOLD WHAT THIS IS FIRST. The explainer now comes before the character builder, says a word about making your character, and takes you straight into it. When you come out, it offers the two ways to start: the games, or outside.",
      "THE GAME LOADS A LITTLE FASTER. The maps of areas that are closed are no longer downloaded just to log in.",
      "The island's farm plots and pet pen have proper pictures. They aren't ready yet, and say so when you click them.",
    ],
  },
  {
    date: "2026-09-21", title: "Yahsmeena's decor shop is open",
    items: [
      "DECORATE YOUR ISLAND. Yahsmeena, by your cottage, sells furniture and decorations for tickets: benches, flower beds, a flamingo, tiki torches, a fountain, a hot tub, a beer pong table, and for indoors sofas, rugs, a big TV, a pool table, a trophy case and one gold toilet. 34 pieces, all for show.",
      "HOW: buy from her on your own island, then press Decorate (bottom right of the game). Pick a piece from the tray and click a tile. The hand picks a piece back up; nothing is ever lost by moving it. She buys back what you don't want for a quarter.",
      "THE RULES: pieces can't overlap, can't go in the sea, and can't wall anything off (the game won't let you seal in your plots or your door). Outdoor pieces go outside, cottage pieces go inside, some stand against the back wall. 12 pieces on the first island, 20 on the bigger one, 32 with the Far Shore, and 12 in the cottage.",
      "VISITORS SEE ALL OF IT. Go and look at somebody else's.",
      "A GZ button joins the quick emotes.",
    ],
  },
  {
    date: "2026-09-21", title: "Emotes in chat",
    items: [
      "THE CHANNEL'S EMOTES WORK IN GAME CHAT. Type an emote's name as its own word (Zcoin, GIGACHAD, NOOO, any of the 7TV and BetterTTV ones from the stream) and it shows as the picture. Thanks to Kellzifer for asking.",
      "Yahsmeena's name tag says she's an NPC, and her face is in her talk window.",
    ],
  },
  {
    date: "2026-09-21", title: "Yahsmeena moves in",
    items: [
      "EVERY ISLAND HAS A DECORATOR. Yahsmeena stands by your cottage. She will be the one selling furniture and decorations for your island; the shop isn't open yet, so for now she has opinions. (She asked for the job while helping test the game, and got it.)",
    ],
  },
  {
    date: "2026-09-21", title: "A Quests completed board",
    items: [
      "HISCORES: QUESTS COMPLETED. The House Tour counts once you have walked it to the end, every daily job you claim at the board counts, and so will story quests when they come back. Daily jobs count from today: nobody was keeping score before.",
    ],
  },
  {
    date: "2026-09-21", title: "Songs on the jukebox, a real Hiscores board, and tickets you can trade",
    items: [
      "PICK A SONG. The jukebox has a Songs tab now: search for anything (or paste a YouTube link), pay 50 tickets, and it plays for everyone in the casino and the Yard, in time with each other. It queues, two each, eight minutes a song at most. Nobody can skip yours but you. The station comes back when the songs run out.",
      "HISCORES THAT WORK. The button was broken for everyone: fixed. The boards are the game as it is now: Combat, Fishing, tickets earned, tickets wagered, kills, and real ZCoins found. There is a board on the casino's back wall too, by the Winners' Wall.",
      "TICKETS TRADE. Click a player, open a trade, type how many tickets. Both of you accept twice, like any trade.",
      "THE HOUSE TOUR'S SECOND STEP IS FIXED. There is no free chip any more, and the step could not be finished. Any play at a table finishes it now, and so does reading the job board if you have no ZCoins yet.",
      "We say OUTSIDE now, not 'out the arch'.",
      "The Free-play chip is called a Green house chip now, because that is what it is: click it and it cashes into 100 tickets. It was never going to show up on a table.",
    ],
  },
  {
    date: "2026-09-21", title: "A proper welcome, and the bar put its prices up",
    items: [
      "A WELCOME FOR THE REGULARS. The first time you arrive you are told the two things that matter: every game from eastcoin.vip is here for the same ZCoins (the Games button glows until you press it), and tickets are new money you earn outside.",
      "THE BAR IS TEN TIMES DEARER. Every drink and every dinner, and the round for the room. They were too cheap to think about.",
      "The tile outline under your mouse is off unless you turn it on in Settings.",
      "ONE VOLUME FOR EVERYTHING. Top right of the game, beside your buffs: a mute button and a slider that turn the sound effects and the jukebox up and down together. M still mutes.",
      "The casino windows show our own ticket, not the emoji one.",
      "YOU WALK FASTER. About a fifth quicker, everywhere.",
    ],
  },
  {
    date: "2026-09-21", title: "Walk further, earn more",
    items: [
      "THE ROAD PAYS MORE THE FURTHER YOU GO. Inside every area the first monster used to be the best money, so there was no reason to walk on. Now each monster along the road pays a bit more a minute than the one before it, all the way to The House. Nothing pays less than it did.",
      "JACKPOT KILLS. About one kill in fifty was carrying the house's money: five times that monster's tickets on the spot, with the casino's own win banner. Everyone in the area hears about it.",
    ],
  },
  {
    date: "2026-09-21", title: "Guy or girl, and a new body",
    items: [
      "YOU PICK. The mirror asks Guy or Girl first now, and Surprise me stays inside your answer. It used to roll across everybody, which is why half of you woke up as women.",
      "A NEW BODY: Fat as shit. It is exactly what it says.",
      "Trousers are called Pants now.",
      "SKIN TONES TAKE PROPERLY. Pale highlights on the women and most of the Big guy never took your skin colour, so darker skins came out patchy. Every body is one colour all over now.",
      "BETTING TICKETS SAYS TICKETS. Pick Tickets at a table and the button reads Spin · 5,000 tickets, not 5 ZC. A win still pays ZCoins.",
      "Kellz has moved to the smoking section. The ticket count in your stats wears a ticket, not a coin.",
    ],
  },
  {
    date: "2026-09-20", title: "The jukebox takes tickets",
    items: [
      "PAY TO PLAY. A pick on the jukebox costs 100 tickets. Everyone in the casino and the Yard hears it, and it is yours for 10 minutes: nobody else can change it or switch it off until your time is up.",
      "THE MUSIC STOPS WHEN YOU LEAVE. Close the game, lose your connection, or put your phone away, and the radio goes quiet.",
    ],
  },
  {
    date: "2026-09-20", title: "Music in the Yard, the regulars are losing, and prizes on the counter",
    items: [
      "A JUKEBOX IN THE YARD. It's on a slab of concrete just inside the gate. Same station as the casino's: put something on at either one and everybody in the casino and the Yard hears it.",
      "THE REGULARS PLAY FOR REAL NOW. Well, for pretend. Watch someone at a table and their wins and losses float up over their head: green when they hit, red when they don't. Mostly red.",
      "BOM TRADY LEFT A FEW THINGS OUT. A trophy, a football, a ring box, some chips: small prizes sitting on his black counters.",
    ],
  },
  {
    date: "2026-09-20", title: "A mute button, the jukebox moved, and Bom Trady's counters straightened",
    items: [
      "THE JUKEBOX MOVED. It is in the middle of the casino now, by Bom Trady's booth, where everyone can reach it. It used to hide in the corner by the bar.",
      "BOM TRADY'S BOOTH IS SQUARE NOW. His black LED counters run in straight lines: one down each side, one across the front with the lit prize cases in it, and the man himself in the middle.",
      "ONE CLICK FOR QUIET. The 🔊 in the top bar (or the M key) mutes everything at once, sound effects and the jukebox, and one more click brings back exactly what you had. Your volume and Settings are left alone.",
    ],
  },
  {
    date: "2026-09-20", title: "A real jukebox, and the GOAT's new look",
    items: [
      "THE JUKEBOX PLAYS REAL RADIO. Click it (in the middle of the casino), pick a style or search for anything, and the whole casino hears your station. Your own volume and mute are in the same window.",
      "BOM TRADY HAS BEEN REDRAWN: the jaw, the eye black, the 12, and seven rings. He runs the Prize Counter from inside a booth of lit glass cases.",
      "RONY TOMO is by the wheels. It's the Cowboys' year. He'll tell you."
    ]
  },
  {
    date: "2026-09-20", title: "The road isn't always west",
    items: [
      "THE WAY ON MOVED. North out of the Yard, west out of the Gloam, north out of the Mire, north and up out of the Boneyard, west out of Cloudreach. Follow the signs.",
      "THE WHEEL HAS BEEN DRAWN: a gold rim with bulbs, a star hub and a proper pointer. The slices are exactly what they were.",
    ]
  },
  {
    date: "2026-09-20", title: "Bom Trady runs the Prize Counter",
    items: [
      "THE GOAT HAS THE FLOOR. Bom Trady stands in the middle of the casino where the big ruby was, with glass prize cases all round him.",
      "He does everything the ruby did: trade in your drops, buy gear, food and drinks, bank a ZCoin. Click him, or any case."
    ]
  },
  {
    date: "2026-09-20", title: "Louder wins, a livelier floor",
    items: [
      "EVERY WIN POPS. Any win at any table, even a small one, gets a gold banner, a jingle and a throw of sparks.",
      "BIG WINS ARE CALLED OUT. Hit 10x or better and the whole casino hears about it, with confetti over your head.",
      "EMOTES. Five buttons by the chat: cheers, GG, RIP, a wave, a dance. They float over your head.",
      "HITS LAND HARDER. Sparks on every hit, gold CRITs on your biggest rolls, a puff when something drops.",
      "THE FIGHT PIT HAS BEEN DRAWN: a flagstone floor, a raised ring of sand, torch posts, a ring bell and a proper fight card.",
      "MORE LOOKS: three new hairstyles (bob, bun, pigtails), beards, ball caps in your team's colours, and the team list now says the full name.",
      "The other gamblers show what they're playing over their heads, and every scene has its own light and shadows.",
      "Store name colours and titles from eastcoin.vip now show over your head in here.",
      "Stake buttons are 1, 5, 10 and 20. The half, double and max buttons are gone."
    ]
  },
  {
    date: "2026-09-20", title: "Who are you?",
    items: [
      "MAKE YOUR OWN LOOK. The first time you walk in you're asked who you are: pick a body, a hairstyle, your skin, your hair colour, a tee and your trousers.",
      "WEAR YOUR TEAM. The tee comes in all 32 NFL cities' colours. If you've set a favourite team on eastcoin.vip, it starts on that.",
      "THE MIRROR by the casino's front door changes your look any time, free.",
      "DRESS CODE: inside the casino everyone shows up as themselves. Armour shows once you're outside.",
      "The two old Cashier booths are gone. The big ruby does everything they did."
    ]
  },
  {
    date: "2026-09-20", title: "Rugs, and Kellz",
    items: [
      "EVERY SECTION OF THE CASINO HAS ITS OWN RUG NOW: slots, cards, the bar, wheels, coin flip, dice and the instant wins.",
      "KELLZ HAS LANDED. Flight jacket, long hair. He's walking the main aisle.",
      "People no longer flicker into an old sprite when they turn."
    ]
  },
  {
    date: "2026-09-20", title: "New faces",
    items: [
      "EVERYONE LOOKS LIKE SOMEONE NOW: six everyday looks for players without armour (you get one and keep it), and the other gamblers on the floor wear them too. No more tunics.",
      "LIVIA, GAIUS AND AURELIA have been drawn.",
      "RUSSIAN ROULETTE'S WINDOW now lists who's at the table and who's watching."
    ]
  },
  {
    date: "2026-09-20", title: "A new carpet, and a proper Russian Roulette room",
    items: [
      "THE CASINO HAS A NEW CARPET: dark, with big stars. You, the tables and everyone else stand out on it now.",
      "SIX SEATS AT THE RUSSIAN ROULETTE TABLE. Sit down and you walk to your stool. Get shot and the room sees you drop.",
      "A BELL ON THE CASINO FLOOR: when someone sits down, everyone hears it, with a Walk there button.",
      "A WALL OF FAME beside the table: today's biggest pots, the longest winning run, and who's been shot the most.",
      "BINO'S BAR CART: a shot for 1 ticket. It does nothing. The room hears about it."
    ]
  },
  {
    date: "2026-09-19", title: "Russian Roulette takes centre stage",
    items: [
      "RUSSIAN ROULETTE IS NOW THE MIDDLE OF THE ROULETTE ROOM, with Bino beside it.",
      "The regular roulette wheel is away for repairs. It'll be back."
    ]
  },
  {
    date: "2026-09-19", title: "New buttons, fewer words",
    items: [
      "LESS READING EVERYWHERE: the wiki's guides, the casino's how-to board and what people say to you have all been cut down to a few short lines. Guides for things that are closed are gone.",
      "RUSSIAN ROULETTE HAS A HAND-DRAWN CYLINDER, and Mines' bomb buttons match the rest.",
      "THE GAME WINDOWS HAVE NEW HAND-DRAWN BUTTONS: a gold Spin / Bet / Drop button, wooden and gold pills for the games and the ZCoins / Tickets switch, wooden stake buttons, and proper poker chips at the roulette table.",
      "FEWER WORDS. Every game's explainer is one short line now. The numbers you need are on the buttons and the pay table.",
      "FISHING IN THE YARD AND THE GLOAM PAYS A LITTLE LESS: sardine 8, perch 10, trout 14, catfish 18 tickets. Fishing was paying as much as fighting out there; it's meant to be the quieter job for a bit less. The deeper waters were already right."
    ]
  },
  {
    date: "2026-09-19", title: "Six scenes, thirteen new monsters, eight new fish",
    items: [
      "TODAY'S JOBS NOW COVER ALL SIX SCENES: there's a job for every monster and every fish outside, and the board only hands you ones your levels can reach. The wiki's area pages say each scene's levels, its fish and what dying there costs, and there's a new guide: The road west.",
      "NOTHING ATTACKS ON SIGHT ANY MORE. Every monster in every scene waits to be clicked, The House included: it's a game to relax in. The signs out there have been repainted.",
      "THE WORLD OUTSIDE NOW RUNS IN TEN-LEVEL BANDS, one scene each, in a line west from the casino: the Yard (1-9), the Gloam (10-19), THE LANTERN MIRE (20-29), THE BONEYARD (30-39), Cloudreach (40-49) and THE THUNDERHEAD (50 and up). Walk anywhere you like. You can't START a fight until your Combat reaches the scene's level, and you can't fish its water until your Fishing does: the label over a monster or a pond tells you what it needs. Something already attacking you can always be fought back.",
      "THIRTEEN NEW MONSTERS. The Gloam: Sulking Toadstool (10), Bone Idle (16). The Mire: Paper Twister (20), Card Counter (24), Loan Shark (26). The Boneyard: The Stagehand (32), One-Eyed Usher (36). Cloudreach: Brainstorm (40), Sea-Goat of the Upper Air (46). The Thunderhead: Storm Golem (52), Thunderwolf (58), Hail Drake (62), and THE HOUSE (70), a walking slot machine in the far corner. Four old faces are back too: the Angry Olive, the Goat in a Toga, the Sulking Revenant and the Angel of Minor Inconvenience.",
      "EVERY SCENE HAS ABOUT TWO DOZEN MONSTERS OF FIVE KINDS, like the Yard, and the deeper the scene the more a kill pays. The last band pays noticeably more than Cloudreach.",
      "TWO FISH TO EVERY WATER. The Yard's pond: sardine, and perch from Fishing 5. The Gloam's black pond: trout (10), catfish (15). The Mire's lake: lanternfish (20), mudskipper (25). The Boneyard's flooded crypt: bonefish (30), ghost carp (35). Cloudreach: sky eel (40), cloud ray (45). The sea under the Thunderhead: storm marlin (50), thunder squid (58). Every one heals when eaten and trades in at the Prize Counter. (Trout left the Yard: it's a Gloam fish now.)",
      "DYING NOW COSTS A HOSPITAL BILL: a tenth of the tickets you're carrying (a twentieth in the Yard), capped by how deep you were: 250 in the Yard up to 6,000 in the Thunderhead. Nothing else is ever taken: not your gear, your bag, your ZCoins or your levels."
    ]
  },
  {
    date: "2026-09-19", title: "Buffs work outside now",
    items: [
      "THE GAME IS CALLED EASTSCAPE AGAIN. Same game, same address, old name.",
      "EVERY BUFF IN THE GAME NOW HELPS YOU FIGHT AND FISH, not bet. The tables are eastcoin.vip's own and nothing in EastScape touches a bet, so the old gambling effects had nothing left to do. Same items, same names, same rarity, new jobs.",
      "WORN GEAR: Gambler's ring, fish heal 50% more. Bookie's amulet, 5% more tickets. Loss adjuster's visor, 10% less damage taken. Card sharp's gloves, swing and fish 5% faster. Angel's ring, rare drops 15% more often. Stakeholder's loafers, still make your other buff gear 50% stronger.",
      "DINNERS LAST 20 MINUTES AND DRINKS 10, and the clock only runs while you're outside: sit in the casino as long as you like. Chicken dinner +10% tickets from kills. Steak +10% speed. Chops, rare drops +25%. Fisherman's platter, fish bite more and a 10% chance of two on one line. Lager +5% tickets. Whiskey +15% speed but you take 10% more damage. The Safety Net, 20% less damage. Champagne, a real ZCoin is 50% more likely to drop.",
      "LUCK IS FOR ZCOINS NOW: while you're lucky, a real ZCoin is 25% more likely to drop, and each kill or catch uses one up. Clovers still only come from fishing.",
      "THE FINDS: a Free-play chip cashes for 100 tickets, the Devil's dice play for up to 1,000 of the tickets in your bag (triple, one time in three), and the Rewind watch is a full heal you can use mid-fight.",
      "VIP IS EARNED BY TICKETS EARNED (kills, trade-ins, daily jobs), and every tier takes a little off every Prize Counter price: 2% at Bronze up to 10% at Diamond.",
      "GONE: hunger and thirst (the cooler and the buffet are scenery now), and High Roller."
    ]
  },
  {
    date: "2026-09-19", title: "Roulette and the Fight Pit play for ZCoins (or tickets)",
    items: [
      "EVERY GAME IN THE BUILDING NOW TAKES ZCOINS OR TICKETS AND PAYS REAL ZCOINS. The last two joined today: ROULETTE upstairs and THE FIGHT PIT. Tickets stand in at 1,000 a ZCoin, as everywhere else, and the usual limits apply: 1 to 20 a bet, ten bets an hour at each game, 400 an hour out.",
      "ROULETTE: a spin a minute, and everyone in the room is on the same spin. ONE SPOT A SPIN: red or black, odd or even, high or low, a dozen, or a single number (a number pays about 37x). 40 seconds to bet, then the ball rolls.",
      "THE FIGHT PIT: a fight every minute and a half, the same fight for the whole room. Back one side, once: the price is on the card (a long shot pays about 4x). 40 seconds to bet, then they go at it, and you can watch it from the ring or from the window.",
      "Both can be checked afterwards like any other game: the seed is published when the round closes.",
      "ALSO: a bank chest in the Yard (by the road in from the casino), two revolvers on the Russian Roulette table so nobody mistakes it for the other one, Bino dealing it, and a real ZCoin or a rare find that lands on a full bag now goes to your bank instead of being lost."
    ]
  },
  {
    date: "2026-09-19", title: "Russian Roulette is in the Roulette Room",
    items: [
      "THERE'S A NEW TABLE UPSTAIRS: Russian Roulette, on the left of the Roulette Room. It is eastcoin.vip's own table, the very same one, so you may find yourself sitting across from someone playing on the website.",
      "HOW IT GOES: the first to sit opens the table and starts a 30 second clock. Everyone pays 20 ZCoins. Each round the cylinder holds one live chamber and the seats pull in turn; whoever gets it is out. Reload, and again, until one is left. THE LAST ONE STANDING TAKES EVERY BUY-IN, and the house takes nothing. Alone when the clock runs out? Your 20 comes back.",
      "ZCOINS ONLY at this table: no tickets. The site's limits apply (ten tables an hour, 400 ZC an hour out), and every table's seed can be checked afterwards from the window.",
      "The classic roulette wheel next to it still takes tickets for now.",
      "TICKETS STAY ON YOU. They can't be dropped, banked or handed over in a trade any more: they only leave your bag by being spent. Any tickets you had in the bank are back in your bag."
    ]
  },
  {
    date: "2026-09-19", title: "Slots and Dice play for ZCoins (or tickets)",
    items: [
      "SLOTS AND DICE ARE REAL NOW. Same machines, same dice table, same 'Bet with' switch as the other tables: ZCoins, or tickets at 1,000 a ZCoin, and a win pays real ZCoins. The usual rules: 1 to 20 a bet, ten plays an hour at each game, 400 an hour out, and a seed you can check afterwards.",
      "THE SLOTS JACKPOT IS REAL ZCOINS. 2% of every spin feeds one pot everybody shares. Three sevens wins it: a 20 ZC spin takes all of it, a smaller spin takes its share and the rest stays. It stops growing at 500 (anything over waits and starts the next pot), and it restarts at 50 after a win.",
      "Slots pay tables are a little different from the old chip machines: about one spin in three pays something, the biggest regular prize is three diamonds at about 61x, and three sevens is the jackpot rather than a price.",
      "DICE pays the fair price for your number: under 50 is about 2.04x, under 5 is 25x.",
      "Still tickets in, tickets out: roulette upstairs and the Fight Pit. They are next."
    ]
  },
  {
    date: "2026-09-19", title: "One currency: tickets. And the tables take tickets or ZCoins",
    items: [
      "CHIPS AND CASH ARE GONE. There is one currency in EastScape now: TICKETS. Kills, catches and daily jobs pay them, the Prize Counter takes them, and every table takes them. Your bag panel shows Tickets and your real ZCoins side by side. (Chips anyone was holding were wiped: the game is still in testing.)",
      "THE SIX REAL TABLES TAKE ZCOINS OR TICKETS. Coin Flip, the Wheel, Higher or Lower, Mines, Plinko and Scratch-Off have a 'Bet with' switch: ZCoins (your own) or Tickets, where 1,000 tickets stand in for each ZCoin. It is the very same eastcoin.vip game either way, same limits, same fairness seeds, and A WIN IS ALWAYS PAID IN REAL ZCOINS.",
      "Ticket bets have an allowance: 50 ZCoins' worth an hour. Banking ZCoins you found shares it. When it runs out the Tickets side waits for the hour to roll on; ZCoin bets still work.",
      "THE RUBY'S SCRATCH TICKETS AND ITS EXCHANGE ARE GONE: betting tickets is the way tickets become ZCoins now. The Prize Counter still banks any ZCoins you find, and still sells gear, dinners, drinks and Casino scrolls.",
      "Slots, dice, roulette upstairs and the Fight Pit take tickets and pay tickets for now. They are next in line to become ZCoin games.",
      "THE HIGH ROLLER ROOM IS CLOSED for a refit. Vince is still on the door, and still won't tell you anything."
    ]
  },
  {
    date: "2026-09-20", title: "The real tables are in the building",
    items: [
      "COIN FLIP, THE WHEELS, HIGHER OR LOWER, MINES, PLINKO AND SCRATCH-OFF ON THE CASINO'S MAIN FLOOR NOW PLAY FOR REAL ZCOINS, from your real eastcoin.vip balance. They're the same windows you know; behind them is the site's own casino. Click a table and it opens the moment you click (your character strolls over on its own).",
      "They play by the site's rules, exactly: 1 to 20 ZCoins a bet, ten plays an hour at each game, 400 an hour out, the same fairness seeds (there's a \"check the last one's seed\" link in the window), the same Daily Jackpot, and your results show on your eastcoin.vip profile. Nothing in EastScape (luck, dinners, drinks, gear, hunger, VIP) touches these tables.",
      "COIN FLIP AND THE WHEEL ARE SHARED ROUNDS, as they are on the site: one flip every 30 seconds and one spin a minute for the whole room. Get your bet in and the window counts you down to it.",
      "A GAMES BUTTON (top left, or press G) opens them from anywhere on the main floor, and a strip across the top of the window hops between the six.",
      "HIT A LIMIT, OR OUT OF ZCOINS? That's what outside is for: every kill and catch can drop a real ZCoin, and tickets buy Ruby scratch tickets at the Prize Counter.",
      "STILL CHIPS: the slots, the dice pit, roulette upstairs, the Fight Pit and the whole High Roller Room (which keeps its own chip versions of every table)."
    ]
  },
  {
    date: "2026-09-20", title: "Tickets, the Prize Counter, and real ZCoin drops",
    items: [
      "THE WORLD OUTSIDE PAYS TICKETS NOW, like an arcade. Every kill and every daily job pays tickets instead of Cash, and the numbers over monsters and fishing spots have a little ticket beside them so nobody mistakes them for ZCoins. A ticket is worth exactly what a dollar was: a cow still pays about 28.",
      "THE PRIZE COUNTER is the big ruby in the middle of the casino (both Cashier windows work too). It takes your drops and fish for more tickets, and it's the one place tickets are spent: CASINO CHIPS to play with (1 ticket, $1, or all of it in one click), drinks, dinners and Casino scrolls, a set of arms and armour for every level (Brutus has packed up his pitch in the Yard), and Ruby scratch tickets.",
      "RUBY SCRATCH TICKETS cost 1,000 tickets and pay 25, 10, 5 or 2 REAL ZCoins, or nothing. Five an hour at most. Trading Cash straight for ZCoins is gone: this is the way now.",
      "REAL ZCOINS DROP, RARELY. Any kill, and any catch at a pond, can turn up an actual ZCoin (one time in twenty it's five of them). About 2 to 5 an hour if you're at it steadily, a little more the deeper you go. It lands in your bag; BANK it at the Prize Counter and it goes onto your eastcoin.vip balance. Banking counts toward the same 25-an-hour allowance as scratch tickets, and anything over waits in your bag. Everyone in the scene hears about it.",
      "Your bag panel shows Tickets and Chips side by side. The free daily wheel and anything you win at the tables are still chips."
    ]
  },
  {
    date: "2026-09-20", title: "Outside is simple now: fight, or fish",
    items: [
      "THE WORLD OUTSIDE THE CASINO IS MONSTERS AND A POND. Go outside, click a monster, get paid: Cash, its one drop, and a roll at something rare. That's the job. If you'd rather not fight, every scene has a pond. Mining, woodcutting, smelting, smithing and cooking are gone from the world (your levels in them are kept, in case they come back).",
      "KILLS ARE TWICE AS FAST. Every monster has half the hit points, so a fight at your own level is about 8 to 12 seconds. Each kill pays a little less and there are twice as many of them, so an hour's fighting is worth what it was, with twice the drops and twice the rare rolls.",
      "MORE MONSTERS. The Yard has 24 (chickens by the gate, then cows, rotten tomatoes, hornworms, and boars at the far end). The Gloam has 18. Cloudreach has 13, including Thunder Geese at the far west end for anyone past level 50.",
      "FISHING is the quiet job. Your chance of a bite now grows with your Fishing level, there are five spots at every pond, and the fish are worth more out deeper: it pays somewhat less than fighting does (two thirds to nine tenths, depending on your level), for none of the risk. It's the ONLY place lucky clovers come from. And a fish is food straight out of the water: click one to eat it.",
      "BRUTUS SELLS GEAR FOR EVERY LEVEL, in the Yard by the pond: bronze at Combat 10, emerald at 20, diamond at 30, dragonstone at 40, onyx at 50. Bronze costs what it did; onyx is a couple of hours' fighting. The GOOD stuff still only drops.",
      "ALL SIX PIECES OF GAMBLING GEAR ARE RARE DROPS NOW. Gambler's ring: boars and hornworms. Bookie's amulet: highwaymen and gnashers. Loss adjuster's visor: moths and Tax Wraiths. Stakeholder's loafers: ghouls, rams and geese. Card sharp's gloves and the Angel's ring: where they were.",
      "DEX HAS A KITCHEN. The four dinners (Well Fed, plus an effect each) are on his menu with the drinks.",
      "RARES FOUND. The Quests tab has a collection: every rare there is, greyed out until you've found one, with a count. Hover one to see what drops it.",
      "Today's jobs are kills and fish only. New characters start with a rod and $25."
    ]
  },
  {
    date: "2026-09-20", title: "Simpler drops: Cash, its one thing, and a rare",
    items: [
      "Every monster now drops the same three lines. CASH, always. ITS ONE THING, always: chicken from chickens, beef from cows, tomatoes from rotten tomatoes, husk from hornworms, pork from boars, hide from highwaymen, emerald ore from gnashers and moths, a receipt from Tax Wraiths, diamond ore from ghouls and the Understudy, cobweb from the spider, dragonstone ore from rams. And A RARE: one roll a kill, at most one a kill.",
      "The rare is either one of the monster's own named pieces (the highwayman's mask, the Bog-hound hide, the wraith's hood, the Ring of Mild Menace, the Lantern shield, the Eight-league boots, the Grudge knife from rams, Card sharp's gloves, the Angel's ring) or a casino find (house chips, a free-play chip, a mystery box, Devil's dice, a rewind watch). A piece of gear dropping is announced to everyone in the scene. Each monster's wiki page lists its rares and the chance of each.",
      "A kill is worth exactly what it was: the Cash makes up the difference.",
      "Gone: bones, pits, feathers and tusks (what you have still sells), and the long tables that gave every piece of emerald and diamond gear a tiny chance from late monsters. That gear is smithed at the camp.",
      "Two recipes changed to match: the Gambler's ring is 2 bronze bars and a piece of pork; the Bookie's amulet is 3 bronze bars and 2 hides (hide comes from highwaymen now)."
    ]
  },
  {
    date: "2026-09-20", title: "One way out: the Yard, the Gloam, Cloudreach",
    items: [
      "THE WORLD IS ONE LINE NOW. The casino has one arch (OUTSIDE), and it leads to three scenes in a row: the Yard (levels 1 to 14), the Gloam (15 to 29) and Cloudreach (30 and up). Every one of them has its rocks, trees and fish AND its monsters, so whatever you and your friends are doing, you're doing it in the same field. The further out you walk, the more everything is worth.",
      "THE CAMP. In the Yard, between the pond and the tin rocks: a furnace, an anvil, a cooking range, and Brutus (who moved out there with his shop, and still buys what you smith). It's the only place to smelt and smith, it's right beside the rocks, and you pass it on every walk home. Anything you make sells for double, so make it before you cash in.",
      "The Yard's animals live at its west end: chickens, cows, rotten tomatoes, hornworms and boars. None of them attack first.",
      "The Gloam now has highwaymen, lantern moths, Bog Gnashers and Tax Wraiths. Gnashers (the north clearing) and wraiths (the far south-west) come for you on sight; signs say where, and they can't reach the rocks, the pond or the path. Cloudreach has Sorry Ghouls, the Understudy, Cumulus Rams, and one Chandelier Spider in the middle of the south that you should not wander into by accident.",
      "There's a campfire to cook on in the Gloam and in Cloudreach. Smelting and smithing are only at the Yard's camp.",
      "The Paddock, the Rough and the Boneyard are closed (their monsters moved into the line). If you logged out in one, you'll wake up in the casino. The Forum keeps the bank, the Exchange and Charon's cart; its smithy has moved to the camp.",
      "Cashing in is still only inside the casino, at the Ruby or a Cashier's window."
    ]
  },
  {
    date: "2026-09-20", title: "A free spin every day, VIP tiers, and the Winners' Wall",
    items: [
      "THE DAILY PRIZE WHEEL is open: the big wheel by the casino's front door. One free spin a day: Cash from $50 to $1,000, lucky clovers, a lager, free-play chips, Casino scrolls, a mystery box, even a black house chip. Spin every day: each day in a row adds 10% to the Cash slices, up to +70%. It resets at midnight, Central. It says FREE SPIN over it until you've had yours.",
      "VIP TIERS. Every dollar you ever bet counts, win or lose: Bronze at $10,000, Silver at $50,000, Gold at $250,000, Platinum at $1,000,000, Diamond at $5,000,000. Your tier shows as a coloured diamond by your name for everyone to see, and each tier raises every table's limit (Bronze +$50 up to Diamond +$1,000). Your progress is under your bag.",
      "THE WINNERS' WALL, on the back wall right of the Roulette door: today's five biggest single wins, from any table, roulette and the Fight Pit included. Win $500 or more on one bet to get on it. Wiped at midnight, Central."
    ]
  },
  {
    date: "2026-09-20", title: "The House Ruby pays in ZCoins, and the High Roller Room",
    items: [
      "THE HOUSE RUBY NOW TRADES CASH FOR REAL ZCOINS. Click the big ruby in the middle of the casino floor. $100 of Cash is 1 ZCoin, paid straight to your eastcoin.vip balance. You can take up to 25 ZCoins in any hour.",
      "RUBY TICKETS. $500 buys a ticket you scratch right there: it pays 25, 10, 5 or 2 ZCoins, or nothing. A ticket uses 5 of your hour's 25 whatever it pays. On average a ticket pays a little less than trading straight: it's the same money with a story.",
      "If the Ruby ever can't tell whether a trade went through, your Cash is HELD, not lost. Open the Ruby again a minute later and it finishes the job or hands the Cash back.",
      "THE HIGH ROLLER ROOM. There's a new door in the Fight Pit's back wall, and Vince in front of it. He lets you in with $2,500 on you, or with the High Roller buff (which you get from fighting). Inside: the same games at TEN TIMES the limits, $100 minimum, the good buffet, and Sterling. Luck and buffs cover the first $1,500 of any bet, so a $5,000 flip is a big swing, not a better deal.",
      "The wiki's words now load when you first open the wiki, which makes the game itself start a little faster."
    ]
  },
  {
    date: "2026-09-20", title: "EastScape: three jobs, three rewards, and a bar",
    items: [
      "The game is called EastScape now.",
      "FIGHTING PAYS PROPERLY. Every monster carries Cash on top of its drops, measured so a fighter of the right level earns a little MORE a minute than a miner of that level, for the risk. A cow is worth about $47 a kill, a boar $82, a Tax Wraith $240, the Understudy $350. Before this, everything past a cow paid worse than the rock next to it.",
      "SKILLING is now the only way to get Lucky: clovers turn up while you gather (and, rarely, a horseshoe). Monsters no longer drop horseshoes; the ones you have still work.",
      "FIGHTING has its own rewards. Any kill can turn up a house chip (red $250, black $1,000, gold $5,000), a free-play chip (your next bet is on the house, up to $100), a mystery box, Devil's dice (within two minutes of a win: triple it, one time in three, or lose it) or a rewind watch (within a minute of a loss: it never happened, up to $500). Bigger monsters turn them up far more often. One kill in eight makes you a HIGH ROLLER: every table takes double from you for your next 10 bets over the normal limit. Two pieces of gambling gear only ever drop: Card sharp's gloves (wins pay 1% more profit) and the Angel's ring (1 lost bet in 200 comes back whole).",
      "CRAFTING makes what you keep. At the anvil: the Gambler's ring (half the hunger and thirst), the Bookie's amulet (+$250 on every table), the Loss adjuster's visor (1% of every loss comes back) and the Stakeholder's loafers (your other gambling gear is 50% stronger). At the range, four dinners: every one leaves you WELL FED (no hunger or thirst) for 30 bets or more, and adds an effect of its own. Each takes something dug up AND something killed.",
      "DEX'S BAR IS OPEN. Talk to Dex: lager, The Safety Net, whiskey and champagne each change your next 10 to 15 bets. One drink at a time. $300 buys a round for everyone on the floor.",
      "CASINO SCROLLS. Dex sells them for $50. Click one anywhere (not the Wilderness, not mid-fight) and you're back on the casino floor.",
      "YOUR ISLAND IS BACK. Charon has a cart in the square out the casino's front door. Plant wheat or tomatoes on your island and they grow while you're away; upgrades and themes are sold from the cart.",
      "Everything that's on is in the Buffs bar, top right. Hover one to read it. Your table limit on every game follows your buffs. The ceiling: gear alone can never take a game over 100% back, and everything stacked with luck stops at about 104%, for as long as the dinner and the drink last.",
      "WHAT THINGS MADE ARE WORTH changed. A made thing sells for double the RAW materials in it, plus a quarter for each further step: a bronze bar is $40, a bronze sword $100 (it was $160, which paid a miner with an anvil twice what anyone else could earn). The Cashier now tells you when something in your bag is worth more made into something first.",
      "The Cashier no longer buys anything you can wear or hold (so a click can't sell your sword). Brutus, at the Forge, buys what you smith.",
      "Today's paid jobs moved to the Quests tab, and there are jobs for MAKING things now (bars, swords, dinners). Under your bag: thirst and hunger, your cash, and what your bag is worth, each in its own box."
    ]
  },
  {
    date: "2026-09-20", title: "The Fight Pit",
    items: [
      "There's a second door in the casino's back wall, in the slots room, with FIGHTING lettered over it. Behind it: a sand pit, a rail to lean on, and two monsters who have been told the other one said something about their mother.",
      "One fight at a time for the whole room. You get 30 seconds to put money on one of them (up to $500, one side only), then a proper 40-second scrap with misses and the lead changing hands, then the winners are paid, ten seconds to gloat, and the next pair comes out. Click the pit or either betting board.",
      "There are two water coolers and two buffets along the pit's back wall, so you never have to leave the rail (or miss a fight) to eat or drink.",
      "It is pure luck. The price on each fighter comes from its level: a chicken against a revenant pays big, because it mostly loses. Whoever you back, the house keeps 5%. Nothing else decides it.",
      "The House Ruby in the middle of the casino floor now takes your loot: click it to cash in, the same as a Cashier's window."
    ]
  },
  {
    date: "2026-09-20", title: "Hunger and thirst",
    items: [
      "Gambling is thirsty work. Every bet takes a little off your Thirst and your Hunger (about forty bets to a drink). Under 20% on either, the tables won't take your bets until you've had something.",
      "The water cooler and a new buffet stand side by side on the card room's back wall, next to the bar. Each click gives you back 20%, free, as many clicks as it takes.",
      "Cooked food from your bag fills you up too (25% a piece), so a fisherman never goes hungry.",
      "Both meters are in the wallet under your bag and on every table. Working, fighting and standing about cost nothing: only betting does."
    ]
  },
  {
    date: "2026-09-20", title: "A smaller bag, a wallet, and a Buffs bar",
    items: [
      "Your bag holds 20 things now, not 30, so it fills and sends you back past the tables to the Cashier. If you had more than 20, the extra went to your bank: nothing was lost.",
      "Under the bag is your wallet: your Cash, what the loot in your bag would sell for (it turns green when there's money to collect), the slots jackpot, today's three paid jobs with their progress, and a line on what to do next.",
      "Top right of the game is now a Buffs bar. It shows everything that's improving your odds. There's one kind today (Lucky, from clovers and horseshoes); it's built to hold several.",
      "The casino looks lived in: a janitor's bucket and a wet-floor sign by a spilled drink, coats by the doors, a suitcase nobody came back for, and chips, cards, losing slips and one shoe on the carpet."
    ]
  },
  {
    date: "2026-09-20", title: "The casino floor, laid out like a real one",
    items: [
      "Every kind of game now has its own roped-off room, named in gold on the carpet at its way in. SLOTS fill the north-west: three banks of machines back to back, plus the wall. WHEELS and COIN FLIP share the south-west. The CARD ROOM (Higher or Lower, and the blackjack and poker tables that open soon) is next to THE BAR in the north-east. The DICE PIT and INSTANT WINS (two Plinko machines, two Mines tables, two Scratch-Off kiosks) are in the south-east.",
      "Later the same day: fewer ropes (just a short run either side of each way in), and the rooms are broken up with the things a casino is full of. Stools at the slot machines, the tables and the bar (stand on one: it's where you'd sit), soda and snack machines, a water cooler, bins, planter boxes, and a smoking section in the north-east corner with club chairs, ashtrays and its own haze.",
      "The velvet ropes are real: you go into a room through its gap. The long aisle from the skilling arch to the fighting arch stays clear, with a Cashier at each end and the House Ruby in the middle.",
      "Dex, DookieBetts and the regulars have moved to where they belong: Dex behind the bar, Dookie in the dice pit, Whale Wendell in the card room."
    ]
  },
  {
    date: "2026-09-20", title: "Three more places to make money",
    items: [
      "The skilling line now runs three maps deep out the WEST arch. Past the Workyard is the Gloam (level 15): emerald rock $15, gloomwillow $15, lanternfish $16, and diamond rock $22 at Mining 25. Past that is Cloudreach (level 30): dragonstone $30, skyash $28, sky eels $30, and storm-struck onyx $40 at Mining 40.",
      "The fight line runs three deep out the EAST arch. Past the Rough is the Boneyard: Bog Gnashers and Lantern Moths by the gate, Sorry Ghouls and Tax Wraiths (who carry real Cash) in the middle, a Chandelier Spider and the Understudy at the far end. Several of them come for you on sight. Combat 20 at the very least.",
      "There are no monsters on the skilling line any more, and the workshop in town is still the one place to make things. Everything you bring back from the new maps smelts and sells for double like everything else.",
      "More jobs on the task board now that there are places to do them: emeralds, lanternfish, gloomwillow, diamonds, dragonstone, boars, highwaymen, moths and ghouls."
    ]
  },
  {
    date: "2026-09-20", title: "Go broke, go get more",
    items: [
      "Every table has been rebuilt to look and play like the casino on eastcoin.vip: a dark table, one gold button, what it pays beside the board, and your sitting's bets, net and best win. Mines has the tile board and the ladder, Higher or Lower deals real cards and shows your run, Plinko drops a ball through real pegs, Scratch-Off has foil you actually scratch, Slots has spinning reels and the jackpot on the table, Dice is a slider and a track, and the Coin flips.",
      "Everything out in the world now has its price written over it: $10 a rock, $10 a log, and so on. Monsters show roughly what a kill is worth.",
      "New: the Cashier, a window by each arch on the casino floor. One click turns everything you found and made into Cash. It leaves your tools, charms and anything you could wear alone.",
      "Making things pays DOUBLE. A bronze bar sells for twice the ore in it, a sword for twice the bars, cooked food for twice the raw. The workshop out the front door has a furnace, an anvil and now a cooking range.",
      "Tools just work from your bag: no more wielding a pickaxe before you can mine.",
      "A second fight map, the Rough, east of the Paddock: hornworms, boars, highwaymen carrying actual Cash, and two Bog Gnashers at the far end. Come at Combat 8 or so.",
      "The casino floor has been re-planned into neighbourhoods so there's room to wander: Slots Alley down the west wall, the Coin Corner, the Card Pit, the Bar, and the Drop Zone (Mines and Plinko) in the south-east. The entrance is clear again.",
      "Cash is written as dollars now ($250), because that's what it is."
    ]
  },
  {
    date: "2026-09-19", title: "Five more games, right where you walk in",
    items: [
      "Wheel, Higher or Lower, Mines, Plinko and Scratch-Off now stand round the rug you arrive on, with a Coin Flip table beside them. The same games as the site's casino, played for Cash.",
      "Wheel: red or black pays 1.97×, the gold sliver 58×. Plinko: twelve rows, 25× at the edges. Scratch-Off: three of a kind, up to 100×.",
      "Higher or Lower and Mines are runs: every right call or gem multiplies your stake and you cash out when you like. A run is kept for you if you close the window, walk away or the game restarts.",
      "Luck works on all of them, and every table returns about the same, so play the one you enjoy."
    ]
  },
  {
    date: "2026-09-19", title: "The casino floor fills up",
    items: [
      "The hall has furniture now: the House Ruby behind velvet ropes in the middle, poker and blackjack tables (opening soon), a prize wheel, cocktail tables, a jukebox, a grand piano, a cash machine that thankfully doesn't work, and art on the back wall.",
      "It moves: spotlights drift over the carpet, the lamps breathe, the JACKPOT sign buzzes, the slot machines blink. Turn on Reduced motion in Settings and it all holds still.",
      "Meet the regulars: Parlay Pete, Nana Jackpot, Rent Money Randy and Whale Wendell. None of them should be listened to. There are a few players at the machines now too."
    ]
  },
  {
    date: "2026-09-19", title: "A simpler GAMBA: bigger tiles, luck, and a smaller world",
    items: [
      "Every area is now twice as wide and twice as tall, and the view follows you as you walk. The casino is a proper hall: more slot machines, three coin tables, three dice tables.",
      "Luck: want better odds? Work in the Workyard and you'll find lucky clovers; monsters in the Paddock drop lucky horseshoes. Click one in your bag and your next bets are lucky: every win pays 2.5% more. It shows top-right and at every table.",
      "The world is small on purpose for now: the casino (with its Roulette Room), the town, the Workyard and the Paddock. The roads out of town are closed; more opens later. Anyone who was standing somewhere else wakes up in the casino.",
      "Combat is ONE skill now. Attack, Strength and Defence merged into Combat (you keep the best of your three levels), and stances are gone: hit things, get better at all of it.",
    ],
  },
  {
    date: "2026-09-19", title: "Welcome to GAMBA",
    items: [
      "The game has a name: GAMBA. The casino is now the middle of the world, and where everyone starts (and wakes up after dying).",
      "Four ways out of the casino: north is Floor 2 (the Roulette Room), the west arch leads to skilling (the Workyard: trees, copper, tin, wheat and a fishing pond), the east arch to fighting (the Paddock: chickens, cows and rotten tomatoes), and the front door to town for crafting and the market.",
      "The casino floor is bigger, with more slot machines. Everything that was in the world before is still there, through the front door.",
      "New here? Dex gives you the House Tour: a free chip, a first game, a first job and a first payday, with the next step always shown top-left. Anyone can ask him for it, or ask \"What should I do next?\" any time.",
      "The ways out of the casino are labelled, and there's a \"How GAMBA works\" board by the front door.",
    ],
  },
  {
    date: "2026-09-18", title: "The Casino",
    items: [
      "The Forge building in the Forum is now the Casino. Brutus still works his smithy right outside.",
      "Inside: slots, coin flip and dice for Cash (never ZCoins), a bar, sofas, and Dex the Dealer.",
      "Round the rug where you walk in: Wheel, Higher or Lower, Mines, Plinko and Scratch-Off, the games from the site's casino, for Cash. Higher or Lower and Mines are runs you cash out of; a run is kept for you if you leave the table.",
      "The task board moved in too: three daily tasks each, picked for your levels, paid in Cash.",
      "Through the door at the back: the Roulette Room, one shared table where everyone plays the same spin.",
      "The slots have a jackpot everyone feeds: three sevens wins it.",
    ],
  },
  {
    date: "2026-09-18", title: "A simpler market",
    items: [
      "The Exchange is now a two-sided market: Buy shows the newest listings with a search and an item picker; Sell shows your offers and people who want what you have.",
      "Buy straight off a listing, or post a buy offer. Sell from your bag or your bank.",
      "Nothing to collect any more: purchases and takings go straight to your bank, and you get a chat line every time something of yours sells or fills.",
      "First hit claims a monster: once you've hit it, nobody else can attack it until the fight ends or you leave it alone for 10 seconds (not in the Wilderness). Busy areas also respawn faster.",
    ],
  },
  {
    date: "2026-09-18", title: "The Gloam and Cloudreach",
    items: [
      "The Gloam, west of the Olive Grove: a wood where it is always five minutes before dark. Emerald and Diamond ore, Gloomwillows, and lanternfish in the black pond.",
      "Cloudreach, north off Tomatoe Hill: an island of cloud in the open sky. Dragonstone and storm-struck Onyx ore, Skyash trees, and sky eels fished straight out of the sky. The Angels of Minor Inconvenience attack on sight.",
      "Every tier of bar now smelts from its own ore (Onyx also wants one Wilderness grimstone).",
      "Six new monsters, up to level 55. Your body armour now shows its tier on your character.",
      "Right-click any item for its wiki page, and the xp tracker tells you when your next level lands.",
    ],
  },
  {
    date: "2026-09-18", title: "Attack, Strength, Defence, Smithing and five gear tiers",
    items: [
      "Melee is now three skills: Attack (accuracy), Strength (max hit) and Defence. Your old Melee level carried over into all three.",
      "Pick a stance in the Skills tab to choose which skill your fights train.",
      "Gear goes from Bronze up through Emerald, Diamond, Dragonstone and Onyx, ten levels apart. Weapons swing at different speeds.",
      "A new skill, Smithing: smelt ore into bars and hammer bars into gear. Brutus still sells bronze.",
      "An amulet slot, hover-to-compare on gear, an xp tracker and hiscores.",
      "Fishing, mining, chopping, picking, cooking and smithing now stop after 3 minutes with no clicks. The resources never run dry, but you have to be there.",
    ],
  },
  {
    date: "2026-09-18", title: "Cooking, eating and the Forge",
    items: [
      "A new skill, Cooking: cook raw fish and meat at the Farmhouse range, your cottage hearth or a campfire. Food can burn, less as you level.",
      "Click cooked food in your bag to eat it and heal, even mid-fight.",
      "Brutus the Smith has opened the Forge in the Forum: tools and the Bronze set for sale, and he'll buy what you gather.",
      "A bag slot now holds up to 99 of anything (Cash has no limit). Extra spills into the next slot; the bank still holds any amount.",
      "Bronze gear needs a Melee level to wear, and the Bronze cuirass changes your look from recruit to gladiator."
    ]
  },
  {
    date: "2026-09-18", title: "Bigger islands, the Far Shore, and your cottage",
    items: [
      "Island upgrades from Charon: a Bigger island (5,000 Cash) with 12 plots and 9 pedestals, then The Far Shore (20,000 Cash): a bridge to a second island with 8 more plots, 6 more pedestals and a lighthouse that points the wrong way.",
      "Your cottage opens: walk in through the door. A hearth, a bed, a chest and a lot of empty floor, for later.",
      "Wilderness monsters take longer to come back the tougher they are: from a minute up to three."
    ]
  },
  {
    date: "2026-09-18", title: "The Wilderness and your own island",
    items: [
      "The Wilderness is open, down the pit on the Ludus Farm (Melee 10). Anyone can attack anyone. The Cage, by the rope, is for fights that cost nothing.",
      "Die outside the Cage and there's a 1 in 4 chance you drop something you're wearing. Your killer has a minute to grab it.",
      "The Deep Wild: Tax Wraiths, Chandelier Spiders and the Sulking Revenant come looking for you. Grimstone, Deadwood and the Black Pool give 50% more xp, and sometimes a glimmering geode.",
      "New gear from the Wilderness: the Grudge knife, Tax Wraith hood, Bog-hound hide, Lantern shield, Ring of Mild Menace, and Eight-league boots, the first thing that makes you walk faster.",
      "Everyone has an island. Charon the Ferryman at River Bend rows you there. Grow crops while you're away, show off six things, pick a theme, and visit other people's islands."
    ]
  },
  {
    date: "2026-09-18", title: "The Forum opens north and east",
    items: [
      "The Forum now has gates on all four sides. The Forge moved over to make room for the north road.",
      "North: Tomatoe Hill. Tomatoe vines to pick, the Big Tomatoe, Nonna Tomatoe (it has an e), Rotten Tomatoes and Tomatoe Hornworms. And a golden vine for much later.",
      "East: the Via Appia. Cypress trees to chop, milestones, a toll post with Centurion Vibius, Highwaymen (level 12, they drop Cash and sometimes a mask), a very stubborn mule, and a marble outcrop for later. The road is washed out past the barricade.",
      "New things: tomatoes, golden tomatoes, hornworm husks, marble, and the Highwayman's mask (a helmet)."
    ]
  },
  {
    date: "2026-09-18", title: "The Bank, a lived-in farmhouse, and movement speed",
    items: [
      "The Bathhouse is now just the Bank, inside and out. It has a red runner to the counter, potted palms, benches, banners, a vault door, and a statue of its first depositor.",
      "The Farmhouse has a rug, stools, shelves, drying herbs, a window, a flour sack, a spare bucket and a cat in a tiny helmet.",
      "Movement speed is now a number the server keeps. Boots, pets and potions will raise it later: the first +20% counts in full, the rest counts half, and it caps at +50%. Your Equipment tab shows your speed.",
      "Your Cash and your name and picture now sit at the top right."
    ]
  },
  {
    date: "2026-09-18", title: "Buildings, the bank, the Exchange and trading",
    items: [
      "Buildings you can walk into: each is its own room. The Bank in the Forum and the Farmhouse on the Ludus Farm are open.",
      "The bank: 200 item slots, unlimited stacks.",
      "The Exchange: a market stall in the Forum with sell offers and buy orders that match on their own, a board to browse, and a 1% cut on sales.",
      "Trading face to face: click another player.",
      "The currency is now called Cash.",
      "This wiki.",
      "Level-up celebrations, in chat and on screen.",
      "The simulated players talk a lot less.",
      "Picked wheat is soil you can walk on until it grows back, so every stalk can be reached.",
      "A clearing round the copper at River Bend."
    ]
  },
  {
    date: "2026-09-18", title: "The server",
    items: [
      "The game moved to its own game server: everything is decided there, and your character saves itself continuously.",
      "Game-wide chat (bottom left, closed until you open it).",
      "Settings, and an admin panel for the builder.",
      "Your own movement is instant: the page walks you straight away and the server keeps it honest.",
      "What you gather pops up over your head."
    ]
  },
  {
    date: "2026-09-18", title: "The world",
    items: [
      "Four areas: Ludus Farm, River Bend, the Forum and the Olive Grove.",
      "Skills: Melee, Hitpoints, Fishing, Harvesting, Mining and Woodcutting.",
      "Quests from Bom Trady and Old Tullius.",
      "One high-level resource in every area, for later: the Ancient Yew, the Moonlit Eddy, the Fallen Star and the Sun Olive tree."
    ]
  }
];

// how each skill is trained, in words (the resources and their levels are added from the rules)
/* The one-line summary at the top of a skills/<id> page. Keep these SHORT — the page under them carries the
   tables, and the hand-written guide linked beside them carries the explanation. */
/* (2026-09-27, the owner: "breeding and fungiculture ... do a wiki pass for them") HOW A SKILL WITH NO GATHERING SPOTS TRAINS. The skill
   page's own tables come from what can be gathered and what can be made, and Breeding has neither, so its page said nothing at all.
   These are drawn from the rules, like the guides, so the xp cannot drift. */
export const SKILL_EXTRA = {
  breeding: (G, H) => {
    const B = G.BREED, n = (x) => Number(x).toLocaleString(), hrs = (ms) => `${Math.round(ms / 3600000)} hours`;
    const eggs = Object.entries(G.EGGS).map(([k, e]) => `<tr><td>${H.ico(k)} ${H.wl(`items/${k}`, H.esc(G.ITEMS[k]?.name || k))}</td><td>${hrs(e.ms)}</td><td>${n(Math.round(e.xp * 0.1))}</td><td>${n(e.xp)}</td></tr>`).join("");
    return `<h3>How it trains</h3>
      <table class="tbl"><tr><th>You do</th><th>Breeding</th><th>Takes</th><th>xp when you start</th><th>xp when you collect</th></tr>
      <tr><td>Breed two Ordinary pets into a Greater one</td><td>${B.greater.lvl}</td><td>${hrs(B.greater.ms)}</td><td>${n(B.greater.xpStart)}</td><td>${n(B.greater.xpEnd)}</td></tr>
      <tr><td>Breed two Greater pets into a Legendary one</td><td>${B.legend.lvl}</td><td>${hrs(B.legend.ms)}</td><td>${n(B.legend.xpStart)}</td><td>${n(B.legend.xpEnd)}</td></tr></table>
      <h3>Hatching eggs</h3><p>An egg goes in a hatchery with ${B.hatch.food} Ordinary pet food. You get a little xp when it goes in and the rest when it hatches.</p>
      <table class="tbl"><tr><th>Egg</th><th>Takes</th><th>xp when it goes in</th><th>xp when it hatches</th></tr>${eggs}</table>`;
  },
  fungiculture: (G, H) => {
    const n = (x) => Number(x).toLocaleString(), mins = (ms) => (ms >= 5400000 ? `${Math.round(ms / 360000) / 10} hours` : `${Math.round(ms / 60000)} minutes`);
    const rows = Object.values(G.FUNGI).map((F) => `<tr><td>${F.lvl}</td><td>${H.ico(F.yields)} ${H.wl(`items/${F.yields}`, H.esc(G.ITEMS[F.yields]?.name || F.yields))}</td><td>${mins(F.ms)}</td><td>${n(F.xp)}</td><td>${n(Math.max(10, Math.round(F.xp * G.FUNG.wildXp)))}</td></tr>`).join("");
    return `<h3>How it trains</h3><p>Three ways: making <b>compost</b> at the bin (the table below), harvesting a <b>fungus bed</b> in your cellar, and picking a <b>wild cluster</b> (one pick each a day).</p>
      <table class="tbl"><tr><th>Level</th><th>Shroom</th><th>Bed grows in</th><th>xp a harvest</th><th>xp a wild pick</th></tr>${rows}</table>`;
  },
};
/* (2026-10-01) the skill pages' one-liners once v1.1 is out (the page swaps them in when the HOLD it names is off) */
export const SKILL_GUIDE_V11 = {
  agility: ["thrill", "Run the stunt courses on Thrill Hill, through Dizzy Dale's counter in the south of the Yard's court. Each stunt pays, a lap pays far more, and it buys movement speed everywhere, plus every map's shortcuts and nooks."],
  thieving: ["thief2", "Pick pockets in the Thieves' Guild in the far north-east of the Gloam, or out in the world: monsters' pockets and a lockbox on most maps. Vance the Fence sells the Guild's permit and the lockpicks."],
};
export const SKILL_GUIDE = {
  tinkering: "Salvage what you don't need into parts at Sprocket Sal's Scrap Bench in the Yard, build gadgets out of them, and give parts to the World Projects the whole server builds together. Salvaging pays xp (up to 40 an item), building pays more the higher the gadget, and finishing a project's stage pays the most.",
  breeding: "Breed two pets in the pet pen on your island to make a better one, and hatch eggs in a hatchery. Starting a pair gives some xp and collecting the baby gives far more. Every pairing and every hatch trains it.",
  fungiculture: "Grow mushrooms in the cellar under your island, and pick the wild clusters on every map once a day. Compost from the bin in the cellar trains it from level 1 and feeds the beds.",
  alchemy: "Dig sand in the Golden Sands, melt it into vials at the cauldron under the temple colonnade, and brew the vials with crops, mushrooms and monster drops into potions, salves and ink. A potion is a drink that buffs you outside; a salve heals on the spot. Every batch can spoil, less often as you climb.",
  cooking: "Cook raw fish and meat at a range, hearth or campfire. Each food needs a level to cook and stops burning at a higher one. Cooked food heals when you eat it.",
  melee: "Fight monsters with a weapon in hand. Every point of damage you deal gives Melee xp, and a little Hitpoints xp with it. (With a bow in hand it is <b>Archery</b> xp instead.) Your combat level is Melee, Archery and Hitpoints together. One skill does all three jobs \u2014 you land more swings, you hit harder and you get hit less \u2014 and it is what better weapons and armour ask for.",
  hp: "Goes up alongside the fighting skills as you deal damage: fully with a melee weapon, a third as fast with a bow or a wand. Your Hitpoints level is your maximum health.",
  fishing: "Hold a fishing rod and click the water. Every spot holds two fish: the second is better, needs a higher level, and turns up about a third of the time once you can catch it.",
  farming: "Pick wild wheat in the Yard \u2014 the only gathering skill that needs nothing in your hand \u2014 or grow your own on your island, where a plot keeps growing while you are logged off: food crops, and from Harvesting 15 the four flowers Wizardry brews its inks from.",
  mining: "Hold a pickaxe and click a rock. Every rock holds two to twelve ore and you work it until it is empty; a vein is slower per ore but never runs dry, which makes it the one to stand at. Now and then an ore comes with a gem: rubies from copper, tin and emerald, sapphires from diamond and dragonstone, topaz from onyx and starfall, opals from eclipse, nova and singularity. Each gem's page says where those rocks are.",
  woodcutting: "Hold an axe and click a tree. A tree is good for about 25 logs before it falls and an oak for about 50; a felled one is back in fifteen seconds. Logs burn into the charcoal every smelt needs.",
  smithing: "Burn logs into charcoal at the furnace \u2014 the only thing you can do at level 1 \u2014 then smelt ore and charcoal into bars, and hammer bars into gear at the anvil. The anvil also reforges what you already own.",
  thieving: "Pick pockets in the Thieves' Guild, in the far north-east of the Gloam; Vance the Fence, by its door, sells the permit that opens it. Nobody there fights back. Each room further in holds better marks, and what they carry either sells or goes to the anvil.",
  archery: "Fight with a bow. Every hit pays Archery the xp Combat would have had, a bow shoots from where you stand, and a loaded quiver keeps you shooting. Fletching makes the kit; Archery draws it.",
  magic: "Fight with a wand. A wand casts from five tiles; the spell page you load sets the damage and the element, and monsters weak to that element take far more.",
  wizardry: "Print spell pages and utility scrolls at the element altars around the world, from paper and ink. The Nexus, deep in the Wilderness, prints anything, twice.",
  fletching: "Cut logs into shafts and bows, fletch arrows from a shaft, a smithed head and a feather, and load them into a quiver. A bow in your hand is speed and reach; the arrow in it is the damage.",
  agility: "Run the obstacle course north of the Yard. Each obstacle pays, a finished lap pays far more, and what it buys you is movement speed everywhere else."
};

/* ============================================================ THE WEEKLY ISSUE (2026-09-30). The owner: "user friendly mockups that are sharable with all users that live
   inside the wiki that use this same kind of formating … like a link in the wiki like updates: week 1 (post launch) and it includes major changes with
   pictures, links to relevant wiki information, stats of the week, total tickets wagered, interesting stats, dungeon clears, etc. we'll start doing once a
   week major updates after this anyways".
   ONE ISSUE A WEEK, written here: a hero, the big changes as picture cards (each links to its wiki page), what's worth knowing, and links. The NUMBERS
   are not written: the page asks the server for the week's ({t:"weekly", n}; eastscape-worker/src/weekly.js) and weeklyPage draws them, live while the
   week runs. A picture is "ui/<k>", "items/<k>", "mob/<k>" or "flat/<k>". Add next week's issue at the TOP. */
export const WEEKLY = [
  {
    n: 2, title: "Update 1.1", from: "2026-10-08", to: "2026-10-14", hold: "diary",
    lede: "The first big update since launch. A diary for every map and a cape for finishing them all, Thrill Hill for Agility, thieving and shortcuts out in the world, and work clothes for every skill.",
    hero: ["diary/diary", "flat/th_cannon", "items/lockpick", "items/pr_hat", "diary/cape_tour"],
    big: [
      { img: "diary/diary", title: "Area diaries", tease: "252 tasks, 21 medals, one cape. What you've already done counts.", peek: ["diary/r_yard", "diary/r_gloam", "diary/r_carn", "diary/r_north", "diary/r_wild"],
        text: "A diary for every map, four tiers each. A tier gives a perk on that map, an XP lamp and a medal. Press L: it opens on the map you're standing on.", wiki: "guides/diaries" },
      { img: "diary/cape_tour", title: "The cape slot", tease: "Every Elite diary. One cape. Everyone sees it.", peek: ["items/cape_tour", "diary/r_wild", "diary/r_north"],
        text: "An eleventh square on your paper doll, under your feet. The Grand Tour cape is the first: a free teleport anywhere once a day, and the title the Well-Travelled.", wiki: "guides/diaries" },
      { img: "flat/th_cannon", title: "Thrill Hill", tease: "Fire yourself out of a cannon. For the XP.", peek: ["flat/th_hoop", "flat/th_halfpipe", "flat/fasteddie_south", "flat/th_snackcart", "mob/crusher"],
        text: "Agility's new home, through Dizzy Dale's counter in the Yard: three stunt runs, Daredevil Peak up the cannon, Fast Eddie's runner's marks, Corndog Carl, and Big Daddy Crusher.", wiki: "guides/thrill" },
      { img: "items/lockpick", title: "Thieving in the world", tease: "Every monster has pockets. Some of them are worth it.", peek: ["mob/highwayman", "flat/o_lockbox", "items/skeleton_key", "flat/o_sc_rope", "flat/o_drain"],
        text: "Pick pockets out in the world, open a lockbox on most maps, and use your Agility on a shortcut or nook on every map, plus three back ways between them.", wiki: "guides/worldthief" },
      { img: "items/pr_hat", title: "Work clothes", tease: "Four pieces. Fifteen percent. Every skill.", peek: ["items/pr_hat", "items/br_apron", "items/sg_hat", "items/sl_overalls"],
        text: "A set for every skill: +3% XP a piece, a perk for all four, and each one found somewhere else than its own skill. They live in your Locker.", wiki: "guides/workclothes" },
      { img: "ui/skills", title: "The Character window", tease: "Every number about you, and where to get more.", peek: ["ui/skills", "ui/equip"],
        text: "From the Character button under your paper doll: your accuracy, strength, defence, speeds and every bonus, each with where to get more.", wiki: "guides/character" },
      { img: "items/ruby", title: "Gems: rarer, and yours", tease: "Found one? Keep it.", peek: ["items/ruby", "items/sapphire"],
        text: "A quarter as many gems drop, and they can't be traded or put on the Exchange any more. Any gem still on the Exchange was taken down and sent back to its seller's collection box.", wiki: "guides/gems" },
    ],
    worth: [
      "Press L for your diary. Old players: check it first, your history is already ticked off and there may be lamps waiting.",
      "The Run in the Yard is closed: Agility is Thrill Hill now, and the shortcuts on every map.",
      "Settings has a Jukebox volume now, separate from the game's sound.",
      "Lockpicks are 1,000 tickets at Vance the Fence in the Gloam.",
    ],
    links: [["guides/diaries", "Area diaries"], ["guides/thrill", "Thrill Hill"], ["guides/worldthief", "Thieving in the world"], ["guides/workclothes", "Work clothes"], ["updates", "Every update"]]
  },
  {
    n: 1, title: "Launch week", from: "2026-10-01", to: "2026-10-07",
    lede: "EastScape is open to everyone. Here's what's in the world on day one, the changes that landed in the last week before launch, and the numbers as the first week happens.",
    hero: ["mob/icewyrm", "mob/raidchief", "flat/pet_wyrmling", "ui/g_islands", "mob/rex"],
    big: [
      { img: "ui/g_islands", title: "Islands, rebuilt", text: "Much bigger, with beaches and paths, eight themes, cottage styles and interiors, and livestock that fill up while you're away. Type /island for every timer.", wiki: "guides/islands" },
      { img: "ui/g_store", title: "The Store", text: "Trails, glows, weapon hits, hit splats, titles, pet skins, decor, the War Horn, 2X boosts for the whole server, loupes, bank pages, quick slots and bag slots.", wiki: "guides/store" },
      { img: "ui/g_raid", title: "The Yard raid", text: "The Ice Man and his war party come for the Yard. Everyone who fights shares the spoils; lose, and the Yard's stalls are boarded up.", wiki: "guides/raid" },
      { img: "ui/g_frozen", title: "The Frozen Reach", text: "A mage's country north of Cloudreach, where the cold itself hurts. The Frost Jarl, and the Ice Wyrm rising once a day at an hour nobody knows.", wiki: "guides/frozen" },
      { img: "ui/g_valley", title: "The Primeval Valley", text: "Three maps of ledges and dinosaurs where an arrow reaches what a sword can't. Old Rex, the Mammoth Matriarch, and a Golden Raptor now and then.", wiki: "guides/valley" },
      { img: "ui/g_commands", title: "/find and chat commands", text: "/find anything and it tells you where it is and the way there. Plus /price, /count, /xp, /timers, /bosses and more. /help lists them.", wiki: "guides/commands" },
      { img: "ui/g_updates", title: "The wiki, rebuilt", text: "Every list is a sortable table, every area shows its monsters and nodes with levels, every item says who sells it and what it does. Eleven new guides.", wiki: "list/Guides" },
      { img: "items/skill_smithing", title: "A balance pass", text: "From the hiscores and every skill side by side: smithed gear sells for its bars, late monsters pay far more, the Tower pays, Wizardry and Harvesting are quicker, Thieving is cheaper to start.", wiki: "updates" }
    ],
    worth: [
      "New here? The Start here guide and the house tour take ten minutes, and the Yard has everything you need for your first twenty levels.",
      "Tickets are the one currency: every kill, catch and job pays them, and the Prize Counter turns 1,000 into a real ZCoin.",
      "The Pumpkin King rises on the hour during the Long Night, and the Ice Wyrm once a day: /bosses says what's up right now.",
      "Can't find something? Type /find and its name in chat. Want to know what it IS? That's what this wiki is for."
    ],
    links: [["guides/start", "Start here"], ["guides/road", "The road out"], ["guides/commands", "Chat commands"], ["updates", "Every update"]]
  }
];
export const WEEKLY_CSS = `
.wk{--wk-ink:#2a2016;--wk-dim:#6a5a40;--wk-gold:#c8963a}
.wk-hero{position:relative;overflow:hidden;border-radius:10px;padding:18px 18px 16px;background:linear-gradient(135deg,#3a1e12,#5a3220 55%,#2a1810);color:#f6e9cc;box-shadow:0 0 0 2px #c8963a,0 6px 18px rgba(40,20,5,.35)}
.wk-hero small{display:block;font:800 11px Lora,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e0c890}
.wk-hero h2{margin:4px 0 6px!important;font:800 26px/1.1 "Cinzel",Georgia,serif!important;color:#ffe7b0!important;border:0!important}
.wk-hero p{margin:0;max-width:640px;color:#f0e2c0;font-size:14px;line-height:1.5}
.wk-art{display:flex;gap:10px;margin-top:12px;align-items:flex-end}.wk-art img{height:44px;image-rendering:pixelated;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
.wk-share{position:absolute;right:12px;top:12px;padding:5px 10px;border:0;border-radius:999px;background:rgba(255,231,176,.15);color:#ffe7b0;font:800 12px Lora,sans-serif;cursor:pointer}.wk-share:hover{background:rgba(255,231,176,.28)}
.wk h3{margin:18px 0 8px;font:800 13px Lora,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--wk-gold)}
.wk-big{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
.wk-card{display:grid;grid-template-columns:44px 1fr;gap:10px;align-items:start;padding:10px 12px;border-radius:8px;background:#e6d4ad;box-shadow:inset 0 0 0 1.5px #c2a574;cursor:pointer;text-decoration:none;color:inherit}
.wk-card:hover{background:#fff6dc;box-shadow:inset 0 0 0 2px #c8963a}
.wk-card,.wk-card *,.wk-list a,.wk-list a *{text-decoration:none!important}
.wk-card img{width:40px;height:40px;image-rendering:pixelated;object-fit:contain}
.wk-card b{display:block;font:800 15px/1.2 "Cinzel",Georgia,serif;color:var(--wk-ink)}.wk-card span{display:block;margin-top:3px;font:600 12.5px/1.4 Lora,sans-serif;color:var(--wk-dim)}
.wk-tease{display:block;margin-top:3px;font:italic 700 12.5px/1.35 Lora,sans-serif;color:#8a3a14}.wk-peek{display:flex!important;gap:6px;margin-top:7px!important;padding:6px 8px;border-radius:7px;background:#2a1a10;align-items:flex-end;flex-wrap:wrap}.wk-peek img{width:30px!important;height:30px!important;image-rendering:pixelated;object-fit:contain;filter:drop-shadow(0 1px 2px rgba(0,0,0,.6))}
.wk-card i{display:block;margin-top:4px;font:800 11.5px Lora,sans-serif;font-style:normal;color:#8a5a14}
.wk-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px}
.wk-tile{padding:10px;border-radius:8px;background:#2a1a10;color:#f6e9cc;text-align:center;box-shadow:inset 0 0 0 1.5px #5a3a1a}
.wk-tile b{display:block;font:900 20px/1.1 "Cinzel",Georgia,serif;color:#ffd84a}.wk-tile small{display:block;margin-top:3px;font:700 11px Lora,sans-serif;color:#d8c8a8}
.wk-note{margin:6px 0 0;font:600 12.5px Lora,sans-serif;color:var(--wk-dim)}
.wk-bars{display:grid;gap:4px}.wk-bar{display:grid;grid-template-columns:22px 110px 1fr 90px;gap:8px;align-items:center;font:700 12.5px Lora,sans-serif}
.wk-bar .ico{width:20px;height:20px}.wk-bar em{display:block;height:10px;border-radius:5px;background:linear-gradient(90deg,#c8963a,#ffd84a)}.wk-bar u{text-decoration:none;text-align:right;font-variant-numeric:tabular-nums;color:var(--wk-dim)}
.wk-tops{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.wk-top{padding:10px 12px;border-radius:8px;background:#e6d4ad;box-shadow:inset 0 0 0 1.5px #c2a574}.wk-top b{display:block;font:800 12px Lora,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a5a14;margin-bottom:4px}
.wk-top ol{margin:0;padding-left:20px;font:600 13px Lora,sans-serif}.wk-top li span{float:right;font-variant-numeric:tabular-nums;color:var(--wk-dim)}
.wk-worth{margin:0;padding-left:18px;font:600 13.5px/1.55 Lora,sans-serif}
.wk-links{display:flex;flex-wrap:wrap;gap:6px}.wk-links a{padding:5px 11px;border-radius:999px;background:#e6d4ad;box-shadow:inset 0 0 0 1.5px #c2a574;font:800 12.5px Lora,sans-serif;cursor:pointer}
.wk-list{display:grid;gap:8px}.wk-list a{display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;padding:10px 12px;border-radius:8px;background:#e6d4ad;box-shadow:inset 0 0 0 1.5px #c2a574;cursor:pointer;text-decoration:none;color:inherit}
.wk-list a b{display:block;font:800 16px "Cinzel",Georgia,serif}.wk-list a small{display:block;font:600 12.5px Lora,sans-serif;color:#6a5a40}.wk-list a i{font:900 13px "Cinzel",serif;font-style:normal;text-align:center;padding:8px 0;border-radius:8px;background:#5a3220;color:#ffe7b0}
@media (max-width:620px){.wk-bar{grid-template-columns:22px 80px 1fr 70px}.wk-hero h2{font-size:21px!important}}
`;
/** a week's dates, in words: "Thu 1 Oct to Wed 7 Oct" */
const wkDays = (a, b) => { const f = (s) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); return `${f(a)} to ${f(b)}`; };
/** one issue's page. H: { esc, wl, img(key) -> <img>, sico(skill) -> icon html, SKILLS, BOSS(t) -> name, TIER(t) -> dungeon name } and S, the server's numbers (or null while they come) */
export function weeklyPage(G, H, W, S) {
  const n = (v) => Math.round(v || 0).toLocaleString(), k = (v) => v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}k` : n(v);
  const cards = W.big.map((c) => `<a class="wk-card" data-wiki="${H.esc(c.wiki)}">${H.img(c.img)}<span><b>${H.esc(c.title)}</b>${c.tease ? `<em class="wk-tease">${H.esc(c.tease)}</em>` : ""}<span>${H.esc(c.text)}</span>${(c.peek || []).length ? `<span class="wk-peek">${c.peek.map(H.img).join("")}</span>` : ""}<i>Read more &rarr;</i></span></a>`).join("");   /* (2026-10-01) tease and peek: a line that sells it and a strip of its art */
  let nums = "";
  if (!S) nums = `<p class="wk-note">Asking the server for the week's numbers&hellip;</p>`;
  else if (!S.have) nums = `<p class="wk-note">The numbers start when the week does, on ${H.esc(wkDays(W.from, W.from).split(" to ")[0])}.</p>`;
  else {
    const T = S.totals || {}, A = S.acc || {}, clears = Object.values(S.clears || {}).reduce((a, b) => a + b, 0), bosses = Object.values(A.bosses || {}).reduce((a, b) => a + b, 0);
    const tiles = [[k(T.earned), "tickets earned"], [k(T.wagered), "tickets wagered"], [k(T.xp), "xp gained"], [n(T.kills), "monsters killed"], [n(T.quests), "quests finished"], [n(clears), "dungeon clears"], [n(bosses), "world bosses down"], [n(T.floors), "Tower floors climbed"], [n(S.jackpots), "Jackpots hit"], [n(T.zcoins), "ZCoins found"], [n(A.raids?.won || 0), "raids beaten"], [n(A.peak), "most online at once"], [n(S.active), "people played"], ...(S.sofar ? [] : [[n(S.fresh), "new players"]]), [n(T.hours), "hours played"]];
    const sk = Object.entries(S.skills || {}).sort((a, b) => b[1] - a[1]), mx = sk[0]?.[1] || 1;
    const tops = [["xp", "Most xp"], ["kills", "Most kills"], ["earned", "Most tickets earned"], ["quests", "Most quests"]].filter(([key]) => (S.top?.[key] || []).length)
      .map(([key, label]) => `<div class="wk-top"><b>${label}</b><ol>${S.top[key].map((r) => `<li>${H.esc(r.name)} <span>${k(r.v)}</span></li>`).join("")}</ol></div>`).join("");
    const bossList = Object.entries(A.bosses || {}).map(([t, c]) => `${H.esc(H.BOSS(t))} &times;${c}`).join(", "), clearList = Object.entries(S.clears || {}).map(([t, c]) => `${H.esc(H.TIER(t))} &times;${c}`).join(", ");
    nums = `<div class="wk-tiles">${tiles.map(([v, l]) => `<div class="wk-tile"><b>${v}</b><small>${l}</small></div>`).join("")}</div>
      <p class="wk-note">${S.sofar ? `Before launch: everything the world has done so far. The week's own numbers start on ${H.esc(wkDays(W.from, W.from).split(" to ")[0])}.` : S.live ? "Live: the week isn't over yet, so these climb as it goes." : "The whole week."}${bossList ? ` World bosses: ${bossList}.` : ""}${clearList ? ` Clears: ${clearList}.` : ""}</p>
      ${sk.length ? `<h3>Where the xp went</h3><div class="wk-bars">${sk.slice(0, 12).map(([s, v]) => `<div class="wk-bar">${H.sico(s)}<span>${H.esc(H.SKILLS[s]?.name || s)}</span><em style="width:${Math.max(2, (100 * v) / mx)}%"></em><u>${k(v)} xp</u></div>`).join("")}</div>` : ""}
      ${tops ? `<h3>Top of the week</h3><div class="wk-tops">${tops}</div>` : ""}`;
  }
  return `<style>${WEEKLY_CSS}</style><div class="wk">
    <div class="wk-hero"><small>Week ${W.n} &middot; ${H.esc(wkDays(W.from, W.to))}</small><h2>${H.esc(W.title)}</h2><p>${H.esc(W.lede)}</p>
      <div class="wk-art">${(W.hero || []).map(H.img).join("")}</div><button type="button" class="wk-share" data-wkshare="${W.n}">Copy link</button></div>
    <h3>The big ones</h3><div class="wk-big">${cards}</div>
    <h3>By the numbers</h3>${nums}
    ${(W.worth || []).length ? `<h3>Worth knowing</h3><ul class="wk-worth">${W.worth.map((t) => `<li>${H.esc(t)}</li>`).join("")}</ul>` : ""}
    ${roadmapNext(G, H)}
    ${(W.links || []).length ? `<h3>Read next</h3><div class="wk-links">${W.links.map(([r, t]) => H.wl(r, H.esc(t))).join("")}</div>` : ""}
  </div>`;
}
/** the list of issues, newest first */
export function weeklyList(H) {
  return `<style>${WEEKLY_CSS}</style><p class="lede">A new issue every week: the big changes with pictures, and the week's numbers.</p><div class="wk-list">${WEEKLY.filter((W) => !H.held?.(W)).map((W) => `<a data-wiki="weekly/${W.n}"><i>WEEK<br>${W.n}</i><span><b>${H.esc(W.title)}</b><small>${H.esc(wkDays(W.from, W.to))} &middot; ${H.esc(W.lede.slice(0, 110))}${W.lede.length > 110 ? "&hellip;" : ""}</small></span></a>`).join("")}</div>`;
}

/* ============================================================ THE ROAD AHEAD (2026-09-30): the words and pictures for each card in G.ROADMAP, and the page.
   A card's picture is a key in the Weekly issue's form ("ui/skills", "items/star_crate", "pumpkinking"); a rumour's `bg` is a map picture shown blurred and
   dark, with its `sil` monster drawn as a black silhouette, so it teases without showing the map. `more` is the list in the opened card. Moving a card is
   editing its line in G.ROADMAP; changing what it says is editing it here. No dates until something is in testing. */
export const ROADMAP_WORDS = {
  v11_diaries: { title: "Area diaries and the cape", text: "A diary for every map, and the Grand Tour cape for finishing them all.", img: "diary/diary", wiki: "guides/diaries" },
  v11_thrill: { title: "Thrill Hill", text: "Agility's new home: three stunt runs, a cannon and Daredevil Peak.", img: "flat/th_cannon", wiki: "guides/thrill" },
  v11_thief: { title: "Thieving and shortcuts in the world", text: "Pockets, lockboxes, a nook on every map and three back ways.", img: "items/lockpick", wiki: "guides/worldthief" },
  v11_work: { title: "Work clothes", text: "A set for every skill, kept in your Locker.", img: "items/pr_hat", wiki: "guides/workclothes" },
  abilities: { title: "Abilities", text: "Three for each fighting style, firing in the order you set. Built, and waiting for the first player to reach 99 in a combat skill.", img: "ui/skills",
    more: ["Heavy Blow, Cleave and Brace for melee", "Power Shot, Volley and Disengage for a bow", "Bolt, Blast and Barrier for magic", "Nothing to press: you only choose the order"] },
  capes99: { title: "Capes for 99", text: "A cape for every skill at 99, for the new cape slot.", img: "items/cape_tour" },
  events: { title: "World events", text: "Shooting Stars, Wanted! and the Jackpot Thief, one of each a day.", img: "flat/o_fallenstar", wiki: "guides/events" },
  wildrearm: { title: "The Wild, rearmed", text: "Late-map monsters, better pay for a kill, and dying there costs.", img: "flat/sabretooth", wiki: "areas/wild" },
  returns: { title: "Returns at Bom", text: "Bought the wrong gear? It goes back within the hour for what you paid.", img: "ui/bom_face" },
  screen: { title: "Your screen", text: "Move anything on the screen, pick a look, and choose which names and plates show. Settings, under the gear.", img: "ui/settings",
    more: ["Drag the minimap, chat, buffs and the rest; windows move by their title bars", "Five looks: OG, Tavern, Midnight, Neon and Minimal", "Names, health plates and the busy effects, each on or off"] },
  mystats: { title: "My stats", text: "Your own dashboard: where your time goes, where your tickets come from, what keeps killing you.", img: "ui/skills",
    more: ["A button on your own profile, and only you can see it", "Your last 60 days, day by day", "Every map, and what you do there"] },
  phone: { title: "Play on your phone", text: "Every window and the tables, laid out for a phone, without chat in the way.", img: "ui/g_home",
    more: ["Windows that fit a phone screen", "Tables you can play with a thumb", "Chat that folds away"] },
  tables: { title: "Straight to a table", text: "Pick a table and go, from anywhere, and a two-minute lesson on how they work.", img: "flat/o_roulette",
    more: ["Open the tables from anywhere", "Your favourite tables at the top", "A short lesson the first time at each"] },
  featured: { title: "The Store's Featured shelf", text: "A different set of looks every week, and a Mystery Bag.", img: "ui/g_store",
    more: ["A new shelf every week", "A Mystery Bag with a look you don't have yet"] },
  gifting: { title: "Gifting", text: "Buy something in the Store for a friend, with a note.", img: "items/star_crate" },
  callworld: { title: "Call the world", text: "Summon the Pumpkin King, start a Lucky Hour, or call Nightfall for everyone.", img: "flat/pumpkinking",
    more: ["Things everybody on the server shares", "Bought in the Store, started by you, announced to all"] },
  waystone: { title: "A waystone home", text: "One stone that always takes you to your island.", img: "items/waystone_valley" },
  newmap_fire: { title: "A new map, under the Thunderhead", text: "Somewhere hot and deep, with its own monsters, a boss at the bottom, and better pets. The rumours below know more.", img: "flat/slaggolem",
    more: ["A new area to open up, for the top of the server", "Its own monsters, drops and pets", "A boss at the far end"] },
  newmap_green: { title: "A new map, past the Boneyard's wall", text: "Something green and tended on the other side of a wall nobody remembers building.", img: "flat/gardener",
    more: ["A new area off the Boneyard", "Its own monsters, drops and pets"] },
  chase: { title: "New chase items", text: "Rare drops worth hunting on the late maps: rings, amulets and weapons with effects of their own, a few of them one in a thousand.", img: "items/angels_ring",
    more: ["New rare drops on the late maps", "Effects you can't get anywhere else", "Shown off on your profile when you land one"] },
  past99: { title: "Monsters past level 99", text: "Fights for the very top of the server: monsters above level 99, and a reason to keep upgrading.", img: "flat/icewyrm",
    more: ["Monsters stronger than anything out there now", "Drops to match"] },
  event4: { title: "A fourth world event", text: "Something new for the whole server, once a day. Tell us what you'd want it to be.", img: "ui/ev_poster" },
  ideas: { title: "Your ideas, in the game", text: "Send an idea from the game and see it land here.", img: "ui/g_updates" },
  rumour_fire: { title: "Something is burning underneath", text: "Miners on the Thunderhead's south ridge say the rock is warm to the touch, and something down there hammers all night.", heard: "Heard in the Thunderhead", bg: "flat/foundry_bg1", sil: "flat/slaggolem", hue: "fire" },
  rumour_ascend: { title: "Past the top, you choose what you become", text: "The old hands at the top of the hiscores talk about a road past mastery: pick one way to fight and give yourself to it, and it gives you something nobody else has. Nobody who's walked it has come back the same.", heard: "Heard at the top of the hiscores", bg: "flat/dp_bg1", sil: "flat/hero_onyx_south", hue: "arcane" },
  rumour_wall: { title: "Past the wall, it's green", text: "There's a wall at the bottom of the Boneyard nobody remembers building, and on the other side, somebody is tending an orchard.", heard: "Heard in the Boneyard", bg: "flat/orchard_bg1", sil: "flat/gardener", hue: "leaf" }
};
const RM_STATUS = { live: ["LIVE", "rm-st-live"], testing: ["In testing", "rm-st-test"], building: ["Building", "rm-st-build"], planned: ["Planned", "rm-st-plan"], idea: ["Idea", "rm-st-plan"] };
export const ROADMAP_CSS = `
.rm{--rm-ink:#2a2016;--rm-dim:#6a5a40;--rm-gold:#c8963a}
.rm-hero{position:relative;overflow:hidden;border-radius:10px;padding:20px 20px 16px;color:#f6e9cc;background:#2a1810;box-shadow:0 0 0 2px #c8963a,0 6px 18px rgba(40,20,5,.35)}
.rm-hero .rm-bg{position:absolute;inset:0;background-position:center 30%;background-size:cover;image-rendering:pixelated;filter:saturate(.8) brightness(.45)}
.rm-hero .rm-shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(40,20,10,.95) 0%,rgba(40,20,10,.75) 55%,rgba(40,20,10,.35))}
.rm-hero>*:not(.rm-bg):not(.rm-shade){position:relative}
.rm-hero small{display:block;font:800 11px Lora,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e0c890}
.rm-hero h2{margin:4px 0 6px!important;font:800 26px/1.1 "Cinzel",Georgia,serif!important;color:#ffe7b0!important;border:0!important}
.rm-hero p{margin:0;max-width:600px;color:#f0e2c0;font-size:14px;line-height:1.5}
.rm-art{display:flex;flex-wrap:wrap;gap:14px;margin-top:14px;align-items:flex-end}.rm-art img{height:48px;image-rendering:pixelated;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}
.rm-share{position:absolute;right:12px;top:12px;padding:5px 10px;border:0;border-radius:999px;background:rgba(255,231,176,.15);color:#ffe7b0;font:800 12px Lora,sans-serif;cursor:pointer}
.rm h3{margin:18px 0 8px;font:800 13px Lora,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--rm-gold)}
.rm-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin-top:12px}
.rm-tile{padding:10px;border-radius:8px;background:#2a1a10;color:#f6e9cc;text-align:center;box-shadow:inset 0 0 0 1.5px #5a3a1a}
.rm-tile b{display:block;font:900 20px/1.1 "Cinzel",Georgia,serif;color:#ffd84a}.rm-tile small{display:block;margin-top:3px;font:700 11px Lora,sans-serif;color:#d8c8a8}
.rm-live{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}
.rm-lv{position:relative;display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center;padding:10px 12px;border-radius:8px;background:#dff0d4;box-shadow:inset 0 0 0 1.5px #7fb07a;cursor:pointer;text-decoration:none!important;color:inherit}
.rm-lv img{width:44px;height:44px;object-fit:contain;image-rendering:pixelated}
.rm-lv b{display:block;font:800 14.5px/1.2 "Cinzel",serif}.rm-lv span span{display:block;font:600 12px Lora,serif;color:#4a5a40;margin-top:2px}
.rm-lv i{position:absolute;right:8px;top:8px;font:900 10px Lora,serif;font-style:normal;letter-spacing:.08em;padding:2px 7px;border-radius:999px;background:#2f7a3a;color:#fff}
.rm-lanes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
@media (max-width:820px){.rm-lanes{grid-template-columns:1fr}}
.rm-lane{background:#e6d4ad;border-radius:10px;padding:10px;box-shadow:inset 0 0 0 1.5px #c2a574}
.rm-lane>header{display:flex;align-items:center;gap:8px;margin:0 2px 8px}.rm-lane>header b{font:800 16px "Cinzel",serif}.rm-lane>header small{margin-left:auto;font:700 11.5px Lora,serif;color:var(--rm-dim)}
.rm-lane>header i{width:10px;height:10px;border-radius:50%;display:inline-block}
.rm-card{display:grid;grid-template-columns:52px 1fr;gap:10px;align-items:start;padding:10px;margin-bottom:8px;border-radius:8px;background:#f6ecd3;box-shadow:0 1px 0 rgba(90,58,24,.25),inset 0 0 0 1px rgba(90,58,24,.15);cursor:pointer}
.rm-card:hover{background:#fff6dc;box-shadow:inset 0 0 0 2px #c8963a}
.rm-pic{width:52px;height:52px;border-radius:6px;background:#2a1a10;display:grid;place-items:center;overflow:hidden}.rm-pic img{max-width:46px;max-height:46px;object-fit:contain;image-rendering:pixelated}
.rm-card b{display:block;font:800 14.5px/1.2 "Cinzel",serif;color:var(--rm-ink)}.rm-card p{margin:3px 0 6px;font:600 12.5px/1.4 Lora,serif;color:var(--rm-dim)}
.rm-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rm-chip{display:inline-flex;padding:2px 8px;border-radius:999px;font:800 10.5px Lora,serif;letter-spacing:.04em}
.rm-st-build{background:#f3d98a;color:#5a3a00}.rm-st-test{background:#cfe0fb;color:#16407a}.rm-st-plan{background:#e0d6c2;color:#5a4a30}.rm-st-live{background:#2f7a3a;color:#fff}
.rm-want{margin-left:auto;display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;border:0;background:#fff;box-shadow:inset 0 0 0 1.5px #c2a574;font:800 11.5px Lora,serif;color:#8a3a2a;cursor:pointer}
.rm-want[aria-pressed="true"]{background:#c8963a;color:#fff;box-shadow:none}
.rm-bar{height:5px;border-radius:3px;background:rgba(90,58,24,.15);overflow:hidden;margin-top:6px}.rm-bar i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#c8963a,#ffd84a)}
.rm-tease{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}
.rm-tz{position:relative;overflow:hidden;border-radius:10px;min-height:150px;padding:14px;color:#f0e2c0;box-shadow:0 0 0 2px #4a2a5a}
.rm-tz .rm-bg{position:absolute;inset:-10px;background-size:cover;background-position:center;filter:blur(5px) brightness(.35) saturate(.6)}
.rm-tz .rm-glow{position:absolute;inset:0;background:radial-gradient(260px 140px at 75% 70%,rgba(255,120,40,.28),transparent 70%)}
.rm-tz.leaf .rm-glow{background:radial-gradient(260px 140px at 75% 70%,rgba(140,220,120,.22),transparent 70%)}
.rm-tz>*:not(.rm-bg):not(.rm-glow):not(.rm-sil){position:relative}
.rm-tz small{font:800 10.5px Lora,serif;letter-spacing:.14em;text-transform:uppercase;color:#d8b8ff}
.rm-tz b{display:block;margin:4px 0 6px;font:800 18px "Cinzel",serif;color:#ffe7b0}.rm-tz p{margin:0;max-width:62%;font:600 13px/1.45 Lora,serif}
.rm-tz img.rm-sil{position:absolute;right:14px;bottom:10px;height:88px;image-rendering:pixelated;filter:brightness(0) drop-shadow(0 0 8px rgba(255,140,60,.8))}
.rm-tz.leaf img.rm-sil{filter:brightness(0) drop-shadow(0 0 8px rgba(150,230,120,.7))}
.rm-tz.arcane{box-shadow:0 0 0 2px #c8963a}.rm-tz.arcane .rm-glow{background:radial-gradient(240px 150px at 78% 68%,rgba(190,120,255,.32),rgba(255,210,110,.12) 45%,transparent 72%)}
.rm-tz.arcane img.rm-sil{height:132px;bottom:4px;filter:brightness(0) drop-shadow(0 0 6px rgba(255,215,120,.9)) drop-shadow(0 0 14px rgba(180,110,255,.7))}
.rm-idea{display:grid;grid-template-columns:56px 1fr;gap:12px;align-items:center;padding:12px;border-radius:10px;background:#2a1a10;color:#f6e9cc;box-shadow:inset 0 0 0 1.5px #5a3a1a}
.rm-idea img{width:52px;height:52px;image-rendering:pixelated}.rm-idea b{display:block;font:800 16px "Cinzel",serif;color:#ffe7b0}.rm-idea span{font:600 12.5px Lora,serif;color:#d8c8a8}
.rm-idea form{grid-column:1/-1;display:flex;gap:6px}.rm-idea input{flex:1;min-width:0;padding:8px 10px;border-radius:6px;border:0;background:#f6ecd3;font:600 13px Lora,serif;color:#2a2016}
.rm-idea button{padding:0 14px;border:0;border-radius:6px;background:#c8963a;color:#fff;font:800 13px Lora,serif;cursor:pointer}
.rm-msg{grid-column:1/-1;margin:0;min-height:1em;font:700 12.5px Lora,serif;color:#ffd98a}.rm-msg.ok{color:#9fe8a0}.rm-msg.bad{color:#ffb0a0}
.rm-open{border-radius:12px;overflow:hidden;background:#f6ecd3;box-shadow:0 0 0 2px #c8963a,0 8px 22px rgba(40,20,5,.35);margin:0 0 12px}
.rm-open .rm-top{position:relative;height:140px;background:#2a1810;overflow:hidden;display:flex;align-items:flex-end;gap:14px;padding:0 54px 12px 18px;box-sizing:border-box}
.rm-open .rm-top .rm-bg{position:absolute;inset:0;background-size:cover;background-position:center;image-rendering:pixelated;filter:brightness(.5)}
.rm-open .rm-top img{position:relative;flex:0 0 auto;max-height:88px;max-width:40%;image-rendering:pixelated;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))}
.rm-open .rm-top h4{position:relative;margin:0 0 4px;font:800 22px/1.15 "Cinzel",serif;color:#ffe7b0;text-shadow:0 2px 3px #000}
.rm-open .rm-x{position:absolute;right:10px;top:10px;border:0;border-radius:999px;width:30px;height:30px;background:rgba(255,231,176,.2);color:#ffe7b0;font:800 16px Lora,serif;cursor:pointer}
.rm-open .rm-body{padding:12px 14px}.rm-open p{margin:0 0 10px;font:600 13.5px/1.5 Lora,serif;color:#4a3a28}
.rm-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:4px 0 12px}
.rm-steps div{padding:6px 4px;text-align:center;border-radius:6px;background:#e0d6c2;font:800 11px Lora,serif;color:#6a5a40}
.rm-steps div.done{background:#c8963a;color:#fff}.rm-steps div.here{background:#fff6dc;box-shadow:inset 0 0 0 2px #c8963a;color:#2a2016}
.rm-open ul{margin:0 0 10px;padding-left:18px;font:600 13px/1.5 Lora,serif;color:#4a3a28}
.rm-next{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.rm-next a{flex:0 0 140px;padding:8px;border-radius:8px;background:#e6d4ad;box-shadow:inset 0 0 0 1.5px #c2a574;text-align:center;font:800 12.5px "Cinzel",serif;color:#2a2016;cursor:pointer;text-decoration:none!important}
.rm-next img{display:block;margin:0 auto 4px;height:38px;image-rendering:pixelated}
`;
const rmCardsIn = (G, lane) => (G.ROADMAP?.cards || []).filter((c) => c.lane === lane && ROADMAP_WORDS[c.id]);
/** the steps an opened card shows */
const rmStep = (c) => ({ idea: 0, planned: 0, building: 1, testing: 2, live: 3 })[c.lane === "live" ? "live" : c.status] ?? 0;
/** the page. H: the Weekly issue's helpers plus src(key) -> a picture's address. V: the server's { counts, mine } or null while it comes. open: a card id, shown opened at the top */
export function roadmapPage(G, H, V, open) {
  const esc = H.esc, W = ROADMAP_WORDS, counts = V?.counts || {}, mine = new Set(V?.mine || []);
  const want = (c) => G.roadmapVotable(c.id) ? `<button type="button" class="rm-want" data-rmvote="${c.id}" aria-pressed="${mine.has(c.id)}" title="${mine.has(c.id) ? "You want this. Click again to take it back." : "Want this? One heart each."}">♥ ${V ? (counts[c.id] || 0).toLocaleString() : "…"}</button>` : "";
  const chip = (c) => { const [t, cls] = RM_STATUS[c.lane === "live" ? "live" : c.status] || RM_STATUS.planned; return `<span class="rm-chip ${cls}">${t}</span>`; };
  const card = (c) => `<div class="rm-card" data-rmcard="${c.id}"><span class="rm-pic">${H.img(W[c.id].img)}</span><span><b>${esc(W[c.id].title)}</b><p>${esc(W[c.id].text)}</p><span class="rm-meta">${chip(c)}${want(c)}</span>${c.pct ? `<span class="rm-bar"><i style="width:${Math.max(4, Math.min(100, c.pct))}%"></i></span>` : ""}</span></div>`;
  const lane = (k, name, sub, dot) => `<div class="rm-lane"><header><i style="background:${dot}"></i><b>${name}</b><small>${sub}</small></header>${rmCardsIn(G, k).map(card).join("") || `<p class="wk-note">Nothing here right now.</p>`}</div>`;
  const live = rmCardsIn(G, "live"), now = rmCardsIn(G, "now"), next = rmCardsIn(G, "next"), later = rmCardsIn(G, "later"), rum = rmCardsIn(G, "rumour");
  const upd = new Date(`${G.ROADMAP.updated}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  let top = "";
  const oc = open && (G.ROADMAP.cards || []).find((c) => c.id === open && W[c.id]);
  if (oc) { const w = W[oc.id], s = rmStep(oc);
    top = `<div class="rm-open"><div class="rm-top"><div class="rm-bg" style="background-image:url(${H.src("flat/boardwalk_bg1")})"></div>${H.img(w.img)}<h4>${esc(w.title)}</h4><button type="button" class="rm-x" data-rmclose aria-label="Close">×</button></div>
      <div class="rm-body"><div class="rm-steps">${["Idea", "Building", "Testing", "Live"].map((t, i) => `<div class="${i < s ? "done" : i === s ? "here" : ""}">${t}</div>`).join("")}</div>
      <p>${esc(w.text)}</p>${(w.more || []).length ? `<ul>${w.more.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <span class="rm-meta">${chip(oc)}${want(oc)}${w.wiki ? H.wl(w.wiki, "Read about it &rarr;") : ""}</span></div></div>`; }
  return `<style>${ROADMAP_CSS}</style><div class="rm">${top}
    <div class="rm-hero"><div class="rm-bg" style="background-image:url(${H.src("flat/dp_bg1")})"></div><div class="rm-shade"></div>
      <small>Roadmap · updated ${esc(upd)}</small><h2>The Road Ahead</h2>
      <p>What we're building, what's next, and what's rumoured. Nothing here has a date until it's in testing. When something ships it moves to the top, and you'll get a note in game.</p>
      <div class="rm-art">${["flat/jackthief", "flat/o_fallenstar", "flat/pet_supernova", "flat/caveman", "flat/pumpkinking"].map((k) => H.img(k)).join("")}</div>
      <button type="button" class="rm-share" data-rmshare>Copy link</button></div>
    <div class="rm-tiles"><div class="rm-tile"><b>${live.length}</b><small>just shipped</small></div><div class="rm-tile"><b>${now.length}</b><small>being built now</small></div><div class="rm-tile"><b>${next.length}</b><small>next up</small></div><div class="rm-tile"><b>${V ? Object.values(counts).reduce((a, n) => a + n, 0).toLocaleString() : "…"}</b><small>hearts given</small></div></div>
    ${live.length ? `<h3>Just shipped</h3><div class="rm-live">${live.map((c) => `<a class="rm-lv"${W[c.id].wiki ? ` data-wiki="${esc(W[c.id].wiki)}"` : ` data-rmcard="${c.id}"`}><i>LIVE</i>${H.img(W[c.id].img)}<span><b>${esc(W[c.id].title)}</b><span>${esc(W[c.id].text)}</span></span></a>`).join("")}</div>` : ""}
    <h3>On the road</h3><div class="rm-lanes">${lane("now", "Now", "being built", "#e0a020")}${lane("next", "Next", "up after that", "#3a7ad0")}${lane("later", "Later", "on the list", "#8a7a5a")}</div>
    ${rum.length ? `<h3>Rumours</h3><div class="rm-tease">${rum.map((c) => { const w = W[c.id]; return `<div class="rm-tz ${w.hue === "leaf" || w.hue === "arcane" ? w.hue : ""}"><div class="rm-bg" style="background-image:url(${H.src(w.bg)})"></div><div class="rm-glow"></div><small>${esc(w.heard || "A rumour")}</small><b>${esc(w.title)}</b><p>${esc(w.text)}</p>${H.img(w.sil).replace("<img ", '<img class="rm-sil" ')}</div>`; }).join("")}</div>` : ""}
    <h3>Tell us what you want</h3>
    <div class="rm-idea">${H.img("ui/bom_face")}<span><b>Got an idea?</b><span>Bom passes the good ones on. The best of them end up on this page.</span></span>
      <form data-rmidea><input id="rmIdea" maxlength="600" placeholder="A world event where…" aria-label="Your idea"><button type="submit">Send</button></form><p class="rm-msg" role="status" aria-live="polite"></p></div>
  </div>`;
}
/** the Weekly issue's "Coming next" strip: what is being built now, then what is next */
export function roadmapNext(G, H) {
  if (!G.ROADMAP || G.HOLD?.roadmap) return "";
  const cards = [...rmCardsIn(G, "now"), ...rmCardsIn(G, "next")].slice(0, 6);
  return cards.length ? `<style>${ROADMAP_CSS}</style><h3>Coming next</h3><div class="rm-next">${cards.map((c) => `<a data-wiki="roadmap">${H.img(ROADMAP_WORDS[c.id].img)}${H.esc(ROADMAP_WORDS[c.id].title)}</a>`).join("")}</div>` : "";
}

/* (2026-10-02, v1.2) FIELD KITS: archery's utility, the archer's answer to the mages' pages. Held with HOLD.kits.
   (2026-10-02, the owner: "start building a detailed guide on the wiki of field notes") THE FULL GUIDE. Every number, recipe, level and
   crossing below is read from the rules (FIELD_KITS, RECIPES, GRAPPLES, SNARE, BOWFISH), so it can't drift from the game. */
GUIDES.push({ id: "fieldkits", title: "Field kits (archery)", icon: "\u{1F3F9}", cat: "Going further", hold: "kits",
  body: (G, H) => {
    const rec = (k) => Object.values(G.RECIPES).find((r) => r.out[0] === k);
    const ing = (r) => (r?.in || []).map(([k, n]) => `${n} ${itemL(G, H, k)}`).join(", ");
    const made = (k) => { const r = rec(k); return r ? `Fletching ${r.lvl}: ${ing(r)}${r.out[1] > 1 ? `, makes ${r.out[1]}` : ""}` : ""; };
    const pct = (v) => Math.round(v * 100);
    const BOW = new Set(["mark", "quickdraw", "eagle", "retriever"]);
    const K = G.FIELD_KITS, line = (k, t) => `<li><b>${H.esc(K[k].name)}</b>: ${t}</li>`;
    return `<p><b>Field kits are an archer's pages.</b> A mage reads scrolls for speed, focus and travel; an archer makes kits at the <a data-wiki="guides/fletching">fletching table</a> (in the Yard, the north court) and uses them from the bag. Seven kits for a fight or a trip, plus grapple arrows, snares and fishing arrows for getting about and living off the land.</p>
    <h3>How they work</h3>
    <ul>
      <li><b>Make it, then use it.</b> Every kit is a <b>Fletching</b> recipe; using one needs an <b>Archery</b> level (both in the table). Nothing is usable until it's been made. Click it in your bag.</li>
      <li><b>One kit at a time</b>, in its own slot. A kit runs <b>alongside</b> a page buff, so an archer can have Haste and a kit together. Using a second kit replaces the first, and the message says so.</li>
      <li><b>Your Fletching sets its strength</b> when you use it: <b>tier I</b> below 70, <b>tier II</b> from 70, <b>tier III</b> from 90.</li>
      <li><b>The clock only runs outside</b>, like a page or a drink. Step into the casino and it waits.</li>
      <li><b>Four kits need a bow in your hands</b> (marked below). With a sword or a wand they do nothing, but they keep ticking.</li>
    </ul>
    <h3>Every kit</h3>
    <table class="tbl"><tr><th>Kit</th><th>Make it</th><th>Use it</th><th>Tier I</th><th>Tier II <small>(Fletching 70)</small></th><th>Tier III <small>(Fletching 90)</small></th></tr>${Object.entries(K).map(([k, F]) => `<tr><td>${itemL(G, H, "kit_" + k)}${BOW.has(k) ? "<br><small>needs a bow</small>" : ""}</td><td><small>${made("kit_" + k)}</small></td><td>Archery ${F.use}</td>${new Set(F.vals.map((v) => F.what(v))).size === 1 ? `<td colspan="3">${H.esc(F.what(F.vals[0]))}<br><small>${F.mins.join(" / ")} min (it only lasts longer)</small></td>` : [0, 1, 2].map((i) => `<td>${H.esc(F.what(F.vals[i]))}<br><small>${F.mins[i]} min</small></td>`).join("")}</tr>`).join("")}</table>
    <h3>Each kit, in a line</h3>
    <ul>
      ${line("fleet", "you walk faster, whatever you're holding. The cheapest kit and the first you can make.")}
      ${line("camo", "monsters that attack on sight leave you alone. It comes off the moment you attack anything (\"You throw off your camo and draw\"), so it's for walking through a dangerous map, or choosing your first target.")}
      ${line("mark", "use it while fighting, or with a monster in sight, and that <b>kind</b> of monster is marked (every one of them, not just that one): your bow hits them more often and harder. Bring it to a boss or a task.")}
      ${line("flare", "your minimap shows the Jackpot Thief, shooting stars, bosses and rare monsters on the map you're on. For hunting, not fighting.")}
      ${line("quickdraw", "your bow fires faster. The biggest damage kit.")}
      ${line("eagle", "your bow reaches one tile further, so you can hit from further out than a monster can answer.")}
      ${line("retriever", "some of the arrows that hit come back to your quiver. With good arrows it pays for itself.")}
    </ul>
    <h3>Grapple arrows</h3>
    <p>${itemL(G, H, "grapple_arrow")}: ${made("grapple_arrow")}. Grapple posts stand in pairs across the world. Walk to one with a <b>bow in your hands</b> and a grapple arrow in your bag: you fire, the hook bites, and you swing across. <b>One arrow a crossing.</b> They're archery's shortcuts, the way back ways are Agility's.</p>
    <table class="tbl"><tr><th>Crossing</th><th>Where</th><th>Archery</th></tr>${Object.values(G.GRAPPLES).sort((a, b) => a.lvl - b.lvl).map((g) => `<tr><td>${H.esc(g.name)}</td><td>${areaL(G, H, g.scene)}</td><td>${g.lvl}</td></tr>`).join("")}</table>
    <h3>Snares</h3>
    <p>${itemL(G, H, "snare")}: ${made("snare")}. Archery ${G.SNARE.use} to set. Use one and it goes down <b>where you're standing</b>, on any outdoor map with monsters (not in a dungeon, the Tower or on your island). Up to <b>${G.SNARE.perMap} on a map</b> and <b>${G.SNARE.max} in all</b>. Only you can see yours.</p>
    <p>Come back in <b>${Math.round(G.SNARE.ms / 60000)} minutes</b> and click it. You always get <b>feathers</b>, more on harder maps; often <b>hides</b> (6 in 10), <b>beef or chicken</b> (1 in 2) and <b>bones</b> (2 in 5), plus some Archery xp. Checking a snare uses it up. Feathers are what arrows need, so a ring of snares on your favourite map keeps an archer in arrows.</p>
    <h3>Fishing arrows</h3>
    <p>${itemL(G, H, "fishing_arrow")}: ${made("fishing_arrow")}. Archery ${G.BOWFISH.use}. With a <b>bow in your hands</b> and fishing arrows in your bag, click a fishing spot and you fish it <b>from your bow's reach</b>, with no rod. You still need the Fishing level the spot asks for. Each catch uses an arrow, <b>${pct(G.BOWFISH.double)}%</b> of catches land two fish, and you get <b>${pct(G.BOWFISH.xpShare)}%</b> of the Fishing xp again as Archery xp.</p>
    <h3>Tips</h3>
    <ul>
      <li>Your kit shows on the buff bar with its minutes left, and in the <b>Buffs</b> tab of your Character window (C).</li>
      <li>The tier comes from <b>your</b> Fletching when you use the kit, not from whoever made it.</li>
      <li>Most kits want feathers, bowstrings, small vials or sporecaps: snares and fishing arrows feed the rest.</li>
    </ul>`;
  } });
