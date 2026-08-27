const fs = require("fs");
const path = require("path");

const root = process.cwd();

[
  path.join(root, "v2", "assets", "js", "live-data.js"),
  path.join(root, "functions", "api", "v2", "live-scores.js")
].forEach((file) => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`Removed retired score experiment: ${path.relative(root, file)}`);
  }
});

const changelogPath = path.join(root, "changelog.html");

if (!fs.existsSync(changelogPath)) {
  throw new Error("Missing changelog.html");
}

const title = "EastCoin V2 card odds and sport sections added";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No changelog change: Iteration 12 entry already exists.");
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
    Replaced the unsuccessful V2 live-score card experiment with cached
    consensus moneyline card odds from The Odds API. One shared cross-sport
    upcoming/h2h request feeds matching cards instead of requesting odds per
    event, with automatic longer cache windows as provider quota gets low.
    Reintroduced V1-style sport/category headers with live and total counts,
    preserved the four-card desktop layout within each category, and made the
    entire event card clickable while keeping Save, MultiView and Watch actions
    independently clickable.
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
console.log("EastCoin V2 Iteration 12 install/cleanup complete.");
