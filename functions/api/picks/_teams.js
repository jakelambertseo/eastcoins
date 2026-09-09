/* ============================================================
   EastCoin Picks — the clubs someone can call their own

   One list per league, the ESPN abbreviation first because that is
   what the logo CDN is keyed on (the same keys v3-logos.js uses on
   the client). The profile's favourite-team picker reads this list
   and the save endpoint validates against it, so a favourite can
   only ever be a real club with a logo to show.
   ============================================================ */

const CDN = "https://a.espncdn.com/i/teamlogos";

export const LEAGUES = [
  { key: "nfl", label: "NFL", teams: [
    ["ari", "Arizona Cardinals"], ["atl", "Atlanta Falcons"], ["bal", "Baltimore Ravens"], ["buf", "Buffalo Bills"],
    ["car", "Carolina Panthers"], ["chi", "Chicago Bears"], ["cin", "Cincinnati Bengals"], ["cle", "Cleveland Browns"],
    ["dal", "Dallas Cowboys"], ["den", "Denver Broncos"], ["det", "Detroit Lions"], ["gb", "Green Bay Packers"],
    ["hou", "Houston Texans"], ["ind", "Indianapolis Colts"], ["jax", "Jacksonville Jaguars"], ["kc", "Kansas City Chiefs"],
    ["lv", "Las Vegas Raiders"], ["lac", "Los Angeles Chargers"], ["lar", "Los Angeles Rams"], ["mia", "Miami Dolphins"],
    ["min", "Minnesota Vikings"], ["ne", "New England Patriots"], ["no", "New Orleans Saints"], ["nyg", "New York Giants"],
    ["nyj", "New York Jets"], ["phi", "Philadelphia Eagles"], ["pit", "Pittsburgh Steelers"], ["sf", "San Francisco 49ers"],
    ["sea", "Seattle Seahawks"], ["tb", "Tampa Bay Buccaneers"], ["ten", "Tennessee Titans"], ["wsh", "Washington Commanders"]
  ] },
  { key: "mlb", label: "MLB", teams: [
    ["ari", "Arizona Diamondbacks"], ["atl", "Atlanta Braves"], ["bal", "Baltimore Orioles"], ["bos", "Boston Red Sox"],
    ["chc", "Chicago Cubs"], ["chw", "Chicago White Sox"], ["cin", "Cincinnati Reds"], ["cle", "Cleveland Guardians"],
    ["col", "Colorado Rockies"], ["det", "Detroit Tigers"], ["hou", "Houston Astros"], ["kc", "Kansas City Royals"],
    ["laa", "Los Angeles Angels"], ["lad", "Los Angeles Dodgers"], ["mia", "Miami Marlins"], ["mil", "Milwaukee Brewers"],
    ["min", "Minnesota Twins"], ["nym", "New York Mets"], ["nyy", "New York Yankees"], ["ath", "Athletics"],
    ["phi", "Philadelphia Phillies"], ["pit", "Pittsburgh Pirates"], ["sd", "San Diego Padres"], ["sf", "San Francisco Giants"],
    ["sea", "Seattle Mariners"], ["stl", "St. Louis Cardinals"], ["tb", "Tampa Bay Rays"], ["tex", "Texas Rangers"],
    ["tor", "Toronto Blue Jays"], ["wsh", "Washington Nationals"]
  ] },
  { key: "nba", label: "NBA", teams: [
    ["atl", "Atlanta Hawks"], ["bos", "Boston Celtics"], ["bkn", "Brooklyn Nets"], ["cha", "Charlotte Hornets"],
    ["chi", "Chicago Bulls"], ["cle", "Cleveland Cavaliers"], ["dal", "Dallas Mavericks"], ["den", "Denver Nuggets"],
    ["det", "Detroit Pistons"], ["gs", "Golden State Warriors"], ["hou", "Houston Rockets"], ["ind", "Indiana Pacers"],
    ["lac", "Los Angeles Clippers"], ["lal", "Los Angeles Lakers"], ["mem", "Memphis Grizzlies"], ["mia", "Miami Heat"],
    ["mil", "Milwaukee Bucks"], ["min", "Minnesota Timberwolves"], ["no", "New Orleans Pelicans"], ["ny", "New York Knicks"],
    ["okc", "Oklahoma City Thunder"], ["orl", "Orlando Magic"], ["phi", "Philadelphia 76ers"], ["phx", "Phoenix Suns"],
    ["por", "Portland Trail Blazers"], ["sac", "Sacramento Kings"], ["sa", "San Antonio Spurs"], ["tor", "Toronto Raptors"],
    ["utah", "Utah Jazz"], ["wsh", "Washington Wizards"]
  ] },
  { key: "nhl", label: "NHL", teams: [
    ["ana", "Anaheim Ducks"], ["bos", "Boston Bruins"], ["buf", "Buffalo Sabres"], ["cgy", "Calgary Flames"],
    ["car", "Carolina Hurricanes"], ["chi", "Chicago Blackhawks"], ["col", "Colorado Avalanche"], ["cbj", "Columbus Blue Jackets"],
    ["dal", "Dallas Stars"], ["det", "Detroit Red Wings"], ["edm", "Edmonton Oilers"], ["fla", "Florida Panthers"],
    ["la", "Los Angeles Kings"], ["min", "Minnesota Wild"], ["mtl", "Montreal Canadiens"], ["nsh", "Nashville Predators"],
    ["nj", "New Jersey Devils"], ["nyi", "New York Islanders"], ["nyr", "New York Rangers"], ["ott", "Ottawa Senators"],
    ["phi", "Philadelphia Flyers"], ["pit", "Pittsburgh Penguins"], ["sj", "San Jose Sharks"], ["sea", "Seattle Kraken"],
    ["stl", "St. Louis Blues"], ["tb", "Tampa Bay Lightning"], ["tor", "Toronto Maple Leafs"], ["utah", "Utah Mammoth"],
    ["van", "Vancouver Canucks"], ["vgk", "Vegas Golden Knights"], ["wsh", "Washington Capitals"], ["wpg", "Winnipeg Jets"]
  ] }
];

/** The club for a league key and abbreviation, or null. */
export function findTeam(league, abbr) {
  const l = LEAGUES.find((x) => x.key === String(league || "").toLowerCase());
  if (!l) return null;
  const hit = l.teams.find(([a]) => a === String(abbr || "").toLowerCase());
  return hit ? teamView(l, hit) : null;
}

export function teamView(league, [abbr, name]) {
  return { league: league.key, leagueLabel: league.label, abbr, name, logo: `${CDN}/${league.key}/500/${abbr}.png` };
}

/** The whole catalog, shaped for the picker. */
export function catalog() {
  return LEAGUES.map((l) => ({ key: l.key, label: l.label, teams: l.teams.map((t) => teamView(l, t)) }));
}

let ready = false;
/** Adds the two columns the first time anything asks; harmless after. */
export async function ensureFavouriteColumns(db) {
  if (ready) return;
  await db.prepare(`ALTER TABLE users ADD COLUMN favourite_league TEXT`).run().catch(() => {});
  await db.prepare(`ALTER TABLE users ADD COLUMN favourite_team TEXT`).run().catch(() => {});
  ready = true;
}
