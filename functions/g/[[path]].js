/* ============================================================
   EastCoin Picks — the game page

     /g/mustangs-seminoles-20260907   one game: every pick, paid out
     /g/20260907                      that day's games
     /g/mkt_…                         the same page by market id

   Rendered on the server from D1, with no script at all: it is the
   link the bot posts into chat, so it has to work in a Discord or
   iMessage preview and on a phone with a flaky signal. The page the
   mockup at /g/example described, made real.
   ============================================================ */

import { slugFor, parseSlug, dayBounds, nick } from "../api/picks/_slug.js";
import { totalReturn } from "../api/picks/_lib.js";

const h = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

const line = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
};

const initials = (name) => nick(name).split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 3) || "?";

function when(iso, opts) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { timeZone: "America/Chicago", ...opts });
}

// D1 writes CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC, without a
// zone marker; without the Z, Date would read it as local time.
const utc = (v) => (v && !/[TZ]/.test(v) ? v.replace(" ", "T") + "Z" : v);

/* ------------------------------------------------------------ data */

async function loadMarket(db, path) {
  if (/^mkt_/.test(path)) {
    return db.prepare(`SELECT * FROM markets WHERE id = ? LIMIT 1`).bind(path).first();
  }
  const parsed = parseSlug(path);
  const bounds = parsed && dayBounds(parsed.day);
  if (!bounds) return null;

  const rows = await db
    .prepare(`SELECT * FROM markets WHERE datetime(starts_at) BETWEEN datetime(?) AND datetime(?) ORDER BY starts_at`)
    .bind(bounds.from, bounds.to)
    .all();

  const hits = (rows.results || []).filter((m) => slugFor(m) === path);
  if (!hits.length) return null;
  // Two markets for one fixture (a reopened one): prefer the settled one,
  // then whichever actually has picks on it.
  hits.sort((a, b) => (b.state === "SETTLED") - (a.state === "SETTLED"));
  return hits[0];
}

async function loadPicks(db, marketId) {
  const rows = await db
    .prepare(
      `SELECT p.id, p.selection, p.wager, p.odds_locked, p.status, p.payout, p.profit,
              p.created_at, p.settled_at,
              u.twitch_login, u.display_name, u.avatar_url
         FROM picks p JOIN users u ON u.twitch_id = p.user_id
        WHERE p.market_id = ?
        ORDER BY p.profit DESC, p.wager DESC, p.created_at ASC`
    )
    .bind(marketId)
    .all();
  return rows.results || [];
}

async function loadOps(db, marketId) {
  const rows = await db
    .prepare(`SELECT status, COUNT(*) AS n FROM wallet_operations WHERE market_id = ? GROUP BY status`)
    .bind(marketId)
    .all();
  const out = { total: 0, confirmed: 0 };
  for (const r of rows.results || []) {
    out.total += Number(r.n);
    if (r.status === "CONFIRMED") out.confirmed += Number(r.n);
  }
  return out;
}

async function loadDay(db, day) {
  const bounds = dayBounds(day);
  if (!bounds) return [];
  const rows = await db
    .prepare(
      `SELECT m.*, (SELECT COUNT(*) FROM picks p WHERE p.market_id = m.id) AS pick_count
         FROM markets m
        WHERE datetime(m.starts_at) BETWEEN datetime(?) AND datetime(?)
        ORDER BY m.starts_at`
    )
    .bind(bounds.from, bounds.to)
    .all();
  return rows.results || [];
}

/* ------------------------------------------------------------ pages */

function shell(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet,noimageindex">
<title>${h(title)}</title>
<link href="/assets/eastcoin-favicon.svg?v=full-logo1" rel="icon" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600;700;800&display=swap">
<style>${CSS}</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
}

function gamePage(market, picks, ops) {
  const settled = market.state === "SETTLED";
  const voided = market.state === "VOID";
  const open = market.state === "OPEN" || market.state === "LOCKED";
  const winner = market.winner;   // 'away' | 'home' | null

  const away = { name: market.away_name, line: market.away_odds_locked, score: market.final_away_score, side: "away" };
  const home = { name: market.home_name, line: market.home_odds_locked, score: market.final_home_score, side: "home" };
  const winName = winner === "home" ? home.name : winner === "away" ? away.name : "";

  const sideOf = (p) => (p.selection === "home" ? home : away);
  const staked = (side) => picks.filter((p) => p.selection === side).reduce((n, p) => n + Number(p.wager), 0);
  const count = (side) => picks.filter((p) => p.selection === side).length;
  const totalStaked = staked("away") + staked("home");
  const paidOut = picks.reduce((n, p) => n + (p.status === "WON" || p.status === "REFUNDED" ? Number(p.payout) : 0), 0);

  const won = picks.filter((p) => p.status === "WON");
  const lost = picks.filter((p) => p.status === "LOST");
  const best = won.slice().sort((a, b) => b.profit - a.profit)[0];
  const worst = lost.slice().sort((a, b) => a.profit - b.profit)[0];
  const rightPct = won.length + lost.length ? Math.round(100 * won.length / (won.length + lost.length)) : null;

  const pill = settled ? "Settled" : voided ? "Voided" : market.state === "LOCKED" ? "Betting closed" : "Betting open";
  const pillClass = settled ? "final" : voided ? "final void" : "final open";

  const kick = when(market.starts_at, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const teamCell = (t) => `
      <div class="team${winner === t.side ? " won" : ""}">
        <div class="crest">${h(initials(t.name))}</div>
        <div class="name">${h(t.name)}</div>
        <div class="line">${h(line(t.line))}</div>
      </div>`;

  const score = (settled || voided) && Number.isInteger(away.score) && Number.isInteger(home.score)
    ? `<div class="score"><b class="${winner === "away" ? "win " : ""}nums">${away.score}</b><i>–</i><b class="${winner === "home" ? "win " : ""}nums">${home.score}</b></div>`
    : `<div class="score"><b class="nums">–</b><i>at</i><b class="nums">–</b></div>`;

  const tag = settled && winName
    ? `<div class="winner-tag">${h(winName)} win${market.settlement_detail && market.settlement_detail !== "Final" ? " · " + h(market.settlement_detail) : ""}</div>`
    : voided
      ? `<div class="winner-tag void">Voided · every stake refunded${market.settlement_detail ? " · " + h(market.settlement_detail) : ""}</div>`
      : "";

  const highlights = settled && picks.length ? `
  <div class="highlights">
    ${best ? `<div class="hl good"><span>Biggest win</span><b>${h(best.display_name || best.twitch_login)} +${best.profit}</b><em>${h(sideOf(best).name)} at ${h(line(best.odds_locked))}</em></div>` : ""}
    ${worst ? `<div class="hl bad"><span>Worst beat</span><b>${h(worst.display_name || worst.twitch_login)} −${Math.abs(worst.profit)}</b><em>Backed ${h(sideOf(worst).name)}</em></div>` : ""}
    ${rightPct !== null ? `<div class="hl"><span>Chat was</span><b>${rightPct}% right</b><em>${won.length} of ${won.length + lost.length} took ${h(winName)}</em></div>` : ""}
  </div>` : "";

  const aw = staked("away"), hm = staked("home");
  const split = picks.length ? `
  <div class="split">
    <div class="split-top"><span class="l${winner === "home" ? " dim" : ""}">${h(away.name)} · ${count("away")} pick${count("away") === 1 ? "" : "s"} · ${aw} ZC</span><span class="r${winner === "away" ? " dim" : ""}">${hm} ZC · ${count("home")} pick${count("home") === 1 ? "" : "s"} · ${h(home.name)}</span></div>
    <div class="bar"><i class="a" style="width:${totalStaked ? Math.round(100 * aw / totalStaked) : 50}%"></i><i class="b" style="width:${totalStaked ? 100 - Math.round(100 * aw / totalStaked) : 50}%"></i></div>
    <div class="split-note">${totalStaked} ZCoins staked across ${picks.length} pick${picks.length === 1 ? "" : "s"}</div>
  </div>` : "";

  const rows = picks.length ? picks.map((p) => {
    const side = sideOf(p);
    const cls = p.status === "WON" ? "won" : p.status === "LOST" ? "lost" : p.status === "REFUNDED" ? "refund" : "open";
    const would = totalReturn(p.wager, p.odds_locked);
    const payout = p.status === "WON"
      ? `<div class="payout up nums">+${p.profit}<small>returned ${p.payout}</small></div>`
      : p.status === "LOST"
        ? `<div class="payout down nums">−${p.wager}<small>returned 0</small></div>`
        : p.status === "REFUNDED"
          ? `<div class="payout nums">0<small>refunded ${p.payout}</small></div>`
          : `<div class="payout nums muted">${would}<small>if it wins</small></div>`;
    const av = p.avatar_url
      ? `<img class="av" src="${h(p.avatar_url)}" alt="" loading="lazy">`
      : `<div class="av">${h((p.display_name || p.twitch_login || "?")[0].toUpperCase())}</div>`;
    return `
    <div class="row ${cls}">
      ${av}
      <div class="who"><b>${h(p.display_name || p.twitch_login)}</b><span>${h(side.name)} @ ${h(line(p.odds_locked))}</span></div>
      <div class="stake"><b class="nums">${p.wager}</b>staked</div>
      ${payout}
    </div>`;
  }).join("") : `<p class="sub">No picks were placed on this game.</p>`;

  const settledAt = market.settled_at ? when(utc(market.settled_at), { hour: "numeric", minute: "2-digit" }) : "";
  const settlement = settled || voided ? `
  <div class="settle">
    <h3>Settlement</h3>
    <dl>
      <div><dt>Graded from</dt><dd>${market.settlement_source === "admin" ? "Closed by an admin" : "The Odds API · final score"}</dd></div>
      ${settledAt ? `<div><dt>Settled at</dt><dd>${h(settledAt)}</dd></div>` : ""}
      <div><dt>Total staked</dt><dd class="nums">${totalStaked} ZCoins</dd></div>
      <div><dt>Paid out</dt><dd class="nums">${paidOut} ZCoins</dd></div>
      <div><dt>Rounding</dt><dd>Up, in the bettor's favour</dd></div>
      <div><dt>Ledger</dt><dd>${ops.total} operation${ops.total === 1 ? "" : "s"}, ${ops.confirmed === ops.total ? "all confirmed" : `${ops.confirmed} confirmed`}</dd></div>
    </dl>
  </div>` : "";

  const body = `
  <div class="topbar">
    <a class="brand" href="/"><span class="dot">E</span> EastCoin Picks</a>
    <span class="${pillClass}">${pill}</span>
  </div>

  <div class="board">
    <div class="board-meta">
      <span>${h(market.league || market.sport)}</span>
      <span>${h(kick)}</span>
    </div>
    <div class="teams">${teamCell(away)}${score}${teamCell(home)}</div>
    ${tag}
  </div>
  ${highlights}
  ${split}

  <h2>Every pick</h2>
  <p class="sub">Everyone gets the same line — it was locked at ${h(line(away.line))} / ${h(line(home.line))} when the market opened, and never moved after that.${open ? " Betting is still " + (market.state === "OPEN" ? "open — <a href=\"/?view=picks\">get yours in</a>." : "closed for kick-off.") : ""}</p>
  <div class="rows">${rows}</div>
  ${settlement}

  <footer>
    Every pick, payout and balance change on this page is recorded in the Community Ledger ·
    <a href="/zcoin-picks">How ZCoin Picks works</a>
  </footer>
  <a class="backlink" href="/?view=picks">← Back to Picks</a>`;

  return shell(`EastCoin | ${market.away_name} at ${market.home_name} — Picks`, body);
}

function dayPage(day, markets) {
  const pretty = when(`${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}T17:00:00Z`, { weekday: "long", day: "numeric", month: "long" });
  const rows = markets.length ? markets.map((m) => {
    const state = m.state === "SETTLED" ? "won" : m.state === "VOID" ? "refund" : "open";
    const result = m.state === "SETTLED" && Number.isInteger(m.final_away_score)
      ? `${m.final_away_score}–${m.final_home_score}`
      : m.state === "VOID" ? "voided" : m.state === "LOCKED" ? "in play" : "open";
    return `
    <a class="row ${state} link" href="/g/${h(slugFor(m))}">
      <div class="who"><b>${h(m.away_name)} at ${h(m.home_name)}</b><span>${h(when(m.starts_at, { hour: "numeric", minute: "2-digit" }))} · ${Number(m.pick_count)} pick${Number(m.pick_count) === 1 ? "" : "s"}</span></div>
      <div class="payout nums">${h(result)}</div>
    </a>`;
  }).join("") : `<p class="sub">No games on this day.</p>`;

  const body = `
  <div class="topbar">
    <a class="brand" href="/"><span class="dot">E</span> EastCoin Picks</a>
    <span class="final open">${h(pretty)}</span>
  </div>
  <h2>Games</h2>
  <p class="sub">Every market EastCoin ran that day. Open one for the picks and payouts.</p>
  <div class="rows">${rows}</div>
  <a class="backlink" href="/?view=picks">← Back to Picks</a>`;

  return shell(`EastCoin | Picks — ${pretty}`, body);
}

function notFound(path) {
  return shell("EastCoin | Picks", `
  <div class="topbar"><a class="brand" href="/"><span class="dot">E</span> EastCoin Picks</a></div>
  <h2>No game here</h2>
  <p class="sub">Nothing is filed under <code>${h(path)}</code>. The link in chat is the reliable way in.</p>
  <a class="backlink" href="/?view=picks">← Back to Picks</a>`);
}

/* ------------------------------------------------------------ entry */

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  const segments = Array.isArray(context.params.path) ? context.params.path : [context.params.path];
  const path = String(segments.filter(Boolean).join("/") || "").trim().toLowerCase();

  const html = (body, status = 200) => new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }
  });

  if (!db || !path) return html(notFound(path || "/g/"), 404);

  if (/^\d{8}$/.test(path)) {
    return html(dayPage(path, await loadDay(db, path)));
  }

  const market = await loadMarket(db, path);
  if (!market) return html(notFound(path), 404);

  const [picks, ops] = await Promise.all([loadPicks(db, market.id), loadOps(db, market.id)]);
  return html(gamePage(market, picks, ops));
}

/* ------------------------------------------------------------ style
   Lifted from the mockup, plus states the mockup did not need. */
const CSS = `
  :root{--ink:#0c0a09;--panel:#161311;--panel-2:#1e1a17;--line:rgba(255,255,255,.09);--line-2:rgba(255,255,255,.16);--text:#f4ede5;--muted:#aca298;--muted-2:#7d746a;--gold:#e8bf35;--gold-dim:rgba(232,191,53,.13);--green:#4ddb8b;--green-dim:rgba(77,219,139,.11);--red:#ff6b85;--red-dim:rgba(255,107,133,.1);--display:"Bricolage Grotesque","Segoe UI",system-ui,sans-serif;--body:"Figtree","Segoe UI",system-ui,sans-serif}
  *{box-sizing:border-box}
  body{margin:0;background:var(--ink);color:var(--text);font-family:var(--body);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
  .wrap{max-width:720px;margin:0 auto;padding:26px 18px 70px}
  .nums{font-variant-numeric:tabular-nums}
  code{font-size:.9em;color:var(--gold)}
  .topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-bottom:18px;border-bottom:1px solid var(--line);margin-bottom:22px}
  .brand{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:-.01em;color:var(--text);text-decoration:none}
  .brand .dot{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:linear-gradient(150deg,#8e1231,#4a0a1c);color:var(--gold);font-size:.8rem;font-weight:800}
  .final{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;border:1px solid rgba(77,219,139,.35);background:var(--green-dim);color:var(--green);font-size:.7rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
  .final::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
  .final.open{border-color:rgba(232,191,53,.35);background:var(--gold-dim);color:var(--gold)}
  .final.void{border-color:var(--line-2);background:var(--panel-2);color:var(--muted)}
  .board{border:1px solid var(--line);border-radius:16px;background:var(--panel);overflow:hidden;margin-bottom:10px}
  .board-meta{padding:10px 18px;border-bottom:1px solid var(--line);background:var(--panel-2);display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:.72rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted-2)}
  .teams{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:22px 18px}
  .team{display:flex;flex-direction:column;gap:6px;align-items:center;text-align:center}
  .team .crest{width:52px;height:52px;border-radius:13px;display:grid;place-items:center;background:var(--panel-2);border:1px solid var(--line-2);font-family:var(--display);font-weight:800;font-size:1.05rem;color:var(--muted)}
  .team.won .crest{border-color:rgba(77,219,139,.45);color:var(--green);background:var(--green-dim)}
  .team .name{font-family:var(--display);font-weight:700;font-size:1rem;letter-spacing:-.01em;line-height:1.2}
  .team .line{font-size:.76rem;color:var(--muted-2);font-weight:600}
  .team.won .name{color:#fff}
  .score{display:flex;align-items:center;gap:12px}
  .score b{font-family:var(--display);font-weight:800;font-size:2.5rem;letter-spacing:-.04em;color:var(--muted-2);line-height:1}
  .score b.win{color:var(--text)}
  .score i{color:var(--muted-2);font-style:normal;font-size:1.1rem}
  .winner-tag{text-align:center;padding:9px 18px;border-top:1px solid var(--line);background:var(--green-dim);color:var(--green);font-size:.78rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
  .winner-tag.void{background:var(--panel-2);color:var(--muted)}
  .highlights{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin:20px 0 26px}
  .hl{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:14px 16px}
  .hl span{display:block;font-size:.66rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--muted-2);margin-bottom:6px}
  .hl b{display:block;font-family:var(--display);font-weight:700;font-size:1.02rem;letter-spacing:-.01em}
  .hl em{display:block;font-style:normal;font-size:.82rem;color:var(--muted);margin-top:2px}
  .hl.good b{color:var(--green)} .hl.bad b{color:var(--red)}
  .split{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:16px 18px;margin-bottom:26px}
  .split-top{display:flex;justify-content:space-between;gap:12px;font-size:.8rem;font-weight:700;margin-bottom:9px}
  .split-top .l{color:var(--green)} .split-top .r{color:var(--muted);text-align:right} .split-top .dim{color:var(--muted-2)}
  .bar{height:9px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.07);display:flex}
  .bar i{display:block;height:100%} .bar .a{background:linear-gradient(90deg,#4ddb8b,#2fae68)} .bar .b{background:rgba(255,255,255,.16)}
  .split-note{margin-top:9px;font-size:.78rem;color:var(--muted-2)}
  h2{font-family:var(--display);font-weight:700;font-size:1.15rem;letter-spacing:-.02em;margin:0 0 4px}
  .sub{margin:0 0 14px;color:var(--muted-2);font-size:.84rem} .sub a{color:var(--gold);text-decoration:none;font-weight:600}
  .rows{display:flex;flex-direction:column;gap:7px}
  .row{display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-left:3px solid var(--muted-2);border-radius:11px;background:var(--panel);padding:12px 15px;color:inherit;text-decoration:none}
  .row.won{border-left-color:var(--green)} .row.lost{border-left-color:var(--red)} .row.open{border-left-color:var(--gold)}
  .row.link:hover{background:var(--panel-2)}
  .av{width:34px;height:34px;flex:0 0 auto;border-radius:50%;display:grid;place-items:center;background:#2a1119;color:#f0c3cf;font-weight:800;font-size:.8rem;object-fit:cover}
  .who{flex:1;min-width:0} .who b{display:block;font-weight:700;font-size:.94rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap} .who span{display:block;font-size:.78rem;color:var(--muted-2)}
  .stake{flex:0 0 auto;text-align:right;font-size:.78rem;color:var(--muted-2);min-width:62px} .stake b{display:block;color:var(--muted);font-weight:700;font-size:.88rem}
  .payout{flex:0 0 auto;text-align:right;min-width:80px;font-family:var(--display);font-weight:800;font-size:1.05rem;letter-spacing:-.01em}
  .payout.up{color:var(--green)} .payout.down{color:var(--red)} .payout.muted{color:var(--muted)}
  .payout small{display:block;font-family:var(--body);font-size:.7rem;font-weight:600;color:var(--muted-2);letter-spacing:0}
  .settle{margin-top:26px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2);padding:16px 18px}
  .settle h3{font-size:.68rem;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--muted-2);margin:0 0 10px}
  .settle dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px 20px;margin:0}
  .settle dt{font-size:.74rem;color:var(--muted-2);margin-bottom:1px} .settle dd{margin:0;font-size:.9rem;font-weight:600;color:var(--text)}
  footer{margin-top:28px;color:var(--muted-2);font-size:.78rem;text-align:center} footer a{color:var(--gold);text-decoration:none;font-weight:600}
  .backlink{display:inline-block;margin-top:22px;color:var(--muted);font-size:.86rem;text-decoration:none;font-weight:600} .backlink:hover{color:var(--text)}
  @media (max-width:420px){.teams{padding:18px 12px;gap:6px}.score b{font-size:2rem}.team .crest{width:44px;height:44px}.stake{display:none}}
`;
