/* EastScape: ship the page's files —  node tools/eastscape-ship.mjs [file ...] [--to <deploy repo>] [--dry]

   WHY THIS EXISTS (2026-09-20). The game has no build step: what is written is what is served. The source is commented
   heavily on purpose (every rule says why it is there), and those comments were a QUARTER of what every player downloaded:
   167 KB of first-load code, 43 KB of it notes to ourselves, against a budget of 175. Moving closed content out would have
   saved a few KB; this saves 43 and costs nothing at run time.

   WHAT IT DOES. Copies the game's page files from THIS repo (the source, comments and all) into the deploy repo with the
   comments and spare whitespace removed. That is all: names are NOT shortened (a stack trace from production still reads
   like the source, and full minification only buys another 4 KB). esbuild does it with a real parser, so a `//` inside a
   string, a regex, or the casino module's CSS-in-a-template-string is left exactly as written. The page's one inline
   module and its one stylesheet are done in place.

   WHAT IT DOES NOT TOUCH. The game server (eastscape-worker) is deployed by wrangler from the source, and the tools read
   the source: neither ever sees a shipped file. Site functions do not import these files.

   CHECKS BEFORE ANYTHING IS WRITTEN: every shipped script must parse; the shipped rules file must export exactly what the
   source exports, with the same VERSION, items and bands; the shipped page must still name its script URLs. Any failure
   writes nothing.

   AFTER THIS: a probe that greps the live file must look for the shipped spelling — `VERSION=76`, not `VERSION = 76`. */
import fs from "fs"; import path from "path"; import zlib from "zlib"; import { createRequire } from "module"; import { pathToFileURL } from "url"; import { spawnSync } from "child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const esbuild = createRequire(path.join(ROOT, "package.json"))("esbuild");   // (a dev dependency of this repo: package.json at the root, never deployed)
export const FILES = ["eastscape.html", "v3/assets/js/eastscape-shared.js", "v3/assets/js/eastscape-casino.js", "v3/assets/js/eastscape-wiki.js", "v3/assets/js/eastscape-sfx.js", "v3/assets/js/eastscape-green.js", "v3/assets/js/eastscape-picks.js", "v3/assets/js/eastscape-screen.js", "v3/assets/js/eastscape-decor.js", "v3/assets/js/eastscape-decor-rules.js", "v3/assets/js/eastscape-closed.js", "v3/assets/js/eastscape-crypt.js", "v3/assets/js/eastscape-pyramid.js", "v3/assets/js/eastscape-carnival.js", "v3/assets/js/eastscape-crypt-rules.js", "v3/assets/js/eastscape-pyramid-rules.js", "v3/assets/js/eastscape-tower-rules.js", "v3/assets/js/eastscape-count-rules.js", "v3/assets/js/eastscape-count.js", "v3/assets/js/eastscape-profile.js", "v3/assets/js/eastscape-tip.js", "v3/assets/js/eastscape-pets.js", "v3/assets/js/eastscape-bank.js", "v3/assets/js/eastscape-report.js", "v3/assets/js/eastscape-order.js", "v3/assets/js/eastscape-bag.js", "v3/assets/js/eastscape-collog.js"];   /* (2026-09-27) the collection log's window, lazy */   /* (2026-09-27) the pen and hatchery windows, lazy */
const JS = { loader: "js", format: "esm", minifyWhitespace: true, legalComments: "none", target: "es2022", charset: "utf8" };

/** The shipped text of one source file. */
export async function shipped(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  if (rel.endsWith(".js")) return (await esbuild.transform(src, JS)).code;
  let out = src;
  for (const m of src.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) { const code = (await esbuild.transform(m[1], JS)).code; if (code.includes("</script")) throw new Error("the page's script would close itself"); out = out.replace(m[1], () => "\n" + code); }
  for (const m of src.matchAll(/<style>([\s\S]*?)<\/style>/g)) out = out.replace(m[1], () => esbuild.transformSync(m[1], { loader: "css", minify: true, legalComments: "none", charset: "utf8" }).code);
  return out.replace(/<!--(?!\[)[\s\S]*?-->/g, "");
}

const gzKB = (s) => Math.round(zlib.gzipSync(s).length / 102.4) / 10;
async function check(rel, text) {
  if (rel.endsWith(".js")) await esbuild.transform(text, { loader: "js", format: "esm" });   // it still parses
  else for (const m of text.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) await esbuild.transform(m[1], { loader: "js", format: "esm" });
  if (rel.endsWith("eastscape-shared.js")) {
    const tmp = path.join(ROOT, "tools", `.ship-check-${process.pid}.mjs`); fs.writeFileSync(tmp, text);
    try { const a = await import(pathToFileURL(path.join(ROOT, rel)).href), b = await import(pathToFileURL(tmp).href), ka = Object.keys(a).sort().join(), kb = Object.keys(b).sort().join();
      if (ka !== kb) throw new Error("the shipped rules file exports different names than the source"); if (a.VERSION !== b.VERSION) throw new Error("VERSION differs");
      if (JSON.stringify(Object.keys(a.ITEMS)) !== JSON.stringify(Object.keys(b.ITEMS)) || JSON.stringify(a.BANDS) !== JSON.stringify(b.BANDS)) throw new Error("the shipped rules differ from the source"); }
    finally { fs.rmSync(tmp, { force: true }); }
  }
  if (rel === "eastscape.html") for (const need of ["eastscape-shared.js?v=", "eastscape-casino.js?v=", "eastscape-wiki.js?v=", "eastscape-sfx.js"]) if (!text.includes(need)) throw new Error(`the shipped page no longer names ${need}`);
  /* (2026-09-27) AND DOES IT BOOT: the shipped page is run under happy-dom by tools/eastscape-boot-check.mjs. Parsing is not
     starting - one line that threw at boot left every player at "Connecting…" and passed every check above. */
  if (rel === "eastscape.html") {
    const tmp = path.join(ROOT, "tools", `.ship-boot-${process.pid}.html`); fs.writeFileSync(tmp, text);
    try { const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "eastscape-boot-check.mjs"), tmp], { encoding: "utf8", timeout: 60000 });
      const said = (r.stdout || "").split(String.fromCharCode(10)).filter((l) => /boots|!!|^ {5}/.test(l)).join(String.fromCharCode(10)); console.log(said || (r.stderr || "").slice(-600));
      if (r.status !== 0) throw new Error("the shipped page does not boot (see above)"); }
    finally { fs.rmSync(tmp, { force: true }); }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1"))) {
  const args = process.argv.slice(2), dry = args.includes("--dry"), ti = args.indexOf("--to"), to = ti >= 0 ? args[ti + 1] : "C:/Users/jake/OneDrive/Desktop/eastcoins";
  const want = args.filter((a, i) => !a.startsWith("--") && !(ti >= 0 && i === ti + 1)).map((f) => f.split("\\").join("/")), list = want.length ? want : FILES;
  for (const f of list) if (!FILES.includes(f)) { console.error(`not one of the game's page files: ${f}`); process.exit(1); }
  const out = []; for (const f of list) { const text = await shipped(f); await check(f, text); out.push([f, text]); }
  for (const [f, text] of out) { const src = fs.readFileSync(path.join(ROOT, f), "utf8"); if (!dry) { fs.mkdirSync(path.dirname(path.join(to, f)), { recursive: true }); fs.writeFileSync(path.join(to, f), text); }
    console.log(`  ${dry ? "would ship" : "shipped"}  ${f.padEnd(36)} ${String(gzKB(src)).padStart(6)} -> ${String(gzKB(text)).padStart(6)} KB gzipped`); }
}
