import { WAGER_ALLOWLIST, wageringOpenToAll } from "./_lib.js";

const SESSION_COOKIE = "__Host-ec_session";

// ZCoins are StreamElements loyalty points. Their points API is public and
// unauthenticated for reads, so balances come straight from the same numbers
// !points reports in chat — there is only ever one balance, and EastCoin is
// not a second source of truth for it.
const SE_POINTS_API = "https://api.streamelements.com/kappa/v2/points";
const SE_CHANNEL_ID_FALLBACK = "65107c296068cc894e4ac7b9";
const SE_TIMEOUT_MS = 4000;

// There is no cap on a pick beyond what someone actually holds — the old
// "15% of wallet, 50 max" rule is gone. It had the side effect of locking out
// anyone under 7 ZCoins entirely, since 15% of 6 floors to zero.
const WAGER_MIN = 1;

function walletMaxWager(balance) {
  const affordable = Math.floor(balance);
  return affordable >= WAGER_MIN ? affordable : 0;
}

function disconnectedWallet(status = "not_connected") {
  return {
    connected: false,
    balance: 0,
    maxWager: 0,
    provider: "streamelements",
    status
  };
}

// Never throws and never blocks the page — an unreachable StreamElements
// degrades Picks to a signed-in-but-no-balance state rather than failing the
// whole bootstrap.
async function fetchZCoinWallet(env, login) {
  const channelId = String(
    env?.STREAMELEMENTS_CHANNEL_ID || SE_CHANNEL_ID_FALLBACK
  ).trim();

  const user = String(login || "").trim().toLowerCase();

  if (!channelId || !user) return disconnectedWallet();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SE_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${SE_POINTS_API}/${encodeURIComponent(channelId)}/${encodeURIComponent(user)}`,
      { signal: controller.signal }
    );

    // A viewer StreamElements has never seen has no row yet — that's a real
    // zero balance, not a broken integration.
    if (response.status === 404) {
      return {
        ...disconnectedWallet("no_balance"),
        connected: true
      };
    }

    if (!response.ok) return disconnectedWallet("provider_error");

    const payload = await response.json();
    const balance = Math.max(0, Math.floor(Number(payload?.points) || 0));

    return {
      connected: true,
      balance,
      maxWager: walletMaxWager(balance),
      provider: "streamelements",
      status: "connected",
      rank: Number(payload?.rank) || null,
      watchtime: Number(payload?.watchtime) || null
    };
  } catch {
    return disconnectedWallet("provider_error");
  } finally {
    clearTimeout(timer);
  }
}

function parseCookies(request) {
  const header =
    request.headers.get("Cookie") ||
    "";

  const result = {};

  for (
    const part of header.split(";")
  ) {
    const index =
      part.indexOf("=");

    if (index < 0) continue;

    const name =
      part.slice(0, index).trim();

    const value =
      part.slice(index + 1).trim();

    if (!name) continue;

    try {
      result[name] =
        decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }

  return result;
}

async function sha256(value) {
  const encoded =
    new TextEncoder().encode(
      value
    );

  const digest =
    await crypto.subtle.digest(
      "SHA-256",
      encoded
    );

  return [
    ...new Uint8Array(digest)
  ]
    .map(
      (byte) =>
        byte
          .toString(16)
          .padStart(2, "0")
    )
    .join("");
}

async function getSessionUser(
  db,
  request
) {
  const cookies =
    parseCookies(request);

  const rawToken =
    cookies[SESSION_COOKIE];

  if (!rawToken) return null;

  const sessionHash =
    await sha256(rawToken);

  const row =
    await db
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
    id:
      String(row.twitch_id),
    login:
      String(row.twitch_login),
    displayName:
      String(row.display_name),
    profileImageUrl:
      String(
        row.avatar_url || ""
      )
  };
}

async function getMarkets(db) {
  const result =
    await db
      .prepare(
        `SELECT
           m.id,
           m.provider_event_id,
           m.sport,
           m.league,
           m.away_name,
           m.away_badge,
           m.home_name,
           m.home_badge,
           m.starts_at,
           m.state,
           m.away_pool_locked,
           m.home_pool_locked,
           m.total_pool_locked,
           m.away_multiplier_locked,
           m.home_multiplier_locked,
           m.away_odds_locked,
           m.home_odds_locked,
           COALESCE(
             pools.away_pool,
             0
           ) AS current_away_pool,
           COALESCE(
             pools.home_pool,
             0
           ) AS current_home_pool,
           COALESCE(
             pools.away_tickets,
             0
           ) AS current_away_tickets,
           COALESCE(
             pools.home_tickets,
             0
           ) AS current_home_tickets
         FROM markets m
         LEFT JOIN (
           SELECT
             market_id,
             SUM(
               CASE
                 WHEN
                   status = 'ACTIVE'
                   AND selection = 'away'
                 THEN wager
                 ELSE 0
               END
             ) AS away_pool,
             SUM(
               CASE
                 WHEN
                   status = 'ACTIVE'
                   AND selection = 'home'
                 THEN wager
                 ELSE 0
               END
             ) AS home_pool,
             SUM(
               CASE
                 WHEN
                   status = 'ACTIVE'
                   AND selection = 'away'
                 THEN 1
                 ELSE 0
               END
             ) AS away_tickets,
             SUM(
               CASE
                 WHEN
                   status = 'ACTIVE'
                   AND selection = 'home'
                 THEN 1
                 ELSE 0
               END
             ) AS home_tickets
           FROM picks
           GROUP BY market_id
         ) pools
           ON pools.market_id = m.id
         WHERE
           m.state IN (
             'OPEN',
             'LOCKED'
           )
         ORDER BY
           datetime(m.starts_at) ASC
         LIMIT 100`
      )
      .all();

  return (
    result.results || []
  ).map((row) => {
    const locked =
      String(
        row.state || ""
      ).toUpperCase() ===
        "LOCKED" &&
      row.total_pool_locked != null;

    const awayPool =
      Number(
        locked
          ? row.away_pool_locked ||
            0
          : row.current_away_pool ||
            0
      );

    const homePool =
      Number(
        locked
          ? row.home_pool_locked ||
            0
          : row.current_home_pool ||
            0
      );

    return {
      id:
        String(row.id),
      eventId:
        String(
          row.provider_event_id ||
          ""
        ),
      sport:
        String(row.sport || ""),
      league:
        String(row.league || ""),
      away: {
        name:
          String(
            row.away_name ||
            "Away"
          ),
        badge:
          String(
            row.away_badge ||
            ""
          )
      },
      home: {
        name:
          String(
            row.home_name ||
            "Home"
          ),
        badge:
          String(
            row.home_badge ||
            ""
          )
      },
      startsAt:
        row.starts_at,
      awayOdds:
        row.away_odds_locked ==
        null
          ? null
          : Number(
              row.away_odds_locked
            ),
      homeOdds:
        row.home_odds_locked ==
        null
          ? null
          : Number(
              row.home_odds_locked
            ),
      state:
        String(
          row.state || "OPEN"
        ),
      pool: {
        awayZcoins:
          awayPool,
        homeZcoins:
          homePool,
        awayTickets:
          Number(
            row.current_away_tickets ||
            0
          ),
        homeTickets:
          Number(
            row.current_home_tickets ||
            0
          ),
        totalZcoins:
          awayPool +
          homePool
      },
      finalOdds: {
        away:
          row.away_multiplier_locked ==
          null
            ? null
            : Number(
                row.away_multiplier_locked
              ),
        home:
          row.home_multiplier_locked ==
          null
            ? null
            : Number(
                row.home_multiplier_locked
              )
      }
    };
  });
}

async function getMyPicks(
  db,
  userId
) {
  if (!userId) return [];

  const result =
    await db
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
         ORDER BY
           datetime(p.created_at) DESC
         LIMIT 100`
      )
      .bind(userId)
      .all();

  return (
    result.results || []
  ).map(
    (row) => ({
      id:
        String(row.id),
      marketId:
        String(
          row.market_id
        ),
      selection:
        String(
          row.selection
        ),
      wager:
        Number(
          row.wager || 0
        ),
      status:
        String(
          row.status || ""
        ).toUpperCase(),
      finalMultiplier:
        row.final_multiplier ==
        null
          ? null
          : Number(
              row.final_multiplier
            ),
      payout:
        Number(
          row.payout || 0
        ),
      profit:
        Number(
          row.profit || 0
        ),
      createdAt:
        row.created_at,
      settledAt:
        row.settled_at,
      market: {
        id:
          String(
            row.market_id
          ),
        sport:
          String(
            row.sport || ""
          ),
        league:
          String(
            row.league || ""
          ),
        away: {
          name:
            String(
              row.away_name ||
              "Away"
            ),
          badge:
            String(
              row.away_badge ||
              ""
            )
        },
        home: {
          name:
            String(
              row.home_name ||
              "Home"
            ),
          badge:
            String(
              row.home_badge ||
              ""
            )
        },
        startsAt:
          row.starts_at,
        state:
          String(
            row.state || ""
          )
      }
    })
  );
}

async function activeSeason(db) {
  return db
    .prepare(
      `SELECT
         id,
         name
       FROM seasons
       WHERE active = 1
       LIMIT 1`
    )
    .first();
}

async function getSeason(
  db,
  userId
) {
  const season =
    await activeSeason(db);

  if (!season) {
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
      id: season.id,
      name: season.name,
      wins: 0,
      losses: 0,
      profit: 0,
      accuracy: null,
      rank: null,
      rankTitle: ""
    };
  }

  const stats =
    await db
      .prepare(
        `SELECT
           wins,
           losses,
           picks_profit
         FROM user_season_stats
         WHERE
           user_id = ?
           AND season_id = ?
         LIMIT 1`
      )
      .bind(
        userId,
        season.id
      )
      .first();

  const wins =
    Number(
      stats?.wins || 0
    );

  const losses =
    Number(
      stats?.losses || 0
    );

  return {
    id: season.id,
    name: season.name,
    wins,
    losses,
    profit:
      Number(
        stats?.picks_profit ||
        0
      ),
    accuracy:
      wins + losses
        ? Math.round(
            (
              wins /
              (wins + losses)
            ) * 100
          )
        : null,
    rank: null,
    rankTitle: ""
  };
}

async function getLeaderboard(db) {
  const season =
    await activeSeason(db);

  if (!season) return [];

  const result =
    await db
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
         LIMIT 100`
      )
      .bind(season.id)
      .all();

  return (
    result.results || []
  ).map(
    (row, index) => ({
      rank:
        index + 1,
      profit:
        Number(
          row.picks_profit ||
          0
        ),
      wins:
        Number(
          row.wins || 0
        ),
      losses:
        Number(
          row.losses || 0
        ),
      user: {
        id:
          String(
            row.twitch_id
          ),
        login:
          String(
            row.twitch_login
          ),
        displayName:
          String(
            row.display_name
          ),
        profileImageUrl:
          String(
            row.avatar_url ||
            ""
          )
      }
    })
  );
}

function pickedName(row) {
  return (
    row.selection === "away"
      ? row.away_name
      : row.home_name
  );
}

function opponentName(row) {
  return (
    row.selection === "away"
      ? row.home_name
      : row.away_name
  );
}

async function getPersonalHistory(
  db,
  userId
) {
  if (!userId) return [];

  const result =
    await db
      .prepare(
        `SELECT
           p.id,
           p.selection,
           p.wager,
           p.status,
           p.payout,
           p.profit,
           p.created_at,
           p.settled_at,
           m.away_name,
           m.home_name
         FROM picks p
         JOIN markets m
           ON m.id = p.market_id
         WHERE
           p.user_id = ?
           AND p.status IN (
             'ACTIVE',
             'WON',
             'LOST',
             'REFUNDED'
           )
         ORDER BY
           datetime(
             COALESCE(
               p.settled_at,
               p.created_at
             )
           ) DESC
         LIMIT 100`
      )
      .bind(userId)
      .all();

  const history = [];

  for (
    const row of
      result.results || []
  ) {
    const team =
      pickedName(row);

    const opponent =
      opponentName(row);

    history.push({
      id:
        `${row.id}:wager`,
      type: "wager",
      amount:
        -Math.abs(
          Number(
            row.wager || 0
          )
        ),
      title:
        `Pick · ${team}`,
      detail:
        `${team} vs ${opponent}`,
      createdAt:
        row.created_at
    });

    if (
      row.status === "WON" &&
      Number(
        row.payout || 0
      ) > 0
    ) {
      const profit =
        Number(
          row.profit || 0
        );

      history.push({
        id:
          `${row.id}:payout`,
        type: "payout",
        amount:
          Math.abs(
            Number(
              row.payout || 0
            )
          ),
        title:
          `Win · ${team}`,
        detail:
          `Winning Picks return · ${
            profit >= 0
              ? "+"
              : ""
          }${profit} ZCoins net`,
        createdAt:
          row.settled_at ||
          row.created_at
      });
    }

    if (
      row.status ===
      "REFUNDED"
    ) {
      history.push({
        id:
          `${row.id}:refund`,
        type: "refund",
        amount:
          Math.abs(
            Number(
              row.wager || 0
            )
          ),
        title:
          `Refund · ${team}`,
        detail:
          "No Action / voided Picks wager returned",
        createdAt:
          row.settled_at ||
          row.created_at
      });
    }
  }

  return history
    .sort(
      (left, right) =>
        Date.parse(
          right.createdAt || ""
        ) -
        Date.parse(
          left.createdAt || ""
        )
    )
    .slice(0, 150);
}

async function getCommunityLedger(
  db
) {
  const result =
    await db
      .prepare(
        `SELECT
           p.id,
           p.selection,
           p.wager,
           p.status,
           p.final_multiplier,
           p.payout,
           p.profit,
           p.created_at,
           p.settled_at,
           u.twitch_id,
           u.twitch_login,
           u.display_name,
           u.avatar_url,
           m.id AS market_id,
           m.sport,
           m.league,
           m.away_name,
           m.away_badge,
           m.home_name,
           m.home_badge,
           m.starts_at,
           m.state
         FROM picks p
         JOIN users u
           ON u.twitch_id = p.user_id
         JOIN markets m
           ON m.id = p.market_id
         WHERE p.status IN (
           'ACTIVE',
           'WON',
           'LOST',
           'REFUNDED'
         )
         ORDER BY
           datetime(
             COALESCE(
               p.settled_at,
               p.created_at
             )
           ) DESC
         LIMIT 200`
      )
      .all();

  return (
    result.results || []
  ).map(
    (row) => ({
      id:
        String(row.id),
      selection:
        String(
          row.selection
        ),
      wager:
        Number(
          row.wager || 0
        ),
      status:
        String(
          row.status || ""
        ),
      finalMultiplier:
        row.final_multiplier ==
        null
          ? null
          : Number(
              row.final_multiplier
            ),
      payout:
        Number(
          row.payout || 0
        ),
      profit:
        Number(
          row.profit || 0
        ),
      createdAt:
        row.created_at,
      settledAt:
        row.settled_at,
      user: {
        id:
          String(
            row.twitch_id
          ),
        login:
          String(
            row.twitch_login
          ),
        displayName:
          String(
            row.display_name ||
            row.twitch_login
          ),
        profileImageUrl:
          String(
            row.avatar_url ||
            ""
          )
      },
      market: {
        id:
          String(
            row.market_id
          ),
        sport:
          String(
            row.sport || ""
          ),
        league:
          String(
            row.league || ""
          ),
        away: {
          name:
            String(
              row.away_name ||
              "Away"
            ),
          badge:
            String(
              row.away_badge ||
              ""
            )
        },
        home: {
          name:
            String(
              row.home_name ||
              "Home"
            ),
          badge:
            String(
              row.home_badge ||
              ""
            )
        },
        startsAt:
          row.starts_at,
        state:
          String(
            row.state || ""
          )
      }
    })
  );
}

export async function onRequestGet(
  context
) {
  const db =
    context.env.PICKS_DB;

  if (!db) {
    return Response.json(
      {
        ok: false,
        code:
          "PICKS_DB_BINDING_MISSING",
        message:
          "The Picks database is unavailable."
      },
      {
        status: 503,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }

  try {
    const user =
      await getSessionUser(
        db,
        context.request
      );

    const [
      markets,
      myPicks,
      season,
      leaderboard,
      history,
      communityLedger
    ] =
      await Promise.all([
        getMarkets(db),
        getMyPicks(
          db,
          user?.id || null
        ),
        getSeason(
          db,
          user?.id || null
        ),
        getLeaderboard(db),
        getPersonalHistory(
          db,
          user?.id || null
        ),
        getCommunityLedger(
          db
        )
      ]);

    if (
      user &&
      season?.id
    ) {
      const me =
        leaderboard.find(
          (row) =>
            String(
              row?.user?.id ||
              ""
            ) ===
            String(user.id)
        );

      season.rank =
        me?.rank || null;
    }

    // Only signed-in visitors have a balance to look up — a logged-out
    // bootstrap should never make an outbound call on their behalf.
    const wallet = user
      ? await fetchZCoinWallet(context.env, user.login)
      : disconnectedWallet("signed_out");

    return Response.json(
      {
        ok: true,
        phase: "identity",
        session: {
          authenticated:
            Boolean(user),
          user,
          wallet
        },
        season,
        markets,
        myPicks,
        history,
        communityLedger,
        leaderboard,
        config: {
          // Wagering is open only when the server can actually move ZCoins
          // AND this viewer is in the limited test. Reporting a blanket
          // false once /wagers exists would hide a working feature; a
          // blanket true would offer a button that 403s.
          wageringEnabled:
            Boolean(
              String(context.env.STREAMELEMENTS_JWT || "").trim() &&
              user &&
              (wageringOpenToAll(context.env) ||
                WAGER_ALLOWLIST.has(String(user.login || "").toLowerCase()))
            ),
          inWagerTest:
            Boolean(
              user &&
              (wageringOpenToAll(context.env) ||
                WAGER_ALLOWLIST.has(String(user.login || "").toLowerCase()))
            ),
          walletConnected:
            wallet.connected,
          minWager: WAGER_MIN,
          maxWager: wallet.maxWager
        }
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
          "X-Content-Type-Options":
            "nosniff"
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
        code:
          "PICKS_BOOTSTRAP_FAILED",
        message:
          "EastCoin Picks could not load the current session."
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }
}
