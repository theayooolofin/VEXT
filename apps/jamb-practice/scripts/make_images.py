"""Generates app icons and the Open Graph image into public/.

Run: npm run make:images  (needs Python 3 with Pillow). Outputs are committed,
so this only needs re-running when the artwork changes.
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), '..', 'public')
INK = (23, 33, 47)
BIRO = (31, 79, 216)
PAGE = (246, 248, 251)
PAPER = (255, 255, 255)
LINE = (200, 212, 232)
RED = (198, 40, 40)
HL = (255, 225, 77)
MUTED = (82, 96, 111)


def font(size, bold=True):
    candidates = [
        'C:/Windows/Fonts/segoeuib.ttf' if bold else 'C:/Windows/Fonts/segoeui.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
    ]
    for c in candidates:
        if os.path.exists(c):
            return ImageFont.truetype(c, size)
    print('No TrueType font found; install DejaVu or run on Windows.', file=sys.stderr)
    sys.exit(1)


def bubble(d, cx, cy, r, letter, filled, size_font):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK if filled else MUTED, width=max(2, r // 7), fill=INK if filled else PAPER)
    f = font(size_font)
    d.text((cx, cy), letter, font=f, fill=PAPER if filled else INK, anchor='mm')


def tick(d, x, y, s, width):
    d.line([(x, y + s * 0.5), (x + s * 0.38, y + s * 0.88), (x + s, y)], fill=RED, width=width, joint='curve')


def icon(size, maskable=False):
    scale = 4  # draw large, then downsample for smooth edges
    S = size * scale
    img = Image.new('RGB', (S, S), BIRO if maskable else PAPER)
    d = ImageDraw.Draw(img)
    pad = int(S * (0.2 if maskable else 0.08))
    if not maskable:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.18), fill=BIRO)
    inner = S - 2 * pad
    # A paper card with one shaded answer bubble and a red tick.
    d.rounded_rectangle([pad, pad, pad + inner, pad + inner], radius=int(inner * 0.12), fill=PAPER)
    cx, cy, r = pad + inner * 0.42, pad + inner * 0.55, inner * 0.24
    bubble(d, cx, cy, int(r), 'B', True, int(r * 1.15))
    tick(d, pad + inner * 0.62, pad + inner * 0.2, inner * 0.28, int(inner * 0.07))
    return img.resize((size, size), Image.LANCZOS)


def badge(size):
    img = Image.new('RGBA', (size * 4, size * 4), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = size * 4
    d.ellipse([S * 0.1, S * 0.1, S * 0.9, S * 0.9], outline=(255, 255, 255, 255), width=int(S * 0.09))
    d.line([(S * 0.3, S * 0.52), (S * 0.45, S * 0.67), (S * 0.72, S * 0.36)], fill=(255, 255, 255, 255), width=int(S * 0.1), joint='curve')
    return img.resize((size, size), Image.LANCZOS)


def og():
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), PAGE)
    d = ImageDraw.Draw(img)
    # Exercise-book ruled lines and margin.
    for y in range(70, H, 44):
        d.line([(0, y), (W, y)], fill=LINE, width=2)
    d.line([(96, 0), (96, H)], fill=RED, width=3)
    title = font(64)
    d.text((140, 96), 'Practise UTME English', font=title, fill=INK)
    d.text((140, 176), 'for 14 days.', font=title, fill=INK)
    sub = font(40, bold=False)
    tw = d.textlength('Ten minutes a day.', font=sub)
    d.rectangle([136, 280, 140 + tw + 8, 336], fill=HL)
    d.text((140, 284), 'Ten minutes a day.', font=sub, fill=INK)
    small = font(30, bold=False)
    d.text((140, 372), 'Free 5-minute check. Days 1 to 3 free.', font=small, fill=MUTED)
    # Answer-sheet row: A B C D with B shaded and ticked.
    for i, letter in enumerate('ABCD'):
        bubble(d, 180 + i * 110, 500, 38, letter, letter == 'B', 34)
    tick(d, 300, 448, 58, 9)
    d.text((140, 580), 'Not affiliated with JAMB.', font=font(22, bold=False), fill=MUTED)
    return img


def main():
    os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)
    icon(192).save(os.path.join(OUT, 'icons', 'icon-192.png'), optimize=True)
    icon(512).save(os.path.join(OUT, 'icons', 'icon-512.png'), optimize=True)
    icon(512, maskable=True).save(os.path.join(OUT, 'icons', 'icon-maskable-512.png'), optimize=True)
    icon(180).save(os.path.join(OUT, 'icons', 'apple-touch-icon.png'), optimize=True)
    badge(96).save(os.path.join(OUT, 'icons', 'badge-96.png'), optimize=True)
    img = og().convert('P', palette=Image.ADAPTIVE, colors=64)
    path = os.path.join(OUT, 'og.png')
    img.save(path, optimize=True)
    size = os.path.getsize(path)
    print(f'og.png is {size // 1024} KB')
    if size > 100 * 1024:
        print('og.png is over the 100 KB budget', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
