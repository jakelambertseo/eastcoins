const SOURCE_URL = "https://dlstreams.st/";
const CACHE_SECONDS = 120;
const CACHE_NAME = "eastcoin-dlstreams-prototype-v1";

const DEFAULT_ALLOWED_ORIGINS = new Set([
  "https://eastcoin.vip",
  "https://www.eastcoin.vip",
  "https://eastcoins.pages.dev",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
  "http://localhost:8787",
  "http://127.0.0.1:8787"
]);

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const configured = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowed = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
  const allowOrigin = allowed.has(origin) ? origin : "https://eastcoin.vip";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}

function json(data, status = 200, request = new Request("https://eastcoin.vip"), env = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(request, env)
    }
  });
}

function decodeEntities(value) {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };

  return String(value || "")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const n = Number.parseInt(code, 16);
      return Number.isFinite(n) ? String.fromCodePoint(n) : _;
    })
    .replace(/&([a-z]+);/gi, (whole, name) => named[name.toLowerCase()] ?? whole);
}

function stripTags(value) {
  return decodeEntities(
    String(value || "")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeChannelAnchors(html) {
  return String(html || "").replace(
    /<a\b[^>]*href=["'](?:https?:\/\/(?:www\.)?dlstreams\.st)?\/?watch\.php\?id=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, id, label) => ` [[DLCHANNEL:${id}|${stripTags(label)}]] `
  );
}

function htmlToLines(html) {
  return normalizeChannelAnchors(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(?:div|p|li|tr|td|th|section|article|header|footer|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .split(/\r?\n/)
    .map((line) => decodeEntities(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function cleanEventText(value) {
  return String(value || "")
    .replace(/\[\[DLCHANNEL:\d+\|[^\]]*\]\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractChannels(value) {
  const channels = [];
  const seen = new Set();
  const pattern = /\[\[DLCHANNEL:(\d+)\|([^\]]*)\]\]/g;
  let match;

  while ((match = pattern.exec(String(value || "")))) {
    const id = match[1];
    if (seen.has(id)) continue;
    seen.add(id);

    const name = String(match[2] || "").trim() || `Channel ${id}`;
    channels.push({
      id,
      name,
      watchUrl: `https://dlstreams.st/watch.php?id=${encodeURIComponent(id)}`,
      embedUrl: `https://dlstreams.st/stream/stream-${encodeURIComponent(id)}.php`,
      embedUrls: [
        "stream",
        "cast",
        "watch",
        "plus",
        "casting",
        "player"
      ].map((folder) =>
        `https://dlstreams.st/${folder}/stream-${encodeURIComponent(id)}.php`
      )
    });
  }

  return channels;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferSport(category, title) {
  const text = `${category || ""} ${title || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");

  const rules = [
    ["american-football", /\b(nfl|ncaaf|american football|am football|high school football|cfl)\b/],
    ["baseball", /\b(baseball|mlb|little league|softball|banana ball|aapb)\b/],
    ["basketball", /\b(basketball|nba|wnba|ncaab|euroleague)\b/],
    ["hockey", /\b(hockey|nhl|ohl|3ice)\b/],
    ["combat", /\b(ufc|mma|boxing|fightland|combat)\b/],
    ["wrestling", /\b(wrestling|wwe|aew|smackdown|raw)\b/],
    ["motorsport", /\b(formula 1|formula one|f1|motorsport|nascar|racing|grand prix)\b/],
    ["tennis", /\b(tennis|atp|wta|us open|wimbledon)\b/],
    ["golf", /\b(golf|pga|lpga|ryder cup)\b/],
    ["soccer", /\b(soccer|premier league|epl|uefa|fifa|champions league|la liga|bundesliga|serie a|ligue 1|football)\b/]
  ];

  for (const [sport, pattern] of rules) {
    if (pattern.test(text)) return sport;
  }

  return "other";
}

function looksLikeCategory(line) {
  const text = cleanEventText(line);
  if (!text || text.length > 90) return false;
  if (/^\d{1,2}:\d{2}\b/.test(text)) return false;
  if (/\[\[DLCHANNEL:/i.test(line)) return false;
  if (/^(schedule|all|menu|chat|webmasters|contact us|api|discord|telegram|theme toggle|24\/7 channels)$/i.test(text)) {
    return false;
  }
  if (/schedule time uk gmt/i.test(text)) return false;
  if (/search events or channels/i.test(text)) return false;

  return /(?:⚾|🏀|🏈|⚽|🏒|🎾|🥊|🤼|⛳|🏎|🏁|🏉|🏐|🏏|🏸|🚴|🏇|🤾|🤸|🎯|📺|events?|baseball|basketball|football|soccer|tennis|hockey|golf|motorsport|boxing|mma|wrestling|rugby|cricket|volleyball|softball)/i.test(text);
}

function parseDayHeader(line) {
  const match = String(line || "").match(
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\s+(\d{4})\s*-\s*Schedule Time UK GMT/i
  );
  if (!match) return null;

  const months = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };
  const month = months[match[2].toLowerCase()];
  if (month === undefined) return null;

  return {
    year: Number(match[3]),
    month,
    day: Number(match[1]),
    label: match[0]
  };
}

function scheduleTimestamp(day, time) {
  if (!day) return 0;
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;

  return Date.UTC(
    day.year,
    day.month,
    day.day,
    Number(match[1]),
    Number(match[2]),
    0,
    0
  );
}

function parseScheduleHtml(html) {
  const lines = htmlToLines(html);
  const events = [];
  let currentDay = null;
  let currentCategory = "Other";
  let currentEvent = null;

  function flush() {
    if (!currentEvent) return;
    if (!currentEvent.channels.length) {
      currentEvent = null;
      return;
    }

    currentEvent.sport = inferSport(currentEvent.category, currentEvent.title);
    currentEvent.id = `dlstreams:${slugify(
      `${currentEvent.dayKey}:${currentEvent.time}:${currentEvent.title}`
    )}`;
    events.push(currentEvent);
    currentEvent = null;
  }

  for (const line of lines) {
    const day = parseDayHeader(line);
    if (day) {
      flush();
      currentDay = day;
      continue;
    }

    const timed = line.match(/^(\d{1,2}:\d{2})\s+([\s\S]+)$/);
    if (timed) {
      flush();

      const time = timed[1].padStart(5, "0");
      const title = cleanEventText(timed[2]);
      const channels = extractChannels(line);

      if (!title) continue;

      const timestamp = scheduleTimestamp(currentDay, time);
      currentEvent = {
        id: "",
        provider: "dlstreams",
        title,
        category: currentCategory || "Other",
        sport: "other",
        time,
        timestamp,
        startsAt: timestamp ? new Date(timestamp).toISOString() : null,
        dayKey: timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "",
        channels
      };
      continue;
    }

    const channels = extractChannels(line);
    if (channels.length && currentEvent) {
      const known = new Set(currentEvent.channels.map((channel) => channel.id));
      channels.forEach((channel) => {
        if (!known.has(channel.id)) {
          known.add(channel.id);
          currentEvent.channels.push(channel);
        }
      });
      continue;
    }

    if (looksLikeCategory(line)) {
      flush();
      currentCategory = cleanEventText(line);
    }
  }

  flush();

  const seen = new Set();
  const deduped = events.filter((event) => {
    const channelKey = event.channels.map((channel) => channel.id).sort().join(",");
    const key = `${event.dayKey}|${event.time}|${slugify(event.title)}|${channelKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    events: deduped,
    lineCount: lines.length
  };
}

async function fetchSource(request, force = false) {
  const cache = caches.default;
  const cacheKey = new Request(
    `https://eastcoin.invalid/dlstreams-source?v=1`,
    { method: "GET" }
  );

  if (!force) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return {
        html: await cached.text(),
        fromCache: true,
        status: 200
      };
    }
  }

  const response = await fetch(SOURCE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; EastCoin-DLStreams-Prototype/1.0; +https://eastcoin.vip/)"
    },
    redirect: "follow",
    cf: {
      cacheTtl: 0,
      cacheEverything: false
    }
  });

  if (!response.ok) {
    throw new Error(`DLStreams public schedule returned HTTP ${response.status}.`);
  }

  const html = await response.text();
  if (!/Schedule/i.test(html) || !/watch\.php\?id=/i.test(html)) {
    throw new Error(
      "DLStreams returned HTML, but the expected public schedule/channel links were not found."
    );
  }

  const cachedResponse = new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": `public, max-age=${CACHE_SECONDS}`
    }
  });
  await cache.put(cacheKey, cachedResponse.clone());

  return {
    html,
    fromCache: false,
    status: response.status
  };
}

function buildSummary(events) {
  const channels = new Set();
  const sports = new Map();

  events.forEach((event) => {
    event.channels.forEach((channel) => channels.add(channel.id));
    sports.set(event.sport, (sports.get(event.sport) || 0) + 1);
  });

  return {
    eventCount: events.length,
    channelCount: channels.size,
    sports: Object.fromEntries(
      [...sports.entries()].sort((a, b) => b[1] - a[1])
    )
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env)
      });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json(
        {
          ok: true,
          service: "eastcoin-dlstreams-prototype",
          source: SOURCE_URL,
          cacheSeconds: CACHE_SECONDS
        },
        200,
        request,
        env
      );
    }

    if (url.pathname === "/schedule") {
      try {
        const force = url.searchParams.get("force") === "1";
        const source = await fetchSource(request, force);
        const parsed = parseScheduleHtml(source.html);
        const summary = buildSummary(parsed.events);

        return json(
          {
            ok: true,
            provider: "dlstreams",
            prototype: true,
            source: SOURCE_URL,
            sourceFromCache: source.fromCache,
            fetchedAt: new Date().toISOString(),
            parser: {
              version: 1,
              lineCount: parsed.lineCount
            },
            summary,
            events: parsed.events
          },
          200,
          request,
          env
        );
      } catch (error) {
        return json(
          {
            ok: false,
            provider: "dlstreams",
            prototype: true,
            error: String(error?.message || error),
            hint:
              "If DLStreams blocks Cloudflare Worker requests or changes its public HTML, the scraper will need adjustment. The official API remains the preferred production path."
          },
          502,
          request,
          env
        );
      }
    }

    const channelMatch = url.pathname.match(/^\/channel\/(\d+)$/);
    if (channelMatch) {
      const id = channelMatch[1];
      return json(
        {
          ok: true,
          id,
          watchUrl: `https://dlstreams.st/watch.php?id=${id}`,
          embedUrls: [
            "stream",
            "cast",
            "watch",
            "plus",
            "casting",
            "player"
          ].map((folder) => `https://dlstreams.st/${folder}/stream-${id}.php`)
        },
        200,
        request,
        env
      );
    }

    return json(
      {
        ok: true,
        service: "eastcoin-dlstreams-prototype",
        endpoints: {
          health: "/health",
          schedule: "/schedule",
          forceRefresh: "/schedule?force=1",
          channel: "/channel/<channel-id>"
        }
      },
      200,
      request,
      env
    );
  }
};

export { parseScheduleHtml, inferSport };
