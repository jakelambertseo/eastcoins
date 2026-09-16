/* ============================================================
   Members only

   Built for Movies & TV; since 2026-09-16 the same door stands in
   front of MultiView, Picks and the casino too. Every screen endpoint
   asks this first, and so does the Picks ledger; the pages themselves
   show a login prompt instead of their content when there is no
   session, so a visitor never sees a half-built page or a bare error.
   ============================================================ */

import { getSessionUser } from "../picks/_lib.js";

/** The session user, or a 401 Response to return as-is. */
export async function requireLogin(context, message = "Log in with Twitch to browse Movies & TV.") {
  const db = context.env.PICKS_DB;
  const user = db ? await getSessionUser(db, context.request) : null;
  if (user) return { user, denied: null };
  return {
    user: null,
    denied: Response.json(
      { ok: false, code: "NOT_AUTHENTICATED", message },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    )
  };
}
