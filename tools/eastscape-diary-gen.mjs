/* AREA DIARIES: the game's copy of the game plan's diaries (2026-10-01, v1.1).   node tools/eastscape-diary-gen.mjs
   Joins tools/diary-mock/diaries.js (the words, icons, levels and tags the game plan page shows) with tools/diary-mock/conds.mjs (what each task
   checks, what each perk does) and writes v3/assets/js/eastscape-diary-rules.js. Edit those two, never that file.
   Refuses to write if a map's counts don't match, or if any monster, item, quest, pet, set or counter it names doesn't exist in the game. */
import fs from "fs";
globalThis.__ES_OPEN_ALL = true;
const ROOT = new URL("../", import.meta.url);
const SHARED = new URL("v3/assets/js/eastscape-shared.js", ROOT);
const { DIARIES } = await import(new URL("tools/diary-mock/diaries.js", ROOT));
const { CONDS, PERKS } = await import(new URL("tools/diary-mock/conds.mjs", ROOT));
const G = await import(SHARED);
const { createClosedScenes } = await import(new URL("v3/assets/js/eastscape-closed.js", ROOT)); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));

const bad = [];
const mob = (k, where) => { if (k != null && !G.MOBS[k]) bad.push(`${where}: no monster ${k}`); };
const item = (k, where) => { if (!G.ITEMS[k]) bad.push(`${where}: no item ${k}`); };
const scene = (k, where) => { if (!G.SCENES[k]) bad.push(`${where}: no map ${k}`); };
const COUNTER = /^(v|ev|lb|scm|pkm|pvp):([a-z_0-9]+)$|^pk:([a-z_0-9]+)$|^sc:([a-z_0-9]+)$|^bw:([a-z]+)$|^lap:(rookie|pro|champ)$|^st:(climb|cannon|jump|zip)$|^talk:.+$|^buy:([a-z_]+)$|^f:(gemsort|sandbag|raidlast|pvp3|pvpup:(wild|deep))$|^crypt(:[123])?$|^pyramid$|^pvps:(wild|deep):(melee|archery|magic)$/;
function check(cl, where) {
  const [op, ...a] = cl;
  switch (op) {
    case "k": a.forEach((k) => mob(k, where)); break;
    case "kn": mob(a[0], where); break;
    case "km": scene(a[0], where); mob(a[1], where); break;
    case "ks": mob(a[0], where); if (!["melee", "archery", "magic"].includes(a[1])) bad.push(`${where}: style ${a[1]}`); break;
    case "g": a.forEach((k) => item(k, where)); break;
    case "gn": item(a[0], where); break;
    case "gm": scene(a[0], where); item(a[1], where); break;
    case "l": item(a[0], where); break;
    case "q": a.forEach((k) => { if (!G.QUESTS[k]) bad.push(`${where}: no quest ${k}`); }); break;
    case "c": { const m = COUNTER.exec(a[0]); if (!m) bad.push(`${where}: unknown counter ${a[0]}`);
      const sk = a[0].split(":"); if (["v", "ev", "lb", "pvp", "pkm"].includes(sk[0])) scene(sk[1], where); if (sk[0] === "pk") mob(sk[1], where);
      if (sk[0] === "sc" && !G.WORLD_SC[sk[1]]) bad.push(`${where}: no shortcut ${sk[1]}`); if (sk[0] === "bw" && !G.BACKWAYS[sk[1]]) bad.push(`${where}: no back way ${sk[1]}`);
      if (sk[0] === "buy") item(sk[1], where); break; }
    case "cs": a.slice(1).forEach((k) => check(["c", k], where)); break;
    case "pet": a.forEach((k) => { if (!G.PETS[k]) bad.push(`${where}: no pet ${k}`); }); break;
    case "wear": item(a[0], where); if (!G.ITEMS[a[0]]?.slot) bad.push(`${where}: ${a[0]} can't be worn`); break;
    case "work": if (!G.WORKSETS[a[0]]) bad.push(`${where}: no work set ${a[0]}`); break;
    case "workfull": case "tower": case "stall": break;
    case "any": a.forEach((x) => check(x, where)); break;
    default: bad.push(`${where}: unknown clause ${op}`);
  }
}
const lo = (band) => { const m = /^(\d+)/.exec(band); return m ? +m[1] : 1; };
const out = DIARIES.map((d) => {
  const C = CONDS[d.k], P = PERKS[d.k];
  if (!C || C.length !== 4 || C.some((t, i) => t.length !== d.t[i].length)) { bad.push(`${d.k}: conditions don't line up with the tasks`); return null; }
  if (!P || P.length !== 4) { bad.push(`${d.k}: needs four perks`); return null; }
  scene(d.k, d.k);
  return { k: d.k, name: d.name, sub: d.sub || "", band: d.band, lo: lo(d.band), em: d.em.replace(/\.png$/, ""), pvp: !!d.pvp,
    perks: P.map((p, i) => ({ text: d.perks[i], ...p })),
    t: d.t.map((list, ti) => list.map(([text, ic, req, , kind], i) => {
      const where = `${d.k}.${ti}.${i} "${text}"`, on = C[ti][i];
      on.forEach((cl) => check(cl, where));
      const ks = String(kind || "").split(" ").filter(Boolean);
      return { id: `${d.k}.${ti}.${i}`, text, ic: String(ic).startsWith("skill_") ? null : ic, sk: String(ic).startsWith("skill_") ? String(ic).slice(6) : null, req: req || null,
        ...(ks.includes("ev") ? { ev: 1 } : {}), ...(ks.includes("pvp") ? { pvp: 1 } : {}), ...(ks.includes("v11") ? { v11: 1 } : {}), on };
    })) };
}).filter(Boolean);
if (bad.length) { console.error("NOT WRITTEN:\n  " + bad.join("\n  ")); process.exit(1); }

const body = "export const DIARIES = " + JSON.stringify(out).replace(/\},\{"k":/g, '},\n  {"k":') + ";";
const OUT = new URL("v3/assets/js/eastscape-diary-rules.js", ROOT);
fs.writeFileSync(OUT, `/* THE AREA DIARIES (v1.1), WRITTEN BY tools/eastscape-diary-gen.mjs from tools/diary-mock/diaries.js and conds.mjs: edit those, not this.
   Its own file so nobody downloads 252 tasks at login: the worker imports it, the page fetches it the first time the Diary tab opens.
   The rules (HOLD.diary, the lamps, the perks a character has) are the DIARY section of eastscape-shared.js. */
${body}
`);
const n = out.reduce((a, d) => a + d.t.flat().length, 0);
console.log(`eastscape-diary-rules.js: ${out.length} maps, ${n} tasks, ${out.length * 4} perks, ${(body.length / 1024).toFixed(1)} KB`);
