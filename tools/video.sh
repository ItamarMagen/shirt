#!/bin/bash
# Converts a video into a small, web-friendly MP4 (H.264, max 720p, fast start).
# Usage (from the site folder):  bash tools/video.sh "pictures/IMG_1234.MOV" photos/dance.mp4
set -e
IN="$1"; OUT="$2"
[ -z "$IN" ] || [ -z "$OUT" ] && { echo "Usage: bash tools/video.sh <input> <output.mp4>"; exit 1; }
ffmpeg -y -loglevel error -i "$IN" \
  -vf "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'" \
  -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p \
  -c:a aac -b:a 96k -movflags +faststart -map_metadata -1 "$OUT"
echo "✓ $OUT ($(du -h "$OUT" | cut -f1))"
