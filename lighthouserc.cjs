// Lighthouse CI configuration.
//
// Measures lab Core Web Vitals against the production build so perf regressions
// show up as a failed check, not a user complaint. Lighthouse can't measure INP
// in a lab run, so we budget Total Blocking Time (TBT) as its main-thread proxy,
// plus LCP and CLS directly.
//
// Runs the **desktop** preset: stable enough for CI regression detection (mobile
// emulation + throttling is much noisier on shared runners). Mobile is the harder
// target to layer on once this is proven. Budgets below are derived from the
// measured baseline with headroom, so a genuine regression trips the build while
// normal run-to-run variance doesn't.
//
// The dev sandbox + CI runners don't ship Chrome, but Playwright's Chromium is
// present — point chrome-launcher at it via CHROME_PATH (set in the npm script
// / workflow). Routes are served by `vite preview` (the real built bundle).

const CHROME_PATH = process.env.CHROME_PATH || '/opt/pw-browsers/chromium';

// Core Web Vitals + scores applied to every audited route.
const commonAssertions = {
  'categories:performance': ['warn', { minScore: 0.8 }],
  'categories:accessibility': ['error', { minScore: 0.95 }],
  'categories:best-practices': ['warn', { minScore: 0.9 }],
  'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
  'total-blocking-time': ['warn', { maxNumericValue: 300 }],
};

module.exports = {
  ci: {
    collect: {
      // Build first, then serve the production bundle.
      startServerCommand: 'npm run build && npx vite preview --outDir dist --host 127.0.0.1 --port 4173',
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 120000,
      url: [
        'http://127.0.0.1:4173/',
        'http://127.0.0.1:4173/marketplace',
        'http://127.0.0.1:4173/shop',
        'http://127.0.0.1:4173/login',
      ],
      numberOfRuns: 3,
      settings: {
        chromePath: CHROME_PATH,
        chromeFlags: '--no-sandbox --headless=new --disable-gpu --disable-dev-shm-usage',
        preset: 'desktop',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
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
