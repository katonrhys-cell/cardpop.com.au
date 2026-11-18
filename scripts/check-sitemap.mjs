#!/usr/bin/env node
// Live check of /sitemap.xml — is the file Google reads still whole?
//
// tests/backend/sitemap.test.js guards the code. This checks the live answer:
// the XML is well formed and complete, no section has silently emptied (each
// section's query fails on its own, by design, and leaves a valid but shorter
// file), every URL is on the site with a sane lastmod, robots.txt advertises
// the sitemap and blocks nothing in it, and a sample of the listed pages —
// fetched the way a crawler gets them — answers 200, indexable, and names
// itself as canonical.
//
// Dependency-free (the checks live in src/utils/sitemapCheck.js) so the weekly
// workflow runs it without `npm ci`.
//
// Usage:
//   node scripts/check-sitemap.mjs                  # the live site
//   node scripts/check-sitemap.mjs --sample 8       # more pages per section
//   node scripts/check-sitemap.mjs --sample 0       # the file only, no pages
//   node scripts/check-sitemap.mjs --base https://preview.vercel.app
//
// Exit code 0 = clean, 1 = at least one problem, 2 = could not run.

import { checkSitemap, checkRobots, checkListedPage, samplePaths } from '../src/utils/sitemapCheck.js';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
// The sitemap always names the production host; --base only changes where the
// files and pages are fetched from.
const SITE = 'https://cardpop.com.au';
const BASE = flag('--base', SITE).replace(/\/$/, '');
const SAMPLE = Number(flag('--sample', 3));
// Any user-agent containing "bot" is served the prerender — say who we are.
const UA = 'CardPopSitemapBot/1.0 (+https://cardpop.com.au/; sitemap check)';

async function get(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const r = await fetch(`${BASE}${path}`, { headers: { 'user-agent': UA, accept: 'text/html,application/xml,text/plain' }, redirect: 'manual', signal: ctrl.signal });
    return { status: r.status, type: r.headers.get('content-type') || '', xRobotsTag: r.headers.get('x-robots-tag') || '', location: r.headers.get('location') || '', text: await r.text() };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const problems = [];
  const sitemap = await get('/sitemap.xml');
  if (sitemap.status !== 200) {
    problems.push(`sitemap.xml answered HTTP ${sitemap.status}`);
  } else if (!/xml/i.test(sitemap.type)) {
    problems.push(`sitemap.xml is served as "${sitemap.type}", not XML`);
  }
  const { urls, paths, problems: fileProblems } = checkSitemap(sitemap.status === 200 ? sitemap.text : '', { base: SITE });
  if (sitemap.status === 200) problems.push(...fileProblems);

  const robots = await get('/robots.txt');
  if (robots.status !== 200) problems.push(`robots.txt answered HTTP ${robots.status}`);
  else problems.push(...checkRobots(robots.text, paths, { base: SITE }));

  const targets = SAMPLE > 0 ? samplePaths(paths, SAMPLE) : [];
  const pageLines = [];
  const queue = [...targets];
  // Modest concurrency: each prerendered page reads Supabase.
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const path = queue.shift();
      let found;
      try {
        const page = await get(path);
        if (page.status >= 300 && page.status < 400) found = [`redirects (HTTP ${page.status}) to ${page.location}`];
        else if (page.status !== 200) found = [`answers HTTP ${page.status}`];
        // On a preview host Vercel adds its own X-Robots-Tag: noindex.
        else found = checkListedPage(page.text, `${SITE}${path}`, { xRobotsTag: BASE === SITE ? page.xRobotsTag : '' });
      } catch (e) {
        found = [`could not be fetched: ${e.message}`];
      }
      pageLines.push(`${found.length ? '✗' : '✓'} ${path}${found.length ? `  — ${found.join('; ')}` : ''}`);
      for (const f of found) problems.push(`${SITE}${path} is in the sitemap but ${f}`);
    }
  }));
  pageLines.sort();

  const summary = [
    `sitemap.xml: ${urls.length} URLs, ${targets.length} page(s) sampled, ${problems.length} problem(s).`,
    ...problems.map((p) => `✗ ${p}`),
  ];
  console.log(pageLines.join('\n'));
  console.log(`\n${summary.join('\n')}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Live sitemap\n\n\`\`\`\n${summary.join('\n')}\n\`\`\`\n`);
  }
  if (process.env.GITHUB_OUTPUT && problems.length) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `failures<<FAIL_EOF\n${problems.slice(0, 40).map((p) => `- ${p}`).join('\n')}\nFAIL_EOF\n`);
  }
  process.exit(problems.length ? 1 : 0);
}

main().catch((e) => { console.error(e.message || e); process.exit(2); });
