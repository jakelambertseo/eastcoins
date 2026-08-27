const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");
if (!fs.existsSync(changelogPath)) throw new Error("Missing changelog.html");

const title = "EastCoin V2 live scores moved to ESPN and MultiView restored";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: Iteration 11 changelog entry already exists.");
  process.exit(0);
}

html = html.replace(
  '<article class="timeline-entry latest">',
  '<article class="timeline-entry">'
);
html = html.replace(/\s*<span class="latest-badge">Latest<\/span>/, "");

const entry = `
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-26">August 26, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Replaced the first Kalshi-based V2 live-score experiment with a fail-soft
    server-side ESPN public scoreboard matcher that uses both team names and
    event start time to enrich live cards with real scores and game state.
    Cleaned the V1-style cards by removing Streamed/PPV provider fallback labels
    and the Live now / viewers / source-count footer metadata. Restored the
    + MultiView event action using the existing eastcoinMultiviewV1 four-slot
    storage format so V2 event cards can feed the current MultiView experience.
</p>
</article>
`;

const mainEnd = html.lastIndexOf("</main>");
const timelineEnd =
  mainEnd >= 0
    ? html.lastIndexOf("</section>", mainEnd)
    : -1;

if (timelineEnd < 0) throw new Error("Could not find changelog timeline section.");

html =
  html.slice(0, timelineEnd) +
  entry +
  html.slice(timelineEnd);

let updated = false;

html = html.replace(
  /<div class="release-count">(\d+) major update groups<\/div>/,
  (_, n) => {
    updated = true;
    return `<div class="release-count">${Number(n) + 1} major update groups</div>`;
  }
);

if (!updated) throw new Error("Could not update changelog release count.");

fs.writeFileSync(changelogPath, html, "utf8");
console.log("Updated: changelog.html");
console.log("EastCoin V2 Iteration 11 changelog patch complete.");
