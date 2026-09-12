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
     3. Nothing exact? Search again with the hyphens left in. TMDB
        tokenises "wall-e" and "wall e" differently and only one of
        them finds WALL·E.
     4. Still nothing exact, but something whose name starts with
        what was asked for (or the other way round) — that catches a
        title carrying a subtitle we did not know about.
     5. Otherwise NOTHING. Deliberately: taking TMDB's first result
        turned /movie/wall-e into "East of Wall", and confidently
        opening the wrong film is worse than admitting the miss.
        The client turns a miss into a search for the same words,
        which puts the person one click from what they wanted.

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
  const nameOf = (x) => (kind === "tv" ? x.name || x.original_name : x.title || x.original_title) || "";
  const popular = (list) => list.reduce((a, b) => (Number(b.popularity || 0) > Number(a.popularity || 0) ? b : a), list[0]);

  const ask = async (query) => {
    const r = await tmdb(env, `/search/${kind}`, { query, include_adult: "false", language: "en-US" });
    return r.ok && Array.isArray(r.payload?.results) ? r.payload.results : [];
  };

  // Spaces first, because that is what most names look like written out.
  let seen = await ask(phrase(wanted));
  let exact = seen.filter((x) => slugify(nameOf(x)) === wanted);

  // Then hyphens, which is a different query as far as TMDB is concerned
  // and is the one that finds WALL·E.
  if (!exact.length) {
    const second = await ask(wanted);
    if (second.length) {
      seen = seen.concat(second);
      exact = seen.filter((x) => slugify(nameOf(x)) === wanted);
    }
  }

  let best = exact.length ? popular(exact) : null;

  // No exact name, but something that begins with it — a title with a
  // subtitle we did not know about — is still almost certainly it.
  if (!best) {
    const close = seen.filter((x) => {
      const slug = slugify(nameOf(x));
      return slug && (slug.startsWith(`${wanted}-`) || wanted.startsWith(`${slug}-`));
    });
    if (close.length) best = popular(close);
  }

  // Nothing close enough. Saying so beats opening the wrong film.
  if (!best?.id) return null;
  const isExact = slugify(nameOf(best)) === wanted;

  return {
    id: Number(best.id),
    type: kind,
    name: nameOf(best),
    slug: slugify(nameOf(best)),
    // True when the URL named this exactly; false means it was close
    // and the caller should straighten the address bar.
    exact: isExact,
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
