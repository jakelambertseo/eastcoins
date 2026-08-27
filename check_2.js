(() => {
  "use strict";

  const STORAGE_KEY = "eastcoinPicksV2StreamedBrandingMockup";
  const STARTING_BALANCE = 1000;
  const MIN_WAGER = 10;
  const MAX_FLAT_WAGER = 250;
  const BAILOUT_AMOUNT = 250;

  const fallbackGames = [
    {
      id:"was-phi",
      sport:"🏈 NFL",
      away:"Washington",
      awayShort:"WAS",
      home:"Philadelphia",
      homeShort:"PHI",
      start:"Tonight · 7:20 PM",
      community:[37,63]
    },
    {
      id:"buf-kc",
      sport:"🏈 NFL",
      away:"Buffalo",
      awayShort:"BUF",
      home:"Kansas City",
      homeShort:"KC",
      start:"Tonight · 8:15 PM",
      community:[46,54]
    },
    {
      id:"nyy-bos",
      sport:"⚾ MLB",
      away:"New York",
      awayShort:"NYY",
      home:"Boston",
      homeShort:"BOS",
      start:"Tonight · 6:10 PM",
      community:[58,42]
    },
    {
      id:"dal-min",
      sport:"🏀 NBA",
      away:"Dallas",
      awayShort:"DAL",
      home:"Minnesota",
      homeShort:"MIN",
      start:"Tomorrow · 7:00 PM",
      community:[44,56]
    }
  ];

  /*
    Streamed becomes the market/branding catalog when this prototype is
    hosted in the EastCoin repo. The fallback list keeps the mockup usable
    if Streamed is temporarily unavailable.
  */
  let games = fallbackGames;

  const rivals = [
    {name:"Zwades", initials:"Z", balance:1820, wins:28, losses:17, streak:4},
    {name:"Waldo", initials:"W", balance:1410, wins:22, losses:18, streak:2},
    {name:"Booty", initials:"B", balance:1130, wins:19, losses:21, streak:-1}
  ];

  const elements = {
    balances:[...document.querySelectorAll("[data-balance]")],
    profit:document.querySelector("[data-profit]"),
    record:document.getElementById("record"),
    accuracy:document.getElementById("accuracy"),
    pendingCount:document.getElementById("pendingCount"),
    pendingEc:document.getElementById("pendingEc"),
    streak:document.getElementById("streak"),
    rank:document.getElementById("rank"),
    myPicksBadge:document.getElementById("myPicksBadge"),
    games:document.getElementById("games"),
    myPicks:document.getElementById("myPicks"),
    leaderboards:document.getElementById("leaderboards"),
    history:document.getElementById("history"),
    prototypeGames:document.getElementById("prototypeGames"),
    bailout:document.getElementById("bailout"),
    bailoutButton:document.getElementById("bailoutButton"),
    backdrop:document.getElementById("betBackdrop"),
    closeBet:document.getElementById("closeBet"),
    selectedTeam:document.getElementById("selectedTeam"),
    modalBalance:document.getElementById("modalBalance"),
    modalMax:document.getElementById("modalMax"),
    customWager:document.getElementById("customWager"),
    betError:document.getElementById("betError"),
    potentialReturn:document.getElementById("potentialReturn"),
    lockPick:document.getElementById("lockPick"),
    reset:document.getElementById("resetPrototype"),
    toast:document.getElementById("toast"),
    catalogStatus:document.getElementById("catalogStatus"),
    stakeHotStreak:document.getElementById("stakeHotStreak"),
    stakeCommunityPot:document.getElementById("stakeCommunityPot"),
    stakeMission:document.getElementById("stakeMission"),
    stakeMissionCopy:document.getElementById("stakeMissionCopy"),
    stakeTier:document.getElementById("stakeTier"),
    stakeTierCopy:document.getElementById("stakeTierCopy"),
    badgeRack:document.getElementById("badgeRack"),
    riskLabel:document.getElementById("riskLabel"),
    riskFill:document.getElementById("riskFill"),
    riskCopy:document.getElementById("riskCopy"),
    matchupPot:document.getElementById("matchupPot"),
    potentialReturnValue:document.getElementById("potentialReturnValue")
  };

  let activeBet = null;
  let toastTimer = 0;

  function defaultState(){
    return {
      balance:STARTING_BALANCE,
      picks:[],
      transactions:[
        {
          id:"start-"+Date.now(),
          type:"starting_balance",
          amount:STARTING_BALANCE,
          description:"2026 season starting balance",
          createdAt:Date.now()
        }
      ],
      results:{},
      bailouts:0,
      missionRewardClaimed:false
    };
  }

  function loadState(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");
      if(parsed && Number.isFinite(parsed.balance) && Array.isArray(parsed.picks) && Array.isArray(parsed.transactions)){
        return parsed;
      }
    }catch{}
    return defaultState();
  }

  let state=loadState();

  function save(){
    localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  }

  function money(value){
    return Math.round(Number(value)||0).toLocaleString();
  }

  function ecLogo(size="sm"){
    return `<img class="ec-coin-logo ${size}" src="assets/eastcoins-logo.webp" alt="" aria-hidden="true">`;
  }

  function ecAmount(value,size="sm"){
    return `<span class="ec-coin-inline">${ecLogo(size)}<span>${money(value)}</span> EC</span>`;
  }

  function totalWagered(){
    return state.picks.reduce((sum,pick)=>sum+Number(pick.wager||0),0);
  }

  function communityPot(){
    /*
      Fake derived "pot" for visual stakes only. It is NOT a payout pool.
      Base value + deterministic contribution from the current board.
    */
    const marketBase=games.reduce((sum,game,index)=>{
      const split=Array.isArray(game.community)?game.community:[50,50];
      return sum+520+(index*135)+Math.abs(split[0]-50)*17;
    },0);
    return marketBase+totalWagered();
  }

  function matchupCommunityPot(game){
    const split=Array.isArray(game?.community)?game.community:[50,50];
    const marketIndex=Math.max(0,games.findIndex(candidate=>candidate.id===game?.id));
    const base=950+(marketIndex*170)+(Math.abs(split[0]-50)*31);
    const userPick=state.picks.find(pick=>pick.gameId===game?.id);
    return base+(userPick?.wager||0);
  }

  function riskMeta(wager){
    const balance=Math.max(1,state.balance);
    const ratio=Math.max(0,Math.min(1,Number(wager||0)/balance));

    if(ratio>=.22){
      return {
        label:"High",
        pct:100,
        copy:"Big swing — this fake wager uses a large chunk of your available EastCoin balance."
      };
    }

    if(ratio>=.12){
      return {
        label:"Medium",
        pct:64,
        copy:"Meaningful sweat — enough fake EastCoins are on the line to move your rank."
      };
    }

    return {
      label:"Low",
      pct:30,
      copy:"Small test wager relative to your available EastCoin balance."
    };
  }

  function highRollerTier(){
    const wagered=totalWagered();

    if(wagered>=1000)return {name:"👑 EastCoin Whale",copy:"1,000+ EC wagered in the prototype."};
    if(wagered>=500)return {name:"💎 Gold Roller",copy:"500+ EC wagered in the prototype."};
    if(wagered>=250)return {name:"🥈 Silver Sweat",copy:"250+ EC wagered in the prototype."};
    return {name:"🥉 Bronze Bettor",copy:`${money(wagered)} EC wagered so far.`};
  }

  function lockCountdown(game){
    if(game?.live)return "LIVE · PICKS LOCKED";
    const start=Number(game?.startTs||0);
    if(!start)return game?.start||"Upcoming";

    const diff=start-Date.now();
    if(diff<=0)return "STARTED · PICKS LOCKED";

    const minutes=Math.ceil(diff/60000);
    if(minutes<=60)return `LOCKS IN ${minutes}m`;

    const hours=Math.floor(minutes/60);
    const remain=minutes%60;
    if(hours<=4)return `LOCKS IN ${hours}h ${remain}m`;

    return game?.start||"Upcoming";
  }

  function eventTimestamp(value){
    let numeric=Number(value);
    if(!Number.isFinite(numeric)||numeric<=0)return 0;
    if(numeric<1_000_000_000_000)numeric*=1000;
    return numeric;
  }

  function badgeReference(team){
    return team?.badge||team?.logo||team?.image||team?.icon||"";
  }

  function normalizedTeam(value,fallback=""){
    if(!value)return null;
    if(typeof value==="string")return {name:value,badge:""};
    return {
      ...value,
      name:String(value.name||value.title||value.team||fallback||"Team"),
      badge:badgeReference(value)
    };
  }

  function splitTitleTeams(title){
    const text=String(title||"").trim();
    const parts=text
      .split(/\s+(?:vs\.?|versus|@|at)\s+/i)
      .map(part=>part.trim())
      .filter(Boolean);

    if(parts.length!==2)return {away:null,home:null};

    return {
      away:{name:parts[0],badge:""},
      home:{name:parts[1],badge:""}
    };
  }

  function normalizedTeams(match){
    const raw=match?.teams;
    let away=null;
    let home=null;

    if(Array.isArray(raw)){
      away=normalizedTeam(raw[0],"Away");
      home=normalizedTeam(raw[1],"Home");
    }else if(raw&&typeof raw==="object"){
      away=normalizedTeam(raw.away||raw.visitor||raw.team1||raw.a,"Away");
      home=normalizedTeam(raw.home||raw.host||raw.team2||raw.h,"Home");
    }

    away ||= normalizedTeam(match?.awayTeam||match?.away||match?.visitor,"Away");
    home ||= normalizedTeam(match?.homeTeam||match?.home||match?.host,"Home");

    if(!away||!home){
      const parsed=splitTitleTeams(match?.title);
      away ||= parsed.away;
      home ||= parsed.home;
    }

    return {away,home};
  }

  function sportFamily(match){
    const text=String(
      match?._eastcoinProviders?.ppv?.category||
      match?.category||
      ""
    ).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

    const has=(...values)=>values.some(value=>text.includes(value));

    if(has("nfl","ncaaf","american football","college football"))return "american-football";
    if(has("mlb","baseball"))return "baseball";
    if(has("nba","wnba","ncaab","basketball"))return "basketball";
    if(has("nhl","hockey"))return "hockey";
    if(has("soccer","epl","uefa","fifa","premier league")||text==="football")return "soccer";
    if(has("ufc","mma","boxing","combat"))return "combat";
    return "other";
  }

  function sportLabel(match){
    const family=sportFamily(match);
    const meta={
      "american-football":"🏈 NFL / Football",
      baseball:"⚾ MLB / Baseball",
      basketball:"🏀 Basketball",
      hockey:"🏒 Hockey",
      soccer:"⚽ Soccer",
      combat:"🥊 Combat",
      other:"🎯 Event"
    };
    return meta[family]||meta.other;
  }

  function initials(name){
    const words=String(name||"Team").trim().split(/\s+/).filter(Boolean);
    if(!words.length)return "?";
    if(words.length===1)return words[0].slice(0,3).toUpperCase();
    return `${words[0][0]||""}${words[words.length-1][0]||""}`.toUpperCase();
  }

  function teamAbbr(name){
    const words=String(name||"Team").trim().split(/\s+/).filter(Boolean);
    const last=words.at(-1)||"TEAM";
    if(last.length<=4)return last.toUpperCase();
    if(words.length>1){
      const acronym=words.map(word=>word[0]).join("").toUpperCase();
      if(acronym.length>=2&&acronym.length<=4)return acronym;
    }
    return last.slice(0,3).toUpperCase();
  }

  function teamBadgeUrl(team){
    const ref=badgeReference(team);
    const API=window.EastcoinStreamedAPI;
    return ref&&API?.badgeUrl ? API.badgeUrl(ref)||"" : "";
  }

  function matchupPoster(match){
    const API=window.EastcoinStreamedAPI;
    if(!API)return "";
    return API.posterUrl?.(match?.poster)||API.matchupPosterUrl?.(match)||"";
  }

  function formatStreamedStart(match){
    if(match?._eastcoinLive)return "LIVE · picks locked";
    const start=eventTimestamp(match?.date);
    if(!start)return "Upcoming";

    const date=new Date(start);
    const now=new Date();
    const sameDay=
      date.getFullYear()===now.getFullYear()&&
      date.getMonth()===now.getMonth()&&
      date.getDate()===now.getDate();

    return `${sameDay?"Today":date.toLocaleDateString([],{weekday:"short"})} · ${date.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}`;
  }

  function seededCommunity(id){
    let hash=0;
    for(const char of String(id||"event")){
      hash=((hash<<5)-hash)+char.charCodeAt(0);
      hash|=0;
    }
    const away=38+(Math.abs(hash)%25);
    return [away,100-away];
  }

  function streamedGame(match){
    const teams=normalizedTeams(match);
    if(!teams.away||!teams.home)return null;

    const id=String(match?.id||match?.matchId||match?.slug||"").trim();
    if(!id)return null;

    const startTs=eventTimestamp(match?.date);
    return {
      id,
      sport:sportLabel(match),
      family:sportFamily(match),
      away:teams.away.name||"Away",
      awayShort:teamAbbr(teams.away.name),
      awayLogo:teamBadgeUrl(teams.away),
      home:teams.home.name||"Home",
      homeShort:teamAbbr(teams.home.name),
      homeLogo:teamBadgeUrl(teams.home),
      poster:matchupPoster(match),
      start:formatStreamedStart(match),
      startTs,
      live:Boolean(match?._eastcoinLive),
      popular:Boolean(match?.popular),
      community:seededCommunity(id),
      streamed:true
    };
  }

  function isGameLocked(game){
    if(!game)return true;
    if(game.live)return true;
    if(game.startTs&&game.startTs<=Date.now())return true;
    return false;
  }

  function logoMarkup(game,selection){
    const src=selection==="away"?game?.awayLogo:game?.homeLogo;
    const name=selection==="away"?game?.away:game?.home;
    const fallback=initials(name);

    return `
      <div class="team-logo${src?" has-image":""}">
        ${src?`<img src="${src}" alt="" loading="lazy" decoding="async" data-pick-team-logo>`:""}
        <span>${fallback}</span>
      </div>
    `;
  }

  function seededOdds(game,selection){
    const key=`${game.id}:${selection}`;
    let hash=0;
    for(const char of key){
      hash=(hash*31 + char.charCodeAt(0)) >>> 0;
    }
    return (1.55 + (hash % 95)/100).toFixed(3);
  }

  function shortEventDate(game){
    if(!game?.startTs) return game?.sport || "Today";
    const d=new Date(game.startTs);
    const month=String(d.getMonth()+1).padStart(2,"0");
    const day=String(d.getDate()).padStart(2,"0");
    return `${month}/${day}`;
  }

  function shortEventTime(game){
    if(game?.live) return "LIVE";
    if(!game?.startTs) return (game?.start || "SOON").replace(/\s+/g," ").slice(0,10);
    return new Intl.DateTimeFormat("en-US",{
      hour:"numeric",
      minute:"2-digit",
      hour12:true,
      timeZoneName:"short"
    }).format(new Date(game.startTs));
  }

  function sportTicker(game){
    const family=game?.family||"";
    if(family==="american-football") return "NFL";
    if(family==="baseball") return "MLB";
    if(family==="basketball") return "NBA";
    if(family==="hockey") return "NHL";
    if(family==="soccer") return "SOCCER";
    if(family==="combat") return "UFC";
    return (game?.sport||"SPORT").toUpperCase();
  }

  function choiceButtonMarkup(game,selection,selected,disabled){
    const name=selection==="away" ? game.away : game.home;
    const short=selection==="away" ? game.awayShort : game.homeShort;
    const src=selection==="away" ? game.awayLogo : game.homeLogo;
    const publicPct=selection==="away" ? game.community[0] : game.community[1];
    const odds=seededOdds(game,selection);
    const fallback=initials(name);

    return `
      <button
        class="prediction-row${selected===selection?" selected":""}"
        data-pick="${game.id}"
        data-selection="${selection}"
        ${disabled?"disabled":""}>
        <span class="prediction-teamlogo${src?" has-image":""}">
          ${src?`<img src="${src}" alt="" loading="lazy" decoding="async" data-pick-team-logo>`:`<span>${fallback}</span>`}
        </span>
        <span class="prediction-copy">
          <strong>${name}</strong>
          <small>Odds: ${odds} · Public: ${publicPct}%</small>
        </span>
        <span class="prediction-odds">
          <b>${short}</b>
          <span>${selected===selection?"Selected":"Pick"}</span>
        </span>
        <span class="prediction-check" aria-hidden="true"></span>
      </button>
    `;
  }

  function gameById(id){
    return games.find(game=>game.id===id);
  }

  async function loadStreamedGames(){
    const API=window.EastcoinStreamedAPI;

    if(!API?.getToday){
      elements.catalogStatus.textContent="Demo catalog · Streamed adapter unavailable";
      elements.catalogStatus.classList.add("error");
      return;
    }

    try{
      const result=await API.getToday(false);
      const raw=Array.isArray(result?.data)?result.data:[];
      const mapped=raw
        .map(streamedGame)
        .filter(Boolean);

      const preferredOrder={
        "american-football":0,
        baseball:1,
        basketball:2,
        hockey:3,
        soccer:4,
        combat:5,
        other:9
      };

      mapped.sort((a,b)=>{
        const aLocked=isGameLocked(a);
        const bLocked=isGameLocked(b);

        /*
          Upcoming wagerable events first, then live/started events. Within
          each group use EastCoin's major-sport preference and start time.
        */
        if(aLocked!==bLocked)return Number(aLocked)-Number(bLocked);

        const sportDiff=
          (preferredOrder[a.family]??9)-
          (preferredOrder[b.family]??9);
        if(sportDiff)return sportDiff;

        if(a.popular!==b.popular)return Number(b.popular)-Number(a.popular);
        return (a.startTs||Infinity)-(b.startTs||Infinity);
      });

      if(mapped.length){
        /*
          Keep the prototype focused. Eight real markets is enough to judge
          the visual direction without turning this into the full sportsbook.
        */
        games=mapped.slice(0,8);
        elements.catalogStatus.textContent=`Live Streamed catalog · ${games.length} branded games`;
        elements.catalogStatus.classList.remove("error");
        elements.catalogStatus.classList.add("live");
        render();
      }else{
        elements.catalogStatus.textContent="Demo catalog · no two-team Streamed events found";
        elements.catalogStatus.classList.add("error");
      }
    }catch(error){
      console.warn("EastCoin Picks Streamed branding load failed:",error);
      elements.catalogStatus.textContent="Demo catalog · Streamed temporarily unavailable";
      elements.catalogStatus.classList.add("error");
    }
  }

  function pickForGame(id){
    return state.picks.find(p=>p.gameId===id);
  }

  function maxWager(){
    return Math.max(0,Math.min(MAX_FLAT_WAGER,Math.floor(state.balance*.25)));
  }

  function teamName(game,selection){
    return selection==="away"?game.away:game.home;
  }

  function teamShort(game,selection){
    return selection==="away"?game.awayShort:game.homeShort;
  }

  function currentStats(){
    const settled=state.picks.filter(p=>p.status==="won"||p.status==="lost");
    const wins=settled.filter(p=>p.status==="won").length;
    const losses=settled.filter(p=>p.status==="lost").length;
    const pending=state.picks.filter(p=>p.status==="pending");
    let streak=0;
    const ordered=[...settled].sort((a,b)=>(b.settledAt||0)-(a.settledAt||0));
    if(ordered.length){
      const first=ordered[0].status;
      for(const pick of ordered){
        if(pick.status!==first) break;
        streak+=first==="won"?1:-1;
      }
    }
    return {wins,losses,pending,streak};
  }

  function ledger(type,amount,description,pickId=null){
    state.transactions.unshift({
      id:"tx-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
      type,
      amount,
      pickId,
      description,
      createdAt:Date.now()
    });
  }

  function toast(message){
    elements.toast.textContent=message;
    elements.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>elements.toast.classList.remove("show"),2400);
  }

  function statusLabel(pick){
    if(!pick) return "";
    if(pick.status==="pending") return "Pending";
    if(pick.status==="won") return "Won";
    if(pick.status==="lost") return "Lost";
    if(pick.status==="refunded") return "Refunded";
    return pick.status;
  }

  function renderGames(){
    elements.games.innerHTML=games.map(game=>{
      const pick=pickForGame(game.id);
      const result=state.results[game.id];
      const locked=Boolean(result)||isGameLocked(game);
      const selected=pick?.selection;
      const poster=game.poster||"";
      const statusText=result
        ? (result==="void"?"VOID":`FINAL · ${teamShort(game,result)} won`)
        : lockCountdown(game);

      const badgeClass = locked ? "lock" : (game.popular ? "hot" : "cold");
      const badgeText = locked ? "Locked" : (game.popular ? "Hot board" : "Open");
      const ticketLabel = pick
        ? `${statusLabel(pick)} · ${money(pick.wager)} EC`
        : `Community pot ${money(matchupCommunityPot(game))} EC`;

      return `
        <article class="game-card${locked?" locked":""}${poster?" has-streamed-art":""}">
          ${poster?`<img class="pick-card-poster" src="${poster}" alt="" loading="lazy" decoding="async"><span class="pick-card-poster-shade"></span>`:""}
          <div class="prediction-shell">
            <div class="prediction-rail">
              <span class="prediction-rail-date">${shortEventDate(game)}</span>
              <span class="prediction-rail-time">${shortEventTime(game)}</span>
            </div>

            <div class="prediction-board">
              <div class="prediction-head">
                <span class="prediction-sport">${sportTicker(game)}</span>
                <span class="prediction-status ${locked?"locked":""}">${statusText}</span>
              </div>

              <div class="prediction-market">
                ${choiceButtonMarkup(game,"away",selected,Boolean(pick)||locked)}
                ${choiceButtonMarkup(game,"home",selected,Boolean(pick)||locked)}
              </div>

              <div class="prediction-footer">
                <div class="prediction-ticket">
                  ${ecLogo("sm")}
                  <span>
                    <strong>${ticketLabel}</strong>
                    <small>${game.awayShort} vs ${game.homeShort}</small>
                  </span>
                </div>
                <span class="prediction-badge ${badgeClass}">${badgeText}</span>
              </div>
            </div>
          </div>

          ${pick
            ? `<span class="game-status ${pick.status}">${statusLabel(pick)} · ${ecLogo("sm")}${money(pick.wager)} EC</span>`
            : locked
              ? `<span class="game-status">Picks locked</span>`
              : ""}
        </article>
      `;
    }).join("");

    elements.games.querySelectorAll("[data-pick-team-logo]").forEach(img=>{
      img.addEventListener("error",()=>{
        const wrap=img.closest(".prediction-teamlogo");
        if(wrap){
          const name=img.closest(".prediction-row")?.querySelector(".prediction-copy strong")?.textContent || "EC";
          wrap.innerHTML=`<span>${initials(name)}</span>`;
        }
      },{once:true});
    });
  }

  function renderMyPicks(){
    const sorted=[...state.picks].sort((a,b)=>b.createdAt-a.createdAt);
    if(!sorted.length){
      elements.myPicks.innerHTML='<div class="empty">No picks yet. Choose a winner from the Games tab and lock your first wager.</div>';
      return;
    }

    elements.myPicks.innerHTML=sorted.map(pick=>{
      const game=gameById(pick.gameId)||pick.game;
      const cls=pick.status==="won"?"positive":pick.status==="lost"?"negative":"pending-text";
      const value=pick.status==="won"
        ? `${ecLogo("sm")}+${money(pick.wager)} EC profit`
        : pick.status==="lost"
          ? `${ecLogo("sm")}-${money(pick.wager)} EC`
          : `${ecLogo("sm")}${money(pick.wager*2)} EC return`;
      return `
        <article class="pick-row">
          <div class="row-icon">${teamShort(game,pick.selection)}</div>
          <div class="row-copy">
            <strong>${teamName(game,pick.selection)} over ${teamName(game,pick.selection==="away"?"home":"away")}</strong>
            <p>${game.sport} · ${game.awayShort} vs ${game.homeShort}</p>
            <small>${statusLabel(pick)} · Wagered ${money(pick.wager)} EC</small>
          </div>
          <div class="row-value ${cls}">
            <strong>${value}</strong>
            <small>${pick.status==="pending"?"Potential payout":"Settled"}</small>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderHistory(){
    if(!state.transactions.length){
      elements.history.innerHTML='<div class="empty">No EC transactions yet.</div>';
      return;
    }
    const icons={starting_balance:"＋",wager:"−",payout:"＋",refund:"↩",bailout:"🛟",admin_adjustment:"±"};
    elements.history.innerHTML=state.transactions.map(tx=>{
      const positive=tx.amount>0;
      return `
        <article class="history-row">
          <div class="row-icon">${icons[tx.type]||"EC"}</div>
          <div class="row-copy">
            <strong>${tx.description}</strong>
            <p>${tx.type.replaceAll("_"," ")}</p>
            <small>${new Date(tx.createdAt).toLocaleString()}</small>
          </div>
          <div class="row-value ${positive?"positive":"negative"}">
            <strong class="ec-coin-inline">${ecLogo("sm")}<span>${positive?"+":""}${money(tx.amount)} EC</span></strong>
            <small>Ledger entry</small>
          </div>
        </article>
      `;
    }).join("");
  }

  function rankTitle(position){
    const titles={
      1:"Hall of Famer",
      2:"Super Bowl Winner",
      3:"Pro Bowler",
      4:"All-Pro",
      5:"Franchise Player",
      6:"Team Captain",
      7:"Starter",
      8:"Role Player",
      9:"Practice Squad",
      10:"Waterboy"
    };
    return titles[position] || "Free Agent";
  }

  function leaderboardData(){
    const stats=currentStats();
    const user={name:"You",initials:"YOU",balance:state.balance,wins:stats.wins,losses:stats.losses,streak:stats.streak};
    return [user,...rivals];
  }

  function renderLeaderboards(){
    const people=leaderboardData();
    const richest=[...people].sort((a,b)=>b.balance-a.balance);
    const accuracy=[...people].sort((a,b)=>{
      const ap=a.wins+ a.losses ? a.wins/(a.wins+a.losses):0;
      const bp=b.wins+ b.losses ? b.wins/(b.wins+b.losses):0;
      return bp-ap;
    });
    const streaks=[...people].sort((a,b)=>b.streak-a.streak);

    const board=(title,sub,list,format)=>`
      <section class="leader-card">
        <div class="leader-head"><strong>${title}</strong><small>${sub}</small></div>
        ${list.map((person,index)=>`
          <div class="rank">
            <span class="rank-num"><b>#${index+1}</b><span>${rankTitle(index+1)}</span></span>
            <span class="avatar">${person.initials.slice(0,2)}</span>
            <span class="rank-copy"><strong>${person.name}</strong><small>${person.wins}–${person.losses}<span class="leader-rank-tag"> · ${rankTitle(index+1)}</span></small></span>
            <span class="rank-score">${format(person)}</span>
          </div>
        `).join("")}
      </section>
    `;

    elements.leaderboards.innerHTML=
      board("💰 Money Ladder","Current available EastCoin balance",richest,p=>`${ecLogo("sm")}${money(p.balance)} EC`)+
      board("🎯 Best Accuracy","Settled picks",accuracy,p=>{
        const total=p.wins+p.losses;
        return total?`${Math.round(p.wins/total*100)}%`:"—";
      })+
      board("🔥 Hot Streak","Consecutive results",streaks,p=>p.streak>0?`W${p.streak}`:p.streak<0?`L${Math.abs(p.streak)}`:"—");

    const position=richest.findIndex(p=>p.name==="You")+1;
    elements.rank.textContent=`${rankTitle(position)} · #${position}`;
  }

  function renderPrototype(){
    elements.prototypeGames.innerHTML=games.map(game=>{
      const result=state.results[game.id];
      return `
        <div class="proto-game">
          <div>
            <strong>${game.awayShort} vs ${game.homeShort}</strong>
            <small>${result
              ? (result==="void"?"Voided":teamShort(game,result)+" already settled")
              : game.streamed
                ? "Streamed market · choose a fake result"
                : "Demo market · choose a fake result"}</small>
          </div>
          <div class="proto-actions">
            <button class="proto-btn" data-settle="${game.id}" data-winner="away" ${result?"disabled":""}>${game.awayShort} wins</button>
            <button class="proto-btn" data-settle="${game.id}" data-winner="home" ${result?"disabled":""}>${game.homeShort} wins</button>
            <button class="proto-btn" data-void="${game.id}" ${result?"disabled":""}>Void</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderMetrics(){
    const stats=currentStats();
    elements.record.textContent=`${stats.wins}–${stats.losses}`;
    const total=stats.wins+stats.losses;
    elements.accuracy.textContent=total?`${Math.round(stats.wins/total*100)}% accuracy`:"No settled picks";
    elements.pendingCount.textContent=stats.pending.length;
    elements.pendingEc.textContent=`${money(stats.pending.reduce((sum,p)=>sum+p.wager,0))} EC at risk`;
    elements.streak.textContent=stats.streak>0?`W${stats.streak}`:stats.streak<0?`L${Math.abs(stats.streak)}`:"—";
    elements.myPicksBadge.textContent=stats.pending.length?`(${stats.pending.length})`:"";
    const profit=state.balance-STARTING_BALANCE;
    elements.profit.textContent=`${profit>=0?"+":""}${money(profit)} EC`;
    elements.profit.className=profit>0?"positive":profit<0?"negative":"";
  }

  function renderGamification(){
    const stats=currentStats();
    const wagered=totalWagered();
    const tier=highRollerTier();
    const missionGoal=100;
    const missionProgress=Math.min(missionGoal,wagered);

    elements.stakeHotStreak.textContent=
      stats.streak>1
        ? `🔥 W${stats.streak} — you're hot`
        : stats.streak<-1
          ? `🥶 L${Math.abs(stats.streak)} — cold spell`
          : "No streak yet";

    elements.stakeCommunityPot.textContent=money(communityPot());
    elements.stakeMission.textContent=
      wagered>=missionGoal
        ? "Mission complete"
        : `Risk ${money(missionGoal-wagered)} more EC`;

    elements.stakeMissionCopy.textContent=
      `${money(missionProgress)} / ${money(missionGoal)} EC wagered · test reward unlocks at 100 EC.`;

    elements.stakeTier.textContent=tier.name;
    elements.stakeTierCopy.textContent=tier.copy;

    const achievements=[
      {
        icon:"🎟",
        name:"First Ticket",
        copy:"Lock your first pick",
        unlocked:state.picks.length>=1
      },
      {
        icon:"🔥",
        name:"Heating Up",
        copy:"Win 3 straight",
        unlocked:stats.streak>=3
      },
      {
        icon:"💎",
        name:"High Roller",
        copy:"Wager 250+ EC total",
        unlocked:wagered>=250
      },
      {
        icon:"🎯",
        name:"Sharpshooter",
        copy:"Reach 70% accuracy (5+ settled)",
        unlocked:(stats.wins+stats.losses)>=5 &&
          stats.wins/(stats.wins+stats.losses)>=.70
      },
      {
        icon:"🛟",
        name:"Bailed Out",
        copy:"Claim an EastCoin bailout",
        unlocked:Number(state.bailouts||0)>0
      }
    ];

    elements.badgeRack.innerHTML=achievements.map(item=>`
      <article class="achievement${item.unlocked?"":" locked"}">
        <span class="achievement-icon">${item.icon}</span>
        <span>
          <strong>${item.name}</strong>
          <small>${item.unlocked?"Unlocked":item.copy}</small>
        </span>
      </article>
    `).join("");
  }

  function renderWallet(){
    elements.balances.forEach(node=>node.textContent=money(state.balance));
    elements.bailout.classList.toggle("show",state.balance<50);
    elements.bailoutButton.disabled=state.balance>=50;
  }

  function render(){
    renderWallet();
    renderMetrics();
    renderGamification();
    renderGames();
    renderMyPicks();
    renderLeaderboards();
    renderHistory();
    renderPrototype();
  }

  function openBet(gameId,selection){
    const game=gameById(gameId);
    if(!game || pickForGame(gameId) || state.results[gameId] || isGameLocked(game)){
      if(game && isGameLocked(game)) toast("Picks are locked because this event has started.");
      return;
    }

    activeBet={gameId,selection,wager:Math.min(50,maxWager())};
    const max=maxWager();

    elements.selectedTeam.innerHTML=`
      ${logoMarkup(game,selection)}
      <div><strong>${teamName(game,selection)}</strong><small>${game.awayShort} vs ${game.homeShort} · ${game.start}</small></div>
    `;
    elements.modalBalance.textContent=money(state.balance);
    elements.modalMax.textContent=money(max);
    elements.customWager.value=activeBet.wager>=MIN_WAGER?activeBet.wager:"";
    elements.betError.textContent="";
    elements.backdrop.classList.add("open");
    document.body.style.overflow="hidden";
    updateBetPreview();
    elements.customWager.focus();
  }

  function closeBet(){
    elements.backdrop.classList.remove("open");
    document.body.style.overflow="";
    activeBet=null;
  }

  function updateBetPreview(){
    if(!activeBet) return;
    const wager=Math.floor(Number(elements.customWager.value)||0);
    activeBet.wager=wager;
    const max=maxWager();
    let error="";
    if(wager && wager<MIN_WAGER) error=`Minimum wager is ${MIN_WAGER} EC.`;
    if(wager>max) error=`Maximum wager right now is ${max} EC.`;
    if(wager>state.balance) error="You do not have enough EC.";
    elements.betError.textContent=error;

    if(elements.potentialReturnValue){
      elements.potentialReturnValue.textContent=money(wager*2);
    }

    const risk=riskMeta(wager);
    if(elements.riskLabel)elements.riskLabel.textContent=risk.label;
    if(elements.riskFill)elements.riskFill.style.width=`${risk.pct}%`;
    if(elements.riskCopy)elements.riskCopy.textContent=risk.copy;

    const game=activeBet ? gameById(activeBet.gameId) : null;
    if(elements.matchupPot){
      elements.matchupPot.textContent=money(matchupCommunityPot(game));
    }

    elements.lockPick.disabled=Boolean(error)||wager<MIN_WAGER;
    document.querySelectorAll("[data-wager]").forEach(btn=>{
      btn.classList.toggle("active",Number(btn.dataset.wager)===wager);
      btn.disabled=Number(btn.dataset.wager)>max;
    });
  }

  function lockPick(){
    if(!activeBet) return;
    const game=gameById(activeBet.gameId);
    const wager=Math.floor(Number(activeBet.wager)||0);
    const max=maxWager();

    if(wager<MIN_WAGER || wager>max || wager>state.balance){
      updateBetPreview();
      return;
    }

    const pick={
      id:"pick-"+Date.now(),
      gameId:activeBet.gameId,
      selection:activeBet.selection,
      wager,
      status:"pending",
      createdAt:Date.now(),
      game:{
        id:game.id,
        sport:game.sport,
        away:game.away,
        awayShort:game.awayShort,
        awayLogo:game.awayLogo||"",
        home:game.home,
        homeShort:game.homeShort,
        homeLogo:game.homeLogo||"",
        poster:game.poster||"",
        start:game.start
      }
    };

    state.balance-=wager;
    state.picks.push(pick);
    ledger("wager",-wager,`${teamShort(game,pick.selection)} pick locked`,pick.id);

    const wageredAfter=state.picks.reduce((sum,item)=>sum+Number(item.wager||0),0);
    if(wageredAfter>=100 && !state.missionRewardClaimed){
      state.missionRewardClaimed=true;
      state.balance+=50;
      ledger("admin_adjustment",50,"Daily mission reward: wager 100 fake EC");
    }

    save();
    closeBet();
    render();
    toast(`${teamShort(game,pick.selection)} locked for ${money(wager)} EC.`);
  }

  function launchConfetti(){
    const colors=["#f2c400","#ad0932","#38c877","#ffffff"];
    const originX=window.innerWidth*.5;
    const originY=Math.min(window.innerHeight*.38,300);

    for(let i=0;i<28;i++){
      const piece=document.createElement("span");
      piece.className="confetti-piece";
      piece.style.left=`${originX}px`;
      piece.style.top=`${originY}px`;
      piece.style.background=colors[i%colors.length];
      piece.style.setProperty("--x",`${(Math.random()-.5)*420}px`);
      piece.style.setProperty("--y",`${120+Math.random()*300}px`);
      document.body.appendChild(piece);
      window.setTimeout(()=>piece.remove(),1200);
    }
  }

  function flashOutcome(won){
    const target=document.querySelector(".wallet-card")||document.querySelector(".main");
    if(!target)return;
    target.classList.remove("win-flash","loss-flash");
    void target.offsetWidth;
    target.classList.add(won?"win-flash":"loss-flash");
    window.setTimeout(()=>target.classList.remove("win-flash","loss-flash"),650);
    if(won)launchConfetti();
  }

  function settle(gameId,winner){
    if(state.results[gameId]) return;
    const game=gameById(gameId);
    state.results[gameId]=winner;

    let userWon=false;
    let userLost=false;

    state.picks.filter(p=>p.gameId===gameId && p.status==="pending").forEach(pick=>{
      pick.settledAt=Date.now();
      if(pick.selection===winner){
        userWon=true;
        pick.status="won";
        const returnAmount=pick.wager*2;
        state.balance+=returnAmount;
        ledger("payout",returnAmount,`${teamShort(game,pick.selection)} winning payout`,pick.id);
      }else{
        userLost=true;
        pick.status="lost";
      }
    });

    save();
    render();

    if(userWon){
      flashOutcome(true);
      toast(`WINNER — ${teamShort(game,winner)} paid out fake EastCoins.`);
    }else if(userLost){
      flashOutcome(false);
      toast(`${teamShort(game,winner)} won. Your fake EastCoin ticket lost.`);
    }else{
      toast(`${teamShort(game,winner)} marked winner. Picks settled.`);
    }
  }

  function voidGame(gameId){
    if(state.results[gameId]) return;
    const game=gameById(gameId);
    state.results[gameId]="void";

    state.picks.filter(p=>p.gameId===gameId && p.status==="pending").forEach(pick=>{
      pick.status="refunded";
      pick.settledAt=Date.now();
      state.balance+=pick.wager;
      ledger("refund",pick.wager,`${game.awayShort} vs ${game.homeShort} void refund`,pick.id);
    });

    save();
    render();
    toast(`${game.awayShort} vs ${game.homeShort} voided and refunded.`);
  }

  function claimBailout(){
    if(state.balance>=50) return;
    state.balance+=BAILOUT_AMOUNT;
    state.bailouts=(state.bailouts||0)+1;
    ledger("bailout",BAILOUT_AMOUNT,`EastCoin bailout #${state.bailouts}`);
    save();
    render();
    toast(`Bailout claimed: +${BAILOUT_AMOUNT} EC.`);
  }

  function switchTab(tab){
    document.querySelectorAll(".tab").forEach(btn=>btn.classList.toggle("active",btn.dataset.tab===tab));
    document.querySelectorAll(".panel").forEach(panel=>panel.classList.toggle("active",panel.dataset.panel===tab));
    window.scrollTo({top:0,behavior:"smooth"});
  }

  document.addEventListener("click",event=>{
    const pick=event.target.closest("[data-pick]");
    if(pick){
      openBet(pick.dataset.pick,pick.dataset.selection);
      return;
    }

    const tab=event.target.closest("[data-tab]");
    if(tab){
      switchTab(tab.dataset.tab);
      return;
    }

    const jump=event.target.closest("[data-tab-jump]");
    if(jump){
      switchTab(jump.dataset.tabJump);
      return;
    }

    const quick=event.target.closest("[data-wager]");
    if(quick){
      elements.customWager.value=quick.dataset.wager;
      updateBetPreview();
      return;
    }

    const settleButton=event.target.closest("[data-settle]");
    if(settleButton){
      settle(settleButton.dataset.settle,settleButton.dataset.winner);
      return;
    }

    const voidButton=event.target.closest("[data-void]");
    if(voidButton){
      voidGame(voidButton.dataset.void);
    }
  });

  elements.customWager.addEventListener("input",updateBetPreview);
  elements.lockPick.addEventListener("click",lockPick);
  elements.closeBet.addEventListener("click",closeBet);
  elements.backdrop.addEventListener("click",event=>{
    if(event.target===elements.backdrop) closeBet();
  });
  elements.bailoutButton.addEventListener("click",claimBailout);
  elements.reset.addEventListener("click",()=>{
    if(!confirm("Reset all mock picks, EC, results, and history?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state=defaultState();
    save();
    render();
    toast("Prototype reset to 1,000 EC.");
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape" && elements.backdrop.classList.contains("open")) closeBet();
  });

  render();
  loadStreamedGames();
})();