import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Every Supabase test mocks the client, so a query naming a column `listings`
// doesn't have passes every test and only fails in production — PostgREST
// rejects the whole request with a 400. That is how `listings.title` (which has
// never existed: a listing's name, photos, condition and grade live on its
// vault item) broke Buy Now checkout, every crawler-facing listing page, the
// sitemap's listing URLs and the homepage activity ticker at once.
//
// This guard reads the source and checks each `.from('listings')` select and
// filter against the table's real columns. Adding a column? Add it here in the
// same PR as its migration.
const LISTINGS_COLUMNS = new Set([
  'id', 'vault_item_id', 'seller_id', 'listing_type', 'status', 'price_aud',
  'accepts_offers', 'reserve_price_aud', 'starting_bid_aud', 'current_bid_aud',
  'bid_count', 'auction_start_at', 'auction_end_at', 'auction_started',
  'trade_wants', 'ships_nationwide', 'shipping_cost_aud', 'free_shipping', 'slug',
  'tags', 'listed_at', 'sold_at', 'created_at', 'updated_at', 'grading_number',
  'grading_company', 'grading_verified', 'grading_verified_at', 'accepts_trade',
  'price_min_aud', 'price_max_aud', 'flagged', 'flag_reason', 'offers_open_at',
  'offers_close_at',
]);

// Pre-existing queries against columns that don't exist, found by the
// 2026-10-03 site test and not yet fixed. Each needs more than a column swap
// (the page/route was written against a schema that never shipped). Remove an
// entry when its file is fixed — the test fails if an entry goes stale.
const KNOWN_BROKEN = {
  'pages/admin/CategoryMappingPage.jsx': ['category_id'],
  'utils/categoryMappingEngine.js': ['category_id'],
  'src/routes/recommendations.js': ['category'],
};

const ROOT = path.resolve(import.meta.dirname, '../..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'tests', 'e2e', 'backups', 'coverage', '.vercel']);

function sourceFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(jsx?|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

// Top-level column names of a PostgREST select string. Embeds (`alias:table(...)`,
// `table(...)`) are skipped — they name other tables.
function topLevelColumns(select) {
  const cols = [];
  let depth = 0;
  let cur = '';
  let embed = false;
  const flush = () => {
    const tok = cur.trim();
    if (tok && !embed && tok !== '*') {
      // `alias:column` and `column::cast` both name `column`.
      cols.push(tok.split(':').filter(Boolean).pop().replace(/::.*$/, '').trim());
    }
    cur = ''; embed = false;
  };
  for (const ch of select) {
    if (ch === '(') { depth++; if (depth === 1) embed = true; continue; }
    if (ch === ')') { depth--; continue; }
    if (depth > 0) continue;
    if (ch === ',') { flush(); continue; }
    cur += ch;
  }
  flush();
  return cols;
}

function listingQueryProblems() {
  const problems = {};
  const add = (file, col) => { (problems[file] ||= new Set()).add(col); };
  for (const file of sourceFiles(ROOT)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const src = fs.readFileSync(file, 'utf8');
    // The chain from a listings query up to the next query or statement end.
    for (const m of src.matchAll(/\.from\(\s*['"]listings['"]\s*\)([\s\S]*?)(?=\.from\(|;\s*$|\n\s*\n)/gm)) {
      const chain = m[1];
      const sel = chain.match(/\.select\(\s*(['"`])([\s\S]*?)\1/);
      if (sel && !sel[2].includes('${')) {
        for (const col of topLevelColumns(sel[2])) if (!LISTINGS_COLUMNS.has(col)) add(rel, col);
      }
      for (const f of chain.matchAll(/\.(?:eq|neq|in|is|ilike|like|gt|gte|lt|lte|contains|order|not)\(\s*['"]([a-z_]+)['"]/g)) {
        if (!LISTINGS_COLUMNS.has(f[1])) add(rel, f[1]);
      }
    }
  }
  return Object.fromEntries(Object.entries(problems).map(([f, s]) => [f, [...s].sort()]));
}

describe('listings queries only name real columns', () => {
  const problems = listingQueryProblems();

  it('parses selects, skipping embeds', () => {
    expect(topLevelColumns('id, slug, vault_item:vault_items!inner(card_name, vault_images(storage_path)), seller:profiles!seller_id(username), price_aud'))
      .toEqual(['id', 'slug', 'price_aud']);
    expect(topLevelColumns('*, vault_item:vault_items(*)')).toEqual([]);
  });

  it('has no new queries against missing columns', () => {
    const unexpected = Object.fromEntries(
      Object.entries(problems)
        .map(([file, cols]) => [file, cols.filter(c => !(KNOWN_BROKEN[file] || []).includes(c))])
        .filter(([, cols]) => cols.length),
    );
    expect(unexpected).toEqual({});
  });

  it('keeps the known-broken list current', () => {
    for (const [file, cols] of Object.entries(KNOWN_BROKEN)) {
      expect(problems[file] || [], `${file} is fixed — remove it from KNOWN_BROKEN`).toEqual(expect.arrayContaining(cols));
    }
  });
});
