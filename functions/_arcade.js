/* The arcade's short addresses (2026-10-07, the owner: "short urls"): /lounge and /climb serve the ordinary shell, which opens the room
   from its own path, the way /movie/... and /u/... do. All this adds is a real <title> and preview tags, so a link pasted in chat says
   what it is. The rooms are members only and that does not change: the shell shows the door to anyone not signed in. */
const h = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function arcadePage(title, description) {
  return async (context) => {
    const { request, env } = context;
    const shellUrl = new URL(request.url); shellUrl.pathname = "/"; shellUrl.search = "";
    const shell = await env.ASSETS.fetch(new Request(shellUrl.toString(), request));
    const meta = `<meta property="og:title" content="${h(title)}"><meta property="og:description" content="${h(description)}">` +
      `<meta property="og:image" content="https://eastcoin.vip/assets/eastcoin-og.png"><meta name="twitter:card" content="summary_large_image">`;
    const out = new HTMLRewriter()
      .on("title", { element(el) { el.setInnerContent(title); } })
      .on("head", { element(el) { el.append(meta, { html: true }); } })
      .transform(shell);
    const headers = new Headers(out.headers); headers.set("Cache-Control", "no-store");
    return new Response(out.body, { status: shell.status, headers });
  };
}
