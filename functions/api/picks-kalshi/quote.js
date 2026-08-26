import { kalshiFetch, safeAttempts } from "./_kalshi.js";

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function dollarPrice(
  market,
  side,
  type = "ask"
) {
  const dollars =
    number(
      market?.[
        `${side}_${type}_dollars`
      ],
      NaN
    );

  if (
    Number.isFinite(dollars) &&
    dollars > 0 &&
    dollars < 1
  ) {
    return dollars;
  }

  const cents =
    number(
      market?.[
        `${side}_${type}`
      ],
      NaN
    );

  if (
    Number.isFinite(cents) &&
    cents > 0 &&
    cents < 100
  ) {
    return cents / 100;
  }

  return null;
}

function probabilityToAmerican(p) {
  p = number(p, NaN);

  if (
    !Number.isFinite(p) ||
    p <= 0 ||
    p >= 1
  ) {
    return null;
  }

  if (Math.abs(p - 0.5) < 0.000001) {
    return 100;
  }

  return p < 0.5
    ? Math.round(
        100 * (1 - p) / p
      )
    : -Math.round(
        100 * p / (1 - p)
      );
}

function normalizeSide(
  market,
  side
) {
  const ask =
    dollarPrice(
      market,
      side,
      "ask"
    );

  const bid =
    dollarPrice(
      market,
      side,
      "bid"
    );

  if (ask == null) {
    return null;
  }

  return {
    ask,
    bid,
    american:
      probabilityToAmerican(
        ask
      ),
    decimal:
      1 / ask
  };
}

export async function onRequestGet(context) {
  const url =
    new URL(
      context.request.url
    );

  const ticker =
    String(
      url.searchParams.get(
        "ticker"
      ) || ""
    ).trim();

  if (
    !/^[A-Za-z0-9._-]{1,200}$/.test(
      ticker
    )
  ) {
    return Response.json(
      {
        ok: false,
        code:
          "INVALID_MARKET_TICKER",
        message:
          "A valid Kalshi market ticker is required."
      },
      {
        status: 400,
        headers: {
          "Cache-Control":
            "no-store"
        }
      }
    );
  }

  let result;

  try {
    result =
      await kalshiFetch(
        `/markets/${encodeURIComponent(ticker)}`
      );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        code:
          "KALSHI_QUOTE_FAILED",
        message:
          "Kalshi could not provide a fresh quote for this market.",
        attempts:
          safeAttempts(
            error?.attempts
          )
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

  const payload =
    await result.response.json();

  const market =
    payload?.market;

  if (!market) {
    return Response.json(
      {
        ok: false,
        code:
          "KALSHI_MARKET_MISSING",
        message:
          "Kalshi returned no market."
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

  const status =
    String(
      market.status || ""
    ).toLowerCase();

  const closeTime =
    market.close_time ||
    market.expiration_time ||
    null;

  const closeTimestamp =
    Date.parse(
      closeTime || ""
    );

  const open =
    ["active", "open"].includes(
      status
    ) &&
    (
      !Number.isFinite(
        closeTimestamp
      ) ||
      closeTimestamp >
        Date.now()
    );

  return Response.json(
    {
      ok: true,
      provider: "Kalshi",
      providerHost:
        new URL(
          result.base
        ).host,
      fallbackAttempts:
        safeAttempts(
          result.attempts
        ),
      generatedAt:
        new Date().toISOString(),
      market: {
        ticker:
          String(
            market.ticker || ticker
          ),
        title:
          String(
            market.title ||
            market.subtitle ||
            market.yes_sub_title ||
            "Kalshi Market"
          ),
        status:
          String(
            market.status || ""
          ),
        open,
        closeTime,
        updatedTime:
          market.updated_time ||
          null,
        yes:
          normalizeSide(
            market,
            "yes"
          ),
        no:
          normalizeSide(
            market,
            "no"
          ),
        liquidityDollars:
          number(
            market.liquidity_dollars,
            0
          ),
        volume:
          number(
            market.volume_fp ??
            market.volume,
            0
          )
      }
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
