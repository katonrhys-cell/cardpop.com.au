import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Google's Merchant listings report warns "No global identifier provided
// (e.g., gtin, brand)" for any schema.org Product with none of gtin / mpn /
// brand. The 2026-10-05 Search Console email was exactly that: several Product
// nodes were hand-written without identifiers even though the data existed.
//
// This guard reads the source and fails when a Product node is written without
// going through utils/productIdentifiers.js — the one place that knows how to
// derive brand / sku / mpn / gtin for shop products and single cards. A new
// page that emits a Product must spread `shopProductIdentifiersLd(...)` or
// `cardIdentifiersLd(...)` into the node (within the node's own lines), so the
// warning cannot quietly come back with the next product surface.
const ROOT = path.resolve(import.meta.dirname, '../..');
const SCAN_DIRS = ['pages', 'components', 'api', 'utils', 'src', 'lib', 'hooks'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'tests', 'e2e', 'backups', 'coverage', '.vercel']);
const PRODUCT_NODE = /["']?@type["']?\s*:\s*["']Product["']/;
const HELPER_CALL = /\b(shopProductIdentifiersLd|cardIdentifiersLd)\s*\(/;
const HELPER_IMPORT = /productIdentifiers\.js['"]/;
// How many lines after `@type: 'Product'` the helper spread must appear —
// generous enough for image/description/category lines, tight enough that a
// spread belonging to the *next* node can't satisfy this one.
const WINDOW = 30;

function sourceFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const files = SCAN_DIRS.flatMap((d) => sourceFiles(path.join(ROOT, d)));

describe('schema.org Product nodes carry a global identifier', () => {
  it('scans the real source tree', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  const nodes = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (PRODUCT_NODE.test(line)) nodes.push({ file: path.relative(ROOT, file), line: i + 1, lines });
    });
  }

  it('finds the Product nodes it is guarding', () => {
    // api/prerender.js plus the SPA product pages — if this drops to zero the
    // regex no longer matches how nodes are written and the guard is blind.
    expect(nodes.length).toBeGreaterThanOrEqual(8);
  });

  it.each(nodes.map((n) => [`${n.file}:${n.line}`, n]))(
    '%s spreads shopProductIdentifiersLd/cardIdentifiersLd into the node',
    (_label, { file, line, lines }) => {
      const window = lines.slice(line - 1, line - 1 + WINDOW).join('\n');
      expect(window, `Product node at ${file}:${line} has no identifier helper within ${WINDOW} lines — spread shopProductIdentifiersLd(...) or cardIdentifiersLd(...) from utils/productIdentifiers.js`).toMatch(HELPER_CALL);
      expect(lines.join('\n'), `${file} uses the identifier helper but does not import utils/productIdentifiers.js`).toMatch(HELPER_IMPORT);
    },
  );
});
