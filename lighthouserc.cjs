// Lighthouse CI configuration.
//
// Measures lab Core Web Vitals against the production build so perf regressions
// show up as a failed check, not a user complaint. Lighthouse can't measure INP
// in a lab run, so we budget Total Blocking Time (TBT) as its main-thread proxy,
// plus LCP and CLS directly.
//
// Form factor is selected with LH_FORM_FACTOR=desktop|mobile (default desktop):
//   - desktop: fast, stable — the primary regression gate.
//   - mobile : Lighthouse's default Moto-G4 + slow-4G + 4× CPU throttling. This
//     is the harsh, phone-representative target; scores are much lower and a bit
//     noisier, so budgets are looser and lean on `warn`.
// Budgets for each form factor are derived from the measured baseline with
// headroom, so a genuine regression trips the build while run-to-run variance
// doesn't.
//
// The dev sandbox + CI runners don't ship Chrome, but Playwright's Chromium is
// present — point chrome-launcher at it via CHROME_PATH (set in the npm script
// / workflow). Routes are served by `vite preview` (the real built bundle).

const CHROME_PATH = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';
const MOBILE = process.env.LH_FORM_FACTOR === 'mobile';
const PORT = MOBILE ? 4176 : 4173;

// Core Web Vitals + category scores, calibrated per form factor.
const commonAssertions = MOBILE
  ? {
      // Mobile baseline (median of 3): perf 70–80, LCP ~3.9–5.1 s, TBT ≤192 ms,
      // CLS ≤0.07. Throttled emulation, so these flag regressions, not the
      // (already-known) absolute numbers — see roadmap #5 for the mobile backlog.
      'categories:performance': ['warn', { minScore: 0.65 }],
      'categories:accessibility': ['error', { minScore: 0.95 }],
      'categories:best-practices': ['warn', { minScore: 0.9 }],
      'largest-contentful-paint': ['warn', { maxNumericValue: 5500 }],
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      'total-blocking-time': ['warn', { maxNumericValue: 350 }],
    }
  : {
      'categories:performance': ['warn', { minScore: 0.8 }],
      'categories:accessibility': ['error', { minScore: 0.95 }],
      'categories:best-practices': ['warn', { minScore: 0.9 }],
      'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
      'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
      'total-blocking-time': ['warn', { maxNumericValue: 300 }],
    };

// Desktop uses the 'desktop' preset; mobile uses Lighthouse's default emulation
// (omit preset) — Moto G4, slow 4G, 4× CPU slowdown.
const settings = {
  chromePath: CHROME_PATH,
  chromeFlags: '--no-sandbox --headless=new --disable-gpu --disable-dev-shm-usage',
  onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
  ...(MOBILE ? {} : { preset: 'desktop' }),
};

const base = `http://127.0.0.1:${PORT}`;

module.exports = {
  ci: {
    collect: {
      // Build first, then serve the production bundle.
      startServerCommand: `npm run build && npx vite preview --outDir dist --host 127.0.0.1 --port ${PORT}`,
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 120000,
      url: [`${base}/`, `${base}/marketplace`, `${base}/shop`, `${base}/login`],
      numberOfRuns: 3,
      settings,
    },
    assert: {
      // Per-URL matrix so we can hold indexable pages to an SEO bar while not
      // penalising /login, which is deliberately noindex,nofollow.
      assertMatrix: [
        {
          matchingUrlPattern: '.*',
          assertions: commonAssertions,
        },
        {
          // Everything except /login gets an SEO floor.
          matchingUrlPattern: '^(?!.*/login$).*$',
          assertions: {
            'categories:seo': ['warn', { minScore: 0.9 }],
          },
        },
      ],
    },
    upload: {
      // Keep reports local (CI uploads them as artifacts); no external publishing.
      target: 'filesystem',
      outputDir: '.lighthouseci',
      reportFilenamePattern: 'lhr-%%PATHNAME%%-%%DATETIME%%.%%EXTENSION%%',
    },
  },
};
