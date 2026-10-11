#!/usr/bin/env node
// Live check: every schema.org Product on the public site carries a global
// identifier (brand, gtin or mpn) — what Google's Merchant listings report
// warns about as "No global identifier provided (e.g., gtin, brand)".
//
// tests/backend/productMarkupIdentifiers.test.js guards the *code* (a Product
// node must be built through utils/productIdentifiers.js). This checks the
// *data* on the live site: a card listed without a franchise or number, a shop
// row saved with a malformed barcode, a prerender embed that stopped returning
// a brand — none of those fail a unit test. It fetches pages the way Googlebot
// does (a bot user-agent, so Vercel serves api/prerender.js), pulls every
// JSON-LD block, walks it for Product nodes (nested in ItemList too) and
// reports each one with no brand / gtin / mpn, or a gtin that isn't a GTIN.
//
// Dependency-free (parsing lives in src/utils/merchantListingsCheck.js, where
// it is unit-tested against the prerender) so the weekly workflow runs it
// without `npm ci`.
//
// Usage:
//   node scripts/check-merchant-listings.mjs                 # sample the sitemap
//   node scripts/check-merchant-listings.mjs --sample 15     # more per section
//   node scripts/check-merchant-listings.mjs https://cardpop.com.au/shop/binders/… …
//   node scripts/check-merchant-listings.mjs --base https://preview.vercel.app
//
// Exit code 0 = every Product found has an identifier, 1 = at least one hasn't
// (or a page could not be fetched), 2 = usage/sitemap error.

import { checkPageMarkup } from '../src/utils/merchantListingsCheck.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = (flag('--base', 'https://cardpop.com.au')).replace(/\/$/, '');
const SAMPLE = Number(flag('--sample', 8));
const urls = args.filter((a, i) => /^https?:\/\//.test(a) && args[i - 1] !== '--base');

// Vercel routes any user-agent containing "bot" to the prerender — this is
// our own site, so it says who it is rather than borrowing Googlebot's name.
const UA = 'CardPopMarkupBot/1.0 (+https://cardpop.com.au/; merchant-listings check)';
// Sitemap sections that carry Product markup. A hub page in the sample that
// has no Product at all is reported as "no Product" (informational), not a
// failure — only an identifier-less Product is one.
const SECTIONS = ['/marketplace/', '/shop/', '/prices/', '/dealer/', '/product/'];

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/xml' }, redirect: 'follow', signal: ctrl.signal });
    return { status: r.status, text: await r.text() };
  } finally {
    clearTimeout(t);
  }
}

async function sampleSitemap() {
  const { status, text } = await get(`${BASE}/sitemap.xml`);
  if (status !== 200) throw new Error(`sitemap.xml answered ${status}`);
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const picked = [];
  for (const section of SECTIONS) {
    const inSection = locs.filter((u) => new URL(u).pathname.startsWith(section));
    // Spread the sample across the section rather than taking the first N —
    // the newest rows (where data problems appear) sit at either end.
    const step = Math.max(1, Math.floor(inSection.length / SAMPLE));
    for (let i = 0; i < inSection.length && picked.length < SAMPLE * SECTIONS.length; i += step) {
      if (inSection.slice(i, i + step).length) picked.push(inSection[i]);
      if (picked.filter((u) => new URL(u).pathname.startsWith(section)).length >= SAMPLE) break;
    }
  }
  return picked.map((u) => u.replace(/^https?:\/\/[^/]+/, BASE));
}

async function checkUrl(url) {
  let page;
  try { page = await get(url); } catch (e) { return { url, fetchError: e.message, products: 0, problems: [] }; }
  if (page.status !== 200) return { url, fetchError: `HTTP ${page.status}`, products: 0, problems: [] };
  return { url, ...checkPageMarkup(page.text) };
}

async function main() {
  const targets = urls.length ? urls : await sampleSitemap();
  if (!targets.length) { console.error('No URLs to check (empty sitemap sample).'); process.exit(2); }
  const results = [];
  // Modest concurrency: the prerender hits Supabase per page.
  const queue = [...targets];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) results.push(await checkUrl(queue.shift()));
  }));
  results.sort((a, b) => targets.indexOf(a.url) - targets.indexOf(b.url));

  const failed = results.filter((r) => r.fetchError || r.problems.length);
  const lines = [];
  for (const r of results) {
    const mark = r.fetchError || r.problems.length ? '✗' : r.products ? '✓' : '·';
    lines.push(`${mark} ${r.url}  ${r.fetchError ? `fetch failed: ${r.fetchError}` : `${r.products} Product node(s)`}`);
    r.problems.forEach((p) => lines.push(`    - ${p}`));
  }
  console.log(lines.join('\n'));
  console.log(`\n${results.length} page(s) checked, ${results.reduce((n, r) => n + r.products, 0)} Product node(s), ${failed.length} page(s) with problems.`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Merchant listings identifiers\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`);
  }
  if (process.env.GITHUB_OUTPUT && failed.length) {
    const { appendFileSync } = await import('node:fs');
    const body = failed.map((r) => `- ${r.url}${r.fetchError ? ` — fetch failed: ${r.fetchError}` : ''}${r.problems.map((p) => `\n  - ${p}`).join('')}`).join('\n');
    appendFileSync(process.env.GITHUB_OUTPUT, `failures<<FAIL_EOF\n${body}\nFAIL_EOF\n`);
  }
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e.message || e); process.exit(2); });
