/* ============================================================
   EastCoin — the Daily Crate (2026-09-16)

   A present in the top nav. One FREE crate every 24 hours per member,
   then as many more as they like at PRICE ZC each, same odds. Inside:
   a store cosmetic they do not own yet, or a few ZCoins.

   Odds are CS2's case odds (ODDS), and each tier holds both cosmetics
   and a coin prize (COINS); COIN_SHARE is the chance a tier pays coins
   rather than an item. A tier whose cosmetics someone already owns in
   full pays that tier's coins instead — a crate never duplicates.

   Fairness is the casino's: a random seed is committed as its hash on
   the crate_opens row BEFORE anything is granted, and every draw is a
   pure function of the seed (rarityFor, kindFor, pickIndex), so
   /api/casino/verify?game=crate replays it.

   Money. Buying is a WAGER_DEBIT keyed CRATE:BUY:<user>:<n> (the only
   debit type the wallet table allows); a coin prize is a PAYOUT_CREDIT
   keyed CRATE:PAY:<open id>, so a crate pays once however many times
   its reveal is asked for. An item is a store_purchases row at price 0
   with op_key CRATE:ITEM:<open id> — the same "owned" shape the store
   and profiles already read. Coin prizes are the house's money, like
   the Jackpot: not in hourlyNet, not on the results board.

   A Legendary reaches the ticker and the activity feed as type "crate"
   and NOTHING else: never chat, never Discord.
   ============================================================ */

import { ITEMS, itemById } from "../store/_store.js";
import { sha256 } from "../casino/_engine.js";

export const PRICE = 25;
export const FREE_EVERY_MS = 24 * 3600 * 1000;
export const TIERS = ["common", "rare", "epic", "legendary"];
export const ODDS = { common: 79.92, rare: 15.98, epic: 3.2, legendary: 0.64 };
export const COINS = { common: [1, 3], rare: [5, 10], epic: [100], legendary: [500] };
export const COIN_SHARE = { common: 0.3, rare: 0.25, epic: 0.25, legendary: 0.25 };

// Which store items sit in which tier. Anything not listed (the free
// promo finish, the custom title, the message, the player pick) is not
// in the crate. Gold items are the Legendaries.
export const TIER_OF = {
  "team-glow": "common", "namefx-pulse": "common", "banner-retro": "common",
  "name-ice": "rare", "name-ember": "rare", "title-oracle": "rare", "title-hater": "rare", "title-parlay": "rare", "title-underdog": "rare", "title-degen": "rare", "title-legend": "rare",
  "finish-holo": "rare", "namefx-shine": "rare", "banner-stadium": "rare", "banner-matrix": "rare", "background-gridiron": "rare",
  "namefx-glitch": "epic", "namefx-rainbow": "epic", "background-starfield": "epic", "background-velvet": "epic", "background-carbon": "epic", "team-flame": "epic",
  // round three
  "team-frost": "common",
  "name-sakura": "rare", "name-slime": "rare", "name-mint": "rare", "namefx-neon": "rare",
  "title-maincharacter": "rare", "title-finalboss": "rare", "title-cursed": "rare", "title-trickortreat": "rare", "title-scaries": "rare", "title-bag": "rare",
  "finish-sakura": "rare", "finish-pumpkin": "rare", "banner-speedlines": "rare", "banner-graveyard": "rare", "background-playbook": "rare",
  "finish-obsidian": "epic", "namefx-powerup": "epic", "namefx-haunted": "epic", "banner-aurora": "epic", "background-neontokyo": "epic", "background-bloodmoon": "epic",
  "finish-gold": "legendary", "name-gold": "legendary", "team-gold": "legendary", "label-foil": "legendary"
};
export const tierItems = (tier) => ITEMS.filter((i) => TIER_OF[i.id] === tier);

let ready = false;
export async function ensureCrate(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS crate_opens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('free','buy')),
    seed TEXT NOT NULL,
    hash TEXT NOT NULL,
    rarity TEXT NOT NULL,
    prize TEXT NOT NULL,
    coins INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  // "When was this person's last free crate" and "how many bought".
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_crate_user_kind ON crate_opens (user_id, kind, created_at)`).run().catch(() => {});
  // The feed's Legendaries.
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_crate_rarity ON crate_opens (rarity, created_at)`).run().catch(() => {});
  ready = true;
}

/* ---------------------------------------------------------- pure draws */
const frac = async (text) => parseInt((await sha256(text)).slice(0, 8), 16) / 0x100000000;

// The four CS2 numbers add to 99.74 (their knife tier is the rest), so the
// walk is over their sum: the same proportions, nothing left over.
const ODDS_TOTAL = TIERS.reduce((a, t) => a + ODDS[t], 0);
export async function rarityFor(seed) {
  let u = (await frac(`${seed}:crate`)) * ODDS_TOTAL;
  for (const t of TIERS) { u -= ODDS[t]; if (u < 0) return t; }
  return "common";
}
/** true when the tier pays coins rather than an item. */
export const coinsFor = async (seed, tier) => (await frac(`${seed}:kind`)) < COIN_SHARE[tier];
/** An index into a list of n candidates. */
export const pickIndex = async (seed, n) => Math.floor((await frac(`${seed}:pick`)) * n);

/** The whole pull for a seed, given what this person already owns. */
export async function drawFor(seed, owned) {
  const rarity = await rarityFor(seed);
  const unowned = tierItems(rarity).filter((i) => !owned.has(i.id));
  if (await coinsFor(seed, rarity) || !unowned.length) {
    const list = COINS[rarity];
    return { rarity, coins: list[await pickIndex(seed, list.length)], item: null, fallback: !unowned.length };
  }
  const item = unowned[await pickIndex(seed, unowned.length)];
  return { rarity, coins: 0, item, fallback: false };
}

/* ---------------------------------------------------------- reads */
export async function lastFreeAt(db, userId) {
  const row = await db.prepare(`SELECT created_at FROM crate_opens WHERE user_id = ? AND kind = 'free' ORDER BY created_at DESC LIMIT 1`).bind(String(userId)).first();
  return row?.created_at ? Date.parse(String(row.created_at).replace(" ", "T") + "Z") : 0;
}
export const nextFreeAt = (last) => (last ? last + FREE_EVERY_MS : 0);

export function publicOpen(row, item) {
  return {
    id: row.id, kind: row.kind, rarity: row.rarity, coins: Number(row.coins || 0),
    item: item ? { id: item.id, name: item.name, slot: item.slot } : null,
    seed: row.seed, hash: row.hash, at: String(row.created_at).replace(" ", "T") + "Z"
  };
}

/** The last few Legendaries, for the feed and the ticker. */
export async function recentLegendaries(db, limit = 10) {
  const rows = await db.prepare(
    `SELECT c.id, c.prize, c.coins, c.created_at, u.twitch_login, u.display_name, u.avatar_url
       FROM crate_opens c JOIN users u ON u.twitch_id = c.user_id
      WHERE c.rarity = 'legendary' ORDER BY c.created_at DESC LIMIT ?`
  ).bind(limit).all().catch(() => ({ results: [] }));
  return (rows.results || []).map((r) => {
    const item = itemById(String(r.prize));
    return {
      type: "crate", at: String(r.created_at).replace(" ", "T") + "Z",
      who: { login: String(r.twitch_login || "").toLowerCase(), displayName: String(r.display_name || r.twitch_login || ""), avatar: String(r.avatar_url || "") },
      rarity: "legendary", coins: Number(r.coins || 0), prize: item ? item.name : `${Number(r.coins || 0)} ZC`
    };
  });
}
