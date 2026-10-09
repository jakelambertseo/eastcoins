/* /blockshot -> Blockshot, STANDALONE (2026-10-09, the owner: "without the top nav or the embedded twitch chat or anything that
   eastcoin.vip has currently, except for the users login (inside of the game)" — to see what the shell costs in lag). Until then it was the
   ordinary shell framing the game, like /lounge and /climb (see _arcade.js). Now the game's own page at /arcade/blockshot/index.html is
   served here as the document: its relative links are pointed at /arcade/blockshot/, the `embed` class fills the viewport with the stage
   (the same look it had inside the shell), and the only chrome is the game's own menu, which carries the Twitch sign-in and sign-out.
   The session is the site's cookie, so /api/blockshot/me and the match server see the same account as before. /?view=blockshot still
   frames it in the shell for comparison. Open to everyone, like the Game Room. */
const h = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const TITLE = "Blockshot — EastCoin", DESC = "A Krunker-style free-for-all on big maps built for slide-hopping. Three guns, levels, skins.";
const BASE = "/arcade/blockshot/";

export async function onRequestGet(context) {
  const { request, env } = context;
  const pageUrl = new URL(request.url); pageUrl.pathname = BASE; pageUrl.search = "";   // the directory, not index.html: the asset server answers "/x/index.html" with a 308 to "/x/", and that would be passed through
  const page = await env.ASSETS.fetch(new Request(pageUrl.toString(), request));
  const meta = `<meta property="og:title" content="${h(TITLE)}"><meta property="og:description" content="${h(DESC)}">` +
    `<meta property="og:image" content="https://eastcoin.vip/assets/eastcoin-og.png"><meta name="twitter:card" content="summary_large_image">`;
  const relative = (v) => v && !/^(\/|https?:|#|data:)/.test(v) ? BASE + v : v;
  const out = new HTMLRewriter()
    .on("html", { element(el) { el.setAttribute("class", "embed"); } })
    .on("title", { element(el) { el.setInnerContent(TITLE); } })
    .on("head", { element(el) { el.append(meta, { html: true }); } })
    .on("link[href]", { element(el) { el.setAttribute("href", relative(el.getAttribute("href"))); } })
    .on("script[src]", { element(el) { el.setAttribute("src", relative(el.getAttribute("src"))); } })
    .on("img[src]", { element(el) { el.setAttribute("src", relative(el.getAttribute("src"))); } })
    .transform(page);
  const headers = new Headers(out.headers); headers.set("Cache-Control", "no-store"); headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(out.body, { status: page.status, headers });
}
