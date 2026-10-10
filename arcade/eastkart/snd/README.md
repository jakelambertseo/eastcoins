# EastKart sounds

Drop files in this folder as `<name>.mp3`, `.ogg` or `.wav` (mono, 44.1 kHz). `SND_FILES` in `eastkart.js` lists what is here (name:
extension) and the game fetches those at the first click; a cue not listed falls back to the synthesised one. After adding or replacing a
file, add it to `SND_FILES` and bump `SND_V` so the edge serves the new one.

**What is here now (2026-10-12, all CC0, to test):** the engine loop is from OpenGameArt "Racing car engine sound loops" (loop 1); the
splash (bath_drop, bath_hit) is OpenGameArt "6 short water splashes"; everything else is from Kenney's Impact Sounds and Interface
Sounds packs (kenney.nl, CC0). Not covered yet, still synthesised: drift_loop, hail_throw, flag_throw, spin.

| file | length | loop | prompt for a sound generator |
|---|---|---|---|
| engine_loop | 2.0 s | seamless | Small go-kart engine at a steady mid rev, clean single-note hum with a light four-stroke putter, no wind, no gear changes, seamless loop, mono |
| drift_loop | 1.0 s | seamless | Go-kart tyres skidding sideways on asphalt, steady squeal with a gritty rasp, seamless loop, no engine, mono |
| count | 0.15 s | | Short arcade countdown beep, mid pitch, dry |
| go | 0.5 s | | Race-start air horn, bright, with a tiny crowd lift under it |
| item | 0.3 s | | Picking up a power-up: a bright rising two-note chime with a little sparkle |
| drill | 0.9 s | | Turbo boost whoosh: a rising rush of air with a short jet-like tail |
| hail_throw | 0.5 s | | A football thrown hard: a quick arm swing and the ball whistling away, with a quarterback grunt |
| hail_hit | 0.7 s | | A football tackle: shoulder pads crunching and a short grunt, then a brief stadium "ooh" |
| slap_shot | 0.3 s | | Hockey slapshot: a sharp stick-on-ice crack and the puck zipping away |
| slap_hit | 0.3 s | | Hockey puck slamming into the boards, a hard hollow thud |
| bath_drop | 0.6 s | | A big cooler of ice water sloshed onto the ground, a heavy splash with ice cubes |
| bath_hit | 0.5 s | | Slipping in a puddle: a wet skid, a splash and a small comic yelp |
| flag_throw | 0.8 s | | Referee whistle, three short sharp blasts, then a bright flag-toss whoosh |
| flag_hit | 0.8 s | | A stadium crowd groaning at a penalty call, short, with a referee whistle under it |
| oline_up | 0.5 s | | A football huddle breaking: a "hut!" and shoulder pads clacking together |
| oline_block | 0.5 s | | Two sets of football pads colliding hard in a block, a heavy crunch, no voices |
| spin | 0.6 s | | Go-kart spinning out: a sharp tyre screech that drops in pitch, ending in a scrub |
| bump | 0.2 s | | Two plastic go-karts bumping sides, a light hollow knock |
| lap | 0.8 s | | A short stadium crowd cheer with a cowbell clank |
| final_lap | 0.6 s | | A ringside bell struck once, bright, with a short crowd rise |
| finish_win | 2.0 s | | Crossing the line first: an air horn, a big crowd roar and confetti poppers |
| finish_lose | 2.0 s | | Crossing the line late: a polite crowd clap with a sad trombone wah-wah |
| click | 0.1 s | | Menu click, a soft plastic tick |

The engine loop's playback rate is driven by speed (0.7× at rest to about 1.9× flat out), so record it at one steady rev. The drift
loop fades in while the drift is held. The volume slider is not built yet; `vol` in `eastkart.js` is the master level.
