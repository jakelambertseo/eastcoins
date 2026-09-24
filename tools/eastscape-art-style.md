# EastScape art style — the prompt every PixelLab generation starts from

The owner's brief, 2026-09-22. **Use it for anything drawn for EastScape from now on**: characters,
NPCs, scenery, tiles, item icons, UI art. Paste the block below at the top of the prompt and then add
what the specific asset is, rather than writing a fresh style description each time — the point is that
two assets drawn a month apart still look like they belong to the same game.

Practical notes that sit alongside it, learned the hard way:

- **A floor or a full-bleed texture is `create_image_pixflux` with `no_background: false`.** Asked for as a
  `create_map_object` it comes back completely empty — that tool draws a *thing* on transparency, and a
  seamless floor has no thing in it.
- **Name the object and its shape before the material.** "diamond pickaxe" gave a scythe three times;
  "miner's pickaxe, straight double-pointed head, of pale ice blue diamond" gave a pickaxe.
- **A tile that repeats must have no large feature in it.** The first running-track tile had one white
  slash and one dark blob, and eight across a room read as wallpaper. Ask for "fine even grit, completely
  uniform, no large features", and offset alternate tiles in the painter on top of that.
- **A TILE TAKES THE BRIEF'S RENDERING CLAUSES ONLY.** The brief says "dense and lived-in rather than
  sparse", describes composition, players and props — all right for a scene or a prop, and actively wrong
  for a repeating texture. Pasted whole into a floor-tile prompt it produced a little scene with stairs
  and shrubs in it. For a tile, keep the pixel-art, fidelity, palette and lighting lines; drop everything
  about composition, scale, inhabitants and density.
- **AN NPC'S FACINGS COME FROM ONE CHARACTER, NOT TWO PROMPTS.** `<art>_south` and `<art>_east` have to be
  the same person. Generated as two separate images they are two different people wearing different clothes —
  which is exactly what happened to Darla. Use `create_character` (v3 mode, 8 directions) and take the
  rotations, or `create_character_state` off an existing one.
- **Check `flat/` and `AREA_ART` for the name first.** A market crate and barrel were generated straight
  over `o_crate` and `o_barrel`, which the Fight Pit and the closed areas were already using.

---

EastScape gameplay art style: A polished 2D top-down pixel-art MMORPG viewed from slightly above,
inspired by late-1990s and early-2000s online RPGs but with much richer modern pixel-art lighting and
environmental detail. Flat tile-based world, NOT true isometric. Chunky, readable character sprites with
large heads, compact bodies, expressive silhouettes, and clearly defined clothing. Characters should look
like ordinary modern people mixed with absurd fantasy NPCs rather than traditional heroic fantasy.

Use crisp, deliberate pixel clusters with strong dark outlines, selective highlights, subtle dithering,
and detailed hand-pixelled shading. Approximately 32-bit-era visual fidelity: much more detailed than
8-bit or 16-bit art, but still unmistakably pixel art. No smooth digital painting, no vector art, no
anti-aliased edges, no 3D rendering.

Casino environment: luxurious but slightly tacky neon casino aesthetic. Deep midnight purple and burgundy
base colors, crimson accents, glowing magenta and pink neon, warm golden trim, brass fixtures, red velvet
ropes, dark navy shadows, green felt gaming tables, and bright multicolored star-patterned carpet. Rows of
colorful slot machines, red stools, blackjack and roulette tables, decorative palms, lamps, gold posts,
signs, carpets, plants, and little environmental props. Make the environment dense and lived-in rather
than sparse.

Lighting should be dramatic for pixel art: warm gold pools of light around lamps, pink/purple neon glow
around casino signs and machines, subtle colored rim light on nearby objects, and strong contrast between
illuminated areas and dark purple shadows. Do not blur the glow; construct it from pixel clusters and
stepped color ramps.

Camera is a fixed RPG gameplay camera looking downward at roughly a 55–65 degree angle, allowing the
player to see character fronts and sides while still clearly seeing the floor. Characters are roughly
48–80 pixels tall relative to a full gameplay screenshot and occupy only a small portion of the
environment. Maintain believable MMO scale—do not make characters huge.

Scene should resemble an authentic screenshot from a live social browser MMO. Several players are walking,
standing around tables, chatting, gambling, or interacting with NPCs. Main player is an ordinary man
wearing a dark navy/black T-shirt with a horizontal red stripe, dark pants and light shoes. Include silly
fantasy inhabitants such as an anthropomorphic white goat wearing a white toga with purple trim and a
gloomy mushroom creature with a large gray cap.

Composition should be busy but highly readable. Use pathways, furniture, rugs, rope barriers and gaming
tables to create natural gameplay lanes. Every part of the screen should feel intentionally designed as a
traversable game map. Objects must align naturally to the tile grid while avoiding obvious repetitive
tiling.

Art direction: charming, social, funny, slightly degenerate, welcoming, colorful and absurd. The casino
feels glamorous enough to be exciting but goofy enough that a goat in a toga does not seem out of place.
Think "tiny online world you want to hang around in for hours," not serious dark fantasy.

Crisp nearest-neighbor pixel appearance, consistent pixel size, detailed sprite animation-ready designs,
strong silhouettes, readable objects, cohesive palette, handcrafted game asset quality, no painterly
textures, no realistic anatomy, no faux-3D perspective, no voxel art, no chibi anime styling.
