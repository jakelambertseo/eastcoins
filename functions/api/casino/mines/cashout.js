/* POST /api/casino/mines/cashout  { id }

   Ends a live board and pays stake × multiplier. Needs at least one
   safe tile — a fresh board is not a bet you can walk away from with
   the stake back. Idempotent per game. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensureMines, bombsFor, publicGame, cashOut } from "./_mines.js";

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
  const g = await db.prepare(`SELECT * FROM mines_games WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (!g) return fail("NO_GAME", "No such board.", 404);
  if (g.status !== "LIVE") return fail("NOT_LIVE", "That board is finished.", 409);
  if (JSON.parse(g.picks || "[]").length < 1) return fail("TOO_EARLY", "Uncover a tile before cashing out.", 409);

  const paid = await cashOut(context.env, db, g, user.login);
  if (!paid.ok) return fail(paid.code, paid.code === "DUPLICATE" ? "That board is already being paid." : "Couldn't pay the board out — a moderator has been notified.", paid.code === "DUPLICATE" ? 409 : 502);

  const done = await db.prepare(`SELECT * FROM mines_games WHERE id = ?`).bind(id).first();
  const bombs = await bombsFor(done.seed, Number(done.mines));
  return json({ ok: true, payout: paid.payout, balance: paid.balance, game: publicGame(done, { bombs }) });
}
