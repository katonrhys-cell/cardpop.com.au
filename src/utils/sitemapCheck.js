// Pure checks behind scripts/check-sitemap.mjs — the weekly live check of
// /sitemap.xml. Dependency-free and unit-tested (tests/backend/sitemapCheck.test.js)
// so the workflow runs the script without `npm ci`.
//
// The unit tests on api/sitemap.js prove the code; these catch what only the
// live site can show: a section that silently dropped to nothing because its
// query failed, a slug that broke the XML, a robots.txt rule that blocks a
// listed page, a listed page that answers noindex or names another canonical.

// Sections that must never be empty on the live site, by path prefix. The
// marketplace, players and seller sections are left out on purpose: they can
// honestly be empty.
export const REQUIRED_SECTIONS = ['/events/', '/shop/', '/blog/', '/prices/', '/card-shops/'];
// Core pages that must always be listed.
export const REQUIRED_PAGES = ['/', '/shop', '/marketplace', '/events', '/blog', '/prices', '/terms'];
// The live sitemap held ~600 URLs when this was written; well under that means
// several sections went missing at once.
export const MIN_URLS = 200;

const unescapeXml = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

const count = (text, needle) => text.split(needle).length - 1;

// → { urls: [{ loc, lastmod }], problems: [string] } — structure only.
export function parseSitemap(xml) {
  const problems = [];
  const text = String(xml || '');
  if (!/^\s*<\?xml\b/.test(text)) problems.push('does not start with an <?xml …?> declaration');
  if (!/<urlset\b[^>]*xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(text)) problems.push('has no <urlset> with the sitemap namespace');
  if (!/<\/urlset>\s*$/.test(text)) problems.push('does not end with </urlset> (truncated?)');
  for (const tag of ['url', 'loc', 'lastmod', 'image:image', 'video:video']) {
    const open = count(text, `<${tag}>`);
    const close = count(text, `</${tag}>`);
    if (open !== close) problems.push(`has ${open} <${tag}> but ${close} </${tag}>`);
  }
  // A bare & (or a stray <) inside a value makes Google reject the whole file.
  // (Comments may hold one legally — the section headings do.)
  const bareAmp = text.replace(/<!--[\s\S]*?-->/g, '').match(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)[^<]{0,40}/);
  if (bareAmp) problems.push(`has an unescaped & near "${bareAmp[0].slice(0, 40)}"`);

  const urls = [];
  for (const block of text.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = block[1].match(/<loc>([^<]*)<\/loc>/);
    const lastmod = block[1].match(/<lastmod>([^<]*)<\/lastmod>/);
    urls.push({ loc: loc ? unescapeXml(loc[1].trim()) : '', lastmod: lastmod ? lastmod[1].trim() : '' });
  }
  return { urls, problems };
}

// Every problem with the sitemap's contents, as plain sentences.
export function checkSitemap(xml, {
  base = 'https://cardpop.com.au',
  today = new Date().toISOString().slice(0, 10),
  minUrls = MIN_URLS,
  requiredSections = REQUIRED_SECTIONS,
  requiredPages = REQUIRED_PAGES,
} = {}) {
  const { urls, problems } = parseSitemap(xml);
  const out = problems.map((p) => `sitemap.xml ${p}`);
  if (urls.length < minUrls) out.push(`sitemap.xml lists ${urls.length} URLs — fewer than the floor of ${minUrls}`);
  if (urls.length > 50000) out.push(`sitemap.xml lists ${urls.length} URLs — over the 50,000 limit; split it into a sitemap index`);

  const seen = new Set();
  const paths = [];
  // One day of slack: the server stamps UTC dates and the runner's clock may differ.
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  for (const { loc, lastmod } of urls) {
    if (!loc) { out.push('a <url> has no <loc>'); continue; }
    if (seen.has(loc)) out.push(`${loc} is listed twice`);
    seen.add(loc);
    if (!loc.startsWith(`${base}/`)) { out.push(`${loc} is not on ${base}`); continue; }
    const path = loc.slice(base.length);
    paths.push(path);
    if (/[?#\s]/.test(path)) out.push(`${loc} carries a query string, fragment or space`);
    if (path.length > 1 && path.endsWith('/')) out.push(`${loc} ends with a slash (the canonical has none)`);
    if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2}))?$/.test(lastmod) || Number.isNaN(Date.parse(lastmod))) {
      out.push(`${loc} has an invalid lastmod "${lastmod}"`);
    } else if (lastmod.slice(0, 10) > tomorrow) {
      out.push(`${loc} has a lastmod in the future (${lastmod})`);
    }
  }
  for (const page of requiredPages) {
    if (!paths.includes(page)) out.push(`${base}${page} is missing from the sitemap`);
  }
  for (const section of requiredSections) {
    if (!paths.some((p) => p.startsWith(section))) out.push(`no ${section}… pages are listed — that section's query probably failed`);
  }
  return { urls, paths, problems: out };
}

// The rules that apply to every crawler (User-agent: *), longest match wins,
// Allow beating Disallow on a tie — as Google reads them. No wildcards: the
// site's robots.txt uses none in that group.
export function robotsRules(robotsTxt) {
  const rules = [];
  let agents = [];
  let lastWasAgent = false;
  for (const raw of String(robotsTxt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      agents = lastWasAgent ? [...agents, value.toLowerCase()] : [value.toLowerCase()];
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if ((field === 'allow' || field === 'disallow') && agents.includes('*') && value) {
      rules.push({ allow: field === 'allow', path: value });
    }
  }
  return rules;
}

export function robotsAllows(rules, path) {
  let best = null;
  for (const rule of rules) {
    if (!path.startsWith(rule.path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return !best || best.allow;
}

export function checkRobots(robotsTxt, paths, { base = 'https://cardpop.com.au' } = {}) {
  const out = [];
  const sitemapLines = [...String(robotsTxt || '').matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((m) => m[1]);
  if (!sitemapLines.includes(`${base}/sitemap.xml`)) out.push(`robots.txt has no "Sitemap: ${base}/sitemap.xml" line`);
  const rules = robotsRules(robotsTxt);
  const blocked = paths.filter((p) => !robotsAllows(rules, p));
  for (const p of blocked.slice(0, 10)) out.push(`${base}${p} is in the sitemap but disallowed by robots.txt`);
  if (blocked.length > 10) out.push(`…and ${blocked.length - 10} more listed pages are disallowed by robots.txt`);
  return out;
}

// A page the sitemap lists must be indexable and name itself as canonical.
export function checkListedPage(html, loc, { xRobotsTag = '' } = {}) {
  const out = [];
  const text = String(html || '');
  const metas = [...text.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const robotsMeta = metas.filter((tag) => /\bname=["']?(robots|googlebot)["'\s>]/i.test(tag));
  if (robotsMeta.some((tag) => /noindex/i.test(tag)) || /noindex/i.test(xRobotsTag)) out.push('is noindex');
  const links = [...text.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((tag) => /\brel=["']?canonical["'\s>]/i.test(tag));
  const hrefs = links.map((tag) => (tag.match(/\bhref=["']([^"']+)["']/i) || [])[1]).filter(Boolean)
    .map((href) => unescapeXml(href));
  if (hrefs.length === 0) out.push('has no canonical link');
  else if (new Set(hrefs).size > 1) out.push(`has ${hrefs.length} different canonical links`);
  else if (hrefs[0] !== loc) out.push(`names another canonical: ${hrefs[0]}`);
  return out;
}

// An even spread of up to `perSection` paths from each top-level section, the
// required pages always included.
export function samplePaths(paths, perSection = 4, requiredPages = REQUIRED_PAGES) {
  const groups = new Map();
  for (const path of paths) {
    const key = path.split('/')[1] || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(path);
  }
  const picked = new Set(requiredPages.filter((p) => paths.includes(p)));
  for (const list of groups.values()) {
    const step = Math.max(1, Math.floor(list.length / perSection));
    for (let i = 0, n = 0; i < list.length && n < perSection; i += step, n += 1) picked.add(list[i]);
    picked.add(list[list.length - 1]);
  }
  return [...picked];
}
