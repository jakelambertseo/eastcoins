/* ============================================================
   EastCoin Screening Room — TMDB, behind the server

   The player (vidy.st) is keyed by TMDB ids and carries no
   catalog of its own, so titles, artwork and episode lists come
   from TMDB. The key stays here. Accepts either a v4 read token
   (the long "eyJ…" one) as TMDB_API_KEY or a v3 key; both are
   free.
   ============================================================ */

const API = "https://api.themoviedb.org/3";
export const IMG = "https://image.tmdb.org/t/p";

export function tmdbKey(env) {
  return String(env.TMDB_API_KEY || env.TMDB_READ_TOKEN || "").trim();
}

export async function tmdb(env, path, params = {}) {
  const key = tmdbKey(env);
  if (!key) return { ok: false, status: 503, code: "NO_TMDB_KEY" };

  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") url.searchParams.set(k, String(v));
  const headers = { Accept: "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set("api_key", key);

  const response = await fetch(url, { headers, cf: { cacheTtl: 600, cacheEverything: true } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, status: response.status, code: "TMDB_ERROR", detail: payload?.status_message };
  return { ok: true, payload };
}

export const json = (body, status = 200, maxAge = 300) => Response.json(body, {
  status,
  headers: { "Cache-Control": status === 200 ? `private, max-age=${maxAge}` : "no-store" }
});

/** One shape for a movie or a show, whichever endpoint it came from. */
export function slim(item, forcedType) {
  const type = forcedType || (item.media_type === "tv" || item.first_air_date ? "tv" : "movie");
  const date = type === "tv" ? item.first_air_date : item.release_date;
  return {
    id: Number(item.id),
    type,
    title: String(item.title || item.name || ""),
    year: date ? String(date).slice(0, 4) : "",
    overview: String(item.overview || ""),
    poster: item.poster_path ? `${IMG}/w342${item.poster_path}` : "",
    backdrop: item.backdrop_path ? `${IMG}/w780${item.backdrop_path}` : "",
    rating: Number.isFinite(item.vote_average) ? Math.round(item.vote_average * 10) / 10 : null
  };
}
