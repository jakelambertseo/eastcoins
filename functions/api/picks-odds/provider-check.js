const SPORT_KEY = "americanfootball_nfl";

export async function onRequestGet(context) {
  const apiKey = String(
    context.env.ODDS_API_KEY || ""
  ).trim();

  if (!apiKey) {
    return Response.json(
      {
        ok: false,
        code: "ODDS_API_KEY_MISSING",
        keyConfigured: false,
        message: "ODDS_API_KEY is not configured."
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  const url = new URL(
    "https://api.the-odds-api.com/v4/sports/"
  );

  url.searchParams.set(
    "apiKey",
    apiKey
  );

  let response;

  try {
    response = await fetch(
      url.toString(),
      {
        headers: {
          Accept: "application/json"
        }
      }
    );
  } catch (error) {
    console.error(
      "The Odds API sports check failed",
      error
    );

    return Response.json(
      {
        ok: false,
        code: "ODDS_API_UNREACHABLE",
        keyConfigured: true,
        message: "EastCoin could not reach The Odds API."
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  if (!response.ok) {
    const payload =
      await response.json().catch(
        () => null
      );

    const providerCode =
      String(
        payload?.error_code ||
        payload?.code ||
        ""
      );

    const providerMessage =
      String(
        payload?.message ||
        payload?.error ||
        ""
      );

    return Response.json(
      {
        ok: false,
        keyConfigured: true,
        providerStatus: response.status,
        providerCode:
          providerCode || null,
        providerMessage:
          providerMessage || null,
        message:
          providerMessage
            ? `The Odds API rejected the configured key: ${providerMessage}`
            : "The Odds API rejected the configured key."
      },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  }

  const sports =
    await response.json();

  const nfl =
    Array.isArray(sports)
      ? sports.find(
          (sport) =>
            sport?.key ===
            SPORT_KEY
        )
      : null;

  return Response.json(
    {
      ok: true,
      keyConfigured: true,
      providerReachable: true,
      nfl: nfl
        ? {
            key: String(nfl.key),
            title: String(
              nfl.title || "NFL"
            ),
            active: Boolean(
              nfl.active
            ),
            hasOutrights: Boolean(
              nfl.has_outrights
            )
          }
        : {
            key: SPORT_KEY,
            active: false,
            listed: false
          },
      message: nfl
        ? "The Odds API key is valid and NFL is listed by the provider."
        : "The Odds API key is valid, but NFL is not currently listed as in-season."
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}
