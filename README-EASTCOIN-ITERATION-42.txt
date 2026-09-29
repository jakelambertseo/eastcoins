EastCoin Iteration 42 FIXED — NFL-First Football
================================================

This replaces the first Iteration 42 installer.

WHY THE FIRST INSTALLER FAILED
------------------------------
After EastCoin launched at the root domain, /v2/index.html became only a
compatibility redirect. It no longer loads events.js, so the first installer
incorrectly required an Events JS cache-bust in that file.

This corrected installer touches only the live files:
- v2/assets/js/events.js
- index.html
- changelog.html

ORDER
-----
Football now displays:
1. RedZone
2. NFL
3. College / other football

Existing Recommended/Time sorting stays intact inside each tier.

RUN
---
node tools\apply-eastcoin-iteration-42.cjs
