/* ============================================================
   GAMBA — the casino tables (the page side)

   Every game window on the casino floor is drawn here, in the look of
   the site's own casino (eastcoin.vip/?view=casino): a dark table, a
   status line, the board, one gold button, and "what it pays" beside
   it. It was a parchment pop-up with a few emoji before; the games are
   the product, so they get the product's clothes.

   The rules are not here. Every number comes from eastscape-shared.js
   and every result from the server; this file only shows them. The
   window is built ONCE when a table is opened and then updated in
   place, so an animation is never torn down by the next message.

   createCasino(env) -> { open, result, run, me, cashier, cashed, close }
   ============================================================ */
const CART = "/v3/assets/img/glad/flat/casino/", CV = 1;
const SUITS = ["♠", "♥", "♦", "♣"];
const CSS = `
#gameWin.cz{--ink:#0c0a09;--panel:#161311;--panel-2:#1e1a17;--panel-3:#241f1b;--line:rgba(255,255,255,.1);--line-2:rgba(255,255,255,.16);--text:#f4ede5;--muted:#aca298;--muted-2:#7d746a;
  --gold:#e8bf35;--gold-dim:rgba(232,191,53,.13);--green:#4ddb8b;--green-dim:rgba(77,219,139,.11);--red:#ff6b85;--red-dim:rgba(255,107,133,.1);
  --display:"Bricolage Grotesque","Nunito","Segoe UI",system-ui,sans-serif;--body:"Figtree","Nunito","Segoe UI",system-ui,sans-serif;
  width:min(880px,calc(100% - 20px));background:var(--ink);color:var(--text);border:1px solid #3a302a;border-radius:16px;font-family:var(--body);box-shadow:0 30px 80px rgba(0,0,0,.75)}
#gameWin.cz .win-head{background:linear-gradient(#1c1613,#141110);color:var(--text);border-bottom:1px solid var(--line);margin:0;border-radius:16px 16px 0 0;padding:12px 16px}
#gameWin.cz .win-head b{font-family:var(--display);font-weight:800;font-size:20px;letter-spacing:-.02em}
#gameWin.cz .win-head small{color:var(--muted-2);font-weight:700}
#gameWin.cz .win-head .win-x{color:var(--muted)}
#gameWin.cz .win-body{padding:14px;background:var(--ink);border-radius:0 0 16px 16px}
#gameWin.cz [hidden]{display:none!important}
.cz-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(230px,1fr);gap:12px;align-items:start}
@media (max-width:760px){.cz-grid{grid-template-columns:minmax(0,1fr)}}
.cz-stage{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 16px 16px;border:1px solid var(--line);border-radius:13px;background:radial-gradient(70% 80% at 50% 0%,rgba(142,18,49,.32),transparent 60%),var(--panel);overflow:hidden}
.cz-phase{font-family:var(--display);font-weight:800;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);min-height:1.3em;text-align:center}
.cz-phase.open{color:var(--green)}.cz-phase.done{color:var(--gold)}.cz-phase.bad{color:var(--red)}
.cz-board{display:grid;place-items:center;min-height:190px;width:100%}
.cz-mult{font-family:var(--display);font-weight:800;font-size:17px;color:var(--gold);min-height:1.4em;text-align:center}
.cz-mult small{color:var(--muted);font-weight:700;font-size:12.5px;margin-left:6px}
.cz-bet{width:100%;max-width:440px;margin-top:6px;display:flex;flex-direction:column;gap:9px}
.cz-stakerow{display:flex;gap:6px;flex-wrap:wrap}
.cz-stake{flex:1 1 90px;height:42px;padding:0 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--text);font:800 17px var(--body);outline:none;min-width:0}
.cz-stake:focus{border-color:rgba(232,191,53,.5)}.cz-stake:disabled{opacity:.55}
.cz-chip{height:42px;padding:0 11px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel);font:800 13.5px var(--body);color:var(--text);cursor:pointer}
.cz-chip:hover:not(:disabled){background:var(--panel-3)}.cz-chip:disabled{opacity:.45;cursor:default}
.cz-lock{height:52px;border-radius:12px;border:1px solid rgba(232,191,53,.5);background:var(--gold);color:#1a1405;font:800 17px var(--display);cursor:pointer;transition:filter .12s ease,transform .06s ease}
.cz-lock:hover:not(:disabled){filter:brightness(1.07)}.cz-lock:active:not(:disabled){transform:translateY(1px)}
.cz-lock:disabled{background:var(--panel-2);color:var(--muted);border-color:var(--line-2);cursor:default}
.cz-lock.alt{background:var(--panel-2);color:var(--text);border-color:var(--line-2)}
.cz-note{margin:0;text-align:center;color:var(--muted-2);font-size:12.5px;min-height:1.2em}
.cz-picks{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:8px}
.cz-pick{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:58px;border-radius:12px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--text);font:inherit;cursor:pointer}
.cz-pick b{font:800 16px var(--display)}.cz-pick small{color:var(--gold);font-weight:800;font-size:12px}
.cz-pick:hover:not(:disabled){border-color:rgba(232,191,53,.45)}.cz-pick.on{border-color:var(--gold);background:var(--gold-dim);box-shadow:0 0 0 1px rgba(232,191,53,.35) inset}
.cz-pick:disabled{opacity:.45;cursor:default}
.cz-pick.red.on{border-color:#e0364a;background:rgba(224,54,74,.16)}.cz-pick.black.on{border-color:#d8d2c4;background:rgba(255,255,255,.07)}
.cz-pick.up:hover:not(:disabled){border-color:rgba(77,219,139,.6);background:var(--green-dim)}.cz-pick.down:hover:not(:disabled){border-color:rgba(255,107,133,.5);background:var(--red-dim)}
.cz-side{display:flex;flex-direction:column;gap:10px}
.cz-card{border:1px solid var(--line);border-radius:13px;background:var(--panel);padding:12px 14px}
.cz-card h2{font:700 15px var(--display);letter-spacing:-.02em;margin:0 0 8px;display:flex;justify-content:space-between;align-items:baseline;gap:10px}
.cz-card h2 small{color:var(--muted-2);font-size:11.5px;font-weight:600;text-align:right}
.cz-rungs{display:flex;flex-direction:column;gap:2px;max-height:250px;overflow-y:auto;scrollbar-width:thin}
.cz-rung{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 8px;border-radius:7px;color:var(--muted);font-size:13px}
.cz-rung strong{font:800 14.5px var(--display);color:var(--text)}.cz-rung .cz-i{width:18px;height:18px;vertical-align:-4px}
.cz-rung.at{background:var(--green-dim);color:var(--green)}.cz-rung.at strong{color:var(--green)}.cz-rung.next{background:var(--gold-dim)}.cz-rung.next strong{color:var(--gold)}
.cz-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.cz-stat{background:var(--panel-2);border-radius:9px;padding:7px 9px}.cz-stat span{display:block;color:var(--muted-2);font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.cz-stat strong{font:800 16px var(--display)}
.cz-stat strong.up{color:var(--green)}.cz-stat strong.dn{color:var(--red)}
.cz-recent{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}.cz-recent span{padding:2px 8px;border-radius:9px;background:var(--panel-2);color:var(--muted);font-size:11.5px;font-weight:800}.cz-recent span.w{background:var(--green-dim);color:var(--green)}
.cz-needs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.cz-need{background:var(--panel-2);border-radius:9px;padding:6px 9px;font-size:11.5px;font-weight:800;color:var(--muted)}.cz-need i{display:block;height:5px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:4px}.cz-need i>u{display:block;height:100%;background:#6ab7ff}
.cz-need.food i>u{background:#ffb04a}.cz-need.low{color:var(--red);box-shadow:0 0 0 1px rgba(255,107,133,.5)}.cz-need.low i>u{background:var(--red)}
.cz-luck{font-size:12.5px;line-height:1.45;color:var(--muted)}.cz-luck.on{color:var(--green);font-weight:800}
.cz-jack{text-align:center;background:linear-gradient(#2a0a12,#140508);border-color:rgba(232,191,53,.45);box-shadow:inset 0 0 18px rgba(255,200,80,.12)}
.cz-jack b{display:block;font:800 28px var(--display);color:var(--gold);text-shadow:0 0 12px rgba(255,210,90,.5)}.cz-jack small{color:var(--muted);font-size:11.5px}
.cz-i{image-rendering:pixelated;width:32px;height:32px}
.cz-pop{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%) scale(.85);opacity:0;pointer-events:none;text-align:center;transition:transform .3s cubic-bezier(.3,1.6,.5,1),opacity .2s ease;z-index:5}
.cz-pop.show{opacity:1;transform:translate(-50%,-50%) scale(1)}.cz-pop b{display:block;font:800 40px var(--display);letter-spacing:-.04em;color:var(--gold);text-shadow:0 0 30px rgba(232,191,53,.6),0 2px 0 rgba(0,0,0,.6)}
.cz-pop span{display:inline-block;color:var(--text);font-weight:700;background:rgba(12,10,9,.85);padding:3px 10px;border-radius:8px;margin-top:2px;font-size:13px}
/* coin */
.cz-coinbox{perspective:700px;width:150px;height:150px}.cz-coin{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform 1s cubic-bezier(.2,.7,.2,1)}
.cz-coin.spin{animation:czflip .45s linear infinite;transition:none}.cz-coin img{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;backface-visibility:hidden;filter:drop-shadow(0 10px 18px rgba(0,0,0,.55))}
.cz-coin img.t{transform:rotateY(180deg)}@keyframes czflip{to{transform:rotateY(360deg)}}
/* dice */
.cz-roll{font:800 72px var(--display);letter-spacing:-.04em;line-height:1;text-shadow:0 4px 0 rgba(0,0,0,.4)}.cz-roll.w{color:var(--green)}.cz-roll.l{color:var(--red)}
.cz-track{position:relative;width:min(420px,100%);height:18px;border-radius:9px;background:rgba(255,107,133,.35);margin:18px 0 6px}.cz-zone{position:absolute;left:0;top:0;bottom:0;border-radius:9px 0 0 9px;background:var(--green)}
.cz-marker{position:absolute;top:-9px;width:12px;height:36px;margin-left:-6px;border-radius:5px;background:#fff;box-shadow:0 3px 10px rgba(0,0,0,.6);transition:left .55s cubic-bezier(.2,.8,.2,1)}
.cz-ticks{display:flex;justify-content:space-between;width:min(420px,100%);color:var(--muted-2);font-size:11px;font-weight:800}
.cz-range{width:100%;accent-color:#e8bf35}
/* slots */
.cz-reels{display:flex;gap:10px;padding:12px;border-radius:16px;background:linear-gradient(#2a0a12,#140508);box-shadow:0 0 0 3px #c8963a,0 0 0 6px #3a2410,0 16px 40px rgba(0,0,0,.6)}
.cz-reel{width:96px;height:96px;border-radius:10px;background:#fff8e8;overflow:hidden;position:relative;box-shadow:inset 0 10px 14px -8px rgba(0,0,0,.55),inset 0 -10px 14px -8px rgba(0,0,0,.55)}
.cz-strip{display:flex;flex-direction:column}.cz-strip img{width:96px;height:96px;padding:14px;image-rendering:pixelated}
.cz-reel.spin .cz-strip{animation:czreel .32s linear infinite;filter:blur(1.5px)}@keyframes czreel{to{transform:translateY(-576px)}}
.cz-reel.stop .cz-strip{animation:czstop .28s cubic-bezier(.3,1.5,.5,1)}@keyframes czstop{from{transform:translateY(-60px)}}
.cz-reel.hit{box-shadow:0 0 0 3px var(--gold),0 0 22px rgba(232,191,53,.6)}
/* wheel */
.cz-wheelbox{position:relative;width:230px;height:230px;margin-top:20px}.cz-wheel{width:100%;height:100%;border-radius:50%;box-shadow:0 0 0 6px #c8963a,0 0 0 10px #3a2410,0 14px 34px rgba(0,0,0,.6)}
.cz-hub{position:absolute;left:50%;top:50%;width:38px;height:38px;margin:-19px;border-radius:50%;background:radial-gradient(#ffe27a,#c8963a);box-shadow:0 0 0 4px #3a2410}
.cz-pin{position:absolute;left:50%;top:-16px;margin-left:-11px;border:11px solid transparent;border-top:20px solid #ffe27a;filter:drop-shadow(0 2px 0 #3a2410)}
/* cards */
.cz-hl{display:flex;flex-direction:column;align-items:center;gap:10px}.cz-trail{display:flex;gap:5px;min-height:46px;flex-wrap:wrap;justify-content:center}
.cz-cardx{display:grid;place-items:center;align-content:center;border-radius:12px;background:#f7f2e8;color:#1a1405;font:800 42px var(--display);box-shadow:0 8px 24px rgba(0,0,0,.5),inset 0 0 0 1px rgba(0,0,0,.08);width:118px;height:162px;line-height:1}
.cz-cardx i{font-style:normal;font-size:36px;display:block;margin-top:2px}.cz-cardx.red{color:#c8102e}.cz-cardx.sm{width:34px;height:46px;font-size:13px;border-radius:7px;box-shadow:0 3px 10px rgba(0,0,0,.4)}.cz-cardx.sm i{font-size:11px;margin-top:0}
.cz-cardx.empty{background:repeating-linear-gradient(45deg,#7a1a2a 0 8px,#5a1020 8px 16px);box-shadow:0 8px 24px rgba(0,0,0,.5),inset 0 0 0 4px #c8963a;color:transparent}
.cz-cardx.bust{box-shadow:0 0 0 3px rgba(255,107,133,.7),0 8px 24px rgba(0,0,0,.5)}.cz-cardx.cashed{box-shadow:0 0 0 3px rgba(77,219,139,.7),0 8px 24px rgba(0,0,0,.5)}
.cz-cardx.flip{animation:czcard .42s ease-out}@keyframes czcard{from{transform:rotateY(90deg) translateX(30px);opacity:.2}}
/* mines */
.cz-mines{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;width:min(380px,100%)}
.cz-tile{aspect-ratio:1;display:grid;place-items:center;border:1px solid var(--line-2);border-radius:11px;background:linear-gradient(160deg,var(--panel-3),var(--panel-2));cursor:pointer;padding:0;transition:transform .12s ease,border-color .14s ease,box-shadow .14s ease}
.cz-tile:hover:not(:disabled){transform:translateY(-2px);border-color:rgba(232,191,53,.5);box-shadow:0 8px 22px rgba(0,0,0,.45)}.cz-tile:disabled{cursor:default}
.cz-tile .cz-i{width:auto;height:auto;zoom:2}.cz-tile.safe{border-color:rgba(77,219,139,.45);background:var(--green-dim);animation:czpop .22s ease-out}.cz-tile.bomb{border-color:rgba(255,107,133,.35);background:var(--red-dim);opacity:.75}
.cz-tile.bomb.hit{opacity:1;border-color:var(--red);box-shadow:0 0 0 2px rgba(255,107,133,.35),0 10px 30px rgba(255,107,133,.2);animation:czshake .32s ease-in-out}.cz-tile.dim{opacity:.4}
@keyframes czpop{from{transform:scale(.7)}}@keyframes czshake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.cz-bombs{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:center}.cz-bombs span{color:var(--muted-2);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.cz-bombs button{height:34px;min-width:42px;border-radius:9px;border:1px solid var(--line);background:var(--panel-2);color:var(--muted);font:800 14px var(--body);cursor:pointer}.cz-bombs button.on{border-color:rgba(232,191,53,.45);background:var(--gold-dim);color:var(--gold)}
/* plinko */
.cz-pkwrap{--p:26px}.cz-pk{position:relative;width:calc(var(--p) * 13);padding:6px 0}.cz-pkrow{display:flex;justify-content:center;gap:calc(var(--p) - 7px);height:var(--p);align-items:center}
.cz-peg{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.32);box-shadow:0 0 7px rgba(255,255,255,.1)}
.cz-ball{position:absolute;left:50%;top:0;width:14px;height:14px;margin-left:-7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,var(--gold) 60%,#8a6c12);box-shadow:0 0 14px rgba(232,191,53,.6);transition:transform .11s linear;z-index:2;opacity:0}
.cz-ball.go{opacity:1}.cz-ball.landed{transition:transform .16s cubic-bezier(.3,1.6,.5,1)}
.cz-buckets{display:flex;justify-content:center;gap:3px;margin-top:2px}.cz-bucket{flex:0 0 calc(var(--p) - 3px);padding:8px 0;border-radius:8px;text-align:center;border:1px solid var(--line);background:var(--panel-2);color:var(--muted);font-size:9.5px;font-weight:800;letter-spacing:-.03em;transition:transform .18s ease,background .18s ease}
.cz-bucket.mid{color:var(--text)}.cz-bucket.big{color:var(--gold);border-color:rgba(232,191,53,.45);background:var(--gold-dim)}.cz-bucket.hit{transform:translateY(-3px);border-color:var(--green);background:var(--green-dim);color:var(--green)}
/* scratch */
.cz-ticket{width:min(330px,100%);border-radius:18px;background:linear-gradient(160deg,#2a2018,#171310);border:1px solid rgba(232,191,53,.35);box-shadow:0 20px 50px rgba(0,0,0,.5);padding:12px;display:flex;flex-direction:column;gap:8px}
.cz-tktop{display:flex;justify-content:space-between;align-items:center}.cz-tktop b{font:800 14px var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--gold)}.cz-tktop span{color:var(--muted-2);font-size:11.5px}
.cz-tkgrid{position:relative;aspect-ratio:1;border-radius:12px;background:#0f0d0b;border:1px solid var(--line-2);overflow:hidden;touch-action:none;user-select:none}
.cz-tkcells{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);gap:6px;padding:8px}
.cz-tkcell{display:grid;place-items:center;border-radius:10px;background:var(--panel-2);border:1px solid var(--line)}.cz-tkcell img{width:56%;image-rendering:pixelated}.cz-tkcell.win{background:rgba(232,191,53,.16);border-color:rgba(232,191,53,.6);box-shadow:0 0 18px rgba(232,191,53,.35)}
.cz-foil{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair;border-radius:12px;transition:opacity .35s ease}.cz-foil.gone{opacity:0;pointer-events:none}
.cz-ticket.idle .cz-tkgrid::after{content:"Buy a card to scratch";position:absolute;inset:0;display:grid;place-items:center;color:var(--muted-2);font-size:14px;font-weight:700}
/* the fight pit */
.cz-card2{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:stretch;width:100%}.cz-vs{align-self:center;font:800 22px var(--display);color:var(--muted-2)}
.cz-fighter{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;border-radius:13px;border:1px solid var(--line-2);background:var(--panel-2);text-align:center;cursor:pointer;color:var(--text);font:inherit;min-width:0}
.cz-fighter:hover:not(:disabled){border-color:rgba(232,191,53,.5)}.cz-fighter:disabled{cursor:default}.cz-fighter.on{border-color:var(--gold);background:var(--gold-dim)}.cz-fighter.won{border-color:var(--green);background:var(--green-dim)}.cz-fighter.lost{opacity:.45}
.cz-fighter img{height:72px;width:auto;max-width:100%;image-rendering:pixelated;object-fit:contain}.cz-fighter img.flip{transform:scaleX(-1)}
.cz-fighter b{font:800 15px var(--display);line-height:1.15}.cz-fighter small{color:var(--muted);font-size:11.5px;line-height:1.25}.cz-fighter strong{font:800 22px var(--display);color:var(--gold)}.cz-fighter em{font-style:normal;color:var(--muted-2);font-size:11.5px}
.cz-hpbar{width:100%;height:8px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden}.cz-hpbar u{display:block;height:100%;background:var(--green);transition:width .25s ease}
.cz-betlist{display:flex;flex-direction:column;gap:2px;max-height:150px;overflow-y:auto;font-size:13px}.cz-betlist div{display:flex;justify-content:space-between;gap:8px;padding:4px 8px;border-radius:7px;color:var(--muted)}.cz-betlist div.me{background:var(--gold-dim);color:var(--text)}
/* cashier */
.cz-csrow{display:grid;grid-template-columns:30px 1fr auto auto;gap:10px;align-items:center;padding:7px 2px;border-top:1px solid var(--line);font-size:13.5px}.cz-csrow:first-child{border-top:0}.cz-csrow small{display:block;color:var(--muted-2);font-size:11.5px}
.cz-csrow strong{font:800 15px var(--display);color:var(--gold)}.cz-csrow img.ico,.cz-csrow .ico{width:26px;height:26px;image-rendering:pixelated}
.cz-dex h2 em{font-style:normal;color:var(--gold)}.cz-dexrow{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.cz-dexrow .cz-chip[aria-pressed=true]{background:var(--gold);color:#1a1405;border-color:var(--gold)}
.cz-dexgo{width:100%;height:44px;border-radius:11px;border:1px solid rgba(232,191,53,.5);background:var(--gold);color:#1a1405;font:800 14.5px var(--display);cursor:pointer}.cz-dexgo:disabled{opacity:.45;cursor:not-allowed}
.cz-dexgo.alt{background:linear-gradient(135deg,#ff5a7a,#c8202c);color:#fff;border-color:rgba(255,120,140,.6);margin-top:6px}.cz-dexmsg{margin:8px 0 0;font-size:12.5px;color:var(--muted);min-height:1.2em}.cz-dexmsg.bad{color:var(--red)}.cz-dexmsg.good{color:#4ddb8b}
.cz-dexbar{height:7px;border-radius:4px;background:rgba(255,255,255,.1);overflow:hidden;margin:6px 0 2px}.cz-dexbar>i{display:block;height:100%;background:linear-gradient(90deg,#ff5a7a,#e8bf35)}
.cz-rtk{position:relative;margin:10px auto 0;width:min(100%,300px);aspect-ratio:2/1;border-radius:14px;background:radial-gradient(circle at 50% 40%,#5a0f1c,#22060b);border:2px solid #e8bf35;display:grid;place-items:center;overflow:hidden}
.cz-rtk b{font:800 40px var(--display);color:#ffd84a;text-shadow:0 0 22px rgba(255,216,74,.5)}.cz-rtk small{display:block;text-align:center;font:700 12px var(--body);color:#f4c8cf;letter-spacing:.08em;text-transform:uppercase}
.cz-rtk button{position:absolute;inset:0;border:0;cursor:pointer;font:800 20px var(--display);letter-spacing:.12em;color:#3a3a44;background:repeating-linear-gradient(135deg,#d8d8e4 0 12px,#b8b8c8 12px 24px);transition:opacity .45s ease,transform .45s ease}.cz-rtk button.off{opacity:0;transform:scale(1.15);pointer-events:none}
.cz-pw{position:relative;width:min(330px,82%);aspect-ratio:1;margin:4px auto 0}.cz-pwdisc{position:absolute;inset:0;border-radius:50%;border:6px solid #e8bf35;box-shadow:0 0 0 3px #3a2410,0 0 40px rgba(232,191,53,.25);transition:transform 4.2s cubic-bezier(.12,.72,.12,1)}
.cz-pwdisc span{position:absolute;left:50%;top:50%;width:0;height:0}.cz-pwdisc span b{position:absolute;left:-40px;width:80px;top:calc(-1 * var(--r));text-align:center;font:800 11.5px var(--body);color:#fff;text-shadow:0 1px 2px #000,0 0 3px #000;line-height:1.05}
.cz-pwpin{position:absolute;left:50%;top:-12px;transform:translateX(-50%);width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-top:22px solid #fff;filter:drop-shadow(0 2px 2px rgba(0,0,0,.6));z-index:2}
.cz-pwhub{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff2b0,#e8bf35 60%,#8a6a10);box-shadow:0 0 0 3px #3a2410;z-index:1}
.cz-total{font:800 54px var(--display);letter-spacing:-.04em;color:var(--gold);line-height:1;text-shadow:0 0 30px rgba(232,191,53,.35)}
@media (prefers-reduced-motion:reduce){.cz-coin.spin,.cz-reel.spin .cz-strip{animation:none}}
`;

export function createCasino(env) {
  const { G, SFX, send, esc, $ } = env;
  const img = (k, cls = "") => `<img class="cz-i ${cls}" src="${CART}${k}.png?v=${CV}" alt="">`;
  const sym = (k) => (k === "gem" ? "gem" : `reel_${k}`);
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const money = (n) => G.fmtCash(n), cash = () => G.cashIn(env.me()), calm = () => env.calm();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let styled = false, GAME = null, R = {}, bet = 10, busy = false, token = 0, jack = { pot: null, last: null };
  const SESS = {}, RUNS = { hilo: null, mines: null }, PICK = { cointable: "heads", wheel: "red" };
  let diceTarget = 50, mineCount = 3, wheelRot = 0, trail = [], scratch = null;
  const sess = (g) => (SESS[g] ||= { bets: 0, net: 0, best: 0, recent: [] });

  function style() {
    if (styled) return; styled = true;
    document.head.append(Object.assign(document.createElement("style"), { textContent: CSS }));
    if (!document.querySelector('link[href*="/v3/assets/fonts/fonts.css"]')) document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: "/v3/assets/fonts/fonts.css" }));
  }
  const phase = (text, cls = "") => { if (R.phase) { R.phase.className = `cz-phase ${cls}`; R.phase.textContent = text; } };
  const note = (text) => { if (R.note) R.note.textContent = text; };
  function pop(big, small) { if (!R.pop) return; R.pop.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ""}`; R.pop.classList.add("show"); const t = token; setTimeout(() => { if (t === token) R.pop?.classList.remove("show"); }, 1500); }

  /* ---------------------------------------------------------- the frame every table shares */
  function frame(title, sub) {
    style(); token++; busy = false; R = {};
    const win = $("gameWin"); win.classList.add("cz"); win.style.width = "min(880px, calc(100% - 20px))"; /* (the element carries an inline width from its parchment days) */ $("gameTitle").textContent = title; $("gameSub").textContent = sub;
    const body = $("gameBody"); body.replaceChildren();
    const grid = el("div", "cz-grid"), stage = el("section", "cz-stage"), side = el("div", "cz-side");
    R.phase = el("div", "cz-phase"); R.board = el("div", "cz-board"); R.mult = el("div", "cz-mult"); R.bet = el("div", "cz-bet"); R.pop = el("div", "cz-pop");
    stage.append(R.phase, R.board, R.mult, R.bet, R.pop); grid.append(stage, side); body.append(grid); R.side = side; R.stage = stage;
    win.hidden = false; return R;
  }
  function stakeRow() {
    const row = el("div", "cz-stakerow"), C = G.CASINO; R.stake = el("input", "cz-stake"); R.stake.type = "number"; R.stake.min = C.minBet; R.stake.max = C.maxBet; R.stake.value = bet; R.stake.setAttribute("aria-label", "Bet");
    const room = () => env.room?.() || null, low = () => G.minBetOf(room()), big = (room()?.limits?.mult || 1) > 1;
    const top = () => G.maxBetOf(env.me(), room());   /* your own limit: the table's, plus a Bookie's amulet or champagne, doubled while a High Roller */
    const setBet = (v) => { bet = Math.max(low(), Math.min(top(), Math.floor(v) || low())); R.stake.value = bet; R.stake.min = low(); R.stake.max = top(); refresh(); };
    R.stake.addEventListener("input", () => { bet = Math.max(low(), Math.min(top(), Math.floor(+R.stake.value) || low())); refresh(); });
    if (bet < low() || bet > top()) { bet = Math.max(low(), Math.min(top(), bet)); R.stake.value = bet; }
    R.stake.addEventListener("blur", () => { R.stake.value = bet; });
    row.append(R.stake); R.chips = [];
    for (const [label, fn] of [...(big ? [["100", () => 100], ["500", () => 500], ["1K", () => 1000], ["5K", () => 5000]] : [["10", () => 10], ["50", () => 50], ["100", () => 100], ["500", () => 500]]), ["½", () => bet / 2], ["2×", () => bet * 2], ["Max", () => Math.min(top(), Math.max(cash(), env.me()?.free | 0))]]) { const b = el("button", "cz-chip", label); b.type = "button"; b.addEventListener("click", () => { SFX.play("chip", { vol: 0.5 }); setBet(fn()); }); R.chips.push(b); row.append(b); }
    return row;
  }
  const lockBtn = (cls = "") => { const b = el("button", `cz-lock ${cls}`); b.type = "button"; return b; };
  function sideCards(paysTitle, paysNote) {
    if (GAME === "slots") { R.jack = el("section", "cz-card cz-jack"); R.side.append(R.jack); }
    const pays = el("section", "cz-card"); pays.innerHTML = `<h2>${paysTitle}<small>${paysNote || ""}</small></h2>`; R.pays = el("div", "cz-rungs"); pays.append(R.pays);
    const you = el("section", "cz-card"); you.innerHTML = `<h2>This sitting<small>since you sat down</small></h2>`; R.stats = el("div", "cz-stats"); R.needs = el("div", "cz-needs"); R.recent = el("div", "cz-recent"); you.append(R.stats, R.needs, R.recent);
    const luck = el("section", "cz-card"); R.luck = el("div", "cz-luck"); luck.append(R.luck);
    R.side.append(pays, you, luck);
  }
  function lockStake(on) { if (R.stake) R.stake.disabled = on; for (const c of R.chips || []) c.disabled = on; }
  function record(g, delta) { const s = sess(g); s.bets++; s.net += delta; s.best = Math.max(s.best, delta); s.recent = [delta, ...s.recent].slice(0, 12); }
  function refresh() {            // everything that depends on your Cash, your luck or your session, without touching the board
    if (!GAME || !R.stats) return; const s = sess(GAME), me = env.me();
    R.stats.innerHTML = `<div class="cz-stat"><span>Your cash</span><strong>${money(cash())}</strong></div><div class="cz-stat"><span>Net</span><strong class="${s.net > 0 ? "up" : s.net < 0 ? "dn" : ""}">${s.net > 0 ? "+" : s.net < 0 ? "−" : ""}${money(Math.abs(s.net))}</strong></div><div class="cz-stat"><span>Bets</span><strong>${s.bets}</strong></div><div class="cz-stat"><span>Best win</span><strong>${s.best ? `+${money(s.best)}` : "–"}</strong></div>`;
    R.recent.innerHTML = s.recent.map((d) => `<span class="${d > 0 ? "w" : ""}">${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toLocaleString()}</span>`).join("");
    R.needs.innerHTML = [["thirst", "Thirst", ""], ["hunger", "Hunger", "food"]].map(([k, n, cls]) => { const v = Math.round(G.needOf(me, k)); return `<div class="cz-need ${cls}${v < G.NEEDS.floor ? " low" : ""}">${n} ${v}%<i><u style="width:${v}%"></u></i></div>`; }).join("");
    const luck = me?.luck | 0; R.luck.className = `cz-luck${luck ? " on" : ""}`;
    const others = G.buffsOf(me).filter((b) => b.id !== "luck").map((b) => `${b.name}${b.left != null ? ` × ${b.left}` : ""}`), lim = G.maxBetOf(me, env.room?.());
    R.luck.textContent = (luck ? `🍀 Lucky: your next ${luck} bet${luck === 1 ? "" : "s"} pay ${G.LUCK.bonus * 100}% more when they win.` : "Want better odds? Only skilling finds lucky clovers (out the arch, in the Yard). Fighting makes you a High Roller. Crafting makes rings and dinners, and Dex sells drinks.")
      + (others.length ? ` Also on: ${others.join(" · ")}.` : "") + (lim !== G.CASINO.maxBet ? ` Your limit here is ${money(lim)}.` : "") + ((env.room?.()?.limits?.mult || 1) > 1 ? ` High Roller Room: bets from ${money(G.minBetOf(env.room()))}; luck and buffs cover the first ${money(G.FX_COVER)} of a bet.` : "");
    if (R.jack && jack.pot != null) R.jack.innerHTML = `<small>JACKPOT</small><b>${money(Math.floor(jack.pot))}</b><small>Three sevens wins it · a ${money(G.CASINO.maxBet)} spin wins it all${jack.last ? ` · last: ${esc(jack.last.name)} ${money(jack.last.amt)}` : ""}</small>`;
    UI[GAME]?.refresh?.();
  }
  const empty = () => { const why = G.tooEmpty(env.me()); if (why) { phase(why === "thirst" ? "Too thirsty to gamble" : "Too hungry to gamble", "bad"); note(G.NEED_TEXT[why]); SFX.play("ui_error"); } return !!why; };
  const broke = () => { if (empty()) return true; return brokeOnly(); };
  const brokeOnly = () => { if (bet > cash() + (env.me()?.free | 0)) { phase(`You only have ${money(cash())}`, "bad"); note("Broke? Out the arch to the Yard: mine, chop, fish or fight. A Cashier or the Ruby in here arch pays for what you bring back."); SFX.play("ui_error"); return true; } return false; };
  function place(pick) {          // one bet, one answer
    if (busy || broke()) return; busy = true; const g = GAME, t = token; R.pop?.classList.remove("show");
    UI[g].start?.(); send({ t: "bet", g, amt: bet, pick });
    setTimeout(() => { if (busy && t === token && GAME === g && !UI[g].pending) { busy = false; UI[g].idle?.(); phase("No answer from the table. Try again.", "bad"); } }, 4500);
  }
  function settle(e, text, won) {
    const own = e.bet - (e.free || 0), delta = e.payout - own; record(e.g, delta); busy = false;
    phase(text, delta > 0 ? "done" : e.payout ? "open" : "bad");
    if (e.jackpot) { pop(`JACKPOT`, `+${money(e.payout)}`); SFX.play("jackpot"); }
    else if (delta > 0) { pop(`+${money(delta)}`, `${e.mult}×${e.lucky ? ` · +${e.lucky} from buffs` : ""}${e.free ? " · free play" : ""}`); SFX.play(e.payout > e.bet * 4 ? "win_big" : "win_small"); }
    else SFX.play(e.payout === e.bet ? "chip" : "lose");
    refresh();
  }

  /* ---------------------------------------------------------- the tables */
  const UI = {
    cointable: {
      title: "Coin Flip", sub: "Heads or tails · pays 1.95×",
      build() {
        R.board.innerHTML = `<div class="cz-coinbox"><div class="cz-coin" id="czCoin">${`<img class="h" src="${CART}coin_heads.png?v=${CV}" alt=""><img class="t" src="${CART}coin_tails.png?v=${CV}" alt="">`}</div></div>`;
        const picks = el("div", "cz-picks"); R.picks = {};
        for (const s of ["heads", "tails"]) { const b = el("button", "cz-pick", `<b>${s === "heads" ? "Heads" : "Tails"}</b><small>${G.FLIP_PAYS}×</small>`); b.type = "button"; b.addEventListener("click", () => { PICK.cointable = s; SFX.play("ui_click"); refresh(); }); R.picks[s] = b; picks.append(b); }
        R.lock = lockBtn(); R.lock.addEventListener("click", () => place(PICK.cointable)); R.note = el("p", "cz-note");
        R.bet.append(picks, stakeRow(), R.lock, R.note); sideCards("What it pays"); phase("Pick a side", "open");
        R.pays.innerHTML = `<div class="cz-rung"><span>You call it right</span><strong>${G.FLIP_PAYS}×</strong></div><div class="cz-rung"><span>You don't</span><strong>0</strong></div><div class="cz-rung"><span>Chance</span><strong>50%</strong></div>`;
      },
      refresh() { for (const s of ["heads", "tails"]) R.picks[s].classList.toggle("on", PICK.cointable === s); R.lock.disabled = busy; R.lock.textContent = busy ? "In the air…" : `Flip ${PICK.cointable} · ${money(bet)}`; },
      start() { const c = $("czCoin"); if (!calm()) c.classList.add("spin"); phase("In the air…"); SFX.play("coin_flip"); refresh(); },
      idle() { $("czCoin")?.classList.remove("spin"); refresh(); },
      async result(e) { const c = $("czCoin"), t = token; await wait(calm() ? 0 : 500); if (t !== token) return; c.classList.remove("spin"); c.style.transform = `rotateY(${1440 + (e.side === "tails" ? 180 : 0)}deg)`; await wait(calm() ? 50 : 1000); if (t !== token) return; c.style.transition = "none"; c.style.transform = `rotateY(${e.side === "tails" ? 180 : 0}deg)`; c.offsetWidth; c.style.transition = ""; settle(e, `${e.side === "heads" ? "Heads" : "Tails"} · ${e.payout ? `you win ${money(e.payout)}` : "you lose"}`); }
    },
    dicetable: {
      title: "Dice", sub: "Roll under your number · the lower you go, the more it pays",
      build() {
        R.board.innerHTML = `<div style="width:100%;display:grid;justify-items:center"><div class="cz-roll" id="czRoll">–</div><div class="cz-track"><div class="cz-zone" id="czZone"></div><div class="cz-marker" id="czMark" style="left:50%"></div></div><div class="cz-ticks"><span>1</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div>`;
        R.range = el("input", "cz-range"); R.range.type = "range"; R.range.min = G.DICE.min; R.range.max = G.DICE.max; R.range.value = diceTarget; R.range.setAttribute("aria-label", "Roll under");
        R.range.addEventListener("input", () => { diceTarget = +R.range.value; refresh(); });
        R.lock = lockBtn(); R.lock.addEventListener("click", () => place(diceTarget)); R.note = el("p", "cz-note"); R.bet.append(R.range, stakeRow(), R.lock, R.note); sideCards("What it pays", "slide to choose"); phase("Set your number", "open");
      },
      refresh() { const m = G.diceMult(diceTarget); $("czZone").style.width = `${diceTarget - 1}%`; R.mult.innerHTML = `Roll under ${diceTarget}<small>wins ${diceTarget - 1}% of the time · pays ${m}×</small>`; R.lock.disabled = busy; R.lock.textContent = busy ? "Rolling…" : `Roll · ${money(bet)} to win ${money(Math.floor(bet * m))}`;
        R.pays.innerHTML = [10, 25, 50, 75, 90].map((t) => `<div class="cz-rung${t === diceTarget ? " at" : ""}"><span>Under ${t} · ${t - 1}%</span><strong>${G.diceMult(t)}×</strong></div>`).join(""); },
      start() { phase("Rolling…"); SFX.play("dice"); const r = $("czRoll"); r.className = "cz-roll"; this.iv = setInterval(() => { r.textContent = 1 + Math.floor(Math.random() * 100); $("czMark").style.left = `${Math.random() * 100}%`; }, 70); refresh(); },
      idle() { clearInterval(this.iv); refresh(); },
      async result(e) { const t = token; await wait(calm() ? 0 : 450); clearInterval(this.iv); if (t !== token) return; const r = $("czRoll"); r.textContent = e.roll; r.className = `cz-roll ${e.payout ? "w" : "l"}`; $("czMark").style.left = `${e.roll}%`; await wait(calm() ? 0 : 550); if (t !== token) return; settle(e, `Rolled ${e.roll} · needed under ${e.target} · ${e.payout ? `you win ${money(e.payout)}` : "you lose"}`); }
    },
    slots: {
      title: "Slots", sub: "Three of a kind pays · three sevens takes the jackpot",
      build() {
        const strip = () => G.REELS.map((r) => `<img src="${CART}reel_${r.k}.png?v=${CV}" alt="">`).join("");
        R.board.innerHTML = `<div class="cz-reels">${[0, 1, 2].map((i) => `<div class="cz-reel" id="czReel${i}"><div class="cz-strip">${strip()}${strip()}</div></div>`).join("")}</div>`;
        this.show(["cherry", "bell", "seven"]);
        R.lock = lockBtn(); R.lock.addEventListener("click", () => place(null)); R.note = el("p", "cz-note"); R.bet.append(stakeRow(), R.lock, R.note); sideCards("What it pays", "three of a kind"); phase("Pull when ready", "open");
        R.pays.innerHTML = G.REELS.slice().reverse().map((r) => `<div class="cz-rung"><span>${img(`reel_${r.k}`)}${img(`reel_${r.k}`)}${img(`reel_${r.k}`)}</span><strong>${r.pay}×</strong></div>`).join("") + `<div class="cz-rung"><span>${img("reel_cherry")}${img("reel_cherry")} any two</span><strong>${G.SLOT_TWO_CHERRIES}×</strong></div>`;
      },
      show(keys, hit) { keys.forEach((k, i) => { const reel = $(`czReel${i}`), idx = G.REELS.findIndex((r) => r.k === k); reel.querySelector(".cz-strip").style.transform = `translateY(${-96 * idx}px)`; reel.classList.toggle("hit", !!hit); }); },
      refresh() { R.lock.disabled = busy; R.lock.textContent = busy ? "Spinning…" : `Spin · ${money(bet)}`; },
      start() { phase("Spinning…"); this.loop = SFX.play("slots_spin"); for (let i = 0; i < 3; i++) { const r = $(`czReel${i}`); r.classList.remove("hit", "stop"); r.querySelector(".cz-strip").style.transform = ""; if (!calm()) r.classList.add("spin"); } refresh(); },
      idle() { this.loop?.stop(); for (let i = 0; i < 3; i++) $(`czReel${i}`)?.classList.remove("spin"); refresh(); },
      async result(e) {
        const t = token; if (e.pot != null) jack.pot = e.pot; if (e.jackpot) jack.last = { name: env.you()?.name || "You", amt: e.jackpot };
        for (let i = 0; i < 3; i++) { await wait(calm() ? 0 : i ? 380 : 650); if (t !== token) return; const r = $(`czReel${i}`), idx = G.REELS.findIndex((x) => x.k === e.reels[i]); r.classList.remove("spin"); r.querySelector(".cz-strip").style.transform = `translateY(${-96 * idx}px)`; r.classList.add("stop"); SFX.play("reel_stop"); }
        this.loop?.stop(); await wait(calm() ? 0 : 250); if (t !== token) return; if (e.payout) for (let i = 0; i < 3; i++) $(`czReel${i}`).classList.add("hit");
        settle(e, e.jackpot ? `JACKPOT · ${money(e.payout)}` : e.payout ? `${e.mult}× · you win ${money(e.payout)}` : "No luck");
      }
    },
    wheel: {
      title: "Wheel", sub: "Red or black, or the gold sliver",
      build() {
        const W = G.WHEEL, w = (360 - W.gold) / W.slices, parts = [`#e8b83a 0 ${W.gold}deg`]; for (let i = 0; i < W.slices; i++) parts.push(`${i % 2 ? "#1a1a1a" : "#c8202c"} ${W.gold + i * w}deg ${W.gold + (i + 1) * w}deg`);
        R.board.innerHTML = `<div class="cz-wheelbox"><div class="cz-wheel" id="czWheel" style="background:conic-gradient(${parts.join(",")});transform:rotate(${wheelRot}deg)"></div><div class="cz-hub"></div><div class="cz-pin"></div></div>`;
        const picks = el("div", "cz-picks"); R.picks = {};
        for (const s of ["red", "black", "gold"]) { const b = el("button", `cz-pick ${s}`, `<b>${s[0].toUpperCase()}${s.slice(1)}</b><small>${W.pays[s]}×</small>`); b.type = "button"; b.addEventListener("click", () => { PICK.wheel = s; SFX.play("ui_click"); refresh(); }); R.picks[s] = b; picks.append(b); }
        R.lock = lockBtn(); R.lock.addEventListener("click", () => place(PICK.wheel)); R.note = el("p", "cz-note"); R.bet.append(picks, stakeRow(), R.lock, R.note); sideCards("What it pays"); phase("Pick a colour", "open");
        R.pays.innerHTML = `<div class="cz-rung"><span>Red · 49.2%</span><strong>${W.pays.red}×</strong></div><div class="cz-rung"><span>Black · 49.2%</span><strong>${W.pays.black}×</strong></div><div class="cz-rung next"><span>Gold · 1 in 60</span><strong>${W.pays.gold}×</strong></div>`;
      },
      refresh() { for (const s of ["red", "black", "gold"]) R.picks[s].classList.toggle("on", PICK.wheel === s); R.lock.disabled = busy; R.lock.textContent = busy ? "Spinning…" : `Spin on ${PICK.wheel} · ${money(bet)}`; },
      start() { phase("Spinning…"); SFX.play("chip"); refresh(); }, idle() { refresh(); },
      async result(e) { const w = $("czWheel"), t = token; wheelRot = Math.ceil(wheelRot / 360) * 360 + 360 * 4 + (360 - e.angle); w.style.transition = calm() ? "none" : "transform 2.8s cubic-bezier(.12,.72,.12,1)"; w.style.transform = `rotate(${wheelRot}deg)`; this.loop = SFX.play("roul_ball"); await wait(calm() ? 50 : 2900); this.loop?.stop(); if (t !== token) return; settle(e, `${e.color[0].toUpperCase()}${e.color.slice(1)} · ${e.payout ? `you win ${money(e.payout)}` : "you lose"}`); }
    },
    plinko: {
      title: "Plinko", sub: "Twelve rows of pegs · the edges pay 25×",
      build() {
        const P = G.PLINKO; let rows = ""; for (let r = 0; r < P.rows; r++) rows += `<div class="cz-pkrow">${"<i class='cz-peg'></i>".repeat(r + 1)}</div>`;
        R.board.innerHTML = `<div class="cz-pkwrap"><div class="cz-pk" id="czPk"><div class="cz-ball" id="czBall"></div>${rows}</div><div class="cz-buckets">${P.pays.map((x, i) => `<div class="cz-bucket ${x >= 4 ? "big" : x >= 1 ? "mid" : ""}" data-b="${i}">${x}×</div>`).join("")}</div></div>`;
        R.lock = lockBtn(); R.lock.addEventListener("click", () => place(null)); R.note = el("p", "cz-note"); R.bet.append(stakeRow(), R.lock, R.note); sideCards("What it pays", "how often"); phase("Drop when ready", "open");
        const C = [1, 12, 66, 220, 495, 792, 924]; R.pays.innerHTML = [0, 1, 2, 3, 4, 5, 6].map((i) => `<div class="cz-rung" data-r="${i}"><span>${i === 6 ? "the middle" : i === 0 ? "either edge" : `${i + 1} in from the edge`} · ${((C[i] * (i === 6 ? 1 : 2)) / 40.96).toFixed(i < 2 ? 2 : 1)}%</span><strong>${P.pays[i]}×</strong></div>`).join("");
      },
      refresh() { R.lock.disabled = busy; R.lock.textContent = busy ? "Falling…" : `Drop · ${money(bet)}`; },
      start() { phase("Falling…"); document.querySelectorAll(".cz-bucket.hit").forEach((b) => b.classList.remove("hit")); R.pays.querySelectorAll(".at").forEach((r) => r.classList.remove("at")); refresh(); }, idle() { refresh(); },
      async result(e) {
        const ball = $("czBall"), t = token, p = 26; let rights = 0; ball.classList.remove("landed"); ball.style.transition = "none"; ball.style.transform = "translate(0px,0px)"; ball.classList.add("go"); ball.offsetWidth; ball.style.transition = "";
        for (let r = 0; r < e.path.length; r++) { rights += e.path[r]; await wait(calm() ? 0 : 118); if (t !== token) return; ball.style.transform = `translate(${(rights - (r + 1) / 2) * p}px,${(r + 1) * p - 4}px)`; if (r % 2 === 0) SFX.play("chip", { vol: 0.25, rate: 1.2 + r * 0.04 }); }
        await wait(calm() ? 0 : 130); if (t !== token) return; ball.classList.add("landed"); ball.style.transform = `translate(${(e.bucket - 6) * p}px,${e.path.length * p + 14}px)`;
        document.querySelector(`.cz-bucket[data-b="${e.bucket}"]`)?.classList.add("hit"); R.pays.querySelector(`[data-r="${Math.min(e.bucket, 12 - e.bucket)}"]`)?.classList.add("at");
        await wait(calm() ? 0 : 200); if (t !== token) return; settle(e, e.payout > e.bet ? `${e.mult}× · you win ${money(e.payout)}` : e.payout === e.bet ? "1× · your stake comes back" : `${e.mult}× · ${money(e.payout)} back`);
      }
    },
    scratch: {
      title: "Scratch-Off", sub: "Nine boxes · three of a kind wins",
      build() {
        R.board.innerHTML = `<div class="cz-ticket idle" id="czTicket"><div class="cz-tktop"><b>GambaScape Scratch</b><span id="czTkNo">match three</span></div><div class="cz-tkgrid"><div class="cz-tkcells" id="czCells">${"<div class='cz-tkcell'></div>".repeat(9)}</div><canvas class="cz-foil gone" id="czFoil" width="300" height="300"></canvas></div></div>`;
        R.lock = lockBtn(); R.lock.addEventListener("click", () => (scratch && !scratch.done ? this.reveal() : place(null))); R.note = el("p", "cz-note"); R.bet.append(stakeRow(), R.lock, R.note); sideCards("The prizes", "chance per card"); phase("Buy a card", "open");
        R.pays.innerHTML = G.SCRATCH.map((s) => `<div class="cz-rung" data-k="${s.k}"><span>${img(sym(s.k))}${img(sym(s.k))}${img(sym(s.k))} · ${(s.w / 10).toFixed(1)}%</span><strong>${s.x}×</strong></div>`).join("");
        const cv = $("czFoil"); let down = false, strokes = 0, last = null;
        const rub = (ev) => { if (!scratch || scratch.done) return; const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * 300 / r.width, y = (ev.clientY - r.top) * 300 / r.height, c = cv.getContext("2d"); c.globalCompositeOperation = "destination-out"; c.lineWidth = 46; c.lineCap = "round"; c.beginPath(); c.moveTo(last?.x ?? x, last?.y ?? y); c.lineTo(x, y); c.stroke(); c.beginPath(); c.arc(x, y, 23, 0, 7); c.fill(); last = { x, y }; if (++strokes % 6 === 0) { SFX.play("chip", { vol: 0.12, rate: 1.6 }); const d = c.getImageData(0, 0, 300, 300).data; let clear = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 40) clear++; if (clear / (d.length / (4 * 97)) > 0.55) this.reveal(); } };
        cv.addEventListener("pointerdown", (ev) => { down = true; last = null; try { cv.setPointerCapture(ev.pointerId); } catch (x) {} rub(ev); }); cv.addEventListener("pointermove", (ev) => { if (down) rub(ev); }); cv.addEventListener("pointerup", () => { down = false; }); cv.addEventListener("pointercancel", () => { down = false; });
        scratch = null;
      },
      refresh() { const open = scratch && !scratch.done; R.lock.disabled = busy && !open; R.lock.classList.toggle("alt", !!open); R.lock.textContent = open ? "Reveal all" : busy ? "Printing…" : `Buy a card · ${money(bet)}`; lockStake(!!open); },
      start() { phase("Printing your card…"); this.pending = true; refresh(); }, idle() { this.pending = false; refresh(); },
      foil() { const cv = $("czFoil"), c = cv.getContext("2d"); c.globalCompositeOperation = "source-over"; const g = c.createLinearGradient(0, 0, 300, 300); g.addColorStop(0, "#d8d8e0"); g.addColorStop(0.5, "#9a9aa8"); g.addColorStop(1, "#c8c8d4"); c.fillStyle = g; c.fillRect(0, 0, 300, 300); c.fillStyle = "rgba(60,60,80,.35)"; c.font = "800 22px sans-serif"; c.textAlign = "center"; for (let y = 40; y < 300; y += 56) for (let x = 50; x < 320; x += 110) c.fillText("GAMBA", x + ((y / 56) % 2) * 40, y); c.fillStyle = "rgba(255,255,255,.5)"; c.font = "800 20px sans-serif"; c.fillText("SCRATCH HERE", 150, 160); cv.classList.remove("gone"); },
      async result(e) { this.pending = false; busy = false; scratch = { e, done: false }; $("czTicket").classList.remove("idle"); $("czCells").innerHTML = e.grid.map((k) => `<div class="cz-tkcell" data-k="${k}"><img src="${CART}${sym(k)}.png?v=${CV}" alt=""></div>`).join(""); $("czTkNo").textContent = `card · ${money(e.bet)}`; this.foil(); phase("Scratch it", "open"); R.pays.querySelectorAll(".at").forEach((r) => r.classList.remove("at")); refresh(); if (calm()) this.reveal(); },
      reveal() { if (!scratch || scratch.done) return; scratch.done = true; const e = scratch.e; $("czFoil").classList.add("gone"); if (e.prize) { document.querySelectorAll(`.cz-tkcell[data-k="${e.prize}"]`).forEach((c) => c.classList.add("win")); R.pays.querySelector(`[data-k="${e.prize}"]`)?.classList.add("at"); } settle(e, e.payout > e.bet ? `Three of a kind · ${e.mult}× · you win ${money(e.payout)}` : e.payout ? "Three gems · your stake comes back" : "No three of a kind"); }
    },
    hilo: {
      title: "Higher or Lower", sub: "Every right call multiplies your stake · cash out whenever you like", run: true,
      build() {
        R.board.innerHTML = `<div class="cz-hl"><div class="cz-trail" id="czTrail"></div><div class="cz-cardx empty" id="czCard"><span>?</span></div></div>`;
        const calls = el("div", "cz-picks"); R.calls = {};
        for (const s of ["higher", "lower"]) { const b = el("button", `cz-pick ${s === "higher" ? "up" : "down"}`); b.type = "button"; b.addEventListener("click", () => send({ t: "run", g: "hilo", op: "call", call: s })); R.calls[s] = b; calls.append(b); }
        R.callRow = calls; R.cash = lockBtn(); R.cash.addEventListener("click", () => send({ t: "run", g: "hilo", op: "cash" }));
        R.lock = lockBtn(); R.lock.addEventListener("click", () => startRun("hilo")); R.note = el("p", "cz-note"); R.stakeRow = stakeRow();
        R.bet.append(R.cash, calls, R.stakeRow, R.lock, R.note); sideCards("How it pays", "this card"); trail = [];
      },
      card(rank, suit, cls = "") { return `<div class="cz-cardx ${suit === 1 || suit === 2 ? "red" : ""} ${cls}">${G.HILO.names[rank]}<i>${SUITS[suit]}</i></div>`; },
      refresh() {
        const r = RUNS.hilo, big = $("czCard"); R.cash.hidden = R.callRow.hidden = !r; R.lock.hidden = R.stakeRow.hidden = !!r;
        if (r) {
          big.outerHTML = this.card(r.card, r.suit, this.fresh ? "flip" : "").replace('class="', 'id="czCard" class="'); this.fresh = false;
          for (const s of ["higher", "lower"]) { const ways = G.hiloWays(r.card, s), f = G.hiloFactor(r.card, s); R.calls[s].disabled = !ways; R.calls[s].innerHTML = `<b>${s === "higher" ? "▲ Higher" : "▼ Lower"}</b><small>${!ways ? "can't be" : f === 1 ? "can't lose · 1×" : `${(r.mult * f).toFixed(2)}× · ${Math.round(ways / 13 * 100)}%`}</small>`; }
          R.cash.disabled = !r.cash; R.cash.textContent = r.cash ? `Cash out ${money(r.cash)}` : "Make a call first"; R.mult.innerHTML = `${r.mult.toFixed(2)}×<small>card ${r.cards} of ${G.HILO.maxCards}${r.lucky ? " · 🍀 lucky" : ""}</small>`;
          R.pays.innerHTML = `<div class="cz-rung"><span>Higher than ${G.HILO.names[r.card]}</span><strong>${G.hiloWays(r.card, "higher") ? `${G.hiloFactor(r.card, "higher").toFixed(2)}×` : "–"}</strong></div><div class="cz-rung"><span>Lower than ${G.HILO.names[r.card]}</span><strong>${G.hiloWays(r.card, "lower") ? `${G.hiloFactor(r.card, "lower").toFixed(2)}×` : "–"}</strong></div><div class="cz-rung"><span>Same card</span><strong>push</strong></div><div class="cz-rung"><span>Tops out at</span><strong>${G.HILO.maxMult}×</strong></div>`;
        } else { R.lock.disabled = false; R.lock.textContent = `Deal · ${money(bet)}`; if (!this.shown) R.pays.innerHTML = `<div class="cz-rung"><span>From a 7</span><strong>2.00× either way</strong></div><div class="cz-rung"><span>From a 10, lower</span><strong>1.33×</strong></div><div class="cz-rung"><span>From a 10, higher</span><strong>4.00×</strong></div><div class="cz-rung"><span>Same card</span><strong>push</strong></div><div class="cz-rung"><span>Tops out at</span><strong>${G.HILO.maxMult}×</strong></div>`; }
        $("czTrail").innerHTML = trail.map((c) => this.card(c.card, c.suit, "sm")).join("");
      },
      run(e, had) {
        if (e.run && !had) { trail = []; this.fresh = true; phase("Higher or lower?", "open"); SFX.play("coin_flip"); R.mult.textContent = ""; }
        else if (e.step && e.run) { trail.push({ card: e.step.from, suit: this.lastSuit ?? 0 }); this.fresh = true; phase(e.step.tie ? "Same card · push" : "Right · go again?", "open"); SFX.play(e.step.tie ? "chip" : "gain", { vol: 0.6 }); }
        if (e.run) this.lastSuit = e.run.suit;
        if (e.over) { const o = e.over; this.shown = true; if (o.from) trail.push({ card: o.from, suit: this.lastSuit ?? 0 }); $("czCard").outerHTML = this.card(o.card, o.suit, `flip ${o.how === "bust" ? "bust" : "cashed"}`).replace('class="', 'id="czCard" class="'); record("hilo", o.payout - o.stake);
          if (o.how === "bust") { phase(`${G.HILO.names[o.card]} · not ${o.call} · you lose ${money(o.stake)}`, "bad"); SFX.play("lose"); R.mult.textContent = "Bust"; }
          else if (o.how === "refund") { phase("Nothing moved · your stake comes back"); SFX.play("chip"); }
          else { phase(`${o.auto ? "Top of the run · " : ""}Cashed out at ${o.mult}×`, "done"); pop(`+${money(o.payout - o.stake)}`, `${o.mult}×`); SFX.play(o.payout > o.stake * 4 ? "win_big" : "win_small"); R.mult.innerHTML = `${o.mult}×<small>paid ${money(o.payout)}</small>`; } }
      }
    },
    mines: {
      title: "Mines", sub: "Twenty-five tiles, a few of them bombs · every gem pays more", run: true,
      build() {
        const board = el("div", "cz-mines"); R.tiles = [];
        for (let i = 0; i < G.MINES.tiles; i++) { const b = el("button", "cz-tile"); b.type = "button"; b.addEventListener("click", () => { if (RUNS.mines) send({ t: "run", g: "mines", op: "pick", i }); }); R.tiles.push(b); board.append(b); }
        R.board.append(board);
        R.bombRow = el("div", "cz-bombs", "<span>Bombs</span>"); R.bombBtns = [];
        for (const n of [1, 3, 5, 10]) { const b = el("button", "", String(n)); b.type = "button"; b.addEventListener("click", () => { mineCount = n; SFX.play("ui_click"); refresh(); }); R.bombBtns.push([n, b]); R.bombRow.append(b); }
        R.cash = lockBtn(); R.cash.addEventListener("click", () => send({ t: "run", g: "mines", op: "cash" }));
        R.lock = lockBtn(); R.lock.addEventListener("click", () => startRun("mines")); R.note = el("p", "cz-note"); R.stakeRow = stakeRow();
        R.bet.append(R.cash, R.bombRow, R.stakeRow, R.lock, R.note); sideCards("What it pays", "gems found"); this.last = null; phase("Pick your bombs, then start", "open");
      },
      refresh() {
        const r = RUNS.mines, o = this.last, m = r ? r.mines : o ? o.mines : mineCount, found = r ? r.open.length : o ? o.open.length : 0, top = G.minesTop(m), stake = r ? r.stake : bet;
        R.cash.hidden = !r; R.lock.hidden = R.stakeRow.hidden = R.bombRow.hidden = !!r;
        for (const [n, b] of R.bombBtns) b.classList.toggle("on", n === mineCount);
        R.tiles.forEach((t, i) => { let cls = "cz-tile", inner = "", off = true;
          if (r) { if (r.open.includes(i)) { cls += " safe"; inner = img("gem"); } else off = false; }
          else if (o) { if (o.bombs.includes(i)) { cls += ` bomb${o.hit === i ? " hit" : ""}`; inner = img("bomb"); } else { cls += o.open.includes(i) ? " safe" : " dim"; inner = img("gem"); } }
          if (t.className !== cls) { t.className = cls; t.innerHTML = inner; } t.disabled = off; });
        if (r) { R.cash.disabled = !r.cash; R.cash.textContent = r.cash ? `Cash out ${money(r.cash)}` : "Find a gem first"; R.mult.innerHTML = found ? `${r.mult}×<small>next gem ${r.next}×${r.lucky ? " · 🍀 lucky" : ""}</small>` : `<small>${r.mines} bomb${r.mines === 1 ? "" : "s"} under there somewhere</small>`; }
        else { R.lock.disabled = false; R.lock.textContent = `${o ? "Go again" : "Start"} · ${money(bet)}`; }
        let html = ""; for (let k = 1; k <= top; k++) html += `<div class="cz-rung${k === found && (r || o?.how === "cash") ? " at" : r && k === found + 1 ? " next" : ""}"><span>${k} gem${k === 1 ? "" : "s"}</span><strong>${G.minesMult(m, k)}× · ${money(Math.floor(stake * G.minesMult(m, k)))}</strong></div>`;
        R.pays.innerHTML = html; R.pays.querySelector(".at,.next")?.scrollIntoView({ block: "nearest" });
      },
      run(e, had) {
        if (e.run && !had) { this.last = null; phase("Pick a tile", "open"); SFX.play("chip"); }
        else if (e.step && e.run) { phase(`${e.run.open.length} found · keep going or cash out`, "open"); SFX.play("gain", { vol: 0.6, rate: 1 + e.run.open.length * 0.05 }); }
        if (e.over) { const o = e.over; this.last = o; record("mines", o.payout - o.stake);
          if (o.how === "bust") { phase(`Boom · you lose ${money(o.stake)}`, "bad"); SFX.play("hurt"); SFX.play("lose"); R.mult.textContent = "Bust"; }
          else { phase(`${o.auto ? "Top of the ladder · " : ""}Cashed out at ${o.mult}×`, "done"); pop(`+${money(o.payout - o.stake)}`, `${o.mult}×`); SFX.play(o.payout > o.stake * 4 ? "win_big" : "win_small"); R.mult.innerHTML = `${o.mult}×<small>paid ${money(o.payout)}</small>`; } }
      }
    }
  };
  function startRun(g) { if (broke()) return; send({ t: "run", g, op: "start", amt: bet, mines: mineCount }); }

  /* ---------------------------------------------------------- the Fight Pit's betting window
     One fight for the whole room, so this is the roulette table's shape: who's fighting and what each pays, your money
     on one of them, everybody else's money, a clock. It is rebuilt from each message (they are few) except the clock
     and the health bars, which run off the page's own timer. */
  let fightSide = 0, fightTimer = 0, FV = null;
  const MART = "/v3/assets/img/glad/flat/";
  function fight(v, opening) {
    FV = v; if (GAME !== "fight" || opening) { GAME = "fight"; frame("The Fight Pit", "Two go in. Pick one. It's all luck."); sideCards("Money down", "this fight"); R.note = el("p", "cz-note"); }
    const names = v.f.map((f) => G.MOBS[f.t].name), mine = v.bets.filter((b) => b.me), myAmt = mine.reduce((a, b) => a + b.amt, 0), mySide = mine[0]?.side, betting = v.phase === "bet";
    if (mySide != null) fightSide = mySide;
    const pot = [0, 1].map((i) => v.bets.filter((b) => b.side === i).reduce((a, b) => a + b.amt, 0));
    R.board.innerHTML = `<div class="cz-card2">${v.f.map((f, i) => `${i ? `<div class="cz-vs">VS</div>` : ""}<button type="button" class="cz-fighter${betting && fightSide === i ? " on" : ""}${v.phase === "result" ? (v.winner === i ? " won" : " lost") : ""}" data-side="${i}" ${betting && (mySide == null || mySide === i) ? "" : "disabled"}>
      <img class="${i ? "flip" : ""}" src="${MART}${f.t}.png?v=3" alt=""><b>${esc(names[i])}</b><small>${esc(f.title)} · level ${G.MOBS[f.t].lvl}</small><strong>${v.pays[i]}×</strong><em>wins ${Math.round(v.p[i] * 100)}% of the time · ${money(pot[i])} on it</em>
      <div class="cz-hpbar" data-hp="${i}" ${betting ? "hidden" : ""}><u style="width:100%"></u></div></button>`).join("")}</div>`;
    R.board.querySelectorAll("[data-side]").forEach((b) => b.addEventListener("click", () => { fightSide = +b.dataset.side; SFX.play("ui_click"); fight(FV); }));
    R.bet.replaceChildren();
    if (betting) {
      R.lock = lockBtn(); R.lock.addEventListener("click", () => { if (!broke()) { send({ t: "fight", op: "bet", side: fightSide, amt: bet }); SFX.play("chip"); } });
      R.bet.append(stakeRow(), R.lock); if (myAmt) { const back = lockBtn("alt"); back.textContent = `Take my ${money(myAmt)} back`; back.style.height = "40px"; back.addEventListener("click", () => send({ t: "fight", op: "clear" })); R.bet.append(back); }
      R.lock.textContent = `${myAmt ? "Add" : "Bet"} ${money(bet)} on ${names[fightSide]} · pays ${v.pays[fightSide]}×`;
    }
    R.bet.append(R.note);
    note(betting ? (myAmt ? `You have ${money(myAmt)} on ${names[mySide]}. If it wins you're paid ${money(Math.floor(myAmt * v.pays[mySide]))}.` : `Up to ${money(G.maxBetOf(env.me()))} a fight. One side only.`) : v.phase === "fight" ? (myAmt ? `${money(myAmt)} riding on ${names[mySide]}.` : "No money on this one. The next pair is out in a moment.") : "");
    R.pays.innerHTML = `<div class="cz-betlist">${v.bets.length ? v.bets.map((b) => `<div class="${b.me ? "me" : ""}"><span>${esc(b.me ? "You" : b.name)} · ${esc(names[b.side])}</span><strong>${money(b.amt)}</strong></div>`).join("") : `<div><span>Nobody yet. Be the first.</span></div>`}</div>${v.hist.length ? `<h2 style="margin:10px 0 6px">Lately<small>who won, at what price</small></h2><div class="cz-recent">${v.hist.map((h) => `<span class="${h.mult >= 2 ? "w" : ""}">${esc(G.MOBS[h.t].name)} ${h.mult}×</span>`).join("")}</div>` : ""}`;
    if (v.phase === "result" && FV._paid !== v.round) { FV._paid = v.round; const w = v.last?.wins?.find((x) => x.name === env.you()?.name); if (myLast.round === v.round && myLast.amt) { record("fight", (w ? w.payout : 0) - myLast.amt); if (w) { pop(`+${money(w.payout - myLast.amt)}`, `${names[v.winner]} wins`); SFX.play(w.payout > myLast.amt * 3 ? "win_big" : "win_small"); } else SFX.play("lose"); } }
    if (myAmt) myLast = { round: v.round, amt: myAmt };
    clearInterval(fightTimer); const tick = () => {
      if (GAME !== "fight" || $("gameWin").hidden) return clearInterval(fightTimer);
      const left = Math.max(0, Math.ceil((FV.until - performance.now()) / 1000));
      phase(FV.phase === "bet" ? `Bets close in ${left}` : FV.phase === "fight" ? "They're at it" : `${names[FV.winner]} wins · next fight in ${left}`, FV.phase === "bet" ? "open" : FV.phase === "fight" ? "" : "done");
      if (FV.phase === "fight" && FV.script) { const elapsed = env.now() - FV.startedAt, done = FV.script.filter((h) => h.at <= elapsed), hp = done.length ? done[done.length - 1].hp : [100, 100]; R.board.querySelectorAll("[data-hp]").forEach((n) => { const v2 = Math.max(0, hp[+n.dataset.hp]); n.firstElementChild.style.width = `${v2}%`; n.firstElementChild.style.background = v2 > 35 ? "var(--green)" : "var(--red)"; }); }
      if (FV.phase === "result") R.board.querySelectorAll("[data-hp]").forEach((n) => { n.firstElementChild.style.width = +n.dataset.hp === FV.winner ? "30%" : "0%"; });
    }; tick(); fightTimer = setInterval(tick, 200);
    refresh();
  }
  let myLast = { round: 0, amt: 0 };

  /* ---------------------------------------------------------- the Cashier, in the same clothes */
  let lastCashed = null;
  /* THE HOUSE RUBY's exchange: Cash into real ZCoins. The window only asks; the game server takes the Cash and the SITE
     decides (allowance, ticket roll, payment). Everything shown here came back from there. */
  let atRuby = false, dexSt = null, dexMsg = null, dexZc = 5, dexTicket = null, dexWait = false;
  function dexCard() {
    const card = el("section", "cz-card cz-dex"), D = G.DEX, st = dexSt, left = st?.ok ? st.left : null, on = !!(st?.ok && st.enabled), have = cash();
    const most = Math.max(0, Math.min(left ?? 0, Math.floor(have / D.rate))); if (st?.ok && dexZc > most) dexZc = Math.max(1, most);
    card.innerHTML = `<h2>The Ruby's exchange<small>Cash into <em>real ZCoins</em></small></h2>
      <p class="cz-note" style="text-align:left">${money(D.rate)} of Cash is 1 ZCoin. Up to ${D.capHour} ZCoins an hour, tickets included.</p>
      ${st ? (on ? `<div class="cz-dexbar"><i style="width:${Math.round((left / D.capHour) * 100)}%"></i></div><p class="cz-note" style="text-align:left">${left} of ${D.capHour} left this hour${st.dev ? " · PRETEND (dev server): no ZCoins move" : ""}</p>` : `<p class="cz-dexmsg bad">${esc(st.message || "The Ruby isn't paying out right now.")}</p>`) : `<p class="cz-note" style="text-align:left">Asking the Ruby…</p>`}
      <div class="cz-dexrow">${[1, 5, 10, 25].map((n) => `<button type="button" class="cz-chip" data-zc="${n}" aria-pressed="${n === dexZc}"${on && n <= most ? "" : " disabled"}>${n} ZC</button>`).join("")}</div>
      <button type="button" class="cz-dexgo" id="czDexGo"${on && most >= 1 && !dexWait ? "" : " disabled"}>${most >= 1 || !on ? `Trade ${money(dexZc * D.rate)} for ${dexZc} ZCoin${dexZc === 1 ? "" : "s"}` : have < D.rate ? `You need ${money(D.rate)} for 1 ZCoin` : "Nothing left this hour"}</button>
      <button type="button" class="cz-dexgo alt" id="czDexTk"${on && left >= D.ticket.face && have >= D.ticket.face * D.rate && !dexWait ? "" : " disabled"} title="Pays ${D.ticket.table.filter(([z]) => z).map(([z, w]) => `${z} ZC (${w}%)`).join(", ")}, or nothing (${D.ticket.table.find(([z]) => !z)[1]}%). Uses ${D.ticket.face} of your hour.">Ruby ticket · ${money(D.ticket.face * D.rate)} · win up to ${D.ticket.table[0][0]} ZCoins</button>
      ${dexTicket ? `<div class="cz-rtk"><div><b>${dexTicket.zc ? `${dexTicket.zc} ZC` : "Nothing"}</b><small>${dexTicket.zc ? "paid to your ZCoins" : "better luck next ticket"}</small></div><button type="button" id="czRtkFoil"${dexTicket.shown ? ' class="off"' : ""}>SCRATCH</button></div>` : ""}
      <p class="cz-dexmsg ${dexMsg?.cls || ""}">${esc(dexMsg?.text || "")}</p>`;
    card.querySelectorAll("[data-zc]").forEach((b) => b.addEventListener("click", () => { dexZc = +b.dataset.zc; SFX.play("chip", { vol: 0.5 }); cashier(); }));
    card.querySelector("#czDexGo")?.addEventListener("click", () => { dexWait = true; dexMsg = { text: "The Ruby hums…" }; dexTicket = null; send({ t: "dex", op: "pay", zc: dexZc }); cashier(); });
    card.querySelector("#czDexTk")?.addEventListener("click", () => { dexWait = true; dexMsg = { text: "The Ruby prints a ticket…" }; dexTicket = null; send({ t: "dex", op: "ticket" }); cashier(); });
    card.querySelector("#czRtkFoil")?.addEventListener("click", (ev) => { ev.currentTarget.classList.add("off"); dexTicket.shown = true; if (dexTicket.zc) { SFX.play(dexTicket.zc >= 10 ? "win_big" : "win_small"); pop(`+${dexTicket.zc} ZC`, "real ZCoins"); } else SFX.play("lose"); });
    return card;
  }
  function dex(e) {
    dexWait = false; if (e.status) dexSt = e.status;
    if (e.error) dexMsg = { text: e.error, cls: "bad" };
    else if (e.done) {
      if (e.done.op === "ticket") { dexTicket = { zc: e.done.zc, shown: false }; dexMsg = { text: `Scratch it. (${money(e.done.cash)} paid.)`, cls: "" }; SFX.play("ui_open"); }
      else { dexMsg = { text: `${e.done.zc} ZCoin${e.done.zc === 1 ? "" : "s"} paid${e.done.balance != null ? `: you now have ${Number(e.done.balance).toLocaleString()} ZC on eastcoin.vip` : ""}.${e.done.again ? " (That was the one the Ruby was still working on.)" : ""}`, cls: "good" }; SFX.play("coins"); pop(`+${e.done.zc} ZC`, "real ZCoins"); }
    } else if (!dexMsg || dexMsg.text.endsWith("…")) dexMsg = e.held ? { text: "The Ruby is still working on your last exchange. Look again in a minute.", cls: "" } : null;
    if (GAME === "cashier" && atRuby && !$("gameWin").hidden) cashier();
  }
  /* THE DAILY PRIZE WHEEL: the server has already decided and paid the prize (e.i is its slice); this is the spin to it. */
  let prizeSpin = null;   /* { until, snd }: a wheel that is still turning */
  const prizeHush = () => { try { prizeSpin?.snd?.stop(); } catch (x) { /* already over */ } };
  function prize(e) {
    if (e.done && prizeSpin && performance.now() < prizeSpin.until && GAME === "prize" && !$("gameWin").hidden) return;   /* a second click while it turns: the first answer is the one being shown */
    prizeHush(); prizeSpin = null;
    GAME = "prize"; frame("Daily Prize Wheel", "One free spin a day · spin every day and the Cash slices grow"); const P = G.PRIZE, n = P.slices.length, step = 360 / n, streak = e.streak || 1;
    const cols = ["#c8202c", "#1d1a18", "#2a7a4a", "#1d1a18", "#c8202c", "#1d1a18", "#2a5a9a", "#1d1a18", "#c8202c", "#1d1a18", "#e8bf35", "#6a2a9a"];
    const disc = el("div", "cz-pwdisc"); disc.style.background = `conic-gradient(${P.slices.map((_, i) => `${cols[i % cols.length]} ${i * step}deg ${(i + 1) * step}deg`).join(",")})`;
    disc.innerHTML = P.slices.map((p, i) => `<span style="transform:rotate(${(i + 0.5) * step}deg);--r:46%"><b style="top:-138px">${esc(p.cash ? G.prizeText(p, e.done ? streak + 1 : streak) : (G.ITEMS[p.k].short || G.ITEMS[p.k].name))}</b></span>`).join("");
    const wrap = el("div", "cz-pw"); wrap.append(el("div", "cz-pwpin"), disc, el("div", "cz-pwhub")); R.board.append(wrap);
    const card = el("section", "cz-card"); card.innerHTML = `<h2>Your streak<small>${streak} day${streak === 1 ? "" : "s"} in a row</small></h2><p class="cz-note" style="text-align:left">Every day in a row adds ${P.streakStep * 100}% to the Cash slices, up to +${P.streakStep * P.streakMax * 100}%. Miss a day and it starts again. The wheel resets at midnight, Central.</p>`; R.side.append(card);
    const rest = (i) => { disc.style.transition = "none"; disc.style.transform = `rotate(${-(i + 0.5) * step}deg)`; };
    if (e.done) { if (e.i != null) rest(e.i); phase(e.text ? `Today's spin: you won ${e.text}` : "You've had today's spin", e.text ? "done" : "open"); return note("It's in your bag already. Come back tomorrow: it's free every day."); }
    const ms = env.calm() ? 300 : 4400; phase("Spinning…", "open"); const t = token;
    prizeSpin = { until: performance.now() + ms + 200, snd: env.calm() ? null : SFX.play("roul_ball", { vol: 0.6 }) };
    const to = 360 * 6 - (e.i + 0.5) * step + (Math.random() - 0.5) * step * 0.6;
    requestAnimationFrame(() => requestAnimationFrame(() => { disc.style.transform = `rotate(${env.calm() ? to % 360 : to}deg)`; if (env.calm()) disc.style.transition = "none"; }));
    setTimeout(() => { prizeHush(); if (t !== token || GAME !== "prize") return; phase(`You won ${e.text}!`, "done"); pop(e.text, streak > 1 ? `day ${streak} streak` : "free spin"); SFX.play("win_small"); note("It's in your bag. See you tomorrow."); }, ms);
  }
  function cashier(done) {
    if (done !== undefined) lastCashed = done; GAME = "cashier"; frame(atRuby ? "The House Ruby" : "Cashier", atRuby ? "Cash in what you found · trade Cash for real ZCoins" : "Everything you bring back, for what it said over it"); const me = env.me();
    const keys = [...new Set(me.inv.filter((s) => G.isLoot(s.k)).map((s) => s.k))], rows = keys.map((k) => ({ k, n: me.inv.filter((s) => s.k === k).reduce((a, s) => a + s.n, 0), v: G.valueOf(k), loot: G.isLoot(k) }));
    const loot = rows.filter((r) => r.loot), total = loot.reduce((a, r) => a + r.n * r.v, 0);
    phase(lastCashed ? `Paid out ${money(lastCashed.total)} · the tables are right behind you` : loot.length ? "Here's what it comes to" : "Nothing to cash in yet", lastCashed ? "done" : "open");
    R.board.innerHTML = `<div style="text-align:center"><div class="cz-total">${money(total)}</div><div class="cz-note" style="margin-top:6px">${loot.length ? "for everything you found and made" : "Out the arch: rocks, trees, fish and monsters. Make something from them at the camp in the Yard and it sells for double. (Anything you can wear or hold isn't sold here: Brutus, at the Forge, buys what's smithed.)"}</div></div>`;
    R.lock = lockBtn(); R.lock.textContent = "Cash in the lot"; R.lock.disabled = !loot.length; R.lock.addEventListener("click", () => send({ t: "cashout", op: "all" })); R.bet.append(R.lock);
    const card = el("section", "cz-card"); card.innerHTML = `<h2>In your bag<small>you have ${money(cash())}</small></h2>` + (rows.length ? rows.map((r) => `<div class="cz-csrow">${env.ico(r.k)}<span><b>${esc(G.ITEMS[r.k].name)}</b> × ${r.n.toLocaleString()}<small>${money(r.v)} each${(() => { const m = G.madeFrom(r.k); return m && G.valueOf(m.out) > r.v ? ` · <em style="color:var(--gold);font-style:normal">${esc(m.verb)} it first: ${esc(G.ITEMS[m.out].name.toLowerCase())} pays ${money(G.valueOf(m.out))}</em>` : ""; })()}</small></span><strong>${money(r.n * r.v)}</strong><button type="button" class="cz-chip" data-cs="${r.k}">Sell</button></div>`).join("") : `<p class="cz-note" style="text-align:left">Nothing in there is worth money yet.</p>`);
    if (atRuby) R.side.append(dexCard());
    R.side.append(card); card.querySelectorAll("[data-cs]").forEach((b) => b.addEventListener("click", () => send({ t: "cashout", op: "one", k: b.dataset.cs })));
  }

  return {
    open(g, info = {}) { const ui = UI[g]; if (!ui) return false; if (info.pot != null) { jack.pot = info.pot; jack.last = info.lastJack || null; } GAME = g; frame(ui.title, "Cash only · the house keeps a little"); phase(""); ui.build(); if (ui.run) send({ t: "run", g, op: "state" }); refresh(); return true; },
    result(e) { if (e.g !== GAME || !UI[e.g]) return; UI[e.g].result(e); },
    run(e) { const had = RUNS[e.g]; RUNS[e.g] = e.run; if (e.luck != null && env.me()) env.me().luck = e.luck; if (GAME !== e.g) return; UI[e.g].run(e, had); lockStake(!!e.run); refresh(); },
    me() { if ($("gameWin").hidden) return; if (GAME === "cashier") cashier(); else refresh(); },
    cashier(ruby) { lastCashed = null; atRuby = !!ruby; if (atRuby) { dexSt = null; dexMsg = null; dexTicket = null; dexWait = false; send({ t: "dex", op: "status" }); } cashier(); }, cashed(e) { cashier(e); }, dex, prize, fight,
    closed() { token++; busy = false; GAME = null; prizeHush(); prizeSpin = null; },
    blocked(k) { if (!GAME || GAME === "cashier") return; if (GAME === "fight") { phase(k === "thirst" ? "Too thirsty to gamble" : "Too hungry to gamble", "bad"); return note(G.NEED_TEXT[k]); } busy = false; UI[GAME]?.idle?.(); phase(k === "thirst" ? "Too thirsty to gamble" : "Too hungry to gamble", "bad"); note(G.NEED_TEXT[k]); refresh(); },
    get game() { return GAME; }
  };
}
