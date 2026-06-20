// Responsive / horizontal-overflow audit for key public pages.
// Renders each page at mobile/tablet/desktop widths, asserts the document has
// no horizontal overflow (scrollWidth === clientWidth), reports any offending
// elements and CSP console errors, and writes mobile screenshots to /tmp.
//
// Prerequisites (not project deps — install on demand):
//   npm install --no-save playwright@1.56.1
//   npx playwright install chromium
// Then, with the production preview running (npx vite preview --outDir dist
//   --host 127.0.0.1 --port 3000):
//   node tools/responsive-check.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const OUT = '/tmp/responsive-shots';
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['home', '/'],
  ['marketplace', '/marketplace'],
  ['shop', '/shop'],
  ['markets', '/analytics'],
  ['grading', '/grading'],
  ['community', '/community'],
  ['blog', '/blog'],
  ['events', '/community/events'],
  ['about', '/about'],
  ['login', '/login'],
];

const VIEWPORTS = [
  ['mobile', 390, 844],
  ['tablet', 768, 1024],
  ['desktop', 1280, 800],
];

const browser = await chromium.launch();
const results = [];

for (const [name, path] of PAGES) {
  for (const [vp, w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1200);
      // Real horizontal overflow at the document level
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        const scrollW = de.scrollWidth;
        const clientW = de.clientWidth;
        const culprits = [];
        if (scrollW > clientW + 1) {
          for (const el of document.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.right > clientW + 1 && r.width > 0 && r.left >= 0) {
              culprits.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className && el.className.toString().slice(0, 60)) || '',
                right: Math.round(r.right),
              });
            }
          }
        }
        return { scrollW, clientW, overflow: scrollW - clientW, culprits: culprits.slice(0, 5) };
      });
      if (vp === 'mobile') {
        await page.screenshot({ path: `${OUT}/${name}-${vp}.png`, fullPage: false });
      }
      const cssErrors = errors.filter(e => /Content-Security-Policy|Refused to/i.test(e));
      results.push({ name, path, vp, w, ...overflow, cspErrors: cssErrors.length });
    } catch (e) {
      results.push({ name, path, vp, w, error: e.message.split('\n')[0] });
    }
    await ctx.close();
  }
}

await browser.close();

console.log('\n=== RESPONSIVE / OVERFLOW REPORT ===\n');
for (const r of results) {
  if (r.error) { console.log(`❌ ${r.name} [${r.vp}] ERROR: ${r.error}`); continue; }
  const flag = r.overflow > 1 ? `⚠️ OVERFLOW +${r.overflow}px` : '✓';
  const csp = r.cspErrors ? ` 🔒CSP:${r.cspErrors}` : '';
  console.log(`${flag.padEnd(18)} ${r.name.padEnd(13)} [${r.vp.padEnd(7)}] doc=${r.scrollW}/${r.clientW}${csp}`);
  if (r.culprits && r.culprits.length) {
    for (const c of r.culprits) console.log(`        ↳ <${c.tag} class="${c.cls}"> right=${c.right}`);
  }
}
console.log('\nScreenshots (mobile):', OUT);
