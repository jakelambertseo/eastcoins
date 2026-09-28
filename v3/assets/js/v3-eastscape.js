/* ============================================================
   EastScape inside EastCoin — /?view=eastscape (2026-09-28, a TEST, not linked)

   The owner: "as a test, can you embed EastScape inside of the EastCoin container and put it on eastcoin.vip/?view=eastscape. it needs to
   have the global top nav and twitch chat embedded to the right. i want to test how it operates".

   The game is its own page (/eastscape, its own server connection, its own chat), so this view is a same-origin frame of it that fills the
   view area edge to edge: the shell's nav stays on top and its Twitch rail stays on the right, both untouched, exactly as on any route. The
   frame is made on mount and thrown away on unmount, so leaving the route closes the game's connection like closing its tab would.
   ============================================================ */
(() => {
  let frame = null;
  const CSS_ID = "css-eastscape-embed";
  function needCss() {
    if (document.getElementById(CSS_ID)) return;
    const st = document.createElement("style"); st.id = CSS_ID;
    st.textContent = `body.es-on .view{padding:0;height:calc(100vh - var(--nav-h));height:calc(100dvh - var(--nav-h));overflow:hidden}
body.es-on .es-frame{display:block;width:100%;height:100%;border:0;background:#0c0908}`;
    document.head.append(st);
  }
  const view = {
    mount(container) {
      needCss();
      document.title = "EastScape — EastCoin";
      document.body.classList.add("es-on");
      frame = document.createElement("iframe");
      frame.className = "es-frame";
      frame.title = "EastScape";
      /* on a local copy there is no /eastscape rewrite, and the dev login rides ?as=: both are carried through for testing */
      const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname), as = new URLSearchParams(location.search).get("as");
      frame.src = local ? `/eastscape.html${as ? `?as=${encodeURIComponent(as)}` : ""}` : "/eastscape";
      frame.allow = "autoplay; fullscreen";
      container.append(frame);
      window.ECPresence?.beat("eastscape");
    },
    unmount() {
      if (frame) { frame.src = "about:blank"; frame.remove(); frame = null; }
      document.body.classList.remove("es-on");
      document.title = "EastCoin";
    }
  };
  function boot() {
    if (window.ECV3?.register) window.ECV3.register("eastscape", view);
    else setTimeout(boot, 30);
  }
  boot();
})();
