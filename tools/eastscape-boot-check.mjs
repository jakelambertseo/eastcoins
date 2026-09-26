/* Does the page BOOT? —  node tools/eastscape-boot-check.mjs [path-to-eastscape.html]
   (2026-09-27) Written the morning after a one-line page change threw at start-up and left every player on a black screen
   at "Connecting…": the quest engine had changed shape, the wiki's item index still read the old one, and it ran at boot. The
   ship script parsed the page (fine) and the rules loaded (fine); nothing ever RAN the page. This does: the page's one inline
   module is executed under happy-dom with the rules files imported from disk, the canvas, sockets, fetch, audio and images
   stubbed, and anything thrown at module level - or reported to window.onerror inside the first second - fails the check.
   It is deliberately not a test of what the page draws: the stubs return nothing. It is the difference between a page that
   starts and one that does not. The ship script runs it on the page it is about to write. */
import fs from "fs"; import path from "path"; import { pathToFileURL } from "url";
import { Window } from "happy-dom";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")), "..");
const file = process.argv[2] || path.join(ROOT, "eastscape.html");
const html = fs.readFileSync(file, "utf8");
const mod = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!mod) { console.log("  !! no module script in the page"); process.exit(1); }

/* the page's imports name the served URLs; on disk they are this repo's own rules files (the same exports the shipped ones have) */
const local = (u) => pathToFileURL(path.join(ROOT, u.replace(/\?.*$/, ""))).href;
const code = mod[1].replace(/(["'`])(\/v3\/assets\/js\/[^"'`]+?)\1/g, (m, q, u) => `${q}${local(u)}${q}`);

const win = new Window({ url: "https://eastcoin.vip/eastscape", settings: { disableJavaScriptEvaluation: true, disableCSSFileLoading: true, disableComputedStyleRendering: true } });
const doc = win.document; doc.write(html.replace(/<script type="module">[\s\S]*?<\/script>/, ""));
/* what the page reaches for at start that a DOM without a screen does not have */
const noop = () => {}, fn = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : fn()), apply: () => fn() });
const ctx2d = () => new Proxy({}, { get: (t, k) => (["canvas"].includes(k) ? doc.createElement("canvas") : typeof k === "symbol" ? undefined : (["getImageData", "measureText", "createRadialGradient", "createLinearGradient", "createPattern"].includes(k) ? () => ({ data: new Uint8ClampedArray(4), width: 1, addColorStop: noop }) : fn())), set: () => true });
win.HTMLCanvasElement.prototype.getContext = () => ctx2d();
win.HTMLCanvasElement.prototype.toDataURL = () => "data:,";
class FakeSocket { constructor() { this.readyState = 0; setTimeout(() => this.onerror?.(new Error("no network in the boot check")), 50); } send() {} close() {} addEventListener() {} }
class FakeImage { constructor() { this.complete = false; this.naturalWidth = 0; } set src(v) { this._src = v; } get src() { return this._src; } addEventListener() {} }
class FakeAudio { constructor() {} play() { return Promise.resolve(); } pause() {} addEventListener() {} }
const G = globalThis;
/* Node already has read-only globals of some of these names (navigator, crypto), so each is defined rather than assigned */
const put = (k, v) => { try { Object.defineProperty(G, k, { value: v, configurable: true, writable: true }); } catch (e) { console.log(`  (could not define ${k}: ${e.message})`); } };
for (const [k, v] of Object.entries({ window: win, document: doc, navigator: win.navigator, location: win.location, localStorage: win.localStorage, sessionStorage: win.sessionStorage, history: win.history, screen: win.screen,
  HTMLElement: win.HTMLElement, HTMLCanvasElement: win.HTMLCanvasElement, Element: win.Element, Node: win.Node, Event: win.Event, CustomEvent: win.CustomEvent, KeyboardEvent: win.KeyboardEvent, MouseEvent: win.MouseEvent, DOMParser: win.DOMParser,
  Image: FakeImage, Audio: FakeAudio, WebSocket: FakeSocket, AudioContext: class { constructor() { this.state = "suspended"; this.destination = {}; this.currentTime = 0; this.sampleRate = 22050; } createGain() { return fn(); } createBuffer() { return fn(); } createBufferSource() { return fn(); } resume() { return Promise.resolve(); } },
  requestAnimationFrame: (f) => setTimeout(() => f(performance.now()), 16), cancelAnimationFrame: clearTimeout, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800,
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop }), ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} }, MutationObserver: win.MutationObserver,
  getComputedStyle: (el) => win.getComputedStyle(el), scrollTo: noop, alert: noop, confirm: () => false, open: () => null, addEventListener: (...a) => win.addEventListener(...a), removeEventListener: (...a) => win.removeEventListener(...a), dispatchEvent: (e) => win.dispatchEvent(e),
})) put(k, v);
G.webkitAudioContext = G.AudioContext;
G.fetch = async () => ({ ok: false, status: 503, json: async () => ({}), text: async () => "", arrayBuffer: async () => new ArrayBuffer(0), headers: { get: () => null } });
const errors = [];
win.addEventListener("error", (e) => errors.push(e.error?.stack || e.message || String(e)));
process.on("uncaughtException", (e) => errors.push(e.stack || String(e)));
process.on("unhandledRejection", (e) => { const s = e?.stack || String(e); if (!/boot check|no network/.test(s)) errors.push(s); });

const tmp = path.join(ROOT, "tools", `.boot-check-${process.pid}.mjs`); fs.writeFileSync(tmp, code);
let threw = null;
try { await import(pathToFileURL(tmp).href); } catch (e) { threw = e; } finally { fs.rmSync(tmp, { force: true }); }
await new Promise((r) => setTimeout(r, 1200));   /* the first second of timers and animation frames */
const all = [...(threw ? [threw.stack || String(threw)] : []), ...errors].filter((s) => !/no network in the boot check/.test(s));
if (all.length) { console.log(`  !! the page does not boot: ${all.length} error(s)`); for (const s of all.slice(0, 5)) console.log("     " + String(s).split("\n").slice(0, 4).join("\n     ")); process.exit(1); }
console.log(`  the page boots (module ran, ${Math.round(code.length / 1024)} KB, no errors in the first second)`);
await win.happyDOM.close();
process.exit(0);
