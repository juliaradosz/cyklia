# -*- coding: utf-8 -*-
"""Generuje ikony PWA (kwiat/serce) dla aplikacji Cyklia."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "icons")


def petal(draw, cx, cy, r, angle, color):
    import math

    x = cx + r * math.cos(angle)
    y = cy + r * math.sin(angle)
    rx, ry = r * 0.62, r * 0.42
    draw.ellipse([x - rx, y - ry, x + rx, y + ry], fill=color)


def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = cy = size / 2
    r = size * 0.24
    import math

    for i in range(8):
        petal(d, cx, cy, r, i * math.pi / 4 + math.pi / 8, (235, 120, 160, 255))
    d.ellipse([cx - r * 0.55, cy - r * 0.55, cx + r * 0.55, cy + r * 0.55], fill=(255, 225, 170, 255))
    d.ellipse([cx - r * 0.35, cy - r * 0.35, cx + r * 0.35, cy + r * 0.35], fill=(220, 90, 130, 255))
    return img


def main():
    os.makedirs(OUT, exist_ok=True)
    for s in (192, 512, 180, 64, 32):
        make_icon(s).save(os.path.join(OUT, f"icon-{s}.png"))
    make_icon(512).resize((180, 180), Image.LANCZOS).save(
        os.path.join(OUT, "apple-touch-icon.png")
    )
    print("Ikony zapisane w", OUT)


if __name__ == "__main__":
    main()
