# Renders the lyric clip: photo slideshow (polaroid + blurred backdrop, slow zoom,
# crossfades) with timed lyrics, then muxes the song.
# Usage: ~/.cache/wedding-qr-venv/bin/python tools/make-lyric-video.py pictures/song.mp3 photos/song.mp4 [--preview SECONDS]
#        add --shots shots  to use AI clips (shots/01.mp4 …, timed by --table, default tools/ai-shots.json);
#        sections without a clip fall back to the photo slideshow.
import sys, json, math, random, re, subprocess, glob, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageEnhance

AUDIO, OUT = sys.argv[1], sys.argv[2]
PREVIEW = None
if "--preview" in sys.argv:
    PREVIEW = [float(x) for x in sys.argv[sys.argv.index("--preview") + 1].split(",")]

SHOTS_DIR = sys.argv[sys.argv.index("--shots") + 1] if "--shots" in sys.argv else None
SHOT_TABLE = sys.argv[sys.argv.index("--table") + 1] if "--table" in sys.argv else "tools/ai-shots.json"

W, H, FPS = 720, 1280, 25
PINK, YELLOW, INK, WHITE = (255, 79, 154), (255, 217, 61), (26, 16, 48), (255, 255, 255)
ROUNDED = "tools/fonts/Rubik.ttf"  # OFL, covers Hebrew + Latin + punctuation
timing = json.load(open("tools/song-timing.json"))
duration = float(subprocess.check_output(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", AUDIO]))

def font(size, weight):
    f = ImageFont.truetype(ROUNDED, size); f.set_variation_by_name(weight); return f

HEB = re.compile(r"[\u0590-\u05FF]")

def bidi(text):
    """English-only lines run LTR; in mixed lines, glue trailing punctuation to the English run."""
    if not HEB.search(text):
        return text, "ltr"
    return re.sub(r"([A-Za-z][!?.,)]+)", "\\1\u200E", text), "rtl"

def tsize(d, text, f, stroke=0):
    text, dirn = bidi(text)
    b = d.textbbox((0, 0), text, font=f, direction=dirn, language="he", stroke_width=stroke)
    return b, b[2] - b[0], b[3] - b[1]

def wrap(text, f, maxw):
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    out = []
    for para in text.split("\n"):
        line = ""
        for w in para.split(" "):
            cand = (line + " " + w).strip()
            if line and tsize(d, cand, f)[1] > maxw:
                out.append(line); line = w
            else:
                line = cand
        out.append(line)
    return out

def render_text(text, size, weight, fill, shadow=None, maxw=W - 90):
    """Centered multi-line RTL text block as an RGBA image (cached by caller)."""
    f = font(size, weight)
    lines = wrap(text, f, maxw)
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    lh = int(size * 1.28)
    img = Image.new("RGBA", (W, lh * len(lines) + 30), (0, 0, 0, 0))
    dd = ImageDraw.Draw(img)
    for i, ln in enumerate(lines):
        b, w, _ = tsize(d, ln, f, stroke=3)
        x = (W - w) // 2 - b[0]; y = i * lh + 8 - b[1] + int(size * 0.12)
        ln, dirn = bidi(ln)
        if shadow:
            dd.text((x + 4, y + 4), ln, font=f, fill=shadow, direction=dirn, language="he",
                    stroke_width=3, stroke_fill=shadow)
        dd.text((x, y), ln, font=f, fill=fill, direction=dirn, language="he",
                stroke_width=3, stroke_fill=INK)
    return img

# ---------- photos ----------
srcs = re.findall(r'src:\s*"(photos/[^"]+\.(?:jpg|jpeg|png))"', open("photos.js").read())
random.Random(7).shuffle(srcs)
BOX_W, BOX_H, BOX_CY = 640, 700, 500
SLOT = max(3.2, duration / len(srcs))          # seconds per photo
FADE = 0.5

def polaroid(path, i):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    bw = 14
    im.thumbnail((BOX_W - 2 * bw, BOX_H - 2 * bw))
    card = Image.new("RGBA", (im.width + 2 * bw, im.height + 2 * bw), WHITE + (255,))
    card.paste(im, (bw, bw))
    mask = Image.new("L", card.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, card.width - 1, card.height - 1], radius=22, fill=255)
    card.putalpha(mask)
    tilt = [-2.2, 1.6, -1.2, 2.0, -0.6, 1.0][i % 6]
    return card.rotate(tilt, expand=True, resample=Image.BICUBIC)

def backdrop(path):
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    im = ImageOps.fit(im, (W // 4, H // 4)).filter(ImageFilter.GaussianBlur(6))
    im = ImageEnhance.Brightness(im).enhance(0.42).resize((W, H), Image.BILINEAR)
    return im.convert("RGBA")

cache = {}
def photo_assets(i):
    i %= len(srcs)
    if i not in cache:
        if len(cache) > 4: cache.pop(next(iter(cache)))
        cache[i] = (backdrop(srcs[i]), polaroid(srcs[i], i))
    return cache[i]

# bottom gradient for lyric legibility
grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(grad)
for y in range(820, H):
    a = int(min(1, (y - 820) / 160) * 215)
    gd.line([(0, y), (W, y)], fill=INK + (a,))

def photo_frame(i, t_local):
    bg, card = photo_assets(i)
    frame = bg.copy()
    z = 1.0 + 0.05 * min(1, t_local / SLOT)       # slow zoom
    c = card.resize((int(card.width * z), int(card.height * z)), Image.BILINEAR)
    frame.alpha_composite(c, ((W - c.width) // 2, BOX_CY - c.height // 2))
    return frame

# ---------- lyrics ----------
lines = timing["lines"]
txt_cache = {}
def txt(key, *args):
    if key not in txt_cache: txt_cache[key] = render_text(*args)
    return txt_cache[key]


TITLE_SECS = 5.0

def overlay(frame, t):
    # Song title for the first few seconds only, then it fades away
    if t < TITLE_SECS:
        a = min(1, t / 0.6, (TITLE_SECS - t) / 0.8)
        title = txt("T", timing["title"], 84, "Black", YELLOW, PINK)
        sub = txt("S", timing["subtitle"], 46, "ExtraBold", WHITE)
        blit(frame, title, 905, a, pop=min(1, t / 0.6))
        blit(frame, sub, 905 + title.height + 6, a)
    # Karaoke: only the line being sung right now
    for k, ln in enumerate(lines):
        if ln[0] - 0.15 <= t < ln[1]:
            s, e, text = ln[:3]
            img = txt(("c", k), text, 58 if len(ln) > 3 else 54, "Black", YELLOW, PINK)
            age = t - (s - 0.15)
            blit(frame, img, 940 - img.height // 2 + 40, min(1, age / 0.18, max(0, (e - t) / 0.2)),
                 pop=min(1, age / 0.22))
            break

def blit(frame, img, y, alpha=1.0, pop=1.0):
    if alpha <= 0: return
    if pop < 1:
        sc = 0.85 + 0.15 * (1 - (1 - pop) ** 3)
        img = img.resize((int(img.width * sc), int(img.height * sc)), Image.BILINEAR)
    if alpha < 1:
        img = img.copy(); img.putalpha(img.getchannel("A").point(lambda v: int(v * alpha)))
    frame.alpha_composite(img, ((W - img.width) // 2, int(y)))

# ---------- AI clips ----------
slots = []
if SHOTS_DIR:
    for row in json.load(open(SHOT_TABLE)):
        a, b, num = row[:3]
        files = [f for f in glob.glob(f"{SHOTS_DIR}/{num}.*") if f.lower().endswith((".mp4", ".mov", ".webm", ".m4v"))]
        slots.append((a, b, files[0] if files else None))
    print("clips found:", sum(1 for x in slots if x[2]), "/", len(slots), flush=True)

reader = {"slot": None, "next": 0, "proc": None}

def clip_frame(k, local_t):
    a, b, path = slots[k]
    want = int(round(local_t * FPS))
    if reader["slot"] != k or reader["next"] != want:
        if reader["proc"]: reader["proc"].kill()
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                             "-of", "csv=p=0", path]) or 0)
        slow = min(1.6, max(1.0, (b - a) / dur)) if dur > 0 else 1.0   # stretch short clips a bit, then loop
        vf = (f"setpts={slow:.3f}*PTS,scale={W}:{H}:force_original_aspect_ratio=increase,"
              f"crop={W}:{H},fps={FPS}")
        reader["proc"] = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-stream_loop", "-1", "-i", path,
            "-vf", vf, "-ss", f"{local_t:.3f}", "-an", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        reader.update(slot=k, next=want)
    buf = reader["proc"].stdout.read(W * H * 3)
    reader["next"] += 1
    return Image.frombytes("RGB", (W, H), buf).convert("RGBA")

def frame_at(t):
    for k, (a, b, path) in enumerate(slots):
        if a <= t < b and path:
            f = clip_frame(k, t - a)
            f.alpha_composite(grad)
            overlay(f, t)
            return f.convert("RGB")
    i = int(t // SLOT); tl = t - i * SLOT
    f = photo_frame(i, tl)
    if tl > SLOT - FADE:                               # crossfade into next photo
        f = Image.blend(f, photo_frame(i + 1, tl - SLOT), (tl - (SLOT - FADE)) / FADE)
    f.alpha_composite(grad)
    overlay(f, t)
    return f.convert("RGB")

if PREVIEW:
    for t in PREVIEW:
        frame_at(t).save(f"{OUT}-{t:.1f}.jpg", quality=85)
    sys.exit()

enc = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
    "-i", AUDIO, "-map", "0:v", "-map", "1:a", "-shortest",
    "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", "-map_metadata", "-1", OUT],
    stdin=subprocess.PIPE)
n = int(duration * FPS) + 1
for k in range(n):
    enc.stdin.write(frame_at(k / FPS).tobytes())
    if k % (FPS * 20) == 0: print(f"{k / FPS:5.0f}s / {duration:.0f}s", flush=True)
enc.stdin.close(); enc.wait()
print("done", OUT)
