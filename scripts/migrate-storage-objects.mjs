#!/usr/bin/env node
// Mirrors every object in every storage bucket from the OLD (Tokyo) project
// to the NEW (Sydney) project, preserving path and content-type. Bucket
// definitions + RLS policies are already handled by db-region-migrate.yml
// (SQL-level transfer); this script moves the actual file bytes, which the
// Storage API — not plain SQL — has to do.
//
// Requires service-role keys for both projects (bypasses RLS so private
// buckets like verification-docs and ai-images are included). Re-runnable:
// uploads use upsert so a partial prior run just re-uploads existing files.
//
// Usage:
//   OLD_SUPABASE_URL=... OLD_SERVICE_ROLE_KEY=... \
//   NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... \
//   node scripts/migrate-storage-objects.mjs

import { createClient } from '@supabase/supabase-js';

const oldUrl = process.env.OLD_SUPABASE_URL;
const oldKey = process.env.OLD_SERVICE_ROLE_KEY;
const newUrl = process.env.NEW_SUPABASE_URL;
const newKey = process.env.NEW_SERVICE_ROLE_KEY;

if (!oldUrl || !oldKey || !newUrl || !newKey) {
  console.error('Missing one of OLD_SUPABASE_URL, OLD_SERVICE_ROLE_KEY, NEW_SUPABASE_URL, NEW_SERVICE_ROLE_KEY');
  process.exit(1);
}

const oldClient = createClient(oldUrl, oldKey, { auth: { persistSession: false } });
const newClient = createClient(newUrl, newKey, { auth: { persistSession: false } });

async function listAllObjects(client, bucket, prefix = '') {
  const results = [];
  const { data, error } = await client.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // folder placeholder — recurse
      results.push(...(await listAllObjects(client, bucket, path)));
    } else {
      results.push({ path, size: entry.metadata?.size ?? 0, contentType: entry.metadata?.mimetype });
    }
  }
  return results;
}

async function migrateBucket(bucketId) {
  console.log(`\n=== ${bucketId} ===`);
  const objects = await listAllObjects(oldClient, bucketId);
  console.log(`${objects.length} objects to mirror`);

  let ok = 0;
  let failed = 0;
  for (const obj of objects) {
    try {
      const { data: blob, error: dlErr } = await oldClient.storage.from(bucketId).download(obj.path);
      if (dlErr) throw dlErr;
      const arrayBuffer = await blob.arrayBuffer();
      const { error: upErr } = await newClient.storage.from(bucketId).upload(obj.path, Buffer.from(arrayBuffer), {
        contentType: obj.contentType || blob.type || 'application/octet-stream',
        cacheControl: '31536000',
        upsert: true,
      });
      if (upErr) throw upErr;
      ok++;
      if (ok % 25 === 0) console.log(`  ${ok}/${objects.length}`);
    } catch (err) {
      failed++;
      console.error(`  FAILED ${bucketId}/${obj.path}: ${err.message}`);
    }
  }
  console.log(`${bucketId}: ${ok} ok, ${failed} failed`);
  return { bucketId, total: objects.length, ok, failed };
}

const { data: buckets, error: bucketsErr } = await oldClient.storage.listBuckets();
if (bucketsErr) {
  console.error(`listBuckets: ${bucketsErr.message}`);
  process.exit(1);
}

const summary = [];
for (const b of buckets) {
  summary.push(await migrateBucket(b.id));
}

console.log('\n=== SUMMARY ===');
let anyFailed = false;
for (const s of summary) {
  console.log(`${s.bucketId}: ${s.ok}/${s.total} ok${s.failed ? `, ${s.failed} FAILED` : ''}`);
  if (s.failed > 0) anyFailed = true;
}
if (anyFailed) process.exit(1);
