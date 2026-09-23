/* Render every profile tab in Node against a fake DOM, so a missing helper cannot reach production again.
   It does not check how anything LOOKS — only that each panel builds without throwing, which is the failure
   that took the character picture and the tab buttons down with it on 2026-09-23.

   The stub is deliberately faithful in two places: addEventListener REMEMBERS the handler (so the test can
   click the tabs the way a player does), and querySelectorAll(".pr-tabs button") returns buttons carrying
   dataset.t, which is what paint() and the click handler both read. */
import * as G from "file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-shared.js";

const TABS = ["overview", "gear", "casino", "totals"];
let tabButtons = [];

function mkEl(tag = "div") {
  const el = {
    tag, _html: "", id: "", className: "", hidden: false, style: {}, dataset: {}, textContent: "",
    handlers: {},
    set innerHTML(v) { this._html = String(v); },
    get innerHTML() { return this._html; },
    append() {}, setAttribute() {}, getAttribute() { return null; },
    addEventListener(ev, fn) { (this.handlers[ev] ||= []).push(fn); },
    querySelector(sel) { return sel === ".pr-panel" ? panelBox : mkEl(); },
    querySelectorAll(sel) {
      if (sel === ".pr-tabs button") return tabButtons;
      return [];
    },
  };
  el.parentElement = { append() {} };
  return el;
}

const panelBox = mkEl();
tabButtons = TABS.map((t) => { const b = mkEl("button"); b.dataset.t = t; return b; });

globalThis.document = { getElementById: () => mkEl(), createElement: (t) => mkEl(t), head: { append() {} } };

const { createProfile } = await import("file:///C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-profile.js");
const P = createProfile({
  G, SFX: { play() {} }, send() {}, esc: (x) => String(x), $: () => mkEl(),
  sico: () => "<img>", ico: (k) => `<img alt="${k}">`,
  you: () => ({ name: "me" }), nearby: () => null, sprite: () => null,
});

const full = {
  type: "profile", name: "BootyPaper", online: true, look: null, van: null, cos: { title: "Professional Degen" },
  vip: 2, combat: 35, total: 233,
  skills: Object.fromEntries(Object.keys(G.SKILLS).map((k) => [k, { lvl: 30, xp: 100000 }])),
  kills: 1234, quests: 3, crypt: 2, deaths: 7, earned: 500000, mins: 900, since: Date.now() - 9e8,
  eq: { helm: "emerald_helm", weapon: "emerald_sword", body: "emerald_body", legs: "emerald_legs" },
  forge: { emerald_sword: 2 },
  bonus: { acc: 40, str: 30, def: 55 },
  casino: { staked: 455000, plays: 12, net: -3400, best: 900, worst: -2000, byGame: [["wheel", 7], ["hilo", 5]] },
  totals: { xp: 1250000, kills: [["goat", 300], ["ghoul", 120]], gathered: [["logs", 900], ["emerald_ore", 400]],
    cooked: [["ctrout", 200]], crafted: [["emerald_bar", 50]], looted: 2200, burnt: 60, pvpKills: 2, pvpDeaths: 1, sessions: 88 },
};
// what a brand-new player's profile looks like: none of the new blocks at all
const bare = {
  type: "profile", name: "Nobody", online: false, combat: 3, total: 9,
  skills: Object.fromEntries(Object.keys(G.SKILLS).map((k) => [k, { lvl: 1, xp: 0 }])),
  kills: 0, quests: 0, crypt: 0, deaths: 0, earned: 0, mins: 0, since: 0,
};

let bad = 0;
for (const [label, payload] of [["full", full], ["bare", bare]]) {
  P.open(payload.name);
  P.on({ ...payload });
  for (const b of tabButtons) {
    panelBox._html = "";
    for (const fn of b.handlers.click || []) fn();
    const html = panelBox._html;
    const ok = html && !html.includes("could not be drawn");
    if (!ok) bad++;
    console.log(`  ${label.padEnd(5)} ${b.dataset.t.padEnd(9)} ${ok ? "drew " + html.length + " chars" : "FAILED: " + (html || "(empty)")}`);
  }
}
console.log(bad ? `\n${bad} panel(s) failed` : "\nevery panel drew, on a full profile and on a brand-new one");
process.exitCode = bad ? 1 : 0;
