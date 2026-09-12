/* ============================================================
   GET /api/screen/resolve?type=movie|tv&slug=<slug>

   A pretty URL carries a name, not an id, so something has to turn
   "inception" back into 27205. That is this.

   How a winner is picked, in order:

     1. An exact slug match on the title. "inception" must beat
        "inception: the cobol job", which a plain relevance sort
        does not guarantee.
     2. Among exact matches, the most popular. Remakes share a
        name and the one people mean is almost always the one
        people watch.
     3. Failing any exact match, TMDB's own first result, which is
        already relevance-ranked, so a near-miss or a typo still
        lands somewhere sensible rather than on an error.

   Also returns the canonical path for whatever it found, so the
   client can correct the address bar when someone arrives on a
   near-miss: /movie/inceptionn quietly becomes /movie/inception.
   ============================================================ */

import { tmdb, json, slim } from "./_tmdb.js";
import { requireLogin } from "./_gate.js";
import { slugify, moviePath, tvPath } from "./_slug.js";

/** The searchable form of a slug: hyphens back to spaces. */
const phrase = (slug) => String(slug || "").replace(/-+/g, " ").trim();

/**
 * Finds the title a slug meant. Shared with the Pages functions that
 * render the <title> tag, which have no session to gate on — hence
 * env in, not context.
 */
export async function resolveSlug(env, type, slug) {
  const wanted = slugify(slug);
  if (!wanted) return null;

  const kind = type === "tv" ? "tv" : "movie";
  const r = await tmdb(env, `/search/${kind}`, {
    query: phrase(wanted),
    include_adult: "false",
    language: "en-US"
  });
  if (!r.ok) return null;

  const results = Array.isArray(r.payload?.results) ? r.payload.results : [];
  if (!results.length) return null;

  const nameOf = (x) => (kind === "tv" ? x.name || x.original_name : x.title || x.original_title) || "";
  const exact = results.filter((x) => slugify(nameOf(x)) === wanted);
  const pool = exact.length ? exact : results;
  const best = pool.reduce((a, b) => (Number(b.popularity || 0) > Number(a.popularity || 0) ? b : a), pool[0]);
  if (!best?.id) return null;

  return {
    id: Number(best.id),
    type: kind,
    name: nameOf(best),
    slug: slugify(nameOf(best)),
    // True when the URL named this exactly; false means we guessed and
    // the caller should straighten the address bar.
    exact: exact.length > 0,
    item: slim(best, kind)
  };
}

export async function onRequestGet(context) {
  const gate = await requireLogin(context);
  if (gate.denied) return gate.denied;

  const url = new URL(context.request.url);
  const type = url.searchParams.get("type") === "tv" ? "tv" : "movie";
  const slug = url.searchParams.get("slug") || "";
  const season = Number(url.searchParams.get("season"));
  const episode = Number(url.searchParams.get("episode"));

  const found = await resolveSlug(context.env, type, slug);
  if (!found) return json({ ok: false, code: "NOT_FOUND", slug: slugify(slug) }, 404);

  const path = type === "tv"
    ? tvPath(found.name, Number.isInteger(season) && season > 0 ? season : null, Number.isInteger(episode) && episode > 0 ? episode : null)
    : moviePath(found.name);

  return json({
    ok: true,
    id: found.id,
    type: found.type,
    name: found.name,
    slug: found.slug,
    exact: found.exact,
    path,
    item: found.item
  }, 200, 3600);
}
