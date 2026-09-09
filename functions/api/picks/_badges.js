/* ============================================================
   EastCoin Picks — badges

   Five things worth saying next to a name, all read from rows
   that already exist:

     👑 season leader        top of the standings by Picks profit
     🔥 N in a row           current win streak of three or more
     🧊 N straight           current losing streak of three or more
     💀 worst beat of week   biggest single stake lost in 7 days
     🎵 top requester        most songs queued in the Green Room

   Computed for everyone at once and cached a minute, because the
   leaderboard, ledger, game pages, music room and the bot all ask
   for the same answer within seconds of each other.
   ============================================================ */

const CACHE_URL = "https://eastcoin-picks.internal/badges/v1";
const CACHE_TTL_S = 60;
const WEEK_MS = 7 * 24 * 3600 * 1000;
const DEFAULT_MUSIC_ROOM = "https://eastcoin-music-room.jake-7f5.workers.dev";

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

async function topRequester(env) {
  const base = String(env.MUSIC_ROOM_URL || DEFAULT_MUSIC_ROOM).trim().replace(/\/$/, "");
  if (!base) return null;
  try {
    const response = await fetch(`${base}/history/main`, { cf: { cacheTtl: 120, cacheEverything: true } });
    if (!response.ok) return null;
    const payload = await response.json();
    const top = (payload.userStats || []).slice().sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0];
    return top?.login ? { login: String(top.login).toLowerCase(), count: Number(top.count || 0) } : null;
  } catch {
    return null;
  }
}

async function compute(env, db) {
  const byLogin = {};
  const add = (login, badge) => {
    const key = String(login || "").toLowerCase();
    if (!key) return;
    (byLogin[key] = byLogin[key] || []).push(badge);
  };

  const season = await db.prepare(`SELECT id FROM seasons WHERE active = 1 LIMIT 1`).first();
  if (season) {
    const rows = await db
      .prepare(
        `SELECT u.twitch_login AS login, p.status, p.profit, p.wager, p.settled_at,
                m.away_name, m.home_name, p.selection
           FROM picks p
           JOIN users u ON u.twitch_id = p.user_id
           JOIN markets m ON m.id = p.market_id
          WHERE m.season_id = ? AND p.status IN ('WON','LOST')
          ORDER BY datetime(p.settled_at) ASC`
      )
      .bind(season.id)
      .all();
    const settled = rows.results || [];

    // Per person, in the order things were decided.
    const per = new Map();
    for (const r of settled) {
      const login = String(r.login).toLowerCase();
      const entry = per.get(login) || { statuses: [], profit: 0, wins: 0 };
      entry.statuses.push(r.status);
      entry.profit += Number(r.profit || 0);
      if (r.status === "WON") entry.wins += 1;
      per.set(login, entry);
    }

    // 👑 — same order the leaderboard uses.
    const standings = [...per.entries()].sort((a, b) => (b[1].profit - a[1].profit) || (b[1].wins - a[1].wins) || a[0].localeCompare(b[0]));
    if (standings[0]) add(standings[0][0], { key: "crown", emoji: "👑", label: "Season leader" });

    // 🔥 / 🧊
    for (const [login, entry] of per) {
      const { current } = streakOf(entry.statuses);
      if (current >= 3) add(login, { key: "hot", emoji: "🔥", label: `${current} in a row` });
      else if (current <= -3) add(login, { key: "cold", emoji: "🧊", label: `${Math.abs(current)} straight losses` });
    }

    // 💀 — the biggest stake lost in the last seven days.
    const since = Date.now() - WEEK_MS;
    const beat = settled
      .filter((r) => r.status === "LOST" && r.settled_at && new Date(r.settled_at.replace(" ", "T") + (r.settled_at.includes("Z") ? "" : "Z")).getTime() >= since)
      .sort((a, b) => Number(b.wager) - Number(a.wager))[0];
    if (beat) {
      const team = beat.selection === "home" ? beat.home_name : beat.away_name;
      add(beat.login, { key: "skull", emoji: "💀", label: `Worst beat of the week — ${Number(beat.wager).toLocaleString()} on the ${String(team).split(" ").pop()}` });
    }
  }

  // 🎵
  const top = await topRequester(env);
  if (top) add(top.login, { key: "music", emoji: "🎵", label: `Top requester — ${top.count} songs` });

  return { byLogin, computedAt: new Date().toISOString() };
}

/** Everyone's badges, keyed by login. Cached a minute across the site. */
export async function badgesFor(env, db) {
  const cache = caches.default;
  const key = new Request(CACHE_URL);
  const hit = await cache.match(key);
  if (hit) return hit.json();

  const result = await compute(env, db);
  await cache.put(key, new Response(JSON.stringify(result), {
    headers: { "Cache-Control": `max-age=${CACHE_TTL_S}`, "Content-Type": "application/json" }
  }));
  return result;
}
