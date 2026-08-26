import {
  kalshiFetch,
  safeAttempts
} from "./_kalshi.js";

export async function onRequestGet() {
  const tests = [
    {
      name: "events",
      path: "/events?limit=1"
    },
    {
      name: "exchange_status",
      path: "/exchange/status"
    }
  ];

  const results = [];

  for (const test of tests) {
    try {
      const result =
        await kalshiFetch(
          test.path
        );

      results.push({
        name: test.name,
        ok: true,
        providerHost:
          new URL(
            result.base
          ).host,
        fallbackAttempts:
          safeAttempts(
            result.attempts
          )
      });
    } catch (error) {
      results.push({
        name: test.name,
        ok: false,
        attempts:
          safeAttempts(
            error?.attempts
          )
      });
    }
  }

  return Response.json(
    {
      ok:
        results.some(
          (result) =>
            result.ok
        ),
      test: true,
      results
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
