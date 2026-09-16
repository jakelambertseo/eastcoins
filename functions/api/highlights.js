/* ============================================================
   GET /api/highlights — sports Shorts from chosen YouTube channels
   (2026-09-15, test page only: /?view=highlights, not linked)

   YouTube's API has no Shorts endpoint, so this reads each channel's
   Shorts playlist: a channel id "UC…" has its Shorts at "UUSH…". That
   naming is undocumented by YouTube — it has held for years, but if a
   channel's playlist starts coming back 404 for no reason, that is the
   first suspect.

   Cost, against the 10,000-unit daily quota the Green Room's search
   also spends:
     - a handle is resolved to its channel id once a week (1 unit each)
     - a refresh reads one playlist per channel (1 unit each, ~12)
     - the whole feed is cached 30 minutes, so at most 48 refreshes a
       day: under 600 units even with the page open all day. A refresh
       only happens when someone asks.
   If a refresh fails (quota spent, YouTube down) the last good feed is
   served from a 24-hour shadow copy instead of an empty page.

   Needs YOUTUBE_API_KEY as a Pages variable (the music worker has its
   own copy; this does not reach it).
   ============================================================ */

const API = "https://www.googleapis.com/youtube/v3";
const FEED_TTL_S = 30 * 60;
const SHADOW_TTL_S = 24 * 60 * 60;
const CHANNEL_TTL_S = 7 * 24 * 60 * 60;
const WINDOW_MS = 4 * 24 * 3600 * 1000;
const MAX_CLIPS = 60;

// sport: what the channel is about. "mixed" channels are sorted per clip
// by the words in its title.
export const CHANNELS = [
  { handle: "NFL", sport: "nfl" },
  { handle: "NFLFilms", sport: "nfl" },
  { handle: "nflnetwork", sport: "nfl" },
  { handle: "NFLonFOX", sport: "nfl" },
  { handle: "PatMcAfeeShow", sport: "nfl" },
  { handle: "ESPNCFB", sport: "cfb" },
  { handle: "MLB", sport: "mlb" },
  { handle: "ESPN", sport: "mixed" },
  { handle: "SportsCenter", sport: "mixed" },
  { handle: "BleacherReport", sport: "mixed" },
  { handle: "HouseofHighlights", sport: "mixed" },
  { handle: "CBSSportsHQ", sport: "mixed" }
];

const NFL_WORDS = /\b(nfl|touchdown|td|quarterback|qb|super bowl|redzone|bills|dolphins|patriots|jets|ravens|bengals|browns|steelers|texans|colts|jaguars|titans|broncos|chiefs|raiders|chargers|cowboys|eagles|commanders|bears|lions|packers|vikings|falcons|panthers|saints|buccaneers|bucs|49ers|niners|seahawks|rams|mahomes|allen|lamar|burrow|kelce)\b/i;
const MLB_WORDS = /\b(mlb|home run|homer|walk-off|walkoff|grand slam|pitcher|strikeout|yankees|red sox|orioles|blue jays|rays|guardians|tigers|twins|royals|white sox|astros|mariners|rangers|angels|athletics|mets|braves|phillies|marlins|nationals|cubs|brewers|reds|pirates|dodgers|padres|diamondbacks|rockies|ohtani|judge)\b/i;
const CFB_WORDS = /\b(college football|cfb|ncaa|heisman|sec|big ten|big 12|acc|alabama|georgia|ohio state|michigan|texas|oklahoma|lsu|clemson|notre dame|oregon|usc|penn state|tennessee|florida state|miami)\b/i;

function sportFor(channelSport, title) {
  if (channelSport !== "mixed") return channelSport;
  // NFL first: the room is mostly football, and "Giants" or "Cardinals"
  // should land there rather than in baseball.
  if (NFL_WORDS.test(title)) return "nfl";
  if (CFB_WORDS.test(title)) return "cfb";
  if (MLB_WORDS.test(title)) return "mlb";
  return "other";
}

const cleanTitle = (t) => String(t || "").replace(/#\w+/g, "").replace(/\s{2,}/g, " ").trim().slice(0, 140);

async function yt(path, params, key) {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries({ ...params, key })) url.searchParams.set(k, String(v));
  const r = await fetch(url.toString());
  const body = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, body };
}

async function channelId(handle, key) {
  const cache = caches.default;
  const ck = new Request(`https://eastcoin-highlights.internal/channel/${handle.toLowerCase()}`);
  const hit = await cache.match(ck);
  if (hit) return (await hit.json()).id || null;
  const r = await yt("channels", { part: "id", forHandle: `@${handle}` }, key);
  const id = r.ok ? String(r.body?.items?.[0]?.id || "") : "";
  // A miss is cached too (for a day), so a wrong handle is not re-asked every refresh.
  if (r.ok) {
    await cache.put(ck, new Response(JSON.stringify({ id }), {
      headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${id ? CHANNEL_TTL_S : 86400}` }
    })).catch(() => {});
  }
  return id || null;
}

async function refresh(key) {
  const report = [];
  const clips = [];
  await Promise.all(CHANNELS.map(async (ch) => {
    const id = await channelId(ch.handle, key).catch(() => null);
    if (!id || !id.startsWith("UC")) { report.push({ handle: ch.handle, ok: false, why: "handle not found" }); return; }
    const r = await yt("playlistItems", { part: "snippet,contentDetails", playlistId: `UUSH${id.slice(2)}`, maxResults: 15 }, key);
    if (!r.ok) { report.push({ handle: ch.handle, ok: false, why: `playlist ${r.status}` }); return; }
    let n = 0;
    for (const item of r.body?.items || []) {
      const s = item.snippet || {};
      const videoId = String(s.resourceId?.videoId || item.contentDetails?.videoId || "");
      if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) continue;
      if (/^(private|deleted) video$/i.test(String(s.title || ""))) continue;
      const title = cleanTitle(s.title);
      clips.push({
        id: videoId,
        title: title || "Highlight",
        channel: String(s.videoOwnerChannelTitle || s.channelTitle || ch.handle),
        handle: ch.handle,
        sport: sportFor(ch.sport, `${s.title} ${s.description || ""}`.slice(0, 400)),
        publishedAt: String(item.contentDetails?.videoPublishedAt || s.publishedAt || "")
      });
      n += 1;
    }
    report.push({ handle: ch.handle, ok: true, clips: n });
  }));

  // Newest first, one copy of each video, the last few days — or the
  // newest 40 whatever their age if the window is thin (an off week).
  const seen = new Set();
  const sorted = clips
    .filter((c) => (seen.has(c.id) ? false : seen.add(c.id)))
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const cutoff = Date.now() - WINDOW_MS;
  const recent = sorted.filter((c) => new Date(c.publishedAt).getTime() >= cutoff);
  return {
    clips: (recent.length >= 12 ? recent : sorted.slice(0, 40)).slice(0, MAX_CLIPS),
    channels: report.sort((a, b) => a.handle.localeCompare(b.handle)),
    fetchedAt: new Date().toISOString()
  };
}

export async function onRequestGet(context) {
  const key = String(context.env.YOUTUBE_API_KEY || "").trim();
  const headers = { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" };
  if (!key) {
    return new Response(JSON.stringify({ ok: false, code: "NO_KEY", message: "Highlights need a YouTube API key on the site (YOUTUBE_API_KEY)." }), { status: 503, headers: { ...headers, "Cache-Control": "no-store" } });
  }

  const cache = caches.default;
  const feedKey = new Request("https://eastcoin-highlights.internal/feed-v1");
  const shadowKey = new Request("https://eastcoin-highlights.internal/feed-v1-shadow");
  const hit = await cache.match(feedKey);
  if (hit) return new Response(hit.body, { headers });

  let feed = null;
  try { feed = await refresh(key); } catch { feed = null; }
  if (!feed || !feed.clips.length) {
    const shadow = await cache.match(shadowKey);
    if (shadow) {
      const old = await shadow.json();
      return new Response(JSON.stringify({ ok: true, stale: true, ...old, channels: feed?.channels || old.channels }), { headers });
    }
    return new Response(JSON.stringify({ ok: false, code: "EMPTY", message: "No highlights came back from YouTube just now.", channels: feed?.channels || [] }), { status: 502, headers: { ...headers, "Cache-Control": "no-store" } });
  }

  const body = JSON.stringify({ ok: true, ...feed });
  await Promise.all([
    cache.put(feedKey, new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${FEED_TTL_S}` } })),
    cache.put(shadowKey, new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${SHADOW_TTL_S}` } }))
  ]).catch(() => {});
  return new Response(body, { headers });
}
