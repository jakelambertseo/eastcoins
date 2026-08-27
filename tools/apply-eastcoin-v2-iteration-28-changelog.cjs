const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");

if (!fs.existsSync(changelogPath)) {
  throw new Error("Missing changelog.html");
}

const title = "EastCoin V2 category headers now have stronger visual separators";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: Iteration 28 changelog entry already exists.");
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
<time datetime="2026-08-27">August 27, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Updated the V2 event category headers with a stronger EastCoin-style red
    underline treatment so each sport section reads as a clearer visual block.
    The section header now has a subtle bottom divider, a glowing red sweep
    underneath, and a smaller gold-to-red accent beneath the category title.
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

html = html.slice(0, timelineEnd) + entry + html.slice(timelineEnd);

let updated = false;
html = html.replace(
  /<div class="release-count">(\d+) major update groups<\/div>/,
  (_, count) => {
    updated = true;
    return `<div class="release-count">${Number(count) + 1} major update groups</div>`;
  }
);

if (!updated) {
  throw new Error("Could not update changelog release count.");
}

fs.writeFileSync(changelogPath, html, "utf8");

console.log("Updated: changelog.html");
console.log("EastCoin V2 Iteration 28 changelog patch complete.");
