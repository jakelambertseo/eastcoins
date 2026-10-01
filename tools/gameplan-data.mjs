/* THE RELEASE BOARD'S DATA (2026-10-01, the owner: "go ahead with 1, 2, 3, and 5" — 3 being a release board: what's live, what's built and
   held on dev, what's in progress, what's next). Writes tools/release-mock/release.json from things that already exist, so the board can't
   drift from the game:
     - LIVE:    the rules VERSION in the Desktop deploy repo (what was last shipped);
     - DEV:     the rules VERSION in this repo, and the "was N:" history chained onto that same line, which is a changelog with dates;
     - HELD:    tools/release-mock/held.json, kept by hand from the memory note on the next batch (each item: what, commit, what shipping needs);
     - PUBLIC:  G.ROADMAP's lanes with their titles from ROADMAP_WORDS, i.e. what players are told on The Road Ahead;
     - PLAN:    the phases from tools/gameplan-mock/index.html (the PH array), so phase 0 and 1 show with their done marks.
   Run by tools/gameplan-build.mjs on every build. Read-only everywhere except release.json. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEPLOY = "C:/Users/jake/OneDrive/Desktop/eastcoins";
const SHARED = "v3/assets/js/eastscape-shared.js";

/* a JS literal starting at `from`, bracket-matched with strings respected */
function literalAt(src, from) {
  let i = src.indexOf("[", from), depth = 0, q = null;
  const start = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === "\\") { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") { depth--; if (!depth) return src.slice(start, i + 1); }
  }
  throw new Error("unbalanced literal");
}

export function buildRelease() {
  const dev = readFileSync(join(ROOT, SHARED), "utf8");
  const vLine = dev.split("\n").find((l) => l.startsWith("export const VERSION"));
  const devV = +vLine.match(/VERSION = (\d+)/)[1];
  /* the chain: "VERSION = 387; /* (date) text * /  /* was 386: * / /* (date) text * / ..." */
  const history = [];
  const first = vLine.match(/VERSION = (\d+);\s*\/\*\s*\((\d{4}-\d{2}-\d{2})\)\s*([^*]*?)\s*\*\//);
  if (first) history.push({ v: +first[1], date: first[2], text: first[3] });
  for (const m of vLine.matchAll(/was (\d+): \*\/\s*\/\*\s*\((\d{4}-\d{2}-\d{2})\)\s*([^*]*?)\s*\*\//g)) history.push({ v: +m[1], date: m[2], text: m[3] });
  let liveV = null;
  try { liveV = +readFileSync(join(DEPLOY, SHARED), "utf8").match(/VERSION\s*=\s*(\d+)/)[1]; } catch { /* the deploy repo isn't on this machine */ }
  const heldPath = join(ROOT, "tools/release-mock/held.json");
  const held = existsSync(heldPath) ? JSON.parse(readFileSync(heldPath, "utf8")) : [];
  /* The Road Ahead: lanes and the words players see */
  const cardsSrc = literalAt(dev, dev.indexOf("cards: [", dev.indexOf("export const ROADMAP = {")));
  const cards = new Function(`return ${cardsSrc}`)();
  const wiki = readFileSync(join(ROOT, "v3/assets/js/eastscape-wiki.js"), "utf8");
  const words = {};
  const wStart = wiki.indexOf("export const ROADMAP_WORDS = {");
  for (const m of wiki.slice(wStart, wStart + 20000).matchAll(/^\s+([a-z0-9_]+): \{ title: "([^"]+)", text: "([^"]+)"/gm)) words[m[1]] = { title: m[2], text: m[3] };
  const roadmap = cards.map((c) => ({ ...c, ...(words[c.id] || { title: c.id, text: "" }) }));
  /* the plan's phases */
  const plan = readFileSync(join(ROOT, "tools/gameplan-mock/index.html"), "utf8");
  const PH = new Function(`return ${literalAt(plan, plan.indexOf("const PH = ["))}`)();
  const phases = PH.map(([id, title, when, why, items]) => ({ id, title, when, why, items: items.map(([n, d, e]) => ({ name: n.replace(/^[✓✗] /, ""), done: n.startsWith("✓"), dropped: n.startsWith("✗"), detail: d, effort: e })) }));
  return { builtAt: new Date().toISOString(), live: liveV, dev: devV, history: history.slice(0, 40), held, roadmap, phases };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const r = buildRelease();
  writeFileSync(join(ROOT, "tools/release-mock/release.json"), JSON.stringify(r));
  console.log(`release.json: live ${r.live}, dev ${r.dev}, ${r.history.length} versions, ${r.held.length} held, ${r.roadmap.length} roadmap cards, ${r.phases.length} phases`);
}
