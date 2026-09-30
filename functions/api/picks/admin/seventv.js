/* GET /api/picks/admin/seventv — is the 7TV hookup for !addemote working? (admins only, CHANGES NOTHING)

   Answers the three things that can go wrong, from Cloudflare itself, without touching the channel:
     1. can this server reach 7TV at all (some APIs refuse Cloudflare's addresses; ESPN does),
     2. is SEVENTV_TOKEN a live login, and whose,
     3. can that login edit zwades' active emote set (the channel owner always can; anyone else must be an editor).
   The token itself is never echoed back. */
import { ADMIN_ALLOWLIST, getSessionUser, json, fail } from "../_lib.js";

const GQL = "https://api.7tv.app/v4/gql", CHANNEL_TWITCH_ID = "215028532";

async function ask(token, query, variables) {
  const headers = { "content-type": "application/json", "user-agent": "EastCoin/1.0 (eastcoin.vip)" };
  if (token) headers.authorization = `Bearer ${token}`;
  const r = await fetch(GQL, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
  let body = null; try { body = await r.json(); } catch (e) { /* not JSON */ }
  return { status: r.status, body };
}

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("NO_DB", "Storage isn't configured.", 503);
  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) return fail("NOT_ADMIN", "Admins only.", 403);

  const token = String(context.env.SEVENTV_TOKEN || "").trim(), out = { tokenSet: !!token };
  try {
    const ch = await ask(null, `query ($pid: String!) { users { userByConnection(platform: TWITCH, platformId: $pid) { id style { activeEmoteSet { id capacity emotes(page: 1, perPage: 1) { totalCount } } } } } }`, { pid: CHANNEL_TWITCH_ID });
    const u = ch.body?.data?.users?.userByConnection, s = u?.style?.activeEmoteSet;
    out.reach = { ok: !!s, status: ch.status, error: ch.body?.errors?.[0]?.message || (s ? undefined : String(JSON.stringify(ch.body || "")).slice(0, 160)) };
    if (s) out.channel = { sevenTvUserId: u.id, setId: s.id, used: Number(s.emotes?.totalCount || 0), capacity: Number(s.capacity || 0) };
    if (token) {
      const me = await ask(token, `{ users { me { id mainConnection { platformUsername platformDisplayName } editableEmoteSetIds } } }`, {});
      const m = me.body?.data?.users?.me;
      out.login = m ? { ok: true, account: m.mainConnection?.platformDisplayName || m.mainConnection?.platformUsername || m.id } : { ok: false, status: me.status, error: me.body?.errors?.[0]?.message || "7TV doesn't recognise the token (expired or not a 7TV token)" };
      if (m && s) out.canEdit = m.id === u.id || (m.editableEmoteSetIds || []).includes(s.id);
    }
  } catch (e) { out.reach = { ok: false, error: String(e?.message || e).slice(0, 160) }; }
  out.ready = !!(out.tokenSet && out.reach?.ok && out.login?.ok && out.canEdit);
  out.say = out.ready ? `Ready: ${out.login.account} can edit zwades' emotes (${out.channel.used}/${out.channel.capacity}). !addemote will work.`
    : !out.tokenSet ? "SEVENTV_TOKEN isn't set on this deployment (a new secret only reaches deployments made after it was added)."
    : !out.reach?.ok ? "This server can't reach 7TV."
    : !out.login?.ok ? "7TV doesn't accept the token. Copy it again from 7tv.app (localStorage 7tv-token) while logged in."
    : `The token logs in as ${out.login.account}, but that account can't edit zwades' emote set. Zwades needs to add it as an editor with emote-set permission.`;
  return json(out, 200, { "Cache-Control": "no-store" });
}
