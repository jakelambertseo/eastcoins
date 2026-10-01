/* THE STATE OF THE GAME (2026-10-01, the owner: "go ahead with 1, 2, 3, and 5" — 1 being a front page rebuilt from each nightly backup).
   Reads the nightly world backup from R2 (read-only, the way the tracking note says to: never poll production), reduces it to one small
   SNAPSHOT, and keeps one snapshot per day in tools/state-mock/history/<YYYY-MM-DD>.json so the page can show trends and week-over-week
   arrows. The page (tools/state-mock/) draws state.json, which this writes from every day in history/.

   Run after the 09:20 UTC backup:   node tools/gameplan-state.mjs            (downloads latest.json.gz)
   Seed the history once:            node tools/gameplan-state.mjs --seed 7   (also reads the dated backups of the 7 days before)
   Use a file you already have:      node tools/gameplan-state.mjs --file <path.json.gz>
   Then: node tools/gameplan-build.mjs */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HIST = join(ROOT, "tools/state-mock/history");
const G = await import("../v3/assets/js/eastscape-shared.js");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

function wrangler() {
  const base = join(process.env.LOCALAPPDATA || "", "npm-cache/_npx");
  for (const d of existsSync(base) ? readdirSync(base) : []) { const p = join(base, d, "node_modules/wrangler/bin/wrangler.js"); if (existsSync(p)) return p; }
  throw new Error("wrangler not found in the npx cache");
}
function fetchBackup(name) {   /* read-only: r2 object get */
  const out = join(tmpdir(), `gp-${name.replace(/[^a-z0-9.-]/gi, "_")}`);
  try { execFileSync(process.execPath, [wrangler(), "r2", "object", "get", `eastcoin-backups/eastscape/world/${name}`, "--remote", "--file", out], { cwd: join(ROOT, "eastscape-worker"), stdio: "pipe" }); }
  catch { return null; }
  return existsSync(out) ? out : null;
}
const load = (p) => JSON.parse(gunzipSync(readFileSync(p)));
const P = (v) => (typeof v === "string" ? JSON.parse(v) : v);
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + (Array.isArray(b) ? 0 : b), 0);
const dayOf = (ms) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });

export function snapshot(B) {
  const d = B.data, at = Date.parse(B.takenAt), date = dayOf(at - 6 * 3600e3);   /* the day the backup closes: 09:20 UTC is early morning Chicago */
  const chars = Object.entries(d).filter(([k]) => k.startsWith("char:") && k !== "char:selftest").map(([, v]) => P(v));
  const tix = (c) => [...(c.inv || []), ...(c.bank || [])].filter((i) => i && i.k === "tickets").reduce((a, i) => a + i.n, 0);
  const lastSeen = (c) => c.stats?.lastSeen || 0, first = (c) => c.stats?.firstSeen || c.created || 0;
  const hours = (c) => (c.stats?.playMs || 0) / 36e5;
  const week = Array.from({ length: 7 }, (_, i) => dayOf(at - (i + 1) * 864e5 + 6 * 3600e3 - 6 * 3600e3));
  const pd = (c) => c.stats?.playDay || {};
  const recentSec = (c) => week.reduce((a, k) => a + (pd(c)[k] || 0), 0);
  const seen7 = chars.filter((c) => at - lastSeen(c) < 7 * 864e5);
  const combat = seen7.map((c) => G.combatOf(c));
  const skills = Object.keys(G.SKILLS).filter((k) => !G.SKILLS[k].hidden);
  const skillTop = {};
  for (const k of skills) { const ls = chars.map((c) => G.lvlOf(c, k)).filter((l) => l > 1); skillTop[k] = { max: ls.length ? Math.max(...ls) : 1, n99: ls.filter((l) => l >= 99).length, players: ls.length }; }
  const held = chars.map(tix).sort((a, b) => b - a), heldTot = held.reduce((a, b) => a + b, 0);
  const regs = chars.filter((c) => hours(c) >= 10), keptPerHour = median(regs.map((c) => tix(c) / hours(c)));
  const savers = regs.filter((c) => tix(c) / hours(c) > 2.5 * keptPerHour).length;
  /* the tracker's newest complete day in this backup */
  const tdays = [...new Set(Object.keys(d).filter((k) => /^trk:\d{4}-\d{2}-\d{2}:people$/.test(k)).map((k) => k.slice(4, 14)))].sort();
  const td = tdays.filter((x) => x < dayOf(at)).pop() || tdays.pop() || null;
  let day = null;
  if (td) {
    const W = P(d[`trk:${td}:where`]) || {}, E = P(d[`trk:${td}:econ`]) || {}, Pp = P(d[`trk:${td}:people`]) || {}, H = P(d[`trk:${td}:econ-held`]) || null;
    const maps = Object.keys({ ...(W.t || {}), ...(W.kills || {}) }).map((m) => ({ map: m, hours: +(sum(W.t?.[m]) / 3600).toFixed(1), people: Object.keys(W.who?.[m] || {}).length, kills: sum(W.kills?.[m]), deaths: sum(W.deaths?.[m]), fight: +((W.t?.[m]?.f || 0) / 3600).toFixed(1), gather: +((W.t?.[m]?.g || 0) / 3600).toFixed(1) })).sort((a, b) => b.hours - a.hours);
    const casino = Object.fromEntries(Object.entries(E.casino || {}).map(([g, v]) => [g, v]));
    day = { date: td, people: { unique: Object.keys(Pp.players || {}).length, fresh: Pp.fresh || 0, sessions: Pp.sessions || 0, peak: Pp.peak || 0, avgMin: Pp.sessions ? Math.round((Pp.sessMs || 0) / Pp.sessions / 60000) : 0 },
      tixIn: sum(E.tixIn), tixOut: sum(E.tixOut), inBy: E.tixIn || {}, outBy: E.tixOut || {}, casino, held: H, maps, xp: Pp.xp || {},
      hours: +(maps.reduce((a, m) => a + m.hours, 0)).toFixed(1) };
  }
  const buckets = [[1, 20], [20, 40], [40, 60], [60, 80], [80, 100], [100, 200]].map(([a, b]) => ({ from: a, to: b - 1, n: combat.filter((l) => l >= a && l < b).length }));
  return {
    date, takenAt: B.takenAt, rules: B.rulesVersion, online: B.online,
    players: { total: chars.length, seen1: chars.filter((c) => at - lastSeen(c) < 864e5).length, seen7: seen7.length, new7: chars.filter((c) => at - first(c) < 7 * 864e5).length, hoursAll: Math.round(chars.reduce((a, c) => a + hours(c), 0)), hours7: +(chars.reduce((a, c) => a + recentSec(c), 0) / 3600).toFixed(1), playDayKnown: chars.some((c) => Object.keys(pd(c)).length) },
    levels: { combatMax: combat.length ? Math.max(...combat) : 0, combatMedian: median(combat), buckets, skillTop, n99: Object.values(skillTop).reduce((a, s) => a + s.n99, 0) },
    econ: { held: heldTot, median: median(held), top10share: heldTot ? +(held.slice(0, 10).reduce((a, b) => a + b, 0) / heldTot).toFixed(3) : 0, savers, keptPerHour: Math.round(keptPerHour), earned: chars.reduce((a, c) => a + (c.earned || 0), 0), jackpot: Math.round(P(d.jackpot)?.pot || 0), exTax: P(d.exchange)?.tax || 0 },
    day };
}

function save(s) { mkdirSync(HIST, { recursive: true }); writeFileSync(join(HIST, `${s.date}.json`), JSON.stringify(s)); }
function writeIndex() {
  const all = readdirSync(HIST).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().map((f) => JSON.parse(readFileSync(join(HIST, f), "utf8")));
  writeFileSync(join(ROOT, "tools/state-mock/state.json"), JSON.stringify({ built: new Date().toISOString(), days: all }));
  return all.length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const file = arg("--file") || fetchBackup("latest.json.gz");
  if (!file) { console.error("no backup: pass --file or check wrangler"); process.exit(1); }
  const B = load(file), s = snapshot(B); save(s);
  console.log(`snapshot ${s.date} (taken ${s.takenAt}, rules ${s.rules}): ${s.players.total} players, ${s.players.seen7} this week, tracked day ${s.day?.date || "none"}`);
  const seed = +(arg("--seed") || 0);
  for (let i = 1; i <= seed; i++) {
    const dt = new Date(Date.parse(B.takenAt) - i * 864e5), ymd = dt.toISOString().slice(0, 10);
    if (existsSync(join(HIST, `${dayOf(dt.getTime() - 6 * 3600e3)}.json`))) continue;
    let f = null; for (const hm of ["0920", "0921", "0919", "0922", "0918", "0923", "0900", "0925"]) { f = fetchBackup(`${ymd}T${hm}Z.json.gz`); if (f) break; }
    if (!f) { console.log(`  ${ymd}: no dated backup found`); continue; }
    const o = snapshot(load(f)); save(o); console.log(`  seeded ${o.date} (rules ${o.rules})`);
  }
  console.log(`history: ${writeIndex()} days`);
}
