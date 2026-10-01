/* The Character window, as a player would see it (2026-10-01). A MOCKUP run inside the real page on the dev server: it adds the
   Character button to the Equipment tab and a .win built only from the game's own classes and art (.win/.win-head/.win-body,
   .k-tabs, .bstrip, .k-sect, .k-row, .k-chip, .tbl, .k-btn, frame.png), and fills it with the live character's numbers through the
   same rules functions the game uses. Nothing is sent to the server. Loaded by the browser pane with:
     (0,eval)(await (await fetch('/tools/statsui-mock/inject.js?'+Date.now())).text()); await window.__charWin;
   The "new" rows (resistances, crit, block) are proposals from mockup 9 and say so. */
window.__charWin = (async () => {
  const G = await import("/v3/assets/js/eastscape-shared.js?v=424");
  const ES = window.__es, me = ES.me, $ = (id) => document.getElementById(id);
  const IC = (k) => `/v3/assets/img/glad/flat/items/${k}.png`, UI = (k) => `/v3/assets/img/glad/flat/ui/${k}.png?v=1`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const pct = (v, d = 0) => `${(v * 100).toFixed(d).replace(/\.0$/, "")}%`;
  const ITEMS = G.ITEMS, SK = G.SKILLS;

  /* ---- style: only what the page does not already have (cap bars, the resist strip's colour, the two-column body) ---- */
  if (!$("charCss")) { const st = document.createElement("style"); st.id = "charCss"; st.textContent = `
#charWin{width:min(860px,calc(100% - 28px));height:min(700px,calc(100% - 28px));z-index:90}
#charWin .win-body{display:flex;flex-direction:column;gap:8px;overflow:hidden}
.ch-top{display:grid;grid-template-columns:minmax(0,1fr) 118px minmax(0,1fr);gap:10px;align-items:stretch}
.ch-id b.nm{display:block;font:800 20px/1.1 var(--k-disp);color:var(--k-ink)}
.ch-id .k-label{display:block;margin:2px 0 6px}
.ch-sk{display:grid;grid-template-columns:22px 1fr auto;gap:6px;align-items:center;padding:3px 0;font:700 13.5px var(--k-disp);color:var(--k-ink)}.ch-sk img{width:20px;height:20px;image-rendering:pixelated}.ch-sk b{font:800 15px Lora,sans-serif}
.ch-fig{display:grid;place-items:center;align-content:center;gap:2px;border:10px solid transparent;border-image:url(${UI("frame")}) 12 fill / 10px stretch;image-rendering:pixelated;position:relative}
.ch-fig canvas,.ch-fig img{width:96px;height:120px;image-rendering:pixelated}.ch-fig .k-chip{position:absolute;top:-16px;left:50%;transform:translateX(-50%)}
.ch-vit{display:grid;grid-template-columns:1fr auto;gap:3px 10px;align-content:center;font:800 11.5px Lora,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:var(--k-ink2)}.ch-vit b{font:800 15px Lora,sans-serif;color:var(--k-ink);text-align:right;letter-spacing:0;text-transform:none}
.ch-res{display:grid;grid-template-columns:repeat(6,1fr);gap:3px;margin:0}
.ch-res span{display:grid;justify-items:center;gap:1px;padding:5px 2px 4px;border-radius:6px;background:#e6dcc4;border:1px solid #bfb193;position:relative;min-width:0;cursor:help}
.ch-res img{width:22px;height:22px;image-rendering:pixelated}.ch-res b{font-size:15px;line-height:1.15;color:#2a2016}.ch-res small{font-size:9.5px;color:#6a5a40;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ch-res i{width:48px;height:4px;border-radius:2px;background:rgba(0,0,0,.12);overflow:hidden}.ch-res i::after{content:"";display:block;height:100%;width:var(--f,0%);background:var(--c,#6a5a40)}
.ch-res .k-chip{position:absolute;top:-8px;right:2px;padding:0 5px;font-size:9.5px}
.ch-main{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:10px;min-height:0;flex:1;overflow:auto;align-items:start}
.ch-rows{display:grid;gap:3px;align-content:start}
.ch-row{display:grid;grid-template-columns:1fr auto 64px;gap:8px;align-items:center;padding:5px 9px;border:0;border-radius:6px;background:rgba(0,0,0,.06);font:600 13px Lora,sans-serif;color:var(--k-ink);text-align:left;cursor:pointer;width:100%}
.ch-row:hover{background:rgba(0,0,0,.1)}.ch-row[aria-pressed="true"]{background:var(--k-paper-hi);box-shadow:inset 0 0 0 2px var(--k-gold)}
.ch-row b{font:800 13.5px Lora,sans-serif;text-align:right;font-variant-numeric:tabular-nums}
.ch-row .cap{height:6px;border-radius:3px;background:rgba(0,0,0,.12);overflow:hidden}.ch-row .cap::after{content:"";display:block;height:100%;width:var(--f,0%);background:var(--k-gold)}.ch-row .cap.full::after{background:var(--k-good)}.ch-row .cap.none{background:none}
.ch-row.new span::after{content:"new";margin-left:6px;font:800 9.5px Lora,sans-serif;padding:1px 5px;border-radius:99px;background:#e4d6f5;color:var(--k-rare);vertical-align:1px}
.ch-det{align-self:start;display:grid;gap:6px}
.ch-det h4{margin:0}.ch-det p{margin:0;font:600 12.5px/1.45 Lora,sans-serif;color:var(--k-ink2)}
.ch-src{display:grid;gap:3px}.ch-src div{display:grid;grid-template-columns:20px 1fr auto;gap:7px;align-items:center;padding:4px 7px;border-radius:6px;background:var(--k-card);box-shadow:inset 0 0 0 1.5px var(--k-card-line);font:600 12.5px Lora,sans-serif;color:var(--k-ink)}
.ch-src img{width:18px;height:18px;image-rendering:pixelated}.ch-src b{font-weight:800}.ch-src div.more{background:#e3f1d6;box-shadow:inset 0 0 0 1.5px #9fcf8c}
.ch-capbar{height:10px;border-radius:5px;background:rgba(0,0,0,.12);overflow:hidden}.ch-capbar::after{content:"";display:block;height:100%;width:var(--f,0%);background:linear-gradient(90deg,#c8963a,#e8c070)}
.ch-foot{flex:none;display:flex;justify-content:space-between;align-items:center;font:700 12px Lora,sans-serif;color:var(--k-ink2);padding-top:4px;border-top:2px solid var(--k-line)}
#charWin .k-tabs{margin:0 -12px;padding-left:12px}
.ms-entry.ch-entry{padding:2px 8px 6px}`; document.head.append(st); }

  /* ---- the numbers, from the rules file on the live character ---- */
  const b = G.bonusOf(me), sb = G.styleBonusOf(me), style = G.styleOf(me), styleLvl = G.styleLvlOf(me), fx = G.fxOf(me), cap = G.OUT_CAP, pet = G.petFx(me), gems = G.gemBonus(me);
  const atk = G.attackRollOf(me), def = G.defenceRollOf(me), maxHit = G.maxHitOf(me), swing = G.swingMsOf(me), hp = G.maxHpOf(me), step = G.stepMsOf(me), speedUp = G.STEP_MS / step - 1;
  const focus = G.charmOf(me, "focus"), ward = G.wardOf(me), combat = G.combatOf(me), total = G.totalOf(me), tkD = G.tkDmg(me, style), tkA = G.tkAcc(me, style);
  const weapon = me.eq.weapon && ITEMS[me.eq.weapon], tool = weapon && weapon.tool;
  const worn = G.SLOTS.filter((s) => s !== "pet" && me.eq[s] && ITEMS[me.eq[s]]).map((s) => ({ k: me.eq[s], it: ITEMS[me.eq[s]], acc: G.statOf(me, me.eq[s], "acc"), str: G.statOf(me, me.eq[s], "str"), def: G.statOf(me, me.eq[s], "def") }));
  const sceneBase = String(me.scene || "").split(":")[0], band = G.BANDS[sceneBase] || [1, 9];
  const near = Object.entries(G.MOBS).filter(([k, m]) => !m.boss && !m.event && !m.raid && !m.bag && m.lvl >= band[0] && m.lvl <= band[1] + 30 && G.resistsOf(k)).sort((a, b2) => a[1].lvl - b2[1].lvl);
  const picks = [near[0], near[Math.floor(near.length / 2)], near[near.length - 1]].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
  const S = (k) => `<img src="${IC("skill_" + k)}" alt="">`;
  const petOn = G.activePet(me);

  const rowsOf = {
    Damage: [
      ["Style", SK[style].name, null, { p: `Taken from what is in your hand: ${weapon ? weapon.name : "nothing"}. ${tool ? `A tool trains ${SK[tool].name}; in a fight you'd swing it as Melee.` : ""}`, src: weapon ? [[IC(me.eq.weapon), weapon.name, SK[style].name]] : [], more: [] }],
      ["Accuracy from gear", `+${sb.acc}`, null, { p: "Added up across everything worn. With a bow or a wand, only the weapon and the quiver or bag count.", src: worn.filter((w) => w.acc).map((w) => [IC(w.k), w.it.name, `+${w.acc}`]), more: [[IC("singularity_gladius"), "Singularity gladius (Melee 90)", "+52"]] }],
      ["Strength from gear", `+${sb.str}`, null, { p: "Every 2 points of gear strength is +1 max hit.", src: worn.filter((w) => w.str).map((w) => [IC(w.k), w.it.name, `+${w.str}`]), more: [[IC("singularity_maul"), "Singularity maul (Melee 90)", "+53"]] }],
      ["Attack roll", atk.toFixed(1), null, { p: `${SK[style].name} ${styleLvl} + 1 + gear accuracy${focus ? `, then +${focus}% from Focus` : ""}${tkA ? `, then +${pct(tkA)} from jade and gadgets` : ""}. Against a monster's defence it decides how often you land.`, src: [[IC("skill_" + style), `${SK[style].name} ${styleLvl} + 1`, String(styleLvl + 1)], ...(sb.acc ? [[IC(me.eq.weapon || "skill_attack"), "Gear accuracy", `+${sb.acc}`]] : []), ...(focus ? [[IC("scroll_focus"), "Focus charm", `×${(1 + focus / 100).toFixed(2)}`]] : []), ...(gems.jade ? [[IC("jade"), "Jade", `+${gems.jade}%`]] : [])], more: gems.jade ? [] : [[IC("jade"), "A jade in the gem bag", "up to +10%"]] }],
      ["Max hit", String(maxHit), null, { p: `1 + ${SK[style].name} level ÷ 6 + gear strength ÷ 2${focus ? ", then Focus" : ""}${tkD ? `, then +${pct(tkD)} damage bonus` : ""}.`, src: [[IC("skill_" + style), `1 + ${styleLvl} ÷ 6`, String(1 + Math.floor(styleLvl / 6))], [IC(me.eq.weapon || "skill_strength"), `${sb.str} strength ÷ 2`, String(Math.floor(sb.str / 2))], ...(gems.ruby ? [[IC("ruby"), "Rubies", `+${gems.ruby}%`]] : [])], more: gems.ruby ? [[IC("ruby"), "Re-roll a ruby (best is +10)", "up to +20%"]] : [[IC("ruby"), "A ruby in the gem bag", "up to +20%"]] }],
      ["Swing time", `${(swing / 1000).toFixed(2)} s`, null, { p: `The weapon's own speed (${((weapon?.speed || G.SWING_MS) / 1000).toFixed(1)} s) made faster by work speed, +${pct(G.swingFx(me), 1)} (cap ${pct(cap.speed)}).`, src: [...(weapon ? [[IC(me.eq.weapon), weapon.name, `${((weapon.speed || G.SWING_MS) / 1000).toFixed(1)} s`]] : []), ...worn.filter((w) => w.it.fx?.speed).map((w) => [IC(w.k), w.it.name, `+${pct(w.it.fx.speed)}`]), ...(pet.swing ? [["/v3/assets/img/glad/flat/" + G.PETS[petOn.k].art + ".png", G.petLabel(petOn), `+${pet.swing}%`]] : [])], more: [["/v3/assets/img/glad/flat/pet_coilling.png", "The Coilling", "+10%"]] }],
      ["Damage bonus", `+${pct(tkD, 1)}`, null, { p: `Everything that makes ${SK[style].name} hits bigger: rubies for Melee, jasper for arrows, amethyst for spells, Tinkering gadgets, outfits.`, src: gems.ruby && style === "melee" ? [[IC("ruby"), "Rubies", `+${gems.ruby}%`]] : [], more: [[IC("tk_banner"), "A Whetstone gadget", "+5%"]] }],
      ["Arrow damage", `+${pct(fx.adm)}`, fx.adm / cap.adm, { p: "Only with a bow: Skyripper, Hunter's Fang, the Raptor ring, a draught.", src: [], more: [[IC("skyripper"), "Skyripper", "+6%"], [IC("hunters_fang"), "Hunter's Fang", "+8%"]], cap: `${pct(cap.adm)} cap` }],
      ["Spell damage", `+${pct(fx.mdm)}`, fx.mdm / cap.mdm, { p: "Only with a wand: the Frost Giants' jewellery, the Rimeheart, a Frostmind draught.", src: [], more: [[IC("winters_heart"), "Winter's Heart", "+8%"], [IC("rimeheart"), "Rimeheart", "+6%"]], cap: `${pct(cap.mdm)} cap` }],
      ["Execute", `${pct(fx.execute)}`, fx.execute / cap.execute, { p: "A monster under this much health dies to your next hit. Never a boss.", src: [], more: [[IC("reaper_scythe"), "The Reaper's scythe", "+10%"]], cap: `${pct(cap.execute)} cap` }],
      ...picks.map(([k, m]) => [`Hit chance: ${m.name} (${m.lvl})`, pct(G.hitChance(atk, m.def)), G.hitChance(atk, m.def) / 0.95, { p: `Your attack roll (${atk.toFixed(0)}) against its defence (${m.def}). 95% is the most anyone lands.`, src: [], more: [], cap: "95% cap" }]),
      ["Critical chance", "5%", 0.1, { p: "Proposed (mockup 9). A hit that crits does ×1.5. Everyone has 5%; more comes from the Duelist and Deadeye paths and masterwork weapons.", src: [[IC("skill_melee"), "Everyone", "5%"]], more: [[IC("skill_strength"), "Duelist: Precise Cuts", "+8%"], [IC("nova_sword"), "A masterwork weapon", "+3%"]], cap: "50% cap" }, true]],
    Defence: [
      ["Defence from gear", `+${b.def}`, null, { p: "Every worn piece, whatever is in your hand.", src: worn.filter((w) => w.def).map((w) => [IC(w.k), w.it.name, `+${w.def}`]), more: [[IC("singularity_body"), "Singularity cuirass (Melee 90)", "+5 over Nova"]] }],
      ["Defence roll", def.toFixed(1), null, { p: `(${SK[style].name} ${styleLvl} + gear defence ${b.def}) ÷ 2. Against a monster's attack it decides how often you're hit.`, src: [[IC("skill_" + style), `${SK[style].name} ${styleLvl}`, String(styleLvl)], [IC(me.eq.body || "skill_defence"), "Gear defence", `+${b.def}`]], more: [] }],
      ...picks.map(([k, m]) => [`Hit by: ${m.name} (${m.lvl})`, pct(G.hitChance(m.att, def)), null, { p: `Its attack (${m.att}) against your defence roll (${def.toFixed(0)}). It hits for up to ${m.max}.${G.hitChance(m.att, def) >= 0.95 ? " 95% is the most a monster lands, and it's there: more armour would change nothing against this one." : ""}`, src: [], more: [] }]),
      ["Damage taken", `−${pct(fx.tough)}`, fx.tough / cap.tough, { p: "Less damage from every hit: pets, hematite, some gear.", src: [...worn.filter((w) => w.it.fx?.tough).map((w) => [IC(w.k), w.it.name, `−${pct(w.it.fx.tough)}`]), ...(pet.tough ? [["/v3/assets/img/glad/flat/" + G.PETS[petOn.k].art + ".png", G.petLabel(petOn), `−${pet.tough}%`]] : []), ...(gems.hematite ? [[IC("hematite"), "Hematite", `−${gems.hematite}%`]] : [])], more: [[IC("hematite"), "Hematite in the gem bag", "up to −20%"], ["/v3/assets/img/glad/flat/pet_mossback.png", "A Mossback Tortoise", "−10%"]], cap: `${pct(cap.tough)} cap` }],
      ["Health", String(hp), null, { p: `Hitpoints ${G.lvlOf(me, "hp")}${pet.hp ? ` + ${pet.hp} from your pet` : ""}.`, src: [[IC("skill_hp"), `Hitpoints ${G.lvlOf(me, "hp")}`, String(G.lvlOf(me, "hp"))]], more: [["/v3/assets/img/glad/flat/pet_lanternmoth.png", "A Lantern Moth", "+15"]] }],
      ["Life leech", `+${pct(fx.leech)}`, fx.leech / cap.leech, { p: "That share of the damage you deal comes back as health.", src: [], more: [[IC("skill_hp"), "The Long Night's pieces", "up to +25%"]], cap: `${pct(cap.leech)} cap` }],
      ["Food heals", `+${pct(fx.heal)}`, fx.heal / cap.heal, { p: "Food heals this much more. Bloodstone in the gem bag.", src: [], more: [[IC("bloodstone"), "Bloodstone", "up to +20%"]], cap: `${pct(cap.heal)} cap` }],
      ["Frost ward", ward ? "worn" : "none", null, { p: "In the Frozen Reach, anyone without a ward loses 25 health a second. With resistances it becomes Frost resistance 75%.", src: worn.filter((w) => w.it.ward === "frost").map((w) => [IC(w.k), w.it.name, "ward"]), more: ward ? [] : [[IC("frostcharm"), "A Frost charm from Wren", "ward"]] }],
      ["Block chance", "0%", 0, { p: "Proposed (mockup 9). With a shield in Melee, a blocked hit does 70% less: 1% for every 4 points of shield defence, more from the Juggernaut.", src: [], more: [[IC(me.eq.shield || "nova_shield"), me.eq.shield ? ITEMS[me.eq.shield].name : "A shield", `${Math.floor((me.eq.shield ? G.statOf(me, me.eq.shield, "def") : 30) / 4)}%`]], cap: "40% cap" }, true]],
    Skilling: [
      ["Work speed", `+${pct(fx.speed, 1)}`, fx.speed / cap.speed, { p: "Swings, chops, mining and fishing, all faster.", src: worn.filter((w) => w.it.fx?.speed).map((w) => [IC(w.k), w.it.name, `+${pct(w.it.fx.speed)}`]), more: [["/v3/assets/img/glad/flat/pet_coilling.png", "The Coilling", "+10%"]], cap: `${pct(cap.speed)} cap` }],
      ["Walking speed", `+${Math.round(speedUp * 100)}%`, speedUp / (G.SPEED_CAP / 100), { p: `Agility ${G.lvlOf(me, "agility")}${pet.speed ? ` and your pet (+${pet.speed}%)` : ""}. A step takes ${step} ms instead of ${G.STEP_MS}.`, src: [[IC("skill_agility"), `Agility ${G.lvlOf(me, "agility")}`, ""], ...(pet.speed ? [["/v3/assets/img/glad/flat/" + G.PETS[petOn.k].art + ".png", G.petLabel(petOn), `+${pet.speed}%`]] : [])], more: [["/v3/assets/img/glad/flat/pet_bonepup.png", "A Bonepup", "+8%"]], cap: `${G.SPEED_CAP}% cap` }],
      ["Double gathers", `${pct(fx.double)}`, fx.double / cap.double, { p: "That share of what you mine, cut or catch comes up twice.", src: [], more: [[IC("skill_mining"), "The Long Night's pieces", "up to +30%"]], cap: `${pct(cap.double)} cap` }],
      ["Gem finds", `+${pct(fx.gem)}`, fx.gem / cap.gem, { p: "Jewels turn up in the rock more often.", src: worn.filter((w) => w.it.fx?.gem).map((w) => [IC(w.k), w.it.name, `+${pct(w.it.fx.gem)}`]), more: [[IC("deepheart"), "Deepheart", "+100%"]], cap: `${pct(cap.gem)} cap` }],
      ...["opal", "sapphire", "topaz"].map((g) => [`${{ opal: "Mining", sapphire: "Fishing", topaz: "Chopping" }[g]} speed (${g})`, `+${gems[g] || 0}%`, null, { p: "Skilling gems in the case side of your gem bag; the best two of each kind count.", src: gems[g] ? [[IC(g), g[0].toUpperCase() + g.slice(1), `+${gems[g]}%`]] : [], more: [[IC(g), `A ${g} from the Gem Sorter`, "up to +20%"]] }]),
      ["Fish bite", `+${pct(fx.bite)}`, fx.bite / cap.bite, { p: "Fish bite more often.", src: [], more: [["/v3/assets/img/glad/flat/pet_stormling.png", "A Stormling", "+10%"]], cap: `${pct(cap.bite)} cap` }],
      ["Free smelts", `${pct(fx.smelt)}`, fx.smelt / cap.smelt, { p: "That share of smelts cost no ore.", src: [], more: [[IC("bessemergloves"), "Bessemer's Gauntlets", "+15%"]], cap: `${pct(cap.smelt)} cap` }],
      ["Reforge success", `+${pct(fx.forge)}`, fx.forge / cap.forge, { p: "Reforges at the anvil land more often.", src: [], more: [[IC("bessemergloves"), "Bessemer's Gauntlets", "+10%"]], cap: `${pct(cap.forge)} cap` }],
      ["Pickpocket success", `+${pct(fx.steal)}`, fx.steal / cap.steal, { p: "Thieving succeeds more often.", src: [], more: [["/v3/assets/img/glad/flat/pet_ferret.png", "A Fortune Ferret", "+10%"]], cap: `${pct(cap.steal)} cap` }]],
    Loot: [
      ["Tickets from kills", `+${pct(fx.tix + pet.tix / 100)}`, (fx.tix + pet.tix / 100) / cap.tix, { p: "More tickets from every kill.", src: [...(pet.tix ? [["/v3/assets/img/glad/flat/" + G.PETS[petOn.k].art + ".png", G.petLabel(petOn), `+${pet.tix}%`]] : []), ...worn.filter((w) => w.it.fx?.tix).map((w) => [IC(w.k), w.it.name, `+${pct(w.it.fx.tix)}`])], more: [["/v3/assets/img/glad/flat/pet_goldentoad.png", "The Golden Toad", "+25%"]], cap: `${pct(cap.tix)} cap` }],
      ["Rare drops", `+${pct(fx.rare)}`, fx.rare / cap.rare, { p: "Rare drops come up more often.", src: [], more: [[IC("scroll_keeneye"), "Keen Eye charm", "+10%"]], cap: `${pct(cap.rare)} cap` }],
      ["Real ZCoin drops", `+${pct(fx.zdrop)}`, fx.zdrop / cap.zdrop, { p: "A real ZCoin is more likely to drop. Clovers, one per kill.", src: (me.luck | 0) > 0 ? [[IC("clover"), `${me.luck} clovers`, `+${pct(G.LUCK.zdrop)}`]] : [], more: [[IC("clover"), "A clover, from fishing", `+${pct(G.LUCK.zdrop)}`]], cap: `${pct(cap.zdrop)} cap` }],
      ["Ammo saved", `${pct(fx.ammo)}`, fx.ammo / cap.ammo, { p: "Shots and casts that spend no arrow or page.", src: [], more: [[IC("skill_archery"), "The Long Night's pieces", "up to +50%"]], cap: `${pct(cap.ammo)} cap` }],
      ["Total level", total.toLocaleString(), null, { p: "Every skill added up.", src: [], more: [] }]],
    Buffs: [
      ...(petOn ? [[`Pet: ${G.petLabel(petOn)}`, G.petFxText(petOn.fx || G.PETS[petOn.k].fx), null, { p: "The pet at your heel. Pets that grow (mockup 7) would add its level and traits here.", src: [["/v3/assets/img/glad/flat/" + G.PETS[petOn.k].art + ".png", G.PETS[petOn.k].name, G.RANKS[G.rankOf(petOn)].name]], more: [] }]] : [["Pet", "none", null, { p: "Nothing at your heel.", src: [], more: [] }]]),
      ["Gem bag", `${Object.values(gems).length} kinds`, null, { p: "Only the best two of each kind count.", src: Object.entries(G.gemRolls(me)).map(([k, r]) => [IC(k), k[0].toUpperCase() + k.slice(1), r.slice(0, 2).map((x) => (x >= 0 ? "+" : "") + x).join(" / ")]), more: [[IC("hematite"), "Hematite", "less damage taken"]] }],
      ...G.buffsOf(me).map((bf) => [bf.name, bf.left == null ? "worn" : `${bf.left} ${bf.unit}`, null, { p: bf.ex, src: [[IC(bf.icon), bf.name, ""]], more: [] }]),
      ["Meal", me.meal && (me.meal.left | 0) > 0 ? ITEMS[me.meal.k].name : "none", null, { p: "A meal's effect lasts while you're outside.", src: [], more: [[IC("cstormmarlin"), "Storm marlin", "a meal"]] }],
      ["Drink", me.drink && (me.drink.left | 0) > 0 ? ITEMS[me.drink.k].name : "none", null, { p: "A draught's effect lasts while you're outside.", src: [], more: [[IC("pot_frost"), "Frostmind draught", "+6% spells"]] }]] };

  /* ---- the window ---- */
  let win = $("charWin");
  if (!win) { win = document.createElement("section"); win.className = "win k-win"; win.id = "charWin"; win.setAttribute("aria-label", "Character"); win.hidden = true; $("msWin").after(win); }
  let tab = "Damage", sel = 0;
  const RES = [["Armour", UI("equip"), "#6a5a40", `${b.def}`, `roll ${def.toFixed(0)}`, null, "Every worn piece's defence, and the roll it makes."], ["Fire", IC("page_fire_bolt"), "#d8602a", "0%", "nothing yet", 0, "Proposed: cuts fire damage, like the Underforge's heat. Element gems in armour sockets, wards, Relic sets."], ["Frost", IC("page_frost_bolt"), "#3a8ad8", ward ? "75%" : "0%", ward ? "your ward" : "no ward", ward ? 1 : 0, "Proposed: the Frozen Reach's cold, cut by this. A ward is 75%, the cap."], ["Storm", IC("page_storm_bolt"), "#c8a020", "0%", "nothing yet", 0, "Proposed: the Deep End."], ["Sun", IC("page_sun_bolt"), "#d8a020", "0%", "nothing yet", 0, "Proposed."], ["Void", IC("page_void_bolt"), "#7a4ab8", "0%", "nothing yet", 0, "Proposed: the Star Archive."]];
  function paint() {
    const rows = rowsOf[tab]; if (sel >= rows.length) sel = 0; const cur = rows[sel], d = cur[3];
    const fig = $("dollFig"); const figImg = fig ? `<img src="${fig.toDataURL()}" alt="">` : `<img src="/v3/assets/img/glad/flat/hero_bronze_south.png" alt="">`;
    win.innerHTML = `<div class="win-head"><b><img src="${UI("skills")}" alt="" class="topi">Character</b><small>every number the game uses about you, and where to get more</small><button type="button" class="win-x" data-close="charWin" aria-label="Close">×</button></div>
    <div class="win-body">
      <div class="ch-top">
        <div class="ch-id"><b class="nm">${esc(me.name || ES.you?.name || "You")}</b><span class="k-label">${SK[style].name} · combat ${combat} · no Ascendancy yet</span>
          ${["melee", "archery", "magic", "hp"].map((k) => `<div class="ch-sk">${S(k)}<span>${SK[k].name}</span><b>${G.lvlOf(me, k)}</b></div>`).join("")}
          <div class="ch-sk" style="color:var(--k-ink2)"><span></span><span>Total level</span><b>${total.toLocaleString()}</b></div></div>
        <div class="ch-fig"><span class="k-chip gold">Combat ${combat}</span>${figImg}<small class="k-note">${weapon ? esc(weapon.name) : "Unarmed"}</small></div>
        <div class="ch-vit"><span>Health</span><b>${hp}</b><span>Max hit</span><b>${maxHit}</b><span>Swing</span><b>${(swing / 1000).toFixed(2)} s</b><span>Attack roll</span><b>${atk.toFixed(0)}</b><span>Defence roll</span><b>${def.toFixed(0)}</b><span>Walking</span><b>+${Math.round(speedUp * 100)}%</b></div>
      </div>
      <div class="k-sect"><span class="k-label">Armour and resistances</span></div>
      <div class="ch-res">${RES.map(([n, ic, c, v, s, f, tip]) => `<span title="${esc(tip)}" style="--c:${c};--f:${f == null ? 0 : f * 100}%"><img src="${ic}" alt=""><b>${v}</b><small>${n} · ${s}</small>${f == null ? "" : `<i></i><span class="k-chip rare" style="position:absolute">new</span>`}</span>`).join("")}</div>
      <div class="k-tabs" role="tablist">${Object.keys(rowsOf).map((t) => `<button type="button" role="tab" data-t="${t}" aria-selected="${t === tab}">${t === "Loot" ? "Loot and luck" : t}</button>`).join("")}</div>
      <div class="ch-main">
        <div class="ch-rows">${rows.map(([l, v, f, , nw], i) => `<button type="button" class="ch-row${nw ? " new" : ""}" data-i="${i}" aria-pressed="${i === sel}"><span>${esc(l)}</span><b>${esc(v)}</b><span class="cap ${f == null ? "none" : f >= 0.999 ? "full" : ""}" style="--f:${f == null ? 0 : Math.min(100, f * 100)}%"></span></button>`).join("")}</div>
        <div class="ch-det"><h4>${esc(cur[0])} <span style="float:right">${esc(cur[1])}</span></h4><p>${esc(d.p)}</p>
          ${cur[2] != null && d.cap ? `<div style="display:flex;justify-content:space-between" class="k-note"><span>${esc(cur[1])}</span><span>${esc(d.cap)}</span></div><div class="ch-capbar" style="--f:${Math.min(100, cur[2] * 100)}%"></div>` : ""}
          ${d.src.length ? `<span class="k-label">Where it comes from</span><div class="ch-src">${d.src.map(([i, n, v]) => `<div><img src="${i}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(n)}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
          ${d.more.length ? `<span class="k-label" style="color:var(--k-good)">Where to get more</span><div class="ch-src">${d.more.map(([i, n, v]) => `<div class="more"><img src="${i}" alt="" onerror="this.style.visibility='hidden'"><span>${esc(n)}</span><b>${esc(v)}</b></div>`).join("")}</div>` : ""}</div>
      </div>
      <div class="ch-foot"><span>Click a stat for where it comes from. Hover an item in your bag to see what it would change.</span><span class="k-chip gold">${Object.values(rowsOf).flat().filter((r) => r[2] != null && r[2] >= 0.999).length} caps maxed</span></div>
    </div>`;
    win.querySelectorAll(".k-tabs button").forEach((t) => t.onclick = () => { tab = t.dataset.t; sel = 0; paint(); });
    win.querySelectorAll(".ch-row").forEach((r) => r.onclick = () => { sel = +r.dataset.i; paint(); });
    win.querySelector(".win-x").onclick = () => { win.hidden = true; };
  }
  window.__charOpen = () => { paint(); win.hidden = false; };

  /* ---- the button, in the Equipment tab under the combat strip ---- */
  const place = () => { const p = $("panel"); if (!p || p.dataset.tab !== "equip" || p.querySelector("[data-charstats]")) return; const anchor = p.querySelector(".bwield"); if (!anchor) return;
    const d = document.createElement("div"); d.className = "ms-entry ch-entry"; d.innerHTML = `<button type="button" class="k-btn sm" data-charstats><img src="${UI("skills")}" alt="">Character</button><span class="k-note">every number, and where to get more</span>`;
    anchor.after(d); d.querySelector("button").onclick = () => window.__charOpen(); };
  place(); new MutationObserver(place).observe($("panel"), { childList: true });
  return "ok";
})();
