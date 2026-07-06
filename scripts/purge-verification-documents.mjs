// One-off purge of identity-verification documents from Supabase Storage.
//
// CardPop no longer collects or stores government ID documents — identity
// verification is handled entirely by Stripe Connect (Stripe verifies the ID on
// its own regulated platform; we only read the payouts-enabled result). This
// script removes the raw documents that the old self-hosted flows left behind:
//
//   • verification-docs bucket (private)      → every object (photo IDs + selfies)
//   • vault-images bucket, `verification/` prefix (public, legacy) → ID photos
//
// It does NOT touch `avatars/` in vault-images (public profile pictures) or any
// other bucket.
//
// SAFETY: dry-run by default. It lists what it *would* delete and stops. Pass
// --confirm to actually delete. Re-running is safe (idempotent).
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/purge-verification-documents.mjs [--confirm]

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const CONFIRM = process.argv.includes('--confirm');

// [bucket, prefix] targets. An empty prefix means the whole bucket.
const TARGETS = [
  ['verification-docs', ''],
  ['vault-images', 'verification'],
];

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
        yield* walk(bucket, path); // Folders have a null id — recurse.
      } else {
        yield path;
      }
    }
    if (data.length < PAGE) return;
    offset += PAGE;
  }
}

// Supabase caps a single remove() call; delete in chunks.
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function run() {
  console.log(CONFIRM
    ? '⚠️  CONFIRM mode — objects will be permanently deleted.\n'
    : 'Dry run (no deletions). Re-run with --confirm to delete.\n');

  let grandTotal = 0;

  for (const [bucket, prefix] of TARGETS) {
    const paths = [];
    try {
      for await (const path of walk(bucket, prefix)) paths.push(path);
    } catch (err) {
      console.error(`  ✗ ${bucket}/${prefix || '(root)'}: ${err.message}`);
      continue;
    }

    const label = `${bucket}/${prefix || '(root)'}`;
    if (paths.length === 0) {
      console.log(`  • ${label}: nothing to purge`);
      continue;
    }

    console.log(`  • ${label}: ${paths.length} object(s)`);
    for (const p of paths) console.log(`      ${p}`);
    grandTotal += paths.length;

    if (CONFIRM) {
      let deleted = 0;
      for (const group of chunk(paths, 100)) {
        const { error } = await supabase.storage.from(bucket).remove(group);
        if (error) {
          console.error(`      ✗ delete failed: ${error.message}`);
        } else {
          deleted += group.length;
        }
      }
      console.log(`      → deleted ${deleted}/${paths.length}`);
    }
  }

  console.log(`\n${CONFIRM ? 'Purged' : 'Would purge'} ${grandTotal} object(s) total.`);
  if (!CONFIRM && grandTotal > 0) console.log('Re-run with --confirm to delete them.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
