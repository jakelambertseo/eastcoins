# The Foundry (composed from the volcano pack's mockups): the walkable grid, drawn by hand over lt-wild/cut/foundry-bg-grid.png.
# Everything is rock floor unless it is lava, a wall, a statue, a spike bed or a vent. Writes lt-wild/cut/foundry-rows.json.
import json
W, H = 44, 26
g = [["."] * W for _ in range(H)]
def rect(x0, y0, x1, y1, c="~"):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H: g[y][x] = c
# LAVA. the river down the left edge
rect(0, 0, 3, 3); rect(0, 4, 2, 25); rect(3, 4, 4, 7); rect(3, 24, 4, 25)
# the pools at the top right, the tongue on the left, the strips on the workfloor
rect(29, 1, 31, 3); rect(40, 0, 43, 7); rect(42, 8, 43, 10)
rect(4, 10, 7, 11)
rect(10, 24, 13, 25); rect(28, 23, 33, 25); rect(36, 18, 43, 18); rect(41, 19, 43, 19); rect(36, 24, 39, 25)
# the arena's ring: two towers under the statues, the sides, the bottom; the floor inside stays open
rect(15, 4, 20, 7); rect(24, 4, 30, 7); rect(14, 8, 16, 18); rect(28, 8, 30, 18); rect(15, 16, 29, 18); rect(16, 15, 17, 15); rect(27, 15, 28, 15)
# the arena floor and the passage between the statues, said again so the ring rects cannot have swallowed them
rect(17, 8, 27, 14, "."); rect(18, 15, 26, 15, "."); rect(20, 2, 23, 7, ".")
# STATUES, WALLS, SPIKES, VENTS
rect(17, 2, 19, 6); rect(24, 2, 26, 6)                       # the two demons
rect(6, 1, 8, 3); rect(9, 3, 10, 4)                          # top-left walls and vent
rect(5, 8, 12, 9); rect(9, 10, 12, 12); rect(4, 12, 7, 15); rect(9, 13, 12, 15)   # the wall band, the cage, the crystal beds
rect(31, 5, 33, 12); rect(35, 4, 38, 7); rect(35, 11, 38, 14)   # pillars and spike beds on the right
rect(37, 8, 38, 9); rect(39, 8, 41, 10)
# the workfloor
rect(4, 20, 8, 22); rect(12, 20, 16, 22); rect(22, 20, 24, 22); rect(28, 20, 31, 22); rect(34, 20, 38, 22)
rect(5, 24, 9, 25); rect(24, 24, 27, 25); rect(41, 22, 43, 25)
rect(19, 19, 20, 19); rect(10, 19, 11, 19)                   # vents at the top of the floor
# the lava strip between the two bands must leave the side corridors open: the strips' own rock is walkable
# the way in: the stair at the top edge, north to the Thunderhead
for x in (20, 21, 22, 23): g[0][x] = "e"
rows = ["".join(r) for r in g]
walk = set(".e")
def reach(sx, sy):
    seen = {(sx, sy)}; q = [(sx, sy)]
    while q:
        x, y = q.pop()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if (nx, ny) in seen or not (0 <= nx < W and 0 <= ny < H) or g[ny][nx] not in walk: continue
                if dx and dy and (g[y][nx] not in walk or g[ny][x] not in walk): continue
                seen.add((nx, ny)); q.append((nx, ny))
    return seen
seen = reach(21, 0)
lost = [(x, y) for y in range(H) for x in range(W) if g[y][x] in walk and (x, y) not in seen]
print("walkable", sum(r.count(".") + r.count("e") for r in rows), "unreachable", len(lost), lost[:16])
json.dump(rows, open("C:/Users/jake/code/eastcoins/lt-wild/cut/foundry-rows.json", "w"))
