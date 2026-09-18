/* ============================================================
   /fishing                      the game
   /fishing/<section>            one page of it
   /fishing/u/<login>            an angler's reef

   Same trick as /g/ and /wrapped/: serve the one static file and
   set the <title> and preview tags here, so a pasted link says
   what it is before anyone clicks it. The page itself reads
   location.pathname and opens the right section — the slug list
   below and SLUGS in fishing.html are the same list, so a section
   added to one has to be added to the other.
   ============================================================ */

const h = (v) => String(v ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const SECTIONS = {
  "": ["EastCoin Fishing", "Cast, keep what you catch, and let the tank pay you while you are away."],
  tank: ["Your tank — EastCoin Fishing", "Fish you keep swim here and make pearls, awake or not."],
  diving: ["Diving — EastCoin Fishing", "Air, a bag, and whatever is on the bottom."],
  bosses: ["Bosses — EastCoin Fishing", "Five leviathans, one to a spot. Beat one and that water runs richer for good."],
  garden: ["Bait garden — EastCoin Fishing", "Grow the bait that decides what bites."],
  breeding: ["Breeding — EastCoin Fishing", "Pair them up, turn the eggs, see what hatches."],
  crafting: ["Crafting — EastCoin Fishing", "Turn what you dive up into bait, pearls and charms."],
  inventory: ["Inventory — EastCoin Fishing", "Everything you have brought up off the bottom."],
  skills: ["Skills — EastCoin Fishing", "Six skills, 0 to 99, and the levels are what open the shop."],
  quests: ["Quests — EastCoin Fishing", "Three a day, three a week, and a chest for the set."],
  derby: ["Weekly derby — EastCoin Fishing", "One species a week. Heaviest fish takes the title."],
  book: ["Fish book — EastCoin Fishing", "Every species you have landed, and the heaviest of each."],
  leaderboard: ["Leaderboard — EastCoin Fishing", "Where you sit against the room, skill by skill."],
  profile: ["Your reef — EastCoin Fishing", "Your card, your records and where they put you."],
  shop: ["Shop — EastCoin Fishing", "Rods, tanks, gardens, nests, air and bags."],
  controls: ["Mockup controls — EastCoin Fishing", "Bend the clock, the weather and your luck."]
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const segments = Array.isArray(context.params.path) ? context.params.path : [context.params.path];
  const parts = segments.filter(Boolean).map((v) => String(v).trim());
  const first = (parts[0] || "").toLowerCase();

  let title, description;
  if (first === "u") {
    // a person's reef. The login is only ever printed, never trusted.
    const login = (parts[1] || "").slice(0, 40);
    if (!login || !/^[\w.-]+$/.test(login)) return Response.redirect(new URL("/fishing", request.url).toString(), 302);
    title = `${login}'s reef — EastCoin Fishing`;
    description = `${login}'s tank, records and skills.`;
  } else if (first in SECTIONS && parts.length <= 1) {
    [title, description] = SECTIONS[first];
  } else {
    // anything else under /fishing is not a section; send them to the game
    return Response.redirect(new URL("/fishing", request.url).toString(), 302);
  }

  /* Ask for the EXTENSIONLESS path. Pages serves fishing.html at /fishing
     and 308s /fishing.html to it, so asking for the .html here hands back a
     redirect rather than the file — and the redirect is what got served.
     env.ASSETS skips Functions, so asking for /fishing cannot recurse. */
  const pageUrl = new URL(request.url);
  pageUrl.pathname = "/fishing";
  pageUrl.search = "";
  let page = await env.ASSETS.fetch(new Request(pageUrl.toString(), request));
  if (page.status >= 300 && page.status < 400 && page.headers.get("location")) {
    page = await env.ASSETS.fetch(new Request(new URL(page.headers.get("location"), request.url).toString(), request));
  }

  const meta =
    `<meta property="og:title" content="${h(title)}">` +
    `<meta property="og:description" content="${h(description)}">` +
    `<meta property="og:image" content="https://eastcoin.vip/v3/assets/img/reef/fishing-logo-lg.webp?v=1">` +
    `<meta name="twitter:card" content="summary">`;

  const rewritten = new HTMLRewriter()
    .on("title", { element(el) { el.setInnerContent(title); } })
    .on("head", { element(el) { el.append(meta, { html: true }); } })
    .transform(page);

  const headers = new Headers(rewritten.headers);
  headers.set("Cache-Control", "no-store");
  return new Response(rewritten.body, { status: page.status, headers });
}
