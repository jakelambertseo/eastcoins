// /picks (and /picks.html, which Cloudflare forwards here) → the current Picks page.
import { legacyTo } from "./_legacy.js";
export const onRequest = legacyTo("/?view=picks");
