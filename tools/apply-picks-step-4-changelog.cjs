const fs = require("fs");
const path = require("path");

const root = process.cwd();
const changelogPath = path.join(root, "changelog.html");

function readRequired(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }

  return fs.readFileSync(file, "utf8");
}

function patchChangelog(source) {
  const title = "EastCoin Picks backend database foundation added";

  if (source.includes(`<h2>${title}</h2>`)) {
    console.log("Changelog entry already exists.");
    return source;
  }

  let next = source;

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
    Added the server-side EastCoin Picks database foundation on Cloudflare:
    Pages Functions now connect to the production D1 database through the
    <code>PICKS_DB</code> binding, and the first versioned migration defines
    durable users, secure session records, seasons, winner-only markets, Picks
    tickets, idempotent ZCoin wallet-operation journaling, admin settlement
    audit history, and Picks-profit season statistics. Added database and schema
    health checks so backend readiness can be verified before Twitch login or
    real ZCoin wagering is enabled.
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

  let countUpdated = false;

  next = next.replace(
    /<div class="release-count">(\d+) major update groups<\/div>/,
    (_, count) => {
      countUpdated = true;
      return `<div class="release-count">${Number(count) + 1} major update groups</div>`;
    }
  );

  if (!countUpdated) {
    throw new Error(
      "Could not update the changelog release count."
    );
  }

  return next;
}

const before = readRequired(changelogPath);
const after = patchChangelog(before);

if (before === after) {
  console.log("No changelog changes needed.");
} else {
  fs.writeFileSync(changelogPath, after, "utf8");
  console.log("Updated: changelog.html");
}

console.log("EastCoin Picks Step 4 changelog patch complete.");
