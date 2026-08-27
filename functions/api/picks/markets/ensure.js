function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function safeText(value, max = 180) {
  return String(value || "")
    .trim()
    .slice(0, max);
}

function safeBadge(value) {
  const raw = safeText(value, 1000);

  if (!raw) return "";

  try {
    const url = new URL(raw);

    return ["https:", "http:"].includes(url.protocol)
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function familyFromSportKey(value) {
  const key = String(value || "").toLowerCase();

  if (key.startsWith("americanfootball")) return "american-football";
  if (key.startsWith("baseball")) return "baseball";
  if (key.startsWith("basketball")) return "basketball";
  if (key.startsWith("icehockey")) return "hockey";
  if (key.startsWith("soccer")) return "soccer";
  if (key.startsWith("mma") || key.startsWith("boxing")) return "combat";
  if (key.startsWith("tennis")) return "tennis";

  return "other";
}

function allowedMoneylineSportKey(value) {
  const key = String(value || "").toLowerCase();

  return (
    key.startsWith("americanfootball_") ||
    key.startsWith("baseball_") ||
    key === "mma_mixed_martial_arts"
  );
}

async function poolForMarket(db, marketId) {
  const result = await db
    .prepare(
      `SELECT
         selection,
         COALESCE(SUM(wager), 0) AS total_wager,
         COUNT(*) AS ticket_count
       FROM picks
       WHERE market_id = ?
         AND status IN ('PENDING_PAYMENT', 'ACTIVE')
       GROUP BY selection`
    )
    .bind(marketId)
    .all();

  let away = 0;
  let home = 0;
  let awayCount = 0;
  let homeCount = 0;

  for (const row of result.results || []) {
    if (row.selection === "away") {
      away = Number(row.total_wager || 0);
      awayCount = Number(row.ticket_count || 0);
    }

    if (row.selection === "home") {
      home = Number(row.total_wager || 0);
      homeCount = Number(row.ticket_count || 0);
    }
  }

  return {
    away,
    home,
    total: away + home,
    awayCount,
    homeCount
  };
}

async function findMarket(db, providerEventId) {
  return db
    .prepare(
      `SELECT
         id,
         provider,
         provider_event_id,
         season_id,
         sport,
         league,
         away_name,
         away_badge,
         home_name,
         home_badge,
         starts_at,
         state
       FROM markets
       WHERE provider = 'odds_api'
         AND provider_event_id = ?
       LIMIT 1`
    )
    .bind(providerEventId)
    .first();
}

async function activeSeason(db) {
  return db
    .prepare(
      `SELECT id, name
       FROM seasons
       WHERE active = 1
       LIMIT 1`
    )
    .first();
}

async function verifiedOddsEvent(context, input) {
  const url = new URL("/api/v2/card-odds", context.request.url);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      events: [{
        id: "quick-bet-verify",
        title: safeText(input.title, 240),
        sport: safeText(input.sport, 80),
        startsAt: Number(input.startsAt || 0) || null,
        away: safeText(input.away, 160),
        home: safeText(input.home, 160)
      }]
    })
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    const error = new Error(
      payload?.message ||
      "The Odds API could not verify this event."
    );

    error.code = payload?.code || "ODDS_VERIFY_FAILED";
    throw error;
  }

  const result = payload.odds?.["quick-bet-verify"];

  if (!result?.providerEventId) {
    const error = new Error(
      "This event is not currently available from the verified Odds API catalog."
    );

    error.code = "ODDS_EVENT_NOT_FOUND";
    throw error;
  }

  const requestedProviderId = safeText(
    input.providerEventId,
    200
  );

  if (
    requestedProviderId &&
    requestedProviderId !== String(result.providerEventId)
  ) {
    const error = new Error(
      "The event changed while the market was being prepared. Refresh Events and try again."
    );

    error.code = "ODDS_EVENT_MISMATCH";
    throw error;
  }

  if (!allowedMoneylineSportKey(result.sportKey)) {
    const error = new Error(
      "EastCoin Picks currently allows moneyline betting only on football, baseball, and UFC/MMA."
    );

    error.code = "MONEYLINE_SPORT_NOT_ALLOWED";
    throw error;
  }

  if (
    !Number.isFinite(Number(result?.away?.american)) ||
    !Number.isFinite(Number(result?.home?.american))
  ) {
    const error = new Error(
      "This event does not currently have a verified moneyline available."
    );

    error.code = "MONEYLINE_NOT_AVAILABLE";
    throw error;
  }

  const startsAt = Date.parse(result.commenceTime || "");

  if (
    !Number.isFinite(startsAt) ||
    startsAt <= Date.now()
  ) {
    const error = new Error(
      "Betting is closed because this game has already started."
    );

    error.code = "MARKET_ALREADY_STARTED";
    throw error;
  }

  return {
    ...result,
    startsAt
  };
}

function marketPayload(row, pool) {
  return {
    id: String(row.id),
    provider: String(row.provider || "odds_api"),
    providerEventId: String(row.provider_event_id || ""),
    seasonId: String(row.season_id || ""),
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
    pool
  };
}

export async function onRequestPost(context) {
  const db = context.env.PICKS_DB;

  if (!db) {
    return json({
      ok: false,
      code: "PICKS_DB_BINDING_MISSING",
      message: "The Picks database is unavailable."
    }, 503);
  }

  let input;

  try {
    input = await context.request.json();
  } catch {
    return json({
      ok: false,
      code: "INVALID_JSON",
      message: "A valid event payload is required."
    }, 400);
  }

  const away = safeText(input?.away, 160);
  const home = safeText(input?.home, 160);

  if (!away || !home) {
    return json({
      ok: false,
      code: "TEAMS_REQUIRED",
      message: "Both teams are required to prepare a Picks market."
    }, 400);
  }

  try {
    // Re-verify server-side against the same shared cached provider feed used
    // by the card odds. Client-supplied provider IDs are never trusted alone.
    const verified = await verifiedOddsEvent(
      context,
      input || {}
    );

    const providerEventId = String(
      verified.providerEventId
    );

    let market = await findMarket(
      db,
      providerEventId
    );

    if (market) {
      if (
        String(market.state).toUpperCase() !== "OPEN"
      ) {
        return json({
          ok: false,
          code: "MARKET_NOT_OPEN",
          message: "This Picks market is no longer open."
        }, 409);
      }

      const marketStart = Date.parse(
        market.starts_at || ""
      );

      if (
        Number.isFinite(marketStart) &&
        marketStart <= Date.now()
      ) {
        return json({
          ok: false,
          code: "MARKET_ALREADY_STARTED",
          message: "Betting is closed because this game has already started."
        }, 409);
      }

      return json({
        ok: true,
        created: false,
        market: marketPayload(
          market,
          await poolForMarket(db, market.id)
        )
      });
    }

    const season = await activeSeason(db);

    if (!season?.id) {
      return json({
        ok: false,
        code: "NO_ACTIVE_PICKS_SEASON",
        message: "EastCoin Picks does not currently have an active season."
      }, 503);
    }

    const marketId = crypto.randomUUID();
    const startsAt = new Date(
      verified.startsAt
    ).toISOString();

    const sport = familyFromSportKey(
      verified.sportKey
    );

    const league =
      safeText(verified.sportTitle, 160) ||
      safeText(verified.sportKey, 160);

    // Provider names are authoritative. Streamed badge URLs are visual-only.
    const providerAway = safeText(
      verified.providerAway || away,
      160
    );

    const providerHome = safeText(
      verified.providerHome || home,
      160
    );

    try {
      await db
        .prepare(
          `INSERT INTO markets (
             id,
             provider,
             provider_event_id,
             season_id,
             sport,
             league,
             away_name,
             away_badge,
             home_name,
             home_badge,
             starts_at,
             state
           )
           VALUES (?, 'odds_api', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`
        )
        .bind(
          marketId,
          providerEventId,
          String(season.id),
          sport,
          league,
          providerAway,
          safeBadge(input?.awayBadge),
          providerHome,
          safeBadge(input?.homeBadge),
          startsAt
        )
        .run();
    } catch (error) {
      // A simultaneous click can race this INSERT. The unique
      // provider/provider_event_id constraint makes the operation idempotent.
      market = await findMarket(
        db,
        providerEventId
      );

      if (!market) throw error;
    }

    market =
      market ||
      await findMarket(
        db,
        providerEventId
      );

    if (!market) {
      throw new Error(
        "The Picks market could not be loaded after creation."
      );
    }

    return json({
      ok: true,
      created: true,
      market: marketPayload(
        market,
        await poolForMarket(db, market.id)
      )
    }, 201);
  } catch (error) {
    console.error(
      "Picks market ensure failed",
      error
    );

    const code =
      error?.code ||
      "PICKS_MARKET_ENSURE_FAILED";

    const clientConflict = [
      "ODDS_EVENT_NOT_FOUND",
      "ODDS_EVENT_MISMATCH",
      "MARKET_ALREADY_STARTED",
      "MONEYLINE_SPORT_NOT_ALLOWED",
      "MONEYLINE_NOT_AVAILABLE"
    ].includes(code);

    return json({
      ok: false,
      code,
      message:
        error?.message ||
        "EastCoin could not prepare this Picks market."
    }, clientConflict ? 409 : 502);
  }
}

export function onRequestGet() {
  return json({
    ok: false,
    code: "METHOD_NOT_ALLOWED",
    message: "Use POST to prepare a Picks market."
  }, 405);
}
