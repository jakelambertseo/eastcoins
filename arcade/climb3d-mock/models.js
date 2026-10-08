/* The Climb's models: KayKit Dungeon Remastered (walls, floors, torches, props), Kenney Platformer Kit (later zones' moving parts) and the
   Tycoon's Kenney Mini Characters, all CC0 (licences beside them). Loaded once before the tower is built; a model that fails comes
   back null and the game draws a plain box instead.
   get()      a static clone, scaled and sat on the ground;
   instanced() hundreds of copies of one model in one draw call per material (the tower's walls);
   char()     a rigged character with its own animation mixer. */
import * as THREE from "three";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/SkeletonUtils.js";

const D = "dungeon/";
export const FILES = {
  wall: D + "wall.glb", wallArched: D + "wall_arched.glb", wallWindow: D + "wall_window_closed.glb", wallCracked: D + "wall_cracked.glb",
  pillar: D + "pillar.glb", column: D + "column.glb",
  tileSmall: D + "floor_tile_small.glb", tileLarge: D + "floor_tile_large.glb", woodSmall: D + "floor_wood_small.glb", grate: D + "floor_tile_big_grate.glb",
  torch: D + "torch_mounted.glb", barrel: D + "barrel_large.glb", barrels: D + "barrel_small_stack.glb", box: D + "box_large.glb",
  crates: D + "crates_stacked.glb", keg: D + "keg.glb", candles: D + "candle_triple.glb", bannerRed: D + "banner_shield_red.glb",
  bannerBrown: D + "banner_patternA_brown.glb", rubble: D + "rubble_half.glb", chest: D + "chest_gold.glb", trunk: D + "trunk_large_A.glb",
  coins: D + "coin_stack_large.glb", spring: "platformer/spring.glb",
  // the characters live with the Tycoon, so both games share one set
  ...Object.fromEntries(["male-a", "male-c", "male-e", "female-b", "female-d", "female-f"].map((k) => [`char-${k}`, `../../tycoon3d-mock/models/chars/character-${k}.glb`]))
};
const base = new URL("./models/", import.meta.url);
const cache = {};
export async function loadAll(onProgress) {
  const loader = new GLTFLoader(); let done = 0; const names = Object.keys(FILES);
  await Promise.all(names.map(async (k) => {
    try { cache[k] = await loader.loadAsync(new URL(FILES[k], base).href); }
    catch (e) { console.warn("model failed", k, e); cache[k] = null; }
    onProgress?.(++done / names.length);
  }));
  for (const g of Object.values(cache)) g?.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
}
export const has = (k) => Boolean(cache[k]);

/** A static model fitted to `size` (its biggest side), `height`, or an exact `box` [x, y, z]; sat on y = 0 and centred on x/z. */
export function get(k, { size, height, box, emissive } = {}) {
  const g = cache[k]; if (!g) return null;
  const m = g.scene.clone(true);
  if (emissive != null) m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(emissive); o.material.emissiveIntensity = 0.6; } });
  fit(m, { size, height, box });
  const wrap = new THREE.Group(); wrap.add(m); return wrap;
}
function fit(m, { size, height, box }) {
  const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const k = box ? new THREE.Vector3(box[0] / s.x, box[1] / s.y, box[2] / s.z)
    : new THREE.Vector3().setScalar(height ? height / s.y : size ? size / Math.max(s.x, s.y, s.z) : 1);
  m.scale.multiply(k);
  m.position.set(-c.x * k.x, -b.min.y * k.y, -c.z * k.z);
}

/** Many copies of one model, one InstancedMesh per part. `place` is a list of Matrix4s (where each copy's ground-centre goes). */
export function instanced(k, place, { box, size } = {}) {
  const g = cache[k]; if (!g || !place.length) return null;
  const proto = g.scene.clone(true); fit(proto, { box, size });
  const holder = new THREE.Group(); holder.add(proto); holder.updateMatrixWorld(true);
  const out = new THREE.Group(), part = new THREE.Matrix4();
  proto.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, place.length);
    im.castShadow = false; im.receiveShadow = true;
    place.forEach((M, i) => { part.multiplyMatrices(M, o.matrixWorld); im.setMatrixAt(i, part); });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); out.add(im);
  });
  return out;
}

/** A rigged character with its animations: play("walk") cross-fades; update(dt) each frame. */
export function char(k, height = 1.75) {
  const g = cache[k]; if (!g) return null;
  const m = SkeletonUtils.clone(g.scene);
  const b = new THREE.Box3().setFromObject(m), s = b.getSize(new THREE.Vector3()), kk = height / s.y;
  m.scale.setScalar(kk); m.position.y = -b.min.y * kk;
  const mixer = new THREE.AnimationMixer(m), acts = {};
  for (const clip of g.animations) acts[clip.name] = mixer.clipAction(clip);
  let cur = null;
  const play = (name, fade = 0.15) => { const a = acts[name] || acts.idle; if (!a || a === cur) return; a.reset().fadeIn(fade).play(); if (cur) cur.fadeOut(fade); cur = a; };
  play("idle", 0);
  const wrap = new THREE.Group(); wrap.add(m);
  return { obj: wrap, model: m, play, update: (dt) => mixer.update(dt), names: Object.keys(acts) };
}
