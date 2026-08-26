(() => {
  "use strict";

  const API_ROOT = "/api/picks";
  const DEFAULT_TIMEOUT = 7000;

  class PicksApiError extends Error {
    constructor(message, options = {}) {
      super(message);
      this.name = "PicksApiError";
      this.status = Number(options.status || 0);
      this.code = options.code || "";
      this.payload = options.payload ?? null;
    }
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      Number(options.timeout || DEFAULT_TIMEOUT)
    );

    try {
      const headers = {
        Accept: "application/json",
        ...(options.body ? {"Content-Type": "application/json"} : {}),
        ...(options.headers || {})
      };

      const response = await fetch(
        `${API_ROOT}${path}`,
        {
          method: options.method || "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal
        }
      );

      let payload = null;
      const type = response.headers.get("content-type") || "";

      if (type.includes("application/json")) {
        payload = await response.json().catch(() => null);
      } else {
        const text = await response.text().catch(() => "");
        payload = text ? {message: text} : null;
      }

      if (!response.ok) {
        throw new PicksApiError(
          payload?.message || `Picks API returned ${response.status}.`,
          {
            status: response.status,
            code: payload?.code || "",
            payload
          }
        );
      }

      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new PicksApiError("Picks API request timed out.", {
          code: "TIMEOUT"
        });
      }

      if (error instanceof PicksApiError) {
        throw error;
      }

      throw new PicksApiError(
        error?.message || "Picks API is unavailable.",
        {code: "NETWORK_ERROR"}
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function authUrl(returnTo = "/picks.html") {
    return `${API_ROOT}/auth/twitch/start?returnTo=${encodeURIComponent(returnTo)}`;
  }

  function getBootstrap() {
    return request("/bootstrap");
  }

  function placePick({marketId, selection, wager, idempotencyKey}) {
    return request("/wagers", {
      method: "POST",
      headers: {
        "Idempotency-Key": idempotencyKey
      },
      body: {
        marketId,
        selection,
        wager
      }
    });
  }

  function logout() {
    return request("/auth/logout", {method: "POST"});
  }

  function getAdminMarkets() {
    return request("/admin/markets");
  }

  function settleMarket(marketId, result) {
    return request(
      `/admin/markets/${encodeURIComponent(marketId)}/settle`,
      {
        method: "POST",
        body: {result}
      }
    );
  }

  window.EastcoinPicksAPI = Object.freeze({
    PicksApiError,
    authUrl,
    getBootstrap,
    placePick,
    logout,
    getAdminMarkets,
    settleMarket
  });
})();
