/* ============================================================
   GET /api/eastscape/emotes — the channel's 7TV and BetterTTV emotes, boiled down

   A beta tester asked (2026-09-21): "can the chat handle emotes at all, like can it sync with BTTV or 7tv emotes we
   have on site?" Both services will hand a browser the channel's list, but 7TV's answer is about 2 MB (877 emotes with
   every file size and owner attached), which is far too much to make every player's browser fetch and parse.

   So the site asks ONCE AN HOUR, keeps only what the chat needs, and the game loads that the first time chat is used:

     { ok, at, n, emotes: [[name, url, wide]] }     about 60 KB raw, about 20 KB compressed

   url is the 1x webp (28 px tall, the size of a line of chat). wide is 1 for an emote at least twice as wide as it is
   tall, so the page can give it room. 7TV wins a name both services have, because it is the one the channel uses most.

   Public and keyless: it is the same list anybody can read off the two services. If either service is down the other
   still answers; if both are, the last good copy at the edge is served for a day (stale-if-error) and after that the
   game simply shows the word, as it always did.
   ============================================================ */
const TWITCH_ID = "215028532";   // zwades
const clean = (s) => String(s || "").slice(0, 40);
const okName = (s) => /^[\x21-\x7e]{2,40}$/.test(s) && !/[<>"'&]/.test(s);

async function sevenTv() {
  const r = await fetch(`https://7tv.io/v3/users/twitch/${TWITCH_ID}`, { headers: { "User-Agent": "EastScape/1.0 (eastcoin.vip)" } });
  if (!r.ok) throw new Error(`7tv ${r.status}`);
  const j = await r.json();
  return (j?.emote_set?.emotes || []).map((e) => {
    const host = e?.data?.host?.url, f = (e?.data?.host?.files || []).find((x) => x.name === "1x.webp");
    return host ? [clean(e.name), `https:${host}/1x.webp`, f && f.width >= f.height * 2 ? 1 : 0] : null;
  }).filter(Boolean);
}
async function bttv() {
  const r = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${TWITCH_ID}`, { headers: { "User-Agent": "EastScape/1.0 (eastcoin.vip)" } });
  if (!r.ok) throw new Error(`bttv ${r.status}`);
  const j = await r.json();
  return [...(j?.channelEmotes || []), ...(j?.sharedEmotes || [])].map((e) => (/^[a-f0-9]{24}$/.test(String(e?.id)) ? [clean(e.code), `https://cdn.betterttv.net/emote/${e.id}/1x.webp`, 0] : null)).filter(Boolean);
}

export async function onRequestGet(context) {
  const cache = caches.default, key = new Request("https://eastcoin.internal/eastscape/emotes/v1");
  const hit = await cache.match(key); if (hit) return hit;
  const [a, b] = await Promise.allSettled([sevenTv(), bttv()]), seen = new Set(), emotes = [];
  for (const list of [a, b]) for (const e of list.status === "fulfilled" ? list.value : []) if (okName(e[0]) && !seen.has(e[0])) { seen.add(e[0]); emotes.push(e); }
  const okAny = emotes.length > 0;
  const res = new Response(JSON.stringify({ ok: okAny, at: new Date().toISOString(), n: emotes.length, sources: { sevenTv: a.status === "fulfilled", bttv: b.status === "fulfilled" }, emotes }), {
    status: okAny ? 200 : 502,
    headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": okAny ? "public, max-age=3600, stale-if-error=86400" : "no-store" }
  });
  if (okAny) context.waitUntil(cache.put(key, res.clone()));
  return res;
}
