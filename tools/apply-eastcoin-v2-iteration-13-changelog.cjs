const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");
if (!fs.existsSync(changelogPath)) throw new Error("Missing changelog.html");

const title = "EastCoin V2 event cards now link directly into Picks";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: Iteration 13 changelog entry already exists.");
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
    Added a Bet action beside MultiView on pregame V2 event cards. The Bet
    button is omitted once an event is live or its scheduled start time has
    passed. Bet opens the existing Picks workspace without unloading the
    persistent V2 shell/chat, filters Picks to the selected matchup, highlights
    the matching market, and leaves side selection to the user. Removed the
    redundant sport/category footer label because category section headers now
    provide that context.
</p>
</article>
`;

const mainEnd = html.lastIndexOf("</main>");
const timelineEnd =
  mainEnd >= 0
    ? html.lastIndexOf("</section>", mainEnd)
    : -1;

if (timelineEnd < 0) {
  throw new Error("Could not find changelog timeline section.");
}

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

if (!updated) {
  throw new Error("Could not update changelog release count.");
}

fs.writeFileSync(changelogPath, html, "utf8");
console.log("Updated: changelog.html");
console.log("EastCoin V2 Iteration 13 changelog patch complete.");
