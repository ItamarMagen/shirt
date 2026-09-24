#!/bin/bash
# Shrinks every photo in ./photos to max 1600px and converts to JPEG, so the
# site loads fast on phones. Originals are kept in ./photos/originals.
# Usage (from the site folder):  bash tools/resize.sh
set -e
cd "$(dirname "$0")/../photos"
mkdir -p originals
for f in *.jpg *.jpeg *.JPG *.JPEG *.png *.PNG *.heic *.HEIC; do
  [ -f "$f" ] || continue
  cp -n "$f" originals/ 2>/dev/null || true
  out="${f%.*}.jpg"
  sips -s format jpeg -s formatOptions 80 -Z 1600 "$f" --out "$out" >/dev/null
  [ "$f" != "$out" ] && rm "$f"
  echo "✓ $out"
done
