/* POST /api/eastscape/ticket — a one-minute, one-use ticket for the game server. Signed in only. */

import { getSessionUser } from "../picks/_lib.js";
import { ensureTickets, randomTicket, isAdminLogin, TICKET_TTL_S } from "./_tickets.js";

const WS_URL = "wss://eastcoin-eastscape.jake-7f5.workers.dev/ws";
const noStore = { "Cache-Control": "no-store" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB", message: "The game is offline right now." }, { status: 503, headers: noStore });
  const user = await getSessionUser(db, context.request);
  if (!user) return Response.json({ ok: false, code: "NOT_AUTHENTICATED", message: "Log in with Twitch to play EastScape." }, { status: 401, headers: noStore });
  await ensureTickets(db);
  const ticket = randomTicket();
  await db.prepare(`INSERT INTO eastscape_tickets (ticket, user_id, login, display, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+${TICKET_TTL_S} seconds'))`)
    .bind(ticket, user.id, user.login, user.displayName).run();
  // sweep old ones now and then; there are only ever a handful
  if (Math.random() < 0.05) context.waitUntil(db.prepare(`DELETE FROM eastscape_tickets WHERE expires_at < datetime('now')`).run().catch(() => {}));
  // the small Twitch picture for the top bar (the site stores the 300px one; Twitch serves a 70px copy at the same path)
  const row = await db.prepare(`SELECT avatar_url FROM users WHERE twitch_id = ?`).bind(user.id).first().catch(() => null);
  const avatar = row?.avatar_url ? String(row.avatar_url).replace("-300x300.", "-70x70.") : null;
  return Response.json({ ok: true, ticket, ws: WS_URL, login: user.login, name: user.displayName, avatar, admin: isAdminLogin(user.login) }, { headers: noStore });
}
