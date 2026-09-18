/* POST /api/eastscape/verify {ticket} — called by the game server, never by a page.
   Spends the ticket and says whose it was. */

import { ensureTickets, isAdminLogin } from "./_tickets.js";

const noStore = { "Cache-Control": "no-store" };

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return Response.json({ ok: false }, { status: 503, headers: noStore });
  let ticket = "";
  try { ticket = String((await context.request.json()).ticket || ""); } catch (e) { /* bad body */ }
  if (!/^[0-9a-f]{64}$/.test(ticket)) return Response.json({ ok: false }, { status: 400, headers: noStore });
  await ensureTickets(db);
  // one use: the row is deleted as it's read, so two connections can't share a ticket
  const row = await db.prepare(`DELETE FROM eastscape_tickets WHERE ticket = ? AND expires_at > datetime('now') RETURNING user_id, login, display`).bind(ticket).first();
  if (!row) return Response.json({ ok: false }, { status: 401, headers: noStore });
  return Response.json({ ok: true, user: { id: String(row.user_id), login: row.login, name: row.display, admin: isAdminLogin(row.login) } }, { headers: noStore });
}
