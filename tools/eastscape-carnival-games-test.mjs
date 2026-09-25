/* DO THE MIDWAY GAMES ADD UP? —  node tools/eastscape-carnival-games-test.mjs
   (2026-09-24, the owner: "fun games to play for tickets only ... balloon pop, shooting targets, whack a mole")

   The server module cannot be imported on its own — it installs onto World.prototype — so this lifts the three
   pure functions out of it by hand and runs them. What that buys is the only three things a stall can be wrong
   about, and all three are economic rather than mechanical:

     A BOARD MUST BE THE SAME EVERY TIME. The seed is what makes a replay a replay; if the layout drifted, a
     round would be graded against a board the player never saw.
     A STALL MUST NOT BE A TICKET FARM. Whatever a perfect round pays has to be worse per minute than fighting
     the map outside it, or the games become the reason to come and the monsters become scenery.
     AND IT MUST NOT BE A TAX EITHER. If a good player cannot come out ahead there is no game, only a fee. */
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";
import fs from "node:fs";

const src = fs.readFileSync("C:/Users/jake/code/eastcoins/eastscape-worker/src/carnival.js", "utf8");
const GAMES = JSON.parse(JSON.stringify(eval("(" + src.match(/const GAMES = (\{[\s\S]*?\n  \});/)[1] + ")")));
const hash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const scheduleFor = (key, seed) => { const g = GAMES[key], lanes = g.cols * g.rows, out = [];
  for (let i = 0; i < g.shots; i++) out.push({ i, at: i * g.gapMs, lane: hash(`${seed}:pop:${i}`) % lanes, ms: g.windowMs }); return out; };
const COOLDOWN = Number(src.match(/COOLDOWN_MS = (\d+)/)[1]) / 1000;
const payFor = (key, hits) => { const g = GAMES[key]; return Math.round(g.top * Math.pow(Math.max(0, Math.min(1, hits / g.shots)), 1.5)); };

let bad = 0;
const fail = (m) => { console.log("  !! " + m); bad++; };
const ok = (m) => console.log("  " + m);

for (const [key, g] of Object.entries(GAMES)) {
  /* the same seed lays out the same board, every time */
  const a = JSON.stringify(scheduleFor(key, "abc123")), b = JSON.stringify(scheduleFor(key, "abc123"));
  if (a !== b) fail(`${g.name}: the same seed gives two different boards`);
  if (a === JSON.stringify(scheduleFor(key, "abc124"))) fail(`${g.name}: two different seeds give the same board`);

  /* every lane gets used across a run of seeds, or part of the board is dead */
  const lanes = g.cols * g.rows, seen = new Set();
  for (let s = 0; s < 200; s++) for (const t of scheduleFor(key, `s${s}`)) seen.add(t.lane);
  if (seen.size !== lanes) fail(`${g.name}: only ${seen.size} of ${lanes} lanes ever come up`);

  const len = (g.shots * g.gapMs + g.windowMs) / 1000;
  /* THE CYCLE IS THE ROUND PLUS ITS COOLDOWN, and leaving the cooldown out is what made the first run of this
     test call all three stalls broken. A stall you can only start every twenty seconds pays what it pays over
     twenty-odd seconds, not over the eight the board runs for. */
  const cycle = len + COOLDOWN;
  const perfect = payFor(key, g.shots), even = [...Array(g.shots + 1).keys()].find((h) => payFor(key, h) >= g.cost);
  const perMin = Math.round(((perfect - g.cost) / cycle) * 60);
  console.log(`  ${g.name.padEnd(22)} ${lanes} lanes, ${g.shots} targets, ${len.toFixed(0)}s + ${COOLDOWN}s wait   perfect ${perfect} (net +${perfect - g.cost}), break even ${even}/${g.shots}   = ${perMin}/min flat out`);
  if (perfect <= g.cost) fail(`${g.name}: a perfect round does not even return the stake — that is a fee, not a game`);
  if (even / g.shots < 0.45) fail(`${g.name}: break even at ${even}/${g.shots} is too easy; there is no reason to aim`);
  if (even / g.shots > 0.85) fail(`${g.name}: break even at ${even}/${g.shots} is out of reach`);
  /* against the map it stands on: a Fat Lady is 148 a kill and takes well under a minute at this band */
  if (perMin > 600) fail(`${g.name}: ${perMin}/min at perfect play beats fighting the map — the stall would be the reason to come`);
}
ok("every board is seed-stable, uses all its lanes, and pays a skill gradient that cannot beat the map outside");

/* TICKETS ONLY, BOTH WAYS. Checked by what the module CALLS, not by what it says: the first version of this
   grepped for the word "zcoin" and tripped over the comment explaining that there are none. */
{
  const verbs = [...src.matchAll(/this\.(\w+)\(/g)].map((m) => m[1]);
  const money = verbs.filter((v) => /zcoin|wallet|wager|payout|credit|debit/i.test(v));
  if (money.length) fail(`the midway calls ${[...new Set(money)].join(", ")} — it is tickets only, both ways`);
  else ok("tickets in, tickets out: no wallet or ZCoin call anywhere in the module");
  if (!/takeInv\(c\.inv, "tickets"/.test(src)) fail("nothing takes the stake");
  if (!/this\.tixTo\(pl, pay\)/.test(src)) fail("nothing pays the winnings");
}

console.log(bad ? `\n${bad} problem(s)` : "\nthe midway games add up");
process.exitCode = bad ? 1 : 0;
