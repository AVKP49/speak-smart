#!/usr/bin/env python3
"""Generate Speak Smart PWA icons: ink tile, gold ◆ (the Boss mark). Re-runnable."""
from pathlib import Path
from PIL import Image, ImageDraw

INK = (11, 13, 16, 255)
GOLD = (232, 179, 75, 255)

here = Path(__file__).resolve().parent.parent
out = here / "public" / "icons"
out.mkdir(parents=True, exist_ok=True)


def diamond(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, fill) -> None:
    draw.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill)


def rounded_tile(size: int, radius_ratio: float = 0.225) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=INK)
    diamond(d, size / 2, size / 2, size * 0.21, GOLD)
    return img


def maskable(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), INK)
    d = ImageDraw.Draw(img)
    diamond(d, size / 2, size / 2, size * 0.20, GOLD)
    return img


rounded_tile(192).save(out / "icon-192.png")
rounded_tile(512).save(out / "icon-512.png")
maskable(512).save(out / "icon-maskable-512.png")
print("icons written to", out)
