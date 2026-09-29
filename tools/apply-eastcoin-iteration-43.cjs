const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function p(rel) {
  return path.join(
    ROOT,
    ...rel.split("/")
  );
}

function read(rel) {
  const full = p(rel);

  if (!fs.existsSync(full)) {
    throw new Error(
      `Missing required file: ${rel}`
    );
  }

  return fs.readFileSync(
    full,
    "utf8"
  );
}

function replaceOne(
  content,
  before,
  after,
  label
) {
  const count =
    content.split(before)
      .length - 1;

  if (count !== 1) {
    throw new Error(
      `${label}: expected 1 match, found ${count}.`
    );
  }

  return content.replace(
    before,
    after
  );
}

const files =
  new Map();

for (const rel of [
  "assets/eastcoins-picks-api.js",
  "assets/eastcoins-picks.js",
  "picks.html",
  "changelog.html"
]) {
  files.set(
    rel,
    read(rel)
  );
}

/* ================================================================
   PICKS API CLIENT
   ================================================================ */
{
  let js =
    files.get(
      "assets/eastcoins-picks-api.js"
    );

  const bootstrapAnchor = `  function getBootstrap() {
    return request("/bootstrap");
  }
`;

  const apiAddition = `${bootstrapAnchor}
  function getCatalog() {
    return request(
      "/catalog",
      {
        timeout: 12000
      }
    );
  }

  function ensureMarket({
    providerEventId,
    title,
    sport,
    startsAt,
    away,
    home,
    awayBadge,
    homeBadge
  }) {
    return request(
      "/markets/ensure",
      {
        method: "POST",
        body: {
          providerEventId,
          title,
          sport,
          startsAt,
          away,
          home,
          awayBadge,
          homeBadge
        }
      }
    );
  }
`;

  js = replaceOne(
    js,
    bootstrapAnchor,
    apiAddition,
    "Picks API catalog methods"
  );

  js = replaceOne(
    js,
    `    getBootstrap,
    placePick,`,
    `    getBootstrap,
    getCatalog,
    ensureMarket,
    placePick,`,
    "Picks API exports"
  );

  files.set(
    "assets/eastcoins-picks-api.js",
    js
  );
}

/* ================================================================
   PICKS FRONTEND — LIVE CATALOG + D1 POOL MERGE
   ================================================================ */
{
  let js =
    files.get(
      "assets/eastcoins-picks.js"
    );

  const applyAnchor =
    `  function applyBackendBootstrap(payload) {`;

  const helpers = `  function normalizeCatalogMarket(
    raw,
    persistedByEvent
  ) {
    const eventId =
      String(
        raw?.providerEventId ||
        raw?.id ||
        ""
      );

    if (!eventId) {
      return null;
    }

    const persisted =
      persistedByEvent.get(
        eventId
      );

    if (persisted) {
      return {
        ...persisted,
        sportsbook:
          raw?.consensus ||
          null,
        catalogOnly: false
      };
    }

    const startsAt =
      toTimestamp(
        raw?.commenceTime,
        0
      );

    if (
      !startsAt ||
      startsAt <= Date.now()
    ) {
      return null;
    }

    return {
      id:
        \`catalog:\${eventId}\`,
      eventId,
      sport:
        String(
          raw?.sportKey ||
          raw?.sportTitle ||
          "other"
        ),
      family:
        String(
          raw?.family ||
          sportFamilyFromKey(
            raw?.sportKey
          )
        ),
      league:
        String(
          raw?.sportTitle ||
          ""
        ),
      away:
        String(
          raw?.awayTeam ||
          "Away"
        ),
      home:
        String(
          raw?.homeTeam ||
          "Home"
        ),
      awayLogo: "",
      homeLogo: "",
      startTs: startsAt,
      live: false,
      popular:
        String(
          raw?.sportKey ||
          ""
        ) ===
          "americanfootball_nfl",
      state: "OPEN",
      pool: {
        away: 0,
        home: 0,
        total: 0,
        awayCount: 0,
        homeCount: 0
      },
      userPick: null,
      sportsbook:
        raw?.consensus ||
        null,
      catalogOnly: true
    };
  }

  function mergedBackendMarkets(
    payload,
    catalogPayload
  ) {
    const persisted =
      Array.isArray(
        payload?.markets
      )
        ? payload.markets
            .map(
              normalizeBackendMarket
            )
            .filter(
              (market) =>
                market.id
            )
        : [];

    const persistedByEvent =
      new Map(
        persisted
          .filter(
            (market) =>
              market.eventId
          )
          .map(
            (market) => [
              market.eventId,
              market
            ]
          )
      );

    const catalogGames =
      Array.isArray(
        catalogPayload?.games
      )
        ? catalogPayload.games
        : [];

    const merged =
      catalogGames
        .map(
          (game) =>
            normalizeCatalogMarket(
              game,
              persistedByEvent
            )
        )
        .filter(Boolean);

    const catalogIds =
      new Set(
        merged.map(
          (market) =>
            market.eventId
        )
      );

    /*
      Keep a persisted upcoming market if the provider catalog was temporarily
      incomplete, but do not reintroduce already-started games into Open Markets.
    */
    for (
      const market of
      persisted
    ) {
      if (
        catalogIds.has(
          market.eventId
        )
      ) {
        continue;
      }

      if (
        market.startTs >
        Date.now()
      ) {
        merged.push({
          ...market,
          catalogOnly: false
        });
      }
    }

    return merged.sort(
      (left, right) => {
        const priority = (
          market
        ) => {
          const sport =
            String(
              market?.sport ||
              ""
            ).toLowerCase();

          if (
            sport ===
            "americanfootball_nfl"
          ) {
            return 0;
          }

          if (
            sport ===
            "baseball_mlb"
          ) {
            return 1;
          }

          if (
            sport ===
            "mma_mixed_martial_arts"
          ) {
            return 2;
          }

          if (
            sport ===
            "americanfootball_ncaaf"
          ) {
            return 3;
          }

          return 4;
        };

        return (
          priority(left) -
            priority(right) ||
          left.startTs -
            right.startTs
        );
      }
    );
  }

${applyAnchor.replace("payload", "payload, catalogPayload = null")}`;

  js = replaceOne(
    js,
    applyAnchor,
    helpers,
    "Picks backend catalog helpers"
  );

  const oldGames = `    state.games = Array.isArray(payload?.markets)
      ? payload.markets
          .map(normalizeBackendMarket)
          .filter((market) => market.id)
      : [];`;

  js = replaceOne(
    js,
    oldGames,
    `    state.games =
      mergedBackendMarkets(
        payload,
        catalogPayload
      );`,
    "Picks market merge"
  );

  js = replaceOne(
    js,
    `    els.catalogStatus.textContent =
      \`Live Picks · \${state.games.length} current markets\`;`,
    `    const catalogLive =
      Boolean(
        catalogPayload?.ok
      );

    els.catalogStatus.textContent =
      catalogLive
        ? \`Live sportsbook catalog · \${state.games.length} eligible markets\`
        : \`EastCoin Picks · \${state.games.length} current markets · live catalog unavailable\`;`,
    "Picks catalog status"
  );

  const oldBootstrap = `        const payload =
          await API.getBootstrap();`;

  js = replaceOne(
    js,
    oldBootstrap,
    `        const [
          payload,
          catalogPayload
        ] =
          await Promise.all([
            API.getBootstrap(),
            API?.getCatalog
              ? API
                  .getCatalog()
                  .catch(
                    () => null
                  )
              : Promise.resolve(
                  null
                )
          ]);`,
    "Picks bootstrap catalog fetch"
  );

  js = replaceOne(
    js,
    `          applyBackendBootstrap(
            payload
          );`,
    `          applyBackendBootstrap(
            payload,
            catalogPayload
          );`,
    "Picks bootstrap apply"
  );

  const oldEmpty = `    if (!list.length) {
      els.marketList.innerHTML =
        '<div class="empty">No current markets match that search.</div>';
      return;
    }`;

  js = replaceOne(
    js,
    oldEmpty,
    `    if (!list.length) {
      const message =
        query
          ? "No current markets match your search."
          : state.mode ===
              "unavailable"
            ? "Picks is temporarily unavailable."
            : "No eligible sportsbook markets are available right now.";

      els.marketList.innerHTML =
        \`<div class="empty">\${message}</div>\`;
      return;
    }`,
    "Picks empty state"
  );

  const openBetAnchor =
    `  function openBet(gameId, side) {
    const game = gameById(gameId);
    if (!game) return;`;

  const openBetReplacement =
    `  async function prepareCatalogMarket(
    game,
    side
  ) {
    if (
      !game?.catalogOnly ||
      state.mode !==
        "backend"
    ) {
      return false;
    }

    if (
      !state.session
        .authenticated
    ) {
      state.pendingAuthPick = {
        gameId: game.id,
        side
      };

      openAuth();
      return true;
    }

    if (!API?.ensureMarket) {
      toast(
        "This market is still loading into EastCoin Picks."
      );
      return true;
    }

    try {
      const result =
        await API.ensureMarket({
          providerEventId:
            game.eventId,
          title:
            \`\${game.away} vs \${game.home}\`,
          sport:
            game.family,
          startsAt:
            game.startTs,
          away:
            game.away,
          home:
            game.home,
          awayBadge:
            game.awayLogo,
          homeBadge:
            game.homeLogo
        });

      if (!result?.market) {
        throw new Error(
          "EastCoin could not prepare this market."
        );
      }

      const prepared =
        normalizeBackendMarket(
          result.market
        );

      Object.assign(
        game,
        prepared,
        {
          sportsbook:
            game.sportsbook ||
            null,
          catalogOnly:
            false
        }
      );

      openBet(
        game.id,
        side
      );
    } catch (error) {
      if (
        error?.code ===
        "NO_ACTIVE_PICKS_SEASON"
      ) {
        toast(
          "Live odds are available, but the Picks season is not active yet."
        );
        return true;
      }

      toast(
        error?.message ||
        "EastCoin could not prepare this Picks market."
      );
    }

    return true;
  }

  function openBet(gameId, side) {
    const game = gameById(gameId);
    if (!game) return;

    if (
      game.catalogOnly &&
      state.mode ===
        "backend"
    ) {
      prepareCatalogMarket(
        game,
        side
      );
      return;
    }`;

  js = replaceOne(
    js,
    openBetAnchor,
    openBetReplacement,
    "Picks catalog market preparation"
  );

  files.set(
    "assets/eastcoins-picks.js",
    js
  );
}

/* ================================================================
   CACHE BUST
   ================================================================ */
{
  let html =
    files.get(
      "picks.html"
    );

  html = replaceOne(
    html,
    `assets/eastcoins-picks-api.js?v=1`,
    `assets/eastcoins-picks-api.js?v=43`,
    "Picks API cache bust"
  );

  html = replaceOne(
    html,
    `assets/eastcoins-picks.js?v=40`,
    `assets/eastcoins-picks.js?v=43`,
    "Picks app cache bust"
  );

  files.set(
    "picks.html",
    html
  );
}

/* ================================================================
   CHANGELOG
   ================================================================ */
{
  let html =
    files.get(
      "changelog.html"
    );

  const title =
    "Picks now browses the live sportsbook catalog instead of empty D1-only markets";

  if (
    !html.includes(
      `<h2>${title}</h2>`
    )
  ) {
    html = html.replace(
      /<div class="release-count">(\d+) major update groups<\/div>/,
      (_, count) =>
        `<div class="release-count">${Number(count) + 1} major update groups</div>`
    );

    html = html.replace(
      '<article class="timeline-entry latest">',
      '<article class="timeline-entry">'
    );

    html = html.replace(
      /\s*<span class="latest-badge">Latest<\/span>/,
      ""
    );

    const entry = `
<article class="timeline-entry latest">
<div class="timeline-date">
<time datetime="2026-08-27">August 27, 2026</time>
<span class="latest-badge">Latest</span>
</div>
<h2>${title}</h2>
<p>
    Fixed the misleading empty Picks state by separating the live sportsbook
    catalog from persisted D1 community-pool records. Picks now loads verified
    upcoming NFL, MLB, UFC/MMA and NCAAF moneyline markets from The Odds API,
    overlays any existing EastCoin pool/ticket state by provider event ID, and
    only creates a D1 market when a signed-in member actually selects a
    catalog-only game. Provider failures no longer masquerade as a search miss,
    and a genuinely empty search is labeled separately from an unavailable or
    empty live catalog.
</p>
</article>
`;

    const timelineEnd =
      html.lastIndexOf(
        "</section>"
      );

    if (timelineEnd < 0) {
      throw new Error(
        "Could not locate changelog timeline."
      );
    }

    html =
      html.slice(
        0,
        timelineEnd
      ) +
      entry +
      html.slice(
        timelineEnd
      );
  }

  files.set(
    "changelog.html",
    html
  );
}

/* ================================================================
   FINAL PREFLIGHT
   ================================================================ */
const picksJs =
  files.get(
    "assets/eastcoins-picks.js"
  );

if (
  !picksJs.includes(
    "mergedBackendMarkets"
  ) ||
  !picksJs.includes(
    "prepareCatalogMarket"
  )
) {
  throw new Error(
    "Picks live catalog validation failed."
  );
}

/* ================================================================
   WRITE ONLY AFTER ALL TRANSFORMS PASS
   ================================================================ */
for (
  const [rel, content] of
  files
) {
  fs.writeFileSync(
    p(rel),
    content,
    "utf8"
  );

  console.log(
    `Updated: ${rel}`
  );
}

const catalogSource =
  path.join(
    __dirname,
    "..",
    "replacement",
    "functions",
    "api",
    "picks",
    "catalog.js"
  );

const catalogTarget =
  p(
    "functions/api/picks/catalog.js"
  );

fs.mkdirSync(
  path.dirname(
    catalogTarget
  ),
  {
    recursive: true
  }
);

fs.copyFileSync(
  catalogSource,
  catalogTarget
);

console.log(
  "Created: functions/api/picks/catalog.js"
);

console.log("");
console.log(
  "EastCoin Iteration 43 complete."
);
console.log(
  "Picks now loads the live sportsbook catalog and overlays D1 pool state."
);
