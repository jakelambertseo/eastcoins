// /README.md is repo documentation, not part of the site. Without this,
// Pages serves it to anyone who asks.
export const onRequest = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
  });
