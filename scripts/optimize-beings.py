#!/usr/bin/env python3
"""Optimize mini-beings assets for committing.

Reads full-size character exports from public/labs/mini-beings/_raw/<id>/ (those
originals stay gitignored) and writes small, committable assets to
public/labs/mini-beings/beings/<id>/:

  - sprites.webp      : spritesheet_pixel.png downscaled (default 0.5x) → WebP
  - entity_pixel.json : manifest with frame coords/size scaled to match,
                        meta.image pointed at sprites.webp
  - reference.webp    : reference_rgba.png alpha-cropped to the character and
                        resized (a clean static "rest pose"), if present

Then it (re)writes public/labs/mini-beings/beings.json indexing every being.

Usage (from ui/):  python3 scripts/optimize-beings.py [--scale 0.5] [--ref-h 240]
"""
import json
import os
import sys
import glob
import shutil
from PIL import Image

BASE = os.path.join(os.path.dirname(__file__), "..", "public")
RAW = os.path.join(BASE, "_raw")
OUT = os.path.join(BASE, "beings")


def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


# Keep the pixel sheet at native resolution (no downscale → crisp pixels); WebP
# lossy q90 compresses it well (~60KB) without the softening a 0.5x resize caused.
SCALE = float(arg("--scale", "1.0"))
QUALITY = int(arg("--quality", "90"))
REF_H = int(arg("--ref-h", "240"))


def main():
    if not os.path.isdir(RAW):
        sys.exit(f"No raw dir at {RAW}. Populate it first (see scripts/populate-beings.py).")

    ids = sorted(d for d in os.listdir(RAW) if os.path.isdir(os.path.join(RAW, d)))
    shutil.rmtree(OUT, ignore_errors=True)
    os.makedirs(OUT, exist_ok=True)

    index, raw_bytes, out_bytes = [], 0, 0
    for bid in ids:
        rd, od = os.path.join(RAW, bid), os.path.join(OUT, bid)
        src_png = os.path.join(rd, "spritesheet_pixel.png")
        src_manifest = os.path.join(rd, "entity_pixel.json")
        if not (os.path.isfile(src_png) and os.path.isfile(src_manifest)):
            print(f"skip {bid}: missing png or manifest")
            continue
        os.makedirs(od, exist_ok=True)
        raw_bytes += os.path.getsize(src_png)

        # spritesheet → WebP (native res unless SCALE<1), manifest coords matched
        manifest = json.load(open(src_manifest))
        sheet = manifest["textures"][0]
        w, h = round(sheet["meta"]["size"]["w"] * SCALE), round(sheet["meta"]["size"]["h"] * SCALE)
        img = Image.open(src_png).convert("RGBA")
        if (w, h) != img.size:
            img = img.resize((w, h), Image.LANCZOS)
        img.save(os.path.join(od, "sprites.webp"), "WEBP", quality=QUALITY, method=6)
        out_bytes += os.path.getsize(os.path.join(od, "sprites.webp"))
        sheet["meta"]["image"], sheet["meta"]["size"] = "sprites.webp", {"w": w, "h": h}
        for f in sheet["frames"].values():
            fr = f["frame"]
            f["frame"] = {k: round(fr[k] * SCALE) for k in ("x", "y", "w", "h")}
        json.dump(manifest, open(os.path.join(od, "entity_pixel.json"), "w"), indent=2)

        # reference_rgba → alpha-cropped, resized static pose
        has_ref = False
        src_ref = os.path.join(rd, "reference_rgba.png")
        if os.path.isfile(src_ref):
            im = Image.open(src_ref).convert("RGBA")
            bbox = im.getbbox()
            if bbox:
                im = im.crop(bbox)
                rw = max(1, round(im.width * REF_H / im.height))
                im.resize((rw, REF_H), Image.LANCZOS).save(
                    os.path.join(od, "reference.webp"), "WEBP", quality=88, method=6)
                out_bytes += os.path.getsize(os.path.join(od, "reference.webp"))
                has_ref = True

        seed = None
        try:
            seed = json.load(open(os.path.join(rd, "params.json")))["values"]["generate"].get("seed")
        except Exception:
            pass
        index.append({"id": bid, "seed": seed, "ref": has_ref})
        print(f"✓ {bid}  {w}x{h}  ref={has_ref}")

    json.dump({"beings": index}, open(os.path.join(BASE, "beings.json"), "w"), indent=2)
    pct = 100 - (out_bytes / raw_bytes * 100) if raw_bytes else 0
    print(f"\noptimized {len(index)} beings · "
          f"{raw_bytes/1e6:.1f}MB → {out_bytes/1e6:.1f}MB ({pct:.0f}% smaller)")


if __name__ == "__main__":
    main()
