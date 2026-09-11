/* ============================================================
   EastCoin Picks — the ledger, mirrored to Discord

   One webhook (DISCORD_LEDGER_WEBHOOK) and three kinds of card:

     🪙 a pick locked      who backed whom, for how much, what it pays
     🏈 markets opened     the slate with lines, and when it closes
     ✅ a game settled     the score, every pick and what came of it

   It is a mirror of the Community Ledger, nothing more: no balances,
   no private numbers. Without the webhook set every call is a no-op,
   and a failed post is logged, never thrown — a pick or a payout must
   never wait on Discord.
   ============================================================ */

import { slugFor } from "./_slug.js";
import { LEAGUES } from "./_teams.js";
import { isFight, versus } from "./_fights.js";
import { cfbLogo, isCollegeLeague } from "./_cfb.js";

const COLOR = { gold: 0xe8bf35, green: 0x4ddb8b, red: 0xff6b85, grey: 0x8a8580, blue: 0x8fc3d7 };
const SITE = "https://eastcoin.vip";
const AVATAR = `${SITE}/v3/assets/img/zcoin.webp`;
const TIMEOUT_MS = 4000;

const line = (v) => { const n = Number(v); return !Number.isFinite(n) || n === 0 ? "—" : n > 0 ? `+${n}` : `−${Math.abs(n)}`; };
const zc = (n) => `${Number(n || 0).toLocaleString()} ZC`;
const nick = (name) => String(name || "").trim().split(" ").pop();
const when = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" }) + " CT";
};

/** A club's logo from its full name, for the thumbnail; null when unknown. */
export function logoFor(sport, name, league) {
  // College teams have their own table: matching them against the NFL by
  // nickname would give Boston College the Philadelphia Eagles' logo.
  if (isCollegeLeague(league)) return cfbLogo(name);
  const key = String(sport || "").toLowerCase();
  const leagueKey = key.includes("football") ? "nfl" : key.includes("baseball") ? "mlb" : key.includes("basketball") ? "nba" : key.includes("hockey") ? "nhl" : null;
  const wanted = String(name || "").toLowerCase();
  const pool = LEAGUES.filter((l) => !leagueKey || l.key === leagueKey);
  for (const l of pool) {
    const hit = l.teams.find(([, full]) => full.toLowerCase() === wanted) || l.teams.find(([, full]) => wanted.endsWith(nick(full).toLowerCase()));
    if (hit) return `https://a.espncdn.com/i/teamlogos/${l.key}/500/${hit[0]}.png`;
  }
  return null;
}

export function discordEnabled(env) {
  return /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(String(env?.DISCORD_LEDGER_WEBHOOK || "").trim());
}

/** Posts one message with up to ten embeds. Never throws. */
export async function postDiscord(env, embeds, content = "") {
  if (!discordEnabled(env)) return { ok: false, error: "NOT_CONFIGURED" };
  const list = (Array.isArray(embeds) ? embeds : [embeds]).filter(Boolean).slice(0, 10);
  if (!list.length && !content) return { ok: false, error: "EMPTY" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(String(env.DISCORD_LEDGER_WEBHOOK).trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "ZCoin Picks", avatar_url: AVATAR, content, embeds: list, allowed_mentions: { parse: [] } }),
      signal: controller.signal
    });
    if (!response.ok) {
      console.error(`discord: webhook answered ${response.status}`);
      return { ok: false, error: `HTTP_${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    console.error("discord: webhook failed", error?.message || error);
    return { ok: false, error: String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------- cards */

/** 🪙 someone locked a pick. */
export function pickEmbed({ user, market, pick }) {
  const slug = slugFor(market);
  const opp = pick.opponent;
  return {
    color: COLOR.gold,
    author: { name: `${user.displayName || user.login} locked a pick`, url: `${SITE}/u/${encodeURIComponent(user.login)}` },
    description: `**${pick.team} ${line(pick.odds)}** vs ${opp}\n` +
      `Stake **${zc(pick.wager)}** · pays **${zc(pick.returnsIfWon)}** if it lands${pick.allIn ? " · 🎰 ALL IN" : ""}\n` +
      `${SITE}/g/${slug}`,
    thumbnail: logoFor(market.sport, pick.team, market.league) ? { url: logoFor(market.sport, pick.team, market.league) } : undefined,
    footer: { text: `${market.away_name} ${versus(market.sport)} ${market.home_name}` },
    timestamp: new Date().toISOString()
  };
}

/** 🏈 markets opened this tick — one card for the slate. */
export function openedEmbed(markets) {
  if (!markets?.length) return null;
  const rows = markets.map((m) =>
    `**${nick(m.away_name)} ${line(m.away_odds_locked)}** ${versus(m.sport)} **${nick(m.home_name)} ${line(m.home_odds_locked)}** · closes ${when(m.starts_at)}`
  );
  return {
    color: COLOR.blue,
    // One market gets its own page; a slate gets the Picks page.
    title: markets.length === 1
      ? `Picks are open: ${markets[0].away_name} ${versus(markets[0].sport)} ${markets[0].home_name}`
      : `Picks are open on ${markets.length} games`,
    url: markets.length === 1 ? `${SITE}/g/${slugFor(markets[0])}` : `${SITE}/?view=picks`,
    description: rows.join("\n") + `\n\n\`!pick <amount> <team>\` in chat, or ${markets.length === 1 ? `${SITE}/g/${slugFor(markets[0])}` : `${SITE}/?view=picks`}`,
    footer: { text: "Lines are locked at open — everyone gets the same price." },
    timestamp: new Date().toISOString()
  };
}

/** ✅ a game settled — the score and every pick on it. */
export function settledEmbed(entry) {
  if (!entry || entry.action === "skipped") return null;
  const voided = entry.outcome === "VOID";
  const hasScore = Number.isFinite(entry.awayScore) && Number.isFinite(entry.homeScore);
  const score = hasScore ? ` ${entry.awayScore}–${entry.homeScore}` : "";
  const title = voided
    ? `${isFight(entry.sport) ? "Draw" : "Voided"}: ${entry.away} ${versus(entry.sport)} ${entry.home}`
    : `Final: ${entry.away} ${versus(entry.sport)} ${entry.home}${score}`;
  const lines = (entry.lines || []).map((p) => {
    const mark = p.status === "WON" ? "✅" : p.status === "LOST" ? "❌" : p.status === "REFUNDED" ? "↩️" : "⚠️";
    const net = p.status === "WON" ? `+${zc(p.profit)}` : p.status === "LOST" ? `−${zc(p.wager)}` : p.status === "REFUNDED" ? "refunded" : "payout pending";
    return `${mark} **${p.name}** · ${nick(p.team)} ${line(p.odds)} · ${zc(p.wager)} → **${net}**`;
  });
  const total = (entry.won || 0) + (entry.lost || 0) + (entry.refunded || 0);
  const summary = voided
    ? `${entry.refunded || 0} stake${entry.refunded === 1 ? "" : "s"} refunded`
    : `**${entry.winnerName}** ${isFight(entry.sport) ? "wins" : "win"} · ${entry.won || 0} of ${total} picks cashed · ${zc(entry.paid)} paid out`;
  return {
    color: voided ? COLOR.grey : entry.won ? COLOR.green : COLOR.red,
    title,
    url: `${SITE}/g/${entry.slug}`,
    description: `${summary}${lines.length ? "\n\n" + lines.join("\n") : "\n\nNobody had a pick on this one."}\n\n${SITE}/g/${entry.slug}`,
    thumbnail: !voided && logoFor(entry.sport, entry.winnerName, entry.league) ? { url: logoFor(entry.sport, entry.winnerName, entry.league) } : undefined,
    footer: { text: entry.failed ? `⚠ ${entry.failed} payout(s) failed — being retried` : (entry.source === "admin-result" ? "Settled by an admin" : "Settled automatically from the final score") },
    timestamp: new Date().toISOString()
  };
}
