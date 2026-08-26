const fs = require("fs");
const path = require("path");

const changelogPath =
  path.join(
    process.cwd(),
    "changelog.html"
  );

if (!fs.existsSync(changelogPath)) {
  throw new Error("Missing changelog.html");
}

const before =
  fs.readFileSync(
    changelogPath,
    "utf8"
  );

const title =
  "Kalshi non-sports Picks experiment added";

if (
  before.includes(
    `<h2>${title}</h2>`
  )
) {
  console.log(
    "No change: Kalshi test changelog entry already exists."
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
    Added an isolated Kalshi public-market-data Picks experiment. EastCoin now
    discovers open non-sports Kalshi events, selects ten markets using category
    diversity first and market activity second, displays executable YES/NO ask
    prices with equivalent American odds, and lets Twitch-authenticated users
    make local fixed-odds test Picks from a 1,000-ZCoin mock wallet. Browse data
    is cached for 30 seconds while every attempted Pick requests the exact Kalshi
    market again before locking; moved prices require explicit re-confirmation.
    The test uses no Kalshi account, places no Kalshi trades, touches no
    StreamElements balance, and writes no production Picks ledger entries.
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
  next.slice(0,timelineEnd) +
  entry +
  next.slice(timelineEnd);

let countUpdated = false;

next = next.replace(
  /<div class="release-count">(\d+) major update groups<\/div>/,
  (_,count) => {
    countUpdated = true;
    return `<div class="release-count">${Number(count)+1} major update groups</div>`;
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

console.log("Updated: changelog.html");
console.log(
  "EastCoin Kalshi test changelog patch complete."
);
