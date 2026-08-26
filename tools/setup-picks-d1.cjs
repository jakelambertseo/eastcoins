const { spawnSync } = require("child_process");

const DB_NAME = "eastcoin-picks";
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";
const WRANGLER = ["--yes", "wrangler@latest"];

function run(args, options = {}) {
  return spawnSync(
    NPX,
    [...WRANGLER, ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: options.capture
        ? ["inherit", "pipe", "pipe"]
        : "inherit",
      shell: false
    }
  );
}

function capture(args) {
  return run(args, { capture: true });
}

function parseJsonOutput(result) {
  const outputs = [
    result?.stdout || "",
    `${result?.stdout || ""}\n${result?.stderr || ""}`
  ];

  for (const candidate of outputs) {
    const objectAt = candidate.indexOf("{");
    const arrayAt = candidate.indexOf("[");
    let start = -1;

    if (objectAt >= 0 && arrayAt >= 0) {
      start = Math.min(objectAt, arrayAt);
    } else {
      start = Math.max(objectAt, arrayAt);
    }

    if (start < 0) continue;

    try {
      return JSON.parse(candidate.slice(start).trim());
    } catch {}
  }

  return null;
}

function getDatabaseInfo() {
  const result = capture([
    "d1",
    "info",
    DB_NAME,
    "--json"
  ]);

  if (result.status !== 0) {
    return null;
  }

  const parsed = parseJsonOutput(result);

  if (Array.isArray(parsed)) {
    return parsed[0] || null;
  }

  return parsed;
}

function getDatabaseId(info) {
  return (
    info?.uuid ||
    info?.id ||
    info?.database_id ||
    info?.databaseId ||
    null
  );
}

console.log("");
console.log("=========================================");
console.log(" EastCoin Picks — Step 3 D1 Setup");
console.log("=========================================");
console.log("");
console.log("Using your existing Wrangler login session.");
console.log("No login or authorization flow will be started by this script.");
console.log("");

let info = getDatabaseInfo();

if (info) {
  console.log(`D1 database "${DB_NAME}" already exists.`);
} else {
  console.log(`D1 database "${DB_NAME}" was not found.`);
  console.log(`Creating "${DB_NAME}" now...`);
  console.log("");

  const created = run([
    "d1",
    "create",
    DB_NAME
  ]);

  if (created.status !== 0) {
    console.error("");
    console.error("Could not create the D1 database.");
    console.error("");
    console.error("Your direct Wrangler login should already be valid.");
    console.error("If this command still asks you to login, stop and send the terminal output:");
    console.error("");
    console.error(`  npx wrangler@latest d1 create ${DB_NAME}`);
    console.error("");
    process.exit(created.status || 1);
  }

  info = getDatabaseInfo();

  if (!info) {
    console.error("");
    console.error(
      "The database may have been created, but Wrangler could not read its details."
    );
    console.error("");
    console.error(
      `Run directly: npx wrangler@latest d1 info ${DB_NAME} --json`
    );
    console.error("");
    process.exit(1);
  }
}

const databaseId = getDatabaseId(info);

console.log("");
console.log("D1 DATABASE READY");
console.log("-----------------");
console.log(`Database name: ${DB_NAME}`);
console.log(`Database ID:   ${databaseId || "(see full info below)"}`);
console.log("");

if (!databaseId) {
  console.log("Wrangler database info:");
  console.log(JSON.stringify(info, null, 2));
  console.log("");
}

console.log("NEXT — CLOUDFLARE PAGES BINDING");
console.log("--------------------------------");
console.log("Cloudflare Dashboard");
console.log("  > Workers & Pages");
console.log("  > EastCoin Pages project");
console.log("  > Settings");
console.log("  > Bindings");
console.log("  > Add");
console.log("  > D1 database");
console.log("");
console.log("Variable name: PICKS_DB");
console.log(`D1 database:   ${DB_NAME}`);
console.log("");
console.log(
  "If Cloudflare shows separate Production and Preview bindings, add PICKS_DB to both."
);
console.log("");
console.log(
  "After saving the binding, push the Step 3 files so Cloudflare performs a fresh deployment."
);
console.log("");
console.log(
  "Then test: https://eastcoin.vip/api/picks/db-health"
);
console.log("");
