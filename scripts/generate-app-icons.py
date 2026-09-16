#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "cairosvg",
#     "pillow",
# ]
# ///
"""Rasterize apps/web/public favicon.svg into the PNG/ICO set the web app links.

Does not change the SVG mark.

  uv run scripts/generate-app-icons.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import cairosvg
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/web/public"
SVG_PATH = PUBLIC / "favicon.svg"
# Same fill as the rounded rect in favicon.svg — opaque bleed for OS masks.
BACKGROUND = (0x0B, 0x0E, 0x12)
# Maskable safe zone is the central 80% (10% padding on each side).
MASKABLE_PAD = 0.10


def svg_rgba(size: int) -> Image.Image:
    raw = cairosvg.svg2png(
        bytestring=SVG_PATH.read_bytes(),
        output_width=size,
        output_height=size,
    )
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def opaque_square(size: int, pad_frac: float = 0.0) -> Image.Image:
    inner = int(round(size * (1 - 2 * pad_frac)))
    mark = svg_rgba(inner)
    canvas = Image.new("RGBA", (size, size), BACKGROUND + (255,))
    x = (size - mark.width) // 2
    y = (size - mark.height) // 2
    canvas.alpha_composite(mark, (x, y))
    out = Image.new("RGB", (size, size), BACKGROUND)
    out.paste(canvas, mask=canvas.split()[-1])
    return out


def save_png(image: Image.Image, name: str) -> None:
    path = PUBLIC / name
    image.save(path, format="PNG", optimize=True)
    print(f"wrote {path.relative_to(ROOT)} ({image.size[0]}x{image.size[1]} {image.mode})")


def main() -> None:
    if not SVG_PATH.is_file():
        sys.stderr.write(f"missing {SVG_PATH}\n")
        sys.exit(1)

    fav32 = svg_rgba(32)
    save_png(fav32, "favicon-32.png")
    ico = PUBLIC / "favicon.ico"
    fav32.save(ico, format="ICO", sizes=[(16, 16), (32, 32)])
    print(f"wrote {ico.relative_to(ROOT)} (16 and 32)")

    save_png(opaque_square(180), "apple-touch-icon.png")
    save_png(opaque_square(192), "icon-192.png")
    save_png(opaque_square(512), "icon-512.png")
    save_png(opaque_square(512, MASKABLE_PAD), "icon-512-maskable.png")


if __name__ == "__main__":
    main()
