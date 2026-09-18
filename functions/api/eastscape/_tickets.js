/* ============================================================
   EastScape — getting from a site session to the game server

   The game runs on its own Worker (eastscape-worker, on workers.dev),
   which can't read the site's session cookie. So the page asks
   /api/eastscape/ticket for a ticket (signed in only), hands it to
   the game server when it connects, and the game server asks
   /api/eastscape/verify who it belongs to. A ticket is random, lives
   for a minute and works once. No shared secret to keep anywhere.
   ============================================================ */

export const TICKET_TTL_S = 60;

export async function ensureTickets(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS eastscape_tickets (
    ticket TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    login TEXT NOT NULL,
    display TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`).run();
}

// who gets the in-game admin panel (give xp, items, teleport...). Just the builder while it's being built.
export const EASTSCAPE_ADMINS = new Set(["bootypaper"]);
export const isAdminLogin = (login) => EASTSCAPE_ADMINS.has(String(login || "").toLowerCase());

export function randomTicket() {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
