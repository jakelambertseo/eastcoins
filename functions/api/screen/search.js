/* GET /api/screen/search?q=<text>  — movies and shows matching. */

import { tmdb, json, slim } from "./_tmdb.js";

export async function onRequestGet(context) {
  const q = String(new URL(context.request.url).searchParams.get("q") || "").trim().slice(0, 80);
  if (q.length < 2) return json({ ok: true, results: [] });

  const r = await tmdb(context.env, "/search/multi", { query: q, include_adult: "false", language: "en-US", page: 1 });
  if (!r.ok) return json({ ok: false, code: r.code, detail: r.detail || null }, r.status);

  const results = (r.payload.results || [])
    .filter((x) => x.media_type === "movie" || x.media_type === "tv")
    .map((x) => slim(x))
    .filter((x) => x.title)
    .slice(0, 24);
  return json({ ok: true, results });
}
