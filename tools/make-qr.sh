#!/bin/bash
# Creates print-ready QR codes for the site URL.
# Usage (from the site folder):  bash tools/make-qr.sh https://YOURNAME.github.io/wedding-crew/
set -e
URL="$1"
[ -z "$URL" ] && { echo "Usage: bash tools/make-qr.sh <site-url>"; exit 1; }
cd "$(dirname "$0")/.."
VENV="$HOME/.cache/wedding-qr-venv"
[ -d "$VENV" ] || { python3 -m venv "$VENV"; "$VENV/bin/pip" install -q segno; }
"$VENV/bin/python" - "$URL" <<'PY'
import sys, segno
qr = segno.make(sys.argv[1], error='h')
qr.save("qr/qr.svg", scale=10, border=4)                 # vector: best for printing
qr.save("qr/qr.png", scale=40, border=4)                 # big PNG (~1500px+)
qr.save("qr/qr-white.png", scale=40, border=4, dark="white", light=None)  # for dark shirts
print("✓ QR codes saved in qr/ for", sys.argv[1])
PY
