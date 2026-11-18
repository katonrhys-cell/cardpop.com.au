// The daily site check: is what crawlers are served still whole?
//
//   1. the sitemap — well formed, no section emptied, canonical URLs, sane
//      dates, nothing robots.txt blocks (src/utils/sitemapCheck.js);
//   2. a sample of the pages it lists — each must reach the prerender through
//      the bot rewrites in vercel.json and answer 200, indexable and
//      self-canonical;
//   3. the Product markup on the sampled product pages — every Product carries
//      a global identifier (src/utils/merchantListingsCheck.js).
//
// It runs IN PROCESS: the sitemap and prerender handlers are called directly
// and the routing manifest is read from disk, so no request crosses Cloudflare.
// The same checks used to run on a GitHub runner against the public site, and
// Cloudflare's Bot Fight Mode (which the Free plan cannot exempt a caller from)
// answered every one of those runs with a 403 from 2026-10-06 to 2026-11-18 —
// the check never once read a page, and the issue it filed was a false alarm.
// scripts/check-sitemap.mjs and scripts/check-merchant-listings.mjs remain for
// a by-hand run from a machine Cloudflare lets through.
//
// What this cannot see is the edge itself (a Cloudflare rule, a cache, DNS).
// Search Console's own reports cover that side.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSitemap, checkRobots, checkListedPage, samplePaths } from './sitemapCheck.js';
import { checkPageMarkup } from './merchantListingsCheck.js';
import { compileRouting, resolveRewrite } from '../../server/vercelRoutes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SITE = 'https://cardpop.com.au';
// A user-agent the bot rewrites match (they key on "bot").
export const CHECK_USER_AGENT = 'CardPopSiteCheckBot/1.0 (+https://cardpop.com.au/; in-process site check)';
// Sections whose pages carry Product markup: sampled more deeply, and their
// markup is checked for identifiers.
export const PRODUCT_SECTIONS = ['/marketplace/', '/shop/', '/prices/', '/dealer/'];
export const DEFAULT_SAMPLE = 3;
export const DEFAULT_PRODUCT_SAMPLE = 8;
const CONCURRENCY = 4;
const PRERENDER = '/api/prerender';

// Calls a Vercel-style (req, res) handler and captures what it answered.
export async function invokeHandler(handler, { query = {}, url = '/', headers = {} } = {}) {
  const out = { status: 200, headers: {}, body: '' };
  const res = {
    setHeader(name, value) { out.headers[String(name).toLowerCase()] = value; return this; },
    getHeader(name) { return out.headers[String(name).toLowerCase()]; },
    status(code) { out.status = code; return this; },
    writeHead(code, extra) {
      out.status = code;
      for (const [k, v] of Object.entries(extra || {})) out.headers[k.toLowerCase()] = v;
      return this;
    },
    redirect(code, location) { out.status = code; out.headers.location = location; return this; },
    json(payload) { out.body = JSON.stringify(payload); return this; },
    send(payload) { out.body = payload == null ? '' : String(payload); return this; },
    end(payload) { if (payload != null) out.body = String(payload); return this; },
  };
  await handler({ method: 'GET', url, query, headers }, res);
  return out;
}

// More of the product sections, a few of everything else.
export function pickPaths(paths, options = {}) {
  const sample = options.sample ?? DEFAULT_SAMPLE;
  const productSample = options.productSample ?? DEFAULT_PRODUCT_SAMPLE;
  const isProduct = (p) => PRODUCT_SECTIONS.some((s) => p.startsWith(s));
  return [...new Set([
    ...samplePaths(paths.filter((p) => !isProduct(p)), sample),
    ...samplePaths(paths.filter(isProduct), productSample, []),
  ])];
}

async function defaultDeps() {
  const [{ default: sitemap }, { default: prerender }] = await Promise.all([
    import('../../api/sitemap.js'),
    import('../../api/prerender.js'),
  ]);
  return {
    sitemap,
    prerender,
    readText: (file) => readFile(path.join(ROOT, file), 'utf8'),
  };
}

/**
 * @returns {{ ok: boolean, problems: string[], urls: number, pages: number, products: number }}
 */
export async function runSiteCheck(options = {}, deps) {
  const { sitemap, prerender, readText } = { ...(deps ? {} : await defaultDeps()), ...deps };
  const problems = [];

  // 1. The sitemap file.
  let xml = '';
  try {
    const answer = await invokeHandler(sitemap, { url: '/sitemap.xml' });
    if (answer.status !== 200) problems.push(`sitemap.xml answered HTTP ${answer.status}`);
    else xml = answer.body;
  } catch (err) {
    problems.push(`sitemap.xml could not be generated: ${err.message}`);
  }
  const { urls, paths, problems: fileProblems } = checkSitemap(xml, { base: SITE });
  if (xml) problems.push(...fileProblems);

  try {
    problems.push(...checkRobots(await readText('public/robots.txt'), paths, { base: SITE }));
  } catch (err) {
    problems.push(`robots.txt could not be read by the check (${err.code || err.message}) — is it in the function's includeFiles?`);
  }

  // 2 + 3. A sample of the listed pages, as a crawler is served them.
  let routing = null;
  try {
    routing = compileRouting(JSON.parse(await readText('vercel.json')));
  } catch (err) {
    problems.push(`vercel.json could not be read by the check (${err.code || err.message}) — is it in the function's includeFiles?`);
  }

  const targets = routing ? pickPaths(paths, options) : [];
  let products = 0;
  const queue = [...targets];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const pagePath = queue.shift();
      const loc = `${SITE}${pagePath}`;
      const headers = { 'user-agent': CHECK_USER_AGENT };
      try {
        const route = resolveRewrite(
          routing,
          { pathname: pagePath, host: 'cardpop.com.au', headers, query: {}, cookies: {} },
          { isTerminal: (p) => p.startsWith('/api/') },
        );
        if (route.pathname !== PRERENDER) {
          problems.push(`${loc} is in the sitemap but no bot rewrite sends it to the prerender (crawlers get the empty app shell)`);
          continue;
        }
        const page = await invokeHandler(prerender, { url: pagePath, query: route.query, headers });
        if (page.status >= 300 && page.status < 400) {
          problems.push(`${loc} is in the sitemap but redirects (HTTP ${page.status}) to ${page.headers.location || '?'}`);
          continue;
        }
        if (page.status !== 200) {
          problems.push(`${loc} is in the sitemap but answers HTTP ${page.status}`);
          continue;
        }
        for (const found of checkListedPage(page.body, loc, { xRobotsTag: String(page.headers['x-robots-tag'] || '') })) {
          problems.push(`${loc} is in the sitemap but ${found}`);
        }
        if (PRODUCT_SECTIONS.some((s) => pagePath.startsWith(s))) {
          const markup = checkPageMarkup(page.body);
          products += markup.products;
          for (const found of markup.problems) problems.push(`${loc} Product markup — ${found}`);
        }
      } catch (err) {
        problems.push(`${loc} could not be rendered: ${err.message}`);
      }
    }
  }));

  return { ok: problems.length === 0, problems: problems.sort(), urls: urls.length, pages: targets.length, products };
}
