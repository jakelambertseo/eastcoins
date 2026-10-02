/* ============================================================ WORK CLOTHES: the server's half (2026-10-01, v1.1). The rules are the WORK CLOTHES section at the end of
   the rules file (WORKSETS, workOn, workXp, workPerk, workNorm): read that first. Off while HOLD.work is on.
     workWear   the "work" message: put an outfit on (one you have at least a piece of), or take it off
     workFind   a piece of a set, into the LOCKER: always one you don't have yet; nothing if you have all four. It says so, and a whole set
                is announced to the room
     workRoll   one line for every place a set drops: `this.workRoll(pl, "feller", 1 / 400)`
     workOnKill the monsters that carry one (farm animals, birds, the Junk King and his yard)
   Each skill's bonus is read where that skill already reads one (tkXp, tkCraft, projGather, tkSalv, fxOf, speedRaw in the rules; the
   harvest, the bed, the catch and the pocket in index.js and thief.js), so nothing here runs on its own. */
const KILL = {
  cow: ["grounds", 1 / 500], boar: ["grounds", 1 / 500], goat: ["grounds", 1 / 500], gardener: ["grounds", 1 / 8], orchardkeeper: ["grounds", 1 / 400],
  gull: ["bowyer", 1 / 500], goose: ["bowyer", 1 / 500], pterodactyl: ["bowyer", 1 / 500], pteroelder: ["bowyer", 1 / 500], snowowl: ["bowyer", 1 / 500], drake: ["bowyer", 1 / 500],
  junkking: ["sal", 1 / 40], junkdog: ["sal", 1 / 400], possum: ["sal", 1 / 400] };
/* (2026-10-02, the owner: the work clothes pass): the quick ones slower, the month-long ones quicker. Was prospector 1/150 on any lap, shortcut or back way (a shortcut hopped back and
   forth made a set in ~20 minutes: laps only now), feller 1/400, kennel 1/600, bronny 1/6, apoth 1/250 (~42 clusters a day: a month); the Junk King 1/10. */
export const WORK_ODDS = { prospector: 1 / 150, feller: 1 / 1000, oilskins: 1 / 300, whites: 1 / 4, kennel: 1 / 1500, bronny: 1 / 3, myco: 1 / 800, apoth: 1 / 40, getaway: 1 / 60 };
export function installWork(World, { G }) {
  const P = World.prototype;
  P.workWear = function (pl, m) {
    if (G.HOLD.work) return;
    const C = pl.C, set = m.set ? String(m.set) : null;
    if (set && !G.WORKSETS[set]) return;
    if (set && !G.workOn({ ...C, work: set }, null)) return this.say(pl, "You haven't found a piece of that set yet.", "bad");
    C.work = set; this.touch(pl);
    if (!set) return this.say(pl, "You take your work clothes off.");
    const S = G.WORKSETS[set], n = G.workOn(C, S.skill);
    return this.say(pl, `You put on ${S.name.replace(/^The /, "the ")} (${n} of 4): +${Math.round(G.workXp(C, S.skill) * 100)}% ${G.SKILLS[S.skill].name} XP${n === 4 ? `, and ${S.full}` : ""}.`, "good");
  };
  P.workFind = function (pl, set, only) {
    if (G.HOLD.work) return null;
    const C = pl.C, S = G.WORKSETS[set]; if (!S) return null;
    const miss = (only || G.workMissing(C, set)).filter((k) => !(C.locker || []).includes(k)); if (!miss.length) return null;
    const k = miss[Math.floor(Math.random() * miss.length)];
    (C.locker ||= []).push(k); if (!C.work) C.work = set; this.touch(pl);
    const n = S.pieces.filter((p) => C.locker.includes(p)).length;
    this.say(pl, `\u{1F9E5} Work clothes! You find the ${G.ITEMS[k].name.toLowerCase()} from ${S.name.replace(/^The /, "the ")} (${n} of 4). It's in your locker: Equipment, then Work clothes.`, "loot");
    if (n === 4) this.houseSay(`\u{1F9E5} ${pl.name} has the whole of ${S.name.replace(/^The /, "the ")}: ${S.full}.`);
    pl.out.push({ type: "workfound", k, set, n });
    this.diaryCheck?.(pl);   /* (2026-10-01) diaries: the work clothes tasks */
    return k;
  };
  P.workRoll = function (pl, set, p) {
    if (G.HOLD.work || !pl?.C || !(Math.random() < p)) return null;
    return this.workFind(pl, set);
  };
  /* DEV SERVER ONLY: "workkit" fills the locker with every piece of every set; "workkit 3" with three of each; "workkit clear" empties it;
     "workkit find <set>" finds one piece of that set exactly as a drop would (the chat line, the card, the announcement at four) */
  P.workKit = function (pl, arg, note) {
    if (this.env?.DEV !== "1") return note("That's for the dev server only.");
    const C = pl.C;
    if (arg === "clear") { C.locker = []; C.work = null; this.touch(pl); return note("Locker emptied."); }
    if (/^find\b/.test(arg)) { const set = arg.split(/\s+/)[1] || "prospector"; if (!G.WORKSETS[set]) return note(`No set called ${set}.`); return this.workFind(pl, set) ? null : note("You have that whole set already."); }   /* one find, the real way */
    const n = Math.max(1, Math.min(4, Number(arg) || 4));
    C.locker = Object.values(G.WORKSETS).flatMap((S) => S.pieces.slice(0, n)); if (!C.work) C.work = "prospector"; this.touch(pl);
    return note(`Locker: ${n} of every set (${C.locker.length} pieces). Equipment, then Work clothes.`);
  };
  P.workOnKill = function (pl, m) {
    const row = KILL[m?.t]; if (row) this.workRoll(pl, row[0], row[1]);
  };
}
