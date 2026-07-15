// One-off purge of legacy identity-verification documents from storage.
//
// ID verification is now handled entirely by Stripe Identity, so nothing in the
// private `verification-docs` bucket should be retained — it holds photo IDs and
// selfies uploaded by the retired /account/verification flow (plus transient
// AI-extraction scans). This is the privacy cleanup the migration
// 20260713112655_purge_legacy_id_verification_documents intended, but that
// migration can't run: current Supabase blocks direct DELETE on storage.objects
// ("Direct deletion from storage tables is not allowed. Use the Storage API
// instead."), so the deletion has to go through the Storage API — which is what
// this script does with the service-role client.
//
// Scope: the `verification-docs` bucket only. It is emptied entirely; the bucket
// itself is kept (still private). The bucket is dedicated to ID verification, so
// every object in it is a legacy document that is safe to remove.
//
// NOT in scope: the `ai-images` bucket's `ocr/*` prefix. That prefix mixes
// retired ID scans with legitimate AI-chat and card-OCR images under
// indistinguishable random names. The only way to tell them apart is by which
// objects are still referenced from AI chat history (public.ai_messages). That
// table was empty/absent, so a blind purge here would delete real user images —
// so this script deliberately leaves ai-images/ocr alone. Revisit once chat
// history exists and can be diffed against the bucket.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/purge-legacy-id-documents.mjs [--confirm] [--bucket verification-docs]
//
// Safe by default: without --confirm it runs as a DRY RUN and only lists what it
// would delete. Pass --confirm to actually remove the objects. Deletion is
// irreversible. Re-running is idempotent (an already-empty bucket deletes nothing).

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const CONFIRM = process.argv.includes('--confirm');
const bucketArg = process.argv.indexOf('--bucket');
const BUCKET = bucketArg !== -1 ? process.argv[bucketArg + 1] : 'verification-docs';

const LIST_PAGE = 100;
const REMOVE_BATCH = 100; // storage.remove() takes an array of paths

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// storage list() is not recursive: rows with a null `id` are folders. Recurse
// into them and yield the full path of every actual object.
async function* walk(bucket, prefix = '') {
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) return;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        yield* walk(bucket, path); // folder
      } else {
        yield path;
      }
    }
    if (data.length < LIST_PAGE) return;
    offset += LIST_PAGE;
  }
}

async function removeBatch(bucket, paths) {
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new Error(`remove ${bucket} (${paths.length} objects): ${error.message}`);
}

async function main() {
  console.log(`Purging bucket "${BUCKET}" ${CONFIRM ? '(LIVE — objects will be deleted)' : '(DRY RUN — nothing will be deleted; pass --confirm to delete)'}`);

  const paths = [];
  for await (const path of walk(BUCKET)) {
    paths.push(path);
    if (!CONFIRM) console.log(`  would delete: ${path}`);
  }

  console.log(`Found ${paths.length} object(s) in "${BUCKET}".`);
  if (paths.length === 0) {
    console.log('Nothing to purge.');
    return;
  }
  if (!CONFIRM) {
    console.log('Dry run complete. Re-run with --confirm to delete the objects above.');
    return;
  }

  let deleted = 0;
  for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
    const batch = paths.slice(i, i + REMOVE_BATCH);
    await removeBatch(BUCKET, batch);
    deleted += batch.length;
    console.log(`  deleted ${deleted}/${paths.length}`);
  }
  console.log(`Done. Removed ${deleted} object(s) from "${BUCKET}".`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
