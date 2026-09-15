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
> **Green Room skins (2026-09-12)** — a `Skin ·` chip in the music
> page's header (next to See who; deliberately NOT in the ⋯ menu) picks
> one of: Green Room (default), Winamp, Game Boy, Jukebox, iPod,
> Jumbotron, Super Ultra Dark Mode, Super Ultra Minimal, I'm Fucked Up Bro
> (`trip`: the maximalist one — hue-cycling, wobble, melting stage, a
> ≤2 Hz screen flicker; everything stops under `prefers-reduced-motion`).
> `SKINS` in `v3-music.js`; the
> choice is `localStorage` `ec_music_skin`; a link can set it —
> `?view=music&theme=<name>` (`SKIN_ALIASES`: `winamp`, `gameboy`,
> `jukebox`, `ipod`, `jumbotron`, `void`/`dark`, `minimal`, `trip`/`imgone`,
> `greenroom`/`off` for the default) — which is kept and then stripped
> from the URL; `applySkin()` sets
> `[data-skin]` on the view root and `body[data-music-skin]`, cleared on
> unmount. Every skin is one CSS block in the `GREEN ROOM SKINS` section
> at the end of `v3.css` — same DOM, no behaviour change — and the retro
> faces (VT323, Silkscreen, Righteous, Orbitron) are one Google Fonts
> link injected the first time a skin needing them is chosen. "Super
> Ultra Dark Mode" is the only one that restyles the page around the
> room (it overrides the palette tokens on `body`).
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
> for October (Chicago time) and adds `.spooky-layer` (webs and fog; the
> `SPOOKY SEASON` at the end of `v3.css` holds the palette (it restates the
> `--*-rgb` accent tokens), the dressing and the emoji. The layer stops at
> the chat rail (Twitch's obscured check) and runs on every page; nothing in
> it moves any more. The ⋯ menu
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
> **Profile layout** (`v3-profile.js` `page()`): mini nav →
> `.pf-card.pf-head.has-tcard` → `.pf-tabs` Overview (bankroll,
> highlights, glance cards) / Picks / Casino / Music; the tab lives in
> the hash (`/u/name#casino`).
>
> **The profile card (2026-09-16)** — the header leads with a
> **trading card** (`tradingCard()`, `.tc*` in `v3.css`): real 2.5×3.5
> proportions, a bone border, the photo on a coloured panel, the name
> across the bottom, and the **league table on the back** — click
> turns it over. It replaced the plain `.pf-avatar`; the name, badges,
> team chip and the two `.pf-quick` strips sit beside it in a
> `238px 1fr` grid and stack under it below 760px. Every figure was
> already in `/api/picks/profile`, so nothing new is tracked.
>
> **The finish comes off the season ladder** (`tierOf()`): gold at
> rank 1, silver in the top five or at 80%+ accuracy, base otherwise
> — so the card changes when someone climbs rather than being a
> picture of a page. Gold and silver get a foil sweep; only gold gets
> the lit rank flash. The line under the name is their loudest badge,
> falling back to accuracy when they have none.
>
> Two things that are deliberate. **No team crest and no fallback mark
> behind the photo**: most of the site has not set a favourite team and
> a placeholder badge read as a broken image rather than a design.
> And `avatar()` returns a SPAN holding the initials with the `<img>`
> as a CHILD — so the circle goes on the wrapper and the image is
> absolutely positioned inside it, the shape `.cf-av` uses. Styling the
> wrapper as though it were the image is what made the first build
> render a square photo.
>
> **It is not live.** `v3-profile.js` has no poll at all: the page
> fetches once on mount, so a card showing #1 keeps showing #1 until
> the profile is opened again. Rank itself is recomputed server-side on
> every request and settlement runs on the 5-minute cron, so the number
> is right within about five minutes of a game ending — for anyone who
> loads the page after that. Read the poll-rate note above before
> adding a refresh here.
>
> **MLB slate line** — quiet sports still get one chat line a day when
> the 4 PM slate opens (`composeSlateOpen`, keyed `slateopen:<sport>:<day>`
> in `ops_status`); refills through the evening stay silent.
>
> **The Daily Pot (2026-09-13)** — 100 ZC from the house, once a day, paid
> on a bet at a moment nobody can predict. `functions/api/casino/_pot.js`:
> one `casino_pots` row per Chicago day (seed, hash, hidden `trigger_at` =
> 300..2,500 ZC of the day's stakes from `sha256(seed:trigger)`, amount =
> 100 + any rolled-over day). `settlePot()` runs after the stake lands in
> every bet endpoint (hilo/start, mines/start, plinko/drop, coin/bet,
> [game]/bet, pvp/join): if the day's stakes across all six tables have
> crossed the trigger — or it is 11 PM Central or later — it claims the
> row (OPEN→SETTLING), draws `sha256(seed:draw) mod total` over ranges
> laid out by stake in user-id order, credits the winner idempotently
> (`CASINO:POT:PAY:<day>`), and marks PAID with the shares stored. A day
> with no play rolls its amount forward. `GET /api/casino/pot` is the page
> read (never the trigger while open; `?day=` returns a paid pot's seed,
> ranges and draw). `v3-pot.js` `ECPot.mount(el, {compact})` draws the
> meter (the day's play toward the ceiling) on the floor and at the top of
> every game's side column, polling every 15 s, and drops the hit banner
> with confetti when a poll sees today's pot flip to PAID. Hits appear in
> the activity feed and ticker as type `pot`; the check page has "The
> Daily Pot" by day. It is the house's money — outside `HOUR_WIN_CAP`, in
> no bet table, so `hourlyNet()` and the books never see it. Exactly 100
> ZC of inflation a day, by construction.
>
> **Prop bets (2026-09-13)** — "Will Mahomes throw for 300?" as a
> market. The admin page's **Add a prop** tab takes a question, a Yes
> line and a No line (any American odds, -110 both ways by default) and
> a close time; `admin/open-market.js` stores it with sport `prop`,
> league `PROP`, away `Yes`, home `No`, and the question in
> `markets.question` (migration 0003, also added on the fly by
> `ensureQuestionColumn`). Everything downstream is unchanged — wagers,
> the ledger, profiles, the book — because a prop IS a market; what
> differs is naming and colour, and `_props.js` (`isProp`, `matchup`,
> `sideLabel`, `shortQuestion`) is the one place that knows. `prop` is
> in `MANUAL_SPORTS`, so the scheduled run never grades it: an admin
> calls it from the Markets row (Yes ✓ / No ✗ / Void) through
> `settle-market.js`, which for a prop is allowed BEFORE the close
> (applyVerdict flips it to SETTLING first, so nothing can land after
> the call). A prop's `/g/` page is `/g/<market id>` (`slugFor` returns
> the id — "yes-no-<day>" would collide). Chat: `!pick 10 yes`, `!pick
> 10 no`, and with two props open a word from the question picks which
> (`matchProp` in `bot/_bot.js`); `!odds yes` prints the question and
> both prices. Announce works from the row or straight from the form.
> On the site, props are **violet** (`--prop` in `v3.css`): the Picks
> card carries the question with ✓/✗ marks instead of crests
> (`.market.prop`, `.propmark`), tickets, the ledger, the admin row, the
> feed and the game page all follow. The Sports-filter chip reads "Props".
>
> **The bell (2026-09-14)** — a notifications button in the nav
> (`#notifBtn`, between search and the profile pill) with a red count,
> and a panel under it: what happened to YOU since you last looked.
> `functions/api/picks/notifications.js` builds the rows from tables
> the site already writes — your picks' `settled_at` (won / lost /
> refunded, props say the call), `casino_pots.paid_at` (you or
> whoever hit the Jackpot), `markets.odds_locked_at` for your
> favourite team, `ops_status` `announce:<id>` notes, and new badges
> (computed, so `users.notif_badges` remembers the keys already shown).
> `users.notif_seen_at` is the only other state: GET marks rows after
> it unread (a first look shows three days), POST `{seen:true}` stamps
> it and the badge set. No inbox table, so it can never disagree with
> the ledger. `v3-notify.js` polls every 90 s while the tab is
> visible (~960 requests a day per tab, five indexed queries plus the
> cached badge computation), opens the panel as a fixed element placed
> by hand so it never covers the Twitch rail, marks seen on open and
> clears the count on close, and drops a toast when something new
> lands while the page is open. Styles are `.notif-*` at the end of
> `v3.css`. Not in the bell on purpose: other people's picks, songs,
> casino spins, "closing soon" — the ticker and Activity carry those.
>
> **The Game Room (2026-09-16)** — `/?view=games`, a nav link of its
> own. Small games played for TITLES, never ZCoins: keeping coins out
> is what lets them be quick and daft, and it is why a browser game is
> allowed here at all. `functions/api/games/_games.js` holds the frame
> — `game_scores` (one row per person per game per Chicago day),
> `game_days` (the day's seed, made on first request so an answer
> cannot be derived from the date), `board`, `recordFor` with a day
> streak, and `champions` for who has taken the most days in 30.
> One row per person per game per day is a UNIQUE INDEX on
> `(game, user_id, day)` — a random primary key never collided, so the
> daily rule was not actually enforced; it is added on its own and
> forgiving, because a table that somehow already held a duplicate
> would otherwise take the whole room down with it.
> `/api/games/home` is the room. The nav link is **hidden** while the
> room is iterated on. Five games:
>
> **Helmet Zoom** `/?view=helmet` (`v3-helmet.js`,
> `games/helmet/*`, table `helmet_plays`) — one NFL crest a day,
> cropped by `ZOOMS` from ×15 down to ×1.7, six guesses, scored 6
> down to 1 and 0 for a miss. **The page never learns the club**: it
> draws onto a canvas from `/api/games/helmet/img`, which is keyed on
> the DAY, and `guess.js` grades. Conference after three wrong,
> division after four. `matchTeam` takes abbreviation, nickname, city
> or full name and ASKS which when a city is shared (New York, Los
> Angeles) rather than guessing. Honest limit: the crest is still an
> image the network tab can show, which is another reason it pays
> titles.
>
> **Field Goal** `/?view=fg` (`v3-fg.js`, `games/fg/*`, table
> `fg_runs`) — power meter, then aim, into a wind the SERVER picks
> from the run's seed. Every kick is five yards further (from 20) and
> one miss ends it. The page shows the result at once, then hands in
> every stop and `replay()` judges the lot, so a score always matches
> the run. Perfect play is 11 makes to 70 yards; ignoring the wind is
> about 8. **The maths is mirrored in `_fg.js` and `v3-fg.js`** —
> change one, change the other; the scratch test runs both. Meters are
> read from the clock at the moment of the click, never from the last
> painted frame, so a throttled tab cannot judge a kick on a number
> nobody saw.
>
> **Simon (2026-09-16)** `/?view=simon` (`v3-simon.js`,
> `games/simon/*`, table `simon_runs`) — four pads, one more every
> round, score is rounds CLEARED and `saveScore({keepBest:true})`
> keeps the day's best. The sequence is a pure function of the run's
> seed (`sequenceFor`) and is handed out **one round at a time**, so
> the page is never told more than it is about to show and there is
> nothing to read ahead. `step.js` grades the answer against the
> server's copy; a wrong pad ends the run there rather than at the end
> of the round. The straightest game in the room.
>
> **Dead Centre (2026-09-16)** `/?view=centre` (`v3-centre.js`,
> `games/centre/*`, table `centre_runs`) — a bar sweeps, stop it in
> the middle, five goes. `speedsFor` picks the sweep speeds from the
> seed and `replay()` scores the set server-side, so a good run cannot
> be copied into a later one. `pointsFor(stop, speed) = max(0,
> round((200 - error*2000) * (0.85 + speed*0.3)))`, so a **quick sweep
> is worth more than a slow one** and a perfect set beats 1,000 — do
> not write "out of 1,000" in copy. Like Field Goal, `barAt()` reads
> the bar from `performance.now()` at the moment of the press, never
> from the last painted frame.
>
> **The Gold Button (2026-09-16)** (`v3-gold.js`, `games/gold/*`,
> table `gold_claims`) — once a day, at a moment nobody knows
> (`triggerFor` from the day's seed, always between 10:00 and 22:30
> Central), it appears **on every page** for two minutes; first press
> takes the day, scored `120` for instant down to `1` on the bell.
> **It has no page and it does not poll**: the bell already asks
> `/api/picks/notifications` every 45 seconds, that answer now carries
> `gold`, and `v3-notify.js` dispatches it as an `ec-gold` DOM event
> which `v3-gold.js` only listens for and draws. That is why the
> window is two minutes rather than thirty seconds — one poll has to
> be certain to catch it. Any future "it appears everywhere" feature
> should ride that request the same way rather than adding a poll.
> The winner is atomic: `gold_claims.day` is the PRIMARY KEY and the
> claim is `INSERT OR IGNORE`, so two presses in the same instant
> cannot both win. It sits **bottom LEFT** for the same reason the
> bell's toasts do — anything over the Twitch rail on the right makes
> it flag itself obscured and stops chat. **Bottom left is only safe
> above 980px**, where the rail is a right-hand column: below that the
> rail is a fixed drawer over the right of the screen and it is OPEN BY
> DEFAULT, so a phone is the ordinary case, not an edge one (measured
> at 430px the full button lay across 272px of the rail at z-index 73
> against its 55). Under 980px with `body.chat-open` the button
> collapses to a disc in the strip the drawer leaves, and the notif
> toast, same corner and same bug, simply waits. The disc's width is
> `calc(100vw - min(360px,86vw) - 12px)` — the drawer's OWN expression,
> so an overlap is impossible at any viewport rather than merely absent
> at the widths someone checked. The guarantee runs the safe way round:
> the only rule that makes the rail visible under 980px requires
> `body.chat-open`, which is exactly the condition the collapse keys
> on, so the rail can never be up without the collapse being active.
> Anything new that parks itself in that corner needs the same pair of
> rules — the floating music player is already there, so the button
> moves to the top when a dock is up. `/api/games/gold/state` says
> whether it is up and who took it, and **never when it is due**; its
> Game Room card is a `div`, not a link.
>
> **Check a seed (2026-09-13)** — `/?view=verify` (`v3-verify.js`) over
> `GET /api/casino/verify?game=&seed=[&hash=&mines=&players=]`, which is
> pure maths with no session or database: it hashes the seed and replays
> the result with the games' OWN functions (`cardAt`, `bombsFor`,
> `pathFor`, the shared `outcome()`s, `resultOf`, `outcomeFor`), so the
> page shows the deck Higher or Lower dealt, the bombs, the path, the
> angle, the coin, a table's rounds. The page also hashes the seed in the
> browser with `crypto.subtle` and compares, so the match does not rest
> on the server's word. `K.verifyLink(node, params)` puts "Check this
> seed →" under every game's verify block, deep-linking here with the
> seed and hash filled in; the floor's House rules link to it too.
>
> **Casino layout (rebuilt 2026-09-16)**: the floor **opens on the
> games** and is one screen. Head → `.cas-cards` → the `.cas-ledger-head`
> fold. It had grown the other way about: a ticker, a four-card
> `.cas-me` summary strip and the Jackpot meter all sat above the
> tiles, so the games began 528px down a 595px viewport and a laptop
> opened the casino on everything except a game. People come here to
> play and mostly click a card straight away, so **anything added to
> this page goes below the cards unless it is a game**.
>
> The head carries the title, the limits line as the subtitle, and
> `.cas-headme` → `.cas-mebar`, one pill holding the Jackpot cell
> (ECPot's, see below) then wallet ("My (coin) Wallet", the only money
> figure so the only one wearing the coin), net, record and this hour
> vs cap. **The bar is built once and renderMe() only writes its
> numbers**: it used to be replaced every five-second poll, which would
> tear the Jackpot's poller down and stand a new one up at three times
> its rate. Signed out, the stat cells hide and a login button shows.
>
> `.cas-card` is the game card: a portrait panel carrying **painted art**
> (`/v3/assets/img/casino/<key>.webp`, 540x720, ~35 KB each, 249 KB for
> all seven) with the name across the bottom, a live line under the
> panel (phase, countdown, who is in) and, signed in,
> **how many plays are left this hour**. That limit is TEN PER GAME,
> not ten across the floor, so it is a number per card; `home.js` counts
> it with each game's OWN limiter helper (`betsLastHour`,
> `gamesLastHour`, `dropsLastHour`, `cardsLastHour`, `joinsLastHour`)
> rather than a query written for the display, so the card and the bet
> endpoint cannot drift apart — keep it that way. The blurb and who is
> in the room moved to the card's `title`. **`.cas-card` is the casino's
> alone; the Game Room still draws `.cas-tile`**, so its accents and
> layout are separate.
>
> **The art (2026-09-16)** — built from 1.7 MB PNG uploads by
> `scratchpad/build-cards.mjs` (sharp). Two crops matter. The black
> frame is removed so the art fills the panel rather than sitting in a
> second border; and the game's name, which was baked across the bottom
> of every upload, is cropped OFF — the page already draws that same
> nameplate, and as real text it stays sharp at any size, reads to a
> screen reader and needs no new image when a game is renamed. Finding
> that title band is fussier than it looks: the scan is limited to the
> bottom 28% AND the left 60%, because Plinko's payout numbers and
> Scratch-Off's silver panel are just as bright, sit mid-card, and take
> a third of the art off those two otherwise. Each is then cover-cropped
> to 3:4 at build time so the browser never fetches a pixel the layout
> crops. `--card-rgb` survives as the **loading state** behind the
> image, and the emoji returns via an `error` handler if the art ever
> 404s, so a card is never a hole. Adding a game means adding one
> `<key>.webp` and one `--card-rgb`.
>
> Two things about that art are easy to get wrong later. The images
> are served with an hour of cache and carry no version in their path,
> so **`ART_V` in `v3-casino.js` must be bumped whenever an image
> changes** or the edge keeps handing out the old one; a regenerated
> set looked unchanged in production until that was added. And the
> grid **counts** its columns (`repeat(4, …)`, 3 under 980px, 2 under
> 620px, with a `max-width:1080px`) rather than fitting them: an
> `auto-fill` track packed seven across a desktop and left each card a
> thumbnail. Card width therefore drives the art size — four across is
> about 260px, which is why the source is 540 wide.
>
> The ledger (Recent results paged / House rules) is a **fold that
> starts closed** — `.cas-ledger-head` is a button, `.cas-ledger-body`
> is hidden — because it is reference, not a reason anyone opened the
> casino. Closed the page is ~900px; open, ~1,580. The Jackpot no
> longer has a card here: `ECPot.mount(el, {pill:true})` draws it as the
> bar's first cell with the detail on hover, keeping one poll, one
> cache and the same hit banner. Game pages keep stage + side column
> and still use `{compact:true}`; the fairness line is a
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
> (750 ZC net in any rolling hour across every game — 300 until 2026-09-13, `capCheck` in
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
> auto-cashes at `topRung()` — the last rung still **under** the ×30
> ceiling (×125 until 2026-09-14 night, when one player took 1,554 and
> 777 on ten-bomb boards in two hours; ×30 makes the best board 570 on
> 20 ZC, under the hourly cap) (3 bombs: 19 tiles ×113.85; 10 bombs: 7 tiles ×73.95; best board
> 2,277 on a 20 ZC stake, 1 in 115; the ceiling was ×50, then ×25, then
> ×125 on 2026-09-12 when a real jackpot was wanted — the ladder roughly
> doubles per tile so the prize cannot be dialled in exactly) — rather
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
> **Scratch-Off (2026-09-14)** — `/?view=scratch` (`v3-scratch.js`,
> `functions/api/casino/scratch/*`, tables `scratch_cards` and
> `scratch_commits`). Nine cells under a foil (a canvas the pointer
> erases; 60% scratched clears the rest, "Reveal all" skips it); three
> of a kind pays that symbol's price. `PRIZES` in `_scratch.js`, rarest
> first: crown ×100 (0.1%), diamond ×25 (0.3%), fire ×10 (1%), clover ×5
> (3%), target ×3 (5%), football ×2 (12%), coin ×1 (22%) — 103.5%
> return, 43.4% of cards win something, top prize 2,000 on a 20 ZC card.
> The card is DECIDED AND PAID at `buy`, like a Plinko drop; scratching
> is the reveal. Fairness is Plinko's commit-per-card: the outcome is
> `sha256(seed:scratch)` as a fraction walked down the table, then the
> grid is laid out to match it (`gridFor`: exactly three of the winner
> on a win, nothing three times on a loss, shuffled by
> `sha256(seed:cell:i)`), so a card never lies and a two-crown near-miss
> is real. In `hourlyNet()`, the Jackpot's `dayStakes()`, the floor, the
> feed, profiles, the dashboard's book and the check page (`game=scratch`).
>
> **The PvP tables (2026-09-12)** — Russian Roulette `/?view=roulette` and
> Last One Standing `/?view=standing`, one client (`v3-pvp.js`, a `table(spec)`
> factory registered twice) over one server module
> (`functions/api/casino/pvp/*`, tables `pvp_rounds` and `pvp_entries`).
> **Nobody picks a player count**: the first join opens a lobby and a
> clock — 60 seconds, or `lobbyMs` in `GAMES` (roulette runs 30, since
> 2026-09-12 night) — and whoever is in at zero plays; one person alone is
> refunded and the table clears. **The buy-in is fixed at 20** — no amount
> is read from the body. **Both tables pay the winner every buy-in on the
> table and the house takes nothing** (three at 20 is 60 to one person).
> Roulette is elimination to one: each round the cylinder gets one chamber
> per player still in, doubled until at least six (`chambersFor`), the
> live one comes from `sha256(seed:roulette:k)`, chamber c is pulled by
> the c-th remaining seat wrapping, whoever gets it is out, reload, again;
> N players is N−1 rounds and every seat starts on exactly 1 in N. The
> result is `{stages:[{players,chambers,live,shot}], order, winner}`.
> (Until 2026-09-12 evening it stopped at the first shot and split that
> one stake among survivors, storing `{chambers,live,loser}`; `v3-pvp.js`
> `stagesOf()`/`winnerOf()` still read that shape, so the one such round
> in D1 draws correctly.) Standing: Fisher–Yates over the seats from the
> seed, last left takes `20 × N`. **Settlement is
> triggered by whoever asks** — a state poll, a join, or the casino floor,
> which polls widest — and is claimed with a conditional UPDATE to
> `SETTLING` so two pollers cannot both pay; a round stuck in SETTLING for
> two minutes is assumed crashed and re-claimed, which is safe because
> every payout is idempotent per entry (`CASINO:PVP:PAY:<entryId>`). At
> most one LOBBY per game, enforced by a partial unique index, so two
> people sitting down in the same instant share a table. The page never
> decides anything: the result arrives settled and paid with its seed
> revealed, and the animation is playback. `pvp_entries` is in
> `hourlyNet()`, the floor, the activity feed, profiles and the dashboard's
> book; a refund is neither a win nor a loss anywhere. No chat, no bot:
> the tables live on the site only, by request. **Roulette is live again
> (2026-09-12 night, with the drawn cylinder); Standing is still `paused: true`
> in `GAMES`**: off the floor, `join.js` refuses
> with PAUSED before touching anything, the pages read "Closed for now",
> and the floor still calls `settleDue` so an in-flight lobby resolves.
> Work continues on **`/pvp-test`**, which loads the REAL `v3-pvp.js`
> against `pvp-sandbox.js`, an engine in the page that seats bots, runs
> the clock and settles with ports of `chambersFor`/`outcomeFor`/
> `payoutsFor` — a scratch test runs both over the same seeds — and
> intercepts every `/api/` call, so no ZCoin can move there. Flip
> `paused` to reopen; the practice page needs nothing changed.
>
> **The casino pays the players (2026-09-14)** — asked for a 1–4%
> return to the room after four days at 99.0% overall with almost
> everyone down (Hi-Lo alone was at 87%: its 1% edge is PER CALL, so a
> six-call run gave up 6%, and every payout was floored to the coin,
> which took 2–7% more off small stakes). Now: every payout is
> `Math.round`ed; Hi-Lo `EDGE_RETURN = 1.006` per call (one call
> ≈100.5%, six ≈104%; the ×50 ceiling still trims 12-call chains); Mines
> `EDGE_RETURN = 1.04`; Plinko's inner buckets 1.5 / 0.4 (102.3% on 20,
> 104% on 10); Wheel red/black 2.05 and gold 60 (100.8% / 103% / gold
> exactly fair); Coin Flip 2.04 (`COIN_PAYS`: 41 on 20, 31 on 15, 20 on
> 10). Blend ≈103–104%; expected inflation at ~5,000 ZC/day of play is
> ~175 ZC/day, the
> same order as the Jackpot, and `HOUR_WIN_CAP` (750) plus the 20 ZC /
> ten-an-hour limits bound anyone farming it (~36 ZC/hour expected at
> full tilt). The previous paragraph's warning still applies above
> this: do not go past ~104%.
>
> **The casino is near-fair on purpose (2026-09-11)** — every game
> returns ~98–99% (Hi-Lo and Mines `EDGE_RETURN = 0.99`; Plinko's table
> 98.6%; Wheel red/black 98.3%; Coin Flip was always exactly fair at 2×).
> The old 4% edge earned the house ~30 ZC a day and made players feel they
> never won, so they drifted to Picks. Payout shapes favour FREQUENT wins
> over big ones. Do not push the return past 100%: with the 750/hour cap
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
> total from `watching` so guests are counted but faceless. **Viewers
> per server (2026-09-13)**: a watch tab's beat also carries `srv` — the
> provider's source and stream number, "golf/2" — stored in
> `site_presence.srv`; GET returns `servers: {eventId: {srv: n}}`, and
> `v3-watch.js` reads it through `mountWatchers`'s third argument to label
> the dropdown "Server 3 of 8 · 4 watching". Pasted URLs send no `srv`. It returns a
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
> **D1 reads are the budget that binds, and POLL RATE is what spends them**
> (2026-09-12) — the free plan allows 5 million rows read a day and the site
> spent them by about 1:30 PM on a Saturday, 500ing login, presence and the
> whole casino. The account is on Workers Paid now (25 billion rows/month),
> but the shape of the problem is worth keeping. **Every table here is tiny**
> — the biggest is `wallet_operations` at a few hundred rows — so no single
> query is expensive and query tuning is NOT where the budget goes. What
> spends it is frequency: one casino tab polls the shared games every 1.5
> seconds, which is 57,600 requests a day, each running six to ten queries.
> One tab left open for a day is millions of rows. **So: before adding a
> poll, work out its requests/day × queries × rows and say the number out
> loud.** A hidden tab now stops polling (per-player games, the casino floor,
> the Who's here strip) or drops to a fifth rate (the coin and the wheel,
> whose polls are what settle a finished round and pay people, so they must
> never stop entirely). Two secondary rules, cheap and still right: any
> column a hot path filters on wants an index (`coin_bets` had one on
> `round_no` and none on `user_id`), and an hour/day filter must compare the
> **bare column** — `created_at >= datetime('now', '-1 hour')`, never
> `datetime(created_at) >= …`, because wrapping the column stops SQLite
> using an index on it at all.
>
> **The admin page** (`v3-admin.js`) carries the same head/strip/tabs shape:
> six numbers from the markets already loaded, then Markets / Open a market
> / Announce / Wallet, markets ten to a page. An action's result selects the
> tab it belongs to, so a message never lands on a hidden panel. The
> **dashboard** (`v3-dashboard.js`) leads with total users, total bets, each
> side's take, open exposure and who is here, then Overview / Picks book /
> Casino / Health; the Health tab's badge is counted off the built cards
> (`.db-card.bad, .db-card.warn`) so a new card is included automatically.
> Long lists page client-side via `pagedTable`/`pagedList`, keyed so the
> one-minute refresh keeps the reader's page.
>
> **Watch rooms (2026-09-15)** — Movies & TV, "Watch together" in the
> player bar. `functions/api/screen/room.js` (table `watch_rooms`):
> the host's tab writes its clock (position, playing, the episode)
> every ~5 s and at once on play/pause/seek, from the vidy.st events
> the page already reads; guests poll every 5 s. **vidy.st cannot be
> driven from outside** — it only emits events — so a guest is kept in
> step by reloading the embed (`reloadEmbed`) at the host's projected
> position when they drift past 8 s, and loaded PAUSED there
> (`autoplay=false`) when the host pauses; never twice within 12 s.
> Close enough for a film, not frame-locked, and the bar says so. Who
> is in a room comes from `site_presence` rows with ref `room:<id>`.
> The room rides on the URL as `?room=<id>` on either link form; a
> "Watch rooms" shelf on the page lists live rooms (`?list=1`). A host
> whose beat stops for two minutes is stale (guests keep their own
> clock); leaving the player ends (host) or leaves (guest) the room.
>
> **Pretty URLs, Movies & TV only (2026-09-12)** — `/movie/inception`,
> `/tv/lost`, `/tv/lost-s1`, `/tv/lost-s1-ep1`. Served by
> `functions/movie/[[path]].js` and `functions/tv/[[path]].js`, which do
> what `/g/` does: the ordinary shell plus a real `<title>` and preview
> tags. The rest of the site is still `?view=`; this was scoped to the
> catalog on purpose.
>
> **No TMDB id in the path**, so a name has to be searched for:
> `/api/screen/resolve` takes an exact slug match first, then the most
> popular among them, then a second search with the hyphens left in
> (TMDB tokenises `wall-e` and `wall e` differently), then a title that
> starts with what was asked for — and **otherwise nothing**. Taking
> TMDB's first result made `/movie/wall-e` open "East of Wall", and
> confidently opening the wrong film is worse than a miss: a miss drops
> the person into a search for the same words. Known edge: a few titles
> never surface from their own slug (WALL·E is one, because "wall e"
> matches hundreds of things), and the search fallback is the answer.
>
> **The name rule is `functions/api/screen/_slug.js`, mirrored inside
> `v3-screen.js`** — change one, change the other. The mirror exists
> because the page has to WRITE the URLs the server reads, and a link
> that works when clicked but not when copied is worse than no pretty
> URL. A scratch test lifts the client's copy out of the file and runs
> both over the same awkward names. **A trailing number is always part
> of the name**, never an id or a year — that is what an id-in-the-tail
> scheme gets wrong about Ocean's 11 — and `-ep3` with no `-s2` in
> front of it is treated as a name rather than guessing season 1.
> Shelf filters stay on `?view=screen`: they are browse state and do
> not belong on a link to one title. Old `?view=screen&t=&id=&s=&e=`
> links still work and still share.
>
> **Banning an account (2026-09-12)** — the All Users page gives admins a
> Ban button in each row (`/api/picks/admin/ban`, table `user_bans`,
> helpers in `_bans.js`). A ban is the FULL block, chosen deliberately:
> `getSessionUser()` returns null for a banned id, so every signed-in
> feature refuses at once without any of them needing to know bans exist,
> and the Twitch callback turns a fresh sign-in away with `?auth=banned`,
> which the shell shows as one dismissible line. Three rules that must not
> drift: **admins cannot be banned and nobody can ban themselves** —
> admins are who lift bans, so either would make a state the site cannot
> be talked out of through its own screens; **a reason is required**, and
> the row keeps who, when and why, with a lift marking the row rather than
> deleting it so "has this person been banned before" stays answerable;
> and **`isBanned()` fails OPEN** — a broken lookup means "not banned",
> because one bad query signing out the entire site is far worse than one
> ban not landing. A ban takes nothing: ZCoins live in StreamElements and
> are untouched, and picks already locked still settle and still pay,
> because they were paid for before the ban and the book has to balance.
> Who is banned is sent only to admins, and nothing is posted to chat,
> Discord or the activity feed — a ban is not an announcement.
>
> **Admin links in the ⋯ menu** — `ownerMenu()` in `v3-shell.js` appends
> Admin, Dashboard and Activity under a "Yours" heading for the logins in
> its `ADMIN_LOGINS` set, which mirrors `ADMIN_ALLOWLIST` in
> `picks/_lib.js` (`bootypaper`, `zwades`, `andyreidisapawg`, `heartlarva`) — change one,
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
> and the `streams` / `sicko` view names on load (`games` was one of
> them until 2026-09-16, when the Game Room took that name; the old
> mini-games page is still served at `/games`), and
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
> page's Upcoming list via `/api/picks/upcoming`; since 2026-09-15 a
> paused sport, or a daily sport outside its opening hours — MLB before
> 3 PM or after 1 AM Central — is served from a 12-hour shadow copy
> instead of refetched, `refreshWorthIt` in `_autoopen.js`; and live
> score tracking runs every other tick, `live:last` in `ops_status`); a fresh price is
> fetched only when a game is due, so section 9.5's quota concern is
> handled by design rather than by a cap. The Odds API plan is 20,000
> credits/month — comfortable, still not to be spent casually.
>
> **Pausing auto-open for a sport (2026-09-13)** — `_autoopen.js` reads
> `ops_status` `autoopen:pause:<sport>` (`baseball`, `american-football`)
> holding `{"until": ISO}` and opens nothing for that sport until then;
> markets already open are left alone. Set it with wrangler:
> `INSERT OR REPLACE INTO ops_status (key, value) VALUES
> ('autoopen:pause:baseball', '{"until":"…Z","why":"…"}')`; delete the row
> or let `until` pass to resume. Used on NFL Sunday to keep the MLB slate
> off Picks: the five empty markets were closed (state VOID, no refunds
> needed) and baseball paused through Monday night (until Tuesday 00:00 Central), so Tuesday's 4 PM slate is the first MLB back.
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
> **Site-wide notices (2026-09-15)** — the admin page's Announce tab
> has a **Post a notice** box: a title, a line, an icon and which page
> it opens. It writes an `ops_status` row keyed `notice:<slug>`
> (`admin/notice.js`), which `/api/picks/notifications` folds into the
> bell, so it lands unread for everyone who has not looked since and
> toasts on any open tab within a poll. Nothing goes to chat or
> Discord — a notice is on-site only, so posting one can never be a
> surprise in someone's stream. Reposting the same title replaces that
> notice and makes it unread again; Pull removes it from every bell.
> The bell only carries notices from the last fortnight.
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
> **NFL Sunday (2026-09-13)** — on Sundays, and Mondays until 10:30 PM
> Central (when the night game is over), September–January (Chicago
> time; the community is ~95% NFL) the Sports page shows football only: `nflSundayNow()` +
> `isNflSunday()` in `v3-events.js` keep any listing naming an NFL team
> (`footballRank === 0`, whatever category the provider filed it under),
> RedZone, `ppv-nfl-*` feeds and titles with "NFL"; everything else is
> dropped at load, so the All/Live chips agree, and the filter-bar note
> reads "NFL Sunday · football only". A Sunday with nothing that fits
> shows the usual page. `?allsports=1` shows everything for a look. Picks
> is untouched — baseball markets still open there.
>
> **One pick box (2026-09-15)** — `v3-pickbox.js` (`ECPickBox.open({
> market, side, onPlaced })`) is the only place a pick is placed from
> the site: the Picks card, the game page's Yes/No or team buttons and
> the Tonight strip all open it. Same stake field with 10 / 25 / 50 /
> All-in chips, same three-line summary, same receipt, prop-aware
> (question line, "pays when the call is made"). It POSTs
> `/api/picks/wagers`, updates the wallet chip and refreshes the bell.
> The old ticket code in `v3-picks.js` is the fallback if the module is
> missing. **Colour rule (same day):** gold is money (the wallet chip
> went from green to gold), violet is props, semantic green/red are
> results only, and a game's accent lives on its floor tile, not its
> page; the blue that marked refunds is gone (neutral now).
>
> **Tonight on Picks (2026-09-15)** — the strip under the Sports
> ticker (`v3-tonight.js`, mounted by `picksBanner()` in `v3-events.js`;
> the old "Picks are now live" card is its fallback). Reads
> `/api/picks/bootstrap` every 60 s while visible and shows, in order:
> an open PROP (question, Yes/No with lines, a stake box that POSTs
> `/api/picks/wagers` right there; more props link to Picks), else
> your open picks with the live score from `ECV3Scores`, else the
> slate (games open, first close, how chat is split on it from the
> ledger), else what opens next from `/api/picks/upcoming`. Styles
> `.tonight-*` wear `.picksbanner`'s frame; a prop turns it violet.
>
> **RedZone Sunday (2026-09-13)** — when the provider lists NFL RedZone
> (`isRedZone`: title "NFL RedZone" or id `ppv-nfl-red-zone`), the Sports
> page puts `redZoneHero()` above the groups — a full-width banner with
> "Football season is here.", kickoff-or-LIVE, who's watching,
> and one button into the watch view — and drops its small card from the
> grid; a search shows the card again. Styles are `.rz-*` in `v3.css`:
> slow yard-line drift, a soft red pulse, a sheen on the headline, all
> off under reduced motion. Nothing is special-cased by date, so it
> appears every Sunday the listing does.
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
> **Weekly roundup** — `/api/admin/weekly` (cron key or admin) posts
> one Discord card for the seven days ending now: winner and loser of
> the week (best and worst net), the biggest single win and the biggest
> single loss (largest stake lost) with links to their game pages, then
> every bettor's record, net, staked and best pick, ranked, capped at 25
> lines. The cron Worker fires it at `6 21,22 * * 1` UTC (4:06 PM —
> never a minute the five-minute settlement trigger owns: on 2026-09-14
> a `:05` firing delivered only the settlement event) and the
> endpoint posts only when it is Monday 4 PM Central (`?force=1` from
> the dashboard bypasses that, `?dry=1` builds without posting,
> `?days=N` widens the window); `weekly:sent:<Monday>` in `ops_status`
> makes it once a week. The dashboard's Discord card has Preview week
> (dry run shown inline) and Post weekly roundup.
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
