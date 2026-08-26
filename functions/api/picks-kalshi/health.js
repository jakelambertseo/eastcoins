const URL =
  "https://external-api.kalshi.com/trade-api/v2/events?status=open&limit=1";

export async function onRequestGet() {
  try {
    const response =
      await fetch(
        URL,
        {
          headers: {
            Accept:
              "application/json"
          }
        }
      );

    return Response.json(
      {
        ok: response.ok,
        test: true,
        integration:
          "kalshi-public-market-data",
        authenticationRequired:
          false,
        providerStatus:
          response.status,
        message:
          response.ok
            ? "Kalshi public market data is reachable."
            : "Kalshi public market data returned an error."
      },
      {
        status:
          response.ok
            ? 200
            : 502,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        test: true,
        integration:
          "kalshi-public-market-data",
        authenticationRequired:
          false,
        code:
          "KALSHI_UNREACHABLE",
        message:
          "EastCoin could not reach Kalshi."
      },
      {
        status: 502,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }
}
