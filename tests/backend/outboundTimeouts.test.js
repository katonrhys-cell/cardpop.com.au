import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OUTBOUND_TIMEOUT_MS } from '../../src/utils/outboundTimeouts.js';

const root = resolve(__dirname, '../..');

// Every backend file that talks to a third party with the global fetch. A
// stalled upstream used to hold the function until Vercel's own 40 s limit:
// a 504 for the caller with no error anywhere, and the whole wait billed.
const FETCH_SITES = [
  'src/api/integrated-ai.js',
  'src/routes/auth/password.js',
  'src/routes/card-description.js',
  'src/routes/catalog.js',
  'src/utils/addressValidation.js',
  'src/utils/cardImageResolver.js',
  'src/utils/cardOcr.js',
  'src/utils/carrierTracking.js',
  'src/utils/ebayClient.js',
  'src/utils/exchangeRates.js',
  'src/utils/ga4Client.js',
  'src/utils/gradeEstimator.js',
  'src/utils/newsletter.js',
  'src/utils/paypalClient.js',
  'src/utils/psaApiClient.js',
  'src/utils/psaScraper.js',
  'src/utils/recaptcha.js',
  'src/utils/turnstile.js',
];

const read = (rel) => readFileSync(join(root, rel), 'utf8');

// Each `fetch(` call and whether its argument list carries a signal. Walks
// from the call to its matching close paren, so a signal in a different call
// on the same file cannot vouch for one that lacks it.
function fetchCalls(src) {
  const calls = [];
  const re = /(?<![\w.])fetch\(/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')' && --depth === 0) break;
    }
    const args = src.slice(m.index, i + 1);
    const line = src.slice(0, m.index).split('\n').length;
    calls.push({ line, hasSignal: /\bsignal\s*[:,)}]/.test(args) });
  }
  return calls;
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
});

describe('outbound timeouts', () => {
  it('every direct fetch in the known call sites passes an abort signal', () => {
    for (const rel of FETCH_SITES) {
      const calls = fetchCalls(read(rel));
      expect(calls.length, `${rel} has no fetch() — remove it from the list`).toBeGreaterThan(0);
      const bare = calls.filter((c) => !c.hasSignal).map((c) => `${rel}:${c.line}`);
      expect(bare, 'fetch() without a signal').toEqual([]);
    }
  });

  it('no backend file calls the global fetch outside the known sites or safeFetch', () => {
    const known = new Set([...FETCH_SITES, 'src/utils/safeFetch.js', 'src/routes/admin.js', 'src/utils/cardSightClient.js']);
    const offenders = [];
    for (const full of [...walk(join(root, 'src')), ...walk(join(root, 'api'))]) {
      const rel = full.slice(root.length + 1);
      if (known.has(rel)) continue;
      const src = readFileSync(full, 'utf8');
      if (fetchCalls(src).length) offenders.push(rel);
    }
    // A new outbound call belongs in FETCH_SITES (with a signal) or behind
    // safeFetch; this keeps the list honest.
    expect(offenders).toEqual([]);
  });

  it('keeps every budget inside the function that runs it', () => {
    const FUNCTION_40S = 40_000;
    for (const key of ['verify', 'geocode', 'hibp', 'newsletter', 'ebay', 'psa', 'paypal', 'exchangeRate', 'aiProxy', 'anthropicShort', 'stripe']) {
      expect(OUTBOUND_TIMEOUT_MS[key], key).toBeGreaterThan(0);
      expect(OUTBOUND_TIMEOUT_MS[key], key).toBeLessThan(FUNCTION_40S);
    }
    // These run in their own 300 s functions (api/event-scan.js,
    // api/blog-generate.js, api/grade-estimate.js).
    for (const key of ['anthropicScan', 'anthropicDraft', 'anthropicGrade']) {
      expect(OUTBOUND_TIMEOUT_MS[key], key).toBeLessThan(300_000);
    }
  });

  it('the Anthropic SDK is never a static import in the backend', () => {
    // Three route files reached the SDK at module load for calls that run
    // once a day; a static import puts it on every cold start.
    const offenders = [];
    for (const full of [...walk(join(root, 'src')), ...walk(join(root, 'api'))]) {
      const src = readFileSync(full, 'utf8');
      if (/^import\s+[^;]*from\s+'@anthropic-ai\/sdk'/m.test(src)) offenders.push(full.slice(root.length + 1));
    }
    expect(offenders).toEqual([]);
  });
});
