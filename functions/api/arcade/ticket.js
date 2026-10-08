/* POST /api/arcade/ticket — a one-minute, one-use ticket for the Arcade's room server (the Game Lounge and its games). Signed in only.
   The same tickets EastScape uses (eastscape_tickets, checked at /api/eastscape/verify): one Twitch proof, two servers. What differs is
   only the address the page is told to connect to. (2026-10-07) */

import { getSessionUser } from "../picks/_lib.js";
import { ensureTickets, randomTicket, isAdminLogin, TICKET_TTL_S } from "../eastscape/_tickets.js";

const WS_URL = "wss://arcade.eastcoin.vip/ws";
const noStore = { "Cache-Control": "no-store" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false, code: "NO_DB", message: "The arcade is offline right now." }, { status: 503, headers: noStore });
  const user = await getSessionUser(db, context.request);
  if (!user) return Response.json({ ok: false, code: "NOT_AUTHENTICATED", message: "Log in with Twitch to join the lounge." }, { status: 401, headers: noStore });
  await ensureTickets(db);
  const ticket = randomTicket();
  await db.prepare(`INSERT INTO eastscape_tickets (ticket, user_id, login, display, expires_at) VALUES (?, ?, ?, ?, datetime('now', '+${TICKET_TTL_S} seconds'))`)
    .bind(ticket, user.id, user.login, user.displayName).run();
  if (Math.random() < 0.05) context.waitUntil(db.prepare(`DELETE FROM eastscape_tickets WHERE expires_at < datetime('now')`).run().catch(() => {}));
  const row = await db.prepare(`SELECT avatar_url FROM users WHERE twitch_id = ?`).bind(user.id).first().catch(() => null);
  const avatar = row?.avatar_url ? String(row.avatar_url).replace("-300x300.", "-70x70.") : null;
  return Response.json({ ok: true, ticket, ws: WS_URL, login: user.login, name: user.displayName, avatar, admin: isAdminLogin(user.login) }, { headers: noStore });
}
