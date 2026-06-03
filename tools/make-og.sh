#!/usr/bin/env bash
# Copy the largest generated hero image to public/images/hero/og.jpg and og.webp
set -euo pipefail
DST_DIR="public/images/hero"
# prefer webp 2000 then jpg 2000, else pick largest file
if [ -f "$DST_DIR"/*-2000.webp ]; then
  src=$(ls "$DST_DIR"/*-2000.webp | head -n1)
  cp "$src" "$DST_DIR/og.webp"
  echo "Copied $src to $DST_DIR/og.webp"
elif [ -f "$DST_DIR"/*-2000.jpg ]; then
  src=$(ls "$DST_DIR"/*-2000.jpg | head -n1)
  cp "$src" "$DST_DIR/og.jpg"
  echo "Copied $src to $DST_DIR/og.jpg"
else
  # fallback: pick the largest file in DST_DIR
  src=$(ls -S "$DST_DIR" | head -n1)
  if [ -n "$src" ]; then
    cp "$DST_DIR/$src" "$DST_DIR/og.jpg"
    echo "Copied $DST_DIR/$src to $DST_DIR/og.jpg"
  else
    echo "No hero images found in $DST_DIR"
    exit 1
  fi
fi
