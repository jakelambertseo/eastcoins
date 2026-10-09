/* ============================================================
   POST /api/eastscape/chatlog — keep every line of EastScape's public chat, a file a day

   (2026-10-09, the owner: "is it possible to save daily logs of all users chats that come through
   play.eastcoin.vip/chat? specifically without updating the servers and refreshing for users. while
   im away, i feel like theres important tidbits that users chat about that would allow us to make
   improvements on the game")

   The game keeps only its last 50 lines (CHAT_KEEP), which at a busy hour is under half an hour.
   So every five minutes the picks cron calls this, and this reads the same chat.json the owner's
   chat page reads and adds whatever it has not seen to that day's file in R2:

     eastscape/chat/2026-10-09.jsonl    one JSON line per chat line, Chicago day, oldest first
     eastscape/chat/_state.json         the newest line kept, so the next pull starts after it

   Nothing here touches the game: chat.json is a read, and the game server is never redeployed for
   this. 50 lines a pull against a peak of 25 in five minutes (2026-10-08) leaves room; if a burst
   ever outruns it, the file says so with a {"gap": ...} line rather than pretending it is whole.

     GET            → the state and the days kept (owner)
     GET ?day=…     → that day's file, as text (owner)

   Needs CHAT_KEY as a Pages secret (the same value as the game worker's) and ESCAPE_WORKER_URL.
   Files are kept KEEP_DAYS and pruned when the day turns.
   ============================================================ */

import { getSessionUser, json, fail, safeEqual, ADMIN_ALLOWLIST } from "../picks/_lib.js";

const PREFIX = "eastscape/chat/";
const STATE = `${PREFIX}_state.json`;
const KEEP_DAYS = 90;

async function authorize(context, db) {
  const user = db ? await getSessionUser(db, context.request) : null;
  if (user && ADMIN_ALLOWLIST.has(user.login)) return { ok: true, by: user.login };
  const expected = String(context.env.PICKS_CRON_KEY || "").trim();
  const given = String(context.request.headers.get("X-Picks-Cron-Key") || "").trim();
  if (expected && given && safeEqual(given, expected)) return { ok: true, by: "cron" };
  return { ok: false };
}

/** the Chicago day a moment falls on, as YYYY-MM-DD: the same day the rest of the game counts in */
const dayOf = (t) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t));
const idOf = (l) => `${l.t}|${l.name}|${l.text}`;

export async function onRequestPost(context) {
  const { env } = context;
  const auth = await authorize(context, env.PICKS_DB);
  if (!auth.ok) return fail("NOT_ALLOWED", "Not allowed.", 403);
  if (!env.BACKUPS) return fail("NO_BUCKET", "No R2 bucket is bound as BACKUPS on this Pages project.", 503);
  const base = String(env.ESCAPE_WORKER_URL || "").trim().replace(/\/$/, "");
  const key = String(env.CHAT_KEY || "").trim();
  if (!base || !key) return fail("NOT_CONFIGURED", "ESCAPE_WORKER_URL or CHAT_KEY is not set on this Pages project.", 503);

  let view;
  try {
    const r = await fetch(`${base}/chat.json?k=${encodeURIComponent(key)}`, { cache: "no-store" });
    if (!r.ok) return fail("WORKER_REFUSED", `The game server answered ${r.status}: check CHAT_KEY matches the game worker's.`, 502);
    view = await r.json();
  } catch (error) {
    console.error("chatlog: game server unreachable", error);
    return fail("UNREACHABLE", "Could not reach the game server.", 502);
  }
  const lines = (Array.isArray(view?.lines) ? view.lines : []).filter((l) => l && Number.isFinite(l.t) && typeof l.text === "string").sort((a, b) => a.t - b.t);

  const st = (await env.BACKUPS.get(STATE).then((o) => o && o.json()).catch(() => null)) || { lastT: 0, lastIds: [], day: null, pulls: 0, kept: 0 };
  const seen = new Set(st.lastIds || []);
  const fresh = lines.filter((l) => l.t > st.lastT || (l.t === st.lastT && !seen.has(idOf(l))));

  /* a gap: the oldest line on offer is newer than the newest kept, and the game's window was full, so lines in between were never seen */
  const gap = st.lastT && lines.length >= 50 && lines[0].t > st.lastT ? { gap: true, from: st.lastT, to: lines[0].t } : null;

  const byDay = new Map();
  if (gap) byDay.set(dayOf(gap.to), [gap]);
  for (const l of fresh) { const d = dayOf(l.t); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push({ t: l.t, name: l.name, text: l.text, ...(l.house ? { house: true } : {}), ...(l.staff ? { staff: true } : {}) }); }

  /* R2 has no append: read the day's file, add to it, write it back. A day is a few hundred KB at most. */
  for (const [d, add] of byDay) {
    const k = `${PREFIX}${d}.jsonl`, old = await env.BACKUPS.get(k).then((o) => (o ? o.text() : "")).catch(() => "");
    await env.BACKUPS.put(k, old + add.map((x) => JSON.stringify(x)).join("\n") + "\n", { httpMetadata: { contentType: "application/x-ndjson; charset=utf-8" } });
  }

  const newest = lines.length ? lines[lines.length - 1].t : st.lastT;
  const today = dayOf(Date.now());
  let pruned = 0;
  if (st.day !== today) {   /* the day turned: drop files past KEEP_DAYS */
    const cut = dayOf(Date.now() - KEEP_DAYS * 86400000);
    const list = await env.BACKUPS.list({ prefix: PREFIX }).catch(() => null);
    for (const o of list?.objects || []) { const d = o.key.slice(PREFIX.length, PREFIX.length + 10); if (/^\d{4}-\d\d-\d\d$/.test(d) && d < cut) { await env.BACKUPS.delete(o.key).catch(() => {}); pruned++; } }
  }
  const next = { lastT: Math.max(st.lastT || 0, newest), lastIds: lines.filter((l) => l.t === Math.max(st.lastT || 0, newest)).map(idOf), day: today, pulls: (st.pulls | 0) + 1, kept: (st.kept | 0) + fresh.length, gaps: (st.gaps | 0) + (gap ? 1 : 0), at: Date.now(), by: auth.by };
  await env.BACKUPS.put(STATE, JSON.stringify(next), { httpMetadata: { contentType: "application/json" } });
  return json({ ok: true, added: fresh.length, gap: !!gap, days: [...byDay.keys()], pruned, lastT: next.lastT });
}

export async function onRequestGet(context) {
  const { env } = context;
  const user = env.PICKS_DB ? await getSessionUser(env.PICKS_DB, context.request) : null;
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) return fail("NOT_ALLOWED", "Not allowed.", 403);
  if (!env.BACKUPS) return fail("NO_BUCKET", "No R2 bucket is bound as BACKUPS on this Pages project.", 503);
  const day = new URL(context.request.url).searchParams.get("day");
  if (day) {
    if (!/^\d{4}-\d\d-\d\d$/.test(day)) return fail("BAD_DAY", "day is YYYY-MM-DD.", 400);
    const o = await env.BACKUPS.get(`${PREFIX}${day}.jsonl`);
    return new Response(o ? o.body : "", { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
  }
  const st = await env.BACKUPS.get(STATE).then((o) => o && o.json()).catch(() => null);
  const list = await env.BACKUPS.list({ prefix: PREFIX }).catch(() => null);
  const days = (list?.objects || []).filter((o) => o.key.endsWith(".jsonl")).map((o) => ({ day: o.key.slice(PREFIX.length, PREFIX.length + 10), bytes: o.size }));
  return json({ ok: true, state: st, days });
}
