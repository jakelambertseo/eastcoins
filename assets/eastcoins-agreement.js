(() => {
  "use strict";

  const STORAGE_KEY =
    "eastcoinZwadesBlueAgreement";
  const COOKIE_NAME =
    "eastcoinZwadesBlueAgreement";
  const VERSION = "v1";
  const COOKIE_MAX_AGE = 34_560_000;
  const RESET_PARAMETER =
    "resetZwadesAgreement";

  const root = document.documentElement;

  function cookieValue(name) {
    const prefix = `${encodeURIComponent(name)}=`;
    const pair = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));

    return pair
      ? decodeURIComponent(pair.slice(prefix.length))
      : "";
  }

  function writeCookie(
    value,
    maxAge = COOKIE_MAX_AGE
  ) {
    const secure =
      window.location.protocol === "https:"
        ? "; Secure"
        : "";

    document.cookie =
      `${encodeURIComponent(COOKIE_NAME)}=` +
      `${encodeURIComponent(value)}; ` +
      `Max-Age=${maxAge}; Path=/; SameSite=Lax` +
      secure;
  }

  function clearAgreement() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}

    writeCookie("", 0);
  }

  function saveAgreement() {
    try {
      localStorage.setItem(STORAGE_KEY, VERSION);
    } catch {}

    writeCookie(VERSION);
  }

  function hasAgreement() {
    let localValue = "";

    try {
      localValue = localStorage.getItem(
        STORAGE_KEY
      );
    } catch {}

    return (
      localValue === VERSION ||
      cookieValue(COOKIE_NAME) === VERSION
    );
  }

  function removeResetParameter() {
    const url = new URL(window.location.href);

    if (!url.searchParams.has(RESET_PARAMETER)) {
      return;
    }

    url.searchParams.delete(RESET_PARAMETER);

    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  function createGate() {
    const gate = document.createElement("section");

    gate.className = "ec-zwades-agreement-gate";
    gate.id = "ecZwadesAgreementGate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute(
      "aria-labelledby",
      "ecZwadesAgreementTitle"
    );
    gate.setAttribute(
      "aria-describedby",
      "ecZwadesAgreementDescription"
    );
    gate.setAttribute("aria-hidden", "false");

    gate.innerHTML = `
      <div class="ec-zwades-agreement-card">
        <div class="ec-zwades-agreement-topline"></div>

        <div class="ec-zwades-agreement-content">
          <div class="ec-zwades-agreement-brand">
            <img
              src="assets/eastcoins-logo.webp"
              alt=""
              width="42"
              height="42">
            <strong>EastCoin</strong>
          </div>

          <div class="ec-zwades-agreement-portrait">
            <img
              src="assets/targets/zwades.png"
              alt=""
              width="94"
              height="94">
          </div>

          <div class="ec-zwades-agreement-kicker">
            Entry requirement
          </div>

          <h1
            class="ec-zwades-agreement-title"
            id="ecZwadesAgreementTitle">
            Confirm the truth before entering
          </h1>

          <p
            class="ec-zwades-agreement-copy"
            id="ecZwadesAgreementDescription">
            Access to EastCoin requires acknowledgment
            of one indisputable fact.
          </p>

          <div class="ec-zwades-agreement-statement">
            <span
              class="ec-zwades-agreement-blue-dot"
              aria-hidden="true">
            </span>
            <span>Zwades is Blue</span>
          </div>

          <button
            class="ec-zwades-agreement-button"
            id="ecZwadesAgreementButton"
            type="button">
            I Agree
          </button>

          <p class="ec-zwades-agreement-memory">
            <strong>One-time confirmation.</strong>
            Your agreement is remembered on this browser.
          </p>
        </div>
      </div>
    `;

    document.body.insertBefore(
      gate,
      document.body.firstChild
    );

    return gate;
  }

  const gate = createGate();
  const agreeButton = gate.querySelector(
    "#ecZwadesAgreementButton"
  );

  function setBackgroundInert(inert) {
    Array.from(document.body.children).forEach(
      (element) => {
        if (
          element === gate ||
          element.tagName === "SCRIPT"
        ) {
          return;
        }

        element.inert = inert;

        if (inert) {
          element.setAttribute(
            "aria-hidden",
            "true"
          );
        } else {
          element.removeAttribute("aria-hidden");
        }
      }
    );
  }

  function lockSite() {
    root.classList.remove(
      "ec-zwades-agreement-granted"
    );
    root.classList.add(
      "ec-zwades-agreement-required"
    );

    gate.hidden = false;
    gate.setAttribute("aria-hidden", "false");
    setBackgroundInert(true);

    window.requestAnimationFrame(() => {
      agreeButton.focus({ preventScroll: true });
    });
  }

  function unlockSite(animate = false) {
    const finish = () => {
      root.classList.remove(
        "ec-zwades-agreement-required"
      );
      root.classList.add(
        "ec-zwades-agreement-granted"
      );

      gate.hidden = true;
      gate.classList.remove("is-leaving");
      gate.setAttribute("aria-hidden", "true");
      setBackgroundInert(false);
    };

    if (!animate) {
      finish();
      return;
    }

    gate.classList.add("is-leaving");
    window.setTimeout(finish, 280);
  }

  const parameters = new URLSearchParams(
    window.location.search
  );
  const forceReset =
    parameters.get(RESET_PARAMETER) === "1";

  if (forceReset) {
    clearAgreement();
    removeResetParameter();
  }

  if (hasAgreement()) {
    saveAgreement();
    unlockSite(false);
  } else {
    lockSite();
  }

  agreeButton.addEventListener("click", () => {
    saveAgreement();
    unlockSite(true);
  });

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        !root.classList.contains(
          "ec-zwades-agreement-required"
        )
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        agreeButton.focus({ preventScroll: true });
        return;
      }

      if (event.key === "Tab") {
        event.preventDefault();
        agreeButton.focus({ preventScroll: true });
      }
    },
    true
  );

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    if (event.newValue === VERSION) {
      saveAgreement();
      unlockSite(false);
    } else {
      lockSite();
    }
  });
})();
