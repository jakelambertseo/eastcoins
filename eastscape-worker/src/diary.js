/* ============================================================ AREA DIARIES: the server's half (2026-10-01, v1.1). Off while HOLD.diary is on.
   The tasks, their checks and the perks are DATA in eastscape-diary-rules.js (from the game plan: tools/eastscape-diary-gen.mjs); the perk
   helpers that the rest of the game reads are the DIARY section of the rules file. This file keeps the score:
     diaryNote   one diary counter up (a pocket, a lockbox, a shortcut, a visit, a lap...): the only way anything is counted that the game didn't
                 already count. Only counters some task reads are kept, so a character carries a few dozen numbers, not hundreds
     diaryEvent  from emit(): kills, gathers, PvP and dungeon clears on the map they happened on
     diaryEvAt   a world event ended on a map: everyone standing on it gets that map's event task
     diaryCheck  which tasks are newly done, which tiers newly finished: a tier's perks are copied onto the character, the 21st Elite gives the cape
     diarySweep  at login. THE FIRST ONE IS SILENT (the owner: "make sure that when diaries launch live, users arent spammed... for their already
                 completed diary entries"): everything already done is ticked off, the tiers already finished are finished, and ONE line says how
                 many. No toast, no banner, no line per task, nothing to the room
     diaryOp     the Diary tab: view (one map's progress), claim (a tier's lamp), tele (a diary teleport)
   Live, a task done is a small toast on the page (type "diary") and NO chat line; a tier finished is one chat line; only an Elite goes to the
   room. Three systems (quests, achievements, diaries) can all fire off one kill, so diaries stay the quietest of the three. */
import { DIARIES } from "../../v3/assets/js/eastscape-diary-rules.js";

const BYK = Object.fromEntries(DIARIES.map((d) => [d.k, d]));
const TASKS = DIARIES.flatMap((d) => d.t.flat().map((x) => ({ ...x, map: d.k })));
const TASK = Object.fromEntries(TASKS.map((x) => [x.id, x]));
/* every counter some task reads, and the per-map kill / gather keys: nothing else is stored */
const USED = new Set();
(function walk(list) { for (const cl of list) { const [op, ...a] = cl;
  if (op === "c") USED.add(a[0]); else if (op === "cs") a.slice(1).forEach((k) => USED.add(k)); else if (op === "km") USED.add(a[1] ? `km:${a[0]}:${a[1]}` : `km:${a[0]}`);
  else if (op === "gm") USED.add(`gm:${a[0]}:${a[1]}`); else if (op === "ks") USED.add(`ks:${a[0]}:${a[1]}`); else if (op === "any") walk(a); } })(TASKS.flatMap((x) => x.on));
const base = (k) => String(k || "").split(":")[0];

export function installDiary(World, { G, TW }) {
  const P = World.prototype;
  const live = (pl) => !G.HOLD.diary && pl?.C && !pl.bot;
  const st = (C) => (C.dia ||= { d: [], c: {}, cl: {}, p: [], tp: {}, ch: {}, at: Date.now() });

  /* ---------------------------------------------------------------- does a character meet one clause? */
  P.diaryMeets = function (C, cl) {
    const [op, ...a] = cl, S = C.stats || {}, D = C.dia || {}, cnt = (k) => D.c?.[k] | 0;
    const made = (k) => (S.gathered?.[k] | 0) + (S.cooked?.[k] | 0) + (S.crafted?.[k] | 0);
    const owns = (k) => [...(C.inv || []), ...(C.bank || [])].some((s) => s?.k === k) || Object.values(C.eq || {}).includes(k);
    switch (op) {
      case "k": return a.every((m) => (S.kills?.[m] | 0) >= 1);
      case "kn": return (S.kills?.[a[0]] | 0) >= a[1];
      case "km": return cnt(a[1] ? `km:${a[0]}:${a[1]}` : `km:${a[0]}`) >= (a[2] || 1);
      case "ks": return cnt(`ks:${a[0]}:${a[1]}`) >= 1;
      case "g": return a.every((k) => made(k) >= 1);
      case "gn": return made(a[0]) >= a[1];
      case "gm": return cnt(`gm:${a[0]}:${a[1]}`) >= (a[2] || 1);
      case "l": return (S.looted?.[a[0]] | 0) >= 1 || owns(a[0]);
      case "q": return a.every((k) => C.qs?.[k]?.state === "done");
      case "c": return this.diaryCount(C, a[0]) >= (a[1] || 1);
      case "cs": return a.slice(1).reduce((s, k) => s + this.diaryCount(C, k), 0) >= a[0];
      case "pet": return (C.pets || []).some((p) => a.includes(p.k));
      case "wear": return Object.values(C.eq || {}).includes(a[0]);
      case "work": { const S2 = G.WORKSETS[a[0]]; return !!S2 && S2.pieces.filter((k) => (C.locker || []).includes(k)).length >= a[1]; }
      case "workfull": return Object.values(G.WORKSETS).some((S2) => S2.pieces.every((k) => (C.locker || []).includes(k)));
      case "tower": return Math.max(0, C.tower?.best | 0) >= (a[0] === "top" ? TW.TOWER.floors : a[0]);
      case "stall": { const won = this.carnivalPrizes?.(C) || [], all = this.carnivalKeys?.() || []; return a[0] === "all" ? all.length > 0 && all.every((k) => won.includes(k)) : won.length > 0; }
      case "any": return a.some((x) => this.diaryMeets(C, x));
    }
    return false;
  };
  /* a counter, with what the game already kept before diaries existed folded in: laps (C.laps), lockboxes opened (C.boxes), Crypt clears */
  P.diaryCount = function (C, k) {
    const n = C.dia?.c?.[k] | 0;
    if (k.startsWith("lap:")) return Math.max(n, C.laps?.[k.slice(4)] | 0);
    if (k.startsWith("lb:")) return n || (C.boxes && Object.prototype.hasOwnProperty.call(C.boxes, k.slice(3)) ? 1 : 0);
    if (k === "crypt") return Math.max(n, C.stats?.crypt | 0);
    if (k.startsWith("v:")) return Math.max(n, (C.seen || []).includes(k.slice(2)) || base(C.scene) === k.slice(2) ? 1 : 0);   /* C.seen: every map walked onto, kept since the world map (so a visit before diaries counts) */
    return n;
  };

  /* ---------------------------------------------------------------- counting */
  P.diaryNote = function (pl, key, n = 1) {
    if (!live(pl) || !USED.has(key)) return;
    const D = st(pl.C); D.c[key] = (D.c[key] | 0) + n; this.touch(pl);
    this.diaryCheck(pl);
  };
  P.diaryEvent = function (pl, type, d) {
    if (!live(pl)) return;
    const C = pl.C, D = st(C), sc = base(C.scene), bump = (k, n = 1) => { if (USED.has(k)) { D.c[k] = (D.c[k] | 0) + n; return true; } return false; };
    switch (type) {
      case "kill": bump(`km:${sc}`); bump(`km:${sc}:${d.mob}`); if (d.style) bump(`ks:${d.mob}:${d.style}`); break;
      case "gather": case "cook": case "craft": bump(`gm:${sc}:${d.k}`, d.n || 1); break;
      case "pvpkill": {
        bump(`pvp:${sc}`); bump(`pvps:${sc}:${G.styleOf(C)}`);
        const v = this.pls.get(d.victim) || [...this.pls.values()].find((p) => p.name === d.victim);
        if (v?.C && G.combatOf(v.C) >= G.combatOf(C) + 10) bump(`f:pvpup:${sc}`);
        pl.pvpTrip = (pl.pvpTrip | 0) + 1; if (pl.pvpTrip >= 3) bump("f:pvp3");
        break;
      }
      case "death": pl.pvpTrip = 0; break;
      case "crypt": bump("crypt"); bump(`crypt:${d.tier}`); break;
      case "pyramid": bump("pyramid"); break;
      case "quest": case "loot": case "equip": break;
      default: return;
    }
    this.touch(pl);
    this.diaryCheck(pl);
  };
  /** a world event ended on this map: everyone standing on it (or inside its rooms) gets the map's event task */
  P.diaryEvAt = function (sceneKey) {
    if (G.HOLD.diary) return;
    const k = `ev:${base(sceneKey)}`; if (!USED.has(k)) return;
    for (const p of this.pls.values()) if (base(p.C?.scene) === base(sceneKey)) this.diaryNote(p, k);
  };
  /** walking onto a map (moveToScene) */
  P.diaryVisit = function (pl, sceneKey) {
    const b = base(sceneKey); if (b !== "wild" && b !== "deep") pl.pvpTrip = 0;   /* a trip ends when you leave the Wilds */
    const k = `v:${b}`; if (live(pl) && USED.has(k) && !(pl.C.dia?.c?.[k] > 0)) this.diaryNote(pl, k);
  };

  /* ---------------------------------------------------------------- what's done */
  P.diaryCheck = function (pl, quiet = false) {
    if (!live(pl)) return { tasks: [], tiers: [] };
    const C = pl.C, D = st(C), done = new Set(D.d), fresh = [];
    for (const x of TASKS) if (!done.has(x.id) && x.on.every((cl) => this.diaryMeets(C, cl))) { done.add(x.id); fresh.push(x); }
    if (!fresh.length) return { tasks: [], tiers: [] };
    D.d = [...done];
    const tiers = this.diaryTiers(pl, quiet);
    this.touch(pl);
    if (!quiet) {
      pl.out.push({ type: "diary", done: fresh.map((x) => x.id), tiers: tiers.map(([k, i]) => ({ k, i })) });
      for (const [k, i] of tiers) {
        const M = BYK[k];
        this.say(pl, `\u{1F4D6} ${M.name}: ${G.DIARY.tiers[i]} diary done. ${M.perks[i].text}. Your ${G.DIARY.lamps[i].toLocaleString()} XP lamp is waiting in the Diary (L).`, "good");
        if (i === 3) this.houseSay(`\u{1F4D6} ${pl.name} has finished the Elite diary for ${M.name}.`);
      }
    }
    this.diarySend(pl);
    return { tasks: fresh, tiers };
  };
  /* which tiers are FINISHED now that weren't (each needs the one under it): their perks go on the character; all 21 Elites is the cape */
  P.diaryTiers = function (pl, quiet) {
    const C = pl.C, D = st(C), out = [];
    D.lv ||= {};
    for (const M of DIARIES) {
      const now = G.diaryLevelOf(C, M), was = D.lv[M.k] | 0;
      for (let i = was; i < now; i++) { out.push([M.k, i]); const { text, ...fx } = M.perks[i]; D.p.push({ ...fx, map: M.k, tier: i }); }
      if (now !== was) D.lv[M.k] = now;
    }
    if (out.length && !D.cl.__tour && DIARIES.every((M) => (D.lv[M.k] | 0) >= 4)) {
      D.cl.__tour = 1;
      const k = G.DIARY.cape, where = this.give(pl, k) ? "in your bag" : this.bankAdd(pl, k, 1) ? "in your bank" : null;
      if (!where) { D.cl.__tour = 0; this.say(pl, "Every Elite diary is done, but your bag and bank are both full: make room and the Grand Tour cape comes next time anything ticks.", "bad"); }
      else { this.say(pl, `\u{1F9E3} THE GRAND TOUR. Every Elite diary in the game. The Grand Tour cape is ${where}: wear it in the new cape square, and it takes you anywhere once a day.`, "loot");
        this.houseSay(`\u{1F9E3} ${pl.name} has finished every Elite diary in EastScape and wears the Grand Tour cape: ${G.DIARY.title}.`); }
    }
    return out;
  };
  /* LOGIN. The first sweep for a character that has never had a diary is SILENT: one line, however many it finds. After that a sweep is
     catching up on something a hook missed, and a handful is announced normally; more than three is one line again. */
  P.diarySweep = function (pl) {
    if (!live(pl)) return;
    const first = !pl.C.dia;
    this.carnivalBackfill?.(pl.C);
    const { tasks, tiers } = this.diaryCheck(pl, true);
    if (!tasks.length) { if (first) this.diarySend(pl); return; }
    const maps = new Set(tiers.map(([k]) => k)).size;
    if (first || tasks.length > 3) this.say(pl, `\u{1F4D6} Area diaries are here: one for every map. ${tasks.length.toLocaleString()} task${tasks.length === 1 ? "" : "s"} you'd already done ${tasks.length === 1 ? "is" : "are"} ticked off${tiers.length ? `, and ${tiers.length} tier${tiers.length === 1 ? "" : "s"} on ${maps} map${maps === 1 ? "" : "s"} already finished, lamps waiting` : ""}. Press L.`, "good");
    else { pl.out.push({ type: "diary", done: tasks.map((x) => x.id), tiers: tiers.map(([k, i]) => ({ k, i })) }); }
  };

  /* ---------------------------------------------------------------- perks read at a kill */
  /* "drops its table 10% more often", and a boss with no chest rolling its table twice on the first kill of the day: one more pass of the
     drop table, through the ordinary give, said in one line. Not killLoot again: that would roll pets, eggs and the Long Night a second time. */
  P.diaryKillBonus = function (S, pl, m, def) {
    if (G.HOLD.diary || !pl.C.dia || !def?.drops) return;
    const C = pl.C; let rolls = 0;
    const dm = G.diaryDrop(C, m.t); if (dm && Math.random() < dm) rolls++;
    if (G.diaryChest(C, m.t)) { C.dia.ch[m.t] = G.dayKeyCT(); rolls++; this.touch(pl); }
    for (let r = 0; r < rolls; r++) {
      const extra = [];
      for (const [k, n, chance] of def.drops) {
        if (chance != null && Math.random() >= chance) continue;
        const q = Array.isArray(n) ? n[0] + Math.floor(Math.random() * (n[1] - n[0] + 1)) : n;
        if (k === "tickets") { this.tixTo(pl, q, "kills"); extra.push([k, q]); continue; }
        if (G.ITEMS[k] && this.give(pl, k, q)) { extra.push([k, q]); this.emit(pl, "loot", { k, n: q }); }
      }
      if (extra.length) this.say(pl, `Your diary: ${def.name.replace(/^The /, "the ")}'s table rolls again: ${extra.map(([k, q]) => `${q > 1 ? q.toLocaleString() + " " : ""}${k === "tickets" ? "tickets" : G.ITEMS[k].name.toLowerCase()}`).join(", ")}.`, "loot");
    }
  };
  /* the "see" perks: a forecast or a head count, only for someone who earned it, only in the tab */
  P.diarySee = function (C) {
    const out = {};
    if (G.diaryHas(C, "see", "wyrm")) { const w = this.wyrmState?.(); if (w) out.wyrm = w; }
    for (const w of ["wild", "deep"]) if (G.diaryHas(C, "see", w)) out[w] = [...this.pls.values()].filter((p) => base(p.C?.scene) === w).length;
    return out;
  };

  /* ---------------------------------------------------------------- the tab */
  P.diarySend = function (pl, extra = {}) {
    if (G.HOLD.diary || !pl.C) return;
    const D = pl.C.dia || {};
    pl.out.push({ type: "diarystate", d: D.d || [], cl: D.cl || {}, lv: D.lv || {}, tp: D.tp || {}, p: (D.p || []).map(({ t, scene }) => ({ t, scene })).filter((x) => x.t === "tele"), today: G.dayKeyCT(), ...extra });
  };
  /** one map's unfinished counting tasks, as [have, need], for the tab's progress bars */
  P.diaryProgress = function (C, k) {
    const M = BYK[k], out = {}; if (!M) return out;
    const S = C.stats || {}, made = (x) => (S.gathered?.[x] | 0) + (S.cooked?.[x] | 0) + (S.crafted?.[x] | 0);
    for (const x of M.t.flat()) {
      if ((C.dia?.d || []).includes(x.id)) continue;
      const cl = x.on.find((c) => ["kn", "gn", "km", "gm", "c", "cs"].includes(c[0]) && ((c[0] === "kn" || c[0] === "gn") ? c[2] > 1 : c[0] === "cs" ? c[1] > 1 : (c[0] === "c" ? c[2] : c[3]) > 1)); if (!cl) continue;
      const [op, ...a] = cl;
      out[x.id] = op === "kn" ? [S.kills?.[a[0]] | 0, a[1]] : op === "gn" ? [made(a[0]), a[1]] : op === "km" ? [C.dia?.c?.[a[1] ? `km:${a[0]}:${a[1]}` : `km:${a[0]}`] | 0, a[2]]
        : op === "gm" ? [C.dia?.c?.[`gm:${a[0]}:${a[1]}`] | 0, a[2]] : op === "cs" ? [a.slice(1).reduce((s, q) => s + this.diaryCount(C, q), 0), a[0]] : [this.diaryCount(C, a[0]), a[1]];
    }
    return out;
  };
  P.diaryOp = function (S, pl, m) {
    if (G.HOLD.diary) return;
    const C = pl.C, D = st(C), op = String(m.op || "view"), M = BYK[m.k];
    if (op === "view") return this.diarySend(pl, { ...(M ? { k: M.k, prog: this.diaryProgress(C, M.k) } : {}), see: this.diarySee(C) });
    if (!M) return;
    /* THE LAMP: a tier finished, a skill at or above the map's own starting level, the XP flat (no 2X, no work clothes, no gem rolls) */
    if (op === "claim") {
      const i = m.i | 0, have = D.cl[M.k] | 0;
      if (i < 0 || i > 3 || G.diaryLevelOf(C, M) <= i) return this.say(pl, "That tier isn't finished yet.", "bad");
      if (have & (1 << i)) return this.say(pl, "You've had that lamp.", "bad");
      const sk = String(m.skill || ""); if (!G.SKILLS[sk]) return;
      if (G.lvlOf(C, sk) < M.lo) return this.say(pl, `${M.name}'s lamps go on a skill at level ${M.lo} or above. Your ${G.SKILLS[sk].name} is ${G.lvlOf(C, sk)}.`, "bad");
      D.cl[M.k] = have | (1 << i); this.touch(pl);
      this.grant(pl, sk, G.DIARY.lamps[i], true, true);
      this.say(pl, `You rub the lamp: ${G.DIARY.lamps[i].toLocaleString()} ${G.SKILLS[sk].name} XP.`, "good");
      return this.diarySend(pl, { k: M.k, prog: this.diaryProgress(C, M.k) });
    }
    /* A DIARY TELEPORT: the map's own once a day, or anywhere once a day in the Grand Tour cape. Never from a fight, a dungeon run or the Wilds */
    if (op === "tele") {
      const day = G.dayKeyCT(), own = G.diaryTele(C).includes(M.k), tour = G.diaryTour(C) && Object.values(C.eq || {}).includes(G.DIARY.cape);
      const slot = own && D.tp[M.k] !== day ? M.k : tour && D.tp.__tour !== day ? "__tour" : null;
      if (!slot) return this.say(pl, own || tour ? "You've used that teleport today. It's back tomorrow." : `${M.name}'s diary doesn't teleport you there.`, "bad");
      if (pl.act?.kind === "mob" || S.def.pvp || S.run || S.def.crypt || S.def.pyramid || S.def.count || S.def.tower) return this.say(pl, "Not from here. Get somewhere quiet first.", "bad");
      const def = G.sceneDef(M.k); if (!def || G.HOLD[M.k] || (G.OPEN && !G.OPEN.has(M.k) && def.closed)) return this.say(pl, "That map isn't open.", "bad");
      D.tp[slot] = day; this.touch(pl);
      this.moveToScene(pl, M.k, null, def.entry || undefined);
      this.say(pl, `The page glows, and you're in ${M.name.replace(/^The /, "the ")}.`, "good");
      return this.diarySend(pl);
    }
  };
}
