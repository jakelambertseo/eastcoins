/* ============================================================ THE ADMIN WINDOW: the server's half (2026-10-01, v1.1; the owner: "yes lets build in the
   admin panel for v1.1", after mockup 17: "the UI is a bit overwhemling now with how much stuff we've added").
   Two answers and one list, all read from what the world already keeps; nothing here changes the game:
     admState   "admstate": what's running (2X, skilling 2X, the raid or the Flood, the Ice Wyrm, today's events, a restart), who's online,
                the recent admin actions, and which commands THIS person may run (the same canRun list the server enforces, so a moderator's
                window only shows what works)
     admPlayer  "admplayer": one player's card, online or not: where, hours, tickets, levels, and the Bom gear a refund could take back
     admLogAdd  every server-wide or about-somebody command an admin or mod runs: who, what, when. The last 50, kept in storage ("admLog"),
                so four admins can see who started the 2X or ended the Flood.
   One small message on open and after an action; no poll faster than the window's own refresh (the page asks every 15 s while it is open). */
const LOGGED = new Set(["double", "skill2x", "raid", "wyrm", "ev", "restart", "saveall", "mute", "unmute", "kick", "refund", "gemgift", "neworder", "projtier", "hwking"]);
const MOD_CAN = ["stats", "saveall", "restart", "tp", "mute", "unmute", "kick", "admstate", "admplayer"];   /* keep in step with canRun in index.js */
export function installAdmin(World, { G }) {
  const P = World.prototype;
  const loginOf = (s) => String(s || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);

  P.admLogAdd = function (pl, m) {
    const cmd = String(m.cmd || ""); if (!LOGGED.has(cmd)) return;
    const arg = m.arg != null ? String(m.arg) : m.mins != null ? String(m.mins) : m.n != null ? String(m.n) : "";
    (this.admLog ||= []).push({ at: Date.now(), who: pl.name, cmd, arg: arg.slice(0, 40), name: m.name ? String(m.name).slice(0, 30) : "", k: m.k ? String(m.k).slice(0, 40) : "" });
    if (this.admLog.length > 50) this.admLog.splice(0, this.admLog.length - 50);
    this.ctx.storage.put("admLog", this.admLog).catch(() => {});
  };

  P.admState = function (pl) {
    const now = Date.now(), isAdmin = pl.role === "admin" || pl.admin;
    const online = [...this.pls.values()].map((p) => ({ name: p.name, scene: String(p.C.scene || "?").split(":")[0], combat: G.combatOf(p.C), role: p.role || "user",
      mins: Math.round((now - (p.joinedAt || now)) / 60000) })).sort((a, b) => a.name.localeCompare(b.name));
    const W = this.wyrm, E = this.ev;
    pl.out.push({ type: "admstate", now, admin: !!isAdmin, can: isAdmin ? null : MOD_CAN, dev: this.env?.DEV === "1",
      online, dbl: this.doubleView(), sx2: this.skill2xView(), raid: this.raidState ? this.raidState(now) : null,
      wyrm: W ? { up: !!W.up, until: W.up?.until || 0, at: W.at || 0 } : null,
      ev: E ? { day: E.day, plan: E.plan, done: E.done } : null,
      restartAt: this.restartAt || 0, log: (this.admLog || []).slice(-30).reverse() });
  };

  P.admPlayer = function (pl, name) {
    const login = loginOf(name); if (!login) return;
    return this.ctx.storage.get(`who:${login}`).then(async (w) => {
      if (!w) return pl.out.push({ type: "admplayer", name: login, missing: true });
      const on = this.pls.get(w.id); if (on) this.accrue(on);
      const C = on ? on.C : G.normChar(await this.ctx.storage.get(`char:${w.id}`)), st = C.stats || {};
      const total = Object.keys(G.SKILLS).reduce((a, k) => a + G.lvlOf(C, k), 0);
      /* what a staff refund could take back: Bom's plain gear, bag and bank, at what he charges them (the refund command's own rule) */
      const sold = {}; for (const x of G.prizesOf()) if (x.give && (G.ITEMS[x.give[0]]?.slot || x.group === "kit" || String(x.group).startsWith("gear"))) sold[x.give[0]] ||= Math.round(G.counterPrice(C, x.price) / (x.give[1] || 1));
      const plain = (s) => !(G.fCode ? G.fCode(s) : s.f), held = (k) => [...(C.inv || []), ...(C.bank || [])].filter((s) => s && s.k === k && plain(s)).reduce((a, s) => a + (s.n || 1), 0);
      const bom = Object.keys(sold).map((k) => ({ k, name: G.ITEMS[k]?.name || k, n: held(k), price: sold[k] })).filter((r) => r.n > 0);
      const top = (mm, n = 4) => Object.entries(mm || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, v]);
      pl.out.push({ type: "admplayer", name: w.name, login, online: !!on, scene: String(C.scene || "?").split(":")[0], role: on?.role || "user",
        mins: Math.round((st.playMs || 0) / 60000), sessions: st.sessions || 0, firstSeen: st.firstSeen || 0, lastSeen: st.lastSeen || 0,
        tix: G.tixIn(C), earned: Math.round(Number(C.earned) || 0), wagered: Math.round(Number(C.wagered) || 0),
        combat: G.combatOf(C), total, deaths: st.deaths || 0, kills: top(st.kills), gathered: top(st.gathered),
        muted: (C.mutedUntil || 0) > Date.now() ? C.mutedUntil : 0, bom });
    }).catch((e) => this.say(pl, `That player could not be read: ${e.message}`, "bad"));
  };
}
