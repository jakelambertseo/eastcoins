/* ============================================================
   EastCoin Picks — wallet token health

   Answers "can this server actually move ZCoins, and for whom?"
   without moving any. It calls StreamElements' read-only
   channels/me, which requires the token, so a missing, empty,
   malformed, expired or revoked token is distinguishable from a
   working one.

   It also checks the token belongs to the channel we intend to
   write to. A valid token for the WRONG channel would authenticate
   happily and then debit the wrong people's points, which is the
   kind of mistake that is very hard to walk back.

   Admin-only: token status is not something to expose publicly.
   The token itself is never returned, logged or echoed.
   ============================================================ */

import { ADMIN_ALLOWLIST, getSessionUser, json, fail } from "./_lib.js";

const SE_API = "https://api.streamelements.com/kappa/v2";

export async function onRequestGet(context) {
  const db = context.env.PICKS_DB;
  if (!db) return fail("DB_UNAVAILABLE", "Picks database is not connected.", 503);

  const user = await getSessionUser(db, context.request);
  if (!user || !ADMIN_ALLOWLIST.has(user.login)) {
    return fail("NOT_ADMIN", "Only Picks admins can check wallet health.", 403);
  }

  const jwt = String(context.env.STREAMELEMENTS_JWT || "").trim();
  const channelId = String(context.env.STREAMELEMENTS_CHANNEL_ID || "").trim();

  if (!jwt) {
    return json({
      ok: false,
      status: "no_token",
      tokenPresent: false,
      message:
        "STREAMELEMENTS_JWT is not set for this deployment. Note that a Pages " +
        "secret only reaches the site after a new deployment."
    });
  }

  if (!channelId) {
    return json({
      ok: false,
      status: "no_channel",
      tokenPresent: true,
      message: "STREAMELEMENTS_CHANNEL_ID is not set, so there is no channel to write to."
    });
  }

  let response;
  try {
    response = await fetch(`${SE_API}/channels/me`, {
      headers: { Authorization: `Bearer ${jwt}` }
    });
  } catch {
    return json({
      ok: false,
      status: "unreachable",
      tokenPresent: true,
      message: "Couldn't reach StreamElements to verify the token."
    }, 502);
  }

  if (response.status === 401 || response.status === 403) {
    return json({
      ok: false,
      status: "rejected",
      tokenPresent: true,
      httpStatus: response.status,
      message:
        "StreamElements rejected the token. It is empty, malformed, expired, " +
        "or has been regenerated in the dashboard."
    });
  }

  if (!response.ok) {
    return json({
      ok: false,
      status: "error",
      tokenPresent: true,
      httpStatus: response.status,
      message: "StreamElements returned an unexpected status."
    });
  }

  const payload = await response.json().catch(() => null);
  const tokenChannelId = String(payload?._id || "");
  const tokenChannelName = String(payload?.displayName || payload?.username || "");
  const matches = tokenChannelId === channelId;

  return json({
    ok: matches,
    status: matches ? "ready" : "wrong_channel",
    tokenPresent: true,
    channel: {
      configured: channelId,
      tokenBelongsTo: tokenChannelId,
      name: tokenChannelName,
      matches
    },
    message: matches
      ? `Token is valid for ${tokenChannelName || "this channel"}. ZCoin transfers are ready.`
      : "The token is valid but belongs to a different channel than the one configured. " +
        "Writing with it would move the wrong channel's points."
  });
}
