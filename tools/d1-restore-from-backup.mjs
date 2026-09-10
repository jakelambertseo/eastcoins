#!/usr/bin/env node
/* ============================================================
   Turn a nightly backup back into SQL.

     node tools/d1-restore-from-backup.mjs latest.json.gz > restore.sql
     npx wrangler d1 execute eastcoin-picks --remote \
         --config wrangler.picks-migrations.jsonc --file restore.sql

   Takes the gzipped JSON the backup endpoint writes to R2 (download
   it from the bucket first) and prints INSERT OR REPLACE statements
   for every table, in the order they were dumped. It does not create
   tables — the schema comes from the migrations and the lazily
   created tables the code makes on first use — so run it against a
   database that already has the shape, then the rows land.

   Pass --only picks,markets to restore specific tables.
   ============================================================ */

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const file = process.argv[2];
if (!file) {
  console.error("usage: node tools/d1-restore-from-backup.mjs <backup.json.gz> [--only a,b,c]");
  process.exit(1);
}
const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > -1 ? new Set(String(process.argv[onlyArg + 1] || "").split(",").map((s) => s.trim()).filter(Boolean)) : null;

const raw = readFileSync(file);
const text = file.endsWith(".gz") ? gunzipSync(raw).toString("utf8") : raw.toString("utf8");
const dump = JSON.parse(text);

const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
};
const ident = (s) => `"${String(s).replace(/"/g, '""')}"`;

let statements = 0;
console.log(`-- eastcoin-picks restore from ${file}`);
console.log(`-- taken ${dump.takenAt} by ${dump.by || "?"}`);
for (const [table, rows] of Object.entries(dump.tables || {})) {
  if (only && !only.has(table)) continue;
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]);
  console.log(`\n-- ${table}: ${rows.length} rows`);
  for (const row of rows) {
    console.log(`INSERT OR REPLACE INTO ${ident(table)} (${cols.map(ident).join(", ")}) VALUES (${cols.map((c) => q(row[c])).join(", ")});`);
    statements += 1;
  }
}
console.error(`${statements} statements`);
