const KALSHI_BASES = [
  "https://external-api.kalshi.com/trade-api/v2",
  "https://api.elections.kalshi.com/trade-api/v2"
];

export async function kalshiFetch(path, options = {}) {
  const attempts = [];

  for (const base of KALSHI_BASES) {
    const url = `${base}${path}`;

    try {
      const response = await fetch(
        url,
        {
          ...options,
          headers: {
            Accept: "application/json",
            ...(options.headers || {})
          }
        }
      );

      if (response.ok) {
        return {
          response,
          base,
          attempts
        };
      }

      const body =
        await response.text().catch(
          () => ""
        );

      attempts.push({
        base,
        status: response.status,
        statusText:
          response.statusText || "",
        bodyPreview:
          body.slice(0, 240)
      });
    } catch (error) {
      attempts.push({
        base,
        status: null,
        statusText: "",
        error:
          String(
            error?.message ||
            error ||
            "fetch failed"
          )
      });
    }
  }

  const error =
    new Error(
      "KALSHI_ALL_BASES_FAILED"
    );

  error.attempts = attempts;

  throw error;
}

export function safeAttempts(attempts) {
  return (attempts || []).map(
    (attempt) => ({
      host:
        String(attempt.base || "")
          .replace(
            /^https:\/\//,
            ""
          )
          .replace(
            /\/trade-api\/v2$/,
            ""
          ),
      status:
        attempt.status ?? null,
      statusText:
        attempt.statusText || "",
      error:
        attempt.error || null,
      bodyPreview:
        attempt.bodyPreview || null
    })
  );
}
