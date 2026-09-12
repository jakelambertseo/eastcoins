/* POST /api/casino/mines/pick  { id, tile }

   Uncovers one tile of a live board. A safe tile raises the
   multiplier; a bomb ends the run and the stake is gone. The board
   was fixed by the seed before the first tile was touched.

   Clearing every safe tile, or reaching the last rung under the ×50
   ceiling, pays out on the spot. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensureMines, bombsFor, multiplierFor, topRung, publicGame, cashOut, TILES } from "./_mines.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensureMines(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const id = String(body.id || "").trim();
  const tile = Math.floor(Number(body.tile));
  if (!Number.isInteger(tile) || tile < 0 || tile >= TILES) return fail("BAD_TILE", "That isn't one of the tiles.");

  const g = await db.prepare(`SELECT * FROM mines_games WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (!g) return fail("NO_GAME", "No such board.", 404);
  if (g.status !== "LIVE") return fail("NOT_LIVE", "That board is finished.", 409);

  const picks = JSON.parse(g.picks || "[]");
  if (picks.includes(tile)) return fail("ALREADY_PICKED", "That tile is already uncovered.", 409);

  const bombs = await bombsFor(g.seed, Number(g.mines));

  if (bombs.includes(tile)) {
    // The lock: only a LIVE row can be busted, once.
    const r = await db
      .prepare(`UPDATE mines_games SET picks = ?, status = 'BUST', payout = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE'`)
      .bind(JSON.stringify([...picks, tile]), id)
      .run();
    if (!r.meta?.changes) return fail("NOT_LIVE", "That board is finished.", 409);
    const done = await db.prepare(`SELECT * FROM mines_games WHERE id = ?`).bind(id).first();
    return json({ ok: true, outcome: "bomb", tile, game: publicGame(done, { bombs }) });
  }

  const newPicks = [...picks, tile];
  const multiplier = multiplierFor(Number(g.mines), newPicks.length);
  // Guarded on the old picks so a double-tap cannot count twice.
  const r = await db
    .prepare(`UPDATE mines_games SET picks = ?, multiplier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'LIVE' AND picks = ?`)
    .bind(JSON.stringify(newPicks), multiplier, id, g.picks)
    .run();
  if (!r.meta?.changes) return fail("RACE", "That tile was already turned — refresh.", 409);

  // Out of road: either every safe tile is uncovered, or the next rung
  // would pass the ceiling. Either way this run pays out here.
  const cleared = newPicks.length >= TILES - Number(g.mines);
  if (cleared || newPicks.length >= topRung(Number(g.mines))) {
    const fresh = await db.prepare(`SELECT * FROM mines_games WHERE id = ?`).bind(id).first();
    const paid = await cashOut(context.env, db, fresh, user.login);
    const done = await db.prepare(`SELECT * FROM mines_games WHERE id = ?`).bind(id).first();
    return json({
      ok: true, outcome: "safe", tile, cleared,
      autoCashed: paid.ok, payout: paid.payout || 0, balance: paid.balance ?? null,
      game: publicGame(done, { bombs })
    });
  }

  const live = await db.prepare(`SELECT * FROM mines_games WHERE id = ?`).bind(id).first();
  return json({ ok: true, outcome: "safe", tile, game: publicGame(live) });
}
