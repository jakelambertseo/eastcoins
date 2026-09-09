/* ============================================================
   /u/<twitch login>  — a person's profile, inside the site

   Serves the shell; the shell's "profile" route draws the page
   from /api/picks/profile. Only the <title> and preview tags are
   set here, so a pasted link says whose page it is.
   ============================================================ */

const h = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export async function onRequestGet(context) {
  const { request, env } = context;
  const segments = Array.isArray(context.params.path) ? context.params.path : [context.params.path];
  const login = String(segments.filter(Boolean)[0] || "").trim().toLowerCase();
  if (!/^[a-z0-9_]{2,25}$/.test(login)) return context.next();

  let title = `${login} — EastCoin`;
  let description = "Picks record, biggest win, worst beat, and what they play in the Green Room.";
  let image = "https://eastcoin.vip/assets/eastcoins-logo.webp";
  if (env.PICKS_DB) {
    const row = await env.PICKS_DB
      .prepare(`SELECT display_name, avatar_url FROM users WHERE twitch_login = ? COLLATE NOCASE LIMIT 1`)
      .bind(login)
      .first()
      .catch(() => null);
    if (row) {
      title = `${row.display_name || login} — EastCoin`;
      if (row.avatar_url) image = String(row.avatar_url);
    } else {
      description = "Nobody by that name has made a pick yet.";
    }
  }

  const shellUrl = new URL(request.url);
  shellUrl.pathname = "/";
  shellUrl.search = "";
  const shell = await env.ASSETS.fetch(new Request(shellUrl.toString(), request));

  const meta =
    `<meta property="og:title" content="${h(title)}">` +
    `<meta property="og:description" content="${h(description)}">` +
    `<meta property="og:image" content="${h(image)}">` +
    `<meta name="twitter:card" content="summary">`;

  const rewritten = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on("head", { element(el) { el.append(meta, { html: true }); } })
    .transform(shell);

  const headers = new Headers(rewritten.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(rewritten.body, { status: shell.status, headers });
}
