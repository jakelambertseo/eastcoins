(() => {
  "use strict";

  const V2 = window.ECV2;
  const S = V2.state;
  const E = V2.els;
  const $ = V2.$;
  const $$ = V2.$$;

  function clearFilters() {
    S.sport = "all";
    S.date = "today";
    S.status = "all";
    S.search = "";
    E.search.value = "";

    if (V2.router?.current() !== "events") {
      V2.router.go("events");
    }

    $$("[data-sport]").forEach((button) => {
      button.classList.toggle("active", button.dataset.sport === "all");
    });
    E.sportMoreBtn.classList.remove("active");
    E.sportMoreMenu.hidden = true;
    E.sportMoreBtn.setAttribute("aria-expanded", "false");

    $$("[data-status]").forEach((button) => {
      button.classList.toggle("active", button.dataset.status === "all");
    });

    V2.events.renderDates();
    V2.events.renderGrid();
  }

  function positionSportMoreMenu() {
    const rect = E.sportMoreBtn.getBoundingClientRect();
    const menuWidth = 170;
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    E.sportMoreMenu.style.left = `${left}px`;
    E.sportMoreMenu.style.top = `${rect.bottom + 5}px`;
  }

  function wire() {
    $$("[data-sport]").forEach((button) => {
      button.onclick = () => {
        S.sport = button.dataset.sport;

        if (V2.router?.current() !== "events") {
          V2.router.go("events");
        }

        $$("[data-sport]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        E.sportMoreBtn.classList.toggle(
          "active",
          ["hockey", "tennis", "other"].includes(S.sport)
        );
        E.sportMoreMenu.hidden = true;
        E.sportMoreBtn.setAttribute("aria-expanded", "false");

        V2.events.renderGrid();
      };
    });

    $$("[data-status]").forEach((button) => {
      button.onclick = () => {
        S.status = button.dataset.status;

        $$("[data-status]").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        V2.events.renderGrid();
      };
    });

    E.search.oninput = () => {
      S.search = E.search.value.trim().toLowerCase();

      if (S.search) {
        if (V2.router?.current() !== "events") {
          V2.router.go("events");
        }
        S.date = "week";
        V2.events.renderDates();
      }

      V2.events.renderGrid();
    };

    E.search.onkeydown = (event) => {
      if (event.key !== "Enter") return;

      const raw = E.search.value.trim();
      if (!raw) return;

      try {
        const url = new URL(raw);
        if (["http:", "https:"].includes(url.protocol)) {
          event.preventDefault();
          E.search.value = "";
          S.search = "";
          V2.player.openCustom(url.href);
        }
      } catch {
        // Normal text search continues unchanged.
      }
    };

    E.refresh.onclick = () => V2.events.load(true);

    E.featureOpen.onclick = () => {
      const match = V2.events.find(S.featured);
      if (match) V2.player.openMatch(match);
    };

    $("#scheduleJump").onclick = () => {
      $("#schedule").scrollIntoView({ behavior: "smooth" });
    };

    $("#clear").onclick = clearFilters;

    E.sort.onclick = () => {
      S.sort = S.sort === "recommended" ? "time" : "recommended";
      E.sort.textContent =
        S.sort === "recommended"
          ? "Sort: Recommended ▾"
          : "Sort: Time ▾";
      V2.events.renderGrid();
    };

    E.sportMoreBtn.onclick = (event) => {
      event.stopPropagation();
      const opening = E.sportMoreMenu.hidden;
      if (opening) positionSportMoreMenu();
      E.sportMoreMenu.hidden = !opening;
      E.sportMoreBtn.setAttribute("aria-expanded", String(opening));
    };

    window.addEventListener("resize", () => {
      if (!E.sportMoreMenu.hidden) positionSportMoreMenu();
    });

    document.addEventListener("click", (event) => {
      if (
        !E.sportMoreMenu.hidden &&
        !E.sportMoreMenu.contains(event.target) &&
        event.target !== E.sportMoreBtn
      ) {
        E.sportMoreMenu.hidden = true;
        E.sportMoreBtn.setAttribute("aria-expanded", "false");
      }
    });

    $("#chatBtn").onclick = V2.player.openChat;
    $("#quickChat").onclick = V2.player.openChat;
    $("#playerChat").onclick = V2.player.openChat;
    $("#closePlayer").onclick = V2.player.closePlayer;

    E.player.onclick = (event) => {
      if (event.target === E.player) V2.player.closePlayer();
    };

    E.saveActive.onclick = () => {
      if (S.active) V2.events.toggleFavorite(V2.id(S.active));
    };

    $("#customBtn").onclick = () => {
      E.customUrl.value = "";
      V2.player.openModal(E.custom);
      setTimeout(() => E.customUrl.focus(), 50);
    };

    const closeCustom = () => V2.player.closeModal(E.custom);

    $("#closeCustom").onclick = closeCustom;
    $("#cancelCustom").onclick = closeCustom;

    E.custom.onclick = (event) => {
      if (event.target === E.custom) closeCustom();
    };

    $("#customForm").onsubmit = (event) => {
      event.preventDefault();

      let url;

      try {
        url = new URL(E.customUrl.value);
      } catch {
        V2.toast("Enter a valid URL.");
        return;
      }

      if (!["http:", "https:"].includes(url.protocol)) {
        V2.toast("Only http and https URLs are supported.");
        return;
      }

      closeCustom();
      V2.player.openCustom(url.href);
    };

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        E.search.focus();
      }

      if (event.key === "Escape") {
        V2.player.closePlayer();
        V2.player.closeModal(E.custom);
        E.sportMoreMenu.hidden = true;
        E.sportMoreBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  function init() {
    $("#dateLabel").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });

    V2.events.renderDates();
    V2.events.renderRecent();
    V2.router.init();
    wire();

    // Locked V2 behavior: chat is mounted once with the outer shell and remains open.
    V2.player.openChat();

    Promise.all([
      V2.events.load(false),
      V2.integrations.identity(),
      V2.integrations.sicko()
    ]);
  }

  V2.app = {
    clearFilters,
    wire,
    init
  };

  init();
})();
