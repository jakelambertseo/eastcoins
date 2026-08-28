(() => {
  "use strict";

  /*
    Iteration 48:
    MultiView and each player.html tile are same-origin. The child player
    already owns the real event, the loaded stream list, fallback logic and
    selectStream() behavior. Do not fetch the event catalog a second time here.

    Instead, read the existing hidden server buttons inside player.html and
    activate the selected button directly. This keeps one source of truth and
    makes the parent Servers menu instant once the child player is ready.
  */

  const panels = [
    ...document.querySelectorAll(
      ".mv-panel[data-slot]"
    )
  ];

  const toast =
    document.getElementById(
      "mvToast"
    );

  const STORAGE_KEY =
    "eastcoinMultiviewServerSelectionsV48";

  const READY_POLL_MS = 200;
  const READY_POLL_LIMIT = 100;

  let toastTimer = 0;

  function showToast(message) {
    if (!toast) return;

    toast.textContent =
      String(message || "");

    toast.classList.add(
      "show"
    );

    window.clearTimeout(
      toastTimer
    );

    toastTimer =
      window.setTimeout(
        () =>
          toast.classList.remove(
            "show"
          ),
        2300
      );
  }

  function panelFrame(panel) {
    return panel.querySelector(
      ".mv-player-frame"
    );
  }

  function frameInfo(panel) {
    const frame =
      panelFrame(panel);

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

  function childDocument(frame) {
    try {
      return (
        frame.contentDocument ||
        frame.contentWindow
          ?.document ||
        null
      );
    } catch {
      return null;
    }
  }

  function childServerButtons(frame) {
    const doc =
      childDocument(frame);

    if (!doc) {
      return [];
    }

    return [
      ...doc.querySelectorAll(
        ".streamed-stream-button[data-stream-key]"
      )
    ].filter(
      (button) =>
        !button.disabled
    );
  }

  function activeServerIndex(
    buttons
  ) {
    const index =
      buttons.findIndex(
        (button) =>
          button.classList.contains(
            "active"
          )
      );

    return index >= 0
      ? index
      : 0;
  }

  function readSelections() {
    try {
      const value =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) ||
          "{}"
        );

      return (
        value &&
        typeof value ===
          "object"
      )
        ? value
        : {};
    } catch {
      return {};
    }
  }

  function selectionKey(
    slot,
    eventId
  ) {
    return `${slot}:${eventId}`;
  }

  function savedIndex(
    slot,
    eventId
  ) {
    const saved =
      readSelections()[
        selectionKey(
          slot,
          eventId
        )
      ];

    const index =
      Number(
        saved?.index
      );

    return Number.isInteger(
      index
    )
      ? index
      : null;
  }

  function saveIndex(
    slot,
    eventId,
    index
  ) {
    try {
      const values =
        readSelections();

      values[
        selectionKey(
          slot,
          eventId
        )
      ] = {
        index,
        savedAt:
          Date.now()
      };

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          values
        )
      );
    } catch {}
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
    panels.forEach(
      (panel) => {
        const menu =
          panel.querySelector(
            ".mv-server-menu"
          );

        if (
          menu &&
          menu !== except
        ) {
          menu.hidden = true;
        }
      }
    );
  }

  function setButtonLabel(
    button,
    index
  ) {
    button.textContent =
      Number.isInteger(index)
        ? `Server ${index + 1} ▾`
        : "Servers ▾";
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

    if (button) {
      return button;
    }

    button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.dataset.panelServer =
      "1";

    button.title =
      "Choose server for this panel";

    setButtonLabel(
      button,
      null
    );

    /*
      Hide until player.html has actually populated its server list.
      This prevents a clickable-looking control that is not ready yet.
    */
    button.hidden = true;

    const replace =
      actions.querySelector(
        "[data-panel-replace]"
      );

    actions.insertBefore(
      button,
      replace || null
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

    return button;
  }

  function syncReadyState(
    panel,
    slot,
    restore = false
  ) {
    const button =
      ensureButton(
        panel,
        slot
      );

    if (!button) {
      return false;
    }

    const info =
      frameInfo(panel);

    if (!info) {
      button.hidden = true;

      ensureMenu(
        panel
      ).hidden = true;

      return false;
    }

    const buttons =
      childServerButtons(
        info.frame
      );

    if (!buttons.length) {
      button.hidden = true;
      return false;
    }

    button.hidden = false;

    let current =
      activeServerIndex(
        buttons
      );

    const remembered =
      savedIndex(
        slot,
        info.eventId
      );

    /*
      Restore a previously selected server only after the child player has
      completed its own normal event/server initialization.
    */
    if (
      restore &&
      remembered !== null &&
      remembered >= 0 &&
      remembered <
        buttons.length &&
      remembered !== current
    ) {
      buttons[
        remembered
      ].click();

      current =
        remembered;
    }

    setButtonLabel(
      button,
      current
    );

    return true;
  }

  function armReadyPoll(
    panel,
    slot,
    restore = false
  ) {
    const previous =
      Number(
        panel.dataset
          .serverReadyTimer ||
        0
      );

    if (previous) {
      window.clearInterval(
        previous
      );
    }

    let attempts = 0;

    const run = () => {
      attempts += 1;

      const ready =
        syncReadyState(
          panel,
          slot,
          restore
        );

      if (
        ready ||
        attempts >=
          READY_POLL_LIMIT
      ) {
        const timer =
          Number(
            panel.dataset
              .serverReadyTimer ||
            0
          );

        if (timer) {
          window.clearInterval(
            timer
          );
        }

        delete panel.dataset
          .serverReadyTimer;
      }
    };

    run();

    if (
      syncReadyState(
        panel,
        slot,
        false
      )
    ) {
      return;
    }

    const timer =
      window.setInterval(
        run,
        READY_POLL_MS
      );

    panel.dataset
      .serverReadyTimer =
      String(timer);
  }

  function renderMenu(
    menu,
    panel,
    slot,
    info,
    buttons
  ) {
    const current =
      activeServerIndex(
        buttons
      );

    menu.innerHTML = `
      <div class="mv-server-menu-head">
        <strong>Choose server</strong>
        <small>${buttons.length} available</small>
      </div>
      <div class="mv-server-options"></div>
    `;

    const options =
      menu.querySelector(
        ".mv-server-options"
      );

    buttons.forEach(
      (
        childButton,
        index
      ) => {
        const option =
          document.createElement(
            "button"
          );

        option.type =
          "button";

        option.className =
          "mv-server-option";

        option.classList.toggle(
          "active",
          index === current
        );

        option.innerHTML = `
          <span>Server ${index + 1}</span>
          <small>${index === current ? "Current" : "Switch"}</small>
        `;

        option.addEventListener(
          "click",
          () => {
            /*
              This is the important part: trigger the existing player.html
              server button. The child player's own selectStream(), fallback,
              active-frame replacement, persistence, and status logic all run
              normally. No parent API request and no player-page reload.
            */
            childButton.click();

            saveIndex(
              slot,
              info.eventId,
              index
            );

            const parentButton =
              panel.querySelector(
                "[data-panel-server]"
              );

            if (parentButton) {
              setButtonLabel(
                parentButton,
                index
              );
            }

            menu.hidden = true;

            showToast(
              `Panel ${slot + 1} switched to Server ${index + 1}.`
            );

            /*
              Let the child's DOM update its active class and then re-sync the
              label from the actual player state.
            */
            window.setTimeout(
              () =>
                syncReadyState(
                  panel,
                  slot,
                  false
                ),
              80
            );
          }
        );

        options.appendChild(
          option
        );
      }
    );
  }

  function openMenu(
    panel,
    slot
  ) {
    const info =
      frameInfo(panel);

    if (!info) {
      return;
    }

    const menu =
      ensureMenu(
        panel
      );

    const opening =
      menu.hidden;

    closeMenus();

    if (!opening) {
      menu.hidden = true;
      return;
    }

    const buttons =
      childServerButtons(
        info.frame
      );

    if (!buttons.length) {
      /*
        In normal use the button is hidden until ready, but keep a defensive
        state for a click that races an event/player refresh.
      */
      menu.hidden = false;

      menu.innerHTML = `
        <div class="mv-server-menu-head">
          <strong>Servers</strong>
          <small>Player is still loading…</small>
        </div>
      `;

      armReadyPoll(
        panel,
        slot,
        false
      );

      window.setTimeout(
        () => {
          if (
            !menu.hidden
          ) {
            const readyButtons =
              childServerButtons(
                info.frame
              );

            if (
              readyButtons.length
            ) {
              renderMenu(
                menu,
                panel,
                slot,
                info,
                readyButtons
              );
            }
          }
        },
        400
      );

      return;
    }

    menu.hidden = false;

    renderMenu(
      menu,
      panel,
      slot,
      info,
      buttons
    );
  }

  function bindPanel(
    panel,
    slot
  ) {
    ensureMenu(panel);
    ensureButton(
      panel,
      slot
    );

    let currentFrame = null;

    const bindFrame = () => {
      const frame =
        panelFrame(panel);

      if (
        frame ===
        currentFrame
      ) {
        syncReadyState(
          panel,
          slot,
          false
        );

        return;
      }

      currentFrame =
        frame;

      if (!frame) {
        syncReadyState(
          panel,
          slot,
          false
        );

        return;
      }

      frame.addEventListener(
        "load",
        () => {
          armReadyPoll(
            panel,
            slot,
            true
          );
        }
      );

      /*
        The outer player.html document may already be loaded before this
        extension notices the iframe.
      */
      armReadyPoll(
        panel,
        slot,
        true
      );
    };

    bindFrame();

    /*
      Watch only for the MultiView controller replacing the player iframe.
      Do not observe the full child/player DOM; that was another source of
      unnecessary work in the previous implementation.
    */
    const body =
      panel.querySelector(
        "[data-panel-body]"
      );

    if (body) {
      const observer =
        new MutationObserver(
          bindFrame
        );

      observer.observe(
        body,
        {
          childList: true
        }
      );
    }
  }

  panels.forEach(
    bindPanel
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
