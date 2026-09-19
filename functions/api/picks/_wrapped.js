/* ============================================================
   EastCoin Wrapped — one person's season, read back (2026-09-15)

   Nothing here is tracked for Wrapped. Every figure is read from the
   tables the site already writes, over the season's window:

     picks      picks + markets for the season (record, profit, rank,
                moments, all-ins, the team they rode with)
     casino     every casino table, the same fold the profile uses
     music      the music worker's /history/main
     movies     title_ratings and watch_rooms
     award      one superlative, chosen by rules like the badges

   It drops the morning after the Super Bowl (WRAPPED.opensAt, or the
   WRAPPED_OPENS_AT Pages variable to move it). Until then only admins
   can open one, as a preview of the season so far.
   ============================================================ */

const DEFAULT_MUSIC_ROOM = "https://eastcoin-music-room.jake-7f5.workers.dev";
const TZ = "America/Chicago";

export const WRAPPED = {
  seasonId: "2026",
  label: "2026",
  // Picks count by season id; everything else by this window.
  from: "2026-09-01T05:00:00Z",
  // Super Bowl LXI is Sunday 14 February 2027. Wrapped drops the next
  // morning at 9 AM Central.
  opensAt: "2027-02-15T15:00:00Z"
};

export function opensAt(env) {
  const override = String(env?.WRAPPED_OPENS_AT || "").trim();
  const t = override ? new Date(override).getTime() : NaN;
  return Number.isFinite(t) ? t : new Date(WRAPPED.opensAt).getTime();
}

export const isOpen = (env, now = Date.now()) => now >= opensAt(env);

/* ---------------------------------------------------------- helpers */

const toMs = (v) => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  const s = String(v);
  const t = new Date(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : s.replace(" ", "T") + "Z").getTime();
  return Number.isFinite(t) ? t : 0;
};
const sqlStamp = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekdayCT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const safeAll = (stmt) => stmt.all().then((r) => r.results || []).catch(() => []);

/* ---------------------------------------------------------- picks */

async function picksPart(db, uid) {
  const rows = await safeAll(db.prepare(
    `SELECT p.user_id, p.selection, p.wager, p.status, p.profit, p.odds_locked, p.all_in, p.settled_at,
            m.sport, m.league, m.away_name, m.home_name, m.question, m.starts_at, m.final_away_score, m.final_home_score
       FROM picks p JOIN markets m ON m.id = p.market_id
      WHERE m.season_id = ? AND p.status IN ('WON','LOST','REFUNDED')`
  ).bind(WRAPPED.seasonId));

  const settledAll = rows.filter((r) => r.status === "WON" || r.status === "LOST");
  // The ladder, ordered the way the leaderboard orders it: profit, then wins.
  const board = new Map();
  for (const r of settledAll) {
    const b = board.get(r.user_id) || { profit: 0, wins: 0 };
    b.profit += Number(r.profit || 0);
    if (r.status === "WON") b.wins += 1;
    board.set(r.user_id, b);
  }
  const ladder = [...board.entries()].sort((a, b) => b[1].profit - a[1].profit || b[1].wins - a[1].wins);
  const at = ladder.findIndex(([id]) => String(id) === uid);

  const mine = settledAll.filter((r) => String(r.user_id) === uid);
  if (!mine.length) return null;
  const wins = mine.filter((r) => r.status === "WON").length;
  const losses = mine.length - wins;
  const profit = mine.reduce((n, r) => n + Number(r.profit || 0), 0);
  const staked = mine.reduce((n, r) => n + Number(r.wager || 0), 0);

  let run = 0, bestRun = 0;
  for (const r of mine.slice().sort((a, b) => String(a.settled_at).localeCompare(String(b.settled_at)))) {
    run = r.status === "WON" ? run + 1 : 0;
    bestRun = Math.max(bestRun, run);
  }

  const isProp = (r) => String(r.sport) === "prop";
  const side = (r) => (r.selection === "home" ? r.home_name : r.away_name);
  const other = (r) => (r.selection === "home" ? r.away_name : r.home_name);
  const view = (r) => ({
    team: isProp(r) ? String(r.selection === "home" ? "No" : "Yes") : String(side(r)),
    opponent: isProp(r) ? null : String(other(r)),
    question: isProp(r) ? String(r.question || "") : null,
    sport: String(r.sport || ""), league: String(r.league || ""),
    line: Number.isInteger(r.odds_locked) ? r.odds_locked : null,
    wager: Number(r.wager), profit: Number(r.profit || 0), allIn: Boolean(r.all_in),
    at: toMs(r.starts_at) ? new Date(toMs(r.starts_at)).toISOString() : null
  });

  const won = mine.filter((r) => r.status === "WON").sort((a, b) => b.profit - a.profit);
  const lost = mine.filter((r) => r.status === "LOST").sort((a, b) => Number(b.all_in) - Number(a.all_in) || b.wager - a.wager);
  const allIns = mine.filter((r) => r.all_in);

  // The team they rode with: most picks on one side, props aside.
  const teams = new Map();
  for (const r of mine.filter((x) => !isProp(x))) {
    const key = String(side(r));
    const t = teams.get(key) || { name: key, sport: String(r.sport || ""), league: String(r.league || ""), picks: 0, wins: 0, losses: 0, profit: 0 };
    t.picks += 1;
    if (r.status === "WON") t.wins += 1; else t.losses += 1;
    t.profit += Number(r.profit || 0);
    teams.set(key, t);
  }
  let team = [...teams.values()].sort((a, b) => b.picks - a.picks || b.profit - a.profit)[0] || null;
  if (team && team.picks < 3) team = null;
  if (team) {
    // Did anyone in chat back that team more often?
    const counts = new Map();
    for (const r of settledAll) if (!isProp(r) && String(side(r)) === team.name) counts.set(r.user_id, (counts.get(r.user_id) || 0) + 1);
    team.mostInChat = [...counts.entries()].every(([id, n]) => String(id) === uid || n < team.picks);
  }

  return {
    wins, losses, profit, staked, picks: mine.length,
    accuracy: Math.round((100 * wins) / mine.length),
    bestRun,
    rank: at === -1 ? null : at + 1,
    players: ladder.length,
    beat: at === -1 ? 0 : ladder.length - (at + 1),
    biggestWin: won[0] ? view(won[0]) : null,
    worstBeat: lost[0] ? view(lost[0]) : null,
    allIns: { total: allIns.length, won: allIns.filter((r) => r.status === "WON").length },
    team
  };
}

/* ---------------------------------------------------------- casino */

const GAME_NAMES = { flip: "Coin Flip", wheel: "Wheel", race: "Horse Race", hilo: "Higher or Lower", mines: "Mines", plinko: "Plinko", scratch: "Scratch-Off", roulette: "Russian Roulette", standing: "Last One Standing", redlight: "Red Light, Green Light" };

async function casinoPart(db, uid, from, to) {
  const a = sqlStamp(from), b = sqlStamp(to);
  const [coin, shared, hilo, mines, plinko, pvp, scratch] = await Promise.all([
    safeAll(db.prepare(`SELECT 'flip' AS game, status, payout - wager AS profit, wager, created_at AS at FROM coin_bets
                         WHERE user_id = ? AND status IN ('WON','LOST') AND created_at >= ? AND created_at < ?`).bind(uid, a, b)),
    safeAll(db.prepare(`SELECT game, status, payout - wager AS profit, wager, created_at AS at FROM casino_bets
                         WHERE user_id = ? AND status IN ('WON','LOST') AND created_at >= ? AND created_at < ?`).bind(uid, a, b)),
    safeAll(db.prepare(`SELECT 'hilo' AS game, CASE WHEN status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status,
                               CASE WHEN status = 'CASHED' THEN payout - stake ELSE -stake END AS profit, stake AS wager, updated_at AS at
                          FROM hilo_games WHERE user_id = ? AND status IN ('CASHED','BUST') AND updated_at >= ? AND updated_at < ?`).bind(uid, a, b)),
    safeAll(db.prepare(`SELECT 'mines' AS game, CASE WHEN status = 'CASHED' THEN 'WON' ELSE 'LOST' END AS status,
                               CASE WHEN status = 'CASHED' THEN payout - stake ELSE -stake END AS profit, stake AS wager, updated_at AS at,
                               mines, multiplier
                          FROM mines_games WHERE user_id = ? AND status IN ('CASHED','BUST') AND updated_at >= ? AND updated_at < ?`).bind(uid, a, b)),
    safeAll(db.prepare(`SELECT 'plinko' AS game, CASE WHEN payout > stake THEN 'WON' ELSE 'LOST' END AS status, payout - stake AS profit, stake AS wager, created_at AS at
                          FROM plinko_drops WHERE user_id = ? AND created_at >= ? AND created_at < ?`).bind(uid, a, b)),
    safeAll(db.prepare(`SELECT game, status, payout - stake AS profit, stake AS wager, created_at AS at FROM pvp_entries
                         WHERE user_id = ? AND status IN ('WON','LOST') AND created_at >= ? AND created_at < ?`).bind(uid, a, b)),
    safeAll(db.prepare(`SELECT 'scratch' AS game, CASE WHEN payout > stake THEN 'WON' ELSE 'LOST' END AS status, payout - stake AS profit, stake AS wager, created_at AS at
                          FROM scratch_cards WHERE user_id = ? AND created_at >= ? AND created_at < ?`).bind(uid, a, b))
  ]);
  const all = [...coin, ...shared, ...hilo, ...mines, ...plinko, ...pvp, ...scratch];
  if (!all.length) return null;

  const perGame = {};
  const byDay = Object.fromEntries(WEEK.map((d) => [d, 0]));
  let net = 0, staked = 0, wins = 0, biggest = null;
  for (const r of all) {
    const profit = Number(r.profit || 0);
    const g = perGame[r.game] || (perGame[r.game] = { game: r.game, name: GAME_NAMES[r.game] || r.game, plays: 0, net: 0 });
    g.plays += 1; g.net += profit;
    net += profit; staked += Number(r.wager || 0);
    if (r.status === "WON") wins += 1;
    if (profit > 0 && (!biggest || profit > biggest.profit)) biggest = { game: r.game, name: g.name, profit };
    const day = weekdayCT.format(new Date(toMs(r.at)));
    if (day in byDay) byDay[day] += 1;
  }
  const favourite = Object.values(perGame).sort((x, y) => y.plays - x.plays)[0];
  const topDay = WEEK.reduce((best, d) => (byDay[d] > byDay[best] ? d : best), WEEK[0]);
  const cashed = mines.filter((m) => m.status === "WON");
  return {
    plays: all.length, wins, losses: all.length - wins, net, staked,
    biggest, favourite,
    byDay: WEEK.map((d) => ({ day: d, plays: byDay[d] })),
    topDay: { day: topDay, share: Math.round((100 * byDay[topDay]) / all.length) },
    mines: mines.length ? {
      boards: mines.length,
      tenBomb: mines.filter((m) => Number(m.mines) >= 10).length,
      bestX: cashed.length ? Math.max(...cashed.map((m) => Number(m.multiplier) || 0)) : null
    } : null
  };
}

/* ---------------------------------------------------------- music */

async function musicPart(env, login, from, to) {
  const base = String(env.MUSIC_ROOM_URL || DEFAULT_MUSIC_ROOM).trim().replace(/\/$/, "");
  let payload = null;
  try {
    const r = await fetch(`${base}/history/main`, { cf: { cacheTtl: 120, cacheEverything: true } });
    payload = r.ok ? await r.json() : null;
  } catch { payload = null; }
  if (!payload) return null;

  const stats = (payload.userStats || []).find((s) => String(s.login || "").toLowerCase() === login) || null;
  const mine = (payload.history || []).filter((h) => {
    if (String(h.requestedByLogin || "").toLowerCase() !== login) return false;
    const t = Number(h.playedAt || h.requestedAt || 0);
    return t >= from && t < to;
  });
  if (!mine.length && !stats) return null;

  const titles = new Map();
  for (const h of mine) titles.set(h.title, (titles.get(h.title) || 0) + 1);
  const top = [...titles.entries()].sort((x, y) => y[1] - x[1])[0] || null;
  const topVideo = top ? mine.find((h) => h.title === top[0])?.videoId || "" : "";

  // The Music ELO tab's tiers: rank 1, last is bronze, else by rating.
  const rated = (payload.userStats || []).filter((s) => Number(s.rated) > 0).sort((x, y) => Number(y.rating || 0) - Number(x.rating || 0));
  const r = stats ? Math.round(Number(stats.rating) || 1000) : null;
  const tier = !stats || !Number(stats.rated) ? null
    : rated[0]?.login === stats.login ? "Rank 1"
      : rated.length > 1 && rated[rated.length - 1]?.login === stats.login ? "Bronze"
        : r >= 1015 ? "Gold" : r >= 1000 ? "Silver" : "Bronze";

  return {
    requests: mine.length,
    top: top ? { title: String(top[0] || "Untitled"), times: top[1], videoId: topVideo } : null,
    rating: stats && Number(stats.rated) ? r : null,
    tier,
    good: stats ? Number(stats.up || 0) + Number(stats.fire || 0) : 0,
    fire: stats ? Number(stats.fire || 0) : 0,
    bad: stats ? Number(stats.trash || 0) + Number(stats.del || 0) : 0
  };
}

/* ---------------------------------------------------------- movies */

async function moviesPart(db, uid, from, to) {
  const a = sqlStamp(from), b = sqlStamp(to);
  const [rows, others, rooms] = await Promise.all([
    safeAll(db.prepare(`SELECT type, tmdb_id, score, title, poster, year FROM title_ratings
                         WHERE user_id = ? AND updated_at >= ? AND updated_at < ? ORDER BY score DESC, updated_at DESC`).bind(uid, a, b)),
    safeAll(db.prepare(`SELECT r.type, r.tmdb_id, COUNT(o.score) AS n, AVG(o.score) AS avg,
                               SUM(CASE WHEN o.score >= 3 THEN 1 ELSE 0 END) AS fresh
                          FROM title_ratings r JOIN title_ratings o ON o.type = r.type AND o.tmdb_id = r.tmdb_id AND o.user_id <> r.user_id
                         WHERE r.user_id = ? GROUP BY r.type, r.tmdb_id HAVING COUNT(o.score) >= 2`).bind(uid)),
    safeAll(db.prepare(`SELECT created_at, updated_at, ended_at FROM watch_rooms WHERE host_id = ? AND created_at >= ? AND created_at < ?`).bind(uid, from, to))
  ]);
  if (!rows.length && !rooms.length) return null;

  const chat = new Map(others.map((o) => [`${o.type}:${o.tmdb_id}`, o]));
  let hottest = null;
  for (const r of rows) {
    const o = chat.get(`${r.type}:${r.tmdb_id}`);
    if (!o) continue;
    const gap = Math.abs(Number(r.score) - Number(o.avg));
    if (gap >= 2 && (!hottest || gap > hottest.gap)) {
      hottest = { title: String(r.title), score: Number(r.score), chatAvg: Math.round(Number(o.avg) * 10) / 10, chatFresh: Math.round((100 * Number(o.fresh)) / Number(o.n)), gap };
    }
  }
  const card = (r) => ({ type: String(r.type), id: Number(r.tmdb_id), title: String(r.title), poster: String(r.poster || ""), year: String(r.year || ""), score: Number(r.score) });
  const hours = rooms.reduce((n, room) => {
    const end = Number(room.ended_at || room.updated_at || room.created_at);
    return n + Math.min(6 * 3600000, Math.max(0, end - Number(room.created_at)));
  }, 0) / 3600000;

  return {
    rated: rows.length,
    avg: rows.length ? Math.round((rows.reduce((n, r) => n + Number(r.score), 0) / rows.length) * 10) / 10 : null,
    // Their best three, then the one at the bottom if it is a real stinker.
    shelf: [...rows.slice(0, 2).map(card), ...(rows.length > 2 ? [card(rows[rows.length - 1])] : [])],
    hottest,
    rooms: rooms.length,
    roomHours: Math.round(hours * 10) / 10
  };
}

/* ---------------------------------------------------------- the award */

function awardFor(p, c, m, mv) {
  const rules = [
    [p?.rank === 1, "🏆", "Season Champion", "Top of the Picks ladder. Everyone else was playing for second."],
    [(p?.allIns.total || 0) >= 3 || (c?.mines?.tenBomb || 0) >= 20, "🎰", "Most Likely to Go All-In",
      `${p?.allIns.total || 0} all-in${p?.allIns.total === 1 ? "" : "s"} on Picks and ${c?.mines?.tenBomb || 0} ten-bomb Mines boards.`],
    [(c?.net || 0) >= 500, "💰", "Casino Menace", `Took the house for ${c?.net} ZC. They noticed.`],
    [(c?.plays || 0) >= 800, "⚙️", "The Grinder", `${c?.plays} casino plays. The tables know your name.`],
    [(m?.requests || 0) >= 50, "🎧", "Chat's DJ", `${m?.requests} songs queued in the Green Room.`],
    [(p?.accuracy || 0) >= 60 && (p?.picks || 0) >= 20, "🎯", "Sharpshooter", `${p?.accuracy}% of your picks came in.`],
    [(p?.team?.picks || 0) >= 8 && p.team.picks / p.picks >= 0.4, "🫡", "Loyal to a Fault", `${p?.team?.picks} picks on the ${p?.team?.name}.`],
    [(mv?.rated || 0) >= 8 && (mv?.avg ?? 5) <= 2.5, "🍅", "Harshest Critic", `An average of ${mv?.avg} tomatoes. Nothing impresses you.`],
    [(mv?.rated || 0) >= 8 && (mv?.avg ?? 0) >= 4.2, "🍿", "Easiest to Please", `An average of ${mv?.avg} tomatoes. You loved it all.`],
    [(mv?.rooms || 0) >= 3, "🛋️", "Couch Captain", `${mv?.rooms} watch rooms hosted.`],
    [(c?.net || 0) <= -300, "🏦", "The House's Best Friend", `Down ${Math.abs(c?.net || 0)} ZC at the tables. The house says thanks.`],
    [(p?.losses || 0) >= (p?.wins || 0) + 8, "🧲", "Bad Beat Magnet", `${p?.losses} losses. Some of them were robbery.`]
  ];
  const hit = rules.find(([ok]) => ok);
  const [, emoji, title, line] = hit || [true, "✨", "Here for the Vibes", "You showed up, and that counts."];
  return { emoji, title, line };
}

/* ---------------------------------------------------------- entry */

export async function buildWrapped(env, db, user, { from, to }) {
  const uid = String(user.twitch_id);
  const login = String(user.twitch_login || "").toLowerCase();
  const [picks, casino, music, movies] = await Promise.all([
    picksPart(db, uid).catch(() => null),
    casinoPart(db, uid, from, to).catch(() => null),
    musicPart(env, login, from, to).catch(() => null),
    moviesPart(db, uid, from, to).catch(() => null)
  ]);
  return { picks, casino, music, movies, award: awardFor(picks, casino, music, movies) };
}
