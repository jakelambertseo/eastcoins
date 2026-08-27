const KALSHI_BASE = "https://external-api.kalshi.com/trade-api/v2";

const STOP_WORDS = new Set([
  "fc", "cf", "sc", "afc", "club", "team",
  "women", "womens", "men", "mens",
  "university", "college", "the"
]);

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value) {
  return normalized(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function overlapScore(haystack, team) {
  const hay = normalized(haystack);
  const target = normalized(team);

  if (!hay || !target) return 0;
  if (hay.includes(target)) return 1;

  const teamTokens = tokens(team);
  if (!teamTokens.length) return 0;

  const hayTokens = new Set(tokens(haystack));
  const matched = teamTokens.filter((token) => hayTokens.has(token)).length;

  return matched / teamTokens.length;
}

function milestoneText(milestone) {
  return [
    milestone?.title,
    milestone?.notification_message,
    milestone?.type,
    milestone?.competition,
    JSON.stringify(milestone?.details || {}),
    JSON.stringify(milestone?.source_ids || {})
  ].filter(Boolean).join(" ");
}

function eventTimeScore(event, milestone) {
  const left = Number(event?.startsAt || 0);
  const right = Date.parse(milestone?.start_date || "");

  if (!left || !Number.isFinite(right)) return 0.5;

  const hours = Math.abs(left - right) / 3600000;

  if (hours <= 2) return 1;
  if (hours <= 6) return 0.8;
  if (hours <= 12) return 0.5;
  if (hours <= 20) return 0.2;
  return 0;
}

function matchMilestone(event, milestones) {
  let best = null;
  let bestScore = 0;

  for (const milestone of milestones) {
    const text = milestoneText(milestone);
    const away = overlapScore(text, event.away);
    const home = overlapScore(text, event.home);

    // Both teams must have useful evidence. This prevents attaching a score
    // merely because one popular team name happens to appear.
    if (away < 0.5 || home < 0.5) continue;

    const time = eventTimeScore(event, milestone);
    const score = away * 0.38 + home * 0.38 + time * 0.24;

    if (score > bestScore) {
      bestScore = score;
      best = milestone;
    }
  }

  return bestScore >= 0.58 ? best : null;
}

async function cachedFetch(url, ttlSeconds) {
  const cache = caches.default;
  const key = new Request(url, { method: "GET" });
  const cached = await cache.match(key);

  if (cached) return cached.clone();

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "EastCoin-V2-Live-Scores/1.0"
    }
  });

  if (!response.ok) return response;

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);

  const stored = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });

  await cache.put(key, stored.clone());
  return stored;
}

function flatten(value, prefix = "", output = {}, depth = 0) {
  if (depth > 5 || value == null) return output;

  if (Array.isArray(value)) {
    value.slice(0, 50).forEach((item, index) => {
      flatten(item, `${prefix}${prefix ? "." : ""}${index}`, output, depth + 1);
    });
    return output;
  }

  if (typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      const next = `${prefix}${prefix ? "." : ""}${key}`;
      flatten(child, next, output, depth + 1);
    });
    return output;
  }

  output[prefix.toLowerCase().replace(/[^a-z0-9]/g, "")] = value;
  return output;
}

function firstNumber(flat, keys) {
  for (const key of keys) {
    const value = flat[key.toLowerCase().replace(/[^a-z0-9]/g, "")];
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function firstText(flat, keys) {
  for (const key of keys) {
    const value = flat[key.toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (value == null) continue;
    const string = String(value).trim();
    if (string) return string;
  }
  return null;
}

function scoreFromTeamArray(details, event) {
  const candidates = [];

  function visit(value, depth = 0) {
    if (depth > 5 || value == null) return;

    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }

    if (typeof value !== "object") return;

    const name =
      value.name ??
      value.team_name ??
      value.teamName ??
      value.display_name ??
      value.displayName;

    const score =
      value.score ??
      value.points ??
      value.runs ??
      value.goals;

    if (name != null && Number.isFinite(Number(score))) {
      candidates.push({
        name: String(name),
        score: Number(score)
      });
    }

    Object.values(value).forEach((child) => visit(child, depth + 1));
  }

  visit(details);

  if (!candidates.length) return null;

  const away = candidates
    .map((candidate) => ({
      ...candidate,
      confidence: overlapScore(candidate.name, event.away)
    }))
    .sort((a, b) => b.confidence - a.confidence)[0];

  const home = candidates
    .map((candidate) => ({
      ...candidate,
      confidence: overlapScore(candidate.name, event.home)
    }))
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (
    !away ||
    !home ||
    away.confidence < 0.5 ||
    home.confidence < 0.5
  ) {
    return null;
  }

  return {
    awayScore: away.score,
    homeScore: home.score
  };
}

function parseLiveData(liveData, event) {
  const details = liveData?.details || {};
  const flat = flatten(details);

  let awayScore = firstNumber(flat, [
    "away_score",
    "awayScore",
    "visitor_score",
    "visitorScore",
    "road_score",
    "roadScore",
    "away_team_score",
    "awayTeamScore"
  ]);

  let homeScore = firstNumber(flat, [
    "home_score",
    "homeScore",
    "host_score",
    "hostScore",
    "home_team_score",
    "homeTeamScore"
  ]);

  if (awayScore === null || homeScore === null) {
    const teamScores = scoreFromTeamArray(details, event);
    if (teamScores) {
      awayScore ??= teamScores.awayScore;
      homeScore ??= teamScores.homeScore;
    }
  }

  if (awayScore === null || homeScore === null) return null;

  return {
    awayScore,
    homeScore,
    period: firstText(flat, [
      "period",
      "period_name",
      "periodName",
      "current_period",
      "currentPeriod",
      "quarter",
      "inning",
      "inning_half",
      "inningHalf",
      "stage"
    ]),
    clock: firstText(flat, [
      "clock",
      "game_clock",
      "gameClock",
      "time_remaining",
      "timeRemaining",
      "display_clock",
      "displayClock"
    ]),
    status: firstText(flat, [
      "status",
      "state",
      "game_status",
      "gameStatus",
      "match_status",
      "matchStatus"
    ]),
    source: "kalshi"
  };
}

async function milestonesForToday() {
  const minimum = new Date(Date.now() - 14 * 3600000).toISOString();

  const url = new URL(`${KALSHI_BASE}/milestones`);
  url.searchParams.set("limit", "500");
  url.searchParams.set("category", "Sports");
  url.searchParams.set("minimum_start_date", minimum);

  const response = await cachedFetch(url.toString(), 60);

  if (!response.ok) {
    throw new Error(`Kalshi milestones returned ${response.status}`);
  }

  const payload = await response.json();

  return Array.isArray(payload?.milestones)
    ? payload.milestones
    : [];
}

async function batchLiveData(ids) {
  if (!ids.length) return [];

  const url = new URL(`${KALSHI_BASE}/live_data/batch`);

  ids.slice(0, 100).forEach((id) => {
    url.searchParams.append("milestone_ids", id);
  });

  const response = await cachedFetch(url.toString(), 20);

  if (!response.ok) {
    throw new Error(`Kalshi live data returned ${response.status}`);
  }

  const payload = await response.json();

  return Array.isArray(payload?.live_datas)
    ? payload.live_datas
    : [];
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const events = Array.isArray(body?.events)
      ? body.events.slice(0, 20)
      : [];

    const valid = events.filter((event) =>
      event &&
      String(event.id || "") &&
      String(event.away || "").trim() &&
      String(event.home || "").trim()
    );

    if (!valid.length) {
      return json({
        ok: true,
        scores: {},
        matched: 0
      });
    }

    const milestones = await milestonesForToday();
    const matches = new Map();

    valid.forEach((event) => {
      const milestone = matchMilestone(event, milestones);
      if (milestone?.id) {
        matches.set(String(milestone.id), event);
      }
    });

    if (!matches.size) {
      return json({
        ok: true,
        scores: {},
        matched: 0
      });
    }

    const liveDatas = await batchLiveData([...matches.keys()]);
    const scores = {};

    liveDatas.forEach((liveData) => {
      const event = matches.get(String(liveData?.milestone_id || ""));
      if (!event) return;

      const parsed = parseLiveData(liveData, event);
      if (!parsed) return;

      scores[String(event.id)] = parsed;
    });

    return json({
      ok: true,
      scores,
      matched: matches.size,
      scored: Object.keys(scores).length,
      provider: "kalshi_public_live_data"
    });
  } catch (error) {
    console.error("V2 live score enrichment failed", error);

    // Fail soft: the event catalog is more important than live-score decoration.
    return json({
      ok: false,
      scores: {},
      code: "LIVE_SCORE_ENRICHMENT_FAILED",
      message: "Live scores are temporarily unavailable."
    }, 502);
  }
}

export function onRequestGet() {
  return json({
    ok: true,
    endpoint: "EastCoin V2 live score enrichment",
    method: "POST",
    provider: "kalshi_public_live_data",
    note: "This endpoint only enriches matching live EastCoin events and never fabricates scores."
  });
}
