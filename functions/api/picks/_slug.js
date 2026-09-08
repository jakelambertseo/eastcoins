/* ============================================================
   EastCoin Picks — one name for a game

   Chat, the settlement message and the /g/ page all need to agree
   on how a market is called, so the rule lives in exactly one
   place. "mustangs-seminoles-20260907" is readable in chat, unique
   for a night, and can be resolved back to the market without a
   slug column: the date bounds the search and the names pick the
   row.
   ============================================================ */

/**
 * The part of a team name people actually use. Same rule settlement
 * matches on, so a name that grades is a name that links.
 */
export function nick(value) {
  const parts = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  if (!parts.length) return "";
  const tail2 = parts.slice(-2).join(" ");
  if (/^(red sox|white sox|blue jays|maple leafs|golden knights|trail blazers)$/.test(tail2)) {
    return tail2;
  }
  return parts[parts.length - 1];
}

/** The US-Eastern calendar day a start time falls on, as YYYYMMDD. */
export function etDate(startsAt) {
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(when).replace(/-/g, "");
}

export function slugFor(market) {
  const away = nick(market?.away_name ?? market?.away).replace(/\s+/g, "-");
  const home = nick(market?.home_name ?? market?.home).replace(/\s+/g, "-");
  const day = etDate(market?.starts_at ?? market?.startsAt);
  if (!away || !home || !day) return "";
  return `${away}-${home}-${day}`;
}

/** Splits "mustangs-seminoles-20260907" back into its day; null if it isn't one. */
export function parseSlug(slug) {
  const m = /^(.+)-(\d{8})$/.exec(String(slug || ""));
  return m ? { teams: m[1], day: m[2] } : null;
}

/** ISO bounds of one ET calendar day, for a SQL range on starts_at. */
export function dayBounds(day) {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(day || ""));
  if (!m) return null;
  // ET is UTC-4 or -5; a 12-hour pad either side is cheap and never
  // misses a game, and the slug match narrows it back down.
  const mid = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return {
    from: new Date(mid - 24 * 3600 * 1000).toISOString(),
    to: new Date(mid + 24 * 3600 * 1000).toISOString()
  };
}
