/* ============================================================
   EastScape: THE MIDWAY GAMES — the three stalls in the Carnival's plaza.
   (2026-09-24, the owner: "i also want to add a 'game area', like that are at real fairs/circuses that have fun
   games to play for tickets only ... balloon pop, shooting targets, whack a mole")

   ONE ENGINE, THREE FACES. All three are the same game underneath — a thing pops up somewhere, you hit it
   before it goes away — and they differ only in the shape of the board and how fast it runs. That is not a
   shortcut: three bespoke minigames would drift apart the first time one was tuned, and a player who has
   learned one stall should be able to walk to the next and already know what the rules are.

   TICKETS ONLY, both ways. No ZCoins go anywhere near this, which is what lets it be a game rather than a
   casino table, and is the same line the Game Room on the website draws for the same reason.

   THE SERVER OWNS THE SCHEDULE. The board is a pure function of a seed the page is never shown until the round
   is over, so it cannot be read ahead; the page reports which lane it pressed and when, and `grade()` replays
   the round here. That is the Field Goal / Dead Centre arrangement from the website's Game Room, and it is what
   makes a score mean something.

   WHAT IT DOES NOT DEFEND AGAINST, honestly: a script that sends a perfect list of presses. It cannot, while
   the page keeps its own clock. What stops that being worth doing is the ECONOMY rather than the checks — a
   perfect round pays less than two minutes of fighting the map outside, there is a cooldown per stall, and the
   round cannot be handed in faster than it would take to play (`MIN_PLAY`). A cheat that loses you money is a
   cheat nobody writes.
   ============================================================ */
export function installCarnival(World, { G, rint }) {
  const P = World.prototype;

  /* A SYNCHRONOUS STRING HASH, kept here rather than imported. The casino's fairness uses sha256, which in a
     Worker is crypto.subtle and therefore ASYNC — fine where a promise can be awaited, useless in the middle of
     laying out a board. This is not a fairness commitment and does not need to be one: nothing is bet, the
     stake is tickets, and what the hash buys is only that the board is the same every time the same seed is
     replayed. FNV-1a, which is plenty for picking a lane. */
  const hash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

  /* cols x rows is the board; `shots` targets appear one every `gapMs` and each is up for `windowMs`. */
  const GAMES = {
    balloonpop: { name: "Balloon Pop", cols: 4, rows: 3, shots: 14, windowMs: 900, gapMs: 640, cost: 100, top: 230,
      verb: "burst", thing: "balloon", blurb: "A wall of balloons and a fistful of darts. Hit them before the man behind the counter reaches the pump." },
    shootgallery: { name: "The Shooting Gallery", cols: 5, rows: 1, shots: 16, windowMs: 720, gapMs: 520, cost: 100, top: 245,
      verb: "hit", thing: "duck", blurb: "Cork rifles and tin ducks on a rail. The sights are bent and everybody knows it." },
    whackamole: { name: "Whack-a-Mole", cols: 3, rows: 2, shots: 18, windowMs: 600, gapMs: 430, cost: 100, top: 265,
      verb: "whack", thing: "mole", blurb: "Six holes, one mallet. The moles are not real. Probably." },
  };
  const COOLDOWN_MS = 20000;   // per stall, per player: a stall is a thing you stop at, not a thing you farm
  const MIN_PLAY = 0.8;        // a round handed in faster than 80% of its own length was not played

  /* the board, from the seed alone. The page gets this only when the round starts and cannot derive it. */
  const scheduleFor = (key, seed) => {
    const G0 = GAMES[key], lanes = G0.cols * G0.rows, out = [];
    for (let i = 0; i < G0.shots; i++) {
      out.push({ i, at: i * G0.gapMs, lane: hash(`${seed}:pop:${i}`) % lanes, ms: G0.windowMs });
    }
    return out;
  };

  /* WHAT A SCORE IS WORTH. Accuracy to the power of 1.5, so a perfect round pays `top` and a half-hit round
     pays about a third of it: you need roughly two thirds of the board to come out ahead of the stake. That
     gradient is the whole point — a stall that paid out linearly would be a tax on bad reflexes and nothing
     more, and one that paid out flat would be a slot machine. */
  const payFor = (key, hits) => {
    const G0 = GAMES[key], acc = Math.max(0, Math.min(1, hits / G0.shots));
    return Math.round(G0.top * Math.pow(acc, 1.5));
  };

  const grade = (key, seed, presses) => {
    const sched = scheduleFor(key, seed), used = new Set();
    let hits = 0;
    for (const p of presses) {
      if (!p || !Number.isFinite(p.t) || !Number.isInteger(p.lane)) continue;
      const t = p.t;
      for (const s of sched) {
        if (used.has(s.i) || s.lane !== p.lane) continue;
        if (t >= s.at && t <= s.at + s.ms) { used.add(s.i); hits++; break; }
      }
    }
    return hits;
  };

  P.carnivalOpen = function (S, pl, ob) {
    const key = String(ob?.t || "");
    const G0 = GAMES[key]; if (!G0) return;
    const c = pl.C, now = Date.now();
    const st = (c.midway ||= {});
    pl.out.push({ type: "carnival", game: key, name: G0.name, blurb: G0.blurb, verb: G0.verb, thing: G0.thing,
      cols: G0.cols, rows: G0.rows, shots: G0.shots, windowMs: G0.windowMs, gapMs: G0.gapMs, cost: G0.cost, top: G0.top,
      tix: G.tixIn(c), best: (st[key]?.best | 0), wait: Math.max(0, (st[key]?.at || 0) + COOLDOWN_MS - now) });
  };

  P.carnivalPlay = function (pl, m) {
    const key = String(m.game || ""), G0 = GAMES[key]; if (!G0) return;
    const c = pl.C, now = Date.now(), st = (c.midway ||= {}), row = (st[key] ||= { at: 0, best: 0, runs: 0 });
    const bad = (t) => this.say(pl, t, "bad");

    /* STARTING A ROUND takes the stake and hands back the seed's board. Nothing is owed after this: a round
       abandoned half way through is a round paid for and not played, the same as walking away from a dart. */
    if (m.op === "start") {
      if (now < row.at + COOLDOWN_MS) return bad(`${G0.name} is being reset. ${Math.ceil((row.at + COOLDOWN_MS - now) / 1000)}s.`);
      if (G.tixIn(c) < G0.cost) return bad(`${G0.name} is ${G.fmtTix(G0.cost)} a go. You have ${G.fmtTix(G.tixIn(c))}.`);
      G.takeInv(c.inv, "tickets", G0.cost);
      row.at = now; row.seed = `${now.toString(36)}${rint(1e5, 9e5)}`; row.started = now; row.runs++;
      this.touch(pl);
      pl.out.push({ type: "carnivalround", game: key, board: scheduleFor(key, row.seed).map((s) => ({ at: s.at, lane: s.lane, ms: s.ms })), tix: G.tixIn(c) });
      return;
    }

    if (m.op !== "score") return;
    if (!row.seed || !row.started) return bad("Pay first.");
    const len = G0.shots * G0.gapMs + G0.windowMs;
    /* a round cannot be handed in faster than it takes to play: the schedule is fixed, so the wall clock here
       is a real check and not a guess. */
    if (now - row.started < len * MIN_PLAY) return bad("That was quicker than the board can run. Play it again.");
    const hits = grade(key, row.seed, Array.isArray(m.presses) ? m.presses.slice(0, G0.shots * 3) : []);
    const pay = payFor(key, hits);
    const seed = row.seed;
    row.seed = null; row.started = 0;            // the round is spent before a ticket moves
    if (hits > row.best) row.best = hits;
    if (pay > 0) this.tixTo(pl, pay);
    this.touch(pl);
    pl.out.push({ type: "carnivalwon", game: key, hits, of: G0.shots, pay, cost: G0.cost, best: row.best, seed, tix: G.tixIn(pl.C) });
    this.say(pl, `${G0.name}: ${hits} of ${G0.shots}. ${pay > G0.cost ? `You are up ${G.fmtTix(pay - G0.cost)}.` : pay ? `${G.fmtTix(pay)} back.` : "Nothing back."}`, pay > G0.cost ? "good" : undefined);
  };

  P.carnivalOp = function (S, pl, m) {
    if (m.op === "start" || m.op === "score") return this.carnivalPlay(pl, m);
  };
}
