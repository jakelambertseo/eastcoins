/* ============================================================
   PvP practice engine — the tables, with nothing behind them

   The practice page (/pvp-test) loads the casino's REAL client,
   v3-pvp.js, and hands its two requests to this instead of the
   site:

     GET  /api/casino/pvp/state?game=…   -> PvpSandbox.statePayload()
     POST /api/casino/pvp/join           -> PvpSandbox.joinPayload()

   Everything the server would do — open a lobby on the first seat,
   run the clock, settle when it runs out, refund a table of one — is
   done here, in memory, in the browser. No request ever leaves the
   page, so no ZCoin can move: there is no wallet to reach.

   The one thing that has to match the server exactly is the result
   itself, so a round played here is the round the real table would
   have played from the same seed. outcomeFor, payoutsFor and
   chambersFor below are ports of functions/api/casino/pvp/_pvp.js —
   change one, change the other. A scratch test runs both over the
   same seeds and fails if they ever disagree.
   ============================================================ */
(() => {
  "use strict";

  const STAKE = 20;
  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 12;
  const NAMES = { roulette: "Russian Roulette", standing: "Last One Standing" };
  const BOTS = ["Rook", "Vance", "Milo", "Juno", "Pax", "Wren", "Odie", "Brill", "Case", "Dov", "Esk"];

  const enc = new TextEncoder();
  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", enc.encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function randomSeed() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* ---------------- the maths, mirrored from the server ---------------- */

  const chambersFor = (n) => n * Math.max(1, Math.ceil(6 / n));

  async function outcomeFor(game, seed, n) {
    if (game === "roulette") {
      let remaining = Array.from({ length: n }, (_, i) => i);
      const stages = [];
      for (let k = 0; remaining.length > 1; k += 1) {
        const m = remaining.length;
        const chambers = chambersFor(m);
        const h = await sha256(`${seed}:roulette:${k}`);
        const live = parseInt(h.slice(0, 8), 16) % chambers;
        const shot = remaining[live % m];
        stages.push({ players: m, chambers, live, shot });
        remaining = remaining.filter((s) => s !== shot);
      }
      return { stages, order: stages.map((s) => s.shot), winner: remaining[0] };
    }
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i -= 1) {
      const h = await sha256(`${seed}:shuffle:${i}`);
      const j = parseInt(h.slice(0, 8), 16) % (i + 1);
      const keep = order[i];
      order[i] = order[j];
      order[j] = keep;
    }
    return { order, winner: order[order.length - 1] };
  }

  function payoutsFor(outcome, n) {
    const pay = new Array(n).fill(0);
    pay[outcome.winner] = STAKE * n;
    return pay;
  }

  /* ---------------- the table ---------------- */

  const state = {
    game: "roulette",
    lobbySeconds: 60,
    me: { login: "you", displayName: "You", avatar: "" },
    lobby: null,
    last: null,
    history: [],
    seq: 0,
    joinsThisHour: 0
  };

  async function openLobby(now) {
    const seed = randomSeed();
    state.lobby = {
      id: `sb_${++state.seq}`, game: state.game, seed, hash: await sha256(seed),
      status: "LOBBY", opensAt: now, startsAt: now + state.lobbySeconds * 1000, settledAt: null,
      players: [], result: null
    };
    return state.lobby;
  }

  async function seat(person, now = Date.now()) {
    await settleDue(now);
    if (!state.lobby) await openLobby(now);
    const l = state.lobby;
    if (l.players.some((p) => p.login === person.login)) return { error: "ALREADY_IN", message: "Already at this table." };
    if (l.players.length >= MAX_PLAYERS) return { error: "FULL", message: `The table is full at ${MAX_PLAYERS}.` };
    l.players.push({ login: person.login, displayName: person.displayName, avatar: person.avatar || "", seat: l.players.length, status: "IN", payout: 0, stake: STAKE });
    return { lobby: l };
  }

  async function settleDue(now = Date.now()) {
    const l = state.lobby;
    if (!l || l.startsAt > now) return null;
    state.lobby = null;
    const n = l.players.length;
    if (n < MIN_PLAYERS) {
      for (const p of l.players) { p.status = "REFUNDED"; p.payout = STAKE; }
      Object.assign(l, { status: "VOID", settledAt: now, pot: 0 });
    } else {
      const outcome = await outcomeFor(l.game, l.seed, n);
      const pays = payoutsFor(outcome, n);
      l.players.forEach((p, i) => { p.payout = pays[i]; p.status = pays[i] > 0 ? "WON" : "LOST"; });
      Object.assign(l, { status: "SETTLED", settledAt: now, pot: STAKE * n, result: outcome });
    }
    state.last = l;
    state.history.unshift(l);
    state.history = state.history.slice(0, 30);
    return l;
  }

  const pub = (r, { reveal = false } = {}) => r && ({
    id: r.id, game: r.game, status: r.status, hash: r.hash,
    seed: reveal && r.status !== "LOBBY" ? r.seed : null,
    opensAt: r.opensAt, startsAt: r.startsAt, settledAt: r.settledAt,
    stake: STAKE, pot: STAKE * r.players.length,
    players: r.players.map((p) => ({ ...p })),
    youIn: r.players.some((p) => p.login === state.me.login),
    result: r.status === "LOBBY" ? null : r.result
  });

  function table() {
    const rows = [];
    for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n += 1) {
      rows.push({ players: n, pot: STAKE * n, chance: n, chambers: state.game === "roulette" ? chambersFor(n) : undefined });
    }
    return rows;
  }

  async function statePayload(game) {
    if (game && game !== state.game) setGame(game);
    const now = Date.now();
    await settleDue(now);
    return {
      ok: true, now, game: state.game, name: NAMES[state.game],
      config: { stake: STAKE, lobbySeconds: state.lobbySeconds, minPlayers: MIN_PLAYERS, maxPlayers: MAX_PLAYERS, maxPerHour: 10, hourCap: 300, canBet: true, paused: false, practice: true, table: table() },
      lobby: pub(state.lobby),
      last: pub(state.last, { reveal: true }),
      history: state.history.map((r) => ({ id: r.id, status: r.status, at: r.settledAt, players: r.players.length, pot: r.status === "VOID" ? 0 : STAKE * r.players.length, seats: r.players.map((p) => ({ ...p })) })),
      room: state.lobby ? state.lobby.players.map((p) => ({ login: p.login, displayName: p.displayName, avatar: "" })) : [],
      me: { id: "you", login: state.me.login, displayName: state.me.displayName, joinsThisHour: state.joinsThisHour, hourNet: 0 }
    };
  }

  async function joinPayload() {
    const r = await seat(state.me);
    if (r.error) return { ok: false, code: r.error, message: r.message };
    state.joinsThisHour += 1;
    return { ok: true, balance: null, lobby: pub(r.lobby) };
  }

  /* ---------------- the controls the practice page offers ---------------- */

  async function addBots(count = 1) {
    const now = Date.now();
    let added = 0;
    for (let i = 0; i < count; i += 1) {
      const taken = new Set((state.lobby?.players || []).map((p) => p.login));
      const name = BOTS.find((b) => !taken.has("bot-" + b.toLowerCase()));
      if (!name) break;
      const r = await seat({ login: "bot-" + name.toLowerCase(), displayName: name }, now);
      if (r.error) break;
      added += 1;
    }
    return added;
  }

  function startNow() {
    if (state.lobby) state.lobby.startsAt = Date.now() - 1;
  }

  function reset() {
    state.lobby = null;
    state.last = null;
    state.history = [];
    state.joinsThisHour = 0;
  }

  function setGame(game) {
    if (!NAMES[game]) return;
    if (game !== state.game) reset();
    state.game = game;
  }

  function setLobbySeconds(s) {
    state.lobbySeconds = Math.max(3, Math.min(600, Math.floor(Number(s) || 60)));
    if (state.lobby) state.lobby.startsAt = state.lobby.opensAt + state.lobbySeconds * 1000;
  }

  window.PvpSandbox = Object.freeze({
    state, STAKE, MIN_PLAYERS, MAX_PLAYERS, NAMES,
    chambersFor, outcomeFor, payoutsFor, sha256,
    statePayload, joinPayload, addBots, startNow, reset, setGame, setLobbySeconds
  });
})();
