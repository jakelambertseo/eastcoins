/* ============================================================
   Red Light, Green Light — the practice engine (/redlight-test)

   Everything the real table's three endpoints do, done in this page:
   a lobby on a clock, bots that sit down and pick sprints, the race
   replayed by the SAME rules file the server uses (redlight-rules.js
   is a byte-identical copy of functions/api/casino/pvp/_redlight.js),
   and a result with its seed. It never calls /api/, so no ZCoin can
   move here however the page is used.

   It answers in the same shape as /api/casino/pvp/state, so the client
   (v3-redlight.js) cannot tell the difference — which is the point.
   ============================================================ */
import * as R from "/v3/assets/js/redlight-rules.js?v=1";   // (assets are cached for a year: bump this when the rules change)

const RL = R.RL, STAKE = 20, LOBBY_S = 12;
const NAMES = ["GoalLineGary", "BlitzBetty", "HailMaryHank", "PuntPolice", "TurfToeTina", "SnapCountSam", "PylonPete", "FlagOnThePlay"];
const me = { login: "you", displayName: "You" };
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha = async (t) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)));
const rnd = (a, b) => a + Math.random() * (b - a);

let round = null, last = null, seq = 0;

async function open(now) {
  const seed = hex(crypto.getRandomValues(new Uint8Array(16)));
  const bots = [...NAMES].sort(() => Math.random() - 0.5).slice(0, 2 + Math.floor(Math.random() * 4));   // 2 to 5 of them
  round = { id: `practice-${++seq}`, seed, hash: await sha(seed), opensAt: now, startsAt: now + LOBBY_S * 1000, players: [], runs: [],
    arriving: bots.map((n) => ({ at: now + rnd(800, LOBBY_S * 1000 - 1500), p: { login: n.toLowerCase(), displayName: n, bot: true, nerve: rnd(0.22, 0.62), when: [] } })) };
}
const seatOf = (login) => round.players.findIndex((p) => p.login === login);

// a bot's sprint: its nerve, pushed up when it's behind and eased off when it leads, and sometimes it just plays safe
function botRun(bot, s, rep) {
  const lead = Math.max(...rep.pos.filter((_, i) => rep.alive[i])), gap = lead - rep.pos[s];
  if (Math.random() < 0.12) return RL.minTurnMs - 60;
  const n = Math.max(0.02, Math.min(0.92, bot.nerve + (gap > 12 ? 0.16 : gap <= 0 ? -0.08 : 0) + rnd(-0.14, 0.14)));
  return Math.round(RL.minTurnMs + (RL.maxRunMs - RL.minTurnMs) * n);
}

async function tick(now) {
  if (!round) return;
  if (now < round.startsAt) {
    for (const a of round.arriving) if (!a.in && now >= a.at && round.players.length < RL.maxPlayers - (seatOf("you") < 0 ? 1 : 0)) { a.in = true; round.players.push(a.p); }
    return;
  }
  // nobody to race: the table clears (on the real one, the buy-in comes straight back)
  if (round.players.length < 2) { last = view(round, { status: "VOID", settledAt: now, result: null, seed: round.seed }); round = null; return; }
  const closed = R.lightsClosed(round.startsAt, now), openK = R.lightOpen(round.startsAt, now);
  const rep = await R.replay(round.seed, round.players.length, round.runs, closed);
  if (rep.winner !== null) { last = view(round, { status: "SETTLED", settledAt: now, result: rep, seed: round.seed }); round = null; return; }
  if (openK >= 0) {
    round.players.forEach((p, s) => {
      if (!p.bot || !rep.alive[s] || round.runs[openK]?.[s] != null) return;
      p.when[openK] ??= R.lightOpensAt(round.startsAt, openK) + rnd(600, RL.chooseMs - 300);
      if (now >= p.when[openK]) (round.runs[openK] ||= [])[s] = R.cleanRun(botRun(p, s, rep));
    });
  }
}

function view(r, over = null) {
  const players = r.players.map((p, seat) => ({ login: p.login, displayName: p.displayName, avatar: "", seat, status: over?.result ? (over.result.winner === seat ? "WON" : "LOST") : "IN", payout: over?.result?.winner === seat ? STAKE * r.players.length : 0 }));
  return { id: r.id, game: "redlight", status: over ? over.status : "LOBBY", hash: r.hash, seed: over ? over.seed : null, opensAt: r.opensAt, startsAt: r.startsAt, settledAt: over ? over.settledAt : null,
    stake: STAKE, pot: STAKE * r.players.length, players, youIn: r.players.some((p) => p.login === "you"), result: over ? over.result : null };
}

// the bots think on their own clock: the page only asks for news when a light closes, which is too late to pick a sprint
setInterval(() => { tick(Date.now()).catch(() => {}); }, 250);

export const sandboxApi = {
  async state() {
    const now = Date.now(); await tick(now);
    let race = null;
    if (round && now >= round.startsAt) {
      const closed = R.lightsClosed(round.startsAt, now), openK = R.lightOpen(round.startsAt, now), rep = await R.replay(round.seed, round.players.length, round.runs, closed), mine = seatOf("you");
      race = { light: openK, closed, lights: rep.lights, pos: rep.pos, alive: rep.alive, outAt: rep.outAt, winner: rep.winner, how: rep.how,
        locked: round.players.map((_, s) => openK >= 0 && round.runs[openK]?.[s] != null), mySeat: mine, myRun: mine >= 0 && openK >= 0 ? round.runs[openK]?.[mine] ?? null : null };
    }
    return { ok: true, now, game: "redlight", name: "Red Light, Green Light",
      config: { stake: STAKE, lobbySeconds: LOBBY_S, minPlayers: 2, maxPlayers: RL.maxPlayers, rules: RL, paused: false, canBet: true },
      lobby: round ? view(round) : null, race, last, me };
  },
  async join() {
    const now = Date.now(); if (!round) await open(now);
    if (now >= round.startsAt) return { ok: false, code: "RUNNING", message: "A race is on. The next one opens when it finishes." };
    if (seatOf("you") >= 0) return { ok: false, code: "ALREADY_IN", message: "You're already in." };
    if (round.players.length >= RL.maxPlayers) return { ok: false, code: "FULL", message: "The field's full." };
    round.players.push({ ...me }); return { ok: true };
  },
  async move(run) {
    const now = Date.now(); if (!round || now < round.startsAt) return { ok: false, code: "NOT_RUNNING" };
    const s = seatOf("you"), k = R.lightOpen(round.startsAt, now); if (s < 0 || k < 0) return { ok: false, code: "NO_LIGHT" };
    if (round.runs[k]?.[s] != null) return { ok: true, light: k, run: round.runs[k][s], already: true };
    (round.runs[k] ||= [])[s] = R.cleanRun(run); return { ok: true, light: k, run: round.runs[k][s] };
  }
};
