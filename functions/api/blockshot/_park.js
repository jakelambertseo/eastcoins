/* Parkour on the site (2026-10-10): the best time per player per course, the ghost of that run, and the medals, written only by the
   match server (park/run.js, proved with the arcade key). A medal pays Brass the first time it is earned on a course (the Armory's
   wallet). COURSES mirrors the courses' names and medal times in blockshot-rules.js — change one, change the other. */
import { creditBrass, ensureArmory } from "./_armory.js";
import { chicagoDay } from "../casino/_pot.js";

export const COURSES = { course1: { n: "First Steps", medals: [26, 34, 48] }, course2: { n: "Hop Line", medals: [34, 44, 60] }, course3: { n: "The Tower", medals: [40, 52, 70] } };
export const MEDAL_BRASS = { gold: 100, silver: 60, bronze: 30 }, TIERS = ["gold", "silver", "bronze"];
export const medalFor = (ms, medals) => (ms <= medals[0] * 1000 ? "gold" : ms <= medals[1] * 1000 ? "silver" : ms <= medals[2] * 1000 ? "bronze" : null);

let ready = false;
export async function ensurePark(db) {
  if (ready) return; await ensureArmory(db);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_park (user_id TEXT NOT NULL, login TEXT NOT NULL, display TEXT NOT NULL, course TEXT NOT NULL, best_ms INTEGER NOT NULL, runs INTEGER NOT NULL DEFAULT 0, falls INTEGER NOT NULL DEFAULT 0, day TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, course))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_blockshot_park_course ON blockshot_park (course, best_ms)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_park_ghost (user_id TEXT NOT NULL, course TEXT NOT NULL, ms INTEGER NOT NULL, trail TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, course))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_park_medals (user_id TEXT NOT NULL, course TEXT NOT NULL, tier TEXT NOT NULL, earned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, course, tier))`)
  ]);
  ready = true;
}
const n = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
/** A finished run. Keeps the best time and its ghost, counts the run, pays any medal not yet earned on this course. */
export async function saveRun(db, { id, login, name, course, ms, falls, trail }, now = Date.now()) {
  const C = COURSES[course]; if (!C || !id || id.startsWith("guest:")) return { ok: false, code: "BAD" };
  ms = n(ms, 3600000); if (ms < 1000) return { ok: false, code: "TIME" };
  const prev = await db.prepare(`SELECT best_ms FROM blockshot_park WHERE user_id = ? AND course = ?`).bind(id, course).first();
  const pb = !prev || ms < prev.best_ms, best = pb ? ms : prev.best_ms;
  await db.prepare(`INSERT INTO blockshot_park (user_id, login, display, course, best_ms, runs, falls, day) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(user_id, course) DO UPDATE SET login = excluded.login, display = excluded.display, best_ms = MIN(best_ms, excluded.best_ms), runs = runs + 1, falls = falls + excluded.falls, day = CASE WHEN excluded.best_ms < best_ms THEN excluded.day ELSE day END, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, String(login).slice(0, 40), String(name || login).slice(0, 40), course, ms, n(falls, 999), chicagoDay(now)).run();
  if (pb && Array.isArray(trail)) { const t = trail.slice(0, 1800).map((p) => [n(p[0] * 20 + 100000, 400000) - 100000, n(p[1] * 20 + 100000, 400000) - 100000, n(p[2] * 20 + 100000, 400000) - 100000]);
    await db.prepare(`INSERT INTO blockshot_park_ghost (user_id, course, ms, trail) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, course) DO UPDATE SET ms = excluded.ms, trail = excluded.trail, updated_at = CURRENT_TIMESTAMP`).bind(id, course, ms, JSON.stringify(t)).run(); }
  // medals: the tier this time earns and every tier below it, each paid once
  const earned = medalFor(ms, C.medals), newTiers = [], brass = { gold: 0, silver: 0, bronze: 0 };
  if (earned) for (const tier of TIERS.slice(TIERS.indexOf(earned))) { const ins = await db.prepare(`INSERT OR IGNORE INTO blockshot_park_medals (user_id, course, tier) VALUES (?, ?, ?)`).bind(id, course, tier).run(); if (ins.meta?.changes) { newTiers.push(tier); brass[tier] = MEDAL_BRASS[tier]; await creditBrass(db, id, MEDAL_BRASS[tier]); } }
  const record = await db.prepare(`SELECT display AS name, best_ms AS ms FROM blockshot_park WHERE course = ? ORDER BY best_ms LIMIT 1`).bind(course).first();
  const medals = (await db.prepare(`SELECT tier FROM blockshot_park_medals WHERE user_id = ? AND course = ?`).bind(id, course).all()).results.map((r) => r.tier);
  return { ok: true, ms, pb, best, medal: earned, newTiers, brass: Object.values(brass).reduce((a, b) => a + b, 0), medals, record: record ? { name: record.name, ms: record.ms, yours: record.ms === best && record.name === String(name || login).slice(0, 40) } : null };
}
export async function boardFor(db, course, limit = 25) {
  const rows = (await db.prepare(`SELECT login, display AS name, best_ms AS ms, runs, day FROM blockshot_park WHERE course = ? ORDER BY best_ms LIMIT ?`).bind(course, limit).all()).results || [];
  return rows.map((r, i) => ({ place: i + 1, ...r, medal: medalFor(r.ms, COURSES[course].medals) }));
}
export async function ghostFor(db, course, userId) {
  const r = userId ? await db.prepare(`SELECT g.ms, g.trail, p.display AS name FROM blockshot_park_ghost g JOIN blockshot_park p ON p.user_id = g.user_id AND p.course = g.course WHERE g.user_id = ? AND g.course = ?`).bind(userId, course).first()
    : await db.prepare(`SELECT g.ms, g.trail, p.display AS name FROM blockshot_park_ghost g JOIN blockshot_park p ON p.user_id = g.user_id AND p.course = g.course WHERE g.course = ? ORDER BY g.ms LIMIT 1`).bind(course).first();
  if (!r) return null; let trail = []; try { trail = JSON.parse(r.trail).map((p) => [p[0] / 20, p[1] / 20, p[2] / 20]); } catch {}
  return { ms: r.ms, name: r.name, trail };
}
export async function mineFor(db, userId) {
  const rows = (await db.prepare(`SELECT course, best_ms AS ms, runs FROM blockshot_park WHERE user_id = ?`).bind(userId).all()).results || [];
  const medals = (await db.prepare(`SELECT course, tier FROM blockshot_park_medals WHERE user_id = ?`).bind(userId).all()).results || [];
  const out = {}; for (const r of rows) out[r.course] = { ms: r.ms, runs: r.runs, medals: medals.filter((m) => m.course === r.course).map((m) => m.tier) }; return out;
}
