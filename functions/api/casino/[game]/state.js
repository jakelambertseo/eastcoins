/* GET /api/casino/<game>/state — everything a shared-round game page
   shows, in one poll. Settles what is due on the way, so the first
   poll after a round closes is what pays the winners. */

import { getSessionUser, walletWritesEnabled } from "../../picks/_lib.js";
import { gameFor, ensureSchema, roundAt, ensureRound, settleRound, betsFor, roomFor, touchPresence, betsLastHour, publicConfig } from "../_engine.js";

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  const game = gameFor(context.params.game);
  if (!game) return json({ ok: false, code: "NO_SUCH_GAME" }, 404);
  await ensureSchema(db);

  const now = Date.now();
  const round = roundAt(game, now);
  const user = await getSessionUser(db, context.request);
  if (user) await touchPresence(db, game, user.id, now);

  const row = await ensureRound(db, game, round.no);
  const settledNow = round.phase === "result" ? await settleRound(context.env, db, game, round.no, now) : null;
  await settleRound(context.env, db, game, round.no - 1, now);

  const [bets, last, room, prevRow] = await Promise.all([
    betsFor(db, game, round.no),
    betsFor(db, game, round.no - 1),
    roomFor(db, game, now),
    db.prepare(`SELECT no, result, seed, hash FROM casino_rounds WHERE game = ? AND no = ?`).bind(game.key, round.no - 1).first()
  ]);
  const mine = user ? bets.find((b) => b.user.id === user.id) || null : null;
  const result = settledNow || parse(row.result);

  return json({
    ok: true,
    now,
    config: publicConfig(game, Boolean(user) && walletWritesEnabled(context.env)),
    round: {
      no: round.no, phase: round.phase, opensAt: round.opensAt, closesAt: round.closesAt, endsAt: round.endsAt,
      hash: row.hash,
      result,
      seed: result ? row.seed : null
    },
    bets,
    last: prevRow ? { no: prevRow.no, result: parse(prevRow.result), hash: prevRow.hash, seed: prevRow.seed, bets: last } : null,
    room,
    me: user ? { id: user.id, login: user.login, displayName: user.displayName, bet: mine, betsThisHour: await betsLastHour(db, game, user.id) } : null
  });
}
