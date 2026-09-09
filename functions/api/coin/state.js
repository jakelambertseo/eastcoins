/* GET /api/coin/state — everything the coin-flip page shows, in one poll.

   Settles the previous round on the way if it is due: rounds run on
   the clock, so the first poll after a flip is what pays the winners. */

import { getSessionUser, walletWritesEnabled } from "../picks/_lib.js";
import { ensureSchema, roundAt, ensureRound, settleRound, betsFor, roomFor, touchPresence, MAX_BET, MIN_BET, BET_MS, CYCLE_MS } from "./_coin.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  await ensureSchema(db);

  const now = Date.now();
  const round = roundAt(now);
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, user.id, now);

  const row = await ensureRound(db, round.no);

  // Whatever is due: this round once it has flipped, and the one before
  // in case nobody was looking when it flipped.
  const settledNow = round.phase === "result" ? await settleRound(context.env, db, round.no, now) : null;
  await settleRound(context.env, db, round.no - 1, now);

  const [bets, last, room, prevRow] = await Promise.all([
    betsFor(db, round.no),
    betsFor(db, round.no - 1),
    roomFor(db, now),
    db.prepare(`SELECT no, result, seed, hash FROM coin_rounds WHERE no = ?`).bind(round.no - 1).first()
  ]);

  const mine = user ? bets.find((b) => b.user.id === user.id) || null : null;

  return json({
    ok: true,
    now,
    config: { maxBet: MAX_BET, minBet: MIN_BET, betSeconds: BET_MS / 1000, cycleSeconds: CYCLE_MS / 1000,
      canBet: Boolean(user) && walletWritesEnabled(context.env) },
    round: {
      no: round.no,
      phase: round.phase,
      opensAt: round.opensAt,
      flipsAt: round.flipsAt,
      endsAt: round.endsAt,
      hash: row.hash,
      // The seed is a secret until the flip; after it, anyone can check.
      result: settledNow || row.result || null,
      seed: settledNow || row.result ? row.seed : null
    },
    bets,
    last: prevRow ? { no: prevRow.no, result: prevRow.result, hash: prevRow.hash, seed: prevRow.seed, bets: last } : null,
    room,
    me: user ? { id: user.id, login: user.login, displayName: user.displayName, bet: mine } : null
  });
}
