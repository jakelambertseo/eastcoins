/* ============================================================
   When a game starts, the way chat should hear it

   "6:30 PM CT" is only right for today. A market opened a day early
   (CFB, fights) was announced as "closes 6:30 PM CT" when the game
   was tomorrow. So the day is said whenever it isn't today:

     today              6:30 PM CT
     tomorrow           tomorrow at 6:30 PM CT
     later              Sat, Sep 19 at 10:00 PM CT

   Days are Chicago calendar days, the site's clock for everything.
   ============================================================ */

const TZ = "America/Chicago";
const DAY_MS = 24 * 60 * 60 * 1000;

const dayKey = (date) => date.toLocaleDateString("en-CA", { timeZone: TZ });

export function whenCT(startsAt, now = Date.now()) {
  const when = new Date(startsAt);
  if (Number.isNaN(when.getTime())) return "";
  const time = when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }) + " CT";
  const day = dayKey(when);
  if (day === dayKey(new Date(now))) return time;
  if (day === dayKey(new Date(now + DAY_MS))) return `tomorrow at ${time}`;
  const date = when.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: TZ });
  return `${date} at ${time}`;
}
