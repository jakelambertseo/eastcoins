const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const ROOT = process.cwd();
const toolDir = __dirname;

const targets = [
  "index.html",
  "v2/index.html",
  "v2/assets/js/core.js",
  "v2/assets/js/player.js",
  "v2/assets/js/events.js",
  "v2/assets/js/integrations.js",
  "v2/assets/js/quick-bet.js",
  "v2/assets/js/app.js",
  "v2/assets/js/router.js",
  "v2/assets/js/multiview-handoff.js",
  "v2/assets/js/mlb-gameday.js",
  "v2/assets/css/workspace.css",
  "v2/assets/css/launch.css",
  "assets/eastcoins-multiview.js",
  "assets/eastcoins-picks.js",
  "picks.html",
  "player.html",
  "assets/eastcoins-embedded-view.css",
  "assets/eastcoins-mlb-gameday.js",
  "functions/api/picks/bootstrap.js",
  "functions/api/picks/auth/twitch/start.js",
  "functions/api/picks/auth/twitch/callback.js",
  "changelog.html"
];

const snapshot = new Map();

for (const rel of targets) {
  const p = path.join(ROOT, ...rel.split("/"));
  snapshot.set(rel, fs.existsSync(p) ? fs.readFileSync(p) : null);
}

function restore() {
  console.error("\nRestoring repository files to their pre-Iteration-41 state...");

  for (const [rel, content] of snapshot) {
    const p = path.join(ROOT, ...rel.split("/"));

    if (content === null) {
      if (fs.existsSync(p)) fs.rmSync(p, { force: true });
      continue;
    }

    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }

  console.error("Rollback complete. No Iteration 40/41 partial filesystem state was kept.");
}

function run(script) {
  cp.execFileSync(
    process.execPath,
    [path.join(toolDir, script)],
    {
      cwd: ROOT,
      stdio: "inherit"
    }
  );
}

try {
  console.log("EastCoin Iteration 41 — atomic launch installer\n");
  run("apply-eastcoin-launch-iteration-40.cjs");
  console.log("");
  run("apply-eastcoin-launch-iteration-41.cjs");
  console.log("\nAll launch stages completed successfully.");
} catch (error) {
  restore();
  console.error("\nEastCoin Iteration 41 was not applied.");
  process.exitCode = 1;
}
