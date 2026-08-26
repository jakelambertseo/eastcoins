const EXPECTED_TABLES = [
  "users",
  "sessions",
  "seasons",
  "markets",
  "picks",
  "wallet_operations",
  "admin_actions",
  "user_season_stats"
];

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;

  if (!db) {
    return Response.json(
      {
        ok: false,
        code: "PICKS_DB_BINDING_MISSING",
        message: "The PICKS_DB D1 binding is not available."
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
    const placeholders = EXPECTED_TABLES.map(() => "?").join(", ");

    const tableQuery = await db
      .prepare(
        `SELECT name
           FROM sqlite_master
          WHERE type = 'table'
            AND name IN (${placeholders})
          ORDER BY name`
      )
      .bind(...EXPECTED_TABLES)
      .all();

    const present = (tableQuery.results || []).map((row) => row.name);
    const presentSet = new Set(present);
    const missing = EXPECTED_TABLES.filter((name) => !presentSet.has(name));

    let latestMigration = null;

    try {
      const migration = await db
        .prepare(
          `SELECT name
             FROM d1_migrations
            ORDER BY id DESC
            LIMIT 1`
        )
        .first();

      latestMigration = migration?.name || null;
    } catch {
      // The migration metadata table does not exist until D1 migrations
      // have been applied. Missing expected tables below will still fail
      // the health check safely.
    }

    const ready = missing.length === 0;

    return Response.json(
      {
        ok: ready,
        service: "eastcoin-picks",
        database: "eastcoin-picks",
        binding: "PICKS_DB",
        schemaVersion: 1,
        latestMigration,
        tables: {
          expected: EXPECTED_TABLES.length,
          present: present.length,
          missing
        },
        status: ready ? "ready" : "incomplete",
        message: ready
          ? "EastCoin Picks core D1 schema is installed."
          : "EastCoin Picks D1 is connected, but the core schema is incomplete."
      },
      {
        status: ready ? 200 : 503,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Picks schema health check failed", error);

    return Response.json(
      {
        ok: false,
        code: "PICKS_SCHEMA_HEALTH_FAILED",
        message: "The Picks schema health check could not query D1."
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
