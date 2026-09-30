/* ============================================================
   EastScape: /find — WHERE things are (2026-09-30).
   The owner: "a feature where users can type /find [x] ie find rotten tomatoes, /find ruby, /find the yard, etc. its a chat command they can use
   to tell them WHERE things are in the world, not what they are, which is what the wiki tends to do."

   Everything is read off the rules (G), so a new map, monster, rock, recipe or shop row is findable the day it ships with nobody touching this:
     - an ITEM: the rocks, trees, fishing spots and patches it comes off, the monsters that drop it (best odds first), the stations that make it
       (and where those stations stand), the shops and people that sell or trade it, the quests that give it, the marks that carry it;
     - a MONSTER: every map it lives on, how many, and the way there;
     - an AREA: its level band and the way there from where you stand, with what lives and grows in it;
     - a PERSON: where they stand and what they do; a THING (a furnace, a bank chest, an altar): every map that has one;
     - a SKILL: where to train it, rung by rung.
   The way there is a walk over the maps' own exits, doors, ladders, boats and Charon's cart, from the asker's map (the server passes it).
   Pure: createFind(G) and find(query, fromScene). The server answers with a popup; the wiki's Commands page describes it.
   ============================================================ */
export function createFind(G) {
  const SIDE = { n: "north", s: "south", e: "east", w: "west" };
  const base = (k) => String(k || "").split(":")[0];
  const nameOf = (k) => G.SCENES[k]?.name || k, inName = (k) => nameOf(k).replace(/^The /, "the ");   /* "in the Yard", not "in The Yard" */
  const an = (w) => `${/^[aeiou]/i.test(w) ? "an" : "a"} ${w}`;
  const open = () => [...G.OPEN].filter((k) => G.SCENES[k] && !G.SCENES[k].wikiHide);
  let IDX = null;

  /* ---------------------------------------------------------------- the world as a graph: exits, doors, ladders, boats, the cart */
  function graph(built) {
    const E = new Map(), add = (a, b, how) => { if (!G.SCENES[a] || !G.SCENES[b] || !G.OPEN.has(a) || !G.OPEN.has(b)) return; if (!E.has(a)) E.set(a, []); E.get(a).push({ to: b, how }); };
    for (const k of open()) {
      const d = G.SCENES[k];
      for (const [s, to] of Object.entries(d.exits || {})) add(k, to, SIDE[s] || s);
      if (d.exitTo?.scene) add(k, d.exitTo.scene, "out the door");
      for (const o of built[k]?.objs || []) {
        if (o.enter) add(k, o.enter, `through ${String(o.name || "the door").split(":")[0].replace(/^The /, "the ")}`);
        if (o.row?.to) { add(k, o.row.to, "by rowboat"); add(o.row.to, k, "by rowboat"); }
        if (o.t === "wildladder") { add(k, "wild", "down the rope ladder"); add("wild", k, "up the rope ladder"); }
        if (o.t === "cart" && G.SCENES.isle) add(k, "isle", "on Charon's cart");
      }
    }
    return E;
  }
  /** the way from one map to another, as words: "north to the Gloam, west to the Lantern Mire" */
  function route(from, to) {
    const I = idx(); from = base(from) || "workyard"; if (!I.E.has(from)) from = "workyard";
    if (from === to) return "you're here";
    const prev = new Map([[from, null]]), q = [from];
    while (q.length) { const a = q.shift(); if (a === to) break; for (const e of I.E.get(a) || []) if (!prev.has(e.to)) { prev.set(e.to, { a, how: e.how }); q.push(e.to); } }
    if (!prev.has(to)) return null;
    const steps = []; for (let k = to; prev.get(k); k = prev.get(k).a) steps.unshift(`${prev.get(k).how} to ${nameOf(k).replace(/^The /, "the ")}`);
    return steps.length > 5 ? `${steps.slice(0, 2).join(", ")}, … ${steps.length - 3} more, then ${steps.at(-1)}` : steps.join(", ");
  }
  const hops = (from, to) => { const r = route(from, to); return r == null ? 99 : r === "you're here" ? 0 : r.split(", ").length; };

  /* ---------------------------------------------------------------- the index, built once */
  function idx() {
    if (IDX) return IDX;
    const built = {}; for (const k of open()) { try { built[k] = G.buildScene(k); } catch (e) { /* a map that cannot be built is simply not searched */ } }
    const src = {}, put = (item, row) => { (src[item] ||= []).push(row); };
    const mobsIn = {}, things = {}, thingName = {}, people = {}, train = {};
    const SCENERY = new Set(["bush", "tree", "boulder", "cliff", "railH", "railV", "fenceH", "fenceV", "fencepost", "stool", "gravestone", "jack", "tuft", "plant", "palm", "barrel", "crate", "crates", "sacks", "sack", "bucket", "lamppost", "lamp", "rug", "bench", "table", "chair", "column", "skeleton", "bonepile", "haybale", "hay", "cageH", "cageV", "cagebarH", "cagebarV", "ropepost", "ropeline", "carnlitter", "cineseat", "rrseat", "moneybag", "banner", "banner2", "statue", "handcart", "cones", "sawhorse", "lumber", "trashcan", "tyres", "dumpster", "roadblock", "barricade", "sign", "milestone", "skyarch", "snag", "planter", "cooler", "soda", "snacks", "sofa", "armchair", "bed", "ashtray", "coatrack", "suitcase", "cat", "l_slips", "l_chips", "l_cards", "l_shoe", "mopbucket", "wetfloor", "smokesign", "cypress", "wagon", "knives", "meathook", "bloodpool", "skullheap", "crypttorch", "cryptcandles", "cryptrubble", "cryptpillar", "gargoyle", "trailer", "house", "obelisk", "runestone", "stormcrystal", "lava", "steam", "waterfall", "vortex", "rowboat", "dock", "fbed", "pedestal", "plot", "islesign", "ghostlantern", "ghostbrazier", "bullion", "l_slips"]);
    for (const [k, b] of Object.entries(built)) {
      const d = G.SCENES[k];
      for (const m of d.mobs || []) { const t = m[0]; ((mobsIn[t] ||= {})[k] = (mobsIn[t][k] || 0) + 1); }
      for (const n of d.npcs || []) if (!n.event || G.hwOn?.()) (people[n.name] ||= []).push({ scene: k, opens: n.opens, shop: n.shop });
      for (const o of b.objs) {
        const req = o.req?.lvl ? ` (${G.SKILLS[o.req.skill]?.name || o.req.skill} ${o.req.lvl})` : "";
        for (const [f, verb, skill] of [["ore", "Mined from", "mining"], ["fish", "Caught at", "fishing"], ["fish2", "Caught at", "fishing"], ["log", "Chopped from", "woodcutting"], ["crop", "Picked from", "farming"]]) {
          const it = o[f]; if (!it || !G.ITEMS[it]) continue;
          const what = f === "ore" ? (o.t === "vein" ? "a vein" : o.t === "sandpit" ? "a sand pit" : o.t === "wreck" ? "a wreck" : "a rock") : f.startsWith("fish") ? "a fishing spot" : f === "log" ? `${String(o.name || "a tree").split(":")[0].replace(/^(An?|The) /i, (x) => x.toLowerCase())}` : `${o.t === "olive" ? "an olive tree" : "a vine"}`;
          put(it, { kind: "node", verb, what, scene: k, req, lvl: o.req?.lvl || 1 });
          if (f === "ore") for (const [gk] of G.GEM_DROP?.[it] || []) put(gk, { kind: "gem", verb: "Found while mining", what: `${G.ITEMS[it].name.toLowerCase()}`, scene: k, req, lvl: o.req?.lvl || 1 });
          const sk = o.req?.skill || skill; ((train[sk] ||= {})[`${verb} ${what}`.toLowerCase() + `|${it}|${o.req?.lvl || 1}`] ||= { it, what, lvl: o.req?.lvl || 1, scenes: new Set() }).scenes.add(k);
        }
        if (o.t === "shroom" && o.k && G.ITEMS[o.k]) put(o.k, { kind: "node", verb: "Picked in", what: "a mushroom patch", scene: k, req: "", lvl: 1 });
        if (SCENERY.has(o.t) || o.edge) continue;
        const label = String(o.name || G.STATIONS?.[o.t]?.name || "").split(":")[0].trim(); if (!label || /^(A|An) /.test(label) && !G.STATIONS?.[o.t]) continue;
        const lk = label.toLowerCase(); thingName[lk] ||= label; (things[lk] ||= new Set()).add(k);   /* one entry per name, whatever its case: "Furnace" and the station's "furnace" are one thing */
        if (G.STATIONS?.[o.t]) { const sk = G.STATIONS[o.t].name.toLowerCase(); thingName[sk] ||= G.STATIONS[o.t].name.replace(/^./, (x) => x.toUpperCase()); (things[sk] ||= new Set()).add(k); }
      }
    }
    /* monsters' drops, best odds first; a monster that lives nowhere open is left out (a boss that spawns is added below) */
    const SPAWNS = { icewyrm: G.WYRM?.scene, raidchief: G.RAID?.scene };
    for (const [t, m] of Object.entries(G.MOBS)) {
      const where = Object.keys(mobsIn[t] || {}).concat(SPAWNS[t] && G.OPEN.has(SPAWNS[t]) ? [SPAWNS[t]] : []); if (!where.length || m.event) continue;
      for (const [k, , p] of m.drops || []) if (G.ITEMS[k] && k !== "tickets") put(k, { kind: "drop", t, p: p ?? 1, scene: where[0], all: where });
      for (const [k, p] of m.rare || []) if (G.ITEMS[k]) put(k, { kind: "drop", t, p, scene: where[0], all: where, rare: true });
      if (m.pet?.[0] && G.PETS[m.pet[0]]) put(`pet:${m.pet[0]}`, { kind: "drop", t, p: m.pet[1], scene: where[0], all: where });
    }
    /* made at a station */
    for (const r of Object.values(G.RECIPES || {})) { const out = r.out?.[0]; if (!out || !G.ITEMS[out]) continue; put(out, { kind: "made", station: r.station, skill: r.skill, lvl: r.lvl || 1 }); }
    /* sold, traded or handed over */
    for (const [k, price] of G.SHOP?.sells || []) put(k, { kind: "shop", who: "Bom's Prize Counter", scene: "casino", price });
    for (const shop of ["ranger", "mage"]) for (const r of G.outfitShelf?.(shop) || []) put(r.k, { kind: "shop", who: G.OUTFIT.npc[shop], scene: G.OUTFIT.at[shop].scene, price: r.price });
    if (G.hwOn?.()) for (const [k, n, corn] of G.HW?.market || []) put(k, { kind: "shop", who: "Hexa's Night Market", scene: "workyard", price: `${corn} candy corn` });
    for (const k of Object.keys(G.EGG_TRADES || {})) put(k, { kind: "trade", who: "Nestor the Egg Man", scene: "workyard" });
    for (const r of G.STAR_TENT?.stock || []) if (r.give) put(r.give[0], { kind: "shop", who: "the Star Tent", scene: G.STAR_TENT.scene, price: `${r.frags.toLocaleString()} Star Fragments` });
    for (const it of Object.values(G.STORE || {})) if (it.kind === "give" && it.give && !it.frags) put(it.give[0], { kind: "store", price: it.price });
    for (const [mk, m] of Object.entries(G.MARKS || {})) for (const [k] of m.drop || []) if (G.ITEMS[k]) put(k, { kind: "mark", who: m.name, scene: "guild" });
    for (const [qk, q] of Object.entries(G.QUESTS || {})) if (!q.held && !q.event) for (const [k] of q.reward?.items || []) put(k, { kind: "quest", q: q.name, who: q.giver, where: q.where });
    for (const [k, c] of Object.entries(G.CROPS || {})) if (G.ITEMS[k]) put(k, { kind: "grow", lvl: c.lvl || 1 });
    for (const [k, e] of Object.entries(G.EGGS || {})) if (e.where) put(k, { kind: "note", text: `From ${e.where}` });
    /* where the stations stand */
    const stationsAt = {}; for (const [k, b] of Object.entries(built)) for (const o of b.objs) if (G.STATIONS?.[o.t]) (stationsAt[o.t] ||= new Set()).add(k);
    /* what can be searched for */
    const C = [], add = (kind, key, name, extra = []) => { for (const n of [name, ...extra]) if (n) C.push({ kind, key, name, n: norm(n) }); };
    for (const [k, it] of Object.entries(G.ITEMS)) if (!it.held) add("item", k, it.name, [k.replace(/_/g, " ")]);
    for (const [t, m] of Object.entries(G.MOBS)) if (mobsIn[t] || SPAWNS[t]) add("mob", t, m.name);
    for (const k of open()) add("area", k, nameOf(k), [k]);
    for (const n of Object.keys(people)) add("npc", n, n, [n.split(" ")[0]]);
    for (const n of Object.keys(things)) add("thing", n, thingName[n]);
    for (const [k, s] of Object.entries(G.SKILLS)) if (!s.held) add("skill", k, s.name);
    for (const [k, p] of Object.entries(G.PETS)) if (!p.held) add("pet", k, p.name);
    IDX = { E: graph(built), src, mobsIn, things, thingName, people, train, stationsAt, C, built };
    return IDX;
  }

  /* ---------------------------------------------------------------- matching */
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[«»'’]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/^the /, "")
      .split(" ").map((w) => w.length > 3 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("oes") ? w.slice(0, -2) : w.length > 3 && /(ss|us)$/.test(w) ? w : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w).join(" ");
  }
  const RANK = { area: 0, npc: 1, mob: 2, item: 3, pet: 4, skill: 5, thing: 6 };
  function match(q) {
    const I = idx(), n = norm(q); if (!n) return [];
    const words = n.split(" ");
    const score = (c) => c.n === n ? 100 : c.n.startsWith(n) && n.length >= 3 ? 80 : words.every((w) => c.n.split(" ").includes(w)) ? 70 : n.length >= 4 && c.n.includes(n) ? 50 : 0;
    const got = new Map(); for (const c of I.C) { const s = score(c); const id = `${c.kind}:${c.key}`; if (s && (!got.has(id) || got.get(id).s < s)) got.set(id, { ...c, s }); }
    const all = [...got.values()].sort((a, b) => b.s - a.s || RANK[a.kind] - RANK[b.kind] || a.name.length - b.name.length);
    if (!all.length) return [];
    const top = all[0].s; return all.filter((c) => c.s === top).slice(0, 3);
  }
  function near(q) {   /* "did you mean": the names that share the longest start with it */
    const I = idx(), n = norm(q), pre = (a) => { let i = 0; while (i < a.length && i < n.length && a[i] === n[i]) i++; return i; };
    return [...new Set(I.C.map((c) => ({ name: c.name, p: Math.max(pre(c.n), ...c.n.split(" ").map(pre)) })).filter((x) => x.p >= 3).sort((a, b) => b.p - a.p).map((x) => x.name))].slice(0, 4);
  }

  /* ---------------------------------------------------------------- the answers */
  const bandOf = (k) => { const b = G.BANDS[k]; return b ? ` (levels ${b[0]}${b[1] < 99 ? `–${b[1]}` : "+"})` : ""; };
  const odds = (p) => p >= 1 ? "always" : p >= 0.1 ? `${Math.round(p * 100)}%` : `1 in ${Math.round(1 / p).toLocaleString()}`;
  const places = (set, from, max = 3) => { const arr = [...set].sort((a, b) => hops(from, a) - hops(from, b)); return arr.slice(0, max).map(inName).join(", ") + (arr.length > max ? ` and ${arr.length - max} more` : ""); };
  const way = (from, k) => { const r = route(from, k); return r ? (r === "you're here" ? "You're there now." : `From here: ${r}.`) : ""; };
  function itemLines(k, from) {
    const I = idx(), rows = I.src[k] || [], L = [], by = (kind) => rows.filter((r) => r.kind === kind);
    const nodes = {}; for (const r of by("node")) (nodes[`${r.verb} ${r.what}${r.req}`] ||= new Set()).add(r.scene);
    for (const [what, set] of Object.entries(nodes)) L.push(`${/^Caught/.test(what) ? "🎣" : /^Chopped/.test(what) ? "🪓" : /^Picked/.test(what) ? "🌿" : "⛏️"} ${what} in ${places(set, from)}.`);
    const gems = {}; for (const r of by("gem")) (gems[`${r.what}${r.req}`] ||= new Set()).add(r.scene);
    const near0 = (set) => Math.min(...[...set].map((k) => hops(from, k)));
    for (const [what, set] of Object.entries(gems).sort((a, b) => near0(a[1]) - near0(b[1])).slice(0, 3)) L.push(`\u{1F48E} Found now and then while mining ${what}, in ${places(set, from, 2)}.`);
    const drops = by("drop").sort((a, b) => b.p - a.p).slice(0, 4);
    for (const r of drops) L.push(`⚔️ Dropped by ${G.MOBS[r.t].name} (level ${G.MOBS[r.t].lvl}) in ${places(new Set(r.all), from, 2)}, ${odds(r.p)}.`);
    const made = by("made"); if (made.length) { const r = made.sort((a, b) => a.lvl - b.lvl)[0], st = G.STATIONS?.[r.station]; const at = I.stationsAt[r.station];
      L.push(`\u{1F528} Made at ${st ? an(st.name) : r.station} (${G.SKILLS[r.skill]?.name || r.skill} ${r.lvl})${at ? `: there's one in ${places(at, from, 2)}` : ""}.`); }
    for (const r of by("shop")) L.push(`\u{1F6D2} ${r.who} sells it, in ${inName(r.scene)}, for ${typeof r.price === "number" ? G.fmtTix(r.price) : r.price}.`);
    for (const r of by("trade")) L.push(`\u{1F95A} ${r.who} trades for it, in ${inName(r.scene)}.`);
    if (by("store").length) L.push(`\u{1F6CD}️ In the Store (the button at the top of the screen).`);
    for (const r of by("mark")) L.push(`\u{1F9E4} Lifted off the ${r.who} in the Thieves' Guild.`);
    for (const r of by("quest")) L.push(`\u{1F4DC} A reward for the quest ${r.q} (${r.who}, ${r.where}).`);
    for (const r of by("grow")) L.push(`\u{1F331} Grown on your island's plots (Farming ${r.lvl}).`);
    for (const r of by("note")) L.push(`✨ ${r.text}.`);
    return L;
  }
  function answer(c, from) {
    const I = idx();
    if (c.kind === "item") {
      const it = G.ITEMS[c.key], L = itemLines(c.key, from);
      return { title: `Where to find: ${it.name}`, icon: it.icon || "\u{1F50E}", lines: L.length ? L : ["Nothing in the world hands this one out right now: it may come from an event, the Store, or somebody else's bag (try the Exchange)."] };
    }
    if (c.kind === "mob") {
      const m = G.MOBS[c.key], at = Object.entries(I.mobsIn[c.key] || {}).sort((a, b) => hops(from, a[0]) - hops(from, b[0]));
      const L = at.slice(0, 4).map(([k, n]) => `\u{1F4CD} ${nameOf(k)}${bandOf(k)}: ${n > 1 ? `${n} of them` : "one"}. ${way(from, k)}`);
      if (c.key === "icewyrm") L.push(`❄️ It rises once a day in ${nameOf(G.WYRM.scene)}, at an hour nobody knows.`);
      if (c.key === "raidchief") L.push("❄️ He only comes to the Yard in a raid.");
      return { title: `Where to find: ${m.name} (level ${m.lvl})`, icon: "⚔️", lines: L.length ? L : ["It doesn't live anywhere you can go right now."] };
    }
    if (c.kind === "area") {
      const k = c.key, d = G.SCENES[k], mobs = Object.entries(I.mobsIn).filter(([, s]) => s[k]).map(([t]) => G.MOBS[t]?.name).filter(Boolean);
      const r = route(from, k), ppl = Object.entries(I.people).filter(([, a]) => a.some((x) => x.scene === k)).map(([n]) => n);
      const L = [r ? (r === "you're here" ? "\u{1F4CD} You're standing in it." : `\u{1F9ED} From here: ${r}.`) : "\u{1F9ED} There's no way to walk there from here."];
      if (G.BANDS[k]) L.push(`⚔️ For Combat ${G.BANDS[k][0]} and up.`);
      if (mobs.length) L.push(`\u{1F479} Lives here: ${mobs.slice(0, 6).join(", ")}${mobs.length > 6 ? "…" : ""}.`);
      if (ppl.length) L.push(`\u{1F9D1} People here: ${ppl.join(", ")}.`);
      return { title: `Where to find: ${d.name}`, icon: "\u{1F5FA}️", lines: L };
    }
    if (c.kind === "npc") {
      const at = I.people[c.key] || [], DOES = { exchange: "runs the Exchange", ferry: "rows you to the islands", permit: "sells the Thieves' Guild permit", outfit: "sells gear for your style", bank: "keeps your bank", eggtrade: "trades pet eggs", order: "posts the Yard's big order", market: "runs the Night Market", tinker: "runs the Scrap Bench", decor: "sells island decor" };
      return { title: `Where to find: ${c.key}`, icon: "\u{1F9D1}", lines: at.slice(0, 3).map((a) => `\u{1F4CD} In ${inName(a.scene)}${DOES[a.opens] ? `: ${DOES[a.opens]}` : ""}. ${way(from, a.scene)}`) };
    }
    if (c.kind === "thing") {
      const set = I.things[c.key] || new Set(), arr = [...set].sort((a, b) => hops(from, a) - hops(from, b)), r0 = arr[0] && route(from, arr[0]);
      return { title: `Where to find: ${I.thingName[c.key] || c.key}`, icon: "\u{1F4CD}", lines: [`\u{1F4CD} ${arr.length === 1 ? `In ${inName(arr[0])}` : `In ${arr.length} places: ${arr.slice(0, 5).map(inName).join(", ")}${arr.length > 5 ? "…" : ""}`}.`,
        r0 ? (r0 === "you're here" ? `\u{1F9ED} There's one right here, in ${inName(arr[0])}.` : `\u{1F9ED} The nearest is in ${inName(arr[0])}: ${r0}.`) : ""].filter(Boolean) };
    }
    if (c.kind === "skill") {
      const rows = Object.values(I.train[c.key] || {}).sort((a, b) => a.lvl - b.lvl), L = [];
      const seen = new Set(); for (const r of rows) { const key = `${r.it}`; if (seen.has(key)) continue; seen.add(key); L.push(`⭐ Level ${r.lvl}: ${G.ITEMS[r.it]?.name || r.it}, ${r.what}, in ${places(r.scenes, from, 2)}.`); if (L.length >= 10) break; }
      if (!L.length && ["melee", "archery", "magic", "hp"].includes(c.key)) for (const [k, b] of Object.entries(G.BANDS).sort((a, b) => a[1][0] - b[1][0])) if (G.OPEN.has(k)) L.push(`⚔️ Combat ${b[0]}${b[1] < 99 ? `–${b[1]}` : "+"}: ${nameOf(k)}.`);
      if (!L.length) L.push(`Everything about ${G.SKILLS[c.key].name} is in the wiki: /wiki ${G.SKILLS[c.key].name.toLowerCase()}.`);
      return { title: `Where to train: ${G.SKILLS[c.key].name}`, icon: "⭐", lines: L };
    }
    if (c.kind === "pet") {
      const p = G.PETS[c.key], L = itemLines(`pet:${c.key}`, from);
      if (p.egg) { const e = G.EGGS[p.egg]; L.push(`\u{1F95A} Hatches from a ${G.ITEMS[p.egg]?.name || p.egg}${e?.where ? `: ${e.where}` : e?.from?.length ? `, which drops in ${places(new Set(e.from.filter((k) => G.OPEN.has(k))), from, 3)}` : ""}.`); }
      if (p.base) L.push(`\u{1F9EC} Bred up from a ${G.PETS[p.base]?.name || p.base} in your island's breeding pen.`);
      return { title: `Where to find: ${p.name}`, icon: "\u{1F43E}", lines: L.length ? L : ["It's a rare drop from monsters in the Boneyard and beyond."] };
    }
    return null;
  }
  /** find(query, the asker's map): { title, icon, lines } for the best match (and "also:" for close seconds), or { none, near } */
  function find(q, from) {
    const hits = match(q);
    if (!hits.length) return { none: true, near: near(q) };
    const A = answer(hits[0], from);
    if (hits.length > 1) A.lines.push(`Also called that: ${hits.slice(1).map((h) => `${h.name} (${h.kind === "mob" ? "a monster" : h.kind === "area" ? "a place" : h.kind === "npc" ? "a person" : h.kind === "thing" ? "a thing" : `a${h.kind === "item" ? "n item" : ` ${h.kind}`}`})`).join(", ")}: /find it by its full name.`);
    return A;
  }
  return { find, route, match, norm, index: idx };
}
