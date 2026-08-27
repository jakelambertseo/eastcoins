const fs = require("fs");
const path = require("path");

const changelogPath = path.join(process.cwd(), "changelog.html");
if (!fs.existsSync(changelogPath)) throw new Error("Missing changelog.html");

const title = "EastCoin V2 featured home shell removed";
let html = fs.readFileSync(changelogPath, "utf8");

if (html.includes(`<h2>${title}</h2>`)) {
  console.log("No change: Iteration 7 changelog entry already exists.");
  process.exit(0);
}

html = html.replace('<article class="timeline-entry latest">','<article class="timeline-entry">');
html = html.replace(/\s*<span class="latest-badge">Latest<\/span>/, "");

const entry = `
<article class="timeline-entry latest">
<div class="timeline-date"><time datetime="2026-08-26">August 26, 2026</time><span class="latest-badge">Latest</span></div>
<h2>${title}</h2>
<p>
    Removed the old V2 featured landing shell content from the main view, including
    the “What are we watching?” event header, featured event block, upcoming events
    rail, provider-connected status message, and related home-page controls shown in
    the previous screenshot. EastCoin V2 now opens directly into the Events view by default.
</p>
</article>
`;

const mainEnd = html.lastIndexOf("</main>");
const timelineEnd = mainEnd >= 0 ? html.lastIndexOf("</section>", mainEnd) : -1;
if (timelineEnd < 0) throw new Error("Could not find changelog timeline section.");

html = html.slice(0, timelineEnd) + entry + html.slice(timelineEnd);

let updated = false;
html = html.replace(/<div class="release-count">(\d+) major update groups<\/div>/, (_, n) => {
  updated = true;
  return `<div class="release-count">${Number(n)+1} major update groups</div>`;
});

if (!updated) throw new Error("Could not update changelog release count.");

fs.writeFileSync(changelogPath, html, "utf8");
console.log("Updated: changelog.html");
console.log("EastCoin V2 Iteration 7 changelog patch complete.");
