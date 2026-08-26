const fs = require("fs");
const path = require("path");

const root = process.cwd();
const changelogPath = path.join(
  root,
  "changelog.html"
);

function readRequired(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing required file: ${file}`
    );
  }

  return fs.readFileSync(
    file,
    "utf8"
  );
}

function patchChangelog(source) {
  const title =
    "Real Twitch login enabled for EastCoin Picks";

  if (
    source.includes(
      `<h2>${title}</h2>`
    )
  ) {
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
<time datetime="2026-08-26">August 26, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Connected the EastCoin Picks account layer to Twitch using the
    server-side OAuth/OIDC authorization-code flow. Users can now authorize
    EastCoinBot on Twitch, return to EastCoin with their stable Twitch user ID,
    current login, display name and Twitch profile image, and receive a secure
    HttpOnly EastCoin session backed by D1. Added CSRF state protection,
    hashed session storage, real logout, authenticated bootstrap data and a
    session-health check. Twitch OAuth tokens are used only to establish
    identity in this phase and are not stored. StreamElements wallet access
    and real ZCoin wagering remain disabled.
  </p>
</article>
`;

  const mainEnd =
    next.lastIndexOf("</main>");

  const timelineEnd =
    mainEnd >= 0
      ? next.lastIndexOf(
          "</section>",
          mainEnd
        )
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

const before =
  readRequired(changelogPath);

const after =
  patchChangelog(before);

if (before === after) {
  console.log(
    "No change: Step 6 changelog entry already exists."
  );
} else {
  fs.writeFileSync(
    changelogPath,
    after,
    "utf8"
  );

  console.log(
    "Updated: changelog.html"
  );
}

console.log(
  "EastCoin Picks Step 6 changelog patch complete."
);
