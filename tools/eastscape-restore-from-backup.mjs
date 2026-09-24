#!/usr/bin/env node
/* ============================================================
   Put an EastScape world backup back.

   Download the copy you want from R2 first:

     npx wrangler r2 object get eastcoin-backups/eastscape/world/latest.json.gz \
         --file latest.json.gz --remote

   Then look at it (this reads the file and touches nothing):

     node tools/eastscape-restore-from-backup.mjs latest.json.gz

   Ask the server what it WOULD do — still changes nothing:

     node tools/eastscape-restore-from-backup.mjs latest.json.gz \
         --url https://eastcoin-eastscape.<sub>.workers.dev --key $ESCAPE_KEY

   And only then, actually do it:

     ... --apply                      everything in the backup
     ... --apply --only char:         just the characters
     ... --apply --only char:1234     just one person

   Two things the server enforces, not this script: it refuses to
   restore while anybody is connected (a live character would write
   itself straight back over what you restored), and nothing is
   written without --apply. So the order on a bad day is: announce a
   restart, wait for everyone to drop, then restore.
   ============================================================ */

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const flag = (name) => { const i = argv.indexOf(`--${name}`); return i === -1 ? null : (argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true); };

if (!file) {
  console.error("usage: node tools/eastscape-restore-from-backup.mjs <backup.json.gz> [--url <worker>] [--key <ESCAPE_KEY>] [--only <prefix>] [--apply]");
  process.exit(1);
}

const raw = readFileSync(file);
const text = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
let backup;
try { backup = JSON.parse(text); } catch (e) { console.error("That file is not a backup:", e.message); process.exit(1); }
if (!backup?.data || typeof backup.data !== "object") { console.error("No world in that file (expected a `data` object)."); process.exit(1); }

const keys = Object.keys(backup.data);
const chars = keys.filter((k) => k.startsWith("char:"));
const only = typeof flag("only") === "string" ? flag("only") : "";
const picked = only ? keys.filter((k) => k.startsWith(only)) : keys;

console.log(`\nBackup: ${file}`);
console.log(`  taken      ${backup.takenAt} (by ${backup.by || "?"})`);
console.log(`  rules v${backup.rulesVersion}, save format v${backup.saveVersion}, ${backup.online || 0} online at the time`);
console.log(`  contents   ${keys.length} keys — ${chars.length} characters, ${keys.filter((k) => k.startsWith("who:")).length} name lookups${backup.data.exchange ? ", the Exchange" : ""}`);

// a quick look at the biggest characters, which is usually how you tell the
// backup is the one you meant
const byXp = chars
  .map((k) => ({ k, c: backup.data[k] }))
  .map(({ k, c }) => ({ k, xp: Object.values(c?.xp || {}).reduce((n, v) => n + (Number(v) || 0), 0), saved: c?.saved }))
  .sort((a, b) => b.xp - a.xp).slice(0, 5);
if (byXp.length) {
  console.log("  top by xp:");
  for (const r of byXp) console.log(`    ${r.k.padEnd(28)} ${r.xp.toLocaleString().padStart(12)} xp   last saved ${r.saved ? new Date(r.saved).toISOString() : "never"}`);
}
if (only) console.log(`\n  --only ${only} matches ${picked.length} of them`);

const url = typeof flag("url") === "string" ? flag("url").replace(/\/$/, "") : null;
const key = typeof flag("key") === "string" ? flag("key") : process.env.ESCAPE_KEY;
const apply = flag("apply") === true;

if (!url) {
  console.log(`\nNothing sent — pass --url and --key to talk to the game server.\n`);
  process.exit(0);
}
if (!key) { console.error("\nNo key. Pass --key or set ESCAPE_KEY.\n"); process.exit(1); }
if (!picked.length) { console.error(`\nNothing in the backup starts with "${only}".\n`); process.exit(1); }

const qs = new URLSearchParams();
if (only) qs.set("only", only);
if (apply) qs.set("apply", "yes");

console.log(`\n${apply ? "RESTORING" : "Dry run"} → ${url}/restore?${qs}\n`);
const res = await fetch(`${url}/restore?${qs}`, {
  method: "POST",
  headers: { "X-Escape-Key": key, "content-type": "application/json" },
  body: JSON.stringify({ takenAt: backup.takenAt, data: backup.data })
});
const out = await res.json().catch(() => ({ ok: false, code: "BAD_RESPONSE", status: res.status }));
console.log(JSON.stringify(out, null, 2));

if (!out.ok) {
  if (out.code === "PLAYERS_ONLINE") console.log(`\nAnnounce a restart first:\n  curl -X POST -H "X-Escape-Key: $ESCAPE_KEY" "${url}/restart?in=120"\n`);
  process.exit(1);
}
if (out.dryRun) console.log(`\nNothing was written. Add --apply to do it for real.\n`);
else console.log(`\nRestored ${out.restored} keys.\n`);
