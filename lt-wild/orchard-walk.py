# The Orchard Wall (composed from the Grass Land pack's mockups): the walkable grid, drawn by hand over lt-wild/cut/orchard-bg-grid.png.
# '.' grass and path, '~' water, '#' a tree, a fence, a tent, a stall: anything that stands. Writes lt-wild/cut/orchard-rows.json.
import json
W, H = 44, 26
g = [["."] * W for _ in range(H)]
def rect(x0, y0, x1, y1, c="#"):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= x < W and 0 <= y < H: g[y][x] = c
# WATER. the brook down the village's east side, the wide water below it, the pond at the bottom left
rect(25, 0, 27, 10, "~"); rect(25, 14, 27, 14, "~")
rect(15, 15, 27, 18, "~"); rect(20, 19, 27, 25, "~"); rect(16, 19, 19, 19, "~")
rect(0, 15, 12, 19, "~"); rect(0, 14, 1, 14, "~")
# the bridge over the brook: its deck is rows 12-13, the water either side of it
rect(25, 11, 27, 11, "~"); rect(23, 11, 24, 11)   # the deck is reached from the bank below it, row 14
# TREES. the canopies at the top, the two trees by the stall, the dark trees and totems of the orc side
rect(0, 0, 9, 3); rect(14, 0, 24, 4); rect(6, 4, 8, 7); rect(19, 5, 24, 6); rect(4, 3, 5, 3)
rect(28, 16, 33, 20); rect(28, 21, 30, 25); rect(34, 16, 35, 18); rect(41, 21, 43, 25); rect(39, 19, 40, 22); rect(31, 20, 32, 22)
# THE STALL and what stands round it: the wagon, the lamp post, the barrels, the crates and the pot, the rock, the well, the stone wall, the stump
rect(13, 4, 19, 12); rect(11, 5, 11, 6); rect(9, 11, 12, 12); rect(20, 7, 24, 11); rect(20, 12, 22, 13); rect(0, 11, 3, 13); rect(1, 14, 4, 16); rect(0, 20, 5, 21); rect(6, 21, 7, 22); rect(10, 24, 13, 25)
rect(18, 19, 18, 20)   # the bridge post in the water
# THE CAMP. the top fence, the left fence, the right posts, the red tent, the tusk shrine, the green tent, the lower fence with the tusk gate in it
rect(28, 0, 43, 2); rect(28, 3, 29, 9); rect(43, 3, 43, 4)
rect(30, 4, 33, 8); rect(35, 4, 40, 8); rect(41, 5, 43, 9)
rect(30, 10, 35, 13); rect(38, 10, 43, 13); rect(35, 14, 35, 14); rect(38, 14, 38, 14)   # the tusks flank the gate; row 15 runs under them
# the barricades and spikes in the camp's wood, the cauldron, the rocks
rect(34, 19, 36, 19); rect(38, 17, 42, 18); rect(42, 22, 42, 22); rect(34, 24, 36, 25)
# THE DOOR: north, to the Boneyard, on the grass between the canopies
for x in (11, 12, 13): g[0][x] = "e"
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
seen = reach(12, 0)
lost = [(x, y) for y in range(H) for x in range(W) if g[y][x] in walk and (x, y) not in seen]
print("walkable", sum(r.count(".") + r.count("e") for r in rows), "unreachable", len(lost), lost[:16])
json.dump(rows, open("C:/Users/jake/code/eastcoins/lt-wild/cut/orchard-rows.json", "w"))
