#!/usr/bin/env node
// Bundle-size budget. Measures the gzipped size of the JavaScript that enters
// the INITIAL page load (the chunks referenced directly by dist/index.html) and
// fails if it exceeds the budget. Run after `npm run build`.
//
// This guards the metric that actually moves Core Web Vitals / conversion:
// how much JS a first-time visitor must download before the app is interactive.
// Lazy route/feature chunks (e.g. opencv) are intentionally excluded — they
// only load when their feature is used.

import process from 'node:process';
import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

// Budget for the gzipped initial JS payload. Tighten over time; raise only with
// a deliberate justification. Ratcheted 400→300 after evicting framer-motion
// (~37 KB) from the critical path. Raised 300→320 once React was split into its
// own counted initial chunk (vendor-react ≈86 KB) alongside vendor-radix ≈86 KB
// — both are unavoidable on first paint, putting the realistic floor at ~314 KB
// (Sentry is already fully lazy-loaded). Re-tighten if Radix/dates are deferred.
const BUDGET_KB = 320;

const distDir = 'dist';
const indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');

// Collect the entry chunks the HTML loads up front (module scripts + modulepreload).
const refs = new Set();
for (const m of indexHtml.matchAll(/assets\/[A-Za-z0-9_-]+\.js/g)) refs.add(m[0]);

if (refs.size === 0) {
  console.error('check-bundle-size: no initial JS chunks found in dist/index.html — did the build run?');
  process.exit(1);
}

const rows = [];
let totalGz = 0;
for (const ref of refs) {
  const file = path.join(distDir, ref);
  try {
    statSync(file);
  } catch {
    continue;
  }
  const gz = gzipSync(readFileSync(file)).length;
  totalGz += gz;
  rows.push({ name: ref.replace('assets/', ''), gz });
}

rows.sort((a, b) => b.gz - a.gz);
const kb = (n) => (n / 1024).toFixed(1).padStart(7) + ' KB';

console.log('Initial JS payload (gzipped):');
for (const r of rows) console.log(`  ${kb(r.gz)}  ${r.name}`);
console.log('  ' + '-'.repeat(40));
console.log(`  ${kb(totalGz)}  TOTAL  (budget ${BUDGET_KB} KB)`);

const totalKb = totalGz / 1024;
if (totalKb > BUDGET_KB) {
  console.error(
    `\n❌ Initial JS is ${totalKb.toFixed(1)} KB gzipped, over the ${BUDGET_KB} KB budget ` +
    `by ${(totalKb - BUDGET_KB).toFixed(1)} KB.\n` +
    `   Lazy-load the new weight, or raise BUDGET_KB in tools/check-bundle-size.js with a reason.`,
  );
  process.exit(1);
}
console.log(`\n✅ Within budget (${(BUDGET_KB - totalKb).toFixed(1)} KB headroom).`);
