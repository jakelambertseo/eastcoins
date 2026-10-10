/* ============================================================
   The Arcade inside EastCoin — /?view=lounge and /?view=climb (2026-10-07, a TEST, not linked)

   The owner: "since the lounge/games will live on eastcoin.vip, lets embed it into a page on eastcoin.vip so we can try it out. it needs
   the shared nav, and keep the twitch embed closed for now."

   Same shape as /?view=eastscape: each arcade page is its own document (its own WebGL, its own connection to the arcade's room server),
   framed edge to edge under the shell's nav. Made on mount, thrown away on unmount, so leaving closes the connection like closing a tab.

   THE TWITCH RAIL IS CLOSED HERE, without touching anyone's saved chat preference: body.arcade-on hides the rail (the iframe stays
   mounted, so it is not reloaded when you leave, which is the shell's rule) and gives the view the full width. The arcade has its own
   chat, bottom left inside the game.

   The frame talks back with one message, { type: "ec-arcade", go: <room> | "exit" }: the menu's games, a cabinet in the lounge and Join
   in the who's-here list all become a shell route here, so the address bar and Back stay honest.

   Until the arcade ships, its pages exist only in the code repo (tools/*-mock), so on a local copy the frame points there; on the live
   site they live under /arcade/ in the same folder layout (/arcade/lounge3d-mock/, /arcade/climb3d-mock/, /arcade/arcade-kit/...), so no path inside them changes. */
(() => {
  const ROOMS = { lounge: { title: "The Lounge", local: "/tools/lounge3d-mock/index.html", live: "/arcade/lounge3d-mock/" },
    climb: { title: "The Climb", local: "/tools/climb3d-mock/index.html", live: "/arcade/climb3d-mock/" },
    cs67: { title: "CS67", local: "/tools/blockshot/index.html", live: "/arcade/blockshot/" },
    eastkart: { title: "EastKart", local: "/tools/eastkart/index.html", live: "/arcade/eastkart/" } };   // (2026-10-12) the kart racer; unlinked until the owner has iterated on it   // (2026-10-08) the shooter, named CS67 since 2026-10-11 (its files keep the blockshot name): a standalone in the Games section, not a lounge room
  let frame = null, onMsg = null;
  const CSS_ID = "css-arcade-embed";
  function needCss() {
    if (document.getElementById(CSS_ID)) return;
    const st = document.createElement("style"); st.id = CSS_ID;
    st.textContent = `body.arcade-on:not(.arcade-chat) .shell{grid-template-columns:minmax(0,1fr)}
body.arcade-on:not(.arcade-chat) .chatrail{display:none!important}
body.arcade-on .spooky-layer{display:none!important}
body.arcade-on{overflow:hidden}
body.arcade-on .view{padding:0;height:calc(100vh - var(--nav-h));height:calc(100dvh - var(--nav-h));overflow:hidden}
body.arcade-on .arcade-frame{display:block;width:100%;height:100%;border:0;background:#05030b}`;
    document.head.append(st);
  }
  function view(room) {
    return {
      mount(container) {
        needCss();
        document.body.classList.add("arcade-on"); document.body.classList.toggle("arcade-chat", room === "cs67" || room === "eastkart");   // (2026-10-11) the shooter keeps the Twitch rail beside it
        // an old ?view=lounge link shows the short address (/lounge), keeping anything else on the query
        const q = new URLSearchParams(location.search);
        if (q.get("view") === room) { q.delete("view"); history.replaceState(history.state, "", `/${room}${q.size ? `?${q}` : ""}${location.hash}`); }
        frame = document.createElement("iframe");
        frame.className = "arcade-frame"; frame.title = ROOMS[room].title;
        const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname), as = new URLSearchParams(location.search).get("as");
        frame.src = `${local ? ROOMS[room].local : ROOMS[room].live}?embed=1${local && as ? `&as=${encodeURIComponent(as)}` : ""}`;
        frame.allow = "autoplay; fullscreen; pointer-lock";
        frame.addEventListener("load", () => frame?.focus(), { once: true });
        container.append(frame);
        onMsg = (e) => {
          if (e.origin !== location.origin || e.source !== frame?.contentWindow || e.data?.type !== "ec-arcade") return;
          if (e.data.go === "exit") window.ECV3?.go("events");
          else if (ROOMS[e.data.go]) window.ECV3?.go(e.data.go);
        };
        addEventListener("message", onMsg);
        window.ECPresence?.beat(room);
      },
      unmount() {
        removeEventListener("message", onMsg); onMsg = null;
        if (frame) { frame.src = "about:blank"; frame.remove(); frame = null; }
        document.body.classList.remove("arcade-on", "arcade-chat");
      }
    };
  }
  function boot() {
    if (window.ECV3?.register) { for (const r of Object.keys(ROOMS)) window.ECV3.register(r, view(r)); }
    else setTimeout(boot, 30);
  }
  boot();
})();
