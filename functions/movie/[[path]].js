/* ============================================================
   /movie/<title-slug>   one film, inside the site

   Serves the ordinary shell — nav, Twitch chat, the lot — and the
   shell's screen view opens the film. All this adds is the <title>
   and the preview tags, so a link pasted in chat says what it is
   before anyone clicks.

   The catalog itself is members-only, and that does not change:
   the API refuses without a session and the page shows a login
   prompt. Only the name is public here, which is the whole point
   of a link being readable.
   ============================================================ */

import { parseMovie } from "../api/screen/_slug.js";
import { resolveSlug } from "../api/screen/resolve.js";

const h = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export async function onRequestGet(context) {
  const { request, env } = context;
  const segments = Array.isArray(context.params.path) ? context.params.path : [context.params.path];
  const path = String(segments.filter(Boolean).join("/") || "").trim().toLowerCase();

  const parsed = parseMovie(path);
  // Anything not name-shaped is a real file under /movie/, if one ever
  // lands there, and is served as one.
  if (!parsed) return context.next();

  let title = "Movies & TV — EastCoin";
  let description = "Watch together on EastCoin.";
  const found = await resolveSlug(env, "movie", parsed.slug).catch(() => null);
  if (found) {
    const year = String(found.item?.year || "").slice(0, 4);
    title = `${found.name}${year ? ` (${year})` : ""} — EastCoin`;
    description = found.item?.overview
      ? String(found.item.overview).slice(0, 180)
      : "Watch together on EastCoin.";
  }

  const shellUrl = new URL(request.url);
  shellUrl.pathname = "/";
  shellUrl.search = "";
  const shell = await env.ASSETS.fetch(new Request(shellUrl.toString(), request));

  const image = found?.item?.poster || found?.item?.backdrop || "https://eastcoin.vip/assets/eastcoins-logo.webp";
  const meta =
    `<meta property="og:title" content="${h(title)}">` +
    `<meta property="og:description" content="${h(description)}">` +
    `<meta property="og:image" content="${h(image)}">` +
    `<meta name="twitter:card" content="summary_large_image">`;

  const rewritten = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on("head", { element(el) { el.append(meta, { html: true }); } })
    .transform(shell);

  const headers = new Headers(rewritten.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(rewritten.body, { status: shell.status, headers });
}
