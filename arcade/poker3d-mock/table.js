/* The flat table view (2026-10-07 mockup): a six-seat sit & go on holdem.js, against five bots, in the page.
   In the real room the ROOM SERVER is the dealer (it holds the deck and runs holdem.js; a page is only told its own two cards and the
   board) and the bots are people. Everything you see here is what that page would draw: the felt, the seats, your clock, the pot, the
   sealed shuffle that's revealed after each hand. */
import { Game, makeDeck, shuffle, evaluate, rankOf, PAYOUTS, LEVELS } from "./holdem.js?v=1";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const SUIT = { s: "♠", h: "♥", d: "♦", c: "♣" };
const card = (c, cls = "") => c ? `<div class="pk-card ${c[1]} ${cls}"><i>${c[0] === "T" ? "10" : c[0]}${SUIT[c[1]]}</i>${c[0] === "T" ? "10" : c[0]}<br>${SUIT[c[1]]}</div>` : `<div class="pk-card back ${cls}"></div>`;
const fmt = (n) => Number(n).toLocaleString();
const TURN_MS = 20000;
async function sha(s) { try { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); } catch { return "—"; } }

// how good a bot thinks its hand is, 0..1, with a dash of nerve
function strength(g, i) {
  const x = g.p[i], board = g.hand.board;
  if (!board.length) {
    const [a, b] = x.cards.map(rankOf).sort((p, q) => q - p), pair = a === b, suited = x.cards[0][1] === x.cards[1][1];
    return Math.min(1, (a + b) / 48 + (pair ? 0.32 + a / 80 : 0) + (suited ? 0.06 : 0) + (!pair && a - b <= 2 ? 0.05 : 0));
  }
  const v = evaluate([...x.cards, ...board]), boardOnly = board.length >= 5 ? evaluate(board) : null;
  let s = [0.12, 0.42, 0.64, 0.75, 0.82, 0.86, 0.93, 0.97, 0.99][v[0]];
  if (boardOnly && boardOnly[0] >= v[0]) s = 0.2;   // the board plays: nothing of ours in it
  return s;
}
function botMove(g, i) {
  const L = g.legal(i), x = g.p[i], bb = g.blinds[1], pot = g.pot(), s = strength(g, i) + (Math.random() - 0.5) * 0.18;
  const callFrac = L.call / (pot + L.call || 1);
  if (x.stack <= bb * 8 && s > 0.5) return { type: L.canRaise ? "raise" : "call", to: L.maxTo };
  if (s > 0.78 && L.canRaise && Math.random() < 0.65) return { type: "raise", to: Math.min(L.maxTo, Math.max(L.minTo, g.hand.current + Math.round(pot * (0.5 + Math.random() * 0.6)))) };
  if (L.check) return s > 0.6 && L.canRaise && Math.random() < 0.35 ? { type: "raise", to: Math.min(L.maxTo, Math.max(L.minTo, Math.round(pot * 0.5))) } : { type: "check" };
  return s > callFrac + 0.16 ? { type: "call" } : { type: "fold" };
}

export function openTable(stage, { me = "You", sng, bots, onLeave, notify = () => {}, sfx = () => {} }) {
  const root = document.createElement("div"); root.className = "pk"; stage.append(root);
  const g = new Game([{ name: me }, ...bots.map((name) => ({ name, bot: true }))], { handsPerLevel: 6 });
  const pool = sng.buyIn * 6, prizes = PAYOUTS.map((p) => Math.round(pool * p));
  let said = {}, lines = [], seal = { hash: "", seed: "", revealed: false }, timer = null, clockAt = 0, closed = false, myPlace = 0, raiseTo = 0;

  root.innerHTML = `
    <div class="pk-top"><b class="ak-h3">${esc(sng.name)}</b>
      <span class="ak-chip pk-lvl"></span><span class="ak-chip">Prizes <b>${sng.buyIn ? `${fmt(prizes[0])} / ${fmt(prizes[1])} ${esc(sng.unit)}` : "titles"}</b></span>
      <button type="button" class="ak-btn sm ghost" data-pk="leave">Leave table</button></div>
    <div class="pk-mid"><div class="pk-felt"><div class="pk-pot"></div><div class="pk-board"></div></div><div class="pk-seats-l"></div>
      <div class="pk-fair"></div><div class="pk-log"></div></div>
    <div class="pk-bar"></div>`;
  const $ = (s) => root.querySelector(s);

  function seatHtml(x) {
    const h = g.hand, turn = h && !h.over && h.actor === x.i, mine = x.i === 0, show = mine || (h?.street === "showdown" && !x.folded);
    const win = h?.over ? h.winners.find((w) => w.i === x.i) : null;
    const cards = x.out ? "" : x.cards.length ? x.cards.map((c) => card(show ? c : null, x.folded ? "dim" : win && show ? "win" : "")).join("") : "";
    const sd = said[x.i];
    const clock = turn ? `<span class="pk-clock" style="transform:scaleX(${Math.max(0, 1 - (Date.now() - clockAt) / TURN_MS)})"></span>` : "";
    return `<div class="pk-seat${mine ? " me" : ""}${turn ? " turn" : ""}${x.folded && !x.out ? " folded" : ""}${x.out ? " out" : ""}" data-pos="${x.i}">
      ${sd ? `<span class="pk-said ${sd.cls || ""}">${esc(sd.text)}</span>` : ""}
      <div class="cards">${cards}</div>
      <div class="pk-plate"><span class="ak-av sm" style="--ring:${mine ? "var(--ak-cyan)" : "var(--ak-line)"}">${esc(x.name[0].toUpperCase())}</span><div><b>${esc(x.name)}</b><span class="st">${x.out ? `out · ${ordinal(x.place)}` : fmt(x.stack)}</span></div>${clock}</div>
      ${x.bet ? `<span class="pk-bet">${fmt(x.bet)}</span>` : ""}
      ${g.button === x.i && !x.out ? `<span class="pk-dealer">D</span>` : ""}
      ${win?.hand && show ? `<span class="pk-hand">${esc(win.hand)}</span>` : ""}
    </div>`;
  }
  const ordinal = (n) => n + (["th", "st", "nd", "rd"][((n % 100) - 20) % 10] || ["th", "st", "nd", "rd"][n % 100] || "th");
  function render() {
    if (closed) return;
    const h = g.hand;
    $(".pk-lvl").innerHTML = `Level ${Math.min(g.level + 1, LEVELS.length)} · blinds <b>${fmt(g.blinds[0])}/${fmt(g.blinds[1])}</b> · hand ${g.handNo}`;
    $(".pk-board").innerHTML = h ? h.board.map((c) => card(c, h.over && h.winners.length && h.street === "showdown" ? "" : "")).join("") : "";
    const potNow = g.pot() - g.p.reduce((s, x) => s + x.bet, 0);
    $(".pk-pot").innerHTML = h ? `${h.over ? "Pot " : "Pot "}${fmt(h.over ? 0 : potNow)}${h.over ? "" : `<small>total ${fmt(g.pot())}</small>`}` : "";
    $(".pk-pot").hidden = !h || h.over;
    $(".pk-seats-l").innerHTML = g.p.map(seatHtml).join("");
    $(".pk-fair").innerHTML = seal.hash ? (seal.revealed ? `Shuffle revealed · seed <code>${seal.seed.slice(0, 10)}…</code> · hash matches <code>${seal.hash.slice(0, 10)}…</code> ✓` : `Shuffle sealed before the deal · <code>${seal.hash.slice(0, 16)}…</code>`) : "";
    $(".pk-log").innerHTML = lines.slice(-8).reverse().map((l) => `<div>${l}</div>`).join("");
    bar();
  }
  function bar() {
    const el = $(".pk-bar"), h = g.hand, x = g.p[0];
    if (x.out) { el.innerHTML = `<span class="pk-wait">You're out (${ordinal(x.place)}). Watching the rest.</span><button type="button" class="ak-btn sm ghost" data-pk="leave">Back to the room</button>`; return; }
    const L = h && !h.over ? g.legal(0) : null;
    if (!L) { el.innerHTML = `<span class="pk-wait">${h?.over ? "Next hand in a moment…" : x.folded ? "You folded. Waiting for the hand to finish…" : `Waiting for ${esc(g.p[h?.actor]?.name || "the deal")}…`}</span>`; return; }
    const pot = g.pot(), bb = g.blinds[1];
    raiseTo = Math.max(L.minTo, Math.min(L.maxTo, raiseTo || L.minTo));
    const word = h.current ? "Raise to" : "Bet";
    el.innerHTML = `<button type="button" class="ak-btn ghost" data-pk="fold">Fold</button>
      <button type="button" class="ak-btn cyan" data-pk="${L.check ? "check" : "call"}">${L.check ? "Check" : `Call ${fmt(L.call)}`}</button>
      ${L.canRaise ? `<div class="pk-raise"><input type="range" min="${L.minTo}" max="${L.maxTo}" step="${Math.max(1, bb / 2)}" value="${raiseTo}" aria-label="Raise amount"><output>${fmt(raiseTo)}</output>
        <div class="pk-presets"><button type="button" class="ak-chip" data-amt="${Math.round(h.current + pot / 2)}">½ pot</button><button type="button" class="ak-chip" data-amt="${Math.round(h.current + pot)}">Pot</button><button type="button" class="ak-chip" data-amt="${L.maxTo}">All in</button></div></div>
        <button type="button" class="ak-btn" data-pk="raise">${raiseTo >= L.maxTo ? "All in" : `${word} ${fmt(raiseTo)}`}</button>` : ""}`;
  }
  root.addEventListener("input", (e) => { if (e.target.type !== "range") return; raiseTo = Number(e.target.value); e.target.nextElementSibling.textContent = fmt(raiseTo); const L = g.legal(0); const b = root.querySelector('[data-pk="raise"]'); if (b && L) b.textContent = raiseTo >= L.maxTo ? "All in" : `${g.hand.current ? "Raise to" : "Bet"} ${fmt(raiseTo)}`; });
  root.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pk], [data-amt]"); if (!b) return;
    if (b.dataset.amt) { const L = g.legal(0); if (L) { raiseTo = Math.max(L.minTo, Math.min(L.maxTo, Number(b.dataset.amt))); bar(); } return; }
    const a = b.dataset.pk;
    if (a === "leave") {
      if (!g.finished && !g.p[0].out && !confirm(sng.buyIn ? `Leave now and you forfeit your ${fmt(sng.buyIn)} ${sng.unit} buy-in. Leave?` : "Leave the table? You'll be blinded out.")) return;
      return close();
    }
    if (["fold", "check", "call", "raise"].includes(a)) mine({ type: a, to: raiseTo });
  });
  function close(again = false) { if (closed) return; closed = true; clearTimeout(timer); root.remove(); onLeave?.(myPlace || g.p[0].place, again); }

  // the game's log, as lines and bubbles
  function digest(from) {
    for (const ev of g.log.slice(from)) {
      const n = (i) => `<b>${esc(g.p[i].name)}</b>`;
      if (ev.t === "deal") { said = {}; lines.push(`— Hand ${ev.hand} · blinds ${ev.blinds.join("/")}`); }
      else if (ev.t === "blind") said[ev.i] = { text: `${ev.kind.toUpperCase()} ${ev.amt}` };
      else if (ev.t === "fold") { said[ev.i] = { text: "Fold", cls: "fold" }; lines.push(`${n(ev.i)} folds`); }
      else if (ev.t === "check") { said[ev.i] = { text: "Check" }; lines.push(`${n(ev.i)} checks`); sfx("step"); }
      else if (ev.t === "call") { said[ev.i] = { text: ev.allIn ? "All in" : "Call", cls: ev.allIn ? "raise" : "" }; lines.push(`${n(ev.i)} ${ev.allIn ? "is all in" : `calls ${fmt(ev.amt)}`}`); sfx("beep"); }
      else if (ev.t === "raise") { said[ev.i] = { text: ev.allIn ? "All in" : `Raise ${fmt(ev.to)}`, cls: "raise" }; lines.push(`${n(ev.i)} ${ev.allIn ? "goes all in" : `raises to ${fmt(ev.to)}`}`); sfx("jump"); }
      else if (ev.t === "board") { said = {}; lines.push(`${ev.street[0].toUpperCase() + ev.street.slice(1)}: ${ev.board.map((c) => (c[0] === "T" ? "10" : c[0]) + SUIT[c[1]]).join(" ")}`); sfx("step"); }
      else if (ev.t === "win") for (const w of ev.wins) { said[w.i] = { text: `Wins ${fmt(w.amt)}`, cls: "win" }; lines.push(`${n(w.i)} wins ${fmt(w.amt)}${w.hand ? ` with ${w.hand.toLowerCase()}` : ""}`); }
      else if (ev.t === "level") { lines.push(`Blinds up: ${ev.blinds.join("/")}`); notify(`Blinds up: ${ev.blinds.join("/")}`, "⏫"); }
      else if (ev.t === "out") { lines.push(`${n(ev.i)} is out in ${ordinal(ev.place)}`); if (ev.i === 0) { myPlace = ev.place; sfx("fall"); } }
    }
  }

  async function newHand() {
    if (closed) return;
    if (g.finished) return finish();
    // seal the shuffle before anyone sees a card: the hash now, the seed after the hand
    const seed = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    let k = 0; const rnd = () => { k++; const x = Math.sin(parseInt(seed.slice((k * 3) % 26, (k * 3) % 26 + 6), 16) + k * 9301) * 10000; return x - Math.floor(x); };
    const deck = shuffle(makeDeck(), rnd);
    seal = { seed, hash: await sha(seed + ":" + deck.join("")), revealed: false };
    const at = g.log.length; g.startHand(deck); digest(at); sfx("go");
    step();
  }
  function step() {
    if (closed) return;
    render();
    const h = g.hand;
    if (h.over) { seal.revealed = true; render(); timer = setTimeout(newHand, h.street === "showdown" ? 3600 : 2200); return; }
    clockAt = Date.now();
    if (h.actor === 0) { raiseTo = 0; render(); tick(); timer = setTimeout(() => mine(g.legal(0)?.check ? { type: "check" } : { type: "fold" }), TURN_MS); }
    else timer = setTimeout(() => { const at = g.log.length; g.act(h.actor, botMove(g, h.actor)); digest(at); step(); }, g.p[0].out ? 350 : 650 + Math.random() * 700);
  }
  function tick() { if (closed || g.hand?.actor !== 0) return; const c = root.querySelector(".pk-seat.me .pk-clock"); if (c) c.style.transform = `scaleX(${Math.max(0, 1 - (Date.now() - clockAt) / TURN_MS)})`; requestAnimationFrame(tick); }
  function mine(a) { if (closed || g.hand?.actor !== 0) return; clearTimeout(timer); const at = g.log.length; if (!g.act(0, a)) return; digest(at); step(); }
  function finish() {
    render();
    const place = g.p[0].place || myPlace, prize = place && place <= 2 ? prizes[place - 1] : 0;
    const res = document.createElement("div"); res.className = "pk-result";
    res.innerHTML = `<div><div class="big">${place === 1 ? "YOU WIN! 🏆" : place === 2 ? "2ND PLACE" : `${ordinal(place).toUpperCase()} PLACE`}</div>
      <p>${sng.buyIn ? (prize ? `You take <b>${fmt(prize)} ${esc(sng.unit)}</b> from the ${fmt(pool)} pool.` : `Out of the money this time. The top two take ${fmt(prizes[0])} and ${fmt(prizes[1])}.`) : place === 1 ? "The Freeroll title is yours for the day." : "Freerolls pay a title to the winner."} ${esc(g.p.find((x) => x.place === 1)?.name || "")} won the table.</p>
      <button type="button" class="ak-btn" data-pk="again">Play another</button> <button type="button" class="ak-btn ghost" data-pk="leave">Back to the room</button></div>`;
    root.append(res);
    res.addEventListener("click", (e) => { if (e.target.closest('[data-pk="again"]')) close(true); });
    sfx(place === 1 ? "finish" : "checkpoint");
  }
  newHand();
  return { close, game: g };
}
export { LEVELS };
