const SCOREBOARDS = {
  "baseball": [
    ["baseball", "mlb"]
  ],
  "basketball": [
    ["basketball", "wnba"],
    ["basketball", "nba"],
    ["basketball", "mens-college-basketball"]
  ],
  "american-football": [
    ["football", "nfl"],
    ["football", "college-football"]
  ],
  "hockey": [
    ["hockey", "nhl"]
  ],
  "soccer": [
    ["soccer", "usa.1"],
    ["soccer", "eng.1"],
    ["soccer", "usa.nwsl"],
    ["soccer", "mex.1"],
    ["soccer", "uefa.champions"]
  ]
};

const STOP_WORDS = new Set([
  "fc", "cf", "sc", "afc", "club", "team",
  "women", "womens", "men", "mens",
  "the", "university", "college"
]);

function response(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function nameScore(candidate, target) {
  const left = normalize(candidate);
  const right = normalize(target);

  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.95;

  const targetTokens = tokens(target);
  if (!targetTokens.length) return 0;

  const candidateTokens = new Set(tokens(candidate));
  const hits = targetTokens.filter((token) => candidateTokens.has(token)).length;

  return hits / targetTokens.length;
}

function teamText(competitor) {
  const team = competitor?.team || {};

  return [
    team.displayName,
    team.shortDisplayName,
    team.location,
    team.name,
    team.abbreviation
  ].filter(Boolean).join(" ");
}

function dateParam(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("");
}

async function cachedFetch(url, ttl = 15) {
  const cache = caches.default;
  const request = new Request(url, { method: "GET" });
  const cached = await cache.match(request);

  if (cached) return cached.clone();

  const upstream = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "EastCoin-V2-Live-Scores/2.0"
    }
  });

  if (!upstream.ok) return upstream;

  const headers = new Headers(upstream.headers);
  headers.set("Cache-Control", `public, max-age=${ttl}`);

  const stored = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers
  });

  await cache.put(request, stored.clone());
  return stored;
}

async function loadBoard(sport, league, date) {
  const url = new URL(
    `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/scoreboard`
  );

  url.searchParams.set("dates", date);
  url.searchParams.set("limit", "100");

  const upstream = await cachedFetch(url.toString(), 15);

  if (!upstream.ok) {
    return {
      sport,
      league,
      events: []
    };
  }

  const payload = await upstream.json();

  return {
    sport,
    league,
    events: Array.isArray(payload?.events) ? payload.events : []
  };
}

function parseCompetition(boardEvent) {
  const competition = boardEvent?.competitions?.[0];

  if (!competition) return null;

  const competitors = Array.isArray(competition.competitors)
    ? competition.competitors
    : [];

  const away = competitors.find((item) => item?.homeAway === "away");
  const home = competitors.find((item) => item?.homeAway === "home");

  if (!away || !home) return null;

  return {
    event: boardEvent,
    competition,
    away,
    home,
    startsAt: Date.parse(boardEvent?.date || competition?.date || "")
  };
}

function matchScore(event, game) {
  const away = nameScore(teamText(game.away), event.away);
  const home = nameScore(teamText(game.home), event.home);

  // Also permit feeds whose home/away orientation differs.
  const swappedAway = nameScore(teamText(game.home), event.away);
  const swappedHome = nameScore(teamText(game.away), event.home);

  let orientation = "normal";
  let teamScore = away * 0.44 + home * 0.44;

  if (swappedAway + swappedHome > away + home) {
    orientation = "swapped";
    teamScore = swappedAway * 0.44 + swappedHome * 0.44;
  }

  const eventStart = Number(event.startsAt || 0);
  let timeScore = 0.5;

  if (eventStart && Number.isFinite(game.startsAt)) {
    const hours = Math.abs(eventStart - game.startsAt) / 3600000;
    if (hours <= 1) timeScore = 1;
    else if (hours <= 3) timeScore = 0.85;
    else if (hours <= 8) timeScore = 0.5;
    else if (hours <= 16) timeScore = 0.15;
    else timeScore = 0;
  }

  return {
    score: teamScore + timeScore * 0.12,
    orientation
  };
}

function gameState(game, orientation) {
  const competition = game.competition;
  const status = competition?.status || game.event?.status || {};
  const type = status?.type || {};

  const away = orientation === "swapped" ? game.home : game.away;
  const home = orientation === "swapped" ? game.away : game.home;

  const awayScore = Number(away?.score);
  const homeScore = Number(home?.score);

  if (!Number.isFinite(awayScore) || !Number.isFinite(homeScore)) {
    return null;
  }

  const periodNumber = Number(status?.period);
  const clock = String(status?.displayClock || "").trim();

  let period = "";

  // ESPN shortDetail is particularly useful for baseball (Top 7th / Bot 8th)
  // and still provides good status text for other sports.
  const shortDetail = String(
    type?.shortDetail ||
    type?.detail ||
    status?.type?.description ||
    ""
  ).trim();

  if (shortDetail) {
    period = shortDetail;
  } else if (Number.isFinite(periodNumber) && periodNumber > 0) {
    period = `P${periodNumber}`;
  }

  // Avoid duplicating the clock if ESPN already included it in shortDetail.
  const displayClock =
    clock && !period.includes(clock)
      ? clock
      : "";

  return {
    awayScore,
    homeScore,
    period,
    clock: displayClock,
    status:
      String(type?.state || type?.description || "").trim() || "live",
    source: "espn"
  };
}

async function boardsForEvents(events) {
  const requests = new Map();

  for (const event of events) {
    const pairs = SCOREBOARDS[event.sport] || [];

    for (const [sport, league] of pairs) {
      const date = dateParam(event.startsAt);
      const key = `${sport}:${league}:${date}`;

      if (!requests.has(key)) {
        requests.set(key, loadBoard(sport, league, date));
      }
    }
  }

  return Promise.all(requests.values());
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();

    const events = (Array.isArray(body?.events) ? body.events : [])
      .slice(0, 20)
      .filter((event) =>
        event &&
        String(event.id || "") &&
        String(event.away || "").trim() &&
        String(event.home || "").trim()
      );

    if (!events.length) {
      return response({
        ok: true,
        scores: {},
        matched: 0,
        provider: "espn_public_scoreboard"
      });
    }

    const boards = await boardsForEvents(events);
    const scores = {};
    let matched = 0;

    for (const event of events) {
      const candidates = [];

      for (const board of boards) {
        if (!(SCOREBOARDS[event.sport] || []).some(
          ([sport, league]) =>
            sport === board.sport &&
            league === board.league
        )) {
          continue;
        }

        for (const boardEvent of board.events) {
          const parsed = parseCompetition(boardEvent);
          if (parsed) {
            candidates.push(parsed);
          }
        }
      }

      let best = null;
      let bestMatch = null;

      for (const game of candidates) {
        const result = matchScore(event, game);

        if (!bestMatch || result.score > bestMatch.score) {
          bestMatch = result;
          best = game;
        }
      }

      if (!best || !bestMatch || bestMatch.score < 0.78) {
        continue;
      }

      const state = gameState(best, bestMatch.orientation);

      if (!state) continue;

      scores[String(event.id)] = state;
      matched += 1;
    }

    return response({
      ok: true,
      scores,
      matched,
      provider: "espn_public_scoreboard"
    });
  } catch (error) {
    console.error("V2 ESPN live-score enrichment failed", error);

    return response({
      ok: false,
      scores: {},
      code: "LIVE_SCORE_ENRICHMENT_FAILED",
      message: "Live scores are temporarily unavailable."
    }, 502);
  }
}

export function onRequestGet() {
  return response({
    ok: true,
    endpoint: "EastCoin V2 live score enrichment",
    method: "POST",
    provider: "espn_public_scoreboard",
    note: "Scores are matched by both team names and event start time. No score is fabricated."
  });
}
