/* POST /api/store/equip  { slot, item }        switch an owned item on
   POST /api/store/equip  { slot, item: null }  switch that slot off
   POST /api/store/equip  { slot: "title", item: "title-custom", text }

   Only items the person owns, only into their own slot. Free. */

import { getSessionUser, json, fail } from "../picks/_lib.js";
import { SLOTS, ensureStore, itemById, ownedItems, cleanTitle, mineFor } from "./_store.js";

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
  let titleText = null;
  if (body.item) {
    const item = itemById(String(body.item));
    if (!item || item.slot !== slot) return fail("BAD_ITEM", "That item doesn't go there.");
    if (!(await ownedItems(db, user.id)).has(item.id)) return fail("NOT_OWNED", `You don't own ${item.name} yet.`, 403);
    value = item.id;
    if (slot === "title") {
      const t = cleanTitle(body.text);
      if (!t.ok) return fail("BAD_TITLE", t.message);
      titleText = t.text;
    }
  }

  // `slot` is one of the SLOTS keys checked above, so it is safe as a column name.
  const extra = slot === "title" ? ", title_text = excluded.title_text" : "";
  await db
    .prepare(`INSERT INTO user_cosmetics (user_id, ${slot}, title_text, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT (user_id) DO UPDATE SET ${slot} = excluded.${slot}${extra}, updated_at = CURRENT_TIMESTAMP`)
    .bind(user.id, value, slot === "title" ? titleText : null)
    .run();

  return json({ ok: true, mine: await mineFor(db, user.id) });
}
