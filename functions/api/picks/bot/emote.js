/* ============================================================
   !addemote / !removeemote — put a 7TV emote on zwades' channel
   straight from chat (2026-09-30).

   The flow the owner asked for: a viewer pastes a 7TV link in chat,
   zwades types `!addemote <that link>`, and it's in. Zwades typing
   the command IS the approval, so there is no queue and no daily cap:
   only the logins in ADDERS can use it, and StreamElements fills the
   sender from the real chat message (see botGate in _bot.js).

     !addemote https://7tv.app/emotes/01ABC…            add it
     !addemote https://7tv.app/emotes/01ABC… newName    add it renamed
     !removeemote peepoClap                             remove by name
     !removeemote https://7tv.app/emotes/01ABC…         or by link

   StreamElements commands (User level: Everyone, cooldown 0; this
   endpoint does the gating, like !pick):
     !addemote     $(customapi https://eastcoin.vip/api/picks/bot/emote?k=KEY&user=$(sender.name)&args=$(queryescape $(1:)))
     !removeemote  $(customapi https://eastcoin.vip/api/picks/bot/emote?op=remove&k=KEY&user=$(sender.name)&args=$(queryescape $(1:)))

   7TV. Their current API is GraphQL at api.7tv.app/v4/gql (the one
   7tv.app itself uses). Reading is public; changing a set needs a
   logged-in 7TV account that is an EDITOR of zwades' channel with
   permission to manage emote sets. That account's token is the
   Pages secret SEVENTV_TOKEN (it is what 7tv.app keeps in the
   browser as `7tv-token` after logging in). The channel's active set
   is looked up on every call rather than stored, so switching sets
   on 7TV needs nothing changed here.

   Every add and remove is written to `emote_log` (who, what, when),
   so there is always a record of who put what on the channel.
   ============================================================ */

import { say, botGate } from "./_bot.js";

const GQL = "https://api.7tv.app/v4/gql";
const CHANNEL_TWITCH_ID = "215028532";            // zwades on Twitch (7TV user 01KXEPYPN1X8M68ABH7QR10PAH)
const ADDERS = new Set(["zwades", "bootypaper"]); // the streamer, and the site's owner for testing

/** A 7TV emote id out of whatever was pasted: a 7tv.app page, the old site, a CDN image, or a bare id. */
export function emoteIdFrom(text) {
  const s = String(text || "").trim();
  const m = s.match(/7tv\.(?:app|io)\/emotes?\/([0-9A-Za-z]{24,26})/i) || s.match(/^([0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}|[0-9a-f]{24})$/);
  return m ? m[1] : null;
}
/* 7TV lets a name be most printable characters; chat only needs it to be one word. */
const aliasOk = (a) => /^[^\s<>"'`]{1,100}$/.test(a);

async function gql(env, query, variables, withAuth = true) {
  const headers = { "content-type": "application/json", "user-agent": "EastCoin/1.0 (eastcoin.vip)" };
  if (withAuth) headers.authorization = `Bearer ${String(env.SEVENTV_TOKEN || "").trim()}`;
  let res;
  try { res = await fetch(GQL, { method: "POST", headers, body: JSON.stringify({ query, variables }) }); }
  catch (e) { return { error: "NETWORK", message: "couldn't reach 7TV" }; }
  let body = null; try { body = await res.json(); } catch (e) { /* not JSON */ }
  if (!body) return { error: `HTTP_${res.status}`, message: `7TV answered ${res.status}` };
  if (body.errors?.length) { const e = body.errors[0]; return { error: String(e.extensions?.code || "ERROR"), message: String(e.message || "7TV said no") }; }
  return { data: body.data };
}

/** Plain words for 7TV's error codes, pointing at the fix. */
function explain(r) {
  const c = String(r.error || "");
  if (c === "LOGIN_REQUIRED" || c === "HTTP_401") return "the 7TV login this uses has expired or is wrong. The token (SEVENTV_TOKEN) needs refreshing.";
  if (/PERMISSION|FORBIDDEN|INSUFFICIENT|HTTP_403/.test(c)) return "the 7TV account this uses isn't an editor with emote permissions on the channel.";
  if (/LIMIT|CAPACITY|FULL/.test(c) || /capacity|full/i.test(r.message)) return "the channel's emote set is full.";
  if (/CONFLICT|ALREADY|NAME/.test(c) || /conflict|already|name/i.test(r.message)) return "an emote with that name is already on the channel. Add a new name after the link.";
  return `7TV said: ${String(r.message || c).replace(/^[A-Z_]+\s+/, "").slice(0, 120)}`;
}

async function ensureLog(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS emote_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    login TEXT NOT NULL, op TEXT NOT NULL, emote_id TEXT NOT NULL, name TEXT NOT NULL)`).run();
}
async function note(env, login, op, emoteId, name) {
  const db = env.PICKS_DB; if (!db) return;
  try { await ensureLog(db); await db.prepare(`INSERT INTO emote_log (login, op, emote_id, name) VALUES (?, ?, ?, ?)`).bind(login, op, emoteId, name).run(); }
  catch (e) { /* the emote is on the channel either way; a missed log line is not worth an error in chat */ }
}

/** The channel's active emote set: id, capacity, how full it is. Public read. */
async function channelSet(env) {
  const r = await gql(env, `query ($pid: String!) { users { userByConnection(platform: TWITCH, platformId: $pid) {
    style { activeEmoteSet { id name capacity emotes(page: 1, perPage: 1) { totalCount } } } } } }`, { pid: CHANNEL_TWITCH_ID }, false);
  if (r.error) return r;
  const s = r.data?.users?.userByConnection?.style?.activeEmoteSet;
  return s ? { id: s.id, capacity: Number(s.capacity || 0), count: Number(s.emotes?.totalCount || 0) } : { error: "NO_SET", message: "the channel has no active 7TV emote set" };
}
/** Emotes in the set whose name matches `name` exactly (7TV's search is fuzzy, so the exact match is ours). */
async function inSetByName(env, setId, name) {
  const r = await gql(env, `query ($id: Id!, $q: String!) { emoteSets { emoteSet(id: $id) { emotes(page: 1, perPage: 50, query: $q) {
    items { alias emote { id defaultName } } } } } }`, { id: setId, q: name }, false);
  if (r.error) return r;
  return { items: (r.data?.emoteSets?.emoteSet?.emotes?.items || []).filter((x) => x.alias === name) };
}

export async function onRequestGet(context) {
  const gate = botGate(context);
  if (!gate.ok) return gate.response;
  if (!ADDERS.has(gate.login)) return new Response("", { status: 200, headers: { "Cache-Control": "no-store" } });   // silent for everyone else, like a mod-only command
  const env = context.env, op = new URL(context.request.url).searchParams.get("op") === "remove" ? "remove" : "add";
  if (!String(env.SEVENTV_TOKEN || "").trim()) return say("7TV isn't hooked up yet: the site needs a 7TV editor token (SEVENTV_TOKEN).");

  const words = gate.args.split(/\s+/).filter(Boolean);
  if (!words.length) return say(op === "add" ? "Paste the 7TV link after the command: !addemote https://7tv.app/emotes/…" : "Say which one: !removeemote <name>");

  const set = await channelSet(env);
  if (set.error) return say(`Couldn't read the channel's emotes: ${explain(set)}`);

  if (op === "remove") {
    let emoteId = emoteIdFrom(words[0]), alias = null;
    if (!emoteId) {
      const hit = await inSetByName(env, set.id, words[0]);
      if (hit.error) return say(`Couldn't check the channel: ${explain(hit)}`);
      if (!hit.items.length) return say(`No emote called ${words[0].slice(0, 40)} on the channel.`);
      emoteId = hit.items[0].emote.id; alias = hit.items[0].alias;
    }
    const r = await gql(env, `mutation ($set: Id!, $emote: EmoteSetEmoteId!) { emoteSets { emoteSet(id: $set) { removeEmote(id: $emote) { id } } } }`,
      { set: set.id, emote: alias ? { emoteId, alias } : { emoteId } });
    if (r.error) return say(`Didn't remove it: ${explain(r)}`);
    await note(env, gate.login, "remove", emoteId, alias || words[0]);
    return say(`Removed ${alias || "it"} from the channel (${Math.max(0, set.count - 1)}/${set.capacity}).`);
  }

  const emoteId = emoteIdFrom(words[0]);
  if (!emoteId) return say("That isn't a 7TV emote link. It should look like https://7tv.app/emotes/…");
  const alias = words[1] || null;
  if (alias && !aliasOk(alias)) return say("That name won't work as an emote. One word, no quotes.");

  const e = await gql(env, `query ($id: Id!) { emotes { emote(id: $id) { id defaultName deleted flags { nsfw private } } } }`, { id: emoteId }, false);
  if (e.error) return say(`Couldn't look that emote up: ${explain(e)}`);
  const emote = e.data?.emotes?.emote;
  if (!emote || emote.deleted) return say("7TV doesn't have that emote (deleted, or the link is wrong).");
  if (emote.flags?.nsfw) return say(`7TV has ${emote.defaultName} marked NSFW, so it stays off the channel.`);
  const name = alias || emote.defaultName;

  const clash = await inSetByName(env, set.id, name);
  if (clash.error) return say(`Couldn't check the channel: ${explain(clash)}`);
  if (clash.items.some((x) => x.emote.id === emote.id)) return say(`${name} is already on the channel.`);
  if (clash.items.length) return say(`There's already an emote called ${name}. Add it with a new name: !addemote <link> <newName>`);
  if (set.capacity && set.count >= set.capacity) return say(`The channel's emote set is full (${set.count}/${set.capacity}). Remove one first: !removeemote <name>`);

  const r = await gql(env, `mutation ($set: Id!, $emote: EmoteSetEmoteId!) { emoteSets { emoteSet(id: $set) { addEmote(id: $emote) { id } } } }`,
    { set: set.id, emote: alias && alias !== emote.defaultName ? { emoteId: emote.id, alias } : { emoteId: emote.id } });
  if (r.error) return say(`Didn't add it: ${explain(r)}`);
  await note(env, gate.login, "add", emote.id, name);
  return say(`Added ${name} to the channel (${set.count + 1}/${set.capacity}). It shows up in chat right away for anyone with 7TV.`);
}
