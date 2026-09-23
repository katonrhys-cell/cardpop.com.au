// Apply manufacturer RRPs to shop_products from data/shop-rrp.csv.
//
// Every shop product is keyed by SKU (Palms Off Gaming rows carry the brand's
// SKU in shop_products.sku). This reads `sku,title,rrp_aud` rows, matches them
// to products by SKU and writes:
//
//   retail_price_aud = rrp_aud                 (always)
//   price_aud        = rrp_aud                 (only with --set-price)
//
// Dry run is the default — nothing is written until you pass --apply. Blank
// rrp_aud cells are skipped, so the committed template can be filled in a few
// rows at a time. Rows whose SKU isn't in the database are reported, never
// inserted.
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/apply-shop-rrp.mjs [--file data/shop-rrp.csv] [--set-price [--only-unpriced]] [--apply]
//
//   --set-price      also make the RRP the selling price ("sell at RRP").
//   --only-unpriced  with --set-price, skip products that already have a
//                    non-zero price_aud so hand-set prices survive.
//   --apply          write the changes. Without it the plan is printed only.
//   --skip-costs     ignore the wholesale_* columns (RRP only).
//   --supplier NAME  / --source TEXT  labels recorded on cost rows
//                    (defaults: "Palms Off Gaming", "data/shop-rrp.csv").
//
// Costs: when the CSV carries wholesale_ex_gst_aud / wholesale_inc_gst_aud,
// each priced SKU's cost is upserted into shop_product_costs (admin-only
// table). A cost-only row (blank rrp_aud) still records its cost.
//
// This never changes `status`: a $0 draft that gains a price stays a draft
// until it is switched to active in Admin → Products, so nothing goes on sale
// by accident. Re-running is idempotent — rows already at the CSV values are
// reported as unchanged.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { parseRrpCsv, planRrpUpdates, updatePatch, planCostUpserts } from '../src/utils/shopRrp.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first.');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SET_PRICE = args.includes('--set-price');
const ONLY_UNPRICED = args.includes('--only-unpriced');
const SKIP_COSTS = args.includes('--skip-costs');
const argAfter = (flag, dflt) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : dflt; };
const SUPPLIER = argAfter('--supplier', 'Palms Off Gaming');
const SOURCE = argAfter('--source', 'data/shop-rrp.csv');
const fileIdx = args.indexOf('--file');
const FILE = path.resolve(REPO_ROOT, fileIdx !== -1 ? args[fileIdx + 1] : 'data/shop-rrp.csv');

const fmt = (v) => (v == null ? '—' : `$${Number(v).toFixed(2)}`);

const csvText = fs.readFileSync(FILE, 'utf8');
const { rows, skipped, errors } = parseRrpCsv(csvText);
if (errors.length) {
  console.error(`CSV problems in ${path.relative(REPO_ROOT, FILE)}:`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`${path.relative(REPO_ROOT, FILE)}: ${rows.length} row(s) with data, ${skipped.length} blank (skipped).`);
if (rows.length === 0) process.exit(0);

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: products, error } = await supabase
  .from('shop_products')
  .select('id, sku, title, price_aud, retail_price_aud, status')
  .not('sku', 'is', null);
if (error) {
  console.error(`Failed to load shop_products: ${error.message}`);
  process.exit(1);
}

const { updates, unchanged, unknown } = planRrpUpdates(rows, products, { setPrice: SET_PRICE, onlyUnpriced: ONLY_UNPRICED });

// Costs live in shop_product_costs (admin-only); compare against what's there.
let costPlan = { upserts: [], unchanged: [], unknown: [] };
if (!SKIP_COSTS && rows.some((r) => r.wholesaleEx != null || r.wholesaleInc != null)) {
  const { data: existingCosts, error: costErr } = await supabase
    .from('shop_product_costs')
    .select('product_id, wholesale_ex_gst_aud, wholesale_inc_gst_aud, supplier_sku');
  if (costErr) {
    console.error(`Failed to load shop_product_costs (${costErr.message}) — has the migration run? Use --skip-costs to ignore costs.`);
    process.exit(1);
  }
  costPlan = planCostUpserts(rows, products, existingCosts || [], { supplier: SUPPLIER, source: SOURCE });
}

const allUnknown = [...new Set([...unknown, ...costPlan.unknown])];
if (allUnknown.length) console.log(`\nNo product with these SKUs (not inserted): ${allUnknown.join(', ')}`);
if (unchanged.length) console.log(`RRP already at CSV values: ${unchanged.length}`);
if (costPlan.unchanged.length) console.log(`Cost already at CSV values: ${costPlan.unchanged.length}`);

if (updates.length === 0 && costPlan.upserts.length === 0) {
  console.log('\nNothing to change.');
  process.exit(0);
}

if (updates.length) {
  console.log(`\n${APPLY ? 'Applying' : 'DRY RUN —'} ${updates.length} RRP update(s)${SET_PRICE ? ' (RRP → price too)' : ''}:`);
  for (const u of updates) {
    const priceNote = u.after.price !== u.before.price ? `  price ${fmt(u.before.price)} → ${fmt(u.after.price)}` : '';
    console.log(`  ${u.sku.padEnd(13)} rrp ${fmt(u.before.rrp)} → ${fmt(u.after.rrp)}${priceNote}   ${u.title}`);
  }
}
if (costPlan.upserts.length) {
  console.log(`\n${APPLY ? 'Applying' : 'DRY RUN —'} ${costPlan.upserts.length} cost upsert(s) → shop_product_costs:`);
  for (const c of costPlan.upserts) {
    const before = c.before ? `${fmt(c.before.ex)} ex / ${fmt(c.before.inc)} inc → ` : '';
    console.log(`  ${c.sku.padEnd(13)} cost ${before}${fmt(c.record.wholesale_ex_gst_aud)} ex / ${fmt(c.record.wholesale_inc_gst_aud)} inc${c.record.supplier_sku ? `  (supplier sku ${c.record.supplier_sku})` : ''}   ${c.title}`);
  }
}

if (!APPLY) {
  console.log('\nDry run only. Re-run with --apply to write these changes.');
  process.exit(0);
}

let ok = 0;
let failed = 0;
for (const u of updates) {
  const { error: upErr } = await supabase.from('shop_products').update(updatePatch(u)).eq('id', u.id);
  if (upErr) { failed++; console.error(`  ✗ ${u.sku}: ${upErr.message}`); }
  else ok++;
}
for (const c of costPlan.upserts) {
  const { error: upErr } = await supabase.from('shop_product_costs').upsert(c.record, { onConflict: 'product_id' });
  if (upErr) { failed++; console.error(`  ✗ ${c.sku} (cost): ${upErr.message}`); }
  else ok++;
}
console.log(`\nDone: ${ok} written, ${failed} failed.`);
process.exit(failed ? 1 : 0);
