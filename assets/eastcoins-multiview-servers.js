(() => {
  "use strict";

  const API =
    window.EastcoinStreamedAPI;

  if (!API) {
    console.warn(
      "EastCoin MultiView server selector could not initialize."
    );
    return;
  }

  const STORAGE_KEY =
    "eastcoinMultiviewServersV47";

  const panels = [
    ...document.querySelectorAll(
      ".mv-panel[data-slot]"
    )
  ];

  const toast =
    document.getElementById(
      "mvToast"
    );

  let catalogPromise = null;
  let toastTimer = 0;

  function showToast(message) {
    if (!toast) return;

    toast.textContent =
      String(message || "");

    toast.classList.add(
      "show"
    );

    clearTimeout(
      toastTimer
    );

    toastTimer =
      setTimeout(
        () =>
          toast.classList.remove(
            "show"
          ),
        2300
      );
  }

  function readSaved() {
    try {
      const parsed =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "{}"
        );

      return (
        parsed &&
        typeof parsed ===
          "object"
      )
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  function saveServer(
    slot,
    eventId,
    stream,
    index
  ) {
    try {
      const saved =
        readSaved();

      saved[
        `${slot}:${eventId}`
      ] = {
        source:
          String(
            stream?.source ||
            stream?.provider ||
            ""
          ),
        stream:
          stream?.streamNo ??
          stream?.stream ??
          null,
        index,
        savedAt:
          Date.now()
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          saved
        )
      );
    } catch {}
  }

  function savedServer(
    slot,
    eventId
  ) {
    return (
      readSaved()[
        `${slot}:${eventId}`
      ] ||
      null
    );
  }

  function eventKey(match) {
    return String(
      match?.id ||
      match?.matchId ||
      match?.slug ||
      `${match?.category || "event"}:${match?.title || ""}:${match?.date || ""}`
    );
  }

  function rows(value) {
    if (Array.isArray(value)) {
      return value;
    }

    if (
      Array.isArray(
        value?.data
      )
    ) {
      return value.data;
    }

    return [];
  }

  function dedupe(matches) {
    const map =
      new Map();

    for (
      const match of matches
    ) {
      map.set(
        eventKey(match),
        match
      );
    }

    return [
      ...map.values()
    ];
  }

  async function catalog() {
    if (catalogPromise) {
      return catalogPromise;
    }

    catalogPromise =
      (async () => {
        const requests = [];

        if (
          typeof API.getAll ===
          "function"
        ) {
          requests.push(
            API.getAll(false)
          );
        }

        if (
          typeof API.getDiscovery ===
          "function"
        ) {
          requests.push(
            API.getDiscovery({
              forceMatches:
                false
            })
          );
        }

        const settled =
          await Promise.allSettled(
            requests
          );

        const matches = [];

        for (
          const result of settled
        ) {
          if (
            result.status !==
            "fulfilled"
          ) {
            continue;
          }

          const value =
            result.value;

          matches.push(
            ...rows(value)
          );

          matches.push(
            ...rows(value?.live),
            ...rows(value?.today),
            ...rows(value?.matches)
          );
        }

        return dedupe(
          matches
        );
      })()
        .catch(
          (error) => {
            catalogPromise =
              null;

            throw error;
          }
        );

    return catalogPromise;
  }

  function frameFor(panel) {
    return (
      panel.querySelector(
        ".mv-player-frame"
      ) ||
      panel.querySelector(
        "iframe"
      )
    );
  }

  function frameInfo(panel) {
    const frame =
      frameFor(panel);

    if (!frame) {
      return null;
    }

    let url;

    try {
      url =
        new URL(
          frame.getAttribute(
            "src"
          ) ||
          frame.src,
          window.location.href
        );
    } catch {
      return null;
    }

    const eventId =
      url.searchParams.get(
        "event"
      );

    if (!eventId) {
      return null;
    }

    return {
      frame,
      url,
      eventId
    };
  }

  async function resolveEvent(
    eventId
  ) {
    const matches =
      await catalog();

    return (
      matches.find(
        (match) =>
          eventKey(match) ===
          String(eventId)
      ) ||
      null
    );
  }

  async function streamsFor(
    eventId
  ) {
    const match =
      await resolveEvent(
        eventId
      );

    if (!match) {
      throw new Error(
        "Event is no longer available."
      );
    }

    const streams =
      await API.getStreams(
        match,
        false
      );

    return {
      match,
      streams:
        (
          Array.isArray(streams)
            ? streams
            : []
        ).filter(
          (stream) =>
            Boolean(
              stream?.embedUrl ||
              stream?.source ||
              stream?.provider
            )
        )
    };
  }

  function streamSource(stream) {
    return String(
      stream?.source ||
      stream?.provider ||
      ""
    );
  }

  function streamNumber(stream) {
    return (
      stream?.streamNo ??
      stream?.stream ??
      null
    );
  }

  function currentIndex(
    url,
    streams,
    saved
  ) {
    const source =
      url.searchParams.get(
        "source"
      ) ||
      String(
        saved?.source ||
        ""
      );

    const number =
      url.searchParams.get(
        "stream"
      ) ??
      saved?.stream ??
      null;

    const found =
      streams.findIndex(
        (stream) => {
          const sameSource =
            !source ||
            streamSource(
              stream
            ) === source;

          const candidate =
            streamNumber(
              stream
            );

          const sameNumber =
            number == null ||
            candidate == null ||
            String(candidate) ===
              String(number);

          return (
            sameSource &&
            sameNumber
          );
        }
      );

    return found >= 0
      ? found
      : 0;
  }

  function switchPanel(
    slot,
    panel,
    eventId,
    stream,
    index
  ) {
    const info =
      frameInfo(panel);

    if (!info) {
      return;
    }

    const source =
      streamSource(stream);

    const number =
      streamNumber(stream);

    if (source) {
      info.url
        .searchParams
        .set(
          "source",
          source
        );
    } else {
      info.url
        .searchParams
        .delete(
          "source"
        );
    }

    if (
      number !== null &&
      number !== undefined
    ) {
      info.url
        .searchParams
        .set(
          "stream",
          String(number)
        );
    } else {
      info.url
        .searchParams
        .delete(
          "stream"
        );
    }

    saveServer(
      slot,
      eventId,
      stream,
      index
    );

    info.frame.src =
      info.url.href;

    syncPanel(
      panel,
      slot
    );

    showToast(
      `Panel ${slot + 1} switched to Server ${index + 1}.`
    );
  }

  function ensureMenu(panel) {
    let menu =
      panel.querySelector(
        ".mv-server-menu"
      );

    if (menu) {
      return menu;
    }

    menu =
      document.createElement(
        "div"
      );

    menu.className =
      "mv-server-menu";

    menu.hidden = true;

    panel.appendChild(
      menu
    );

    return menu;
  }

  function closeMenus(
    except = null
  ) {
    for (
      const panel of panels
    ) {
      const menu =
        panel.querySelector(
          ".mv-server-menu"
        );

      if (
        menu &&
        menu !== except
      ) {
        menu.hidden =
          true;
      }
    }
  }

  async function openMenu(
    panel,
    slot
  ) {
    const info =
      frameInfo(panel);

    if (!info) {
      return;
    }

    const menu =
      ensureMenu(panel);

    const opening =
      menu.hidden;

    closeMenus();

    if (!opening) {
      menu.hidden = true;
      return;
    }

    menu.hidden = false;

    menu.innerHTML = `
      <div class="mv-server-menu-head">
        <strong>Servers</strong>
        <small>Loading…</small>
      </div>
    `;

    try {
      const {
        streams
      } =
        await streamsFor(
          info.eventId
        );

      if (!streams.length) {
        throw new Error(
          "No alternate servers are available."
        );
      }

      const saved =
        savedServer(
          slot,
          info.eventId
        );

      const selected =
        currentIndex(
          info.url,
          streams,
          saved
        );

      menu.innerHTML = `
        <div class="mv-server-menu-head">
          <strong>Choose server</strong>
          <small>${streams.length} available</small>
        </div>
        <div class="mv-server-options"></div>
      `;

      const options =
        menu.querySelector(
          ".mv-server-options"
        );

      streams.forEach(
        (
          stream,
          index
        ) => {
          const button =
            document.createElement(
              "button"
            );

          button.type =
            "button";

          button.className =
            "mv-server-option";

          button.classList.toggle(
            "active",
            index === selected
          );

          button.innerHTML = `
            <span>Server ${index + 1}</span>
            <small>${index === selected ? "Current" : "Switch"}</small>
          `;

          button.addEventListener(
            "click",
            () => {
              menu.hidden =
                true;

              switchPanel(
                slot,
                panel,
                info.eventId,
                stream,
                index
              );
            }
          );

          options.appendChild(
            button
          );
        }
      );
    } catch (error) {
      menu.innerHTML = `
        <div class="mv-server-menu-head">
          <strong>Servers unavailable</strong>
          <small>${String(error?.message || "Try again.")}</small>
        </div>
      `;
    }
  }

  function ensureButton(
    panel,
    slot
  ) {
    const actions =
      panel.querySelector(
        ".mv-panel-actions"
      );

    if (!actions) {
      return null;
    }

    let button =
      actions.querySelector(
        "[data-panel-server]"
      );

    if (!button) {
      button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.dataset.panelServer =
        "1";

      button.textContent =
        "Servers ▾";

      button.title =
        "Choose server for this panel";

      const replace =
        actions.querySelector(
          "[data-panel-replace]"
        );

      actions.insertBefore(
        button,
        replace ||
        null
      );

      button.addEventListener(
        "click",
        (event) => {
          event.stopPropagation();

          openMenu(
            panel,
            slot
          );
        }
      );
    }

    return button;
  }

  function syncPanel(
    panel,
    slot
  ) {
    const button =
      ensureButton(
        panel,
        slot
      );

    if (!button) {
      return;
    }

    const info =
      frameInfo(panel);

    button.hidden =
      !info;

    if (!info) {
      ensureMenu(
        panel
      ).hidden = true;

      button.textContent =
        "Servers ▾";

      return;
    }

    const saved =
      savedServer(
        slot,
        info.eventId
      );

    const requestedSource =
      info.url
        .searchParams
        .get(
          "source"
        );

    const requestedStream =
      info.url
        .searchParams
        .get(
          "stream"
        );

    const hasSaved =
      saved &&
      (
        saved.source ||
        saved.stream !== null
      );

    if (
      hasSaved &&
      !requestedSource &&
      requestedStream == null
    ) {
      if (saved.source) {
        info.url
          .searchParams
          .set(
            "source",
            saved.source
          );
      }

      if (
        saved.stream !==
          null &&
        saved.stream !==
          undefined
      ) {
        info.url
          .searchParams
          .set(
            "stream",
            String(
              saved.stream
            )
          );
      }

      info.frame.src =
        info.url.href;

      return;
    }

    button.textContent =
      Number.isInteger(
        Number(
          saved?.index
        )
      )
        ? `Server ${Number(saved.index) + 1} ▾`
        : "Servers ▾";
  }

  panels.forEach(
    (
      panel,
      slot
    ) => {
      ensureMenu(panel);
      syncPanel(
        panel,
        slot
      );

      const observer =
        new MutationObserver(
          () =>
            syncPanel(
              panel,
              slot
            )
        );

      observer.observe(
        panel,
        {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: [
            "src",
            "class"
          ]
        }
      );
    }
  );

  document.addEventListener(
    "click",
    (event) => {
      if (
        event.target.closest(
          ".mv-server-menu"
        ) ||
        event.target.closest(
          "[data-panel-server]"
        )
      ) {
        return;
      }

      closeMenus();
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeMenus();
      }
    }
  );
})();
