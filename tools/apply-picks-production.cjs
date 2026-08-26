const fs = require("fs");
const path = require("path");

const root = process.cwd();
const indexPath = path.join(root, "index.html");
const changelogPath = path.join(root, "changelog.html");

function readRequired(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

function writeIfChanged(file, before, after) {
  if (before === after) {
    console.log(`No change: ${path.basename(file)}`);
    return;
  }

  fs.writeFileSync(file, after, "utf8");
  console.log(`Updated: ${path.basename(file)}`);
}

function patchIndex(source) {
  if (source.includes('href="picks.html"')) {
    return source;
  }

  const watchSection = /(<section class="ec-events-v2-nav-section" aria-label="Watch">)([\s\S]*?)(<\/section>)/;

  const match = source.match(watchSection);

  if (!match) {
    throw new Error(
      "Could not find the current production Watch navigation section in index.html."
    );
  }

  const picksLink = `
      <a class="ec-events-v2-nav-item" href="picks.html" data-nav-tooltip="Picks">
        <span class="ec-events-v2-nav-icon">🎯</span>
        <span class="ec-events-v2-nav-copy"><strong>Picks</strong><small>ZCoin prediction markets</small></span>
        <span class="ec-events-v2-count">NEW</span>
      </a>
`;

  const patchedSection =
    match[1] +
    match[2].replace(/\s*$/, "") +
    "\n" +
    picksLink +
    "    " +
    match[3];

  return source.replace(watchSection, patchedSection);
}

function patchChangelog(source) {
  const title =
    "EastCoin Picks production foundation added";

  if (source.includes(`<h2>${title}</h2>`)) {
    return source;
  }

  let next = source;

  // The previous latest entry remains in the timeline, but loses its badge.
  next = next.replace(
    '<article class="timeline-entry latest">',
    '<article class="timeline-entry">'
  );

  next = next.replace(
    /\s*<span class="latest-badge">Latest<\/span>/,
    ""
  );

  const entry = `
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-25">August 25, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Promoted the clean EastCoin Picks rebuild to the production
    <code>/picks.html</code> route with community ZCoin markets, full team
    branding, the 1 ZCoin minimum / 15% wallet / 50 ZCoin wager limits,
    Twitch-linked account flow, Picks-profit rankings, an auto-scrolling
    leaderboard with Twitch avatars, My Picks, Picks History, and the simplified
    wager slip. The frontend now has a dedicated Picks API layer so the upcoming
    Twitch OAuth, StreamElements wallet, D1 markets, and settlement backend can
    be connected without rebuilding the interface again. Added an unlinked
    Picks settlement console whose real winner, No Action, and Void controls
    remain disabled until server-side Twitch admin authorization is live.
  </p>
</article>
`;

  const mainEnd = next.lastIndexOf("</main>");
  const timelineEnd =
    mainEnd >= 0
      ? next.lastIndexOf("</section>", mainEnd)
      : -1;

  if (timelineEnd < 0) {
    throw new Error(
      "Could not find the end of the changelog timeline."
    );
  }

  next =
    next.slice(0, timelineEnd) +
    entry +
    next.slice(timelineEnd);

  next = next.replace(
    /<div class="release-count">(\d+) major update groups<\/div>/,
    (_, count) =>
      `<div class="release-count">${Number(count) + 1} major update groups</div>`
  );

  return next;
}

const indexBefore = readRequired(indexPath);
const changelogBefore = readRequired(changelogPath);

const indexAfter = patchIndex(indexBefore);
const changelogAfter = patchChangelog(changelogBefore);

writeIfChanged(indexPath, indexBefore, indexAfter);
writeIfChanged(changelogPath, changelogBefore, changelogAfter);

console.log("EastCoin Picks production links/changelog patch complete.");
