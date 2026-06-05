#!/usr/bin/env python3
"""Copy completed characters from a generation run into the mini-beings _raw/
staging dir (gitignored), then run optimize-beings.py to produce committable
assets.

A character is "complete" when its run dir has spritesheet_pixel.png +
entity_pixel.json. reference_rgba.png and params.json are copied when present.

Usage (from ui/):
  python3 scripts/populate-beings.py --from '/tmp/live_out/run_*' --count 40
"""
import glob
import json
import os
import shutil
import sys

from PIL import Image

RAW = os.path.join(os.path.dirname(__file__), "..", "public", "_raw")
FILES = ("spritesheet_pixel.png", "entity_pixel.json", "reference_rgba.png", "params.json")

# Characters that bleed alpha to the edge of their sprite cell are generation
# errors (the figure overflowed the frame). Reject any whose worst-frame edge
# coverage exceeds this fraction. Clean characters measure ~0; errors ≥0.08.
EDGE_THRESHOLD = 0.04


def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def edge_alpha_frac(run_dir):
    """Max fraction of any frame's border pixels that are non-transparent."""
    alpha = Image.open(os.path.join(run_dir, "spritesheet_pixel.png")).convert("RGBA").split()[3].load()
    frames = json.load(open(os.path.join(run_dir, "entity_pixel.json")))["textures"][0]["frames"]
    worst = 0.0
    for f in frames.values():
        fr = f["frame"]
        x, y, w, h = fr["x"], fr["y"], fr["w"], fr["h"]
        border = opaque = 0
        for xx in range(x, x + w):
            for yy in (y, y + h - 1):
                border += 1
                opaque += alpha[xx, yy] > 24
        for yy in range(y + 1, y + h - 1):
            for xx in (x, x + w - 1):
                border += 1
                opaque += alpha[xx, yy] > 24
        worst = max(worst, opaque / border)
    return worst


# --from accepts one or more comma-separated globs (e.g. a run dir + an extras dir).
src_globs = [g.strip() for g in arg("--from", "/tmp/live_out/run_*").split(",") if g.strip()]
count = int(arg("--count", "40"))

found = []
for g in src_globs:
    found += glob.glob(g)
complete = [d for d in sorted(set(found))
            if os.path.isfile(os.path.join(d, "spritesheet_pixel.png"))
            and os.path.isfile(os.path.join(d, "entity_pixel.json"))]

pick, rejected = [], 0
for d in complete:
    if len(pick) >= count:
        break
    try:
        if edge_alpha_frac(d) > EDGE_THRESHOLD:
            rejected += 1
            continue
    except Exception:
        rejected += 1
        continue
    pick.append(d)

shutil.rmtree(RAW, ignore_errors=True)
os.makedirs(RAW, exist_ok=True)
for i, d in enumerate(pick, 1):
    dst = os.path.join(RAW, f"being-{i:02d}")
    os.makedirs(dst, exist_ok=True)
    for f in FILES:
        s = os.path.join(d, f)
        if os.path.isfile(s):
            shutil.copy(s, os.path.join(dst, f))

print(f"populated _raw with {len(pick)} clean beings "
      f"({rejected} rejected for edge-alpha, {len(complete)} complete total)")
