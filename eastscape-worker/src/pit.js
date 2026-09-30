/* ============================================================
   THE FIGHT PIT FOR TICKETS: the game server's side (v109)

   The owner, 2026-09-21: "users who bet zcoin get zcoin, if they use tickets they get tickets". v107 did that for the floor's eight
   tables, which the game server plays itself. The Pit is different: the fight in the room is ONE OF EASTCOIN.VIP'S SHARED ROUNDS
   (functions/api/casino/_engine.js GAMES.pit): a 90 second wall-clock cycle, 40 s of betting, the winner decided by a seed the
   SITE keeps secret until the bets close. Until now a ticket bet there was a voucher staked on the site, paid in ZCoins.

   Now a ticket bet is held HERE and settled against the site's own result, at the site's own price:

       payout = stake x the fighter's fair price (1 / its chance, from the round number alone) x that round's edge draw (96-104%,
                from the revealed seed: the site's edgeFor)

   which is to the ticket exactly what a ZCoin bet on the same fighter is paid. No ZCoin moves, nothing is written on the site,
   and these bets use none of the hourly ZCoin allowance.

     bet      tickets leave the bag and the bet is saved IN THE SAME WRITE as the character (`pit:<round>` in storage), so a
              restart can neither lose a stake nor give it back twice.
     settle   PIT.bet + PIT.show into the round (when the fight in the window ends, so a bag that jumps early can't give the
              winner away) the site's public state is read ONCE for the round; every bet on it is paid or lost, online or not.
     no word  if the site can't be read for PIT.giveUpMs, every stake on that round is handed back.

   The card (who fights, at what chance) is a pure function of the round number and is worked out here exactly as the site does:
   tools/eastscape-pit-test.mjs imports the site's own pitCard and edgeFor and fails if either drifts. In dev mode (`wrangler dev`,
   which must never reach the real site) the winner comes from a pretend seed, so the whole loop can be played locally.
   ============================================================ */
export const PIT = { cycle: 90000, bet: 40000, show: 36000, early: 1500, giveUpMs: 10 * 60 * 1000, minP: 0.25, maxP: 0.75, titles: 12 };
const sha256 = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
/** the site's pitCard(no), from the same pool in the same order (G.FIGHTS.pool with each monster's level) */
export async function pitCard(G, no) {
  const pool = G.FIGHTS.pool.map((t) => [t, G.MOBS[t].lvl]), h = await sha256(`pit:card:${no}`), at = (i, mod) => parseInt(h.slice(i * 6, i * 6 + 6), 16) % mod;
  const a = at(0, pool.length); let b = at(1, pool.length - 1); if (b >= a) b += 1;
  const sa = Math.sqrt(pool[a][1]), sb = Math.sqrt(pool[b][1]), p = Math.max(PIT.minP, Math.min(PIT.maxP, sa / (sa + sb)));
  return { no, f: [pool[a][0], pool[b][0]], p: [p, 1 - p], price: [1 / p, 1 / (1 - p)] };
}
/** the site's edgeFor(seed), on the GAME's band: the same sha256 position, placed in G.EDGE_BAND (93-99% since the house edge; the site's ZCoin tables stay 96-104%) */
export async function pitEdge(G, seed) { const h = await sha256(`${seed}:edge`), r = parseInt(h.slice(0, 8), 16) / 0x100000000; return Math.round((G.EDGE_BAND[0] + r * (G.EDGE_BAND[1] - G.EDGE_BAND[0])) * 10000) / 10000; }

export function installPit(World, { G }) {
  const P = World.prototype, roundAt = (now) => { const no = Math.floor(now / PIT.cycle); return { no, tIn: now - no * PIT.cycle }; };
  P.pitLoad = async function () { this.pitRounds = new Map(); for (const [k, rec] of await this.ctx.storage.list({ prefix: "pit:" })) this.pitRounds.set(Number(k.slice(4)), rec); };
  P.pitTell = function (no) { const rec = this.pitRounds.get(no), msg = { type: "pit", kind: "bets", no, bets: (rec?.bets || []).map((b) => ({ id: b.id, name: b.name, side: b.side, amt: b.amt })) }; for (const p of this.pls.values()) if (String(p.C.scene).split(":")[0] === "fightpit") p.out.push(msg); };
  P.pitOp = async function (S, pl, m, now) {
    if (S.def.realRound !== "pit") return; const bad = (t) => { pl.out.push({ type: "pit", kind: "no", text: t }); this.say(pl, t, "bad"); };
    if (m.op === "state") { const { no } = roundAt(now); return pl.out.push({ type: "pit", kind: "bets", no, bets: (this.pitRounds.get(no)?.bets || []).map((b) => ({ id: b.id, name: b.name, side: b.side, amt: b.amt })) }); }
    if (m.op !== "bet" || pl.pitBusy) return; const { no, tIn } = roundAt(now);
    if (tIn >= PIT.bet - PIT.early) return bad("Bets are closed for this fight. The next pair is out in a moment.");
    const side = m.side === 1 || m.side === "b" ? 1 : 0, amt = Math.floor(Number(m.amt)), C = pl.C, lo = G.CASINO.minBet, hi = G.CASINO.maxBet;
    if (!(amt >= lo && amt <= hi)) return bad(`Ticket bets here are ${lo.toLocaleString()} to ${hi.toLocaleString()}.`);
    const rec = this.pitRounds.get(no) || { no, bets: [] }, mine = rec.bets.filter((b) => b.id === pl.id), staked = mine.reduce((a, b) => a + b.amt, 0);
    if (mine.some((b) => b.side !== side)) return bad("You've already backed the other one. One side a fight.");
    if (staked + amt > hi) return bad(`That's ${hi.toLocaleString()} tickets a fight at most. You have ${staked.toLocaleString()} on it.`);
    if (G.tixIn(C) < amt) return bad(`That's ${amt.toLocaleString()} tickets and you have ${G.tixIn(C).toLocaleString()}. Go outside: everything out there pays tickets.`);
    pl.pitBusy = true;
    try {
      G.takeInv(C.inv, "tickets", amt); rec.bets.push({ id: pl.id, name: pl.name, side, amt, at: now }); this.pitRounds.set(no, rec);
      C.x = pl.x; C.y = pl.y; await this.ctx.storage.put({ [`pit:${no}`]: rec, [`char:${pl.id}`]: C });   // the stake and the bet, in one write
      pl.needSave = false; this.touch(pl); this.tourStep(pl, "play");
      const card = await pitCard(G, no); this.say(pl, `${amt.toLocaleString()} tickets on the ${G.MOBS[card.f[side]].name.toLowerCase()} at ${(Math.round(card.price[side] * 100) / 100)}×. Paid in tickets when the fight ends.`, "good");
      this.pitTell(no); this.pitAlarm(no * PIT.cycle + PIT.bet + PIT.show + 500);
    } finally { pl.pitBusy = false; }
  };
  /** what the site says happened in round `no`: { winner: 0|1, seed } or null if it can't say yet */
  P.pitResult = async function (no) {
    if (this.env.DEV === "1" && !this.env.ESCAPE_KEY) { const seed = await sha256(`dev-pit-seed:${no}`), card = await pitCard(G, no), u = parseInt((await sha256(`${seed}:pit`)).slice(0, 8), 16) / 0x100000000; return { winner: u < card.p[0] ? 0 : 1, seed }; }   // (pretend: the same sums as the site, a seed nobody keeps)
    try {
      const r = await fetch(`${this.env.SITE}/api/casino/pit/state`, { signal: AbortSignal.timeout(10000) }), j = await r.json().catch(() => null); if (!j?.ok) return null;
      const hit = j.round?.no === no && j.round.result ? { result: j.round.result, seed: j.round.seed } : j.last?.no === no && j.last.result ? { result: j.last.result, seed: j.last.seed } : null;
      return hit && hit.seed ? { winner: hit.result.winner === "b" ? 1 : 0, seed: hit.seed } : null;
    } catch (e) { return null; }
  };
  P.pitPay = async function (id, n) {   // tickets to somebody, here or not
    const p = this.pls.get(id); if (p) { this.cashTo(p, n); this.touch(p); return; }
    try { const ck = `char:${id}`, c = await this.ctx.storage.get(ck); if (!c) return; c.inv ||= []; const s = c.inv.find((x) => x && x.k === "tickets");   // (not here: onto the saved character. Tickets are one stack of any size; with a full bag and no stack they wait in the bank, and normChar walks banked tickets back to the bag at login)
      if (s) s.n += n; else if (c.inv.length < G.INV_MAX) c.inv.push({ k: "tickets", n }); else { c.bank ||= []; const b = c.bank.find((x) => x.k === "tickets"); if (b) b.n += n; else c.bank.push({ k: "tickets", n }); }
      await this.ctx.storage.put(ck, c); } catch (e) { /* lost only if storage itself fails */ }
  };
  P.pitAlarm = function (at) { this.ctx.storage.getAlarm().then((cur) => { if (cur == null || cur > at) return this.ctx.storage.setAlarm(at); }).catch(() => {}); };
  P.alarm = async function () { if (!this.pitRounds) await this.pitLoad(); await this.pitTick(Date.now()); if (this.pitRounds.size) this.pitAlarm(Date.now() + 5000); };   // (woken with nobody online: settle what is due, and come back if the site hasn't answered yet)
  P.pitTick = async function (now) {
    if (!this.pitRounds?.size || this.pitSettling) return; this.pitSettling = true;
    try {
      for (const [no, rec] of [...this.pitRounds]) {
        const due = no * PIT.cycle + PIT.bet + PIT.show; if (now < due) continue;
        if (now - (rec.askedAt || 0) < 4000) continue; rec.askedAt = now;
        const res = await this.pitResult(no);
        if (!res) { if (now - due < PIT.giveUpMs) continue;   // the site never said: everybody's stake comes back
          this.pitRounds.delete(no); await this.ctx.storage.delete(`pit:${no}`);
          for (const b of rec.bets) { await this.pitPay(b.id, b.amt); const p = this.pls.get(b.id); if (p) { this.say(p, `The Pit never posted that fight's result. Your ${b.amt.toLocaleString()} tickets are back.`); p.out.push({ type: "pit", kind: "paid", no, void: true, stake: b.amt, payout: b.amt }); } } continue; }
        const card = await pitCard(G, no), edge = await pitEdge(G, res.seed);
        this.pitRounds.delete(no); await this.ctx.storage.delete(`pit:${no}`);   // gone BEFORE anybody is paid: a crash here loses a payout, never pays one twice
        const byPlayer = new Map(); for (const b of rec.bets) { const e = byPlayer.get(b.id) || { id: b.id, name: b.name, side: b.side, stake: 0 }; e.stake += b.amt; byPlayer.set(b.id, e); }
        for (const e of byPlayer.values()) {
          const won = e.side === res.winner, payout = won ? Math.round(e.stake * card.price[e.side] * edge) : 0; if (payout) await this.pitPay(e.id, payout);
          const p = this.pls.get(e.id); if (!p) continue; const nm = G.MOBS[card.f[res.winner]].name;
          if (won) { this.fameWin?.(p, "The Fight Pit", payout - e.stake); p.lastWin = { amt: payout - e.stake, at: now }; } else p.lastLoss = { amt: e.stake, at: now };
          this.say(p, won ? `${nm} wins. Your ${e.stake.toLocaleString()} tickets pay ${payout.toLocaleString()}.` : `${nm} wins. Your ${e.stake.toLocaleString()} tickets are gone.`, won ? "loot" : "bad");
          p.out.push({ type: "pit", kind: "paid", no, won, stake: e.stake, payout, edge, price: Math.round(card.price[e.side] * 100) / 100 });
        }
      }
    } finally { this.pitSettling = false; }
  };
}
