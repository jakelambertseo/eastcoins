/* POST /api/eastscape/verify {ticket} — called by the game server, never by a page.
   Spends the ticket and says whose it was. */

import { ensureTickets, isAdminLogin } from "./_tickets.js";
import { cosmeticsFor } from "../store/_store.js";

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
  /* WHAT THEY BOUGHT IN THE STORE, OVER THEIR HEAD IN THE GAME (2026-09-20): the name colour and the title a member has switched
     on, read once here at login (cosmeticsFor already checks they still own it). Read-only, and a store that won't answer
     must never stop a login: any failure just means a plain name. Nothing else about the member is sent. */
  let cos = null;
  try { const c = await cosmeticsFor(db, String(row.user_id)); if (c && (c.name || c.title)) cos = { name: c.name || null, title: c.title ? String(c.title).slice(0, 24) : null }; } catch (e) { /* plain name */ }
  return Response.json({ ok: true, user: { id: String(row.user_id), login: row.login, name: row.display, admin: isAdminLogin(row.login), cos } }, { headers: noStore });
}
