/* POST /api/casino/hilo/cashout  { id }

   Ends a live run and pays stake × multiplier. Needs at least one
   correct call — a fresh deal is not a bet you can walk away from
   with the stake back. Idempotent per game. */

import { getSessionUser, json, fail } from "../../picks/_lib.js";
import { ensureSchema } from "../_engine.js";
import { ensureHilo, publicGame, cashOut } from "./_hilo.js";

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Casino is offline right now.", 503);
  await ensureSchema(db);
  await ensureHilo(db);

  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_LOGGED_IN", "Log in with Twitch to play.", 401);

  let body = {};
  try { body = await context.request.json(); } catch { body = {}; }
  const id = String(body.id || "").trim();
  const g = await db.prepare(`SELECT * FROM hilo_games WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
  if (!g) return fail("NO_GAME", "No such run.", 404);
  if (g.status !== "LIVE") return fail("NOT_LIVE", "That run is over.", 409);
  if (JSON.parse(g.calls || "[]").length < 1) return fail("TOO_EARLY", "Make at least one call before cashing out.", 409);

  const paid = await cashOut(context.env, db, g, user.login);
  if (!paid.ok) return fail(paid.code, paid.code === "DUPLICATE" ? "That run is already being paid." : "Couldn't pay the run out — a moderator has been notified.", paid.code === "DUPLICATE" ? 409 : 502);
  const done = await db.prepare(`SELECT * FROM hilo_games WHERE id = ?`).bind(id).first();
  return json({ ok: true, payout: paid.payout, balance: paid.balance, game: publicGame(done) });
}
