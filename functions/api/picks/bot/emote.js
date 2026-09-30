/* ============================================================
   !addemote / !removeemote — put a 7TV emote on zwades' channel
   straight from chat (2026-09-30).

   ANYONE CAN ADD OR REMOVE ONE FOR 250 ZCOINS; ONLY ZWADES IS FREE
   (the owner, 2026-09-30; bootypaper pays too, by his own call). ANY
   emote with a working 7TV link goes on: no NSFW or "not publicly
   listed" filter, by the owner's call. A PAID REMOVAL CAN'T TOUCH AN
   EMOTE ADDED IN THE LAST 24 HOURS (PROTECT_MS, from 7TV's own addedAt,
   so it covers emotes added any way at all): somebody who just paid 250
   gets a day of it. Zwades removes anything, any time, free.
   StreamElements fills the sender from the real chat message (botGate
   in _bot.js), so "!addemote ... as zwades" can't mean anything.

   THE MONEY PATH IS THE STORE'S (store/buy.js), because ZCoin accuracy
   is the one thing that can't be wrong here:
     1. every check that can refuse runs FIRST (link, emote, name, space,
        balance), so a refusal never touches the wallet;
     2. a WAGER_DEBIT keyed STORE:EMOTE:<user>:<emote> (retryKey, so a
        retry gets a fresh key and a double-send can't charge twice);
     3. then 7TV is asked to add it. If 7TV says no, the 250 goes straight
        back (COMPENSATING_REFUND). If 7TV's answer is LOST (a network
        error), the channel is read again before deciding: in the set =
        paid for, not in it = refunded. Nobody pays for an emote that
        didn't go on, and nobody gets one free by timing a failure;
     3b. ONE ADD OF AN EMOTE AT A TIME: before any charge, the emote is
        held in `emote_inflight` (its id is the primary key, so a second
        INSERT fails). Two `!addemote` for the same emote at the same
        moment, from one person or two, can't both be charged: the second
        is told someone's adding it and pays nothing. A hold older than
        two minutes is a crashed request and is cleared;
     4. an emote_log row carries the op key, so the admin Wallet tab's
        stuck-charge tool can tell a charge that never reached 7TV.
   A paid removal is the same path with the key STORE:EMOTEOFF:<user>:<emote>.
   The STORE: prefix is also what puts it on a profile's store line.

     !addemote https://7tv.app/emotes/01ABC…            add it (250 ZC, free for zwades)
     !addemote https://7tv.app/emotes/01ABC… newName    add it renamed
     !removeemote peepoClap                             remove by name (250 ZC, free for zwades)
     !removeemote https://7tv.app/emotes/01ABC…         or by link

   StreamElements commands (User level: Everyone, cooldown 0; this
   endpoint does the gating, like !pick):
     !addemote     $(customapi https://eastcoin.vip/api/picks/bot/emote?k=KEY&user=$(sender.name)&id=$(sender.twitchid)&name=$(queryescape $(sender))&args=$(queryescape $(1:)))
     !removeemote  $(customapi https://eastcoin.vip/api/picks/bot/emote?op=remove&k=KEY&user=$(sender.name)&id=$(sender.twitchid)&name=$(queryescape $(sender))&args=$(queryescape $(1:)))

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

import { say, botGate, findOrCreateUser } from "./_bot.js";
import { walletWritesEnabled, readBalance, moveBalance, beginOperation, finishOperation, retryKey, newId } from "../_lib.js";

const GQL = "https://api.7tv.app/v4/gql";
const CHANNEL_TWITCH_ID = "215028532";            // zwades on Twitch (7TV user 01KXEPYPN1X8M68ABH7QR10PAH)
const FREE = new Set(["zwades"]);          // adds and removes without paying, and ignores the 24 hours
export const PRICE = 250;
export const PROTECT_MS = 24 * 60 * 60 * 1000;   // a paid removal can't touch an emote this new

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
    login TEXT NOT NULL, op TEXT NOT NULL, emote_id TEXT NOT NULL, name TEXT NOT NULL, price INTEGER NOT NULL DEFAULT 0, op_key TEXT)`).run();
  for (const col of ["price INTEGER NOT NULL DEFAULT 0", "op_key TEXT"]) await db.prepare(`ALTER TABLE emote_log ADD COLUMN ${col}`).run().catch(() => {});   /* (a table made before paid adds) */
  await db.prepare(`CREATE TABLE IF NOT EXISTS emote_inflight (emote_id TEXT PRIMARY KEY, login TEXT NOT NULL, at INTEGER NOT NULL)`).run();
}
/** Hold an emote while it is being added or removed (3b in the header). true = ours; false = somebody else is on it right now. */
async function hold(db, emoteId, login) {
  await ensureLog(db);
  await db.prepare(`DELETE FROM emote_inflight WHERE at < ?`).bind(Date.now() - 120000).run();
  try { await db.prepare(`INSERT INTO emote_inflight (emote_id, login, at) VALUES (?, ?, ?)`).bind(emoteId, login, Date.now()).run(); return true; }
  catch (e) { return false; }
}
const release = (db, emoteId) => db.prepare(`DELETE FROM emote_inflight WHERE emote_id = ?`).bind(emoteId).run().catch(() => {});
async function note(env, login, op, emoteId, name, price = 0, opKey = null) {
  const db = env.PICKS_DB; if (!db) return;
  try { await ensureLog(db); await db.prepare(`INSERT INTO emote_log (login, op, emote_id, name, price, op_key) VALUES (?, ?, ?, ?, ?, ?)`).bind(login, op, emoteId, name, price, opKey).run(); }
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
    items { alias addedAt emote { id defaultName } } } } } }`, { id: setId, q: name }, false);
  if (r.error) return r;
  return { items: (r.data?.emoteSets?.emoteSet?.emotes?.items || []).filter((x) => x.alias === name) };
}
/** The set's entry for one emote id (a removal by link). Reads the whole set's ids, so only removal-by-link pays for it. */
async function inSetById(env, setId, emoteId) {
  const r = await gql(env, `query ($id: Id!) { emoteSets { emoteSet(id: $id) { emotes(page: 1, perPage: 1000) { items { alias addedAt emote { id defaultName } } } } } }`, { id: setId }, false);
  if (r.error) return r;
  return { items: (r.data?.emoteSets?.emoteSet?.emotes?.items || []).filter((x) => x.emote?.id === emoteId) };
}
const hoursLeft = (addedAt) => Math.max(1, Math.ceil((new Date(addedAt).getTime() + PROTECT_MS - Date.now()) / 3600000));

export async function onRequestGet(context) {
  const gate = botGate(context);
  if (!gate.ok) return gate.response;
  const env = context.env, op = new URL(context.request.url).searchParams.get("op") === "remove" ? "remove" : "add";
  const who = `@${gate.login}`, free = FREE.has(gate.login);
  if (!String(env.SEVENTV_TOKEN || "").trim()) return say("7TV isn't hooked up yet: the site needs a 7TV editor token (SEVENTV_TOKEN).");

  const words = gate.args.split(/\s+/).filter(Boolean);
  if (!words.length) return say(op === "add" ? `${who} paste a 7TV link after it: !addemote https://7tv.app/emotes/… (${PRICE} ZC)` : `${who} say which one: !removeemote <name> (${PRICE} ZC)`);
  const db = env.PICKS_DB;
  if (!db) return say(`${who} emotes are offline right now. Nothing was charged.`);

  const set = await channelSet(env);
  if (set.error) return say(`${who} couldn't read the channel's emotes: ${explain(set)}`);
  const mutate = (kind, emote) => gql(env, `mutation ($set: Id!, $emote: EmoteSetEmoteId!) { emoteSets { emoteSet(id: $set) { ${kind}(id: $emote) { id } } } }`, { set: set.id, emote });

  /* ---------------- REMOVE ---------------- */
  if (op === "remove") {
    const byId = emoteIdFrom(words[0]);
    const found = byId ? await inSetById(env, set.id, byId) : await inSetByName(env, set.id, words[0]);
    if (found.error) return say(`${who} couldn't check the channel: ${explain(found)}`);
    const entry = found.items[0];
    if (!entry) return say(`${who} ${byId ? "that emote isn't" : `no emote called ${words[0].slice(0, 40)} is`} on the channel. Nothing was charged.`);
    const name = entry.alias, emoteId = entry.emote.id;
    if (!free && entry.addedAt && Date.now() - new Date(entry.addedAt).getTime() < PROTECT_MS) return say(`${who} ${name} went on in the last 24 hours, so it's safe for another ${hoursLeft(entry.addedAt)}h. Nothing was charged.`);
    if (!(await hold(db, emoteId, gate.login).catch(() => false))) return say(`${who} someone's changing that one right now. Nothing was charged.`);
    let done = false;
    try {
      const act = () => mutate("removeEmote", { emoteId, alias: name });
      const gone = async () => { const c = await inSetByName(env, set.id, name); return !c.error && !c.items.some((x) => x.emote.id === emoteId); };
      if (free) {
        const r = await act();
        if (r.error && !(r.error === "NETWORK" && await gone())) return say(`Didn't remove it: ${explain(r)}`);
        done = true; await note(env, gate.login, "remove", emoteId, name);
        return say(`Removed ${name} from the channel (${Math.max(0, set.count - 1)}/${set.capacity}).`);
      }
      const out = await charge(env, db, gate, who, { keyBase: `STORE:EMOTEOFF:`, emoteId, name, verb: "removing", act, check: gone, logOp: "remove",
        success: (left) => `${who} removed ${name} from the channel for ${PRICE} ZC (${Math.max(0, set.count - 1)}/${set.capacity}).${left}` });
      done = out.ok; return say(out.text);
    } finally { if (!done) await release(db, emoteId); }
  }

  /* ---------------- ADD ---------------- */
  const emoteId = emoteIdFrom(words[0]);
  if (!emoteId) return say(`${who} that isn't a 7TV emote link. It should look like https://7tv.app/emotes/…`);
  const alias = words[1] || null;
  if (alias && !aliasOk(alias)) return say(`${who} that name won't work as an emote. One word, no quotes.`);
  const e = await gql(env, `query ($id: Id!) { emotes { emote(id: $id) { id defaultName deleted } } }`, { id: emoteId }, false);
  if (e.error) return say(`${who} couldn't look that emote up: ${explain(e)}`);
  const emote = e.data?.emotes?.emote;
  if (!emote || emote.deleted) return say(`${who} 7TV doesn't have that emote (deleted, or the link is wrong). Nothing was charged.`);
  const name = alias || emote.defaultName;

  /* THE HOLD COMES FIRST (3b): taken before "is it already on?" is asked, so no second request can pass that question while
     this one is still working. Let go on a failure, KEPT for two minutes after a success, so a request that reads the channel
     before 7TV's lists catch up still finds it held. */
  if (!(await hold(db, emote.id, gate.login).catch(() => false))) return say(`${who} someone's adding that one right now. Nothing was charged.`);
  let done = false;
  try {
    const clash = await inSetByName(env, set.id, name);
    if (clash.error) return say(`${who} couldn't check the channel: ${explain(clash)}`);
    if (clash.items.some((x) => x.emote.id === emote.id)) return say(`${who} ${name} is already on the channel. Nothing was charged.`);
    if (clash.items.length) return say(`${who} there's already an emote called ${name}. Add it with a new name: !addemote <link> <newName>`);
    if (set.capacity && set.count >= set.capacity) return say(`${who} the channel's emote set is full (${set.count}/${set.capacity}). Nothing was charged.`);
    const act = () => mutate("addEmote", alias && alias !== emote.defaultName ? { emoteId: emote.id, alias } : { emoteId: emote.id });
    /* 7TV's answer can be LOST (network): look at the channel before deciding it didn't happen */
    const landed = async () => { const c = await inSetByName(env, set.id, name); return !c.error && c.items.some((x) => x.emote.id === emote.id); };
    if (free) {
      const r = await act();
      if (r.error && !(r.error === "NETWORK" && await landed())) return say(`Didn't add it: ${explain(r)}`);
      done = true; await note(env, gate.login, "add", emote.id, name);
      return say(`Added ${name} to the channel (${set.count + 1}/${set.capacity}).`);
    }
    const out = await charge(env, db, gate, who, { keyBase: `STORE:EMOTE:`, emoteId: emote.id, name, verb: "adding", act, check: landed, logOp: "add",
      success: (left) => `${who} added ${name} to the channel for ${PRICE} ZC (${set.count + 1}/${set.capacity}).${left}` });
    done = out.ok; return say(out.text);
  } finally { if (!done) await release(db, emote.id); }
}

/* ---- THE MONEY PATH (see the header), shared by paid adds and paid removals. Runs only while this request holds the emote.
   `act` asks 7TV to do it; `check` answers "did it happen?" when 7TV's answer was lost. Returns { ok, text }. */
async function charge(env, db, gate, who, { keyBase, emoteId, name, verb, act, check, logOp, success }) {
  const fin = (ok, text) => ({ ok, text });
  if (!walletWritesEnabled(env)) return fin(false, `${who} ZCoin payments aren't set up right now. Nothing was charged.`);
  const user = await findOrCreateUser(db, { login: gate.login, twitchId: gate.twitchId, displayName: gate.displayName }, env);
  if (!user) return fin(false, `${who} log in once at eastcoin.vip so your ZCoins can be used here.`);
  const balance = await readBalance(env, gate.login);
  if (balance === null) return fin(false, `${who} couldn't read your ZCoins right now. Nothing was charged.`);
  if (balance < PRICE) return fin(false, `${who} ${verb} an emote is ${PRICE} ZC and you have ${balance.toLocaleString()}.`);

  const opKey = await retryKey(db, `${keyBase}${user.id}:${emoteId}`), opId = newId("op");
  const begun = await beginOperation(db, { id: opId, idempotencyKey: opKey, userId: user.id, marketId: null, pickId: null, type: "WAGER_DEBIT", amount: -PRICE });
  if (!begun.ok) return fin(false, `${who} that one's already going through.`);
  const debit = await moveBalance(env, gate.login, -PRICE);
  if (!debit.ok) { await finishOperation(db, opId, "FAILED", { error: debit.error }); return fin(false, `${who} couldn't take the ZCoins. Nothing was charged.`); }

  const r = await act();
  if (r.error && !(r.error === "NETWORK" && await check())) {
    const refund = await moveBalance(env, gate.login, PRICE);
    await finishOperation(db, opId, refund.ok ? "FAILED" : "NEEDS_RECONCILIATION", { balanceAfter: refund.ok ? refund.balance : null, error: `7tv:${String(r.error).slice(0, 60)}` });
    if (refund.ok) {
      await db.prepare(`INSERT INTO wallet_operations (id, idempotency_key, user_id, market_id, pick_id, type, amount, status, balance_after) VALUES (?, ?, ?, NULL, NULL, 'COMPENSATING_REFUND', ?, 'CONFIRMED', ?)`)
        .bind(newId("op"), `REFUND:${opKey}`, user.id, PRICE, refund.balance).run().catch(() => {});
      return fin(false, `${who} that didn't go through (${explain(r)}) Your ${PRICE} ZC is back.`);
    }
    return fin(false, `${who} that didn't go through, and your ${PRICE} ZC couldn't be returned automatically. An admin can see it and fix it.`);
  }
  await note(env, gate.login, logOp, emoteId, name, PRICE, opKey);
  await finishOperation(db, opId, "CONFIRMED", { balanceAfter: debit.balance });
  return fin(true, success(Number.isFinite(debit.balance) ? ` You have ${Number(debit.balance).toLocaleString()} left.` : ""));
}
