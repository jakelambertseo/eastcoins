const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");
if (!fs.existsSync(changelogPath)) throw new Error("Missing changelog.html");

const title = "EastCoin V2 event cards rebuilt with live score test";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: Iteration 10 changelog entry already exists.");
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
    Rebuilt the V2 event cards around the cleaner matchup-first visual language
    used by the previous EastCoin events experience while retaining V2's
    four-card desktop grid. Team logos and names now anchor each side of the
    matchup with a central VS or live-score area and a compact action footer.
    Added an experimental live-game enrichment layer that first reads any score
    fields already present in EastCoin event data and can then match live events
    against Kalshi's public sports milestones and batch live-data endpoint.
    Scores are only displayed when a real away/home score pair is returned;
    unavailable scores are never fabricated.
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
console.log("EastCoin V2 Iteration 10 changelog patch complete.");
