const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");

if (!fs.existsSync(changelogPath)) {
  throw new Error("Missing changelog.html");
}

const title = "EastCoin V2 Quick Bet adds Lock In Pick review and confirmation flow";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: Iteration 34 changelog entry already exists.");
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
    Reintroduced the V1-style two-step Picks confirmation experience inside V2
    Quick Bet. Users now build a ticket, choose Lock In Pick, and move to a
    dedicated review screen showing the selected team, sportsbook reference
    moneyline, ZCoin stake, projected community-pool multiplier, and estimated
    return. The review screen includes an explicit final confirmation state and
    Edit Pick action. In the current preview environment the final transaction
    remains blocked by the inactive season or disconnected wallet, while the
    complete review UX is testable. A future successful real wager now renders
    a Pick Locked In receipt instead of immediately closing the modal.
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
console.log("EastCoin V2 Iteration 34 changelog patch complete.");
