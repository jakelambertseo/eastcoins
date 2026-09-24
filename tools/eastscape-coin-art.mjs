/* EastScape: the Coin Flip's two faces —  node tools/eastscape-coin-art.mjs
   (the owner, 2026-09-21: "redesign the coin flip heads and tails. needs to look more like a real coin, keep the Z logo though like you
   did in the zcoin icon"). Both faces are ONE gold coin now: a dark edge, a raised rim with reeding, a bevel down into the field,
   and an EMBOSSED device lit from the top left: the Z on heads, a star in a wreath on tails. Drawn here, pixel by pixel, at 75 x 75
   so the casino window's 150 px coin is an exact 2x (a fractional scale smears pixel art). Bump CV in eastscape-casino.js after. */
import sharp from "sharp";
const N = 75, C = (N - 1) / 2, OUT = "v3/assets/img/glad/flat/casino/";
const GOLD = { edge: [74, 44, 8], dark: [150, 96, 20], mid: [214, 160, 40], lite: [246, 206, 86], shine: [255, 240, 170] };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const inPoly = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
const Z = [[20, 18], [55, 18], [55, 26], [33, 49], [55, 49], [55, 57], [20, 57], [20, 49], [42, 26], [20, 26]];
const star = (cx, cy, R, r, rot = -Math.PI / 2) => Array.from({ length: 10 }, (_, i) => { const a = rot + (i * Math.PI) / 5, q = i % 2 ? r : R; return [cx + Math.cos(a) * q, cy + Math.sin(a) * q]; });
const STAR = star(C, C - 1, 15, 6.4);
function wreath(x, y) {   // two sprays of leaves up the sides, meeting at the bottom: little ovals along an arc
  for (const side of [-1, 1]) for (let k = 0; k < 9; k++) { const a = Math.PI / 2 + side * (0.22 + k * 0.27), lx = C + Math.cos(a) * 23.5, ly = C + Math.sin(a) * 23.5, t = a + side * 0.9, dx = x - lx, dy = y - ly, u = dx * Math.cos(t) + dy * Math.sin(t), v = -dx * Math.sin(t) + dy * Math.cos(t); if ((u * u) / 16 + (v * v) / 4.2 <= 1) return true; }
  return false;
}
const FACES = { coin_heads: (x, y) => inPoly(Z, x, y), coin_tails: (x, y) => inPoly(STAR, x, y) || wreath(x, y) };
for (const [name, dev] of Object.entries(FACES)) {
  const px = Buffer.alloc(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = x - C, dy = y - C, r = Math.hypot(dx, dy), i = (y * N + x) * 4; if (r > 37) continue;
    const ang = Math.atan2(dy, dx), light = (-dx - dy) / (r || 1) / Math.SQRT2;   // +1 facing the light (top left), -1 away
    let col;
    if (r > 35.6) col = GOLD.edge;
    else if (r > 30.5) { col = mix(GOLD.mid, light > 0 ? GOLD.shine : GOLD.dark, Math.abs(light) * 0.75); if (Math.floor(((ang + Math.PI) / (2 * Math.PI)) * 60) % 2 === 0 && r > 32) col = mix(col, GOLD.dark, 0.45); }   // the rim, reeded
    else if (r > 29.2) col = mix(GOLD.dark, GOLD.edge, light > 0 ? 0.6 : 0.1);                        // the step down off the rim: dark where the light can't reach
    else if (r > 28) col = mix(GOLD.mid, GOLD.shine, light < 0 ? 0.7 : 0.1);                            // and the far wall of it catches the light
    else { col = mix(GOLD.mid, GOLD.lite, 0.25 + 0.25 * light * (r / 28)); const dn = [[-1, -1], [1, 1]].map(([ox, oy]) => dev(x + ox, y + oy));
      if (dev(x, y)) col = !dn[0] ? GOLD.shine : !dn[1] ? GOLD.dark : mix(GOLD.lite, GOLD.shine, 0.35);   // the raised device: lit top-left edge, shaded bottom-right edge
      else if (dev(x - 1, y - 1)) col = mix(col, GOLD.dark, 0.55); }                                      // and it throws a small shadow on the field
    px[i] = col[0]; px[i + 1] = col[1]; px[i + 2] = col[2]; px[i + 3] = 255;
  }
  for (const [sx, sy] of [[22, 12], [23, 11], [24, 11]]) { const i = (sy * N + sx) * 4; if (px[i + 3]) { px[i] = 255; px[i + 1] = 252; px[i + 2] = 225; } }   // one glint on the rim
  await sharp(px, { raw: { width: N, height: N, channels: 4 } }).png({ compressionLevel: 9, palette: true }).toFile(`${OUT}${name}.png`);
}
const S = "C:/Users/jake/AppData/Local/Temp/claude/C--Users-jake-code-eastcoins/42c7e72d-41ad-42db-a295-e80c1c85afef/scratchpad/coins_new.png";
await sharp({ create: { width: 330, height: 170, channels: 4, background: "#2a1a12" } }).composite([{ input: await sharp(`${OUT}coin_heads.png`).resize(150, 150, { kernel: "nearest" }).toBuffer(), left: 10, top: 10 }, { input: await sharp(`${OUT}coin_tails.png`).resize(150, 150, { kernel: "nearest" }).toBuffer(), left: 170, top: 10 }]).png().toFile(S).catch(() => {});
console.log("ok");
