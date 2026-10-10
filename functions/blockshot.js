/* /blockshot -> /cs67 (2026-10-11): the shooter is named CS67 and lives in the site at /?view=cs67 (the shell shows it as /cs67), with
   the nav above and the Twitch rail beside it. Until today this served the game's own page standalone, without the shell (a lag test,
   2026-10-09); that page is still the raw file at /arcade/blockshot/ for anyone who wants it bare. Old links carry their query. */
export function onRequestGet({ request }) {
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/cs67${url.search}${url.hash}`, 302);
}
