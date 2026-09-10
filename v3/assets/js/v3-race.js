/* ============================================================
   EastCoin V3 — Casino: Horse Race

     /?view=race

   Four runners at different odds, one race a minute. Forty seconds
   of bets, then the horses run for about twelve seconds and the
   winner the server already drew crosses first. Gold Rush is the
   favourite at 2.4×, Longshot pays 9.6×. Every price returns the
   same 96% over time.
   ============================================================ */
(() => {
  "use strict";

  const K = window.ECCasino;
  const RACE_MS = 11000;
  const ICON = { gold: "🐎", burgundy: "🐎", midnight: "🐎", longshot: "🐎" };

  function buildStage(refs) {
    const track = K.el("div", "race");
    refs.raceLanes = {};
    refs.raceBuilt = false;
    refs.raceRound = -1;
    refs.raceTrack = track;
    return track;
  }

  function buildLanes(refs, config) {
    if (refs.raceBuilt || !config?.runners) return;
    refs.raceBuilt = true;
    refs.raceTrack.replaceChildren();
    const finish = K.el("span", "race-finish");
    refs.raceTrack.append(finish);
    for (const r of config.runners) {
      const lane = K.el("div", `race-lane lane-${r.key}`);
      const runner = K.el("div", "race-runner");
      runner.style.setProperty("--c", r.color);
      runner.append(K.el("span", "race-horse", ICON[r.key] || "🐎"), K.el("span", "race-name", r.name), K.el("span", "race-odds", `${r.pays}×`));
      lane.append(runner);
      refs.raceTrack.append(lane);
      refs.raceLanes[r.key] = runner;
    }
  }

  /** A stable 0..1 from a string, so the also-rans pace differently each race but the same for every viewer. */
  function unit(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 10000) / 10000;
  }

  function renderStage(refs, { round, config, inBets, freshResult, now }) {
    buildLanes(refs, config);
    if (!refs.raceBuilt) return;
    if (inBets) {
      if (refs.raceRound !== round.no) {
        refs.raceRound = round.no;
        clearTimeout(refs.raceTimer);
        for (const runner of Object.values(refs.raceLanes)) {
          runner.style.transition = "none";
          runner.style.left = "0%";
          runner.classList.remove("won", "ran");
          runner.classList.add("idle");
        }
        refs.raceTrack.classList.remove("running", "done");
      }
      return;
    }
    if (freshResult && round.result) {
      // Arriving late — the race already ran while this tab was elsewhere —
      // shows the finish rather than replaying from the gate.
      const elapsed = Math.max(0, now - round.closesAt);
      const late = elapsed >= RACE_MS;
      refs.raceTrack.classList.add("running");
      const seed = String(round.seed || round.hash || round.no);
      for (const [key, runner] of Object.entries(refs.raceLanes)) {
        runner.classList.remove("idle");
        runner.classList.add("ran");
        const isWinner = key === round.result.winner;
        // The winner arrives on time; the rest arrive between half a second
        // and four seconds later, each on their own curve.
        const lag = isWinner ? 0 : 500 + unit(seed + key) * 3500;
        const wobble = 0.25 + unit(key + seed) * 0.5;
        const remaining = Math.max(0, RACE_MS + lag - elapsed);
        runner.style.transition = late ? "none" : `left ${remaining}ms cubic-bezier(${wobble.toFixed(2)},.05,.35,1)`;
        void runner.offsetWidth;
        // The nose ends just past the finish line, whatever the track's width.
        runner.style.left = "calc(100% - 150px)";
        if (isWinner) {
          clearTimeout(refs.raceTimer);
          const mark = () => { runner.classList.add("won"); refs.raceTrack.classList.add("done"); };
          if (late) mark(); else refs.raceTimer = setTimeout(mark, Math.max(0, RACE_MS - elapsed));
        }
      }
    }
  }

  const view = K.sharedGame({
    key: "race",
    title: "Horse Race",
    intro: "Four runners, one race a minute. Gold Rush is the favourite at 2.4×, Longshot pays 9.6×. Forty seconds to pick your horse.",
    running: "They're off!",
    revealMs: RACE_MS + 300,
    buildStage,
    renderStage,
    pickButton: (pick, config) => {
      const r = (config.runners || []).find((x) => x.key === pick);
      return { label: r ? r.name : pick, className: `runner-${pick}`, pays: r ? r.pays : config.payout[pick] };
    },
    pickLabel: (pick, config) => (config.runners || []).find((x) => x.key === pick)?.name || pick,
    describe: (result, config) => `${(config.runners || []).find((x) => x.key === result.winner)?.name || result.winner} wins!`,
    resultClass: (result) => result?.winner || ""
  });

  function boot() {
    if (!window.ECV3 || !window.ECCasino) return window.setTimeout(boot, 30);
    window.ECV3.register("race", view);
  }
  boot();
})();
