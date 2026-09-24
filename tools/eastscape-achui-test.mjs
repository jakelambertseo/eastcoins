/* Render the Achievements window in Node against a fake DOM, both tabs, for three characters.
   Same idea as tools/eastscape-profile-test.mjs: it does not check how anything LOOKS, only that the panel
   builds without throwing and that what it builds is what the 2026-09-23 cleanup asked for —

     - no ticket EMOJI anywhere in the markup (the owner: "the ticket emojis need to be the ticket icons"),
     - no tier colour painted onto TEXT (the "weird green text": those five pastels were picked for the dark
       canvas and this window is cream parchment),
     - a medal picture for every tier, and the badge in the header.

   renderAch lives inside the page's one inline module, so the function is lifted out of eastscape.html by name
   and run with stubs. That is uglier than importing it, but the alternative is a copy of the panel in this file
   that can drift from the real one, which is the whole failure this guards against.

   Run: node tools/eastscape-achui-test.mjs
*/
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";

const page = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape.html", "utf8");
const from = page.indexOf("function renderAch() {");
const to = page.indexOf('\n}', page.indexOf('querySelectorAll("[data-at]")', from)) + 2;
if (from < 0 || to < 2) throw new Error("renderAch not found in the page");
const src = page.slice(from, to);

const els = {};
const mk = (id) => (els[id] ||= { id, _html: "", textContent: "", handlers: [],
  set innerHTML(v) { this._html = String(v); }, get innerHTML() { return this._html; },
  querySelectorAll: () => [{ dataset: { at: "rewards" }, addEventListener() {} }] });

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const UIART = "/v3/assets/img/glad/flat/ui/", UIART_V = 1;
const uiArt = (k, cls) => `<img class="${cls || ""}" src="${UIART}${k}.png?v=${UIART_V}" alt="">`;
const TIX_ICO = `<img src="/v3/assets/img/glad/flat/items/tickets.png?v=1" alt="" class="tixi">`;
const tixN = (n) => TIX_ICO + Math.round(n).toLocaleString();
const SFX = { play() {} };

const fresh = () => G.normChar({ name: "Fresh" });
const mid = () => { const c = G.normChar({ name: "Mid" }); for (const k of Object.keys(G.SKILLS)) c.xp[k] = G.XP_AT[30];
  c.stats.kills = { goat: 600 }; c.stats.sessions = 40; c.ach = G.achDue(c); return c; };
const maxed = () => { const c = mid(); for (const k of Object.keys(G.SKILLS)) c.xp[k] = G.XP_AT[85];
  c.stats.kills = Object.fromEntries(Object.keys(G.MOBS).map((k) => [k, 900])); c.ach = G.achDue(c); return c; };

let bad = 0;
for (const [label, ch] of [["fresh", fresh()], ["mid-game", mid()], ["maxed", maxed()]]) {
  for (const tab of ["list", "rewards"]) {
    let me = ch;
    const $ = mk;
    let achTab = tab, html = "";
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function("me", "$", "G", "esc", "uiArt", "tixN", "TIX_ICO", "SFX", "achTab", `${src}; renderAch(); return $("achBody").innerHTML;`);
      html = fn(me, $, G, esc, uiArt, tixN, TIX_ICO, SFX, achTab);
    } catch (e) { console.log(`  ${label}/${tab}: THREW ${e.message}`); bad++; continue; }

    const checks = [
      ["builds something", html.length > 200],
      ["no ticket emoji", !/\u{1F39F}/u.test(html)],
      // a pastel is fine as border-LEFT-color (the row's band); what must not come back is it painting TEXT
      ["no tier colour on text", !/(?<!-)color:#(9ad8a0|7fc8e8|c0a0ff|ffb03a|ff6ad5)/i.test(html)],
      ["the band survives", /border-left-color:#/.test(html)],
      ["uses the ticket picture", html.includes('class="tixi"')],
      ["the header badge", html.includes("ach_badge")],
    ];
    if (tab === "list" || tab === "rewards")
      checks.push(["a medal for every tier", Object.values(G.ACH_TIERS).every((t) => html.includes(t.medal))]);
    const failed = checks.filter(([, ok]) => !ok).map(([w]) => w);
    console.log(`  ${(label + "/" + tab).padEnd(16)} ${String(html.length).padStart(6)} chars  ${failed.length ? "FAIL: " + failed.join(", ") : "ok"}`);
    if (failed.length) bad++;
  }
}

// every medal the rules name must exist as a file
for (const t of Object.values(G.ACH_TIERS)) {
  const f = `v3/assets/img/glad/flat/ui/${t.medal}.png`;
  if (!fs.existsSync(f)) { console.log(`  !! ${t.medal}.png is missing`); bad++; }
}
// the Yard's wheat draws core art, not its own picture: a denser o_wheat was drawn and the owner preferred
// the original, so what has to exist is wheat.png and the three patches that use it
if (!fs.existsSync("v3/assets/img/glad/flat/wheat.png")) { console.log("  !! wheat.png is missing"); bad++; }
{
  const yard = G.SCENES.workyard.build().objs.filter((o) => o.t === "wheat");
  if (yard.length !== 3) { console.log(`  !! the Yard has ${yard.length} wheat patches, expected 3`); bad++; }
  for (const o of yard) if (o.art) { console.log(`  !! wheat at ${o.x},${o.y} overrides its art with ${o.art}`); bad++; }
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe achievements window builds, and says it with pictures");
process.exitCode = bad ? 1 : 0;
