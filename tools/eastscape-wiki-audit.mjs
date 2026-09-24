/* EastScape: does the wiki still tell the truth? —  node tools/eastscape-wiki-audit.mjs
   The wiki's guides and its area/monster/item pages are written by hand, and the game has moved under them (the Forum closed,
   tickets pay tickets, the Crypt's chest, cooking came back). This reads eastscape-wiki.js and checks every claim it can check
   against the RULES file: places it names, monsters and items it names, the drops it lists, and a list of phrases that were true
   once and are not now. It is a lint, not a test: a WARN is something for a person to read, not a failure.
   The UPDATES list is history and is skipped on purpose: what it said in July was true in July. */
import * as G from "../v3/assets/js/eastscape-shared.js";
import { createClosedScenes } from "../v3/assets/js/eastscape-closed.js"; Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
import { createCryptRules } from "../v3/assets/js/eastscape-crypt-rules.js"; { const R = createCryptRules(G, G._MAP); Object.assign(G.SCENES, R.scenes); Object.assign(G.MOBS, R.mobs); }
import * as W from "../v3/assets/js/eastscape-wiki.js";
import { readFileSync } from "node:fs";
let bad = 0, warn = 0; const BAD = (what, why) => { bad++; console.log(`  WRONG  ${what}\n         ${why}`); }, WARN = (what, why) => { warn++; console.log(`  check  ${what}\n         ${why}`); };
const strip = (s) => String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/* 1. every guide, read as text */
const guides = (W.GUIDES || W.guides || []).map((g) => ({ id: g.id, title: g.title, text: strip(g.body || "") }));
console.log(`the wiki: ${guides.length} guides, ${(W.UPDATES || []).length} update entries\n`);

/* 2. things that were true once. Each: [what to look for, why it is wrong now] */
const STALE = [
  [/\bthe Forum\b/i, "the Forum closed in v108; Livia, Charon and the Crypt's stairs are in the Yard"],
  [/\bin town\b/i, "there is no town since v108: it is the Yard, by the jukebox"],
  [/Aurelia/i, "Aurelia's bank counter went with the Forum; the bank is the chest in the Yard"],
  [/Brutus/i, "Brutus's forge closed on 2026-09-20: gear is behind the Prize Counter"],
  [/wins? pays? (real )?ZCoins/i, "since v107 a TICKET bet pays TICKETS; only a ZCoin bet pays ZCoins"],
  [/1,?000 tickets = 1 ZCoin.{0,40}bet/i, "betting tickets is no longer the conversion: the Prize Counter trades them"],
  [/\b97%|\babout 97\b/i, "every play is drawn from 96-104% since v107"],
  [/River Bend|the ferry\b/i, "River Bend is closed; Charon works from a cart"],
  [/\bmirror by the TOWN door\b/i, "the casino's doors both say OUTSIDE now"],
  [/stances?\b/i, "stances were removed on 2026-09-19"],
  [/\bhunger|thirst\b/i, "hunger and thirst are switched off"],
  [/High Roller/i, "High Roller was retired on 2026-09-19"],
];
for (const g of guides) for (const [re, why] of STALE) if (re.test(g.text)) WARN(`guide "${g.title}" says ${JSON.stringify((g.text.match(re) || [""])[0])}`, why);

/* 3. names: every place, monster and item the guides mention must still exist */
const scenes = new Set(Object.values(G.SCENES).map((d) => d.name).filter(Boolean)), mobs = new Set(Object.values(G.MOBS).map((m) => m.name)), items = new Set(Object.values(G.ITEMS).map((i) => i.name));
/* OPEN gates DOORS — the check on ob.enter that Vince turns you away from. Your island is not reached through a
   door: Charon's cart takes you there, and the Far Shore is a bridge off the east side of your own island
   (isle3 -> shore). So the island scenes are open in every sense that matters to a player while never appearing
   in OPEN, and flagging the guide for naming them was this lint crying wolf — it cost an afternoon on 2026-09-23
   when the warning was repeated to the owner as fact. */
const ISLANDS = new Set(["isle", "isle2", "isle3", "shore", "home"]);
const open = new Set([...G.OPEN, ...ISLANDS].map((k) => G.SCENES[k]?.name).filter(Boolean));
for (const g of guides) {
  for (const m of g.text.matchAll(/\b(The [A-Z][a-z]+(?: [A-Z][a-z]+)?|[A-Z][a-z]+ [A-Z][a-z]+)\b/g)) { const n = m[1];
    if (scenes.has(n) && !open.has(n)) WARN(`guide "${g.title}" sends you to ${n}`, "that place is closed (not in OPEN)"); }
}
/* 4. the pages the wiki builds from the rules: the drops it would print must be the drops the server rolls */
for (const [t, M] of Object.entries(G.MOBS)) {
  if (M.crypt) continue;
  const rares = G.raresOf(t); const always = (M.drops || []).filter(([, , ch]) => ch == null);
  for (const [k] of [...(M.drops || []), ...(M.rare || [])]) if (!G.ITEMS[k]) BAD(`${M.name} drops "${k}"`, "no such item");
  const sum = rares.reduce((a, [, p]) => a + p, 0);
  if (sum > 1) BAD(`${M.name}'s rare table adds to ${(sum * 100).toFixed(0)}%`, "rollRare walks one roll down the list, so anything past 100% can never come up");
  if (G.BOUNTY[t] && !always.length && !(M.drops || []).length) WARN(`${M.name} drops nothing at all`, "it pays only tickets; check that is meant");
}
/* 5. the numbers a guide quotes, against the rules */
const CLAIMS = [
  [/(\d[\d,]*) tickets? = 1 ZCoin/i, (n) => Number(n.replace(/,/g, "")) === G.DEX.rate, `the rate is ${G.DEX.rate}`],
  [/party of (\d+) to (\d+)/i, (a, b) => Number(a) === 2 && Number(b) === 4, "the Crypt takes 2 to 4"],
  [/(\d+) paid runs? a day/i, (n) => Number(n) === 3, "three paid runs a day"],
  [/bets? are (\d[\d,]*) to (\d[\d,]*)/i, (a, b) => Number(a.replace(/,/g, "")) === G.CASINO.minBet && Number(b.replace(/,/g, "")) === G.CASINO.maxBet, `ticket bets are ${G.CASINO.minBet} to ${G.CASINO.maxBet}`],
];
for (const g of guides) for (const [re, ok, why] of CLAIMS) { const m = g.text.match(re); if (m && !ok(...m.slice(1))) BAD(`guide "${g.title}": ${JSON.stringify(m[0])}`, why); }
/* 6. a guide that points at a wiki page that isn't there */
const html = readFileSync(new URL("../v3/assets/js/eastscape-wiki.js", import.meta.url), "utf8");
for (const m of html.matchAll(/data-wiki="([^"]+)"/g)) { const [kind, name] = m[1].split("/");
  if (kind === "items" && !G.ITEMS[name]) BAD(`a link to items/${name}`, "no such item");
  if (kind === "monsters" && !G.MOBS[name]) BAD(`a link to monsters/${name}`, "no such monster");
  if (kind === "npcs" && !Object.values(G.SCENES).some((d) => (d.npcs || []).some((n) => n.name === name))) BAD(`a link to npcs/${name}`, "nobody of that name is in the world");
  if (kind === "areas" && !G.SCENES[name]) BAD(`a link to areas/${name}`, "no such area"); }
/* ---------------------------------------------------------------- PRICE COLUMNS (2026-09-23)
   Every "Sells" column in the hand-written guides is a VALUE figure typed out by hand, and on 2026-09-23 VALUE
   was halved across the board (TIX_RATE). The prose scan for "N tickets" could not see these, because a table
   cell is a bare number: four tables went stale in one change and nothing complained.

   So the numbers are checked against the rules now. It reads each table with a price header, takes the first
   cell as the thing's name, resolves it through ITEMS, and compares. Anything it cannot resolve is ignored
   rather than guessed at — a row saying "Tree, Old oak" is a place, not an item, and there is no sense in
   inventing a rule for it. */
{
  const byName = new Map();
  for (const [k, it] of Object.entries(G.ITEMS)) if (it?.name) byName.set(it.name.toLowerCase(), k);
  const PRICE_HEAD = /^(sells|worth|value)$/i;
  const src = readFileSync(new URL("../v3/assets/js/eastscape-wiki.js", import.meta.url), "utf8");
  for (const tbl of src.matchAll(/<table class="tbl">([\s\S]*?)<\/table>/g)) {
    const rows = [...tbl[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => r[1]);
    if (!rows.length) continue;
    const heads = [...rows[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((h) => strip(h[1]));
    const col = heads.findIndex((h) => PRICE_HEAD.test(h));
    if (col < 0) continue;
    /* A COOKING TABLE PRICES THE COOKED THING. Its first cell is the raw fish ("Sardine") because that is what
       you catch, but every other column — the level, the burn, the heal, the price — is about what comes off the
       fire. Resolving the name literally made this check disagree with a table that was right about cooked fish
       and wrong only by the halving; `cooked` is why it now compares csardine and not sardine. */
    const cooked = heads.some((h) => /^(cook|smoke) at$/i.test(h));
    for (const r of rows.slice(1)) {
      const cells = [...r.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((c) => strip(c[1]));
      if (cells.length <= col) continue;
      let key = byName.get((cells[0] || "").toLowerCase());
      if (cooked && key && G.VALUE["c" + key] !== undefined) key = "c" + key;
      const said = Number(String(cells[col]).replace(/[^0-9]/g, ""));
      if (!key || !said || G.VALUE[key] === undefined) continue;
      if (G.VALUE[key] !== said) BAD(`the wiki says ${cells[0]} sells for ${said}`, `VALUE says ${G.VALUE[key]}`);
    }
  }
}

console.log(`\n${bad} wrong, ${warn} to read.`);
process.exit(bad ? 1 : 0);
