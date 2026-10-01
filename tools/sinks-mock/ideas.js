/* The sinks page: draws held.json (measured), today.json (the code's faucets and sinks), flows.json (one tracked day, if present),
   and the research and ideas below. */
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : Math.round(n).toLocaleString());
const $ = (id) => document.getElementById(id);
const getJ = (f) => (window.__D ? Promise.resolve(window.__D[f] ?? null) : fetch(f).then((r) => (r.ok ? r.json() : null)).catch(() => null));

/* ---------------- what other games do ---------------- */
const GAMES = [
  ["Old School RuneScape", "the template", [
    ["Grand Exchange tax", "2% of every sale; the take buys items off the market and deletes them"],
    ["Death's Office", "a fee scaled to what you were carrying to get your things back"],
    ["**Pet insurance**", "pay once per pet so a lost pet can be reclaimed"],
    ["**Player-owned house**", "rooms, furniture, a butler's wages: the biggest optional sink in the game"],
    ["**Managing Miscellania**", "fill a coffer; it drains about 10% a day while a crew gathers for you"],
    ["Gardeners and sawmills", "pay to protect a crop, pay to turn logs into planks"]]],
  ["RuneScape 3", "", [
    ["**Well of Goodwill**", "the whole server donated toward a goal that unlocked rewards for everyone"],
    ["Invention", "items taken apart for parts; the item is gone"]]],
  ["World of Warcraft", "", [
    ["Repairs", "gear wears out and costs gold to fix"],
    ["Auction house", "a deposit to list and a 5% cut"],
    ["**The Tundra Mammoth and the Brutosaur**", "20 thousand and 5 million gold mounts; the Brutosaur carries an auction house. Pure aspiration with a small convenience"],
    ["**Black Market Auction House**", "one-off old rares auctioned to the highest bid, and the bid leaves the game"],
    ["Transmog fees, flight paths, riding training", "small, constant, everywhere"]]],
  ["Diablo II / III / IV", "the ARPGs", [
    ["**The gambler**", "Gheed and Kadala sell unidentified items by slot; mostly junk, sometimes a unique. Spending to roll the dice IS the fun"],
    ["**Enchanting with a rising price**", "reroll one stat; each reroll on the same item costs more than the last"],
    ["Masterworking, gem upgrades", "long ladders of rising costs on gear you already own"]]],
  ["Path of Exile / Last Epoch", "", [
    ["Crafting eats the currency", "orbs are spent to reroll gear; the sink is the game"],
    ["Last Epoch's gambler", "a vendor that sells items of a chosen slot at random"]]],
  ["MapleStory", "the most casino of them", [
    ["**Star Force**", "each star costs more mesos and can fail; high stars can break the item"],
    ["Cubes", "reroll an item's hidden stats, over and over"]]],
  ["EVE Online", "", [
    ["**Ship insurance**", "pay a premium, get paid back if you lose the ship"],
    ["Broker fees and sales tax", "a share of every market order"],
    ["Clones and skillbooks", "constant costs for progress"]]],
  ["Final Fantasy XIV", "", [
    ["**Housing**", "plots and furniture; the house is taken back if you stop visiting"],
    ["Teleport fees, market tax by city", "small and constant"]]],
  ["Guild Wars 2 · Albion · GTA Online", "", [
    ["Legendary crafting (GW2)", "a huge, long, prestige sink"],
    ["Island upkeep (Albion), property upkeep (GTA)", "a daily cost to keep something you own working"]]],
  ["Animal Crossing · Stardew Valley", "the cosy ones", [
    ["**Public works projects**", "the town funds a bridge or a ramp together, through a donation box"],
    ["Home loan", "house upgrades paid off over time"],
    ["**The Golden Clock**", "Stardew's 10-million-gold late-game item: stops weeds, mostly bragging"]]]];
const bold = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
$("gameBox").innerHTML = GAMES.map(([g, sub, rows]) => `<div class="game"><b>${esc(g)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}<ul>${rows.map(([n, d]) => `<li>${bold(n)}: ${esc(d)}</li>`).join("")}</ul></div>`).join("");

/* ---------------- ideas for us ---------------- */
/* [name, from, how, reaches, kind, size guess, build, colour] */
const IDEAS = [
  ["The Back Room: gamble for gear", "Diablo's gambler, Last Epoch",
    "A window behind the Prize Counter (Bom's back room). Pick a slot and a tier you can wear; pay for a <b>sealed box</b>. Inside: usually a plain piece of that tier, sometimes a better reforge or a set piece, rarely a unique or a pet egg. The price is above what the plain piece costs at the Counter, so on average it takes tickets out. <b>It's a casino: this is the game.</b> The opening animation is a scratch card or a slot reel, drawn with the casino's own art.",
    "the regulars and the savers", "again", "a box costs about an hour's earnings for its tier", "1 week · a box art set", "#e8a03a"],
  ["Reforge, rising each time", "Diablo III's Mystic, Diablo IV's Occultist, MapleStory's Star Force",
    "The forge already reforges, and mockup 3 adds sockets and quality. Make the price <b>rise with each try on the same item</b> (×1.5 per try, reset when the item changes hands), and for the top tiers add a Star Force-style step: past +3 a try can fail and drop a level. Chasing the perfect roll on Relic gear becomes the sink the top players feed every week, and it scales on its own: only the richest chase the tenth try.",
    "the savers", "again · scales", "open-ended: it is what the savers will spend on", "3 days on the forge", "#ff6a3a"],
  ["The weekly auction", "WoW's Black Market Auction House",
    "One lot a week at the Prize Counter, a thing nobody can get any other way: a retired event item, a gold-skinned pet, a one-off title, the <b>naming rights to a boss for a week</b>, a statue of you in the Yard. Bids are held; the losers get theirs back; <b>the winning bid leaves the game</b>. The rich set the price themselves, so it reaches exactly as deep as their pockets. The CASINO line calls the winner.",
    "the savers", "again · scales", "the top bid each week, likely 100k-1M", "1 week", "#b08aff"],
  ["Buy a round for the house", "Animal Crossing's projects, RS3's Well of Goodwill",
    "The <b>War Horn</b> already sells for 350k to start the Yard raid in your name, and people buy it. Do the same for the server's <b>2X for 30 minutes</b> (today it only drops, 1 in 6,000 kills). The price rises with how many people are online, and the CASINO line says who paid. The rich get the thing they want most, an audience; everyone else gets an hour of double. Careful: 2X also doubles ticket drops, so the price has to be above what the server earns in the extra half hour, which the tracker measures.",
    "the savers", "again", "priced above the tickets a 2X makes", "2 days", "#5ad06a"],
  ["The top shelf", "Stardew's Golden Clock, WoW's Mammoth",
    "The Prize Counter's top shelf, priced in millions: a <b>giant plush</b>, a <b>gold slot machine</b> that sits in the Yard with your name on it, a limo that drops you at any bank (a real but small convenience), a gold frame on your trading card. One each, forever, and seen by everyone. Ten items between 1M and 10M are priced for the three savers sitting on 0.35-1.85M with nothing left to buy, and they'd want them.",
    "the savers", "once each", "up to ~30M if all ten sell", "1 week · 10 items of art", "#ffd34a"],
  ["Your suite at the hotel", "OSRS's house, FFXIV housing, Habbo",
    "A room upstairs at the casino: a bed, a trophy wall for your boss kills, a pen for your pets, a display case for the top shelf. Furniture is bought with tickets, and <b>room service</b> is a small weekly bill that keeps the lights on (miss it and the room just goes dark until you pay; nothing is lost). The biggest build here and the biggest long-term sink in every game that has one.",
    "every regular", "again · upkeep", "large, slow and steady", "4+ weeks · an interior", "#3a9ad8"],
  ["The crew (a coffer that drains)", "OSRS's Managing Miscellania",
    "Hire a crew at the Trailer Park: fill their coffer and they gather while you're gone, about 10% of the coffer a day, paid out as logs, ore and fish in a crate. Good for the players who play less. It also makes items, so it is priced to take out more tickets than the goods are worth.",
    "the middle", "again", "small per player, steady", "1 week", "#8a9aa8"],
  ["Hospital insurance", "EVE's ship insurance, OSRS pet insurance",
    "Pay a premium at the hospital and your next hour's death bills are waived. Bills already exist and are capped by band, so this just turns a punishment into a choice. Small, and mostly for the middle.",
    "the middle", "again", "small", "1 day", "#ff7a8a"],
  ["Projects that take tickets", "Animal Crossing's public works",
    "Sal's projects are nearly all scrap and sparks; only the dock took tickets (71,295 so far). Give each new project a <b>ticket share</b> and a <b>fountain</b> in the Yard: when the server fills it, everyone gets a buff for an hour, and the top three donors are named on it. Community, visible, and it already exists.",
    "everyone", "again", "steady, scaled by how many projects", "2 days", "#7ed060"]];
$("ideaBox").innerHTML = IDEAS.map(([n, from, how, reach, kind, size, build, col], i) => `<div class="idea" style="--ac:${col};--bg:${col}1c"><span class="rank">${i + 1}</span>
  <header><b>${esc(n)}</b><small>from ${esc(from)}</small></header><p>${how}</p>
  <div class="facts"><span>reaches <b>${esc(reach)}</b></span><span><b>${esc(kind)}</b></span><span>takes <b>${esc(size)}</b></span><span>build <b>${esc(build)}</b></span></div></div>`).join("");

/* not recommended, and why */
const NOT = [["Repairs and gear decay", "punishes the players with the least, and the game's tone is relaxed: nothing should wear out under you."],
  ["Teleport or travel fees", "a flat fee that new players feel and the top don't; fine only as the top shelf's limo, a luxury rather than a toll."],
  ["A bigger Exchange tax", "the Exchange has taken 2,721 tickets in total; it isn't where the wealth is, and a bigger cut just moves trades into chat."],
  ["Bigger death bills", "they already exist and are capped by band; raising them reaches new players first."]];

/* ---------------- build notes ---------------- */
const BUILD = [
  "<b>First, make the tracker add up</b> (a day): tag the flows it misses (the bar, island tiers, cashing to ZCoins; the Jackpot Thief, the Prize Wheel, Marked Cards, pet and gem sales) so a day's in minus out equals the change in what's held. Then every sink below can be measured from day one.",
  "<b>Order:</b> the weekly auction and buy-a-round first (a few days each, they reach the top at once and need almost no art), then the Back Room and the rising reforge (with mockup 3's forge work), then the top shelf (art), then the suite (a phase of its own).",
  "<b>Every one is a line in the tracker</b>: each new sink gets its own name in <code>:econ</code>'s out-by-sink, so the dashboard shows what each takes per day.",
  "<b>The Back Room's odds</b> live in one table in the rules, are shown on the window as a pay table (the casino way), and are tested to return under 100% of the price.",
  "<b>The auction</b> holds bids the way the Exchange holds a buy order, refunds every loser at the close, and burns only the winner's; one lot at a time, no proxy bidding.",
  "<b>Buy a round</b> reuses the server's 2X (<code>doubleOn</code>); it only adds a price and a name. The price is set from the tracked tickets-per-minute so a paid 2X can never create more than it costs.",
  "<b>Nothing here touches a bet</b>, the ZCoin cap or the casino's odds."];
$("buildList").innerHTML = BUILD.map((b) => `<li>${b}</li>`).join("") + `<li><b>Not recommended:</b> ${NOT.map(([n, w]) => `<i>${esc(n)}</i> (${esc(w)})`).join("; ")}</li>`;
$("decide").innerHTML = `<b>Things to decide:</b> which of the ranked ideas go in, and in what order; whether the Back Room can drop set pieces and pets (more exciting, but it makes it a faucet of rare items); the top shelf's items and prices; and whether the suite is worth a phase of its own.`;

/* ---------------- measured: who holds them, against hours played ---------------- */
getJ("held.json").then((H) => {
  if (!H) return;
  const h = H.held, hr = H.hours, P = H.players2;   /* players2: [held, hours, earned] richest first */
  const gone = Math.round((1 - H.keptOfEarned) * 100);   /* of every ticket play has ever paid out (VIP's "earned"), the share no longer held */
  $("heldLede").innerHTML = `From the backup of ${esc(H.takenAt.slice(0, 10))} (rules ${H.rules}): ${H.players} characters, ${hr.total.toLocaleString()} hours played between them. Held means carried plus banked. <b>Read it against hours played</b>: ${hr.under5} of the ${H.players} have played under five hours, and only ${hr.regulars} have played ten or more.`;
  $("heldTiles").innerHTML = [[fmt(h.total), "tickets held, all players"], [`${Math.round(h.top10share * 100)}%`, "held by the top ten"], [`${Math.round(hr.top10share * 100)}%`, "of all hours were the top ten's"], [`${Math.round(hr.earnedTop10share * 100)}%`, "of all tickets earned were theirs"], [fmt(hr.medEarnedPerHour), "earned an hour (median regular)"], [fmt(hr.medHeldPerHour), "kept an hour (median regular)"], [`${gone}%`, "of every ticket play ever paid has already left"]]
    .map(([v, l]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join("");
  /* each player: hours across, tickets held up (log); the dashed line is the regulars' median kept-per-hour */
  const W = 900, Hh = 320, L = 56, B = 40, maxH = Math.max(...P.map((p) => p[1])) * 1.05, lg = (v) => Math.log10(Math.max(1, v)), top = 6.5;
  const X = (x) => L + (x / maxH) * (W - L - 16), Y = (v) => Hh - B - (lg(v) / top) * (Hh - B - 16);
  let s = "";
  for (const t of [10, 100, 1e3, 1e4, 1e5, 1e6]) s += `<line x1="${L}" x2="${W - 10}" y1="${Y(t)}" y2="${Y(t)}" stroke="#2e2216"/><text x="${L - 6}" y="${Y(t) + 4}" fill="#a89070" font-size="11" text-anchor="end">${t >= 1e6 ? "1M" : fmt(t)}</text>`;
  for (let x = 0; x <= maxH; x += 20) s += `<text x="${X(x)}" y="${Hh - B + 16}" fill="#a89070" font-size="11" text-anchor="middle">${x}h</text>`;
  const m = hr.medHeldPerHour; let d = ""; for (let x = 1; x <= maxH; x += 2) d += `${d ? "L" : "M"}${X(x)} ${Y(m * x)}`;
  s += `<path d="${d}" stroke="#9ec8ff" stroke-dasharray="4 4" fill="none"/><text x="${X(maxH) - 4}" y="${Y(m * maxH) + 20}" fill="#9ec8ff" font-size="12" font-weight="700" text-anchor="end">keeping ${fmt(m)} an hour (the median regular)</text>`;
  P.forEach(([t, x, e], i) => { const saver = x >= 10 && t / x > 2.5 * m; s += `<circle cx="${X(x)}" cy="${Y(t)}" r="${saver ? 8 : 6}" fill="${saver ? "#ffd34a" : x >= 10 ? "#e8a03a" : "#7a6a50"}" stroke="#14120e" stroke-width="2"><title>${t.toLocaleString()} tickets held · ${x} hours · ${e.toLocaleString()} earned</title></circle>`; });
  s += `<text x="${L}" y="${Hh - 6}" fill="#a89070" font-size="11">each dot is one player · across: hours played · up: tickets held (log scale) · gold: keeping over two and a half times the usual per hour</text>`;
  $("heldSvg").setAttribute("viewBox", `0 0 ${W} ${Hh}`); $("heldSvg").innerHTML = s;
  const SV = P.filter(([t, x]) => x >= 10 && t / x > 2.5 * m), savers = SV.length;
  $("heldBig").innerHTML = `<b>It's mostly hours, and ${savers} savers.</b><span>The top ten hold ${Math.round(h.top10share * 100)}% of the tickets, but they also played ${Math.round(hr.top10share * 100)}% of the hours and earned ${Math.round(hr.earnedTop10share * 100)}% of everything paid out, so most of the gap is simply time: ${hr.under5} players have barely started. Per hour played, the regulars look alike (a median of ${fmt(hr.medEarnedPerHour)} earned and ${fmt(hr.medHeldPerHour)} kept an hour), and the economy already takes most of it back: <b>${gone}% of every ticket play has ever paid out has already left again</b>. The exception is <b>${savers} savers</b> (gold) keeping ${(Math.min(...SV.map(([t, x]) => t / x)) / m).toFixed(1)} to ${(Math.max(...SV.map(([t, x]) => t / x)) / m).toFixed(1)} times the usual per hour, sitting on ${fmt(Math.min(...SV.map(([t]) => t)))} to ${fmt(Math.max(...SV.map(([t]) => t)))} each with nothing left to buy. So the job isn't draining everyone; it's <b>giving the regulars something to want at every stage, and the savers something worth a million</b>.</span>`;
});

/* ---------------- the code's faucets and sinks ---------------- */
getJ("today.json").then((T) => {
  if (!T) { $("sinkTbl").outerHTML = `<p class="note">today.json not built yet.</p>`; return; }
  const pills = (r) => (r.tags || []).map((t) => `<span class="pill p-${t}">${{ once: "once", rep: "again", pct: "scales", new: "new players", rich: "the rich" }[t] || t}</span>`).join("");
  $("sinkTbl").innerHTML = `<tr><th>Sink</th><th>Price</th><th></th><th>Notes</th></tr>` + T.sinks.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.price)}</td><td>${pills(r)}</td><td>${esc(r.note || "")}</td></tr>`).join("");
  $("tapTbl").innerHTML = `<tr><th>Faucet</th><th>How much</th><th>Notes</th></tr>` + T.taps.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.amount)}</td><td>${esc(r.note || "")}</td></tr>`).join("");
  if (T.gap) $("gapBig").innerHTML = T.gap;
});

/* ---------------- one tracked day ---------------- */
getJ("flows.json").then((F) => {
  if (!F) return;
  const row = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const inT = Object.values(F.in).reduce((a, b) => a + b, 0), outT = Object.values(F.out).reduce((a, b) => a + b, 0);
  const tbl = (title, rows, tot) => `<h3>${title} · ${fmt(tot)}</h3><div class="wrapx"><table class="tbl"><tr><th>${title.startsWith("In") ? "Source" : "Sink"}</th><th class="num">Tickets</th><th class="num">Share</th></tr>${rows.map(([k, v]) => `<tr><td>${esc(F.names?.[k] || k)}</td><td class="num">${v.toLocaleString()}</td><td class="num">${Math.round((v / tot) * 100)}%</td></tr>`).join("")}</table></div>`;
  $("flowBox").innerHTML = `<p>${F.lede || ""}</p><div class="tiles">${[[fmt(inT), "tickets in"], [fmt(outT), "tickets out"], [`${outT >= inT ? "−" : "+"}${fmt(Math.abs(inT - outT))}`, outT >= inT ? "the day shrank the pile" : "the day grew the pile"], [`${Math.round((outT / inT) * 100)}%`, "of what came in went out"]].map(([v, l]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join("")}</div>${tbl("In, by source", row(F.in), inT)}${tbl("Out, by sink", row(F.out), outT)}${F.big ? `<div class="big">${F.big}</div>` : ""}`;
});
