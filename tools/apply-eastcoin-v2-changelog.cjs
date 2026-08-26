const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");

if (!fs.existsSync(changelogPath)) {
  throw new Error("Missing changelog.html");
}

const title = "EastCoin V2 typography pass";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: EastCoin V2 Iteration 2 changelog entry already exists.");
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
    Updated the isolated EastCoin V2 homepage staging experience with a larger,
    more modern typography scale while preserving the Iteration 1 navigation,
    layout, event provider flow, filters, player, chat, Picks integration and
    overall visual structure. Small utility text that previously rendered near
    6–10 pixels now targets roughly 12–14 pixels, with larger interface labels
    and headings scaled proportionally. Event presentation also gained compact
    network/channel metadata and viewer-count support. Viewer totals are never
    fabricated: V2 displays a real provider/event count when present and an
    explicit unavailable state otherwise.
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

let countUpdated = false;
html = html.replace(
  /<div class="release-count">(\d+) major update groups<\/div>/,
  (_, count) => {
    countUpdated = true;
    return `<div class="release-count">${Number(count) + 1} major update groups</div>`;
  }
);

if (!countUpdated) {
  throw new Error("Could not update changelog release count.");
}

fs.writeFileSync(changelogPath, html, "utf8");
console.log("Updated: changelog.html");
console.log("EastCoin V2 Iteration 2 typography changelog patch complete.");
