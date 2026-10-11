// Apply barcodes (GTINs) to shop products from data/shop-barcodes.csv.
//
// Google needs a GTIN to attach product reviews and star ratings to a product.
// This reads `sku,title,barcode` rows (built from the Palms Off Gaming order
// form), matches them to shop_products by SKU — falling back to
// shop_product_variants for a per-colour SKU — and writes `barcode`.
//
// Dry run is the default — nothing is written until you pass --apply.
//   * a barcode that fails its GTIN check digit is reported and never written;
//   * a product that already has a *different* barcode is reported as a
//     conflict and left alone unless you pass --overwrite;
//   * SKUs not in the database are reported, never inserted.
// Re-running is idempotent.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/apply-shop-barcodes.mjs [--file data/shop-barcodes.csv] [--overwrite] [--apply]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseBarcodeCsv, planBarcodeUpdates } from '../src/utils/shopBarcodes.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OVERWRITE = args.includes('--overwrite');
const fileIdx = args.indexOf('--file');
const FILE = path.resolve(REPO_ROOT, fileIdx !== -1 ? args[fileIdx + 1] : 'data/shop-barcodes.csv');

const { rows, invalid, skipped, errors } = parseBarcodeCsv(fs.readFileSync(FILE, 'utf8'));
if (errors.length) {
  console.error(`CSV problems in ${path.relative(REPO_ROOT, FILE)}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`${path.relative(REPO_ROOT, FILE)}: ${rows.length} valid barcode(s), ${skipped} blank (skipped).`);
if (invalid.length) {
  console.log(`\nFailed the GTIN check digit — NOT written, confirm with the supplier:`);
  for (const i of invalid) console.log(`  ${i.sku.padEnd(14)} ${i.barcode}  (line ${i.line})`);
}
if (rows.length === 0) process.exit(0);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const [{ data: products, error: pErr }, { data: variants, error: vErr }] = await Promise.all([
  supabase.from('shop_products').select('id, sku, title, barcode').not('sku', 'is', null),
  supabase.from('shop_product_variants').select('id, sku, barcode').not('sku', 'is', null),
]);
if (pErr || vErr) {
  console.error(`Failed to load products: ${(pErr || vErr).message}`);
  process.exit(1);
}

const plan = planBarcodeUpdates(rows, products, variants || [], { overwrite: OVERWRITE });

if (plan.unknown.length) console.log(`\nNo product or variant with these SKUs (not inserted): ${plan.unknown.join(', ')}`);
if (plan.unchanged.length) console.log(`Barcode already correct: ${plan.unchanged.length}`);
if (plan.conflicts.length) {
  console.log(`\nAlready has a DIFFERENT barcode — left alone (use --overwrite to replace):`);
  for (const c of plan.conflicts) console.log(`  ${c.sku.padEnd(14)} on file ${c.existing}  ≠  csv ${c.incoming}`);
}
if (plan.updates.length === 0) { console.log('\nNothing to change.'); process.exit(0); }

console.log(`\n${APPLY ? 'Applying' : 'DRY RUN —'} ${plan.updates.length} barcode update(s):`);
for (const u of plan.updates) {
  console.log(`  ${u.kind.padEnd(7)} ${u.sku.padEnd(14)} ${u.before || '—'} → ${u.after}   ${u.title || ''}`);
}
if (!APPLY) { console.log('\nDry run only. Re-run with --apply to write these changes.'); process.exit(0); }

let ok = 0;
let failed = 0;
for (const u of plan.updates) {
  const table = u.kind === 'product' ? 'shop_products' : 'shop_product_variants';
  const { error } = await supabase.from(table).update({ barcode: u.after }).eq('id', u.id);
  if (error) { failed += 1; console.error(`  ✗ ${u.sku}: ${error.message}`); } else ok += 1;
}
console.log(`\nDone: ${ok} updated, ${failed} failed.`);
process.exit(failed ? 1 : 0);
