/* Render EVERY hiscore board in Node against a fake DOM.

   WHY IT EXISTS. On 2026-09-23 the ticket <img> was hoisted into a shared TIX_ICO and the old local `tixImg`
   was deleted — but one use of it was a bare identifier inside a template expression rather than `${tixImg}`,
   so the search-and-replace missed it and the declaration went anyway. The page still PARSED, because an
   undefined global is a runtime error and not a syntax one, and it shipped. Two boards out of nineteen
   ("Tickets earned" and "Wagered") are the only ones that reach that branch, so nothing else showed it.

   esbuild cannot catch that and neither can a reader. Running the function can, and it takes a second: every
   board, rendered, with a row that has a name, a rank, a value and a sub-line. It is the same trick as
   eastscape-profile-test.mjs and eastscape-achui-test.mjs, for the same reason — lift the real function out of
   the page rather than keep a copy here that can drift from it.

   Run: node tools/eastscape-hiscores-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";

const page = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
const from = page.indexOf("function renderHs() {");
const to = page.indexOf("\n}", page.indexOf('querySelectorAll("[data-who]")', from)) + 2;
if (from < 0 || to < 2) throw new Error("renderHs not found in the page");
const src = page.slice(from, to);

const els = {};
const $ = (id) => (els[id] ||= { id, _html: "", textContent: "",
  set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; },
  querySelectorAll: () => [] });
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const TIX_ICO = '<img src="/v3/assets/img/glad/flat/items/tickets.png?v=1" alt="" class="tixi">';
const SFX = { play() {} };
const openProfile = () => {};
const you = { name: "bootypaper" };

/* one plausible row per board, plus the viewer's own, so the "me" branch and the medal branch both run */
const rowsFor = () => [
  { rank: 1, name: "Kellzifer", v: 66, sub: "524,192 xp" },
  { rank: 2, name: "AndyReidisaPAWG", v: 61, sub: "313,872 xp" },
  { rank: 3, name: "BeeEzRadio", v: 61, sub: "324,632 xp" },
  { rank: 4, name: "bootypaper", v: 35, sub: "24,275 xp" },
  { rank: 5, name: "A + B", v: 930, sub: "" },                     // a crypt row is two names
];
const hsData = { players: 20, boards: Object.fromEntries(G.HISCORES.map(([k]) => [k, rowsFor()])) };

let bad = 0;
for (const [k, label] of G.HISCORES) {
  for (const id of Object.keys(els)) delete els[id];
  let html = "";
  try {
    const fn = new Function("hsData", "hsTab", "G", "you", "esc", "TIX_ICO", "SFX", "$", "openProfile",
      `${src}; renderHs(); return { body: $("hsBody").innerHTML, sub: $("hsSub").textContent, tabs: $("hsTabs").innerHTML };`);
    const out = fn(hsData, k, G, you, esc, TIX_ICO, SFX, $, openProfile);
    html = out.body;
    const checks = [
      ["rows rendered", (html.match(/class="hsr/g) || []).length === 5],
      ["your row marked", html.includes('class="hsr me"')],
      ["medals on the top three", html.includes("\u{1F947}") && html.includes("\u{1F949}")],
      ["every board listed in the rail", (out.tabs.match(/data-hs=/g) || []).length === G.HISCORES.length],
      ["one tab selected", (out.tabs.match(/aria-selected="true"/g) || []).length === 1],
    ];
    const failed = checks.filter(([, ok]) => !ok).map(([w]) => w);
    if (failed.length) { console.log(`  ${label.padEnd(18)} FAIL: ${failed.join(", ")}`); bad++; }
    else console.log(`  ${label.padEnd(18)} ok   ${String(html.length).padStart(5)} chars${k === "tix" || /tix/.test(k) ? "" : ""}`);
  } catch (e) {
    console.log(`  ${label.padEnd(18)} THREW ${e.message}`);
    bad++;
  }
}

// the empty board must say so rather than throwing
try {
  for (const id of Object.keys(els)) delete els[id];
  const fn = new Function("hsData", "hsTab", "G", "you", "esc", "TIX_ICO", "SFX", "$", "openProfile",
    `${src}; renderHs(); return $("hsBody").innerHTML;`);
  const html = fn({ players: 0, boards: {} }, G.HISCORES[0][0], G, you, esc, TIX_ICO, SFX, $, openProfile);
  if (!/Nobody/.test(html)) { console.log("  !! an empty board does not say it is empty"); bad++; }
  else console.log("\n  an empty board says so");
} catch (e) { console.log("  !! an empty board THREW " + e.message); bad++; }

console.log(bad ? `\n${bad} problem(s)` : `\nall ${G.HISCORES.length} boards render`);
process.exitCode = bad ? 1 : 0;
