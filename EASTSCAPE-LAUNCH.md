# EastScape launch plan — Mon 21 Sep to Thu 1 Oct 2026

**Local only. Never copied to the deploy repo.**

## The decision

EastScape replaces the casino: clicking **Casino** in the nav opens the game.

**Launch Thursday 1 October. Use Sunday 27 September as a dress rehearsal, not the launch.**

Sep 27 is an NFL Sunday — the biggest, least patient audience of the week, and the
Sports page is football-only that day. Replacing the casino that morning means any
breakage happens in front of everyone during the main event, and people are there to
watch football, not to learn a new game. Launching Thu 1 Oct gives three quiet days of
real traffic before **Sun 4 Oct**, which becomes the audience moment on a proven build.

## What is already true (verified 21 Sep, do not re-litigate)

- **The games are the same games.** EastScape's tables call the SAME
  `functions/api/casino/*` endpoints. A ticket stake is a voucher (`_stake.js`) that
  lets a bet skip the wallet debit — "same limits, same seed, same edge draw, same
  payout, same rows, same hourly cap". So the Daily Pot, `HOUR_WIN_CAP`, the activity
  feed, profiles, the dashboard book and the verify page all keep working. **No money
  path is being rebuilt.** This is what makes the replacement safe.
- **Coverage is genuinely complete for everything live**: Coin Flip, Wheel, Hi-Lo,
  Mines, Plinko, Scratch-Off are all in `G.GAMES`, plus Slots and Dice that the site
  never had. Russian Roulette and the Fight Pit are in-game too.
- **Not covered, and each is already paused or closing**: Horse Race (paused), Last One
  Standing (paused), Red Light (built, never shipped), The Grind (owner: "going away
  anyway"). None of these block the switch — but each needs a decision, not a drift.
- **Gear does not show on the character** (`fit = "tiro"` hardcoded, v104). Relevant to
  the vanity store, not to launch.

## Cut from this launch

- **The vanity store.** Eleven days with a casino replacement in them is not when you
  add a store with new art. It is the best post-launch feature you have — ship it first
  week of October as the "there's more" beat.
- **World boss.** Post-launch.
- **Weapon vanities.** Weapons are not drawn on characters at all; that is a new
  rendering system, not an art pack.

---

## The plan

### Mon 21 Sep — decide, so nothing is decided twice
- [ ] Confirm launch date: **Thu 1 Oct**, rehearsal Sun 27 Sep.
- [ ] Decide each paused game: finish, hide, or say "coming soon" — Horse Race, Last One
      Standing, Red Light, The Grind. Drifting is the bad option; a visible dead link on
      launch day is worse than a game that plainly is not there yet.
- [ ] **Check what a signed-out visitor sees at `/eastscape`.** The casino was
      members-only and showed a login card. If the game shows a blank canvas or an error
      to a logged-out visitor, that is a launch blocker and it is on the front door.
- [ ] Write the redirect map (below) on paper before touching code.

### Tue 22 Sep — the switch, reversible
- [ ] Nav **Casino → `/eastscape`**.
- [ ] Redirects, carrying query: `/?view=casino`, `flip`, `wheel`, `hilo`, `mines`,
      `plinko`, `scratch`, `roulette`, `standing`, `grind`, `verify`. **Every one of
      these has been pasted in chat and lives in someone's history.** A 302 into the
      game, or into the game at the right table if that is cheap.
- [ ] Keep the old floor reachable at an unlinked URL for rollback. One-file decision,
      the way `v2-shell.html` was.
- [ ] **The fast path.** A casino card was click → bet in about five seconds. The game is
      load → character → walk → table. Decide the answer for "I only want to play Plinko
      during an ad break" — a table picker on arrival, a deep link straight into a table,
      or accept the funnel deliberately. Do not leave this to chance; it is the single
      biggest behaviour change for your regulars.

### Wed 23 Sep — the new-player funnel
- [ ] **Tables tutorial.** This was backlog because Kellz got confused. On 1 Oct
      *every casino user is a new EastScape user*, so it moves from nice-to-have to
      required.
- [ ] Loading states for windows fetched on first open (backlog item, now visible to
      everyone on day one).
- [ ] Time a genuinely fresh account: sign in → character → first bet placed. If that is
      over ~60 seconds, cut something.

### Thu 24 Sep — phone
- [ ] Full pass at phone width on the **funnel**, not just the game: nav → gate →
      character creation → table → bet → cash out.
- [ ] The chat rail is open by default under 980px and sits over the right of the
      screen. Re-check every fixed thing against it (the gold button rule).
- [ ] Decide the honest answer for a phone that cannot run it well, if there is one.

### Fri 25 Sep — fairness and money
- [ ] **Fix the verify page replaying the wrong game** for `dice`, `slots`, `roul`,
      `pit`, `redlight` — it currently shows "✓ The hash matches" beside the wrong
      replay. Tolerable on a side page; not tolerable when this is the casino.
- [ ] Run `tools/` money tests: commit, sweep, wallet-key, crate.
- [ ] Walk a voucher stake end to end: tickets → voucher → bet → payout → hourly cap →
      Daily Pot → activity feed → profile → dashboard book. Confirm the books balance.

### Sat 26 Sep — freeze and load
- [ ] **Code freeze** for the rehearsal. Nothing new after today until Monday.
- [ ] **Concurrency.** One Durable Object holds the world. Everyone who used to click a
      card now opens a socket. Test it at a realistic Sunday number — this is the
      scaling unknown and the one that cannot be fixed live.
- [ ] Full regression against the checklist in CLAUDE.md §18.
- [ ] Take a backup and **rehearse the rollback** — restoring the nav link, not just
      believing it would work.

#### Backups and the revert procedure (audited 26 Sep — owner: "add this to pre launch checklist")
What is true today: the nightly world backup RUNS (cron 4:20 AM CT → `/api/eastscape/backup` →
R2 `eastcoin-backups/eastscape/world/<stamp>.json.gz` + `latest.json.gz`, 30-day prune; last one
26 Sep, 29 characters, 34 KB). `/restore` + `tools/eastscape-restore-from-backup.mjs` exist
(dry-run by default, `--only char:<id>`, refuses while anyone is connected). The World is a
SQLite-backed Durable Object, so Cloudflare also keeps 30 days of point-in-time history that
nothing uses yet. ZCoins are StreamElements' and out of scope; tickets, gear, pets, quests and
islands are all in the character record. In order:
- [ ] **Restore drill on today's backup**: load `latest.json.gz` through the real `World` +
      `normChar` on Node and report what each character keeps or loses. The format has changed
      under the script (staged quests, vanity, pets, wizardry) and nobody has proved a restore
      loads. Make it a check in the suite so a rules change that would break a restore fails
      before it ships.
- [ ] **Hourly snapshots** kept 48 h beside the daily (30 d) and a weekly (1 year): one cron
      line and a `tier` on the backup route. A crash at 11 PM currently loses the whole evening.
- [ ] **Pre-deploy snapshot** baked into the deploy step (`tools/eastscape-deploy.mjs`: export
      to `eastscape/world/pre-deploy-<stamp>.json.gz`, then `wrangler deploy`; refuse to deploy
      if the export fails). Deploys are the likeliest cause of damage.
- [ ] **Single-character restore that needs only THAT player offline**, with a name lookup
      (`--only login:<name>`) instead of a Twitch id.
- [ ] **Stale-backup alarm**: last EastScape backup older than 26 h, or a failed pre-deploy
      snapshot → admin bell + Discord ledger line.
- [ ] **Runbook** (local file, never deployed): three scenarios — one player lost something /
      the world is wrong since a time / the worker is dead — each as numbered commands with how
      to verify afterwards.
- [ ] Second pass: **point-in-time rewind** through the DO's own history (`/rewind?to=<time>`,
      ESCAPE_KEY, dry-run first — covers anything between snapshots); **off-Cloudflare copy**
      (pull the last 7 dailies to a git-ignored folder weekly).

### Sun 27 Sep — dress rehearsal (NFL Sunday)
- [ ] **Do not flip the nav. Do not ship during the day.**
- [ ] Site notice inviting people in (the bell, on-site only — no chat, no Discord).
- [ ] Watch: worker errors, DO load, D1 reads, the dashboard's Health tab.
- [ ] Write down **where people get stuck**, not just what breaks. Confusion is the
      thing a rehearsal buys you that a test never will.

### Mon 28 Sep — fix what Sunday found
- [ ] Triage Sunday's list ruthlessly: breaks, then confusion, then polish. Anything
      that is not one of those three waits until after launch.

### Tue 29 Sep — polish and unpolished content
- [ ] Art gaps, placeholder copy, anything that reads as unfinished on a first visit.
- [ ] The Game Room nav link: in or out.
- [ ] Read every string a brand-new person sees, in order, as if you had never seen it.

#### Take these OFF the screen before launch (owner, 22 Sep)
Four things that are ours, not a player's — debug surfaces and half-finished
corners that a first-time visitor should never meet.
- [ ] **Remove the Picks board beside Bom Trady.** The sports board standing next to
      the Prize Counter. Picks lives on the website; it has no business being the
      first thing beside the counter every new player is sent to.
- [ ] **Remove the NET button from the top of the game nav.** Built on 21 Sep to chase
      AndyReidisaPAWG's rubberbanding (ping / offset / server stats). It is a
      diagnostic. Keep the panel's code — it earns its place the next time someone
      says they are snapping back — but take the button out of the nav, behind a key
      or an admin check rather than deleted.
- [ ] **Test that Roulette does not refresh.** The PvP table reloading mid-round is the
      report. Reproduce it with a real round and real money on the table, not an empty
      lobby: HOLD_MS / STALE_MS and the redraw-on-signature-change are all timing, and
      a hidden browser pane pauses CSS transitions, so measure it in a real window.
- [ ] **Remove the quick icons so they do not refresh.** Same shape of bug, same fix
      first: find out whether they are re-rendering or genuinely reloading before
      pulling them, so the cause does not survive into whatever replaces them.

### Wed 30 Sep — final regression
- [ ] Full regression again. Backup. Rollback rehearsed again.
- [ ] Freeze. Nothing ships on launch morning that was not on production by tonight.

### Thu 1 Oct — launch
- [ ] Flip the nav in the morning, not the evening — you want hours of daylight to react.
- [ ] Site notice. Watch the dashboard.
- [ ] Fix only what is broken. No features.

### Fri 2 – Sat 3 Oct — watch
- [ ] Two quiet days of real traffic. Fix, do not build.

### Sun 4 Oct — the audience moment
- [ ] The big Sunday, on a build with three days of real use behind it.

---

## Redirect map (write it before you code it)

| Old | New |
|---|---|
| `/?view=casino` | `/eastscape` |
| `/?view=flip` `wheel` `hilo` `mines` `plinko` `scratch` | `/eastscape` (ideally at that table) |
| `/?view=roulette` `standing` `grind` | `/eastscape` or an honest "this one has moved/closed" |
| `/?view=verify` | keep — fairness must stay reachable and linkable |

## The rule for the next eleven days

**If it is not broken, confusing, or on this list, it waits until October.**
