/* ============================================================
   EastCoin Store — cosmetics bought with ZCoins (2026-09-15)

   Everything here is cosmetic and permanent: buy it once, own it,
   switch it on or off. No bundles, no random rewards, nothing that
   changes a pick, a payout or the casino.

   Two tables:
     store_purchases  one row per purchase; a partial unique index on
                      (user_id, item) WHERE status = 'OWNED' means an item
                      can only be owned once, however fast someone clicks.
     user_cosmetics   what each person has switched on: one column per
                      slot (the slot key IS the column name), plus the
                      text a few slots carry (title_text, message_text,
                      player_json). Only items still OWNED are ever drawn.

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

// Order here is the order of the store's shelves. Each key is also a
// column in user_cosmetics — keep them plain lowercase words.
export const SLOTS = {
  finish: "Card finish",
  name: "Name colour",
  namefx: "Name effect",
  title: "Titles",
  message: "Profile message",
  background: "Profile background",
  banner: "Profile banner",
  team: "Team name effect",
  player: "Favourite player",
  label: "Case label"
};

// Slots whose item needs something typed or chosen before it can show.
export const NEEDS_INPUT = new Set(["title-custom", "message-custom", "player-pick"]);

export const ITEMS = [
  { id: "finish-holo", slot: "finish", name: "Holo", price: 75, blurb: "A rainbow sheen that slides across the card." },
  // Replaced Neon on 2026-09-15 (nobody had bought it). Deliberately a
  // metallic gold panel, not the crimson-and-gold of the EARNED #1 card,
  // and the tier tag still shows what was actually earned.
  { id: "finish-gold", slot: "finish", name: "Gold", price: 500, chase: true, blurb: "The whole card in polished gold. A Legendary item." },
  // Free as a promo (2026-09-15). A price of 0 never touches the wallet —
  // buy.js records ownership without a wallet operation.
  { id: "finish-chrome", slot: "finish", name: "Chrome", price: 0, promo: "Free", blurb: "Brushed metal from edge to edge. Free for a limited time." },

  { id: "name-gold", slot: "name", name: "Gold", price: 500, chase: true, blurb: "Your name in gold on your card and profile. A Legendary item." },
  { id: "name-ice", slot: "name", name: "Ice", price: 75, blurb: "Your name in frosted blue." },
  { id: "name-ember", slot: "name", name: "Ember", price: 75, blurb: "Your name glowing hot orange." },

  { id: "namefx-shine", slot: "namefx", name: "Shine", price: 75, blurb: "A light sweeps across your profile name every few seconds." },
  { id: "namefx-glitch", slot: "namefx", name: "Glitch", price: 75, blurb: "Your name jitters with a red and cyan glitch." },
  { id: "namefx-rainbow", slot: "namefx", name: "Rainbow", price: 75, blurb: "Your name slowly cycles through every colour." },
  { id: "namefx-pulse", slot: "namefx", name: "Pulse", price: 75, blurb: "A soft glow breathes around your name." },

  { id: "title-oracle", slot: "title", name: "The Oracle", text: "The Oracle", price: 75, blurb: "For the one who saw it coming." },
  { id: "title-hater", slot: "title", name: "Certified Hater", text: "Certified Hater", price: 75, blurb: "Fades everyone. Proudly." },
  { id: "title-parlay", slot: "title", name: "Parlay Prince", text: "Parlay Prince", price: 75, blurb: "Never met a long shot they didn't like." },
  { id: "title-underdog", slot: "title", name: "Underdog King", text: "Underdog King", price: 75, blurb: "Plus money or nothing." },
  { id: "title-degen", slot: "title", name: "Professional Degen", text: "Professional Degen", price: 75, blurb: "It's not gambling if you're good at it." },
  { id: "title-legend", slot: "title", name: "Chat Legend", text: "Chat Legend", price: 75, blurb: "Everybody knows the name." },
  { id: "title-custom", slot: "title", name: "Custom title", price: 75, blurb: "Write your own, up to 24 characters." },

  { id: "message-custom", slot: "message", name: "Profile message", price: 75, blurb: "A short line of your own on your profile, up to 100 characters." },

  { id: "background-gridiron", slot: "background", name: "Gridiron", price: 75, blurb: "Yard lines and turf behind your whole profile." },
  { id: "background-starfield", slot: "background", name: "Starfield", price: 75, blurb: "Deep space and slow-drifting stars." },
  { id: "background-carbon", slot: "background", name: "Carbon", price: 75, blurb: "Woven carbon fibre, like a race car." },
  { id: "background-velvet", slot: "background", name: "Velvet", price: 75, blurb: "Deep red velvet with a VIP glow." },

  { id: "banner-stadium", slot: "banner", name: "Stadium lights", price: 75, blurb: "Floodlights over the top of your profile." },
  { id: "banner-matrix", slot: "banner", name: "Matrix", price: 75, blurb: "Green code raining behind your profile." },
  { id: "banner-retro", slot: "banner", name: "Retro sunset", price: 75, blurb: "An '80s sunset grid behind your profile." },

  { id: "team-glow", slot: "team", name: "Team glow", price: 75, blurb: "Your favourite team glows on your profile." },
  { id: "team-gold", slot: "team", name: "Gold plate", price: 500, chase: true, blurb: "Your team on an engraved gold nameplate. A Legendary item." },
  { id: "team-flame", slot: "team", name: "On fire", price: 75, blurb: "Your team's name burns hot." },

  { id: "player-pick", slot: "player", name: "Favourite player", price: 75, blurb: "Pick any NFL, MLB or NBA player — their ESPN photo goes on your profile. Change them any time." },

  { id: "label-foil", slot: "label", name: "Gold foil label", price: 500, chase: true, blurb: "Turns “EastCoin Trading Card” into shimmering gold foil. A Legendary item." }
];

// Chase items: the gold ones, priced high and marked in the store as the ones to chase.
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
  // Columns added after the first release. Each is forgiving: "duplicate
  // column" on every request after the first is expected and ignored.
  for (const col of ["namefx", "message", "message_text", "background", "team", "player", "player_json"]) {
    await db.prepare(`ALTER TABLE user_cosmetics ADD COLUMN ${col} TEXT`).run().catch(() => {});
  }
  // Its own statement and forgiving, so an odd existing row can never
  // take the whole store down with it.
  await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_store_owned_once ON store_purchases (user_id, item) WHERE status = 'OWNED'`).run().catch(() => {});
  ready = true;
}

export async function ownedItems(db, userId) {
  const rows = await db.prepare(`SELECT item FROM store_purchases WHERE user_id = ? AND status = 'OWNED'`).bind(String(userId)).all();
  return new Set((rows.results || []).map((r) => String(r.item)));
}

function parsePlayer(raw) {
  try { const p = JSON.parse(raw || "null"); return p && p.id && p.name ? p : null; } catch { return null; }
}

/** The title text an equipped title item shows: a preset's own, or the custom text. */
function titleTextFor(itemId, customText) {
  const item = itemById(itemId);
  if (!item || item.slot !== "title") return null;
  if (item.id === "title-custom") return customText ? String(customText) : null;
  return item.text || item.name;
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
      namefx: keep(row.namefx, "namefx"),
      banner: keep(row.banner, "banner"),
      background: keep(row.background, "background"),
      team: keep(row.team, "team"),
      label: keep(row.label, "label"),
      title: keep(row.title, "title") ? titleTextFor(row.title, row.title_text) : null,
      message: keep(row.message, "message") && row.message_text ? String(row.message_text) : null,
      player: keep(row.player, "player") ? parsePlayer(row.player_json) : null
    };
    return Object.values(out).some(Boolean) ? out : null;
  } catch {
    return null;
  }
}

/* Text people write shows on a public profile, so it is kept plain and
   clean: no links, simple punctuation, and none of a short list of
   slurs (checked with spaces and common letter swaps removed). */
const BLOCKED = ["nigg", "nigga", "fag", "faggot", "retard", "kike", "spic", "chink", "tranny", "cunt", "nazi", "hitler", "rape", "kkk", "whore", "slut"];
function blocked(text) {
  const squashed = text.toLowerCase().replace(/[\s.,'"!?&#+\-:;()/]/g, "").replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/7/g, "t");
  return BLOCKED.some((w) => squashed.includes(w));
}

export function cleanTitle(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 24) return { ok: false, message: "A title is 2 to 24 characters." };
  if (!/^[\p{L}\p{N} .,'!?&#+\-]+$/u.test(text)) return { ok: false, message: "Letters, numbers and simple punctuation only." };
  if (blocked(text)) return { ok: false, message: "That title isn't allowed." };
  return { ok: true, text };
}

export function cleanMessage(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (text.length < 2 || text.length > 100) return { ok: false, message: "A message is 2 to 100 characters." };
  if (/https?:|www\.|\.(com|net|org|gg|tv|io|ly)\b/i.test(text)) return { ok: false, message: "No links in a profile message." };
  if (!/^[\p{L}\p{N}\p{Extended_Pictographic}‍️ .,'"!?&#+\-:;()/@%$*~]+$/u.test(text)) return { ok: false, message: "Letters, numbers, emoji and simple punctuation only." };
  if (blocked(text)) return { ok: false, message: "That message isn't allowed." };
  return { ok: true, text };
}

const PLAYER_LEAGUES = new Set(["nfl", "mlb", "nba"]);
/** A player chosen in the browser from ESPN's search. The photo URL is
    built here from the league and id, never taken from the request. */
export function cleanPlayer(raw) {
  const id = String(raw?.id || "").trim();
  const league = String(raw?.league || "").toLowerCase().trim();
  const name = String(raw?.name || "").replace(/\s+/g, " ").trim();
  const team = String(raw?.team || "").replace(/\s+/g, " ").trim();
  const position = String(raw?.position || "").trim();
  if (!/^\d{1,10}$/.test(id)) return { ok: false, message: "Pick a player from the list." };
  if (!PLAYER_LEAGUES.has(league)) return { ok: false, message: "NFL, MLB or NBA players only." };
  if (!/^[\p{L} .'\-]{2,40}$/u.test(name)) return { ok: false, message: "That player's name didn't come through." };
  return {
    ok: true,
    player: {
      id, league, name,
      team: /^[\p{L}\p{N} .'&\-]{0,40}$/u.test(team) ? team : "",
      position: /^[A-Za-z0-9/]{0,6}$/.test(position) ? position.toUpperCase() : "",
      headshot: `https://a.espncdn.com/i/headshots/${league}/players/full/${id}.png`
    }
  };
}

export async function mineFor(db, userId) {
  const [owned, row] = await Promise.all([
    ownedItems(db, userId),
    db.prepare(`SELECT * FROM user_cosmetics WHERE user_id = ?`).bind(String(userId)).first()
  ]);
  const equipped = {};
  for (const slot of Object.keys(SLOTS)) equipped[slot] = row?.[slot] && owned.has(row[slot]) ? String(row[slot]) : null;
  return {
    owned: [...owned],
    equipped,
    titleText: row?.title_text ? String(row.title_text) : "",
    messageText: row?.message_text ? String(row.message_text) : "",
    player: parsePlayer(row?.player_json)
  };
}
