/* THE CSS CLEANUP PASS (2026-09-28, the owner: "do the cleanup pass")
   node tools/eastscape-css-clean.mjs            report what can go
   node tools/eastscape-css-clean.mjs --apply    remove it from eastscape.html

   The page's one stylesheet grew by layering: a window's first look, then an "on parchment" pass, then the UI kit on top, each later rule
   winning by coming later. Two kinds of dead weight are removed, and only these two, because both are provably invisible:
   1. OVERRIDDEN DECLARATIONS. A property in a rule whose EXACT selector (same text, same @media) appears again later setting the same
      property: the later one always wins (same specificity, later in the sheet), so the earlier value is never used. Only an exact property
      name counts (a later `border` is not taken to kill an earlier `border-color`), an !important earlier one is kept unless the later one
      is !important too, and repeats INSIDE one rule are left alone (those are deliberate fallbacks, e.g. vh then dvh).
   2. RULES FOR CLASSES NOTHING USES. A rule whose every selector names a class that appears nowhere in the page's markup or script, nor in
      any eastscape module, nor as a prefix that script builds (`b-${...}`). Conservative on purpose: one doubt keeps the rule.
   Rules left with no declarations are dropped. @keyframes and @font-face are never touched. Proof it changed nothing: the computed-style
   fingerprint (tools/eastscape-style-print) taken before and after must match. */
import fs from "node:fs";
const APPLY = process.argv.includes("--apply");
const file = "eastscape.html", src = fs.readFileSync(file, "utf8");
const m = src.match(/<style>([\s\S]*?)<\/style>/); if (!m) throw new Error("no <style>");
const cssStart = m.index + "<style>".length, css = m[1];

// ---------- a small CSS walker: rules with their @media context, declarations with their byte ranges
const rules = [];   // { sel, ctx, start, end (the whole rule), bodyStart, bodyEnd, decls:[{prop, value, imp, start, end}] }
function walk(text, base, ctx) {
  let i = 0;
  const skipWs = () => { for (;;) { while (i < text.length && /\s/.test(text[i])) i++; if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 2; } else break; } };
  while (i < text.length) {
    skipWs(); if (i >= text.length) break;
    const start = i;
    // the prelude up to { or ;
    let depthP = 0, q = null;
    while (i < text.length) { const c = text[i]; if (q) { if (c === "\\") i++; else if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === "(") depthP++; else if (c === ")") depthP--; else if (!depthP && (c === "{" || c === ";" || c === "}")) break; else if (text.startsWith("/*", i)) { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 1; } i++; }
    const prelude = text.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, "").trim();
    if (text[i] === ";") { i++; continue; }            // @import, @charset
    if (text[i] === "}") { i++; continue; }            // stray
    // find the matching brace
    const open = i; let d = 0, j = i; q = null;
    for (; j < text.length; j++) { const c = text[j]; if (q) { if (c === "\\") j++; else if (c === q) q = null; continue; } if (c === '"' || c === "'") { q = c; continue; } if (text.startsWith("/*", j)) { const e = text.indexOf("*/", j + 2); j = e < 0 ? text.length : e + 1; continue; } if (c === "{") d++; else if (c === "}") { d--; if (!d) break; } }
    const body = text.slice(open + 1, j);
    if (/^@(media|supports)/i.test(prelude)) walk(body, base + open + 1, [...ctx, prelude.replace(/\s+/g, " ")]);
    else if (!/^@/.test(prelude)) {
      const decls = []; let k = 0;
      while (k < body.length) {
        while (k < body.length && /[\s;]/.test(body[k])) k++;
        if (body.startsWith("/*", k)) { const e = body.indexOf("*/", k + 2); k = e < 0 ? body.length : e + 2; continue; }
        if (k >= body.length) break;
        const ds = k; let pq = null, pd = 0;
        for (; k < body.length; k++) { const c = body[k]; if (pq) { if (c === "\\") k++; else if (c === pq) pq = null; continue; } if (c === '"' || c === "'") { pq = c; continue; } if (c === "(") pd++; else if (c === ")") pd--; else if (c === ";" && !pd) break; }
        const raw = body.slice(ds, k), colon = raw.indexOf(":");
        if (colon > 0) { const prop = raw.slice(0, colon).trim().toLowerCase(), value = raw.slice(colon + 1).trim(); decls.push({ prop, value, imp: /!important\s*$/i.test(value), start: base + open + 1 + ds, end: base + open + 1 + k + (body[k] === ";" ? 1 : 0) }); }
        k++;
      }
      rules.push({ sel: prelude.replace(/\s+/g, " ").replace(/\s*([>+~,])\s*/g, "$1"), ctx: ctx.join(" | "), start: base + start, end: base + j + 1, bodyStart: base + open + 1, bodyEnd: base + j, decls });
    }
    i = j + 1;
  }
}
walk(css, 0, []);

// ---------- 1. overridden declarations
const dead = new Set();   // decl objects
const byKey = new Map();
rules.forEach((r, ri) => { const k = `${r.ctx}\u0000${r.sel}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(ri); });
for (const list of byKey.values()) {
  if (list.length < 2) continue;
  for (let a = 0; a < list.length; a++) for (const d of rules[list[a]].decls) {
    if (d.prop.startsWith("--")) { /* a custom property is overridden the same way */ }
    for (let b = a + 1; b < list.length; b++) if (rules[list[b]].decls.some((e) => e.prop === d.prop && (!d.imp || e.imp))) { dead.add(d); break; }
  }
}
// ---------- 2. rules for classes nothing uses
/* the server sends class names too (a chat line's cls, a toast's kind), so its source is read with the page's and every module's */
const others = [src.slice(0, cssStart) + src.slice(cssStart + css.length), ...fs.readdirSync("v3/assets/js").filter((f) => /^eastscape-.*\.js$/.test(f)).map((f) => fs.readFileSync(`v3/assets/js/${f}`, "utf8")), fs.readFileSync("eastscape-worker/src/index.js", "utf8")].join("\n");
/* a class the script BUILDS (`b-${id}`, `p${rank}`): any name starting with a prefix written before a ${ counts as used. Loose on purpose */
const built = new Set([...others.matchAll(/([A-Za-z][\w-]*)\$\{/g)].map((x) => x[1]));
/* a prefix of three or more (`b-`, `tc-skin-`, `glow-`) covers every class it starts; a shorter one (`p${rank}`) only covers itself plus digits */
const used = (c) => new RegExp(`(^|[^\\w-])${c.replace(/[-]/g, "\\-")}($|[^\\w-])`).test(others) || [...built].some((p) => c.startsWith(p) && (p.length >= 3 || /[-_]$/.test(p) || /^\d+$/.test(c.slice(p.length))));
const deadRules = new Set();
for (const r of rules) {
  const parts = r.sel.split(",");
  const allDead = parts.every((part) => { const cls = [...part.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((x) => x[1]); return cls.length && cls.some((c) => !used(c)); });
  if (allDead) deadRules.add(r);
}
// ---------- the edits
const cuts = [];
for (const r of rules) {
  if (deadRules.has(r)) { cuts.push([r.start, r.end]); continue; }
  const live = r.decls.filter((d) => !dead.has(d));
  if (!live.length && r.decls.length) { cuts.push([r.start, r.end]); continue; }
  for (const d of r.decls) if (dead.has(d)) cuts.push([d.start, d.end]);
}
cuts.sort((a, b) => b[0] - a[0]);
let out = css; for (const [a, b] of cuts) out = out.slice(0, a) + out.slice(b);
const saved = css.length - out.length;
console.log(`rules ${rules.length} · overridden declarations ${dead.size} · rules for unused classes ${deadRules.size} · ${cuts.length} cuts · ${saved.toLocaleString()} bytes of CSS source`);
if (process.argv.includes("--list")) { for (const r of deadRules) console.log("  unused:", r.sel.slice(0, 110)); }
if (APPLY) { fs.writeFileSync(file, src.slice(0, cssStart) + out + src.slice(cssStart + css.length)); console.log("applied"); }
