// /login (and /login.html), the V1 sign-in page → the home page, where
// the nav's Login with Twitch button starts the real sign-in.
import { legacyTo } from "./_legacy.js";
export const onRequest = legacyTo("/");
