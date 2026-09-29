/* TINKERING'S ART —  node tools/eastscape-tinker-art.mjs [--only name,name]
   (2026-09-28) Everything drawn for Tinkering's World Projects and gadgets, fetched from PixelLab by job id and written where the page
   looks for it. Re-running it rebuilds the lot from the same jobs; pass --only to redo some.

   THE BUILDINGS (flat/o_pj_*.png, o_dockruin etc.) are written as they come: 64 wide for a two-tile build, drawn from their feet.
   A build's stage 2 and 3 were made FROM its stage 1 (PixelLab image-to-image at strength 70-80), so each stage reads as the same
   machine growing rather than a new drawing. Lower strength than that and the change was invisible at game size; higher and it
   was a different object. Several generators insist on drawing a patch of ground under a building; the smokehouse's ruin keeps
   one, so GRASS is cut out of it here (green pixels only: the ruin itself is grey and brown).

   THE ICONS (items/tk_<gadget>.png, items/part_<part>.png) are generated at 64 and reduced to 32 with a real resample, not nearest:
   the same reason as the charcoal tool - nearest keeps a quarter of the pixels and loses the subject. */
import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";

const MAP = (id) => `https://api.pixellab.ai/mcp/map-objects/${id}/download`, IMG = (id) => `https://api.pixellab.ai/mcp/images/${id}/download`;
const BUILDS = {
  o_pj_sawmill0: MAP("a4b83ad3-8d19-474d-9ce9-3216737447f3"), o_pj_sawmill1: MAP("ab93b587-ae08-4810-bafc-2f6d66e51ca0"), o_pj_sawmill2: IMG("a2e31247-6f4b-45fb-b3a6-601cdce87192"), o_pj_sawmill3: IMG("6a0cc5fd-4c93-4187-9a95-dd0677769295"),
  o_pj_crusher0: MAP("9e59799d-9077-4a96-bd99-fda761fd91f5"), o_pj_crusher1: MAP("ae2498b5-d97b-4fea-8547-4270de9c3ab0"), o_pj_crusher2: IMG("d952bd26-9a70-41a3-9571-e078291beb83"), o_pj_crusher3: IMG("36ec2e4e-6e54-40ed-823b-9b38da7a2788"),
  o_pj_still0: MAP("c4e00990-4b7f-4aa1-9302-ac47410835bb"), o_pj_still1: MAP("7049458f-ef00-4673-9bb0-73b52a42f575"), o_pj_still2: IMG("7cf60636-b396-4b72-9592-3151c7c5afe5"), o_pj_still3: IMG("e9031ab1-eb43-419c-9c83-2042ea707cf9"),
  o_pj_press0: MAP("e07f8524-9724-4e3c-8b38-57b2e0b9d53c"), o_pj_press1: MAP("19c3a96c-1a43-485d-b612-cfae015a49b7"), o_pj_press2: IMG("ea5ab4c7-c099-40fb-a081-02f9658ff201"), o_pj_press3: IMG("6e13e37b-4d32-439c-b52f-a508b962d1e1"),
  o_pj_rod0: MAP("e812707f-a2bd-4b24-ad55-97e6812cd4b2"), o_pj_rod1: MAP("6ac45636-5785-41c1-8e1b-f3a9f61da0f8"), o_pj_rod2: IMG("81f8af07-96a9-4b77-8ac3-ac165000b7a4"), o_pj_rod3: IMG("bad87363-58eb-4ea6-a1d1-b645fd20cc10"),
  o_pj_crane0: MAP("b59e656a-5511-4962-8a96-531b8107f865"), o_pj_crane1: MAP("2198c2c1-0ac5-4f2d-804b-4ca415400637"), o_pj_crane2: IMG("e2567af4-60ca-4e02-bb2f-e9a45fae82e4"), o_pj_crane3: IMG("b1240de9-97d9-4fc5-a141-cda10568bc07"),
  o_pj_wheel0: MAP("7c9b78b1-1951-45b3-ab94-b08006133906"), o_pj_wheel1: MAP("c14b775f-10c7-43b6-8f24-95974bb9358b"), o_pj_wheel2: IMG("da780802-a8d7-4ac3-bde1-1f4e7b2c1459"), o_pj_wheel3: IMG("ae3a5375-147c-45c0-92f1-beb034d4f3f1"),
  o_pj_smoke0: MAP("355a0580-be1c-4d25-9a7c-d9f0b780d035"), o_pj_smoke1: MAP("a2ec37cd-a502-45d1-b9fb-da0de8b306b1"), o_pj_smoke2: IMG("86cd644b-10cf-4723-8714-241a72415c37"), o_pj_smoke3: IMG("afe7062b-88c2-4972-a94e-a0217ca73bcc"),
  o_pj_camp0: MAP("960f2698-ec2c-46a4-9d1f-c8d48c3ed3cb"), o_pj_camp1: MAP("da92abee-2b1d-4567-9a0b-1feecbcb172b"), o_pj_camp2: IMG("1634fa6f-3048-40f1-8877-e1f93adb0e65"), o_pj_camp3: IMG("17e2b919-2a4d-4aa2-b8d2-c2bde4cca219"),
  o_pj_cannon2: IMG("d8652291-87ad-4770-9925-432548baf0f0"), o_pj_cannon3: IMG("eff7634a-24f7-4b20-bd99-579550ab6075"),
  o_pj_boiler2: IMG("c42e80a5-5153-4900-92ab-60f852127f57"), o_pj_boiler3: IMG("59cfedaf-7ae3-4dd2-b2b8-6bd2fa2b1ae5"),
  o_pj_plaque: MAP("85f49def-689f-4fce-91c1-3225ff6c4a46"), o_pj_dockshed: MAP("aac710a5-ed19-4238-9185-8ce5799a10b5"), o_pj_docklamp: MAP("0cd5d346-7491-49f3-a597-0bb3df5f5848")
};
const ICONS = {
  tk_confetti: "157ee2fe-408f-4f09-b789-441ba7b51ad7", tk_baitbox: "0e3873b1-49a4-4efd-8b1d-7aa1d2bcf57f", tk_medkit: "3b0e0220-84e6-49eb-b4b8-262dc0f90ded", tk_whetstone: "7d3e76bf-d704-4a7f-a336-e7350f2a7f83",
  tk_scope: "901f5caf-b724-4dc3-b36e-2d6c6fb59c0d", tk_arccoil: "47c4c7c8-1236-45ec-964b-d69bd53bd5e4", tk_lockpick: "ef0edfc0-029a-4fc3-92c1-b3354b1b56fc", tk_cooker: "2b30fb45-bcd6-4310-a3d3-33fea7f95f5a",
  tk_bellows: "dabd5cc1-ef10-487f-b4d8-aff6def5f3e1", tk_distiller: "99a6bb4f-45a7-45d6-9cc2-15e1afc66b1b", tk_featherjig: "c1076a18-d63d-42ab-9fed-33d47731ac94", tk_handpress: "155457dd-38cd-4058-9b02-85bc54ddf735",
  tk_magnifier: "2b977344-0d58-47c6-ba50-e9b7f3e21c15", tk_humidifier: "8a59548b-f2ca-407c-adef-e96b330b5371", tk_lantern: "b85c6bff-7e48-4c82-9a60-11e0e3284431", tk_grapple: "cfc048c3-1e83-4650-a053-a606d485d435",
  tk_pettoy: "48e1144b-fd09-49cf-88f7-414816dd58b1", tk_banner: "ea5b7e96-be88-4a7c-9f3e-d946ced5f4c7", tk_auger: "e672c843-15e2-4f47-a7ca-35622cdc4d08", tk_chainsaw: "9cdc8abc-8b20-46a5-a63f-7362ab64ba4a",
  tk_autoreel: "79a98333-a5f2-4d18-bca4-c75e78a86468", tk_bomb: "160948db-abef-49d0-8597-97a7fc419ed9",
  part_scrap: "45f5c96c-11bc-4a5b-9e4d-270aea765741", part_gears: "1c131959-ad3f-4f17-a62d-eb496461e984", part_sparks: "6e821777-8112-47f8-b975-d7f902c71034", part_relic: "ee5aa9b7-c0f3-41d8-943c-5cc188086ce9"
};
const GRASS_CUT = new Set(["o_pj_smoke0"]);
const only = (() => { const i = process.argv.indexOf("--only"); return i > 0 ? new Set(process.argv[i + 1].split(",")) : null; })();
const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url} ${r.status}`); return Buffer.from(await r.arrayBuffer()); };
const flat = "v3/assets/img/glad/flat/", items = `${flat}items/`;
await mkdir(items, { recursive: true });
for (const [name, url] of Object.entries(BUILDS)) {
  if (only && !only.has(name)) continue;
  let buf = await get(url);
  if (GRASS_CUT.has(name)) {
    const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < data.length; i += 4) { const [r, g, b] = [data[i], data[i + 1], data[i + 2]]; if (g > r + 12 && g > b + 8) data[i + 3] = 0; }   /* green pixels: the grass patch under it */
    buf = await sharp(data, { raw: info }).png().toBuffer();
  }
  await writeFile(`${flat}${name}.png`, buf);   /* as drawn: the page anchors a sprite by its own content (cx, foot), so no trimming or padding */
  console.log(`${name}.png`);
}
for (const [name, id] of Object.entries(ICONS)) {
  if (only && !only.has(name)) continue;
  const buf = await get(IMG(id));
  await sharp(buf).trim({ threshold: 0 }).resize(30, 30, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" }).extend({ top: 1, bottom: 1, left: 1, right: 1, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${items}${name}.png`);
  console.log(`items/${name}.png`);
}

/* THE BUILDER'S PINS (items/pin_<id>.png): a brass badge with that build's finished picture in it, made here from the art above, so a
   pin always matches its build and needs no generation of its own. 32x32 like every item icon. */
const PIN_ART = { dock: "o_pj_dockshed", cannon: "o_pj_cannon3", table: "o_pj_boiler3", sawmill: "o_pj_sawmill3", crusher: "o_pj_crusher3", still: "o_pj_still3", press: "o_pj_press3", rod: "o_pj_rod3", crane: "o_pj_crane3", wheel: "o_pj_wheel3", smoke: "o_pj_smoke3", camp: "o_pj_camp3" };
const badge = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" shape-rendering="crispEdges">
  <circle cx="16" cy="16" r="15" fill="#2a1a08"/><circle cx="16" cy="16" r="14" fill="#c8963a"/><circle cx="16" cy="16" r="12" fill="#f0c860"/>
  <circle cx="16" cy="16" r="11" fill="#3a2a1a"/><circle cx="16" cy="16" r="10" fill="#4a3a26"/></svg>`);
for (const [id, art] of Object.entries(PIN_ART)) {
  if (only && !only.has(`pin_${id}`)) continue;
  const inner = await sharp(`${flat}${art}.png`).trim({ threshold: 0 }).resize(19, 19, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" }).png().toBuffer();
  await sharp(badge).composite([{ input: inner, left: 6, top: 6 }]).png().toFile(`${items}pin_${id}.png`);
  console.log(`items/pin_${id}.png`);
}
