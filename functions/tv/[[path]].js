/* ============================================================
   /tv/<show-slug>              a show
   /tv/<show-slug>-s<N>         one season
   /tv/<show-slug>-s<N>-ep<M>   one episode

   The same job as /movie/: the ordinary shell, plus a <title> and
   preview tags so a pasted link reads as what it is. The shell's
   screen view does the opening; the catalog stays members-only.
   ============================================================ */

import { parseTv } from "../api/screen/_slug.js";
import { resolveSlug } from "../api/screen/resolve.js";

const h = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export async function onRequestGet(context) {
  const { request, env } = context;
  const segments = Array.isArray(context.params.path) ? context.params.path : [context.params.path];
  const path = String(segments.filter(Boolean).join("/") || "").trim().toLowerCase();

  const parsed = parseTv(path);
  if (!parsed) return context.next();

  let title = "Movies & TV — EastCoin";
  let description = "Watch together on EastCoin.";
  let image = "https://eastcoin.vip/assets/eastcoins-logo.webp";

  const found = await resolveSlug(env, "tv", parsed.slug).catch(() => null);
  if (found) {
    // "Lost — S1 E1" rather than the episode's own name: the episode
    // title is often a spoiler and always needs the show for context.
    const where = parsed.season
      ? ` — S${parsed.season}${parsed.episode ? ` E${parsed.episode}` : ""}`
      : "";
    title = `${found.name}${where} — EastCoin`;
    description = found.item?.overview
      ? String(found.item.overview).slice(0, 180)
      : "Watch together on EastCoin.";
    image = found.item?.poster || found.item?.backdrop || image;
  }

  const shellUrl = new URL(request.url);
  shellUrl.pathname = "/";
  shellUrl.search = "";
  const shell = await env.ASSETS.fetch(new Request(shellUrl.toString(), request));

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
