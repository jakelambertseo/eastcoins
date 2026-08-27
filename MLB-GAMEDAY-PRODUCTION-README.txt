EastCoin MLB Gameday — Production Integration

WHAT THIS ADDS
- A top-toolbar "⚾ Gameday" button in EastCoin event rooms.
- The button is hidden by default.
- It only appears after the active baseball event successfully matches an
  official MLB schedule game for that date.
- Non-MLB baseball, football, basketball, combat, hockey, etc. do not get it.
- Clicking Gameday opens the EastCoin-branded Game Center OVER the video.
- The video iframe remains mounted underneath.
- Twitch chat remains mounted.
- Closing Gameday returns to the exact stream without reloading it.

PRODUCTION FILES
New:
- mlb-gameday.html
- assets/eastcoins-mlb-gameday.js
- assets/eastcoins-mlb-gameday.css

Installer modifies:
- player.html
- changelog.html

HOW MLB-ONLY DETECTION WORKS
1. EastCoin reads the currently loaded event metadata.
2. Only events categorized as baseball are considered.
3. The controller checks MLB's official schedule around the event date.
4. Both teams must match strongly enough.
5. Only then is the Gameday button exposed.
6. The resolved MLB gamePk is passed into mlb-gameday.html.

This avoids simply showing the control on every generic baseball event.
