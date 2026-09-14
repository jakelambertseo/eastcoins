/* ============================================================
   EastCoin — the bell

   GET  /api/picks/notifications   what happened to YOU since you last
                                   looked, newest first, plus the unread count
   POST /api/picks/notifications   { seen: true } — you looked; the count
                                   clears and the badge set is remembered

   No inbox table. Every row is built from something the site already
   wrote — a pick's settled_at, a pot's paid_at, a market's
   odds_locked_at, an admin's announce note — so the panel can never
   disagree with the ledger. Two columns on users carry the state:
   notif_seen_at (when the panel was last opened) and notif_badges
   (the badge keys already shown, so a new one can be noticed without
   a badge ever being stored anywhere).

   Only things that happened to the viewer, or that they asked for
   (their favourite team's game opening). Everyone's picks, songs and
   casino spins stay in the ticker and the Activity feed.

   Cost: the bell polls this every 90 s while a tab is visible — about
   960 requests a day per open tab, five small indexed queries each,
   plus badgesFor(), which is one cached computation for everyone.
   ============================================================ */

import { json, fail, getSessionUser } from "./_lib.js";
import { slugFor } from "./_slug.js";
import { isProp, matchup, sideLabel, shortQuestion } from "./_props.js";
import { findTeam, ensureFavouriteColumns } from "./_teams.js";
import { badgesFor } from "./_badges.js";
import { ensureOps } from "./_ops.js";

const DAYS_BACK = 14;
const FIRST_LOOK_DAYS = 3;      // a brand-new bell shows three days, not fourteen
const LIMIT = 30;

const utc = (v) => (v && !/[TZ]/.test(v) ? v.replace(" ", "T") + "Z" : v || null);
const stamp = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");

let ready = false;
async function ensureColumns(db) {
  if (ready) return;
  await db.prepare(`ALTER TABLE users ADD COLUMN notif_seen_at TEXT`).run().catch(() => {});
  await db.prepare(`ALTER TABLE users ADD COLUMN notif_badges TEXT`).run().catch(() => {});
  ready = true;
}

const line = (v) => { const n = Number(v); return !Number.isFinite(n) || n === 0 ? "" : n > 0 ? `+${n}` : String(n); };
const nick = (name) => String(name || "").trim().split(/\s+/).pop() || "";

/* ---------------------------------------------------------- the rows */

async function settledPicks(db, user, from) {
  const rows = await db.prepare(
    `SELECT p.selection, p.wager, p.status, p.payout, p.profit, p.odds_locked, p.settled_at,
            m.id, m.sport, m.league, m.away_name, m.home_name, m.question, m.starts_at, m.winner,
            m.final_away_score, m.final_home_score
       FROM picks p JOIN markets m ON m.id = p.market_id
      WHERE p.user_id = ? AND p.status IN ('WON','LOST','REFUNDED') AND p.settled_at >= ?
      ORDER BY p.settled_at DESC LIMIT ?`
  ).bind(user.id, from, LIMIT).all().catch(() => ({ results: [] }));
  return (rows.results || []).map((p) => {
    const prop = isProp(p.sport);
    const side = sideLabel(p, p.selection);
    const score = Number.isInteger(p.final_away_score) && Number.isInteger(p.final_home_score) ? ` · final ${p.final_away_score}–${p.final_home_score}` : "";
    const href = `/g/${slugFor(p)}`;
    if (p.status === "REFUNDED") {
      return { type: "refund", icon: "↩️", tone: "", at: utc(p.settled_at), href,
        strong: prop ? `"${shortQuestion(p.question, 48)}"` : matchup(p), text: prop ? "was voided" : "voided", amount: Number(p.wager), amountWord: "back", sub: `Your ${Number(p.wager)} ZC came back` };
    }
    const won = p.status === "WON";
    if (prop) {
      const call = p.winner ? sideLabel(p, p.winner).toUpperCase() : "";
      return { type: won ? "won" : "lost", icon: "🎯", tone: won ? "win" : "loss", at: utc(p.settled_at), href,
        strong: `Prop called — ${call}`, text: `· you had ${side}`, amount: won ? Number(p.profit) : -Number(p.wager),
        sub: `“${shortQuestion(p.question, 60)}”` };
    }
    const opp = p.selection === "home" ? p.away_name : p.home_name;
    return { type: won ? "won" : "lost", icon: won ? "✅" : "❌", tone: won ? "win" : "loss", at: utc(p.settled_at), href,
      strong: `${nick(side)} ${line(p.odds_locked)}`, text: won ? "cashed" : "didn't land", amount: won ? Number(p.profit) : -Number(p.wager),
      sub: `${nick(side)} vs ${nick(opp)}${p.league ? " · " + p.league : ""}${score}` };
  });
}

async function jackpots(db, user, from) {
  const rows = await db.prepare(
    `SELECT day, amount, paid_at, total_stake, winner_user_id, winner_login FROM casino_pots
      WHERE status = 'PAID' AND paid_at >= ? ORDER BY paid_at DESC LIMIT 5`
  ).bind(from).all().catch(() => ({ results: [] }));
  return (rows.results || []).map((p) => {
    const mine = String(p.winner_user_id) === String(user.id);
    return { type: "pot", icon: "🏆", tone: mine ? "gold" : "", at: utc(p.paid_at), href: "/?view=casino",
      strong: mine ? "You hit the Daily Jackpot" : `${p.winner_login || "Someone"} hit the Daily Jackpot`,
      text: "", amount: mine ? Number(p.amount) : null,
      sub: mine ? `Drawn by stake from ${Number(p.total_stake || 0).toLocaleString()} ZC of play` : `${Number(p.amount)} ZC · drawn by stake from ${Number(p.total_stake || 0).toLocaleString()} ZC of play` };
  });
}

async function teamOpened(db, user, from) {
  const row = await db.prepare(`SELECT favourite_league, favourite_team FROM users WHERE twitch_id = ? LIMIT 1`).bind(user.id).first().catch(() => null);
  const team = row ? findTeam(row.favourite_league, row.favourite_team) : null;
  if (!team) return [];
  const rows = await db.prepare(
    `SELECT id, sport, league, away_name, home_name, starts_at, odds_locked_at, state, away_odds_locked, home_odds_locked
       FROM markets WHERE odds_locked_at >= ? AND (away_name = ? OR home_name = ?)
      ORDER BY odds_locked_at DESC LIMIT 3`
  ).bind(from, team.name, team.name).all().catch(() => ({ results: [] }));
  return (rows.results || []).map((m) => {
    const open = m.state === "OPEN" && new Date(m.starts_at).getTime() > Date.now();
    const when = new Date(m.starts_at).toLocaleString("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "2-digit" });
    return { type: "team", icon: "🏈", tone: "open", at: utc(m.odds_locked_at), href: `/g/${slugFor(m)}`,
      strong: matchup(m), text: open ? "is open for picks" : "opened for picks",
      sub: `Your team · ${open ? "closes" : "closed"} ${when} CT · ${nick(m.away_name)} ${line(m.away_odds_locked)} / ${nick(m.home_name)} ${line(m.home_odds_locked)}` };
  });
}

async function announces(db, from) {
  await ensureOps(db);
  const rows = await db.prepare(
    `SELECT key, value, updated_at FROM ops_status WHERE key LIKE 'announce:%' AND updated_at >= ? ORDER BY updated_at DESC LIMIT 5`
  ).bind(from).all().catch(() => ({ results: [] }));
  const list = rows.results || [];
  if (!list.length) return [];
  const ids = list.map((r) => r.key.slice("announce:".length));
  const markets = await db.prepare(
    `SELECT id, sport, league, away_name, home_name, question, starts_at, away_odds_locked, home_odds_locked FROM markets WHERE id IN (${ids.map(() => "?").join(",")})`
  ).bind(...ids).all().catch(() => ({ results: [] }));
  const by = new Map((markets.results || []).map((m) => [m.id, m]));
  return list.map((r) => {
    const m = by.get(r.key.slice("announce:".length));
    if (!m) return null;
    let v = {}; try { v = JSON.parse(r.value) || {}; } catch { v = {}; }
    const prop = isProp(m.sport);
    return { type: "announce", icon: prop ? "🎯" : "📣", tone: prop ? "prop" : "", at: utc(r.updated_at), href: `/g/${slugFor(m)}`,
      strong: v.by ? `${v.by} opened` : "Opened", text: prop ? `a prop: “${shortQuestion(m.question, 56)}”` : matchup(m),
      sub: prop ? `Yes ${line(m.away_odds_locked)} / No ${line(m.home_odds_locked)}` : `${nick(m.away_name)} ${line(m.away_odds_locked)} / ${nick(m.home_name)} ${line(m.home_odds_locked)}` };
  }).filter(Boolean);
}

/** Badges are computed, never stored; a new one is one not in the remembered set. */
async function newBadges(env, db, user, remembered) {
  let all = null;
  try { all = await badgesFor(env, db); } catch { return { items: [], keys: remembered }; }
  const mine = all?.byLogin?.[user.login] || [];
  const keys = mine.map((b) => b.key);
  const seen = new Set(remembered || []);
  const items = mine.filter((b) => !seen.has(b.key)).map((b) => ({
    type: "badge", icon: b.emoji, tone: "gold", at: new Date().toISOString(), href: `/u/${encodeURIComponent(user.login)}`,
    strong: `You earned ${b.emoji} ${String(b.label).split(" — ")[0]}`, text: "", sub: String(b.label).split(" — ")[1] || "A new badge next to your name", fresh: true
  }));
  return { items, keys };
}

/* ---------------------------------------------------------- handlers */

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Notifications are offline.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_SIGNED_IN", "Log in to see your notifications.", 401);
  await Promise.all([ensureColumns(db), ensureFavouriteColumns(db)]);

  const me = await db.prepare(`SELECT notif_seen_at, notif_badges FROM users WHERE twitch_id = ? LIMIT 1`).bind(user.id).first().catch(() => null);
  const seenAt = me?.notif_seen_at ? new Date(utc(me.notif_seen_at)).getTime() : null;
  let remembered = [];
  try { remembered = JSON.parse(me?.notif_badges || "[]"); } catch { remembered = []; }
  const floor = Date.now() - DAYS_BACK * 86400000;
  // Unread is everything after the last look; a first look sees a few days, not two weeks of it.
  const since = seenAt ?? Date.now() - FIRST_LOOK_DAYS * 86400000;
  const from = stamp(floor);

  const [picks, pots, team, said, badges] = await Promise.all([
    settledPicks(db, user, from), jackpots(db, user, from), teamOpened(db, user, from), announces(db, from),
    newBadges(context.env, db, user, remembered)
  ]);
  const items = [...picks, ...pots, ...team, ...said, ...badges.items]
    .filter((i) => i.at && !Number.isNaN(new Date(i.at).getTime()))
    .map((i) => ({ ...i, unread: i.fresh || new Date(i.at).getTime() > since }))
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, LIMIT);

  return json({
    ok: true,
    since: new Date(since).toISOString(),
    firstLook: seenAt === null,
    login: user.login,
    unread: items.filter((i) => i.unread).length,
    items
  });
}

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Notifications are offline.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user) return fail("NOT_SIGNED_IN", "Log in first.", 401);
  await ensureColumns(db);
  // The badge set as of now: anything new after this is news again.
  let keys = [];
  try { const all = await badgesFor(context.env, db); keys = (all?.byLogin?.[user.login] || []).map((b) => b.key); } catch { keys = null; }
  if (keys) await db.prepare(`UPDATE users SET notif_seen_at = CURRENT_TIMESTAMP, notif_badges = ? WHERE twitch_id = ?`).bind(JSON.stringify(keys), user.id).run();
  else await db.prepare(`UPDATE users SET notif_seen_at = CURRENT_TIMESTAMP WHERE twitch_id = ?`).bind(user.id).run();
  return json({ ok: true, seenAt: new Date().toISOString() });
}
