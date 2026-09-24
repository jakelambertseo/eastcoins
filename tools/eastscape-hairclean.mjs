/* EastScape: stray pieces in the hair layers —  node tools/eastscape-hairclean.mjs
   A hair part (ph_<hair>_<dir>.png) is cut from a blue-haired donor by colour, so a blue blob anywhere on the donor came too:
   the BEARD carried a piece of its donor's jeans at hip height in every facing, and everybody with a beard wore a hair-coloured
   smudge on their hip (the owner, 2026-09-21: "what is this yellow looking thing"). Hair starts on the head, so any connected
   piece that lies wholly below the shoulders (row 40 of 68) is not hair and is removed. Long hair and ponytails survive: they
   are joined to the head. Run it after tools/eastscape-lookbuild.mjs, then tools/eastscape-pack.mjs. */
import sharp from "sharp"; import fs from "fs";
const F = "v3/assets/img/glad/flat/", LINE = 40; let fixed = 0;
for (const f of fs.readdirSync(F).filter((x) => /^ph_.*\.png$/.test(x))) {
  const { data, info } = await sharp(F + f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), W = info.width, H = info.height, seen = new Uint8Array(W * H); let cut = 0;
  for (let n = 0; n < W * H; n++) { if (!data[n * 4 + 3] || seen[n]) continue; const blob = [n]; seen[n] = 1; let top = H;
    for (let q = 0; q < blob.length; q++) { const c = blob[q], x = c % W, y = (c / W) | 0; top = Math.min(top, y); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const X = x + dx, Y = y + dy, m = Y * W + X; if (X >= 0 && Y >= 0 && X < W && Y < H && data[m * 4 + 3] && !seen[m]) { seen[m] = 1; blob.push(m); } } }
    if (top >= LINE) { for (const c of blob) data[c * 4] = data[c * 4 + 1] = data[c * 4 + 2] = data[c * 4 + 3] = 0; cut += blob.length; } }
  if (cut) { await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(F + f + ".tmp"); fs.renameSync(F + f + ".tmp", F + f); fixed++; console.log(`${f}: removed ${cut} stray pixels`); }
}
console.log(fixed ? `${fixed} files cleaned` : "nothing stray");
