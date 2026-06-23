#!/usr/bin/env node
/**
 * One-time backfill: shrink existing photos already in Supabase Storage.
 *
 * New uploads are compressed in the browser (utils/compressImage.js), but
 * photos uploaded before that change are still full camera resolution
 * (vault-images averages ~2.8 MB each). This script downloads each image,
 * resizes + re-encodes it with sharp, and re-uploads it to the SAME path in
 * the SAME format — so every existing URL keeps working and no database rows
 * need to change.
 *
 * It is conservative by design:
 *   - skips non-images and anything already small
 *   - only rewrites a file if the new version is meaningfully smaller
 *   - --dry-run reports what it *would* do without writing anything
 *
 * ── Usage ──────────────────────────────────────────────────────────────────
 *   Requires a service-role key (never commit it):
 *
 *     export SUPABASE_URL="https://odoglvswwymyjuwlonkf.supabase.co"
 *     export SUPABASE_SERVICE_ROLE_KEY="<your service role key>"
 *
 *   Preview (no writes):
 *     node tools/backfill-images.mjs --dry-run
 *
 *   Run for real:
 *     node tools/backfill-images.mjs
 *
 *   Options:
 *     --dry-run              Report only, don't upload.
 *     --buckets a,b,c        Buckets to process (default: vault-images,media,events).
 *     --max-edge 1600        Longest edge in px (default 1600).
 *     --quality 80           JPEG/WebP quality (default 80).
 *     --min-bytes 150000     Skip files already smaller than this (default 150 KB).
 *     --min-savings 0.1      Only rewrite if it saves at least this fraction (default 10%).
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  const next = args[i + 1];
  return next && !next.startsWith('--') ? next : true;
};

const DRY_RUN = args.includes('--dry-run');
const BUCKETS = String(flag('buckets', 'vault-images,media,events'))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_EDGE = parseInt(flag('max-edge', '1600'), 10);
const QUALITY = parseInt(flag('quality', '80'), 10);
const MIN_BYTES = parseInt(flag('min-bytes', '150000'), 10);
const MIN_SAVINGS = parseFloat(flag('min-savings', '0.1'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.\n' +
      'See the usage comment at the top of this file.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const fmt = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

// Re-encode in the same format so the storage path/extension never changes.
const reencode = (pipeline, ext) => {
  const e = ext.toLowerCase();
  if (e === 'png') return pipeline.png({ compressionLevel: 9, palette: true });
  if (e === 'webp') return pipeline.webp({ quality: QUALITY });
  return pipeline.jpeg({ quality: QUALITY, mozjpeg: true }); // jpg / jpeg
};

const contentTypeFor = (ext) => {
  const e = ext.toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  return 'image/jpeg';
};

// Recursively walk a bucket (storage "folders" are path prefixes).
async function listAll(bucket, prefix = '') {
  const out = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null || item.metadata == null) {
      // A "folder" — recurse.
      out.push(...(await listAll(bucket, path)));
    } else {
      out.push({ path, size: item.metadata?.size ?? null });
    }
  }
  return out;
}

async function processBucket(bucket) {
  console.log(`\n=== Bucket: ${bucket} ===`);
  let objects;
  try {
    objects = await listAll(bucket);
  } catch (err) {
    console.error(`  Could not list bucket: ${err.message}`);
    return { before: 0, after: 0, rewritten: 0, skipped: 0 };
  }

  let before = 0;
  let after = 0;
  let rewritten = 0;
  let skipped = 0;

  for (const obj of objects) {
    if (!IMAGE_EXT.test(obj.path)) {
      skipped++;
      continue;
    }
    if (obj.size != null && obj.size < MIN_BYTES) {
      skipped++;
      continue;
    }

    const ext = obj.path.match(IMAGE_EXT)[1];

    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(obj.path);
    if (dlErr || !blob) {
      console.warn(`  ! download failed: ${obj.path} (${dlErr?.message || 'no data'})`);
      skipped++;
      continue;
    }

    const input = Buffer.from(await blob.arrayBuffer());
    let output;
    try {
      output = await reencode(
        sharp(input, { failOn: 'none' }).rotate().resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        }),
        ext
      ).toBuffer();
    } catch (err) {
      console.warn(`  ! could not process: ${obj.path} (${err.message})`);
      skipped++;
      continue;
    }

    before += input.length;
    const savings = 1 - output.length / input.length;

    if (savings < MIN_SAVINGS) {
      after += input.length; // keeping the original
      skipped++;
      continue;
    }

    after += output.length;
    rewritten++;
    console.log(
      `  ${DRY_RUN ? '[dry] ' : ''}${obj.path}: ${fmt(input.length)} → ${fmt(output.length)} (-${(savings * 100).toFixed(0)}%)`
    );

    if (!DRY_RUN) {
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(obj.path, output, { upsert: true, contentType: contentTypeFor(ext) });
      if (upErr) {
        console.warn(`  ! upload failed: ${obj.path} (${upErr.message})`);
        rewritten--;
        after = after - output.length + input.length;
      }
    }
  }

  console.log(
    `  ${bucket}: ${rewritten} rewritten, ${skipped} skipped | ${fmt(before)} → ${fmt(after)}`
  );
  return { before, after, rewritten, skipped };
}

(async () => {
  console.log(
    `${DRY_RUN ? 'DRY RUN — ' : ''}backfill: buckets=[${BUCKETS.join(', ')}] maxEdge=${MAX_EDGE} quality=${QUALITY}`
  );
  const totals = { before: 0, after: 0, rewritten: 0, skipped: 0 };
  for (const bucket of BUCKETS) {
    const r = await processBucket(bucket);
    totals.before += r.before;
    totals.after += r.after;
    totals.rewritten += r.rewritten;
    totals.skipped += r.skipped;
  }
  console.log(
    `\nTOTAL: ${totals.rewritten} rewritten, ${totals.skipped} skipped | ` +
      `${fmt(totals.before)} → ${fmt(totals.after)} ` +
      `(saved ${fmt(totals.before - totals.after)})`
  );
  if (DRY_RUN) console.log('No files were changed (dry run).');
})().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
