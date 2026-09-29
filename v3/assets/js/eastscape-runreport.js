/* ============================================================ THE RUN REPORT (2026-09-28), the page's half. The owner: "build the after dungeon
   reports on dev server", from the sketch in mockups-archive/eastscape-dungeon-report.html. Lazy: loaded when the first report arrives.
   The numbers are the party meter's run segment, sent by reportRun in eastscape-worker/src/meter.js when a Crypt, Pyramid or Count Room
   run ends (a clear, a wipe, or the Count Room's floor cleared).

   THE ORDER IT READS IN: the result first (did we do it, how long, how close), then the AWARDS (the fun part, and they find something
   for more than the top damage), then YOUR numbers, then the party table (click a heading to sort), then the detail: damage over the run
   with the boss and the deaths marked, your xp by skill, and who went down, to what, with how much food left. On a wipe the deaths lead.
   "Post to chat" puts a one-line summary in chat. Nothing here is saved; the meter can open the last report again. */
export function createRunReport(E) {
  const { G, $, esc, send, SFX } = E, IT = "/v3/assets/img/glad/flat/items/", FLAT = "/v3/assets/img/glad/flat/", UI = FLAT + "ui/";
  const COL = { melee: "#d0463a", archery: "#3f9a4a", magic: "#4a7ad8" };
  let R = null, win = null, sortBy = "dmg";
  const fmt = (n) => Math.round(n || 0).toLocaleString(), fmt1 = (n) => (Math.round((n || 0) * 10) / 10).toFixed(1);
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
  const acc = (r) => (r.swing ? Math.round((r.hit / r.swing) * 100) : null);
  const xpOf = (r) => Object.values(r.xp || {}).reduce((a, b) => a + b, 0);
  const styleIco = (st) => `<img class="rr-st" src="${IT}skill_${st || "melee"}.png" alt="" title="${esc(cap(st))}">`;

  function mount() {
    if (win) return win;
    win = document.createElement("section"); win.className = "win rr-win"; win.id = "runWin"; win.hidden = true; win.setAttribute("aria-label", "Run report");
    win.innerHTML = `<div class="win-head"><b><img src="${UI}p_crypt.png?v=1" alt="" class="topi">Run report</b><small id="rrSub"></small><button type="button" class="win-x" aria-label="Close">×</button></div><div class="win-body" id="rrBody"></div><div class="k-foot rr-foot" id="rrFoot"></div>`;
    ($("jukeWin")?.parentElement || document.querySelector(".game") || document.body).append(win);
    win.querySelector(".win-x").addEventListener("click", () => { SFX.play("ui_close"); win.hidden = true; });
    return win;
  }
  function awards() {
    const rows = R.rows, many = rows.length > 1, out = [], dmgAll = rows.reduce((a, r) => a + r.dmg, 0) || 1;
    const best = (f, ok = () => true) => rows.filter(ok).sort((a, b) => f(b) - f(a))[0];
    const add = (t, icon, r, line) => r && out.push({ t, icon, r, line });
    { const r = best((x) => x.dmg, (x) => x.dmg > 0); add(many ? "MVP" : "Damage", "⭐", r, r && `${fmt(r.dmg)} damage${many ? `, ${Math.round((r.dmg / dmgAll) * 100)}% of the party's` : ""}`); }
    if (R.kb) { const r = rows.find((x) => x.id === R.kb.id); add("Killing Blow", "\u{1F5E1}", r, `finished ${R.kb.boss || R.boss || "it"}`); }
    if ((R.result === "wipe" || R.result === "escaped") && R.log.length) { const last = [...R.log].sort((a, b) => b.t - a.t)[0], r = rows.find((x) => x.id === last.id); if (many) add("Last One Standing", "\u{1F56F}", r, `went down at ${clock(last.t)}`); }
    { const r = best((x) => x.taken, (x) => x.taken > 0); if (many) add("Iron Wall", "\u{1F6E1}", r, r && `took ${fmt(r.taken)} damage`); }
    { const r = best((x) => x.eat, (x) => x.eat > 0); add("Snack King", "\u{1F41F}", r, r && `ate ${r.eat} (+${fmt(r.heal)} HP)`); }
    { const r = best((x) => acc(x) ?? -1, (x) => x.swing >= 5); add("Deadeye", "\u{1F3AF}", r, r && `${acc(r)}% of swings landed`); }
    if (many && R.result !== "wipe" && R.result !== "escaped") { const r = best((x) => -x.taken, (x) => !x.deaths); add("Untouchable", "✨", r, r && (r.taken ? `no deaths, least damage taken (${fmt(r.taken)})` : "no deaths, not a scratch")); }
    return out.slice(0, 6);
  }
  function table() {
    const rows = [...R.rows], dps = (r) => r.dmg / Math.max(1, R.secs), val = (r, k) => (k === "dps" ? dps(r) : k === "xp" ? xpOf(r) : k === "acc" ? acc(r) ?? -1 : r[k] || 0);
    rows.sort((a, b) => val(b, sortBy) - val(a, sortBy) || a.name.localeCompare(b.name));
    const top = Math.max(1, ...R.rows.map((r) => r.dmg)), me = E.you()?.id;
    const COLS = [["dmg", "Damage", "skill_melee"], ["dps", "DPS"], ["taken", "Taken", "skill_defence"], ["heal", "Healed", "clanternfish"], ["eat", "Food"], ["acc", "Hit %"], ["kills", "Kills"], ["deaths", "Deaths"], ["xp", "XP", "skill_hp"]];
    return `<div class="rr-tblwrap"><table class="rr-tbl"><thead><tr><th>Player</th>${COLS.map(([k, l, ic]) => `<th data-sort="${k}"${k === sortBy ? ' aria-sort="descending"' : ""}>${ic ? `<img src="${IT}${ic}.png" alt="">` : ""}${l}</th>`).join("")}</tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.id === me ? "me" : ""}"><td><span class="rr-who">${styleIco(r.style)}<span><b>${esc(r.name)}</b><small><i class="rr-dot" style="background:${COL[r.style] || COL.melee}"></i>${esc(cap(r.style))}${r.id === me ? " · you" : ""}</small></span></span></td>
        <td class="rr-dmg" style="--c:${COL[r.style] || COL.melee}">${fmt(r.dmg)}<i><u style="width:${(r.dmg / top) * 100}%"></u></i></td><td>${fmt1(dps(r))}</td><td>${fmt(r.taken)}</td><td class="good">${r.heal ? `+${fmt(r.heal)}` : "–"}</td>
        <td><span class="rr-food">${Object.entries(r.eats || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `<img src="${IT}${k}.png" alt="" title="${esc(G.ITEMS[k]?.name || k)}">${n}`).join(" ") || "–"}</span></td>
        <td>${acc(r) == null ? "–" : `${acc(r)}%`}</td><td>${r.kills || "–"}</td><td class="${r.deaths ? "" : "muted"}">${r.deaths || "–"}</td><td>${xpOf(r) ? `+${fmt(xpOf(r))}` : "–"}</td></tr>`).join("")}
    </tbody></table></div>`;
  }
  function chart() {
    const W = 520, H = 150, n = Math.max(2, Math.ceil(R.secs / (R.tlMs / 1000))), rows = R.rows.filter((r) => r.dmg > 0);
    if (!rows.length) return `<p class="rr-none">No damage to draw.</p>`;
    const ser = rows.map((r) => Array.from({ length: n }, (_, i) => r.tl?.[i] || 0)), max = Math.max(1, ...ser.flat());
    const x = (i) => (i / (n - 1)) * (W - 10) + 5, y = (v) => H - 14 - (v / max) * (H - 28), tx = (s) => x(Math.min(n - 1, s / (R.tlMs / 1000)));
    const band = R.bossAt != null ? `<rect x="${tx(R.bossAt)}" y="0" width="${Math.max(2, W - 5 - tx(R.bossAt))}" height="${H - 14}" fill="rgba(184,48,42,.1)"/><text x="${tx(R.bossAt) + 4}" y="11" font-size="10" font-weight="800" fill="#b8302a" font-family="Lora">${esc(R.boss || "Boss")}</text>` : "";
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => `<text x="${5 + f * (W - 36)}" y="${H - 2}" font-size="10" fill="#9a8866" font-family="Lora" font-weight="700">${clock(f * R.secs)}</text>`).join("");
    const lines = ser.map((s, i) => `<polyline fill="none" stroke="${COL[rows[i].style] || COL.melee}" stroke-width="${rows[i].id === E.you()?.id ? 3 : 2}"${rows.slice(0, i).some((q) => q.style === rows[i].style) ? ' stroke-dasharray="5 3"' : ""} stroke-linejoin="round" points="${s.map((v, j) => `${x(j)},${y(v)}`).join(" ")}"/>`).join("");
    const skulls = R.log.map((d) => `<text x="${tx(d.t) - 6}" y="${H - 18}" font-size="12">\u{1F480}</text>`).join("");
    return `<svg class="rr-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${band}<line x1="0" x2="${W}" y1="${H - 14}" y2="${H - 14}" stroke="rgba(90,58,24,.3)"/>${ticks}${lines}${skulls}</svg>
      <div class="rr-legend">${rows.map((r) => `<span><i class="rr-dot" style="background:${COL[r.style] || COL.melee}"></i>${esc(r.name)}</span>`).join("")}${R.log.length ? "<span>\u{1F480} a death</span>" : ""}</div>`;
  }
  const deathsCard = () => `<div class="rr-card"><h4><span>${R.result === "wipe" ? "Who went down" : "Deaths"}</span><span>food left when it happened</span></h4><div class="rr-deaths">${R.log.length ? [...R.log].sort((a, b) => a.t - b.t).map((d) => `<div><span class="t">${clock(d.t)}</span><b>${esc(d.name)}</b>${d.cause ? ` to ${esc(d.cause)}` : ""}<span class="k-chip">${d.food} food left</span></div>`).join("") : `<p class="rr-none">Nobody went down.</p>`}</div></div>`;

  function render() {
    mount();
    /* (2026-09-28) a WORLD BOSS (kind "boss": the Pumpkin King) reads the same, with his own words: he falls or he gets away, and the
       people in it are everybody who fought him, not a party */
    const boss = R.kind === "boss", me = R.rows.find((r) => r.id === E.you()?.id) || R.rows[0], wipe = R.result === "wipe" || R.result === "escaped", many = R.rows.length > 1;
    const crowd = boss ? `${R.rows.length} fought` : `party of ${R.rows.length}`;
    const food = R.rows.reduce((a, r) => a + (r.eat || 0), 0), deaths = R.log.length;
    const headline = boss ? (wipe ? `${R.boss} got away` : `${R.boss} falls!`) : wipe ? `Wiped in ${R.title}` : R.kind === "count" ? "Job done!" : "Cleared!";
    const newBest = !wipe && R.best != null && R.secs < R.best;
    $("rrSub").textContent = `${R.title}${many || boss ? ` · ${crowd}` : ""}`;
    const mine = Object.entries(me?.xp || {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    $("rrBody").innerHTML = `
      <div class="rr-hero${wipe ? " wipe" : ""}"><span class="rr-crest"><img src="${R.bossArt ? `${FLAT}${R.bossArt}.png` : `${UI}p_crypt.png?v=1`}" alt=""></span>
        <span class="rr-htxt"><h3>${boss ? "WORLD BOSS" : esc(R.title.toUpperCase())}${many || boss ? ` · ${crowd.toUpperCase()}` : ""}</h3><h2>${esc(headline)}</h2>
          <span class="rr-facts">${wipe ? `${R.boss && R.bossLeft != null ? `<span class="k-chip">${esc(R.boss)} at ${R.bossLeft}%</span>` : ""}<span class="k-chip">⏱ ${clock(R.secs)} in</span>` : `<span class="k-chip">⏱ ${clock(R.secs)}${R.best != null && !newBest ? ` (best ${clock(R.best)})` : ""}</span>`}
            <span class="k-chip">\u{1F480} ${deaths} death${deaths === 1 ? "" : "s"}</span><span class="k-chip">\u{1F41F} ${food} eaten</span>${newBest ? `<span class="k-chip rr-best">New best time!</span>` : ""}</span></span>
        <span class="rr-badge">${wipe ? (R.bossLeft != null ? `${100 - R.bossLeft}%<small>OF THE WAY</small>` : `\u{1F480}<small>WIPED</small>`) : `${clock(R.secs)}<small>${newBest ? "NEW BEST" : "CLEAR TIME"}</small>`}</span></div>
      <div class="rr-pad">
        ${wipe ? deathsCard() : ""}
        <div class="k-sect"><span class="k-label">Awards</span></div>
        <div class="rr-awards">${awards().map((a) => `<div class="rr-award"><span class="rr-medal">${a.icon}</span><span><b>${a.t}</b><span>${esc(a.r.name)}</span><small>${esc(a.line || "")}</small></span></div>`).join("") || `<p class="rr-none">No awards this time.</p>`}</div>
        <div class="k-sect"><span class="k-label">Your run</span></div>
        <div class="rr-me"><div><b>${fmt(me?.dmg)}</b><small>Damage</small></div><div><b>${fmt1((me?.dmg || 0) / Math.max(1, R.secs))}</b><small>DPS</small></div><div><b>${fmt(me?.taken)}</b><small>Taken</small></div><div><b>${me?.eat || 0}</b><small>Food eaten</small></div><div><b>${acc(me || {}) == null ? "–" : acc(me) + "%"}</b><small>Hit %</small></div></div>
        ${many ? `<div class="k-sect"><span class="k-label">${boss ? "Everybody who fought" : "The party"} · click a heading to sort</span></div>${table()}` : ""}
        <div class="rr-two">
          <div class="rr-card"><h4><span>Damage over the run</span><span>per ${Math.round(R.tlMs / 1000)} seconds</span></h4>${chart()}</div>
          <div class="rr-card"><h4><span>Your xp</span><span>+${fmt(mine.reduce((a, [, n]) => a + n, 0))}</span></h4><div class="rr-xp">${mine.length ? mine.slice(0, 5).map(([k, n]) => `<div><img src="${IT}skill_${k}.png" alt=""><b>${esc(G.SKILLS[k]?.name || cap(k))}</b><small>+${fmt(n)}</small></div>`).join("") : `<p class="rr-none">None this run.</p>`}</div></div>
        </div>
        ${wipe ? "" : deathsCard()}
      </div>`;
    $("rrFoot").innerHTML = `<span class="k-note">${boss ? (wipe ? "He'll be back. So will you." : "Well fought. He rises again next hour.") : wipe ? "Regroup, eat, and go again." : R.kind === "count" ? "The boxes are still down there, and the way out is open." : "Your share is in the chest. The way out is back where you came in."}</span><button type="button" class="k-btn sec" id="rrPost">Post to chat</button><button type="button" class="k-btn" id="rrClose">Close</button>`;
    $("rrBody").querySelectorAll("[data-sort]").forEach((th) => th.addEventListener("click", () => { sortBy = th.dataset.sort; SFX.play("ui_click"); render(); }));
    $("rrClose").addEventListener("click", () => { SFX.play("ui_close"); win.hidden = true; });
    $("rrPost").addEventListener("click", (ev) => {
      const top = [...R.rows].sort((a, b) => b.dmg - a.dmg)[0], all = R.rows.reduce((a, r) => a + r.dmg, 0) || 1;
      const line = boss ? (wipe ? `\u{1F383} ${R.boss} got away at ${R.bossLeft ?? "?"}% after ${clock(R.secs)}. ${R.rows.length} fought.${top ? ` Top damage: ${top.name}.` : ""}`
          : `\u{1F383} ${R.boss} fell in ${clock(R.secs)}! ${R.rows.length} fought.${top ? ` MVP: ${top.name} (${Math.round((top.dmg / all) * 100)}% of the damage).` : ""}${R.kb ? ` Killing blow: ${R.kb.name}.` : ""}`)
        : wipe ? `\u{1F480} Wiped in ${R.title} at ${clock(R.secs)}${R.bossLeft != null ? `, ${R.boss} at ${R.bossLeft}%` : ""}.${many && top ? ` Top damage: ${top.name}.` : ""}`
        : `\u{1F5DD}️ ${R.title} ${R.kind === "count" ? "done" : "cleared"} in ${clock(R.secs)}${newBest ? " (new best!)" : ""}.${many && top ? ` MVP: ${top.name} (${Math.round((top.dmg / all) * 100)}% of the damage).` : ""} ${deaths} death${deaths === 1 ? "" : "s"}, ${food} fish eaten.`;
      send({ t: "chat", text: line }); ev.currentTarget.disabled = true; ev.currentTarget.textContent = "Posted"; SFX.play("ui_click");
    });
  }
  return {
    got(r, again) { R = r; sortBy = "dmg"; mount(); render(); win.hidden = false; if (!again) SFX.play(r.result === "wipe" ? "lose" : "task_done"); },
    has: () => !!R,
    open() { if (!R) return; mount(); render(); win.hidden = false; }
  };
}

export const CSS = `
/* ---------- (2026-09-28) THE RUN REPORT ---------- */
.rr-win{width:min(900px,calc(100% - 20px))}
.rr-win .win-body{padding:0;overflow:auto;min-height:0}
.rr-hero{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;padding:16px 18px 14px;background:radial-gradient(120% 160% at 15% 0%,#3a2a4a 0%,#1e1426 60%,#140c1a 100%);color:#f6e9cc;box-shadow:inset 0 -2px 0 #e8bf35}
.rr-crest{width:72px;height:72px;border-radius:12px;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 35%,#5a3a6a,#1e1426);box-shadow:0 0 0 2px #e8bf35,0 0 18px rgba(255,200,60,.35)}.rr-crest img{width:72px;height:72px;object-fit:none;object-position:50% 12%;image-rendering:pixelated}   /* the boss at its own size, head and shoulders: never scaled, so never blurred */
.rr-htxt{min-width:0}.rr-htxt h3{margin:0;font:900 12px var(--k-disp,Cinzel),serif;letter-spacing:.14em;color:#e0c890}
.rr-htxt h2{margin:2px 0 6px;font:900 28px/1.05 var(--k-disp,Cinzel),serif;color:#ffd84a;text-shadow:0 2px 0 #4a2a04,0 0 18px rgba(255,200,60,.4)}.rr-hero.wipe h2{color:#ff8a70;text-shadow:0 2px 0 #3a0c04}
.rr-facts{display:flex;gap:6px;flex-wrap:wrap}.rr-facts .k-chip{background:rgba(255,235,190,.1);color:#f3e2bd;box-shadow:inset 0 0 0 1px rgba(255,215,140,.3)}.rr-facts .rr-best{color:#7dff8a;box-shadow:inset 0 0 0 1px rgba(125,255,138,.5)}
.rr-badge{display:grid;place-items:center;align-content:center;width:86px;height:86px;border-radius:50%;background:radial-gradient(circle at 40% 30%,#fff3b0,#e8a824 60%,#8a5a0a);box-shadow:0 0 0 3px #5a3a08,0 0 24px rgba(255,200,60,.55);color:#3a2000;font:900 20px var(--k-disp,Cinzel),serif;text-shadow:0 1px 0 rgba(255,255,255,.5)}
.rr-badge small{font:900 8.5px Lora,serif;letter-spacing:.1em;margin-top:2px}.rr-hero.wipe .rr-badge{background:radial-gradient(circle at 40% 30%,#ffd6c8,#c85a3a 60%,#5a1a0a)}
.rr-pad{padding:12px 14px;display:grid;gap:10px}
.rr-awards{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
.rr-award{display:grid;grid-template-columns:40px 1fr;gap:10px;align-items:center;padding:9px 10px;border-radius:var(--k-r,6px);background:linear-gradient(#fff3d0,#f0dca8);box-shadow:inset 0 0 0 1.5px var(--k-gold,#c8963a),0 2px 0 rgba(122,78,14,.25)}
.rr-medal{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 40% 30%,#fff3b0,#e8bf35);box-shadow:0 0 0 2px #7a4e0e;font-size:20px}
.rr-award b{display:block;font:900 13px var(--k-disp,Cinzel),serif;color:var(--k-gold-ink,#7a4e0e)}.rr-award span span{display:block;font:800 14px Lora,serif;color:var(--k-ink)}.rr-award small{font:700 12px Lora,serif;color:var(--k-ink2)}
.rr-me{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}.rr-me div{padding:8px;border-radius:var(--k-r,6px);background:#2a1c12;color:#f0e0c0;text-align:center}.rr-me b{display:block;font:900 19px var(--k-disp,Cinzel),serif;color:#ffd84a}.rr-me small{font:800 10px Lora,serif;letter-spacing:.08em;text-transform:uppercase;color:#bfa77c}
.rr-tblwrap{overflow-x:auto}
.rr-tbl{width:100%;border-collapse:separate;border-spacing:0 4px;font-variant-numeric:tabular-nums}
.rr-tbl th{padding:0 7px 2px;text-align:right;font:800 10.5px Lora,serif;letter-spacing:.06em;text-transform:uppercase;color:var(--k-ink2);white-space:nowrap;cursor:pointer}.rr-tbl th:first-child{text-align:left;cursor:default}.rr-tbl th[aria-sort]{color:var(--k-ink)}.rr-tbl th[aria-sort]::after{content:" \\25BE"}
.rr-tbl th img{width:14px;height:14px;vertical-align:-2px;margin-right:3px;image-rendering:pixelated}
.rr-tbl td{padding:7px;background:var(--k-card);text-align:right;font:800 13.5px Lora,serif;white-space:nowrap}.rr-tbl tr td:first-child{border-radius:var(--k-r,6px) 0 0 var(--k-r,6px);text-align:left}.rr-tbl tr td:last-child{border-radius:0 var(--k-r,6px) var(--k-r,6px) 0}
.rr-tbl tr.me td{background:#f6e6b8;box-shadow:inset 0 1.5px 0 var(--k-gold,#c8963a),inset 0 -1.5px 0 var(--k-gold,#c8963a)}
.rr-tbl td.good{color:var(--k-good)}.rr-tbl td.muted{color:var(--k-ink3)}
.rr-who{display:flex;align-items:center;gap:8px}.rr-st{width:24px;height:24px;image-rendering:pixelated}.rr-who b{font:800 14px var(--k-disp,Cinzel),serif}.rr-who small{display:block;font:700 11px Lora,serif;color:var(--k-ink2)}
.rr-dot{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:4px;vertical-align:0}
.rr-dmg{position:relative;min-width:130px}.rr-dmg i{position:absolute;left:7px;right:7px;bottom:4px;height:4px;border-radius:2px;background:rgba(90,58,24,.12)}.rr-dmg i u{display:block;height:100%;border-radius:2px;background:var(--c)}
.rr-food{display:inline-flex;gap:3px;align-items:center}.rr-food img{width:16px;height:16px;image-rendering:pixelated}
.rr-two{display:grid;grid-template-columns:1.4fr 1fr;gap:10px}
.rr-card{padding:10px 12px;border-radius:var(--k-r,6px);background:var(--k-card);box-shadow:inset 0 0 0 1.5px var(--k-card-line)}
.rr-card h4{margin:0 0 6px;display:flex;justify-content:space-between;gap:8px;font:800 10.5px Lora,serif;letter-spacing:.08em;text-transform:uppercase;color:var(--k-ink2)}
.rr-chart{width:100%;height:150px;display:block}.rr-legend{display:flex;gap:10px;flex-wrap:wrap;font:700 12px Lora,serif;color:var(--k-ink2);margin-top:4px}
.rr-xp{display:grid;gap:6px}.rr-xp div{display:grid;grid-template-columns:24px 1fr auto;gap:8px;align-items:center}.rr-xp img{width:22px;height:22px;image-rendering:pixelated}.rr-xp b{font:800 13px Lora,serif}.rr-xp small{font:800 12px Lora,serif;color:var(--k-good)}
.rr-deaths{display:grid;gap:4px;font:600 13px Lora,serif}.rr-deaths div{display:flex;gap:8px;align-items:center}.rr-deaths .t{font:800 11px Lora,serif;color:var(--k-ink3);width:38px}.rr-deaths .k-chip{margin-left:auto}
.rr-none{margin:4px 2px;color:var(--k-ink3);font:italic 600 12.5px Lora,serif}
.rr-foot{margin:0}.rr-foot .k-note{flex:1 1 auto;min-width:0}
@media (max-width:700px){.rr-hero{grid-template-columns:auto 1fr;padding:12px}.rr-badge{display:none}.rr-htxt h2{font-size:21px}.rr-two{grid-template-columns:1fr}.rr-me{grid-template-columns:repeat(3,1fr)}.rr-awards{grid-template-columns:1fr 1fr}.rr-foot .k-note{display:none}}
`;
