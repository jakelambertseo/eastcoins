/* THE ARMORY (2026-10-10, the owner: "knifes and gun skins … users can roll zcoins or some type of currency they get from the blockshot
   games, and can apply skins to their guns, knives, or even skins for their bean guys"). Built from the mockup at
   /arcade/blockshot/skins-mock after the owner said go.

   BRASS is the currency: earned only by playing (RATES, paid from the match server's round report in _stats.js, so it is as honest as
   the stats), spent on cases. A case draws ONE item from its pool by rarity (ODDS), from a seed the server makes and keeps, so a roll
   can be shown again. Everything is a one-off: a finish found twice turns into Brass. The Knife Case alone can also be opened with
   ZCoins, through the store's money path (roll.js), so the site's money has a way in without being the only way. Skins change looks and
   nothing else. The catalogue below is the ONLY copy: the page reads it from /api/blockshot/armory and keeps only the painters. */
import { chicagoDay } from "../casino/_pot.js";

export const CURRENCY = "Brass";
export const RATES = { kill: 5, headshot: 5, roundWon: 25, match: 60, firstOfDay: 100, win: { ffa: 150, bomb: 100 } };
/** The finishes and their rarity. `legend` on a knife is the top tier. */
export const FINISHES = {
  factory: { n: "Factory", r: "common" }, desert: { n: "Desert Camo", r: "common" }, urban: { n: "Urban Camo", r: "common" }, forest: { n: "Forest Camo", r: "common" }, stripes: { n: "Hazard Stripes", r: "common" },
  hex: { n: "Hex", r: "uncommon" }, carbon: { n: "Carbon", r: "uncommon" }, toxic: { n: "Toxic", r: "uncommon" }, ice: { n: "Ice", r: "uncommon" },
  neon: { n: "Neon Fade", r: "rare" }, lava: { n: "Lava", r: "rare" }, galaxy: { n: "Galaxy", r: "rare" }, hardened: { n: "Case Hardened", r: "rare" },
  dragon: { n: "Dragon", r: "legend" }, gold: { n: "Solid Gold", r: "legend" }, glitch: { n: "Glitch", r: "legend" }
};
export const GUN_SLOTS = ["ar", "sniper", "shotgun", "pistol"], SLOTS = [...GUN_SLOTS, "knife", "bean"];
export const SLOT_NAMES = { ar: "Assault rifle", sniper: "Sniper", shotgun: "Shotgun", pistol: "Pistol", knife: "Knife", bean: "Bean" };
export const KNIVES = { combat: "Combat Knife", karambit: "Karambit", butterfly: "Butterfly" };
/** A knife's rarity is a step up: a plain finish is uncommon, a rare finish rare, a legendary finish the top of the game. */
export const rarityOf = (id) => { const [slot, fin] = id.split(":"); const r = FINISHES[fin]?.r || "common"; return slot === "knife" ? (r === "legend" ? "knife" : r === "common" ? "uncommon" : "rare") : r; };
export const nameOf = (id) => { const [slot, fin, kind] = id.split(":"); return `${slot === "knife" ? KNIVES[kind] || "Knife" : SLOT_NAMES[slot] || slot} · ${FINISHES[fin]?.n || fin}`; };
export const CASES = {
  weapon: { n: "Weapon Case", price: 120, zc: 0, odds: [["common", 0.799], ["uncommon", 0.16], ["rare", 0.032], ["legend", 0.009]], blurb: "A finish for one of the four guns." },
  knife: { n: "Knife Case", price: 480, zc: 40, odds: [["uncommon", 0.7], ["rare", 0.25], ["knife", 0.05]], blurb: "Always a knife; the finish is the roll. The only case ZCoins can open." },
  bean: { n: "Bean Case", price: 80, zc: 0, odds: [["common", 0.7], ["uncommon", 0.25], ["rare", 0.05]], blurb: "A finish for your bean, seen by everyone." }
};
export function poolOf(caseKey) {
  const fins = Object.keys(FINISHES).filter((f) => f !== "factory");
  if (caseKey === "weapon") return fins.flatMap((f) => GUN_SLOTS.map((s) => `${s}:${f}`));
  if (caseKey === "knife") return Object.keys(FINISHES).flatMap((f) => Object.keys(KNIVES).map((k) => `knife:${f}:${k}`));
  if (caseKey === "bean") return fins.map((f) => `bean:${f}`);
  return [];
}
export const dupRefund = (caseKey) => Math.round(CASES[caseKey].price * 0.4);
export function catalogue() { return { currency: CURRENCY, rates: RATES, finishes: FINISHES, knives: KNIVES, slots: SLOTS, slotNames: SLOT_NAMES, cases: Object.fromEntries(Object.entries(CASES).map(([k, c]) => [k, { ...c, pool: poolOf(k), refund: dupRefund(k) }])) }; }
/** A valid item id, or null: "ar:neon", "knife:gold:karambit", "bean:lava", or "factory" for a slot's plain look. */
export function validItem(slot, item) {
  if (!SLOTS.includes(slot)) return null; if (item === "factory") return `${slot}:factory${slot === "knife" ? ":combat" : ""}`;
  const [s, fin, kind] = String(item || "").split(":"); if (s !== slot || !FINISHES[fin]) return null;
  if (slot === "knife") return KNIVES[kind] ? item : null; return kind ? null : item;
}

/* ---------------------------------------------------------------- the draw: a seed, a hash, a fraction, an item */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export async function sha256(s) { return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))); }
const frac = (h, from = 0) => parseInt(h.slice(from, from + 13), 16) / 0x10000000000000;
/** The roll from a seed: the rarity from one fraction of the hash, the item in that rarity from another. */
export async function drawFrom(caseKey, seed) {
  const h = await sha256(`${seed}:roll`), r1 = frac(h, 0), r2 = frac(h, 16);
  let acc = 0, rarity = CASES[caseKey].odds[0][0]; for (const [k, p] of CASES[caseKey].odds) { acc += p; if (r1 < acc) { rarity = k; break; } }
  const pool = poolOf(caseKey).filter((id) => rarityOf(id) === rarity);
  return { item: pool[Math.floor(r2 * pool.length)], rarity };
}
export const newSeed = () => hex(crypto.getRandomValues(new Uint8Array(16)));

/* ---------------------------------------------------------------- the tables */
let ready = false;
export async function ensureArmory(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_wallet (user_id TEXT PRIMARY KEY, brass INTEGER NOT NULL DEFAULT 0, earned INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_items (user_id TEXT NOT NULL, item TEXT NOT NULL, via TEXT NOT NULL, found_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (user_id, item))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_loadout (user_id TEXT PRIMARY KEY, ar TEXT, sniper TEXT, shotgun TEXT, pistol TEXT, knife TEXT, bean TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS blockshot_rolls (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, case_key TEXT NOT NULL, seed TEXT NOT NULL, item TEXT NOT NULL, rarity TEXT NOT NULL, dup INTEGER NOT NULL DEFAULT 0, paid_brass INTEGER NOT NULL DEFAULT 0, paid_zc INTEGER NOT NULL DEFAULT 0, op_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_blockshot_rolls_user ON blockshot_rolls (user_id, created_at)`)
  ]);
  ready = true;
}
export async function brassOf(db, userId) { const r = await db.prepare(`SELECT brass FROM blockshot_wallet WHERE user_id = ?`).bind(userId).first(); return r ? r.brass : 0; }
export async function creditBrass(db, userId, amount) {
  if (!(amount > 0)) return;
  await db.prepare(`INSERT INTO blockshot_wallet (user_id, brass, earned) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET brass = brass + excluded.brass, earned = earned + excluded.earned, updated_at = CURRENT_TIMESTAMP`).bind(userId, Math.round(amount), Math.round(amount)).run();
}
/** What a reported result pays. `first`: the player's first counted round today. */
export function brassForResult(r, { first = false } = {}) {
  const mode = r.mode === "bomb" ? "bomb" : "ffa";
  return (r.kills | 0) * RATES.kill + (r.headshots | 0) * RATES.headshot + (r.roundsWon | 0) * RATES.roundWon + RATES.match + (r.won ? RATES.win[mode] : 0) + (first ? RATES.firstOfDay : 0);
}
export async function armoryFor(db, userId) {
  const [w, items, lo] = await Promise.all([
    db.prepare(`SELECT brass, earned FROM blockshot_wallet WHERE user_id = ?`).bind(userId).first(),
    db.prepare(`SELECT item, via, found_at FROM blockshot_items WHERE user_id = ? ORDER BY found_at`).bind(userId).all(),
    db.prepare(`SELECT ar, sniper, shotgun, pistol, knife, bean FROM blockshot_loadout WHERE user_id = ?`).bind(userId).first()
  ]);
  const loadout = {}; for (const s of SLOTS) loadout[s] = (lo && lo[s]) || validItem(s, "factory");
  return { brass: w ? w.brass : 0, earned: w ? w.earned : 0, items: (items.results || []).map((r) => r.item), loadout };
}
/** The loadout alone, for the match server at login: null when the player has never touched the Armory. */
export async function lookOf(db, userId) {
  const lo = await db.prepare(`SELECT ar, sniper, shotgun, pistol, knife, bean FROM blockshot_loadout WHERE user_id = ?`).bind(userId).first(); if (!lo) return null;
  const look = {}; for (const s of SLOTS) if (lo[s] && !lo[s].includes(":factory")) look[s] = lo[s]; return Object.keys(look).length ? look : null;
}
/** One roll. `paid` says what was taken already: { brass } (taken here) or { zc, opKey } (taken by the caller through the wallet). */
export async function roll(db, userId, caseKey, paid = {}) {
  const c = CASES[caseKey]; if (!c) return { ok: false, code: "CASE" };
  if (!paid.opKey) {   // paid in Brass: the price comes off here, and only if it is there
    const r = await db.prepare(`UPDATE blockshot_wallet SET brass = brass - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND brass >= ?`).bind(c.price, userId, c.price).run();
    if (!r.meta?.changes) return { ok: false, code: "BRASS", brass: await brassOf(db, userId) };
  }
  const seed = newSeed(), { item, rarity } = await drawFrom(caseKey, seed), id = `roll_${seed.slice(0, 12)}`;
  const ins = await db.prepare(`INSERT OR IGNORE INTO blockshot_items (user_id, item, via) VALUES (?, ?, ?)`).bind(userId, item, caseKey).run();
  const dup = !ins.meta?.changes, refund = dup ? dupRefund(caseKey) : 0;
  if (dup) await creditBrass(db, userId, refund);
  await db.prepare(`INSERT INTO blockshot_rolls (id, user_id, case_key, seed, item, rarity, dup, paid_brass, paid_zc, op_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, userId, caseKey, seed, item, rarity, dup ? 1 : 0, paid.opKey ? 0 : c.price, paid.zc || 0, paid.opKey || null).run();
  return { ok: true, id, item, rarity, name: nameOf(item), dup, refund, seed, brass: await brassOf(db, userId) };
}
export async function equip(db, userId, slot, item) {
  const id = validItem(slot, item); if (!id) return { ok: false, code: "ITEM" };
  if (!id.includes(":factory")) { const own = await db.prepare(`SELECT 1 FROM blockshot_items WHERE user_id = ? AND item = ?`).bind(userId, id).first(); if (!own) return { ok: false, code: "NOT_OWNED" }; }
  await db.prepare(`INSERT INTO blockshot_loadout (user_id, ${slot}) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET ${slot} = excluded.${slot}, updated_at = CURRENT_TIMESTAMP`).bind(userId, id).run();
  return { ok: true, slot, item: id };
}
export const dayOf = chicagoDay;
