const SOURCE_URL = "https://dlstreams.st/";
const CHANNELS_URL = "https://dlstreams.st/24-7-channels.php";
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
  let output = String(html || "");

  // Public schedule/watch links.
  output = output.replace(
    /<a\b[^>]*href\s*=\s*["'][^"']*watch\.php\?[^"']*?\bid=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, id, label) => ` [[DLCHANNEL:${id}|${stripTags(label)}]] `
  );

  // Direct iframe embeds, e.g.
  // <iframe src="https://dlstreams.st/stream/stream-30.php" ...></iframe>
  output = output.replace(
    /<iframe\b[^>]*src\s*=\s*["']https?:\/\/(?:www\.)?dlstreams\.st\/stream\/stream-(\d+)\.php[^"']*["'][^>]*>[\s\S]*?<\/iframe>/gi,
    (_, id) => ` [[DLCHANNEL:${id}|Channel ${id}]] `
  );

  // Also catch a bare documented stream URL if it appears outside an iframe.
  output = output.replace(
    /https?:\/\/(?:www\.)?dlstreams\.st\/stream\/stream-(\d+)\.php/gi,
    (_, id) => ` [[DLCHANNEL:${id}|Channel ${id}]] `
  );

  return output;
}

function htmlToLines(html) {
  /*
    DLStreams changes its schedule markup fairly often. Do not depend on
    specific div/class names. Preserve channel anchors as tokens, strip the
    remaining markup, then force boundaries around dates, clock times and
    channel tokens. That makes the parser resilient whether the site uses
    cards, table rows, spans or nested divs.
  */
  return normalizeChannelAnchors(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(
      /((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}\s*-\s*Schedule Time UK GMT)/gi,
      "\n$1\n"
    )
    .replace(/(\b\d{1,2}:\d{2}\b)/g, "\n$1")
    .replace(/(\[\[DLCHANNEL:\d+\|[^\]]*\]\])/g, "\n$1\n")
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


function categoryHeading(line) {
  const text = cleanEventText(line)
    .replace(/\s+/g, " ")
    .trim();

  if (!text || text.length > 88) return "";
  if (/^\d{1,2}:\d{2}\b/.test(text)) return "";
  if (/\b(?:vs\.?|versus)\b|[|:]/i.test(text)) return "";
  if (/\bS\d+\s*,?\s*E\d+\b|\bpremiere\b|\bfinale\b/i.test(text)) return "";
  if (/schedule time uk gmt/i.test(text)) return "";

  if (
    /^(?:Upcoming Events\b|TV Shows\b|Big Brother.*LIVE CAMERA FEEDS)/i.test(text)
  ) {
    return text;
  }

  if (
    /\b(?:American Football|Am\.?\s*Football|High School Football|NFL|CFL|NCAAF|Baseball|MLB|Softball|Basketball|WNBA|Ice Hockey|Hockey|Boxing|MMA|Wrestling|Motorsport|Formula|Tennis|ATP|WTA|Golf|Soccer|Football|Premier League|NWSL)\b/i.test(text)
  ) {
    return text;
  }

  return "";
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
  /*
    Parser v4:
    Do not depend on DLStreams' CSS classes or exact card/table markup.

    1. Convert public watch links / documented iframe URLs into channel tokens.
    2. Strip scripts/styles and flatten the remaining markup to text.
    3. Find every clock time.
    4. Treat the text between this clock time and the next clock time as one
       event window.
    5. The title is everything before the first channel token.
    6. Every channel token in the window becomes an EastCoin source.
  */
  const sourceText = String(html || "");

  const marked = normalizeChannelAnchors(sourceText)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(?:div|p|li|tr|td|th|section|article|header|footer|h1|h2|h3|h4|h5|h6|a)>/gi,
      "\n"
    )
    .replace(/<[^>]*>/g, " ");

  const text = decodeEntities(marked)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const dayPattern =
    /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4}\s*-\s*Schedule Time UK GMT/gi;

  const dayMatches = [...text.matchAll(dayPattern)].map((match) => ({
    index: match.index || 0,
    day: parseDayHeader(match[0])
  }));

  function dayAt(index) {
    let result = null;
    for (const item of dayMatches) {
      if (item.index > index) break;
      if (item.day) result = item.day;
    }
    return result;
  }

  const timePattern = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
  const times = [...text.matchAll(timePattern)];
  const events = [];
  const parserSamples = [];
  let currentCategory = "Other";

  for (let i = 0; i < times.length; i += 1) {
    const match = times[i];

    const currentDayIndex = [...dayMatches]
      .reverse()
      .find((item) => item.index <= (match.index || 0))
      ?.index || 0;

    const previousTimeEnd =
      i === 0
        ? 0
        : (times[i - 1].index || 0) + times[i - 1][0].length;

    const categoryWindowStart = Math.max(
      currentDayIndex,
      previousTimeEnd
    );

    const categoryWindow = text.slice(
      categoryWindowStart,
      match.index || 0
    );

    const categoryCandidates = categoryWindow
      .split(/\n+/)
      .map(categoryHeading)
      .filter(Boolean);

    if (categoryCandidates.length) {
      currentCategory =
        categoryCandidates[categoryCandidates.length - 1];
    }
    const startIndex = (match.index || 0) + match[0].length;
    const endIndex =
      i + 1 < times.length
        ? (times[i + 1].index || text.length)
        : text.length;

    let windowText = text.slice(startIndex, endIndex).trim();
    if (!windowText) continue;

    const channels = extractChannels(windowText);
    if (!channels.length) continue;

    const firstChannelIndex = windowText.indexOf("[[DLCHANNEL:");
    const titleArea =
      firstChannelIndex >= 0
        ? windowText.slice(0, firstChannelIndex)
        : windowText;

    let title = cleanEventText(titleArea)
      .replace(/^[-–—|:•\s]+/, "")
      .replace(/\s+/g, " ")
      .trim();

    /*
      A category heading can occasionally survive in the event window after
      DLStreams changes markup. Keep the event-facing portion nearest the
      channel list when line boundaries are available.
    */
    const titleLines = titleArea
      .split(/\n+/)
      .map((line) => cleanEventText(line))
      .filter(Boolean)
      .filter((line) => !parseDayHeader(line))
      .filter((line) => !/^(Schedule|All|24\/7|Chat|Menu)$/i.test(line));

    if (titleLines.length) {
      title = titleLines[titleLines.length - 1];
    }

    title = String(title || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 260);

    if (!title || title.length < 2) continue;

    const time = match[0].padStart(5, "0");
    const day = dayAt(match.index || 0);
    const timestamp = scheduleTimestamp(day, time);
    const sport = inferSport(currentCategory, title);

    const event = {
      id: "",
      provider: "dlstreams",
      title,
      category: currentCategory || sport,
      sport,
      time,
      timestamp,
      startsAt: timestamp ? new Date(timestamp).toISOString() : null,
      dayKey: timestamp ? new Date(timestamp).toISOString().slice(0, 10) : "",
      channels
    };

    event.id = `dlstreams:${slugify(
      `${event.dayKey}:${event.time}:${event.title}`
    )}`;

    events.push(event);

    if (parserSamples.length < 8) {
      parserSamples.push({
        time,
        title,
        category: currentCategory,
        sport,
        channels: channels.slice(0, 4).map((channel) => ({
          id: channel.id,
          name: channel.name
        }))
      });
    }
  }

  const seen = new Set();
  const deduped = events.filter((event) => {
    const channelKey = event.channels
      .map((channel) => channel.id)
      .sort()
      .join(",");
    const key =
      `${event.dayKey}|${event.time}|${slugify(event.title)}|${channelKey}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    events: deduped,
    lineCount: text.split(/\n/).filter(Boolean).length,
    diagnostics: {
      htmlBytes: sourceText.length,
      watchLinkCount:
        (sourceText.match(/watch\.php\?[^"'<> \s]*?id=\d+/gi) || []).length,
      directEmbedCount:
        (sourceText.match(/dlstreams\.st\/stream\/stream-\d+\.php/gi) || []).length,
      channelTokenCount:
        (marked.match(/\[\[DLCHANNEL:/g) || []).length,
      rawTimeMatchCount: times.length,
      dayHeaderCount: dayMatches.length,
      eventsWithChannelsBeforeDedupe: events.length,
      sampleEvents: parserSamples,
      firstText:
        text.slice(0, 900)
    }
  };
}

function preferChannelName(currentName, nextName, id) {
  const current = String(currentName || "").trim();
  const next = String(nextName || "").trim();
  const generic = (value) =>
    !value ||
    new RegExp(`^Channel\\s+${String(id).replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}$`, "i").test(value) ||
    /^(?:Watch|Live|Stream|Open)$/i.test(value);

  if (generic(current) && !generic(next)) return next;
  if (!current && next) return next;
  return current || next || `Channel ${id}`;
}

function extractChannelCatalog(html) {
  const marked = normalizeChannelAnchors(String(html || ""));
  const channelMap = new Map();
  const pattern = /\[\[DLCHANNEL:(\d+)\|([^\]]*)\]\]/g;
  let match;

  while ((match = pattern.exec(marked))) {
    const id = String(match[1] || "").trim();
    if (!id) continue;

    const next = {
      id,
      name: String(match[2] || "").replace(/\s+/g, " ").trim() || `Channel ${id}`,
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
    };

    const existing = channelMap.get(id);
    if (existing) {
      existing.name = preferChannelName(existing.name, next.name, id);
    } else {
      channelMap.set(id, next);
    }
  }

  /*
    Some versions of the 24/7 page keep channel metadata inside an inline JSON
    payload even when the browser-rendered channel cards are populated later.
    Accept the two common key orders as a no-key fallback.
  */
  const jsonPatterns = [
    /"channel_id"\s*:\s*"?(\d+)"?[\s\S]{0,240}?"channel_name"\s*:\s*"([^"]+)"/gi,
    /"channel_name"\s*:\s*"([^"]+)"[\s\S]{0,240}?"channel_id"\s*:\s*"?(\d+)"?/gi
  ];

  jsonPatterns.forEach((jsonPattern, patternIndex) => {
    let jsonMatch;
    while ((jsonMatch = jsonPattern.exec(String(html || "")))) {
      const id = String(patternIndex === 0 ? jsonMatch[1] : jsonMatch[2]).trim();
      const name = decodeEntities(
        String(patternIndex === 0 ? jsonMatch[2] : jsonMatch[1])
      )
        .replace(/\\\//g, "/")
        .replace(/\\"/g, '"')
        .replace(/\s+/g, " ")
        .trim();

      if (!id) continue;
      const existing = channelMap.get(id);
      if (existing) {
        existing.name = preferChannelName(existing.name, name, id);
      } else {
        channelMap.set(id, {
          id,
          name: name || `Channel ${id}`,
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
    }
  });

  return [...channelMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  );
}

async function fetchChannelsSource(request, force = false) {
  const cache = caches.default;
  const cacheKey = new Request(
    "https://eastcoin.invalid/dlstreams-channels?v=2",
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

  const response = await fetch(CHANNELS_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (compatible; EastCoin-DLStreams-Provider/1.0; +https://eastcoin.vip/)"
    },
    redirect: "follow",
    cf: {
      cacheTtl: 0,
      cacheEverything: false
    }
  });

  if (!response.ok) {
    throw new Error(
      `DLStreams 24/7 channels page returned HTTP ${response.status}.`
    );
  }

  const html = await response.text();
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
        "Mozilla/5.0 (compatible; EastCoin-DLStreams-Provider/1.0; +https://eastcoin.vip/)"
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
          service: "eastcoin-dlstreams-provider",
          source: SOURCE_URL,
          channelsSource: CHANNELS_URL,
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
            prototype: false,
            source: SOURCE_URL,
            sourceFromCache: source.fromCache,
            fetchedAt: new Date().toISOString(),
            parser: {
              version: 5,
              lineCount: parsed.lineCount,
              ...parsed.diagnostics
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
            prototype: false,
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


    if (url.pathname === "/channels") {
      try {
        const force = url.searchParams.get("force") === "1";

        const [channelSourceResult, scheduleSourceResult] =
          await Promise.allSettled([
            fetchChannelsSource(request, force),
            fetchSource(request, force)
          ]);

        const directSource =
          channelSourceResult.status === "fulfilled"
            ? channelSourceResult.value
            : null;
        const scheduleSource =
          scheduleSourceResult.status === "fulfilled"
            ? scheduleSourceResult.value
            : null;

        const directChannels = directSource
          ? extractChannelCatalog(directSource.html)
          : [];

        const scheduleChannels = scheduleSource
          ? extractChannelCatalog(scheduleSource.html)
          : [];

        const merged = new Map();

        [...directChannels, ...scheduleChannels].forEach((channel) => {
          const id = String(channel?.id || "").trim();
          if (!id) return;

          const existing = merged.get(id);
          if (!existing) {
            merged.set(id, { ...channel });
            return;
          }

          existing.name = preferChannelName(
            existing.name,
            channel.name,
            id
          );
        });

        const channels = [...merged.values()].sort((a, b) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base" })
        );

        return json(
          {
            ok: true,
            provider: "dlstreams",
            source: CHANNELS_URL,
            fetchedAt: new Date().toISOString(),
            sourceFromCache:
              Boolean(directSource?.fromCache) &&
              Boolean(scheduleSource?.fromCache),
            summary: {
              channelCount: channels.length,
              direct247Count: directChannels.length,
              scheduleFallbackCount: scheduleChannels.length
            },
            channels
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
            error: String(error?.message || error),
            hint:
              "EastCoin can still derive a partial Live TV catalog from /schedule if the dedicated 24/7 page changes."
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
        service: "eastcoin-dlstreams-provider",
        endpoints: {
          health: "/health",
          schedule: "/schedule",
          forceRefresh: "/schedule?force=1",
          channels: "/channels",
          forceChannelsRefresh: "/channels?force=1",
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
