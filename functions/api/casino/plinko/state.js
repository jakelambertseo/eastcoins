/* GET /api/casino/plinko/state — the board, the hash of the seed the
   caller's next drop will use, their record, the room, and the recent
   drops everyone can see. */

import { getSessionUser, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, roomFor, hourlyNet, HOUR_WIN_CAP } from "../_engine.js";
import { ensurePlinko, commitFor, oddsTable, publicDrop, dropsLastHour, ROWS, BUCKETS, PAYOUTS, MAX_MULTIPLIER, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_plinko.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const PLINKO = { key: "plinko" };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensurePlinko(db);

  const now = Date.now();
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, PLINKO, user.id, now);

  // The commitment is made on arrival, so the hash is always shown
  // before the drop it decides.
  const commit = user ? await commitFor(db, user.id) : null;

  const recent = await db
    .prepare(
      `SELECT d.id, d.stake, d.bucket, d.multiplier, d.payout, d.created_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM plinko_drops d JOIN users u ON u.twitch_id = d.user_id
        ORDER BY datetime(d.created_at) DESC LIMIT 40`
    )
    .all();
  const ledger = (recent.results || []).map((r) => ({
    id: r.id,
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    stake: Number(r.stake),
    bucket: Number(r.bucket),
    multiplier: Number(r.multiplier),
    payout: Number(r.payout || 0),
    profit: Number(r.payout || 0) - Number(r.stake),
    at: String(r.created_at).replace(" ", "T") + "Z"
  }));

  let me = null;
  let last = null;
  if (user) {
    const t = await db
      .prepare(
        `SELECT COUNT(*) AS drops,
                SUM(CASE WHEN payout > stake THEN 1 ELSE 0 END) AS wins,
                COALESCE(SUM(payout - stake), 0) AS net,
                MAX(multiplier) AS best
           FROM plinko_drops WHERE user_id = ?`
      )
      .bind(user.id)
      .first();
    me = {
      id: user.id, login: user.login, displayName: user.displayName,
      drops: Number(t?.drops || 0),
      wins: Number(t?.wins || 0),
      losses: Number(t?.drops || 0) - Number(t?.wins || 0),
      net: Number(t?.net || 0),
      best: Number(t?.best || 0),
      dropsThisHour: await dropsLastHour(db, user.id),
      hourNet: await hourlyNet(db, user.id)
    };
    const lastRow = await db.prepare(`SELECT * FROM plinko_drops WHERE user_id = ? ORDER BY datetime(created_at) DESC LIMIT 1`).bind(user.id).first();
    last = lastRow ? publicDrop(lastRow) : null;
  }

  return json({
    ok: true,
    now,
    config: {
      rows: ROWS, buckets: BUCKETS, payouts: PAYOUTS, maxMultiplier: MAX_MULTIPLIER,
      maxBet: MAX_BET, minBet: MIN_BET, maxPerHour: MAX_BETS_PER_HOUR, hourCap: HOUR_WIN_CAP,
      odds: oddsTable(),
      canBet: Boolean(user) && walletWritesEnabled(context.env)
    },
    // Shown before the drop; the seed behind it is revealed with the result.
    nextHash: commit ? commit.hash : null,
    last,
    ledger,
    room: await roomFor(db, PLINKO, now),
    me
  });
}
