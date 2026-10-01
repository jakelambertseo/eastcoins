/* What each map really has, for the area diaries (mockup 6, second pass: one diary per map) —  node tools/diary-mock/scan.mjs
   Reads the rules the way the game does (v1.1 switched on, so Thrill Hill, the nooks and the lockboxes are there) and writes maps.json:
   per map its level band, monsters (bosses apart), what can be gathered and at what level, the quests given there, its shortcut and
   lockbox, and which world events can happen on it. The page's diaries are written from this, so a task is always something real. */
import fs from "fs";
globalThis.__ES_OPEN_ALL = true;
const G = await import("../../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const MAPS = ["workyard", "gloam", "mire", "boneyard", "cloud", "sands", "thunderhead", "carnival", "boardwalk", "trailer", "vault", "depths",
  "valley", "valley_ridge", "valley_lair", "frozen", "frostspire", "wild", "deep", "thrill", "thrill_top"];
const out = {};
for (const key of MAPS) {
  const def = G.SCENES[key]; if (!def) { console.log("no scene", key); continue; }
  let b; try { b = G.buildScene(key); } catch (e) { console.log("build failed", key, e.message); continue; }
  const mobs = {}; for (const [t] of def.mobs || []) { const m = G.MOBS[t]; if (m) mobs[t] = { name: m.name, lvl: m.lvl, boss: !!m.boss, n: (mobs[t]?.n || 0) + 1 }; }
  const gather = {};
  for (const o of b.objs) {
    const r = o.req, k = o.log || o.ore || o.fish; if (!r || !k || o.edge) continue;
    const id = `${r.skill}:${k}`; gather[id] ||= { skill: r.skill, item: k, name: G.ITEMS[k]?.name || k, lvl: r.lvl, ledge: !!o.ledge };
  }
  for (const o of b.objs) if (o.t === "spot" && o.fish && !o.req) { const id = `fishing:${o.fish}`; gather[id] ||= { skill: "fishing", item: o.fish, name: G.ITEMS[o.fish]?.name || o.fish, lvl: 1 }; }
  const quests = []; for (const n of def.npcs || []) for (const q of n.quests || []) if (G.QUESTS[q]) quests.push({ k: q, name: G.QUESTS[q].name, tier: G.QUESTS[q].tier, giver: n.name });
  const sc = Object.entries(G.WORLD_SC || {}).filter(([id, s]) => (s.scene || id) === key).map(([, s]) => ({ name: s.name, lvl: s.lvl, ledge: s.ledge?.obj?.name || null }));
  const lb = G.LOCKBOXES?.[key];
  const bw = Object.values(G.BACKWAYS || {}).filter((w) => w.ends.some((e) => e.scene === key)).map((w) => ({ name: w.name, lvl: w.lvl }));
  const stunts = b.objs.filter((o) => o.t === "stunt").map((o) => ({ name: o.name, crs: o.crs, lvl: G.stuntLvl(o) }));
  out[key] = { name: def.name, band: G.BANDS?.[key] || null, mobs, gather: Object.values(gather).sort((a, c) => a.lvl - c.lvl), quests, shortcuts: sc, lockbox: lb ? lb[2] : null, backways: bw, stunts: stunts.length,
    npcs: (def.npcs || []).map((n) => n.name), pvp: !!def.pvp };
}
/* the world events, and where each can happen */
out._events = {
  star: Object.keys(G.SSTAR?.scenes || G.STAR?.scenes || {}), wanted: Object.keys(G.WANTED?.targets || {}), thief: G.THIEF_EV?.scenes || G.JACKPOT_THIEF?.scenes || [],
  raid: ["workyard"], flood: ["workyard"], wyrm: [G.WYRM?.scene], king: [G.HW?.king?.scene] };
fs.writeFileSync(new URL("./maps.json", import.meta.url), JSON.stringify(out, null, 1));
for (const [k, m] of Object.entries(out)) if (!k.startsWith("_")) console.log(`${k.padEnd(13)} band ${JSON.stringify(m.band)} mobs ${Object.keys(m.mobs).length} (${Object.values(m.mobs).filter((x) => x.boss).map((x) => x.name).join(", ") || "-"}) gather ${m.gather.length} quests ${m.quests.length} sc ${m.shortcuts.length} lb ${m.lockbox ?? "-"}`);
console.log("events", JSON.stringify(out._events));
