(() => {
  "use strict";

  const STORAGE_KEY = "eastcoinZwadesBlueAgreement";
  const COOKIE_NAME = "eastcoinZwadesBlueAgreement";
  const root = document.documentElement;

  function removeLegacyGate() {
    root.classList.remove("ec-zwades-agreement-required");
    root.classList.add("ec-zwades-agreement-granted");

    document
      .querySelectorAll(".ec-zwades-agreement-gate")
      .forEach((gate) => gate.remove());

    if (!document.body) return;

    Array.from(document.body.children).forEach((element) => {
      element.inert = false;
      element.removeAttribute("aria-hidden");
    });
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}

  document.cookie =
    `${encodeURIComponent(COOKIE_NAME)}=; ` +
    "Max-Age=0; Path=/; SameSite=Lax";

  removeLegacyGate();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", removeLegacyGate, {
      once: true
    });
  }

  /*
    A short observer also removes a gate if an older cached script tries to
    insert one after this cleanup file has already run.
  */
  const observer = new MutationObserver(removeLegacyGate);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  window.setTimeout(() => observer.disconnect(), 5000);
})();
