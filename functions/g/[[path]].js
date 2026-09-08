/* ============================================================
   /g/<away>-<home>-<YYYYMMDD>   one game, inside the site
   /g/<YYYYMMDD>                 that day's games
   /g/mkt_…                      the same by market id

   The link chat posts. It serves the ordinary site shell — top
   nav, Twitch chat, the lot — and the shell's game view draws
   the page from /api/picks/game. The only thing done here is the
   <title> and the preview tags, so a pasted link says which game
   it is before anyone clicks it.
   ============================================================ */

import { parseSlug } from "../api/picks/_slug.js";
import { loadMarket, titleFor } from "../api/picks/_game.js";

const h = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

function prettyDay(day) {
  const d = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(4, 6)) - 1, Number(day.slice(6, 8)), 17));
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const segments = Array.isArray(context.params.path) ? context.params.path : [context.params.path];
  const path = String(segments.filter(Boolean).join("/") || "").trim().toLowerCase();

  const isDay = /^\d{8}$/.test(path);
  const isGame = Boolean(parseSlug(path)) || /^mkt_/.test(path);

  // Anything that is not game-shaped is a file under /g/ (the original
  // mockup lives at /g/example) and is served as one.
  if (!isDay && !isGame) return context.next();

  let title = "EastCoin Picks";
  let description = "Every pick, payout and balance change, from the Community Ledger.";
  if (isDay) {
    title = `Picks — ${prettyDay(path)} — EastCoin`;
  } else if (env.PICKS_DB) {
    const market = await loadMarket(env.PICKS_DB, path).catch(() => null);
    if (market) {
      title = titleFor(market);
      description = market.state === "SETTLED"
        ? "Final score, every pick, and what each one paid."
        : "Locked line and every pick so far.";
    } else {
      title = "No game here — EastCoin Picks";
    }
  }

  const shellUrl = new URL(request.url);
  shellUrl.pathname = "/";
  shellUrl.search = "";
  const shell = await env.ASSETS.fetch(new Request(shellUrl.toString(), request));

  const meta =
    `<meta property="og:title" content="${h(title)}">` +
    `<meta property="og:description" content="${h(description)}">` +
    `<meta property="og:image" content="https://eastcoin.vip/assets/eastcoins-logo.webp">` +
    `<meta name="twitter:card" content="summary">`;

  const rewritten = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on("head", { element(el) { el.append(meta, { html: true }); } })
    .transform(shell);

  const headers = new Headers(rewritten.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(rewritten.body, { status: shell.status, headers });
}
