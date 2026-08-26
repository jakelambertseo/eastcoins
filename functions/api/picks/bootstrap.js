const SESSION_COOKIE = "__Host-ec_session";

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const result = {};

  for (const part of header.split(";")) {
    const index = part.indexOf("=");

    if (index < 0) continue;

    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    if (!name) continue;

    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }

  return result;
}

async function sha256(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoded
  );

  return [...new Uint8Array(digest)]
    .map((byte) =>
      byte.toString(16).padStart(2, "0")
    )
    .join("");
}

async function getSessionUser(
  db,
  request
) {
  const cookies = parseCookies(request);
  const rawToken = cookies[SESSION_COOKIE];

  if (!rawToken) return null;

  const sessionHash =
    await sha256(rawToken);

  const row = await db
    .prepare(
      `SELECT
         s.session_hash,
         s.expires_at,
         u.twitch_id,
         u.twitch_login,
         u.display_name,
         u.avatar_url
       FROM sessions s
       JOIN users u
         ON u.twitch_id = s.user_id
       WHERE s.session_hash = ?
         AND datetime(s.expires_at) > datetime('now')
       LIMIT 1`
    )
    .bind(sessionHash)
    .first();

  if (!row) {
    // Clean up the exact token if it exists but is expired/invalid.
    await db
      .prepare(
        `DELETE FROM sessions
          WHERE session_hash = ?`
      )
      .bind(sessionHash)
      .run();

    return null;
  }

  await db
    .prepare(
      `UPDATE sessions
          SET last_seen_at = CURRENT_TIMESTAMP
        WHERE session_hash = ?`
    )
    .bind(sessionHash)
    .run();

  return {
    id: String(row.twitch_id),
    login: String(row.twitch_login),
    displayName: String(row.display_name),
    profileImageUrl: String(
      row.avatar_url || ""
    )
  };
}

async function getMarkets(db) {
  const result = await db
    .prepare(
      `SELECT
         id,
         provider_event_id,
         sport,
         league,
         away_name,
         away_badge,
         home_name,
         home_badge,
         starts_at,
         state,
         away_pool_locked,
         home_pool_locked,
         away_multiplier_locked,
         home_multiplier_locked
       FROM markets
       WHERE state IN ('OPEN', 'LOCKED')
       ORDER BY datetime(starts_at) ASC
       LIMIT 100`
    )
    .all();

  return (result.results || []).map(
    (row) => ({
      id: String(row.id),
      eventId: String(
        row.provider_event_id || ""
      ),
      sport: String(row.sport || ""),
      league: String(row.league || ""),
      away: {
        name: String(row.away_name || "Away"),
        badge: String(row.away_badge || "")
      },
      home: {
        name: String(row.home_name || "Home"),
        badge: String(row.home_badge || "")
      },
      startsAt: row.starts_at,
      state: String(row.state || "OPEN"),
      pool: {
        awayZcoins: Number(
          row.away_pool_locked || 0
        ),
        homeZcoins: Number(
          row.home_pool_locked || 0
        ),
        awayTickets: 0,
        homeTickets: 0,
        totalZcoins:
          Number(row.away_pool_locked || 0) +
          Number(row.home_pool_locked || 0)
      },
      finalOdds: {
        away:
          row.away_multiplier_locked == null
            ? null
            : Number(row.away_multiplier_locked),
        home:
          row.home_multiplier_locked == null
            ? null
            : Number(row.home_multiplier_locked)
      }
    })
  );
}

async function getMyPicks(
  db,
  userId
) {
  if (!userId) return [];

  const result = await db
    .prepare(
      `SELECT
         p.id,
         p.market_id,
         p.selection,
         p.wager,
         p.status,
         p.final_multiplier,
         p.payout,
         p.profit,
         p.created_at,
         p.settled_at,
         m.sport,
         m.league,
         m.away_name,
         m.away_badge,
         m.home_name,
         m.home_badge,
         m.starts_at,
         m.state
       FROM picks p
       JOIN markets m
         ON m.id = p.market_id
       WHERE p.user_id = ?
       ORDER BY datetime(p.created_at) DESC
       LIMIT 100`
    )
    .bind(userId)
    .all();

  return (result.results || []).map(
    (row) => ({
      id: String(row.id),
      marketId: String(row.market_id),
      selection: String(row.selection),
      wager: Number(row.wager || 0),
      status: String(row.status || "").toLowerCase(),
      finalMultiplier:
        row.final_multiplier == null
          ? null
          : Number(row.final_multiplier),
      payout: Number(row.payout || 0),
      profit: Number(row.profit || 0),
      createdAt: row.created_at,
      settledAt: row.settled_at,
      market: {
        id: String(row.market_id),
        sport: String(row.sport || ""),
        league: String(row.league || ""),
        away: {
          name: String(row.away_name || "Away"),
          badge: String(row.away_badge || "")
        },
        home: {
          name: String(row.home_name || "Home"),
          badge: String(row.home_badge || "")
        },
        startsAt: row.starts_at,
        state: String(row.state || "")
      }
    })
  );
}

async function getSeason(
  db,
  userId
) {
  const activeSeason = await db
    .prepare(
      `SELECT id, name
         FROM seasons
        WHERE active = 1
        LIMIT 1`
    )
    .first();

  if (!activeSeason) {
    return {
      id: null,
      name: null,
      wins: 0,
      losses: 0,
      profit: 0,
      accuracy: null,
      rank: null,
      rankTitle: ""
    };
  }

  if (!userId) {
    return {
      id: activeSeason.id,
      name: activeSeason.name,
      wins: 0,
      losses: 0,
      profit: 0,
      accuracy: null,
      rank: null,
      rankTitle: ""
    };
  }

  const stats = await db
    .prepare(
      `SELECT
         wins,
         losses,
         picks_profit
       FROM user_season_stats
       WHERE user_id = ?
         AND season_id = ?
       LIMIT 1`
    )
    .bind(
      userId,
      activeSeason.id
    )
    .first();

  const wins = Number(stats?.wins || 0);
  const losses = Number(stats?.losses || 0);

  return {
    id: activeSeason.id,
    name: activeSeason.name,
    wins,
    losses,
    profit: Number(
      stats?.picks_profit || 0
    ),
    accuracy:
      wins + losses
        ? Math.round(
            (wins / (wins + losses)) * 100
          )
        : null,
    rank: null,
    rankTitle: ""
  };
}

async function getLeaderboard(db) {
  const activeSeason = await db
    .prepare(
      `SELECT id
         FROM seasons
        WHERE active = 1
        LIMIT 1`
    )
    .first();

  if (!activeSeason) return [];

  const result = await db
    .prepare(
      `SELECT
         u.twitch_id,
         u.twitch_login,
         u.display_name,
         u.avatar_url,
         s.wins,
         s.losses,
         s.picks_profit
       FROM user_season_stats s
       JOIN users u
         ON u.twitch_id = s.user_id
       WHERE s.season_id = ?
       ORDER BY
         s.picks_profit DESC,
         s.wins DESC,
         u.twitch_login ASC
       LIMIT 50`
    )
    .bind(activeSeason.id)
    .all();

  return (result.results || []).map(
    (row, index) => ({
      rank: index + 1,
      profit: Number(
        row.picks_profit || 0
      ),
      wins: Number(row.wins || 0),
      losses: Number(row.losses || 0),
      wallet: 0,
      user: {
        id: String(row.twitch_id),
        login: String(row.twitch_login),
        displayName: String(row.display_name),
        profileImageUrl: String(
          row.avatar_url || ""
        )
      }
    })
  );
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;

  if (!db) {
    return Response.json(
      {
        ok: false,
        code: "PICKS_DB_BINDING_MISSING",
        message: "The Picks database is unavailable."
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  try {
    const user = await getSessionUser(
      db,
      context.request
    );

    const [
      markets,
      myPicks,
      season,
      leaderboard
    ] = await Promise.all([
      getMarkets(db),
      getMyPicks(db, user?.id || null),
      getSeason(db, user?.id || null),
      getLeaderboard(db)
    ]);

    return Response.json(
      {
        ok: true,
        phase: "identity",
        session: {
          authenticated: Boolean(user),
          user,
          wallet: {
            connected: false,
            balance: 0,
            maxWager: 0,
            provider: "streamelements",
            status: "not_connected"
          }
        },
        season,
        markets,
        myPicks,
        history: [],
        leaderboard,
        config: {
          wageringEnabled: false,
          walletConnected: false,
          minWager: 1,
          maxWager: 0
        }
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  } catch (error) {
    console.error(
      "Picks bootstrap failed",
      error
    );

    return Response.json(
      {
        ok: false,
        code: "PICKS_BOOTSTRAP_FAILED",
        message: "EastCoin Picks could not load the current session."
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
