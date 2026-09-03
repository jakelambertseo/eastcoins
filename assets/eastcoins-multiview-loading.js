(() => {
  "use strict";

  const grid =
    document.getElementById(
      "mvGrid"
    );

  if (!grid) {
    return;
  }

  const STYLE_ID =
    "ecMultiViewLoadingMaskStyle";

  const FRAME_SELECTOR =
    "iframe.mv-player-frame";

  const MASK_CLASS =
    "mv-stream-loading-mask";

  const READY_SELECTOR =
    "#activeFrame";

  function installStyle() {
    if (
      document.getElementById(
        STYLE_ID
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      STYLE_ID;

    style.textContent = `
      .mv-panel-body{
        position:relative;
      }

      .${MASK_CLASS}{
        position:absolute;
        inset:0;
        z-index:40;
        display:grid;
        place-items:center;
        padding:22px;
        overflow:hidden;
        background:
          radial-gradient(
            circle at 50% 42%,
            rgba(229,185,43,.07),
            transparent 34%
          ),
          #050505;
        opacity:1;
        visibility:visible;
        transition:
          opacity .18s ease,
          visibility .18s ease;
        pointer-events:none;
      }

      .${MASK_CLASS}.is-ready{
        opacity:0;
        visibility:hidden;
      }

      .mv-stream-loading-card{
        display:grid;
        justify-items:center;
        gap:10px;
        color:#f2eee8;
        text-align:center;
      }

      .mv-stream-loading-spinner{
        width:34px;
        height:34px;
        border:3px solid rgba(255,255,255,.09);
        border-top-color:#e5b92b;
        border-radius:50%;
        animation:
          ecMvLoadingSpin
          .85s
          linear
          infinite;
      }

      .mv-stream-loading-card strong{
        font-size:.82rem;
        font-weight:900;
        letter-spacing:.02em;
      }

      .mv-stream-loading-card small{
        color:#77716b;
        font-size:.66rem;
        font-weight:700;
      }

      @keyframes ecMvLoadingSpin{
        to{
          transform:rotate(360deg);
        }
      }

      @media (prefers-reduced-motion:reduce){
        .mv-stream-loading-spinner{
          animation:none;
          border-color:rgba(229,185,43,.55);
        }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function isMultiViewPlayer(
    frame
  ) {
    try {
      const url =
        new URL(
          frame.dataset.playerUrl ||
          frame.src,
          window.location.href
        );

      return (
        url.pathname
          .toLowerCase()
          .endsWith(
            "/player.html"
          ) &&
        url.searchParams.get(
          "multiview"
        ) === "1"
      );
    } catch {
      return false;
    }
  }

  function makeMask(
    body
  ) {
    let mask =
      body.querySelector(
        `:scope > .${MASK_CLASS}`
      );

    if (mask) {
      return mask;
    }

    mask =
      document.createElement(
        "div"
      );

    mask.className =
      MASK_CLASS;

    mask.setAttribute(
      "role",
      "status"
    );

    mask.setAttribute(
      "aria-live",
      "polite"
    );

    mask.innerHTML = `
      <div class="mv-stream-loading-card">
        <span
          class="mv-stream-loading-spinner"
          aria-hidden="true"
        ></span>
        <strong>Opening stream…</strong>
        <small>Connecting to EastCoin player</small>
      </div>
    `;

    body.appendChild(
      mask
    );

    return mask;
  }

  function setSlowMessage(
    mask
  ) {
    const title =
      mask.querySelector(
        "strong"
      );

    const meta =
      mask.querySelector(
        "small"
      );

    if (title) {
      title.textContent =
        "Still loading stream…";
    }

    if (meta) {
      meta.textContent =
        "This provider is taking longer than usual.";
    }
  }

  function hideMask(
    mask
  ) {
    if (
      mask.classList.contains(
        "is-ready"
      )
    ) {
      return;
    }

    mask.classList.add(
      "is-ready"
    );

    window.setTimeout(
      () => {
        mask.remove();
      },
      220
    );
  }

  function watchFrame(
    frame
  ) {
    if (
      frame.dataset
        .ecLoadingMask ===
        "1" ||
      !isMultiViewPlayer(
        frame
      )
    ) {
      return;
    }

    frame.dataset
      .ecLoadingMask =
        "1";

    const body =
      frame.closest(
        "[data-panel-body]"
      );

    if (!body) {
      return;
    }

    const mask =
      makeMask(
        body
      );

    let checks = 0;
    let timer = 0;
    let innerObserver =
      null;

    function stop() {
      if (timer) {
        window.clearInterval(
          timer
        );

        timer = 0;
      }

      try {
        innerObserver?.disconnect();
      } catch {}

      innerObserver =
        null;
    }

    function ready() {
      try {
        const doc =
          frame.contentDocument;

        return Boolean(
          doc?.querySelector(
            READY_SELECTOR
          )
        );
      } catch {
        /*
          player.html is same-origin, so this normally remains inspectable.
          If that ever changes, the frame load fallback below still prevents
          the legacy prompt from flashing immediately.
        */
        return false;
      }
    }

    function finish() {
      stop();
      hideMask(
        mask
      );
    }

    function inspect() {
      checks += 1;

      if (ready()) {
        finish();
        return;
      }

      if (
        checks === 40
      ) {
        setSlowMessage(
          mask
        );
      }
    }

    function observeInnerPlayer() {
      try {
        const doc =
          frame.contentDocument;

        if (
          !doc?.documentElement
        ) {
          return;
        }

        innerObserver =
          new MutationObserver(
            inspect
          );

        innerObserver.observe(
          doc.documentElement,
          {
            childList:true,
            subtree:true
          }
        );
      } catch {}
    }

    /*
      player.html's own first paint is the legacy V1 URL prompt. The mask is
      already mounted before that paint, then remains until the nested provider
      iframe (#activeFrame) replaces that prompt.
    */
    frame.addEventListener(
      "load",
      () => {
        inspect();
        observeInnerPlayer();
      }
    );

    inspect();

    timer =
      window.setInterval(
        inspect,
        250
      );
  }

  function scan() {
    grid.querySelectorAll(
      FRAME_SELECTOR
    ).forEach(
      watchFrame
    );
  }

  installStyle();

  const observer =
    new MutationObserver(
      scan
    );

  observer.observe(
    grid,
    {
      childList:true,
      subtree:true
    }
  );

  scan();
})();
