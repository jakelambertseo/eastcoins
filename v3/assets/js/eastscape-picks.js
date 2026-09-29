function createPicks(env){const{SFX,esc,$,host,onClose}=env;let data=null,at=0,loading=false,err="";let el=null,tab="markets",sport="all";let ticket=null;let receipt=null,placing=false,note="";const LOGOS_V=5;let logosAsked=false;function wantLogos(){if(logosAsked||window.ECLogos)return;logosAsked=true;const s=document.createElement("script");s.src=`/v3/assets/js/v3-logos.js?v=${LOGOS_V}`;s.addEventListener("load",()=>draw());document.head.append(s)}function crest(m,side){const u=window.ECLogos?.url?.(m.sport,m.league,m[side]?.name||"");return u?`<img class="pk-crest" src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()">`:""}const zc=n=>`${Math.round(Number(n)||0).toLocaleString()}`;const line=odds=>odds==null?"—":odds>0?`+${Math.round(odds)}`:`${Math.round(odds)}`;const profitOf=(stake,odds)=>odds==null?0:odds>0?stake*odds/100:stake*100/-odds;const isProp=m=>String(m.league||"").toUpperCase()==="PROP"||String(m.sport||"")==="prop";const sideName=(m,side)=>isProp(m)?side==="away"?"Yes":"No":m[side]?.name||side;const whenOf=iso=>{if(!iso)return"";const t=new Date(iso),now=new Date;if(Number.isNaN(+t))return"";const day=t.toDateString()===now.toDateString()?"":`${t.toLocaleDateString(void 0,{weekday:"short"})} `;return`${day}${t.toLocaleTimeString(void 0,{hour:"numeric",minute:"2-digit"})}`};async function load(force){if(loading||!force&&data&&Date.now()-at<2e4)return data;loading=true;err="";draw();try{const r=await fetch("/api/picks/bootstrap",{credentials:"include"});const p=r.headers.get("content-type")?.includes("json")?await r.json():null;if(!p)throw new Error("The book isn't reachable from here right now.");if(!p.ok)throw new Error(p.message||"Picks isn't answering.");data=p;at=Date.now()}catch(e){err=String(e.message||e)}loading=false;draw();return data}async function place(stake){if(placing||!ticket)return;placing=true;note="Sending it…";draw();try{const r=await fetch("/api/picks/wagers",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({marketId:ticket.market.id,selection:ticket.side,wager:stake})});const p=await r.json();if(!p?.ok){note=p?.message||"That didn't go through.";placing=false;return draw()}SFX.play("coins");receipt={pick:p.pick,balance:p.balance,market:ticket.market};ticket=null;note="";placing=false;draw();load(true)}catch(e){note="The book didn't answer. Nothing was taken.";placing=false;draw()}}function css(){if(document.getElementById("esPicksCss"))return;const st=document.createElement("style");st.id="esPicksCss";st.textContent=`.pk-strip{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
.pk-strip>div{flex:1;min-width:76px;padding:5px 8px;border-radius:6px;background:rgba(0,0,0,.06);text-align:center}
.pk-strip b{display:block;font-size:15px;font-weight:800;color:#3a2a14}.pk-strip small{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#6a5a40}
.pk-tabs{display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap}
.pk-list{display:flex;flex-direction:column;gap:6px;max-height:300px;overflow:auto}
.pk-mk{padding:7px 8px;border-radius:6px;background:rgba(0,0,0,.05);border-left:3px solid #9a7a3a}
.pk-mk.prop{border-left-color:#7a4fb5;background:rgba(122,79,181,.08)}
.pk-mk .pk-top{display:flex;gap:6px;align-items:baseline;margin-bottom:5px}
.pk-mk .pk-top b{flex:1;min-width:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pk-mk .pk-top small{color:#6a5a40;font-weight:800;white-space:nowrap}
.pk-sides{display:flex;gap:5px}.pk-sides button{flex:1;min-width:0;display:flex;justify-content:space-between;gap:6px;align-items:center}
.pk-sides span{display:flex;align-items:center;gap:5px;min-width:0;overflow:hidden}
.pk-sides span{text-overflow:ellipsis;white-space:nowrap}
/* The crest never shrinks and never stretches the row: a fixed box the name flows beside. */
.pk-crest{width:18px;height:18px;flex:none;object-fit:contain;image-rendering:auto}
.pk-tick .pk-crest{width:20px;height:20px;vertical-align:-4px;margin-right:5px}
.pk-sides b{font-family:inherit;color:#7a5a1a;white-space:nowrap}
.pk-row{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:5px;background:rgba(0,0,0,.05);font-size:13px;font-weight:700}
.pk-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pk-row small{color:#6a5a40;white-space:nowrap}
.pk-row.won{background:rgba(40,130,60,.14)}.pk-row.lost{background:rgba(170,40,30,.12)}
.pk-tick{padding:9px;border-radius:6px;background:#2a1a10;color:#f3e7cc;margin-bottom:8px}
.pk-tick.prop{background:#2a1838}
.pk-tick b{display:block;margin-bottom:2px}.pk-tick small{color:#e0c890;display:block;margin-bottom:7px}
.pk-stake{display:flex;gap:5px;margin-bottom:7px;flex-wrap:wrap}
.pk-stake input{width:82px;padding:5px 7px;border:2px solid #b89a6a;border-radius:5px;background:#fff8e6;font:inherit;font-weight:800}
.pk-lines{display:flex;flex-direction:column;gap:2px;font-size:12px;font-weight:700;margin-bottom:8px}
.pk-lines i{font-style:normal;color:#e0c890}
.pk-bad{color:#ffb4a8}`;document.head.append(st)}function strip(){const s=data?.session,sea=data?.season||{};if(!s?.authenticated)return`<div class="jk-msg">Log in with Twitch on eastcoin.vip to place a pick. You can read the board either way.</div>`;const rec=sea.record||{},prof=Number(sea.profit??0);return`<div class="pk-strip">
      <div><b>${zc(s.balance??sea.balance??0)}</b><small>ZCoins</small></div>
      <div><b>${prof>=0?"+":""}${zc(prof)}</b><small>Season</small></div>
      <div><b>${rec.wins??0}–${rec.losses??0}</b><small>Record</small></div>
      <div><b>${(data.myPicks||[]).filter(p=>p.status==="LOCKED").length}</b><small>Open</small></div></div>`}function marketsList(){const all=(data?.markets||[]).filter(m=>m.state==="OPEN");const mine=new Set((data?.myPicks||[]).map(p=>p.marketId));const rows=all.filter(m=>sport==="all"||(sport==="prop"?isProp(m):String(m.sport||"")===sport));if(!rows.length)return`<div class="jk-msg">${all.length?"Nothing open in that sport.":"Nothing open right now. The board fills when markets do."}</div>`;const canBet=data?.config?.wageringEnabled;return`<div class="pk-list">${rows.map(m=>{const prop=isProp(m),had=mine.has(m.id);return`<div class="pk-mk${prop?" prop":""}">
        <div class="pk-top"><b>${esc(prop?m.question||"A prop":`${m.away?.name||"Away"} at ${m.home?.name||"Home"}`)}</b><small>${esc(whenOf(m.startsAt))}</small></div>
        <div class="pk-sides">${["away","home"].map(side=>`<button type="button" class="lk-btn" data-bet="${esc(m.id)}" data-side="${side}"${had||!canBet?" disabled":""}>
          <span>${prop?"":crest(m,side)}${esc(sideName(m,side))}</span><b>${line(side==="away"?m.awayOdds:m.homeOdds)}</b></button>`).join("")}</div>
        ${had?`<div class="jk-msg" style="margin:5px 0 0">You're already on this one.</div>`:""}</div>`}).join("")}</div>`}function mineList(){const rows=data?.myPicks||[];if(!rows.length)return`<div class="jk-msg">No picks yet this season.</div>`;return`<div class="pk-list">${rows.slice(0,40).map(p=>{const s=String(p.status||"").toUpperCase();const k=s==="WON"?"won":s==="LOST"?"lost":"";const tail=s==="LOCKED"?`to win ${zc(Math.max(0,(p.returnsIfWon??0)-(p.wager??0)))}`:s==="WON"?`+${zc(Math.max(0,(p.returnsIfWon??0)-(p.wager??0)))}`:s==="LOST"?`−${zc(p.wager??0)}`:s==="REFUNDED"?"refunded":s.toLowerCase();return`<div class="pk-row ${k}"><span>${esc(p.team||p.selection||"A pick")}</span><small>${zc(p.wager)} · ${tail}</small></div>`}).join("")}</div>`}function boardList(){const rows=data?.leaderboard||[];if(!rows.length)return`<div class="jk-msg">Nobody has settled a pick yet this season.</div>`;return`<div class="pk-list">${rows.slice(0,25).map((r,i)=>{const prof=Number(r.profit??0);return`<div class="pk-row"><span>${i+1}. ${esc(r.displayName||r.login||"Somebody")}</span><small>${prof>=0?"+":""}${zc(prof)} · ${r.wins??0}–${r.losses??0}</small></div>`}).join("")}</div>`}function ticketBlock(){const m=ticket.market,prop=isProp(m),odds=ticket.side==="away"?m.awayOdds:m.homeOdds;const bal=Math.floor(Number(data?.session?.balance??0));const stake=Math.max(1,Math.min(ticket.stake||10,1e5));const win=profitOf(stake,odds);return`<div class="pk-tick${prop?" prop":""}">
      <b>${prop?"":crest(m,ticket.side)}${esc(sideName(m,ticket.side))}${prop?"":` vs ${esc(sideName(m,ticket.side==="away"?"home":"away"))}`}</b>
      <small>${esc(prop?m.question||"":whenOf(m.startsAt))} · ${line(odds)}</small>
      <div class="pk-stake">
        <input id="pkStake" type="number" min="1" step="1" value="${stake}" aria-label="Stake in ZCoins">
        ${[10,25,50].map(n=>`<button type="button" class="lk-btn" data-chip="${n}">${n}</button>`).join("")}
        <button type="button" class="lk-btn" data-chip="all">All in</button>
      </div>
      <div class="pk-lines">
        <div><i>If it wins</i> +${zc(win)} (${zc(stake+win)} back)</div>
        <div><i>If it loses</i> −${zc(stake)}</div>
        <div><i>Void</i> ${zc(stake)} refunded</div>
      </div>
      ${note?`<div class="jk-msg pk-bad" style="margin-bottom:7px">${esc(note)}</div>`:""}
      <div class="pk-stake" style="margin:0">
        <button type="button" class="lk-btn" id="pkGo"${placing?" disabled":""}>${placing?"Sending…":`Lock it in · ${zc(stake)}`}</button>
        <button type="button" class="lk-btn" id="pkNo">Back</button>
        <span class="gr-who" style="margin-left:auto;align-self:center">You have ${zc(bal)}</span>
      </div></div>`}function receiptBlock(){const p=receipt.pick,win=Math.max(0,(p.returnsIfWon??0)-(p.wager??0));return`<div class="pk-tick"><b>It's on. ${esc(p.team||"")} at ${line(p.odds)}</b>
      <small>${zc(p.wager)} staked${p.allIn?" — all of it":""}</small>
      <div class="pk-lines"><div><i>If it wins</i> +${zc(win)} (${zc(p.returnsIfWon)} back)</div><div><i>Left in the wallet</i> ${zc(receipt.balance)}</div></div>
      <button type="button" class="lk-btn" id="pkDone">Back to the board</button></div>`}function draw(){if(!el?.isConnected)return;css();wantLogos();const TABS=[["markets",`Board${(data?.markets||[]).filter(m=>m.state==="OPEN").length?` · ${data.markets.filter(m=>m.state==="OPEN").length}`:""}`],["mine","My picks"],["board","Leaderboard"]];const SPORTS=[["all","All"],["american-football","NFL"],["baseball","MLB"],["prop","Props"]];el.innerHTML=`${strip()}
      ${err?`<div class="jk-msg pk-bad">${esc(err)}</div>`:""}
      ${receipt?receiptBlock():ticket?ticketBlock():""}
      ${receipt||ticket?"":`<div class="pk-tabs">${TABS.map(([k,l])=>`<button type="button" class="lk-btn" role="tab" data-pt="${k}" aria-pressed="${tab===k}">${l}</button>`).join("")}
        <button type="button" class="lk-btn" id="pkRef" style="margin-left:auto"${loading?" disabled":""}>${loading?"…":"Refresh"}</button></div>
        ${tab==="markets"?`<div class="pk-tabs">${SPORTS.map(([k,l])=>`<button type="button" class="lk-btn" data-ps="${k}" aria-pressed="${sport===k}">${l}</button>`).join("")}</div>`:""}
        ${loading&&!data?`<div class="jk-msg">Reading the board…</div>`:tab==="markets"?marketsList():tab==="mine"?mineList():boardList()}`}`;el.querySelectorAll("[data-pt]").forEach(b=>b.addEventListener("click",()=>{tab=b.dataset.pt;SFX.play("ui_click");draw()}));el.querySelectorAll("[data-ps]").forEach(b=>b.addEventListener("click",()=>{sport=b.dataset.ps;SFX.play("ui_click");draw()}));el.querySelector("#pkRef")?.addEventListener("click",()=>load(true));el.querySelectorAll("[data-bet]").forEach(b=>b.addEventListener("click",()=>{const m=(data.markets||[]).find(x=>x.id===b.dataset.bet);if(!m)return;SFX.play("ui_open");ticket={market:m,side:b.dataset.side,stake:10};note="";draw()}));el.querySelector("#pkNo")?.addEventListener("click",()=>{ticket=null;note="";SFX.play("ui_click");draw()});el.querySelector("#pkDone")?.addEventListener("click",()=>{receipt=null;SFX.play("ui_click");draw()});const stakeEl=el.querySelector("#pkStake");stakeEl?.addEventListener("input",()=>{ticket.stake=Math.max(1,Math.floor(Number(stakeEl.value)||1))});stakeEl?.addEventListener("change",()=>draw());el.querySelectorAll("[data-chip]").forEach(b=>b.addEventListener("click",()=>{const v=b.dataset.chip;if(v==="all"){ticket.allIn=true;return place("all")}ticket.stake=Number(v);draw()}));el.querySelector("#pkGo")?.addEventListener("click",()=>place(Math.max(1,Math.floor(Number(stakeEl?.value)||ticket.stake||10))))}function open(node){el=node;css();receipt=null;ticket=null;note="";draw();load(false)}function close(){el=null;onClose?.()}return{open,close,refresh:()=>load(true)}}export{createPicks};
