/* ============================================================ THE WEEKLY ISSUE (2026-09-30): the server's half. The owner: "user friendly mockups that are sharable with
   all users that live inside the wiki … like a link in the wiki like updates: week 1 (post launch) and it includes major changes with pictures, links to
   relevant wiki information, stats of the week, total tickets wagered, interesting stats, dungeon clears, etc. we'll start doing once a week major updates".

   THE WEEK: G.WEEKLY.start (launch day, a Thursday) is the first day of Week 1, and every seven Chicago days is the next. Counted in Chicago DAYS
   (chicagoDay), so a clock change never moves a boundary.
   THE SNAPSHOT (storage "wk:<n>"): the world as a week began: every character's xp by skill, kills, quests, tickets earned and wagered, ZCoins
   found, Tower floor, time played, and the dungeon clears and Jackpot hits so far. Taken on the first tick of each week (and on the first tick
   ever, which is what Week 1 counts from if the server starts after launch). A few KB for the whole server.
   THE TALLY ("wkacc:<n>"): what no character keeps: the week's peak online, the world bosses killed, raids won and lost, Jackpot hits and
   dungeon clears (counted as they happen: the kept lists of both are capped, so a difference of their lengths would stop at the cap).
   A week's numbers are its snapshot taken from the next one (or from the world now, for the week in progress). Nothing is sent to anybody
   until the wiki asks ({t:"weekly", n}), and the answer is cached a minute. */
export function installWeekly(World, { G }) {
  const P = World.prototype, W = G.WEEKLY;
  const dayN = (t) => Math.floor(Date.parse(G.chicagoDay(t)) / 864e5);
  /* (2026-10-02) EDITIONS, NOT WEEKS: a version's issue counts from the moment it went live (G.WEEKLY.eds, G.editionOf). The storage keys keep their
     names (wk:<n>, wkacc:<n>); n is the edition now. wk:1 was taken at launch, so it is still right. */
  const weekOf = (t) => G.editionOf(t);
  P.weekOf = function (t = Date.now()) { return weekOf(t); };
  /* the world right now, in the snapshot's shape */
  P.weekNow = async function () {
    await this.hiscores();   /* fills this.hsRows (every character), cached 30 s */
    const who = {};
    for (const r of this.hsRows || []) who[r.id] = { name: r.name, xp: r.xp, sx: r.skillXp || {}, kills: r.kills | 0, quests: r.quests | 0, earned: r.earned | 0, wagered: r.wagered | 0, zc: r.zcoins | 0, tower: r.tower | 0, ms: r.playMs || 0 };
    const clears = {}; for (const [tier, list] of Object.entries(this.cryptTop || {})) clears[tier] = (list || []).length;
    return { at: Date.now(), who, clears, jackWins: (this.jack?.wins || []).length };
  };
  P.weekTick = async function (now) {
    const n = weekOf(now); if (n < 1) return;
    this.wk ||= { acc: {} };
    if (this.wk.snapFor !== n) {
      if (!(await this.ctx.storage.get(`wk:${n}`))) await this.ctx.storage.put(`wk:${n}`, await this.weekNow());
      this.wk.snapFor = n;
    }
    const A = (this.wk.acc[n] ||= (await this.ctx.storage.get(`wkacc:${n}`)) || { peak: 0, bosses: {}, raids: { won: 0, lost: 0 } });
    if (this.pls.size > A.peak) { A.peak = this.pls.size; this.wk.dirty = true; }
    if (this.wk.dirty && this.tickN % 600 === 0) { this.wk.dirty = false; this.ctx.storage.put(`wkacc:${n}`, A).catch(() => {}); }
  };
  /* the tally's hooks: a world boss down, a raid won or lost */
  P.weekCount = function (key, sub) {
    const n = weekOf(Date.now()); if (n < 1) return; this.wk ||= { acc: {} }; const A = (this.wk.acc[n] ||= { peak: 0, bosses: {}, raids: { won: 0, lost: 0 } });
    if (key === "boss") A.bosses[sub] = (A.bosses[sub] || 0) + 1; else if (key === "raid") A.raids[sub] = (A.raids[sub] || 0) + 1; else if (key === "clear") (A.clears ||= {})[sub] = (A.clears[sub] || 0) + 1; else if (key === "jackpot") A.jackpots = (A.jackpots || 0) + 1;
    this.wk.dirty = true;
  };
  /** one week's numbers: what changed between its snapshot and the next (or now) */
  P.weekStats = async function (n) {
    const cache = (this.wkCache ||= {}), hit = cache[n]; if (hit && Date.now() - hit.t < 60000) return hit.v;
    const cur = weekOf(Date.now()); let a = await this.ctx.storage.get(`wk:${n}`), sofar = false;
    /* BEFORE LAUNCH, Week 1 shows everything so far (from nothing to now), marked as such, so the issue can be read the day it is written */
    if (!a && n === 1 && cur < 1) { a = { at: 0, who: {}, clears: {}, jackWins: 0 }; sofar = true; }
    if (!a || (n > cur && !sofar)) return { n, have: false };
    const b = n < cur ? (await this.ctx.storage.get(`wk:${n + 1}`)) || (await this.weekNow()) : await this.weekNow();
    const acc = sofar ? { peak: this.peak || 0, bosses: {}, raids: { won: 0, lost: 0 }, clears: b.clears || {} } : (n === cur ? this.wk?.acc?.[n] : null) || (await this.ctx.storage.get(`wkacc:${n}`)) || { peak: 0, bosses: {}, raids: { won: 0, lost: 0 } };
    const skills = {}, rows = [];
    let xp = 0, kills = 0, quests = 0, earned = 0, wagered = 0, zc = 0, floors = 0, ms = 0, active = 0, fresh = 0;
    for (const [id, e] of Object.entries(b.who)) {
      const s = a.who[id]; if (!s) fresh++;
      const d = (k) => Math.max(0, (e[k] || 0) - (s?.[k] || 0)), dx = d("xp");
      if (dx > 0) active++;
      xp += dx; kills += d("kills"); quests += d("quests"); earned += d("earned"); wagered += d("wagered"); zc += d("zc"); floors += d("tower"); ms += d("ms");
      for (const [k, v] of Object.entries(e.sx || {})) { const g = Math.max(0, (v || 0) - (s?.sx?.[k] || 0)); if (g > 0 && G.SKILLS[k] && !G.SKILLS[k].held) skills[k] = (skills[k] || 0) + g; }
      rows.push({ name: e.name || "Someone", xp: dx, kills: d("kills"), earned: d("earned"), wagered: d("wagered"), quests: d("quests") });
    }
    const top = (k) => rows.filter((r) => r[k] > 0).sort((x, y) => y[k] - x[k]).slice(0, 5).map((r) => ({ name: r.name, v: r[k] }));
    const v = { n, have: true, sofar, live: n === cur || sofar, from: a.at, to: n < cur ? b.at : Date.now(), players: Object.keys(b.who).length, active, fresh,
      totals: { xp, kills, quests, earned, wagered, zcoins: zc, floors, hours: Math.round(ms / 3600000) }, skills, clears: acc.clears || {}, jackpots: acc.jackpots || 0,
      acc, top: { xp: top("xp"), kills: top("kills"), earned: top("earned"), quests: top("quests") } };
    cache[n] = { t: Date.now(), v }; return v;
  };
  for (const k of ["weekTick", "weekCount"]) { const f = P[k]; P[k] = function (...a) { try { const r = f.apply(this, a); return r?.catch ? r.catch((e) => console.error(k, e)) : r; } catch (e) { console.error(k, e); } }; }
}
