(() => {
  "use strict";

  const V2 = window.ECV2;
  const E = V2.els;

  const PICKS_CACHE_MS = 15_000;

  let picksBootstrapPayload = null;
  let picksBootstrapAt = 0;
  let picksBootstrapPromise = null;

  function syncLoginHref() {
    if (
      !E.profile ||
      E.profile.dataset.v2Route
    ) {
      return;
    }

    E.profile.href = V2.authUrl();
  }

  async function picksBootstrap({
    force = false
  } = {}) {
    const fresh =
      picksBootstrapPayload &&
      Date.now() - picksBootstrapAt <
        PICKS_CACHE_MS;

    if (!force && fresh) {
      return picksBootstrapPayload;
    }

    if (
      !force &&
      picksBootstrapPromise
    ) {
      return picksBootstrapPromise;
    }

    picksBootstrapPromise =
      (async () => {
        const response = await fetch(
          "/api/picks/bootstrap",
          {
            credentials: "same-origin",
            cache: "no-store"
          }
        );

        if (!response.ok) {
          throw new Error(
            `Picks bootstrap returned ${response.status}.`
          );
        }

        const payload =
          await response.json();

        if (!payload?.ok) {
          throw new Error(
            payload?.message ||
            "Picks identity is unavailable."
          );
        }

        picksBootstrapPayload =
          payload;

        picksBootstrapAt =
          Date.now();

        return payload;
      })();

    try {
      return await picksBootstrapPromise;
    } finally {
      picksBootstrapPromise = null;
    }
  }

  function handleAuthStatus() {
    const url =
      new URL(window.location.href);

    const status =
      url.searchParams.get("auth");

    if (!status) return;

    const message = ({
      success: "Twitch account connected.",
      denied: "Twitch login was cancelled.",
      invalid_state:
        "Login session expired. Please try again.",
      failed:
        "Twitch login could not be completed."
    })[status];

    if (message) {
      window.setTimeout(
        () => V2.toast(message),
        80
      );
    }

    url.searchParams.delete("auth");

    window.history.replaceState(
      window.history.state || {},
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  }

  async function identity({
    force = false
  } = {}) {
    syncLoginHref();

    try {
      const payload =
        await picksBootstrap({
          force
        });

      const session =
        payload.session;

      const user =
        session?.user;

      if (
        session?.authenticated &&
        user
      ) {
        E.profile.href =
          "?view=picks";

        E.profile.dataset.v2Route =
          "picks";

        E.profileName.textContent =
          user.displayName ||
          user.login ||
          "Twitch";

        E.avatar.innerHTML =
          user.profileImageUrl
            ? `<img src="${V2.esc(
                user.profileImageUrl
              )}" alt="">`
            : V2.esc(
                V2.initials(
                  user.displayName ||
                  user.login
                )
              );
      } else {
        delete E.profile.dataset.v2Route;
        E.profileName.textContent =
          "Log in";
        E.avatar.textContent = "T";
        syncLoginHref();
      }

      const wallet =
        session?.wallet;

      if (
        wallet?.connected &&
        Number.isFinite(
          Number(wallet.balance)
        )
      ) {
        E.walletLabel.textContent =
          Number(
            wallet.balance
          ).toLocaleString();
      } else {
        E.walletLabel.textContent =
          "ZCoins";
      }

      const picks =
        Array.isArray(
          payload.myPicks
        )
          ? payload.myPicks
          : [];

      const openPicks =
        picks.filter(
          (pick) =>
            ![
              "won",
              "lost",
              "push",
              "void",
              "refunded"
            ].includes(
              String(
                pick.status || ""
              ).toLowerCase()
            )
        ).length;

      E.picks.innerHTML = `
        <div>
          <span>Twitch</span>
          <strong>${
            session?.authenticated
              ? V2.esc(
                  user?.displayName ||
                  user?.login ||
                  "Connected"
                )
              : "Not connected"
          }</strong>
        </div>
        <div>
          <span>Open Picks</span>
          <strong>${openPicks}</strong>
        </div>
        <div>
          <span>${V2.esc(
            payload.season?.name ||
            "Season"
          )} Profit</span>
          <strong>
            ${
              Number(
                payload.season?.profit ||
                0
              ) >= 0
                ? "+"
                : ""
            }${Number(
              payload.season?.profit ||
              0
            ).toLocaleString()} ZCoins
          </strong>
        </div>
      `;
    } catch {
      syncLoginHref();
    }
  }

  async function sicko() {
    try {
      const response = await fetch(
        "/api/picks-kalshi/featured",
        {
          cache: "no-store"
        }
      );

      if (!response.ok) return;

      const payload =
        await response.json();

      const featured =
        payload?.featured;

      const market =
        featured?.market;

      if (
        !payload?.ok ||
        !featured ||
        !market
      ) {
        return;
      }

      const side =
        String(
          featured.featuredSide ||
          featured.current?.side ||
          "yes"
        ).toLowerCase();

      const current =
        featured.current || {};

      const sideData =
        market?.[side] || {};

      E.sickoTitle.textContent =
        market.eventTitle ||
        market.marketTitle ||
        "Weekly prop";

      E.sickoMeta.textContent = [
        market.gameTitle,
        featured.weekLabel
      ]
        .filter(Boolean)
        .join(" · ");

      E.sickoSide.textContent =
        side.toUpperCase();

      E.sickoOdds.textContent =
        V2.american(
          current.american ??
          sideData.american
        );

      E.sickoPrice.textContent =
        V2.cents(
          current.ask ??
          sideData.ask
        );

      E.sicko.hidden = false;
    } catch {}
  }

  E.profile?.addEventListener(
    "pointerdown",
    syncLoginHref
  );

  E.profile?.addEventListener(
    "click",
    syncLoginHref
  );

  V2.integrations = {
    identity,
    sicko,
    picksBootstrap,
    syncLoginHref,
    handleAuthStatus
  };
})();
