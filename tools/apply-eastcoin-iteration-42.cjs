const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function p(rel) {
  return path.join(ROOT, ...rel.split("/"));
}

function read(rel) {
  const full = p(rel);

  if (!fs.existsSync(full)) {
    throw new Error(`Missing required file: ${rel}`);
  }

  return fs.readFileSync(full, "utf8");
}

function replaceOne(content, before, after, label) {
  const count = content.split(before).length - 1;

  if (count !== 1) {
    throw new Error(
      `${label}: expected 1 match, found ${count}. ` +
      `Make sure your local main branch contains the root-launch commit first.`
    );
  }

  return content.replace(before, after);
}

/*
  Root launch note:
  /v2/index.html is now only a compatibility redirect and intentionally has
  no Events JS bundle. Do not try to cache-bust it.
*/
const files = new Map();

for (const rel of [
  "v2/assets/js/events.js",
  "index.html",
  "changelog.html"
]) {
  files.set(rel, read(rel));
}

/* ================================================================
   EVENTS — NFL-FIRST FOOTBALL ORDER
   ================================================================ */
{
  let js = files.get("v2/assets/js/events.js");

  if (!js.includes("function isNflGame(match)")) {
    const anchor = `  function isRedZone(match) {
    const text = redZoneText(match);

    return (
      text.includes("redzone") ||
      text.includes("red zone")
    );
  }
`;

    const addition = `${anchor}
  const NFL_TEAM_NAMES = [
    "arizona cardinals",
    "atlanta falcons",
    "baltimore ravens",
    "buffalo bills",
    "carolina panthers",
    "chicago bears",
    "cincinnati bengals",
    "cleveland browns",
    "dallas cowboys",
    "denver broncos",
    "detroit lions",
    "green bay packers",
    "houston texans",
    "indianapolis colts",
    "jacksonville jaguars",
    "kansas city chiefs",
    "las vegas raiders",
    "los angeles chargers",
    "los angeles rams",
    "miami dolphins",
    "minnesota vikings",
    "new england patriots",
    "new orleans saints",
    "new york giants",
    "new york jets",
    "philadelphia eagles",
    "pittsburgh steelers",
    "san francisco 49ers",
    "seattle seahawks",
    "tampa bay buccaneers",
    "tennessee titans",
    "washington commanders"
  ];

  function footballLeagueText(match) {
    const odds =
      V2.cardOdds?.forMatch?.(match);

    return [
      match?.title,
      match?.category,
      match?.sport,
      match?.league,
      match?.competition,
      match?.tournament,
      match?.network,
      match?.broadcast,
      match?.teams?.away?.name,
      match?.teams?.home?.name,
      odds?.sportKey,
      odds?.sportTitle
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isNflGame(match) {
    if (isRedZone(match)) {
      return true;
    }

    const odds =
      V2.cardOdds?.forMatch?.(match);

    if (
      String(odds?.sportKey || "")
        .toLowerCase() ===
      "americanfootball_nfl"
    ) {
      return true;
    }

    const text =
      footballLeagueText(match);

    if (
      /(^| )nfl( |$)/.test(text) ||
      text.includes(
        "national football league"
      ) ||
      text.includes(
        "americanfootball nfl"
      )
    ) {
      return true;
    }

    /*
      Explicit college markers win before team-name fallback. This keeps NCAA,
      FBS and FCS games below the NFL even when school/team wording overlaps.
    */
    if (
      /(^| )(ncaaf|ncaa|fbs|fcs)( |$)/.test(text) ||
      text.includes(
        "college football"
      )
    ) {
      return false;
    }

    return NFL_TEAM_NAMES.some(
      (team) =>
        text.includes(team)
    );
  }
`;

    js = replaceOne(
      js,
      anchor,
      addition,
      "NFL detection helper"
    );
  }

  const oldOrdering = `    // RedZone is a featured NFL broadcast surface. Keep it at the front of
    // Football regardless of Recommended vs Time sorting.
    const orderedMatches =
      family === "american-football"
        ? [
            ...matches.filter(isRedZone),
            ...matches.filter((match) => !isRedZone(match))
          ]
        : matches;`;

  const newOrdering = `    /*
      Football priority is intentionally tiered:
      1. RedZone
      2. NFL games
      3. College / other football

      "matches" is already sorted by the user's Recommended/Time choice, so
      filtering into tiers preserves that ordering inside each tier.
    */
    const orderedMatches =
      family === "american-football"
        ? [
            ...matches.filter(isRedZone),
            ...matches.filter(
              (match) =>
                !isRedZone(match) &&
                isNflGame(match)
            ),
            ...matches.filter(
              (match) =>
                !isRedZone(match) &&
                !isNflGame(match)
            )
          ]
        : matches;`;

  js = replaceOne(
    js,
    oldOrdering,
    newOrdering,
    "Football category priority"
  );

  files.set(
    "v2/assets/js/events.js",
    js
  );
}

/* ================================================================
   ROOT CACHE BUST
   ================================================================ */
{
  let html = files.get("index.html");

  const pattern =
    /(\/v2\/assets\/js\/events\.js\?v=)\d+/;

  if (!pattern.test(html)) {
    throw new Error(
      "index.html: could not find the root Events JS reference to cache-bust."
    );
  }

  html = html.replace(
    pattern,
    "$142"
  );

  files.set(
    "index.html",
    html
  );
}

/* ================================================================
   CHANGELOG
   ================================================================ */
{
  let html = files.get("changelog.html");

  const title =
    "Football listings now prioritize NFL games above college football";

  if (!html.includes(`<h2>${title}</h2>`)) {
    html = html.replace(
      /<div class="release-count">(\d+) major update groups<\/div>/,
      (_, count) =>
        `<div class="release-count">${Number(count) + 1} major update groups</div>`
    );

    html = html.replace(
      '<article class="timeline-entry latest">',
      '<article class="timeline-entry">'
    );

    html = html.replace(
      /\s*<span class="latest-badge">Latest<\/span>/,
      ""
    );

    const entry = `
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-27">August 27, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Updated the Football event section so NFL content is always surfaced ahead
    of the much larger college-football catalog. NFL RedZone remains first,
    followed by NFL games, then NCAA and other football events. Recommended or
    Time sorting is still preserved inside each tier, so college games remain
    fully available without burying the NFL slate.
</p>
</article>
`;

    const timelineEnd =
      html.lastIndexOf(
        "</section>"
      );

    if (timelineEnd < 0) {
      throw new Error(
        "Could not locate the changelog timeline."
      );
    }

    html =
      html.slice(
        0,
        timelineEnd
      ) +
      entry +
      html.slice(
        timelineEnd
      );
  }

  files.set(
    "changelog.html",
    html
  );
}

/* ================================================================
   WRITE ONLY AFTER ALL PREFLIGHTS PASS
   ================================================================ */
for (const [rel, content] of files) {
  fs.writeFileSync(
    p(rel),
    content,
    "utf8"
  );

  console.log(
    `Updated: ${rel}`
  );
}

console.log("");
console.log("EastCoin Iteration 42 complete.");
console.log("Football now orders: RedZone -> NFL -> college/other.");
