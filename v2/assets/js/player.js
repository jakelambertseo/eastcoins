(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;
  const E = V2.els;
  const $$ = V2.$$;

  function openModal(node) {
    node.classList.add("open");
  }

  function closeModal(node) {
    node.classList.remove("open");
  }

  function openChat() {
    E.chat.classList.add("open");
    E.scrim.hidden = false;
  }

  function closeChat() {
    E.chat.classList.remove("open");
    E.scrim.hidden = true;
  }

  function closePlayer() {
    E.frame.src = "about:blank";
    closeModal(E.player);
    S.active = null;
    S.streams = [];
  }

  async function openMatch(match) {
    S.active = match;
    S.streams = [];
    S.activeStreamIndex = 0;

    E.playerTitle.textContent = match.title || "Event";
    E.playerMeta.textContent = V2.datetime(match);
    E.playerKicker.textContent = V2.live(match)
      ? "● LIVE · EASTCOIN PLAYER"
      : "EASTCOIN PLAYER";
    E.sideTitle.textContent = match.title || "Event";
    E.sideMeta.textContent = `${V2.datetime(match)} · ${V2.provider(match)}`;
    E.saveActive.textContent = S.favorites.has(V2.id(match)) ? "★" : "☆";

    E.frame.src = "about:blank";
    E.playerLoading.hidden = false;
    E.loaderTitle.textContent = "Finding playable streams…";
    E.loaderMeta.textContent = "Checking EastCoin sources.";
    E.streams.innerHTML = "";

    openModal(E.player);

    if (V2.events?.addRecent) {
      V2.events.addRecent(match);
    }

    try {
      const streams = await V2.API().getStreams(match, false);

      S.streams = (Array.isArray(streams) ? streams : [])
        .filter((stream) => Boolean(stream?.embedUrl));

      if (!S.streams.length) {
        throw new Error("No playable streams returned.");
      }

      renderStreams();
      selectStream(0);
    } catch (error) {
      E.loaderTitle.textContent = "No playable stream available";
      E.loaderMeta.textContent =
        error?.message || "EastCoin could not load this event.";
    }
  }

  function renderStreams() {
    E.streams.innerHTML = S.streams.map((stream, index) => `
      <button
        class="stream ${index === S.activeStreamIndex ? "active" : ""}"
        data-stream="${index}"
      >
        <span>
          ${V2.esc(stream.source || stream.provider || `Stream ${index + 1}`)}
          ${stream.streamNo ? `#${V2.esc(stream.streamNo)}` : ""}
        </span>
        <small>${V2.esc(stream.language || "")}</small>
      </button>
    `).join("");

    $$("[data-stream]", E.streams).forEach((button) => {
      button.onclick = () => selectStream(Number(button.dataset.stream));
    });
  }

  function selectStream(index) {
    const stream = S.streams[index];
    if (!stream) return;

    S.activeStreamIndex = index;

    $$("[data-stream]", E.streams).forEach((button, buttonIndex) => {
      button.classList.toggle("active", buttonIndex === index);
    });

    E.playerLoading.hidden = false;
    E.loaderTitle.textContent = "Opening stream…";
    E.loaderMeta.textContent = stream.source || "EastCoin";

    E.frame.onload = () => {
      E.playerLoading.hidden = true;
    };

    E.frame.src = stream.embedUrl;

    setTimeout(() => {
      E.playerLoading.hidden = true;
    }, 3500);
  }

  function openCustom(url) {
    S.active = {
      id: `custom:${Date.now()}`,
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

    E.playerTitle.textContent = "Custom Stream";
    E.playerMeta.textContent = url;
    E.playerKicker.textContent = "CUSTOM STREAM";
    E.sideTitle.textContent = "Custom Stream";
    E.sideMeta.textContent = "User-supplied embed URL";

    openModal(E.player);
    renderStreams();
    selectStream(0);
  }

  V2.player = {
    openModal,
    closeModal,
    openChat,
    closeChat,
    closePlayer,
    openMatch,
    renderStreams,
    selectStream,
    openCustom
  };
})();
