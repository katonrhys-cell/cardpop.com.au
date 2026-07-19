// Download every object from the Supabase Storage buckets to a local folder,
// preserving bucket/path structure. Used by scripts/backup-supabase.sh as the
// "storage" half of a full manual backup (the DB half is `supabase db dump`).
//
// SENSITIVE DATA: the `verification-docs` bucket holds customer identity
// documents (passport / licence scans). It is EXCLUDED by default so a routine
// backup never lands PII in Google Drive or a laptop's Downloads folder. Pass
// --include-sensitive only if you have a specific, secured reason to copy it,
// and store the result encrypted — never in a shared/synced Drive folder.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/backup-storage.mjs [--out ./backups/storage] [--bucket avatars] [--include-sensitive]
//
// Re-running is safe: existing files are overwritten with the current copy.

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const arg = (flag, fallback = null) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const OUT_DIR = arg('--out', './backups/storage');
const INCLUDE_SENSITIVE = process.argv.includes('--include-sensitive');

// All buckets in the project. verification-docs is sensitive (see header).
const PUBLIC_BUCKETS = ['ai-images', 'avatars', 'categories', 'events', 'media', 'vault-images'];
const SENSITIVE_BUCKETS = ['verification-docs'];

const only = arg('--bucket');
let buckets = only
  ? [only]
  : INCLUDE_SENSITIVE
    ? [...PUBLIC_BUCKETS, ...SENSITIVE_BUCKETS]
    : PUBLIC_BUCKETS;

if (only && SENSITIVE_BUCKETS.includes(only) && !INCLUDE_SENSITIVE) {
  console.error(`Refusing to back up sensitive bucket "${only}" without --include-sensitive.`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Storage list() is not recursive — walk folders depth-first.
async function* walk(bucket, prefix = '') {
  let offset = 0;
  const PAGE = 100;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A folder placeholder has no id/metadata; recurse into it.
      if (entry.id === null || entry.metadata === null) {
        yield* walk(bucket, path);
      } else {
        yield path;
      }
    }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
}

let total = 0;
let failed = 0;

for (const bucket of buckets) {
  let count = 0;
  try {
    for await (const path of walk(bucket)) {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (error) {
        console.warn(`  ! ${bucket}/${path}: ${error.message}`);
        failed += 1;
        continue;
      }
      const dest = join(OUT_DIR, bucket, path);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, Buffer.from(await data.arrayBuffer()));
      count += 1;
      total += 1;
    }
    console.log(`✓ ${bucket}: ${count} object(s)`);
  } catch (err) {
    console.error(`✗ ${bucket}: ${err.message}`);
    failed += 1;
  }
}

console.log(`\nDone. ${total} object(s) → ${OUT_DIR}${failed ? ` (${failed} failed)` : ''}`);
if (!INCLUDE_SENSITIVE) console.log('Note: verification-docs (customer ID scans) was skipped by design.');
process.exit(failed ? 1 : 0);
