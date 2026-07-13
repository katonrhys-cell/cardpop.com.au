// Renders the CardPop "Basketball Card Collecting Bible" free guide to a
// designed, print-ready PDF (branded hero cover + magazine-style interior).
//
// Usage:  node scripts/guide-pdf/render-guide.mjs [outputPath]
// Inputs: scripts/guide-pdf/bible-content.html  (article body)
//         scripts/guide-pdf/hero.png            (cover artwork)
// Output: src/emails/assets/launch-welcome.pdf  (default)
//
// Chromium: uses the repo's Playwright when a matching browser is installed,
// otherwise falls back to the sandbox's pre-installed build via CHROME_PATH.
import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..', '..');
const CHROME = process.env.CHROME_PATH || undefined; // undefined → Playwright default

const OUT = process.argv[2] || join(REPO, 'src', 'emails', 'assets', 'launch-welcome.pdf');
const HERO = join(__dirname, 'hero.png');

let body = await readFile(join(__dirname, 'bible-content.html'), 'utf8');

// ---- Designed interior components injected at markers in the body ----
const STATBAND = `<div class="statband">
  <div class="stat"><span class="n">$6.9B</span><span class="l">Global trading-card market (2024)</span></div>
  <div class="stat"><span class="n">3%</span><span class="l">CardPop fee vs eBay&rsquo;s 13.4%</span></div>
  <div class="stat"><span class="n">4&ndash;10&times;</span><span class="l">PSA&nbsp;10 vs PSA&nbsp;9, top rookies</span></div>
  <div class="stat"><span class="n">2&ndash;5%</span><span class="l">Modern cards that hit PSA&nbsp;10</span></div>
</div>`;

const SPECTRUM = `<div class="spectrum">
  <div class="spec-track">
    <div class="chip" style="--c:#8b8f96"><span class="sw"></span><b>Silver</b><i>base</i></div>
    <div class="chip" style="--c:#2563eb"><span class="sw"></span><b>Blue</b><i>/199</i></div>
    <div class="chip" style="--c:#16a34a"><span class="sw"></span><b>Green</b><i>/99</i></div>
    <div class="chip" style="--c:#dc2626"><span class="sw"></span><b>Red</b><i>/25</i></div>
    <div class="chip" style="--c:#d4a017"><span class="sw"></span><b>Gold</b><i>/10</i></div>
    <div class="chip" style="--c:#0f766e"><span class="sw"></span><b>Green Gold</b><i>/5</i></div>
    <div class="chip" style="--c:#1c1c1e"><span class="sw"></span><b>Gold Vinyl</b><i>1/1</i></div>
  </div>
  <div class="spec-arrow"><span>Print run shrinks</span><span>Scarcity &amp; value rise &nbsp;&rarr;</span></div>
</div>`;

const GRADES = `<div class="grades">
  <div class="gr"><span class="gbadge" style="--g:#15803d">10</span><div><b>Gem Mint</b><span>Virtually perfect &mdash; four razor-sharp corners, centred, no surface defects. Only 2&ndash;5% of modern cards.</span></div></div>
  <div class="gr"><span class="gbadge" style="--g:#0d9488">9</span><div><b>Mint</b><span>Perfect to the naked eye, maybe one tiny flaw. The grade most Australian collectors target.</span></div></div>
  <div class="gr"><span class="gbadge" style="--g:#2563eb">8</span><div><b>NM&ndash;MT</b><span>Very slight corner fraying or off-centering. Looks like a 9 at a glance.</span></div></div>
  <div class="gr"><span class="gbadge" style="--g:#7c3aed">7</span><div><b>Near Mint</b><span>Light surface wear. Often sells at or below raw value after grading fees.</span></div></div>
  <div class="gr"><span class="gbadge" style="--g:#64748b">1&ndash;6</span><div><b>EX &ndash; Poor</b><span>Increasing wear and damage. Primarily relevant for valuable vintage cards.</span></div></div>
</div>`;

body = body.replace('<!--STATBAND-->', STATBAND)
           .replace('<!--SPECTRUM-->', SPECTRUM)
           .replace('<!--GRADES-->', GRADES);

// Number the H2 sections for a designed, guide-like feel.
let n = 0;
body = body.replace(/<h2 id="([^"]+)">/g, (_, id) => {
  n += 1;
  return `<h2 id="${id}"><span class="hn">${String(n).padStart(2, '0')}</span>`;
});

const css = `
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #23262d; font-size: 10.3pt; line-height: 1.62;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* ---------- COVER ---------- */
  .cover { position: relative; height: 261mm; margin: -16mm -15mm 0; background: #0a0f1c;
    display: flex; flex-direction: column; align-items: center; page-break-after: always; overflow: hidden; }
  .cover-top { padding: 20pt 0 14pt; }
  .cover .badge { font-size: 8pt; font-weight: 800; letter-spacing: 3pt; text-transform: uppercase; color: #fff;
    border: 1pt solid #E63946; background: #E63946; border-radius: 40pt; padding: 6pt 16pt; }
  .cover .hero-wrap { flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; padding: 0 16pt; }
  .cover .hero { width: 100%; max-width: 168mm; border-radius: 6pt; box-shadow: 0 10pt 40pt rgba(0,0,0,.5); }
  .cover .cover-foot { width: 100%; text-align: center; padding: 13pt 0 16pt; color: rgba(255,255,255,.62);
    font-size: 8pt; letter-spacing: 2pt; text-transform: uppercase; }
  .cover .cover-foot b { color: #fff; }

  /* ---------- HEADINGS ---------- */
  h2 { font-size: 15.5pt; font-weight: 800; color: #0a0f1c; letter-spacing: -.3pt; margin: 24pt 0 9pt;
    padding-bottom: 6pt; border-bottom: 2pt solid #E63946; page-break-after: avoid; display: flex; align-items: baseline; gap: 9pt; }
  h2 .hn { font-size: 10pt; font-weight: 800; color: #E63946; letter-spacing: 0; font-variant-numeric: tabular-nums; }
  h3 { font-size: 11.5pt; font-weight: 800; color: #1c1c1e; margin: 15pt 0 5pt; page-break-after: avoid; }
  p { margin: 0 0 9pt; }
  a { color: #E63946; text-decoration: none; }
  strong { color: #0a0f1c; font-weight: 700; }
  .muted { color: #6b7280; font-weight: 400; }
  .fineprint { font-size: 8pt; color: #9aa1ac; margin-top: -3pt; }

  ul, ol { margin: 0 0 10pt; padding-left: 18pt; }
  li { margin-bottom: 5pt; }

  .section-label { display: inline-block; font-size: 7.5pt; font-weight: 800; letter-spacing: 2pt;
    text-transform: uppercase; color: #E63946; margin-bottom: 6pt; }

  /* ---------- SUMMARY / TAKEAWAYS ---------- */
  .article-summary, .article-takeaways { border: .75pt solid #e6e8ec; border-radius: 8pt; padding: 13pt 16pt;
    margin: 0 0 12pt; background: #f7f8fa; page-break-inside: avoid; }
  .article-summary { border-left: 3pt solid #E63946; }
  .article-takeaways { border-left: 3pt solid #0a0f1c; }
  .article-takeaways ul { margin-bottom: 0; }

  /* ---------- STAT BAND ---------- */
  .statband { display: flex; gap: 8pt; margin: 6pt 0 16pt; page-break-inside: avoid; }
  .statband .stat { flex: 1; background: #0a0f1c; color: #fff; border-radius: 8pt; padding: 12pt 10pt; text-align: center; }
  .statband .n { display: block; font-size: 18pt; font-weight: 800; letter-spacing: -.5pt; color: #fff; }
  .statband .l { display: block; font-size: 7.2pt; line-height: 1.35; color: rgba(255,255,255,.66); margin-top: 4pt; }

  /* ---------- CALLOUTS ---------- */
  .callout { position: relative; display: flex; gap: 11pt; border-radius: 8pt; padding: 12pt 15pt; margin: 13pt 0;
    background: #f7f8fa; border: .75pt solid #e6e8ec; border-left: 3pt solid #94a3b8; page-break-inside: avoid; }
  .callout .callout-ic { font-size: 14pt; line-height: 1.1; }
  .callout-rule { background: #eef4ff; border-left-color: #2563eb; }
  .callout-tip { background: #f0fbf4; border-left-color: #16a34a; }
  .callout-warn { background: #fff5f5; border-left-color: #E63946; }
  .callout-take { background: #f7f8fa; border-left-color: #0a0f1c; }
  .callout-take ol { margin: 6pt 0 0; }
  .callout-impact { display: block; background: #fff7f7; border-left: 3pt solid #E63946; }
  .callout-impact p:last-child { margin-bottom: 0; }

  /* ---------- TABLES ---------- */
  table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 9pt; page-break-inside: avoid; }
  th { background: #0a0f1c; color: #fff; text-align: left; padding: 8pt 9pt; font-size: 8pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: .5pt; }
  td { border-bottom: .5pt solid #e6e8ec; padding: 7pt 9pt; vertical-align: top; color: #3a3f48; }
  tr:nth-child(even) td { background: #f7f8fa; }
  td .mid { color: #0d9488; } td.mid { color: #0d9488; font-weight: 600; }
  td.hi { color: #15803d; font-weight: 800; }
  .glossary td:first-child { width: 58pt; }
  .term { font-weight: 800; color: #0a0f1c; background: #eef1f5; border-radius: 4pt; padding: 2pt 6pt; font-size: 8.5pt; }

  /* ---------- PARALLEL SPECTRUM ---------- */
  .spectrum { margin: 6pt 0 14pt; page-break-inside: avoid; }
  .spec-track { display: flex; gap: 6pt; }
  .spec-track .chip { flex: 1; border: .75pt solid #e6e8ec; border-top: 3pt solid var(--c); border-radius: 7pt;
    padding: 9pt 4pt 8pt; text-align: center; background: #fff; }
  .spec-track .chip .sw { display: block; width: 16pt; height: 16pt; border-radius: 50%; background: var(--c);
    margin: 0 auto 6pt; box-shadow: 0 1pt 3pt rgba(0,0,0,.2); }
  .spec-track .chip b { display: block; font-size: 8pt; color: #0a0f1c; }
  .spec-track .chip i { display: block; font-style: normal; font-size: 8.5pt; font-weight: 800; color: var(--c); margin-top: 2pt; font-variant-numeric: tabular-nums; }
  .spec-arrow { display: flex; justify-content: space-between; margin-top: 7pt; font-size: 7.5pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1pt; color: #9aa1ac;
    background: linear-gradient(90deg,#8b8f9622,#1c1c1e22); border-radius: 20pt; padding: 5pt 12pt; }

  /* ---------- GRADE SCALE ---------- */
  .grades { margin: 6pt 0 14pt; page-break-inside: avoid; }
  .grades .gr { display: flex; align-items: center; gap: 12pt; padding: 8pt 0; border-bottom: .5pt solid #eceef2; }
  .grades .gr:last-child { border-bottom: 0; }
  .grades .gbadge { flex: 0 0 auto; width: 34pt; height: 34pt; border-radius: 7pt; background: var(--g); color: #fff;
    font-weight: 800; font-size: 13pt; display: flex; align-items: center; justify-content: center; letter-spacing: -.5pt; }
  .grades .gr b { color: #0a0f1c; font-size: 10pt; margin-right: 8pt; }
  .grades .gr span { color: #4a505a; font-size: 9pt; }
  .grades .gr div { line-height: 1.4; }

  /* ---------- MISTAKES ---------- */
  .mistakes { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; margin: 6pt 0 14pt; }
  .mistakes .mistake { display: flex; gap: 9pt; border: .75pt solid #f1d5d5; background: #fffafa; border-radius: 7pt; padding: 10pt 12pt; page-break-inside: avoid; }
  .mistakes .x { color: #E63946; font-weight: 800; font-size: 10pt; line-height: 1.3; }
  .mistakes .mistake div { font-size: 9pt; line-height: 1.5; }

  /* ---------- FAQ ---------- */
  .faq { border: .75pt solid #e6e8ec; border-radius: 8pt; padding: 11pt 14pt; margin: 8pt 0; page-break-inside: avoid; background: #fff; }
  .faq .q { font-weight: 800; color: #0a0f1c; margin: 0 0 5pt; font-size: 9.8pt; }
  .faq .a { margin: 0; font-size: 9.3pt; color: #3a3f48; }

  .sources { border-top: 1.5pt solid #0a0f1c; margin-top: 22pt; padding-top: 12pt; }
  .sources ol { font-size: 8.6pt; color: #6b7280; }

  /* ---------- BACK COVER ---------- */
  .backcover { margin: 0 -15mm -18mm; background: #0a0f1c; color: #fff; min-height: 232mm; padding: 60pt 40pt;
    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-before: always; }
  .backcover .bc-badge { font-size: 8pt; font-weight: 800; letter-spacing: 3pt; text-transform: uppercase; color: #E63946; margin-bottom: 18pt; }
  .backcover h2 { color: #fff; border: 0; font-size: 26pt; margin: 0 0 14pt; display: block; letter-spacing: -.5pt; }
  .backcover p { color: rgba(255,255,255,.72); max-width: 360pt; font-size: 11pt; line-height: 1.65; }
  .backcover .bc-cta { margin: 24pt 0 8pt; font-size: 15pt; font-weight: 800; color: #fff; background: #E63946; border-radius: 8pt; padding: 12pt 30pt; letter-spacing: .3pt; }
  .backcover .bc-tag { margin-top: 26pt; font-size: 7.5pt; letter-spacing: 2.5pt; text-transform: uppercase; color: rgba(255,255,255,.45); }

  img { display: none; }              /* hide any stray inline article images */
  .cover .hero { display: block; }    /* except the cover artwork */
`;

const backCover = `<section class="backcover">
  <div class="bc-badge">Your Pro-level early access is reserved</div>
  <h2>Ready to start your collection?</h2>
  <p>CardPop is Australia&rsquo;s dedicated trading card marketplace &mdash; a 3% fee versus eBay&rsquo;s 13.4%, no international shipping, and built for local collectors. You&rsquo;re on the early-access list; we&rsquo;ll email you the moment we go live.</p>
  <div class="bc-cta">cardpop.com.au</div>
  <p class="bc-tag">The Parallel Report &middot; CardPop Research</p>
</section>`;

// Recompress the hero to a lean JPEG data URI so the PDF stays email-friendly.
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();

const heroB64 = (await readFile(HERO)).toString('base64');
await page.setContent(`<img id="h" src="data:image/png;base64,${heroB64}">`);
await page.waitForLoadState('networkidle');
const heroJpeg = await page.evaluate(() => {
  const img = document.getElementById('h');
  const targetW = 1400;
  const scale = Math.min(1, targetW / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.86);
});

const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><style>${css}</style></head>
<body>
  <section class="cover">
    <div class="cover-top"><span class="badge">Free Collector's Guide</span></div>
    <div class="hero-wrap"><img class="hero" src="${heroJpeg}"></div>
    <div class="cover-foot"><b>CardPop</b> &nbsp;&middot;&nbsp; Australia's Card Marketplace &nbsp;&middot;&nbsp; cardpop.com.au</div>
  </section>
  <main>${body}${backCover}</main>
</body></html>`;

await writeFile(join(__dirname, 'guide-preview.html'), html);

await page.setContent(html, { waitUntil: 'networkidle' });
const pdf = await page.pdf({
  format: 'A4', printBackground: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7pt;color:#9aa1ac;padding:0 15mm;display:flex;justify-content:space-between;">
    <span>The Basketball Card Collecting Bible &middot; 2026 Edition</span>
    <span>cardpop.com.au &middot; <span class="pageNumber"></span></span></div>`,
  margin: { top: '16mm', bottom: '18mm', left: '15mm', right: '15mm' },
});
await browser.close();
await writeFile(OUT, pdf);
console.log('PDF written:', OUT, '—', (pdf.length / 1024).toFixed(0), 'KB');
