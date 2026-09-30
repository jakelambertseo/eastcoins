/* ============================================================ THE ICE WYRM (2026-09-30), the Frozen Reach's daily boss: the server's half.
   The owner: the daily boss "once a day, random hour, but not between 12am and 2pm", then "add an admin setting for me to be able to spawn it".
   The rules are WYRM and MOBS.icewyrm at the end of the rules file.

   ONCE PER CHICAGO DAY, at a random minute between WYRM.fromHour and WYRM.toHour (2 PM to midnight). The Pumpkin King's shape, because it already
   solved the hard parts: the plan is saved (`wyrm` in storage) and read back at start, so a deploy neither loses nor repeats the day's Wyrm;
   when its minute comes it is DUE, CASINO says so, and it surfaces the moment somebody is in the Reach to see it (a map nobody stands in is
   torn down); it stands WYRM.stays (half an hour) from then; if the map empties or the server restarts while it is up, it is put back at the
   health it was left on; and when the half hour is out it sinks back with an "escaped" report for everybody who fought it. A kill is shared
   (it is `open`) and pays everyone who did their share; either way the next one is planned for tomorrow.

   Admin: `wyrm` makes it due NOW (it surfaces as soon as somebody is in the Reach, at once if you are); `wyrm down` sends it away. */
export function installWyrm(World, { G }) {
  const P = World.prototype, W = G.WYRM;
  const minuteCT = (t) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(t);
    const v = (k) => +(p.find((x) => x.type === k)?.value || 0); return (v("hour") % 24) * 60 + v("minute"); };
  /* the next rise: today's window if it has not started yet and today has not had one, otherwise tomorrow's */
  P.wyrmPlan = function (now, tomorrow = false) {
    const nowMin = minuteCT(now), from = W.fromHour * 60, to = W.toHour * 60 - 30, pick = from + Math.floor(Math.random() * (to - from));
    const today = !tomorrow && nowMin < pick;
    const at = now + ((today ? pick - nowMin : 24 * 60 - nowMin + pick) * 60000) - (new Date(now).getSeconds() * 1000);
    this.wyrm = { at, due: false, up: null, day: G.chicagoDay(at) }; this.wyrmSave();
  };
  P.wyrmSave = function () { this.ctx.storage.put("wyrm", this.wyrm).catch(() => {}); };
  P.wyrmOn = function () { return G.OPEN.has(W.scene) || !!this.wyrm?.forced; };
  P.wyrmTick = function (now) {
    if (!this.wyrmOn()) return;
    const S0 = this.wyrm || {};
    if (!S0.at && !S0.due && !S0.up) return this.wyrmPlan(now);
    const H = this.wyrm;
    if (!H.due && !H.up && now >= H.at) {
      H.due = true; this.wyrmSave();
      this.houseSay("❄️ THE ICE WYRM IS RISING out of the Frozen Reach's lake, north of Cloudreach. It stays half an hour and only spells reach it. Bring fire, and bring friends: everyone who hurts it shares the kill.");
      for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: "❄️ The Ice Wyrm is rising in the Frozen Reach." });
    }
    if (H.due) { const S = this.scenes.get(W.scene); if (S && this.playersIn(S).length) this.wyrmSpawn(S, now); }
    if (H.up) {
      const S = this.scenes.get(W.scene), m = S?.mobs.find((x) => x.id === H.up.id);
      if (m && !m.dead && now < H.up.until) { if (H.up.hp !== m.hp) { H.up.hp = m.hp; if (this.tickN % 100 === 0) this.wyrmSave(); } }
      else if (now >= H.up.until) {
        if (S && m) { this.bossEnd(S, m, "escaped"); S.mobs = S.mobs.filter((x) => x.id !== m.id); S.whoSig = null; }
        this.houseSay("❄️ The Ice Wyrm sinks back under the ice. It rises again tomorrow, at an hour nobody knows.");
        this.wyrmPlan(now, true);
      } else if (!m && S && this.playersIn(S).length) this.wyrmPut(S, now, H.up.id, Math.max(1, Math.min(G.MOBS.icewyrm.hp, H.up.hp || G.MOBS.icewyrm.hp)));
    }
  };
  P.wyrmPut = function (S, now, id, hp) {
    const d = G.MOBS.icewyrm, [x, y] = W.at;
    S.mobs.push({ id, t: "icewyrm", x, y, hx: x, hy: y, hp, maxHp: d.hp, path: [], step: null, face: 1, nextWander: 0, dead: false, respawnAt: Infinity, hurtAt: 0, swingAt: 0, lastSwing: now, aggro: d.aggro, perch: true });
    S.whoSig = null;
  };
  P.wyrmSpawn = function (S, now) {
    const H = this.wyrm, id = `${S.key}wyrm${now.toString(36)}`;
    this.wyrmPut(S, now, id, G.MOBS.icewyrm.hp);
    H.due = false; H.up = { id, until: now + W.stays, hp: G.MOBS.icewyrm.hp }; this.wyrmSave();
    for (const p of this.playersIn(S)) this.say(p, "The ice on the lake cracks from underneath, and the Ice Wyrm comes up through it.", "bad");
  };
  /* from killMob: the corpse goes (the ordinary respawn loop must never bring it back), the room hears it, tomorrow is planned */
  P.wyrmDown = function (S, m, pl, now, helpers = []) {
    m.respawnAt = Infinity; S.mobs = S.mobs.filter((x) => x !== m); S.whoSig = null;
    const who = helpers.length ? `${pl.name} and ${helpers.length} other${helpers.length === 1 ? "" : "s"}` : pl.name;
    this.houseSay(`❄️ ${who} brought the Ice Wyrm down in the Frozen Reach. It sleeps until tomorrow.`);
    for (const p of this.pls.values()) p.out.push({ type: "casinonote", text: `❄️ ${who} killed the Ice Wyrm!` });
    this.wyrmPlan(now, true);
  };
  /** for /stats: up (time left, health), due, or seconds until it rises */
  P.wyrmState = function (now = Date.now()) {
    const H = this.wyrm || {}; if (!this.wyrmOn()) return null;
    if (H.up) { const m = this.scenes.get(W.scene)?.mobs.find((x) => x.id === H.up.id); return { up: true, leftS: Math.max(0, Math.round((H.up.until - now) / 1000)), hp: m && !m.dead ? m.hp : H.up.hp }; }
    return H.due ? { due: true } : { nextS: H.at ? Math.max(0, Math.round((H.at - now) / 1000)) : null };
  };
  /* admin: "wyrm" (rise now) and "wyrm down" (send it away) */
  P.wyrmAdmin = function (S, pl, arg, note) {
    const now = Date.now();
    if (arg === "down") {
      const H = this.wyrm || {}; if (!H.up && !H.due) return note("The Ice Wyrm isn't up.");
      const Sx = this.scenes.get(W.scene), m = H.up && Sx?.mobs.find((x) => x.id === H.up.id);
      if (Sx && m) { this.bossEnd(Sx, m, "escaped"); Sx.mobs = Sx.mobs.filter((x) => x.id !== m.id); Sx.whoSig = null; }
      this.wyrmPlan(now, true); return note("The Ice Wyrm is sent back under the ice; the next one is planned for tomorrow.");
    }
    if (this.wyrm?.up) return note(`The Ice Wyrm is already up (${Math.round((this.wyrm.up.until - now) / 60000)} minutes left).`);
    this.wyrm = { ...(this.wyrm || {}), at: now - 1, due: false, up: null, forced: !G.OPEN.has(W.scene) }; this.wyrmSave();
    this.wyrmTick(now);
    return note(this.wyrm.up ? "The Ice Wyrm rises now, in the Frozen Reach." : "The Ice Wyrm is due now: it surfaces the moment somebody is in the Frozen Reach.");
  };
  for (const k of ["wyrmTick", "wyrmSpawn", "wyrmDown", "wyrmState"]) {   /* nothing here may break the world's tick or a kill */
    const f = P[k]; P[k] = function (...a) { try { return f.apply(this, a); } catch (e) { console.error(k, e); return null; } };
  }
}
