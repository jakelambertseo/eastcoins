/* MARKED CARDS —  node tools/eastscape-cards-test.mjs
   (2026-09-29) The real World with storage stubbed, opened as on the dev server. The blackjack rules (aces, naturals, Charlies), a hand
   played through every kind of tip, hit and stand, a bust saved by the Ace Up the Sleeve, the Peeking Glass and the Shoe, the prize by
   what it stood on, the name looks (never for sale), tips that fit the player, the collection log's tab, and a save that cannot carry a
   forged hand. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "1" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
const said = []; W.houseSay = (t) => said.push(t);
const c = (r, s = 0) => ({ r, s });

/* 1. the rules */
is([G.handTotal([c(1), c(13)]).t, G.handTotal([c(1), c(1), c(9)]).t, G.handTotal([c(1), c(6), c(10)]).t, G.handTotal([c(10), c(10), c(5)]).t], [21, 21, 17, 25], "aces are 11 until that busts, then 1");
is([G.handResult([c(1), c(12)]), G.handResult([c(7), c(7), c(7)]), G.handResult([c(2), c(3), c(2), c(4), c(5)]), G.handResult([c(2), c(3), c(2), c(4), c(10)]), G.handResult([c(10), c(6)]), G.handResult([c(10), c(8)]), G.handResult([c(10), c(8), c(9)])],
  ["natural", "21", "charlie", "charlie21", "low", "18", "bust"], "natural, 21, a Charlie, a Charlie on 21, under 17, 18, bust");
is([G.handPay("red", "low"), G.handPay("red", "20"), G.handPay("blue", "natural"), G.handPay("black", "charlie21"), G.handPay("red", "bust")], [150, 600, 8000, 30000, 0], "the prize is the tier's base times the result");
is(G.cardTierAt(1) + G.cardTierAt(40) + G.cardTierAt(90), "redblueblack", "the back by the dropper's level");

/* 2. flip a card: one card, one tip that fits */
const S = W.scene("workyard"), pl = { id: "p1", name: "Pip", login: "pip", C: G.freshChar(), x: 31, y: 14, out: [], path: [], admin: true }; pl.C.scene = "workyard"; W.pls.set("p1", pl);
const C = pl.C, tix = () => G.tixIn(C), lastOut = () => pl.out.filter((o) => o.type === "cards").at(-1);
G.addInv(C.inv, "card_red", 3, C);
W.useItem ? null : null;
const use = (k) => { const i = C.inv.findIndex((s) => s.k === k); W.useSpecial(pl, i, C.inv[i], G.ITEMS[k]); };
use("card_red");
is([!!C.hand, C.hand.cards.length, C.hand.state, !!C.hand.tip, G.countItems(C, ["card_red"])], [true, 1, "tip", true, 2], "flipped: one card dealt, a tip, the card spent");
is(Object.keys(lastOut().hand).includes("deck"), false, "the page never sees the deck");
use("card_red"); is(G.countItems(C, ["card_red"]), 2, "a second card will not flip while a hand is in play");

/* the tips a level-3 fighter gets from a Red card: all doable, none in the Wilderness */
const cb = G.combatOf(C), seen = new Set(), kinds = new Set(); let unfit = 0;
for (let i = 0; i < 400; i++) { const h = C.hand; W.cardOp(S, pl, { op: "fold" }); use("card_red"); G.addInv(C.inv, "card_red", 1, C); const tp = C.hand.tip; kinds.add(tp.kind); seen.add(tp.where);
  if (tp.kind === "kill" && G.MOBS[tp.t].lvl > cb + 5) unfit++; if (tp.where === "The Wilderness" || tp.where === "The Deep Wild") unfit++; }
is(unfit, 0, `400 Red tips for a combat-${cb} character: every kill within five levels, none in the Wilderness`);
is([...kinds].sort(), ["gather", "kill", "npc", "spot"], "all four kinds turn up");
console.log(`     (the places they sent Pip: ${[...seen].join(", ")})`);

/* 3. a kill tip, then hit, then stand */
const set = (cards, deck, tip) => { C.hand = { tier: "red", deck: [cards[0], ...deck], at: cards.length === 1 ? 1 : 0, cards, state: "tip", tip, tips: 0, won: 0, used: {}, peek: null, last: null }; if (cards.length > 1) C.hand.at = 1; };
set([c(10, 1)], [c(10, 1), c(7, 2), c(9, 3), c(12)], { kind: "kill", t: "chicken", x: "Chicken", w: "The Yard", text: "", hint: "", key: "k:chicken" });
C.hand.at = 1; let t0 = tix();
W.cardOnKill(pl, { t: "cow" }); is(C.hand.cards.length, 1, "the wrong monster deals nothing");
W.cardOnKill(pl, { t: "chicken" }); is([C.hand.cards.length, C.hand.state, tix() - t0], [2, "decide", 60], "the right one: the next card (20), and 60 tickets of tip money");
W.cardOp(S, pl, { op: "hit" }); is([C.hand.state, !!C.hand.tip], ["tip", true], "hit: a new tip");
C.hand.tip = { kind: "gather", k: "logs", x: "logs", w: "The Yard", text: "", hint: "", key: "g:logs" }; C.hand.deck[C.hand.at] = c(1, 0);
W.cardOnGain(pl, S, "copper", "mining"); is(C.hand.cards.length, 2, "the wrong catch deals nothing");
t0 = tix(); W.cardOnGain(pl, S, "logs", "woodcutting");
is([C.hand, tix() - t0 >= 60 + G.handPay("red", "21")], [null, true], "logs in hand: an ace on 20 is 21, and 21 settles itself and pays");

/* 4. a flip tip: beside Livia, and not from across the Yard */
set([c(5)], [c(6)], { kind: "npc", x: "Livia the Broker", scene: "workyard", w: "The Yard", text: "", hint: "Flip the card beside Livia the Broker (The Yard).", key: "n:Livia" });
const livia = S.npcs.find((n) => n.name === "Livia the Broker");
pl.x = 5; pl.y = 5; W.cardOp(S, pl, { op: "flip" }); is(C.hand.cards.length, 1, "flipped from across the Yard: nothing");
pl.x = livia.x; pl.y = livia.y + 1; W.cardOp(S, pl, { op: "flip" }); is(C.hand.cards.length, 2, "flipped beside her: the next card");

/* 5. the tools: peek, burn, and an ace up the sleeve */
set([c(10)], [c(6), c(13), c(4), c(3)], null); C.hand.cards.push(C.hand.deck[1]); C.hand.at = 2; C.hand.state = "decide";
for (const k of ["peekglass", "dealershoe", "acesleeve"]) G.takeInv(C.inv, k, 99);   /* (an earlier hand may have paid one out) */
W.cardOp(S, pl, { op: "peek" }); is(C.hand.used.peek, undefined, "no Peeking Glass, no peek");
G.addInv(C.inv, "peekglass", 1, C); G.addInv(C.inv, "dealershoe", 1, C); G.addInv(C.inv, "acesleeve", 1, C);
W.cardOp(S, pl, { op: "peek" }); is([C.hand.peek?.r, lastOut().hand.peek?.r], [13, 13], "the glass shows the next card: a king on 16");
W.cardOp(S, pl, { op: "peek" }); is(C.hand.used.peek, true, "once a hand");
W.cardOp(S, pl, { op: "burn" }); is([C.hand.at, C.hand.peek], [3, null], "the Shoe bins the king");
W.cardOp(S, pl, { op: "hit" }); C.hand.tip = { kind: "kill", t: "chicken", x: "Chicken", w: "The Yard", key: "k:chicken" }; C.hand.deck[C.hand.at] = c(12, 2);
W.cardOnKill(pl, { t: "chicken" }); is([C.hand.state, G.handTotal(C.hand.cards).t], ["bust", 26], "a queen on 16 busts, and the sleeve holds the hand open");
W.cardOp(S, pl, { op: "ace" }); is([C.hand.state, G.handTotal(C.hand.cards).t, C.hand.cards.at(-1).r], ["decide", 17, 1], "the ace: 17, still playing");
t0 = tix(); W.cardOp(S, pl, { op: "stand" }); is([C.hand, tix() - t0 >= G.handPay("red", "17")], [null, true], "stand on 17: 1.5 times the base");

/* 6. a bust with no sleeve left; a natural; a five-card Charlie */
G.takeInv(C.inv, "acesleeve", 1);
set([c(10)], [c(6)], null); C.hand.cards.push(c(6)); C.hand.at = 2; C.hand.state = "decide"; C.hand.deck.push(c(9));
W.cardOp(S, pl, { op: "hit" }); C.hand.tip = { kind: "kill", t: "chicken", x: "Chicken", w: "The Yard", key: "k:chicken" }; t0 = tix();
W.cardOnKill(pl, { t: "chicken" }); is([C.hand, tix() - t0, lastOut().done?.result], [null, 60, "bust"], "25: bust, and only the tip money");
said.length = 0;
set([c(1, 0)], [c(12, 0)], { kind: "kill", t: "chicken", x: "Chicken", w: "The Yard", key: "k:chicken" }); t0 = tix();
W.cardOnKill(pl, { t: "chicken" }); is([C.hand, lastOut().done?.result, tix() - t0 >= 60 + 1200], [null, "natural", true], "ace, queen: blackjack, 8 times the base");
is(said.some((t) => /Blackjack/.test(t)), true, "and the room hears about it");
set([c(2)], [c(3), c(2), c(4), c(5)], null); C.hand.at = 1;
for (let i = 0; i < 4; i++) { C.hand.state = "tip"; C.hand.tip = { kind: "kill", t: "chicken", x: "Chicken", w: "The Yard", key: "k:chicken" }; W.cardOnKill(pl, { t: "chicken" }); }
is([C.hand, lastOut().done?.result, lastOut().done?.total], [null, "charlie", 16], "five cards on 16: a Five-card Charlie, settled on the spot");

/* 7. fold */
use("card_red"); W.cardOp(S, pl, { op: "fold" }); is(C.hand, null, "fold: the hand is gone");

/* 8. the looks: never bought, used once, worn */
C.store = { own: [], name: {} }; G.addInv(C.inv, "tickets", 10_000_000, C);
W.storeOp(S, pl, { op: "buy", id: "col_felt" }); is(C.store.own.includes("col_felt"), false, "the Felt name is not for sale");
G.addInv(C.inv, "feltswatch", 2, C); const f0 = G.countItems(C, ["feltswatch"]); use("feltswatch"); is([C.store.own.includes("col_felt"), C.store.name.col, f0 - G.countItems(C, ["feltswatch"])], [true, "col_felt", 1], "a Swatch of Table Felt: owned and worn, one used");
use("feltswatch"); is(f0 - G.countItems(C, ["feltswatch"]), 1, "a second one is kept, not wasted");

/* 9. the uniques are in the collection log, on a tab of their own */
const tab = G.collectionBook().tabs.find((t) => t.id === "cards");
is(tab?.sections.flatMap((s) => s.keys), ["peekglass", "feltswatch", "dealershoe", "markeddeck", "acesleeve", "sharkpin"], "the Marked Cards tab");

/* 10. a Black card's tips for a maxed character: in the band, the Wilderness allowed */
const hi = { id: "p2", name: "Max", login: "max", C: G.freshChar(), x: 31, y: 14, out: [], path: [], admin: true }; hi.C.scene = "workyard"; W.pls.set("p2", hi);
for (const k of Object.keys(G.SKILLS)) hi.C.xp[k] = G.XP_AT[99];
const blk = new Set(); let low = 0;
for (let i = 0; i < 300; i++) { G.addInv(hi.C.inv, "card_black", 1, hi.C); const j = hi.C.inv.findIndex((s) => s.k === "card_black"); W.useSpecial(hi, j, hi.C.inv[j], G.ITEMS.card_black); const tp = hi.C.hand?.tip; if (tp) { blk.add(tp.where); if (tp.kind === "kill" && G.MOBS[tp.t].lvl < 75) low++; } W.cardOp(S, hi, { op: "fold" }); }
is(low, 0, "300 Black tips: no kill under level 75");
console.log(`     (the places they sent Max: ${[...blk].join(", ")})`);

/* 11. a save carries a real hand and nothing else */
const ok = G.normChar({ ...G.freshChar(), hand: { tier: "blue", deck: [c(2), c(3)], cards: [c(2)], at: 1, state: "tip", tip: null } }).hand;
const forged = G.normChar({ ...G.freshChar(), hand: { tier: "gold", deck: [c(2)], cards: [c(14)], state: "tip" } }).hand;
is([!!ok, forged], [true, null], "a real hand survives a load; a forged one does not");

console.log(bad ? `\n${bad} problem(s)` : "\nall good");
process.exit(bad ? 1 : 0);
