/* THE GAME PLAN SITE (2026-10-01, the owner: "add all of these mockups to a page at play.eastcoin.vip/gameplan with a nav so i can keep it
   bookmarked"). Copies the long-game mockups (tools/*-mock, local only and never committed) into eastscape-worker/gameplan-site/gameplan/,
   which the game server serves behind its own key (PLAN_KEY: see the /gameplan route in eastscape-worker/src/index.js).

   Two things change on the way:
     - every "/v3/assets/" becomes "https://eastcoin.vip/v3/assets/": the game's art lives on the site, not on play.eastcoin.vip;
     - every page gets the same nav bar at the top, the current page lit, so the whole set is one bookmark.

   Run:  node tools/gameplan-build.mjs   then deploy the worker (cd eastscape-worker && npx wrangler deploy).
   The output folder is ignored by git; rebuild after editing any mockup. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "eastscape-worker", "gameplan-site", "gameplan");
/* the pages, in the nav's order: [folder, short label, title] */
const PAGES = [
  ["gameplan-mock", "Plan", "The game plan"],
  ["atlas-mock", "Atlas", "The atlas: maps and skilling to 120"],
  ["mapbook-mock", "Maps", "The map book: every map today"],
  ["skillsets-mock", "Sets", "Skilling gear and sets"],
  ["past99-mock", "1", "The Road Past 99"],
  ["ascend-mock", "2", "Ascendancies"],
  ["relic-mock", "3", "Relic gear"],
  ["endgame-mock", "4", "Past 110"],
  ["mythic-mock", "5", "Mythic runs"],
  ["diary-mock", "6", "Area diaries"],
  ["petgrow-mock", "7", "Pets that grow"],
  ["guild-mock", "8", "Guilds"],
  ["stats-mock", "9", "Character stats"],
  ["statsui-mock", "9 in game", "The Character window, in the game"]];
const SUPPORT = ["ui-kit"];   /* folders the pages reach into but that are not pages of their own */
const SKIP = new Set(["inject.js"]);   /* the in-game mock's script runs only inside the dev page */
const TEXT = new Set([".html", ".js", ".css", ".json", ".svg", ".mjs"]);
const SITE = "https://eastcoin.vip";

const nav = (cur) => `<nav id="gpNav" aria-label="The game plan">
<style>#gpNav{position:sticky;top:0;z-index:9999;display:flex;gap:6px;align-items:center;overflow-x:auto;padding:8px 12px;background:#120d08;box-shadow:0 2px 0 #5a3a1a,0 6px 18px rgba(0,0,0,.5);font:800 13px/1 Lora,Georgia,serif;scrollbar-width:thin}
#gpNav b{flex:none;margin-right:6px;font:800 15px Cinzel,Georgia,serif;color:#ffe7b0;letter-spacing:.04em}
#gpNav a{flex:none;display:inline-flex;gap:6px;align-items:center;padding:6px 11px;border-radius:999px;background:#2a1a10;box-shadow:0 0 0 1.5px #5a3a1a;color:#ffd98a;text-decoration:none;white-space:nowrap}
#gpNav a i{font-style:normal;font-weight:600;color:#cdbfa2}
#gpNav a:hover{background:#3a2616}#gpNav a[aria-current="page"]{background:#ffd98a;color:#1a1006;box-shadow:none}#gpNav a[aria-current="page"] i{color:#3a2a10}
#gpNav small{flex:none;margin-left:auto;padding-left:10px;font:700 11.5px Lora,serif;color:#8a7a60}</style>
<b>Game plan</b>${PAGES.map(([f, n, t]) => `<a href="../${f}/"${f === cur ? ' aria-current="page"' : ""} title="${t}">${n}${n === "Plan" ? "" : ` <i>${t.replace(/^The /, "")}</i>`}</a>`).join("")}<small>internal · not linked anywhere</small></nav>`;

const rewrite = (s) => s.replaceAll('"/v3/assets/', `"${SITE}/v3/assets/`).replaceAll("'/v3/assets/", `'${SITE}/v3/assets/`).replaceAll("`/v3/assets/", "`" + SITE + "/v3/assets/").replaceAll("(/v3/assets/", `(${SITE}/v3/assets/`);

function copyDir(src, dst, page) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP.has(name)) continue;
    const a = join(src, name), b = join(dst, name);
    if (statSync(a).isDirectory()) { copyDir(a, b, null); continue; }
    if (!TEXT.has(extname(name).toLowerCase())) { writeFileSync(b, readFileSync(a)); continue; }
    let s = rewrite(readFileSync(a, "utf8"));
    if (page && name === "index.html") s = s.replace(/<body([^>]*)>/i, (m) => `${m}\n${nav(page)}`);
    writeFileSync(b, s);
  }
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
let files = 0, bytes = 0;
for (const [f] of PAGES) { const src = join(ROOT, "tools", f); if (!existsSync(src)) { console.error(`missing: tools/${f}`); process.exit(1); } copyDir(src, join(OUT, f), f); }
for (const f of SUPPORT) copyDir(join(ROOT, "tools", f), join(OUT, f), null);
(function count(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) count(p); else { files++; bytes += statSync(p).size; } } })(OUT);
/* a check that nothing still points at the site's root from play.eastcoin.vip */
const left = [];
(function scan(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) scan(p); else if (TEXT.has(extname(n))) { const s = readFileSync(p, "utf8"); const m = s.match(/["'`(]\/v3\/assets\//); if (m) left.push(p.slice(OUT.length)); } } })(OUT);
console.log(`gameplan-site: ${PAGES.length} pages, ${files} files, ${(bytes / 1024).toFixed(0)} KB${left.length ? `\nSTILL ROOT-RELATIVE: ${left.join(", ")}` : ""}`);
