/* GET /api/screen/title?type=movie|tv&id=<tmdb>[&season=N]

   One title: artwork, overview, and for a show its seasons — plus
   the episode list for one season when asked. */

import { tmdb, json, slim, IMG } from "./_tmdb.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const type = url.searchParams.get("type") === "tv" ? "tv" : "movie";
  const id = Number(url.searchParams.get("id"));
  const season = Number(url.searchParams.get("season"));
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, code: "BAD_ID" }, 400);

  const r = await tmdb(context.env, `/${type}/${id}`, { language: "en-US" });
  if (!r.ok) return json({ ok: false, code: r.code, detail: r.detail || null }, r.status);
  const d = r.payload;

  const title = {
    ...slim(d, type),
    runtime: type === "movie" ? d.runtime || null : (d.episode_run_time || [])[0] || null,
    genres: (d.genres || []).map((g) => g.name),
    tagline: d.tagline || "",
    seasons: type === "tv"
      ? (d.seasons || [])
          .filter((s) => s.season_number > 0)
          .map((s) => ({ number: s.season_number, name: s.name, episodes: s.episode_count, poster: s.poster_path ? `${IMG}/w185${s.poster_path}` : "" }))
      : []
  };

  let episodes = null;
  if (type === "tv" && Number.isInteger(season) && season > 0) {
    const e = await tmdb(context.env, `/tv/${id}/season/${season}`, { language: "en-US" });
    if (e.ok) {
      episodes = (e.payload.episodes || []).map((ep) => ({
        number: ep.episode_number,
        name: ep.name,
        overview: ep.overview || "",
        still: ep.still_path ? `${IMG}/w300${ep.still_path}` : "",
        runtime: ep.runtime || null,
        aired: ep.air_date || ""
      }));
    }
  }

  return json({ ok: true, title, season: episodes ? { number: season, episodes } : null });
}
