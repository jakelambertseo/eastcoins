import {
  kalshiFetch,
  safeAttempts
} from "./_kalshi.js";

export async function onRequestGet() {
  try {
    const result =
      await kalshiFetch(
        "/events?limit=1"
      );

    const payload =
      await result.response
        .json()
        .catch(() => null);

    return Response.json(
      {
        ok: true,
        test: true,
        integration:
          "kalshi-public-market-data",
        authenticationRequired:
          false,
        providerReachable:
          true,
        providerHost:
          new URL(
            result.base
          ).host,
        eventReturned:
          Boolean(
            payload?.events?.length
          ),
        fallbackAttempts:
          safeAttempts(
            result.attempts
          ),
        message:
          "Kalshi public market data is reachable from EastCoin."
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
          "X-Content-Type-Options":
            "nosniff"
        }
      }
    );
  } catch (error) {
    // Return 200 intentionally so the diagnostic body is easy to inspect
    // even when both upstream Kalshi hostnames fail.
    return Response.json(
      {
        ok: false,
        test: true,
        integration:
          "kalshi-public-market-data",
        authenticationRequired:
          false,
        providerReachable:
          false,
        code:
          "KALSHI_ALL_BASES_FAILED",
        attempts:
          safeAttempts(
            error?.attempts
          ),
        message:
          "Both Kalshi public API hostnames failed from the EastCoin Cloudflare Function."
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
          "X-Content-Type-Options":
            "nosniff"
        }
      }
    );
  }
}
