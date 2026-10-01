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

  /* cols x rows is the board; `shots` targets appear one every `gapMs` and each is up for `windowMs`.
     BOTH SHRINK THROUGH THE ROUND by `ramp`, and the window is SHORTER than the gap. (2026-09-24, the owner:
     "the randomization oof the games needs to be harder, ive been getting 100% in almost all of them - the
     tradeoff is more tickets if someone actually does well".)

     WHY IT WAS FREE. The window used to be LONGER than the gap — 900ms up against one arriving every 640 — so
     there were always one and a half targets on the board and you were never once rushed. Nothing about the
     seed made it hard; a hundred per cent was the expected score, not a good one. A window under the gap means
     exactly one thing is up at a time and you have that long, and the ramp means the last third of a round is
     nearly twice the speed of the first: Whack-a-Mole ends on a 190ms window, which is a reaction test.
     AND THE PAY IS STEEPER TO MATCH: accuracy to the power of 2.6 against 1.5, on a much higher top. A perfect
     round is worth more than farming the map outside for the same minute now, which is the trade he asked for,
     and it is bounded by needing to be perfect at a board that no longer allows it by default. */
  const GAMES = {
    balloonpop: { name: "Balloon Pop", cols: 4, rows: 3, shots: 18, windowMs: 560, gapMs: 620, ramp: 0.55, cost: 100, top: 520,
      verb: "burst", thing: "balloon", blurb: "A wall of balloons and a fistful of darts. They come faster the longer you stay." },
    shootgallery: { name: "The Shooting Gallery", cols: 6, rows: 1, shots: 20, windowMs: 460, gapMs: 520, ramp: 0.55, cost: 100, top: 560,
      verb: "hit", thing: "target", blurb: "Cork rifles and a rail of things that should not be on a rail. The sights are bent and everybody knows it." },
    whackamole: { name: "Whack-a-Mole", cols: 3, rows: 2, shots: 24, windowMs: 380, gapMs: 430, ramp: 0.50, cost: 100, top: 540,   /* 600 first: the fastest board is also the SHORTEST, so an identical top paid the most per minute of the three */
      verb: "whack", thing: "whatever comes up", blurb: "Six holes and one mallet. It is not moles any more. It has not been moles for a while." },
  };
  const PAY_CURVE = 2.6;   // accuracy^this. 1.5 paid a careless round too well
  const COOLDOWN_MS = 20000;   // per stall, per player: a stall is a thing you stop at, not a thing you farm
  const MIN_PLAY = 0.8;        // a round handed in faster than 80% of its own length was not played

  /* the board, from the seed alone. The page gets this only when the round starts and cannot derive it. */
  const scheduleFor = (key, seed) => {
    const G0 = GAMES[key], lanes = G0.cols * G0.rows, out = [];
    let at = 0;
    for (let i = 0; i < G0.shots; i++) {
      /* f runs 1 down to `ramp` across the round, and scales the gap AND the window together, so the board
         speeds up without ever letting two targets overlap. */
      const f = 1 - (1 - G0.ramp) * (i / Math.max(1, G0.shots - 1));
      out.push({ i, at: Math.round(at), lane: hash(`${seed}:pop:${i}`) % lanes, ms: Math.round(G0.windowMs * f) });
      at += G0.gapMs * f;
    }
    return out;
  };
  /* how long a round runs, which is no longer shots x gap now the gap ramps */
  const lengthOf = (key) => { const sc = scheduleFor(key, "x"); const last = sc[sc.length - 1]; return last.at + last.ms; };

  /* WHAT A SCORE IS WORTH. Accuracy to the power of 1.5, so a perfect round pays `top` and a half-hit round
     pays about a third of it: you need roughly two thirds of the board to come out ahead of the stake. That
     gradient is the whole point — a stall that paid out linearly would be a tax on bad reflexes and nothing
     more, and one that paid out flat would be a slot machine. */
  const payFor = (key, hits) => {
    const G0 = GAMES[key], acc = Math.max(0, Math.min(1, hits / G0.shots));
    return Math.round(G0.top * Math.pow(acc, PAY_CURVE));
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

  /* (2026-10-01, v1.1) THE DIARIES' STALL TASKS: a round that pays back more than it cost is a prize won (row.won). A character from before
     this was kept has it worked out once from their best round (carnivalBackfill, at the diary's login sweep). */
  P.carnivalKeys = () => Object.keys(GAMES);
  P.carnivalPrizes = (c) => Object.keys(GAMES).filter((k) => (c?.midway?.[k]?.won | 0) > 0);
  P.carnivalBackfill = (c) => { for (const [k, row] of Object.entries(c?.midway || {})) if (GAMES[k] && !row.won && row.best && payFor(k, row.best) > GAMES[k].cost) row.won = 1; };
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
      const cost = Math.round(G0.cost * (1 - G.diaryOff(c, "carnival")));   /* (2026-10-01) the Carnival's Easy diary: the stalls 10% less */
      if (now < row.at + COOLDOWN_MS) return bad(`${G0.name} is being reset. ${Math.ceil((row.at + COOLDOWN_MS - now) / 1000)}s.`);
      if (G.tixIn(c) < cost) return bad(`${G0.name} is ${G.fmtTix(cost)} a go. You have ${G.fmtTix(G.tixIn(c))}.`);
      G.takeInv(c.inv, "tickets", cost); this.trkTix(pl, -cost, "carnival"); row.paid = cost;
      row.at = now; row.seed = `${now.toString(36)}${rint(1e5, 9e5)}`; row.started = now; row.runs++;
      this.touch(pl);
      pl.out.push({ type: "carnivalround", game: key, board: scheduleFor(key, row.seed).map((s) => ({ i: s.i, at: s.at, lane: s.lane, ms: s.ms })), tix: G.tixIn(c) });   /* (2026-09-24) `i` MUST be here. This map is a hand-picked subset, exactly like meOf, and dropping the index left the page asking for cg_undefined.png for every target: the board ran, the hits counted, and not one icon drew. The client keys the picture on WHICH TARGET this is rather than which lane, so a round runs through the whole set instead of the same face always appearing in the same hole. */
      return;
    }

    if (m.op !== "score") return;
    if (!row.seed || !row.started) return bad("Pay first.");
    const len = lengthOf(key);
    /* a round cannot be handed in faster than it takes to play: the schedule is fixed, so the wall clock here
       is a real check and not a guess. */
    if (now - row.started < len * MIN_PLAY) return bad("That was quicker than the board can run. Play it again.");
    const hits = grade(key, row.seed, Array.isArray(m.presses) ? m.presses.slice(0, G0.shots * 3) : []);
    const pay = payFor(key, hits);
    const seed = row.seed;
    row.seed = null; row.started = 0;            // the round is spent before a ticket moves
    if (hits > row.best) row.best = hits;
    if (pay > 0) this.tixTo(pl, pay, "carnival");
    if (pay > G0.cost) { row.won = (row.won | 0) + 1; this.diaryCheck?.(pl); }   /* (2026-10-01) a prize: the diaries' stall tasks */
    this.touch(pl);
    pl.out.push({ type: "carnivalwon", game: key, hits, of: G0.shots, pay, cost: G0.cost, best: row.best, seed, tix: G.tixIn(pl.C) });
    this.say(pl, `${G0.name}: ${hits} of ${G0.shots}. ${pay > G0.cost ? `You are up ${G.fmtTix(pay - G0.cost)}.` : pay ? `${G.fmtTix(pay)} back.` : "Nothing back."}`, pay > G0.cost ? "good" : undefined);
  };

  P.carnivalOp = function (S, pl, m) {
    if (m.op === "start" || m.op === "score") return this.carnivalPlay(pl, m);
  };
}

/* ============================================================
   THE TURNSTILE — the only way into the Grinning Man's cage.
   (2026-09-24, the owner: "the grinning man needs to be in a horroresque locked in area, and the other mobs in
   the area need a chance too drop a carnival ticket")

   IT MOVES YOU, IT DOES NOT OPEN. A world map is SHARED, so a gate that swings open swings open for everybody
   and stays that way until somebody thinks to shut it — one ticket would admit the whole server. A turnstile
   steps ONE person through and eats their ticket, which is per-player without any per-player state at all, and
   is also simply what a turnstile is.

   AND IT TURNS BOTH WAYS, free on the way out. Charging to leave would make a mistake cost two tickets and
   would strand anybody who walked in without reading, which is a trap rather than a gate.
   ============================================================ */
export function installTurnstile(World, { G }) {
  const P = World.prototype;
  const KEY = "carnivalticket";

  /* there is no countIn in the shared rules — tixIn is a one-off for tickets and every other caller just takes
     what it wants. An item can sit in more than one stack, so this adds them up rather than finding the first. */
  const held = (inv, k) => (inv || []).reduce((a, sl) => a + (sl.k === k ? sl.n : 0), 0);

  P.carnivalTurnstile = function (S, pl, ob) {
    /* the cage is read off the object itself, so moving it on the map moves this with it */
    const cage = ob.cage || { x0: 1, y0: 2, x1: 12, y1: 11 };
    const within = (x, y) => x > cage.x0 && x < cage.x1 && y > cage.y0 && y < cage.y1;
    const out = within(pl.x, pl.y);
    /* which side of the bars you end up on: the tile just inside, or just outside */
    const to = out ? { x: ob.x + 1, y: ob.y } : { x: ob.x - 1, y: ob.y };
    if (!G.walkableIn(S.g, to.x, to.y)) return this.say(pl, "Something is in the way.", "bad");

    if (out) {
      pl.x = to.x; pl.y = to.y; pl.path = []; pl.step = null; this.touch(pl);
      return this.say(pl, "The turnstile clacks round behind you. Out into the sawdust.", "sys");
    }
    if (!held(pl.C.inv, KEY)) return this.say(pl, "ADMIT ONE. The turnstile will not budge without a Carnival ticket — the freaks on the midway carry them.", "bad");
    G.takeInv(pl.C.inv, KEY, 1);
    pl.x = to.x; pl.y = to.y; pl.path = []; pl.step = null; this.touch(pl);
    this.say(pl, "Your ticket goes into the slot and the turnstile lets you through. It clacks shut behind you.", "good");
  };
}
