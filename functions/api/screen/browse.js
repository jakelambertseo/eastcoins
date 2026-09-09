/* GET /api/screen/browse?type=movie|tv&list=trending|popular|top|new|upcoming
                          [&genre=<id>][&sort=popular|rating|date][&page=N]
   GET /api/screen/browse?type=movie|tv&list=genres

   The shelves. A named list maps to TMDB's own curated endpoint; a
   genre or an explicit sort goes through discover instead, which is
   the only endpoint that takes both. */

import { tmdb, json, slim } from "./_tmdb.js";
import { requireLogin } from "./_gate.js";

const LISTS = {
  movie: { trending: "/trending/movie/week", popular: "/movie/popular", top: "/movie/top_rated", new: "/movie/now_playing", upcoming: "/movie/upcoming" },
  tv: { trending: "/trending/tv/week", popular: "/tv/popular", top: "/tv/top_rated", new: "/tv/on_the_air", upcoming: "/tv/airing_today" }
};

const SORTS = {
  movie: { popular: "popularity.desc", rating: "vote_average.desc", date: "primary_release_date.desc" },
  tv: { popular: "popularity.desc", rating: "vote_average.desc", date: "first_air_date.desc" }
};

export async function onRequestGet(context) {
  const gate = await requireLogin(context);
  if (gate.denied) return gate.denied;
  const url = new URL(context.request.url);
  const type = url.searchParams.get("type") === "tv" ? "tv" : "movie";
  const list = String(url.searchParams.get("list") || "trending").toLowerCase();
  const genre = String(url.searchParams.get("genre") || "").replace(/[^\d,]/g, "");
  const sort = String(url.searchParams.get("sort") || "").toLowerCase();
  const page = Math.min(20, Math.max(1, Number(url.searchParams.get("page")) || 1));

  if (list === "genres") {
    const r = await tmdb(context.env, `/genre/${type}/list`, { language: "en-US" });
    if (!r.ok) return json({ ok: false, code: r.code, detail: r.detail || null }, r.status);
    return json({ ok: true, genres: (r.payload.genres || []).map((g) => ({ id: g.id, name: g.name })) }, 200, 86400);
  }

  let r;
  if (genre || SORTS[type][sort]) {
    const params = {
      language: "en-US", page, include_adult: "false",
      sort_by: SORTS[type][sort] || "popularity.desc",
      with_genres: genre || undefined,
      // A rating sort without a floor is a list of films six people saw.
      "vote_count.gte": sort === "rating" ? 300 : 50
    };
    if (type === "movie" && sort === "date") params["primary_release_date.lte"] = new Date().toISOString().slice(0, 10);
    if (type === "tv" && sort === "date") params["first_air_date.lte"] = new Date().toISOString().slice(0, 10);
    r = await tmdb(context.env, `/discover/${type}`, params);
  } else {
    const path = LISTS[type][list] || LISTS[type].trending;
    r = await tmdb(context.env, path, { language: "en-US", page });
  }
  if (!r.ok) return json({ ok: false, code: r.code, detail: r.detail || null }, r.status);

  const results = (r.payload.results || []).map((x) => slim(x, type)).filter((x) => x.title && x.poster);
  return json({
    ok: true,
    type, list, page,
    pages: Math.min(20, Number(r.payload.total_pages) || 1),
    results
  }, 200, 900);
}
