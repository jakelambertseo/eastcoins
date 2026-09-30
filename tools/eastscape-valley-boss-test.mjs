/* THE PRIMEVAL VALLEY'S BOSSES, FOUGHT —  node tools/eastscape-valley-boss-test.mjs
   (2026-09-30, the owner: "put old rex and mammoth up on plateus so theyre only reachable by arch", "these bosses need after reports when beaten,
   just to confirm. and double check that multiple archers can tag/damage them at once"). The real World, storage stubbed, the real swing
   (doAction), no monster swinging back. For Old Rex on his plateau in the Lair and the Matriarch on hers in the Lowlands:
     - three archers at once (Archery 99, 60 and 40, the last let in by the Valley's Archery-40 gate) all land damage;
     - a sword cannot reach the ledge at all, and a wand in range does nothing to it;
     - the kill is SHARED: every archer who did his share is paid (tickets), and every one of them gets the after report. */
globalThis.__ES_OPEN_ALL = true;
const G = await import("../v3/assets/js/eastscape-shared.js");
const { createClosedScenes } = await import("../v3/assets/js/eastscape-closed.js"); Object.assign(G.SCENES, createClosedScenes(G, G._MAP));
const { World } = await import("../eastscape-worker/src/index.js");
let bad = 0;
const is = (got, want, what) => { if (JSON.stringify(got) === JSON.stringify(want)) console.log(`  ${what}: ${JSON.stringify(got)}`); else { console.log(`  !! ${what}: got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`); bad++; } };
const ctx = { blockConcurrencyWhile: (fn) => fn(), storage: { get: async () => undefined, put: async () => {}, delete: async () => {}, list: async () => new Map() } };
const W = new World(ctx, { SITE: "https://example.invalid", DEV: "0" }); await new Promise((r) => setTimeout(r, 20)); W.save = async () => {};
/* (2026-09-30) the launch line: the first start with the Valley open, CASINO says it, and it sits in the chat history for later arrivals */
is((W.chatLog || []).some((c) => c.name === "CASINO" && /PRIMEVAL VALLEY IS OPEN/.test(c.text) && /OLD REX/.test(c.text)), true, "the launch is announced in chat as CASINO, and kept in the history");
const said = []; W.houseSay = (t) => said.push(t);

let n = 0;
function fighter(S, name, x, y, kit) {
  const C = G.freshChar(); C.inv = []; C.scene = S.key; C.xp.hp = G.XP_AT[99]; C.hp = G.maxHpOf(C);
  for (const [sk, l] of Object.entries(kit.lvl)) C.xp[sk] = G.XP_AT[l];
  C.eq.weapon = kit.weapon; if (kit.quiver) { C.eq.shield = kit.quiver; C.quiver = { k: kit.ammo, n: 5000 }; }
  const id = `v${++n}`, pl = { id, login: id, name, role: "user", ws: { send() {} }, C, x, y, path: [], step: null, act: null, out: [], lastInput: Date.now(), joinedAt: Date.now(), msgWindow: 0, msgs: 0, lastSwing: 0 };
  if (!G.walkableIn(S.g, x, y)) { console.log(`  !! ${name} placed on a blocked cell ${x},${y}`); bad++; }
  W.pls.set(id, pl); return pl;
}
const swing = (S, pl, m, t) => { pl.act = { kind: "mob", id: m.id, x: m.x, y: m.y, started: 1 }; pl.lastInput = t; pl.lastSwing = 0; pl.path = []; W.doAction(S, pl, t); };
const tix = (pl) => G.tixIn(pl.C);

for (const [scene, bossT, spots] of [["valley_lair", "rex", [[21, 18], [16, 13], [27, 12]]], ["valley", "matriarch", [[23, 11], [28, 17], [34, 12]]]]) {
  const S = W.scene(scene), m = S.mobs.find((x) => x.t === bossT), B = G.MOBS[bossT];
  console.log(`\n${B.name} (${scene}), on his ledge at ${m.x},${m.y}`);
  is([G.walkableIn(S.g, m.x, m.y), B.open, B.guard.melee, B.guard.magic], [false, true, 0, 0], "stands on a ledge, open to all, nothing from a sword or a spell");
  const archers = [
    fighter(S, "Ninety-nine", ...spots[0], { lvl: { archery: 99 }, weapon: "cycadlogs_longbow", quiver: "cycadlogs_quiver", ammo: "singularity_arrow" }),
    fighter(S, "Sixty", ...spots[1], { lvl: { archery: 60 }, weapon: "skyashlogs_longbow", quiver: "skyashlogs_quiver", ammo: "onyx_arrow" }),
    fighter(S, "Forty", ...spots[2], { lvl: { archery: 40 }, weapon: "ashlogs_longbow", quiver: "ashlogs_quiver", ammo: "diamond_arrow" })
  ];
  is(archers.map((p) => G.cheb(p, m) <= 6), [true, true, true], "all three stand within a longbow's six tiles");
  is(archers.map((p) => G.bandBlock(p.C, scene, "fight")), [null, null, null], "the band lets all three in (Archery 40 with a bow is enough)");
  const sword = fighter(S, "Sword", spots[0][0], spots[0][1], { lvl: { melee: 99 }, weapon: "singularity_sword" });
  const wand = fighter(S, "Wand", spots[0][0], spots[0][1], { lvl: { magic: 99 }, weapon: "bogwoodlogs_wand", quiver: "bag_starweave", ammo: "page_fire_surge" });
  let t = Date.now() + 1000;
  for (let i = 0; i < 60; i++) for (const p of archers) swing(S, p, m, (t += 3000));
  is(archers.map((p) => (m.by?.[p.id] || 0) > 0), [true, true, true], "all three archers landed damage on him at once");
  console.log(`    damage so far: ${archers.map((p) => `${p.name} ${m.by?.[p.id] || 0}`).join(", ")} of ${m.maxHp || B.hp}`);
  sword.out = []; swing(S, sword, m, (t += 3000)); swing(S, sword, m, (t += 3000));
  is([m.by?.[sword.id] || 0, sword.out.some((e) => /arrow will reach/.test(e.text || ""))], [0, true], "a sword cannot reach the ledge, and is told only an arrow will");
  const hp0 = m.hp; for (let i = 0; i < 5; i++) { wand.C.quiver = { k: "page_fire_surge", n: 500 }; swing(S, wand, m, (t += 3000)); }
  is([m.by?.[wand.id] || 0, m.hp === hp0 || m.hp >= hp0 - 0], [0, true], "a wand in range does nothing to it");
  /* bring him to the edge (each archer keeps what they did, which is past their share), then the killing arrow */
  for (const p of archers) m.by[p.id] = Math.max(m.by[p.id] || 0, Math.ceil((m.maxHp || B.hp) * G.OPEN_SHARE) + 1);
  const before = archers.map(tix); for (const p of archers) p.out = [];
  m.hp = 1; for (let i = 0; i < 200 && !m.dead; i++) swing(S, archers[2], m, (t += 3000));   /* a level-40 arrow misses a lot at defence 94: keep shooting */
  is(m.dead, true, "the lowest archer's arrow puts him down");
  is(archers.map((p, i) => tix(p) > before[i]), [true, true, true], "the kill is shared: all three are paid");
  console.log(`    paid: ${archers.map((p, i) => `${p.name} +${tix(p) - before[i]}`).join(", ")} tickets`);
  const reps = archers.map((p) => p.out.find((e) => e.type === "runreport")?.r);
  is(reps.map((r) => [r?.kind, r?.result, r?.boss, r?.rows?.length >= 3]), archers.map(() => ["boss", "clear", B.name, true]), "and every one of them gets the after report");
  is(reps[0]?.kb?.name, "Forty", "the report names the killing blow");
  is(said.some((x) => x.includes(`Forty and 2 others put ${B.name} down`) && /Back in about \d+ minutes/.test(x)), true, "the whole server hears who put him down and when he is back");
  said.length = 0; m.respawnAt = 0; W.mobsTick(S, Date.now()); is([m.dead, said.some((x) => x.includes(`${B.name} is back in ${S.def.name}`))], [false, true], "and hears when he is back");
  for (const p of [...archers, sword, wand]) W.pls.delete(p.id);
}
console.log(bad ? `\n${bad} problem(s)` : "\nThe Valley's bosses: archers only, many at once, a shared kill, and everybody gets the report");
process.exitCode = bad ? 1 : 0;
