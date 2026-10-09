/* Blockshot's maps: each one a list of boxes (2026-10-08, the owner: "make the maps larger with fewer blocks/things that break movement,
   since they can slide hop its important they have freedom of movement").

   What that rule means here: wide open floors, RAMPS instead of stairs (a slide goes up a ramp and dies on a step), long sightlines
   along the lanes, big cover you go round rather than crates you trip on, catwalks and roofs reached by ramps and JUMP PADS, and the
   small things kept to the edges. A box is { c: [x, y, z], h: [half x, half y, half z], tex, col, rx?, ry? }. `ramp()` lays a slope
   between two ends and gets the rotation sign right (the first build had it backwards), and the builder tiles every texture to world
   units. Pads are { x, z, up, fwd? }: stand on one and you fly. */

export const C = { GROUND: 0x5e8a4a, SAND: 0xd9c38c, STONE: 0x8d939c, BRICK: 0xb85c3a, TEAL: 0x3aa8a0, CRATE: 0xa8713a, DARK: 0x3a3d48, WHITE: 0xe8e8e4, BLUE: 0x4a78b0, RUST: 0x8a4a2a, PINK: 0xd05a8a };

function build(size) {
  const boxes = [], pads = [];
  const box = (c, h, tex, col, extra = {}) => { boxes.push({ c, h, tex, col, ...extra }); return boxes[boxes.length - 1]; };
  /** A slope `w` wide from (x0,z0) at height y0 to (x1,z1) at y1, as one thin box turned to lie on the line. */
  const ramp = (x0, z0, y0, x1, z1, y1, w, tex = "concrete", col = C.STONE) => {
    const dx = x1 - x0, dz = z1 - z0, run = Math.hypot(dx, dz), rise = y1 - y0, len = Math.hypot(run, rise);
    const ry = Math.atan2(dx, dz);               // turn so the box's local -z..+z runs along the line (local +z points from end 0 to end 1)
    const rx = -Math.atan2(rise, run);           // tilt so the +z end is the high one (rotation about x by -a lifts +z)
    return box([(x0 + x1) / 2, (y0 + y1) / 2 - 0.1, (z0 + z1) / 2], [w / 2, 0.1, len / 2], tex, col, { rx, ry });
  };
  const pad = (x, z, up = 16, fwd = null) => { pads.push({ x, z, up, fwd }); box([x, 0.08, z], [1.1, 0.08, 1.1], "pad", C.DARK); };
  const walls = (s, h = 6) => { for (const [x, z, hx, hz] of [[0, s + 0.5, s + 1, 0.5], [0, -s - 0.5, s + 1, 0.5], [s + 0.5, 0, 0.5, s], [-s - 0.5, 0, 0.5, s]]) box([x, h / 2, z], [hx, h / 2, hz], "brick", C.STONE); };
  return { boxes, pads, box, ramp, pad, walls, size };
}

/* ================================================================== THE LOT: a big open plaza, a raised centre, four roofs with long ramps and bridges */
function lot() {
  const M = build(40), { box, ramp, pad, walls } = M;
  box([0, -0.5, 0], [41, 0.5, 41], "grass", C.GROUND); walls(40);
  // the centre: a raised deck 18 wide, 3 high, a wide ramp on every side so a slide carries you up, and a tower on it
  box([0, 1.5, 0], [9, 1.5, 9], "concrete", C.SAND);
  for (const [x0, z0, x1, z1] of [[0, 20, 0, 9], [0, -20, 0, -9], [20, 0, 9, 0], [-20, 0, -9, 0]]) ramp(x0, z0, 0, x1, z1, 3, 7, "concrete", C.SAND);
  box([0, 5.2, 0], [3, 2.2, 3], "metal", C.TEAL);                              // the tower, roof at 7.4
  ramp(-8.5, -3, 3, -3, -3, 7.4, 2.5, "metal", C.TEAL);                        // its ramp, off the deck's west edge
  box([0, 7.7, 0], [0.9, 0.3, 0.9], "crate", C.CRATE);                         // one crate to peek over
  // four corner roofs at 6, each with a long gentle ramp from the lane and a bridge to the next corner along the edge
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    box([sx * 30, 3, sz * 30], [7, 3, 7], "brick", sx * sz > 0 ? C.BRICK : C.BLUE);
    ramp(sx * 30, sz * 10, 0, sx * 30, sz * 23, 6, 5, "concrete", C.STONE);    // up from the lane toward the corner
    box([sx * 30, 6.5, sz * 30], [1.2, 0.5, 1.2], "crate", C.CRATE);            // a crate on each roof
  }
  for (const s of [-1, 1]) { box([0, 5.8, s * 36], [23, 0.2, 1.5], "metal", C.DARK); box([s * 36, 5.8, 0], [1.5, 0.2, 23], "metal", C.DARK); }   // the bridges, roof to roof
  for (const s of [-1, 1]) for (const z of [-36, 36]) box([s * 12, 6.3, z], [0.5, 0.3, 0.5], "hazard", 0); // rails you can hop, so a bridge isn't a straight shooting gallery
  // big cover in the lanes: walls you run round, never trip on
  for (const [x, z, hx, hz] of [[16, 0, 0.5, 4], [-16, 0, 0.5, 4], [0, 16, 4, 0.5], [0, -16, 4, 0.5], [22, 22, 2.5, 0.5], [-22, -22, 2.5, 0.5], [22, -22, 0.5, 2.5], [-22, 22, 0.5, 2.5]]) box([x, 1.25, z], [hx, 1.25, hz], "concrete", C.WHITE);
  // jump pads: mid-lane, firing you onto the centre deck; and one on each corner ramp's foot up to the roof
  for (const [x, z] of [[0, 27], [0, -27], [27, 0], [-27, 0]]) pad(x, z, 15, { x: -Math.sign(x) * 9, z: -Math.sign(z) * 9 });
  M.spawns = [[0, 1, 36], [0, 1, -36], [36, 1, 0], [-36, 1, 0], [30, 7, 30], [-30, 7, -30], [30, 7, -30], [-30, 7, 30], [20, 1, 20], [-20, 1, -20], [20, 1, -20], [-20, 1, 20]];
  M.waypoints = [...M.spawns.map((s) => [s[0], s[2]]), [0, 0], [0, 14], [0, -14], [14, 0], [-14, 0], [0, 36], [0, -36], [36, 0], [-36, 0], [24, 36], [-24, 36], [24, -36], [-24, -36], [36, 24], [36, -24], [-36, 24], [-36, -24], [8, 8], [-8, -8], [8, -8], [-8, 8]];
  M.name = "The Lot"; M.blurb = "An open plaza with a raised centre, four roofs, long ramps and bridges. Slide lanes everywhere."; M.sky = 0x8fc4ef; M.fog = [70, 160];
  return M;
}

/* ================================================================== THE DOCKS: three long lanes, two warehouses, a high catwalk, containers at the ends */
function docks() {
  const M = build(44), { box, ramp, pad, walls } = M;
  box([0, -0.5, 0], [45, 0.5, 45], "concrete", C.STONE); walls(44, 7);
  // two warehouses either side of the centre lane, roofs at 5, ramps at both ends so you can slide straight up and over
  for (const s of [-1, 1]) {
    box([s * 16, 2.5, 0], [6, 2.5, 14], "metal", s > 0 ? C.RUST : C.BLUE);
    ramp(s * 16, s > 0 ? 28 : -28, 0, s * 16, s > 0 ? 14 : -14, 5, 6, "metal", C.DARK);
    ramp(s * 16, s > 0 ? -28 : 28, 0, s * 16, s > 0 ? -14 : 14, 5, 6, "metal", C.DARK);
    box([s * 16, 5.6, 0], [0.6, 0.6, 2], "crate", C.CRATE);                    // a crate on each roof
  }
  // the catwalk: a high bridge across the middle between the roofs, with a ramp up from each warehouse roof
  box([0, 7.8, 0], [10.5, 0.2, 1.6], "metal", C.DARK);
  for (const s of [-1, 1]) ramp(s * 16, -6, 5, s * 10.5, -1, 8, 2.4, "metal", C.DARK);
  // the water's edge: a long pier along the east and west walls, raised 2, with a ramp at each end
  for (const s of [-1, 1]) { box([s * 40, 1, 0], [4, 1, 30], "crate", C.CRATE); ramp(s * 40, s > 0 ? 38 : -38, 0, s * 40, s > 0 ? 30 : -30, 2, 7, "crate", C.CRATE); ramp(s * 40, s > 0 ? -38 : 38, 0, s * 40, s > 0 ? -30 : -30 + 0, 2, 7, "crate", C.CRATE); }
  // container stacks at the north and south ends: big blocks to fight round
  for (const [x, z, col] of [[-8, 36, C.PINK], [8, 36, C.TEAL], [0, 38, C.BLUE], [-8, -36, C.BLUE], [8, -36, C.PINK], [0, -38, C.TEAL]]) box([x, 1.3, z], [3, 1.3, 1.3], "metal", col);
  box([0, 3.9, 38], [3, 1.3, 1.3], "metal", C.RUST); box([0, 3.9, -38], [3, 1.3, 1.3], "metal", C.RUST);   // one stacked on each end
  // cover in the centre lane
  for (const z of [-10, 10]) box([0, 1.1, z], [3.5, 1.1, 0.5], "concrete", C.WHITE);
  // pads: from the centre lane up onto the catwalk, and from each pier onto its warehouse roof
  pad(0, 20, 17, { x: 0, z: -6 }); pad(0, -20, 17, { x: 0, z: 6 });
  for (const s of [-1, 1]) pad(s * 30, 0, 14, { x: -s * 5, z: 0 });
  M.spawns = [[0, 1, 30], [0, 1, -30], [40, 3, 20], [-40, 3, -20], [40, 3, -20], [-40, 3, 20], [16, 6, 0], [-16, 6, 0], [-30, 1, 30], [30, 1, -30], [0, 9, 0], [8, 1, 0]];
  M.waypoints = [...M.spawns.map((s) => [s[0], s[2]]), [0, 0], [0, 15], [0, -15], [8, 20], [-8, -20], [30, 10], [-30, -10], [30, -10], [-30, 10], [40, 0], [-40, 0], [16, 22], [-16, -22], [16, -22], [-16, 22], [-8, 30], [8, -30]];
  M.name = "The Docks"; M.blurb = "Three long lanes, two warehouses with ramps at both ends, a high catwalk, piers along the water."; M.sky = 0xf0c8a0; M.fog = [60, 150];
  return M;
}

export const MAPS = { lot, docks };
export const MAP_LIST = Object.keys(MAPS);
