// One-off (idempotent) backfill: eagerly migrate existing Supabase Storage
// objects into the R2 bucket behind img.cardpop.com.au.
//
// The image proxy Worker (cloudflare/image-proxy-worker.js) already migrates
// objects into R2 lazily — the first time each is *viewed* it's copied into R2
// via write-through, and every request after that is served from R2 for free.
// This script just pre-warms that path: it lists every object in the public
// buckets and requests each one through the CDN once, so even the first real
// visitor gets the free R2 copy instead of paying a Supabase read.
//
// Because it drives the Worker's own write-through, it needs NO R2 credentials —
// only permission to LIST the buckets (the Supabase service-role key). The one
// prerequisite is that the Worker is already deployed with the `IMAGES` R2
// binding (see docs/image-cdn.md); otherwise every request just proxies Supabase
// and nothing lands in R2.
//
// Cost: exactly one Supabase read per not-yet-migrated object (unavoidable for
// any migration). Objects already in R2 are served from R2 (header
// `x-image-source: r2`) and cost nothing, so re-running is cheap and safe.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/backfill-images-to-r2.mjs [--dry-run] [--host img.cardpop.com.au] [--bucket vault-images] [--concurrency 8]
//
// Defaults to all public image buckets and img.cardpop.com.au.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const DRY_RUN = process.argv.includes('--dry-run');
const HOST = (arg('--host', process.env.IMAGE_CDN_HOST || 'img.cardpop.com.au'))
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');
const CONCURRENCY = Math.max(1, parseInt(arg('--concurrency', '8'), 10) || 8);
const bucketArg = arg('--bucket', '');
const BUCKETS = bucketArg
  ? [bucketArg]
  : ['vault-images', 'avatars', 'media', 'categories', 'events'];

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
        yield* walk(bucket, path); // folders have a null id — recurse
      } else {
        yield path;
      }
    }
    if (data.length < PAGE) return;
    offset += PAGE;
  }
}

const isImage = (path) => /\.(png|jpe?g|webp|gif|avif)$/i.test(path);

const stats = { scanned: 0, warmed: 0, alreadyR2: 0, failed: 0 };

// Warm one object through the CDN. A GET triggers the Worker's write-through;
// we read the body to completion so the tee to R2 isn't cancelled, then discard.
async function warm(bucket, path) {
  const url = `https://${HOST}/storage/v1/object/public/${bucket}/${encodeURI(path)}`;
  if (DRY_RUN) {
    console.log(`[dry-run] would warm ${bucket}/${path}`);
    stats.warmed++;
    return;
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      stats.failed++;
      console.warn(`  ${res.status} ${bucket}/${path}`);
      return;
    }
    const source = res.headers.get('x-image-source');
    // Drain the body so Cloudflare completes the write-through tee into R2.
    await res.arrayBuffer();
    if (source === 'r2') {
      stats.alreadyR2++;
    } else {
      stats.warmed++;
    }
  } catch (err) {
    stats.failed++;
    console.warn(`  fetch failed ${bucket}/${path}: ${err.message}`);
  }
}

// Bounded-concurrency runner over an async iterator.
async function run(bucket) {
  const inFlight = new Set();
  for await (const path of walk(bucket)) {
    if (!isImage(path)) continue;
    stats.scanned++;
    const p = warm(bucket, path).finally(() => inFlight.delete(p));
    inFlight.add(p);
    if (inFlight.size >= CONCURRENCY) await Promise.race(inFlight);
  }
  await Promise.all(inFlight);
}

console.log(
  `Backfilling → https://${HOST} (concurrency ${CONCURRENCY}${DRY_RUN ? ', dry-run' : ''})`
);
for (const bucket of BUCKETS) {
  console.log(`\n=== bucket: ${bucket} ===`);
  try {
    await run(bucket);
  } catch (err) {
    console.warn(`bucket ${bucket}: ${err.message} (skipped)`);
  }
}

console.log(
  `\nDone. Scanned ${stats.scanned} images — ` +
    `${DRY_RUN ? 'would warm' : 'warmed'} ${stats.warmed}, ` +
    `already in R2 ${stats.alreadyR2}, failed ${stats.failed}.`
);
