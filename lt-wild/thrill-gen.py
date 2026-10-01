# THRILL HILL, two maps (2026-10-01, v1.1; the owner: "lets start on the agility map for v.1.1 as well called "Thrill Hill". lets make it have
# some character, ie: thrilling, giant monster trucks, dirt bikes, flaming things, etc."). Agility's own map: the courses are PENS walled
# with crash barriers, and the only way from one pen to the next is the stunt in the barrier between them, so a lap is the stunts in order.
#   thrill      Thrill Hill, down the Yard's old ladder: the Rookie Run (1, west), the Pro Run (40, east), the Junk Mound (Agility 50:
#               Grease Gremlins, featherwood), and the human cannonball (Agility 70) up to
#   thrill_top  Daredevil Peak: the Champion Run (70), the Burnout Pit (Hellbikers, the nitro pool), and the Peak (Agility 90: Big Daddy
#               Crusher, chrome, a lockbox). A zip line back down.
# Lays out each map's ground (the Yard's grass, the cobble road on ',', water), its barriers, props, stunts and monsters, CHECKS it (every
# stunt joins two different regions; each course runs region to region in order and starts and ends in the open; every open cell is
# reachable from the arrival through stunts; the Junk Mound and the Peak only through their gate), and writes the scenes into
# v3/assets/js/eastscape-closed.js between the THRILL-GEN markers.      python lt-wild/thrill-gen.py
import json, re, sys
W, H = 44, 26
bad = 0
def fail(msg):
    global bad; bad += 1; print("  !!", msg)

def rect(cells, x0, y0, x1, y1):
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for x in range(min(x0, x1), max(x0, x1) + 1): cells.add((x, y))

MAPS = {}
# ---------------------------------------------------------------- THRILL HILL
m = MAPS["thrill"] = dict(name="Thrill Hill", entry=(22, 2), exitTo={"scene": "workyard", "x": 39, "y": 21}, edge=True, road=set(), water=set(), walls=set())
rect(m["road"], 21, 0, 22, 21); rect(m["road"], 14, 20, 34, 21)
w = m["walls"]
rect(w, 18, 0, 18, 18); rect(w, 25, 0, 25, 18)
for y in (6, 12, 18): rect(w, 0, y, 17, y); rect(w, 26, y, 43, y)
rect(w, 9, 7, 9, 11); rect(w, 34, 7, 34, 11)
rect(w, 13, 19, 13, 25)                                   # the Junk Mound's east side (its north side is the Rookie Run's floor)
m["stunts"] = [
    # course, index, x, y, w, h, art, how, name, a (near side), b (far side)
    ("rookie", 0, 18, 3, "th_tyrewall", "climb", "Tyre wall", (19, 3), (17, 3)),
    ("rookie", 1, 2, 6, "th_ropeswing", "rope", "Rope swing", (2, 5), (2, 7)),
    ("rookie", 2, 9, 9, "th_plank", "log", "Balance plank", (8, 9), (10, 9)),
    ("rookie", 3, 16, 12, "th_ramp", "jump", "Dirt-bike ramp", (16, 11), (16, 13)),
    ("rookie", 4, 18, 15, "th_hoop", "dive", "Flaming hoop", (17, 15), (19, 15)),
    ("pro", 0, 25, 3, "th_cars", "climb", "Crushed-car pile", (24, 3), (26, 3)),
    ("pro", 1, 41, 6, "th_net", "climb", "Cargo net", (41, 5), (41, 7)),
    ("pro", 2, 34, 9, "th_firebarrels", "leap", "Burning barrels", (35, 9), (33, 9)),
    ("pro", 3, 27, 12, "th_tyreswing", "swing", "Tyre swing", (27, 11), (27, 13)),
    ("pro", 4, 25, 15, "th_halfpipe", "jump", "Half-pipe", (26, 15), (24, 15)),
    (None, 0, 13, 22, "th_tyrewall", "climb", "Over the scrap", (14, 22), (12, 22)),          # the Junk Mound's gate, Agility 50
]
m["gates"] = {(13, 22): 50}
m["cannon"] = dict(x=23, y=9, w=2, h=2, art="th_cannon", a=(22, 9), lvl=70, to={"scene": "thrill_top", "x": 21, "y": 23}, name="The human cannonball")
m["props"] = [("th_grandstand", 36, 20, 5, 3), ("th_truck", 15, 23, 3, 2), ("th_scoreboard", 28, 23, 3, 2), ("th_firebarrels", 42, 24, 2, 1),
              ("th_snackcart", 31, 23, 3, 2), ("th_booth", 19, 1, 1, 1), ("th_trash", 34, 23, 1, 1), ("th_trash", 18, 19, 1, 1), ("th_trash", 26, 19, 1, 1), ("th_trash", 41, 19, 1, 1),
              ("th_tyres", 24, 24, 1, 1), ("th_tyres", 33, 19, 1, 1), ("th_tyres", 43, 19, 1, 1), ("th_firebarrels", 19, 24, 2, 1)]
m["decor"] = [("th_oil1", 30, 20), ("th_oil2", 42, 22), ("th_oil1", 3, 2), ("th_oil2", 38, 15), ("th_oil1", 7, 15), ("th_oil2", 30, 9)]
m["trees"] = [(1, 20), (11, 20), (6, 25)]          # featherwood, in the Junk Mound
m["rocks"] = []
m["spots"] = []
m["mobs"] = [("gremlin", 3, 22), ("gremlin", 8, 22), ("gremlin", 5, 24)]
m["sign"] = (24, 1, "THRILL HILL. The Rookie Run is through the tyres to the west, from any Agility. The Pro Run is over the cars to the east, from 40. Run the stunts in order and a lap pays a bonus, and sometimes a runner's mark: Fast Eddie at the start line takes marks. The Junk Mound (50) is south-west, over the scrap. The cannon (70) goes to Daredevil Peak.")
m["npcs"] = [dict(name="Fast Eddie", art="fasteddie", x=20, y=2, opens="bookie", still=True, hair="#d8b048", shirt="#c83a2a", pants="#2a2a3a",
                  lines=["Marks, kid. I take marks. Bring 'em to me.", "Rookie Run first. Nobody's ever been hurt on it. Much.", "The cannon? Seventy Agility and a strong neck.", "Run 'em in order or it's not a lap. That's the rule. I made it."]),
             dict(name="Corndog Carl", art="vendor", x=32, y=22, opens="snacks", still=True,
                  lines=["Popcorn! Lemonade! Corn dogs! Get 'em while the trucks are running!", "Lemonade's pink. Don't ask why. It's better that way.", "Eat it before the half-pipe, not after. Trust me.", "Thirty years at this cart. Seen a man jump eleven buses. Seen a man not."])]
m["bots"] = [dict(name="RampRat", level=23, x=20, y=16), dict(name="SendItSteve", level=48, x=29, y=21), dict(name="NitroNan", level=66, x=23, y=12)]

# ---------------------------------------------------------------- DAREDEVIL PEAK
m = MAPS["thrill_top"] = dict(name="Daredevil Peak", entry=(21, 23), exitTo=None, edge=False, road=set(), water=set(), walls=set())
rect(m["road"], 16, 23, 33, 23); rect(m["road"], 20, 8, 20, 23); rect(m["road"], 20, 12, 35, 12); rect(m["road"], 35, 11, 35, 12)
rect(m["water"], 36, 17, 41, 21)
w = m["walls"]
rect(w, 13, 0, 13, 25)
rect(w, 0, 14, 12, 14); rect(w, 0, 7, 12, 7)
rect(w, 14, 7, 26, 7); rect(w, 27, 0, 27, 10); rect(w, 28, 10, 43, 10)
m["stunts"] = [
    ("champ", 0, 13, 20, "th_buses", "jump", "Jump the buses", (14, 20), (12, 20)),
    ("champ", 1, 6, 14, "th_firewall", "dive", "Through the fire", (6, 15), (6, 13)),
    ("champ", 2, 2, 7, "th_net", "climb", "Cargo net", (2, 8), (2, 6)),
    ("champ", 3, 13, 3, "th_highwire", "rope", "High wire", (12, 3), (14, 3)),
    ("champ", 4, 20, 7, "th_halfpipe", "jump", "Half-pipe drop", (20, 6), (20, 8)),
    (None, 0, 35, 10, "th_ramp", "jump", "Up the crusher ramp", (35, 11), (35, 9)),          # the Peak's gate, Agility 90
]
m["gates"] = {(35, 10): 90}
m["cannon"] = dict(x=25, y=22, w=2, h=3, art="th_zipline", a=(24, 23), lvl=70, to={"scene": "thrill", "x": 21, "y": 11}, name="Zip line down to Thrill Hill")
m["props"] = [("th_truck", 30, 14, 3, 2), ("th_firebarrels", 16, 24, 2, 1), ("th_tyres", 15, 9, 1, 1), ("th_tyres", 43, 13, 1, 1), ("th_firebarrels", 42, 24, 2, 1),
              ("th_tyres", 26, 9, 1, 1)]
m["decor"] = [("th_landing", 20, 22), ("th_oil1", 24, 15), ("th_oil2", 31, 19), ("th_oil1", 17, 17), ("th_oil2", 32, 5), ("th_oil1", 9, 20), ("th_oil2", 5, 3)]
m["trees"] = []
m["rocks"] = [(29, 1), (42, 2), (41, 8)]           # chrome, on the Peak
m["spots"] = [(37, 18), (40, 20), (37, 21)]        # the nitro pool
m["mobs"] = [("hellbiker", 18, 12), ("hellbiker", 30, 17), ("hellbiker", 24, 18), ("hellbiker", 33, 22), ("crusher", 35, 4)]
m["sign"] = (19, 24, "DAREDEVIL PEAK. The Champion Run starts over the buses to the west. Hellbikers ride the Burnout Pit (pick them at Thieving 70); the nitro pool is east (Fishing 75). The Peak (Agility 90) is up the ramp north: Big Daddy Crusher, chrome, a lockbox. The zip line takes you back down.")
m["npcs"] = []
m["bots"] = [dict(name="WheelieWendy", level=81, x=23, y=16), dict(name="CannonCarl", level=74, x=30, y=20)]

# ---------------------------------------------------------------- THE TRACKS AND THE CLUTTER
# A track (the cobble road, two wide) runs inside each pen from where one stunt lands to where the next is stood at, so a lap reads as a
# course on the ground. Then each pen gets its junk: tyre stacks, burning barrels, crushed cars, trucks and oil, only on a cell whose eight
# neighbours are all clear and off the track, so a piece can never pinch a passage shut (the checks below would say so anyway).
import random
def track(m, p, q):
    (x0, y0), (x1, y1) = p, q
    for x in range(min(x0, x1), max(x0, x1) + 1):
        for yy in (y0, y0 + (1 if y0 < 25 else -1)): m["road"].add((x, yy))
    for y in range(min(y0, y1), max(y0, y1) + 1):
        for xx in (x1, x1 + (1 if x1 < 43 else -1)): m["road"].add((xx, y))
for key, m in MAPS.items():
    for crs in sorted({s[0] for s in m["stunts"] if s[0]}):
        seq = sorted([s for s in m["stunts"] if s[0] == crs], key=lambda s: s[1])
        for p, q in zip(seq, seq[1:]): track(m, p[8], q[7])
JUNK = [("th_trash", 1, 1), ("th_tyres", 1, 1), ("th_tyres", 1, 1), ("th_firebarrels", 2, 1), ("th_cars", 2, 1), ("o_barrel", 1, 1), ("th_flamebarrel", 1, 1), ("o_cones", 1, 1)]
SCATTER = {"thrill": [((0, 0, 17, 5), 5), ((0, 7, 8, 11), 2), ((10, 7, 17, 11), 2), ((0, 13, 17, 17), 5), ((26, 0, 43, 5), 5), ((35, 7, 43, 11), 3), ((26, 7, 33, 11), 3), ((26, 13, 43, 17), 5),
                      ((14, 19, 43, 25), 7), ((0, 19, 12, 25), 2)],
           "thrill_top": [((0, 15, 12, 25), 5), ((0, 8, 12, 13), 3), ((0, 0, 12, 6), 4), ((14, 0, 26, 6), 4), ((14, 8, 43, 25), 9), ((28, 0, 43, 9), 3)]}
for key, m in MAPS.items():
    rnd = random.Random(key)
    taken = set(m["walls"]) | m["road"] | m["water"] | {(s[2], s[3]) for s in m["stunts"]}
    for (art, x, y, w, h) in m["props"]:
        for j in range(h):
            for i in range(w): taken.add((x + i, y + j))
    c = m["cannon"]
    for j in range(c["h"]):
        for i in range(c["w"]): taken.add((c["x"] + i, c["y"] + j))
    keep = set()
    for s in m["stunts"]: keep |= {s[7], s[8]}
    keep |= {c["a"], m["entry"]} | {(n["x"], n["y"]) for n in m["npcs"]} | {(bt["x"], bt["y"]) for bt in m["bots"]} | {(x, y) for (_, x, y) in m["mobs"]} | set(m["trees"]) | set(m["rocks"]) | set(m["spots"])
    if m["sign"]: keep.add((m["sign"][0], m["sign"][1]))
    if key in ("thrill_top",): keep.add((29, 8))
    for (x0, y0, x1, y1), n in SCATTER[key]:
        tries = 0
        while n and tries < 400:
            tries += 1
            art, w, h = rnd.choice(JUNK)
            x, y = rnd.randint(x0, x1 - w + 1), rnd.randint(y0, y1 - h + 1)
            cells = [(x + i, y + j) for j in range(h) for i in range(w)]
            ring = {(a + dx, b + dy) for (a, b) in cells for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
            if any(not (0 <= a < W and 0 <= b < H) for (a, b) in ring): continue
            if ring & taken or ring & keep or any(max(abs(a - k[0]), abs(b - k[1])) < 2 for (a, b) in cells for k in keep): continue
            m["props"].append((art, x, y, w, h)); taken |= set(cells); n -= 1
    for _ in range(6):   # a few more oil slicks, walked over
        x, y = rnd.randint(1, 42), rnd.randint(1, 24)
        if (x, y) not in taken and (x, y) not in m["road"]: m["decor"].append((rnd.choice(["th_oil1", "th_oil2"]), x, y))
    for _ in range(8):   # popcorn boxes and cups, walked over
        x, y = rnd.randint(1, 42), rnd.randint(1, 24)
        if (x, y) not in taken: m["decor"].append(("o_carnlitter", x, y))

LOCKBOX = {"thrill_top": (29, 8)}       # LOCKBOXES in the rules file must agree
PERCH = set()
out = []
for key, m in MAPS.items():
    g = [["."] * W for _ in range(H)]
    for (x, y) in m["water"]: g[y][x] = "~"
    for (x, y) in m["road"]: g[y][x] = ","
    if m["edge"]:
        for x in (21, 22, 23): g[0][x] = "e"
    rows = ["".join(r) for r in g]
    blk = [r[:] for r in g]
    def block(x0, y0, ww, hh, what, allow=".,"):
        for y in range(y0, y0 + hh):
            for x in range(x0, x0 + ww):
                if not (0 <= x < W and 0 <= y < H): fail(f"{key}: {what} off the map at {x},{y}"); continue
                if blk[y][x] not in allow: fail(f"{key}: {what} at {x0},{y0} covers '{blk[y][x]}' at {x},{y}")
                blk[y][x] = "#"
    stunt_tiles = {(s[2], s[3]) for s in m["stunts"]}
    for (x, y) in sorted(m["walls"]):
        if (x, y) in stunt_tiles: continue
        block(x, y, 1, 1, "barrier")
    for s in m["stunts"]: block(s[2], s[3], 1, 1, s[8])
    c = m["cannon"]; block(c["x"], c["y"], c["w"], c["h"], c["name"])
    for (art, x, y, ww, hh) in m["props"]: block(x, y, ww, hh, art)
    for (x, y) in m["trees"] + m["rocks"]: block(x, y, 1, 1, "node")
    if m["sign"]: block(m["sign"][0], m["sign"][1], 1, 1, "sign")
    if key in LOCKBOX: block(*LOCKBOX[key], 1, 1, "lockbox")
    for n in m["npcs"]:
        if blk[n["y"]][n["x"]] not in ".,": fail(f"{key}: {n['name']} on '{blk[n['y']][n['x']]}'")
    walk = set(".,e")
    # regions: flood fill with every stunt shut
    region = {}
    def fill(start, rid):
        st = [start]; region[start] = rid
        while st:
            x, y = st.pop()
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if (nx, ny) in region or not (0 <= nx < W and 0 <= ny < H) or blk[ny][nx] not in walk: continue
                    if dx and dy and (blk[y][nx] not in walk or blk[ny][x] not in walk): continue
                    region[(nx, ny)] = rid; st.append((nx, ny))
    nreg = 0
    for y in range(H):
        for x in range(W):
            if blk[y][x] in walk and (x, y) not in region: fill((x, y), nreg); nreg += 1
    pub = region.get(m["entry"])
    if pub is None: fail(f"{key}: the arrival {m['entry']} is not open ground")
    if c["a"] not in region or region[c["a"]] != pub: fail(f"{key}: {c['name']} is not stood at from the open ground")
    edges = []
    for s in m["stunts"]:
        crs, i, x, y, art, how, name, a, b = s
        for p in (a, b):
            if p not in region: fail(f"{key}: {name}'s side {p} is not open ground")
        if a in region and b in region:
            if region[a] == region[b]: fail(f"{key}: {name} joins a region to itself: it shortcuts nothing")
            edges.append((region[a], region[b], m["gates"].get((x, y), 0)))
        if max(abs(a[0] - x), abs(a[1] - y)) != 1 or max(abs(b[0] - x), abs(b[1] - y)) != 1: fail(f"{key}: {name}'s sides are not beside it")
    # each course: starts in the open, each stunt lands where the next one is stood at, ends in the open
    for crs in sorted({s[0] for s in m["stunts"] if s[0]}):
        seq = sorted([s for s in m["stunts"] if s[0] == crs], key=lambda s: s[1])
        if region.get(seq[0][7]) != pub: fail(f"{key}: the {crs} run does not start in the open")
        if region.get(seq[-1][8]) != pub: fail(f"{key}: the {crs} run does not end in the open")
        for p, q in zip(seq, seq[1:]):
            if region.get(p[8]) != region.get(q[7]): fail(f"{key}: {crs} {p[6]} lands somewhere {q[6]} isn't")
    # every region is reachable through stunts from the arrival
    seen = {pub}; q = [pub]
    while q:
        r = q.pop()
        for (u, v, _) in edges:
            for (s, t) in ((u, v), (v, u)):
                if s == r and t not in seen: seen.add(t); q.append(t)
    lost = [p for p, r in region.items() if r not in seen]
    if lost: fail(f"{key}: {len(lost)} open cells in no course, e.g. {lost[:6]}")
    # a gated place: its region touches nothing but its gate
    for (gx, gy), lvl in m["gates"].items():
        s = next(s for s in m["stunts"] if (s[2], s[3]) == (gx, gy)); inside = region[s[8]]
        if sum(1 for (u, v, _) in edges if inside in (u, v)) != 1: fail(f"{key}: the Agility {lvl} place has more than one way in")
    for bt in m["bots"]:
        if blk[bt["y"]][bt["x"]] not in walk or region.get((bt["x"], bt["y"])) != pub: fail(f"{key}: bot {bt['name']} doesn't start in the open")
    for (t, x, y) in m["mobs"]:
        if blk[y][x] not in walk: fail(f"{key}: {t} at {x},{y} stands on '{blk[y][x]}'")
    for (x, y) in m["spots"]:
        if g[y][x] != "~": fail(f"{key}: fishing spot {x},{y} not on water")
        elif not any(0 <= x + i < W and 0 <= y + j < H and blk[y + j][x + i] in ".," for i in (-2, -1, 0, 1, 2) for j in (-2, -1, 0, 1, 2)): fail(f"{key}: fishing spot {x},{y} has no bank")
    print(f"{key}: {nreg} regions, {len(m['stunts'])} stunts, {len(m['mobs'])} monsters, {sum(r.count('.') + r.count(',') for r in blk)} open cells")
    # the barriers, merged into runs (a long piece is one object, not twelve)
    wl = sorted(p for p in m["walls"] if p not in stunt_tiles)
    used, pieces = set(), []
    for (x, y) in wl:
        if (x, y) in used: continue
        n = 0
        while (x + n, y) in m["walls"] and (x + n, y) not in stunt_tiles and (x + n, y) not in used and n < 4: n += 1
        if n >= 2:
            for i in range(n): used.add((x + i, y))
            pieces.append((f"th_barh{n}", x, y, n, 1)); continue
        n = 0
        while (x, y + n) in m["walls"] and (x, y + n) not in stunt_tiles and (x, y + n) not in used and n < 4: n += 1
        n = max(n, 1)
        for i in range(n): used.add((x, y + i))
        pieces.append((f"th_barv{n}", x, y, 1, n))
    m["pieces"] = pieces; m["rows"] = rows
    print(f"   {len(pieces)} barrier pieces")

if bad: print(f"{bad} problem(s)"); sys.exit(1)

def js(v): return json.dumps(v)
MOB_OPT = {"crusher": "{ respawn: 10 * 60000 }"}
parts = []
for key, m in MAPS.items():
    c = m["cannon"]
    stunts = [{"crs": s[0], "i": s[1], "n": sum(1 for t in m["stunts"] if t[0] == s[0]) if s[0] else 1, "x": s[2], "y": s[3], "art": s[4], "how": s[5], "name": s[6],
               "a": list(s[7]), "b": list(s[8]), **({"gate": m["gates"][(s[2], s[3])]} if (s[2], s[3]) in m["gates"] else {})} for s in m["stunts"]]
    stunts.append({"crs": None, "i": 0, "n": 1, "x": c["x"], "y": c["y"], "w": c["w"], "h": c["h"], "art": c["art"], "how": "cannon" if key == "thrill" else "zip", "name": c["name"],
                   "a": list(c["a"]), "b": list(c["a"]), "gate": c["lvl"], "to": c["to"]})
    mobs = ", ".join(f'["{t}", {x}, {y}, {MOB_OPT.get(t, f"{{ respawn: G.levelRespawn(\"{t}\") }}")}]' for (t, x, y) in m["mobs"])
    rows = ",\n".join(f'      "{r}"' for r in m["rows"])
    head = f'name: {js(m["name"])}, ground: "thrill", entry: {js({"x": m["entry"][0], "y": m["entry"][1]})}, '
    head += f'exitTo: {js(m["exitTo"])}, ' if m["exitTo"] else 'exitTo: { scene: "thrill", x: 21, y: 11 }, '   # (the Peak has no edge: exitTo is only where the Yard's door logic would send you)
    lay = {"cliffs": [], "props": [list(p) for p in m["pieces"]] + [list(p) for p in m["props"]], "decor": [list(d) for d in m["decor"]], "cycads": [list(t) for t in m["trees"]], "rocks": [list(r) for r in m["rocks"]],
           "spots": [list(s) for s in m["spots"]], "sign": list(m["sign"]) if m["sign"] else None, "stunts": stunts, "kit": "KIT"}
    npcs = js(m["npcs"])
    body = js(lay).replace('"KIT"', f"THRILL_KIT.{key}")
    parts.append(f'''  {key}: {{
    {head}noBanks: true, held: "thrill", tint: "rgba(70,40,10,.07)",
    rows: [
{rows}
    ],
    build() {{ return pvBuild(G, this, {body}); }},
    mobs: [{mobs}],
    npcs: {npcs}, bots: {js(m["bots"])}
  }},''')
block = "  /* THRILL-GEN: Thrill Hill and Daredevil Peak, written by lt-wild/thrill-gen.py (edit that, not this) */\n" + "\n".join(parts) + "\n  /* THRILL-GEN END */\n"
p = "C:/Users/jake/code/eastcoins/v3/assets/js/eastscape-closed.js"
s = open(p, encoding="utf-8").read()
if "/* THRILL-GEN:" in s: s = re.sub(r"  /\* THRILL-GEN:.*?/\* THRILL-GEN END \*/\n", lambda _: block, s, flags=re.S)
else:
    i = s.index("  /* VALLEY-GEN END */\n") + len("  /* VALLEY-GEN END */\n")
    s = s[:i] + block + s[i:]
open(p, "w", encoding="utf-8", newline="").write(s)
print("written")
