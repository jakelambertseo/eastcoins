EastCoin Iteration 47 — Football Markets + MultiView Servers
===============================================================

IMPORTANT BASE
--------------
GitHub main was still at:
70dcff478807317077ffcf2f10fcbe16daf6c584
"Focus Picks markets on today and tomorrow"

This patch is intended to be applied AFTER the Iteration 46 performance patch.
Iteration 46 changes changelog.html, so applying 46 first keeps the release
timeline clean and lets Iteration 47 become the latest entry.

WHAT CHANGED
------------
Picks:
- Baseball and UFC/MMA remain today + tomorrow.
- Football uses every still-upcoming NFL/NCAAF game already present in the
  existing /api/picks/catalog 14-day horizon.
- Football filter remains visible even if no line is currently posted.
- A game still requires a real current Odds API h2h home/away moneyline.
- No fabricated odds and no change to the real-wager safety lock.
- Picks runtime cache version bumps to 47 on Picks and root.

MultiView:
- Loaded EastCoin event panels gain a Servers ▾ button.
- Server list is generic: Server 1, Server 2, etc.
- Provider/source names are not exposed.
- Switching servers changes only that MultiView panel.
- The selected panel server is remembered locally.
- Manual URL panels do not get the Servers button unless they originated from
  an EastCoin event and therefore retain an eventId.
- Existing player, resize, focus, Solo, Replace and Remove behavior remains.

FILES
-----
Modified:
- assets/eastcoins-moneyline-runtime.js
- assets/eastcoins-multiview.js
- picks.html
- index.html
- multiview.html
- changelog.html

New:
- assets/eastcoins-multiview-servers.js
- assets/eastcoins-multiview-servers.css

APPLY
-----
From the EastCoin repository root:

git apply --check eastcoin-iteration-47-football-multiview-servers.patch
git apply eastcoin-iteration-47-football-multiview-servers.patch

Then:

git --no-pager diff --check
git --no-pager diff --stat -- index.html picks.html multiview.html changelog.html assets/eastcoins-moneyline-runtime.js assets/eastcoins-multiview.js assets/eastcoins-multiview-servers.js assets/eastcoins-multiview-servers.css

git add index.html picks.html multiview.html changelog.html assets/eastcoins-moneyline-runtime.js assets/eastcoins-multiview.js assets/eastcoins-multiview-servers.js assets/eastcoins-multiview-servers.css

git status
git commit -m "Restore football markets and add MultiView servers"
git -c gc.auto=0 push origin main
