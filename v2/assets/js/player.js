(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;
  const E = V2.els;
  const $$ = V2.$$;

  const watchServerCount =
    document.querySelector("#watchServerCount");

  const copyWatchLink =
    document.querySelector("#copyWatchLink");

  const openStreamExternal =
    document.querySelector("#openStreamExternal");

  const watchMultiView =
    document.querySelector("#watchMultiView");

  const watchBet =
    document.querySelector("#watchBet");

  const watchCollapse =
    document.querySelector("#watchCollapse");

  const WATCH_CONTROLS_KEY =
    "eastcoinV2WatchControlsCollapsed";

  let pendingPreference = null;
  let deepLinkHandled = false;
  let deepLinkTimer = 0;

  function openModal(node) {
    node?.classList.add("open");
  }

  function closeModal(node) {
    node?.classList.remove("open");
  }

  function ensureChatLoaded() {
    const frame =
      document.querySelector(
        "#persistentTwitchChat"
      );

    if (
      !frame ||
      !frame.dataset.src
    ) {
      return;
    }

    const current =
      frame.getAttribute("src");

    if (
      !current ||
      current === "about:blank"
    ) {
      frame.src =
        frame.dataset.src;
    }
  }

  function openChat() {
    ensureChatLoaded();

    if (V2.settings) {
      V2.settings.setChatVisible(
        true
      );
      return;
    }

    E.chat?.classList.add(
      "open",
      "attention"
    );

    window.setTimeout(
      () =>
        E.chat?.classList.remove(
          "attention"
        ),
      700
    );
  }

  function closeChat() {
    if (V2.settings) {
      V2.settings.setChatVisible(
        false,
        { attention: false }
      );
    }
  }

  function savedControlsCollapsed() {
    try {
      return (
        localStorage.getItem(
          WATCH_CONTROLS_KEY
        ) === "true"
      );
    } catch {
      return false;
    }
  }

  function setControlsCollapsed(
    collapsed,
    {
      save = true
    } = {}
  ) {
    const next =
      Boolean(collapsed);

    E.player?.classList.toggle(
      "controls-collapsed",
      next
    );

    if (watchCollapse) {
      watchCollapse.textContent =
        next
          ? "☷ Show Controls"
          : "▾ Collapse";

      watchCollapse.setAttribute(
        "aria-expanded",
        String(!next)
      );

      watchCollapse.setAttribute(
        "aria-label",
        next
          ? "Show player controls"
          : "Collapse player controls"
      );
    }

    if (save) {
      try {
        localStorage.setItem(
          WATCH_CONTROLS_KEY,
          String(next)
        );
      } catch {}
    }
  }

  function toggleControls() {
    setControlsCollapsed(
      !E.player?.classList.contains(
        "controls-collapsed"
      )
    );
  }

  function supportedMoneylineKey(value) {
    const key =
      String(value || "")
        .toLowerCase();

    return (
      key.startsWith(
        "americanfootball_"
      ) ||
      key.startsWith(
        "baseball_"
      ) ||
      key ===
        "mma_mixed_martial_arts"
    );
  }

  function hasAmericanPrice(value) {
    const number =
      Number(value);

    return (
      Number.isFinite(number) &&
      number !== 0
    );
  }

  function canShowWatchBet(match) {
    if (
      !match ||
      String(
        match.id || ""
      ).startsWith("custom:")
    ) {
      return false;
    }

    const start =
      V2.ts(match?.date);

    if (
      V2.live(match) ||
      !Number.isFinite(start) ||
      start <= Date.now()
    ) {
      return false;
    }

    const odds =
      V2.cardOdds?.forMatch?.(
        match
      ) || null;

    return Boolean(
      odds?.providerEventId &&
      odds?.provider === "odds_api" &&
      supportedMoneylineKey(
        odds?.sportKey
      ) &&
      hasAmericanPrice(
        odds?.away?.american
      ) &&
      hasAmericanPrice(
        odds?.home?.american
      )
    );
  }

  function updateWatchBet() {
    if (!watchBet) return;

    watchBet.hidden =
      !canShowWatchBet(
        S.active
      );
  }

  function openBet() {
    if (!S.active) return;

    if (!canShowWatchBet(S.active)) {
      V2.toast(
        V2.live(S.active) ||
        V2.ts(S.active?.date) <=
          Date.now()
          ? "Betting is closed for this event."
          : "Betting is not available for this event."
      );
      updateWatchBet();
      return;
    }

    V2.quickBet?.open?.(
      S.active
    );
  }
  function activeStream() {
    return (
      S.streams[
        Number(
          S.activeStreamIndex || 0
        )
      ] || null
    );
  }

  function normalizedSource(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function serverName(stream, index) {
    return `Server ${index + 1}`;
  }
  function watchUrl() {
    const stream =
      activeStream();

    const url =
      new URL(
        "/",
        window.location.origin
      );

    if (
      S.active &&
      !String(
        S.active.id || ""
      ).startsWith("custom:")
    ) {
      url.searchParams.set(
        "event",
        V2.id(S.active)
      );

      if (
        stream?.source ||
        stream?.provider
      ) {
        url.searchParams.set(
          "source",
          String(
            stream.source ||
            stream.provider
          )
        );
      }

      if (
        stream?.streamNo !==
          undefined &&
        stream?.streamNo !== null
      ) {
        url.searchParams.set(
          "stream",
          String(stream.streamNo)
        );
      }

      return url;
    }

    if (stream?.embedUrl) {
      url.searchParams.set(
        "watch",
        stream.embedUrl
      );
    }

    return url;
  }

  function syncBrowserUrl() {
    if (
      !document.body.classList.contains(
        "ec-watching"
      )
    ) {
      return;
    }

    const url = watchUrl();

    window.history.replaceState(
      {},
      "",
      `${url.pathname}${url.search}`
    );
  }

  function clearWatchParams() {
    const url =
      new URL(
        window.location.href
      );

    for (const key of [
      "event",
      "source",
      "stream",
      "watch"
    ]) {
      url.searchParams.delete(key);
    }

    window.history.replaceState(
      {},
      "",
      `${url.pathname}${
        url.search
      }${url.hash}`
    );
  }

  function showWatchView() {
    document.body.classList.add(
      "ec-watching"
    );

    E.player.hidden = false;
    E.player.setAttribute(
      "aria-hidden",
      "false"
    );

    setControlsCollapsed(
      savedControlsCollapsed(),
      {
        save: false
      }
    );

    updateWatchBet();
  }

  function closePlayer(
    {
      clearUrl = true
    } = {}
  ) {
    if (E.frame) {
      E.frame.onload = null;
      E.frame.src = "about:blank";
    }

    E.playerLoading.hidden = true;

    E.player.hidden = true;
    E.player.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.classList.remove(
      "ec-watching"
    );

    V2.mlbGameday?.reset?.();

    S.active = null;
    S.streams = [];
    S.activeStreamIndex = 0;
    pendingPreference = null;

    if (E.streams) {
      E.streams.innerHTML = "";
    }

    if (watchServerCount) {
      watchServerCount.textContent =
        "No stream selected";
    }

    if (clearUrl) {
      clearWatchParams();
    }
  }

  function preferredStreamIndex() {
    if (
      !pendingPreference ||
      !S.streams.length
    ) {
      return 0;
    }

    const source =
      normalizedSource(
        pendingPreference.source
      );

    const streamNo =
      String(
        pendingPreference.streamNo ??
        ""
      );

    let index =
      S.streams.findIndex(
        (stream) =>
          source &&
          normalizedSource(
            stream?.source ||
            stream?.provider
          ) === source &&
          streamNo &&
          String(
            stream?.streamNo ?? ""
          ) === streamNo
      );

    if (index !== -1) {
      return index;
    }

    index =
      S.streams.findIndex(
        (stream) =>
          streamNo &&
          String(
            stream?.streamNo ?? ""
          ) === streamNo
      );

    if (index !== -1) {
      return index;
    }

    index =
      S.streams.findIndex(
        (stream) =>
          source &&
          normalizedSource(
            stream?.source ||
            stream?.provider
          ) === source
      );

    return index === -1
      ? 0
      : index;
  }

  async function openMatch(
    match,
    options = {}
  ) {
    if (!match) return;

    S.active = match;
    S.streams = [];
    S.activeStreamIndex = 0;

    pendingPreference = {
      source:
        options.source || "",
      streamNo:
        options.streamNo ??
        options.stream ??
        ""
    };

    E.playerTitle.textContent =
      match.title || "Event";

    E.playerMeta.textContent =
      V2.datetime(match);

    E.playerKicker.textContent =
      V2.live(match)
        ? "● LIVE · EASTCOIN PLAYER"
        : "EASTCOIN PLAYER";

    E.sideTitle.textContent =
      match.title || "Event";

    E.sideMeta.textContent =
      `${V2.datetime(match)} · ${V2.provider(match)}`;

    E.saveActive.textContent =
      S.favorites.has(
        V2.id(match)
      )
        ? "★"
        : "☆";

    E.frame.src = "about:blank";
    E.playerLoading.hidden = false;

    E.loaderTitle.textContent =
      "Finding playable streams…";

    E.loaderMeta.textContent =
      "Checking EastCoin sources.";

    E.streams.innerHTML = "";

    if (watchServerCount) {
      watchServerCount.textContent =
        "Finding streams…";
    }

    showWatchView();

    updateWatchBet();
    V2.mlbGameday?.sync?.(match);

    // Card odds can finish enriching just after a deep-linked player opens.
    // Recheck briefly so an eligible event gets the same Bet shortcut as its
    // Events card without changing the stream or Twitch chat.
    [500, 1500, 3000].forEach(
      (delay) => {
        window.setTimeout(
          updateWatchBet,
          delay
        );
      }
    );

    if (V2.events?.addRecent) {
      V2.events.addRecent(match);
    }

    // Put the event in the address bar immediately. The selected source
    // is added once its stream list arrives.
    syncBrowserUrl();

    try {
      const streams =
        await V2.API()
          .getStreams(
            match,
            false
          );

      S.streams =
        (
          Array.isArray(streams)
            ? streams
            : []
        ).filter(
          (stream) =>
            Boolean(
              stream?.embedUrl
            )
        );

      if (!S.streams.length) {
        throw new Error(
          "No playable streams returned."
        );
      }

      renderStreams();
      selectStream(
        preferredStreamIndex()
      );

      pendingPreference = null;
    } catch (error) {
      E.loaderTitle.textContent =
        "No playable stream available";

      E.loaderMeta.textContent =
        error?.message ||
        "EastCoin could not load this event.";

      if (watchServerCount) {
        watchServerCount.textContent =
          "No servers available";
      }
    }
  }

  function renderStreams() {
    if (!E.streams) return;

    if (watchServerCount) {
      watchServerCount.textContent =
        `${S.streams.length} ${
          S.streams.length === 1
            ? "server"
            : "servers"
        } available`;
    }

    E.streams.innerHTML =
      S.streams
        .map(
          (stream, index) => `
            <button
              class="stream ${
                index ===
                S.activeStreamIndex
                  ? "active"
                  : ""
              }"
              data-stream="${index}"
              type="button"
              title="Switch to ${V2.esc(
                serverName(
                  stream,
                  index
                )
              )}"
              aria-label="Switch to ${V2.esc(
                serverName(
                  stream,
                  index
                )
              )}"
            >
              <span>${V2.esc(
                serverName(
                  stream,
                  index
                )
              )}</span>
            </button>
          `
        )
        .join("");

    $$(
      "[data-stream]",
      E.streams
    ).forEach((button) => {
      button.onclick = () =>
        selectStream(
          Number(
            button.dataset.stream
          )
        );
    });
  }
  function selectStream(index) {
    const stream =
      S.streams[index];

    if (!stream) return;

    S.activeStreamIndex =
      index;

    $$(
      "[data-stream]",
      E.streams
    ).forEach(
      (
        button,
        buttonIndex
      ) => {
        button.classList.toggle(
          "active",
          buttonIndex === index
        );
      }
    );

    E.playerLoading.hidden = false;
    E.loaderTitle.textContent =
      "Opening stream…";
    E.loaderMeta.textContent =
      serverName(
        stream,
        index
      );

    E.frame.onload = () => {
      E.playerLoading.hidden = true;
    };

    E.frame.src =
      stream.embedUrl;

    syncBrowserUrl();

    window.setTimeout(() => {
      E.playerLoading.hidden = true;
    }, 3500);
  }

  function openCustom(url) {
    S.active = {
      id:
        `custom:${Date.now()}`,
      title: "Custom Stream",
      date: Date.now()
    };

    S.streams = [{
      source: "Custom",
      streamNo: 1,
      embedUrl: url,
      language: "User URL"
    }];

    S.activeStreamIndex = 0;
    pendingPreference = null;

    E.playerTitle.textContent =
      "Custom Stream";

    E.playerMeta.textContent =
      url;

    E.playerKicker.textContent =
      "CUSTOM STREAM";

    E.sideTitle.textContent =
      "Custom Stream";

    E.sideMeta.textContent =
      "User-supplied embed URL";

    E.saveActive.textContent =
      "☆";

    showWatchView();
    updateWatchBet();
    V2.mlbGameday?.reset?.();
    renderStreams();
    selectStream(0);
  }

  async function copyLink() {
    const url =
      watchUrl().href;

    try {
      if (
        navigator.clipboard
          ?.writeText
      ) {
        await navigator.clipboard
          .writeText(url);
      } else {
        throw new Error(
          "Clipboard unavailable"
        );
      }

      V2.toast(
        "Watch link copied."
      );
    } catch {
      window.prompt(
        "Copy this watch link:",
        url
      );
    }
  }

  function openExternal() {
    const stream =
      activeStream();

    if (!stream?.embedUrl) {
      V2.toast(
        "No active source to open."
      );
      return;
    }

    window.open(
      stream.embedUrl,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function addToMultiview() {
    const stream =
      activeStream();

    if (
      !S.active ||
      !stream?.embedUrl
    ) {
      V2.toast(
        "No active stream is available to add."
      );
      return;
    }

    V2.multiview?.addStream?.({
      match: S.active,
      stream,
      index:
        Number(
          S.activeStreamIndex ||
          0
        )
    });
  }

  function openPendingFromUrl(
    attempt = 0
  ) {
    if (
      deepLinkHandled
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const eventId =
      params.get("event");

    const watch =
      params.get("watch");

    if (!eventId && !watch) {
      deepLinkHandled = true;
      return;
    }

    if (watch) {
      deepLinkHandled = true;
      openCustom(watch);
      return;
    }

    const match =
      V2.events?.find?.(
        eventId
      );

    if (match) {
      deepLinkHandled = true;

      openMatch(
        match,
        {
          source:
            params.get(
              "source"
            ) || "",
          streamNo:
            params.get(
              "stream"
            ) || ""
        }
      );
      return;
    }

    // Events load asynchronously after player.js. Retry briefly so copied
    // event links can restore the watch view after a refresh.
    if (attempt < 60) {
      window.clearTimeout(
        deepLinkTimer
      );

      deepLinkTimer =
        window.setTimeout(
          () =>
            openPendingFromUrl(
              attempt + 1
            ),
          250
        );
    } else {
      deepLinkHandled = true;
      V2.toast(
        "That event is no longer available."
      );
      clearWatchParams();
    }
  }

  // If the user chooses another top-level V2 route or sport while watching,
  // treat it as leaving the player rather than leaving an invisible iframe
  // running behind the new view.
  document.addEventListener(
    "click",
    (event) => {
      if (
        !document.body.classList.contains(
          "ec-watching"
        )
      ) {
        return;
      }

      const route =
        event.target.closest(
          "[data-v2-route]"
        );

      const sport =
        event.target.closest(
          "[data-sport]"
        );

      if (
        route &&
        !route.closest(
          "#player"
        )
      ) {
        closePlayer({
          clearUrl: true
        });
        return;
      }

      if (sport) {
        closePlayer({
          clearUrl: true
        });
      }
    },
    true
  );

  copyWatchLink?.addEventListener(
    "click",
    copyLink
  );

  openStreamExternal?.addEventListener(
    "click",
    openExternal
  );

  watchMultiView?.addEventListener(
    "click",
    addToMultiview
  );

  watchBet?.addEventListener(
    "click",
    openBet
  );

  watchCollapse?.addEventListener(
    "click",
    toggleControls
  );

  // Start deep-link restoration after the remaining V2 scripts have had
  // a chance to initialize the event provider.
  window.setTimeout(
    () => openPendingFromUrl(),
    150
  );

  V2.player = {
    openModal,
    closeModal,
    openChat,
    closeChat,
    closePlayer,
    openMatch,
    renderStreams,
    selectStream,
    openCustom,
    copyLink,
    openExternal,
    addToMultiview,
    openBet,
    updateWatchBet,
    setControlsCollapsed,
    toggleControls,
    openPendingFromUrl
  };
})();