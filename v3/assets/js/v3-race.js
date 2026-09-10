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

  /** An ease-out curve with a bit of a late kick, so runners surge in the stretch. */
  function ease(t, kick) {
    const x = Math.min(1, Math.max(0, t));
    return 1 - Math.pow(1 - x, 2 + kick * 1.5);
  }

  /**
   * The race is driven by the clock, not by CSS transitions: every frame
   * places each runner from how long the race has been running. That
   * makes a late arrival land on the finish at once, keeps every viewer
   * in step, and survives a tab going to the background.
   */
  function frame(refs) {
    const race = refs.raceRun;
    if (!race || !refs.raceTrack?.isConnected) return;
    const width = refs.raceTrack.clientWidth - 150;
    const elapsed = Date.now() - race.startedAt;
    let allDone = true;
    for (const [key, runner] of Object.entries(refs.raceLanes)) {
      const r = race.runners[key];
      const t = elapsed / r.duration;
      const x = ease(t, r.kick) * width;
      runner.style.left = `${Math.max(0, x)}px`;
      if (t < 1) allDone = false;
      if (key === race.winner && t >= 1 && !runner.classList.contains("won")) {
        runner.classList.add("won");
        refs.raceTrack.classList.add("done");
      }
    }
    if (!allDone) refs.raceFrame = requestAnimationFrame(() => frame(refs));
  }

  function renderStage(refs, { round, config, inBets, freshResult, now }) {
    buildLanes(refs, config);
    if (!refs.raceBuilt) return;
    if (inBets) {
      if (refs.raceRound !== round.no) {
        refs.raceRound = round.no;
        cancelAnimationFrame(refs.raceFrame);
        refs.raceRun = null;
        for (const runner of Object.values(refs.raceLanes)) {
          runner.style.left = "0px";
          runner.classList.remove("won", "ran");
          runner.classList.add("idle");
        }
        refs.raceTrack.classList.remove("running", "done");
      }
      return;
    }
    if (freshResult && round.result) {
      const seed = String(round.seed || round.hash || round.no);
      const runners = {};
      for (const key of Object.keys(refs.raceLanes)) {
        const isWinner = key === round.result.winner;
        // The winner arrives on time; the rest between half a second and
        // four seconds later, each with its own stretch.
        const lag = isWinner ? 0 : 500 + unit(seed + key) * 3500;
        runners[key] = { duration: RACE_MS + lag, kick: unit(key + seed) };
        refs.raceLanes[key].classList.remove("idle");
        refs.raceLanes[key].classList.add("ran");
      }
      // Started when bets closed, wherever this tab was at the time.
      refs.raceRun = { startedAt: Date.now() - Math.max(0, now - round.closesAt), winner: round.result.winner, runners };
      refs.raceTrack.classList.add("running");
      cancelAnimationFrame(refs.raceFrame);
      frame(refs);
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
