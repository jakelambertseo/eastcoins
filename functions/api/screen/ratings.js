/* ============================================================
   EastCoin — tomato scores for Movies & TV (2026-09-15)

     GET  /api/screen/ratings?type=movie|tv&id=<tmdb>
          your score, chat's score and who rated it
     POST /api/screen/ratings  { type, id, score }   score 0..5
     POST /api/screen/ratings  { type, id, score: null }  takes it back

   One row per person per title (a show is rated as a whole, not per
   episode). 3 tomatoes and up counts as FRESH, 2 and under as ROTTEN,
   which is what the "% fresh" figure is made of.

   The title, poster and year are read from TMDB when the score is
   saved, never taken from the request, so a profile can only ever
   show a real title. Members only, like every screen endpoint.

   Cost: nothing polls this. One read when a title is opened in the
   player (two indexed queries) and one write per click.
   ============================================================ */

import { tmdb, slim } from "./_tmdb.js";
import { requireLogin } from "./_gate.js";

// Not _tmdb.js's json: that one is cached, and "mine" is per person.
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export const FRESH_AT = 3;

let ready = false;
export async function ensureRatings(db) {
  if (ready) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS title_ratings (
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      tmdb_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      title TEXT NOT NULL,
      poster TEXT,
      year TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, type, tmdb_id)
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_title_ratings_title ON title_ratings (type, tmdb_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_title_ratings_user ON title_ratings (user_id, updated_at)`)
  ]);
  ready = true;
}

function parseTitle(type, id) {
  const t = type === "tv" ? "tv" : type === "movie" ? "movie" : null;
  const n = Number(id);
  return t && Number.isInteger(n) && n > 0 ? { type: t, id: n } : null;
}

async function summary(db, userId, t) {
  const [agg, mine, people] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n, AVG(score) AS avg, SUM(CASE WHEN score >= ? THEN 1 ELSE 0 END) AS fresh
                  FROM title_ratings WHERE type = ? AND tmdb_id = ?`).bind(FRESH_AT, t.type, t.id).first(),
    db.prepare(`SELECT score FROM title_ratings WHERE user_id = ? AND type = ? AND tmdb_id = ?`).bind(String(userId), t.type, t.id).first(),
    db.prepare(`SELECT r.score, u.twitch_login AS login, u.display_name AS name, u.avatar_url AS avatar
                  FROM title_ratings r JOIN users u ON u.twitch_id = r.user_id
                 WHERE r.type = ? AND r.tmdb_id = ?
                 ORDER BY r.updated_at DESC LIMIT 12`).bind(t.type, t.id).all()
  ]);
  const count = Number(agg?.n || 0);
  return {
    ok: true,
    type: t.type,
    id: t.id,
    mine: mine ? Number(mine.score) : null,
    count,
    avg: count ? Math.round(Number(agg.avg) * 10) / 10 : null,
    freshPct: count ? Math.round(100 * Number(agg.fresh || 0) / count) : null,
    people: (people.results || []).map((p) => ({
      login: String(p.login || "").toLowerCase(),
      name: String(p.name || p.login || ""),
      avatar: String(p.avatar || ""),
      score: Number(p.score)
    }))
  };
}

export async function onRequestGet(context) {
  const gate = await requireLogin(context, "Log in with Twitch to rate movies and shows.");
  if (gate.denied) return gate.denied;
  const db = context.env.PICKS_DB;
  const url = new URL(context.request.url);
  const t = parseTitle(url.searchParams.get("type"), url.searchParams.get("id"));
  if (!t) return json({ ok: false, code: "BAD_TITLE" }, 400);
  await ensureRatings(db);
  return json(await summary(db, gate.user.id, t));
}

export async function onRequestPost(context) {
  const gate = await requireLogin(context, "Log in with Twitch to rate movies and shows.");
  if (gate.denied) return gate.denied;
  const db = context.env.PICKS_DB;
  const body = await context.request.json().catch(() => ({}));
  const t = parseTitle(body?.type, body?.id);
  if (!t) return json({ ok: false, code: "BAD_TITLE" }, 400);
  await ensureRatings(db);
  const userId = String(gate.user.id);

  if (body.score === null) {
    await db.prepare(`DELETE FROM title_ratings WHERE user_id = ? AND type = ? AND tmdb_id = ?`).bind(userId, t.type, t.id).run();
    return json(await summary(db, userId, t));
  }

  const score = Number(body.score);
  if (!Number.isInteger(score) || score < 0 || score > 5) {
    return json({ ok: false, code: "BAD_SCORE", message: "A score is 0 to 5 tomatoes." }, 400);
  }

  const r = await tmdb(context.env, `/${t.type}/${t.id}`, { language: "en-US" });
  if (!r.ok) return json({ ok: false, code: r.code || "TMDB", message: "Couldn't find that title just now. Try again." }, r.status || 502);
  const d = slim(r.payload, t.type);
  if (!d.title) return json({ ok: false, code: "BAD_TITLE" }, 400);

  await db.prepare(
    `INSERT INTO title_ratings (user_id, type, tmdb_id, score, title, poster, year)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, type, tmdb_id) DO UPDATE SET
       score = excluded.score, title = excluded.title, poster = excluded.poster,
       year = excluded.year, updated_at = CURRENT_TIMESTAMP`
  ).bind(userId, t.type, t.id, score, d.title.slice(0, 200), d.poster, d.year).run();

  return json(await summary(db, userId, t));
}
