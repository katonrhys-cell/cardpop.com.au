#!/usr/bin/env bash
# Fallback optimizer: uses macOS sips only to generate JPEG resized versions
set -euo pipefail
SRC_DIR="public/images/originals"
DST_DIR="public/images/hero"
mkdir -p "$DST_DIR"

SIZES=(2000 1600 1200 1024 640)

for img in "$SRC_DIR"/*.{jpg,jpeg,png,JPG,JPEG,PNG}; do
  [ -e "$img" ] || continue
  filename=$(basename "$img")
  name="${filename%.*}"

  for w in "${SIZES[@]}"; do
    out="$DST_DIR/${name}-${w}.jpg"
    echo "Resizing $img -> $out ($w)"
    sips -Z "$w" "$img" --out "$out" >/dev/null || cp "$img" "$out"
  done

done

echo "JPEG-only optimized images written to $DST_DIR"
