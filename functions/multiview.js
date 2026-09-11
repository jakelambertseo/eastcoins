// /multiview (and /multiview.html) → the current MultiView. A shared
// layout's ?m= token rides along and is restored there.
import { legacyTo } from "./_legacy.js";
export const onRequest = legacyTo("/?view=multiview");
