/* ============================================================
   EastCoin V3 — team logos

   One lookup, used by every Picks surface that shows a team. A
   market only stores the names it was opened with ("Baltimore
   Orioles"), so the logo is found from the nickname and the sport
   and fetched from ESPN's public logo CDN, which the browser can
   load directly. Anything without a match keeps its initials —
   college football, mostly — so the fallback is always drawn first
   and the logo replaces it only once it has actually loaded.
   ============================================================ */
(() => {
  "use strict";

  const CDN = "https://a.espncdn.com/i/teamlogos";

  // Nickname -> ESPN abbreviation, per league. Two-word nicknames are
  // listed as written; everything else is the last word of the name.
  const NFL = {
    cardinals: "ari", falcons: "atl", ravens: "bal", bills: "buf", panthers: "car", bears: "chi",
    bengals: "cin", browns: "cle", cowboys: "dal", broncos: "den", lions: "det", packers: "gb",
    texans: "hou", colts: "ind", jaguars: "jax", chiefs: "kc", raiders: "lv", chargers: "lac",
    rams: "lar", dolphins: "mia", vikings: "min", patriots: "ne", saints: "no", giants: "nyg",
    jets: "nyj", eagles: "phi", steelers: "pit", "49ers": "sf", seahawks: "sea", buccaneers: "tb",
    titans: "ten", commanders: "wsh"
  };
  const MLB = {
    diamondbacks: "ari", braves: "atl", orioles: "bal", "red sox": "bos", cubs: "chc", "white sox": "chw",
    reds: "cin", guardians: "cle", rockies: "col", tigers: "det", astros: "hou", royals: "kc",
    angels: "laa", dodgers: "lad", marlins: "mia", brewers: "mil", twins: "min", mets: "nym",
    yankees: "nyy", athletics: "ath", phillies: "phi", pirates: "pit", padres: "sd", giants: "sf",
    mariners: "sea", cardinals: "stl", rays: "tb", rangers: "tex", "blue jays": "tor", nationals: "wsh"
  };
  const NBA = {
    hawks: "atl", celtics: "bos", nets: "bkn", hornets: "cha", bulls: "chi", cavaliers: "cle",
    mavericks: "dal", nuggets: "den", pistons: "det", warriors: "gs", rockets: "hou", pacers: "ind",
    clippers: "lac", lakers: "lal", grizzlies: "mem", heat: "mia", bucks: "mil", timberwolves: "min",
    pelicans: "no", knicks: "ny", thunder: "okc", magic: "orl", "76ers": "phi", suns: "phx",
    "trail blazers": "por", kings: "sac", spurs: "sa", raptors: "tor", jazz: "utah", wizards: "wsh"
  };
  const NHL = {
    ducks: "ana", bruins: "bos", sabres: "buf", flames: "cgy", hurricanes: "car", blackhawks: "chi",
    avalanche: "col", "blue jackets": "cbj", stars: "dal", "red wings": "det", oilers: "edm",
    panthers: "fla", kings: "la", wild: "min", canadiens: "mtl", predators: "nsh", devils: "nj",
    islanders: "nyi", rangers: "nyr", senators: "ott", flyers: "phi", penguins: "pit", sharks: "sj",
    kraken: "sea", blues: "stl", lightning: "tb", "maple leafs": "tor", mammoth: "utah",
    canucks: "van", "golden knights": "vgk", capitals: "wsh", jets: "wpg"
  };

  const TWO_WORD = /^(red sox|white sox|blue jays|maple leafs|golden knights|trail blazers|red wings|blue jackets)$/;

  function nickname(name) {
    const parts = String(name || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    if (!parts.length) return "";
    const tail2 = parts.slice(-2).join(" ");
    return TWO_WORD.test(tail2) ? tail2 : parts[parts.length - 1];
  }

  function leagueFor(sport, league) {
    const s = String(sport || "").toLowerCase();
    const l = String(league || "").toUpperCase();
    if (s === "american-football" || l === "NFL") return l === "CFB" || l === "NCAAF" ? null : "nfl";
    if (s === "baseball" || l === "MLB") return "mlb";
    if (s === "basketball" || l === "NBA") return "nba";
    if (s === "hockey" || l === "NHL") return "nhl";
    return null;
  }

  const TABLES = { nfl: NFL, mlb: MLB, nba: NBA, nhl: NHL };

  /** The logo URL for a team, or null when there is none to show. */
  function url(sport, league, name) {
    const key = leagueFor(sport, league);
    if (!key) return null;
    const abbr = TABLES[key][nickname(name)];
    return abbr ? `${CDN}/${key}/500/${abbr}.png` : null;
  }

  function initials(name) {
    return nickname(name).replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "?";
  }

  /**
   * A crest element: initials first, the logo over them once it loads.
   * The class is the caller's, so each surface keeps its own sizing.
   */
  function crest(sport, league, name, className) {
    const box = document.createElement("span");
    box.className = className;
    box.textContent = initials(name);
    const src = url(sport, league, name);
    if (!src) return box;

    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.addEventListener("load", () => box.classList.add("has-logo"));
    img.addEventListener("error", () => img.remove());
    img.src = src;
    box.append(img);
    return box;
  }

  window.ECLogos = { url, crest, initials, nickname };
})();
