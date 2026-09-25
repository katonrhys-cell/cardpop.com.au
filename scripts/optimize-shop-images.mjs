// Convert oversized shop product photos into web-sized WebP and repoint the
// shop at them.
//
// The Palms Off Gaming range was uploaded as the supplier's print-resolution
// PNGs (≈2.6 MB average, up to 7 MB each, with a 1-hour cache header), so a
// shop grid page downloaded well over 100 MB. For every PNG/JPEG referenced by
// shop_products.image_url / images in the chosen bucket this:
//   1. downloads the original (left untouched — nothing is deleted),
//   2. writes optimized/<path>.opt.webp (≤1600 px) and .opt.thumb.webp
//      (≤480 px, used by shop grids) with a one-year cache header,
//   3. with --apply, rewrites the product rows to the .opt.webp URLs — only
//      for sources whose BOTH files uploaded, so a row never points at a
//      missing object.
// Paths are src/utils/shopImageOptimize.js; the thumb naming matches
// utils/imageUrl.js, which serves the thumb in grids automatically.
//
// Usage (or: Actions → Image maintenance → optimize-shop-images):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
//   node scripts/optimize-shop-images.mjs [--apply] [--bucket "palms off gaming products"]
//
// Default is a dry run that only lists what it would convert. Idempotent:
// files already converted are reused, and rows already on .opt.webp are skipped.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import {
  parseObjectUrl, objectUrl, isConvertible, optimizedPath, optimizedThumbPath, rewriteRowImages,
  FULL_MAX, THUMB_MAX,
} from '../src/utils/shopImageOptimize.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const bucketArg = process.argv.indexOf('--bucket');
const BUCKET = bucketArg !== -1 ? process.argv[bucketArg + 1] : 'palms off gaming products';
const CACHE_CONTROL = '31536000';
const CONCURRENCY = 4;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const kb = (n) => `${Math.round(n / 1024).toLocaleString()} KB`;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;

// A missing object resolves { data: false }; any other failure throws.
async function exists(path) {
  const { data } = await supabase.storage.from(BUCKET).exists(path);
  return data === true;
}

async function upload(path, buffer) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'image/webp',
    cacheControl: CACHE_CONTROL,
    upsert: true,
  });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
}

async function convert(source) {
  const fullPath = optimizedPath(source.path);
  const thumbPath = optimizedThumbPath(source.path);
  if ((await exists(fullPath)) && (await exists(thumbPath))) return { reused: true };

  const { data: blob, error } = await supabase.storage.from(BUCKET).download(source.path);
  if (error) throw new Error(`download ${source.path}: ${error.message}`);
  const original = Buffer.from(await blob.arrayBuffer());

  const resize = (max) => sharp(original).rotate().resize({ width: max, height: max, fit: 'inside', withoutEnlargement: true });
  const full = await resize(FULL_MAX).webp({ quality: 82, effort: 5 }).toBuffer();
  const thumb = await resize(THUMB_MAX).webp({ quality: 75, effort: 5 }).toBuffer();
  // Thumb first: the .opt.webp marker promises the thumb exists.
  await upload(thumbPath, thumb);
  await upload(fullPath, full);
  return { before: original.length, full: full.length, thumb: thumb.length };
}

async function pool(items, worker) {
  const queue = [...items];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await worker(queue.shift());
  }));
}

const { data: rows, error: rowsError } = await supabase
  .from('shop_products')
  .select('id, sku, image_url, images');
if (rowsError) throw rowsError;

// Every distinct convertible source URL in this bucket, across all products.
const sources = new Map();
for (const row of rows) {
  const urls = [row.image_url, ...(Array.isArray(row.images) ? row.images : [])];
  for (const url of urls) {
    const parsed = parseObjectUrl(url);
    if (parsed && parsed.bucket === BUCKET && isConvertible(parsed.path)) sources.set(url, parsed);
  }
}

console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — bucket "${BUCKET}": ${sources.size} source photos across ${rows.length} products.`);
if (!APPLY) {
  for (const { path } of [...sources.values()].slice(0, 20)) console.log(`  ${path}  →  ${optimizedPath(path)}`);
  if (sources.size > 20) console.log(`  … and ${sources.size - 20} more`);
  console.log('Re-run with --apply to convert and repoint the products.');
  process.exit(0);
}

const done = new Map();
const failures = [];
let before = 0, afterFull = 0, afterThumb = 0, reused = 0, n = 0;
await pool([...sources.entries()], async ([url, source]) => {
  try {
    const r = await convert(source);
    if (r.reused) reused += 1;
    else {
      before += r.before; afterFull += r.full; afterThumb += r.thumb;
      console.log(`  [${++n}] ${source.path}: ${kb(r.before)} → ${kb(r.full)} (thumb ${kb(r.thumb)})`);
    }
    done.set(url, objectUrl(source.origin, BUCKET, optimizedPath(source.path)));
  } catch (err) {
    failures.push({ path: source.path, message: err.message });
    console.error(`  FAILED ${source.path}: ${err.message}`);
  }
});

let updated = 0;
for (const row of rows) {
  const next = rewriteRowImages(row, done);
  if (!next) continue;
  const { error } = await supabase.from('shop_products').update(next).eq('id', row.id);
  if (error) {
    failures.push({ path: `row ${row.sku}`, message: error.message });
    console.error(`  FAILED to update ${row.sku}: ${error.message}`);
  } else updated += 1;
}

console.log('\nSummary');
console.log(`  converted: ${n}, already converted: ${reused}, failed: ${failures.length}`);
if (n) console.log(`  size: ${mb(before)} → ${mb(afterFull)} full (+ ${mb(afterThumb)} thumbnails)`);
console.log(`  products repointed: ${updated}`);
if (failures.length) {
  console.error('Some photos failed — their products keep the original URLs. Re-run to retry.');
  process.exit(1);
}
