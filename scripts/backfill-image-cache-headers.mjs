// One-off backfill for images uploaded before long-lived cache headers (and,
// for the oldest uploads, before client-side compression) were added.
//
// For every object in the given public buckets it:
//   1. downloads the file,
//   2. optionally recompresses it (only if `sharp` is installed — run
//      `npm i -D sharp` first for this; otherwise the bytes are unchanged),
//   3. re-uploads it to the same path with `cacheControl: 31536000`.
//
// Paths never change, so nothing stored in the database needs updating.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/backfill-image-cache-headers.mjs [--dry-run] [--bucket vault-images]
//
// Defaults to all public image buckets. Re-running is safe (idempotent).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');
const bucketArg = process.argv.indexOf('--bucket');
const BUCKETS =
  bucketArg !== -1
    ? [process.argv[bucketArg + 1]]
    : ['vault-images', 'avatars', 'media', 'categories', 'events'];

const CACHE_CONTROL = '31536000';
const MAX_DIMENSION = 1600; // matches utils/compressImage.js
const WEBP_QUALITY = 82;
const RECOMPRESS_OVER_BYTES = 500 * 1024; // only recompress files >500 KB

// sharp is optional — without it we still fix cache headers.
let sharp = null;
try {
  sharp = (await import('sharp')).default;
  console.log('sharp found — large images will be recompressed.');
} catch {
  console.log('sharp not installed — fixing cache headers only (npm i -D sharp to also recompress).');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function* walk(bucket, prefix = '') {
  let offset = 0;
  const PAGE = 100;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) return;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        // Folders have a null id — recurse.
        yield* walk(bucket, path);
      } else {
        yield { path, metadata: entry.metadata };
      }
    }
    if (data.length < PAGE) return;
    offset += PAGE;
  }
}

const isImage = (path) => /\.(png|jpe?g|webp|gif|avif)$/i.test(path);

async function maybeRecompress(buffer, contentType) {
  if (!sharp || buffer.length <= RECOMPRESS_OVER_BYTES) return { buffer, contentType };
  if (/gif|svg/.test(contentType)) return { buffer, contentType };
  try {
    const out = await sharp(buffer)
      .rotate() // bake in EXIF orientation
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    if (out.length < buffer.length) return { buffer: out, contentType: 'image/webp' };
  } catch (err) {
    console.warn(`  recompress failed (keeping original bytes): ${err.message}`);
  }
  return { buffer, contentType };
}

let scanned = 0;
let updated = 0;
let savedBytes = 0;

for (const bucket of BUCKETS) {
  console.log(`\n=== bucket: ${bucket} ===`);
  try {
    for await (const { path, metadata } of walk(bucket)) {
      if (!isImage(path)) continue;
      scanned++;
      const already = metadata?.cacheControl === `max-age=${CACHE_CONTROL}`;
      const size = metadata?.size ?? 0;
      const needsRecompress = sharp && size > RECOMPRESS_OVER_BYTES;
      if (already && !needsRecompress) continue;

      console.log(`${bucket}/${path} (${(size / 1024).toFixed(0)} KB)`);
      if (DRY_RUN) {
        updated++;
        continue;
      }

      const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(path);
      if (dlErr) {
        console.warn(`  download failed: ${dlErr.message}`);
        continue;
      }
      const original = Buffer.from(await blob.arrayBuffer());
      const { buffer, contentType } = await maybeRecompress(
        original,
        metadata?.mimetype || blob.type || 'application/octet-stream'
      );

      // Note: recompressed bytes keep the original path/extension so nothing
      // referencing the file breaks; contentType is what browsers honour.
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, { upsert: true, contentType, cacheControl: CACHE_CONTROL });
      if (upErr) {
        console.warn(`  re-upload failed: ${upErr.message}`);
        continue;
      }
      updated++;
      savedBytes += Math.max(0, original.length - buffer.length);
    }
  } catch (err) {
    console.warn(`bucket ${bucket}: ${err.message} (skipped)`);
  }
}

console.log(
  `\nDone. Scanned ${scanned} images, ${DRY_RUN ? 'would update' : 'updated'} ${updated}, ` +
    `recompression saved ${(savedBytes / 1024 / 1024).toFixed(1)} MB.`
);
