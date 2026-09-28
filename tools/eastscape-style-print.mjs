/* THE STYLE FINGERPRINT (2026-09-28, for the CSS cleanup pass): node tools/eastscape-style-print.mjs <out.json>
   Opens the LOCAL game in headless Chrome as a throwaway character (?as=stylecheck), opens every window and panel it can, and records the
   computed style of every element in each (and of its ::before / ::after when they draw). Run it before and after a stylesheet change and
   diff the two files: an identical fingerprint is proof the change drew nothing differently on any of those screens.
   Needs the local page server (4321) and worker (8787). Headless, so no browser pane is involved. */
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const out = process.argv[2] || "style-print.json";
const port = 9335, dir = mkdtempSync(join(tmpdir(), "cdp-"));
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "--window-size=1440,900", "--mute-audio", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let tgt; for (let i = 0; i < 40 && !tgt; i++) { await sleep(250); try { tgt = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); } catch {} }
const ws = new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pend = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const call = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await call("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) console.log("  js error:", r.result.exceptionDetails.exception?.description?.slice(0, 200)); return r.result?.result?.value; };
await call("Page.enable");
await call("Page.navigate", { url: "http://localhost:4321/eastscape.html?as=stylecheck&open=1" });
await sleep(7500);
await ev(`localStorage.setItem('es_radio_off','1'); window.ev=(o)=>__es.ws.onmessage({data: JSON.stringify({type:'ev', list:[o]})}); document.getElementById('pop').hidden=true; document.getElementById('lookWin').hidden=true;
  window.H=()=>{ document.querySelectorAll('section.win').forEach(w=>w.hidden=true); document.getElementById('pop').hidden=true; document.getElementById('info').hidden=true; document.getElementById('dlg').hidden=true; document.getElementById('meMenu').hidden=true; };
  const m=__es.me; m.xp.cooking=Math.max(m.xp.cooking||0,2000); m.xp.smithing=Math.max(m.xp.smithing||0,40000); m.inv.push({k:'sardine',n:6},{k:'bronze_bar',n:30},{k:'temper',n:2});
  window.PROPS=['display','position','top','left','right','bottom','width','height','min-height','max-height','margin','padding','border','border-image-source','border-radius','box-shadow','background-color','background-image','color','font','letter-spacing','text-transform','text-shadow','opacity','filter','transform','grid-template-columns','gap','flex','align-items','justify-content','overflow','z-index','outline','visibility','white-space','text-align','cursor'];
  window.PRINT=(root)=>{ const out={}; const els=[root,...root.querySelectorAll('*')]; els.forEach((e,i)=>{ const key=i+':'+e.tagName+'.'+[...e.classList].sort().join('.')+(e.id?'#'+e.id:''); const c=getComputedStyle(e); out[key]=PROPS.map(p=>c.getPropertyValue(p)).join('|'); for (const ps of ['::before','::after']) { const q=getComputedStyle(e,ps); if (q.content && q.content!=='none' && q.content!=='normal') out[key+ps]=[q.content,q.display,q.width,q.height,q.backgroundColor,q.backgroundImage,q.color,q.position,q.top,q.left].join('|'); } }); return out; };
  1`);
const PAGES = [
  ["top bar", "", ".top"],
  ["hud", "document.getElementById('chatTab').click();", ".game"],
  ["panel: inventory", "document.querySelector('[data-tab=inv]').click();", ".side"],
  ["panel: equipment", "document.querySelector('[data-tab=equip]').click();", ".side"],
  ["panel: skills", "document.querySelector('[data-tab=skills]').click();", ".side"],
  ["panel: quests", "document.querySelector('[data-tab=quests]').click();", ".side"],
  ["me menu", "document.getElementById('topMe').click();", "#meMenu"],
  ["settings", "H(); document.getElementById('gearBtn').click();", "#setWin"],
  ["popup", "H(); __es.popup('Drop it?','Drop the rod? It is gone for good.','item:rod',[['Drop it',null],['Keep it',null]]);", "#pop"],
  ["popup: many", "H(); __es.popup('Your island','Pick a theme.','🏝️',[['Beach',null],['Forest',null],['Snow',null],['Desert',null]]);", "#pop"],
  ["dialogue", "H(); __es.talkTo(__es.Z.npcs[0]); await new Promise(r=>setTimeout(r,800));", "#dlg"],
  ["bank", "H(); ev({type:'bank'}); await new Promise(r=>setTimeout(r,800));", "#bankWin"],
  ["exchange: buy", "H(); ev({type:'exchange'}); await new Promise(r=>setTimeout(r,800)); document.querySelector('#exBody [data-open]')?.click();", "#exWin"],
  ["exchange: sell", "document.querySelector('[data-ex=sell]').click();", "#exWin"],
  ["exchange: ticket", "document.querySelector('#exBody [data-sellk]')?.click();", "#exWin"],
  ["forge", "H(); __es.openShop('forge');", "#shopWin"],
  ["bar", "H(); __es.openShop('bar');", "#shopWin"],
  ["trade", "H(); __es.ws.onmessage({data: JSON.stringify({type:'trade', themName:'Kellz', stage:'offer', you:{items:{},cash:0,pets:[]}, them:{items:{sardine:3},cash:500,pets:[]}, ok:{you:false,them:true}})});", "#tradeWin"],
  ["range", "H(); __es.openCraft({t:'range',id:'x1',x:0,y:0});", "#craftWin"],
  ["cauldron", "H(); __es.openCraft({t:'cauldron',id:'x2',x:0,y:0});", "#craftWin"],
  ["anvil: smith", "H(); __es.openSmith({t:'anvil',id:'x3',x:0,y:0});", "#smithWin"],
  ["anvil: reforge", "document.querySelector('#smithTabs [data-tab=forge]').click();", "#smithWin"],
  ["anvil: craftables", "document.querySelector('#smithTabs [data-tab=craft]').click();", "#smithWin"],
  ["quest log", "H(); document.getElementById('questBtn').click();", "#questWin"],
  ["achievements", "H(); document.getElementById('achBtn').click();", "#achWin"],
  ["hiscores", "H(); document.getElementById('hsBtn').click(); await new Promise(r=>setTimeout(r,1500));", "#hsWin"],
  ["hiscores: crypt", "document.querySelector('#hsTabs [data-hs=crypt1]')?.click();", "#hsWin"],
  ["store", "H(); document.getElementById('storeBtn').click(); await new Promise(r=>setTimeout(r,500));", "#storeWin"],
  ["wiki", "H(); document.getElementById('wikiBtn').click(); await new Promise(r=>setTimeout(r,800));", "#wikiWin"],
  ["map", "H(); __es.openMap(); await new Promise(r=>setTimeout(r,800));", "#mapWin"],
  ["jukebox", "H(); __es.openJuke();", "#jukeWin"],
  ["look", "H(); __es.openLook(); await new Promise(r=>setTimeout(r,600));", "#lookWin"],
  ["ronde", "H(); __es.openVan();", "#vanWin"],
  ["who", "H(); document.getElementById('online').click();", "#whoWin"],
  ["picture house", "H(); __es.openScreen();", "#screenWin"],
  ["sportsbook", "H(); __es.openPicks();", "#picksWin"],
  ["hatchery", "H(); __es.openHatch({}); await new Promise(r=>setTimeout(r,600));", "#hatchWin"],
  ["roulette", "H(); ev({type:'roulopen'});", "#roulWin"],
  ["info: npc", "H(); __es.showInfo({kind:'npc',id:__es.Z.npcs[0].id},300,200);", "#info"],
];
const result = {};
for (const [name, js, sel] of PAGES) {
  await ev(`(async()=>{ ${js} })()`); await sleep(700);
  result[name] = await ev(`(()=>{ const r=document.querySelector(${JSON.stringify(sel)}); return r ? PRINT(r) : null; })()`);
  console.log(`${name}: ${result[name] ? Object.keys(result[name]).length : "not found"}`);
}
writeFileSync(out, JSON.stringify(result));
ws.close(); chrome.kill();
