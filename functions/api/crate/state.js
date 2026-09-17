/* GET /api/crate/state

   Whether the caller's free crate is ready (and when it is back), the
   price of another, the odds and tiers for the panel, and the last
   few pulls for the "recent" list. One read when the nav loads for a
   member; the panel never polls. */

import { getSessionUser, json, fail } from "../picks/_lib.js";
import { ensureStore, ownedItems, itemById } from "../store/_store.js";
import { ensureCrate, PRICE, ODDS, COINS, COIN_SHARE, TIERS, tierItems, lastFreeAt, nextFreeAt } from "./_crate.js";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The crate is offline right now.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to open a crate.", 401);
  await ensureStore(db);
  await ensureCrate(db);

  const [last, owned, recent, mine] = await Promise.all([
    lastFreeAt(db, user.id),
    ownedItems(db, user.id),
    db.prepare(`SELECT c.rarity, c.prize, c.coins, c.created_at, u.twitch_login, u.display_name, u.avatar_url
                  FROM crate_opens c JOIN users u ON u.twitch_id = c.user_id ORDER BY c.created_at DESC LIMIT 7`).all().catch(() => ({ results: [] })),
    db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(coins), 0) AS coins FROM crate_opens WHERE user_id = ?`).bind(user.id).first().catch(() => null)
  ]);
  const next = nextFreeAt(last);
  const tiers = Object.fromEntries(TIERS.map((t) => [t, {
    odds: ODDS[t], coins: COINS[t], coinShare: COIN_SHARE[t],
    items: tierItems(t).map((i) => ({ id: i.id, name: i.name, slot: i.slot, owned: owned.has(i.id) }))
  }]));
  return json({
    ok: true,
    price: PRICE,
    freeReady: !next || next <= Date.now(),
    nextFreeAt: next ? new Date(next).toISOString() : null,
    tiers,
    mine: { opened: Number(mine?.n || 0), coins: Number(mine?.coins || 0) },
    recent: (recent.results || []).map((r) => {
      const item = itemById(String(r.prize));
      return {
        rarity: r.rarity, coins: Number(r.coins || 0), prize: item ? item.name : `${Number(r.coins || 0)} ZC`, slot: item ? item.slot : null,
        at: String(r.created_at).replace(" ", "T") + "Z",
        who: { login: String(r.twitch_login || "").toLowerCase(), displayName: String(r.display_name || r.twitch_login || ""), avatar: String(r.avatar_url || "") }
      };
    })
  }, 200, { "Cache-Control": "no-store" });
}
