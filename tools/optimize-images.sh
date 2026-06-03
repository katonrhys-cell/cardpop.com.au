#!/usr/bin/env bash
# Resize and convert images from public/images/originals -> public/images/hero
set -euo pipefail
SRC_DIR="public/images/originals"
DST_DIR="public/images/hero"
mkdir -p "$DST_DIR"

if ! command -v sips >/dev/null 2>&1 && ! command -v convert >/dev/null 2>&1; then
  echo "Warning: neither 'sips' nor 'convert' (ImageMagick) found. Install ImageMagick or use macOS sips."
fi

# Check for cwebp
if ! command -v cwebp >/dev/null 2>&1; then
  echo "Warning: 'cwebp' not found. Install webp (brew install webp) for WebP output."
fi

# Sizes to generate (widths)
SIZES=(1600 1200 1024 640)
QUALITY=80

for img in "$SRC_DIR"/*.{jpg,jpeg,png,JPG,JPEG,PNG}; do
  [ -e "$img" ] || continue
  filename=$(basename "$img")
  name="${filename%.*}"
  ext="${filename##*.}"

  for w in "${SIZES[@]}"; do
    out="${DST_DIR}/${name}-${w}.jpg"
    if command -v sips >/dev/null 2>&1; then
      sips -Z "$w" "$img" --out "$out" >/dev/null
    else
      convert "$img" -resize "${w}" "$out"
    fi

    # Re-encode with quality
    if command -v convert >/dev/null 2>&1; then
      convert "$out" -quality "$QUALITY" "$out"
    fi

    # WebP
    if command -v cwebp >/dev/null 2>&1; then
      cwebp -q "$QUALITY" "$out" -o "${DST_DIR}/${name}-${w}.webp" >/dev/null
    fi
  done

  # Also create a 2000px wide OG-sized image if larger than 2000
  ogout="${DST_DIR}/${name}-2000.jpg"
  if command -v sips >/dev/null 2>&1; then
    sips -Z 2000 "$img" --out "$ogout" >/dev/null || true
  else
    convert "$img" -resize 2000 "$ogout" || true
  fi
  if command -v cwebp >/dev/null 2>&1; then
    cwebp -q "$QUALITY" "$ogout" -o "${DST_DIR}/${name}-2000.webp" >/dev/null || true
  fi

done

echo "Optimized images written to $DST_DIR"
