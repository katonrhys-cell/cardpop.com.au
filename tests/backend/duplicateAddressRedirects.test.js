import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Search Console (2026-11) showed pages reachable at two addresses being
// indexed twice or filed as "Duplicate without user-selected canonical".
// Each second address must 301 to the one in the sitemap, and the member
// profile alias must be prerendered for crawlers rather than served as the
// bare SPA shell.
const routes = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));

describe('second addresses of a page', () => {
  it.each([
    ['/privacy', '/privacy-policy'],
    ['/photography-guide', '/photography-standard'],
    ['/grading/guide/:scale', '/grading/scales/:scale'],
  ])('%s permanently redirects to %s', (source, destination) => {
    const rule = routes.redirects.find((r) => r.source === source);
    expect(rule).toMatchObject({ destination, permanent: true });
  });

  it('serves crawlers the seller prerender at /community/user/:id', () => {
    const rule = routes.rewrites.find((r) => r.source === '/community/user/:id');
    expect(rule?.destination).toBe('/api/prerender?path=/seller/:id');
    const seller = routes.rewrites.find((r) => r.source === '/seller/:id');
    expect(rule.has).toEqual(seller.has);
  });
});
