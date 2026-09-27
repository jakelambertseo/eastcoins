# The Boardwalk (composed from the sea pack's mockups): the walkable grid, drawn by hand over lt-wild/cut/boardwalk-bg-grid.png.
# Writes lt-wild/cut/boardwalk-rows.json; lt-wild/overlay.mjs paints it over the picture to check.
import json
W, H = 44, 26
g = [["~"] * W for _ in range(H)]
def rect(x0, y0, x1, y1, c="."):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = c
# the beach (sand): the top-left, the inlet of water at its right, the strip down the left edge
rect(0, 0, 11, 7); rect(0, 8, 14, 10); rect(12, 4, 12, 7)
rect(0, 11, 3, 18); rect(0, 19, 4, 25)
# the pier off the beach, two planks wide, to the bank
rect(6, 8, 14, 9)
# the market: grass and the stone plaza, down to the bank
rect(15, 0, 43, 11)
# the pier network on the water
rect(30, 12, 33, 19)          # the long pier down from the bank
rect(20, 16, 33, 17)          # the crossing pier west
rect(20, 15, 22, 25)          # the west pier, down to the bottom
rect(17, 21, 26, 22)          # the lower crossing
# what stands on it and blocks it: palms, stalls, crates, barrels, the winch, the bushes, the boats
for x, y in [(3, 1), (3, 2), (8, 1), (8, 2), (1, 5), (1, 6), (8, 4), (8, 5)]: g[y][x] = "~"          # palms (trunks)
for x0, y0, x1, y1 in [(30, 0, 33, 2), (36, 0, 40, 2), (28, 1, 29, 2), (34, 1, 35, 1), (40, 1, 43, 2),   # top row of stalls and crates
                       (25, 5, 28, 8), (31, 5, 34, 8), (36, 5, 40, 8), (24, 7, 24, 8), (35, 7, 35, 8), (41, 6, 42, 8),   # second row
                       (22, 4, 24, 6), (16, 1, 20, 2)]:                                                  # the winch and its bush, the tree top-left
    rect(x0, y0, x1, y1, "~")
for x0, y0, x1, y1 in [(23, 18, 28, 19), (31, 20, 36, 21)]: rect(x0, y0, x1, y1, "~")                 # the boats
# the way out: the east edge, on the grass, to the Carnival
for y in (1, 2, 3): g[y][43] = "e"
for x, y in [(34, 0), (35, 0)]: g[y][x] = "~"   # behind the stalls
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
seen = reach(43, 2)
lost = [(x, y) for y in range(H) for x in range(W) if g[y][x] in walk and (x, y) not in seen]
print("walkable", sum(r.count(".") + r.count("e") for r in rows), "unreachable", lost[:12])
json.dump(rows, open("C:/Users/jake/code/eastcoins/lt-wild/cut/boardwalk-rows.json", "w"))
for r in rows: print(r)
