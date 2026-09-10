/* ============================================================
   POST /api/admin/recap — yesterday's Picks, to Discord

   Every person whose picks settled during the previous Central
   day: their record for the day and what they made or lost, best
   to worst, with the day's totals underneath. One card, posted
   once per day — the cron Worker fires at 13:50 and 14:50 UTC so
   one of them is 8:50 AM Central whatever the clocks are doing,
   and the endpoint only posts when it really is 8 AM Central
   (or when told to with ?force=1 from the dashboard).

     ?day=YYYY-MM-DD   recap that Central day instead of yesterday
     ?force=1          post regardless of the hour (owner / manual)
     ?dry=1            build it and return it, post nothing
   ============================================================ */

import { getSessionUser, json, fail, safeEqual } from "../picks/_lib.js";
import { noteStatus, readStatus } from "../picks/_ops.js";
import { discordEnabled, postDiscord } from "../picks/_discord.js";

const OWNERS = new Set(["bootypaper"]);
const TZ = "America/Chicago";
const HOUR = 3600 * 1000;
const SITE = "https://eastcoin.vip";

/* ---------------------------------------------------------- Central time */

function ctParts(ms) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), min: Number(p.minute) };
}

/** Midnight Central on the Central calendar date of `ms`, as a UTC instant. */
function ctMidnight(ms) {
  const { y, m, d } = ctParts(ms);
  let guess = Date.UTC(y, m - 1, d, 5);   // CDT; corrected for CST below
  const got = ctParts(guess);
  if (got.h !== 0 || got.d !== d) guess += (0 - got.h) * HOUR;
  return guess;
}

const sqlStamp = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const dayKey = (ms) => { const { y, m, d } = ctParts(ms); return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };

async function authorize(context, db) {
  const user = await getSessionUser(db, context.request);
  if (user && OWNERS.has(user.login)) return { ok: true, by: user.login };
  const expected = String(context.env.PICKS_CRON_KEY || "").trim();
  const given = String(context.request.headers.get("X-Picks-Cron-Key") || "").trim();
  if (expected && given && safeEqual(given, expected)) return { ok: true, by: "cron" };
  return { ok: false };
}

/* ---------------------------------------------------------- the recap */

export async function buildRecap(db, dayStartMs) {
  const from = sqlStamp(dayStartMs);
  const to = sqlStamp(dayStartMs + 24 * HOUR);
  const rows = await db
    .prepare(
      `SELECT u.twitch_login, u.display_name, p.status, p.wager, p.profit, p.payout, p.selection,
              m.away_name, m.home_name, m.league
         FROM picks p JOIN users u ON u.twitch_id = p.user_id JOIN markets m ON m.id = p.market_id
        WHERE p.status IN ('WON','LOST') AND datetime(p.settled_at) >= datetime(?) AND datetime(p.settled_at) < datetime(?)
        ORDER BY datetime(p.settled_at) ASC`
    )
    .bind(from, to)
    .all();
  const settled = rows.results || [];

  const per = new Map();
  for (const r of settled) {
    const login = String(r.twitch_login || "").toLowerCase();
    const e = per.get(login) || { login, name: String(r.display_name || r.twitch_login), wins: 0, losses: 0, net: 0, staked: 0, best: null };
    if (r.status === "WON") e.wins += 1; else e.losses += 1;
    e.net += Number(r.profit || 0);
    e.staked += Number(r.wager || 0);
    if (r.status === "WON" && (!e.best || Number(r.profit) > e.best.profit)) {
      e.best = { profit: Number(r.profit), team: r.selection === "home" ? r.home_name : r.away_name };
    }
    per.set(login, e);
  }
  const people = [...per.values()].sort((a, b) => b.net - a.net || b.wins - a.wins || a.name.localeCompare(b.name));

  const games = new Set(settled.map((r) => `${r.away_name}@${r.home_name}`)).size;
  const paid = settled.reduce((n, r) => n + (r.status === "WON" ? Number(r.payout || 0) : 0), 0);
  const staked = settled.reduce((n, r) => n + Number(r.wager || 0), 0);
  const wins = settled.filter((r) => r.status === "WON").length;

  return { people, settled: settled.length, games, paid, staked, wins };
}

const zc = (n) => `${Math.abs(Number(n) || 0).toLocaleString()} ZC`;
const signed = (n) => (n > 0 ? `+${zc(n)}` : n < 0 ? `−${zc(n)}` : "even");

export function recapEmbed(recap, dayStartMs) {
  const pretty = new Date(dayStartMs + 12 * HOUR).toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
  if (!recap.settled) {
    return {
      color: 0x8a8580,
      title: `Daily recap — ${pretty}`,
      description: "Nothing settled. The next slate opens at 4 PM Central.",
      url: `${SITE}/?view=picks`,
      timestamp: new Date().toISOString()
    };
  }
  const lines = recap.people.map((p) => {
    const mark = p.net > 0 ? "✅" : p.net < 0 ? "❌" : "➖";
    return `${mark} **${p.name}** · ${p.wins}–${p.losses} · **${signed(p.net)}**`;
  });
  const top = recap.people[0];
  const bottom = recap.people[recap.people.length - 1];
  const footerBits = [
    `${recap.people.length} player${recap.people.length === 1 ? "" : "s"}`,
    `${recap.settled} pick${recap.settled === 1 ? "" : "s"} on ${recap.games} game${recap.games === 1 ? "" : "s"}`,
    `${recap.wins} cashed`,
    `${zc(recap.staked)} staked · ${zc(recap.paid)} paid out`
  ];
  const callouts = [];
  if (top && top.net > 0) callouts.push(`🏆 Day's best: **${top.name}** ${signed(top.net)}`);
  if (bottom && bottom !== top && bottom.net < 0) callouts.push(`💀 Rough one: **${bottom.name}** ${signed(bottom.net)}`);
  const netAll = recap.people.reduce((n, p) => n + p.net, 0);
  return {
    color: netAll >= 0 ? 0x4ddb8b : 0xff6b85,
    title: `Daily recap — ${pretty}`,
    url: `${SITE}/?view=picks&tab=leaderboard`,
    description: `${lines.join("\n")}${callouts.length ? "\n\n" + callouts.join("\n") : ""}\n\n${SITE}/?view=picks&tab=ledger`,
    footer: { text: footerBits.join(" · ") },
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
  const force = url.searchParams.get("force") === "1" || auth.by !== "cron";
  const now = Date.now();

  // The cron fires at two UTC times so one of them is 8 AM Central all
  // year; the other is 7 or 9 and is politely ignored.
  if (!force && ctParts(now).h !== 8) return json({ ok: true, skipped: "not 8 AM Central", centralHour: ctParts(now).h });

  const wanted = String(url.searchParams.get("day") || "").trim();
  let dayStart;
  if (/^\d{4}-\d{2}-\d{2}$/.test(wanted)) {
    const [y, m, d] = wanted.split("-").map(Number);
    dayStart = ctMidnight(Date.UTC(y, m - 1, d, 12));
  } else {
    dayStart = ctMidnight(now) - 24 * HOUR;
  }
  const key = dayKey(dayStart);

  // Once per day, unless forced.
  const already = await readStatus(db, [`recap:sent:${key}`]);
  if (!force && already[`recap:sent:${key}`]) return json({ ok: true, skipped: "already posted", day: key });

  const recap = await buildRecap(db, dayStart);
  const embed = recapEmbed(recap, dayStart);
  if (url.searchParams.get("dry") === "1") return json({ ok: true, dry: true, day: key, embed, people: recap.people });
  const sent = await postDiscord(context.env, embed);
  if (!sent.ok) return fail("DISCORD_FAILED", `Discord refused the recap: ${sent.error}`, 502);

  await noteStatus(db, `recap:sent:${key}`, { at: new Date().toISOString(), by: auth.by, people: recap.people.length, settled: recap.settled });
  await noteStatus(db, "recap:last", { at: new Date().toISOString(), day: key, by: auth.by, people: recap.people.length, settled: recap.settled });
  return json({ ok: true, day: key, people: recap.people.length, settled: recap.settled, paid: recap.paid });
}
