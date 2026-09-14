/* ============================================================
   EastCoin — banned accounts

   A ban here is the full one: the account cannot hold a session,
   so every signed-in feature refuses at once and a fresh sign-in
   is turned away at the Twitch callback. It does NOT hide the
   public site — a banned person browsing signed out sees what any
   stranger sees, which is the same thing a logged-out visitor gets.

   Deliberately NOT done by a ban:

     - Nothing is taken. ZCoins live in StreamElements and are not
       touched; a ban is about access, not confiscation.
     - Picks already locked still settle and still pay. They were
       paid for before the ban and the book has to balance.
     - Nothing is posted anywhere. The record lives here and on the
       All Users page for admins; a ban is not an announcement.

   The row is the audit trail: who did it, when, and why. Lifting a
   ban keeps the row and marks it lifted rather than deleting it, so
   "has this person been banned before" stays answerable.

   Admins cannot be banned. That rule lives in the endpoint AND is
   worth keeping in mind here: the enforcement path must never be
   able to lock every admin out of the site at once.
   ============================================================ */

let ready = false;

export async function ensureBans(db) {
  if (ready) return;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_bans (
         user_id TEXT PRIMARY KEY,
         login TEXT NOT NULL,
         banned INTEGER NOT NULL DEFAULT 1,
         reason TEXT NOT NULL DEFAULT '',
         by_login TEXT NOT NULL DEFAULT '',
         created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
         lifted_at TEXT,
         lifted_by TEXT
       )`
    )
    .run();
  ready = true;
}

/**
 * Whether this account is banned right now.
 *
 * Fails OPEN on purpose. If the lookup itself breaks — the table is
 * missing on a fresh database, D1 is refusing reads — the answer is
 * "not banned". The alternative is that one broken query signs out
 * every single person on the site, which is a far worse failure than
 * one banned account getting back in until it is fixed.
 */
export async function isBanned(db, userId) {
  try {
    const row = await db
      .prepare(`SELECT 1 AS hit FROM user_bans WHERE user_id = ? AND banned = 1 LIMIT 1`)
      .bind(String(userId))
      .first();
    return Boolean(row);
  } catch {
    return false;
  }
}

/** The full row, for the admin screens. Null when never banned. */
export async function banRow(db, userId) {
  try {
    return await db.prepare(`SELECT * FROM user_bans WHERE user_id = ?`).bind(String(userId)).first();
  } catch {
    return null;
  }
}

/** Every currently-banned user id, for lists that show many people at once. */
export async function bannedIds(db) {
  try {
    const rows = await db.prepare(`SELECT user_id FROM user_bans WHERE banned = 1`).all();
    return new Set((rows.results || []).map((r) => String(r.user_id)));
  } catch {
    return new Set();
  }
}

/**
 * Bans or unbans one account. Returns the row as it now stands.
 *
 * Banning also drops their sessions, so the block is felt on the next
 * request rather than whenever the cookie happened to expire.
 */
export async function setBan(db, { userId, login, banned, reason, byLogin }) {
  await ensureBans(db);
  const id = String(userId);
  if (banned) {
    await db
      .prepare(
        `INSERT INTO user_bans (user_id, login, banned, reason, by_login, created_at, lifted_at, lifted_by)
         VALUES (?, ?, 1, ?, ?, CURRENT_TIMESTAMP, NULL, NULL)
         ON CONFLICT(user_id) DO UPDATE SET
           banned = 1, login = excluded.login, reason = excluded.reason,
           by_login = excluded.by_login, created_at = CURRENT_TIMESTAMP,
           lifted_at = NULL, lifted_by = NULL`
      )
      .bind(id, String(login || "").toLowerCase(), String(reason || ""), String(byLogin || ""))
      .run();
    // Out now, not at cookie expiry.
    await db.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id).run().catch(() => {});
  } else {
    await db
      .prepare(
        `UPDATE user_bans
            SET banned = 0, lifted_at = CURRENT_TIMESTAMP, lifted_by = ?
          WHERE user_id = ?`
      )
      .bind(String(byLogin || ""), id)
      .run();
  }
  return banRow(db, id);
}

export function publicBan(row) {
  if (!row) return null;
  return {
    banned: Number(row.banned) === 1,
    reason: String(row.reason || ""),
    by: String(row.by_login || ""),
    at: String(row.created_at || "").replace(" ", "T") + "Z",
    liftedAt: row.lifted_at ? String(row.lifted_at).replace(" ", "T") + "Z" : null,
    liftedBy: row.lifted_by || null
  };
}
