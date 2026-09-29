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

/* WHO CAN DO WHAT (2026-09-21). Three roles and nothing else: admin, mod, everybody else.

   The line between admin and mod is MINTING versus STEWARDING. A mod keeps order — they can see anyone's numbers, mute,
   kick, save and restart. They cannot create value or rewrite somebody's progress: giving items, giving xp, setting
   levels, clearing an inventory and resetting a character are all admin-only, because those are the ones that either
   print into the economy or destroy something a player earned, and neither is recoverable by the person holding the
   button. God mode, heal and speed are admin-only for a different reason — they change the game for the person using
   them rather than for anyone else.

   This is the one place the roles are decided; everything downstream asks. Moving a tool between the two is a single
   line in MOD_TOOLS below. */
export const EASTSCAPE_ADMINS = new Set(["bootypaper"]);
export const EASTSCAPE_MODS = new Set(["kellzifer"]);

/** "admin" | "mod" | "user" — an admin is also a mod for every purpose. */
export function roleOf(login) {
  const l = String(login || "").toLowerCase();
  if (EASTSCAPE_ADMINS.has(l)) return "admin";
  if (EASTSCAPE_MODS.has(l)) return "mod";
  return "user";
}
export const isAdminLogin = (login) => roleOf(login) === "admin";
export const isModLogin = (login) => roleOf(login) !== "user";

/* The admin-panel commands a MOD may run. Anything not in here is admin-only.
   `mute`, `unmute` and `kick` are the chat tools and exist for mods first. */
export const MOD_TOOLS = new Set([
  "stats",        // their own and anyone else's — you cannot moderate what you cannot see
  "saveall",      // safe, and what you want to do before a restart
  "restart",      // announced with a countdown, never instant; see the note on the case
  "tp",           // move THEMSELVES to wherever the trouble is
  "mute", "unmute", "kick"
]);
export const canRun = (role, cmd) => role === "admin" || (role === "mod" && MOD_TOOLS.has(cmd));

export function randomTicket() {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
