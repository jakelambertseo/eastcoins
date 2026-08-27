const fs = require("fs");
const path = require("path");

const changelogPath = path.join(
  process.cwd(),
  "changelog.html"
);

if (!fs.existsSync(changelogPath)) {
  throw new Error("Missing changelog.html");
}

const title =
  "EastCoin V2 Quick Bet and exact Picks market handoff added";

let html =
  fs.readFileSync(
    changelogPath,
    "utf8"
  );

if (
  html.includes(
    `<h2>${title}</h2>`
  )
) {
  console.log(
    "No change: Iteration 15 changelog entry already exists."
  );
  process.exit(0);
}

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
<time datetime="2026-08-26">August 26, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Replaced the V2 Bet card action's fuzzy Picks-page search with an exact,
    server-verified market handoff. Card odds now retain the underlying Odds API
    event ID. When Bet is selected on a pregame event, EastCoin verifies that
    provider event against the shared cached Odds API catalog, reuses an existing
    odds_api Picks market or creates one idempotently in D1 under the active
    Picks season, then opens a native V2 Quick Bet ticket over the Events page.
    The ticket lets users choose a side and use the Picks wager slider without
    leaving the persistent V2 shell. Sportsbook moneyline numbers remain labeled
    as reference odds while projected Picks payouts use the community pool.
    Real submission continues to honor the production Picks wallet and wagering
    flags rather than simulating a successful ZCoin wager.
</p>
</article>
`;

const mainEnd =
  html.lastIndexOf(
    "</main>"
  );

const timelineEnd =
  mainEnd >= 0
    ? html.lastIndexOf(
        "</section>",
        mainEnd
      )
    : -1;

if (timelineEnd < 0) {
  throw new Error(
    "Could not find changelog timeline section."
  );
}

html =
  html.slice(0, timelineEnd) +
  entry +
  html.slice(timelineEnd);

let updated = false;

html = html.replace(
  /<div class="release-count">(\d+) major update groups<\/div>/,
  (_, count) => {
    updated = true;

    return `<div class="release-count">${Number(count) + 1} major update groups</div>`;
  }
);

if (!updated) {
  throw new Error(
    "Could not update changelog release count."
  );
}

fs.writeFileSync(
  changelogPath,
  html,
  "utf8"
);

console.log(
  "Updated: changelog.html"
);

console.log(
  "EastCoin V2 Iteration 15 changelog patch complete."
);
