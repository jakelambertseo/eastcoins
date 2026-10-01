/* The admin panel, reorganised (2026-10-01, the owner: "after we're completely done with agility and thieving for v1.1, can you work on the
   admin panel? the UI is a bit overwhemling now with how much stuff we've added. take a look at it and consider how it can be organized, easy
   use of features, what can be added/removed"). A MOCKUP run inside the real page on the dev server, like the Character window's: a proper
   window built only from the game's own classes (.win.k-win, .k-head, .k-tabs, .k-body, .k-seg, .k-btn, .k-chip, .k-note), three tabs, the
   live numbers read from the page where it has them. Buttons are drawn, not wired: nothing is sent to the server. Load it with:
     (0,eval)(await (await fetch('/tools/adminpanel-mock/inject.js?'+Date.now())).text()); window.__adm.open("live") */
(() => {
  const $ = (id) => document.getElementById(id), E = window.__es, G = E.G || null;
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const UI = (k) => `/v3/assets/img/glad/flat/ui/${k}.png?v=1`, IT = (k) => `/v3/assets/img/glad/flat/items/${k}.png`;
  if (!$("admCss")) { const st = document.createElement("style"); st.id = "admCss"; st.textContent = `
#admWin{position:absolute;inset:14px;margin:auto;width:min(920px,calc(100% - 28px));height:min(680px,calc(100% - 28px));z-index:9}
#admWin .k-body{overflow:auto}
.adm-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:0 0 4px}
.adm-strip span{display:grid;gap:1px;padding:6px 8px;border-radius:9px;background:rgba(255,250,240,.7);box-shadow:0 1px 3px rgba(60,40,10,.12);font:700 11px Lora,serif;color:#6a5a40;min-width:0}
.adm-strip b{font:800 15px Cinzel,serif;color:#3a2210;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adm-strip span.on{background:#e8f6e0;box-shadow:inset 0 0 0 2px #5aa04a}.adm-strip span.on b{color:#2a6a1a}
.adm-h{margin:10px 0 2px;font:800 12px Lora,serif;letter-spacing:.08em;text-transform:uppercase;color:#8a6a3a;display:flex;align-items:center;gap:8px}.adm-h small{font:600 11.5px Lora,serif;letter-spacing:0;text-transform:none;color:#8a7a5a}
.adm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px}
.adm-card{display:grid;grid-template-columns:34px 1fr;gap:4px 10px;align-items:center;padding:9px 10px;border-radius:12px;background:rgba(255,250,240,.75);box-shadow:0 1px 4px rgba(60,40,10,.14)}
.adm-card>img{width:30px;height:30px;image-rendering:pixelated;grid-row:1/span 2}.adm-card b{font:800 13.5px Cinzel,serif;color:#3a2210}.adm-card b small{display:block;font:700 11px Lora,serif;color:#7a6a4a;letter-spacing:0}
.adm-card .acts{grid-column:1/-1;display:flex;gap:5px;flex-wrap:wrap;align-items:center}.adm-card.live{box-shadow:inset 0 0 0 2px #5aa04a,0 1px 4px rgba(60,40,10,.14);background:#eef8e8}
.adm-card .k-chip.go{background:#2a6a1a;color:#e8ffd8}.adm-card .k-chip.off{background:rgba(90,58,24,.12)}
.adm-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.adm-row input,.adm-row select{font:700 13px Lora,serif;padding:6px 8px;border-radius:8px;border:2px solid #c9b48a;background:#fffaf0;color:#3a2210;min-width:0}
.adm-btn{border:0;padding:6px 11px;border-radius:8px;background:#5a3220;color:#ffe9b0;font:800 12.5px Lora,serif;cursor:pointer;box-shadow:0 2px 0 #2a1408}.adm-btn.sec{background:#e9dcc0;color:#4a2a12;box-shadow:0 2px 0 #b8a07a}.adm-btn.warn{background:#b8402a;color:#fff0e0;box-shadow:0 2px 0 #6a1a0a}
.adm-who{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:10px}@media (max-width:760px){.adm-who{grid-template-columns:1fr}}
.adm-list{display:grid;gap:4px;align-content:start}.adm-list button{display:grid;grid-template-columns:1fr auto;gap:8px;padding:7px 10px;border:0;border-radius:9px;background:rgba(255,250,240,.7);text-align:left;font:700 12.5px Lora,serif;color:#3a2210;cursor:pointer}.adm-list button[aria-pressed=true]{background:#5a3220;color:#ffe9b0}
.adm-list button small{font:700 11px Lora,serif;opacity:.75}
.adm-pc{padding:12px;border-radius:12px;background:rgba(255,250,240,.8);box-shadow:0 1px 4px rgba(60,40,10,.14);display:grid;gap:8px;align-content:start}
.adm-pc header{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.adm-pc header b{font:800 18px Cinzel,serif;color:#3a2210}
.adm-kv{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.adm-kv span{display:grid;padding:6px 8px;border-radius:8px;background:#f4ead4;font:700 10.5px Lora,serif;color:#7a6a4a}.adm-kv b{font:800 14px Cinzel,serif;color:#3a2210}
.adm-log{display:grid;gap:3px;font:600 12px Lora,serif;color:#5a4a30}.adm-log div{display:grid;grid-template-columns:52px 110px 1fr;gap:8px;padding:4px 8px;border-radius:7px;background:rgba(255,250,240,.55)}.adm-log b{color:#3a2210}
.adm-mine{padding:8px 10px;border-radius:10px;background:#fff3d6;box-shadow:inset 0 0 0 2px #e0b25a;font:700 12.5px Lora,serif;color:#6a4a10}
.adm-cols{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:8px}
.adm-box{padding:10px;border-radius:12px;background:rgba(255,250,240,.75);box-shadow:0 1px 4px rgba(60,40,10,.14);display:grid;gap:6px;align-content:start}.adm-box>b{font:800 13.5px Cinzel,serif;color:#3a2210;display:flex;gap:8px;align-items:center}.adm-box>b img{width:20px;height:20px;image-rendering:pixelated}
`; document.head.append(st); }

  const online = (() => { const t = document.body.innerText.match(/(\d+)\s+online/); return t ? +t[1] : 1; })();
  const me = E.me, login = E.you?.login || "admin";
  const card = (img, name, sub, acts, live) => `<div class="adm-card${live ? " live" : ""}"><img src="${img}" alt=""><b>${name}<small>${sub}</small></b><div class="acts">${acts}</div></div>`;
  const btn = (t, cls = "") => `<button type="button" class="adm-btn ${cls}">${t}</button>`;
  const chip = (t, on) => `<span class="k-chip ${on ? "go" : "off"}">${t}</span>`;

  const TABS = {
    live: () => `
      <div class="adm-strip">
        <span><b>${online}</b>online now</span>
        <span class="on"><b>2X · 18:42</b>tickets & crafting</span>
        <span><b>off</b>2X skilling</span>
        <span><b>none</b>raid / flood</span>
        <span><b>14:20</b>next star</span>
        <span><b>none</b>restart</span>
      </div>
      <div class="adm-h">Boosts <small>for everyone on the server · each asks "are you sure?" first</small></div>
      <div class="adm-grid">
        ${card(UI("g_vip"), "2X Tickets & Crafting", "18:42 left · started by you", `${chip("running", 1)}<select><option>+30 min</option><option>+60 min</option></select>${btn("Add time", "sec")}${btn("Stop", "warn")}`, 1)}
        ${card(UI("g_updates"), "2X Skilling XP", "every non-combat skill", `${chip("off")}<select><option>30 min</option><option>60 min</option><option>120 min</option></select>${btn("Start")}`)}
      </div>
      <div class="adm-h">World events <small>one of each a day on their own; start one now if the server's quiet</small></div>
      <div class="adm-grid">
        ${card(IT("stardust"), "Shooting Star", "next at 14:20 · lands where the map allows", `${btn("Now")}${btn("End", "sec")}`)}
        ${card(UI("g_events"), "Wanted!", "today's poster: done at 11:05", `${btn("Now")}${btn("End", "sec")}`)}
        ${card(IT("tickets"), "The Jackpot Thief", "next at 19:00", `${btn("Now")}${btn("End", "sec")}`)}
        ${card(UI("g_raid"), "Yard raid", "Hrimgar's war party · 5 online needed", `${btn("Start")}${btn("Skip warning", "sec")}${btn("End", "sec")}${btn("Reopen stalls", "sec")}`)}
        ${card(UI("g_fishing"), "The Flood", "the river over the bank", `${btn("Start")}${btn("Skip warning", "sec")}${btn("End", "sec")}`)}
        ${card(UI("g_magic"), "Ice Wyrm", "the Frozen Reach's daily boss", `${btn("Rise now")}${btn("Send away", "sec")}`)}
      </div>
      <div class="adm-row" style="margin-top:6px">${btn("Today's plan", "sec")}<span class="k-note">every event's time today, in one list</span></div>
      <div class="adm-h">The server</div>
      <div class="adm-grid">
        ${card(UI("g_home"), "Save everyone", "every character and the Exchange, written now", btn("Save now"))}
        ${card(UI("settings"), "Restart", "counts down, saves, then drops everyone with a 'restarting' line", `<select><option>in 2 min</option><option>in 5 min</option><option>in 10 min</option></select>${btn("Announce")}${btn("Cancel", "sec")}`)}
        ${card(UI("skills"), "World data", "what the server records: 1 / 7 / 14 / 30 days", btn("Open →", "sec"))}
      </div>
      <div class="adm-h">Recent admin actions <small>who did what, so four admins don't trip over each other</small></div>
      <div class="adm-log">
        <div><b>12:41</b><span>${esc(login)}</span>started 2X Tickets & Crafting, 30 min</div>
        <div><b>11:58</b><span>bootypaper</span>muted Spammer99 for 10 min</div>
        <div><b>09:12</b><span>zwades</span>ended the Flood</div>
      </div>`,
    players: () => `
      <div class="adm-row"><input placeholder="Find a player: name, online or not" style="flex:1"></div>
      <div class="adm-who">
        <div class="adm-list">
          <div class="adm-h">Online now <small>${online}</small></div>
          <button>${esc(login)} <small>the Gloam · combat ${me ? G?.combatOf?.(me) ?? "" : ""}</small></button>
          <button aria-pressed="true">dookiebetts800 <small>the Carnival · 2h 10m</small></button>
          <button>kunabafoona <small>the Thunderhead · 48m</small></button>
          <button>Calvinthesneak <small>the casino floor · 12m</small></button>
          <div class="adm-h">Recent player kills</div>
          <div class="adm-log"><div><b>12:30</b><span>Smeagx</span>killed itstypho in the Wild (took 4,200)</div></div>
        </div>
        <div class="adm-pc">
          <header><b>dookiebetts800</b>${chip("online", 1)}<span class="k-chip">the Carnival</span><span class="k-chip">combat 88</span></header>
          <div class="adm-kv"><span><b>106 h</b>played</span><span><b>327k</b>tickets held</span><span><b>1,412</b>total level</span><span><b>today</b>last seen</span></div>
          <div class="adm-h">Look after them</div>
          <div class="adm-row">${btn("Go to them", "sec")}${btn("Their stats", "sec")}${btn("Refund Bom gear…", "sec")}</div>
          <div class="adm-h">Moderate</div>
          <div class="adm-row"><select><option>10 min</option><option>30 min</option><option>1 hour</option><option>4 hours</option></select>${btn("Mute")}${btn("Unmute", "sec")}${btn("Kick off", "warn")}<span class="k-note">a kick saves them first: nobody loses what they carried</span></div>
          <div class="adm-h">Bom gear they could get back</div>
          <div class="adm-log"><div><b>2×</b><span>Onyx cuirass</span>bought 10:14 · 1,280 each</div><div><b>1×</b><span>Onyx helm</span>bought 10:15 · 640</div></div>
        </div>
      </div>`,
    test: () => `
      <div class="adm-mine">Everything on this tab changes <b>your own character</b> only. Admins only; moderators don't see it.</div>
      <div class="adm-cols">
        <div class="adm-box"><b><img src="${UI("skills")}" alt="">Skills</b>
          <div class="adm-row"><select style="flex:1"><option>Agility</option><option>Thieving</option><option>Melee</option></select><input type="number" value="99" style="width:64px">${btn("Set level")}</div>
          <div class="adm-row"><input type="number" value="10000" style="width:96px">${btn("Give XP", "sec")}${btn("Clear skill", "sec")}${btn("Clear all", "warn")}</div></div>
        <div class="adm-box"><b><img src="${UI("g_vip")}" alt="">Items</b>
          <div class="adm-row"><input placeholder="Search: 'lockpick', 'onyx'…" style="flex:1"><input type="number" value="1" style="width:64px">${btn("Give")}</div>
          <div class="adm-row">${btn("Clear inventory", "warn")}${btn("A 2X potion", "sec")}${btn("Reset Store upgrades", "sec")}</div></div>
        <div class="adm-box"><b><img src="${UI("map")}" alt="">Go to</b>
          <div class="adm-row"><input placeholder="Search maps…" style="flex:1">${btn("Teleport")}</div>
          <div class="adm-row"><select style="flex:1"><option>Shortcut: the Gloam · Fallen log · 10</option><option>Back way: the Storm Drain · 61</option></select>${btn("Go", "sec")}</div>
          <span class="k-note">shortcuts and back ways show while they're held (dev, ?open=1)</span></div>
        <div class="adm-box"><b><img src="${UI("combat")}" alt="">Me</b>
          <div class="adm-row">${btn("Heal", "sec")}${btn("God mode: off", "sec")}${btn("Reset this area", "sec")}</div>
          <div class="adm-row"><input type="number" value="0" style="width:64px">${btn("Speed test", "sec")}<span class="k-note">raw %, this session</span></div></div>
        <div class="adm-box"><b><img src="${UI("quests")}" alt="">Quests</b>
          <div class="adm-row"><select style="flex:1"><option>The Membership Fee (done)</option></select><select><option>not started</option><option>started</option><option>done</option></select>${btn("Set", "sec")}</div>
          <div class="adm-row">${btn("Reset all quests", "warn")}</div></div>
        <div class="adm-box"><b><img src="${UI("settings")}" alt="">Danger</b>
          <div class="adm-row">${btn("Reset my character", "warn")}</div>
          <details><summary class="k-note">Raw character (what the server has)</summary><pre style="max-height:120px;overflow:auto;font-size:10px">{ "scene": "${esc(me?.scene || "")}", … }</pre></details></div>
      </div>`,
  };
  let win = $("admWin");
  if (!win) { win = document.createElement("section"); win.className = "win k-win"; win.id = "admWin"; win.hidden = true; win.setAttribute("aria-label", "Admin"); ($("trkWin") || document.body.lastElementChild).after(win); }
  const open = (tab = "live") => {
    win.innerHTML = `<div class="k-head"><img src="${UI("settings")}" alt=""><b>Admin</b><span class="k-sub">${esc(login)} · ${online} online</span><button type="button" class="k-x" aria-label="Close">×</button></div>
      <div class="k-tabs" role="tablist">${[["live", "Live server"], ["players", "Players"], ["test", "Testing (just you)"]].map(([k, l]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${k === tab}" aria-pressed="${k === tab}">${l}</button>`).join("")}</div>
      <div class="k-body k-paper">${TABS[tab]()}</div>`;
    win.querySelector(".k-x").onclick = () => { win.hidden = true; };
    win.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => open(b.dataset.t));
    win.hidden = false;
  };
  window.__adm = { open };
})();
