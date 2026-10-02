/* ============================================================
   EastScape sound — every sound effect in the game, by name

   The sounds are MADE here, not downloaded: each one is a little recipe (a wave, a pitch sweep, an envelope, a few
   notes) rendered to audio the first time it plays, so the whole library costs nothing to load. Retro on purpose, to
   sit with the pixel art.

   Swapping a sound for a real recording is one line: give its entry a `file` (a URL to an .ogg/.mp3/.wav), or `files`
   (several takes: one is picked at random each time, never the same one twice running, so a minute of mining doesn't
   sound like a loop). They're fetched the first time that sound plays, and the recipe stays as the fallback if a file
   doesn't arrive. Every call site stays the same. Chopping, mining, the sword's swing and its hit are recordings the
   owner supplied (2026-09-20), made ready by tools/eastscape-sfx-import.mjs (mono, 22 kHz, trimmed, one loudness).

   Browsers won't play audio before the player has clicked or pressed a key, so nothing plays until then.
   On/off and volume live in this browser (localStorage), not on the account: sound is a per-device thing.
   ============================================================ */

const RATE = 22050;
// note names -> Hz, for the jingles
const N = (n) => 440 * 2 ** ((n - 69) / 12);
const C5 = N(72), D5 = N(74), E5 = N(76), F5 = N(77), G5 = N(79), A5 = N(81), B5 = N(83), C6 = N(84), E6 = N(88), G6 = N(91), C7 = N(96);

/* A layer: { w: "square"|"saw"|"sine"|"tri"|"noise", f: start Hz, f2: end Hz, a/s/d: attack/sustain/decay seconds,
   t: start offset, v: volume, lp/hp: filter cutoffs, duty: square width, vib: [depth, Hz] }.
   A sound is one layer or a list of them. */
const tone = (f, t, d, v = 0.3, w = "square", extra = {}) => ({ w, f, t, d, v, ...extra });
const notes = (list, step, d, v, w = "square", extra = {}) => list.map((f, i) => tone(f, i * step, d, v, w, extra));
const ticks = (n, every, extra = {}) => Array.from({ length: n }, (_, i) => ({ w: "noise", t: i * every, d: 0.025, v: 0.35, lp: 3500, ...extra }));

const SFX_V = 4;   // bump when a recording is replaced: the files are cached hard
const takes = (name, n) => Array.from({ length: n }, (_, i) => `/v3/assets/sfx/${name}${i + 1}.wav?v=${SFX_V}`);
/* The owner's second batch (2026-09-23) arrived as finished .ogg, already small and level, so they ship as they
   came rather than through tools/eastscape-sfx-import.mjs — that tool is for raw .wav takes and re-encoding these
   would only make them bigger. `fish_water.ogg` was already precedent. */
const oggs = (name, n) => Array.from({ length: n }, (_, i) => `/v3/assets/sfx/${name}${i + 1}.ogg?v=${SFX_V}`);

const FISH = "/v3/assets/audio/fish/";   // + "?v=" is not needed: a changed sound gets a new file name
export const SOUNDS = {
  // the interface
  ui_click:   { vol: 0.35, files: takes("uiclick", 6), layers: [tone(1100, 0, 0.035, 0.25, "square", { f2: 850, duty: 0.5, lp: 5000 })] },
  ui_open:    { vol: 0.35, files: takes("uiopen", 3), layers: [tone(480, 0, 0.09, 0.3, "tri", { f2: 900 })] },
  ui_close:   { vol: 0.35, files: takes("uiclose", 3), layers: [tone(820, 0, 0.08, 0.3, "tri", { f2: 430 })] },
  ui_error:   { vol: 0.4, files: takes("uierror", 2), layers: [tone(220, 0, 0.12, 0.25, "square", { f2: 165, s: 0.03, lp: 2400 })] },
  chat:       { vol: 0.25, layers: [tone(880, 0, 0.06, 0.2, "sine"), tone(1320, 0.05, 0.07, 0.15, "sine")] },
  /* Thieving (2026-09-23, the owner's takes). Three takes each, coins and nails mixed through both, so a pocket
     sometimes sounds like money and sometimes like junk without the game deciding which. `caught` is what you
     had hitting the floor. No SFX_V bump: these are new file names, so nothing is cached under them yet. */
  steal:      { vol: 0.5, files: takes("steal", 3), layers: [tone(1200, 0, 0.05, 0.22, "tri", { f2: 1800 }), tone(1700, 0.04, 0.05, 0.14, "sine")] },
  caught:     { vol: 0.55, files: takes("caught", 3), layers: [tone(320, 0, 0.13, 0.28, "square", { f2: 180, lp: 2600 }), ...ticks(3, 0.05, { v: 0.25 })] },
  // the bag
  /* `pickup` was defined here and never played by anything — `gain` is the wired path — so it is gone rather than
     given a recording. In its place: finding GEAR now sounds different from finding an ore, which the owner's
     "Sword Pickup" / "Clothes Pickup" takes were clearly cut for. Neither is steady, because gear drops are rare;
     the common case (ore, logs, fish) is still `gain`, one quiet blip, unchanged. */
  gain_weapon: { vol: 0.3, files: oggs("getweapon", 4), layers: [tone(740, 0, 0.05, 0.2, "sine", { f2: 1040 })] },
  gain_gear:   { vol: 0.3, files: oggs("getgear", 3), layers: [tone(700, 0, 0.05, 0.2, "sine", { f2: 980 })] },
  drop:       { vol: 0.26, steady: true, files: oggs("slot", 2).slice(1), layers: [tone(520, 0, 0.07, 0.22, "sine", { f2: 330 })] },
  /* EQUIPPING IS SLOT-AWARE (2026-09-23): the owner's recordings come as "Sword Equip" and "Clothes Equip", and
     both call sites know which it is — `equip` carries the bag index, `unequip` carries the slot. `steady` is
     deliberately OFF on these two: it is what forces one take, and equipping is a thing you do a few times a
     session, not the hundreds-an-hour grind sound the steady rule was written for. Put `steady: true` back and
     they drop to take one. */
  equip:      { vol: 0.3, files: oggs("wear", 4), layers: [{ w: "noise", d: 0.03, v: 0.16, lp: 2400 }, tone(440, 0.005, 0.07, 0.2, "sine", { f2: 620 })] },
  equip_weapon: { vol: 0.32, files: oggs("wield", 2), layers: [{ w: "noise", d: 0.03, v: 0.18, lp: 2600 }, tone(520, 0.005, 0.08, 0.22, "sine", { f2: 720 })] },
  eat:        { vol: 0.32, steady: true, layers: ticks(3, 0.1, { d: 0.04, lp: 1300, v: 0.3 }) },
  gain:       { vol: 0.24, steady: true, files: oggs("take", 1), layers: [tone(880, 0, 0.09, 0.16, "sine", { f2: 1175 })] },
  inv:        { vol: 0.22, steady: true, files: oggs("slot", 1), layers: [tone(900, 0, 0.03, 0.18, "sine", { f2: 720 }), { w: "noise", d: 0.012, v: 0.1, lp: 2500 }] },   // moving a thing about in the bag or the bank
  // gathering and making
  chop:       { vol: 0.42, steady: true, files: takes("chop", 4), layers: [{ w: "noise", d: 0.09, v: 0.45, lp: 2200 }, tone(190, 0, 0.09, 0.35, "tri", { f2: 85 })] },
  mine:       { vol: 0.38, steady: true, files: takes("mine", 4), layers: [tone(1850, 0, 0.06, 0.2, "square", { f2: 1450, duty: 0.25 }), { w: "noise", d: 0.05, v: 0.3, lp: 6000, hp: 1200 }] },
  /* STEADY, SOFT AND OURS (the owner, 2026-09-21: "this is a semi-afk game, so it needs to be consistent and chill. just a few repeating
     sounds"). Everything you hear over and over while skilling, fishing, cooking, the bag, chopping, mining, is `steady`: ONE take, ONE
     pitch, quieter than the rest, so an hour beside it is an hour of the same small sound. Fishing went through three versions in a day:
     recorded CC0 plops and splashes in several takes (lively, tiring), one take of each (better), and now these, made on the softsynth
     below like every other sound here: short sine blips, nothing borrowed from any other game. Only the water is a recording
     (CC0, "40 CC0 water / splash / slime SFX" by rubberduck, OpenGameArt; tools/eastscape-fish-audio.mjs). */
  cast:       { vol: 0.26, steady: true, files: takes("cast", 2), layers: [tone(520, 0, 0.12, 0.22, "sine", { f2: 360 }), tone(760, 0.16, 0.06, 0.16, "sine", { f2: 980 }), { w: "noise", t: 0.16, d: 0.05, v: 0.07, lp: 1800 }] },   // the line goes out, and lands
  fish_catch: { vol: 0.3, steady: true, files: takes("fishcatch", 4), layers: [tone(300, 0, 0.11, 0.3, "sine", { f2: 620 }), tone(620, 0.1, 0.09, 0.15, "sine", { f2: 520 })] },   // a bloop
  fish_water: { vol: 0.12, loop: 1, file: FISH + "water.ogg" },   // quiet water under a fishing session (no synthesized stand-in: silence is fine)
  splash:     { vol: 0.4, layers: [{ w: "noise", d: 0.3, v: 0.35, lp: 2400 }] },
  cook:       { vol: 0.26, steady: true, layers: [{ w: "noise", a: 0.04, s: 0.25, d: 0.3, v: 0.16, lp: 3200, hp: 900 }] },   // a low sizzle
  smelt:      { vol: 0.34, steady: true, layers: [{ w: "noise", a: 0.06, s: 0.2, d: 0.25, v: 0.45, lp: 700 }] },
  anvil:      { vol: 0.3, steady: true, layers: [tone(1480, 0, 0.3, 0.22, "square", { duty: 0.15 }), tone(2960, 0, 0.4, 0.12, "sine"), { w: "noise", d: 0.03, v: 0.3, lp: 5000 }] },
  /* A GEODE IS A REAL EVENT (S.def.geode, a chance per gather in the Deep Wild) and it already emits a `gain`, so
     the page plays this instead of the ordinary blip when the thing you found is a geode. The pack shipped the gem
     both baked into a mining swing and on its own; on its own is what lets it land only when it actually happens. */
  gem:        { vol: 0.42, files: takes("gem", 4), layers: [tone(1320, 0, 0.12, 0.22, "sine", { f2: 1980 }), tone(1980, 0.1, 0.3, 0.16, "sine")] },
  /* A tree falling. Rare on purpose (4% a log, 2% for an oak), and it ends your chopping, so it earns a sound. */
  tree_fall:  { vol: 0.4, files: takes("treefall", 3), layers: [{ w: "noise", a: 0.05, s: 0.1, d: 0.5, v: 0.3, lp: 1400 }, tone(140, 0.1, 0.5, 0.25, "tri", { f2: 70 })] },
  pick:       { vol: 0.26, steady: true, layers: [tone(620, 0, 0.05, 0.22, "tri", { f2: 820 })] },
  // fighting
  swing:      { vol: 0.4, files: takes("swing", 3), layers: [{ w: "noise", a: 0.01, d: 0.12, v: 0.3, lp: 5000, hp: 1400 }] },
  hit:        { vol: 0.55, files: takes("hit", 4), layers: [{ w: "noise", d: 0.08, v: 0.45, lp: 1800 }, tone(150, 0, 0.09, 0.3, "square", { f2: 60, lp: 1500 })] },
  miss:       { vol: 0.3, layers: [{ w: "noise", d: 0.05, v: 0.2, lp: 7000, hp: 3000 }] },
  /* ARCHERY (2026-09-25). The two landings are Kenney's "Impact Sounds" (CC0, kenney.nl/assets/impact-sounds, the licence
     file in that zip says Creative Commons Zero; no credit needed): impactSoft_medium 000/001/003/004 as arrowhit1-4,
     impactSoft_heavy 000/002 as arrowcrit1-2, copied as they came. They were picked by measuring, not by ear: the soft
     mediums are dull thuds that are over in about 0.1 s, short enough not to smear at a shortbow's pace; the punches peak
     20-40 ms late and read as fists, and the wood knocks are clicks. No free CC0 bow TWANG was found (the popular ones on
     OpenGameArt are CC-BY-SA / GPL), so the release and the miss are synthesised here, like every other sound. */
  /* (2026-09-25, later the same day, the owner: the twang was "very annoying and repetitive"). Now four RECORDED takes: the light
     swishes from artisticdude's CC0 "Swishes Sound Pack" (OpenGameArt), cut by tools/eastscape-sfx-import.mjs. Four takes, never the
     same one twice running, and a wider pitch wobble than the default, because this plays on every shot. The synth is the fallback. */
  bow_release: { vol: 0.34, jitter: 0.12, files: takes("arrowfly", 4), layers: [{ w: "noise", a: 0.02, d: 0.09, v: 0.18, lp: 7000, hp: 2600 }] },
  arrow_hit:   { vol: 0.6, files: oggs("arrowhit", 4), layers: [{ w: "noise", d: 0.06, v: 0.4, lp: 1400 }, tone(170, 0, 0.07, 0.3, "sine", { f2: 80 })] },
  arrow_crit:  { vol: 0.75, files: oggs("arrowcrit", 2), layers: [{ w: "noise", d: 0.12, v: 0.5, lp: 1200 }, tone(130, 0, 0.14, 0.35, "sine", { f2: 55 })] },
  arrow_miss:  { vol: 0.3, layers: [{ w: "noise", a: 0.05, d: 0.16, v: 0.22, lp: 7000, hp: 2400 }] },
  /* (2026-10-02, the owner: "download them yourself") RECORDINGS NOW, from Kenney's CC0 packs (kenney.nl: Impact Sounds, RPG Audio, Interface Sounds), shipped as
     the .ogg they came as, picked by length: creak3; impactPunch_medium (flesh), impactWood_light (bone), impactMining (stone), impactSoft_heavy (scale),
     impactSoft_medium (a miss in the dirt), glass (the Bullseye ping), tick, impactGlass_light (frost), scratch (ember), maximize (shimmer). Spirit and
     the spark gem had no match and stay synthesized; every entry keeps its layers as the fallback if a file fails. */
  /* (2026-10-02, v1.2) ARCHERY FEEL (tools/archeryfx-mock). Synthesized STAND-INS, quiet on purpose, until recordings are sourced: none of
     these plays on every shot except the creak, which is a breath of string under the recorded release. No synthesized twang: the owner
     called that "very annoying and repetitive" (2026-09-25); a bow's own pitch is the release take played faster or slower. */
  bow_creak:   { vol: 0.16, files: oggs("bowcreak", 1), jitter: 0.1, layers: [{ w: "noise", a: 0.08, d: 0.2, v: 0.25, lp: 900, hp: 250 }] },
  mat_flesh:   { vol: 0.4, files: oggs("matflesh", 3), jitter: 0.1, layers: [tone(120, 0, 0.12, 0.4, "sine", { f2: 60 })] },
  mat_bone:    { vol: 0.3, files: oggs("matbone", 4), jitter: 0.1, layers: [tone(900, 0, 0.05, 0.25, "square", { f2: 500 }), { w: "noise", d: 0.05, v: 0.25, lp: 3000, hp: 800 }] },
  mat_stone:   { vol: 0.28, files: oggs("matstone", 3), jitter: 0.1, layers: [tone(1600, 0, 0.09, 0.2, "triangle", { f2: 1200 }), { w: "noise", d: 0.06, v: 0.3, lp: 2000, hp: 600 }] },
  mat_spirit:  { vol: 0.28, jitter: 0.1, layers: [{ w: "noise", a: 0.03, d: 0.32, v: 0.3, lp: 1200, hp: 200 }] },
  mat_scale:   { vol: 0.35, files: oggs("matscale", 3), jitter: 0.1, layers: [{ w: "noise", d: 0.07, v: 0.4, lp: 1500 }, tone(200, 0, 0.08, 0.3, "sine", { f2: 120 })] },
  arrow_ping:  { vol: 0.3, files: oggs("arrowping", 3), layers: [tone(1800, 0, 0.25, 0.3, "sine", { f2: 2400 })] },
  arrow_thud:  { vol: 0.35, files: oggs("arrowthud", 4), jitter: 0.1, layers: [{ w: "noise", d: 0.08, v: 0.35, lp: 500 }, tone(80, 0, 0.08, 0.3, "sine", { f2: 50 })] },
  gem_ember:   { vol: 0.24, files: oggs("gemember", 3), layers: [{ w: "noise", d: 0.25, v: 0.3, lp: 4000, hp: 1500 }] },
  gem_frost:   { vol: 0.24, files: oggs("gemfrost", 3), layers: [tone(2400, 0, 0.3, 0.3, "sine"), tone(3100, 0.05, 0.3, 0.25, "sine")] },
  gem_spark:   { vol: 0.16, layers: [tone(1200, 0, 0.04, 0.3, "square"), tone(1600, 0.03, 0.04, 0.3, "square"), tone(2000, 0.06, 0.04, 0.3, "square")] },
  gem_shimmer: { vol: 0.22, files: oggs("gemshimmer", 3), layers: [tone(1320, 0, 0.25, 0.3, "sine"), tone(1660, 0.05, 0.25, 0.3, "sine"), tone(1980, 0.1, 0.25, 0.3, "sine")] },
  quiver_tick: { vol: 0.2, files: oggs("quivertick", 3), layers: [tone(2600, 0, 0.03, 0.25, "square")] },
  /* MAGIC (2026-09-26). Kenney's "Sci-fi Sounds" (CC0, kenney.nl/assets/sci-fi-sounds): laserSmall 001-003 as the cast, laserSmall_000
     for Arcane, explosionCrunch_000 for Fire, laserRetro 000/003 for Storm, lowFrequency_explosion_001 for Void, forceField_000 for Sun and
     forceField_004 for a buff; Frost is bart's CC0 "Ice spells" (opengameart.org/content/ice-spells), cut by eastscape-sfx-import.mjs.
     Picked by measuring length and brightness, not by ear: the casts are 0.2-0.3 s zaps so they do not pile up at a wand's pace. */
  /* (2026-09-26) MORE TAKES PER SPELL, so a minute of casting is not one sound on a loop. Two CC0 packs from OpenGameArt:
     rubberduck's "80 CC0 RPG SFX" (the two plain spells -> casts, four of the seven fire spells -> Fire) and JaggedStone's
     "Magic Spell SFX" (the two darkest -> Void, the slow shimmers -> Sun and Arcane, the longest swell -> reading a scroll).
     Decoded, summed to mono at 22.05 kHz, trimmed, faded and peak-matched to the takes already here (the packs came in up
     to 25 dB quieter), in the browser; the "b" in the file names keeps them apart from the first set. Frost and Storm
     keep their own: nothing in either pack sounded like ice or lightning. */
  spell_cast:   { vol: 0.28, jitter: 0.1, files: [...oggs("spellcast", 3), ...takes("spellcastb", 2)], layers: [tone(900, 0, 0.08, 0.2, "sine", { f2: 1600 })] },
  spell_arcane: { vol: 0.4, files: [...oggs("spellarcane", 1), ...takes("spellarcaneb", 2)], layers: [tone(700, 0, 0.1, 0.25, "sine", { f2: 300 })] },
  spell_fire:   { vol: 0.45, files: [...oggs("spellfire", 1), ...takes("spellfireb", 4)], layers: [{ w: "noise", d: 0.2, v: 0.4, lp: 1200 }] },
  spell_frost:  { vol: 0.4, files: takes("spellfrost", 2), layers: [{ w: "noise", d: 0.12, v: 0.3, hp: 3000 }] },
  spell_storm:  { vol: 0.35, jitter: 0.08, files: oggs("spellstorm", 2), layers: [tone(1400, 0, 0.1, 0.25, "square", { f2: 200 })] },
  spell_void:   { vol: 0.5, files: [...oggs("spellvoid", 1), ...takes("spellvoidb", 2)], layers: [tone(90, 0, 0.3, 0.4, "sine", { f2: 40 })] },
  spell_sun:    { vol: 0.4, files: [...oggs("spellsun", 1), ...takes("spellsunb", 2)], layers: [tone(660, 0, 0.3, 0.25, "tri", { f2: 990 })] },
  spell_buff:   { vol: 0.4, files: [...oggs("spellbuff", 1), ...takes("spellbuffb", 1)], layers: [tone(520, 0, 0.25, 0.25, "tri", { f2: 1040 })] },
  hurt:       { vol: 0.45, files: takes("hurt", 3), layers: [tone(300, 0, 0.15, 0.3, "square", { f2: 120, lp: 1800 })] },
  mob_die:    { vol: 0.45, files: takes("mobdie", 1), layers: [tone(420, 0, 0.35, 0.28, "square", { f2: 60, lp: 2000 }), { w: "noise", d: 0.22, v: 0.25, lp: 1000 }] },
  die:        { vol: 0.5, layers: [tone(400, 0, 0.8, 0.3, "saw", { f2: 45, s: 0.2, lp: 1500 })] },
  /* (2026-09-29, the owner's pre-launch list: "combat and fighting weight fixes (new sounds ... on death hit sounds)") THE COMBAT PASS. Nothing
     new is downloaded: the recorded takes already here are reused where they fit, and the rest is synthesised, steady (one pitch) where it
     repeats, per the owner's rule for anything heard over and over.
     - mob_swing: a monster winding up at you, the swing takes pitched down and kept quiet, so a blow is heard coming.
     - crit: the heavy CC0 impact the archery crit uses (Kenney impactSoft_heavy), for a melee crit too; it had been the plain hit, lowered.
     - weak / resist / guard: what the WEAK, RESIST and GUARD words under a hit had never had: a bright ping, a dull thud, a metal clank.
     - heartbeat: under a quarter of your health, while a fight is on: two soft low beats.
     - died: your own death, every kind of it (a dungeon's too, which used to be silent): a slow falling tone over a low swell. */
  mob_swing:  { vol: 0.22, jitter: 0.1, files: takes("swing", 3), layers: [{ w: "noise", a: 0.02, d: 0.14, v: 0.2, lp: 2600, hp: 600 }] },
  crit:       { vol: 0.8, files: oggs("arrowcrit", 2), layers: [{ w: "noise", d: 0.12, v: 0.5, lp: 1200 }, tone(110, 0, 0.16, 0.4, "sine", { f2: 45 })] },
  weak:       { vol: 0.28, steady: true, layers: [tone(1568, 0, 0.09, 0.2, "sine"), tone(2352, 0.05, 0.14, 0.14, "sine")] },
  resist:     { vol: 0.34, steady: true, layers: [tone(130, 0, 0.12, 0.35, "sine", { f2: 90 }), { w: "noise", d: 0.06, v: 0.15, lp: 500 }] },
  guard:      { vol: 0.3, steady: true, layers: [tone(880, 0, 0.12, 0.18, "square", { lp: 3000 }), tone(1320, 0, 0.18, 0.12, "tri"), { w: "noise", d: 0.04, v: 0.18, hp: 4000 }] },
  heartbeat:  { vol: 0.3, steady: true, layers: [tone(62, 0, 0.09, 0.5, "sine", { f2: 48 }), tone(58, 0.22, 0.1, 0.4, "sine", { f2: 44 })] },
  died:       { vol: 0.5, steady: true, layers: [tone(330, 0, 1.2, 0.28, "tri", { f2: 82 }), tone(165, 0.15, 1.4, 0.2, "sine", { f2: 41 }), { w: "noise", a: 0.02, d: 0.5, v: 0.18, lp: 700 }] },
  /* FOOTSTEPS (2026-09-23). New: the game had none. Three surfaces, picked from the tile you step onto — the
     interior scenes paint a room ("floor"), "," and "s" are path and sand ("dirt"), everything else outdoors is
     grass. Only YOUR character makes them; thirty players in the Yard all stepping would be a stampede.

     THESE ARE DELIBERATELY NOT `steady`, and they are the exception that explains the rule. Steady exists so a
     sound you hear hundreds of times an hour does not tire you out, and it achieves that by never varying. For a
     footstep the opposite is true: an identical step repeating is exactly what the ear locks onto and cannot
     ignore, which is why every game round-robins them. Four takes and the default pitch jitter is what makes
     walking disappear into the background. Quiet, too — 0.18 against 0.35 for a click. */
  step_grass: { vol: 0.18, files: takes("stepgrass", 4), layers: [{ w: "noise", d: 0.06, v: 0.12, lp: 2600, hp: 600 }] },
  step_dirt:  { vol: 0.18, files: takes("stepdirt", 4), layers: [{ w: "noise", d: 0.05, v: 0.12, lp: 1800 }] },
  step_floor: { vol: 0.18, files: takes("stepfloor", 4), layers: [{ w: "noise", d: 0.04, v: 0.1, lp: 3400, hp: 900 }] },
  // getting better at things
  levelup:    { vol: 0.5, layers: [...notes([C5, E5, G5], 0.1, 0.12, 0.28, "square", { duty: 0.25 }), tone(C6, 0.3, 0.45, 0.3, "square", { duty: 0.25, vib: [0.01, 6] }), ...notes([E5, G5, C6], 0.1, 0.12, 0.12, "tri"), tone(E6, 0.3, 0.45, 0.14, "tri")] },
  task_done:  { vol: 0.45, layers: [...notes([G5, C6], 0.1, 0.12, 0.26, "square", { duty: 0.3 }), tone(E6, 0.2, 0.35, 0.26, "square", { duty: 0.3 })] },
  idle_stop:  { vol: 0.35, layers: [tone(660, 0, 0.3, 0.2, "sine"), tone(440, 0.16, 0.4, 0.2, "sine")] },
  // money and places
  coins:      { vol: 0.4, files: oggs("coin", 2), layers: [tone(1318, 0, 0.07, 0.2, "square", { duty: 0.3 }), tone(1760, 0.07, 0.3, 0.2, "square", { duty: 0.3 })] },
  door:       { vol: 0.45, layers: [{ w: "noise", a: 0.01, d: 0.12, v: 0.35, lp: 900 }, tone(120, 0.02, 0.16, 0.3, "tri", { f2: 80 })] },
  // the Casino
  chip:       { vol: 0.4, files: oggs("chip", 2), layers: [tone(2500, 0, 0.03, 0.2, "square", { f2: 2000 }), { w: "noise", d: 0.02, v: 0.2, hp: 4000 }] },
  slots_spin: { vol: 0.3, loop: 0.56, layers: ticks(8, 0.07, { v: 0.3, lp: 3000 }) },
  reel_stop:  { vol: 0.45, layers: [tone(180, 0, 0.06, 0.35, "square", { f2: 120, lp: 2000 }), { w: "noise", d: 0.04, v: 0.3, lp: 1500 }] },
  win_small:  { vol: 0.45, files: oggs("coinbig", 3), layers: notes([E5, G5, C6], 0.08, 0.1, 0.25, "square", { duty: 0.3 }) },
  win_big:    { vol: 0.5, files: oggs("coinhuge", 4), layers: [...notes([C5, E5, G5, C6, E6, G6], 0.07, 0.1, 0.26, "square", { duty: 0.25 }), tone(C7, 0.42, 0.5, 0.22, "square", { duty: 0.25, vib: [0.012, 7] })] },
  jackpot:    { vol: 0.55, layers: [...[0, 0.5, 1].flatMap((o) => notes([C5, E5, G5, C6, E6, G6], 0.06, 0.09, 0.24, "square", { duty: 0.25 }).map((l) => ({ ...l, t: l.t + o }))), tone(C7, 1.4, 0.9, 0.24, "square", { duty: 0.25, vib: [0.015, 8] })] },
  lose:       { vol: 0.35, layers: [tone(330, 0, 0.28, 0.22, "tri", { f2: 210, vib: [0.02, 5] })] },
  coin_flip:  { vol: 0.35, layers: [0, 0.11, 0.2, 0.27, 0.32].map((t, i) => tone(2100 - i * 120, t, 0.06, 0.15, "sine")) },
  dice:       { vol: 0.45, layers: [0, 0.06, 0.1, 0.17, 0.21, 0.3].map((t, i) => ({ w: "noise", t, d: 0.03 + (i % 2) * 0.02, v: 0.35, lp: 3200 })) },
  roul_ball:  { vol: 0.25, loop: 0.48, layers: [{ w: "noise", s: 0.48, v: 0.12, lp: 3800, hp: 1500 }, ...ticks(6, 0.08, { v: 0.18, lp: 5000, hp: 2000, d: 0.015 })] },
  roul_drop:  { vol: 0.45, layers: [tone(2200, 0, 0.02, 0.25, "square"), tone(1900, 0.09, 0.02, 0.22, "square"), tone(1700, 0.2, 0.03, 0.2, "square"), tone(140, 0.24, 0.12, 0.3, "tri", { f2: 90 })] }
  // To use a recording instead: e.g.  door: { file: "/v3/assets/sfx/door.ogg", vol: 0.5 },
};

let ac = null, master = null, on = true, vol = 0.6, mute = false, all = 1;   // all: the ONE volume over everything (effects here, and the page's jukebox reads it too)
const bufs = new Map(), last = new Map(), loading = new Map(), lastTake = new Map();
try { on = localStorage.getItem("es_sfx") !== "0"; mute = localStorage.getItem("es_mute") === "1"; { const a = parseFloat(localStorage.getItem("es_all")); if (Number.isFinite(a)) all = Math.max(0, Math.min(1, a)); } const v = parseFloat(localStorage.getItem("es_vol")); if (Number.isFinite(v)) vol = v; } catch (e) { /* private mode */ }

// the first click or key unlocks audio (browsers insist)
function unlock() {
  if (ac) return;
  try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = mute ? 0 : vol * all; master.connect(ac.destination); } catch (e) { ac = null; }
}
for (const ev of ["pointerdown", "keydown"]) addEventListener(ev, unlock, { once: true, capture: true });

export const enabled = () => on;
export const volume = () => vol;
export function setEnabled(v) { on = !!v; try { localStorage.setItem("es_sfx", on ? "1" : "0"); } catch (e) { /* fine */ } }
/* the top bar's one-click mute: everything off, whatever the Settings switch and slider say, and they are left as they were.
   It goes on the master gain as well as play(), so a loop already running (the roulette ball) falls silent too. */
/* THE GLOBAL VOLUME (the owner, 2026-09-21: "a global volume toggle / volume slider here beside buffs"): one number, 0 to 1, laid over the
   effects volume here and over the jukebox's own volume in the page. This browser only (es_all). */
export const allVolume = () => all;
export function setAllVolume(v) { all = Math.max(0, Math.min(1, v)); if (master) master.gain.value = mute ? 0 : vol * all; try { localStorage.setItem("es_all", String(all)); } catch (e) { /* fine */ } }
export const muted = () => mute;
export function setMuted(v) { mute = !!v; if (master) master.gain.value = mute ? 0 : vol * all; try { localStorage.setItem("es_mute", mute ? "1" : "0"); } catch (e) { /* fine */ } }
export function setVolume(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.value = mute ? 0 : vol * all; try { localStorage.setItem("es_vol", String(vol)); } catch (e) { /* fine */ } }

function render(def) {
  const len = Math.ceil(RATE * (def.loop || Math.max(...def.layers.map((l) => (l.t || 0) + (l.a || 0) + (l.s || 0) + (l.d || 0.1))) + 0.02));
  const out = new Float32Array(len);
  for (const L of def.layers) {
    const start = Math.floor((L.t || 0) * RATE), a = (L.a || 0) * RATE, s = (L.s || 0) * RATE, d = (L.d || 0.1) * RATE, n = Math.min(len - start, Math.ceil(a + s + d));
    let ph = 0, lpY = 0, hpY = 0, hpX = 0, noise = 0, nt = 0;
    const lpK = L.lp ? 1 - Math.exp((-2 * Math.PI * L.lp) / RATE) : 1, hpK = L.hp ? Math.exp((-2 * Math.PI * L.hp) / RATE) : 0;
    for (let i = 0; i < n; i++) {
      const k = i / Math.max(1, n - 1), env = i < a ? i / a : i < a + s ? 1 : 1 - (i - a - s) / d;
      let f = L.f ? (L.f2 ? L.f * (L.f2 / L.f) ** k : L.f) : 0;
      if (L.vib) f *= 1 + L.vib[0] * Math.sin((2 * Math.PI * L.vib[1] * i) / RATE);
      ph = (ph + f / RATE) % 1;
      let x;
      switch (L.w) {
        case "noise": if (++nt > 1) { nt = 0; noise = Math.random() * 2 - 1; } x = noise; break;
        case "sine": x = Math.sin(2 * Math.PI * ph); break;
        case "tri": x = 1 - 4 * Math.abs(ph - 0.5); break;
        case "saw": x = 2 * ph - 1; break;
        default: x = ph < (L.duty || 0.5) ? 0.8 : -0.8;
      }
      lpY += lpK * (x - lpY); x = lpY;
      if (L.hp) { const y = hpK * (hpY + x - hpX); hpX = x; hpY = y; x = y; }
      out[start + i] += x * Math.max(0, env) * (L.v ?? 0.3);
    }
  }
  const b = ac.createBuffer(1, len, RATE); b.copyToChannel(out, 0); return b;
}
async function bufferOf(name) {
  if (bufs.has(name)) return bufs.get(name);
  const def = SOUNDS[name]; let b = null;
  const load = async (url) => { try { const r = await fetch(url); if (!r.ok || !/audio|octet/.test(r.headers.get("content-type") || "")) return null; return await ac.decodeAudioData(await r.arrayBuffer()); } catch (e) { return null; } };
  /* (2026-09-23) `steady` USED TO MEAN ONE TAKE AS WELL AS ONE PITCH. It no longer limits takes. The rule was
     written on 2026-09-21 against synthesised blips and a set of lively CC0 fishing plops that were tiring within
     a session, and one take was the cheapest way to kill the variation that caused it. The owner has since bought
     a pack that ships four takes each of mining, chopping and fishing, cut to be rotated. What actually tires the
     ear is the PITCH WOBBLE, which `steady` still switches off below — so a steady sound now rotates its takes at
     one constant pitch, which is both what the pack is for and what "consistent and chill" asked for. Put the
     slice back if an hour of mining ever proves otherwise. */
  const urls = def.files || (def.file ? [def.file] : []);
  if (urls.length) { const got = (await Promise.all(urls.map(load))).filter(Boolean); if (got.length) b = got; }   // every take that arrived
  if (!b && def.layers) b = [render(def)];
  bufs.set(name, b); return b;
}

/* play a sound by name. { vol, rate, jitter } adjust one playing; returns a handle whose stop() ends a loop early.
   The same sound can't fire more than once every 40ms, so a burst of events stays a sound, not a buzz. */
export function play(name, o = {}) {
  const def = SOUNDS[name]; if (!on || mute || !def) return { stop() {} };
  unlock(); if (!ac) return { stop() {} };
  if (ac.state === "suspended") ac.resume();
  const now = performance.now(); if (now - (last.get(name) || 0) < 40) return { stop() {} }; last.set(name, now);
  let src = null, stopped = false;
  const pending = bufs.has(name) ? Promise.resolve(bufs.get(name)) : (loading.get(name) || loading.set(name, bufferOf(name)).get(name));
  pending.then((list) => {
    if (!list?.length || stopped) return;
    let i = Math.floor(Math.random() * list.length); if (list.length > 1 && i === lastTake.get(name)) i = (i + 1) % list.length; lastTake.set(name, i);
    const b = list[i];
    src = ac.createBufferSource(); src.buffer = b; src.loop = !!def.loop;
    const j = o.jitter ?? def.jitter ?? (def.loop || def.steady ? 0 : 0.05);   /* (2026-09-25) a sound may ask for its own wobble */   /* (steady: the same pitch every time) */ src.playbackRate.value = (o.rate || 1) * (1 + (Math.random() * 2 - 1) * j);
    const g = ac.createGain(); g.gain.value = (def.vol ?? 0.4) * (o.vol ?? 1);
    src.connect(g); g.connect(master); src.start();
  });
  return { stop() { stopped = true; try { src?.stop(); } catch (e) { /* already ended */ } } };
}
