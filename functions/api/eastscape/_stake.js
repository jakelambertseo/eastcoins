/* TICKET STAKES (2026-09-19) — a casino bet staked by the house instead of the player's wallet.

   In GambaScape a player may bet TICKETS (what kills and catches pay) at a
   real table: 1,000 tickets stand in for 1 ZCoin, and the bet pays out in
   real ZCoins like any other. The tickets live on the game server, so the
   stake reaches a bet endpoint as a VOUCHER:

     1. The game server takes the tickets off the character, saves, and
        asks /api/eastscape/exchange { op:"stake" } for a voucher of N
        ZCoins. That endpoint is the authority on the hourly allowance.
     2. The page sends the voucher's id with an ordinary bet
        ({ stake: 5, voucher: "s…" }).
     3. The bet endpoint calls stakeFor(): a conditional UPDATE moves the
        voucher OPEN -> USED for THIS user and THIS amount, and only the
        request whose UPDATE changes a row may skip the wallet debit.

   Nothing else about the bet changes: same limits, same seed, same edge
   draw, same payout, same rows, same hourly cap. The only difference is
   that no WAGER_DEBIT is written, because no ZCoin left the wallet — the
   voucher row IS the record of the stake, and the dashboard reads this
   table to show how much of the casino's "stake" was house money.

   A voucher can be used once, by one person, for one amount. If the bet's
   own row fails to insert, the endpoint reopens the voucher instead of
   refunding ZCoins. An unused voucher stays OPEN and the game server hands
   the same one back rather than charging tickets again. */

let ready = false;
export async function ensureStakes(db) {
  if (ready) return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS gamba_stakes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    zc INTEGER NOT NULL CHECK (zc >= 1),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','USED')),
    game TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    used_at TEXT
  )`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_gamba_stakes_user ON gamba_stakes (user_id, created_at)`).run();
  ready = true;
}

/**
 * What pays for this bet. `null`: the wallet, as always (no voucher was sent).
 * { ok:true, id }: the voucher was claimed, skip the debit.
 * { ok:false }: a voucher was sent and it is not good for this bet; refuse, touch nothing.
 * Call it at the moment the debit would happen, AFTER every limit check, so a refused bet never spends a voucher.
 */
export async function stakeFor(db, userId, body, amount, game) {
  const id = body && body.voucher != null ? String(body.voucher) : "";
  if (!id) return null;
  if (!/^[a-z0-9_-]{8,64}$/i.test(id)) return { ok: false };
  await ensureStakes(db);
  const put = await db
    .prepare(`UPDATE gamba_stakes SET status = 'USED', used_at = datetime('now'), game = ? WHERE id = ? AND user_id = ? AND zc = ? AND status = 'OPEN'`)
    .bind(String(game), id, String(userId), amount)
    .run();
  return put.meta?.changes === 1 ? { ok: true, id } : { ok: false };
}

/** The bet could not be written after all: the voucher is good again. */
export async function reopenStake(db, id) {
  await db.prepare(`UPDATE gamba_stakes SET status = 'OPEN', used_at = NULL, game = NULL WHERE id = ? AND status = 'USED'`).bind(id).run();
}

export const BAD_VOUCHER = "That ticket stake isn't good for this bet. Nothing was taken; try again.";
