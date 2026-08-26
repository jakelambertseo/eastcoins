const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");

if (!fs.existsSync(changelogPath)) {
  throw new Error("Missing changelog.html");
}

const title = "EastCoin V2 frontend modularized";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: V2 modularization changelog entry already exists.");
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
    Reorganized the isolated EastCoin V2 staging frontend into small,
    responsibility-based CSS and JavaScript modules without intentionally
    redesigning the Iteration 2 experience. Global tokens, shell/navigation,
    homepage content, overlays and responsive styles now live independently,
    while shared utilities, event browsing, player/chat behavior, external
    integrations and page startup are separated into dedicated scripts. Future
    V2 iterations can now replace only the files owned by the requested scope
    instead of regenerating the full frontend on routine design changes.
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
console.log("EastCoin V2 modularization changelog patch complete.");
