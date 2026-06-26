// Generates display-sized, next-gen variants of the homepage hero cards.
//
// The hero cards render at 176×240 CSS px (w-44 h-60), so even the smallest
// existing source (-640.jpg) is ~2–4× larger than needed, and they were only
// served as JPG. Lighthouse flagged ~880 ms of image savings (responsive sizing
// + modern formats) on the home page. This script emits AVIF + WebP + a small
// JPG fallback at 360 w (1×) and 720 w (2× / retina) for each card, which the
// <picture> element in HomePage.jsx consumes.
//
// Run once and commit the output (it's deterministic); re-run if the source art
// changes:  node tools/optimize-hero-images.js
//
// Sources live in tools/hero-sources/ (versioned but NOT served — they're the
// high-res originals). Only the small generated variants land in public/, so the
// CDN never ships the multi-MB originals.

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const SOURCE_DIR = path.resolve('tools/hero-sources');
const HERO_DIR = path.resolve('public/images/hero');
const CARDS = ['black-lotus', 'michael-jordan', 'ohtani-rookie', 'lebron-james', 'pikachu-illustrator'];
const WIDTHS = [360, 720];

function bestSource(card) {
  const p = path.join(SOURCE_DIR, `${card}.jpg`);
  return existsSync(p) ? p : null;
}

const kb = (bytes) => (bytes / 1024).toFixed(0) + ' KB';

async function run() {
  let totalIn = 0;
  let totalOut = 0;

  for (const card of CARDS) {
    const src = bestSource(card);
    if (!src) {
      console.warn(`! no source found for ${card}, skipping`);
      continue;
    }
    totalIn += statSync(src).size;
    const meta = await sharp(src).metadata();

    for (const w of WIDTHS) {
      // Don't upscale beyond the source.
      const targetW = Math.min(w, meta.width || w);

      const base = sharp(src).resize({ width: targetW, withoutEnlargement: true });

      const avifPath = path.join(HERO_DIR, `${card}-${w}.avif`);
      const webpPath = path.join(HERO_DIR, `${card}-${w}.webp`);
      const jpgPath = path.join(HERO_DIR, `${card}-${w}.jpg`);

      const [avif, webp, jpg] = await Promise.all([
        base.clone().avif({ quality: 50, effort: 5 }).toFile(avifPath),
        base.clone().webp({ quality: 70 }).toFile(webpPath),
        base.clone().jpeg({ quality: 72, mozjpeg: true }).toFile(jpgPath),
      ]);

      totalOut += avif.size + webp.size + jpg.size;
      console.log(
        `${card} @${w}w  avif=${kb(avif.size)}  webp=${kb(webp.size)}  jpg=${kb(jpg.size)}`,
      );
    }
  }

  console.log('—'.repeat(48));
  console.log(`source originals: ${kb(totalIn)}  →  generated variants: ${kb(totalOut)}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
