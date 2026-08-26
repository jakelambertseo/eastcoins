const fs = require("fs");
const path = require("path");

const changelogPath =
  path.join(
    process.cwd(),
    "changelog.html"
  );

if (!fs.existsSync(changelogPath)) {
  throw new Error(
    "Missing changelog.html"
  );
}

const before =
  fs.readFileSync(
    changelogPath,
    "utf8"
  );

const title =
  "NFL sportsbook-odds Picks test added";

if (
  before.includes(
    `<h2>${title}</h2>`
  )
) {
  console.log(
    "No change: Odds API test changelog entry already exists."
  );
  process.exit(0);
}

let next = before;

next = next.replace(
  '<article class="timeline-entry latest">',
  '<article class="timeline-entry">'
);

next = next.replace(
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
    Added an isolated NFL Picks experiment powered by The Odds API. The test
    reads upcoming U.S. head-to-head bookmaker prices through a server-side
    Cloudflare proxy, removes each book's vig, calculates a median fair
    consensus moneyline, and lets Twitch-authenticated users lock fixed-odds
    test Picks against a local 1,000-ZCoin mock wallet. Odds are cached for 60
    seconds, new Picks close at kickoff, API quota usage is visible, and no
    StreamElements balance or production Picks ledger is touched.
  </p>
</article>
`;

const mainEnd =
  next.lastIndexOf("</main>");

const timelineEnd =
  mainEnd >= 0
    ? next.lastIndexOf(
        "</section>",
        mainEnd
      )
    : -1;

if (timelineEnd < 0) {
  throw new Error(
    "Could not find changelog timeline."
  );
}

next =
  next.slice(0, timelineEnd) +
  entry +
  next.slice(timelineEnd);

let countUpdated = false;

next = next.replace(
  /<div class="release-count">(\d+) major update groups<\/div>/,
  (_, count) => {
    countUpdated = true;

    return `<div class="release-count">${Number(count) + 1} major update groups</div>`;
  }
);

if (!countUpdated) {
  throw new Error(
    "Could not update changelog release count."
  );
}

fs.writeFileSync(
  changelogPath,
  next,
  "utf8"
);

console.log(
  "Updated: changelog.html"
);

console.log(
  "EastCoin NFL Odds API test changelog patch complete."
);
