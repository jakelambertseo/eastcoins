/* THE GAME PLAN SITE (2026-10-01, the owner: "add all of these mockups to a page at play.eastcoin.vip/gameplan with a nav so i can keep it
   bookmarked"). Copies the long-game mockups (tools/*-mock, committed since 2026-10-01) into eastscape-worker/gameplan-site/gameplan/,
   which the game server serves behind its own key (PLAN_KEY: see the /gameplan route in eastscape-worker/src/index.js).

   Two things change on the way:
     - every "/v3/assets/" becomes "https://eastcoin.vip/v3/assets/": the game's art lives on the site, not on play.eastcoin.vip;
     - every page gets the same side nav (categories, the current page lit), so the whole set is one bookmark.

   Run:  node tools/gameplan-build.mjs   then deploy the worker (cd eastscape-worker && npx wrangler deploy).
   ON THE DEV SERVER: wrangler dev reads the asset list when it starts, so a build that adds ANY new file or folder (a page, a data file)
   needs the dev server restarted before those paths stop 404ing; files it already knew update on their own.
   The output folder is ignored by git; rebuild after editing any mockup. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync, existsSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "eastscape-worker", "gameplan-site", "gameplan");
/* the pages, by category, in the nav's order: [category, [[folder, short label, title], ...]]
   (2026-10-01, the owner: "can we also switch this to a side navigation? scrolling sideway with the top nav is getting to be too much. also add
   categories to the navigation") */
const CATS = [
  ["Start here", [
    ["state-mock", "State of the game", "The state of the game, from the nightly backup"],
    ["release-mock", "Releases", "What's live, what's held, what's next"],
    ["decisions-mock", "Decisions", "Every call the owner has made"],
    ["gameplan-mock", "The plan", "The game plan: phases and gaps"]]],
  ["The world", [
    ["atlas-mock", "Atlas", "The atlas: maps and skilling to 120"],
    ["mapbook-mock", "Map book", "Every map today"],
    ["thrillhill-mock", "Thrill Hill", "Agility's own map, built for v1.1"],
    ["hollow-mock", "The Hollow Harvest", "A third Yard raid: a horror Pumpkin King, the Yard gone dark"],
    ["wild-mock", "The Wilderness", "The Wilderness check"],
    ["events-mock", "World events", "World events"],
    ["raid-mock", "Yard raids", "Yard raids"]]],
  ["Systems & economy", [
    ["sinks-mock", "Ticket sinks", "Ticket sinks"],
    ["sidegames-mock", "Slow side games", "Slow side games: the Pet Derby, the Giant Pumpkin and more"],
    ["thieving-mock", "Thieving & shortcuts", "Thieving out in the world, and Agility shortcuts"],
    ["skillsets-mock", "Skilling sets", "Skilling gear and sets"],
    ["workclothes-mock", "Work clothes", "Work clothes, in the game"],
    ["balance-mock", "Balance", "The balance check"],
    ["tracking-mock", "Tracking", "The stat tracking plan"]]],
  ["The long game", [
    ["past99-mock", "1 · Past 99", "The Road Past 99"],
    ["ascend-mock", "2 · Ascendancies", "Ascendancies and abilities"],
    ["relic-mock", "3 · Relic gear", "Relic gear"],
    ["endgame-mock", "4 · Past 110", "Past 110: four places"],
    ["mythic-mock", "5 · Mythic runs", "Mythic runs"],
    ["diary-mock", "6 · Area diaries", "Area diaries"],
    ["petgrow-mock", "7 · Pets that grow", "Pets that grow"],
    ["guild-mock", "8 · The guild", "Guilds"],
    ["stats-mock", "9 · Character stats", "Character stats"],
    ["statsui-mock", "9 · In the game", "The Character window, in the game"]]],
  ["Look & feel", [
    ["adminpanel-mock", "Admin panel", "The admin panel, reorganised"],
    ["ui-custom-mock", "Your screen", "Your screen, your way"],
    ["ui-kit", "UI kit", "The EastScape UI kit"]]],
  ["Archive", [
    ["agilitymap-mock", "Daredevil Gorge", "The first plan for the agility map (became Thrill Hill)"],
    ["roadmap-mock", "Old roadmap", "The first roadmap mockup"]]]];
const PAGES = CATS.flatMap(([, ps]) => ps);
const SUPPORT = [];   /* folders the pages reach into but that are not pages of their own (the UI kit is a page now) */
const SKIP = new Set(["inject.js", "inject2.js", "history", "find-shortcuts.mjs", "place.mjs", "pockets.mjs", "backways.mjs", "scan.mjs"]);   /* the in-game mocks' scripts run only inside the dev page; the state page's per-day files are folded into history/index.json */
const TEXT = new Set([".html", ".js", ".css", ".json", ".svg", ".mjs"]);
const SITE = "https://eastcoin.vip";

const nav = (cur) => `<aside id="gpNav" aria-label="The game plan">
<style>
#gpNav{position:fixed;top:0;left:0;bottom:0;width:236px;z-index:9999;display:flex;flex-direction:column;background:#120d08;box-shadow:2px 0 0 #5a3a1a,8px 0 24px rgba(0,0,0,.45);font:700 13px/1.25 Lora,Georgia,serif;color:#cdbfa2}
#gpNav>header{padding:14px 14px 10px;border-bottom:1px solid #3a2616}
#gpNav>header b{display:block;font:800 18px Cinzel,Georgia,serif;color:#ffe7b0;letter-spacing:.04em}#gpNav>header small{font:700 11px Lora,serif;color:#8a7a60}
#gpNav .gp-list{flex:1;overflow-y:auto;padding:6px 8px 14px;scrollbar-width:thin}
#gpNav details{margin:4px 0 2px}#gpNav summary{list-style:none;cursor:pointer;padding:8px 8px 4px;font:800 10.5px Lora,serif;letter-spacing:.09em;text-transform:uppercase;color:#a89070;display:flex;justify-content:space-between}
#gpNav summary::-webkit-details-marker{display:none}#gpNav summary::after{content:"▾";color:#5a4a34}#gpNav details:not([open]) summary::after{content:"▸"}
#gpNav a{display:block;padding:6px 10px;margin:1px 0;border-radius:7px;color:#ffd98a;text-decoration:none}
#gpNav a small{display:block;font:600 11px Lora,serif;color:#8a7a60;margin-top:1px}
#gpNav a:hover{background:#2a1a10}#gpNav a[aria-current="page"]{background:#ffd98a;color:#1a1006}#gpNav a[aria-current="page"] small{color:#5a4a20}
#gpNav>footer{padding:8px 14px 12px;border-top:1px solid #3a2616;font:700 10.5px Lora,serif;color:#6a5a44}
#gpBtn{display:none;position:fixed;top:10px;left:10px;z-index:10000;padding:8px 12px;border:0;border-radius:999px;background:#ffd98a;color:#1a1006;font:800 13px Lora,serif;box-shadow:0 4px 14px rgba(0,0,0,.5);cursor:pointer}
@media (min-width:900px){body{padding-left:236px!important}}
@media (max-width:899px){#gpNav{transform:translateX(-100%);transition:transform .2s}#gpNav.open{transform:none}#gpBtn{display:block}}
</style>
<header><b>Game plan</b><small>EastScape · internal · not linked anywhere</small></header>
<div class="gp-list">${CATS.map(([c, ps]) => `<details${ps.some(([f]) => f === cur) || c === "Start here" ? " open" : ""} data-cat="${c}"><summary>${c}</summary>${ps.map(([f, n, t]) => `<a href="../${f}/"${f === cur ? ' aria-current="page"' : ""}>${n}${t && t !== n ? `<small>${t}</small>` : ""}</a>`).join("")}</details>`).join("")}</div>
<footer>built ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</footer>
</aside><button id="gpBtn" type="button" aria-controls="gpNav">☰ Plan</button>
<script>document.addEventListener("error",(e)=>{const i=e.target,P="https://eastcoin.vip/";if(i.tagName!=="IMG"||i.dataset.gpTried)return;const s=i.getAttribute("src")||"";if(s.startsWith(P+"v3/assets/")){i.dataset.gpTried=1;i.src="../local-art/"+s.slice(P.length).split("?")[0];}},true);</script>
<script>(()=>{const n=document.getElementById("gpNav"),b=document.getElementById("gpBtn");b.onclick=()=>n.classList.toggle("open");
let st={};try{st=JSON.parse(localStorage.getItem("gpCats")||"{}")}catch{}
n.querySelectorAll("details").forEach(d=>{const c=d.dataset.cat;if(c in st&&!d.querySelector("[aria-current]"))d.open=st[c];d.addEventListener("toggle",()=>{st[c]=d.open;try{localStorage.setItem("gpCats",JSON.stringify(st))}catch{}})});
n.querySelector("[aria-current]")?.scrollIntoView({block:"nearest"});})();</script>`;

/* ART: an image the live site has is linked from eastcoin.vip; one that exists only in this repo (drawn, not shipped yet: e.g. the Yard
   raid's kraken arm) is copied into the plan under local-art/ and linked relatively, so a page never shows a hole. Only literal paths can be
   checked; ones a script builds at run time go to the site. */
const DEPLOY = "C:/Users/jake/OneDrive/Desktop/eastcoins";
const NAV_W = 236;
const localCopies = new Set();
function rewrite(s, depth) {
  const up = "../".repeat(depth);
  return s.replace(/(["'`(])\/v3\/assets\/([^"'`)\s?]+)(\?[^"'`)\s]*)?/g, (m, q, path, qs = "") => {
    const rel = `v3/assets/${path}`;
    if (!path.includes("${") && !existsSync(join(DEPLOY, rel)) && existsSync(join(ROOT, rel))) { localCopies.add(rel); return `${q}${up}local-art/${rel}${qs}`; }
    return `${q}${SITE}/${rel}${qs}`;
  });
}
/* the side nav takes NAV_W from the window, so every page's width breakpoints move by that much: a page lays out as if its window were
   narrower by the nav's width, which is what it now is */
const shiftMedia = (s) => s.replace(/@media([^{]*?)\((max|min)-width:\s*(\d+)px\)/g, (m, pre, mm, n) => `@media${pre}(${mm}-width:${+n + NAV_W}px)`);

function copyDir(src, dst, page, depth = 1) {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src)) {
    if (SKIP.has(name)) continue;
    const a = join(src, name), b = join(dst, name);
    if (statSync(a).isDirectory()) { copyDir(a, b, null, depth + 1); continue; }
    if (!TEXT.has(extname(name).toLowerCase())) { writeFileSync(b, readFileSync(a)); continue; }
    let s = rewrite(readFileSync(a, "utf8"), depth);
    if (/\.(html|css)$/i.test(name)) s = shiftMedia(s);
    if (page && name === "index.html") s = s.replace(/<body([^>]*)>/i, (m) => `${m}\n${nav(page)}`);
    writeFileSync(b, s);
  }
}

/* the release board's data comes from the repos at build time (tools/gameplan-data.mjs) */
const { buildRelease } = await import("./gameplan-data.mjs");
writeFileSync(join(ROOT, "tools/release-mock/release.json"), JSON.stringify(buildRelease()));

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
let files = 0, bytes = 0;
for (const [f] of PAGES) { const src = join(ROOT, "tools", f); if (!existsSync(src)) { console.error(`missing: tools/${f}`); process.exit(1); } copyDir(src, join(OUT, f), f); }
for (const f of SUPPORT) copyDir(join(ROOT, "tools", f), join(OUT, f), null);
/* every image in this repo that the live site doesn't have yet (75 files, ~65 KB on 1 October): pages that build art paths at run time
   reach them through the nav's fallback, which swaps a missing site image for ../local-art/ */
(function unshipped(dir) { for (const n of readdirSync(join(ROOT, dir))) { const rel = `${dir}/${n}`; if (statSync(join(ROOT, rel)).isDirectory()) unshipped(rel); else if (!existsSync(join(DEPLOY, rel))) localCopies.add(rel); } })("v3/assets/img");
for (const rel of localCopies) { const to = join(OUT, "local-art", rel); mkdirSync(dirname(to), { recursive: true }); writeFileSync(to, readFileSync(join(ROOT, rel))); }
(function count(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) count(p); else { files++; bytes += statSync(p).size; } } })(OUT);
/* a check that nothing still points at the site's root from play.eastcoin.vip */
const left = [];
(function scan(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) scan(p); else if (TEXT.has(extname(n))) { const s = readFileSync(p, "utf8"); const m = s.match(/["'`(]\/v3\/assets\//); if (m) left.push(p.slice(OUT.length)); } } })(OUT);
console.log(`gameplan-site: ${PAGES.length} pages, ${files} files, ${(bytes / 1024).toFixed(0)} KB, ${localCopies.size} unshipped images copied in${left.length ? `\nSTILL ROOT-RELATIVE: ${left.join(", ")}` : ""}`);
