#!/usr/bin/env node
// Regenerates data/sitemapPageDates.js — the <lastmod> of each static sitemap
// page, from the day its source files (data/sitemapPageSources.js) last
// changed. Run it (`npm run sitemap:dates`) after editing a listed page; the
// test suite fails until you do. `--check` only reports, exit 1 when stale.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATIC_PAGE_SOURCES } from '../data/sitemapPageSources.js';
import { ROOT, computeDates, renderDatesFile } from '../tools/sitemapPageDates.mjs';

const target = join(ROOT, 'data/sitemapPageDates.js');
let previous = {};
try {
  ({ STATIC_PAGE_DATES: previous } = await import('../data/sitemapPageDates.js'));
} catch { /* first run */ }

const next = computeDates(STATIC_PAGE_SOURCES, previous);
const changed = Object.keys(next).filter((key) => previous[key]?.hash !== next[key].hash);
const removed = Object.keys(previous).filter((key) => !next[key]);

if (process.argv.includes('--check')) {
  if (changed.length || removed.length) {
    console.error(`Stale sitemap dates: ${[...changed, ...removed].join(', ')}\nRun: npm run sitemap:dates`);
    process.exit(1);
  }
  console.log('Sitemap page dates are up to date.');
} else {
  writeFileSync(target, renderDatesFile(next));
  console.log(changed.length || removed.length
    ? `Updated ${changed.length} page date(s): ${changed.map((k) => `${k} → ${next[k].lastmod}`).join(', ')}`
    : 'Sitemap page dates already up to date.');
}
