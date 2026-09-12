# CLAUDE.md — EastCoin Current Production Handoff

> ## ⚠️ READ THIS FIRST — the production shell changed on 2026-09-08
>
> **The root of `eastcoin.vip` is no longer the V2 shell.** It is now the
> rebuilt shell, whose source is `index.html` at the repository root
> (copied from `v3/index.html`) with its assets under `/v3/assets/`.
>
> **Most of the document below describes the V2 shell that used to be at the
> root.** It is kept because the V2 files still exist and still serve the
> pages the new shell does not have — Games, Favorites, Quick Bet, the
> mini-games — but wherever it says "the root shell", read that as the OLD
> root shell unless this box says otherwise.
>
> ### What is true now
>
> | Thing | Where it is |
> |---|---|
> | Production shell | `index.html` (root) — the rebuilt one |
> | Its scripts/styles | `/v3/assets/js/*`, `/v3/assets/css/v3.css` |
> | The old V2 shell | `v2-shell.html`, served at `/v2-shell` — kept for rollback |
> | `/v3/` | forwards to `/`, carrying query and hash |
>
> Routes on the new shell: `/`, `/?view=multiview`, `/?view=picks`
> (`&tab=mypicks|leaderboard|history|ledger`), `/?view=music`,
> `/?view=screen` (nav label "Movies & TV": vidy.st player keyed by TMDB id, catalog
> via `functions/api/screen/*` behind `TMDB_API_KEY`; `v3-screen.js`; **members
> only** — `_gate.js` returns 401 without a Twitch session and the view shows a
> login prompt instead of the shelves),
> `/?view=watch&event=<id>`, `/?view=watch&url=<url>`, `/?view=admin`,
> `/g/<slug>` for a game page, and `/u/<login>` for a profile
> (`functions/u/[[path]].js` serves the shell with title/OG; `v3-profile.js`
> renders from `/api/picks/profile?login=`; names carry class `ulink` and
> the shell routes their clicks). Badges (👑🔥🧊💀🎵) are computed for
> everyone at once in `_badges.js` (cached 60s; the header comment there
> lists all nineteen titles and their rules; 🎵🎸👍🗑️ read the music
> worker's `/history/main`, 🏠🪑 read `user_days` which `presence.js` fills
> one row per person per Chicago day, 🎰 needs `picks.all_in` which
> `_wager.js` sets, 💸 checks the live StreamElements balance for anyone a
> debit ever left at zero), served by `/api/picks/badges`, and drawn next
> to names by `v3-badges.js`'s `ECBadges.decorate(node, login)`. A profile's
> **favourite team** is the user's own choice (`users.favourite_league` /
> `favourite_team`, ESPN abbreviations from `_teams.js`), read and set at
> `/api/picks/favourite`; the picker is inline on the owner's profile.
> `/?view=users` (`v3-users.js`, no nav link — linked from profiles) lists
> everyone from `/api/picks/users` with Picks profit/record, badges, favourite
> team, and Music ELO read client-side from the worker's `/history/main`.
> `/?view=activity` (`v3-activity.js`, no nav link yet) is the sitewide
> feed from `/api/picks/activity`: picks locked/settled, markets opened,
> finals, new users, songs played — merged newest-first, polled every 30s.
>
> **Green Room layout** (`v3-music.js` `build()`): ticker → header (title +
> room pile, "See who" roster) → stage with `.mnow-ov` overlay and the
> progress edge → `.mbar` (reactions, skip, volume) → search + `.mhint`
> (queue N of 14) → rail with tabs Up next / History /
> Rankings (ELO | Most requests). No per-person queue cap (the worker
> publishes `queueLimit` only); `loadHistory()` diffs
> ratings between fetches to show `.elo-delta` chips.
>
> **Top-right nav** — search magnifier, the profile pill (`#mePill`: avatar +
> name → profile, coin count → Picks), and one `⋯` button (`#settingsBtn`)
> whose menu holds the Twitch chat switch, the floating-player switch
> (`#musicDock`, still the id `v3-music.js` looks for) and the layout/event
> preferences. There is no `#chatToggle` any more; the shell guards it.
>
> **Floating player** — menu switch `#musicDock` toggles `window.ECMusicDock`
> (in `v3-music.js`): a fixed `.mdock` that hosts the same YouTube player
> and socket on non-music routes; the music view tears it down on mount and
> `unmount()` hands playback back to it instead of disconnecting. Remembered
> in `localStorage` `ec_v3_music_dock`.
>
> **October theme** — `applySeason()` in `v3-shell.js` sets `body.spooky.full`
> for October (Chicago time) and adds `.spooky-layer` (webs, bats, fog);
> `SPOOKY SEASON` at the end of `v3.css` holds the palette (it restates the
> `--*-rgb` accent tokens), the dressing and the emoji. The layer stops at
> the chat rail (Twitch's obscured check) and runs on every page, except that
> the bats (its only animation) are hidden on the watch route. The ⋯ menu
> has a Spooky theme switch (`#spookyToggle`) that records a choice in
> `localStorage` `ec_spooky`; with no choice the date decides. Links:
> `?spooky=1`, `?spooky=0`, `?spooky=auto` (clears the choice). The Sports page shows a dismissible
> `.spookystrip`.
>
> **Picks layout** (`v3-picks.js` `paint()`): title row with the season
> rule and a `.leaderpill` (season leader → Leaderboard tab) → `.picks-me`
> card (`.pf-quick.five`: wallet, profit, record, rank, open) or a
> `.picks-login` card → `.pf-tabs.picks-tabs` with counts and a
> `.tabs-tools` slot where `sportFilter()` (segmented All/NFL/MLB) is
> mounted by the Markets, History and Ledger views via `mountTools()`.
>
> **Profile layout** (`v3-profile.js` `page()`): mini nav → `.pf-card.pf-head`
> (avatar, name+badges, team, `.pf-quick` four numbers) → `.pf-tabs`
> Overview (bankroll, highlights, glance cards) / Picks / Casino / Music;
> the tab lives in the hash (`/u/name#casino`).
>
> **MLB slate line** — quiet sports still get one chat line a day when
> the 4 PM slate opens (`composeSlateOpen`, keyed `slateopen:<sport>:<day>`
> in `ops_status`); refills through the evening stay silent.
>
> **Casino layout**: the floor is title → `.cas-me` strip (`/api/casino/home`
> `me`: wallet, casino net, record, this hour vs cap; a login card when
> signed out) → tiles → `.pf-tabs.cas-tabs` Recent results (paged) / House
> rules. Game pages keep stage + side column; the fairness line is a
> `<details class="cf-verify">` with the full hash and seed, and every
> ledger is paged with `ECCasino.pager/pageOf`.
>
> **Casino** — `/?view=casino` is the floor (`v3-casino.js`, reads
> `/api/casino/home`; the nav's Casino link points here). Games:
> Coin Flip `/?view=flip`, Wheel `/?view=wheel`, Horse Race `/?view=race`
> (shared-round games on `functions/api/casino/_engine.js` — `GAMES`
> config, tables `casino_rounds` / `casino_bets` / `casino_presence`,
> endpoints `/api/casino/<game>/{state,bet,history}`; clients built on
> `v3-casino-kit.js`'s `sharedGame(spec)`), and Higher or Lower
> `/?view=hilo` (per-player, `functions/api/casino/hilo/*`, table
> `hilo_games`, committed deck, 1% edge per call, ×50 / 12-card cap).
> Shared limits: 20 ZC a bet, 10 an hour per game, and `HOUR_WIN_CAP`
> (300 ZC net in any rolling hour across every game, `capCheck` in
> `_engine.js`, enforced by every bet/deal endpoint including the coin's).
> Wheel: 24 red/black slices + one 6-degree gold sliver at 40x, outcome is an
> angle (red/black return 98.3%; gold is the 1-in-60 long shot at ~67%). Race: whole-number payouts 2/3/7/14, odds normalised from them —
> **currently `paused: true`** in `GAMES` (bets refused, off the floor,
> page says closed; flip the flag to bring it back). Floor tiles list
> who is in each room (`people` from `/api/casino/home`, Who's-here chips).
> The nav search is a magnifier that expands (`#navSearchBox.open`, `/` opens it).
> Casino results also flow into `/api/picks/activity` (type `casino`),
> the ticker, and the profile's Casino section (`profile.casino`). The
> floor's board lists recent wins and losses. Coin Flip itself is
> still the original:
> `functions/api/coin/` (`_coin.js` clock/fairness/settlement, `state.js`
> poll, `bet.js`), tables created on first use (`coin_rounds`, `coin_bets`,
> `coin_presence`), rounds on a 30s wall clock (15s bets + 15s result),
> max 20 ZC, 2× payout, same wallet ops as Picks. Client `v3-coin.js` polls
> `/api/coin/state` every 1.5s; the first poll after a flip settles it.
>
> **Mines** — `/?view=mines` (`v3-mines.js`, `functions/api/casino/mines/*`,
> table `mines_games`). Per-player like Hi-Lo: 25 tiles, 1–10 bombs, the
> board committed as `sha256(seed)` before the first tile and the bombs
> derived from the seed alone (Fisher–Yates over 0..24, each swap from
> `sha256(seed:shuffle:i)`). Each safe tile pays `C(25,k)/C(S,k)` less the
> same 1% edge Hi-Lo takes; cash out after any safe tile. The run
> auto-cashes at `topRung()` — the last rung still **under** the ×25
> ceiling (3 bombs: 15 tiles ×18.98; 10 bombs: 5 tiles ×17.52; max
> 379 on a 20 ZC stake; the ceiling was ×50 until 2026-09-12) — rather
> than clamping a higher rung down to the ceiling, which would have been a hidden
> second cut: pushing a ten-bomb board to the end would have returned 67%
> instead of 96%. `MAX_MINES` is 10 because
> past that the ladder leaps (20 bombs goes ×4.8, ×28.8, ×220.8) and one
> board could pay thousands the hourly cap cannot claw back. Winnings count
> toward `HOUR_WIN_CAP` via `hourlyNet()`, which had to learn about
> `mines_games` — any new casino game must be added there or it escapes the
> cap. Results flow to the floor, the activity feed and profiles.
>
> **Plinko** — `/?view=plinko` (`v3-plinko.js`, `functions/api/casino/plinko/*`,
> tables `plinko_drops` and `plinko_commits`). A ball falls through 12 peg
> rows into 13 buckets paying `25 · 4 · 2 · 1.4 · 1.1 · 1.05 · 0.3 · 1.05
> · 1.1 · 1.4 · 2 · 4 · 25` — a 99.0% return where every bucket but the
> middle pays, so 77% of drops come back ahead. Step i goes right
> when `sha256(seed:i)` is odd, so the path is a pure function of the seed.
> **Fairness works differently here**: a drop has no decisions in it, so
> instead of committing at the start of play each player holds a committed
> seed for their NEXT drop (`plinko_commits`, hash shown on the page,
> revealed with the result, rotated immediately), which stops the house
> picking a seed after seeing the stake.
> **The row count is what buys the top prize** (2026-09-12, was 8 rows
> paying ×4): ×25 edges on an 8-row board return 129%, because an 8-row
> edge lands 1 in 256. Paying for it there meant pushing the middle
> buckets under the stake and cutting the share of drops that come back
> ahead from 73% to 7%. Every added row halves the edge's chance, so at
> 12 rows an edge is 1 in 4096, the top prize lands about once in 2048
> drops, and every other bucket can stay above the stake. ×25 pays 500 on
> the 20 ZC maximum, the ceiling Mines came down to the same day. To
> re-tune, change `ROWS` and `PAYOUTS` in `_plinko.js` only — the client
> draws the pegs and the board width from `config.rows`/`config.payouts`,
> and the odds column and the "once in N drops" line come from
> `oddsTable()`. Never let the return past 100%. Winnings count
> toward `HOUR_WIN_CAP` via `hourlyNet()`; every new casino game must be
> added there or it escapes the cap.
>
> **The casino is near-fair on purpose (2026-09-11)** — every game
> returns ~98–99% (Hi-Lo and Mines `EDGE_RETURN = 0.99`; Plinko's table
> 98.6%; Wheel red/black 98.3%; Coin Flip was always exactly fair at 2×).
> The old 4% edge earned the house ~30 ZC a day and made players feel they
> never won, so they drifted to Picks. Payout shapes favour FREQUENT wins
> over big ones. Do not push the return past 100%: with the 300/hour cap
> only blocking new bets, a positive player edge prints thousands of
> ZCoins a day and devalues Picks. **Louder wins** — `makePop` takes
> `big`, adds `.cf-pop.big` and fires `burst()` confetti (also for any
> 30+ ZC profit); `makeToast(text, "near")` is the gold near-miss toast.
> `sharedGame` specs may add `bigWin(result, mine, config)` and
> `nearMiss(result, mine, config)` (the Wheel uses both); Hi-Lo, Mines and
> Plinko call near-miss toasts themselves. **The tables' ticker** — the
> casino floor mounts `ECActivity.mountTicker(el, { types: ["casino"],
> label, href, empty })`, the same ticker filtered to casino items.
> **Profiles** get a second `.pf-quick.pf-quick-casino` strip (profit,
> record, biggest win, favourite game) under the season strip, from
> `profile.casino`.
>
> **Presence** — every tab POSTs `/api/presence` (`v3-presence.js`, 30s
> heartbeat + on route change) into `site_presence`; the Sports page's
> "Who's here" strip reads GET `/api/presence`. A watch tab also sends
> `ref` (the event id); GET returns `watching: {eventId: n}` and the strip's
> poll dispatches `ec-presence` on `document`, which `v3-events.js` uses
> for the "👀 n watching" pill on each card. The watch page's control
> bar carries the same idea as the Green Room's room pile:
> `ECPresence.mountWatchers(el, eventId)` draws overlapping faces and
> "n watching" beside "← Events" (`.wwho` in `v3.css`), filtering
> `people` to `where === "watch"` with a matching `ref` and taking the
> total from `watching` so guests are counted but faceless. It returns a
> stop function because `buildBar()` runs again on every repaint; a
> pasted `?url=` stream has no id and gets no pile.
>
> **The book** — the dashboard opens with the house's side of Picks,
> built by `bookOf()` in `functions/api/admin/dashboard.js` (payload key
> `book`, drawn by `bookBlock()` in `v3-dashboard.js`): bets, stake,
> house take and hold, paid out, players' record, open exposure priced
> with `totalReturn`, today/7/14-day windows, a 14-day bar of the take by
> Chicago day, per-league and top-bettor tables, and a casino comparison
> line. The house's take is defined as minus the players' settled profit,
> so it can never disagree with the ledger or a profile; open picks are
> exposure, never profit.
>
> **The casino's book** — under the picks book, `casinoBook()` in the
> same endpoint (payload `casinoBook`, drawn by `casinoBlock()`) folds
> `casino_bets` (wheel, race), `coin_bets` and `hilo_games` into one
> shape: bets, players, stake, paid out, take and hold overall and per
> game, biggest single win, how many are live, and a 14-day take chart.
> Decided rows only (WON/LOST/BUST/CASHED); anything live counts as
> neither.
>
> **Admin links in the ⋯ menu** — `ownerMenu()` in `v3-shell.js` appends
> Admin, Dashboard and Activity under a "Yours" heading for the logins in
> its `ADMIN_LOGINS` set, which mirrors `ADMIN_ALLOWLIST` in
> `picks/_lib.js` (`bootypaper`, `zwades`, `andyreidisapawg`) — change one,
> change the other. Cosmetic only: each endpoint checks the session
> itself, and `admin/dashboard.js`, `admin/backup.js` and `admin/recap.js`
> now read that one allowlist rather than keeping their own owner lists,
> so "admin" means the same thing on every screen.
>
> **Live scores** — `settle.js` `trackLiveScores()` runs every tick: for
> LOCKED markets under 5h old with active picks it reads the Odds API live
> board (no `daysFrom`, one credit per league per tick), writes
> `markets.live_*` and appends changes to `market_scores`; `activity.js`
> emits them as `score` items (ticker + feed), `_game.js` exposes `live`
> for the game page. **Dashboard** —
> `/?view=dashboard` (`v3-dashboard.js`, hidden nav link) reads
> `/api/admin/dashboard`, gated to login `bootypaper` only; settlement
> leaves `ops_status` notes (`_ops.js`: `settle:last`, `odds:quota`).
>
> **Old links still work.** `v3-shell.js` rewrites `?event=`, `?watch=`,
> and the `games` / `streams` / `sicko` view names on load, and
> `v3-multiview.js` decodes MultiView share tokens made by the V2 shell.
> Do not remove either without a reason — every link ever pasted in chat
> is one of those shapes.
>
> **Old standalone pages redirect** — `functions/_legacy.js` plus
> `functions/{picks,music,multiview,events,login}.js` send `/picks`, `/music`,
> `/multiview`, `/events`, `/login` (and their `.html` forms, which Cloudflare
> forwards) to the current pages with a 302, carrying the query. Requests
> with `?ecV2Embedded=1` fall through to the old file so the V2 rollback
> shell still works. `/games` and `/favorites` are NOT redirected: the new
> shell has no Games or Other Streams page and sends people to those files.
>
> ### Rolling back
>
> Restore `index.html` from `v2-shell.html` and revert `v3/index.html` to
> the shell copy. Nothing else moved: the V2 assets under `/v2/assets/`
> and every standalone page were left untouched precisely so this stays a
> one-file decision.
>
> ### What the new shell does NOT have yet
>
> Deliberately deferred, not lost — the V2 pages still serve them:
> Quick Bet, Continue watching / Recent, the Quick Launch tiles, Games,
> Favorites, and the Categories dropdown (the new Events page groups by
> sport instead). MultiView also has no "Paste URL" panel type, so a V2
> share layout containing one restores short and says so.
>
> ### Picks is live and moves real ZCoins
>
> Section 9.9 below is out of date: `functions/api/picks/wagers.js` no
> longer refuses. Wagers debit StreamElements for real, settlement grades
> from ESPN and pays out on a schedule via the `eastcoin-picks-cron`
> Worker, and `functions/api/picks/_wager.js` is the single authority for
> the money path — shared by the website and the chat command so the two
> cannot disagree. `PICKS_OPEN_WAGERING=1` opens betting beyond the
> allowlist.
>
> **Settlement grades from The Odds API scores, not ESPN** — ESPN's site
> API returns 403 to Cloudflare's IP range. `settle.js` also runs
> `_autoopen.js` every tick: NFL games due within an hour get a market
> with the median h2h line and one slate-wide chat message; **MLB opens
> every day at 4 PM Central** (that evening's games and the next day's
> day games, `SPORTS` in `_autoopen.js`), **at most 5 open at a time**
> (`maxOpen`; earliest first, the next opens when one locks) and is **quiet in chat** —
> `quietInChat(sport)` keeps open/countdown/closed lines to NFL; MLB
> finals still get one chat line per settled game (`settle.js`), and the
> site, `!pick`/`!odds` replies and Discord carry the rest. Then
> `_reminders.js` posts "Closing in X minutes" at 30/10/5 (once per market
> per threshold, one line per threshold per tick). The cron runs every 5
> minutes. The schedule
> is cached 30 minutes (one credit per refresh, shared with the Picks
> page's Upcoming list via `/api/picks/upcoming`); a fresh price is
> fetched only when a game is due, so section 9.5's quota concern is
> handled by design rather than by a cap. The Odds API plan is 20,000
> credits/month — comfortable, still not to be spent casually.
>
> **Every market has a page** at `/g/<away>-<home>-<YYYYMMDD>` (also
> `/g/<YYYYMMDD>` for a day and `/g/mkt_…` by id). `functions/g/[[path]].js`
> serves the shell with the game's `<title>`/OG tags; the shell's `game`
> route (`v3-game.js`, not in the nav) renders from `/api/picks/game?g=`;
> `_game.js` holds the reads. `_slug.js` is the one place the name rule
> lives; chat links and the page must keep agreeing. `g/example.html` is
> the original static mockup, kept for the explainer only.
>
> **Fights (boxing, MMA)** — `_fights.js` holds `MANUAL_SPORTS`. Fight
> markets open from the admin form like any other (sport `boxing` or
> `mma`), lock at the start time, and are excluded from the scheduled
> settlement loop (no scores feed). Once started, the admin page shows
> "A won / B won / Draw, refund all"; `admin/settle-market.js` pays out
> through `applyVerdict` in `settle.js` (the same path and per-pick
> idempotency as automatic settlement), records `settlement_source =
> 'admin-result'`, and posts the chat line and Discord card. Team games
> are refused there. Fights read "A vs B" in chat, Discord and the game page.
>
> **Announcing one market** — each open, not-yet-started market on the
> admin page has an Announce button: it previews via
> `GET /api/picks/admin/announce?marketId=`, then POSTs `{ marketId }`,
> which posts `composeOpen([market])` in chat and `openedEmbed([market])`
> to Discord and notes `announce:<id>` in `ops_status` (shown as
> "announced N min ago"). Without a marketId the endpoint still announces
> every open market in chat only. The admin market list pages ten at a
> time (up to 200 from `/api/picks/admin/markets`), and each action's
> result is shown under its own market row.
>
> **Chat times say the day** — `_when.js` `whenCT()` is the one formatter
> for chat: "6:30 PM CT" today, "tomorrow at 6:30 PM CT", else
> "Sat, Sep 19 at 10:00 PM CT". Used by `_announce.js` and `bot/odds.js`.
> Every `!odds` reply ends with the Picks link and "GAMBA"; `withLink()`
> trims the text before it so say()'s 400-byte cut never eats the link.
>
> **Pasted YouTube links play** — YouTube refuses framing from its normal
> pages, so `youtubeEmbed()` in `v3-shell.js` (shared as
> `window.ECEmbed.youtube`) rewrites `watch?v=`, `youtu.be/`, `/live/`,
> `/shorts/` to `youtube.com/embed/ID` (keeping `t=` as `start=`), and
> `/channel/UC…/live` to `embed/live_stream?channel=`. Embed URLs, `@handle`
> pages and other sites pass through. Used by nav search, the watch view's
> `?url=`, and MultiView's paste and restored `url:` panels.
>
> **Provider copies are folded** — streamed.st's "golf" source relists
> games (MLB, fights) as bare entries with numeric ids (`1150`), no art,
> dated two hours before the start, so they read LIVE early. The full
> listing already carries that stream. `ECV3Sports.withoutCopies()` (in
> `v3-sports.js`) drops a match whose every stream a fuller match of the
> same game carries (same teams, or starts within 3h when names are
> missing); the Sports page and the MultiView picker use it, and
> `v3-watch.js` `findMatch()` opens the full game for an old copy's link.
>
> **College sides are named by school, never mascot** — college mascots
> collide with the pros, so `!pick 10 tigers` must never be able to mean
> both Missouri and Detroit. `schoolOf()` in `_cfb.js` (longest leading
> part ESPN knows as a school, so "Duke Blue Devils" -> "duke") drives
> `matchTeam()` in `bot/_bot.js`: a CFB side matches its school or full
> name only, and a bare college mascot returns `{ needSchool }`, which
> `!pick`/`!odds` answer with "say the school". `shortTeam(name, league)`
> and Discord's `label()` print the school for CFB. Any market row a
> name or logo is drawn from must therefore SELECT `league` — `_wager.js`
> did not, which is why a Missouri pick showed the Detroit Tigers crest.
>
> **What the Sports page hides (2026-09-12)** — `keep()` in `v3-sports.js`
> drops whole sports nobody in the community watches (`HIDDEN_SPORTS`:
> soccer, motorsport, rugby, cricket — remove a key to bring one back) and
> limits college football to **Division I**: a college game stays only if
> a side resolves to an id in `EC_CFB_TEAMS.d1` (266 FBS+FCS ids from
> ESPN's standings feed, groups 80 and 81). A two-team matchup whose sides
> resolve to no college at all is hidden (in practice D3 under the
> provider's spellings); a single-title listing ("NFL Network") stays.
> `EC_CFB_TEAMS.a` holds provider-spelling aliases ("Southern Methodist",
> "California-Davis", "Liu", "Albany") that `collegeId()` consults last —
> add one there when a real Division I school gets hidden. Applied where matches load (Sports page, MultiView picker) so the
> chip counts agree, and again inside `grouped()`.
>
> **College football logos** — `v3/assets/js/v3-cfb-teams.js` (browser,
> `window.EC_CFB_TEAMS`) and `functions/api/picks/_cfb.js` (server) hold
> the same name -> ESPN id table, generated from ESPN's college team list
> (761 teams). `ECLogos.url(sport, "CFB", name)` resolves them to
> `teamlogos/ncaa/500/<id>.png`, so Picks cards, game pages and profiles
> show crests for a market with league `CFB`. Title-only college games on
> the Sports page get a crest pair when both names are known schools
> (`collegePair()` in `v3-events.js`). Discord's `logoFor()` takes the
> league and uses the college table for CFB, never NFL nickname matching.
>
> **`!record` shows the season rank** — "Ranked #20/25", from
> `seasonRank()` in `bot/record.js`, which orders exactly like
> `getLeaderboard()` in `bootstrap.js` (profit, wins, login). Change one,
> change both. No rank is shown until a pick settles in the active season.
>
> **Daily recap** — `/api/admin/recap` (cron key or owner) posts one
> Discord card with every person whose picks settled the previous
> Central day: record and net, best to worst, plus day totals. The cron
> Worker fires it at `50 13,14 * * *` UTC and the endpoint posts only when
> it is 8 AM Central (`?force=1` from the dashboard bypasses that, `?dry=1`
> returns the card without posting); `recap:sent:<day>` in `ops_status`
> makes it once per day.
>
> **Nightly backup** — the picks cron Worker has a second trigger
> (`0 9 * * *` UTC) that POSTs `/api/admin/backup` with the cron key; the
> function dumps every table to gzipped JSON in the R2 bucket bound as
> `BACKUPS` (`d1/eastcoin-picks/<stamp>.json.gz` + `latest.json.gz`,
> pruned after 30 days) and notes `backup:last` for the dashboard's
> "Database backup" card (which also has a Back up now button).
> `tools/d1-restore-from-backup.mjs` turns a backup into SQL for
> `wrangler d1 execute`. D1 Time Travel (30 days) is the first resort.
>
> **Discord mirror of the ledger** — `_discord.js` posts embeds to the
> webhook in `DISCORD_LEDGER_WEBHOOK` (Pages env var; unset = no-op): a
> card when a pick locks (`_wager.js`), one for the slate when markets
> auto-open, and one per settled game with every pick and its result
> (`settle.js`). Public ledger data only, never balances.
>
> **Every bot line leads with `Zcoin`** (the 7TV emote code) via `BADGE` in
> `bot/_bot.js`; the leaderboard and season line aggregate from `picks`
> because `user_season_stats` is never written.

> **Purpose:** This file is the authoritative coding-agent handoff for the current EastCoin production site. Read it before making changes.
>
> **Repository:** `jakelambertseo/eastcoins`
>
> **Production domain:** `https://eastcoin.vip`
>
> **Production branch:** `main`
>
> **Baseline commit inspected for this document:** `55b2dbe8c7e394fe61d8e398c415638447dbe516`
>
> **Baseline commit message:** `Hide legacy player while MultiView loads`
>
> **Baseline commit date:** 2026-09-03
>
> **Important:** Current source code on `main` outranks old README iteration files, old patch/install scripts, old `/v2/` copies, mockups, and historical V1 pages.

---

## 1. What EastCoin Is Right Now

EastCoin is a static HTML/CSS/JavaScript sports-community site deployed on Cloudflare Pages with Cloudflare Functions for server-side APIs.

The production experience is now launched at the **root domain**:

```text
https://eastcoin.vip/
```

Do **not** treat `/v2/` as the public production route. The `/v2/` directory still contains many of the current shell assets, but the public shell is `index.html` at the repository root.

The core current experiences covered by this handoff are:

1. **Homepage / Events shell** — `/`
2. **Live Player** — rendered inside the root shell via event/watch deep links
3. **MultiView** — `/?view=multiview`
4. **Persistent embedded Twitch chat** — owned by the root shell
5. **Picks** — `/?view=picks`

Other pages and prototypes exist in the repository, but do not assume they are part of the current production baseline unless the user explicitly asks about them.

---

# 2. Non-Negotiable Product / UX Invariants

These are the most important rules to preserve.

## 2.1 Root-domain production only

Public links must use the root site:

```text
/
?view=multiview
?view=picks
?event=...
?watch=...
```

Do not generate new public links under:

```text
/v2/
```

Internal asset paths may still live under `/v2/assets/...`.

---

## 2.2 Do not resurrect V1 chrome inside the V2 shell

A recurring historical bug has been old sidebars/nav/chat/toolbars briefly appearing inside embedded child pages.

The current shell intentionally embeds pages such as:

```text
/multiview.html?ecV2Embedded=1
/picks.html?ecV2Embedded=1
```

The outer shell owns the main navigation and persistent Twitch chat.

When a child page is embedded:

- child sidebars should be hidden;
- child duplicate chat should be hidden;
- child duplicate global navigation should be hidden;
- only the child page's main working surface should remain.

Do not add old left-side navigation back into the embedded MultiView or Picks experience.

---

## 2.3 Persistent Twitch chat must remain persistent

This is a critical V2 invariant.

The root page contains:

```html
<iframe id="persistentTwitchChat" ...>
```

The router intentionally **never replaces, reloads, removes, or reassigns** that iframe when navigating between Events, MultiView, Picks, Games, etc.

Once Twitch chat has mounted, changing EastCoin routes must not destroy it.

Hiding chat should be a CSS/layout visibility operation, not an iframe reload.

---

## 2.4 Current design is authoritative

The current production visual system is:

- extremely dark / near-black;
- deep burgundy / red;
- gold accents;
- compact utilitarian sports UI;
- current root header/nav;
- current event-card language;
- current player controls;
- current right-side Twitch chat.

Recent "ultra minimal" homepage mockups were exploratory concepts only and are **not** the production design baseline.

Do not redesign production into the experimental minimal layout unless explicitly requested.

---

## 2.5 Server names are intentionally generic

Visible stream choices should be:

```text
Server 1
Server 2
Server 3
...
```

Do not expose old provider/source/language labels such as:

```text
Alpha
Delta
English
English - MLB TV
```

unless explicitly requested for debugging/admin use.

---

## 2.6 New meaningful features must update the changelog

For every new feature or meaningful site update:

```text
changelog.html
```

must be updated as part of the same change.

---

## 2.7 User's preferred delivery workflow

For code-update requests:

- make the code changes directly;
- provide complete replacement files;
- preferably package changed files in a downloadable ZIP;
- do not give patch-only workflows unless explicitly requested;
- do not require `.cmd` installers;
- do not make Node installer scripts the default;
- give the full `git add / commit / push` commands;
- include a short commit note.

The user prefers replacing raw files and pushing with Git.

---

# 3. High-Level Architecture

Current production architecture:

```text
index.html
│
├── Root EastCoin navigation
├── Events homepage
├── Current V2 Live Player
├── Quick Bet modal
├── Settings
├── Persistent Twitch chat
│
└── Workspace iframe
    ├── /multiview.html?ecV2Embedded=1
    ├── /picks.html?ecV2Embedded=1
    ├── /games.html?ecV2Embedded=1
    ├── /favorites.html?ecV2Embedded=1
    └── other routed child experiences
```

Key router:

```text
v2/assets/js/router.js
```

The outer `index.html` stays mounted while routed workspace pages load inside:

```html
<iframe id="workspaceFrame">
```

This is how the site preserves global shell state, especially Twitch chat.

---

# 4. Homepage / Events — Current State

## 4.1 Public route

```text
/
```

Main file:

```text
index.html
```

Primary supporting assets include:

```text
v2/assets/css/tokens.css
v2/assets/css/shell.css
v2/assets/css/home.css
v2/assets/css/overlays.css
v2/assets/css/workspace.css
v2/assets/css/responsive.css
v2/assets/css/watch-view.css
v2/assets/css/settings.css
v2/assets/css/chat-cleanup.css
v2/assets/css/event-cards-v1.css
v2/assets/css/card-scores.css
v2/assets/css/quick-bet.css
v2/assets/css/launch.css

v2/assets/js/core.js
v2/assets/js/events.js
v2/assets/js/player.js
v2/assets/js/card-odds.js
v2/assets/js/card-scores.js
v2/assets/js/integrations.js
v2/assets/js/router.js
v2/assets/js/quick-bet.js
v2/assets/js/app.js
v2/assets/js/mlb-gameday.js
v2/assets/js/multiview-handoff.js
```

Do not assume old standalone `events.html` owns production Events. The root `index.html` is the current shell/homepage.

---

## 4.2 Current top navigation

The static root HTML contains:

```text
EastCoin
Events
MultiView
Picks
Search
ZCoins
Settings
Login/Profile
```

At runtime, `v2/assets/js/app.js` converts the old sports sub-navigation into a top-level:

```text
Categories ▾
```

dropdown and removes the legacy sport bar from the live layout.

Current category choices include:

```text
All Events
Live Events
Football
Baseball
UFC / Fighting
Soccer
Basketball
Hockey
Tennis
Other
```

Therefore:

- do not rebuild a permanent sports sub-nav under the main header;
- categories currently live in the main navigation as a dropdown.

---

## 4.3 Homepage Events timeline

The main Events section currently contains:

```text
EVENTS
Your sports timeline
```

with status filtering for:

```text
All
Live
Upcoming
Saved
```

and:

```text
Sort: Recommended
```

The Events grid is the primary homepage content.

The root search accepts:

```text
games
teams
URLs
```

The site also supports current sport/category filtering through the Categories dropdown.

---

## 4.4 Homepage lower modules

Below the Events grid, the current root still includes:

### Recent

```text
Continue watching
```

### Picks

```text
EastCoin Picks
```

### Quick Launch

Current quick-launch concepts include:

```text
MultiView
Mini Games
Open Chat
Other Streams
```

Do not remove these unless explicitly asked. Recent experimental "nav + picker + chat only" concepts are not production.

---

## 4.5 Initial Events loading / performance behavior

Current `v2/assets/js/app.js` deliberately limits the first Events load.

Initial paint only needs:

```text
Live + Today
```

The larger extended/seven-day catalog is deferred until functionality such as:

```text
Search
Upcoming
Saved
```

actually needs it.

Preserve this behavior. Do not make the homepage fetch the full extended event catalog on every initial load unless there is a strong reason.

The empty Events grid reserves loading space to reduce layout shift.

---

## 4.6 Homepage settings

Current Settings include:

### Layout

```text
Close Navigation
Close/Open Twitch Chat
```

Closing Twitch chat must not unload its iframe after it is mounted.

### Events

```text
Show Event Artwork
Compact Event Cards
Starting Soon First
```

Settings are stored locally on the device.

---

# 5. Root V2 Routing / Workspace

File:

```text
v2/assets/js/router.js
```

Current routes include:

```js
events:     /
multiview:  /multiview.html?ecV2Embedded=1
picks:      /picks.html?ecV2Embedded=1
games:      /games.html?ecV2Embedded=1
streams:    /favorites.html?ecV2Embedded=1
sicko:      /picks-kalshi-test.html?ecV2Embedded=1#prop-of-week
```

Public shell URLs are normalized to:

```text
/
?view=multiview
?view=picks
?view=games
?view=streams
```

The child `src` URLs are implementation details.

---

## 5.1 Embedded cleanup

After a workspace child loads, the router injects embedded cleanup.

It hides child elements such as:

```text
.sidebar
.chat
.ec-events-v2-nav
.ec-events-v2-chat
.ec-events-v2-chat-resizer
.ec-events-v2-mobile-menu
.ec-events-v2-nav-cycle
```

and collapses the child layout to one main content column.

For Picks it also applies:

```text
ec-v2-picks-embedded
```

For MultiView it applies:

```text
ec-v2-embedded
```

Do not remove this mechanism casually. It prevents duplicate V1/standalone chrome from appearing inside the current shell.

---

## 5.2 Critical router invariant

The router explicitly does not touch:

```text
#persistentTwitchChat
```

Route changes only change:

```text
main homepage visibility
workspace visibility
workspace iframe src
browser history
active nav
```

The outer page remains mounted.

---

# 6. Current Live Player

There are **two different player concepts in the repository**. Do not confuse them.

## 6.1 Production V2 player

The main production player is part of:

```text
index.html
```

and is controlled by:

```text
v2/assets/js/player.js
v2/assets/css/watch-view.css
v2/assets/js/mlb-gameday.js
```

This is what a user sees when they open an event from the current Events shell.

---

## 6.2 `player.html` is not the main current shell player

The repository also contains:

```text
player.html
```

This is an older/standalone player architecture that remains important for compatibility and MultiView.

MultiView panels intentionally create same-origin child player URLs such as:

```text
/player.html?shell=1&multiview=1&event=...
```

or:

```text
/player.html?shell=1&multiview=1&watch=...
```

Do not rewrite the root V2 player by editing `player.html` alone.

If the user reports a bug in the normal root event player, first inspect:

```text
index.html
v2/assets/js/player.js
v2/assets/css/watch-view.css
```

If the bug occurs inside a MultiView tile, inspect:

```text
player.html
assets/eastcoins-multiview.js
assets/eastcoins-multiview-loading.js
assets/eastcoins-multiview-servers.js
```

---

## 6.3 V2 player deep links

Current event links use the root shell.

For an EastCoin event:

```text
/?event=<event-id>
```

Optional stream preference can be included:

```text
/?event=<event-id>&source=<source>&stream=<stream-number>
```

For a custom embed/player URL:

```text
/?watch=<encoded-url>
```

When watching, the browser URL is synchronized without leaving the root shell.

---

## 6.4 Current player stream behavior

When a user opens an event:

1. `v2/assets/js/player.js` sets the active match.
2. Player UI is shown immediately.
3. EastCoin requests playable streams from the event API.
4. Only streams with an `embedUrl` are retained.
5. Stream buttons are rendered.
6. The preferred source/stream from the deep link is selected when possible.
7. The iframe loads the chosen provider embed.

Visible server names are standardized:

```text
Server 1
Server 2
Server 3
...
```

The player shows the number of available servers.

---

## 6.5 Current V2 player controls

Current player controls include:

```text
Favorite
+ MultiView
Gameday        (MLB only / when eligible)
Copy Link
Open Source
Bet            (only when eligible)
Collapse
```

There is also server switching.

### Collapse

Control collapse state is saved to:

```text
eastcoinV2WatchControlsCollapsed
```

Do not remove persisted collapse behavior.

### Copy Link

Copies the root EastCoin event/watch deep link.

### Open Source

Opens the active embed source externally in a new tab.

### + MultiView

Sends the active match + selected stream into the V2 MultiView handoff.

### Gameday

MLB games can expose:

```text
⚾ Gameday
```

via:

```text
v2/assets/js/mlb-gameday.js
```

### Bet

Bet is hidden unless all eligibility checks pass.

Current Quick Bet eligibility requires:

- a real EastCoin event, not `custom:...`;
- event has not started;
- event is not live;
- supported sportsbook sport key;
- Odds API-backed market;
- valid away and home American moneylines.

Current supported Quick Bet sport-key families include football, baseball and MMA, with American-football odds further restricted to NFL by current app logic.

---

# 7. MultiView — Current State

## 7.1 Public route

```text
/?view=multiview
```

The shell loads:

```text
/multiview.html?ecV2Embedded=1
```

into the root workspace.

Main files:

```text
multiview.html
assets/eastcoins-multiview.css
assets/eastcoins-multiview.js
assets/eastcoins-multiview-share.js
assets/eastcoins-multiview-loading.js
assets/eastcoins-multiview-servers.js
assets/eastcoins-multiview-servers.css
v2/assets/js/multiview-handoff.js
```

Provider/event data helpers include:

```text
assets/eastcoins-ppv-api.js
assets/eastcoins-streamed-api.js
assets/eastcoins-event-visibility.js
```

---

## 7.2 Embedded versus standalone MultiView

`multiview.html` still contains its own standalone navigation and Twitch chat drawer.

That is intentional for standalone compatibility.

When loaded with:

```text
?ecV2Embedded=1
```

current CSS hides:

```text
.ec-events-v2-nav
.mv-nav-toggle
.mv-mobile-overlay
#mvChatButton
.mv-chat-drawer
```

The outer V2 navigation + outer persistent Twitch chat should be the only global chrome visible.

If a user reports "old left nav is showing in MultiView", treat that as a regression.

---

## 7.3 Layouts

Current valid MultiView layouts:

```text
2 panels
3 panels
4 panels
```

Default:

```text
4 panels
```

Default split percentages:

```text
2: 50 / 50
3: 65 / 35-ish main column behavior
4: 50 / 50
```

Split state is normalized and persisted.

MultiView state storage key:

```text
eastcoinMultiviewV1
```

The storage-key name is historical; do not interpret the `V1` suffix as meaning the current page is V1.

---

## 7.4 Panel controls

Each panel currently supports:

```text
Solo
Focus
Servers
Replace
Remove
```

The server selector is dynamically added when a child event player has real server buttons available.

The global MultiView toolbar supports:

```text
2 / 3 / 4 layout selector
Clear all
Hide controls / Show controls
Share
```

The standalone page also contains a Chat control, but that control/drawer is hidden in the embedded V2 workspace.

Controls hidden state is saved to:

```text
eastcoinMultiviewControlsHidden
```

---

## 7.5 Adding a stream

An empty panel offers:

```text
Choose Event
Paste URL
```

Event picker modes:

```text
Live
Today
```

There is event search.

Manual URL handling accepts HTTP/HTTPS, but production EastCoin requires HTTPS unless running locally.

Manual URLs are treated similarly to URLs the Live Player would accept.

Sites that refuse iframe embedding can still fail; EastCoin cannot override a provider's frame policy.

---

## 7.6 How a MultiView tile works

For each populated panel, `assets/eastcoins-multiview.js` creates a same-origin `player.html` child.

Event:

```text
player.html?shell=1&multiview=1&event=<id>
```

Manual URL:

```text
player.html?shell=1&multiview=1&watch=<url>
```

This is an important architecture detail.

The outer V2 shell contains MultiView.
MultiView contains `player.html`.
`player.html` then contains the real provider iframe.

---

## 7.7 Legacy player flash is intentionally masked

A known problem was that the old `player.html` "Embed a video URL" UI briefly appeared while a MultiView stream was loading.

Current fix:

```text
assets/eastcoins-multiview-loading.js
```

It overlays the tile with:

```text
Opening stream…
Connecting to EastCoin player
```

until the nested child player exposes:

```text
#activeFrame
```

If loading takes longer:

```text
Still loading stream…
This provider is taking longer than usual.
```

Do not remove this mask unless `player.html` is fully replaced and the old first-paint problem no longer exists.

---

## 7.8 Per-panel server switching

Current implementation:

```text
assets/eastcoins-multiview-servers.js
```

Important behavior:

- parent MultiView does **not** refetch the event catalog to switch servers;
- `player.html` and MultiView are same-origin;
- MultiView reads the existing hidden child server buttons;
- choosing `Server N` activates the corresponding real child server button;
- selection is saved by panel slot + event.

Storage key:

```text
eastcoinMultiviewServerSelectionsV48
```

Do not create a second independent stream-fetch implementation for the parent MultiView unless deliberately redesigning the architecture.

---

## 7.9 MultiView audio limitation

Current UI explicitly tells users that audio is controlled inside each embedded provider player.

Because the real provider frames are cross-origin, EastCoin cannot reliably force-mute arbitrary provider players from the parent page.

Do not claim site JavaScript can universally mute cross-origin embeds.

---

## 7.10 MultiView sharing

Current share module:

```text
assets/eastcoins-multiview-share.js?v=share2
```

Current compact share parameter:

```text
m
```

Legacy parameter still recognized:

```text
mv
```

Canonical V2 share URL should resolve through the root shell:

```text
https://eastcoin.vip/?view=multiview&m=<token>
```

Do not generate new canonical shares as:

```text
/multiview.html?m=...
```

Old standalone shared links are retained for backward compatibility and redirect into the V2 shell.

The share token encodes:

- layout count;
- panel split values;
- event IDs or manual URLs.

A shared layout is treated as transient and should not permanently overwrite the viewer's own saved MultiView layout.

---

## 7.11 Solo behavior

When a MultiView panel is opened Solo from embedded V2 MultiView, a same-origin message bridges back to the root shell.

The router handles:

```text
ec-v2-multiview-solo
```

and opens either:

- the matching EastCoin event in the root V2 player; or
- the custom URL in the root V2 player.

Do not navigate the entire browser to an old standalone player for V2 Solo.

---

# 8. Persistent Embedded Twitch Chat

## 8.1 Owner

The root shell owns the production Twitch chat:

```text
index.html
#chat
#persistentTwitchChat
```

Current Twitch channel:

```text
zwades
```

Current embed parents include:

```text
eastcoins.pages.dev
eastcoin.vip
www.eastcoin.vip
localhost
127.0.0.1
```

The child workspace should not own the persistent global chat.

---

## 8.2 Initial deferred loading

For performance, the iframe begins as:

```text
about:blank
```

and the real Twitch embed URL is stored in:

```text
data-src
```

Current startup behavior in:

```text
v2/assets/js/app.js
```

defers mounting Twitch until the user first interacts through events such as:

```text
pointerdown
keydown
touchstart
wheel
```

This avoids paying Twitch's full script/request/DOM cost before the user interacts with EastCoin.

---

## 8.3 Direct watch exception

If the user enters EastCoin through a direct watch route such as:

```text
?event=...
?watch=...
```

and chat is configured visible, chat can be mounted immediately/idle-immediately.

---

## 8.4 Persistence after mounting

Once mounted:

- route changes must not reload it;
- hiding it must not unload it;
- opening it again should reuse the same iframe;
- MultiView/Picks embedded child chat should stay hidden.

This behavior is intentionally preserved by:

```text
v2/assets/js/router.js
v2/assets/js/app.js
v2/assets/js/player.js
```

---

## 8.5 Settings integration

The root Settings modal controls chat visibility.

The wording explicitly treats the operation as:

```text
Close Twitch Chat
```

and describes hiding chat without unloading/refreshing the iframe.

Preserve this expectation.

---

# 9. Picks — Current State

## 9.1 Public route

```text
/?view=picks
```

The root workspace loads:

```text
/picks.html?ecV2Embedded=1
```

Core files:

```text
picks.html
assets/eastcoins-picks.css
assets/eastcoins-picks-api.js
assets/eastcoins-picks-preview.js
assets/eastcoins-moneyline.js
assets/eastcoins-moneyline-runtime.js
assets/eastcoins-picks-football-v50.js
assets/eastcoins-picks.js
```

Cloudflare Functions live under:

```text
functions/api/picks/
```

Important endpoints/files include:

```text
bootstrap.js
catalog.js
wagers.js
auth/
admin/
markets/
health.js
db-health.js
schema-health.js
```

---

## 9.2 Embedded Picks must not show its old standalone sidebar

`picks.html` still contains a standalone sidebar and standalone chat for direct-page compatibility.

When loaded with:

```text
ecV2Embedded=1
```

the document applies:

```text
ec-v2-picks-embedded
```

from the head before first paint.

`assets/eastcoins-picks.css` hides standalone chrome immediately so the user does not see the old left nav flash before router cleanup.

The root shell navigation and root persistent Twitch chat remain visible outside the workspace.

If the old Picks sidebar appears briefly in embedded mode, treat that as a bug.

---

## 9.3 Main Picks UI

Current Picks page includes:

### Top leaders

```text
Top Picks
Season profit leaders
```

### Summary strip

```text
ZCoins Wallet
2026 Picks Profit
Record
Picks Rank
```

### Views

```text
Markets
My Picks
Leaderboard
History
Community Ledger
```

The Community Ledger is intended for public Picks activity/transparency, not private wallet balances.

---

## 9.4 Current market sports

Current server catalog sports:

```text
NFL
MLB
UFC / MMA
```

Keys:

```text
americanfootball_nfl
baseball_mlb
mma_mixed_martial_arts
```

College football is intentionally excluded from Picks.

NCAAF may still be watchable elsewhere on EastCoin, but it is not eligible for Picks/Quick Bet.

---

## 9.5 Current market volume limits

`functions/api/picks/catalog.js` currently sets:

```text
MAX_MARKETS_PER_SPORT_PER_DAY = 3
```

Current market day timezone:

```text
America/Chicago
```

This limit exists to control Odds API usage.

Do not silently increase it without explicit approval.

---

## 9.6 Market windows

Current frontend wrapper behavior:

### Football

NFL only.

Upcoming NFL markets can remain visible within the server catalog's current maximum horizon:

```text
14 days
```

### MLB / UFC / MMA

Current wrapper restricts these to:

```text
today + tomorrow
```

The UI's market-window note changes according to the selected sport.

---

## 9.7 Moneyline model

EastCoin no longer uses the retired community-pool payout algorithm.

Payouts are based on sportsbook-style American moneylines.

Current catalog logic uses The Odds API `h2h` markets and constructs a consensus from bookmaker prices.

The payout shown on the ticket is the displayed consensus moneyline.

Examples reflected by current rules:

### +150

10 ZCoin wager:

```text
win:  25 returned total = +15 profit
lose: 0 returned = -10
void: 10 refunded
```

### -200

10 ZCoin wager:

```text
win:  15 returned total = +5 profit
lose: 0 returned = -10
void: 10 refunded
```

A losing pick must never display a positive payout.

The Quick Bet UI explicitly shows:

```text
If Pick Wins
If Pick Loses
Void / No Action
```

Do not reintroduce:

```text
poolSnapshot()
sideMultiplier()
community-pool multiplier
community action sets payout
```

into current Picks or Quick Bet calculations.

---

## 9.8 Wager limits

Current Picks rules display:

```text
Minimum: 1 ZCoin
Maximum: lower of 15% of available wallet or 50 ZCoins
```

One locked side per game.

The user cannot intentionally pick both sides of the same game.

---

## 9.9 Current real-wager safety state

This is important.

The current Cloudflare endpoint:

```text
functions/api/picks/wagers.js
```

still refuses real wager creation.

POST currently responds with:

```text
WAGERING_NOT_READY
```

and a 503 message indicating real ZCoin wagering is disabled until the required backend integrations are ready.

Therefore:

- do not assume a successful-looking frontend preview means real ZCoins are being debited;
- do not remove the backend safety lock without explicit instruction;
- do not claim real wagering is active just because Twitch auth or wallet UI is present.

---

## 9.10 Current temporary Betting Paused banner

`picks.html` currently contains a deliberately conspicuous red animated warning on:

1. the main Picks page;
2. the Lock Pick / ticket modal.

Current copy:

```text
Your streamer Zwades is disallowing us from placing bets at the moment.
Ask him kindly to allow us to have fun in chat.
```

It uses a red pulse/glow and respects `prefers-reduced-motion`.

This is current production source at the baseline commit.

Do not remove it unless explicitly requested.

---

# 10. Picks Twitch Authentication

## 10.1 Identity model

Twitch is the current Picks identity mechanism.

The Picks auth UI explains:

- Twitch identity is used for Picks;
- StreamElements ZCoins wallet is intended to connect to that identity;
- EastCoin never receives the user's Twitch password.

---

## 10.2 Firefox-specific embedded OAuth solution

Do not iframe Twitch OAuth inside the embedded Picks workspace.

Firefox/Twitch can reject authentication pages inside iframes.

Current embedded Picks flow opens Twitch authentication in a popup.

Important identifiers:

```text
popup name: eastcoinTwitchAuth
auth completion page: /auth-complete.html?source=picks
BroadcastChannel: eastcoin-picks-auth
```

Current fallback session polling:

```text
/api/picks/bootstrap
```

Polling interval:

```text
1250 ms
```

The code verifies:

```text
payload.ok
payload.session.authenticated
```

before considering login complete.

---

## 10.3 Why BroadcastChannel exists

During cross-origin OAuth through Twitch, Firefox may sever or invalidate assumptions around `window.opener`.

Current flow therefore uses:

```text
BroadcastChannel
```

as the primary same-origin completion signal, while retaining `postMessage` as an optional secondary path.

It also polls the same-origin Picks bootstrap endpoint so successful auth can still be detected even if opener messaging fails.

When authentication succeeds, the outer EastCoin shell reloads so:

```text
top-right profile
Picks session
wallet identity
```

update together.

Do not regress embedded Picks auth back to direct iframe navigation to Twitch.

---

# 11. Quick Bet

Quick Bet is part of the root shell, not a separate page.

Main files:

```text
index.html
v2/assets/js/quick-bet.js
v2/assets/css/quick-bet.css
assets/eastcoins-moneyline.js
assets/eastcoins-moneyline-runtime.js
```

Quick Bet can be opened from eligible event cards/player controls.

Current intended meaning:

```text
moneyline displayed = payout price if that side wins
```

It does **not** mean both outcomes pay.

The ticket calculates:

```text
wager
moneyline
profit
total return
loss if pick loses
refund if void/no action
```

This is a sportsbook-style moneyline preview, not the old community pool.

---

# 12. Event / Picks Odds API Constraints

Current Picks catalog API uses:

```text
The Odds API
```

Current server catalog settings include:

```text
CACHE_TTL_SECONDS = 30 * 60
MAX_HORIZON_MS = 14 days
MAX_GAMES = 140
MAX_MARKETS_PER_SPORT_PER_DAY = 3
MARKET_DAY_TIME_ZONE = America/Chicago
```

Current sports:

```text
NFL
MLB
UFC/MMA
```

These limits are intentional because API usage became high during development.

Do not expand market coverage or polling frequency casually.

---

# 13. Current Data / Provider Concepts

The root page preconnects to current stream/provider infrastructure including:

```text
streamed.st
api.ppv.st
Twitch
7TV CDN
```

MultiView explicitly loads:

```text
eastcoins-ppv-api.js
eastcoins-streamed-api.js
eastcoins-event-visibility.js
```

The player asks the current EastCoin API abstraction for playable streams instead of hardcoding one provider.

Preserve provider abstraction where possible.

---

# 14. Current Search Behavior

The root search is intended to accept:

```text
games
teams
URLs
```

Opening a custom URL sends it through the V2 player.

When a player/event is currently open, top-level navigation/sport changes should close the player rather than leaving a hidden stream iframe playing behind another view.

The player code explicitly watches for navigation/sport clicks and closes the active watch view.

---

# 15. MLB Gameday

MLB Gameday is currently part of the root V2 player.

Relevant:

```text
#watchGameday
v2/assets/js/mlb-gameday.js
assets/eastcoins-mlb-gameday.js
assets/eastcoins-mlb-gameday.css
```

The Gameday button is hidden unless the active event is eligible.

Do not make Gameday universally visible for non-MLB events.

---

# 16. Current Noindex / Private-Site State

Current core pages contain restrictive robots metadata such as:

```text
noindex
nofollow
noarchive
nosnippet
noimageindex
```

This includes root and major child experiences.

Do not assume EastCoin is currently configured as an SEO-indexable public product.

Recent discussions about redesigning EastCoin for a general internet audience were conceptual mockups, not current production implementation.

---

# 17. Concepts Discussed but NOT Current Production

As of the baseline commit in this document, the following have been discussed/mocked up but should **not** be treated as existing production features unless current source later proves otherwise:

```text
Dedicated /redzone experience
Sitewide live-score ticker
Daily multi-sport Guess the Player game
Trusted-contributor stream submissions
Community watch-room creation backend
Public-audience homepage redesign
Ultra-minimal homepage redesign
Public profiles / achievements
Public Kanban roadmap
```

Do not tell the user these exist merely because mockup HTML files were created in chat.

If implementing one later, integrate it into the current EastCoin design and architecture unless the user explicitly requests a redesign.

---

# 18. Regression Checklist Before Shipping

For any change touching the five core areas in this file, verify all of the following.

## Homepage

- `/` loads Events.
- Categories is in the main nav.
- old sport sub-nav is not visible.
- search still works.
- Events still load.
- initial page does not force unnecessary seven-day catalog fetch.
- Quick Bet still opens for eligible events.
- settings still work.

## Player

- event opens inside the current root shell.
- Twitch chat stays in place.
- server buttons say `Server 1`, `Server 2`, etc.
- server switching changes the actual iframe.
- Copy Link generates root-domain watch link.
- + MultiView actually hands off the selected stream.
- MLB Gameday still works.
- Bet is only visible when eligible.
- Collapse persists.
- leaving the player does not leave a hidden playing iframe.

## MultiView

- opens through `/?view=multiview`.
- old left nav does not appear inside V2 workspace.
- duplicate MultiView chat button/drawer is hidden in embedded mode.
- 2/3/4 layouts work.
- event picker works.
- Paste URL works.
- Solo returns to current root player.
- per-panel Servers menu works.
- loading mask prevents old `player.html` URL-entry screen from flashing.
- Share generates V2 root link.
- old shared standalone links still restore through V2.
- shared layout does not permanently replace personal layout.

## Persistent Chat

- iframe begins deferred when appropriate.
- first interaction mounts Twitch.
- direct watch can load chat immediately.
- Events → MultiView → Picks navigation does not recreate chat.
- hide/show does not unload chat.
- child pages do not display duplicate Twitch chat inside V2 shell.

## Picks

- embedded Picks does not flash old sidebar.
- Markets load without hanging.
- Twitch popup auth works in Firefox.
- successful auth refreshes outer shell identity.
- NFL is the only football Picks league.
- MLB/UFC/MMA date window remains intentional.
- 3 markets per sport/day backend limit remains unless explicitly changed.
- community-pool payout code does not return.
- losing pick = wager lost.
- void = wager refunded.
- Community Ledger still exists.
- real wager endpoint remains locked unless explicitly enabled.
- temporary betting-paused banner remains until requested otherwise.

---

# 19. Files to Inspect First by Problem Type

## "Homepage is broken"

Start with:

```text
index.html
v2/assets/js/app.js
v2/assets/js/events.js
v2/assets/js/core.js
v2/assets/css/home.css
v2/assets/css/event-cards-v1.css
```

## "Player is broken"

Start with:

```text
index.html
v2/assets/js/player.js
v2/assets/css/watch-view.css
v2/assets/js/mlb-gameday.js
```

If only broken inside MultiView:

```text
player.html
assets/eastcoins-multiview.js
assets/eastcoins-multiview-loading.js
assets/eastcoins-multiview-servers.js
```

## "Chat resets / disappears"

Start with:

```text
index.html
v2/assets/js/router.js
v2/assets/js/app.js
v2/assets/js/player.js
v2/assets/css/chat-cleanup.css
```

## "MultiView old UI is showing"

Start with:

```text
multiview.html
assets/eastcoins-multiview.css
v2/assets/js/router.js
```

Check:

```text
ecV2Embedded=1
ec-v2-embedded
```

## "MultiView share link opens old page"

Start with:

```text
assets/eastcoins-multiview-share.js
multiview.html
v2/assets/js/router.js
```

Canonical target should be:

```text
/?view=multiview&m=...
```

## "MultiView server buttons do nothing"

Start with:

```text
assets/eastcoins-multiview-servers.js
player.html
```

Remember the parent menu delegates to same-origin child player server buttons.

## "Picks markets missing / timing out"

Start with:

```text
picks.html
assets/eastcoins-picks-api.js
assets/eastcoins-picks-football-v50.js
assets/eastcoins-picks.js
functions/api/picks/catalog.js
```

## "Payout is wrong"

Start with:

```text
assets/eastcoins-moneyline.js
assets/eastcoins-moneyline-runtime.js
v2/assets/js/quick-bet.js
assets/eastcoins-picks.js
functions/api/picks/catalog.js
```

Do not use community-pool logic.

## "Firefox Twitch login fails"

Start with:

```text
picks.html
auth-complete.html
functions/api/picks/auth/twitch/start.js
functions/api/picks/auth/twitch/callback.js
functions/api/picks/bootstrap.js
```

Preserve popup + BroadcastChannel + bootstrap polling.

---

# 20. Coding Style / Change Strategy

EastCoin has accumulated many iterative feature patches.

When making a change:

1. Read the **current file on `main`**, not an old iteration installer.
2. Identify whether the problem belongs to the outer shell or an embedded child.
3. Make the smallest coherent change that fixes the current architecture.
4. Avoid adding another compatibility layer if an existing layer can be corrected.
5. Cache-bust changed CSS/JS assets when browsers may retain old behavior.
6. Preserve root-domain URLs.
7. Preserve persistent Twitch chat.
8. Preserve embedded cleanup.
9. Update `changelog.html`.
10. Validate syntax before shipping.

Do not use old iteration scripts as authoritative implementation references unless comparing historical intent.

---

# 21. Git Delivery Pattern

The user's normal local repository path is:

```text
C:\Users\jake\code\eastcoins
```

For a normal replacement-file update, provide commands in this style:

```bash
git --no-pager diff --check
git --no-pager diff --stat -- <changed files>

git add <changed files>

git status

git commit -m "Short descriptive commit message"

git push origin main
```

The user prefers this over Node installer scripts or patch installers.

---

# 22. Production Baseline Summary

The current production philosophy is:

```text
ROOT EASTCOIN SHELL
    owns nav
    owns Events
    owns Live Player
    owns Quick Bet
    owns Settings
    owns persistent Twitch chat

WORKSPACE
    embeds MultiView / Picks / other pages
    strips their duplicate global chrome

MULTIVIEW
    2–4 panels
    uses player.html as same-origin child tile player
    per-panel server switching
    shareable V2 layouts
    loading mask hides old player first-paint

PICKS
    Twitch identity
    sportsbook-style American moneyline payouts
    NFL + MLB + UFC/MMA
    API volume limits
    Community Ledger
    real wager backend still safety-locked

CHAT
    channel: zwades
    deferred initial load
    persistent after mounting
    never re-created by router
```

When in doubt, preserve this architecture first.

---

# 23. One-Sentence Rule for Future Claude Sessions

**EastCoin is a root-domain V2 shell with a native Events/Player experience, embedded MultiView/Picks workspaces, and one persistent outer Twitch chat; do not reintroduce standalone/V1 chrome, do not replace sportsbook moneylines with community-pool logic, and do not break root-domain deep links or chat persistence.**
