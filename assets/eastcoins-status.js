
(() => {
  "use strict";

  const API = window.EastcoinStreamedAPI;
  const refresh = document.getElementById(
    "statusRefresh"
  );
  const summary = document.getElementById(
    "statusSummary"
  );
  const summaryTitle = document.getElementById(
    "statusSummaryTitle"
  );
  const summaryDetail = document.getElementById(
    "statusSummaryDetail"
  );
  const checked = document.getElementById(
    "statusChecked"
  );

  if (!API || !refresh || !summary) {
    return;
  }

  function ageText(timestamp) {
    const age =
      Date.now() - Number(timestamp || 0);

    if (!Number.isFinite(age) || age < 0) {
      return "Updated just now";
    }

    if (age < 60_000) {
      return "Updated less than a minute ago";
    }

    const minutes = Math.floor(age / 60_000);

    return minutes < 60
      ? `Updated ${minutes}m ago`
      : `Updated ${Math.floor(minutes / 60)}h ago`;
  }

  function updateCard(
    prefix,
    result,
    fallbackLabel
  ) {
    const card = document.getElementById(
      `${prefix}Card`
    );
    const badge = document.getElementById(
      `${prefix}Badge`
    );
    const value = document.getElementById(
      `${prefix}Value`
    );
    const detail = document.getElementById(
      `${prefix}Detail`
    );

    if (!card || !badge || !value || !detail) {
      return;
    }

    card.classList.remove(
      "operational",
      "degraded",
      "unavailable"
    );

    if (result.status === "rejected") {
      card.classList.add("unavailable");
      badge.textContent = "Unavailable";
      value.textContent = "—";
      detail.textContent =
        result.reason?.message ||
        `${fallbackLabel} could not be reached.`;
      return;
    }

    const data = result.value;
    const state = data.stale
      ? "degraded"
      : "operational";

    card.classList.add(state);
    badge.textContent = data.stale
      ? "Cached"
      : "Operational";
    value.textContent =
      Array.isArray(data.data)
        ? data.data.length
        : "—";
    detail.textContent = [
      ageText(data.savedAt),
      data.fromCache
        ? "Shared browser cache"
        : "Fresh provider response"
    ].join(" · ");
  }

  async function checkStatus(force = false) {
    refresh.disabled = true;
    refresh.textContent = force
      ? "Checking…"
      : "Loading…";

    const started = performance.now();
    const results = await Promise.allSettled([
      API.getLive(force),
      API.getToday(force)
    ]);
    const elapsed = Math.round(
      performance.now() - started
    );

    updateCard(
      "live",
      results[0],
      "The live event feed"
    );
    updateCard(
      "today",
      results[1],
      "Today’s schedule"
    );

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled"
    );
    const stale = fulfilled.some(
      (result) => result.value.stale
    );

    summary.classList.remove(
      "operational",
      "degraded",
      "unavailable"
    );

    if (fulfilled.length === 2 && !stale) {
      summary.classList.add("operational");
      summaryTitle.textContent =
        "EastCoin event services are operational";
      summaryDetail.textContent =
        `Status check completed in ${elapsed}ms.`;
    } else if (fulfilled.length) {
      summary.classList.add("degraded");
      summaryTitle.textContent =
        "EastCoin is using partial or cached event data";
      summaryDetail.textContent =
        "Watching may still work while listings recover.";
    } else {
      summary.classList.add("unavailable");
      summaryTitle.textContent =
        "Event listings are temporarily unavailable";
      summaryDetail.textContent =
        "EastCoin itself is online. Try again shortly.";
    }

    checked.textContent =
      `Last checked ${new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      })}`;

    refresh.disabled = false;
    refresh.textContent = "Refresh status";
  }

  refresh.addEventListener(
    "click",
    () => checkStatus(true)
  );

  checkStatus(false);
})();
