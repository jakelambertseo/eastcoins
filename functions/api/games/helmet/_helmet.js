/* ============================================================
   Helmet Zoom — one NFL crest a day, zoomed past recognition

   The day's team comes from that day's seed, made on the first
   request and kept in game_days, so nobody can work the answer out
   from the date. The page never learns which team it is: it draws
   from /api/games/helmet/img, an endpoint keyed on the DAY, and
   every guess is graded here.

   Six guesses. The crop pulls back with each wrong one, the
   conference is given away after three and the division after four.
   Scoring is the Wordle shape — first guess is worth 6, sixth is
   worth 1, a miss is worth nothing — so the board sorts by how few
   guesses it took.
   ============================================================ */

import { LEAGUES } from "../../picks/_teams.js";
import { pick, fraction } from "../_games.js";

export const NFL = LEAGUES.find((l) => l.key === "nfl").teams;   // [abbr, "Full Name"]
export const MAX_GUESSES = 6;
// How far in the crop is at each guess: tight enough to be unfair at
// first, a whole crest by the last.
export const ZOOMS = [15, 9.5, 6, 4, 2.6, 1.7];

/* The division each club sits in, for the hints the later guesses give.
   Written out rather than derived: there is no feed for it and it never
   changes. */
export const DIVISIONS = {
  buf: "AFC East", mia: "AFC East", ne: "AFC East", nyj: "AFC East",
  bal: "AFC North", cin: "AFC North", cle: "AFC North", pit: "AFC North",
  hou: "AFC South", ind: "AFC South", jax: "AFC South", ten: "AFC South",
  den: "AFC West", kc: "AFC West", lv: "AFC West", lac: "AFC West",
  dal: "NFC East", nyg: "NFC East", phi: "NFC East", wsh: "NFC East",
  chi: "NFC North", det: "NFC North", gb: "NFC North", min: "NFC North",
  atl: "NFC South", car: "NFC South", no: "NFC South", tb: "NFC South",
  ari: "NFC West", lar: "NFC West", sf: "NFC West", sea: "NFC West"
};

let ready = false;
export async function ensureHelmet(db) {
  if (ready) return;
  await db
    .prepare(`CREATE TABLE IF NOT EXISTS helmet_plays (
      day TEXT NOT NULL,
      user_id TEXT NOT NULL,
      guesses TEXT NOT NULL DEFAULT '[]',
      solved INTEGER NOT NULL DEFAULT 0,
      done INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (day, user_id)
    )`)
    .run();
  ready = true;
}

/** The club this day belongs to: [abbr, name]. */
export async function teamFor(seed) {
  return NFL[await pick(seed, "team", NFL.length)];
}

/**
 * Where the crop sits. Kept off the very middle — plenty of crests are
 * symmetrical and a centred crop gives half of them away — but never so
 * far out that the first frame is empty background.
 */
export async function cropFor(seed) {
  const x = 0.3 + (await fraction(seed, "cx")) * 0.4;
  const y = 0.3 + (await fraction(seed, "cy")) * 0.4;
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
}



const squash = (v) => String(v || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/* Two clubs to a city in two places, so the bare city is nobody's name:
   "New York" is the Jets and the Giants, "Los Angeles" the Chargers and
   the Rams. Typing one of those asks which rather than picking. */
const SHARED_CITIES = (() => {
  const seen = new Map();
  for (const [abbr, full] of NFL) {
    const city = squash(full.split(" ").slice(0, -1).join(" "));
    seen.set(city, (seen.get(city) || []).concat(abbr));
  }
  return new Map([...seen].filter(([, list]) => list.length > 1));
})();

/** Every name a club answers to: abbreviation, nickname, city, full name. */
export function namesFor([abbr, full]) {
  const parts = full.split(" ");
  const nickname = /^(Red Sox|White Sox|Blue Jays)$/.test(parts.slice(-2).join(" ")) ? parts.slice(-2).join(" ") : parts[parts.length - 1];
  const city = squash(parts.slice(0, -1).join(" "));
  const out = new Set([abbr, full, nickname].map(squash));
  if (city && !SHARED_CITIES.has(city)) out.add(city);
  // The ones people actually type.
  const EXTRA = {
    wsh: ["commanders", "washington", "was", "wft"], lv: ["raiders", "lasvegas", "oakland", "oak"],
    lac: ["chargers", "lachargers", "losangeleschargers", "sandiego"], lar: ["rams", "larams", "losangelesrams", "stlouis"],
    ne: ["patriots", "pats", "newengland", "nwe"], nyj: ["jets", "newyorkjets"], nyg: ["giants", "newyorkgiants"],
    gb: ["packers", "greenbay", "gnb"], kc: ["chiefs", "kansascity"], sf: ["49ers", "niners", "sanfrancisco", "fortyniners"],
    tb: ["buccaneers", "bucs", "tampabay", "tampa"], no: ["saints", "neworleans", "nor"], jax: ["jaguars", "jags", "jacksonville", "jac"],
    ari: ["cardinals", "arizona", "cards", "arz"], cle: ["browns", "cleveland"], hou: ["texans", "houston"],
    ten: ["titans", "tennessee"], den: ["broncos", "denver"], det: ["lions", "detroit"], min: ["vikings", "minnesota", "vikes"],
    phi: ["eagles", "philadelphia", "philly"], pit: ["steelers", "pittsburgh"], sea: ["seahawks", "seattle", "hawks"],
    bal: ["ravens", "baltimore"], buf: ["bills", "buffalo"], car: ["panthers", "carolina"], chi: ["bears", "chicago"],
    cin: ["bengals", "cincinnati", "cincy"], dal: ["cowboys", "dallas"], ind: ["colts", "indianapolis", "indy"],
    mia: ["dolphins", "miami", "fins"], atl: ["falcons", "atlanta"]
  };
  for (const e of EXTRA[abbr] || []) out.add(squash(e));
  return out;
}

/**
 * Which club someone typed. Returns the club, or { ambiguous } when the
 * words name a city two clubs share, or null when it names nothing.
 */
export function matchTeam(text) {
  const want = squash(text);
  if (!want) return null;
  const shared = SHARED_CITIES.get(want);
  if (shared) return { ambiguous: shared.map((a) => NFL.find((t) => t[0] === a)[1]) };
  for (const team of NFL) if (namesFor(team).has(want)) return team;
  // A leading part of a full name, once it is long enough to be meant.
  if (want.length >= 5) {
    const hits = NFL.filter((t) => squash(t[1]).startsWith(want));
    if (hits.length === 1) return hits[0];
  }
  return null;
}

/** What the page is allowed to know at this point in the play. */
export function hintsFor(team, wrong) {
  const [abbr] = team;
  const division = DIVISIONS[abbr] || "";
  return {
    conference: wrong >= 3 ? division.slice(0, 3) : null,
    division: wrong >= 4 ? division : null
  };
}

export const scoreFor = (guessesUsed, solved) => (solved ? MAX_GUESSES + 1 - guessesUsed : 0);

export const parseGuesses = (t) => { try { const v = JSON.parse(t || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
