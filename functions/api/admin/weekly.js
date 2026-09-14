/* ============================================================
   POST /api/admin/weekly — the week's Picks, to Discord

   Every Monday at 4:05 PM Central: the seven days ending now,
   every bettor's record and net, best to worst, the week's winner
   and loser, the biggest single win and the biggest single loss,
   and the week's totals underneath. Monday afternoon so the whole
   NFL week is in — Thursday through Monday night's game the week
   before — and the slate for the next one has not opened yet.

   The cron Worker fires at 21:05 and 22:05 UTC on Mondays so one
   of them is 4:05 PM Central whatever the clocks are doing; the
   endpoint only posts when it really is Monday 4 PM Central (or
   when told to with ?force=1 from the dashboard). Once a week,
   keyed weekly:sent:<Monday's date>.

     ?force=1   post regardless of the clock (owner / manual)
     ?dry=1     build it and return it, post nothing
     ?days=N    a different window (default 7)
   ============================================================ */

import { getSessionUser, json, fail, safeEqual, ADMIN_ALLOWLIST } from "../picks/_lib.js";
import { noteStatus, readStatus } from "../picks/_ops.js";
import { discordEnabled, postDiscord } from "../picks/_discord.js";
import { isProp, matchup, sideLabel, shortQuestion } from "../picks/_props.js";
import { slugFor } from "../picks/_slug.js";

const TZ = "America/Chicago";
const HOUR = 3600 * 1000;
const SITE = "https://eastcoin.vip";
const MAX_LINES = 25;            // Discord's description is 4,096 chars

function ctParts(ms) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", weekday: "short", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { wd: p.weekday, y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), min: Number(p.minute) };
}
const sqlStamp = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const dayKey = (ms) => { const { y, m, d } = ctParts(ms); return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
const pretty = (ms) => new Date(ms).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });

async function authorize(context, db) {
  const user = await getSessionUser(db, context.request);
  if (user && ADMIN_ALLOWLIST.has(user.login)) return { ok: true, by: user.login };
  const expected = String(context.env.PICKS_CRON_KEY || "").trim();
  const given = String(context.request.headers.get("X-Picks-Cron-Key") || "").trim();
  if (expected && given && safeEqual(given, expected)) return { ok: true, by: "cron" };
  return { ok: false };
}

/* ---------------------------------------------------------- the numbers */

const nick = (name) => String(name || "").trim().split(/\s+/).pop() || "";
const line = (v) => { const n = Number(v); return !Number.isFinite(n) || n === 0 ? "" : n > 0 ? `+${n}` : String(n); };

/** "Jets +100 vs Bills" or "YES on “Will Mahomes…”" — what one pick was. */
function pickLabel(r) {
  if (isProp(r.sport)) return `${sideLabel(r, r.selection).toUpperCase()} ${line(r.odds_locked)} on “${shortQuestion(r.question, 44)}”`;
  const side = sideLabel(r, r.selection);
  const opp = r.selection === "home" ? r.away_name : r.home_name;
  return `${nick(side)} ${line(r.odds_locked)} vs ${nick(opp)}`;
}

export async function buildWeekly(db, fromMs, toMs) {
  const rows = await db
    .prepare(
      `SELECT u.twitch_login, u.display_name, p.status, p.wager, p.profit, p.payout, p.selection, p.odds_locked, p.settled_at,
              m.id, m.sport, m.league, m.away_name, m.home_name, m.question, m.starts_at, m.final_away_score, m.final_home_score
         FROM picks p JOIN users u ON u.twitch_id = p.user_id JOIN markets m ON m.id = p.market_id
        WHERE p.status IN ('WON','LOST') AND p.settled_at >= ? AND p.settled_at < ?
        ORDER BY p.settled_at ASC`
    )
    .bind(sqlStamp(fromMs), sqlStamp(toMs))
    .all();
  const settled = rows.results || [];

  const per = new Map();
  let bestWin = null;
  let worstLoss = null;
  for (const r of settled) {
    const login = String(r.twitch_login || "").toLowerCase();
    const e = per.get(login) || { login, name: String(r.display_name || r.twitch_login), wins: 0, losses: 0, net: 0, staked: 0, best: null };
    const won = r.status === "WON";
    if (won) e.wins += 1; else e.losses += 1;
    const profit = Number(r.profit || 0);
    e.net += profit;
    e.staked += Number(r.wager || 0);
    if (won && (!e.best || profit > e.best.profit)) e.best = { profit, label: pickLabel(r) };
    per.set(login, e);
    const entry = { login, name: e.name, profit, wager: Number(r.wager || 0), label: pickLabel(r), game: matchup(r), slug: slugFor(r), at: r.settled_at };
    if (won && (!bestWin || profit > bestWin.profit)) bestWin = entry;
    if (!won && (!worstLoss || Number(r.wager) > worstLoss.wager)) worstLoss = entry;
  }
  const people = [...per.values()].sort((a, b) => b.net - a.net || b.wins - a.wins || a.name.localeCompare(b.name));
  const games = new Set(settled.map((r) => r.id)).size;
  const paid = settled.reduce((n, r) => n + (r.status === "WON" ? Number(r.payout || 0) : 0), 0);
  const staked = settled.reduce((n, r) => n + Number(r.wager || 0), 0);
  const wins = settled.filter((r) => r.status === "WON").length;
  return { people, settled: settled.length, games, paid, staked, wins, bestWin, worstLoss, from: fromMs, to: toMs };
}

const zc = (n) => `${Math.abs(Number(n) || 0).toLocaleString()} ZC`;
const signed = (n) => (n > 0 ? `+${zc(n)}` : n < 0 ? `−${zc(n)}` : "even");

export function weeklyEmbed(w) {
  const span = `${pretty(w.from)} – ${pretty(w.to)}`;
  if (!w.settled) {
    return {
      color: 0x8a8580,
      title: `Weekly roundup — ${span}`,
      description: "Nothing settled this week. The next slate opens an hour before kickoff.",
      url: `${SITE}/?view=picks`,
      timestamp: new Date().toISOString()
    };
  }
  const top = w.people[0];
  const bottom = w.people[w.people.length - 1];
  const head = [];
  if (top && top.net > 0) head.push(`🏆 **Winner of the week: ${top.name}** · ${top.wins}–${top.losses} · **${signed(top.net)}**`);
  if (bottom && bottom !== top && bottom.net < 0) head.push(`💀 **Loser of the week: ${bottom.name}** · ${bottom.wins}–${bottom.losses} · **${signed(bottom.net)}**`);
  if (w.bestWin) head.push(`💰 **Biggest win:** ${w.bestWin.name} · ${w.bestWin.label} · **${signed(w.bestWin.profit)}** · ${SITE}/g/${w.bestWin.slug}`);
  if (w.worstLoss) head.push(`🪦 **Biggest loss:** ${w.worstLoss.name} · ${w.worstLoss.label} · **${signed(-w.worstLoss.wager)}** · ${SITE}/g/${w.worstLoss.slug}`);

  const lines = w.people.slice(0, MAX_LINES).map((p, i) => {
    const mark = p.net > 0 ? "✅" : p.net < 0 ? "❌" : "➖";
    const best = p.best ? ` · best ${signed(p.best.profit)}` : "";
    return `${mark} **${i + 1}. ${p.name}** · ${p.wins}–${p.losses} · **${signed(p.net)}** · ${zc(p.staked)} staked${best}`;
  });
  if (w.people.length > MAX_LINES) lines.push(`…and ${w.people.length - MAX_LINES} more on the leaderboard`);

  const netAll = w.people.reduce((n, p) => n + p.net, 0);
  const footer = [
    `${w.people.length} bettor${w.people.length === 1 ? "" : "s"}`,
    `${w.settled} pick${w.settled === 1 ? "" : "s"} on ${w.games} market${w.games === 1 ? "" : "s"}`,
    `${w.wins} cashed (${Math.round((100 * w.wins) / w.settled)}%)`,
    `${zc(w.staked)} staked · ${zc(w.paid)} paid out`,
    `chat ${signed(netAll)} on the week`
  ];
  return {
    color: netAll >= 0 ? 0x4ddb8b : 0xff6b85,
    title: `Weekly roundup — ${span}`,
    url: `${SITE}/?view=picks&tab=leaderboard`,
    description: `${head.join("\n")}\n\n**Everyone**\n${lines.join("\n")}\n\n${SITE}/?view=picks&tab=ledger`,
    footer: { text: footer.join(" · ") },
    timestamp: new Date().toISOString()
  };
}

/* ---------------------------------------------------------- entry */

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Picks database is not connected.", 503);
  const auth = await authorize(context, db);
  if (!auth.ok) return fail("NOT_ALLOWED", "Not allowed.", 403);
  if (!discordEnabled(context.env)) return fail("NOT_CONFIGURED", "DISCORD_LEDGER_WEBHOOK is not set.");

  const url = new URL(context.request.url);
  const dry = url.searchParams.get("dry") === "1";
  const force = url.searchParams.get("force") === "1" || auth.by !== "cron";
  const now = Date.now();
  const ct = ctParts(now);

  // Two UTC firings a Monday; the one that is 4 PM Central posts.
  if (!force && !(ct.wd === "Mon" && ct.h === 16)) return json({ ok: true, skipped: "not Monday 4 PM Central", central: `${ct.wd} ${ct.h}:${String(ct.min).padStart(2, "0")}` });

  const days = Math.min(31, Math.max(1, Number(url.searchParams.get("days")) || 7));
  const from = now - days * 24 * HOUR;
  const key = dayKey(now);

  const already = await readStatus(db, [`weekly:sent:${key}`]);
  if (!force && already[`weekly:sent:${key}`]) return json({ ok: true, skipped: "already posted", week: key });

  const weekly = await buildWeekly(db, from, now);
  const embed = weeklyEmbed(weekly);
  if (dry) return json({ ok: true, dry: true, week: key, embed, people: weekly.people, bestWin: weekly.bestWin, worstLoss: weekly.worstLoss });
  const sent = await postDiscord(context.env, embed);
  if (!sent.ok) return fail("DISCORD_FAILED", `Discord refused the roundup: ${sent.error}`, 502);

  await noteStatus(db, `weekly:sent:${key}`, { at: new Date().toISOString(), by: auth.by, people: weekly.people.length, settled: weekly.settled });
  await noteStatus(db, "weekly:last", { at: new Date().toISOString(), week: key, by: auth.by, people: weekly.people.length, settled: weekly.settled });
  return json({ ok: true, week: key, people: weekly.people.length, settled: weekly.settled, paid: weekly.paid });
}
