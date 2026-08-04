# EastCoin Persistent Twitch Chat — Live Player + Events

This is the first-stage persistent shell for only the Live Player and Events sections.

## What changes

- `index.html` becomes the permanent outer shell.
- Twitch chat is mounted once in `index.html` and is never replaced when switching between Live Player and Events.
- The former Live Player page moves to `player.html`.
- `events.html` remains the Events page.
- Both pages receive `?shell=1` when loaded in the center view, which hides their duplicate sidebar and chat.
- Selecting an event in the Events view sends its event ID to the outer shell. The shell loads `player.html?shell=1&event=...` in the center while Twitch chat remains connected.

## Files to place in the repository

Copy every file in this ZIP into the repository root while preserving folders:

```text
index.html
player.html
events.html
changelog.html
_headers
assets/eastcoins-persistent-shell.css
assets/eastcoins-persistent-shell.js
assets/eastcoins-embedded-view.css
assets/eastcoins-view-bridge.js
```

All other current assets remain unchanged.

## Backend / Cloudflare setup

No Worker, database, API, environment variable, or server process is required.

Cloudflare Pages will deploy this as ordinary static files. The included `_headers` file disables stale caching for the new shell files and the two view pages.

The shell uses query-based routes, so no `_redirects` file is required:

```text
index.html?view=player
index.html?view=events
index.html?event=EVENT_ID
```

Existing shared event URLs that point to the site root with `?event=` continue to open the Live Player inside the persistent shell.

## Frontend behavior to test after deployment

1. Open EastCoin normally and sign into Twitch chat if needed.
2. Send or locate a chat message.
3. Click Events in the sidebar.
4. Confirm the chat does not flash, reconnect, or lose its scroll position.
5. Choose an event.
6. Confirm only the center view changes to the Live Player.
7. Use browser Back and Forward between Live Player and Events.
8. Test sidebar collapse and chat resizing.
9. Test mobile navigation and verify chat appears below the center view.
10. Open a shared `?event=` URL directly and confirm it loads inside the shell.

## Scope of this first stage

Favorites, Games, Status, Aim Trainer, and Button Masher still use normal full-page navigation and will reload chat. Only Live Player and Events are routed through the persistent shell, as requested.

## Rollback

To roll back, restore the previous `index.html` and delete `player.html` plus the four new persistent-shell assets. `events.html` can also be restored to its previous copy.
