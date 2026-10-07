# Print-ready "scan me" shirt graphic (transparent PNG, 300 DPI, ~20x26 cm).
# Usage: ~/.cache/wedding-qr-venv/bin/python tools/make-graphic.py https://itamarmagen.github.io/shirt/
import sys, math, segno
from PIL import Image, ImageDraw, ImageFont

URL = sys.argv[1] if len(sys.argv) > 1 else "https://itamarmagen.github.io/shirt/"
ROUNDED = "/System/Library/Fonts/SFHebrewRounded.ttf"
W, H = 2400, 3100
PINK, YELLOW, INK = (255, 79, 154), (255, 217, 61), (26, 16, 48)

def font(size, weight):
    f = ImageFont.truetype(ROUNDED, size)
    f.set_variation_by_name(weight)
    return f

def text_center(d, y, text, f, fill, shadow=None, off=0, stroke=0, stroke_fill=None):
    b = d.textbbox((0, 0), text, font=f, direction="rtl", language="he", stroke_width=stroke)
    x = (W - (b[2] - b[0])) // 2 - b[0]
    if shadow:
        d.text((x + off, y + off), text, font=f, fill=shadow, direction="rtl", language="he",
               stroke_width=stroke, stroke_fill=shadow)
    d.text((x, y), text, font=f, fill=fill, direction="rtl", language="he",
           stroke_width=stroke, stroke_fill=stroke_fill or fill)
    return b[3] - b[1]

def sparkle(d, cx, cy, r, fill):
    pts = []
    for i in range(8):
        a = math.pi / 4 * i - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.28
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(pts, fill=fill)

def heart(d, cx, cy, s, fill):
    d.ellipse([cx - s, cy - s * 0.6, cx, cy + s * 0.4], fill=fill)
    d.ellipse([cx, cy - s * 0.6, cx + s, cy + s * 0.4], fill=fill)
    d.polygon([(cx - s * 0.97, cy + s * 0.05), (cx + s * 0.97, cy + s * 0.05), (cx, cy + s * 1.15)], fill=fill)

def arrow(d, color, width):
    # Loopy hand-drawn arrow from the headline down toward the QR card
    # Quadratic curve: start right of the headline, bow outward, land on the card
    (sx, sy), (cx, cy), (ex, ey) = (1990, 760), (2160, 1060), (1810, 1120)
    pts = []
    for i in range(121):
        t = i / 120
        x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t ** 2 * ex
        y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t ** 2 * ey
        pts.append((x, y))
    d.line(pts, fill=color, width=width, joint="curve")
    (x1, y1), (x2, y2) = pts[-6], pts[-1]
    a = math.atan2(y2 - y1, x2 - x1)
    L = 95
    for da in (2.55, -2.55):
        d.line([(x2, y2), (x2 + L * math.cos(a + da), y2 + L * math.sin(a + da))], fill=color, width=width)
    for (x, y) in (pts[0], pts[-1]):
        d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=color)

def make(variant):
    dark_shirt = variant == "dark"
    head = YELLOW if dark_shirt else INK
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Headline, sized to leave a comfortable margin
    size = 470
    while True:
        f = font(size, "Black")
        b = d.textbbox((0, 0), "סרקו אותי!", font=f, direction="rtl", language="he")
        if b[2] - b[0] <= W - 420: break
        size -= 10
    text_center(d, 230, "סרקו אותי!", f, head, shadow=PINK, off=20)

    arrow(d, PINK, 30)
    accent = YELLOW if dark_shirt else PINK
    sparkle(d, 150, 210, 85, PINK)
    sparkle(d, 330, 930, 55, accent)
    sparkle(d, 2260, 640, 70, accent)
    sparkle(d, 2150, 120, 45, PINK)

    # QR card
    qr = segno.make(URL, error="h")
    mods = qr.symbol_size(scale=1, border=0)[0]
    card_x0, card_y0, card_size = 520, 1170, 1360
    pad = 110
    m = (card_size - 2 * pad) // mods
    qr_px = m * mods
    off = card_x0 + (card_size - qr_px) // 2
    offy = card_y0 + (card_size - qr_px) // 2
    d.rounded_rectangle([card_x0 - 22, card_y0 - 22, card_x0 + card_size + 22, card_y0 + card_size + 22],
                        radius=120, fill=PINK)
    d.rounded_rectangle([card_x0, card_y0, card_x0 + card_size, card_y0 + card_size], radius=100, fill="white")
    for r, row in enumerate(qr.matrix):
        for c, v in enumerate(row):
            if v:
                d.rectangle([off + c * m, offy + r * m, off + (c + 1) * m - 1, offy + (r + 1) * m - 1], fill=INK)
    heart(d, card_x0 - 10, card_y0 + card_size + 30, 95, YELLOW if dark_shirt else PINK)
    heart(d, card_x0 + card_size + 30, card_y0 + int(card_size * 0.72), 70, YELLOW if dark_shirt else PINK)

    # Teaser lines
    y = card_y0 + card_size + 150
    y += text_center(d, y, "תמונות שהחתן", font(190, "Black"), head, shadow=PINK, off=10) + 60
    text_center(d, y, "לא רוצה שתראו", font(190, "Black"), head, shadow=PINK, off=10)

    out = f"qr/scan-me-{variant}-shirt.png"
    img.save(out, dpi=(300, 300))
    return out

for v in ("light", "dark"):
    print("✓", make(v))
