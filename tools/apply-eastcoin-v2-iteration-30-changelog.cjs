const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");

if (!fs.existsSync(changelogPath)) {
  throw new Error("Missing changelog.html");
}

const title = "EastCoin Picks expands full moneyline feeds for football, baseball, and UFC/MMA";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: Iteration 30 changelog entry already exists.");
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
    Rebuilt V2's betting catalog around full sport-specific h2h moneyline feeds
    for American football, baseball, and MMA. EastCoin now uses the provider's
    quota-free sports and event catalogs to identify the exact league and event,
    then requests the complete moneyline feed only for sport keys represented
    by current EastCoin cards. Previous low-quota adaptive cache guardrails and
    the tiny cross-sport upcoming feed were removed. Moneyline snapshots now use
    a fixed 15-minute shared edge cache, and live/final score snapshots use a
    fixed 5-minute shared cache instead of the previous quota-based cache
    stretching. Bet requires an exact provider event
    and an actual current home/away h2h price, and the Picks market backend
    independently rejects basketball, soccer, hockey, boxing, and other
    unsupported betting sports.
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
console.log("EastCoin V2 Iteration 30 changelog patch complete.");
