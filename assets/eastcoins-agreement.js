(() => {
  "use strict";

  const STORAGE_KEY =
    "eastcoinZwadesBlueAgreementTest";
  const COOKIE_NAME =
    "eastcoinZwadesBlueAgreementTest";
  const VERSION = "v1";
  const COOKIE_MAX_AGE = 34_560_000;

  const root = document.documentElement;
  const gate = document.getElementById(
    "ecZwadesAgreementGate"
  );
  const agreeButton = document.getElementById(
    "ecZwadesAgreementButton"
  );
  const resetButton = document.getElementById(
    "ecZwadesAgreementReset"
  );

  if (!gate || !agreeButton || !resetButton) {
    return;
  }

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

  function writeCookie(value, maxAge = COOKIE_MAX_AGE) {
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
      localValue = localStorage.getItem(STORAGE_KEY);
    } catch {}

    return (
      localValue === VERSION ||
      cookieValue(COOKIE_NAME) === VERSION
    );
  }

  function setBackgroundInert(inert) {
    Array.from(document.body.children).forEach(
      (element) => {
        if (
          element === gate ||
          element === resetButton ||
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

  function removeResetParameter() {
    const url = new URL(window.location.href);

    if (!url.searchParams.has("resetAgreement")) {
      return;
    }

    url.searchParams.delete("resetAgreement");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  const parameters = new URLSearchParams(
    window.location.search
  );
  const forceReset =
    parameters.get("resetAgreement") === "1";

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

  resetButton.addEventListener("click", () => {
    clearAgreement();
    window.location.reload();
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
