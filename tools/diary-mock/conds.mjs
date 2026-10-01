/* WHAT EACH DIARY TASK CHECKS, and what each perk does (2026-10-01, v1.1: the owner, "put them in 1.1"). Read beside diaries.js: the same 21 maps,
   four tiers of three tasks each, in the same order. node tools/eastscape-diary-gen.mjs joins the two and writes the DIARY-GEN block in the rules
   file, so the game plan's words and the game's checks can never drift apart (the generator refuses a map whose counts don't match).

   A CONDITION is a list of clauses, ALL of which must hold. The server's diary.js reads them; nothing here runs on its own.
     ["k", mob, ...]          killed each at least once (lifetime counts, so what you did before diaries counts)
     ["kn", mob, n]           killed n of it
     ["km", scene, mob|null, n]  killed on THAT map (counted from launch: a monster that lives on two maps)
     ["ks", mob, style]       killed with that style (melee, archery, magic)
     ["g", item, ...]         gathered, cooked or crafted each at least once (lifetime)
     ["gn", item, n]          n of it
     ["gm", scene, item, n]   gathered on THAT map (from launch)
     ["l", item]              looted at least once, or have one
     ["q", quest, ...]        finished each
     ["c", key, n]            a diary counter (pocket, lockbox, shortcut, back way, event, visit, lap, stunt, talk, buy, flag, PvP)
     ["cs", n, key, ...]      the counters added up
     ["pet", k, ...]          own any of them
     ["wear", item]           have it on
     ["work", set, n]         n pieces of a set of work clothes
     ["workfull"]             a whole set of anything
     ["tower", n | "top"]     cleared that Tower floor
     ["stall", "any"|"all"]   won a prize at a stall, or at every stall
     ["any", clause, ...]     any one of them
   A PERK is { t, ... }: see the DIARY section of the rules file for what each kind does and where it is read. */
export const CONDS = {
  workyard: [
    [[["k", "chicken", "cow", "boar"]], [["g", "copper", "tin", "sardine"]], [["q", "copperbell"]]],
    [[["q", "wheatrun", "emeraldedge"]], [["q", "ferry", "sardines"]], [["c", "v:thrill"]]],
    [[["c", "ev:workyard"]], [["work", "bronny", 1]], [["c", "f:gemsort"]]],
    [[["c", "f:raidlast"]], [["c", "f:sandbag"]], [["workfull"]]]],
  gloam: [
    [[["k", "toadstool", "goat"]], [["g", "trout"]], [["q", "firstbow"]]],
    [[["q", "boneidle", "firstpage"]], [["g", "willowlogs"]], [["c", "pk:highwayman"]]],
    [[["c", "ev:gloam"]], [["g", "emerald_ore"]], [["c", "sc:gloam"], ["g", "ashlogs"]]],
    [[["q", "weaver", "marrow", "nexus"]], [["work", "getaway", 1]], [["c", "lb:gloam"]]]],
  mire: [
    [[["q", "lamps"]], [["g", "lanternfish"]], [["k", "twister"]]],
    [[["q", "lanterns"]], [["q", "vials"]], [["c", "pk:shark"]]],
    [[["c", "ev:mire"]], [["g", "diamond_ore"]], [["c", "sc:mire"], ["g", "yewlogs"]]],
    [[["q", "hw_lights"]], [["c", "lb:mire"]], [["work", "feller", 1]]]],
  boneyard: [
    [[["q", "morrowbones"]], [["k", "ghoul", "stagehand"]], [["g", "bonefish"]]],
    [[["q", "yewbow", "spidersilk"]], [["c", "crypt"]], [["c", "pk:usher"]]],
    [[["q", "dragonstone", "hw_vigil"]], [["k", "critic"]], [["g", "dragonstone_ore", "onyx_ore"], ["any", ["c", "sc:boneyard"], ["c", "sc:boneyard_p"]]]],
    [[["c", "crypt:3"]], [["kn", "chandelier", 100]], [["c", "lb:boneyard"]]]],
  cloud: [
    [[["q", "skyeel"]], [["k", "ram", "brainstorm"]], [["g", "grimstone"]]],
    [[["q", "ramhorns", "frostink"]], [["g", "skyashlogs"]], [["work", "stargazer", 1]]],
    [[["c", "ev:cloud"]], [["c", "pk:angel"]], [["c", "sc:cloud"], ["g", "pinelogs"]]],
    [[["kn", "angel", 100]], [["gn", "onyx_ore", 200]], [["c", "lb:cloud"]]]],
  sands: [
    [[["q", "stardust"]], [["g", "sand", "oasisperch"]], [["k", "mummy"]]],
    [[["q", "caravan"]], [["g", "palmlogs"]], [["c", "pk:mummy"]]],
    [[["c", "pyramid"]], [["q", "cobra", "perchdinner"]], [["c", "ev:sands"]]],
    [[["c", "lb:sands"]], [["pet", "coilling"]], [["c", "sc:sands"], ["g", "pinelogs"]]]],
  thunderhead: [
    [[["k", "golem", "goose"]], [["g", "stormmarlin"]], [["q", "stormrod"]]],
    [[["q", "goosechase", "stormink"]], [["g", "starfall_ore"]], [["tower", 1]]],
    [[["c", "bw:stormdrain"]], [["k", "house"]], [["c", "sc:thunderhead"], ["g", "voidglass"]]],
    [[["tower", "top"]], [["c", "lb:thunderhead"]], [["c", "ev:thunderhead"]]]],
  carnival: [
    [[["c", "pk:pinhead"]], [["stall", "any"]], [["g", "goldfish"]]],
    [[["k", "tripled", "fatlady"]], [["g", "catalytic"]], [["g", "pinelogs"]]],
    [[["k", "strongman"]], [["any", ["c", "sc:carnival"], ["c", "sc:carnival_p"]], ["g", "voidlogs"]], [["stall", "all"]]],
    [[["q", "kingslayer"]], [["c", "lb:carnival"]], [["c", "bw:scraprun"]]]],
  boardwalk: [
    [[["q", "bwmackerel"]], [["k", "gull", "deckhand"]], [["g", "cmackerel"]]],
    [[["c", "v:bw_cabin"], ["c", "v:bw_light"], ["c", "v:bw_wreck"], ["c", "v:bw_pier"], ["c", "v:bw_skull"]], [["gm", "boardwalk", "palmlogs", 1]], [["c", "pk:deckhand"]]],
    [[["q", "bwdeckhands"]], [["k", "krakenarm"]], [["any", ["c", "sc:boardwalk"], ["c", "sc:boardwalk_p"]]]],
    [[["q", "bwcaptain"]], [["c", "lb:boardwalk"]], [["c", "ev:boardwalk"]]]],
  trailer: [
    [[["q", "scrapline"]], [["k", "junkdog"]], [["g", "pinelogs", "bogwoodlogs"]]],
    [[["q", "theking"]], [["g", "mudcat"]], [["c", "pk:scrapper"]]],
    [[["c", "lb:trailer"]], [["g", "slagstone"]], [["any", ["c", "sc:trailer"], ["c", "sc:trailer_p"]], ["g", "fossil"]]],
    [[["work", "sal", 4]], [["g", "singularity_ore"]], [["c", "ev:trailer"]]]],
  vault: [
    [[["k", "warden"]], [["gm", "vault", "starfall_ore", 1]], [["g", "cloudray"]]],
    [[["q", "audit"]], [["g", "eclipse_ore"]], [["g", "voidlogs"]]],
    [[["q", "voidwood", "hoard"]], [["k", "pitboss", "hoard"]], [["c", "pk:warden"]]],
    [[["kn", "dealer", 10]], [["c", "pk:dealer"]], [["kn", "hoard", 25]]]],
  depths: [
    [[["q", "deepcrystal"]], [["k", "potboy", "dwisp"]], [["c", "pk:potboy"]]],
    [[["q", "deepgoblins"]], [["g", "abyss_crystal"]], [["k", "dogre", "diron"]]],
    [[["q", "deepkeeper"]], [["k", "deepwarden"]], [["any", ["c", "sc:depths"], ["c", "sc:depths_p"]], ["g", "slagstone"]]],
    [[["kn", "deepwarden", 25]], [["c", "lb:depths"]], [["l", "deepheart"]]]],
  valley: [
    [[["c", "v:valley"]], [["c", "pk:caveman"]], [["g", "coelacanth"]]],
    [[["k", "sabretooth", "pterodactyl"]], [["g", "cycadlogs"]], [["c", "sc:valley"], ["g", "frostpinelogs"]]],
    [[["k", "mammoth"]], [["c", "bw:iceledge"]], [["c", "ev:valley"]]],
    [[["k", "matriarch"]], [["kn", "caveman", 100]], [["c", "lb:valley"]]]],
  valley_ridge: [
    [[["c", "v:valley_ridge"]], [["k", "raptor"]], [["g", "fossil"]]],
    [[["k", "cavehunter"]], [["k", "pteroelder"]], [["gm", "valley_ridge", "cycadlogs", 1]]],
    [[["kn", "raptor", 50]], [["gn", "fossil", 100]], [["gm", "valley_ridge", "cycadlogs", 100]]],
    [[["kn", "pteroelder", 100]], [["k", "goldenraptor"]], [["c", "pk:cavehunter"]]]],
  valley_lair: [
    [[["c", "v:valley_lair"]], [["k", "tarhorror"]], [["gm", "valley_lair", "fossil", 1]]],
    [[["kn", "tarhorror", 25]], [["km", "valley_lair", "raptor", 1]], [["km", "valley_lair", "pteroelder", 1]]],
    [[["k", "rex"]], [["kn", "rex", 10]], [["l", "rex_tooth"]]],
    [[["pet", "rexling"]], [["l", "rex_necklace"]], [["kn", "rex", 50]]]],
  frozen: [
    [[["c", "v:frozen"]], [["ks", "frostwolf", "magic"]], [["g", "icefin"]]],
    [[["k", "snowowl", "yeti"]], [["g", "glacite"]], [["g", "frostpinelogs"]]],
    [[["k", "frostwraith"]], [["c", "sc:frozen"], ["g", "frostpinelogs"]], [["g", "frostpine_wand"]]],
    [[["c", "ev:frozen"]], [["pet", "wyrmling", "blizzardowl"]], [["c", "lb:frozen"]]]],
  frostspire: [
    [[["c", "v:frostspire"]], [["k", "iceelemental"]], [["gm", "frostspire", "icefin", 1]]],
    [[["k", "frostgiant"]], [["work", "bowyer", 1]], [["gm", "frostspire", "glacite", 1]]],
    [[["k", "frostjarl"]], [["l", "frostbite_ring"]], [["wear", "frostjarl_crown"]]],
    [[["kn", "frostjarl", 25]], [["pet", "jarlhound"]], [["g", "rimeheart"]]]],
  wild: [
    [[["c", "v:wild"]], [["km", "wild", null, 1]], [["any", ["gm", "wild", "ashlogs", 1], ["gm", "wild", "grimstone", 1]]]],
    [[["c", "pvp:wild"]], [["gm", "wild", "gloomfin", 1]], [["c", "pkm:wild"]]],
    [[["c", "pvp:wild", 10]], [["any", ["c", "pvps:wild:archery"], ["c", "pvps:wild:magic"]]], [["km", "wild", "dgoblin", 1], ["km", "wild", "dogre", 1]]],
    [[["c", "f:pvpup:wild"]], [["c", "f:pvp3"]], [["gm", "wild", "dragonstone_ore", 100]]]],
  deep: [
    [[["c", "v:deep"]], [["k", "grimlich"]], [["any", ["gm", "deep", "onyx_ore", 1], ["gm", "deep", "skyashlogs", 1]]]],
    [[["c", "pvp:deep"]], [["gm", "deep", "starfall_ore", 1]], [["c", "pkm:deep"]]],
    [[["c", "pvp:deep", 10]], [["g", "gallowslogs"]], [["g", "voidfin"]]],
    [[["c", "f:pvpup:deep"]], [["c", "pvp:deep", 25]], [["gn", "voidfin", 100]]]],
  thrill: [
    [[["c", "lap:rookie"]], [["c", "buy:corndog"]], [["c", "talk:Fast Eddie"]]],
    [[["c", "lap:pro"]], [["c", "st:climb"]], [["g", "featherlogs"]]],
    [[["c", "pk:gremlin"]], [["cs", 50, "lap:rookie", "lap:pro"]], [["work", "prospector", 1]]],
    [[["c", "st:cannon"]], [["c", "lap:pro", 100]], [["l", "stunt_leathers"]]]],
  thrill_top: [
    [[["c", "v:thrill_top"]], [["k", "hellbiker"]], [["g", "nitroeel"]]],
    [[["c", "lap:champ"]], [["c", "pk:hellbiker"]], [["g", "cnitroeel"]]],
    [[["c", "st:jump"]], [["g", "chrome"]], [["k", "crusher"]]],
    [[["c", "lap:champ", 100]], [["pet", "lilcrusher"]], [["wear", "chrome_boots"], ["g", "chrome_boots"]]]],
};
/* THE PERKS, in the order diaries.js words them. Kinds (read in the rules file's DIARY section and the worker):
     speed  { items, m, scene? }   gathering those (fishing bites too) m faster; scene = only on that map
     price  { shop, m }            that shop or fee costs m less (m is the fraction off)
     sell   { shop, items?, m }    that buyer pays m more (for those items only, if named)
     pay    { what, m }            that payout is m bigger
     tele   { scene }              a free teleport there, once a day, from the Diary tab
     chest  { boss }               that boss's chest rolls once more, once a day; a boss with no chest (a monster key) rolls its table twice on
                                   your first kill of the day
     hitin  { mobs, m, scene? }    those monsters hit m less hard
     aggro  { mobs }               those monsters notice you a tile later
     drop   { mobs, m }            their drop table m more often
     xp     { what, m }            that XP m bigger
     see    { what }               a forecast or a head count shown in the Diary tab
     death  { m }                  lose m less on a death on that map
     keep   { m }                  your gear m less likely to drop on a death on that map
     extra  { item, n, from }      one more of an item from a gather
     double { item, p, scene }     a gather comes up twice, p of the time
     nofail { what }               no slips there
     plus   { what }               a one-off, read where that one thing happens: drain (the Storm Drain needs no level), cold (the Reach's cold
                                   bites 10% less), depthgems (gems 10% more often in the Depths) */
export const PERKS = {
  workyard: [{ t: "sell", shop: "bom", m: 0.05 }, { t: "price", shop: "gemsorter", m: 0.1 }, { t: "pay", what: "raid", m: 0.1 }, { t: "tele", scene: "workyard" }],
  gloam: [{ t: "speed", items: ["trout"], m: 0.1, scene: "gloam" }, { t: "price", shop: "lockpick", m: 0.1 }, { t: "speed", items: ["willowlogs"], m: 0.1 }, { t: "xp", what: "guildmarks", m: 0.1 }],
  mire: [{ t: "hitin", mobs: ["taxwraith", "shark"], m: 0.1, scene: "mire" }, { t: "speed", items: ["lanternfish"], m: 0.1 }, { t: "drop", mobs: ["moth"], m: 0.1 }, { t: "speed", items: ["diamond_ore"], m: 0.1, scene: "mire" }],
  boneyard: [{ t: "drop", mobs: ["chandelier"], m: 0.1 }, { t: "price", shop: "crypt", m: 0.1 }, { t: "speed", items: ["bonefish"], m: 0.1 }, { t: "chest", boss: "crypt" }],
  cloud: [{ t: "speed", items: ["skyeel"], m: 0.1 }, { t: "price", shop: "startent", m: 0.05 }, { t: "speed", items: ["skyashlogs"], m: 0.1 }, { t: "tele", scene: "cloud" }],
  sands: [{ t: "speed", items: ["oasisperch"], m: 0.1 }, { t: "hitin", mobs: ["cobra", "scarab", "mummy", "jackal"], m: 0.1, scene: "sands" }, { t: "chest", boss: "pyramid" }, { t: "tele", scene: "sands" }],
  thunderhead: [{ t: "speed", items: ["stormmarlin"], m: 0.1 }, { t: "hitin", mobs: ["golem", "wolf"], m: 0.1 }, { t: "speed", items: ["starfall_ore"], m: 0.1 }, { t: "plus", what: "drain" }],
  carnival: [{ t: "price", shop: "carnival", m: 0.1 }, { t: "speed", items: ["goldfish"], m: 0.1 }, { t: "speed", items: ["catalytic"], m: 0.1 }, { t: "tele", scene: "carnival" }],
  boardwalk: [{ t: "tele", scene: "boardwalk" }, { t: "speed", items: ["mackerel"], m: 0.1 }, { t: "hitin", mobs: ["deckhand", "krakenarm"], m: 0.1 }, { t: "chest", boss: "claw" }],
  trailer: [{ t: "sell", shop: "bom", items: ["catalytic"], m: 0.1 }, { t: "speed", items: ["mudcat"], m: 0.1 }, { t: "speed", items: ["slagstone", "singularity_ore"], m: 0.1, scene: "trailer" }, { t: "tele", scene: "trailer" }],
  vault: [{ t: "aggro", mobs: ["warden"] }, { t: "speed", items: ["cloudray"], m: 0.1 }, { t: "speed", items: ["eclipse_ore", "nova_ore"], m: 0.1, scene: "vault" }, { t: "drop", mobs: ["dealer"], m: 0.1 }],
  depths: [{ t: "speed", items: ["abyss_crystal"], m: 0.1 }, { t: "hitin", mobs: ["dogre", "diron"], m: 0.1, scene: "depths" }, { t: "plus", what: "depthgems" }, { t: "chest", boss: "deepwarden" }],
  valley: [{ t: "speed", items: ["coelacanth"], m: 0.1 }, { t: "speed", items: ["cycadlogs"], m: 0.1 }, { t: "hitin", mobs: ["caveman", "cavehunter"], m: 0.1 }, { t: "tele", scene: "valley" }],
  valley_ridge: [{ t: "speed", items: ["fossil"], m: 0.1, scene: "valley_ridge" }, { t: "aggro", mobs: ["raptor"] }, { t: "drop", mobs: ["pteroelder"], m: 0.1 }, { t: "tele", scene: "valley_ridge" }],
  valley_lair: [{ t: "hitin", mobs: ["tarhorror"], m: 0.1 }, { t: "double", item: "fossil", p: 0.1, scene: "valley_lair" }, { t: "chest", boss: "rex" }, { t: "aggro", mobs: ["raptor", "tarhorror"] }],
  frozen: [{ t: "plus", what: "cold" }, { t: "speed", items: ["icefin"], m: 0.1 }, { t: "speed", items: ["glacite"], m: 0.1 }, { t: "see", what: "wyrm" }],
  frostspire: [{ t: "hitin", mobs: ["frostgiant"], m: 0.1 }, { t: "speed", items: ["glacite", "frostpinelogs"], m: 0.1, scene: "frostspire" }, { t: "chest", boss: "frostjarl" }, { t: "tele", scene: "frostspire" }],
  wild: [{ t: "see", what: "wild" }, { t: "death", m: 0.2 }, { t: "speed", items: ["gloomfin"], m: 0.1, scene: "wild" }, { t: "tele", scene: "wild" }],
  deep: [{ t: "see", what: "deep" }, { t: "speed", items: ["voidfin"], m: 0.1 }, { t: "speed", items: ["gallowslogs"], m: 0.1 }, { t: "keep", m: 0.5 }],
  thrill: [{ t: "price", shop: "eddie", m: 0.1 }, { t: "extra", item: "feather", n: 1, from: "featherlogs" }, { t: "xp", what: "lap:pro", m: 0.1 }, { t: "nofail", what: "cannon" }],
  thrill_top: [{ t: "speed", items: ["nitroeel"], m: 0.1 }, { t: "aggro", mobs: ["hellbiker"] }, { t: "chest", boss: "crusher" }, { t: "tele", scene: "thrill_top" }],
};
