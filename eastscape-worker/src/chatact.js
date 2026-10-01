/* ============================================================ STARTING EVENTS FROM THE STAFF CHAT VIEW (2026-10-01). The owner: "is it possible to start
   the yard raid remotely on the live server ... i would login and do it via admin but i want it to be a surprise", then "what if we build it into
   the chat room im watching remotely?", and "build it and push it to the live server".
   The chat view (/chat?k=<CHAT_KEY>) is a web page, never a player, so starting something from it shows nobody online. Its buttons post to
   /chat/act, which needs the chat key AND a second secret, ACT_KEY, typed once on the page: the chat link alone can still only read.
     chatAct      one action: start or end a raid, the Flood, a star, a poster, the thief, the Ice Wyrm or the Pumpkin King, now or later
     chatPlanTick runs a waiting one when its time comes (from the world's tick); the plan is kept in storage, so a restart keeps it
     chatActView  what the page shows: the waiting plan and the last few actions
   Every start goes through the SAME admin functions the in-game commands use (raidAdmin, evAdmin, wyrmAdmin), with a stand-in for the
   admin, so the announcements are exactly the ones an admin start makes, and they never say who. */
const ACTS = {
  raid:      ["raid", "", "the Yard raid (the Ice Man)"],
  flood:     ["raid", "flood", "the Flood"],
  skip:      ["raid", "now", "skip the raid's warning"],
  raidend:   ["raid", "end", "end the raid or the Flood"],
  star:      ["ev", "star", "a shooting star"],
  starend:   ["ev", "star end", "end the star"],
  wanted:    ["ev", "wanted", "a Wanted poster"],
  wantedend: ["ev", "wanted end", "end the poster"],
  thief:     ["ev", "thief", "the Jackpot Thief"],
  thiefend:  ["ev", "thief end", "end the thief"],
  wyrm:      ["wyrm", "", "the Ice Wyrm"],
  wyrmdown:  ["wyrm", "down", "send the Wyrm back"],
  king:      ["king", "", "the Pumpkin King"]
};
const WHEN = { now: [0, 0], m10: [10, 10], m30: [30, 30], r60: [5, 60], r120: [10, 120] };   /* minutes: [earliest, latest]; equal = exactly */
export function installChatAct(World, { G }) {
  const P = World.prototype;
  const stand = () => ({ id: "chatview", name: "the chat view", role: "admin", C: { scene: "" }, x: 0, y: 0, out: [] });
  P.chatRun = function (what) {
    const A = ACTS[what]; if (!A) return "That isn't something the chat view can start.";
    let said = ""; const note = (t) => { said = t; }, pl = stand();
    try {
      if (A[0] === "raid") this.raidAdmin(null, pl, A[1], note);
      else if (A[0] === "ev") this.evAdmin(null, pl, A[1], note);
      else if (A[0] === "wyrm") this.wyrmAdmin(null, pl, A[1], note);
      else if (A[0] === "king") {
        if (!G.hwOn?.() || !this.hw) note("The Pumpkin King only rises during the Long Night (October).");
        else { this.hw.kingAt = Date.now() - 1; this.hw.kingDue = false; this.hw.kingUp = null; this.hwSave(); note("The Pumpkin King is due now: he rises the moment somebody is in the Mire."); }
      }
    } catch (e) { console.error("chatRun", what, e); said = `That didn't work: ${e.message}`; }
    (this.chatActs ||= []).push({ t: Date.now(), what: A[2], said });
    this.admLogAdd?.(pl, { cmd: A[0] === "king" ? "hwking" : A[0], arg: A[1] });   /* (v1.1) the admin window's log shows it too, as "the chat view" */
    if (this.chatActs.length > 12) this.chatActs.splice(0, this.chatActs.length - 12);
    return said || "Done.";
  };
  P.chatAct = async function (body) {
    const what = String(body?.what || ""), when = String(body?.when || "now");
    if (body?.cancel) { const was = this.chatPlan; this.chatPlan = null; await this.ctx.storage.delete("chatPlan").catch(() => {}); return { ok: true, said: was ? `Called off: ${ACTS[was.what]?.[2] || was.what}.` : "Nothing was waiting." }; }
    if (!ACTS[what]) return { ok: false, said: "That isn't something the chat view can start." };
    const W = WHEN[when] || WHEN.now;
    if (!W[1]) return { ok: true, said: this.chatRun(what) };
    const mins = W[0] + Math.random() * (W[1] - W[0]), at = Date.now() + Math.round(mins * 60000);
    this.chatPlan = { what, at, random: W[0] !== W[1] }; await this.ctx.storage.put("chatPlan", this.chatPlan).catch(() => {});
    const nm = ACTS[what][2]; return { ok: true, said: `${nm[0].toUpperCase()}${nm.slice(1)} is set${this.chatPlan.random ? " for a moment nobody knows" : ""}.` };
  };
  P.chatPlanTick = function (now) {
    const p = this.chatPlan; if (!p || now < p.at) return;
    this.chatPlan = null; this.ctx.storage.delete("chatPlan").catch(() => {});
    this.chatRun(p.what);
  };
  P.chatActView = function () {
    return { plan: this.chatPlan ? { what: ACTS[this.chatPlan.what]?.[2] || this.chatPlan.what, at: this.chatPlan.at, random: !!this.chatPlan.random } : null,
      acts: (this.chatActs || []).slice(-6).reverse(), list: Object.fromEntries(Object.entries(ACTS).map(([k, a]) => [k, a[2]])) };
  };
}
