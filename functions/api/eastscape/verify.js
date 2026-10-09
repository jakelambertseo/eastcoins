/* POST /api/eastscape/verify {ticket} — called by the game server, never by a page.
   Spends the ticket and says whose it was. */

import { ensureTickets, isAdminLogin, roleOf } from "./_tickets.js";
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
  /* THIS is where the game server learns who somebody is — it reads this response, not the ticket it was minted with.
     `role` therefore has to be sent from here or a mod arrives as an ordinary player. `admin` stays beside it because
     older builds of the worker read that alone. */
  /* (2026-10-07) the small Twitch picture, for the Arcade's room server (the lounge shows it beside your name and in its chat). EastScape
     ignores the field. A failed read is just no picture. */
  let avatar = null;
  try { const a = await db.prepare(`SELECT avatar_url FROM users WHERE twitch_id = ?`).bind(String(row.user_id)).first(); if (a?.avatar_url) avatar = String(a.avatar_url).replace("-300x300.", "-70x70."); } catch (e) { /* no picture */ }
  /* (2026-10-10) Blockshot's Armory loadout — the finishes the player wears — so the match server can tell everyone at the table
     without a second round trip. Null when they have never touched the Armory; a failed read is a plain bean. */
  let look = null;
  try { const { ensureArmory, lookOf } = await import("../blockshot/_armory.js"); await ensureArmory(db); look = await lookOf(db, String(row.user_id)); } catch (e) { /* plain */ }
  return Response.json({ ok: true, user: { id: String(row.user_id), login: row.login, name: row.display, admin: isAdminLogin(row.login), role: roleOf(row.login), cos, avatar, look } }, { headers: noStore });
}
