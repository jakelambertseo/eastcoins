export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;

  if (!db) {
    return Response.json(
      {
        ok: false,
        code: "PICKS_DB_BINDING_MISSING",
        message: "The PICKS_DB D1 binding is not available to this Pages Function."
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  try {
    const row = await db
      .prepare(
        "SELECT 1 AS connected, datetime('now') AS database_time"
      )
      .first();

    return Response.json(
      {
        ok: true,
        service: "eastcoin-picks",
        database: "eastcoin-picks",
        binding: "PICKS_DB",
        status: "connected",
        query: row,
        message: "EastCoin Picks can query Cloudflare D1 successfully."
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("PICKS_DB health query failed", error);

    return Response.json(
      {
        ok: false,
        code: "PICKS_DB_QUERY_FAILED",
        message: "The PICKS_DB binding exists, but the D1 test query failed."
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
