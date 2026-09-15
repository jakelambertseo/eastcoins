/* ============================================================
   EastCoin Store — cosmetics bought with ZCoins (2026-09-15)

   Everything here is cosmetic and permanent: buy it once, own it,
   switch it on or off. No bundles, no random rewards, nothing that
   changes a pick, a payout or the casino.

   Two tables:
     store_purchases  one row per purchase; a partial unique index on
                      (user_id, item) WHERE status = 'OWNED' means an item
                      can only be owned once, however fast someone clicks.
     user_cosmetics   what each person has switched on, one column per
                      slot. Only items still OWNED are ever drawn.

   Money path: the same wallet operations the casino uses. The debit's
   idempotency key is STORE:BUY:<user>:<item>:<n>, where n is how many
   times they have bought that item before — two clicks in the same
   instant produce the same key, and the second is refused. A debit
   whose purchase row never lands is refunded on the spot, and failing
   that shows up in the admin Wallet tab (reconcile.js knows the key).

   Earned beats bought: the gold and silver card finishes come off the
   season ladder and always show over a bought finish, so a store look
   can never pass for an earned one.
   ============================================================ */

export const SLOTS = {
  finish: "Card finish",
  name: "Name colour",
  title: "Custom title",
  banner: "Profile banner",
  label: "Case label"
};

export const ITEMS = [
  { id: "finish-holo", slot: "finish", name: "Holo", price: 400, blurb: "A rainbow sheen that slides across the card." },
  { id: "finish-neon", slot: "finish", name: "Neon", price: 350, blurb: "A dark card with an electric glowing edge." },
  { id: "finish-chrome", slot: "finish", name: "Chrome", price: 500, blurb: "Brushed metal from edge to edge." },
  { id: "name-gold", slot: "name", name: "Gold", price: 150, blurb: "Your name in gold on your card and profile." },
  { id: "name-ice", slot: "name", name: "Ice", price: 150, blurb: "Your name in frosted blue." },
  { id: "name-ember", slot: "name", name: "Ember", price: 150, blurb: "Your name glowing hot orange." },
  { id: "title-custom", slot: "title", name: "Custom title", price: 300, blurb: "Your own line under your name on the card, up to 24 characters. It replaces your badge line." },
  { id: "banner-stadium", slot: "banner", name: "Stadium lights", price: 200, blurb: "Floodlights over the top of your profile." },
  { id: "banner-matrix", slot: "banner", name: "Matrix", price: 200, blurb: "Green code raining behind your profile." },
  { id: "banner-retro", slot: "banner", name: "Retro sunset", price: 200, blurb: "An '80s sunset grid behind your profile." },
  { id: "label-foil", slot: "label", name: "Foil label", price: 100, blurb: "Turns “EastCoin Trading Card” into shimmering gold foil." }
];

export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;

let ready = false;
export async function ensureStore(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS store_purchases (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item TEXT NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'OWNED',
      op_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      refunded_at TEXT
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS user_cosmetics (
      user_id TEXT PRIMARY KEY,
      finish TEXT,
      name TEXT,
      title TEXT,
      title_text TEXT,
      banner TEXT,
      label TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_store_purchases_user ON store_purchases (user_id, status)`)
  ]);
  // Its own statement and forgiving, so an odd existing row can never
  // take the whole store down with it.
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_store_owned_once ON store_purchases (user_id, item) WHERE status = 'OWNED'`).run().catch(() => {});
  ready = true;
}

export async function ownedItems(db, userId) {
  const rows = await db.prepare(`SELECT item FROM store_purchases WHERE user_id = ? AND status = 'OWNED'`).bind(String(userId)).all();
  return new Set((rows.results || []).map((r) => String(r.item)));
}

/** What is switched on AND still owned, shaped for the profile. Never throws. */
export async function cosmeticsFor(db, userId) {
  try {
    const [row, owned] = await Promise.all([
      db.prepare(`SELECT * FROM user_cosmetics WHERE user_id = ?`).bind(String(userId)).first(),
      ownedItems(db, userId)
    ]);
    if (!row) return null;
    const keep = (id, slot) => (id && owned.has(id) && itemById(id)?.slot === slot ? id : null);
    const out = {
      finish: keep(row.finish, "finish"),
      name: keep(row.name, "name"),
      banner: keep(row.banner, "banner"),
      label: keep(row.label, "label"),
      title: keep(row.title, "title") && row.title_text ? String(row.title_text) : null
    };
    return Object.values(out).some(Boolean) ? out : null;
  } catch {
    return null;
  }
}

/* A custom title is shown on a public profile, so it is kept plain and
   clean: 2-24 characters of letters, numbers and simple punctuation,
   no links, and none of a short list of slurs (checked with spaces and
   common letter swaps removed). Admins can clear one through equip. */
const BLOCKED = ["nigg", "nigga", "fag", "faggot", "retard", "kike", "spic", "chink", "tranny", "cunt", "nazi", "hitler", "rape", "kkk", "whore", "slut"];
export function cleanTitle(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 24) return { ok: false, message: "A title is 2 to 24 characters." };
  if (!/^[\p{L}\p{N} .,'!?&#+\-]+$/u.test(text)) return { ok: false, message: "Letters, numbers and simple punctuation only." };
  const squashed = text.toLowerCase().replace(/[\s.,'!?&#+\-]/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
  if (BLOCKED.some((w) => squashed.includes(w))) return { ok: false, message: "That title isn't allowed." };
  return { ok: true, text };
}

export async function mineFor(db, userId) {
  const [owned, row] = await Promise.all([
    ownedItems(db, userId),
    db.prepare(`SELECT * FROM user_cosmetics WHERE user_id = ?`).bind(String(userId)).first()
  ]);
  const equipped = {};
  for (const slot of Object.keys(SLOTS)) equipped[slot] = row?.[slot] && owned.has(row[slot]) ? String(row[slot]) : null;
  return { owned: [...owned], equipped, titleText: row?.title_text ? String(row.title_text) : "" };
}
