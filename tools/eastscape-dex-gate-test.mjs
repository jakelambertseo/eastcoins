/* The Prize Counter's ZCoin handler must always answer.

   A tester reported "Bank ZCoins" hanging on "The Ruby hums…" with no confirmation and no error. The page sets
   its waiting text before it sends and clears it on ANY dex reply, so dexOp is the only thing that can end that
   wait — and it had two ways to return without a word. The one that fired: walking up to Bom sends op:"status",
   which set the 1.5-second cooldown, and a click on Bank inside that window hit a gate that only answered for
   `stake`. Everybody clicks inside 1.5 seconds.

   This reads the handler and insists on the two properties that fix it, because the failure is SILENCE and
   silence is what nobody notices until a player says so.

   Run: node tools/eastscape-dex-gate-test.mjs
*/
import fs from "node:fs";

const src = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/index.js", "utf8");
const from = src.indexOf("  async dexOp(S, pl, m, now) {");
const body = src.slice(from, src.indexOf("\n  }", src.indexOf("} finally { pl.dexBusy = false; }", from)));
let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };

if (from < 0) fail("dexOp not found");

// 1. no bare `return;` may reach the player's waiting screen — only the one for a player who has left
const quiet = [...body.matchAll(/\n\s*(?:if \(([^)]*)\) )?return;/g)].map((m) => (m[1] || "").trim());
const allowed = (cond) => /pl\.left/.test(cond);
for (const cond of quiet) if (!allowed(cond)) fail(`a silent \`return\` on "${cond || "(unconditional)"}" — the page waits for ever on it`);
if (!quiet.length || quiet.every(allowed)) console.log(`  every exit answers the page (${quiet.length} silent return, for a player who has already gone)`);

// 2. a read must not start the cooldown that guards a spend
if (!/if \(op !== "status"\) pl\.lastDex = now;/.test(body)) fail('op:"status" still starts the cooldown, so arriving at Bom blocks the first click');
else console.log("  a status read does not block the action the player came to do");

// 3. the cooldown itself answers
if (!/if \(pl\.dexBusy \|\| now - \(pl\.lastDex \|\| 0\) < \(stake \? 400 : 1500\)\) return fail\(/.test(body)) fail("the cooldown gate does not answer the page");
else console.log("  the cooldown says so instead of going quiet");

console.log(bad ? `\n${bad} problem(s)` : "\nthe Ruby always answers");
process.exitCode = bad ? 1 : 0;
