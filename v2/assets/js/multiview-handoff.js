(() => {
  "use strict";

  const V2 = window.ECV2;

  const STORAGE_KEY =
    "eastcoinMultiviewV1";

  const prompt =
    document.querySelector(
      "#multiviewPrompt"
    );

  const promptTitle =
    document.querySelector(
      "#multiviewPromptTitle"
    );

  const promptMeta =
    document.querySelector(
      "#multiviewPromptMeta"
    );

  const promptStay =
    document.querySelector(
      "#multiviewPromptStay"
    );

  const promptOpen =
    document.querySelector(
      "#multiviewPromptOpen"
    );

  function defaults() {
    return {
      layout: 4,
      slots: [
        null,
        null,
        null,
        null
      ],
      splits: {
        2: {
          col: 50,
          row: 50
        },
        3: {
          col: 50,
          row: 50
        },
        4: {
          col: 50,
          row: 50
        }
      }
    };
  }

  function readState() {
    const raw =
      V2.read(
        STORAGE_KEY,
        null
      );

    if (
      !raw ||
      !Array.isArray(raw.slots)
    ) {
      return defaults();
    }

    return {
      layout:
        [2, 3, 4].includes(
          Number(raw.layout)
        )
          ? Number(raw.layout)
          : 4,
      slots: [
        ...raw.slots.slice(0, 4),
        null,
        null,
        null,
        null
      ].slice(0, 4),
      splits:
        raw.splits &&
        typeof raw.splits ===
          "object"
          ? raw.splits
          : defaults().splits
    };
  }

  function expandForSlot(
    state,
    slot
  ) {
    if (slot >= 3) {
      state.layout = 4;
    } else if (
      slot === 2 &&
      Number(state.layout) < 3
    ) {
      state.layout = 3;
    } else if (
      slot === 1 &&
      Number(state.layout) < 2
    ) {
      state.layout = 2;
    }
  }

  function sameUrl(
    left,
    right
  ) {
    try {
      return (
        new URL(left).href ===
        new URL(right).href
      );
    } catch {
      return (
        String(left || "") ===
        String(right || "")
      );
    }
  }

  function duplicateIndex(
    state,
    source
  ) {
    return state.slots.findIndex(
      (slot) => {
        if (!slot) return false;

        if (
          source.type === "event" &&
          slot.type === "event"
        ) {
          return (
            String(slot.id) ===
            String(source.id)
          );
        }

        if (
          source.type === "url" &&
          slot.type === "url"
        ) {
          return sameUrl(
            slot.url,
            source.url
          );
        }

        return false;
      }
    );
  }

  function eventSlotIndex(
    state,
    eventId
  ) {
    if (!eventId) return -1;

    return state.slots.findIndex(
      (slot) => {
        if (!slot) return false;

        if (
          slot.type === "event"
        ) {
          return (
            String(slot.id) ===
            String(eventId)
          );
        }

        return (
          slot.type === "url" &&
          String(
            slot.eventId || ""
          ) === String(eventId)
        );
      }
    );
  }

  function closePrompt() {
    prompt?.classList.remove(
      "open"
    );

    prompt?.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function openPrompt(
    source,
    slot,
    {
      upgraded = false
    } = {}
  ) {
    if (!prompt) {
      V2.toast(
        `Added to MultiView slot ${
          slot + 1
        }.`
      );
      return;
    }

    promptTitle.textContent =
      source.title ||
      "Stream added";

    promptMeta.textContent =
      upgraded
        ? `MultiView slot ${
            slot + 1
          } now uses the exact server you're watching. Ready to open MultiView?`
        : `Added to MultiView slot ${
            slot + 1
          }. Ready to open MultiView?`;

    prompt.classList.add(
      "open"
    );

    prompt.setAttribute(
      "aria-hidden",
      "false"
    );

    window.setTimeout(
      () =>
        promptOpen?.focus({
          preventScroll: true
        }),
      0
    );
  }

  function saveSource(
    source
  ) {
    const state =
      readState();

    const duplicate =
      duplicateIndex(
        state,
        source
      );

    if (duplicate !== -1) {
      V2.toast(
        `Already in MultiView slot ${
          duplicate + 1
        }.`
      );

      openPrompt(
        state.slots[duplicate],
        duplicate
      );

      return {
        ok: true,
        slot: duplicate,
        duplicate: true
      };
    }

    if (
      source.type === "url" &&
      source.eventId
    ) {
      const eventSlot =
        eventSlotIndex(
          state,
          source.eventId
        );

      if (eventSlot !== -1) {
        state.slots[eventSlot] =
          source;

        V2.write(
          STORAGE_KEY,
          state
        );

        openPrompt(
          source,
          eventSlot,
          {
            upgraded: true
          }
        );

        return {
          ok: true,
          slot: eventSlot,
          upgraded: true
        };
      }
    }

    const slot =
      state.slots.findIndex(
        (item) => !item
      );

    if (slot === -1) {
      V2.toast(
        "MultiView is full. Open MultiView to manage your four slots."
      );

      return {
        ok: false,
        reason: "full"
      };
    }

    state.slots[slot] =
      source;

    expandForSlot(
      state,
      slot
    );

    V2.write(
      STORAGE_KEY,
      state
    );

    openPrompt(
      source,
      slot
    );

    return {
      ok: true,
      slot
    };
  }

  function addEvent(match) {
    if (!match) {
      return {
        ok: false
      };
    }

    const [, label] =
      V2.sportMeta(
        V2.family(match)
      );

    return saveSource({
      type: "event",
      id: V2.id(match),
      title:
        String(
          match.title ||
          "EastCoin event"
        ),
      meta: label
    });
  }

  function addStream({
    match,
    stream,
    index = 0
  } = {}) {
    if (!stream?.embedUrl) {
      V2.toast(
        "No active stream is available to add."
      );

      return {
        ok: false
      };
    }

    const eventId =
      match &&
      !String(
        match.id || ""
      ).startsWith("custom:")
        ? V2.id(match)
        : "";

    return saveSource({
      type: "url",
      url:
        String(
          stream.embedUrl
        ),
      eventId,
      title:
        String(
          match?.title ||
          "EastCoin stream"
        ),
      meta:
        `Server ${
          Number(index) + 1
        }`
    });
  }

  function openMultiView() {
    closePrompt();

    if (
      document.body.classList.contains(
        "ec-watching"
      )
    ) {
      V2.player?.closePlayer?.({
        clearUrl: true
      });
    }

    V2.router?.go?.(
      "multiview"
    );
  }

  promptStay?.addEventListener(
    "click",
    closePrompt
  );

  promptOpen?.addEventListener(
    "click",
    openMultiView
  );

  prompt?.addEventListener(
    "click",
    (event) => {
      if (
        event.target === prompt
      ) {
        closePrompt();
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        prompt?.classList.contains(
          "open"
        )
      ) {
        closePrompt();
      }
    }
  );

  V2.multiview = {
    addEvent,
    addStream,
    openMultiView,
    closePrompt,
    readState
  };
})();
