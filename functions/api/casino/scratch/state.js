/* GET /api/casino/scratch/state — the prize table, the hash of the seed
   the caller's next card will use, their record, the room, and the
   recent cards everyone can see. */

import { getSessionUser, walletWritesEnabled } from "../../picks/_lib.js";
import { ensureSchema, touchPresence, roomFor, hourlyNet, HOUR_WIN_CAP } from "../_engine.js";
import { ensureScratch, commitFor, oddsTable, publicCard, cardsLastHour, prizeFor, CELLS, RETURN, WIN_CHANCE, MAX_MULTIPLIER, MAX_BET, MIN_BET, MAX_BETS_PER_HOUR } from "./_scratch.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const SCRATCH = { key: "scratch" };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);
  await ensureScratch(db);

  const now = Date.now();
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, SCRATCH, user.id, now);

  // The commitment is made on arrival, so the hash is always shown
  // before the card it decides.
  const commit = user ? await commitFor(db, user.id) : null;

  const recent = await db
    .prepare(
      `SELECT c.id, c.stake, c.prize, c.multiplier, c.payout, c.created_at,
              u.twitch_id, u.twitch_login, u.display_name, u.avatar_url
         FROM scratch_cards c JOIN users u ON u.twitch_id = c.user_id
        ORDER BY c.created_at DESC LIMIT 40`
    )
    .all();
  const ledger = (recent.results || []).map((r) => ({
    id: r.id,
    user: { id: String(r.twitch_id), login: String(r.twitch_login).toLowerCase(), displayName: String(r.display_name || r.twitch_login), avatar: String(r.avatar_url || "") },
    stake: Number(r.stake),
    prize: r.prize || null,
    prizeName: prizeFor(r.prize)?.name || null,
    multiplier: Number(r.multiplier || 0),
    payout: Number(r.payout || 0),
    profit: Number(r.payout || 0) - Number(r.stake),
    at: String(r.created_at).replace(" ", "T") + "Z"
  }));

  let me = null;
  let last = null;
  if (user) {
    const t = await db
      .prepare(
        `SELECT COUNT(*) AS cards,
                SUM(CASE WHEN payout > stake THEN 1 ELSE 0 END) AS wins,
                COALESCE(SUM(payout - stake), 0) AS net,
                MAX(multiplier) AS best
           FROM scratch_cards WHERE user_id = ?`
      )
      .bind(user.id)
      .first();
    me = {
      id: user.id, login: user.login, displayName: user.displayName,
      cards: Number(t?.cards || 0),
      wins: Number(t?.wins || 0),
      losses: Number(t?.cards || 0) - Number(t?.wins || 0),
      net: Number(t?.net || 0),
      best: Number(t?.best || 0),
      cardsThisHour: await cardsLastHour(db, user.id),
      hourNet: await hourlyNet(db, user.id)
    };
    const lastRow = await db.prepare(`SELECT * FROM scratch_cards WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).bind(user.id).first();
    last = lastRow ? publicCard(lastRow) : null;
  }

  return json({
    ok: true,
    now,
    config: {
      cells: CELLS, prizes: oddsTable(), maxMultiplier: MAX_MULTIPLIER,
      returnPct: Math.round(RETURN * 1000) / 10, winChance: Math.round(WIN_CHANCE * 1000) / 10,
      maxBet: MAX_BET, minBet: MIN_BET, maxPerHour: MAX_BETS_PER_HOUR, hourCap: HOUR_WIN_CAP,
      canBet: Boolean(user) && walletWritesEnabled(context.env)
    },
    nextHash: commit ? commit.hash : null,
    last,
    ledger,
    room: await roomFor(db, SCRATCH, now),
    me
  });
}
