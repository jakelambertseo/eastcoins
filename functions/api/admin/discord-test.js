/* ============================================================
   POST /api/admin/discord-test — one sample card to the webhook

   Owner only. Posts a clearly-labelled test card so the channel,
   the look and the permissions can be checked without waiting for
   a real pick. Nothing is written to the database.
   ============================================================ */

import { getSessionUser, json } from "../picks/_lib.js";
import { discordEnabled, postDiscord, pickEmbed, settledEmbed } from "../picks/_discord.js";

const DASHBOARD_LOGINS = new Set(["bootypaper"]);

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return json({ ok: false, code: "NO_DB" }, 503);
  const user = await getSessionUser(db, context.request);
  if (!user || !DASHBOARD_LOGINS.has(user.login)) return json({ ok: false, code: "NOT_ALLOWED" }, 403);
  if (!discordEnabled(context.env)) return json({ ok: false, code: "NOT_CONFIGURED", message: "DISCORD_LEDGER_WEBHOOK is not set." });

  const market = { sport: "american-football", away_name: "Seattle Seahawks", home_name: "New England Patriots", starts_at: new Date(Date.now() + 3600 * 1000).toISOString() };
  const pick = pickEmbed({
    user: { login: user.login, displayName: user.displayName },
    market,
    pick: { team: "Seattle Seahawks", opponent: "New England Patriots", odds: 152, wager: 20, returnsIfWon: 50, allIn: false }
  });
  const final = settledEmbed({
    action: "settled", outcome: "home", sport: "american-football",
    away: "Seattle Seahawks", home: "New England Patriots", winnerName: "New England Patriots",
    slug: "seahawks-patriots-test", awayScore: 17, homeScore: 24, won: 1, lost: 1, refunded: 0, failed: 0, paid: 15,
    lines: [
      { name: user.displayName, team: "New England Patriots", odds: -180, wager: 10, status: "WON", profit: 5 },
      { name: "Someone", team: "Seattle Seahawks", odds: 152, wager: 20, status: "LOST", profit: -20 }
    ]
  });
  for (const e of [pick, final]) e.footer = { text: `TEST CARD — not a real pick · ${e.footer?.text || ""}` };

  const sent = await postDiscord(context.env, [pick, final], "🧪 Test from the EastCoin dashboard — these two cards are samples, nothing was wagered.");
  return json({ ok: sent.ok, error: sent.error || null });
}
