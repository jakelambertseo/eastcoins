/* ============================================================
   EastCoin Picks — badges (titles)

   Things worth saying next to a name, all read from rows that
   already exist. Exclusive ones have a single holder.

   Picks, this season
     👑 season leader        top of the standings by Picks profit
     🏆 champion             last season's winner, all of this season
     🎯 sharpshooter         best accuracy, 5+ settled picks       (exclusive)
     🐋 whale                most ZCoins staked                    (exclusive)
     🦈 underdog hunter      most wins on plus-money lines         (exclusive)
     🧱 chalk eater          most wins on favourites of −200 or shorter (exclusive)
     🔥 N in a row           current win streak of three to five
     🔥🔥 on fire            current win streak of six or more
     🧊 N straight           current losing streak of three or more
     🩹 comeback             negative to positive profit inside a week, held 7 days
     🎰 all-in               won a `!pick all`, held until the next loss
     💸 broke                a pick left the wallet at zero, held until back above 10
     💀 worst beat of week   biggest single stake lost in 7 days

   Green Room
     🎵 top requester        most songs queued, ever                (exclusive)
     🎸 regular              50 lifetime requests
     👍 crowd pleaser        best good-to-bad ratio, 10+ rated songs (exclusive)
     🗑️ trash taste          most 🗑️ and ✖ in 30 days, 5+ songs    (exclusive)

   Around the site
     🏠 resident             on the site 20 of the last 30 days
     🪑 front row            first person on the site each of the last 5 days (exclusive)

   Computed for everyone at once and cached a minute, because the
   leaderboard, ledger, game pages, music room and the bot all ask
   for the same answer within seconds of each other.
   ============================================================ */

import { readBalance } from "./_lib.js";

const CACHE_URL = "https://eastcoin-picks.internal/badges/v2";
const CACHE_TTL_S = 60;
const DAY_MS = 24 * 3600 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const DEFAULT_MUSIC_ROOM = "https://eastcoin-music-room.jake-7f5.workers.dev";

const BROKE_CEILING = 10;      // 💸 clears once the wallet is above this
const REGULAR_REQUESTS = 50;   // 🎸
const PLEASER_MIN_RATED = 10;  // 👍
const TRASH_MIN_SONGS = 5;     // 🗑️
const SHARP_MIN_SETTLED = 5;   // 🎯
const RESIDENT_DAYS = 20;      // 🏠 out of the last 30
const FRONT_ROW_DAYS = 5;      // 🪑

/** Current streak from settled picks in the order they were decided: +n wins, -n losses. */
export function streakOf(statuses) {
  let current = 0;
  let bestWin = 0;
  for (const status of statuses) {
    const w = status === "WON";
    current = w ? (current > 0 ? current + 1 : 1) : (current < 0 ? current - 1 : -1);
    if (current > bestWin) bestWin = current;
  }
  return { current, bestWin };
}

/** "2026-09-08 21:07:55" or ISO → ms. */
function ms(stamp) {
  if (!stamp) return NaN;
  const s = String(stamp);
  return new Date(s.includes("T") ? s : s.replace(" ", "T") + (s.endsWith("Z") ? "" : "Z")).getTime();
}

let extrasReady = false;
/** Columns added after the tables first shipped; harmless when present. */
export async function ensureBadgeExtras(db) {
  if (extrasReady) return;
  await db.prepare(`ALTER TABLE picks ADD COLUMN all_in INTEGER NOT NULL DEFAULT 0`).run().catch(() => {});
  await db.prepare(`CREATE TABLE IF NOT EXISTS user_days (user_id TEXT NOT NULL, day TEXT NOT NULL, first_seen INTEGER NOT NULL, PRIMARY KEY (user_id, day))`).run().catch(() => {});
  extrasReady = true;
}

/* ---------------------------------------------------------- Green Room */

async function musicRoom(env) {
  const base = String(env.MUSIC_ROOM_URL || DEFAULT_MUSIC_ROOM).trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const response = await fetch(`${base}/history/main`, { cf: { cacheTtl: 120, cacheEverything: true } });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function musicBadges(payload, add) {
  if (!payload) return;
  const stats = (payload.userStats || []).map((s) => ({
    login: String(s.login || "").toLowerCase(),
    count: Number(s.count || 0), rated: Number(s.rated || 0),
    good: Number(s.up || 0) + Number(s.fire || 0), bad: Number(s.trash || 0) + Number(s.del || 0)
  })).filter((s) => s.login);

  // 🎵 most songs ever
  const top = stats.slice().sort((a, b) => b.count - a.count)[0];
  if (top && top.count > 0) add(top.login, { key: "music", emoji: "🎵", label: `Top requester — ${top.count} songs` });

  // 🎸 fifty requests
  for (const s of stats) if (s.count >= REGULAR_REQUESTS) add(s.login, { key: "regular", emoji: "🎸", label: `Regular — ${s.count} requests` });

  // 👍 best good-to-bad ratio with enough songs rated
  const pleaser = stats
    .filter((s) => s.rated >= PLEASER_MIN_RATED && s.good > 0)
    .map((s) => ({ ...s, ratio: s.good / Math.max(1, s.bad) }))
    .sort((a, b) => b.ratio - a.ratio || b.good - a.good)[0];
  if (pleaser) add(pleaser.login, { key: "pleaser", emoji: "👍", label: `Crowd pleaser — ${pleaser.good} good to ${pleaser.bad} bad` });

  // 🗑️ most bad reactions in the last 30 days, from the played history
  const since = Date.now() - MONTH_MS;
  const bin = new Map();
  for (const h of payload.history || []) {
    const login = String(h.requestedByLogin || "").toLowerCase();
    const played = Number(h.playedAt) || 0;
    if (!login || played < since) continue;
    const e = bin.get(login) || { songs: 0, bad: 0 };
    e.songs += 1;
    e.bad += Number(h.trash || 0) + Number(h.del || 0);
    bin.set(login, e);
  }
  const trash = [...bin.entries()].filter(([, e]) => e.songs >= TRASH_MIN_SONGS && e.bad > 0).sort((a, b) => b[1].bad - a[1].bad)[0];
  if (trash) add(trash[0], { key: "trash", emoji: "🗑️", label: `Trash taste — ${trash[1].bad} bad reactions in 30 days` });
}

/* ---------------------------------------------------------- presence */

async function presenceBadges(db, add) {
  const since = new Date(Date.now() - MONTH_MS).toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
  const rows = await db
    .prepare(
      `SELECT d.user_id, d.day, d.first_seen, u.twitch_login
         FROM user_days d JOIN users u ON u.twitch_id = d.user_id
        WHERE d.day >= ?
        ORDER BY d.day ASC, d.first_seen ASC`
    )
    .bind(since)
    .all()
    .catch(() => ({ results: [] }));
  const days = rows.results || [];
  if (!days.length) return;

  // 🏠 twenty distinct days out of the last thirty
  const perUser = new Map();
  for (const r of days) {
    const login = String(r.twitch_login || "").toLowerCase();
    if (!login) continue;
    perUser.set(login, (perUser.get(login) || new Set()).add(r.day));
  }
  for (const [login, set] of perUser) if (set.size >= RESIDENT_DAYS) add(login, { key: "resident", emoji: "🏠", label: `Resident — ${set.size} of the last 30 days` });

  // 🪑 first through the door on each of the last five days anyone came
  const firstBy = new Map();   // day -> login (rows are ordered by first_seen inside a day)
  for (const r of days) if (!firstBy.has(r.day)) firstBy.set(r.day, String(r.twitch_login || "").toLowerCase());
  const lastDays = [...firstBy.keys()].sort().slice(-FRONT_ROW_DAYS);
  if (lastDays.length === FRONT_ROW_DAYS) {
    const firsts = new Set(lastDays.map((d) => firstBy.get(d)));
    if (firsts.size === 1) add([...firsts][0], { key: "frontrow", emoji: "🪑", label: `Front row — first in, ${FRONT_ROW_DAYS} days running` });
  }
}

/* ---------------------------------------------------------- picks */

async function seasonRows(db, seasonId) {
  const rows = await db
    .prepare(
      `SELECT u.twitch_login AS login, p.status, p.profit, p.wager, p.odds_locked, p.all_in, p.settled_at, p.created_at,
              m.away_name, m.home_name, p.selection
         FROM picks p
         JOIN users u ON u.twitch_id = p.user_id
         JOIN markets m ON m.id = p.market_id
        WHERE m.season_id = ? AND p.status IN ('WON','LOST','ACTIVE')
        ORDER BY datetime(COALESCE(p.settled_at, p.created_at)) ASC, p.created_at ASC`
    )
    .bind(seasonId)
    .all();
  return (rows.results || []).map((r) => ({ ...r, login: String(r.login || "").toLowerCase() }));
}

function standingsOf(settled) {
  const per = new Map();
  for (const r of settled) {
    const e = per.get(r.login) || { profit: 0, wins: 0 };
    e.profit += Number(r.profit || 0);
    if (r.status === "WON") e.wins += 1;
    per.set(r.login, e);
  }
  return [...per.entries()].sort((a, b) => (b[1].profit - a[1].profit) || (b[1].wins - a[1].wins) || a[0].localeCompare(b[0]));
}

async function picksBadges(env, db, add) {
  const season = await db.prepare(`SELECT id, name FROM seasons WHERE active = 1 LIMIT 1`).first();
  if (!season) return;

  const all = await seasonRows(db, season.id);
  const settled = all.filter((r) => r.status === "WON" || r.status === "LOST");

  // Per person, in the order things were decided.
  const per = new Map();
  for (const r of settled) {
    const e = per.get(r.login) || { statuses: [], rows: [], profit: 0, wins: 0, losses: 0 };
    e.statuses.push(r.status);
    e.rows.push(r);
    e.profit += Number(r.profit || 0);
    if (r.status === "WON") e.wins += 1; else e.losses += 1;
    per.set(r.login, e);
  }

  // 👑 — same order the leaderboard uses.
  const standings = standingsOf(settled);
  if (standings[0]) add(standings[0][0], { key: "crown", emoji: "👑", label: "Season leader" });

  // 🏆 — whoever finished top of the most recent season that is over.
  const previous = await db
    .prepare(`SELECT id, name FROM seasons WHERE active = 0 AND id <> ? ORDER BY COALESCE(ends_at, created_at) DESC LIMIT 1`)
    .bind(season.id)
    .first()
    .catch(() => null);
  if (previous) {
    const prevSettled = (await seasonRows(db, previous.id)).filter((r) => r.status === "WON" || r.status === "LOST");
    const champ = standingsOf(prevSettled)[0];
    if (champ) add(champ[0], { key: "champion", emoji: "🏆", label: `Champion — won the ${previous.name || previous.id}` });
  }

  // 🎯 best accuracy with enough settled picks
  const sharp = [...per.entries()]
    .filter(([, e]) => e.wins + e.losses >= SHARP_MIN_SETTLED)
    .map(([login, e]) => ({ login, acc: e.wins / (e.wins + e.losses), wins: e.wins }))
    .sort((a, b) => b.acc - a.acc || b.wins - a.wins)[0];
  if (sharp) add(sharp.login, { key: "sharp", emoji: "🎯", label: `Sharpshooter — ${Math.round(sharp.acc * 100)}% right` });

  // 🐋 most staked this season, open picks included
  const staked = new Map();
  for (const r of all) staked.set(r.login, (staked.get(r.login) || 0) + Number(r.wager || 0));
  const whale = [...staked.entries()].sort((a, b) => b[1] - a[1])[0];
  if (whale && whale[1] > 0) add(whale[0], { key: "whale", emoji: "🐋", label: `Whale — ${whale[1].toLocaleString()} staked` });

  // 🦈 / 🧱 — wins by the price they came at
  const dogWins = new Map();
  const chalkWins = new Map();
  for (const r of settled) {
    if (r.status !== "WON") continue;
    const line = Number(r.odds_locked);
    if (!Number.isFinite(line) || line === 0) continue;
    if (line > 0) dogWins.set(r.login, (dogWins.get(r.login) || 0) + 1);
    else if (line <= -200) chalkWins.set(r.login, (chalkWins.get(r.login) || 0) + 1);
  }
  const shark = [...dogWins.entries()].sort((a, b) => b[1] - a[1])[0];
  if (shark) add(shark[0], { key: "shark", emoji: "🦈", label: `Underdog hunter — ${shark[1]} plus-money win${shark[1] === 1 ? "" : "s"}` });
  const chalk = [...chalkWins.entries()].sort((a, b) => b[1] - a[1])[0];
  if (chalk) add(chalk[0], { key: "chalk", emoji: "🧱", label: `Chalk eater — ${chalk[1]} win${chalk[1] === 1 ? "" : "s"} at −200 or shorter` });

  const now = Date.now();
  for (const [login, e] of per) {
    // 🔥 / 🔥🔥 / 🧊
    const { current } = streakOf(e.statuses);
    if (current >= 6) add(login, { key: "fire", emoji: "🔥🔥", label: `On fire — ${current} in a row` });
    else if (current >= 3) add(login, { key: "hot", emoji: "🔥", label: `${current} in a row` });
    else if (current <= -3) add(login, { key: "cold", emoji: "🧊", label: `${Math.abs(current)} straight losses` });

    // 🎰 — an all-in win with no loss since
    let allInWin = false;
    for (const r of e.rows) {
      if (r.status === "LOST") allInWin = false;
      else if (r.status === "WON" && Number(r.all_in) === 1) allInWin = true;
    }
    if (allInWin) add(login, { key: "allin", emoji: "🎰", label: "All-in — won it all on one pick" });

    // 🩹 — from under water to above it inside seven days, held a week
    let running = 0;
    let lastNegativeAt = NaN;
    let comebackAt = NaN;
    for (const r of e.rows) {
      const at = ms(r.settled_at || r.created_at);
      const before = running;
      running += Number(r.profit || 0);
      if (running < 0) lastNegativeAt = at;
      if (before < 0 && running > 0 && Number.isFinite(lastNegativeAt) && at - lastNegativeAt <= WEEK_MS) comebackAt = at;
    }
    if (Number.isFinite(comebackAt) && now - comebackAt <= WEEK_MS) add(login, { key: "comeback", emoji: "🩹", label: "Comeback — back in the green this week" });
  }

  // 💸 — a stake that left the wallet at zero, and it has not recovered past the ceiling.
  const zeroed = await db
    .prepare(
      `SELECT DISTINCT u.twitch_login AS login
         FROM wallet_operations w JOIN users u ON u.twitch_id = w.user_id
        WHERE w.type = 'WAGER_DEBIT' AND w.status = 'CONFIRMED' AND w.balance_after = 0`
    )
    .all()
    .catch(() => ({ results: [] }));
  const candidates = (zeroed.results || []).map((r) => String(r.login || "").toLowerCase()).filter(Boolean).slice(0, 12);
  const balances = await Promise.all(candidates.map((login) => readBalance(env, login).catch(() => null)));
  candidates.forEach((login, i) => {
    const bal = balances[i];
    if (bal !== null && bal <= BROKE_CEILING) add(login, { key: "broke", emoji: "💸", label: `Broke — ${bal} ZCoin${bal === 1 ? "" : "s"} to the name` });
  });

  // 💀 — the biggest stake lost in the last seven days.
  const beat = settled
    .filter((r) => r.status === "LOST" && Number.isFinite(ms(r.settled_at)) && ms(r.settled_at) >= now - WEEK_MS)
    .sort((a, b) => Number(b.wager) - Number(a.wager))[0];
  if (beat) {
    const team = beat.selection === "home" ? beat.home_name : beat.away_name;
    add(beat.login, { key: "skull", emoji: "💀", label: `Worst beat of the week — ${Number(beat.wager).toLocaleString()} on the ${String(team).split(" ").pop()}` });
  }
}

/* ---------------------------------------------------------- all together */

async function compute(env, db) {
  const byLogin = {};
  const add = (login, badge) => {
    const key = String(login || "").toLowerCase();
    if (!key) return;
    (byLogin[key] = byLogin[key] || []).push(badge);
  };

  await ensureBadgeExtras(db);
  const [music] = await Promise.all([
    musicRoom(env),
    picksBadges(env, db, add).catch((error) => console.error("picks badges", error)),
    presenceBadges(db, add).catch((error) => console.error("presence badges", error))
  ]);
  musicBadges(music, add);

  return { byLogin, computedAt: new Date().toISOString() };
}

/** Everyone's badges, keyed by lowercase login. Cached a minute. */
export async function badgesFor(env, db) {
  const cache = caches.default;
  const key = new Request(CACHE_URL);
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const result = await compute(env, db);
  await cache.put(key, new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${CACHE_TTL_S}` }
  })).catch(() => {});
  return result;
}
