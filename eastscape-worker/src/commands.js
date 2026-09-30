/* ============================================================ CHAT COMMANDS (2026-09-30): the server's half. The list and what each one is for are COMMANDS
   at the end of the rules file; /find's engine is v3/assets/js/eastscape-find.js (pure, from the rules).

   slashCmd(S, pl, text, now) runs from the chat handler AFTER the older commands (/pumpkin, /island, /events, the admin ones) and returns true when
   it answered, so nothing it handles is ever broadcast. A line that starts with "/" and matches nothing is answered too ("no such command")
   rather than sent to everyone: a typo of a command is never public. "!" works as well as "/" for every one of them, as it does for the old ones.
   Cheap on purpose: every answer is read off the rules and the character; the one index (/find's) is built once, on first use. */
import { createFind } from "../../v3/assets/js/eastscape-find.js";
export function installCommands(World, { G }) {
  const P = World.prototype;
  let FIND = null;
  const finder = () => (FIND ||= createFind(G));
  const popup = (pl, title, icon, lines) => pl.out.push({ type: "popup", title, icon, text: lines.filter(Boolean).join("\n\n") });
  const itemOf = (q) => { const hit = finder().match(q).find((c) => c.kind === "item"); return hit ? hit.key : null; };
  const skillOf = (q) => { const n = String(q || "").toLowerCase().trim(); return Object.entries(G.SKILLS).find(([k, s]) => !s.held && (k === n || s.name.toLowerCase() === n || s.name.toLowerCase().startsWith(n)))?.[0] || null; };
  const left = (ms) => { const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`; };

  P.slashCmd = function (S, pl, text, now) {
    const m = text.match(/^[\/!]([a-z?]+)\b\s*(.*)$/i); if (!m) return false;
    const cmd = m[1].toLowerCase(), arg = m[2].trim(), C = pl.C;
    switch (cmd) {
      case "help": case "commands": case "?":
        return popup(pl, "Chat commands", "⌨️", [...G.COMMANDS.filter((c) => (!c.season || G.hwOn?.()) && !(c.c === "/events" && G.HOLD.events)).map((c) => `${c.c}${c.args ? ` [${c.args}]` : ""}${c.also ? ` (or ${c.also.join(", ")})` : ""}: ${c.ex}`), "Only you see the answers, except to /roll. The wiki's Commands page has examples."]), true;
      case "find": case "where": {
        if (!arg) return this.say(pl, "Find what? Try /find ruby, /find rotten tomatoes, /find the yard or /find mining."), true;
        const A = finder().find(arg.slice(0, 40), String(C.scene || "workyard").split(":")[0]);
        if (A.none) return this.say(pl, `Nothing called "${arg.slice(0, 40)}" that I can find.${A.near.length ? ` Did you mean: ${A.near.join(", ")}?` : " Try a shorter name."}`, "bad"), true;
        return popup(pl, A.title, A.icon, A.lines), true;
      }
      case "price": case "worth": {
        const k = itemOf(arg); if (!k) return this.say(pl, arg ? `No item called "${arg.slice(0, 40)}".` : "The price of what? /price ruby", "bad"), true;
        const it = G.ITEMS[k], val = G.valueOf(k), shop = (G.SHOP?.sells || []).find(([x]) => x === k)?.[1];
        const offers = (this.ex?.orders || []).filter((o) => o.open && o.k === k && !(o.f | 0) && o.qty > o.done);
        const ask = offers.filter((o) => o.side === "sell").sort((a, b) => a.price - b.price)[0], bid = offers.filter((o) => o.side === "buy").sort((a, b) => b.price - a.price)[0];
        return popup(pl, `Price: ${it.name}`, it.icon || "\u{1F3AB}", [
          val ? `\u{1F3AB} The Prize Counter pays ${G.fmtTix(val)} each.` : "\u{1F3AB} The Prize Counter doesn't buy it.",
          shop ? `\u{1F6D2} Bom sells it for ${G.fmtTix(G.counterPrice(C, shop))}.` : "",
          ask ? `\u{1F4C8} Cheapest on the Exchange: ${G.fmtTix(ask.price)} each (${(ask.qty - ask.done).toLocaleString()} for sale).` : "\u{1F4C8} Nobody is selling it on the Exchange right now.",
          bid ? `\u{1F4C9} Best offer to buy: ${G.fmtTix(bid.price)} each (${(bid.qty - bid.done).toLocaleString()} wanted).` : "\u{1F4C9} Nobody is asking to buy it right now."]), true;
      }
      case "count": case "have": {
        const k = itemOf(arg); if (!k) return this.say(pl, arg ? `No item called "${arg.slice(0, 40)}".` : "Count what? /count feathers", "bad"), true;
        const inBag = G.countItems(C, [k]), inBank = (C.bank || []).filter((x) => x.k === k).reduce((a, x) => a + (x.n || 1), 0);
        return this.say(pl, `${G.ITEMS[k].name}: ${(inBag + inBank).toLocaleString()} (${inBag.toLocaleString()} in your bag, ${inBank.toLocaleString()} in your bank).`, "good"), true;
      }
      case "xp": case "level": case "lvl": {
        const rows = Object.entries(G.SKILLS).filter(([k, s]) => !s.held && !(k === "thieving" && !G.THIEF?.live)).map(([k, s]) => { const x = C.xp?.[k] || 0, l = G.levelOf(x), next = G.XP_AT[l + 1];
          return { k, name: s.name, l, x, next, pct: next ? Math.floor(((x - G.XP_AT[l]) / (next - G.XP_AT[l])) * 100) : 100 }; });
        if (arg) { const k = skillOf(arg), r = rows.find((q) => q.k === k); if (!r) return this.say(pl, `No skill called "${arg.slice(0, 30)}".`, "bad"), true;
          return this.say(pl, r.next ? `${r.name}: level ${r.l}, ${r.x.toLocaleString()} xp. ${(r.next - r.x).toLocaleString()} xp to level ${r.l + 1} (${r.pct}% of the way).` : `${r.name}: level ${r.l}, the top. ${r.x.toLocaleString()} xp.`, "good"), true; }
        const total = rows.reduce((a, r) => a + r.l, 0), close = rows.filter((r) => r.next).sort((a, b) => b.pct - a.pct)[0];
        return this.say(pl, `Total level ${total} across ${rows.length} skills, Combat ${G.combatOf(C)}.${close ? ` Closest to going up: ${close.name}, ${close.pct}% of the way to ${close.l + 1}.` : ""}`, "good"), true;
      }
      case "timers": case "buffs": {
        const L = [];
        for (const k of ["meal", "drink"]) if (C[k]?.left > 0) L.push(`\u{1F37D}️ ${G.ITEMS[C[k].k]?.name || k}: ${left(C[k].left)} left.`);
        if (C.charm?.left > 0) L.push(`\u{1F4DC} ${G.CHARMS?.[C.charm.k]?.name || "Your page"}: ${left(C.charm.left)} left.`);
        for (const [id, t] of Object.entries(C.tk || {})) if (t.left > 0) L.push(`\u{1F527} ${G.GADGETS?.[id]?.name || id}: ${left(t.left)} left.`);
        if (C.luck > 0) L.push(`\u{1F340} Lucky for your next ${C.luck} kills or catches.`);
        if (this.doubleOn?.()) L.push(`✨ 2X Tickets & Crafting XP (the server's): ${left(this.dbl.until - now)} left.`);
        if (this.skill2xOn?.()) L.push(`⚒️ 2X Skilling XP (the server's): ${left(this.sx2.until - now)} left.`);
        L.push("Your island's timers: /island. Today's world events: /events.");
        return popup(pl, "Your timers", "⏱️", L.length > 1 ? L : ["Nothing of yours is on a clock right now.", ...L]), true;
      }
      case "bosses": case "boss": {
        const L = [];
        for (const [t, d] of Object.entries(G.MOBS)) {
          if (!d.boss || !d.open || d.event || t === "raidchief" || t === "icewyrm" || t === "pumpkinking") continue;
          const home = Object.keys(G.SCENES).find((k) => G.OPEN.has(k) && (G.SCENES[k].mobs || []).some((x) => x[0] === t)); if (!home) continue;
          const Sx = this.scenes.get(home), mm = Sx?.mobs.find((x) => x.t === t);
          L.push(`${mm?.dead ? "⏳" : "\u{1F7E2}"} ${d.name} (level ${d.lvl}), ${G.SCENES[home].name}: ${!mm ? "up" : mm.dead ? `back in ${left(mm.respawnAt - now)}` : `up, ${Math.max(1, Math.round((100 * mm.hp) / (mm.maxHp || d.hp)))}% health`}.`);
        }
        const wy = this.wyrmState?.(now); if (wy) L.push(`❄️ The Ice Wyrm, the Frozen Reach: ${wy.up ? `UP, ${left(wy.leftS * 1000)} left` : wy.due ? "rising now" : "rises once a day, at an hour nobody knows"}.`);
        const rd = this.raidState?.(now); if (rd?.phase) L.push(`❄️ The Ice Man is ${rd.phase === "warn" ? `coming to the Yard in ${left(rd.leftS * 1000)}` : "in the Yard NOW"}.`);
        if (G.hwOn?.()) L.push(`\u{1F383} ${this.hwKingLine(now)}`);
        return popup(pl, "World bosses", "\u{1F451}", L.length ? L : ["No world boss is open right now."]), true;
      }
      case "wiki": return pl.out.push({ type: "ui", open: "wiki", q: arg.slice(0, 40) }), true;
      case "map": return pl.out.push({ type: "ui", open: "map" }), true;
      case "online": case "who": { let active = 0; for (const p of this.pls.values()) if (now - (p.lastInput || now) < 5 * 60000) active++;
        this.say(pl, `${this.pls.size} online, ${active} active.`, "good"); return pl.out.push({ type: "ui", open: "who" }), true; }
      case "roll": case "dice": {
        if (now - (pl.rollAt || 0) < 5000) return this.say(pl, "Give the dice a moment.", "bad"), true; pl.rollAt = now;
        const max = Math.max(2, Math.min(1000000, Math.floor(Number(arg) || 100))), n = 1 + Math.floor(Math.random() * max);
        for (const p of this.playersIn(S)) this.say(p, `\u{1F3B2} ${pl.name} rolls ${n.toLocaleString()} (1 to ${max.toLocaleString()}).`, "good");
        return true;
      }
      case "stuck": case "unstuck": {
        if (now - (pl.stuckAt || 0) < 30000) return this.say(pl, "Give it a moment before trying that again.", "bad"), true;
        if (G.walkableIn(S.g, pl.x, pl.y) && S.g[pl.y][pl.x] !== "e") return this.say(pl, "You're not stuck: you're standing on open ground. Click where you want to go.", "good"), true;
        pl.stuckAt = now; pl.path = []; pl.step = null; pl.act = null; this.placeSafely(S, pl); this.touch(pl);
        return this.say(pl, "You wriggle free onto open ground.", "good"), true;
      }
    }
    if (text[0] === "/") return this.say(pl, `There's no /${cmd.slice(0, 20)} command. /help lists them all.`, "bad"), true;
    return false;
  };
  const f = P.slashCmd; P.slashCmd = function (...a) { try { return f.apply(this, a); } catch (e) { console.error("slashCmd", e); return false; } };
}
