#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "cairosvg",
#     "pillow",
# ]
# ///
"""Compose apps/web/public/og-image.png (1200×630) from favicon.svg.

Does not change the SVG mark.

  uv run scripts/generate-og-image.py
"""

from __future__ import annotations

import io
import sys
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "apps/web/public"
SVG_PATH = PUBLIC / "favicon.svg"
OUT_NAME = "og-image.png"

OG_WIDTH = 1200
OG_HEIGHT = 630
# Same fill as favicon.svg / tokens.css --bg.
BACKGROUND = (0x0B, 0x0E, 0x12)
TEXT = (0xE8, 0xEE, 0xF4)
MUTED = (0x8B, 0x98, 0xA5)
ACCENT = (0x6A, 0xA4, 0xD8)

TITLE = "CS2 Analyzer"
TAGLINE = "Local-first CS2 GOTV demo viewer"

MARK_SIZE = 280
PAD_X = 96
GAP = 40
ACCENT_WIDTH = 6
TITLE_SIZE = 72
TAGLINE_SIZE = 32

FONT_CANDIDATES_BOLD = (
    Path("/usr/share/fonts/truetype/macos/Inter-Bold.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    Path("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"),
)
FONT_CANDIDATES_REGULAR = (
    Path("/usr/share/fonts/truetype/macos/Inter-Regular.ttf"),
    Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
)


def first_font(candidates: tuple[Path, ...], size: int) -> ImageFont.FreeTypeFont:
    for path in candidates:
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    names = ", ".join(str(path) for path in candidates)
    sys.stderr.write(f"missing a usable font; tried {names}\n")
    sys.exit(1)


def svg_rgba(size: int) -> Image.Image:
    raw = cairosvg.svg2png(
        bytestring=SVG_PATH.read_bytes(),
        output_width=size,
        output_height=size,
    )
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def main() -> None:
    if not SVG_PATH.is_file():
        sys.stderr.write(f"missing {SVG_PATH}\n")
        sys.exit(1)

    canvas = Image.new("RGB", (OG_WIDTH, OG_HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, ACCENT_WIDTH, OG_HEIGHT), fill=ACCENT)

    mark = svg_rgba(MARK_SIZE)
    mark_x = PAD_X
    mark_y = (OG_HEIGHT - mark.height) // 2
    rgba = canvas.convert("RGBA")
    rgba.alpha_composite(mark, (mark_x, mark_y))
    canvas = rgba.convert("RGB")
    draw = ImageDraw.Draw(canvas)

    title_font = first_font(FONT_CANDIDATES_BOLD, TITLE_SIZE)
    tagline_font = first_font(FONT_CANDIDATES_REGULAR, TAGLINE_SIZE)
    title_bbox = title_font.getbbox(TITLE)
    tagline_bbox = tagline_font.getbbox(TAGLINE)
    title_h = title_bbox[3] - title_bbox[1]
    tagline_h = tagline_bbox[3] - tagline_bbox[1]
    text_gap = 18
    block_h = title_h + text_gap + tagline_h
    text_x = mark_x + mark.width + GAP
    title_y = (OG_HEIGHT - block_h) // 2 - title_bbox[1]
    tagline_y = title_y + title_bbox[1] + title_h + text_gap - tagline_bbox[1]

    draw.text((text_x, title_y), TITLE, font=title_font, fill=TEXT)
    draw.text((text_x, tagline_y), TAGLINE, font=tagline_font, fill=MUTED)

    path = PUBLIC / OUT_NAME
    canvas.save(path, format="PNG", optimize=True)
    print(f"wrote {path.relative_to(ROOT)} ({canvas.size[0]}x{canvas.size[1]} {canvas.mode})")


if __name__ == "__main__":
    main()
