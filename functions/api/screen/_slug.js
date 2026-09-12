/* ============================================================
   Movies & TV — the name rule

     /movie/inception
     /tv/lost
     /tv/lost-s1
     /tv/lost-s1-ep1

   One place, like picks/_slug.js, because three things have to
   agree about a URL: the Pages function that serves the page, the
   client that reads it, and the client that WRITES it when someone
   opens a title. If they drift, a link works when clicked and
   breaks when copied.

   No TMDB id in the path, on purpose. "/movie/inception-27205"
   would always resolve, but the ask was for the clean form and an
   id in a URL is noise to everyone who is not a programmer. The
   cost is that the slug has to be searched for, which resolve.js
   does, preferring an exact title match and then popularity.

   Note what is NOT parsed out of the tail: a trailing number is
   part of the name, never an id or a year. "Ocean's 11" slugs to
   "oceans-11" and has to come back as Ocean's 11, which is exactly
   what an id-in-the-tail rule would get wrong.
   ============================================================ */

// NFKD pulls accents off a letter but leaves the letters that are not
// an accented anything, so æ, ø, ß, ł and đ would each become a hyphen
// and "Æon Flux" would slug to "on-flux". Spell them out first.
const LIGATURES = [[/æ/gi, "ae"], [/œ/gi, "oe"], [/ø/gi, "o"], [/ß/g, "ss"], [/ł/gi, "l"], [/đ|ð/gi, "d"], [/þ/gi, "th"]];

/**
 * A title to its URL form: lowercase, accents folded, anything that
 * is not a letter or digit becoming a single hyphen.
 *
 *   "Léon: The Professional" -> "leon-the-professional"
 *   "Ocean's 11"             -> "oceans-11"
 *   "WALL·E"                 -> "wall-e"
 */
export function slugify(name) {
  let text = String(name || "");
  for (const [rx, to] of LIGATURES) text = text.replace(rx, to);
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")   // drop the accents NFKD split off
    .replace(/['’]/g, "")          // an apostrophe closes up: don't -> dont
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** "/movie/<slug>" -> { slug } or null when there is nothing to look up. */
export function parseMovie(path) {
  const slug = slugify(String(path || "").split("/")[0]);
  return slug ? { type: "movie", slug } : null;
}

/**
 * "/tv/<slug>[-s<N>[-ep<M>]]" -> { slug, season, episode }.
 *
 * Season and episode are read off the END and only in that order, so
 * a show whose own name ends in something season-shaped has to be the
 * one thing this gets wrong, rather than every show with a number in
 * its title.
 */
export function parseTv(path) {
  let rest = slugify(String(path || "").split("/")[0]);
  if (!rest) return null;

  let season = null;
  let episode = null;

  const ep = rest.match(/^(.*)-ep(\d{1,3})$/);
  if (ep) {
    rest = ep[1];
    episode = Number(ep[2]);
  }
  const se = rest.match(/^(.*)-s(\d{1,3})$/);
  if (se) {
    rest = se[1];
    season = Number(se[2]);
  }
  // "-ep3" with no "-s2" in front of it is half a reference. Treat the
  // whole thing as a show name rather than guessing season 1, which
  // would send someone to an episode they did not ask for.
  if (episode !== null && season === null) return { type: "tv", slug: slugify(String(path).split("/")[0]), season: null, episode: null };
  if (!rest) return null;
  return { type: "tv", slug: rest, season, episode };
}

/** The path for a movie, given its title. */
export function moviePath(title) {
  const slug = slugify(title);
  return slug ? `/movie/${slug}` : "";
}

/** The path for a show, a season, or one episode. */
export function tvPath(name, season, episode) {
  const slug = slugify(name);
  if (!slug) return "";
  const s = Number(season);
  const e = Number(episode);
  if (!Number.isInteger(s) || s <= 0) return `/tv/${slug}`;
  if (!Number.isInteger(e) || e <= 0) return `/tv/${slug}-s${s}`;
  return `/tv/${slug}-s${s}-ep${e}`;
}
