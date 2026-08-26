(() => {
  "use strict";

  const V2 = window.ECV2;
  const E = V2.els;

  async function identity() {
    try {
      const response = await fetch("/api/picks/bootstrap", {
        credentials: "same-origin",
        cache: "no-store"
      });

      if (!response.ok) return;

      const payload = await response.json();
      if (!payload?.ok) return;

      const session = payload.session;
      const user = session?.user;

      if (session?.authenticated && user) {
        E.profile.href = "../picks.html";
        E.profileName.textContent = user.displayName || user.login || "Twitch";
        E.avatar.innerHTML = user.profileImageUrl
          ? `<img src="${V2.esc(user.profileImageUrl)}" alt="">`
          : V2.esc(V2.initials(user.displayName || user.login));
      }

      const wallet = session?.wallet;

      if (wallet?.connected && Number.isFinite(Number(wallet.balance))) {
        E.walletLabel.textContent = Number(wallet.balance).toLocaleString();
      }

      const picks = Array.isArray(payload.myPicks) ? payload.myPicks : [];

      const openPicks = picks.filter((pick) =>
        !["won", "lost", "push", "void", "refunded"].includes(
          String(pick.status || "").toLowerCase()
        )
      ).length;

      E.picks.innerHTML = `
        <div>
          <span>Twitch</span>
          <strong>${session?.authenticated
            ? V2.esc(user?.displayName || user?.login || "Connected")
            : "Not connected"}</strong>
        </div>
        <div>
          <span>Open Picks</span>
          <strong>${openPicks}</strong>
        </div>
        <div>
          <span>${V2.esc(payload.season?.name || "Season")} Profit</span>
          <strong>
            ${Number(payload.season?.profit || 0) >= 0 ? "+" : ""}
            ${Number(payload.season?.profit || 0).toLocaleString()} ZCoins
          </strong>
        </div>
      `;
    } catch {}
  }

  async function sicko() {
    try {
      const response = await fetch("/api/picks-kalshi/featured", {
        cache: "no-store"
      });

      if (!response.ok) return;

      const payload = await response.json();
      const featured = payload?.featured;
      const market = featured?.market;

      if (!payload?.ok || !featured || !market) return;

      const side = String(
        featured.featuredSide ||
        featured.current?.side ||
        "yes"
      ).toLowerCase();

      const current = featured.current || {};
      const sideData = market?.[side] || {};

      E.sickoTitle.textContent =
        market.eventTitle ||
        market.marketTitle ||
        "Weekly prop";

      E.sickoMeta.textContent = [
        market.gameTitle,
        featured.weekLabel
      ].filter(Boolean).join(" · ");

      E.sickoSide.textContent = side.toUpperCase();
      E.sickoOdds.textContent = V2.american(current.american ?? sideData.american);
      E.sickoPrice.textContent = V2.cents(current.ask ?? sideData.ask);
      E.sicko.hidden = false;
    } catch {}
  }

  V2.integrations = {
    identity,
    sicko
  };
})();
