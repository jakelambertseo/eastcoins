/* POST /api/store/equip  { slot, item }        switch an owned item on
   POST /api/store/equip  { slot, item: null }  switch that slot off
   With the items that need input:
     { slot: "title",   item: "title-custom",   text }
     { slot: "message", item: "message-custom", text }
     { slot: "player",  item: "player-pick",    player: { id, league, name, team, position } }

   Only items the person owns, only into their own slot. Free. */

import { getSessionUser, json, fail } from "../picks/_lib.js";
import { SLOTS, ensureStore, itemById, ownedItems, cleanTitle, cleanMessage, cleanPlayer, mineFor } from "./_store.js";

// The extra column a slot writes alongside its item id, if any.
const EXTRA = { title: "title_text", message: "message_text", player: "player_json" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "The store is offline right now.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch first.", 401);
  await ensureStore(db);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const slot = String(body.slot || "");
  if (!Object.prototype.hasOwnProperty.call(SLOTS, slot)) return fail("BAD_SLOT", "That isn't something you can change.");

  let value = null;
  let extra;   // undefined = leave the extra column alone
  if (body.item) {
    const item = itemById(String(body.item));
    if (!item || item.slot !== slot) return fail("BAD_ITEM", "That item doesn't go there.");
    if (!(await ownedItems(db, user.id)).has(item.id)) return fail("NOT_OWNED", `You don't own ${item.name} yet.`, 403);
    value = item.id;
    if (item.id === "title-custom") {
      const t = cleanTitle(body.text);
      if (!t.ok) return fail("BAD_TITLE", t.message);
      extra = t.text;
    } else if (item.id === "message-custom") {
      const m = cleanMessage(body.text);
      if (!m.ok) return fail("BAD_MESSAGE", m.message);
      extra = m.text;
    } else if (item.id === "player-pick") {
      const p = cleanPlayer(body.player);
      if (!p.ok) return fail("BAD_PLAYER", p.message);
      extra = JSON.stringify(p.player);
    }
  }

  // `slot` is a SLOTS key checked above and EXTRA is a fixed map, so both
  // are safe as column names.
  const extraCol = EXTRA[slot];
  const writeExtra = extraCol && extra !== undefined;
  const cols = writeExtra ? `user_id, ${slot}, ${extraCol}, updated_at` : `user_id, ${slot}, updated_at`;
  const vals = writeExtra ? `?, ?, ?, CURRENT_TIMESTAMP` : `?, ?, CURRENT_TIMESTAMP`;
  const sets = writeExtra ? `${slot} = excluded.${slot}, ${extraCol} = excluded.${extraCol}` : `${slot} = excluded.${slot}`;
  const binds = writeExtra ? [user.id, value, extra] : [user.id, value];
  await db
    .prepare(`INSERT INTO user_cosmetics (${cols}) VALUES (${vals})
              ON CONFLICT (user_id) DO UPDATE SET ${sets}, updated_at = CURRENT_TIMESTAMP`)
    .bind(...binds)
    .run();

  return json({ ok: true, mine: await mineFor(db, user.id) });
}
