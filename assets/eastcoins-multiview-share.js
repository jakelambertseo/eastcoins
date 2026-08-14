(() => {
  "use strict";

  const STORAGE_KEY = "eastcoinMultiviewV1";
  const SHARE_PARAM = "m";
  const LEGACY_SHARE_PARAM = "mv";
  const COMPACT_VERSION = 2;
  const LEGACY_SHARE_VERSION = 1;
  const VALID_LAYOUTS = new Set([2, 3, 4]);
  const DEFAULT_SPLITS = {
    2: { col: 50, row: 50 },
    3: { col: 65, row: 50 },
    4: { col: 50, row: 50 }
  };

  let sharedLayoutLoaded = false;
  let transientSharedState = null;
  let previousSavedState = null;
  let previousSavedStateExists = false;
  let sharedStateIsTransient = false;

  function clampSplit(value, fallback, minimum = 25) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(75, Math.max(minimum, numeric));
  }

  function defaultSplits() {
    return {
      2: { ...DEFAULT_SPLITS[2] },
      3: { ...DEFAULT_SPLITS[3] },
      4: { ...DEFAULT_SPLITS[4] }
    };
  }

  function encodeBase64Url(value) {
    const bytes = new TextEncoder().encode(String(value ?? ""));
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary)
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/g, "");
  }

  function decodeBase64Url(value) {
    const normalized = String(value || "")
      .replaceAll("-", "+")
      .replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function cleanText(value, fallback = "", maxLength = 300) {
    const clean = String(value ?? fallback).trim();
    return (clean || fallback).slice(0, maxLength);
  }

  function normalizeSharedUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";

    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      return "";
    }

    if (!["http:", "https:"].includes(parsed.protocol)) return "";

    const localDevelopment = ["localhost", "127.0.0.1", "::1"].includes(
      window.location.hostname
    );

    if (parsed.protocol === "http:" && !localDevelopment) return "";
    return parsed.href;
  }

  function hostLabel(value) {
    try {
      return new URL(value).hostname.replace(/^www\./, "") || "Manual stream";
    } catch {
      return "Manual stream";
    }
  }

  function readSavedState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
      return null;
    }
  }

  function activeStateForSharing() {
    if (sharedStateIsTransient) {
      let currentStored = null;
      try {
        currentStored = localStorage.getItem(STORAGE_KEY);
      } catch {}

      const baseline = previousSavedStateExists ? previousSavedState : null;
      if (currentStored !== baseline) {
        sharedStateIsTransient = false;
        transientSharedState = null;
      }
    }

    return sharedStateIsTransient && transientSharedState
      ? transientSharedState
      : readSavedState();
  }

  /*
    Compact v2 format:

    m=2.<layout>.<col>.<row>.<slot>.<slot>...

    Slots:
      _<empty>
      e<base64url event id>
      u<base64url manual URL>

    Event titles and metadata are intentionally omitted. The event ID is all
    EastCoin needs to rebuild the player, and dropping cosmetic text is what
    makes normal event-only MultiView links dramatically shorter.
  */
  function compactSlotV2(source) {
    if (!source || typeof source !== "object") return "_";

    if (source.type === "event" && source.id) {
      const id = cleanText(source.id, "", 500);
      return id ? `e${encodeBase64Url(id)}` : "_";
    }

    if (source.type === "url" && source.url) {
      const normalized = normalizeSharedUrl(source.url);
      return normalized ? `u${encodeBase64Url(normalized)}` : "_";
    }

    return "_";
  }

  function expandSlotV2(token) {
    const value = String(token || "");
    if (!value || value === "_") return null;

    const type = value[0];
    const encoded = value.slice(1);
    if (!encoded) return null;

    if (type === "e") {
      const id = cleanText(decodeBase64Url(encoded), "", 500);
      if (!id) return null;

      return {
        type: "event",
        id,
        title: "Shared event",
        meta: "Shared MultiView"
      };
    }

    if (type === "u") {
      const url = normalizeSharedUrl(decodeBase64Url(encoded));
      if (!url) return null;

      return {
        type: "url",
        url,
        title: hostLabel(url),
        meta: "Manual URL"
      };
    }

    return null;
  }

  function buildCompactToken() {
    const raw = activeStateForSharing();
    const layout = VALID_LAYOUTS.has(Number(raw?.layout))
      ? Number(raw.layout)
      : 4;

    const split = raw?.splits?.[layout] || raw?.splits?.[String(layout)] || {};
    const minimumColumn = layout === 3 ? 45 : 25;
    const col = Math.round(
      clampSplit(split.col, DEFAULT_SPLITS[layout].col, minimumColumn)
    );
    const row = Math.round(
      clampSplit(split.row, DEFAULT_SPLITS[layout].row, 25)
    );

    const slots = Array.from({ length: layout }, (_, index) =>
      compactSlotV2(raw?.slots?.[index])
    );

    if (!slots.some((slot) => slot !== "_")) {
      throw new Error("Add at least one stream before sharing MultiView.");
    }

    return [COMPACT_VERSION, layout, col, row, ...slots].join(".");
  }

  function compactTokenToState(token) {
    const parts = String(token || "").split(".");
    if (Number(parts[0]) !== COMPACT_VERSION) return null;

    const layout = Number(parts[1]);
    if (!VALID_LAYOUTS.has(layout)) return null;

    const minimumColumn = layout === 3 ? 45 : 25;
    const col = clampSplit(parts[2], DEFAULT_SPLITS[layout].col, minimumColumn);
    const row = clampSplit(parts[3], DEFAULT_SPLITS[layout].row, 25);
    const sourceTokens = parts.slice(4, 4 + layout);

    if (sourceTokens.length !== layout) return null;

    const slots = Array.from({ length: 4 }, (_, index) => {
      if (index >= layout) return null;
      try {
        return expandSlotV2(sourceTokens[index]);
      } catch {
        return null;
      }
    });

    if (!slots.some(Boolean)) return null;

    const splits = defaultSplits();
    splits[layout] = { col, row };

    return { layout, slots, splits };
  }

  /* Legacy v1 decoder: keeps every existing ?mv= link working. */
  function expandLegacySource(source) {
    if (!Array.isArray(source) || !source.length) return null;

    if (source[0] === "e") {
      const id = cleanText(source[1], "", 500);
      if (!id) return null;

      return {
        type: "event",
        id,
        title: cleanText(source[2], "EastCoin event", 180),
        meta: cleanText(source[3], "", 120)
      };
    }

    if (source[0] === "u") {
      const url = normalizeSharedUrl(source[1]);
      if (!url) return null;

      return {
        type: "url",
        url,
        title: hostLabel(url),
        meta: "Manual URL"
      };
    }

    return null;
  }

  function legacyPayloadToState(payload) {
    if (!payload || Number(payload.v) !== LEGACY_SHARE_VERSION) return null;

    const layout = VALID_LAYOUTS.has(Number(payload.l)) ? Number(payload.l) : null;
    if (!layout || !Array.isArray(payload.s)) return null;

    const slots = Array.from({ length: 4 }, (_, index) => {
      if (index >= layout) return null;
      return expandLegacySource(payload.s[index]);
    });

    if (!slots.some(Boolean)) return null;

    const splits = defaultSplits();
    const minimumColumn = layout === 3 ? 45 : 25;
    const incomingSplit = Array.isArray(payload.p) ? payload.p : [];
    splits[layout] = {
      col: clampSplit(incomingSplit[0], DEFAULT_SPLITS[layout].col, minimumColumn),
      row: clampSplit(incomingSplit[1], DEFAULT_SPLITS[layout].row, 25)
    };

    return { layout, slots, splits };
  }

  function decodeLegacyState(token) {
    const payload = JSON.parse(decodeBase64Url(token));
    return legacyPayloadToState(payload);
  }

  function loadSharedStateBeforeMultiView() {
    const currentUrl = new URL(window.location.href);
    const compactToken = currentUrl.searchParams.get(SHARE_PARAM);
    const legacyToken = currentUrl.searchParams.get(LEGACY_SHARE_PARAM);
    if (!compactToken && !legacyToken) return;

    try {
      const nextState = compactToken
        ? compactTokenToState(compactToken)
        : decodeLegacyState(legacyToken);

      if (!nextState) {
        throw new Error("Invalid shared MultiView state");
      }

      previousSavedState = localStorage.getItem(STORAGE_KEY);
      previousSavedStateExists = previousSavedState !== null;
      transientSharedState = nextState;
      sharedStateIsTransient = true;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      sharedLayoutLoaded = true;
    } catch (error) {
      console.warn("EastCoin MultiView share link could not be loaded.", error);
    }
  }

  function showToast(message) {
    const toast = document.getElementById("mvToast");
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function shareUrl() {
    const token = buildCompactToken();
    const url = new URL("multiview.html", window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set(SHARE_PARAM, token);
    return url.href;
  }

  async function copyShareLink(button) {
    let url;
    try {
      url = shareUrl();
    } catch (error) {
      showToast(error?.message || "MultiView could not be shared.");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      const original = button.textContent;
      button.textContent = "✓ Copied";
      showToast("Short MultiView link copied! Paste it in chat.");
      window.setTimeout(() => {
        button.textContent = original;
      }, 1800);
    } catch {
      window.prompt("Copy this MultiView link:", url);
    }
  }

  function installShareButton() {
    const actions = document.querySelector(".mv-toolbar-actions");
    if (!actions || document.getElementById("mvShareButton")) return;

    const button = document.createElement("button");
    button.className = "mv-action";
    button.id = "mvShareButton";
    button.type = "button";
    button.textContent = "🔗 Share";
    button.title = "Copy a short link to this MultiView layout";
    button.setAttribute("aria-label", "Share this MultiView layout");

    const clearButton = document.getElementById("mvClearButton");
    actions.insertBefore(button, clearButton || null);
    button.addEventListener("click", () => copyShareLink(button));
  }

  function finalizeSharedLoad() {
    if (!sharedLayoutLoaded) return;

    try {
      if (previousSavedStateExists) {
        localStorage.setItem(STORAGE_KEY, previousSavedState);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}

    const cleanedUrl = new URL(window.location.href);
    cleanedUrl.searchParams.delete(SHARE_PARAM);
    cleanedUrl.searchParams.delete(LEGACY_SHARE_PARAM);
    window.history.replaceState(window.history.state, "", cleanedUrl);

    window.setTimeout(() => {
      showToast("Shared MultiView loaded.");
    }, 350);
  }

  loadSharedStateBeforeMultiView();
  installShareButton();
  window.setTimeout(finalizeSharedLoad, 0);
})();
