const fs = require("fs");
const path = require("path");

const root = process.cwd();
const gitignorePath = path.join(root, ".gitignore");
const changelogPath = path.join(root, "changelog.html");

function readRequired(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

function updateGitignore(source) {
  const required = [
    ".dev.vars*",
    ".env*"
  ];

  const lines = source
    .replace(/\r\n/g, "\n")
    .split("\n");

  let changed = false;

  for (const entry of required) {
    if (!lines.includes(entry)) {
      lines.push(entry);
      changed = true;
    }
  }

  if (!changed) {
    return source;
  }

  return lines
    .filter((line, index, arr) => {
      // Preserve one trailing blank line only.
      if (line !== "") return true;
      return index === arr.length - 1;
    })
    .join("\n")
    .replace(/\n*$/, "\n");
}

function patchChangelog(source) {
  const title = "Twitch application configuration added for Picks";

  if (source.includes(`<h2>${title}</h2>`)) {
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
    Prepared EastCoin Picks for real Twitch account authentication by
    registering the production OAuth callback contract and adding server-side
    configuration checks for the Twitch Client ID, encrypted Client Secret, and
    redirect URI. Added repository protections for local environment-secret
    files so Twitch credentials cannot be accidentally committed. Real OAuth
    login and EastCoin session creation remain disabled until the next backend
    phase.
  </p>
</article>
`;

  const mainEnd = next.lastIndexOf("</main>");
  const timelineEnd =
    mainEnd >= 0
      ? next.lastIndexOf("</section>", mainEnd)
      : -1;

  if (timelineEnd < 0) {
    throw new Error("Could not find the end of the changelog timeline.");
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
    throw new Error("Could not update the changelog release count.");
  }

  return next;
}

const gitignoreBefore = readRequired(gitignorePath);
const gitignoreAfter = updateGitignore(gitignoreBefore);

if (gitignoreAfter !== gitignoreBefore) {
  fs.writeFileSync(gitignorePath, gitignoreAfter, "utf8");
  console.log("Updated: .gitignore");
} else {
  console.log("No change: .gitignore already protects local secret files.");
}

const changelogBefore = readRequired(changelogPath);
const changelogAfter = patchChangelog(changelogBefore);

if (changelogAfter !== changelogBefore) {
  fs.writeFileSync(changelogPath, changelogAfter, "utf8");
  console.log("Updated: changelog.html");
} else {
  console.log("No change: Step 5 changelog entry already exists.");
}

console.log("EastCoin Picks Step 5 repository safety/changelog patch complete.");
