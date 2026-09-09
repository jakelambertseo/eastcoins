/* ============================================================
   Movies & TV — members only

   The catalog is for people logged in with Twitch. Every screen
   endpoint asks this first; the page itself shows a login prompt
   instead of the shelves when there is no session, so a visitor
   never sees a half-built page or a bare error.
   ============================================================ */

import { getSessionUser } from "../picks/_lib.js";

/** The session user, or a 401 Response to return as-is. */
export async function requireLogin(context) {
  const db = context.env.PICKS_DB;
  const user = db ? await getSessionUser(db, context.request) : null;
  if (user) return { user, denied: null };
  return {
    user: null,
    denied: Response.json(
      { ok: false, code: "NOT_AUTHENTICATED", message: "Log in with Twitch to browse Movies & TV." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  };
}
