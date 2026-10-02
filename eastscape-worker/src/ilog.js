/* ============================================================ THE ITEM LOG (2026-10-02). The owner, after a player's pickaxe went missing: "yes build that in admin.
   also add a log to the chat for users beside the Chat/XP Drops buttons with a 'Log' button". Every time something leaves your bag (or a piece of
   gear moves), one line: dropped, lost to a death, a hospital bill, sold, traded, put on the Exchange, broken at the anvil, banked or taken out. Kept
   on the character (C.ilog, the last ILOG.max lines, oldest first), so it survives a restart and the admin card can read it for someone offline.
     ilog(pl, kind, k, n, note)   write one line (and, to anyone online, push it so an open Log shows it at once)
     ilogSend(pl)                 the whole log, when the Log tab opens
   The words are G.ilogText, shared with the admin window, so a line reads the same in both places.
   INSTALL IT LAST: it wraps bankAdd (every deposit, a full bag's rare included), trkSold (every sale at Bom and Brutus) and trkDeath (a death's
   dropped piece and the Wild's ticket loss), so those are logged wherever they are called from. */
export function installIlog(World, { G }) {
  const P = World.prototype;
  P.ilog = function (pl, kind, k, n = 1, note = "") {
    const C = pl?.C; if (!C || !k) return;
    const e = [Date.now(), kind, k, Math.max(1, Math.round(Number(n) || 1)), note ? String(note).slice(0, 60) : ""];
    const L = (C.ilog ||= []); L.push(e); if (L.length > G.ILOG.max) L.splice(0, L.length - G.ILOG.max);
    if (pl.out && this.pls?.get?.(pl.id) === pl) pl.out.push({ type: "ilog1", e });
  };
  P.ilogSend = function (pl) { pl.out.push({ type: "ilog", list: pl.C.ilog || [] }); };
  const safe = (fn) => function (...a) { try { return fn.apply(this, a); } catch (e) { console.error("ilog", e); } };
  P.ilog = safe(P.ilog); P.ilogSend = safe(P.ilogSend);
  /* gear and tools into the bank (not every log and fish: the log is for "where did my thing go") */
  const bankAdd = P.bankAdd;
  P.bankAdd = function (pl, k, n, f = 0, p = 0) { const ok = bankAdd.call(this, pl, k, n, f, p); if (ok && G.ITEMS[k]?.slot) this.ilog(pl, "banked", k, n); return ok; };
  const trkSold = P.trkSold;
  if (trkSold) P.trkSold = function (pl, k, n, tix) { trkSold.call(this, pl, k, n, tix); this.ilog(pl, "sold", k, n, tix > 0 ? G.fmtTix(tix) : ""); };
  const trkDeath = P.trkDeath;
  if (trkDeath) P.trkDeath = function (pl, S, killer, pk, lost, took) {
    trkDeath.call(this, pl, S, killer, pk, lost, took);
    const where = S?.def?.name || "";
    if (lost) this.ilog(pl, "lost", lost, 1, where);
    if (took > 0) this.ilog(pl, pk ? "robbed" : "bill", "tickets", took, pk ? pk.name : where);
  };
}
