// /CLAUDE.md is the internal handoff doc. It stays in the repo for the
// people and tools working on the site, but it is not part of the site:
// Pages would otherwise serve it to anyone who asks.
export const onRequest = () =>
  new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" }
  });
